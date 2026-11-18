# PHP product API

Frontend đã có chế độ demo/API tùy cấu hình; xem [FRONTEND_API.md](FRONTEND_API.md). Backend không có migration hay seed mới.

## Cấu hình local

`backend/config/database.local.php` đã được tạo cho XAMPP local hiện tại và được `.gitignore` loại trừ. Khi checkout trên máy khác, sao chép `backend/config/database.example.php` thành `backend/config/database.local.php`, rồi điền thông tin MySQL của máy đó. Không commit file local.

Biến môi trường của tiến trình Apache/PHP được ưu tiên hơn file local:
`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
Không tự động đọc file `.env`. Khởi động lại Apache sau khi thay biến môi trường của Apache.

PDO dùng utf8mb4, exception mode và native prepared statements. Mật khẩu chỉ đặt trong file local hoặc biến môi trường, không đặt trong file source được commit. `.htaccess` ở config và src chặn truy cập HTTP khi chạy dưới htdocs của Apache. Nếu triển khai môi trường khác, đặt document root vào `backend/public`.

## Hợp đồng API

- GET http://localhost/manga-store/backend/public/api/products.php
  - 200: `{ "success": true, "data": [...], "meta": { "total": 8 } }`
  - Chỉ sản phẩm active, thứ tự ID tăng dần; total là số phần tử trả về, chưa phân trang.
- GET http://localhost/manga-store/backend/public/api/product.php?id=1
  - 200: `{ "success": true, "data": { ... } }`
  - Chỉ sản phẩm active; 400 INVALID_ID khi thiếu/sai ID, 404 PRODUCT_NOT_FOUND khi không có sản phẩm active tương ứng.
- Phương thức ngoài GET: 405 METHOD_NOT_ALLOWED, header Allow: GET.
- Lỗi kết nối/truy vấn/config database: 500 DATABASE_ERROR với thông báo chung, không có SQL hoặc thông tin kết nối.

Mỗi sản phẩm có id, sku, slug, name_vi/name_en, description_vi/description_en, price_vnd, sale_price_vnd, stock_quantity, category, series và image_url.
`category` là object id/slug/name_vi/name_en hoặc null; `series` là object id/slug/title hoặc null.
Giá là số nguyên VNĐ; sale_price_vnd có thể null. Không chuyển USD.
Ảnh chính được chọn từ is_primary=1 theo sort_order rồi id; không có ảnh chính trả null. Không thay bằng ảnh Figma hay ảnh mặc định. LEFT JOIN bảo toàn sản phẩm khi dữ liệu liên quan không có.

## Kiểm thử

Bật Apache và MySQL trong XAMPP. Mở hai URL ở trên trong trình duyệt để xem JSON.
Thử `product.php?id=0` (400), `product.php?id=abc` (400), `product.php?id=999999` (404).
Dùng tab Network để xem status và Content-Type.

Chạy kiểm thử tự động từ thư mục gốc:

```powershell
python backend/tests/test_api.py
Get-ChildItem backend -Recurse -Filter *.php | ForEach-Object { & C:/xampp/php/php.exe -l $_.FullName }
```

Script giả định bộ demo hiện tại có 8 sản phẩm, chưa có ảnh. Script chỉ đọc database; kiểm tra lỗi kết nối bằng biến môi trường của một tiến trình PHP CLI riêng, không đổi cấu hình Apache. Có thể đặt MANGA_API_BASE và PHP_BINARY nếu URL/đường dẫn khác.

Kết quả trên máy local: kiểm tra cú pháp PHP thành công; HTTP danh sách 8 sản phẩm và chi tiết cả 8 khớp nhau; UTF-8 tiếng Việt, giá VNĐ, giá giảm/null, series null, ảnh null hợp lệ; ID lỗi trả 400; không có sản phẩm trả 404; POST trả 405; thư mục config/src trả 403. Lỗi database giả lập bằng CLI trả DATABASE_ERROR không lộ secret. Kiểm tra qua HTTP tự động, không thao tác trình duyệt GUI.
