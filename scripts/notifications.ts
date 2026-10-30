import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "../lib/db";
import * as s from "../lib/schema";
import { money } from "../lib/types";
let busy = false;
async function tick() {
  if (busy || !process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID)
    return;
  busy = true;
  try {
    const jobs = db
      .select()
      .from(s.notification)
      .where(
        and(
          isNull(s.notification.sentAt),
          lte(s.notification.nextAttemptAt, Date.now()),
        ),
      )
      .all()
      .slice(0, 10);
    for (const job of jobs) {
      const order = db
        .select()
        .from(s.order)
        .where(eq(s.order.id, job.orderId))
        .get()!;
      const items = db
        .select()
        .from(s.orderItem)
        .where(eq(s.orderItem.orderId, order.id))
        .all();
      const text = [
        `ТЕСТОВЫЙ ЗАКАЗ ${order.sequence === null ? order.number : `№${order.sequence}`}`,
        order.fulfillment === "pickup" ? "Самовывоз" : "Доставка",
        ...items.map(
          (i) =>
            `${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""} × ${i.quantity}`,
        ),
        `Итого: ${money(order.total)}. Оплата при получении.`,
        "Контакты покупателя доступны в админке.",
      ]
        .join("\n")
        .slice(0, 4000);
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: process.env.TELEGRAM_CHAT_ID,
              text,
            }),
            signal: AbortSignal.timeout(15000),
          },
        );
        const result = await response.json();
        if (!response.ok || !result.ok)
          throw new Error(`Telegram HTTP ${response.status}`);
        db.update(s.notification)
          .set({
            sentAt: Date.now(),
            attempts: job.attempts + 1,
            lastError: null,
          })
          .where(eq(s.notification.id, job.id))
          .run();
      } catch {
        db.update(s.notification)
          .set({
            attempts: job.attempts + 1,
            lastError: "Telegram недоступен или настройки неверны",
            nextAttemptAt:
              Date.now() +
              Math.min(3600000, 30000 * 2 ** Math.min(job.attempts, 7)),
          })
          .where(eq(s.notification.id, job.id))
          .run();
      }
    }
  } finally {
    busy = false;
  }
}
console.log(
  process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID
    ? "Telegram worker started"
    : "Telegram не настроен: уведомления сохраняются в очереди.",
);
await tick();
setInterval(() => {
  void tick();
}, 10000);
