<?php
declare(strict_types=1);
define('ROOT', dirname(__DIR__));
require ROOT . '/lib/rules.php';
require ROOT . '/lib/db.php';
require ROOT . '/lib/shop.php';
$request = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
putenv('DATABASE_PATH=' . $request['database']);
try {
    $order = createOrder($request['cartId'], $request['identity'], $request['body']);
    echo json_encode(['id' => $order['id']], JSON_THROW_ON_ERROR);
} catch (ShopError $error) {
    echo json_encode(['error' => $error->errorCode], JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage());
    exit(1);
}
