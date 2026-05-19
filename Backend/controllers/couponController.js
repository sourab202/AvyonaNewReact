import { query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";

let schemaReady = false;

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeDiscountType(value) {
  return value === "fixed" ? "fixed" : "percentage";
}

function toDashboardDiscountType(value) {
  return value === "fixed" ? "fixed" : "percent";
}

function normalizeStatus(value) {
  const status = String(value || "active").trim().toLowerCase();
  return ["active", "scheduled", "paused", "expired", "inactive"].includes(status) ? status : "active";
}

function toDateInput(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateTime(value, endOfDay = false) {
  if (!value) return null;
  return `${String(value).slice(0, 10)} ${endOfDay ? "23:59:59" : "00:00:00"}`;
}

function getCouponEndDate(row) {
  return row.endDate || row.endsAt || row.end_date || "";
}

function parseBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return defaultValue;
  return ["true", "1", "yes", "on"].includes(normalized);
}

function normalizeDisplayText(value, maxLength, fieldName) {
  const text = String(value || "").trim();
  if (text.length > maxLength) {
    throw new ApiError(400, `${fieldName} must be ${maxLength} characters or less`);
  }
  return text;
}

async function ensureCouponSchema() {
  if (schemaReady) return;

  await query("ALTER TABLE coupons MODIFY status ENUM('active', 'scheduled', 'paused', 'expired', 'inactive') NOT NULL DEFAULT 'active'");

  const columns = await query("SHOW COLUMNS FROM coupons");
  const existing = new Set(columns.map((column) => column.Field));
  const additions = [
    ["customer_eligibility", "ALTER TABLE coupons ADD COLUMN customer_eligibility ENUM('all', 'new', 'returning') NOT NULL DEFAULT 'all'"],
    ["one_use_per_customer", "ALTER TABLE coupons ADD COLUMN one_use_per_customer TINYINT(1) NOT NULL DEFAULT 1"],
    ["stackable", "ALTER TABLE coupons ADD COLUMN stackable TINYINT(1) NOT NULL DEFAULT 0"],
    ["auto_apply", "ALTER TABLE coupons ADD COLUMN auto_apply TINYINT(1) NOT NULL DEFAULT 0"],
    ["show_on_homepage", "ALTER TABLE coupons ADD COLUMN show_on_homepage TINYINT(1) NOT NULL DEFAULT 0"],
    ["show_on_product_page", "ALTER TABLE coupons ADD COLUMN show_on_product_page TINYINT(1) NOT NULL DEFAULT 0"],
    ["homepage_sort_order", "ALTER TABLE coupons ADD COLUMN homepage_sort_order INT NOT NULL DEFAULT 0"],
    ["product_page_sort_order", "ALTER TABLE coupons ADD COLUMN product_page_sort_order INT NOT NULL DEFAULT 0"],
    ["background_image_url", "ALTER TABLE coupons ADD COLUMN background_image_url VARCHAR(500) NULL"],
    ["offer_badge_text", "ALTER TABLE coupons ADD COLUMN offer_badge_text VARCHAR(80) NULL"],
    ["offer_card_title", "ALTER TABLE coupons ADD COLUMN offer_card_title VARCHAR(160) NULL"],
    ["offer_card_description", "ALTER TABLE coupons ADD COLUMN offer_card_description VARCHAR(500) NULL"],
    ["offer_button_text", "ALTER TABLE coupons ADD COLUMN offer_button_text VARCHAR(80) NULL"],
    ["offer_button_link", "ALTER TABLE coupons ADD COLUMN offer_button_link VARCHAR(500) NULL"],
    ["end_date", "ALTER TABLE coupons ADD COLUMN end_date DATE NULL"]
  ];

  for (const [column, statement] of additions) {
    if (!existing.has(column)) {
      await query(statement);
    }
  }

  schemaReady = true;
}

async function getCategoryIdsByNames(categoryNames = []) {
  const names = [...new Set(categoryNames.map((name) => String(name || "").trim()).filter(Boolean))];
  if (!names.length) return [];

  const placeholders = names.map(() => "?").join(", ");
  const rows = await query(
    `SELECT id, name, slug FROM categories WHERE name IN (${placeholders}) OR slug IN (${placeholders})`,
    [...names, ...names]
  );
  return rows.map((row) => Number(row.id));
}

async function replaceCouponCategories(couponId, eligibleCategories = []) {
  await query("DELETE FROM coupon_categories WHERE coupon_id = ?", [couponId]);
  const categoryIds = await getCategoryIdsByNames(eligibleCategories);

  for (const categoryId of categoryIds) {
    await query(
      "INSERT IGNORE INTO coupon_categories (coupon_id, category_id) VALUES (?, ?)",
      [couponId, categoryId]
    );
  }
}

function validateCouponPayload(payload = {}, existingCouponId = null) {
  const code = normalizeCode(payload.code);
  const title = String(payload.title || "").trim();
  const discountType = normalizeDiscountType(payload.discountType);
  const discountValue = Number(payload.discountValue || 0);
  const minSubtotal = Number(payload.minSubtotal ?? payload.minimumOrderAmount ?? 0);
  const maxDiscount = Number(payload.maxDiscount ?? payload.maximumDiscountAmount ?? 0);
  const usageLimit = Number(payload.usageLimit || 0);
  const usedCount = Number(payload.usedCount || 0);
  const startDate = String(payload.startDate || "").slice(0, 10);
  const endDate = String(payload.endDate || "").slice(0, 10);
  const showOnHomepage = parseBoolean(payload.showOnHomepage, false);
  const showOnProductPage = parseBoolean(payload.showOnProductPage, false);
  const homepageSortOrder = Number.isFinite(Number(payload.homepageSortOrder)) ? Math.floor(Number(payload.homepageSortOrder)) : 0;
  const productPageSortOrder = Number.isFinite(Number(payload.productPageSortOrder)) ? Math.floor(Number(payload.productPageSortOrder)) : 0;
  const backgroundImageUrl = normalizeDisplayText(payload.backgroundImageUrl, 500, "Background Image URL");
  const offerBadgeText = normalizeDisplayText(payload.offerBadgeText, 80, "Offer Badge Text");
  const offerCardTitle = normalizeDisplayText(payload.offerCardTitle, 160, "Offer Card Title");
  const offerCardDescription = normalizeDisplayText(payload.offerCardDescription, 500, "Offer Card Description");
  const buttonText = normalizeDisplayText(payload.buttonText, 80, "Button Text");
  const buttonLink = normalizeDisplayText(payload.buttonLink, 500, "Button Link");

  if (!code || !/^[A-Z0-9_-]{3,24}$/.test(code)) {
    throw new ApiError(400, "Coupon code must use 3-24 letters, numbers, underscores, or hyphens");
  }
  if (!title) throw new ApiError(400, "Coupon title is required");
  if (discountValue <= 0) throw new ApiError(400, "Discount value must be greater than zero");
  if (discountType === "percentage" && discountValue > 90) {
    throw new ApiError(400, "Percentage discount cannot be more than 90%");
  }
  if (minSubtotal < 0 || maxDiscount < 0) throw new ApiError(400, "Amount fields cannot be negative");
  if (discountType === "percentage" && maxDiscount <= 0) {
    throw new ApiError(400, "Maximum discount is required for percentage coupons");
  }
  if (!startDate) throw new ApiError(400, "Start date is required");
  if (endDate && new Date(endDate) < new Date(startDate)) throw new ApiError(400, "End date must be after start date");
  if (usageLimit <= 0) throw new ApiError(400, "Usage limit must be greater than zero");
  if (usedCount < 0) throw new ApiError(400, "Used count cannot be negative");
  if (buttonLink && !buttonLink.startsWith("/") && !/^https?:\/\//i.test(buttonLink)) {
    throw new ApiError(400, "Button Link must be a site path or a valid URL");
  }
  if (backgroundImageUrl && !backgroundImageUrl.startsWith("/") && !/^https?:\/\//i.test(backgroundImageUrl) && !backgroundImageUrl.startsWith("data:image/")) {
    throw new ApiError(400, "Background Image URL must be an uploaded image path or valid image URL");
  }

  return {
    existingCouponId,
    code,
    title,
    description: String(payload.description || "").trim(),
    discountType,
    discountValue,
    minSubtotal,
    maxDiscount,
    usageLimit,
    usedCount,
    startDate,
    endDate,
    status: normalizeStatus(payload.status),
    customerEligibility: ["all", "new", "returning"].includes(payload.customerEligibility) ? payload.customerEligibility : "all",
    oneUsePerCustomer: parseBoolean(payload.oneUsePerCustomer, true),
    stackable: parseBoolean(payload.stackable, false),
    autoApply: parseBoolean(payload.autoApply, false),
    showOnHomepage,
    showOnProductPage,
    homepageSortOrder,
    productPageSortOrder,
    backgroundImageUrl,
    offerBadgeText,
    offerCardTitle,
    offerCardDescription,
    buttonText,
    buttonLink,
    eligibleCategories: Array.isArray(payload.eligibleCategories) ? payload.eligibleCategories : []
  };
}

async function assertUniqueCode(code, excludedId = null) {
  const rows = excludedId
    ? await query("SELECT id FROM coupons WHERE code = ? AND id != ? LIMIT 1", [code, excludedId])
    : await query("SELECT id FROM coupons WHERE code = ? LIMIT 1", [code]);

  if (rows.length) throw new ApiError(409, "A coupon with this code already exists");
}

function mapCouponRow(row, categoriesByCouponId) {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description || "",
    discountType: toDashboardDiscountType(row.discountType),
    discountValue: Number(row.discountValue || 0),
    maxDiscount: Number(row.maxDiscount || 0),
    minSubtotal: Number(row.minSubtotal || 0),
    eligibleCategories: categoriesByCouponId.get(Number(row.id)) || [],
    usageLimit: Number(row.usageLimit || 0),
    usedCount: Number(row.usedCount || 0),
    startDate: toDateInput(row.startDate),
    endDate: toDateInput(row.endDate),
    status: normalizeStatus(row.status),
    customerEligibility: row.customerEligibility || "all",
    oneUsePerCustomer: Boolean(row.oneUsePerCustomer),
    stackable: Boolean(row.stackable),
    autoApply: Boolean(row.autoApply),
    showOnHomepage: Boolean(row.showOnHomepage),
    showOnProductPage: Boolean(row.showOnProductPage),
    homepageSortOrder: Number(row.homepageSortOrder || 0),
    productPageSortOrder: Number(row.productPageSortOrder || 0),
    backgroundImageUrl: row.backgroundImageUrl || "",
    offerBadgeText: row.offerBadgeText || "",
    offerCardTitle: row.offerCardTitle || "",
    offerCardDescription: row.offerCardDescription || "",
    buttonText: row.buttonText || "",
    buttonLink: row.buttonLink || "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapCouponOffer(coupon, placement = "homepage") {
  const isHomepage = placement === "homepage";
  return {
    id: coupon.id,
    code: coupon.code,
    title: coupon.offerCardTitle || coupon.title,
    badgeText: coupon.offerBadgeText || coupon.title,
    description: coupon.offerCardDescription || coupon.description,
    buttonText: coupon.buttonText || "Explore",
    buttonLink: coupon.buttonLink || "/offers",
    backgroundImageUrl: coupon.backgroundImageUrl || "",
    sortOrder: isHomepage ? Number(coupon.homepageSortOrder || 0) : Number(coupon.productPageSortOrder || 0),
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maxDiscount: coupon.maxDiscount,
    minSubtotal: coupon.minSubtotal,
    startDate: coupon.startDate,
    endDate: coupon.endDate,
    eligibleCategories: coupon.eligibleCategories || []
  };
}

function isCouponCurrentlyActive(coupon, now = new Date()) {
  if (!coupon || normalizeStatus(coupon.status) !== "active") return false;
  const startDate = coupon.startDate ? new Date(`${String(coupon.startDate).slice(0, 10)}T00:00:00`) : null;
  const endDate = coupon.endDate ? new Date(`${String(coupon.endDate).slice(0, 10)}T23:59:59`) : null;
  if (startDate && now < startDate) return false;
  if (endDate && now > endDate) return false;
  if (Number(coupon.usageLimit || 0) > 0 && Number(coupon.usedCount || 0) >= Number(coupon.usageLimit || 0)) return false;
  return true;
}

function isCouponEligibleForItem(coupon, item) {
  const eligibleCategories = Array.isArray(coupon.eligibleCategories) ? coupon.eligibleCategories : [];
  if (!eligibleCategories.length) return true;
  const itemValues = [item?.category, item?.categorySlug, item?.categoryName]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
  return eligibleCategories.some((category) => itemValues.includes(String(category || "").trim().toLowerCase()));
}

function calculateCouponDiscount(coupon, items = [], subtotal = 0) {
  if (!coupon) return 0;
  const eligibleItems = items.filter((item) => isCouponEligibleForItem(coupon, item));
  const eligibleSubtotal = eligibleItems.reduce(
    (sum, item) => sum + Number(item.price || item.unitPrice || 0) * Number(item.quantity || 1),
    0
  );
  const discountBase = eligibleItems.length ? eligibleSubtotal : Number(subtotal || 0);
  const rawDiscount = coupon.discountType === "fixed"
    ? Number(coupon.discountValue || 0)
    : discountBase * (Number(coupon.discountValue || 0) / 100);
  const cappedDiscount = Number(coupon.maxDiscount || 0) > 0
    ? Math.min(rawDiscount, Number(coupon.maxDiscount || 0))
    : rawDiscount;
  return Math.max(0, Math.min(cappedDiscount, Number(subtotal || 0)));
}

async function getCustomerCouponStats(customerId, couponCode) {
  if (!customerId) {
    return { orderCount: 0, couponUseCount: 0 };
  }

  const rows = await query(
    `SELECT
      COUNT(*) AS orderCount,
      SUM(CASE WHEN coupon_code = ? THEN 1 ELSE 0 END) AS couponUseCount
     FROM orders
     WHERE customer_id = ?
       AND status NOT IN ('cancelled', 'failed')`,
    [couponCode, customerId]
  );
  const row = rows[0] || {};
  return {
    orderCount: Number(row.orderCount || 0),
    couponUseCount: Number(row.couponUseCount || 0)
  };
}

async function validateCouponEligibility(coupon, { items = [], subtotal = 0, customerId = null, hasOtherOffers = false } = {}) {
  if (!coupon) return { valid: false, message: "Enter a valid coupon code." };
  if (!isCouponCurrentlyActive(coupon)) return { valid: false, message: "This coupon is not active right now." };
  if (subtotal < Number(coupon.minSubtotal || 0)) {
    return {
      valid: false,
      message: `Add items worth Rs. ${Number(coupon.minSubtotal || 0).toLocaleString("en-IN")} or more to use ${coupon.code}.`
    };
  }
  if (hasOtherOffers && !coupon.stackable) {
    return { valid: false, message: "This coupon cannot be combined with other offers." };
  }

  const eligibleItems = items.filter((item) => isCouponEligibleForItem(coupon, item));
  if (items.length && !eligibleItems.length) {
    return { valid: false, message: "This coupon is not valid for the products in your cart." };
  }

  const stats = await getCustomerCouponStats(customerId, coupon.code);
  if (coupon.customerEligibility === "new" && customerId && stats.orderCount > 0) {
    return { valid: false, message: "This coupon is valid only for new customers." };
  }
  if (coupon.customerEligibility === "returning" && (!customerId || stats.orderCount <= 0)) {
    return { valid: false, message: "This coupon is valid only for returning customers." };
  }
  if (coupon.oneUsePerCustomer && customerId && stats.couponUseCount > 0) {
    return { valid: false, message: "This coupon has already been used by this customer." };
  }

  const discount = calculateCouponDiscount(coupon, items, subtotal);
  if (discount <= 0) return { valid: false, message: "This coupon does not add a discount to this cart." };

  return { valid: true, message: `${coupon.code} applied successfully.`, discount };
}

async function getCouponsWithCategories(whereClause = "", values = []) {
  await ensureCouponSchema();

  const rows = await query(
    `SELECT
      id,
      code,
      title,
      description,
      discount_type AS discountType,
      discount_value AS discountValue,
      minimum_order_amount AS minSubtotal,
      maximum_discount_amount AS maxDiscount,
      usage_limit AS usageLimit,
      used_count AS usedCount,
      starts_at AS startDate,
      COALESCE(end_date, DATE(ends_at)) AS endDate,
      status,
      customer_eligibility AS customerEligibility,
      one_use_per_customer AS oneUsePerCustomer,
      stackable,
      auto_apply AS autoApply,
      show_on_homepage AS showOnHomepage,
      show_on_product_page AS showOnProductPage,
      homepage_sort_order AS homepageSortOrder,
      product_page_sort_order AS productPageSortOrder,
      background_image_url AS backgroundImageUrl,
      offer_badge_text AS offerBadgeText,
      offer_card_title AS offerCardTitle,
      offer_card_description AS offerCardDescription,
      offer_button_text AS buttonText,
      offer_button_link AS buttonLink,
      created_at AS createdAt,
      updated_at AS updatedAt
     FROM coupons
     ${whereClause}
     ORDER BY created_at DESC, id DESC`,
    values
  );

  const couponIds = rows.map((row) => Number(row.id));
  const categoriesByCouponId = new Map();
  if (couponIds.length) {
    const placeholders = couponIds.map(() => "?").join(", ");
    const categoryRows = await query(
      `SELECT cc.coupon_id AS couponId, c.name, c.slug
       FROM coupon_categories cc
       JOIN categories c ON c.id = cc.category_id
       WHERE cc.coupon_id IN (${placeholders})
       ORDER BY c.name ASC`,
      couponIds
    );
    categoryRows.forEach((row) => {
      const list = categoriesByCouponId.get(Number(row.couponId)) || [];
      list.push(row.name);
      if (row.slug && row.slug !== row.name) list.push(row.slug);
      categoriesByCouponId.set(Number(row.couponId), list);
    });
  }

  return rows.map((row) => mapCouponRow(row, categoriesByCouponId));
}

async function getProductOfferContext(productIdentifier) {
  const identifier = String(productIdentifier || "").trim();
  if (!identifier) return null;

  const rows = await query(
    `SELECT
      p.id,
      p.category_id AS categoryId,
      p.slug,
      p.asin,
      p.sku,
      c.name AS categoryName,
      c.slug AS categorySlug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = ? OR p.slug = ? OR p.asin = ? OR p.sku = ?
     LIMIT 1`,
    [Number(identifier) || 0, identifier, identifier, identifier]
  );

  return rows[0] || null;
}

async function getCouponProductIds(couponIds = []) {
  if (!couponIds.length) return new Map();
  const placeholders = couponIds.map(() => "?").join(", ");
  const rows = await query(
    `SELECT coupon_id AS couponId, product_id AS productId
     FROM coupon_products
     WHERE coupon_id IN (${placeholders})`,
    couponIds
  );
  const productIdsByCouponId = new Map();
  rows.forEach((row) => {
    const list = productIdsByCouponId.get(Number(row.couponId)) || [];
    list.push(Number(row.productId));
    productIdsByCouponId.set(Number(row.couponId), list);
  });
  return productIdsByCouponId;
}

function couponMatchesProductContext(coupon, productContext, productIdsByCouponId) {
  if (!productContext) return true;
  const linkedProductIds = productIdsByCouponId.get(Number(coupon.id)) || [];
  if (linkedProductIds.includes(Number(productContext.id))) return true;

  const eligibleCategories = Array.isArray(coupon.eligibleCategories) ? coupon.eligibleCategories : [];
  if (!eligibleCategories.length && !linkedProductIds.length) return true;

  const productCategoryValues = [
    productContext.categoryId,
    productContext.categoryName,
    productContext.categorySlug
  ].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);

  return eligibleCategories.some((category) => productCategoryValues.includes(String(category || "").trim().toLowerCase()));
}

