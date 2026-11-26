import { rememberCheckoutDraft, takeCheckoutDraft } from "../checkout/resumeDraft";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../i18n";
import {
  getQuote,
  getOrder,
  createOrder,
  recoverOrder,
  type Quote,
  type Order,
  type CheckoutInput,
  type CheckoutSource,
} from "../services/orderService";
import { AuthError } from "../services/authService";
import {
  CheckoutFrame,
  ShippingForm,
  PaymentChoices,
  OrderSummary,
  OrderReceipt,
  emptyShipping,
  shippingErrors,
  type ShippingFields,
} from "../checkout/CheckoutView";
import { showCompletion } from "../checkout/routes";
import { PRODUCT_PLACEHOLDER } from "../adapters/productAdapter";
import type { Product } from "../types/product";
export function ApiCheckout({
  cart,
  pending,
  onHome,
  onAccount,
  onOrders,
  onPlaced,
  source,
  completedOrderId,
}: {
  completedOrderId?: number | null;
  source?: CheckoutSource;
  cart: Product[];
  pending: boolean;
  onHome: () => void;
  onAccount: () => void;
  onOrders: () => void;
  onPlaced: () => Promise<void>;
}) {
  const { user, loading: authLoading, refresh } = useAuth();
  const { t, language, formatCurrency } = useI18n();
  const money = (v: number) => formatCurrency(v, "VND");
  const [quote, setQuote] = useState<Quote | null>(null),
    [order, setOrder] = useState<Order | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [fields, setFields] = useState<ShippingFields>(emptyShipping);
  const [step, setStep] = useState(1);
  const [choice, setChoice] = useState<"cod" | "bank_transfer" | "vietqr">("cod");
  const [errors, setErrors] = useState<Partial<Record<keyof ShippingFields, string>>>({});
  const stepHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    stepHeading.current?.focus();
  }, [step]);
  const request = useRef<CheckoutInput | null>(null),
    inFlight = useRef(false),
    alive = useRef(true);
  const owner = user?.id;
  const storageKey =
    "manga-checkout-intent-" +
    owner +
    (source ? "-buy-" + source.product_id + "-" + source.quantity : "");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (authLoading || (!completedOrderId && pending) || order) return;
    if (!user) {
      if (completedOrderId)
        sessionStorage.setItem("manga-checkout-return", "#checkout/complete/" + completedOrderId);
      onAccount();
      return;
    }
    const restored = takeCheckoutDraft(user.id, storageKey);
    if (restored) setFields(restored);
    let active = true;
    setLoading(true);
    setError(null);
    void (async () => {
      if (completedOrderId) {
        const existing = await getOrder(completedOrderId);
        if (active) setOrder(existing);
        return;
      }
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        if (!/^[a-f0-9]{32}$/.test(saved)) throw new AuthError("CHECKOUT_STORAGE");
        try {
          const existing = await recoverOrder(saved);
          if (active) {
            await finish(existing);
          }
          return;
        } catch (e) {
          if (!(e instanceof AuthError) || e.status !== 404) throw e;
        }
      }
      const q = await getQuote(source);
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
  }, [owner, authLoading, pending, attempt, order, completedOrderId]);
  async function finish(result: Order) {
    if (!alive.current) return;
    setOrder(result);
    request.current = null;
    sessionStorage.removeItem(storageKey);
    await onPlaced();
    if (alive.current) showCompletion(result.id);
  }
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (inFlight.current || !user || !quote || order) return;
    setError(null);
    const normalized = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.trim()]));
    if (!request.current) {
      const invalid = shippingErrors(fields);
      setErrors(invalid);
      if (Object.keys(invalid).length) {
        setStep(1);
        setTimeout(
          () => document.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus(),
          0,
        );
        return;
      }
    }
    if (step === 1) {
      setStep(2);
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
          ...source,
          idempotency_key: key,
          quote_fingerprint: quote.quote_fingerprint,
          recipient_name: normalized.recipient_name,
          recipient_phone: normalized.recipient_phone,
          province: normalized.province,
          district: normalized.district || null,
          ward: normalized.ward,
          address_line: normalized.address_line,
          customer_note: normalized.customer_note || null,
          payment_method: choice === "cod" ? "cod" : "bank_transfer",
        };
      }
      const result = await createOrder(request.current);
      await finish(result);
    } catch (e) {
      if (!alive.current) return;
      const code = e instanceof AuthError ? e.code : "NETWORK_ERROR";
      setError(code);
      if (
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
          setQuote(await getQuote(source));
        } catch {
          /* Keep the original error visible. */
        }
      }
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const update = (name: keyof typeof fields, value: string) => {
    setFields((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  };
  const items = order
    ? order.items.map((i) => ({
        id: i.product_id,
        name: language === "vi" ? i.name_vi_snapshot : i.name_en_snapshot,
        quantity: i.quantity,
        unit: i.unit_price_vnd,
        total: i.line_total_vnd,
        image: i.image_url,
      }))
    : (quote?.items.map((i) => ({
        id: i.product_id,
        name: language === "vi" ? i.name_vi : i.name_en,
        quantity: i.quantity,
        unit: i.unit_price_vnd,
        total: i.line_total_vnd,
        image: cart.find((p) => p.id === i.product_id)?.image,
      })) ?? []);
  return (
    <div data-checkout-api data-checkout-source={source ? "buy_now" : "cart"}>
      <CheckoutFrame
        step={order ? 3 : step}
        onStep={!busy && !request.current ? setStep : undefined}
        summary={
          <OrderSummary
            items={items}
            subtotal={order?.subtotal_vnd ?? quote?.subtotal_vnd ?? 0}
            shipping={order?.shipping_fee_vnd ?? quote?.shipping_fee_vnd ?? 0}
            total={order?.total_vnd ?? quote?.total_vnd ?? 0}
          />
        }
      >
        {order ? (
          <>
            <OrderReceipt order={order} />
            <div className="checkout-actions">
              <button
                className="checkout-button primary"
                onClick={() => {
                  if (owner) sessionStorage.setItem("manga-track-order-" + owner, String(order.id));
                  onOrders();
                }}
              >
                {t("checkout.track")} →
              </button>
              <button className="checkout-button secondary" onClick={onHome}>
                {t("checkout.continueShopping")}
              </button>
            </div>
          </>
        ) : loading ? (
          <p role="status">{t("order.loading")}</p>
        ) : quote ? (
          <form noValidate onSubmit={(e) => void submit(e)} aria-busy={busy}>
            {quote.payment_simulation && (
              <p className="checkout-sandbox">{t("checkout.sandboxOrder")}</p>
            )}
            <h2 ref={stepHeading} tabIndex={-1}>
              {t(step === 1 ? "checkout.shippingAddress" : "checkout.paymentMethod")}
            </h2>
            {step === 1 ? (
              <>
                <ShippingForm
                  fields={fields}
                  onChange={update}
                  errors={errors}
                  disabled={busy || !!request.current}
                />
                <section className="checkout-shipping">
                  <h2>{t("checkout.shippingMethod")}</h2>
                  <label>
                    <input type="radio" name="shipping_method" checked readOnly />
                    {t("checkout.standardShipping")}
                    <strong>{money(quote.shipping_fee_vnd)}</strong>
                  </label>
                  <p>{t("order.demoShipping")}</p>
                </section>
                <button className="checkout-button primary" type="submit">
                  {t("checkout.toPayment")} →
                </button>
              </>
            ) : (
              <>
                <div className="checkout-address">
                  <b>
                    {fields.recipient_name} · {fields.recipient_phone}
                  </b>
                  <p>
                    {[fields.address_line, fields.ward, fields.district, fields.province]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  <button
                    type="button"
                    disabled={busy || !!request.current}
                    onClick={() => setStep(1)}
                  >
                    {t("checkout.editAddress")}
                  </button>
                </div>
                <PaymentChoices
                  choice={choice}
                  onChange={setChoice}
                  bankReady={quote.payment_options.bank_transfer}
                  qrReady={quote.payment_options.vietqr}
                  disabled={busy || !!request.current}
                />
                <p className="checkout-note">
                  {t(choice === "cod" ? "checkout.codPending" : "checkout.bankPending")}
                </p>
                <p className="checkout-action-total">
                  {t("checkout.total")} <strong>{money(quote.total_vnd)}</strong>
                </p>
                <div className="checkout-actions">
                  <button
                    className="checkout-button secondary"
                    type="button"
                    disabled={busy || !!request.current}
                    onClick={() => setStep(1)}
                  >
                    {t("checkout.back")}
                  </button>
                  <button className="checkout-button primary" type="submit" disabled={busy}>
                    {t(
                      busy
                        ? "order.submitting"
                        : request.current
                          ? "order.retry"
                          : "checkout.place",
                    )}{" "}
                    →
                  </button>
                </div>
              </>
            )}
          </form>
        ) : null}
        {!order && (
          <button className="checkout-cancel" type="button" disabled={busy} onClick={onHome}>
            {t("buy.cancel")}
          </button>
        )}
        {error && (
          <div className="checkout-error" role="alert">
            <p>{t("order.error." + error)}</p>
            {error === "UNAUTHENTICATED" && (
              <button
                className="checkout-button"
                onClick={() => {
                  if (owner) rememberCheckoutDraft(owner, storageKey, fields);
                  void refresh().then(onAccount);
                }}
              >
                {t("buy.login")}
              </button>
            )}
            {!quote && !order && (
              <button className="checkout-button" onClick={() => setAttempt((x) => x + 1)}>
                {t("TRY AGAIN")}
              </button>
            )}
          </div>
        )}
      </CheckoutFrame>
    </div>
  );
}
