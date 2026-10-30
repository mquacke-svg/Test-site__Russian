import { z } from "zod";
import type { DeliverySettings } from "./types";
export class ShopError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "INVALID_REQUEST",
  ) {
    super(message);
  }
}
export const checkoutSchema = z
  .object({
    name: z.string().trim().min(2, "Укажите имя").max(100),
    phone: z
      .string()
      .transform((s) => s.replace(/\D/g, "").replace(/^8(?=\d{10}$)/, "7"))
      .pipe(
        z
          .string()
          .regex(/^7\d{10}$/, "Укажите российский телефон: +7 и 10 цифр"),
      ),
    fulfillment: z.enum(["pickup", "delivery"]),
    locationId: z.string().max(100).optional(),
    address: z.string().trim().max(400).optional(),
    comment: z.string().trim().max(1000).default(""),
    consent: z.literal(true, { error: "Подтвердите ознакомление с условиями" }),
    fingerprint: z.string().length(64),
    idempotencyKey: z.string().uuid(),
  })
  .superRefine((v, c) => {
    if (v.fulfillment === "delivery" && (!v.address || v.address.length < 8))
      c.addIssue({
        code: "custom",
        path: ["address"],
        message: "Укажите улицу, дом и квартиру",
      });
    if (v.fulfillment === "pickup" && !v.locationId)
      c.addIssue({
        code: "custom",
        path: ["locationId"],
        message: "Выберите пекарню",
      });
  });
export function deliveryCost(
  subtotal: number,
  fulfillment: string,
  settings: DeliverySettings,
) {
  if (fulfillment === "pickup") return 0;
  if (fulfillment !== "delivery")
    throw new ShopError("Выберите способ получения");
  if (subtotal < settings.minimum)
    throw new ShopError(
      `Минимальная сумма доставки — ${settings.minimum / 100} ₽`,
      400,
      "MINIMUM_ORDER",
    );
  return subtotal >= settings.freeFrom ? 0 : settings.fee;
}
export function canTransition(from: string, to: string, fulfillment: string) {
  const next: Record<string, string[]> = {
    pending: ["accepted", "cancelled"],
    accepted: ["preparing", "cancelled"],
    preparing: [fulfillment === "pickup" ? "ready" : "delivering", "cancelled"],
    ready: ["completed", "cancelled"],
    delivering: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };
  return next[from]?.includes(to) ?? false;
}
