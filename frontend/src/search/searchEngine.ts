import type { Product } from "../types/product";
import { volumeOf } from "../discovery/catalogModel";

export const MAX_QUERY_LENGTH = 160;
const plain = (value: string) =>
  value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
    .replace(/\u0111/g, "d")
    .normalize("NFC");
export const normalizeSearch = (value: string) =>
  plain(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
// Curated spellings, bound only when the referenced series actually exists in this catalog.
// Canonical titles/slugs verified against manga_series in Phase17A. No inferred genre aliases.
export const SERIES_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "attack-on-titan": ["aot", "attack titan", "dai chien titan"],
  "one-piece": ["onepiece"],
};
const categoryTerms: Record<string, string[]> = {
  manga: ["truyen tranh", "manga", "truyen"],
  novels: [
    "tieu thuyet nhat ban",
    "tieu thuyet nhat",
    "tieu thuyet",
    "light novel",
    "novels",
    "novel",
  ],
  figures: ["anime figures", "anime figure", "mo hinh", "figures", "figure"],
  accessories: ["phu kien", "accessories", "accessory"],
};
export type ParsedQuery = {
  text: string;
  normalized: string;
  category?: string;
  min?: number;
  max?: number;
  volume?: number;
  inStock: boolean;
  invalid: boolean;
};
const amountPattern = String.raw`(?:\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)(?:\s*(?:nghin|ngan|thousand|k|vnd|dong|đ|d))?`;
function amount(value: string): number | null {
  const m = value.trim().match(/^(.*?)(?:\s*(nghin|ngan|thousand|k|vnd|dong|đ|d))?$/);
  if (!m) return null;
  let n = m[1].trim();
  const thousands = /^(?:\d{1,3})(?:[.,]\d{3})+$/.test(n);
  if (thousands) n = n.replace(/[.,]/g, "");
  else if (/[.,]/.test(n)) {
    if (!m[2] || !["k", "nghin", "ngan", "thousand"].includes(m[2])) return null;
    n = n.replace(",", ".");
  }
  const result = Number(n) * (m[2] && ["k", "nghin", "ngan", "thousand"].includes(m[2]) ? 1000 : 1);
  return Number.isSafeInteger(result) && result >= 0 && result <= 99999999999999 ? result : null;
}
export function parseSearch(query: string): ParsedQuery {
  const result: ParsedQuery = {
    text: "",
    normalized: normalizeSearch(query.slice(0, MAX_QUERY_LENGTH)),
    inStock: false,
    invalid: query.length > MAX_QUERY_LENGTH,
  };
  if (query.trim() && !result.normalized) result.invalid = true;
  let rest = plain(query.slice(0, MAX_QUERY_LENGTH)).replace(/\s+/g, " ").trim();
  const consumePrice = (kind: string, raw: string) => {
    const n = amount(raw);
    if (n === null) {
      result.invalid = true;
      return;
    }
    if (kind === "min") result.min = Math.max(result.min ?? 0, n);
    else result.max = Math.min(result.max ?? Infinity, n);
  };
  rest = rest.replace(
    new RegExp(
      String.raw`\b(?:tu|from)\s+(${amountPattern})\s+(?:den|to)\s+(${amountPattern})(?![\p{L}\p{N}])`,
      "gu",
    ),
    (_, low, high) => {
      consumePrice("min", low);
      consumePrice("max", high);
      return " ";
    },
  );
  rest = rest.replace(
    new RegExp(
      String.raw`\b(duoi|under|below|tren|over|above)\s+(${amountPattern})(?![\p{L}\p{N}])`,
      "gu",
    ),
    (_, op, raw) => {
      const n = amount(raw);
      if (n === null) result.invalid = true;
      else if (["duoi", "under", "below"].includes(op)) consumePrice("max", String(n - 1));
      else consumePrice("min", String(n + 1));
      return " ";
    },
  );
  if (/\b(?:duoi|under|below|tren|over|above|tu|from)\s+(?:-|\d)/.test(rest)) result.invalid = true;
  if (
    /\b(?:tap|quyen|vol(?:ume)?\.?)\s*\d+[.,]\d|\b(?:tap|quyen|vol(?:ume)?\.?)\s*\d+\s*[-\u2013\u2014/]\s*\d/.test(
      rest,
    )
  )
    result.invalid = true;
  rest = rest.replace(/\b(?:tap|quyen|vol(?:ume)?\.?)\s*(\d+)\b/g, (_, n) => {
    const value = Number(n);
    if (
      !Number.isSafeInteger(value) ||
      value < 1 ||
      (result.volume !== undefined && result.volume !== value)
    )
      result.invalid = true;
    result.volume = value;
    return " ";
  });
  if (/\b(?:tap|quyen|vol(?:ume)?\.?)\s*(?:-|\d)/.test(rest)) result.invalid = true;
  rest = rest.replace(/\b(?:con hang|in stock)\b/g, () => {
    result.inStock = true;
    return " ";
  });
  // Longer phrases must be removed before single-word synonyms.
  const terms = Object.entries(categoryTerms)
    .flatMap(([key, values]) => values.map((term) => ({ key, term })))
    .sort((a, b) => b.term.length - a.term.length);
  for (const { key, term } of terms)
    rest = rest.replace(new RegExp(String.raw`\b${term}\b`, "g"), () => {
      if (result.category && result.category !== key) result.invalid = true;
      result.category = key;
      return " ";
    });
  if ((result.min ?? 0) > (result.max ?? Infinity)) result.invalid = true;
  result.text = normalizeSearch(rest);
  return result;
}
type SearchProduct = Product & { searchOriginalName?: string };
const demoLabels = new WeakMap<Product[], Map<(s: string) => string, Product[]>>();
export function localizedSearchProducts(
  products: Product[],
  translate: (s: string) => string,
): Product[] {
  if (products.some((p) => p.source === "api")) return products;
  let labels = demoLabels.get(products);
  if (!labels) {
    labels = new Map();
    demoLabels.set(products, labels);
  }
  let result = labels.get(translate);
  if (!result) {
    result = products.map((p) => ({ ...p, searchOriginalName: p.name, name: translate(p.name) }));
    if (labels.size >= 2) labels.clear();
    labels.set(translate, result);
  }
  return result;
}
export type SearchEntry = {
  product: Product;
  names: string[];
  series: string[];
  seriesKey: string;
  sku: string;
  description: string;
  tokens: string[];
  category: string;
  volume: number | null;
  aliases: string[];
};
const cache = new WeakMap<Product[], SearchEntry[]>();
export function indexProducts(products: Product[]): SearchEntry[] {
  const cached = cache.get(products);
  if (cached) return cached;
  const index = products.map((product) => {
    const names = [
      ...new Set(
        [
          product.api?.name_vi,
          product.api?.name_en,
          product.name,
          (product as SearchProduct).searchOriginalName,
        ]
          .filter((s): s is string => !!s)
          .map(normalizeSearch),
      ),
    ];
    const seriesKey =
      product.api?.series?.slug ?? normalizeSearch(product.series).replace(/ /g, "-");
    const series = [
      ...new Set(
        [product.api?.series?.title, product.series, seriesKey]
          .filter((s): s is string => !!s)
          .map(normalizeSearch),
      ),
    ];
    return {
      product,
      names,
      series,
      seriesKey,
      sku: normalizeSearch(product.api?.sku ?? ""),
      description: normalizeSearch(
        [product.api?.description_vi, product.api?.description_en, product.description]
          .filter(Boolean)
          .join(" "),
      ).slice(0, 6000),
      tokens: [
        ...new Set(
          [
            ...names,
            ...series,
            normalizeSearch(
              [
                product.category,
                product.categoryKey,
                product.api?.category?.name_vi,
                product.api?.category?.name_en,
              ]
                .filter(Boolean)
                .join(" "),
            ),
          ]
            .join(" ")
            .split(" "),
        ),
      ],
      category:
        product.categoryKey ??
        (product.category === "Figures" ? "figures" : normalizeSearch(product.category)),
      volume: volumeOf(product),
      aliases: [...(SERIES_ALIASES[seriesKey] ?? [])],
    };
  });
  cache.set(products, index);
  return index;
}
// Bounded optimal-string-alignment distance: includes adjacent transposition.
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previousPrevious: number[] = [],
    previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        row[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        row[j] = Math.min(row[j], previousPrevious[j - 2] + 1);
    }
    if (Math.min(...row) > max) return max + 1;
    previousPrevious = previous;
    previous = row;
  }
  return previous[b.length];
}
function prefixMatch(value: string, query: string) {
  return value.startsWith(query) && (!/\d$/.test(query) || !/\d/.test(value[query.length] ?? ""));
}
export type SearchHit = { product: Product; score: number; reason: string };
export function searchProducts(
  products: Product[],
  query: string,
  options: { fuzzy?: boolean } = {},
): SearchHit[] {
  const parsed = parseSearch(query);
  if (parsed.invalid) return [];
  if (
    (parsed.min !== undefined || parsed.max !== undefined) &&
    products.length &&
    products.every((p) => p.source !== "api")
  )
    return [];
  const text = parsed.text,
    tokens = text.split(" ").filter(Boolean),
    hits: SearchHit[] = [];
  const skuLike = /\d/.test(text) || /\bsku\b/.test(text) || /^cat\b/.test(text);
  const entries = indexProducts(products);
  const aliasTargets = new Set(
    entries.filter((e) => e.aliases.includes(text)).map((e) => e.seriesKey),
  );
  for (const [candidate, e] of entries.entries()) {
    const p = e.product;
    if (
      (parsed.category && e.category !== parsed.category) ||
      p.price < (parsed.min ?? 0) ||
      p.price > (parsed.max ?? Infinity) ||
      (parsed.volume !== undefined && (e.category !== "manga" || e.volume !== parsed.volume)) ||
      (parsed.inStock && !(p.source === "api" && (p.stockQuantity ?? 0) > 0))
    )
      continue;
    let score = 0,
      reason = "conditions";
    if (!text) {
      score = 1;
    } else if (e.sku === text || (!!e.sku && e.sku === parsed.normalized)) {
      score = 1400;
      reason = "sku";
    } else if (e.names.includes(text) || e.names.includes(parsed.normalized)) {
      score = 1200;
      reason = "name";
    } else if (e.series.includes(text)) {
      score = 1100;
      reason = "series";
    } else if (e.sku && text.length >= 3 && prefixMatch(e.sku, text)) {
      score = 1060;
      reason = "sku-prefix";
    } else if (
      e.names.some((n) => prefixMatch(n, text)) ||
      e.series.some((n) => prefixMatch(n, text))
    ) {
      score = 900;
      reason = "prefix";
    } else if (
      tokens.every((t) => e.tokens.some((w) => w === t || (!/^\d+$/.test(t) && w.startsWith(t))))
    ) {
      score = 750;
      reason = "tokens";
    } else if (aliasTargets.has(e.seriesKey)) {
      score = 650;
      reason = "alias";
    } else if (e.description.includes(text) && text.length >= 3 && !skuLike) {
      score = 250;
      reason = "description";
    } else if (
      options.fuzzy !== false &&
      !skuLike &&
      candidate < 1000 &&
      tokens.length <= 8 &&
      tokens.some((t) => t.length >= 4)
    ) {
      let distance = 0,
        okay = true;
      for (const t of tokens) {
        if (e.tokens.includes(t)) continue;
        if (t.length < 4 || t.length > 48) {
          okay = false;
          break;
        }
        const limit = t.length >= 8 ? 2 : 1;
        const best = Math.min(
          ...e.tokens
            .filter((w) => w.length >= 4 && Math.abs(w.length - t.length) <= limit)
            .map((w) => editDistance(t, w, limit)),
          limit + 1,
        );
        if (best > limit) {
          okay = false;
          break;
        }
        distance += best;
      }
      if (okay && distance > 0) {
        score = 150 - distance;
        reason = "fuzzy";
      }
    }
    if (score)
      hits.push({ product: p, score: score + (parsed.volume !== undefined ? 40 : 0), reason });
  }
  return hits.sort((a, b) => b.score - a.score || a.product.id - b.product.id);
}
export function basicSearch(products: Product[], query: string): SearchHit[] {
  const text = normalizeSearch(query).slice(0, MAX_QUERY_LENGTH);
  return products
    .filter(
      (p) =>
        !text ||
        [p.name, p.series, p.api?.name_vi, p.api?.name_en, p.api?.sku]
          .filter(Boolean)
          .some((n) => normalizeSearch(n!).includes(text)),
    )
    .map((product) => ({ product, score: 1, reason: "basic" }));
}
export function safeSearch(
  products: Product[],
  query: string,
): { hits: SearchHit[]; fallback: boolean } {
  try {
    return { hits: searchProducts(products, query), fallback: false };
  } catch {
    try {
      return { hits: basicSearch(products, query), fallback: true };
    } catch {
      return { hits: [], fallback: true };
    }
  }
}
