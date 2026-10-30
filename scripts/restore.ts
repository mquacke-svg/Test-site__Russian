import { cp, mkdir, rename, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const name = process.argv[2];
if (!name || !/^[0-9TZ-]+$/.test(name))
  throw new Error(
    "Укажите имя папки из .local/backups: npm run restore -- <имя>",
  );
if (!process.argv.includes("--server-stopped"))
  throw new Error(
    "Сначала остановите сервер. Затем добавьте флаг --server-stopped.",
  );
const backups = path.resolve(".local/backups");
const source = path.resolve(backups, name);
if (
  path.dirname(source) !== backups ||
  !existsSync(path.join(source, "bakery.sqlite"))
)
  throw new Error("Резервная копия не найдена");
const check = new Database(path.join(source, "bakery.sqlite"), {
  readonly: true,
});
if (check.pragma("integrity_check", { simple: true }) !== "ok")
  throw new Error("Проверка целостности копии не пройдена");
check.close();
const target = path.resolve(
  process.env.DATABASE_PATH || ".local/bakery.sqlite",
);
const safety = path.join(backups, `before-restore-${Date.now()}`);
await mkdir(safety, { recursive: true });
if (existsSync(target)) {
  const current = new Database(target);
  await current.backup(path.join(safety, "bakery.sqlite"));
  current.pragma("wal_checkpoint(TRUNCATE)");
  current.close();
}
for (const suffix of ["-wal", "-shm"])
  if (existsSync(`${target}${suffix}`))
    await rename(
      `${target}${suffix}`,
      path.join(safety, `bakery.sqlite${suffix}`),
    );
if (existsSync(".local/uploads"))
  await rename(path.resolve(".local/uploads"), path.join(safety, "uploads"));
await copyFile(path.join(source, "bakery.sqlite"), target);
if (existsSync(path.join(source, "uploads")))
  await cp(path.join(source, "uploads"), path.resolve(".local/uploads"), {
    recursive: true,
  });
console.log(
  "База и изображения восстановлены. Предыдущее состояние сохранено:",
  safety,
);
