import { test, expect, type Page } from "@playwright/test";

async function loadImages(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  for (const image of await page.locator("img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}
test("username registration needs no email, preserves sessions and supports signing in again", async ({ page }) => {
  const username = `qa_${Date.now()}`;
  const password = "browser-test-password-123";
  await page.goto("/login");
  await page.getByRole("button", { name: "Понятно", exact: true }).click();
  await page.getByRole("button", { name: "Нет аккаунта? Зарегистрироваться" }).click();
  await expect(page.getByRole("textbox", { name: "Логин", exact: true })).toBeVisible();
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Зарегистрироваться", exact: true })).toBeEnabled();
  await page.getByLabel("Логин", { exact: true }).fill(username);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Зарегистрироваться", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: `Бонжур, ${username}!` })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: `Бонжур, ${username}!` })).toBeVisible();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/login");
  await page.getByLabel("Логин или email", { exact: true }).fill(username.toUpperCase());
  await page.getByLabel("Пароль", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Неверный логин или пароль." })).toBeVisible();
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
});
test("catalog URL and history restore filters and search", async ({ page }) => {
  await page.goto("/menu");
  await page.getByRole("button", { name: "Кофе", exact: true }).click();
  await expect(page).toHaveURL(/\/menu#coffee$/);
  await page.reload();
  await expect(page.getByRole("button", { name: "Кофе", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("textbox", { name: "Поиск по меню" }).fill("Американо");
  await expect(page.getByRole("button", { name: "Подробнее: Американо" })).toBeVisible();
  await page.getByRole("button", { name: "Всё меню", exact: true }).click();
  await expect(page).toHaveURL(/\/menu$/);
  await page.goBack();
  await expect(page.getByRole("button", { name: "Кофе", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/menu#unknown");
  await expect(page.getByRole("button", { name: "Всё меню", exact: true })).toHaveAttribute("aria-pressed", "true");
});
test("cart requests are serialized and recover from errors", async ({ page }) => {
  let pendingReads = 0;
  let parallel = false;
  let posts = 0;
  let releaseRead: (() => void) | undefined;
  let signalRead: (() => void) | undefined;
  const readStarted = new Promise<void>((resolve) => { signalRead = resolve; });
  const release = new Promise<void>((resolve) => { releaseRead = resolve; });
  const initialCart = page.waitForResponse((response) => response.url().endsWith("/api/shop/cart") && response.request().method() === "GET");
  await page.goto("/menu");
  await initialCart;
  await page.getByRole("button", { name: "Понятно", exact: true }).click();
  const catalog = await (await page.request.get("/api/shop/catalog")).json();
  const product = catalog.products.find((p: { available: boolean; stock: number | null; price: number | null; variants: unknown[] }) => p.available && p.stock !== 0 && p.price !== null && !p.variants.length);
  await expect(page.getByRole("button", { name: /Корзина, товаров: 0/ })).toBeVisible();
  await page.route("**/api/shop/cart", async (route) => {
    if (route.request().method() === "GET") {
      pendingReads++;
      signalRead?.();
      await release;
      const response = await route.fetch();
      pendingReads--;
      await route.fulfill({ response });
    } else {
      if (pendingReads) parallel = true;
      posts++;
      if (posts === 1) await route.fulfill({ status: 500, contentType: "text/html", body: "error" });
      else await route.continue();
    }
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const timeout = setTimeout(() => releaseRead?.(), 5000);
  await readStarted;
  const add = page.getByRole("button", { name: `Добавить в корзину: ${product.name}`, exact: true });
  await add.click();
  expect(posts).toBe(0);
  releaseRead?.();
  clearTimeout(timeout);
  await expect(page.getByRole("alert").filter({ hasText: "Сервер вернул некорректный ответ" })).toBeVisible();
  await add.click();
  await expect(page.getByRole("button", { name: /Корзина, товаров: 1/ })).toBeVisible();
  expect(parallel).toBe(false);
  await page.reload();
  await expect(page.getByRole("button", { name: /Корзина, товаров: 1/ })).toBeVisible();
});
test("checkout waits for the cart and recovers a previous order", async ({ page }) => {
  let cartLoaded = false;
  let releaseAttempt: (() => void) | undefined;
  let attemptStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => { attemptStarted = resolve; });
  const release = new Promise<void>((resolve) => { releaseAttempt = resolve; });
  await page.route("**/api/shop/cart", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response });
    cartLoaded = true;
  });
  await page.route("**/api/shop/order-attempt?*", async (route) => {
    expect(cartLoaded).toBe(true);
    attemptStarted?.();
    await release;
    await route.fulfill({ json: { id: "previous-order" } });
  });
  const timeout = setTimeout(() => releaseAttempt?.(), 5000);
  await page.goto("/checkout");
  await started;
  await expect(page.getByText("Проверяем предыдущую попытку заказа…")).toBeVisible();
  await expect(page.getByRole("button", { name: /Оформить тестовый заказ/ })).toHaveCount(0);
  releaseAttempt?.();
  clearTimeout(timeout);
  await expect(page).toHaveURL(/\/orders\/previous-order$/);
});
test("mobile navigation closes after following a link and product images load", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Понятно", exact: true }).click();
  const toggle = page.getByRole("button", { name: /Открыть меню|Закрыть меню/ });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("navigation", { name: "Мобильная навигация" }).getByRole("link", { name: "Наше меню" }).click();
  await expect(page).toHaveURL(/\/menu$/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  const image = page.locator(".product-card img").first();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.locator(".product-detail")).toHaveCount(0);
});
test("home, catalog, variants, cart and guest checkout", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Маленькие радости/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Понятно", exact: true }).click();
  await page.getByRole("link", { name: "Выбрать что-то вкусное" }).click();
  await page.getByRole("textbox", { name: "Поиск по меню" }).fill("Американо");
  await page
    .getByRole("button", { name: "Добавить в корзину: Американо", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/350 мл/).check();
  await dialog.getByRole("button", { name: /В корзину ·/ }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Добавить в корзину: Американо", exact: true })
    .click();
  await dialog.getByLabel(/250 мл/).check();
  await dialog.getByRole("button", { name: /В корзину ·/ }).click();
  await page.getByRole("button", { name: /Корзина, товаров: 2/ }).click();
  await expect(page.getByRole("dialog")).toContainText("350 мл");
  await expect(page.getByRole("dialog")).toContainText("250 мл");
  await page.getByRole("button", { name: "Закрыть окно" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Корзина, товаров: 2/ }),
  ).toBeVisible();
  await page.goto("/cart");
  const remove = page.getByRole("button", { name: /^Удалить: Американо,/ });
  await remove.last().click();
  await expect(
    page.getByRole("button", { name: /Корзина, товаров: 1/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /К оформлению/ }).click();
  await page.getByLabel("Доставка", { exact: false }).check();
  await expect(page.getByRole("alert").filter({ hasText: "Минимальная сумма доставки" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Оформить тестовый заказ/ })).toBeDisabled();
  await page.getByLabel("Самовывоз", { exact: false }).check();
  await page.getByLabel("Имя", { exact: true }).fill("Тестовый покупатель");
  await page.getByLabel("Телефон", { exact: true }).fill("+79180000000");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Оформить тестовый заказ/ }).click();
  await expect(page).toHaveURL(/\/orders\//);
  await expect(
    page.getByRole("heading", { name: "Спасибо за ваш выбор!" }),
  ).toBeVisible();
  await expect(
    page.getByText("Ожидает подтверждения", { exact: true }),
  ).toBeVisible();
});
test("keyboard modal behavior, cookie persistence, OAuth configuration", async ({
  page,
}) => {
  await page.goto("/menu");
  await page.getByRole("button", { name: "Понятно", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Понятно", exact: true }),
  ).toHaveCount(0);
  const trigger = page.getByRole("button", { name: /Подробнее:/ }).first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("dialog").getByRole("button", { name: /В корзину ·/ }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Закрыть окно" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(trigger).toBeFocused();
  const config = await (await page.request.get("/api/shop/config")).json();
  await page.goto("/login");
  for (const [provider, label] of [["vk", "VK ID"], ["google", "Google"]]) {
    const button = page.getByRole("button", { name: new RegExp(`Войти через ${label}`) });
    if (config[provider]) await expect(button).toBeEnabled();
    else await expect(button).toHaveCount(0);
  }
});
for (const width of [360, 390, 768, 1440])
  test(`responsive ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.getByRole("button", { name: "Понятно", exact: true }).click();
    await loadImages(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/home-${width}.png`,
      fullPage: true,
    });
    await page.goto("/menu");
    await loadImages(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/menu-${width}.png`,
      fullPage: true,
    });
  });
