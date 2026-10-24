import sharp from "sharp";
import { writeFile } from "node:fs/promises";
const logo = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="100" fill="#006e73"/><g transform="translate(112 112) scale(12)" fill="none" stroke="#fff5e6" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/><path d="M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19"/></g></svg>`,
);
const mask = Buffer.from(logo.toString().replace('rx="100"', 'rx="0"'));
await writeFile(
  "public/icons/maskable-512.png",
  await sharp(mask).png().toBuffer(),
);
await writeFile(
  "public/icons/apple-touch-icon.png",
  await sharp(mask).resize(180, 180).png().toBuffer(),
);
for (const size of [192, 512])
  await writeFile(
    `public/icons/icon-${size}.png`,
    await sharp(logo).resize(size, size).png().toBuffer(),
  );
