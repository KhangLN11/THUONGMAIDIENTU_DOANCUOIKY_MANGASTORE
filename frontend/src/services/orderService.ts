import { sessionRequest, AuthError } from "./authService";
export type QuoteItem = {
  product_id: number;
  sku: string;
  name_vi: string;
  name_en: string;
  quantity: number;
  unit_price_vnd: number;
  line_total_vnd: number;
};
export type Quote = {
  items: QuoteItem[];
  subtotal_vnd: number;
  shipping_fee_vnd: number;
  discount_vnd: number;
  total_vnd: number;
  quote_fingerprint: string;
};
export type CheckoutSource = { mode: "buy_now"; product_id: number; quantity: number };
export type CheckoutInput = {
  mode?: "buy_now";
  product_id?: number;
  quantity?: number;
  idempotency_key: string;
  quote_fingerprint: string;
  recipient_name: string;
  recipient_phone: string;
  province: string;
  district: string | null;
  ward: string;
  address_line: string;
  customer_note: string | null;
  payment_method: "cod";
};
export type OrderItem = {
  product_id: number | null;
  sku_snapshot: string;
  name_vi_snapshot: string;
  name_en_snapshot: string;
  unit_price_vnd: number;
  quantity: number;
  line_total_vnd: number;
};
export type OrderSummary = {
  id: number;
  order_code: string;
  status: string;
  total_vnd: number;
  created_at: string;
};
export type Order = OrderSummary & {
  recipient_name: string;
  recipient_phone: string;
  province: string;
  district: string | null;
  ward: string | null;
  address_line: string;
  customer_note: string | null;
  subtotal_vnd: number;
  shipping_fee_vnd: number;
  discount_vnd: number;
  payment_method: string | null;
  payment_status: string | null;
  paid_at: string | null;
  shipment_status: string | null;
  items: OrderItem[];
};
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new AuthError("INVALID_RESPONSE");
  return v as Record<string, unknown>;
}
function str(v: unknown): string {
  if (typeof v !== "string") throw new AuthError("INVALID_RESPONSE");
  return v;
}
function num(v: unknown): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0)
    throw new AuthError("INVALID_RESPONSE");
  return v;
}
function nullable(v: unknown): string | null {
  return v === null ? null : str(v);
}
function summary(v: unknown): OrderSummary {
  const o = obj(v);
  return {
    id: num(o.id),
    order_code: str(o.order_code),
    status: str(o.status),
    total_vnd: num(o.total_vnd),
    created_at: str(o.created_at),
  };
}
function order(v: unknown): Order {
  const o = obj(v);
  if (!Array.isArray(o.items)) throw new AuthError("INVALID_RESPONSE");
  return {
    ...summary(o),
    recipient_name: str(o.recipient_name),
    recipient_phone: str(o.recipient_phone),
    province: str(o.province),
    district: nullable(o.district),
    ward: nullable(o.ward),
    address_line: str(o.address_line),
    customer_note: nullable(o.customer_note),
    subtotal_vnd: num(o.subtotal_vnd),
    shipping_fee_vnd: num(o.shipping_fee_vnd),
    discount_vnd: num(o.discount_vnd),
    payment_method: nullable(o.payment_method),
    payment_status: nullable(o.payment_status),
    paid_at: nullable(o.paid_at),
    shipment_status: nullable(o.shipment_status),
    items: o.items.map((v) => {
      const i = obj(v);
      return {
        product_id: i.product_id === null ? null : num(i.product_id),
        sku_snapshot: str(i.sku_snapshot),
        name_vi_snapshot: str(i.name_vi_snapshot),
        name_en_snapshot: str(i.name_en_snapshot),
        unit_price_vnd: num(i.unit_price_vnd),
        quantity: num(i.quantity),
        line_total_vnd: num(i.line_total_vnd),
      };
    }),
  };
}
export async function getQuote(source?: CheckoutSource): Promise<Quote> {
  const query = source
    ? "?" +
      new URLSearchParams({
        mode: source.mode,
        product_id: String(source.product_id),
        quantity: String(source.quantity),
      })
    : "";
  const o = obj(obj(await sessionRequest("orders/quote.php" + query)).data);
  if (!Array.isArray(o.items)) throw new AuthError("INVALID_RESPONSE");
  return {
    items: o.items.map((v) => {
      const i = obj(v);
      return {
        product_id: num(i.product_id),
        sku: str(i.sku),
        name_vi: str(i.name_vi),
        name_en: str(i.name_en),
        quantity: num(i.quantity),
        unit_price_vnd: num(i.unit_price_vnd),
        line_total_vnd: num(i.line_total_vnd),
      };
    }),
    subtotal_vnd: num(o.subtotal_vnd),
    shipping_fee_vnd: num(o.shipping_fee_vnd),
    discount_vnd: num(o.discount_vnd),
    total_vnd: num(o.total_vnd),
    quote_fingerprint: str(o.quote_fingerprint),
  };
}
export async function createOrder(input: CheckoutInput): Promise<Order> {
  return order(obj(await sessionRequest("orders/create.php", input)).data);
}
export async function getOrders(): Promise<OrderSummary[]> {
  const d = obj(await sessionRequest("orders/index.php")).data;
  if (!Array.isArray(d)) throw new AuthError("INVALID_RESPONSE");
  return d.map(summary);
}
export async function getOrder(id: number): Promise<Order> {
  return order(obj(await sessionRequest("orders/detail.php?id=" + id)).data);
}
export async function recoverOrder(key: string): Promise<Order> {
  return order(
    obj(await sessionRequest("orders/detail.php?checkout_key=" + encodeURIComponent(key))).data,
  );
}
export async function cancelOrder(id: number): Promise<Order> {
  return order(obj(await sessionRequest("orders/cancel.php", { order_id: id })).data);
}

// Reuse the same order snapshot validator in the separately authorized admin API.
export { order as parseOrder };
