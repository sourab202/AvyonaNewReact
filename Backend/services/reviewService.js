import { pool } from "../config/db.js";
import { REVIEW_TYPES, REVIEW_VISIBILITY_STATUSES, isValidReviewType, isValidReviewVisibilityStatus } from "../shared/reviewTypes.js";
import { ApiError } from "../utils/apiError.js";
import { resolveVerifiedPurchaseStatus } from "./reviewVerificationService.js";

let reviewSchemaPromise = null;

async function createReviewSchema() {
  const [existingReviewTables] = await pool.query("SHOW TABLES LIKE 'reviews'");
  const shouldMigrateLegacyReviews = existingReviewTables.length === 0;

  await pool.query(
    `CREATE TABLE IF NOT EXISTS reviews (
      review_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      product_id INT UNSIGNED NOT NULL,
      customer_id INT UNSIGNED NULL,
      order_id INT UNSIGNED NULL,
      reviewer_name VARCHAR(160) NOT NULL,
      reviewer_email VARCHAR(190) NULL,
      rating TINYINT UNSIGNED NOT NULL,
      review_title VARCHAR(180) NOT NULL,
      review_text TEXT NOT NULL,
      review_type ENUM('customer_review', 'guest_review', 'admin_review') NOT NULL DEFAULT 'guest_review',
      is_verified_purchase TINYINT(1) NOT NULL DEFAULT 0,
      is_anonymous TINYINT(1) NOT NULL DEFAULT 0,
      visibility_status ENUM('public', 'hidden', 'private_to_reviewer', 'deleted') NOT NULL DEFAULT 'hidden',
      admin_reply TEXT NULL,
      admin_reply_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_reviews_product_visibility (product_id, visibility_status),
      INDEX idx_reviews_customer_created (customer_id, created_at),
      INDEX idx_reviews_order (order_id),
      CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      CONSTRAINT fk_reviews_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
    )`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS review_media (
      media_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      review_id BIGINT UNSIGNED NOT NULL,
      media_type ENUM('image', 'video') NOT NULL,
      media_url VARCHAR(500) NOT NULL,
      sort_order INT UNSIGNED NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_review_media_review_sort (review_id, sort_order),
      CONSTRAINT fk_review_media_review FOREIGN KEY (review_id) REFERENCES reviews(review_id) ON DELETE CASCADE
    )`
  );

  const [legacyTables] = shouldMigrateLegacyReviews
    ? await pool.query("SHOW TABLES LIKE 'product_reviews'")
    : [[]];
  if (shouldMigrateLegacyReviews && legacyTables.length) {
    await pool.query(
      `INSERT IGNORE INTO reviews
        (review_id, product_id, customer_id, reviewer_name, reviewer_email, rating, review_title, review_text,
         review_type, is_verified_purchase, is_anonymous, visibility_status, admin_reply, created_at, updated_at)
       SELECT
         pr.id,
         pr.product_id,
         pr.customer_id,
         COALESCE(NULLIF(c.full_name, ''), 'Avyona Customer'),
         NULLIF(c.email, ''),
         pr.rating,
         COALESCE(NULLIF(pr.title, ''), CONCAT(pr.rating, ' star review')),
         COALESCE(NULLIF(pr.review_text, ''), 'Customer review'),
         CASE WHEN pr.customer_id IS NULL THEN 'admin_review' ELSE 'customer_review' END,
         pr.is_verified_purchase,
         0,
         CASE
           WHEN pr.status = 'approved' THEN 'public'
           WHEN pr.status = 'rejected' THEN 'deleted'
           ELSE 'hidden'
         END,
         pr.admin_reply,
         pr.created_at,
         pr.updated_at
       FROM product_reviews pr
       LEFT JOIN customers c ON c.id = pr.customer_id`
    );
  }
}

export async function ensureReviewSchema() {
  if (!reviewSchemaPromise) {
    reviewSchemaPromise = createReviewSchema().catch((error) => {
      reviewSchemaPromise = null;
      throw error;
    });
  }

  await reviewSchemaPromise;
}

function normalizeOptionalId(value) {
  const id = Number(value || 0);
  return id > 0 ? id : null;
}

function normalizeBoolean(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function normalizePaginationOptions(options = {}) {
  const requestedLimit = Number(options.limit);
  const requestedOffset = Number(options.offset);
  const limit = Number.isFinite(requestedLimit) ? Math.floor(Math.min(20, Math.max(1, requestedLimit))) : 5;
  const offset = Number.isFinite(requestedOffset) ? Math.floor(Math.max(0, requestedOffset)) : 0;
  const rating = Number(options.rating || 0);
  const verifiedOnly = normalizeBoolean(options.verifiedOnly || options.verified_only);
  const sort = String(options.sort || "recent").trim();

  return {
    limit,
    offset,
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
    verifiedOnly,
    sort
  };
}

function getStorefrontReviewOrderSql(sort) {
  if (sort === "highest") return "r.rating DESC, r.created_at DESC";
  if (sort === "lowest") return "r.rating ASC, r.created_at DESC";
  if (sort === "media") return "(SELECT COUNT(*) FROM review_media rm_sort WHERE rm_sort.review_id = r.review_id) DESC, r.created_at DESC";
  if (sort === "verified") return "r.is_verified_purchase DESC, r.created_at DESC";
  return "r.created_at DESC";
}

function normalizeReviewPayload(payload = {}) {
  const productId = normalizeOptionalId(payload.productId ?? payload.product_id);
  const customerId = normalizeOptionalId(payload.customerId ?? payload.customer_id);
  const orderId = normalizeOptionalId(payload.orderId ?? payload.order_id);
  const rating = Number(payload.rating || 0);
  const reviewType = payload.reviewType || payload.review_type || REVIEW_TYPES.GUEST;
  const visibilityStatus = payload.visibilityStatus || payload.visibility_status || REVIEW_VISIBILITY_STATUSES.HIDDEN;

  return {
    productId,
    productIdentifier: String(payload.productIdentifier ?? payload.product_identifier ?? payload.productSlug ?? payload.product_slug ?? payload.productAsin ?? payload.product_asin ?? "").trim(),
    productSnapshot: payload.productSnapshot || payload.product_snapshot || null,
    customerId,
    orderId,
    reviewerName: String(payload.reviewerName ?? payload.reviewer_name ?? "").trim(),
    reviewerEmail: String(payload.reviewerEmail ?? payload.reviewer_email ?? "").trim() || null,
    rating,
    reviewTitle: String(payload.reviewTitle ?? payload.review_title ?? "").trim(),
    reviewText: String(payload.reviewText ?? payload.review_text ?? "").trim(),
    adminReply: String(payload.adminReply ?? payload.admin_reply ?? "").trim(),
    reviewType: isValidReviewType(reviewType) ? reviewType : REVIEW_TYPES.GUEST,
    isAnonymous: normalizeBoolean(payload.isAnonymous ?? payload.is_anonymous),
    visibilityStatus: isValidReviewVisibilityStatus(visibilityStatus) ? visibilityStatus : REVIEW_VISIBILITY_STATUSES.HIDDEN,
    createdAt: payload.createdAt || payload.created_at || null,
    media: Array.isArray(payload.media) ? payload.media : []
  };
}

async function resolveReviewProductId(review) {
  if (review.productId) return review.productId;

  const snapshot = review.productSnapshot && typeof review.productSnapshot === "object" ? review.productSnapshot : {};
  const identifiers = [
    review.productIdentifier,
    snapshot.id,
    snapshot.slug,
    snapshot.asin,
    snapshot.sku
  ].map((value) => String(value || "").trim()).filter(Boolean);

  for (const identifier of identifiers) {
    const numericId = Number(identifier);
    const values = Number.isInteger(numericId) && numericId > 0
      ? [numericId, identifier, identifier]
      : [identifier, identifier];
    const whereSql = Number.isInteger(numericId) && numericId > 0
      ? "(id = ? OR slug = ? OR asin = ?)"
      : "(slug = ? OR asin = ?)";
    const [rows] = await pool.query(
      `SELECT id FROM products WHERE ${whereSql} AND is_deleted = 0 LIMIT 1`,
      values
    );
    if (rows[0]?.id) return Number(rows[0].id);
  }

  if (!snapshot.name) return null;

  const [categoryRows] = await pool.query("SELECT id FROM categories ORDER BY id LIMIT 1");
  const categoryId = categoryRows[0]?.id;
  if (!categoryId) return null;

  const baseSlug = String(snapshot.slug || snapshot.name || `review-product-${Date.now()}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150) || `review-product-${Date.now()}`;
  const asin = String(snapshot.asin || snapshot.sku || `REVIEW-${Date.now()}`).trim().slice(0, 32);
  const sku = String(snapshot.sku || asin).trim().slice(0, 80);
  const price = Number(snapshot.price || 0);
  const mrp = Number(snapshot.mrp || price || 0);

  try {
    const [result] = await pool.execute(
      `INSERT INTO products
        (category_id, asin, sku, name, slug, brand, short_description, description, price, mrp, stock_quantity, image_url, status, is_visible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1)`,
      [
        categoryId,
        asin,
        sku,
        String(snapshot.name).trim().slice(0, 160),
        baseSlug,
        String(snapshot.brand || "Avyona").trim().slice(0, 120),
        String(snapshot.shortDescription || "").trim().slice(0, 255),
        Array.isArray(snapshot.description) ? snapshot.description.join("\n") : String(snapshot.description || ""),
        price,
        mrp,
        Number(snapshot.availableStock || snapshot.stockQuantity || 0),
        String(snapshot.image || snapshot.imageUrl || "").trim().slice(0, 255)
      ]
    );
    return Number(result.insertId);
  } catch (error) {
    if (!["ER_DUP_ENTRY", "ER_DUP_KEY"].includes(error.code)) throw error;
    const [rows] = await pool.query(
      "SELECT id FROM products WHERE asin = ? OR slug = ? LIMIT 1",
      [asin, baseSlug]
    );
    return rows[0]?.id ? Number(rows[0].id) : null;
  }
}

