<?php
declare(strict_types=1);

/** Manifest validation and INSERT-only import planning. No functions write unless explicitly called. */
final class DemoCatalog
{
    public const PUBLIC_BASE = '/manga-store/backend/public/uploads/products';
    public static function read(string $path): array
    {
        $bytes = file_get_contents($path);
        if ($bytes === false) throw new RuntimeException('Cannot read manifest.');
        $manifest = json_decode($bytes, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($manifest) || ($manifest['version'] ?? null) !== 1) throw new RuntimeException('Unsupported manifest.');
        return $manifest;
    }

    public static function validate(array $manifest, string $base): array
    {
        $categories = []; $series = []; $skus = []; $slugs = []; $files = [];
        foreach ($manifest['categories'] ?? [] as $category) {
            self::slug($category['slug'] ?? '');
            foreach (['name_vi','name_en'] as $key) if (!is_string($category[$key] ?? null) || trim($category[$key]) === '' || mb_strlen($category[$key]) > 160) throw new RuntimeException('Invalid category name.');
            if (!is_int($category['sort_order'] ?? null)) throw new RuntimeException('Invalid category order.');
            if (isset($categories[$category['slug']])) throw new RuntimeException('Duplicate category slug.');
            $categories[$category['slug']] = true;
        }
        foreach ($manifest['series'] ?? [] as $item) {
            self::slug($item['slug'] ?? '');
            if (!is_string($item['title'] ?? null) || trim($item['title']) === '' || mb_strlen($item['title']) > 200) throw new RuntimeException('Invalid series title.');
            if (isset($series[$item['slug']])) throw new RuntimeException('Duplicate series slug.');
            $series[$item['slug']] = true;
        }
        if (empty($manifest['products'])) throw new RuntimeException('Empty catalog.');
        $validator = new ProductImageStorage(realpath(__DIR__ . '/../public/uploads/products'));
        $counts = [];
        foreach ($manifest['products'] as $product) {
            $sku = $product['sku'] ?? '';
            if (!preg_match('/^CAT-[A-Z0-9-]{1,59}$/D', $sku) || isset($skus[$sku])) throw new RuntimeException('Invalid/duplicate project SKU.');
            self::slug($product['slug'] ?? '');
            if (isset($slugs[$product['slug']])) throw new RuntimeException('Duplicate product slug.');
            $skus[$sku] = true; $slugs[$product['slug']] = true;
            if (!isset($categories[$product['category_slug']], $series[$product['series_slug']])) throw new RuntimeException('Unknown category or series.');
            foreach (['name_vi','name_en'] as $key) if (!is_string($product[$key] ?? null) || trim($product[$key]) === '' || mb_strlen($product[$key]) > 255) throw new RuntimeException('Invalid name: ' . $sku);
            foreach (['description_vi','description_en'] as $key) if (!is_string($product[$key] ?? null) || trim($product[$key]) === '' || strlen($product[$key]) > 65535) throw new RuntimeException('Invalid description.');
            if (!is_int($product['price_vnd']) || $product['price_vnd'] <= 0 || $product['price_vnd'] > 99999999999999) throw new RuntimeException('Invalid demo price.');
            $sale = $product['sale_price_vnd'];
            if ($sale !== null && (!is_int($sale) || $sale <= 0 || $sale > $product['price_vnd'])) throw new RuntimeException('Invalid demo sale price.');
            if (!is_int($product['stock_quantity']) || $product['stock_quantity'] < 0 || $product['stock_quantity'] > 4294967295) throw new RuntimeException('Invalid stock.');
            if ($product['status'] !== 'active' || !in_array($product['is_featured'], [0,1], true)) throw new RuntimeException('Invalid product status.');
            $primary = 0; $orders = [];
            foreach ($product['images'] ?? [] as $image) {
                if (($image['status'] ?? '') !== 'downloaded') throw new RuntimeException('Missing image: ' . $sku);
                if (!preg_match('/^[a-f0-9]{32}\.(jpg|png|webp)$/D', $image['filename'])) throw new RuntimeException('Unsafe filename.');
                if (isset($files[$image['filename']])) throw new RuntimeException('Duplicate file name.');
                $files[$image['filename']] = true;
                if (!is_bool($image['is_primary']) || !is_int($image['sort_order']) || $image['sort_order'] < 0 || isset($orders[$image['sort_order']])) throw new RuntimeException('Invalid image ordering.');
                $orders[$image['sort_order']] = true;
                foreach (['alt_vi','alt_en'] as $key) if (!is_string($image[$key]) || mb_strlen($image[$key]) > 255) throw new RuntimeException('Invalid alt text.');
                $primary += (int) $image['is_primary'];
                $source = self::assetPath($base, $sku, $image['filename']);
                if (!hash_equals($image['sha256'], hash_file('sha256', $source))) throw new RuntimeException('Image hash mismatch: ' . $sku);
                $validator->stage($source, '1', false); // Existing validation; no file copy or PDO writes.
            }
            if ($primary !== 1) throw new RuntimeException('Exactly one primary image is required: ' . $sku);
            $counts[$product['category_slug']] = ($counts[$product['category_slug']] ?? 0) + 1;
        }
        return ['products' => count($skus), 'images' => count($files), 'by_category' => $counts];
    }

