# Giai đoạn 16D — Mobile responsive & UX

## Phạm vi

Tối ưu mobile theo từng trang, giữ Shop 16C. CSS mới giới hạn `max-width: 600px`; menu mobile theo breakpoint gốc `760px`. Không thay font, asset, dữ liệu, thuật toán mua hàng hoặc API. Barlow Condensed và Inter/biến CSS hiện có được tái sử dụng.

## Audit và quyết định

| Trang/trạng thái | Vấn đề thực tế / kết quả audit | Ưu tiên | Giải pháp và file | Rủi ro desktop |
|---|---|---|---|---|
| Home Hero | Hero 760px và artwork 460px quá cao; mô tả nhỏ | Vừa | Hero 640px, artwork 330px, scale chữ trong mobile-discovery.css | Scoped ≤600 |
| Featured / editorial Home | Card và khoảng cách quá cao trên điện thoại | Vừa | Giảm padding/chiều cao, giữ đủ section/artwork/mascot | Scoped ≤600 |
| New Arrivals | Card một cột, action chật | Cao | Hai cột, vùng artwork contain và hai CTA 48px riêng, mobile-cards.css | Opt-in, loại Shop |
| Series Explorer | Hero 740px, điều hướng/indicator nhỏ; copy dài | Cao | Hero 640px, CTA một cột; controls hai hàng, target44px | Không đổi slider logic |
| Series Detail | Volume card/filters lớn, nút nhỏ | Vừa | Grid hai cột; labels/price wrap; input16px, controls44px | Scoped theo trang |
| Collections | Nhóm/card quá thưa; filter và thao tác nhỏ | Vừa | Giảm padding nhóm, grid compact; ảnh contain, CTA48px | Không đổi group/filter logic |
| Product / Figure Detail | Title65px, gallery cao; quantity nhỏ | Cao | Title36–48px; gallery300–420px; thumbnail64×80; quantity44px | mobile-shopping.css |
| Related Products | Card một cột và action chật | Vừa | Tái sử dụng opt-in card mobile, không thêm cặp nút | Không đổi desktop hover |
| Cart | Tên/quantity/tổng dòng dễ chèn nhau; thao tác nhỏ | Cao | Grid item gọn; quantity và tổng ở hàng hai; tổng wrap; ảnh70×100 | Scoped cart-page |
| Wishlist | Card/toolbar lớn, vùng chạm nhỏ | Vừa | Grid hai cột, toolbar gọn, thao tác44/48px | Không sửa API |
| Checkout Information | Input14px có thể kích hoạt zoom trên điện thoại | Vừa | Input16px, min48px | Không đổi ba bước |
| Payment / Success | Bố cục hiện có đã responsive | Giữ | Audit, không đổi layout/phương thức thanh toán | Không đổi |
| Guest Login | Label8px/input10px; khoảng trống lớn | Cao | Label12px, input16px/50px, giảm padding | mobile-account.css |
| Account / History / Order Detail | Đã có card/filter vùng cuộn và wrap hợp lý | Giữ | Kiểm thử dữ liệu, filter, navigation; không redesign | Không đổi |
| About / Contact / Maps | Đã wrap email/địa chỉ, iframe responsive | Giữ | Kiểm tra, giữ nguyên địa chỉ và tọa độ | Không đổi |
| Navbar | Account/Wishlist/Search ẩn trên mobile, menu chưa có lối vào tương ứng | Cao | Thêm nhóm ba tiện ích trong menu mở; giữ năm menu chính, Escape/Tab/focus | Desktop ẩn nhóm mới |
| Footer | Link và newsletter nhỏ | Vừa | Link44px, input16px/48px; loại trừ toàn bộ Shop | ≤600, không đổi desktop |
| Admin Dashboard/Orders/Inventory/Customers/Reports | Bảng đã có vùng cuộn; input và button nhỏ | Vừa | Bảng cuộn riêng, input16px/button44px | Không đổi nghiệp vụ |
| Admin Product List/Create/Edit/Series Dialog | Vùng chạm nhỏ; React StrictMode chạy effect hai lần làm mất tham chiếu opener; focus trả về khi dialog còn chặn tương tác | Cao | Scoped sizing; giữ opener trong ref; chỉ trả focus qua requestAnimationFrame sau khi dialog rời DOM | Không đổi visual desktop |

