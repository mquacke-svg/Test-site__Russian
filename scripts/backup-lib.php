<?php
declare(strict_types=1);

// Общие функции двух CLI-команд. Читаются только SQLite и uploads, конфигурация в архив не попадает.
function backupInside(string $path, string $parent): bool
{
    $path = str_replace('\\', '/', $path);
    $parent = rtrim(str_replace('\\', '/', $parent), '/');
    if (PHP_OS_FAMILY === 'Windows') { $path = strtolower($path); $parent = strtolower($parent); }
    return $path === $parent || str_starts_with($path, $parent . '/');
}

function backupAbsolutePath(string $path): string
{
    if (!preg_match('~^(?:[a-zA-Z]:[\\\\/]|/)~', $path)) $path = dirname(__DIR__) . '/' . $path;
    if (file_exists($path)) {
        $resolved = realpath($path);
        if ($resolved === false) throw new RuntimeException('Не удалось определить путь.');
        return $resolved;
    }
    $parent = realpath(dirname($path));
    if ($parent === false || in_array(basename($path), ['', '.', '..'], true)) {
        throw new RuntimeException('Родительский каталог не существует: ' . dirname($path));
    }
    return $parent . DIRECTORY_SEPARATOR . basename($path);
}

function backupPaths(): array
{
    $root = dirname(__DIR__);
    $config = is_file($root . '/.local/config.php') ? require $root . '/.local/config.php' : [];
    if (!is_array($config)) throw new RuntimeException('Неверная конфигурация.');
    $paths = [];
    foreach (['database' => ['DATABASE_PATH', $root . '/.local/bakery.sqlite'],
              'uploads' => ['UPLOADS_PATH', $root . '/.local/uploads'],
              'backups' => ['BACKUP_PATH', $root . '/.local/backups']] as $key => [$setting, $default]) {
        $paths[$key] = backupAbsolutePath(getenv($setting) ?: ($config[$setting] ?? $default));
    }
    foreach ($paths as $path) {
        if (backupInside($path, $root . '/public')) throw new RuntimeException('Данные и копии должны находиться вне public.');
    }
    if (backupInside($paths['backups'], $paths['uploads']) || backupInside($paths['uploads'], $paths['backups']) ||
        backupInside($paths['database'], $paths['uploads']) || backupInside($paths['database'], $paths['backups']) ||
        $paths['database'] === $paths['uploads']) {
        throw new RuntimeException('Каталоги uploads, backups и файл SQLite не должны пересекаться.');
    }
    if (file_exists($paths['uploads']) && !is_dir($paths['uploads'])) throw new RuntimeException('UPLOADS_PATH должен указывать на каталог.');
    if (file_exists($paths['database']) && !is_file($paths['database'])) throw new RuntimeException('DATABASE_PATH должен указывать на файл.');
    if (!is_dir($paths['backups']) && !mkdir($paths['backups'], 0700)) throw new RuntimeException('Не удалось создать каталог копий.');
    return $paths;
}

function backupFiles(string $directory): array
{
    $files = [];
    if (!is_dir($directory) || is_link($directory)) throw new RuntimeException('Неверный каталог: ' . $directory);
    $walk = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS));
    foreach ($walk as $entry) {
        if ($entry->isLink() || !$entry->isFile()) throw new RuntimeException('Ссылки и специальные файлы в копиях запрещены.');
        $relative = str_replace('\\', '/', substr($entry->getPathname(), strlen($directory) + 1));
        $files[$relative] = $entry->getPathname();
    }
    ksort($files);
    return $files;
}

function backupCopyTree(string $source, string $target): void
{
    if (!mkdir($target, 0700, true)) throw new RuntimeException('Не удалось создать временный каталог.');
    if (!is_dir($source)) return;
    foreach (backupFiles($source) as $relative => $file) {
        $destination = $target . '/' . $relative;
        if (!is_dir(dirname($destination)) && !mkdir(dirname($destination), 0700, true)) throw new RuntimeException('Не удалось создать подкаталог.');
        if (!copy($file, $destination)) throw new RuntimeException('Не удалось скопировать файл.');
    }
}

function backupCheckSqlite(string $file): void
{
    $database = new SQLite3($file, SQLITE3_OPEN_READONLY);
    $database->enableExceptions(true);
    try {
        if ($database->querySingle('PRAGMA integrity_check') !== 'ok') throw new RuntimeException('Проверка SQLite не пройдена.');
        $rows = $database->query('PRAGMA foreign_key_check');
        if ($rows->fetchArray(SQLITE3_NUM) !== false) throw new RuntimeException('Нарушены связи таблиц SQLite.');
        $rows->finalize();
    } finally { $database->close(); }
}

function backupLock(string $directory)
{
    $handle = fopen($directory . '/.operation.lock', 'c');
    if (!$handle || !flock($handle, LOCK_EX | LOCK_NB)) throw new RuntimeException('Другая операция с копиями уже выполняется.');
    return $handle;
}

