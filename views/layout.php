<?php
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$title = $pageData['title'] ?? 'Жак-Андрэ — маленькие радости каждый день';
?>
<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
    <title>
<?= e($title) ?>
</title>
    <meta name="description" content="Французская пекарня в Краснодаре. Круассаны, десерты и кофе. Тестовый интернет-магазин с доставкой и самовывозом.">
    <meta name="robots" content="noindex,nofollow">
    <link rel="icon" href="/logo-mark.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/style.css?v=1">
    <script src="/app.js?v=1" defer>
</script>
</head>
<body>
<a href="#main" class="skip-link">Перейти к содержимому</a>
<div class="demo-bar">Тестовая версия <span>·</span> Заказы не передаются в пекарню</div>
<header class="site-header">
    <div class="container header-inner">
        <a href="/" class="brand" aria-label="Жак-Андрэ — главная">
<img src="/logo-mark.svg" alt="" width="50" height="50">
<span>Жак-Андрэ<small>ФРАНЦУЗСКАЯ ПЕКАРНЯ</small>
</span>
</a>
        <nav class="desktop-nav" aria-label="Основная навигация">
<a class="<?= $path === '/menu' ? 'active' : '' ?>" href="/menu">Наше меню</a>
<a href="/#about">О пекарне</a>
<a href="/#delivery">Доставка</a>
<a href="/#locations">Адреса</a>
</nav>
        <div class="header-actions">
            <span class="header-city">
<?= uiIcon('pin',15) ?> Краснодар</span>
            <a href="/account" class="icon-button" aria-label="Личный кабинет">
<?= uiIcon('user',21) ?>
</a>
            <a href="/cart" class="cart-button" aria-label="Корзина, товаров: <?= (int)($cart['count'] ?? 0) ?>">
<?= uiIcon('bag',19) ?>
<span class="cart-label">Корзина</span>
<span class="cart-count">
<?= (int)($cart['count'] ?? 0) ?>
</span>
</a>
            <button type="button" class="icon-button mobile-toggle" aria-label="Открыть меню" aria-expanded="false" aria-controls="mobile-navigation" data-menu-toggle>
<?= uiIcon('menu',24) ?>
</button>
        </div>
    </div>
    <nav id="mobile-navigation" class="mobile-navigation" aria-label="Мобильная навигация" hidden>
<a href="/menu">Наше меню</a>
<a href="/#about">О пекарне</a>
<a href="/#delivery">Доставка</a>
<a href="/#locations">Адреса</a>
</nav>
</header>
<main id="main">
    <?php if ($errors): ?>
<div class="container" role="alert">
<?php foreach ($errors as $error): ?>
<p class="error">
<?= e($error) ?>
</p>
<?php endforeach ?>
</div>
<?php endif ?>
    <?php if (!empty($pageData['notice'])): ?>
<div class="container">
<p class="success" role="status">
<?= e($pageData['notice']) ?>
</p>
</div>
<?php endif ?>
    <?= $content ?>
</main>
<footer class="site-footer">
    <div class="container footer-grid">
        <div>
<a href="/" class="footer-brand">
<img src="/logo-mark-light.svg" alt="" width="58" height="58">
<span>Жак-Андрэ</span>
</a>
<p>Маленькие радости.<br>Большая любовь к выпечке.</p>
</div>
        <div>
<h3>Загляните к нам</h3>
<a href="/menu">Наше меню <?= uiIcon('arrow-up',14) ?>
</a>
<a href="/#about">История пекарни</a>
<a href="/#locations">Адреса и часы работы</a>
</div>
        <div>
<h3>С заботой о вас</h3>
<a href="/#delivery">Доставка и самовывоз</a>
<a href="/account">Личный кабинет</a>
<a href="/terms">Условия заказа</a>
</div>
        <div>
<h3>Будем на связи</h3>
<a href="tel:+79183395390">+7 (918) 339-53-90</a>
<a href="mailto:info@jacques-andre.ru">info@jacques-andre.ru</a>
<p>Краснодар · Ежедневно 08:00–21:00</p>
</div>
    </div>
    <div class="container footer-bottom">
<span>© <?= date('Y') ?> Жак-Андрэ · Тестовый сайт</span>
<div>
<a href="/privacy">Конфиденциальность</a>
<a href="/cookies">Cookies</a>
<a href="/admin">Для сотрудников</a>
</div>
</div>
</footer>
<?php if (empty($_COOKIE['bakery_cookie_notice'])): ?>
<aside class="cookie-notice" aria-label="Использование cookies">
<div>
<strong>Немного cookies к вашему кофе</strong>
<p>Мы используем необходимые cookies для корзины и входа. <a href="/cookies">Подробнее</a>
</p>
</div>
<form method="post" action="/action">
<?php formAction('cookies_accept', uiReturnTo()) ?>
<button class="button button-small">Понятно</button>
</form>
</aside>
<?php endif ?>
</body>
</html>
