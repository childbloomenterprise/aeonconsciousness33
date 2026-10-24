import { readdir, readFile } from "node:fs/promises";
const files = await readdir("dist/assets");
let bad = false;
for (const name of files.filter((x) => x.endsWith(".js"))) {
  const text = await readFile(`dist/assets/${name}`, "utf8");
  if (
    /NVIDIA_API_KEY|nvapi-[A-Za-z0-9_-]{20,}|GROQ_API_KEY|OPENROUTER_API_KEY|GEMINI_API_KEY|SUPABASE_SECRET_KEY|GOOGLE_MAPS_SERVER_KEY|GoogleGenAI|gsk_[A-Za-z0-9]{20,}/.test(
      text,
    )
  ) {
    bad = true;
    console.error(`Server-only marker found in ${name}`);
  }
  if (
    /Added to this sample journey|Cool air, slow morning|00000000-0000-4000-a000-000000000001/.test(
      text,
    )
  ) {
    bad = true;
    console.error(`Development fixtures found in ${name}`);
  }
}
if (bad) process.exit(1);
console.log(
  "Browser bundle contains no private provider configuration, server AI SDK or development fixture records.",
);
