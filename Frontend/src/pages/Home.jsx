import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../components/product/ProductCard";
import { fetchHomepageBlogs } from "../api/blogApi";
import { fetchHomepageOffers } from "../api/couponApi";
import { fetchPublicWhyShop } from "../api/settingsApi";
import { flattenCategoryTree, fallbackCategoryTree } from "../data/category-data";
import {
  arrivalProducts,
  featuredBrands,
  featuredProducts,
  frameProducts
} from "../data/storefront-content";
import { resolveMediaUrl } from "../utils/media";
import { copyText } from "../utils/storefront";

function getCategoryHomepageRule(category) {
  const value = category.dynamicRuleJson;
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? value : {};
}

function resolveStorefrontMediaUrl(value, fallback = "") {
  return resolveMediaUrl(value, fallback);
}

function handleCategoryImageError(event) {
  event.currentTarget.closest(".category-art")?.classList.add("category-art-missing");
  event.currentTarget.remove();
}

function getHomepageBrowseEntryKey(entry) {
  return String(entry.categoryId ?? entry.categorySlug ?? entry.id ?? "");
}

function getCategoryKey(category) {
  return String(category.id ?? category.slug ?? category.name ?? "");
}

function normalizeCardsPerRow(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.min(10, Math.max(1, Math.floor(count))) : 4;
}

function normalizeMobileCardsPerRow(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.min(3, Math.max(1, Math.floor(count))) : 1;
}

function normalizeTabletCardsPerRow(value, fallback = 2) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.min(6, Math.max(1, Math.floor(count))) : fallback;
}

function normalizeProductButtonDisplayType(value, fallback = "both") {
  return ["view_product", "add_to_cart", "both", "none"].includes(value) ? value : fallback;
}

function getBrowseCategoriesSettings(homepageSettings = {}) {
  const settings = homepageSettings.browseCategoriesSettings || {};
  return {
    enabled: settings.enabled !== false,
    title: String(settings.title || "Shop by Category").trim(),
    subtitle: String(settings.subtitle || "").trim(),
    cardsPerRow: normalizeCardsPerRow(settings.cardsPerRow),
    mobileCardsPerRow: normalizeMobileCardsPerRow(settings.mobileCardsPerRow),
    sortOrder: Number.isFinite(Number(settings.sortOrder)) ? Number(settings.sortOrder) : 10
  };
}

function getHomepageSectionSettings(homepageSettings = {}, key, fallback) {
  const settings = homepageSettings[key] || {};
  return {
    ...fallback,
    ...settings,
    enabled: settings.enabled !== false,
    title: String(settings.title || fallback.title).trim(),
    subtitle: String(settings.subtitle || "").trim(),
    cardsPerRow: normalizeCardsPerRow(settings.cardsPerRow ?? fallback.cardsPerRow),
    tabletCardsPerRow: normalizeTabletCardsPerRow(settings.tabletCardsPerRow ?? fallback.tabletCardsPerRow, fallback.tabletCardsPerRow ?? fallback.cardsPerRow ?? 2),
    mobileCardsPerRow: normalizeMobileCardsPerRow(settings.mobileCardsPerRow ?? fallback.mobileCardsPerRow),
    buttonDisplayType: normalizeProductButtonDisplayType(settings.buttonDisplayType, fallback.buttonDisplayType || "both"),
    sortOrder: Number.isFinite(Number(settings.sortOrder)) ? Number(settings.sortOrder) : fallback.sortOrder
  };
}

function isActiveProduct(product) {
  return String(product?.status || "active").toLowerCase() === "active";
}

function getLiveSectionProducts(productCatalog, predicate, fallbackProducts) {
  const liveProducts = productCatalog.filter((product) => isActiveProduct(product) && (!predicate || predicate(product)));
  if (liveProducts.length) return liveProducts;
  return productCatalog.filter(isActiveProduct);
}

