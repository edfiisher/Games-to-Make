// Backwards-compatible manual entry point. Merge; never overwrite local questions.
import { syncDaily } from "./sync-daily.js";
import { spawnSync } from "node:child_process";
await syncDaily();
const result = spawnSync(
  process.execPath,
  [new URL("./build-bank.js", import.meta.url).pathname],
  { stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