export async function listCoupons(request, response) {
  const filters = [];
  const values = [];
  const status = String(request.query.status || "").trim();
  const search = String(request.query.search || "").trim();

  if (status && status !== "all") {
    filters.push("status = ?");
    values.push(normalizeStatus(status));
  }

  if (search) {
    filters.push("(code LIKE ? OR title LIKE ? OR description LIKE ?)");
    const term = `%${search}%`;
    values.push(term, term, term);
  }

  const coupons = await getCouponsWithCategories(filters.length ? `WHERE ${filters.join(" AND ")}` : "", values);
  response.json({ success: true, count: coupons.length, data: coupons });
}

export async function listHomepageOffers(_request, response) {
  const coupons = await getCouponsWithCategories(
    "WHERE status = 'active' AND show_on_homepage = 1",
    []
  );
  const offers = coupons
    .filter((coupon) => isCouponCurrentlyActive(coupon))
    .sort((left, right) => Number(left.homepageSortOrder || 0) - Number(right.homepageSortOrder || 0))
    .map((coupon) => mapCouponOffer(coupon, "homepage"));

  response.json({ success: true, count: offers.length, data: offers });
}

export async function listProductPageOffers(request, response) {
  const productContext = await getProductOfferContext(request.query.productId || request.query.productSlug || request.query.productIdentifier);
  const category = String(request.query.category || request.query.categorySlug || productContext?.categorySlug || productContext?.categoryName || "").trim().toLowerCase();
  const coupons = await getCouponsWithCategories(
    "WHERE status = 'active' AND show_on_product_page = 1",
    []
  );
  const productIdsByCouponId = await getCouponProductIds(coupons.map((coupon) => Number(coupon.id)));
  const offers = coupons
    .filter((coupon) => isCouponCurrentlyActive(coupon))
    .filter((coupon) => couponMatchesProductContext(coupon, productContext, productIdsByCouponId))
    .filter((coupon) => !productContext && category ? !coupon.eligibleCategories.length || coupon.eligibleCategories.some((entry) => String(entry || "").trim().toLowerCase() === category) : true)
    .sort((left, right) => Number(left.productPageSortOrder || 0) - Number(right.productPageSortOrder || 0))
    .map((coupon) => mapCouponOffer(coupon, "product"));

  response.json({ success: true, count: offers.length, data: offers });
}

