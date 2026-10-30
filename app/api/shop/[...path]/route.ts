import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import {
  checkOrigin,
  identity,
  limitOrders,
  requireAdmin,
} from "@/lib/request-context";
import {
  changeCart,
  claimGuestOrders,
  createOrder,
  getCart,
  getCatalog,
  getSettings,
  listOrders,
  mayReadOrder,
  orderDetails,
  quote,
  resolveCart,
  updateOrderStatus,
} from "@/lib/shop";
import { ShopError } from "@/lib/rules";
import { isMailConfigured } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const cartInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    productId: z.string().min(1),
    variantId: z.string().optional(),
    quantity: z.number().int().min(1).max(99).default(1),
  }),
  z.object({
    action: z.literal("update"),
    itemId: z.string(),
    quantity: z.number().int().min(0).max(99),
  }),
  z.object({ action: z.literal("remove"), itemId: z.string() }),
  z.object({ action: z.literal("clear") }),
]);
const productInput = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(100),
  name: z.string().trim().min(2).max(180),
  description: z.string().max(1500).nullable(),
  category: z.string(),
  price: z.number().int().min(1).max(100000000).nullable(),
  image: z
    .string()
    .regex(/^\/(products|uploads)\/[a-zA-Z0-9._-]+\.(webp|png|jpe?g)$/)
    .nullable(),
  available: z.boolean(),
  stock: z.number().int().min(0).max(1000000).nullable(),
  expectedStock: z.number().int().min(0).max(1000000).nullable().optional(),
  isBestseller: z.boolean(),
  isSeasonal: z.boolean(),
  variants: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]+$/),
        label: z.string().min(1).max(60),
        volumeMl: z.number().int().min(1).max(10000),
        price: z.number().int().min(1).max(100000000),
      }),
    )
    .max(20),
});
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const segments = (await context.params).path;
    const route = segments.join("/");
    const method = request.method;
    if (method !== "GET") checkOrigin(request);
    const json = (value: unknown, status = 200) =>
      Response.json(value, {
        status,
        headers: { "Cache-Control": "no-store" },
      });
    if (route === "catalog" && method === "GET") return json(getCatalog());
    if (route === "config" && method === "GET")
      return json({
        google: !!(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ),
        vk: !!(process.env.VK_CLIENT_ID && process.env.VK_CLIENT_SECRET),
        emailRegistration: isMailConfigured(),
        settings: getSettings(),
      });
    const person = await identity();
    if (route === "order-attempt" && method === "GET") {
      const key = new URL(request.url).searchParams.get("key") || "";
      const prior = db
        .select()
        .from(s.order)
        .where(eq(s.order.idempotencyKey, key))
        .get();
      return json(
        prior && mayReadOrder(prior, person)
          ? orderDetails(prior.id, person)
          : null,
      );
    }
    if (segments[0] === "admin") {
      requireAdmin(person);
      if (route === "admin/orders" && method === "GET")
        return json(listOrders(person, true));
      if (route === "admin/status" && method === "POST") {
        const body = z
          .object({ id: z.string(), status: z.string() })
          .parse(await request.json());
        updateOrderStatus(body.id, body.status);
        return json({ ok: true });
      }
      if (route === "admin/settings" && method === "POST") {
        const v = z
          .object({
            fee: z.number().int().min(0).max(10000000),
            freeFrom: z.number().int().min(0).max(100000000),
            minimum: z.number().int().min(0).max(100000000),
            city: z.string().trim().min(2).max(100),
          })
          .parse(await request.json());
        db.update(s.setting)
          .set({ value: JSON.stringify(v) })
          .where(eq(s.setting.id, "delivery"))
          .run();
        return json(v);
      }
      if (route === "admin/product" && method === "POST") {
        const raw = await request.json();
        const v = productInput.parse(raw);
        if (
          !db
            .select()
            .from(s.category)
            .where(eq(s.category.id, v.category))
            .get()
        )
          throw new ShopError("Категория не найдена");
        if (new Set(v.variants.map((x) => x.id)).size !== v.variants.length)
          throw new ShopError("Варианты должны иметь разные идентификаторы");
        const { variants, expectedStock, ...product } = v;
        db.transaction((tx) => {
          const existing = tx.select().from(s.product).where(eq(s.product.id, v.id)).get();
          if (existing && (expectedStock === undefined || existing.stock !== expectedStock))
            throw new ShopError("Остаток изменился. Обновите страницу и проверьте товар перед сохранением.", 409);
          if (
            raw.creating === true &&
            tx.select().from(s.product).where(eq(s.product.id, v.id)).get()
          )
            throw new ShopError(
              "Товар с таким идентификатором уже существует",
              409,
            );
          for (const variant of variants) {
            const prior = tx
              .select()
              .from(s.variant)
              .where(eq(s.variant.id, variant.id))
              .get();
            if (prior && prior.productId !== v.id)
              throw new ShopError(
                "Идентификатор варианта занят другим товаром",
              );
          }
          tx.insert(s.product)
            .values(product)
            .onConflictDoUpdate({ target: s.product.id, set: product })
            .run();
          tx.delete(s.variant).where(eq(s.variant.productId, v.id)).run();
          for (const variant of variants)
            tx.insert(s.variant)
              .values({ ...variant, productId: v.id })
              .run();
        });
        return json({ ok: true });
      }
      if (route === "admin/upload" && method === "POST") {
        if (
          Number(request.headers.get("content-length") || 0) >
          6 * 1024 * 1024
        )
          throw new ShopError("Файл слишком большой");
        const file = (await request.formData()).get("file");
        if (
          !(file instanceof File) ||
          file.size > 5 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(file.type)
        )
          throw new ShopError("Нужен JPEG, PNG или WebP до 5 МБ");
        const raw = Buffer.from(await file.arrayBuffer());
        let output: Buffer;
        try {
          output = await sharp(raw, { limitInputPixels: 25000000 })
            .rotate()
            .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer();
        } catch {
          throw new ShopError("Не удалось прочитать изображение");
        }
        const filename = `${randomUUID()}.webp`;
        await mkdir(path.resolve(".local/uploads"), { recursive: true });
        await writeFile(path.resolve(".local/uploads", filename), output);
        return json({ url: `/uploads/${filename}` });
      }
      if (route === "admin/integrations" && method === "GET")
        return json({
          telegram: !!(
            process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID
          ),
          notifications: db
            .select({
              id: s.notification.id,
              attempts: s.notification.attempts,
              sentAt: s.notification.sentAt,
              lastError: s.notification.lastError,
            })
            .from(s.notification)
            .all(),
        });
    }
    if (route === "me" && method === "GET")
      return json({ userId: person.userId || null, role: person.role || null });
    if (route === "orders" && method === "GET") return json(listOrders(person));
    if (route === "orders/claim" && method === "POST")
      return json({ count: claimGuestOrders(person) });
    if (segments[0] === "orders" && segments.length === 2 && method === "GET")
      return json(orderDetails(segments[1], person));
    if (route === "cart" || route === "quote" || route === "orders") {
      const cartId = resolveCart(person);
      if (route === "cart" && method === "GET") return json(getCart(cartId));
      if (route === "cart" && method === "POST")
        return json(changeCart(cartId, cartInput.parse(await request.json())));
      if (route === "quote" && method === "POST") {
        const input = z
          .object({ fulfillment: z.enum(["pickup", "delivery"]) })
          .parse(await request.json());
        return json(quote(cartId, input.fulfillment));
      }
      if (route === "orders" && method === "POST") {
        limitOrders(person.userId || person.guestHash);
        return json(createOrder(cartId, person, await request.json()), 201);
      }
    }
    throw new ShopError("Страница не найдена", 404);
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json(
        {
          error: error.issues[0]?.message || "Проверьте поля формы",
          fields: error.flatten(),
        },
        { status: 400 },
      );
    if (error instanceof ShopError)
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    console.error(
      "Shop request failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json(
      { error: "Не удалось выполнить запрос. Попробуйте ещё раз." },
      { status: 500 },
    );
  }
}
export const GET = handle;
export const POST = handle;
