import { useEffect, useMemo, useState } from "react";
import { useI18n, useTranslateDocument } from "./i18n";
import type { Product } from "./types/product";
import { USE_PRODUCTS_API } from "./config/products";
import { localizeProduct } from "./adapters/productAdapter";
import { ProductsProvider, useProducts, useProduct } from "./hooks/useProducts";
import { ProductImage } from "./components/ProductImage";
import { ProductState, ProductSkeletons } from "./components/ProductState";

type Page = "home" | "shop" | "product" | "series" | "cart" | "checkout" | "account";

const images = {
  shelf:
    "https://images.unsplash.com/photo-1709675577960-0b1e7ba55347?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1400",
  stack:
    "https://images.unsplash.com/photo-1744412161702-dcfd3bea6845?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1200",
  open: "https://images.unsplash.com/photo-1763732397864-5b860bb298b0?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1200",
  comic:
    "https://images.unsplash.com/photo-1588497859490-85d1c17db96d?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1200",
  cards:
    "https://images.unsplash.com/photo-1666153184621-bc6445e3568d?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1200",
};

const demoProducts: Product[] = [
  {
    id: 1,
    name: "Nocturne / Vol. 01",
    series: "VOID RUNNER",
    price: 14.9,
    category: "Manga",
    badge: "NEW",
    image: images.stack,
  },
  {
    id: 2,
    name: "The Ronin Figure",
    series: "BLADE//ZERO",
    price: 89,
    category: "Figures",
    badge: "LIMITED",
    image: images.cards,
  },
  {
    id: 3,
    name: "City Ruins Print",
    series: "NEO TOKYO",
    price: 28,
    category: "Posters",
    image: images.open,
  },
  {
    id: 4,
    name: "Black Sun Tee",
    series: "ECLIPSE CLUB",
    price: 42,
    category: "Apparel",
    badge: "BEST SELLER",
    image: images.comic,
  },
  {
    id: 5,
    name: "Archive / Vol. 07",
    series: "GHOST SIGNAL",
    price: 16.5,
    category: "Manga",
    badge: "NEW",
    image: images.shelf,
  },
  {
    id: 6,
    name: "Panel Tote 02",
    series: "STUDIO EDITION",
    price: 32,
    category: "Accessories",
    image: images.stack,
  },
  {
    id: 7,
    name: "Mecha Unit 09",
    series: "STEEL//SOUL",
    price: 119,
    category: "Figures",
    badge: "PRE-ORDER",
    image: images.cards,
  },
  {
    id: 8,
    name: "Afterimage Hoodie",
    series: "VOID RUNNER",
    price: 78,
    category: "Apparel",
    image: images.comic,
  },
];

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21c.8-5 3.2-7 7.5-7s6.7 2 7.5 7" />
      </>
    ),
    heart: (
      <path d="M20.8 5.8c-1.8-2.2-5.2-2-7 .1L12 8l-1.8-2.1c-1.8-2.1-5.2-2.3-7-.1-1.8 2.3-1.4 5.6.7 7.6L12 21l8.1-7.6c2.1-2 2.5-5.3.7-7.6Z" />
    ),
    cart: (
      <>
        <path d="M3 4h2l2.2 11h10.6l2-7H6" />
        <circle cx="9" cy="20" r="1" />
        <circle cx="17" cy="20" r="1" />
      </>
    ),
    menu: (
      <>
        <path d="M3 7h18M3 12h18M3 17h18" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M14 7l5 5-5 5" />
      </>
    ),
    close: (
      <>
        <path d="m5 5 14 14M19 5 5 19" />
      </>
    ),
    plus: (
      <>
        <path d="M5 12h14M12 5v14" />
      </>
    ),
    minus: <path d="M5 12h14" />,
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      {paths[name]}
    </svg>
  );
}

function Button({
  children,
  ghost = false,
  onClick,
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  ghost?: boolean;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button disabled={disabled || undefined} onClick={onClick} className={`ink-btn ${ghost ? "ink-btn-ghost" : ""} ${className}`}>
      <span>{children}</span>
      <Icon name="arrow" size={17} />
    </button>
  );
}

