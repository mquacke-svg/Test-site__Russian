<section class="container page-section">
<div class="account-head">
<div>
<span class="eyebrow">ВАШ ЛИЧНЫЙ КАБИНЕТ</span>
<h1 class="top-space">Бонжур, <?= e($person['name'] ?? '') ?>!</h1>
</div>
<form method="post" action="/action">
<?php formAction('logout','/') ?>
<button class="button button-outline">Выйти</button>
</form>
</div>
<div class="form-card spaced">
<p>Уже заказывали без регистрации в этом браузере?</p>
<form method="post" action="/action">
<?php formAction('orders_claim','/account') ?>
<button class="text-link top-space">Сохранить гостевые заказы в кабинете →</button>
</form>
</div>
<?php if (($person['role'] ?? '') === 'admin'): ?>
<p class="spaced">
<a class="text-link" href="/admin">Открыть административную панель →</a>
</p>
<?php endif ?>
<div class="section-heading split-heading">
<h2>Ваши заказы</h2>
<a class="text-link" href="/account">Обновить статусы</a>
</div>
<?php foreach (($pageData['orders'] ?? []) as $order) uiOrderCard($order) ?>
<?php if (empty($pageData['orders'])): ?>
<div class="empty-state">
<p>Ваша вкусная история ещё впереди.</p>
<a href="/menu" class="button">Открыть меню</a>
</div>
<?php endif ?>
</section>
