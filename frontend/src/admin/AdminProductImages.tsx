import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { AuthError } from "../services/authService";
import { ProductImage } from "../components/ProductImage";
import * as api from "./adminService";
import "./product-images.css";
export function validateImage(file: File) {
  if (
    file.size < 1 ||
    file.size > 5 * 1024 * 1024 ||
    !/\.(jpe?g|png|webp)$/i.test(file.name) ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    throw new AuthError("INVALID_IMAGE");
}
export function ImagePreview({ file }: { file: File | null }) {
  const [url, setUrl] = useState("");
  const { t } = useI18n();
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return file && url ? (
    <figure className="admin-image-preview">
      <img src={url} alt={t("images.preview")} />
      <figcaption>{file.name}</figcaption>
    </figure>
  ) : null;
}
export function AdminProductImages({
  product,
  onChange,
  disabled,
  onBusy,
}: {
  product: api.Product;
  onChange: (p: api.Product) => void;
  disabled: boolean;
  onBusy: (value: boolean) => void;
}) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null),
    [target, setTarget] = useState<api.ProductImageRecord | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [inputKey, setInputKey] = useState(0);
  const replaceInput = useRef<HTMLInputElement>(null);
  const locked = busy || disabled;
  const refresh = async () => {
    const fresh = await api.getProduct(product.id);
    onChange({ ...fresh, version: product.version });
  };
  const run = async (work: () => Promise<unknown>, message: string) => {
    if (locked) return;
    setBusy(true);
    onBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
      setFile(null);
      setTarget(null);
      setInputKey((k) => k + 1);
      await refresh();
      setNotice(message);
    } catch (e) {
      setError(e instanceof AuthError ? e.code : "NETWORK_ERROR");
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };
  const choose = (f: File | null) => {
    setNotice(null);
    setError(null);
    if (f) {
      try {
        validateImage(f);
      } catch (e) {
        setFile(null);
        setError(e instanceof AuthError ? e.code : "INVALID_IMAGE");
        return;
      }
    }
    setFile(f);
  };
  const upload = () => {
    if (!file) return;
    if (target && !window.confirm(t("images.confirmReplace") + " #" + target.id)) return;
    void run(
      () =>
        target ? api.replaceImage(product.id, target, file) : api.uploadImage(product.id, file),
      target ? "images.replaced" : "images.uploaded",
    );
  };
  return (
    <section className="admin-product-images" data-admin-image-manager>
      <h3>{t("admin.images")}</h3>
      <button
        className="admin-button"
        disabled={locked}
        onClick={() => void run(refresh, "images.refreshed")}
      >
        {t("admin.refresh")}
      </button>
      <p className="admin-note">{t("images.policy")}</p>
      {error && (
        <div className="admin-alert" role="alert">
          {t("admin.error." + error)}
          <p>{t("images.uncertain")}</p>
          <button
            className="admin-button"
            disabled={locked}
            onClick={() => void run(refresh, "images.refreshed")}
          >
            {t("admin.refresh")}
          </button>
        </div>
      )}
      {notice && <p role="status">{t(notice)}</p>}
      {busy && <p role="status">{t("images.working")}</p>}
      <div className="admin-managed-gallery admin-gallery">
        {product.images?.map((image) => (
          <article key={image.id} data-managed-image={image.id} data-primary={image.is_primary}>
            <ProductImage src={image.image_url} alt={"#" + image.id} />
            <p>
              #{image.id} {image.is_primary && <strong>{t("images.primary")}</strong>}
            </p>
            <div className="admin-image-actions">
              <button
                className="admin-button"
                disabled={locked}
                onClick={() => {
                  setTarget(image);
                  setFile(null);
                  setError(null);
                  if (replaceInput.current) {
                    replaceInput.current.value = "";
                    replaceInput.current.click();
                  }
                }}
              >
                {t("images.replace")}
              </button>
              <button
                className="admin-button"
                disabled={locked}
                onClick={() => {
                  if (window.confirm(t("images.confirmDelete") + " #" + image.id))
                    void run(() => api.deleteImage(product.id, image), "images.deleted");
                }}
              >
                {t("images.delete")}
              </button>
              {!image.is_primary && (
                <button
                  className="admin-button"
                  disabled={locked}
                  onClick={() =>
                    void run(() => api.primaryImage(product.id, image), "images.primarySaved")
                  }
                >
                  {t("images.setPrimary")}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!product.images?.length && <p>{t("images.empty")}</p>}
      <input
        ref={replaceInput}
        name="replacement_image"
        type="file"
        hidden
        accept=".jpg,.jpeg,.png,.webp"
        onChange={(e) => choose(e.target.files?.[0] ?? null)}
        disabled={locked}
      />
      <label>
        {t("admin.chooseImage")}
        <input
          key={inputKey}
          name="image"
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          disabled={locked}
          onChange={(e) => {
            setTarget(null);
            choose(e.target.files?.[0] ?? null);
          }}
        />
      </label>
      <ImagePreview file={file} />
      {file && target && (
        <p>
          {t("images.replacing")} #{target.id}
        </p>
      )}
      <div className="admin-actions">
        <button className="admin-button" disabled={locked || !file} onClick={upload}>
          {t(target ? "images.confirmReplaceButton" : "admin.upload")}
        </button>
        {file && (
          <button
            className="admin-button"
            disabled={locked}
            onClick={() => {
              setFile(null);
              setTarget(null);
              setInputKey((k) => k + 1);
            }}
          >
            {t("images.cancel")}
          </button>
        )}
      </div>
    </section>
  );
}
