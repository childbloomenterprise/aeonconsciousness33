import type {
  Conversation,
  Journey,
  JourneyEvent,
  Message,
  ProfileState,
} from "../../shared/contracts";
import {
  offlineJourneys,
  type OfflineJourneys,
  type OfflineSend,
} from "./offline";

/** Mirror account data independently of which screens the traveller opens. */
export class LocalAppMirror {
  private running = new Map<string, Promise<void>>();
  private completed = new Map<string, number>();
  constructor(private store: OfflineJourneys = offlineJourneys) {}
  sync(
    owner: string,
    send: OfflineSend,
    current: () => boolean,
    fresh = false,
  ): Promise<void> {
    const active = this.running.get(owner);
    if (active)
      return fresh
        ? active.then(() => this.sync(owner, send, current, true))
        : active;
    const run = this.download(owner, send, current, fresh).finally(() =>
      this.running.delete(owner),
    );
    this.running.set(owner, run);
    return run;
  }
  private async download(
    owner: string,
    send: OfflineSend,
    current: () => boolean,
    fresh: boolean,
  ) {
    const profile = await send<ProfileState>("health-context");
    if (!current()) return;
    if (!profile.consents.sensitive_storage) {
      this.completed.delete(owner);
      await this.store.clear(owner);
      return;
    }
    await this.store.cacheProfile(owner, profile);
    // Consent and profile stay fresh even when the full-account download is skipped.
    if (!fresh && Date.now() - (this.completed.get(owner) || 0) < 60000) {
      const saved = await this.store.read(owner);
      if (saved?.syncedAt) return;
    }
    const all = async <T>(route: string, size: number): Promise<T[]> => {
      const result: T[] = [];
      for (let offset = 0; current(); offset += size) {
        const page = await send<T[]>(
          `${route}${route.includes("?") ? "&" : "?"}offset=${offset}`,
        );
        if (!current()) return [];
        result.push(...page);
        if (page.length < size) break;
      }
      return result;
    };
    const journeys = await all<Journey>("journeys", 100);
    if (!current()) return;
    // A small pool downloads all trips, including ones never opened on this phone.
    const remaining = journeys.slice();
    await Promise.all(
      Array.from({ length: Math.min(3, remaining.length) }, async () => {
        while (current()) {
          const journey = remaining.shift();
          if (!journey) break;
          const events = await all<JourneyEvent>(
            `events?journey_id=${journey.id}`,
            200,
          );
          if (!current()) return;
          await this.store.prepare(owner, journey, events, profile);
        }
      }),
    );
    if (!current()) return;
    await this.store.reconcile(owner, journeys);
    const savedConversations = await this.store.read(owner);
    if (!current()) return;
    const versions = (savedConversations?.snapshots?.[
      "conversation-versions"
    ] || {}) as Record<string, string>;
    const conversations = await all<Conversation>("conversations", 30);
    if (!current()) return;
    await this.store.cacheSnapshot(owner, "conversations", conversations);
    const pending = conversations.slice();
    await Promise.all(
      Array.from({ length: Math.min(3, pending.length) }, async () => {
        while (current()) {
          const conversation = pending.shift();
          if (!conversation) return;
          const snapshot =
            savedConversations?.snapshots?.[
              `conversations?id=${conversation.id}`
            ];
          if (
            !fresh &&
            conversation.updated_at &&
            versions[conversation.id] === conversation.updated_at &&
            Array.isArray(snapshot)
          )
            continue;
          const messages = await all<Message>(
            `conversations?id=${conversation.id}`,
            100,
          );
          if (!current()) return;
          await this.store.cacheSnapshot(
            owner,
            `conversations?id=${conversation.id}`,
            messages,
          );
        }
      }),
    );
    if (!current()) return;
    // Advance revisions only after every required history download succeeded.
    await this.store.cacheSnapshot(
      owner,
      "conversation-versions",
      Object.fromEntries(
        conversations
          .filter((item) => item.updated_at)
          .map((item) => [item.id, item.updated_at]),
      ),
    );
    if (!current()) return;
    // prepare() deliberately strips private health data for the legacy manual mode.
    // The automatic local app keeps the full consented profile on this device.
    await this.store.cacheProfile(owner, profile);
    await this.store.markSynced(owner);
    this.completed.set(owner, Date.now());
  }
}
export const localAppMirror = new LocalAppMirror();