function Header({ go, cartCount }: { go: (p: Page, id?: number) => void; cartCount: number }) {
  const [open, setOpen] = useState(false);
  const { language, setLanguage, t } = useI18n();
  const links: [string, Page][] = [
    [t("HOME"), "home"],
    [t("SHOP"), "shop"],
    [t("MANGA SERIES"), "series"],
    [t("MERCHANDISE"), "shop"],
    [t("NEW ARRIVALS"), "shop"],
    [t("ABOUT US"), "home"],
  ];
  return (
    <header className="site-header">
      <button className="brand" onClick={() => go("home")}>
        <span>MU</span>MANGA
        <br />
        UNIVERSE
      </button>
      <nav className={open ? "open" : ""}>
        {links.map(([label, page]) => (
          <button
            key={label}
            onClick={() => {
              go(page);
              setOpen(false);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="header-actions">
        <div className="language-switcher" role="group" aria-label="Language / Ngôn ngữ">
          <button
            className={language === "vi" ? "active" : ""}
            onClick={() => setLanguage("vi")}
            aria-pressed={language === "vi"}
          >
            VI
          </button>
          <button
            className={language === "en" ? "active" : ""}
            onClick={() => setLanguage("en")}
            aria-pressed={language === "en"}
          >
            EN
          </button>
        </div>
        <button aria-label={t("Search")}>
          <Icon name="search" />
        </button>
        <button aria-label={t("Account")} onClick={() => go("account")}>
          <Icon name="user" />
        </button>
        <button aria-label={t("Wishlist")}>
          <Icon name="heart" />
        </button>
        <button aria-label={t("Cart")} className="cart-icon" onClick={() => go("cart")}>
          <Icon name="cart" />
          {cartCount > 0 && <b>{cartCount}</b>}
        </button>
        <button className="menu" aria-label={t("Menu")} onClick={() => setOpen(!open)}>
          <Icon name={open ? "close" : "menu"} />
        </button>
      </div>
    </header>
  );
}

function Marquee() {
  const { t } = useI18n();
  const message = `${t("AUTHENTIC MANGA")} — ${t("LIMITED DROPS")} — ${t("WORLDWIDE SHIPPING")} — ${t("OFFICIALLY LICENSED")} — `;
  return (
    <div className="marquee">
      <div>{message.repeat(2)}</div>
    </div>
  );
}

function ProductCard({
  product,
  onOpen,
  onAdd,
  wish,
  onWish,
}: {
  product: Product;
  onOpen: () => void;
  onAdd: () => void;
  wish: boolean;
  onWish: () => void;
}) {
  const { t, formatCurrency: currency } = useI18n();
  const formatCurrency = (value: number) => currency(value, product.source === "api" ? "VND" : "USD");
  return (
    <article className="product-card" data-source={product.source}>
      <div className="product-img" onClick={onOpen}>
        <ProductImage src={product.image} alt={product.name} />
        {product.badge && <span className="badge">{product.badge}</span>}
        <button
          className={`wish ${wish ? "active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onWish();
          }}
          aria-label={t("Add to wishlist")}
        >
          <Icon name="heart" size={18} />
        </button>
        <div className="quick-actions">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            {t("QUICK VIEW")}
          </button>
          <button
            disabled={product.source === "api" && product.stockQuantity === 0 ? true : undefined}
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
          >
            {t("ADD TO CART")}
          </button>
        </div>
      </div>
      <div className="product-meta">
        <p data-product-text={product.source ? "true" : undefined} style={product.source ? { minHeight: "2.4em" } : undefined}>{product.source === "api" ? [product.category, product.series].filter(Boolean).join(" / ") : product.series}</p>
        <h3 data-product-text={product.source ? "true" : undefined} style={product.source ? { minHeight: "2.4em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined}>{product.name}</h3>
        <div style={product.source ? { flexWrap: "wrap", gap: 8 } : undefined}>
          <span>{formatCurrency(product.price)}{product.originalPrice !== undefined && <del style={{ marginLeft: 8 }}>{formatCurrency(product.originalPrice)}</del>}</span>
          <small style={product.source ? { display: "inline-block" } : undefined}>{product.source === "api" ? `${t(product.stockQuantity ? "IN STOCK" : "OUT OF STOCK")} (${product.stockQuantity})` : "★★★★★"}</small>
        </div>
      </div>
    </article>
  );
}

function SectionTitle({
  eyebrow,
  children,
  count,
}: {
  eyebrow: string;
  children: React.ReactNode;
  count?: string;
}) {
  return (
    <div className="section-title">
      <div>
        <span>{eyebrow}</span>
        <h2>{children}</h2>
      </div>
      {count && <b>{count}</b>}
    </div>
  );
}

function CharacterArt() {
  return (
    <div className="character-art" aria-hidden="true">
      <div className="sun" />
      <div className="head">
        <i className="hair h1" />
        <i className="hair h2" />
        <i className="hair h3" />
        <i className="hair h4" />
        <i className="eye e1" />
        <i className="eye e2" />
        <i className="nose" />
        <i className="mouth" />
      </div>
      <div className="neck" />
      <div className="body-shape" />
      <strong>ドン!</strong>
    </div>
  );
}

function Home({
  go,
  add,
  wishes,
  toggleWish,
}: {
  go: (p: Page, id?: number) => void;
  add: (p: Product) => void;
  wishes: number[];
  toggleWish: (id: number) => void;
}) {
  const { products, status, retry } = useProducts();
  return (
    <>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="issue">
              ISSUE 001 <i /> TOKYO / WORLDWIDE
            </div>
            <p className="jp">漫画の世界へようこそ</p>
            <h1>
              ENTER THE
              <br />
              <em>WORLD</em> OF
              <br />
              MANGA.
            </h1>
            <p className="hero-lede">
              Curated stories. Rare objects. Iconic characters.
              <br />
              Your next obsession starts here.
            </p>
            <div className="hero-ctas">
              <Button onClick={() => go("series")}>EXPLORE COLLECTION</Button>
              <Button ghost onClick={() => go("shop")}>
                SHOP NOW
              </Button>
            </div>
          </div>
          <div className="hero-stage">
            <div className="panel panel-a">
              <img src={images.open} alt="Manga pages" />
              <span>
                STORIES
                <br />
                WITHOUT
                <br />
                LIMITS
              </span>
            </div>
            <div className="panel panel-b">
              <img src={images.shelf} alt="Manga archive" />
              <b>02</b>
            </div>
            <CharacterArt />
            <div className="speech">
              READY
              <br />
              TO BEGIN?
            </div>
          </div>
          <div className="scroll-note">
            SCROLL TO ENTER <i />
          </div>
        </section>
        <Marquee />

        <section className="collections page-section">
          <SectionTitle eyebrow="01 / CURATED WORLDS" count="04 SERIES">
            FEATURED
            <br />
            <i>UNIVERSES</i>
          </SectionTitle>
          <div className="collection-grid">
            <button className="collection c1" onClick={() => go("series")}>
              <img src={images.comic} alt="" />
              <span>01 / CYBERPUNK</span>
              <h3>
                NEO
                <br />
                TOKYO
              </h3>
              <p>A city that never forgives.</p>
              <b>探索</b>
            </button>
            <button className="collection c2" onClick={() => go("series")}>
              <img src={images.open} alt="" />
              <span>02 / DARK FANTASY</span>
              <h3>
                VOID
                <br />
                RUNNER
              </h3>
              <p>Beyond the edge of memory.</p>
              <b>虚無</b>
            </button>
            <button className="collection c3" onClick={() => go("series")}>
              <img src={images.stack} alt="" />
              <span>03 / SAMURAI</span>
              <h3>
                BLADE
                <br />
                ZERO
              </h3>
              <p>Honor ends. The blade remains.</p>
              <b>斬!</b>
            </button>
            <button className="collection c4" onClick={() => go("series")}>
              <img src={images.cards} alt="" />
              <span>04 / MECHA</span>
              <h3>
                STEEL
                <br />
                SOUL
              </h3>
              <p>Built to obey. Born to feel.</p>
              <b>鋼</b>
            </button>
          </div>
        </section>

        <section className="arrivals page-section">
          <SectionTitle eyebrow="02 / JUST DROPPED" count="VIEW ALL →">
            NEW
            <br />
            <i>ARRIVALS</i>
          </SectionTitle>
          <div className="product-grid">
            {USE_PRODUCTS_API && status !== "success" && <ProductState status={status} retry={retry} />}
            {USE_PRODUCTS_API && status === "success" && products.length === 0 && <ProductState status="empty" />}
            {(status === "success" ? products : []).slice(0, 4).map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onOpen={() => go("product", p.id)}
                onAdd={() => add(p)}
                wish={wishes.includes(p.id)}
                onWish={() => toggleWish(p.id)}
              />
            ))}
          </div>
        </section>

        <section className="feature-banner">
          <div className="feature-image">
            <img src={images.stack} alt="Curated manga volumes" />
            <span>限定版</span>
          </div>
          <div className="feature-copy">
            <p>03 / COLLECTOR'S DROP</p>
            <h2>
              THE
              <br />
              <i>ARCHIVE</i>
              <br />
              EDITION.
            </h2>
            <div className="feature-row">
              <strong>001—250</strong>
              <p>
                Hand-numbered volumes, exclusive slipcase,
                <br />
                studio print, and collector's seal.
              </p>
            </div>
            <Button onClick={() => go("product")}>DISCOVER THE EDITION</Button>
          </div>
          <b className="wow">WOW!</b>
        </section>

        <section className="best page-section">
          <SectionTitle eyebrow="04 / COMMUNITY FAVORITES" count="BEST SELLERS">
            THE
            <br />
            <i>ICON LIST</i>
          </SectionTitle>
          <div className="product-grid">
            {USE_PRODUCTS_API && status !== "success" && <ProductState status={status} retry={retry} />}
            {USE_PRODUCTS_API && status === "success" && products.length === 0 && <ProductState status="empty" />}
            {(status === "success" ? products : []).slice(4).map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onOpen={() => go("product", p.id)}
                onAdd={() => add(p)}
                wish={wishes.includes(p.id)}
                onWish={() => toggleWish(p.id)}
              />
            ))}
          </div>
        </section>

        <section className="story">
          <div className="story-image">
            <img src={images.shelf} alt="Manga shelves" />
            <b>
              EST.
              <br />
              2024
            </b>
          </div>
          <div className="story-copy">
            <span>05 / OUR MANIFESTO</span>
            <p className="jp">物語は世界を変える</p>
            <h2>
              NOT JUST A STORE.
              <br />
              <i>A PORTAL.</i>
            </h2>
            <p>
              We search Tokyo's hidden shelves, independent studios, and official archives to bring
              you objects with a story. Every piece is selected for the people who never stopped
              believing in other worlds.
            </p>
            <a href="#manifesto">
              READ OUR STORY <Icon name="arrow" size={16} />
            </a>
          </div>
        </section>
        <section className="promo">
          <span>BAM!</span>
          <div>
            <small>FIRST ORDER?</small>
            <h2>
              GET 15% OFF
              <br />
              YOUR FIRST DROP.
            </h2>
            <p>Join the universe for early access, studio stories and members-only releases.</p>
          </div>
          <Button ghost onClick={() => go("shop")}>
            CLAIM THE OFFER
          </Button>
        </section>
      </main>
    </>
  );
}

function Shop({
  go,
  add,
  wishes,
  toggleWish,
}: {
  go: (p: Page, id?: number) => void;
  add: (p: Product) => void;
  wishes: number[];
  toggleWish: (id: number) => void;
}) {
  const { products, status, retry } = useProducts();
  const { t, formatCurrency: currency } = useI18n();
  const formatCurrency = (value: number) => currency(value, USE_PRODUCTS_API ? "VND" : "USD");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const filtered = products.filter(
    (p) =>
      (category === "All" || (USE_PRODUCTS_API ? p.categoryKey : p.category) === category) &&
      p.name.toLowerCase().includes(query.toLowerCase()),
  );
  const categories = USE_PRODUCTS_API
    ? ["All", ...Array.from(new Set(products.map(p => p.categoryKey ?? "uncategorized")))]
    : ["All", "Manga", "Figures", "Posters", "Apparel", "Accessories"];
  const priceMax = USE_PRODUCTS_API ? Math.max(1, ...products.map(p => p.originalPrice ?? p.price)) : 150;
  return (
    <main className="inner-page">
      <div className="page-hero">
        <p>THE FULL ARCHIVE / 2025</p>
        <h1>
          SHOP <i>ALL</i>
        </h1>
        <b>買物</b>
      </div>
      <div className="shop-tools">
        <label>
          <Icon name="search" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SEARCH THE ARCHIVE"
          />
        </label>
        <span>
          {filtered.length.toLocaleString()} {t("OBJECTS")}
        </span>
        <select aria-label="Sort products" disabled={USE_PRODUCTS_API || undefined}>
          <option>SORT: FEATURED</option>
          <option>PRICE: LOW TO HIGH</option>
          <option>NEWEST FIRST</option>
        </select>
      </div>
      <div className="shop-layout">
        <aside>
          <h3>FILTER / 絞り込み</h3>
          {categories.map((c) => (
            <button
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
              key={c}
            >
              {USE_PRODUCTS_API && c !== "All" ? products.find(p => p.categoryKey === c)?.category || t("Uncategorized") : c}
              <span>{c === "All" ? products.length : products.filter((p) => (USE_PRODUCTS_API ? p.categoryKey : p.category) === c).length}</span>
            </button>
          ))}
          <hr />
          <h3>PRICE RANGE</h3>
          <input type="range" min="0" max={priceMax} disabled={USE_PRODUCTS_API || undefined} />
          <div className="range-label">
            <span>{formatCurrency(0)}</span>
            <span>{formatCurrency(priceMax)}+</span>
          </div>
        </aside>
        <div>
          <div className="product-grid shop-grid">
            {status === "loading" && <><span role="status" style={{ gridColumn: "1 / -1" }}>{t("Loading products…")}</span><ProductSkeletons /></>}
            {status === "error" && <ProductState status="error" retry={retry} />}
            {USE_PRODUCTS_API && status === "success" && filtered.length === 0 && <ProductState status="empty" />}
            {status === "success" && filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onOpen={() => go("product", p.id)}
                onAdd={() => add(p)}
                wish={wishes.includes(p.id)}
                onWish={() => toggleWish(p.id)}
              />
            ))}
          </div>
          <div className="pagination" hidden={USE_PRODUCTS_API || undefined} style={USE_PRODUCTS_API ? { display: "none" } : undefined}>
            <button>←</button>
            <button className="active">01</button>
            <button>02</button>
            <button>03</button>
            <button>→</button>
          </div>
        </div>
      </div>
    </main>
  );
}

function ApiProductPage({ id, add, go }: { id: number | null; add: (p: Product) => void; go: (p: Page, id?: number) => void }) {
  const { product, status, retry, notFound } = useProduct(id);
  if (status !== "success" || !product) return <main className="inner-page product-page"><ProductState status={status === "success" ? "error" : status} retry={retry} notFound={notFound} /></main>;
  return <ProductPage key={product.id} product={product} add={add} go={go} />;
}

function ProductPage({ add, go, product }: { add: (p: Product) => void; go: (p: Page, id?: number) => void; product?: Product }) {
  const { products } = useProducts();
  const { t, formatCurrency: currency } = useI18n();
  const formatCurrency = (value: number) => currency(value, product?.source === "api" ? "VND" : "USD");
  const p = product ?? products[1];
  const [qty, setQty] = useState(1);
  const [main, setMain] = useState(product?.image ?? images.cards);
  return (
    <main className="inner-page product-page" data-product-id={product?.id}>
      <div className="crumbs">
        {product ? <span data-product-text="true">{p.category} / <b>{p.name}</b></span> : <>HOME / FIGURES / BLADE//ZERO / <b>THE RONIN</b></>}
      </div>
      <div className="product-detail">
        <div className="gallery">
          <div className="thumbs">
            {(product ? [p.image] : [images.cards, images.comic, images.open]).map((im, i) => (
              <button className={main === im ? "active" : ""} onClick={() => setMain(im)} key={im}>
                <ProductImage src={im} alt={`View ${i + 1}`} />
              </button>
            ))}
          </div>
          <div className="main-image">
            <ProductImage src={main} alt={p.name} />
            {!product && <span>LIMITED / 250</span>}
          </div>
        </div>
        <div className="product-info">
          <span data-product-text={product ? "true" : undefined}>{product ? [p.category, p.series].filter(Boolean).join(" / ") : "PREMIUM SCALE FIGURE / 01:08"}</span>
          <h1 data-product-text={product ? "true" : undefined} style={product ? { overflowWrap: "anywhere" } : undefined}>
            {product ? p.name : <>THE RONIN<br /><i>FIGURE</i></>}
          </h1>
          <div className="rating" hidden={product ? true : undefined}>
            ★★★★★ <small>{t("4.9 / 38 REVIEWS")}</small>
          </div>
          <h2>{formatCurrency(p.price)}{p.originalPrice !== undefined && <del style={{ marginLeft: 12, fontSize: "0.6em" }}>{formatCurrency(p.originalPrice)}</del>}</h2>
          <p data-product-text={product ? "true" : undefined}>
            {product ? p.description || t("No description available.") : "A museum-grade collectible forged from the world of Blade//Zero. Hand-finished detail, interchangeable katana, and individually numbered base."}
          </p>
          <div className="stock">
            <i /> {product ? `${t(p.stockQuantity ? "IN STOCK" : "OUT OF STOCK")} (${p.stockQuantity})` : "IN STOCK — SHIPS IN 2–3 DAYS"}
          </div>
          <div className="purchase">
            <div className="qty">
              <button onClick={() => setQty(Math.max(1, qty - 1))}>
                <Icon name="minus" />
              </button>
              <b>{qty}</b>
              <button disabled={product && qty >= (p.stockQuantity ?? 0) ? true : undefined} onClick={() => setQty(qty + 1)}>
                <Icon name="plus" />
              </button>
            </div>
            <Button
              disabled={product && !p.stockQuantity ? true : undefined}
              onClick={() => {
                for (let i = 0; i < qty; i++) add(p);
              }}
            >
              {t("ADD TO CART")} — {formatCurrency(p.price * qty)}
            </Button>
          </div>
          <button className="buy" onClick={() => go(product ? "cart" : "checkout")}>
            {product ? t("VIEW CART") : "BUY IT NOW"}
          </button>
          {product && <p role="note">{t("Cart preview only. Ordering and payment are not available yet.")}</p>}
          <div className="accordions">
            <button>
              DETAILS & DIMENSIONS <Icon name="plus" />
            </button>
            <button>
              SHIPPING & RETURNS <Icon name="plus" />
            </button>
            <button>
              AUTHENTICITY GUARANTEE <Icon name="plus" />
            </button>
          </div>
        </div>
      </div>
      <section className="related">
        <SectionTitle eyebrow="YOU MAY ALSO ENTER" count="03 OBJECTS">
          RELATED
          <br />
          <i>DROPS</i>
        </SectionTitle>
        <div className="product-grid">
          {(product ? products.filter(x => x.id !== p.id).slice(0, 4) : products.slice(2, 6)).map((x) => (
            <ProductCard
              key={x.id}
              product={x}
              onOpen={() => product ? go("product", x.id) : undefined}
              onAdd={() => add(x)}
              wish={false}
              onWish={() => {}}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function Series({ go }: { go: (p: Page, id?: number) => void }) {
  const { products, status, retry } = useProducts();
  return (
    <main className="series-page">
      <section className="series-hero">
        <img src={images.open} alt="Manga panels" />
        <div>
          <span>SERIES FILE / 002</span>
          <h1>
            VOID
            <br />
            <i>RUNNER</i>
          </h1>
          <p>虚無を駆ける者</p>
          <Button onClick={() => go("shop")}>SHOP THE SERIES</Button>
        </div>
        <b>
          「記憶は
          <br />
          嘘をつく」
        </b>
      </section>
      <Marquee />
      <section className="series-intro page-section">
        <span>THE STORY / 物語</span>
        <h2>
          BEYOND THE EDGE
          <br />
          OF <i>MEMORY.</i>
        </h2>
        <div>
          <p>
            In Sector 9, memories can be bought, sold, and erased. Runner 404 has none—and someone
            wants to keep it that way.
          </p>
          <b>
            07
            <br />
            <small>VOLUMES</small>
          </b>
          <b>
            42
            <br />
            <small>CHAPTERS</small>
          </b>
        </div>
      </section>
      <section className="page-section">
        <SectionTitle eyebrow="THE COMPLETE COLLECTION" count="12 OBJECTS">
          ENTER THE
          <br />
          <i>VOID</i>
        </SectionTitle>
        <div className="product-grid">
            {USE_PRODUCTS_API && status !== "success" && <ProductState status={status} retry={retry} />}
            {USE_PRODUCTS_API && status === "success" && products.length === 0 && <ProductState status="empty" />}
          {(status === "success" ? products : []).slice(0, 4).map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onOpen={() => go("product", p.id)}
              onAdd={() => {}}
              wish={false}
              onWish={() => {}}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function Cart({
  cart,
  setCart,
  go,
}: {
  cart: Product[];
  setCart: (p: Product[]) => void;
  go: (p: Page, id?: number) => void;
}) {
  const { t, formatCurrency: currency } = useI18n();
  const formatCurrency = (value: number) => currency(value, USE_PRODUCTS_API ? "VND" : "USD");
  const grouped = useMemo(
    () =>
      cart.reduce<Record<number, { product: Product; qty: number }>>((a, p) => {
        a[p.id] ? a[p.id].qty++ : (a[p.id] = { product: p, qty: 1 });
        return a;
      }, {}),
    [cart],
  );
  const total = cart.reduce((a, p) => a + p.price, 0);
  const adjust = (p: Product, n: number) => {
    if (n > 0) {
      if (p.source === "api" && cart.filter(x => x.id === p.id).length >= (p.stockQuantity ?? 0)) return;
      setCart([...cart, p]);
    } else {
      setCart(cart.filter((x, i) => !(x.id === p.id && i === cart.findIndex((y) => y.id === p.id))));
    }
  };
  return (
    <main className="inner-page cart-page">
      <div className="page-hero">
        <p>YOUR SELECTED OBJECTS</p>
        <h1>
          THE <i>CART</i>
        </h1>
        <b>{cart.length.toString().padStart(2, "0")}</b>
      </div>
      {cart.length === 0 ? (
        <div className="empty">
          <h2>YOUR PANEL IS EMPTY.</h2>
          <p>The next chapter is waiting.</p>
          <Button onClick={() => go("shop")}>ENTER THE SHOP</Button>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-list">
            <div className="cart-head">
              <span>OBJECT</span>
              <span>QUANTITY</span>
              <span>TOTAL</span>
            </div>
            {Object.values(grouped).map(({ product: p, qty }) => (
              <div className="cart-row" key={p.id}>
                <ProductImage src={p.image} alt="" />
                <div>
                  <small data-product-text={p.source ? "true" : undefined}>{p.series}</small>
                  <h3 data-product-text={p.source ? "true" : undefined}>{p.name}</h3>
                  <p>{formatCurrency(p.price)}</p>
                  <button onClick={() => setCart(cart.filter((x) => x.id !== p.id))}>REMOVE</button>
                </div>
                <div className="qty">
                  <button onClick={() => adjust(p, -1)}>
                    <Icon name="minus" />
                  </button>
                  <b>{qty}</b>
                  <button onClick={() => adjust(p, 1)}>
                    <Icon name="plus" />
                  </button>
                </div>
                <strong>{formatCurrency(p.price * qty)}</strong>
              </div>
            ))}
          </div>
          <aside className="summary">
            <span>ORDER SUMMARY</span>
            <div>
              <p>SUBTOTAL</p>
              <b>{formatCurrency(total)}</b>
            </div>
            <div>
              <p>SHIPPING</p>
              <b>CALCULATED NEXT</b>
            </div>
            <div>
              <p>TAX</p>
              <b>—</b>
            </div>
            <hr />
            <div className="total">
              <p>TOTAL</p>
              <b>{formatCurrency(total)}</b>
            </div>
            <Button disabled={USE_PRODUCTS_API} onClick={() => go("checkout")}>PROCEED TO CHECKOUT</Button>
            {USE_PRODUCTS_API && <p role="note">{t("Cart preview only. Ordering and payment are not available yet.")}</p>}
            <small>SECURE CHECKOUT / AUTHENTICITY GUARANTEED</small>
          </aside>
        </div>
      )}
    </main>
  );
}

function Checkout({ cart, go }: { cart: Product[]; go: (p: Page, id?: number) => void }) {
  const { t, formatCurrency: currency } = useI18n();
  const formatCurrency = (value: number) => currency(value, USE_PRODUCTS_API ? "VND" : "USD");
  const total = cart.reduce((a, p) => a + p.price, 0);
  return (
    <main className="checkout">
      <section>
        <button className="brand checkout-brand" onClick={() => go("home")}>
          <span>MU</span>MANGA UNIVERSE
        </button>
        <p className="steps">
          {t("CART")} — <b>{t("INFORMATION")}</b> — {t("SHIPPING")} — {t("PAYMENT")}
        </p>
        <h1>
          SHIPPING
          <br />
          <i>INFORMATION</i>
        </h1>
        <form onSubmit={(e) => e.preventDefault()}>
          <label>
            EMAIL ADDRESS
            <input type="email" placeholder="YOU@EXAMPLE.COM" />
          </label>
          <div className="form-grid">
            <label>
              FIRST NAME
              <input placeholder="AKIRA" />
            </label>
            <label>
              LAST NAME
              <input placeholder="KUROSAWA" />
            </label>
          </div>
          <label>
            ADDRESS
            <input placeholder="STREET AND NUMBER" />
          </label>
          <div className="form-grid three">
            <label>
              CITY
              <input placeholder="TOKYO" />
            </label>
            <label>
              COUNTRY
              <select>
                <option>JAPAN</option>
                <option>UNITED STATES</option>
                <option>UNITED KINGDOM</option>
              </select>
            </label>
            <label>
              POSTCODE
              <input placeholder="000-0000" />
            </label>
          </div>
          <Button>CONTINUE TO SHIPPING</Button>
        </form>
      </section>
      <aside>
        <span>ORDER / 注文</span>
        {cart.map((p, i) => (
          <div className="checkout-item" key={`${p.id}-${i}`}>
            <ProductImage src={p.image} alt="" />
            <div>
              <b data-product-text={p.source ? "true" : undefined}>{p.name}</b>
              <small data-product-text={p.source ? "true" : undefined}>{p.series}</small>
            </div>
            <strong>{formatCurrency(p.price)}</strong>
          </div>
        ))}
        <hr />
        <div>
          <p>SUBTOTAL</p>
          <b>{formatCurrency(total)}</b>
        </div>
        <div>
          <p>SHIPPING</p>
          <b>—</b>
        </div>
        <div className="checkout-total">
          <p>{USE_PRODUCTS_API ? "TOTAL / VND" : "TOTAL / USD"}</p>
          <b>{formatCurrency(total)}</b>
        </div>
      </aside>
    </main>
  );
}

function Account({ go, wishes }: { go: (p: Page, id?: number) => void; wishes: number[] }) {
  const { t, formatCurrency, formatDate } = useI18n();
  return (
    <main className="inner-page account-page">
      <div className="page-hero">
        <p>MEMBER FILE / 000042</p>
        <h1>
          {t("account.headingLead")} <i>{t("account.headingAccent")}</i>
        </h1>
        <b>会員</b>
      </div>
      <div className="account-layout">
        <aside>
          <b>AK</b>
          <h3>AKIRA KUROSAWA</h3>
          <small>MEMBER SINCE 2024</small>
          {[
            "OVERVIEW",
            "ORDER HISTORY",
            `${t("WISHLIST")} (${wishes.length.toLocaleString()})`,
            "ADDRESSES",
            "ACCOUNT SETTINGS",
          ].map((x, i) => (
            <button className={i === 0 ? "active" : ""} key={x}>
              {x}
              <Icon name="arrow" size={15} />
            </button>
          ))}
        </aside>
        <section>
          <span>DASHBOARD / 概要</span>
          <h2>
            WELCOME BACK,
            <br />
            <i>AKIRA.</i>
          </h2>
          <div className="account-stats">
            <div>
              <b>03</b>
              <p>TOTAL ORDERS</p>
            </div>
            <div>
              <b>{wishes.length.toString().padStart(2, "0")}</b>
              <p>SAVED OBJECTS</p>
            </div>
            <div>
              <b>250</b>
              <p>MEMBER POINTS</p>
            </div>
          </div>
          <h3>RECENT ORDER</h3>
          <div className="order">
            <img src={images.cards} alt="" />
            <div>
              <small>ORDER #MU-240418</small>
              <h4>THE RONIN FIGURE + 2 OBJECTS</h4>
              <p>{formatDate("2025-04-18T12:00:00Z")}</p>
            </div>
            <span>SHIPPED</span>
            <b>{formatCurrency(145.5)}</b>
          </div>
          <Button ghost onClick={() => go("shop")}>
            CONTINUE COLLECTING
          </Button>
        </section>
      </div>
    </main>
  );
}

function Footer({ go }: { go: (p: Page, id?: number) => void }) {
  const { t } = useI18n();
  return (
    <footer>
      <div className="footer-main">
        <div className="footer-brand">
          <div className="brand light">
            <span>MU</span>MANGA
            <br />
            UNIVERSE
          </div>
          <p>
            OBJECTS FROM
            <br />
            OTHER WORLDS.
          </p>
        </div>
        <div>
          <h4>EXPLORE</h4>
          <button onClick={() => go("shop")}>SHOP ALL</button>
          <button onClick={() => go("series")}>MANGA SERIES</button>
          <button>NEW ARRIVALS</button>
          <button>LIMITED EDITIONS</button>
        </div>
        <div>
          <h4>SUPPORT</h4>
          <button>CONTACT</button>
          <button>SHIPPING & RETURNS</button>
          <button>FAQ</button>
          <button>AUTHENTICITY</button>
        </div>
        <div className="newsletter">
          <h4>TRANSMISSIONS / 通信</h4>
          <h3>
            JOIN THE
            <br />
            INNER CIRCLE.
          </h3>
          <label>
            <input placeholder="YOUR EMAIL ADDRESS" />
            <button aria-label="Subscribe">
              <Icon name="arrow" />
            </button>
          </label>
          <p>Early access. Rare drops. No noise.</p>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2025 MANGA UNIVERSE</span>
        <span>INSTAGRAM &nbsp; X / TWITTER &nbsp; YOUTUBE</span>
        <span>
          {t("PRIVACY")} &nbsp; {t("TERMS")}
        </span>
      </div>
      <b className="footer-word">UNIVERSE</b>
    </footer>
  );
}

export default function App() {
  return <ProductsProvider demoProducts={demoProducts}><StoreApp /></ProductsProvider>;
}

function StoreApp() {
  const { language, t } = useI18n();
  useTranslateDocument();
  const [page, setPage] = useState<Page>("home");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [storedCart, setStoredCart] = useState<Product[]>([]);
  const cart = useMemo(() => storedCart.map(p => localizeProduct(p, language)), [storedCart, language]);
  const setCart = (items: Product[]) => setStoredCart(items.filter(p => USE_PRODUCTS_API ? p.source === "api" : p.source !== "api"));
  const [wishes, setWishes] = useState<number[]>([]);
  const [toast, setToast] = useState("");
  const go = (p: Page, id?: number) => {
    if (p === "product" && USE_PRODUCTS_API) {
      if (id === undefined) { setPage("shop"); return; }
      setSelectedId(id);
    }
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const add = (p: Product) => {
    if ((USE_PRODUCTS_API && p.source !== "api") || (!USE_PRODUCTS_API && p.source === "api")) return;
    setStoredCart(x => {
      if (p.source === "api" && x.filter(item => item.id === p.id).length >= (p.stockQuantity ?? 0)) return x;
      return [...x, p];
    });
    setToast(p.name);
    window.setTimeout(() => setToast(""), 2400);
  };
  const toggleWish = (id: number) =>
    setWishes((x) => (x.includes(id) ? x.filter((n) => n !== id) : [...x, id]));
  useEffect(() => {
    document.title =
      language === "vi"
        ? "Manga Universe — Vật phẩm từ những thế giới khác"
        : "Manga Universe — Objects From Other Worlds";
  }, [language]);
  return (
    <div className="app">
      {page !== "checkout" && <Header go={go} cartCount={cart.length} />}
      {page === "home" && <Home go={go} add={add} wishes={wishes} toggleWish={toggleWish} />}
      {page === "shop" && <Shop go={go} add={add} wishes={wishes} toggleWish={toggleWish} />}
      {page === "product" && (USE_PRODUCTS_API ? <ApiProductPage id={selectedId} add={add} go={go} /> : <ProductPage add={add} go={go} />)}
      {page === "series" && <Series go={go} />}
      {page === "cart" && <Cart cart={cart} setCart={setCart} go={go} />}
      {page === "checkout" && <Checkout cart={cart} go={go} />}
      {page === "account" && <Account go={go} wishes={wishes} />}
      {page !== "checkout" && <Footer go={go} />}
      {toast && (
        <div className="toast">
          <span>✓</span>
          {toast} {t("ADDED TO CART")}
          <button onClick={() => go("cart")}>{t("VIEW CART")}</button>
        </div>
      )}
    </div>
  );
}
