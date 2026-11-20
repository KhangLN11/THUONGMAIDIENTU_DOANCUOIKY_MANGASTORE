<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/ProductImageStorage.php';
$options = getopt('', ['source:', 'product-id:', 'write']);
if (!isset($options['source'], $options['product-id']) || !is_string($options['source']) || !is_string($options['product-id'])) {
    fwrite(STDERR, "Usage: php backend/scripts/store_product_image.php --source=photo.jpg --product-id=1 [--write]\nDefault is dry-run; --write copies a file but never inserts database rows.\n");
    exit(1);
}
try {
    $id = $options['product-id'];
    if (!preg_match('/^[1-9][0-9]*$/D', $id) || filter_var($id, FILTER_VALIDATE_INT) === false) {
        throw new InvalidArgumentException('Invalid product ID.');
    }
    $statement = Database::connect()->prepare('SELECT id FROM products WHERE id = :id');
    $statement->bindValue(':id', (int) $id, PDO::PARAM_INT);
    $statement->execute();
    if (!$statement->fetch()) {
        throw new InvalidArgumentException('Product does not exist.');
    }
    $storage = new ProductImageStorage(__DIR__ . '/../public/uploads/products');
    echo json_encode($storage->stage($options['source'], $id, array_key_exists('write', $options)), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
} catch (PDOException $error) {
    fwrite(STDERR, "Could not read product database.\n");
    exit(1);
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}
