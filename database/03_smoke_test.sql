USE manga_store;
-- Expect 17 rows (tables) if schema was imported into an empty database.
SELECT COUNT(*) AS table_count FROM information_schema.tables
WHERE table_schema = 'manga_store' AND table_type = 'BASE TABLE';
-- Expect 6 categories, 3 demo series, 8 products.
SELECT COUNT(*) AS categories FROM categories;
SELECT COUNT(*) AS series FROM manga_series;
SELECT COUNT(*) AS products FROM products;
-- Product listing query for bilingual frontend
SELECT p.id,p.slug,p.sku,p.name_vi,p.name_en,p.price_vnd,p.sale_price_vnd,
       p.stock_quantity,c.name_vi AS category_vi,c.name_en AS category_en,
       s.title AS series_title
FROM products p
JOIN categories c ON c.id=p.category_id
LEFT JOIN manga_series s ON s.id=p.series_id
WHERE p.status='active'
ORDER BY p.id;
