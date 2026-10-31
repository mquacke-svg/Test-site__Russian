<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/backup-lib.php';
try {
    $id = $argv[1] ?? '';
    $result = restoreBakeryBackup($id, in_array('--server-stopped', $argv, true));
    echo 'Восстановлена копия: ' . $result['restored'] . PHP_EOL;
    foreach ($result['safety'] as $name => $path) echo 'Сохранено прежнее состояние (' . $name . '): ' . $path . PHP_EOL;
} catch (Throwable $error) { fwrite(STDERR, $error->getMessage() . PHP_EOL); exit(1); }
