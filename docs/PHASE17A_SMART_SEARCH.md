# Giai đoạn 17A — Manga Smart Search

## Audit và kiến trúc

- Catalog xác minh từ API và snapshot MariaDB: **23 active, 8 archived, 37 ảnh, 18 series**; số liệu chỉ dùng báo cáo, không hardcode trong UI.
- Navbar desktop trước đây có icon Search nhưng **chưa có handler**, không có thanh search/animation mở sẵn để tái sử dụng. Mobile16D có shortcut đến Shop. Giữ nguyên icon, kích thước và Navbar; bổ sung dialog search riêng khi người dùng chủ động mở.
- Shop trước đây substring search client-side theo tên VI/EN/SKU/series; đã fold dấu nhưng chưa debounce/fuzzy/ranking/parser.
- Dữ liệu có thật: products.name_vi/name_en/sku/slug/description_vi/description_en/price_vnd/sale_price_vnd/stock_quantity/category_id/series_id/status; categories.slug/name_vi/name_en; manga_series.slug/title. **Không có cột thể loại/chủ đề hoặc số tập có cấu trúc.**
- Số tập Live tái sử dụng `volumeOf` từ Series Explorer: chỉ đọc nhãn Tập/Vol/Volume rõ trong tên VI/EN, từ chối box/range/decimal/mâu thuẫn. Không suy từ SKU hoặc ID. Query hỗ trợ thêm “quyển”.
- **Một engine TypeScript dùng chung** cho Shop và dropdown. Tận dụng `ProductsProvider` đã tải catalog phục vụ Shop/Home; không xây search backend thứ hai, không request toàn bộ catalog lại mỗi ký tự.
- API tái sử dụng: **GET /api/products.php**. PHP/PDO hiện hành chỉ trả active và batch galleries. Không thêm endpoint, SQL, migration hoặc thay Product API. Không nhân đôi ranking bằng PHP.

Luồng: catalog hiện có → normalize/index memoized → parser → điều kiện bắt buộc → ranking → sidebar filters AND → sort/pagination hiện có. Dropdown dùng cùng engine nhưng giới hạn sáu gợi ý; các filter sidebar hiện tại được giữ.

## File triển khai

| File | Thay đổi |
|---|---|
| frontend/src/search/searchEngine.ts | Normalize, alias, parser, index/cache, OSA distance, ranking, basic fallback |
| frontend/src/search/SmartSearchInput.tsx | Input/combobox dùng chung, debounce250ms, dropdown portal, keyboard/touch/status |
| frontend/src/search/GlobalSearch.tsx | Dialog mở bằng icon/shortcut hiện có, focus và đóng |
| frontend/src/search/searchRoute.ts | Query deep link #shop?q=… |
| frontend/src/search/smart-search.css | Chỉ style search mới; không sửa Shop/Navbar CSS |
| frontend/src/shop/shopModel.ts | Thay substring bằng shared ranking; giữ filter/sort/pagination |
| frontend/src/shop/ShopCatalog.tsx | Reuse input, debounce grid và suggestions, URL query; giữ DOM/layout phần còn lại |
| frontend/src/discovery/routes.ts | Nhận diện #shop?q=…; không đổi nghiệp vụ Series/Collections |
| frontend/src/App.tsx | Handler Search, mount dialog, nhận query route, giữ Product origin |

Test: `check_smart_search.mjs`, `check_smart_search_browser.mjs`, `check_smart_search_demo.mjs`, `check_search_baseline.mjs`, `check_search_shopping_regression.mjs`, `check_search_pagination.mjs`, `check_search_accessibility.mjs`, `compare_png.py`. Các test16C gốc được giữ; bản regression17A chỉ thay chờ debounce và tên artifact.

## Normalize, alias và metadata

