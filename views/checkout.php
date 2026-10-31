<?php
$current = $pageData['quote'] ?? null;
$fulfillment = $pageData['fulfillment'] ?? 'pickup';
$settings = $current['settings'] ?? $catalog['settings'];
?>
<section class="container page-section">
<span class="eyebrow">ЕЩЁ ОДИН ШАГ ДО ВКУСНОГО ДНЯ</span>
<h1>Оформление заказа</h1>
<?php if (!$cart['count']): ?>
<div class="empty-state">
<h2>Сначала выберем что-нибудь вкусное</h2>
<p>Добавьте товары в корзину, чтобы оформить заказ.</p>
<a href="/menu" class="button">Перейти в меню</a>
</div>
<?php else: ?>
    <form method="post" action="/action" class="cart-layout" data-checkout-form>
        <?php formAction('checkout', '/checkout?fulfillment='.$fulfillment) ?>
        <input type="hidden" name="fulfillment" value="<?= e($fulfillment) ?>">
<input type="hidden" name="fingerprint" value="<?= e($current['fingerprint'] ?? '') ?>">
<input type="hidden" name="idempotencyKey" value="<?= e($pageData['idempotencyKey'] ?? '') ?>">
        <div class="form-card">
<h2>Как вам удобнее?</h2>
<div class="choice-row">
<button type="submit" name="changeFulfillment" value="pickup" formnovalidate class="choice-link <?= $fulfillment==='pickup' ? 'selected' : '' ?>" aria-pressed="<?= $fulfillment==='pickup' ? 'true' : 'false' ?>">
<?= uiIcon('store',18) ?> Самовывоз</button>
<button type="submit" name="changeFulfillment" value="delivery" formnovalidate class="choice-link <?= $fulfillment==='delivery' ? 'selected' : '' ?>" aria-pressed="<?= $fulfillment==='delivery' ? 'true' : 'false' ?>">
<?= uiIcon('truck',18) ?> Доставка</button>
</div>
            <?php if ($fulfillment === 'pickup'): ?>
<input type="hidden" name="address" value="<?= e(old('address')) ?>">
<label class="form-field">Ваша пекарня<select name="locationId" required>
<?php foreach ($catalog['locations'] as $location): ?>
<option value="<?= e($location['id']) ?>" <?= old('locationId') === $location['id'] ? 'selected' : '' ?>>
<?= e($location['address']) ?>
</option>
<?php endforeach ?>
</select>
<span class="fine-print">Ежедневно 08:00–21:00. Точное время подтвердит сотрудник. Вне рабочих часов — к ближайшему открытию.</span>
</label>
            <?php else: ?>
<input type="hidden" name="locationId" value="<?= e(old('locationId')) ?>">
<p class="muted spaced">Доставляем по городу <?= e($settings['city']) ?>. От <?= money($settings['minimum']) ?>, бесплатно от <?= money($settings['freeFrom']) ?>.</p>
<label class="form-field">Адрес в городе <?= e($settings['city']) ?>
<textarea name="address" required minlength="8" maxlength="400" placeholder="Улица, дом, квартира, подъезд" rows="3" autocomplete="street-address"><?= e(old('address')) ?></textarea>
</label>
<p class="fine-print spaced">Возможность доставки по адресу и время согласует сотрудник.</p>
<?php endif ?>
            <h2>Ваши контакты</h2>
<div class="form-grid">
<label class="form-field">Имя<input name="name" autocomplete="given-name" minlength="2" maxlength="100" required placeholder="Как к вам обращаться" value="<?= e(old('name')) ?>">
</label>
<label class="form-field">Телефон<input name="phone" type="tel" autocomplete="tel" required placeholder="+7 (___) ___-__-__" maxlength="25" value="<?= e(old('phone')) ?>">
</label>
</div>
            <label class="form-field">Комментарий к заказу<textarea name="comment" maxlength="1000" rows="3" placeholder="Пожелания, которые нам важно знать"><?= e(old('comment')) ?></textarea>
</label>
<p class="fine-print">Можно заказать без регистрации. <a href="/login" class="text-link">Войти</a> — чтобы сохранять заказы в личном кабинете.</p>
        </div>
        <aside class="cart-summary">
<h2 class="summary-title">Ваш вкусный заказ</h2>
<div class="summary-items">
<?php foreach (($current['items'] ?? $cart['items']) as $item): ?>
<div class="summary-item">
<span>
<?= e($item['name'].($item['variantLabel'] ? ', '.$item['variantLabel'] : '')) ?> × <?= (int)$item['quantity'] ?>
</span>
<strong>
<?= money(($item['price'] ?? 0)*$item['quantity']) ?>
</strong>
</div>
<?php endforeach ?>
</div>
<div class="summary-item">
<span>Получение</span>
<strong>
<?= $current ? ($current['delivery'] ? money($current['delivery']) : 'Бесплатно') : 'Не рассчитано' ?>
</strong>
</div>
<div class="total-row top-space">
<span>Итого</span>
<strong>
<?= $current ? money($current['total']) : '—' ?>
</strong>
</div>
<p class="inline-icon">
<?= uiIcon('shield',16) ?> Оплата при получении</p>
            <label class="checkbox-row">
<input type="checkbox" name="consent" required <?= old('consent') ? 'checked' : '' ?>>
<span>Ознакомлен(а) с <a href="/terms">условиями заказа</a> и <a href="/privacy">обработкой данных</a>. Это тестовый заказ.</span>
</label>
            <?php if (!$current): ?>
<p class="error">Проверьте товары и условия доставки. Оформление станет доступно после успешного расчёта.</p>
<a href="/cart" class="text-link spaced">Вернуться в корзину</a>
<?php endif ?>
            <button class="button full-width" type="submit" <?= !$current ? 'disabled' : '' ?>>Оформить тестовый заказ <span>→</span>
</button>
<p class="fine-print">После оформления заказ появится в админке со статусом «Ожидает подтверждения».</p>
        </aside>
    </form>
<?php endif ?>
</section>
