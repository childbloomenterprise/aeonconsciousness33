import { beforeEach, expect, it, vi } from "vitest";
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

const user = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const trip = "33333333-3333-4333-8333-333333333333";
const eventId = "44444444-4444-4444-8444-444444444444";
const requestId = "55555555-5555-4555-8555-555555555555";
const time = "2026-10-23T08:00:00Z";
const journey: Journey = {
  id: trip,
  user_id: user,
  title: "Dubai trip",
  destination_name: "Dubai",
  started_at: time,
  ended_at: null,
  created_at: time,
  status: "active",
};
const draft = eventDraft.parse({
  event_type: "hydration",
  title: "A glass of water",
  occurred_at: time,
});
const existing: JourneyEvent = {
  ...draft,
  id: eventId,
  journey_id: trip,
  user_id: user,
  created_at: time,
  updated_at: time,
  source_message_id: null,
};
const profile: ProfileState = {
  display_name: "Test traveller",
  profile: null,
  consents: { sensitive_storage: true, external_ai: true },
};

class MemoryStorage implements OfflineStorage {
  rows = new Map<string, OfflineAccount>();
  async read(id: string) {
    return structuredClone(this.rows.get(id));
  }
  async update(
    id: string,
    change: (value: OfflineAccount | undefined) => OfflineAccount | undefined,
  ) {
    const next = change(await this.read(id));
    if (next) this.rows.set(id, structuredClone(next));
    else this.rows.delete(id);
  }
}
let storage: MemoryStorage, offline: OfflineJourneys;
beforeEach(async () => {
  storage = new MemoryStorage();
  offline = new OfflineJourneys(storage);
  await offline.prepare(user, journey, [existing], profile);
});
const input = () => ({
  request_id: requestId,
  journey_id: trip,
  event: { ...draft, title: "Offline lunch", event_type: "meal" as const },
});
const error = (status: number) =>
  Object.assign(new Error(`Server ${status}`), { status });

it("restores prepared data and pending entries through a new store instance", async () => {
  await offline.enqueue(user, "POST", input());
  const restarted = new OfflineJourneys(storage);
  expect((await restarted.journeys(user))[0].id).toBe(trip);
  expect(
    (await restarted.events(user, trip)).map((event) => event.title),
  ).toContain("Offline lunch");
  expect((await restarted.read(user))!.queue).toHaveLength(1);
});
it("keeps accounts isolated and refuses a cross-account bundle", async () => {
  expect(await offline.journeys(other)).toEqual([]);
  await expect(offline.events(other, trip)).rejects.toThrow(/saving/);
  await expect(
    offline.prepare(other, journey, [existing], profile),
  ).rejects.toThrow("belong");
});
it("requires existing storage consent and excludes health profile and AI consent", async () => {
  await expect(
    offline.prepare(other, { ...journey, user_id: other }, [], {
      ...profile,
      consents: { sensitive_storage: false, external_ai: false },
    }),
  ).rejects.toThrow("private storage");
  expect((await offline.read(user))!.profile).toEqual({
    ...profile,
    consents: { sensitive_storage: true, external_ai: false },
  });
});
it("does not silently queue entries to an unprepared journey", async () => {
  await expect(
    offline.enqueue(user, "POST", { ...input(), journey_id: "not-prepared" }),
  ).rejects.toThrow(/saving/);
});
it("deduplicates repeated submissions with the same request ID", async () => {
  await offline.enqueue(user, "POST", input());
  await offline.enqueue(user, "POST", input());
  expect((await offline.read(user))!.queue).toHaveLength(1);
  expect(
    (await offline.events(user, trip)).filter(
      (event) => event.title === "Offline lunch",
    ),
  ).toHaveLength(1);
});
it("retains the original request ID across a lost response and reconnect replay", async () => {
  await offline.enqueue(user, "POST", input());
  const saved = { ...existing, id: requestId, ...input().event };
  const send = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("Network lost after commit"))
    .mockResolvedValueOnce(saved);
  await offline.flush(user, send as OfflineSend);
  expect((await offline.read(user))!.queue).toHaveLength(1);
  await offline.flush(user, send as OfflineSend);
  expect(send.mock.calls[0][2].request_id).toBe(requestId);
  expect(send.mock.calls[1][2].request_id).toBe(requestId);
  expect((await offline.read(user))!.queue).toHaveLength(0);
  expect(
    (await offline.events(user, trip)).filter(
      (event) => event.id === requestId,
    ),
  ).toHaveLength(1);
});
it.each([401, 408, 429, 500, 503])(
  "retains queued entries after retryable status %s",
  async (status) => {
    await offline.enqueue(user, "POST", input());
    await offline.flush(
      user,
      vi.fn().mockRejectedValue(error(status)) as OfflineSend,
    );
    expect((await offline.read(user))!.queue[0].state).toBe("pending");
  },
);
it("surfaces a rejected save instead of claiming cloud success", async () => {
  await offline.enqueue(user, "POST", input());
  await offline.flush(
    user,
    vi.fn().mockRejectedValue(error(403)) as OfflineSend,
  );
  expect((await offline.read(user))!.queue[0].state).toBe("failed");
});
it("preserves a conflicting correction and sends its expected server timestamp", async () => {
  await offline.enqueue(user, "PATCH", {
    id: eventId,
    journey_id: trip,
    event: { ...draft, title: "My correction" },
  });
  const send = vi
    .fn()
    .mockRejectedValueOnce(error(409))
    .mockResolvedValueOnce([
      { ...existing, title: "Other device's correction" },
    ]);
  await offline.flush(user, send as OfflineSend);
  expect(send.mock.calls[0][2].expected_updated_at).toBe(time);
  expect((await offline.read(user))!.queue[0]).toMatchObject({
    state: "conflict",
    event: { title: "My correction" },
  });
  expect((await offline.events(user, trip))[0].title).toBe("My correction");
  await offline.useServer(user, (await offline.read(user))!.queue[0].id, [
    { ...existing, title: "Other device's correction" },
  ]);
  expect((await offline.events(user, trip))[0].title).toBe(
    "Other device's correction",
  );
});
it("recognizes an already-applied PATCH after a lost response", async () => {
  await offline.enqueue(user, "PATCH", {
    id: eventId,
    journey_id: trip,
    event: { ...draft, title: "My correction" },
  });
  const send = vi
    .fn()
    .mockRejectedValueOnce(error(409))
    .mockResolvedValueOnce([{ ...existing, title: "My correction" }]);
  await offline.flush(user, send as OfflineSend);
  expect((await offline.read(user))!.queue).toEqual([]);
});
it("does not send after account change and does not restore storage after signout mid-request", async () => {
  await offline.enqueue(user, "POST", input());
  const blocked = vi.fn();
  await offline.flush(user, blocked as OfflineSend, () => false);
  expect(blocked).not.toHaveBeenCalled();
  const send = vi.fn(async () => {
    await offline.clear(user);
    return existing;
  });
  await offline.flush(user, send as OfflineSend);
  expect(await offline.read(user)).toBeUndefined();
});
it("refuses removal while pending edits exist", async () => {
  await offline.enqueue(user, "POST", input());
  await expect(offline.remove(user, trip)).rejects.toThrow("pending entries");
  expect((await offline.read(user))!.queue).toHaveLength(1);
});
it("does not clear a review draft when storage fails", async () => {
  const failed = new OfflineJourneys({
    read: (id) => storage.read(id),
    update: async () => {
      throw new Error("Storage full");
    },
  });
  await expect(failed.enqueue(user, "POST", input())).rejects.toThrow(
    "Storage full",
  );
});
