import type { ShippingFields } from "./CheckoutView";
// Short-lived, account-bound memory only. No address, payment data or credentials in browser storage.
let draft: { owner: number; source: string; fields: ShippingFields; expires: number } | null = null;
export function rememberCheckoutDraft(owner: number, source: string, fields: ShippingFields) {
  draft = { owner, source, fields: { ...fields }, expires: Date.now() + 15 * 60 * 1000 };
}
export function takeCheckoutDraft(owner: number, source: string): ShippingFields | null {
  if (!draft) return null;
  if (draft.owner !== owner || draft.expires < Date.now()) {
    draft = null;
    return null;
  }
  if (draft.source !== source) return null;
  const fields = draft.fields;
  draft = null;
  return fields;
}
export function discardOtherCheckoutDraft(owner: number) {
  if (draft && draft.owner !== owner) draft = null;
}
