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
Ảnh chính được chọn từ is_primary=1 theo sort_order rồi id; không có ảnh chính trả null. Trường bổ sung `images` chứa id/image_url/alt_vi/alt_en/sort_order/is_primary, sắp sort_order rồi id; không ảnh trả mảng rỗng. Xem [PRODUCT_CATALOG.md](PRODUCT_CATALOG.md) để cấu hình lưu trữ và nhập sản phẩm/ảnh. Không thay bằng ảnh Figma hay ảnh mặc định. LEFT JOIN bảo toàn sản phẩm khi dữ liệu liên quan không có.

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


## Authentication và phân quyền (Giai đoạn 6)

Các endpoint `/api/auth/register.php`, `login.php`, `logout.php`, `me.php` và guard `/api/admin/access.php` được mô tả trong [AUTHENTICATION.md](AUTHENTICATION.md), gồm CSRF/cookie, cấu hình local, CLI admin và kiểm thử thực tế. API sản phẩm giữ nguyên.


## Giai đoạn 7 – Shopping Cart và Wishlist MySQL (20/11/2026)

Phần này ghi trạng thái hiện tại sau Giai đoạn 7. Các kết quả 8 sản phẩm ở phần trước là lịch sử triển khai ban đầu; catalog hiện có 23 active, 8 archived và 35 ảnh.

### Schema và quan hệ đã xác minh trên MariaDB

Không cần migration, không thêm bảng/cột/index. Ba bảng được ghi bởi tính năng:

| Bảng | Khóa và quan hệ |
| --- | --- |
| carts | PK id; UNIQUE user_id; FK user_id → users.id ON DELETE CASCADE; updated_at |
| cart_items | PK id; UNIQUE(cart_id, product_id); FK cart_id → carts.id CASCADE; FK product_id → products.id; CHECK quantity > 0 |
| wishlists | PK(user_id, product_id); FK user_id → users.id CASCADE; FK product_id → products.id CASCADE; created_at |

Đọc users để xác thực/kiểm tra active và products để kiểm tra trạng thái, tồn kho, giá. ProductRepository hiện có còn đọc categories, manga_series, product_images để cung cấp metadata/ảnh. Tổng cộng 8 bảng được tham chiếu, chỉ 3 bảng cart/wishlist được tính năng ghi. Không sửa users/products/catalog trong luồng mua sắm.

Một user có tối đa một cart. Cart tạo khi có thao tác ghi; GET không tạo cart. Các mutation wishlist cũng khóa cart của cùng user để phối hợp an toàn với guest merge. Item không lưu giá snapshot: giá luôn đọc lại từ products.

### Endpoint và JSON

Base local Apache: `http://localhost/manga-store/backend/public/api/`; Vite: `/api/` qua proxy đang có. Mọi endpoint dưới đây yêu cầu session đăng nhập hợp lệ; POST cần Content-Type application/json và X-CSRF-Token từ /auth/me.php.

| Method / endpoint | Body |
| --- | --- |
| GET cart.php | Không |
| POST cart/add.php | {"product_id":9,"quantity":1} |
| POST cart/update.php | {"product_id":9,"quantity":2} |
| POST cart/remove.php | {"product_id":9} |
| POST cart/clear.php | {} |
| POST cart/merge.php | operation_key, context, items, wishlist — mô tả bên dưới |
| GET wishlist.php | Không |
| POST wishlist/add.php | {"product_id":9} |
| POST wishlist/remove.php | {"product_id":9} |

Quantity phải là integer JSON từ 1 đến 999; chuỗi số, float, 0 và số âm bị từ chối. Product ID là integer dương. Không nhận user_id, cart_id, item_id hoặc giá từ client. Remove dùng product_id trong cart của user session, không dùng ID tùy ý của cart người khác.

GET cart trả `success:true`, `data` gồm:

```json
{
  "items": [{
    "id": 42,
    "product_id": 9,
    "quantity": 2,
    "product": "<object sản phẩm cùng cấu trúc API sản phẩm>",
    "name_vi": "<tên thực tế>",
    "name_en": "<tên thực tế>",
    "unit_price_vnd": 220000,
    "line_total_vnd": 440000,
    "available": true
  }],
  "total_quantity": 2,
  "subtotal_vnd": 440000,
  "currency": "VND"
}
```

GET wishlist trả `data:{product_ids:[...],products:[...]}`. Mọi mutation thành công trả `data:{cart:<cart>,wishlist:<wishlist>}` để React thay snapshot bằng kết quả backend. `meta` có csrf_token và merge_context. Product metadata active dùng lại ProductRepository; item đã archived vẫn giữ trong cart, có product=null/available=false, tên thật và giá hiện tại, cho phép remove. Wishlist giữ ID archived nhưng chỉ hiển thị metadata các sản phẩm active.

Lỗi dùng định dạng auth thống nhất success=false/error.code/message, không SQL/credential: 401 session; 403 CSRF; 400 trường ngoài whitelist; 422 input; 404 product inactive/missing hoặc update item không thuộc cart hiện tại; 409 tồn kho hoặc merge không an toàn; 405 method; 500 lỗi nội bộ đã ẩn chi tiết. Add lặp cộng lượng trong cùng dòng; update đặt lượng tuyệt đối; remove/clear/wishlist add-remove có thể gọi lại mà không tạo dòng trùng.

### Transaction, giá và tồn kho

Tất cả mutation dùng PDO prepared statements và transaction. UNIQUE carts.user_id phối hợp INSERT ON DUPLICATE KEY, sau đó SELECT cart FOR UPDATE để khóa mọi cập nhật của một user xuyên nhiều session. Khóa product FOR UPDATE khi thêm/đổi số lượng; UNIQUE(cart_id,product_id) và PK wishlist bảo vệ dòng trùng. Có lỗi thì rollback toàn transaction, không tiếp tục guest merge dở dang.

Đơn giá = sale_price_vnd khi khác null, >0 và <= price_vnd; còn lại dùng price_vnd. Thành tiền dòng = đơn giá × quantity; subtotal backend là tổng các dòng. Có chốt không vượt số nguyên an toàn của JavaScript; vượt giới hạn trả AMOUNT_OUT_OF_RANGE thay vì mất chính xác. Frontend không gửi giá và dùng subtotal/line_total do backend trả. Cả VI/EN đều VND. Không vận chuyển/thuế/đơn hàng/thanh toán; không UPDATE stock khi thêm cart.

### Guest cart và chống cộng lặp

Demo (`VITE_USE_PRODUCTS_API=false`) giữ React state riêng, không gọi Cart/Wishlist API. ID Demo không đi vào MySQL.

Guest trong API mode lưu product_id/quantity và wishlist tạm ở sessionStorage `manga-store-guest-api-v1`, tách khỏi dữ liệu tài khoản. Có thể refresh trong cùng tab. Đây là dữ liệu guest, không có cookie session, token xác thực, mật khẩu hay snapshot cart riêng tư của user trong storage.

Khi đăng nhập, hook tải cart/wishlist của user từ server. Nếu có guest data:

1. Tạo plan bất biến gồm userId để ràng buộc client, operation_key random 128 bit, merge_context từ session server, items và wishlist. Lưu plan vào sessionStorage trước request. Nếu không thể lưu an toàn, không gửi merge.
2. POST cart/merge.php gửi context/key/items/wishlist, không gửi user_id hay giá. Backend xác định user từ session và kiểm tra context. Context/key là metadata đồng bộ, không cho phép xác thực hay thay session cookie.
3. Backend lưu receipt pending vào PHP session và xác nhận ghi session thành công TRƯỚC transaction SQL. Sau đó cộng quantity, giới hạn min(stock,999), thêm wishlist bằng unique key, commit; lưu receipt done trước khi trả thành công.
4. Gửi lại cùng key/payload ở cùng context khi done chỉ đọc snapshot, không cộng lần hai. Payload đổi cùng key bị từ chối. Client chỉ xóa guest data/plan sau response xác nhận thành công và ghi trạng thái xóa thành công vào storage.
5. Nếu request đã commit nhưng response bị mất, nút Retry hoặc refresh gửi lại đúng plan/key; không tạo thao tác mới. Đã kiểm thử thực tế bằng Chrome chặn response sau commit.

Giới hạn có chủ đích: receipt pending (ví dụ worker chết ở khoảng chưa rõ commit) trả MERGE_UNCERTAIN, không tự thực thi lại. Logout/session hết hạn hoặc đổi tài khoản trước khi xác nhận làm context khác; trả MERGE_CONTEXT_CHANGED. Client giữ nguyên guest data/plan để đối chiếu thủ công, không tự xóa, không sinh key mới để cộng lại. Sản phẩm guest không còn active hoặc hết hàng có thể làm toàn batch rollback; dữ liệu guest vẫn giữ. Không khẳng định tự phục hồi an toàn qua mọi crash hoặc xuyên phiên. Muốn tự đối soát/khôi phục đầy đủ xuyên phiên cần thiết kế receipt bền vững trong database và migration được duyệt ở giai đoạn sau.

Plan giới hạn 100 product lines/100 wishlist IDs, 100 receipt trong một session; payload tối đa 8KB theo Auth::input. Chưa có giao diện xử lý thủ công plan mơ hồ hoặc sửa batch có sản phẩm đã ngừng bán. Không tự chỉnh sessionStorage hay đổi operation_key để né lỗi khi chưa kiểm tra cart server.

### React, quyền riêng tư và UI

`useCommerce` tách Demo state, API guest state và snapshot server gắn owner ID. Khi auth đổi, snapshot cũ bị ẩn ngay trong render và xóa khỏi state/ref; response/operation cũ bị bỏ qua bằng owner/epoch. Toast cũng gắn owner và hủy timer khi logout/đổi user. Cart MySQL không bị xóa khi logout.

Mutation được xếp hàng; wishlist toggle lấy trạng thái server mới nhất khi thực thi để double-click không làm sai trạng thái. Khi một mutation lỗi, hủy các thao tác chờ của epoch đó; Retry tải dữ liệu server, không lặp add không rõ kết quả. Loading/error có thông báo VI/EN; thành công cập nhật badge/heart/cart bằng snapshot server, toast thêm hàng chỉ hiện sau thành công.

Wishlist tái sử dụng nguyên Shop grid/Product Card, lọc theo ID yêu thích. Nút Wishlist ở header/Account và link `/#wishlist` mở danh sách; `/#cart` mở cart, `/#account` mở Account. Các hash chỉ hỗ trợ điều hướng hiện có, không đổi router/library/CSS. Shop thường vẫn có đủ 23 sản phẩm. API checkout vẫn disabled và giữ thông báo preview; Demo checkout UI giữ nguyên.

### File tạo/sửa trong Giai đoạn 7

Tạo:
- backend/src/CommerceRepository.php
- backend/src/commerce_bootstrap.php
- backend/public/api/cart.php, wishlist.php
- backend/public/api/cart/add.php, update.php, remove.php, clear.php, merge.php
- backend/public/api/wishlist/add.php, remove.php
- frontend/src/services/commerceService.ts
- frontend/src/hooks/useCommerce.ts
- backend/tests/commerce_fixture.php, test_commerce.py, check_commerce.mjs

Sửa:
- frontend/src/App.tsx: nối hook, hành vi Cart/Wishlist, subtotal server, badge, điều hướng wishlist/cart, dọn toast theo account; không sửa markup Product Card/Home/detail/checkout.
- frontend/src/components/AccountPanel.tsx: kích hoạt nút Wishlist hiện có và nút mobile tương ứng.
- frontend/src/services/authService.ts: export sessionRequest dùng chung transport cookie/CSRF; không đổi login/register/logout.
- frontend/src/services/productService.ts: export parser sản phẩm hiện có để reuse, không đổi cấu trúc API.
- frontend/src/i18n.tsx: chuỗi loading/error Cart/Wishlist VI/EN.
- docs/API.md và docs/AUTHENTICATION.md: tài liệu hiện tại.

Không cài dependency. index.css, Featured config, ProductImage, productAdapter và ProductRepository không đổi. Source các hàm Home, ProductCard, ProductPage và Checkout khớp trước/sau; Header chỉ kích hoạt nút Wishlist, không đổi cấu trúc/logo.

### Kiểm thử thực tế và cách chạy lại

Đã chạy trên MariaDB/Apache XAMPP, Vite 8443 và Chrome headless thật:

- `python backend/tests/test_commerce.py`: PASS add, duplicate unique, update, integer validation, stock, remove/clear, sale/totals VND, không nhận giá client, inactive/missing, CSRF/session, cô lập A/B và forged user_id, wishlist unique/persistence/removal, merge lặp/key/context/pending, rollback batch, clamp stock, hai session add đồng thời không mất cập nhật, logout/login giữ dữ liệu, Vite proxy.
- `node backend/tests/check_commerce.mjs`: PASS guest cart/wishlist không ghi server, guest refresh; commit merge rồi mất response và Retry/refresh không cộng lặp; tăng/giảm/xóa, wishlist page, double-toggle, VI/EN, tổng backend, refresh và logout/login, chuyển A/B không lộ dữ liệu/toast; desktop 1440 và mobile 390 không tràn ngang, không uncaught exception hoặc console.error. Tài khoản test/đồ thị cart được dọn trong finally.
- `node backend/tests/check_featured_images.mjs --demo`: PASS Demo Home/Shop ngoài Featured khớp baseline, bốn panel Demo/ảnh đủ và responsive không hỏng; không gọi API sản phẩm. Cấu hình .env.local được khôi phục nguyên byte về API=true.
- `node backend/tests/check_live_catalog.mjs`: PASS 23 chi tiết/35 lần chọn gallery, VI/EN/VND, search/filter, hover, guest cart, desktop/mobile và ảnh không lỗi. Catalog MySQL vẫn 23 active/8 archived, 35 ảnh.
- PHP lint, npm run build, tsc --noEmit: PASS. Vite vẫn cảnh báo native configLoader cho cấu hình Figma cũ; không chặn build.

Chạy từ project root khi Apache/MySQL và Vite đã bật:

```powershell
python backend/tests/test_commerce.py
node backend/tests/check_commerce.mjs
npm.cmd --prefix frontend run build
./frontend/node_modules/.bin/tsc.cmd --noEmit -p frontend/tsconfig.json
```

Test chỉ tạo email ngẫu nhiên auth-test-<nonce>@example.test, xác nhận không trùng trước khi chạy và xóa đúng user test; FK cascade dọn cart/wishlist tương ứng. Không dùng DELETE catalog hay reseed. Các request login/register test vẫn tính vào rate-limit auth; khi gặp 429 chờ Retry-After. Không tuyên bố kiểm thử HTTPS, load nhiều máy hoặc thực sự kill worker PHP; case pending được tạo có kiểm soát bằng CLI fixture, còn response bị mất được mô phỏng thật ở Chrome sau HTTP response stage.

Kiểm tra thủ công: vào Shop ở guest, thêm hai lần cùng sản phẩm và bấm heart; xem cart, refresh; đăng nhập User A, kiểm tra quantity chỉ cộng một lần, thêm/xóa/đổi lượng; logout rồi login A vẫn còn dữ liệu; login B phải có dữ liệu riêng. Chuyển VI/EN và mở Wishlist từ header hoặc /#wishlist. Giỏ hàng chỉ preview, chưa đặt hàng.

### Backup, dữ liệu và bằng chứng

Backup/snapshot/hashes ngoài webroot: `C:/xampp/manga-store-backups/2026-11-20-commerce/` (before.sql, before.json, after.json, source-before.json, App-before.tsx).

Sau dọn test, dữ liệu của toàn bộ 17 bảng khớp trước triển khai; users/carts/cart_items/wishlists đều trở lại 0 như baseline trên máy này. Không migration hoặc reset AUTO_INCREMENT. Các INSERT test có tiêu thụ số tự tăng users/carts/cart_items, nên ID tương lai có khoảng trống bình thường. Không thay dữ liệu sản phẩm, tồn kho, giá, ảnh, danh mục, series hoặc đơn hàng.

Báo cáo và screenshot ở frontend/.artifacts (ignore Git): commerce-api.json, commerce-browser.json, commerce-preservation.json; commerce-cart-desktop.png, commerce-cart-mobile.png, commerce-wishlist-desktop.png, commerce-wishlist-mobile.png. Có các báo cáo hồi quy catalog/Featured hiện có.

Chưa triển khai: giao diện xử lý merge mơ hồ xuyên phiên, receipt MySQL bền vững, multi-node session storage, API đơn hàng, reserve/trừ tồn kho, phí vận chuyển, thanh toán, dashboard Admin. Không giả lập giao dịch thành công.


## Giai đoạn 8 – Bước A: kiểm tra và đề xuất, CHƯA TRIỂN KHAI

Đã đối chiếu SHOW CREATE TABLE thực tế của 10 bảng yêu cầu với source schema trên MariaDB/XAMPP. Cả 17 bảng hiện có đều InnoDB. orders/payments hiện 0 bản ghi. Không thực thi DDL, không ghi dữ liệu, chưa tạo Order API hoặc đổi giao diện Checkout.

### Kết quả schema

| Bảng | Khóa/ràng buộc và khả năng hiện có |
| --- | --- |
| users | PK id, UNIQUE email; role customer/admin, status active/blocked; Auth hiện có tái sử dụng |
| addresses | PK id; FK user_id → users CASCADE; recipient_name/phone, province, district/ward nullable, address_line, is_default; đủ lưu địa chỉ |
| carts | PK id; UNIQUE user_id; FK users CASCADE; khóa cart để thống nhất với Cart API hiện tại |
| cart_items | PK id; UNIQUE(cart_id,product_id); FK carts CASCADE/products; quantity > 0 |
| products | PK id; UNIQUE sku/slug; status draft/active/archived; stock_quantity INT UNSIGNED; giá DECIMAL(14,0), CHECK giá; khóa FOR UPDATE để kiểm tra/trừ kho |
| orders | PK id; UNIQUE order_code; FK users, coupon nullable SET NULL; địa chỉ snapshot trực tiếp; customer_note; subtotal/shipping/discount/total DECIMAL(14,0), CHECK tổng tiền; thiếu metadata idempotency |
| order_items | PK id; FK orders CASCADE, products nullable SET NULL; snapshot SKU, name_vi/name_en, unit_price, quantity, line_total; CHECK thành tiền |
| payments | PK id; UNIQUE order_id; FK orders CASCADE; method cod/bank_transfer; status pending/paid/failed/refunded; amount_vnd, transaction_ref, paid_at |
| shipments | PK id; UNIQUE order_id; FK orders CASCADE; status pending/packed/shipped/delivered/returned; carrier/tracking nullable |
| inventory_movements | PK id; FK product/order/actor; order và actor nullable SET NULL; quantity_delta != 0; reason initial/restock/sale/cancel_restock/adjustment; có index product/time và order |

orders.status chính xác: pending, confirmed, processing, shipping, delivered, cancelled. Snapshot tên/giá ở order_items và địa chỉ ở orders đã đủ: lịch sử không cần lấy tên/giá từ cart hoặc địa chỉ mặc định hiện tại. Không cần thêm cột email vì checkout sẽ dùng thông tin nhận hàng bắt buộc và không triển khai gửi email ở giai đoạn này.

### Migration cần duyệt

File: `database/migrations/001_orders_idempotency.proposed.sql`.

Đề xuất chỉ thay orders:
- idempotency_key CHAR(32), ASCII binary, nullable cho đơn cũ; checkout mới dùng chuỗi hex lowercase 128 bit.
- checkout_request_hash CHAR(64), ASCII binary, nullable cho đơn cũ; SHA-256 của input checkout đã normalize, không phải password/token.
- UNIQUE(user_id,idempotency_key): mỗi user/key chỉ gắn được một đơn. Giữ UNIQUE order_code làm mã nghiệp vụ độc lập.
- CHECK hai trường cùng NULL hoặc cùng có độ dài đúng. API mới bắt buộc cả hai non-null và kiểm tra định dạng hex.

order_code unique hiện tại không tự bảo đảm một thao tác checkout trả lại đúng đơn khi handler sinh mã mới cho mỗi request. Không ghép key vào ghi chú, không dùng session receipt của guest merge làm bằng chứng đặt hàng bền vững.

Giữ tổng 17 bảng; không thay enum hoặc dữ liệu catalog, không sửa đơn cũ. File có cờ approval mặc định 0, không tự bật. Chưa chạy cả nhánh ALTER lẫn script trên server. SQL cần được kiểm chứng trên database test cô lập sau khi được duyệt. Đây là migration một lần; không chạy mù nhiều lần. DDL có implicit commit nên phải backup trước, không hứa rollback DDL bằng PDO transaction.