## File triển khai

- `frontend/src/App.tsx`: import CSS, hook class Home/Wishlist; tiện ích/focus mobile menu.
- `frontend/src/admin/AdminSeriesDialog.tsx`: trả focus sau khi dialog được gỡ.
- `frontend/src/responsive/mobile-cards.css`: card opt-in Home/Series/Collections/Wishlist/Related.
- `frontend/src/responsive/mobile-discovery.css`: Home và Series/Collections.
- `frontend/src/responsive/mobile-shopping.css`: Product, Cart, Wishlist.
- `frontend/src/responsive/mobile-account.css`: Checkout input và guest login.
- `frontend/src/responsive/mobile-information.css`: mobile menu/Footer/Admin.
- Test harness `backend/tests/check_mobile_{audit,interactions,menu_admin,demo}.mjs`.

Các file Shop/i18n/README thay đổi từ 16C đã có trước 16D; không tính là thay đổi 16D. Không cài dependency.

## Cách bảo toàn thao tác

Giữ ProductCard gốc và callback. Mobile card có vùng ảnh riêng và vùng CTA96px nằm cuối frame, hai nút48px luôn thấy, không overlay lên artwork. Ảnh `contain`, Wishlist44px, tên tối đa ba dòng nhưng link/accessibility vẫn giữ tên đầy đủ. Không dùng nested button mới.

Không thay Cart/Buy Now/Checkout/Auth/Order cancellation. Navbar mở có vùng cuộn tối đa viewport, Escape trả focus, Tab/Shift+Tab luân chuyển trong menu và trigger. Ba tiện ích dùng route/tìm kiếm hiện có, không thêm menu chính thứ sáu.

## Bằng chứng kiểm thử

Chrome headless qua CDP; viewport cao1000px, deviceScaleFactor1; reduced-motion để ảnh so sánh nhất quán. Có native touch và keyboard tests; không phải kiểm thử thiết bị vật lý.

- Ma trận Live: Home, Series, volumes, Collections, Product manga/figure, Cart, Wishlist, Login, Checkout Information/Payment/Success, Account, History, Order Detail, About/Maps, chín màn Admin.
- Kích thước: 320,360,375,390,430,480,768,900,1440; VI và EN.
- Kết quả chi tiết: `frontend/.artifacts/16d-after-all.json`.
- Functional discovery: `discovery-browser.json` (slider autoplay/pause/reduced motion, tìm series/tập, sort, figure filters, guest Cart/Wishlist).
- Accordion: `15-after.json` (tám loại sản phẩm, keyboard/touch/VI-EN, quantity giữ nguyên).
- Gallery: `true-color-browser.json` (contain, màu gốc).
- Checkout/Account: `16d-shopping-account-interactions.json` (ba bước, ba payment choices, giữ form khi Back, own order pending Sandbox, Cart quantity khôi phục, Buy Now một item và Cart không đổi).
- Menu/Admin: `16d-menu-admin-interactions.json`.

### Ảnh trước/sau

Các ảnh nằm trong `frontend/.artifacts/`, không chứa session token/password. Ví dụ:

| Khu vực | Trước390 | Sau390 | Đối chiếu desktop |
|---|---|---|---|
| Home | [trước](../frontend/.artifacts/16d-before-home-vi-390.png) | [sau](../frontend/.artifacts/16d-after-home-vi-390.png) | [1440](../frontend/.artifacts/16d-after-home-vi-1440.png) |
| Series | [trước](../frontend/.artifacts/16d-before-series-vi-390.png) | [sau](../frontend/.artifacts/16d-after-series-vi-390.png) | [900](../frontend/.artifacts/16d-after-series-vi-900.png) |
| Product | [trước](../frontend/.artifacts/16d-before-product-vi-390.png) | [sau](../frontend/.artifacts/16d-after-product-vi-390.png) | [1440](../frontend/.artifacts/16d-after-product-vi-1440.png) |
| Cart | [trước](../frontend/.artifacts/16d-before-cart-vi-390.png) | [sau](../frontend/.artifacts/16d-after-cart-vi-390.png) | [900](../frontend/.artifacts/16d-after-cart-vi-900.png) |
| Account | [trước](../frontend/.artifacts/16d-before-account-vi-390.png) | [sau](../frontend/.artifacts/16d-after-account-vi-390.png) | [1440](../frontend/.artifacts/16d-after-account-vi-1440.png) |
| Admin Create | [trước](../frontend/.artifacts/16d-before-create-vi-390.png) | [sau](../frontend/.artifacts/16d-after-create-vi-390.png) | [900](../frontend/.artifacts/16d-after-create-vi-900.png) |

