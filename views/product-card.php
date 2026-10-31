<?php
$variants = $p['variants'];
$price = $variants ? min(array_column($variants, 'price')) : $p['price'];
$unavailable = !$p['available'] || $p['stock'] === 0 || $price === null;
$dialogId = 'product-'.preg_replace('/[^a-zA-Z0-9_-]/', '-', $p['id']);
?>
<div class="product-entry" data-category="<?= e($p['category']) ?>" data-search="<?= e($p['name'].' '.($p['description'] ?? '')) ?>">
<article class="product-card">
    <button type="button" class="product-photo" data-dialog="<?= e($dialogId) ?>" aria-label="Подробнее: <?= e($p['name']) ?>">
        <?php if ($p['image']): ?>
<img src="<?= e($p['image']) ?>" alt="" loading="lazy" class="object-cover fill-image">
<?php else: ?>
<span class="product-placeholder">ЖА</span>
<?php endif ?>
        <?php if (!$p['available'] || $p['stock'] === 0): ?>
<span class="product-badge">Скоро вернётся</span>
<?php elseif ($p['isBestseller']): ?>
<span class="product-badge">Наш любимчик</span>
<?php endif ?>
<span class="photo-arrow">
<?= uiIcon('arrow-up',17) ?>
</span>
    </button>
    <div class="product-info">
<button type="button" class="product-name" data-dialog="<?= e($dialogId) ?>">
<?= e($p['name']) ?>
</button>
        <?php if ($variants || $p['isSeasonal']): ?>
<p>
<?= e($variants ? implode(' / ', array_column($variants, 'label')) : 'Сезонная выпечка') ?>
</p>
<?php endif ?>
        <?php if ($p['stock'] === 0): ?>
<p>Нет в наличии</p>
<?php endif ?>
        <div class="product-bottom">
<strong>
<?= $price === null ? 'Цена уточняется' : (count($variants)>1 ? 'от ' : '').money($price) ?>
</strong>
            <?php if ($variants): ?>
<button type="button" class="add-button" data-dialog="<?= e($dialogId) ?>" aria-label="Добавить в корзину: <?= e($p['name']) ?>" <?= $unavailable ? 'disabled' : '' ?>>
<?= uiIcon('plus',18) ?>
</button>
            <?php else: ?>
<form method="post" action="/action">
<?php formAction('cart_add', uiReturnTo()) ?>
<input type="hidden" name="productId" value="<?= e($p['id']) ?>">
<input type="hidden" name="quantity" value="1">
<button class="add-button" aria-label="Добавить в корзину: <?= e($p['name']) ?>" <?= $unavailable ? 'disabled' : '' ?>>
<?= uiIcon('plus',18) ?>
</button>
</form>
<?php endif ?>
        </div>
    </div>
</article>
<dialog id="<?= e($dialogId) ?>" class="modal" aria-labelledby="<?= e($dialogId) ?>-title">
<div class="modal-inner">
<div class="modal-heading">
<h2 id="<?= e($dialogId) ?>-title">
<?= e($p['name']) ?>
</h2>
<button type="button" class="icon-button" data-close-dialog aria-label="Закрыть окно">
<?= uiIcon('close',24) ?>
</button>
</div>
    <form class="product-detail" method="post" action="/action">
<?php formAction('cart_add', uiReturnTo()) ?>
<input type="hidden" name="productId" value="<?= e($p['id']) ?>">
        <?php if ($p['image']): ?>
<div class="detail-photo">
<img src="<?= e($p['image']) ?>" alt="<?= e($p['name']) ?>" loading="lazy" class="object-cover fill-image">
</div>
<?php endif ?>
        <p>
<?= e($p['description'] ?: 'Свежая выпечка из нашей пекарни.') ?>
</p>
        <?php if ($p['stock'] === 0): ?>
<p>Нет в наличии</p>
<?php endif ?>
        <?php if ($variants): ?>
<fieldset class="variant-picker">
<legend>Выберите объём</legend>
<?php foreach ($variants as $i => $variant): ?>
<label class="<?= $i===0 ? 'selected' : '' ?>">
<input type="radio" name="variantId" value="<?= e($variant['id']) ?>" data-price="<?= e(money($variant['price'])) ?>" <?= $i===0 ? 'checked' : '' ?>>
<?= e($variant['label']) ?> · <?= money($variant['price']) ?>
</label>
<?php endforeach ?>
</fieldset>
<?php endif ?>
        <label class="form-field">Количество<input type="number" name="quantity" value="1" min="1" max="99" required>
</label>
        <button class="button full-width" data-product-submit <?= $unavailable ? 'disabled' : '' ?>>
<?= $unavailable ? ($price === null ? 'Цена уточняется' : 'Сейчас недоступен') : 'В корзину · '.money($variants[0]['price'] ?? $price) ?>
</button>
<p class="fine-print">Фотография иллюстрирует товар. Цены тестовые.</p>
    </form>
</div>
</dialog>
</div>
