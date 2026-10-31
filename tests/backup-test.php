<?php
declare(strict_types=1);
require dirname(__DIR__) . '/scripts/backup-lib.php';

$folder = sys_get_temp_dir() . '/bakery-backup-' . bin2hex(random_bytes(8));
mkdir($folder, 0700);
mkdir($folder . '/uploads', 0700);
putenv('DATABASE_PATH=' . $folder . '/bakery.sqlite');
putenv('UPLOADS_PATH=' . $folder . '/uploads');
putenv('BACKUP_PATH=' . $folder . '/backups');
$checks = 0;
function expectBackup(bool $value, string $message): void
{
    global $checks;
    $checks++;
    if (!$value) throw new RuntimeException($message);
}
function expectBackupError(callable $work, string $contains): void
{
    try { $work(); } catch (Throwable $error) {
        expectBackup(str_contains($error->getMessage(), $contains), 'Unexpected error: ' . $error->getMessage());
        return;
    }
    throw new RuntimeException('Expected failure: ' . $contains);
}
function readTestValue(string $file): string
{
    $database = new SQLite3($file, SQLITE3_OPEN_READONLY);
    try { return (string) $database->querySingle('SELECT value FROM sample'); }
    finally { $database->close(); }
}

try {
    $database = new SQLite3($folder . '/bakery.sqlite');
    $database->exec("CREATE TABLE sample (value TEXT); INSERT INTO sample VALUES ('original')");
    $database->close();
    file_put_contents($folder . '/uploads/cake.webp', 'original image');
    file_put_contents($folder . '/secret.env', 'test-only-secret-not-for-backup');
    expectBackupError(fn() => createBakeryBackup(false), '--server-stopped');
    $id = createBakeryBackup(true);
    $snapshot = $folder . '/backups/' . $id;
    expectBackup(readTestValue($snapshot . '/database.sqlite') === 'original', 'Snapshot SQLite');
    expectBackup(file_get_contents($snapshot . '/uploads/cake.webp') === 'original image', 'Snapshot uploads');
    expectBackup(!file_exists($snapshot . '/secret.env'), 'Secret entered backup');
    $manifest = json_decode(file_get_contents($snapshot . '/manifest.json'), true, 512, JSON_THROW_ON_ERROR);
    expectBackup(count($manifest['files']) === 2, 'Unexpected snapshot files');
    expectBackupError(fn() => restoreBakeryBackup($id, false), '--server-stopped');
    expectBackupError(fn() => restoreBakeryBackup('../bakery.sqlite', true), 'Неверное имя');

    $database = new SQLite3($folder . '/bakery.sqlite');
    $database->exec("UPDATE sample SET value='new data'");
    $database->close();
    file_put_contents($folder . '/uploads/cake.webp', 'new image');
    file_put_contents($folder . '/uploads/extra.webp', 'extra image');
    $result = restoreBakeryBackup($id, true);
    expectBackup(readTestValue($folder . '/bakery.sqlite') === 'original', 'Restore SQLite');
    expectBackup(file_get_contents($folder . '/uploads/cake.webp') === 'original image', 'Restore uploads');
    expectBackup(!file_exists($folder . '/uploads/extra.webp'), 'Restore retained unintended file');
    expectBackup(readTestValue($result['safety']['database']) === 'new data', 'Safety copy lost recent DB records');
    expectBackup(file_get_contents($result['safety']['uploads'] . '/extra.webp') === 'extra image', 'Safety copy lost recent upload');

    file_put_contents($snapshot . '/uploads/cake.webp', 'tampered');
    expectBackupError(fn() => restoreBakeryBackup($id, true), 'Контрольная сумма');
    expectBackup(readTestValue($folder . '/bakery.sqlite') === 'original', 'Tampered restore changed live DB');
    file_put_contents($snapshot . '/uploads/cake.webp', 'original image');
    file_put_contents($snapshot . '/unlisted.txt', 'unexpected');
    expectBackupError(fn() => restoreBakeryBackup($id, true), 'Состав');
    unlink($snapshot . '/unlisted.txt');

    // Хеши не заменяют проверку самой SQLite: создаём корректный manifest с повреждённой БД.
    $databaseBytes = file_get_contents($snapshot . '/database.sqlite');
    file_put_contents($snapshot . '/database.sqlite', 'not a database');
    $manifest['files']['database.sqlite'] = hash_file('sha256', $snapshot . '/database.sqlite');
    file_put_contents($snapshot . '/manifest.json', json_encode($manifest, JSON_THROW_ON_ERROR));
    expectBackupError(fn() => restoreBakeryBackup($id, true), 'database');
    expectBackup(readTestValue($folder . '/bakery.sqlite') === 'original', 'Broken database replaced live DB');
    file_put_contents($snapshot . '/database.sqlite', $databaseBytes);
    $manifest['files']['database.sqlite'] = hash_file('sha256', $snapshot . '/database.sqlite');
    file_put_contents($snapshot . '/manifest.json', json_encode($manifest, JSON_THROW_ON_ERROR));

    // Старую повреждённую базу можно заменить, сохранив её байты для диагностики.
    file_put_contents($folder . '/bakery.sqlite', 'damaged current database');
    $result = restoreBakeryBackup($id, true);
    expectBackup(readTestValue($folder . '/bakery.sqlite') === 'original', 'Restore over damaged database');
    expectBackup(file_get_contents($result['safety']['database']) === 'damaged current database', 'Damaged database safety copy');

    putenv('BACKUP_PATH=' . $folder . '/uploads/nested-backups');
    expectBackupError(fn() => createBakeryBackup(true), 'пересекаться');
    putenv('BACKUP_PATH=' . $folder . '/backups');
    echo 'Backup: ' . $checks . ' checks passed.' . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, 'Backup FAILED: ' . $error->getMessage() . ' (' . basename($error->getFile()) . ':' . $error->getLine() . ')' . PHP_EOL);
    $failed = true;
} finally {
    $resolved = realpath($folder);
    if ($resolved !== false && str_starts_with(strtolower($resolved), strtolower(realpath(sys_get_temp_dir()) . DIRECTORY_SEPARATOR . 'bakery-backup-'))) {
        $walk = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($resolved, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($walk as $entry) { if ($entry->isDir()) rmdir($entry->getPathname()); else unlink($entry->getPathname()); }
        rmdir($resolved);
    }
}
exit(isset($failed) ? 1 : 0);
