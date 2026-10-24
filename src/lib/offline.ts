import {
  eventDraft,
  type EventDraft,
  type Journey,
  type JourneyEvent,
  type ProfileState,
} from "../../shared/contracts";

export type PendingEntry = {
  id: string;
  journeyId: string;
  method: "POST" | "PATCH";
  eventId: string;
  event: EventDraft;
  baseUpdatedAt?: string;
  state: "pending" | "conflict" | "failed";
  error?: string;
};
export type JourneyBundle = {
  journey: Journey;
  events: JourneyEvent[];
  savedAt: string;
};
export type OfflineAccount = {
  id: string;
  profile: ProfileState;
  bundles: Record<string, JourneyBundle>;
  queue: PendingEntry[];
  snapshots?: Record<string, unknown>;
  syncedAt?: string;
};
export interface OfflineStorage {
  read(id: string): Promise<OfflineAccount | undefined>;
  update(
    id: string,
    change: (account: OfflineAccount | undefined) => OfflineAccount | undefined,
  ): Promise<void>;
}
const identityKey = "linc33-offline-account-v1";
export const offlineChanged = "linc33-offline-changed";
function changed() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(offlineChanged));
}
// A single IndexedDB read/write transaction keeps cross-tab queue updates atomic.
export class IndexedOfflineStorage implements OfflineStorage {
  private connection?: Promise<IDBDatabase>;
  private open() {
    return (this.connection ||= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("linc33-journeys-v1", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("accounts", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.connection = undefined;
        reject(new Error("Offline storage is unavailable on this device."));
      };
      request.onblocked = () => {
        this.connection = undefined;
        reject(
          new Error("Close other LINC33 tabs and retry offline preparation."),
        );
      };
    }));
  }
  async read(id: string) {
    const db = await this.open();
    return new Promise<OfflineAccount | undefined>((resolve, reject) => {
      const transaction = db.transaction("accounts", "readonly");
      const request = transaction.objectStore("accounts").get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async update(
    id: string,
    change: (account: OfflineAccount | undefined) => OfflineAccount | undefined,
  ) {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("accounts", "readwrite");
      const store = transaction.objectStore("accounts");
      const request = store.get(id);
      request.onsuccess = () => {
        try {
          const next = change(request.result);
          if (next) store.put(next);
          else store.delete(id);
        } catch (error) {
          transaction.abort();
          reject(error);
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(
          new Error(
            "Could not save on this device. Free some storage and retry.",
          ),
        );
      transaction.onabort = () =>
        reject(
          new Error(
            "Offline storage was interrupted. Your entry has not been saved.",
          ),
        );
    });
    changed();
  }
}
export function readOfflineOwner(): string | null {
  try {
    return localStorage.getItem(identityKey);
  } catch {
    return null;
  }
}
export function rememberOfflineOwner(id: string | null) {
  try {
    if (id) localStorage.setItem(identityKey, id);
    else localStorage.removeItem(identityKey);
  } catch {
    /* current tab remains usable */
  }
}
export function networkFailure(error: unknown): boolean {
  const value = error as { status?: number; name?: string };
  return (
    error instanceof TypeError ||
    value?.name === "TimeoutError" ||
    value?.name === "AbortError"
  );
}
export function entryIsPending(entry: JourneyEvent | undefined) {
  return !!(entry as (JourneyEvent & { offline_pending?: boolean }) | undefined)
    ?.offline_pending;
}
function sameDraft(a: unknown, b: unknown) {
  const first = eventDraft.safeParse(pickDraft(a));
  const second = eventDraft.safeParse(pickDraft(b));
  return (
    first.success &&
    second.success &&
    JSON.stringify(first.data) === JSON.stringify(second.data)
  );
}
function pickDraft(value: unknown) {
  const item = value as Record<string, unknown>;
  if (!item) return {};
  return Object.fromEntries(
    Object.keys(eventDraft.shape).map((key) => [key, item[key]]),
  );
}
export type OfflineSend = <T>(
  route: string,
  method?: string,
  body?: unknown,
) => Promise<T>;

export class OfflineJourneys {
  private flushing = new Map<string, Promise<void>>();
  constructor(private storage: OfflineStorage) {}
  read(id: string) {
    return this.storage.read(id);
  }
  async clear(id: string) {
    await this.storage.update(id, () => undefined);
    if (readOfflineOwner() === id) rememberOfflineOwner(null);
  }
  async prepare(
    id: string,
    journey: Journey,
    events: JourneyEvent[],
    profile: ProfileState,
  ) {
    if (!profile.consents.sensitive_storage)
      throw new Error(
        "Enable private storage in Profile before preparing a journey.",
      );
    if (
      journey.user_id !== id ||
      events.some(
        (event) => event.user_id !== id || event.journey_id !== journey.id,
      )
    )
      throw new Error("This journey does not belong to the signed-in account.");
    await this.storage.update(id, (current) => ({
      ...current,
      id,
      // Do not persist health profiles, emergency contacts, or AI consent offline.
      profile: {
        display_name: profile.display_name,
        profile: null,
        consents: { sensitive_storage: true, external_ai: false },
      },
      bundles: {
        ...current?.bundles,
        [journey.id]: { journey, events, savedAt: new Date().toISOString() },
      },
      queue: current?.queue || [],
    }));
    rememberOfflineOwner(id);
  }
  async cacheProfile(id: string, profile: ProfileState) {
    if (!profile.consents.sensitive_storage) {
      await this.clear(id);
      return;
    }
    await this.storage.update(id, (current) => ({
      ...current,
      id,
      profile,
      bundles: current?.bundles || {},
      queue: current?.queue || [],
      snapshots: { ...current?.snapshots, "health-context": profile },
    }));
    rememberOfflineOwner(id);
  }
  async cacheSnapshot(id: string, route: string, value: unknown) {
    await this.storage.update(id, (account) => {
      if (!account) return;
      account.snapshots = { ...account.snapshots, [route]: value };
      if (route === "conversations" && Array.isArray(value)) {
        const ids = new Set(value.map((item) => item.id));
        for (const key of Object.keys(account.snapshots)) {
          if (
            key.startsWith("conversations?id=") &&
            !ids.has(key.slice("conversations?id=".length))
          )
            delete account.snapshots[key];
        }
      }
      return account;
    });
  }
  async markSynced(id: string) {
    await this.storage.update(id, (account) => {
      if (account) account.syncedAt = new Date().toISOString();
      return account;
    });
  }
  async remove(id: string, journeyId: string) {
    await this.storage.update(id, (account) => {
      if (!account) return;
      if (account.queue.some((item) => item.journeyId === journeyId))
        throw new Error(
          "Sync or resolve pending entries before removing this saved journey.",
        );
      delete account.bundles[journeyId];
      return account;
    });
  }
  async journeys(id: string) {
    return Object.values((await this.read(id))?.bundles || {}).map(
      (bundle) => bundle.journey,
    );
  }
  async events(id: string, journeyId: string) {
    const account = await this.read(id);
    const bundle = account?.bundles[journeyId];
    if (!bundle)
      throw new Error(
        "This journey has not finished saving to this device. Reconnect to finish automatic setup.",
      );
    const events = new Map(bundle.events.map((event) => [event.id, event]));
    account!.queue
      .filter((item) => item.journeyId === journeyId)
      .forEach((item) => {
        const original = events.get(item.eventId);
        events.set(item.eventId, {
          ...original,
          ...item.event,
          id: item.eventId,
          journey_id: journeyId,
          user_id: id,
          created_at:
            original?.created_at || item.event.occurred_at || bundle.savedAt,
          source_message_id: original?.source_message_id || null,
          offline_pending: true,
        } as JourneyEvent);
      });
    return [...events.values()];
  }
  async updateEvents(id: string, journeyId: string, events: JourneyEvent[]) {
    await this.storage.update(id, (account) => {
      if (account?.bundles[journeyId]) {
        account.bundles[journeyId].events = events;
        account.bundles[journeyId].savedAt = new Date().toISOString();
      }
      return account;
    });
  }
  async reconcile(id: string, journeys: Journey[]) {
    await this.storage.update(id, (account) => {
      if (!account) return;
      for (const key of Object.keys(account.bundles)) {
        const journey = journeys.find((item) => item.id === key);
        if (journey) account.bundles[key].journey = journey;
        else if (!account.queue.some((item) => item.journeyId === key))
          delete account.bundles[key];
      }
      return account;
    });
  }
  async enqueue(
    id: string,
    method: "POST" | "PATCH",
    input: {
      id?: string;
      request_id?: string;
      journey_id: string;
      event: unknown;
      expected_updated_at?: string;
    },
  ) {
    const event = eventDraft.parse(input.event);
    const requestId = input.request_id || crypto.randomUUID();
    const eventId = method === "POST" ? requestId : input.id!;
    await this.storage.update(id, (account) => {
      const bundle = account?.bundles[input.journey_id];
      if (!bundle)
        throw new Error(
          "This journey is still saving to this device. Reconnect briefly, then retry.",
        );
      const existing = account!.queue.find((item) => item.eventId === eventId);
      if (existing) {
        if (sameDraft(existing.event, event)) return account;
        throw new Error(
          "This entry is waiting to sync. Sync it before making another correction.",
        );
      }
      const base = bundle.events.find((item) => item.id === eventId);
      const baseUpdatedAt = input.expected_updated_at || base?.updated_at;
      if (method === "PATCH" && !baseUpdatedAt)
        throw new Error(
          "Reconnect and refresh this entry before correcting it offline.",
        );
      account!.queue.push({
        id: requestId,
        journeyId: input.journey_id,
        eventId,
        method,
        event,
        baseUpdatedAt,
        state: "pending",
      });
      return account;
    });
    return (await this.events(id, input.journey_id)).find(
      (item) => item.id === eventId,
    )!;
  }
  async discard(id: string, operationId: string) {
    await this.storage.update(id, (account) => {
      if (account)
        account.queue = account.queue.filter((item) => item.id !== operationId);
      return account;
    });
  }
  async retry(id: string) {
    await this.storage.update(id, (account) => {
      account?.queue.forEach((item) => {
        if (item.state === "failed") {
          item.state = "pending";
          delete item.error;
        }
      });
      return account;
    });
  }
  // Choosing the server version is explicit. Local text is never overwritten silently.
  async useServer(
    id: string,
    operationId: string,
    serverEvents: JourneyEvent[],
  ) {
    await this.storage.update(id, (account) => {
      if (!account) return;
      const operation = account.queue.find((item) => item.id === operationId);
      if (operation && account.bundles[operation.journeyId]) {
        account.bundles[operation.journeyId].events = serverEvents;
        account.queue = account.queue.filter((item) => item.id !== operationId);
      }
      return account;
    });
  }
  flush(
    id: string,
    send: OfflineSend,
    stillCurrent: () => boolean = () => true,
  ) {
    const running = this.flushing.get(id);
    if (running) return running;
    const run = this.drain(id, send, stillCurrent).finally(() =>
      this.flushing.delete(id),
    );
    this.flushing.set(id, run);
    return run;
  }
  private async drain(
    id: string,
    send: OfflineSend,
    stillCurrent: () => boolean,
  ) {
    const queue = (await this.read(id))?.queue.slice() || [];
    for (const operation of queue) {
      if (!stillCurrent()) return;
      if (operation.state !== "pending") continue;
      // A sign-out or a user resolution in another tab may have removed this item.
      if (
        !(await this.read(id))?.queue.some((item) => item.id === operation.id)
      )
        continue;
      try {
        const result = await send<JourneyEvent>("events", operation.method, {
          journey_id: operation.journeyId,
          event: operation.event,
          ...(operation.method === "POST"
            ? { request_id: operation.id }
            : {
                id: operation.eventId,
                expected_updated_at: operation.baseUpdatedAt,
              }),
        });
        if (!stillCurrent()) return;
        await this.complete(id, operation, result);
      } catch (error) {
        if (!stillCurrent()) return;
        const status = (error as { status?: number }).status;
        if (
          networkFailure(error) ||
          status === 401 ||
          status === 408 ||
          status === 429 ||
          (status && status >= 500)
        )
          return;
        if (status === 409 && operation.method === "PATCH") {
          // A response may have been lost after a successful PATCH. A matching
          // server draft confirms the retry without making a second write.
          try {
            const events = await send<JourneyEvent[]>(
              `events?journey_id=${operation.journeyId}`,
            );
            const current = events.find(
              (event) => event.id === operation.eventId,
            );
            if (current && sameDraft(current, operation.event)) {
              await this.complete(id, operation, current);
              continue;
            }
          } catch {
            return;
          }
        }
        await this.storage.update(id, (account) => {
          const item = account?.queue.find((item) => item.id === operation.id);
          if (item) {
            item.state = status === 409 ? "conflict" : "failed";
            item.error =
              status === 409
                ? "This entry changed on another device. Your correction is kept below."
                : (error as Error).message || "Could not sync this entry.";
          }
          return account;
        });
      }
    }
  }
  private async complete(
    id: string,
    operation: PendingEntry,
    result: JourneyEvent,
  ) {
    await this.storage.update(id, (account) => {
      if (!account) return;
      const bundle = account.bundles[operation.journeyId];
      if (bundle)
        bundle.events = [
          ...bundle.events.filter(
            (event) => event.id !== result.id && event.id !== operation.eventId,
          ),
          result,
        ];
      account.queue = account.queue.filter((item) => item.id !== operation.id);
      return account;
    });
  }
}
export const offlineJourneys = new OfflineJourneys(new IndexedOfflineStorage());
