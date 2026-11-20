# Giai đoạn 6 – Authentication và quyền User/Admin

Ngày triển khai: 19/11/2026. Đã chạy trên PHP 8.0.30/Apache XAMPP, MariaDB thật, Vite 8443 và Chrome headless. Không migration, không seed tài khoản admin, không sửa catalog/CSS gốc.

## Schema thực tế

`users`: `id BIGINT UNSIGNED` PK AUTO_INCREMENT; `full_name VARCHAR(150)`; `email VARCHAR(190)` UNIQUE `uq_users_email`; `phone` nullable; `password_hash VARCHAR(255)`; `role ENUM('customer','admin')`; `status ENUM('active','blocked')`; `created_at`, `updated_at` tự quản lý. Engine InnoDB, utf8mb4_unicode_ci.

Tận dụng `customer` làm vai trò User: database lưu `customer`, API trả `user`. Không đổi enum hay tạo bảng mới. Public register luôn INSERT customer/active; gửi role/status/id bị từ chối 400. Chỉ CLI tin cậy cấp admin.

## File tạo mới

Backend:
- `backend/src/AuthRepository.php`: PDO prepared statements, hash mật khẩu, trả danh sách trường công khai.
- `backend/src/auth_bootstrap.php`: JSON/error an toàn, session/CSRF, validation và `Auth::requireUser()` / `Auth::requireAdmin()`.
- `backend/src/AuthRateLimiter.php`: bucket server-side có flock, ngoài webroot, không phụ thuộc session/cookie người dùng.
- `backend/public/api/auth/register.php`, `login.php`, `logout.php`, `me.php`.
- `backend/public/api/admin/access.php`: API kiểm tra quyền, không phải dashboard.
- `backend/scripts/admin_account.php`: CLI nhận JSON qua STDIN, tạo/cấp admin có kiểm soát.
- `backend/scripts/manage_admin.ps1`: wrapper nhập mật khẩu ẩn và xác nhận cấp quyền.

Frontend:
- `frontend/src/services/authService.ts`: Fetch, credentials same-origin, timeout, kiểm tra HTTP/success/schema; CSRF chỉ ở bộ nhớ.
- `frontend/src/contexts/AuthContext.tsx`: trạng thái phiên, refresh/login/logout và AuthGuard tái sử dụng. Chia sẻ request me ban đầu để tránh StrictMode tạo hai phiên guest cạnh tranh.
- `frontend/src/components/AccountPanel.tsx`: form và thông tin tài khoản thật; giữ khung Account, typography và breakpoint sẵn có. Dùng utility tương ứng kiểu form checkout, không sửa index.css.

Kiểm thử: `backend/tests/auth_fixture.php`, `test_auth.py`, `check_auth.mjs`.

## File chỉnh sửa

- `frontend/src/App.tsx`: thay nội dung Account minh họa bằng AccountPanel, bọc AuthProvider; hỗ trợ `/#account` để mở trực tiếp trên mobile mà không thay header. Điều hướng các trang cũ giữ nguyên; rời Account xóa hash riêng của Account.
- `frontend/src/i18n.tsx`: thêm khóa VI/EN cho auth, dùng hệ thống i18n hiện có.
- `frontend/.env.example`: cấu hình base URL auth cùng origin.
- `backend/tests/check_featured_images.mjs`: hồi quy Demo vẫn cấm API sản phẩm nhưng cho phép request me của auth độc lập.
- `docs/API.md`: liên kết tới tài liệu này.

Không sửa Product Card, gallery, giá, tồn kho, cart, wishlist, checkout, Featured, logo/banner/header/footer hoặc index.css. Account bỏ danh tính/đơn hàng/điểm giả của Akira khi hiển thị người dùng thật; các ô thống kê không có backend hiển thị dấu “—” và thông báo rõ giới hạn.

## API

Base Apache: `http://localhost/manga-store/backend/public/api`.
Base Vite: `/api`, proxy hiện có đã chuyển tiếp đúng các đường dẫn con; không đổi vite.config.ts hay cổng.

