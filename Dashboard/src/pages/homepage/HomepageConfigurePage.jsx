import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { createWhyShopItem, deleteWhyShopItem, fetchAdminSettings, fetchBrowseCategoriesSettings, fetchCategories, fetchHomepageSectionSettings, fetchProductPaymentIconsHomepage, fetchProducts, fetchWhyShopHomepage, reorderWhyShopItems, saveProductPaymentIconsHomepage, updateAdminSettings, updateBrowseCategoriesSettings, updateCategory, updateHomepageSectionSettings, updateWhyShopItem, updateWhyShopItemStatus, updateWhyShopSettings, uploadAdminImage, uploadAdminMedia, uploadPaymentIcon, uploadWhyShopIcon } from "../../api/adminApi";
import { resolveAdminMediaUrl, toStoredUploadUrl } from "../../utils/media";
import { compressImageFile, getStorefrontBaseUrl } from "../../utils/storefront";
import { fallbackCategoryTree, flattenCategoryTree } from "../../data/category-data";
import { allProducts } from "../../data/storefront-content";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { cloneSettings, DEFAULT_APP_SETTINGS, mergeSettings } from "../../../../shared/appSettings";
import { REVIEW_TYPE_OPTIONS, REVIEW_VISIBILITY_STATUS_OPTIONS } from "../../../../shared/reviewTypes";

export const homepageConfigureSections = {
  "hero-banner": {
    title: "Hero Banner",
    description: "Configure the main homepage banner, media, headline, subtitle, and call-to-action."
  },
  "browse-categories": {
    title: "Browse Categories",
    description: "Configure the category cards and ordering for the homepage Browse section."
  },
  "our-products": {
    title: "Our Products",
    description: "Configure the primary product section shown on the homepage."
  },
  "best-sellers": {
    title: "Best Sellers & Trending",
    description: "Configure best-selling and trending products for homepage placement."
  },
  "new-arrivals": {
    title: "New Arrivals",
    description: "Configure latest product highlights and new arrival ordering."
  },
  "featured-brands": {
    title: "Featured Brands",
    description: "Configure brand logo cards and featured brand ordering."
  },
  "why-shop": {
    title: "Why Shop With Avyona",
    description: "Manage homepage trust badges with icons and text."
  },
  "product-payment-icons": {
    title: "Product Payment Icons",
    description: "Manage payment icons shown on product detail pages."
  },
  newsletter: {
    title: "Newsletter",
    description: "Configure the homepage newsletter signup block."
  },
  "blog-posts": {
    title: "Blog Posts",
    description: "Configure the homepage blog preview section layout and ordering."
  },
  reviews: {
    title: "Reviews",
    description: "Configure customer reviews and testimonials shown on the homepage."
  }
};

const PAGE_LINK_OPTIONS = [
  { label: "Home", value: "/" },
  { label: "All Collections", value: "/collections" },
  { label: "Offers", value: "/offers" },
  { label: "Contact Us", value: "/contact" },
  { label: "Track Order", value: "/track-order" },
  { label: "Wishlist", value: "/wishlist" },
  { label: "Search", value: "/search" },
  { label: "Personal Audio", value: "/category/personal-audio" },
  { label: "Professional Audio", value: "/category/professional-audio" },
  { label: "Digital Camera", value: "/category/digital-camera" },
  { label: "Security Camera", value: "/category/security-camera" },
  { label: "Digital Photo Frames", value: "/category/digital-photo-frames" },
  { label: "Reading Light", value: "/category/reading-light" }
];

const HERO_FONT_FAMILIES = [
  "Montserrat",
  "Poppins",
  "Inter",
  "Roboto",
  "Open Sans",
  "Playfair Display",
  "Cormorant Garamond",
  "Libre Baskerville",
  "Cinzel",
  "DM Serif Display",
  "Bebas Neue",
  "Oswald",
  "Anton",
  "League Spartan",
  "Archivo Black",
  "Raleway",
  "Lato",
  "Nunito",
  "Work Sans",
  "Quicksand"
];

const ALLOWED_HERO_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_HERO_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;

function isSafeLink(value) {
  const link = String(value || "").trim();
  if (!link) return true;
  if (link.startsWith("/")) return true;
  return /^https?:\/\//i.test(link);
}

function validateHeroMediaFile(file, expectedMediaType = "image") {
  if (!file) return "Please select a file.";
  const isVideo = file.type.startsWith("video/");

  if (expectedMediaType === "image") {
    if (!ALLOWED_HERO_IMAGE_TYPES.has(file.type)) {
      return "Hero banner images must be JPG, PNG, or WebP.";
    }
    if (file.size > MAX_HERO_IMAGE_SIZE_BYTES) {
      return "Hero banner image is too large. Please upload an optimized image below 25 MB.";
    }
  }

  if (expectedMediaType === "video" && !isVideo) {
    return "Please upload a valid video file for this banner field.";
  }

  return "";
}

export default function HomepageConfigurePage({ sectionKey }) {
  const section = homepageConfigureSections[sectionKey] || homepageConfigureSections["hero-banner"];
  const [refreshToken, setRefreshToken] = React.useState(0);
  useAutoRefresh(() => setRefreshToken((current) => current + 1));
  const placeholderGroups = sectionKey === "reviews" ? reviewPlaceholderGroups : defaultPlaceholderGroups;

  if (sectionKey === "hero-banner") {
    return <HeroBannerConfigure section={section} refreshToken={refreshToken} />;
  }

  if (sectionKey === "browse-categories") {
    return <BrowseCategoriesConfigure section={section} refreshToken={refreshToken} />;
  }

  if (sectionKey === "our-products") {
    return <ProductArrangementConfigure section={section} settingsKey="ourProducts" sectionLabel="Our Products" refreshToken={refreshToken} />;
  }

  if (sectionKey === "best-sellers") {
    return <ProductArrangementConfigure section={section} settingsKey="bestSellerProducts" categorySettingsKey="bestSellerCategories" sectionLabel="Best Sellers & Trending" enableCategoryControls refreshToken={refreshToken} />;
  }

  if (sectionKey === "new-arrivals") {
    return <ProductArrangementConfigure section={section} settingsKey="newArrivalProducts" sectionLabel="New Arrivals" fallbackMode="arrivals" refreshToken={refreshToken} />;
  }

  if (sectionKey === "featured-brands") {
    return <FeaturedBrandsConfigure section={section} refreshToken={refreshToken} />;
  }

  if (sectionKey === "why-shop") {
    return <WhyShopConfigure section={section} refreshToken={refreshToken} />;
  }

  if (sectionKey === "product-payment-icons") {
    return <ProductPaymentIconsConfigure section={section} refreshToken={refreshToken} />;
  }

  if (sectionKey === "newsletter") {
    return <SimpleHomepageSectionConfigure section={section} routeKey="newsletter" settingsKey="newsletterSettings" sectionLabel="Newsletter" refreshToken={refreshToken} />;
  }

  if (sectionKey === "blog-posts") {
    return <SimpleHomepageSectionConfigure section={section} routeKey="blog-posts" settingsKey="blogPostsSettings" sectionLabel="Blog Posts" refreshToken={refreshToken} />;
  }

  return (
    <section className="dashboard-page-shell">
      <div style={heroStyle}>
        <span style={eyebrowStyle}>Homepage Configuration</span>
        <h2 style={titleStyle}>{section.title}</h2>
        <p style={copyStyle}>{section.description}</p>
      </div>

      <div style={panelStyle}>
        <div>
          <span style={eyebrowStyle}>Configure Section</span>
          <h3 style={panelTitleStyle}>{section.title} Settings</h3>
          <p style={panelCopyStyle}>
            This page is ready for section controls. Add content fields, product selectors, media uploads, and ordering tools here.
          </p>
        </div>

        {placeholderGroups.map((group) => (
          <div key={group.title} style={placeholderGroupStyle}>
            <h4 style={placeholderGroupTitleStyle}>{group.title}</h4>
            <div style={placeholderGridStyle}>
              {group.items.map((item) => (
                <div key={item.value || item.label} style={placeholderCardStyle}>
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                  {item.value ? <code style={placeholderCodeStyle}>{item.value}</code> : null}
                </div>
              ))}
            </div>
          </div>
        ))}

        <Link to="/dashboard/homepage" style={backButtonStyle}>Back to Homepage Sections</Link>
      </div>
    </section>
  );
}

const defaultPlaceholderGroups = [
  {
    title: "Section Controls",
    items: [
      {
        label: "Content",
        description: "Titles, subtitles, labels, and display text."
      },
      {
        label: "Media",
        description: "Images, banners, thumbnails, and brand visuals."
      },
      {
        label: "Visibility",
        description: "Enable, disable, sort, and schedule homepage placement."
      }
    ]
  }
];

const reviewPlaceholderGroups = [
  {
    title: "Review Types",
    items: REVIEW_TYPE_OPTIONS
  },
  {
    title: "Visibility Statuses",
    items: REVIEW_VISIBILITY_STATUS_OPTIONS
  }
];

function normalizeCategoryRow(category) {
  const dynamicRuleJson = parseDynamicRuleJson(category.dynamicRuleJson);

  return {
    ...category,
    dynamicRuleJson,
    name: category.name || category.categoryName || "",
    imageUrl: category.imageUrl || category.image || "",
    description: category.description || "",
    status: String(category.status || "active").toLowerCase(),
    featuredCategory: Boolean(category.featuredCategory ?? category.featured),
    sortOrder: Number(category.sortOrder || 0),
    productCount: Number(category.productCount ?? category.productSlugs?.length ?? 0),
    homepageButtonText: dynamicRuleJson.homepageButtonText || "Explore Now",
    homepageButtonLink: dynamicRuleJson.homepageButtonLink || `/category/${category.slug || ""}`
  };
}

function parseDynamicRuleJson(value) {
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

function getFallbackHomepageCategories() {
  return flattenCategoryTree(fallbackCategoryTree)
    .filter((category) => !category.parentId)
    .map(normalizeCategoryRow);
}

function getCategoryKey(category) {
  return String(category.id ?? category.slug ?? category.name ?? "");
}

function buildCategoryPayload(category) {
  const dynamicRuleJson = {
    ...(category.dynamicRuleJson || {}),
    homepageButtonText: String(category.homepageButtonText || "Explore Now").trim(),
    homepageButtonLink: String(category.homepageButtonLink || `/category/${category.slug}`).trim()
  };

  return {
    name: category.name,
    slug: category.slug,
    parentId: category.parentId || null,
    imageUrl: category.imageUrl,
    bannerImageUrl: category.bannerImageUrl,
    description: category.description,
    status: category.status,
    showInMenu: Boolean(category.showInMenu),
    featuredCategory: Boolean(category.featuredCategory),
    dynamicRuleJson,
    sortOrder: Number(category.sortOrder || 0),
    metaTitle: category.metaTitle,
    metaDescription: category.metaDescription,
    keywords: category.keywords
  };
}

function createBrowseCategoryEntry(category, index) {
  const categoryKey = getCategoryKey(category);
  const homepageRule = category.dynamicRuleJson || {};

  return {
    id: `homepage-category-${categoryKey}`,
    categoryId: category.id ?? null,
    categorySlug: category.slug || "",
    status: String(category.status || "active").toLowerCase() === "inactive" ? "inactive" : "active",
    sortOrder: Number(category.sortOrder || index + 1),
    imageUrl: "",
    buttonText: homepageRule.homepageButtonText || "Explore Now",
    buttonLink: homepageRule.homepageButtonLink || `/category/${category.slug || ""}`
  };
}

function getBrowseEntryKey(entry) {
  return String(entry.categoryId ?? entry.categorySlug ?? entry.id ?? "");
}

function normalizeBrowseCategoryCardCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.min(10, Math.max(1, Math.floor(count))) : DEFAULT_APP_SETTINGS.homepage.browseCategoryCardCount;
}

function normalizeCardsPerRow(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.min(10, Math.max(1, Math.floor(count))) : DEFAULT_APP_SETTINGS.homepage.browseCategoriesSettings.cardsPerRow;
}

function normalizeMobileCardsPerRow(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.min(3, Math.max(1, Math.floor(count))) : DEFAULT_APP_SETTINGS.homepage.browseCategoriesSettings.mobileCardsPerRow;
}

const PRODUCT_BUTTON_DISPLAY_TYPE_OPTIONS = [
  { value: "view_product", label: "View Product Only" },
  { value: "add_to_cart", label: "Add to Cart Only" },
  { value: "both", label: "Both Buttons" },
  { value: "none", label: "No Button" }
];

function normalizeProductButtonDisplayType(value, fallback = "both") {
  return PRODUCT_BUTTON_DISPLAY_TYPE_OPTIONS.some((option) => option.value === value) ? value : fallback;
}

function normalizeBrowseCategoriesSettings(value = {}) {
  return {
    ...DEFAULT_APP_SETTINGS.homepage.browseCategoriesSettings,
    ...(value || {}),
    enabled: value.enabled !== false,
    title: String(value.title || DEFAULT_APP_SETTINGS.homepage.browseCategoriesSettings.title).trim(),
    subtitle: String(value.subtitle || "").trim(),
    cardsPerRow: normalizeCardsPerRow(value.cardsPerRow),
    mobileCardsPerRow: normalizeMobileCardsPerRow(value.mobileCardsPerRow)
  };
}

const homepageSectionConfigBySettingsKey = {
  ourProducts: {
    routeKey: "our-products",
    settingsKey: "ourProductsSettings"
  },
  bestSellerProducts: {
    routeKey: "best-sellers",
    settingsKey: "bestSellerProductsSettings"
  },
  newArrivalProducts: {
    routeKey: "new-arrivals",
    settingsKey: "newArrivalProductsSettings"
  },
  featuredBrands: {
    routeKey: "featured-brands",
    settingsKey: "featuredBrandsSettings"
  },
  newsletter: {
    routeKey: "newsletter",
    settingsKey: "newsletterSettings"
  }
};

function normalizeHomepageSectionSettings(value = {}, fallback = DEFAULT_APP_SETTINGS.homepage.ourProductsSettings) {
  const shouldIncludeButtonDisplayType = Object.prototype.hasOwnProperty.call(fallback, "buttonDisplayType") || value.buttonDisplayType !== undefined;

  return {
    ...fallback,
    ...(value || {}),
    enabled: value.enabled !== false,
    title: String(value.title || fallback.title || "").trim(),
    subtitle: String(value.subtitle || "").trim(),
    cardsPerRow: normalizeCardsPerRow(value.cardsPerRow ?? fallback.cardsPerRow),
    mobileCardsPerRow: normalizeMobileCardsPerRow(value.mobileCardsPerRow ?? fallback.mobileCardsPerRow),
    ...(shouldIncludeButtonDisplayType ? { buttonDisplayType: normalizeProductButtonDisplayType(value.buttonDisplayType, fallback.buttonDisplayType || "both") } : {}),
    sortOrder: Number.isFinite(Number(value.sortOrder)) ? Math.floor(Number(value.sortOrder)) : fallback.sortOrder
  };
}

function getScopedCssValidationError(css = "", scopeSelector = ".avyona-product-payment-icons") {
  const value = String(css || "").trim();
  if (!value) return "";
  if (value.length > 10000) return "Custom CSS must be 10,000 characters or less.";
  if (/<\/?\s*script\b/i.test(value)) return "Script tags are not allowed in Custom CSS.";
  if (/<\/?\s*[a-z][^>]*>/i.test(value)) return "Only CSS is allowed in Custom CSS.";
  if (/\bjavascript\s*:/i.test(value)) return "javascript: URLs are not allowed in Custom CSS.";
  if (/@import\b/i.test(value)) return "@import is not allowed in Custom CSS.";
  if (/\biframe\b/i.test(value)) return "Iframe is not allowed in Custom CSS.";
  if (/\bonclick\s*=/i.test(value) || /\bonerror\s*=/i.test(value)) return "Inline event handlers are not allowed in Custom CSS.";
  if (!/[{}]/.test(value)) return "Custom CSS must include CSS selectors and declarations.";
  const escapedScope = scopeSelector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const scopePattern = new RegExp(`${escapedScope}[\\s.#:[,{>+~]`, "i");
  if (!scopePattern.test(`${value} `)) return `Custom CSS must be scoped under ${scopeSelector}.`;
  return "";
}

function normalizeBrowseCategoryEntries(settings, categories) {
  const configured = Array.isArray(settings.homepage?.browseCategories) ? settings.homepage.browseCategories : [];
  const fallbackEntries = categories
    .filter((category) => category.featuredCategory)
    .map(createBrowseCategoryEntry);
  const source = configured.length ? configured : fallbackEntries;

  return source
    .map((entry, index) => ({
      id: entry.id || `homepage-category-${entry.categoryId || entry.categorySlug || index}`,
      categoryId: entry.categoryId ?? null,
      categorySlug: entry.categorySlug || "",
      status: entry.showOnHomepage === false || String(entry.status || "active").toLowerCase() === "inactive" ? "inactive" : "active",
      showOnHomepage: entry.showOnHomepage !== false && String(entry.status || "active").toLowerCase() !== "inactive",
      sortOrder: Number(entry.sortOrder || index + 1),
      imageUrl: String(entry.imageUrl || "").trim(),
      buttonText: String(entry.buttonText || "Explore Now").trim(),
      buttonLink: String(entry.buttonLink || (entry.categorySlug ? `/category/${entry.categorySlug}` : "/collections")).trim()
    }))
    .filter((entry) => getBrowseEntryKey(entry))
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
}

function getCategoryForBrowseEntry(entry, categories) {
  const entryKey = getBrowseEntryKey(entry);
  return categories.find((category) =>
    String(category.id ?? "") === entryKey ||
    String(category.slug || "") === String(entry.categorySlug || "")
  ) || null;
}

function mergeBrowseCategoryEntry(entry, category) {
  return {
    ...category,
    homepageEntryId: entry.id,
    homepageSelected: true,
    homepageStatus: entry.status,
    homepageSortOrder: Number(entry.sortOrder || 0),
    homepageImageUrl: entry.imageUrl,
    homepageButtonText: entry.buttonText || "Explore Now",
    homepageButtonLink: entry.buttonLink || `/category/${category.slug || ""}`
  };
}