Ảnh mỗi trang có cùng quy ước tên cho900/1440. Ngoại lệ so sánh cần phân biệt: Wishlist có vị trí thumb của input range disabled thay đổi theo thời điểm mount/dữ liệu tải, chỉ949pixel trong vùng control; Google iframe tải nội dung động. Không quy những khác biệt đó thành thay đổi CSS desktop và không tuyên bố mọi PNG byte-identical.

## Dữ liệu và giới hạn

Fixture customer/admin, đơn và Cart phục vụ test chỉ nằm trên `manga_store_orders_test_20261120`. Đồng bộ source backend vào bản triển khai test để tránh baseline dùng API Admin cũ, không sửa backend chính. Không giao dịch ngân hàng thật; Sandbox vẫn pending cho đến đúng Admin workflow.

Không thay caching, thuật toán tải ảnh/dữ liệu, font, asset hoặc bundle dependency. Không đo FPS/thiết bị vật lý; không tuyên bố pixel-perfect. Các placeholder chức năng có sẵn ngoài phạm vi (ví dụ newsletter) không được biến thành backend mới.

## Kết quả cuối

- Live: **26 màn × 9 viewport × 2 ngôn ngữ = 468 mẫu**, không document overflow/console error; 312 mẫu mobile không có mục tiêu thao tác quan trọng nhỏ hơn ngưỡng test43px.
- 900/1440: **52 cặp ảnh, 48 cặp byte-identical**. Hai ảnh Wishlist chỉ khác thumb949pixel; hai ảnh Maps khác nội dung bên trong iframe. `16d-final-desktop-comparison.json`, `16d-wishlist-comparison.json`, `16d-maps-comparison.json` ghi rõ ngoại lệ.
- Demo: **12 màn × 9 viewport × 2 ngôn ngữ = 216 mẫu**, không overflow/console error; không gọi Product/Cart/Wishlist/Order Live API. Demo Series vẫn giữ nội dung Figma demo riêng; không giả danh catalog MySQL. Demo checkout hoàn tất chỉ có nhãn minh họa, không mã đơn/QR chuyển tiền thật.
- Demo Account/Orders: thêm **36 mẫu** đạt, tổng Demo252 mẫu. Hiển thị trạng thái lịch sử chưa kết nối thay vì tạo đơn/số liệu giả; không gọi Order API Live.
- Menu/Admin interaction: PASS sau sửa focus StrictMode; native touch320px và viewport390×480, Tab/Shift+Tab/Escape, Search focus, điều hướng Account/Wishlist, modal validation, bản nháp còn nguyên, không gửi create API.
- TypeScript và production build đã đạt; sẽ chạy lại sau khôi phục Live config. PHP lint không áp dụng vì không sửa PHP.
- Source preservation: chỉ hai source file có sẵn thay đổi so với snapshot16D (`App.tsx`, `AdminSeriesDialog.tsx`); thêm năm file CSS scoped. Source Shop16C và toàn bộ backend/API chính giữ nguyên hash.
- Snapshot database chính sau ma trận: **17/17 bảng giữ nguyên schema, count và hash dữ liệu** so với baseline. Không migration, seed hoặc dữ liệu test vào database chính.

### Hồi quy bổ sung

