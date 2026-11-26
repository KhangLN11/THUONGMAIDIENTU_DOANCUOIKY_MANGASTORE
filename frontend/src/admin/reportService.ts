import { AuthError, sessionRequest } from "../services/authService";
export type ReportFilter = { preset: string; start: string; end: string; group: string };
export type Overview = {
  total_orders: number;
  pending_orders: number;
  processing_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_customers: number;
  active_products: number;
  low_stock: number;
  sold_quantity: number;
  collected_orders: number;
  collected_cod_vnd: string;
  collected_bank_vnd: string;
  collected_total_vnd: string;
  created_order_value_vnd: string;
  average_order_vnd: string;
  average_collected_vnd: string;
};
export type RevenueRow = {
  bucket: string;
  total_orders: number;
  collected_orders: number;
  created_order_value_vnd: string;
  collected_cod_vnd: string;
  collected_bank_vnd: string;
  collected_total_vnd: string;
  average_order_vnd: string;
};
export type ProductRow = {
  product_id: number | null;
  sku: string;
  name_vi: string;
  name_en: string;
  sold_quantity: number;
  sales_value_vnd: string;
};
export type CategoryRow = {
  category_id: number | null;
  slug: string;
  name_vi: string;
  name_en: string;
  sold_quantity: number;
  sales_value_vnd: string;
};
export type Report = {
  period: {
    start: string;
    end: string;
    end_exclusive: string;
    timezone: string;
    group: string;
    simulation: boolean;
  };
  overview: Overview;
  revenue: RevenueRow[];
  statuses: { status: string; total_orders: number }[];
  products: ProductRow[];
  categories: CategoryRow[];
};
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new AuthError("INVALID_RESPONSE");
  return v as Record<string, unknown>;
};
const text = (v: unknown): string => {
  if (typeof v !== "string") throw new AuthError("INVALID_RESPONSE");
  return v;
};
const integer = (v: unknown): number => {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0)
    throw new AuthError("INVALID_RESPONSE");
  return v;
};
const money = (v: unknown): string => {
  const s = text(v);
  if (!/^[0-9]+$/.test(s)) throw new AuthError("INVALID_RESPONSE");
  return s;
};
const array = (v: unknown): unknown[] => {
  if (!Array.isArray(v)) throw new AuthError("INVALID_RESPONSE");
  return v;
};
export function reportQuery(f: ReportFilter): URLSearchParams {
  const p = new URLSearchParams({ preset: f.preset, group: f.group });
  if (f.preset === "custom") {
    p.set("start", f.start);
    p.set("end", f.end);
  }
  return p;
}
function denied(e: unknown) {
  if (e instanceof AuthError && (e.status === 401 || e.code === "FORBIDDEN"))
    window.dispatchEvent(new Event("manga-admin-auth-invalid"));
}
export async function getReport(f: ReportFilter): Promise<Report> {
  try {
    const d = record(
        record(await sessionRequest("admin/reports/overview.php?" + reportQuery(f))).data,
      ),
      o = record(d.overview),
      p = record(d.period);
    return {
      period: {
        start: text(p.start),
        end: text(p.end),
        end_exclusive: text(p.end_exclusive),
        timezone: text(p.timezone),
        group: text(p.group),
        simulation: p.simulation === true,
      },
      overview: {
        total_orders: integer(o.total_orders),
        pending_orders: integer(o.pending_orders),
        processing_orders: integer(o.processing_orders),
        completed_orders: integer(o.completed_orders),
        cancelled_orders: integer(o.cancelled_orders),
        total_customers: integer(o.total_customers),
        active_products: integer(o.active_products),
        low_stock: integer(o.low_stock),
        sold_quantity: integer(o.sold_quantity),
        collected_orders: integer(o.collected_orders),
        collected_cod_vnd: money(o.collected_cod_vnd),
        collected_bank_vnd: money(o.collected_bank_vnd),
        collected_total_vnd: money(o.collected_total_vnd),
        created_order_value_vnd: money(o.created_order_value_vnd),
        average_order_vnd: money(o.average_order_vnd),
        average_collected_vnd: money(o.average_collected_vnd),
      },
      revenue: array(d.revenue).map((v) => {
        const r = record(v);
        return {
          bucket: text(r.bucket),
          total_orders: integer(r.total_orders),
          collected_orders: integer(r.collected_orders),
          created_order_value_vnd: money(r.created_order_value_vnd),
          collected_cod_vnd: money(r.collected_cod_vnd),
          collected_bank_vnd: money(r.collected_bank_vnd),
          collected_total_vnd: money(r.collected_total_vnd),
          average_order_vnd: money(r.average_order_vnd),
        };
      }),
      statuses: array(d.statuses).map((v) => {
        const r = record(v);
        return { status: text(r.status), total_orders: integer(r.total_orders) };
      }),
      products: array(d.products).map((v) => {
        const r = record(v);
        return {
          product_id: r.product_id === null ? null : integer(r.product_id),
          sku: text(r.sku),
          name_vi: text(r.name_vi),
          name_en: text(r.name_en),
          sold_quantity: integer(r.sold_quantity),
          sales_value_vnd: money(r.sales_value_vnd),
        };
      }),
      categories: array(d.categories).map((v) => {
        const r = record(v);
        return {
          category_id: r.category_id === null ? null : integer(r.category_id),
          slug: text(r.slug),
          name_vi: text(r.name_vi),
          name_en: text(r.name_en),
          sold_quantity: integer(r.sold_quantity),
          sales_value_vnd: money(r.sales_value_vnd),
        };
      }),
    };
  } catch (e) {
    denied(e);
    throw e;
  }
}
export async function downloadReport(
  f: ReportFilter,
  type: string,
  language: string,
): Promise<void> {
  const q = reportQuery(f);
  q.set("type", type);
  q.set("language", language);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30000);
  try {
    const base = (import.meta.env.VITE_AUTH_API_BASE_URL || "/api").replace(/\/$/, "");
    const response = await fetch(`${base}/admin/reports/export.php?${q}`, {
      credentials: "same-origin",
      signal: controller.signal,
    });
    if (!response.ok) {
      const raw: unknown = await response.json();
      const e = record(record(raw).error);
      throw new AuthError(text(e.code), response.status);
    }
    if (!response.headers.get("Content-Type")?.startsWith("text/csv"))
      throw new AuthError("INVALID_RESPONSE");
    const blob = await response.blob(),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `manga-${type}-${f.preset}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    denied(e);
    if (e instanceof AuthError) throw e;
    throw new AuthError("NETWORK_ERROR");
  } finally {
    window.clearTimeout(timeout);
  }
}