Unicode NFKD → lowercase → bỏ combining marks của **Latin** → đ thành d → NFC. Giữ ký tự Nhật và dấu dakuten, chữ số, chuẩn hóa punctuation/hyphen thành khoảng trắng, trim/collapse whitespace. Không thay tên hiển thị, slug hoặc dữ liệu gốc.

Alias curated trong `SERIES_ALIASES`, đối chiếu slug/title từ catalog:

- attack-on-titan: aot, attack titan, dai chien titan.
- one-piece: onepiece.

Alias chỉ có tác dụng khi tập dữ liệu hiện tại chứa series tương ứng. “one pice” được giải bằng fuzzy, không cần alias riêng. Không thêm “truyện ninja” hay chủ đề/giới tính/chất liệu suy đoán. Khi Admin thêm series mới, tên/slug bình thường được index tự động sau refetch; alias viết tắt mới cần curated config.

Index dùng tên VI/EN, series title/slug, tên category thực tế, SKU và mô tả có sẵn. Mô tả chỉ substring, giới hạn6000 ký tự index; không suy thêm thông số. Cache WeakMap theo array products và nhãn Demo bản địa hóa, tự mất hiệu lực khi provider refetch/đổi ngôn ngữ trả array mới.

## Fuzzy, parser và ranking

Fuzzy dùng optimal string alignment (Damerau-Levenshtein giới hạn, hỗ trợ đảo hai ký tự liền kề). Token tối thiểu4 ký tự; tối đa48; khoảng cách1 với độ dài4–7, tối đa2 từ8 ký tự. Mọi token phải đạt điều kiện; token ngắn phải match chính xác. Không fuzzy khi phần text còn chữ số/SKU marker; không fuzzy số tập hoặc giá. Tối đa8 token và1000 candidate fuzzy đầu tiên theo catalog order ổn định. Exact/prefix/token vẫn kiểm tra toàn tập đã tải.

Parser:

- Category: manga/truyện/truyện tranh → manga; tiểu thuyết/light novel → novels; figure/mô hình → figures; phụ kiện → accessories. Các slug này đã xác minh, không tạo category/product mới.
- Giá: dưới/under/below là **nhỏ hơn**, trên/over/above là **lớn hơn**; từ…đến/from…to là khoảng đóng. k/nghìn/ngàn/thousand×1000, VND/đ/đồng, dấu phân cách100.000 và100,000; số thập phân có k được quy đổi rõ. Tiền âm, không rõ đơn vị, khoảng đảo hoặc nhiều điều kiện mâu thuẫn → không có kết quả.
- Tập: tập/quyển/vol/volume + số nguyên dương, chuẩn hóa02→2; yêu cầu đúng tập và category manga. Không lấy số ID/SKU làm số tập.
- Còn hàng/in stock → stock_quantity>0. Không đổi giá/tồn kho.

Điều kiện category/price/volume/stock luôn áp dụng **trước** rank. Sidebar tiếp tục AND với query, không bị query ghi đè.

| Match | Điểm |
|---|---:|
| SKU chính xác | 1400 |
| Tên sản phẩm chính xác | 1200 |
| Series chính xác (title/slug) | 1100 |
| Prefix SKU | 1060 |
| Prefix tên/series | 900 |
| Tất cả token | 750 |
| Alias đã xác minh | 650 |
| Mô tả substring | 250 |
| Fuzzy | 150 − tổng edit distance |
| Query chỉ có điều kiện | 1 |

Tập đúng cộng40 sau khi đã lọc bắt buộc. Prefix có ranh giới số, không nhầm3 với30; tên ấn bản đầy đủ được ưu tiên exact trước khi xét phần text đã tách điều kiện. Tie-break productID tăng. Sort mặc định dùng relevance; sort người dùng chọn vẫn ưu tiên price/name/newest và ID phụ ổn định. Không popularity/sales score.

## UX, route và fallback

