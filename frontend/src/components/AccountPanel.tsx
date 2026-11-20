import { useState, type FormEvent } from "react";
import { useI18n } from "../i18n";
import { AuthGuard, useAuth } from "../contexts/AuthContext";
import { AuthError, checkAdmin, register } from "../services/authService";

export function AccountPanel({ onShop, onWishlist, wishes }: { onShop: () => void; onWishlist: () => void; wishes: number[] }) {
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
  function switchMode(next: "login" | "register") { setMode(next); setError(null); setNotice(null); setPassword(""); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setNotice(null);
    const length = new TextEncoder().encode(password).length;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 190) { setError("INVALID_EMAIL"); return; }
    if (length < (mode === "register" ? 12 : 1) || length > 72) { setError("INVALID_PASSWORD"); return; }
    if (mode === "register" && (name.trim().length < 2 || name.trim().length > 150)) { setError("INVALID_NAME"); return; }
    setBusy(true);
    try {
      if (mode === "register") { await register(name.trim(), email.trim(), password); setMode("login"); setNotice("auth.registered"); }
      else { await signIn(email.trim(), password); setAdminVerified(false); }
      setPassword("");
    } catch (error) { setError(error instanceof AuthError ? error.code : "NETWORK_ERROR"); }
    finally { setBusy(false); }
  }
  async function exit() {
    setBusy(true); setError(null);
    try { await signOut(); setAdminVerified(false); setPassword(""); }
    catch (error) { setError(error instanceof AuthError ? error.code : "NETWORK_ERROR"); }
    finally { setBusy(false); }
  }
  async function verifyAdmin() {
    setBusy(true); setError(null);
    try { await checkAdmin(); setAdminVerified(true); }
    catch (error) { setAdminVerified(false); setError(error instanceof AuthError ? error.code : "NETWORK_ERROR"); if (error instanceof AuthError && (error.status === 401 || error.status === 403)) await refresh(); }
    finally { setBusy(false); }
  }
  const initials = user?.full_name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase() || "MU";
  const field = "border border-[#bfbfbf] bg-white h-[50px] px-[15px] text-[10px] outline-none focus:border-2 focus:border-black min-w-0 w-full";
  const label = "grid gap-[9px] mb-5 text-[8px] font-bold tracking-[.15em]";
  return <main className="inner-page account-page" data-product-text>
    <div className="page-hero">
      <p>{user ? `MEMBER FILE / ${String(user.id).padStart(6, "0")}` : t("auth.member")}</p>
      <h1>{t("account.headingLead")} <i>{t("account.headingAccent")}</i></h1><b>会員</b>
    </div>
    <div className="account-layout">
      <aside>
        <b>{initials}</b><h3>{user?.full_name || t("auth.guest")}</h3>
        <small>{user ? `${t("auth.memberSince")} ${formatDate(user.created_at.replace(" ", "T"))}` : t("auth.welcome")}</small>
        {user ? <>
          <button className="active" type="button">{t("OVERVIEW")}</button>
          <button type="button" onClick={onWishlist}>{t("WISHLIST")} ({wishes.length})</button>
          <AuthGuard role="admin"><button type="button" onClick={() => void verifyAdmin()} disabled={busy}>{t("auth.admin")}</button></AuthGuard>
          <button type="button" onClick={() => void exit()} disabled={busy}>{t("auth.logout")}</button>
        </> : <>
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")} disabled={busy}>{t("auth.login")}</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")} disabled={busy}>{t("auth.register")}</button>
        </>}
      </aside>
      <section>
        <span>{t(user ? "OVERVIEW" : "auth.member")}</span>
        <h2>{t(user ? "WELCOME BACK," : mode === "register" ? "auth.register" : "auth.login")}<br /><i>{user?.full_name}</i></h2>
        {loading ? <p role="status">{t("auth.loading")}</p> : sessionError ? <>
          <p role="alert">{t(`auth.error.${sessionError}`)}</p><button className="ink-btn ink-btn-ghost" onClick={() => void refresh()}>{t("TRY AGAIN")}</button>
        </> : user ? <AuthGuard>
          <p>{user.email}</p><p>{t("auth.role")}: {t(user.role === "admin" ? "auth.adminRole" : "auth.userRole")}</p>
          <div className="account-stats">
            <div><b>—</b><p>{t("TOTAL ORDERS")}</p></div>
            <div><b>{String(wishes.length).padStart(2, "0")}</b><p>{t("SAVED OBJECTS")}</p></div>
            <div><b>—</b><p>{t("MEMBER POINTS")}</p></div>
          </div>
          <p>{t("auth.ordersUnavailable")}</p>
          {adminVerified && <AuthGuard role="admin"><p role="status">{t("auth.adminVerified")}</p></AuthGuard>}
          <button className="ink-btn ink-btn-ghost" onClick={onShop}>{t("CONTINUE COLLECTING")}</button>
          <div className="min-[761px]:hidden">
            <button className="ink-btn ink-btn-ghost" type="button" onClick={onWishlist}>{t("WISHLIST")} ({wishes.length})</button>
            <AuthGuard role="admin"><button className="ink-btn ink-btn-ghost" type="button" onClick={() => void verifyAdmin()} disabled={busy}>{t("auth.admin")}</button></AuthGuard>
            <button className="ink-btn ink-btn-ghost" type="button" onClick={() => void exit()} disabled={busy}>{t("auth.logout")}</button>
          </div>
        </AuthGuard> : <form onSubmit={event => void submit(event)}>
          {mode === "register" && <label className={label}>{t("auth.name")}<input className={field} name="full_name" autoComplete="name" required minLength={2} maxLength={150} value={name} onChange={event => setName(event.target.value)} disabled={busy} /></label>}
          <label className={label}>{t("EMAIL ADDRESS")}<input className={field} name="email" type="email" autoComplete="username" required maxLength={190} value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>
          <label className={label}>{t("auth.password")}<input className={field} name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></label>
          {mode === "register" && <p>{t("auth.passwordHint")}</p>}
          <button className="ink-btn" type="submit" disabled={busy}>{t(busy ? "auth.loading" : mode === "register" ? "auth.register" : "auth.login")}</button>
          <div className="min-[761px]:hidden"><button className="ink-btn ink-btn-ghost" type="button" disabled={busy} onClick={() => switchMode(mode === "login" ? "register" : "login")}>{t(mode === "login" ? "auth.register" : "auth.login")}</button></div>
        </form>}
        {error && <p role="alert">{t(`auth.error.${error}`)}</p>}
        {notice && <p role="status">{t(notice)}</p>}
      </section>
    </div>
  </main>;
}
