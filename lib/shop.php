<?php
declare(strict_types=1);

function getSettings(): array
{
    $row = sqlOne('SELECT value FROM setting WHERE id = ?', ['delivery']);
    if (!$row) throw new ShopError('Настройки магазина не найдены.', 503);
    $settings = json_decode($row['value'], true, 512, JSON_THROW_ON_ERROR);
    return [
        'fee' => (int) $settings['fee'], 'freeFrom' => (int) $settings['freeFrom'],
        'minimum' => (int) $settings['minimum'], 'city' => (string) $settings['city'],
    ];
}

function getCatalog(): array
{
    $variants = [];
    foreach (sqlAll('SELECT * FROM variant ORDER BY rowid') as $variant) $variants[$variant['productId']][] = $variant;
    $products = sqlAll('SELECT * FROM product ORDER BY rowid');
    foreach ($products as &$product) $product['variants'] = $variants[$product['id']] ?? [];
    unset($product);
    return [
        'products' => $products,
        'categories' => sqlAll('SELECT * FROM category ORDER BY rowid'),
        'locations' => sqlAll('SELECT * FROM location ORDER BY rowid'),
        'settings' => getSettings(),
    ];
}

function resolveCart(array $identity): string
{
    return transaction(function () use ($identity) {
        sqlRun('DELETE FROM cart WHERE user_id IS NULL AND expires_at < ?', [nowMs()]);
        $guest = sqlOne('SELECT * FROM cart WHERE guest_hash = ?', [$identity['guestHash']]);
        if (empty($identity['userId'])) {
            if ($guest) return $guest['id'];
            $id = uuid();
            sqlRun('INSERT INTO cart (id, guest_hash, expires_at) VALUES (?, ?, ?)', [$id, $identity['guestHash'], nowMs() + 30 * 86400000]);
            return $id;
        }
        $owned = sqlOne('SELECT * FROM cart WHERE user_id = ?', [$identity['userId']]);
        if (!$owned) {
            $owned = ['id' => uuid()];
            sqlRun('INSERT INTO cart (id, user_id, expires_at) VALUES (?, ?, ?)', [$owned['id'], $identity['userId'], nowMs() + 30 * 86400000]);
        }
        if ($guest) {
            foreach (sqlAll('SELECT * FROM cart_item WHERE cart_id = ?', [$guest['id']]) as $item) {
                sqlRun('INSERT INTO cart_item (id, cart_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(cart_id, product_id, variant_id) DO UPDATE SET quantity = MIN(99, cart_item.quantity + excluded.quantity)',
                    [uuid(), $owned['id'], $item['productId'], $item['variantId'], $item['quantity']]);
            }
            sqlRun('DELETE FROM cart WHERE id = ?', [$guest['id']]);
        }
        return $owned['id'];
    });
}

