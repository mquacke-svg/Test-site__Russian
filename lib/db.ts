import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";
import { databasePath } from "./paths";

export { databasePath } from "./paths";
mkdirSync(dirname(databasePath), { recursive: true });
const globalDb = globalThis as unknown as {
  bakerySqlite?: Database.Database;
  bakeryDbPath?: string;
};
export const sqlite =
  globalDb.bakerySqlite && globalDb.bakeryDbPath === databasePath
    ? globalDb.bakerySqlite
    : new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");
globalDb.bakerySqlite = sqlite;
globalDb.bakeryDbPath = databasePath;
export const db = drizzle(sqlite, { schema });
