<?php
declare(strict_types=1);

// Изолированная БД и файлы сессий. Ни один тест не открывает рабочую базу.
ob_start();
define('ROOT', dirname(__DIR__));
$folder = sys_get_temp_dir() . '/bakery-auth-' . bin2hex(random_bytes(8));
mkdir($folder, 0700);
putenv('DATABASE_PATH=' . $folder . '/test.sqlite');
putenv('SESSION_PATH=' . $folder . '/sessions');
putenv('APP_URL=http://127.0.0.1:3083');
$_SERVER['REMOTE_ADDR'] = '127.0.0.20';
$_SERVER['HTTP_ORIGIN'] = 'http://127.0.0.1:3083';
$fixture = new PDO('sqlite:' . $folder . '/test.sqlite');
$fixture->exec(file_get_contents(__DIR__ . '/schema.sql'));
$fixture = null;
require ROOT . '/lib/rules.php';
require ROOT . '/lib/db.php';
require ROOT . '/lib/auth.php';

$checks = 0;
function expectAuth(bool $result, string $message): void
{
    global $checks;
    $checks++;
    if (!$result) throw new RuntimeException($message);
}
function expectAuthError(callable $work, int $status): void
{
    try { $work(); } catch (ShopError $error) {
        expectAuth($error->status === $status, 'Unexpected status: ' . $error->status);
        return;
    }
    throw new RuntimeException('Expected ShopError ' . $status);
}
function fixtureAccount(string $name, ?string $username, string $email, string $password, string $role = 'customer'): string
{
    $id = uuid();
    sqlRun('INSERT INTO user (id,name,username,email,email_verified,role,created_at,updated_at) VALUES (?,?,?,?,0,?,?,?)',
        [$id, $name, $username, $email, $role, nowMs(), nowMs()]);
    sqlRun('INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
        [uuid(), $id, 'credential', $id, hashUserPassword($password), nowMs(), nowMs()]);
    return $id;
}

