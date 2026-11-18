import { PRODUCTS_API_BASE } from "../config/products";
import type { ApiProduct, ProductResponse, ProductsResponse } from "../types/product";

export class ProductApiError extends Error {
  constructor(public readonly code: string, public readonly status = 0) {
    super(code);
    this.name = "ProductApiError";
  }
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ProductApiError("INVALID_RESPONSE");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string") throw new ProductApiError("INVALID_RESPONSE");
  return value;
}
function nullableText(value: unknown): string | null { return value === null ? null : text(value); }
function integer(value: unknown, minimum = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) throw new ProductApiError("INVALID_RESPONSE");
  return value;
}
function parseProduct(value: unknown): ApiProduct {
  const p = object(value);
  const category = p.category === null ? null : object(p.category);
  const series = p.series === null ? null : object(p.series);
  return {
    id: integer(p.id, 1), sku: text(p.sku), slug: text(p.slug),
    name_vi: text(p.name_vi), name_en: text(p.name_en),
    description_vi: nullableText(p.description_vi), description_en: nullableText(p.description_en),
    price_vnd: integer(p.price_vnd), sale_price_vnd: p.sale_price_vnd === null ? null : integer(p.sale_price_vnd),
    stock_quantity: integer(p.stock_quantity), image_url: nullableText(p.image_url),
    category: category ? { id: integer(category.id, 1), slug: text(category.slug), name_vi: text(category.name_vi), name_en: text(category.name_en) } : null,
    series: series ? { id: integer(series.id, 1), slug: text(series.slug), title: text(series.title) } : null,
  };
}

async function request(endpoint: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 12000);
  try {
    const response = await fetch(`${PRODUCTS_API_BASE}/${endpoint}`, { signal: controller.signal, headers: { Accept: "application/json" } });
    let body: Record<string, unknown>;
    try { body = object(await response.json()); }
    catch { throw new ProductApiError(response.ok ? "INVALID_RESPONSE" : "HTTP_ERROR", response.status); }
    if (!response.ok || body.success !== true) {
      const error = typeof body.error === "object" && body.error !== null ? object(body.error) : null;
      throw new ProductApiError(typeof error?.code === "string" ? error.code : "HTTP_ERROR", response.status);
    }
    return body;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export async function getProducts(signal?: AbortSignal): Promise<ProductsResponse> {
  const body = await request("products.php", signal);
  if (!Array.isArray(body.data)) throw new ProductApiError("INVALID_RESPONSE");
  const data = body.data.map(parseProduct);
  const total = integer(object(body.meta).total);
  return { success: true, data, meta: { total } };
}

export async function getProduct(id: number, signal?: AbortSignal): Promise<ProductResponse> {
  if (!Number.isSafeInteger(id) || id < 1) throw new ProductApiError("INVALID_ID", 400);
  const body = await request(`product.php?id=${encodeURIComponent(id)}`, signal);
  const data = parseProduct(body.data);
  if (data.id !== id) throw new ProductApiError("INVALID_RESPONSE");
  return { success: true, data };
}
