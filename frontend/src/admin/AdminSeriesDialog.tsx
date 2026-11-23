import { useEffect, useId, useRef, useState, type KeyboardEvent, type FormEvent } from "react";
import { useI18n } from "../i18n";
import { AuthError } from "../services/authService";
import * as api from "./adminService";
export function AdminSeriesDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (series: { id: number; title: string }, created: boolean) => void;
}) {
  const { t } = useI18n(),
    id = useId(),
    dialog = useRef<HTMLDialogElement>(null),
    saving = useRef(false);
  const [values, setValues] = useState({
    title: "",
    slug: "",
    original_title: "",
    description_vi: "",
    description_en: "",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [existing, setExisting] = useState<api.Metadata["series"]>([]),
    [choice, setChoice] = useState("");
  useEffect(() => {
    const opener = document.activeElement;
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLInputElement>('[name="series_title"]')?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  const change = (key: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setError(null);
    setExisting([]);
    setChoice("");
  };
  function trapFocus(e: KeyboardEvent<HTMLDialogElement>) {
    if (e.key !== "Tab") return;
    const nodes = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
      ),
    ).filter((n) => n.getClientRects().length > 0);
    if (!nodes.length) {
      e.preventDefault();
      return;
    }
    const first = nodes[0],
      last = nodes[nodes.length - 1],
      active = document.activeElement;
    if (
      (e.shiftKey && active === first) ||
      (!e.shiftKey && active === last) ||
      !e.currentTarget.contains(active)
    ) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  }
  const close = () => {
    if (!saving.current) onClose();
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving.current) return;
    setError(null);
    const input = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value.trim()]),
    ) as typeof values;
    if (
      !input.title ||
      Array.from(input.title).length > 200 ||
      !input.slug ||
      input.slug.length > 160 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)
    ) {
      setError("INVALID_SERIES");
      return;
    }
    saving.current = true;
    setBusy(true);
    try {
      onSaved(await api.createSeries(input), true);
    } catch (e) {
      const code = e instanceof AuthError ? e.code : "NETWORK_ERROR";
      setError(code);
      if (code === "DUPLICATE_SERIES")
        try {
          setExisting((await api.getMetadata()).series);
        } catch {
          /* Keep the original conflict message; retry remains available. */
        }
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      onKeyDown={trapFocus}
      className="admin-series-dialog"
      aria-labelledby={id + "title"}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <form onSubmit={(e) => void submit(e)} noValidate aria-busy={busy}>
        <div className="admin-product-heading">
          <h2 id={id + "title"}>{t("products.newSeries")}</h2>
          <button type="button" className="admin-button" disabled={busy} onClick={close}>
            {t("admin.close")}
          </button>
        </div>
        <p>{t("products.seriesHelp")}</p>
        {error && (
          <div className="admin-alert" role="alert" id={id + "error"}>
            {t("admin.error." + error)}
          </div>
        )}
        {(
          [
            ["title", "products.seriesTitle", 200],
            ["slug", "Slug", 160],
            ["original_title", "products.originalTitle", 200],
            ["description_vi", "admin.descriptionVi", 2000],
            ["description_en", "admin.descriptionEn", 2000],
          ] as const
        ).map(([key, label, max]) => (
          <label key={key} htmlFor={id + key}>
            {t(label)}
            {key === "title" || key === "slug" ? " *" : ""}
            {key.startsWith("description") ? (
              <textarea
                id={id + key}
                name={"series_" + key}
                maxLength={max}
                value={values[key]}
                disabled={busy}
                onChange={(e) => change(key, e.target.value)}
              />
            ) : (
              <input
                id={id + key}
                name={"series_" + key}
                required={key === "title" || key === "slug"}
                maxLength={max}
                autoFocus={key === "title"}
                value={values[key]}
                disabled={busy}
                aria-invalid={!!error}
                aria-describedby={error ? id + "error" : undefined}
                onChange={(e) => change(key, e.target.value)}
              />
            )}
          </label>
        ))}
        {!!existing.length && (
          <div className="admin-product-existing">
            <label htmlFor={id + "existing"}>
              {t("products.chooseExisting")}
              <select
                id={id + "existing"}
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
              >
                <option value="">{t("products.selectSeries")}</option>
                {existing.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="admin-button"
              disabled={!choice || busy}
              onClick={() => {
                const found = existing.find((s) => s.id === Number(choice));
                if (found) onSaved(found, false);
              }}
            >
              {t("products.useSeries")}
            </button>
          </div>
        )}
        <div className="admin-actions">
          <button type="submit" className="admin-button primary" disabled={busy}>
            {t(busy ? "products.saving" : "products.saveSeries")}
          </button>
          <button type="button" className="admin-button" disabled={busy} onClick={close}>
            {t("admin.close")}
          </button>
        </div>
        <p role="status">{busy ? t("products.saving") : ""}</p>
      </form>
    </dialog>
  );
}