| Method / endpoint | JSON request | Kết quả |
| --- | --- | --- |
| GET `/auth/me.php` | Không | 200 + user khi đã đăng nhập; 401 UNAUTHENTICATED khi guest; cả hai cấp CSRF token |
| POST `/auth/register.php` | `full_name`, `email`, `password` | 201 user; cần đăng nhập riêng sau đó |
| POST `/auth/login.php` | `email`, `password` | 200 user, đổi session ID và CSRF token |
| POST `/auth/logout.php` | `{}` | 200 data=null, hủy session và xóa cookie |
| GET `/admin/access.php` | Không | 200 admin; 401 guest; 403 user |

Ví dụ thành công:

```json
{"success":true,"data":{"id":42,"full_name":"Nguyễn An","email":"an@example.test","role":"user","status":"active","created_at":"2026-11-19 12:00:00"},"meta":{"csrf_token":"<random token>"}}
```

Không có password_hash, mật khẩu, session ID hoặc thông tin database trong JSON. `meta.csrf_token` là CSRF token, không phải thông tin đăng nhập/session ID.

Các POST phải gửi `Content-Type: application/json`, cookie của phiên guest/đã đăng nhập và `X-CSRF-Token` lấy từ me. Lỗi: 400 payload/role không hợp lệ; 401 chưa xác thực/sai thông tin; 403 CSRF/quyền; 409 email trùng; 415 content type; 422 validation; 429 kèm Retry-After; 500 lỗi nội bộ đã ẩn chi tiết. Method sai trả 405/Allow.

Validation: tên 2–150 ký tự Unicode, không ký tự điều khiển; email chuẩn hóa lowercase/trim, tối đa 190 byte; mật khẩu đăng ký 12–72 byte UTF-8, không NUL. Không trim mật khẩu. Giới hạn 72 byte tránh việc bcrypt âm thầm bỏ phần đuôi. Frontend dùng TextEncoder để đồng bộ quy tắc byte với PHP, kể cả mật khẩu Unicode.

## Session, CSRF và giới hạn đăng nhập

Cookie `MANGA_STORE_SESSION`: host-only, Path=/, HttpOnly, SameSite=Lax; Secure tự bật khi Apache nhận HTTPS, hoặc đặt biến môi trường PHP `AUTH_COOKIE_SECURE=true` khi triển khai sau proxy TLS tin cậy. Không tin tùy ý X-Forwarded-Proto/IP do client gửi. Local HTTP để Secure=false nhằm dùng được cookie trên XAMPP và Vite.

Session strict mode, chỉ dùng cookie, không trans_sid. Đổi ID khi đăng nhập, thời hạn không hoạt động 30 phút và tối đa 8 giờ. User/status/role được đọc lại từ MySQL mỗi request được bảo vệ: khóa tài khoản hoặc thu quyền admin có hiệu lực phía backend ngay lập tức. UI có thể cần refresh để phản ánh thay đổi ở tab khác, nhưng không vượt được guard PHP.

