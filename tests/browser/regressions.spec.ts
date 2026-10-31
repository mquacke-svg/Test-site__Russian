import { test, expect, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { Product } from "../../lib/types";

test.beforeEach(async ({ context, baseURL }) => {
  test.skip(!process.env.E2E_BASE_URL, "Set E2E_BASE_URL to the isolated test server.");
  await context.addCookies([{ name: "bakery_cookie_notice", value: "1", url: baseURL! }]);
});

async function purchasableProduct(page: Page) {
  const response = await page.request.get("/api/shop/catalog");
  expect(response.ok()).toBe(true);
  const catalog = await response.json() as { products: Product[] };
  const product = catalog.products.find((p) => p.available && p.stock !== 0 && p.price !== null && !p.variants.length);
  expect(product, "Seed must contain a purchasable product without variants").toBeTruthy();
  return product!;
}

function isolatedDatabasePath() {
  const configured = process.env.E2E_DATABASE_PATH;
  test.skip(!configured, "Set E2E_DATABASE_PATH to the isolated server database.");
  const filename = realpathSync(path.resolve(configured!));
  const relative = path.relative(realpathSync(tmpdir()), filename);
  if (
    !relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) ||
    path.basename(filename) !== "bakery.sqlite" ||
    !/^bakery-refactor-e2e-.+/.test(path.basename(path.dirname(filename)))
  ) throw new Error("E2E_DATABASE_PATH must be a bakery-refactor-e2e-*/bakery.sqlite inside os.tmpdir().");
  return filename;
}

function isolatedUploadsPath(databasePath: string) {
  const configured = process.env.E2E_UPLOADS_PATH;
  test.skip(!configured, "Set E2E_UPLOADS_PATH to the isolated server shared-uploads directory.");
  const directory = path.resolve(configured!);
  const expected = path.join(path.dirname(databasePath), "shared-uploads");
  if (directory !== expected || (existsSync(directory) && realpathSync(directory) !== expected))
    throw new Error("E2E_UPLOADS_PATH must be shared-uploads next to the isolated bakery.sqlite.");
  return directory;
}

test("dotted usernames register through the UI", async ({ page }) => {
  const username = `.qa..${Date.now()}`;
  await page.goto("/login");
  await page.getByRole("button", { name: "Нет аккаунта? Зарегистрироваться" }).click();
  await page.getByLabel("Логин", { exact: true }).fill(username);
  await page.getByLabel("Пароль", { exact: true }).fill("dotted-browser-password-123");
  await page.getByRole("button", { name: "Зарегистрироваться", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: `Бонжур, ${username}!` })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: `Бонжур, ${username}!` })).toBeVisible();
});

test("menu search has a visible keyboard focus indicator", async ({ page }) => {
  await page.goto("/menu");
  await page.getByRole("group", { name: "Категории меню" }).getByRole("button").last().focus();
  await page.keyboard.press("Tab");
  const search = page.getByRole("textbox", { name: "Поиск по меню" });
  await expect(search).toBeFocused();
  const focus = await search.evaluate((element) => {
    const style = getComputedStyle(element);
    return { visible: element.matches(":focus-visible"), width: parseFloat(style.outlineWidth), style: style.outlineStyle, color: style.outlineColor };
  });
  expect(focus.visible).toBe(true);
  expect(focus.width).toBeGreaterThanOrEqual(2);
  expect(focus.style).not.toBe("none");
  expect(focus.color).not.toBe("rgba(0, 0, 0, 0)");
});

test("product details keep the failed cart error visible and allow a retry", async ({ page }) => {
  const product = await purchasableProduct(page);
  await page.goto("/menu");
  await expect(page.getByRole("button", { name: /Корзина, товаров: 0/ })).toBeVisible();
  let posts = 0;
  await page.route("**/api/shop/cart", async (route) => {
    if (route.request().method() === "POST" && ++posts === 1)
      await route.fulfill({ status: 503, json: { error: "Регрессионная ошибка корзины" } });
    else await route.continue();
  });
  await page.getByRole("button", { name: `Подробнее: ${product.name}`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: product.name, exact: true });
  await dialog.getByRole("button", { name: /В корзину ·/ }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveText("Регрессионная ошибка корзины");
  await dialog.getByRole("button", { name: /В корзину ·/ }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: /Корзина, товаров: 1/ })).toBeVisible();
  expect(posts).toBe(2);
});

