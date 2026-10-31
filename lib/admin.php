<?php
declare(strict_types=1);

// Convert decimal text directly to integer kopecks; floating-point money is never used.
function rublesToCents(mixed $value, string $label, int $minimum = 0, int $maximum = 100000000): int
{
    if (!is_string($value) && !is_int($value)) throw new ShopError('Проверьте поле «' . $label . '».');
    $text = str_replace(',', '.', trim((string) $value));
    if (!preg_match('/^(\d{1,9})(?:\.(\d{1,2}))?$/D', $text, $parts)) throw new ShopError('В поле «' . $label . '» нужна сумма в рублях, максимум два знака после запятой.');
    $cents = (int) $parts[1] * 100 + (int) str_pad($parts[2] ?? '', 2, '0');
    if ($cents < $minimum || $cents > $maximum) throw new ShopError('Проверьте поле «' . $label . '».');
    return $cents;
}

function saveSettings(array $input): array
{
    $settings = [
        'fee' => rublesToCents($input['feeRub'] ?? '', 'Стоимость доставки', 0, 10000000),
        'freeFrom' => rublesToCents($input['freeFromRub'] ?? '', 'Бесплатная доставка от'),
        'minimum' => rublesToCents($input['minimumRub'] ?? '', 'Минимальная сумма'),
        'city' => textField($input, 'city', 'Город', 2, 100),
    ];
    sqlRun('INSERT INTO setting (id, value) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value', ['delivery', json_encode($settings, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
    return $settings;
}

function saveProduct(array $input): void
{
    $id = textField($input, 'id', 'Идентификатор товара', 1, 100);
    if (!preg_match('/^[a-z0-9-]+$/D', $id)) throw new ShopError('Идентификатор: латинские строчные буквы, цифры и дефис.');
    $name = textField($input, 'name', 'Название', 2, 180);
    $description = textField($input, 'description', 'Описание', 0, 1500);
    $category = textField($input, 'category', 'Категория', 1, 100);
    $image = textField($input, 'image', 'Изображение', 0, 255);
    if ($image !== '' && !preg_match('~^/(products|uploads)/[a-zA-Z0-9._-]+\.(webp|png|jpe?g)$~D', $image)) throw new ShopError('Некорректный адрес изображения');
    $priceText = $input['priceRub'] ?? '';
    $price = $priceText === '' || $priceText === null ? null : rublesToCents($priceText, 'Цена', 1);
    $stock = ($input['stock'] ?? '') === '' || ($input['stock'] ?? null) === null ? null : integerValue($input['stock'], 'Остаток', 0, 1000000);
    $expectedStock = ($input['expectedStock'] ?? '') === '' || ($input['expectedStock'] ?? null) === null ? null : integerValue($input['expectedStock'], 'Исходный остаток', 0, 1000000);
    $variants = $input['variants'] ?? [];
    if (!is_array($variants) || count($variants) > 20) throw new ShopError('Допустимо не более 20 вариантов товара');
    $parsed = [];
    foreach ($variants as $variant) {
        if (!is_array($variant)) throw new ShopError('Проверьте варианты товара');
        if (implode('', array_filter($variant, 'is_scalar')) === '') continue;
        $variantId = textField($variant, 'id', 'Идентификатор варианта', 1, 100);
        if (!preg_match('/^[a-z0-9-]+$/D', $variantId) || isset($parsed[$variantId])) throw new ShopError('Варианты должны иметь разные корректные идентификаторы');
        $parsed[$variantId] = [
            'id' => $variantId,
            'label' => textField($variant, 'label', 'Название варианта', 1, 60),
            'volumeMl' => integerValue($variant['volumeMl'] ?? '', 'Объём', 1, 10000),
            'price' => rublesToCents($variant['priceRub'] ?? '', 'Цена варианта', 1),
        ];
    }
    transaction(function () use ($input, $id, $name, $description, $category, $image, $price, $stock, $expectedStock, $parsed) {
        if (!sqlOne('SELECT id FROM category WHERE id = ?', [$category])) throw new ShopError('Категория не найдена');
        $existing = sqlOne('SELECT * FROM product WHERE id = ?', [$id]);
        if ($existing && checked($input['creating'] ?? false)) throw new ShopError('Товар с таким идентификатором уже существует', 409);
        if ($existing && (!array_key_exists('expectedStock', $input) || $existing['stock'] !== $expectedStock)) throw new ShopError('Остаток изменился. Обновите страницу и проверьте товар перед сохранением.', 409);
        foreach ($parsed as $variant) {
            $prior = sqlOne('SELECT product_id FROM variant WHERE id = ?', [$variant['id']]);
            if ($prior && $prior['productId'] !== $id) throw new ShopError('Идентификатор варианта занят другим товаром');
        }
        sqlRun('INSERT INTO product (id, name, description, category, price, image, available, stock, is_bestseller, is_seasonal)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, category=excluded.category,
            price=excluded.price, image=excluded.image, available=excluded.available, stock=excluded.stock,
            is_bestseller=excluded.is_bestseller, is_seasonal=excluded.is_seasonal', [
            $id, $name, $description === '' ? null : $description, $category, $price, $image === '' ? null : $image,
            checked($input['available'] ?? false), $stock, checked($input['isBestseller'] ?? false), checked($input['isSeasonal'] ?? false),
        ]);
        sqlRun('DELETE FROM variant WHERE product_id = ?', [$id]);
        foreach ($parsed as $variant) sqlRun('INSERT INTO variant (id, product_id, label, volume_ml, price) VALUES (?, ?, ?, ?, ?)', [$variant['id'], $id, $variant['label'], $variant['volumeMl'], $variant['price']]);
    });
}

function saveUpload(array $file): string
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_string($file['tmp_name'] ?? null) || !is_uploaded_file($file['tmp_name'])) throw new ShopError('Выберите изображение для загрузки');
    $path = $file['tmp_name'];
    if (filesize($path) > 5 * 1024 * 1024) throw new ShopError('Нужен JPEG, PNG или WebP до 5 МБ');
    $size = @getimagesize($path);
    if (!$size || !in_array($size['mime'], ['image/jpeg', 'image/png', 'image/webp'], true)) throw new ShopError('Нужен JPEG, PNG или WebP до 5 МБ');
    if ($size[0] < 1 || $size[1] < 1 || $size[0] * $size[1] > 25000000) throw new ShopError('Изображение слишком большое: максимум 25 миллионов пикселей');
    if (!function_exists('imagewebp')) throw new ShopError('Обработка изображений не настроена на сервере', 503);
    $source = @imagecreatefromstring(file_get_contents($path));
    if (!$source) throw new ShopError('Не удалось прочитать изображение');
    try {
        if ($size['mime'] === 'image/jpeg' && function_exists('exif_read_data')) {
            $exif = @exif_read_data($path);
            $orientation = $exif['Orientation'] ?? 1;
            if (in_array($orientation, [2, 4, 5, 7], true)) imageflip($source, IMG_FLIP_HORIZONTAL);
            $angle = match ($orientation) { 3, 4 => 180, 5, 6 => -90, 7, 8 => 90, default => 0 };
            if ($angle) {
                $rotated = imagerotate($source, $angle, 0);
                if ($rotated === false) throw new ShopError('Не удалось повернуть изображение');
                imagedestroy($source);
                $source = $rotated;
            }
        }
        $scale = min(1, 1200 / imagesx($source), 1200 / imagesy($source));
        $width = max(1, (int) round(imagesx($source) * $scale));
        $height = max(1, (int) round(imagesy($source) * $scale));
        $output = imagecreatetruecolor($width, $height);
        imagealphablending($output, false);
        imagesavealpha($output, true);
        imagecopyresampled($output, $source, 0, 0, 0, 0, $width, $height, imagesx($source), imagesy($source));
        $directory = getenv('UPLOADS_PATH') ?: ($GLOBALS['config']['UPLOADS_PATH'] ?? ROOT . '/.local/uploads');
        if (!is_dir($directory) && !mkdir($directory, 0700, true)) throw new ShopError('Не удалось создать каталог изображений', 500);
        $filename = uuid() . '.webp';
        try {
            if (!imagewebp($output, $directory . '/' . $filename, 85)) throw new ShopError('Не удалось сохранить изображение', 500);
        } finally {
            imagedestroy($output);
        }
        return '/uploads/' . $filename;
    } finally {
        imagedestroy($source);
    }
}
