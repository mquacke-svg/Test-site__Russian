import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { verifyPassword } from "better-auth/crypto";
import * as schema from "../lib/schema";
import { usernameEmail } from "../lib/auth-client";

const folder = mkdtempSync(join(tmpdir(), "bakery-login-test-"));
let dbModule: typeof import("../lib/db");
let shop: typeof import("../lib/shop");
let auth: (typeof import("../lib/auth"))["auth"];
beforeAll(async () => {
  process.env.DATABASE_PATH = join(folder, "test.sqlite");
  process.env.BETTER_AUTH_SECRET = randomUUID() + randomUUID();
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  execFileSync(process.execPath, ["--import", "tsx", "scripts/setup.ts"], { env: process.env, stdio: "pipe" });
  dbModule = await import("../lib/db");
  shop = await import("../lib/shop");
  auth = (await import("../lib/auth")).auth;
});
afterAll(() => { dbModule?.sqlite.close(); rmSync(folder, { recursive: true, force: true }); });
const headers = new Headers({ origin: "http://localhost:3000" });

describe("Username and legacy password accounts", () => {
  it("preserves existing username accounts, signs in immediately and persists a password hash", async () => {
    const password = "test-password-123";
    const signup = await auth.api.signUpEmail({ body: { name: "Customer", username: "Customer.One", email: "customer.one@login.bakery.invalid", password, role: "admin" } as never, headers, asResponse: true });
    expect(signup.status).toBe(200);
    const cookie = signup.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session?.user.username).toBe("customer.one");
    expect(session?.user.role).toBe("customer");
    const customer = dbModule.db.select().from(schema.user).where(eq(schema.user.username, "customer.one")).get()!;
    expect(customer.emailVerified).toBe(false);
    const credential = dbModule.db.select().from(schema.account).where(eq(schema.account.userId, customer.id)).get()!;
    expect(credential.password).not.toBe(password);
    expect(await verifyPassword({ hash: credential.password!, password })).toBe(true);
    await auth.api.signOut({ headers: new Headers({ origin: "http://localhost:3000", cookie }) });
    const freshLogin = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `import { auth } from './lib/auth.ts'; const response = await auth.api.signInUsername({ body: { username: 'CUSTOMER.ONE', password: 'test-password-123' }, headers: new Headers({origin: 'http://localhost:3000'}), asResponse: true }); if (response.status !== 200) process.exit(1); console.log(response.status);`], { env: process.env, encoding: "utf8" });
    expect(freshLogin.trim()).toBe("200");
    const guestHash = randomUUID();
    const cart = shop.resolveCart({ guestHash });
    const product = shop.getCatalog().products.find((p) => p.price !== null && p.available && !p.variants.length)!;
    shop.changeCart(cart, { action: "add", productId: product.id, quantity: 2 });
    const owned = shop.resolveCart({ guestHash, userId: customer.id });
    expect(shop.getCart(owned).count).toBe(2);
    expect(shop.resolveCart({ guestHash, userId: customer.id })).toBe(owned);
  });
  it.each([".foo", "foo.", "foo..bar", "..."])("registers and signs in the allowed username %s", async (username) => {
    const password = "dotted-password-123";
    const email = usernameEmail(username.toUpperCase());
    expect(email).toBe(`${Buffer.from(username, "ascii").toString("hex")}@username.bakery.invalid`);
    const signup = await auth.api.signUpEmail({ body: { name: username, username, email, password }, headers, asResponse: true });
    expect(signup.status).toBe(200);
    const cookie = signup.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session?.user.username).toBe(username);
    const login = await auth.api.signInUsername({ body: { username: username.toUpperCase(), password }, headers, asResponse: true });
    expect(login.status).toBe(200);
  });
  it("rejects duplicate logins, invalid usernames and wrong passwords", async () => {
    const signup = (username: string, email: string) => auth.handler(new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ name: username, username, email, password: "test-password-123" }),
    }));
    expect((await signup("CUSTOMER.ONE", "duplicate@example.test")).status).toBeGreaterThanOrEqual(400);
    expect((await signup("ab", "short@example.test")).status).toBeGreaterThanOrEqual(400);
    expect((await signup("bad login", "invalid@example.test")).status).toBeGreaterThanOrEqual(400);
    const wrong = await auth.api.signInUsername({ body: { username: "customer.one", password: "wrong-password" }, headers, asResponse: true });
    expect(wrong.status).toBe(401);
  });
  it("allows legacy email accounts to sign in without verification and removes OTP endpoints", async () => {
    const result = await auth.api.signUpEmail({ body: { name: "Legacy", email: "legacy@example.test", password: "legacy-password-123" }, headers, asResponse: true });
    expect(result.status).toBe(200);
    const login = await auth.api.signInEmail({ body: { email: "legacy@example.test", password: "legacy-password-123" }, headers, asResponse: true });
    expect(login.status).toBe(200);
    const otp = await auth.handler(new Request("http://localhost:3000/api/auth/email-otp/send-verification-otp", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ email: "legacy@example.test", type: "email-verification" }) }));
    expect(otp.status).toBe(404);
  });
});
