import { cookies, headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { auth } from "./auth";
import { hash, type Identity } from "./shop";
import { ShopError } from "./rules";
export async function identity(): Promise<Identity> {
  const jar = await cookies();
  let token = jar.get("bakery_guest")?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token = randomBytes(32).toString("hex");
    jar.set("bakery_guest", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: (process.env.BETTER_AUTH_URL || "").startsWith("https:"),
      path: "/",
      maxAge: 30 * 86400,
    });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  return {
    guestHash: hash(token),
    userId: session?.user.id,
    role: session?.user.role,
  };
}
export function requireAdmin(person: Identity) {
  if (person.role !== "admin")
    throw new ShopError("Доступ только для администратора", 403);
}
export function checkOrigin(request: Request) {
  const expected = new URL(
    process.env.BETTER_AUTH_URL || "http://localhost:3000",
  ).origin;
  if (request.headers.get("origin") !== expected)
    throw new ShopError("Запрос с другого сайта запрещён", 403);
}
const limits = new Map<string, { count: number; until: number }>();
export function limitOrders(key: string) {
  const now = Date.now();
  for (const [k, v] of limits) if (v.until < now) limits.delete(k);
  const value = limits.get(key) || { count: 0, until: now + 600000 };
  if (++value.count > 15)
    throw new ShopError(
      "Слишком много заказов. Попробуйте через 10 минут.",
      429,
    );
  limits.set(key, value);
}