function getHomepageBrowseCategories(siteCategories, homepageSettings) {
  const flatCategories = flattenCategoryTree(siteCategories).filter((category) => !category.parentId && category.status === "active");
  const configured = Array.isArray(homepageSettings.browseCategories) ? homepageSettings.browseCategories : [];

  if (!configured.length) {
    return flatCategories
      .filter((category) => Boolean(category.featuredCategory))
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
  }

  return configured
    .filter((entry) => entry.status !== "inactive" && entry.showOnHomepage !== false)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    .map((entry) => {
      const entryKey = getHomepageBrowseEntryKey(entry);
      const category = flatCategories.find((item) =>
        getCategoryKey(item) === entryKey ||
        String(item.slug || "") === String(entry.categorySlug || "")
      );

      if (!category) return null;

      const currentRule = getCategoryHomepageRule(category);
      return {
        ...category,
        imageUrl: entry.imageUrl || category.imageUrl,
        dynamicRuleJson: {
          ...currentRule,
          homepageButtonText: entry.buttonText || currentRule.homepageButtonText || "Explore Now",
          homepageButtonLink: entry.buttonLink || currentRule.homepageButtonLink || `/category/${category.slug}`
        },
        sortOrder: Number(entry.sortOrder || category.sortOrder || 0)
      };
    })
    .filter(Boolean);
}

function isBannerInDisplayWindow(banner) {
  const now = new Date();
  const startDate = banner.startDate ? new Date(`${String(banner.startDate).slice(0, 10)}T00:00:00`) : null;
  const endDate = banner.endDate ? new Date(`${String(banner.endDate).slice(0, 10)}T23:59:59`) : null;

  if (startDate && now < startDate) return false;
  if (endDate && now > endDate) return false;
  return true;
}

