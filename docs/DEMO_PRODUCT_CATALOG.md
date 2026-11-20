# Catalog trình diễn Manga Store – Giai đoạn 5B

**Trạng thái hiện tại: GIAI ĐOẠN B đã hoàn thành sau khi người dùng duyệt.** Database có 23 sản phẩm mới active, 8 sản phẩm cũ archived và 35 ảnh. Xem [kết quả kiểm thử và backup/restore](CATALOG_IMPORT_RESULT.md).

Các phần dưới ghi lại gói chuẩn bị và quy trình giai đoạn A/B. Trong giai đoạn A chưa ghi MySQL; giai đoạn B đã thực hiện INSERT catalog và chỉ đổi status tám sản phẩm cũ, không DELETE/migration hoặc sửa frontend.

## Gói bàn giao và xem trước

- [Bảng manifest đầy đủ 23 dòng](../database/catalog/demo-products/MANIFEST.md): ID dự kiến, SKU, VI/EN, danh mục/series, giá/tồn kho demo và nguồn/trạng thái ảnh.
- [Xem trước offline 23 sản phẩm](../database/catalog/demo-products/preview.html).
- [Xem gallery sáu figure](../database/catalog/demo-products/gallery-review.html).
- [Manifest JSON](../database/catalog/demo-products/manifest.json): toàn bộ dữ liệu, metadata xác minh và các điểm chưa chắc chắn.
- `database/catalog/demo-products/manifest.csv`: mở bằng Excel (UTF-8 BOM).
- `database/catalog/demo-products/sources.csv`: 35 URL ảnh, trang nguồn, SHA-256, độ phân giải và ghi chú.
- `database/catalog/demo-products/assets/<SKU>/<32-hex>.<jpg|png|webp>`: ảnh gốc cục bộ, tổng khoảng 5,01 MiB. Đây là staging, không thay cấu trúc uploads hiện tại.
- `database/catalog/demo-products/catalog.sql`: import INSERT-only qua phpMyAdmin, mặc định khóa bởi `@MANGA_CATALOG_APPROVED=0`.
- `backend/scripts/import_demo_catalog.php`: CLI mặc định dry-run, yêu cầu xác nhận hash và file backup khi ghi.
- `database/catalog/demo-products/catalog-bundle.zip`: gói portable, kèm checksum SHA-256. Không chứa mật khẩu, .env.local, database.local.php hoặc node_modules.

## Quy mô và cách chọn ấn bản

| Danh mục | Số sản phẩm | Ảnh local |
|---|---:|---:|
| Manga | 14 | 14 |
| Novel / Tiểu thuyết Nhật Bản | 3 | 3 |
| Anime Figure | 6 | 18 |
| **Tổng** | **23** | **35** |

23/23 sản phẩm có ảnh chính; 0 sản phẩm thiếu ảnh. Mỗi figure có ba ảnh. Không thêm SKU trùng để đạt số lượng.

- Manga gồm hai tập đầu của Attack on Titan, One Piece, Doraemon truyện ngắn, Naruto, Dragon Ball nguyên bản (không phải Super/Full Color), Black Clover và Kaguya-sama.
- Attack on Titan: chọn **bản in tiếng Anh Kodansha**, có nguồn tác giả, tập, bìa và ISBN bản in trên trang chính thức. Không nhầm ISBN ebook. Chưa đủ căn cứ để chọn an toàn bộ bìa/tập 1–2 bản Việt đang lưu hành nên không tự ghi NXB Việt.
- 12 manga còn lại: bản tiếng Việt Kim Đồng. One Piece, Doraemon, Naruto và Dragon Ball lấy ảnh theo đúng `featured_image` của variant tập 1/2 trên dữ liệu công khai của NXB; ghi nguyên nhãn tái bản (2025/2026) trong manifest. Không coi mã bán hàng/barcode là ISBN.
- Black Clover và Kaguya có thông tin tác giả/NXB/volume trên Fahasa; bìa được đối chiếu trực quan. Bìa Black Clover 1 lấy từ trang sản phẩm Hikaru, các ảnh còn lại từ CDN Fahasa công khai. Không cam kết quà tặng khuyến mại của nhà sách.
- Ba tiểu thuyết là **sách chữ của Makoto Shinkai**, không phải manga, artbook hoặc poster. Bìa lấy từ trang sản phẩm IPM. Your Name: NXB Hồng Đức; Weathering with You: NXB Hà Nội; Suzume: NXB Hồng Đức theo metadata nguồn.