function mapMediaRows(row) {
  const parsedMedia = typeof row.media === "string" ? JSON.parse(row.media || "[]") : row.media;
  const media = Array.isArray(parsedMedia) ? parsedMedia : [];
  return {
    ...row,
    isVerifiedPurchase: Boolean(row.isVerifiedPurchase),
    isAnonymous: Boolean(row.isAnonymous),
    media: media.filter(Boolean)
  };
}

async function attachMediaToReviews(rows = []) {
  const reviewIds = rows.map((row) => Number(row.reviewId || 0)).filter(Boolean);
  if (!reviewIds.length) return rows.map((row) => mapMediaRows({ ...row, media: [] }));

  const placeholders = reviewIds.map(() => "?").join(",");
  const [mediaRows] = await pool.query(
    `SELECT
      media_id AS mediaId,
      review_id AS reviewId,
      media_type AS mediaType,
      media_url AS mediaUrl,
      sort_order AS sortOrder
     FROM review_media
     WHERE review_id IN (${placeholders})
     ORDER BY review_id ASC, sort_order ASC, media_id ASC`,
    reviewIds
  );
  const mediaByReviewId = new Map();

  mediaRows.forEach((media) => {
    const list = mediaByReviewId.get(Number(media.reviewId)) || [];
    list.push(media);
    mediaByReviewId.set(Number(media.reviewId), list);
  });

  return rows.map((row) => mapMediaRows({
    ...row,
    media: mediaByReviewId.get(Number(row.reviewId)) || []
  }));
}

