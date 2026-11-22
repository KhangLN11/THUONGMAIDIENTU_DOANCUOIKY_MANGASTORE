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