    private static function slug(string $slug): void
    {
        if (strlen($slug) > 160 || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $slug)) throw new RuntimeException('Invalid slug.');
    }

    public static function assetPath(string $base, string $sku, string $filename): string
    {
        if (!preg_match('/^CAT-[A-Z0-9-]+$/D', $sku) || !preg_match('/^[a-f0-9]{32}\.(jpg|png|webp)$/D', $filename)) throw new RuntimeException('Unsafe asset path.');
        $directory = realpath($base . '/assets/' . $sku);
        $file = realpath($base . '/assets/' . $sku . '/' . $filename);
        $assetRoot = realpath($base . '/assets');
        if (!$directory || !$file || !$assetRoot || dirname($directory) !== $assetRoot || dirname($file) !== $directory || is_link($file) || !is_file($file)) throw new RuntimeException('Asset outside bundle.');
        return $file;
    }

    public static function query(PDO $pdo, string $sql, array $values = []): array
    {
        $statement = $pdo->prepare($sql);
        $statement->execute($values);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function plan(PDO $pdo, array $manifest): array
    {
        $result = ['new_categories'=>0,'new_series'=>0,'new_products'=>0,'new_images'=>0,'existing_products'=>0,'conflicts'=>[],'legacy_policy'=>'UNCHANGED: no UPDATE or DELETE'];
        foreach ($manifest['categories'] as $category) {
            $rows = self::query($pdo, 'SELECT * FROM categories WHERE slug=?', [$category['slug']]);
            if (!$rows) $result['new_categories']++;
            elseif (!(int) $rows[0]['is_active']) $result['conflicts'][] = 'Inactive category: ' . $category['slug'];
        }
        foreach ($manifest['series'] as $series) {
            $rows = self::query($pdo, 'SELECT * FROM manga_series WHERE slug=?', [$series['slug']]);
            if (!$rows) $result['new_series']++;
            elseif ($rows[0]['title'] !== $series['title'] || !(int) $rows[0]['is_active']) $result['conflicts'][] = 'Series differs: ' . $series['slug'];
        }
        foreach ($manifest['products'] as $product) {
            $rows = self::query($pdo, 'SELECT p.*, c.slug AS category_slug, s.slug AS series_slug FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN manga_series s ON s.id=p.series_id WHERE p.sku=? OR p.slug=?', [$product['sku'], $product['slug']]);
            if (!$rows) {
                $result['new_products']++;
                $result['new_images'] += count($product['images']);
                continue;
            }
            $result['existing_products']++;
            $existing = $rows[0];
            $match = count($rows) === 1;
            foreach (['sku','slug','name_vi','name_en','description_vi','description_en','category_slug','series_slug','price_vnd','sale_price_vnd','stock_quantity','status','is_featured'] as $key) {
                if (($existing[$key] === null) !== ($product[$key] === null) || ($existing[$key] !== null && (string) $existing[$key] !== (string) $product[$key])) $match = false;
            }
            if (!$match) { $result['conflicts'][] = 'Existing product differs; will not update: ' . $product['sku']; continue; }
            foreach ($product['images'] as $image) {
                $url = self::PUBLIC_BASE . '/' . $existing['id'] . '/' . $image['filename'];
                $rows = self::query($pdo, 'SELECT * FROM product_images WHERE product_id=? AND image_url=?', [$existing['id'], $url]);
                if (!$rows) {
                    $result['new_images']++;
                    if ($image['is_primary'] && self::query($pdo, 'SELECT id FROM product_images WHERE product_id=? AND is_primary=1', [$existing['id']])) $result['conflicts'][] = 'Another primary image exists: ' . $product['sku'];
                } else {
                    foreach (['alt_vi','alt_en','sort_order','is_primary'] as $key) if ((string) $rows[0][$key] !== (string) (is_bool($image[$key]) ? (int) $image[$key] : $image[$key])) $result['conflicts'][] = 'Existing image differs: ' . $product['sku'];
                }
            }
        }
        return $result;
    }

    /** Copy reviewed filenames for portable SQL; reuse existing storage validation, never overwrite. */
    public static function restoreImages(PDO $pdo, array $manifest, string $base, array &$created): int
    {
        $root = realpath(__DIR__ . '/../public/uploads/products');
        $storage = new ProductImageStorage($root);
        $copied = 0;
        foreach ($manifest['products'] as $product) {
            $rows = self::query($pdo, 'SELECT id FROM products WHERE sku=? AND slug=?', [$product['sku'], $product['slug']]);
            if (count($rows) !== 1) throw new RuntimeException('Import product before restoring images: ' . $product['sku']);
            $id = (string) $rows[0]['id'];
            $directory = $root . DIRECTORY_SEPARATOR . $id;
            if (is_link($directory)) throw new RuntimeException('Symlink destination rejected.');
            if (!is_dir($directory) && !mkdir($directory,0755) && !is_dir($directory)) throw new RuntimeException('Cannot create image directory.');
            if (realpath($directory) !== $directory || dirname($directory) !== $root) throw new RuntimeException('Image destination escaped root.');
            foreach ($product['images'] as $image) {
                $source = self::assetPath($base, $product['sku'], $image['filename']);
                $storage->stage($source, $id, false);
                $destination = $directory . DIRECTORY_SEPARATOR . $image['filename'];
                if (file_exists($destination) || is_link($destination)) {
                    if (is_link($destination) || !is_file($destination) || !hash_equals($image['sha256'], hash_file('sha256',$destination))) throw new RuntimeException('Refusing image overwrite.');
                    continue;
                }
                $output = fopen($destination,'xb');
                if ($output === false) throw new RuntimeException('Cannot exclusively create image.');
                $created[] = $destination;
                try {
                    $bytes = file_get_contents($source);
                    $offset = 0;
                    while ($offset < strlen($bytes)) {
                        $written = fwrite($output,substr($bytes,$offset));
                        if ($written === false || $written === 0) throw new RuntimeException('Incomplete image copy.');
                        $offset += $written;
                    }
                } finally { fclose($output); }
                if (!hash_equals($image['sha256'],hash_file('sha256',$destination))) throw new RuntimeException('Copied image hash differs.');
                $copied++;
            }
        }
        return $copied;
    }

    /** Verify all local files and HTTP bytes before their database image links are inserted. */
    public static function verifyImages(PDO $pdo, array $manifest, array $origins): array
    {
        $requests=0; $images=0;
        $root=realpath(__DIR__.'/../public/uploads/products');
        foreach ($manifest['products'] as $product) {
            $row=self::query($pdo,'SELECT id FROM products WHERE sku=? AND slug=?',[$product['sku'],$product['slug']]);
            if (count($row)!==1) throw new RuntimeException('Product ID not resolved for image verification.');
            foreach ($product['images'] as $image) {
                $relative=$row[0]['id'].'/'.$image['filename'];
                $file=$root.DIRECTORY_SEPARATOR.str_replace('/',DIRECTORY_SEPARATOR,$relative);
                if (!is_file($file) || is_link($file) || !hash_equals($image['sha256'],hash_file('sha256',$file))) throw new RuntimeException('Local image missing or changed: '.$product['sku']);
                foreach ($origins as $origin) {
                    if (!preg_match('~^https?://[a-zA-Z0-9.\[\]:-]+$~D',$origin)) throw new RuntimeException('Invalid verification origin.');
                    $url=$origin.self::PUBLIC_BASE.'/'.$relative;
                    $curl=curl_init($url);
                    curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>15,CURLOPT_PROTOCOLS=>CURLPROTO_HTTP|CURLPROTO_HTTPS]);
                    $bytes=curl_exec($curl);
                    $status=curl_getinfo($curl,CURLINFO_HTTP_CODE);
                    $mime=explode(';',(string)curl_getinfo($curl,CURLINFO_CONTENT_TYPE))[0];
                    curl_close($curl);
                    if ($status!==200 || !is_string($bytes) || $mime!==$image['mime_type'] || !hash_equals($image['sha256'],hash('sha256',$bytes))) throw new RuntimeException('Image HTTP verification failed: '.$url.' ('.$status.')');
                    $requests++;
                }
                $images++;
            }
        }
        return ['images'=>$images,'http_requests'=>$requests,'origins'=>$origins,'errors'=>[]];
    }

    public static function insert(PDO $pdo, array $manifest, bool $includeImages = true): void
    {
        foreach ($manifest['categories'] as $category) {
            if (!self::query($pdo,'SELECT id FROM categories WHERE slug=?',[$category['slug']])) {
                $statement=$pdo->prepare('INSERT INTO categories (slug,name_vi,name_en,sort_order,is_active) VALUES (?,?,?,?,1)');
                $statement->execute([$category['slug'],$category['name_vi'],$category['name_en'],$category['sort_order']]);
            }
        }
        foreach ($manifest['series'] as $series) {
            if (!self::query($pdo,'SELECT id FROM manga_series WHERE slug=?',[$series['slug']])) {
                $statement=$pdo->prepare('INSERT INTO manga_series (slug,title,is_active) VALUES (?,?,1)');
                $statement->execute([$series['slug'],$series['title']]);
            }
        }
        foreach ($manifest['products'] as $product) {
            if (!self::query($pdo,'SELECT id FROM products WHERE sku=?',[$product['sku']])) {
                $category=self::query($pdo,'SELECT id FROM categories WHERE slug=?',[$product['category_slug']])[0]['id'];
                $series=self::query($pdo,'SELECT id FROM manga_series WHERE slug=?',[$product['series_slug']])[0]['id'];
                $statement=$pdo->prepare('INSERT INTO products (category_id,series_id,sku,slug,name_vi,name_en,description_vi,description_en,price_vnd,sale_price_vnd,stock_quantity,status,is_featured) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
                $statement->execute([$category,$series,$product['sku'],$product['slug'],$product['name_vi'],$product['name_en'],$product['description_vi'],$product['description_en'],$product['price_vnd'],$product['sale_price_vnd'],$product['stock_quantity'],$product['status'],$product['is_featured']]);
            }
        }
        if ($includeImages) self::insertImages($pdo, $manifest);
    }

    public static function insertImages(PDO $pdo, array $manifest): void
    {
        foreach ($manifest['products'] as $product) {
            $id=self::query($pdo,'SELECT id FROM products WHERE sku=?',[$product['sku']])[0]['id'];
            foreach ($product['images'] as $image) {
                $url=self::PUBLIC_BASE.'/'.$id.'/'.$image['filename'];
                if (!self::query($pdo,'SELECT id FROM product_images WHERE product_id=? AND image_url=?',[$id,$url])) {
                    $statement=$pdo->prepare('INSERT INTO product_images (product_id,image_url,alt_vi,alt_en,sort_order,is_primary) VALUES (?,?,?,?,?,?)');
                    $statement->execute([$id,$url,$image['alt_vi'],$image['alt_en'],$image['sort_order'],(int)$image['is_primary']]);
                }
            }
        }
    }
}
