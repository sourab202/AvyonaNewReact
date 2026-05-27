import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { trackAnalyticsEvent } from "../api/analyticsApi";
import { fetchProductOffers } from "../api/couponApi";
import {
  fetchProductReviewMediaGallery,
  fetchProductReviewSummary,
  fetchStorefrontProduct,
  fetchStorefrontProductReviews,
  submitGuestReview as submitGuestReviewApi,
  uploadGuestReviewMedia
} from "../api/productApi";
import { submitCustomerReview as submitCustomerReviewApi, uploadCustomerReviewMedia } from "../api/customerApi";
import { fetchPublicProductPaymentIcons } from "../api/settingsApi";
import ProductCard from "../components/product/ProductCard";
import { categoryRouteMap } from "../data/storefront-content";
import { resolveMediaList, resolveMediaUrl } from "../utils/media";
import {
  buildProductPath,
  compressImageFile,
  copyText,
  getCheckoutPaymentMethods,
  getProductVariantByKey,
  getSiteSettings,
  formatCurrency,
  getOptimizedAssetPath,
  getReviewStorageKey,
  readStorage,
  writeStorage
} from "../utils/storefront";
import { validateCoupon } from "../../../shared/coupons";
import { REVIEW_TYPES, REVIEW_VISIBILITY_STATUSES } from "../../../shared/reviewTypes";

const PAYMENT_LOGOS = [
  { src: "", alt: "Payment option 1" },
  { src: "", alt: "Payment option 2" },
  { src: "", alt: "Payment option 3" },
  { src: "", alt: "Payment option 4" }
];

const TRUST_POINTS = [
  "Genuine Product",
  "Secure Checkout",
  "COD Available",
  "Fast Delivery",
  "Support Available"
];

const MOBILE_ZOOM_HOLD_MS = 700;
const REVIEW_PAGE_SIZE = 5;
const REVIEW_SORT_OPTIONS = [
  { label: "Top reviews", value: "recent" },
  { label: "Highest Rating", value: "highest" },
  { label: "Lowest Rating", value: "lowest" },
  { label: "With Photos/Videos", value: "media" },
  { label: "Verified Purchase Only", value: "verified" }
];
const REVIEW_FILTER_OPTIONS = [
  { label: "All stars", value: "all" },
  { label: "5 star only", value: "5" },
  { label: "4 star only", value: "4" },
  { label: "3 star only", value: "3" },
  { label: "2 star only", value: "2" },
  { label: "1 star only", value: "1" }
];
const REVIEWER_FILTER_OPTIONS = [
  { label: "All reviewers", value: "all" },
  { label: "Verified purchase only", value: "verified" }
];

function formatOfferDiscount(offer) {
  if (offer.discountType === "fixed") return `Rs. ${Number(offer.discountValue || 0).toLocaleString("en-IN")} off`;
  return `${Number(offer.discountValue || 0).toLocaleString("en-IN")}% off`;
}

const POLICY_SECTIONS = [
  {
    key: "shipping",
    title: "Shipping Information"
  },
  {
    key: "returns",
    title: "Return & Refund",
    getBody: () => "Eligible orders can be returned or replaced as per policy terms for the selected category."
  },
  {
    key: "warranty",
    title: "Warranty Support",
    getBody: (product) => product.warrantySummary
      ? `${product.warrantySummary}. Support is available according to the brand and product-type coverage listed in the specifications section.`
      : "Support is available according to the brand and product-type coverage listed in the specifications section."
  },
  {
    key: "cod",
    title: "COD Information"
  }
];

function normalizeBackendProduct(product) {
  const price = Number(product.price || 0);
  const mrp = Number(product.mrp || price || 0);
  const stockQuantity = Number(product.stockQuantity || 0);
  const discount = mrp > price && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const gallery = resolveMediaList(product.galleryUrls).filter(hasMediaUrl);

  return {
    id: product.id,
    asin: product.asin,
    sku: product.asin || product.sku,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.categoryName || "Products",
    collectionSlug: product.categorySlug || "",
    price,
    mrp,
    discount,
    image: gallery[0] || resolveMediaUrl(product.imageUrl),
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

function resolveReviewMediaUrl(url) {
  return resolveMediaUrl(url);
}

function renderStars(rating) {
  const filled = Math.round(Number(rating || 0));
  return `${"\u2605".repeat(filled)}${"\u2606".repeat(Math.max(0, 5 - filled))}`;
}

function hasMediaUrl(value) {
  return Boolean(String(value || "").trim());
}

function getVariantDisplayLabel(source, fallback = "") {
  const rawValue = String(source?.variantValue || source?.label || fallback || "").trim();
  const productName = String(source?.name || "").trim();
  const value = rawValue && rawValue !== productName ? rawValue : productName;
  if (!value) return "";

  const afterDash = value.split(/\s[–-]\s/).pop() || value;
  const firstPart = afterDash.split(",")[0]?.trim() || afterDash.trim();
  return firstPart || value;
}

function isVideoUrl(value) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(String(value || "").trim());
}

function ProductMediaFallback({ compact = false }) {
  return (
    <span className={`avy-no-image-placeholder ${compact ? "is-compact" : ""}`}>
      <span>No image</span>
    </span>
  );
}

function getGalleryItems(product, selectedVariant) {
  const sourceGallery = selectedVariant?.gallery?.length ? selectedVariant.gallery : product.gallery || [product.image];
  const items = sourceGallery.map((entry, index) => ({
    type: isVideoUrl(entry) ? "video" : "image",
    src: entry,
    thumb: isVideoUrl(entry) ? product.videoPoster || product.image : entry,
    alt: `${product.name} ${index + 1}`
  })).filter((item) => hasMediaUrl(item.src));

  if (product.video && !items.some((item) => item.src === product.video)) {
    items.push({
      type: "video",
      src: product.video,
      thumb: product.videoPoster || product.image,
      alt: `${product.name} video`
    });
  }

  if (!items.length) {
    return [{
      type: "placeholder",
      src: "",
      thumb: "",
      alt: "No image available"
    }];
  }

  return items;
}

function getReviewStats(reviews, fallbackAverage) {
  if (!reviews.length) {
    return {
      average: Number(fallbackAverage || 0),
      breakdown: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0, percentage: 0 }))
    };
  }

  const total = reviews.length;
  const average = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / total;
  return {
    average,
    breakdown: [5, 4, 3, 2, 1].map((rating) => {
      const count = reviews.filter((review) => Number(review.rating || 0) === rating).length;
      return {
        rating,
        count,
        percentage: Math.round((count / total) * 100)
      };
    })
  };
}

function formatReviewDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function getReviewDisplayName(review) {
  if (review.isAnonymous || review.name === "Anonymous") {
    return review.reviewType === REVIEW_TYPES.GUEST ? "Anonymous Guest" : "Anonymous Customer";
  }
  return review.name || "Avyona Customer";
}

function isReviewVerifiedPurchase(review) {
  if (review.reviewType === REVIEW_TYPES.GUEST) return false;
  return Boolean(review.isVerifiedPurchase || review.is_verified_purchase);
}

function isPublicReview(review) {
  return !review.visibilityStatus || review.visibilityStatus === REVIEW_VISIBILITY_STATUSES.PUBLIC;
}

function hasReviewMedia(review) {
  return Boolean(review.images?.length || review.videos?.length);
}

function getReviewTime(review) {
  const time = new Date(review.date || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function filterAndSortReviews(reviews, filterValue, reviewerFilterValue, sortValue) {
  const filtered = reviews.filter((review) => {
    const matchesRating = filterValue === "all" || Number(review.rating || 0) === Number(filterValue);
    const matchesReviewer = reviewerFilterValue === "all" || isReviewVerifiedPurchase(review);
    return matchesRating && matchesReviewer;
  });

  return [...filtered].sort((left, right) => {
    if (sortValue === "highest") return Number(right.rating || 0) - Number(left.rating || 0) || getReviewTime(right) - getReviewTime(left);
    if (sortValue === "lowest") return Number(left.rating || 0) - Number(right.rating || 0) || getReviewTime(right) - getReviewTime(left);
    if (sortValue === "media") return Number(hasReviewMedia(right)) - Number(hasReviewMedia(left)) || getReviewTime(right) - getReviewTime(left);
    if (sortValue === "verified") return Number(isReviewVerifiedPurchase(right)) - Number(isReviewVerifiedPurchase(left)) || getReviewTime(right) - getReviewTime(left);
    return getReviewTime(right) - getReviewTime(left);
  });
}

function normalizeStorefrontReview(review) {
  const media = Array.isArray(review.media) ? review.media : [];
  return {
    name: review.isAnonymous ? "" : review.reviewerName,
    title: review.reviewTitle,
    rating: Number(review.rating || 0),
    date: review.createdAt || "",
    body: review.reviewText,
    adminReply: review.adminReply || "",
    adminReplyAt: review.adminReplyAt || "",
    images: media.filter((item) => item.mediaType === "image").map((item) => resolveReviewMediaUrl(item.mediaUrl)),
    videos: media.filter((item) => item.mediaType === "video").map((item) => resolveReviewMediaUrl(item.mediaUrl)),
    reviewType: review.reviewType,
    visibilityStatus: review.visibilityStatus,
    customerId: review.customerId,
    isAnonymous: Boolean(review.isAnonymous),
    isVerifiedPurchase: Boolean(review.isVerifiedPurchase)
  };
}

function getCustomerMedia(reviews) {
  const reviewMedia = reviews.flatMap((review, index) => {
    const displayName = getReviewDisplayName(review);
    const imageItems = (review.images || []).map((image, mediaIndex) => ({
      key: `review-image-${index}-${mediaIndex}`,
      type: "image",
      src: image,
      alt: `${displayName} review image ${mediaIndex + 1}`
    }));
    const videoItems = (review.videos || []).map((video, mediaIndex) => ({
      key: `review-video-${index}-${mediaIndex}`,
      type: "video",
      src: video,
      alt: `${displayName} review video ${mediaIndex + 1}`
    }));
    return [...imageItems, ...videoItems];
  });

  return reviewMedia;
}

function normalizeReviewGalleryMedia(item, index) {
  const displayName = item.isAnonymous
    ? (item.reviewType === REVIEW_TYPES.GUEST ? "Anonymous Guest" : "Anonymous Customer")
    : item.reviewerName || "Avyona Customer";

  return {
    key: `gallery-media-${item.mediaId || item.reviewId || index}`,
    type: item.mediaType,
    src: resolveReviewMediaUrl(item.mediaUrl),
    alt: `${displayName} review ${item.mediaType || "media"} ${index + 1}`
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("File could not be processed"));
    reader.readAsDataURL(file);
  });
}

