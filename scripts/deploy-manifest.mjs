import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

// Explicit deployment allowlist: never traverse private environment files,
// screenshots, generated raw assets, local work files or dependencies.
const directories = ["src", "shared", "server", "api", "public", "scripts"];
const roots = [
  "package.json",
  "package-lock.json",
  "index.html",
  "tsconfig.json",
  "vite.config.ts",
  "vercel.json",
];
const files = [];
async function collect(path) {
  const entries = await readdir(resolve(path), { withFileTypes: true });
  for (const entry of entries) {
    const file = `${path}/${entry.name}`;
    if (entry.isDirectory()) await collect(file);
    else if (entry.isFile()) files.push(file);
  }
}
for (const directory of directories) await collect(directory);
files.push(...roots);
const manifest = [];
for (const file of files.sort()) {
  const bytes = await readFile(resolve(file));
  manifest.push({
    file,
    size: bytes.length,
    sha: createHash("sha1").update(bytes).digest("hex"),
    data: bytes.toString("base64"),
  });
}
process.stdout.write(JSON.stringify(manifest));
