export const USE_PRODUCTS_API = import.meta.env.VITE_USE_PRODUCTS_API === "true";
// Dev uses the Vite proxy. Production must provide a same-origin PHP path/reverse proxy.
export const PRODUCTS_API_BASE = (import.meta.env.VITE_PRODUCTS_API_BASE_URL || "/api").replace(/\/$/, "");
