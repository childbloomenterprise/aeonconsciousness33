import { spawn } from "node:child_process";
const processes = [
  spawn(process.execPath, ["--import", "tsx", "scripts/local-api.ts"], {
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
    { stdio: "inherit" },
  ),
];
function stop() {
  for (const child of processes) child.kill();
}
process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});
for (const child of processes)
  child.on("exit", (code) => {
    if (code) {
      stop();
      process.exit(code);
    }
  });
