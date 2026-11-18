<?php
declare(strict_types=1);
require_once __DIR__ . '/../../src/bootstrap.php';

$rawId = $_GET['id'] ?? null;
if (!is_string($rawId) || !preg_match('/^[1-9][0-9]*$/D', $rawId)) {
    api_error('INVALID_ID', 'ID sản phẩm phải là số nguyên dương hợp lệ.', 400);
}
$id = filter_var($rawId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if ($id === false) {
    api_error('INVALID_ID', 'ID sản phẩm phải là số nguyên dương hợp lệ.', 400);
}
$products = load_products($id);
if ($products === []) {
    api_error('PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.', 404);
}
json_response(['success' => true, 'data' => $products[0]]);
