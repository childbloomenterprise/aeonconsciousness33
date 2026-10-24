import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { expect, it, vi } from "vitest";
it("matches public precached scripts across browser Origin/Vary differences", async () => {
  const listeners = new Map<string, Function>();
  const script = new Response("cached public script");
  const match = vi.fn().mockResolvedValue(script);
  const fetch = vi.fn();
  vm.runInNewContext(
    await readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    {
      self: {
        location: { origin: "https://linc.test" },
        addEventListener: (name: string, fn: Function) =>
          listeners.set(name, fn),
      },
      URL,
      caches: { match },
      fetch,
    },
  );
  const request = new Request("https://linc.test/assets/app.js");
  const respondWith = vi.fn();
  listeners.get("fetch")!({ request, respondWith });
  expect(await respondWith.mock.calls[0][0]).toBe(script);
  expect(match).toHaveBeenCalledWith(request, { ignoreVary: true });
  expect(fetch).not.toHaveBeenCalled();
});
it("service worker never intercepts authenticated API or third-party requests", async () => {
  const listeners = new Map<string, Function>();
  const source = await readFile(
    new URL("../public/sw.js", import.meta.url),
    "utf8",
  );
  const cache = vi.fn();
  vm.runInNewContext(source, {
    self: {
      location: { origin: "https://linc.test" },
      addEventListener: (name: string, fn: Function) => listeners.set(name, fn),
      skipWaiting: () => {},
      clients: { claim: () => {} },
    },
    URL,
    caches: { open: cache, match: cache, keys: cache },
    fetch: cache,
  });
  for (const request of [
    new Request("https://linc.test/api/chat"),
    new Request("https://linc.test/assets/private", {
      headers: { Authorization: "Bearer private" },
    }),
    new Request("https://project.supabase.co/rest/v1/journey_events"),
  ]) {
    const respondWith = vi.fn();
    listeners.get("fetch")!({ request, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
  }
  expect(cache).not.toHaveBeenCalled();
});
it("serves the saved app shell when a navigation fetch loses its connection", async () => {
  const listeners = new Map<string, Function>();
  const shell = new Response("saved application shell");
  const match = vi.fn().mockResolvedValue(shell);
  vm.runInNewContext(
    await readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    {
      self: {
        location: { origin: "https://linc.test" },
        addEventListener: (name: string, fn: Function) =>
          listeners.set(name, fn),
        skipWaiting() {},
        clients: { claim() {} },
      },
      URL,
      caches: { match },
      fetch: vi.fn().mockRejectedValue(new TypeError("Network disconnected")),
    },
  );
  const respondWith = vi.fn();
  listeners.get("fetch")!({
    request: {
      url: "https://linc.test/journey",
      method: "GET",
      mode: "navigate",
      headers: new Headers(),
    },
    respondWith,
  });
  expect(await respondWith.mock.calls[0][0]).toBe(shell);
  expect(match).toHaveBeenCalledWith("/index.html");
});
it("reports an incomplete app download instead of confirming readiness", async () => {
  const listeners = new Map<string, Function>();
  const postMessage = vi.fn();
  vm.runInNewContext(
    await readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    {
      self: {
        location: { origin: "https://linc.test" },
        addEventListener: (name: string, fn: Function) =>
          listeners.set(name, fn),
        skipWaiting() {},
        clients: { claim() {} },
      },
      URL,
      caches: {
        open: async () => ({
          addAll: async () => {
            throw new TypeError("Lost connection");
          },
        }),
      },
    },
  );
  const waitUntil = vi.fn();
  listeners.get("message")!({
    data: { type: "PREPARE_JOURNEY_SHELL" },
    ports: [{ postMessage }],
    waitUntil,
  });
  await waitUntil.mock.calls[0][0];
  expect(postMessage).toHaveBeenCalledWith({ ready: false });
});
it("confirms an already saved app while offline without attempting a download", async () => {
  const listeners = new Map<string, Function>();
  const addAll = vi.fn().mockRejectedValue(new TypeError("Offline"));
  const postMessage = vi.fn();
  vm.runInNewContext(
    await readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    {
      self: {
        addEventListener: (name: string, fn: Function) =>
          listeners.set(name, fn),
      },
      caches: {
        open: async () => ({
          match: async () => new Response("saved"),
          addAll,
        }),
      },
      Response,
    },
  );
  const waitUntil = vi.fn();
  listeners.get("message")!({
    data: { type: "PREPARE_JOURNEY_SHELL" },
    ports: [{ postMessage }],
    waitUntil,
  });
  await waitUntil.mock.calls[0][0];
  expect(postMessage).toHaveBeenCalledWith({ ready: true });
  expect(addAll).not.toHaveBeenCalled();
});
it("opens the saved website locally even when the network is available", async () => {
  const listeners = new Map<string, Function>();
  const shell = new Response("local app"),
    fetch = vi.fn().mockResolvedValue(new Response("network"));
  vm.runInNewContext(
    await readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    {
      self: {
        location: { origin: "https://linc.test" },
        addEventListener: (name: string, fn: Function) =>
          listeners.set(name, fn),
      },
      URL,
      caches: { match: async () => shell },
      fetch,
    },
  );
  const respondWith = vi.fn();
  listeners.get("fetch")!({
    request: {
      url: "https://linc.test/profile",
      method: "GET",
      mode: "navigate",
      headers: new Headers(),
    },
    respondWith,
  });
  expect(await respondWith.mock.calls[0][0]).toBe(shell);
  expect(fetch).not.toHaveBeenCalled();
});
