import { useI18n } from "../i18n";
import "../discovery/editorial-ui.css";
import "./about.css";

type Destination = "series" | "shop" | "collections";
export function AboutPage({ go }: { go: (page: Destination) => void }) {
  const { t } = useI18n();
  const worlds = [
    { key: "manga", page: "series", cta: "seriesCta" },
    { key: "novel", page: "shop", cta: "shopCta" },
    { key: "figure", page: "collections", cta: "figureCta" },
  ] as const;
  return (
    <main className="about-page" data-about-page data-product-text>
      <section className="about-hero">
        <p className="about-kicker">01 / {t("about.label")}</p>
        <h1>
          {t("about.title")}
          <br />
          <span>{t("about.outline")}</span>
        </h1>
        <p className="about-intro">{t("about.intro")}</p>
        <div className="about-art" aria-hidden="true">
          <img src="/featured-manga/naruto.jpg" alt="" />
          <img src="/featured-manga/one-piece.jpg" alt="" />
        </div>
      </section>
      <section className="about-story">
        <p className="about-kicker">02 / MANGA UNIVERSE</p>
        <h2>{t("about.storyTitle")}</h2>
        <p>{t("about.story")}</p>
      </section>
      <section className="about-worlds">
        <h2>{t("about.worlds")}</h2>
        <div className="about-grid">
          {worlds.map((world, index) => (
            <article key={world.key}>
              <span className="about-number">0{index + 1}</span>
              <h3>{t(`about.${world.key}`)}</h3>
              <p>{t(`about.${world.key}Text`)}</p>
              <button className="ink-btn" onClick={() => go(world.page)}>
                <span>{t(`about.${world.cta}`)}</span>
                <span aria-hidden="true">↗</span>
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="about-values">
        <h2>{t("about.spirit")}</h2>
        <div className="about-grid">
          {["discover", "collect", "connect"].map((key) => (
            <article key={key}>
              <h3>{t(`about.${key}`)}</h3>
              <p>{t(`about.${key}Text`)}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="about-ending">
        <h2>{t("about.next")}</h2>
        <div>
          <button className="ink-btn" onClick={() => go("series")}>
            <span>{t("about.seriesCta")}</span>
            <span aria-hidden="true">↗</span>
          </button>
          <button className="ink-btn ink-btn-ghost" onClick={() => go("shop")}>
            <span>{t("about.shopCta")}</span>
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </section>
    </main>
  );
}
