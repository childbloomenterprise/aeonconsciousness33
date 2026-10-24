import { readdir, mkdir, copyFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MountainSnow } from "lucide-react";
await mkdir("design/raw", { recursive: true });
await mkdir("public/icons", { recursive: true });
for (const name of (await readdir("design/raw")).filter((n) =>
  n.endsWith(".png"),
)) {
  await sharp(`design/raw/${name}`)
    .resize({
      width: name === "munnar.png" ? 1600 : 640,
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toFile(`public/images/${name.replace(".png", ".webp")}`);
}
const icon = renderToStaticMarkup(
  createElement(MountainSnow, {
    width: 512,
    height: 512,
    color: "#75c8e7",
    strokeWidth: 1.3,
  }),
);
await writeFile("public/icon.svg", icon);
for (const size of [192, 512])
  await sharp(Buffer.from(icon))
    .resize(size, size)
    .flatten({ background: "#0b1420" })
    .png()
    .toFile(`public/icons/icon-${size}.png`);
console.log(
  "Reference assets optimized; originals retained in design/raw. Standard Lucide mountain icon rendered for PWA.",
);
