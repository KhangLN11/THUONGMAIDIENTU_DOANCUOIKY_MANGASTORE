import type { Product } from "../../types/product";
import verified from "./verifiedCatalog.json";
export const copy = {
 vi: {
  titles: ["CHI TIẾT & KÍCH THƯỚC", "GIAO HÀNG & ĐỔI TRẢ", "CAM KẾT CHÍNH HÃNG"],
  labels: {name:"Tên sản phẩm",category:"Loại sản phẩm",series:"Series / Tác phẩm",sku:"SKU",author:"Tác giả",publisher:"Nhà xuất bản",language:"Ngôn ngữ ấn bản",volume:"Tập",isbn_print:"ISBN bản in",character:"Nhân vật",manufacturer:"Nhà sản xuất",product_line:"Dòng sản phẩm",height_mm_approx:"Chiều cao (xấp xỉ)",scale:"Tỷ lệ"},
  missing:"Các thông số chưa có dữ liệu xác minh được lược bỏ. Kích thước, chất liệu hoặc thông tin bổ sung sẽ hiển thị khi được cập nhật.",
  description:"Mô tả sản phẩm", noDescription:"Mô tả sản phẩm chưa được cập nhật.",
  shipping:[["Phương thức giao hàng","Sử dụng phương thức giao hàng hiển thị tại Checkout. Thông tin và phí được xác nhận tại bước thanh toán."],["Phí vận chuyển","Phí được tính theo cấu hình Checkout hiện hành. Đây là phí minh họa cho đồ án; không phải báo giá của đơn vị vận chuyển."],["Đổi trả","Chính sách đổi trả đang được cập nhật. Chưa có thời hạn đổi trả hoặc điều kiện hoàn tiền được công bố trong dự án."]],
  authenticity:[["Minh bạch thông tin","Sản phẩm được giới thiệu theo tên, phiên bản và thông tin catalog hiện có. Thông tin chưa xác minh không được coi là thông số chính thức."],["Nguồn gốc","Thông tin nhà xuất bản hoặc nhà sản xuất được hiển thị khi có dữ liệu catalog đã đối chiếu. Thông tin này không thay thế chứng từ xuất xứ của từng món hàng."],["Giới hạn xác minh","Dự án chưa công bố chứng nhận phân phối hoặc bảo đảm thương mại về tính chính hãng. Nội dung cam kết cần được chủ dự án xác nhận trước khi áp dụng cho hoạt động kinh doanh."]],
 },
 en: {
  titles:["DETAILS & DIMENSIONS","SHIPPING & RETURNS","AUTHENTICITY INFORMATION"],
  labels:{name:"Product name",category:"Product type",series:"Series / Work",sku:"SKU",author:"Author",publisher:"Publisher",language:"Edition language",volume:"Volume",isbn_print:"Print ISBN",character:"Character",manufacturer:"Manufacturer",product_line:"Product line",height_mm_approx:"Approximate height",scale:"Scale"},
  missing:"Specifications without verified data are omitted. Dimensions, materials and further details will appear when available.",
  description:"Product description",noDescription:"Product description has not been updated.",
  shipping:[["Delivery method","The delivery method shown at Checkout applies. Delivery information and fees are confirmed during checkout."],["Shipping fee","Fees follow the current Checkout configuration. This is an illustrative course-project fee, not a carrier quotation."],["Returns","The returns policy is being updated. No return period or refund terms have been published for this project."]],
  authenticity:[["Product transparency","Products are presented using their names, editions and available catalog information. Unverified details are not treated as official specifications."],["Origin information","Publisher or manufacturer details are shown when supported by checked catalog data. This information does not replace proof of origin for an individual item."],["Verification limits","The project has not published distribution certificates or a commercial authenticity guarantee. Any guarantee must be confirmed by the project owner before commercial use."]],
 }
} as const;
export function specifications(p:Product, language:"vi"|"en") {
 const labels=copy[language].labels;
 const rows:[string,string][]=[];
 const add=(key:keyof typeof labels,value:unknown)=>{if(value!==null&&value!==undefined&&String(value).trim()) rows.push([labels[key],String(value)]);};
 add("name",p.name);add("category",p.category);add("series",p.series);add("sku",p.api?.sku);
 const api=p.api;
 const entry=api ? (verified as Record<string,typeof verified[keyof typeof verified]>)[api.sku] : undefined;
 const matches=entry&&api&&entry.slug===api.slug&&entry.name_vi===api.name_vi&&entry.name_en===api.name_en&&entry.description_vi===api.description_vi&&entry.description_en===api.description_en&&entry.category_slug===api.category?.slug&&entry.series_slug===api.series?.slug;
 if(matches){
  const facts=entry.facts as Record<string,unknown>;
  const keys=(p.categoryKey==="figures"?["character","manufacturer","product_line","height_mm_approx","scale"]:["author","publisher","language",...(p.categoryKey==="manga"?["volume"]:[]),"isbn_print"]) as (keyof typeof labels)[];
  for(const key of keys){let value=facts[key];
   if(key==="language")value=value==="vi"?(language==="vi"?"Tiếng Việt":"Vietnamese"):value==="en"?(language==="vi"?"Tiếng Anh":"English"):null;
   if(key==="height_mm_approx"&&typeof value==="number")value=`${value} mm`;
   if(key==="scale"&&value==="non-scale")value=language==="vi"?"Không theo tỷ lệ":"Non-scale";
   add(key,value);
  }
 }
 return rows;
}
