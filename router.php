<?php
// Маршрутизатор только для локального встроенного PHP-сервера.
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
$public = realpath(__DIR__ . '/public');
$file = realpath($public . $path);
if ($file && is_file($file) && str_starts_with($file, $public . DIRECTORY_SEPARATOR)
    && preg_match('/\.(css|js|png|jpe?g|webp|svg|ico|woff2?|ttf)$/iD', $file)) return false;
require __DIR__ . '/public/index.php';

