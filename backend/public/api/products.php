<?php
declare(strict_types=1);
require_once __DIR__ . '/../../src/bootstrap.php';

$products = load_products();
json_response(['success' => true, 'data' => $products, 'meta' => ['total' => count($products)]]);
