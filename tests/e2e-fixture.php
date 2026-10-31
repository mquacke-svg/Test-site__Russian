<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
define('ROOT', dirname(__DIR__));
$request = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$command = $argv[1] ?? '';
$target = ROOT . '/.local/e2e.sqlite';
if (is_link($target)) throw new RuntimeException('Refusing linked test database');
putenv('DATABASE_PATH=' . $target);
putenv('UPLOADS_PATH=' . ROOT . '/.local/e2e-uploads');
putenv('SESSION_PATH=' . ROOT . '/.local/e2e-sessions');
require ROOT . '/lib/rules.php';
require ROOT . '/lib/db.php';
require ROOT . '/lib/shop.php';
require ROOT . '/lib/admin.php';
require ROOT . '/lib/auth.php';

if ($command === 'init') {
    if (!is_file(ROOT . '/.local/bakery.sqlite')) throw new RuntimeException('Run setup before browser tests');
    foreach (['', '-wal', '-shm'] as $suffix) if (is_file($target . $suffix) && !unlink($target . $suffix)) throw new RuntimeException('Stop the previous test server first');
    $source = new SQLite3(ROOT . '/.local/bakery.sqlite', SQLITE3_OPEN_READONLY);
    $destination = new SQLite3($target);
    if (!$source->backup($destination)) throw new RuntimeException('Test database snapshot failed');
    $source->close(); $destination->close();
    foreach (['e2e-uploads', 'e2e-sessions', 'e2e-results'] as $folder) if (!is_dir(ROOT . '/.local/' . $folder)) mkdir(ROOT . '/.local/' . $folder, 0700, true);
    db()->exec('CREATE TABLE IF NOT EXISTS auth_rate_limit (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL)');
    transaction(function () use ($request) {
        // Scrub private history/accounts only inside the isolated snapshot.
        foreach (['notification', 'order_item', 'shop_order', 'cart_item', 'cart', 'session', 'account', 'verification', 'user', 'auth_rate_limit'] as $table) db()->exec('DELETE FROM ' . $table);
        sqlRun('INSERT OR IGNORE INTO category (id,name,tagline,emoji) VALUES (?,?,?,?)', ['e2e-category', 'Проверка', 'Тест', '🥐']);
        $image = sqlOne("SELECT image FROM product WHERE image LIKE '/products/%' LIMIT 1")['image'] ?? null;
        foreach ([['e2e-pastry', 'Проверочный круассан', 10550], ['e2e-coffee', 'Проверочный кофе', null]] as [$id, $name, $price]) {
            sqlRun('INSERT OR REPLACE INTO product (id,name,category,price,image,available,stock) VALUES (?,?,?,?,?,?,?)', [$id, $name, 'e2e-category', $price, $image, 1, 100]);
        }
        sqlRun('INSERT OR REPLACE INTO variant (id,product_id,label,volume_ml,price) VALUES (?,?,?,?,?)', ['e2e-small', 'e2e-coffee', '200 мл', 200, 10000]);
        sqlRun('INSERT OR REPLACE INTO variant (id,product_id,label,volume_ml,price) VALUES (?,?,?,?,?)', ['e2e-large', 'e2e-coffee', '400 мл', 400, 20000]);
        saveSettings(['feeRub'=>'250','freeFromRub'=>'2000','minimumRub'=>'500','city'=>'Краснодар']);
        sqlRun('INSERT INTO user (id,name,username,email,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)', ['e2e-admin', 'Проверка', 'e2e.admin', 'e2e.admin@example.test', 'admin', nowMs(), nowMs()]);
        sqlRun('INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)', [uuid(),'e2e-admin','credential','e2e-admin',hashUserPassword($request['adminPassword']),nowMs(),nowMs()]);
    });
    $image = imagecreatetruecolor(32, 24);
    imagefill($image, 0, 0, imagecolorallocate($image, 160, 185, 153));
    imagepng($image, ROOT . '/.local/e2e-results/upload.png'); imagedestroy($image);
    echo json_encode(['database'=>$target,'adminLogin'=>'e2e.admin','image'=>ROOT . '/.local/e2e-results/upload.png']);
} elseif ($command === 'set-admin-password') {
    sqlRun('UPDATE account SET password=? WHERE user_id=? AND provider_id=?', [hashUserPassword($request['adminPassword']), 'e2e-admin', 'credential']);
    echo '{}';
} elseif ($command === 'state') {
    echo json_encode([
        'orders' => sqlOne('SELECT COUNT(*) AS count FROM shop_order')['count'],
        'pastry' => sqlOne('SELECT stock,price FROM product WHERE id = ?', ['e2e-pastry']),
        'coffee' => sqlOne('SELECT stock,price FROM product WHERE id = ?', ['e2e-coffee']),
        'settings' => getSettings(),
    ]);
} elseif ($command === 'set-price' || $command === 'set-stock') {
    $id = $request['id'] ?? 'e2e-pastry';
    if (!is_string($id) || !preg_match('/^e2e-[a-z0-9-]+$/D', $id)) throw new RuntimeException('Only test products may change');
    $value = integerValue($request['value'], 'Test value', 0, 1000000);
    sqlRun('UPDATE product SET ' . ($command === 'set-price' ? 'price' : 'stock') . ' = ? WHERE id = ?', [$value, $id]);
    echo '{}';
} elseif ($command === 'product') {
    $id = $request['id'] ?? '';
    if (!is_string($id) || !preg_match('/^e2e-[a-z0-9-]+$/D', $id)) throw new RuntimeException('Only test products may be inspected');
    $product = sqlOne('SELECT * FROM product WHERE id = ?', [$id]);
    if ($product) $product['variants'] = sqlAll('SELECT * FROM variant WHERE product_id = ?', [$id]);
    echo json_encode($product, JSON_THROW_ON_ERROR);
} else throw new RuntimeException('Unknown fixture action');
