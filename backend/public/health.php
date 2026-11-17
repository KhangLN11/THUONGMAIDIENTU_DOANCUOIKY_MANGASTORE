<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
echo json_encode([
    'status' => 'ok',
    'service' => 'manga-store-local-api',
    'php_version' => PHP_VERSION,
    'database' => 'not_checked'
], JSON_UNESCAPED_UNICODE);
