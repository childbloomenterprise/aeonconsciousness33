import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const index = await readFile("dist/index.html");
const hash = createHash("sha256").update(index).digest("hex").slice(0, 12);
const worker = await readFile("dist/sw.js", "utf8");
async function collect(directory) {
  const items = await readdir(directory, { withFileTypes: true }).catch(
    () => [],
  );
  return (
    await Promise.all(
      items.map((item) =>
        item.isDirectory()
          ? collect(`${directory}/${item.name}`)
          : [`/${directory.slice(5)}/${item.name}`],
      ),
    )
  ).flat();
}
const assets = [
  ...(await collect("dist/assets")),
  ...(await collect("dist/images")),
];
await writeFile(
  "dist/sw.js",
  worker
    .replace("linc33-shell-v1", `linc33-shell-${hash}`)
    .replace(
      "/*__BUILD_ASSETS__*/",
      assets.map((asset) => JSON.stringify(asset) + ",").join("\n"),
    ),
);
console.log(
  `App-shell cache version bound to this build; ${assets.length} assets prepared for offline use.`,
);
