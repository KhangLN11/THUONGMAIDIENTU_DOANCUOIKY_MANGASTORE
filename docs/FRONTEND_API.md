# Tích hợp sản phẩm React / PHP – Giai đoạn 4

## Cấu hình

Frontend vẫn chạy tại http://localhost:8443/ và giữ cổng hiện có trong vite.config.ts.
Mặc định `frontend/.env.local` đang là demo:

```dotenv
VITE_USE_PRODUCTS_API=false
VITE_PRODUCTS_API_BASE_URL=/api
```

Đổi thành `VITE_USE_PRODUCTS_API=true` rồi khởi động lại Vite bằng `npm run dev` để dùng MySQL. Đổi về false để trở lại demo. Dữ liệu demo và các ảnh cũ vẫn nằm trong App.tsx.
File `.env.local` được Git bỏ qua; `.env.example` là mẫu có thể commit. Cờ này áp dụng lúc khởi động Vite/build, không phải nút đổi chế độ trong giao diện.

Vite proxy (chỉ development):

```text
/api/products.php -> http://localhost/manga-store/backend/public/api/products.php
/api/product.php?id=1 -> http://localhost/manga-store/backend/public/api/product.php?id=1
```

`PRODUCTS_API_PROXY_TARGET` là cấu hình server Vite, mặc định `http://localhost`; có thể đặt `http://localhost:8080` khi Apache dùng port khác. Không có URL localhost trong component.

Production/`vite preview` không sử dụng dev proxy: cần reverse proxy `/api` hoặc build với `VITE_PRODUCTS_API_BASE_URL=/manga-store/backend/public/api` khi frontend cùng origin Apache. Không đưa thông tin kết nối database vào bất kỳ biến `VITE_*` nào.

## Tổ chức source

- `src/types/product.ts`: hợp đồng JSON backend và kiểu Product phục vụ UI.
- `src/services/productService.ts`: Fetch API, kiểm tra HTTP/success/schema, timeout 12 giây, hủy request và kiểm tra ID trả về.
- `src/adapters/productAdapter.ts`: ánh xạ song ngữ, VND, sale/null, tồn kho và ảnh.
- `src/config/products.ts`: cờ nguồn dữ liệu và đường dẫn API.
- `src/hooks/useProducts.tsx`: catalog dùng chung và hook tải chi tiết; giữ dữ liệu gốc để đổi ngôn ngữ không refetch.
- `src/components/ProductImage.tsx`: fallback ảnh null/hỏng.
- `src/components/ProductState.tsx`: loading/error/empty và retry; skeleton dùng chính class card/image hiện có.
- `public/product-placeholder.svg`: placeholder vector đen trắng, không ghép ảnh demo vào sản phẩm thật.

`App.tsx` vẫn giữ component và mảng demo cũ. Khi bật API, các vùng sản phẩm Home, Shop, Series và related dùng cùng catalog MySQL để không trộn nguồn trong giỏ hàng. Banner/collection/series editorial vẫn là nội dung Figma cũ; chưa ánh xạ chúng với series thật trong DB.

Shop hiển thị tên, giá hiện tại và giá gốc nếu có sale, danh mục, series, tồn kho, ảnh/placeholder. Lọc danh mục dùng slug ổn định khi đổi ngôn ngữ; tìm kiếm chạy local trên danh sách API. Chi tiết dùng ID từ card và gọi endpoint riêng, không suy ra ID từ vị trí mảng.

Hệ thống i18n hiện tại được giữ lại, thêm key trạng thái và tùy chọn currency cho hàm formatCurrency. Demo và đơn hàng mẫu Account vẫn USD; sản phẩm API/giỏ API luôn VND. Văn bản dữ liệu sản phẩm có marker để MutationObserver không ghi đè bản dịch từ adapter.

Khi API lỗi, không có fallback demo. Hiện thông báo chung theo ngôn ngữ và nút thử lại; không đưa lỗi nội bộ server vào UI.

