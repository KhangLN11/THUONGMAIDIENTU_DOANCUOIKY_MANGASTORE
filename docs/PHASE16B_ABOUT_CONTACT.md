# Giai đoạn 16B — About & Contact

## Thay đổi

Giữ route `#about`, Hero “KHÔNG CHỈ LÀ CỬA HÀNG. / MỘT CÁNH CỔNG.”, artwork Naruto/One Piece cục bộ, intro, typography Barlow Condensed/Inter, CTA cuối trang, component/button style và Footer chung.

Thứ tự nội dung: Hero → Câu chuyện → Giá trị dành cho độc giả → Thế giới sản phẩm → Liên hệ → Google Maps → CTA cuối trang → Footer.

- Câu chuyện VI giữ đủ năm đoạn do chủ dự án cung cấp, chia thành hai cột editorial “Từ những trang truyện đầu tiên” và “Một thế giới được mở ra”; mobile xếp dọc. EN dịch theo ý nghĩa và nhịp đọc tự nhiên, nằm cùng hệ thống i18n (`about16b.story0` đến `story4`).
- Ba giá trị: Khám phá / Theo dõi trọn bộ / Thông tin rõ ràng. Không khẳng định có đủ toàn bộ tập hoặc bảo đảm chính hãng tuyệt đối.
- Giữ ba nhóm sản phẩm và CTA tới `#series`, `#shop`, `#collections`. Không lấy số lượng giả hoặc đổi catalog.
- Contact có liên kết semantic, khu vực bấm đủ lớn, focus-visible, hover nhẹ và reduced motion. Email có điểm ngắt dòng tại @ ở màn hình hẹp. Không có form liên hệ, Google Form/Sheet, giờ mở cửa hay địa chỉ doanh nghiệp tự tạo.

## Liên hệ và bản đồ

Nguồn duy nhất cho dữ liệu công khai được chủ dự án duyệt: `frontend/src/pages/contactInformation.ts`:

- Email: mangauniverse05@gmail.com; `mailto:mangauniverse05@gmail.com`.
- Điện thoại hiển thị: 0369 210 172; `tel:+84369210172`.
- Facebook: https://www.facebook.com/profile.php?id=61596943022089. Mở tab mới với `noopener noreferrer`; gọi là Facebook Manga Universe, không gắn nhãn fanpage.
- Tọa độ nguyên vẹn: **9.1859680957964, 105.16684055328**.

Iframe dùng `https://www.google.com/maps?q=<tọa độ URL-encoded>&z=16&output=embed`, có title VI/EN, lazy loading, kích thước cố định responsive để hạn chế layout shift. Google chuyển đến embed chính thức trên cùng domain. Không API key hoặc Maps JavaScript SDK.

