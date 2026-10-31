param(
    [int]$Port = 3083,
    [string]$Php = (Join-Path $env:USERPROFILE '.codex\tools\php83\php.exe')
)
$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path -LiteralPath $Php -PathType Leaf)) { throw 'Не найден PHP. Укажите путь параметром -Php.' }
Push-Location -LiteralPath $projectDir
try {
    & $Php scripts/check-env.php
    if ($LASTEXITCODE -ne 0) { throw 'Проверка PHP не пройдена.' }
    $env:APP_URL = 'http://127.0.0.1:' + $Port
    Write-Host ('Сайт: ' + $env:APP_URL + ' ; остановка: Ctrl+C')
    & $Php -S ('127.0.0.1:' + $Port) -t public router.php
} finally {
    Pop-Location
}
