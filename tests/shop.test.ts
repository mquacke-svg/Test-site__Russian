import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq, inArray } from "drizzle-orm";
import {
  deliveryCost,
  checkoutSchema,
  canTransition,
  ShopError,
} from "../lib/rules";
import * as s from "../lib/schema";

const settings = {
  fee: 25000,
  freeFrom: 200000,
  minimum: 50000,
  city: "Краснодар",
};
describe("Delivery boundary conditions", () => {
  it("rejects 499 rubles, accepts 500", () => {
    expect(() => deliveryCost(49900, "delivery", settings)).toThrow(ShopError);
    expect(deliveryCost(50000, "delivery", settings)).toBe(25000);
  });
  it("charges at 1999, free at 2000", () => {
    expect(deliveryCost(199900, "delivery", settings)).toBe(25000);
    expect(deliveryCost(200000, "delivery", settings)).toBe(0);
  });
  it("pickup has no minimum and no fee", () => {
    expect(deliveryCost(100, "pickup", settings)).toBe(0);
  });
});
describe("Validation and transitions", () => {
  const input = {
    name: "Тест",
    phone: "8 (918) 123-45-67",
    fulfillment: "pickup",
    locationId: "one",
    consent: true,
    fingerprint: "a".repeat(64),
    idempotencyKey: randomUUID(),
  };
  it("normalizes a Russian phone and rejects invalid contacts", () => {
    expect(checkoutSchema.parse(input).phone).toBe("79181234567");
    expect(checkoutSchema.safeParse({ ...input, phone: "123" }).success).toBe(
      false,
    );
    expect(checkoutSchema.safeParse({ ...input, consent: false }).success).toBe(
      false,
    );
  });
  it("requires address for delivery and pickup point for pickup", () => {
    expect(
      checkoutSchema.safeParse({ ...input, fulfillment: "delivery" }).success,
    ).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...input, locationId: undefined }).success,
    ).toBe(false);
  });
  it("rejects skipped, terminal and wrong-fulfillment status changes", () => {
    expect(canTransition("pending", "completed", "pickup")).toBe(false);
    expect(canTransition("preparing", "ready", "pickup")).toBe(true);
    expect(canTransition("preparing", "ready", "delivery")).toBe(false);
    expect(canTransition("completed", "cancelled", "pickup")).toBe(false);
  });
});
let shop: typeof import("../lib/shop");
let dbModule: typeof import("../lib/db");
const folder = mkdtempSync(join(tmpdir(), "bakery-test-"));
const database = join(folder, "test.sqlite");
beforeAll(async () => {
  process.env.DATABASE_PATH = database;
  process.env.BETTER_AUTH_SECRET = randomUUID() + randomUUID();
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  execFileSync(process.execPath, ["--import", "tsx", "scripts/setup.ts"], {
    env: { ...process.env, DATABASE_PATH: database },
    stdio: "pipe",
  });
  dbModule = await import("../lib/db");
  shop = await import("../lib/shop");
});
afterAll(() => {
  dbModule?.sqlite.close();
  rmSync(folder, { recursive: true, force: true });
});
const person = () => ({ guestHash: randomUUID() });
function addPastry() {
  const identity = person();
  const cartId = shop.resolveCart(identity);
  const p = shop
    .getCatalog()
    .products.find(
      (p) => p.price !== null && p.available && !p.variants.length,
    )!;
  shop.changeCart(cartId, { action: "add", productId: p.id, quantity: 2 });
  return { identity, cartId, p };
}
function body(cartId: string) {
  return {
    name: "Тестовый покупатель",
    phone: "+79181234567",
    fulfillment: "pickup",
    locationId: shop.getCatalog().locations[0].id,
    consent: true,
    fingerprint: shop.quote(cartId, "pickup").fingerprint,
    idempotencyKey: randomUUID(),
  };
}
describe("Persistent commerce integration", () => {
  it("assigns consecutive order numbers and preserves them on retry", () => {
    const a = addPastry(), b = addPastry();
    const payload = body(a.cartId);
    const first = shop.createOrder(a.cartId, a.identity, payload);
    expect(shop.createOrder(a.cartId, a.identity, payload).sequence).toBe(first.sequence);
    const second = shop.createOrder(b.cartId, b.identity, body(b.cartId));
    expect(second.sequence).toBe(first.sequence! + 1);
  });
  it("checks shared stock across variants, deducts once and restores on cancellation", () => {
    const p = shop.getCatalog().products.find((x) => x.variants.length > 1)!;
    const identity = person(), cartId = shop.resolveCart(identity);
    dbModule.db.update(s.product).set({ stock: 3 }).where(eq(s.product.id, p.id)).run();
    try {
      shop.changeCart(cartId, { action: "add", productId: p.id, variantId: p.variants[0].id, quantity: 2 });
      expect(() => shop.changeCart(cartId, { action: "add", productId: p.id, variantId: p.variants[1].id, quantity: 2 })).toThrow(/Недостаточно/);
      shop.changeCart(cartId, { action: "add", productId: p.id, variantId: p.variants[1].id, quantity: 1 });
      const payload = body(cartId);
      const order = shop.createOrder(cartId, identity, payload);
      expect(shop.createOrder(cartId, identity, payload).id).toBe(order.id);
      expect(dbModule.db.select().from(s.product).where(eq(s.product.id, p.id)).get()?.stock).toBe(0);
      shop.updateOrderStatus(order.id, "cancelled");
      expect(dbModule.db.select().from(s.product).where(eq(s.product.id, p.id)).get()?.stock).toBe(3);
      expect(() => shop.updateOrderStatus(order.id, "cancelled")).toThrow();
    } finally {
      dbModule.db.update(s.product).set({ stock: null }).where(eq(s.product.id, p.id)).run();
    }
  });
  it("rejects checkout when another order consumes the stock without clearing the cart", () => {
    const a = addPastry(), b = addPastry();
    dbModule.db.update(s.product).set({ stock: 2 }).where(eq(s.product.id, a.p.id)).run();
    try {
      const first = body(a.cartId), second = body(b.cartId);
      shop.createOrder(a.cartId, a.identity, first);
      expect(() => shop.createOrder(b.cartId, b.identity, second)).toThrow(/Недостаточно/);
      expect(shop.getCart(b.cartId).count).toBe(2);
    } finally {
      dbModule.db.update(s.product).set({ stock: null }).where(eq(s.product.id, a.p.id)).run();
    }
  });
  it("keeps guest carts isolated and persists identity lookup", () => {
    const { identity, cartId } = addPastry();
    expect(shop.resolveCart(identity)).toBe(cartId);
    expect(shop.getCart(cartId).count).toBe(2);
    expect(shop.getCart(shop.resolveCart(person())).count).toBe(0);
  });
  it("cleans all expired guest carts and their items without changing user carts, orders or stock", () => {
    const expired = addPastry(), abandoned = addPastry(), active = addPastry();
    const userId = randomUUID(), now = new Date();
    dbModule.db.insert(s.user).values({
      id: userId,
      name: "Cart retention test",
      email: `${userId}@example.test`,
      createdAt: now,
      updatedAt: now,
    }).run();
    const identified = { ...person(), userId };
    const ownedId = shop.resolveCart(identified);
    shop.changeCart(ownedId, { action: "add", productId: expired.p.id, quantity: 1 });
    dbModule.db.update(s.product).set({ stock: 10 }).where(eq(s.product.id, expired.p.id)).run();
    try {
      const order = shop.createOrder(expired.cartId, expired.identity, body(expired.cartId));
      shop.changeCart(expired.cartId, { action: "add", productId: expired.p.id, quantity: 1 });
      const expiredIds = [expired.cartId, abandoned.cartId];
      dbModule.db.update(s.cart).set({ expiresAt: 0 })
        .where(inArray(s.cart.id, [...expiredIds, ownedId])).run();
      const ownedBefore = dbModule.db.select().from(s.cart).where(eq(s.cart.id, ownedId)).get();
      const ownedItemsBefore = shop.getCart(ownedId);
      const activeBefore = shop.getCart(active.cartId);
      const ordersBefore = dbModule.db.select().from(s.order).all();
      const orderItemsBefore = dbModule.db.select().from(s.orderItem).all();
      const stockBefore = dbModule.db.select().from(s.product).where(eq(s.product.id, expired.p.id)).get()?.stock;

      shop.resolveCart(person());

      expect(dbModule.db.select().from(s.cart).where(inArray(s.cart.id, expiredIds)).all()).toEqual([]);
      expect(dbModule.db.select().from(s.cartItem).where(inArray(s.cartItem.cartId, expiredIds)).all()).toEqual([]);
      expect(dbModule.db.select().from(s.cart).where(eq(s.cart.id, ownedId)).get()).toEqual(ownedBefore);
      expect(shop.getCart(ownedId)).toEqual(ownedItemsBefore);
      expect(shop.resolveCart(identified)).toBe(ownedId);
      expect(shop.resolveCart(active.identity)).toBe(active.cartId);
      expect(shop.getCart(active.cartId)).toEqual(activeBefore);
      expect(dbModule.db.select().from(s.order).all()).toEqual(ordersBefore);
      expect(dbModule.db.select().from(s.orderItem).all()).toEqual(orderItemsBefore);
      expect(shop.orderDetails(order.id, expired.identity)).toEqual(order);
      expect(dbModule.db.select().from(s.product).where(eq(s.product.id, expired.p.id)).get()?.stock).toBe(stockBefore);
      expect(shop.resolveCart(expired.identity)).not.toBe(expired.cartId);
    } finally {
      dbModule.db.update(s.product).set({ stock: expired.p.stock }).where(eq(s.product.id, expired.p.id)).run();
    }
  });
  it("keeps beverage variants separate and rejects unknown variants", () => {
    const id = shop.resolveCart(person());
    const p = shop.getCatalog().products.find((p) => p.variants.length >= 2)!;
    for (const v of p.variants.slice(0, 2))
      shop.changeCart(id, {
        action: "add",
        productId: p.id,
        variantId: v.id,
        quantity: 1,
      });
    expect(shop.getCart(id).items).toHaveLength(2);
    expect(() =>
      shop.changeCart(id, { action: "add", productId: p.id, variantId: "bad" }),
    ).toThrow();
  });
  it("removes zero quantity and supports clear", () => {
    const { cartId } = addPastry();
    shop.changeCart(cartId, {
      action: "update",
      itemId: shop.getCart(cartId).items[0].id,
      quantity: 0,
    });
    expect(shop.getCart(cartId).count).toBe(0);
    const other = addPastry();
    shop.changeCart(other.cartId, { action: "clear" });
    expect(shop.getCart(other.cartId).items).toHaveLength(0);
  });
  it("blocks empty carts and items without a price", () => {
    expect(() => shop.quote(shop.resolveCart(person()), "pickup")).toThrow();
    const p = shop
      .getCatalog()
      .products.find((p) => p.price === null && !p.variants.length)!;
    expect(() =>
      shop.changeCart(shop.resolveCart(person()), {
        action: "add",
        productId: p.id,
      }),
    ).toThrow();
  });
  it("requires reconfirmation when price changes", () => {
    const { identity, cartId, p } = addPastry();
    const payload = body(cartId);
    dbModule.db
      .update(s.product)
      .set({ price: p.price! + 100 })
      .where(eq(s.product.id, p.id))
      .run();
    expect(() => shop.createOrder(cartId, identity, payload)).toThrow(
      /Стоимость/,
    );
    dbModule.db
      .update(s.product)
      .set({ price: p.price })
      .where(eq(s.product.id, p.id))
      .run();
  });
  it("requires reconfirmation when a variant label or delivery city changes", () => {
    const identity = person(),
      cartId = shop.resolveCart(identity),
      p = shop.getCatalog().products.find((p) => p.variants.length > 1)!,
      variant = p.variants[0];
    shop.changeCart(cartId, {
      action: "add",
      productId: p.id,
      variantId: variant.id,
      quantity: 5,
    });
    const before = shop.quote(cartId, "delivery");
    dbModule.db
      .update(s.variant)
      .set({ label: "999 мл" })
      .where(eq(s.variant.id, variant.id))
      .run();
    expect(shop.quote(cartId, "delivery").fingerprint).not.toBe(
      before.fingerprint,
    );
    dbModule.db
      .update(s.variant)
      .set({ label: variant.label })
      .where(eq(s.variant.id, variant.id))
      .run();
    dbModule.db
      .update(s.setting)
      .set({ value: JSON.stringify({ ...settings, city: "Другой город" }) })
      .where(eq(s.setting.id, "delivery"))
      .run();
    expect(shop.quote(cartId, "delivery").fingerprint).not.toBe(
      before.fingerprint,
    );
    dbModule.db
      .update(s.setting)
      .set({ value: JSON.stringify(settings) })
      .where(eq(s.setting.id, "delivery"))
      .run();
  });
  it("reports an explicit conflict when another owner reuses an order attempt", () => {
    const a = addPastry(),
      payload = body(a.cartId);
    shop.createOrder(a.cartId, a.identity, payload);
    const b = addPastry();
    try {
      shop.createOrder(b.cartId, b.identity, {
        ...body(b.cartId),
        idempotencyKey: payload.idempotencyKey,
      });
      throw new Error("Expected conflict");
    } catch (e) {
      expect((e as ShopError).code).toBe("ATTEMPT_OWNER_CHANGED");
    }
  });
  it("rejects a product disabled after adding", () => {
    const { cartId, p } = addPastry();
    dbModule.db
      .update(s.product)
      .set({ available: false })
      .where(eq(s.product.id, p.id))
      .run();
    expect(() => shop.quote(cartId, "pickup")).toThrow(/недоступный/);
    dbModule.db
      .update(s.product)
      .set({ available: true })
      .where(eq(s.product.id, p.id))
      .run();
  });
  it("marks removed and newly required variants unavailable in the cart", () => {
    const { cartId, p } = addPastry();
    const variant = { id: `test-${randomUUID()}`, productId: p.id, label: "Тест", volumeMl: 250, price: 10000 };
    dbModule.db.insert(s.variant).values(variant).run();
    expect(shop.getCart(cartId).items[0].available).toBe(false);
    shop.changeCart(cartId, { action: "add", productId: p.id, variantId: variant.id, quantity: 1 });
    dbModule.db.delete(s.variant).where(eq(s.variant.id, variant.id)).run();
    const removed = shop.getCart(cartId).items.find((item) => item.variantId === variant.id)!;
    expect(removed.available).toBe(false);
    expect(removed.price).toBeNull();
  });
  it("is idempotent, preserves price snapshots, queues notifications and denies other guests", () => {
    const { identity, cartId, p } = addPastry();
    const payload = body(cartId);
    const first = shop.createOrder(cartId, identity, payload);
    const second = shop.createOrder(cartId, identity, payload);
    expect(second.id).toBe(first.id);
    expect(shop.getCart(cartId).count).toBe(0);
    expect(
      dbModule.db
        .select()
        .from(s.notification)
        .where(eq(s.notification.orderId, first.id))
        .all(),
    ).toHaveLength(1);
    expect(() => shop.orderDetails(first.id, person())).toThrow(/не найден/);
    dbModule.db
      .update(s.product)
      .set({ price: p.price! + 100 })
      .where(eq(s.product.id, p.id))
      .run();
    expect(shop.orderDetails(first.id, identity).items[0].price).toBe(p.price);
    dbModule.db
      .update(s.product)
      .set({ price: p.price })
      .where(eq(s.product.id, p.id))
      .run();
  });
  it("merges guest carts only once and claims only owned guest orders", () => {
    const a = addPastry();
    const payload = body(a.cartId);
    const order = shop.createOrder(a.cartId, a.identity, payload);
    shop.changeCart(a.cartId, {
      action: "add",
      productId: a.p.id,
      quantity: 1,
    });
    const id = randomUUID(),
      now = new Date();
    dbModule.db
      .insert(s.user)
      .values({
        id,
        name: "Test",
        email: `${id}@example.test`,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    const identified = { ...a.identity, userId: id };
    const cart = shop.resolveCart(identified);
    expect(shop.getCart(cart).count).toBe(1);
    expect(shop.resolveCart(identified)).toBe(cart);
    expect(shop.getCart(cart).count).toBe(1);
    expect(shop.claimGuestOrders(identified)).toBe(1);
    expect(shop.claimGuestOrders(identified)).toBe(0);
    expect(() => shop.orderDetails(order.id, a.identity)).toThrow();
    expect(shop.orderDetails(order.id, identified).id).toBe(order.id);
    const ownOrders = shop.listOrders(identified);
    expect(ownOrders.map((o) => o.id)).toEqual([order.id]);
    expect(ownOrders[0].items).toHaveLength(1);
    expect(ownOrders[0].total).toBe(order.total);
    expect(ownOrders[0]).not.toHaveProperty("guestHash");
    expect(ownOrders[0]).not.toHaveProperty("idempotencyKey");
    expect(() => shop.listOrders(identified, true)).toThrow(/администратора/);
    expect(shop.listOrders({ ...identified, userId: randomUUID() })).toEqual([]);
  });
  it("seed reruns preserve administrative changes", () => {
    const p = shop.getCatalog().products[0];
    dbModule.db
      .update(s.product)
      .set({ name: "Сохранённое изменение" })
      .where(eq(s.product.id, p.id))
      .run();
    execFileSync(process.execPath, ["--import", "tsx", "scripts/setup.ts"], {
      env: { ...process.env, DATABASE_PATH: database },
      stdio: "pipe",
    });
    expect(
      dbModule.db.select().from(s.product).where(eq(s.product.id, p.id)).get()
        ?.name,
    ).toBe("Сохранённое изменение");
  });
});
describe("Real local authentication and authorization", () => {
  it("accepts an existing administrator password shorter than the signup policy", async () => {
    const { auth } = await import("../lib/auth");
    const id = randomUUID(), now = new Date(), password = "short";
    dbModule.db.insert(s.user).values({ id, name: "Admin alias test", email: "admin@bakery.invalid", role: "admin", emailVerified: true, createdAt: now, updatedAt: now }).run();
    dbModule.db.insert(s.account).values({ id: randomUUID(), userId: id, accountId: id, providerId: "credential", password: await hashPassword(password), createdAt: now, updatedAt: now }).run();
    const response = await auth.api.signInEmail({ body: { email: "admin@bakery.invalid", password }, headers: new Headers({ origin: "http://localhost:3000" }), asResponse: true });
    expect(response.status).toBe(200);
  });
  it("signs in a created administrator with database sessions and revokes logout", async () => {
    const { auth } = await import("../lib/auth");
    const id = randomUUID(),
      now = new Date(),
      password = randomUUID();
    dbModule.db
      .insert(s.user)
      .values({
        id,
        name: "Admin test",
        email: "admin@test.example",
        role: "admin",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    dbModule.db
      .insert(s.account)
      .values({
        id: randomUUID(),
        userId: id,
        accountId: id,
        providerId: "credential",
        password: await hashPassword(password),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    const response = await auth.api.signInEmail({
      body: { email: "admin@test.example", password },
      headers: new Headers({ origin: "http://localhost:3000" }),
      asResponse: true,
    });
    expect(response.status).toBe(200);
    const cookie = response.headers
      .getSetCookie()
      .map((x) => x.split(";")[0])
      .join("; ");
    expect(cookie).toContain("session_token");
    expect(
      response.headers.getSetCookie().some((x) => /httponly/i.test(x)),
    ).toBe(true);
    const headers = new Headers({ cookie, origin: "http://localhost:3000" });
    const logged = await auth.api.getSession({ headers });
    expect(logged?.user.role).toBe("admin");
    await auth.api.signOut({ headers });
    expect(await auth.api.getSession({ headers })).toBeNull();
  });
  it("allows public password sign-up without granting injected roles", async () => {
    const { auth } = await import("../lib/auth");
    const result = await auth.api.signUpEmail({
      body: {
        name: "Intruder",
        email: "intruder@test.example",
        password: randomUUID(),
        role: "admin",
      } as never,
      asResponse: true,
      headers: new Headers({ origin: "http://localhost:3000" }),
    });
    expect(result.status).toBe(200);
    expect(
      dbModule.db
        .select()
        .from(s.user)
        .where(eq(s.user.email, "intruder@test.example"))
        .get()?.role,
    ).toBe("customer");
  });
});
