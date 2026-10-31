<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/backup-lib.php';
try {
    echo 'Резервная копия: ' . createBakeryBackup(in_array('--server-stopped', $argv, true)) . PHP_EOL;
} catch (Throwable $error) { fwrite(STDERR, $error->getMessage() . PHP_EOL); exit(1); }
