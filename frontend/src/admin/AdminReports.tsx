import { useEffect, useState, type FormEvent } from "react";
import { useI18n } from "../i18n";
import { AuthError } from "../services/authService";
import { downloadReport, getReport, type Report, type ReportFilter } from "./reportService";
import "./reports.css";
const initial: ReportFilter = { preset: "30days", start: "", end: "", group: "day" };
const ratio = (n: bigint, max: bigint) => (max === 0n ? 0 : Number((n * 10000n) / max) / 100);
export function AdminReports() {
  const { t, language } = useI18n();
  const [draft, setDraft] = useState(initial),
    [filter, setFilter] = useState(initial),
    [data, setData] = useState<Report | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [attempt, setAttempt] = useState(0),
    [exportType, setExportType] = useState("revenue"),
    [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState<string | null>(null),
    [exported, setExported] = useState(false);
  const cash = (v: string) =>
    new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", {
      style: "currency",
      currency: "VND",
      currencyDisplay: "code",
      maximumFractionDigits: 0,
    }).format(BigInt(v));
  const count = (v: number) =>
    new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US").format(v);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setExportError(null);
    setExported(false);
    void getReport(filter)
      .then((r) => {
        if (active) setData(r);
      })
      .catch((e) => {
        if (active) setError(e instanceof AuthError ? e.code : "NETWORK_ERROR");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filter, attempt]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFilter({ ...draft });
  };
  const exportCsv = async () => {
    setExporting(true);
    setExportError(null);
    setExported(false);
    try {
      await downloadReport(filter, exportType, language);
      setExported(true);
    } catch (e) {
      setExportError(e instanceof AuthError ? e.code : "NETWORK_ERROR");
    } finally {
      setExporting(false);
    }
  };
  const renderError = (code: string, retry: () => void = () => setAttempt((v) => v + 1)) => (
    <div className="admin-alert" role="alert">
      {t("report.error." + code)}{" "}
      <button className="admin-button" onClick={retry}>
        {t("TRY AGAIN")}
      </button>
    </div>
  );
  const name = (r: { name_vi: string; name_en: string }) =>
    language === "vi" ? r.name_vi : r.name_en;
  return (
    <section className="admin-reports" data-admin-reports>
      <p className="report-intro">{t("report.intro")}</p>
      <form className="admin-panel report-filters" onSubmit={submit}>
        <label>
          {t("report.period")}
          <select
            name="report_preset"
            value={draft.preset}
            onChange={(e) => setDraft({ ...draft, preset: e.target.value })}
          >
            {["today", "7days", "30days", "month", "year", "custom"].map((p) => (
              <option value={p} key={p}>
                {t("report.preset." + p)}
              </option>
            ))}
          </select>
        </label>
        {draft.preset === "custom" && (
          <>
            <label>
              {t("report.start")}
              <input
                name="report_start"
                type="date"
                min="2000-01-01"
                max="2099-12-31"
                required
                value={draft.start}
                onChange={(e) => setDraft({ ...draft, start: e.target.value })}
              />
            </label>
            <label>
              {t("report.end")}
              <input
                name="report_end"
                type="date"
                min={draft.start || "2000-01-01"}
                max="2099-12-31"
                required
                value={draft.end}
                onChange={(e) => setDraft({ ...draft, end: e.target.value })}
              />
            </label>
          </>
        )}
        <label>
          {t("report.group")}
          <select
            name="report_group"
            value={draft.group}
            onChange={(e) => setDraft({ ...draft, group: e.target.value })}
          >
            {["day", "month", "year"].map((p) => (
              <option value={p} key={p}>
                {t("report.group." + p)}
              </option>
            ))}
          </select>
        </label>
        <button className="admin-button primary" type="submit" disabled={loading}>
          {t("report.apply")}
        </button>
      </form>
      {loading ? (
        <p role="status">{t("admin.loading")}</p>
      ) : error ? (
        renderError(error)
      ) : (
        data && (
          <>
            {data.period.simulation && (
              <p className="admin-alert" data-report-simulation>
                {t("report.simulation")}
              </p>
            )}
            <p className="report-period" data-report-period>
              {data.period.start} → {data.period.end} · {data.period.timezone} (UTC+7)
            </p>
            <p className="report-note">{t("report.basis")}</p>
            <div className="admin-cards report-kpis">
              {(
                [
                  "total_orders",
                  "pending_orders",
                  "processing_orders",
                  "completed_orders",
                  "cancelled_orders",
                  "total_customers",
                  "active_products",
                  "low_stock",
                  "sold_quantity",
                  "collected_cod_vnd",
                  "collected_bank_vnd",
                  "collected_total_vnd",
                ] as const
              ).map((k) => (
                <article className="admin-card" key={k}>
                  <span>{t("report.metric." + k)}</span>
                  <b data-report-metric={k}>
                    {["collected_cod_vnd","collected_bank_vnd","collected_total_vnd"].includes(k) ? cash(String(data.overview[k])) : count(Number(data.overview[k]))}
                  </b>
                  {["total_customers", "active_products", "low_stock"].includes(k) && (
                    <small>{t("report.current")}</small>
                  )}
                </article>
              ))}
            </div>
            <div className="report-summary admin-panel">
              {(
                ["created_order_value_vnd", "average_order_vnd", "average_collected_vnd"] as const
              ).map((k) => (
                <p key={k}>
                  {t("report.metric." + k)}
                  <strong data-report-metric={k}>{cash(data.overview[k])}</strong>
                </p>
              ))}
            </div>
            {data.overview.total_orders === 0 && data.overview.collected_orders === 0 && (
              <p className="admin-panel" data-report-empty>
                {t("report.empty")}
              </p>
            )}
            <section className="admin-panel">
              <h2>{t("report.trend")}</h2>
              <p>{t("report.trendBasis")}</p>
              <div className="report-legend">
                <span>■ {t("report.collected")}</span>
                <span>▧ {t("report.created")}</span>
              </div>
              <RevenueChart rows={data.revenue} cash={cash} />
              <details>
                <summary>{t("report.viewData")}</summary>
                <div className="admin-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {["period", "orders", "created", "collected", "average"].map((k) => (
                          <th key={k}>{t("report." + k)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.revenue.map((r) => (
                        <tr key={r.bucket}>
                          <td>{r.bucket}</td>
                          <td>{count(r.total_orders)}</td>
                          <td>{cash(r.created_order_value_vnd)}</td>
                          <td>{cash(r.collected_cod_vnd)}</td>
                          <td>{cash(r.average_order_vnd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
            <div className="report-two-columns">
              <section className="admin-panel">
                <h2>{t("report.statuses")}</h2>
                <div className="report-bars">
                  {data.statuses.map((r) => (
                    <Bar
                      key={r.status}
                      label={t("order.status." + r.status)}
                      value={r.total_orders}
                      max={Math.max(...data.statuses.map((x) => x.total_orders), 1)}
                      text={count(r.total_orders)}
                    />
                  ))}
                </div>
              </section>
              <section className="admin-panel">
                <h2>{t("report.top")}</h2>
                <p>{t("report.soldBasis")}</p>
                {!data.products.length ? (
                  <p>{t("report.noSales")}</p>
                ) : (
                  <div className="report-bars">
                    {data.products.map((r, i) => (
                      <Bar
                        key={i}
                        label={name(r)}
                        value={r.sold_quantity}
                        max={Math.max(...data.products.map((x) => x.sold_quantity), 1)}
                        text={`${count(r.sold_quantity)} · ${cash(r.sales_value_vnd)}`}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
            <section className="admin-panel">
              <h2>{t("report.category")}</h2>
              <p>{t("report.categoryBasis")}</p>
              <div className="report-bars">
                {data.categories.map((r) => (
                  <Bar
                    key={r.slug}
                    label={name(r)}
                    value={r.sold_quantity}
                    max={Math.max(...data.categories.map((x) => x.sold_quantity), 1)}
                    text={`${count(r.sold_quantity)} · ${cash(r.sales_value_vnd)}`}
                  />
                ))}
              </div>
            </section>
            <section className="admin-panel">
              <h2>{t("report.export")}</h2>
              <p>{t("report.exportBasis")}</p>
              <div className="report-export">
                <label>
                  {t("report.exportType")}
                  <select
                    name="report_export_type"
                    value={exportType}
                    onChange={(e) => setExportType(e.target.value)}
                  >
                    {["revenue", "orders", "products", "inventory"].map((k) => (
                      <option key={k} value={k}>
                        {t("report.export." + k)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="admin-button"
                  disabled={exporting}
                  onClick={() => void exportCsv()}
                >
                  {t(exporting ? "admin.loading" : "report.download")}
                </button>
              </div>
              {exportError && renderError(exportError, () => void exportCsv())}
              {exported && <p role="status">{t("report.downloaded")}</p>}
            </section>
            <p className="report-note">{t("report.limitations")}</p>
          </>
        )
      )}
    </section>
  );
}
function Bar({
  label,
  value,
  max,
  text,
}: {
  label: string;
  value: number;
  max: number;
  text: string;
}) {
  return (
    <div className="report-bar-row">
      <div>
        <span>{label}</span>
        <strong>{text}</strong>
      </div>
      <div className="report-bar-track">
        <div style={{ width: `${(100 * value) / max}%` }} />
      </div>
    </div>
  );
}
function RevenueChart({ rows, cash }: { rows: Report["revenue"]; cash: (v: string) => string }) {
  const { t } = useI18n();
  const max = rows.reduce(
      (m, r) =>
        [BigInt(r.collected_cod_vnd), BigInt(r.created_order_value_vnd), m].reduce((a, b) =>
          a > b ? a : b,
        ),
      0n,
    ),
    width = 900,
    height = 240,
    left = 12,
    top = 20,
    plot = 160,
    cell = (width - 24) / Math.max(rows.length, 1);
  return (
    <figure className="report-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t("report.trend")}>
        <title>{t("report.trend")}</title>
        <desc>{t("report.trendBasis")}</desc>
        <line x1={left} y1={top + plot} x2={width - left} y2={top + plot} stroke="#777" />
        {rows.map((r, i) => {
          const a = (ratio(BigInt(r.collected_cod_vnd), max) * plot) / 100,
            b = (ratio(BigInt(r.created_order_value_vnd), max) * plot) / 100;
          return (
            <g key={r.bucket}>
              <title>{`${r.bucket}: ${t("report.collected")} ${cash(r.collected_cod_vnd)}; ${t("report.created")} ${cash(r.created_order_value_vnd)}`}</title>
              <rect
                x={left + i * cell}
                y={top + plot - a}
                width={cell * 0.42}
                height={a}
                fill="#111"
              />
              <rect
                x={left + i * cell + cell * 0.44}
                y={top + plot - b}
                width={cell * 0.42}
                height={b}
                fill="#bbb"
              />
              {(i === 0 || i === rows.length - 1 || i === Math.floor(rows.length / 2)) && (
                <text
                  x={left + i * cell}
                  y={top + plot + 30}
                  fontSize="15"
                  textAnchor={i === rows.length - 1 ? "end" : "start"}
                >
                  {r.bucket}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption>
        {t("report.scaleMax")}: {cash(max.toString())}
      </figcaption>
    </figure>
  );
}