Liên kết dự phòng luôn hiển thị: `https://www.google.com/maps/search/?api=1&query=9.1859680957964%2C105.16684055328`. Quy ước query tọa độ đối chiếu [tài liệu Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started#search).

Nhãn “Vị trí liên hệ / Địa điểm trên bản đồ” kèm giải thích đây là tọa độ được cung cấp, không phải xác nhận địa chỉ cửa hàng. Không đổi tọa độ thành trung tâm thành phố hoặc cơ sở kinh doanh gần đó.

Nút Liên hệ có sẵn ở Footer nay dùng `#about/contact`. Hash route được nối vào cơ chế hiện hành; AboutContact cuộn đúng section với scroll margin cho Header. Refresh, Back/Forward, đổi VI/EN và click Contact lần nữa trên cùng route được hỗ trợ. Không thêm menu Navbar, không sửa style/layout/Footer content khác.

## File

Sửa:
- `frontend/src/pages/AboutPage.tsx`: nội dung và composition của các section hiện có.
- `frontend/src/pages/about.css`: chỉ bổ sung selector scoped About cho story/contact/maps; giữ CSS Hero cũ.
- `frontend/src/i18n.tsx`: thêm about16b VI/EN; English đặt sau spread fallback hiện có.
- `frontend/src/discovery/routes.ts`: nhận diện đúng `#about/contact` là About.
- `frontend/src/App.tsx`: duy nhất handler của nút CONTACT trong Footer.

Thêm:
- `frontend/src/pages/AboutContact.tsx`.
- `frontend/src/pages/contactInformation.ts`.
- `backend/tests/check_about_contact_before.mjs`, `check_about_contact.mjs`: công cụ Chrome, không thay PHP/API.
- Tài liệu này và liên kết README.

## Kiểm thử và bằng chứng

Ảnh baseline About ba viewport, Home, markup Navbar/Footer và computed Hero lưu trước sửa. Chrome sau sửa đối chiếu Hero VI tại 1440/900/390: cùng markup, font, weight, size và chiều cao; Home markup/Navbar/Footer giống baseline. Không tuyên bố pixel-perfect toàn trang có animation.

Ảnh nằm trong `frontend/.artifacts/16b-*`:
- `16b-before-about-{1440,900,390}.png`, `16b-before-home.png`.
- `16b-live-about-{vi,en}-{1440,900,390}.png`.
- `16b-live-contact-{vi,en}-{1440,900,390}.png`.
- `16b-live-map-{vi,en}-{1440,900,390}.png`, `16b-live-map-loaded.png`.
- `16b-google-maps-external.png`, `16b-focus.png`, `16b-hover.png`.

Maps được kiểm tra trong Chrome thực tế: iframe HTTP200 và screenshot có ghim; URL mở Google Maps hiển thị điểm 9°11′09.5″N 105°10′00.6″E. Google chuẩn hóa hiển thị tọa độ thành 9.1859681,105.1668406; cấu hình/liên kết gốc vẫn giữ toàn bộ chữ số chủ dự án cung cấp. Bản đồ phụ thuộc kết nối Google; liên kết dự phòng luôn tồn tại.

mailto/tel được kiểm tra chính xác scheme và giá trị trong trình duyệt; không gửi email hoặc thực hiện cuộc gọi. Không gửi tin nhắn Facebook. Trình duyệt/thiết bị người dùng cần có ứng dụng xử lý mailto/tel để mở ứng dụng tương ứng.

Kết quả cụ thể và giới hạn hồi quy ghi trong `16b-tests.json`, `16b-live-browser.json`, `16b-demo-browser.json`, `16b-preservation.json` sau khi hoàn tất kiểm thử.

## Bảo toàn

Không migration, seed hoặc API mới. Không thay backend, schema/catalog, ảnh, giá hay tồn kho. So sánh schema/số dòng/SHA256 cả17 bảng chính và hash source các vùng được bảo vệ trước/sau. Các test ghi giao dịch hồi quy chỉ chạy trên database clone có sẵn, không database chính.


### Kết quả cuối cùng

- Chrome Live và Demo: PASS VI/EN ở1440/900/390, Hero giống baseline, story đủ5 đoạn, không khóa dịch thô, Contact đúng3 liên kết, không overflow, iframe lazy/title/responsive, CTA đúng3 đích, focus/hover không che chữ và reduced motion.
- Home/Navbar/Footer markup sau sửa giống baseline; riêng Footer CONTACT có handler mới nhưng không đổi DOM/layout. Không so sánh pixel-diff của Home đang chạy animation.
- Footer Contact từ Home, click lại trên cùng route, refresh, Back/Forward và chuyển VI/EN: PASS.
- Maps iframe HTTP200; Chrome mở Google Maps thực tế đúng tọa độ. Facebook mở tab mới đến `https://www.facebook.com/people/Manga-Universe/61596943022089/`, title “Manga Universe | Facebook”; đây là URL chuẩn hóa của profile đã cung cấp.
- Checkout Phase13 trên database test cô lập: PASS Cart/Buy Now COD, bank/VietQR Sandbox, copy/download/QR decode, retry/refresh, Admin đối soát và Reports, VI/EN responsive. Không chuyển tiền thật.
- TypeScript noEmit, production build Live và Demo, git diff --check: PASS. Không PHP thay đổi nên lint PHP không áp dụng. Vite có cảnh báo cấu hình có sẵn và bundle Live trên500kB; không đổi cấu hình hoặc code splitting ngoài phạm vi About.
- Snapshot sau toàn bộ test: schema/số dòng/SHA256 của cả17 bảng database chính giữ nguyên. Các source ngoài5 file hiện hữu được phép sửa giữ nguyên hash. Không thêm dependency, migration, form/backend, asset sản phẩm hay dữ liệu kiểm thử vào database chính.
- `.env.local` được khôi phục Live API mode, không còn proxy test.

Giới hạn: mailto/tel mở ứng dụng theo cấu hình thiết bị, không kiểm thử gửi email/cuộc gọi thật. Maps/Facebook phụ thuộc dịch vụ bên ngoài; không xác minh quyền sở hữu kinh doanh tại điểm ghim. Giữ nguyên animation Hero và hover hiện có, không bổ sung thư viện hoặc hiệu ứng cuộn mới.
