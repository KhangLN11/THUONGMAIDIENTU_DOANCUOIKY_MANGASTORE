import { useRef } from "react";
import { ApiCheckout } from "../components/ApiCheckout";
import { clearBuyNowIntent } from "./buyNowIntent";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../i18n";
import { useProduct, useProducts } from "../hooks/useProducts";
import { USE_PRODUCTS_API } from "../config/products";
import { ProductImage } from "../components/ProductImage";
import { ProductState } from "../components/ProductState";
import type { Product } from "../types/product";
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
    <Preview {...props} product={null} status="success" />
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
  return (
    <Preview
      {...props}
      product={products.find((p) => p.id === props.intent!.productId) ?? null}
      status="success"
    />
  );
}
function Preview({
  intent,
  product,
  status,
  retry,
  notFound,
  onShop,
  onAccount,
}: Props & {
  product: Product | null;
  status: "loading" | "error" | "success";
  retry?: () => void;
  notFound?: boolean;
}) {
  const { user } = useAuth(),
    { t, formatCurrency } = useI18n();
  const available = !!product && (product.source !== "api" || (product.stockQuantity ?? 0) > 0);
  return (
    <main
      className="checkout buy-now-checkout"
      data-product-text
      data-buy-now-checkout
      data-buy-now-id={intent?.productId ?? ""}
    >
      <section>
        <button className="brand checkout-brand" onClick={onShop}>
          <span>MU</span>MANGA UNIVERSE
        </button>
        <p className="steps">
          {t("BUY NOW")} — {t("order.summary")}
        </p>
        <h1>{t("BUY NOW")}</h1>
        {!intent ? (
          <p role="alert">{t("buy.expired")}</p>
        ) : status !== "success" ? (
          <ProductState status={status} retry={retry} notFound={notFound} />
        ) : !product ? (
          <p role="alert">{t("buy.unavailable")}</p>
        ) : (
          <>
            <p role="status">{t(USE_PRODUCTS_API ? "buy.limitation" : "buy.demo")}</p>
            {!available && <p role="alert">{t("OUT OF STOCK")}</p>}
            <p>{t("buy.cartSafe")}</p>
            <button type="button" className="ink-btn" disabled aria-describedby="buy-now-limit">
              <span>{t("buy.confirm")}</span>
            </button>
            <p id="buy-now-limit">{t("buy.noOrder")}</p>
            {!user && USE_PRODUCTS_API && (
              <button className="ink-btn ink-btn-ghost" onClick={onAccount}>
                <span>{t("buy.login")}</span>
              </button>
            )}
          </>
        )}
        <button className="buy-now-cancel" onClick={onShop}>
          {t("buy.cancel")}
        </button>
      </section>
      <aside>
        <span>{t("order.summary")}</span>
        {product && (
          <div className="checkout-item" data-buy-now-product={product.id}>
            <ProductImage src={product.image} alt={product.name} />
            <div>
              <b>{product.name}</b>
              <small>× 1</small>
            </div>
            <strong>
              {formatCurrency(product.price, product.source === "api" ? "VND" : "USD")}
            </strong>
          </div>
        )}
        <p>{t("buy.priceNote")}</p>
      </aside>
    </main>
  );
}