function BrowseCategoriesConfigure({ section, refreshToken = 0 }) {
  const [categories, setCategories] = React.useState(getFallbackHomepageCategories);
  const [settings, setSettings] = React.useState(() => cloneSettings(DEFAULT_APP_SETTINGS));
  const [browseSectionSettings, setBrowseSectionSettings] = React.useState(() => normalizeBrowseCategoriesSettings(DEFAULT_APP_SETTINGS.homepage.browseCategoriesSettings));
  const [browseEntries, setBrowseEntries] = React.useState([]);
  const [expandedCategoryId, setExpandedCategoryId] = React.useState("");
  const [selectedCategoryId, setSelectedCategoryId] = React.useState("");
  const [draggedCategoryId, setDraggedCategoryId] = React.useState("");
  const [uploadingCategoryId, setUploadingCategoryId] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isAutoSavingSort, setIsAutoSavingSort] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [messageTone, setMessageTone] = React.useState("success");

  React.useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      setIsLoading(true);

      try {
        const [categoryResponse, settingsResponse, browseSettingsResponse] = await Promise.all([
          fetchCategories(),
          fetchAdminSettings(),
          fetchBrowseCategoriesSettings()
        ]);
        if (!isMounted) return;

        const rows = Array.isArray(categoryResponse.data?.data) ? categoryResponse.data.data : [];
        const mainCategories = rows
          .filter((category) => !category.parentId)
          .map(normalizeCategoryRow)
          .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
        const mergedSettings = mergeSettings(DEFAULT_APP_SETTINGS, settingsResponse.data?.data || {});

        const nextCategories = mainCategories.length ? mainCategories : getFallbackHomepageCategories();
        const nextEntries = normalizeBrowseCategoryEntries(mergedSettings, nextCategories);
        const nextBrowseSettings = normalizeBrowseCategoriesSettings(browseSettingsResponse.data?.data || mergedSettings.homepage?.browseCategoriesSettings);
        setSettings(mergedSettings);
        setBrowseSectionSettings(nextBrowseSettings);
        setCategories(nextCategories);
        setBrowseEntries(nextEntries);
        setExpandedCategoryId("");
        setSelectedCategoryId("");
        setMessage("Homepage browse categories loaded from backend settings.");
        setMessageTone("success");
      } catch {
        if (!isMounted) return;
        const nextCategories = getFallbackHomepageCategories();
        const fallbackSettings = cloneSettings(DEFAULT_APP_SETTINGS);
        const nextEntries = normalizeBrowseCategoryEntries(fallbackSettings, nextCategories);
        setSettings(fallbackSettings);
        setBrowseSectionSettings(normalizeBrowseCategoriesSettings(fallbackSettings.homepage.browseCategoriesSettings));
        setCategories(nextCategories);
        setBrowseEntries(nextEntries);
        setExpandedCategoryId("");
        setSelectedCategoryId("");
        setMessage("Showing default categories. Start backend and sign in as admin to save changes.");
        setMessageTone("warning");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, [refreshToken]);

  const updateBrowseEntry = (entryId, values) => {
    setBrowseEntries((current) =>
      current.map((entry) =>
        entry.id === entryId
          ? { ...entry, ...values }
          : entry
      )
    );
  };

  const persistBrowseEntries = async (nextEntries, successMessage = "Browse Categories saved. Frontend will show the selected homepage categories.") => {
    const cleanEntries = nextEntries
      .map((entry, index) => {
        const category = getCategoryForBrowseEntry(entry, categories);
        return {
          id: entry.id,
          categoryId: category?.id ?? entry.categoryId ?? null,
          categorySlug: category?.slug || entry.categorySlug || "",
          status: entry.status === "inactive" ? "inactive" : "active",
          showOnHomepage: entry.status !== "inactive",
          sortOrder: Number(entry.sortOrder || index + 1),
          imageUrl: String(entry.imageUrl || "").trim(),
          buttonText: String(entry.buttonText || "Explore Now").trim(),
          buttonLink: String(entry.buttonLink || (category?.slug ? `/category/${category.slug}` : "/collections")).trim()
        };
      })
      .filter((entry) => entry.categoryId || entry.categorySlug)
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
    const nextSettings = mergeSettings(settings, {
      homepage: {
        ...(settings.homepage || {}),
        browseCategories: cleanEntries
      }
    });

    try {
      const response = await updateAdminSettings({ settings: nextSettings });
      const savedSettings = mergeSettings(DEFAULT_APP_SETTINGS, response.data?.data || nextSettings);
      setSettings(savedSettings);
      setBrowseEntries(normalizeBrowseCategoryEntries(savedSettings, categories));
      setMessage(successMessage);
      setMessageTone("success");
      return true;
    } catch {
      setSettings(nextSettings);
      setBrowseEntries(cleanEntries);
      setMessage("Saved locally on this page only. Backend/admin login is required for frontend preview to update.");
      setMessageTone("warning");
      return false;
    }
  };

  const handleAddHomepageCategory = async () => {
    if (!selectedCategoryId) return;

    const category = categories.find((item) => getCategoryKey(item) === selectedCategoryId);
    if (!category) return;

    const nextSortOrder = Math.max(0, ...browseEntries.map((entry) => Number(entry.sortOrder || 0))) + 1;
    const nextEntry = {
      ...createBrowseCategoryEntry(category, nextSortOrder - 1),
      status: "active",
      sortOrder: nextSortOrder
    };
    const nextEntries = [...browseEntries, nextEntry];
    setBrowseEntries(nextEntries);
    setExpandedCategoryId(selectedCategoryId);
    setSelectedCategoryId("");
    setIsAutoSavingSort(true);
    await persistBrowseEntries(nextEntries, "Category added to homepage and published.");
    setIsAutoSavingSort(false);
  };

  const handleRemoveHomepageCategory = async (categoryId) => {
    const nextEntries = browseEntries
      .filter((entry) => getBrowseEntryKey(entry) !== categoryId)
      .map((entry, index) => ({ ...entry, sortOrder: index + 1 }));
    setBrowseEntries(nextEntries);
    setExpandedCategoryId((current) => (current === categoryId ? "" : current));
    setIsAutoSavingSort(true);
    await persistBrowseEntries(nextEntries, "Category removed from homepage and published.");
    setIsAutoSavingSort(false);
  };

  const handleHomepageCategoryStatus = async (categoryId, status) => {
    const nextEntries = browseEntries.map((entry) =>
      getBrowseEntryKey(entry) === categoryId ? { ...entry, status } : entry
    );
    setBrowseEntries(nextEntries);
    setIsAutoSavingSort(true);
    await persistBrowseEntries(nextEntries, `Category marked ${status}.`);
    setIsAutoSavingSort(false);
  };

  const handleBrowseCardCountChange = async (value) => {
    setBrowseSectionSettings((current) => ({ ...current, cardsPerRow: normalizeCardsPerRow(value) }));
  };

  const updateBrowseSectionField = (key, value) => {
    setBrowseSectionSettings((current) => ({
      ...current,
      [key]: key === "cardsPerRow"
        ? normalizeCardsPerRow(value)
        : key === "mobileCardsPerRow"
          ? normalizeMobileCardsPerRow(value)
          : value
    }));
    setMessage("");
  };

  const saveBrowseSectionSettings = async () => {
    const payload = normalizeBrowseCategoriesSettings(browseSectionSettings);
    setIsSaving(true);

    try {
      const response = await updateBrowseCategoriesSettings(payload);
      const saved = normalizeBrowseCategoriesSettings(response.data?.data || payload);
      const nextSettings = mergeSettings(settings, {
        homepage: {
          ...(settings.homepage || {}),
          browseCategoriesSettings: saved,
          browseCategoryCardCount: saved.cardsPerRow
        }
      });
      setBrowseSectionSettings(saved);
      setSettings(nextSettings);
      setMessage("Browse Categories section settings saved.");
      setMessageTone("success");
    } catch (error) {
      const messageText = error.response?.data?.message || "Browse Categories settings could not be saved.";
      setMessage(messageText);
      setMessageTone("warning");
    } finally {
      setIsSaving(false);
    }
  };

  const saveBrowseEntryOrder = async (nextEntries, messageText = "Category order saved.") => {
    setBrowseEntries(nextEntries);
    setIsAutoSavingSort(true);
    await persistBrowseEntries(nextEntries, messageText);
    setIsAutoSavingSort(false);
  };

  const moveHomepageCategory = async (categoryId, direction) => {
    const visibleEntries = [...browseEntries]
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
    const currentIndex = visibleEntries.findIndex((entry) => getBrowseEntryKey(entry) === categoryId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= visibleEntries.length) return;

    const currentEntry = visibleEntries[currentIndex];
    const targetEntry = visibleEntries[nextIndex];
    const nextEntries = browseEntries
      .map((entry) => {
        const key = getBrowseEntryKey(entry);
        if (key === getBrowseEntryKey(currentEntry)) return { ...entry, sortOrder: nextIndex + 1 };
        if (key === getBrowseEntryKey(targetEntry)) return { ...entry, sortOrder: currentIndex + 1 };
        return entry;
      })
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
      .map((entry, index) => ({ ...entry, sortOrder: index + 1 }));
    await saveBrowseEntryOrder(nextEntries);
  };

  const handleDropHomepageCategory = async (targetCategoryId, event) => {
    event?.preventDefault();

    if (!draggedCategoryId || draggedCategoryId === targetCategoryId) {
      setDraggedCategoryId("");
      return;
    }

    const orderedEntries = [...browseEntries].sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
    const draggedIndex = orderedEntries.findIndex((entry) => getBrowseEntryKey(entry) === draggedCategoryId);
    const targetIndex = orderedEntries.findIndex((entry) => getBrowseEntryKey(entry) === targetCategoryId);

    if (draggedIndex < 0 || targetIndex < 0) {
      setDraggedCategoryId("");
      return;
    }

    const [draggedEntry] = orderedEntries.splice(draggedIndex, 1);
    orderedEntries.splice(targetIndex, 0, draggedEntry);
    const nextEntries = orderedEntries.map((entry, index) => ({ ...entry, sortOrder: index + 1 }));
    setDraggedCategoryId("");
    await saveBrowseEntryOrder(nextEntries, "Category order auto-saved.");
  };

  const handleCategoryImageUpload = async (categoryId, file) => {
    if (!file) return;

    setUploadingCategoryId(categoryId);

    try {
      const response = await uploadAdminImage(file);
      const uploadedUrl = response.data?.data?.url || "";
      const imageUrl = toStoredUploadUrl(uploadedUrl);

      if (!imageUrl) throw new Error("Image upload did not return a URL");
      updateBrowseEntry(categoryId, { imageUrl });
      setMessage("Homepage-only category image uploaded. Save to publish it on the frontend.");
      setMessageTone("success");
    } catch {
      try {
        const compressedImage = await compressImageFile(file, 1200, 0.82);
        updateBrowseEntry(categoryId, { imageUrl: compressedImage });
        setMessage("Backend upload is unavailable, so the category image was added locally for preview.");
        setMessageTone("warning");
      } catch {
        setMessage("Category image could not be added. Please try a smaller image.");
        setMessageTone("warning");
      }
    } finally {
      setUploadingCategoryId("");
    }
  };

  const saveBrowseCategories = async (
    successMessage = "Browse Categories saved. Frontend will show the selected homepage categories.",
    autoCloseCategoryId = ""
  ) => {
    setIsSaving(true);
    const didSave = await persistBrowseEntries(browseEntries, successMessage);
    if (didSave && autoCloseCategoryId) {
      window.setTimeout(() => {
        setExpandedCategoryId((current) => (current === autoCloseCategoryId ? "" : current));
      }, 1200);
    }
    setIsSaving(false);
  };

  const handleSave = async () => {
    await saveBrowseCategories();
  };

  const handleSaveCategoryCta = async (categoryId) => {
    await saveBrowseCategories("Changes successfully completed.", categoryId);
  };

  const homepageCategories = browseEntries
    .map((entry) => {
      const category = getCategoryForBrowseEntry(entry, categories);
      return category ? mergeBrowseCategoryEntry(entry, category) : null;
    })
    .filter(Boolean)
    .sort((left, right) => Number(left.homepageSortOrder || 0) - Number(right.homepageSortOrder || 0));
  const selectedCategoryKeys = new Set(homepageCategories.map((category) => getCategoryKey(category)));
  const availableCategories = categories
    .filter((category) => !selectedCategoryKeys.has(getCategoryKey(category)))
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
  const shownCount = homepageCategories.filter((category) => category.homepageStatus === "active").length;

  return (
    <section className="dashboard-page-shell">
      <div style={heroStyle}>
        <span style={eyebrowStyle}>Homepage Configuration</span>
        <h2 style={titleStyle}>{section.title}</h2>
        <p style={copyStyle}>Controls the Shop by Category section using the existing Categories module.</p>
      </div>

      <div style={panelStyle}>
        <div style={actionBarStyle}>
          <div>
            <span style={eyebrowStyle}>Shop by Category</span>
            <h3 style={panelTitleStyle}>Homepage Category Display</h3>
            <p style={panelCopyStyle}>Select homepage categories, drag them into order, and publish homepage-only card images.</p>
          </div>
          <div style={actionGroupStyle}>
            <span style={summaryPillStyle}>{`${shownCount} Shown`}</span>
            <span style={summaryPillStyle}>{`${homepageCategories.length} Selected`}</span>
            {isAutoSavingSort ? <span style={summaryPillStyle}>Auto-saving...</span> : null}
            <button type="button" onClick={handleSave} disabled={isSaving || isLoading} style={saveButtonStyle}>
              {isSaving ? "Saving..." : "Save Browse Categories"}
            </button>
          </div>
        </div>

        {message ? (
          <div style={{ ...feedbackStyle, ...(messageTone === "warning" ? feedbackWarningStyle : feedbackSuccessStyle) }}>
            {message}
          </div>
        ) : null}

        <div style={browseSettingsPanelStyle}>
          <label style={checkboxFieldStyle}>
            <input
              type="checkbox"
              checked={browseSectionSettings.enabled}
              onChange={(event) => updateBrowseSectionField("enabled", event.target.checked)}
            />
            <span>Section Enable / Disable</span>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Section Title</span>
            <input
              value={browseSectionSettings.title}
              onChange={(event) => updateBrowseSectionField("title", event.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Section Subtitle</span>
            <input
              value={browseSectionSettings.subtitle}
              onChange={(event) => updateBrowseSectionField("subtitle", event.target.value)}
              style={inputStyle}
              placeholder="Optional helper text below the section title"
            />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Cards Per Row</span>
            <select
              value={browseSectionSettings.cardsPerRow}
              onChange={(event) => handleBrowseCardCountChange(event.target.value)}
              style={inputStyle}
            >
              {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>{count}</option>
              ))}
            </select>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Mobile Cards Per Row</span>
            <select
              value={browseSectionSettings.mobileCardsPerRow}
              onChange={(event) => updateBrowseSectionField("mobileCardsPerRow", event.target.value)}
              style={inputStyle}
            >
              {[1, 2, 3].map((count) => (
                <option key={count} value={count}>{count}</option>
              ))}
            </select>
          </label>
          <div style={settingsSaveActionStyle}>
            <button type="button" onClick={saveBrowseSectionSettings} disabled={isSaving || isLoading} style={saveButtonStyle}>
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        <div style={homepageCategorySelectorStyle}>
          <div>
            <span style={eyebrowStyle}>Available Categories</span>
            <h4 style={selectorTitleStyle}>Add Existing Category to Homepage</h4>
            <p style={panelCopyStyle}>Homepage display settings stay separate from category page and menu settings.</p>
          </div>
          <div style={selectorControlsStyle}>
            <select
              value={selectedCategoryId}
              onChange={(event) => setSelectedCategoryId(event.target.value)}
              style={inputStyle}
              disabled={!availableCategories.length}
            >
              <option value="">{availableCategories.length ? "Select category" : "All categories are already selected"}</option>
              {availableCategories.map((category) => (
                <option key={getCategoryKey(category)} value={getCategoryKey(category)}>{category.name}</option>
              ))}
            </select>
            <button type="button" onClick={handleAddHomepageCategory} disabled={!selectedCategoryId} style={saveButtonStyle}>
              Add to Homepage
            </button>
          </div>
        </div>

        <div style={categoryManageListStyle}>
          {homepageCategories.length ? homepageCategories.map((category, index) => {
            const categoryKey = getCategoryKey(category);

            return (
            <article
              key={categoryKey}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDropHomepageCategory(categoryKey, event)}
              style={{
                ...categoryManageCardStyle,
                ...(draggedCategoryId === categoryKey ? categoryManageCardDraggingStyle : null)
              }}
            >
              <button
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", categoryKey);
                  setDraggedCategoryId(categoryKey);
                }}
                onDragEnd={() => setDraggedCategoryId("")}
                style={categoryDragHandleStyle}
                aria-label={`Drag ${category.name}`}
                title="Drag to reorder"
              >
                <span aria-hidden="true" style={categoryDragDotsStyle}>
                  <span style={categoryDragDotStyle} />
                  <span style={categoryDragDotStyle} />
                  <span style={categoryDragDotStyle} />
                  <span style={categoryDragDotStyle} />
                  <span style={categoryDragDotStyle} />
                  <span style={categoryDragDotStyle} />
                </span>
              </button>
              <div style={categoryPreviewContentStyle}>
                {(category.homepageImageUrl || category.imageUrl || category.bannerImageUrl) ? (
                  <img src={getAdminMediaPreviewUrl(category.homepageImageUrl || category.imageUrl || category.bannerImageUrl)} alt="" style={categoryPreviewImageStyle} />
                ) : null}
                <div style={categoryPreviewCopyStyle}>
                  <span style={eyebrowStyle}>Category</span>
                  <strong style={categoryPreviewCopyStyleStrong}>{category.name}</strong>
                  <span style={categoryMetaStyle}>
                    <span>{`${category.productCount} products`}</span>
                    <span>{category.homepageStatus === "active" ? "Active" : "Inactive"}</span>
                    <span>{`Sort ${category.homepageSortOrder || 0}`}</span>
                  </span>
                  {category.homepageImageUrl ? <span>Homepage image override active</span> : null}
                </div>
              </div>
              <div style={categoryRowActionsStyle}>
                <span style={categoryOrderPillStyle}>{`#${index + 1}`}</span>
                <button
                  type="button"
                  onClick={() => handleHomepageCategoryStatus(categoryKey, category.homepageStatus === "active" ? "inactive" : "active")}
                  style={category.homepageStatus === "active" ? rowActiveButtonStyle : rowInactiveButtonStyle}
                >
                  {category.homepageStatus === "active" ? "Active" : "Inactive"}
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedCategoryId((current) => (current === categoryKey ? "" : categoryKey))}
                  style={categoryEditButtonStyle}
                >
                  {expandedCategoryId === categoryKey ? "Close" : "Edit CTA"}
                </button>
                <button type="button" onClick={() => handleRemoveHomepageCategory(categoryKey)} style={rowDeleteButtonStyle}>
                  Delete
                </button>
              </div>

              {expandedCategoryId === categoryKey ? (
                <div style={{ ...bannerEditorStyle, gridColumn: "1 / -1" }}>
                  <div style={categorySmallGridStyle}>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Sort Order</span>
                      <input
                        type="number"
                        min="0"
                        value={category.homepageSortOrder}
                        onChange={(event) => updateBrowseEntry(category.homepageEntryId, { sortOrder: Number(event.target.value || 0) })}
                        style={inputStyle}
                      />
                    </label>
                  </div>
                  <div style={categorySmallGridStyle}>
                    <ImageUploadField
                      label="Homepage Card Image"
                      imageUrl={category.homepageImageUrl || category.imageUrl || category.bannerImageUrl}
                      isUploading={uploadingCategoryId === category.homepageEntryId}
                      onUpload={(file) => handleCategoryImageUpload(category.homepageEntryId, file)}
                    />
                    <div style={compactSectionGridStyle}>
                      <label style={fieldStyle}>
                        <span style={labelStyle}>CTA Button Text</span>
                        <input value={category.homepageButtonText} onChange={(event) => updateBrowseEntry(category.homepageEntryId, { buttonText: event.target.value })} style={inputStyle} />
                      </label>
                      <label style={fieldStyle}>
                        <span style={labelStyle}>CTA Button Link</span>
                        <input value={category.homepageButtonLink} onChange={(event) => updateBrowseEntry(category.homepageEntryId, { buttonLink: event.target.value })} style={inputStyle} />
                      </label>
                      {category.homepageImageUrl ? (
                        <button type="button" onClick={() => updateBrowseEntry(category.homepageEntryId, { imageUrl: "" })} style={secondaryButtonStyle}>
                          Use Original Category Image
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div style={editorSaveBarStyle}>
                    <button type="button" onClick={() => setExpandedCategoryId("")} style={secondaryButtonStyle}>Close</button>
                    <button type="button" onClick={() => handleSaveCategoryCta(categoryKey)} disabled={isSaving || isLoading} style={saveButtonStyle}>
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          );
          }) : (
            <div style={emptyHomepageCategoryStyle}>
              No categories selected for homepage yet. Choose a category above and add it to the homepage display.
            </div>
          )}
        </div>

        <Link to="/dashboard/homepage" style={backButtonStyle}>Back to Homepage Sections</Link>
      </div>
    </section>
  );
}

function getProductKey(product) {
  return String(product.asin || product.slug || product.name || "");
}

function normalizeProductIdentifier(value) {
  return String(value || "").trim().toLowerCase();
}

function createHomepageProductEntry(product, index) {
  return {
    id: `homepage-product-${getProductKey(product)}`,
    productAsin: product.asin || "",
    productSlug: product.slug || "",
    status: "active",
    sortOrder: index + 1,
    slotNumber: index + 1
  };
}

function normalizeDashboardProduct(product) {
  const price = Number(product.price || 0);
  const mrp = Number(product.mrp || price || 0);
  const categorySlug = product.categorySlug || product.collectionSlug || String(product.categoryName || product.category || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const gallery = Array.isArray(product.galleryUrls) && product.galleryUrls.length
    ? product.galleryUrls
    : Array.isArray(product.gallery) && product.gallery.length
      ? product.gallery
      : [product.imageUrl || product.image || ""];

  return {
    ...product,
    asin: String(product.asin || product.sku || product.slug || "").trim(),
    sku: String(product.sku || product.asin || "").trim(),
    slug: product.slug || String(product.name || product.asin || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
    name: product.name || "Untitled product",
    brand: product.brand || "",
    category: product.categoryName || product.category || "Products",
    categorySlug,
    collectionSlug: categorySlug,
    price,
    mrp,
    image: gallery[0],
    gallery,
    status: String(product.status || "active").toLowerCase()
  };
}

function mergeProductSources(products = [], includeFallbackProducts = products.length === 0) {
  const byKey = new Map();

  if (includeFallbackProducts) {
    allProducts.map(normalizeDashboardProduct).forEach((product) => {
      byKey.set(getProductKey(product), product);
    });
  }

  products.map(normalizeDashboardProduct).forEach((product) => {
    byKey.set(getProductKey(product), product);
  });

  return Array.from(byKey.values()).filter((product) => getProductKey(product));
}

function getProductByHomepageEntry(entry, productSource = allProducts) {
  const asin = String(entry.productAsin || "").trim();
  const slug = String(entry.productSlug || "").trim();
  return productSource.find((product) => String(product.asin || "") === asin || String(product.slug || "") === slug) || null;
}

function normalizeHomepageProducts(settings, settingsKey = "ourProducts", fallbackProducts = allProducts.slice(0, 8), productSource = allProducts) {
  const configured = Array.isArray(settings.homepage?.[settingsKey]) ? settings.homepage[settingsKey] : [];
  const normalizeEntries = (source) => source
    .map((entry, index) => {
      const product = getProductByHomepageEntry(entry, productSource);
      return {
        id: entry.id || `homepage-product-${entry.productAsin || entry.productSlug || index}`,
        productAsin: entry.productAsin || product?.asin || "",
        productSlug: entry.productSlug || product?.slug || "",
        status: String(entry.status || "active").toLowerCase() === "inactive" ? "inactive" : "active",
        showOnHomepage: entry.showOnHomepage !== false && String(entry.status || "active").toLowerCase() !== "inactive",
        showInOurProducts: entry.showInOurProducts !== false,
        bestSeller: entry.bestSeller !== false,
        trending: entry.trending !== false,
        newArrival: entry.newArrival !== false,
        sortOrder: Number(entry.sortOrder || index + 1),
        slotNumber: Number(entry.slotNumber || entry.sortOrder || index + 1)
      };
    })
    .filter((entry) => getProductByHomepageEntry(entry, productSource))
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));

  const configuredEntries = configured.length ? normalizeEntries(configured) : [];
  return configuredEntries.length ? configuredEntries : normalizeEntries(fallbackProducts.map(createHomepageProductEntry));
}

function getProductCategoryOptions(productSource = allProducts) {
  const bySlug = new Map();
  productSource.forEach((product) => {
    const slug = String(product.collectionSlug || product.categorySlug || "").trim();
    if (!slug) return;
    bySlug.set(slug, { slug, label: product.category || slug, sortOrder: 9999 });
  });
  return Array.from(bySlug.values())
    .sort((left, right) => left.label.localeCompare(right.label));
}

function getBackendCategoryOptions(categories = []) {
  return categories
    .filter((category) => !category.parentId)
    .filter((category) => String(category.status || "active").toLowerCase() !== "inactive")
    .map((category) => ({
      slug: String(category.slug || "").trim(),
      label: String(category.name || category.categoryName || category.slug || "").trim(),
      sortOrder: Number(category.sortOrder || 0)
    }))
    .filter((category) => category.slug && category.label);
}

function mergeCategoryOptions(...optionGroups) {
  const bySlug = new Map();

  optionGroups.flat().forEach((option) => {
    const slug = String(option?.slug || "").trim();
    if (!slug) return;

    if (!bySlug.has(slug)) {
      bySlug.set(slug, {
        slug,
        label: String(option.label || slug).trim(),
        sortOrder: Number(option.sortOrder || 9999)
      });
      return;
    }

    const current = bySlug.get(slug);
    bySlug.set(slug, {
      ...current,
      label: current.label || String(option.label || slug).trim(),
      sortOrder: Math.min(Number(current.sortOrder || 9999), Number(option.sortOrder || 9999))
    });
  });

  return Array.from(bySlug.values())
    .sort((left, right) =>
      Number(left.sortOrder || 9999) - Number(right.sortOrder || 9999) ||
      left.label.localeCompare(right.label)
    );
}

function getConfiguredCategorySlugs(settings, categorySettingsKey, categoryOptions) {
  const configured = settings.homepage?.[categorySettingsKey];
  return Array.isArray(configured) && configured.length
    ? configured
    : categoryOptions.map((category) => category.slug);
}

