import { MAX_QUERY_LENGTH } from "./searchEngine";
export function shopQuery(hash = window.location.hash): string | null {
  if (!/^#shop(?:\?|$)/.test(hash)) return null;
  return new URLSearchParams(hash.split("?")[1] ?? "").get("q")?.slice(0, MAX_QUERY_LENGTH) ?? "";
}
export function openSearchResults(query: string) {
  const hash = "#shop?q=" + encodeURIComponent(query.trim().slice(0, MAX_QUERY_LENGTH));
  if (window.location.hash !== hash) window.location.hash = hash;
  else window.dispatchEvent(new HashChangeEvent("hashchange"));
}
