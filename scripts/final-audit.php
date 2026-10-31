<?php
if (PHP_SAPI !== 'cli' || count($argv) !== 3) exit(1);
$before = json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR);
$after = json_decode(file_get_contents($argv[2]), true, 512, JSON_THROW_ON_ERROR);
if ($after['integrity'] !== 'ok' || $after['foreignKeys']) exit(1);
foreach (['user','account','product','variant','category','location','setting','shop_order','order_item','notification'] as $table) {
    if ($before['tables'][$table] !== $after['tables'][$table]) throw new RuntimeException('Изменилась таблица: ' . $table);
}
echo "LIVE_DATA_UNCHANGED: accounts, passwords, products, settings, orders and their items\n";
