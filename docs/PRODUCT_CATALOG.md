# Product catalog và hình ảnh – Giai đoạn 5

Không có migration hoặc dữ liệu MySQL nào được thực thi trong giai đoạn này. Các ảnh dùng kiểm thử là file tạm, không có bản ghi product_images, và được dọn sau kiểm thử.

## 1. Schema thực tế đã đối chiếu

| Bảng | Trường và khóa liên quan |
|---|---|
| products | PK id BIGINT UNSIGNED tự tăng; SKU/slug UNIQUE; category_id bắt buộc FK categories; series_id nullable FK manga_series, ON DELETE SET NULL; name_vi/name_en bắt buộc, description_vi/description_en nullable; price_vnd và sale_price_vnd DECIMAL(14,0); stock_quantity unsigned; status draft/active/archived; is_featured; created_at/updated_at |
| product_images | PK id BIGINT UNSIGNED tự tăng; product_id FK products ON DELETE CASCADE; image_url VARCHAR(500) bắt buộc; alt_vi/alt_en VARCHAR(255) nullable; sort_order INT; is_primary TINYINT(1); index product_id |
| categories | PK id; parent_id nullable self-FK ON DELETE SET NULL; slug UNIQUE; name_vi/name_en; sort_order; is_active |
| manga_series | PK id; slug UNIQUE; title và original_title; description_vi/description_en; banner_image_url; is_active |

Quan hệ sản phẩm–ảnh là 1:N. Schema hiện tại đủ để phục vụ gallery, không cần migration.
Tên và mô tả sản phẩm/danh mục có VI/EN; alt ảnh có VI/EN. Series chỉ có một title chung, không tự suy diễn title_vi/title_en.

Ảnh chính là bản ghi is_primary=1. Nếu dữ liệu có nhiều ảnh chính, API chọn sort_order nhỏ nhất, sau đó id nhỏ nhất để kết quả ổn định. Gallery luôn sắp sort_order ASC, id ASC; không tự chuyển ảnh chính lên đầu. Schema chưa có ràng buộc mỗi sản phẩm chỉ một ảnh chính và chưa chặn trùng product_id/image_url: hướng dẫn nhập bên dưới kiểm tra trước khi chèn. Không tự sửa dữ liệu cũ.

## 2. Lưu trữ ảnh local

```text
backend/public/uploads/products/
  .htaccess
  .gitignore
  <product-id>/
    <32-hex-ngẫu-nhiên>.jpg
    <32-hex-ngẫu-nhiên>.png
    <32-hex-ngẫu-nhiên>.webp
```

Chỉ JPEG/PNG/WebP. Không SVG, PHP, file thực thi hoặc tên file do người dùng cung cấp trực tiếp. Mỗi file mới dùng random_bytes(16), mở bằng chế độ xb để không ghi đè. ID phải là số nguyên dương; chặn traversal/symlink ở thư mục sản phẩm. File được kiểm tra đuôi, MIME thực bằng fileinfo, header/kích thước ảnh, tối đa 10 MiB, cạnh tối đa 12.000px và tổng tối đa 40 triệu pixel; chặn thẻ PHP nhúng. Không cần GD hoặc thư viện mới. Đây là công cụ local có chủ đích, không phải upload endpoint công khai.

Apache .htaccess tắt listing/CGI/SSI/MultiViews/path-info, vô hiệu handler kế thừa, chỉ cho phép tên 32-hex.jpg/png/webp và đặt MIME/nosniff. Thư mục scripts được chặn qua HTTP; CLI cũng kiểm tra PHP_SAPI. Khi chuyển sang server khác phải giữ quy tắc tương đương.

URL lưu trong MySQL là đường dẫn web, ví dụ:
`/manga-store/backend/public/uploads/products/<id>/<32-hex>.png`.
Không lưu C:\..., không lưu data: hoặc Base64. File thực nằm trên filesystem. Ảnh upload local được Git bỏ qua; .htaccess và .gitignore được giữ để bảo vệ thư mục. Sao lưu database và thư mục ảnh cùng nhau.

