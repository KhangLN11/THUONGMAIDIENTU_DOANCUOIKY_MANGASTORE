import { useState } from "react";
import { useI18n } from "../i18n";
import type { Product } from "../types/product";
import {
  CheckoutFrame,
  OrderSummary,
  ShippingForm,
  PaymentChoices,
  emptyShipping,
  shippingErrors,
} from "./CheckoutView";
export function DemoCheckout({ cart, onShop }: { cart: Product[]; onShop: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState(1),
    [fields, setFields] = useState(emptyShipping),
    [errors, setErrors] = useState({});
  const [choice, setChoice] = useState<"cod" | "bank_transfer" | "vietqr">("cod");
  const groups = new Map<number, { p: Product; quantity: number }>();
  for (const p of cart) {
    const old = groups.get(p.id);
    groups.set(p.id, { p, quantity: (old?.quantity ?? 0) + 1 });
  }
  const items = Array.from(groups.values()).map(({ p, quantity }) => ({
    id: p.id,
    name: p.name,
    image: p.image,
    quantity,
    unit: p.price,
    total: p.price * quantity,
  }));
  const subtotal = items.reduce((n, i) => n + i.total, 0);
  return (
    <div data-checkout-demo>
      <CheckoutFrame
        demo
        step={step}
        onStep={setStep}
        summary={
          <OrderSummary
            items={items}
            subtotal={subtotal}
            shipping={0}
            total={subtotal}
            currency="USD"
          />
        }
      >
        {!items.length ? (
          <>
            <p>{t("order.empty")}</p>
            <button className="checkout-button" onClick={onShop}>
              {t("checkout.continueShopping")}
            </button>
          </>
        ) : step === 3 ? (
          <>
            <h2>{t("checkout.demoComplete")}</h2>
            <p>{t("checkout.demo")}</p>
            <button className="checkout-button primary" onClick={onShop}>
              {t("checkout.continueShopping")}
            </button>
          </>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const err = shippingErrors(fields);
              setErrors(err);
              if (!Object.keys(err).length) setStep(step + 1);
            }}
          >
            {step === 1 ? (
              <>
                <h2>{t("checkout.shippingAddress")}</h2>
                <ShippingForm
                  fields={fields}
                  onChange={(key, value) => {
                    setFields((f) => ({ ...f, [key]: value }));
                    setErrors((e) => ({ ...e, [key]: undefined }));
                  }}
                  errors={errors}
                  disabled={false}
                />
              </>
            ) : (
              <>
                <PaymentChoices
                  choice={choice}
                  onChange={setChoice}
                  bankReady={true}
                  qrReady={true}
                  disabled={false}
                />
                <p>{t("checkout.demo")}</p>
                <button
                  className="checkout-button secondary"
                  type="button"
                  onClick={() => setStep(1)}
                >
                  {t("checkout.back")}
                </button>
              </>
            )}
            <button className="checkout-button primary" type="submit">
              {t(step === 1 ? "checkout.toPayment" : "checkout.demoFinish")}
            </button>
          </form>
        )}
      </CheckoutFrame>
    </div>
  );
}
