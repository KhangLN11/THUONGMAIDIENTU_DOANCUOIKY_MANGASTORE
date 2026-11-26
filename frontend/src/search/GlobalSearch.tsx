import { useEffect, useRef, useState } from "react";
import { useProducts } from "../hooks/useProducts";
import { useI18n } from "../i18n";
import type { Product } from "../types/product";
import { SmartSearchInput } from "./SmartSearchInput";
import { openSearchResults } from "./searchRoute";
export function GlobalSearch({
  onClose,
  onProduct,
}: {
  onClose: () => void;
  onProduct: (p: Product) => void;
}) {
  const { products, status, retry } = useProducts(),
    { language, t } = useI18n();
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!opener.current) opener.current = document.activeElement as HTMLElement;
    element?.showModal();
    element?.querySelector("input")?.focus();
    return () => {
      requestAnimationFrame(() => {
        if (!element?.isConnected) {
          if (opener.current?.isConnected && opener.current.getClientRects().length)
            opener.current.focus();
          else document.querySelector<HTMLButtonElement>(".site-header .menu")?.focus();
        }
      });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="manga-search-dialog"
      aria-label={t("Search")}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onClose();
          openSearchResults(query);
        }}
      >
        <label>
          {t("Search")}
          <SmartSearchInput
            name="global_search"
            value={query}
            onChange={setQuery}
            products={products}
            status={status}
            retry={retry}
            placeholder={t("shop.search")}
            onProduct={(p) => {
              onClose();
              onProduct(p);
            }}
            onAll={(q) => {
              onClose();
              openSearchResults(q);
            }}
          />
        </label>
        <button
          type="button"
          aria-label={language === "vi" ? "\u0110\u00f3ng t\u00ecm ki\u1ebfm" : "Close search"}
          onClick={onClose}
        >
          &times;
        </button>
      </form>
    </dialog>
  );
}
