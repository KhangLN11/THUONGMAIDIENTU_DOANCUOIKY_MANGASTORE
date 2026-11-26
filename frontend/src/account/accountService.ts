import { sessionRequest, AuthError } from "../services/authService";
import type { OrderSummary } from "../services/orderService";
import { orderStatuses, type OrderStatus } from "./routes";
export type AccountOrderCounts = Record<OrderStatus, number>;
export type AccountOrderPage = {
  items: OrderSummary[];
  counts: AccountOrderCounts;
  total_orders: number;
  total: number;
  page: number;
  pages: number;
  page_size: number;
};
export type AccountOrderState = {
  loading: boolean;
  error: string | null;
  counts: AccountOrderCounts | null;
  total: number | null;
};
const obj = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new AuthError("INVALID_RESPONSE");
  return v as Record<string, unknown>;
};
const num = (v: unknown): number => {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0)
    throw new AuthError("INVALID_RESPONSE");
  return v;
};
const str = (v: unknown): string => {
  if (typeof v !== "string") throw new AuthError("INVALID_RESPONSE");
  return v;
};
export async function getAccountOrders(status = "all", page = 1): Promise<AccountOrderPage> {
  const d = obj(
      obj(
        await sessionRequest(
          "orders/index.php?" +
            new URLSearchParams({ view: "account", status, page: String(page), per_page: "10" }),
        ),
      ).data,
    ),
    c = obj(d.counts);
  if (!Array.isArray(d.items)) throw new AuthError("INVALID_RESPONSE");
  return {
    items: d.items.map((v) => {
      const o = obj(v);
      return {
        id: num(o.id),
        order_code: str(o.order_code),
        status: str(o.status),
        total_vnd: num(o.total_vnd),
        created_at: str(o.created_at),
        payment_method: o.payment_method === null ? null : str(o.payment_method),
        payment_status: o.payment_status === null ? null : str(o.payment_status),
      };
    }),
    counts: Object.fromEntries(orderStatuses.map((k) => [k, num(c[k])])) as AccountOrderCounts,
    total_orders: num(d.total_orders),
    total: num(d.total),
    page: num(d.page),
    pages: num(d.pages),
    page_size: num(d.page_size),
  };
}
