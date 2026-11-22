import type { Product } from "../types/product";
export const HERO_SERIES_SLUGS = ["one-piece", "attack-on-titan", "naruto", "dragon-ball"] as const;
export type SeriesGroup = {
  id: number;
  slug: string;
  title: string;
  description_vi: string | null;
  description_en: string | null;
  products: Product[];
  cover: Product;
  volumeCount: number | null;
  inStockCount: number;
  minPrice: number;
  maxPrice: number;
};
export type VolumeFilters = { query: string; direction: "asc" | "desc"; inStock: boolean };
export type DiscoveryFilters = {
  query: string;
  volumes: Record<string, VolumeFilters>;
  figure: { query: string; category: string; series: string };
};
export const initialDiscoveryFilters: DiscoveryFilters = {
  query: "",
  volumes: {},
  figure: { query: "", category: "all", series: "all" },
};
export const defaultVolumeFilters: VolumeFilters = { query: "", direction: "asc", inStock: false };
export const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
export function volumeOf(p: Product): number | null {
  const values = new Set<number>();
  for (const original of [p.api?.name_vi, p.api?.name_en]) {
    if (!original) continue;
    const name = fold(original);
    // Box/range editions cannot be safely represented by one volume number.
    if (/\b(?:tap|vol(?:ume)?\.?)\s*\d+[.,]\d+/.test(name)) return null;
    if (
      /\b(?:box|combo|omnibus|volumes)\b|\b(?:tap|vol(?:ume)?\.?)\s*\d+\s*(?:[-–—&/+]|to|den|va|and)\s*\d+/.test(
        name,
      )
    )
      return null;
    for (const m of name.matchAll(/\b(?:tap|vol(?:ume)?\.?)\s*(\d+)\b/g)) {
      const n = Number(m[1]);
      if (!Number.isSafeInteger(n) || n < 1) return null;
      values.add(n);
    }
  }
  return values.size === 1 ? [...values][0] : null;
}
export function sortVolumes(products: Product[], direction: "asc" | "desc" = "asc"): Product[] {
  return [...products].sort((a, b) => {
    const x = volumeOf(a),
      y = volumeOf(b);
    if (x === null && y !== null) return 1;
    if (y === null && x !== null) return -1;
    return (x !== null && y !== null ? (x - y) * (direction === "asc" ? 1 : -1) : 0) || a.id - b.id;
  });
}
export function mangaSeries(products: Product[]): SeriesGroup[] {
  const groups = new Map<number, SeriesGroup>();
  for (const p of products) {
    const s = p.api?.series;
    if (p.source !== "api" || p.categoryKey !== "manga" || !s || s.is_active === false) continue;
    let group = groups.get(s.id);
    if (!group) {
      group = {
        id: s.id,
        slug: s.slug,
        title: s.title,
        description_vi: s.description_vi ?? null,
        description_en: s.description_en ?? null,
        products: [],
        cover: p,
        volumeCount: null,
        inStockCount: 0,
        minPrice: p.price,
        maxPrice: p.price,
      };
      groups.set(s.id, group);
    }
    group.products.push(p);
  }
  for (const g of groups.values()) {
    g.products = sortVolumes(g.products);
    g.cover = g.products.find((p) => p.api?.image_url) ?? g.products[0];
    const numbers = g.products.map(volumeOf);
    g.volumeCount = numbers.every((n) => n !== null) ? new Set(numbers).size : null;
    g.inStockCount = g.products.filter((p) => (p.stockQuantity ?? 0) > 0).length;
    g.minPrice = Math.min(...g.products.map((p) => p.price));
    g.maxPrice = Math.max(...g.products.map((p) => p.price));
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
}
export const seriesMatches = (group: SeriesGroup, q: string) =>
  fold(
    [
      group.title,
      ...group.products.flatMap((p) => [p.api?.name_vi ?? "", p.api?.name_en ?? ""]),
    ].join(" "),
  ).includes(fold(q));
export function filterVolumes(products: Product[], filters: VolumeFilters): Product[] {
  const q = fold(filters.query),
    exact = q.match(/^(?:(?:tap|vol(?:ume)?\.?)\s*)?(\d+)$/);
  return sortVolumes(
    products.filter(
      (p) =>
        (!filters.inStock || (p.stockQuantity ?? 0) > 0) &&
        (exact
          ? volumeOf(p) === Number(exact[1])
          : fold([p.api?.name_vi, p.api?.name_en, p.api?.sku].join(" ")).includes(q)),
    ),
    filters.direction,
  );
}
export const merchandise = (products: Product[]) =>
  products.filter(
    (p) => p.source === "api" && ["figures", "accessories"].includes(p.categoryKey ?? ""),
  );
export function figureGroups(products: Product[], filters: DiscoveryFilters["figure"]) {
  const groups = new Map<string, { slug: string; title: string; products: Product[] }>();
  for (const p of merchandise(products)) {
    const slug = p.api?.series?.slug ?? "unclassified";
    if (filters.category !== "all" && p.categoryKey !== filters.category) continue;
    if (filters.series !== "all" && slug !== filters.series) continue;
    if (
      !fold([p.api?.name_vi, p.api?.name_en, p.api?.series?.title].join(" ")).includes(
        fold(filters.query),
      )
    )
      continue;
    let g = groups.get(slug);
    if (!g) {
      g = { slug, title: p.api?.series?.title ?? "", products: [] };
      groups.set(slug, g);
    }
    g.products.push(p);
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export function heroSeries(groups: SeriesGroup[]): SeriesGroup[] {
  const preferred = HERO_SERIES_SLUGS.flatMap((slug) => {
    const g = groups.find((s) => s.slug === slug);
    return g ? [g] : [];
  });
  return [...preferred, ...groups.filter((g) => !preferred.includes(g))].slice(0, 4);
}
