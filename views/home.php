<?php
$featured = array_slice(array_values(array_filter($catalog['products'], fn($p) => $p['isBestseller'] && $p['available'])), 0, 4);
$settings = $catalog['settings'];
$picks = [
    ['Слоёное счастье','Хрустящая корочка. Нежное сердце.','/products/croissant-2.webp','/menu#pastry','sage'],
    ['Для сладких моментов','Десерты, ради которых стоит замедлиться.','/products/cake-strawberry.webp','/menu#desserts','peach'],
    ['Пауза на кофе','Ваш любимый ритуал — каждый день.','/products/coffee-heart-latte.webp','/menu#coffee','yellow'],
];
?>
<section class="hero-section">
<div class="hero-grain">
</div>
<div class="container hero-inner">
    <div class="hero-copy">
<span class="eyebrow">
<span class="tiny-line">
</span> БОНЖУР, КРАСНОДАР!</span>
<h1>Маленькие радости.<br>
<em>Каждый день.</em>
</h1>
<p>Аромат свежего хлеба, хруст тёплого круассана<br class="desktop-break"> и время для себя. Добро пожаловать в «Жак-Андрэ».</p>
        <div class="hero-buttons">
<a href="/menu" class="button button-peach">Выбрать что-то вкусное <?= uiIcon('arrow',19) ?>
</a>
<a href="#about" class="hero-story">Наша история <?= uiIcon('arrow-up',16) ?>
</a>
</div>
        <div class="hero-footnote">
<span class="round-mark">
<?= uiIcon('wheat',24,1.3) ?>
</span>
<span>Печём с любовью с 2014 года<br>
<strong>Свежая выпечка каждое утро</strong>
</span>
</div>
    </div>
    <div class="hero-art">
<div class="hero-circle">
</div>
<img src="/images/bakery-hero.png" alt="Композиция из золотистых круассанов, ягодной тарталетки и фисташкового эклера" width="1536" height="1024" fetchpriority="high">
<div class="hero-stamp">СЧАСТЬЕ<br>
<?= uiIcon('heart',22,1.4) ?>
<span>в каждом кусочке</span>
</div>
<span class="hero-caption">L’art de la gourmandise</span>
</div>
    <?php uiFlower('flower-hero') ?>
</div>
<?php uiWave() ?>
</section>
<section class="benefits-strip container">
<span>
<?= uiIcon('wheat',24) ?> Натуральные ингредиенты</span>
<span>
<?= uiIcon('heart',24) ?> Французские рецепты</span>
<span>
<?= uiIcon('clock',24) ?> Свежее каждый день</span>
<span>
<?= uiIcon('pin',24) ?> <?= count($catalog['locations']) ?> пекарни рядом</span>
</section>
<section class="section container">
<div class="section-heading centered">
<span class="eyebrow">МАЛЕНЬКОЕ УДОВОЛЬСТВИЕ — БОЛЬШАЯ РАДОСТЬ</span>
<h2>С чего начнётся ваш день?</h2>
<p>У каждого настроения есть свой вкус. Найдите ваш.</p>
</div>
<div class="editorial-grid">
    <?php foreach ($picks as $i => [$heading,$text,$image,$href,$color]): ?>
<a href="<?= e($href) ?>" class="editorial-card <?= e($color) ?>">
<span class="editorial-number">0<?= $i+1 ?>
</span>
<div class="editorial-image">
<img src="<?= e($image) ?>" alt="" class="object-cover fill-image" loading="lazy">
</div>
<div class="editorial-text">
<h3>
<?= e($heading) ?>
</h3>
<p>
<?= e($text) ?>
</p>
<span class="pill-link">Попробовать <?= uiIcon('arrow-up',15) ?>
</span>
</div>
</a>
<?php endforeach ?>
</div>
</section>
<section class="section bestsellers-section">
<div class="container">
<div class="section-heading split-heading">
<div>
<span class="eyebrow">ПРОВЕРЕНО ЛЮБОВЬЮ</span>
<h2>За ними возвращаются</h2>
</div>
<a href="/menu" class="text-link">Всё меню <?= uiIcon('arrow',18) ?>
</a>
</div>
<div class="category-links">
    <?php foreach ($catalog['categories'] as $i => $category): ?>
