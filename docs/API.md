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
