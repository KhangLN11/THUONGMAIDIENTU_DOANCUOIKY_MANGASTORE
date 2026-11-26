import { useEffect } from "react";
import { useI18n } from "../i18n";
import { EditorialTitle } from "../discovery/EditorialTitle";
import {
  contactInformation as contact,
  contactMapUrl,
  contactMapEmbedUrl,
} from "./contactInformation";

export function AboutContact() {
  const { t } = useI18n();
  useEffect(() => {
    let frame = 0;
    const reveal = () => {
      cancelAnimationFrame(frame);
      if (window.location.hash === "#about/contact")
        frame = requestAnimationFrame(() =>
          document
            .getElementById("about-contact")
            ?.scrollIntoView({ block: "start", behavior: "instant" }),
        );
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    window.addEventListener("popstate", reveal);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", reveal);
      window.removeEventListener("popstate", reveal);
    };
  }, []);
  const channels = [
    { key: "email", value: contact.email, href: `mailto:${contact.email}`, action: "emailAction" },
    { key: "phone", value: contact.phone, href: contact.phoneHref, action: "phoneAction" },
    {
      key: "facebook",
      value: t("about16b.facebookName"),
      href: contact.facebook,
      action: "facebookAction",
    },
  ];
  return (
    <>
      <section className="about-contact" id="about-contact" aria-labelledby="about-contact-heading">
        <p className="about-kicker">05 / {t("about16b.contactLabel")}</p>
        <div className="about-contact-heading">
          <h2 id="about-contact-heading">
            <EditorialTitle
              text={`${t("about16b.contactSolid")} ${t("about16b.contactOutline")}`}
              viWords={2}
              enWords={2}
            />
          </h2>
          <p>{t("about16b.contactIntro")}</p>
        </div>
        <div className="about-contact-channels">
          {channels.map(({ key, value, href, action }, i) => (
            <a
              className={`about-contact-channel about-contact-${key}`}
              key={key}
              href={href}
              target={key === "facebook" ? "_blank" : undefined}
              rel={key === "facebook" ? "noopener noreferrer" : undefined}
            >
              <span className="about-channel-label">
                0{i + 1} / {t(`about16b.${key}`)}
              </span>
              <span className="about-contact-value">
                {key === "email" ? (
                  <>
                    {value.split("@")[0]}
                    <wbr />@{value.split("@")[1]}
                  </>
                ) : (
                  value
                )}
              </span>
              <span className="about-contact-action">
                {t(`about16b.${action}`)} <span aria-hidden="true">↗</span>
              </span>
            </a>
          ))}
        </div>
      </section>
      <section className="about-map" aria-labelledby="about-map-heading">
        <div className="about-map-copy">
          <p className="about-kicker">06 / {t("about16b.mapLabel")}</p>
          <h2 id="about-map-heading">{t("about16b.mapTitle")}</h2>
          <p className="about-map-field-label">{t("about16b.mapAddressLabel")}</p>
          <p>{t("about16b.mapNote")}</p>
          <p className="about-map-field-label">{t("about16b.mapCoordinatesLabel")}</p>
          <p className="about-map-coordinates">{contact.coordinates.replace(",", ", ")}</p>
          <a
            className="ink-btn"
            href={contactMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${t("about16b.openMap")} — ${t("about16b.newTab")}`}
          >
            <span>{t("about16b.openMap")}</span>
            <span aria-hidden="true">↗</span>
          </a>
          <p className="about-map-fallback">{t("about16b.mapFallback")}</p>
        </div>
        <div className="about-map-frame">
          <iframe
            src={contactMapEmbedUrl}
            title={t("about16b.mapFrame")}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </section>
    </>
  );
}
