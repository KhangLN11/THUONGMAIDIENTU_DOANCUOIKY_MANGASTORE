import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "vi" | "en";

const vi: Record<string, string> = {
  "commerce.error.AMOUNT_OUT_OF_RANGE": "Giá trị giỏ hàng vượt giới hạn xử lý an toàn.",
  "commerce.loading": "Đang tải giỏ hàng và danh sách yêu thích…",
  "commerce.error.INSUFFICIENT_STOCK": "Số lượng yêu cầu vượt quá tồn kho.",
  "commerce.error.PRODUCT_UNAVAILABLE": "Sản phẩm không còn khả dụng. Dữ liệu tạm được giữ lại để đối chiếu thủ công.",
  "commerce.error.NETWORK_ERROR": "Không thể kết nối. Thử lại sẽ tải dữ liệu máy chủ, không lặp thao tác thêm.",
  "commerce.error.MERGE_UNCERTAIN": "Chưa xác định được kết quả đồng bộ. Giỏ tạm được giữ lại; hãy kiểm tra giỏ tài khoản trước khi xử lý thủ công.",
  "commerce.error.MERGE_CONTEXT_CHANGED": "Phiên đăng nhập đã đổi trước khi xác nhận đồng bộ. Dữ liệu tạm được giữ lại để đối chiếu thủ công.",
  "commerce.error.GUEST_STORAGE_FAILED": "Không thể lưu an toàn kế hoạch đồng bộ trong trình duyệt. Chưa gửi giỏ tạm.",
  "commerce.error.INVALID_INPUT": "Sản phẩm hoặc số lượng không hợp lệ.",
  "commerce.error.ITEM_NOT_FOUND": "Dòng giỏ hàng không còn tồn tại. Thử lại để tải lại.",
  "commerce.error.UNAUTHENTICATED": "Phiên đã hết hạn. Vui lòng đăng nhập lại.",
  "commerce.error.CSRF_INVALID": "Phiên đã thay đổi. Thử lại để tải lại.",
  "commerce.error.INTERNAL_ERROR": "Không thể tải giỏ hàng. Vui lòng thử lại.",
  "commerce.error.INVALID_RESPONSE": "Phản hồi máy chủ không hợp lệ. Vui lòng thử lại.",
  "commerce.error.MERGE_KEY_REUSED": "Kế hoạch đồng bộ đã thay đổi. Dữ liệu được giữ lại để đối chiếu thủ công.",
  "commerce.error.MERGE_LIMIT": "Quá nhiều yêu cầu đồng bộ trong phiên này. Dữ liệu tạm được giữ lại.",
  "auth.member": "HỒ SƠ THÀNH VIÊN",
  "auth.guest": "KHÁCH",
  "auth.welcome": "CHÀO MỪNG ĐẾN MANGA UNIVERSE",
  "auth.memberSince": "THÀNH VIÊN TỪ",
  "auth.login": "ĐĂNG NHẬP",
  "auth.register": "ĐĂNG KÝ",
  "auth.logout": "ĐĂNG XUẤT",
  "auth.name": "HỌ VÀ TÊN",
  "auth.password": "MẬT KHẨU",
  "auth.role": "VAI TRÒ",
  "auth.adminRole": "QUẢN TRỊ VIÊN",
  "auth.userRole": "NGƯỜI DÙNG",
  "auth.admin": "QUYỀN QUẢN TRỊ",
  "auth.adminVerified": "Máy chủ đã xác nhận quyền quản trị. Dashboard chưa được triển khai.",
  "auth.ordersUnavailable": "Lịch sử đơn hàng và điểm thành viên chưa được kết nối.",
  "auth.loading": "VUI LÒNG CHỜ…",
  "auth.registered": "Tạo tài khoản thành công. Vui lòng đăng nhập.",
  "auth.passwordHint": "Sử dụng mật khẩu từ 12–72 byte UTF-8.",
  "auth.error.INVALID_EMAIL": "Vui lòng nhập email hợp lệ.",
  "auth.error.INVALID_PASSWORD": "Mật khẩu đăng ký phải từ 12–72 byte UTF-8, đăng nhập tối đa 72 byte.",
  "auth.error.INVALID_NAME": "Họ tên phải có từ 2–150 ký tự.",
  "auth.error.EMAIL_EXISTS": "Email này đã được đăng ký.",
  "auth.error.INVALID_CREDENTIALS": "Email hoặc mật khẩu không đúng, hoặc tài khoản không khả dụng.",
  "auth.error.RATE_LIMITED": "Quá nhiều lần thử. Vui lòng chờ tối đa 15 phút.",
  "auth.error.CSRF_INVALID": "Phiên đã thay đổi. Vui lòng thử lại.",
  "auth.error.UNAUTHENTICATED": "Vui lòng đăng nhập lại.",
  "auth.error.FORBIDDEN": "Bạn không có quyền truy cập.",
  "auth.error.NETWORK_ERROR": "Không thể kết nối. Vui lòng thử lại.",
  "auth.error.INTERNAL_ERROR": "Không thể xử lý yêu cầu. Vui lòng thử lại.",
  "auth.error.INVALID_RESPONSE": "Phản hồi máy chủ không hợp lệ. Vui lòng thử lại.",
  "auth.error.ROLE_FORBIDDEN": "Không thể thay đổi quyền tài khoản tại đây.",
  "auth.error.REQUEST_FAILED": "Yêu cầu không thành công. Vui lòng thử lại.",
  "Loading products…": "Đang tải sản phẩm…",
  "No products found.": "Không tìm thấy sản phẩm.",
  "Product not found.": "Không tìm thấy sản phẩm.",
  "Unable to load products.": "Không thể tải sản phẩm.",
  "TRY AGAIN": "THỬ LẠI",
  "IN STOCK": "CÒN HÀNG",
  "OUT OF STOCK": "HẾT HÀNG",
  "Uncategorized": "Chưa phân loại",
  "No description available.": "Chưa có mô tả.",
  "Cart preview only. Ordering and payment are not available yet.": "Giỏ hàng chỉ để xem trước. Chức năng đặt hàng và thanh toán chưa được triển khai.",

  HOME: "TRANG CHỦ",
  SHOP: "CỬA HÀNG",
  "MANGA SERIES": "BỘ TRUYỆN",
  MERCHANDISE: "PHỤ KIỆN",
  "NEW ARRIVALS": "HÀNG MỚI",
  "ABOUT US": "VỀ CHÚNG TÔI",
  Search: "Tìm kiếm",
  Account: "Tài khoản",
  Wishlist: "Yêu thích",
  Cart: "Giỏ hàng",
  Menu: "Trình đơn",
  "Add to wishlist": "Thêm vào yêu thích",
  "Sort products": "Sắp xếp sản phẩm",
  Subscribe: "Đăng ký nhận tin",
  "ISSUE 001": "SỐ 001",
  "TOKYO / WORLDWIDE": "TOKYO / TOÀN CẦU",
  "ENTER THE": "BƯỚC VÀO",
  WORLD: "THẾ GIỚI",
  OF: "CỦA",
  "Curated stories. Rare objects. Iconic characters.":
    "Những câu chuyện tuyển chọn. Vật phẩm quý hiếm. Nhân vật biểu tượng.",
  "Your next obsession starts here.": "Niềm đam mê tiếp theo của bạn bắt đầu tại đây.",
  "EXPLORE COLLECTION": "KHÁM PHÁ BỘ SƯU TẬP",
  "SHOP NOW": "MUA NGAY",
  STORIES: "CÂU CHUYỆN",
  WITHOUT: "KHÔNG",
  LIMITS: "GIỚI HẠN",
  READY: "BẠN ĐÃ",
  "TO BEGIN?": "SẴN SÀNG?",
  "SCROLL TO ENTER": "CUỘN ĐỂ KHÁM PHÁ",
  "AUTHENTIC MANGA": "MANGA CHÍNH HÃNG",
  "LIMITED DROPS": "PHIÊN BẢN GIỚI HẠN",
  "WORLDWIDE SHIPPING": "GIAO HÀNG TOÀN CẦU",
  "OFFICIALLY LICENSED": "BẢN QUYỀN CHÍNH THỨC",
  "01 / CURATED WORLDS": "01 / THẾ GIỚI TUYỂN CHỌN",
  FEATURED: "NỔI BẬT",
  UNIVERSES: "VŨ TRỤ",
  "04 SERIES": "04 BỘ TRUYỆN",
  "01 / CYBERPUNK": "01 / CYBERPUNK",
  "02 / DARK FANTASY": "02 / KỲ ẢO ĐEN TỐI",
  "03 / SAMURAI": "03 / SAMURAI",
  "04 / MECHA": "04 / MECHA",
  "A city that never forgives.": "Một thành phố không bao giờ tha thứ.",
  "Beyond the edge of memory.": "Vượt khỏi ranh giới ký ức.",
  "Honor ends. The blade remains.": "Danh dự khép lại. Lưỡi kiếm còn mãi.",
  "Built to obey. Born to feel.": "Được tạo ra để tuân lệnh. Sinh ra để cảm nhận.",
  "02 / JUST DROPPED": "02 / VỪA CẬP BẾN",
  NEW: "MỚI",
  ARRIVALS: "CẬP BẾN",
  "VIEW ALL →": "XEM TẤT CẢ →",
  "QUICK VIEW": "XEM NHANH",
  "ADD TO CART": "THÊM VÀO GIỎ",
  LIMITED: "GIỚI HẠN",
  "BEST SELLER": "BÁN CHẠY",
  "PRE-ORDER": "ĐẶT TRƯỚC",
  "03 / COLLECTOR'S DROP": "03 / PHIÊN BẢN SƯU TẦM",
  THE: "",
  ARCHIVE: "LƯU TRỮ",
  "EDITION.": "ĐẶC BIỆT.",
  "Hand-numbered volumes, exclusive slipcase,": "Ấn bản đánh số thủ công, hộp bảo vệ độc quyền,",
  "studio print, and collector's seal.": "bản in studio và dấu chứng nhận sưu tầm.",
  "DISCOVER THE EDITION": "KHÁM PHÁ PHIÊN BẢN",
  "04 / COMMUNITY FAVORITES": "04 / ĐƯỢC CỘNG ĐỒNG YÊU THÍCH",
  "BEST SELLERS": "BÁN CHẠY NHẤT",
  "ICON LIST": "DANH SÁCH BIỂU TƯỢNG",
  "05 / OUR MANIFESTO": "05 / TUYÊN NGÔN CỦA CHÚNG TÔI",
  "NOT JUST A STORE.": "KHÔNG CHỈ LÀ CỬA HÀNG.",
  "A PORTAL.": "MỘT CÁNH CỔNG.",
  "We search Tokyo's hidden shelves, independent studios, and official archives to bring you objects with a story. Every piece is selected for the people who never stopped believing in other worlds.":
    "Chúng tôi tìm kiếm trong những kệ sách ẩn mình tại Tokyo, các studio độc lập và kho lưu trữ chính thức để mang đến những vật phẩm có câu chuyện. Mỗi sản phẩm dành cho những người chưa bao giờ ngừng tin vào các thế giới khác.",
  "READ OUR STORY": "ĐỌC CÂU CHUYỆN CỦA CHÚNG TÔI",
  "FIRST ORDER?": "ĐƠN HÀNG ĐẦU TIÊN?",
  "GET 15% OFF": "GIẢM 15%",
  "YOUR FIRST DROP.": "CHO ĐƠN ĐẦU TIÊN.",
  "Join the universe for early access, studio stories and members-only releases.":
    "Gia nhập vũ trụ để được mở bán sớm, khám phá chuyện hậu trường và các phiên bản dành riêng cho thành viên.",
  "CLAIM THE OFFER": "NHẬN ƯU ĐÃI",
  "THE FULL ARCHIVE / 2025": "TOÀN BỘ KHO LƯU TRỮ / 2025",
  ALL: "TẤT CẢ",
  "SEARCH THE ARCHIVE": "TÌM TRONG KHO LƯU TRỮ",
  OBJECTS: "VẬT PHẨM",
  "SORT: FEATURED": "SẮP XẾP: NỔI BẬT",
  "PRICE: LOW TO HIGH": "GIÁ: THẤP ĐẾN CAO",
  "NEWEST FIRST": "MỚI NHẤT TRƯỚC",
  "FILTER / 絞り込み": "BỘ LỌC / 絞り込み",
  All: "Tất cả",
  Manga: "Manga",
  Figures: "Mô hình",
  Posters: "Áp phích",
  Apparel: "Thời trang",
  Accessories: "Phụ kiện",
  "PRICE RANGE": "KHOẢNG GIÁ",
  "HOME / FIGURES / BLADE//ZERO /": "TRANG CHỦ / MÔ HÌNH / BLADE//ZERO /",
  "LIMITED / 250": "GIỚI HẠN / 250",
  "PREMIUM SCALE FIGURE / 01:08": "MÔ HÌNH CAO CẤP / 01:08",
  FIGURE: "MÔ HÌNH",
  REVIEWS: "ĐÁNH GIÁ",
  "A museum-grade collectible forged from the world of Blade//Zero. Hand-finished detail, interchangeable katana, and individually numbered base.":
    "Vật phẩm sưu tầm chuẩn trưng bày từ thế giới Blade//Zero. Hoàn thiện thủ công, katana có thể thay đổi và đế đánh số riêng.",
  "IN STOCK — SHIPS IN 2–3 DAYS": "CÒN HÀNG — GỬI TRONG 2–3 NGÀY",
  "BUY IT NOW": "MUA NGAY",
  "DETAILS & DIMENSIONS": "CHI TIẾT & KÍCH THƯỚC",
  "SHIPPING & RETURNS": "GIAO HÀNG & ĐỔI TRẢ",
  "AUTHENTICITY GUARANTEE": "CAM KẾT CHÍNH HÃNG",
  "YOU MAY ALSO ENTER": "CÓ THỂ BẠN CŨNG THÍCH",
  "03 OBJECTS": "03 VẬT PHẨM",
  "12 OBJECTS": "12 VẬT PHẨM",
  RELATED: "SẢN PHẨM",
  DROPS: "LIÊN QUAN",
  "SERIES FILE / 002": "HỒ SƠ BỘ TRUYỆN / 002",
  "SHOP THE SERIES": "MUA SẮM THEO BỘ TRUYỆN",
  "THE STORY / 物語": "CÂU CHUYỆN / 物語",
  "BEYOND THE EDGE": "VƯỢT KHỎI RANH GIỚI",
  MEMORY: "KÝ ỨC",
  "MEMORY.": "KÝ ỨC.",
  "In Sector 9, memories can be bought, sold, and erased. Runner 404 has none—and someone wants to keep it that way.":
    "Tại Khu 9, ký ức có thể được mua, bán và xóa bỏ. Runner 404 không có ký ức—và có kẻ muốn mọi chuyện mãi như vậy.",
  VOLUMES: "TẬP",
  CHAPTERS: "CHƯƠNG",
  "THE COMPLETE COLLECTION": "BỘ SƯU TẬP HOÀN CHỈNH",
  VOID: "HƯ VÔ",
  "YOUR SELECTED OBJECTS": "VẬT PHẨM BẠN ĐÃ CHỌN",
  CART: "GIỎ HÀNG",
  "YOUR PANEL IS EMPTY.": "KHUNG TRUYỆN CỦA BẠN ĐANG TRỐNG.",
  "The next chapter is waiting.": "Chương tiếp theo đang chờ bạn.",
  "ENTER THE SHOP": "VÀO CỬA HÀNG",
  OBJECT: "SẢN PHẨM",
  QUANTITY: "SỐ LƯỢNG",
  TOTAL: "TỔNG CỘNG",
  REMOVE: "XÓA",
  "ORDER SUMMARY": "TÓM TẮT ĐƠN HÀNG",
  SUBTOTAL: "TẠM TÍNH",
  SHIPPING: "VẬN CHUYỂN",
  "CALCULATED NEXT": "TÍNH Ở BƯỚC SAU",
  TAX: "THUẾ",
  "PROCEED TO CHECKOUT": "TIẾN HÀNH THANH TOÁN",
  "SECURE CHECKOUT / AUTHENTICITY GUARANTEED": "THANH TOÁN AN TOÀN / CAM KẾT CHÍNH HÃNG",
  INFORMATION: "THÔNG TIN",
  PAYMENT: "THANH TOÁN",
  "EMAIL ADDRESS": "ĐỊA CHỈ EMAIL",
  "FIRST NAME": "TÊN",
  "LAST NAME": "HỌ",
  ADDRESS: "ĐỊA CHỈ",
  "STREET AND NUMBER": "SỐ NHÀ VÀ TÊN ĐƯỜNG",
  CITY: "THÀNH PHỐ",
  COUNTRY: "QUỐC GIA",
  JAPAN: "NHẬT BẢN",
  "UNITED STATES": "HOA KỲ",
  "UNITED KINGDOM": "VƯƠNG QUỐC ANH",
  POSTCODE: "MÃ BƯU CHÍNH",
  "CONTINUE TO SHIPPING": "TIẾP TỤC ĐẾN VẬN CHUYỂN",
  "ORDER / 注文": "ĐƠN HÀNG / 注文",
  "TOTAL / USD": "TỔNG CỘNG / USD",
  "4.9 / 38 REVIEWS": "4,9 / 38 ĐÁNH GIÁ",
  "MEMBER FILE / 000042": "HỒ SƠ THÀNH VIÊN / 000042",
  "account.headingLead": "VŨ TRỤ",
  "account.headingAccent": "CỦA TÔI",
  "MEMBER SINCE 2024": "THÀNH VIÊN TỪ 2024",
  OVERVIEW: "TỔNG QUAN",
  "ORDER HISTORY": "LỊCH SỬ ĐƠN HÀNG",
  WISHLIST: "SẢN PHẨM YÊU THÍCH",
  ADDRESSES: "ĐỊA CHỈ",
  "ACCOUNT SETTINGS": "CÀI ĐẶT TÀI KHOẢN",
  "DASHBOARD / 概要": "BẢNG ĐIỀU KHIỂN / 概要",
  "WELCOME BACK,": "CHÀO MỪNG TRỞ LẠI,",
  "TOTAL ORDERS": "TỔNG ĐƠN HÀNG",
  "SAVED OBJECTS": "VẬT PHẨM ĐÃ LƯU",
  "MEMBER POINTS": "ĐIỂM THÀNH VIÊN",
  "RECENT ORDER": "ĐƠN HÀNG GẦN ĐÂY",
  "ORDER #MU-240418": "ĐƠN HÀNG #MU-240418",
  "THE RONIN FIGURE + 2 OBJECTS": "THE RONIN FIGURE + 2 VẬT PHẨM",
  "APR 18, 2025": "18 THÁNG 4, 2025",
  SHIPPED: "ĐÃ GỬI",
  "CONTINUE COLLECTING": "TIẾP TỤC SƯU TẦM",
  "OBJECTS FROM": "VẬT PHẨM TỪ",
  "OTHER WORLDS.": "NHỮNG THẾ GIỚI KHÁC.",
  EXPLORE: "KHÁM PHÁ",
  "SHOP ALL": "XEM TẤT CẢ",
  "LIMITED EDITIONS": "PHIÊN BẢN GIỚI HẠN",
  SUPPORT: "HỖ TRỢ",
  CONTACT: "LIÊN HỆ",
  FAQ: "CÂU HỎI THƯỜNG GẶP",
  AUTHENTICITY: "CHÍNH HÃNG",
  "TRANSMISSIONS / 通信": "BẢN TIN / 通信",
  "JOIN THE": "GIA NHẬP",
  "INNER CIRCLE.": "CỘNG ĐỒNG.",
  "YOUR EMAIL ADDRESS": "ĐỊA CHỈ EMAIL CỦA BẠN",
  "Early access. Rare drops. No noise.": "Mở bán sớm. Phiên bản hiếm. Chỉ những điều đáng chú ý.",
  PRIVACY: "BẢO MẬT",
  TERMS: "ĐIỀU KHOẢN",
  "VIEW CART": "XEM GIỎ HÀNG",
  "ADDED TO CART": "ĐÃ THÊM VÀO GIỎ",
  "Manga pages": "Các trang manga",
  "Manga archive": "Kho lưu trữ manga",
  "Curated manga volumes": "Các tập manga tuyển chọn",
  "Manga shelves": "Kệ sách manga",
  "View 1": "Góc xem 1",
  "View 2": "Góc xem 2",
  "View 3": "Góc xem 3",
};

