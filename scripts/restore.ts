import { cp, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";
import { databasePath, uploadsPath } from "../lib/paths";

type RestoreOptions = {
  serverStopped: boolean;
  backupsPath?: string;
  databasePath?: string;
  uploadsPath?: string;
};
function contains(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}
export async function restoreBackup(name: string, options: RestoreOptions) {
  if (!/^(?:\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z|before-restore-\d+)$/.test(name))
    throw new Error("Укажите имя папки из .local/backups: npm run restore -- <имя>");
  if (!options.serverStopped)
    throw new Error("Сначала остановите сервер и обработчик уведомлений. Затем добавьте флаг --server-stopped.");
  const backups = path.resolve(options.backupsPath || ".local/backups");
  const target = path.resolve(options.databasePath || databasePath);
  const uploads = path.resolve(options.uploadsPath || uploadsPath);
  const source = path.join(backups, name);
  const resources = [target, uploads, backups];
  for (let i = 0; i < resources.length; i++)
    for (let j = i + 1; j < resources.length; j++)
      if (contains(resources[i], resources[j]) || contains(resources[j], resources[i]))
        throw new Error("Пути базы, изображений и резервных копий не должны совпадать или содержать друг друга.");
  if (!existsSync(path.join(source, "bakery.sqlite")))
    throw new Error("Резервная копия не найдена");

  const staging: string[] = [];
  const moves: { from: string; to: string }[] = [];
  let keepStaging = false;
  let safety = "";
  const move = async (from: string, to: string) => {
    await rename(from, to);
    moves.push({ from, to });
  };
  try {
    await mkdir(path.dirname(target), { recursive: true });
    await mkdir(path.dirname(uploads), { recursive: true });
    const dbStage = await mkdtemp(path.join(path.dirname(target), ".bakery-restore-db-"));
    staging.push(dbStage);
    const uploadsStage = await mkdtemp(path.join(path.dirname(uploads), ".bakery-restore-uploads-"));
    staging.push(uploadsStage);
    const nextDatabase = path.join(dbStage, "next.sqlite");
    const nextUploads = path.join(uploadsStage, "next");
    const check = new Database(path.join(source, "bakery.sqlite"), { readonly: true, fileMustExist: true });
    try {
      if (check.pragma("integrity_check", { simple: true }) !== "ok")
        throw new Error("Проверка целостности копии не пройдена");
      await check.backup(nextDatabase);
    } finally {
      check.close();
    }
    if (existsSync(path.join(source, "uploads")))
      await cp(path.join(source, "uploads"), nextUploads, { recursive: true });

    let stamp = Date.now();
    while (existsSync(path.join(backups, `before-restore-${stamp}`))) stamp++;
    safety = path.join(backups, `before-restore-${stamp}`);
    await mkdir(safety);
    if (existsSync(target)) {
      const current = new Database(target, { readonly: true, fileMustExist: true });
      try {
        await current.backup(path.join(safety, "bakery.sqlite"));
      } finally {
        current.close();
      }
    }
    if (existsSync(uploads))
      await cp(uploads, path.join(safety, "uploads"), { recursive: true });

    for (const suffix of ["", "-wal", "-shm"])
      if (existsSync(`${target}${suffix}`))
        await move(`${target}${suffix}`, path.join(dbStage, `old.sqlite${suffix}`));
    await move(nextDatabase, target);
    if (existsSync(uploads)) await move(uploads, path.join(uploadsStage, "old"));
    if (existsSync(nextUploads)) await move(nextUploads, uploads);
    return safety;
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const { from, to } of moves.reverse()) {
      try {
        await rename(to, from);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) {
      keepStaging = true;
      throw new AggregateError([error, ...rollbackErrors], `Откат завершён не полностью. Сохранены резервные данные: ${[safety, ...staging].filter(Boolean).join(", ")}`);
    }
    throw error;
  } finally {
    if (!keepStaging)
      for (const folder of staging) await rm(folder, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const safety = await restoreBackup(process.argv[2] || "", {
    serverStopped: process.argv.includes("--server-stopped"),
  });
  console.log("База и изображения восстановлены. Предыдущее состояние сохранено:", safety);
}
