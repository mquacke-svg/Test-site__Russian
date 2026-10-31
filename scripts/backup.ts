import { mkdir, cp, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { databasePath, uploadsPath } from "../lib/paths";
const folder = path.resolve(
  ".local/backups",
  new Date().toISOString().replace(/[:.]/g, "-"),
);
const relative = path.relative(uploadsPath, folder);
if (relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)))
  throw new Error("Каталог резервной копии не должен находиться внутри каталога изображений.");
await mkdir(folder, { recursive: true });
const sqlite = new Database(databasePath, { readonly: true, fileMustExist: true });
try {
  if (sqlite.pragma("integrity_check", { simple: true }) !== "ok")
    throw new Error("Проверка целостности базы не пройдена");
  await sqlite.backup(path.join(folder, "bakery.sqlite"));
} finally {
  sqlite.close();
}
if (existsSync(uploadsPath))
  await cp(uploadsPath, path.join(folder, "uploads"), { recursive: true });
await writeFile(
  path.join(folder, "manifest.json"),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      database: "bakery.sqlite",
      uploads: "uploads",
      note: "Остановите сервер и обработчик уведомлений перед восстановлением. Секреты .env.local в копию не входят.",
    },
    null,
    2,
  ),
);
console.log(`Резервная копия: ${folder}`);
