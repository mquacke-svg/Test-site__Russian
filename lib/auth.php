<?php
declare(strict_types=1);

function authConfig(string $key, string $default): string
{
    $value = getenv($key);
    return $value !== false && $value !== '' ? $value : (string) ($GLOBALS['config'][$key] ?? $default);
}

function authCookieOptions(int $expires): array
{
    return ['expires' => $expires, 'path' => '/',
        'secure' => parse_url(authConfig('APP_URL', 'http://127.0.0.1:3083'), PHP_URL_SCHEME) === 'https',
        'httponly' => true, 'samesite' => 'Lax'];
}

function startSession(): void
{
    static $cookieSentFor = null;
    if (session_status() !== PHP_SESSION_ACTIVE) {
        $directory = authConfig('SESSION_PATH', ROOT . '/.local/sessions');
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new RuntimeException('Не удалось создать каталог сессий.');
        }
        $resolved = realpath($directory);
        $public = realpath(ROOT . '/public');
        if ($resolved === false || ($public !== false &&
            (strcasecmp($resolved, $public) === 0 || str_starts_with(strtolower($resolved), strtolower($public . DIRECTORY_SEPARATOR))))) {
            throw new RuntimeException('Каталог сессий должен находиться вне public.');
        }
        session_save_path($resolved);
        session_name('bakery_session');
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_trans_sid', '0');
        ini_set('session.gc_maxlifetime', '604800');
        session_set_cookie_params(['lifetime' => 604800] + array_diff_key(authCookieOptions(0), ['expires' => true]));
        if (!session_start()) throw new RuntimeException('Не удалось открыть сессию.');
    }
    $now = time();
    // Проверяем срок сами: удаление старых файлов PHP выполняется не при каждом запросе.
    if (isset($_SESSION['_expires_at']) && (int) $_SESSION['_expires_at'] <= $now) {
        $_SESSION = [];
        if (!session_regenerate_id(true)) throw new RuntimeException('Не удалось обновить сессию.');
    }
    $_SESSION['_expires_at'] = $now + 604800;
    if ($cookieSentFor !== session_id()) {
        if (!setcookie(session_name(), session_id(), authCookieOptions($now + 604800))) {
            throw new RuntimeException('Не удалось сохранить сессию.');
        }
        $cookieSentFor = session_id();
    }
}

function identity(): array
{
    startSession();
    $guest = $_COOKIE['bakery_guest'] ?? '';
    if (!is_string($guest) || !preg_match('/^[a-f0-9]{64}$/D', $guest)) {
        $guest = bin2hex(random_bytes(32));
        setcookie('bakery_guest', $guest, authCookieOptions(time() + 30 * 86400));
        $_COOKIE['bakery_guest'] = $guest;
    }
    $person = ['guestHash' => hash('sha256', $guest)];
    if (isset($_SESSION['_user_id'])) {
        $statement = db()->prepare('SELECT id, name, username, email, role FROM user WHERE id = ?');
        $statement->execute([$_SESSION['_user_id']]);
        $user = $statement->fetch(PDO::FETCH_ASSOC);
        if ($user) {
            return $person + ['userId' => $user['id'], 'name' => $user['name'],
                'username' => $user['username'], 'email' => $user['email'], 'role' => $user['role']];
        }
        unset($_SESSION['_user_id']);
    }
    return $person;
}

function normalizedPassword(string $password): string
{
    if (!mb_check_encoding($password, 'UTF-8') || strlen($password) > 2048) {
        throw new ShopError('Некорректный пароль.');
    }
    $normalized = Normalizer::normalize($password, Normalizer::FORM_KC);
    if ($normalized === false) throw new ShopError('Некорректный пароль.');
    return $normalized;
}

// Формат Better Auth сохраняется и для новых аккаунтов: старый сайт сможет прочитать их при откате.
function hashUserPassword(string $password): string
{
    $salt = bin2hex(random_bytes(16));
    $key = scrypt(normalizedPassword($password), $salt, 16384, 16, 1, 64, false);
    if ($key === false) throw new RuntimeException('Не удалось обработать пароль.');
    return $salt . ':' . $key;
}

function verifyUserPassword(string $password, string $stored): bool
{
    if (!preg_match('/^([a-f0-9]{32}):([a-f0-9]{128})$/D', $stored, $parts)) return false;
    $key = scrypt(normalizedPassword($password), $parts[1], 16384, 16, 1, 64, false);
    return $key !== false && hash_equals($parts[2], $key);
}

function establishLogin(string $userId): void
{
    startSession();
    if (!session_regenerate_id(true)) throw new RuntimeException('Не удалось обновить сессию.');
    $_SESSION = ['_user_id' => $userId, '_expires_at' => time() + 604800,
        '_csrf' => bin2hex(random_bytes(32))];
}

