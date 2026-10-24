import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ consent: vi.fn(), ownership: vi.fn() }));
vi.mock("../server/http.js", () => ({
  handler: (_methods: string[], callback: unknown) => callback,
  body: (request: { body: unknown }) => request.body,
  query: () => "",
  consent: mocks.consent,
  ownership: mocks.ownership,
  dbCheck: (error: unknown) => {
    if (error) throw error;
  },
  ApiError: class extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
import endpoint from "../api/events";
const id = "11111111-1111-4111-8111-111111111111";
const journey = "22222222-2222-4222-8222-222222222222";
const base = "2026-10-23T08:00:00Z";
beforeEach(() => {
  mocks.consent.mockResolvedValue(true);
  mocks.ownership.mockResolvedValue(undefined);
});
async function patch(data: unknown, expected = true) {
  const chain = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  const callback = endpoint as unknown as (
    context: unknown,
  ) => Promise<unknown>;
  return {
    chain,
    run: () =>
      callback({
        req: {
          method: "PATCH",
          body: {
            id,
            journey_id: journey,
            event: { event_type: "note", title: "Correction" },
            ...(expected ? { expected_updated_at: base } : {}),
          },
        },
        user: { id },
        db: { from: () => chain },
      }),
  };
}
it("includes the expected timestamp in the atomic update filter", async () => {
  const { chain, run } = await patch({ id });
  expect(await run()).toEqual({ id });
  expect(chain.eq).toHaveBeenCalledWith("updated_at", base);
  expect(chain.eq).toHaveBeenCalledWith("user_id", id);
});
it("returns a conflict when the timestamp changed rather than overwriting", async () => {
  const { run } = await patch(null);
  await expect(run()).rejects.toMatchObject({
    status: 409,
    code: "ENTRY_CONFLICT",
  });
});
it("retains compatibility with existing online clients", async () => {
  const { chain, run } = await patch({ id }, false);
  expect(await run()).toEqual({ id });
  expect(chain.eq.mock.calls.some((args) => args[0] === "updated_at")).toBe(
    false,
  );
});
it("rechecks private storage consent before applying an offline correction", async () => {
  mocks.consent.mockResolvedValue(false);
  const { chain, run } = await patch({ id });
  await expect(run()).rejects.toMatchObject({ status: 403 });
  expect(chain.update).not.toHaveBeenCalled();
});
