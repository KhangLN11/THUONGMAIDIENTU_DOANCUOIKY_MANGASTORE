import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../i18n";
import {
  getQuote,
  createOrder,
  recoverOrder,
  type Quote,
  type Order,
  type CheckoutInput,
} from "../services/orderService";
import { AuthError } from "../services/authService";
import { ProductImage } from "./ProductImage";
import { PRODUCT_PLACEHOLDER } from "../adapters/productAdapter";
import type { Product } from "../types/product";
export function ApiCheckout({
  cart,
  pending,
  onHome,
  onAccount,
  onOrders,
  onPlaced,
}: {
  cart: Product[];
  pending: boolean;
  onHome: () => void;
  onAccount: () => void;
  onOrders: () => void;
  onPlaced: () => Promise<void>;
}) {
  const { user, loading: authLoading } = useAuth();
  const { t, language, formatCurrency } = useI18n();
  const money = (v: number) => formatCurrency(v, "VND");
  const [quote, setQuote] = useState<Quote | null>(null),
    [order, setOrder] = useState<Order | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [fields, setFields] = useState({
    recipient_name: "",
    recipient_phone: "",
    province: "",
    ward: "",
    address_line: "",
    customer_note: "",
  });
  const request = useRef<CheckoutInput | null>(null),
    inFlight = useRef(false),
    alive = useRef(true);
  const owner = user?.id;
  const storageKey = "manga-checkout-intent-" + owner;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (authLoading || pending || order) return;
    if (!user) {
      onAccount();
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void (async () => {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        if (!/^[a-f0-9]{32}$/.test(saved)) throw new AuthError("CHECKOUT_STORAGE");
        try {
          const existing = await recoverOrder(saved);
          if (active) {
            setOrder(existing);
            sessionStorage.removeItem(storageKey);
            await onPlaced();
          }
          return;
        } catch (e) {
          if (!(e instanceof AuthError) || e.status !== 404) throw e;
        }
      }
      const q = await getQuote();
      if (active) setQuote(q);
    })()
      .catch((e) => {
        if (active) setError(e instanceof AuthError ? e.code : "NETWORK_ERROR");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [owner, authLoading, pending, attempt, order]);
  async function finish(result: Order) {
    if (!alive.current) return;
    setOrder(result);
    request.current = null;
    sessionStorage.removeItem(storageKey);
    await onPlaced();
  }
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (inFlight.current || !user || !quote || order) return;
    setError(null);
    const normalized = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.trim()]));
    if (
      !request.current &&
      (!/^\+?[0-9]{8,15}$/.test(normalized.recipient_phone) ||
        Object.entries(normalized).some(([k, v]) => k !== "customer_note" && !v))
    ) {
      setError("INVALID_ADDRESS");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      if (!request.current) {
        let key = sessionStorage.getItem(storageKey);
        if (!key) {
          key = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
            b.toString(16).padStart(2, "0"),
          ).join("");
          sessionStorage.setItem(storageKey, key);
        }
        if (!/^[a-f0-9]{32}$/.test(key)) throw new AuthError("CHECKOUT_STORAGE");
        request.current = {
          idempotency_key: key,
          quote_fingerprint: quote.quote_fingerprint,
          recipient_name: normalized.recipient_name,
          recipient_phone: normalized.recipient_phone,
          province: normalized.province,
          district: null,
          ward: normalized.ward,
          address_line: normalized.address_line,
          customer_note: normalized.customer_note || null,
          payment_method: "cod",
        };
      }
      const result = await createOrder(request.current);
      await finish(result);
    } catch (e) {
      if (!alive.current) return;
      const code = e instanceof AuthError ? e.code : "NETWORK_ERROR";
      setError(code);
      if (code === "IDEMPOTENCY_CONFLICT" && request.current) {
        try {
          await finish(await recoverOrder(request.current.idempotency_key));
        } catch {
          /* Preserve the intent for the next retry. */
        }
      } else if (
        [
          "QUOTE_CHANGED",
          "INSUFFICIENT_STOCK",
          "PRODUCT_UNAVAILABLE",
          "INVALID_ADDRESS",
          "CART_EMPTY",
        ].includes(code)
      ) {
        request.current = null;
        try {
          setQuote(await getQuote());
        } catch {
          /* Keep the original error visible. */
        }
      }
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const update = (name: keyof typeof fields, value: string) =>
    setFields((f) => ({ ...f, [name]: value }));
  return (
    <main className="checkout" data-product-text data-checkout-api>
      <section>
        <button className="brand checkout-brand" onClick={onHome}>
          <span>MU</span>MANGA UNIVERSE
        </button>
        <p className="steps">
          {t("CART")} — <b>{t("INFORMATION")}</b> — {t("SHIPPING")} — COD
        </p>
        <h1>
          {t(order ? "order.success" : "SHIPPING")}
          <br />
          <i>{t(order ? "order.placed" : "INFORMATION")}</i>
        </h1>
        {order ? (
          <div data-order-code={order.order_code}>
            <h2 className="break-all">{order.order_code}</h2>
            <p>{t("order.status." + order.status)}</p>
            <p>{t(order.payment_status === "paid" ? "order.paid" : "order.codPending")}</p>
            <p>{money(order.total_vnd)}</p>
            <button className="ink-btn" onClick={onOrders}>
              {t("ORDER HISTORY")}
            </button>
          </div>
        ) : loading ? (
          <p role="status">{t("order.loading")}</p>
        ) : quote ? (
          <form onSubmit={(e) => void submit(e)}>
            <label>
              {t("order.recipient")}
              <input
                name="recipient_name"
                autoComplete="name"
                maxLength={150}
                required
                value={fields.recipient_name}
                onChange={(e) => update("recipient_name", e.target.value)}
                disabled={busy || !!request.current}
              />
            </label>
            <label>
              {t("order.phone")}
              <input
                name="recipient_phone"
                type="tel"
                autoComplete="tel"
                maxLength={20}
                required
                value={fields.recipient_phone}
                onChange={(e) => update("recipient_phone", e.target.value)}
                disabled={busy || !!request.current}
              />
            </label>
            <div className="form-grid">
              <label>
                {t("order.province")}
                <input
                  name="province"
                  maxLength={120}
                  required
                  value={fields.province}
                  onChange={(e) => update("province", e.target.value)}
                  disabled={busy || !!request.current}
                />
              </label>
              <label>
                {t("order.ward")}
                <input
                  name="ward"
                  maxLength={120}
                  required
                  value={fields.ward}
                  onChange={(e) => update("ward", e.target.value)}
                  disabled={busy || !!request.current}
                />
              </label>
            </div>
            <label>
              {t("ADDRESS")}
              <input
                name="address_line"
                autoComplete="street-address"
                maxLength={255}
                required
                value={fields.address_line}
                onChange={(e) => update("address_line", e.target.value)}
                disabled={busy || !!request.current}
              />
            </label>
            <label>
              {t("order.note")}
              <input
                name="customer_note"
                maxLength={2000}
                value={fields.customer_note}
                onChange={(e) => update("customer_note", e.target.value)}
                disabled={busy || !!request.current}
              />
            </label>
            <label>
              {t("order.payment")}
              <select name="payment_method" value="cod" disabled>
                <option value="cod">{t("order.cod")}</option>
              </select>
            </label>
            <p>{t("order.demoShipping")}</p>
            <button className="ink-btn" type="submit" disabled={busy}>
              {t(busy ? "order.submitting" : request.current ? "order.retry" : "order.place")}
            </button>
          </form>
        ) : null}
        {error && (
          <div role="alert">
            <p>{t("order.error." + error)}</p>
            {!quote && !order && (
              <button className="ink-btn ink-btn-ghost" onClick={() => setAttempt((x) => x + 1)}>
                {t("TRY AGAIN")}
              </button>
            )}
          </div>
        )}
      </section>
      <aside>
        <span>{t("order.summary")} / 注文</span>
        {(order
          ? order.items.map((i) => ({
              id: i.product_id,
              name: language === "vi" ? i.name_vi_snapshot : i.name_en_snapshot,
              quantity: i.quantity,
              total: i.line_total_vnd,
            }))
          : (quote?.items.map((i) => ({
              id: i.product_id,
              name: language === "vi" ? i.name_vi : i.name_en,
              quantity: i.quantity,
              total: i.line_total_vnd,
            })) ?? [])
        ).map((i, index) => (
          <div className="checkout-item" key={index}>
            <ProductImage
              src={cart.find((p) => p.id === i.id)?.image || PRODUCT_PLACEHOLDER}
              alt=""
            />
            <div>
              <b>{i.name}</b>
              <small>× {i.quantity}</small>
            </div>
            <strong>{money(i.total)}</strong>
          </div>
        ))}
        <hr />
        <div>
          <p>{t("SUBTOTAL")}</p>
          <b>{money(order?.subtotal_vnd ?? quote?.subtotal_vnd ?? 0)}</b>
        </div>
        <div>
          <p>{t("SHIPPING")}</p>
          <b>{money(order?.shipping_fee_vnd ?? quote?.shipping_fee_vnd ?? 0)}</b>
        </div>
        <div className="checkout-total">
          <p>TOTAL / VND</p>
          <b>{money(order?.total_vnd ?? quote?.total_vnd ?? 0)}</b>
        </div>
      </aside>
    </main>
  );
}
