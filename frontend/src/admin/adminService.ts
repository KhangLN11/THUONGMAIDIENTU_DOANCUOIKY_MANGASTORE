import { AuthError, sessionRequest, sessionUpload } from "../services/authService";
import { parseOrder, type Order } from "../services/orderService";
export type Product = {
  id: number;
  category_id: number;
  series_id: number | null;
  sku: string;
  slug: string;
  name_vi: string;
  name_en: string;
  description_vi: string | null;
  description_en: string | null;
  price_vnd: number;
  sale_price_vnd: number | null;
  stock_quantity: number;
  status: string;
  version: string;
  image_url?: string | null;
  images?: ProductImageRecord[];
};
export type ProductImageRecord = {
  id: number;
  image_url: string;
  is_primary: boolean;
  sort_order: number;
};
export type Page<T> = {
  items: T[];
  meta: { page: number; page_size: number; total: number; last_page: number };
};
export type OrderRow = {
  id: number;
  order_code: string;
  recipient_name: string;
  recipient_phone: string;
  status: string;
  total_vnd: number;
  created_at: string;
  email: string;
};
export type Customer = {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
  order_count: number;
};
export type Movement = {
  id: number;
  order_id: number | null;
  actor_user_id: number | null;
  quantity_delta: number;
  reason: string;
  note: string | null;
  created_at: string;
};
export type Metadata = {
  categories: { id: number; name_vi: string; name_en: string }[];
  series: { id: number; title: string }[];
};
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new AuthError("INVALID_RESPONSE");
  return v as Record<string, unknown>;
}
function arr(v: unknown): unknown[] {
  if (!Array.isArray(v)) throw new AuthError("INVALID_RESPONSE");
  return v;
}
function str(v: unknown): string {
  if (typeof v !== "string") throw new AuthError("INVALID_RESPONSE");
  return v;
}
function nullable(v: unknown): string | null {
  return v === null ? null : str(v);
}
function num(v: unknown): number {
  if (typeof v === "string" && /^-?[0-9]+$/.test(v)) v = Number(v);
  if (typeof v !== "number" || !Number.isSafeInteger(v)) throw new AuthError("INVALID_RESPONSE");
  return v;
}
function product(v: unknown): Product {
  const p = obj(v);
  return {
    id: num(p.id),
    category_id: num(p.category_id),
    series_id: p.series_id === null ? null : num(p.series_id),
    sku: str(p.sku),
    slug: str(p.slug),
    name_vi: str(p.name_vi),
    name_en: str(p.name_en),
    description_vi: nullable(p.description_vi),
    description_en: nullable(p.description_en),
    price_vnd: num(p.price_vnd),
    sale_price_vnd: p.sale_price_vnd === null ? null : num(p.sale_price_vnd),
    stock_quantity: num(p.stock_quantity),
    status: str(p.status),
    version: str(p.version),
    image_url: p.image_url === undefined ? undefined : nullable(p.image_url),
    images:
      p.images === undefined
        ? undefined
        : arr(p.images).map((v) => {
            const i = obj(v);
            return {
              id: num(i.id),
              image_url: str(i.image_url),
              is_primary: num(i.is_primary) === 1,
              sort_order: num(i.sort_order),
            };
          }),
  };
}
function page<T>(v: unknown, parse: (r: unknown) => T): Page<T> {
  const p = obj(v),
    m = obj(p.meta);
  return {
    items: arr(p.items).map(parse),
    meta: {
      page: num(m.page),
      page_size: num(m.page_size),
      total: num(m.total),
      last_page: num(m.last_page),
    },
  };
}
async function request(path: string, body?: unknown): Promise<unknown> {
  try {
    return obj(await sessionRequest("admin/" + path, body)).data;
  } catch (e) {
    if (e instanceof AuthError && (e.status === 401 || e.code === "FORBIDDEN"))
      window.dispatchEvent(new Event("manga-admin-auth-invalid"));
    throw e;
  }
}
export const getDashboard = async () => {
  const d = obj(await request("dashboard.php"));
  return Object.fromEntries(
    ["active_products", "total_orders", "pending_orders", "low_stock", "collected_cod_vnd"].map(
      (k) => [k, num(d[k])],
    ),
  ) as Record<string, number>;
};
export const getProducts = async (query: string, inventory = false) =>
  page(await request((inventory ? "inventory.php" : "products.php") + query), product);
