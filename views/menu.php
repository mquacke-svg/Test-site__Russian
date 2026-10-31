<section class="page-banner">
<span class="eyebrow">ИСПЕЧЕНО С ЛЮБОВЬЮ</span>
<h1>Каждому дню — свой вкус</h1>
<p>От первого глотка кофе до последней крошки.</p>
<?php uiFlower('banner-flower'); uiWave() ?>
</section>
<div class="container catalog" data-catalog>
    <div class="catalog-controls">
<div class="filter-row" role="group" aria-label="Категории меню">
<button type="button" class="filter active" data-filter="all" aria-pressed="true">Всё меню</button>
<?php foreach ($catalog['categories'] as $category): ?>
<button type="button" class="filter" data-filter="<?= e($category['id']) ?>" aria-pressed="false">
<?= e($category['name']) ?>
</button>
<?php endforeach ?>
</div>
<label class="search-field">
<?= uiIcon('search',18) ?>
<input type="search" placeholder="Найти что-нибудь вкусное" aria-label="Поиск по меню" data-catalog-search>
<button type="button" data-clear-search aria-label="Очистить поиск" hidden>
<?= uiIcon('close',17) ?>
</button>
</label>
</div>
    <div class="catalog-count" aria-live="polite" data-catalog-count>
<?= count($catalog['products']) ?> позиций · Свежая выпечка каждый день</div>
    <div class="product-grid">
<?php foreach ($catalog['products'] as $p) require ROOT.'/views/product-card.php' ?>
</div>
    <div class="empty-state" data-catalog-empty hidden>
<h2>Пока ничего не нашлось</h2>
<p>Попробуйте другое название или категорию.</p>
<button type="button" class="button" data-reset-catalog>Показать всё меню</button>
</div>
</div>
