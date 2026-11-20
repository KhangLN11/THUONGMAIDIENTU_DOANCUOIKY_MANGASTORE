# Kết quả import Catalog Manga Store – Giai đoạn B

**Đã import và kiểm thử trên MariaDB/XAMPP và website thật.** Người dùng đã duyệt manifest và archive tám sản phẩm cũ. Không xóa sản phẩm, không migration, không sửa source frontend.

Manifest SHA-256 giữ nguyên: `756e772175d291119761cae948a5c242126010a3c84800269b746af825521d1f`.

| Hạng mục | Trước | Sau |
|---|---:|---:|
| Tổng sản phẩm | 8 | 31 |
| Active | 8 | 23 |
| Archived | 0 | 8 |
| Danh mục | 6 | 7 (+1) |
| Series | 3 | 18 (+15) |
| Bản ghi ảnh | 0 | 35 |

23 sản phẩm mới: 14 manga, 3 tiểu thuyết, 6 figure. Mỗi sản phẩm có đúng một ảnh chính; mỗi figure có ba ảnh. Tên, SKU, slug, giá gốc/sale và tồn kho khớp manifest. Giá/tồn kho vẫn là giả lập phục vụ đồ án.

## Trình tự đã thực hiện

1. Kiểm tra enum status đã có archived; đối chiếu đúng tám SKU/ID cũ và hash manifest.
2. Sao lưu đủ 17 bảng, riêng bốn bảng bị tác động và thư mục ảnh ngoài webroot; kiểm tra số bảng, file và checksum.
3. Dry-run: thêm 1 danh mục, 15 series, 23 sản phẩm, 35 ảnh; không conflict.
4. Import trong transaction. Tạo category/series/product, sao chép ảnh và kiểm tra **35 file/70 HTTP requests qua Apache và Vite trước khi INSERT liên kết ảnh**, rồi commit.
5. Kiểm tra API chi tiết cả 23 sản phẩm mới, ảnh và dữ liệu cũ trước archive.
6. Archive đúng tám SKU trong transaction riêng; chỉ đổi status. Explicit `updated_at=updated_at` giữ timestamp cũ; đối chiếu từng trường sau archive.
7. Kiểm thử API/Chrome thực tế, audit dữ liệu/schema/frontend và build.

Không DELETE. Tám sản phẩm ID 1–8 còn nguyên, chỉ status=archived. 13 bảng khác, sáu category và ba series cũ giữ nguyên dữ liệu. Schema cả 17 bảng giữ nguyên (bộ đếm AUTO_INCREMENT tăng bình thường khi INSERT).

## Kiểm thử thực tế

- API list HTTP 200 trả đúng 23 SKU CAT- active; API chi tiết cả 23 sản phẩm khớp manifest và list.
- Tám ID archived trả 404 qua API chỉ phục vụ active.
- 35 ảnh liên kết đúng, primary/sort_order/alt VI/EN đúng; cả Apache và Vite trả 200, đúng MIME/SHA-256.
- Không trùng SKU/slug; không category/series FK thiếu hoặc ảnh orphan.
- Chrome headless **không mock API**: Shop 23 card, Home New Arrivals 4 card, Best Sellers 19 card, Series collection 4 card đều lấy sản phẩm mới.
- Đã mở cả 23 trang chi tiết, chọn tổng 35 ảnh, đổi VI/EN cho tên/mô tả/alt/giá và giữ ID/ảnh đang chọn; không refetch chi tiết khi đổi ngôn ngữ.
- Bộ lọc manga 14, novel 3, figures 6; tìm Naruto ra hai sản phẩm. Hover vẫn hoạt động.
- Giỏ giữ sản phẩm khi di chuyển giữa các trang và đổi ngôn ngữ; giá sale Weathering with You vẫn 85.000 VNĐ. Checkout API vẫn vô hiệu hóa như trước.
- Desktop 1440×1000, mobile 390×844: grid 3/2 cột, không tràn ngang; gallery hoạt động.
- Không uncaught JavaScript exception, console.error hoặc request ảnh sản phẩm thất bại trong các luồng kiểm thử.
- `npm run build`, TypeScript `--noEmit` và PHP lint đều thành công.
- Hash 19 file frontend (gồm CSS/App/i18n/config/env/public assets) khớp trước import. React demo, logo, header/footer/hero, animation và responsive không sửa.
- Dry-run sau import: 0 bản ghi cần thêm, 0 conflict. Bộ kiểm thử SQLite cũng xác nhận chạy lại không trùng, ánh xạ ID theo SKU và giữ nguyên dữ liệu cũ.

