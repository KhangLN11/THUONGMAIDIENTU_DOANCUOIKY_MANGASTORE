import type { Language } from "../i18n";
import type { ApiProduct, Product } from "../types/product";

export const PRODUCT_PLACEHOLDER = "/product-placeholder.svg";

export function adaptProduct(product: ApiProduct, language: Language): Product {
  const name = language === "vi" ? product.name_vi : product.name_en;
  const gallery = [...(product.images ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .map(image => ({
      id: image.id,
      image: image.image_url || PRODUCT_PLACEHOLDER,
      alt: (language === "vi" ? image.alt_vi : image.alt_en) || name,
      sortOrder: image.sort_order,
      isPrimary: image.is_primary,
    }));
  return {
    id: product.id,
    name,
    gallery,
    description: (language === "vi" ? product.description_vi : product.description_en) ?? "",
    series: product.series?.title ?? "",
    price: product.sale_price_vnd ?? product.price_vnd,
    originalPrice: product.sale_price_vnd !== null ? product.price_vnd : undefined,
    category: product.category ? (language === "vi" ? product.category.name_vi : product.category.name_en) : "",
    categoryKey: product.category?.slug ?? "uncategorized",
    image: product.image_url || PRODUCT_PLACEHOLDER,
    stockQuantity: product.stock_quantity,
    source: "api",
    api: product,
  };
}

export function localizeProduct(product: Product, language: Language): Product {
  return product.source === "api" && product.api ? adaptProduct(product.api, language) : product;
}
