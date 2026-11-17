-- DEMO ONLY. Fictitious titles, fictitious prices and stock; NOT real catalog data.
-- Safe to import on a new, otherwise-empty manga_store database.
USE manga_store;

INSERT INTO categories (id, slug, name_vi, name_en, sort_order) VALUES
(1, 'manga', 'Truyện manga', 'Manga Books', 1),
(2, 'figures', 'Mô hình nhân vật', 'Figures', 2),
(3, 'accessories', 'Phụ kiện', 'Accessories', 3),
(4, 'posters', 'Poster', 'Posters', 4),
(5, 'apparel', 'Thời trang', 'Apparel', 5),
(6, 'stationery', 'Văn phòng phẩm', 'Stationery', 6);

INSERT INTO manga_series (id, slug, title, original_title, description_vi, description_en) VALUES
(1, 'hanh-trinh-mua-dem', 'Hành Trình Mưa Đêm', NULL, 'Bộ truyện giả lập dùng thử hệ thống.', 'Fictional demo series for testing.'),
(2, 'thanh-pho-giay', 'Thành Phố Giấy', NULL, 'Bộ truyện giả lập dùng thử hệ thống.', 'Fictional demo series for testing.'),
(3, 'ga-cuoi-chan-troi', 'Ga Cuối Chân Trời', NULL, 'Bộ truyện giả lập dùng thử hệ thống.', 'Fictional demo series for testing.');

INSERT INTO products (id, category_id, series_id, sku, slug, name_vi, name_en, description_vi, description_en, price_vnd, sale_price_vnd, stock_quantity, status, is_featured) VALUES
(1,1,1,'DEMO-MANGA-001','hanh-trinh-mua-dem-tap-1','Hành Trình Mưa Đêm – Tập 1','Night Rain Journey – Vol. 1','Sản phẩm minh họa; chưa phải hàng đang bán.','Demo product; not an actual offering.',45000,NULL,25,'active',1),
(2,1,2,'DEMO-MANGA-002','thanh-pho-giay-tap-1','Thành Phố Giấy – Tập 1','Paper City – Vol. 1','Sản phẩm minh họa; chưa phải hàng đang bán.','Demo product; not an actual offering.',55000,49000,18,'active',1),
(3,1,3,'DEMO-MANGA-003','ga-cuoi-chan-troi-tap-1','Ga Cuối Chân Trời – Tập 1','Last Station – Vol. 1','Sản phẩm minh họa; chưa phải hàng đang bán.','Demo product; not an actual offering.',50000,NULL,30,'active',0),
(4,2,1,'DEMO-FIG-001','figure-nhan-vat-mua-dem','Mô hình nhân vật Mưa Đêm','Night Rain Character Figure','Sản phẩm minh họa; chưa phải hàng đang bán.','Demo product; not an actual offering.',320000,289000,8,'active',1),
(5,3,2,'DEMO-ACC-001','moc-khoa-thanh-pho-giay','Móc khóa Thành Phố Giấy','Paper City Keychain','Sản phẩm minh họa; chưa phải hàng đang bán.','Demo product; not an actual offering.',39000,NULL,35,'active',0),
(6,4,3,'DEMO-POS-001','poster-ga-cuoi-chan-troi','Poster Ga Cuối Chân Trời','Last Station Poster','Sản phẩm minh họa; chưa phải hàng đang bán.','Demo product; not an actual offering.',79000,69000,20,'active',1),
(7,5,NULL,'DEMO-APP-001','ao-thun-tram-manga','Áo thun Trạm Manga (demo)','Manga Station T-shirt (demo)','Sản phẩm minh họa; chưa phải hàng đang bán.','Demo product; not an actual offering.',199000,NULL,12,'active',0),
(8,6,NULL,'DEMO-STA-001','bookmark-ve-tau','Bookmark Vé Tàu','Train Ticket Bookmark','Sản phẩm minh họa; chưa phải hàng đang bán.','Demo product; not an actual offering.',25000,NULL,42,'active',0);

INSERT INTO inventory_movements (product_id, quantity_delta, reason, note)
SELECT id, stock_quantity, 'initial', 'Demo seed initial stock' FROM products WHERE sku LIKE 'DEMO-%';

-- No demo accounts or password hashes: register users securely via PHP API.
