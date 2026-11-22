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
