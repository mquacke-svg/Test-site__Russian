<?php
// Небольшие повторяющиеся элементы HTML. Данные всегда экранирует e().
function uiIcon(string $name, int $size = 20, float $stroke = 2): string
{
    // SVG paths: Lucide (ISC), license in public/icons-LICENSE.txt.
    $paths = [
        'arrow' => '<path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>',
        'arrow-up' => '<path d="M7 7h10v10"></path><path d="M7 17 17 7"></path>',
        'plus' => '<path d="M5 12h14"></path><path d="M12 5v14"></path>',
        'minus' => '<path d="M5 12h14"></path>',
        'close' => '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
        'menu' => '<path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h16"></path>',
        'search' => '<path d="m21 21-4.34-4.34"></path><circle cx="11" cy="11" r="8"></circle>',
        'bag' => '<path d="M16 10a4 4 0 0 1-8 0"></path><path d="M3.103 6.034h17.794"></path><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"></path>',
        'user' => '<circle cx="12" cy="8" r="5"></circle><path d="M20 21a8 8 0 0 0-16 0"></path>',
        'pin' => '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle>',
        'heart' => '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"></path>',
        'clock' => '<circle cx="12" cy="12" r="10"></circle><path d="M12 6v6h4"></path>',
        'wheat' => '<path d="M2 22 16 8"></path><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"></path><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"></path><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"></path><path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z"></path><path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"></path><path d="M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"></path><path d="M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"></path>',
        'store' => '<path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"></path><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"></path><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"></path>',
        'truck' => '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"></path><path d="M15 18H9"></path><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"></path><circle cx="17" cy="18" r="2"></circle><circle cx="7" cy="18" r="2"></circle>',
        'coffee' => '<path d="M10 2v2"></path><path d="M14 2v2"></path><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"></path><path d="M6 2v2"></path>',
        'cake' => '<path d="M16 13H3"></path><path d="M16 17H3"></path><path d="m7.2 7.9-3.388 2.5A2 2 0 0 0 3 12.01V20a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-8.654c0-2-2.44-6.026-6.44-8.026a1 1 0 0 0-1.082.057L10.4 5.6"></path><circle cx="9" cy="7" r="2"></circle>',
        'leaf' => '<path d="M11 20a10 10 0 0010-10 25.9 25.9 0 00-1.04-7.281 1 1 0 00-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0011 20"></path><path d="M2 21a5 5 0 012.911-4.544C7.613 15.212 8.351 15.24 11 13"></path>',
        'croissant' => '<path d="M10.2 18H4.774a1.5 1.5 0 0 1-1.352-.97 11 11 0 0 1 .132-6.487"></path><path d="M18 10.2V4.774a1.5 1.5 0 0 0-.97-1.352 11 11 0 0 0-6.486.132"></path><path d="M18 5a4 3 0 0 1 4 3 2 2 0 0 1-2 2 10 10 0 0 0-5.139 1.42"></path><path d="M5 18a3 4 0 0 0 3 4 2 2 0 0 0 2-2 10 10 0 0 1 1.42-5.14"></path><path d="M8.709 2.554a10 10 0 0 0-6.155 6.155 1.5 1.5 0 0 0 .676 1.626l9.807 5.42a2 2 0 0 0 2.718-2.718l-5.42-9.807a1.5 1.5 0 0 0-1.626-.676"></path>',
        'sandwich' => '<path d="m2.37 11.223 8.372-6.777a2 2 0 0 1 2.516 0l8.371 6.777"></path><path d="M21 15a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-5.25"></path><path d="M3 15a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h9"></path><path d="m6.67 15 6.13 4.6a2 2 0 0 0 2.8-.4l3.15-4.2"></path><rect width="20" height="4" x="2" y="11" rx="1"></rect>',
        'pot' => '<path d="M2 12h20"></path><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"></path><path d="m4 8 16-4"></path><path d="m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8"></path>',
        'cherry' => '<path d="M2 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z"></path><path d="M12 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z"></path><path d="M7 14c3.22-2.91 4.29-8.75 5-12 1.66 2.38 4.94 9 5 12"></path><path d="M22 9c-4.29 0-7.14-2.33-10-7 5.71 0 10 4.67 10 7Z"></path>',
        'trash' => '<path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>',
        'check' => '<circle cx="12" cy="12" r="10"></circle><path d="m16 9-5.5 5.5L8 12"></path>',
        'shield' => '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path>',
    ];
    return '<svg width="'.$size.'" height="'.$size.'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'.$stroke.'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'.($paths[$name] ?? $paths['croissant']).'</svg>';
}

function uiWave(bool $top = false): void
{
    echo '<svg class="wave '.($top ? 'wave-top' : '').'" viewBox="0 0 1440 65" preserveAspectRatio="none" aria-hidden="true"><path fill="var(--cream)" d="M0 25Q40 5 80 25Q120 45 160 27Q200 9 240 25Q280 41 320 27Q360 13 400 25Q440 37 480 27Q520 17 560 25Q600 33 640 27Q680 21 720 25Q760 29 800 27Q840 25 880 17Q920 9 960 27Q1000 45 1040 25Q1080 5 1120 27Q1160 49 1200 25Q1240 1 1280 27Q1320 53 1360 25Q1400 3 1440 25V65H0Z"/></svg>';
}

function uiFlower(string $class): void
{
    echo '<svg class="flower '.e($class).'" width="70" height="70" viewBox="0 0 70 70" aria-hidden="true">';
    foreach ([0, 72, 144, 216, 288] as $angle) echo '<ellipse cx="35" cy="19" rx="9" ry="17" fill="#f4c2a2" transform="rotate('.$angle.' 35 35)"/>';
    echo '<circle cx="35" cy="35" r="7" fill="#cf955c"/></svg>';
}

function uiStatusLabels(): array
{
    return ['pending'=>'Ожидает подтверждения','accepted'=>'Принят','preparing'=>'Готовится','ready'=>'Готов к выдаче','delivering'=>'Передан курьеру','completed'=>'Завершён','cancelled'=>'Отменён'];
}

function uiOrderCard(array $order, bool $detailed = false): void
{
    require ROOT.'/views/order-card.php';
}

function uiRubles(?int $price): string
{
    return $price === null ? '' : number_format($price / 100, 2, '.', '');
}

function uiReturnTo(): string
{
    $uri = $_SERVER['REQUEST_URI'] ?? '/menu';
    return str_starts_with($uri, '/') && !str_starts_with($uri, '//') ? $uri : '/menu';
}