export default function ProductPage({ context }) {
  const { slug: productKey, variantKey } = useParams();
  const navigate = useNavigate();
  const productCatalog = Array.isArray(context.allProducts) ? context.allProducts : [];
  const [productLookup, setProductLookup] = useState({ key: "", product: null, isLoading: true });
  const fetchedProduct = productLookup.key === productKey ? productLookup.product : null;
  const isFetchingProduct = productLookup.key !== productKey || productLookup.isLoading;
  const catalogProduct = productCatalog.find((item) => item.slug === productKey || String(item.asin || "") === String(productKey || ""));
  const product = useMemo(() => (
    fetchedProduct
      ? {
        ...(catalogProduct || {}),
        ...fetchedProduct,
        gallery: catalogProduct?.gallery?.length ? catalogProduct.gallery : fetchedProduct.gallery,
        variants: catalogProduct?.variants?.length ? catalogProduct.variants : fetchedProduct.variants,
        reviews: catalogProduct?.reviews?.length ? catalogProduct.reviews : fetchedProduct.reviews,
        faqs: catalogProduct?.faqs?.length ? catalogProduct.faqs : fetchedProduct.faqs
      }
      : catalogProduct
  ), [catalogProduct, fetchedProduct]);
  const stageRef = useRef(null);
  const imageRef = useRef(null);
  const previewRef = useRef(null);
  const reviewFormRef = useRef(null);
  const mobileZoomTimerRef = useRef(null);
  const mobileZoomTouchRef = useRef(null);
  const productViewKeyRef = useRef("");

  const [galleryIndex, setGalleryIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageZoomActive, setImageZoomActive] = useState(false);
  const [mobileZoomActive, setMobileZoomActive] = useState(false);
  const [zoomMetrics, setZoomMetrics] = useState({
    previewImageWidth: 0,
    previewImageHeight: 0,
    previewOffsetX: 0,
    previewOffsetY: 0,
    lensWidth: 0,
    lensHeight: 0,
    lensLeft: 0,
    lensTop: 0
  });
  const [pincode, setPincode] = useState("");
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [guestReviewName, setGuestReviewName] = useState("");
  const [guestReviewEmail, setGuestReviewEmail] = useState("");
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewVideos, setReviewVideos] = useState([]);
  const [reviewImages, setReviewImages] = useState([]);
  const [reviewImageFiles, setReviewImageFiles] = useState([]);
  const [reviewVideoFiles, setReviewVideoFiles] = useState([]);
  const [isSavingReviewImage, setIsSavingReviewImage] = useState(false);
  const [isSavingReviewVideo, setIsSavingReviewVideo] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [pendingReviewDraft, setPendingReviewDraft] = useState(null);
  const [displayPreferenceOpen, setDisplayPreferenceOpen] = useState(false);
  const [backendReviews, setBackendReviews] = useState([]);
  const [backendReviewSummary, setBackendReviewSummary] = useState(null);
  const [reviewMediaGallery, setReviewMediaGallery] = useState([]);
  const [backendReviewOffset, setBackendReviewOffset] = useState(0);
  const [hasMoreBackendReviews, setHasMoreBackendReviews] = useState(false);
  const [isLoadingBackendReviews, setIsLoadingBackendReviews] = useState(false);
  const [reviewMediaPreviewIndex, setReviewMediaPreviewIndex] = useState(null);
  const [reviewMediaGalleryOpen, setReviewMediaGalleryOpen] = useState(false);
  const [reviewSort, setReviewSort] = useState("recent");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [reviewerFilter, setReviewerFilter] = useState("all");
  const [productCouponCode, setProductCouponCode] = useState("");
  const [productCouponMessage, setProductCouponMessage] = useState("");
  const [productCouponApplied, setProductCouponApplied] = useState(false);
  const [productOffersOpen, setProductOffersOpen] = useState(false);
  const [productOffers, setProductOffers] = useState([]);
  const [productOffersLoading, setProductOffersLoading] = useState(false);
  const [productOffersMessage, setProductOffersMessage] = useState("");
  const [copiedProductOfferCode, setCopiedProductOfferCode] = useState("");
  const [productPaymentIconsSection, setProductPaymentIconsSection] = useState(null);
  const [storedReviews, setStoredReviews] = useState(() => (product ? readStorage(getReviewStorageKey(product.slug), []) : []));
  const hasGroupedVariants = Boolean(product?.variantGroupId);
  const selectedVariant = hasGroupedVariants
    ? (getProductVariantByKey(product, variantKey) || product?.variants?.[0] || null)
    : getProductVariantByKey(product, variantKey);
  const selectedVariantIndex = product?.variants?.findIndex((variant) => variant.key === selectedVariant?.key) ?? -1;
  const productPageKey = `${productKey || ""}:${selectedVariant?.key || ""}`;
  const groupedVariantProducts = useMemo(() => {
    if (!product?.variantGroupId) return [];

    const groupProducts = productCatalog.filter((item) => String(item.variantGroupId || "") === String(product.variantGroupId || ""));
    return [...groupProducts].sort((left, right) => {
      if (left.asin === product.asin) return -1;
      if (right.asin === product.asin) return 1;
      return String(left.variantValue || left.name).localeCompare(String(right.variantValue || right.name));
    });
  }, [product, productCatalog]);

  useEffect(() => {
    let isMounted = true;
    fetchPublicProductPaymentIcons()
      .then((response) => {
        if (isMounted) setProductPaymentIconsSection(response.data || null);
      })
      .catch(() => {
        if (isMounted) setProductPaymentIconsSection(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setProductLookup({ key: productKey, product: null, isLoading: true });
    fetchStorefrontProduct(productKey)
      .then((response) => {
        const backendProduct = response.data?.data || response.data || null;
        if (isMounted) {
          setProductLookup({
            key: productKey,
            product: backendProduct ? normalizeBackendProduct(backendProduct) : null,
            isLoading: false
          });
        }
      })
      .catch(() => {
        if (isMounted) {
          setProductLookup({ key: productKey, product: null, isLoading: false });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [productKey]);

  useEffect(() => {
    setProductOffersOpen(false);
    setProductOffers([]);
    setProductOffersMessage("");
    setCopiedProductOfferCode("");
  }, [productPageKey]);

  useEffect(() => {
    if (!product) return undefined;
    let isMounted = true;

    setProductOffersLoading(true);
    setProductOffersMessage("");
    fetchProductOffers({
      productId: product.id || product.asin || product.slug,
      category: product.category,
      categorySlug: product.collectionSlug
    })
      .then((response) => {
        if (!isMounted) return;
        const rows = Array.isArray(response.data) ? response.data : [];
        setProductOffers(rows);
        setProductOffersMessage(rows.length ? "" : "No offers available");
      })
      .catch(() => {
        if (!isMounted) return;
        setProductOffers([]);
        setProductOffersMessage("No offers available");
      })
      .finally(() => {
        if (isMounted) setProductOffersLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [product, productPageKey]);

  useEffect(() => {
    if (!product) return;
    setGalleryIndex(0);
    setQuantity(1);
    setDescriptionExpanded(false);
    setLightboxOpen(false);
    setImageZoomActive(false);
    setMobileZoomActive(false);
    setZoomMetrics({
      previewImageWidth: 0,
      previewImageHeight: 0,
      previewOffsetX: 0,
      previewOffsetY: 0,
      lensWidth: 0,
      lensHeight: 0,
      lensLeft: 0,
      lensTop: 0
    });
    setPincode("");
    setDeliveryMessage("");
    setReviewFormOpen(false);
    setGuestReviewName("");
    setGuestReviewEmail("");
    setReviewTitle("");
    setReviewBody("");
    setReviewRating(5);
    setReviewVideos([]);
    setReviewImages([]);
    setReviewImageFiles([]);
    setReviewVideoFiles([]);
    setIsSavingReviewImage(false);
    setIsSavingReviewVideo(false);
    setIsSubmittingReview(false);
    setPendingReviewDraft(null);
    setDisplayPreferenceOpen(false);
    setBackendReviews([]);
    setBackendReviewSummary(null);
    setReviewMediaGallery([]);
    setBackendReviewOffset(0);
    setHasMoreBackendReviews(false);
    setIsLoadingBackendReviews(false);
    setReviewMediaPreviewIndex(null);
    setReviewMediaGalleryOpen(false);
    setReviewSort("recent");
    setReviewFilter("all");
    setReviewerFilter("all");
    setProductCouponCode("");
    setProductCouponMessage("");
    setProductCouponApplied(false);
    setStoredReviews(readStorage(getReviewStorageKey(product.slug), []));
  }, [productPageKey]);

  useEffect(() => {
    if (!product) return undefined;

    let isMounted = true;
    const identifier = product.slug || product.asin || product.id;

    fetchProductReviewMediaGallery(identifier)
      .then((response) => {
        if (!isMounted) return;
        const rows = Array.isArray(response.data) ? response.data : [];
        setReviewMediaGallery(rows.map(normalizeReviewGalleryMedia));
      })
      .catch(() => {
        if (isMounted) setReviewMediaGallery([]);
      });

    return () => {
      isMounted = false;
    };
  }, [product]);

  useEffect(() => {
    if (!product) return undefined;

    let isMounted = true;
    const identifier = product.slug || product.asin || product.id;

    fetchProductReviewSummary(identifier)
      .then((response) => {
        if (!isMounted) return;
        setBackendReviewSummary(response.data || null);
      })
      .catch(() => {
        if (isMounted) setBackendReviewSummary(null);
      });

    return () => {
      isMounted = false;
    };
  }, [product]);

  useEffect(() => {
    if (!product) return undefined;

    let isMounted = true;
    const identifier = product.slug || product.asin || product.id;
    const rating = reviewFilter === "all" ? "" : reviewFilter;
    const verifiedOnly = reviewerFilter === "verified" || reviewSort === "verified" ? "true" : "";

    setIsLoadingBackendReviews(true);
    setBackendReviews([]);
    setBackendReviewOffset(0);
    setHasMoreBackendReviews(false);

    fetchStorefrontProductReviews(identifier, "", {
      limit: REVIEW_PAGE_SIZE,
      offset: 0,
      sort: reviewSort,
      rating,
      verifiedOnly
    })
      .then((response) => {
        if (!isMounted) return;
        const rows = Array.isArray(response.data) ? response.data : [];
        setBackendReviews(rows.map(normalizeStorefrontReview));
        setBackendReviewOffset(rows.length);
        setHasMoreBackendReviews(Boolean(response.pagination?.hasMore));
      })
      .catch(() => {
        if (isMounted) setBackendReviews([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingBackendReviews(false);
      });

    return () => {
      isMounted = false;
    };
  }, [product, reviewSort, reviewFilter, reviewerFilter]);

  useEffect(() => () => {
    if (mobileZoomTimerRef.current) {
      window.clearTimeout(mobileZoomTimerRef.current);
    }
  }, []);

  useEffect(() => {
    document.body.classList.add("product-page");
    return () => document.body.classList.remove("product-page");
  }, []);

  useEffect(() => {
    if (!reviewFormOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setReviewFormOpen(false);
      }
    };

    document.body.classList.add("avy-modal-open");
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("avy-modal-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [reviewFormOpen]);

  useEffect(() => {
    if (!product) return;
    const viewKey = `${product.slug || product.asin}:${selectedVariant?.key || ""}`;
    if (productViewKeyRef.current === viewKey) return;
    productViewKeyRef.current = viewKey;
    trackAnalyticsEvent({
      eventType: "product_view",
      productAsin: product.asin,
      productSlug: product.slug,
      metadata: {
        productName: product.name,
        brand: product.brand,
        variantLabel: selectedVariant?.label || ""
      }
    });
  }, [product, selectedVariant?.key]);

  useEffect(() => {
    if (!lightboxOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setLightboxOpen(false);
      if (event.key === "ArrowRight") setGalleryIndex((current) => current + 1);
      if (event.key === "ArrowLeft") setGalleryIndex((current) => current - 1);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxOpen]);

  useEffect(() => {
    if (!mobileZoomActive) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.classList.add("product-zoom-active");
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.classList.remove("product-zoom-active");
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [mobileZoomActive]);

  if (!product && (context.isProductCatalogLoading || isFetchingProduct)) {
    return (
      <main className="container product-page-main">
        <div className="avy-surface-card" style={{ padding: "2rem", color: "#475569", fontWeight: 700 }}>
          Loading product details...
        </div>
      </main>
    );
  }

  if (!product) return <Navigate to="/" replace />;

  if (!hasGroupedVariants && Array.isArray(product.variants) && product.variants.length) {
    const fallbackPath = buildProductPath(product, product.variants[0]);
    if (!variantKey || !selectedVariant) {
      return <Navigate to={fallbackPath} replace />;
    }
  }

  const siteSettings = getSiteSettings(context);
  const shippingSettings = siteSettings.shipping || {};
  const paymentSettings = siteSettings.payment || {};
  const availablePaymentMethods = getCheckoutPaymentMethods(context);
  const hasDynamicPaymentSection = productPaymentIconsSection && typeof productPaymentIconsSection === "object";
  const dynamicPaymentItems = Array.isArray(productPaymentIconsSection?.items)
    ? productPaymentIconsSection.items
      .filter((item) => item.status !== "inactive")
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    : [];
  const paymentSectionVisible = hasDynamicPaymentSection
    ? productPaymentIconsSection.enabled !== false && dynamicPaymentItems.length > 0
    : availablePaymentMethods.length > 0;
  const paymentSectionSettings = productPaymentIconsSection?.section || {};
  const productPaymentItems = dynamicPaymentItems.length
    ? dynamicPaymentItems
    : availablePaymentMethods.map((method, index) => {
      const logo = PAYMENT_LOGOS[index % PAYMENT_LOGOS.length];
      return {
        id: method.id,
        paymentName: method.label,
        altText: method.label,
        iconUrl: logo.src,
        iconSize: 44,
        iconBackgroundColor: "#ffffff",
        iconBorderColor: "rgba(20, 36, 84, 0.08)",
        iconRadius: 14,
        sortOrder: index + 1,
        status: "active"
      };
    });
  const dynamicDeliveryText = `Estimated Delivery: ${shippingSettings.deliveryTime || "3 to 5 business days"}`;
  const dynamicDispatchText = `Dispatch Time: ${shippingSettings.dispatchTime || "24 to 48 hours"}`;
  const dynamicShippingText = shippingSettings.shippingCharges
    ? `Shipping: ${shippingSettings.shippingCharges}`
    : (product.shippingText || "Shipping: Secure packaging with safe handling");
  const dynamicCodText = paymentSettings.codEnabled
    ? "COD: Available for eligible locations"
    : "COD: Currently disabled for this store";

  const galleryItems = getGalleryItems(product, selectedVariant);
  const safeGalleryIndex = ((galleryIndex % galleryItems.length) + galleryItems.length) % galleryItems.length;
  const activeMedia = galleryItems[safeGalleryIndex];
  const availableStock = Number(selectedVariant?.availableStock ?? product.availableStock ?? 0);
  const safeQuantity = Math.max(1, Math.min(quantity, Math.max(1, availableStock || 1)));
  const salePrice = Number(selectedVariant?.price ?? product.price);
  const mrp = Number(selectedVariant?.mrp ?? product.mrp);
  const discount = mrp > salePrice ? Math.round(((mrp - salePrice) / mrp) * 100) : 0;
  const isWishlisted = context.wishlist.some(
    (item) => item.slug === product.slug && String(item.variantLabel || "") === String(selectedVariant?.label || "")
  );
  const isLowStock = availableStock > 0 && availableStock <= 5;
  const stockTone = availableStock === 0 ? "out" : isLowStock ? "low" : "in";
  const stockLabel = availableStock === 0 ? "Out of Stock" : isLowStock ? `Only ${availableStock} left in stock` : "In Stock";
  const related = productCatalog
    .filter((item) => item.slug !== product.slug && (item.brand === product.brand || item.collectionSlug === product.collectionSlug))
    .slice(0, 4);
  const visibleStoredReviews = storedReviews.filter(isPublicReview);
  const visibleLocalProductReviews = (product.reviews || []).filter(isPublicReview);
  const combinedReviews = [...visibleStoredReviews, ...backendReviews, ...visibleLocalProductReviews];
  const publicReviews = combinedReviews.filter(isPublicReview);
  const displayedReviews = filterAndSortReviews(publicReviews, reviewFilter, reviewerFilter, reviewSort);
  const reviewStats = backendReviewSummary?.totalReviews
    ? {
      average: Number(backendReviewSummary.averageRating || 0),
      breakdown: backendReviewSummary.breakdown || []
    }
    : getReviewStats(publicReviews, product.reviewSummary?.average);
  const publicReviewCount = Number(backendReviewSummary?.totalReviews || publicReviews.length);
  const customerMedia = reviewMediaGallery.length ? reviewMediaGallery : getCustomerMedia(publicReviews);
  const activeReviewMedia = reviewMediaPreviewIndex === null || !customerMedia.length
    ? null
    : customerMedia[((reviewMediaPreviewIndex % customerMedia.length) + customerMedia.length) % customerMedia.length];
  const descriptionPreview = descriptionExpanded ? product.description || [] : (product.description || []).slice(0, 2);
  const reviewerDisplayName = context.authUser?.fullName || context.customerProfile?.firstName || context.authUser?.email || "Avyona Customer";

  const addSelectedQuantityToCart = (triggerElement = null) => {
    context.addToCart(product, selectedVariant, safeQuantity, triggerElement);
  };

  const applyProductCoupon = (event) => {
    event.preventDefault();
    const result = validateCoupon(productCouponCode, {
      items: [{ ...product, price: salePrice, quantity: safeQuantity }],
      subtotal: salePrice * safeQuantity,
      coupons: context.coupons || []
    });

    setProductCouponMessage(result.message);
    setProductCouponApplied(result.valid);

    if (result.valid) {
      writeStorage("avyonaPendingCoupon", result.coupon.code);
      setProductCouponCode(result.coupon.code);
      context.notify(`${result.coupon.code} ready for checkout`);
    }
  };

  const loadProductOffers = async () => {
    if (productOffersOpen) {
      setProductOffersOpen(false);
      return;
    }

    setProductOffersOpen(true);
  };

  const copyProductOffer = (offer) => {
    copyText(offer.code, () => {
      setCopiedProductOfferCode(offer.code);
      window.setTimeout(() => setCopiedProductOfferCode((current) => current === offer.code ? "" : current), 1800);
    });
  };

  const applyProductOffer = (offer) => {
    setProductCouponCode(offer.code);
    setProductCouponApplied(true);
    setProductCouponMessage(`${offer.code} ready for checkout.`);
    writeStorage("avyonaPendingCoupon", offer.code);
    context.notify(`${offer.code} ready for checkout`);
  };

  const handleBuyNow = (triggerElement = null) => {
    addSelectedQuantityToCart(triggerElement);
    navigate("/checkout");
  };

  const handlePincodeCheck = (event) => {
    event.preventDefault();
    const trimmed = pincode.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setDeliveryMessage("Enter a valid 6-digit pincode to check delivery.");
      return;
    }
    setDeliveryMessage(`Delivery to ${trimmed} is available in ${shippingSettings.deliveryTime || "3 to 5 business days"}. Dispatch starts within ${shippingSettings.dispatchTime || "24 to 48 hours"}.`);
  };

  const loadMoreReviews = () => {
    if (!product || isLoadingBackendReviews || !hasMoreBackendReviews) return;

    const identifier = product.slug || product.asin || product.id;
    const rating = reviewFilter === "all" ? "" : reviewFilter;
    const verifiedOnly = reviewerFilter === "verified" || reviewSort === "verified" ? "true" : "";

    setIsLoadingBackendReviews(true);
    fetchStorefrontProductReviews(identifier, "", {
      limit: REVIEW_PAGE_SIZE,
      offset: backendReviewOffset,
      sort: reviewSort,
      rating,
      verifiedOnly
    })
      .then((response) => {
        const rows = Array.isArray(response.data) ? response.data : [];
        setBackendReviews((current) => [...current, ...rows.map(normalizeStorefrontReview)]);
        setBackendReviewOffset((current) => current + rows.length);
        setHasMoreBackendReviews(Boolean(response.pagination?.hasMore));
      })
      .catch(() => {
        context.notify("More reviews could not be loaded");
      })
      .finally(() => {
        setIsLoadingBackendReviews(false);
      });
  };

  const updateZoomMetrics = (pointerEvent = null) => {
    if (!stageRef.current || !imageRef.current || !previewRef.current) return;

    const stageBounds = stageRef.current.getBoundingClientRect();
    const imageBounds = imageRef.current.getBoundingClientRect();
    const previewWidth = Number(previewRef.current.clientWidth || 0);
    const previewHeight = Number(previewRef.current.clientHeight || 0);
    const imageWidth = Number(imageBounds.width || 0);
    const imageHeight = Number(imageBounds.height || 0);

    if (!previewWidth || !previewHeight || !imageWidth || !imageHeight) return;

    const zoomLevel = 2.6;
    const lensWidth = Math.min(imageWidth, previewWidth / zoomLevel);
    const lensHeight = Math.min(imageHeight, previewHeight / zoomLevel);
    const pointerX = pointerEvent ? pointerEvent.clientX : imageBounds.left + (imageWidth / 2);
    const pointerY = pointerEvent ? pointerEvent.clientY : imageBounds.top + (imageHeight / 2);
    const relativeX = Math.max(0, Math.min(imageWidth, pointerX - imageBounds.left));
    const relativeY = Math.max(0, Math.min(imageHeight, pointerY - imageBounds.top));
    const halfLensWidth = lensWidth / 2;
    const halfLensHeight = lensHeight / 2;
    const clampedLensX = Math.max(halfLensWidth, Math.min(imageWidth - halfLensWidth, relativeX));
    const clampedLensY = Math.max(halfLensHeight, Math.min(imageHeight - halfLensHeight, relativeY));
    const previewImageWidth = imageWidth * zoomLevel;
    const previewImageHeight = imageHeight * zoomLevel;
    const previewOffsetX = Math.min(0, Math.max(previewWidth - previewImageWidth, (previewWidth / 2) - (clampedLensX * zoomLevel)));
    const previewOffsetY = Math.min(0, Math.max(previewHeight - previewImageHeight, (previewHeight / 2) - (clampedLensY * zoomLevel)));

    setZoomMetrics({
      previewImageWidth,
      previewImageHeight,
      previewOffsetX,
      previewOffsetY,
      lensWidth,
      lensHeight,
      lensLeft: (imageBounds.left - stageBounds.left) + clampedLensX,
      lensTop: (imageBounds.top - stageBounds.top) + clampedLensY
    });
  };

  const clearMobileZoomTimer = () => {
    if (!mobileZoomTimerRef.current) return;
    window.clearTimeout(mobileZoomTimerRef.current);
    mobileZoomTimerRef.current = null;
  };

  const closeMobileZoom = () => {
    clearMobileZoomTimer();
    mobileZoomTouchRef.current = null;
    setMobileZoomActive(false);
    setImageZoomActive(false);
  };

  const handleStageTouchStart = (event) => {
    if (activeMedia.type !== "image") return;

    clearMobileZoomTimer();

    const firstTouch = event.touches?.[0];
    if (!firstTouch) return;

    mobileZoomTouchRef.current = {
      startX: firstTouch.clientX,
      startY: firstTouch.clientY
    };

    mobileZoomTimerRef.current = window.setTimeout(() => {
      updateZoomMetrics(firstTouch);
      setMobileZoomActive(true);
      setImageZoomActive(true);
      mobileZoomTimerRef.current = null;
    }, MOBILE_ZOOM_HOLD_MS);
  };

  const handleStageTouchMove = (event) => {
    if (activeMedia.type !== "image") return;

    const firstTouch = event.touches?.[0];
    if (!firstTouch) return;

    if (mobileZoomActive) {
      event.preventDefault();
      updateZoomMetrics(firstTouch);
      return;
    }

    if (!mobileZoomTouchRef.current) return;

    const movedX = Math.abs(firstTouch.clientX - mobileZoomTouchRef.current.startX);
    const movedY = Math.abs(firstTouch.clientY - mobileZoomTouchRef.current.startY);

    if (movedX > 14 || movedY > 14) {
      clearMobileZoomTimer();
      mobileZoomTouchRef.current = null;
    }
  };

  const processReviewImageFiles = async (files) => {
    if (!files.length) {
      setReviewImages([]);
      setReviewImageFiles([]);
      return;
    }

    if (files.some((file) => !["image/jpeg", "image/png"].includes(file.type))) {
      context.notify("Please upload JPG or PNG review images");
      return;
    }

    setReviewImageFiles(files);
    setIsSavingReviewImage(true);
    try {
      const compressedImages = await Promise.all(files.map((file) => compressImageFile(file, 900, 0.82)));
      setReviewImages(compressedImages);
    } catch {
      context.notify("One or more review images could not be processed");
    } finally {
      setIsSavingReviewImage(false);
    }
  };

  const processReviewVideoFiles = async (files) => {
    if (!files.length) {
      setReviewVideos([]);
      setReviewVideoFiles([]);
      return;
    }

    if (files.some((file) => !file.type.startsWith("video/"))) {
      context.notify("Please upload a valid review video");
      return;
    }

    setReviewVideoFiles(files);
    setIsSavingReviewVideo(true);
    try {
      const videoPreviews = await Promise.all(files.map(readFileAsDataUrl));
      setReviewVideos(videoPreviews);
    } catch {
      context.notify("One or more review videos could not be processed");
      setReviewVideos([]);
    } finally {
      setIsSavingReviewVideo(false);
    }
  };

  const processReviewMediaFiles = async (files) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    const videoFiles = files.filter((file) => file.type.startsWith("video/"));
    const unsupportedFiles = files.filter((file) => !file.type.startsWith("image/") && !file.type.startsWith("video/"));

    if (unsupportedFiles.length) {
      context.notify("Please upload image or video files only");
      return;
    }

    await Promise.all([
      processReviewImageFiles(imageFiles),
      processReviewVideoFiles(videoFiles)
    ]);
  };

  const handleReviewMediaChange = (event) => {
    processReviewMediaFiles(Array.from(event.target.files || []));
  };

  const handleReviewFileDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const files = Array.from(event.dataTransfer.files || []);
    processReviewMediaFiles(files);
  };

  const openReviewForm = () => {
    setReviewFormOpen(true);
  };

  const submitReview = (event) => {
    event.preventDefault();
    if (isSavingReviewImage || isSavingReviewVideo || isSubmittingReview) return;
    if (!reviewBody.trim()) {
      context.notify("Please write your review before submitting.");
      return;
    }

    const isLoggedInReview = Boolean(context.authUser);

    setPendingReviewDraft({
      title: reviewTitle.trim() || `${reviewRating} star review`,
      rating: reviewRating,
      date: new Date().toLocaleString("en-IN", { month: "long", year: "numeric" }),
      body: reviewBody.trim(),
      images: reviewImages,
      videos: reviewVideos,
      reviewType: isLoggedInReview ? REVIEW_TYPES.CUSTOMER : REVIEW_TYPES.GUEST,
      visibilityStatus: REVIEW_VISIBILITY_STATUSES.HIDDEN,
      isVerifiedPurchase: false,
      customerId: context.authUser?.id || null,
      reviewerName: isLoggedInReview ? reviewerDisplayName : guestReviewName.trim(),
      reviewerEmail: isLoggedInReview ? context.authUser?.email || "" : guestReviewEmail.trim()
    });
    setDisplayPreferenceOpen(true);
  };

  const completeReviewSubmission = async (isAnonymous) => {
    if (!pendingReviewDraft || isSubmittingReview) return;

    setIsSubmittingReview(true);
    setDisplayPreferenceOpen(false);

    const nextReview = {
      ...pendingReviewDraft,
      name: isAnonymous
        ? (pendingReviewDraft.reviewType === REVIEW_TYPES.GUEST ? "Anonymous Guest" : "Anonymous Customer")
        : pendingReviewDraft.reviewerName || "Guest Customer",
      reviewerEmail: pendingReviewDraft.reviewerEmail || "",
      isAnonymous,
      isVerifiedPurchase: pendingReviewDraft.reviewType === REVIEW_TYPES.GUEST ? false : pendingReviewDraft.isVerifiedPurchase
    };

    try {
      const uploadedMedia = [];
      const resolvedProductId = Number(product.id || fetchedProduct?.id || 0);

      const uploadReviewMedia = pendingReviewDraft.reviewType === REVIEW_TYPES.CUSTOMER
        ? uploadCustomerReviewMedia
        : uploadGuestReviewMedia;

      for (const imageFile of reviewImageFiles) {
        const response = await uploadReviewMedia(imageFile);
        const media = response.data;
        if (media?.url) uploadedMedia.push({ mediaType: media.mediaType || "image", mediaUrl: media.url, sortOrder: uploadedMedia.length + 1 });
      }

      for (const videoFile of reviewVideoFiles) {
        const response = await uploadReviewMedia(videoFile);
        const media = response.data;
        if (media?.url) uploadedMedia.push({ mediaType: media.mediaType || "video", mediaUrl: media.url, sortOrder: uploadedMedia.length + 1 });
      }

      if (pendingReviewDraft.reviewType === REVIEW_TYPES.GUEST) {
        nextReview.visibilityStatus = REVIEW_VISIBILITY_STATUSES.HIDDEN;
      }

      const payload = {
        productId: resolvedProductId || undefined,
        productIdentifier: product.slug || product.asin || productKey,
        productSlug: product.slug || productKey,
        productAsin: product.asin || "",
        productSnapshot: {
          name: product.name,
          slug: product.slug || productKey,
          asin: product.asin || product.sku || "",
          sku: product.sku || product.asin || "",
          brand: product.brand || "Avyona",
          shortDescription: product.shortDescription || product.highlights?.[0] || "",
          description: product.description || "",
          price: product.price,
          mrp: product.mrp,
          availableStock: product.availableStock,
          image: product.image || product.gallery?.[0] || ""
        },
        reviewerName: nextReview.name,
        reviewerEmail: nextReview.reviewerEmail,
        rating: Number(nextReview.rating),
        reviewTitle: nextReview.title,
        reviewText: nextReview.body,
        isAnonymous,
        visibilityStatus: pendingReviewDraft.reviewType === REVIEW_TYPES.CUSTOMER
          ? REVIEW_VISIBILITY_STATUSES.PRIVATE_TO_REVIEWER
          : REVIEW_VISIBILITY_STATUSES.HIDDEN,
        media: uploadedMedia
      };

      const response = pendingReviewDraft.reviewType === REVIEW_TYPES.CUSTOMER
        ? await submitCustomerReviewApi(payload)
        : await submitGuestReviewApi(payload);
      const savedReview = response.data || {};

      const savedLocalReview = {
        ...nextReview,
        reviewId: savedReview.reviewId,
        visibilityStatus: savedReview.visibilityStatus || payload.visibilityStatus,
        isVerifiedPurchase: Boolean(savedReview.isVerifiedPurchase),
        images: uploadedMedia.filter((media) => media.mediaType === "image").map((media) => resolveReviewMediaUrl(media.mediaUrl)),
        videos: uploadedMedia.filter((media) => media.mediaType === "video").map((media) => resolveReviewMediaUrl(media.mediaUrl)),
        customerId: context.authUser?.id || null,
        date: new Date().toISOString()
      };

      if (pendingReviewDraft.reviewType === REVIEW_TYPES.CUSTOMER) {
        setBackendReviews((current) => [savedLocalReview, ...current]);
      } else {
        const nextReviews = [savedLocalReview, ...storedReviews];
        setStoredReviews(nextReviews);
        writeStorage(getReviewStorageKey(product.slug), nextReviews);
      }

      setGuestReviewName("");
      setGuestReviewEmail("");
      setReviewTitle("");
      setReviewBody("");
      setReviewRating(5);
      setReviewVideos([]);
      setReviewImages([]);
      setReviewImageFiles([]);
      setReviewVideoFiles([]);
      const savedVisibilityStatus = savedReview.visibilityStatus || payload.visibilityStatus;
      const shouldShowSubmittedMedia = savedVisibilityStatus === REVIEW_VISIBILITY_STATUSES.PUBLIC
        || (savedVisibilityStatus === REVIEW_VISIBILITY_STATUSES.PRIVATE_TO_REVIEWER && pendingReviewDraft.reviewType === REVIEW_TYPES.CUSTOMER);

      if (shouldShowSubmittedMedia) {
        setReviewMediaGallery((current) => [
          ...uploadedMedia.map((media, index) => ({
            key: `submitted-media-${savedReview.reviewId || Date.now()}-${index}`,
            type: media.mediaType,
            src: resolveReviewMediaUrl(media.mediaUrl),
            alt: `${nextReview.name} review ${media.mediaType} ${index + 1}`
          })),
          ...current
        ]);
      }
      setPendingReviewDraft(null);
      setReviewFormOpen(false);
      context.notify({
        variant: "success",
        title: "Thank you for your review",
        message: "Your feedback was submitted successfully and will help other customers shop with confidence.",
        duration: 4200
      });
    } catch (error) {
      context.notify(error.message || "Review could not be submitted");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <main className="container product-page-main">
      <div className="product-breadcrumb breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to={categoryRouteMap[product.collectionSlug] || "/collections"}>{product.category}</Link>
        <span>/</span>
        <span>{product.name}</span>
      </div>

      <section className="avy-product-hero">
        <div className="avy-product-gallery-card">
          <div className="avy-gallery-meta">
            <span className="avy-gallery-count">{safeGalleryIndex + 1} / {galleryItems.length}</span>
            <button type="button" className="avy-zoom-button" onClick={() => setLightboxOpen(true)}>View Fullscreen</button>
          </div>
          <div className={`avy-gallery-stage-shell ${mobileZoomActive ? "is-mobile-zoom-shell" : ""}`}>
            <div
              className={`avy-gallery-stage ${product.collectionSlug === "digital-photo-frames" ? "is-frame-product" : ""} ${activeMedia.type === "image" ? "is-image-stage" : ""} ${imageZoomActive ? "is-zoom-active" : ""} ${mobileZoomActive ? "is-mobile-zoom-active" : ""}`}
              ref={stageRef}
              onContextMenu={(event) => {
                if (activeMedia.type === "image") {
                  event.preventDefault();
                }
              }}
              onMouseEnter={() => {
                if (activeMedia.type === "image") {
                  updateZoomMetrics();
                  setImageZoomActive(true);
                }
              }}
              onMouseMove={(event) => {
                if (activeMedia.type !== "image") return;
                updateZoomMetrics(event);
              }}
              onMouseLeave={() => {
                setImageZoomActive(false);
              }}
              onTouchStart={handleStageTouchStart}
              onTouchMove={handleStageTouchMove}
              onTouchEnd={closeMobileZoom}
              onTouchCancel={closeMobileZoom}
              role={activeMedia.type === "image" ? "img" : undefined}
              aria-label={activeMedia.type === "image" ? "Product image zoom preview" : undefined}
            >
            {activeMedia.type === "placeholder" ? (
              <ProductMediaFallback />
            ) : activeMedia.type === "video" ? (
              <video controls poster={product.videoPoster || product.image} src={activeMedia.src} />
            ) : (
              <>
                <img
                  ref={imageRef}
                  className="avy-gallery-main-image"
                  src={activeMedia.src}
                  alt={activeMedia.alt}
                  draggable="false"
                  onContextMenu={(event) => event.preventDefault()}
                  onDragStart={(event) => event.preventDefault()}
                  onLoad={() => updateZoomMetrics()}
                />
                <span
                  className={`avy-gallery-zoom-lens ${imageZoomActive ? "is-visible" : ""}`}
                  aria-hidden="true"
                  style={{
                    left: `${zoomMetrics.lensLeft}px`,
                    top: `${zoomMetrics.lensTop}px`,
                    width: zoomMetrics.lensWidth ? `${zoomMetrics.lensWidth}px` : undefined,
                    height: zoomMetrics.lensHeight ? `${zoomMetrics.lensHeight}px` : undefined
                  }}
                />
                <span className="avy-gallery-zoom-hint">{mobileZoomActive ? "Release to close zoom" : "Hover or press and hold to zoom"}</span>
              </>
            )}
            </div>
            {activeMedia.type === "image" ? (
              <div
                className={`avy-gallery-zoom-panel ${imageZoomActive ? "is-visible" : ""} ${mobileZoomActive ? "is-mobile-visible" : ""}`}
                aria-hidden={!imageZoomActive}
              >
                <div ref={previewRef} className="avy-gallery-zoom-preview">
                  <img
                    className="avy-gallery-zoom-preview-image"
                    src={activeMedia.src}
                    alt=""
                    aria-hidden="true"
                    style={{
                      width: zoomMetrics.previewImageWidth ? `${zoomMetrics.previewImageWidth}px` : undefined,
                      height: zoomMetrics.previewImageHeight ? `${zoomMetrics.previewImageHeight}px` : undefined,
                      transform: `translate(${zoomMetrics.previewOffsetX}px, ${zoomMetrics.previewOffsetY}px)`
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
          <div className={`avy-gallery-strip ${mobileZoomActive ? "is-hidden-during-zoom" : ""}`}>
            {galleryItems.map((item, index) => (
              <button
                key={`${item.src}:${index}`}
                type="button"
                className={`avy-gallery-thumb ${safeGalleryIndex === index ? "is-active" : ""}`}
                onClick={() => {
                  setGalleryIndex(index);
                  setImageZoomActive(false);
                }}
              >
                {item.type === "placeholder" ? (
                  <ProductMediaFallback compact />
                ) : (
                  <img src={item.thumb || item.src} alt={item.alt} />
                )}
                {item.type === "video" ? <span className="avy-gallery-badge">Video</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="avy-product-summary">
          <div className="avy-summary-card">
            <div className="avy-brand-row">
              <Link className="avy-brand-link" to={categoryRouteMap[product.collectionSlug] || "/collections"}>
                By {product.brand}
              </Link>
              <div className="avy-brand-actions">
                <button type="button" className={`avy-text-action ${isWishlisted ? "is-active" : ""}`} onClick={() => context.toggleWishlist(product, selectedVariant)}>
                  {isWishlisted ? "Wishlisted" : "Wishlist"}
                </button>
                <button type="button" className="avy-text-action" onClick={() => copyText(window.location.href, () => context.notify("Product link copied"))}>
                  Share
                </button>
              </div>
            </div>

            <h1 className="avy-product-title">{product.name}</h1>

            <div className="avy-review-row">
              <span className="avy-review-stars">{renderStars(reviewStats.average)}</span>
              <strong>{reviewStats.average.toFixed(1)}</strong>
              <a href="#customer-reviews">{publicReviewCount} Ratings</a>
              <a href="#customer-media">Customer Photos & Videos</a>
            </div>

            <div className="avy-price-block">
              <div className="avy-price-line">
                <strong>{formatCurrency(salePrice, context)}</strong>
                <span className="avy-mrp">{formatCurrency(mrp, context)}</span>
                {discount > 0 ? <span className="avy-discount-badge">{discount}% OFF</span> : null}
              </div>
              <p>{product.taxText}</p>
            </div>

            <div className={`avy-stock-chip ${stockTone}`}>
              <span>{stockLabel}</span>
              {availableStock > 0 ? <small>{product.stockNote}</small> : <small>{product.stockNote}</small>}
            </div>

            <section className="avy-product-coupon-box">
              <form className="avy-product-coupon-form" onSubmit={applyProductCoupon}>
                <label>
                  <span>Coupon Code</span>
                  <div className="avy-product-coupon-row">
                    <input
                      value={productCouponCode}
                      onChange={(event) => {
                        setProductCouponCode(event.target.value.toUpperCase());
                        setProductCouponApplied(false);
                        setProductCouponMessage("");
                      }}
                      placeholder="SUMMER15"
                      aria-label="Coupon code"
                    />
                    <button type="submit">Apply</button>
                  </div>
                </label>
                {productCouponMessage ? (
                  <p className={productCouponApplied ? "avy-product-coupon-message success" : "avy-product-coupon-message"}>
                    {productCouponApplied ? `${productCouponMessage} It will be available in checkout.` : productCouponMessage}
                  </p>
                ) : null}
              </form>
              <div className="avy-product-offers">
                {productOffersLoading ? <p className="avy-product-offers-note">Loading offers...</p> : null}
                {!productOffersLoading && productOffers.length ? (
                  <button type="button" className="avy-product-offers-toggle" onClick={loadProductOffers}>
                    Show All Offers
                  </button>
                ) : null}
                {!productOffersLoading && !productOffers.length ? <p className="avy-product-offers-note">No offers available</p> : null}
                {productOffersOpen ? (
                  <div className="avy-product-offers-dropdown">
                    {productOffersMessage && productOffers.length ? <p className="avy-product-offers-note">{productOffersMessage}</p> : null}
                    {productOffers.map((offer) => (
                      <article key={offer.id || offer.code} className="avy-product-offer-row">
                        <div className="avy-product-offer-copy">
                          <strong>{offer.title || offer.badgeText || "Product offer"}</strong>
                          <span className="avy-product-offer-code">{offer.code}</span>
                          {copiedProductOfferCode === offer.code ? <small className="avy-product-offer-copy-message">Coupon copied</small> : null}
                          <small>{`${formatOfferDiscount(offer)} | Min order ${formatCurrency(offer.minSubtotal || 0, context)}${offer.endDate ? ` | Expires ${offer.endDate}` : ""}`}</small>
                        </div>
                        <div className="avy-product-offer-actions">
                          <button type="button" onClick={() => copyProductOffer(offer)}>Copy</button>
                          <button type="button" onClick={() => applyProductOffer(offer)}>Apply</button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            {hasGroupedVariants && groupedVariantProducts.length > 1 ? (
              <div className="avy-block">
                <div className="avy-variant-list">
                  {groupedVariantProducts.map((groupProduct) => {
                    const groupProductVariant = groupProduct.variants?.[0] || null;
                    const isActive = groupProduct.asin === product.asin;
                    const displayLabel = getVariantDisplayLabel(groupProduct, groupProductVariant?.label);

                    return (
                      <button
                        key={groupProduct.asin}
                        type="button"
                        className={`avy-variant-chip ${isActive ? "is-active" : ""}`}
                        onClick={() => navigate(buildProductPath(groupProduct))}
                      >
                        <span className="avy-variant-media">
                          {hasMediaUrl(groupProduct.image) ? (
                            <img src={groupProduct.image} alt={groupProduct.variantValue || groupProduct.name} />
                          ) : (
                            <ProductMediaFallback compact />
                          )}
                        </span>
                        <span className="avy-variant-copy">
                          <span>{displayLabel}</span>
                          <strong>{formatCurrency(groupProductVariant?.price ?? groupProduct.price, context)}</strong>
                          {Number(groupProduct.mrp || 0) > Number((groupProductVariant?.price ?? groupProduct.price) || 0) ? (
                            <del>{formatCurrency(groupProduct.mrp, context)}</del>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (product.variants || []).length ? (
              <div className="avy-block">
                <div className="avy-variant-list">
                  {(product.variants || []).map((variant, index) => (
                    <button
                      key={variant.key}
                      type="button"
                      className={`avy-variant-chip ${selectedVariantIndex === index ? "is-active" : ""}`}
                      onClick={() => {
                        navigate(buildProductPath(product, variant));
                      }}
                    >
                      <span className="avy-variant-media">
                        {hasMediaUrl(variant.image || product.image) ? (
                          <img src={variant.image || product.image} alt={variant.label} />
                        ) : (
                          <ProductMediaFallback compact />
                        )}
                      </span>
                      <span className="avy-variant-copy">
                        <span>{getVariantDisplayLabel(variant, variant.label)}</span>
                        <strong>{formatCurrency(variant.price, context)}</strong>
                        {Number(variant.mrp || 0) > Number(variant.price || 0) ? (
                          <del>{formatCurrency(variant.mrp, context)}</del>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="avy-block">
              <div className="avy-section-minihead">
                <span>Quantity</span>
                {availableStock > 0 ? <strong>{availableStock} available</strong> : <strong>Currently unavailable</strong>}
              </div>
              <div className="avy-quantity-row">
                <div className="avy-quantity-stepper">
                  <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} disabled={safeQuantity <= 1}>-</button>
                  <span>{safeQuantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.min(Math.max(1, availableStock || 1), current + 1))}
                    disabled={availableStock === 0 || safeQuantity >= availableStock}
                  >
                    +
                  </button>
                </div>
                {isLowStock ? <p className="avy-quantity-note">Limited stock. Order soon for faster dispatch.</p> : null}
              </div>
            </div>

            <div className="avy-block">
              <h2 className="avy-block-title">Product Details</h2>
              <ul className="avy-bullet-list">
                {(product.highlights || []).slice(0, 6).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <details className="avy-accordion" open>
              <summary>Delivery Information</summary>
              <div className="avy-accordion-body">
                <div className="avy-delivery-lines">
                  <p>{dynamicDeliveryText}</p>
                  <p>{dynamicDispatchText}</p>
                  <p>{dynamicCodText}</p>
                  <p>{dynamicShippingText}</p>
                  <p>{`SKU: ${product.sku} | ASIN: ${product.asin}`}</p>
                </div>
              </div>
            </details>

            <div className="avy-delivery-check">
              <div className="avy-delivery-check-copy">
                <strong>Check Delivery</strong>
                <span>Enter your pincode for serviceability.</span>
              </div>
              <form className="avy-pincode-form compact" onSubmit={handlePincodeCheck}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter pincode"
                  value={pincode}
                  onChange={(event) => setPincode(event.target.value.replace(/\D+/g, ""))}
                />
                <button type="submit">Check</button>
              </form>
              {deliveryMessage ? <p className="avy-helper-note avy-delivery-message">{deliveryMessage}</p> : null}
            </div>

            <div className="avy-cta-stack">
              <button className="avy-button-primary" type="button" onClick={(event) => handleBuyNow(event.currentTarget)} disabled={availableStock === 0}>Buy Now</button>
              <button className="avy-button-secondary" type="button" onClick={(event) => addSelectedQuantityToCart(event.currentTarget)} disabled={availableStock === 0}>Add to Cart</button>
            </div>

            <div className="avy-quick-assurance">
              <span>{paymentSettings.codEnabled ? "Cash on Delivery Available" : "Prepaid Checkout Enabled"}</span>
              <span>Secure Payments Supported</span>
              <span>Warranty Available</span>
            </div>

            {paymentSectionVisible ? (
              <section
                className="avy-payment-card avyona-product-payment-icons"
                style={{
                  "--payment-icons-per-row": Math.min(10, Math.max(1, Number(paymentSectionSettings.cardsPerRow || 4))),
                  "--payment-icons-mobile-per-row": Math.min(3, Math.max(1, Number(paymentSectionSettings.mobileCardsPerRow || 3))),
                  "--payment-icon-count": Math.max(1, productPaymentItems.length),
                  background: paymentSectionSettings.backgroundColor || undefined,
                  color: paymentSectionSettings.textColor || undefined
                }}
              >
                {paymentSectionSettings.customCss ? <style>{paymentSectionSettings.customCss}</style> : null}
                <h2>{paymentSectionSettings.title || "Available Payment Options"}</h2>
                {paymentSectionSettings.subtitle ? <p className="avy-payment-subtitle">{paymentSectionSettings.subtitle}</p> : null}
                <div className="avy-payment-grid">
                  {productPaymentItems.map((item) => (
                    <div
                      key={item.id}
                      className="avy-payment-icon payment-icon-card"
                      title={item.paymentName}
                      style={{
                        background: item.iconBackgroundColor || "#ffffff",
                        borderColor: item.iconBorderColor || "rgba(20, 36, 84, 0.08)",
                        borderRadius: `${Math.min(48, Math.max(0, Number(item.iconRadius || 14)))}px`
                      }}
                    >
                      {item.iconUrl ? (
                        <img
                          src={resolveMediaUrl(item.iconUrl)}
                          alt={item.altText || item.paymentName}
                          style={{
                            width: `${Math.min(120, Math.max(16, Number(item.iconSize || 44)))}px`,
                            height: `${Math.min(120, Math.max(16, Number(item.iconSize || 44)))}px`
                          }}
                        />
                      ) : (
                        <span>{item.paymentName}</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="avy-trust-strip">
              {TRUST_POINTS.map((item) => <span key={item}>{item}</span>)}
            </div>

            <div className="avy-meta-strip">
              {product.warrantySummary ? <span>{product.warrantySummary}</span> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="avy-product-section">
        <div className="avy-section-heading">
          <h2>Product Description</h2>
        </div>
        <div className="avy-surface-card avy-copy-card">
          {descriptionPreview.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {(product.description || []).length > 2 ? (
            <button type="button" className="avy-inline-button" onClick={() => setDescriptionExpanded((current) => !current)}>
              {descriptionExpanded ? "Read Less" : "Read More"}
            </button>
          ) : null}
        </div>
      </section>

      <section className="avy-product-section avy-product-section-narrow">
        <div className="avy-section-heading">
          <h2>Product Specifications</h2>
        </div>
        <div className="avy-spec-stack">
          {(product.specGroups || []).map((group) => (
            <details key={group.title} className="avy-accordion">
              <summary>{group.title}</summary>
              <div className="avy-accordion-body">
                <div className="avy-spec-grid">
                  {group.items.map((item) => (
                    <div key={item[0]} className="avy-spec-row">
                      <span>{item[0]}</span>
                      <strong>{item[1]}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="avy-product-section avy-product-section-narrow">
        <div className="avy-section-heading">
          <h2>Delivery, Return & Warranty</h2>
        </div>
        <div className="avy-spec-stack">
          {POLICY_SECTIONS.map((section) => (
            <details key={section.key} className="avy-accordion">
              <summary>{section.title}</summary>
              <div className="avy-accordion-body">
                <p>
                  {section.key === "shipping"
                    ? `${dynamicDispatchText}. ${dynamicDeliveryText}. ${dynamicShippingText}.`
                    : section.key === "cod"
                      ? `${dynamicCodText}. Availability depends on serviceability and order value for your delivery location.`
                      : section.key === "returns"
                        ? "Eligible orders can be returned or replaced as per policy terms for the selected category."
                        : (product.warrantySummary
                          ? `${product.warrantySummary}. Support is available according to the brand and product-type coverage listed in the specifications section.`
                          : "Support is available according to the brand and product-type coverage listed in the specifications section.")}
                </p>
                {section.key === "returns" ? <p>{product.returnSummary}</p> : null}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section id="customer-reviews" className="avy-product-section">
        <div className="avy-section-heading">
          <h2>Customer Reviews</h2>
          <button type="button" className="avy-review-toggle-button" onClick={openReviewForm} aria-haspopup="dialog">
            Write a Review
          </button>
        </div>

        <div className="avy-reviews-layout">
          <aside className="avy-surface-card avy-review-summary">
            <strong className="avy-review-average">{reviewStats.average.toFixed(1)}</strong>
            <span className="avy-review-stars large">{renderStars(reviewStats.average)}</span>
            <p>{publicReviewCount} public reviews</p>
            <div className="avy-rating-bars">
              {reviewStats.breakdown.map((item) => (
                <div key={item.rating} className="avy-rating-bar-row">
                  <span>{item.rating}★</span>
                  <div className="avy-rating-bar-track">
                    <div className="avy-rating-bar-fill" style={{ width: `${item.percentage}%` }} />
                  </div>
                  <strong>{item.percentage}%</strong>
                </div>
              ))}
            </div>
          </aside>

          <div className="avy-review-content">
            <div className="avy-review-controls">
              <div className="avy-review-controls-head">
                <div>
                  <span>Review Filters</span>
                  <strong>Find the most useful feedback</strong>
                </div>
                <p>{displayedReviews.length} customer review{displayedReviews.length === 1 ? "" : "s"}</p>
              </div>
              <div className="avy-review-control-grid">
                <label className="avy-review-select-control">
                  <span>Sort reviews</span>
                  <select value={reviewSort} onChange={(event) => setReviewSort(event.target.value)}>
                    {REVIEW_SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="avy-review-select-control">
                  <span>Reviewer type</span>
                  <select value={reviewerFilter} onChange={(event) => setReviewerFilter(event.target.value)}>
                    {REVIEWER_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="avy-review-select-control">
                  <span>Star rating</span>
                  <select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)}>
                    {REVIEW_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div id="customer-media" className="avy-surface-card">
              <div className="avy-section-heading compact avy-section-heading-centered avy-media-section-head">
                <div>
                  <h3>Customer Photos & Videos</h3>
                  <p className="avy-media-count">{customerMedia.length} media item{customerMedia.length === 1 ? "" : "s"}</p>
                </div>
                {customerMedia.length > 10 ? (
                  <button type="button" className="avy-media-see-all" onClick={() => setReviewMediaGalleryOpen(true)}>
                    See all
                  </button>
                ) : null}
              </div>
              <div className="avy-review-media-grid">
                {customerMedia.slice(0, 10).map((item, index) => (
                  <button key={item.key} type="button" className="avy-media-card avy-media-card-button" onClick={() => setReviewMediaPreviewIndex(index)}>
                    {item.type === "video" ? (
                      <>
                        <video muted playsInline poster={product.videoPoster || product.image} src={item.src} />
                        <span className="avy-media-play-icon" aria-hidden="true">▶</span>
                      </>
                    ) : (
                      <img src={item.src} alt={item.alt} />
                    )}
                  </button>
                ))}
                {!customerMedia.length ? <p className="avy-helper-note">No public review photos or videos yet.</p> : null}
              </div>
            </div>

            <div className="avy-review-list">
              {displayedReviews.map((review, index) => {
                const displayName = getReviewDisplayName(review);
                const reviewDate = formatReviewDate(review.date);
                return (
                  <article key={`${displayName}:${review.title}:${index}`} className="avy-surface-card avy-review-card">
                    <div className="avy-review-card-head">
                      <strong className="avy-reviewer-name">{displayName}</strong>
                      <div className="avy-review-badge-row">
                        {isReviewVerifiedPurchase(review) ? <span className="avy-verified-badge">Verified Purchase</span> : null}
                        {review.isAnonymous ? <span className="avy-anonymous-badge">Anonymous</span> : null}
                      </div>
                    </div>
                    {reviewDate ? <span className="avy-review-date">{reviewDate}</span> : null}
                    <div className="avy-review-stars">{renderStars(review.rating)}</div>
                    <h3>{review.title}</h3>
                    <p>{review.body}</p>
                    {(review.images?.length || review.videos?.length) ? (
                      <div className="avy-media-strip inline">
                        {(review.images || []).map((image, imageIndex) => (
                          <div key={`${review.title}:image:${imageIndex}`} className="avy-media-card small">
                            <img src={image} alt={`${review.title} ${imageIndex + 1}`} />
                          </div>
                        ))}
                        {(review.videos || []).map((video, videoIndex) => (
                          <div key={`${review.title}:video:${videoIndex}`} className="avy-media-card small">
                            <video controls src={video} />
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {review.adminReply ? (
                      <div className="avy-seller-response">
                        <strong>Seller Response</strong>
                        <p>{review.adminReply}</p>
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {isLoadingBackendReviews && !displayedReviews.length ? <p className="avy-helper-note">Loading reviews...</p> : null}
              {!isLoadingBackendReviews && !displayedReviews.length ? <p className="avy-helper-note">No reviews match this filter.</p> : null}
              {hasMoreBackendReviews ? (
                <div className="avy-review-load-more">
                  <button type="button" className="avy-secondary-button" onClick={loadMoreReviews} disabled={isLoadingBackendReviews}>
                    {isLoadingBackendReviews ? "Loading..." : "Load More"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="avy-product-section">
        <div className="avy-section-heading">
          <h2>Frequently Asked Questions</h2>
        </div>
        <div className="avy-spec-stack">
          {(product.faqs || []).map((faq) => (
            <details key={faq.question} className="avy-accordion">
              <summary>{faq.question}</summary>
              <div className="avy-accordion-body">
                <p>{faq.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="avy-product-section">
        <div className="avy-section-heading">
          <h2>You Might Also Like</h2>
        </div>
        <div className="product-grid">
          {related.map((item) => <ProductCard key={item.slug} product={item} context={context} actionLabel="Explore" actionMode="link" />)}
        </div>
      </section>

      <div className="avy-mobile-sticky-bar">
        <div>
          <strong>{formatCurrency(salePrice, context)}</strong>
          <span>{stockLabel}</span>
        </div>
        <button className="avy-button-secondary" type="button" onClick={(event) => addSelectedQuantityToCart(event.currentTarget)} disabled={availableStock === 0}>Add to Cart</button>
        <button className="avy-button-primary" type="button" onClick={(event) => handleBuyNow(event.currentTarget)} disabled={availableStock === 0}>Buy Now</button>
      </div>

      {reviewFormOpen ? (
        <div className="avy-review-modal-overlay" role="presentation" onMouseDown={() => setReviewFormOpen(false)}>
          <form
            ref={reviewFormRef}
            className="avy-review-modal avy-review-form"
            onSubmit={submitReview}
            role="dialog"
            aria-modal="true"
            aria-labelledby="write-review-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="avy-review-modal-close" aria-label="Close review popup" onClick={() => setReviewFormOpen(false)}>
              ×
            </button>
            <div className="avy-review-modal-header">
              <span className="eyebrow">Share Your Experience</span>
              <h2 id="write-review-title">Write a Review</h2>
              <p>Your feedback helps other shoppers choose with confidence.</p>
            </div>

            {!context.authUser ? (
              <div className="avy-review-form-grid">
                <label>
                  <span>Name Optional</span>
                  <input value={guestReviewName} onChange={(event) => setGuestReviewName(event.target.value)} placeholder="Your name" />
                </label>
                <label>
                  <span>Email Optional</span>
                  <input type="email" value={guestReviewEmail} onChange={(event) => setGuestReviewEmail(event.target.value)} placeholder="you@example.com" />
                </label>
              </div>
            ) : null}

            <div className="avy-star-rating-field" role="group" aria-label="Star Rating">
              <span className="avy-review-field-title">Star Rating</span>
              <div className="avy-star-rating">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    className={`avy-star-rating-button ${rating <= reviewRating ? "is-selected" : ""}`}
                    onClick={() => setReviewRating(rating)}
                    aria-label={`Rate ${rating} star${rating === 1 ? "" : "s"}`}
                  >
                    {rating <= reviewRating ? "★" : "☆"}
                  </button>
                ))}
              </div>
            </div>

            <label>
              <span>Review Text</span>
              <textarea rows="5" value={reviewBody} onChange={(event) => setReviewBody(event.target.value)} placeholder="What stood out? Talk about quality, setup, delivery, packaging, or daily use." required />
            </label>

            <label
              className="avy-review-upload-card avy-review-upload-card-wide"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleReviewFileDrop}
            >
              <span>Image / Video Upload</span>
              <strong>Add Photos or Videos</strong>
              <em>Click to add or drag and drop JPG, PNG, or video files</em>
              <input type="file" accept="image/jpeg,image/png,video/*" multiple onChange={handleReviewMediaChange} />
            </label>

            {isSavingReviewImage ? <p className="avy-helper-note">Processing images...</p> : null}
            {isSavingReviewVideo ? <p className="avy-helper-note">Processing videos...</p> : null}
            {(reviewImages.length || reviewVideos.length) ? (
              <div className="avy-review-upload-preview-grid">
                {reviewImages.map((image, index) => (
                  <img key={`review-image-preview-${index}`} className="avy-review-upload-preview" src={image} alt={`Review upload preview ${index + 1}`} />
                ))}
                {reviewVideos.map((video, index) => (
                  <video key={`review-video-preview-${index}`} className="avy-review-upload-preview" src={video} controls />
                ))}
              </div>
            ) : null}

            <div className="avy-review-form-actions">
              <button className="avy-button-secondary" type="button" onClick={() => setReviewFormOpen(false)}>Cancel</button>
              <button className="avy-button-primary" type="submit" disabled={isSavingReviewImage || isSavingReviewVideo || isSubmittingReview}>
                {isSubmittingReview ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {displayPreferenceOpen ? (
        <div className="avy-review-preference-overlay" role="presentation">
          <div className="avy-review-preference-dialog" role="dialog" aria-modal="true" aria-labelledby="review-display-preference-title">
            <button type="button" className="avy-review-preference-close" aria-label="Close display preference popup" onClick={() => setDisplayPreferenceOpen(false)}>
              ×
            </button>
            <span className="eyebrow">Review Display</span>
            <h2 id="review-display-preference-title">How would you like your review to appear?</h2>
            <p className="avy-review-preference-note">Your email and personal details will not be shown publicly.</p>
            <div className="avy-review-preference-actions">
              <button type="button" className="avy-button-primary" onClick={() => completeReviewSubmission(false)} disabled={isSubmittingReview}>
                {isSubmittingReview ? "Submitting..." : "Show with My Name"}
              </button>
              <button type="button" className="avy-button-secondary" onClick={() => completeReviewSubmission(true)} disabled={isSubmittingReview}>
                {isSubmittingReview ? "Submitting..." : "Post as Anonymous"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reviewMediaGalleryOpen ? (
        <div className="avy-review-gallery-overlay" role="presentation" onMouseDown={() => setReviewMediaGalleryOpen(false)}>
          <div className="avy-review-gallery-dialog" role="dialog" aria-modal="true" aria-labelledby="review-gallery-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="avy-review-preference-close" aria-label="Close media gallery" onClick={() => setReviewMediaGalleryOpen(false)}>
              ×
            </button>
            <div className="avy-review-gallery-head">
              <span className="eyebrow">Customer Media</span>
              <h2 id="review-gallery-title">Photos & Videos From Reviews</h2>
              <p>{customerMedia.length} media item{customerMedia.length === 1 ? "" : "s"}</p>
            </div>
            <div className="avy-review-gallery-grid">
              {customerMedia.map((item, index) => (
                <button
                  key={`gallery-${item.key}`}
                  type="button"
                  className="avy-media-card avy-media-card-button"
                  onClick={() => {
                    setReviewMediaPreviewIndex(index);
                    setReviewMediaGalleryOpen(false);
                  }}
                >
                  {item.type === "video" ? (
                    <>
                      <video muted playsInline poster={product.videoPoster || product.image} src={item.src} />
                      <span className="avy-media-play-icon" aria-hidden="true">▶</span>
                    </>
                  ) : (
                    <img src={item.src} alt={item.alt} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {activeReviewMedia ? (
        <div className="avy-lightbox" onClick={() => setReviewMediaPreviewIndex(null)}>
          <button type="button" className="avy-lightbox-close" onClick={() => setReviewMediaPreviewIndex(null)}>Close</button>
          <button
            type="button"
            className="avy-lightbox-nav previous"
            onClick={(event) => {
              event.stopPropagation();
              setReviewMediaPreviewIndex((current) => Number(current || 0) - 1);
            }}
          >
            Prev
          </button>
          <div className="avy-lightbox-stage" onClick={(event) => event.stopPropagation()}>
            {activeReviewMedia.type === "video" ? (
              <video controls autoPlay src={activeReviewMedia.src} />
            ) : (
              <img src={activeReviewMedia.src} alt={activeReviewMedia.alt} />
            )}
          </div>
          <button
            type="button"
            className="avy-lightbox-nav next"
            onClick={(event) => {
              event.stopPropagation();
              setReviewMediaPreviewIndex((current) => Number(current || 0) + 1);
            }}
          >
            Next
          </button>
        </div>
      ) : null}

      {lightboxOpen ? (
        <div className="avy-lightbox" onClick={() => setLightboxOpen(false)}>
          <button type="button" className="avy-lightbox-close" onClick={() => setLightboxOpen(false)}>Close</button>
          <button
            type="button"
            className="avy-lightbox-nav previous"
            onClick={(event) => {
              event.stopPropagation();
              setGalleryIndex((current) => current - 1);
            }}
          >
            Prev
          </button>
          <div className="avy-lightbox-stage" onClick={(event) => event.stopPropagation()}>
            {activeMedia.type === "placeholder" ? (
              <ProductMediaFallback />
            ) : activeMedia.type === "video" ? (
              <video controls autoPlay poster={product.videoPoster || product.image} src={activeMedia.src} />
            ) : (
              <img src={activeMedia.src} alt={activeMedia.alt} />
            )}
          </div>
          <button
            type="button"
            className="avy-lightbox-nav next"
            onClick={(event) => {
              event.stopPropagation();
              setGalleryIndex((current) => current + 1);
            }}
          >
            Next
          </button>
        </div>
      ) : null}
    </main>
  );
}