<a href="/menu#<?= e($category['id']) ?>">
<?= uiIcon(['croissant','cake','cake','sandwich','pot','cherry','coffee','leaf'][$i] ?? 'croissant',20,1.3) ?>
<?= e($category['name']) ?>
</a>
<?php endforeach ?>
</div>
<div class="product-grid">
<?php foreach ($featured as $p) require ROOT.'/views/product-card.php' ?>
</div>
</div>
</section>
<section id="about" class="about-section">
<?php uiWave(true) ?>
<div class="container about-grid">
<div class="about-photo">
<img src="/bakery-1.webp" alt="Витрина со свежей выпечкой в пекарне Жак-Андрэ" loading="lazy" class="object-cover fill-image">
<span class="photo-note">Всё начинается с любви.</span>
</div>
<div class="about-copy">
<span class="eyebrow">НЕ ПРОСТО ПЕКАРНЯ</span>
<h2>Французская душа.<br>
<em>Краснодарское сердце.</em>
</h2>
<p>Мы верим: для счастья не всегда нужен большой повод. Иногда достаточно тёплого круассана, хорошего кофе и улыбки за прилавком.</p>
<p>С 2014 года мы печём хлеб, готовим нежные десерты и встречаем вас в наших пекарнях. Вкладываем заботу в каждую деталь — от первого замеса до последней крошки.</p>
<a href="#locations" class="text-link">Загляните в гости <?= uiIcon('arrow-up',18) ?>
</a>
<div class="signature">С любовью, Жак-Андрэ</div>
</div>
<?php uiFlower('flower-about') ?>
</div>
<?php uiWave() ?>
</section>
<section id="delivery" class="section container">
<div class="section-heading centered">
<span class="eyebrow">МЫ ПОЗАБОТИЛИСЬ ОБО ВСЁМ</span>
<h2>Радость ближе, чем кажется</h2>
</div>
<div class="delivery-grid">
    <div class="delivery-card">
<?= uiIcon('store',34) ?>
<h3>Заберите по пути</h3>
<p>Выберите удобную пекарню. Мы подготовим заказ и согласуем время получения.</p>
<strong>Самовывоз — бесплатно</strong>
<a href="#locations" class="text-link">Найти пекарню <?= uiIcon('arrow',17) ?>
</a>
</div>
    <div class="delivery-card peach">
<?= uiIcon('truck',34) ?>
<h3>Привезём к вашему столу</h3>
<p>Доставка по <?= e($settings['city'] === 'Краснодар' ? 'Краснодару' : $settings['city']) ?> — <?= money($settings['fee']) ?>. Минимальная сумма товаров — <?= money($settings['minimum']) ?>.</p>
<strong>Бесплатно от <?= money($settings['freeFrom']) ?>
</strong>
<span class="fine-print">Адрес и время подтверждает сотрудник. Оплата при получении.</span>
</div>
</div>
</section>
<section id="locations" class="locations-section section">
<div class="container">
<div class="section-heading split-heading">
<div>
<span class="eyebrow">ВАША ПЕКАРНЯ РЯДОМ</span>
<h2>Приходите на аромат</h2>
</div>
<span class="muted">Краснодар · Каждый день</span>
</div>
<div class="locations-grid">
    <?php foreach ($catalog['locations'] as $i => $location): ?>
<article>
<span class="location-number">0<?= $i+1 ?>
</span>
<?= uiIcon('pin',23) ?>
<h3>
<?= e($location['title']) ?>
</h3>
<p>
<?= e($location['address']) ?>
</p>
<p class="muted">
<?= e($location['hours']) ?>
</p>
<?php if ($location['phone']): ?>
<a href="tel:<?= e($location['phoneRaw']) ?>" class="text-link">
<?= e($location['phone']) ?>
</a>
<?php endif ?>
</article>
<?php endforeach ?>
</div>
</div>
</section>
