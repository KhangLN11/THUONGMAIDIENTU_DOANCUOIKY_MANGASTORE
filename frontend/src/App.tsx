import { ProductInfoAccordion } from "./components/product-information/ProductInfoAccordion";
import {discardOtherCheckoutDraft} from "./checkout/resumeDraft";
import {completionId} from "./checkout/routes";
import {DemoCheckout} from "./checkout/DemoCheckout";
import "./shop/product-actions.css";
import { ShopCatalog } from "./shop/ShopCatalog";
import { initialShopFilters,demoProductId } from "./shop/shopModel";
import { BuyNowCheckout, BuyNowResume } from "./shop/BuyNowCheckout";
import { readBuyNowIntent,saveBuyNowIntent,clearBuyNowIntent,isBuyNowRoute,buyNowId } from "./shop/buyNowIntent";
import { AboutPage } from "./pages/AboutPage";
import "./discovery/series-hero-placement.css";
import { DynamicHero } from "./discovery/DynamicHero";
import { SeriesExplorer, FigureCollections } from "./discovery/SeriesExplorer";
import { initialDiscoveryFilters, type DiscoveryFilters } from "./discovery/catalogModel";
import { discoveryRoute } from "./discovery/routes";
import { MangaFlipbookLoader } from "./components/loading/MangaFlipbookLoader";
import { AdminApp } from "./admin/AdminApp";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useI18n, useTranslateDocument } from "./i18n";
import type { Product } from "./types/product";
import { USE_PRODUCTS_API } from "./config/products";
import { localizeProduct } from "./adapters/productAdapter";
import { ProductsProvider, useProducts, useProduct } from "./hooks/useProducts";
import { featuredManga } from "./config/featuredManga";
import { ApiCheckout } from "./components/ApiCheckout";
import { useCommerce } from "./hooks/useCommerce";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AccountPanel } from "./components/AccountPanel";
import { ProductImage } from "./components/ProductImage";
import { ProductState, ProductSkeletons } from "./components/ProductState";

type Page = "about" | "wishlist" | "home" | "shop" | "product" | "series" | "collections" | "cart" | "checkout" | "account";

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

// Editorial Demo panels are static: they do not represent database series.
const demoFeaturedManga = [
  { key: "neo-tokyo", title: ["NEO", "TOKYO"], category: "CYBERPUNK", description: "A city that never forgives.", image: images.comic, mark: "探索" },
  { key: "void-runner", title: ["VOID", "RUNNER"], category: "DARK FANTASY", description: "Beyond the edge of memory.", image: images.open, mark: "虚無" },
  { key: "blade-zero", title: ["BLADE", "ZERO"], category: "SAMURAI", description: "Honor ends. The blade remains.", image: images.stack, mark: "斬!" },
  { key: "steel-soul", title: ["STEEL", "SOUL"], category: "MECHA", description: "Built to obey. Born to feel.", image: images.cards, mark: "鋼" },
] as const;


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

