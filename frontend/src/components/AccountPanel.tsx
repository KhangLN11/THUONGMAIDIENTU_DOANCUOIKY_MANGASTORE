import { AccountDashboard } from "../account/AccountDashboard";
import { useEffect, useState, type FormEvent } from "react";
import { useI18n } from "../i18n";
import { useAuth } from "../contexts/AuthContext";
import { AuthError, checkAdmin, register } from "../services/authService";

export function AccountPanel({
  onShop,
  onWishlist,
  onOrderChanged,
  wishes,
  wishlistPending = false,
  wishlistError = null,
  onRetryWishlist = () => {},
}: {
  onShop: () => void;
  onWishlist: () => void;
  onOrderChanged: () => void;
  wishes: number[];
  wishlistPending?: boolean;
  wishlistError?: string | null;
  onRetryWishlist?: () => void;
}) {
  const { t, formatDate } = useI18n();
  const { user, loading, error: sessionError, refresh, signIn, signOut } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adminVerified, setAdminVerified] = useState(false);
  useEffect(() => {
    if (!user) {
      setName("");
      setEmail("");
      setPassword("");
      setAdminVerified(false);
    }
  }, [user?.id]);
  function switchMode(next: "login" | "register") {
    setMode(next);
    setError(null);
    setNotice(null);
    setPassword("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const length = new TextEncoder().encode(password).length;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 190) {
      setError("INVALID_EMAIL");
      return;
    }
    if (length < (mode === "register" ? 12 : 1) || length > 72) {
      setError("INVALID_PASSWORD");
      return;
    }
    if (mode === "register" && (name.trim().length < 2 || name.trim().length > 150)) {
      setError("INVALID_NAME");
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") {
        await register(name.trim(), email.trim(), password);
        setMode("login");
        setNotice("auth.registered");
      } else {
        await signIn(email.trim(), password);
        setAdminVerified(false);
      }
      setPassword("");
    } catch (error) {
      setError(error instanceof AuthError ? error.code : "NETWORK_ERROR");
    } finally {
      setBusy(false);
    }
  }
  async function exit() {
    setBusy(true);
    setError(null);
    try {
      await signOut();
      setAdminVerified(false);
      setPassword("");
      setEmail("");
      setName("");
    } catch (error) {
      setError(error instanceof AuthError ? error.code : "NETWORK_ERROR");
    } finally {
      setBusy(false);
    }
  }
  async function verifyAdmin() {
    setBusy(true);
    setError(null);
    try {
      await checkAdmin();
      setAdminVerified(true);
      window.location.hash = "#admin";
    } catch (error) {
      setAdminVerified(false);
      setError(error instanceof AuthError ? error.code : "NETWORK_ERROR");
      if (error instanceof AuthError && (error.status === 401 || error.status === 403))
        await refresh();
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <main className="customer-account account-page">
        <div className="account-loading" role="status">
          {t("auth.loading")}
        </div>
      </main>
    );
  if (sessionError)
    return (
      <main className="customer-account account-page">
        <div className="account-local-error" role="alert">
          <p>{t("auth.error." + sessionError)}</p>
          <button className="account-button" onClick={() => void refresh()}>
            {t("TRY AGAIN")}
          </button>
        </div>
      </main>
    );
  if (user)
    return (
      <AccountDashboard
        key={user.id}
        user={user}
        wishes={wishes}
        wishlistPending={wishlistPending}
        wishlistError={wishlistError}
        onRetryWishlist={onRetryWishlist}
        onShop={onShop}
        onWishlist={onWishlist}
        onOrderChanged={onOrderChanged}
        onLogout={() => void exit()}
        onAdmin={() => void verifyAdmin()}
        busy={busy}
        error={error}
      />
    );
  const field =
    "border border-[#bfbfbf] bg-white h-[50px] px-[15px] text-[10px] outline-none focus:border-2 focus:border-black min-w-0 w-full";
  const label = "grid gap-[9px] mb-5 text-[8px] font-bold tracking-[.15em]";
  return (
    <main className="inner-page account-page" data-product-text>
      <div className="page-hero">
        <p>{t("auth.member")}</p>
        <h1>
          {t("account.headingLead")} <i>{t("account.headingAccent")}</i>
        </h1>
        <b aria-hidden="true">会員</b>
      </div>
      <div className="account-layout">
        <aside>
          <b>MU</b>
          <h3>{t("auth.guest")}</h3>
          <small>{t("auth.welcome")}</small>
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            disabled={busy}
            onClick={() => switchMode("login")}
          >
            {t("auth.login")}
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            disabled={busy}
            onClick={() => switchMode("register")}
          >
            {t("auth.register")}
          </button>
        </aside>
        <section>
          <span>{t("auth.member")}</span>
          <h2>{t(mode === "register" ? "auth.register" : "auth.login")}</h2>
          <form onSubmit={(event) => void submit(event)}>
            {mode === "register" && (
              <label className={label}>
                {t("auth.name")}
                <input
                  className={field}
                  name="full_name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={150}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={busy}
                />
              </label>
            )}
            <label className={label}>
              {t("EMAIL ADDRESS")}
              <input
                className={field}
                name="email"
                type="email"
                autoComplete="username"
                required
                maxLength={190}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
              />
            </label>
            <label className={label}>
              {t("auth.password")}
              <input
                className={field}
                name="password"
                type="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
            </label>
            {mode === "register" && <p>{t("auth.passwordHint")}</p>}
            <button className="ink-btn" type="submit" disabled={busy}>
              {t(busy ? "auth.loading" : mode === "register" ? "auth.register" : "auth.login")}
            </button>
            <div className="min-[761px]:hidden">
              <button
                className="ink-btn ink-btn-ghost"
                type="button"
                disabled={busy}
                onClick={() => switchMode(mode === "login" ? "register" : "login")}
              >
                {t(mode === "login" ? "auth.register" : "auth.login")}
              </button>
            </div>
          </form>
          {error && <p role="alert">{t("auth.error." + error)}</p>}
          {notice && <p role="status">{t(notice)}</p>}
        </section>
      </div>
    </main>
  );
}