## Giới hạn chức năng

- Giỏ và wishlist vẫn là state React trong phiên; reload sẽ mất. Hai chế độ dùng nguồn riêng, kiểm tra source khi thêm vào giỏ. Giỏ API giới hạn số lượng theo tồn kho snapshot, chưa phải kiểm tra tồn kho giao dịch.
- Checkout API bị vô hiệu hóa và có thông báo xem trước; không ghi giỏ, đơn hàng hoặc thanh toán vào database. Demo checkout giữ luồng cũ.
- Account vẫn là dashboard mẫu, không phải tài khoản hay lịch sử mua hàng thật.
- Sort/khoảng giá chưa có logic đầy đủ từ bản Figma: vô hiệu hóa trong API; pagination giả được ẩn vì API hiện trả toàn bộ danh sách. Không có phân trang server ở bước này.
- Series/collection banner chưa liên kết với series database; nút editorial không có ID sản phẩm chuyển sang Shop trong API thay vì giả định một ID.
- Không đổi CSS nguồn, breakpoint, hover, logo, banner, schema hoặc seed. Chỉ bổ sung inline style có điều kiện API để tên dài/giá giảm/tồn kho phù hợp card và mobile.

## Kiểm thử đã chạy

- `npm run build`: thành công cả false và true.
- `node_modules/.bin/tsc --noEmit`: thành công; sửa khai báo kiểu dictionary `en` sẵn có, không đổi bản dịch cũ.
- `python backend/tests/test_api.py`: đạt toàn bộ kiểm thử backend cũ.
- Proxy Vite `/api/products.php`: HTTP 200, total=8.
- Chrome headless thật qua CDP, không cài package mới: viewport desktop 1440x1000 và mobile 390x844.
- Demo Home/Shop DOM so sánh bằng nhau với baseline chụp trước chỉnh sửa; không request API; không tràn ngang mobile.
- Live đọc đủ 8 sản phẩm; chi tiết thực ID 1 và 8; tiếng Việt/English đổi tại chỗ, giữ ID, không refetch chi tiết; giỏ đổi ngôn ngữ và giữ giá VNĐ.
- Null ảnh của cả 8 sản phẩm, giá sale/null, tồn kho, error/retry sau 404 và chặn mạng đều hoạt động; không fallback demo.
- Mock chỉ trong browser (không sửa database): loading/skeleton, catalog rỗng, JSON sai cấu trúc, HTTP 200 success=false, ID không liên tiếp 71, ảnh lỗi, hết hàng và sale=0 đều đạt.
- Không có uncaught exception hoặc console.error của JavaScript trong các luồng kiểm thử. Lỗi HTTP được cố ý mô phỏng và ảnh mock 404 là lỗi mong đợi của bài test.

Chạy lại từ thư mục gốc:

```powershell
python backend/tests/test_api.py
cd frontend
npm run build
.\node_modules\.bin\tsc.cmd --noEmit
```

Kiểm thử trình duyệt, yêu cầu Chrome tại đường dẫn Windows trong script và Vite đang chạy ở 8443:

```powershell
# false, đối chiếu với baseline local đã có:
node frontend/scripts/check-products.mjs
# true, kiểm thử dữ liệu thật và mô phỏng lỗi trong browser:
node frontend/scripts/check-products.mjs --live
```

`--baseline` tạo/cập nhật baseline (chỉ dùng khi chủ động chấp nhận giao diện gốc). Ảnh, DOM baseline và network logs nằm trong `frontend/.artifacts/`, được bỏ qua Git. Script so sánh demo yêu cầu baseline local; bản gốc đã được chụp trước chỉnh sửa giai đoạn này. Kiểm thử dùng Chrome headless thật, chưa phải kiểm tra thủ công trên thiết bị vật lý.

Cảnh báo native config loader của Vite về __dirname/JSON import vẫn còn như trước; không chặn build hiện tại.
