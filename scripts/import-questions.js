// Backwards-compatible manual entry point. Merge; never overwrite local questions.
import { syncRecorded } from "./sync-recorded.js";
import { spawnSync } from "node:child_process";
await syncRecorded();
const result = spawnSync(
  process.execPath,
  [new URL("./build-bank.js", import.meta.url).pathname],
  { stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