### Những điểm chưa xác minh / giới hạn ảnh

1. Trang IPM Suzume có handle/ảnh ghi bìa mềm nhưng bảng thông số ghi bìa cứng; năm in/tái bản cũng chưa được đối chiếu với đúng bản bìa hiện tại. Manifest để `binding=null`, `listed_publication_year=null`; tên sản phẩm chỉ ghi tiểu thuyết tiếng Việt. Cần người dùng chấp nhận cách ghi thận trọng này hoặc đối chiếu bản vật lý trước khi khẳng định kiểu bìa/năm in.
2. ISBN của sách Việt chưa được xác minh đầy đủ: để NULL, không dùng barcode/SKU nguồn làm ISBN. Schema không có cột ISBN/tác giả/NXB; dữ liệu xác minh được giữ trong manifest và mô tả phù hợp, không tự migration.
3. Ảnh Kaguya tập 2 là ảnh sách kèm lót ly từ nguồn, không tạo sản phẩm lót ly riêng hoặc hứa có quà trong tồn kho demo.
4. Một số ảnh gốc chỉ 550–800px hoặc bìa vuông có khoảng trắng. Giữ nguyên độ phân giải, không phóng lớn giả, không cắt watermark. Chi tiết từng file có trong sources.csv.
5. Figure dùng ảnh quảng bá mẫu thử của nhà sản xuất/nhà phân phối, không phải ảnh AI và không khẳng định đó là ảnh chụp một hộp hàng bán lẻ cụ thể. Không cam kết bonus preorder.
6. Một số trang/ảnh Good Smile và Fahasa trả 403/503: không vượt chặn. Gói sử dụng các nguồn công khai khác đã kiểm tra như kho ảnh Good Smile cũ và Plaza Japan; lịch sử URL lỗi được giữ trong manifest khi thay nguồn.
7. Việc dùng ảnh minh họa đồ án không được trình bày như giấy phép khai thác thương mại. URL nguồn, tác giả/nhãn và bytes ảnh được giữ nguyên, không xóa watermark.

### Mẫu figure cụ thể

| Nhân vật | Mẫu | Nhà sản xuất | Chiều cao xác minh |
|---|---|---|---:|
| Frieren | POP UP PARADE Frieren | Good Smile Company | khoảng 160 mm |
| Marin Kitagawa | POP UP PARADE Marin Kitagawa | **Good Smile Arts Shanghai**; Good Smile Company phân phối | khoảng 185 mm |
| Maomao | Nendoroid Maomao **#2288** | Good Smile Company | khoảng 100 mm |
| Yor Forger | POP UP PARADE Yor Forger | Good Smile Company | khoảng 170 mm |
| Fern | POP UP PARADE Fern | Good Smile Company | khoảng 170 mm |
| Hitori Gotoh | POP UP PARADE Hitori Gotoh | Good Smile Company | khoảng 195 mm |

Tất cả là **non-scale**, không tự ghi tỉ lệ 1/7, 1/8... Chiều cao và nhà sản xuất lấy từ trang mẫu chính thức, không suy từ ảnh hoặc chiều cao chung của dòng POP UP PARADE.

## Giá và tồn kho

**Tất cả giá, khuyến mãi và tồn kho là giả lập cho đồ án, không phải giá bán chính thức đã xác minh.** Manga Việt khoảng 25.000–40.000 VNĐ; manga tiếng Anh 220.000 VNĐ; novel 95.000–145.000 VNĐ; figure 850.000–1.250.000 VNĐ. Có ba khuyến mãi demo: One Piece 2, Weathering with You và Marin. Không có sale bằng 0. Mô tả VI/EN cũng nêu đây là giá/tồn kho minh họa.