try {
    // Векторы получены через node:crypto с теми же параметрами, что установленный Better Auth.
    $salt = '00112233445566778899aabbccddeeff';
    $vectors = [
        ['test-password-123', '48cca5d039aab5fab3f4ff0f92f631c47ac03e64d5623a9de371cfca112c44cfaea6687f56c9d3cf1be62b624ab1db671893a23cb88cc18cd93a337e5266cd60'],
        ['пароль-тест-123', '62b9c9620e89c0b07811459a372be4f74f9cad98db849a06f54e22c3b344f244590296401266bef87b93c549d08c33911f4e46321db22bdbd2fc867693315e3c'],
        ["Cafe\u{0301}-ＡＢＣ-123", '9a0a958110d8d3d93ded0381da55178dbedbf396957265fce79101b06e2e62443c713ba151e9eebe3b6e365b6fa3f6d4bbba087cd320fee686a94898e767f622'],
        ['Café-ABC-123', '9a0a958110d8d3d93ded0381da55178dbedbf396957265fce79101b06e2e62443c713ba151e9eebe3b6e365b6fa3f6d4bbba087cd320fee686a94898e767f622'],
    ];
    foreach ($vectors as [$password, $key]) {
        expectAuth(verifyUserPassword($password, $salt . ':' . $key), 'Legacy vector mismatch');
        expectAuth(!verifyUserPassword($password . 'x', $salt . ':' . $key), 'Wrong password accepted');
    }
    expectAuth(!verifyUserPassword('test-password-123', 'corrupted'), 'Corrupt hash accepted');
    $newHash = hashUserPassword('новый-пароль-123');
    expectAuth((bool) preg_match('/^[a-f0-9]{32}:[a-f0-9]{128}$/D', $newHash), 'New hash format');
    expectAuth(verifyUserPassword('новый-пароль-123', $newHash), 'New password verification');

    $_COOKIE['bakery_guest'] = str_repeat('a', 64);
    $guest = identity();
    expectAuth($guest['guestHash'] === hash('sha256', str_repeat('a', 64)), 'Existing guest cookie changed');
    expectAuth(!isset($guest['userId']), 'Guest became authenticated');
    $_COOKIE['bakery_guest'] = ['malformed'];
    expectAuth(strlen(identity()['guestHash']) === 64 && is_string($_COOKIE['bakery_guest']), 'Malformed guest cookie');
    $token = csrfToken();
    checkCsrf($token);
    expectAuthError(fn() => checkCsrf(str_repeat('0', 64)), 403);
    expectAuthError(fn() => checkCsrf(['bad']), 403);
    $_SERVER['HTTP_ORIGIN'] = 'https://other.example';
    expectAuthError(fn() => checkCsrf($token), 403);
    $_SERVER['HTTP_ORIGIN'] = 'http://127.0.0.1:3083';

    $priorSession = session_id();
    registerUser('Customer.One', 'new-password-123');
    $person = identity();
    expectAuth($person['username'] === 'customer.one' && $person['role'] === 'customer', 'Registration/role');
    expectAuth($person['email'] === bin2hex('customer.one') . '@username.bakery.invalid', 'Legacy technical email');
    expectAuth(session_id() !== $priorSession, 'Session fixation after registration');
    expectAuth(csrfToken() !== $token, 'CSRF not rotated at login');
    expectAuthError(fn() => checkCsrf($token), 403);
    $userId = $person['userId'];
    $credential = sqlOne('SELECT * FROM account WHERE user_id=?', [$userId]);
    expectAuth($credential['providerId'] === 'credential' && $credential['accountId'] === $userId, 'Rollback account compatibility');
    expectAuth($credential['createdAt'] > 1000000000000, 'Timestamp must be milliseconds');
    expectAuthError(fn() => registerUser('CUSTOMER.ONE', 'another-password'), 409);
    expectAuthError(fn() => registerUser('bad login', 'another-password'), 400);
    expectAuthError(fn() => registerUser('another', 'another-password'), 429);
    logoutUser();
    expectAuth(!isset(identity()['userId']), 'Logout did not end authentication');
    $priorSession = session_id();
    loginUser('CUSTOMER.ONE', 'new-password-123');
    expectAuth(identity()['userId'] === $userId && session_id() !== $priorSession, 'Case insensitive login/session rotation');
    expectAuthError(fn() => loginUser('customer.one', 'incorrect-password'), 401);
    expectAuthError(fn() => loginUser('customer.one', 'new-password-123', true), 403);
    expectAuthError(fn() => requireAdmin(identity()), 403);

    $_SESSION['_expires_at'] = time() - 1;
    expectAuth(!isset(identity()['userId']), 'Expired session allowed access');
    loginUser('customer.one', 'new-password-123');
    expectAuth($_SESSION['_expires_at'] >= time() + 604799, 'Sliding session expiry');
    sqlRun('UPDATE user SET role=? WHERE id=?', ['admin', $userId]);
    requireAdmin(identity());
    sqlRun('UPDATE user SET role=? WHERE id=?', ['customer', $userId]);
    expectAuthError(fn() => requireAdmin(identity()), 403);

    $legacy = fixtureAccount('Legacy', null, 'legacy@example.test', 'legacy-password');
    loginUser('LEGACY@EXAMPLE.TEST', 'legacy-password');
    expectAuth(identity()['userId'] === $legacy, 'Legacy email login');
    $admin = fixtureAccount('Admin', null, 'admin@bakery.invalid', 'admin-password-123', 'admin');
    loginUser('admin', 'admin-password-123', true);
    expectAuth(identity()['userId'] === $admin && identity()['role'] === 'admin', 'Admin alias');
    requireAdmin(identity());

    rateLimit('test-limit', 2, 60);
    rateLimit('test-limit', 2, 60);
    expectAuthError(fn() => rateLimit('test-limit', 2, 60), 429);
    sqlRun('UPDATE auth_rate_limit SET expires_at=? WHERE key=?', [nowMs() - 1, hash('sha256', 'test-limit')]);
    rateLimit('test-limit', 2, 60);
    expectAuth((int) sqlOne('SELECT count FROM auth_rate_limit WHERE key=?', [hash('sha256', 'test-limit')])['count'] === 1, 'Expired rate window');
    logoutUser();
    // Короткие пароли принимаются, пустой и слишком длинный — нет.
    $_SERVER['REMOTE_ADDR'] = '127.0.0.21';
    foreach (['я', '1234567', str_repeat('я', 128)] as $index => $password) {
        $username = 'length.' . $index;
        registerUser($username, $password);
        expectAuth(identity()['username'] === $username, 'Password length registration');
        logoutUser();
        loginUser($username, $password);
        expectAuth(identity()['username'] === $username, 'Password length login');
        logoutUser();
    }
    $_SERVER['REMOTE_ADDR'] = '127.0.0.22';
    foreach (['', str_repeat('я', 129), "\xFF"] as $password) {
        expectAuthError(fn() => registerUser('invalid.length', $password), 400);
    }
    $result = 'Auth: ' . $checks . ' checks passed.' . PHP_EOL;
} catch (Throwable $error) {
    $result = 'Auth FAILED: ' . $error->getMessage() . ' (' . basename($error->getFile()) . ':' . $error->getLine() . ')' . PHP_EOL;
    $failed = true;
} finally {
    if (session_status() === PHP_SESSION_ACTIVE) { $_SESSION = []; session_destroy(); }
    // Удаляется только уникальный временный каталог этого запуска; рабочие пути сюда не попадают.
    $resolved = realpath($folder);
    if ($resolved !== false && str_starts_with(strtolower($resolved), strtolower(realpath(sys_get_temp_dir()) . DIRECTORY_SEPARATOR . 'bakery-auth-'))) {
        $entries = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($resolved, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($entries as $entry) { if ($entry->isDir()) @rmdir($entry->getPathname()); else @unlink($entry->getPathname()); }
        @rmdir($resolved);
    }
}
ob_end_clean();
echo $result;
exit(isset($failed) ? 1 : 0);