### Công cụ staging chỉ chạy thủ công

Sau khi đã tạo sản phẩm và biết ID thật, từ thư mục gốc:

```powershell
# Chỉ kiểm tra; không tạo ảnh hoặc ghi database:
& C:/xampp/php/php.exe backend/scripts/store_product_image.php --source="C:\photos\product-front.jpg" --product-id=ID_THAT

# Chủ động sao chép ảnh thành tên an toàn mới:
& C:/xampp/php/php.exe backend/scripts/store_product_image.php --source="C:\photos\product-front.jpg" --product-id=ID_THAT --write
```

Script chỉ SELECT để xác nhận sản phẩm tồn tại và sao chép file khi có --write. Không INSERT/UPDATE MySQL. Dùng image_url của kết quả `written: true` để nhập ảnh vào database. URL từ dry-run chỉ là xem trước, lần --write sẽ tạo tên mới. Chạy --write nhiều lần tạo nhiều file riêng; người nhập chủ động chọn URL cần gắn, không ghi đè file cũ.

## 3. Hợp đồng API ảnh (tương thích)

Hai endpoint vẫn giữ các trường cũ, đặc biệt image_url (string/null), và thêm:

```json
{
  "image_url": null,
  "images": []
}
```

Khi đã nhập ảnh, mỗi phần tử images có:
`id`, `image_url`, `alt_vi`, `alt_en`, `sort_order` (integer), `is_primary` (boolean).
Cả list và detail dùng cùng dữ liệu gallery. Repository dùng hai truy vấn tổng cộng cho một danh sách có dữ liệu, không query riêng cho từng sản phẩm. Không tạo bản ghi ảnh giả hoặc thay null bằng ảnh demo.

Nếu có gallery nhưng chưa đánh dấu ảnh chính, image_url vẫn null để giữ hợp đồng cũ. Card dùng placeholder; trang chi tiết có thể chọn ảnh đầu tiên có thật trong gallery. Người nhập nên đặt đúng một ảnh chính để cả card và gallery nhất quán.

## 4. React và Vite

- Adapter nhận images (tùy chọn để tương thích backend cũ), sắp sort_order/id, chọn alt theo VI/EN và fallback tên sản phẩm khi alt trống.
- Card dùng image_url như trước. Chi tiết dùng các thumbnail có ID ổn định; chọn ảnh chính mặc định, giữ ảnh đang chọn khi đổi ngôn ngữ; ảnh thiếu/hỏng dùng placeholder hiện có.
- Vùng thumbnail dùng chính markup/class cũ; chỉ bổ sung scrolling và ResizeObserver giới hạn chiều cao theo ảnh chính để 12+ ảnh không kéo giãn layout. Không sửa CSS/hover/breakpoint.
- Vite proxy mới: `/manga-store/backend/public/uploads/products/*` chuyển tiếp nguyên đường dẫn sang target Apache giống API proxy. Cổng frontend vẫn 8443. Không có URL localhost trong component.
- Production phải phục vụ đường dẫn ảnh này qua Apache/reverse proxy cùng origin; dev proxy không chạy trong vite preview.
- Ảnh, banner, dữ liệu demo và logic giá VND/i18n không thay đổi.

## 5. Quy trình nhập sản phẩm thật

1. Chuẩn bị tên VI/EN, mô tả VI/EN, SKU riêng, slug ASCII dạng `ten-san-pham`, category_id có thật, series_id có thật hoặc NULL.
2. Giá nhập nguyên VNĐ, không dấu phân cách: price_vnd >= 0; sale_price_vnd NULL hoặc từ 0 đến price_vnd. Tồn kho nguyên không âm. Không quy đổi USD.
3. Kiểm tra SKU/slug và khóa ngoại trước khi nhập. Dùng draft khi chưa hoàn tất dữ liệu; API chỉ hiển thị active.
4. Tạo sản phẩm mới, lấy ID thực tế. Không dùng thứ tự mảng React làm ID, không cập nhật/xóa 8 demo hiện có.
5. Staging từng ảnh bằng CLI, dùng URL đã được --write. Chuẩn bị alt_vi/alt_en, sort_order (0,10,20...), và đúng một is_primary=1.
6. Thêm từng bản ghi product_images sau khi xác minh file truy cập HTTP 200. Không nhập trùng cùng product_id/image_url.
7. Kiểm tra API list/detail, gallery, VI/EN, giá, tồn kho. Chỉ chuyển sản phẩm mới sang active sau khi đã kiểm tra.

