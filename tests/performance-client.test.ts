// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../src/lib/client", async (original) => original());
import { request } from "../src/lib/client";
afterEach(() => vi.unstubAllGlobals());
it("shares concurrent identical GETs but fetches fresh data on the next read", async () => {
  let resolve!: (response: Response) => void;
  const fetcher = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValue(new Response(JSON.stringify({ value: 2 })));
  vi.stubGlobal("fetch", fetcher);
  const first = request<{ value: number }>("performance-probe");
  const second = request<{ value: number }>("performance-probe");
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  resolve(new Response(JSON.stringify({ value: 1 })));
  expect(await first).toEqual({ value: 1 });
  expect(await second).toEqual({ value: 1 });
  expect(await request("performance-probe")).toEqual({ value: 2 });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("does not merge writes or retain failed requests", async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("offline"))
    .mockImplementation(async () => new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal("fetch", fetcher);
  await expect(request("performance-failure")).rejects.toThrow("offline");
  await request("performance-failure");
  await Promise.all([
    request("performance-write", "POST", {}),
    request("performance-write", "POST", {}),
  ]);
  expect(fetcher).toHaveBeenCalledTimes(4);
});
