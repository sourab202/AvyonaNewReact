import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import SeoManager from "./components/layout/SeoManager";
import StoreLayout from "./components/layout/StoreLayout";
import { trackAnalyticsEvent } from "./api/analyticsApi";
import { fetchCategoryTree } from "./api/categoryApi";
import { fetchStorefrontCoupons } from "./api/couponApi";
import { fallbackCategoryTree } from "./data/category-data";
import { fetchGeneralSettings, fetchPublicSettings, fetchPublicThemeSettings } from "./api/settingsApi";
import { fetchStorefrontProducts } from "./api/productApi";
import { clearCustomerToken, fetchCurrentCustomer, fetchCustomerCart, fetchCustomerOrders, fetchCustomerWishlist, getCustomerToken, syncCustomerCart, syncCustomerWishlist } from "./api/customerApi";
import { couponRules } from "../../shared/coupons";
import { DEFAULT_APP_SETTINGS, getPublicSettings, mergeSettings } from "../../shared/appSettings";
import ProtectedRoute from "./components/common/ProtectedRoute";
import { usePersistentState } from "./hooks/usePersistentState";
import { resolveMediaList, resolveMediaUrl } from "./utils/media";

const AccountPage = lazy(() => import("./pages/AccountPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogsPage = lazy(() => import("./pages/BlogsPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const CollectionPage = lazy(() => import("./pages/CollectionPage"));
const CollectionsPage = lazy(() => import("./pages/CollectionsPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const Home = lazy(() => import("./pages/Home"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const OffersPage = lazy(() => import("./pages/OffersPage"));
const OrderConfirmationPage = lazy(() => import("./pages/OrderConfirmationPage"));
const ProductPage = lazy(() => import("./pages/ProductPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const TrackOrderPage = lazy(() => import("./pages/TrackOrderPage"));
const WishlistPage = lazy(() => import("./pages/WishlistPage"));

const CART_STORAGE_KEY = "avyonaCart";
const CART_STORAGE_VERSION_KEY = "avyonaCartVersion";
const CURRENT_CART_STORAGE_VERSION = "2";
const WISHLIST_STORAGE_KEY = "avyonaWishlist";
const AUTH_STORAGE_KEY = "avyonaAuthUser";
const ACCOUNT_STORAGE_KEY = "avyonaAccounts";
const CUSTOMER_PROFILE_KEY = "avyonaCustomerProfile";
const ORDER_STORAGE_KEY = "avyonaOrders";
const GENERAL_SETTINGS_FALLBACK = {
  ...DEFAULT_APP_SETTINGS.general,
  storeName: "Avyona",
  supportEmail: "support@avyona.com",
  supportPhone: "",
  logoUrl: "/uploads/settings/1778912520806-avyona-logo-2.png"
};

function resolveSettingsMediaUrl(value) {
  return resolveMediaUrl(value);
}

function normalizePublicSettingsPayload(payload = {}) {
  const settings = getPublicSettings(mergeSettings(DEFAULT_APP_SETTINGS, payload || {}));
  return {
    ...settings,
    general: {
      ...(settings.general || {}),
      logoUrl: resolveSettingsMediaUrl(settings.general?.logoUrl),
      faviconUrl: resolveSettingsMediaUrl(settings.general?.faviconUrl)
    },
    thankYouPage: {
      ...(settings.thankYouPage || {}),
      customIconUrl: resolveSettingsMediaUrl(settings.thankYouPage?.customIconUrl)
    }
  };
}

function normalizeGeneralSettingsPayload(payload = {}) {
  return {
    ...GENERAL_SETTINGS_FALLBACK,
    ...(payload || {}),
    logoUrl: resolveSettingsMediaUrl(payload?.logoUrl || GENERAL_SETTINGS_FALLBACK.logoUrl),
    faviconUrl: resolveSettingsMediaUrl(payload?.faviconUrl || "")
  };
}

function mergeGeneralIntoSiteSettings(siteSettings, generalPayload) {
  return {
    ...siteSettings,
    general: normalizeGeneralSettingsPayload(generalPayload)
  };
}

function mergeThemeIntoSiteSettings(siteSettings, themePayload) {
  return {
    ...siteSettings,
    theme: mergeSettings(DEFAULT_APP_SETTINGS.theme, themePayload || siteSettings.theme || {})
  };
}

function getThemeShadowValue(shadowStyle) {
  if (shadowStyle === "none") return "none";
  if (shadowStyle === "subtle") return "0 6px 16px rgba(15, 23, 42, 0.06)";
  if (shadowStyle === "elevated") return "0 18px 45px rgba(15, 23, 42, 0.14)";
  if (shadowStyle === "strong") return "0 26px 70px rgba(15, 23, 42, 0.22)";
  return "0 12px 30px rgba(15, 23, 42, 0.10)";
}

function getThemeCssVariables(themePayload = DEFAULT_APP_SETTINGS.theme) {
  const theme = mergeSettings(DEFAULT_APP_SETTINGS.theme, themePayload || {});
  const colors = theme.colors || DEFAULT_APP_SETTINGS.theme.colors;
  const typography = theme.typography || DEFAULT_APP_SETTINGS.theme.typography;
  const buttons = theme.buttons || DEFAULT_APP_SETTINGS.theme.buttons;
  const cards = theme.cards || DEFAULT_APP_SETTINGS.theme.cards;
  const layout = theme.layout || DEFAULT_APP_SETTINGS.theme.layout;
  const productCards = theme.productCards || DEFAULT_APP_SETTINGS.theme.productCards;
  const fontFamily = typography.fontFamily === "System Default"
    ? "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    : `${typography.fontFamily}, system-ui, sans-serif`;

  return {
    "--color-primary": colors.primaryColor,
    "--color-secondary": colors.secondaryColor,
    "--color-accent": colors.accentColor,
    "--color-background": colors.backgroundColor,
    "--color-surface": colors.surfaceColor,
    "--color-text": colors.textColor,
    "--color-muted": colors.mutedTextColor,
    "--color-border": colors.borderColor,
    "--color-success": colors.successColor,
    "--color-error": colors.errorColor,
    "--header-background": colors.surfaceColor,
    "--header-text": colors.textColor,
    "--footer-background": colors.secondaryColor,
    "--footer-text": buttons.primaryTextColor,
    "--font-family-base": fontFamily,
    "--base-font-size": `${typography.baseFontSize}px`,
    "--heading-font-weight": typography.headingFontWeight,
    "--body-font-weight": typography.bodyFontWeight,
    "--theme-line-height": typography.lineHeight,
    "--theme-letter-spacing": `${typography.letterSpacing || 0}px`,
    "--button-radius": `${buttons.borderRadius}px`,
    "--button-height": `${buttons.height}px`,
    "--button-font-weight": buttons.fontWeight,
    "--button-primary-bg": buttons.primaryBackground,
    "--button-primary-text": buttons.primaryTextColor,
    "--button-secondary-bg": buttons.secondaryBackground,
    "--button-secondary-text": buttons.secondaryTextColor,
    "--button-hover-bg": colors.accentColor,
    "--card-radius": `${cards.borderRadius}px`,
    "--card-padding": `${cards.padding}px`,
    "--card-background": cards.background,
    "--card-border": cards.borderColor,
    "--card-shadow": getThemeShadowValue(cards.shadowStyle),
    "--section-padding": `${layout.sectionPaddingDesktop}px`,
    "--section-padding-mobile": `${layout.sectionPaddingMobile}px`,
    "--section-gap": `${layout.sectionGap}px`,
    "--container-width": `${layout.websiteMaxWidth}px`,
    "--container-radius": `${layout.containerRadius}px`,
    "--product-card-radius": `${productCards.borderRadius}px`,
    "--product-card-shadow": getThemeShadowValue(productCards.shadowStyle),
    "--product-image-ratio": productCards.imageRatio.replace(":", " / "),
    "--product-price-color": productCards.priceColor,
    "--product-mrp-color": productCards.mrpColor,
    "--product-badge-bg": colors.errorColor,
    "--product-badge-text": buttons.primaryTextColor,
    "--product-title-lines": productCards.titleLines,
    "--bg": "var(--color-background)",
    "--surface": "var(--color-surface)",
    "--text": "var(--color-text)",
    "--muted": "var(--color-muted)",
    "--line": "var(--color-border)",
    "--brand": "var(--color-primary)",
    "--brand-dark": "var(--color-accent)",
    "--brand-soft": "var(--color-background)",
    "--shadow": getThemeShadowValue(cards.shadowStyle),
    "--radius-xl": `${layout.containerRadius}px`,
    "--radius-lg": `${cards.borderRadius}px`,
    "--radius-md": `${Math.max(8, Math.round(Number(cards.borderRadius || 12) * 0.75))}px`
  };
}

function getScopedCustomCss(themePayload = {}) {
  const customCss = String(themePayload?.customCss?.css || "").trim();
  if (!customCss || !/\.avyona-theme[\s.#:[,{>+~]/i.test(`${customCss} `)) return "";
  if (customCss.length > 10000) return "";
  if (/<\/?\s*script\b/i.test(customCss)) return "";
  if (/<\/?\s*[a-z][^>]*>/i.test(customCss)) return "";
  if (/\bjavascript\s*:/i.test(customCss)) return "";
  if (/@import\b/i.test(customCss)) return "";
  if (/\bexpression\s*\(/i.test(customCss)) return "";
  if (/\biframe\b/i.test(customCss)) return "";
  if (/\bonerror\s*=/i.test(customCss) || /\bonclick\s*=/i.test(customCss)) return "";
  if (/url\(\s*['"]?\s*https?:\/\//i.test(customCss)) return "";
  if (!/[{}]/.test(customCss)) return "";
  return customCss;
}
const PUBLIC_DATA_REFRESH_MS = 5 * 60 * 1000;

function normalizeBackendProduct(product) {
  const price = Number(product.price || 0);
  const mrp = Number(product.mrp || price || 0);
  const stockQuantity = Number(product.stockQuantity || 0);
  const discount = mrp > price && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const collectionSlug = product.categorySlug || String(product.categoryName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const gallery = resolveMediaList(product.galleryUrls);
  const primaryImage = gallery[0] || resolveMediaUrl(product.imageUrl);

  return {
    id: product.id,
    asin: product.asin,
    sku: product.asin,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.categoryName || "Products",
    collectionSlug,
    price,
    mrp,
    discount,
    image: primaryImage,
    gallery,
    highlights: [product.shortDescription || "New Avyona product"].filter(Boolean),
    description: product.description ? String(product.description).split(/\n+/).filter(Boolean) : [product.shortDescription || "Product details will be updated soon."],
    rating: Number(product.rating || 0),
    reviewCount: Number(product.reviewCount || 0),
    availableStock: stockQuantity,
    stockTone: stockQuantity > 0 ? "in-stock" : "out-of-stock",
    stockNote: stockQuantity > 0 ? "Available for dispatch" : "Out of stock",
    variantGroupId: product.variantGroupId || "",
    variantGroupName: product.variantGroupName || "",
    variantType: product.variantType || "",
    variantValue: product.variantValue || product.name,
    variants: [],
    specGroups: [],
    reviews: [],
    faqs: [],
    warrantySummary: "",
    returnSummary: ""
  };
}

function getCartItemKey(item) {
  return `${String(item.slug || item.asin || "").trim()}::${String(item.variantLabel || "").trim()}`;
}

function migrateStoredCart(value) {
  if (typeof window === "undefined") return [];
  const storedVersion = window.localStorage.getItem(CART_STORAGE_VERSION_KEY);
  if (storedVersion !== CURRENT_CART_STORAGE_VERSION) {
    window.localStorage.removeItem(CART_STORAGE_KEY);
    window.localStorage.setItem(CART_STORAGE_VERSION_KEY, CURRENT_CART_STORAGE_VERSION);
    return [];
  }
  return Array.isArray(value) ? value : [];
}

function getProductForCartItem(item, products = []) {
  return products.find((product) =>
    (item.slug && product.slug === item.slug) ||
    (item.asin && product.asin === item.asin)
  ) || null;
}

function getVariantForCartItem(product, item) {
  if (!product || !Array.isArray(product.variants)) return null;
  const variantLabel = String(item.variantLabel || "");
  return product.variants.find((variant) => String(variant.label || "") === variantLabel) || product.variants[0] || null;
}

function getAvailableStockForCartItem(item, products = []) {
  const product = getProductForCartItem(item, products);
  if (!product) return 0;
  const variant = getVariantForCartItem(product, item);
  return Math.max(0, Number(variant?.availableStock ?? product.availableStock ?? 0));
}

function normalizeCartItems(items = [], products = []) {
  const hasCatalog = Array.isArray(products) && products.length > 0;
  const normalized = [];
  const seen = new Set();

  (Array.isArray(items) ? items : []).forEach((item) => {
    const key = getCartItemKey(item);
    if (!key.trim() || key === "::" || seen.has(key)) return;

    const product = getProductForCartItem(item, products);
    if (hasCatalog && !product) return;

    const variant = getVariantForCartItem(product, item);
    const availableStock = product ? getAvailableStockForCartItem(item, products) : Math.max(0, Number(item.availableStock || item.quantity || 0));
    if (availableStock <= 0) return;

    const quantity = Math.min(availableStock, Math.max(1, Math.floor(Number(item.quantity || 1))));
    normalized.push({
      ...item,
      asin: product?.asin || item.asin,
      slug: product?.slug || item.slug,
      name: product?.name || item.name,
      category: product?.category || item.category,
      price: variant?.price ?? product?.price ?? item.price,
      image: variant?.image || product?.image || item.image,
      variantLabel: variant?.label ?? item.variantLabel ?? "",
      availableStock,
      quantity
    });
    seen.add(key);
  });

  return normalized;
}

function mergeCartItems(accountItems = [], guestItems = []) {
  const merged = new Map();

  [...accountItems, ...guestItems].forEach((item) => {
    const key = getCartItemKey(item);
    if (!key.trim() || key === "::") return;
    const existing = merged.get(key);
    const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));

    if (existing) {
      merged.set(key, {
        ...existing,
        ...item,
        quantity: Math.min(99, Number(existing.quantity || 1) + quantity)
      });
      return;
    }

    merged.set(key, {
      ...item,
      quantity
    });
  });

  return [...merged.values()];
}

function mergeWishlistItems(accountItems = [], guestItems = []) {
  const merged = new Map();

  [...accountItems, ...guestItems].forEach((item) => {
    const key = getCartItemKey(item);
    if (!key.trim() || key === "::") return;
    if (!merged.has(key)) merged.set(key, item);
  });

  return [...merged.values()];
}

function App() {
  const location = useLocation();
  const [cart, setCart] = usePersistentState(CART_STORAGE_KEY, [], { migrate: migrateStoredCart });
  const [wishlist, setWishlist] = usePersistentState(WISHLIST_STORAGE_KEY, []);
  const [authUser, setAuthUser] = usePersistentState(AUTH_STORAGE_KEY, null, { removeWhenNull: true });
  const [accounts, setAccounts] = usePersistentState(ACCOUNT_STORAGE_KEY, []);
  const [customerProfile, setCustomerProfile] = usePersistentState(CUSTOMER_PROFILE_KEY, {});
  const [orders, setOrders] = usePersistentState(ORDER_STORAGE_KEY, []);
  const [toasts, setToasts] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartAnimation, setCartAnimation] = useState(null);
  const [siteSettings, setSiteSettings] = useState(() => getPublicSettings(DEFAULT_APP_SETTINGS));
  const [siteCategories, setSiteCategories] = useState(fallbackCategoryTree);
  const [storefrontProducts, setStorefrontProducts] = useState([]);
  const [storefrontCoupons, setStorefrontCoupons] = useState(couponRules);
  const [isProductCatalogLoading, setIsProductCatalogLoading] = useState(true);
  const [isCategoryCatalogLoading, setIsCategoryCatalogLoading] = useState(true);
  const [hasLoadedCustomerSession, setHasLoadedCustomerSession] = useState(false);
  const [hasHydratedCustomerData, setHasHydratedCustomerData] = useState(false);
  const customerHydrationInFlightRef = useRef(false);
  const abandonedCartKeyRef = useRef("");

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search]);

  useEffect(() => {
    let isMounted = true;

    async function loadCustomerSession() {
      if (!getCustomerToken()) {
        setHasLoadedCustomerSession(true);
        setHasHydratedCustomerData(true);
        return;
      }

      try {
        const response = await fetchCurrentCustomer();
        if (!isMounted) return;
        const customer = response.data?.customer;
        if (customer) {
          setAuthUser({ id: customer.id, fullName: customer.fullName, email: customer.email, mobile: customer.mobile });
          setCustomerProfile({
            firstName: customer.firstName,
            lastName: customer.lastName,
            contact: customer.email,
            phone: customer.mobile
          });
        }
      } catch {
        clearCustomerToken();
        if (isMounted) setAuthUser(null);
      } finally {
        if (isMounted) setHasLoadedCustomerSession(true);
      }
    }

    loadCustomerSession();

    return () => {
      isMounted = false;
    };
  }, [setAuthUser, setCustomerProfile]);

  useEffect(() => {
    if (!hasLoadedCustomerSession || !authUser || hasHydratedCustomerData || customerHydrationInFlightRef.current) return undefined;
    let isMounted = true;
    customerHydrationInFlightRef.current = true;

    async function hydrateCustomerData() {
      try {
        const [cartResult, wishlistResult, ordersResult] = await Promise.allSettled([
          fetchCustomerCart(),
          fetchCustomerWishlist(),
          fetchCustomerOrders()
        ]);

        if (!isMounted) return;

        if (cartResult.status === "fulfilled") {
          const dbCart = Array.isArray(cartResult.value.data) ? cartResult.value.data : [];
          const mergedCart = mergeCartItems(dbCart, cart);
          setCart(mergedCart);
          if (mergedCart.length) await syncCustomerCart(mergedCart).catch(() => {});
        }

        if (wishlistResult.status === "fulfilled") {
          const dbWishlist = Array.isArray(wishlistResult.value.data) ? wishlistResult.value.data : [];
          const mergedWishlist = mergeWishlistItems(dbWishlist, wishlist);
          setWishlist(mergedWishlist);
          if (mergedWishlist.length) await syncCustomerWishlist(mergedWishlist).catch(() => {});
        }

        if (ordersResult.status === "fulfilled") {
          const dbOrders = Array.isArray(ordersResult.value.data) ? ordersResult.value.data : [];
          if (dbOrders.length) setOrders(dbOrders);
        }
      } finally {
        customerHydrationInFlightRef.current = false;
        if (isMounted) setHasHydratedCustomerData(true);
      }
    }

    hydrateCustomerData();

    return () => {
      isMounted = false;
    };
  }, [authUser, cart, hasHydratedCustomerData, hasLoadedCustomerSession, setCart, setOrders, setWishlist, wishlist]);

  useEffect(() => {
    if (!authUser || !hasHydratedCustomerData) return undefined;
    const timerId = window.setTimeout(() => {
      syncCustomerCart(cart).catch(() => {});
    }, 300);
    return () => window.clearTimeout(timerId);
  }, [authUser, cart, hasHydratedCustomerData]);

  useEffect(() => {
    if (!authUser || !hasHydratedCustomerData) return undefined;
    const timerId = window.setTimeout(() => {
      syncCustomerWishlist(wishlist).catch(() => {});
    }, 300);
    return () => window.clearTimeout(timerId);
  }, [authUser, hasHydratedCustomerData, wishlist]);

  useEffect(() => {
    if (!cartAnimation) return undefined;

    const activateTimer = window.setTimeout(() => {
      setCartAnimation((current) => (current ? { ...current, active: true } : current));
    }, 20);
    const cleanupTimer = window.setTimeout(() => {
      setCartAnimation(null);
    }, 1500);

    return () => {
      window.clearTimeout(activateTimer);
      window.clearTimeout(cleanupTimer);
    };
  }, [cartAnimation]);

  useEffect(() => {
    let isMounted = true;

    async function loadPublicSettings() {
      const [settingsResult, generalResult, themeResult] = await Promise.allSettled([
        fetchPublicSettings(),
        fetchGeneralSettings(),
        fetchPublicThemeSettings()
      ]);

      if (!isMounted) return;

      if (settingsResult.status === "fulfilled") {
        const settingsWithGeneral = mergeGeneralIntoSiteSettings(
          normalizePublicSettingsPayload(settingsResult.value.data || {}),
          generalResult.status === "fulfilled"
            ? (generalResult.value.data?.data || generalResult.value.data || {})
            : GENERAL_SETTINGS_FALLBACK
        );
        setSiteSettings(mergeThemeIntoSiteSettings(
          settingsWithGeneral,
          themeResult.status === "fulfilled"
            ? (themeResult.value.data?.data || themeResult.value.data || {})
            : DEFAULT_APP_SETTINGS.theme
        ));
      } else {
        setSiteSettings(mergeThemeIntoSiteSettings(
          mergeGeneralIntoSiteSettings(
            normalizePublicSettingsPayload(DEFAULT_APP_SETTINGS),
            GENERAL_SETTINGS_FALLBACK
          ),
          DEFAULT_APP_SETTINGS.theme
        ));
      }
    }

    loadPublicSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const general = siteSettings.general || {};
    const storeName = general.storeName || "Avyona";

    document.title = `${storeName} | Premium Electronics for Everyday Life`;

    if (general.faviconUrl) {
      let favicon = document.querySelector("link[rel='icon']");
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        document.head.appendChild(favicon);
      }
      favicon.href = general.faviconUrl;
    }
  }, [siteSettings.general]);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      setIsProductCatalogLoading(true);
      try {
        const response = await fetchStorefrontProducts({ status: "active", limit: 36 });
        if (!isMounted) return;
        const rows = Array.isArray(response.data) ? response.data : [];
        setStorefrontProducts(rows.map(normalizeBackendProduct));
      } catch {
        if (isMounted) setStorefrontProducts([]);
      } finally {
        if (isMounted) setIsProductCatalogLoading(false);
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isProductCatalogLoading) return;
    if (storefrontProducts.length) {
      setCart((current) => {
        const normalized = normalizeCartItems(current, storefrontProducts);
        return JSON.stringify(normalized) === JSON.stringify(current) ? current : normalized;
      });
      return;
    }
    if (cart.length) setCart([]);
    if (wishlist.length) setWishlist([]);
  }, [cart.length, isProductCatalogLoading, setCart, setWishlist, storefrontProducts.length, wishlist.length]);

  useEffect(() => {
    let isMounted = true;

    async function loadCoupons() {
      try {
        const response = await fetchStorefrontCoupons({ status: "active" });
        if (!isMounted) return;
        const rows = Array.isArray(response.data) ? response.data : [];
        setStorefrontCoupons(rows.length ? rows : couponRules);
      } catch {
        if (isMounted) setStorefrontCoupons(couponRules);
      }
    }

    loadCoupons();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let isRefreshing = false;

    async function refreshPublicData() {
      if (isRefreshing) return;
      isRefreshing = true;

      const [settingsResult, generalResult, themeResult, productsResult, categoriesResult, couponsResult] = await Promise.allSettled([
        fetchPublicSettings(),
        fetchGeneralSettings(),
        fetchPublicThemeSettings(),
        fetchStorefrontProducts({ status: "active", limit: 36 }),
        fetchCategoryTree(),
        fetchStorefrontCoupons({ status: "active" })
      ]);

      if (!isMounted) return;

      if (settingsResult.status === "fulfilled") {
        const settingsWithGeneral = mergeGeneralIntoSiteSettings(
          normalizePublicSettingsPayload(settingsResult.value.data || {}),
          generalResult.status === "fulfilled"
            ? (generalResult.value.data?.data || generalResult.value.data || {})
            : GENERAL_SETTINGS_FALLBACK
        );
        setSiteSettings(mergeThemeIntoSiteSettings(
          settingsWithGeneral,
          themeResult.status === "fulfilled"
            ? (themeResult.value.data?.data || themeResult.value.data || {})
            : DEFAULT_APP_SETTINGS.theme
        ));
      }

      if (productsResult.status === "fulfilled") {
        const rows = Array.isArray(productsResult.value.data) ? productsResult.value.data : [];
        setStorefrontProducts(rows.map(normalizeBackendProduct));
      }

      if (categoriesResult.status === "fulfilled") {
        const rows = categoriesResult.value.data;
        if (Array.isArray(rows) && rows.length) setSiteCategories(rows);
      }

      if (couponsResult.status === "fulfilled") {
        const rows = Array.isArray(couponsResult.value.data) ? couponsResult.value.data : [];
        setStorefrontCoupons(rows.length ? rows : couponRules);
      }

      isRefreshing = false;
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        refreshPublicData();
      }
    }

    const intervalId = window.setInterval(refreshPublicData, PUBLIC_DATA_REFRESH_MS);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      setIsCategoryCatalogLoading(true);
      try {
        const response = await fetchCategoryTree();
        if (!isMounted) return;
        setSiteCategories(Array.isArray(response.data) && response.data.length ? response.data : fallbackCategoryTree);
      } catch {
        if (isMounted) {
          setSiteCategories(fallbackCategoryTree);
        }
      } finally {
        if (isMounted) {
          setIsCategoryCatalogLoading(false);
        }
      }
    }

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  const notify = (message, options = {}) => {
    const id = Date.now() + Math.random();
    const toast = typeof message === "object"
      ? { id, ...message }
      : { id, message, ...options };
    setToasts((current) => [...current, toast]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, toast.duration || 2200);
  };

  const addToCart = (product, variant, quantity = 1, triggerElement = null) => {
    const safeVariant = variant || product.variants?.[0];
    const availableStock = Math.max(0, Number(safeVariant?.availableStock ?? product.availableStock ?? 0));
    if (availableStock <= 0) {
      notify("This product is currently out of stock.");
      return;
    }
    const requestedQuantity = Math.max(1, Math.floor(Number(quantity || 1)));
    setCart((current) => {
      const index = current.findIndex(
        (item) => item.slug === product.slug && String(item.variantLabel || "") === String(safeVariant?.label || "")
      );
      if (index >= 0) {
        const next = [...current];
        next[index] = {
          ...next[index],
          availableStock,
          quantity: Math.min(Number(next[index].quantity || 0) + requestedQuantity, availableStock)
        };
        return next;
      }
      return [
        ...current,
        {
          slug: product.slug,
          asin: product.asin,
          name: product.name,
          category: product.category,
          price: safeVariant?.price ?? product.price,
          quantity: Math.min(requestedQuantity, availableStock),
          image: safeVariant?.image || product.image,
          variantLabel: safeVariant?.label || "",
          availableStock
        }
      ];
    });

    const cartButton = typeof document !== "undefined"
      ? document.querySelector("[data-cart-target='true']")
      : null;
    const animationImage = safeVariant?.image || product.image || "";
    if (cartButton && animationImage) {
      const triggerRect = triggerElement?.getBoundingClientRect?.();
      const cartRect = cartButton.getBoundingClientRect();
      const startSize = triggerRect ? Math.max(82, Math.min(132, triggerRect.height + 54)) : 108;
      const endSize = 12;

      setCartAnimation({
        key: `${product.slug}-${Date.now()}`,
        image: animationImage,
        active: false,
        startX: triggerRect ? (triggerRect.left + (triggerRect.width / 2) - (startSize / 2)) : ((window.innerWidth / 2) - (startSize / 2)),
        startY: triggerRect ? (triggerRect.top + (triggerRect.height / 2) - (startSize / 2)) : ((window.innerHeight / 2) - (startSize / 2)),
        endX: cartRect.left + (cartRect.width / 2) - (endSize / 2),
        endY: cartRect.top + (cartRect.height / 2) - (endSize / 2),
        startSize,
        endSize
      });
    }

    notify("Added to cart");
    trackAnalyticsEvent({
      eventType: "add_to_cart",
      productAsin: product.asin,
      productSlug: product.slug,
      quantity: requestedQuantity,
      cartValue: Number((safeVariant?.price ?? product.price) || 0) * requestedQuantity,
      metadata: {
        productName: product.name,
        variantLabel: safeVariant?.label || ""
      }
    });
  };

  const updateCartQuantity = (slug, variantLabel, quantity) => {
    setCart((current) =>
      current
        .map((item) => {
          if (item.slug !== slug || String(item.variantLabel || "") !== String(variantLabel || "")) return item;
          const availableStock = getAvailableStockForCartItem(item, storefrontProducts) || Math.max(0, Number(item.availableStock || 0));
          if (availableStock <= 0) return { ...item, quantity: 0, availableStock: 0 };
          return {
            ...item,
            availableStock,
            quantity: Math.min(availableStock, Math.max(1, Math.floor(Number(quantity || 1))))
          };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeCartItem = (slug, variantLabel) => {
    const removedItem = cart.find(
      (item) => item.slug === slug && String(item.variantLabel || "") === String(variantLabel || "")
    );
    setCart((current) =>
      current.filter(
        (item) => !(item.slug === slug && String(item.variantLabel || "") === String(variantLabel || ""))
      )
    );
    if (removedItem) {
      trackAnalyticsEvent({
        eventType: "remove_from_cart",
        productAsin: removedItem.asin,
        productSlug: removedItem.slug,
        quantity: removedItem.quantity,
        cartValue: Number(removedItem.price || 0) * Number(removedItem.quantity || 1),
        metadata: {
          productName: removedItem.name,
          variantLabel: removedItem.variantLabel || ""
        }
      });
    }
  };

  useEffect(() => {
    if (!cart.length) {
      abandonedCartKeyRef.current = "";
      return undefined;
    }

    const cartValue = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
    const itemCount = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
    const cartKey = cart
      .map((item) => `${item.slug || item.asin || "item"}:${item.variantLabel || ""}:${item.quantity || 1}`)
      .sort()
      .join("|");

    const sendAbandonedCart = () => {
      if (location.pathname.startsWith("/checkout") || location.pathname.startsWith("/order-confirmation")) return;
      if (abandonedCartKeyRef.current === cartKey) return;
      abandonedCartKeyRef.current = cartKey;
      trackAnalyticsEvent({
        eventType: "abandoned_cart",
        cartValue,
        metadata: {
          itemCount,
          path: `${location.pathname}${location.search || ""}`
        }
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") sendAbandonedCart();
    };

    window.addEventListener("pagehide", sendAbandonedCart);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", sendAbandonedCart);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [cart, location.pathname, location.search]);

  const toggleWishlist = (product, variant) => {
    const variantLabel = variant?.label || "";
    const exists = wishlist.some(
      (item) => item.slug === product.slug && String(item.variantLabel || "") === String(variantLabel)
    );
    if (exists) {
      setWishlist((current) =>
        current.filter(
          (item) => !(item.slug === product.slug && String(item.variantLabel || "") === String(variantLabel))
        )
      );
      notify("Removed from wishlist");
      return;
    }
    setWishlist((current) => [
      ...current,
      {
        asin: product.asin,
        slug: product.slug,
        name: product.name,
        category: product.category,
        price: variant?.price ?? product.price,
        image: variant?.image || product.image,
        variantLabel
      }
    ]);
    notify("Saved to wishlist");
    trackAnalyticsEvent({
      eventType: "wishlist_add",
      productAsin: product.asin,
      productSlug: product.slug,
      cartValue: Number((variant?.price ?? product.price) || 0),
      metadata: {
        productName: product.name,
        variantLabel
      }
    });
  };

  const context = {
    cart,
    wishlist,
    authUser,
    accounts,
    customerProfile,
    orders,
    notify,
    isCartOpen,
    setIsCartOpen,
    addToCart,
    updateCartQuantity,
    removeCartItem,
    toggleWishlist,
    setCart,
    setWishlist,
    setAuthUser: (nextUser) => {
      setHasHydratedCustomerData(false);
      if (!nextUser) {
        clearCustomerToken();
      }
      setAuthUser(nextUser);
    },
    setAccounts,
    setCustomerProfile,
    setOrders,
    siteSettings,
    siteCategories,
    coupons: storefrontCoupons,
    isProductCatalogLoading,
    isCategoryCatalogLoading,
    allProducts: storefrontProducts
  };
  const themeCssVariables = getThemeCssVariables(siteSettings.theme);
  const scopedCustomCss = getScopedCustomCss(siteSettings.theme);

  return (
    <div className="app-shell avyona-theme" style={themeCssVariables}>
      {scopedCustomCss ? <style>{scopedCustomCss}</style> : null}
      <SeoManager siteSettings={siteSettings} />
      <Suspense fallback={<div className="route-loading">Loading...</div>}>
        <Routes>
          <Route
            path="/"
            element={
              <StoreLayout context={context} allProducts={storefrontProducts}>
                <Home context={context} />
              </StoreLayout>
            }
          />
          <Route path="/blogs" element={<StoreLayout context={context} allProducts={storefrontProducts}><BlogsPage /></StoreLayout>} />
          <Route path="/blogs/:slug" element={<StoreLayout context={context} allProducts={storefrontProducts}><BlogPage /></StoreLayout>} />
          <Route path="/blog/:slug" element={<StoreLayout context={context} allProducts={storefrontProducts}><BlogPage /></StoreLayout>} />
          <Route path="/collections" element={<StoreLayout context={context} allProducts={storefrontProducts}><CollectionsPage context={context} /></StoreLayout>} />
          <Route path="/category/:slug" element={<StoreLayout context={context} allProducts={storefrontProducts}><CollectionPage context={context} /></StoreLayout>} />
          <Route path="/collection/:slug" element={<StoreLayout context={context} allProducts={storefrontProducts}><CollectionPage context={context} /></StoreLayout>} />
          <Route path="/search" element={<StoreLayout context={context} allProducts={storefrontProducts}><SearchPage context={context} /></StoreLayout>} />
          <Route path="/offers" element={<StoreLayout context={context} allProducts={storefrontProducts}><OffersPage context={context} /></StoreLayout>} />
          <Route path="/contact-us" element={<StoreLayout context={context} allProducts={storefrontProducts}><ContactPage context={context} /></StoreLayout>} />
          <Route path="/contact" element={<Navigate to="/contact-us" replace />} />
          <Route path="/wishlist" element={<StoreLayout context={context} allProducts={storefrontProducts}><WishlistPage context={context} /></StoreLayout>} />
          <Route path="/track-order" element={<StoreLayout context={context} allProducts={storefrontProducts}><TrackOrderPage context={context} /></StoreLayout>} />
          <Route path="/product/:slug/:variantKey" element={<StoreLayout context={context} allProducts={storefrontProducts}><ProductPage context={context} /></StoreLayout>} />
          <Route path="/product/:slug" element={<StoreLayout context={context} allProducts={storefrontProducts}><ProductPage context={context} /></StoreLayout>} />
          <Route path="/account" element={<AccountPage context={context} />} />
          <Route path="/profile" element={<ProtectedRoute allow={Boolean(authUser)}><ProfilePage context={context} /></ProtectedRoute>} />
          <Route path="/checkout" element={<CheckoutPage context={context} />} />
          <Route path="/order-confirmation/:orderNumber" element={<StoreLayout context={context} allProducts={storefrontProducts}><OrderConfirmationPage context={context} /></StoreLayout>} />
          <Route path="*" element={<StoreLayout context={context} allProducts={storefrontProducts}><NotFoundPage /></StoreLayout>} />
        </Routes>
      </Suspense>
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-chip ${toast.variant ? `toast-chip-${toast.variant}` : ""}`}>
            {toast.variant === "success" ? <span className="toast-icon" aria-hidden="true">✓</span> : null}
            <div>
              {toast.title ? <strong>{toast.title}</strong> : null}
              <span>{toast.message}</span>
            </div>
          </div>
        ))}
      </div>
      {cartAnimation ? (
        <div
          key={cartAnimation.key}
          className={`cart-fly-image ${cartAnimation.active ? "is-active" : ""}`}
          aria-hidden="true"
          style={{
            left: `${cartAnimation.active ? cartAnimation.endX : cartAnimation.startX}px`,
            top: `${cartAnimation.active ? cartAnimation.endY : cartAnimation.startY}px`,
            width: `${cartAnimation.active ? cartAnimation.endSize : cartAnimation.startSize}px`,
            height: `${cartAnimation.active ? cartAnimation.endSize : cartAnimation.startSize}px`,
            transform: `rotate(${cartAnimation.active ? 6 : 0}deg) scale(${cartAnimation.active ? 0.18 : 1})`,
            opacity: cartAnimation.active ? 0 : 1
          }}
        >
          <img src={cartAnimation.image} alt="" />
        </div>
      ) : null}
    </div>
  );
}

export default App;