**Sản phẩm lỗi: 0. Ảnh lỗi: 0.** Ảnh vẫn dùng cách hiển thị crop/grayscale gốc của Figma; không thay CSS hoặc chỉnh bytes ảnh. Nội dung banner/Series editorial cố định vẫn được giữ nguyên, không tự thiết kế thành banner các franchise mới.

Ảnh kiểm thử GUI nằm trong `frontend/.artifacts/catalog-live-*.png`; JSON kết quả nằm ở `catalog-live-api.json`, `catalog-live-browser.json`, `catalog-b-integrity.json`, `catalog-b-result.json` trong cùng thư mục.

## Backup và khôi phục

Thư mục backup riêng: `C:/xampp/manga-store-backups/2026-11-18-catalog-b-01` (ngoài htdocs, không đưa vào Git).

| File | Mục đích |
|---|---|
| manga_store_full.sql | Toàn bộ 17 bảng **trước import**, dùng để trở lại trạng thái 8 sản phẩm |
| affected_tables.sql | Bản sao riêng categories/manga_series/products/product_images trước thay đổi |
| product_uploads_before.zip | Thư mục ảnh trước import, gồm quy tắc bảo vệ |
| before.json / after.json | Snapshot dữ liệu phục vụ đối chiếu |
| imported_files.json | Danh sách chính xác 35 file mới, ID thực tế và hash |
| checksums.json | SHA-256 các file backup/báo cáo |
| manga_store_after_catalog.sql | Toàn bộ database sau import đã kiểm thử, dùng chuyển máy với catalog 23 active + 8 archived |
| product_uploads_after.zip | 35 ảnh hiện tại và .htaccess theo đường dẫn dự án |

### Trở lại trạng thái trước import khi cần

**Chưa chạy thao tác restore.** Chỉ làm khi muốn hoàn tác, vì dữ liệu sẽ trở về thời điểm backup và các thay đổi mới hơn có thể mất.

1. Sao lưu trạng thái hiện tại nếu cần giữ các thao tác phát sinh sau import; tạm ngừng các thao tác ghi.
2. Trong phpMyAdmin, chọn manga_store → Import → `C:/xampp/manga-store-backups/2026-11-18-catalog-b-01/manga_store_full.sql` → UTF-8. Dùng bản full làm lựa chọn mặc định, không tự restore riêng bốn bảng khi có quan hệ với bảng khác.
3. Khôi phục `product_uploads_before.zip` vào thư mục gốc dự án, giữ .htaccess. File ảnh mới không được DB cũ tham chiếu có thể giữ lại; nếu cần dọn, chỉ dùng danh sách `imported_files.json` để xử lý đúng 35 file do lần import này tạo, không xóa toàn bộ uploads.
4. Kiểm tra 17 bảng, 8 sản phẩm active, 0 ảnh như snapshot trước import, API list và giao diện. Không seed lại database.

### Chuyển bản đã hoàn thành sang máy khác

Khôi phục `manga_store_after_catalog.sql` và giải nén `product_uploads_after.zip` theo đúng đường dẫn từ thư mục gốc project. Cấu hình database.local.php riêng của máy đích, bật Apache/MySQL, frontend API=true và proxy đúng port. Giữ tên thư mục manga-store hoặc cập nhật public base/proxy có chủ đích nếu đổi tên. Không cần hotlink ảnh nguồn.

## File công cụ thay đổi trong giai đoạn B

- DemoCatalog.php / import_demo_catalog.php: tách bước ghi image links, kiểm tra HTTP ảnh trước khi gắn.
- Mới: archive_demo_catalog.php, catalog_snapshot.php.
- Test mới: test_live_catalog.py, check_live_catalog.mjs, audit_catalog_import.py.
- Cập nhật test_api.py cho catalog đã duyệt, test_demo_catalog.php để tạo lại fixture cô lập sau import.
- Không sửa source frontend. Chỉ sinh lại dist và artifact kiểm thử.

Chạy lại kiểm tra chỉ đọc:

```powershell
python backend/tests/test_api.py
python backend/tests/audit_catalog_import.py
node backend/tests/check_live_catalog.mjs
& C:/xampp/php/php.exe backend/scripts/import_demo_catalog.php --dry-run
```

Vite/Apache/MySQL cần đang chạy ở cổng hiện tại khi kiểm tra HTTP/GUI. Cảnh báo native config loader của Vite về __dirname/JSON import vẫn như trước, không chặn build.
