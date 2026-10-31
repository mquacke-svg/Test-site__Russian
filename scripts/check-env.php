<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$failures = [];
if (PHP_VERSION_ID < 80300) $failures[] = 'Нужен PHP 8.3 или новее.';
foreach (['intl', 'pdo_sqlite', 'sqlite3', 'gd', 'mbstring', 'fileinfo', 'scrypt', 'session'] as $extension) {
    if (!extension_loaded($extension)) $failures[] = 'Не подключён модуль ' . $extension . '.';
}
if (!$failures) {
    $key = scrypt('pleaseletmein', 'SodiumChloride', 16384, 8, 1, 64);
    if ($key !== '7023bdcb3afd7348461c06cd81fd38ebfda8fbba904f8e3ea9b543f6545da1f2d5432955613f0fcf62d49705242a9af9e61e85dc0d651e40dfcf017b45575887') {
        $failures[] = 'Проверка стандартного scrypt-вектора не пройдена.';
    }
    if (!function_exists('imagewebp')) $failures[] = 'GD должен поддерживать WebP.';
}
if ($failures) {
    fwrite(STDERR, implode(PHP_EOL, $failures) . PHP_EOL);
    exit(1);
}
echo 'PHP ' . PHP_VERSION . ': все необходимые модули доступны; scrypt и WebP проверены.' . PHP_EOL;