export async function createReview(payload) {
  await ensureReviewSchema();
  const review = normalizeReviewPayload(payload);
  review.productId = await resolveReviewProductId(review);

  if (!review.productId) {
    throw new ApiError(400, "Review product is required");
  }

  if (!review.reviewerName) {
    throw new ApiError(400, "Reviewer name is required");
  }

  if (!review.reviewTitle) {
    throw new ApiError(400, "Review title is required");
  }

  if (!review.reviewText) {
    throw new ApiError(400, "Review text is required");
  }

  if (!Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) {
    throw new ApiError(400, "Review rating must be between 1 and 5");
  }

  const isVerifiedPurchase = review.reviewType === REVIEW_TYPES.ADMIN
    ? true
    : review.reviewType === REVIEW_TYPES.GUEST
    ? false
    : await resolveVerifiedPurchaseStatus({
      customerId: review.customerId,
      productId: review.productId,
      orderId: review.orderId
    });
  const visibilityStatus = review.visibilityStatus;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (review.customerId && review.reviewType === REVIEW_TYPES.CUSTOMER) {
      await connection.execute(
        "SELECT id FROM customers WHERE id = ? LIMIT 1 FOR UPDATE",
        [review.customerId]
      );

      const [existingReviewRows] = await connection.execute(
        `SELECT review_id
         FROM reviews
         WHERE customer_id = ?
           AND product_id = ?
           AND visibility_status <> ?
         LIMIT 1
         FOR UPDATE`,
        [review.customerId, review.productId, REVIEW_VISIBILITY_STATUSES.DELETED]
      );

      if (existingReviewRows[0]) {
        throw new ApiError(409, "You have already submitted a review for this product.");
      }

      if (review.orderId) {
        await connection.execute(
          `SELECT id
           FROM orders
           WHERE id = ?
             AND customer_id = ?
           LIMIT 1
           FOR UPDATE`,
          [review.orderId, review.customerId]
        );
      }
    }

    const createdAtSql = review.createdAt ? ", created_at, updated_at" : "";
    const createdAtPlaceholders = review.createdAt ? ", ?, ?" : "";
    const createdAtValues = review.createdAt ? [review.createdAt, review.createdAt] : [];
    const [result] = await connection.execute(
      `INSERT INTO reviews
        (product_id, customer_id, order_id, reviewer_name, reviewer_email, rating, review_title, review_text, review_type, is_verified_purchase, is_anonymous, visibility_status${createdAtSql})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${createdAtPlaceholders})`,
      [
        review.productId,
        review.customerId,
        review.orderId,
        review.reviewerName,
        review.reviewerEmail,
        review.rating,
        review.reviewTitle,
        review.reviewText,
        review.reviewType,
        isVerifiedPurchase ? 1 : 0,
        review.isAnonymous ? 1 : 0,
        visibilityStatus,
        ...createdAtValues
      ]
    );

    const reviewId = result.insertId;
    const mediaRows = review.media
      .map((media, index) => ({
        mediaType: String(media.mediaType || media.media_type || "").trim(),
        mediaUrl: String(media.mediaUrl || media.media_url || "").trim(),
        sortOrder: Number(media.sortOrder || media.sort_order || index + 1)
      }))
      .filter((media) => ["image", "video"].includes(media.mediaType) && media.mediaUrl);

    for (const media of mediaRows) {
      await connection.execute(
        `INSERT INTO review_media (review_id, media_type, media_url, sort_order)
         VALUES (?, ?, ?, ?)`,
        [reviewId, media.mediaType, media.mediaUrl, media.sortOrder]
      );
    }

    await connection.commit();

    return {
      reviewId,
      isVerifiedPurchase,
      visibilityStatus,
      mediaCount: mediaRows.length
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function createCustomerReview(customer, payload = {}) {
  const requestedVisibility = payload.visibilityStatus || payload.visibility_status;
  const visibilityStatus = [
    REVIEW_VISIBILITY_STATUSES.PUBLIC,
    REVIEW_VISIBILITY_STATUSES.PRIVATE_TO_REVIEWER
  ].includes(requestedVisibility)
    ? requestedVisibility
    : REVIEW_VISIBILITY_STATUSES.HIDDEN;

  return createReview({
    ...payload,
    customerId: customer.id,
    customer_id: customer.id,
    reviewerName: payload.reviewerName || payload.reviewer_name || customer.fullName || "Avyona Customer",
    reviewerEmail: payload.reviewerEmail || payload.reviewer_email || customer.email || null,
    reviewType: REVIEW_TYPES.CUSTOMER,
    review_type: REVIEW_TYPES.CUSTOMER,
    visibilityStatus,
    visibility_status: visibilityStatus
  });
}

export async function createGuestReview(payload = {}) {
  return createReview({
    ...payload,
    customerId: null,
    customer_id: null,
    orderId: null,
    order_id: null,
    reviewerName: payload.reviewerName || payload.reviewer_name || "Guest Customer",
    reviewType: REVIEW_TYPES.GUEST,
    review_type: REVIEW_TYPES.GUEST,
    visibilityStatus: REVIEW_VISIBILITY_STATUSES.HIDDEN,
    visibility_status: REVIEW_VISIBILITY_STATUSES.HIDDEN
  });
}

export async function listReviews() {
  await ensureReviewSchema();
  const [rows] = await pool.query(
    `SELECT
      r.review_id AS reviewId,
      r.product_id AS productId,
      p.name AS productName,
      r.reviewer_name AS reviewerName,
      r.reviewer_email AS reviewerEmail,
      r.rating,
      r.review_title AS reviewTitle,
      r.review_text AS reviewText,
      r.admin_reply AS adminReply,
      r.admin_reply_at AS adminReplyAt,
      r.review_type AS reviewType,
      r.is_verified_purchase AS isVerifiedPurchase,
      r.is_anonymous AS isAnonymous,
      r.visibility_status AS visibilityStatus,
      r.created_at AS createdAt,
      r.updated_at AS updatedAt,
      COUNT(rm.media_id) AS mediaCount
     FROM reviews r
     LEFT JOIN products p ON p.id = r.product_id
     LEFT JOIN review_media rm ON rm.review_id = r.review_id
     GROUP BY r.review_id, r.product_id, p.name, r.reviewer_name, r.reviewer_email, r.rating, r.review_title,
       r.review_text, r.admin_reply, r.admin_reply_at, r.review_type, r.is_verified_purchase, r.is_anonymous, r.visibility_status, r.created_at, r.updated_at
     ORDER BY r.created_at DESC`
  );

  return rows.map((row) => ({
    ...row,
    isVerifiedPurchase: Boolean(row.isVerifiedPurchase),
    isAnonymous: Boolean(row.isAnonymous),
    mediaCount: Number(row.mediaCount || 0)
  }));
}

export async function listStorefrontReviewsPage(productIdentifier, customerId = null, options = {}) {
  await ensureReviewSchema();
  const identifier = String(productIdentifier || "").trim();
  const safeCustomerId = Number(customerId || 0);
  const pagination = normalizePaginationOptions(options);

  if (!identifier) {
    throw new ApiError(400, "Product is required");
  }

  const visibilitySql = safeCustomerId
    ? "(r.visibility_status = 'public' OR (r.visibility_status = 'private_to_reviewer' AND r.customer_id = ?))"
    : "r.visibility_status = 'public'";
  const visibilityValues = safeCustomerId ? [safeCustomerId] : [];
  const filterSql = [
    pagination.rating ? "r.rating = ?" : "",
    pagination.verifiedOnly ? "r.is_verified_purchase = 1" : ""
  ].filter(Boolean).join(" AND ");
  const filterValues = pagination.rating ? [pagination.rating] : [];
  const limitPlusOne = pagination.limit + 1;

  const [rows] = await pool.query(
    `SELECT
      r.review_id AS reviewId,
      r.product_id AS productId,
      p.name AS productName,
      r.customer_id AS customerId,
      r.reviewer_name AS reviewerName,
      r.rating,
      r.review_title AS reviewTitle,
      r.review_text AS reviewText,
      r.admin_reply AS adminReply,
      r.admin_reply_at AS adminReplyAt,
      r.review_type AS reviewType,
      r.is_verified_purchase AS isVerifiedPurchase,
      r.is_anonymous AS isAnonymous,
      r.visibility_status AS visibilityStatus,
      r.created_at AS createdAt
     FROM reviews r
     INNER JOIN products p ON p.id = r.product_id
     WHERE (p.id = ? OR p.slug = ? OR p.asin = ?)
       AND ${visibilitySql}
       ${filterSql ? `AND ${filterSql}` : ""}
      ORDER BY ${getStorefrontReviewOrderSql(pagination.sort)}
      LIMIT ${limitPlusOne} OFFSET ${pagination.offset}`,
    [identifier, identifier, identifier, ...visibilityValues, ...filterValues]
  );

  const mappedRows = await attachMediaToReviews(rows);

  return {
    rows: mappedRows.slice(0, pagination.limit),
    hasMore: mappedRows.length > pagination.limit,
    limit: pagination.limit,
    offset: pagination.offset
  };
}

export async function listStorefrontReviews(productIdentifier, customerId = null) {
  const page = await listStorefrontReviewsPage(productIdentifier, customerId, { limit: 20, offset: 0 });
  return page.rows;
}

export async function getProductReviewSummary(productIdentifier) {
  await ensureReviewSchema();
  const identifier = String(productIdentifier || "").trim();
  if (!identifier) throw new ApiError(400, "Product is required");

  const [rows] = await pool.query(
    `SELECT
      COUNT(r.review_id) AS totalReviews,
      COALESCE(AVG(r.rating), 0) AS averageRating,
      SUM(CASE WHEN r.rating = 5 THEN 1 ELSE 0 END) AS fiveStarCount,
      SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END) AS fourStarCount,
      SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END) AS threeStarCount,
      SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END) AS twoStarCount,
      SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END) AS oneStarCount
     FROM reviews r
     INNER JOIN products p ON p.id = r.product_id
     WHERE (p.id = ? OR p.slug = ? OR p.asin = ?)
       AND r.visibility_status = 'public'`,
    [identifier, identifier, identifier]
  );

  const row = rows[0] || {};
  const totalReviews = Number(row.totalReviews || 0);
  const counts = {
    5: Number(row.fiveStarCount || 0),
    4: Number(row.fourStarCount || 0),
    3: Number(row.threeStarCount || 0),
    2: Number(row.twoStarCount || 0),
    1: Number(row.oneStarCount || 0)
  };

  return {
    averageRating: Number(Number(row.averageRating || 0).toFixed(2)),
    totalReviews,
    breakdown: [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: counts[rating],
      percentage: totalReviews ? Math.round((counts[rating] / totalReviews) * 100) : 0
    }))
  };
}

