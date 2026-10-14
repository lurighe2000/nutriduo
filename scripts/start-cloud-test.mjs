import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
// Fresh local SQLite storage for each test run. Never contacts the production vaults.
const child = spawn(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--local",
    "--config",
    "worker/wrangler.test.jsonc",
    "--ip",
    "127.0.0.1",
    "--port",
    "8788",
    "--persist-to",
    `.wrangler/cloud-tests/${randomUUID()}`,
  ],
  {
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  },
);
child.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
