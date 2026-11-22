import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { useProducts } from "../../hooks/useProducts";
import { useAuth } from "../../contexts/AuthContext";
import "./manga-flipbook-loader.css";
/** Startup only: mounted alongside StoreApp, never remounted by its page changes. */
export function MangaFlipbookLoader() {
  const { t } = useI18n(),
    { status } = useProducts(),
    { loading } = useAuth();
  const adminStartup = useRef(window.location.hash.startsWith("#admin"));
  const [phase, setPhase] = useState<"loading" | "leaving" | "gone">("loading");
  const finish = useCallback(() => setPhase((p) => (p === "loading" ? "leaving" : p)), []);
  const ready = adminStartup.current ? !loading : status !== "loading";
  useEffect(() => {
    if (ready) finish();
  }, [ready, finish]);
  useEffect(() => {
    const timer = window.setTimeout(finish, 13000);
    const navigate = () => finish();
    window.addEventListener("hashchange", navigate);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", navigate);
    };
  }, [finish]);
  useEffect(() => {
    if (phase !== "leaving") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setPhase("gone"), reduced ? 0 : 160);
    return () => window.clearTimeout(timer);
  }, [phase]);
  if (phase === "gone") return null;
  return (
    <div
      className={`manga-startup-loader ${phase}`}
      data-manga-loader
      data-product-text
      role="status"
      aria-live="polite"
      aria-busy={phase === "loading"}
    >
      <div className="manga-flipbook" aria-hidden="true">
        <div className="manga-book-cover" />
        <div className="manga-paper manga-paper-left">
          <Panels />
        </div>
        <div className="manga-paper manga-paper-right">
          <Panels />
        </div>
        <div className="manga-spine" />
        {Array.from({ length: 6 }, (_, i) => (
          <div className="manga-turning-page" key={i} style={{ animationDelay: `${-i * 0.3}s` }}>
            <div className="manga-page-front">
              <Panels />
            </div>
            <div className="manga-page-back">
              <Panels />
            </div>
          </div>
        ))}
      </div>
      <p className="manga-loading-title">{t("loader.title")}</p>
      <p className="manga-loading-caption">{t("loader.caption")}</p>
    </div>
  );
}
function Panels() {
  return (
    <div className="manga-page-panels">
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}
