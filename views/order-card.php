<?php $date = (new DateTimeImmutable('@'.(int)floor($order['createdAt']/1000)))->setTimezone(new DateTimeZone('Europe/Moscow'))->format('d.m.Y, H:i'); ?>
<article class="order-card">
<div class="order-top">
<h3>
<?= e($order['sequence'] === null ? $order['number'] : 'Заказ №'.$order['sequence']) ?>
</h3>
<span class="status-badge">
<?= e(uiStatusLabels()[$order['status']] ?? $order['status']) ?>
</span>
</div>
    <div class="order-info">
<p>
<?= e($date) ?> · <?= $order['fulfillment'] === 'pickup' ? 'Самовывоз' : 'Доставка' ?>
</p>
<?php if ($detailed): ?>
<p>
<?= e($order['locationLabel'] ?: $order['address']) ?>
</p>
<p>
<?= e($order['name']) ?> · <?= e($order['phone']) ?>
</p>
<?php if ($order['comment']): ?>
<p>Комментарий: <?= e($order['comment']) ?>
</p>
<?php endif; endif ?>
</div>
    <div class="summary-items">
<?php foreach ($order['items'] as $line): ?>
<div class="summary-item">
<span>
<?= e($line['name'].($line['variantLabel'] ? ', '.$line['variantLabel'] : '')) ?> × <?= (int)$line['quantity'] ?>
</span>
<strong>
<?= money($line['price']*$line['quantity']) ?>
</strong>
</div>
<?php endforeach ?>
</div>
    <?php if ($order['delivery'] > 0): ?>
<div class="summary-item">
<span>Доставка</span>
<span>
<?= money($order['delivery']) ?>
</span>
</div>
<?php endif ?>
<div class="total-row">
<span>Итого</span>
<strong>
<?= money($order['total']) ?>
</strong>
</div>
    <?php if (!$detailed): ?>
<a href="/orders/<?= e($order['id']) ?>" class="text-link top-space">Подробнее →</a>
<?php endif ?>
</article>