function isExternalLink(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function normalizeHomepageOffer(coupon) {
  const code = String(coupon.code || "").trim();
  return {
    key: String(coupon.id || code),
    code,
    badgeText: coupon.badgeText || coupon.offerBadgeText || coupon.title || code,
    title: coupon.title || coupon.offerCardTitle || coupon.title || "Limited offer",
    description: coupon.description || coupon.offerCardDescription || `${code} is available on eligible products.`,
    image: coupon.backgroundImageUrl || coupon.image || "",
    buttonText: coupon.buttonText || "Explore",
    buttonLink: coupon.buttonLink || "/offers",
    sortOrder: Number(coupon.sortOrder ?? coupon.homepageSortOrder ?? 0)
  };
}

function formatBlogDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function normalizeHomepageBlog(blog) {
  const publishedAt = blog.publishedAt || blog.published_at || blog.createdAt || "";
  return {
    id: String(blog.id || blog.slug || blog.title),
    slug: blog.slug || "",
    title: blog.title || "",
    tag: blog.tagName || blog.tag || "",
    subtitle: blog.subtitle || blog.excerpt || "",
    excerpt: blog.excerpt || blog.subtitle || "",
    image: blog.featuredImageUrl || blog.image || "",
    publishedDate: formatBlogDate(publishedAt),
    publishedDateIso: String(publishedAt || "").slice(0, 10),
    sortOrder: Number(blog.homepageSortOrder || 0)
  };
}

function normalizeWhyShopItem(item = {}, index = 0) {
  const iconPosition = ["left", "right", "top"].includes(item.iconPosition) ? item.iconPosition : "left";
  return {
    id: item.id || `why-shop-item-${index}`,
    title: String(item.title || "").trim(),
    iconUrl: String(item.iconUrl || "").trim(),
    iconPosition,
    iconSize: Math.min(120, Math.max(16, Number(item.iconSize || 42))),
    titleFontSize: Math.min(42, Math.max(10, Number(item.titleFontSize || item.fontSize || 18))),
    textColor: item.textColor || "#0f172a",
    cardBackgroundColor: item.cardBackgroundColor || item.cardBackground || "#ffffff",
    cardBorderColor: item.cardBorderColor || "#e5e7eb",
    cardRadius: Math.min(48, Math.max(0, Number(item.cardRadius ?? 16))),
    sortOrder: Number(item.sortOrder || index + 1)
  };
}

function normalizeWhyShopSection(payload = {}) {
  const data = payload.data || {};
  const section = data.section || data.settings || {};
  const items = Array.isArray(data.items) ? data.items : [];
  return {
    enabled: data.enabled !== false && section.enabled !== false && items.length > 0,
    section: {
      title: section.title || "Why Shop With Avyona",
      subtitle: section.subtitle || "",
      cardsPerRow: Math.min(10, Math.max(1, Number(section.cardsPerRow || 4))),
      mobileCardsPerRow: Math.min(3, Math.max(1, Number(section.mobileCardsPerRow || 1))),
      sortOrder: Number(section.sortOrder || 30),
      backgroundColor: section.backgroundColor || "#f8fafc",
      textColor: section.textColor || "#0f172a",
      customCss: section.customCss || ""
    },
    items: items.map(normalizeWhyShopItem).filter((item) => item.title).sort((left, right) => left.sortOrder - right.sortOrder)
  };
}

function isSafeHeroLink(value) {
  const link = String(value || "").trim();
  return !link || link.startsWith("/") || isExternalLink(link);
}

function isVideoHeroBanner(banner) {
  const videoUrl = String(banner?.desktopVideo || banner?.mobileVideo || "").trim();
  return banner?.mediaType === "video" || /\.(mp4|webm|mov)(?:\?|#|$)/i.test(videoUrl);
}

function getVideoMimeType(url) {
  const value = String(url || "").toLowerCase();
  if (value.includes(".webm")) return "video/webm";
  if (value.includes(".mov")) return "video/quicktime";
  return "video/mp4";
}

export default function Home({ context }) {
  const productCatalog = Array.isArray(context.allProducts) && context.allProducts.length ? context.allProducts : [];
  const siteCategories = context.siteCategories && context.siteCategories.length ? context.siteCategories : fallbackCategoryTree;
  const [activeCategory, setActiveCategory] = useState("all");
  const [bannerIndex, setBannerIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);
  const [isMobileHeroViewport, setIsMobileHeroViewport] = useState(false);
  const [failedBannerMedia, setFailedBannerMedia] = useState({});
  const [homepageOffers, setHomepageOffers] = useState([]);
  const [homepageBlogs, setHomepageBlogs] = useState([]);
  const [whyShopSection, setWhyShopSection] = useState({ enabled: false, section: {}, items: [] });
  const [copiedHomepageOfferCode, setCopiedHomepageOfferCode] = useState("");
  const homepageSettings = context.siteSettings?.homepage || {};
  const browseCategoriesSettings = getBrowseCategoriesSettings(homepageSettings);
  const ourProductsSettings = getHomepageSectionSettings(homepageSettings, "ourProductsSettings", {
    enabled: true,
    title: "Our Products",
    subtitle: "",
    cardsPerRow: 4,
    mobileCardsPerRow: 2,
    buttonDisplayType: "both",
    sortOrder: 20
  });
  const bestSellerProductsSettings = getHomepageSectionSettings(homepageSettings, "bestSellerProductsSettings", {
    enabled: true,
    title: "Best Sellers and Trending",
    subtitle: "",
    cardsPerRow: 4,
    mobileCardsPerRow: 2,
    buttonDisplayType: "both",
    sortOrder: 40
  });
  const newArrivalProductsSettings = getHomepageSectionSettings(homepageSettings, "newArrivalProductsSettings", {
    enabled: true,
    title: "New Arrivals",
    subtitle: "",
    cardsPerRow: 3,
    mobileCardsPerRow: 2,
    buttonDisplayType: "both",
    sortOrder: 60
  });
  const featuredBrandsSettings = getHomepageSectionSettings(homepageSettings, "featuredBrandsSettings", {
    enabled: true,
    title: "Featured Brands",
    subtitle: "",
    cardsPerRow: 6,
    mobileCardsPerRow: 2,
    sortOrder: 80
  });
  const newsletterSettings = getHomepageSectionSettings(homepageSettings, "newsletterSettings", {
    enabled: true,
    title: "Stay Updated",
    subtitle: "Get offers, product launches, and helpful buying guides from Avyona.",
    cardsPerRow: 1,
    mobileCardsPerRow: 1,
    sortOrder: 90
  });
  const blogPostsSettings = getHomepageSectionSettings(homepageSettings, "blogPostsSettings", {
    enabled: true,
    title: "Blog",
    subtitle: "Buying guides and electronics insights that support discovery",
    cardsPerRow: 3,
    tabletCardsPerRow: 2,
    mobileCardsPerRow: 1,
    sortOrder: 85
  });
  const mainCategories = getHomepageBrowseCategories(siteCategories, homepageSettings);
  const displayOffers = homepageOffers;
  const activeTopCategories = flattenCategoryTree(siteCategories)
    .filter((category) => !category.parentId && category.status === "active")
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
  const globalHeroCta = homepageSettings.globalHeroCta || {};
  const heroBanners = (homepageSettings.heroBanners || [])
    .filter((banner) =>
      banner.status === "active" &&
      isBannerInDisplayWindow(banner) &&
      (banner.desktopImage || banner.mobileImage || banner.desktopVideo || banner.mobileVideo)
    )
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
  const activeHeroBanners = heroBanners;
  const currentBanner = activeHeroBanners[bannerIndex] || activeHeroBanners[0];
  const currentVideoUrl = currentBanner?.desktopVideo || currentBanner?.mobileVideo || "";
  const currentMobileVideoUrl = currentBanner?.mobileVideo || currentBanner?.desktopVideo || "";
  const currentDesktopImageUrl = resolveStorefrontMediaUrl(currentBanner?.desktopImage || currentBanner?.mobileImage || "");
  const currentMobileImageUrl = resolveStorefrontMediaUrl(currentBanner?.mobileImage || currentBanner?.desktopImage || "");
  const currentIsVideo = isVideoHeroBanner(currentBanner) && Boolean(currentVideoUrl || currentMobileVideoUrl);
  const currentVideoSrc = resolveStorefrontMediaUrl(isMobileHeroViewport && currentMobileVideoUrl
    ? currentMobileVideoUrl
    : currentVideoUrl || currentMobileVideoUrl);
  const currentButtonText = globalHeroCta.enabled
    ? globalHeroCta.buttonText
    : currentBanner?.ctaEnabled === false
      ? ""
      : currentBanner?.buttonText;
  const currentButtonLink = globalHeroCta.enabled ? globalHeroCta.buttonLink : currentBanner?.buttonLink;
  const safeButtonLink = isSafeHeroLink(currentButtonLink) ? currentButtonLink : "/collections";
  const titleStyle = {
    fontSize: currentBanner?.titleFontSize ? `clamp(28px, 5vw, ${Number(currentBanner.titleFontSize)}px)` : undefined,
    fontFamily: currentBanner?.fontFamily || undefined,
    fontStyle: currentBanner?.fontStyle || undefined,
    fontWeight: currentBanner?.fontWeight || undefined
  };
  const subtitleStyle = {
    fontSize: currentBanner?.subtitleFontSize ? `${Number(currentBanner.subtitleFontSize)}px` : undefined,
    fontFamily: currentBanner?.fontFamily || undefined,
    fontStyle: currentBanner?.fontStyle || undefined,
    fontWeight: currentBanner?.fontWeight === "800" ? "700" : currentBanner?.fontWeight || undefined
  };
  useEffect(() => {
    if (isHeroPaused || activeHeroBanners.length < 2) return undefined;

    const id = window.setInterval(() => {
      setBannerIndex((current) => (current + 1) % activeHeroBanners.length);
    }, 3500);
    return () => window.clearInterval(id);
  }, [activeHeroBanners.length, isHeroPaused]);

  useEffect(() => {
    setBannerIndex(0);
  }, [activeHeroBanners.length]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => setIsMobileHeroViewport(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener?.("change", updateViewport);
    return () => mediaQuery.removeEventListener?.("change", updateViewport);
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetchHomepageBlogs()
      .then((response) => {
        if (!isMounted) return;
        const rows = Array.isArray(response.data) ? response.data : [];
        setHomepageBlogs(rows.map(normalizeHomepageBlog).filter((blog) => blog.slug && blog.title));
      })
      .catch(() => {
        if (isMounted) setHomepageBlogs([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetchPublicWhyShop()
      .then((response) => {
        if (!isMounted) return;
        setWhyShopSection(normalizeWhyShopSection(response));
      })
      .catch(() => {
        if (isMounted) setWhyShopSection({ enabled: false, section: {}, items: [] });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetchHomepageOffers()
      .then((response) => {
        if (!isMounted) return;
        const rows = Array.isArray(response.data) ? response.data : [];
        setHomepageOffers(rows.map(normalizeHomepageOffer));
      })
      .catch(() => {
        if (isMounted) setHomepageOffers([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const findProductByIdentifier = (identifier) => {
    const normalizedIdentifier = String(identifier || "").trim().toLowerCase();
    if (!normalizedIdentifier) return null;

    return productCatalog.find((product) =>
      [product.asin, product.sku, product.slug]
        .filter(Boolean)
        .some((value) => String(value).trim().toLowerCase() === normalizedIdentifier)
    ) || null;
  };
  const getConfiguredHomepageProducts = (key) => Array.isArray(homepageSettings[key])
    ? homepageSettings[key]
        .filter((entry) => entry.status !== "inactive")
        .sort((left, right) => Number(left.slotNumber || left.sortOrder || 0) - Number(right.slotNumber || right.sortOrder || 0))
        .map((entry) => {
          const product = findProductByIdentifier(entry.productAsin || entry.productSlug);
          return product ? { ...product, ...entry } : null;
        })
        .filter(Boolean)
    : [];
  const hasBestSellerCategoryConfig = Array.isArray(homepageSettings.bestSellerCategories);
  const selectedBestSellerCategories = hasBestSellerCategoryConfig
    ? homepageSettings.bestSellerCategories
    : [];
  const configuredOurProducts = Array.isArray(homepageSettings.ourProducts)
    ? getConfiguredHomepageProducts("ourProducts")
    : [];
  const ourProductsFallback = getLiveSectionProducts(
    productCatalog,
    (product) => String(product.collectionSlug || "").toLowerCase() === "digital-photo-frames",
    frameProducts
  );
  const homepageOurProducts = (configuredOurProducts.length ? configuredOurProducts : ourProductsFallback)
    .filter((product) => isActiveProduct(product) && product.showInOurProducts !== false);
  const configuredBestSellerProducts = getConfiguredHomepageProducts("bestSellerProducts");
  const liveBestSellerFallback = getLiveSectionProducts(productCatalog, null, featuredProducts);
  const allowBestSellerCategory = (product) =>
    !hasBestSellerCategoryConfig ||
    selectedBestSellerCategories.includes(product.collectionSlug) ||
    productCatalog.length > 0;
  const bestSellerCategoryTabs = hasBestSellerCategoryConfig
    ? activeTopCategories.filter((category) => selectedBestSellerCategories.includes(category.slug))
    : activeTopCategories;
  const bestSellerSourceProducts = (configuredBestSellerProducts.length ? configuredBestSellerProducts : liveBestSellerFallback)
    .filter(allowBestSellerCategory)
    .filter((product) => isActiveProduct(product) && product.bestSeller !== false && product.trending !== false);
  const homepageBestSellerProducts = activeCategory === "all"
    ? bestSellerSourceProducts
    : bestSellerSourceProducts.filter((product) => product.collectionSlug === activeCategory);
  const configuredNewArrivalProducts = getConfiguredHomepageProducts("newArrivalProducts");
  const liveArrivalFallback = getLiveSectionProducts(productCatalog, null, arrivalProducts);
  const homepageNewArrivalProducts = (configuredNewArrivalProducts.length ? configuredNewArrivalProducts : liveArrivalFallback)
    .filter((product) => isActiveProduct(product) && product.newArrival !== false);
  const configuredFeaturedBrands = Array.isArray(homepageSettings.featuredBrands)
    ? homepageSettings.featuredBrands
        .filter((brand) => brand.status !== "inactive" && (brand.logoUrl || brand.name))
        .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    : [];
  const homepageFeaturedBrands = configuredFeaturedBrands.length
    ? configuredFeaturedBrands
    : featuredBrands.map((brand, index) => ({
        id: `fallback-brand-${brand}`,
        name: brand,
        logoUrl: "",
        sortOrder: index + 1
      }));

  useEffect(() => {
    if (activeCategory === "all") return;
    if (!bestSellerCategoryTabs.some((category) => category.slug === activeCategory)) {
      setActiveCategory("all");
    }
  }, [activeCategory, bestSellerCategoryTabs]);

  return (
    <main className="container homepage-container">
      <section
        className="hero-banner"
        style={{ order: 0 }}
        aria-label="Featured highlights"
        onMouseEnter={() => setIsHeroPaused(true)}
        onMouseLeave={() => setIsHeroPaused(false)}
      >
        {currentBanner ? <div className="hero-slider">
          <article className="hero-slide">
            {currentIsVideo ? (
              <video
                key={`hero-video-${currentBanner.id || currentVideoSrc}`}
                className="hero-banner-image"
                src={currentVideoSrc}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label={currentBanner.altText || currentBanner.title || "Avyona featured banner"}
                onLoadedData={(event) => {
                  event.currentTarget.play?.().catch?.(() => {});
                }}
                onCanPlay={(event) => {
                  event.currentTarget.play?.().catch?.(() => {});
                }}
              />
            ) : (currentDesktopImageUrl || currentMobileImageUrl) ? (
              <picture>
                <source media="(max-width: 767px)" srcSet={currentMobileImageUrl || currentDesktopImageUrl} />
                <img
                  className="hero-banner-image"
                  src={currentDesktopImageUrl || currentMobileImageUrl}
                  alt={currentBanner.altText || currentBanner.title || "Avyona featured banner"}
                  fetchPriority="high"
                  onError={() => setFailedBannerMedia((current) => ({ ...current, [currentBanner.id]: true }))}
                />
              </picture>
            ) : null}
            {currentBanner.textEnabled !== false && (currentBanner.title || currentBanner.subtitle) ? (
              <div className="hero-banner-copy">
                {currentBanner.title ? <h1 style={titleStyle}>{currentBanner.title}</h1> : null}
                {currentBanner.subtitle ? <p style={subtitleStyle}>{currentBanner.subtitle}</p> : null}
              </div>
            ) : null}
          </article>
        </div> : null}
        {activeHeroBanners.length > 1 ? (
          <>
            <button className="hero-arrow hero-arrow-prev" type="button" onClick={() => setBannerIndex((bannerIndex - 1 + activeHeroBanners.length) % activeHeroBanners.length)}><span aria-hidden="true">&#8249;</span></button>
            <button className="hero-arrow hero-arrow-next" type="button" onClick={() => setBannerIndex((bannerIndex + 1) % activeHeroBanners.length)}><span aria-hidden="true">&#8250;</span></button>
          </>
        ) : null}
        {currentButtonText ? (
          isExternalLink(safeButtonLink) ? (
            <a className="hero-banner-cta" href={safeButtonLink} target="_blank" rel="noreferrer">{currentButtonText}</a>
          ) : (
            <Link className="hero-banner-cta" to={safeButtonLink || "/collections"}>{currentButtonText}</Link>
          )
        ) : null}
      </section>

      {browseCategoriesSettings.enabled ? (
        <section className="section-block category-section" style={{ order: browseCategoriesSettings.sortOrder ?? 10 }}>
          <div className="section-heading section-heading-centered">
            <div>
              <p className="eyebrow category-heading-tag">Browse</p>
              <h2>{browseCategoriesSettings.title}</h2>
              {browseCategoriesSettings.subtitle ? <p>{browseCategoriesSettings.subtitle}</p> : null}
            </div>
          </div>
          <div
            className="category-grid"
            style={{
              "--category-cards-per-row": browseCategoriesSettings.cardsPerRow,
              "--category-mobile-cards-per-row": browseCategoriesSettings.mobileCardsPerRow
            }}
          >
            {mainCategories.map((category) => {
              const homepageRule = getCategoryHomepageRule(category);
              const buttonText = homepageRule.homepageButtonText || "Explore Now";
              const buttonLink = homepageRule.homepageButtonLink || `/category/${category.slug}`;
              const categoryImage = resolveStorefrontMediaUrl(category.imageUrl || category.bannerImageUrl);

              return (
                <Link key={category.slug} className="category-card category-card-link" to={buttonLink}>
                  {categoryImage ? <div className="category-art">
                    <img src={categoryImage} alt={category.name} loading="lazy" decoding="async" onError={handleCategoryImageError} />
                  </div> : null}
                  <div className="category-copy">
                    <h3>{category.name}</h3>
                    <p>{category.description}</p>
                  </div>
                  <div className="category-meta">
                    <span className="category-meta-label">{`${Number(category.productCount ?? category.productSlugs?.length ?? 0)} Products`}</span>
                    <span className="category-action-chip">{buttonText}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {ourProductsSettings.enabled ? (
        <section className="section-block spotlight-block" style={{ order: ourProductsSettings.sortOrder }}>
          <div className="section-heading section-heading-centered">
            <div>
              <h3 className="section-title-large section-title-accent">{ourProductsSettings.title}</h3>
              {ourProductsSettings.subtitle ? <p>{ourProductsSettings.subtitle}</p> : null}
            </div>
          </div>
          <div
            className="product-grid homepage-dynamic-grid"
            style={{
              "--homepage-cards-per-row": ourProductsSettings.cardsPerRow,
              "--homepage-mobile-cards-per-row": ourProductsSettings.mobileCardsPerRow
            }}
          >
            {homepageOurProducts.map((product) => (
              <ProductCard key={product.slug} product={product} context={context} actionLabel="View Product" actionMode="link" buttonDisplayType={ourProductsSettings.buttonDisplayType} />
            ))}
          </div>
        </section>
      ) : null}

      {whyShopSection.enabled ? (
        <section
          className="trust-section avyona-why-shop"
          style={{
            order: whyShopSection.section.sortOrder ?? 30,
            "--why-shop-cards-per-row": whyShopSection.section.cardsPerRow,
            "--why-shop-mobile-cards-per-row": whyShopSection.section.mobileCardsPerRow,
            background: whyShopSection.section.backgroundColor,
            color: whyShopSection.section.textColor
          }}
        >
          {whyShopSection.section.customCss ? <style>{whyShopSection.section.customCss}</style> : null}
          <div className="section-heading section-heading-centered">
            <div>
              <h4 className="section-title-medium">{whyShopSection.section.title}</h4>
              {whyShopSection.section.subtitle ? <p>{whyShopSection.section.subtitle}</p> : null}
            </div>
          </div>
          <div className="trust-grid">
            {whyShopSection.items.map((item) => (
              <article
                key={item.id}
                className={`trust-card trust-card-icon-${item.iconPosition}`}
                style={{
                  background: item.cardBackgroundColor,
                  borderColor: item.cardBorderColor,
                  borderRadius: `${item.cardRadius}px`,
                  color: item.textColor,
                  "--trust-icon-size": `${item.iconSize}px`,
                  "--trust-title-size": `${item.titleFontSize}px`,
                  "--trust-text-color": item.textColor,
                  "--trust-card-background": item.cardBackgroundColor,
                  "--trust-card-border": item.cardBorderColor,
                  "--trust-card-radius": `${item.cardRadius}px`
                }}
              >
                <span className="trust-icon" aria-hidden="true">
                  {item.iconUrl ? <img src={resolveStorefrontMediaUrl(item.iconUrl)} alt="" loading="lazy" decoding="async" /> : null}
                </span>
                <strong>{item.title}</strong>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {null}
      {bestSellerProductsSettings.enabled ? (
        <section className="section-block" style={{ order: bestSellerProductsSettings.sortOrder }}>
          <div className="section-heading section-heading-centered catalog-heading">
            <div>
              <h4 className="section-title-medium">{bestSellerProductsSettings.title}</h4>
              {bestSellerProductsSettings.subtitle ? <p>{bestSellerProductsSettings.subtitle}</p> : null}
            </div>
          </div>
          <div className="catalog-tabs">
            {["all", ...bestSellerCategoryTabs.map((category) => category.slug)].map((categorySlug) => (
              <button key={categorySlug} className={`catalog-tab ${activeCategory === categorySlug ? "active" : ""}`} type="button" onClick={() => setActiveCategory(categorySlug)}>
                {categorySlug === "all" ? "All" : (bestSellerCategoryTabs.find((category) => category.slug === categorySlug)?.name || categorySlug)}
              </button>
            ))}
          </div>
          <div
            className="product-grid homepage-dynamic-grid"
            style={{
              "--homepage-cards-per-row": bestSellerProductsSettings.cardsPerRow,
              "--homepage-mobile-cards-per-row": bestSellerProductsSettings.mobileCardsPerRow
            }}
          >
            {homepageBestSellerProducts.map((product) => (
              <ProductCard key={product.slug} product={product} context={context} eyebrow="Best Seller / Trending" actionLabel="View Product" actionMode="link" buttonDisplayType={bestSellerProductsSettings.buttonDisplayType} />
            ))}
          </div>
        </section>
      ) : null}

      {displayOffers.length ? (
      <section className="section-block limited-offers-section" style={{ order: 50 }}>
        <div className="offers-showcase">
          <div className="section-heading section-heading-centered offer-heading"><div><h2 className="section-title-large section-title-accent">Limited Time Offers</h2></div></div>
          <div className="offer-banner-section">
            {displayOffers.map((offer) => (
              <article key={offer.key} className={`offer-banner promo-banner offer-banner-${offer.key}`}>
                {offer.image ? <div className="offer-banner-media">
                  <img src={resolveStorefrontMediaUrl(offer.image)} alt={offer.title} loading="lazy" decoding="async" />
                </div> : null}
                <span className="offer-tag">{offer.badgeText}</span>
                <div className="offer-banner-copy">
                  <p className="eyebrow">{offer.title}</p>
                  <h3>{offer.description}</h3>
                  <div className="offer-actions">
                    <button
                      className="offer-copy-button"
                      type="button"
                      onClick={() => copyText(offer.code, () => {
                        setCopiedHomepageOfferCode(offer.code);
                        window.setTimeout(() => setCopiedHomepageOfferCode((current) => current === offer.code ? "" : current), 1800);
                      })}
                    >
                      Copy Coupon
                    </button>
                    {isExternalLink(offer.buttonLink) ? (
                      <a className="primary-button" href={offer.buttonLink}>{offer.buttonText}</a>
                    ) : (
                      <Link className="primary-button" to={offer.buttonLink || "/offers"}>{offer.buttonText}</Link>
                    )}
                  </div>
                  {copiedHomepageOfferCode === offer.code ? <p className="offer-copy-message">Coupon copied</p> : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      ) : null}

      {newArrivalProductsSettings.enabled ? (
        <section className="section-block" style={{ order: newArrivalProductsSettings.sortOrder }}>
          <div className="section-heading section-heading-centered arrival-heading">
            <div>
              <p className="eyebrow">{newArrivalProductsSettings.title}</p>
              {newArrivalProductsSettings.subtitle ? <p>{newArrivalProductsSettings.subtitle}</p> : null}
            </div>
          </div>
          <div
            className="mini-grid homepage-dynamic-grid"
            style={{
              "--homepage-cards-per-row": newArrivalProductsSettings.cardsPerRow,
              "--homepage-mobile-cards-per-row": newArrivalProductsSettings.mobileCardsPerRow
            }}
          >
            {homepageNewArrivalProducts.map((product) => (
              <ProductCard key={product.slug} product={product} context={context} eyebrow="New Arrival" actionLabel="View Product" actionMode="link" buttonDisplayType={newArrivalProductsSettings.buttonDisplayType} />
            ))}
          </div>
        </section>
      ) : null}

      {blogPostsSettings.enabled && homepageBlogs.length ? (
      <section className="section-block blog-section" style={{ order: blogPostsSettings.sortOrder }}>
        <div className="section-heading section-heading-centered blog-section-heading">
          <div>
            <p className="eyebrow">{blogPostsSettings.title || "Blog"}</p>
            {blogPostsSettings.subtitle ? <p>{blogPostsSettings.subtitle}</p> : null}
          </div>
        </div>
        <div
          className="blog-grid homepage-dynamic-grid"
          style={{
            "--homepage-cards-per-row": blogPostsSettings.cardsPerRow,
            "--homepage-tablet-cards-per-row": blogPostsSettings.tabletCardsPerRow,
            "--homepage-mobile-cards-per-row": blogPostsSettings.mobileCardsPerRow
          }}
        >
          {homepageBlogs.map((entry) => (
            <article key={entry.id} className="blog-card">
              <Link className="blog-card-link" to={`/blogs/${entry.slug}`}>
                {entry.image ? <div className="blog-art"><img src={resolveStorefrontMediaUrl(entry.image)} alt={entry.title} loading="lazy" decoding="async" /></div> : null}
                <div className="blog-card-meta">
                  {entry.tag ? <span>{entry.tag}</span> : null}
                  {entry.publishedDate ? <time dateTime={entry.publishedDateIso}>{entry.publishedDate}</time> : null}
                </div>
                <h3>{entry.title}</h3>
                <p>{entry.excerpt || entry.subtitle}</p>
                <span className="blog-read-link">Read More</span>
              </Link>
            </article>
          ))}
        </div>
      </section>
      ) : null}

      {featuredBrandsSettings.enabled ? (
      <section className="section-block brand-section" id="brands" style={{ order: featuredBrandsSettings.sortOrder }}>
        <div className="section-heading section-heading-centered brand-heading">
          <div>
            <p className="eyebrow">{featuredBrandsSettings.title}</p>
            {featuredBrandsSettings.subtitle ? <p>{featuredBrandsSettings.subtitle}</p> : null}
          </div>
        </div>
        <div
          className="brand-grid"
          style={{
            "--brand-cards-per-row": featuredBrandsSettings.cardsPerRow,
            "--brand-mobile-cards-per-row": featuredBrandsSettings.mobileCardsPerRow
          }}
        >
          <div className="brand-track">
            {[...homepageFeaturedBrands, ...homepageFeaturedBrands].map((brand, index) => (
              <div key={`${brand.id || brand.name}-${index}`} className="brand-logo-card" aria-hidden={index >= homepageFeaturedBrands.length}>
                {brand.logoUrl ? <img src={brand.logoUrl} alt={index >= homepageFeaturedBrands.length ? "" : brand.name} loading="lazy" decoding="async" /> : <span>{brand.name}</span>}
              </div>
            ))}
          </div>
        </div>
      </section>
      ) : null}

      {newsletterSettings.enabled ? (
      <section className="newsletter-section" style={{ order: newsletterSettings.sortOrder }}>
        <div className="newsletter-copy-group">
          <p className="eyebrow">{newsletterSettings.title}</p>
          {newsletterSettings.subtitle ? <p className="newsletter-copy">{newsletterSettings.subtitle}</p> : null}
        </div>
        <form
          className="newsletter-form"
          onSubmit={(event) => {
            event.preventDefault();
            context.notify("Subscribed successfully");
            event.currentTarget.reset();
          }}
        >
          <input type="email" placeholder="Enter your email address" aria-label="Email address" required />
          <button className="primary-button" type="submit">Subscribe</button>
        </form>
      </section>
      ) : null}
    </main>
  );
}
