import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import * as schema from "../lib/schema";

const sent = vi.hoisted(() => [] as { to: string; url: string }[]);
vi.mock("../lib/mail", () => ({
  isMailConfigured: () => true,
  sendVerificationMail: async (to: string, url: string) => { sent.push({ to, url }); },
}));

const folder = mkdtempSync(join(tmpdir(), "bakery-email-test-"));
let dbModule: typeof import("../lib/db");
let shop: typeof import("../lib/shop");
let auth: (typeof import("../lib/auth"))["auth"];
beforeAll(async () => {
  const database = join(folder, "test.sqlite");
  process.env.DATABASE_PATH = database;
  process.env.BETTER_AUTH_SECRET = randomUUID() + randomUUID();
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  execFileSync(process.execPath, ["--import", "tsx", "scripts/setup.ts"], { env: process.env, stdio: "pipe" });
  dbModule = await import("../lib/db");
  shop = await import("../lib/shop");
  auth = (await import("../lib/auth")).auth;
});
afterAll(() => { dbModule?.sqlite.close(); rmSync(folder, { recursive: true, force: true }); });

describe("Email registration and verification", () => {
  it("blocks unverified login and role injection, then signs in and keeps the guest cart", async () => {
    const email = "customer@example.test", password = "abc12345";
    const headers = new Headers({ origin: "http://localhost:3000" });
    const tooShort = await auth.api.signUpEmail({ body: { name: "Покупатель", email: "short@example.test", password: "abc1234" }, headers, asResponse: true });
    expect(tooShort.status).toBeGreaterThanOrEqual(400);
    expect(sent).toHaveLength(0);
    const guestHash = randomUUID();
    const cart = shop.resolveCart({ guestHash });
    const product = shop.getCatalog().products.find((p) => p.price !== null && p.available && !p.variants.length)!;
    shop.changeCart(cart, { action: "add", productId: product.id, quantity: 2 });
    const signup = await auth.api.signUpEmail({ body: { email, password, name: "Покупатель", role: "admin", callbackURL: "/account" } as never, headers, asResponse: true });
    expect(signup.status).toBe(200);
    expect(signup.headers.getSetCookie().some((cookie) => cookie.includes("session_token"))).toBe(false);
    const customer = dbModule.db.select().from(schema.user).where(eq(schema.user.email, email)).get()!;
    expect(customer.role).toBe("customer");
    expect(customer.emailVerified).toBe(false);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(email);
    const before = await auth.api.signInEmail({ body: { email, password }, headers, asResponse: true });
    expect(before.status).toBe(403);
    const bad = await auth.handler(new Request("http://localhost:3000/api/auth/verify-email?token=invalid"));
    expect(bad.status).toBeGreaterThanOrEqual(400);
    const verified = await auth.handler(new Request(sent[0].url));
    expect(verified.status).toBe(302);
    expect(dbModule.db.select().from(schema.user).where(eq(schema.user.email, email)).get()?.emailVerified).toBe(true);
    expect(verified.headers.getSetCookie().some((cookie) => cookie.includes("session_token"))).toBe(true);
    const login = await auth.api.signInEmail({ body: { email, password }, headers, asResponse: true });
    expect(login.status).toBe(200);
    const customerCart = shop.resolveCart({ guestHash, userId: customer.id });
    expect(shop.getCart(customerCart).items.find((item) => item.productId === product.id)?.quantity).toBe(2);
    expect(shop.resolveCart({ guestHash, userId: customer.id })).toBe(customerCart);
  });
});
