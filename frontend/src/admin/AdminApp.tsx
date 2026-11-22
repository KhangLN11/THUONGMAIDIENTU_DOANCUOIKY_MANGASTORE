import { useEffect, useState, type DependencyList, type FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../i18n";
import { AuthError, checkAdmin } from "../services/authService";
import type { Order } from "../services/orderService";
import { ProductImage } from "../components/ProductImage";
import { PRODUCT_PLACEHOLDER } from "../adapters/productAdapter";
import * as api from "./adminService";
import "./admin.css";
import { AdminReports } from "./AdminReports";
type Tab = "dashboard" | "orders" | "products" | "inventory" | "customers" | "reports";
const tabs: Tab[] = ["dashboard", "orders", "products", "inventory", "customers", "reports"];
function tabFromHash(): Tab {
  const p = window.location.hash.split("/")[1];
  return tabs.includes(p as Tab) ? (p as Tab) : "dashboard";
}
function code(e: unknown) {
  return e instanceof AuthError ? e.code : "NETWORK_ERROR";
}
function useLoad<T>(load: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [attempt, setAttempt] = useState(0);
  const { refresh } = useAuth();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void load()
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) {
          setError(code(e));
          if (e instanceof AuthError && (e.status === 401 || e.status === 403)) void refresh();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [...deps, attempt]);
  return { data, loading, error, reload: () => setAttempt((x) => x + 1) };
}
function ErrorBox({ value, retry }: { value: string | null; retry?: () => void }) {
  const { t } = useI18n();
  return value ? (
    <div className="admin-alert" role="alert">
      <p>{t("admin.error." + value)}</p>
      {retry && (
        <button className="admin-button" onClick={retry}>
          {t("TRY AGAIN")}
        </button>
      )}
    </div>
  ) : null;
}
function Loading() {
  const { t } = useI18n();
  return <p role="status">{t("admin.loading")}</p>;
}
function Pager({ meta, onPage }: { meta: api.Page<unknown>["meta"]; onPage: (p: number) => void }) {
  const { t } = useI18n();
  return (
    <div className="admin-pagination">
      <button
        className="admin-button"
        disabled={meta.page <= 1}
        onClick={() => onPage(meta.page - 1)}
      >
        {t("admin.previous")}
      </button>
      <span>
        {meta.page} / {meta.last_page} · {meta.total}
      </span>
      <button
        className="admin-button"
        disabled={meta.page >= meta.last_page}
        onClick={() => onPage(meta.page + 1)}
      >
        {t("admin.next")}
      </button>
    </div>
  );
}
export function AdminApp() {
  const { user, loading, refresh, signOut } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const [verified, setVerified] = useState<number | null>(null),
    [error, setError] = useState<string | null>(null),
    [tab, setTab] = useState<Tab>(tabFromHash),
    [menu, setMenu] = useState(false);
  useEffect(() => {
    const h = () => setTab(tabFromHash());
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  useEffect(() => {
    let active = true;
    setVerified(null);
    setError(null);
    if (!user || user.role !== "admin") return;
    void checkAdmin()
      .then(() => {
        if (active) setVerified(user.id);
      })
      .catch((e) => {
        if (active) {
          setError(code(e));
          void refresh();
        }
      });
    return () => {
      active = false;
    };
  }, [user?.id, user?.role]);
  useEffect(() => {
    const invalid = () => void refresh();
    window.addEventListener("manga-admin-auth-invalid", invalid);
    return () => window.removeEventListener("manga-admin-auth-invalid", invalid);
  }, [refresh]);
  const exit = () => {
    window.location.hash = "#account";
  };
  if (loading)
    return (
      <main className="admin-shell" data-product-text>
        <div className="admin-auth">
          <Loading />
        </div>
      </main>
    );
  if (!user || user.role !== "admin")
    return (
      <main className="admin-shell" data-product-text>
        <div className="admin-auth">
          <h1>MANGA UNIVERSE / ADMIN</h1>
          <p role="alert">{t(user ? "admin.forbidden" : "admin.loginRequired")}</p>
          <button className="admin-button" onClick={exit}>
            {t(user ? "admin.returnStore" : "auth.login")}
          </button>
        </div>
      </main>
    );
  if (verified !== user.id)
    return (
      <main className="admin-shell" data-product-text>
        <div className="admin-auth">
          {error ? <ErrorBox value={error} retry={() => void refresh()} /> : <Loading />}
        </div>
      </main>
    );
  return (
    <main className="admin-shell" data-product-text data-admin-user={user.id}>
      <div className="admin-grid">
        <aside className={"admin-sidebar" + (menu ? " open" : "")}>
          <div className="admin-brand">
            <b>MU</b>MANGA UNIVERSE
            <br />
            <small>ADMIN / 管理</small>
          </div>
          <button
            className="admin-button admin-menu-button"
            onClick={() => setMenu((x) => !x)}
            aria-expanded={menu}
          >
            {t("Menu")}
          </button>
          <nav>
            {tabs.map((p) => (
              <button
                key={p}
                aria-current={tab === p ? "page" : undefined}
                onClick={() => {
                  window.location.hash = "#admin/" + p;
                  setMenu(false);
                }}
              >
                {t("admin.tab." + p)}
              </button>
            ))}
            <button onClick={exit}>{t("admin.returnStore")}</button>
            <button onClick={() => void signOut().catch((e) => setError(code(e)))}>
              {t("auth.logout")}
            </button>
          </nav>
        </aside>
        <div className="admin-main">
          <header className="admin-topbar">
            <div>
              <p>{t("admin.controlRoom")}</p>
              <h1>{t("admin.tab." + tab)}</h1>
            </div>
            <div className="admin-actions">
              <span>{user.full_name}</span>
              <button
                className="admin-button"
                aria-pressed={language === "vi"}
                onClick={() => setLanguage("vi")}
              >
                VI
              </button>
              <button
                className="admin-button"
                aria-pressed={language === "en"}
                onClick={() => setLanguage("en")}
              >
                EN
              </button>
            </div>
          </header>
          <ErrorBox value={error} />
          <div key={user.id}>
            {tab === "reports" ? (
              <AdminReports />
            ) : tab === "dashboard" ? (
              <AdminDashboard />
            ) : tab === "orders" ? (
              <AdminOrders />
            ) : tab === "products" ? (
              <AdminProducts />
            ) : tab === "inventory" ? (
              <AdminInventory />
            ) : (
              <AdminCustomers />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
function AdminDashboard() {
  const { t, formatCurrency } = useI18n();
  const r = useLoad(api.getDashboard, []);
  return (
    <>
      <ErrorBox value={r.error} retry={r.reload} />
      {r.loading ? (
        <Loading />
      ) : (
        r.data && (
          <div className="admin-cards">
            {[
              "active_products",
              "total_orders",
              "pending_orders",
              "low_stock",
              "collected_cod_vnd",
            ].map((k) => (
              <article className="admin-card" key={k}>
                <span>{t("admin.metric." + k)}</span>
                <b data-metric={k}>
                  {k === "collected_cod_vnd" ? formatCurrency(r.data![k], "VND") : r.data![k]}
                </b>
                <small>
                  {t(
                    k === "collected_cod_vnd"
                      ? "admin.collectedOnly"
                      : k === "low_stock"
                        ? "admin.threshold"
                        : "admin.liveData",
                  )}
                </small>
              </article>
            ))}
          </div>
        )
      )}
    </>
  );
}
function AdminOrders() {
  const { t, language, formatCurrency, formatDate } = useI18n();
  const [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<Order | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState(false),
    [received, setReceived] = useState(false),
    [reference, setReference] = useState("");
  const query = "?" + new URLSearchParams({ q, status, page: String(page) });
  const r = useLoad(() => api.getOrders(query), [query]);
  const money = (n: number) => formatCurrency(n, "VND");
  async function open(id: number) {
    setBusy(true);
    setError(null);
    setNotice(false);
    setReceived(false);
    setReference("");
    try {
      setSelected(await api.getOrder(id));
    } catch (e) {
      setError(code(e));
    } finally {
      setBusy(false);
    }
  }
  async function transition(next: string) {
    if (!selected || busy || !window.confirm(t("admin.confirmStatus"))) return;
    setBusy(true);
    setError(null);
    try {
      setSelected(await api.transitionOrder(selected, next));
      setNotice(true);
      r.reload();
    } catch (e) {
      setError(code(e));
    } finally {
      setBusy(false);
    }
  }
  async function collect() {
    if (
      !selected ||
      !received ||
      !reference.trim() ||
      busy ||
      !window.confirm(t("admin.confirmCollect"))
    )
      return;
    setBusy(true);
    setError(null);
    try {
      setSelected(await api.confirmPayment(selected, reference.trim()));
      setNotice(true);
      r.reload();
    } catch (e) {
      setError(code(e));
    } finally {
      setBusy(false);
    }
  }
  const next = selected
    ? (
        {
          pending: "confirmed",
          confirmed: "processing",
          processing: "shipping",
          shipping: "delivered",
        } as Record<string, string>
      )[selected.status]
    : undefined;
  return (
    <>
      <ErrorBox value={error} />
      {notice && <p role="status">{t("admin.saved")}</p>}
      {selected ? (
        <section className="admin-panel admin-detail" data-admin-order={selected.id}>
          <button className="admin-button" onClick={() => setSelected(null)}>
            {t("order.back")}
          </button>
          <h2>{selected.order_code}</h2>
          <p>
            {t("order.status." + selected.status)} ·{" "}
            {formatDate(selected.created_at.replace(" ", "T"))}
          </p>
          <p>
            {selected.recipient_name} / {selected.recipient_phone}
          </p>
          <p>
            {[selected.address_line, selected.ward, selected.district, selected.province]
              .filter(Boolean)
              .join(", ")}
          </p>
          <p>{selected.customer_note}</p>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>{t("admin.productName")}</th>
                  <th>{t("admin.quantity")}</th>
                  <th>{t("TOTAL")}</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((i, index) => (
                  <tr key={index}>
                    <td>{i.sku_snapshot}</td>
                    <td>{language === "vi" ? i.name_vi_snapshot : i.name_en_snapshot}</td>
                    <td>{i.quantity}</td>
                    <td>{money(i.line_total_vnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>
            {t("TOTAL")}: {money(selected.total_vnd)}
          </h3>
          <p>
            {t("SHIPPING")}: {money(selected.shipping_fee_vnd)}
          </p>
          <p>
            {t("admin.paymentStatus")}:{" "}
            {t(selected.payment_status === "paid" ? "order.paid" : "order.unpaid")}
          </p>
          <div className="admin-actions">
            {next && (
              <button
                className="admin-button primary"
                disabled={busy}
                onClick={() => void transition(next)}
              >
                {t("admin.advance")} → {t("order.status." + next)}
              </button>
            )}
            {selected.status === "pending" && (
              <button
                className="admin-button"
                disabled={busy}
                onClick={() => void transition("cancelled")}
              >
                {t("order.cancel")}
              </button>
            )}
            <button className="admin-button" disabled={busy} onClick={() => void open(selected.id)}>
              {t("admin.refresh")}
            </button>
          </div>
          {selected.status === "delivered" &&
            selected.payment_method === "cod" &&
            selected.payment_status === "pending" && (
              <div className="admin-panel">
                <h3>{t("admin.collectCod")}</h3>
                <p className="admin-caution">{t("admin.collectNotice")}</p>
                <label>
                  {t("admin.receiptRef")}
                  <input
                    name="payment_reference"
                    maxLength={150}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </label>
                <label className="admin-check">
                  <input
                    name="received"
                    type="checkbox"
                    checked={received}
                    onChange={(e) => setReceived(e.target.checked)}
                  />
                  {t("admin.received")}
                </label>
                <button
                  className="admin-button primary"
                  disabled={busy || !received || !reference.trim()}
                  onClick={() => void collect()}
                >
                  {t("admin.collectCod")}
                </button>
              </div>
            )}
        </section>
      ) : (
        <section className="admin-panel">
          <div className="admin-toolbar">
            <label>
              {t("admin.searchOrder")}
              <input
                name="order_search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              {t("admin.status")}
              <select
                name="order_status_filter"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t("All")}</option>
                {["pending", "confirmed", "processing", "shipping", "delivered", "cancelled"].map(
                  (s) => (
                    <option key={s} value={s}>
                      {t("order.status." + s)}
                    </option>
                  ),
                )}
              </select>
            </label>
            <button className="admin-button" onClick={r.reload}>
              {t("admin.refresh")}
            </button>
          </div>
          <ErrorBox value={r.error} retry={r.reload} />
          {r.loading ? (
            <Loading />
          ) : (
            r.data && (
              <>
                <div className="admin-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("admin.orderCode")}</th>
                        <th>{t("admin.recipient")}</th>
                        <th>{t("admin.status")}</th>
                        <th>{t("TOTAL")}</th>
                        <th>{t("admin.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.data.items.map((o) => (
                        <tr key={o.id}>
                          <td>{o.order_code}</td>
                          <td>
                            {o.recipient_name}
                            <br />
                            {o.email}
                          </td>
                          <td>{t("order.status." + o.status)}</td>
                          <td>{money(o.total_vnd)}</td>
                          <td>
                            <button
                              className="admin-button"
                              disabled={busy}
                              onClick={() => void open(o.id)}
                            >
                              {t("order.view")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!r.data.items.length && <p>{t("admin.empty")}</p>}
                <Pager meta={r.data.meta} onPage={setPage} />
              </>
            )
          )}
        </section>
      )}
    </>
  );
}
function AdminProducts() {
  const { t, language, formatCurrency } = useI18n();
  const [q, setQ] = useState(""),
    [category, setCategory] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<api.Product | null>(null),
    [editing, setEditing] = useState(false),
    [error, setError] = useState<string | null>(null);
  const query = "?" + new URLSearchParams({ q, category_id: category, page: String(page) });
  const r = useLoad(() => api.getProducts(query), [query]);
  const meta = useLoad(api.getMetadata, []);
  async function edit(id: number) {
    setError(null);
    try {
      setSelected(await api.getProduct(id));
      setEditing(true);
    } catch (e) {
      setError(code(e));
    }
  }
  async function archive(p: api.Product) {
    if (!window.confirm(t("admin.confirmArchive"))) return;
    try {
      await api.archiveProduct(p, p.status === "archived" ? "active" : "archived");
      r.reload();
    } catch (e) {
      setError(code(e));
    }
  }
  return editing ? (
    <AdminProductForm
      key={selected?.id ?? "new"}
      product={selected}
      onClose={() => {
        setEditing(false);
        r.reload();
      }}
    />
  ) : (
    <section className="admin-panel">
      <div className="admin-actions">
        <button
          className="admin-button primary"
          onClick={() => {
            setSelected(null);
            setEditing(true);
          }}
        >
          {t("admin.addProduct")}
        </button>
      </div>
      <div className="admin-toolbar">
        <label>
          {t("admin.searchProduct")}
          <input
            name="product_search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          {t("admin.category")}
          <select
            name="category_filter"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("All")}</option>
            {meta.data?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {language === "vi" ? c.name_vi : c.name_en}
              </option>
            ))}
          </select>
        </label>
        <button className="admin-button" onClick={r.reload}>
          {t("admin.refresh")}
        </button>
      </div>
      <ErrorBox value={error || r.error || meta.error} retry={r.reload} />
      {r.loading ? (
        <Loading />
      ) : (
        r.data && (
          <>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("admin.image")}</th>
                    <th>SKU / {t("admin.productName")}</th>
                    <th>{t("admin.price")}</th>
                    <th>{t("admin.stock")}</th>
                    <th>{t("admin.status")}</th>
                    <th>{t("admin.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.data.items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <ProductImage src={p.image_url || PRODUCT_PLACEHOLDER} alt="" />
                      </td>
                      <td>
                        {p.sku}
                        <br />
                        {language === "vi" ? p.name_vi : p.name_en}
                      </td>
                      <td>
                        {formatCurrency(p.price_vnd, "VND")}
                        {p.sale_price_vnd !== null && (
                          <>
                            <br />
                            <small>
                              {t("admin.salePrice")}: {formatCurrency(p.sale_price_vnd, "VND")}
                            </small>
                          </>
                        )}
                      </td>
                      <td>{p.stock_quantity}</td>
                      <td>{t("admin.state." + p.status)}</td>
                      <td>
                        <div className="admin-actions">
                          <button className="admin-button" onClick={() => void edit(p.id)}>
                            {t("admin.edit")}
                          </button>
                          <button className="admin-button" onClick={() => void archive(p)}>
                            {t(p.status === "archived" ? "admin.activate" : "admin.archive")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!r.data.items.length && <p>{t("admin.empty")}</p>}
            <Pager meta={r.data.meta} onPage={setPage} />
          </>
        )
      )}
    </section>
  );
}
type FormFields = {
  sku: string;
  slug: string;
  name_vi: string;
  name_en: string;
  description_vi: string;
  description_en: string;
  category_id: string;
  series_id: string;
  price_vnd: string;
  sale_price_vnd: string;
  stock_quantity: string;
  status: string;
};
function AdminProductForm({
  product,
  onClose,
}: {
  product: api.Product | null;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const [current, setCurrent] = useState(product);
  const p = current;
  const [fields, setFields] = useState<FormFields>({
    sku: p?.sku ?? "",
    slug: p?.slug ?? "",
    name_vi: p?.name_vi ?? "",
    name_en: p?.name_en ?? "",
    description_vi: p?.description_vi ?? "",
    description_en: p?.description_en ?? "",
    category_id: String(p?.category_id ?? ""),
    series_id: p?.series_id ? String(p.series_id) : "",
    price_vnd: p ? String(p.price_vnd) : "",
    sale_price_vnd: p?.sale_price_vnd === null || !p ? "" : String(p.sale_price_vnd),
    stock_quantity: String(p?.stock_quantity ?? 0),
    status: p?.status ?? "draft",
  });
  const [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState(false),
    [busy, setBusy] = useState(false),
    [file, setFile] = useState<File | null>(null);
  const meta = useLoad(api.getMetadata, []);
  const set = (k: keyof FormFields, v: string) => setFields((f) => ({ ...f, [k]: v }));
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(false);
    setBusy(true);
    try {
      const price = Number(fields.price_vnd),
        sale = fields.sale_price_vnd === "" ? null : Number(fields.sale_price_vnd),
        stock = Number(fields.stock_quantity),
        category = Number(fields.category_id);
      if (
        !fields.sku.trim() ||
        !fields.slug.trim() ||
        !fields.name_vi.trim() ||
        !fields.name_en.trim() ||
        fields.price_vnd === "" ||
        !Number.isSafeInteger(price) ||
        price < 0 ||
        !Number.isSafeInteger(category) ||
        category < 1 ||
        !Number.isSafeInteger(stock) ||
        stock < 0 ||
        (sale !== null && (!Number.isSafeInteger(sale) || sale <= 0 || sale > price))
      )
        throw new AuthError("INVALID_INPUT");
      const body = {
        sku: fields.sku.trim(),
        slug: fields.slug.trim(),
        name_vi: fields.name_vi.trim(),
        name_en: fields.name_en.trim(),
        description_vi: fields.description_vi,
        description_en: fields.description_en,
        category_id: category,
        series_id: fields.series_id ? Number(fields.series_id) : null,
        price_vnd: price,
        sale_price_vnd: sale,
        status: fields.status,
      };
      const result = p
        ? await api.updateProduct({ ...body, product_id: p.id, expected_version: p.version })
        : await api.createProduct({ ...body, stock_quantity: stock });
      setCurrent(result);
      setNotice(true);
    } catch (e) {
      setError(code(e));
    } finally {
      setBusy(false);
    }
  }
  async function upload() {
    if (!p || !file || busy) return;
    setError(null);
    setNotice(false);
    setBusy(true);
    try {
      if (file.size > 5 * 1024 * 1024) throw new AuthError("INVALID_IMAGE");
      await api.uploadImage(p.id, file);
      const fresh = await api.getProduct(p.id);
      setCurrent({ ...fresh, version: p.version });
      setFile(null);
      setNotice(true);
    } catch (e) {
      setError(code(e));
    } finally {
      setBusy(false);
    }
  }
  const textFields: [keyof FormFields, string, number][] = [
    ["sku", "SKU", 64],
    ["slug", "Slug", 200],
    ["name_vi", "admin.nameVi", 255],
    ["name_en", "admin.nameEn", 255],
  ];
  return (
    <section className="admin-panel" data-admin-product-form>
      <button className="admin-button" onClick={onClose}>
        {t("admin.back")}
      </button>
      <h2>{t(p ? "admin.editProduct" : "admin.addProduct")}</h2>
      <ErrorBox value={error || meta.error} />
      {notice && <p role="status">{t("admin.saved")}</p>}
      <form noValidate onSubmit={(e) => void save(e)}>
        <div className="admin-form-grid">
          {textFields.map(([k, label, max]) => (
            <label key={k}>
              {t(label)}
              <input
                name={k}
                maxLength={max}
                required
                value={fields[k]}
                disabled={busy}
                onChange={(e) => set(k, e.target.value)}
              />
            </label>
          ))}
          {(["description_vi", "description_en"] as const).map((k) => (
            <label key={k}>
              {t(k === "description_vi" ? "admin.descriptionVi" : "admin.descriptionEn")}
              <textarea
                name={k}
                maxLength={2000}
                rows={4}
                disabled={busy}
                value={fields[k]}
                onChange={(e) => set(k, e.target.value)}
              />
            </label>
          ))}
          <label>
            {t("admin.category")}
            <select
              name="category_id"
              value={fields.category_id}
              disabled={busy}
              onChange={(e) => set("category_id", e.target.value)}
            >
              <option value="">{t("admin.select")}</option>
              {meta.data?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {language === "vi" ? c.name_vi : c.name_en}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("admin.series")}
            <select
              name="series_id"
              value={fields.series_id}
              disabled={busy}
              onChange={(e) => set("series_id", e.target.value)}
            >
              <option value="">—</option>
              {meta.data?.series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("admin.price")} / VND
            <input
              type="number"
              step="1"
              min="0"
              name="price_vnd"
              value={fields.price_vnd}
              disabled={busy}
              onChange={(e) => set("price_vnd", e.target.value)}
            />
          </label>
          <label>
            {t("admin.salePrice")} / VND
            <input
              type="number"
              step="1"
              min="1"
              name="sale_price_vnd"
              value={fields.sale_price_vnd}
              disabled={busy}
              onChange={(e) => set("sale_price_vnd", e.target.value)}
            />
          </label>
          <label>
            {t("admin.stock")}
            <input
              type="number"
              min="0"
              step="1"
              name="stock_quantity"
              value={p ? p.stock_quantity : fields.stock_quantity}
              readOnly={!!p}
              disabled={busy}
              onChange={(e) => set("stock_quantity", e.target.value)}
            />
            {p && <small>{t("admin.stockSeparate")}</small>}
          </label>
          <label>
            {t("admin.status")}
            <select
              name="product_status"
              value={fields.status}
              disabled={busy}
              onChange={(e) => set("status", e.target.value)}
            >
              {["draft", "active", "archived"].map((s) => (
                <option value={s} key={s}>
                  {t("admin.state." + s)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-actions">
          <button className="admin-button primary" type="submit" disabled={busy || meta.loading}>
            {t("admin.save")}
          </button>
          <button type="button" className="admin-button" onClick={onClose}>
            {t("admin.close")}
          </button>
        </div>
      </form>
      {p && (
        <>
          <h3>{t("admin.images")}</h3>
          <p className="admin-note">{t("admin.imagePolicy")}</p>
          <div className="admin-gallery">
            {p.images?.map((i) => (
              <ProductImage key={i.id} src={i.image_url} alt="" />
            ))}
          </div>
          <label>
            {t("admin.chooseImage")}
            <input
              name="image"
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={busy}
            />
          </label>
          <button className="admin-button" disabled={busy || !file} onClick={() => void upload()}>
            {t("admin.upload")}
          </button>
        </>
      )}
    </section>
  );
}
function AdminInventory() {
  const { t, language } = useI18n();
  const [q, setQ] = useState(""),
    [low, setLow] = useState(false),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<api.Product | null>(null),
    [delta, setDelta] = useState(""),
    [reason, setReason] = useState(""),
    [movements, setMovements] = useState<api.Movement[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState(false);
  const query = "?" + new URLSearchParams({ q, low: low ? "1" : "0", page: String(page) });
  const r = useLoad(() => api.getProducts(query, true), [query]);
  async function select(p: api.Product) {
    setError(null);
    setNotice(false);
    setDelta("");
    setReason("");
    try {
      const [fresh, log] = await Promise.all([api.getProduct(p.id), api.getMovements(p.id)]);
      setSelected(fresh);
      setMovements(log);
    } catch (e) {
      setError(code(e));
    }
  }
  async function adjust(e: FormEvent) {
    e.preventDefault();
    if (!selected || busy) return;
    setError(null);
    setNotice(false);
    const n = Number(delta);
    if (!delta || !Number.isSafeInteger(n) || n === 0 || !reason.trim()) {
      setError("INVALID_STOCK");
      return;
    }
    if (!window.confirm(t("admin.confirmInventory"))) return;
    setBusy(true);
    try {
      const p = await api.adjustInventory(selected, n, reason.trim());
      setSelected(p);
      setMovements(await api.getMovements(p.id));
      setDelta("");
      setReason("");
      setNotice(true);
      r.reload();
    } catch (e) {
      setError(code(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ErrorBox value={error} />
      {notice && <p role="status">{t("admin.saved")}</p>}
      {selected && (
        <section className="admin-panel" data-admin-inventory-form>
          <h2>{language === "vi" ? selected.name_vi : selected.name_en}</h2>
          <p>
            {t("admin.stock")}: <b data-current-stock>{selected.stock_quantity}</b>
          </p>
          <p className="admin-note">{t("admin.inventoryPolicy")}</p>
          <form noValidate onSubmit={(e) => void adjust(e)}>
            <div className="admin-form-grid">
              <label>
                {t("admin.delta")}
                <input
                  name="quantity_delta"
                  type="number"
                  step="1"
                  value={delta}
                  disabled={busy}
                  onChange={(e) => setDelta(e.target.value)}
                />
              </label>
              <label>
                {t("admin.reason")}
                <input
                  name="reason"
                  maxLength={255}
                  value={reason}
                  disabled={busy}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </div>
            <div className="admin-actions">
              <button className="admin-button primary" disabled={busy}>
                {t("admin.adjust")}
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => void select(selected)}
                disabled={busy}
              >
                {t("admin.refresh")}
              </button>
              <button type="button" className="admin-button" onClick={() => setSelected(null)}>
                {t("admin.close")}
              </button>
            </div>
          </form>
          <h3>{t("admin.movements")}</h3>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{t("admin.delta")}</th>
                  <th>{t("admin.reason")}</th>
                  <th>{t("admin.actor")}</th>
                  <th>{t("admin.note")}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>{m.id}</td>
                    <td>{m.quantity_delta}</td>
                    <td>{t("admin.movement." + m.reason)}</td>
                    <td>{m.actor_user_id ?? "—"}</td>
                    <td>{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="admin-panel">
        <div className="admin-toolbar">
          <label>
            {t("admin.searchProduct")}
            <input
              name="inventory_search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={low}
              onChange={(e) => {
                setLow(e.target.checked);
                setPage(1);
              }}
            />
            {t("admin.lowOnly")}
          </label>
          <button className="admin-button" onClick={r.reload}>
            {t("admin.refresh")}
          </button>
        </div>
        <ErrorBox value={r.error} retry={r.reload} />
        {r.loading ? (
          <Loading />
        ) : (
          r.data && (
            <>
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>{t("admin.productName")}</th>
                      <th>{t("admin.stock")}</th>
                      <th>{t("admin.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.data.items.map((p) => (
                      <tr key={p.id}>
                        <td>{p.sku}</td>
                        <td>{language === "vi" ? p.name_vi : p.name_en}</td>
                        <td>
                          <strong>{p.stock_quantity}</strong>
                          {p.stock_quantity <= 5 && p.status === "active" && (
                            <small> / {t("admin.lowStock")}</small>
                          )}
                        </td>
                        <td>
                          <button className="admin-button" onClick={() => void select(p)}>
                            {t("admin.adjust")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!r.data.items.length && <p>{t("admin.empty")}</p>}
              <Pager meta={r.data.meta} onPage={setPage} />
            </>
          )
        )}
      </section>
    </>
  );
}
function AdminCustomers() {
  const { t } = useI18n();
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1);
  const query = "?" + new URLSearchParams({ q, page: String(page) });
  const r = useLoad(() => api.getCustomers(query), [query]);
  return (
    <section className="admin-panel">
      <div className="admin-toolbar">
        <label>
          {t("admin.searchCustomer")}
          <input
            name="customer_search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <button className="admin-button" onClick={r.reload}>
          {t("admin.refresh")}
        </button>
      </div>
      <p className="admin-note">{t("admin.customersReadOnly")}</p>
      <ErrorBox value={r.error} retry={r.reload} />
      {r.loading ? (
        <Loading />
      ) : (
        r.data && (
          <>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("admin.customer")}</th>
                    <th>Email</th>
                    <th>{t("order.phone")}</th>
                    <th>{t("admin.status")}</th>
                    <th>{t("admin.orderCount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.data.items.map((c) => (
                    <tr key={c.id}>
                      <td>{c.full_name}</td>
                      <td>{c.email}</td>
                      <td>{c.phone ?? "—"}</td>
                      <td>{t("admin.state." + c.status)}</td>
                      <td>{c.order_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!r.data.items.length && <p>{t("admin.empty")}</p>}
            <Pager meta={r.data.meta} onPage={setPage} />
          </>
        )
      )}
    </section>
  );
}