### Kế hoạch sau khi được duyệt

1. Sao lưu toàn bộ database và schema, kiểm tra lại tên cột/index chưa tồn tại, lấy baseline stock/catalog. Chạy migration được duyệt; xác minh cột/unique/check. Dùng DB test cô lập cho các phép thử ghi và cạnh tranh tồn kho; không thay catalog live ngoài kịch bản được kiểm soát.
2. Tạo OrderRepository/service cùng endpoint:
   - GET /api/orders/quote.php: cart thật, phí demo cấu hình backend, subtotal/total và fingerprint cart để UI không tự tính phí.
   - POST /api/orders/create.php: session/CSRF, idempotency key, fingerprint và thông tin nhận hàng; không nhận giá/user_id/status tùy ý.
   - GET /api/orders/index.php: chỉ đơn của user, mới nhất trước.
   - GET /api/orders/detail.php?id=...: chỉ đơn của user. Hỗ trợ truy cứu theo checkout key được xác thực để phục hồi sau refresh mà không lưu thông tin thanh toán nhạy cảm ở browser.
   - POST /api/orders/cancel.php: user sở hữu, chỉ pending; đã cancelled trả lại kết quả, không hoàn kho tiếp.
3. Tái sử dụng Checkout hiện có cho API mode; form người nhận/điện thoại/province/ward/address/note, chỉ COD, không input thẻ. Phí demo đề xuất mặc định 30.000 VND qua biến PHP CHECKOUT_SHIPPING_FEE_VND; quote/create cùng đọc một cấu hình, frontend chỉ hiển thị số backend trả. Đây là phí demo, không phải phí hãng vận chuyển.
4. Tích hợp Account Order History/Detail bằng snapshot lưu trong đơn, VI/EN, VND, loading/empty/error. Demo Checkout giữ nguyên và không gọi Order API. Guest API checkout chuyển Account, không xóa guest cart.

### Transaction và idempotency dự kiến

Create:
- Session/CSRF và validation trước. Normalize địa chỉ, phương thức COD, quote fingerprint; tạo request hash ổn định. Key thuộc intent checkout, giữ khi double-click/retry/refresh, không sinh lại do request lỗi.
- Tra đơn đã commit theo user/key: hash trùng → trả đơn cũ (kể cả cart đã rỗng); hash khác → 409, không tạo đơn mới. Lookup luôn lọc owner, key không phải thông tin xác thực.
- BEGIN; khóa cart của user trước để thống nhất thứ tự với Cart API; đọc lại key bằng locking read sau khóa. Không dựa vào snapshot read cũ của REPEATABLE READ để bỏ sót đơn vừa commit.
- Đọc cart, kiểm tra quantity, active; khóa products theo id tăng dần. Kiểm tra stock, tính lại unit price/sale và phí backend; số tiền phải vừa DECIMAL(14,0) và số nguyên an toàn frontend. Nếu quote đã thay đổi thì yêu cầu xác nhận lại.
- INSERT address (không tự đổi default), orders pending với key/hash và snapshot địa chỉ; INSERT order_items snapshot; payments cod/pending, paid_at=NULL; shipments pending với carrier/tracking NULL.
- Trừ stock có điều kiện stock>=quantity, kiểm tra affected rows; ghi sale với delta âm; xóa đúng cart_items đã khóa; COMMIT. Unique user/key là chốt database. Các lỗi rollback mọi insert/update/delete trong transaction; deadlock có thể retry transaction có giới hạn với nguyên key.
- 201 đơn mới, 200 replay hợp lệ. Response mất sau commit vẫn truy cứu được bằng key; replay không trừ kho, ghi movement hoặc xóa cart lần hai.

Cancel:
- BEGIN; khóa order lọc user_id FOR UPDATE, xác minh status pending và bằng chứng sale đã trừ kho cho đơn được tạo qua luồng mới.
- Đã cancelled: trả đơn hiện tại, không cộng kho. confirmed/processing/shipping/delivered không hủy bằng API customer ở giai đoạn này.
- Khóa products theo id tăng dần; hoàn đúng lượng sale, ghi cancel_restock; đổi order cancelled và COD pending thành failed (không dùng refunded cho khoản chưa thu); giữ paid_at=NULL. Schema shipments chưa có cancelled, không tự tạo enum mới hoặc giả delivered/returned. Khi đọc đơn cancelled, trạng thái đơn là nguồn quyết định nghiệp vụ, shipment pending chỉ là bản ghi chưa gửi.
- COMMIT cùng transaction. Không dựa vào nút disabled để tránh hoàn kho hai lần. Trường hợp thiếu product hoặc không có chứng từ sale phải rollback/báo lỗi, không tự đoán đã trừ kho.

### Kiểm thử dự kiến và trạng thái hiện tại

Sẽ chạy các ca người dùng yêu cầu: create/empty/out-of-stock/guest, giá và snapshot, địa chỉ, COD unpaid, stock/cart clear, rollback fault injection, hai user tranh stock 2, hai request cùng key, mất response + replay/refresh, quyền A/B, history/detail, cancel lặp và sai trạng thái, VI/EN, Demo/API, build/TS và screenshot 1440/390. Test ghi chỉ chạy sau backup và sau phê duyệt migration; ưu tiên database test cô lập với teardown được kiểm soát.

Hiện mới chạy kiểm tra read-only schema/engine/ràng buộc và counts orders/payments. Chưa chạy migration, checkout test, concurrency test, Order API hoặc GUI mới; không tuyên bố các phần này thành công. Không đổi Auth/Cart/CSS/Featured/Product Card/gallery. Điểm dừng theo yêu cầu người dùng: chờ duyệt migration trước Bước B.


## Giai đoạn 8 – Bước B hoàn thành: Checkout COD, Orders và Inventory

Trạng thái hiện tại thay thế mục đề xuất Bước A phía trên. Migration đã được người dùng duyệt và áp dụng; kiểm thử ngày 20/11/2026 trên MariaDB 10.4.32, PHP/XAMPP Apache, Vite và Chrome thật.

### Migration thực tế

Đã thực thi đúng `database/migrations/001_orders_idempotency.proposed.sql` sau backup và kiểm thử cô lập. Giữ nguyên file đã duyệt (tên proposed/comment là lịch sử), không chạy lại mù.

Chỉ orders thay schema:
- idempotency_key CHAR(32) ASCII/ascii_bin NULL.
- checkout_request_hash CHAR(64) ASCII/ascii_bin NULL.
- UNIQUE uq_orders_user_idempotency(user_id,idempotency_key).
- CHECK ck_orders_idempotency_pair: cả hai NULL, hoặc cả hai có giá trị và độ dài 32/64.

Không đổi enum hoặc bảng khác; vẫn 17 bảng. Trước migration orders=0. Database test được chèn một đơn legacy trước migration để xác minh còn hợp lệ với metadata NULL; nhiều NULL cùng owner vẫn hợp lệ. Duplicate non-null key trả MariaDB 1062; sai cặp/độ dài trả CHECK 4025. Sau migration, rows của toàn bộ 17 bảng khớp trước đó và chỉ orders schema đổi.

Backup/biên bản ngoài webroot: `C:/xampp/manga-store-backups/2026-11-20-orders/` gồm before.sql, before.json, after-migration.json, after-final.json, after.sql, source-before.json, App-before.tsx, migration-result.json, verification.json, test-environment.json. SHA-256 file migration: `108da999c35115f8cc77620489af9e688736b81026a455b4df1cec49bb528014`.

### Endpoint đã triển khai

Tất cả yêu cầu session active; POST cần JSON và X-CSRF-Token. Base Vite /api, base Apache /manga-store/backend/public/api.

| Method / path | Chức năng |
| --- | --- |
| GET orders/quote.php | Đọc cart MySQL, kiểm tra active/stock/quantity, trả items, subtotal/shipping/discount/total VND và quote_fingerprint |
| POST orders/create.php | Tạo COD transaction; 201 mới / 200 replay; trả snapshot đơn và meta.replayed |
| GET orders/index.php | Tối đa 100 đơn gần nhất của user, created_at/id giảm dần |
| GET orders/detail.php?id=... | Chi tiết snapshot, địa chỉ, COD/payment/shipment, chỉ owner |
| GET orders/detail.php?checkout_key=... | Tra cứu đơn theo user/key để phục hồi sau refresh, không thể tra đơn user khác |
| POST orders/cancel.php | Body {"order_id":123}; hủy pending hợp lệ, hoàn kho một lần |

Create body:

```json
{
  "idempotency_key": "<32 lowercase hex characters>",
  "quote_fingerprint": "<64 lowercase hex characters from quote>",
  "recipient_name": "Nguyễn An",
  "recipient_phone": "0900000000",
  "province": "Thành phố Demo",
  "district": null,
  "ward": "Phường Demo",
  "address_line": "123 Đường Demo",
  "customer_note": "Ghi chú tùy chọn",
  "payment_method": "cod"
}
```

Không nhận user_id, giá, total, phí, trạng thái hoặc sản phẩm tùy ý từ React. Key 128 bit dùng hex lowercase; backend kiểm tra format và request hash chuẩn hóa. Tên tối đa 150 ký tự; phone 8–15 chữ số và dấu + đầu tùy chọn; province/ward tối đa 120, address 255, note 2000; không ký tự điều khiển. district/note có thể NULL. Không thu thập thông tin thẻ, không gọi API địa giới hoặc vận chuyển. Không cần thêm email snapshot; không gửi email tự động ở giai đoạn này.

Lỗi JSON an toàn theo Auth: 401 chưa đăng nhập, 403 CSRF, 400 trường ngoài whitelist, 422 validation/COD/giá trị ngoài giới hạn, 404 đơn không tồn tại/không thuộc user, 409 CART_EMPTY/INSUFFICIENT_STOCK/PRODUCT_UNAVAILABLE/QUOTE_CHANGED/IDEMPOTENCY_CONFLICT/ORDER_NOT_CANCELLABLE/INVENTORY_INCONSISTENT. Không SQL/credential trong response.

### Luồng transaction và chống đơn trùng

1. Xác thực session/CSRF, normalize input và hash payload theo thứ tự cố định; key và user là unique identity của thao tác. Hash chứa quote fingerprint, địa chỉ/note và COD; không chứa giá do client tự gửi.
2. Tìm đơn đã commit theo owner/key trước khi đọc cart. Cùng hash trả lại đơn đó, kể cả cart đã rỗng hoặc đơn đã cancelled; khác hash trả 409. Không trừ kho hoặc xóa cart mới khi replay.
3. BEGIN, khóa cart user FOR UPDATE theo cùng thứ tự với Cart API; kiểm tra lại key bằng locking read (tránh snapshot cũ của REPEATABLE READ).
4. Khóa items/products theo product_id tăng dần; kiểm tra quantity 1–999, active, stock. Tính giá lại với chính sách sale hợp lệ (>0 và <= price), phí backend; kiểm tra fingerprint và giới hạn DECIMAL(14,0)/integer an toàn.
5. INSERT address không đổi default; orders pending với key/hash và địa chỉ snapshot; order_items lưu SKU/tên VI/EN/giá/quantity/thành tiền; payments cod/pending, paid_at NULL; shipments pending.
6. UPDATE stock có điều kiện đủ tồn/active, kiểm tra affected rows; ghi inventory_movements sale âm; DELETE cart_items của cart đã khóa; COMMIT. Bất kỳ lỗi trước commit rollback toàn bộ. Deadlock/lock timeout retry transaction tối đa hai lần, giữ nguyên key.
7. Unique(user,key) là chốt database trong chính transaction tạo order, không dùng session receipt hoặc disable button làm bằng chứng duy nhất. Mất response sau commit vẫn có thể retry/lookup key qua phiên đăng nhập mới của cùng user.

Phí demo: PHP đọc CHECKOUT_SHIPPING_FEE_VND, mặc định 30000 VND (digits, tối đa 9 chữ số). Có thể đặt trong cấu hình môi trường Apache và reload Apache khi cần. React không hardcode phí, quote và create dùng cùng cấu hình server. Phí thay đổi làm quote cũ không còn hợp lệ. Discount hiện bằng 0, chưa tích hợp coupon checkout.

### COD và hủy đơn

Đơn mới pending, COD payment pending/unpaid, paid_at NULL; không báo đã thanh toán khi chỉ đặt hàng. Không thu tiền, không giả giao hàng.

Cancel khóa order theo owner FOR UPDATE. Chỉ pending, có key do luồng mới tạo, payment cod/pending và shipment pending mới được hủy. Không tự suy đoán hoàn kho cho đơn legacy chưa có chứng từ. Đã cancelled trả snapshot hiện tại, không cộng lại. confirmed/processing/shipping/delivered bị từ chối.

Products được khóa theo ID tăng dần; đối chiếu net sale/cancel_restock bằng đúng quantity order_items, kiểm tra overflow trước cộng. Stock +quantity, movement cancel_restock dương, order cancelled và payment pending→failed (void COD chưa thu tiền, không giả refunded) cùng transaction. Shipment giữ pending vì enum hiện tại không có cancelled; trạng thái order cancelled quyết định đơn không được gửi. Nếu thiếu product hoặc chứng từ không nhất quán, rollback thay vì hoàn kho theo suy đoán.

### React và bảo toàn UI

API Checkout tái sử dụng class checkout/brand/form-grid/checkout-item và breakpoint hiện có; form nhận hàng Việt Nam, COD, quote backend, loading/error, đặt hàng, xác nhận code/status/unpaid và vào Account History. Cart cho vào Checkout; guest chuyển Account và vẫn giữ guest cart để merge khi login. Sau đó người dùng mở Cart/Checkout lại.

UI in-flight ref ngăn submit đôi. Trước POST lưu chỉ key vào sessionStorage `manga-checkout-intent-<userId>`; không lưu địa chỉ, phone, payload nhạy cảm hoặc session/token xác thực. Payload retry bất biến ở React memory khi chưa biết kết quả. Sau refresh, lookup bằng key chạy trước quote rỗng; trả đúng order đã commit mà không cần POST thêm. Khi đã xác nhận success, xóa intent key và đồng bộ cart/catalog. Không xóa cart frontend trước response thành công. Key mới chỉ sinh cho lần checkout mới.

Account hiển thị danh sách mới nhất, snapshot detail, địa chỉ, method/payment, trạng thái và hủy đơn; data gắn owner và component được remount theo user. Chuyển VI/EN dùng i18n sẵn có, tiền luôn VND. Language được chọn qua header trước khi vào Checkout (giữ cách Checkout gốc ẩn header).

VITE_USE_PRODUCTS_API=false vẫn render nguyên hàm Checkout Demo, không gọi Order API hoặc tạo đơn. VITE_USE_PRODUCTS_API=true dùng ApiCheckout; hash #checkout hỗ trợ phục hồi khi refresh. Không sửa CSS chung, Header/Home/Featured/ProductCard/ProductPage/gallery; source hàm Demo Checkout giữ nguyên. New components chỉ dùng class/utility hiện có để tương thích mobile.

### File mới và file sửa

Mới:
- backend/src/OrderRepository.php, backend/src/orders_bootstrap.php.
- backend/public/api/orders/quote.php, create.php, index.php, detail.php, cancel.php.
- frontend/src/services/orderService.ts.
- frontend/src/components/ApiCheckout.tsx, OrdersPanel.tsx.
- backend/tests/orders_fixture.php, test_orders.py, check_orders.mjs, check_demo_checkout.mjs.

Sửa:
- frontend/src/App.tsx: bật Checkout API, nhánh Demo riêng, #checkout, refresh cart/catalog sau order/cancel, truyền callback cho Account.
- frontend/src/components/AccountPanel.tsx: thêm OrdersPanel trong Account API; Demo vẫn phần cũ.
- frontend/src/i18n.tsx: thêm chuỗi Order VI/EN, không thay hệ thống i18n.
- backend/tests/check_live_catalog.mjs: cập nhật assertion nút checkout từ preview-disabled sang entry có auth guard.
- docs/API.md, docs/AUTHENTICATION.md: trạng thái và hướng dẫn hiện tại.

Migration file đã duyệt được giữ nguyên và áp dụng, không thay 01_schema.sql gốc. Máy mới dùng base schema cần áp dụng migration một lần sau khi import; không áp dụng lại trên dump after.sql đã có hai cột/index/check. Không cài dependency.

### Kết quả kiểm thử thực tế

Môi trường cô lập: database `manga_store_orders_test_20261120`, bản backend Apache tại `C:/xampp/htdocs/manga-store-orders-test-20261120/manga-store/backend`. Root Require local, config/src HTTP 403. PHP session, PDO, MariaDB và HTTP thật; không mock kết quả SQL. Vite tạm dùng proxy target http://localhost/manga-store-orders-test-20261120, rồi khôi phục .env.local nguyên byte. Môi trường test được giữ local để có thể chạy lại; user/orders/addresses/cart/movement test đã dọn và stock/metadata trong bản test đã phục hồi.

- API `test_orders.py`: PASS valid/empty/guest, totals/fee VND, Order/Item/address snapshot, COD pending/unpaid, stock giảm đúng/cart clear, CSRF/input/owner, same-key replay/hash conflict/lookup, snapshot không đổi khi product name/price test thay, hủy lặp hoàn kho/movement một lần, tranh stock=2 chỉ một 201 và một 409 INSUFFICIENT_STOCK, stock không âm, hai session cùng user/key trả cùng order, retry không trừ tiếp, payment INSERT trigger lỗi rollback toàn bộ, out-of-stock/archived và delivered cancel bị chặn, history mới nhất và session persistence.
- Chrome `check_orders.mjs`: PASS guest checkout chuyển login không mất cart; form EN/VI/VND, COD; hai submit liên tiếp chỉ một request; chặn response sau khi server commit rồi retry vẫn một order/stock một lần; refresh sau response mất lookup bằng key mà không POST lần nữa; History/Detail/address, double cancel không cộng kho tiếp, user B không thấy order A; desktop 1440/mobile 390 không tràn ngang, không uncaught exception hoặc console.error.
- Demo `check_featured_images.mjs --demo`, `check_demo_checkout.mjs`: PASS Home/Shop baseline, đủ panel, Checkout Demo nguyên form, 0 Order API, desktop/mobile.
- Catalog `check_live_catalog.mjs`: PASS 23 detail/35 gallery selection, images, price VND, VI/EN, filter/search, cart, desktop/mobile. Không ảnh lỗi.
- Live Apache smoke cho 5 endpoint mới: 401 UNAUTHENTICATED đúng khi chưa login. Bản live chưa tạo order test (orders=0); các ca ghi/concurrency/rollback/GUI đã chạy trên bản Apache/MariaDB cô lập.
- PHP lint, build và TypeScript: PASS. Formatter oxfmt sẵn có chỉ định dạng ba file frontend mới. Cảnh báo Vite native configLoader của config Figma cũ vẫn còn, không chặn build.
- Snapshot live trước/sau: rows toàn bộ 17 bảng giống hệt; chỉ orders schema thay đổi. Stock, giá, tên, ảnh/catalog không đổi. Hash index.css/Featured config/ProductImage/CommerceRepository/auth_bootstrap khớp; source Header/Home/ProductCard/ProductPage/Demo Checkout khớp trước/sau.

Báo cáo ở frontend/.artifacts: orders-api.json, orders-browser.json, orders-demo.json, orders-preservation.json. Screenshot: orders-checkout-desktop-en.png, orders-checkout-mobile-en.png, orders-success-desktop.png, orders-detail-desktop.png, orders-detail-mobile.png, orders-refresh-recovered-mobile.png và hai ảnh Demo Checkout. Artifacts bị ignore Git.

### Demo quy trình đặt hàng

1. Bật Apache/MySQL và Vite; giữ VITE_USE_PRODUCTS_API=true, không để proxy target test trong .env.local.
2. Đăng ký/đăng nhập user, chọn sản phẩm trong Shop, kiểm tra Cart và số lượng. Guest có thể thêm trước login; Checkout chuyển login và bảo toàn giỏ.
3. Bấm Proceed to Checkout. Điền người nhận, số điện thoại, tỉnh/thành, phường/xã, địa chỉ, note tùy chọn. Quote hiển thị giá MySQL + phí demo backend; chỉ COD.
4. Bấm Đặt hàng COD. Xác nhận hiển thị mã đơn, Chờ xác nhận và Chưa thanh toán. Cart đã được server làm rỗng. Không thu tiền/thẻ.
5. Bấm Order History hoặc mở Account, chọn chi tiết để xem snapshot và địa chỉ. Chuyển ngôn ngữ ở header Account để đọc VI/EN.
6. Hủy đơn pending: trạng thái đổi Cancelled, stock được hoàn một lần. Bấm lại API/hủy trùng không hoàn thêm. Đơn delivered hoặc đã tiến hành xử lý không hủy bằng customer API.

