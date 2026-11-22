import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { adaptProduct } from "../adapters/productAdapter";
import { USE_PRODUCTS_API } from "../config/products";
import { getProduct, getProducts, ProductApiError } from "../services/productService";
import type { ApiProduct, Product } from "../types/product";

type Status = "loading" | "error" | "success";
interface Catalog {
  products: Product[];
  status: Status;
  retry: () => void;
}
const Context = createContext<Catalog | null>(null);

export function ProductsProvider({ children, demoProducts }: { children: React.ReactNode; demoProducts: Product[] }) {
  const { language } = useI18n();
  const [raw, setRaw] = useState<ApiProduct[]>([]);
  const [status, setStatus] = useState<Status>(USE_PRODUCTS_API ? "loading" : "success");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!USE_PRODUCTS_API) return;
    const controller = new AbortController();
    setStatus("loading");
    getProducts(controller.signal).then(response => {
      if (!controller.signal.aborted) { setRaw(response.data); setStatus("success"); }
    }).catch(() => { if (!controller.signal.aborted) { setRaw([]); setStatus("error"); } });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    if (!USE_PRODUCTS_API) return;
    const changed = () => setAttempt(a => a + 1);
    window.addEventListener("manga-products-updated", changed);
    return () => window.removeEventListener("manga-products-updated", changed);
  }, []);
  useEffect(() => {
    if (!USE_PRODUCTS_API) return;
    const isAdmin = () => window.location.hash === "#admin" || window.location.hash.startsWith("#admin/");
    let wasAdmin = isAdmin();
    const leavingAdmin = () => {
      const next = isAdmin();
      if (wasAdmin && !next) { setStatus("loading"); setAttempt(a => a + 1); }
      wasAdmin = next;
    };
    window.addEventListener("hashchange", leavingAdmin);
    window.addEventListener("popstate", leavingAdmin);
    return () => { window.removeEventListener("hashchange", leavingAdmin); window.removeEventListener("popstate", leavingAdmin); };
  }, []);
  const products = useMemo(() => USE_PRODUCTS_API ? raw.map(p => adaptProduct(p, language)) : demoProducts, [raw, language, demoProducts]);
  return <Context.Provider value={{ products, status, retry: () => setAttempt(a => a + 1) }}>{children}</Context.Provider>;
}

export function useProducts() {
  const value = useContext(Context);
  if (!value) throw new Error("ProductsProvider is required");
  return value;
}

export function useProduct(id: number | null) {
  const { language } = useI18n();
  const [result, setResult] = useState<{ id: number | null; raw: ApiProduct | null; status: Status; notFound: boolean }>({ id: null, raw: null, status: "loading", notFound: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult({ id, raw: null, status: "loading", notFound: false });
    if (id === null) {
      setResult({ id, raw: null, status: "error", notFound: true });
      return () => controller.abort();
    }
    getProduct(id, controller.signal).then(response => {
      if (!controller.signal.aborted) setResult({ id, raw: response.data, status: "success", notFound: false });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ id, raw: null, status: "error", notFound: error instanceof ProductApiError && error.status === 404 });
    });
    return () => controller.abort();
  }, [id, attempt]);
  useEffect(() => {
    const changed = (event: Event) => { if ((event as CustomEvent<{ productId: number }>).detail?.productId === id) setAttempt(a => a + 1); };
    window.addEventListener("manga-products-updated", changed);
    return () => window.removeEventListener("manga-products-updated", changed);
  }, [id]);
  return {
    product: result.id === id && result.raw ? adaptProduct(result.raw, language) : null,
    status: result.id === id ? result.status : "loading" as Status,
    notFound: result.notFound,
    retry: () => setAttempt(a => a + 1),
  };
}
