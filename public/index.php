<?php
declare(strict_types=1);

require dirname(__DIR__) . '/lib/bootstrap.php';
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
if (str_starts_with($path, '/uploads/')) serveUpload(substr($path, 9));

try {
    startSession();
    $person = identity();
    $cartId = resolveCart($person);
    if ($path === '/action' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $action = is_string($_POST['_action'] ?? null) ? $_POST['_action'] : '';
        if ($action === 'checkout' && isset($_POST['changeFulfillment'])) $action = 'checkout_mode';
        $defaults = ['login'=>'/login','register'=>'/login','logout'=>'/','checkout'=>'/checkout','orders_claim'=>'/account','admin_product'=>'/admin','admin_status'=>'/admin','admin_settings'=>'/admin','admin_upload'=>'/admin','cookies_accept'=>'/'];
        $returnTo = localReturn(is_string($_POST['returnTo'] ?? null) ? $_POST['returnTo'] : '', $defaults[$action] ?? '/cart');
        try {
            checkCsrf(is_string($_POST['csrf'] ?? null) ? $_POST['csrf'] : '');
            if (str_starts_with($action, 'admin_')) requireAdmin($person);
            switch ($action) {
                case 'checkout_mode':
                    $mode = $_POST['changeFulfillment'];
                    if (!in_array($mode, ['pickup', 'delivery'], true)) throw new ShopError('Выберите способ получения');
                    $draft = $_POST;
                    unset($draft['csrf'], $draft['password'], $draft['changeFulfillment']);
                    $draft['fulfillment'] = $mode;
                    $_SESSION['formOld'] = $draft;
                    redirectTo('/checkout?fulfillment=' . $mode);
                case 'register':
                    registerUser((string)($_POST['login'] ?? ''), (string)($_POST['password'] ?? ''));
                    resolveCart(identity());
                    redirectTo('/account');
                case 'login':
                    $isAdmin = ($_POST['admin'] ?? '') === '1';
                    loginUser((string)($_POST['login'] ?? ''), (string)($_POST['password'] ?? ''), $isAdmin);
                    resolveCart(identity());
                    redirectTo($isAdmin ? '/admin' : '/account');
                case 'logout': logoutUser(); redirectTo('/');
                case 'cart_add': case 'cart_update': case 'cart_remove': case 'cart_clear':
                    changeCart($cartId, [...$_POST, 'action' => substr($action, 5)]);
                    break;
                case 'checkout':
                    rateLimit('order:' . $person['guestHash'], 15, 600);
                    $order = createOrder($cartId, $person, [...$_POST, 'consent' => isset($_POST['consent'])]);
                    unset($_SESSION['checkoutKey'], $_SESSION['formOld']);
                    redirectTo('/orders/' . $order['id']);
                case 'orders_claim':
                    $count = claimGuestOrders($person);
                    $_SESSION['notice'] = 'Добавлено заказов в историю: ' . $count;
                    break;
                case 'admin_product':
                    $input = $_POST;
                    if (($_FILES['imageFile']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                        $input['image'] = saveUpload($_FILES['imageFile']);
                        $_POST['image'] = $input['image'];
                    }
                    saveProduct($input); $_SESSION['notice'] = 'Товар сохранён';
                    $returnTo = '/admin?product=' . rawurlencode((string)$_POST['id']);
                    break;
                case 'admin_status': updateOrderStatus((string)($_POST['orderId'] ?? ''), (string)($_POST['status'] ?? '')); break;
                case 'admin_settings': saveSettings($_POST); $_SESSION['notice'] = 'Условия доставки сохранены'; break;
                case 'admin_upload':
                    $url = saveUpload($_FILES['image'] ?? []);
                    $_SESSION['notice'] = 'Фотография загружена: ' . $url;
                    $_SESSION['uploadedImage'] = $url;
                    break;
                case 'cookies_accept':
                    $secure = str_starts_with(getenv('APP_URL') ?: ($config['APP_URL'] ?? ''), 'https://');
                    setcookie('bakery_cookie_notice', '1', ['expires'=>time()+31536000,'path'=>'/','secure'=>$secure,'httponly'=>true,'samesite'=>'Lax']);
                    break;
                default: throw new ShopError('Неизвестное действие', 404);
            }
            unset($_SESSION['formOld'], $_SESSION['formErrors']);
            redirectTo($returnTo);
        } catch (Throwable $error) {
            $safeOld = $_POST;
            unset($safeOld['password'], $safeOld['csrf']);
            if ($error instanceof ShopError && $error->errorCode === 'ATTEMPT_OWNER_CHANGED') {
                $_SESSION['checkoutKey'] = uuid();
                $safeOld['idempotencyKey'] = $_SESSION['checkoutKey'];
            }
            $_SESSION['formOld'] = $safeOld;
            if (!$error instanceof ShopError) error_log((string)$error);
            $_SESSION['formErrors'] = [$error instanceof ShopError ? $error->getMessage() : 'Не удалось выполнить действие. Данные формы сохранены — попробуйте ещё раз.'];
            redirectTo($returnTo);
        }
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'HEAD') throw new ShopError('Метод не поддерживается', 405);
    $catalog = getCatalog();
    $cart = getCart($cartId);
    $old = $_SESSION['formOld'] ?? [];
    $errors = $_SESSION['formErrors'] ?? [];
    $notice = $_SESSION['notice'] ?? '';
    unset($_SESSION['formOld'], $_SESSION['formErrors'], $_SESSION['notice']);
    $pageData = ['notice'=>$notice, 'uploadedImage'=>$_SESSION['uploadedImage'] ?? ''];
    $pageData['admin'] = ($_GET['admin'] ?? '') === '1';
    $pageData['register'] = ($_GET['register'] ?? '') === '1';
    unset($_SESSION['uploadedImage']);
    $page = match ($path) {
        '/' => 'home', '/menu'=>'menu', '/cart'=>'cart', '/checkout'=>'checkout',
        '/login'=>'login', '/account'=>'account', '/admin'=>'admin',
        '/privacy','/terms','/cookies'=>'legal', default=>str_starts_with($path, '/orders/') ? 'order' : 'error',
    };
    if ($page === 'error') throw new ShopError('Страница не найдена', 404);
    if ($page === 'account') {
        if (empty($person['userId'])) redirectTo('/login');
        $pageData['orders'] = listOrders($person);
    }
    if ($page === 'admin') {
        if (empty($person['userId'])) redirectTo('/login?admin=1');
        requireAdmin($person);
        $pageData['orders'] = listOrders($person, true);
        $productId = is_string($_GET['product'] ?? null) ? $_GET['product'] : '';
        $pageData['editingProduct'] = null;
        if ($productId && $productId !== 'new') {
            foreach ($catalog['products'] as $product) if ($product['id'] === $productId) $pageData['editingProduct'] = $product;
            if (!$pageData['editingProduct']) throw new ShopError('Товар не найден', 404);
        }
    }
    if ($page === 'checkout') {
        $fulfillment = $_GET['fulfillment'] ?? $old['fulfillment'] ?? 'pickup';
        if (!in_array($fulfillment, ['pickup','delivery'], true)) $fulfillment = 'pickup';
        $_SESSION['checkoutKey'] ??= uuid();
        $pageData['idempotencyKey'] = $old['idempotencyKey'] ?? $_SESSION['checkoutKey'];
        $pageData['fulfillment'] = $fulfillment;
        try { $pageData['quote'] = quote($cartId, $fulfillment); }
        catch (ShopError $error) { $errors[] = $error->getMessage(); $pageData['quote'] = null; }
    }
    if ($page === 'order') $pageData['order'] = orderDetails(substr($path, 8), $person);
    $pageData['path'] = $path;
    view($page, compact('catalog','person','cart','pageData','old','errors'));
} catch (Throwable $error) {
    $status = $error instanceof ShopError ? $error->status : 500;
    http_response_code($status);
    if (!$error instanceof ShopError) error_log((string)$error);
    $message = $error instanceof ShopError ? $error->getMessage() : 'Не удалось выполнить запрос. Попробуйте ещё раз.';
    if (is_file(ROOT . '/views/layout.php') && is_file(ROOT . '/views/error.php') && session_status() === PHP_SESSION_ACTIVE) {
        view('error', ['catalog'=>$catalog ?? ['products'=>[],'categories'=>[],'locations'=>[],'settings'=>[]], 'person'=>$person ?? [], 'cart'=>$cart ?? ['items'=>[],'count'=>0,'subtotal'=>0], 'pageData'=>['status'=>$status,'message'=>$message,'path'=>$path], 'old'=>[], 'errors'=>[$message]]);
    } else echo '<!doctype html><html lang="ru"><meta charset="utf-8"><title>Жак-Андрэ</title><h1>Жак-Андрэ</h1><p>' . e($message) . '</p><a href="/">На главную</a></html>';
}

