import { useEffect, useState } from "react";
import type { AuthUser } from "../services/authService";
import { useI18n } from "../i18n";
import { USE_PRODUCTS_API } from "../config/products";
import { OrdersPanel } from "../components/OrdersPanel";
import { accountRoute, accountHref, navigateAccount } from "./routes";
import type { AccountOrderState } from "./accountService";
import "./account.css";
function Glyph({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    overview: "M3 10L12 3l9 7M5 9v12h5v-7h4v7h5V9",
    orders: "M3 7l9-4 9 4v10l-9 4-9-4V7zm0 0l9 5 9-5M12 12v9",
    processing: "M12 7v5l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    wishlist:
      "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8",
    information: "M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    logout: "M9 4H4v16h5M13 8l5 4-5 4M8 12h10",
    delivered: "M4 12l5 5L20 6",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      width="24"
      height="24"
      aria-hidden="true"
    >
      <path d={paths[kind] ?? paths.orders} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function AccountDashboard({
  user,
  wishes,
  wishlistPending,
  wishlistError,
  onRetryWishlist,
  onShop,
  onWishlist,
  onOrderChanged,
  onLogout,
  onAdmin,
  busy,
  error,
}: {
  user: AuthUser;
  wishes: number[];
  wishlistPending: boolean;
  wishlistError: string | null;
  onRetryWishlist: () => void;
  onShop: () => void;
  onWishlist: () => void;
  onOrderChanged: () => void;
  onLogout: () => void;
  onAdmin: () => void;
  busy: boolean;
  error: string | null;
}) {
  const { t, formatDate } = useI18n();
  const [route, setRoute] = useState(accountRoute),
    [orders, setOrders] = useState<AccountOrderState>({
      loading: USE_PRODUCTS_API,
      error: null,
      counts: null,
      total: null,
    });
  useEffect(() => {
    const update = () => setRoute(accountRoute());
    addEventListener("hashchange", update);
    addEventListener("popstate", update);
    return () => {
      removeEventListener("hashchange", update);
      removeEventListener("popstate", update);
    };
  }, []);
  const initials =
    user.full_name
      .trim()
      .split(/\s+/)
      .map((s) => Array.from(s)[0])
      .slice(0, 2)
      .join("")
      .toLocaleUpperCase() || "MU";
  const date = user.created_at ? new Date(user.created_at.replace(" ", "T")) : null;
  const joined =
    date && !Number.isNaN(date.getTime()) ? formatDate(date) : t("account14.unavailable");
  const waiting = orders.counts
    ? orders.counts.pending +
      orders.counts.confirmed +
      orders.counts.processing +
      orders.counts.shipping
    : null;
  const number = (value: number | null, pending: boolean, error: string | null) =>
    pending ? "…" : error || value === null ? "—" : String(value).padStart(2, "0");
  const cards = [
    {
      key: "orders",
      value: number(orders.total, orders.loading, orders.error),
      label: "account14.totalOrders",
    },
    {
      key: "processing",
      value: number(waiting, orders.loading, orders.error),
      label: "account14.processingOrders",
    },
    {
      key: "wishlist",
      value: number(wishes.length, wishlistPending, wishlistError),
      label: "account14.saved",
    },
    {
      key: "delivered",
      value: number(orders.counts?.delivered ?? null, orders.loading, orders.error),
      label: "account14.delivered",
    },
  ];
  return (
    <main className="customer-account account-page" data-product-text data-customer-account>
      <header className="account-universe-hero">
        <div>
          <p>MEMBER FILE / {String(user.id).padStart(6, "0")}</p>
          <h1>
            <span>{t("account14.heroSolid")}</span> <i>{t("account14.heroOutline")}</i>
            <em aria-hidden="true">.</em>
          </h1>
        </div>
        <b aria-hidden="true">会員</b>
      </header>
      <div className="account-layout customer-account-layout">
        <aside className="account-sidebar">
          <div className="account-profile-card">
            <div className="account-avatar" aria-label={t("account14.avatar")}>
              {initials}
            </div>
            <h3>{user.full_name || t("auth.guest")}</h3>
            <p>
              {t("auth.memberSince")} {joined}
            </p>
            <span className="account-role">
              {t(user.role === "admin" ? "auth.adminRole" : "auth.userRole")}
            </span>
          </div>
          <nav aria-label={t("account14.navigation")}>
            {(["overview", "orders", "wishlist", "information", "logout"] as const).map((key) => (
              <button
                type="button"
                key={key}
                className={route.view === key ? "active" : ""}
                aria-current={route.view === key ? "page" : undefined}
                disabled={busy}
                onClick={() =>
                  key === "wishlist"
                    ? onWishlist()
                    : key === "logout"
                      ? onLogout()
                      : navigateAccount(accountHref(key))
                }
              >
                <Glyph kind={key} />
                <span>{t("account14.nav." + key)}</span>
              </button>
            ))}
          </nav>
          {user.role === "admin" && (
            <button className="account-admin-link" disabled={busy} onClick={onAdmin}>
              {t("auth.admin")}
            </button>
          )}
          {error && <p role="alert">{t("auth.error." + error)}</p>}
        </aside>
        <section className="account-dashboard-content">
          {route.view === "information" ? (
            <section className="account-information">
              <p className="account-eyebrow">{t("account14.nav.information")}</p>
              <h2>{t("account14.profileTitle")}</h2>
              <dl>
                {[
                  ["auth.name", user.full_name],
                  ["EMAIL ADDRESS", user.email],
                  ["auth.memberSince", joined],
                  ["auth.role", t(user.role === "admin" ? "auth.adminRole" : "auth.userRole")],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{t(label)}</dt>
                    <dd>{value || t("account14.unavailable")}</dd>
                  </div>
                ))}
              </dl>
              <p>{t("account14.readOnly")}</p>
            </section>
          ) : null}
          {route.view === "overview" && (
            <>
              <header className="account-welcome">
                <p className="account-eyebrow">{t("account14.overviewLabel")}</p>
                <h2>
                  {t("WELCOME BACK,")}
                  <br />
                  <i>{user.full_name}</i>
                </h2>
                <div className="account-contact">
                  <span>
                    <Glyph kind="information" />
                    {user.email}
                  </span>
                  <span>
                    {t("auth.role")}:{" "}
                    {t(user.role === "admin" ? "auth.adminRole" : "auth.userRole")}
                  </span>
                </div>
              </header>
              <section className="account-metrics" aria-label={t("account14.statistics")}>
                {cards.map((card) => (
                  <article
                    key={card.key}
                    data-account-metric={card.key}
                    aria-busy={card.key === "wishlist" ? wishlistPending : orders.loading}
                  >
                    <Glyph kind={card.key} />
                    <b>{card.value}</b>
                    <span>{t(card.label)}</span>
                  </article>
                ))}
              </section>
              {wishlistError && (
                <div className="account-local-error" role="alert">
                  <p>{t("commerce.error." + wishlistError)}</p>
                  <button className="account-button secondary" onClick={onRetryWishlist}>
                    {t("TRY AGAIN")}
                  </button>
                </div>
              )}
            </>
          )}
          <div hidden={route.view === "information"}>
            {USE_PRODUCTS_API ? (
              <OrdersPanel
                accountNavigation
                onAccountState={setOrders}
                onChanged={onOrderChanged}
              />
            ) : (
              <p className="account-mode-note">{t("auth.ordersUnavailable")}</p>
            )}
          </div>
          {route.view !== "information" && (
            <div className="account-shop-cta">
              <button className="account-button" onClick={onShop}>
                {t("checkout.continueShopping")} <span aria-hidden="true">→</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
