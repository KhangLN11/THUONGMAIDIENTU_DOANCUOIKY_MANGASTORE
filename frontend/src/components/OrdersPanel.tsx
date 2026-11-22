import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../i18n";
import { AuthError } from "../services/authService";
import {
  getOrders,
  getOrder,
  cancelOrder,
  type OrderSummary,
  type Order,
} from "../services/orderService";
export function OrdersPanel({ onChanged }: { onChanged: () => void }) {
  const { user } = useAuth();
  const { t, language, formatDate, formatCurrency } = useI18n();
  const money = (n: number) => formatCurrency(n, "VND");
  const [rows, setRows] = useState<OrderSummary[]>([]),
    [selected, setSelected] = useState<Order | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setSelected(null);
    setLoading(true);
    setError(null);
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    void getOrders()
      .then((r) => {
        if (active) setRows(r);
      })
      .catch((e) => {
        if (active) setError(e instanceof AuthError ? e.code : "NETWORK_ERROR");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id, attempt]);
  async function open(id: number) {
    setBusy(true);
    setError(null);
    try {
      setSelected(await getOrder(id));
    } catch (e) {
      setError(e instanceof AuthError ? e.code : "NETWORK_ERROR");
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await cancelOrder(selected.id);
      setSelected(result);
      setRows((r) => r.map((o) => (o.id === result.id ? { ...o, status: result.status } : o)));
      onChanged();
    } catch (e) {
      setError(e instanceof AuthError ? e.code : "NETWORK_ERROR");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div data-product-text data-order-history>
      <h3>{t("ORDER HISTORY")}</h3>
      {loading ? (
        <p role="status">{t("order.loading")}</p>
      ) : error ? (
        <div role="alert">
          <p>{t("order.error." + error)}</p>
          <button onClick={() => setAttempt((x) => x + 1)}>{t("TRY AGAIN")}</button>
        </div>
      ) : null}
      {!loading && !error && !rows.length && <p>{t("order.empty")}</p>}
      {selected ? (
        <div data-order-detail={selected.id}>
          <button onClick={() => setSelected(null)}>{t("order.back")}</button>
          <h3 className="break-all">{selected.order_code}</h3>
          <p>
            {t("order.status." + selected.status)} /{" "}
            {formatDate(selected.created_at.replace(" ", "T"))}
          </p>
          {selected.items.map((i, index) => (
            <div className="order" key={index}>
              <div>× {i.quantity}</div>
              <div>
                <small>{i.sku_snapshot}</small>
                <h4>{language === "vi" ? i.name_vi_snapshot : i.name_en_snapshot}</h4>
                <p>{money(i.unit_price_vnd)}</p>
                <p>
                  {t("TOTAL")}: {money(i.line_total_vnd)}
                </p>
              </div>
            </div>
          ))}
          <p>
            {selected.recipient_name} / {selected.recipient_phone}
          </p>
          <p>
            {[selected.address_line, selected.ward, selected.district, selected.province]
              .filter(Boolean)
              .join(", ")}
          </p>
          <p>{selected.customer_note}</p>
          <p>
            {t("order.cod")} —{" "}
            {t(selected.payment_status === "paid" ? "order.paid" : "order.unpaid")}
          </p>
          <p>
            {t("SHIPPING")}: {money(selected.shipping_fee_vnd)}
          </p>
          <h3>
            {t("TOTAL")}: {money(selected.total_vnd)}
          </h3>
          {selected.status === "pending" && (
            <button className="ink-btn ink-btn-ghost" disabled={busy} onClick={() => void cancel()}>
              {t("order.cancel")}
            </button>
          )}
        </div>
      ) : (
        rows.map((o) => (
          <div className="order" key={o.id}>
            <div>#{o.id}</div>
            <div>
              <h4 className="break-all">{o.order_code}</h4>
              <p>{formatDate(o.created_at.replace(" ", "T"))}</p>
              <small>{t("order.status." + o.status)}</small>
              <p>{money(o.total_vnd)}</p>
              <button disabled={busy} onClick={() => void open(o.id)}>
                {t("order.view")}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
