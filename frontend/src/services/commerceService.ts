import type { ApiProduct } from "../types/product";
import { parseProduct } from "./productService";
import { AuthError, sessionRequest } from "./authService";
export type CartLine = { product_id: number; quantity: number; product: ApiProduct | null; name_vi: string; name_en: string; unit_price_vnd: number; line_total_vnd: number; available: boolean };
export type ServerCart = { items: CartLine[]; subtotal_vnd: number; total_quantity: number };
export type CommerceData = { cart: ServerCart; wishlist: number[]; context: string };
export type MergePlan = { userId: number; context: string; operation_key: string; items: { product_id: number; quantity: number }[]; wishlist: number[] };
function obj(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new AuthError("INVALID_RESPONSE"); return value as Record<string, unknown>; }
function num(value: unknown, min = 0): number { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min) throw new AuthError("INVALID_RESPONSE"); return value; }
function str(value: unknown): string { if (typeof value !== "string") throw new AuthError("INVALID_RESPONSE"); return value; }
function cart(value: unknown): ServerCart {
  const c = obj(value); if (!Array.isArray(c.items) || c.currency !== "VND") throw new AuthError("INVALID_RESPONSE");
  return { subtotal_vnd: num(c.subtotal_vnd), total_quantity: num(c.total_quantity), items: c.items.map(value => {
    const row = obj(value); if (typeof row.available !== "boolean") throw new AuthError("INVALID_RESPONSE");
    return { product_id: num(row.product_id, 1), quantity: num(row.quantity, 1), product: row.product === null ? null : parseProduct(row.product), name_vi: str(row.name_vi), name_en: str(row.name_en), unit_price_vnd: num(row.unit_price_vnd), line_total_vnd: num(row.line_total_vnd), available: row.available };
  }) };
}
function wishes(value: unknown): number[] { const w = obj(value); if (!Array.isArray(w.product_ids)) throw new AuthError("INVALID_RESPONSE"); return w.product_ids.map(id => num(id, 1)); }
function response(value: unknown): CommerceData { const root = obj(value), data = obj(root.data); return { cart: cart(data.cart), wishlist: wishes(data.wishlist), context: str(obj(root.meta).merge_context) }; }
export async function loadCommerce(): Promise<CommerceData> {
  const [c,w] = await Promise.all([sessionRequest("cart.php"),sessionRequest("wishlist.php")]);
  const cr = obj(c), wr = obj(w);
  return { cart: cart(cr.data), wishlist: wishes(wr.data), context: str(obj(cr.meta).merge_context) };
}
export async function mutateCommerce(path: string, input: unknown): Promise<CommerceData> { return response(await sessionRequest(path, input)); }
export function mergeGuest(plan: MergePlan): Promise<CommerceData> {
  return mutateCommerce("cart/merge.php", { context: plan.context, operation_key: plan.operation_key, items: plan.items, wishlist: plan.wishlist });
}
