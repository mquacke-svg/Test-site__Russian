<?php
$editId = is_string($_GET['product'] ?? null) ? $_GET['product'] : null;
$tab = $editId !== null ? 'products' : ($_GET['tab'] ?? 'orders');
if (!in_array($tab, ['orders','products','settings'], true)) $tab = 'orders';
$status = is_string($_GET['status'] ?? null) ? $_GET['status'] : 'all';
$editing = $pageData['editingProduct'] ?? null;
if (!$editing && $editId && $editId !== 'new') foreach ($catalog['products'] as $candidate) if ($candidate['id'] === $editId) $editing = $candidate;
$isNew = $editId === 'new';
if ($isNew) $editing = ['id'=>'','name'=>'','description'=>'','category'=>$catalog['categories'][0]['id'] ?? '', 'price'=>null,'image'=>'','stock'=>null,'available'=>true,'isBestseller'=>false,'isSeasonal'=>false,'variants'=>[]];
$labels = uiStatusLabels();
?>
<section class="container page-section admin-page">
<div class="account-head">
<div>
<span class="eyebrow">ЖАК-АНДРЭ · РАБОЧЕЕ МЕСТО</span>
<h1 class="top-space">Пекарня под контролем</h1>
</div>
<form method="post" action="/action">
<?php formAction('logout','/') ?>
<button class="button button-outline">Выйти</button>
</form>
</div>
<nav class="admin-tabs" aria-label="Разделы админки">
<?php foreach (['orders'=>'Заказы','products'=>'Каталог','settings'=>'Доставка'] as $key=>$text): ?>
<a class="filter <?= $tab===$key ? 'active' : '' ?>" href="/admin?tab=<?= $key ?>" <?= $tab===$key ? 'aria-current="page"' : '' ?>>
<?= e($text) ?>
</a>
<?php endforeach ?>
</nav>
<?php if ($tab === 'orders'): ?>
    <div class="admin-toolbar">
<form method="get" action="/admin" class="inline-form">
<input type="hidden" name="tab" value="orders">
<label class="form-field">Статус<select name="status">
<?php foreach (['all'=>'Все заказы']+$labels as $key=>$text): ?>
<option value="<?= e($key) ?>" <?= $status===$key ? 'selected' : '' ?>>
<?= e($text) ?>
</option>
<?php endforeach ?>
</select>
</label>
<button class="button button-small button-outline">Показать</button>
</form>
<a href="<?= e(uiReturnTo()) ?>" class="text-link">Обновить заказы</a>
</div>
    <?php $shownOrders = array_filter($pageData['orders'] ?? [], fn($o) => $status === 'all' || $o['status'] === $status); foreach ($shownOrders as $order): ?>
        <div class="admin-order-block">
<?php uiOrderCard($order, true) ?>
<div class="admin-order-actions">
<?php foreach ($labels as $next=>$label): if (!canTransition($order['status'],$next,$order['fulfillment'])) continue; ?>
<form method="post" action="/action">
<?php formAction('admin_status','/admin?tab=orders&status='.rawurlencode($status)) ?>
<input type="hidden" name="orderId" value="<?= e($order['id']) ?>">
<input type="hidden" name="status" value="<?= e($next) ?>">
<button class="button button-small button-outline">
<?= e($label) ?>
</button>
</form>
<?php endforeach ?>
</div>
</div>
    <?php endforeach; if (!$shownOrders): ?>
<div class="empty-state">
<h2>Заказов пока нет</h2>
<p>Новые заказы появятся здесь после оформления на сайте.</p>
</div>
<?php endif ?>
<?php elseif ($tab === 'products'): ?>
    <?php if ($editing):
        $editReturn = '/admin?tab=products&product='.rawurlencode($isNew ? 'new' : $editing['id']);
        $hasProductInput = old('_action') === 'admin_product';
        $value = fn($key,$default='') => $hasProductInput ? old($key,$default) : ($editing[$key] ?? $default);
        $check = fn($key) => $hasProductInput ? (bool)old($key,false) : (bool)($editing[$key] ?? false);
        $variants = $hasProductInput ? old('variants',[]) : array_map(fn($v) => $v+['priceRub'=>uiRubles($v['price'])], $editing['variants']);
    ?>
    <div class="section-heading split-heading">
<h2>
<?= $isNew ? 'Новый товар' : 'Редактировать товар' ?>
</h2>
<a href="/admin?tab=products" class="text-link">К списку товаров</a>
</div>
    <form method="post" action="/action" class="form-card product-editor" enctype="multipart/form-data">
        <?php formAction('admin_product',$editReturn) ?>
<input type="hidden" name="creating" value="<?= $isNew ? '1' : '0' ?>">
<input type="hidden" name="expectedStock" value="<?= e($hasProductInput ? old('expectedStock') : ($editing['stock'] ?? '')) ?>">
        <div class="form-grid">
<label class="form-field">Идентификатор (латиница и дефисы)<input name="id" required maxlength="100" pattern="[a-z0-9-]+" value="<?= e($value('id')) ?>" <?= !$isNew ? 'readonly' : '' ?>>
</label>
<label class="form-field">Название<input name="name" required minlength="2" maxlength="180" value="<?= e($value('name')) ?>">
</label>
</div>
        <label class="form-field">Описание<textarea name="description" rows="3" maxlength="1500"><?= e($value('description')) ?></textarea>
</label>
        <label class="form-field">Категория<select name="category" required>
<?php foreach ($catalog['categories'] as $category): ?>
<option value="<?= e($category['id']) ?>" <?= $value('category')===$category['id'] ? 'selected' : '' ?>>
<?= e($category['name']) ?>
</option>
<?php endforeach ?>
</select>
</label>
        <div class="form-grid">
