# Giai đoạn 15 — Product Detail Accordion

## Phạm vi và audit

Ba nút trong `ProductPage` (`frontend/src/App.tsx`) trước đây chỉ có nhãn và Icon plus: không handler, state hoặc panel. Không có component accordion dùng chung; Shop/Reports dùng native details riêng cho nghiệp vụ khác. Giữ nguyên vị trí, typography 9px Inter/700, tracking .12em, padding 18px, border và icon 20px/stroke1.8 của ba nút.

Đã kiểm tra ProductRepository, API, types/adapter, Admin ProductForm, SHOW CREATE TABLE products/manga_series và tài liệu catalog. API trả tên VI/EN, SKU, mô tả VI/EN, danh mục, series, giá, stock, ảnh. Schema không có cột author/publisher/ISBN/dimensions/material/weight hoặc thông số figure riêng. ProductForm hiện chỉ quản lý những field có thật; không thêm field/API mới.

## File thêm/sửa

- Sửa `frontend/src/App.tsx`: chỉ thêm import và thay ba nút trang trí bằng ProductInfoAccordion (có so sánh tự động với source baseline).
- Thêm `frontend/src/components/product-information/ProductInfoAccordion.tsx`: ba mục độc lập, mặc định đóng, dấu +/−, useId liên kết button/panel, aria-expanded/controls/labelledby, region, inert cho panel đóng.
- Thêm `product-info-accordion.css`: CSS scoped, animation grid 0fr/1fr 180ms, focus-visible, hover nhẹ và reduced motion. Không CSS global, không thư viện mới.
- Thêm `productInformation.ts`: adapter chỉ đọc và nội dung shipping/returns/authenticity VI/EN tập trung, không nhân bản vào sản phẩm/database.
- Thêm `verifiedCatalog.json`: trích metadata từ manifest catalog đã có trong project; không tạo thông số mới. Nguồn đầy đủ: `database/catalog/demo-products/manifest.json`, `docs/DEMO_PRODUCT_CATALOG.md`.
- Thêm `backend/tests/check_product_information.mjs`, `check_product_information_demo.mjs`; tài liệu báo cáo này và liên kết README.

## Nguồn dữ liệu và giới hạn

Thông tin hiện hành (tên, danh mục, series, SKU, mô tả) lấy từ Product API/adaptProduct. Chỉ bổ sung metadata cũ khi SKU, slug, cả hai tên/mô tả, category slug và series slug khớp chính xác manifest. Nếu Admin chỉnh sửa danh tính/mô tả, thông số bổ sung cũ tự ẩn; API hiện hành vẫn được hiển thị. Không đoán thông số từ tên.

- Manga: tác giả, NXB, ngôn ngữ và tập đã xác minh. ISBN bản in chỉ có hai tập Attack on Titan; ISBN thiếu được ẩn, không dùng barcode thay ISBN.
- Novel: Makoto Shinkai, NXB và ngôn ngữ từ catalog; không đưa tập manga vào novel. Không hiển thị kiểu bìa/năm xuất bản Suzume đang có mâu thuẫn.
- Figure: nhân vật, maker, dòng, chiều cao xấp xỉ và non-scale đã ghi trong manifest; không bịa PVC, 1/7 hoặc phụ kiện. Ví dụ Frieren160/Fern170/Yor170mm theo dữ liệu catalog.
- Kích thước sách, số trang, trọng lượng, chất liệu và thông tin không có bằng chứng được ẩn; có ghi chú thông số chưa cập nhật. Sản phẩm mới chỉ có API vẫn có nội dung tên/loại/series/SKU/mô tả, không rỗng. Demo chỉ dùng dữ liệu Demo, không ghép thông số MySQL.

Shipping chỉ dẫn đến phương thức/phí Checkout hiện hành; ghi rõ phí minh họa đồ án, không hardcode số tiền/ETA. Chưa tìm thấy chính sách đổi trả đã duyệt hoặc địa chỉ hỗ trợ được cấu hình nên hiển thị đang cập nhật, không bịa kênh liên hệ.

Giữ nhãn VI “CAM KẾT CHÍNH HÃNG”, nhãn EN “AUTHENTICITY INFORMATION”. Nội dung nói rõ giới hạn dữ liệu/nguồn gốc, không phải bảo đảm thương mại/chứng nhận. Chủ dự án cần xác nhận nội dung này trước khi dùng như lời bảo đảm bán hàng thực tế.

## Kiểm thử thực tế

- Chrome headless 1440/900/390: click mở/đóng, ba mục độc lập, dấu +/−, mặc định đóng; VI/EN giữ trạng thái và quantity; Enter/Space, mouse hover, touch; reduced motion; không overflow; không uncaught exception: PASS.
- Tám sản phẩm: One Piece, Attack on Titan, Naruto, Your Name, Suzume, Frieren, Fern, Yor: PASS. Không null/undefined, không ISBN sách trong figure, không hardcover Suzume.
- Demo ba viewport/VI-EN: PASS, không gọi Product/Order API Live.
- `check_true_color.mjs`: PASS gallery contain/màu gốc, không ancestor grayscale/opacity/blend tại ba viewport.
- `check_live_catalog.mjs`: PASS23 Product Detail/37 gallery selections, tên/mô tả VI-EN, VND, ảnh, search/category/hover và guest Cart không nhầm sản phẩm.
- `check_checkout_phase13.mjs` trên clone cô lập: PASS Cart/Buy Now COD, Bank/VietQR Sandbox, retry/refresh, Admin đối soát/Reports và VI/EN responsive. Không giao dịch ngân hàng thật.
- TypeScript noEmit, Vite production build: PASS. Không sửa PHP nên PHP lint không áp dụng. Build vẫn có cảnh báo Vite config đã tồn tại, không cản build.

Ảnh trước/sau và bằng chứng nằm trong `frontend/.artifacts/15-*`: `15-before-closed-{1440,900,390}.png`, `15-after-closed-*.png`, `15-open-*.png`, `15-policies-*.png`, `15-details-CAT-*.png`, `15-hover.png`, `15-demo-*.png`. Đây là Chrome thực tế; không tuyên bố pixel-perfect hoặc đo FPS trên thiết bị vật lý.

Không migration, seed, thay ảnh, sửa API/giá/stock. Snapshot schema + SHA256 + số dòng của cả17 bảng chính trước/sau giống nhau (`15-preservation.json`). Không ghi dữ liệu kiểm thử vào database chính. Các trang khác không có thay đổi code trong giai đoạn này; không tuyên bố đã chạy lại mọi chức năng Admin/Reports/Account chỉ từ việc chúng không đổi source.
