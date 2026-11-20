import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../i18n";
import { USE_PRODUCTS_API } from "../config/products";
import { useProducts } from "./useProducts";
import { adaptProduct, localizeProduct, PRODUCT_PLACEHOLDER } from "../adapters/productAdapter";
import { AuthError } from "../services/authService";
import { loadCommerce, mergeGuest, mutateCommerce, type CommerceData, type MergePlan } from "../services/commerceService";
import type { Product } from "../types/product";
type Guest = { items: {product_id: number; quantity: number}[]; wishlist: number[]; plan?: MergePlan };
const key = "manga-store-guest-api-v1";
function readGuest(): Guest {
  if (!USE_PRODUCTS_API) return { items: [], wishlist: [] };
  try {
    const raw = sessionStorage.getItem(key); if (!raw) return { items: [], wishlist: [] };
    const data: Guest = JSON.parse(raw);
    if (!Array.isArray(data.items) || data.items.length > 100 || data.items.some(i => !Number.isSafeInteger(i.product_id) || i.product_id < 1 || !Number.isSafeInteger(i.quantity) || i.quantity < 1 || i.quantity > 999) || !Array.isArray(data.wishlist) || data.wishlist.some(id => !Number.isSafeInteger(id) || id < 1)) throw new Error();
    return data;
  } catch { return { items: [], wishlist: [] }; }
}
function saveGuest(guest: Guest) { try { sessionStorage.setItem(key, JSON.stringify(guest)); } catch { throw new AuthError("GUEST_STORAGE_FAILED"); } }
export function useCommerce() {
  const { user, loading: authLoading, refresh: refreshAuth } = useAuth();
  const { products } = useProducts(); const { language } = useI18n();
  const [guest, setGuest] = useState<Guest>(readGuest); const guestRef = useRef(guest);
  const [demoCart, setDemoCart] = useState<Product[]>([]); const [demoWishes, setDemoWishes] = useState<number[]>([]);
  const [state, setState] = useState<{owner: number; data: CommerceData} | null>(null);
  const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const epoch = useRef(0); const owner = USE_PRODUCTS_API ? user?.id ?? null : null; const ownerRef = useRef(owner); ownerRef.current = owner;
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef<CommerceData | null>(null);
  const failedVersion = useRef<number | null>(null);
  function store(next: Guest) { saveGuest(next); guestRef.current = next; setGuest(next); }
  async function sync() {
    const version = ++epoch.current; const account = ownerRef.current;
    setState(null); latest.current = null; setError(null);
    if (!USE_PRODUCTS_API || authLoading || account === null) { setLoading(false); return; }
    setLoading(true);
    let data: CommerceData | null = null;
    try {
      data = await loadCommerce();
      if (version !== epoch.current || ownerRef.current !== account) return;
      const g = guestRef.current;
      if (g.items.length || g.wishlist.length || g.plan) {
        let plan = g.plan;
        if (plan && (plan.userId !== account || plan.context !== data.context)) throw new AuthError("MERGE_CONTEXT_CHANGED");
        if (!plan) {
          plan = { userId: account, context: data.context, operation_key: Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2,"0")).join(""), items: g.items.map(i => ({...i})), wishlist: [...g.wishlist] };
          store({ ...g, plan }); // Durable client plan BEFORE the first request.
        }
        data = await mergeGuest(plan);
        if (version !== epoch.current || ownerRef.current !== account) return;
        store({ items: [], wishlist: [] }); // Clear only after acknowledged commit.
      }
      if (version === epoch.current && ownerRef.current === account) { latest.current = data; setState({ owner: account, data }); }
    } catch (error) {
      if (version !== epoch.current || ownerRef.current !== account) return;
      if (data) { latest.current = data; setState({ owner: account, data }); }
      setError(error instanceof AuthError ? error.code : "NETWORK_ERROR");
      if (error instanceof AuthError && error.status === 401) void refreshAuth();
    } finally { if (version === epoch.current) setLoading(false); }
  }
  useEffect(() => { void sync(); return () => { ++epoch.current; }; }, [owner, authLoading]); // Account boundaries invalidate old responses.
  const privateData = !authLoading && owner !== null && state?.owner === owner ? state.data : null;
  const cart = useMemo(() => {
    if (!USE_PRODUCTS_API) return demoCart.map(p => localizeProduct(p, language));
    if (owner !== null) return privateData?.cart.items.flatMap(line => {
      const p: Product = line.product ? { ...adaptProduct(line.product, language), price: line.unit_price_vnd } : { id: line.product_id, source: "api", name: language === "vi" ? line.name_vi : line.name_en, series: "", category: "", price: line.unit_price_vnd, image: PRODUCT_PLACEHOLDER, stockQuantity: 0 };
      return Array.from({length: line.quantity}, () => p);
    }) ?? [];
    return guest.items.flatMap(line => { const p = products.find(p => p.source === "api" && p.id === line.product_id); return p ? Array.from({length:line.quantity}, () => p) : []; });
  }, [demoCart, privateData, owner, guest, products, language]);
  const wishes = !USE_PRODUCTS_API ? demoWishes : owner !== null ? privateData?.wishlist ?? [] : guest.wishlist;
  function localChange(change: (g: Guest) => Guest): boolean {
    try { if (guestRef.current.plan) throw new AuthError("MERGE_UNCERTAIN"); store(change(guestRef.current)); setError(null); return true; }
    catch (e) { setError(e instanceof AuthError ? e.code : "NETWORK_ERROR"); return false; }
  }
  function write(path: string | ((data: CommerceData) => string), input: unknown): Promise<boolean> {
    const account = ownerRef.current; const version = epoch.current;
    if (account === null || authLoading || loading || !privateData || error) return Promise.resolve(false);
    setBusy(true);
    const job = queue.current.then(async () => {
      if (ownerRef.current !== account || epoch.current !== version || failedVersion.current === version || !latest.current) return false;
      try {
        const data = await mutateCommerce(typeof path === "function" ? path(latest.current) : path, input);
        if (ownerRef.current !== account || epoch.current !== version) return false;
        latest.current = data; setState({ owner: account, data }); setError(null); return true;
      } catch (e) {
        if (ownerRef.current === account && epoch.current === version) { failedVersion.current = version; setError(e instanceof AuthError ? e.code : "NETWORK_ERROR"); if (e instanceof AuthError && e.status === 401) void refreshAuth(); }
        return false;
      }
    });
    queue.current = job;
    void job.finally(() => { if (queue.current === job) setBusy(false); });
    return job;
  }
  async function add(p: Product): Promise<boolean> {
    if (!USE_PRODUCTS_API) { if (p.source === "api") return false; setDemoCart(x => [...x,p]); return true; }
    if (p.source !== "api") return false;
    if (ownerRef.current !== null) return write("cart/add.php", { product_id: p.id, quantity: 1 });
    return localChange(g => { const old = g.items.find(i => i.product_id === p.id); if ((old?.quantity ?? 0) >= Math.min(999,p.stockQuantity ?? 0)) throw new AuthError("INSUFFICIENT_STOCK"); return { ...g, items: old ? g.items.map(i => i.product_id === p.id ? {...i,quantity:i.quantity+1}:i) : [...g.items,{product_id:p.id,quantity:1}] }; });
  }
  function quantity(id: number, quantity: number) {
    if (!USE_PRODUCTS_API) { setDemoCart(x => { const p=x.find(p=>p.id===id); return p ? [...x.filter(p=>p.id!==id),...Array.from({length:quantity},()=>p)] : x; }); return; }
    if (ownerRef.current !== null) { void write(quantity === 0 ? "cart/remove.php" : "cart/update.php", quantity === 0 ? {product_id:id} : {product_id:id,quantity}); return; }
    localChange(g => ({...g,items:quantity===0?g.items.filter(i=>i.product_id!==id):g.items.map(i=>i.product_id===id?{...i,quantity}:i)}));
  }
  function toggleWish(id: number) {
    if (!USE_PRODUCTS_API) { setDemoWishes(x => x.includes(id)?x.filter(n=>n!==id):[...x,id]); return; }
    if (ownerRef.current !== null) { void write(data => data.wishlist.includes(id)?"wishlist/remove.php":"wishlist/add.php",{product_id:id}); return; }
    localChange(g => ({...g,wishlist:g.wishlist.includes(id)?g.wishlist.filter(n=>n!==id):[...g.wishlist,id]}));
  }
  function setCart(items: Product[]) { if (!USE_PRODUCTS_API) setDemoCart(items.filter(p=>p.source!=="api")); }
  return { accountKey: USE_PRODUCTS_API ? (authLoading ? "pending" : owner) : null, cart, wishes, add, quantity, toggleWish, setCart, clear: () => ownerRef.current !== null ? write("cart/clear.php",{}) : Promise.resolve(localChange(g=>({...g,items:[]}))),
    subtotal: privateData?.cart.subtotal_vnd, lineTotals: privateData ? Object.fromEntries(privateData.cart.items.map(i=>[i.product_id,i.line_total_vnd])) : undefined,
    loading: USE_PRODUCTS_API && (authLoading || loading || (owner !== null && !privateData && !error)), busy, error, retry: sync };
}