Đây là thao tác ghi đơn/tồn kho THẬT trong database dù thanh toán là COD demo. Muốn trình diễn mà không tác động catalog live, dùng môi trường test cô lập đã nêu và khôi phục proxy sau khi thử.

Chạy lại test khi môi trường cô lập tồn tại:

```powershell
python backend/tests/test_orders.py
# GUI: tạm đặt PRODUCTS_API_PROXY_TARGET=http://localhost/manga-store-orders-test-20261120
# trong .env.local, chờ Vite reload, rồi:
node backend/tests/check_orders.mjs
# Khôi phục proxy gốc ngay sau kiểm thử.
npm.cmd --prefix frontend run build
./frontend/node_modules/.bin/tsc.cmd --noEmit -p frontend/tsconfig.json
```

Scripts fixtures chỉ cho database test tên trên; không thể dùng fixture sửa stock của manga_store. Test tạo email nonce auth-test-...@example.test và cleanup đúng user/order test, không seed lại catalog live. Kiểm tra auth rate-limit nếu chạy lặp nhiều lần (429/Retry-After).

### Khôi phục và giới hạn

- Lỗi đặt/hủy trước commit: PDO transaction rollback, không cần restore toàn DB; retry giữ key cũ. Response mất sau commit: lookup/replay key, không sửa stock thủ công.
- Nếu cần rollback code, ưu tiên tắt lối Checkout mới/revert code Giai đoạn 8 trong khi giữ các cột nullable đã thêm; Auth/Cart cũ vẫn tương thích. Commit nền trước Bước B: 348315fda7968d912564ad4a7579ded940eb1caf. Không tự drop cột hoặc xóa đơn.
- before.sql là bản đầy đủ trước migration; after.sql là bản đầy đủ sau migration (không order test). Khi thật sự phải khôi phục, nhập backup vào một database khôi phục riêng trước, kiểm chứng schema/counts/stock rồi mới chuyển cấu hình theo kế hoạch. Restore before.sql vào live sẽ bỏ schema mới và mất các đơn phát sinh sau backup; chỉ làm khi đã có phê duyệt và đối soát dữ liệu mới, đồng thời rollback/disable code Checkout mới. Không thực hiện restore live tự động.
- Chưa có dashboard/fulfillment, thu tiền COD, giao vận, email, cổng thanh toán, coupon checkout hoặc pagination sau 100 order mới nhất. Chưa test deployment HTTPS hoặc tải nhiều máy. Chưa tích hợp địa giới. Orders legacy có NULL idempotency vẫn hợp lệ/đọc được nhưng không tự hủy hoàn kho nếu không thuộc luồng có chứng từ đã xác minh.


## Phase 9 - Admin Dashboard (2026-11-22)

Access http://localhost:8443/#admin after Admin login, or Account > Admin. Uses existing session, CSRF and VI/EN context. Every Admin endpoint enforces PHP role checks: guest 401, customer 403. No migration or enum changes. Admin always uses real APIs; storefront Demo mode remains unchanged.

### Files and endpoints

New backend: src/AdminRepository.php, src/admin_bootstrap.php, src/AdminImageUpload.php. New frontend: src/admin/AdminApp.tsx, adminService.ts, admin.css (scoped styles). Tests: backend/tests/admin_fixture.php, test_admin.py, check_admin.mjs.

All endpoint paths below are relative to /api/admin/:

| Method | Files | Purpose |
| --- | --- | --- |
| GET | dashboard.php | Active products, orders, pending work, low stock, collected COD |
| GET | orders.php, order.php?id=... | Paginated search/filter and order snapshot detail |
| POST | order-status.php | Transactional workflow/cancellation |
| POST | payment-confirm.php | Explicit actual COD collection with reference |
| GET | products.php, product.php?id=..., metadata.php | Products, gallery, existing categories/series |
| POST | product-create.php, product-update.php, product-archive.php | Create, edit, activate/archive without DELETE |
| GET | inventory.php, inventory-movements.php | Stock and latest 50 movements |
| POST | inventory-adjust.php | Signed delta, expected stock and mandatory reason |
| GET | customers.php | Customer search/basic data/order count; no password hashes |
| POST multipart | image-upload.php | Admin-only append image |

Lists default to 20 rows, maximum 50 per page. Low-stock threshold: 5.

Integration edits: App.tsx hash branch keeps StoreApp mounted; AccountPanel.tsx opens Admin after backend verification; i18n.tsx adds Admin translations; authService.ts adds multipart using existing CSRF; orderService.ts exports the existing order validator. OrderRepository.php adds only an optional audit actor to the existing cancel method. check_auth.mjs expects the implemented Admin entry. Existing Phase 8 Order/Checkout files are not new Phase 9 features.

### Workflow and data safety

Exact allowed forward workflow: pending -> confirmed -> processing -> shipping -> delivered. Order/shipment records are locked in one transaction; expected_status prevents stale changes. Delivery never marks payment paid. Cancellation reuses the Phase 8 OrderRepository transaction/policy: pending, unpaid COD, shipment pending, verified sale movements. Duplicate admin/customer cancellation restores stock once; audit records the Admin actor.

COD collection is a separate delivered-order action with explicit receipt checkbox and reference. Backend records paid_at and actor/reference. Repeating the same confirmation does not double count; conflicting reference is rejected. Revenue includes only COD payments marked paid with paid_at/reference and delivered orders. This is an administrator's attestation of money received, not automatic bank reconciliation or a payment gateway.

Product SKU/slug uniqueness and existing foreign keys are enforced. Category/series selectors reuse existing metadata. Metadata edits require a version; concurrent stock/metadata changes cause conflict. Stock is entered only on creation; later changes use Inventory with integer nonzero delta, expected_stock and reason. SELECT FOR UPDATE, bounds checks and inventory_movements share one transaction. No automatic write retries after ambiguous responses: reload stock/history first. Inventory adjustment has no durable operation receipt for an ABA scenario where stock changes and returns to the same expected value.

Upload requires Admin+CSRF; JPG/PNG/WebP only, <=5 MiB and <=8 million pixels. Uses finfo/MIME, dimensions, extension consistency and PHP marker checks, then existing ProductImageStorage. Original multipart filename is never the storage path; PHP may sanitize a traversal filename to its basename. Generated random names use exclusive creation, safe paths, no overwrite. Apache blocks PHP execution in the upload directory. Failed DB insertion cleans only the new file; abrupt process termination can leave an orphan file for manual reconciliation. GD is unavailable on this XAMPP: full decode/re-encoding and antivirus scanning are NOT implemented. Images append by sort_order; primary is set only if no primary exists. Existing catalog images are not modified.

### Admin account and use

From repository root:

```powershell
./backend/scripts/manage_admin.ps1 -Action create -Email "admin@example.test" -FullName "Manga Store Admin"
./backend/scripts/manage_admin.ps1 -Action promote -Email "admin@example.test"
```

Create prompts for a hidden password; promote requires email confirmation. No default password/account is embedded. No live Admin was created during implementation. Customer management is read-only; no role/status mutation endpoint.

Use Orders to search/filter, inspect snapshots and advance one valid step. Use Products to add/edit metadata or archive; existing orders retain snapshots. Use Inventory for subsequent stock changes with a reason. Confirm actual COD receipt separately after delivery.

### Actual verification

- HTTP + PHP CLI: test_admin.py PASS on manga_store_admin_test_20261122. Covered auth/CSRF, validation, pagination, unique/FK, stale versions, concurrent inventory writes, checkout-vs-inventory race, movement actor/reason, valid upload and invalid MIME/SVG/PHP/oversize, random paths, HTTP image bytes, PHP execution 403, order workflow, unpaid delivery excluded from revenue, confirmed COD replay, archive/edit preserving snapshots, one-time cancellation restock and immediate permission revocation.
- Chrome GUI: check_admin.mjs PASS. Login/permissions, dashboard, create/edit/archive/activate/upload, inventory/history, order search/filter/detail/workflow/payment/cancel, customer read-only search, VI/EN and responsive 1440/900/390. Zero uncaught exceptions or console.error. Reports/screenshots: frontend/.artifacts/admin-*.
- Regression: test_orders.py PASS including rollback, concurrent stock contention, concurrent same-key checkout/replay and ownership. check_orders.mjs, check_auth.mjs, check_commerce.mjs, check_demo_checkout.mjs, check_featured_images.mjs --demo and check_live_catalog.mjs PASS. Demo checkout made zero Order API requests; live images loaded.
- Build, TypeScript noEmit and Admin/OrderRepository PHP lint PASS. Existing Vite warning about future native config loader remains non-blocking.
- All write tests used isolated clones and nonce-scoped cleanup. Live before/after snapshots match all 17 table schemas and row hashes: 23 active + 8 archived products, 35 images; no live test users/orders. Protected customer CSS, Featured, ProductImage, Auth bootstrap, CommerceRepository and ProductImageStorage hashes are unchanged. Original .env.local was restored with VITE_USE_PRODUCTS_API=true.

To repeat Admin tests, CLI uses DB_NAME=manga_store_admin_test_20261122. Temporarily set Vite PRODUCTS_API_PROXY_TARGET=http://localhost/manga-store-admin-test-20261122 and restore the original .env.local afterwards. Apache clone is Require local. Never point fixture scripts at live DB. Phase 8 regression uses its separate orders-test clone.

### Recovery and limitations

Private full backup: C:/xampp/manga-store-backups/2026-11-22-admin/before.sql (outside webroot). before.json/after.json contain table comparisons; sources.json contains protected-file hashes. No restore is needed because live data did not change. Restore into a separate recovery database first, verify counts/FKs/stock, then switch configuration under a controlled plan. Do not overwrite live after new orders without reconciliation. Code rollback requires no schema rollback.

Not implemented: category/series CRUD, image delete/reorder/primary switching, permanent product deletion, customer role/status changes, refunds, carrier/bank integration, antivirus or production HTTPS tests. Cancellation remains limited to the verified pending policy; legacy inconsistencies are not repaired automatically. No fabricated revenue or customer redesign.


## Giai đoạn 10 — Business Analytics & Reporting (22/11/2026)

Truy cập `http://localhost:8443/#admin/reports` sau khi đăng nhập Admin, hoặc chọn **BÁO CÁO & THỐNG KÊ** trong sidebar. Giao diện quản trị dùng chung VI/EN, style monochrome riêng và biểu đồ SVG không cài dependency. Không đổi frontend khách hàng, Auth, OrderRepository, AdminRepository, CommerceRepository hoặc schema. Không migration.

### File tạo và sửa

Tạo:

- `backend/src/ReportRepository.php`: kỳ báo cáo, aggregate SQL và transaction chỉ đọc.
- `backend/src/reports_bootstrap.php`: kiểm tra Admin, JSON/CSV, chống formula injection.
- `backend/public/api/admin/reports/{overview,revenue,orders,products,categories,export}.php`.
- `frontend/src/admin/AdminReports.tsx`, `reportService.ts`, `reports.css`.
- `backend/scripts/seed_reports_demo.php`: kế hoạch/seed/cleanup chỉ cho database mô phỏng cô lập.
- `backend/tests/test_reports.py`, `check_reports.mjs`: kiểm thử HTTP/CLI và Chrome thực tế.

Sửa `frontend/src/admin/AdminApp.tsx` để thêm tab, `frontend/src/i18n.tsx` để thêm bản dịch, README và tài liệu API này. Không sửa CSS toàn cục, Product Card, Featured, banner, catalog hoặc enum.

### API chỉ đọc

Tất cả yêu cầu GET, PHP session hợp lệ và role admin. Guest 401, customer 403, sai method 405. Không có API ghi báo cáo.

| Endpoint dưới `/api/admin/reports/` | Kết quả |
| --- | --- |
| overview.php | Một snapshot gồm period, 10 KPI, giá trị đơn/AOV, trend, status, Top 10 và category |
| revenue.php | Trend ngày/tháng/năm, zero-fill các kỳ không phát sinh |
| orders.php | Phân bổ 6 trạng thái đơn hiện tại trong kỳ; danh sách đơn chi tiết vẫn dùng Admin Orders sẵn có |
| products.php | Top 10 theo số lượng đã giao, hòa thì theo giá trị bán và ID/SKU |
| categories.php | Danh mục hiện có gồm Manga, Novel, Figure và các danh mục khác; zero nếu chưa bán |
| export.php | CSV revenue/orders/products/inventory |

Ví dụ:

```text
/api/admin/reports/overview.php?preset=30days&group=day
/api/admin/reports/revenue.php?preset=custom&start=2026-01-01&end=2026-01-31&group=month
/api/admin/reports/export.php?preset=custom&start=2026-01-01&end=2026-01-31&group=day&type=revenue&language=vi
```

Response JSON thống nhất `{success:true,data:...}`. Partial endpoints trả `{period,items}`. `overview` trả toàn bộ trong cùng transaction `READ ONLY`, isolation `REPEATABLE READ` để tránh KPI/biểu đồ đọc các snapshot khác nhau. Chỉ SELECT cho dữ liệu nghiệp vụ; SET SESSION/SET TRANSACTION chỉ điều khiển kết nối, không sửa bảng. Không lộ thông tin kết nối hoặc lỗi SQL. Prepared statements cho thời gian; group/order SQL chỉ từ allowlist cố định.

### Công thức KPI và quy tắc thời gian

Enum thực tế orders: pending, confirmed, processing, shipping, delivered, cancelled. Payments: pending, paid, failed, refunded; method cod hoặc bank_transfer. Mỗi order chỉ có một payment nhờ UNIQUE(order_id), nhưng aggregate đơn vẫn truy vấn orders độc lập, không JOIN order_items để đếm đơn.

| Chỉ số | Công thức |
| --- | --- |
| Tổng đơn | COUNT orders có created_at trong kỳ, bao gồm đơn hủy |
| Chờ xác nhận | Trong tập trên, status=pending |
| Đang xử lý/giao | status IN (confirmed, processing, shipping) |
| Đã hoàn thành | status=delivered |
| Đã hủy | status=cancelled |
| Tổng customer | Tất cả users.role=customer hiện tại, gồm cả blocked; không lọc thời gian |
| Sản phẩm đang bán | products.status=active hiện tại; không lọc thời gian |
| Sắp hết hàng | active và stock_quantity<=5 hiện tại; không lọc thời gian |
| Số lượng đã bán | SUM order_items.quantity của các đơn hiện delivered, tạo trong kỳ |
| COD thực nhận | SUM payments.amount_vnd: cod, paid, paid_at khác null, reference không rỗng, order hiện delivered, paid_at trong kỳ |
| Giá trị đơn tạo | SUM orders.total_vnd trong kỳ theo created_at, kể cả đơn hủy; không phải doanh thu thu tiền |
| AOV đơn tạo | AVG total_vnd của toàn bộ đơn tạo trong kỳ, làm tròn số nguyên VNĐ; 0 khi không có đơn |
| COD trung bình | AVG amount_vnd của các khoản COD đủ điều kiện thu trong kỳ, làm tròn VNĐ |

Top sản phẩm/danh mục dùng SUM quantity và SUM line_total_vnd từ snapshot order_items của đơn delivered tạo trong kỳ. Giá trị này là hàng hóa đã giao, chưa gồm phí giao hoặc giảm giá cấp đơn, không phải số COD đã thu. Không lấy giá sản phẩm hiện tại để tính lịch sử bán. Đơn hủy không tính số lượng bán/giá trị hàng đã giao, nhưng vẫn xuất hiện trong tổng đơn và giá trị đơn tạo. Delivered chưa thanh toán không tính COD.

Quy ước báo cáo: `Asia/Ho_Chi_Minh`, UTC+7. Schema dùng DATETIME không gắn múi giờ; MariaDB thực tế 10.4.32 có SYSTEM=Asia/Bangkok, offset +07:00, các writer hiện có dùng CURRENT_TIMESTAMP mặc định đó. PHP mặc định máy là Europe/Berlin nhưng Reports dùng DateTimeImmutable với timezone chỉ định, không dựa vào mặc định PHP. Frontend hiển thị ngày báo cáo do backend trả, không chuyển sang timezone trình duyệt. Không đổi timezone toàn cục hoặc sửa thời gian cũ.

Backend kiểm tra offset kết nối kế thừa bằng NOW()/UTC_TIMESTAMP(); nếu không +07:00, trả REPORT_TIMEZONE_ERROR 503 thay vì âm thầm diễn giải sai dữ liệu. Kết nối report sau đó SET SESSION time_zone='+07:00', không cần bảng timezone MySQL. Khi chuyển máy phải bảo đảm timezone writer MySQL cũng là +07:00 trước khi tạo dữ liệu; không chỉ thay cấu hình report để che dữ liệu lịch sử khác múi giờ.

Ngày bắt đầu và kết thúc trên UI đều bao gồm; SQL dùng `[start 00:00:00, day_after_end 00:00:00)`. Không dùng BETWEEN để tránh trùng mốc ngày. Tối đa 366 ngày, ngày hợp lệ 2000–2099. Preset today, 7days (hôm nay và 6 ngày trước), 30days, month (đầu tháng đến hôm nay), year (01/01 đến hôm nay), custom. Group day/month/year chỉ đổi cách gộp, không mở rộng kỳ khi bắt đầu/kết thúc giữa tháng. Bấm **ÁP DỤNG** mới đổi report; xuất CSV dùng bộ lọc đã áp dụng, không dùng form nháp chưa áp dụng.

### Biểu đồ và CSV

Revenue Trend: cột đen COD theo paid_at, cột xám giá trị đơn theo created_at; có title khi hover và bảng dữ liệu có thể mở. Hai loại giá trị không cộng lại. Status, Top 10, category dùng thanh ngang kèm giá trị rõ ràng. Empty state và 0 khi chưa có đơn/khoản thu; không tạo dữ liệu để lấp biểu đồ.

CSV gồm UTF-8 BOM, header VI/EN và giá trị tiền số nguyên không dấu phân cách hàng nghìn. Không dùng float cho tổng tiền: SQL CAST CHAR, TypeScript giữ decimal string, Intl.NumberFormat dùng BigInt. Chỉ tính tỷ lệ chiều cao cột bằng số làm tròn cho việc vẽ; số hiển thị/CSV không lấy lại từ tỷ lệ đó. CSV không chứa email, địa chỉ, số điện thoại, password hash hoặc session.

- Revenue: cùng bucket/filter với biểu đồ, số đơn tạo, giá trị đơn tạo, AOV, số khoản thu và COD đã thu.
- Orders: tối đa 10.000 đơn theo created_at; số COD từng đơn phản ánh xác nhận hiện tại của đơn đó, không được cộng như report thu tiền theo paid_at.
- Products: đúng Top 10 delivered cùng bộ lọc.
- Inventory: tối đa 10.000 sản phẩm, snapshot hiện tại của mọi trạng thái. Không giả làm tồn kho tại ngày quá khứ; bộ lọc ngày không tái dựng lịch sử tồn kho. Cần công cụ riêng nếu danh sách vượt 10.000; không cắt dữ liệu âm thầm.

Formula injection: prefix apostrophe cho text bắt đầu =, +, -, @, kể cả bị che bởi whitespace/control/BOM, và chuỗi bắt đầu tab/CR/LF. fputcsv escape dấu nháy và delimiter; không biến tiền thành công thức. Cột `data_mode` trên từng dòng CSV là SIMULATED cho database demo/test cho phép, DATABASE cho database chính. CSV giữ nguyên chữ số chính xác; Excel có giới hạn 15 chữ số có nghĩa khi tự đọc ô số — với tổng cực lớn cần nhập dạng text trong Excel để bảo toàn toàn bộ chữ số. Tệp CSV và UI không bị giới hạn float JavaScript.

### Dữ liệu mô phỏng riêng cho đồ án

Script **không chấp nhận manga_store**. Chỉ cho `manga_store_reports_demo` hoặc `manga_store_reports_test_20261122`, CLI-only. Không tạo Admin/mật khẩu mặc định. `--plan` mặc định không ghi; `--apply` chủ động và `--cleanup` có transaction. SKU/order prefix RPTSIM-, user reports-simulation@example.test và tên SIMULATION. Tạo 3 sản phẩm riêng, 12 đơn mô phỏng, payment và ledger tương ứng; không sửa 31 sản phẩm/35 ảnh catalog đã clone. Chạy lại seed hợp lệ không tạo trùng; partial fixture bị từ chối để kiểm tra trước. Không có giao dịch ngân hàng/thanh toán thật.