### SQL tham khảo để nhập một sản phẩm mới

Đây là tài liệu để người dùng tự điền và chủ động chạy, không được chạy tự động. Giá trị bắt buộc mặc định NULL sẽ không tạo sản phẩm. Không có ON DUPLICATE KEY UPDATE.

```sql
USE manga_store;
SET @sku = NULL; -- điền SKU thật, tối đa 64 ký tự
SET @slug = NULL; -- điền slug thật, tối đa 200 ký tự
SET @name_vi = NULL;
SET @name_en = NULL;
SET @description_vi = NULL;
SET @description_en = NULL;
SET @category_id = NULL;
SET @series_id = NULL; -- có thể để NULL
SET @price_vnd = NULL;
SET @sale_price_vnd = NULL;
SET @stock_quantity = NULL;

START TRANSACTION;
INSERT INTO products
(category_id, series_id, sku, slug, name_vi, name_en,
 description_vi, description_en, price_vnd, sale_price_vnd, stock_quantity, status)
SELECT @category_id, @series_id, @sku, @slug, @name_vi, @name_en,
       @description_vi, @description_en, @price_vnd, @sale_price_vnd, @stock_quantity, 'draft'
WHERE CHAR_LENGTH(TRIM(@sku)) BETWEEN 1 AND 64
  AND CHAR_LENGTH(@slug) BETWEEN 1 AND 200
  AND @slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
  AND CHAR_LENGTH(TRIM(@name_vi)) BETWEEN 1 AND 255
  AND CHAR_LENGTH(TRIM(@name_en)) BETWEEN 1 AND 255
  AND @price_vnd >= 0 AND @price_vnd = FLOOR(@price_vnd)
  AND @price_vnd <= 99999999999999
  AND (@sale_price_vnd IS NULL OR
       (@sale_price_vnd BETWEEN 0 AND @price_vnd AND @sale_price_vnd = FLOOR(@sale_price_vnd)))
  AND @stock_quantity BETWEEN 0 AND 4294967295 AND @stock_quantity = FLOOR(@stock_quantity)
  AND EXISTS (SELECT 1 FROM categories WHERE id=@category_id AND is_active=1)
  AND (@series_id IS NULL OR EXISTS (SELECT 1 FROM manga_series WHERE id=@series_id AND is_active=1))
  AND NOT EXISTS (SELECT 1 FROM products WHERE sku=@sku OR slug=@slug);
SET @created = ROW_COUNT();
SET @new_product_id = IF(@created=1, LAST_INSERT_ID(), NULL);
SELECT @created AS inserted_rows, @new_product_id AS new_product_id;
COMMIT;
```

`inserted_rows=0` nghĩa là dữ liệu thiếu/không hợp lệ hoặc SKU/slug đã tồn tại; đọc và sửa đầu vào, không tự cập nhật sản phẩm trùng. Chạy lại không tạo trùng nhờ NOT EXISTS và UNIQUE. Nếu có lỗi SQL, ROLLBACK và xử lý trước khi tiếp tục. Để sửa sản phẩm cũ cần thao tác riêng được phép.

### SQL tham khảo để gắn một ảnh đã được staging

Điền đúng URL từ CLI --write, không tự chế tên ảnh; kiểm tra file bằng HTTP trước. Lặp lại với sort_order khác cho ảnh phụ.