function getCart(string $cartId): array
{
    $items = sqlAll("SELECT i.id, i.product_id, i.variant_id, i.quantity, p.name, p.image, p.available, p.stock,
        v.label AS variant_label,
        CASE WHEN i.variant_id <> '' THEN v.price
             WHEN EXISTS(SELECT 1 FROM variant WHERE product_id = p.id) THEN NULL
             ELSE p.price END AS price
        FROM cart_item i JOIN product p ON p.id = i.product_id
        LEFT JOIN variant v ON v.id = i.variant_id AND v.product_id = p.id
        WHERE i.cart_id = ? ORDER BY i.rowid", [$cartId]);
    $count = $subtotal = 0;
    foreach ($items as &$item) {
        $item['available'] = $item['available'] && $item['price'] !== null;
        $count += $item['quantity'];
        $subtotal += ($item['price'] ?? 0) * $item['quantity'];
    }
    unset($item);
    return compact('items', 'count', 'subtotal');
}

function checkCartStock(string $cartId, ?array $product, int $additional): void
{
    if (!$product || !$product['available']) throw new ShopError('Этот товар сейчас недоступен', 409);
    $total = sqlOne('SELECT COALESCE(SUM(quantity), 0) AS quantity FROM cart_item WHERE cart_id = ? AND product_id = ?', [$cartId, $product['id']])['quantity'];
    if ($product['stock'] !== null && $total + $additional > $product['stock']) throw new ShopError('Недостаточно товара «' . $product['name'] . '». Уменьшите количество в корзине.', 409, 'OUT_OF_STOCK');
}

function changeCart(string $cartId, array $input): array
{
    $action = textField($input, 'action', 'Действие', 1, 20);
    if (!in_array($action, ['add', 'update', 'remove', 'clear'], true)) throw new ShopError('Неизвестное действие с корзиной');
    $quantity = in_array($action, ['add', 'update'], true) ? integerValue($input['quantity'] ?? 1, 'Количество', $action === 'add' ? 1 : 0, 99) : 0;
    return transaction(function () use ($cartId, $input, $action, $quantity) {
        if ($action === 'clear') sqlRun('DELETE FROM cart_item WHERE cart_id = ?', [$cartId]);
        elseif ($action === 'remove' || $action === 'update') {
            $item = sqlOne('SELECT * FROM cart_item WHERE cart_id = ? AND id = ?', [$cartId, textField($input, 'itemId', 'Позиция', 1, 100)]);
            if (!$item) throw new ShopError('Позиция не найдена', 404);
            if ($action === 'update' && $quantity > $item['quantity']) checkCartStock($cartId, sqlOne('SELECT * FROM product WHERE id = ?', [$item['productId']]), $quantity - $item['quantity']);
            if ($action === 'remove' || $quantity === 0) sqlRun('DELETE FROM cart_item WHERE id = ?', [$item['id']]);
            else sqlRun('UPDATE cart_item SET quantity = ? WHERE id = ?', [$quantity, $item['id']]);
        } else {
            $product = sqlOne('SELECT * FROM product WHERE id = ?', [textField($input, 'productId', 'Товар', 1, 100)]);
            if (!$product || !$product['available']) throw new ShopError('Этот товар сейчас недоступен');
            $variants = sqlAll('SELECT * FROM variant WHERE product_id = ?', [$product['id']]);
            $variantId = textField($input, 'variantId', 'Вариант', 0, 100);
            if ($variants ? !in_array($variantId, array_column($variants, 'id'), true) : ($variantId !== '' || $product['price'] === null)) throw new ShopError('Выберите доступный вариант товара');
            $existing = sqlOne('SELECT * FROM cart_item WHERE cart_id = ? AND product_id = ? AND variant_id = ?', [$cartId, $product['id'], $variantId]);
            $total = ($existing['quantity'] ?? 0) + $quantity;
            if ($total > 99) throw new ShopError('Не более 99 единиц одной позиции');
            checkCartStock($cartId, $product, $quantity);
            if ($existing) sqlRun('UPDATE cart_item SET quantity = ? WHERE id = ?', [$total, $existing['id']]);
            else sqlRun('INSERT INTO cart_item (id, cart_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?, ?)', [uuid(), $cartId, $product['id'], $variantId, $total]);
        }
        return getCart($cartId);
    });
}

function quote(string $cartId, string $fulfillment): array
{
    $cart = getCart($cartId);
    if (!$cart['items']) throw new ShopError('Корзина пуста', 400, 'EMPTY_CART');
    $totals = [];
    foreach ($cart['items'] as $item) {
        if (!$item['available']) throw new ShopError('В корзине есть недоступный товар. Удалите его перед оформлением.', 409, 'UNAVAILABLE');
        $totals[$item['productId']] = ($totals[$item['productId']] ?? 0) + $item['quantity'];
    }
    foreach ($cart['items'] as $item) if ($item['stock'] !== null && $totals[$item['productId']] > $item['stock']) throw new ShopError('Недостаточно товара «' . $item['name'] . '». Уменьшите количество в корзине.', 409, 'OUT_OF_STOCK');
    $settings = getSettings();
    $delivery = deliveryCost($cart['subtotal'], $fulfillment, $settings);
    $fingerprint = hash('sha256', json_encode([
        'items' => array_map(fn($item) => [$item['productId'], $item['variantId'], $item['name'], $item['variantLabel'], $item['quantity'], $item['price']], $cart['items']),
        'fulfillment' => $fulfillment, 'delivery' => $delivery, 'settings' => $fulfillment === 'delivery' ? $settings : null,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    return $cart + ['delivery' => $delivery, 'total' => $cart['subtotal'] + $delivery, 'fingerprint' => $fingerprint, 'settings' => $settings];
}

function mayReadOrder(array $order, array $identity): bool
{
    return ($identity['role'] ?? '') === 'admin' || ($order['userId'] !== null
        ? $order['userId'] === ($identity['userId'] ?? null)
        : hash_equals($order['guestHash'], $identity['guestHash'] ?? ''));
}

function safeOrder(array $order): array
{
    unset($order['guestHash'], $order['idempotencyKey']);
    $order['items'] = sqlAll('SELECT * FROM order_item WHERE order_id = ? ORDER BY rowid', [$order['id']]);
    return $order;
}

function orderDetails(string $id, array $identity): array
{
    $order = sqlOne('SELECT * FROM shop_order WHERE id = ?', [$id]);
    if (!$order || !mayReadOrder($order, $identity)) throw new ShopError('Заказ не найден', 404);
    return safeOrder($order);
}

function createOrder(string $cartId, array $identity, array $body): array
{
    $input = validateCheckout($body);
    return transaction(function () use ($cartId, $identity, $input) {
        $prior = sqlOne('SELECT * FROM shop_order WHERE idempotency_key = ?', [$input['idempotencyKey']]);
        if ($prior) {
            if (!mayReadOrder($prior, $identity)) throw new ShopError('Аккаунт изменился. Проверьте заказ и подтвердите его ещё раз.', 409, 'ATTEMPT_OWNER_CHANGED');
            return safeOrder($prior);
        }
        $current = quote($cartId, $input['fulfillment']);
        if (!hash_equals($current['fingerprint'], $input['fingerprint'])) throw new ShopError('Стоимость или состав заказа изменились. Проверьте обновлённую сумму и подтвердите заказ ещё раз.', 409, 'PRICE_CHANGED');
        $pickup = $input['fulfillment'] === 'pickup' ? sqlOne('SELECT * FROM location WHERE id = ?', [$input['locationId']]) : null;
        if ($input['fulfillment'] === 'pickup' && !$pickup) throw new ShopError('Выберите действующую пекарню');
        $id = uuid();
        $sequence = sqlOne('SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM shop_order')['next'];
        $number = 'JA-' . strtoupper(base_convert((string) nowMs(), 10, 36)) . '-' . strtoupper(substr($id, 0, 4));
        sqlRun('INSERT INTO shop_order (id, number, sequence, idempotency_key, user_id, guest_hash, name, phone, fulfillment, address, location_id, location_label, comment, subtotal, delivery, total, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            $id, $number, $sequence, $input['idempotencyKey'], $identity['userId'] ?? null, $identity['guestHash'],
            $input['name'], '+' . $input['phone'], $input['fulfillment'],
            $input['fulfillment'] === 'delivery' ? $current['settings']['city'] . ', ' . $input['address'] : null,
            $pickup['id'] ?? null, $pickup ? $pickup['title'] . ', ' . $pickup['address'] : null,
            $input['comment'], $current['subtotal'], $current['delivery'], $current['total'], 'pending', nowMs(),
        ]);
        foreach ($current['items'] as $item) {
            if ($item['stock'] !== null) {
                $changed = sqlRun('UPDATE product SET stock = stock - ? WHERE id = ? AND stock >= ?', [$item['quantity'], $item['productId'], $item['quantity']]);
                if (!$changed) throw new ShopError('Недостаточно товара «' . $item['name'] . '».', 409, 'OUT_OF_STOCK');
            }
            sqlRun('INSERT INTO order_item (id, order_id, product_id, name, variant_label, price, quantity, image, stock_tracked) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
                uuid(), $id, $item['productId'], $item['name'], $item['variantLabel'], $item['price'], $item['quantity'], $item['image'], $item['stock'] !== null,
            ]);
        }
        sqlRun('DELETE FROM cart_item WHERE cart_id = ?', [$cartId]);
        return orderDetails($id, $identity);
    });
}

function listOrders(array $identity, bool $admin = false): array
{
    if ($admin && ($identity['role'] ?? '') !== 'admin') throw new ShopError('Доступ только для администратора', 403);
    if (!$admin && empty($identity['userId'])) return [];
    $orders = $admin ? sqlAll('SELECT * FROM shop_order ORDER BY created_at DESC, rowid DESC')
        : sqlAll('SELECT * FROM shop_order WHERE user_id = ? ORDER BY created_at DESC, rowid DESC', [$identity['userId']]);
    return array_map('safeOrder', $orders);
}

function claimGuestOrders(array $identity): int
{
    if (empty($identity['userId'])) throw new ShopError('Войдите в аккаунт', 401);
    return sqlRun('UPDATE shop_order SET user_id = ? WHERE guest_hash = ? AND user_id IS NULL', [$identity['userId'], $identity['guestHash']]);
}

function updateOrderStatus(string $id, string $status): void
{
    transaction(function () use ($id, $status) {
        $order = sqlOne('SELECT * FROM shop_order WHERE id = ?', [$id]);
        if (!$order) throw new ShopError('Заказ не найден', 404);
        if (!canTransition($order['status'], $status, $order['fulfillment'])) throw new ShopError('Этот переход статуса недоступен');
        if ($status === 'cancelled') {
            foreach (sqlAll('SELECT * FROM order_item WHERE order_id = ? AND stock_tracked = 1', [$id]) as $item) {
                sqlRun('UPDATE product SET stock = stock + ? WHERE id = ? AND stock IS NOT NULL', [$item['quantity'], $item['productId']]);
            }
        }
        sqlRun('UPDATE shop_order SET status = ? WHERE id = ?', [$status, $id]);
    });
}