- Input Shop giữ nguyên vị trí/kích thước/class/placeholder; global Search chỉ mở khi click icon hoặc shortcut. Không tự focus khi trang vừa tải.
- Debounce250ms cho dropdown và grid. Cleanup timer trong effect, an toàn StrictMode. Kết quả query cũ không được render khi query hiện tại chưa settled. Không có request theo từng query nên không phát sinh thứ tự response cũ/mới; AbortController/timeout12s của catalog service hiện hành được giữ.
- Dropdown tối đa6: ảnh contain, tên, series/category, giá API, stock thực tế. React render text, không HTML từ query.
- ArrowUp/Down → aria-activedescendant/option selection; Enter chọn option hoặc mở Shop query; Escape đóng dropdown; click ngoài đóng. Combobox/listbox, aria-expanded/controls, status/loading/retry; không nested button/link.
- Portal bám input (Shop mobile đặt dưới cả hàng Sort/Bộ lọc để hai điều khiển vẫn bấm được), giới hạn viewport và scroll trong vùng riêng; bên trong dialog thì portal vào chính dialog để không bị native top-layer/inert chặn. Theo dõi resize/scroll/visualViewport và cleanup.
- Enter/Xem tất cả: `#shop?q=encodeURIComponent(query)`. Typing replaceState query, không tạo history entry cho từng phím. Back/Forward và refresh đọc lại query. Product Detail vẫn dùng route API hoặc Demo đúng nguồn; Shop filters khác giữ trong state như trước.
- Engine lỗi → basic substring name/SKU/series; unit fault injection xác nhận fallback. Catalog lỗi/timeout → thông báo và retry, không loading vô hạn, không tự đổi sang Demo.
- Không có đề xuất “Bạn muốn tìm…” khi confidence thấp; trả empty trung thực thay vì ép nearest product.

## Demo và giới hạn

Demo dùng đúng products Figma hiện có, nhãn VI/EN, không ID MySQL hay catalog/commerce API Live. Giá Demo là USD: **không so điều kiện giá VND với USD**; có thông báo rõ, không tự quy đổi. Alias AOT không trả sản phẩm Demo không liên quan. Volume Live dựa vào nhãn ấn bản đã có, không tạo metadata mới cho Demo.

Không API AI, embeddings, vector DB, LLM, dịch vụ search trả phí hoặc dependency mới. Không lịch sử tìm kiếm cá nhân, không dùng thông tin tài khoản để rank. Query nằm ở fragment URL của browser, không gửi sang AI/search bên ngoài hay ghi MySQL.

Giới hạn phát triển: kiến trúc phù hợp catalog hiện tại đã tải sẵn. Không tuyên bố search server phân trang quy mô lớn; khi catalog lớn vượt1000 candidate fuzzy, nên thêm endpoint read-only có bounded candidate retrieval thay vì tăng giới hạn vô hạn. API catalog hiện hành chưa phân trang; giai đoạn này không đổi hợp đồng đó hoặc tạo request lặp.

## Kết quả từng query trên catalog thật

Các kết quả lấy từ `17a-engine-tests.json`, không đổi dữ liệu để ép test.

