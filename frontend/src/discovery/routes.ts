export function discoveryRoute(
  hash: string,
): {
  page: "home" | "shop" | "about" | "series" | "collections" | "product";
  slug: string | null;
  id: number | null;
} | null {
  if (hash === "#about/contact") return { page: "about", slug: null, id: null };
  if (["#home", "#shop", "#about", "#manifesto"].includes(hash))
    return {
      page: hash === "#manifesto" ? "about" : (hash.slice(1) as "home" | "shop" | "about"),
      slug: null,
      id: null,
    };
  const match = hash.match(/^#(series|collections)(?:\/([a-z0-9]+(?:-[a-z0-9]+)*))?$/);
  if (match && (!match[2] || match[2].length <= 160))
    return { page: match[1] as "series" | "collections", slug: match[2] ?? null, id: null };
  const product = hash.match(/^#product\/([1-9][0-9]{0,14})$/);
  if (product && Number.isSafeInteger(Number(product[1])))
    return { page: "product", slug: null, id: Number(product[1]) };
  return null;
}
