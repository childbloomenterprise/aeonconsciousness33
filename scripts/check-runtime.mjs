import assert from "node:assert/strict";
const routes = [
  "chat",
  "transcribe",
  "journeys",
  "events",
  "health-context",
  "nearby",
  "conversations",
  "privacy",
  "onboarding",
  "photo",
  "status",
];
for (const route of routes) {
  const { default: handler } = await import(
    `../.local/server-build/api/${route}.js`
  );
  const headers = {};
  let status, body;
  const response = {
    setHeader(name, value) {
      headers[name] = value;
    },
    status(value) {
      status = value;
      return this;
    },
    json(value) {
      body = value;
      return this;
    },
  };
  await handler(
    { method: "GET", headers: {}, query: {}, url: `/api/${route}` },
    response,
  );
  assert.equal(headers["Cache-Control"], "no-store", route);
  assert.ok(
    route === "status" ? status === 200 : [401, 405].includes(status),
    `${route}: ${status} ${JSON.stringify(body)}`,
  );
}
console.log(
  "All compiled Node ESM routes load and return uncached access/setup responses.",
);
