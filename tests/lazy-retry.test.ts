// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { retryImport } from "../src/lib/lazyRetry";
it("recovers a transient module download and does not retry application errors", async () => {
  vi.useFakeTimers();
  const loader = vi
    .fn()
    .mockRejectedValueOnce(
      new TypeError("Failed to fetch dynamically imported module"),
    )
    .mockResolvedValue({ ok: true });
  const result = retryImport(loader);
  await vi.runAllTimersAsync();
  expect(await result).toEqual({ ok: true });
  expect(loader).toHaveBeenCalledTimes(2);
  vi.useRealTimers();
  const broken = vi.fn().mockRejectedValue(new Error("Application bug"));
  await expect(retryImport(broken)).rejects.toThrow("Application bug");
  expect(broken).toHaveBeenCalledOnce();
});
