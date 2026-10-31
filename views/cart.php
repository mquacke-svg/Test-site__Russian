<section class="container page-section">
<span class="eyebrow">ПРИЯТНЫЕ МЕЛОЧИ УЖЕ РЯДОМ</span>
<h1>Ваша корзина</h1>
<?php if (!$cart['items']): ?>
    <div class="empty-state">
<?= uiIcon('bag',46) ?>
<h3>Здесь пока тихо</h3>
<p>Добавьте что-нибудь свежее к вашему дню.</p>
<a class="button" href="/menu">Выбрать выпечку</a>
</div>
<?php else: ?>
    <div class="cart-layout">
<div>
<div class="cart-toolbar">
<span>
<?= (int)$cart['count'] ?> шт.</span>
<form method="post" action="/action">
<?php formAction('cart_clear','/cart') ?>
<button class="text-button">Очистить корзину</button>
</form>
</div>
        <ul class="cart-list">
<?php foreach ($cart['items'] as $item): $itemLabel = $item['name'].($item['variantLabel'] ? ', '.$item['variantLabel'] : ''); ?>
            <li class="cart-line">
<?php if ($item['image']): ?>
<img src="<?= e($item['image']) ?>" alt="" width="90" height="90" class="cart-image">
<?php endif ?>
<div class="cart-line-info">
<strong>
<?= e($item['name']) ?>
</strong>
<?php if ($item['variantLabel']): ?>
<span class="muted">
<?= e($item['variantLabel']) ?>
</span>
<?php endif ?>
<span>
<?= $item['available'] ? money($item['price']) : 'Сейчас недоступен' ?>
</span>
                <form class="quantity" method="post" action="/action">
<?php formAction('cart_update','/cart') ?>
<input type="hidden" name="itemId" value="<?= e($item['id']) ?>">
<button name="quantity" value="<?= $item['quantity']-1 ?>" aria-label="Уменьшить количество: <?= e($itemLabel) ?>">
<?= uiIcon('minus',14) ?>
</button>
<span>
<?= (int)$item['quantity'] ?>
</span>
<button name="quantity" value="<?= $item['quantity']+1 ?>" aria-label="Увеличить количество: <?= e($itemLabel) ?>" <?= $item['quantity'] >= 99 ? 'disabled' : '' ?>>
<?= uiIcon('plus',14) ?>
</button>
</form>
            </div>
<div class="cart-line-end">
<strong>
<?= money(($item['price'] ?? 0)*$item['quantity']) ?>
</strong>
<form method="post" action="/action">
<?php formAction('cart_remove','/cart') ?>
<input type="hidden" name="itemId" value="<?= e($item['id']) ?>">
<button class="icon-button" aria-label="Удалить: <?= e($itemLabel) ?>">
<?= uiIcon('trash',17) ?>
</button>
</form>
</div>
</li>
        <?php endforeach ?>
</ul>
    </div>
<div class="cart-summary">
<div class="total-row">
<span>Товары</span>
<strong>
<?= money($cart['subtotal']) ?>
</strong>
</div>
<p class="muted">Самовывоз бесплатно. Стоимость доставки рассчитаем при оформлении.</p>
<a href="/checkout" class="button full-width">К оформлению <span>→</span>
</a>
<p class="fine-print">Оплата при получении · Тестовый заказ</p>
</div>
</div>
<?php endif ?>
</section>
