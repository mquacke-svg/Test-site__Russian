import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: process.env.DATABASE_PATH || ".local/bakery.sqlite" },
});