test("quote retry preserves checkout contacts, consent and idempotency key", async ({ page, baseURL }) => {
  const product = await purchasableProduct(page);
  await page.request.get("/api/shop/cart");
  const added = await page.request.post("/api/shop/cart", {
    headers: { origin: new URL(baseURL!).origin },
    data: { action: "add", productId: product.id, quantity: 1 },
  });
  expect(added.ok()).toBe(true);
  let quotes = 0;
  await page.route("**/api/shop/quote", async (route) => {
    if (++quotes === 1) await route.fulfill({ status: 503, json: { error: "Расчёт временно недоступен" } });
    else await route.continue();
  });
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/shop/orders", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 503, json: { error: "Тест останавливает отправку заказа" } });
  });
  await page.goto("/checkout");
  await expect(page.getByRole("alert").filter({ hasText: "Расчёт временно недоступен" })).toBeVisible();
  const key = await page.evaluate(() => sessionStorage.getItem("bakery_checkout_key"));
  expect(key).toBeTruthy();
  await page.getByLabel("Имя", { exact: true }).fill("Проверка повторного расчёта");
  await page.getByLabel("Телефон", { exact: true }).fill("+79180000000");
  await page.getByLabel("Комментарий к заказу", { exact: true }).fill("Не выполнять: проверка интерфейса");
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: /Оформить тестовый заказ/ })).toBeDisabled();
  await page.getByRole("button", { name: "Повторить расчёт заказа" }).click();
  await expect(page.getByRole("button", { name: /Оформить тестовый заказ/ })).toBeEnabled();
  await expect(page.getByLabel("Имя", { exact: true })).toHaveValue("Проверка повторного расчёта");
  await expect(page.getByLabel("Телефон", { exact: true })).toHaveValue("+79180000000");
  await expect(page.getByLabel("Комментарий к заказу", { exact: true })).toHaveValue("Не выполнять: проверка интерфейса");
  await expect(page.getByRole("checkbox")).toBeChecked();
  expect(await page.evaluate(() => sessionStorage.getItem("bakery_checkout_key"))).toBe(key);
  await page.getByRole("button", { name: /Оформить тестовый заказ/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Тест останавливает отправку заказа" })).toBeVisible();
  expect(submitted).toMatchObject({ name: "Проверка повторного расчёта", phone: "+79180000000", consent: true, idempotencyKey: key });
  expect(quotes).toBe(2);
});

test("successful account polling clears a previous orders error", async ({ page }) => {
  await page.clock.install();
  const now = new Date().toISOString();
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: {
    user: { id: "polling-user", name: "Проверка обновления", email: "polling@example.test", emailVerified: false, role: "customer", createdAt: now, updatedAt: now },
    session: { id: "polling-session", token: "polling-token", userId: "polling-user", createdAt: now, updatedAt: now, expiresAt: new Date(Date.now() + 86400000).toISOString() },
  } }));
  let reads = 0;
  await page.route("**/api/shop/orders", (route) => ++reads === 1
    ? route.fulfill({ status: 503, json: { error: "История временно недоступна" } })
    : route.fulfill({ json: [] }));
  await page.goto("/account");
  await expect(page.getByRole("alert").filter({ hasText: "История временно недоступна" })).toBeVisible();
  await page.clock.fastForward(15001);
  await expect.poll(() => reads).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("alert").filter({ hasText: "История временно недоступна" })).toHaveCount(0);
  await expect(page.getByText("Ваша вкусная история ещё впереди.")).toBeVisible();
});