Để trình diễn trên máy khác:

1. Export database gốc bằng phpMyAdmin, giữ backup; tạo database cô lập `manga_store_reports_demo`, import cấu trúc/dữ liệu bản sao. Không chọn database gốc để chạy seed. Oracle bên dưới giả định không có đơn cũ trùng kỳ mô phỏng.
2. Cấu hình bản backend demo riêng trỏ clone đó. Giữ Require local cho alias Apache demo; không đổi kết nối live chỉ để trình diễn.
3. Chạy CLI với DB_NAME chỉ định, vẫn dùng credential local hiện có; không viết mật khẩu vào command/source:

```powershell
$env:DB_NAME='manga_store_reports_demo'
try {
  & C:/xampp/php/php.exe backend/scripts/seed_reports_demo.php --plan
  # Chỉ chạy trên clone sau khi xem kế hoạch:
  & C:/xampp/php/php.exe backend/scripts/seed_reports_demo.php --apply
  # Tạo Admin cho clone, mật khẩu nhập ẩn:
  ./backend/scripts/manage_admin.ps1 -Action create -Email 'admin-demo@example.test' -FullName 'Demo Admin'
} finally { Remove-Item Env:DB_NAME -ErrorAction SilentlyContinue }
```

4. Trỏ Vite proxy tạm đến alias backend demo riêng (theo cấu hình proxy hiện có), đăng nhập Admin của clone, mở Reports. Có banner **DỮ LIỆU MÔ PHỎNG**, CSV từng dòng SIMULATED. Chọn Custom 01/01/2026–31/01/2026. Số liệu dự kiến: 10 đơn, giá trị đơn 3.000.000 VNĐ, COD thu 560.000 VNĐ, 8 đơn vị hàng đã giao. Đơn RPTSIM-F tạo cuối tháng 12 nhưng thu đầu tháng 1 minh họa khác nhau giữa created_at/paid_at.
5. Dọn fixture bằng cùng DB_NAME và `seed_reports_demo.php --cleanup`; thao tác này không xóa Admin tạo riêng bằng công cụ khác. Khôi phục `.env.local`/proxy gốc; không restore hoặc seed đè database chính. Trước cleanup, lưu mọi thay đổi muốn giữ trong clone.

Đã chạy và dọn fixture trên clone test; **chưa seed database chính, chưa tạo database demo chứa doanh thu giả để thay live**. Test precision tạo thêm 100 đơn cực lớn tạm trong clone rồi dọn theo cùng namespace; không thuộc 12 đơn dành cho trình diễn.

### Kết quả kiểm thử thực tế

- HTTP/PHP CLI `python backend/tests/test_reports.py`: PASS quyền của cả 6 API, GET-only, empty/zero-fill, ngày sai/range>366/SQL-like/array params, multi-item không đếm trùng, tất cả KPI, hủy/paid/unpaid/reference thiếu/bank transfer, Top/category, ngày đầu/cuối và mốc tháng sau, paid_at khác created_at, day/month/year/presets/năm nhuận, cả 4 CSV VI/EN/BOM/formula injection và exact totals > Number.MAX_SAFE_INTEGER. Snapshot row hash cả 17 bảng giữ nguyên khi chỉ đọc Reports/CSV trên clone.
- Chrome headless `node backend/tests/check_reports.mjs`: PASS entry Admin, empty, KPI dữ liệu mô phỏng, filter custom/day/month/year và lỗi range, tải thật 4 CSV qua UI, VI/EN giữ kỳ và giá VNĐ, screenshot 1440/900/390 không tràn viewport; chủ động giả lập HTTP 503 rồi retry thành công. Không uncaught exception hoặc console error ngoài lỗi tài nguyên 503 cố ý tạo. Artifacts `frontend/.artifacts/reports-browser.json`, `reports-api.json`, `reports-*.png`, `reports-downloads/`.
- Hồi quy thực tế: `test_orders.py`, `test_admin.py`, `check_admin.mjs`, `check_demo_checkout.mjs`, `check_live_catalog.mjs` PASS. Checkout concurrency/idempotency/rollback/cancel một lần, Admin workflow/COD/upload/inventory và UI desktop/mobile vẫn đạt. Live catalog đủ 23 chi tiết/37 lượt chọn gallery, VI/EN/VND/ảnh không lỗi; Demo checkout không gọi Order API.
- Frontend build, TypeScript noEmit và PHP lint các file report/seed/endpoint PASS. Vite vẫn có cảnh báo cấu hình native loader tương lai từ trước, không làm build thất bại.

Clone kiểm thử local-only: database `manga_store_reports_test_20261122`, Apache prefix `http://localhost/manga-store-reports-test-20261122`. GUI cần tạm đặt PRODUCTS_API_PROXY_TARGET tương ứng trong frontend/.env.local và khôi phục sau khi chạy. Fixtures test giới hạn đúng database; không chạy trên live. Không dùng các chỉ số/ảnh test như doanh thu thật.

### Giới hạn chính xác của chỉ số

Không có snapshot category trong order_items: dùng danh mục sản phẩm hiện tại; sản phẩm mất FK được ghi Chưa phân loại. Không tái dựng category lịch sử. Top sản phẩm dùng tên snapshot đại diện (MAX theo collation) và SKU snapshot nhỏ nhất nếu một sản phẩm từng đổi tên/SKU; ID là khóa nhóm, khi mất product_id thì nhóm theo SKU snapshot. Không sửa tên/giá lịch sử.

Không có audit trạng thái theo thời gian: report lọc ngày tạo nhưng dùng trạng thái hiện tại, không phải trạng thái tại thời điểm cuối kỳ. Tồn kho/customer/active là snapshot hiện tại, không phải số phát sinh trong kỳ. Có inventory_movements nhưng không giả định đủ dữ liệu ledger từ thời điểm bắt đầu để dựng tồn kho quá khứ. COD là khoản đã xác nhận, chưa phải lợi nhuận và chưa điều chỉnh chi phí/hoàn tiền; không triển khai refund mới.

Giới hạn 366 ngày và CSV 10.000 dòng bảo vệ khối lượng đọc; chưa benchmark quy mô production lớn, chưa PDF, chưa lập lịch gửi báo cáo. Không thay đổi enum, không thêm index/migration. Snapshot live và hash source trước/sau lưu riêng ngoài webroot tại `C:/xampp/manga-store-backups/2026-11-22-reports/`. Vì chức năng chỉ đọc, rollback chỉ cần bỏ tab/API Reports; không cần rollback schema/dữ liệu.

Đối chiếu baseline Giai đoạn 10 thực tế: 23 active, 8 archived, **37 bản ghi ảnh**, 0 đơn hàng. 37 ảnh đã có từ trước khi triển khai Reports và giữ nguyên cả rows/hash; khác con số 35 trong mô tả ban đầu và backup Giai đoạn 9 dùng làm clone test. Không thêm/xóa ảnh live trong giai đoạn này.


## Giai đoạn 11A — Admin Product Images & Manga Flipbook (22/11/2026)

### Phạm vi và kiểm tra trước triển khai

Đã kiểm tra form AdminProducts/AdminProductForm, product-create/update, AdminRepository, AdminImageUpload, ProductImageStorage, ProductRepository, ProductsProvider/useProduct, Gallery/ProductCard, schema products/product_images và quy tắc inventory. Chức năng thêm sản phẩm, sửa metadata và upload một ảnh đã có; giai đoạn này hoàn thiện chính các luồng đó, không tạo form/API sản phẩm trùng.

product_images có PK id, FK product_id -> products.id ON DELETE CASCADE, image_url, alt_vi/en, sort_order, is_primary; không có unique-primary constraint. Mọi writer ảnh qua API hiện khóa parent products trước, rồi mới đọc/ghi ảnh; dùng transaction và normalize để đúng một ảnh chính nếu có ảnh. Không thay đổi schema/enum và không migration. Stock chỉ nhập ban đầu khi tạo, sửa tồn kho vẫn qua Inventory như trước.

### File mới và sửa

Tạo:

- backend/src/AdminImageManager.php.
- backend/public/api/admin/image-replace.php, image-delete.php, image-primary.php.
- backend/scripts/audit_product_images.php (CLI audit chỉ đọc, không xóa file).
- frontend/src/admin/AdminProductImages.tsx, product-images.css.
- frontend/src/components/loading/MangaFlipbookLoader.tsx, manga-flipbook-loader.css.
- backend/tests/images_fixture.php, test_images.py, check_images.mjs, check_flipbook.mjs.

Sửa:

- backend/src/AdminImageUpload.php: reuse validator/upload hiện có, hỗ trợ replace và normalize primary; cleanup kiểm tra tham chiếu/path.
- frontend/src/admin/AdminApp.tsx: hoàn thiện quy trình tạo kèm ảnh và dùng image manager.
- frontend/src/admin/adminService.ts: type ảnh/primary/sort_order, ba thao tác mới và invalidation event.
- frontend/src/hooks/useProducts.tsx: refresh catalog/detail khi có sự kiện sản phẩm thay đổi.
- frontend/src/App.tsx: chỉ import/mount loader cạnh StoreApp trong các provider; không sửa markup customer.
- frontend/src/i18n.tsx: nhãn nút + THÊM SẢN PHẨM, thao tác ảnh, trạng thái/validation và loader VI/EN.
- backend/tests/check_admin.mjs: cập nhật kỳ vọng nút + ADD PRODUCT theo yêu cầu mới.
- README và docs/API.md này.

### Tạo/sửa sản phẩm và ảnh

Vào `http://localhost:8443/#admin/products`, bấm **+ THÊM SẢN PHẨM**. Dùng form hiện có: SKU/slug, tên/mô tả VI/EN, category/series hiện có, giá VNĐ/sale, stock ban đầu, draft/active/archived. Unique SKU/slug, giá, số nguyên không âm và FK được PHP kiểm tra; dữ liệu input không bị reset khi API báo lỗi. Không gửi stock trong API sửa metadata.

Có thể chọn ảnh đầu tiên ngay trong form, xem preview bằng blob URL và bỏ chọn. Nếu chọn ảnh: tạo sản phẩm draft trước, lưu ID vào state ngay; upload ảnh vào ID đó; chỉ sau khi ảnh thành công mới áp dụng trạng thái đã chọn. Không báo hoàn tất toàn bộ khi upload/status request lỗi. Khi lỗi từng bước, có thông báo sản phẩm draft đã tồn tại và tiếp tục trên cùng ID; không tạo lại. Version được đối chiếu để không ghi đè metadata bị đổi trong lúc upload.

Nếu mất phản hồi upload, **không tự động retry**: dùng Reload gallery để kiểm tra ảnh đã lưu hay chưa. Có thể bỏ chọn file đang chờ, xem ảnh đã có rồi lưu trạng thái tiếp. Nếu thiếu ảnh trong luồng tạo kèm ảnh chưa hoàn tất, UI chặn kích hoạt khi người dùng chỉ bỏ chọn nhưng chưa lưu ảnh; vẫn có thể chủ động giữ draft/archived. Trường hợp tạo không chọn ảnh vẫn theo hành vi hiện có/placeholder; không tự gán ảnh Demo.

Mỗi ảnh có thumbnail contain, ID, nhãn ảnh chính, THAY ẢNH, XÓA ẢNH, ĐẶT LÀM ẢNH CHÍNH nếu chưa là primary. Các nút nằm ngoài nội dung ảnh. Thêm ảnh hỗ trợ từng file theo backend hiện tại, có preview và trạng thái busy/success/error. Không upload batch, không drag/drop reorder.

### API ảnh

Các endpoint POST đều bắt buộc session Admin + CSRF. Không tin product_id/image_id nếu chưa kiểm tra quan hệ. API sản phẩm cũ không đổi đường dẫn.

| Endpoint dưới /api/admin/ | Input | Kết quả |
| --- | --- | --- |
| image-upload.php (cũ) | multipart product_id, image; alt_vi/en tùy chọn | Nối ảnh mới cuối gallery, đặt primary nếu chưa có |
| image-replace.php | multipart product_id, image_id, expected_image_url, image | Giữ ID, sort_order, alt và primary; đổi URL sang file mới |
| image-delete.php | JSON product_id, image_id, expected_image_url | Xóa đúng liên kết ảnh; primary mới là primary còn lại hoặc ảnh đầu sort_order/id |
| image-primary.php | JSON product_id, image_id, expected_image_url | Một primary duy nhất, không đổi sort_order |

Upload/replace trả data gồm id, image_url, cleanup. Delete/primary trả product_id, image_id, cleanup. cleanup khi bỏ liên kết cũ có `{image_url,status:"retained_for_recovery",remaining_references}`; primary không có file bỏ liên kết nên cleanup=null. Gallery được tải lại qua Admin product.php. Customer ProductRepository vẫn trả primary và toàn bộ gallery theo sort_order rồi id như trước.

ID ảnh khác sản phẩm: IMAGE_NOT_FOUND 404; URL đã thay đổi: STALE_IMAGE 409; xóa ảnh cuối của active: LAST_ACTIVE_IMAGE 409. Chỉ xóa ảnh cuối khi sản phẩm không active, hoặc thay ảnh thay vì xóa. Set-primary lặp lại an toàn. Hai request replace cùng expected URL: một thành công, request còn lại 409. Không dùng index mảng làm ID.

### File và transaction

Dùng validator/ProductImageStorage đã có: JPEG/PNG/WebP, tối đa 5 MiB và 8 triệu pixel cho Admin; kiểm tra finfo MIME, extension, nội dung/kích thước và dấu PHP; stage file tạm do server tạo, tên random 32 hex, exclusive create, không overwrite, không Base64 MySQL. Apache upload directory vẫn chặn thực thi PHP. XAMPP chưa có GD: không tuyên bố đã decode/re-encode đầy đủ hoặc quét antivirus.

Replace: xác minh quyền/CSRF và ảnh thuộc sản phẩm; stage file mới, ghi URL trong transaction, normalize primary rồi commit. Ảnh cũ tuyệt đối không bị xóa trước khi ảnh mới lưu xong. Rollback dọn file mới chỉ khi đường dẫn thực sự thuộc root quản lý, không symlink, filename đúng định dạng và không còn record nào tham chiếu URL. Nếu không xác minh được DB/commit hoặc unlink lỗi, giữ file và log để audit thay vì xóa một ảnh có thể đã commit. Không tuyên bố filesystem có thể rollback bằng MySQL.

**Chính sách bảo toàn:** replace/delete chỉ bỏ liên kết database; file cũ được giữ lại để khôi phục, kể cả còn record khác tham chiếu. Không có API tự động unlink file cũ. Vì vậy ảnh dùng chung/external path không bị xóa nhầm. Audit chỉ liệt kê file managed numeric-folder/32hex chưa được tham chiếu, bỏ qua symlink, không xóa bất kỳ file nào:

```powershell
& C:/xampp/php/php.exe backend/scripts/audit_product_images.php
```

Cần theo dõi dung lượng và đối chiếu backup trước khi quyết định dọn file thủ công. Chưa có nút garbage collection tự động. Khi process dừng bất ngờ có thể còn file staging/mồ côi; audit managed files và log/temporary-directory housekeeping giúp đối soát. Không truy cập/xóa đường dẫn do client cung cấp.

### Đồng bộ storefront và cache

Sau thao tác ảnh thành công, service phát `manga-products-updated` với product_id thật. Provider catalog và detail tương ứng refetch, giữ page/cart state và không tải lại toàn bộ website. Demo provider bỏ qua sự kiện, không trộn ID. Tên file mới khi replace tạo URL mới nên không dính cache ảnh cũ; không tắt caching toàn website. Không sửa ProductImage, ProductCard, Gallery markup, CSS khách hàng, banner hay hover. Tab trình duyệt khác không có realtime push; tải lại dữ liệu ở tab đó khi cần.

### Manga Flipbook startup loader

Component nằm trong AuthProvider/ProductsProvider, cạnh StoreApp; không tạo wrapper layout mới cho website. Sách mở có bìa/gáy, hai trang nền và sáu trang lật hai mặt; các ô truyện/speed lines CSS nguyên bản, không dùng ảnh manga có bản quyền, GIF hay dependency animation. Transform-origin ở gáy, rotateY từ phải sang trái; chu kỳ 2.1 giây, lệch pha giữa các trang, bóng nhẹ và monochrome. CSS được scope .manga-startup-loader, không sửa global CSS.

Loader xuất hiện từ lần render React đầu tiên của mỗi lần khởi tạo trang. Với storefront, chờ catalog kết thúc loading (success **hoặc error**); với đường dẫn Admin ban đầu, chờ kiểm tra session kết thúc. Không chờ auth vốn không thiết yếu cho trang mua sắm. Khi ready, fade opacity 160ms rồi unmount; không có thời gian giữ giả 2 giây. Site nhanh có thể chỉ thấy loader thoáng qua. Có backstop 13 giây; product service timeout 12 giây hiện có sẽ đưa app sang error/retry. Chuyển hash nhanh kết thúc overlay, không tái hiện.

Không chạy lại khi mở sản phẩm, thêm giỏ, đổi wishlist, refresh catalog sau sửa ảnh, hay thao tác Admin. React StrictMode cleanup timer/listener; component được giữ ở cùng vị trí provider để latch gone không reset theo trang. Không remount Hero, không đổi scroll position, không khóa scroll hoặc chặn tương tác trong fade. role=status/aria-live thông báo VI/EN; hình sách aria-hidden. prefers-reduced-motion tắt animation, bỏ transform sâu và transition; sách tĩnh, thoát ngay khi ready.

### Kiểm thử thực tế

**HTTP/PHP CLI** trên database và uploads `manga_store_images_test_20261122`/alias Apache local-only riêng:

- `test_images.py` PASS: Admin/session/CSRF; SKU và slug trùng; giá/stock/FK không hợp lệ; upload/primary; replace giữ ID/order/primary; URL cũ còn truy cập được; file sai MIME/SVG/PHP/polyglot/oversize bị từ chối; inject lỗi UPDATE ảnh rollback cả DB và file mới; concurrent replace cho 200/409; xóa primary chọn fallback ổn định; chặn ảnh cuối active; archived cho phép xóa ảnh cuối; không đổi ảnh sản phẩm khác hoặc stock; audit file giữ lại chỉ đọc.
- Hồi quy `test_admin.py`, `test_reports.py` PASS trên clone riêng: workflow/COD/inventory/ownership/CSRF và số liệu báo cáo/CSV vẫn đúng.

**GUI Chrome thực tế**:

- `check_images.mjs` PASS: preview/bỏ chọn ảnh; tạo kèm ảnh; lỗi duplicate giữ form; lỗi upload giữ một draft ID và tiếp tục cùng ID; upload thêm, replace, lỗi replace giữ ảnh; primary/delete/last-active; Shop và Product Detail nhận ảnh mới không reload; refresh giữ dữ liệu; VI/EN, 1440/900/390 không tràn viewport.
- `check_flipbook.mjs` PASS: giữ request để quan sát loader thật; sáu trang có computed transform thay đổi theo frame, duration 2.1s; screenshot desktop/tablet/mobile; không reset scroll; không lặp khi đổi Shop; VI/EN; reduced motion animation=none; chuyển hash nhanh; API 503 và **timeout 12s thật** thoát loader và hiện retry. StrictMode của main.tsx vẫn bật. Đây là kiểm thử chuyển động/khung hình, chưa benchmark FPS trên thiết bị vật lý.
- Hồi quy `check_admin.mjs`, `check_reports.mjs`, `check_demo_checkout.mjs`, `check_featured_images.mjs --demo`, `check_live_catalog.mjs` PASS. Demo checkout không gọi Order API, Featured Demo giữ nguyên; Live kiểm tra 23 detail và 37 gallery selections, VI/EN, VND, hover và ảnh không lỗi. Không uncaught JavaScript exception hoặc console error ngoài HTTP 503 cố ý giả lập cho test lỗi.
- Build, TypeScript noEmit và PHP lint API/manager/upload/audit/fixture PASS. Cảnh báo native config loader tương lai của Vite từ trước vẫn không chặn build.

Bằng chứng: frontend/.artifacts/images-api.json, images-browser.json, flipbook-browser.json; images-*.png, flipbook-*.png. Các ghi dữ liệu kiểm thử có nonce, chỉ trong clone và đã cleanup. Không thử xóa/replace ảnh catalog chính.

