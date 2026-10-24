import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const base = new URL(process.argv[2] || "https://linc-33.vercel.app");
const results = [];
for (const path of [
  "/",
  "/journey",
  "/chat",
  "/login",
  "/login-review",
  "/privacy",
  "/terms",
  "/sw.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/images/munnar.webp",
  "/api/status",
  "/api/events",
  "/api/journeys",
  "/api/health-context",
  "/api/conversations",
  "/api/nearby",
  "/api/chat",
  "/api/transcribe",
  "/api/privacy",
  "/api/onboarding",
  "/api/photo",
]) {
  const response = await fetch(new URL(path, base));
  const body = response.headers.get("content-type")?.includes("json")
    ? await response.json()
    : undefined;
  const expected = [
    "/api/chat",
    "/api/transcribe",
    "/api/privacy",
    "/api/onboarding",
    "/api/photo",
  ].includes(path)
    ? 405
    : path.startsWith("/api/") && path !== "/api/status"
      ? 401
      : 200;
  assert.equal(response.status, expected, path);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", path);
  if (path.startsWith("/api/"))
    assert.equal(response.headers.get("cache-control"), "no-store", path);
  results.push({
    path,
    status: response.status,
    cache: response.headers.get("cache-control"),
    body,
  });
}
for (const path of [
  "/api/chat",
  "/api/transcribe",
  "/api/privacy",
  "/api/onboarding",
  "/api/photo",
]) {
  const response = await fetch(new URL(path, base), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(response.status, 401, path);
  assert.equal(response.headers.get("cache-control"), "no-store", path);
  results.push({
    path,
    method: "POST",
    status: response.status,
    body: await response.json(),
  });
}
await writeFile(
  "docs/deployment-smoke.json",
  JSON.stringify(
    { tested_at: new Date().toISOString(), base: base.origin, results },
    null,
    2,
  ),
);
console.log(
  `${results.length} production routing, asset, header and unauthenticated API smoke checks passed.`,
);
