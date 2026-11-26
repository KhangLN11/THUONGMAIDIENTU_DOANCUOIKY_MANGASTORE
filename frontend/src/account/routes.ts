export type AccountView = "overview" | "orders" | "information";
export const orderStatuses = [
  "pending",
  "confirmed",
  "processing",
  "shipping",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export function accountRoute(hash = location.hash) {
  const [path, search = ""] = hash.split("?"),
    q = new URLSearchParams(search),
    match = path.match(/^#account\/orders\/([1-9][0-9]{0,14})$/);
  const status = q.get("status") ?? "all";
  return {
    view: (path === "#account/information"
      ? "information"
      : path.startsWith("#account/orders")
        ? "orders"
        : "overview") as AccountView,
    id: match ? Number(match[1]) : null,
    status: orderStatuses.some((s) => s === status) ? status : "all",
    page: /^[1-9][0-9]{0,6}$/.test(q.get("page") ?? "") ? Number(q.get("page")) : 1,
  };
}
export function accountHref(view: AccountView, id: number | null = null, status = "all", page = 1) {
  const path =
    view === "overview"
      ? "#account"
      : view === "information"
        ? "#account/information"
        : "#account/orders" + (id ? "/" + id : "");
  const q = new URLSearchParams();
  if (status !== "all") q.set("status", status);
  if (page > 1) q.set("page", String(page));
  return path + (q.size ? "?" + q : "");
}
export function navigateAccount(hash: string, replace = false) {
  if (replace) history.replaceState(null, "", hash);
  else history.pushState(null, "", hash);
  dispatchEvent(new HashChangeEvent("hashchange"));
}
