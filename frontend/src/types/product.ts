export interface ApiProduct {
  id: number;
  sku: string;
  slug: string;
  name_vi: string;
  name_en: string;
  description_vi: string | null;
  description_en: string | null;
  price_vnd: number;
  sale_price_vnd: number | null;
  stock_quantity: number;
  category: { id: number; slug: string; name_vi: string; name_en: string } | null;
  series: { id: number; slug: string; title: string } | null;
  image_url: string | null;
}

export interface Product {
  id: number;
  name: string;
  series: string;
  price: number;
  category: string;
  badge?: string;
  image: string;
  source?: "api";
  api?: ApiProduct;
  description?: string;
  stockQuantity?: number;
  originalPrice?: number;
  categoryKey?: string;
}

export interface ProductsResponse {
  success: true;
  data: ApiProduct[];
  meta: { total: number };
}
export interface ProductResponse { success: true; data: ApiProduct }
export interface ApiFailure { success: false; error: { code: string; message: string } }