Tên và mô tả EN của sách Việt chỉ là cách hiển thị song ngữ, **không đổi ngôn ngữ ấn bản**: sách tiếng Việt luôn được ghi Vietnamese Edition, trừ hai tập Titan được chọn bản tiếng Anh.

## Thay đổi MySQL dự kiến

Theo dry-run trên database hiện tại:

- Thêm **1 category** `novels`; tái sử dụng `manga` và `figures` theo slug, không sửa tên/category cũ.
- Thêm **15 series/franchise** (hai figure Frieren và Fern cùng một series). Các novel độc lập liên kết franchise tương ứng; không giả là một bộ manga.
- Thêm **23 products active** với SKU tiền tố `CAT-`, slug duy nhất, FK theo slug.
- Thêm **35 product_images**, mỗi sản phẩm đúng một ảnh chính; gallery sort_order 0/10/20, tie-break theo id như API hiện tại.
- Không ghi users/carts/orders/payments hoặc các bảng khác. Không sửa schema.
- ID dự kiến **9–31** vì AUTO_INCREMENT hiện tại là 9, nhưng không reserve ID. Import/khôi phục ảnh luôn tra **SKU**, không gán ID cứng; chạy trên máy khác vẫn đúng ngay cả khi ID khác.

### Quyết định về 8 sản phẩm cũ cần được duyệt

**Phương án mặc định của bộ import:** giữ nguyên cả tám sản phẩm cũ, status active, ID và mọi tham chiếu. Sau import có 31 sản phẩm active, gồm 8 cũ + 23 mới. Không có UPDATE/DELETE trong base import.

**Đề xuất tùy chọn cho bản trình diễn sạch:** sau khi duyệt riêng, đổi status tám SKU `DEMO-*` được liệt kê chính xác sang `archived`, không xóa và không đổi ID. Khi đó API chỉ trả 23 sản phẩm mới. File `optional_hide_legacy_demo.sql` là đề xuất tách biệt, mặc định `@APPROVE_HIDE_8_OLD_DEMOS=0`; chưa chạy. Không tự coi việc duyệt thêm sản phẩm là duyệt ẩn sản phẩm cũ.

Lưu ý mã hiện tại lấy Home New Arrivals/Series collection từ các phần đầu của danh sách sắp ID. Nếu giữ tám cũ active, những vị trí đầu vẫn có dữ liệu cũ. Best Sellers chỉ là vị trí danh sách trong bản Figma, không phải doanh số thật. Các banner/collection/series editorial còn cố định theo Figma; chúng không tự trở thành banner series mới qua import dữ liệu. Giai đoạn này không thay JSX/CSS hoặc banner để che giới hạn đó.

Không tái sử dụng ID demo cho sản phẩm mới và không xóa state giỏ hàng. Việc ẩn tùy chọn giữ nguyên ID/reference; giá giỏ hiện tại vẫn là snapshot frontend, chưa phải checkout thật.

## Dry-run và kiểm thử giai đoạn A

Từ thư mục gốc:

```powershell
& C:/xampp/php/php.exe backend/scripts/import_demo_catalog.php --dry-run
& C:/xampp/php/php.exe backend/tests/test_demo_catalog.php
& C:/xampp/php/php.exe backend/tests/check_catalog_sql.php
```

Dry-run chỉ đọc schema/dữ liệu MySQL và kiểm tra file ảnh bằng ProductImageStorage; không bắt đầu transaction ghi hoặc tăng AUTO_INCREMENT. Kết quả lưu ở `database/catalog/demo-products/dry-run.json`.

Kiểm thử import/rerun, FK, primary ảnh, xung đột và dữ liệu sai chạy trên **SQLite in-memory** với bản sao dữ liệu chỉ đọc, không ghi MariaDB. Các INSERT SQL tạo sẵn được server MariaDB kiểm tra bằng native prepare, **không execute**. Không khẳng định đã import thật hoặc kiểm thử 23 sản phẩm trên live frontend.

