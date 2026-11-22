export interface ApiProductImage {
  id: number;
  image_url: string;
  alt_vi: string | null;
  alt_en: string | null;
  sort_order: number;
  is_primary: boolean;
}

export interface ProductGalleryImage {
  id: number;
  image: string;
  alt: string;
  sortOrder: number;
  isPrimary: boolean;
}

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
  series: { id: number; slug: string; title: string; description_vi?: string | null; description_en?: string | null; is_active?: boolean } | null;
  image_url: string | null;
  images?: ApiProductImage[];
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
  gallery?: ProductGalleryImage[];
}

export interface ProductsResponse {
  success: true;
  data: ApiProduct[];
  meta: { total: number };
}
export interface ProductResponse { success: true; data: ApiProduct }
export interface ApiFailure { success: false; error: { code: string; message: string } }
