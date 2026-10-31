// Repeatable browser checks against an isolated SQLite snapshot. Never targets the live site.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const php = process.env.PHP_BINARY || 'C:/Users/warfe/.codex/tools/php83/php.exe';
const baseURL = 'http://127.0.0.1:3084';
const results = path.join(root, '.local/e2e-results');
const adminPassword = crypto.randomBytes(24).toString('hex');
const login = 'e2e.' + crypto.randomBytes(5).toString('hex');
const password = 'я'; // One-character password in the isolated test database.
let server, browser, activePage, serverLog = '', passed = 0;
const browserErrors = [];

function fixture(command, data = {}) {
    return JSON.parse(execFileSync(php, [path.join(__dirname, 'e2e-fixture.php'), command], {
        cwd: root, input: JSON.stringify(data), encoding: 'utf8', windowsHide: true,
    }));
}
async function check(name, work) {
    await work();
    passed++;
    console.log('PASS ' + name);
}
async function context(options = {}) {
    const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, ...options });
    const page = await ctx.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => browserErrors.push(error.message));
    activePage = page;
    await page.goto('/');
    const notice = page.getByRole('button', { name: 'Понятно', exact: true });
    if (await notice.count()) await navigate(page, () => notice.click());
    return { ctx, page };
}
async function navigate(page, action) {
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), action()]);
}
async function addPastry(page, quantity = 1) {
    await page.goto('/menu');
    if (quantity === 1) await navigate(page, () => page.getByRole('button', { name: 'Добавить в корзину: Проверочный круассан', exact: true }).click());
    else {
        await page.getByRole('button', { name: 'Подробнее: Проверочный круассан', exact: true }).click();
        const modal = page.getByRole('dialog');
        await modal.locator('[name="quantity"]').fill(String(quantity));
        await navigate(page, () => modal.getByRole('button', { name: /В корзину/ }).click());
    }
}
async function signIn(page, value = login, secret = password, admin = false) {
    await page.goto(admin ? '/login?admin=1' : '/login');
    await page.locator('[name="login"]').fill(value);
    await page.locator('[name="password"]').fill(secret);
    await navigate(page, () => page.getByRole('button', { name: admin ? 'Войти в админку' : 'Войти', exact: true }).click());
}
async function contact(page) {
    await page.locator('[name="name"]').fill('Тестовый покупатель');
    await page.locator('[name="phone"]').fill('8 (918) 123-45-67');
    await page.locator('[name="comment"]').fill('Проверка сохранения формы');
    await page.locator('[name="consent"]').check();
}
async function formData(page, selector = '[data-checkout-form]') {
    return page.locator(selector).evaluate(form => Object.fromEntries(new FormData(form)));
}
async function waitReady() {
    for (let attempt = 0; attempt < 80; attempt++) {
        if (server.exitCode !== null) throw new Error('PHP test server exited: ' + serverLog);
        const status = await new Promise(resolve => {
            const request = http.get(baseURL, { headers: { Connection: 'close' } }, response => {
                response.resume(); response.on('end', () => resolve(response.statusCode));
            });
            request.on('error', () => resolve(0));
        });
        if (status === 200) return;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('PHP test server did not become ready: ' + serverLog);
}
async function portFree() {
    await new Promise((resolve, reject) => {
        const socket = net.createServer();
        socket.once('error', () => reject(new Error('Port 3084 is occupied; stop the previous test server.')));
        socket.listen(3084, '127.0.0.1', () => socket.close(resolve));
    });
}

(async () => {
    await portFree();
    const seeded = fixture('init', { adminPassword });
    server = spawn(php, ['-S', '127.0.0.1:3084', '-t', 'public', 'router.php'], {
        cwd: root, windowsHide: true,
        env: { ...process.env, APP_URL: baseURL, DATABASE_PATH: seeded.database,
            UPLOADS_PATH: path.join(root, '.local/e2e-uploads'), SESSION_PATH: path.join(root, '.local/e2e-sessions') },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', bytes => { serverLog += bytes; });
    server.stderr.on('data', bytes => { serverLog += bytes; });
    await waitReady();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    let priceOrderId;

    await check('responsive home/catalog, images, cookies, filters and mobile navigation', async () => {
        const { ctx, page } = await context();
        await page.reload();
        await expect(page.getByRole('button', { name: 'Понятно', exact: true })).toHaveCount(0);
        for (const width of [360, 390, 768, 1440]) {
            await page.setViewportSize({ width, height: 1000 });
            for (const route of ['/', '/menu']) {
                await page.goto(route);
                await page.locator('img').evaluateAll(images => images.forEach(image => { image.loading = 'eager'; }));
                await page.waitForFunction(() => [...document.images].every(image => image.complete));
                const broken = await page.locator('img').evaluateAll(images => images.filter(image => !image.naturalWidth).map(image => new URL(image.src).pathname));
                assert.deepEqual(broken, [], 'broken images');
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'horizontal overflow ' + route + ' ' + width);
                if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(results, `${route === '/' ? 'home' : 'menu'}-${width}.png`), fullPage: true });
            }
        }
        await page.getByRole('button', { name: 'Проверка', exact: true }).click();
        await expect(page).toHaveURL(/#e2e-category$/);
        await expect(page.locator('.product-entry:visible')).toHaveCount(2);
        await page.locator('[data-catalog-search]').fill('кофе');
        await expect(page.locator('.product-entry:visible')).toHaveCount(1);
        await page.locator('[data-clear-search]').click();
        await page.getByRole('button', { name: 'Всё меню', exact: true }).click();
        await page.goBack();
        await expect(page.getByRole('button', { name: 'Проверка', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await page.setViewportSize({ width: 390, height: 900 });
        await page.goto('/');
        await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Закрыть меню', exact: true })).toHaveAttribute('aria-expanded', 'true');
        await navigate(page, () => page.getByRole('navigation', { name: 'Мобильная навигация' }).getByRole('link', { name: 'Наше меню' }).click());
        await expect(page.getByRole('navigation', { name: 'Мобильная навигация' })).toBeHidden();
        await ctx.close();
    });

    await check('keyboard product dialog, variant selection and cart quantity controls', async () => {
        const { ctx, page } = await context();
        await page.goto('/menu#e2e-category');
        const trigger = page.getByRole('button', { name: 'Подробнее: Проверочный кофе', exact: true });
        await trigger.focus(); await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await trigger.click();
        const dialog = page.getByRole('dialog');
        await dialog.locator('[value="e2e-large"]').check();
        await dialog.locator('[name="quantity"]').fill('2');
        await navigate(page, () => dialog.getByRole('button', { name: /В корзину/ }).click());
        await expect(page).toHaveURL(/\/menu#e2e-category$/);
        await page.goto('/cart');
        await expect(page.locator('.cart-line')).toHaveCount(1);
        await expect(page.locator('.cart-line')).toContainText('400 мл');
        await expect(page.locator('.cart-count')).toHaveText('2');
        await navigate(page, () => page.getByRole('button', { name: /Увеличить количество: Проверочный кофе/ }).click());
        await expect(page.locator('.cart-count')).toHaveText('3');
        await navigate(page, () => page.getByRole('button', { name: /Удалить: Проверочный кофе/ }).click());
        await expect(page.locator('.cart-line')).toHaveCount(0);
        await ctx.close();
    });

    await check('one-character password registration, sessions, logout/login and one-time cart merge', async () => {
        const { ctx, page } = await context();
        await addPastry(page);
        await page.goto('/login?register=1');
        for (const width of [390, 1440]) {
            await page.setViewportSize({ width, height: 1000 });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'registration overflow');
            await page.screenshot({ path: path.join(results, `register-${width}.png`), fullPage: true });
        }
        await page.locator('[name="login"]').fill(login);
        await page.locator('[name="password"]').fill(password);
        await navigate(page, () => page.getByRole('button', { name: 'Зарегистрироваться', exact: true }).click());
        await expect(page).toHaveURL(/\/account$/);
        await expect(page.locator('.cart-count')).toHaveText('1');
        await page.reload(); await expect(page.locator('h1')).toContainText(login);
        await navigate(page, () => page.getByRole('button', { name: 'Выйти', exact: true }).click());
        await addPastry(page, 2);
        await signIn(page, login.toUpperCase());
        await expect(page).toHaveURL(/\/account$/);
        await expect(page.locator('.cart-count')).toHaveText('3');
        await page.reload(); await expect(page.locator('.cart-count')).toHaveText('3');
        const denied = await page.goto('/admin'); assert.equal(denied.status(), 403);
        await page.goto('/account');
        await navigate(page, () => page.getByRole('button', { name: 'Выйти', exact: true }).click());
        await signIn(page, login, 'definitely-wrong-password');
        await expect(page.getByRole('alert')).toBeVisible();
        await signIn(page); await expect(page).toHaveURL(/\/account$/);
        const sessionCookie = (await ctx.cookies()).find(cookie => cookie.name === 'bakery_session');
        assert.equal(sessionCookie.httpOnly, true); assert.equal(sessionCookie.sameSite, 'Lax');
        await ctx.close();
    });

    await check('price conflict preserves contacts/consent and retry creates exactly one order', async () => {
        const { ctx, page } = await context();
        await addPastry(page, 2); await page.goto('/checkout'); await contact(page);
        const before = await formData(page); const countBefore = fixture('state').orders;
        fixture('set-price', { value: 10650 });
        await navigate(page, () => page.getByRole('button', { name: /Оформить тестовый заказ/ }).click());
        await expect(page.getByRole('alert')).toContainText('Стоимость или состав заказа изменились');
        await expect(page.locator('[name="name"]')).toHaveValue('Тестовый покупатель');
        await expect(page.locator('[name="phone"]')).toHaveValue('8 (918) 123-45-67');
        await expect(page.locator('[name="comment"]')).toHaveValue('Проверка сохранения формы');
        await expect(page.locator('[name="consent"]')).toBeChecked();
        const confirmed = await formData(page);
        assert.equal(confirmed.idempotencyKey, before.idempotencyKey);
        assert.notEqual(confirmed.fingerprint, before.fingerprint);
        await navigate(page, () => page.getByRole('button', { name: /Оформить тестовый заказ/ }).click());
        await expect(page).toHaveURL(/\/orders\/[a-f0-9-]+$/);
        priceOrderId = page.url().split('/').pop();
        const replay = await ctx.request.post('/action', { form: confirmed, maxRedirects: 0, headers: { Origin: baseURL } });
        assert.equal(replay.status(), 303);
        assert.equal(replay.headers().location, '/orders/' + priceOrderId);
        assert.equal(fixture('state').orders, countBefore + 1);
        await page.screenshot({ path: path.join(results, 'guest-order.png'), fullPage: true });
        const stranger = await browser.newContext({ baseURL });
        assert.equal((await stranger.request.get('/orders/' + priceOrderId)).status(), 404);
        await stranger.close();
        await page.goto('/login?register=1');
        await page.locator('[name="login"]').fill(login + '.guest');
        await page.locator('[name="password"]').fill(password);
        await navigate(page, () => page.getByRole('button', { name: 'Зарегистрироваться', exact: true }).click());
        await navigate(page, () => page.getByRole('button', { name: /Сохранить гостевые заказы/ }).click());
        await expect(page.locator('.order-card')).toHaveCount(1);
        await ctx.close();
    });

    await check('CSRF/origin and customer admin mutations are rejected', async () => {
        const { ctx, page } = await context();
        await addPastry(page); await page.goto('/cart');
        const csrf = await page.locator('[name="csrf"]').first().inputValue();
        const bad = await ctx.request.post('/action', { form: { _action: 'cart_clear', csrf: '0'.repeat(64), returnTo: '/cart' }, maxRedirects: 0 });
        assert.equal(bad.status(), 303); await page.goto('/cart');
        await expect(page.getByRole('alert')).toContainText('Страница устарела');
        await expect(page.locator('.cart-count')).toHaveText('1');
        await ctx.request.post('/action', { form: { _action: 'cart_clear', csrf, returnTo: '/cart' }, headers: { Origin: 'https://wrong.example' }, maxRedirects: 0 });
        await page.goto('/cart'); await expect(page.getByRole('alert')).toContainText('другого сайта');
        await expect(page.locator('.cart-count')).toHaveText('1');
        await signIn(page);
        const customerCsrf = await page.locator('[name="csrf"]').first().inputValue();
        const settings = fixture('state').settings;
        await ctx.request.post('/action', { form: { _action: 'admin_settings', csrf: customerCsrf, returnTo: '/account', feeRub:'0',minimumRub:'0',freeFromRub:'0',city:'Взлом' }, maxRedirects: 0 });
        await page.goto('/account'); await expect(page.getByRole('alert')).toContainText('администратора');
        assert.deepEqual(fixture('state').settings, settings);
        for (const route of ['/.local/bakery.sqlite','/lib/auth.php','/tests/e2e-fixture.php','/.git/config']) assert.equal((await ctx.request.get(route)).status(), 404, route);
        await ctx.close();
    });

    await check('changed order-attempt owner gets a fresh key and can successfully retry', async () => {
        const { ctx, page } = await context();
        await signIn(page); await page.goto('/cart');
        if (await page.getByRole('button', { name: 'Очистить корзину', exact: true }).count()) {
            await navigate(page, () => page.getByRole('button', { name: 'Очистить корзину', exact: true }).click());
        }
        await addPastry(page); await page.goto('/checkout'); await contact(page);
        const initial = await formData(page), countBefore = fixture('state').orders;
        await navigate(page, () => page.getByRole('button', { name: /Оформить тестовый заказ/ }).click());
        await page.goto('/account');
        await navigate(page, () => page.getByRole('button', { name: 'Выйти', exact: true }).click());
        await page.goto('/login?register=1');
        await page.locator('[name="login"]').fill(login + '.swap');
        await page.locator('[name="password"]').fill(password);
        await navigate(page, () => page.getByRole('button', { name: 'Зарегистрироваться', exact: true }).click());
        await addPastry(page); await page.goto('/checkout'); await contact(page);
        // A stale tab still contains the first account's already-used attempt key.
        await page.locator('[name="idempotencyKey"]').evaluate((input, key) => { input.value = key; }, initial.idempotencyKey);
        await navigate(page, () => page.getByRole('button', { name: /Оформить тестовый заказ/ }).click());
        await expect(page.getByRole('alert')).toContainText('Аккаунт изменился');
        const fresh = await formData(page);
        assert.notEqual(fresh.idempotencyKey, initial.idempotencyKey);
        assert.equal(fresh.name, 'Тестовый покупатель');
        assert.equal(fixture('state').orders, countBefore + 1);
        await navigate(page, () => page.getByRole('button', { name: /Оформить тестовый заказ/ }).click());
        await expect(page).toHaveURL(/\/orders\/[a-f0-9-]+$/);
        assert.equal(fixture('state').orders, countBefore + 2);
        await ctx.close();
    });

    await check('checkout mode changes preserve the contact draft and attempt key', async () => {
        const { ctx, page } = await context();
        await addPastry(page, 6); await page.goto('/checkout'); await contact(page);
        const locations = await page.locator('[name="locationId"] option').evaluateAll(options => options.map(option => option.value));
        const selectedLocation = locations[locations.length - 1];
        await page.locator('[name="locationId"]').selectOption(selectedLocation);
        const initial = await formData(page);
        await navigate(page, () => page.getByRole('button', { name: 'Доставка', exact: true }).click());
        await expect(page).toHaveURL(/fulfillment=delivery$/);
        await expect(page.locator('[name="name"]')).toHaveValue(initial.name);
        await expect(page.locator('[name="phone"]')).toHaveValue(initial.phone);
        await expect(page.locator('[name="comment"]')).toHaveValue(initial.comment);
        await expect(page.locator('[name="consent"]')).toBeChecked();
        await expect(page.locator('[name="idempotencyKey"]')).toHaveValue(initial.idempotencyKey);
        await page.locator('[name="address"]').fill('Тестовый проспект, дом 5');
        await navigate(page, () => page.getByRole('button', { name: 'Самовывоз', exact: true }).click());
        await expect(page.locator('[name="locationId"]')).toHaveValue(selectedLocation);
        await expect(page.locator('[name="name"]')).toHaveValue(initial.name);
        await navigate(page, () => page.getByRole('button', { name: 'Доставка', exact: true }).click());
        await expect(page.locator('[name="address"]')).toHaveValue('Тестовый проспект, дом 5');
        await expect(page.locator('[name="consent"]')).toBeChecked();
        await expect(page.locator('[name="idempotencyKey"]')).toHaveValue(initial.idempotencyKey);
        await ctx.close();
    });

    await check('HTML forms work with JavaScript disabled, including guest checkout', async () => {
        const { ctx, page } = await context({ javaScriptEnabled: false });
        await addPastry(page); await page.goto('/checkout'); await contact(page);
        await navigate(page, () => page.getByRole('button', { name: /Оформить тестовый заказ/ }).click());
        await expect(page).toHaveURL(/\/orders\/[a-f0-9-]+$/);
        await expect(page.getByRole('heading', { name: 'Спасибо за ваш выбор!' })).toBeVisible();
        await ctx.close();
    });

    await check('admin create/edit, variants, real image upload and stale-stock conflict', async () => {
        const { ctx, page } = await context();
        await signIn(page, seeded.adminLogin, adminPassword, true);
        await expect(page).toHaveURL(/\/admin$/);
        await page.goto('/admin?product=new');
        await page.locator('[name="id"]').fill('e2e-created');
        await page.locator('[name="name"]').fill('Новый проверочный товар');
        await page.locator('textarea[name="description"]').fill('Тестовая карточка');
        await page.locator('[name="category"]').selectOption('e2e-category');
        await page.locator('[name="stock"]').fill('10');
        await page.locator('[name="priceRub"]').fill('123.45');
        await page.locator('[name="imageFile"]').setInputFiles(seeded.image);
        await page.locator('[data-add-variant]').click();
        await page.locator('[name$="[priceRub]"]').fill('250.55');
        await navigate(page, () => page.getByRole('button', { name: 'Сохранить товар', exact: true }).click());
        await expect(page.getByRole('status')).toContainText('Товар сохранён');
        let product = fixture('product', { id: 'e2e-created' });
        assert.equal(product.price, 12345); assert.equal(product.stock, 10);
        assert.equal(product.variants[0].price, 25055);
        assert.match(product.image, /^\/uploads\/[a-f0-9-]+\.webp$/);
        const image = await ctx.request.get(product.image);
        assert.equal(image.status(), 200); assert.match(image.headers()['content-type'], /image\/webp/);
        await page.locator('[name="priceRub"]').fill('120.05');
        await page.locator('[name="stock"]').fill('11');
        await navigate(page, () => page.getByRole('button', { name: 'Сохранить товар', exact: true }).click());
        product = fixture('product', { id: 'e2e-created' });
        assert.equal(product.price, 12005); assert.equal(product.stock, 11);
        const imageBeforeError = product.image;
        await page.locator('[name="name"]').fill('x');
        await page.locator('[name="imageFile"]').setInputFiles(seeded.image);
        await page.locator('form.product-editor').evaluate(form => { form.noValidate = true; });
        await navigate(page, () => page.getByRole('button', { name: 'Сохранить товар', exact: true }).click());
        await expect(page.getByRole('alert')).toContainText('Название');
        const retainedImage = await page.locator('[name="image"]').inputValue();
        assert.match(retainedImage, /^\/uploads\/[a-f0-9-]+\.webp$/);
        assert.notEqual(retainedImage, imageBeforeError);
        assert.equal((await ctx.request.get(retainedImage)).status(), 200);
        assert.equal(fixture('product', { id: 'e2e-created' }).image, imageBeforeError);
        await page.locator('[name="name"]').fill('Новый проверочный товар');
        // The browser cleared its file input; the already-uploaded path must be reused.
        assert.equal(await page.locator('[name="imageFile"]').inputValue(), '');
        await navigate(page, () => page.getByRole('button', { name: 'Сохранить товар', exact: true }).click());
        assert.equal(fixture('product', { id: 'e2e-created' }).image, retainedImage);
        fixture('set-stock', { id: 'e2e-created', value: 9 });
        await page.locator('[name="name"]').fill('Устаревшее изменение');
        await page.locator('[name="imageFile"]').setInputFiles(seeded.image);
        await navigate(page, () => page.getByRole('button', { name: 'Сохранить товар', exact: true }).click());
        await expect(page.getByRole('alert')).toContainText('Остаток изменился');
        const staleStockImage = await page.locator('[name="image"]').inputValue();
        assert.notEqual(staleStockImage, retainedImage);
        assert.equal((await ctx.request.get(staleStockImage)).status(), 200);
        assert.equal(fixture('product', { id: 'e2e-created' }).name, 'Новый проверочный товар');
        assert.equal(fixture('product', { id: 'e2e-created' }).image, retainedImage);
        await page.goto('/admin?product=e2e-created');
        await page.locator('[name="imageFile"]').setInputFiles({ name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
        await navigate(page, () => page.getByRole('button', { name: 'Сохранить товар', exact: true }).click());
        await expect(page.getByRole('alert')).toContainText('Нужен JPEG, PNG или WebP');
        await page.goto('/admin?product=e2e-created');
        await page.screenshot({ path: path.join(results, 'admin-product.png'), fullPage: true });
        await ctx.close();
    });

    await check('admin delivery settings and order cancellation restore stock', async () => {
        const { ctx, page } = await context();
        await signIn(page, seeded.adminLogin, adminPassword, true);
        await page.goto('/admin?tab=settings');
        await page.locator('[name="feeRub"]').fill('1.25');
        await page.locator('[name="freeFromRub"]').fill('100');
        await page.locator('[name="minimumRub"]').fill('0');
        await page.locator('[name="city"]').fill('Тестовый город');
        await navigate(page, () => page.getByRole('button', { name: 'Сохранить настройки', exact: true }).click());
        await expect(page.getByRole('status')).toContainText('Условия доставки сохранены');
        assert.deepEqual(fixture('state').settings, { fee:125,freeFrom:10000,minimum:0,city:'Тестовый город' });
        await page.goto('/admin');
        const before = fixture('state').pastry.stock;
        const block = page.locator('.admin-order-block').filter({ has: page.locator(`input[name="orderId"][value="${priceOrderId}"]`) });
        await navigate(page, () => block.getByRole('button', { name: 'Принят', exact: true }).click());
        await navigate(page, () => block.getByRole('button', { name: 'Отменён', exact: true }).click());
        assert.equal(fixture('state').pastry.stock, before + 2);
        await expect(page.locator(`input[name="orderId"][value="${priceOrderId}"]`)).toHaveCount(0);
        await ctx.close();
    });

    assert.deepEqual(browserErrors, [], 'browser JavaScript errors');
    assert.equal(/PHP (?:Warning|Fatal error|Parse error)|Uncaught /i.test(serverLog), false, 'PHP server errors; see server.log');
    console.log(`\n${passed} browser scenario groups passed`);
})().catch(async error => {
    console.error(error.stack || error);
    if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: path.join(results, 'failure.png'), fullPage: true }).catch(() => {});
    process.exitCode = 1;
}).finally(async () => {
    if (browser) await browser.close();
    if (server) {
        server.kill();
        await new Promise(resolve => server.once('exit', resolve));
    }
    if (fs.existsSync(results)) fs.writeFileSync(path.join(results, 'server.log'), serverLog);
});