const en: Record<string, string> = {
  ...Object.fromEntries(Object.keys(vi).map((key) => [key, key])),
  "commerce.error.AMOUNT_OUT_OF_RANGE": "Cart amount exceeds the safe numeric range.",
  "commerce.loading": "Loading your cart and wishlist…",
  "commerce.error.INSUFFICIENT_STOCK": "The requested quantity exceeds available stock.",
  "commerce.error.PRODUCT_UNAVAILABLE": "This product is no longer available. Guest data is retained for manual reconciliation.",
  "commerce.error.NETWORK_ERROR": "Cannot connect. Retry reloads your server data without repeating an add.",
  "commerce.error.MERGE_UNCERTAIN": "Guest sync has an uncertain result. Your guest data is retained; do not repeat it manually before checking your account cart.",
  "commerce.error.MERGE_CONTEXT_CHANGED": "The login session changed before guest sync was confirmed. Guest data is retained for manual reconciliation.",
  "commerce.error.GUEST_STORAGE_FAILED": "Cannot safely save the guest sync plan in this browser. Guest cart was not submitted.",
  "commerce.error.INVALID_INPUT": "Invalid product or quantity.",
  "commerce.error.ITEM_NOT_FOUND": "This cart item no longer exists. Retry to reload.",
  "commerce.error.UNAUTHENTICATED": "Your session expired. Please sign in again.",
  "commerce.error.CSRF_INVALID": "Your session changed. Retry to reload.",
  "commerce.error.INTERNAL_ERROR": "Cannot load your cart. Please try again.",
  "commerce.error.INVALID_RESPONSE": "Invalid server response. Please try again.",
  "commerce.error.MERGE_KEY_REUSED": "The saved guest sync plan changed. Data is retained for manual reconciliation.",
  "commerce.error.MERGE_LIMIT": "Too many guest sync attempts in this session. Data is retained.",
  "auth.member": "MEMBER FILE",
  "auth.guest": "GUEST",
  "auth.welcome": "WELCOME TO MANGA UNIVERSE",
  "auth.memberSince": "MEMBER SINCE",
  "auth.login": "SIGN IN",
  "auth.register": "CREATE ACCOUNT",
  "auth.logout": "SIGN OUT",
  "auth.name": "FULL NAME",
  "auth.password": "PASSWORD",
  "auth.role": "ROLE",
  "auth.adminRole": "ADMIN",
  "auth.userRole": "USER",
  "auth.admin": "ADMIN ACCESS",
  "auth.adminVerified": "Admin access verified by the server. Dashboard is not available yet.",
  "auth.ordersUnavailable": "Order history and member points are not connected yet.",
  "auth.loading": "PLEASE WAIT…",
  "auth.registered": "Account created. Please sign in.",
  "auth.passwordHint": "Use a password of 12–72 UTF-8 bytes.",
  "auth.error.INVALID_EMAIL": "Enter a valid email address.",
  "auth.error.INVALID_PASSWORD": "Password must be 12–72 UTF-8 bytes when registering, at most 72 when signing in.",
  "auth.error.INVALID_NAME": "Full name must contain 2–150 characters.",
  "auth.error.EMAIL_EXISTS": "This email is already registered.",
  "auth.error.INVALID_CREDENTIALS": "Email or password is incorrect, or the account is unavailable.",
  "auth.error.RATE_LIMITED": "Too many attempts. Please wait up to 15 minutes.",
  "auth.error.CSRF_INVALID": "Session changed. Please try again.",
  "auth.error.UNAUTHENTICATED": "Please sign in again.",
  "auth.error.FORBIDDEN": "You do not have permission.",
  "auth.error.NETWORK_ERROR": "Cannot connect. Please try again.",
  "auth.error.INTERNAL_ERROR": "The request could not be completed. Please try again.",
  "auth.error.INVALID_RESPONSE": "Invalid server response. Please try again.",
  "auth.error.ROLE_FORBIDDEN": "Account permissions cannot be changed here.",
  "auth.error.REQUEST_FAILED": "The request failed. Please try again.",
  "account.headingLead": "MY",
  "account.headingAccent": "UNIVERSE",
};