<label class="form-field">Остаток, шт. (пусто — не указан)<input name="stock" type="number" min="0" max="1000000" step="1" value="<?= e($value('stock')) ?>">
<span class="fine-print">Остаток общий для всех объёмов.</span>
</label>
<label class="form-field">Цена, ₽ (пусто — цена уточняется)<input name="priceRub" type="number" min="0.01" max="1000000" step="0.01" value="<?= e($hasProductInput ? old('priceRub') : uiRubles($editing['price'])) ?>">
</label>
</div>
        <fieldset class="admin-variants">
<legend>Варианты напитка</legend>
<div data-variants>
            <?php foreach ($variants as $i => $variant): ?>
<div class="admin-variant variant-editor">
<input type="hidden" name="variants[<?= (int)$i ?>][id]" value="<?= e($variant['id']) ?>">
<label class="form-field">Название<input name="variants[<?= (int)$i ?>][label]" required maxlength="60" value="<?= e($variant['label']) ?>">
</label>
<label class="form-field">Объём, мл<input name="variants[<?= (int)$i ?>][volumeMl]" type="number" min="1" max="10000" required value="<?= e($variant['volumeMl']) ?>">
</label>
<label class="form-field">Цена, ₽<input name="variants[<?= (int)$i ?>][priceRub]" type="number" min="0.01" step="0.01" required value="<?= e($variant['priceRub']) ?>">
</label>
<button type="button" class="icon-button" data-remove-variant aria-label="Удалить вариант <?= e($variant['label']) ?>">
<?= uiIcon('close',17) ?>
</button>
</div>
<?php endforeach ?>
        </div>
<button type="button" class="text-link" data-add-variant>+ Добавить объём</button>
</fieldset>
        <?php if ($editing['image']): ?>
<img src="<?= e($editing['image']) ?>" alt="Текущее фото товара" width="140" height="140" class="editor-preview spaced">
<?php endif ?>
        <label class="form-field">Фото товара<input type="file" name="imageFile" accept="image/jpeg,image/png,image/webp">
<span class="fine-print">JPEG, PNG или WebP до 5 МБ. Фото загрузится при сохранении товара.</span>
</label>
<label class="form-field">Путь к изображению<input name="image" value="<?= e($value('image')) ?>" placeholder="/products/photo.webp">
<span class="fine-print">Оставьте текущий путь или выберите новое фото выше.</span>
</label>
        <div class="editor-checks">
<?php foreach (['available'=>'В продаже','isBestseller'=>'Наш любимчик','isSeasonal'=>'Сезонный товар'] as $key=>$label): ?>
<label class="checkbox-row">
<input type="checkbox" name="<?= e($key) ?>" value="1" <?= $check($key) ? 'checked' : '' ?>>
<?= e($label) ?>
</label>
<?php endforeach ?>
</div>
        <button class="button">Сохранить товар</button>
    </form>
    <?php else: ?>
        <p class="muted spaced">Учтено на складе: <?= (int)array_sum(array_column($catalog['products'],'stock')) ?> шт. Остаток не указан для <?= count(array_filter($catalog['products'],fn($p) => $p['stock']===null)) ?> товаров.</p>
<div class="admin-toolbar">
<label class="search-field">
<?= uiIcon('search',18) ?>
<input type="search" aria-label="Поиск товара в админке" placeholder="Найти товар" data-admin-search>
</label>
<a href="/admin?product=new" class="button">
<?= uiIcon('plus',17) ?> Добавить товар</a>
</div>
        <div class="admin-products">
<?php foreach ($catalog['products'] as $p): ?>
<div class="admin-product" data-admin-product="<?= e($p['name']) ?>">
<?php if ($p['image']): ?>
<img src="<?= e($p['image']) ?>" alt="" width="55" height="55" loading="lazy">
<?php endif ?>
<div>
<strong>
<?= e($p['name']) ?>
</strong>
<small>
<?= $p['variants'] ? 'от '.money(min(array_column($p['variants'],'price'))) : ($p['price']===null ? 'Цена не задана' : money($p['price'])) ?> · <?= $p['available'] ? 'В продаже' : 'Скрыт из продажи' ?> · <?= $p['stock']===null ? 'Остаток не указан' : 'Остаток: '.(int)$p['stock'].' шт.' ?>
</small>
</div>
<a href="/admin?product=<?= e(rawurlencode($p['id'])) ?>" class="button button-small button-outline">Редактировать</a>
</div>
<?php endforeach ?>
</div>
    <?php endif ?>
<?php else: $settings = $catalog['settings']; ?>
    <form class="form-card settings-form" method="post" action="/action">
<?php formAction('admin_settings','/admin?tab=settings') ?>
<h2>Доставка</h2>
<label class="form-field">Город<input name="city" value="<?= e(old('city',$settings['city'])) ?>" required maxlength="100">
</label>
        <?php foreach (['fee'=>'Стоимость доставки, ₽','freeFrom'=>'Бесплатная доставка от, ₽','minimum'=>'Минимальная сумма товаров для доставки, ₽'] as $key=>$label): ?>
<label class="form-field">
<?= e($label) ?>
<input name="<?= e($key) ?>Rub" type="number" min="0" max="1000000" step="0.01" value="<?= e(old($key.'Rub',uiRubles($settings[$key]))) ?>" required>
</label>
<?php endforeach ?>
<button class="button">Сохранить настройки</button>
    </form>
<?php endif ?>
</section>