function registerUser(string $login, string $password): void
{
    rateLimit('register:ip:' . ($_SERVER['REMOTE_ADDR'] ?? 'local'), 3, 60);
    $displayName = trim($login);
    $username = strtolower($displayName);
    if (!preg_match('/^[a-z0-9_.]{3,30}$/D', $username)) {
        throw new ShopError('Логин: от 3 до 30 латинских букв, цифр, точек или знаков подчёркивания.');
    }
    if (!mb_check_encoding($password, 'UTF-8') || $password === '' || mb_strlen($password, 'UTF-8') > 128) {
        throw new ShopError('Введите пароль длиной не более 128 символов.');
    }
    $email = bin2hex($username) . '@username.bakery.invalid';
    $hashed = hashUserPassword($password);
    $id = transaction(function () use ($username, $displayName, $email, $hashed): string {
        $check = db()->prepare('SELECT id FROM user WHERE lower(username) = ? OR lower(email) = ? LIMIT 1');
        $check->execute([$username, $email]);
        if ($check->fetch()) throw new ShopError('Этот логин уже занят.', 409, 'LOGIN_EXISTS');
        $id = uuid();
        $now = nowMs();
        db()->prepare('INSERT INTO user (id,name,username,email,email_verified,role,created_at,updated_at) VALUES (?,?,?,?,0,?,?,?)')
            ->execute([$id, $displayName, $username, $email, 'customer', $now, $now]);
        db()->prepare('INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
            ->execute([uuid(), $id, 'credential', $id, $hashed, $now, $now]);
        return $id;
    });
    establishLogin($id);
}

function loginUser(string $login, string $password, bool $admin = false): void
{
    $login = strtolower(trim($login));
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'local';
    rateLimit('login:ip:' . $ip, 30, 60);
    rateLimit('login:account:' . $login . ':ip:' . $ip, 10, 60);
    if ($admin && $login === 'admin') $login = 'admin@bakery.invalid';
    if ($login === '' || strlen($login) > 254 || strlen($password) > 2048) {
        throw new ShopError('Неверный логин или пароль.', 401, 'INVALID_LOGIN');
    }
    $column = str_contains($login, '@') ? 'email' : 'username';
    $statement = db()->prepare('SELECT u.id,u.role,a.password FROM user u LEFT JOIN account a ON a.user_id=u.id AND a.provider_id=\'credential\' WHERE lower(u.' . $column . ')=? LIMIT 1');
    $statement->execute([$login]);
    $user = $statement->fetch(PDO::FETCH_ASSOC);
    // Не ускоряем ответ для отсутствующего аккаунта: выполняем ту же дорогую проверку.
    $stored = $user['password'] ?? str_repeat('0', 32) . ':' . str_repeat('0', 128);
    if (!verifyUserPassword($password, $stored) || !$user) {
        throw new ShopError('Неверный логин или пароль.', 401, 'INVALID_LOGIN');
    }
    if ($admin && $user['role'] !== 'admin') throw new ShopError('Доступ только для администратора.', 403);
    establishLogin($user['id']);
}

function logoutUser(): void
{
    startSession();
    $_SESSION = [];
    session_destroy();
    setcookie('bakery_session', '', authCookieOptions(time() - 3600));
    unset($_COOKIE['bakery_session']);
    session_id('');
}

function csrfToken(): string
{
    startSession();
    if (!isset($_SESSION['_csrf'])) $_SESSION['_csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['_csrf'];
}

function checkCsrf(mixed $token): void
{
    if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D', $token) || !hash_equals(csrfToken(), $token)) {
        throw new ShopError('Страница устарела. Обновите её и повторите действие.', 403, 'INVALID_CSRF');
    }
    $origin = $_SERVER['HTTP_ORIGIN'] ?? null;
    if ($origin !== null && $origin !== rtrim(authConfig('APP_URL', 'http://127.0.0.1:3083'), '/')) {
        throw new ShopError('Запрос с другого сайта запрещён.', 403, 'INVALID_ORIGIN');
    }
}

function requireAdmin(array $person): void
{
    if (($person['role'] ?? null) !== 'admin') throw new ShopError('Доступ только для администратора.', 403);
}

function rateLimit(string $key, int $max, int $windowSeconds): void
{
    if ($max < 1 || $windowSeconds < 1) throw new InvalidArgumentException('Invalid rate limit.');
    $allowed = transaction(function () use ($key, $max, $windowSeconds): bool {
        $now = nowMs();
        db()->prepare('DELETE FROM auth_rate_limit WHERE expires_at <= ?')->execute([$now]);
        $key = hash('sha256', $key);
        $statement = db()->prepare('SELECT count FROM auth_rate_limit WHERE key = ?');
        $statement->execute([$key]);
        $count = $statement->fetchColumn();
        if ($count === false) {
            db()->prepare('INSERT INTO auth_rate_limit (key,count,expires_at) VALUES (?,1,?)')->execute([$key, $now + $windowSeconds * 1000]);
            return true;
        }
        if ((int) $count >= $max) return false;
        db()->prepare('UPDATE auth_rate_limit SET count=count+1 WHERE key=?')->execute([$key]);
        return true;
    });
    if (!$allowed) throw new ShopError('Слишком много попыток. Подождите немного и повторите.', 429, 'RATE_LIMIT');
}
