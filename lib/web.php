<?php
declare(strict_types=1);

function e(mixed $value): string { return htmlspecialchars((string)($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function money(?int $value): string {
    return $value === null ? 'Уточняйте в пекарне' : number_format($value / 100, $value % 100 ? 2 : 0, ',', ' ') . ' ₽';
}
function old(string $key, mixed $default = ''): mixed { return $GLOBALS['old'][$key] ?? $default; }
function csrfField(): void { echo '<input type="hidden" name="csrf" value="' . e(csrfToken()) . '">'; }
function formAction(string $action, string $returnTo = ''): void {
    csrfField();
    echo '<input type="hidden" name="_action" value="' . e($action) . '">';
    if ($returnTo !== '') echo '<input type="hidden" name="returnTo" value="' . e($returnTo) . '">';
}
function localReturn(string $path, string $fallback = '/'): string {
    if (preg_match('~^/(?:menu|cart|checkout|login|account|admin|privacy|terms|cookies|orders/[a-zA-Z0-9-]+)?(?:\?[^\r\n\\\\#]*)?(?:\#[a-z0-9-]+)?$~D', $path)) return $path;
    return $fallback;
}
function redirectTo(string $path): never {
    header('Location: ' . localReturn($path), true, 303);
    exit;
}
function view(string $page, array $data): void {
    extract($data, EXTR_SKIP);
    $GLOBALS['old'] = $old ?? [];
    if (is_file(ROOT . '/lib/view_helpers.php')) require_once ROOT . '/lib/view_helpers.php';
    ob_start();
    require ROOT . '/views/' . $page . '.php';
    $content = ob_get_clean();
    require ROOT . '/views/layout.php';
}
function serveUpload(string $name): never {
    if (!preg_match('/^[a-zA-Z0-9._-]+\.(webp|png|jpe?g)$/D', $name)) { http_response_code(404); exit; }
    $folder = realpath(getenv('UPLOADS_PATH') ?: ($GLOBALS['config']['UPLOADS_PATH'] ?? ROOT . '/.local/uploads'));
    $file = $folder ? realpath($folder . DIRECTORY_SEPARATOR . $name) : false;
    if (!$file || !is_file($file) || dirname($file) !== $folder) { http_response_code(404); exit; }
    header('Content-Type: ' . (new finfo(FILEINFO_MIME_TYPE))->file($file));
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: public, max-age=86400');
    readfile($file); exit;
}

