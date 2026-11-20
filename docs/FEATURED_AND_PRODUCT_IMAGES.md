# Giai đoạn 5C – Featured Manga và ảnh sản phẩm

Đã thực hiện và kiểm thử ngày 18/11/2026 trên Chrome headless, Vite `http://localhost:8443`, Apache/XAMPP và MariaDB thật. Không cài dependency, không sửa API, không ghi database.

## File trong phạm vi 5C

Sửa:
- `frontend/src/App.tsx`: thay nội dung bốn panel; dùng cấu hình riêng; mở Shop lọc theo `product.api.series.slug`. Bộ lọc danh mục, tìm kiếm, tổng số và mức giá sử dụng tập sản phẩm của series. Menu Shop mở lại đủ catalog. Không dùng vị trí mảng hoặc ID giả để liên kết database.
- `frontend/src/index.css`: thêm selector riêng cho card API và gallery API; không sửa quy tắc banner hay Demo.

Tạo:
- `frontend/src/config/featuredManga.ts`: bốn slug đã xác minh, tên chính thức, nội dung VI/EN, vị trí ảnh nền và dấu trang trí.
- `frontend/public/featured-manga/one-piece.jpg`, `attack-on-titan.webp`, `naruto.jpg`, `dragon-ball.jpg`: sao chép nguyên byte từ ảnh catalog đã duyệt; không tạo bằng AI, không sửa watermark.
- `backend/tests/check_featured_images.mjs`: kiểm tra Chrome trước/sau, geometry panel, liên kết slug, VI/EN, contain và hồi quy Demo.
- Tài liệu này.

`ProductImage.tsx` đã được kiểm tra: fallback ảnh hỏng có sẵn, không cần sửa. Không thay đổi dữ liệu Demo, ProductAdapter, JSX gallery, giá hay tồn kho.

## Featured và nguồn ảnh

Thứ tự: ONE PIECE / ATTACK ON TITAN / NARUTO / DRAGON BALL.

