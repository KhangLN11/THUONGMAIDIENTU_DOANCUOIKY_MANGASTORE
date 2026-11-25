import { USE_PRODUCTS_API } from "../config/products";
export type BuyNowIntent = { productId: number; quantity: number; mode: "api" | "demo" };
export const buyMode = USE_PRODUCTS_API ? "api" : "demo";
const key = "manga-buy-now-" + buyMode;
export function readBuyNowIntent(): BuyNowIntent | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const p = value as Record<string, unknown>;
    if (
      Object.keys(p).some((k) => !["productId", "quantity", "mode"].includes(k)) ||
      p.mode !== buyMode ||
      typeof p.quantity !== "number" ||
      !Number.isInteger(p.quantity) ||
      p.quantity < 1 ||
      p.quantity > 999 ||
      typeof p.productId !== "number" ||
      !Number.isSafeInteger(p.productId) ||
      p.productId < 1
    )
      return null;
    return { productId: p.productId, quantity: p.quantity, mode: buyMode };
  } catch {
    return null;
  }
}
export function saveBuyNowIntent(productId: number, quantity = 1): BuyNowIntent {
  const intent: BuyNowIntent = { productId, quantity, mode: buyMode };
  try {
    sessionStorage.setItem(key, JSON.stringify(intent));
  } catch {
    /* Current React state still works; reload shows an expired intent safely. */
  }
  return intent;
}
export function clearBuyNowIntent() {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* Never touch commerce storage. */
  }
}
export const isBuyNowRoute = (hash: string) => hash.startsWith("#checkout/buy-now");
export function buyNowId(hash: string): number | null {
  const match = hash.match(/^#checkout\/buy-now\/([1-9][0-9]{0,14})$/);
  return match && Number.isSafeInteger(Number(match[1])) ? Number(match[1]) : null;
}