function Header({ go, cartCount, activePage }: { go: (p: Page, id?: number) => void; cartCount: number; activePage: Page }) {
  const [open, setOpen] = useState(false);
  const { language, setLanguage, t } = useI18n();
  const links: [string, Page][] = [
    [t("HOME"), "home"],
    [t("SHOP"), "shop"],
    [t("nav.series"), "series"],
    [t("nav.accessories"), "collections"],
    [t("ABOUT US"), "about"],
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
            aria-current={activePage === page ? "page" : undefined}
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
        <button aria-label={t("Wishlist")} onClick={() => go("wishlist")}>
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

const PurchaseActions = createContext<{buy:(p:Product,quantity?:number)=>void;pending:boolean;add:(p:Product)=>void;wish:(id:number)=>void;wishes:number[]}>({buy:()=>{},pending:false,add:()=>{},wish:()=>{},wishes:[]});

function ProductCard({
  product,
  onOpen,
  onAdd,
  wish,
  onWish,
  shopActions,
}: {
  product: Product;
  onOpen: () => void;
  onAdd: () => void;
  wish: boolean;
  onWish: () => void;
  shopActions?: { buy: () => void; pending: boolean };
}) {
  const actions=useContext(PurchaseActions);
  const unavailable=actions.pending || (product.source==="api" && !product.stockQuantity);
  const { t, formatCurrency: currency } = useI18n();
  const formatCurrency = (value: number) => currency(value, product.source === "api" ? "VND" : "USD");
  return (
    <article className="product-card" data-source={product.source} data-shop-product={shopActions ? product.id : undefined}>
      <div className="product-img" onClick={onOpen}>
        <ProductImage src={product.image} alt={product.name} />
        {<button className="shop-image-open" type="button" aria-label={t("shop.detail")+": "+product.name} onClick={e=>{e.stopPropagation();onOpen();}}/>}
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
        {!shopActions && <div className="quick-actions">
          <button
            onClick={(e) => {
              e.stopPropagation();
              actions.buy(product);
            }}
            disabled={unavailable}
          >
            {t("BUY NOW")}
          </button>
          <button
            disabled={unavailable}
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
          >
            {t("ADD TO CART")}
          </button>
        </div>}
      </div>
      <div className="product-meta">
        <p data-product-text={product.source ? "true" : undefined} style={product.source ? { minHeight: "2.4em" } : undefined}>{product.source === "api" ? [product.category, product.series].filter(Boolean).join(" / ") : product.series}</p>
        <h3 data-product-text={product.source ? "true" : undefined} style={product.source ? { minHeight: "2.4em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined}>{<button type="button" className="shop-product-name" onClick={onOpen}>{product.name}</button>}</h3>
        <div style={product.source ? { flexWrap: "wrap", gap: 8 } : undefined}>
          <span>{formatCurrency(product.price)}{product.originalPrice !== undefined && <del style={{ marginLeft: 8 }}>{formatCurrency(product.originalPrice)}</del>}</span>
          <small style={product.source ? { display: "inline-block" } : undefined}>{product.source === "api" ? `${t(product.stockQuantity ? "IN STOCK" : "OUT OF STOCK")} (${product.stockQuantity})` : "★★★★★"}</small>
        </div>
      </div>
      {shopActions && <div className="shop-card-actions"><button type="button" disabled={shopActions.pending || (product.source==='api' && !product.stockQuantity)} onClick={e=>{e.stopPropagation();shopActions.buy();}}>{t("BUY NOW")}</button><button type="button" disabled={shopActions.pending || (product.source==='api' && !product.stockQuantity)} onClick={e=>{e.stopPropagation();onAdd();}}>{t("ADD TO CART")}</button></div>}
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
  openSeries,
  add,
  wishes,
  toggleWish,
}: {
  go: (p: Page, id?: number) => void;
  openSeries: (slug: string) => void;
  add: (p: Product) => void;
  wishes: number[];
  toggleWish: (id: number) => void;
}) {
  const { products, status, retry } = useProducts();
  const { language, t } = useI18n();
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
            {USE_PRODUCTS_API ? featuredManga.map((series, index) => (
              <button className={`collection c${index + 1}`} key={series.slug}
                data-featured-series={series.slug} onClick={() => openSeries(series.slug)}>
                <img src={series.image} alt="" style={{ objectPosition: series.position }} />
                <span data-product-text>{String(index + 1).padStart(2, "0")} / {series.category[language]}</span>
                <h3 data-product-text>{series.title[0]}{series.title[1] && <> <br />{series.title[1]}</>}</h3>
                <p data-product-text>{series.description[language]}</p>
                <b>{series.mark}</b>
              </button>
            )) : demoFeaturedManga.map((series, index) => (
              <button type="button" aria-disabled="true" className={`collection c${index + 1}`} key={series.key} data-featured-demo={series.key}>
                <img src={series.image} alt="" />
                <span>{String(index + 1).padStart(2, "0")} / {t(series.category)}</span>
                <h3>{t(series.title[0])}<br />{t(series.title[1])}</h3>
                <p>{t(series.description)}</p>
                <b>{series.mark}</b>
              </button>
            ))}
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
  seriesSlug,
  wishlistOnly = false,
  commercePending = false,
  add,
  wishes,
  toggleWish,
}: {
  go: (p: Page, id?: number) => void;
  seriesSlug: string | null;
  wishlistOnly?: boolean;
  commercePending?: boolean;
  add: (p: Product) => void;
  wishes: number[];
  toggleWish: (id: number) => void;
}) {
  const { products, status: productStatus, retry } = useProducts();
  const status = wishlistOnly && commercePending ? "loading" : productStatus;
  const { t, formatCurrency: currency } = useI18n();
  const formatCurrency = (value: number) => currency(value, USE_PRODUCTS_API ? "VND" : "USD");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const scope = wishlistOnly ? products.filter(p => wishes.includes(p.id)) : products;
  const seriesProducts = seriesSlug
    ? scope.filter(p => p.source === "api" && p.api?.series?.slug === seriesSlug)
    : scope;
  const filtered = seriesProducts.filter(
    (p) =>
      (category === "All" || (USE_PRODUCTS_API ? p.categoryKey : p.category) === category) &&
      p.name.toLowerCase().includes(query.toLowerCase()),
  );
  const categories = USE_PRODUCTS_API
    ? ["All", ...Array.from(new Set(seriesProducts.map(p => p.categoryKey ?? "uncategorized")))]
    : ["All", "Manga", "Figures", "Posters", "Apparel", "Accessories"];
  const priceMax = USE_PRODUCTS_API ? Math.max(1, ...seriesProducts.map(p => p.originalPrice ?? p.price)) : 150;
  return (
    <main className="inner-page">
      <div className="page-hero">
        <p>THE FULL ARCHIVE / 2025</p>
        <h1>
          {wishlistOnly ? t("WISHLIST") : <>SHOP <i>ALL</i></>}
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
              <span>{c === "All" ? seriesProducts.length : seriesProducts.filter((p) => (USE_PRODUCTS_API ? p.categoryKey : p.category) === c).length}</span>
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
  const actions=useContext(PurchaseActions);
  const p = product ?? products[1];
  const [qty, setQty] = useState(1);
  const gallery = product
    ? p.gallery?.length ? p.gallery : [{ id: 0, image: p.image, alt: p.name, sortOrder: 0, isPrimary: false }]
    : [images.cards, images.comic, images.open].map((image, index) => ({ id: index, image, alt: `View ${index + 1}`, sortOrder: index, isPrimary: false }));
  const initialImage = product
    ? gallery.find(image => image.isPrimary && image.image === p.image) ?? gallery.find(image => image.image === p.image) ?? gallery[0]
    : gallery[0];
  const mainImageRef = useRef<HTMLDivElement>(null);
  const [mainImageHeight, setMainImageHeight] = useState(650);
  useEffect(() => {
    if (!product || !mainImageRef.current) return;
    const image = mainImageRef.current;
    const update = () => setMainImageHeight(image.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(image);
    return () => observer.disconnect();
  }, [product?.id]);
  const [selectedImageId, setSelectedImageId] = useState(initialImage.id);
  const activeImage = gallery.find(image => image.id === selectedImageId) ?? initialImage;
  return (
    <main className="inner-page product-page" data-product-id={product?.id}>
      <div className="crumbs">
        {product ? <span data-product-text="true">{p.category} / <b>{p.name}</b></span> : <>HOME / FIGURES / BLADE//ZERO / <b>THE RONIN</b></>}
      </div>
      <div className="product-detail">
        <div className="gallery">
          <div className="thumbs" style={product ? { overflow: "auto", maxHeight: mainImageHeight, minWidth: 0 } : undefined}>
            {gallery.map((image) => (
              <button className={activeImage.id === image.id ? "active" : ""} onClick={() => setSelectedImageId(image.id)} key={image.id} aria-pressed={product ? activeImage.id === image.id : undefined} style={product ? { flexShrink: 0 } : undefined}>
                <ProductImage src={image.image} alt={image.alt} variant="trueColor" />
              </button>
            ))}
          </div>
          <div className="main-image" ref={mainImageRef}>
            <ProductImage src={activeImage.image} alt={product ? activeImage.alt : p.name} variant="trueColor" />
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
            <i /> {product ? p.source==='api'?`${t(p.stockQuantity ? "IN STOCK" : "OUT OF STOCK")} (${p.stockQuantity})`:t("shop.demoStock") : "IN STOCK — SHIPS IN 2–3 DAYS"}
          </div>
          <div className="purchase">
            <div className="qty">
              <button onClick={() => setQty(Math.max(1, qty - 1))}>
                <Icon name="minus" />
              </button>
              <b>{qty}</b>
              <button disabled={product?.source === "api" && qty >= (p.stockQuantity ?? 0) ? true : undefined} onClick={() => setQty(qty + 1)}>
                <Icon name="plus" />
              </button>
            </div>
            <Button
              disabled={product?.source === "api" && !p.stockQuantity ? true : undefined}
              onClick={() => {
                for (let i = 0; i < qty; i++) add(p);
              }}
            >
              {t("ADD TO CART")} — {formatCurrency(p.price * qty)}
            </Button>
          </div>
          <button className="buy" disabled={actions.pending || (p.source==="api" && (p.stockQuantity??0)<qty)} onClick={() => actions.buy(p,qty)}>
            {t("BUY NOW")}
          </button>
          <ProductInfoAccordion key={p.id} product={p} />
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
              onOpen={() => go("product", x.id)}
              onAdd={() => add(x)}
              wish={actions.wishes.includes(x.id)}
              onWish={() => actions.wish(x.id)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function Series({ go }: { go: (p: Page, id?: number) => void }) {
  const { products, status, retry } = useProducts();
  const actions=useContext(PurchaseActions);
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
              onAdd={() => actions.add(p)}
              wish={actions.wishes.includes(p.id)}
              onWish={() => actions.wish(p.id)}
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
  onQuantity,
  serverSubtotal,
  lineTotals,
  busy,
  pending,
}: {
  cart: Product[];
  onQuantity: (id: number, quantity: number) => void;
  serverSubtotal?: number;
  lineTotals?: Record<number, number>;
  busy: boolean;
  pending: boolean;
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
  const total = serverSubtotal ?? cart.reduce((a, p) => a + p.price, 0);
  const adjust = (p: Product, n: number) => {
    if (USE_PRODUCTS_API) {
      const quantity = cart.filter(x => x.id === p.id).length + n;
      if (n > 0 && quantity > (p.stockQuantity ?? 0)) return;
      onQuantity(p.id, Math.max(0, quantity)); return;
    }
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
      {pending && cart.length === 0 ? <div className="empty"><p role="status">{t("commerce.loading")}</p></div> : cart.length === 0 ? (
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
                  <button disabled={busy} onClick={() => USE_PRODUCTS_API ? onQuantity(p.id, 0) : setCart(cart.filter((x) => x.id !== p.id))}>REMOVE</button>
                </div>
                <div className="qty">
                  <button disabled={busy} onClick={() => adjust(p, -1)}>
                    <Icon name="minus" />
                  </button>
                  <b>{qty}</b>
                  <button disabled={busy || (p.source === "api" && qty >= (p.stockQuantity ?? 0))} onClick={() => adjust(p, 1)}>
                    <Icon name="plus" />
                  </button>
                </div>
                <strong>{formatCurrency(lineTotals?.[p.id] ?? p.price * qty)}</strong>
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
            <Button disabled={busy || pending} onClick={() => go("checkout")}>PROCEED TO CHECKOUT</Button>
            {USE_PRODUCTS_API && <p role="note">{t("order.codPending")}</p>}
            <small>SECURE CHECKOUT / AUTHENTICITY GUARANTEED</small>
          </aside>
        </div>
      )}
    </main>
  );
}

function Account({ go, wishes, onOrderChanged,wishlistPending,wishlistError,onRetryWishlist }: { go: (p: Page, id?: number) => void; wishes: number[]; onOrderChanged: () => void;wishlistPending:boolean;wishlistError:string|null;onRetryWishlist:()=>void }) {
  return <AccountPanel onShop={() => go("shop")} onWishlist={() => go("wishlist")} onOrderChanged={onOrderChanged} wishes={wishes} wishlistPending={wishlistPending} wishlistError={wishlistError} onRetryWishlist={onRetryWishlist}/>;
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
  return <AuthProvider><ProductsProvider demoProducts={demoProducts}><MangaFlipbookLoader /><StoreApp /></ProductsProvider></AuthProvider>;
}

function StoreApp() {
  const {user:checkoutUser}=useAuth();
  const returnBuyAfterLogin=useRef(false);
  useEffect(()=>{if(checkoutUser)discardOtherCheckoutDraft(checkoutUser.id);},[checkoutUser?.id]);
  const { language, t } = useI18n();
  useTranslateDocument();
  const [page, setPage] = useState<Page>(() => !USE_PRODUCTS_API && demoProductId(window.location.hash)!==null ? "product" : (isBuyNowRoute(window.location.hash)||completionId()!==null) ? "checkout" : discoveryRoute(window.location.hash) && (USE_PRODUCTS_API || discoveryRoute(window.location.hash)!.page !== "product") ? discoveryRoute(window.location.hash)!.page : window.location.hash === "#checkout" ? "checkout" : window.location.hash === "#wishlist" ? "wishlist" : window.location.hash === "#cart" ? "cart" : (window.location.hash === "#account"||window.location.hash.startsWith("#account/")||window.location.hash.startsWith("#account?")) ? "account" : "home");
  useEffect(() => {
    const openAccount = () => { const hash = window.location.hash;
      if(!USE_PRODUCTS_API && demoProductId(hash)!==null){setPage("product");setSelectedId(demoProductId(hash));setProductOrigin("#shop");return;}
      if(isBuyNowRoute(hash)||completionId(hash)!==null){setPage("checkout");return;}
      const candidate=discoveryRoute(hash); const route=candidate && (USE_PRODUCTS_API || candidate.page!=="product")?candidate:null;
      if(route){setPage(route.page);if(route.page==="series")setSelectedSeriesSlug(route.slug);if(route.page==="product"){setSelectedId(route.id);const origin=window.history.state?.mangaOrigin;setProductOrigin(typeof origin==="string"&&discoveryRoute(origin)?origin:null);}if(route.page==="collections")setDiscoveryFilters(f=>({...f,figure:{...f.figure,series:route.slug??"all"}}));return;}
      if(hash.startsWith("#account/")||hash.startsWith("#account?")){setPage("account");return;}
      if(hash==="")setPage("home"); if (hash === "#checkout" || hash === "#account" || hash === "#wishlist" || hash === "#cart") setPage(hash.slice(1) as Page); };
    window.addEventListener("hashchange", openAccount);
    window.addEventListener("popstate", openAccount);
    return () => { window.removeEventListener("hashchange", openAccount); window.removeEventListener("popstate", openAccount); };
  }, []);
  const [adminRoute, setAdminRoute] = useState(() => window.location.hash === "#admin" || window.location.hash.startsWith("#admin/"));
  useEffect(() => {
    const route = () => setAdminRoute(window.location.hash === "#admin" || window.location.hash.startsWith("#admin/"));
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
  }, []);
  const [selectedSeriesSlug,setSelectedSeriesSlug]=useState<string|null>(()=>discoveryRoute(window.location.hash)?.page==="series"?discoveryRoute(window.location.hash)!.slug:null);
  const [discoveryFilters,setDiscoveryFilters]=useState<DiscoveryFilters>(()=>({...initialDiscoveryFilters,figure:{...initialDiscoveryFilters.figure,series:discoveryRoute(window.location.hash)?.page==="collections"?discoveryRoute(window.location.hash)!.slug??"all":"all"}}));
  const [productOrigin,setProductOrigin]=useState<string|null>(()=>{const origin=window.history.state?.mangaOrigin;return !USE_PRODUCTS_API&&demoProductId(window.location.hash)!==null?"#shop":typeof origin==='string'&&discoveryRoute(origin)?origin:null;});
  const [shopFilters,setShopFilters]=useState(initialShopFilters);
  const [buyIntent,setBuyIntent]=useState(readBuyNowIntent);
  const [shopSeriesSlug, setShopSeriesSlug] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(()=>USE_PRODUCTS_API?discoveryRoute(window.location.hash)?.id??null:demoProductId(window.location.hash));
  const commerce = useCommerce();
  const catalog = useProducts();
  const { cart, wishes, setCart, toggleWish } = commerce;
  const [toast, setToast] = useState("");
  const toastOwner = useRef(commerce.accountKey);
  const toastTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    setToast("");
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
    return () => { if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current); };
  }, [commerce.accountKey]);
  const go = (p: Page, id?: number) => {
    if(p=== "checkout"){setToast("");clearBuyNowIntent();setBuyIntent(null);}
    if(p==="series"){openSeries(null);return;}
    if(p==="collections"){openFigures();return;}
    if(!USE_PRODUCTS_API&&p==="product"){
      if(id!==undefined){setProductOrigin("#shop");setSelectedId(id);window.history.pushState({mangaOrigin:"#shop"},"","#product/demo/"+id);}else{setProductOrigin(null);setSelectedId(null);}
    }
    if(USE_PRODUCTS_API&&p==="product"&&id!==undefined){const origin=page==="product"?productOrigin:window.location.hash==="#shop"||window.location.hash.startsWith("#series")||window.location.hash.startsWith("#collections")?window.location.hash:null;setProductOrigin(origin);window.history.pushState({mangaOrigin:origin},"","#product/"+id);}
    else if (p !== "product") window.history.pushState(null, "", "#" + p);
    if (p === "shop") setShopSeriesSlug(null);
    if (p === "product" && USE_PRODUCTS_API) {
      if (id === undefined) { setPage("shop"); return; }
      setSelectedId(id);
    }
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openSeries = (slug: string | null) => {
    setSelectedSeriesSlug(slug);setPage("series");window.history.pushState(null,"",slug?"#series/"+slug:"#series");window.scrollTo({top:0,behavior:"smooth"});
  };
  const openFigures=(slug?:string)=>{setDiscoveryFilters(f=>({...f,figure:{...f.figure,series:slug??"all"}}));setPage("collections");window.history.pushState(null,"",slug?"#collections/"+slug:"#collections");window.scrollTo({top:0,behavior:"smooth"});};
  const returnToDiscovery=()=>{const route=productOrigin?discoveryRoute(productOrigin):null;if(route?.page==="series")openSeries(route.slug);else if(route?.page==="shop")go("shop");else if(route?.page==="collections")openFigures(route.slug??(discoveryFilters.figure.series==="all"?undefined:discoveryFilters.figure.series));};
  const add = (p: Product) => {
    void commerce.add(p).then(added => {
      if (!added) return;
      toastOwner.current = commerce.accountKey;
      setToast(p.name);
      if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(""), 2400);
    });
  };
  useEffect(() => {
    document.title =
      language === "vi"
        ? "Manga Universe — Vật phẩm từ những thế giới khác"
        : "Manga Universe — Objects From Other Worlds";
  }, [language]);
  const resumeBuyNow=()=>{if(!buyIntent)return;setToast("");window.history.pushState(null,"","#checkout/buy-now/"+buyIntent.productId);setPage("checkout");window.scrollTo({top:0,behavior:"smooth"});};
  const beginBuyNow=(p:Product,quantity=1)=>{if(!Number.isInteger(quantity)||quantity<1||quantity>999||(USE_PRODUCTS_API&&(p.source!=="api"||(p.stockQuantity??0)<quantity)))return;setToast("");setBuyIntent(saveBuyNowIntent(p.id,quantity));window.history.pushState(null,"","#checkout/buy-now/"+p.id);setPage("checkout");window.scrollTo({top:0,behavior:"smooth"});};
  useEffect(()=>{if(returnBuyAfterLogin.current&&checkoutUser&&page==="account"&&buyIntent){returnBuyAfterLogin.current=false;resumeBuyNow();}},[checkoutUser?.id,page,buyIntent]);
  useEffect(()=>{if(page!=="account"||!checkoutUser)return;const route=sessionStorage.getItem("manga-checkout-return");if(route&&completionId(route)!==null){sessionStorage.removeItem("manga-checkout-return");history.pushState(null,"",route);setPage("checkout");}},[checkoutUser?.id,page]);
  const cancelBuyNow=()=>{clearBuyNowIntent();setBuyIntent(null);};
  const renderShopProduct=(p:Product)=><ProductCard key={p.id} product={p} onOpen={()=>go("product",p.id)} onAdd={()=>add(p)} wish={wishes.includes(p.id)} onWish={()=>toggleWish(p.id)} shopActions={{buy:()=>beginBuyNow(p),pending:commerce.loading||commerce.busy}}/>;
  const renderDiscoveryProduct=(p:Product)=><div className="discovery-product-item" key={p.id} data-discovery-product={p.id}><ProductCard product={p} onOpen={()=>go("product",p.id)} onAdd={()=>add(p)} wish={wishes.includes(p.id)} onWish={()=>toggleWish(p.id)}/></div>;
  if (adminRoute) return <AdminApp />;
  return (
    <PurchaseActions.Provider value={{buy:beginBuyNow,pending:commerce.loading||commerce.busy,add,wish:toggleWish,wishes}}><div className="app">
      {<Header go={go} cartCount={cart.length} activePage={page === "product" ? (productOrigin?.startsWith("#series") ? "series" : productOrigin?.startsWith("#collections") ? "collections" : "shop") : page} />}
      {USE_PRODUCTS_API && commerce.loading && <p role="status">{t("commerce.loading")}</p>}
      {USE_PRODUCTS_API && commerce.error && <div role="alert"><p>{t(`commerce.error.${commerce.error}`)}</p><button onClick={() => void commerce.retry()}>{t("TRY AGAIN")}</button></div>}
      {page === "wishlist" && <Shop seriesSlug={null} wishlistOnly commercePending={commerce.loading} go={go} add={add} wishes={wishes} toggleWish={toggleWish} />}
      {page === "home" && <Home go={go} openSeries={openSeries} add={add} wishes={wishes} toggleWish={toggleWish} />}
      {page === "shop" && <ShopCatalog seriesSlug={shopSeriesSlug} filters={shopFilters} onFilters={setShopFilters} renderProduct={renderShopProduct}/>}
      {page === "product" && (USE_PRODUCTS_API ? <>{productOrigin&&<div className="discovery-return" data-product-text><button className="discovery-breadcrumb" onClick={returnToDiscovery}>← {t(productOrigin==="#shop"?"shop.back":productOrigin.startsWith("#collections")?"discovery.allCollections":"discovery.backSeries")}</button></div>}<ApiProductPage id={selectedId} add={add} go={go} /></> : productOrigin==="#shop" && selectedId!==null ? (demoProducts.some(p=>p.id===selectedId)?<ProductPage key={selectedId} product={demoProducts.find(p=>p.id===selectedId)!} add={add} go={go}/>:<main className="inner-page"><ProductState status="error" notFound/></main>):<ProductPage add={add} go={go} />)}
      {page === "series" && (USE_PRODUCTS_API?<>{selectedSeriesSlug===null&&<div className="series-hero-slot" data-series-hero-slot><DynamicHero openSeries={openSeries} openFigures={()=>openFigures()}/></div>}<SeriesExplorer slug={selectedSeriesSlug} openSeries={openSeries} filters={discoveryFilters} onFilters={setDiscoveryFilters} renderProduct={renderDiscoveryProduct} openFigures={openFigures}/></>:<Series go={go}/>)}
      {page === "collections" && USE_PRODUCTS_API && <FigureCollections filters={discoveryFilters} onFilters={setDiscoveryFilters} renderProduct={renderDiscoveryProduct} openFigures={openFigures}/>}
      {page === "about" && <AboutPage go={go} />}
      {page === "collections" && !USE_PRODUCTS_API && <main className="discovery-surface discovery-collections-page" data-product-text><section className="discovery-figures" data-figure-collections><div className="discovery-section-heading"><div><p className="discovery-kicker">DEMO / ANIME COLLECTIONS</p><h2>{t("discovery.reality")}</h2><p>{t("discovery.figuresIntro")}</p></div></div><div className="product-grid discovery-figure-grid">{demoProducts.filter(p => p.category === "Figures" || p.category === "Accessories").map(p => <ProductCard key={p.id} product={p} onOpen={() => go("product", p.id)} onAdd={() => add(p)} wish={wishes.includes(p.id)} onWish={() => toggleWish(p.id)} />)}</div></section></main>}
      {page === "cart" && <Cart cart={cart} setCart={setCart} go={go} onQuantity={commerce.quantity} serverSubtotal={commerce.subtotal} lineTotals={commerce.lineTotals} busy={commerce.busy || commerce.loading} pending={commerce.loading || !!commerce.error} />}
      {page === "checkout" && isBuyNowRoute(window.location.hash) && <BuyNowCheckout key={window.location.hash} intent={buyIntent?.productId===buyNowId(window.location.hash)?buyIntent:null} onShop={()=>{cancelBuyNow();go("shop");}} onAccount={()=>{returnBuyAfterLogin.current=true;go("account");}} onOrders={()=>{cancelBuyNow();go("account");}} onPlaced={async()=>{setBuyIntent(null);catalog.retry();}}/>}
      {page === "checkout" && !isBuyNowRoute(window.location.hash) && (USE_PRODUCTS_API ? <ApiCheckout key={(completionId()!==null?"receipt-"+completionId()+"-":"")+(commerce.accountKey ?? "guest")} completedOrderId={completionId()} cart={cart} pending={commerce.loading} onHome={() => go("shop")} onAccount={() => go("account")} onOrders={() => go("account")} onPlaced={async () => { await commerce.retry(); catalog.retry(); }} /> : <DemoCheckout cart={cart} onShop={()=>go("shop")} />)}
      {page === "account" && <BuyNowResume intent={buyIntent} onContinue={resumeBuyNow} onCancel={cancelBuyNow}/>}
      {page === "account" && <Account go={go} wishes={wishes} wishlistPending={commerce.loading} wishlistError={commerce.error} onRetryWishlist={()=>void commerce.retry()} onOrderChanged={() => { void commerce.retry(); catalog.retry(); }} />}
      {<Footer go={go} />}
      {toast && toastOwner.current === commerce.accountKey && (
        <div className="toast">
          <span>✓</span>
          {toast} {t("ADDED TO CART")}
          <button onClick={() => go("cart")}>{t("VIEW CART")}</button>
        </div>
      )}
    </div></PurchaseActions.Provider>
  );
}
