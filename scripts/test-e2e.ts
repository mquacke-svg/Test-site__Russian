import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { setTimeout } from "node:timers/promises";

const folder = mkdtempSync(join(tmpdir(), "bakery-refactor-e2e-"));
const socket = createServer().listen(0, "127.0.0.1");
await once(socket, "listening");
const port = (socket.address() as { port: number }).port;
await new Promise<void>((done) => socket.close(() => done()));
const env = {
  ...process.env,
  DATABASE_PATH: join(folder, "bakery.sqlite"),
  UPLOADS_PATH: join(folder, "shared-uploads"),
  BETTER_AUTH_URL: `http://localhost:${port}`,
  BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
  GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "",
  VK_CLIENT_ID: "", VK_CLIENT_SECRET: "",
  TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_ID: "",
};
let server: ReturnType<typeof spawn> | undefined;
let runner: ReturnType<typeof spawn> | undefined;
let stopped: Promise<unknown> | undefined;
const stop = () => { runner?.kill(); server?.kill(); };
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
try {
  execFileSync(process.execPath, ["--import", "tsx", "scripts/setup.ts"], { env, stdio: "pipe" });
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env, stdio: "inherit" });
  stopped = once(server, "exit");
  const deadline = Date.now() + 30000;
  while (true) {
    if (server.exitCode !== null || Date.now() > deadline) throw new Error("Тестовый сервер не запустился. Сначала выполните npm run build.");
    try {
      if ((await fetch(`${env.BETTER_AUTH_URL}/api/shop/catalog`, { signal: AbortSignal.timeout(1000) })).ok) break;
    } catch {}
    await setTimeout(100);
  }
  runner = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)], {
    env: { ...env, E2E_BASE_URL: env.BETTER_AUTH_URL, E2E_DATABASE_PATH: env.DATABASE_PATH, E2E_UPLOADS_PATH: env.UPLOADS_PATH },
    stdio: "inherit",
  });
  const [code] = await once(runner, "exit");
  process.exitCode = code ?? 1;
} finally {
  stop();
  await stopped;
  if (dirname(resolve(folder)) !== resolve(tmpdir()) || !basename(folder).startsWith("bakery-refactor-e2e-"))
    throw new Error("Unexpected temporary test directory");
  rmSync(folder, { recursive: true, force: true });
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
}