export const getProduct = async (id: number) => product(await request("product.php?id=" + id));
export const createProduct = async (input: unknown) =>
  product(await request("product-create.php", input));
export const updateProduct = async (input: unknown) =>
  product(await request("product-update.php", input));
export const archiveProduct = async (p: Product, status: string) =>
  product(
    await request("product-archive.php", { product_id: p.id, expected_version: p.version, status }),
  );
export const adjustInventory = async (p: Product, quantity_delta: number, reason: string) =>
  product(
    await request("inventory-adjust.php", {
      product_id: p.id,
      expected_stock: p.stock_quantity,
      quantity_delta,
      reason,
    }),
  );
export const getMovements = async (id: number) =>
  arr(await request("inventory-movements.php?product_id=" + id)).map((v) => {
    const m = obj(v);
    return {
      id: num(m.id),
      order_id: m.order_id === null ? null : num(m.order_id),
      actor_user_id: m.actor_user_id === null ? null : num(m.actor_user_id),
      quantity_delta: num(m.quantity_delta),
      reason: str(m.reason),
      note: nullable(m.note),
      created_at: str(m.created_at),
    };
  });
export const getMetadata = async (): Promise<Metadata> => {
  const m = obj(await request("metadata.php"));
  return {
    categories: arr(m.categories).map((v) => {
      const c = obj(v);
      return { id: num(c.id), name_vi: str(c.name_vi), name_en: str(c.name_en) };
    }),
    series: arr(m.series).map((v) => {
      const s = obj(v);
      return { id: num(s.id), title: str(s.title) };
    }),
  };
};
export const getOrders = async (query: string) =>
  page(await request("orders.php" + query), (v) => {
    const o = obj(v);
    return {
      id: num(o.id),
      order_code: str(o.order_code),
      recipient_name: str(o.recipient_name),
      recipient_phone: str(o.recipient_phone),
      status: str(o.status),
      total_vnd: num(o.total_vnd),
      created_at: str(o.created_at),
      email: str(o.email),
    };
  });
export const getOrder = async (id: number): Promise<Order> =>
  parseOrder(await request("order.php?id=" + id));
export const transitionOrder = async (o: Order, status: string): Promise<Order> =>
  parseOrder(
    await request("order-status.php", { order_id: o.id, expected_status: o.status, status }),
  );
export const confirmPayment = async (o: Order, reference: string): Promise<Order> =>
  parseOrder(await request("payment-confirm.php", { order_id: o.id, received: true, reference }));
export const getCustomers = async (query: string) =>
  page(await request("customers.php" + query), (v) => {
    const c = obj(v);
    return {
      id: num(c.id),
      full_name: str(c.full_name),
      email: str(c.email),
      phone: nullable(c.phone),
      status: str(c.status),
      created_at: str(c.created_at),
      order_count: num(c.order_count),
    };
  });
export const uploadImage = async (id: number, file: File) => {
  const body = new FormData();
  body.set("product_id", String(id));
  body.set("image", file);
  const d = obj(obj(await imageRequest("admin/image-upload.php", body)).data);
  catalogChanged(id);
  return { id: num(d.id), image_url: str(d.image_url) };
};

export const catalogChanged = (id: number) =>
  window.dispatchEvent(new CustomEvent("manga-products-updated", { detail: { productId: id } }));
export const replaceImage = async (id: number, image: ProductImageRecord, file: File) => {
  const body = new FormData();
  body.set("product_id", String(id));
  body.set("image_id", String(image.id));
  body.set("expected_image_url", image.image_url);
  body.set("image", file);
  const d = obj(obj(await imageRequest("admin/image-replace.php", body)).data);
  catalogChanged(id);
  return { id: num(d.id), image_url: str(d.image_url) };
};
export const deleteImage = async (id: number, image: ProductImageRecord) => {
  await request("image-delete.php", {
    product_id: id,
    image_id: image.id,
    expected_image_url: image.image_url,
  });
  catalogChanged(id);
};
export const primaryImage = async (id: number, image: ProductImageRecord) => {
  await request("image-primary.php", {
    product_id: id,
    image_id: image.id,
    expected_image_url: image.image_url,
  });
  catalogChanged(id);
};

async function imageRequest(path: string, body: FormData): Promise<unknown> {
  try {
    return await sessionUpload(path, body);
  } catch (e) {
    if (e instanceof AuthError && (e.status === 401 || e.code === "FORBIDDEN"))
      window.dispatchEvent(new Event("manga-admin-auth-invalid"));
    throw e;
  }
}
