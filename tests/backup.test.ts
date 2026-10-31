import { afterEach, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { restoreBackup } from "../scripts/restore";

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, rename: vi.fn(original.rename) };
});
const realFs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
const folders: string[] = [];
const loader = pathToFileURL(resolve("node_modules/tsx/dist/loader.mjs")).href;
function writeDatabase(file: string, value: string) {
  mkdirSync(dirname(file), { recursive: true });
  const database = new Database(file);
  try {
    database.exec("CREATE TABLE IF NOT EXISTS marker (value TEXT); DELETE FROM marker");
    database.prepare("INSERT INTO marker VALUES (?)").run(value);
  } finally {
    database.close();
  }
}
function readDatabase(file: string) {
  const database = new Database(file, { readonly: true, fileMustExist: true });
  try {
    expect(database.pragma("integrity_check", { simple: true })).toBe("ok");
    return (database.prepare("SELECT value FROM marker").get() as { value: string }).value;
  } finally {
    database.close();
  }
}
function fixture(externalUploads = false) {
  const folder = mkdtempSync(join(tmpdir(), "bakery-backup-test-"));
  folders.push(folder);
  const options = {
    serverStopped: true,
    backupsPath: join(folder, ".local", "backups"),
    databasePath: join(folder, ".local", "bakery.sqlite"),
    uploadsPath: join(folder, externalUploads ? "external-images" : ".local/uploads"),
  };
  mkdirSync(options.uploadsPath, { recursive: true });
  writeDatabase(options.databasePath, "original");
  writeFileSync(join(options.uploadsPath, "test.txt"), "original");
  const env = { ...process.env, DATABASE_PATH: options.databasePath, UPLOADS_PATH: options.uploadsPath };
  const run = (script: string, ...args: string[]) => execFileSync(
    process.execPath, ["--import", loader, resolve(`scripts/${script}.ts`), ...args],
    { cwd: folder, env, stdio: "pipe" },
  );
  run("backup");
  const snapshot = readdirSync(options.backupsPath)[0];
  const modify = () => {
    writeDatabase(options.databasePath, "modified");
    writeFileSync(join(options.uploadsPath, "test.txt"), "modified");
  };
  return { folder, options, snapshot, run, modify };
}
afterEach(() => {
  vi.mocked(rename).mockImplementation(realFs.rename);
  for (const folder of folders.splice(0)) {
    if (!resolve(folder).startsWith(`${resolve(tmpdir())}${sep}`) || !basename(folder).startsWith("bakery-backup-test-"))
      throw new Error("Unexpected temporary directory");
    rmSync(folder, { recursive: true, force: true });
  }
});