export async function validateCouponForCheckout(request, response) {
  const code = normalizeCode(request.body?.code || request.body?.couponCode);
  const items = Array.isArray(request.body?.items) ? request.body.items : [];
  const providedSubtotal = Number(request.body?.subtotal || 0);
  const hasOtherOffers = parseBoolean(request.body?.hasOtherOffers, false);
  const customerId = request.customer?.id || Number(request.body?.customerId || 0) || null;
  const subtotal = providedSubtotal > 0
    ? providedSubtotal
    : items.reduce((sum, item) => sum + Number(item.price || item.unitPrice || 0) * Number(item.quantity || 1), 0);

  if (!code) throw new ApiError(400, "Coupon code is required");
  if (subtotal <= 0) throw new ApiError(400, "Cart subtotal must be greater than zero");

  const [coupon] = await getCouponsWithCategories("WHERE code = ?", [code]);
  if (!coupon) {
    response.status(404).json({ success: false, valid: false, message: "Enter a valid coupon code.", data: null });
    return;
  }

  const eligibility = await validateCouponEligibility(coupon, { items, subtotal, customerId, hasOtherOffers });
  if (!eligibility.valid) {
    response.status(400).json({ success: false, valid: false, message: eligibility.message, data: { coupon, discount: 0 } });
    return;
  }

  response.json({
    success: true,
    valid: true,
    message: eligibility.message,
    data: { coupon, discount: eligibility.discount }
  });
}

