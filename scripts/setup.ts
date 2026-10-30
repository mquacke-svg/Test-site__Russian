import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "../lib/db";
import * as s from "../lib/schema";
import { categories, products } from "../data/products";
import { locations } from "../data/locations";

if (!existsSync(".env.local"))
  writeFileSync(
    ".env.local",
    `BETTER_AUTH_URL=http://localhost:3000\nBETTER_AUTH_SECRET=${randomBytes(48).toString("hex")}\nDATABASE_PATH=.local/bakery.sqlite\n`,
    { mode: 0o600 },
  );
migrate(db, { migrationsFolder: "./drizzle" });
db.transaction((tx) => {
  for (const c of categories)
    tx.insert(s.category).values(c).onConflictDoNothing().run();
  for (const p of products) {
    const inserted = tx
      .insert(s.product)
      .values({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        price: p.price === null ? null : Math.round(p.price * 100),
        image: p.image,
        available: true,
        isBestseller: p.isBestseller,
        isSeasonal: !!p.isSeasonal,
      })
      .onConflictDoNothing()
      .returning()
      .all();
    if (inserted.length)
      for (const v of p.variants || [])
        tx.insert(s.variant)
          .values({
            id: `${p.id}-${v.volumeMl}`,
            productId: p.id,
            label: v.label,
            volumeMl: v.volumeMl,
            price: Math.round(v.price * 100),
          })
          .run();
  }
  for (const l of locations)
    tx.insert(s.location)
      .values({
        id: l.id,
        title: l.title,
        address: l.address,
        city: l.city,
        phone: l.phone,
        phoneRaw: l.phoneRaw,
        hours: l.hours,
      })
      .onConflictDoNothing()
      .run();
  tx.insert(s.setting)
    .values({
      id: "delivery",
      value: JSON.stringify({
        fee: 25000,
        freeFrom: 200000,
        minimum: 50000,
        city: "Краснодар",
      }),
    })
    .onConflictDoNothing()
    .run();
});
console.log(
  "База готова. Каталог загружен без перезаписи существующих товаров.",
);