Bản xem trước là HTML offline độc lập được render bằng Chrome, không thay hoặc giả làm giao diện đang chạy. Hash bốn bảng catalog và các file frontend trước/sau được đối chiếu để chứng minh không đổi.

## Giai đoạn B – CHỈ SAU KHI ĐƯỢC DUYỆT

### 1. Sao lưu

Trong phpMyAdmin chọn manga_store → Export → Custom → cả structure và data, đủ 17 bảng, lưu SQL UTF-8. Sao lưu thêm thư mục `backend/public/uploads/products/`. Kiểm tra file backup có dữ liệu và lưu ngoài thư mục public. Bộ import kiểm tra đường dẫn backup tồn tại/không rỗng, nhưng không thay thế việc người dùng xác minh backup phục hồi được.

### 2. Cách khuyến nghị: CLI transaction + ảnh

Chạy lại dry-run, so sánh hash manifest với bản đã duyệt. **Không chạy lệnh dưới đây trước khi được duyệt**:

```powershell
& C:/xampp/php/php.exe backend/scripts/import_demo_catalog.php --apply --approved-sha256=HASH_MANIFEST_DA_DUYET --backup="C:\backups\manga_store_before_catalog.sql"
```

`--apply` yêu cầu hash đúng, backup và không có xung đột. Bộ import dùng prepared statements, transaction và advisory lock; chỉ INSERT dữ liệu thiếu, không UPDATE/DELETE. Nó xác định ID theo SKU, tái dùng validator ProductImageStorage, chép ảnh vào uploads/products/<id>/ giữ tên 32-hex đã review. Nếu file đã tồn tại chỉ chấp nhận cùng SHA-256; không ghi đè. Nếu lỗi trước commit thì rollback và dọn đúng các file vừa tạo.

Chạy lại với manifest không đổi là no-op; nếu SKU/slug đã có nhưng dữ liệu khác, dừng và báo conflict thay vì sửa đè.

### 3. Cách khác: import bằng phpMyAdmin

1. Sau khi duyệt và backup, mở **bản sao** catalog.sql và đổi dòng `SET @MANGA_CATALOG_APPROVED=0` thành 1. Kiểm tra hash manifest trong comment khớp bản đã duyệt.
2. Chọn database manga_store → Import → file SQL → UTF-8. Nếu có lỗi, dừng, ROLLBACK và kiểm tra trước khi tiếp tục. Không import đồng thời với một tiến trình khác.
3. `import_enabled=1`, `conflicts=0` xác nhận guard cho phép import. Nếu guard vẫn 0 thì không có dữ liệu được chèn.
4. SQL chỉ nhập dữ liệu, không thể chép ảnh trên filesystem. Chạy bước khôi phục file theo SKU ngay sau đó:

```powershell
& C:/xampp/php/php.exe backend/scripts/import_demo_catalog.php --restore-images --approved-sha256=HASH_MANIFEST_DA_DUYET --backup="C:\backups\manga_store_before_catalog.sql"
```

`--restore-images` không ghi MySQL; nó chỉ chạy khi các bản ghi đã khớp đầy đủ manifest. URL trong SQL dùng ID thực tra theo SKU và tên file bundle, không dùng ID dự kiến.

Không chạy file tùy chọn ẩn tám demo nếu chưa được duyệt riêng.

### 4. Kiểm tra sau import (chưa thực hiện ở giai đoạn A)

- Dry-run lần hai báo 0 new categories/series/products/images và 0 conflicts.
- Kiểm tra 23 SKU `CAT-*`, đúng một primary/sản phẩm, 35 images, không FK lỗi hoặc SKU/slug trùng.
- API list/detail HTTP 200; tổng 31 active nếu giữ tám cũ, hoặc 23 nếu được duyệt ẩn chúng.
- Mỗi URL ảnh trong API trả 200 qua Apache và Vite; ảnh hiển thị đúng tập/figure, gallery đúng thứ tự và placeholder khi cố ý thiếu ảnh.
- Shop, detail, Home New Arrivals/Best Sellers, Series collection; tìm kiếm/danh mục, VI/EN, VND, giỏ hàng giữ đúng ID; desktop/mobile và console.
- Kiểm thử backend cũ `test_api.py` hiện giả định tám demo nên không dùng nguyên trạng để xác nhận catalog mới; cập nhật fixture/assertion phù hợp ở giai đoạn B.

