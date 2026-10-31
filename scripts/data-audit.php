<?php
// Выводит только количества и контрольные суммы таблиц, без личных данных.
if (PHP_SAPI !== 'cli' || count($argv) !== 2 || !is_file($argv[1])) exit(1);
$db = new SQLite3($argv[1], SQLITE3_OPEN_READONLY);
$db->busyTimeout(5000);
$result = ['integrity'=>$db->querySingle('PRAGMA integrity_check'), 'foreignKeys'=>[],'tables'=>[]];
$checks = $db->query('PRAGMA foreign_key_check');
while ($row = $checks->fetchArray(SQLITE3_ASSOC)) $result['foreignKeys'][] = $row;
$tables = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
while ($table = $tables->fetchArray(SQLITE3_ASSOC)) {
    $name = $table['name'];
    $rows = $db->query('SELECT * FROM "' . str_replace('"','""',$name) . '" ORDER BY rowid');
    $hash = hash_init('sha256'); $count = 0;
    while ($row = $rows->fetchArray(SQLITE3_ASSOC)) { hash_update($hash, json_encode($row, JSON_THROW_ON_ERROR) . "\n"); $count++; }
    $result['tables'][$name] = ['count'=>$count,'sha256'=>hash_final($hash)];
}
echo json_encode($result, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . "\n";
