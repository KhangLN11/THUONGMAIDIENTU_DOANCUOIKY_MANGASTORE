# Kiểm tra khoảng cách giữa mã Figma Make và ứng dụng thật

| Hạng mục | Có trong Figma? | Cần triển khai |
|---|---|---|
| Giao diện, responsive | Có CSS/JSX | Kiểm thử trên localhost và so với Figma |
| Đa ngôn ngữ | `i18n.tsx`, VI/EN | Giữ, sau nâng cấp translation keys nếu cần |
| Sản phẩm | 8 mock hardcoded trong `App.tsx` | GET API + DB mapping |
| Giá | USD giá mẫu | VND từ `price_vnd`, không tự quy đổi |
| Giỏ hàng | React state in memory | Guest persistence, Cart API authenticated |
| Wishlist | React state in memory | API authenticated, storage nếu khách |
| Trang chi tiết | `products[1]` cố định | Route /products/:slug + GET item |
| Router | State `Page`, URL chưa cập nhật | React Router hoặc route giải pháp thích hợp sau |
| Checkout | UI form, preventDefault | Validate, stock, order transaction, payment strategy |
| Account | Dashboard mẫu | Auth, customer profile, order history |
| Search | Lọc theo name trong local array | API search/filter/pagination |
| Sorting | Select chưa có onChange | Query API, sort chính xác |
| Images | Unsplash remote | Lưu URL demo; quản lý asset sau |
| Brand | MANGA UNIVERSE | Giữ nguyên giai đoạn 1 |

Không được coi 8 sản phẩm trong SQL là cùng danh mục và tên với 8 sản phẩm gốc Figma.