| Series slug | Sản phẩm nguồn | File cục bộ | Nguồn đã xác minh trong manifest |
| --- | --- | --- | --- |
| one-piece | `CAT-MG-OP-VI-01` | `one-piece.jpg` | [Trang sản phẩm](https://nxbkimdong.com.vn/tap-le-one-piece-ban-bia-roi-1-50?variant=198564831) / [Ảnh gốc](https://bizweb.dktcdn.net/100/576/749/products/one-piece-bia-tap-1.jpg?v=1767755588537) |
| attack-on-titan | `CAT-MG-AOT-EN-01` | `attack-on-titan.webp` | [Trang sản phẩm](https://kodansha.us/series/attack-on-titan/volume-1/) / [Ảnh gốc](https://production.image.azuki.co/dbbce4fb-a8e3-4813-8fb4-418bdde97eba/800_5-7.webp) |
| naruto | `CAT-MG-NAR-VI-01` | `naruto.jpg` | [Trang sản phẩm](https://nxbkimdong.com.vn/tap-le-naruto?variant=213658673) / [Ảnh gốc](https://bizweb.dktcdn.net/100/576/749/products/1-d460644f5b8c446da82d3d7a08f91abc-bd9ddc58-6a33-4dcf-922d-9d45e59e4809.jpg?v=1765107759193) |
| dragon-ball | `CAT-MG-DB-VI-01` | `dragon-ball.jpg` | [Trang sản phẩm](https://nxbkimdong.com.vn/tap-le-dragon-ball-7-vien-ngoc-rong-29?variant=198564278) / [Ảnh gốc](https://bizweb.dktcdn.net/100/576/749/products/dragon-ball-tap-1-047b116d3f0e4637a6f97bef34bb03f0-a4057a3a-b29a-4f1c-9104-e23f06c153ba.jpg?v=1765030398717) |

One Piece, Naruto và Dragon Ball dùng bìa tập 1 bản Việt Nam (NXB Kim Đồng). Attack on Titan dùng bìa tập 1 bản tiếng Anh Kodansha. Các bản sao khớp SHA-256 trong `database/catalog/demo-products/manifest.json`; không tải lại ảnh từ Internet.

Panel tiếp tục dùng `cover`, grayscale, opacity, gradient trắng, kích thước, grid, typography và hover ban đầu. `object-position` riêng giữ nhân vật ở vùng nhìn thấy, đặc biệt Titan trong panel ngang. Không cần bổ sung artwork để vận hành; bìa được crop nghệ thuật trong nền, khác với ảnh sản phẩm phải hiện đầy đủ.

Mỗi card mở Shop với đúng hai sản phẩm active của slug tương ứng. Đổi VI/EN giữ bộ lọc series và ID sản phẩm; menu Shop trả lại 23 sản phẩm. Không cần endpoint mới.

## Nguyên nhân và cách sửa crop

CSS cũ đặt `object-fit: cover` cho card, ảnh chính và thumbnail. Tỷ lệ khung khác tỷ lệ ảnh làm cắt bìa/figure; hover `scale(1.06) rotate(0.7deg)` cắt thêm qua `overflow: hidden`.

Card API nay dùng `contain`, căn giữa, đệm 14px; hover còn `scale(1.02) rotate(0.3deg)` với transition/filter cũ. Gallery và thumbnail API dùng `contain`, căn giữa, đệm 8px. Khung giữ nguyên chiều cao, border, overflow, grid và breakpoint. Wishlist, Quick View và Add to Cart giữ markup/hoạt động ban đầu. Ảnh Hero, Featured, promotional và Demo vẫn dùng cơ chế cũ.

Kiểm tra bảng ảnh nguồn 35 ảnh:
- Bìa manga/novel và ảnh chính figure không cần thay để khắc phục crop CSS.
- `CAT-FG-YOR-PUP` ảnh 3 và `CAT-FG-FER-PUP` ảnh 3 là ảnh cận cảnh từ nguồn; không có phần chân để CSS khôi phục. Ảnh 1/2 cung cấp góc toàn thân. Giữ nguyên các ảnh phụ có chủ đích này.
- `CAT-MG-KAG-VI-02` là ảnh sản phẩm có sách kèm phụ kiện; file nguồn ngang, vì vậy có khoảng trắng lớn hơn khi contain. Nếu muốn bìa phẳng riêng, cần chọn nguồn khác trong một nhiệm vụ được duyệt; không đổi ảnh ở đây.

## Kết quả thực tế

- `npm run build`: PASS. `tsc --noEmit`: PASS. Vite vẫn có cảnh báo tương thích configLoader native cho cấu hình Figma hiện có; không chặn build.
- Chrome 1440×1000 và 390×844: Featured giữ nguyên kích thước bốn panel, grid, gap, border và font so với snapshot trước sửa. Bốn tiêu đề chính thức, mô tả VI/EN đúng dấu, ảnh cục bộ tải được. Mỗi link trả đúng hai sản phẩm theo slug, không lẫn series.
- Shop API: đủ 23 sản phẩm; ảnh card contain ở cả hai viewport, không tràn ngang. Hover còn hoạt động; bộ lọc Manga 14 / Novel 3 / Figure 6, tìm Naruto 2 sản phẩm.
- Chrome mở đủ 23 trang chi tiết, chọn đủ 35 ảnh; ảnh chính và thumbnail contain, căn giữa. VI/EN tên/mô tả/alt và giá VND đúng, đổi ngôn ngữ không đổi ảnh đang chọn hoặc ID. Giỏ hàng giữ đúng sản phẩm khi điều hướng; không triển khai checkout thật.
- Không có uncaught exception, `console.error` hoặc request ảnh sản phẩm thất bại trong các phiên kiểm thử API thực tế.
- API Apache: HTTP 200, 23 active, 23 chi tiết đúng manifest; 8 archived trả 404. Kiểm tra đủ 35 ảnh trên Apache và Vite (70 HTTP request): HTTP 200, MIME và SHA-256 đúng.
- Demo: DOM Shop giống snapshot ban đầu; Home ngoài Featured giống snapshot ban đầu. CSS ảnh Demo vẫn cover, không gọi API; desktop/mobile không tràn ngang. Sau thử nghiệm đã khôi phục nguyên byte `.env.local`, giữ `VITE_USE_PRODUCTS_API=true`.
- So sánh schema và toàn bộ dữ liệu của 17 bảng trước/sau: khớp hoàn toàn. Vẫn 31 sản phẩm (23 active, 8 archived), 35 ảnh. Snapshot đầy đủ nằm ngoài webroot tại `C:/xampp/manga-store-backups/2026-11-18-phase-5c/`.

## Giới hạn Demo và ảnh nguồn

Đã sửa bổ sung: Demo khôi phục bốn panel tĩnh NEO TOKYO, VOID RUNNER (HƯ VÔ RUNNER), BLADE ZERO và STEEL SOUL với ảnh, thể loại và mô tả Figma ban đầu. Giữ phần tử button để bảo toàn cách căn nội dung; đặt aria-disabled=true và không gắn onClick/link, nên không mở bộ lọc rỗng hoặc điều hướng sang sản phẩm sai. Không dùng disabled thực tế để tránh thay đổi hover/diện mạo. Menu Shop vẫn mở đủ tám sản phẩm Demo gốc. API vẫn giữ bốn series thật và đúng hai tập mỗi series. Không sửa CSS, database hoặc dữ liệu sản phẩm Demo trong lần bổ sung này. Chrome đã kiểm tra đủ bốn khung có nội dung/ảnh, click không rời Home, VI/EN và desktop/mobile; ảnh bằng chứng: demo-featured-restored-1440.png và demo-featured-restored-390.png.

CSS không thể tạo phần nhân vật không có trong file cận cảnh. Không sửa, thay hoặc upscale ảnh nguồn. Quyền sử dụng ảnh giữ nguyên phạm vi minh họa đồ án đã ghi trong manifest; không khẳng định giấy phép thương mại.

## Bằng chứng và chạy lại

Kết quả chi tiết ở `frontend/.artifacts/` (không đưa lên Git):
- `5c-before.json`, `5c-after.json`: geometry trước/sau, kiểm tra link và contain 23 gallery.
- `5c-demo.json`, `5c-api.json`, `5c-db-verification.json`, `catalog-live-browser.json`.
- `5c-before-featured-1440.png` / `5c-after-featured-1440.png`; `5c-before-shop-390.png` / `5c-after-shop-390.png`.
- `5c-after-featured-vi-390.png`, `5c-after-featured-en-390.png`, `5c-source-audit-35.png`.
- `catalog-live-figure-desktop.png`, `catalog-live-figure-mobile.png`, `5c-demo-shop-desktop.png`, `5c-demo-shop-mobile.png`.

Khi Apache và Vite đang chạy:

```powershell
node backend/tests/check_live_catalog.mjs
python backend/tests/test_live_catalog.py
node backend/tests/check_featured_images.mjs --after
cd frontend
npm.cmd run build
./node_modules/.bin/tsc.cmd --noEmit
```

Script Chrome cần Chrome ở đường dẫn Windows trong script, Node có WebSocket tích hợp và cổng CDP 9229 trống. Kiểm tra `--after` cần snapshot `5c-before.json`; chạy script không tham số để tạo baseline khi chưa có. Kiểm tra `--demo` cần chủ động bật Demo và các snapshot HTML Demo từ giai đoạn trước; luôn khôi phục cấu hình API sau khi thử.