it("backs up and restores database and uploads, then restores the safety snapshot", async () => {
  const { options, snapshot, modify } = fixture();
  modify();
  const safety = await restoreBackup(snapshot, options);
  expect(readDatabase(options.databasePath)).toBe("original");
  expect(readFileSync(join(options.uploadsPath, "test.txt"), "utf8")).toBe("original");
  expect(readDatabase(join(safety, "bakery.sqlite"))).toBe("modified");
  expect(readFileSync(join(safety, "uploads", "test.txt"), "utf8")).toBe("modified");
  await restoreBackup(basename(safety), options);
  expect(readDatabase(options.databasePath)).toBe("modified");
  expect(readFileSync(join(options.uploadsPath, "test.txt"), "utf8")).toBe("modified");
});
it("uses external UPLOADS_PATH in the backup and restore CLI", () => {
  const { options, snapshot, run, modify } = fixture(true);
  modify();
  run("restore", snapshot, "--server-stopped");
  expect(readDatabase(options.databasePath)).toBe("original");
  expect(readFileSync(join(options.uploadsPath, "test.txt"), "utf8")).toBe("original");
});
it("prepares a missing database parent before replacing active images", async () => {
  const { folder, options, snapshot, modify } = fixture();
  modify();
  const target = join(folder, "new-storage", "nested", "bakery.sqlite");
  const safety = await restoreBackup(snapshot, { ...options, databasePath: target });
  expect(readDatabase(target)).toBe("original");
  expect(readFileSync(join(options.uploadsPath, "test.txt"), "utf8")).toBe("original");
  expect(readFileSync(join(safety, "uploads", "test.txt"), "utf8")).toBe("modified");
});
it("restores the absence of uploads while preserving the previous images in the safety copy", async () => {
  const { options, snapshot, modify } = fixture();
  const snapshotUploads = join(options.backupsPath, snapshot, "uploads");
  rmSync(snapshotUploads, { recursive: true });
  modify();
  const safety = await restoreBackup(snapshot, options);
  expect(readDatabase(options.databasePath)).toBe("original");
  expect(existsSync(options.uploadsPath)).toBe(false);
  expect(readFileSync(join(safety, "uploads", "test.txt"), "utf8")).toBe("modified");
});
it("rolls both resources back, including committed WAL data, if image activation fails after the database swap", async () => {
  const { folder, options, snapshot, modify } = fixture();
  modify();
  const current = new Database(options.databasePath);
  let walFiles: { file: string; bytes: Buffer }[] = [];
  try {
    current.pragma("journal_mode = WAL");
    current.pragma("wal_autocheckpoint = 0");
    current.prepare("UPDATE marker SET value = ?").run("latest-in-wal");
    walFiles = ["", "-wal", "-shm"].map((suffix) => ({
      file: `${options.databasePath}${suffix}`,
      bytes: readFileSync(`${options.databasePath}${suffix}`),
    }));
  } finally {
    current.close();
  }
  for (const { file, bytes } of walFiles) writeFileSync(file, bytes);
  const mainOnly = join(folder, "main-before-wal.sqlite");
  writeFileSync(mainOnly, walFiles[0].bytes);
  expect(readDatabase(mainOnly)).toBe("modified");
  let injected = false;
  vi.mocked(rename).mockImplementation(async (from, to) => {
    if (String(to) === options.uploadsPath && basename(String(from)) === "next") {
      expect(readDatabase(options.databasePath)).toBe("original");
      expect(existsSync(options.uploadsPath)).toBe(false);
      injected = true;
      throw new Error("Injected image activation failure");
    }
    return realFs.rename(from, to);
  });
  await expect(restoreBackup(snapshot, options)).rejects.toThrow("Injected image activation failure");
  expect(injected).toBe(true);
  expect(readDatabase(options.databasePath)).toBe("latest-in-wal");
  expect(readFileSync(join(options.uploadsPath, "test.txt"), "utf8")).toBe("modified");
  const safety = readdirSync(options.backupsPath).find((name) => name.startsWith("before-restore-"))!;
  expect(readDatabase(join(options.backupsPath, safety, "bakery.sqlite"))).toBe("latest-in-wal");
  expect(readdirSync(join(folder, ".local")).filter((name) => name.startsWith(".bakery-restore-"))).toEqual([]);
});
it("keeps staging and safety data if rollback itself fails", async () => {
  const { folder, options, snapshot, modify } = fixture();
  modify();
  vi.mocked(rename).mockImplementation(async (from, to) => {
    if (String(to) === options.uploadsPath) throw new Error("Injected activation and rollback failure");
    return realFs.rename(from, to);
  });
  await expect(restoreBackup(snapshot, options)).rejects.toThrow("Откат завершён не полностью");
  expect(readDatabase(options.databasePath)).toBe("modified");
  const stage = readdirSync(join(folder, ".local")).find((name) => name.startsWith(".bakery-restore-uploads-"))!;
  expect(readFileSync(join(folder, ".local", stage, "old", "test.txt"), "utf8")).toBe("modified");
  const safety = readdirSync(options.backupsPath).find((name) => name.startsWith("before-restore-"))!;
  expect(readDatabase(join(options.backupsPath, safety, "bakery.sqlite"))).toBe("modified");
});
it("rejects traversal, overlapping paths, a missing stop flag and a corrupt snapshot before swapping", async () => {
  const { folder, options, snapshot, modify } = fixture();
  modify();
  await expect(restoreBackup("../bakery.sqlite", options)).rejects.toThrow("Укажите имя");
  await expect(restoreBackup(snapshot, { ...options, serverStopped: false })).rejects.toThrow("--server-stopped");
  await expect(restoreBackup(snapshot, { ...options, uploadsPath: folder })).rejects.toThrow("не должны совпадать");
  await expect(restoreBackup(snapshot, { ...options, databasePath: join(options.uploadsPath, "database.sqlite") })).rejects.toThrow("не должны совпадать");
  writeFileSync(join(options.backupsPath, snapshot, "bakery.sqlite"), "invalid database");
  await expect(restoreBackup(snapshot, options)).rejects.toThrow();
  expect(readDatabase(options.databasePath)).toBe("modified");
  expect(readFileSync(join(options.uploadsPath, "test.txt"), "utf8")).toBe("modified");
});
