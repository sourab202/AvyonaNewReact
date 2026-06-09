export const COUPON_STATUS = {
  ACTIVE: "active",
  SCHEDULED: "scheduled",
  PAUSED: "paused",
  EXPIRED: "expired",
  INACTIVE: "inactive"
};

export const couponRules = [
  {
    id: "coupon-summer15",
    code: "SUMMER15",
    title: "Summer Sale",
    description: "15% off on personal audio, digital cameras, and reading lights.",
    discountType: "percent",
    discountValue: 15,
    maxDiscount: 2500,
    minSubtotal: 4999,
    eligibleCategories: ["Personal Audio", "Digital Camera", "Reading Light"],
    usageLimit: 500,
    usedCount: 126,
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    showOnHomepage: true,
    showOnProductPage: true,
    homepageSortOrder: 10,
    productPageSortOrder: 10,
    backgroundImageUrl: "",
    offerBadgeText: "Summer Sale",
    offerCardTitle: "Season-ready savings",
    offerCardDescription: "Fresh summer savings on audio, cameras, and travel-ready picks.",
    buttonText: "Explore",
    buttonLink: "/offers?offer=summer-sale",
    status: COUPON_STATUS.ACTIVE
  },
  {
    id: "coupon-first12",
    code: "FIRST12",
    title: "First Purchase",
    description: "12% off for new shoppers across eligible in-stock products.",
    discountType: "percent",
    discountValue: 12,
    maxDiscount: 1500,
    minSubtotal: 2999,
    eligibleCategories: [],
    usageLimit: 1000,
    usedCount: 284,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    showOnHomepage: true,
    showOnProductPage: false,
    homepageSortOrder: 20,
    productPageSortOrder: 0,
    backgroundImageUrl: "",
    offerBadgeText: "First Purchase",
    offerCardTitle: "New shopper offer",
    offerCardDescription: "Unlock an easy first-order deal across Avyona best sellers and everyday favorites.",
    buttonText: "Explore",
    buttonLink: "/offers?offer=first-purchase",
    status: COUPON_STATUS.ACTIVE
  },
  {
    id: "coupon-bundle20",
    code: "BUNDLE20",
    title: "Bundle Sale",
    description: "20% off selected home setup and creator products.",
    discountType: "percent",
    discountValue: 20,
    maxDiscount: 4000,
    minSubtotal: 9999,
    eligibleCategories: ["Avyona Digital Photo Frames", "Professional Audio", "Security Camera"],
    usageLimit: 300,
    usedCount: 91,
    startDate: "2026-03-01",
    endDate: "2026-08-31",
    showOnHomepage: true,
    showOnProductPage: true,
    homepageSortOrder: 30,
    productPageSortOrder: 20,
    backgroundImageUrl: "",
    offerBadgeText: "Bundle Sale",
    offerCardTitle: "Save more together",
    offerCardDescription: "Build a better setup with bundle pricing on selected collections and home-ready products.",
    buttonText: "Explore",
    buttonLink: "/offers?offer=bundle-sale",
    status: COUPON_STATUS.ACTIVE
  },
  {
    id: "coupon-flat500",
    code: "AVYONA500",
    title: "Flat Savings",
    description: "Flat discount for carts above Rs. 6999.",
    discountType: "fixed",
    discountValue: 500,
    maxDiscount: 500,
    minSubtotal: 6999,
    eligibleCategories: [],
    usageLimit: 750,
    usedCount: 212,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: COUPON_STATUS.ACTIVE
  }
];

export function normalizeCouponCode(code) {
  return String(code || "").trim().toUpperCase();
}

export function getCouponByCode(code, coupons = couponRules) {
  const normalizedCode = normalizeCouponCode(code);
  return coupons.find((coupon) => normalizeCouponCode(coupon.code) === normalizedCode) || null;
}

export function isCouponActive(coupon, date = new Date()) {
  if (!coupon || coupon.status !== COUPON_STATUS.ACTIVE) return false;

  const currentDate = new Date(date);
  const startDate = coupon.startDate ? new Date(`${coupon.startDate}T00:00:00`) : null;
  const endDate = coupon.endDate ? new Date(`${coupon.endDate}T23:59:59`) : null;

  if (startDate && currentDate < startDate) return false;
  if (endDate && currentDate > endDate) return false;
  if (Number(coupon.usageLimit || 0) > 0 && Number(coupon.usedCount || 0) >= Number(coupon.usageLimit || 0)) return false;

  return true;
}

export function isCouponEligibleForProduct(coupon, productOrItem) {
  if (!coupon) return false;
  if (!Array.isArray(coupon.eligibleCategories) || !coupon.eligibleCategories.length) return true;
  return coupon.eligibleCategories.includes(productOrItem?.category);
}

export function getEligibleCouponItems(coupon, items = []) {
  return items.filter((item) => isCouponEligibleForProduct(coupon, item));
}

export function calculateCouponDiscount(coupon, items = [], subtotal = 0) {
  if (!coupon) return 0;

  const eligibleItems = getEligibleCouponItems(coupon, items);
  const eligibleSubtotal = eligibleItems.reduce(
    (sum, item) => sum + Number(item.price || item.unitPrice || 0) * Number(item.quantity || 1),
    0
  );
  const discountBase = eligibleItems.length ? eligibleSubtotal : Number(subtotal || 0);
  let discount = 0;

  if (coupon.discountType === "fixed") {
    discount = Number(coupon.discountValue || 0);
  } else {
    discount = (discountBase * Number(coupon.discountValue || 0)) / 100;
  }

  if (Number(coupon.maxDiscount || 0) > 0) {
    discount = Math.min(discount, Number(coupon.maxDiscount || 0));
  }

  return Math.max(0, Math.min(discount, Number(subtotal || 0)));
}

export function validateCoupon(code, { items = [], subtotal = 0, coupons = couponRules } = {}) {
  const coupon = getCouponByCode(code, coupons);

  if (!coupon) {
    return { valid: false, message: "Enter a valid coupon code.", coupon: null, discount: 0 };
  }

  if (!isCouponActive(coupon)) {
    return { valid: false, message: "This coupon is not active right now.", coupon, discount: 0 };
  }

  if (Number(subtotal || 0) < Number(coupon.minSubtotal || 0)) {
    return {
      valid: false,
      message: `Add items worth Rs. ${Number(coupon.minSubtotal || 0).toLocaleString("en-IN")} or more to use ${coupon.code}.`,
      coupon,
      discount: 0
    };
  }

  const eligibleItems = getEligibleCouponItems(coupon, items);
  if (items.length && !eligibleItems.length) {
    return { valid: false, message: "This coupon is not valid for the products in your cart.", coupon, discount: 0 };
  }

  const discount = calculateCouponDiscount(coupon, items, subtotal);

  if (discount <= 0) {
    return { valid: false, message: "This coupon does not add a discount to this cart.", coupon, discount: 0 };
  }

  return { valid: true, message: `${coupon.code} applied successfully.`, coupon, discount };
}
