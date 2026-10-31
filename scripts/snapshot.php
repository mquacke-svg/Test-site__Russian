<?php
// Согласованный снимок SQLite, включая незавершённый checkpoint WAL.
if (PHP_SAPI !== 'cli' || count($argv) !== 3) exit("Usage: php snapshot.php source.sqlite new.sqlite\n");
if (!is_file($argv[1]) || file_exists($argv[2])) throw new RuntimeException('Источник отсутствует или копия уже существует');
$source = new SQLite3($argv[1], SQLITE3_OPEN_READONLY);
$source->busyTimeout(5000);
$target = new SQLite3($argv[2]);
if (!$source->backup($target) || $target->querySingle('PRAGMA integrity_check') !== 'ok') throw new RuntimeException('Не удалось проверить снимок');
$target->close(); $source->close();
echo "SQLite snapshot OK\n";
