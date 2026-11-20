export type AuthUser = {
  id: number;
  full_name: string;
  email: string;
  role: "user" | "admin";
  status: "active";
  created_at: string;
};
export class AuthError extends Error {
  constructor(public code: string, public status = 0) { super(code); }
}
const base = (import.meta.env.VITE_AUTH_API_BASE_URL || "/api").replace(/\/$/, "");
let csrfToken = ""; // Memory only. Session credentials remain in the HttpOnly cookie.
let pendingSession: Promise<AuthUser | null> | null = null;
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function user(value: unknown): AuthUser {
  if (!record(value) || typeof value.id !== "number" || !Number.isSafeInteger(value.id) || value.id < 1 || typeof value.full_name !== "string" || typeof value.email !== "string" || (value.role !== "user" && value.role !== "admin") || value.status !== "active" || typeof value.created_at !== "string") throw new AuthError("INVALID_RESPONSE");
  return { id: value.id, full_name: value.full_name, email: value.email, role: value.role, status: value.status, created_at: value.created_at };
}
async function request(path: string, body?: Record<string, string>, anonymous = false): Promise<AuthUser | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${base}/${path}`, {
      method: body ? "POST" : "GET", credentials: "same-origin", signal: controller.signal,
      headers: body ? { "Content-Type": "application/json", "X-CSRF-Token": csrfToken } : { Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload: unknown = await response.json();
    if (!record(payload)) throw new AuthError("INVALID_RESPONSE");
    if (record(payload.meta) && typeof payload.meta.csrf_token === "string") csrfToken = payload.meta.csrf_token;
    if (!response.ok || payload.success !== true) {
      if (anonymous && response.status === 401 && record(payload.error) && payload.error.code === "UNAUTHENTICATED") return null;
      throw new AuthError(record(payload.error) && typeof payload.error.code === "string" ? payload.error.code : "REQUEST_FAILED", response.status);
    }
    if (payload.data === null) return null;
    return user(payload.data);
  } catch (error) { if (error instanceof AuthError) throw error; throw new AuthError("NETWORK_ERROR"); }
  finally { window.clearTimeout(timeout); }
}
export function getSession(): Promise<AuthUser | null> {
  // Share StrictMode's initial request so guest session/CSRF cookies cannot race.
  pendingSession ??= request("auth/me.php", undefined, true).finally(() => { pendingSession = null; });
  return pendingSession;
}
async function change(path: string, input: Record<string, string>): Promise<AuthUser | null> {
  if (!csrfToken) await getSession();
  return request(`auth/${path}.php`, input);
}
export const login = (email: string, password: string) => change("login", { email, password });
export const register = (full_name: string, email: string, password: string) => change("register", { full_name, email, password });
export async function logout(): Promise<void> { await change("logout", {}); csrfToken = ""; }
export async function checkAdmin(): Promise<AuthUser> {
  const result = await request("admin/access.php");
  if (!result || result.role !== "admin") throw new AuthError("FORBIDDEN", 403);
  return result;
}
