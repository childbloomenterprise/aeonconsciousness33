import { expect, it, vi } from "vitest";
vi.mock("../server/http.js", () => ({
  handler: (_methods: string[], callback: unknown) => callback,
  query: (req: { url: string }, name: string) =>
    new URL(req.url, "https://test").searchParams.get(name),
  dbCheck: (error: unknown) => {
    if (error) throw error;
  },
  ownership: vi.fn(),
  ApiError: class extends Error {},
}));
import journeys from "../api/journeys";
import events from "../api/events";
import conversations from "../api/conversations";
const uuid = "11111111-1111-4111-8111-111111111111";
it.each([
  [journeys, "/?offset=100", 100, 199],
  [events, `/?journey_id=${uuid}&offset=200`, 200, 399],
  [conversations, "/?offset=30", 30, 59],
  [conversations, `/?id=${uuid}&offset=100`, 100, 199],
])(
  "supports complete automatic downloads beyond the first API page",
  async (endpoint, url, start, end) => {
    const range = vi.fn().mockResolvedValue({ data: [], error: null });
    const chain = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    await (endpoint as unknown as (context: unknown) => Promise<unknown>)({
      req: { method: "GET", url },
      user: { id: uuid },
      db: { from: () => chain },
    });
    expect(range).toHaveBeenCalledWith(start, end);
  },
);