test("admin RSC keeps session read-only, API renews cookies, and saved products survive catalog reload failure", async ({ page, baseURL, playwright }) => {
  const databasePath = isolatedDatabasePath();
  const uploadsPath = isolatedUploadsPath(databasePath);
  const origin = new URL(baseURL!).origin;
  const suffix = randomUUID();
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin },
    data: { name: "Регрессионный администратор", email: `admin-${suffix}@example.test`, password: "isolated-admin-password-123" },
  });
  expect(signup.status()).toBe(200);
  const { user } = await signup.json() as { user: { id: string } };
  const database = new Database(databasePath, { fileMustExist: true });
  database.pragma("busy_timeout = 5000");
  try {
    expect(database.prepare("UPDATE user SET role = 'admin' WHERE id = ?").run(user.id).changes).toBe(1);
    const agedExpiry = Date.now() + 5 * 86400000;
    expect(database.prepare("UPDATE session SET expires_at = ?, updated_at = ? WHERE user_id = ?").run(agedExpiry, Date.now() - 2 * 86400000, user.id).changes).toBe(1);
    const expiry = () => (database.prepare("SELECT expires_at FROM session WHERE user_id = ?").get(user.id) as { expires_at: number }).expires_at;
    const adminPage = await page.request.get("/admin");
    expect(adminPage.status()).toBe(200);
    expect(await adminPage.text()).toContain("Пекарня под контролем");
    expect(expiry()).toBe(agedExpiry);
    const cart = await page.request.get("/api/shop/cart");
    expect(cart.status()).toBe(200);
    expect(expiry()).toBeGreaterThan(agedExpiry + 86400000);
    expect(cart.headersArray().some((header) => header.name.toLowerCase() === "set-cookie" && /session_token=/.test(header.value))).toBe(true);

    const guest = await playwright.request.newContext({ baseURL });
    try {
      expect((await guest.get("/api/shop/admin/orders")).status()).toBe(403);
      expect((await guest.post("/api/shop/cart", { headers: { origin: "https://other.example.test" }, data: { action: "clear" } })).status()).toBe(403);
    } finally { await guest.dispose(); }

    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#aa7755" } }).png().toBuffer();
    const uploaded = await page.request.post("/api/shop/admin/upload", {
      headers: { origin },
      multipart: { file: { name: "regression.png", mimeType: "image/png", buffer: png } },
    });
    expect(uploaded.status()).toBe(200);
    const { url } = await uploaded.json() as { url: string };
    expect(url).toMatch(/^\/uploads\/[a-f0-9-]{36}\.webp$/);
    expect(existsSync(path.join(uploadsPath, path.basename(url)))).toBe(true);
    const image = await page.request.get(url);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/webp");
    expect((await image.body()).subarray(8, 12).toString("ascii")).toBe("WEBP");

    await page.goto("/admin");
    await page.getByRole("button", { name: "Каталог", exact: true }).click();
    let catalogFailures = 0;
    let failNextCatalog = false;
    let retryGate: Promise<void> | undefined;
    let retryStarted: (() => void) | undefined;
    await page.route("**/api/shop/catalog", async (route) => {
      if (failNextCatalog) {
        failNextCatalog = false;
        catalogFailures++;
        await route.fulfill({ status: 503, json: { error: "Проверка сбоя обновления каталога" } });
      } else {
        if (retryGate) {
          const gate = retryGate;
          retryGate = undefined;
          retryStarted?.();
          await gate;
        }
        await route.continue();
      }
    });
    const productId = `regression-${suffix}`;
    for (const editing of [false, true]) {
      const name = `Регрессионный товар ${editing ? "обновлён" : "создан"} ${suffix}`;
      if (editing) await page.locator(".admin-product").filter({ hasText: productId.slice(11) }).getByRole("button", { name: "Редактировать" }).click();
      else await page.getByRole("button", { name: "Добавить товар" }).click();
      const dialog = page.getByRole("dialog", { name: editing ? "Редактировать товар" : "Новый товар", exact: true });
      if (!editing) await dialog.getByLabel("Идентификатор (латиница и дефисы)").fill(productId);
      await dialog.getByLabel("Название", { exact: true }).fill(name);
      await dialog.getByLabel("Цена, ₽ (пусто — цена уточняется)").fill(editing ? "135" : "120");
      failNextCatalog = true;
      const saved = page.waitForResponse((response) => response.url().endsWith("/api/shop/admin/product") && response.request().method() === "POST");
      await dialog.getByRole("button", { name: "Сохранить товар" }).click();
      expect((await saved).status()).toBe(200);
      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "Товар сохранён." })).toBeVisible();
      const reloadError = page.getByRole("alert").filter({ hasText: "Товар сохранён, но не удалось обновить каталог" });
      await expect(reloadError).toBeVisible();
      await expect(page.locator(".admin-product").filter({ hasText: name })).toBeVisible();
      let releaseCatalog: (() => void) | undefined;
      const started = new Promise<void>((resolve) => { retryStarted = resolve; });
      retryGate = new Promise<void>((resolve) => { releaseCatalog = resolve; });
      const reloaded = page.waitForResponse((response) => response.url().endsWith("/api/shop/catalog") && response.request().method() === "GET");
      await page.getByRole("button", { name: "Повторить загрузку каталога" }).click();
      try {
        await started;
        await expect(page.getByRole("button", { name: "Добавить товар" })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Редактировать", exact: true }).first()).toBeDisabled();
        await expect(page.locator(".admin-product button:not(:disabled)")).toHaveCount(0);
      } finally { releaseCatalog?.(); }
      const catalogResponse = await reloaded;
      expect(catalogResponse.status()).toBe(200);
      const catalog = await catalogResponse.json() as { products: Product[] };
      expect(catalog.products.find((product) => product.id === productId)?.name).toBe(name);
      await expect(reloadError).toHaveCount(0);
      await expect(page.locator(".admin-product").filter({ hasText: name })).toBeVisible();
      await expect(page.getByRole("button", { name: "Добавить товар" })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Редактировать", exact: true }).first()).toBeEnabled();
    }
    expect(catalogFailures).toBe(2);
    expect(database.prepare("SELECT name FROM product WHERE id = ?").get(productId)).toMatchObject({ name: `Регрессионный товар обновлён ${suffix}` });
  } finally { database.close(); }
});
