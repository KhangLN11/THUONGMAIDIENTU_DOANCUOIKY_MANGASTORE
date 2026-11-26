import {
  getAccountOrders,
  type AccountOrderPage,
  type AccountOrderState,
} from "../account/accountService";
import { accountRoute, accountHref, navigateAccount } from "../account/routes";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../i18n";
import { AuthError } from "../services/authService";
import {
  getOrders,
  getOrder,
  cancelOrder,
  type Order,
  type OrderSummary,
} from "../services/orderService";
import { OrderSummary as OrderSummaryView, OrderReceipt } from "../checkout/CheckoutView";
export function OrdersPanel({
  onChanged,
  accountNavigation = false,
  onAccountState,
}: {
  onChanged: () => void;
  accountNavigation?: boolean;
  onAccountState?: (state: AccountOrderState) => void;
}) {
  const { user, refresh } = useAuth();
  const { t, language, formatDate, formatCurrency } = useI18n();
  const money = (v: number) => formatCurrency(v, "VND");
  const [rows, setRows] = useState<OrderSummary[]>([]),
    [selected, setSelected] = useState<Order | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [attempt, setAttempt] = useState(0),
    [localFilter, setLocalFilter] = useState("all");
  const [route, setRoute] = useState(accountRoute),
    [pageData, setPageData] = useState<AccountOrderPage | null>(null);
  const filter = accountNavigation ? route.status : localFilter;
  const setFilter = (status: string) =>
    accountNavigation
      ? navigateAccount(accountHref(route.view, null, status, 1))
      : setLocalFilter(status);
  useEffect(() => {
    if (!accountNavigation) return;
    const update = () => setRoute(accountRoute());
    addEventListener("hashchange", update);
    addEventListener("popstate", update);
    return () => {
      removeEventListener("hashchange", update);
      removeEventListener("popstate", update);
    };
  }, [accountNavigation]);
  const generation = useRef(0);
  useEffect(() => {
    const epoch = ++generation.current;
    setRows([]);
    setSelected(null);
    setError(null);
    setLoading(true);
    setBusy(false);
    onAccountState?.({
      loading: true,
      error: null,
      counts: pageData?.counts ?? null,
      total: pageData?.total_orders ?? null,
    });
    if (!user) {
      setPageData(null);
      setLoading(false);
      return;
    }
    void (async () => {
      if (accountNavigation) {
        const data = await getAccountOrders(route.status, route.page);
        if (generation.current !== epoch) return;
        setRows(data.items);
        setPageData(data);
        onAccountState?.({
          loading: false,
          error: null,
          counts: data.counts,
          total: data.total_orders,
        });
        if (data.page !== route.page) {
          navigateAccount(accountHref(route.view, route.id, route.status, data.page), true);
          return;
        }
      } else {
        const list = await getOrders();
        if (generation.current !== epoch) return;
        setRows(list);
      }
      const key = "manga-track-order-" + user.id,
        saved = sessionStorage.getItem(key);
      let id = accountNavigation ? route.id : null;
      if (saved && /^[1-9][0-9]{0,14}$/.test(saved)) {
        sessionStorage.removeItem(key);
        if (accountNavigation) {
          navigateAccount(accountHref("orders", Number(saved), route.status, route.page));
          return;
        }
        id = Number(saved);
      }
      if (id) {
        const detail = await getOrder(id);
        if (generation.current === epoch) setSelected(detail);
      }
    })()
      .catch((e) => {
        if (generation.current === epoch) {
          const code = e instanceof AuthError ? e.code : "NETWORK_ERROR";
          if (e instanceof AuthError && (e.status === 401 || e.status === 403)) void refresh();
          setError(code);
          onAccountState?.({ loading: false, error: code, counts: null, total: null });
        }
      })
      .finally(() => {
        if (generation.current === epoch) setLoading(false);
      });
    return () => {
      generation.current++;
    };
  }, [user?.id, attempt, accountNavigation, route.status, route.page, route.id]);
  async function open(id: number) {
    if (accountNavigation && route.id !== id) {
      navigateAccount(accountHref("orders", id, route.status, route.page));
      return;
    }
    const epoch = generation.current;
    setBusy(true);
    setError(null);
    try {
      const detail = await getOrder(id);
      if (generation.current === epoch) setSelected(detail);
    } catch (e) {
      if (generation.current === epoch) {
        setError(e instanceof AuthError ? e.code : "NETWORK_ERROR");
        if (e instanceof AuthError && (e.status === 401 || e.status === 403)) void refresh();
      }
    } finally {
      if (generation.current === epoch) setBusy(false);
    }
  }
  async function cancel() {
    if (!selected || busy) return;
    const epoch = generation.current;
    setBusy(true);
    setError(null);
    try {
      const detail = await cancelOrder(selected.id);
      if (generation.current === epoch) {
        setSelected(detail);
        setRows((r) =>
          r.map((o) =>
            o.id === detail.id
              ? { ...o, status: detail.status, payment_status: detail.payment_status }
              : o,
          ),
        );
        onChanged();
        if (accountNavigation) setAttempt((a) => a + 1);
      }
    } catch (e) {
      if (generation.current === epoch) {
        setError(e instanceof AuthError ? e.code : "NETWORK_ERROR");
        if (e instanceof AuthError && (e.status === 401 || e.status === 403)) void refresh();
      }
    } finally {
      if (generation.current === epoch) setBusy(false);
    }
  }
  const visible = accountNavigation
    ? rows
    : rows.filter((o) => filter === "all" || o.status === filter);
  const count = (status: string) =>
    accountNavigation
      ? pageData
        ? status === "all"
          ? pageData.total_orders
          : pageData.counts[status as keyof typeof pageData.counts]
        : "…"
      : rows.filter((o) => status === "all" || o.status === status).length;
  return (
    <div className="mu-orders" data-product-text data-order-history aria-busy={loading}>
      <h2>{t("account14.history")}</h2>
      {loading && <p role="status">{t("order.loading")}</p>}
      {error && (
        <div className="checkout-error" role="alert">
          <p>{t("order.error." + error)}</p>
          <button onClick={() => setAttempt((x) => x + 1)}>{t("TRY AGAIN")}</button>
        </div>
      )}
      {!loading &&
        !error &&
        !rows.length &&
        (!accountNavigation || pageData?.total_orders === 0) && <p>{t("order.empty")}</p>}
      {selected ? (
        <div className="history-detail" data-order-detail={selected.id}>
          <button
            className="checkout-button secondary"
            onClick={() =>
              accountNavigation
                ? navigateAccount(accountHref("orders", null, route.status, route.page))
                : setSelected(null)
            }
          >
            {t("order.back")}
          </button>
          <button
            className="checkout-button secondary"
            disabled={busy}
            onClick={() => void open(selected.id)}
          >
            {t("admin.refresh")}
          </button>
          <OrderReceipt order={selected} />
          <section className="checkout-summary">
            <OrderSummaryView
              items={selected.items.map((i) => ({
                id: i.product_id,
                name: language === "vi" ? i.name_vi_snapshot : i.name_en_snapshot,
                quantity: i.quantity,
                unit: i.unit_price_vnd,
                total: i.line_total_vnd,
                image: i.image_url,
              }))}
              subtotal={selected.subtotal_vnd}
              shipping={selected.shipping_fee_vnd}
              total={selected.total_vnd}
            />
          </section>
          {selected.status === "pending" && selected.payment_status === "pending" && (
            <div className="checkout-actions">
              <button
                className="ink-btn ink-btn-ghost checkout-button"
                disabled={busy}
                onClick={() => void cancel()}
              >
                {t("order.cancel")}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="history-filters">
            {[
              "all",
              "pending",
              "confirmed",
              "processing",
              "shipping",
              "delivered",
              "cancelled",
            ].map((status) => (
              <button
                type="button"
                className={filter === status ? "active" : ""}
                aria-pressed={filter === status}
                onClick={() => setFilter(status)}
                key={status}
              >
                {t(status === "all" ? "checkout.allOrders" : "order.status." + status)} (
                {count(status)})
              </button>
            ))}
          </div>
          {!accountNavigation && rows.length >= 100 && <p>{t("checkout.recentOrders")}</p>}
          {visible.map((o) => (
            <article className="order history-row" key={o.id} data-order-status={o.status}>
              <div>
                <small>{t("checkout.orderCode")}</small>
                <h4>{o.order_code}</h4>
                <p>{formatDate(o.created_at.replace(" ", "T"))}</p>
              </div>
              <div>
                <small>{t("checkout.total")}</small>
                <b>{money(o.total_vnd)}</b>
              </div>
              <div>
                <small>{t("checkout.orderStatus")}</small>
                <p>{t("order.status." + o.status)}</p>
              </div>
              <div>
                <small>{t("admin.paymentStatus")}</small>
                <p>{t("checkout.status." + o.payment_status)}</p>
              </div>
              <button
                className="checkout-button secondary"
                disabled={busy}
                onClick={() => void open(o.id)}
              >
                {t("order.view")}
              </button>
            </article>
          ))}
          {!loading &&
            !error &&
            ((accountNavigation && pageData?.total === 0 && pageData.total_orders > 0) ||
              (!accountNavigation && rows.length > 0 && !visible.length)) && (
              <p>{t("checkout.noOrdersFilter")}</p>
            )}
          {accountNavigation && pageData && pageData.pages > 1 && (
            <nav className="account-pagination" aria-label={t("account14.pagination")}>
              <button
                disabled={loading || pageData.page <= 1}
                onClick={() =>
                  navigateAccount(accountHref(route.view, null, filter, pageData.page - 1))
                }
              >
                {t("account14.previous")}
              </button>
              <span>
                {pageData.page} / {pageData.pages} · {pageData.total} {t("account14.ordersCount")}
              </span>
              <button
                disabled={loading || pageData.page >= pageData.pages}
                onClick={() =>
                  navigateAccount(accountHref(route.view, null, filter, pageData.page + 1))
                }
              >
                {t("account14.next")}
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