function ProductArrangementConfigure({ section, settingsKey, categorySettingsKey = "", sectionLabel, enableCategoryControls = false, fallbackMode = "", refreshToken = 0 }) {
  const navigate = useNavigate();
  const sectionConfig = homepageSectionConfigBySettingsKey[settingsKey] || homepageSectionConfigBySettingsKey.ourProducts;
  const [settings, setSettings] = React.useState(() => cloneSettings(DEFAULT_APP_SETTINGS));
  const [sectionSettings, setSectionSettings] = React.useState(() => normalizeHomepageSectionSettings(DEFAULT_APP_SETTINGS.homepage[sectionConfig.settingsKey], DEFAULT_APP_SETTINGS.homepage[sectionConfig.settingsKey]));
  const [productSource, setProductSource] = React.useState(() => mergeProductSources([], true));
  const fallbackProducts = fallbackMode === "arrivals"
    ? [...productSource].sort((left, right) => Number(right.rating || 0) - Number(left.rating || 0)).slice(0, 4)
    : settingsKey === "bestSellerProducts"
      ? productSource.slice(0, 8)
      : productSource.filter((product) => product.collectionSlug === "digital-photo-frames").length
        ? productSource.filter((product) => product.collectionSlug === "digital-photo-frames")
        : productSource.slice(0, 8);
  const productCategoryOptions = React.useMemo(() => getProductCategoryOptions(productSource), [productSource]);
  const [backendCategoryOptions, setBackendCategoryOptions] = React.useState([]);
  const categoryOptions = React.useMemo(
    () => mergeCategoryOptions(backendCategoryOptions, productCategoryOptions),
    [backendCategoryOptions, productCategoryOptions]
  );
  const [homepageProducts, setHomepageProducts] = React.useState(() => normalizeHomepageProducts(DEFAULT_APP_SETTINGS, settingsKey, fallbackProducts, productSource));
  const [visibleCategorySlugs, setVisibleCategorySlugs] = React.useState(() =>
    getConfiguredCategorySlugs(DEFAULT_APP_SETTINGS, categorySettingsKey, categoryOptions)
  );
  const [selectedProductAsin, setSelectedProductAsin] = React.useState("");
  const [productAsinSearch, setProductAsinSearch] = React.useState("");
  const [isProductSearchOpen, setIsProductSearchOpen] = React.useState(false);
  const [draggedProductId, setDraggedProductId] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isAutoSavingSort, setIsAutoSavingSort] = React.useState(false);
  const [isSearchingProducts, setIsSearchingProducts] = React.useState(false);
  const [categoryUpdateMessage, setCategoryUpdateMessage] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [messageTone, setMessageTone] = React.useState("success");

  React.useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      setIsLoading(true);
      try {
        const [settingsResponse, productsResponse, categoriesResponse, sectionSettingsResponse] = await Promise.all([
          fetchAdminSettings(),
          fetchProducts({ status: "active", limit: 200 }),
          enableCategoryControls ? fetchCategories() : Promise.resolve({ data: { data: [] } }),
          fetchHomepageSectionSettings(sectionConfig.routeKey)
        ]);
        if (!isMounted) return;

        const liveProducts = Array.isArray(productsResponse.data?.data) ? productsResponse.data.data : [];
        const liveCategories = Array.isArray(categoriesResponse.data?.data) ? categoriesResponse.data.data : [];
        const nextProductSource = mergeProductSources(liveProducts, false);
        const nextFallbackProducts = fallbackMode === "arrivals"
          ? [...nextProductSource].sort((left, right) => Number(right.rating || 0) - Number(left.rating || 0)).slice(0, 4)
          : settingsKey === "bestSellerProducts"
            ? nextProductSource.slice(0, 8)
            : nextProductSource.filter((product) => product.collectionSlug === "digital-photo-frames").length
              ? nextProductSource.filter((product) => product.collectionSlug === "digital-photo-frames")
              : nextProductSource.slice(0, 8);
        const nextBackendCategoryOptions = getBackendCategoryOptions(liveCategories);
        const nextCategoryOptions = mergeCategoryOptions(nextBackendCategoryOptions, getProductCategoryOptions(nextProductSource));
        const mergedSettings = mergeSettings(DEFAULT_APP_SETTINGS, settingsResponse.data?.data || {});
        const nextSectionSettings = normalizeHomepageSectionSettings(sectionSettingsResponse.data?.data || mergedSettings.homepage?.[sectionConfig.settingsKey], DEFAULT_APP_SETTINGS.homepage[sectionConfig.settingsKey]);
        setProductSource(nextProductSource);
        setBackendCategoryOptions(nextBackendCategoryOptions);
        setSettings(mergedSettings);
        setSectionSettings(nextSectionSettings);
        setHomepageProducts(normalizeHomepageProducts(mergedSettings, settingsKey, nextFallbackProducts, nextProductSource));
        if (enableCategoryControls) {
          setVisibleCategorySlugs(getConfiguredCategorySlugs(mergedSettings, categorySettingsKey, nextCategoryOptions));
        }
        setMessage(`${sectionLabel} products loaded from backend products and admin settings.`);
        setMessageTone("success");
      } catch {
        if (!isMounted) return;
        const fallbackProductSource = mergeProductSources([], true);
        const fallbackSettings = cloneSettings(DEFAULT_APP_SETTINGS);
        const fallbackCategoryOptions = getProductCategoryOptions(fallbackProductSource);
        setProductSource(fallbackProductSource);
        setBackendCategoryOptions([]);
        setSettings(fallbackSettings);
        setSectionSettings(normalizeHomepageSectionSettings(fallbackSettings.homepage[sectionConfig.settingsKey], DEFAULT_APP_SETTINGS.homepage[sectionConfig.settingsKey]));
        setHomepageProducts(normalizeHomepageProducts(fallbackSettings, settingsKey, fallbackProducts, fallbackProductSource));
        if (enableCategoryControls) {
          setVisibleCategorySlugs(getConfiguredCategorySlugs(fallbackSettings, categorySettingsKey, fallbackCategoryOptions));
        }
        setMessage("Showing default products. Start backend and sign in as admin to save changes.");
        setMessageTone("warning");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [refreshToken]);

  React.useEffect(() => {
    const searchTerm = productAsinSearch.trim();
    if (!searchTerm) return;

    let isMounted = true;
    const timeoutId = window.setTimeout(async () => {
      setIsSearchingProducts(true);
      try {
        const response = await fetchProducts({ search: searchTerm });
        if (!isMounted) return;
        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        if (!rows.length) return;
        setProductSource((current) => mergeProductSources([...current, ...rows]));
      } catch {
        if (!isMounted) return;
        setMessage("Product search could not reach backend. Check backend server and try the ASIN again.");
        setMessageTone("warning");
      } finally {
        if (isMounted) setIsSearchingProducts(false);
      }
    }, 250);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [productAsinSearch]);

  const selectedKeys = new Set(
    homepageProducts.flatMap((entry) => {
      const product = getProductByHomepageEntry(entry, productSource);
      return [entry.productAsin, entry.productSlug, product?.asin, product?.sku, product?.slug]
        .map(normalizeProductIdentifier)
        .filter(Boolean);
    })
  );
  const availableProducts = productSource
    .filter((product) => {
      const productIdentifiers = [product.asin, product.sku, product.slug, getProductKey(product)]
        .map(normalizeProductIdentifier)
        .filter(Boolean);
      return (
        getProductKey(product) &&
        !productIdentifiers.some((identifier) => selectedKeys.has(identifier))
      );
    })
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
  const normalizedProductSearch = productAsinSearch.trim().toLowerCase();
  const filteredAvailableProducts = normalizedProductSearch
    ? availableProducts.filter((product) => [product.asin, product.sku, product.slug, getProductKey(product)]
        .map(normalizeProductIdentifier)
        .some((identifier) => identifier.includes(normalizedProductSearch)))
    : availableProducts;
  const activeCount = homepageProducts.filter((entry) => entry.status === "active").length;
  const selectedProduct = productSource.find((product) => getProductKey(product) === selectedProductAsin) || null;
  const searchModalProducts = normalizedProductSearch ? filteredAvailableProducts : availableProducts.slice(0, 24);

  const handleSelectProductFromSearch = (product) => {
    setSelectedProductAsin(getProductKey(product));
    setProductAsinSearch(product.asin || product.sku || product.slug || "");
  };

  const updateHomepageProduct = (entryId, values) => {
    setHomepageProducts((current) =>
      current.map((entry) => entry.id === entryId ? { ...entry, ...values } : entry)
    );
  };

  const resequenceProducts = (entries) =>
    entries.map((entry, index) => ({
      ...entry,
      sortOrder: Number(entry.sortOrder || index + 1),
      slotNumber: Number(entry.slotNumber || index + 1)
    }));

  const buildCleanHomepageProducts = (sourceProducts) =>
    sourceProducts
      .map((entry, index) => ({
        id: entry.id,
        productAsin: String(entry.productAsin || "").trim(),
        productSlug: String(entry.productSlug || "").trim(),
        status: entry.status === "inactive" ? "inactive" : "active",
        showOnHomepage: entry.status !== "inactive",
        showInOurProducts: settingsKey === "ourProducts" ? entry.status !== "inactive" : Boolean(entry.showInOurProducts),
        bestSeller: settingsKey === "bestSellerProducts" ? entry.status !== "inactive" : Boolean(entry.bestSeller),
        trending: settingsKey === "bestSellerProducts" ? entry.status !== "inactive" : Boolean(entry.trending),
        newArrival: settingsKey === "newArrivalProducts" ? entry.status !== "inactive" : Boolean(entry.newArrival),
        sortOrder: Number(entry.sortOrder || index + 1),
        slotNumber: Number(entry.slotNumber || entry.sortOrder || index + 1)
      }))
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));

  const persistHomepageProducts = async (nextProducts, successMessage, categorySlugs = visibleCategorySlugs) => {
    const cleanProducts = buildCleanHomepageProducts(nextProducts);
    const nextSettings = mergeSettings(settings, {
      homepage: {
        ...(settings.homepage || {}),
        [settingsKey]: cleanProducts,
        ...(enableCategoryControls && categorySettingsKey ? { [categorySettingsKey]: categorySlugs } : {})
      }
    });

    try {
      const response = await updateAdminSettings({ settings: nextSettings });
      const savedSettings = mergeSettings(DEFAULT_APP_SETTINGS, response.data?.data || nextSettings);
      setSettings(savedSettings);
      setHomepageProducts(normalizeHomepageProducts(savedSettings, settingsKey, fallbackProducts, productSource));
      if (enableCategoryControls) {
        setVisibleCategorySlugs(savedSettings.homepage?.[categorySettingsKey] || categorySlugs);
      }
      setMessage(successMessage);
      setMessageTone("success");
      return true;
    } catch {
      setSettings(nextSettings);
      setHomepageProducts(cleanProducts);
      setMessage("Saved locally on this page only. Backend/admin login is required for frontend preview to update.");
      setMessageTone("warning");
      return false;
    }
  };

  const autoSaveHomepageProducts = async (nextProducts, successMessage) => {
    setHomepageProducts(nextProducts);
    setIsAutoSavingSort(true);
    await persistHomepageProducts(nextProducts, successMessage);
    setIsAutoSavingSort(false);
  };

  const handleVisibleCategoryChange = async (categorySlug, isChecked) => {
    const nextSlugs = isChecked
      ? Array.from(new Set([...visibleCategorySlugs, categorySlug]))
      : visibleCategorySlugs.filter((slug) => slug !== categorySlug);
    setVisibleCategorySlugs(nextSlugs);
    setSelectedProductAsin("");
    setCategoryUpdateMessage("");
  };

  const handleSaveVisibleCategories = async () => {
    setIsAutoSavingSort(true);
    const didSave = await persistHomepageProducts(homepageProducts, `${sectionLabel} categories updated.`, visibleCategorySlugs);
    setCategoryUpdateMessage(didSave ? "Categories updated successfully." : "Categories updated locally. Sign in and keep backend running to publish.");
    setIsAutoSavingSort(false);
  };

  const handleAddProduct = async () => {
    const product = productSource.find((entry) => getProductKey(entry) === selectedProductAsin);
    if (!product) return;

    const nextSlot = Math.max(0, ...homepageProducts.map((entry) => Number(entry.slotNumber || 0))) + 1;
    const nextSort = Math.max(0, ...homepageProducts.map((entry) => Number(entry.sortOrder || 0))) + 1;

    const nextProducts = [
      ...homepageProducts,
      {
        ...createHomepageProductEntry(product, nextSort - 1),
        sortOrder: nextSort,
        slotNumber: nextSlot
      }
    ];
    const nextCategorySlugs = enableCategoryControls && product.collectionSlug
      ? Array.from(new Set([...visibleCategorySlugs, product.collectionSlug]))
      : visibleCategorySlugs;

    setHomepageProducts(nextProducts);
    if (enableCategoryControls) setVisibleCategorySlugs(nextCategorySlugs);
    setSelectedProductAsin("");
    setProductAsinSearch("");
    setIsAutoSavingSort(true);
    await persistHomepageProducts(nextProducts, `${sectionLabel} product added and published.`, nextCategorySlugs);
    setIsAutoSavingSort(false);
    setIsProductSearchOpen(false);
  };

  const handleRemoveProduct = async (entryId) => {
    const nextProducts = resequenceProducts(homepageProducts.filter((entry) => entry.id !== entryId));
    await autoSaveHomepageProducts(nextProducts, `${sectionLabel} product removed and published.`);
  };

  const handleProductStatus = async (entryId, status) => {
    const nextProducts = homepageProducts.map((entry) => entry.id === entryId ? { ...entry, status } : entry);
    await autoSaveHomepageProducts(nextProducts, `${sectionLabel} product marked ${status}.`);
  };

  const moveHomepageProduct = async (entryId, direction) => {
    const ordered = [...homepageProducts].sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
    const currentIndex = ordered.findIndex((entry) => entry.id === entryId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;

    const [entry] = ordered.splice(currentIndex, 1);
    ordered.splice(nextIndex, 0, entry);
    await autoSaveHomepageProducts(
      ordered.map((item, index) => ({ ...item, sortOrder: index + 1, slotNumber: index + 1 })),
      `${sectionLabel} order auto-saved.`
    );
  };

  const handleDropProduct = async (targetEntryId, event) => {
    event?.preventDefault();

    if (!draggedProductId || draggedProductId === targetEntryId) {
      setDraggedProductId("");
      return;
    }

    const ordered = [...homepageProducts].sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
    const draggedIndex = ordered.findIndex((entry) => entry.id === draggedProductId);
    const targetIndex = ordered.findIndex((entry) => entry.id === targetEntryId);

    if (draggedIndex < 0 || targetIndex < 0) {
      setDraggedProductId("");
      return;
    }

    const [entry] = ordered.splice(draggedIndex, 1);
    ordered.splice(targetIndex, 0, entry);
    setDraggedProductId("");
    await autoSaveHomepageProducts(
      ordered.map((item, index) => ({ ...item, sortOrder: index + 1, slotNumber: index + 1 })),
      `${sectionLabel} order auto-saved.`
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    await persistHomepageProducts(homepageProducts, `${sectionLabel} saved. Frontend will show active products by slot order.`);
    setIsSaving(false);
  };

  const updateSectionSettingsField = (key, value) => {
    setSectionSettings((current) => ({
      ...current,
      [key]: key === "cardsPerRow"
        ? normalizeCardsPerRow(value)
        : key === "mobileCardsPerRow"
          ? normalizeMobileCardsPerRow(value)
          : key === "buttonDisplayType"
            ? normalizeProductButtonDisplayType(value)
            : key === "sortOrder"
              ? Number(value || 0)
              : value
    }));
    setMessage("");
  };

  const saveSectionSettings = async () => {
    const payload = normalizeHomepageSectionSettings(sectionSettings, DEFAULT_APP_SETTINGS.homepage[sectionConfig.settingsKey]);
    setIsSaving(true);

    try {
      const response = await updateHomepageSectionSettings(sectionConfig.routeKey, payload);
      const saved = normalizeHomepageSectionSettings(response.data?.data || payload, DEFAULT_APP_SETTINGS.homepage[sectionConfig.settingsKey]);
      const nextSettings = mergeSettings(settings, {
        homepage: {
          ...(settings.homepage || {}),
          [sectionConfig.settingsKey]: saved
        }
      });
      setSectionSettings(saved);
      setSettings(nextSettings);
      setMessage(`${sectionLabel} section settings saved.`);
      setMessageTone("success");
    } catch (error) {
      setMessage(error.response?.data?.message || `${sectionLabel} section settings could not be saved.`);
      setMessageTone("warning");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="dashboard-page-shell">
      <div style={heroStyle}>
        <span style={eyebrowStyle}>Homepage Configuration</span>
        <h2 style={titleStyle}>{section.title}</h2>
        <p style={copyStyle}>{`Arrange products shown in the homepage ${sectionLabel} section using existing product ASIN numbers.`}</p>
      </div>

      <div style={panelStyle}>
        <div style={actionBarStyle}>
          <div>
            <span style={eyebrowStyle}>Product Arrangement</span>
            <h3 style={panelTitleStyle}>{`Homepage ${sectionLabel}`}</h3>
            <p style={panelCopyStyle}>Search by ASIN, add products to the homepage, and drag rows into the display order.</p>
          </div>
          {["ourProducts", "bestSellerProducts"].includes(settingsKey) ? null : (
            <div style={actionGroupStyle}>
              <span style={summaryPillStyle}>{`${activeCount} Active`}</span>
              <span style={summaryPillStyle}>{`${homepageProducts.length} Selected`}</span>
              {isAutoSavingSort ? <span style={summaryPillStyle}>Auto-saving...</span> : null}
              <button type="button" onClick={() => navigate("/dashboard/products")} style={secondaryButtonStyle}>
                Manage Products
              </button>
              <button type="button" onClick={handleSave} disabled={isSaving || isLoading} style={saveButtonStyle}>
                {isSaving ? "Saving..." : `Save ${sectionLabel}`}
              </button>
            </div>
          )}
        </div>

        {message ? (
          <div style={{ ...feedbackStyle, ...(messageTone === "warning" ? feedbackWarningStyle : feedbackSuccessStyle) }}>
            {message}
          </div>
        ) : null}

        <div style={browseSettingsPanelStyle}>
          <label style={checkboxFieldStyle}>
            <input
              type="checkbox"
              checked={sectionSettings.enabled}
              onChange={(event) => updateSectionSettingsField("enabled", event.target.checked)}
            />
            <span>Section Enable / Disable</span>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Section Title</span>
            <input value={sectionSettings.title} onChange={(event) => updateSectionSettingsField("title", event.target.value)} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Section Subtitle</span>
            <input value={sectionSettings.subtitle} onChange={(event) => updateSectionSettingsField("subtitle", event.target.value)} style={inputStyle} placeholder="Optional helper text" />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Cards Per Row</span>
            <select value={sectionSettings.cardsPerRow} onChange={(event) => updateSectionSettingsField("cardsPerRow", event.target.value)} style={inputStyle}>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Mobile Cards Per Row</span>
            <select value={sectionSettings.mobileCardsPerRow} onChange={(event) => updateSectionSettingsField("mobileCardsPerRow", event.target.value)} style={inputStyle}>
              {[1, 2, 3].map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Button Display Type</span>
            <select value={sectionSettings.buttonDisplayType || "both"} onChange={(event) => updateSectionSettingsField("buttonDisplayType", event.target.value)} style={inputStyle}>
              {PRODUCT_BUTTON_DISPLAY_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Sort Order</span>
            <input type="number" value={sectionSettings.sortOrder} onChange={(event) => updateSectionSettingsField("sortOrder", event.target.value)} style={inputStyle} />
          </label>
          <div style={settingsSaveActionStyle}>
            <button type="button" onClick={saveSectionSettings} disabled={isSaving || isLoading} style={saveButtonStyle}>
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        {enableCategoryControls ? (
          <div style={categoryFilterPanelStyle}>
            <div>
              <span style={eyebrowStyle}>Showing Categories</span>
              <h4 style={selectorTitleStyle}>Control Product Categories</h4>
              <p style={panelCopyStyle}>Choose which product categories are allowed to appear in this homepage section.</p>
            </div>
            <div style={categoryFilterHeaderActionsStyle}>
              <span style={summaryPillStyle}>{`${visibleCategorySlugs.length} Selected`}</span>
              <div style={categoryUpdateActionStyle}>
                <button type="button" onClick={handleSaveVisibleCategories} disabled={isAutoSavingSort} style={saveButtonStyle}>
                  {isAutoSavingSort ? "Updating..." : "Update Categories"}
                </button>
                {categoryUpdateMessage ? <span style={categoryUpdateMessageStyle}>{categoryUpdateMessage}</span> : null}
              </div>
            </div>
            <div style={categoryFilterGridStyle}>
              {categoryOptions.map((category) => (
                <label key={category.slug} style={compactToggleStyle}>
                  <input
                    type="checkbox"
                    checked={visibleCategorySlugs.includes(category.slug)}
                    onChange={(event) => handleVisibleCategoryChange(category.slug, event.target.checked)}
                  />
                  <span>{category.label}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div style={homepageCategorySelectorStyle}>
          <div>
            <span style={eyebrowStyle}>Available Products</span>
            <h4 style={selectorTitleStyle}>Add Existing Product by ASIN</h4>
            <p style={panelCopyStyle}>Create and manage product details in the Products module. This page only controls homepage placement.</p>
          </div>
          <div style={productSelectorControlsStyle}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Search Product ASIN</span>
              <input
                value={productAsinSearch}
                onChange={(event) => {
                  setProductAsinSearch(event.target.value);
                  setSelectedProductAsin("");
                  setIsProductSearchOpen(true);
                }}
                onFocus={() => setIsProductSearchOpen(true)}
                placeholder="Type exact or partial ASIN"
                style={inputStyle}
              />
            </label>
          </div>
        </div>

        {isProductSearchOpen ? (
          <div style={modalOverlayStyle}>
            <div style={productSearchModalPanelStyle}>
              <div style={modalHeaderStyle}>
                <div>
                  <span style={eyebrowStyle}>Inventory Search</span>
                  <h4 style={modalTitleStyle}>Select Product by ASIN or SKU</h4>
                  <p style={panelCopyStyle}>Search the complete product inventory, select one product, then add it to the homepage.</p>
                </div>
                <button type="button" onClick={() => setIsProductSearchOpen(false)} style={modalCloseButtonStyle} aria-label="Close product search">x</button>
              </div>

              <label style={fieldStyle}>
                <span style={labelStyle}>Search Product ASIN / SKU</span>
                <input
                  autoFocus
                  value={productAsinSearch}
                  onChange={(event) => {
                    setProductAsinSearch(event.target.value);
                    setSelectedProductAsin("");
                  }}
                  placeholder="Example: B06CZKLJ4D"
                  style={inputStyle}
                />
              </label>

              <div style={productSearchSummaryStyle}>
                <span style={summaryPillStyle}>{isSearchingProducts ? "Searching..." : `${searchModalProducts.length} results`}</span>
                {selectedProduct ? <span style={summaryPillStyle}>{`Selected: ${selectedProduct.asin || selectedProduct.slug}`}</span> : null}
              </div>

              <div style={productSearchResultsStyle}>
                {searchModalProducts.length ? searchModalProducts.map((product) => {
                  const productKey = getProductKey(product);
                  const isSelected = productKey === selectedProductAsin;

                  return (
                    <button
                      key={productKey}
                      type="button"
                      onClick={() => handleSelectProductFromSearch(product)}
                      style={{
                        ...productSearchResultStyle,
                        ...(isSelected ? productSearchResultSelectedStyle : null)
                      }}
                    >
                      <AdminPreviewImage src={product.image || product.imageUrl || product.gallery?.[0] || ""} alt={product.name} style={productSearchImageStyle} />
                      <span style={productSearchCopyStyle}>
                        <strong>{product.name}</strong>
                        <span>{`ASIN/SKU: ${product.asin || product.sku || product.slug}`}</span>
                        <span>{`${product.category || product.categoryName || "Products"} | ${product.status || "active"}`}</span>
                      </span>
                      <span style={isSelected ? rowActiveButtonStyle : categoryEditButtonStyle}>{isSelected ? "Selected" : "Select"}</span>
                    </button>
                  );
                }) : (
                  <div style={emptyHomepageCategoryStyle}>
                    {normalizedProductSearch ? "No product found for this ASIN or SKU." : "Type an ASIN or SKU to search inventory."}
                  </div>
                )}
              </div>

              <div style={modalFooterStyle}>
                <button type="button" onClick={handleAddProduct} disabled={!selectedProductAsin || isAutoSavingSort} style={saveButtonStyle}>
                  {isAutoSavingSort ? "Adding..." : "Add to Homepage"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div style={productArrangementListStyle}>
          {homepageProducts.length ? homepageProducts
            .slice()
            .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
            .map((entry, index) => {
              const product = getProductByHomepageEntry(entry, productSource);
              if (!product) return null;

              return (
                <article
                  key={entry.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDropProduct(entry.id, event)}
                  style={{
                    ...productArrangementCardStyle,
                    ...(draggedProductId === entry.id ? productArrangementCardDraggingStyle : null)
                  }}
                >
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", entry.id);
                      setDraggedProductId(entry.id);
                    }}
                    onDragEnd={() => setDraggedProductId("")}
                    style={productDragHandleStyle}
                    aria-label={`Drag ${product.name}`}
                    title="Drag to reorder"
                  >
                    <span aria-hidden="true" style={categoryDragDotsStyle}>
                      <span style={categoryDragDotStyle} />
                      <span style={categoryDragDotStyle} />
                      <span style={categoryDragDotStyle} />
                      <span style={categoryDragDotStyle} />
                      <span style={categoryDragDotStyle} />
                      <span style={categoryDragDotStyle} />
                    </span>
                  </button>
                  <AdminPreviewImage src={product.image} alt={product.name} style={productArrangementImageStyle} />
                  <div style={productArrangementContentStyle}>
                    <span style={eyebrowStyle}>{`Position ${index + 1}`}</span>
                    <strong style={productArrangementTitleStyle}>{product.name}</strong>
                    <span style={productMetaGroupStyle}>
                      <span>{`ASIN: ${product.asin || product.sku || product.slug}`}</span>
                      <span>{product.category}</span>
                      <span>{entry.status === "active" ? "Active" : "Inactive"}</span>
                    </span>
                  </div>
                  <div style={productArrangementControlsStyle}>
                    <div style={productArrangementActionStyle}>
                      <label style={productSlotInlineStyle}>
                        <span style={productSlotLabelStyle}>Slot</span>
                        <input
                          type="number"
                          min="1"
                          value={entry.slotNumber}
                          onChange={(event) => updateHomepageProduct(entry.id, { slotNumber: Number(event.target.value || 0), sortOrder: Number(event.target.value || 0) })}
                          style={productSlotInputStyle}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleProductStatus(entry.id, entry.status === "active" ? "inactive" : "active")}
                        style={entry.status === "active" ? rowActiveButtonStyle : rowInactiveButtonStyle}
                      >
                        {entry.status === "active" ? "Active" : "Inactive"}
                      </button>
                      <button type="button" onClick={() => handleRemoveProduct(entry.id)} style={rowDeleteButtonStyle}>Delete</button>
                    </div>
                  </div>
                </article>
              );
            }) : (
              <div style={emptyHomepageCategoryStyle}>
                {`No products selected for homepage yet. Choose a product ASIN above and add it to the ${sectionLabel} section.`}
              </div>
            )}
        </div>

        <Link to="/dashboard/homepage" style={backButtonStyle}>Back to Homepage Sections</Link>
      </div>
    </section>
  );
}

function createDefaultBrandEntry(brand, index) {
  return {
    id: `featured-brand-${String(brand || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name: brand,
    logoUrl: "",
    status: "active",
    sortOrder: index + 1
  };
}

function SimpleHomepageSectionConfigure({ section, routeKey, settingsKey, sectionLabel, refreshToken = 0 }) {
  const [sectionSettings, setSectionSettings] = React.useState(() => normalizeHomepageSectionSettings(DEFAULT_APP_SETTINGS.homepage[settingsKey], DEFAULT_APP_SETTINGS.homepage[settingsKey]));
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [messageTone, setMessageTone] = React.useState("success");

  React.useEffect(() => {
    let isMounted = true;

    async function loadSectionSettings() {
      setIsLoading(true);
      try {
        const response = await fetchHomepageSectionSettings(routeKey);
        if (!isMounted) return;
        setSectionSettings(normalizeHomepageSectionSettings(response.data?.data, DEFAULT_APP_SETTINGS.homepage[settingsKey]));
        setMessage(`${sectionLabel} settings loaded.`);
        setMessageTone("success");
      } catch {
        if (!isMounted) return;
        setSectionSettings(normalizeHomepageSectionSettings(DEFAULT_APP_SETTINGS.homepage[settingsKey], DEFAULT_APP_SETTINGS.homepage[settingsKey]));
        setMessage("Showing default settings. Start backend and sign in as admin to save changes.");
        setMessageTone("warning");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadSectionSettings();
    return () => {
      isMounted = false;
    };
  }, [refreshToken, routeKey, sectionLabel, settingsKey]);

  const updateField = (key, value) => {
    setSectionSettings((current) => ({
      ...current,
      [key]: key === "cardsPerRow"
        ? normalizeCardsPerRow(value)
        : key === "mobileCardsPerRow"
          ? normalizeMobileCardsPerRow(value)
          : key === "sortOrder"
            ? Number(value || 0)
            : value
    }));
    setMessage("");
  };

  const saveSettings = async () => {
    const payload = normalizeHomepageSectionSettings(sectionSettings, DEFAULT_APP_SETTINGS.homepage[settingsKey]);
    setIsSaving(true);
    try {
      const response = await updateHomepageSectionSettings(routeKey, payload);
      setSectionSettings(normalizeHomepageSectionSettings(response.data?.data || payload, DEFAULT_APP_SETTINGS.homepage[settingsKey]));
      setMessage(`${sectionLabel} section settings saved.`);
      setMessageTone("success");
    } catch (error) {
      setMessage(error.response?.data?.message || `${sectionLabel} section settings could not be saved.`);
      setMessageTone("warning");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="dashboard-page-shell">
      <div style={heroStyle}>
        <span style={eyebrowStyle}>Homepage Configuration</span>
        <h2 style={titleStyle}>{section.title}</h2>
        <p style={copyStyle}>{section.description}</p>
      </div>

      <div style={panelStyle}>
        {message ? (
          <div style={{ ...feedbackStyle, ...(messageTone === "warning" ? feedbackWarningStyle : feedbackSuccessStyle) }}>
            {message}
          </div>
        ) : null}
        <div style={browseSettingsPanelStyle}>
          <label style={checkboxFieldStyle}>
            <input type="checkbox" checked={sectionSettings.enabled} onChange={(event) => updateField("enabled", event.target.checked)} />
            <span>Section Enable / Disable</span>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Section Title</span>
            <input value={sectionSettings.title} onChange={(event) => updateField("title", event.target.value)} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Section Subtitle</span>
            <input value={sectionSettings.subtitle} onChange={(event) => updateField("subtitle", event.target.value)} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Sort Order</span>
            <input type="number" value={sectionSettings.sortOrder} onChange={(event) => updateField("sortOrder", event.target.value)} style={inputStyle} />
          </label>
          <div style={settingsSaveActionStyle}>
            <button type="button" onClick={saveSettings} disabled={isSaving || isLoading} style={saveButtonStyle}>
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
        <Link to="/dashboard/homepage" style={backButtonStyle}>Back to Homepage Sections</Link>
      </div>
    </section>
  );
}

const ICON_POSITION_OPTIONS = [
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
  { label: "Top", value: "top" }
];
const WHY_SHOP_ICON_MAX_SIZE_BYTES = 1 * 1024 * 1024;
const WHY_SHOP_ICON_ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const WHY_SHOP_ICON_ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "svg"]);

function validateWhyShopIconFile(file) {
  if (!file) return "Please choose an icon file.";
  const extension = String(file.name || "").split(".").pop()?.toLowerCase() || "";
  if (!WHY_SHOP_ICON_ALLOWED_TYPES.has(file.type) || !WHY_SHOP_ICON_ALLOWED_EXTENSIONS.has(extension)) {
    return "Use PNG, JPG, JPEG, WebP, or sanitized SVG icons only.";
  }
  if (file.size > WHY_SHOP_ICON_MAX_SIZE_BYTES) {
    return "Icon file is too large. Maximum size is 1 MB.";
  }
  return "";
}

function normalizeWhyShopItem(value = {}, index = 0) {
  const fallback = DEFAULT_APP_SETTINGS.homepage.whyShopItems[index] || DEFAULT_APP_SETTINGS.homepage.whyShopItems[0] || {};
  const iconPosition = ICON_POSITION_OPTIONS.some((option) => option.value === value.iconPosition) ? value.iconPosition : (fallback.iconPosition || "left");

  return {
    id: value.id || `why-shop-item-${Date.now()}-${index}`,
    iconUrl: String(value.iconUrl || fallback.iconUrl || "").trim(),
    iconPosition,
    iconSize: Math.min(120, Math.max(16, Number(value.iconSize || fallback.iconSize || 42))),
    title: String(value.title || fallback.title || "Trust Badge").trim(),
    titleFontSize: Math.min(42, Math.max(10, Number(value.titleFontSize || fallback.titleFontSize || 18))),
    textColor: String(value.textColor || fallback.textColor || "#0f172a").trim(),
    cardBackgroundColor: String(value.cardBackgroundColor || fallback.cardBackgroundColor || "#ffffff").trim(),
    cardBorderColor: String(value.cardBorderColor || fallback.cardBorderColor || "#e5e7eb").trim(),
    cardRadius: Math.min(48, Math.max(0, Number(value.cardRadius ?? fallback.cardRadius ?? 16))),
    sortOrder: Number.isFinite(Number(value.sortOrder)) ? Math.floor(Number(value.sortOrder)) : index + 1,
    status: String(value.status || fallback.status || "active").toLowerCase() === "inactive" ? "inactive" : "active"
  };
}

function normalizeWhyShopItems(settings = DEFAULT_APP_SETTINGS) {
  const source = Array.isArray(settings.homepage?.whyShopItems) && settings.homepage.whyShopItems.length
    ? settings.homepage.whyShopItems
    : DEFAULT_APP_SETTINGS.homepage.whyShopItems;

  return source
    .map(normalizeWhyShopItem)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
}

function createEmptyWhyShopItem(sortOrder) {
  return normalizeWhyShopItem({
    id: `why-shop-item-${Date.now()}`,
    iconUrl: "",
    iconPosition: "left",
    iconSize: 42,
    title: "New Trust Badge",
    titleFontSize: 18,
    textColor: "#0f172a",
    cardBackgroundColor: "#ffffff",
    cardBorderColor: "#e5e7eb",
    cardRadius: 16,
    sortOrder,
    status: "active"
  });
}

function WhyShopConfigure({ section, refreshToken = 0 }) {
  const settingsKey = "whyShopSettings";
  const routeKey = "why-shop";
  const sectionLabel = "Why Shop With Avyona";
  const [settings, setSettings] = React.useState(() => cloneSettings(DEFAULT_APP_SETTINGS));
  const [sectionSettings, setSectionSettings] = React.useState(() => normalizeHomepageSectionSettings(DEFAULT_APP_SETTINGS.homepage[settingsKey], DEFAULT_APP_SETTINGS.homepage[settingsKey]));
  const [items, setItems] = React.useState(() => normalizeWhyShopItems(DEFAULT_APP_SETTINGS));
  const [persistedItemIds, setPersistedItemIds] = React.useState(() => new Set(DEFAULT_APP_SETTINGS.homepage.whyShopItems.map((item) => item.id)));
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [uploadingItemId, setUploadingItemId] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [messageTone, setMessageTone] = React.useState("success");

  React.useEffect(() => {
    let isMounted = true;

    async function loadWhyShopSettings() {
      setIsLoading(true);
      try {
        const response = await fetchWhyShopHomepage();
        if (!isMounted) return;
        const data = response.data?.data || {};
        const mergedSettings = mergeSettings(DEFAULT_APP_SETTINGS, {
          homepage: {
            [settingsKey]: data.settings,
            whyShopItems: data.items
          }
        });
        setSettings(mergedSettings);
        setSectionSettings(normalizeHomepageSectionSettings(data.settings || mergedSettings.homepage?.[settingsKey], DEFAULT_APP_SETTINGS.homepage[settingsKey]));
        setItems(normalizeWhyShopItems(mergedSettings));
        setPersistedItemIds(new Set((data.items || []).map((item) => item.id)));
        setMessage(`${sectionLabel} settings loaded.`);
        setMessageTone("success");
      } catch {
        if (!isMounted) return;
        const fallbackSettings = cloneSettings(DEFAULT_APP_SETTINGS);
        setSettings(fallbackSettings);
        setSectionSettings(normalizeHomepageSectionSettings(fallbackSettings.homepage[settingsKey], DEFAULT_APP_SETTINGS.homepage[settingsKey]));
        setItems(normalizeWhyShopItems(fallbackSettings));
        setPersistedItemIds(new Set(fallbackSettings.homepage.whyShopItems.map((item) => item.id)));
        setMessage("Showing default trust badges. Start backend and sign in as admin to save changes.");
        setMessageTone("warning");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadWhyShopSettings();
    return () => {
      isMounted = false;
    };
  }, [refreshToken]);

  const updateSectionField = (key, value) => {
    setSectionSettings((current) => ({
      ...current,
      [key]: key === "cardsPerRow"
        ? normalizeCardsPerRow(value)
        : key === "mobileCardsPerRow"
          ? normalizeMobileCardsPerRow(value)
          : key === "sortOrder"
            ? Number(value || 0)
            : value
    }));
    setMessage("");
  };

  const updateItem = (itemId, values) => {
    setItems((current) => current.map((item) => item.id === itemId ? normalizeWhyShopItem({ ...item, ...values }) : item));
    setMessage("");
  };

  const addItem = () => {
    const nextSort = Math.max(0, ...items.map((item) => Number(item.sortOrder || 0))) + 1;
    setItems((current) => [...current, createEmptyWhyShopItem(nextSort)]);
    setMessage("");
  };

  const removeItem = (itemId) => {
    setItems((current) => current.filter((item) => item.id !== itemId));
    setMessage("");
  };

  const toggleItemStatus = (itemId) => {
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, status: item.status === "active" ? "inactive" : "active" } : item));
    setMessage("");
  };

  const moveItem = (itemId, direction) => {
    setItems((current) => {
      const ordered = [...current].sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
      const currentIndex = ordered.findIndex((item) => item.id === itemId);
      const targetIndex = currentIndex + direction;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ordered.length) return current;

      const [selected] = ordered.splice(currentIndex, 1);
      ordered.splice(targetIndex, 0, selected);
      return ordered.map((item, index) => ({ ...item, sortOrder: index + 1 }));
    });
    setMessage("");
  };

  const uploadIcon = async (itemId, file) => {
    if (!file) return;
    const validationMessage = validateWhyShopIconFile(file);
    if (validationMessage) {
      setMessage(validationMessage);
      setMessageTone("warning");
      return;
    }

    setUploadingItemId(itemId);
    try {
      const response = await uploadWhyShopIcon(file);
      updateItem(itemId, { iconUrl: response.data?.data?.url || "" });
      setMessage("Icon uploaded. Save changes to publish it.");
      setMessageTone("success");
    } catch (error) {
      setMessage(error.response?.data?.message || "Icon upload failed.");
      setMessageTone("warning");
    } finally {
      setUploadingItemId("");
    }
  };

  const removeIcon = (itemId) => {
    updateItem(itemId, { iconUrl: "" });
    setMessage("Icon removed. Save changes to publish it.");
    setMessageTone("success");
  };

  const saveAll = async () => {
    const cssError = getScopedCssValidationError(sectionSettings.customCss, ".avyona-product-payment-icons");
    if (cssError) {
      setMessage(cssError);
      setMessageTone("warning");
      return;
    }
    const cleanSectionSettings = normalizeHomepageSectionSettings(sectionSettings, DEFAULT_APP_SETTINGS.homepage[settingsKey]);
    const cleanItems = items.map(normalizeWhyShopItem).sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
    const nextSettings = mergeSettings(settings, {
      homepage: {
        ...(settings.homepage || {}),
        [settingsKey]: cleanSectionSettings,
        whyShopItems: cleanItems
      }
    });

    setIsSaving(true);
    try {
      await updateWhyShopSettings(cleanSectionSettings);

      const cleanIds = new Set(cleanItems.map((item) => item.id));
      await Promise.all(
        [...persistedItemIds]
          .filter((itemId) => !cleanIds.has(itemId))
          .map((itemId) => deleteWhyShopItem(itemId))
      );

      await Promise.all(cleanItems.map((item) => (
        persistedItemIds.has(item.id)
          ? updateWhyShopItem(item.id, item)
          : createWhyShopItem(item)
      )));
      await Promise.all(cleanItems.map((item) => updateWhyShopItemStatus(item.id, item.status)));
      await reorderWhyShopItems(cleanItems.map((item) => item.id));

      const refreshedResponse = await fetchWhyShopHomepage();
      const refreshedData = refreshedResponse.data?.data || {};
      const savedSettings = mergeSettings(DEFAULT_APP_SETTINGS, {
        homepage: {
          [settingsKey]: refreshedData.settings || cleanSectionSettings,
          whyShopItems: refreshedData.items || cleanItems
        }
      });
      setSettings(savedSettings);
      setSectionSettings(normalizeHomepageSectionSettings(refreshedData.settings || cleanSectionSettings, DEFAULT_APP_SETTINGS.homepage[settingsKey]));
      setItems(normalizeWhyShopItems(savedSettings));
      setPersistedItemIds(new Set((refreshedData.items || cleanItems).map((item) => item.id)));
      setMessage(`${sectionLabel} settings and trust badges saved.`);
      setMessageTone("success");
    } catch (error) {
      setMessage(error.response?.data?.message || `${sectionLabel} settings could not be saved.`);
      setMessageTone("warning");
    } finally {
      setIsSaving(false);
    }
  };

  const previewItems = [...items]
    .filter((item) => item.status === "active")
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));

  return (
    <section className="dashboard-page-shell">
      <div style={heroStyle}>
        <span style={eyebrowStyle}>Homepage Configuration</span>
        <h2 style={titleStyle}>{section.title}</h2>
        <p style={copyStyle}>{section.description}</p>
      </div>

      <div style={whyShopPageLayoutStyle}>
        {message ? (
          <div style={{ ...feedbackStyle, ...(messageTone === "warning" ? feedbackWarningStyle : feedbackSuccessStyle) }}>
            {message}
          </div>
        ) : null}

        <div style={whyShopTopCardStyle}>
          <div>
            <span style={eyebrowStyle}>Section Settings</span>
            <h3 style={panelTitleStyle}>Homepage section controls</h3>
            <p style={panelCopyStyle}>Control visibility, heading text, layout density, ordering, and section colors.</p>
          </div>

          <div style={browseSettingsPanelStyle}>
            <label style={checkboxFieldStyle}>
              <input type="checkbox" checked={sectionSettings.enabled} onChange={(event) => updateSectionField("enabled", event.target.checked)} />
              <span>Section Enable / Disable</span>
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Section Title</span>
              <input value={sectionSettings.title} onChange={(event) => updateSectionField("title", event.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Subtitle</span>
              <input value={sectionSettings.subtitle} onChange={(event) => updateSectionField("subtitle", event.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Cards Per Row</span>
              <input type="number" min="1" max="10" value={sectionSettings.cardsPerRow} onChange={(event) => updateSectionField("cardsPerRow", event.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Mobile Cards Per Row</span>
              <input type="number" min="1" max="3" value={sectionSettings.mobileCardsPerRow} onChange={(event) => updateSectionField("mobileCardsPerRow", event.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Section Sort Order</span>
              <input type="number" value={sectionSettings.sortOrder} onChange={(event) => updateSectionField("sortOrder", event.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Section Background Color</span>
              <input type="color" value={sectionSettings.backgroundColor || "#f8fafc"} onChange={(event) => updateSectionField("backgroundColor", event.target.value)} style={colorInputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Section Text Color</span>
              <input type="color" value={sectionSettings.textColor || "#0f172a"} onChange={(event) => updateSectionField("textColor", event.target.value)} style={colorInputStyle} />
            </label>
          </div>

          <div style={settingsSaveActionStyle}>
            <button type="button" onClick={saveAll} disabled={isSaving || isLoading || Boolean(uploadingItemId)} style={saveButtonStyle}>
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        <div style={whyShopMiddleLayoutStyle}>
          <div style={whyShopItemsColumnStyle}>
            <div style={homepageArrangementBarStyle}>
              <div>
                <span style={eyebrowStyle}>Trust Items</span>
                <h3 style={panelTitleStyle}>Trust badge cards</h3>
                <p style={panelCopyStyle}>Create, style, sort, and publish the badges shown in this homepage section.</p>
              </div>
              <button type="button" onClick={addItem} style={secondaryButtonStyle}>Add Item</button>
            </div>

            <div style={whyShopGridStyle}>
              {items.map((item, index) => (
                <div key={item.id} style={whyShopEditorCardStyle}>
                  <div style={whyShopItemActionBarStyle}>
                    <span style={whyShopStatusPillStyle}>{item.status === "active" ? "Active" : "Inactive"}</span>
                    <button type="button" onClick={() => toggleItemStatus(item.id)} style={secondaryButtonStyle}>
                      {item.status === "active" ? "Set Inactive" : "Set Active"}
                    </button>
                    <button type="button" onClick={() => moveItem(item.id, -1)} disabled={index === 0} style={index === 0 ? disabledActionButtonStyle : secondaryButtonStyle}>Move Up</button>
                    <button type="button" onClick={() => moveItem(item.id, 1)} disabled={index === items.length - 1} style={index === items.length - 1 ? disabledActionButtonStyle : secondaryButtonStyle}>Move Down</button>
                    <a href={`#why-shop-editor-fields-${item.id}`} style={secondaryLinkButtonStyle}>Edit Item</a>
                    <button type="button" onClick={() => removeItem(item.id)} style={dangerButtonStyle}>Delete Item</button>
                  </div>

                  <IconUploadDropzone
                    item={item}
                    isUploading={uploadingItemId === item.id}
                    onUpload={(file) => uploadIcon(item.id, file)}
                    onRemove={() => removeIcon(item.id)}
                  />

                  <div id={`why-shop-editor-fields-${item.id}`} style={whyShopControlsStyle}>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Icon position</span>
                      <select value={item.iconPosition} onChange={(event) => updateItem(item.id, { iconPosition: event.target.value })} style={inputStyle}>
                        {ICON_POSITION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Icon size</span>
                      <input type="number" min="16" max="120" value={item.iconSize} onChange={(event) => updateItem(item.id, { iconSize: event.target.value })} style={inputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Text/title</span>
                      <input value={item.title} onChange={(event) => updateItem(item.id, { title: event.target.value })} style={inputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Text font size</span>
                      <input type="number" min="10" max="42" value={item.titleFontSize} onChange={(event) => updateItem(item.id, { titleFontSize: event.target.value })} style={inputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Text color</span>
                      <input type="color" value={item.textColor} onChange={(event) => updateItem(item.id, { textColor: event.target.value })} style={colorInputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Card background color</span>
                      <input type="color" value={item.cardBackgroundColor} onChange={(event) => updateItem(item.id, { cardBackgroundColor: event.target.value })} style={colorInputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Card border color</span>
                      <input type="color" value={item.cardBorderColor} onChange={(event) => updateItem(item.id, { cardBorderColor: event.target.value })} style={colorInputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Card radius</span>
                      <input type="number" min="0" max="48" value={item.cardRadius} onChange={(event) => updateItem(item.id, { cardRadius: event.target.value })} style={inputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Sort order</span>
                      <input type="number" value={item.sortOrder} onChange={(event) => updateItem(item.id, { sortOrder: event.target.value })} style={inputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Active / Inactive</span>
                      <select value={item.status} onChange={(event) => updateItem(item.id, { status: event.target.value })} style={inputStyle}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside style={whyShopLivePreviewPanelStyle}>
            <span style={eyebrowStyle}>Live Preview</span>
            <h3 style={panelTitleStyle}>Frontend section</h3>
            <div
              className="avyona-why-shop"
              style={{
                ...whyShopLivePreviewSectionStyle,
                background: sectionSettings.backgroundColor || "#f8fafc",
                color: sectionSettings.textColor || "#0f172a"
              }}
            >
              {sectionSettings.customCss ? <style>{sectionSettings.customCss}</style> : null}
              <div style={whyShopLivePreviewHeadingStyle}>
                <h4>{sectionSettings.title}</h4>
                {sectionSettings.subtitle ? <p>{sectionSettings.subtitle}</p> : null}
              </div>
              <div
                style={{
                  ...whyShopLivePreviewGridStyle,
                  gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, Number(sectionSettings.cardsPerRow || 4)))}, minmax(0, 1fr))`
                }}
              >
                {previewItems.length ? previewItems.map((item) => (
                  <div
                    key={item.id}
                    className={`trust-card trust-card-icon-${item.iconPosition}`}
                    style={{
                      ...whyShopLiveTrustCardStyle,
                      background: item.cardBackgroundColor,
                      borderColor: item.cardBorderColor,
                      borderRadius: `${item.cardRadius}px`,
                      color: item.textColor,
                      flexDirection: item.iconPosition === "top" ? "column" : "row-reverse",
                      ...(item.iconPosition === "left" ? { flexDirection: "row" } : {})
                    }}
                  >
                    {item.iconUrl ? (
                      <img src={resolveAdminMediaUrl(item.iconUrl)} alt="" style={{ width: `${item.iconSize}px`, height: `${item.iconSize}px`, objectFit: "contain" }} />
                    ) : (
                      <span style={{ ...whyShopIconPlaceholderStyle, width: `${item.iconSize}px`, height: `${item.iconSize}px` }}>Icon</span>
                    )}
                    <strong style={{ fontSize: `${item.titleFontSize}px`, color: item.textColor }}>{item.title}</strong>
                  </div>
                )) : (
                  <div style={emptyHomepageCategoryStyle}>No active trust badges to preview.</div>
                )}
              </div>
            </div>
          </aside>
        </div>

        <div style={whyShopCssPanelStyle}>
          <div>
            <span style={eyebrowStyle}>Advanced Design</span>
            <h3 style={panelTitleStyle}>Custom CSS</h3>
            <p style={panelCopyStyle}>Use CSS only and scope selectors under .avyona-why-shop.</p>
          </div>
          <textarea
            value={sectionSettings.customCss || ""}
            onChange={(event) => updateSectionField("customCss", event.target.value)}
            placeholder={".avyona-why-shop .trust-card {\n  border-radius: 18px;\n}"}
            style={{ ...inputStyle, minHeight: "160px", resize: "vertical", fontFamily: "Consolas, monospace" }}
          />
        </div>

        <div style={whyShopBottomActionStyle}>
          <button type="button" onClick={saveAll} disabled={isSaving || isLoading || Boolean(uploadingItemId)} style={saveButtonStyle}>
            {isSaving ? "Saving..." : "Save Why Shop Section"}
          </button>
          <Link to="/dashboard/homepage" style={backButtonStyle}>Back to Homepage Sections</Link>
        </div>
      </div>
    </section>
  );
}

function IconUploadDropzone({ item, isUploading, onUpload, onRemove }) {
  const inputId = `why-shop-icon-${item.id}`;
  const [isDragging, setIsDragging] = React.useState(false);

  const handleFiles = (files) => {
    const file = files?.[0];
    if (file) onUpload(file);
  };

  const preventDefaults = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      style={{
        ...whyShopDropzoneStyle,
        ...(isDragging ? whyShopDropzoneActiveStyle : {})
      }}
      onDragEnter={(event) => {
        preventDefaults(event);
        setIsDragging(true);
      }}
      onDragOver={(event) => {
        preventDefaults(event);
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        preventDefaults(event);
        setIsDragging(false);
      }}
      onDrop={(event) => {
        preventDefaults(event);
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <div style={whyShopIconPreviewFrameStyle}>
        {item.iconUrl ? (
          <img src={resolveAdminMediaUrl(item.iconUrl)} alt={`${item.title} icon preview`} style={whyShopIconPreviewImageStyle} />
        ) : (
          <span style={whyShopIconPreviewEmptyStyle}>Icon</span>
        )}
      </div>
      <div style={whyShopDropzoneContentStyle}>
        <span style={labelStyle}>Icon upload</span>
        <p style={panelCopyStyle}>PNG, JPG, JPEG, WebP, or sanitized SVG. Max 1 MB.</p>
        <div style={whyShopDropzoneActionsStyle}>
          <label htmlFor={inputId} style={secondaryButtonStyle}>
            {item.iconUrl ? "Replace icon" : "Click to upload"}
          </label>
          {item.iconUrl ? (
            <button type="button" onClick={onRemove} style={dangerButtonStyle}>Remove icon</button>
          ) : null}
        </div>
        {isUploading ? <small style={helperTextStyle}>Uploading...</small> : <small style={helperTextStyle}>Drag and drop upload supported.</small>}
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={(event) => handleFiles(event.target.files)}
          style={hiddenFileInputStyle}
        />
      </div>
    </div>
  );
}

function normalizeProductPaymentIcon(value = {}, index = 0) {
  const fallback = DEFAULT_APP_SETTINGS.homepage.productPaymentIcons[index] || DEFAULT_APP_SETTINGS.homepage.productPaymentIcons[0] || {};

  return {
    id: value.id || `payment-icon-${Date.now()}-${index}`,
    paymentName: String(value.paymentName || value.name || fallback.paymentName || "Payment").trim(),
    iconUrl: String(value.iconUrl || fallback.iconUrl || "").trim(),
    altText: String(value.altText || fallback.altText || "").trim(),
    iconSize: Math.min(120, Math.max(16, Number(value.iconSize || fallback.iconSize || 44))),
    iconBackgroundColor: String(value.iconBackgroundColor || fallback.iconBackgroundColor || "#ffffff").trim(),
    iconBorderColor: String(value.iconBorderColor || fallback.iconBorderColor || "#e5e7eb").trim(),
    iconRadius: Math.min(48, Math.max(0, Number(value.iconRadius ?? fallback.iconRadius ?? 14))),
    sortOrder: Number.isFinite(Number(value.sortOrder)) ? Math.floor(Number(value.sortOrder)) : index + 1,
    status: String(value.status || fallback.status || "active").toLowerCase() === "inactive" ? "inactive" : "active"
  };
}

function normalizeProductPaymentIcons(settings = DEFAULT_APP_SETTINGS) {
  const source = Array.isArray(settings.homepage?.productPaymentIcons) && settings.homepage.productPaymentIcons.length
    ? settings.homepage.productPaymentIcons
    : DEFAULT_APP_SETTINGS.homepage.productPaymentIcons;

  return source
    .map(normalizeProductPaymentIcon)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
}

function createEmptyProductPaymentIcon(sortOrder) {
  return normalizeProductPaymentIcon({
    id: `payment-icon-${Date.now()}`,
    paymentName: "New Payment",
    iconUrl: "",
    altText: "Payment option",
    iconSize: 44,
    iconBackgroundColor: "#ffffff",
    iconBorderColor: "#e5e7eb",
    iconRadius: 14,
    sortOrder,
    status: "active"
  });
}

function ProductPaymentIconsConfigure({ section, refreshToken = 0 }) {
  const settingsKey = "productPaymentIconsSettings";
  const routeKey = "product-payment-icons";
  const sectionLabel = "Product Payment Icons";
  const [settings, setSettings] = React.useState(() => cloneSettings(DEFAULT_APP_SETTINGS));
  const [sectionSettings, setSectionSettings] = React.useState(() => normalizeHomepageSectionSettings(DEFAULT_APP_SETTINGS.homepage[settingsKey], DEFAULT_APP_SETTINGS.homepage[settingsKey]));
  const [items, setItems] = React.useState(() => normalizeProductPaymentIcons(DEFAULT_APP_SETTINGS));
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [uploadingItemId, setUploadingItemId] = React.useState("");
  const [persistedItemIds, setPersistedItemIds] = React.useState(() => new Set(DEFAULT_APP_SETTINGS.homepage.productPaymentIcons.map((item) => item.id)));
  const [message, setMessage] = React.useState("");
  const [messageTone, setMessageTone] = React.useState("success");

  React.useEffect(() => {
    let isMounted = true;

    async function loadPaymentIcons() {
      setIsLoading(true);
      try {
        const [settingsResponse, sectionResponse] = await Promise.all([
          fetchAdminSettings(),
          fetchProductPaymentIconsHomepage()
        ]);
        if (!isMounted) return;
        const mergedSettings = mergeSettings(DEFAULT_APP_SETTINGS, settingsResponse.data?.data || {});
        const data = sectionResponse.data?.data || {};
        setSettings(mergedSettings);
        setSectionSettings(normalizeHomepageSectionSettings(data.settings || mergedSettings.homepage?.[settingsKey], DEFAULT_APP_SETTINGS.homepage[settingsKey]));
        const loadedItems = Array.isArray(data.items) ? data.items.map(normalizeProductPaymentIcon) : normalizeProductPaymentIcons(mergedSettings);
        setItems(loadedItems);
        setPersistedItemIds(new Set(loadedItems.map((item) => item.id)));
        setMessage(`${sectionLabel} settings loaded.`);
        setMessageTone("success");
      } catch {
        if (!isMounted) return;
        const fallbackSettings = cloneSettings(DEFAULT_APP_SETTINGS);
        setSettings(fallbackSettings);
        setSectionSettings(normalizeHomepageSectionSettings(fallbackSettings.homepage[settingsKey], DEFAULT_APP_SETTINGS.homepage[settingsKey]));
        setItems(normalizeProductPaymentIcons(fallbackSettings));
        setPersistedItemIds(new Set(DEFAULT_APP_SETTINGS.homepage.productPaymentIcons.map((item) => item.id)));
        setMessage("Showing default payment icons. Start backend and sign in as admin to save changes.");
        setMessageTone("warning");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadPaymentIcons();
    return () => {
      isMounted = false;
    };
  }, [refreshToken]);

  const updateSectionField = (key, value) => {
    setSectionSettings((current) => ({
      ...current,
      [key]: key === "cardsPerRow"
        ? normalizeCardsPerRow(value)
        : key === "mobileCardsPerRow"
          ? normalizeMobileCardsPerRow(value)
          : key === "sortOrder"
            ? Number(value || 0)
            : value
    }));
    setMessage("");
  };

  const updateItem = (itemId, values) => {
    setItems((current) => current.map((item) => item.id === itemId ? normalizeProductPaymentIcon({ ...item, ...values }) : item));
    setMessage("");
  };

  const addItem = () => {
    const nextSort = Math.max(0, ...items.map((item) => Number(item.sortOrder || 0))) + 1;
    setItems((current) => [...current, createEmptyProductPaymentIcon(nextSort)]);
    setMessage("");
  };

  const removeItem = (itemId) => {
    setItems((current) => current.filter((item) => item.id !== itemId));
    setMessage("Payment icon removed from this draft. Save changes to publish it.");
    setMessageTone("success");
  };

  const toggleItemStatus = (itemId) => {
    const existing = items.find((item) => item.id === itemId);
    const nextStatus = existing?.status === "active" ? "inactive" : "active";
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, status: nextStatus } : item));
    setMessage("Payment icon status changed in this draft. Save changes to publish it.");
    setMessageTone("success");
  };

  const moveItem = (itemId, direction) => {
    setItems((current) => {
      const ordered = [...current].sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
      const currentIndex = ordered.findIndex((item) => item.id === itemId);
      const targetIndex = currentIndex + direction;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ordered.length) return current;
      const [selected] = ordered.splice(currentIndex, 1);
      ordered.splice(targetIndex, 0, selected);
      return ordered.map((item, index) => ({ ...item, sortOrder: index + 1 }));
    });
    setMessage("");
  };

  const uploadIcon = async (itemId, file) => {
    if (!file) return;
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
    if (!allowedTypes.has(file.type)) {
      setMessage("Only PNG, JPG, JPEG, WebP, and sanitized SVG payment icons are allowed.");
      setMessageTone("warning");
      return;
    }
    if (file.size > 1024 * 1024) {
      setMessage("Payment icon must be 1 MB or smaller.");
      setMessageTone("warning");
      return;
    }
    setUploadingItemId(itemId);
    try {
      const response = await uploadPaymentIcon(file);
      updateItem(itemId, { iconUrl: response.data?.data?.url || "" });
      setMessage("Payment icon uploaded. Save changes to publish it.");
      setMessageTone("success");
    } catch (error) {
      setMessage(error.response?.data?.message || "Payment icon upload failed.");
      setMessageTone("warning");
    } finally {
      setUploadingItemId("");
    }
  };

  const removeIcon = (itemId) => {
    updateItem(itemId, { iconUrl: "" });
    setMessage("Icon removed. Save changes to publish it.");
    setMessageTone("success");
  };

  const saveAll = async () => {
    const cleanSectionSettings = normalizeHomepageSectionSettings(sectionSettings, DEFAULT_APP_SETTINGS.homepage[settingsKey]);
    const cleanItems = items.map(normalizeProductPaymentIcon).sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
    const nextSettings = mergeSettings(settings, {
      homepage: {
        ...(settings.homepage || {}),
        [settingsKey]: cleanSectionSettings,
        productPaymentIcons: cleanItems
      }
    });

    setIsSaving(true);
    try {
      const saveResponse = await saveProductPaymentIconsHomepage({
        settings: cleanSectionSettings,
        items: cleanItems
      });
      const data = saveResponse.data?.data || {};
      const settingsResponse = { data: { data: mergeSettings(nextSettings, {
        homepage: {
          productPaymentIconsSettings: data.settings || cleanSectionSettings,
          productPaymentIcons: data.items || cleanItems
        }
      }) } };
      const savedSettings = mergeSettings(DEFAULT_APP_SETTINGS, settingsResponse.data?.data || nextSettings);
      setSettings(savedSettings);
      setSectionSettings(normalizeHomepageSectionSettings(data.settings || sectionResponse.data?.data || cleanSectionSettings, DEFAULT_APP_SETTINGS.homepage[settingsKey]));
      const refreshedItems = Array.isArray(data.items) ? data.items.map(normalizeProductPaymentIcon) : normalizeProductPaymentIcons(savedSettings);
      setItems(refreshedItems);
      setPersistedItemIds(new Set(refreshedItems.map((item) => item.id)));
      setMessage(`${sectionLabel} settings saved.`);
      setMessageTone("success");
    } catch (error) {
      setMessage(error.response?.data?.message || `${sectionLabel} settings could not be saved.`);
      setMessageTone("warning");
    } finally {
      setIsSaving(false);
    }
  };

  const activeItems = items.filter((item) => item.status === "active").sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
  const customCssError = getScopedCssValidationError(sectionSettings.customCss, ".avyona-product-payment-icons");
  const previewCustomCss = customCssError ? "" : String(sectionSettings.customCss || "");
  const renderPaymentPreviewItems = () => activeItems.length ? activeItems.map((item) => (
    <div key={item.id} className="payment-icon-card" style={{
      ...paymentPreviewIconStyle,
      background: item.iconBackgroundColor,
      borderColor: item.iconBorderColor,
      borderRadius: `${item.iconRadius}px`
    }}>
      {item.iconUrl ? <img src={resolveAdminMediaUrl(item.iconUrl)} alt={item.altText || item.paymentName} style={{ width: `${item.iconSize}px`, height: `${item.iconSize}px`, objectFit: "contain" }} /> : <strong>{item.paymentName}</strong>}
    </div>
  )) : (
    <div style={emptyHomepageCategoryStyle}>No active payment icons to preview.</div>
  );

  return (
    <section className="dashboard-page-shell">
      <div style={heroStyle}>
        <span style={eyebrowStyle}>Homepage Configuration</span>
        <h2 style={titleStyle}>{section.title}</h2>
        <p style={copyStyle}>{section.description}</p>
      </div>

      <div style={whyShopPageLayoutStyle}>
        {message ? (
          <div style={{ ...feedbackStyle, ...(messageTone === "warning" ? feedbackWarningStyle : feedbackSuccessStyle) }}>
            {message}
          </div>
        ) : null}

        <div style={whyShopTopCardStyle}>
          <div>
            <span style={eyebrowStyle}>Section Settings</span>
            <h3 style={panelTitleStyle}>Product page payment options</h3>
            <p style={panelCopyStyle}>Control visibility, heading text, icon grid layout, ordering, and section colors.</p>
          </div>

          <div style={browseSettingsPanelStyle}>
            <label style={checkboxFieldStyle}>
              <input type="checkbox" checked={sectionSettings.enabled} onChange={(event) => updateSectionField("enabled", event.target.checked)} />
              <span>Section Enable / Disable</span>
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Section Title</span>
              <input value={sectionSettings.title} onChange={(event) => updateSectionField("title", event.target.value)} placeholder="Payment Options" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Section Subtitle</span>
              <input value={sectionSettings.subtitle} onChange={(event) => updateSectionField("subtitle", event.target.value)} placeholder="Secure payment methods available" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Cards/Icon Per Row</span>
              <input type="number" min="1" max="10" value={sectionSettings.cardsPerRow} onChange={(event) => updateSectionField("cardsPerRow", event.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Mobile Icons Per Row</span>
              <input type="number" min="1" max="3" value={sectionSettings.mobileCardsPerRow} onChange={(event) => updateSectionField("mobileCardsPerRow", event.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Sort Order</span>
              <input type="number" value={sectionSettings.sortOrder} onChange={(event) => updateSectionField("sortOrder", event.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Section Background Color</span>
              <input type="color" value={sectionSettings.backgroundColor || "#ffffff"} onChange={(event) => updateSectionField("backgroundColor", event.target.value)} style={colorInputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Text Color</span>
              <input type="color" value={sectionSettings.textColor || "#0f172a"} onChange={(event) => updateSectionField("textColor", event.target.value)} style={colorInputStyle} />
            </label>
          </div>
        </div>

        <div style={homepageArrangementBarStyle}>
          <div>
            <span style={eyebrowStyle}>Payment Icons</span>
            <h3 style={panelTitleStyle}>Manage icon items</h3>
            <p style={panelCopyStyle}>Add, edit, reorder, activate, or remove payment options shown on product detail pages.</p>
          </div>
          <button type="button" onClick={addItem} style={secondaryButtonStyle}>Add Icon</button>
        </div>

        <div style={whyShopMiddleLayoutStyle}>
          <div style={whyShopItemsColumnStyle}>
            <div style={paymentIconGridStyle}>
              {items.map((item, index) => (
                <div key={item.id} style={whyShopEditorCardStyle}>
                  <div style={whyShopItemActionBarStyle}>
                    <span style={whyShopStatusPillStyle}>{item.status === "active" ? "Active" : "Inactive"}</span>
                    <a href={`#payment-icon-editor-fields-${item.id}`} style={secondaryLinkButtonStyle}>Edit Icon</a>
                    <a href="#product-payment-icons-preview" style={secondaryLinkButtonStyle}>Preview</a>
                    <button type="button" onClick={() => toggleItemStatus(item.id)} style={secondaryButtonStyle}>{item.status === "active" ? "Set Inactive" : "Set Active"}</button>
                    <button type="button" onClick={() => moveItem(item.id, -1)} disabled={index === 0} style={index === 0 ? disabledActionButtonStyle : secondaryButtonStyle}>Move Up</button>
                    <button type="button" onClick={() => moveItem(item.id, 1)} disabled={index === items.length - 1} style={index === items.length - 1 ? disabledActionButtonStyle : secondaryButtonStyle}>Move Down</button>
                    <button type="button" onClick={() => removeItem(item.id)} style={dangerButtonStyle}>Delete</button>
                  </div>

                  <PaymentIconUploadDropzone
                    item={item}
                    isUploading={uploadingItemId === item.id}
                    onUpload={(file) => uploadIcon(item.id, file)}
                    onRemove={() => removeIcon(item.id)}
                  />

                  <div id={`payment-icon-editor-fields-${item.id}`} style={whyShopControlsStyle}>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Payment Name</span>
                      <input value={item.paymentName} onChange={(event) => updateItem(item.id, { paymentName: event.target.value })} style={inputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Icon Alt Text</span>
                      <input value={item.altText} onChange={(event) => updateItem(item.id, { altText: event.target.value })} style={inputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Icon Size</span>
                      <input type="number" min="16" max="120" value={item.iconSize} onChange={(event) => updateItem(item.id, { iconSize: event.target.value })} style={inputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Icon Background Color</span>
                      <input type="color" value={item.iconBackgroundColor} onChange={(event) => updateItem(item.id, { iconBackgroundColor: event.target.value })} style={colorInputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Icon Border Color</span>
                      <input type="color" value={item.iconBorderColor} onChange={(event) => updateItem(item.id, { iconBorderColor: event.target.value })} style={colorInputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Icon Radius</span>
                      <input type="number" min="0" max="48" value={item.iconRadius} onChange={(event) => updateItem(item.id, { iconRadius: event.target.value })} style={inputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Sort Order</span>
                      <input type="number" value={item.sortOrder} onChange={(event) => updateItem(item.id, { sortOrder: event.target.value })} style={inputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Status</span>
                      <select value={item.status} onChange={(event) => updateItem(item.id, { status: event.target.value })} style={inputStyle}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside id="product-payment-icons-preview" style={whyShopLivePreviewPanelStyle}>
            <span style={eyebrowStyle}>Live Preview</span>
            <h3 style={panelTitleStyle}>Product page section</h3>
            {previewCustomCss ? <style>{previewCustomCss}</style> : null}

            <div style={paymentPreviewStackStyle}>
              <div>
                <span style={previewLabelStyle}>Desktop Preview</span>
                <div className="avyona-product-payment-icons" style={{ ...paymentPreviewSectionStyle, background: sectionSettings.backgroundColor || "#ffffff", color: sectionSettings.textColor || "#0f172a" }}>
                  <div style={whyShopLivePreviewHeadingStyle}>
                    <h4>{sectionSettings.title}</h4>
                    {sectionSettings.subtitle ? <p>{sectionSettings.subtitle}</p> : null}
                  </div>
                  <div style={{ ...paymentPreviewGridStyle, gridTemplateColumns: `repeat(${Math.min(10, Math.max(1, Number(sectionSettings.cardsPerRow || 7)))}, minmax(0, 1fr))` }}>
                    {renderPaymentPreviewItems()}
                  </div>
                </div>
              </div>

              <div>
                <span style={previewLabelStyle}>Mobile Preview</span>
                <div style={paymentMobilePreviewShellStyle}>
                  <div className="avyona-product-payment-icons" style={{ ...paymentPreviewSectionStyle, padding: "14px", gap: "12px", background: sectionSettings.backgroundColor || "#ffffff", color: sectionSettings.textColor || "#0f172a" }}>
                    <div style={whyShopLivePreviewHeadingStyle}>
                      <h4 style={{ margin: 0, fontSize: "15px", lineHeight: 1.25 }}>{sectionSettings.title}</h4>
                      {sectionSettings.subtitle ? <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.35 }}>{sectionSettings.subtitle}</p> : null}
                    </div>
                    <div style={{ ...paymentPreviewGridStyle, gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, Number(sectionSettings.mobileCardsPerRow || 3)))}, minmax(0, 1fr))`, gap: "8px" }}>
                      {renderPaymentPreviewItems()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <div style={whyShopCssPanelStyle}>
          <div>
            <span style={eyebrowStyle}>Advanced Design</span>
            <h3 style={panelTitleStyle}>Custom CSS</h3>
            <p style={panelCopyStyle}>Use CSS only and scope selectors under .avyona-product-payment-icons.</p>
          </div>
          <textarea
            value={sectionSettings.customCss || ""}
            onChange={(event) => updateSectionField("customCss", event.target.value)}
            placeholder={".avyona-product-payment-icons .payment-icon-card {\n  border-radius: 18px;\n}"}
            style={{ ...inputStyle, minHeight: "160px", resize: "vertical", fontFamily: "Consolas, monospace" }}
          />
          {customCssError ? <small style={{ ...helperTextStyle, color: "#b45309" }}>{customCssError}</small> : null}
        </div>

        <div style={whyShopBottomActionStyle}>
          <button type="button" onClick={saveAll} disabled={isSaving || isLoading || Boolean(uploadingItemId)} style={saveButtonStyle}>
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
          <Link to="/dashboard/homepage" style={backButtonStyle}>Back to Homepage Sections</Link>
        </div>
      </div>
    </section>
  );
}

function PaymentIconUploadDropzone({ item, isUploading, onUpload, onRemove }) {
  const inputId = `payment-icon-upload-${item.id}`;
  const [isDragging, setIsDragging] = React.useState(false);

  const handleFiles = (files) => {
    const file = files?.[0];
    if (file) onUpload(file);
  };

  const preventDefaults = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      style={{
        ...whyShopDropzoneStyle,
        ...(isDragging ? whyShopDropzoneActiveStyle : {})
      }}
      onDragEnter={(event) => {
        preventDefaults(event);
        setIsDragging(true);
      }}
      onDragOver={(event) => {
        preventDefaults(event);
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        preventDefaults(event);
        setIsDragging(false);
      }}
      onDrop={(event) => {
        preventDefaults(event);
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <div style={whyShopIconPreviewFrameStyle}>
        {item.iconUrl ? (
          <img src={resolveAdminMediaUrl(item.iconUrl)} alt={item.altText || item.paymentName} style={whyShopIconPreviewImageStyle} />
        ) : (
          <span style={whyShopIconPreviewEmptyStyle}>Icon</span>
        )}
      </div>
      <div style={whyShopDropzoneContentStyle}>
        <span style={labelStyle}>Payment Icon Upload</span>
        <p style={panelCopyStyle}>PNG, JPG, JPEG, WebP, or sanitized SVG. Max 1 MB.</p>
        <div style={whyShopDropzoneActionsStyle}>
          <label htmlFor={inputId} style={secondaryButtonStyle}>{item.iconUrl ? "Replace Image" : "Click to Upload"}</label>
          {item.iconUrl ? <button type="button" onClick={onRemove} style={dangerButtonStyle}>Remove Image</button> : null}
        </div>
        {isUploading ? <small style={helperTextStyle}>Uploading...</small> : <small style={helperTextStyle}>Drag and drop upload supported.</small>}
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
          style={hiddenFileInputStyle}
        />
      </div>
    </div>
  );
}

function createEmptyBrandEntry(sortOrder) {
  return {
    id: `featured-brand-${Date.now()}`,
    name: "",
    logoUrl: "",
    status: "active",
    sortOrder
  };
}

function normalizeFeaturedBrands(settings) {
  const configured = Array.isArray(settings.homepage?.featuredBrands) ? settings.homepage.featuredBrands : [];
  const fallbackBrands = ["sony", "KODAK", "JBL", "AKG", "WYZE", "GLOCUENT"].map(createDefaultBrandEntry);
  const source = configured.length ? configured : fallbackBrands;

  return source
    .map((brand, index) => ({
      ...createEmptyBrandEntry(index + 1),
      ...brand,
      id: brand.id || `featured-brand-${String(brand.name || index).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      status: String(brand.status || "active").toLowerCase() === "inactive" ? "inactive" : "active",
      sortOrder: Number(brand.sortOrder || index + 1)
    }))
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
}

function FeaturedBrandsConfigure({ section, refreshToken = 0 }) {
  const [settings, setSettings] = React.useState(() => cloneSettings(DEFAULT_APP_SETTINGS));
  const [sectionSettings, setSectionSettings] = React.useState(() => normalizeHomepageSectionSettings(DEFAULT_APP_SETTINGS.homepage.featuredBrandsSettings, DEFAULT_APP_SETTINGS.homepage.featuredBrandsSettings));
  const [brands, setBrands] = React.useState(() => normalizeFeaturedBrands(DEFAULT_APP_SETTINGS));
  const [expandedBrandId, setExpandedBrandId] = React.useState("");
  const [uploadingBrandId, setUploadingBrandId] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [messageTone, setMessageTone] = React.useState("success");

  React.useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      setIsLoading(true);
      try {
        const [response, sectionSettingsResponse] = await Promise.all([
          fetchAdminSettings(),
          fetchHomepageSectionSettings("featured-brands")
        ]);
        if (!isMounted) return;
        const mergedSettings = mergeSettings(DEFAULT_APP_SETTINGS, response.data?.data || {});
        const nextBrands = normalizeFeaturedBrands(mergedSettings);
        setSettings(mergedSettings);
        setSectionSettings(normalizeHomepageSectionSettings(sectionSettingsResponse.data?.data || mergedSettings.homepage?.featuredBrandsSettings, DEFAULT_APP_SETTINGS.homepage.featuredBrandsSettings));
        setBrands(nextBrands);
        setExpandedBrandId(nextBrands[0]?.id || "");
        setMessage("Featured brands loaded from admin settings.");
        setMessageTone("success");
      } catch {
        if (!isMounted) return;
        const fallbackSettings = cloneSettings(DEFAULT_APP_SETTINGS);
        const nextBrands = normalizeFeaturedBrands(fallbackSettings);
        setSettings(fallbackSettings);
        setSectionSettings(normalizeHomepageSectionSettings(fallbackSettings.homepage.featuredBrandsSettings, DEFAULT_APP_SETTINGS.homepage.featuredBrandsSettings));
        setBrands(nextBrands);
        setExpandedBrandId(nextBrands[0]?.id || "");
        setMessage("Showing default brands. Start backend and sign in as admin to save changes.");
        setMessageTone("warning");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [refreshToken]);

  const updateBrand = (brandId, values) => {
    setBrands((current) => current.map((brand) => brand.id === brandId ? { ...brand, ...values } : brand));
  };

  const handleAddBrand = () => {
    const nextBrand = createEmptyBrandEntry(brands.length + 1);
    setBrands((current) => [...current, nextBrand]);
    setExpandedBrandId(nextBrand.id);
  };

  const handleDeleteBrand = (brandId) => {
    setBrands((current) => current.filter((brand) => brand.id !== brandId));
    setExpandedBrandId((current) => current === brandId ? "" : current);
  };

  const moveBrand = (brandId, direction) => {
    setBrands((current) => {
      const ordered = [...current].sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
      const currentIndex = ordered.findIndex((brand) => brand.id === brandId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ordered.length) return current;
      const [brand] = ordered.splice(currentIndex, 1);
      ordered.splice(nextIndex, 0, brand);
      return ordered.map((entry, index) => ({ ...entry, sortOrder: index + 1 }));
    });
  };

  const handleBrandLogoUpload = async (brandId, file) => {
    if (!file) return;
    setUploadingBrandId(brandId);

    try {
      const response = await uploadAdminImage(file);
      const uploadedUrl = response.data?.data?.url || "";
      const imageUrl = toStoredUploadUrl(uploadedUrl);
      if (!imageUrl) throw new Error("Image upload did not return a URL");
      updateBrand(brandId, { logoUrl: imageUrl });
      setMessage("Brand logo uploaded successfully.");
      setMessageTone("success");
    } catch {
      try {
        const compressedImage = await compressImageFile(file, 900, 0.82);
        updateBrand(brandId, { logoUrl: compressedImage });
        setMessage("Backend upload is unavailable, so the logo was added locally for preview.");
        setMessageTone("warning");
      } catch {
        setMessage("Brand logo could not be added. Please try a smaller image.");
        setMessageTone("warning");
      }
    } finally {
      setUploadingBrandId("");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const nextBrands = brands
      .map((brand, index) => ({
        id: brand.id,
        name: String(brand.name || "").trim(),
        logoUrl: String(brand.logoUrl || "").trim(),
        status: brand.status === "inactive" ? "inactive" : "active",
        sortOrder: Number(brand.sortOrder || index + 1)
      }))
      .filter((brand) => brand.name || brand.logoUrl)
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));

    const nextSettings = mergeSettings(settings, {
      homepage: {
        ...(settings.homepage || {}),
        featuredBrands: nextBrands
      }
    });

    try {
      const response = await updateAdminSettings({ settings: nextSettings });
      const savedSettings = mergeSettings(DEFAULT_APP_SETTINGS, response.data?.data || nextSettings);
      setSettings(savedSettings);
      setBrands(normalizeFeaturedBrands(savedSettings));
      setMessage("Featured brands saved. Frontend will show active brand logos by sort order.");
      setMessageTone("success");
    } catch {
      setSettings(nextSettings);
      setBrands(nextBrands);
      setMessage("Saved locally on this page only. Backend/admin login is required for frontend preview to update.");
      setMessageTone("warning");
    } finally {
      setIsSaving(false);
    }
  };

  const updateSectionSettingsField = (key, value) => {
    setSectionSettings((current) => ({
      ...current,
      [key]: key === "cardsPerRow"
        ? normalizeCardsPerRow(value)
        : key === "mobileCardsPerRow"
          ? normalizeMobileCardsPerRow(value)
          : key === "sortOrder"
            ? Number(value || 0)
            : value
    }));
    setMessage("");
  };

  const saveSectionSettings = async () => {
    const payload = normalizeHomepageSectionSettings(sectionSettings, DEFAULT_APP_SETTINGS.homepage.featuredBrandsSettings);
    setIsSaving(true);
    try {
      const response = await updateHomepageSectionSettings("featured-brands", payload);
      const saved = normalizeHomepageSectionSettings(response.data?.data || payload, DEFAULT_APP_SETTINGS.homepage.featuredBrandsSettings);
      setSectionSettings(saved);
      setSettings((current) => mergeSettings(current, { homepage: { ...(current.homepage || {}), featuredBrandsSettings: saved } }));
      setMessage("Featured Brands section settings saved.");
      setMessageTone("success");
    } catch (error) {
      setMessage(error.response?.data?.message || "Featured Brands section settings could not be saved.");
      setMessageTone("warning");
    } finally {
      setIsSaving(false);
    }
  };

  const activeCount = brands.filter((brand) => brand.status === "active").length;

  return (
    <section className="dashboard-page-shell">
      <div style={heroStyle}>
        <span style={eyebrowStyle}>Homepage Configuration</span>
        <h2 style={titleStyle}>{section.title}</h2>
        <p style={copyStyle}>Arrange and manage brand logo icons shown in the homepage Featured Brands section.</p>
      </div>

      <div style={panelStyle}>
        <div style={actionBarStyle}>
          <div>
            <span style={eyebrowStyle}>Brand Logos</span>
            <h3 style={panelTitleStyle}>Featured Brand Management</h3>
            <p style={panelCopyStyle}>Upload, edit, arrange, activate, deactivate, add, and delete brand logo icons.</p>
          </div>
          <div style={actionGroupStyle}>
            <span style={summaryPillStyle}>{`${activeCount} Active`}</span>
            <span style={summaryPillStyle}>{`${brands.length} Total`}</span>
            <button type="button" onClick={handleAddBrand} style={secondaryButtonStyle}>Add New Brand</button>
            <button type="button" onClick={handleSave} disabled={isSaving || isLoading} style={saveButtonStyle}>
              {isSaving ? "Saving..." : "Save Featured Brands"}
            </button>
          </div>
        </div>

        {message ? (
          <div style={{ ...feedbackStyle, ...(messageTone === "warning" ? feedbackWarningStyle : feedbackSuccessStyle) }}>
            {message}
          </div>
        ) : null}

        <div style={browseSettingsPanelStyle}>
          <label style={checkboxFieldStyle}>
            <input type="checkbox" checked={sectionSettings.enabled} onChange={(event) => updateSectionSettingsField("enabled", event.target.checked)} />
            <span>Section Enable / Disable</span>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Section Title</span>
            <input value={sectionSettings.title} onChange={(event) => updateSectionSettingsField("title", event.target.value)} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Section Subtitle</span>
            <input value={sectionSettings.subtitle} onChange={(event) => updateSectionSettingsField("subtitle", event.target.value)} style={inputStyle} placeholder="Optional helper text" />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Cards Per Row</span>
            <select value={sectionSettings.cardsPerRow} onChange={(event) => updateSectionSettingsField("cardsPerRow", event.target.value)} style={inputStyle}>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Mobile Cards Per Row</span>
            <select value={sectionSettings.mobileCardsPerRow} onChange={(event) => updateSectionSettingsField("mobileCardsPerRow", event.target.value)} style={inputStyle}>
              {[1, 2, 3].map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Sort Order</span>
            <input type="number" value={sectionSettings.sortOrder} onChange={(event) => updateSectionSettingsField("sortOrder", event.target.value)} style={inputStyle} />
          </label>
          <div style={settingsSaveActionStyle}>
            <button type="button" onClick={saveSectionSettings} disabled={isSaving || isLoading} style={saveButtonStyle}>
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        <div style={brandListStyle}>
          {brands.map((brand, index) => (
            <article key={brand.id} style={brandCardStyle}>
              <button type="button" onClick={() => setExpandedBrandId((current) => current === brand.id ? "" : brand.id)} style={brandPreviewButtonStyle}>
                <span style={brandLogoPreviewStyle}>
                  {brand.logoUrl ? <img src={brand.logoUrl} alt={brand.name || "Brand logo"} style={brandLogoImageStyle} /> : "Logo"}
                </span>
                <span style={brandPreviewCopyStyle}>
                  <span style={eyebrowStyle}>{`Brand ${index + 1}`}</span>
                  <strong style={brandPreviewTitleStyle}>{brand.name || "Untitled Brand"}</strong>
                  <span style={bannerMetaStyle}>{`${brand.status === "active" ? "Active" : "Inactive"} | Sort ${brand.sortOrder || index + 1}`}</span>
                </span>
              </button>

              {expandedBrandId === brand.id ? (
                <div style={brandEditorStyle}>
                  <ImageUploadField
                    label="Brand Logo Icon"
                    imageUrl={brand.logoUrl}
                    isUploading={uploadingBrandId === brand.id}
                    onUpload={(file) => handleBrandLogoUpload(brand.id, file)}
                  />
                  <div style={brandEditorGridStyle}>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Brand Name</span>
                      <input value={brand.name} onChange={(event) => updateBrand(brand.id, { name: event.target.value })} placeholder="Sony" style={inputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Logo Image URL</span>
                      <input value={brand.logoUrl} onChange={(event) => updateBrand(brand.id, { logoUrl: event.target.value })} placeholder="" style={inputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Sort Order</span>
                      <input type="number" min="1" value={brand.sortOrder} onChange={(event) => updateBrand(brand.id, { sortOrder: Number(event.target.value || 0) })} style={inputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Status</span>
                      <div style={segmentedControlStyle}>
                        <button type="button" onClick={() => updateBrand(brand.id, { status: "active" })} style={{ ...segmentedButtonStyle, ...(brand.status === "active" ? segmentedButtonActiveStyle : null) }}>Active</button>
                        <button type="button" onClick={() => updateBrand(brand.id, { status: "inactive" })} style={{ ...segmentedButtonStyle, ...(brand.status === "inactive" ? segmentedButtonInactiveStyle : null) }}>Inactive</button>
                      </div>
                    </label>
                  </div>
                  <div style={homepageArrangementBarStyle}>
                    <span style={summaryPillStyle}>{`Position ${index + 1}`}</span>
                    <div style={actionGroupStyle}>
                      <button type="button" onClick={() => moveBrand(brand.id, -1)} disabled={index === 0} style={secondaryButtonStyle}>Move Up</button>
                      <button type="button" onClick={() => moveBrand(brand.id, 1)} disabled={index === brands.length - 1} style={secondaryButtonStyle}>Move Down</button>
                      <button type="button" onClick={() => setExpandedBrandId("")} style={secondaryButtonStyle}>Edit Done</button>
                      <button type="button" onClick={() => handleDeleteBrand(brand.id)} style={dangerButtonStyle}>Delete</button>
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <Link to="/dashboard/homepage" style={backButtonStyle}>Back to Homepage Sections</Link>
      </div>
    </section>
  );
}

function createEmptyBanner() {
  return {
    id: createHeroBannerId(),
    mediaType: "image",
    desktopImage: "",
    mobileImage: "",
    desktopVideo: "",
    mobileVideo: "",
    altText: "",
    title: "",
    subtitle: "",
    textEnabled: true,
    titleFontSize: 56,
    subtitleFontSize: 17,
    fontFamily: "Montserrat",
    fontStyle: "normal",
    fontWeight: "800",
    ctaEnabled: true,
    buttonText: "Shop Now",
    buttonLink: "/collections",
    status: "active",
    sortOrder: 1
  };
}

function createHeroBannerId() {
  return `hero-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getHeroSettings(settings) {
  return {
    globalCtaEnabled: Boolean(settings.homepage?.globalHeroCta?.enabled),
    globalCtaText: settings.homepage?.globalHeroCta?.buttonText || "Shop Now",
    globalCtaLink: settings.homepage?.globalHeroCta?.buttonLink || "/collections"
  };
}

function inferMediaType(banner) {
  if (banner.mediaType === "video" || banner.desktopVideo || banner.mobileVideo) return "video";
  return "image";
}

function getBannerMediaFields(banner) {
  const mediaType = inferMediaType(banner);

  if (mediaType === "video") {
    return {
      mediaType,
      primary: String(banner.desktopVideo || "").trim(),
      secondary: String(banner.mobileVideo || "").trim(),
      poster: String(banner.desktopImage || banner.mobileImage || "").trim()
    };
  }

  return {
    mediaType,
    primary: String(banner.desktopImage || "").trim(),
    secondary: String(banner.mobileImage || "").trim(),
    poster: ""
  };
}

function isTemporaryMediaUrl(value) {
  const url = String(value || "").trim();
  return url.startsWith("blob:");
}

function isPersistableHeroBanner(banner) {
  const media = getBannerMediaFields(banner);
  const urls = [media.primary, media.secondary, media.poster].filter(Boolean);

  return Boolean(media.primary || media.secondary) && urls.every((url) => !isTemporaryMediaUrl(url));
}

function normalizeBanners(settings) {
  return (settings.homepage?.heroBanners || [])
    .map((banner, index) => ({
      ...createEmptyBanner(),
      ...banner,
      id: banner.id || `hero-${Date.now()}-${index}`,
      mediaType: inferMediaType(banner),
      status: banner.status || "active",
      sortOrder: Number(banner.sortOrder || index + 1),
      titleFontSize: Number(banner.titleFontSize || 56),
      subtitleFontSize: Number(banner.subtitleFontSize || 17),
      fontFamily: banner.fontFamily || "Montserrat",
      fontStyle: banner.fontStyle || "normal",
      fontWeight: banner.fontWeight || "800",
      ctaEnabled: banner.ctaEnabled !== false,
      textEnabled: banner.textEnabled !== false
    }))
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
}

function getFontStyleValue(banner) {
  return `${banner.fontFamily || "Montserrat"}|${banner.fontStyle || "normal"}`;
}

function getFontStyleParts(value) {
  const [fontFamily = "Montserrat", fontStyle = "normal"] = String(value || "").split("|");
  return { fontFamily, fontStyle };
}

function getAdminMediaPreviewUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (url.startsWith("/im" + "ages/")) return "";
  return resolveAdminMediaUrl(url);
}

function AdminPreviewImage({ src, alt, style }) {
  const [hasError, setHasError] = React.useState(false);
  const displaySrc = getAdminMediaPreviewUrl(src);

  if (!displaySrc || hasError) {
    return (
      <span style={{ ...style, display: "grid", placeItems: "center", color: "#64748b", fontSize: "12px", fontWeight: 900 }}>
        {String(alt || "Image").slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      style={style}
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}

function HeroBannerConfigure({ section, refreshToken = 0 }) {
  const [settings, setSettings] = React.useState(() => cloneSettings(DEFAULT_APP_SETTINGS));
  const [banners, setBanners] = React.useState(() => normalizeBanners(DEFAULT_APP_SETTINGS));
  const [globalHeroCta, setGlobalHeroCta] = React.useState(() => getHeroSettings(DEFAULT_APP_SETTINGS));
  const [expandedBannerId, setExpandedBannerId] = React.useState("");
  const [isGlobalCtaOpen, setIsGlobalCtaOpen] = React.useState(false);
  const [newBannerDraft, setNewBannerDraft] = React.useState(null);
  const [draggedBannerId, setDraggedBannerId] = React.useState("");
  const [uploadingField, setUploadingField] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isCreatingBanner, setIsCreatingBanner] = React.useState(false);
  const [isAutoSavingSort, setIsAutoSavingSort] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [messageTone, setMessageTone] = React.useState("success");
  const isEditingRef = React.useRef(false);

  React.useEffect(() => {
    isEditingRef.current = Boolean(expandedBannerId || newBannerDraft || uploadingField || isSaving || isCreatingBanner);
  }, [expandedBannerId, newBannerDraft, uploadingField, isSaving, isCreatingBanner]);

  React.useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      if (refreshToken > 0 && isEditingRef.current) return;

      setIsLoading(true);
      try {
        const response = await fetchAdminSettings();
        if (!isMounted) return;

        const mergedSettings = mergeSettings(DEFAULT_APP_SETTINGS, response.data?.data || {});
        const nextBanners = normalizeBanners(mergedSettings);
        setSettings(mergedSettings);
        setBanners(nextBanners);
        setGlobalHeroCta(getHeroSettings(mergedSettings));
        setMessage("Hero banners loaded from backend.");
        setMessageTone("success");
      } catch {
        if (!isMounted) return;
        const fallbackSettings = cloneSettings(DEFAULT_APP_SETTINGS);
        const nextBanners = normalizeBanners(fallbackSettings);
        setSettings(fallbackSettings);
        setBanners(nextBanners);
        setGlobalHeroCta(getHeroSettings(fallbackSettings));
        setMessage("Showing default banner setup. Sign in as admin and keep backend running to save changes.");
        setMessageTone("warning");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [refreshToken]);

  const updateBanner = (bannerId, field, value) => {
    setBanners((current) =>
      current.map((banner) =>
        banner.id === bannerId
          ? { ...banner, [field]: ["sortOrder", "titleFontSize", "subtitleFontSize"].includes(field) ? Number(value || 0) : value }
          : banner
      )
    );
  };

  const updateBannerFields = (bannerId, values) => {
    setBanners((current) =>
      current.map((banner) =>
        banner.id === bannerId
          ? { ...banner, ...values }
          : banner
      )
    );
  };

  const updateBannerMediaType = (bannerId, mediaType) => {
    updateBannerFields(bannerId, {
      mediaType,
      ...(mediaType === "image" ? { desktopVideo: "", mobileVideo: "" } : {})
    });
  };

  const updateBannerFontStyle = (bannerId, value) => {
    updateBannerFields(bannerId, getFontStyleParts(value));
  };

  const handleAddBanner = () => {
    setNewBannerDraft({
      ...createEmptyBanner(),
      id: createHeroBannerId(),
      sortOrder: banners.length + 1
    });
  };

  const handleRemoveBanner = (bannerId) => {
    setBanners((current) => current.filter((banner) => banner.id !== bannerId));
    setExpandedBannerId((current) => (current === bannerId ? "" : current));
  };

  const handleDeleteBanner = async (bannerId) => {
    const banner = banners.find((item) => item.id === bannerId);
    const confirmed = window.confirm(`Delete this hero banner?\n\n${banner?.title || "Untitled banner"}`);
    if (!confirmed) return;

    const nextBanners = buildCleanHeroBanners(banners.filter((banner) => banner.id !== bannerId));
    setExpandedBannerId((current) => (current === bannerId ? "" : current));
    await persistHeroBanners(nextBanners, "Hero banner deleted.");
  };

  const handleMediaUpload = async (bannerId, field, file) => {
    if (!file) return;

    const uploadKey = `${bannerId}:${field}`;
    setUploadingField(uploadKey);
    const isVideo = file.type.startsWith("video/");
    const mediaError = validateHeroMediaFile(file, isVideo ? "video" : "image");

    if (mediaError) {
      setMessage(mediaError);
      setMessageTone("warning");
      setUploadingField("");
      return;
    }

    try {
      const response = isVideo ? await uploadAdminMedia(file) : await uploadAdminImage(file);
      const uploadedUrl = response.data?.data?.url || "";
      const mediaUrl = toStoredUploadUrl(uploadedUrl);

      if (!mediaUrl) throw new Error("Media upload did not return a URL");
      updateBannerFields(bannerId, {
        [field]: mediaUrl,
        ...(isVideo ? { mediaType: "video" } : null)
      });
      setMessage(`${isVideo ? "Video" : "Image"} uploaded successfully.`);
      setMessageTone("success");
    } catch {
      try {
        const previewUrl = isVideo ? URL.createObjectURL(file) : await compressImageFile(file, 1600, 0.82);
        updateBanner(bannerId, field, previewUrl);
        if (isVideo) updateBanner(bannerId, "mediaType", "video");
        setMessage(`Backend upload is unavailable, so the ${isVideo ? "video" : "image"} was added locally for preview.`);
        setMessageTone("warning");
      } catch {
        setMessage("Media could not be added. Please try a smaller file.");
        setMessageTone("warning");
      }
    } finally {
      setUploadingField("");
    }
  };

  const updateNewBanner = (field, value) => {
    setNewBannerDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        [field]: ["sortOrder", "titleFontSize", "subtitleFontSize"].includes(field) ? Number(value || 0) : value
      };
    });
  };

  const updateNewBannerFields = (values) => {
    setNewBannerDraft((current) => current ? { ...current, ...values } : current);
  };

  const updateNewBannerMediaType = (mediaType) => {
    updateNewBannerFields({
      mediaType,
      ...(mediaType === "image" ? { desktopVideo: "", mobileVideo: "" } : {})
    });
  };

  const updateNewBannerFontStyle = (value) => {
    updateNewBannerFields(getFontStyleParts(value));
  };

  const handleNewBannerMediaUpload = async (field, file) => {
    if (!file || !newBannerDraft) return;

    const uploadKey = `new-banner:${field}`;
    setUploadingField(uploadKey);
    const isVideo = file.type.startsWith("video/");
    const mediaError = validateHeroMediaFile(file, isVideo ? "video" : "image");

    if (mediaError) {
      setMessage(mediaError);
      setMessageTone("warning");
      setUploadingField("");
      return;
    }

    try {
      const response = isVideo ? await uploadAdminMedia(file) : await uploadAdminImage(file);
      const uploadedUrl = response.data?.data?.url || "";
      const mediaUrl = toStoredUploadUrl(uploadedUrl);

      if (!mediaUrl) throw new Error("Media upload did not return a URL");
      updateNewBannerFields({
        [field]: mediaUrl,
        ...(isVideo ? { mediaType: "video" } : null)
      });
      setMessage(`${isVideo ? "Video" : "Image"} uploaded successfully.`);
      setMessageTone("success");
    } catch {
      setMessage("Upload failed. Please make sure the backend is running, then try the image or video again.");
      setMessageTone("warning");
    } finally {
      setUploadingField("");
    }
  };

  const cleanHeroBanner = (banner, index = 0) => ({
    ...banner,
    mediaType: inferMediaType(banner),
    title: String(banner.title || "").trim(),
    subtitle: String(banner.subtitle || "").trim(),
    altText: String(banner.altText || "").trim(),
    desktopImage: String(banner.desktopImage || "").trim(),
    mobileImage: String(banner.mobileImage || "").trim(),
    desktopVideo: String(banner.desktopVideo || "").trim(),
    mobileVideo: String(banner.mobileVideo || "").trim(),
    buttonText: String(banner.buttonText || "").trim(),
    buttonLink: String(banner.buttonLink || "").trim() || "/collections",
    startDate: String(banner.startDate || "").trim(),
    endDate: String(banner.endDate || "").trim(),
    titleFontSize: Number(banner.titleFontSize || 56),
    subtitleFontSize: Number(banner.subtitleFontSize || 17),
    fontFamily: String(banner.fontFamily || "Montserrat").trim(),
    fontStyle: String(banner.fontStyle || "normal").trim(),
    fontWeight: String(banner.fontWeight || "800").trim(),
    status: banner.status === "inactive" ? "inactive" : "active",
    sortOrder: Number(banner.sortOrder || index + 1)
  });

  const buildCleanHeroBanners = (sourceBanners, { dropInvalid = true } = {}) =>
    sourceBanners
      .map(cleanHeroBanner)
      .filter((banner) => !dropInvalid || isPersistableHeroBanner(banner) || banner.status === "inactive")
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
      .map((banner, index) => ({ ...banner, sortOrder: index + 1 }));

  const validateHeroBanner = (banner) => {
    const cleanedBanner = cleanHeroBanner(banner);

    if (!cleanedBanner.title) return "Banner title is required.";
    if (cleanedBanner.status === "active" && !isPersistableHeroBanner(cleanedBanner)) {
      return "Active hero banners need a desktop or mobile image/video.";
    }
    if (!isSafeLink(cleanedBanner.buttonLink)) {
      return "Button link must be an internal path starting with / or a valid https:// URL.";
    }
    if (cleanedBanner.startDate && cleanedBanner.endDate && new Date(cleanedBanner.endDate) < new Date(cleanedBanner.startDate)) {
      return "Banner end date must be after the start date.";
    }

    return "";
  };

  const persistHeroBanners = async (nextBanners, successMessage) => {
    const nextSettings = mergeSettings(settings, {
      homepage: {
        ...(settings.homepage || {}),
        heroBanners: nextBanners,
        globalHeroCta: {
          enabled: Boolean(globalHeroCta.globalCtaEnabled),
          buttonText: String(globalHeroCta.globalCtaText || "").trim() || "Shop Now",
          buttonLink: String(globalHeroCta.globalCtaLink || "").trim() || "/collections"
        }
      }
    });

    try {
      const response = await updateAdminSettings({ settings: nextSettings });
      const savedSettings = mergeSettings(DEFAULT_APP_SETTINGS, response.data?.data || nextSettings);
      setSettings(savedSettings);
      setBanners(normalizeBanners(savedSettings));
      setGlobalHeroCta(getHeroSettings(savedSettings));
      setMessage(successMessage);
      setMessageTone("success");
      return true;
    } catch {
      setSettings(nextSettings);
      setBanners(nextBanners);
      setMessage("Saved locally on this page only. Backend/admin login is required for frontend preview to update.");
      setMessageTone("warning");
      return false;
    }
  };

  const handleCreateBanner = async () => {
    if (!newBannerDraft || isCreatingBanner) return;

    const validationMessage = validateHeroBanner(newBannerDraft);
    if (validationMessage) {
      setMessage(validationMessage);
      setMessageTone("warning");
      return;
    }

    setIsCreatingBanner(true);
    const nextBanners = buildCleanHeroBanners([...banners, newBannerDraft]);
    await persistHeroBanners(nextBanners, "New hero banner saved. It will now appear on the website homepage.");
    setNewBannerDraft(null);
    setExpandedBannerId("");
    setIsCreatingBanner(false);
  };

  const handleSave = async () => {
    setIsSaving(true);

    const invalidBannerMessage = banners.map(validateHeroBanner).find(Boolean);
    if (invalidBannerMessage) {
      setMessage(invalidBannerMessage);
      setMessageTone("warning");
      setIsSaving(false);
      return;
    }

    const nextBanners = buildCleanHeroBanners(banners);
    await persistHeroBanners(nextBanners, "Hero banners saved. Frontend will show active banners sorted by sort order.");
    setIsSaving(false);
  };

  const handleSaveGlobalCta = async () => {
    if (isSaving) return;

    setIsSaving(true);
    const nextBanners = buildCleanHeroBanners(banners, { dropInvalid: false });
    const didSave = await persistHeroBanners(nextBanners, "Changes successfully completed.");
    if (didSave) {
      window.setTimeout(() => {
        setIsGlobalCtaOpen(false);
      }, 1200);
    }
    setIsSaving(false);
  };

  const handleSaveBanner = async (bannerId) => {
    if (isSaving) return;

    const banner = banners.find((item) => item.id === bannerId);
    if (!banner) return;

    const cleanedBanner = cleanHeroBanner(banner, banners.findIndex((item) => item.id === bannerId));
    const validationMessage = validateHeroBanner(cleanedBanner);
    if (validationMessage) {
      setMessage(validationMessage);
      setMessageTone("warning");
      return;
    }

    setIsSaving(true);
    const nextBanners = buildCleanHeroBanners(
      banners.map((item, index) => (item.id === bannerId ? cleanHeroBanner(banner, index) : item)),
      { dropInvalid: false }
    );
    const didSave = await persistHeroBanners(nextBanners, "Changes successfully completed.");
    if (didSave) {
      window.setTimeout(() => {
        setExpandedBannerId((current) => (current === bannerId ? "" : current));
      }, 1200);
    }
    setIsSaving(false);
  };

  const handleBannerStatus = async (bannerId, status) => {
    const nextBanners = banners.map((banner) =>
      banner.id === bannerId ? { ...banner, status } : banner
    );
    setBanners(nextBanners);
    setIsAutoSavingSort(true);
    await persistHeroBanners(
      buildCleanHeroBanners(nextBanners, { dropInvalid: false }),
      `Hero banner marked ${status}.`
    );
    setIsAutoSavingSort(false);
  };

  const saveBannerOrder = async (nextBanners) => {
    const sequencedBanners = nextBanners.map((banner, index) => ({ ...banner, sortOrder: index + 1 }));
    setBanners(sequencedBanners);
    setIsAutoSavingSort(true);
    await persistHeroBanners(
      buildCleanHeroBanners(sequencedBanners, { dropInvalid: false }),
      "Hero banner order auto-saved."
    );
    setIsAutoSavingSort(false);
  };

  const handleDropBanner = async (targetBannerId, event) => {
    event?.preventDefault();

    if (!draggedBannerId || draggedBannerId === targetBannerId) {
      setDraggedBannerId("");
      return;
    }

    const orderedBanners = [...banners].sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
    const draggedIndex = orderedBanners.findIndex((banner) => banner.id === draggedBannerId);
    const targetIndex = orderedBanners.findIndex((banner) => banner.id === targetBannerId);

    if (draggedIndex < 0 || targetIndex < 0) {
      setDraggedBannerId("");
      return;
    }

    const [draggedBanner] = orderedBanners.splice(draggedIndex, 1);
    orderedBanners.splice(targetIndex, 0, draggedBanner);
    setDraggedBannerId("");
    await saveBannerOrder(orderedBanners);
  };

  const activeCount = banners.filter((banner) => banner.status === "active").length;

  return (
    <section className="dashboard-page-shell">
      <div style={heroStyle}>
        <span style={eyebrowStyle}>Homepage Configuration</span>
        <h2 style={titleStyle}>{section.title}</h2>
        <p style={copyStyle}>{section.description}</p>
      </div>

      <div style={panelStyle}>
        <div style={actionBarStyle}>
          <div>
            <span style={eyebrowStyle}>Hero Slider</span>
            <h3 style={panelTitleStyle}>Banner Management</h3>
            <p style={panelCopyStyle}>Controls the big slider on top of the frontend homepage.</p>
          </div>
          <div style={actionGroupStyle}>
            <span style={summaryPillStyle}>{`${activeCount} Active`}</span>
            <span style={summaryPillStyle}>{`${banners.length} Total`}</span>
            {isAutoSavingSort ? <span style={summaryPillStyle}>Auto-saving...</span> : null}
            <button type="button" onClick={handleAddBanner} style={saveButtonStyle}>Add Banner</button>
          </div>
        </div>

        {message ? (
          <div style={{ ...feedbackStyle, ...(messageTone === "warning" ? feedbackWarningStyle : feedbackSuccessStyle) }}>
            {message}
          </div>
        ) : null}

        <div style={globalCtaPanelStyle}>
          <button type="button" onClick={() => setIsGlobalCtaOpen((current) => !current)} style={collapsibleHeaderButtonStyle}>
            <span style={collapsibleTitleBlockStyle}>
              <strong>Global CTA Settings</strong>
              <small>{globalHeroCta.globalCtaEnabled ? `Enabled | ${globalHeroCta.globalCtaText}` : "Disabled"}</small>
            </span>
            <span style={summaryPillStyle}>{isGlobalCtaOpen ? "Close" : "Open"}</span>
          </button>
          {isGlobalCtaOpen ? (
            <div style={collapsibleBodyStyle}>
              <label style={compactToggleStyle}>
                <input
                  type="checkbox"
                  checked={globalHeroCta.globalCtaEnabled}
                  onChange={(event) => setGlobalHeroCta((current) => ({ ...current, globalCtaEnabled: event.target.checked }))}
                />
                <span>Enable one CTA button for all slides</span>
              </label>
              <div style={formGridStyle}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>All Slide Button Text</span>
                  <input
                    value={globalHeroCta.globalCtaText}
                    onChange={(event) => setGlobalHeroCta((current) => ({ ...current, globalCtaText: event.target.value }))}
                    placeholder="Shop Now"
                    style={inputStyle}
                  />
                </label>
                <PageLinkPicker
                  label="All Slide Button URL"
                  value={globalHeroCta.globalCtaLink}
                  options={PAGE_LINK_OPTIONS}
                  onChange={(value) => setGlobalHeroCta((current) => ({ ...current, globalCtaLink: value }))}
                />
              </div>
              <div style={inlineSaveBarStyle}>
                <button type="button" onClick={handleSaveGlobalCta} disabled={isSaving || isLoading} style={saveButtonStyle}>
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div style={bannerListStyle}>
          {banners.map((banner, index) => (
            <article
              key={banner.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDropBanner(banner.id, event)}
              style={{
                ...bannerCardStyle,
                ...(draggedBannerId === banner.id ? bannerCardDraggingStyle : null)
              }}
            >
              <button
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", banner.id);
                  setDraggedBannerId(banner.id);
                }}
                onDragEnd={() => setDraggedBannerId("")}
                style={bannerDragHandleStyle}
                aria-label={`Drag ${banner.title || `banner ${index + 1}`}`}
                title="Drag to reorder"
              >
                <span aria-hidden="true" style={categoryDragDotsStyle}>
                  <span style={categoryDragDotStyle} />
                  <span style={categoryDragDotStyle} />
                  <span style={categoryDragDotStyle} />
                  <span style={categoryDragDotStyle} />
                  <span style={categoryDragDotStyle} />
                  <span style={categoryDragDotStyle} />
                </span>
              </button>
              <HeroMediaPreview banner={banner} compact />
              <div style={bannerPreviewContentStyle}>
                <span style={eyebrowStyle}>{`Banner ${index + 1}`}</span>
                <strong style={bannerPreviewTitleStyle}>{banner.title || "Untitled Banner"}</strong>
                <span style={bannerMetaGroupStyle}>
                  <span>{banner.status === "active" ? "Active" : "Inactive"}</span>
                  <span>{banner.mediaType === "video" ? "Video" : "Image"}</span>
                  <span>{`Sort ${banner.sortOrder || index + 1}`}</span>
                </span>
              </div>
              <div style={bannerRowActionsStyle}>
                <span style={categoryOrderPillStyle}>{`#${index + 1}`}</span>
                <button
                  type="button"
                  onClick={() => handleBannerStatus(banner.id, banner.status === "active" ? "inactive" : "active")}
                  style={banner.status === "active" ? rowActiveButtonStyle : rowInactiveButtonStyle}
                >
                  {banner.status === "active" ? "Active" : "Inactive"}
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedBannerId((current) => (current === banner.id ? "" : banner.id))}
                  style={categoryEditButtonStyle}
                >
                  {expandedBannerId === banner.id ? "Close" : "Edit"}
                </button>
                <button type="button" onClick={() => handleDeleteBanner(banner.id)} style={rowDeleteButtonStyle}>
                  Delete
                </button>
              </div>

              {expandedBannerId === banner.id ? (
                <div style={bannerEditorStyle}>
                  <div style={bannerCardHeaderStyle}>
                    <div>
                      <h4 style={bannerTitleStyle}>Banner Details</h4>
                      <p style={panelCopyStyle}>Upload desktop/mobile images or videos, review the media, and manage text, CTA, status, and ordering.</p>
                    </div>
                    <div style={actionGroupStyle}>
                      <button type="button" onClick={() => setExpandedBannerId("")} style={secondaryButtonStyle}>Edit Done</button>
                      <button type="button" onClick={() => handleSaveBanner(banner.id)} disabled={isSaving || isLoading} style={saveButtonStyle}>
                        {isSaving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>

                  <HeroMediaPreview banner={banner} />

                  <div style={editorSectionsGridStyle}>
                    <div style={mediaTypePanelStyle}>
                      <h5 style={editorSectionTitleStyle}>Media Upload</h5>
                      <label style={fieldStyle}>
                        <span style={labelStyle}>Media Type</span>
                        <select value={banner.mediaType} onChange={(event) => updateBannerMediaType(banner.id, event.target.value)} style={inputStyle}>
                          <option value="image">Image</option>
                          <option value="video">Video</option>
                        </select>
                      </label>
                      <div style={uploadGridStyle}>
                        <MediaUploadField
                          label={banner.mediaType === "video" ? "Desktop Banner Video" : "Desktop Banner Image"}
                          accept={banner.mediaType === "video" ? "video/*" : "image/*"}
                          mediaUrl={banner.mediaType === "video" ? banner.desktopVideo : banner.desktopImage}
                          mediaType={banner.mediaType}
                          isUploading={uploadingField === `${banner.id}:${banner.mediaType === "video" ? "desktopVideo" : "desktopImage"}`}
                          onUpload={(file) => handleMediaUpload(banner.id, banner.mediaType === "video" ? "desktopVideo" : "desktopImage", file)}
                        />
                        <MediaUploadField
                          label={banner.mediaType === "video" ? "Mobile Banner Video" : "Mobile Banner Image"}
                          accept={banner.mediaType === "video" ? "video/*" : "image/*"}
                          mediaUrl={banner.mediaType === "video" ? banner.mobileVideo : banner.mobileImage}
                          mediaType={banner.mediaType}
                          isUploading={uploadingField === `${banner.id}:${banner.mediaType === "video" ? "mobileVideo" : "mobileImage"}`}
                          onUpload={(file) => handleMediaUpload(banner.id, banner.mediaType === "video" ? "mobileVideo" : "mobileImage", file)}
                        />
                      </div>
                    </div>

                    <div style={editorSectionStyle}>
                      <h5 style={editorSectionTitleStyle}>Media Details</h5>
                      <div style={compactSectionGridStyle}>
                        <label style={fieldStyle}>
                          <span style={labelStyle}>Alt Text</span>
                          <input value={banner.altText} onChange={(event) => updateBanner(banner.id, "altText", event.target.value)} placeholder="Describe the banner media" style={inputStyle} />
                        </label>
                        <label style={fieldStyle}>
                          <span style={labelStyle}>{banner.mediaType === "video" ? "Desktop Video URL" : "Desktop Image URL"}</span>
                          <input
                            value={banner.mediaType === "video" ? banner.desktopVideo : banner.desktopImage}
                            onChange={(event) => updateBanner(banner.id, banner.mediaType === "video" ? "desktopVideo" : "desktopImage", event.target.value)}
                            placeholder={banner.mediaType === "video" ? "/uploads/banner-video.mp4" : ""}
                            style={inputStyle}
                          />
                        </label>
                        <label style={fieldStyle}>
                          <span style={labelStyle}>{banner.mediaType === "video" ? "Mobile Video URL" : "Mobile Image URL"}</span>
                          <input
                            value={banner.mediaType === "video" ? banner.mobileVideo : banner.mobileImage}
                            onChange={(event) => updateBanner(banner.id, banner.mediaType === "video" ? "mobileVideo" : "mobileImage", event.target.value)}
                            placeholder={banner.mediaType === "video" ? "/uploads/banner-mobile-video.mp4" : ""}
                            style={inputStyle}
                          />
                        </label>
                      </div>
                    </div>

                    <div style={editorSectionStyle}>
                      <h5 style={editorSectionTitleStyle}>Slide Text</h5>
                      <div style={compactSectionGridStyle}>
                        <div style={fieldStyle}>
                          <span style={labelStyle}>Slide Text Status</span>
                          <label style={compactToggleStyle}>
                            <input
                              type="checkbox"
                              checked={banner.textEnabled}
                              onChange={(event) => updateBanner(banner.id, "textEnabled", event.target.checked)}
                            />
                            <span>Enable slide text</span>
                          </label>
                        </div>
                        <label style={fieldStyle}>
                          <span style={labelStyle}>Title</span>
                          <input value={banner.title} required onChange={(event) => updateBanner(banner.id, "title", event.target.value)} placeholder="Banner title" style={inputStyle} />
                        </label>
                        <label style={fieldStyle}>
                          <span style={labelStyle}>Subtitle</span>
                          <textarea value={banner.subtitle} onChange={(event) => updateBanner(banner.id, "subtitle", event.target.value)} placeholder="Banner subtitle" rows={2} style={textareaStyle} />
                        </label>
                      </div>
                    </div>

                    <div style={editorSectionStyle}>
                      <h5 style={editorSectionTitleStyle}>Typography</h5>
                      <div style={compactSectionGridStyle}>
                        <div style={pairedFieldGridStyle}>
                          <label style={fieldStyle}>
                            <span style={labelStyle}>Title Size</span>
                            <input type="number" min="20" max="96" value={banner.titleFontSize} onChange={(event) => updateBanner(banner.id, "titleFontSize", event.target.value)} style={inputStyle} />
                          </label>
                          <label style={fieldStyle}>
                            <span style={labelStyle}>Subtitle Size</span>
                            <input type="number" min="12" max="40" value={banner.subtitleFontSize} onChange={(event) => updateBanner(banner.id, "subtitleFontSize", event.target.value)} style={inputStyle} />
                          </label>
                        </div>
                        <label style={fieldStyle}>
                          <span style={labelStyle}>Font Style</span>
                          <select value={getFontStyleValue(banner)} onChange={(event) => updateBannerFontStyle(banner.id, event.target.value)} style={inputStyle}>
                            {HERO_FONT_FAMILIES.flatMap((fontFamily) => [
                              <option key={`${fontFamily}-normal`} value={`${fontFamily}|normal`}>{`${fontFamily} - Normal`}</option>,
                              <option key={`${fontFamily}-italic`} value={`${fontFamily}|italic`}>{`${fontFamily} - Italic`}</option>
                            ])}
                          </select>
                        </label>
                        <label style={fieldStyle}>
                          <span style={labelStyle}>Font Weight</span>
                          <select value={banner.fontWeight} onChange={(event) => updateBanner(banner.id, "fontWeight", event.target.value)} style={inputStyle}>
                            <option value="500">Medium</option>
                            <option value="700">Bold</option>
                            <option value="800">Extra Bold</option>
                          </select>
                        </label>
                      </div>
                    </div>

                    <div style={editorSectionStyle}>
                      <h5 style={editorSectionTitleStyle}>CTA Button</h5>
                      <div style={compactSectionGridStyle}>
                        <div style={fieldStyle}>
                          <span style={labelStyle}>CTA Status</span>
                          <label style={compactToggleStyle}>
                            <input
                              type="checkbox"
                              checked={banner.ctaEnabled}
                              disabled={globalHeroCta.globalCtaEnabled}
                              onChange={(event) => updateBanner(banner.id, "ctaEnabled", event.target.checked)}
                            />
                            <span>{globalHeroCta.globalCtaEnabled ? "Disabled by all-slide CTA" : "Enable this slide CTA"}</span>
                          </label>
                        </div>
                        <label style={fieldStyle}>
                          <span style={labelStyle}>Button Text</span>
                          <input value={banner.buttonText} disabled={globalHeroCta.globalCtaEnabled} onChange={(event) => updateBanner(banner.id, "buttonText", event.target.value)} placeholder="Shop Now" style={inputStyle} />
                        </label>
                        <PageLinkPicker
                          label="Button Link"
                          value={banner.buttonLink}
                          options={PAGE_LINK_OPTIONS}
                          onChange={(value) => updateBanner(banner.id, "buttonLink", value)}
                          disabled={globalHeroCta.globalCtaEnabled}
                        />
                        <div style={pairedFieldGridStyle}>
                          <label style={fieldStyle}>
                            <span style={labelStyle}>Start Date Optional</span>
                            <input type="date" value={banner.startDate || ""} onChange={(event) => updateBanner(banner.id, "startDate", event.target.value)} style={inputStyle} />
                          </label>
                          <label style={fieldStyle}>
                            <span style={labelStyle}>End Date Optional</span>
                            <input type="date" value={banner.endDate || ""} onChange={(event) => updateBanner(banner.id, "endDate", event.target.value)} style={inputStyle} />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div style={editorSectionStyle}>
                      <h5 style={editorSectionTitleStyle}>Publishing</h5>
                      <div style={compactSectionGridStyle}>
                        <label style={fieldStyle}>
                          <span style={labelStyle}>Sort Order</span>
                          <input type="number" min="1" value={banner.sortOrder} onChange={(event) => updateBanner(banner.id, "sortOrder", event.target.value)} style={inputStyle} />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div style={editorSaveBarStyle}>
                    <button type="button" onClick={() => setExpandedBannerId("")} style={secondaryButtonStyle}>Cancel</button>
                    <button type="button" onClick={() => handleSaveBanner(banner.id)} disabled={isSaving || isLoading} style={saveButtonStyle}>
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>

        {newBannerDraft ? (
          <div style={modalOverlayStyle} role="dialog" aria-modal="true" aria-labelledby="new-hero-banner-title">
            <div style={modalPanelStyle}>
              <div style={modalHeaderStyle}>
                <div>
                  <span style={eyebrowStyle}>New Hero Banner</span>
                  <h3 id="new-hero-banner-title" style={modalTitleStyle}>Add Banner</h3>
                  <p style={panelCopyStyle}>Upload a desktop or mobile image/video, set the text, then save it directly to the website homepage.</p>
                </div>
                <button type="button" onClick={() => setNewBannerDraft(null)} style={secondaryButtonStyle}>Close</button>
              </div>

              <HeroMediaPreview banner={newBannerDraft} />

              <div style={modalBodyGridStyle}>
                <div style={mediaTypePanelStyle}>
                  <h5 style={editorSectionTitleStyle}>Media Upload</h5>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Media Type</span>
                    <select value={newBannerDraft.mediaType} onChange={(event) => updateNewBannerMediaType(event.target.value)} style={inputStyle}>
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                    </select>
                  </label>
                  <div style={uploadGridStyle}>
                    <MediaUploadField
                      label={newBannerDraft.mediaType === "video" ? "Desktop Banner Video" : "Desktop Banner Image"}
                      accept={newBannerDraft.mediaType === "video" ? "video/*" : "image/*"}
                      mediaUrl={newBannerDraft.mediaType === "video" ? newBannerDraft.desktopVideo : newBannerDraft.desktopImage}
                      mediaType={newBannerDraft.mediaType}
                      isUploading={uploadingField === `new-banner:${newBannerDraft.mediaType === "video" ? "desktopVideo" : "desktopImage"}`}
                      onUpload={(file) => handleNewBannerMediaUpload(newBannerDraft.mediaType === "video" ? "desktopVideo" : "desktopImage", file)}
                    />
                    <MediaUploadField
                      label={newBannerDraft.mediaType === "video" ? "Mobile Banner Video" : "Mobile Banner Image"}
                      accept={newBannerDraft.mediaType === "video" ? "video/*" : "image/*"}
                      mediaUrl={newBannerDraft.mediaType === "video" ? newBannerDraft.mobileVideo : newBannerDraft.mobileImage}
                      mediaType={newBannerDraft.mediaType}
                      isUploading={uploadingField === `new-banner:${newBannerDraft.mediaType === "video" ? "mobileVideo" : "mobileImage"}`}
                      onUpload={(file) => handleNewBannerMediaUpload(newBannerDraft.mediaType === "video" ? "mobileVideo" : "mobileImage", file)}
                    />
                  </div>
                </div>

                <div style={editorSectionStyle}>
                  <h5 style={editorSectionTitleStyle}>Media Details</h5>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Alt Text</span>
                    <input value={newBannerDraft.altText} onChange={(event) => updateNewBanner("altText", event.target.value)} placeholder="Describe the banner media" style={inputStyle} />
                  </label>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>{newBannerDraft.mediaType === "video" ? "Desktop Video URL" : "Desktop Image URL"}</span>
                    <input
                      value={newBannerDraft.mediaType === "video" ? newBannerDraft.desktopVideo : newBannerDraft.desktopImage}
                      onChange={(event) => updateNewBanner(newBannerDraft.mediaType === "video" ? "desktopVideo" : "desktopImage", event.target.value)}
                      placeholder={newBannerDraft.mediaType === "video" ? "/uploads/banner-video.mp4" : ""}
                      style={inputStyle}
                    />
                  </label>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>{newBannerDraft.mediaType === "video" ? "Mobile Video URL" : "Mobile Image URL"}</span>
                    <input
                      value={newBannerDraft.mediaType === "video" ? newBannerDraft.mobileVideo : newBannerDraft.mobileImage}
                      onChange={(event) => updateNewBanner(newBannerDraft.mediaType === "video" ? "mobileVideo" : "mobileImage", event.target.value)}
                      placeholder={newBannerDraft.mediaType === "video" ? "/uploads/banner-mobile-video.mp4" : ""}
                      style={inputStyle}
                    />
                  </label>
                </div>

                <div style={editorSectionStyle}>
                  <h5 style={editorSectionTitleStyle}>Slide Text</h5>
                  <label style={compactToggleStyle}>
                    <input
                      type="checkbox"
                      checked={newBannerDraft.textEnabled}
                      onChange={(event) => updateNewBanner("textEnabled", event.target.checked)}
                    />
                    <span>Enable slide text</span>
                  </label>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Title</span>
                    <input value={newBannerDraft.title} required onChange={(event) => updateNewBanner("title", event.target.value)} placeholder="Banner title" style={inputStyle} />
                  </label>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Subtitle</span>
                    <textarea value={newBannerDraft.subtitle} onChange={(event) => updateNewBanner("subtitle", event.target.value)} placeholder="Banner subtitle" rows={2} style={textareaStyle} />
                  </label>
                </div>

                <div style={editorSectionStyle}>
                  <h5 style={editorSectionTitleStyle}>CTA & Publishing</h5>
                  <label style={compactToggleStyle}>
                    <input
                      type="checkbox"
                      checked={newBannerDraft.ctaEnabled}
                      disabled={globalHeroCta.globalCtaEnabled}
                      onChange={(event) => updateNewBanner("ctaEnabled", event.target.checked)}
                    />
                    <span>{globalHeroCta.globalCtaEnabled ? "Disabled by all-slide CTA" : "Enable this slide CTA"}</span>
                  </label>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Button Text</span>
                    <input value={newBannerDraft.buttonText} disabled={globalHeroCta.globalCtaEnabled} onChange={(event) => updateNewBanner("buttonText", event.target.value)} placeholder="Shop Now" style={inputStyle} />
                  </label>
                  <PageLinkPicker
                    label="Button Link"
                    value={newBannerDraft.buttonLink}
                    options={PAGE_LINK_OPTIONS}
                    onChange={(value) => updateNewBanner("buttonLink", value)}
                    disabled={globalHeroCta.globalCtaEnabled}
                  />
                  <div style={pairedFieldGridStyle}>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Start Date Optional</span>
                      <input type="date" value={newBannerDraft.startDate || ""} onChange={(event) => updateNewBanner("startDate", event.target.value)} style={inputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>End Date Optional</span>
                      <input type="date" value={newBannerDraft.endDate || ""} onChange={(event) => updateNewBanner("endDate", event.target.value)} style={inputStyle} />
                    </label>
                  </div>
                  <div style={pairedFieldGridStyle}>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Status</span>
                      <select value={newBannerDraft.status} onChange={(event) => updateNewBanner("status", event.target.value)} style={inputStyle}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Sort Order</span>
                      <input type="number" min="1" value={newBannerDraft.sortOrder} onChange={(event) => updateNewBanner("sortOrder", event.target.value)} style={inputStyle} />
                    </label>
                  </div>
                </div>

                <div style={editorSectionStyle}>
                  <h5 style={editorSectionTitleStyle}>Typography</h5>
                  <div style={pairedFieldGridStyle}>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Title Size</span>
                      <input type="number" min="20" max="96" value={newBannerDraft.titleFontSize} onChange={(event) => updateNewBanner("titleFontSize", event.target.value)} style={inputStyle} />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Subtitle Size</span>
                      <input type="number" min="12" max="40" value={newBannerDraft.subtitleFontSize} onChange={(event) => updateNewBanner("subtitleFontSize", event.target.value)} style={inputStyle} />
                    </label>
                  </div>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Font Style</span>
                    <select value={getFontStyleValue(newBannerDraft)} onChange={(event) => updateNewBannerFontStyle(event.target.value)} style={inputStyle}>
                      {HERO_FONT_FAMILIES.flatMap((fontFamily) => [
                        <option key={`${fontFamily}-new-normal`} value={`${fontFamily}|normal`}>{`${fontFamily} - Normal`}</option>,
                        <option key={`${fontFamily}-new-italic`} value={`${fontFamily}|italic`}>{`${fontFamily} - Italic`}</option>
                      ])}
                    </select>
                  </label>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Font Weight</span>
                    <select value={newBannerDraft.fontWeight} onChange={(event) => updateNewBanner("fontWeight", event.target.value)} style={inputStyle}>
                      <option value="500">Medium</option>
                      <option value="700">Bold</option>
                      <option value="800">Extra Bold</option>
                    </select>
                  </label>
                </div>
              </div>

              <div style={modalFooterStyle}>
                <button type="button" onClick={() => setNewBannerDraft(null)} style={secondaryButtonStyle}>Cancel</button>
                <button type="button" onClick={handleCreateBanner} disabled={isCreatingBanner || Boolean(uploadingField)} style={saveButtonStyle}>
                  {isCreatingBanner ? "Saving Banner..." : "Save Banner"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <Link to="/dashboard/homepage" style={backButtonStyle}>Back to Homepage Sections</Link>
      </div>
    </section>
  );
}

function getBannerPreviewUrl(banner) {
  if (banner.mediaType === "video") {
    return banner.desktopVideo || banner.mobileVideo || banner.desktopImage || banner.mobileImage || "";
  }
  return banner.desktopImage || banner.mobileImage || banner.desktopVideo || banner.mobileVideo || "";
}

function getHeroPreviewTitleStyle(banner) {
  return {
    margin: 0,
    color: "#0f172a",
    fontSize: `${Math.max(20, Math.min(96, Number(banner.titleFontSize || 56))) * 0.48}px`,
    lineHeight: 1.08,
    fontFamily: banner.fontFamily || "Montserrat",
    fontStyle: banner.fontStyle || "normal",
    fontWeight: banner.fontWeight || "800"
  };
}

function getHeroPreviewSubtitleStyle(banner) {
  return {
    margin: 0,
    color: "#475569",
    fontSize: `${Math.max(12, Math.min(40, Number(banner.subtitleFontSize || 17)))}px`,
    lineHeight: 1.5,
    fontFamily: banner.fontFamily || "Montserrat",
    fontStyle: banner.fontStyle || "normal",
    fontWeight: banner.fontWeight === "800" ? "700" : banner.fontWeight || "500"
  };
}

function HeroMediaPreview({ banner, compact = false }) {
  const previewUrl = getBannerPreviewUrl(banner);
  const previewSrc = getAdminMediaPreviewUrl(previewUrl);
  const isVideo = banner.mediaType === "video" && (banner.desktopVideo || banner.mobileVideo);

  if (compact) {
    return isVideo ? (
      <video src={previewSrc} style={bannerPreviewThumbStyle} muted playsInline />
    ) : (
      previewSrc ? <img src={previewSrc} alt="" style={bannerPreviewThumbStyle} /> : null
    );
  }

  return (
    <div style={heroReviewStyle}>
      <div style={heroReviewMediaStyle}>
        {previewUrl ? (
          isVideo ? (
            <video src={previewSrc} controls muted playsInline style={heroReviewMediaElementStyle} />
          ) : (
            <img src={previewSrc} alt={banner.altText || banner.title || "Hero banner preview"} style={heroReviewMediaElementStyle} />
          )
        ) : (
          <span style={uploadPlaceholderStyle}>No media selected yet</span>
        )}
      </div>
      <div style={heroReviewCopyStyle}>
        <span style={eyebrowStyle}>Review</span>
        {banner.textEnabled !== false ? (
          <div style={heroPreviewTextBlockStyle}>
            <h4 style={getHeroPreviewTitleStyle(banner)}>{banner.title || "Untitled slide"}</h4>
            {banner.subtitle ? <p style={getHeroPreviewSubtitleStyle(banner)}>{banner.subtitle}</p> : null}
          </div>
        ) : (
          <strong>{banner.title || "Untitled slide"}</strong>
        )}
        <span>{banner.mediaType === "video" ? "Video slide" : "Image slide"}</span>
        <span>{banner.altText ? `Alt: ${banner.altText}` : "Alt text not set"}</span>
      </div>
    </div>
  );
}

function MediaUploadField({ label, mediaUrl, mediaType, accept, isUploading, onUpload }) {
  const inputId = React.useId();
  const [mediaFailed, setMediaFailed] = React.useState(false);
  const previewUrl = getAdminMediaPreviewUrl(mediaUrl);

  React.useEffect(() => {
    setMediaFailed(false);
  }, [mediaUrl]);

  const handleFiles = (files) => {
    const file = files?.[0];
    if (file) onUpload(file);
  };

  const noun = mediaType === "video" ? "video" : "image";
  const acceptedText = mediaType === "video" ? "MP4/WebM video files" : "JPG, PNG, or WebP images";

  return (
    <label
      htmlFor={inputId}
      style={uploadDropzoneStyle}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        handleFiles(event.dataTransfer.files);
      }}
    >
      <input
        id={inputId}
        type="file"
        accept={accept}
        onChange={(event) => handleFiles(event.target.files)}
        style={fileInputStyle}
      />
      <span style={labelStyle}>{label}</span>
      <span style={uploadPreviewShellStyle}>
        {previewUrl && !mediaFailed ? (
          mediaType === "video" ? (
            <video src={previewUrl} style={uploadPreviewImageStyle} muted playsInline onError={() => setMediaFailed(true)} />
          ) : (
            <img src={previewUrl} alt="" style={uploadPreviewImageStyle} onError={() => setMediaFailed(true)} />
          )
        ) : (
          <span style={uploadPlaceholderStyle}>Choose {noun}</span>
        )}
      </span>
      <strong style={uploadTitleStyle}>{isUploading ? `Adding ${noun}...` : `Drag ${noun}s here`}</strong>
      <span style={uploadHelpStyle}>{acceptedText}</span>
    </label>
  );
}

function ImageUploadField({ label, imageUrl, isUploading, onUpload }) {
  const inputId = React.useId();
  const [imageFailed, setImageFailed] = React.useState(false);
  const previewUrl = getAdminMediaPreviewUrl(imageUrl);

  React.useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const handleFiles = (files) => {
    const file = files?.[0];
    if (file) onUpload(file);
  };

  return (
    <label
      htmlFor={inputId}
      style={uploadDropzoneStyle}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        handleFiles(event.dataTransfer.files);
      }}
    >
      <input
        id={inputId}
        type="file"
        accept="image/*"
        onChange={(event) => handleFiles(event.target.files)}
        style={fileInputStyle}
      />
      <span style={labelStyle}>{label}</span>
      <span style={uploadPreviewShellStyle}>
        {previewUrl && !imageFailed ? (
          <img src={previewUrl} alt="" style={uploadPreviewImageStyle} onError={() => setImageFailed(true)} />
        ) : (
          <span style={uploadPlaceholderStyle}>Choose image</span>
        )}
      </span>
      <strong style={uploadTitleStyle}>{isUploading ? "Adding image..." : "Drag and drop image here"}</strong>
      <span style={uploadHelpStyle}>or click to choose image</span>
    </label>
  );
}

function PageLinkPicker({ label, value, options, onChange, disabled = false, fieldStyleOverride = null }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = options.filter((option) =>
    `${option.label} ${option.value}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div style={{ ...fieldStyle, ...(fieldStyleOverride || null) }}>
      <span style={labelStyle}>{label}</span>
      <div style={linkPickerShellStyle}>
        <button type="button" disabled={disabled} onClick={() => setIsOpen((current) => !current)} style={{ ...linkPickerButtonStyle, ...(disabled ? disabledControlStyle : null) }}>
          <span>{selectedOption?.label || value || "Select page"}</span>
          <small>{value || "/"}</small>
        </button>
        {isOpen ? (
          <div style={linkPickerMenuStyle}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search page"
              style={linkPickerSearchStyle}
            />
            <div style={linkPickerOptionsStyle}>
              {filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setQuery("");
                  }}
                  style={{
                    ...linkPickerOptionStyle,
                    ...(option.value === value ? linkPickerOptionActiveStyle : null)
                  }}
                >
                  <strong>{option.label}</strong>
                  <span>{option.value}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const heroStyle = {
  padding: "24px",
  border: "1px solid rgba(203, 213, 225, 0.72)",
  borderRadius: "18px",
  background: "linear-gradient(135deg, #ffffff 0%, #f6fbf7 64%, #edf8ef 100%)",
  boxShadow: "0 10px 26px rgba(15, 23, 42, 0.055)"
};

const eyebrowStyle = {
  color: "#4a9d54",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase"
};

const titleStyle = {
  margin: "10px 0 10px",
  color: "#0f172a",
  fontSize: "34px",
  lineHeight: 1.08
};

const copyStyle = {
  margin: 0,
  maxWidth: "760px",
  color: "#526377",
  lineHeight: 1.65
};

const panelStyle = {
  display: "grid",
  gap: "16px",
  marginTop: "0",
  padding: "18px",
  border: "1px solid rgba(203, 213, 225, 0.72)",
  borderRadius: "16px",
  background: "#ffffff",
  boxShadow: "0 10px 26px rgba(15, 23, 42, 0.055)"
};

const panelTitleStyle = {
  margin: "8px 0 8px",
  color: "#0f172a",
  fontSize: "22px"
};

const panelCopyStyle = {
  margin: 0,
  color: "#526377",
  lineHeight: 1.6
};

const placeholderGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
  gap: "14px"
};

const placeholderGroupStyle = {
  display: "grid",
  gap: "12px"
};

const placeholderGroupTitleStyle = {
  margin: 0,
  color: "#0f172a",
  fontSize: "16px"
};

const placeholderCardStyle = {
  display: "grid",
  gap: "8px",
  padding: "16px",
  border: "1px solid rgba(203, 213, 225, 0.72)",
  borderRadius: "16px",
  background: "#f8fafc",
  color: "#526377"
};

const placeholderCodeStyle = {
  width: "fit-content",
  padding: "4px 8px",
  borderRadius: "8px",
  background: "#e8f5eb",
  color: "#1f7a36",
  fontSize: "12px",
  fontWeight: 800
};

const backButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
  minHeight: "38px",
  padding: "0 14px",
  borderRadius: "10px",
  background: "#0f172a",
  color: "#ffffff",
  fontWeight: 800,
  textDecoration: "none"
};

const actionBarStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap"
};

const actionGroupStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "10px",
  flexWrap: "nowrap",
  whiteSpace: "nowrap"
};

const summaryPillStyle = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "36px",
  padding: "0 12px",
  borderRadius: "999px",
  background: "#f8fafc",
  border: "1px solid #e5edf5",
  color: "#475569",
  fontSize: "12px",
  fontWeight: 800
};

const cardCountControlStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  minHeight: "36px",
  padding: "0 10px 0 12px",
  borderRadius: "999px",
  background: "#ffffff",
  border: "1px solid #d9e4dd",
  color: "#475569",
  fontSize: "12px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.06em"
};

const cardCountSelectStyle = {
  minWidth: "56px",
  minHeight: "26px",
  border: "1px solid #cbd5e1",
  borderRadius: "999px",
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: "12px",
  fontWeight: 900,
  cursor: "pointer",
  textAlign: "center"
};

const secondaryButtonStyle = {
  minHeight: "40px",
  padding: "0 14px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 800,
  cursor: "pointer"
};

const saveButtonStyle = {
  ...secondaryButtonStyle,
  borderColor: "rgba(15, 23, 42, 0.1)",
  background: "#16a34a",
  color: "#ffffff"
};

const dangerButtonStyle = {
  ...secondaryButtonStyle,
  color: "#b91c1c",
  borderColor: "#fecaca",
  background: "#fff7f7"
};

const feedbackStyle = {
  borderRadius: "14px",
  padding: "13px 15px",
  border: "1px solid transparent",
  fontWeight: 700
};

const feedbackSuccessStyle = {
  background: "#f0fdf4",
  color: "#166534",
  borderColor: "#bbf7d0"
};

const feedbackWarningStyle = {
  background: "#fff7ed",
  color: "#c2410c",
  borderColor: "#fdba74"
};

const helperTextStyle = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 700
};

const colorInputStyle = {
  width: "100%",
  minHeight: "42px",
  padding: "5px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  background: "#ffffff",
  boxSizing: "border-box",
  cursor: "pointer"
};

const whyShopGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "16px"
};

const whyShopPageLayoutStyle = {
  display: "grid",
  gap: "18px"
};

const whyShopTopCardStyle = {
  display: "grid",
  gap: "16px",
  padding: "18px",
  borderRadius: "16px",
  border: "1px solid #dbe6ef",
  background: "#ffffff",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.06)"
};

const whyShopMiddleLayoutStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.65fr)",
  gap: "18px",
  alignItems: "start"
};

const whyShopItemsColumnStyle = {
  display: "grid",
  gap: "16px",
  minWidth: 0
};

const whyShopLivePreviewPanelStyle = {
  position: "sticky",
  top: "18px",
  display: "grid",
  gap: "12px",
  padding: "18px",
  borderRadius: "16px",
  border: "1px solid #dbe6ef",
  background: "#ffffff",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.06)",
  minWidth: 0
};

const whyShopLivePreviewSectionStyle = {
  display: "grid",
  gap: "16px",
  padding: "20px",
  borderRadius: "18px",
  border: "1px solid #e2e8f0",
  overflow: "hidden"
};

const whyShopLivePreviewHeadingStyle = {
  display: "grid",
  gap: "6px",
  textAlign: "center"
};

const whyShopLivePreviewGridStyle = {
  display: "grid",
  gap: "12px"
};

const whyShopLiveTrustCardStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  minHeight: "92px",
  padding: "14px",
  border: "1px solid #e5e7eb",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.07)",
  textAlign: "center"
};

const paymentIconGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "16px"
};

const paymentPreviewSectionStyle = {
  display: "grid",
  gap: "14px",
  padding: "18px",
  borderRadius: "16px",
  border: "1px solid #e2e8f0",
  overflow: "hidden"
};

const paymentPreviewGridStyle = {
  display: "flex",
  flexWrap: "nowrap",
  justifyContent: "center",
  gap: "10px",
  alignItems: "center"
};

const paymentPreviewStackStyle = {
  display: "grid",
  gap: "16px"
};

const paymentMobilePreviewShellStyle = {
  width: "min(100%, 320px)",
  margin: "0 auto",
  padding: "10px",
  borderRadius: "22px",
  border: "1px solid #dbe6ef",
  background: "#f8fafc"
};

const paymentPreviewIconStyle = {
  display: "flex",
  flex: "1 1 0",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "78px",
  maxWidth: "96px",
  minWidth: 0,
  padding: "12px",
  border: "1px solid #e5e7eb",
  boxShadow: "0 10px 22px rgba(15, 23, 42, 0.06)",
  textAlign: "center"
};

const whyShopCssPanelStyle = {
  display: "grid",
  gap: "14px",
  padding: "18px",
  borderRadius: "16px",
  border: "1px solid #dbe6ef",
  background: "#ffffff"
};

const whyShopBottomActionStyle = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center"
};

const whyShopEditorCardStyle = {
  display: "grid",
  gap: "14px",
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #dbe6ef",
  background: "#ffffff"
};

const whyShopPreviewStyle = {
  padding: "12px",
  borderRadius: "12px",
  background: "#f8fafc",
  border: "1px dashed #cbd5e1"
};

const whyShopPreviewCardStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "12px",
  minHeight: "112px",
  padding: "18px",
  border: "1px solid #e5e7eb",
  textAlign: "center"
};

const whyShopIconPlaceholderStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "999px",
  background: "#eef2f7",
  color: "#64748b",
  fontSize: "11px",
  fontWeight: 900,
  textTransform: "uppercase"
};

const whyShopControlsStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
  gap: "12px",
  alignItems: "end"
};

const whyShopItemActionBarStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  alignItems: "center",
  justifyContent: "space-between"
};

const whyShopStatusPillStyle = {
  minHeight: "32px",
  display: "inline-flex",
  alignItems: "center",
  padding: "0 10px",
  borderRadius: "999px",
  background: "#f0fdf4",
  color: "#166534",
  border: "1px solid #bbf7d0",
  fontSize: "12px",
  fontWeight: 900
};

const disabledActionButtonStyle = {
  ...secondaryButtonStyle,
  opacity: 0.5,
  cursor: "not-allowed"
};

const secondaryLinkButtonStyle = {
  ...secondaryButtonStyle,
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
  boxSizing: "border-box"
};

const previewLabelStyle = {
  display: "block",
  marginBottom: "8px",
  color: "#64748b",
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const whyShopDropzoneStyle = {
  display: "grid",
  gridTemplateColumns: "96px minmax(0, 1fr)",
  gap: "14px",
  alignItems: "center",
  padding: "14px",
  borderRadius: "14px",
  border: "1px dashed #cbd5e1",
  background: "#fbfdff"
};

const whyShopDropzoneActiveStyle = {
  borderColor: "#16a34a",
  background: "#f0fdf4"
};

const whyShopIconPreviewFrameStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "96px",
  height: "96px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  overflow: "hidden"
};

const whyShopIconPreviewImageStyle = {
  width: "72px",
  height: "72px",
  objectFit: "contain"
};

const whyShopIconPreviewEmptyStyle = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 900,
  textTransform: "uppercase"
};

const whyShopDropzoneContentStyle = {
  display: "grid",
  gap: "8px",
  minWidth: 0
};

const whyShopDropzoneActionsStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  alignItems: "center"
};

const hiddenFileInputStyle = {
  position: "absolute",
  width: "1px",
  height: "1px",
  opacity: 0,
  pointerEvents: "none"
};

const bannerListStyle = {
  display: "grid",
  gap: "14px"
};

const globalCtaPanelStyle = {
  display: "grid",
  gap: "0",
  padding: "0",
  borderRadius: "16px",
  border: "1px solid #dbe6ef",
  background: "#ffffff",
  minWidth: 0,
  boxSizing: "border-box",
  overflow: "hidden"
};

const collapsibleHeaderButtonStyle = {
  width: "100%",
  minHeight: "64px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "14px",
  padding: "14px 16px",
  border: 0,
  background: "#fbfdfc",
  color: "#0f172a",
  textAlign: "left",
  cursor: "pointer"
};

const collapsibleTitleBlockStyle = {
  display: "grid",
  gap: "4px",
  minWidth: 0
};

const collapsibleBodyStyle = {
  display: "grid",
  gap: "14px",
  padding: "14px",
  borderTop: "1px solid #e5edf5",
  background: "#f8fafc"
};

const inlineSaveBarStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  flexWrap: "wrap"
};

const mediaTypePanelStyle = {
  display: "grid",
  gap: "10px",
  padding: "12px",
  minHeight: "230px",
  borderRadius: "14px",
  border: "1px solid #e5edf5",
  background: "#ffffff",
  alignContent: "start",
  minWidth: 0,
  boxSizing: "border-box",
  overflow: "visible"
};

const editorSectionStyle = {
  display: "grid",
  gap: "10px",
  padding: "12px",
  minHeight: "230px",
  borderRadius: "14px",
  border: "1px solid #e5edf5",
  background: "#ffffff",
  alignContent: "start",
  minWidth: 0,
  boxSizing: "border-box",
  overflow: "visible"
};

const editorSectionTitleStyle = {
  margin: 0,
  color: "#0f172a",
  fontSize: "14px",
  lineHeight: 1.2
};

const wideFieldStyle = {
  gridColumn: "1 / -1"
};

const editorSectionsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
  gap: "12px",
  alignItems: "stretch",
  minWidth: 0
};

const compactSectionGridStyle = {
  display: "grid",
  gap: "10px",
  minWidth: 0
};

const pairedFieldGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
  gap: "10px",
  minWidth: 0
};

const halfFieldStyle = {
  gridColumn: "span 6"
};

const thirdFieldStyle = {
  gridColumn: "span 4"
};

const quarterFieldStyle = {
  gridColumn: "span 3"
};

const twoThirdFieldStyle = {
  gridColumn: "span 8"
};

const bannerCardStyle = {
  display: "grid",
  gridTemplateColumns: "42px 170px minmax(0, 1fr) auto",
  gap: "14px",
  alignItems: "center",
  padding: "14px",
  border: "1px solid #dbe6ef",
  borderRadius: "18px",
  background: "#ffffff",
  overflow: "visible",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.045)",
  boxSizing: "border-box"
};

const bannerCardDraggingStyle = {
  opacity: 0.72,
  borderColor: "#22c55e",
  background: "#f0fdf4",
  boxShadow: "0 16px 30px rgba(34, 197, 94, 0.16)"
};

const bannerDragHandleStyle = {
  display: "grid",
  placeItems: "center",
  width: "42px",
  height: "74px",
  border: "1px solid #e5edf5",
  borderRadius: "12px",
  background: "#f8fafc",
  color: "#64748b",
  cursor: "grab",
  touchAction: "none"
};

const bannerPreviewThumbStyle = {
  width: "100%",
  aspectRatio: "16 / 9",
  objectFit: "cover",
  borderRadius: "12px",
  background: "#e2e8f0",
  border: "1px solid #e5edf5"
};

const bannerPreviewContentStyle = {
  display: "grid",
  gap: "6px",
  minWidth: 0
};

const bannerPreviewTitleStyle = {
  color: "#0f172a",
  fontSize: "20px",
  lineHeight: 1.25,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const bannerMetaStyle = {
  color: "#64748b",
  fontSize: "13px",
  fontWeight: 700
};

const bannerMetaGroupStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
  color: "#64748b",
  fontSize: "13px",
  fontWeight: 700
};

const bannerRowActionsStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
  minWidth: "258px",
  flexWrap: "nowrap",
  whiteSpace: "nowrap"
};

const heroReviewStyle = {
  display: "grid",
  gridTemplateColumns: "190px minmax(0, 1fr)",
  gap: "12px",
  alignItems: "center",
  padding: "12px",
  borderRadius: "14px",
  border: "1px solid #e5edf5",
  background: "#ffffff",
  minWidth: 0,
  boxSizing: "border-box",
  overflow: "hidden"
};

const heroReviewMediaStyle = {
  display: "grid",
  placeItems: "center",
  width: "100%",
  aspectRatio: "16 / 9",
  borderRadius: "12px",
  overflow: "hidden",
  background: "#e2e8f0",
  border: "1px solid #dbe6ef"
};

const heroReviewMediaElementStyle = {
  width: "100%",
  height: "100%",
  display: "block",
  objectFit: "cover"
};

const heroReviewCopyStyle = {
  display: "grid",
  gap: "6px",
  color: "#475569",
  minWidth: 0
};

const heroPreviewTextBlockStyle = {
  display: "grid",
  gap: "6px",
  minWidth: 0
};

const bannerEditorStyle = {
  display: "grid",
  gap: "10px",
  padding: "12px",
  gridColumn: "1 / -1",
  borderTop: "1px solid #e5edf5",
  background: "#f8fafc",
  minWidth: 0,
  boxSizing: "border-box",
  overflow: "visible"
};

const editorSaveBarStyle = {
  position: "sticky",
  bottom: "0",
  zIndex: 5,
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  padding: "12px",
  borderRadius: "14px",
  border: "1px solid #dbe6ef",
  background: "rgba(255, 255, 255, 0.94)",
  boxShadow: "0 -10px 24px rgba(15, 23, 42, 0.06)",
  flexWrap: "wrap"
};

const bannerCardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "14px",
  flexWrap: "wrap"
};

const bannerTitleStyle = {
  margin: "6px 0 0",
  color: "#0f172a",
  fontSize: "20px"
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  gap: "14px"
};

const heroFormGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
  columnGap: "10px",
  rowGap: "10px",
  alignItems: "start",
  minWidth: 0
};

const uploadGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "10px",
  minWidth: 0
};

const uploadDropzoneStyle = {
  position: "relative",
  display: "grid",
  gridTemplateColumns: "110px minmax(0, 1fr)",
  gridTemplateRows: "auto auto auto",
  columnGap: "12px",
  rowGap: "4px",
  alignItems: "center",
  minHeight: "78px",
  padding: "10px",
  border: "1px dashed #9bc9a3",
  borderRadius: "12px",
  background: "#ffffff",
  cursor: "pointer",
  minWidth: 0,
  boxSizing: "border-box"
};

const fileInputStyle = {
  position: "absolute",
  width: "1px",
  height: "1px",
  opacity: 0
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "grid",
  placeItems: "center",
  padding: "24px",
  background: "rgba(15, 23, 42, 0.48)",
  boxSizing: "border-box"
};

const modalPanelStyle = {
  width: "min(1080px, 100%)",
  maxHeight: "calc(100vh - 48px)",
  overflowY: "auto",
  display: "grid",
  gap: "16px",
  padding: "20px",
  borderRadius: "20px",
  border: "1px solid rgba(203, 213, 225, 0.9)",
  background: "#ffffff",
  boxShadow: "0 28px 80px rgba(15, 23, 42, 0.28)",
  boxSizing: "border-box"
};

const modalHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap"
};

const modalCloseButtonStyle = {
  width: "38px",
  height: "38px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "18px",
  fontWeight: 900,
  cursor: "pointer"
};

const modalTitleStyle = {
  margin: "6px 0 6px",
  color: "#0f172a",
  fontSize: "28px",
  lineHeight: 1.1
};

const modalBodyGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px",
  minWidth: 0
};

const modalFooterStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  paddingTop: "4px",
  flexWrap: "wrap"
};

const uploadPreviewShellStyle = {
  display: "grid",
  placeItems: "center",
  width: "100%",
  height: "58px",
  gridRow: "1 / 4",
  borderRadius: "10px",
  background: "#eef4f1",
  overflow: "hidden",
  border: "1px solid #dbe6ef"
};

const uploadPreviewImageStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block"
};

const uploadPlaceholderStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: "100%",
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 800,
  background: "linear-gradient(135deg, #eef4f1 0%, #f8fafc 100%)"
};

const uploadTitleStyle = {
  color: "#0f172a",
  fontSize: "13px",
  lineHeight: 1.25
};

const uploadHelpStyle = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 700
};

const linkPickerShellStyle = {
  position: "relative",
  zIndex: 30
};

const linkPickerButtonStyle = {
  width: "100%",
  minHeight: "42px",
  boxSizing: "border-box",
  display: "grid",
  gap: "2px",
  padding: "7px 12px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  textAlign: "left",
  cursor: "pointer"
};

const linkPickerMenuStyle = {
  position: "absolute",
  top: "calc(100% + 8px)",
  left: 0,
  right: 0,
  zIndex: 20,
  boxSizing: "border-box",
  display: "grid",
  gap: "8px",
  padding: "10px",
  borderRadius: "14px",
  border: "1px solid #dbe6ef",
  background: "#ffffff",
  boxShadow: "0 18px 36px rgba(15, 23, 42, 0.14)"
};

const linkPickerSearchStyle = {
  width: "100%",
  minHeight: "38px",
  boxSizing: "border-box",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  padding: "0 12px",
  fontSize: "14px"
};

const linkPickerOptionsStyle = {
  display: "grid",
  gap: "6px",
  maxHeight: "220px",
  overflowY: "auto"
};

const linkPickerOptionStyle = {
  display: "grid",
  gap: "2px",
  width: "100%",
  padding: "9px 10px",
  borderRadius: "10px",
  border: "1px solid transparent",
  background: "#ffffff",
  color: "#0f172a",
  textAlign: "left",
  cursor: "pointer"
};

const linkPickerOptionActiveStyle = {
  borderColor: "#bbf7d0",
  background: "#f0fdf4"
};

const categoryManageListStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))",
  gap: "14px"
};

const browseSettingsPanelStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
  gap: "12px",
  alignItems: "end",
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #dbe6ef",
  background: "#ffffff"
};

const checkboxFieldStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minHeight: "42px",
  padding: "0 12px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: "13px",
  fontWeight: 900
};

const settingsSaveActionStyle = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "end"
};

const homepageCategorySelectorStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(min(100%, 420px), 1fr) minmax(min(100%, 420px), 0.7fr)",
  gap: "16px",
  alignItems: "center",
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #dbe6ef",
  background: "linear-gradient(180deg, #fbfdff 0%, #f8fafc 100%)"
};

const selectorTitleStyle = {
  margin: "6px 0 6px",
  color: "#0f172a",
  fontSize: "18px"
};

const selectorControlsStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "10px",
  alignItems: "end",
  minWidth: 0
};

const productSelectorControlsStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(min(100%, 260px), 1fr) auto",
  gap: "10px",
  alignItems: "end",
  minWidth: 0
};

const categoryFilterPanelStyle = {
  display: "grid",
  gap: "14px",
  padding: "16px",
  borderRadius: "16px",
  border: "1px solid #dbe6ef",
  background: "#f8fafc"
};

const categoryFilterHeaderActionsStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "10px",
  flexWrap: "wrap"
};

const categoryUpdateActionStyle = {
  display: "grid",
  justifyItems: "end",
  gap: "6px"
};

const categoryUpdateMessageStyle = {
  color: "#166534",
  fontSize: "12px",
  fontWeight: 800
};

const categoryFilterGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  gap: "10px"
};

const categoryManageCardStyle = {
  display: "grid",
  gridTemplateColumns: "38px 76px minmax(0, 1fr) auto",
  gap: "12px",
  alignItems: "center",
  padding: "12px",
  border: "1px solid #dbe6ef",
  borderRadius: "16px",
  background: "#ffffff",
  overflow: "visible",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.045)",
  boxSizing: "border-box"
};

const categoryManageCardDraggingStyle = {
  opacity: 0.72,
  borderColor: "#22c55e",
  background: "#f0fdf4",
  boxShadow: "0 16px 30px rgba(34, 197, 94, 0.16)"
};

const categoryDragHandleStyle = {
  display: "grid",
  placeItems: "center",
  width: "38px",
  height: "58px",
  border: "1px solid #e5edf5",
  borderRadius: "12px",
  background: "#f8fafc",
  color: "#64748b",
  fontSize: "18px",
  fontWeight: 900,
  letterSpacing: "-0.2em",
  cursor: "grab",
  touchAction: "none"
};

const categoryDragDotsStyle = {
  width: "14px",
  display: "grid",
  gridTemplateColumns: "repeat(2, 4px)",
  gap: "4px 5px"
};

const categoryDragDotStyle = {
  width: "4px",
  height: "4px",
  borderRadius: "50%",
  background: "#64748b"
};

const categoryPreviewContentStyle = {
  display: "contents"
};

const categoryMetaStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
  color: "#64748b",
  fontSize: "13px",
  lineHeight: 1.35
};

const categoryOrderPillStyle = {
  ...summaryPillStyle,
  minHeight: "32px",
  padding: "0 10px",
  background: "#f8fafc",
  color: "#0f172a"
};

const categoryEditButtonStyle = {
  ...secondaryButtonStyle,
  minHeight: "34px",
  padding: "0 12px",
  borderRadius: "9px"
};


const homepageArrangementBarStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap"
};

const emptyHomepageCategoryStyle = {
  gridColumn: "1 / -1",
  padding: "22px",
  borderRadius: "16px",
  border: "1px dashed #cbd5e1",
  background: "#f8fafc",
  color: "#64748b",
  fontWeight: 700,
  textAlign: "center"
};

const segmentedControlStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "8px"
};

const segmentedButtonStyle = {
  minHeight: "42px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#475569",
  fontWeight: 800,
  cursor: "pointer"
};

const segmentedButtonActiveStyle = {
  borderColor: "#86efac",
  background: "#dcfce7",
  color: "#166534"
};

const segmentedButtonInactiveStyle = {
  borderColor: "#fecaca",
  background: "#fff1f2",
  color: "#b91c1c"
};

const productArrangementListStyle = {
  display: "grid",
  gap: "10px"
};

const productArrangementCardStyle = {
  display: "grid",
  gridTemplateColumns: "38px 74px minmax(0, 1fr) minmax(240px, auto)",
  gap: "12px",
  alignItems: "center",
  padding: "10px",
  borderRadius: "14px",
  border: "1px solid #dbe6ef",
  background: "#ffffff",
  boxSizing: "border-box",
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)"
};

const productArrangementCardDraggingStyle = {
  opacity: 0.72,
  borderColor: "#22c55e",
  background: "#f0fdf4",
  boxShadow: "0 16px 30px rgba(34, 197, 94, 0.16)"
};

const productDragHandleStyle = {
  display: "grid",
  placeItems: "center",
  width: "38px",
  height: "58px",
  border: "1px solid #e5edf5",
  borderRadius: "12px",
  background: "#f8fafc",
  color: "#475569",
  cursor: "grab",
  touchAction: "none"
};

const productArrangementImageStyle = {
  width: "74px",
  height: "58px",
  objectFit: "cover",
  borderRadius: "10px",
  border: "1px solid #e5edf5",
  background: "#eef4f1"
};

const productArrangementContentStyle = {
  display: "grid",
  gap: "6px",
  minWidth: 0
};

const productArrangementTitleStyle = {
  color: "#0f172a",
  fontSize: "16px",
  lineHeight: 1.25,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const productArrangementControlsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  minWidth: 0
};

const productArrangementActionStyle = {
  display: "flex",
  gap: "7px",
  justifyContent: "flex-end",
  alignItems: "center",
  flexWrap: "nowrap",
  whiteSpace: "nowrap"
};

const productMetaGroupStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
  color: "#64748b",
  fontSize: "13px",
  fontWeight: 700
};

const productSearchModalPanelStyle = {
  ...modalPanelStyle,
  width: "min(920px, 100%)",
  maxHeight: "calc(100vh - 56px)"
};

const productSearchSummaryStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  flexWrap: "wrap"
};

const productSearchResultsStyle = {
  display: "grid",
  gap: "10px",
  maxHeight: "52vh",
  overflowY: "auto",
  paddingRight: "4px"
};

const productSearchResultStyle = {
  display: "grid",
  gridTemplateColumns: "72px minmax(0, 1fr) auto",
  gap: "12px",
  alignItems: "center",
  width: "100%",
  padding: "10px",
  borderRadius: "14px",
  border: "1px solid #dbe6ef",
  background: "#ffffff",
  color: "#0f172a",
  textAlign: "left",
  cursor: "pointer"
};

const productSearchResultSelectedStyle = {
  borderColor: "#86efac",
  background: "#f0fdf4"
};

const productSearchImageStyle = {
  width: "72px",
  height: "56px",
  objectFit: "cover",
  borderRadius: "10px",
  border: "1px solid #e5edf5",
  background: "#eef4f1"
};

const productSearchCopyStyle = {
  display: "grid",
  gap: "3px",
  color: "#64748b",
  fontSize: "13px",
  fontWeight: 700,
  minWidth: 0
};

const productSlotInlineStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  minHeight: "32px",
  padding: "0 8px",
  borderRadius: "9px",
  border: "1px solid #dbe6ef",
  background: "#ffffff"
};

const productSlotLabelStyle = {
  color: "#475569",
  fontSize: "12px",
  fontWeight: 900
};

const productSlotInputStyle = {
  width: "48px",
  height: "26px",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: "7px",
  padding: "0 6px",
  color: "#0f172a",
  fontWeight: 800
};

const brandListStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
  gap: "14px"
};

const brandCardStyle = {
  display: "grid",
  borderRadius: "16px",
  border: "1px solid #dbe6ef",
  background: "#ffffff",
  overflow: "hidden"
};

const brandPreviewButtonStyle = {
  display: "grid",
  gridTemplateColumns: "96px minmax(0, 1fr)",
  gap: "12px",
  alignItems: "center",
  width: "100%",
  padding: "14px",
  border: 0,
  background: "#fbfdfc",
  color: "#0f172a",
  textAlign: "left",
  cursor: "pointer"
};

const brandLogoPreviewStyle = {
  display: "grid",
  placeItems: "center",
  width: "96px",
  height: "72px",
  borderRadius: "12px",
  border: "1px solid #e5edf5",
  background: "#f8fafc",
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 900,
  overflow: "hidden"
};

const brandLogoImageStyle = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  display: "block",
  padding: "8px",
  boxSizing: "border-box"
};

const brandPreviewCopyStyle = {
  display: "grid",
  gap: "5px",
  minWidth: 0
};

const brandPreviewTitleStyle = {
  color: "#0f172a",
  fontSize: "18px",
  lineHeight: 1.25,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const brandEditorStyle = {
  display: "grid",
  gap: "12px",
  padding: "14px",
  borderTop: "1px solid #e5edf5",
  background: "#ffffff"
};

const brandEditorGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  gap: "12px"
};

const categoryPreviewButtonStyle = {
  width: "100%",
  display: "grid",
  gridTemplateColumns: "74px minmax(0, 1fr) auto",
  gap: "12px",
  alignItems: "center",
  padding: "12px",
  border: 0,
  background: "#fbfdfc",
  color: "#0f172a",
  textAlign: "left",
  cursor: "pointer",
  borderRadius: "0 14px 14px 0",
  minWidth: 0
};

const categoryPreviewImageStyle = {
  width: "74px",
  height: "58px",
  objectFit: "cover",
  borderRadius: "10px",
  border: "1px solid #e5edf5",
  background: "#eef4f1"
};

const categoryPreviewCopyStyle = {
  display: "grid",
  gap: "4px",
  color: "#64748b",
  minWidth: 0
};

const categoryRowActionsStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
  flexWrap: "nowrap",
  minWidth: "258px",
  whiteSpace: "nowrap"
};

const rowStatusButtonBaseStyle = {
  minHeight: "34px",
  padding: "0 12px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 900,
  cursor: "pointer"
};

const rowActiveButtonStyle = {
  ...rowStatusButtonBaseStyle,
  border: "1px solid #bbf7d0",
  background: "#dcfce7",
  color: "#166534"
};

const rowInactiveButtonStyle = {
  ...rowStatusButtonBaseStyle,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b91c1c"
};

const rowDeleteButtonStyle = {
  ...categoryEditButtonStyle,
  borderColor: "#fecaca",
  background: "#fff7f7",
  color: "#b91c1c"
};

const categoryPreviewCopyStyleStrong = {
  color: "#0f172a",
  fontSize: "17px",
  lineHeight: 1.25,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const compactToggleStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minHeight: "42px",
  padding: "0 12px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 800,
  minWidth: 0,
  boxSizing: "border-box"
};

const categorySmallGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  gap: "12px"
};

const fieldStyle = {
  display: "grid",
  gap: "5px",
  alignContent: "end",
  minWidth: 0
};

const labelStyle = {
  color: "#475569",
  fontSize: "13px",
  fontWeight: 800
};

const inputStyle = {
  width: "100%",
  minHeight: "42px",
  boxSizing: "border-box",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  padding: "0 12px",
  fontSize: "14px"
};

const disabledControlStyle = {
  opacity: 0.58,
  cursor: "not-allowed",
  background: "#f8fafc"
};

const textareaStyle = {
  ...inputStyle,
  minHeight: "82px",
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  resize: "vertical"
};

const previewStyle = {
  display: "grid",
  gridTemplateColumns: "180px minmax(0, 1fr)",
  gap: "14px",
  alignItems: "center",
  padding: "12px",
  borderRadius: "14px",
  background: "#ffffff",
  border: "1px solid #e5edf5"
};

const previewImageStyle = {
  width: "100%",
  aspectRatio: "16 / 9",
  objectFit: "cover",
  borderRadius: "12px",
  background: "#e2e8f0"
};

const previewCopyStyle = {
  display: "grid",
  gap: "4px",
  color: "#475569"
};
