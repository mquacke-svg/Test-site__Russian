<?php
declare(strict_types=1);

class ShopError extends RuntimeException
{
    public function __construct(string $message, public int $status = 400, public string $errorCode = 'INVALID_REQUEST')
    {
        parent::__construct($message);
    }
}

function textField(array $input, string $key, string $label, int $minimum = 0, int $maximum = 1000, string $default = ''): string
{
    $value = $input[$key] ?? $default;
    if (!is_string($value)) throw new ShopError('Проверьте поле «' . $label . '».');
    $value = trim($value);
    $length = preg_match_all('/./us', $value);
    if ($length === false || $length < $minimum || $length > $maximum) throw new ShopError('Проверьте поле «' . $label . '».');
    return $value;
}

function integerValue(mixed $value, string $label, int $minimum, int $maximum): int
{
    if ((!is_int($value) && !is_string($value)) || !preg_match('/^-?\d{1,12}$/D', (string) $value)) throw new ShopError('Проверьте поле «' . $label . '».');
    $number = (int) $value;
    if ($number < $minimum || $number > $maximum) throw new ShopError('Проверьте поле «' . $label . '».');
    return $number;
}

function checked(mixed $value): bool { return in_array($value, [true, 1, '1', 'on'], true); }

function validateCheckout(array $input): array
{
    $name = textField($input, 'name', 'Имя', 2, 100);
    $phone = preg_replace('/\D/', '', textField($input, 'phone', 'Телефон', 1, 50));
    $phone = preg_replace('/^8(?=\d{10}$)/', '7', $phone);
    if (!preg_match('/^7\d{10}$/D', $phone)) throw new ShopError('Укажите российский телефон: +7 и 10 цифр');
    $fulfillment = textField($input, 'fulfillment', 'Способ получения', 1, 20);
    if (!in_array($fulfillment, ['pickup', 'delivery'], true)) throw new ShopError('Выберите способ получения');
    $locationId = textField($input, 'locationId', 'Пекарня', 0, 100);
    $address = textField($input, 'address', 'Адрес', $fulfillment === 'delivery' ? 8 : 0, 400);
    if ($fulfillment === 'pickup' && $locationId === '') throw new ShopError('Выберите пекарню');
    if (!checked($input['consent'] ?? false)) throw new ShopError('Подтвердите ознакомление с условиями');
    $fingerprint = textField($input, 'fingerprint', 'Подтверждение суммы', 64, 64);
    $idempotencyKey = textField($input, 'idempotencyKey', 'Номер попытки', 36, 36);
    if (!preg_match('/^[a-f0-9]{64}$/D', $fingerprint) || !preg_match('/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/Di', $idempotencyKey)) throw new ShopError('Обновите страницу оформления заказа.');
    return compact('name', 'phone', 'fulfillment', 'locationId', 'address', 'fingerprint', 'idempotencyKey') + [
        'comment' => textField($input, 'comment', 'Комментарий', 0, 1000),
    ];
}

function deliveryCost(int $subtotal, string $fulfillment, array $settings): int
{
    if ($fulfillment === 'pickup') return 0;
    if ($fulfillment !== 'delivery') throw new ShopError('Выберите способ получения');
    if ($subtotal < $settings['minimum']) throw new ShopError('Минимальная сумма доставки — ' . ($settings['minimum'] / 100) . ' ₽', 400, 'MINIMUM_ORDER');
    return $subtotal >= $settings['freeFrom'] ? 0 : $settings['fee'];
}

function canTransition(string $from, string $to, string $fulfillment): bool
{
    $next = [
        'pending' => ['accepted', 'cancelled'],
        'accepted' => ['preparing', 'cancelled'],
        'preparing' => [$fulfillment === 'pickup' ? 'ready' : 'delivering', 'cancelled'],
        'ready' => ['completed', 'cancelled'],
        'delivering' => ['completed', 'cancelled'],
        'completed' => [], 'cancelled' => [],
    ];
    return in_array($to, $next[$from] ?? [], true);
}