export async function getCouponById(request, response) {
  const coupons = await getCouponsWithCategories("WHERE id = ? OR code = ?", [Number(request.params.id) || 0, normalizeCode(request.params.id)]);
  if (!coupons.length) throw new ApiError(404, "Coupon not found");
  response.json({ success: true, data: coupons[0] });
}

export async function createCoupon(request, response) {
  await ensureCouponSchema();
  const payload = validateCouponPayload(request.body || {});
  await assertUniqueCode(payload.code);

  const result = await query(
    `INSERT INTO coupons
      (code, title, description, discount_type, discount_value, minimum_order_amount, maximum_discount_amount,
       usage_limit, used_count, starts_at, ends_at, status, customer_eligibility, one_use_per_customer, stackable, auto_apply,
       show_on_homepage, show_on_product_page, homepage_sort_order, product_page_sort_order, background_image_url,
       offer_badge_text, offer_card_title, offer_card_description, offer_button_text, offer_button_link, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.code,
      payload.title,
      payload.description,
      payload.discountType,
      payload.discountValue,
      payload.minSubtotal,
      payload.maxDiscount,
      payload.usageLimit,
      payload.usedCount,
      toDateTime(payload.startDate),
      toDateTime(payload.endDate, true),
      payload.status,
      payload.customerEligibility,
      payload.oneUsePerCustomer ? 1 : 0,
      payload.stackable ? 1 : 0,
      payload.autoApply ? 1 : 0,
      payload.showOnHomepage ? 1 : 0,
      payload.showOnProductPage ? 1 : 0,
      payload.homepageSortOrder,
      payload.productPageSortOrder,
      payload.backgroundImageUrl || null,
      payload.offerBadgeText || null,
      payload.offerCardTitle || null,
      payload.offerCardDescription || null,
      payload.buttonText || null,
      payload.buttonLink || null,
      payload.endDate || null
    ]
  );
  await replaceCouponCategories(result.insertId, payload.eligibleCategories);

  const [created] = await getCouponsWithCategories("WHERE id = ?", [result.insertId]);
  response.status(201).json({ success: true, message: "Coupon created successfully", data: created });
}

export async function updateCoupon(request, response) {
  await ensureCouponSchema();
  const couponId = Number(request.params.id);
  if (!Number.isInteger(couponId) || couponId <= 0) throw new ApiError(400, "Invalid coupon id");

  const existing = await query("SELECT id FROM coupons WHERE id = ? LIMIT 1", [couponId]);
  if (!existing.length) throw new ApiError(404, "Coupon not found");

  const payload = validateCouponPayload(request.body || {}, couponId);
  await assertUniqueCode(payload.code, couponId);

  await query(
    `UPDATE coupons
     SET code = ?,
         title = ?,
         description = ?,
         discount_type = ?,
         discount_value = ?,
         minimum_order_amount = ?,
         maximum_discount_amount = ?,
         usage_limit = ?,
         used_count = ?,
         starts_at = ?,
         ends_at = ?,
         status = ?,
         customer_eligibility = ?,
         one_use_per_customer = ?,
         stackable = ?,
         auto_apply = ?,
         show_on_homepage = ?,
         show_on_product_page = ?,
         homepage_sort_order = ?,
         product_page_sort_order = ?,
         background_image_url = ?,
         offer_badge_text = ?,
         offer_card_title = ?,
         offer_card_description = ?,
         offer_button_text = ?,
         offer_button_link = ?,
         end_date = ?
     WHERE id = ?`,
    [
      payload.code,
      payload.title,
      payload.description,
      payload.discountType,
      payload.discountValue,
      payload.minSubtotal,
      payload.maxDiscount,
      payload.usageLimit,
      payload.usedCount,
      toDateTime(payload.startDate),
      toDateTime(payload.endDate, true),
      payload.status,
      payload.customerEligibility,
      payload.oneUsePerCustomer ? 1 : 0,
      payload.stackable ? 1 : 0,
      payload.autoApply ? 1 : 0,
      payload.showOnHomepage ? 1 : 0,
      payload.showOnProductPage ? 1 : 0,
      payload.homepageSortOrder,
      payload.productPageSortOrder,
      payload.backgroundImageUrl || null,
      payload.offerBadgeText || null,
      payload.offerCardTitle || null,
      payload.offerCardDescription || null,
      payload.buttonText || null,
      payload.buttonLink || null,
      payload.endDate || null,
      couponId
    ]
  );
  await replaceCouponCategories(couponId, payload.eligibleCategories);

  const [updated] = await getCouponsWithCategories("WHERE id = ?", [couponId]);
  response.json({ success: true, message: "Coupon updated successfully", data: updated });
}

export async function updateCouponStatus(request, response) {
  await ensureCouponSchema();
  const couponId = Number(request.params.id);
  const status = normalizeStatus(request.body?.status);

  const result = await query("UPDATE coupons SET status = ? WHERE id = ?", [status, couponId]);
  if (!result.affectedRows) throw new ApiError(404, "Coupon not found");

  const [updated] = await getCouponsWithCategories("WHERE id = ?", [couponId]);
  response.json({ success: true, message: "Coupon status updated", data: updated });
}

export async function activateCoupon(request, response) {
  request.body = { ...(request.body || {}), status: "active" };
  return updateCouponStatus(request, response);
}

export async function deactivateCoupon(request, response) {
  request.body = { ...(request.body || {}), status: "inactive" };
  return updateCouponStatus(request, response);
}

export async function uploadCouponBackgroundImage(request, response) {
  if (!request.file) {
    throw new ApiError(400, "Coupon background image is required");
  }

  response.status(201).json({
    success: true,
    data: {
      filename: request.file.filename,
      originalName: request.file.originalname,
      mimeType: request.file.mimetype,
      size: request.file.size,
      url: `/uploads/${request.file.filename}`
    }
  });
}

export async function deleteCoupon(request, response) {
  await ensureCouponSchema();
  const couponId = Number(request.params.id);
  const result = await query("DELETE FROM coupons WHERE id = ?", [couponId]);
  if (!result.affectedRows) throw new ApiError(404, "Coupon not found");
  response.json({ success: true, message: "Coupon deleted successfully" });
}
