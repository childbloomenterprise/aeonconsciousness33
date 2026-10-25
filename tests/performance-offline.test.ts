import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { expect, it, vi } from "vitest";
it("installs the offline app without bulk photos, then includes photos on explicit preparation", async () => {
  const source = (await readFile("public/sw.js", "utf8"))
    .replace("/*__BUILD_ASSETS__*/", '"/assets/app.js",')
    .replace("/*__OPTIONAL_ASSETS__*/", '"/images/dubai.webp",');
  const handlers: Record<string, (event: any) => void> = {};
  const addAll = vi.fn(async (_urls: string[]) => {});
  const cache = { addAll, match: vi.fn(async () => undefined) };
  const context = {
    self: {
      addEventListener: (name: string, fn: (event: any) => void) => {
        handlers[name] = fn;
      },
      skipWaiting: vi.fn(),
    },
    caches: { open: vi.fn(async () => cache) },
  };
  vm.runInNewContext(source, context);
  let task: Promise<unknown> = Promise.resolve();
  handlers.install({
    waitUntil: (p: Promise<unknown>) => {
      task = p;
    },
  });
  await task;
  expect(addAll.mock.calls[0][0]).toContain("/assets/app.js");
  expect(addAll.mock.calls[0][0]).not.toContain("/images/dubai.webp");
  const postMessage = vi.fn();
  handlers.message({
    data: { type: "PREPARE_JOURNEY_SHELL" },
    ports: [{ postMessage }],
    waitUntil: (p: Promise<unknown>) => {
      task = p;
    },
  });
  await task;
  expect(addAll.mock.calls[1][0]).toContain("/images/dubai.webp");
  expect(postMessage).toHaveBeenCalledWith({ ready: true });
});

it("uses this build's saved shell immediately and the network only before preparation", async () => {
  const source = await readFile("public/sw.js", "utf8");
  const handlers: Record<string, (event: any) => void> = {};
  const shell = { offline: true },
    online = { ok: true };
  const network = vi.fn(async () => online);
  const match = vi.fn(async () => shell);
  vm.runInNewContext(source, {
    URL,
    fetch: network,
    self: {
      location: { origin: "https://app.test" },
      addEventListener: (name: string, fn: (event: any) => void) => {
        handlers[name] = fn;
      },
    },
    caches: { open: vi.fn(async () => ({ match })) },
  });
  let response: Promise<unknown> = Promise.resolve();
  const event = {
    request: {
      url: "https://app.test/journey",
      method: "GET",
      mode: "navigate",
      headers: { has: () => false },
    },
    respondWith: (value: Promise<unknown>) => {
      response = value;
    },
  };
  handlers.fetch(event);
  expect(await response).toBe(shell);
  expect(network).not.toHaveBeenCalled();
  match.mockResolvedValueOnce(undefined as any);
  handlers.fetch(event);
  expect(await response).toBe(online);
  expect(match).toHaveBeenCalledWith("/index.html");
});
