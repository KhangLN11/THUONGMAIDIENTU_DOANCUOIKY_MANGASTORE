import { useMemo, type ReactNode } from "react";
import { useI18n } from "../i18n";
import { useProducts } from "../hooks/useProducts";
import { ProductImage } from "../components/ProductImage";
import { ProductState } from "../components/ProductState";
import type { Product } from "../types/product";
import {
  defaultVolumeFilters,
  figureGroups,
  filterVolumes,
  mangaSeries,
  merchandise,
  seriesMatches,
  volumeOf,
  type DiscoveryFilters,
  type SeriesGroup,
} from "./catalogModel";
import "./discovery.css";
type Common = {
  filters: DiscoveryFilters;
  onFilters: (value: DiscoveryFilters) => void;
  renderProduct: (p: Product) => ReactNode;
  openFigures: (slug?: string) => void;
};
export function SeriesExplorer({
  slug,
  openSeries,
  ...props
}: Common & { slug: string | null; openSeries: (slug: string | null) => void }) {
  const { products, status, retry } = useProducts(),
    { t, language, formatCurrency } = useI18n();
  const groups = useMemo(() => mangaSeries(products), [products]);
  const group = slug === null ? null : groups.find((g) => g.slug === slug);
  const found = groups.filter((g) => seriesMatches(g, props.filters.query)),
    unknown = products.filter((p) => p.categoryKey === "manga" && !p.api?.series).length;
  const count = (g: SeriesGroup) =>
    g.volumeCount === null
      ? `${g.products.length} ${t("discovery.editions")}`
      : `${g.volumeCount} ${t("discovery.volumesAvailable")}`;
  const vf = props.filters.volumes[slug ?? ""] ?? defaultVolumeFilters;
  const setVolume = (value: typeof vf) =>
    props.onFilters({
      ...props.filters,
      volumes: { ...props.filters.volumes, [slug ?? ""]: value },
    });
  const volumes = group ? filterVolumes(group.products, vf) : [];
  return (
    <main
      className="series-page discovery-surface"
      data-product-text
      data-series-detail={slug ?? undefined}
    >
      {slug !== null ? (
        <button className="discovery-breadcrumb" onClick={() => openSeries(null)}>
          ← {t("discovery.backSeries")}
        </button>
      ) : null}
      {status !== "success" ? (
        <ProductState status={status} retry={retry} />
      ) : slug !== null && !group ? (
        <section className="discovery-header">
          <h1>{t("discovery.seriesMissing")}</h1>
          <button className="ink-btn" onClick={() => openSeries(null)}>
            {t("discovery.backSeries")}
          </button>
        </section>
      ) : group ? (
        <>
          <section className="discovery-series-summary">
            <ProductImage src={group.cover.image} alt={group.cover.name} />
            <div>
              <p className="discovery-kicker">MANGA / {t("discovery.seriesFile")}</p>
              <h1>{group.title}</h1>
              {(language === "vi" ? group.description_vi : group.description_en) && (
                <p>{language === "vi" ? group.description_vi : group.description_en}</p>
              )}
              <div className="discovery-facts">
                <span>{count(group)}</span>
                <span>
                  {group.inStockCount} {t("discovery.editionsInStock")}
                </span>
              </div>
              <p className="discovery-note">{t("discovery.catalogOnly")}</p>
            </div>
          </section>
          <section className="discovery-volume-section">
            <div className="discovery-section-heading">
              <h2>{t("discovery.findVolume")}</h2>
              <span>
                {volumes.length} / {group.products.length}
              </span>
            </div>
            <div className="discovery-tools">
              <label>
                {t("discovery.findVolume")}
                <input
                  name="volume_search"
                  value={vf.query}
                  placeholder={t("discovery.volumePlaceholder")}
                  onChange={(e) => setVolume({ ...vf, query: e.target.value })}
                />
              </label>
              <label>
                {t("discovery.sortVolumes")}
                <select
                  name="volume_order"
                  value={vf.direction}
                  onChange={(e) =>
                    setVolume({ ...vf, direction: e.target.value as "asc" | "desc" })
                  }
                >
                  <option value="asc">{t("discovery.ascending")}</option>
                  <option value="desc">{t("discovery.descending")}</option>
                </select>
              </label>
              <label className="discovery-checkbox">
                <input
                  name="volume_in_stock"
                  type="checkbox"
                  checked={vf.inStock}
                  onChange={(e) => setVolume({ ...vf, inStock: e.target.checked })}
                />
                {t("discovery.inStockOnly")}
              </label>
            </div>
            <div className="product-grid discovery-product-grid" data-volume-grid>
              {volumes.map((p) => (
                <div key={p.id} data-volume-number={volumeOf(p) ?? "unknown"}>
                  <p className="discovery-volume-label">
                    {volumeOf(p) === null
                      ? t("discovery.volumeUnknown")
                      : `${t("discovery.volume")} ${volumeOf(p)}`}
                  </p>
                  {props.renderProduct(p)}
                </div>
              ))}
              {!volumes.length && <ProductState status="empty" />}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="discovery-header">
            <p className="discovery-kicker">MANGA UNIVERSE / {t("discovery.seriesFile")}</p>
            <h1>{t("discovery.chooseWorld")}</h1>
            <p>{t("discovery.seriesIntro")}</p>
            <div className="discovery-facts">
              <span>
                {groups.length} {t("discovery.seriesAvailable")}
              </span>
              <span>
                {groups.reduce((n, g) => n + g.products.length, 0)} {t("discovery.mangaEditions")}
              </span>
            </div>
            <button className="discovery-text-button" onClick={() => props.openFigures()}>
              {t("discovery.figureLink")} ↗
            </button>
          </section>
          <section className="discovery-series-list">
            <label className="discovery-search">
              {t("discovery.searchSeries")}
              <input
                name="series_search"
                value={props.filters.query}
                placeholder={t("discovery.searchSeries")}
                onChange={(e) => props.onFilters({ ...props.filters, query: e.target.value })}
              />
            </label>
            {unknown > 0 && (
              <p role="note">
                {unknown} {t("discovery.missingSeries")}
              </p>
            )}
            <div className="discovery-series-grid" data-series-grid>
              {found.map((g) => (
                <button
                  className="discovery-series-card"
                  key={g.id}
                  data-series-card={g.slug}
                  onClick={() => openSeries(g.slug)}
                >
                  <div className="discovery-series-cover">
                    <ProductImage src={g.cover.image} alt={g.cover.name} />
                  </div>
                  <div className="discovery-series-card-copy">
                    <p>{count(g)}</p>
                    <h2>{g.title}</h2>
                    <p>
                      {formatCurrency(g.minPrice, "VND")}
                      {g.maxPrice !== g.minPrice ? ` — ${formatCurrency(g.maxPrice, "VND")}` : ""}
                    </p>
                    <span>{t("discovery.viewSeries")} ↗</span>
                  </div>
                </button>
              ))}
            </div>
            {!found.length && <ProductState status="empty" />}
          </section>
        </>
      )}
    </main>
  );
}
export function FigureCollections({
  filters,
  onFilters,
  renderProduct,
  openFigures,
  embedded = false,
}: Common & { embedded?: boolean }) {
  const { products, status, retry } = useProducts(),
    { t } = useI18n();
  const catalog = merchandise(products),
    f = filters.figure,
    groups = figureGroups(products, f),
    choices = figureGroups(products, { query: "", category: "all", series: "all" });
  const set = (value: typeof f) => onFilters({ ...filters, figure: value });
  const title = (g: { title: string }) => g.title || t("discovery.unclassified");
  const body = (
    <section className="discovery-figures" data-figure-collections data-product-text>
      <div className="discovery-section-heading">
        <div>
          <p className="discovery-kicker">FIGURES / ANIME COLLECTIONS</p>
          <h2>{t("discovery.reality")}</h2>
          <p>{t("discovery.figuresIntro")}</p>
        </div>
        {f.series !== "all" && (
          <button
            className="discovery-text-button"
            onClick={() => {
              set({ ...f, series: "all" });
              openFigures();
            }}
          >
            {t("discovery.allCollections")} ↗
          </button>
        )}
      </div>
        <button className="discovery-text-button" onClick={() => { set({ query: "", category: "all", series: "all" }); openFigures(); }}>{t("collections.reset")}</button>
      <div className="discovery-tools">
        <label>
          {t("discovery.category")}
          <select
            name="figure_category"
            value={f.category}
            onChange={(e) => set({ ...f, category: e.target.value })}
          >
            <option value="all">
              {t("All")} ({catalog.length})
            </option>
            <option value="figures">
              {t("discovery.figures")} ({catalog.filter((p) => p.categoryKey === "figures").length})
            </option>
            <option value="accessories">
              {t("discovery.accessories")} (
              {catalog.filter((p) => p.categoryKey === "accessories").length})
            </option>
          </select>
        </label>
        <label>
          {t("discovery.collection")}
          <select
            name="figure_series"
            value={f.series}
            onChange={(e) => {
              set({ ...f, series: e.target.value });
              openFigures(e.target.value === "all" ? undefined : e.target.value);
            }}
          >
            <option value="all">{t("discovery.allCollections")}</option>
            {choices.map((g) => (
              <option key={g.slug} value={g.slug}>
                {title(g)} ({g.products.length})
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("discovery.searchFigures")}
          <input
            name="figure_search"
            placeholder={t("discovery.searchFigures")}
            value={f.query}
            onChange={(e) => set({ ...f, query: e.target.value })}
          />
        </label>
      </div>
      {status !== "success" ? (
        <ProductState status={status} retry={retry} />
      ) : (
        <>
          <div className="discovery-figure-groups">
            {groups.map((g) => (
              <section key={g.slug} className="discovery-figure-group" data-figure-group={g.slug}>
                <div className="discovery-group-heading">
                  <h3>{title(g)}</h3>
                  <button
                    className="discovery-text-button"
                    onClick={() => {
                      set({ ...f, series: g.slug });
                      openFigures(g.slug);
                    }}
                  >
                    {g.products.length} {t("discovery.objects")} ↗
                  </button>
                </div>
                <div className="product-grid discovery-figure-grid">
                  {g.products.map((p) => renderProduct(p))}
                </div>
              </section>
            ))}
          </div>
          {!groups.length && (
            <div className="discovery-empty" role="status">
              {t(f.category === "accessories" ? "discovery.noAccessories" : "No products found.")}
            </div>
          )}
        </>
      )}
    </section>
  );
  return embedded ? (
    body
  ) : (
    <main className="discovery-surface discovery-collections-page">{body}</main>
  );
}
