# Manga Store — Starter cho VS Code + XAMPP

**Nguồn:** `frontend/` là bản sao nguyên trạng từ ZIP Figma Make do người dùng cung cấp, không chỉnh sửa code giao diện.
**Chưa chạy thử trên XAMPP của bạn.**

## Cấu trúc

- `frontend/`: React 19, TypeScript, Vite 8, Tailwind CSS 4 + CSS từ Figma, VI/EN
- `backend/public/health.php`: endpoint thử Apache + PHP (KHÔNG kiểm tra database)
- `database/01_schema.sql`: schema MariaDB/MySQL 17 bảng
- `database/02_seed_demo.sql`: dữ liệu demo 8 sản phẩm khác mẫu hardcode Figma, giá VND
- `database/03_smoke_test.sql`: truy vấn kiểm tra dữ liệu
- `docs/diagrams/`: 4 sơ đồ từ kế hoạch dữ liệu
- `docs/CODEX_PROMPT.md`: prompt chính xác cho Codex

## Bước 1 — Cài đặt

1. Cài VS Code, Git, XAMPP và Node.js 22.12+ (khuyên Node 22 LTS tương thích Vite 8).
2. Giải nén starter vào `C:\xampp\htdocs\manga-store\` (hoặc thư mục dự án khác; nếu khác phải điều chỉnh URL PHP).
3. Mở thư mục `manga-store` trong VS Code.

## Bước 2 — Chạy frontend

Trong Terminal VS Code (PowerShell):

```powershell
cd C:\xampp\htdocs\manga-store\frontend
node -v
npm -v
npm install
npm run dev
```

Source gốc có `server.port = 8443` và `strictPort: true` ở `frontend/vite.config.ts`.
Mở `http://localhost:8443/` nếu terminal xác nhận địa chỉ đó.
Không dùng `http://localhost/manga-store/frontend` để chạy mã nguồn React ở chế độ dev.
Nếu lỗi cổng 8443, hướng dẫn Codex đổi cổng sang 5173 trong `vite.config.ts`, chỉ đổi cấu hình, giữ nguyên UI.

## Bước 3 — Chạy PHP + MariaDB

Trong XAMPP Control Panel bấm **Start Apache**, **Start MySQL**.
Kiểm tra: `http://localhost/manga-store/backend/public/health.php`
Kết quả mong đợi: JSON có `"status":"ok"`, `"database":"not_checked"`.
Nếu Apache dùng port 8080, dùng `http://localhost:8080/...`.
Vào `http://localhost/phpmyadmin` (hoặc cùng port Apache), import theo đúng thứ tự:

1. `database/01_schema.sql`
2. `database/02_seed_demo.sql` (chỉ chạy một lần trên DB sạch)
3. `database/03_smoke_test.sql` (thử ở tab SQL)

Không import seed lần hai khi chưa reset DB. KHÔNG xóa DB nào khác có sẵn.
Không bật truy cập XAMPP từ Internet để thử nghiệm.

## Bước 4 — Giao Codex

Mở `docs/CODEX_PROMPT.md` và gửi cho Codex trong VS Code.
Yêu cầu Codex kiểm tra code, chạy npm build và frontend, rồi lần lượt hoàn thiện PDO và API.
Không được khẳng định frontend đã build/SQL đã import thành công nếu chưa kiểm tra trên máy.

## Các khoảng cách giữa demo Figma và DB

- Figma: giá USD `price`, demo 8 sản phẩm từ biến `products` tại `src/App.tsx`.
- DB: `price_vnd` và `name_vi/name_en` cho 8 sản phẩm demo **khác tên và giá**.
- Figma: đổi trang bằng state `Page`, không có URL router thực.
- Figma: giỏ và wishlist lưu trong state React; reload sẽ mất dữ liệu.
- Figma: form thanh toán chỉ gọi `e.preventDefault()`, không ghi đơn hàng.
- Figma: ảnh minh họa tải từ Unsplash qua Internet.
- Figma: brand hiện còn `MANGA UNIVERSE`; **chưa đổi** theo yêu cầu giữ bản cũ.
- Figma: giao diện VI/EN có sẵn, persistence dùng localStorage, và dịch một phần qua DOM MutationObserver.

## Nguyên tắc

- Không tự thay thế UI, CSS, hình ảnh, animation và brand trong giai đoạn đầu.
- Backend SQL dùng prepared statements (PDO), mã hóa mật khẩu bằng `password_hash`/`password_verify`.
- Không commit thông tin kết nối DB hoặc tài khoản thực.
- Chỉ để frontend gọi API sau khi so sánh snapshot giao diện trước/sau.

