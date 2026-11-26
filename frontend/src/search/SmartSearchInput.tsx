import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Product } from "../types/product";
import { useI18n } from "../i18n";
import { MAX_QUERY_LENGTH, safeSearch, localizedSearchProducts, parseSearch } from "./searchEngine";
import "./smart-search.css";

export function useSearchQuery(value: string) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), 250);
    return () => clearTimeout(timer);
  }, [value]);
  return settled;
}
export function SmartSearchInput({
  value,
  onChange,
  products,
  onProduct,
  onAll,
  status = "success",
  retry,
  name = "shop_search",
  placeholder,
  autoFocus = false,
}: {
  value: string;
  onChange: (q: string) => void;
  products: Product[];
  onProduct: (p: Product) => void;
  onAll: (q: string) => void;
  status?: "loading" | "success" | "error";
  retry?: () => void;
  name?: string;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const { language, formatCurrency, t } = useI18n();
  const vi = language === "vi",
    id = useId(),
    input = useRef<HTMLInputElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(-1),
    [position, setPosition] = useState({ left: 0, top: 0, width: 0, height: 300 });
  const query = useSearchQuery(value);
  const result = useMemo(
    () => safeSearch(localizedSearchProducts(products, t), query),
    [products, query, t],
  );
  const parsed = useMemo(() => parseSearch(query), [query]);
  const demoPrice =
    products.length > 0 &&
    products.every((p) => p.source !== "api") &&
    (parsed.min !== undefined || parsed.max !== undefined);
  const hits = result.hits.slice(0, 6),
    eligible = value.trim().length >= 2,
    visible = open && eligible;
  const pending = query !== value || status === "loading";
  const ready = !pending && status !== "error";
  useEffect(() => setActive(-1), [value, products]);
  useEffect(() => {
    if (!visible) return;
    let frame = 0;
    const locate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = input.current?.getBoundingClientRect();
        if (!r) return;
        // Keep mobile Sort/Filter controls reachable while suggestions are open.
        const toolbar = matchMedia("(max-width:760px)").matches
          ? input.current?.closest(".shop-toolbar")?.getBoundingClientRect()
          : null;
        const bottom = toolbar?.bottom ?? r.bottom;
        const height = window.visualViewport?.height ?? innerHeight,
          below = height - bottom - 18,
          above = r.top - 18;
        if (r.bottom < 0 || r.top > height) {
          setOpen(false);
          return;
        }
        const available = Math.max(80, Math.min(440, below >= 160 ? below : above));
        setPosition({
          left: Math.max(8, Math.min(r.left, innerWidth - r.width - 8)),
          top: below >= 160 ? bottom + 6 : Math.max(8, r.top - available - 6),
          width: Math.min(r.width, innerWidth - 16),
          height: available,
        });
      });
    };
    const outside = (e: PointerEvent) => {
      if (!input.current?.contains(e.target as Node) && !panel.current?.contains(e.target as Node))
        setOpen(false);
    };
    locate();
    window.addEventListener("resize", locate);
    window.addEventListener("scroll", locate, true);
    document.addEventListener("pointerdown", outside);
    window.visualViewport?.addEventListener("resize", locate);
    window.visualViewport?.addEventListener("scroll", locate);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", locate);
      window.removeEventListener("scroll", locate, true);
      document.removeEventListener("pointerdown", outside);
      window.visualViewport?.removeEventListener("resize", locate);
      window.visualViewport?.removeEventListener("scroll", locate);
    };
  }, [visible]);
  useEffect(() => {
    if (active >= 0)
      panel.current
        ?.querySelector(`#${CSS.escape(id + "-" + active)}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, id]);
  const all = () => {
    setOpen(false);
    onAll(value.trim());
  };
  return (
    <>
      <input
        ref={input}
        id={name}
        name={name}
        type="search"
        enterKeyHint="search"
        value={value}
        maxLength={MAX_QUERY_LENGTH}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={visible ? id : undefined}
        aria-activedescendant={visible && ready && active >= 0 ? id + "-" + active : undefined}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          if (!panel.current?.contains(e.relatedTarget as Node)) setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Escape" && visible) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            setActive(-1);
          }
          if ((e.key === "ArrowDown" || e.key === "ArrowUp") && eligible) {
            e.preventDefault();
            setOpen(true);
            if (ready && hits.length)
              setActive((a) =>
                e.key === "ArrowDown" ? (a + 1) % hits.length : a <= 0 ? hits.length - 1 : a - 1,
              );
          }
          if (e.key === "Enter") {
            e.preventDefault();
            if (visible && ready && active >= 0 && hits[active]) {
              setOpen(false);
              onProduct(hits[active].product);
            } else all();
          }
        }}
      />
      {visible &&
        createPortal(
          <div
            className="manga-search-suggestions"
            ref={panel}
            style={{
              left: position.left,
              top: position.top,
              width: position.width,
              maxHeight: position.height,
              visibility: position.width ? "visible" : "hidden",
            }}
            data-smart-search
            data-product-text
          >
            <div role="status" className="manga-search-status">
              {pending
                ? vi
                  ? "Đang tìm kiếm…"
                  : "Searching…"
                : status === "error"
                  ? vi
                    ? "Không tải được catalog. Bạn vẫn có thể mở Cửa hàng."
                    : "Catalog unavailable. You can still open Shop."
                  : result.fallback
                    ? vi
                      ? "Đang dùng tìm kiếm cơ bản."
                      : "Using basic search."
                    : demoPrice
                      ? vi
                        ? "Bộ lọc giá VND chỉ áp dụng cho catalog Live. Giá Demo sử dụng USD."
                        : "VND price queries apply to the Live catalog. Demo prices use USD."
                      : hits.length
                        ? vi
                          ? "GỢI Ý SẢN PHẨM"
                          : "PRODUCT SUGGESTIONS"
                        : vi
                          ? "Không tìm thấy sản phẩm phù hợp. Hãy thử bỏ bớt điều kiện."
                          : "No matching products. Try fewer conditions."}
            </div>
            <div role="listbox" id={id} aria-label={vi ? "Gợi ý sản phẩm" : "Product suggestions"}>
              {ready &&
                hits.map((hit, i) => {
                  const p = hit.product;
                  return (
                    <a
                      key={p.id}
                      id={id + "-" + i}
                      role="option"
                      aria-selected={active === i}
                      tabIndex={-1}
                      href={p.source === "api" ? "#product/" + p.id : "#product/demo/" + p.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onPointerMove={() => setActive(i)}
                      onClick={(e) => {
                        e.preventDefault();
                        setOpen(false);
                        onProduct(p);
                      }}
                    >
                      <img src={p.image} alt="" loading="lazy" />
                      <span>
                        <strong>{p.source === "api" ? p.name : t(p.name)}</strong>
                        <small>{p.series || p.category}</small>
                        <b>{formatCurrency(p.price, p.source === "api" ? "VND" : "USD")}</b>
                        {p.source === "api" && (
                          <small>
                            {(p.stockQuantity ?? 0) > 0
                              ? vi
                                ? "Còn hàng"
                                : "In stock"
                              : vi
                                ? "Hết hàng"
                                : "Out of stock"}
                          </small>
                        )}
                      </span>
                    </a>
                  );
                })}
            </div>
            {status === "error" && retry && (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={retry}>
                {vi ? "THỬ LẠI" : "RETRY"}
              </button>
            )}
            <button
              type="button"
              className="manga-search-all"
              onMouseDown={(e) => e.preventDefault()}
              onClick={all}
            >
              {vi ? "XEM TẤT CẢ KẾT QUẢ" : "VIEW ALL RESULTS"} →
            </button>
          </div>,
          input.current?.closest("dialog") ?? document.body,
        )}
    </>
  );
}
