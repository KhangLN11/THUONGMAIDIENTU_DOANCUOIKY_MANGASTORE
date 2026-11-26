import { useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n";
import { ProductImage } from "../components/ProductImage";
import { PRODUCT_PLACEHOLDER } from "../adapters/productAdapter";
import type { Order, PaymentInstructions } from "../services/orderService";
import { qrcodegen } from "../vendor/qrcodegen";
import "./checkout.css";
export type ShippingFields = {
  recipient_name: string;
  recipient_phone: string;
  province: string;
  district: string;
  ward: string;
  address_line: string;
  customer_note: string;
};
export const emptyShipping: ShippingFields = {
  recipient_name: "",
  recipient_phone: "",
  province: "",
  district: "",
  ward: "",
  address_line: "",
  customer_note: "",
};
export function shippingErrors(fields: ShippingFields) {
  const errors: Partial<Record<keyof ShippingFields, string>> = {};
  for (const [key, max] of Object.entries({
    recipient_name: 150,
    recipient_phone: 20,
    province: 120,
    district: 120,
    ward: 120,
    address_line: 255,
    customer_note: 2000,
  })) {
    const k = key as keyof ShippingFields,
      v = fields[k].trim();
    if (
      (!v && k !== "district" && k !== "customer_note") ||
      Array.from(v).length > max ||
      /[\p{C}]/u.test(v)
    )
      errors[k] = "checkout.fieldError";
  }
  if (!/^\+?[0-9]{8,15}$/.test(fields.recipient_phone.trim()))
    errors.recipient_phone = "checkout.phoneError";
  return errors;
}
export function CheckoutFrame({
  step,
  children,
  summary,
  onStep,
  demo = false,
}: {
  step: number;
  children: ReactNode;
  summary: ReactNode;
  onStep?: (step: number) => void;
  demo?: boolean;
}) {
  const { t } = useI18n();
  return (
    <main className="mu-checkout" data-product-text>
      <header className="checkout-heading">
        <div>
          <p className="checkout-eyebrow">{t("checkout.breadcrumb")}</p>
          <h1>
            {t(
              step === 3 ? (demo ? "checkout.demoComplete" : "checkout.success") : "checkout.title",
            )}
          </h1>
          {demo && <p className="checkout-sandbox">{t("checkout.demo")}</p>}
        </div>
        <ol className="checkout-progress" aria-label={t("checkout.progress")}>
          {["checkout.information", "checkout.payment", "checkout.completed"].map((label, i) => (
            <li
              key={label}
              className={step === i + 1 ? "current" : step > i + 1 ? "done" : ""}
              aria-current={step === i + 1 ? "step" : undefined}
            >
              <button
                type="button"
                disabled={!onStep || i + 1 >= step || step === 3}
                onClick={() => onStep?.(i + 1)}
              >
                <span>{step > i + 1 ? "✓" : i + 1}</span>
                {t(label)}
              </button>
            </li>
          ))}
        </ol>
      </header>
      <div className="checkout-columns">
        <section className="checkout-content">{children}</section>
        <aside className="checkout-summary">{summary}</aside>
      </div>
    </main>
  );
}
export function ShippingForm({
  fields,
  onChange,
  errors,
  disabled,
}: {
  fields: ShippingFields;
  onChange: (name: keyof ShippingFields, value: string) => void;
  errors: Partial<Record<keyof ShippingFields, string>>;
  disabled: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="checkout-fields">
      {(Object.keys(emptyShipping) as (keyof ShippingFields)[]).map((name) => (
        <label
          key={name}
          className={
            ["recipient_name", "address_line", "customer_note"].includes(name) ? "wide" : ""
          }
          htmlFor={"checkout-" + name}
        >
          {t("checkout.field." + name)}
          {!["district", "customer_note"].includes(name) && " *"}
          {name === "customer_note" ? (
            <textarea
              id={"checkout-" + name}
              name={name}
              maxLength={2000}
              value={fields[name]}
              onChange={(e) => onChange(name, e.target.value)}
              disabled={disabled}
            />
          ) : (
            <input
              id={"checkout-" + name}
              name={name}
              autoComplete={
                (
                  {
                    recipient_name: "name",
                    recipient_phone: "tel",
                    province: "address-level1",
                    district: "address-level2",
                    ward: "address-level3",
                    address_line: "street-address",
                  } as Record<string, string>
                )[name]
              }
              type={name === "recipient_phone" ? "tel" : "text"}
              maxLength={
                name === "recipient_name"
                  ? 150
                  : name === "recipient_phone"
                    ? 20
                    : name === "address_line"
                      ? 255
                      : 120
              }
              required={name !== "district"}
              value={fields[name]}
              onChange={(e) => onChange(name, e.target.value)}
              disabled={disabled}
              aria-invalid={!!errors[name]}
              aria-describedby={errors[name] ? "checkout-error-" + name : undefined}
            />
          )}{" "}
          {errors[name] && (
            <small id={"checkout-error-" + name} className="checkout-field-error">
              {t(errors[name]!)}
            </small>
          )}
        </label>
      ))}
    </div>
  );
}
export type SummaryLine = {
  id: number | null;
  name: string;
  quantity: number;
  unit: number;
  total: number;
  image?: string | null;
};
export function OrderSummary({
  items,
  subtotal,
  shipping,
  total,
  currency = "VND",
}: {
  items: SummaryLine[];
  subtotal: number;
  shipping: number;
  total: number;
  currency?: "VND" | "USD";
}) {
  const { t, formatCurrency } = useI18n();
  const money = (v: number) => formatCurrency(v, currency);
  return (
    <>
      <h2>
        {t("checkout.yourOrder")} ({items.length})
      </h2>
      <div className="checkout-lines">
        {items.map((i, index) => (
          <div className="checkout-item" key={i.id ?? index} data-checkout-product={i.id}>
            <ProductImage src={i.image || PRODUCT_PLACEHOLDER} alt={i.name} variant="trueColor" />
            <div>
              <b>{i.name}</b>
              <small>
                {money(i.unit)} × {i.quantity}
              </small>
            </div>
            <strong>{money(i.total)}</strong>
          </div>
        ))}
      </div>
      <dl className="checkout-totals">
        <div>
          <dt>{t("SUBTOTAL")}</dt>
          <dd>{money(subtotal)}</dd>
        </div>
        <div>
          <dt>{t("SHIPPING")}</dt>
          <dd>{money(shipping)}</dd>
        </div>
        <div className="checkout-total">
          <dt>{t("checkout.total")}</dt>
          <dd>
            <b>{money(total)}</b>
          </dd>
        </div>
      </dl>
      <p className="checkout-note">{t(currency==="USD"?"checkout.demo":"checkout.serverPrices")}</p>
    </>
  );
}
export function PaymentChoices({
  choice,
  onChange,
  bankReady,
  qrReady,
  disabled,
}: {
  choice: string;
  onChange: (v: "cod" | "bank_transfer" | "vietqr") => void;
  bankReady: boolean;
  qrReady: boolean;
  disabled: boolean;
}) {
  const { t } = useI18n();
  return (
    <fieldset className="checkout-methods">
      <legend>{t("checkout.paymentMethod")}</legend>
      {(["cod", "bank_transfer", "vietqr"] as const).map((method, i) => {
        const ready = method === "cod" || (method === "vietqr" ? qrReady : bankReady);
        return (
          <label key={method} className={choice === method ? "selected" : ""}>
            <input
              type="radio"
              name="payment_choice"
              value={method}
              checked={choice === method}
              disabled={disabled || !ready}
              onChange={() => onChange(method)}
            />
            <span className="checkout-method-symbol" aria-hidden="true">
              {["▱", "▥", "▦"][i]}
            </span>
            <span>
              <b>{t("checkout.method." + method)}</b>
              <small>
                {t(ready ? "checkout.methodInfo." + method : "checkout.bankUnavailable")}
              </small>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
export function PaymentInstructionsView({
  instructions,
  orderId,
}: {
  instructions: PaymentInstructions;
  orderId: number;
}) {
  const { t, formatCurrency } = useI18n();
  const [notice, setNotice] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const qr = useMemo(
    () => qrcodegen.QrCode.encodeText(instructions.qr_payload, qrcodegen.QrCode.Ecc.MEDIUM),
    [instructions.qr_payload],
  );
  let path = "";
  for (let y = 0; y < qr.size; y++)
    for (let x = 0; x < qr.size; x++) if (qr.getModule(x, y)) path += `M${x + 4},${y + 4}h1v1h-1z `;
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(t("checkout.copied"));
    } catch {
      setNotice(t("checkout.copyFailed"));
    }
  }
  function download() {
    if (!svgRef.current) return;
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(svgRef.current)], { type: "image/svg+xml" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `manga-order-${orderId}${instructions.simulation ? "-sandbox" : ""}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="checkout-instructions" data-payment-instructions>
      <h2>{t(instructions.simulation ? "checkout.sandboxQr" : "checkout.transferInstructions")}</h2>
      <p className="checkout-sandbox">
        {t(instructions.simulation ? "checkout.sandboxWarning" : "checkout.bankPending")}
      </p>
      <div className="checkout-qr-layout">
        <div>
          <svg
            ref={svgRef}
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`0 0 ${qr.size + 8} ${qr.size + 8}`}
            role="img"
            aria-label={t(instructions.simulation ? "checkout.sandboxQr" : "checkout.qr")}
            shapeRendering="crispEdges"
            data-order-qr
          >
            <rect width="100%" height="100%" fill="white" />
            <path d={path} fill="black" />
          </svg>
          <button className="checkout-button secondary" type="button" onClick={download}>
            {t("checkout.downloadQr")}
          </button>
        </div>
        <dl>
          {!instructions.simulation && (
            <>
              <dt>{t("checkout.bank")}</dt>
              <dd>{instructions.bank_name}</dd>
              <dt>{t("checkout.accountOwner")}</dt>
              <dd>{instructions.account_name}</dd>
              <dt>{t("checkout.accountNumber")}</dt>
              <dd>
                {instructions.account_number}
                <button type="button" onClick={() => void copy(instructions.account_number!)}>
                  {t("checkout.copy")}
                </button>
              </dd>
            </>
          )}
          <dt>{t("checkout.amount")}</dt>
          <dd>
            {formatCurrency(instructions.amount_vnd, "VND")}
            <button type="button" onClick={() => void copy(String(instructions.amount_vnd))}>
              {t("checkout.copy")}
            </button>
          </dd>
          <dt>{t("checkout.reference")}</dt>
          <dd>
            {instructions.reference}
            <button type="button" onClick={() => void copy(instructions.reference)}>
              {t("checkout.copy")}
            </button>
          </dd>
        </dl>
      </div>
      <p role="status">{notice}</p>
      <p>{t("checkout.noSelfPaid")}</p>
    </section>
  );
}
export function OrderReceipt({ order }: { order: Order }) {
  const { t, formatDate } = useI18n();
  return (
    <div className="checkout-receipt" data-order-code={order.order_code}>
      {order.simulation && <p className="checkout-sandbox">{t("checkout.sandboxOrder")}</p>}
      <div className="checkout-success-mark" aria-hidden="true">
        ✓
      </div>
      <h2>{t("checkout.thanks")}</h2>
      <p className="checkout-code">{order.order_code}</p>
      <p>{t("checkout.recorded")}</p>
      <dl className="checkout-receipt-meta">
        <div>
          <dt>{t("checkout.date")}</dt>
          <dd>{formatDate(order.created_at.replace(" ", "T"))}</dd>
        </div>
        <div>
          <dt>{t("checkout.orderStatus")}</dt>
          <dd>{t("order.status." + order.status)}</dd>
        </div>
        <div>
          <dt>{t("checkout.paymentMethod")}</dt>
          <dd>{t("checkout.method." + order.payment_method)}</dd>
        </div>
        <div>
          <dt>{t("admin.paymentStatus")}</dt>
          <dd>{t("checkout.status." + order.payment_status)}</dd>
        </div>
      </dl>
      <p>
        {order.payment_method === "cod"
          ? t("checkout.codPending")
          : t(order.payment_status === "paid" ? "checkout.received" : "checkout.bankPending")}
      </p>
      <section className="checkout-address">
        <h3>{t("checkout.shippingAddress")}</h3>
        <p>
          {order.recipient_name} · {order.recipient_phone}
        </p>
        <p>
          {[order.address_line, order.ward, order.district, order.province]
            .filter(Boolean)
            .join(", ")}
        </p>
        {order.customer_note && <p>{order.customer_note}</p>}
      </section>
      {order.payment_instructions && (
        <PaymentInstructionsView instructions={order.payment_instructions} orderId={order.id} />
      )}
    </div>
  );
}