Chạy lại test ảnh cần proxy tạm PRODUCTS_API_PROXY_TARGET=http://localhost/manga-store-images-test-20261122 và các fixture CLI dùng đúng DB_NAME=manga_store_images_test_20261122; script kiểm tra database cứng trước khi ghi. Khôi phục .env.local sau test. Loader test chỉ đọc Live catalog, không tạo user/order.

### Backup, rollback và giới hạn

Đã backup toàn bộ database **và uploads** tại `C:/xampp/manga-store-backups/2026-11-22-images-loader/`: before.sql, before.json, uploads/, upload-hashes.json, sources.json. Nằm ngoài Apache root. Đối chiếu sau triển khai phải giữ nguyên schema/rows cả 17 bảng và bytes toàn bộ uploads: live 23 active + 8 archived, 37 ảnh. Không migration hay ghi catalog live trong giai đoạn này.

Nếu cần khôi phục một ảnh đã thay/xóa sau này: đối chiếu backup row với sản phẩm đúng, kiểm tra file retained/hash, phục hồi liên kết/primary trong transaction và refresh catalog; không chỉ đoán theo tên file. Nếu cần restore toàn bộ, import SQL vào database phục hồi riêng, copy uploads backup sang kho phục hồi riêng, kiểm chứng FK/URL/hash trước khi chuyển cấu hình. Không đè DB/uploads live có giao dịch mới khi chưa đối soát. Rollback code loader/ảnh không yêu cầu rollback schema.

Giới hạn: từng file một; chưa reorder/đổi alt qua UI; không garbage-collect file cũ tự động, không realtime đa tab, không antivirus/GD reencode. Upload/create chưa có durable operation idempotency key: khi mất response phải kiểm tra gallery/SKU/ID trước khi gửi lại, không blind retry. SQL unique SKU/slug và expected_image_url tránh phần lớn thao tác trùng/stale, không thay thế đối soát kết quả chưa rõ. Không thay đổi nghiệp vụ Auth/Cart/Checkout/Reports hoặc Demo catalog.

Kết quả đối chiếu cuối 11A: PASS — schema và rows/hash của cả 17 bảng không đổi; 23 active, 8 archived, 37 bản ghi ảnh; toàn bộ 39 file trong uploads giữ nguyên bytes/hash. App khách hàng đối chiếu byte khớp bản trước khi bỏ đúng import/mount loader được phép. CSS khách hàng, ProductImage/ProductRepository, Featured, Orders/Commerce và hai file Reports giữ nguyên hash. Bằng chứng: backup folder/verification.json. Proxy và VITE_USE_PRODUCTS_API=true đã được khôi phục.


## Giai đoạn 11B — Dynamic Hero, Series Explorer, Collections & True-color (22/11/2026)

### Audit và phạm vi

Baseline thực tế: 23 sản phẩm active, 8 archived, 37 ảnh, 17 bảng; manga_series có 18 dòng nhưng chỉ 7 series đang có manga active. Catalog active gồm 14 manga, 3 novel và 6 figure. Sáu figure thuộc 5 series (Frieren và Fern cùng Frieren); chưa có phụ kiện active. Không ghi MySQL, không seed, không migration hoặc thay ảnh nguồn trong giai đoạn này.

Source thực tế trước sửa: Home Hero là bố cục generic ENTER THE WORLD OF MANGA; VOID RUNNER/Runner 404 nằm trong trang Series cũ. Trang Series cũ trải 4 sản phẩm đầu catalog dưới section ENTER THE VOID, chưa phải explorer series/figure. Hero và trang Series Live nay lấy catalog thật; Hero/Series Demo cũ được giữ độc lập, không dùng ID MySQL. Không mở rộng Header/navigation, Footer, Auth, Cart, Checkout, Admin hoặc Reports.

### File tạo/sửa

Tạo frontend/src/discovery/:

- catalogModel.ts: nhóm dữ liệu, nhận diện/sắp xếp/tìm tập và chọn Hero.
- DynamicHero.tsx: carousel dữ liệu thật.
- SeriesExplorer.tsx: Series Explorer/Detail và FigureCollections.
- routes.ts: parse hash series/collections/product hợp lệ.
- discovery.css: style riêng cho bốn khu vực được nâng cấp.

Tạo frontend/src/components/true-color-gallery.css. Tạo test scripts: backend/tests/check_discovery_model.mjs, check_discovery.mjs, check_discovery_resilience.mjs, check_true_color.mjs, capture_discovery.mjs.

Sửa App.tsx (nhánh Live Hero/Series/Collections, hash route và nguồn quay lại từ Product Detail), ProductImage.tsx (variant opt-in trueColor), i18n.tsx (VI/EN), types/product.ts và services/productService.ts (metadata series tùy chọn), hooks/useProducts.tsx (refetch chỉ đọc khi rời Admin), backend/src/ProductRepository.php (SELECT/serialize metadata có sẵn). Sửa check_live_catalog.mjs để kỳ vọng 7 Series Card thay cho 4 Product Card cũ và log đúng số gallery; check_orders.mjs thêm chờ network/form sẵn sàng và chẩn đoán không ghi mật khẩu. README và API.md được cập nhật. Không cài dependency.

### API và dữ liệu

Không có endpoint Series mới hoặc endpoint trùng. Dùng GET /api/products.php và GET /api/product.php?id=... hiện có, chỉ trả products.status=active. Response bổ sung vào series các field có sẵn trong schema: description_vi, description_en, is_active. Frontend vẫn đọc được response cũ thiếu các field tùy chọn này. Không trả dữ liệu tài khoản hoặc thông tin kết nối.

Tất cả mô hình discovery tính từ ProductsProvider hiện có, qua productService/adapter; không HTTP trực tiếp trong JSX. Product ID, giá, stock, tên và URL ảnh giữ từ API. Series title chỉ có một trường chung trong schema, nên dùng nguyên tên chính thức đó ở cả hai ngôn ngữ; không tự tạo tên EN/VI khác. Mô tả các series manga hiện đều NULL: Detail không bịa mô tả. Hero dùng mô tả DB nếu có, nếu thiếu thì dùng câu tagline biên tập VI/EN từ cấu hình featuredManga đã có (các câu đã được người dùng cung cấp ở giai đoạn trước), không coi chúng là mô tả nhà xuất bản.

### Dynamic Hero

Cấu hình ưu tiên tại catalogModel.ts, theo slug đã kiểm chứng:

| Thứ tự | Slug |
| --- | --- |
| 1 | one-piece |
| 2 | attack-on-titan |
| 3 | naruto |
| 4 | dragon-ball |

Tên/ảnh/count/link được lấy từ các nhóm manga active hợp lệ, không hardcode ID hoặc số lượng. Tối đa 4 slide; nếu một nhóm ưu tiên không còn sản phẩm, có thể bổ sung một nhóm manga thật khác từ catalog. Không dùng archived, figure hoặc novel làm Hero manga. Ảnh đại diện là sản phẩm có ảnh đầu tiên theo thứ tự tập tăng/ID ổn định; bình thường là tập 1. Chỉ dùng URL ảnh sản phẩm local từ API, không thêm hotlink/download/banner mới hoặc AI artwork.

Hero split chữ/bìa, contain, nền tối, gradient, grayscale và lớp editorial riêng. Autoplay 6 giây, crossfade 450ms, Previous/Next, indicators và Pause/Play. Dừng khi hover, focus trong Hero, document.hidden hoặc prefers-reduced-motion; cleanup timer/listener khi unmount. Inactive slides có aria-hidden/inert, nút có nhãn VI/EN; frame cố định để không layout shift. Reduced motion không autoplay và không transition. Không gọi loader toàn màn hình khi đổi slide.

Loading/error dùng ProductState và retry thật, không fallback âm thầm sang Demo. Không có series hợp lệ thì empty; không ảnh thì placeholder generic, không gán artwork sai series. File ảnh mới sau thao tác Admin có URL mới, và event refetch hiện có cập nhật data; không tắt cache toàn website.

### Series Explorer và Series Detail

Live routes:

```text
#series
#series/one-piece
#collections
#collections/frieren-beyond-journeys-end
#product/<ID thật từ API>
```

Header/navigation chính giữ nguyên. CTA Hero, Featured Card và Series Card mở đúng #series/<slug>. Series Detail mở volume đúng product_id. Product Detail có breadcrumb quay lại nguồn; browser Back và VI/EN giữ state tìm kiếm/sort/filter trong StoreApp theo slug. Product origin cũng được lưu theo từng history entry để không lấy ID từ vị trí mảng. Direct link Product Detail tải theo ID thật.

Explorer mặc định hiển thị 7 Series Card, không phải 14 volume rời. Chỉ group source API + category.slug=manga, series tồn tại và không bị inactive. Không đưa novels/figures vào số tập. Tên series từ FK/API; ảnh đại diện theo thứ tự tập và ID ổn định; giá min/max là giá hiệu lực VNĐ từ API. Số ấn phẩm active được ghi riêng, không nói là tổng tập xuất bản.

Không có volume_number trong schema. volumeOf đối chiếu tên VI/EN của sản phẩm để nhận diện Tập N, Vol. N, Volume N; chỉ chấp nhận số nguyên dương và một giá trị nhất quán. Dải/combo/omnibus, số thập phân hoặc VI/EN mâu thuẫn trả unknown, không dùng SKU/index để đoán số tập. Với dữ liệu hiện tại, cả 14 sản phẩm manga đều nhận diện nhất quán tập 1 hoặc 2. Sắp xếp bằng số (2 trước 10); unknown nằm cuối ổn định theo ID và có nhãn chưa xác định.

Khi biết đủ metadata, count volume là số tập khác nhau, không nhân đôi nếu có nhiều ấn bản cùng tập. Nếu thiếu số tập, chỉ ghi số ấn phẩm thay vì giả count volume. Stock count ghi rõ số ấn phẩm còn hàng. Có disclaimer đây là catalog tại cửa hàng, không phải tổng số tập chính thức của tác phẩm.

Search series dùng title + tên VI/EN của các sản phẩm liên kết; chuẩn hóa Unicode NFD, bỏ dấu và đ/Đ, không phân biệt hoa thường. Search tập nhận chính xác 1/Tập 1/Volume 1, không match nhầm 10 hoặc 21; còn lại tìm keyword tên/SKU. Có ascending/descending và checkbox còn hàng. Dùng lại ProductCard và commerce callbacks; bổ sung nút Detail/Add to Cart luôn thấy trong grid mới để dễ thao tác cảm ứng, không sửa ProductCard/Shop CSS. Hết hàng thì disable Add.

### Figure & Accessories Collections

Thay section ENTER THE VOID ở Live Series bằng **TỪ HƯ VÔ THÀNH HIỆN THỰ** / **FROM NOTHINGNESS TO REALITY**. Có thể mở riêng từ CTA trong Hero/Series. Chỉ nhận category.slug=figures hoặc accessories; tên và nhóm theo series FK thật. Không đoán từ tên nhân vật. Thiếu FK thì nhóm Khác/Chưa phân loại.

Hiện có 5 nhóm: Frieren: Beyond Journey’s End (Frieren/Fern), My Dress-Up Darling, The Apothecary Diaries, SPY × FAMILY và Bocchi the Rock!. Figure/Accessories/All có count tính từ data; Accessories hiện 0 và empty state rõ ràng, không tạo phụ kiện giả. Search tên VI/EN/nhân vật hoặc tên series; chọn series mở collection tương ứng, giữ query/category khi xem sản phẩm rồi quay lại. Sản phẩm accessory thật thêm vào danh mục hiện có sẽ xuất hiện sau refetch mà không seed/reset app.

### True-color Product Detail

Nguyên nhân đã xác định: index.css đặt filter: grayscale(0.9) contrast(1.1) cho .thumbs img và .main-image img. Ngoài ra body::before là lớp grain fixed z-index 20. Không phải lỗi cần tô màu hoặc sửa file nguồn.

ProductImage mặc định vẫn editorial, không thêm DOM attribute ở các vị trí cũ. Chỉ hai call-site main/thumbnail của Product Detail dùng variant=trueColor. CSS scope trong .product-page .gallery: filter none, opacity 1, mix-blend-mode normal, object-fit contain, nền trắng. Gallery riêng đặt z-index 21/isolation để ảnh không bị grain phủ; Header vẫn z-index 50. Không xóa grain/grayscale toàn trang, không thay font, frame, grid, viền, chức năng chọn thumbnail hoặc hover Shop.

Chrome đã tải/audit 37 ảnh nguồn qua canvas sample 64x64, phát hiện pixel màu trong tất cả, không có file bị xác định hoàn toàn grayscale trong đợt kiểm tra này. Không có danh sách ảnh cần thay để phục hồi màu và không chỉnh sửa bất kỳ pixel/file nào. Nếu upload sau này vốn trắng đen, variant chỉ hiển thị đúng file đó, không tự phục hồi/tô màu. Kiểm thử Your Name và Frieren xác nhận main/thumbnail giữ màu, contain, không filter/opacity/blend từ ancestor, và nằm trên lớp grain.

### Kiểm thử thực tế và screenshots

- check_discovery_model.mjs PASS: API 23 sản phẩm; 7 nhóm manga/14 tập; 5 nhóm figure/6 sản phẩm; 0 phụ kiện; Hero priority/fallback; search bỏ dấu; numeric 1/2/10, query exact và unknown/range/decimal/mâu thuẫn; lọc stock. Case 10 và dữ liệu thiếu là object fixture trong test, không seed vào database.
- check_discovery.mjs PASS bằng Chrome thật: 4 Hero đúng title/cover, autoplay chờ thực 6 giây, Prev/Next, pause/hover/focus/tab ẩn/reduced motion; Series/volume routing/search/sort/back; Cart/Wishlist guest; figure grouping/filter/empty; source color audit; VI/EN và 1440/900/390, CTA/title không bị cắt, không tràn ngang. Không uncaught exception hoặc console.error.
- check_discovery_resilience.mjs PASS: cố ý trả 503 để kiểm tra error/retry và loader thoát; placeholder khi mất ảnh; unknown series không mở sản phẩm khác; response-only probes refetch volume/stock/primary-photo và restore API thật. Các probe chỉ sửa JSON trong headless browser, không cập nhật database/ảnh. Không dùng kết quả mô phỏng làm dữ liệu production.
- check_true_color.mjs PASS cho Your Name/Frieren ở 1440/900/390: gallery trên grain, ancestor không filter/opacity/blend, ảnh contain và có màu nguồn.
- Hồi quy thực tế: test_orders.py/test_admin.py/test_reports.py trên clone PASS; GUI check_auth/check_commerce/check_admin/check_reports/check_orders PASS. Checkout vẫn double-submit/lost-response replay/refresh, trừ-hoàn kho một lần và cô lập account. Test account-switch ban đầu gặp CSRF_INVALID khi logout quá nhanh sau request hủy/đồng bộ; helper nay chờ request nền và form tương tác sẵn sàng. Không sửa Auth hoặc bỏ CSRF; không tuyên bố đã cải thiện nghiệp vụ overlap logout với request chưa hoàn tất.
- check_demo_checkout, check_featured_images --demo, check_live_catalog và check_flipbook PASS: Demo không gọi product/order API, Home Demo/Shop/Featured giữ nguyên; Live đủ 23 detail/37 gallery; loader không bị hỏng. Hero/Series Demo cũ giữ độc lập; true-color là thay đổi có chủ đích trong Product Detail ở cả hai chế độ.
- Build/TypeScript noEmit/PHP lint ProductRepository PASS. Không dependency mới; cảnh báo native config loader tương lai của Vite từ trước vẫn không chặn build.

Ảnh trước/sau desktop thực tế: frontend/.artifacts/11b-before-{hero,series,figures,novel,figure}.png và 11b-after-{hero,series,figures,novel,figure}.png. Ảnh responsive sau: 11b-hero/series/volumes/collections-{900,390}-vi.png; ảnh Detail true-color ở ba kích thước: 11b-true-color-CAT-...-{1440,900,390}.png. Báo cáo JSON: discovery-browser.json, discovery-resilience.json, true-color-browser.json. Có screenshot trạng thái Hero error/no-image/Series not-found. Before screenshots ở 1440px; không tuyên bố đã chụp Before ở tablet/mobile.

Chạy kiểm thử read-only mới từ root bằng Node hiện có (Node 24 hỗ trợ import type-stripped TS cho test model):

```powershell
node backend/tests/check_discovery_model.mjs
node backend/tests/check_discovery.mjs
node backend/tests/check_discovery_resilience.mjs
node backend/tests/check_true_color.mjs
npm.cmd --prefix frontend run build
./frontend/node_modules/.bin/tsc.cmd --noEmit -p frontend/tsconfig.json
```

### Bảo toàn dữ liệu và giới hạn

Snapshot/source baseline tại C:/xampp/manga-store-backups/2026-11-22-discovery/ (ngoài webroot), gồm before.json, App.tsx/index.css trước chỉnh sửa, hash file bảo vệ và uploads. Các kiểm thử ghi Auth/Orders/Admin/Reports chỉ trên clone nonce-scoped được cleanup, không trên manga_store. Cấu hình .env.local/proxy được khôi phục sau test.

Không migration, không sửa giá/stock/catalog, không upload/download ảnh mới. Không có Series CRUD hoặc volume_number có cấu trúc; nhận diện tập an toàn từ tên chỉ là giải pháp tương thích schema hiện tại. Series descriptions hiện thiếu nên không có mô tả dài giả. Search/filter client-side phù hợp catalog hiện tại; chưa benchmark catalog rất lớn. Autoplay/pause đã test Chrome, chưa benchmark FPS trên thiết bị vật lý. Realtime đa tab chưa triển khai; dữ liệu đổi qua Admin xuất hiện sau refetch hiện có.

Nếu cần rollback giao diện, dùng bản App.tsx trước chỉnh sửa và bỏ các component/style Discovery/variant liên quan theo version control; metadata API bổ sung vẫn tương thích client cũ. Không cần restore database/schema vì phần nghiệp vụ mới chỉ đọc. Không import lại seed hoặc ghi đè uploads để rollback UI.

Bổ sung 11B: ProductsProvider trong hooks/useProducts.tsx refetch công khai khi rời hash Admin về storefront, ngoài event cập nhật sản phẩm đã có. Nhờ đó archive/đổi metadata trong Admin cũng được phản ánh khi quay lại mà không sửa mã Admin hay reset app. Handler chỉ GET, Demo bỏ qua; loader latch không chạy lại. Resilience test dùng response-only fixture kiểm tra cả luồng rời Admin, không ghi catalog live.

Đối chiếu cuối 11B: PASS — cả 17 bảng giữ nguyên schema/rows/hash, 23 active + 8 archived, 18 series trong DB, 37 bản ghi ảnh, toàn bộ 40 file uploads giữ nguyên bytes/hash. Header/Footer/ProductCard/Cart/Checkout/Account/Demo Hero/Demo Series giữ nguyên source; ProductPage chỉ thêm hai prop trueColor; các file Auth, Orders/Commerce, Admin/Reports và Flipbook giữ nguyên hash. Bằng chứng verification.json nằm trong backup folder discovery. VITE_USE_PRODUCTS_API=true và proxy gốc đã được khôi phục.


## Giai đoạn 11C — Sửa vị trí Hero, khôi phục Homepage gốc (22/11/2026)

Đính chính phạm vi 11B: Dynamic Manga Hero thuộc trang Bộ truyện, không thuộc Homepage. Không revert toàn bộ App/commit 11B.

### Thay đổi production

- App.tsx: bỏ điều kiện chỉ giữ Hero trắng ở Demo để Hero gốc hiển thị ở Home trong cả Demo và Live; chuyển đúng component DynamicHero hiện có lên trước SeriesExplorer trên landing #series Live.
- Tạo frontend/src/discovery/series-hero-placement.css: chỉ selector con .series-hero-slot, chiều cao slider 520px desktop, 560px tablet, 740px mobile, font/bìa/padding vừa frame. Không sửa CSS của Homepage.

Home JSX khớp Hero source trước 11B và Hero trong Git HEAD 47581c4 (Xay dung admin). Header/Footer/Featured và mọi section dưới Hero giữ nguyên. Asset gốc dùng lại: images.open (Unsplash photo-1763732397864-5b860bb298b0), images.shelf (photo-1709675577960-0b1e7ba55347), CharacterArt vẽ bằng DOM/CSS cùng các panel, speech bubble và animation float sẵn có. Hai URL ảnh đều được Chrome xác nhận tải thành công; không thiếu asset, không thêm ảnh hoặc dựng lại mascot.