function createBakeryBackup(bool $serverStopped): string
{
    if (!$serverStopped) throw new RuntimeException('Сначала остановите сайт; затем добавьте --server-stopped.');
    $paths = backupPaths();
    $lock = backupLock($paths['backups']);
    $id = gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4));
    $temporary = $paths['backups'] . '/.' . $id . '.partial';
    try {
        if (!is_file($paths['database']) || is_link($paths['database'])) throw new RuntimeException('Файл SQLite не найден или является ссылкой.');
        if (!mkdir($temporary, 0700)) throw new RuntimeException('Не удалось создать резервную копию.');
        $source = new SQLite3($paths['database'], SQLITE3_OPEN_READONLY);
        $destination = new SQLite3($temporary . '/database.sqlite');
        $source->enableExceptions(true);
        $destination->enableExceptions(true);
        try {
            if (!$source->backup($destination)) throw new RuntimeException('SQLite backup завершился ошибкой.');
        } finally { $destination->close(); $source->close(); }
        backupCheckSqlite($temporary . '/database.sqlite');
        backupCopyTree($paths['uploads'], $temporary . '/uploads');
        $hashes = [];
        foreach (backupFiles($temporary) as $relative => $file) $hashes[$relative] = hash_file('sha256', $file);
        $manifest = ['version' => 1, 'createdAt' => gmdate(DATE_ATOM), 'files' => $hashes];
        if (file_put_contents($temporary . '/manifest.json', json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)) === false) {
            throw new RuntimeException('Не удалось записать контрольные суммы.');
        }
        if (!rename($temporary, $paths['backups'] . '/' . $id)) throw new RuntimeException('Не удалось завершить резервную копию.');
        return $id;
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}

function restoreBakeryBackup(string $id, bool $serverStopped): array
{
    if (!$serverStopped) throw new RuntimeException('Сначала остановите сайт; затем добавьте --server-stopped.');
    if (!preg_match('/^\d{8}-\d{6}-[a-f0-9]{8}$/D', $id)) throw new RuntimeException('Неверное имя резервной копии.');
    $paths = backupPaths();
    $lock = backupLock($paths['backups']);
    $moves = [];
    try {
        $backup = $paths['backups'] . '/' . $id;
        if (!is_dir($backup) || is_link($backup) || !is_file($backup . '/manifest.json') || is_link($backup . '/manifest.json')) {
            throw new RuntimeException('Резервная копия не найдена.');
        }
        $manifest = json_decode(file_get_contents($backup . '/manifest.json'), true, 512, JSON_THROW_ON_ERROR);
        if (($manifest['version'] ?? null) !== 1 || !is_array($manifest['files'] ?? null) || !isset($manifest['files']['database.sqlite'])) {
            throw new RuntimeException('Неверный manifest резервной копии.');
        }
        $files = backupFiles($backup);
        unset($files['manifest.json']);
        if (array_keys($files) !== array_keys($manifest['files'])) throw new RuntimeException('Состав резервной копии изменён.');
        foreach ($manifest['files'] as $relative => $expected) {
            if (($relative !== 'database.sqlite' && !str_starts_with($relative, 'uploads/')) ||
                !is_string($expected) || !preg_match('/^[a-f0-9]{64}$/D', $expected) ||
                !hash_equals($expected, hash_file('sha256', $files[$relative]))) {
                throw new RuntimeException('Контрольная сумма резервной копии не совпадает.');
            }
        }
        backupCheckSqlite($backup . '/database.sqlite');
        $token = gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4));
        $stageDb = $paths['database'] . '.restore-' . $token;
        $stageUploads = $paths['uploads'] . '.restore-' . $token;
        if (!copy($backup . '/database.sqlite', $stageDb)) throw new RuntimeException('Не удалось подготовить SQLite.');
        backupCopyTree($backup . '/uploads', $stageUploads);
        backupCheckSqlite($stageDb);
        foreach (backupFiles($stageUploads) as $relative => $file) {
            if (!hash_equals($manifest['files']['uploads/' . $relative], hash_file('sha256', $file))) {
                throw new RuntimeException('Ошибка проверки подготовленных фотографий.');
            }
        }
        $safety = [];
        $move = function (string $from, string $to) use (&$moves): void {
            if (file_exists($to) || is_link($to) || !rename($from, $to)) throw new RuntimeException('Не удалось переименовать: ' . $from);
            $moves[] = [$from, $to];
        };
        foreach (['database' => $paths['database'], 'wal' => $paths['database'] . '-wal', 'shm' => $paths['database'] . '-shm', 'uploads' => $paths['uploads']] as $name => $current) {
            if (is_link($current)) throw new RuntimeException('Текущие данные не должны быть ссылками.');
            if (file_exists($current)) {
                $safety[$name] = $current . '.before-restore-' . $token;
                $move($current, $safety[$name]);
            }
        }
        $move($stageDb, $paths['database']);
        $move($stageUploads, $paths['uploads']);
        // Все прежние данные остаются рядом: их можно вернуть даже при повреждении старой SQLite.
        $report = ['restored' => $id, 'safety' => $safety];
        if (file_put_contents($paths['backups'] . '/restore-' . $token . '.json', json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)) === false) {
            throw new RuntimeException('Не удалось записать сведения об откате.');
        }
        return $report;
    } catch (Throwable $error) {
        $rollbackErrors = [];
        foreach (array_reverse($moves) as [$from, $to]) {
            if (!rename($to, $from)) $rollbackErrors[] = $to;
        }
        if ($rollbackErrors) throw new RuntimeException('Ошибка восстановления; сохранённые данные находятся: ' . implode(', ', $rollbackErrors), 0, $error);
        throw $error;
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}
