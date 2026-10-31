<?php
declare(strict_types=1);

define('ROOT', dirname(__DIR__));
$config = is_file(ROOT . '/.local/config.php') ? require ROOT . '/.local/config.php' : [];
if (!is_array($config)) throw new RuntimeException('Неверная конфигурация');
date_default_timezone_set('Europe/Moscow');
ini_set('display_errors', '0');
ini_set('log_errors', '1');
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/rules.php';
require_once __DIR__ . '/shop.php';
require_once __DIR__ . '/admin.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/web.php';