Bản dịch hiện có tiếp tục tạo tiêu đề VI BƯỚC VÀO / THẾ GIỚI CỦA / MANGA., nhãn SỐ 001 / TOKYO / TOÀN CẦU, mô tả, hai CTA và BẠN ĐÃ SẴN SÀNG?. EN vẫn dùng nội dung gốc. CTA khám phá mở trang Series; Mua ngay mở Shop. Vị trí/style/hover của CTA và CSS animation Homepage không đổi.

#series Live nay theo thứ tự Header -> một DynamicHero -> CHỌN THẾ GIỚI CỦA RIÊNG BẠN -> search -> 7 Series Card và các section 11B còn lại -> Footer. Không đặt slider trong grid, không nhân đôi series. Series Detail #series/<slug> không có slider để không đẩy volume/search xuống dưới. Demo giữ Series demo độc lập như 11B, không sử dụng ID MySQL.

DynamicHero.tsx, catalogModel.ts, SeriesExplorer.tsx và logic route/filters/commerce của 11B không sửa. Giữ 4 manga/cover/count/link từ API, autoplay 6s, Previous/Next/indicator, pause/hover/focus/hidden tab/reduced motion. Figure Collections và true-color gallery không đổi. Không sửa PHP, Product API, MySQL, Auth, Cart, Checkout, Admin, Reports hoặc Flipbook Loader.

### Kiểm thử và screenshot thực tế

- check_hero_placement.mjs mới: PASS Home và Series riêng biệt, Hero trắng/mascot/halftone/float/2 CTA/VI-EN, không slider ở Home, đúng một slider trước Explorer, 4 slide/7 card, CTA vào đúng 2 volume và không chèn Hero ở Detail. Không horizontal overflow ở 1440/900/390; kiểm tra cả 4 tiêu đề/CTA trong kích thước Series mới.
- check_discovery.mjs và check_discovery_resilience.mjs chỉ cập nhật vị trí mở slider từ Home sang #series: PASS autoplay thực 6s, điều hướng, pause hover/focus/tab ẩn/reduced motion, Explorer/search volume/filter/back, figure, guest cart/wishlist, API loading/error/retry/placeholder và refetch. Không viết lại component slider.
- check_true_color.mjs PASS: Your Name/Frieren và gallery 1440/900/390 giữ nguyên màu/contain/lớp trên grain.
- GUI hồi quy check_auth, check_commerce, check_admin, check_reports, check_orders trên clone PASS. Demo check_demo_checkout/check_featured_images --demo PASS; Live check_live_catalog PASS 23 detail/37 gallery; check_flipbook PASS startup/readiness/error/timeout/reduced motion. Không uncaught JavaScript exception hoặc console.error ngoài 503 cố ý trong resilience test.
- npm build và TypeScript noEmit PASS. Không thay PHP nên không có PHP lint mới cần thiết trong 11C. Cảnh báo cấu hình Vite native-loader tương lai là cảnh báo cũ, không làm build thất bại.

Screenshot Home (không dùng ảnh Series làm bằng chứng Home): frontend/.artifacts/11c-home-{1440,900,390}-vi.png, 11c-home-390-en.png. Có thêm 11c-home-1896-vi.png ở 1896x982 để đối chiếu trực quan ảnh tham chiếu người dùng. Screenshot Series tách riêng: 11c-series-{1440,900,390}-vi.png. Báo cáo hero-placement-browser.json ghi trạng thái tải hai artwork gốc. Đối chiếu source/asset và quan sát screenshot, chưa tuyên bố pixel-diff/pixel-perfect giữa môi trường render/zoom và ảnh tham chiếu.

File báo cáo/test sửa thêm: backend/tests/check_hero_placement.mjs (mới), check_discovery.mjs, check_discovery_resilience.mjs; README và API.md này. Không cài dependency.

### Bảo toàn

Baseline và verification tại C:/xampp/manga-store-backups/2026-11-22-hero-placement/ ngoài webroot. Đối chiếu xác nhận App chỉ khác đúng các điểm tích hợp trên; tất cả file frontend còn lại trước 11C (bao gồm index.css, i18n, slider, Explorer, Figure, gallery, Loader, Auth, Admin/Reports) giữ nguyên hash. Toàn bộ PHP/API giữ nguyên hash. Schema và rows/hash của cả 17 bảng không đổi; 23 active, 8 archived, 37 ảnh và toàn bộ 40 file uploads giữ nguyên. Các test ghi chạy trên clone có cleanup, không ghi catalog chính. .env.local được khôi phục với VITE_USE_PRODUCTS_API=true và proxy gốc.

## Giai đoạn 11D — Navigation, Figure Collections và About (22/11/2026)

### Audit và phạm vi

Header trong App.tsx có một cấu hình links dùng cho cả desktop/mobile. Lỗi Phụ kiện do `[t("MERCHANDISE"), "shop"]`; lỗi About do `[t("ABOUT US"), "home"]`. Không phải lỗi PHP hoặc Shop. Route #collections và component FigureCollections đã tồn tại, nhưng SeriesExplorer còn render `<FigureCollections {...props} embedded />` bên dưới danh sách manga. Chưa có trang About độc lập.

Chỉ sửa mapping menu: bỏ New Arrivals ở Navbar, Accessories -> collections, About -> about; nhãn EN SERIES/ACCESSORIES theo yêu cầu, VI không đổi. Giữ nguyên cấu trúc Header, logo, icons, hành vi ngôn ngữ/tài khoản/wishlist/cart/menu, sticky, hover và toàn bộ index.css. `aria-current="page"` phản ánh route hiện tại mà không thêm style active mới. Tại 900px, chiều rộng hộp flex của brand tự giải phóng khoảng 3px sau khi bỏ một mục; không chỉnh width, font, padding hoặc CSS Navbar.

### Route và tái sử dụng

- #home (hoặc hash rỗng): Home gốc.
- #shop: Shop tổng hợp, không đổi bộ lọc/layout.
- #series và #series/<slug>: Hero động/Explorer hoặc Series Detail hiện có.
- #collections và #collections/<slug>: FigureCollections độc lập với bộ lọc thật từ API. Xóa duy nhất lần render embedded trong Series; giữ CTA Figure & Phụ kiện đã có. Thêm nút reset query/category/series, giữ logic nhóm theo metadata/foreign key. Có 6 figure / 5 series, 0 phụ kiện; chọn Accessories hiện empty state, không thêm dữ liệu giả.
- #about: About riêng; #manifesto là alias cho CTA giới thiệu sẵn có mà không sửa Home.
- #product/<id> chỉ dùng ID thật trong Live; account/cart/wishlist/checkout/admin giữ nguyên API và chức năng.

Hash parser/điều hướng hiện có được mở rộng, không thêm router hoặc dependency. Primary navigation dùng pushState và xử lý hashchange/popstate; refresh, Back/Forward và chuyển VI/EN giữ trang. Demo vẫn có Series gốc và trang Collections dùng chính các sản phẩm Demo Figures/Accessories; không đưa ID MySQL hoặc gọi Product API vào Demo. Bộ lọc Collections đầy đủ sử dụng Live API; Demo Collections là danh sách tĩnh, không bổ sung metadata giả.

### About và file

Thêm frontend/src/pages/AboutPage.tsx, about.css (selector scoped .about-page, animation vào trang nhẹ, tôn trọng reduced motion). Nội dung VI/EN gồm Hero, giới thiệu đồ án, ba thế giới, tinh thần khám phá/sưu tầm/kết nối và CTA cuối trang. Tái sử dụng hai bìa /featured-manga/naruto.jpg và one-piece.jpg; không tải ảnh mới, không bịa thông tin doanh nghiệp. CTA Manga -> Series, Novel -> Shop, Figure -> Collections. Dùng Header/Footer chung; Footer không có About link cũ nên không sửa Footer.

Sửa App.tsx, i18n.tsx, discovery/routes.ts, discovery/SeriesExplorer.tsx; thêm hai script backend/tests/check_navigation_before.mjs và check_navigation.mjs chỉ phục vụ Chrome; cập nhật kỳ vọng tiêu đề HIỆN THỰC trong check_discovery.mjs. README/API.md ghi nhận bàn giao. Không sửa PHP, Vite config, CSS chung, Product Card, Loader, Admin, Auth, Checkout hoặc dữ liệu Demo.

### Kiểm thử thực tế

- Build npm và TypeScript noEmit: PASS. Cảnh báo native config loader tương lai của Vite là cảnh báo cũ, không phải build error.
- Chrome headless Live và Demo: PASS Navbar 5 mục VI/EN, Home Hero DOM/chiều cao Navbar/icon/logo, Shop/Collections/About riêng, deep link, refresh, Back/Forward, CTA, aria-current, Series không lặp Figure, bộ lọc/empty/reset Live. Không overflow tại 1440/900/390, không uncaught JS exception/console.error trong navigation tests.
- check_discovery: PASS 4 slide/autoplay thực/pause/reduced motion, 7 series/14 tập, search/sort/back, Figure/Cart/Wishlist, ảnh và VI/EN. check_discovery_resilience: PASS loading/error/retry/not-found và refetch chỉ thay response kiểm thử.
- check_true_color: PASS gallery Your Name/Frieren ở ba kích thước. check_live_catalog: PASS 23 Product Detail và 37 gallery selection, tên/mô tả/ảnh/giá VND/VI-EN, tìm kiếm và category/hover.
- check_flipbook: PASS startup, readiness, API error/timeout, StrictMode, reduced motion, VI/EN và responsive.
- Chrome check_auth/check_commerce/check_admin/check_reports/check_orders: PASS trên các database/kho upload test cô lập qua Apache XAMPP. Bao gồm checkout COD unpaid, double-submit/lost-response retry, history/detail/cancel, account isolation, cart persistence, Admin/Reports/CSV. Không chạy thao tác ghi trên database chính.
- Demo check_navigation --demo và check_demo_checkout: PASS; không gọi Product/Order API để lấy catalog/đặt đơn thật. .env.local được khôi phục nguyên trạng, VITE_USE_PRODUCTS_API=true, API base /api.

Screenshot riêng từng trang: frontend/.artifacts/11d-live-{home,shop,series,collections,about}-{1440,900,390}.png; tương tự 11d-demo-*.png. Navbar trước: 11d-before-home-{1440,900,390}.png; sau: 11d-live-home-*.png. Có ảnh menu mở trước/sau: 11d-before-navbar-open-{900,390}.png / 11d-live-navbar-open-{900,390}.png. 900px vẫn dùng desktop theo breakpoint gốc; 390px menu mobile. Không dùng ảnh Shop làm bằng chứng Collections. Các ảnh About/Shop/Series/Collections sau kiểm thử lưu EN; Home/Navbar so sánh VI. Báo cáo máy đọc: 11d-navigation-live.json, 11d-navigation-demo.json và 11d-preservation.json. Quan sát ảnh và đối chiếu DOM/source, không tuyên bố pixel-perfect hoặc pixel-diff toàn trang.

### Bảo toàn và giới hạn

Baseline riêng C:/xampp/manga-store-backups/2026-11-22-navigation-about/ gồm source hashes và snapshot MySQL chỉ đọc trước/sau. Toàn bộ schema/rows/hash của 17 bảng giống nhau; 31 sản phẩm gồm 23 active/8 archived, 37 ảnh giữ nguyên. Tất cả file PHP/backend public/uploads cũ giữ nguyên SHA-256. Home, Shop, ProductCard, Footer và CharacterArt giữ nguyên source từng byte; index.css, Hero Slider, Loader, Gallery, commerce/Auth/Admin/Reports giữ nguyên hash. Không migration, seed, dependency hoặc thay ảnh. Có thể hoàn tác riêng thay đổi frontend 11D; không cần khôi phục MySQL. Các script test cần Chrome Windows và XAMPP tại vị trí cấu hình sẵn; test ghi dữ liệu chỉ chạy trên clone đã cấu hình, không chuyển sang database chính.

## Giai đoạn 11E — Typography, layout và About CTA (22/11/2026)

### Audit Home bằng Chrome trước sửa

Không đoán font hoặc tải font mới. Source index.css dùng --display = Barlow Condensed, Arial Narrow, sans-serif; --body = Inter, sans-serif. Font có sẵn qua Google Fonts import hiện tại. Chrome CSS.getPlatformFontsForNode xác nhận glyph thực từ BarlowCondensed-Black/BlackItalic và Inter-Medium; Noto Sans JP chỉ phục vụ chữ Nhật trang trí gốc.

Ở 1440px: Home h1 weight 900, size 120.96px, line-height 90.72px, tracking -6.6528px, font-stretch 100%; chữ outline em italic/stroke 2px. Hero lede dùng Inter 500, 12px/21.6px, uppercase/tracking .6px. SectionTitle dùng Barlow Condensed 900, clamp55–102px/0.74, tracking -.045em; eyebrow Inter 700/10px, tracking .22em. Product title dùng display 700/20px, giữ clamp hai dòng hiện hành. CTA dùng Inter 700/11px, tracking 1.1px, min-height50px, padding ngang22px, border1px; hover dịch lên2px trong250ms, lớp nền xoay trượt450ms. Border card gốc2px, editorial divider1–2px. Home dùng breakpoint1024/760px; các trang discovery có breakpoint riêng đã tồn tại. Chi tiết computed properties/font glyphs/DOM baseline trong 11e-before.json.

### Lỗi CTA đã tái hiện và sửa

Trước sửa, About render nhãn và ↗ là text nodes trực tiếp của button .ink-btn. Pseudo-element ::before tuyệt đối, z-index auto được vẽ trên text nodes khi trượt vào. Quy tắc gốc `.ink-btn > * { z-index:1 }` chỉ áp dụng cho phần tử con, nên không bảo vệ chữ trực tiếp. Home dùng component Button với wrapper phần tử nên không mắc lỗi này. Chuột CDP thực sự hover đã tái hiện nút xám mất cả chữ/mũi tên; không phải do file ảnh, mix-blend-mode hoặc đổi màu chữ.

AboutPage bọc nhãn và mũi tên trong hai span, arrow aria-hidden. Scoped `.about-page .ink-btn` tạo isolation, foreground position relative/z-index1; ::before z-index0/pointer-events none. Giữ nguyên kiểu trượt xoay và hover dịch lên của Home; không tắt hover. Focus-visible có outline2px/offset5px, pressed hạ về vị trí gốc; nút Shop cuối trang dùng ghost secondary trắng/đen đúng style có sẵn. Chữ dài được wrap/padding dọc, min-height50px, không khóa height làm cắt chữ. Reduced motion tôn trọng quy tắc global sẵn có (transition chỉ0.01ms), không thêm chuyển động ép buộc.

### Typography và layout scoped

Thêm discovery/editorial-ui.css, chỉ match .discovery-surface/.discovery-collections-page/.about-page, không :root hoặc selector toàn cục mới. Tái sử dụng --display/--body/--black. Display900 clamp44–88px/1.02, section900 clamp32–56px/1.08, card800 clamp26–34px/1.12, body Inter15px/1.75–1.8, eyebrow Inter700/10px tracking.16em, button Inter700/11px. Dùng leading rộng hơn Home cho dấu VI và tên dài, không sao chép leading cực chặt của Hero sang mọi heading.

EditorialTitle giữ nguyên nguyên văn bản dịch, chia dòng solid/outline cho Series và Collections, stroke1.2px/italic. Không đổi i18n.tsx. Series Card giữ cover contain, cover280px/230px ở màn nhỏ, copy flex/CTA cuối card, tên đọc đầy đủ, typography cấp card; 390px chuyển1 cột để tên dài dễ đọc. Không đổi route/search/sort/data. Dynamic Hero/logic autoplay không sửa.

Collections dùng grid3 cột desktop: nhóm1 Figure chiếm1 cột và chỉ1 ô sản phẩm, nhóm nhiều Figure chiếm2 cột. Tablet2 cột/nhóm tự co, mobile1 cột; ảnh310px contain, không kéo giãn/crop đầu chân. Chỉ trong Collections, ghi đè inline two-line clamp của Product Card bằng display/overflow/line-clamp scoped !important để đọc đủ tên; không sửa component ProductCard. Tăng độ đọc metadata, ổn định khoảng cách và phân cấp secondary View Detail / primary Add to Cart / text links. Group/search/category/series/stock/price/Wishlist/Cart callbacks giữ nguyên.

About giữ nguyên nội dung và asset. Bổ sung weight900 cho display/section, weight800 cho card thay việc chỉ khai báo family khiến heading mảnh. Hero max96px, leading1.02, text width/padding và collage cân đối; section64px desktop/40px mobile, body max66ch. World/value grid3 cột desktop,2+1 span tablet,1 cột mobile. CSS animation vào trang cũ/reduced-motion giữ nguyên.

File production sửa: frontend/src/pages/AboutPage.tsx, pages/about.css, discovery/SeriesExplorer.tsx. File thêm: discovery/EditorialTitle.tsx, discovery/editorial-ui.css. Thêm backend/tests/check_typography.mjs; check_admin.mjs chỉ thêm350ms chờ logout/account-sync trước đổi tài khoản trong harness. Không sửa Auth ứng dụng để xử lý timeout của thao tác script quá nhanh. README/API.md cập nhật bàn giao.

### Kiểm thử Chrome thực tế

- check_typography trước/sau: screenshot Home/Shop/Series/Collections/About ở1440/900/390; audit computed CSS/glyph font; foreground/pseudo-element; hover bằng Input.dispatchMouseEvent, không dùng force-state giả lập CSS.
- Cả5 CTA About: mouse hover/press/release/click mở đúng route. Tab qua bàn phím xác nhận :focus-visible; screenshot focus; touchStart/touchEnd ở390px mở Series. Reduced-motion xác nhận transition gần0 theo quy tắc global. Không nút About disabled thực tế để kiểm thử trạng thái đó.
-18 tổ hợp Series/Collections/About × VI/EN ×1440/900/390: heading không bị clip/tràn; glyph từ Barlow hiện có, không fallback ngoài ý muốn; Figure contain và tải ảnh đúng. Các ảnh chụp đã được quan sát, không tuyên bố pixel-perfect.
- DOM Home/Shop/Navbar/Footer trước/sau giống nhau; computed style Home giống nhau. Phép so sánh chiều cao normal line-height cho phép sai số1px do thời điểm font/rasterization; các thuộc tính font, stroke, màu, spacing, border và transition đối chiếu chính xác. Không tuyên bố pixel-diff toàn trang có animation.
- check_discovery PASS Hero/autoplay/pause/reduced-motion, series/volume search/sort/back, Figure và guest Cart/Wishlist; check_discovery_resilience PASS error/loading/retry/refetch; check_true_color PASS gallery gốc tại ba kích thước; check_flipbook PASS readiness/error/timeout/StrictMode/reduced-motion.
- check_auth, check_commerce PASS Chrome trên clone; check_admin sau khoảng chờ ổn định harness PASS; check_reports và check_orders PASS trên clone XAMPP/MariaDB, gồm CSV, checkout COD unpaid/idempotency/lost-response/history/detail/cancel. Test Admin lượt đầu timeout khi script logout/login tức thì; không thay code Auth/backend. Các thao tác ghi chỉ chạy trên database/kho ảnh test cô lập.
- check_navigation --demo và check_demo_checkout PASS, Demo không gọi Product/Order API thật; cấu hình được khôi phục VITE_USE_PRODUCTS_API=true, base /api. Không thay dữ liệu React Demo.

Ảnh đối chiếu: frontend/.artifacts/11e-{before,after}-{home,shop,series,collections,about}-{1440,900,390}.png. Riêng hover lỗi/sau sửa: 11e-before-about-button-hover.png / 11e-after-about-button-hover.png; trạng thái thường tương ứng *-button-normal.png; focus 11e-after-about-button-focus.png; từng CTA pressed 11e-after-about-cta-{0..4}-active.png. Series viewport đầu là slider không bị sửa; phần Explorer/Card sau sửa có ảnh riêng 11e-after-series-content-{width}-{vi,en}.png. Tương tự collections/about-content. Audit máy đọc: 11e-before.json, 11e-after.json (18 tổ hợp + interactions), 11e-preservation.json.

### Bảo toàn

