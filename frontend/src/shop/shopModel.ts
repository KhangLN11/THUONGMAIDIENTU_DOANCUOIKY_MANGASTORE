import type { Product } from "../types/product";
export type ShopFilters = {
  query: string;
  category: string;
  series: string;
  min: string;
  max: string;
  stock: string;
  sort: string;
  page: number;
};
export const initialShopFilters: ShopFilters = {
  query: "",
  category: "all",
  series: "all",
  min: "",
  max: "",
  stock: "all",
  sort: "default",
  page: 1,
};
export const SHOP_PAGE_SIZE = 24;
export const foldShop = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
export const categoryOf = (p: Product) =>
  p.source === "api" ? (p.categoryKey ?? "uncategorized") : p.category;
export const seriesOf = (p: Product) =>
  p.source === "api" ? (p.api?.series?.slug ?? "none") : "demo:" + p.series;
export function validPriceRange(f: ShopFilters) {
  const min = f.min === "" ? 0 : Number(f.min),
    max = f.max === "" ? Infinity : Number(f.max);
  return (
    Number.isSafeInteger(min) &&
    min >= 0 &&
    min <= 99999999999999 &&
    (f.max === "" || (Number.isSafeInteger(max) && max >= 0 && max <= 99999999999999)) &&
    min <= max
  );
}
export function selectShopProducts(
  products: Product[],
  f: ShopFilters,
  language: string,
  translate: (value: string) => string,
) {
  if (!validPriceRange(f)) return [];
  const query = foldShop(f.query),
    min = f.min === "" ? 0 : Number(f.min),
    max = f.max === "" ? Infinity : Number(f.max);
  const result = products.filter((p) => {
    const search = [
      p.api?.name_vi,
      p.api?.name_en,
      p.api?.sku,
      p.name,
      p.source ? null : translate(p.name),
      p.series,
    ]
      .filter(Boolean)
      .join(" ");
    return (
      (!query || foldShop(search).includes(query)) &&
      (f.category === "all" || categoryOf(p) === f.category) &&
      (f.series === "all" || seriesOf(p) === f.series) &&
      p.price >= min &&
      p.price <= max &&
      (f.stock === "all" ||
        (p.source === "api" && (f.stock === "in" ? !!p.stockQuantity : p.stockQuantity === 0)))
    );
  });
  if (f.sort === "default") return result;
  return result.sort((a, b) => {
    let comparison = 0;
    if (f.sort === "newest") comparison = b.id - a.id;
    if (f.sort === "price_asc") comparison = a.price - b.price;
    if (f.sort === "price_desc") comparison = b.price - a.price;
    if (f.sort === "name")
      comparison = a.name.localeCompare(b.name, language === "vi" ? "vi-VN" : "en-US");
    return comparison || a.id - b.id;
  });
}

export function demoProductId(hash: string): number | null {
  const m = hash.match(/^#product\/demo\/([1-9][0-9]{0,14})$/);
  return m && Number.isSafeInteger(Number(m[1])) ? Number(m[1]) : null;
}
