import { DemoCheckout } from "../checkout/DemoCheckout";
import { useRef } from "react";
import { ApiCheckout } from "../components/ApiCheckout";
import { clearBuyNowIntent } from "./buyNowIntent";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../i18n";
import { useProduct, useProducts } from "../hooks/useProducts";
import { USE_PRODUCTS_API } from "../config/products";
import { CheckoutFrame } from "../checkout/CheckoutView";
import type { BuyNowIntent } from "./buyNowIntent";
export function BuyNowResume({
  intent,
  onContinue,
  onCancel,
}: {
  intent: BuyNowIntent | null;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const { user } = useAuth(),
    { t } = useI18n();
  return intent && user ? (
    <div className="buy-now-resume" data-buy-now-resume role="status">
      <span>{t("buy.resume")}</span>
      <button onClick={onContinue}>{t("buy.continue")}</button>
      <button onClick={onCancel}>{t("buy.clearIntent")}</button>
    </div>
  ) : null;
}
type Props = {
  intent: BuyNowIntent | null;
  onShop: () => void;
  onAccount: () => void;
  onOrders: () => void;
  onPlaced: () => Promise<void>;
};
export function BuyNowCheckout(props: Props) {
  const receiptIntent = useRef<BuyNowIntent | null>(null);
  const completed = useRef(false);
  if (props.intent) receiptIntent.current = props.intent;
  const intent = props.intent ?? (completed.current ? receiptIntent.current : null);
  const shared = {
    ...props,
    intent,
    onPlaced: async () => {
      completed.current = true;
      await props.onPlaced();
    },
  };
  return intent ? (
    USE_PRODUCTS_API ? (
      <LiveCheckout key={intent.productId} {...shared} />
    ) : (
      <DemoPreview {...shared} />
    )
  ) : (
    <ExpiredCheckout onShop={props.onShop} />
  );
}
function LiveCheckout(props: Props) {
  const result = useProduct(props.intent!.productId);
  const { user } = useAuth();
  return (
    <ApiCheckout
      key={(user?.id ?? "guest") + ":" + props.intent!.productId + ":" + props.intent!.quantity}
      source={{
        mode: "buy_now",
        product_id: props.intent!.productId,
        quantity: props.intent!.quantity,
      }}
      cart={result.product ? [result.product] : []}
      pending={false}
      onHome={props.onShop}
      onAccount={props.onAccount}
      onOrders={props.onOrders}
      onPlaced={async () => {
        clearBuyNowIntent();
        await props.onPlaced();
      }}
    />
  );
}
function DemoPreview(props: Props) {
  const { products } = useProducts();
  const p = products.find((p) => p.id === props.intent!.productId);
  return (
    <DemoCheckout
      cart={p ? Array.from({ length: props.intent!.quantity }, () => p) : []}
      onShop={props.onShop}
    />
  );
}
function ExpiredCheckout({ onShop }: { onShop: () => void }) {
  const { t } = useI18n();
  return (
    <CheckoutFrame step={1} summary={<p>{t("buy.expired")}</p>}>
      <p role="alert">{t("buy.expired")}</p>
      <button className="checkout-button primary" onClick={onShop}>
        {t("checkout.continueShopping")}
      </button>
    </CheckoutFrame>
  );
}
