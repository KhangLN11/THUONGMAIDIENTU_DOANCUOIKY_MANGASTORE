import { SmartSearchInput, useSearchQuery } from "../search/SmartSearchInput";
import { openSearchResults } from "../search/searchRoute";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useProducts } from "../hooks/useProducts";
import { useI18n } from "../i18n";
import { USE_PRODUCTS_API } from "../config/products";
import { ProductState, ProductSkeletons } from "../components/ProductState";
import type { Product } from "../types/product";
import {
  categoryOf,
  seriesOf,
  selectShopProducts,
  validPriceRange,
  initialShopFilters,
  SHOP_PAGE_SIZE,
  type ShopFilters,
} from "./shopModel";
import "./shop.css";
export function ShopCatalog({
  filters,
  onFilters,
  renderProduct,
  seriesSlug,
  onProduct,
}: {
  filters: ShopFilters;
  onFilters: (f: ShopFilters) => void;
  renderProduct: (p: Product) => ReactNode;
  seriesSlug: string | null;
  onProduct: (p: Product) => void;
}) {
  const { products, status, retry } = useProducts(),
    { t, language, formatCurrency } = useI18n();
  const [mobile, setMobile] = useState(() => matchMedia("(max-width:760px)").matches),
    [open, setOpen] = useState(false);
  const wasOpen = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = matchMedia("(max-width:760px)"),
      change = () => {
        setMobile(media.matches);
        setOpen(false);
      };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (mobile && open) {
      wasOpen.current = true;
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
      if (wasOpen.current && mobile) trigger.current?.focus();
      wasOpen.current = false;
    }
  }, [mobile, open]);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const set = (value: Partial<ShopFilters>) => onFilters({ ...filters, ...value, page: 1 });
  const reset = () => {
    onFilters({ ...initialShopFilters });
    window.history.replaceState(window.history.state, "", "#shop");
  };
  const scope = useMemo(
    () => (seriesSlug ? products.filter((p) => p.api?.series?.slug === seriesSlug) : products),
    [products, seriesSlug],
  );
  const settledQuery = useSearchQuery(filters.query);
  const resolvedFilters = { ...filters, query: settledQuery };
  const suggestions = useMemo(
    () => selectShopProducts(scope, { ...filters, query: "", sort: "default" }, language, t),
    [scope, filters.category, filters.series, filters.min, filters.max, filters.stock, language],
  );
  const filtered = selectShopProducts(scope, resolvedFilters, language, t),
    last = Math.max(1, Math.ceil(filtered.length / SHOP_PAGE_SIZE)),
    page = Math.min(filters.page, last),
    shown = filtered.slice((page - 1) * SHOP_PAGE_SIZE, page * SHOP_PAGE_SIZE);
  const categoryBase = selectShopProducts(
    scope,
    { ...resolvedFilters, category: "all", sort: "default" },
    language,
    t,
  );
  const seriesBase = selectShopProducts(
    scope,
    { ...resolvedFilters, series: "all", sort: "default" },
    language,
    t,
  );
  const categories = [
    ...new Map(
      scope.map((p) => [categoryOf(p), { key: categoryOf(p), name: p.category }]),
    ).values(),
  ];
  const series = [
    ...new Map(
      scope.map((p) => [
        seriesOf(p),
        { key: seriesOf(p), name: p.series || t("discovery.unclassified") },
      ]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, language));
  const currency = USE_PRODUCTS_API ? "VND" : "USD",
    priceError = !validPriceRange(filters);
  const panel = (
    <>
      <h2>{t("shop.filters")}</h2>
      <details open>
        <summary>{t("admin.category")}</summary>
        <button
          type="button"
          className="shop-filter-choice"
          aria-pressed={filters.category === "all"}
          onClick={() => set({ category: "all" })}
        >
          <span>{t("All")}</span>
          <span>{categoryBase.length}</span>
        </button>
        {categories.map((c) => (
          <button
            type="button"
            key={c.key}
            className="shop-filter-choice"
            aria-pressed={filters.category === c.key}
            onClick={() => set({ category: c.key })}
          >
            <span data-product-text>{USE_PRODUCTS_API ? c.name : t(c.name)}</span>
            <span>{categoryBase.filter((p) => categoryOf(p) === c.key).length}</span>
          </button>
        ))}
      </details>
      <details open>
        <summary>{t("admin.series")}</summary>
        <label className="shop-visually-hidden" htmlFor="shop-series">
          {t("admin.series")}
        </label>
        <select
          id="shop-series"
          name="shop_series"
          value={filters.series}
          onChange={(e) => set({ series: e.target.value })}
        >
          <option value="all">{t("All")}</option>
          {series.map((s) => (
            <option key={s.key} value={s.key} data-product-text>
              {s.name} ({seriesBase.filter((p) => seriesOf(p) === s.key).length})
            </option>
          ))}
        </select>
      </details>
      <details open>
        <summary>
          {t("shop.price")} / {currency}
        </summary>
        <div className="shop-price-fields">
          <label>
            {t("shop.min")}
            <input
              name="shop_min"
              type="number"
              min="0"
              step="1"
              max="99999999999999"
              value={filters.min}
              aria-invalid={priceError}
              aria-describedby={priceError ? "shop-price-error" : undefined}
              onChange={(e) => set({ min: e.target.value })}
            />
          </label>
          <label>
            {t("shop.max")}
            <input
              name="shop_max"
              type="number"
              min="0"
              step="1"
              max="99999999999999"
              value={filters.max}
              aria-invalid={priceError}
              aria-describedby={priceError ? "shop-price-error" : undefined}
              onChange={(e) => set({ max: e.target.value })}
            />
          </label>
        </div>
        {priceError && (
          <p id="shop-price-error" role="alert">
            {t("shop.invalidPrice")}
          </p>
        )}
        <div className="shop-price-presets">
          {(USE_PRODUCTS_API
            ? [
                [0, 100000],
                [100000, 500000],
                [500000, null],
              ]
            : [
                [0, 25],
                [25, 75],
                [75, null],
              ]
          ).map(([min, max]) => (
            <button
              type="button"
              key={min}
              onClick={() => set({ min: String(min), max: max === null ? "" : String(max) })}
            >
              {formatCurrency(min!, currency)}
              {max === null ? "+" : " – " + formatCurrency(max, currency)}
            </button>
          ))}
        </div>
      </details>
      {USE_PRODUCTS_API && (
        <details open>
          <summary>{t("shop.availability")}</summary>
          <label>
            <select
              aria-label={t("shop.availability")}
              name="shop_stock"
              value={filters.stock}
              onChange={(e) => set({ stock: e.target.value })}
            >
              <option value="all">{t("All")}</option>
              <option value="in">{t("IN STOCK")}</option>
              <option value="out">{t("OUT OF STOCK")}</option>
            </select>
          </label>
        </details>
      )}
      <button type="button" className="shop-reset" onClick={reset}>
        {t("shop.reset")}
      </button>
    </>
  );
  return (
    <main className="inner-page shop-catalog" data-shop-catalog>
      <div className="page-hero">
        <p>THE FULL ARCHIVE / 2025</p>
        <h1>
          SHOP <i>ALL</i>
        </h1>
        <b>買物</b>
      </div>
      <div className="shop-toolbar">
        <label className="shop-search-label">
          <span>{t("Search")}</span>
          <SmartSearchInput
            value={filters.query}
            onChange={(q) => {
              set({ query: q });
              window.history.replaceState(
                window.history.state,
                "",
                q ? "#shop?q=" + encodeURIComponent(q) : "#shop",
              );
            }}
            products={suggestions}
            status={status}
            retry={retry}
            placeholder={t("shop.search")}
            onProduct={onProduct}
            onAll={(q) => openSearchResults(q)}
          />
        </label>
        <span role="status" className="shop-result-count">
          {status === "loading"
            ? t("Loading products…")
            : filtered.length
              ? `${(page - 1) * SHOP_PAGE_SIZE + 1}–${Math.min(page * SHOP_PAGE_SIZE, filtered.length)} / ${filtered.length} ${t("shop.results")}`
              : `0 ${t("shop.results")}`}
        </span>
        <label className="shop-sort-label">
          {t("products.sort")}
          <select
            name="shop_sort"
            aria-label={t("products.sort")}
            value={filters.sort}
            onChange={(e) => set({ sort: e.target.value })}
          >
            {["default", "newest", "price_asc", "price_desc", "name"].map((k) => (
              <option key={k} value={k}>
                {t("shop.sort." + k)}
              </option>
            ))}
          </select>
        </label>
        <button
          ref={trigger}
          type="button"
          className="shop-filter-toggle"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span className="shop-filter-full">{t("shop.filters")}</span>
          <span className="shop-filter-short">{t("shop.filterShort")}</span>
        </button>
      </div>
      <div className="shop-catalog-layout">
        {mobile ? (
          <dialog
            ref={dialog}
            onKeyDown={(e) => {
              if (e.key !== "Tab") return;
              const nodes = Array.from(
                e.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not([disabled]),input:not([disabled]),select:not([disabled]),summary",
                ),
              ).filter((n) => n.getClientRects().length > 0);
              if (!nodes.length) {
                e.preventDefault();
                return;
              }
              const first = nodes[0],
                last = nodes[nodes.length - 1];
              if (
                (e.shiftKey && document.activeElement === first) ||
                (!e.shiftKey && document.activeElement === last)
              ) {
                e.preventDefault();
                (e.shiftKey ? last : first).focus();
              }
            }}
            className="shop-filter-dialog"
            aria-label={t("shop.filters")}
            onCancel={(e) => {
              e.preventDefault();
              close();
            }}
            onClose={(e) => {
              if (!e.currentTarget.open) setOpen(false);
            }}
          >
            <button type="button" className="shop-filter-close" onClick={close}>
              {t("admin.close")}
            </button>
            {panel}
            <button type="button" className="shop-reset" onClick={close}>
              {t("shop.showResults")} ({filtered.length})
            </button>
          </dialog>
        ) : (
          <aside className="shop-sidebar">{panel}</aside>
        )}
        <section className="shop-results" aria-label={t("shop.results")}>
          <div className="product-grid shop-grid">
            {status === "loading" ? (
              <>
                <span role="status">{t("Loading products…")}</span>
                <ProductSkeletons />
              </>
            ) : status === "error" ? (
              <ProductState status="error" retry={retry} />
            ) : !priceError && shown.length ? (
              shown.map(renderProduct)
            ) : (
              <div className="shop-empty">
                <ProductState status="empty" />
                <button type="button" className="shop-reset" onClick={reset}>
                  {t("shop.reset")}
                </button>
              </div>
            )}
          </div>
          {status === "success" && !priceError && filtered.length > 0 && (
            <nav className="shop-pagination" aria-label={t("shop.pagination")}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onFilters({ ...filters, page: page - 1 })}
              >
                {t("admin.previous")}
              </button>
              <span>
                {page} / {last} · {filtered.length}
              </span>
              <button
                type="button"
                disabled={page >= last}
                onClick={() => onFilters({ ...filters, page: page + 1 })}
              >
                {t("admin.next")}
              </button>
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}
