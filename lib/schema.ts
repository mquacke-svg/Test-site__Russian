import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").unique(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  role: text("role").notNull().default("customer"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    uniqueIndex("account_provider_identity").on(t.providerId, t.accountId),
  ],
);
export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
export const category = sqliteTable("category", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  emoji: text("emoji").notNull(),
});
export const product = sqliteTable("product", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category")
    .notNull()
    .references(() => category.id),
  price: integer("price"),
  image: text("image"),
  available: integer("available", { mode: "boolean" }).notNull().default(true),
  stock: integer("stock"),
  isBestseller: integer("is_bestseller", { mode: "boolean" })
    .notNull()
    .default(false),
  isSeasonal: integer("is_seasonal", { mode: "boolean" })
    .notNull()
    .default(false),
});
export const variant = sqliteTable("variant", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => product.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  volumeMl: integer("volume_ml").notNull(),
  price: integer("price").notNull(),
});
export const location = sqliteTable("location", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  phone: text("phone"),
  phoneRaw: text("phone_raw"),
  hours: text("hours").notNull(),
});
export const setting = sqliteTable("setting", {
  id: text("id").primaryKey(),
  value: text("value").notNull(),
});
export const cart = sqliteTable("cart", {
  id: text("id").primaryKey(),
  guestHash: text("guest_hash").unique(),
  userId: text("user_id")
    .unique()
    .references(() => user.id),
  expiresAt: integer("expires_at").notNull(),
});
export const cartItem = sqliteTable(
  "cart_item",
  {
    id: text("id").primaryKey(),
    cartId: text("cart_id")
      .notNull()
      .references(() => cart.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => product.id),
    variantId: text("variant_id").notNull().default(""),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    uniqueIndex("cart_item_identity").on(t.cartId, t.productId, t.variantId),
  ],
);
export const order = sqliteTable("shop_order", {
  id: text("id").primaryKey(),
  number: text("number").notNull().unique(),
  sequence: integer("sequence").unique(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  userId: text("user_id").references(() => user.id),
  guestHash: text("guest_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  fulfillment: text("fulfillment").notNull(),
  address: text("address"),
  locationId: text("location_id"),
  locationLabel: text("location_label"),
  comment: text("comment").notNull(),
  subtotal: integer("subtotal").notNull(),
  delivery: integer("delivery").notNull(),
  total: integer("total").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: integer("created_at").notNull(),
});
export const orderItem = sqliteTable("order_item", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => order.id),
  productId: text("product_id").notNull(),
  name: text("name").notNull(),
  variantLabel: text("variant_label"),
  price: integer("price").notNull(),
  quantity: integer("quantity").notNull(),
  image: text("image"),
  stockTracked: integer("stock_tracked", { mode: "boolean" }).notNull().default(false),
});
export const notification = sqliteTable("notification", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .unique()
    .references(() => order.id),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: integer("next_attempt_at").notNull(),
  sentAt: integer("sent_at"),
  lastError: text("last_error"),
});
