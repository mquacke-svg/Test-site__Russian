import { test, expect } from "@playwright/test";
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
test("keyboard modal behavior, cookie persistence, missing OAuth providers", async ({
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
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Войти через VK ID" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Войти через Google" }),
  ).toBeDisabled();
});
for (const width of [360, 390, 768, 1440])
  test(`responsive ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.getByRole("button", { name: "Понятно", exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
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