CSRF synchronizer token random 32 byte, so sánh hash_equals cho mọi POST gồm login/register/logout; token đổi khi đăng nhập. Không bật CORS tùy ý. Tham khảo [PHP session configuration](https://www.php.net/manual/en/session.configuration.php), [cookie parameters](https://www.php.net/manual/en/function.session-set-cookie-params.php) và [OWASP CSRF guidance](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.md).

Giới hạn cố định trong 15 phút: login tối đa 5 request/email và 30/IP; register 10/IP. Tất cả lần thử, kể cả thành công, đều tính vào bucket để có chính sách đơn giản và bảo thủ cho đồ án. Đổi cookie không reset giới hạn. Bucket lưu trong thư mục tạm của PHP ngoài webroot, tên email/IP được hash, cập nhật có khóa file. Lỗi storage không bỏ qua bảo vệ. Không tự sửa/xóa bucket để né giới hạn; 429 cho biết thời gian chờ qua Retry-After.

Production nhiều máy cần storage rate-limit dùng chung và cấu hình proxy/IP tin cậy; đây là triển khai local một máy.

## Cấu hình và tạo admin

DB tiếp tục dùng `backend/config/database.local.php` không đưa lên Git hoặc DB_* hiện có. Không đưa thông tin DB vào frontend.

Frontend mặc định `VITE_AUTH_API_BASE_URL=/api`. Nếu production không có reverse proxy, dùng đường dẫn cùng origin `VITE_AUTH_API_BASE_URL=/manga-store/backend/public/api` và cấu hình tương tự cho products. Auth hoạt động độc lập với `VITE_USE_PRODUCTS_API`; Demo không gọi API sản phẩm nhưng vẫn có thể đăng nhập session thật.

Không có tài khoản admin mặc định. Từ PowerShell ở project root:

```powershell
# Tạo admin mới; mật khẩu được hỏi ẩn hai lần, không nằm trong argv/history.
./backend/scripts/manage_admin.ps1 -Action create -Email "admin@example.test" -FullName "Manga Store Admin"

# Hoặc đăng ký tài khoản User qua UI rồi chủ động cấp quyền.
./backend/scripts/manage_admin.ps1 -Action promote -Email "user@example.test"
```

Thay email/tên bằng thông tin bạn muốn dùng. Promote yêu cầu gõ lại email chính xác, chỉ áp dụng tài khoản active/customer; không mở khóa tài khoản blocked. Create không ghi đè email đã tồn tại. Wrapper mặc định dùng C:/xampp/php/php.exe, có tham số PhpBinary nếu cần đường dẫn khác. Nếu chính sách PowerShell chặn script, dùng môi trường PowerShell đã được phép chạy script local của bạn; không cần đổi policy toàn máy.

CLI PHP cũng nhận JSON qua STDIN (`action=create,email,full_name,password` hoặc `action=promote,email,confirm_email`). Không đặt mật khẩu vào command line hoặc file JSON theo dõi bởi Git. Thư mục scripts bị Apache chặn và PHP tự kiểm tra PHP_SAPI=cli. CLI PHP create/promote đã được integration test; wrapper PowerShell đã kiểm tra parser, chưa chạy thử tương tác Read-Host tự động.

## Kiểm thử thủ công

1. Bật Apache/MySQL, chạy Vite 8443. Mở `http://localhost:8443/#account` (dùng được trực tiếp trên mobile), hoặc nút Account hiện có trên desktop.
2. Chọn Đăng ký, nhập tên/email mới/mật khẩu hợp lệ. Sau thông báo thành công, đăng nhập bằng tài khoản đó.
3. Thử email trùng, email sai, mật khẩu sai; lỗi hiển thị theo VI/EN. Không đăng ký bằng role admin.
4. Refresh `/#account`: vẫn thấy đúng tên/email/role. Đổi VI/EN không mất trạng thái phiên.
5. User không có lối Admin; GET `/api/admin/access.php` với session User trả 403. Tạo/cấp admin qua CLI rồi refresh Account, bấm Quyền quản trị để backend xác nhận. Chưa có dashboard.
6. Bấm Đăng xuất: trở lại form, me trả 401. Mobile có nút chuyển form/logout trong nội dung Account vì sidebar cũ được ẩn ở breakpoint 760px; không sửa CSS/header.

## Kết quả đã chạy

- `python backend/tests/test_auth.py`: PASS đăng ký, duplicate 409, email/tên/mật khẩu sai 422, hash DB/password_verify, role customer→user, đăng nhập/regenerate ID, cookie flags, me/phiên, CSRF register/logout, từ chối role injection, user/admin guard, CLI create/promote, demote/block tức thời, logout/cookie cũ/session giả, rate-limit qua nhiều cookie, method 405 và Vite proxy.
- `node backend/tests/check_auth.mjs`: PASS GUI thật đăng ký/validation/login sai và đúng, VI/EN, refresh giữ phiên và route Account, không auth token trong localStorage/sessionStorage, cookie HttpOnly, entry admin được PHP xác nhận, logout bằng nút mobile nhìn thấy, chuyển form bằng click thật; 1440×1000 và 390×844 không tràn ngang. Mật khẩu test Unicode ngẫu nhiên kiểm tra giới hạn byte. Tài khoản tạm được xóa trong finally.
- `node backend/tests/check_live_catalog.mjs`: PASS 23 chi tiết, 35 lần chọn ảnh, VI/EN, VND, tìm kiếm/bộ lọc, hover, cart và desktop/mobile. Không uncaught exception/console.error hay request ảnh sản phẩm thất bại.
- Featured Demo và API: PASS qua `check_featured_images.mjs --demo` / `--after`; Demo Shop và Home ngoài Featured giữ nguyên DOM baseline, Featured tĩnh đủ bốn khung; API link đúng bốn series, mỗi series hai tập. .env.local được khôi phục nguyên byte.
- `python backend/tests/test_api.py`: PASS API 23 sản phẩm, 35 ảnh/70 request ảnh Apache+Vite, 8 sản phẩm archived 404, ID invalid 400, POST 405, config/src bị Apache chặn, health và lỗi DB ẩn chi tiết.
- PHP lint, PowerShell parser, npm run build và tsc --noEmit: PASS. Cảnh báo Vite native configLoader của cấu hình Figma hiện có vẫn còn, không chặn build.

Không thực hiện kiểm thử HTTPS thực tế, email delivery/MFA, tải nhiều máy hoặc chờ 30 phút/8 giờ để đo timeout end-to-end. Các logic timeout/Secure có trong code, không tuyên bố đã kiểm chứng deployment HTTPS.

## Database, backup và bằng chứng

Backup trước thay đổi: `C:/xampp/manga-store-backups/2026-11-19-auth/manga_store_before_auth.sql`; snapshot before/after và hash nguồn ở cùng thư mục ngoài webroot.

Sau khi dọn test, toàn bộ dữ liệu của 17 bảng khớp trước khi triển khai; users trước/sau đều 0. Các INSERT test đã tiêu thụ số AUTO_INCREMENT users; cố ý không reset bộ đếm. Không thay đổi cột, enum, index, khóa hoặc bất kỳ dữ liệu catalog nào: vẫn 31 sản phẩm tổng, 23 active/8 archived và 35 ảnh. Không để lại tài khoản admin/test.

Hash index.css, featuredManga.ts, ProductImage, productAdapter, ProductRepository không đổi. Account là phần UI được bổ sung theo yêu cầu, không khẳng định form mới có DOM giống phần minh họa cũ.

Bằng chứng ở frontend/.artifacts (bị ignore): auth-api.json, auth-browser.json, auth-preservation.json; ảnh auth-login-desktop.png, auth-user-desktop.png, auth-admin-desktop.png, auth-admin-mobile.png, auth-login-mobile.png, auth-register-mobile.png; các báo cáo hồi quy catalog/Featured hiện có. Script kiểm thử chỉ dùng tài khoản ngẫu nhiên auth-test-<nonce>@example.test, chốt không trùng tài khoản có sẵn và xóa đúng email test. Chạy lại có thể gặp 429 nếu thực hiện nhiều lần trong 15 phút; chờ theo Retry-After.

## Chưa triển khai

Dashboard Admin, quản lý user trên web, xác minh email, quên/đổi mật khẩu, MFA, API hồ sơ chỉnh sửa, giỏ hàng/đơn hàng/điểm thành viên/thanh toán. AuthGuard là bảo vệ UI tái sử dụng; endpoint mới bắt buộc gọi guard PHP tương ứng, không chỉ tin vào UI.


## Cập nhật Giai đoạn 7 (20/11/2026)

Cart/Wishlist theo user đã được triển khai, tái sử dụng Auth::requireUser, CSRF và transport sessionRequest. Phần giới hạn giỏ hàng ở kết quả Giai đoạn 6 phía trên là lịch sử; trạng thái hiện tại và các giới hạn guest merge được ghi trong [API.md – Giai đoạn 7](API.md#giai-đoạn-7--shopping-cart-và-wishlist-mysql-20112026). Đơn hàng/checkout/thanh toán vẫn chưa triển khai.
