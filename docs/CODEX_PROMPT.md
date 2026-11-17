# PROMPT CODEX — KHỞI ĐỘNG WEBSITE MANGA STORE TRÊN VS CODE + XAMPP

Bạn là kỹ sư full-stack phụ trách kết nối thiết kế Figma Make với backend PHP/MariaDB.

## Nguồn code đang có
- `frontend/`: source React 19, TypeScript, Vite 8, Tailwind CSS 4 xuất từ Figma Make.
- `frontend/src/App.tsx`: 7 màn hình (home, shop, product, series, cart, checkout, account).
- `frontend/src/i18n.tsx`: VI/EN, sử dụng localStorage và MutationObserver cho nhiều text nodes.
- `frontend/src/index.css`: CSS tùy chỉnh, hiệu ứng, kiểu chữ, responsive.
- `frontend/vite.config.ts`: mặc định port 8443, strictPort true, có plugin đặc thù Figma.
- `database/*.sql`: 17 bảng + dữ liệu demo + truy vấn kiểm tra.
- `backend/public/health.php`: health endpoint Apache/PHP, chưa kiểm tra kết nối DB.

## Nhiệm vụ — làm theo thứ tự, không bỏ bước
1. Kiểm tra toàn bộ cấu trúc và tạo Git commit ban đầu giữ nguyên source Figma; không đụng tới UI.
2. Chạy `npm install`, `npm run dev`, `npm run build` trong `frontend/`; báo rõ port và lỗi nếu có. Nếu config Vite đặc thù Figma lỗi ở local, điều chỉnh tối thiểu, không đổi JSX/CSS.
3. Kiểm tra XAMPP Apache và MySQL đang chạy. Chạy endpoint `backend/public/health.php`, phân biệt status PHP vs kết nối database.
4. Import `database/01_schema.sql`, `database/02_seed_demo.sql` trên database mới `manga_store` qua phpMyAdmin. Không xóa database sẵn có; không seed nhiều lần. Chạy `03_smoke_test.sql` để xác minh.
5. Tạo `backend/config/` kết nối PDO (cấu hình bằng `.env` được gitignore), tạo API GET `/api/products` và GET `/api/products/{id}` phù hợp Apache local; sử dụng prepared statements và JSON UTF-8. Không để lộ thông tin lỗi DB/secret ra HTTP response.
6. Khi API trả dữ liệu OK, tạo React data adapter riêng (không sửa layout) mapping `id`, `name_vi/name_en`, `price_vnd`, `category`, `series`, `image_url` sang kiểu dữ liệu UI. Đừng đảo lẫn USD với VNĐ hoặc coi 8 sản phẩm demo DB là trùng với 8 sản phẩm mẫu Figma.
7. Chỉ khi có snapshot trước/sau và người dùng đồng ý, thay data mock trong frontend bằng API; giữ nguyên layout, CSS, animation, logo, màu sắc, tiếng Việt/tiếng Anh.
8. Ghi lại lệnh chạy, URL truy cập và checklist lỗi. Không tự triển khai thanh toán thực, không tạo tài khoản admin cài sẵn.

## Điều bắt buộc
- Giữ nguyên giao diện từ file ZIP, không sáng tạo lại trang, không đổi tên thương hiệu.
- XAMPP chạy PHP/MariaDB; Vite phục vụ frontend dev. Không copy `src/*.tsx` vào thư mục PHP như một site PHP thuần.
- Giữ chức năng VI/EN. Chỉ chuyển từ mẫu giá USD sang VNĐ khi kết nối dữ liệu đã xác nhận.
- Không đổi product mock / image URL ngay giai đoạn kiểm tra chạy UI.
- Tạo API an toàn, chuẩn bị cho bước mở rộng giỏ hàng, tài khoản, đơn hàng.
- Báo rõ những bước chưa thể tự kiểm thử do quyền truy cập XAMPP local.

## Điều kiện hoàn thành vòng đầu
- Frontend Figma lên trang ở localhost đúng về bố cục.
- Apache xử lý `health.php` và trả JSON.
- CSDL import thành công trên máy với 17 bảng, 6 danh mục, 3 series, 8 sản phẩm demo.
- API có thể đọc danh sách sản phẩm từ MariaDB.
- Không thay đổi giao diện trong vòng đầu.
