<section class="container page-section">
<div class="empty-state">
<span class="eyebrow">ЖАК-АНДРЭ</span>
<h1>
<?= e($pageData['heading'] ?? 'Страница недоступна') ?>
</h1>
<p>
<?= e($pageData['message'] ?? 'Попробуйте обновить страницу или вернитесь в меню.') ?>
</p>
<a href="/menu" class="button">Перейти в меню</a>
</div>
</section>