export async function listStorefrontReviewMedia(productIdentifier, customerId = null) {
  await ensureReviewSchema();
  const identifier = String(productIdentifier || "").trim();
  const safeCustomerId = Number(customerId || 0);
  if (!identifier) throw new ApiError(400, "Product is required");

  const visibilitySql = safeCustomerId
    ? "(r.visibility_status = 'public' OR (r.visibility_status = 'private_to_reviewer' AND r.customer_id = ?))"
    : "r.visibility_status = 'public'";
  const visibilityValues = safeCustomerId ? [safeCustomerId] : [];

  const [rows] = await pool.query(
    `SELECT
      rm.media_id AS mediaId,
      rm.review_id AS reviewId,
      rm.media_type AS mediaType,
      rm.media_url AS mediaUrl,
      rm.sort_order AS sortOrder,
      r.reviewer_name AS reviewerName,
      r.is_anonymous AS isAnonymous,
      r.review_type AS reviewType,
      r.created_at AS createdAt
     FROM review_media rm
     INNER JOIN reviews r ON r.review_id = rm.review_id
     INNER JOIN products p ON p.id = r.product_id
     WHERE (p.id = ? OR p.slug = ? OR p.asin = ?)
       AND ${visibilitySql}
     ORDER BY r.created_at DESC, rm.sort_order ASC`,
    [identifier, identifier, identifier, ...visibilityValues]
  );

  return rows.map((row) => ({
    ...row,
    isAnonymous: Boolean(row.isAnonymous)
  }));
}

