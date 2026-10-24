import { expect, it, vi } from "vitest";
import { LocalAppMirror } from "../src/lib/localApp";
import {
  OfflineJourneys,
  type OfflineAccount,
  type OfflineStorage,
  type OfflineSend,
} from "../src/lib/offline";
import {
  eventDraft,
  type Journey,
  type JourneyEvent,
  type ProfileState,
} from "../shared/contracts";
const owner = "11111111-1111-4111-8111-111111111111";
const date = "2026-10-24T08:00:00Z";
const profile: ProfileState = {
  display_name: "Traveller",
  profile: null,
  consents: { sensitive_storage: true, external_ai: false },
};
const journey = (id: string): Journey => ({
  id,
  user_id: owner,
  title: id,
  destination_name: "Dubai",
  started_at: date,
  ended_at: null,
  status: "active",
  created_at: date,
});
class Memory implements OfflineStorage {
  data = new Map<string, OfflineAccount>();
  private work = Promise.resolve();
  async read(id: string) {
    await this.work;
    return structuredClone(this.data.get(id));
  }
  update(
    id: string,
    change: (a: OfflineAccount | undefined) => OfflineAccount | undefined,
  ) {
    const next = this.work.then(() => {
      const result = change(structuredClone(this.data.get(id)));
      if (result) this.data.set(id, structuredClone(result));
      else this.data.delete(id);
    });
    this.work = next;
    return next;
  }
}
it("automatically saves every trip, paginates long histories, and preserves queued text", async () => {
  const storage = new Memory(),
    store = new OfflineJourneys(storage);
  const trips = [
    journey("33333333-3333-4333-8333-333333333333"),
    journey("44444444-4444-4444-8444-444444444444"),
  ];
  await store.prepare(owner, trips[0], [], profile);
  await store.enqueue(owner, "POST", {
    journey_id: trips[0].id,
    request_id: "55555555-5555-4555-8555-555555555555",
    event: { event_type: "note", title: "Not yet synced", occurred_at: date },
  });
  const events: JourneyEvent[] = Array.from({ length: 205 }, (_, i) => ({
    ...eventDraft.parse({
      event_type: "note",
      title: "Entry " + i,
      occurred_at: date,
    }),
    id: String(i),
    user_id: owner,
    journey_id: trips[0].id,
    created_at: date,
    source_message_id: null,
  }));
  const routes: string[] = [];
  const send: OfflineSend = async <T>(route: string) => {
    routes.push(route);
    const url = new URL("https://test/" + route);
    const offset = Number(url.searchParams.get("offset") || 0);
    const data =
      url.pathname === "/health-context"
        ? profile
        : url.pathname === "/journeys"
          ? trips.slice(offset, offset + 100)
          : url.pathname === "/events"
            ? url.searchParams.get("journey_id") === trips[0].id
              ? events.slice(offset, offset + 200)
              : []
            : url.searchParams.has("id")
              ? [{ id: "message", content: "Past reply" }]
              : [{ id: "conversation", journey_id: trips[1].id }];
    return data as T;
  };
  await new LocalAppMirror(store).sync(owner, send, () => true);
  const saved = await store.read(owner);
  expect(Object.keys(saved!.bundles)).toHaveLength(2);
  expect(saved!.bundles[trips[0].id].events).toHaveLength(205);
  expect(saved!.queue).toHaveLength(1);
  expect(
    (await store.events(owner, trips[0].id)).some(
      (e) => e.title === "Not yet synced",
    ),
  ).toBe(true);
  expect(saved!.snapshots?.["conversations?id=conversation"]).toEqual([
    { id: "message", content: "Past reply" },
  ]);
  expect(saved!.syncedAt).toBeTruthy();
  expect(routes).toContain(`events?journey_id=${trips[0].id}&offset=200`);
});
it("does not restore private data after an account switch during a download", async () => {
  const storage = new Memory(),
    store = new OfflineJourneys(storage);
  let current = true;
  const send: OfflineSend = async <T>() => {
    current = false;
    return profile as T;
  };
  await new LocalAppMirror(store).sync(owner, send, () => current);
  expect(await store.read(owner)).toBeUndefined();
});
it("clears local data when server storage consent is revoked", async () => {
  const storage = new Memory(),
    store = new OfflineJourneys(storage);
  await store.prepare(owner, journey("trip"), [], profile);
  const send: OfflineSend = async <T>() =>
    ({
      ...profile,
      consents: { ...profile.consents, sensitive_storage: false },
    }) as T;
  await new LocalAppMirror(store).sync(owner, send, () => true);
  expect(await store.read(owner)).toBeUndefined();
});
it("keeps the last usable local copy when background updates lose their connection", async () => {
  const storage = new Memory(),
    store = new OfflineJourneys(storage);
  await store.prepare(owner, journey("trip"), [], profile);
  const send: OfflineSend = async <T>(route: string) => {
    if (route === "health-context") return profile as T;
    throw new TypeError("Offline");
  };
  await expect(
    new LocalAppMirror(store).sync(owner, send, () => true),
  ).rejects.toThrow("Offline");
  expect(await store.journeys(owner)).toHaveLength(1);
  expect((await store.read(owner))!.syncedAt).toBeUndefined();
});
it("removes deleted conversation messages from this device", async () => {
  const storage = new Memory(),
    store = new OfflineJourneys(storage);
  await store.cacheProfile(owner, profile);
  await store.cacheSnapshot(owner, "conversations?id=deleted", [
    { content: "old" },
  ]);
  await store.cacheSnapshot(owner, "conversations", []);
  expect(
    (await store.read(owner))!.snapshots?.["conversations?id=deleted"],
  ).toBeUndefined();
});
it("starts a fresh update after an in-flight download when a mutation needs new data", async () => {
  const storage = new Memory(),
    store = new OfflineJourneys(storage),
    mirror = new LocalAppMirror(store);
  let resolve!: () => void;
  const gate = new Promise<void>((r) => {
    resolve = r;
  });
  let profiles = 0;
  const send: OfflineSend = async <T>(route: string) => {
    if (route === "health-context") {
      profiles++;
      if (profiles === 1) await gate;
      return profile as T;
    }
    return [] as T;
  };
  const first = mirror.sync(owner, send, () => true);
  const fresh = mirror.sync(owner, send, () => true, true);
  resolve();
  await Promise.all([first, fresh]);
  expect(profiles).toBe(2);
});