Baseline ngoài webroot C:/xampp/manga-store-backups/2026-11-22-typography/. Snapshot read-only trước/sau: toàn bộ schema/rows/hash17 bảng giống nhau,31 sản phẩm (23 active/8 archived),37 ảnh không đổi. Các file PHP/API và backend/public/uploads cũ giữ nguyên SHA-256. App.tsx giữ nguyên toàn bộ byte (bao gồm Home/Navbar/Shop/Footer/ProductCard/commerce integration); index.css, i18n, services/hooks, Hero Slider, Loader, Auth/Admin/Reports và Gallery giữ nguyên hash. Không API mới, migration, seed, thay giá/tồn kho/ảnh, cài font hoặc dependency. Có thể rollback riêng3 file production đã sửa và bỏ2 file mới; không cần phục hồi database.

Kết quả cuối 11E: npm run build và TypeScript --noEmit PASS sau thay đổi cuối. check_navigation Live PASS sau khôi phục cấu hình, không JavaScript exception/console.error. Cảnh báo Vite native-loader tương lai là cảnh báo có sẵn, không sửa config ngoài phạm vi. Không chạy PHP lint mới vì không sửa PHP. Typography mobile390 dùng heading42px cho Series/Collections; không ép cùng một cỡ cho mọi heading. Tóm tắt kết quả: frontend/.artifacts/11e-tests.json.

## Giai đoạn 12A — Audit và migration đề xuất (23/11/2026)

Chưa triển khai Bước B, chưa thay source frontend/backend hoặc dữ liệu. Theo quy trình người dùng yêu cầu, phần tạo series cần dừng để duyệt migration chống trùng tên. File đề xuất: database/migrations/002_series_title_unique.proposed.sql; CHƯA THỰC THI.

### Schema và nguồn dữ liệu đã xác định

01_schema.sql và snapshot MySQL thực tế đọc ở giai đoạn11E ngày22/11 đều có manga_series: id BIGINT UNSIGNED PK auto_increment; slug VARCHAR160 NOT NULL UNIQUE uq_series_slug; title VARCHAR200 NOT NULL; original_title VARCHAR200 nullable; description_vi/description_en TEXT nullable; banner_image_url VARCHAR500 nullable; is_active TINYINT1 default1. InnoDB, utf8mb4_unicode_ci. Không có unique title. Snapshot cũ có18 series; kiểm tra Python chỉ phát hiện trùng chuỗi chính xác/trim/empty/length không thấy lỗi, nhưng KHÔNG thay cho so sánh collation MySQL hoặc kiểm tra live hôm nay.

Tên chính thức là title; original_title là tên nguyên tác, không phải cột name_vi/name_en. Chỉ mô tả có VI/EN. products.series_id nullable FK -> manga_series.id ON DELETE SET NULL; series dùng chung cho manga/novel/figure, không ép theo category. products có UNIQUE SKU/slug và status draft/active/archived.

Form hiện dùng adminService.getMetadata -> GET /api/admin/metadata.php -> AdminRepository.metadata(), trả categories và series(id,title). Chưa có endpoint series-create. CRUD sản phẩm/save/version/foreign-key và gallery upload/replace/delete/primary đã có, sẽ tái sử dụng. POST admin qua session requireAdmin/CSRF/prepared statements và JSON validation trong admin_bootstrap.php. Không đổi Auth.

ProductForm đã giữ fields, file chọn và trạng thái tạo draft/upload nhiều bước trong state. Khi sửa không gửi stock_quantity; chỉ tạo mới nhận tồn kho ban đầu và ghi inventory_movements reason initial. Giữ Inventory Management là đường điều chỉnh tồn kho hiện có, không thêm đường ghi trong form sửa.

Danh sách hiện có search VI/EN/SKU, category/status hỗ trợ backend, page_size tối đa50 nhưng UI chủ yếu search/category/page; sort mặc định p.id DESC. Chưa có series filter/sort whitelist hoặc overview counts. AdminRepository.products() dùng chung Inventory nên mọi mở rộng phải giữ nguyên defaults/hành vi Inventory.

### Lý do cần duyệt migration

UNIQUE(slug) ngăn cùng slug, nhưng không ngăn hai request tạo cùng title với hai slug khác nhau. Kiểm tra SELECT trước INSERT hoặc chặn trong React không đủ chống race. Đề xuất thêm đúng1 unique index uq_series_title(title), không thêm cột, không sửa enum/FK/ID/rows. Chính sách tên theo collation hiện có utf8mb4_unicode_ci (không phân biệt hoa/thường và dấu); tên/slug trùng ->409, trả thông tin series phù hợp cho Admin chọn, không UPDATE bản ghi cũ.

Trước thực thi: kiểm tra SHOW CREATE/INDEX live, tên rỗng/khoảng trắng đầu cuối và title trùng theo collation; nếu có xung đột phải dừng báo cáo, không tự sửa tên/xóa dữ liệu. Backup database/uploads, thử unique và concurrent inserts trên clone, kiểm tra index tương đương để skip nếu đã áp dụng. DDL MariaDB implicit commit, không giả định transaction rollback ALTER. File có postflight và rollback plan chỉ bỏ index được thêm (cũng cần duyệt), không xóa dữ liệu.

### Trở ngại live

Lượt kết nối23/11 trả VERSION=10.4.32-MariaDB, sau đó mất kết nối (2013); thử lại bằng lệnh chỉ đọc ngoài sandbox bị từ chối kết nối (2002/10061). Không tự khởi động lại MariaDB, không sửa cấu hình hoặc dữ liệu MySQL. Vì vậy chưa xác minh lại schema/duplicates/index trên database live hôm nay, chưa chạy migration/dry-run SQL/concurrency. Không tuyên bố API/GUI/build mới đã kiểm thử cho12A. Kết quả11E là lịch sử, không dùng làm bằng chứng test12A.

### Kế hoạch triển khai sau khi duyệt và MySQL sẵn sàng

1. Backup và preflight live/clone; thực thi migration được duyệt sau kiểm tra không mất rows.
2. POST /api/admin/series-create.php qua requireAdmin/CSRF và validation; title1..200, slug1..160 đúng định dạng, original_title và mô tả optional đúng schema; catch1062 và kiểm thử requests đồng thời trên clone.
3. Dialog ngay trong ProductForm, có label/focus trap/Escape/return focus, không nested form; giữ parent fields và File state, append series thật từ response vào metadata và chọn ID. Hiển thị rõ series đã lưu độc lập, không tự xóa khi hủy tạo sản phẩm.
4. Scoped Admin Products content: header/overview counts thật; server-side search/category/series/status/sort whitelist/effective sale price, stable secondary ID order, page sizes10/20/50 và clamp page. Không sửa Sidebar/topbar hoặc page khác. Không dùng số23/8 hardcode.
5. Form4 section: Basic; Category/Series; Price/Status (stock chỉ đọc khi sửa, link Inventory); Images tái sử dụng AdminProductImages. Giữ draft/upload/partial failure/version hiện có, dirty confirmation và loading/errors VI/EN.
6. Chrome baseline/sau1440/900/390 list/create/edit/dialog/keyboard, API auth/CSRF/duplicates/concurrency, product/image CRUD và regression trên clone. PHP lint/TS/build; đối chiếu hash/storefront/API data và database chính.

Trong lượt audit12A chỉ thêm file SQL proposed và cập nhật tài liệu này; chưa sửa UI/API nên phần giao diện độc lập cũng chưa được triển khai. Cần người dùng duyệt index mới trước phần tạo series theo yêu cầu Bước A/B.

## 12A triển khai sau phê duyệt — 23/11/2026

### Migration002: preflight, backup, thực thi và postflight

Kết nối đã được người dùng bật lại, không khởi động lại hoặc đổi cấu hình MySQL. Xác minh MariaDB10.4.32; manga_series InnoDB, title VARCHAR200 NOT NULL, table/column kế thừa utf8mb4_unicode_ci; slug VARCHAR160 với UNIQUE uq_series_slug; title chưa có unique.18 series không rỗng, không có khoảng trắng đầu/cuối và không trùng theo collation. Không tự đổi tên hoặc gộp dữ liệu.

Backup đầy đủ trước ALTER ở C:/xampp/manga-store-backups/2026-11-23-admin-products/: manga_store.sql (--single-transaction, routines/triggers/events/hex-blob), snapshot before.json, uploads/ và source-hashes.json. Có backup clone riêng manga_store_admin_test_20261122.sql. Đã phục hồi manga_store.sql vào database cô lập manga_store_12a_backup_verify_20261123, đối chiếu khớp schema/rows/hash của cả17 bảng; báo cáo backup-restore-check.json. Không phục hồi lên database chính.

Thử index trên clone, kiểm tra xung đột tên khác slug/hoa-thường/dấu bị1062. Sau đó thực thi đúng duy nhất:

```sql
ALTER TABLE manga_store.manga_series
    ADD UNIQUE KEY uq_series_title (title);
```

Postflight xác nhận UNIQUE BTREE uq_series_title(title) đầy đủ, không prefix; uq_series_slug còn nguyên. Schema trước/sau chỉ khác đúng index này, không đổi cột, enum, FK hoặc AUTO_INCREMENT. Rows của cả17 bảng giống nhau:18 series,31 sản phẩm (23 active/8 archived),37 ảnh. Kiểm thử HTTP title UTF-8 đủ200 ký tự và Unicode whitespace trên clone PASS. Không đưa bất kỳ series/product/user kiểm thử vào database chính. Bằng chứng final: verification.json ngoài webroot và frontend/.artifacts/12a-preservation.json.

### API và chống trùng

POST /api/admin/series-create.php (mới): session/requireAdmin + CSRF hiện có; JSON field allowlist. Chấp nhận title1..200, slug1..160 chỉ lowercase ASCII/số/dấu nối đơn; original_title tối đa200, description_vi/en tối đa2000 tùy chọn. Tên chính thức dùng chung; original_title là tên nguyên tác, không giả làm cột name_vi/name_en. Chuẩn hóa khoảng trắng ngoài, prepared INSERT, không UPDATE series cũ. is_active mặc định1 theo schema; không nhận role/user_id/is_active từ client.

Thành công201 với success:true/data:{id,title,slug,original_title,description_vi,description_en,is_active}. Hai UNIQUE title/slug bảo đảm atomic giữa request; lỗi1062 chuyển409 DUPLICATE_SERIES (không SQL thô), kèm data.existing cho các identity xung đột. Giao diện refetch metadata và cho chọn series đã tồn tại. Frontend không dựa vào so sánh tên để tự gán ID. Trùng tên theo unicode_ci không phân biệt hoa/thường và dấu, đúng index đã duyệt. Validation422 hoặc400 cho trường không được phép;401/403/405 theo Auth hiện có. Không lưu dữ liệu frontend giả khi thất bại.

GET /api/admin/metadata.php giữ nguyên, dùng lại categories/series id-title. Không tạo API danh sách series trùng chức năng.

GET /api/admin/products.php mở rộng tương thích items/meta, bổ sung overview{total,active,archived,draft} toàn catalog và low_stock_threshold=5 (cùng ngưỡng nghiệp vụ Inventory/Dashboard hiện có). q tìm name_vi/name_en/SKU/slug, literal LIKE có escape %/_. Filters category_id,series_id,status,low=0/1; sort whitelist updated,name,price_asc,price_desc,stock_asc,stock_desc, language vi/en. Giá bán dùng CASE sale_price>0 và <=price, còn lại price_vnd; chỉ VND. Sort có ID phụ ổn định. page/page_size giới hạn, chọn UI10/20/50; backend clamp page về last_page khi kết quả giảm. Đếm/fetch/overview trong read transaction nhất quán. Inventory vẫn dùng API/hàm listing cũ, không thêm đường cập nhật tồn kho.

CRUD/update/archive/upload API cũ tái sử dụng. AdminRepository::product chỉ đổi access private thành public static để dùng lại serializer, không đổi nội dung. Đường đọc mới tách riêng AdminProductCatalog.php; Auth/Orders/Inventory/Reports không đổi nghiệp vụ.

### UI và cách demo

Truy cập #admin/products bằng tài khoản Admin hiện có (tạo Admin bằng CLI cũ, không có mật khẩu mặc định).

1. List có tiêu đề/mô tả/nút thêm,4 số liệu database thật, filter bar và bảng thumbnail72x96, tên nổi bật/SKU nhỏ, category/series tách riêng, giá bán/giá gốc gạch khi sale hợp lệ, tồn thấp, nhãn active/archived/draft và thao tác tách rõ. Không hardcode số23/8. Reset/empty state và pagination giữ bộ lọc khi vào/ra form. Archive/restore vẫn confirm và optimistic version cũ, không delete.
2. Form4 fieldset: Basic; Category/Series; Price/Status; Images. Khi sửa stock readonly, có link #admin/inventory; khi tạo chỉ nhận initial stock theo nghiệp vụ cũ. Có dirty confirmation cho Back/Close và beforeunload, ref guard double submit, loading/error/success, dữ liệu giữ khi lỗi.
3. + TẠO BỘ TRUYỆN / + NEW SERIES mở native dialog ngoài product form (không nested form). Focus trường tên; Tab/Shift+Tab wrap nội bộ, Escape đóng khi không đang lưu, return focus về opener. Dialog nằm trong viewport, nút lưu có sticky footer. Lỗi giữ dữ liệu, duplicate cho chọn series thật hiện có. Sau201 append/dedupe ID vào dropdown và tự chọn; refetch metadata không remount ProductForm hoặc file input.
4. Series lưu độc lập ngay, không phải draft trong bộ nhớ. Nếu hủy sản phẩm sau đó, series vẫn còn; notice giải thích rõ. Đã kiểm thử việc này trên clone. Giá/tên/SKU/mô tả/file ảnh của form giữ nguyên khi tạo/chọn series.
5. ProductForm giữ nguyên staged draft → upload → activation và partial failure/retry cùng ID của11A. AdminProductImages không sửa, các nút upload/replace/delete/primary dùng lại. Controls không bị kéo cao theo series button trên tablet. Chỉ CSS scoped AdminProducts/editor/dialog, không đổi Admin shell/sidebar/topbar hoặc font chung.

### File thay đổi

Thêm backend/src/AdminProductCatalog.php, backend/public/api/admin/series-create.php; sửa backend/public/api/admin/products.php và access serializer trong backend/src/AdminRepository.php. Thêm frontend/src/admin/AdminSeriesDialog.tsx và admin-products.css; sửa đúng AdminProducts/AdminProductForm và imports trong AdminApp.tsx, adminService.ts và thêm khóa i18n VI/EN. File migration002 chỉ cập nhật comment đã được duyệt/applied, giữ nguyên DDL đã phê duyệt. README và tài liệu này cập nhật.

Thêm test_series_products.py, series_fixture.php (chỉ CLI, bắt buộc database clone và prefix test), check_products_12a.mjs. Các clone Apache là bản sao code riêng; đã đồng bộ những PHP cần cho tests, giữ nguyên config và kho upload riêng, không đổi cấu hình Apache/MySQL.

### Kiểm thử thực tế

- HTTP/MariaDB test_series_products.py PASS: guest/customer/CSRF/method; invalid title/slug/length/unknown role fields;201/409; trim; duplicate case/accent/slug; hai request Apache đồng thời dùng hai session và barrier -> đúng một201, một409, chỉ một row; title200 ký tự UTF-8; product liên kết series mới, duplicate product/FK invalid; search/filters/all sorts/effective sale price;10-row pagination không trùng ID, clamp và empty.
- Chrome check_products_12a PASS: list/create/edit/dialog/validation/loading tại1440/900/390; VI/EN;12 lần Tab không thoát dialog, Escape/return focus; chọn series hiện có; double-submit; SKU/slug/name/description/price/status và File thật không mất; create product + upload primary; edit giữ price/stock/image; metadata/FK persist; filter giữ khi quay lại; reset/empty; active Manga mới có Volume1 đúng Series Explorer; Figure mới ở nhóm series đúng trong Collections; hủy product vẫn giữ series đã lưu. Không JavaScript exception/console.error.
- test_admin.py và check_admin.mjs PASS trên clone: quyền, CRUD/CAS/stock rules, Inventory, Orders/COD, snapshot/archive/cancel/idempotency và khách hàng. check_images.mjs PASS trên clone images riêng: preview/upload, duplicate giữ form, upload lỗi giữ draft và retry cùng ID, replace lỗi giữ ảnh gốc, delete/primary/last-active-image, Shop/Detail cập nhật không reload, VI/EN/responsive/persistence.
- Chrome check_auth/check_commerce/check_reports/check_orders PASS trên các clone; Demo check_navigation --demo/check_demo_checkout PASS; Live check_live_catalog PASS23 detail/37 gallery; check_discovery PASS Hero/Explorer/filter/volume/search/Figure/Cart/Wishlist; check_flipbook PASS startup/error/StrictMode/reduced-motion. Không dùng các phép thử ghi trên database chính.
- npm build và TypeScript --noEmit PASS sau thay đổi cuối. PHP lint PASS AdminProductCatalog.php, AdminRepository.php, products.php, series-create.php. Cảnh báo Vite native-loader tương lai có sẵn không làm build thất bại; không cài dependency/font mới. .env.local được phục hồi VITE_USE_PRODUCTS_API=true, base /api.

Screenshot trước: frontend/.artifacts/12a-before-products-{1440,900,390}.png và 12a-before-create-*.png. Sau: 12a-after-products-*.png, 12a-after-create-*.png, 12a-after-edit-*.png, 12a-after-series-dialog-*.png. Có 12a-series-validation-*.png, 12a-series-saving-390.png. Đây là ảnh Chrome thật trên clone, không ghép ảnh và không tuyên bố pixel-perfect. JSON:12a-api.json,12a-products-browser.json,12a-preservation.json.

### Khôi phục và giới hạn

ALTER DDL MariaDB implicit commit: không dùng ROLLBACK transaction để hoàn tác. Khi cần rollback ràng buộc, dừng thao tác ghi/tạo series và xem xét rollback code tương ứng trước; sau duyệt có thể DROP INDEX uq_series_title trên đúng bảng, không xóa rows. Không tự thực hiện DROP. Backup SQL đã kiểm chứng phục hồi vào clone; khôi phục toàn bộ database chính chỉ trong maintenance, sao lưu trạng thái mới nhất trước để không mất dữ liệu phát sinh sau backup. Trong phpMyAdmin chọn đúng database đích và Import file SQL; phục hồi uploads/ từ backup nếu file có sự cố, không ghi đè khi không cần. Không có sự cố dữ liệu để phải restore database chính trong giai đoạn này.

Main chỉ thay schema đúng1 index. Toàn bộ rows17 bảng,37 ảnh,23 active/8 archived và18 series giữ nguyên. Source App.tsx/index.css và tất cả component/service khách hàng ngoài việc bổ sung khóa i18n Admin giữ nguyên SHA-256; Sidebar/Header Admin không chỉnh JSX/CSS, các API Auth/Cart/Checkout/Reports không sửa. Không xây quản trị đổi/xóa series, bulk delete, thanh toán mới hoặc đăng nhập mới. Series chưa gắn active product sẽ chưa hiện trong Explorer/Collections theo logic hiện hành; không sửa Storefront để ép hiển thị series rỗng. Read-only metadata dropdown vẫn dùng endpoint hiện có; không bổ sung quản trị series đầy đủ.

## Giai đoạn12B — Shop layout & Buy Now intent (24/11/2026)

### Audit và giới hạn Checkout đã xác định

ApiCheckout dùng getQuote() -> GET orders/quote.php. OrderRepository.quote/create đọc toàn bộ cart user, tính lại giá/stock và create sau đó DELETE cart_items trong cùng transaction. Chưa có quote/create riêng cho một product_id. Không thể dùng API này cho Buy Now mà bảo đảm không mua nhầm cả cart. Giai đoạn12B áp dụng đúng trường hợpB được yêu cầu: Buy Now mở Checkout riêng để xem trước, KHÔNG gọi Quote/Create Order, xác nhận bị disabled và thông báo sẽ hoàn thiện ở giai đoạn Checkout tiếp theo. Không tự mở rộng API, migration hoặc tự thay đổi cart để lách giới hạn.

API thực tế đầu giai đoạn trả23 active/37 images. Snapshot DB có31 products (23active/8archived),18 series và17 bảng. Không lấy số lượng từ mockup để render. Mockup hình không được kèm trong lượt12B; triển khai theo bố cục mô tả toolbar trên/sidebar trái/grid bên phải, không tuyên bố khớp pixel với ảnh không có.

### Shop và dữ liệu

Thêm src/shop/ShopCatalog.tsx, shopModel.ts, shop.css. Giữ chính markup Hero SHOP/ALL, họa tiết/ngày Archive/2025/chữ Nhật từ Shop gốc; không đổi Navbar/Footer. Model lọc từ ProductsProvider/service hiện có, chỉ API active. Toolbar search theo name_vi/name_en/SKU/series, lowercase + bỏ dấu NFD/đ; Demo có alias t(name) hiện có. Sort default giữ thứ tự API; newest theo ID auto_increment nhập catalog (nhãn rõ là newest catalog entries, không phải ngày phát hành); price asc/desc, localized name A-Z và ID phụ ổn định.

