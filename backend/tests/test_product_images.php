<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__ . '/../src/ProductRepository.php';
require_once __DIR__ . '/../src/ProductImageStorage.php';

function check(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}
// Isolated in-memory SQLite fixture; never connects to manga_store.
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE products (id INTEGER PRIMARY KEY, sku TEXT, slug TEXT, name_vi TEXT, name_en TEXT, description_vi TEXT, description_en TEXT, price_vnd INTEGER, sale_price_vnd INTEGER, stock_quantity INTEGER, category_id INTEGER, series_id INTEGER, status TEXT)');
$pdo->exec('CREATE TABLE categories (id INTEGER PRIMARY KEY, slug TEXT, name_vi TEXT, name_en TEXT)');
$pdo->exec('CREATE TABLE manga_series (id INTEGER PRIMARY KEY, slug TEXT, title TEXT)');
$pdo->exec('CREATE TABLE product_images (id INTEGER PRIMARY KEY, product_id INTEGER, image_url TEXT, alt_vi TEXT, alt_en TEXT, sort_order INTEGER, is_primary INTEGER)');
$pdo->exec("INSERT INTO products VALUES (1,'TEST-1','test-1','VI','EN',NULL,NULL,45000,NULL,10,NULL,NULL,'active'), (2,'TEST-2','test-2','VI','EN',NULL,NULL,50000,49000,0,NULL,NULL,'active'), (3,'TEST-3','test-3','VI','EN',NULL,NULL,10000,NULL,1,NULL,NULL,'draft')");
$pdo->exec("INSERT INTO product_images VALUES (30,1,'/third.png','Ba','Three',20,0), (20,1,'/main.png','Chinh','Main',10,1), (10,1,'/first.png',NULL,NULL,10,0), (40,3,'/draft.png',NULL,NULL,0,1)");
$repository = new ProductRepository($pdo);
$products = $repository->activeProducts();
check(count($products) === 2, 'Only active products');
check($products[0]['image_url'] === '/main.png', 'Primary image selection');
check(array_column($products[0]['images'], 'id') === [10, 20, 30], 'Stable gallery order');
check($products[0]['images'][1]['is_primary'] === true, 'Boolean primary flag');
check($products[0]['images'][0]['alt_vi'] === null, 'Null alt text');
check($products[1]['image_url'] === null && $products[1]['images'] === [], 'No-image state');
check($repository->activeProducts(1)[0] === $products[0], 'Detail and list agree');
check($repository->activeProducts(3) === [], 'Draft detail hidden');
$pdo->exec("INSERT INTO product_images VALUES (5,1,'/earlier-main.png',NULL,NULL,10,1)");
check($repository->activeProducts(1)[0]['image_url'] === '/earlier-main.png', 'Multiple primaries use sort_order/id tie-break');
$pdo->exec('UPDATE product_images SET is_primary=0 WHERE product_id=1');
check($repository->activeProducts(1)[0]['image_url'] === null && count($repository->activeProducts(1)[0]['images']) === 4, 'Gallery without a designated primary');
echo "PASS repository: gallery order/ties, primary selection, nulls, inactive products (isolated SQLite)\n";

// This local test fixture is not a catalog image and is never inserted into MySQL.
$temporary = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'manga-image-test-' . bin2hex(random_bytes(8));
mkdir($temporary);
$source = $temporary . DIRECTORY_SEPARATOR . 'source.png';
file_put_contents($source, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9xkAAAAASUVORK5CYII='));
$storageRoot = $temporary . DIRECTORY_SEPARATOR . 'storage';
mkdir($storageRoot);
$storage = new ProductImageStorage($storageRoot);
$created = [];
try {
    $dryRun = $storage->stage($source, '1');
    check(!$dryRun['written'] && !is_dir($storageRoot . DIRECTORY_SEPARATOR . '1'), 'Dry run writes nothing');
    $first = $storage->stage($source, '1', true);
    $created[] = $storageRoot . DIRECTORY_SEPARATOR . '1' . DIRECTORY_SEPARATOR . $first['filename'];
    $second = $storage->stage($source, '1', true);
    $created[] = $storageRoot . DIRECTORY_SEPARATOR . '1' . DIRECTORY_SEPARATOR . $second['filename'];
    check($first['filename'] !== $second['filename'], 'Unique names');
    check(hash_file('sha256', $created[0]) === hash_file('sha256', $source), 'File content preserved');
    check((bool) preg_match('/^[a-f0-9]{32}\.png$/D', $first['filename']), 'Safe generated filename');
    foreach (['../1', '0', '-1', '1/../../', '1.php'] as $invalidId) {
        try { $storage->stage($source, $invalidId, true); throw new LogicException('Unsafe ID accepted'); }
        catch (InvalidArgumentException $expected) {}
    }
    $unsafe = $temporary . DIRECTORY_SEPARATOR . 'unsafe.png';
    file_put_contents($unsafe, file_get_contents($source) . '<?php echo 1;');
    try { $storage->stage($unsafe, '1'); throw new LogicException('Embedded script accepted'); }
    catch (InvalidArgumentException $expected) {}
    file_put_contents($unsafe, '<svg xmlns="http://www.w3.org/2000/svg"/>');
    try { $storage->stage($unsafe, '1'); throw new LogicException('SVG accepted'); }
    catch (InvalidArgumentException $expected) {}
    file_put_contents($unsafe, str_repeat('x', 10 * 1024 * 1024 + 1));
    try { $storage->stage($unsafe, '1'); throw new LogicException('Oversize accepted'); }
    catch (InvalidArgumentException $expected) {}
    echo "PASS storage: dry-run, safe unique names, traversal, embedded PHP, SVG and size rejection\n";
} finally {
    // Delete only the exact files and empty directories created by this test.
    foreach ($created as $file) if (is_file($file)) unlink($file);
    if (is_dir($storageRoot . DIRECTORY_SEPARATOR . '1')) rmdir($storageRoot . DIRECTORY_SEPARATOR . '1');
    foreach ([$source, $temporary . DIRECTORY_SEPARATOR . 'unsafe.png'] as $file) if (is_file($file)) unlink($file);
    rmdir($storageRoot);
    rmdir($temporary);
}