## Admin Dashboard - Phase 9

Open `http://localhost:8443/#admin` after Admin login, or Account > Admin. Manage orders, actual COD receipts, products, images and inventory; customer data is read-only. No migration or customer redesign. Create an Admin with `backend/scripts/manage_admin.ps1` (hidden password prompt). See [Phase 9 API, tests and recovery](docs/API.md#phase-9---admin-dashboard-2026-11-22). Earlier notes about missing Admin functionality are historical.

## Giai đoạn 10 — Báo cáo & Thống kê

Admin mở `http://localhost:8443/#admin/reports`: KPI, biểu đồ doanh thu COD thực thu, trạng thái đơn, Top sản phẩm, danh mục và 4 loại CSV. Dùng múi giờ UTC+7; dữ liệu chỉ đọc, không migration/seed database chính. Xem [docs/API.md](docs/API.md) phần Giai đoạn 10 cho công thức, giới hạn, kết quả kiểm thử và công cụ `backend/scripts/seed_reports_demo.php` chỉ cho database mô phỏng cô lập.

## Giai đoạn 11A — Quản lý ảnh & Manga Flipbook

Admin Products có + THÊM SẢN PHẨM, chọn/preview ảnh ngay khi tạo, thay/xóa liên kết/đặt ảnh chính từng ảnh. File cũ được giữ để khôi phục; audit CLI chỉ đọc tại `backend/scripts/audit_product_images.php`. Startup loader là sách manga CSS 3D sáu trang, VI/EN, reduced motion, thoát khi ready/error và không lặp theo thao tác. Không migration hoặc thay 37 ảnh live. Xem [docs/API.md](docs/API.md) phần Giai đoạn 11A cho API, backup, giới hạn và kết quả kiểm thử thực tế.

## Giai đoạn 11B — Khám phá catalog thật

Live mode có Hero 4 manga, `#series`/`#series/<slug>` để khám phá 7 series và 14 tập, `#collections` để xem 6 figure thuộc 5 series; chưa có phụ kiện. Product Detail hiển thị màu ảnh gốc, Shop/Hero giữ editorial monochrome. Không migration hoặc đổi dữ liệu. Demo Hero/Series giữ riêng; các chức năng thương mại điện tử/Admin/Loader giữ nguyên. Xem [docs/API.md](docs/API.md) phần Giai đoạn 11B cho nguồn dữ liệu, quy tắc số tập, metadata API, screenshot trước/sau, kết quả test và giới hạn.

## Giai đoạn 11C — Đính chính vị trí Hero

Homepage ở Demo và Live đã khôi phục Hero Figma trắng/mascot/artwork gốc. Dynamic Manga Hero chuyển lên đầu `#series` Live, trước Series Explorer; Detail không chèn slider. Giữ toàn bộ chức năng 11B, không đổi PHP/API/MySQL. Xem [docs/API.md](docs/API.md) phần 11C và ảnh `frontend/.artifacts/11c-home-*.png` / `11c-series-*.png` để đối chiếu riêng từng trang.

## Giai đoạn 11D — Navbar, Phụ kiện và About

Navbar dùng chung còn 5 mục, giữ nguyên cấu trúc/style/icon; `#shop`, `#series`, `#collections`, `#about` độc lập. Figure Collections được tái sử dụng ở Phụ kiện, không còn lặp ở Series; CTA nhỏ vẫn kết nối hai trang. About song ngữ dùng asset cục bộ và giới thiệu trung thực đây là đồ án. Home/Shop/Product Card/Footer/CSS chung giữ nguyên. Xem phần 11D trong [docs/API.md](docs/API.md) cho nguyên nhân lỗi, route, kiểm thử Chrome và screenshot trước/sau 1440/900/390.

## Giai đoạn 11E — Typography & CTA scoped

Series, Collections và About dùng lại Barlow Condensed/Inter từ Home, có hierarchy display/section/card/metadata. About CTA giữ hiệu ứng nền nhưng chữ/mũi tên nằm trên overlay; hỗ trợ hover, focus-visible, touch và reduced motion. Collections gọn hơn theo số figure mỗi nhóm; không đổi dữ liệu hoặc card dùng chung. Không sửa App.tsx, index.css, Navbar, Home, Shop, Footer hoặc backend. Xem [docs/API.md](docs/API.md) phần 11E và screenshot `frontend/.artifacts/11e-*` cho audit computed font, trước/sau và kiểm thử thực tế.

## Giai đoạn 12A — Admin Products & tạo Series

Đã áp dụng migration002 được duyệt, chỉ thêm UNIQUE(title) cho manga_series, giữ18 series và toàn bộ dữ liệu hiện có. Admin → Products có overview thật, search/category/series/status/low-stock/sort, phân trang10/20/50 và form4 nhóm. Nút + TẠO BỘ TRUYỆN mở dialog tại chỗ, tự chọn ID thật và giữ nội dung/file ảnh đang nhập. Giữ quy tắc tồn kho và luồng ảnh/draft hiện có. Xem [docs/API.md](docs/API.md) phần “12A triển khai sau phê duyệt” cho API, backup/rollback, screenshot và kiểm thử MariaDB/React thực tế.

## Giai đoạn 12B — Shop & Buy Now an toàn

Shop giữ Hero/Card Manga Editorial, có toolbar/sidebar lọc thật, grid4/2/1 cột tại1440/900/390 và hai action Mua ngay/Thêm vào giỏ. Ảnh/tên mở đúng Product Detail, Back giữ bộ lọc. Buy Now lưu riêng ID/quantity/mode, mở #checkout/buy-now/<id> với đúng một sản phẩm, không thêm/xóa cart. Backend hiện chỉ checkout từ cart: xác nhận đơn Buy Now đang bị chặn và có thông báo rõ; không tạo thành công giả. Checkout COD từ cart giữ nguyên. Không sửa PHP/MySQL/catalog. Xem [docs/API.md](docs/API.md) phần12B cho giới hạn, file và bằng chứng Chrome/build.


Giai đoạn 12C: Live Buy Now dùng cùng Checkout COD với Cart, hỗ trợ quantity từ Product Detail, quote/tổng tiền server và idempotency; không ghi/xóa cart. Product Cards thống nhất Mua ngay / Thêm vào giỏ, ảnh và tên mở chi tiết, bỏ action bar lặp tại Series/Collections. Demo không gọi Order API. Chi tiết contract, kiểm thử cô lập, screenshot và backup ở mục Giai đoạn 12C trong [docs/API.md](docs/API.md).


## Giai đoạn 13 — Checkout ba bước & Sandbox

Checkout Cart/Buy Now dùng chung ba bước Thông tin → Thanh toán → Hoàn tất, có trang hoàn tất đọc lại đơn khi refresh và Order History/Detail mới. COD hoạt động trên Live. Chuyển khoản/VietQR thật đang tắt theo yêu cầu chủ dự án; Sandbox chỉ tạo đơn mô phỏng trong database test, QR không chứa tài khoản/lệnh chuyển tiền. Admin đối soát có amount/reference và chống biên nhận trùng; Reports tách COD/bank/tổng đã xác nhận. Không migration hoặc ghi dữ liệu kiểm thử vào database chính. Cấu hình, API, file, kiểm thử, screenshot và rollback xem mục Giai đoạn 13 trong [docs/API.md](docs/API.md).


## Giai đoạn 14 — Vũ trụ của tôi

Account dùng Barlow Condensed/Inter và CSS scoped trong `frontend/src/account/account.css`; Hero outline, sidebar hồ sơ, bốn thống kê, lịch sử dạng hàng/card responsive. Không sửa Header/Footer/Home/Shop hoặc CSS toàn cục.

### Dữ liệu và điều hướng
- Auth session cung cấp ID, tên, email, role và ngày tạo tài khoản. Avatar lấy initials; hồ sơ chỉ đọc vì chưa có API cập nhật.
- Tổng đơn: COUNT orders theo session user; đang xử lý: pending + confirmed + processing + shipping; yêu thích: danh sách Wishlist hiện có; đã giao: delivered. Không có hệ thống điểm thành viên nên thẻ thứ tư là Đơn đã giao.
- `#account`, `#account/orders`, `#account/orders/<id>`, `#account/information`; query `status` và `page` giữ lọc/phân trang khi refresh/Back/Forward. Wishlist và logout tái sử dụng chức năng cũ.
- Order Detail, snapshot, hướng dẫn Sandbox và hủy đơn dùng OrdersPanel/OrderReceipt hiện có. Trạng thái thanh toán lấy backend; không suy ra paid từ delivered hoặc từ việc xem QR.
- Demo không gọi Order API, hiển thị chỉ số đơn chưa khả dụng thay vì số liệu giả. Không bổ sung loyalty hoặc chỉnh sửa hồ sơ.

### API đọc bổ sung, tương thích ngược
`GET /api/orders/index.php?view=account&status=all&page=1&per_page=10`

Session bắt buộc; user_id lấy từ server. `status`: all/pending/confirmed/processing/shipping/delivered/cancelled; `per_page`: 10/20/50. Response data gồm `items`, `counts`, `total_orders`, `total`, `page`, `pages`, `page_size`. Tổng theo trạng thái không bị giới hạn bởi trang hiện tại. Sort created_at DESC, id DESC; clamp trang không hợp lệ sau thay đổi dữ liệu. Truy vấn trong transaction READ ONLY REPEATABLE READ; payments có UNIQUE order_id, không nhân đôi đơn. Không có view thì response array cũ vẫn giữ nguyên. Không migration hoặc API ghi mới.

### Kiểm thử thực tế
- `test_account_read.py`: 105 đơn tài khoản A, 3 đơn B trên database cô lập; phân trang không trùng/mất, đủ sáu trạng thái, validation422, guest401, sở hữu404, response cũ và đối chiếu 17 bảng trước/sau đọc: PASS.
- Chrome `check_account_dashboard.mjs`: 1440/900/390, VI/EN, dữ liệu thật từ fixture cô lập, lọc/phân trang/deep link/refresh/Back/Forward, Wishlist, logout/đổi tài khoản, keyboard/hover/touch, hủy một đơn Sandbox tạo qua API và hoàn kho một lần: PASS.
- `check_account_edges.mjs`: loading không hiển thị 0 giả, lỗi API/retry/session hết hạn: PASS. `check_account_demo.mjs`: không gọi Order API, không overflow ba viewport: PASS.
- Hồi quy Chrome Checkout Phase13 COD/Buy Now/Bank/VietQR Sandbox, API Admin, API Reports và Chrome catalog Live: PASS. Không chuyển tiền thật.
- Vite production build, TypeScript noEmit, PHP lint ba file mới/sửa và git diff --check: PASS (Git có cảnh báo line ending thông thường).
- Bằng chứng nằm trong `frontend/.artifacts/14-*.json` và `14-*.png`. Screenshot sử dụng tài khoản/dữ liệu mô phỏng trong database cô lập, không phải đơn chính. Không tuyên bố pixel-perfect.

### File Giai đoạn 14
Thêm `frontend/src/account/{AccountDashboard.tsx,account.css,accountService.ts,routes.ts}`, `backend/src/AccountOrderRead.php`; sửa `App.tsx`, `i18n.tsx`, `AccountPanel.tsx`, `OrdersPanel.tsx` và nhánh index đọc trong `orders_bootstrap.php`. Thêm fixture/API/Chrome tests Account; điều chỉnh bốn regression harness để chấp nhận nhãn LOG OUT. Các thay đổi Giai đoạn 13 có sẵn không thuộc phạm vi Giai đoạn 14.

Đối chiếu snapshot riêng `C:/xampp/manga-store-backups/2026-11-26-account/before.json` và `after.json`: toàn bộ schema và SHA256 dữ liệu 17 bảng chính giống nhau; 31 sản phẩm (23 active/8 archived), 37 ảnh, 18 series, 2 đơn được giữ nguyên. Không ghi dữ liệu kiểm thử vào database chính. Kết quả không chứa thông tin riêng tư: `frontend/.artifacts/14-preservation.json`.

Khôi phục giao diện nếu cần: dùng bản sao source trước Giai đoạn 14 tại thư mục backup trên để phục hồi riêng năm file đã sửa và loại bỏ các file Account mới; không phục hồi toàn bộ commit hay database vì sẽ ảnh hưởng công việc khác. Không cần rollback schema/dữ liệu.


## Giai đoạn 15 — Product Detail Accordion

Ba mục thông tin đã có toggle độc lập, VI/EN, keyboard/touch và nội dung theo catalog xác minh. Xem [báo cáo, nguồn metadata, giới hạn chính sách và screenshot](docs/PHASE15_PRODUCT_ACCORDION.md). Không migration hoặc thay dữ liệu chính.


## Giai đoạn 16B — About & Contact

Trang `#about` có câu chuyện thương hiệu VI/EN, giá trị cho độc giả, Email/Điện thoại/Facebook và Google Maps đúng tọa độ được cung cấp. Footer Liên hệ mở `#about/contact`. Xem [báo cáo, cấu hình và kết quả kiểm thử](docs/PHASE16B_ABOUT_CONTACT.md).
