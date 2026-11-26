# Giai đoạn 16C — Mobile Shop UI Optimization

## Source và nguyên nhân

Mobile một cột do `shop.css` tại max-width760px đặt `.shop-catalog .shop-grid` thành1fr, ảnh340px và toolbar1 cột. Shop dùng ProductCard chung trong App; không sửa component đó hoặc index.css. Các override mới chỉ ở **max-width600px**. Breakpoint760px của drawer và1100px của grid tablet giữ nguyên.

Ba source sửa:
- `frontend/src/shop/shop.css`: mobile scoped Hero/toolbar/grid/card/drawer.
- `frontend/src/shop/ShopCatalog.tsx`: class cho nhãn sort, aria-label select, hai span nhãn Filter theo breakpoint và guard sự kiện native dialog close.
- `frontend/src/i18n.tsx`: chỉ thêm `shop.filterShort` VI/EN.

Không sửa shopModel, Cart handlers, Buy Now intent, ProductCard dùng chung, Product API/PHP hoặc dữ liệu.

## UI

- Hero giữ font Barlow Condensed, chữ đặc/outline, dot pattern, nhãn và chữ Nhật. Mobile dùng clamp48–64px, line-height .95, outline xuống dòng có chủ đích; padding28/24px. Desktop không đổi.
- Toolbar: Search full width; hàng sau là kết quả thật / Sort / Bộ lọc. Nhãn Search/Sort được giữ cho accessibility; label Sort thu gọn về mặt thị giác, select có aria-label. Không bỏ lựa chọn hoặc thay thuật toán.
- Grid mobile `repeat(2,minmax(0,1fr))`, gap ngang10px, padding14px. Giữ2 cột cả320px vì tên20px, metadata10px, nút44px vẫn đọc/bấm được qua kiểm tra.
- Ảnh contain/center, padding10px, chiều cao clamp170–230px. Giữ filter editorial; không đụng Gallery true-color.
- Tên tối đa3 dòng, metadata2 dòng; tên đầy đủ vẫn nằm trong accessible name và Product Detail. Giá/stock có thể wrap. Wishlist giữ icon, tăng vùng chạm44px chỉ trong mobile Shop.
- Mua ngay / Thêm vào giỏ xếp dọc, mỗi nút tối thiểu44px. Không cần hover, không thêm cặp nút thứ hai.
- Drawer cũ được tái sử dụng: overscroll containment và nút đóng sticky chỉ dưới600px. Native `close` event cũ đôi khi đến sau khi dialog mở lại; guard chỉ cập nhật trạng thái khi dialog thực sự đang đóng. Không đổi logic lọc hay state đã chọn.

Tại390px, baseline đo đầu grid ở y655.875px; sau ở409.719px. Hero giảm266.375→189.719px, toolbar295.5→132px trong môi trường Chrome kiểm thử.

## Kiểm thử thực tế

- Chrome Live/Demo tại320/360/375/390/430/480px: PASS2 cột, VI/EN, không overflow, ảnh contain, mọi nút mua hàng>=44px; không uncaught exception.
-900px giữ2 cột,1440px giữ4 cột. Computed Hero/toolbar/sidebar/grid/card giống baseline. **Bốn cặp PNG trước/sau** (trang và card tại900/1440) giống hoàn toàn theo SHA256, có đối chiếu trực quan. Bằng chứng `16c-desktop-image-comparison.json`.
- Live/Demo actions: PASS mở/đóng drawer bằng touch nhiều lần, Escape và focus trở về trigger; giữ series đã chọn; search, category, series, min/max validation, stock theo dữ liệu API, sort và reset/count. Stock chỉ kiểm thử Live vì Demo không có metadata tồn kho thật.
- Live search “Đại Chiến Titan” và “dai chien titan” trả đúng series. Tìm kiếm/sort VI/EN vẫn dùng thuật toán cũ.
- Image/name mở đúng Detail và Back; Wishlist không đổi route; Add to Cart cập nhật badge và không vào Checkout. Buy Now lưu đúng ID/quantity1, không đổi Cart; guest Live chuyển Account theo auth guard hiện hành, Demo mở checkout Demo. Không tạo đơn trong các test này.
- Catalog chính hiện dưới page-size24: kiểm thử thêm pagination với40 bản ghi **chỉ được inject qua CDP response trong trình duyệt**, không seed/API write: PASS24/16,40 ID duy nhất và filter đưa về trang1. Không trình bày fixture này như catalog thật.
- TypeScript noEmit và Vite production build: PASS. Cảnh báo Vite config đã có không cản build. Không sửa PHP nên PHP lint không áp dụng.

## Bằng chứng và file kiểm thử

- `backend/tests/check_mobile_shop.mjs`: baseline/Live/Demo responsive và computed comparison.
- `backend/tests/check_mobile_shop_actions.mjs`: drawer/filter/navigation/guest actions.
- `backend/tests/check_mobile_shop_pagination.mjs`: fixture browser-only.
- `frontend/.artifacts/16c-before-{390,900,1440}.png`, `16c-before-cards-*.png`.
- `16c-live-after-{320,360,375,390,430,480,900,1440}.png`, `16c-live-after-cards-*.png`, `16c-live-en-cards-*.png`; bộ Demo tương ứng `16c-demo-*`.
- `16c-drawer-{live,demo}.png`; JSON `16c-tests.json`, `16c-preservation.json`.

Không chạy lại mọi giao dịch authenticated Checkout/Admin trong thay đổi CSS này; source và nghiệp vụ đó giữ nguyên, không tuyên bố các test guest đã xác nhận đặt đơn. Không benchmark FPS hoặc thao tác trên điện thoại vật lý; dùng Chrome headless viewport/touch emulation.

## Bảo toàn

Hash mọi source hiện hữu ngoài ba file được phép sửa giữ nguyên. Schema/số dòng/SHA256 cả17 bảng chính giống snapshot trước; không có phép thử ghi database chính, không migration, seed hoặc thay ảnh/giá/tồn kho. Không thêm dependency. Home/Navbar/Footer/Series/Collections/About/Product Detail/Checkout/Account/Admin/Reports/Loader không sửa. `.env.local` khôi phục Live API mode sau các test Demo.
