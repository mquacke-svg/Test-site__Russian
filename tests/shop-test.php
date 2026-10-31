<?php
declare(strict_types=1);
define('ROOT', dirname(__DIR__));
require ROOT . '/lib/rules.php';
require ROOT . '/lib/db.php';
require ROOT . '/lib/shop.php';
require ROOT . '/lib/admin.php';

// Tests always create their own database; the configured shop database is never opened.
$testDirectory = sys_get_temp_dir() . '/bakery-php-test-' . bin2hex(random_bytes(8));
mkdir($testDirectory, 0700, true);
$testDatabase = $testDirectory . '/test.sqlite';
putenv('DATABASE_PATH=' . $testDatabase);
$initial = new PDO('sqlite:' . $testDatabase);
$initial->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$initial->exec(file_get_contents(__DIR__ . '/schema.sql'));
$initial = null;
$passed = $failed = 0;

function equal(mixed $actual, mixed $expected): void
{
    if ($actual !== $expected) throw new RuntimeException('Expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
}

function rejects(callable $work, ?string $code = null, ?int $status = null): ShopError
{
    try { $work(); } catch (ShopError $error) {
        if ($code !== null) equal($error->errorCode, $code);
        if ($status !== null) equal($error->status, $status);
        return $error;
    }
    throw new RuntimeException('Expected ShopError');
}

function fixture(): void
{
    transaction(function () {
        foreach (['notification', 'order_item', 'shop_order', 'cart_item', 'cart', 'variant', 'product', 'category', 'location', 'setting', 'account', 'session', 'user'] as $table) db()->exec('DELETE FROM ' . $table);
        sqlRun('INSERT INTO category (id,name,tagline,emoji) VALUES (?,?,?,?)', ['pastry', 'Выпечка', 'Свежая', '🥐']);
        sqlRun('INSERT INTO category (id,name,tagline,emoji) VALUES (?,?,?,?)', ['drinks', 'Напитки', 'Горячие', '☕']);
        sqlRun('INSERT INTO location (id,title,address,city,hours) VALUES (?,?,?,?,?)', ['one', 'Пекарня', 'ул. Тестовая, 1', 'Краснодар', '08:00–20:00']);
        sqlRun('INSERT INTO product (id,name,category,price,available,stock,is_bestseller,is_seasonal) VALUES (?,?,?,?,?,?,?,?)', ['pastry', 'Круассан', 'pastry', 10050, true, null, true, false]);
        sqlRun('INSERT INTO product (id,name,category,price,available) VALUES (?,?,?,?,?)', ['drink', 'Кофе', 'drinks', null, true]);
        sqlRun('INSERT INTO product (id,name,category,price,available) VALUES (?,?,?,?,?)', ['unknown', 'Торт на заказ', 'pastry', null, true]);
        sqlRun('INSERT INTO variant (id,product_id,label,volume_ml,price) VALUES (?,?,?,?,?)', ['small', 'drink', '200 мл', 200, 15000]);
        sqlRun('INSERT INTO variant (id,product_id,label,volume_ml,price) VALUES (?,?,?,?,?)', ['large', 'drink', '400 мл', 400, 25000]);
        saveSettings(['feeRub' => '250', 'freeFromRub' => '2000', 'minimumRub' => '500', 'city' => 'Краснодар']);
        foreach (['alice', 'bob', 'admin'] as $id) sqlRun('INSERT INTO user (id,name,email,role,created_at,updated_at) VALUES (?,?,?,?,?,?)', [$id, $id, $id . '@example.test', $id === 'admin' ? 'admin' : 'customer', nowMs(), nowMs()]);
    });
}

function test(string $name, callable $work): void
{
    global $passed, $failed;
    try {
        fixture();
        $work();
        $passed++;
        echo "PASS $name\n";
    } catch (Throwable $error) {
        $failed++;
        fwrite(STDERR, "FAIL $name: " . $error->getMessage() . "\n" . $error->getTraceAsString() . "\n");
    }
}

function person(?string $user = null): array
{
    return ['guestHash' => hash('sha256', uuid())] + ($user ? ['userId' => $user, 'role' => $user === 'admin' ? 'admin' : 'customer'] : []);
}

function basket(string $product = 'pastry', int $quantity = 2, string $variant = ''): array
{
    $identity = person();
    $cartId = resolveCart($identity);
    changeCart($cartId, ['action' => 'add', 'productId' => $product, 'variantId' => $variant, 'quantity' => $quantity]);
    return compact('identity', 'cartId');
}

function payload(string $cartId, string $fulfillment = 'pickup'): array
{
    return [
        'name' => 'Тестовый покупатель', 'phone' => '8 (918) 123-45-67', 'fulfillment' => $fulfillment,
        'locationId' => 'one', 'address' => 'Тестовая, 1, кв. 2', 'consent' => 'on',
        'fingerprint' => quote($cartId, $fulfillment)['fingerprint'], 'idempotencyKey' => uuid(),
    ];
}

function productForm(string $id = 'pastry'): array
{
    $product = sqlOne('SELECT * FROM product WHERE id = ?', [$id]);
    return [
        'id' => $id, 'name' => $product['name'], 'category' => $product['category'],
        'priceRub' => $product['price'] === null ? '' : (string) ($product['price'] / 100),
        'available' => 'on', 'stock' => $product['stock'] ?? '', 'expectedStock' => $product['stock'] ?? '',
    ];
}

test('delivery limits use kopecks and pickup has no minimum', function () {
    $settings = getSettings();
    rejects(fn() => deliveryCost(49999, 'delivery', $settings), 'MINIMUM_ORDER');
    equal(deliveryCost(50000, 'delivery', $settings), 25000);
    equal(deliveryCost(199999, 'delivery', $settings), 25000);
    equal(deliveryCost(200000, 'delivery', $settings), 0);
    equal(deliveryCost(1, 'pickup', $settings), 0);
    rejects(fn() => deliveryCost(50000, 'bad', $settings));
});

test('money conversion is exact and rejects invalid amounts', function () {
    equal(rublesToCents('100,05', 'Цена'), 10005);
    equal(rublesToCents('0.29', 'Цена'), 29);
    foreach (['1.001', '-1', '1e3', '1.2x', '', '1000001'] as $amount) rejects(fn() => rublesToCents($amount, 'Цена'));
});

test('catalog exposes camelCase values with correct types', function () {
    $catalog = getCatalog();
    equal($catalog['products'][0]['isBestseller'], true);
    equal($catalog['products'][0]['stock'], null);
    equal($catalog['products'][1]['variants'][0]['volumeMl'], 200);
    equal($catalog['products'][1]['variants'][0]['productId'], 'drink');
});

test('contact validation, consent and fulfillment', function () {
    $b = basket(); $body = payload($b['cartId']);
    equal(validateCheckout($body)['phone'], '79181234567');
    foreach ([['phone' => '123'], ['consent' => false], ['name' => 'x'], ['name' => []], ['fulfillment' => 'bad'], ['locationId' => ''], ['fulfillment' => 'delivery', 'address' => ''], ['fingerprint' => 'x'], ['idempotencyKey' => 'bad']] as $invalid) rejects(fn() => validateCheckout(array_replace($body, $invalid)));
});

test('guest carts are isolated and persist', function () {
    $a = basket(); $b = basket('pastry', 1);
    equal(resolveCart($a['identity']), $a['cartId']);
    equal(getCart($a['cartId'])['count'], 2);
    equal(getCart($b['cartId'])['count'], 1);
    $foreignItem = getCart($a['cartId'])['items'][0]['id'];
    rejects(fn() => changeCart($b['cartId'], ['action' => 'remove', 'itemId' => $foreignItem]), null, 404);
});

test('cart additions, quantity validation, zero removal and clear', function () {
    $b = basket(); $id = $b['cartId'];
    equal(getCart($id)['subtotal'], 20100);
    foreach (['1.5', [], -1, 0, 100] as $quantity) rejects(fn() => changeCart($id, ['action' => 'add', 'productId' => 'pastry', 'quantity' => $quantity]));
    rejects(fn() => changeCart($id, ['action' => 'unknown']));
    changeCart($id, ['action' => 'update', 'itemId' => getCart($id)['items'][0]['id'], 'quantity' => '99']);
    rejects(fn() => changeCart($id, ['action' => 'add', 'productId' => 'pastry']));
    changeCart($id, ['action' => 'update', 'itemId' => getCart($id)['items'][0]['id'], 'quantity' => '0']);
    equal(getCart($id)['count'], 0);
    changeCart($id, ['action' => 'add', 'productId' => 'pastry']);
    changeCart($id, ['action' => 'clear']);
    equal(getCart($id)['items'], []);
});

test('variants remain separate and invalid choices are rejected', function () {
    $b = basket('drink', 1, 'small');
    changeCart($b['cartId'], ['action' => 'add', 'productId' => 'drink', 'variantId' => 'large']);
    equal(count(getCart($b['cartId'])['items']), 2);
    equal(getCart($b['cartId'])['subtotal'], 40000);
    foreach (['', 'bad'] as $variantId) rejects(fn() => changeCart($b['cartId'], ['action' => 'add', 'productId' => 'drink', 'variantId' => $variantId]));
    rejects(fn() => changeCart($b['cartId'], ['action' => 'add', 'productId' => 'pastry', 'variantId' => 'small']));
});

test('unpriced, disabled and empty carts cannot be ordered', function () {
    $empty = resolveCart(person());
    rejects(fn() => quote($empty, 'pickup'), 'EMPTY_CART');
    rejects(fn() => changeCart($empty, ['action' => 'add', 'productId' => 'unknown']));
    $b = basket();
    sqlRun('UPDATE product SET available = 0 WHERE id = ?', ['pastry']);
    rejects(fn() => quote($b['cartId'], 'pickup'), 'UNAVAILABLE');
    rejects(fn() => changeCart($empty, ['action' => 'add', 'productId' => 'pastry']));
});

test('removed and newly required variants invalidate old cart rows', function () {
    $b = basket();
    sqlRun('INSERT INTO variant (id,product_id,label,volume_ml,price) VALUES (?,?,?,?,?)', ['new', 'pastry', 'Большой', 300, 30000]);
    equal(getCart($b['cartId'])['items'][0]['available'], false);
    changeCart($b['cartId'], ['action' => 'add', 'productId' => 'pastry', 'variantId' => 'new']);
    sqlRun('DELETE FROM variant WHERE id = ?', ['new']);
    $items = getCart($b['cartId'])['items'];
    equal($items[1]['price'], null);
    equal($items[1]['available'], false);
});

test('stock is shared across variants and restored only once', function () {
    sqlRun('UPDATE product SET stock = 3 WHERE id = ?', ['drink']);
    $b = basket('drink', 2, 'small');
    rejects(fn() => changeCart($b['cartId'], ['action' => 'add', 'productId' => 'drink', 'variantId' => 'large', 'quantity' => 2]), 'OUT_OF_STOCK');
    changeCart($b['cartId'], ['action' => 'add', 'productId' => 'drink', 'variantId' => 'large', 'quantity' => 1]);
    $body = payload($b['cartId']);
    $order = createOrder($b['cartId'], $b['identity'], $body);
    equal(sqlOne('SELECT stock FROM product WHERE id = ?', ['drink'])['stock'], 0);
    equal(createOrder($b['cartId'], $b['identity'], $body)['id'], $order['id']);
    updateOrderStatus($order['id'], 'cancelled');
    equal(sqlOne('SELECT stock FROM product WHERE id = ?', ['drink'])['stock'], 3);
    rejects(fn() => updateOrderStatus($order['id'], 'cancelled'));
    equal(sqlOne('SELECT stock FROM product WHERE id = ?', ['drink'])['stock'], 3);
});

test('cancel does not re-enable disabled stock tracking', function () {
    sqlRun('UPDATE product SET stock = 3 WHERE id = ?', ['pastry']);
    $b = basket(); $order = createOrder($b['cartId'], $b['identity'], payload($b['cartId']));
    sqlRun('UPDATE product SET stock = NULL WHERE id = ?', ['pastry']);
    updateOrderStatus($order['id'], 'cancelled');
    equal(sqlOne('SELECT stock FROM product WHERE id = ?', ['pastry'])['stock'], null);
});

test('changed stock blocks checkout without clearing cart', function () {
    $a = basket(); $b = basket();
    sqlRun('UPDATE product SET stock = 2 WHERE id = ?', ['pastry']);
    $first = payload($a['cartId']); $second = payload($b['cartId']);
    createOrder($a['cartId'], $a['identity'], $first);
    rejects(fn() => createOrder($b['cartId'], $b['identity'], $second), 'OUT_OF_STOCK');
    equal(getCart($b['cartId'])['count'], 2);
    equal(sqlOne('SELECT COUNT(*) AS count FROM shop_order')['count'], 1);
});

test('price change requires confirmation and old order snapshots remain', function () {
    $b = basket(); $body = payload($b['cartId']);
    sqlRun('UPDATE product SET price = 10150 WHERE id = ?', ['pastry']);
    rejects(fn() => createOrder($b['cartId'], $b['identity'], $body), 'PRICE_CHANGED');
    equal(getCart($b['cartId'])['count'], 2);
    $order = createOrder($b['cartId'], $b['identity'], payload($b['cartId']));
    sqlRun('UPDATE product SET price = 99999, name = ? WHERE id = ?', ['Новое название', 'pastry']);
    $stored = orderDetails($order['id'], $b['identity']);
    equal($stored['items'][0]['price'], 10150);
    equal($stored['items'][0]['name'], 'Круассан');
});

test('variant label and delivery city changes affect confirmation', function () {
    $b = basket('drink', 4, 'small'); $body = payload($b['cartId'], 'delivery');
    sqlRun('UPDATE variant SET label = ? WHERE id = ?', ['250 мл', 'small']);
    rejects(fn() => createOrder($b['cartId'], $b['identity'], $body), 'PRICE_CHANGED');
    $body = payload($b['cartId'], 'delivery');
    saveSettings(['feeRub' => '250', 'freeFromRub' => '2000', 'minimumRub' => '500', 'city' => 'Другой город']);
    rejects(fn() => createOrder($b['cartId'], $b['identity'], $body), 'PRICE_CHANGED');
});

test('idempotency, numbering, private fields and no external notifications', function () {
    $a = basket(); $body = payload($a['cartId']);
    $first = createOrder($a['cartId'], $a['identity'], $body);
    equal(createOrder($a['cartId'], $a['identity'], $body)['id'], $first['id']);
    equal(getCart($a['cartId'])['count'], 0);
    equal(isset($first['guestHash']), false);
    equal(isset($first['idempotencyKey']), false);
    equal(sqlOne('SELECT COUNT(*) AS count FROM notification')['count'], 0);
    $b = basket(); $other = payload($b['cartId']); $other['idempotencyKey'] = $body['idempotencyKey'];
    rejects(fn() => createOrder($b['cartId'], $b['identity'], $other), 'ATTEMPT_OWNER_CHANGED');
    $second = createOrder($b['cartId'], $b['identity'], payload($b['cartId']));
    equal($second['sequence'], $first['sequence'] + 1);
});

test('pickup point must exist and delivered address includes configured city', function () {
    $b = basket('pastry', 6); $body = payload($b['cartId']); $body['locationId'] = 'missing';
    rejects(fn() => createOrder($b['cartId'], $b['identity'], $body));
    equal(sqlOne('SELECT COUNT(*) AS count FROM shop_order')['count'], 0);
    $order = createOrder($b['cartId'], $b['identity'], payload($b['cartId'], 'delivery'));
    equal($order['address'], 'Краснодар, Тестовая, 1, кв. 2');
    equal($order['delivery'], 25000);
    equal($order['total'], 85300);
    equal($order['phone'], '+79181234567');
});

test('guest orders can be claimed only once by their owner', function () {
    $a = basket(); $order = createOrder($a['cartId'], $a['identity'], payload($a['cartId']));
    rejects(fn() => orderDetails($order['id'], person()), null, 404);
    rejects(fn() => claimGuestOrders($a['identity']), null, 401);
    equal(claimGuestOrders(person('bob')), 0);
    $owned = $a['identity'] + ['userId' => 'alice', 'role' => 'customer'];
    equal(claimGuestOrders($owned), 1);
    equal(claimGuestOrders($owned), 0);
    rejects(fn() => orderDetails($order['id'], $a['identity']), null, 404);
    equal(orderDetails($order['id'], $owned)['id'], $order['id']);
    equal(count(listOrders($owned)), 1);
    equal(listOrders(person('bob')), []);
    rejects(fn() => listOrders($owned, true), null, 403);
    equal(count(listOrders(person('admin'), true)), 1);
});

test('guest cart merges once and clips duplicate quantities to 99', function () {
    $ownedIdentity = person('alice'); $ownedCart = resolveCart($ownedIdentity);
    changeCart($ownedCart, ['action' => 'add', 'productId' => 'pastry', 'quantity' => 98]);
    $guest = basket('pastry', 5);
    $signed = $guest['identity'] + ['userId' => 'alice'];
    equal(resolveCart($signed), $ownedCart);
    equal(getCart($ownedCart)['count'], 99);
    equal(resolveCart($signed), $ownedCart);
    equal(getCart($ownedCart)['count'], 99);
    equal(sqlOne('SELECT id FROM cart WHERE id = ?', [$guest['cartId']]), null);
});

test('expiry removes only guest carts and retains orders and user carts', function () {
    $expired = basket(); $active = basket();
    $order = createOrder($expired['cartId'], $expired['identity'], payload($expired['cartId']));
    changeCart($expired['cartId'], ['action' => 'add', 'productId' => 'pastry']);
    $owned = resolveCart(person('alice'));
    sqlRun('UPDATE cart SET expires_at = 0 WHERE id IN (?, ?)', [$expired['cartId'], $owned]);
    resolveCart(person());
    equal(sqlOne('SELECT id FROM cart WHERE id = ?', [$expired['cartId']]), null);
    equal(getCart($expired['cartId'])['count'], 0);
    equal(sqlOne('SELECT id FROM cart WHERE id = ?', [$owned])['id'], $owned);
    equal(getCart($active['cartId'])['count'], 2);
    equal(orderDetails($order['id'], $expired['identity'])['id'], $order['id']);
});

test('order transitions enforce fulfillment and terminal states', function () {
    equal(canTransition('preparing', 'ready', 'pickup'), true);
    equal(canTransition('preparing', 'ready', 'delivery'), false);
    equal(canTransition('preparing', 'delivering', 'delivery'), true);
    $b = basket(); $order = createOrder($b['cartId'], $b['identity'], payload($b['cartId']));
    rejects(fn() => updateOrderStatus($order['id'], 'completed'));
    foreach (['accepted', 'preparing', 'ready', 'completed'] as $status) updateOrderStatus($order['id'], $status);
    rejects(fn() => updateOrderStatus($order['id'], 'cancelled'));
});

test('admin edits preserve exact prices, boolean flags and null stock', function () {
    $form = productForm();
    $form['priceRub'] = '123,45'; $form['isSeasonal'] = 'on'; $form['name'] = "Круассан ' новый";
    saveProduct($form);
    $saved = sqlOne('SELECT * FROM product WHERE id = ?', ['pastry']);
    equal($saved['price'], 12345); equal($saved['stock'], null);
    equal($saved['isSeasonal'], true); equal($saved['isBestseller'], false);
    equal($saved['name'], "Круассан ' новый");
});

test('admin stale stock conflict leaves all fields untouched', function () {
    $form = productForm(); $form['name'] = 'Устаревшая форма';
    sqlRun('UPDATE product SET stock = 3 WHERE id = ?', ['pastry']);
    rejects(fn() => saveProduct($form), null, 409);
    $saved = sqlOne('SELECT * FROM product WHERE id = ?', ['pastry']);
    equal($saved['name'], 'Круассан'); equal($saved['stock'], 3);
    $form['expectedStock'] = '3'; $form['stock'] = '5'; saveProduct($form);
    equal(sqlOne('SELECT stock FROM product WHERE id = ?', ['pastry'])['stock'], 5);
});

test('admin rejects duplicate IDs, stolen variant IDs and invalid fields', function () {
    $form = productForm();
    rejects(fn() => saveProduct($form + ['creating' => '1']), null, 409);
    foreach ([['id' => '../bad'], ['category' => 'missing'], ['image' => '/uploads/../secret.php'], ['stock' => '-1'], ['priceRub' => '0'], ['variants' => 'bad']] as $invalid) rejects(fn() => saveProduct(array_replace($form, $invalid)));
    $variant = ['id' => 'small', 'label' => 'Новый', 'volumeMl' => '100', 'priceRub' => '10'];
    rejects(fn() => saveProduct($form + ['variants' => [$variant]]));
    $variant['id'] = 'duplicate';
    rejects(fn() => saveProduct($form + ['variants' => [$variant, $variant]]));
    equal(sqlOne('SELECT product_id FROM variant WHERE id = ?', ['small'])['productId'], 'drink');
});

test('admin can create product and replace own variants', function () {
    saveProduct(['id' => 'new', 'name' => 'Новый напиток', 'category' => 'drinks', 'available' => 'on', 'creating' => '1', 'variants' => [
        ['id' => 'new-small', 'label' => '100 мл', 'volumeMl' => '100', 'priceRub' => '50.50'],
    ]]);
    $product = sqlOne('SELECT * FROM product WHERE id = ?', ['new']);
    equal($product['price'], null);
    equal(sqlOne('SELECT price FROM variant WHERE id = ?', ['new-small'])['price'], 5050);
    $form = productForm('new'); $form['priceRub'] = '99'; saveProduct($form);
    equal(sqlAll('SELECT * FROM variant WHERE product_id = ?', ['new']), []);
});

test('failed transactions and nested savepoints roll back correctly', function () {
    try {
        transaction(function () {
            sqlRun('UPDATE product SET stock = 100 WHERE id = ?', ['pastry']);
            transaction(function () { sqlRun('UPDATE product SET stock = 5 WHERE id = ?', ['drink']); });
            throw new RuntimeException('rollback');
        });
    } catch (RuntimeException $error) { equal($error->getMessage(), 'rollback'); }
    equal(sqlOne('SELECT stock FROM product WHERE id = ?', ['pastry'])['stock'], null);
    equal(sqlOne('SELECT stock FROM product WHERE id = ?', ['drink'])['stock'], null);
    transaction(function () {
        try { transaction(function () { sqlRun('UPDATE product SET stock = 8 WHERE id = ?', ['drink']); throw new RuntimeException('inner'); }); } catch (RuntimeException) {}
        sqlRun('UPDATE product SET stock = 4 WHERE id = ?', ['pastry']);
    });
    equal(sqlOne('SELECT stock FROM product WHERE id = ?', ['pastry'])['stock'], 4);
    equal(sqlOne('SELECT stock FROM product WHERE id = ?', ['drink'])['stock'], null);
});

test('upload rejects missing files and arbitrary local file paths', function () {
    rejects(fn() => saveUpload([]));
    rejects(fn() => saveUpload(['error' => UPLOAD_ERR_OK, 'tmp_name' => __FILE__, 'size' => 1, 'type' => 'image/webp']));
});

function parallelOrders(array $requests): array
{
    global $testDatabase;
    $workers = [];
    foreach ($requests as $request) {
        $process = proc_open([PHP_BINARY, __DIR__ . '/checkout-worker.php'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, ROOT);
        if (!is_resource($process)) throw new RuntimeException('Cannot start checkout worker');
        fwrite($pipes[0], json_encode($request + ['database' => $testDatabase], JSON_THROW_ON_ERROR)); fclose($pipes[0]);
        $workers[] = [$process, $pipes];
    }
    $results = [];
    foreach ($workers as [$process, $pipes]) {
        $output = stream_get_contents($pipes[1]); $error = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        $code = proc_close($process);
        if ($code !== 0) throw new RuntimeException('Checkout worker: ' . $error);
        $results[] = json_decode($output, true, 512, JSON_THROW_ON_ERROR);
    }
    return $results;
}

test('parallel customers cannot oversell the final item', function () {
    sqlRun('UPDATE product SET stock = 1 WHERE id = ?', ['pastry']);
    $a = basket('pastry', 1); $b = basket('pastry', 1);
    $results = parallelOrders([$a + ['body' => payload($a['cartId'])], $b + ['body' => payload($b['cartId'])]]);
    equal(count(array_filter($results, fn($result) => isset($result['id']))), 1);
    equal(count(array_filter($results, fn($result) => ($result['error'] ?? '') === 'OUT_OF_STOCK')), 1);
    equal(sqlOne('SELECT stock FROM product WHERE id = ?', ['pastry'])['stock'], 0);
    equal(sqlOne('SELECT COUNT(*) AS count FROM shop_order')['count'], 1);
});

test('parallel retries create and deduct exactly once', function () {
    sqlRun('UPDATE product SET stock = 2 WHERE id = ?', ['pastry']);
    $b = basket(); $request = $b + ['body' => payload($b['cartId'])];
    $results = parallelOrders([$request, $request]);
    equal($results[0]['id'], $results[1]['id']);
    equal(sqlOne('SELECT stock FROM product WHERE id = ?', ['pastry'])['stock'], 0);
    equal(sqlOne('SELECT COUNT(*) AS count FROM shop_order')['count'], 1);
});

echo "\n$passed passed, $failed failed\n";
db()->exec('PRAGMA wal_checkpoint(TRUNCATE)');
// Windows keeps an open PDO file locked; cleanup runs after the process releases it.
register_shutdown_function(function () use ($testDirectory) {
    foreach (glob($testDirectory . '/*') as $file) @unlink($file);
    @rmdir($testDirectory);
});
exit($failed === 0 ? 0 : 1);
