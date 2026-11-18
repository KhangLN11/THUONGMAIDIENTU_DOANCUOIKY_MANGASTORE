import { useI18n } from "../i18n";

export function ProductState({ status, retry, notFound = false }: { status: "loading" | "error" | "empty"; retry?: () => void; notFound?: boolean }) {
  const { t } = useI18n();
  return <div className="empty" role={status === "error" ? "alert" : "status"} aria-live="polite" style={{ minHeight: 320, gridColumn: "1 / -1" }}>
    <h2>{t(status === "loading" ? "Loading products…" : status === "empty" ? "No products found." : notFound ? "Product not found." : "Unable to load products.")}</h2>
    {status === "error" && retry && <button className="ink-btn" onClick={retry}>{t("TRY AGAIN")}</button>}
  </div>;
}

export function ProductSkeletons() {
  const { t } = useI18n();
  return <>{Array.from({ length: 6 }, (_, index) => <article className="product-card" key={index} aria-busy="true" aria-label={t("Loading products…")}>
    <div className="product-img" />
    <div className="product-meta" aria-hidden="true" style={{ minHeight: 100 }} />
  </article>)}</>;
}
