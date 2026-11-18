<?php
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('log_errors', '1');

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

function api_error(string $code, string $message, int $status): void
{
    json_response(['success' => false, 'error' => ['code' => $code, 'message' => $message]], $status);
}

set_exception_handler(static function (Throwable $exception): void {
    // Deliberately exclude exception messages, SQL, paths and credentials.
    error_log('Manga Store API: request failed (' . get_class($exception) . ').');
    api_error('INTERNAL_ERROR', 'Không thể xử lý yêu cầu.', 500);
});

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    api_error('METHOD_NOT_ALLOWED', 'Chỉ hỗ trợ phương thức GET.', 405);
}

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/ProductRepository.php';

function load_products(?int $id = null): array
{
    try {
        return (new ProductRepository(Database::connect()))->activeProducts($id);
    } catch (PDOException | RuntimeException $exception) {
        error_log('Manga Store API: database operation failed.');
        api_error('DATABASE_ERROR', 'Không thể tải dữ liệu.', 500);
    }
}