export const translations = {
  en,
  vi,
};

type I18nValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
  formatCurrency: (value: number, currency?: "USD" | "VND") => string;
  formatDate: (value: Date | string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      return localStorage.getItem("manga-universe-language") === "en" ? "en" : "vi";
    } catch {
      return "vi";
    }
  });

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    try {
      localStorage.setItem("manga-universe-language", next);
    } catch {
      // Language still updates when storage is unavailable.
    }
  };

  const value = useMemo<I18nValue>(() => {
    const locale = language === "vi" ? "vi-VN" : "en-US";
    return {
      language,
      setLanguage,
      t: (key) => translations[language][key] ?? key,
      formatCurrency: (value, currency = "USD") =>
        new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          currencyDisplay: language === "vi" ? "code" : "symbol",
        }).format(value),
      formatDate: (value) =>
        new Intl.DateTimeFormat(locale, {
          year: "numeric",
          month: language === "vi" ? "long" : "short",
          day: "numeric",
        }).format(typeof value === "string" ? new Date(value) : value),
    };
  }, [language]);

  useEffect(() => {
    document.documentElement.lang = language === "vi" ? "vi" : "en";
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

const sourceText = new WeakMap<Text, string>();
const sourceAttributes = new WeakMap<Element, Record<string, string>>();

function localizeTextNode(node: Text, language: Language) {
  if (node.parentElement?.closest("[data-product-text]")) return;
  if (!sourceText.has(node)) sourceText.set(node, node.nodeValue ?? "");
  let source = sourceText.get(node) ?? "";
  const current = node.nodeValue ?? "";
  const currentClean = current.trim();
  const sourceClean = source.trim();
  const expectedVietnamese = translations.vi[sourceClean];
  if (
    currentClean &&
    current !== source &&
    (expectedVietnamese === undefined || currentClean !== expectedVietnamese)
  ) {
    sourceText.set(node, current);
    source = current;
  }
  const clean = source.trim();
  if (!clean) return;
  const translated = language === "vi" ? translations.vi[clean] : undefined;
  const next =
    language === "vi" && translated !== undefined ? source.replace(clean, translated) : source;
  if (node.nodeValue !== next) node.nodeValue = next;
}

function localizeElement(element: Element, language: Language) {
  if (element.closest("[data-product-text]")) return;
  const names = ["placeholder", "aria-label", "title", "alt"];
  if (!sourceAttributes.has(element)) {
    const originals: Record<string, string> = {};
    names.forEach((name) => {
      const value = element.getAttribute(name);
      if (value) originals[name] = value;
    });
    sourceAttributes.set(element, originals);
  }
  const originals = sourceAttributes.get(element) ?? {};
  Object.entries(originals).forEach(([name, initialSource]) => {
    let source = initialSource;
    const current = element.getAttribute(name);
    const expectedVietnamese = translations.vi[source];
    if (
      current &&
      current !== source &&
      (expectedVietnamese === undefined || current !== expectedVietnamese)
    ) {
      originals[name] = current;
      source = current;
    }
    element.setAttribute(name, language === "vi" ? (translations.vi[source] ?? source) : source);
  });
}

function localizeTree(root: Node, language: Language) {
  if (root instanceof Text) localizeTextNode(root, language);
  if (root instanceof Element) localizeElement(root, language);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (current instanceof Text) localizeTextNode(current, language);
    else if (current instanceof Element) localizeElement(current, language);
    current = walker.nextNode();
  }
}

export function useTranslateDocument() {
  const { language } = useI18n();
  useEffect(() => {
    let translating = false;
    const apply = (root: Node) => {
      if (translating) return;
      translating = true;
      localizeTree(root, language);
      translating = false;
    };
    apply(document.body);
    const observer = new MutationObserver((records) => {
      if (translating) return;
      records.forEach((record) => {
        if (record.type === "characterData") apply(record.target);
        record.addedNodes.forEach(apply);
      });
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [language]);
}