- Shop16C visual và actions: PASS tại320/360/375/390/430/480/900/1440, VI/EN, ảnh contain, hai nút44px, computed desktop styles khớp baseline. Drawer reopen/close/Escape/focus, search có/không dấu, category/series/price/stock/sort/reset/count, ảnh/tên→Detail→Back, Wishlist, guest Cart badge, Buy Now đúngID và Cart không đổi.
- Pagination: PASS với40 bản ghi synthetic chỉ intercept trong Chrome, trang24/16, không trùng ID, filter đưa về trang hợp lệ; không tạo dữ liệu catalog.
- CheckoutPhase13: PASS sau khi dọn fixture UI trước khi đo Reports. Cart/BuyNow COD, bank/VietQR Sandbox, ba bước, form, backend quote, create/cancel, loss-response refresh/idempotency, snapshot, Cart giữ nguyên khi Buy Now; giải mã SVG Sandbox độc lập, copy/download; Admin đối soát và Reports ghi riêng bank/COD.
- Lần chạy đầu của regression Reports giả định database test không có đơn fixture UI, nên assertion tổng250.000 không đúng. Đã dọn các fixture16D rồi chạy lại đạt, không sửa Reports hoặc backend để làm test qua.
- Fixture16D đã xóa trên clone bằng helper có guardDB_NAME. File metadata/cookie tạm và pointer đã xóa. Test Checkout/Account tự cleanup fixture riêng.

### Hoàn tất

- AccountPhase14: **PASS**. Tên/email/initials thật; tổng đơn/theo trạng thái/Wishlist; pagination, refresh/back-forward, giữ filter; Order Detail Sandbox pending, hủy đơn hoàn kho một lần; Wishlist/Cart; logout xóa dữ liệu riêng tư; tài khoản khác có empty state và không xem được đơn không thuộc mình; native keyboard/touch, reduced-motion, VI/EN,1440/900/390.
- Shop bảo toàn: hero/toolbar/sidebar screenshot900/1440 byte-identical với baseline16C; computed layout/card/font/grid/padding/gap ở hai viewport khớp chính xác. Ảnh vùng cards khác **số tồn kho của fixture test**: ví dụ baseline900 là13/14, sau cleanup là15/15; đã mở đối chiếu trực quan, hình ảnh/typography/nút/bố cục không đổi. Không sửa dữ liệu để ép screenshot giống nhau. `16d-shop-comparison.json` ghi hai ảnh card không byte-identical.
- Build cuối với cấu hình Live đã khôi phục: **TypeScript PASS; Vite production build PASS; git diff --check PASS**. CSS122,92kB/gzip23,84; JS528,59kB/gzip155,13. Có cảnh báo Vite config đã tồn tại và chunk>500kB; không thêm dependency/code-splitting ngoài phạm vi.
- Không sửa PHP: PHP lint không áp dụng. Source backend/API giữ nguyên hash.
- Kiểm tra database chính sau toàn bộ test: **17/17 bảng schema/count/data hash giống baseline**. Không có testwrite vào database chính, không migration/seed.
- Env frontend đã trả về `VITE_USE_PRODUCTS_API=true`, `/api`; không còn proxy test trong cấu hình làm việc.
- Không đổi Shop16C source hoặc desktop layout. Navbar đóng/desktop và Footer desktop giữ nguyên; menu mobile mở có ba lối tắt cần thiết, năm menu chính giữ nguyên.

## Cách chạy lại và lưu ý

`check_mobile_audit.mjs --setup --before` chỉ được dùng khi dev proxy trỏ Orders clone; helper setup có kiểm tra đích và DB guard. Sau đó chạy audit theo `--group=discovery|shopping|account|information|admin` hoặc toàn bộ. ChromeCDP dùng chung cổng9229, chạy tuần tự. Tests Demo cần `VITE_USE_PRODUCTS_API=false`; phục hồi env khi kết thúc. Bộ test ghi đơn phải dùng đúng Orders clone; các helper sẽ từ chối database khác.

Không tuyên bố mọi ảnh pixel-perfect: iframe Maps động, thumb Wishlist phụ thuộc thời điểm mount, và baselineShop có stock fixture khác như đã ghi. Không kiểm thử điện thoại vật lý, screen reader thực tế hoặc benchmark FPS. Một số ảnh thư viện ProductImage hiện vẫn tải eager theo source cũ; không đổi thuật toán/caching khi chưa có lỗi thực tế. Admin trong Demo vẫn dùng API quản trị và quyền thật như kiến trúc hiện có; ma trận chín màn Admin được chạy với clone Live, không giả lập dữ liệu quản trị.