Sidebar category/series lấy từ sản phẩm trả về, không dựng series/ID hoặc count giả. Facet count áp dụng query/price/stock và các filter khác, bỏ chính facet tương ứng khi tính count. Không có active accessories nên không tự tạo lựa chọn phụ kiện giả; nó xuất hiện khi có sản phẩm thật. Giá min/max nguyên không âm, min<=max, max14 chữ số; invalid có alert, presets chỉ là range cấu hình. Live VND, Demo giữ USD nguyên bản, không quy đổi. Stock in/out chỉ hiện Live vì Demo không có metadata tồn kho đáng tin cậy. Có reset và details đóng/mở.

Pagination phía client trên danh sách active API hiện có,24/page, số kết quả/range/tổng trang tính từ dữ liệu; filter reset page1, dataset giảm thì clamp trang hiển thị. Không phải server-side pagination mới. Catalog lớn về sau cần API phân trang/tìm kiếm riêng; không thay public API trong12B. Không thêm Grid/List hoặc bộ lọc không hoạt động/bán chạy/rating/age/authenticity thiếu dữ liệu.

Desktop1440: sidebar220px và4 cột; tablet900: sidebar190px và2 cột; mobile390:1 cột, nút mở native filter dialog thay sidebar. Dialog focus wrap/Escape/return focus, label/select rõ, không horizontal overflow. Nút/actions min48px, reduced-motion không dịch nút khi hover. Không thêm thư viện/font.

### Product Card và điều hướng

ProductCard trong App.tsx nhận optional shopActions. Khi không có prop, DOM/hành vi cũ giữ nguyên cho Home/Series/Collections/Wishlist/related. Riêng Shop bỏ Quick View, dùng MUA NGAY primary đen và ADD TO CART secondary trắng luôn hiện (không phụ thuộc hover). Buttons plain không pseudo overlay, có focus outline. Giữ frame border đen, background gray, ProductImage/ảnh/hover/grayscale gốc; contain chỉ scope Shop. Card flex cân chiều cao, full tên không bị clamp hai dòng trong Shop, giá/action ở cuối card. Không sửa ProductImage hoặc ảnh nguồn.

Image có overlay button native dùng Enter và aria-label; parent image click cũ còn hoạt động, overlay/wishlist stopPropagation để không điều hướng hai lần. Tên là button native. Wishlist không mở detail; Add dùng nguyên commerce.add/mergeGuest/server validation/badge/toast cũ, không chuyển Checkout. Buy không gọi add. Khi mở Buy, dọn toast Add cũ để nó không che summary của sản phẩm khác.

Shop render bằng ShopCatalog mới; hàm Shop gốc giữ nguyên cho trang Wishlist dùng chung trước đây, tránh redesign Wishlist. Filters nằm trong StoreApp nên giữ qua Product Detail/Browser Back và ngôn ngữ; không lưu filters qua reload. API Product Detail route #product/<id>, origin #shop hỗ trợ back; gallery/layout không sửa. Demo Shop dùng #product/demo/<id>, chỉ chọn Demo ID và không gọi Product API. ProductPage nhận đúng Demo product (thay vì mặc định Ronin cũ); chỉ availability predicates/label nhận biết Demo không có server stock, không tự bịa số tồn kho. Home Demo vẫn hành vi Figma cũ; không trộn ID Demo/MySQL.

### Buy Now intent an toàn

Thêm buyNowIntent.ts và BuyNowCheckout.tsx. Nút Buy tạo ý định quantity1 với ID thực; Live kiểm tra source api/stock>0 từ catalog. Route #checkout/buy-now/<id> tách #checkout cart. sessionStorage manga-buy-now-api hoặc manga-buy-now-demo chỉ chứa {productId,quantity:1,mode}; không lưu giá, total, stock, địa chỉ hay token/session ID. Reader validate số nguyên dương, quantity/mode/allowlist keys; route phải khớp intent. Sai/đã hủy/khác mode/giá giả thêm vào intent -> expired, không rơi về cart checkout. Storage bị chặn vẫn dùng state hiện tại, reload có thể hết hiệu lực an toàn.

Checkout preview tái sử dụng CSS bố cục checkout hiện có, đọc mới product.php khi Live để xác nhận còn active/tồn kho (404/stock0 có trạng thái phù hợp). Chỉ hiển thị đúng một product,quantity1, giá công khai và note chưa có quote phí giao hàng/tổng tiền xác nhận. Không collect shipping/payment, không POST order, không ghi cart hoặc trừ stock. Demo dùng đúng object Demo, không Product API hoặc transaction thật. Confirmation luôn disabled, không có form create-order ẩn.

Guest có thể mở preview và chọn đăng nhập. Account có banner tiếp tục ý định sau khi user được xác thực; mở lại đúng ID và refetch. Auth/guest-cart merge vẫn theo cơ chế cũ: guest cart A có thể được merge bình thường khi login, nhưng Buy B không bị thêm vào cart. Đã kiểm thử server cart sau login chỉ có A; preview/continue B không thay đổi cart. Cancel/brand-back clear riêng buy key, giữ storage commerce/idempotency khác. Browser Back sau cancel thấy expired thay vì chọn nhầm sản phẩm. Checkout từ Cart đi #checkout và clear buy intent, giữ nguyên ApiCheckout/idempotency/onPlaced.

Lưu ý Demo cart vốn chỉ ở React memory: điều hướng Buy không xóa cart, nhưng full reload vẫn reset Demo cart theo hành vi trước đây; chỉ buy intent Demo được giữ sessionStorage. Live guest cart giữ sessionStorage như cũ. Không thay Cart hook để thêm persistence mới ngoài phạm vi.

### Phần cần làm ở giai đoạn Checkout kế tiếp

Cần backend quote một selection/mode Buy Now bằng product_id+quantity, kiểm tra active/stock/giá/phí ở server; quote fingerprint phải gắn đúng selection. Create order phải đọc selection đó, có idempotency hash bao gồm mode, transaction/lock/recheck/trừ kho/order snapshots/COD như luồng hiện có và tuyệt đối không DELETE hoặc mua toàn bộ cart. Chỉ sau khi các API này được phê duyệt/kiểm thử mới bật xác nhận Buy Now. Không triển khai chúng trong12B.

### File và kiểm thử thực tế

Production thêm frontend/src/shop/{ShopCatalog.tsx,shopModel.ts,buyNowIntent.ts,BuyNowCheckout.tsx,shop.css}; sửa App.tsx (optional card action + routing/state integration) và chỉ thêm khóa i18n.tsx. Không sửa ApiCheckout.tsx, orderService, useCommerce, Auth, backend PHP hoặc schema. Không sửa Admin source/CSS hay các file discovery/About/gallery/loader. README/API.md này cập nhật.

Tests mới: check_shop_before.mjs (baseline), check_shop_model.mjs, check_shop_buy_now.mjs, check_shop_resilience.mjs. Tests cũ check_commerce/check_orders/check_demo_checkout đổi selector Add ở Shop; check_live_catalog đổi toolbar/sidebar selector và kỳ vọng grid4/1 đúng yêu cầu, giữ toàn bộ kiểm tra dữ liệu/gallery/Cart. Không sửa test để bỏ kiểm tra nghiệp vụ.

- check_shop_model PASS accent/case/SKU search, stock/price validation kể cả Infinity/negative/fraction/min>max, sort giá ổn định,53 ID phân trang24/24/5 không trùng.
- Chrome check_shop_buy_now Live và Demo PASS grid4/2/1, full action visible48px, search không dấu, filter series/price/stock/sort/reset, ảnh/tên đúng detail và Back giữ filter; Home main DOM trước/sau giống nhau trước các thao tác thay đổi wishlist/cart. Mouse hover thật/Enter có native event/text/touch390 hoạt động, không overlay che chữ. Mobile dialog/Escape/focus-return, VI/EN. Không JS exception/console.error.
- Live clone: thêm A vào guest cart rồi Buy B -> preview chỉ B, không quote/create; reload giữ B và guest cart; login customer giữ đúng intent, server cart chỉ A; continue B không đổi server cart; cancel/storage/history không chọn nhầm. Chỉ lưu ba key mode/productId/quantity, không client price. Demo không Product/Order API.
- Chrome check_shop_resilience PASS với response-only fixtures, không ghi DB:53 records giả trong riêng response kiểm thử để kiểm24/24/5/không trùng/filter reset page; loading local không mở lại full loader;503/no Demo fallback/retry; stock0 disable hai action; stock đổi0 ở detail vẫn không gọi order; session intent thêm price giả bị từ chối; reduced-motion hover transform none. Không seed fixtures này vào MySQL hoặc source sản phẩm.
- Hồi quy Chrome PASS: Auth, commerce guest merge/retry/account isolation/cart+wishlist, Admin Products/Inventory/Orders/COD, Reports/CSV, Cart Checkout double-submit/lost-response/reload/idempotency/history/cancel trên các database clone. Demo Checkout và navigation PASS; Live catalog23 details/37 galleries/VI-EN/VND/filter/hover PASS; Discovery Hero/series/search/volume/Figure PASS; true-color gallery và Flipbook readiness/error/StrictMode/reduced motion PASS.
- Build và TypeScript --noEmit PASS sau thay đổi cuối. Không chạy PHP lint mới vì không sửa PHP; cảnh báo Vite native config loader tương lai là cảnh báo cũ, không phải lỗi build. .env.local phục hồi Live true, base /api. MySQL có ngắt giữa lượt thử; người dùng bật lại rồi các kiểm thử thật được chạy lại, không tự restart hoặc sửa config.

Ảnh trước: frontend/.artifacts/12b-before-shop-{1440,900,390}.png và12b-before-cards-*.png. Sau:12b-after-shop-{live,demo}-{1440,900,390}.png,12b-after-cards-*.png. Hover thường/sau:12b-actions-normal-{live,demo}.png /12b-actions-hover-*.png. Buy preview desktop/mobile:12b-buy-now-{live,demo}-desktop.png /12b-buy-now-*-390.png. Drawer:12b-filter-drawer-*-390.png. States:12b-shop-loading.png,12b-shop-error.png,12b-pagination-response-only.png,12b-buy-now-stock-changed.png. Không tuyên bố khớp pixel-perfect với mockup không được đính kèm. JSON:12b-shop-live.json,12b-shop-demo.json,12b-resilience.json,12b-tests.json,12b-preservation.json.

### Bảo toàn

Baseline C:/xampp/manga-store-backups/2026-11-24-shop-buy-now/ có App/i18n/index.css và source hashes/snapshot read-only trước/sau. Đối chiếu schema/rows/hash cả17 bảng giống nhau,23active/8archived/37images/18series không đổi. PHP/API và uploads toàn bộ hash cũ giống nhau. Các hàm Home/Header/Footer/CharacterArt/SectionTitle/Shop legacy/Series/Cart/Checkout/Account/ApiProductPage giữ nguyên source; ProductPage không đổi gallery/layout, chỉ3 điều kiện/text tồn kho Demo như trên. CSS chung và source các trang bảo vệ giữ nguyên hash; Admin/Reports/Auth/Cart/Order service không sửa. Không migration, seed, dependency/font hoặc ảnh mới. Buy Now giai đoạn này là preview an toàn, không phải chức năng xác nhận đơn một sản phẩm đã hoàn chỉnh.

Ảnh đối chiếu VI cùng ngôn ngữ baseline:12b-after-shop-live-{1440,900,390}-vi.png; Buy preview VI:12b-buy-now-live-1440-vi.png, chụp bằng backend/tests/capture_shop_vi.mjs (read-only API, không cart/order write).


## Giai đoạn 12C — Checkout COD dùng chung (24/11/2026)

Live API sử dụng cùng `ApiCheckout` cho Cart và Buy Now. Buy Now không còn bị khóa ở preview. Demo vẫn chỉ minh họa và không gọi Order API.

### Contract tương thích

- `GET /api/orders/quote.php`: giữ nguyên quote từ cart của session.
- `GET /api/orders/quote.php?mode=buy_now&product_id=9&quantity=3`: quote một sản phẩm active từ MySQL; quantity nguyên 1–999, không vượt kho. Không ghi dữ liệu.
- `POST /api/orders/create.php`: giữ nguyên payload Cart; Buy Now bổ sung `mode: "buy_now"`, `product_id`, `quantity` vào cùng payload địa chỉ/COD/quote_fingerprint/idempotency_key.
- `mode=cart` tương đương mặc định; không cho gắn lựa chọn sản phẩm riêng vào Cart mode. Không nhận giá, tổng tiền, user_id từ client.
- Response quote/order và các endpoint history/detail/cancel giữ nguyên. Session bắt buộc; POST bắt buộc CSRF. Không thêm endpoint hoặc migration.

### Transaction và bảo toàn Cart

1. Chuẩn hóa request và tìm đơn theo UNIQUE `(user_id,idempotency_key)`.
2. Cart khóa cart của chính user rồi các sản phẩm theo thứ tự product_id; Buy Now chỉ khóa sản phẩm đã chọn. Kiểm tra lại active, quantity, stock và quote fingerprint.
3. Dùng chung đoạn tạo địa chỉ, orders/order_items snapshot, payments COD pending, shipments pending, trừ kho có điều kiện và ghi inventory movement.
4. Chỉ Cart mode xóa cart_items sau khi ghi đơn thành công. Buy Now không tạo cart, cart_items tạm, không gọi merge, không thêm/xóa/đổi số lượng cart.
5. Commit hoặc rollback toàn bộ. Giữ retry deadlock/lock timeout và xử lý duplicate key đã có.

Giá = sale_price_vnd khi >0 và <= price_vnd, nếu không dùng price_vnd. Phí từ `CHECKOUT_SHIPPING_FEE_VND`, mặc định PHP 30.000 VNĐ. Frontend luôn dùng quote, không tự tính giá chính thức. Giá thay đổi sau quote trả `QUOTE_CHANGED`, tải lại quote để người dùng xác nhận lại.

Canonical payload Cart giữ nguyên để tương thích retry của đơn cũ. Buy Now bổ sung mode/product_id/quantity vào request hash và gắn mode vào quote fingerprint. Cùng key/nội dung trả đơn cũ; đổi mode, sản phẩm, quantity hoặc địa chỉ bị `IDEMPOTENCY_CONFLICT`. Frontend không coi conflict là thành công. Key retry được giữ trong sessionStorage theo user + nguồn + sản phẩm/quantity; không đổi key khi mất phản hồi. Refresh kiểm tra đơn đã commit bằng checkout_key trước khi lấy quote.

### React và Product Card

- `BuyNowCheckout` Live là adapter mỏng gọi `ApiCheckout`, không có form nhận hàng thứ hai. `buyNowIntent` chỉ lưu ID, quantity, namespace Demo/API.
- Guest được đưa tới Account rồi tự quay lại đúng Buy Now sau đăng nhập. Cơ chế đồng bộ guest cart khi đăng nhập vốn có không bị thay đổi; sản phẩm Buy Now không được đưa vào cơ chế merge.
- Thành công dọn intent, giữ màn hình biên nhận; hủy chỉ dọn ý định mua. Cart Checkout vẫn refetch cart sau thành công; Buy Now không ghi cart và không thay badge.
- Một cặp Mua ngay/Thêm vào giỏ cho Home product sections, Shop, Series Detail, Collections, Related và Wishlist. Ảnh/tên mở chi tiết; Wishlist độc lập. Shop giữ cặp nút thường trực; các card khác giữ overlay hover, hỗ trợ focus-within và hiển thị trên touch/mobile. Bỏ hàng nút lặp ở Series/Collections.
- Product Detail giữ gallery/layout, nút Mua ngay dùng quantity đã chọn. Demo dùng ID namespace riêng, không tạo đơn thật.

### Kiểm thử đã thực chạy

- MariaDB 10.4.32/XAMPP: `test_buy_now.py`, `test_orders.py`, `test_admin.py`; chỉ database test `manga_store_orders_test_20261120` và `manga_store_admin_test_20261122` có ghi dữ liệu kiểm thử.
- Buy Now: quote/tổng server, không cần cart, cart khác sản phẩm giữ nguyên, validation/session/CSRF, COD unpaid, snapshot, ownership, cancel một lần, payment INSERT lỗi rollback, đổi giá, archived/hết kho/không tìm thấy, cùng key đồng thời và retry mất phản hồi, hai khách tranh kho.
- Chrome headless: `check_unified_checkout.mjs` kiểm tra các nguồn Buy Now, tự quay lại sau login, quantity 3, form VI/EN, 1440/900/390, mouse hover, keyboard Enter, mobile touch, mất response sau commit và refresh không thêm POST, lịch sử/hủy, cart badge/rows giữ nguyên. `check_orders.mjs` kiểm tra lại Cart Checkout/history/cancel/isolation.
- Hồi quy GUI: `check_discovery.mjs` (Hero/series/search/gallery màu gốc), `check_flipbook.mjs`, `check_unified_demo.mjs`, `check_demo_checkout.mjs`.
- Screenshot trước/sau: `frontend/.artifacts/12c-before-*` / `12c-after-*`; checkout thật `12c-buy-checkout-{1440,900,390}-en.png`, `12c-buy-checkout-390-vi.png`, `12c-buy-success-recovered.png`. Preview cũ có bằng chứng giai đoạn 12B trong `12b-buy-now-live-1440-vi.png`. Cart Checkout dùng `orders-checkout-desktop-en.png` và `orders-checkout-mobile-en.png`.

Giới hạn: không thêm bộ chỉnh quantity tại Checkout; lấy quantity từ Card/PDP. Demo không tạo đơn. Chưa có thanh toán thật/hoàn tiền. Kiểm thử mạng mô phỏng làm rơi response HTTP đã commit, không phải kiểm thử mất điện MariaDB.

### Sao lưu và khôi phục

Backup đầy đủ trước triển khai: `C:/xampp/manga-store-backups/2026-11-24-unified-checkout/manga_store.sql`; snapshot `before.json`, source cũ trong cùng thư mục. Không cần khôi phục DB khi chỉ rollback code vì không migration/ghi thử lên DB chính. Nếu cần phục hồi dữ liệu thật, dừng thao tác ghi, sao lưu trạng thái mới và import dump bằng mysql/phpMyAdmin sau khi xác nhận phạm vi; không ghi đè các đơn phát sinh sau bản backup một cách tự động.


Các file thay đổi riêng trong 12C:

- Backend: `backend/src/OrderRepository.php`, `backend/src/orders_bootstrap.php`.
- Frontend: `frontend/src/App.tsx`, `frontend/src/components/ApiCheckout.tsx`, `frontend/src/services/orderService.ts`, `frontend/src/shop/BuyNowCheckout.tsx`, `frontend/src/shop/buyNowIntent.ts`; thêm CSS chỉ cho Product Card actions `frontend/src/shop/product-actions.css`.
- Kiểm thử mới: `backend/tests/test_buy_now.py`, `check_unified_checkout.mjs`, `check_unified_demo.mjs`, `check_unified_before.mjs`; cập nhật selector action trong `check_discovery.mjs` để dùng ảnh/tên thay nút Xem chi tiết đã bỏ.
- Tài liệu: `README.md`, `docs/API.md`. Các thay đổi 12B có sẵn trong working tree được giữ nguyên.

Kết quả cuối: production build, TypeScript và PHP lint đạt. Chrome Live kiểm tra đủ 23 Product Detail và 37 ảnh/gallery, không lỗi JavaScript nghiêm trọng hoặc ảnh sản phẩm hỏng. Kiểm thử Cart nhiều sản phẩm xác nhận hai order_items, tổng backend chính xác, clear cart khi thành công, replay payload cũ hoặc mode=cart cùng một đơn và hủy hoàn kho một lần. Hash dữ liệu **và schema của cả 17 bảng chính trước/sau trùng nhau**; vẫn 23 active, 8 archived, 18 series, 37 ảnh, không có đơn kiểm thử trên DB chính. Các hàm Home, CharacterArt, Header, Footer khớp source trước sửa; CSS toàn cục và các trang Admin/Reports không sửa trong 12C. Bằng chứng tổng hợp ở `frontend/.artifacts/12c-tests.json` và `12c-preservation.json`. Không tuyên bố pixel-perfect hoặc đã kiểm thử mọi môi trường mạng/phần cứng.
