import { expect, it } from "vitest";
import Database from "better-sqlite3";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
it("backs up and restores database and uploads while preserving the previous state", () => {
  const folder = mkdtempSync(join(tmpdir(), "bakery-backup-test-"));
  const local = join(folder, ".local");
  mkdirSync(join(local, "uploads"), { recursive: true });
  const target = join(local, "bakery.sqlite");
  let database = new Database(target);
  database.exec(
    "CREATE TABLE marker (value TEXT); INSERT INTO marker VALUES ('original')",
  );
  database.close();
  writeFileSync(join(local, "uploads", "test.txt"), "original");
  const loader = pathToFileURL(
    resolve("node_modules/tsx/dist/loader.mjs"),
  ).href;
  const env = { ...process.env, DATABASE_PATH: target };
  try {
    execFileSync(
      process.execPath,
      ["--import", loader, resolve("scripts/backup.ts")],
      { cwd: folder, env, stdio: "pipe" },
    );
    const snapshot = readdirSync(join(local, "backups"))[0];
    database = new Database(target);
    database.exec("UPDATE marker SET value='modified'");
    database.close();
    writeFileSync(join(local, "uploads", "test.txt"), "modified");
    execFileSync(
      process.execPath,
      [
        "--import",
        loader,
        resolve("scripts/restore.ts"),
        snapshot,
        "--server-stopped",
      ],
      { cwd: folder, env, stdio: "pipe" },
    );
    database = new Database(target);
    expect(database.prepare("SELECT value FROM marker").get()).toEqual({
      value: "original",
    });
    database.close();
    expect(readFileSync(join(local, "uploads", "test.txt"), "utf8")).toBe(
      "original",
    );
    const previous = readdirSync(join(local, "backups")).find((x) =>
      x.startsWith("before-restore-"),
    );
    expect(previous).toBeTruthy();
    expect(
      readFileSync(
        join(local, "backups", previous!, "uploads", "test.txt"),
        "utf8",
      ),
    ).toBe("modified");
  } finally {
    if (database.open) database.close();
    if (
      !resolve(folder).startsWith(resolve(tmpdir())) ||
      !folder.includes("bakery-backup-test-")
    )
      throw new Error("Unexpected temporary directory");
    rmSync(folder, { recursive: true, force: true });
  }
});
