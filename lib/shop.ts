import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { db } from "./db";
import * as s from "./schema";
import {
  canTransition,
  checkoutSchema,
  deliveryCost,
  ShopError,
} from "./rules";
import type { Cart, DeliverySettings } from "./types";

export type Identity = { guestHash: string; userId?: string; role?: string };
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const id = key(item);
    const group = groups.get(id) || [];
    group.push(item);
    groups.set(id, group);
  }
  return groups;
}
export function getSettings(): DeliverySettings {
  const found = db
    .select()
    .from(s.setting)
    .where(eq(s.setting.id, "delivery"))
    .get();
  if (!found) throw new ShopError("Сначала выполните npm run setup", 503);
  return JSON.parse(found.value);
}
export function getCatalog() {
  const variantsByProduct = groupBy(db.select().from(s.variant).all(), (v) => v.productId);
  return {
    products: db
      .select()
      .from(s.product)
      .all()
      .map((p) => ({
        ...p,
        variants: variantsByProduct.get(p.id) || [],
      })),
    categories: db.select().from(s.category).all(),
    locations: db.select().from(s.location).all(),
    settings: getSettings(),
  };
}
export function resolveCart(identity: Identity) {
  return db.transaction((tx) => {
    const now = Date.now();
    tx.delete(s.cart)
      .where(and(isNull(s.cart.userId), lt(s.cart.expiresAt, now)))
      .run();
    const guest = tx
      .select()
      .from(s.cart)
      .where(eq(s.cart.guestHash, identity.guestHash))
      .get();
    if (!identity.userId) {
      if (!guest) {
        const value = {
          id: randomUUID(),
          guestHash: identity.guestHash,
          expiresAt: now + 30 * 86400000,
        };
        tx.insert(s.cart).values(value).run();
        return value.id;
      }
      return guest.id;
    }
    let owned = tx
      .select()
      .from(s.cart)
      .where(eq(s.cart.userId, identity.userId))
      .get();
    if (!owned)
      owned = tx
        .insert(s.cart)
        .values({
          id: randomUUID(),
          userId: identity.userId,
          expiresAt: now + 30 * 86400000,
        })
        .returning()
        .get();
    if (guest) {
      for (const item of tx
        .select()
        .from(s.cartItem)
        .where(eq(s.cartItem.cartId, guest.id))
        .all()) {
        const existing = tx
          .select()
          .from(s.cartItem)
          .where(
            and(
              eq(s.cartItem.cartId, owned.id),
              eq(s.cartItem.productId, item.productId),
              eq(s.cartItem.variantId, item.variantId),
            ),
          )
          .get();
        if (existing)
          tx.update(s.cartItem)
            .set({ quantity: Math.min(99, existing.quantity + item.quantity) })
            .where(eq(s.cartItem.id, existing.id))
            .run();
        else
          tx.insert(s.cartItem)
            .values({ ...item, id: randomUUID(), cartId: owned.id })
            .run();
      }
      tx.delete(s.cart).where(eq(s.cart.id, guest.id)).run();
    }
    return owned.id;
  });
}
export function getCart(cartId: string): Cart {
  const rows = db
    .select({ item: s.cartItem, product: s.product })
    .from(s.cartItem)
    .innerJoin(s.product, eq(s.product.id, s.cartItem.productId))
    .where(eq(s.cartItem.cartId, cartId))
    .all();
  const variants = rows.length
    ? db.select().from(s.variant).where(inArray(s.variant.productId,
        db.select({ productId: s.cartItem.productId }).from(s.cartItem).where(eq(s.cartItem.cartId, cartId)))).all()
    : [];
  const variantsByProduct = groupBy(variants, (v) => v.productId);
  const items = rows.map(({ item, product: p }) => {
      const productVariants = variantsByProduct.get(p.id) || [];
      const v = productVariants.find((variant) => variant.id === item.variantId);
      const requiresVariant = productVariants.length > 0;
      const price = item.variantId
        ? (v?.price ?? null)
        : requiresVariant
          ? null
          : p.price;
      return {
        id: item.id,
        productId: p.id,
        variantId: item.variantId,
        name: p.name,
        variantLabel: v?.label ?? null,
        price,
        quantity: item.quantity,
        image: p.image,
        available: p.available && price !== null,
        stock: p.stock,
      };
    });
  return {
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    subtotal: items.reduce((n, i) => n + (i.price ?? 0) * i.quantity, 0),
  };
}
export function changeCart(
  cartId: string,
  input: {
    action: string;
    productId?: string;
    variantId?: string;
    quantity?: number;
    itemId?: string;
  },
) {
  return db.transaction((tx) => {
    if (input.action === "clear")
      tx.delete(s.cartItem).where(eq(s.cartItem.cartId, cartId)).run();
    else if (input.action === "remove" || input.action === "update") {
      const condition = and(
        eq(s.cartItem.cartId, cartId),
        eq(s.cartItem.id, input.itemId || ""),
      );
      const item = tx.select().from(s.cartItem).where(condition).get();
      if (!item)
        throw new ShopError("Позиция не найдена", 404);
      if (input.action === "update" && input.quantity! > item.quantity)
        checkCartStock(
          cartId,
          tx.select().from(s.product).where(eq(s.product.id, item.productId)).get(),
          input.quantity! - item.quantity,
        );
      if (input.action === "remove" || input.quantity === 0)
        tx.delete(s.cartItem).where(condition).run();
      else
        tx.update(s.cartItem)
          .set({ quantity: input.quantity! })
          .where(condition)
          .run();
    } else {
      const p = tx
        .select()
        .from(s.product)
        .where(eq(s.product.id, input.productId || ""))
        .get();
      if (!p || !p.available)
        throw new ShopError("Этот товар сейчас недоступен");
      const variants = tx
        .select()
        .from(s.variant)
        .where(eq(s.variant.productId, p.id))
        .all();
      const variantId = input.variantId || "";
      if (
        variants.length
          ? !variants.some((v) => v.id === variantId)
          : variantId !== "" || p.price === null
      )
        throw new ShopError("Выберите доступный вариант товара");
      const existing = tx
        .select()
        .from(s.cartItem)
        .where(
          and(
            eq(s.cartItem.cartId, cartId),
            eq(s.cartItem.productId, p.id),
            eq(s.cartItem.variantId, variantId),
          ),
        )
        .get();
      const quantity = (existing?.quantity || 0) + (input.quantity || 1);
      if (quantity > 99)
        throw new ShopError("Не более 99 единиц одной позиции");
      checkCartStock(cartId, p, input.quantity || 1);
      if (existing)
        tx.update(s.cartItem)
          .set({ quantity })
          .where(eq(s.cartItem.id, existing.id))
          .run();
      else
        tx.insert(s.cartItem)
          .values({
            id: randomUUID(),
            cartId,
            productId: p.id,
            variantId,
            quantity,
          })
          .run();
    }
    return getCart(cartId);
  });
}
function checkCartStock(
  cartId: string,
  p: typeof s.product.$inferSelect | undefined,
  additional: number,
) {
  if (!p || !p.available) throw new ShopError("Этот товар сейчас недоступен", 409);
  const total = db.select().from(s.cartItem).where(and(eq(s.cartItem.cartId, cartId), eq(s.cartItem.productId, p.id))).all()
    .reduce((sum, item) => sum + item.quantity, 0);
  if (p.stock !== null && total + additional > p.stock)
    throw new ShopError(`Недостаточно товара «${p.name}». Уменьшите количество в корзине.`, 409, "OUT_OF_STOCK");
}
export function quote(cartId: string, fulfillment: string) {
  const cart = getCart(cartId);
  if (!cart.items.length)
    throw new ShopError("Корзина пуста", 400, "EMPTY_CART");
  if (cart.items.some((i) => !i.available))
    throw new ShopError(
      "В корзине есть недоступный товар. Удалите его перед оформлением.",
      409,
      "UNAVAILABLE",
    );
  const totals = new Map<string, number>();
  for (const item of cart.items) totals.set(item.productId, (totals.get(item.productId) || 0) + item.quantity);
  for (const item of cart.items) {
    if (item.stock !== null && totals.get(item.productId)! > item.stock)
      throw new ShopError(`Недостаточно товара «${item.name}». Уменьшите количество в корзине.`, 409, "OUT_OF_STOCK");
  }
  const settings = getSettings();
  const delivery = deliveryCost(cart.subtotal, fulfillment, settings);
  const fingerprint = hash(
    JSON.stringify({
      items: cart.items.map((i) => [
        i.productId,
        i.variantId,
        i.name,
        i.variantLabel,
        i.quantity,
        i.price,
      ]),
      fulfillment,
      delivery,
      settings: fulfillment === "delivery" ? settings : null,
    }),
  );
  return {
    ...cart,
    delivery,
    total: cart.subtotal + delivery,
    fingerprint,
    settings,
  };
}
export function mayReadOrder(
  o: typeof s.order.$inferSelect,
  identity: Identity,
) {
  return (
    identity.role === "admin" ||
    (o.userId
      ? o.userId === identity.userId
      : o.guestHash === identity.guestHash)
  );
}
export function orderDetails(id: string, identity: Identity) {
  const found = db.select().from(s.order).where(eq(s.order.id, id)).get();
  if (!found || !mayReadOrder(found, identity))
    throw new ShopError("Заказ не найден", 404);
  const { guestHash: _guest, idempotencyKey: _key, ...safe } = found;
  return {
    ...safe,
    items: db
      .select()
      .from(s.orderItem)
      .where(eq(s.orderItem.orderId, id))
      .all(),
  };
}
export function createOrder(cartId: string, identity: Identity, body: unknown) {
  const input = checkoutSchema.parse(body);
  return db.transaction((tx) => {
    const prior = tx
      .select()
      .from(s.order)
      .where(eq(s.order.idempotencyKey, input.idempotencyKey))
      .get();
    if (prior) {
      if (!mayReadOrder(prior, identity))
        throw new ShopError(
          "Аккаунт изменился. Проверьте заказ и подтвердите его ещё раз.",
          409,
          "ATTEMPT_OWNER_CHANGED",
        );
      return orderDetails(prior.id, identity);
    }
    const current = quote(cartId, input.fulfillment);
    if (current.fingerprint !== input.fingerprint)
      throw new ShopError(
        "Стоимость или состав заказа изменились. Проверьте обновлённую сумму и подтвердите заказ ещё раз.",
        409,
        "PRICE_CHANGED",
      );
    const pickup =
      input.fulfillment === "pickup"
        ? tx
            .select()
            .from(s.location)
            .where(eq(s.location.id, input.locationId!))
            .get()
        : null;
    if (input.fulfillment === "pickup" && !pickup)
      throw new ShopError("Выберите действующую пекарню");
    const id = randomUUID();
    const sequence = tx.select({ next: sql<number>`coalesce(max(${s.order.sequence}), 0) + 1` }).from(s.order).get()!.next;
    tx.insert(s.order)
      .values({
        id,
        number: `JA-${Date.now().toString(36).toUpperCase()}-${id.slice(0, 4).toUpperCase()}`,
        sequence,
        idempotencyKey: input.idempotencyKey,
        userId: identity.userId || null,
        guestHash: identity.guestHash,
        name: input.name,
        phone: `+${input.phone}`,
        fulfillment: input.fulfillment,
        address:
          input.fulfillment === "delivery"
            ? `${current.settings.city}, ${input.address}`
            : null,
        locationId: pickup?.id ?? null,
        locationLabel: pickup ? `${pickup.title}, ${pickup.address}` : null,
        comment: input.comment,
        subtotal: current.subtotal,
        delivery: current.delivery,
        total: current.total,
        status: "pending",
        createdAt: Date.now(),
      })
      .run();
    for (const item of current.items) {
      if (item.stock !== null) {
        const changed = tx.update(s.product)
          .set({ stock: sql`${s.product.stock} - ${item.quantity}` })
          .where(and(eq(s.product.id, item.productId), sql`${s.product.stock} >= ${item.quantity}`)).run();
        if (!changed.changes) throw new ShopError(`Недостаточно товара «${item.name}».`, 409, "OUT_OF_STOCK");
      }
      tx.insert(s.orderItem)
        .values({
          id: randomUUID(),
          orderId: id,
          productId: item.productId,
          name: item.name,
          variantLabel: item.variantLabel,
          price: item.price!,
          quantity: item.quantity,
          image: item.image,
          stockTracked: item.stock !== null,
        })
        .run();
    }
    tx.insert(s.notification)
      .values({ id: randomUUID(), orderId: id, nextAttemptAt: Date.now() })
      .run();
    tx.delete(s.cartItem).where(eq(s.cartItem.cartId, cartId)).run();
    return orderDetails(id, identity);
  });
}
export function listOrders(identity: Identity, admin = false) {
  if (admin && identity.role !== "admin")
    throw new ShopError("Доступ только для администратора", 403);
  const rows = admin
    ? db.select().from(s.order).orderBy(desc(s.order.createdAt)).all()
    : identity.userId
      ? db
          .select()
          .from(s.order)
          .where(eq(s.order.userId, identity.userId))
          .orderBy(desc(s.order.createdAt))
          .all()
      : [];
  const items = rows.length
    ? db.select({ item: s.orderItem }).from(s.orderItem)
        .innerJoin(s.order, eq(s.order.id, s.orderItem.orderId))
        .where(admin ? undefined : eq(s.order.userId, identity.userId!))
        .all().map(({ item }) => item)
    : [];
  const byOrder = groupBy(items, (item) => item.orderId);
  return rows.map(({ guestHash: _guest, idempotencyKey: _key, ...order }) => ({
    ...order,
    items: byOrder.get(order.id) || [],
  }));
}
export function claimGuestOrders(identity: Identity) {
  if (!identity.userId) throw new ShopError("Войдите в аккаунт", 401);
  return db
    .update(s.order)
    .set({ userId: identity.userId })
    .where(
      and(eq(s.order.guestHash, identity.guestHash), isNull(s.order.userId)),
    )
    .run().changes;
}
export function updateOrderStatus(id: string, status: string) {
  return db.transaction((tx) => {
    const o = tx.select().from(s.order).where(eq(s.order.id, id)).get();
    if (!o) throw new ShopError("Заказ не найден", 404);
    if (!canTransition(o.status, status, o.fulfillment))
      throw new ShopError("Этот переход статуса недоступен");
    if (status === "cancelled") {
      for (const item of tx.select().from(s.orderItem).where(eq(s.orderItem.orderId, id)).all()) {
        if (item.stockTracked)
          tx.update(s.product).set({ stock: sql`${s.product.stock} + ${item.quantity}` })
            .where(and(eq(s.product.id, item.productId), sql`${s.product.stock} IS NOT NULL`)).run();
      }
    }
    tx.update(s.order).set({ status }).where(eq(s.order.id, id)).run();
  });
}