| Query | Số kết quả | Product ID / tên thật |
|---|---:|---|
| One Piece | 2 | 11: One Piece – Tập 1 (tiếng Việt), 12: One Piece – Tập 2 (tiếng Việt) |
| Naruto | 2 | 15: Naruto – Tập 1 (tiếng Việt), 16: Naruto – Tập 2 (tiếng Việt) |
| Attack on Titan | 2 | 9: Đại Chiến Titan – Tập 1 (bản tiếng Anh), 10: Đại Chiến Titan – Tập 2 (bản tiếng Anh) |
| đại chiến titan | 2 | 9: Đại Chiến Titan – Tập 1 (bản tiếng Anh), 10: Đại Chiến Titan – Tập 2 (bản tiếng Anh) |
| dai chien titan | 2 | 9: Đại Chiến Titan – Tập 1 (bản tiếng Anh), 10: Đại Chiến Titan – Tập 2 (bản tiếng Anh) |
| one pice | 2 | 11: One Piece – Tập 1 (tiếng Việt), 12: One Piece – Tập 2 (tiếng Việt) |
| narto | 2 | 15: Naruto – Tập 1 (tiếng Việt), 16: Naruto – Tập 2 (tiếng Việt) |
| attak on titan | 2 | 9: Đại Chiến Titan – Tập 1 (bản tiếng Anh), 10: Đại Chiến Titan – Tập 2 (bản tiếng Anh) |
| aot | 2 | 9: Đại Chiến Titan – Tập 1 (bản tiếng Anh), 10: Đại Chiến Titan – Tập 2 (bản tiếng Anh) |
| onepiece | 2 | 11: One Piece – Tập 1 (tiếng Việt), 12: One Piece – Tập 2 (tiếng Việt) |
| friren | 2 | 26: Frieren – POP UP PARADE, 30: Fern – POP UP PARADE |
| tiểu thuyết | 3 | 23: Your Name. – Tiểu thuyết (tiếng Việt), 24: Đứa Con Của Thời Tiết – Tiểu thuyết (tiếng Việt), 25: Khóa Chặt Cửa Nào Suzume – Tiểu thuyết (tiếng Việt) |
| light novel | 3 | 23: Your Name. – Tiểu thuyết (tiếng Việt), 24: Đứa Con Của Thời Tiết – Tiểu thuyết (tiếng Việt), 25: Khóa Chặt Cửa Nào Suzume – Tiểu thuyết (tiếng Việt) |
| tiểu thuyết Nhật | 3 | 23: Your Name. – Tiểu thuyết (tiếng Việt), 24: Đứa Con Của Thời Tiết – Tiểu thuyết (tiếng Việt), 25: Khóa Chặt Cửa Nào Suzume – Tiểu thuyết (tiếng Việt) |
| manga | 14 | 9: Đại Chiến Titan – Tập 1 (bản tiếng Anh), 10: Đại Chiến Titan – Tập 2 (bản tiếng Anh), 11: One Piece – Tập 1 (tiếng Việt), 12: One Piece – Tập 2 (tiếng Việt), 13: Doraemon truyện ngắn – Tập 1 (tiếng Việt), 14: Doraemon truyện ngắn – Tập 2 (tiếng Việt), 15: Naruto – Tập 1 (tiếng Việt), 16: Naruto – Tập 2 (tiếng Việt), 17: Dragon Ball – Bảy Viên Ngọc Rồng – Tập 1 (tiếng Việt), 18: Dragon Ball – Bảy Viên Ngọc Rồng – Tập 2 (tiếng Việt), 19: Black Clover – Tập 1 (tiếng Việt), 20: Black Clover – Tập 2 (tiếng Việt), 21: Kaguya-sama: Cuộc Chiến Tỏ Tình – Tập 1 (VI), 22: Kaguya-sama: Cuộc Chiến Tỏ Tình – Tập 2 (VI) |
| figure | 6 | 26: Frieren – POP UP PARADE, 27: Marin Kitagawa – POP UP PARADE, 28: Maomao – Nendoroid 2288, 29: Yor Forger – POP UP PARADE, 30: Fern – POP UP PARADE, 31: Hitori Gotoh – POP UP PARADE |
| manga dưới 50k | 12 | 11: One Piece – Tập 1 (tiếng Việt), 12: One Piece – Tập 2 (tiếng Việt), 13: Doraemon truyện ngắn – Tập 1 (tiếng Việt), 14: Doraemon truyện ngắn – Tập 2 (tiếng Việt), 15: Naruto – Tập 1 (tiếng Việt), 16: Naruto – Tập 2 (tiếng Việt), 17: Dragon Ball – Bảy Viên Ngọc Rồng – Tập 1 (tiếng Việt), 18: Dragon Ball – Bảy Viên Ngọc Rồng – Tập 2 (tiếng Việt), 19: Black Clover – Tập 1 (tiếng Việt), 20: Black Clover – Tập 2 (tiếng Việt), 21: Kaguya-sama: Cuộc Chiến Tỏ Tình – Tập 1 (VI), 22: Kaguya-sama: Cuộc Chiến Tỏ Tình – Tập 2 (VI) |
| figure dưới 900k | 4 | 26: Frieren – POP UP PARADE, 27: Marin Kitagawa – POP UP PARADE, 29: Yor Forger – POP UP PARADE, 30: Fern – POP UP PARADE |
| figure dưới 900 nghìn | 4 | 26: Frieren – POP UP PARADE, 27: Marin Kitagawa – POP UP PARADE, 29: Yor Forger – POP UP PARADE, 30: Fern – POP UP PARADE |
| truyện trên 100000 | 2 | 9: Đại Chiến Titan – Tập 1 (bản tiếng Anh), 10: Đại Chiến Titan – Tập 2 (bản tiếng Anh) |
| manga từ 20k đến 50k | 12 | 11: One Piece – Tập 1 (tiếng Việt), 12: One Piece – Tập 2 (tiếng Việt), 13: Doraemon truyện ngắn – Tập 1 (tiếng Việt), 14: Doraemon truyện ngắn – Tập 2 (tiếng Việt), 15: Naruto – Tập 1 (tiếng Việt), 16: Naruto – Tập 2 (tiếng Việt), 17: Dragon Ball – Bảy Viên Ngọc Rồng – Tập 1 (tiếng Việt), 18: Dragon Ball – Bảy Viên Ngọc Rồng – Tập 2 (tiếng Việt), 19: Black Clover – Tập 1 (tiếng Việt), 20: Black Clover – Tập 2 (tiếng Việt), 21: Kaguya-sama: Cuộc Chiến Tỏ Tình – Tập 1 (VI), 22: Kaguya-sama: Cuộc Chiến Tỏ Tình – Tập 2 (VI) |
| truyện dưới 100.000đ | 12 | 11: One Piece – Tập 1 (tiếng Việt), 12: One Piece – Tập 2 (tiếng Việt), 13: Doraemon truyện ngắn – Tập 1 (tiếng Việt), 14: Doraemon truyện ngắn – Tập 2 (tiếng Việt), 15: Naruto – Tập 1 (tiếng Việt), 16: Naruto – Tập 2 (tiếng Việt), 17: Dragon Ball – Bảy Viên Ngọc Rồng – Tập 1 (tiếng Việt), 18: Dragon Ball – Bảy Viên Ngọc Rồng – Tập 2 (tiếng Việt), 19: Black Clover – Tập 1 (tiếng Việt), 20: Black Clover – Tập 2 (tiếng Việt), 21: Kaguya-sama: Cuộc Chiến Tỏ Tình – Tập 1 (VI), 22: Kaguya-sama: Cuộc Chiến Tỏ Tình – Tập 2 (VI) |
| naruto tập 2 | 1 | 16: Naruto – Tập 2 (tiếng Việt) |
| onepiece vol 1 | 1 | 11: One Piece – Tập 1 (tiếng Việt) |
| Attack on Titan volume 2 | 1 | 10: Đại Chiến Titan – Tập 2 (bản tiếng Anh) |
| doraemon quyển 1 | 1 | 13: Doraemon truyện ngắn – Tập 1 (tiếng Việt) |
| manga còn hàng | 14 | 9: Đại Chiến Titan – Tập 1 (bản tiếng Anh), 10: Đại Chiến Titan – Tập 2 (bản tiếng Anh), 11: One Piece – Tập 1 (tiếng Việt), 12: One Piece – Tập 2 (tiếng Việt), 13: Doraemon truyện ngắn – Tập 1 (tiếng Việt), 14: Doraemon truyện ngắn – Tập 2 (tiếng Việt), 15: Naruto – Tập 1 (tiếng Việt), 16: Naruto – Tập 2 (tiếng Việt), 17: Dragon Ball – Bảy Viên Ngọc Rồng – Tập 1 (tiếng Việt), 18: Dragon Ball – Bảy Viên Ngọc Rồng – Tập 2 (tiếng Việt), 19: Black Clover – Tập 1 (tiếng Việt), 20: Black Clover – Tập 2 (tiếng Việt), 21: Kaguya-sama: Cuộc Chiến Tỏ Tình – Tập 1 (VI), 22: Kaguya-sama: Cuộc Chiến Tỏ Tình – Tập 2 (VI) |
| CAT-MG-NAR-VI-01 | 1 | 15: Naruto – Tập 1 (tiếng Việt) |

