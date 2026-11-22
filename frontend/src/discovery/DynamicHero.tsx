import { useEffect, useMemo, useState } from "react";
import { useProducts } from "../hooks/useProducts";
import { useI18n } from "../i18n";
import { featuredManga } from "../config/featuredManga";
import { ProductImage } from "../components/ProductImage";
import { ProductState } from "../components/ProductState";
import { HERO_SERIES_SLUGS, mangaSeries, heroSeries } from "./catalogModel";
import "./discovery.css";
export function DynamicHero({
  openSeries,
  openFigures,
}: {
  openSeries: (slug: string) => void;
  openFigures: () => void;
}) {
  const { products, status, retry } = useProducts(),
    { t, language } = useI18n();
  const series = useMemo(() => mangaSeries(products), [products]);
  const slides = heroSeries(series);
  const [selected, setSelected] = useState<string>(HERO_SERIES_SLUGS[0]),
    [paused, setPaused] = useState(false),
    [hover, setHover] = useState(false),
    [focus, setFocus] = useState(false),
    [hidden, setHidden] = useState(document.hidden),
    [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const index = Math.max(
      0,
      slides.findIndex((s) => s.slug === selected),
    ),
    key = slides.map((s) => s.slug).join("|");
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)"),
      motion = () => setReduced(mq.matches),
      visibility = () => setHidden(document.hidden);
    mq.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mq.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (status !== "success" || slides.length < 2 || paused || hover || focus || hidden || reduced)
      return;
    const timer = window.setTimeout(
      () => setSelected(slides[(index + 1) % slides.length].slug),
      6000,
    );
    return () => window.clearTimeout(timer);
  }, [status, key, index, paused, hover, focus, hidden, reduced]);
  const move = (delta: number) => {
    if (slides.length) setSelected(slides[(index + delta + slides.length) % slides.length].slug);
  };
  return (
    <section
      className="hero-live"
      data-live-hero
      data-product-text
      role="region"
      aria-roledescription="carousel"
      aria-label={t("discovery.heroLabel")}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setFocus(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false);
      }}
    >
      {status !== "success" ? (
        <ProductState status={status} retry={retry} />
      ) : !slides.length ? (
        <ProductState status="empty" />
      ) : (
        <>
          {slides.map((s, i) => {
            const active = i === index,
              cfg = featuredManga.find((c) => c.slug === s.slug),
              description =
                (language === "vi" ? s.description_vi : s.description_en) ||
                cfg?.description[language];
            return (
              <article
                key={s.slug}
                data-hero-series={s.slug}
                className={`hero-live-slide ${active ? "active" : ""}`}
                aria-hidden={!active}
                inert={!active}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} / ${slides.length}`}
              >
                <div className="hero-live-copy">
                  <p className="discovery-kicker">
                    MANGA UNIVERSE / {String(i + 1).padStart(2, "0")}
                  </p>
                  <h1>{s.title}</h1>
                  {description && <p className="hero-live-description">{description}</p>}
                  <p>
                    {s.volumeCount === null
                      ? `${s.products.length} ${t("discovery.editions")}`
                      : `${s.volumeCount} ${t("discovery.volumesAvailable")}`}
                  </p>
                  <div className="hero-live-actions">
                    <button className="ink-btn" onClick={() => openSeries(s.slug)}>
                      {t("discovery.exploreSeries")} ↗
                    </button>
                    <button className="hero-live-secondary" onClick={openFigures}>
                      {t("discovery.figureLink")}
                    </button>
                  </div>
                </div>
                <div className="hero-live-art">
                  <div className="hero-live-hatch" />
                  <ProductImage src={s.cover.image} alt={s.cover.name} />
                  {!s.cover.api?.image_url && <span>{t("discovery.noImage")}</span>}
                  <span className="hero-live-edition">{s.cover.name}</span>
                </div>
              </article>
            );
          })}
          <div className="hero-live-controls">
            <button onClick={() => move(-1)} aria-label={t("discovery.previousSlide")}>
              ←
            </button>
            <span aria-live="off">
              {String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
            </span>
            <button onClick={() => move(1)} aria-label={t("discovery.nextSlide")}>
              →
            </button>
            <div className="hero-live-dots">
              {slides.map((s, i) => (
                <button
                  key={s.slug}
                  aria-current={i === index ? "true" : undefined}
                  aria-label={t("discovery.slide") + " " + s.title}
                  onClick={() => setSelected(s.slug)}
                >
                  <span />
                </button>
              ))}
            </div>
            <button
              className="hero-live-pause"
              disabled={reduced}
              aria-pressed={paused || reduced}
              onClick={() => setPaused((v) => !v)}
            >
              {t(paused || reduced ? "discovery.play" : "discovery.pause")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
