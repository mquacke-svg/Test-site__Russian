import { mkdir, cp, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { sqlite } from "../lib/db";
const folder = path.resolve(
  ".local/backups",
  new Date().toISOString().replace(/[:.]/g, "-"),
);
await mkdir(folder, { recursive: true });
await sqlite.backup(path.join(folder, "bakery.sqlite"));
if (existsSync(".local/uploads"))
  await cp(".local/uploads", path.join(folder, "uploads"), { recursive: true });
await writeFile(
  path.join(folder, "manifest.json"),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      database: "bakery.sqlite",
      uploads: "uploads",
      note: "Остановите сервер перед восстановлением. Секреты .env.local в копию не входят.",
    },
    null,
    2,
  ),
);
console.log(`Резервная копия: ${folder}`);