## Chuyển máy / khôi phục trình diễn

1. Sao chép project đã có React/PHP/schema giai đoạn 5 và giải nén bundle theo đường dẫn tương đối từ thư mục gốc. Không ghi đè .env.local/database.local.php của máy đích; bundle không chứa các file đó.
2. Khôi phục bản backup đầy đủ đã duyệt vào MariaDB, hoặc tạo schema 17 bảng trên database mới rồi nhập catalog.sql theo quy trình đã duyệt. Không seed lại database có dữ liệu. Không cần seed tám demo trên máy mới nếu chỉ muốn catalog 23 mới.
3. Cấu hình `backend/config/database.local.php` trên máy đích theo database.example.php; bật Apache/MySQL. Không đưa thông tin DB vào biến VITE_*.
4. Khôi phục folder ảnh từ backup đúng path hoặc dùng `--restore-images` từ bundle, ánh xạ theo SKU. Giữ .htaccess trong thư mục ảnh. Nếu đổi tên thư mục dự án khỏi manga-store phải chủ động cập nhật public base/proxy/URL tương ứng.
5. Trong frontend đặt `VITE_USE_PRODUCTS_API=true`, API base `/api`; `npm ci` rồi `npm run dev`, giữ cổng cấu hình 8443. Apache port khác thì cấu hình PRODUCTS_API_PROXY_TARGET.
6. Kiểm tra API/số lượng theo phương án đã duyệt, gallery, VND/VI/EN, tìm kiếm, mobile. Ảnh là file local nên frontend không phụ thuộc hotlink CDN nguồn khi trình diễn.

## Nguồn chính

- [Kodansha Attack on Titan 1](https://kodansha.us/series/attack-on-titan/volume-1/), [tập 2](https://kodansha.us/series/attack-on-titan/volume-2/).
- [Kim Đồng One Piece](https://nxbkimdong.com.vn/tap-le-one-piece-ban-bia-roi-1-50), [Doraemon](https://nxbkimdong.com.vn/tap-le-doraemon-truyen-ngan-chu-meo-may-den-tu-tuong-lai), [Naruto](https://nxbkimdong.com.vn/tap-le-naruto), [Dragon Ball](https://nxbkimdong.com.vn/tap-le-dragon-ball-7-vien-ngoc-rong-29).
- IPM: [Your Name](https://ipm.vn/products/your-name), [Weathering with You](https://ipm.vn/products/dua-con-cua-thoi-tiet), [Suzume](https://ipm.vn/products/khoa-chat-cua-nao-suzume-bia-mem).
- Good Smile: [Frieren](https://www.goodsmile.com/en/product/56126/POP%2BUP%2BPARADE%2BFrieren), [Marin](https://www.goodsmile.com/en/product/55124/POP%2BUP%2BPARADE%2BMarin%2BKitagawa), [Maomao](https://www.goodsmile.info/en/product/15217/Nendoroid%2BMaomao.html), [Yor](https://www.goodsmile.info/en/product/13720/POP%2BUP%2BPARADE%2BYor%2BForger.html), [Fern](https://www.goodsmile.com/en/product/56127/POP%2BUP%2BPARADE%2BFern), [Hitori](https://www.goodsmile.info/en/product/15010/POP%2BUP%2BPARADE%2BHitori%2BGotoh.html).

Các URL trang sản phẩm/ảnh cụ thể và hash từng file có đầy đủ trong manifest.json/sources.csv, bao gồm Hikaru, Fahasa và Plaza Japan. Mô tả VI/EN được viết lại ngắn, không sao chép mô tả dài của nguồn.