Test âm tính: empty, punctuation, query>160, Unicode, SKU không tồn tại/sai suffix, tập999/âm/thập phân/range/mâu thuẫn, giá âm/đơn vị không hợp lệ/khoảng đảo/mâu thuẫn, category mâu thuẫn, fuzzy confidence thấp, thiếu target alias. Phụ kiện hiện không có active product →0. Synthetic in-memory kiểm tra hết hàng, tập1≠10 và exact trên fuzzy; không ghi database.

Benchmark trên catalog API23 sản phẩm:1000 truy vấn, trung bình khoảng0,1ms/query trong Node; chỉ minh họa máy hiện tại, không phải benchmark server hay cam kết độ trễ mọi thiết bị.

## Screenshot và kiểm thử

- Baseline `17a-before-{home|shop}-{width}.png`, after `17a-after-…`, sáu width320/360/390/430/900/1440.
- [Navbar desktop](../frontend/.artifacts/17a-navbar-search-desktop.png)
- [Fuzzy suggestions](../frontend/.artifacts/17a-fuzzy-suggestions-desktop.png)
- [Query giá](../frontend/.artifacts/17a-price-query.png)
- [Dropdown mobile](../frontend/.artifacts/17a-shop-dropdown-vi-390.png)
- [Navbar search mobile](../frontend/.artifacts/17a-navbar-search-mobile.png)
- [Empty](../frontend/.artifacts/17a-empty-search.png)
- [API timeout/retry](../frontend/.artifacts/17a-search-api-error.png)

