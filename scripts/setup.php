<?php
// Подготавливает только служебную таблицу; каталог и аккаунты не изменяет.
require dirname(__DIR__) . '/lib/bootstrap.php';
if (PHP_SAPI !== 'cli') exit(1);
if (db()->query('PRAGMA integrity_check')->fetchColumn() !== 'ok') throw new RuntimeException('SQLite повреждена');
db()->exec('CREATE TABLE IF NOT EXISTS auth_rate_limit (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL)');
foreach (['uploads', 'sessions', 'backups'] as $folder) {
    if (!is_dir(ROOT . '/.local/' . $folder)) mkdir(ROOT . '/.local/' . $folder, 0700, true);
}
echo "База проверена. Служебная таблица готова. Каталог и аккаунты сохранены.\n";