export async function listCustomerReviews(customerId) {
  await ensureReviewSchema();
  const safeCustomerId = Number(customerId || 0);
  if (!safeCustomerId) throw new ApiError(400, "Customer is required");

  const [rows] = await pool.query(
    `SELECT
      r.review_id AS reviewId,
      r.product_id AS productId,
      p.name AS productName,
      r.customer_id AS customerId,
      r.reviewer_name AS reviewerName,
      r.rating,
      r.review_title AS reviewTitle,
      r.review_text AS reviewText,
      r.admin_reply AS adminReply,
      r.admin_reply_at AS adminReplyAt,
      r.review_type AS reviewType,
      r.is_verified_purchase AS isVerifiedPurchase,
      r.is_anonymous AS isAnonymous,
      r.visibility_status AS visibilityStatus,
      r.created_at AS createdAt
     FROM reviews r
     INNER JOIN products p ON p.id = r.product_id
     WHERE r.customer_id = ?
     ORDER BY r.created_at DESC`,
    [safeCustomerId]
  );

  return attachMediaToReviews(rows);
}

export async function updateReviewVisibility(reviewId, visibilityStatus) {
  await ensureReviewSchema();
  if (!isValidReviewVisibilityStatus(visibilityStatus)) {
    throw new ApiError(400, "Invalid review visibility status");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [currentRows] = await connection.execute(
      `SELECT review_id AS reviewId, customer_id AS customerId, product_id AS productId,
              is_verified_purchase AS isVerifiedPurchase, visibility_status AS previousVisibilityStatus
       FROM reviews
       WHERE review_id = ?
       LIMIT 1
       FOR UPDATE`,
      [Number(reviewId)]
    );

    if (!currentRows[0]) {
      throw new ApiError(404, "Review not found");
    }

    await connection.execute(
      "UPDATE reviews SET visibility_status = ? WHERE review_id = ?",
      [visibilityStatus, Number(reviewId)]
    );

    await connection.commit();

    return {
      reviewId:           Number(reviewId),
      visibilityStatus,
      previousVisibilityStatus: currentRows[0].previousVisibilityStatus,
      customerId:         currentRows[0]?.customerId || null,
      productId:          currentRows[0]?.productId || null,
      isVerifiedPurchase: Boolean(currentRows[0]?.isVerifiedPurchase)
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateReview(reviewId, payload = {}) {
  await ensureReviewSchema();
  const review = normalizeReviewPayload(payload);

  if (!review.productId) throw new ApiError(400, "Review product is required");
  if (!review.reviewerName) throw new ApiError(400, "Reviewer name is required");
  if (!review.reviewTitle) throw new ApiError(400, "Review title is required");
  if (!review.reviewText) throw new ApiError(400, "Review text is required");
  if (!Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) {
    throw new ApiError(400, "Review rating must be between 1 and 5");
  }

  const [currentRows] = await pool.execute(
    "SELECT review_type AS reviewType, is_verified_purchase AS isVerifiedPurchase FROM reviews WHERE review_id = ? LIMIT 1",
    [Number(reviewId)]
  );

  if (!currentRows[0]) throw new ApiError(404, "Review not found");

  const reviewType = currentRows[0].reviewType;
  const isVerifiedPurchase = reviewType === REVIEW_TYPES.ADMIN
    ? true
    : reviewType === REVIEW_TYPES.GUEST
    ? false
    : Boolean(currentRows[0].isVerifiedPurchase);
  const createdAtSql = review.createdAt ? ", created_at = ?" : "";
  const createdAtValues = review.createdAt ? [review.createdAt] : [];

  await pool.execute(
    `UPDATE reviews
     SET product_id = ?,
         reviewer_name = ?,
         reviewer_email = ?,
         rating = ?,
         review_title = ?,
         review_text = ?,
         is_verified_purchase = ?,
         is_anonymous = ?,
         visibility_status = ?
         ${createdAtSql}
     WHERE review_id = ?`,
    [
      review.productId,
      review.reviewerName,
      review.reviewerEmail,
      review.rating,
      review.reviewTitle,
      review.reviewText,
      isVerifiedPurchase ? 1 : 0,
      review.isAnonymous ? 1 : 0,
      review.visibilityStatus,
      ...createdAtValues,
      Number(reviewId)
    ]
  );

  return { reviewId: Number(reviewId), isVerifiedPurchase };
}

export async function updateReviewReply(reviewId, adminReply = "") {
  await ensureReviewSchema();
  const replyText = String(adminReply || "").trim();
  const [result] = await pool.execute(
    `UPDATE reviews
     SET admin_reply = ?,
         admin_reply_at = CASE WHEN ? = '' THEN NULL ELSE CURRENT_TIMESTAMP END
     WHERE review_id = ?`,
    [replyText || null, replyText, Number(reviewId)]
  );

  if (!result.affectedRows) {
    throw new ApiError(404, "Review not found");
  }

  return {
    reviewId: Number(reviewId),
    adminReply: replyText,
    hasAdminReply: Boolean(replyText)
  };
}
