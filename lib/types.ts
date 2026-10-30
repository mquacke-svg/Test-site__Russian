export type Category = {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
};
export type Variant = {
  id: string;
  productId: string;
  label: string;
  volumeMl: number;
  price: number;
};
export type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number | null;
  image: string | null;
  available: boolean;
  stock: number | null;
  isBestseller: boolean;
  isSeasonal: boolean;
  variants: Variant[];
};
export type Location = {
  id: string;
  title: string;
  address: string;
  city: string;
  phone: string | null;
  phoneRaw: string | null;
  hours: string;
};
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
export const money = (kopecks: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: kopecks % 100 ? 2 : 0,
  }).format(kopecks / 100);
