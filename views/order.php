<?php $order = $pageData['order']; ?>
<div class="container page-section order-page">
<div class="section-heading centered">
<div class="order-check">
<?= uiIcon('check',42) ?>
</div>
<span class="eyebrow">ТЕСТОВЫЙ ЗАКАЗ СОХРАНЁН</span>
<h1 class="top-space">Спасибо за ваш выбор!</h1>
<p class="top-space">Оплата при получении. <a href="/orders/<?= e($order['id']) ?>" class="text-link">Обновить статус</a>
</p>
</div>
<?php uiOrderCard($order, true) ?>
<p class="fine-print">Гостевой заказ доступен в этом браузере, пока сохранены технические cookies. Для истории заказов <a href="/account" class="text-link">войдите в кабинет</a>.</p>
<a href="/menu" class="button top-space">Ещё немного вкусного</a>
</div>
