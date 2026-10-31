import type { category, location, product, variant } from "./schema";

export type Category = typeof category.$inferSelect;
export type Variant = typeof variant.$inferSelect;
export type Product = typeof product.$inferSelect & { variants: Variant[] };
export type Location = typeof location.$inferSelect;
export type DeliverySettings = {
  fee: number;
  freeFrom: number;
  minimum: number;
  city: string;
};
export type CartLine = {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  variantLabel: string | null;
  price: number | null;
  quantity: number;
  image: string | null;
  available: boolean;
  stock: number | null;
};
export type Cart = { items: CartLine[]; count: number; subtotal: number };
export type OrderLine = {
  id: string;
  name: string;
  variantLabel: string | null;
  price: number;
  quantity: number;
  image: string | null;
};
export type Order = {
  id: string;
  number: string;
  sequence: number | null;
  name: string;
  phone: string;
  fulfillment: string;
  address: string | null;
  locationLabel: string | null;
  comment: string;
  subtotal: number;
  delivery: number;
  total: number;
  status: string;
  createdAt: number;
  items: OrderLine[];
};
export const statusLabels: Record<string, string> = {
  pending: "Ожидает подтверждения",
  accepted: "Принят",
  preparing: "Готовится",
  ready: "Готов к выдаче",
  delivering: "Передан курьеру",
  completed: "Завершён",
  cancelled: "Отменён",
};
const wholeRubleFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency", currency: "RUB", maximumFractionDigits: 0,
});
const fractionalRubleFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency", currency: "RUB", maximumFractionDigits: 2,
});
export const money = (kopecks: number) =>
  (kopecks % 100 ? fractionalRubleFormatter : wholeRubleFormatter).format(kopecks / 100);
