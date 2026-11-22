<?php
declare(strict_types=1);

final class ProductRepository
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function activeProducts(?int $id = null): array
    {
        $sql = <<<'SQL'
SELECT p.id, p.sku, p.slug, p.name_vi, p.name_en,
       p.description_vi, p.description_en, p.price_vnd, p.sale_price_vnd,
       p.stock_quantity,
       c.id AS category_id, c.slug AS category_slug,
       c.name_vi AS category_name_vi, c.name_en AS category_name_en,
       s.id AS series_id, s.slug AS series_slug, s.title AS series_title,
       s.description_vi AS series_description_vi, s.description_en AS series_description_en, s.is_active AS series_active,
       i.image_url
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN manga_series s ON s.id = p.series_id
LEFT JOIN product_images i ON i.id = (
    SELECT pi.id FROM product_images pi
    WHERE pi.product_id = p.id AND pi.is_primary = 1
    ORDER BY pi.sort_order, pi.id LIMIT 1
)
WHERE p.status = :status
SQL;
        if ($id !== null) {
            $sql .= ' AND p.id = :id';
        }
        $sql .= ' ORDER BY p.id';
        $statement = $this->pdo->prepare($sql);
        $statement->bindValue(':status', 'active', PDO::PARAM_STR);
        if ($id !== null) {
            $statement->bindValue(':id', $id, PDO::PARAM_INT);
        }
        $statement->execute();
        $products = array_map([self::class, 'serialize'], $statement->fetchAll());
        if ($products === []) {
            return [];
        }
        // Batch-load galleries instead of running one query per product.
        $imageSql = <<<'SQL'
SELECT i.id, i.product_id, i.image_url, i.alt_vi, i.alt_en, i.sort_order, i.is_primary
FROM product_images i
JOIN products p ON p.id = i.product_id
WHERE p.status = :status
SQL;
        if ($id !== null) {
            $imageSql .= ' AND p.id = :id';
        }
        $imageSql .= ' ORDER BY i.product_id, i.sort_order, i.id';
        $imagesStatement = $this->pdo->prepare($imageSql);
        $imagesStatement->bindValue(':status', 'active', PDO::PARAM_STR);
        if ($id !== null) {
            $imagesStatement->bindValue(':id', $id, PDO::PARAM_INT);
        }
        $imagesStatement->execute();
        $galleries = [];
        foreach ($imagesStatement->fetchAll() as $image) {
            $galleries[(int) $image['product_id']][] = [
                'id' => (int) $image['id'],
                'image_url' => $image['image_url'],
                'alt_vi' => $image['alt_vi'],
                'alt_en' => $image['alt_en'],
                'sort_order' => (int) $image['sort_order'],
                'is_primary' => (bool) $image['is_primary'],
            ];
        }
        foreach ($products as &$product) {
            $product['images'] = $galleries[$product['id']] ?? [];
        }
        unset($product);
        return $products;
    }

    private static function serialize(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'sku' => $row['sku'],
            'slug' => $row['slug'],
            'name_vi' => $row['name_vi'],
            'name_en' => $row['name_en'],
            'description_vi' => $row['description_vi'],
            'description_en' => $row['description_en'],
            'price_vnd' => (int) $row['price_vnd'],
            'sale_price_vnd' => $row['sale_price_vnd'] === null ? null : (int) $row['sale_price_vnd'],
            'stock_quantity' => (int) $row['stock_quantity'],
            'category' => $row['category_id'] === null ? null : [
                'id' => (int) $row['category_id'],
                'slug' => $row['category_slug'],
                'name_vi' => $row['category_name_vi'],
                'name_en' => $row['category_name_en'],
            ],
            'series' => $row['series_id'] === null ? null : [
                'id' => (int) $row['series_id'],
                'slug' => $row['series_slug'],
                'title' => $row['series_title'],
                'description_vi' => $row['series_description_vi'],
                'description_en' => $row['series_description_en'],
                'is_active' => (bool) $row['series_active'],
            ],
            'image_url' => $row['image_url'],
        ];
    }
}