```sql
SET @product_id = NULL; -- ID sản phẩm bạn chủ động nhập
SET @image_url = NULL; -- image_url từ CLI written:true
SET @alt_vi = NULL;
SET @alt_en = NULL;
SET @sort_order = 0;
SET @is_primary = 1; -- các ảnh phụ dùng 0
START TRANSACTION;
SELECT id FROM products WHERE id=@product_id FOR UPDATE;
INSERT INTO product_images (product_id,image_url,alt_vi,alt_en,sort_order,is_primary)
SELECT @product_id,@image_url,@alt_vi,@alt_en,@sort_order,@is_primary
WHERE EXISTS (SELECT 1 FROM products WHERE id=@product_id)
  AND CHAR_LENGTH(@image_url) <= 500
  AND @image_url REGEXP CONCAT('^/manga-store/backend/public/uploads/products/',@product_id,'/[a-f0-9]{32}[.](jpg|png|webp)$')
  AND (@alt_vi IS NULL OR CHAR_LENGTH(@alt_vi)<=255)
  AND (@alt_en IS NULL OR CHAR_LENGTH(@alt_en)<=255)
  AND @sort_order BETWEEN 0 AND 2147483647 AND @sort_order=FLOOR(@sort_order)
  AND @is_primary IN (0,1)
  AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id=@product_id AND image_url=@image_url)
  AND (@is_primary=0 OR NOT EXISTS (SELECT 1 FROM product_images WHERE product_id=@product_id AND is_primary=1));
SELECT ROW_COUNT() AS inserted_images;
COMMIT;
```

Nếu đã có ảnh chính, câu lệnh không tự thay thế. Việc thay ảnh chính/xóa file cũ phải được người dùng chủ động cho phép. SQL không kiểm tra được file tồn tại: bước HTTP/CLI là bắt buộc trong quy trình.

## 6. Kiểm thử và giới hạn

Đã chạy trên máy local:
- API list/detail HTTP 200, 8 sản phẩm, image_url=null và images=[]; kiểm thử backend cũ vẫn đạt.
- Repository thực dùng PDO SQLite in-memory: primary, tie-break, sort_order/id, ảnh phụ, không ảnh, không primary, và sản phẩm draft. Không ghi MariaDB.
- Storage trong thư mục temp: dry-run không ghi, tên riêng không ghi đè, traversal, PHP nhúng, SVG, giới hạn kích thước file.
- File PNG tạm tải qua Apache và Vite giữ nguyên bytes, MIME image/png và nosniff; PHP/PHTML/tên sai, listing và path-info bị chặn.
- Chrome headless thật desktop/mobile: placeholder từ MySQL không ảnh; gallery có ảnh từ HTTP thật với JSON chỉ giả lập trong browser; ảnh chính không ở vị trí đầu; thứ tự thumbnail; chọn ảnh; alt VI/EN và giữ lựa chọn/ID khi đổi ngôn ngữ; giá VND; 12 thumbnail không làm tràn layout; không lỗi JavaScript.

Các lệnh tự chạy từ thư mục gốc (Vite/Apache/MySQL đang bật):

```powershell
& C:/xampp/php/php.exe backend/tests/test_product_images.php
python backend/tests/test_api.py
python backend/tests/test_image_http.py
try {
    # VITE_USE_PRODUCTS_API=true, khởi động lại Vite trước khi chạy:
    node frontend/scripts/check-products.mjs --live --images
} finally {
    python backend/tests/test_image_http.py --cleanup
}
cd frontend
npm run build
.\node_modules\.bin\tsc.cmd --noEmit
```

Kiểm thử demo dùng script không có --live với cờ false, so sánh baseline local đã lưu ở giai đoạn 4. Không chụp lại baseline để che thay đổi. Cuối kiểm thử cấu hình .env.local được trả nguyên trạng theo lựa chọn ban đầu của người dùng.

Chưa có ảnh sản phẩm thật trong MySQL, chưa kiểm thử dữ liệu ảnh thật được người dùng nhập vào MariaDB. Gallery có ảnh được kiểm thử bằng SQLite cô lập và browser fixture + file HTTP thật. Chưa xây Admin, upload công khai, tự động nhập catalog vào DB, xử lý EXIF/resize ảnh, đăng nhập hoặc thanh toán. Người nhập chuẩn bị ảnh đúng hướng và kích thước trước khi staging. Không có migration đề xuất vì schema hiện tại đủ dùng.
