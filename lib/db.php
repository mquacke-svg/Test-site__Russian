<?php
declare(strict_types=1);

function db(): PDO
{
    static $connection = null;
    if ($connection instanceof PDO) return $connection;
    $path = getenv('DATABASE_PATH') ?: ($GLOBALS['config']['DATABASE_PATH'] ?? ROOT . '/.local/bakery.sqlite');
    if (!is_file($path)) throw new ShopError('База данных не найдена. Выполните настройку сайта.', 503);
    $connection = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_STRINGIFY_FETCHES => false,
    ]);
    $connection->exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL');
    return $connection;
}

function nowMs(): int { return (int) floor(microtime(true) * 1000); }

function uuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 15) | 64);
    $bytes[8] = chr((ord($bytes[8]) & 63) | 128);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

// The write lock is acquired before reading prices/stock, so competing checkouts serialize.
function transaction(callable $work): mixed
{
    static $depth = 0;
    $level = $depth;
    db()->exec($level === 0 ? 'BEGIN IMMEDIATE' : 'SAVEPOINT nested_' . $level);
    $depth++;
    try {
        $result = $work();
        db()->exec($level === 0 ? 'COMMIT' : 'RELEASE SAVEPOINT nested_' . $level);
        return $result;
    } catch (Throwable $error) {
        if ($level === 0) db()->exec('ROLLBACK');
        else {
            db()->exec('ROLLBACK TO SAVEPOINT nested_' . $level);
            db()->exec('RELEASE SAVEPOINT nested_' . $level);
        }
        throw $error;
    } finally {
        $depth--;
    }
}

function sqlStatement(string $sql, array $values = []): PDOStatement
{
    $statement = db()->prepare($sql);
    foreach (array_values($values) as $index => $value) {
        $type = $value === null ? PDO::PARAM_NULL : (is_int($value) || is_bool($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        $statement->bindValue($index + 1, is_bool($value) ? (int) $value : $value, $type);
    }
    $statement->execute();
    return $statement;
}

function camelRow(array $row): array
{
    $result = [];
    foreach ($row as $key => $value) {
        $key = preg_replace_callback('/_([a-z])/', fn($match) => strtoupper($match[1]), $key);
        if (in_array($key, ['available', 'isBestseller', 'isSeasonal', 'stockTracked', 'emailVerified'], true)) $value = (bool) $value;
        $result[$key] = $value;
    }
    return $result;
}

function sqlAll(string $sql, array $values = []): array
{
    return array_map('camelRow', sqlStatement($sql, $values)->fetchAll());
}

function sqlOne(string $sql, array $values = []): ?array
{
    $row = sqlStatement($sql, $values)->fetch();
    return $row === false ? null : camelRow($row);
}

function sqlRun(string $sql, array $values = []): int
{
    return sqlStatement($sql, $values)->rowCount();
}
