import { resolve } from "node:path";

export const databasePath = resolve(
  /* turbopackIgnore: true */ process.env.DATABASE_PATH || ".local/bakery.sqlite",
);
export const uploadsPath = resolve(
  /* turbopackIgnore: true */ process.env.UPLOADS_PATH || ".local/uploads",
);