Chrome GUI Live đã kiểm tra native mouse/keyboard/touch, sáu viewport VI/EN, Arrow/Enter/Escape/outside, query/product route/Back/refresh, filter AND price/volume, nhập nhanh/xóa, không có request mỗi phím, timeout giả lập và retry.

900/1440 Home/Shop đều byte-identical khi search đóng. 10/12 ảnh Home/Shop toàn bộ baseline giống byte ở lượt cuối; hai ngoại lệ chỉ thuộc scrollbar Chrome tại320px: Home x316–319,y0–86 (348pixel), Shop x316–319,y0–144 (580pixel). Lượt chụp trước từng có chênh RGB≤5 ở tile grain SVG Shop430, đã mở đối chiếu và đo; lượt cuối Shop430 khớp hoàn toàn. `17a-visual-preservation.json` và `17a-grain-comparison.json` ghi bằng chứng; không tuyên bố pixel-perfect.

## Hoàn tất

- **Unit/catalog: PASS**. 28 truy vấn có kết quả kiểm tra với API thật; 16 truy vấn âm tính, toàn bộ23 SKU và tên VI/EN đều chọn đúng sản phẩm đầu tiên; số tập1≠10, prefix3≠30, giá/stock/filters, missing alias, exact trên fuzzy, fault-injected basic fallback, Unicode Việt/Nhật. Benchmark cuối khoảng0,12ms/query cho1000 truy vấn trên23 sản phẩm, cache ấm.
- **Chrome Live: PASS**. Sáu viewport320/360/390/430/900/1440 ×VI/EN; dropdown/native mouse/touch/keyboard, Enter→Shop hoặc Product, Back/refresh, alias/fuzzy/giá/số tập, filterAND, nhập nhanh/xóa và không request theo query, timeout giả lập/retry.
- **Accessibility: PASS**. Escape đóng popup trước rồi dialog, focus trở lại nút mở; ArrowUp wrap và Enter; viewport390×320 popup nằm trong khung và cuộn được. Focus button đen có outline trắng; không animation mới gây reduced-motion regression.
- **Demo: PASS**. Sáu viewport ×VI/EN; fuzzy/normalization với products Demo, link #product/demo/ID đúng; không gọi Live catalog/commerce API; alias AOT không có target →empty; query VND không so với USD. Hồi quy guest Cart/Wishlist/BuyNow/filter drawer/sort đạt trong Demo.
- **Shop regression: PASS**. Drawer touch/mở lại/Escape/focus, search VI có/không dấu, category/series/price/stock/sort/reset/count, ảnh/tên→Detail→Back, Wishlist, guestCart badge, BuyNow đúngID không tự đổi Cart. Test cũ được chờ theo debounce mới; không bỏ assertion.
- **Pagination: PASS**. 40 records synthetic chỉ intercept trong browser, trang24/16 và40ID duy nhất; query đưa về trang1 đúng kết quả. Không seed database.
- **Discovery: PASS**. Hero/autoplay/pause/reduced motion, Series/volume search/back, Collections filters, Cart/Wishlist, gallery color, VI/EN tại1440/900/390. Series/Collections search riêng không bị thay thế.
- **CheckoutPhase13 và AccountPhase14: PASS trên `manga_store_orders_test_20261120`**. Auth, ba bước, Cart/BuyNow COD/Sandbox, retry/refresh/idempotency, cancel/restock, Admin đối soát và Reports; profile/stats/order filters/ownership/Wishlist/logout/empty states. Helper tự cleanup fixture; không dùng catalog/database chính cho phép thử ghi.
- **TypeScript PASS, Vite production build PASS, git diff --check PASS**. Build cuối CSS125,24kB/gzip24,15; JS541,79kB/gzip160,42 (so baseline16D gzip155,13: tăng khoảng5,3kB JS). Không thêm dependency. Cảnh báo cấu hình Vite có sẵn, không sửa ngoài phạm vi. Không sửa PHP nên PHP lint không áp dụng.
- **Preservation: PASS**. So snapshot17A, chỉ bốn source file có sẵn đổi: App.tsx, ShopCatalog.tsx, shopModel.ts, discovery/routes.ts; thêm năm file search. Global CSS, Shop CSS, fonts/assets/ProductCard, Checkout/Account/Admin/Reports source và toàn bộ backend/API giữ nguyên hash. Các thay đổi16C/16D đã có trước vẫn được bảo toàn, không tính là thay đổi17A.
- **Database chính: 17/17 bảng giữ nguyên schema/count/hash dữ liệu trước–sau toàn bộ test.** Không migration, seed, đổi giá/stock/ảnh; không query history trong MySQL.
- Env đã khôi phục Live `/api`, không còn proxy test. Không dùng API AI hoặc dịch vụ search bên ngoài.

Artifacts kết quả: `17a-engine-tests.json`, `17a-browser-tests.json`, `17a-accessibility.json`, `17a-demo-tests.json`, `17a-regression-live-actions.json`, `17a-regression-demo-actions.json`, `17a-regression-pagination.json`, `discovery-browser.json`, `13-checkout-browser.json`, `14-account-browser.json`, `17a-source-preservation.json`, `17a-db-{before,after}.json`.

Không tuyên bố pixel-perfect hoặc kiểm thử điện thoại vật lý/screen reader thực tế; Chrome headless dùng CDP native mouse/touch/keyboard. Không benchmark mạng/server search vì không thêm search endpoint. Không kích hoạt chuyển tiền thật; Sandbox và các nghiệp vụ thanh toán giữ nguyên.
