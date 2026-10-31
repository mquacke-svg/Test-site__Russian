<?php
$admin = !empty($pageData['admin']) || ($_GET['admin'] ?? '') === '1';
$register = !$admin && (!empty($pageData['register']) || ($_GET['register'] ?? '') === '1' || old('_action') === 'register');
$return = $admin ? '/login?admin=1' : ($register ? '/login?register=1' : '/login');
?>
<section class="container page-section">
<div class="section-heading centered">
<span class="eyebrow">ВАШ УГОЛОК В НАШЕЙ ПЕКАРНЕ</span>
<h1 class="top-space">Добро пожаловать</h1>
</div>
<div class="form-card login-card">
<h2>
<?= $admin ? 'Вход для сотрудников' : ($register ? 'Создать аккаунт' : 'Рады видеть вас снова') ?>
</h2>
<p class="muted">
<?= $admin ? 'Используйте аккаунт, созданный владельцем сайта.' : ($register ? 'Придумайте логин и пароль — и аккаунт готов.' : 'Войдите, чтобы ваши любимые покупки всегда были под рукой.') ?>
</p>
    <form method="post" action="/action">
<?php formAction($register ? 'register' : 'login', $return) ?>
<input type="hidden" name="admin" value="<?= $admin ? '1' : '0' ?>">
        <label class="form-field">
<?= $register ? 'Логин' : 'Логин или email' ?>
<input name="login" type="text" required autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="<?= $register ? '30' : '254' ?>" value="<?= e(old('login')) ?>" <?= $register ? 'minlength="3" pattern="[A-Za-z0-9_.]{3,30}" aria-describedby="login-hint"' : '' ?>>
</label>
        <?php if ($register): ?>
<p id="login-hint" class="fine-print spaced">От 3 до 30 латинских букв, цифр, точек или знаков подчёркивания.</p>
<?php endif ?>
        <label class="form-field">Пароль<input name="password" type="password" required maxlength="128" autocomplete="<?= $register ? 'new-password' : 'current-password' ?>">
</label>
<button class="button full-width">
<?= $admin ? 'Войти в админку' : ($register ? 'Зарегистрироваться' : 'Войти') ?>
</button>
    </form>
    <?php if (!$admin): ?>
<a href="<?= $register ? '/login' : '/login?register=1' ?>" class="text-link top-space">
<?= $register ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться' ?>
</a>
<?php endif ?>
<a href="/menu" class="text-link top-space">Продолжить без регистрации →</a>
</div>
</section>
