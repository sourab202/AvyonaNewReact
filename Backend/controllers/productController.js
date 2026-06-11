import fs from "fs/promises";
import path from "path";
import XLSX from "xlsx";
import { query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";
import { slugify } from "../utils/slugify.js";
import { readTabularBuffer, SUPPORTED_TABULAR_FORMAT_LABEL } from "../utils/tabularImport.js";

const localProductsPath = path.resolve(process.cwd(), "data", "local-products.json");
const inventoryImportJobs = new Map();
const inventoryExportJobs = new Map();
const inventoryImportBatchSize = 500;
let inventoryImportTablesReady = false;
let inventoryRelationshipTablesReady = false;
let productSortOrderColumnReady = false;

function isDatabaseUnavailable(error) {
  if (process.env.REQUIRE_MYSQL === "true") return false;
  return ["ECONNREFUSED", "ER_NO_SUCH_TABLE", "ER_BAD_DB_ERROR", "PROTOCOL_CONNECTION_LOST"].includes(error?.code);
}

async function runIdempotentSchemaStatement(statement) {
  try {
    await query(statement);
  } catch (error) {
    if (!["ER_DUP_KEYNAME", "ER_DUP_FIELDNAME", "ER_FK_DUP_NAME"].includes(error?.code)) {
      throw error;
    }
  }
}

async function ensureInventoryImportTables() {
  if (inventoryImportTablesReady) return;

  await query(
    `CREATE TABLE IF NOT EXISTS inventory_import_jobs (
      id VARCHAR(80) NOT NULL PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL,
      stored_file_path VARCHAR(500) NOT NULL,
      template_type VARCHAR(80) NOT NULL,
      import_type VARCHAR(80) NOT NULL,
      uploaded_by VARCHAR(180) NULL,
      total_rows INT NOT NULL DEFAULT 0,
      processed_rows INT NOT NULL DEFAULT 0,
      success_rows INT NOT NULL DEFAULT 0,
      failed_rows INT NOT NULL DEFAULT 0,
      current_batch INT NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'queued',
      report_data JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL DEFAULT NULL
    )`
  );

  await query(
    `CREATE TABLE IF NOT EXISTS inventory_import_failed_rows (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      import_id VARCHAR(80) NOT NULL,
      \`row_number\` INT NOT NULL,
      asin VARCHAR(80) NULL,
      sku VARCHAR(120) NULL,
      error_reason TEXT NOT NULL,
      original_row_data JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_inventory_failed_import (import_id),
      CONSTRAINT fk_inventory_failed_import
        FOREIGN KEY (import_id) REFERENCES inventory_import_jobs(id)
        ON DELETE CASCADE
    )`
  );

  await runIdempotentSchemaStatement("CREATE INDEX idx_inventory_import_jobs_status_created ON inventory_import_jobs(status, created_at)");
  await runIdempotentSchemaStatement("CREATE INDEX idx_inventory_import_jobs_template_type ON inventory_import_jobs(template_type, import_type)");
  await runIdempotentSchemaStatement("CREATE INDEX idx_inventory_import_failed_rows_keys ON inventory_import_failed_rows(asin, sku)");

  await query(
    `CREATE TABLE IF NOT EXISTS inventory_export_jobs (
      id VARCHAR(80) NOT NULL PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL,
      stored_file_path VARCHAR(500) NULL,
      export_type VARCHAR(80) NOT NULL,
      requested_by VARCHAR(180) NULL,
      filters_json JSON NULL,
      total_rows INT NOT NULL DEFAULT 0,
      processed_rows INT NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'queued',
      message TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL DEFAULT NULL
    )`
  );
  await runIdempotentSchemaStatement("CREATE INDEX idx_inventory_export_jobs_status_created ON inventory_export_jobs(status, created_at)");
  await runIdempotentSchemaStatement("CREATE INDEX idx_inventory_export_jobs_type_created ON inventory_export_jobs(export_type, created_at)");

  inventoryImportTablesReady = true;
}

async function ensureProductSortOrderColumn() {
  if (productSortOrderColumnReady) return;
  try {
    await runIdempotentSchemaStatement("ALTER TABLE products ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER is_visible");
    await runIdempotentSchemaStatement("CREATE INDEX idx_products_sort_order ON products(sort_order, created_at)");
    productSortOrderColumnReady = true;
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
  }
}

async function ensureInventoryRelationshipTables() {
  if (inventoryRelationshipTablesReady) return;

  await query(
    `CREATE TABLE IF NOT EXISTS product_policy_items (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      product_id INT UNSIGNED NOT NULL,
      policy_title VARCHAR(140) NOT NULL,
      policy_body TEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_product_policy_items_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE
    )`
  );

  await query(
    `CREATE TABLE IF NOT EXISTS product_faqs (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      product_id INT UNSIGNED NOT NULL,
      question VARCHAR(255) NOT NULL,
      answer TEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_product_faqs_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE
    )`
  );

  inventoryRelationshipTablesReady = true;
}

async function readLocalProducts() {
  try {
    const raw = await fs.readFile(localProductsPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocalProducts(products) {
  await fs.mkdir(path.dirname(localProductsPath), { recursive: true });
  await fs.writeFile(localProductsPath, JSON.stringify(products, null, 2));
}

function normalizeLocalProduct(payload) {
  const now = new Date().toISOString();
  const price = Number(payload.price || 0);
  const mrp = Number(payload.mrp || price || 0);
  const categorySlug = payload.categorySlug || "products";

  return {
    id: Date.now(),
    categoryId: null,
    categoryName: categorySlug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
    categorySlug,
    variantGroupDbId: null,
    variantGroupId: null,
    asin: String(payload.asin || `AVY-${Date.now()}`).trim(),
    sku: payload.sku || "",
    barcode: payload.barcode || "",
    modelNumber: payload.modelNumber || "",
    name: payload.name,
    slug: payload.slug ? slugify(payload.slug) : slugify(payload.name),
    brand: payload.brand,
    shortDescription: payload.shortDescription || "",
    description: payload.description || "",
    price,
    mrp,
    stockQuantity: Number(payload.stockQuantity || 0),
    rating: Number(payload.rating || 0),
    reviewCount: Number(payload.reviewCount || 0),
    imageUrl: payload.imageUrl || "",
    highlights: Array.isArray(payload.highlights) ? payload.highlights : [],
    specs: Array.isArray(payload.specGroups) ? payload.specGroups : [],
    faqs: Array.isArray(payload.faqs) ? payload.faqs : [],
    policies: Array.isArray(payload.policies) ? payload.policies : [],
    status: payload.status || "draft",
    isDeleted: false,
    isVisible: true,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function cleanText(value) {
  return String(value || "").trim();
}

async function replaceProductHighlightsFromPayload(productId, highlights) {
  if (!Array.isArray(highlights)) return;

  const rows = highlights.map(cleanText).filter(Boolean);
  await query("DELETE FROM product_highlights WHERE product_id = ?", [productId]);

  for (const [index, highlight] of rows.entries()) {
    await query(
      "INSERT INTO product_highlights (product_id, highlight_text, sort_order) VALUES (?, ?, ?)",
      [productId, highlight, index]
    );
  }
}

async function replaceProductSpecificationsFromPayload(productId, specGroups) {
  if (!Array.isArray(specGroups)) return;

  const groups = specGroups
    .map((group) => ({
      title: cleanText(group?.title || group?.name),
      items: (Array.isArray(group?.items) ? group.items : [])
        .map((item) => ({
          label: cleanText(Array.isArray(item) ? item[0] : item?.label),
          value: cleanText(Array.isArray(item) ? item[1] : item?.value)
        }))
        .filter((item) => item.label && item.value)
    }))
    .filter((group) => group.title && group.items.length);

  await query("DELETE FROM product_spec_groups WHERE product_id = ?", [productId]);

  for (const [groupIndex, group] of groups.entries()) {
    const result = await query(
      "INSERT INTO product_spec_groups (product_id, group_name, sort_order) VALUES (?, ?, ?)",
      [productId, group.title, groupIndex]
    );

    for (const [itemIndex, item] of group.items.entries()) {
      await query(
        "INSERT INTO product_spec_items (spec_group_id, spec_label, spec_value, sort_order) VALUES (?, ?, ?, ?)",
        [result.insertId, item.label, item.value, itemIndex]
      );
    }
  }
}

async function replaceProductFaqsFromPayload(productId, faqs) {
  if (!Array.isArray(faqs)) return;
  await ensureInventoryRelationshipTables();

  const rows = faqs
    .map((faq) => ({
      question: cleanText(faq?.question),
      answer: cleanText(faq?.answer)
    }))
    .filter((faq) => faq.question && faq.answer);

  await query("DELETE FROM product_faqs WHERE product_id = ?", [productId]);

  for (const [index, faq] of rows.entries()) {
    await query(
      "INSERT INTO product_faqs (product_id, question, answer, sort_order) VALUES (?, ?, ?, ?)",
      [productId, faq.question, faq.answer, index]
    );
  }
}

async function replaceProductPoliciesFromPayload(productId, policies) {
  if (!Array.isArray(policies)) return;
  await ensureInventoryRelationshipTables();

  const rows = policies
    .map((policy) => ({
      title: cleanText(policy?.title),
      body: cleanText(policy?.body || policy?.content)
    }))
    .filter((policy) => policy.title && policy.body);

  await query("DELETE FROM product_policy_items WHERE product_id = ?", [productId]);

  for (const [index, policy] of rows.entries()) {
    await query(
      "INSERT INTO product_policy_items (product_id, policy_title, policy_body, sort_order) VALUES (?, ?, ?, ?)",
      [productId, policy.title, policy.body, index]
    );
  }
}

async function replaceProductDetailsFromPayload(productId, payload = {}) {
  await replaceProductHighlightsFromPayload(productId, payload.highlights);
  await replaceProductSpecificationsFromPayload(productId, payload.specGroups);
  await replaceProductFaqsFromPayload(productId, payload.faqs);
  await replaceProductPoliciesFromPayload(productId, payload.policies);
}

function getProductMasterKey(payload = {}) {
  const asin = String(payload.asin || "").trim();
  const sku = String(payload.sku || "").trim();
  return {
    asin,
    sku,
    key: `${asin} / ${sku}`
  };
}

function filterLocalProducts(products, request) {
  const search = String(request.query.search || "").trim().toLowerCase();
  const status = String(request.query.status || "").trim();
  const categorySlugs = getQueryList(request.query, "categorySlug").concat(getQueryList(request.query, "category"));
  const brands = getQueryList(request.query, "brand");
  const availability = [
    ...getQueryList(request.query, "availability"),
    ...getQueryList(request.query, "stock")
  ];
  const minPrice = request.query.minPrice === undefined ? null : Number(request.query.minPrice);
  const maxPrice = request.query.maxPrice === undefined ? null : Number(request.query.maxPrice);
  const minRating = request.query.rating === undefined && request.query.minRating === undefined
    ? null
    : Number(request.query.rating ?? request.query.minRating);

  return products
    .filter((product) => !product.isDeleted)
    .filter((product) => !status || product.status === status)
    .filter((product) => !categorySlugs.length || categorySlugs.includes(product.categorySlug))
    .filter((product) => !brands.length || brands.includes(product.brand))
    .filter((product) => minPrice === null || Number(product.price || 0) >= minPrice)
    .filter((product) => maxPrice === null || Number(product.price || 0) <= maxPrice)
    .filter((product) => minRating === null || Number(product.rating || 0) >= minRating)
    .filter((product) => {
      if (!availability.length || (availability.includes("in-stock") && availability.includes("out-of-stock"))) return true;
      const inStock = Number(product.stockQuantity || product.availableStock || 0) > 0;
      return availability.includes(inStock ? "in-stock" : "out-of-stock");
    })
    .filter((product) => {
      if (!search) return true;
      return [product.name, product.brand, product.slug, product.asin, product.sku, product.barcode, product.modelNumber, product.categoryName]
        .some((value) => String(value || "").toLowerCase().includes(search));
    });
}

function parsePositiveInteger(value, fallback, max = 100) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function getPagination(request) {
  const page = parsePositiveInteger(request.query.page, 1, 100000);
  const limit = parsePositiveInteger(request.query.limit, 24, 100);
  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
}

function getQueryList(source = {}, key) {
  const rawValue = source[key];
  const rawItems = Array.isArray(rawValue) ? rawValue : [rawValue];
  return rawItems
    .flatMap((item) => String(item || "").split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function appendInFilter(filters, values, column, items) {
  if (!items.length) return;
  filters.push(`${column} IN (${items.map(() => "?").join(", ")})`);
  values.push(...items);
}

function getNumericFilter(source = {}, keys = []) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== "") {
      const value = Number(source[key]);
      return Number.isFinite(value) ? value : null;
    }
  }
  return null;
}

function getSortClause(sortValue) {
  const sort = String(sortValue || "latest").trim();
  if (["manual", "sort-order", "sort"].includes(sort)) return "p.sort_order ASC, p.created_at DESC";
  if (["latest", "newest", "featured"].includes(sort)) return "p.sort_order ASC, p.created_at DESC";
  if (["price", "price-low-high", "price-asc"].includes(sort)) return "p.price ASC, p.created_at DESC";
  if (["price-high-low", "price-desc"].includes(sort)) return "p.price DESC, p.created_at DESC";
  if (["popularity", "popular", "best-selling"].includes(sort)) return "p.sold_quantity DESC, p.review_count DESC, p.rating DESC, p.created_at DESC";
  if (sort === "rating-high-low") return "p.rating DESC, p.review_count DESC, p.created_at DESC";
  if (sort === "name-a-z") return "p.name ASC";
  return "p.created_at DESC";
}


function normalizeSearchTerm(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function getSearchTokens(searchTerm) {
  return normalizeSearchTerm(searchTerm)
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}_-]+/gu, "").trim())
    .filter((token) => token.length >= 2)
    .slice(0, 8);
}

function getSearchFilterTokens(searchTerm) {
  return normalizeSearchTerm(searchTerm)
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}_-]+/gu, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function getBooleanSearchQuery(searchTerm) {
  return getSearchTokens(searchTerm)
    .map((token) => `+${token}*`)
    .join(" ");
}

function getSearchRankSql() {
  return `(
    CASE
      WHEN LOWER(COALESCE(p.asin, '')) = LOWER(?) THEN 1200
      WHEN LOWER(COALESCE(p.sku, '')) = LOWER(?) THEN 1150
      WHEN LOWER(COALESCE(p.model_number, '')) = LOWER(?) THEN 1100
      WHEN LOWER(COALESCE(p.barcode, '')) = LOWER(?) THEN 1050
      ELSE 0
    END
    + CASE WHEN LOWER(COALESCE(p.brand, '')) = LOWER(?) THEN 650 ELSE 0 END
    + CASE WHEN LOWER(COALESCE(p.name, '')) = LOWER(?) THEN 500 ELSE 0 END
    + CASE WHEN LOWER(COALESCE(p.name, '')) LIKE LOWER(?) THEN 280 ELSE 0 END
    + CASE WHEN LOWER(COALESCE(p.brand, '')) LIKE LOWER(?) THEN 240 ELSE 0 END
    + CASE WHEN LOWER(COALESCE(c.name, '')) LIKE LOWER(?) THEN 230 ELSE 0 END
    + CASE WHEN LOWER(COALESCE(c.slug, '')) LIKE LOWER(?) THEN 180 ELSE 0 END
    + CASE WHEN LOWER(COALESCE(p.model_number, '')) LIKE LOWER(?) THEN 220 ELSE 0 END
    + CASE WHEN LOWER(COALESCE(p.asin, '')) LIKE LOWER(?) THEN 210 ELSE 0 END
    + CASE WHEN LOWER(COALESCE(p.sku, '')) LIKE LOWER(?) THEN 210 ELSE 0 END
    + CASE WHEN SOUNDEX(p.name) = SOUNDEX(?) THEN 90 ELSE 0 END
    + CASE WHEN SOUNDEX(p.brand) = SOUNDEX(?) THEN 70 ELSE 0 END
    + (MATCH(p.name, p.brand, p.asin, p.sku, p.barcode, p.model_number, p.short_description, p.description) AGAINST (? IN NATURAL LANGUAGE MODE) * 40)
  )`;
}

function getSearchRankValues(searchTerm) {
  const normalized = normalizeSearchTerm(searchTerm);
  const prefix = `${normalized}%`;

  return [
    normalized,
    normalized,
    normalized,
    normalized,
    normalized,
    normalized,
    prefix,
    prefix,
    prefix,
    prefix,
    prefix,
    prefix,
    prefix,
    normalized,
    normalized,
    normalized
  ];
}

function appendSearchFilter(filters, values, searchTerm) {
  const normalized = normalizeSearchTerm(searchTerm);
  if (!normalized) return false;

  const filterTokens = getSearchFilterTokens(normalized);
  if (filterTokens.length > 1) {
    const searchableFields = [
      "p.name",
      "p.brand",
      "p.slug",
      "p.asin",
      "p.sku",
      "p.barcode",
      "p.model_number",
      "p.short_description",
      "c.name",
      "c.slug"
    ];
    const tokenClauses = filterTokens.map(() => `(${searchableFields.map((field) => `${field} LIKE ?`).join(" OR ")})`);

    filters.push(`(${tokenClauses.join(" AND ")})`);
    filterTokens.forEach((token) => {
      const tokenLike = `%${token}%`;
      searchableFields.forEach(() => values.push(tokenLike));
    });
    return true;
  }

  const likeTerm = `%${normalized}%`;
  const prefixTerm = `${normalized}%`;
  const booleanSearch = getBooleanSearchQuery(normalized);
  const tokens = getSearchTokens(normalized);
  const allowPhoneticFallback = tokens.length === 1 && !/\d/.test(normalized);

  filters.push(`(
    p.name LIKE ?
    OR p.brand LIKE ?
    OR p.slug LIKE ?
    OR p.asin LIKE ?
    OR p.sku LIKE ?
    OR p.barcode LIKE ?
    OR p.model_number LIKE ?
    OR p.short_description LIKE ?
    OR c.name LIKE ?
    OR c.slug LIKE ?
    OR p.name LIKE ?
    OR p.brand LIKE ?
    OR p.model_number LIKE ?
    ${allowPhoneticFallback ? "OR SOUNDEX(p.name) = SOUNDEX(?) OR SOUNDEX(p.brand) = SOUNDEX(?)" : ""}
    ${booleanSearch ? "OR MATCH(p.name, p.brand, p.asin, p.sku, p.barcode, p.model_number, p.short_description, p.description) AGAINST (? IN BOOLEAN MODE)" : ""}
  )`);

  values.push(
    likeTerm,
    likeTerm,
    likeTerm,
    likeTerm,
    likeTerm,
    likeTerm,
    likeTerm,
    likeTerm,
    likeTerm,
    likeTerm,
    prefixTerm,
    prefixTerm,
    prefixTerm
  );

  if (allowPhoneticFallback) values.push(normalized, normalized);
  if (booleanSearch) values.push(booleanSearch);
  return true;
}

function applyLocalSort(products, sortValue) {
  const sort = String(sortValue || "latest").trim();
  return [...products].sort((left, right) => {
    if (["price", "price-low-high", "price-asc"].includes(sort)) return Number(left.price || 0) - Number(right.price || 0);
    if (["price-high-low", "price-desc"].includes(sort)) return Number(right.price || 0) - Number(left.price || 0);
    if (sort === "rating-high-low") {
      return Number(right.rating || 0) - Number(left.rating || 0) || Number(right.reviewCount || 0) - Number(left.reviewCount || 0);
    }
    if (["popularity", "popular", "best-selling"].includes(sort)) {
      return Number(right.soldQuantity || right.reviewCount || 0) - Number(left.soldQuantity || left.reviewCount || 0);
    }
    if (sort === "name-a-z") return String(left.name || "").localeCompare(String(right.name || ""));
    return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
  });
}

function paginateLocalProducts(products, request) {
  const { page, limit, offset } = getPagination(request);
  const sorted = applyLocalSort(products, request.query.sort);
  const data = sorted.slice(offset, offset + limit);
  const total = sorted.length;

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNextPage: offset + data.length < total,
      hasPreviousPage: page > 1
    }
  };
}

function getFacetRows(rows, key) {
  const counts = new Map();
  rows.forEach((row) => {
    const value = String(row[key] || "").trim();
    if (!value) return;
    counts.set(value, (counts.get(value) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

function getCategoryFacetRows(rows) {
  const counts = new Map();
  rows.forEach((row) => {
    const value = String(row.categorySlug || "").trim();
    if (!value) return;
    const existing = counts.get(value) || { value, label: String(row.categoryName || value).trim(), count: 0 };
    existing.count += 1;
    counts.set(value, existing);
  });

  return [...counts.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function normalizeImageUrls(imageUrls, fallbackImageUrl = "") {
  const urls = Array.isArray(imageUrls) ? imageUrls : [];
  return [...new Set([fallbackImageUrl, ...urls].map((url) => String(url || "").trim()).filter(Boolean))];
}

async function attachProductMedia(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows;
  await ensureInventoryRelationshipTables();

  const productIds = rows.map((row) => Number(row.id)).filter(Boolean);
  if (!productIds.length) return rows;

  const placeholders = productIds.map(() => "?").join(", ");
  const mediaRows = await query(
    `SELECT
      product_id AS productId,
      media_type AS mediaType,
      url,
      alt_text AS altText,
      sort_order AS sortOrder,
      is_primary AS isPrimary
     FROM product_media
     WHERE product_id IN (${placeholders})
     ORDER BY product_id ASC, is_primary DESC, sort_order ASC, id ASC`,
    productIds
  );
  const highlightRows = await query(
    `SELECT product_id AS productId, highlight_text AS highlightText, sort_order AS sortOrder
     FROM product_highlights
     WHERE product_id IN (${placeholders})
     ORDER BY product_id ASC, sort_order ASC, id ASC`,
    productIds
  );
  const specRows = await query(
    `SELECT
       g.product_id AS productId,
       g.group_name AS groupName,
       g.sort_order AS groupSortOrder,
       i.spec_label AS specLabel,
       i.spec_value AS specValue,
       i.sort_order AS itemSortOrder
     FROM product_spec_groups g
     LEFT JOIN product_spec_items i ON i.spec_group_id = g.id
     WHERE g.product_id IN (${placeholders})
     ORDER BY g.product_id ASC, g.sort_order ASC, g.id ASC, i.sort_order ASC, i.id ASC`,
    productIds
  );
  const faqRows = await query(
    `SELECT product_id AS productId, question, answer, sort_order AS sortOrder
     FROM product_faqs
     WHERE product_id IN (${placeholders})
     ORDER BY product_id ASC, sort_order ASC, id ASC`,
    productIds
  );
  const policyRows = await query(
    `SELECT product_id AS productId, policy_title AS title, policy_body AS body, sort_order AS sortOrder
     FROM product_policy_items
     WHERE product_id IN (${placeholders})
     ORDER BY product_id ASC, sort_order ASC, id ASC`,
    productIds
  );
  const relatedRows = await query(
    `SELECT
       r.product_id AS productId,
       p.id,
       p.asin,
       p.sku,
       p.name,
       p.slug,
       r.relation_type AS relationType,
       r.sort_order AS sortOrder
     FROM product_related_products r
     JOIN products p ON p.id = r.related_product_id
     WHERE r.product_id IN (${placeholders})
       AND p.is_deleted = 0
     ORDER BY r.product_id ASC, r.sort_order ASC, r.id ASC`,
    productIds
  );
  const mediaByProductId = new Map();
  const highlightsByProductId = new Map();
  const specsByProductId = new Map();
  const faqsByProductId = new Map();
  const policiesByProductId = new Map();
  const relatedByProductId = new Map();

  mediaRows.forEach((media) => {
    const list = mediaByProductId.get(Number(media.productId)) || [];
    list.push(media);
    mediaByProductId.set(Number(media.productId), list);
  });
  highlightRows.forEach((highlight) => {
    const list = highlightsByProductId.get(Number(highlight.productId)) || [];
    list.push(highlight.highlightText);
    highlightsByProductId.set(Number(highlight.productId), list);
  });
  specRows.forEach((spec) => {
    const productId = Number(spec.productId);
    const groups = specsByProductId.get(productId) || new Map();
    const groupName = spec.groupName || "Specifications";
    const group = groups.get(groupName) || { title: groupName, items: [] };
    if (spec.specLabel) group.items.push([spec.specLabel, spec.specValue || ""]);
    groups.set(groupName, group);
    specsByProductId.set(productId, groups);
  });
  faqRows.forEach((faq) => {
    const list = faqsByProductId.get(Number(faq.productId)) || [];
    list.push({ question: faq.question, answer: faq.answer || "" });
    faqsByProductId.set(Number(faq.productId), list);
  });
  policyRows.forEach((policy) => {
    const list = policiesByProductId.get(Number(policy.productId)) || [];
    list.push({ title: policy.title, body: policy.body || "" });
    policiesByProductId.set(Number(policy.productId), list);
  });
  relatedRows.forEach((related) => {
    const list = relatedByProductId.get(Number(related.productId)) || [];
    list.push(related);
    relatedByProductId.set(Number(related.productId), list);
  });

  return rows.map((row) => {
    const productId = Number(row.id);
    const media = mediaByProductId.get(Number(row.id)) || [];
    const galleryUrls = media
      .filter((item) => item.mediaType === "image")
      .map((item) => item.url);

    return {
      ...row,
      media,
      galleryUrls: normalizeImageUrls(galleryUrls, row.imageUrl),
      videoUrls: media.filter((item) => item.mediaType === "video").map((item) => item.url),
      highlights: highlightsByProductId.get(productId) || [],
      specs: [...(specsByProductId.get(productId)?.values() || [])],
      faqs: faqsByProductId.get(productId) || [],
      policies: policiesByProductId.get(productId) || [],
      relatedProducts: relatedByProductId.get(productId) || []
    };
  });
}

async function replaceProductImages(productId, imageUrls = [], productName = "") {
  const normalizedUrls = normalizeImageUrls(imageUrls);
  if (!normalizedUrls.length) return;

  await query("DELETE FROM product_media WHERE product_id = ? AND media_type = 'image'", [productId]);

  for (const [index, url] of normalizedUrls.entries()) {
    await query(
      `INSERT INTO product_media
        (product_id, media_type, url, alt_text, sort_order, is_primary)
       VALUES (?, 'image', ?, ?, ?, ?)`,
      [productId, url, productName || null, index, index === 0 ? 1 : 0]
    );
  }
}

function normalizeMediaUrls(urls = []) {
  return [...new Set((Array.isArray(urls) ? urls : [])
    .map((url) => String(url || "").trim())
    .filter(Boolean))];
}

async function replaceProductMediaAssets(productId, imageUrls = [], videoUrls = [], productName = "") {
  const normalizedImageUrls = normalizeImageUrls(imageUrls);
  const normalizedVideoUrls = normalizeMediaUrls(videoUrls);

  if (!normalizedImageUrls.length && !normalizedVideoUrls.length) return;

  await query("DELETE FROM product_media WHERE product_id = ?", [productId]);

  for (const [index, url] of normalizedImageUrls.entries()) {
    await query(
      `INSERT INTO product_media
        (product_id, media_type, url, alt_text, sort_order, is_primary)
       VALUES (?, 'image', ?, ?, ?, ?)`,
      [productId, url, productName || null, index, index === 0 ? 1 : 0]
    );
  }

  for (const [index, url] of normalizedVideoUrls.entries()) {
    await query(
      `INSERT INTO product_media
        (product_id, media_type, url, alt_text, sort_order, is_primary)
       VALUES (?, 'video', ?, ?, ?, 0)`,
      [productId, url, productName || null, normalizedImageUrls.length + index]
    );
  }
}

function getSequentialInventoryValues(row, prefix, max = 20) {
  const values = [];
  for (let index = 1; index <= max; index += 1) {
    values.push(getInventoryValue(row, [`${prefix} ${index}`]));
  }
  return values;
}

async function replaceProductMedia(productId, row, productName = "") {
  const primaryImageUrl = getInventoryValue(row, ["Primary Image URL"]);
  const imageUrls = normalizeImageUrls(getSequentialInventoryValues(row, "Gallery Image URL", 20), primaryImageUrl);
  const videoUrls = getSequentialInventoryValues(row, "Video URL", 10).filter(Boolean);

  if (!imageUrls.length && !videoUrls.length) return;

  await query("DELETE FROM product_media WHERE product_id = ?", [productId]);

  for (const [index, url] of imageUrls.entries()) {
    await query(
      `INSERT INTO product_media
        (product_id, media_type, url, alt_text, sort_order, is_primary)
       VALUES (?, 'image', ?, ?, ?, ?)`,
      [productId, url, productName || null, index, index === 0 ? 1 : 0]
    );
  }

  for (const [index, url] of videoUrls.entries()) {
    await query(
      `INSERT INTO product_media
        (product_id, media_type, url, alt_text, sort_order, is_primary)
       VALUES (?, 'video', ?, ?, ?, 0)`,
      [productId, url, productName || null, imageUrls.length + index]
    );
  }
}

async function replaceProductHighlights(productId, row) {
  const highlights = getSequentialInventoryValues(row, "Highlight", 20).filter(Boolean);
  if (!highlights.length) return;

  await query("DELETE FROM product_highlights WHERE product_id = ?", [productId]);
  for (const [index, highlight] of highlights.entries()) {
    await query(
      "INSERT INTO product_highlights (product_id, highlight_text, sort_order) VALUES (?, ?, ?)",
      [productId, highlight, index]
    );
  }
}

async function replaceProductSpecifications(productId, row) {
  const specs = [];
  for (let index = 1; index <= 20; index += 1) {
    const groupName = getInventoryValue(row, [`Spec Group ${index}`]);
    const label = getInventoryValue(row, [`Spec Label ${index}`]);
    const value = getInventoryValue(row, [`Spec Value ${index}`]);
    if (groupName || label || value) {
      specs.push({
        groupName: groupName || "Specifications",
        label: label || `Spec ${index}`,
        value
      });
    }
  }
  if (!specs.length) return;

  await query("DELETE FROM product_spec_groups WHERE product_id = ?", [productId]);
  const groupIds = new Map();
  for (const spec of specs) {
    if (!groupIds.has(spec.groupName)) {
      const result = await query(
        "INSERT INTO product_spec_groups (product_id, group_name, sort_order) VALUES (?, ?, ?)",
        [productId, spec.groupName, groupIds.size]
      );
      groupIds.set(spec.groupName, result.insertId);
    }
    await query(
      "INSERT INTO product_spec_items (spec_group_id, spec_label, spec_value, sort_order) VALUES (?, ?, ?, ?)",
      [groupIds.get(spec.groupName), spec.label, spec.value, specs.indexOf(spec)]
    );
  }
}

async function replaceProductFaqs(productId, row) {
  await ensureInventoryRelationshipTables();
  const faqs = [];
  for (let index = 1; index <= 20; index += 1) {
    const question = getInventoryValue(row, [`FAQ Question ${index}`]);
    const answer = getInventoryValue(row, [`FAQ Answer ${index}`]);
    if (question || answer) faqs.push({ question, answer });
  }
  if (!faqs.length) return;

  await query("DELETE FROM product_faqs WHERE product_id = ?", [productId]);
  for (const [index, faq] of faqs.entries()) {
    await query(
      "INSERT INTO product_faqs (product_id, question, answer, sort_order) VALUES (?, ?, ?, ?)",
      [productId, faq.question || `FAQ ${index + 1}`, faq.answer || "", index]
    );
  }
}

async function replaceProductPolicies(productId, row) {
  await ensureInventoryRelationshipTables();
  const policies = [
    ["Shipping Information", getInventoryValue(row, ["Shipping Information"])],
    ["Return & Refund", getInventoryValue(row, ["Return & Refund", "Return and Refund"])],
    ["Warranty Support", getInventoryValue(row, ["Warranty Support"])],
    ["COD Information", getInventoryValue(row, ["COD Information"])]
  ].filter(([, body]) => body);
  if (!policies.length) return;

  await query("DELETE FROM product_policy_items WHERE product_id = ?", [productId]);
  for (const [index, [title, body]] of policies.entries()) {
    await query(
      "INSERT INTO product_policy_items (product_id, policy_title, policy_body, sort_order) VALUES (?, ?, ?, ?)",
      [productId, title, body, index]
    );
  }
}

async function findProductsByAsinOrSku(keys = []) {
  const normalizedKeys = [...new Set(keys.map((key) => String(key || "").trim()).filter(Boolean))];
  if (!normalizedKeys.length) return [];
  return query(
    `SELECT id, asin, sku, category_id AS categoryId
     FROM products
     WHERE is_deleted = 0
       AND (LOWER(asin) IN (${normalizedKeys.map(() => "LOWER(?)").join(",")})
        OR LOWER(sku) IN (${normalizedKeys.map(() => "LOWER(?)").join(",")}))`,
    [...normalizedKeys, ...normalizedKeys]
  );
}

async function queryProductKeysInChunks(productKeys = []) {
  const rows = [];
  const chunkSize = 500;
  for (let index = 0; index < productKeys.length; index += chunkSize) {
    const chunk = productKeys.slice(index, index + chunkSize);
    if (!chunk.length) continue;
    rows.push(...await query(
      `SELECT id, asin, sku, slug
       FROM products
       WHERE is_deleted = 0
         AND (LOWER(asin) IN (${chunk.map(() => "LOWER(?)").join(",")})
          OR LOWER(sku) IN (${chunk.map(() => "LOWER(?)").join(",")}))`,
      [
        ...chunk.map((key) => key.asin || ""),
        ...chunk.map((key) => key.sku || "")
      ]
    ));
  }
  return rows;
}

async function queryScalarValuesInChunks(values = [], sqlFactory) {
  const rows = [];
  const chunkSize = 500;
  const uniqueValues = [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
  for (let index = 0; index < uniqueValues.length; index += chunkSize) {
    const chunk = uniqueValues.slice(index, index + chunkSize);
    if (!chunk.length) continue;
    const { sql, params } = sqlFactory(chunk);
    rows.push(...await query(sql, params));
  }
  return rows;
}

function splitRelatedKeys(value) {
  return String(value || "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function replaceProductRelatedProducts(productId, row, categoryId) {
  const manualKeys = [
    ...splitRelatedKeys(getInventoryValue(row, ["Manual Related ASIN", "Manual Related ASIN/SKU"])),
    ...splitRelatedKeys(getInventoryValue(row, ["Manual Related SKU"]))
  ];
  const mode = String(getInventoryValue(row, ["Related Products Mode"]) || "").toLowerCase();
  const autoByCategory = normalizeBooleanCell(getInventoryValue(row, ["Auto Related By Category"]));

  if (!manualKeys.length && !autoByCategory && mode !== "auto") return;

  await query("DELETE FROM product_related_products WHERE product_id = ?", [productId]);

  let relatedProducts = await findProductsByAsinOrSku(manualKeys);
  if ((autoByCategory || mode === "auto") && categoryId) {
    const autoProducts = await query(
      `SELECT id, asin, sku
       FROM products
       WHERE category_id = ?
         AND id <> ?
         AND is_deleted = 0
       ORDER BY sold_quantity DESC, rating DESC, created_at DESC
       LIMIT 12`,
      [categoryId, productId]
    );
    relatedProducts = [...relatedProducts, ...autoProducts];
  }

  const uniqueRelatedIds = [...new Set(relatedProducts.map((product) => Number(product.id)).filter((id) => id && id !== Number(productId)))];
  for (const [index, relatedProductId] of uniqueRelatedIds.entries()) {
    await query(
      `INSERT IGNORE INTO product_related_products
        (product_id, related_product_id, relation_type, sort_order)
       VALUES (?, ?, ?, ?)`,
      [productId, relatedProductId, manualKeys.length ? "manual" : "auto", index]
    );
  }
}

async function upsertProductVariantGroup(productId, row) {
  const groupName = getInventoryValue(row, ["Variant Group Name"]);
  const variantType = getInventoryValue(row, ["Variant Type"]);
  const variantValue = getInventoryValue(row, ["Variant Value"]);
  if (!groupName || !variantType) return null;

  let groupRows = await query(
    "SELECT id FROM variant_groups WHERE LOWER(group_name) = LOWER(?) AND LOWER(variant_type) = LOWER(?) LIMIT 1",
    [groupName, variantType]
  );
  let groupId = groupRows[0]?.id;
  if (!groupId) {
    const result = await query(
      "INSERT INTO variant_groups (group_name, variant_type, status) VALUES (?, ?, 'saved')",
      [groupName, variantType]
    );
    groupId = result.insertId;
    await query("UPDATE variant_groups SET group_id = ? WHERE id = ? LIMIT 1", [`GRP${String(groupId).padStart(4, "0")}`, groupId]);
  }

  await query("UPDATE products SET variant_group_id = ? WHERE id = ? LIMIT 1", [groupId, productId]);
  await query("INSERT IGNORE INTO variant_group_products (variant_group_id, product_id) VALUES (?, ?)", [groupId, productId]);

  if (variantValue) {
    await query("DELETE FROM product_variants WHERE product_id = ? AND variant_type = ?", [productId, variantType]);
    await query(
      `INSERT INTO product_variants
        (product_id, variant_type, variant_value, sku, asin, status)
       SELECT id, ?, ?, sku, asin, 'active'
       FROM products
       WHERE id = ?
       LIMIT 1`,
      [variantType, variantValue, productId]
    );
  }

  return groupId;
}

async function findProductByMasterKey({ asin, sku }) {
  const rows = await query(
    `SELECT id, asin, sku, name, category_id AS categoryId, is_deleted AS isDeleted
     FROM products
     WHERE LOWER(asin) = LOWER(?) OR LOWER(sku) = LOWER(?)
     ORDER BY
       CASE
        WHEN LOWER(asin) = LOWER(?) THEN 1
        WHEN LOWER(COALESCE(sku, '')) = LOWER(?) THEN 2
        ELSE 3
       END
     LIMIT 2`,
    [asin, sku, asin, sku]
  );

  if (rows.length > 1 && new Set(rows.map((row) => Number(row.id))).size > 1) {
    throw new ApiError(409, "ASIN and SKU belong to different products. Fix the import row before updating inventory.");
  }

  return rows[0] || null;
}

function parseExportDate(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function normalizeInventoryColumnName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getInventoryValue(row, labels) {
  for (const label of labels) {
    const directValue = row[label];
    if (directValue !== undefined && directValue !== null && String(directValue).trim() !== "") return String(directValue).trim();
    const normalizedLabel = normalizeInventoryColumnName(label);
    const matchingKey = Object.keys(row).find((key) => normalizeInventoryColumnName(key) === normalizedLabel);
    if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null && String(row[matchingKey]).trim() !== "") {
      return String(row[matchingKey]).trim();
    }
  }

  return "";
}

function getRequiredInventoryColumns(templateType) {
  if (templateType === "stock-update") return ["ASIN", "SKU", "Stock Quantity", "Stock Status", "Availability Message"];
  if (templateType === "price-update") return ["ASIN", "SKU", "MRP", "Selling Price", "Tax Included"];
  return ["Product Name", "ASIN", "SKU", "Product Slug", "Product Type", "Product Status", "Brand", "Category", "Selling Price", "MRP"];
}

function isValidNumberText(value) {
  const normalized = normalizeInventoryNumberText(value);
  if (normalized === "") return false;
  return Number.isFinite(Number(normalized));
}

function normalizeInventoryNumberText(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const normalized = text
    .replace(/,/g, "")
    .replace(/[₹$€£]/g, "")
    .replace(/%/g, "")
    .replace(/\s+/g, "")
    .replace(/[^\d.-]/g, "");

  if (!normalized || normalized === "-" || normalized === "." || normalized === "-.") return "";
  return normalized;
}

function parseInventoryNumber(value, fallback = 0) {
  const normalized = normalizeInventoryNumberText(value);
  if (normalized === "") return fallback;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}

function isValidUrlText(value) {
  if (!value) return true;
  const text = String(value || "").trim();
  if (/^\/(?:uploads|images)\//i.test(text)) return true;
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function normalizeProductStatus(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const aliases = {
    enabled: "active",
    live: "active",
    published: "active",
    publish: "active",
    in_stock: "active",
    available: "active",
    availbe: "active",
    avavile: "active",
    avilable: "active",
    unavailable: "out_of_stock",
    unavailbe: "out_of_stock",
    unavavile: "out_of_stock",
    unavilable: "out_of_stock",
    out_stock: "out_of_stock",
    outofstock: "out_of_stock",
    sold_out: "out_of_stock"
  };

  return aliases[normalized] || normalized;
}

function isValidProductStatus(value) {
  return ["draft", "active", "archived", "out_of_stock", "inactive"].includes(normalizeProductStatus(value));
}

function normalizeStockStatus(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const aliases = {
    active: "in-stock",
    available: "in-stock",
    availbe: "in-stock",
    avavile: "in-stock",
    avilable: "in-stock",
    enabled: "in-stock",
    instock: "in-stock",
    "in-stock": "in-stock",
    "in-stock-available": "in-stock",
    stocked: "in-stock",
    yes: "in-stock",
    true: "in-stock",
    low: "low-stock",
    lowstock: "low-stock",
    "low-stock": "low-stock",
    "limited-stock": "low-stock",
    "running-low": "low-stock",
    inactive: "out-of-stock",
    unavailable: "out-of-stock",
    unavailbe: "out-of-stock",
    unavavile: "out-of-stock",
    unavilable: "out-of-stock",
    outofstock: "out-of-stock",
    "out-stock": "out-of-stock",
    "out-of-stock": "out-of-stock",
    "sold-out": "out-of-stock",
    no: "out-of-stock",
    false: "out-of-stock"
  };

  return aliases[normalized] || normalized;
}

function isValidStockStatus(value) {
  return ["in-stock", "low-stock", "out-of-stock"].includes(normalizeStockStatus(value));
}

function getProductStatusFromStockStatus(value) {
  const stockStatus = normalizeStockStatus(value);
  if (stockStatus === "in-stock" || stockStatus === "low-stock") return "active";
  if (stockStatus === "out-of-stock") return "out_of_stock";
  return "";
}

function getStockQuantityFromStockStatus(stockQuantity, stockStatus) {
  const normalizedStockStatus = normalizeStockStatus(stockStatus);
  const parsedQuantity = parseInventoryNumber(stockQuantity, 0);

  if (normalizedStockStatus === "out-of-stock") return 0;
  if ((normalizedStockStatus === "in-stock" || normalizedStockStatus === "low-stock") && parsedQuantity <= 0) return 1;

  return parsedQuantity;
}

function splitRelatedAsins(value) {
  return String(value || "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonValue(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function readInventoryWorkbook(filePath, fileName = filePath) {
  const buffer = await fs.readFile(filePath);
  return readTabularBuffer(buffer, fileName);
}

function getInventoryFixGuidance(errorMessage) {
  const error = String(errorMessage || "");
  if (error.startsWith("Missing required column:")) return `Add the exact header "${error.split(":").slice(1).join(":").trim()}" to the first row of the file.`;
  if (error === "ASIN is required") return "Enter a unique ASIN value in the ASIN column.";
  if (error === "SKU is required") return "Enter a unique SKU value in the SKU column.";
  if (error.includes("Duplicate ASIN")) return "Keep each ASIN on only one row, then upload the corrected file again.";
  if (error.includes("Duplicate SKU")) return "Keep each SKU on only one row, then upload the corrected file again.";
  if (error.includes("belong to different products")) return "Use the ASIN and SKU from the same existing product, or create a new unique pair.";
  if (error.includes("does not exist for update")) return "Use Create + Update mode, or first create the product with the Full Product template.";
  if (error.includes("Category is required")) return "Enter a category for every new product.";
  if (error.includes("Category does not exist")) return "Use an existing category name or enable auto-create missing category/brand.";
  if (error.includes("Subcategory does not exist")) return "Use an existing subcategory name or enable auto-create missing category/brand.";
  if (error.includes("Brand is required")) return "Enter a brand for every product row.";
  if (error.includes("Brand does not exist")) return "Use an existing brand name or enable auto-create missing category/brand.";
  if (error.includes("Selling Price")) return "Enter Selling Price as a number without currency symbols or words.";
  if (error.includes("MRP format")) return "Enter MRP as a number without currency symbols or words.";
  if (error.includes("Stock Quantity")) return "Enter Stock Quantity as a whole number, for example 0, 5, or 25.";
  if (error.includes("Product Status")) return "Use a supported product status such as active, inactive, draft, or archived.";
  if (error.includes("Stock Status")) return "Use in-stock, low-stock, or out-of-stock.";
  if (error.includes("not a valid URL")) return "Enter a complete http:// or https:// URL, or leave the optional URL field empty.";
  if (error.includes("Slug is already used")) return "Choose a unique Product Slug or leave it empty so the system can generate one.";
  if (error.includes("Related product ASIN/SKU")) return "Remove the unknown related key or replace it with an ASIN/SKU that already exists.";
  return "Correct the highlighted value using the downloaded template, then validate the file again.";
}

function parseInventoryUpdateControls(value, templateType = "full-product") {
  const defaults = {
    basicInfo: templateType === "full-product",
    pricing: templateType === "full-product" || templateType === "price-update",
    stock: templateType === "full-product" || templateType === "stock-update",
    media: templateType === "full-product",
    description: templateType === "full-product",
    specifications: templateType === "full-product",
    seo: templateType === "full-product",
    policies: templateType === "full-product",
    faqs: templateType === "full-product",
    variantGroups: templateType === "full-product"
  };
  const parsed = typeof value === "string"
    ? parseJsonValue(value, {})
    : value || {};
  return {
    ...defaults,
    ...parsed
  };
}

function normalizeBooleanCell(value) {
  const text = String(value || "").trim().toLowerCase();
  return ["yes", "true", "1", "on"].includes(text) ? 1 : 0;
}

function normalizeBooleanFlag(value) {
  if (typeof value === "boolean") return value;
  const text = String(value || "").trim().toLowerCase();
  return ["yes", "true", "1", "on"].includes(text);
}

function normalizeInventoryDbStatus(value) {
  const status = normalizeProductStatus(value);
  if (status === "inactive") return "draft";
  return ["draft", "active", "archived", "out_of_stock"].includes(status) ? status : "draft";
}

function getInventoryLookupValues(values = []) {
  return [...new Set([...values].flatMap((value) => {
    const text = String(value || "").trim();
    if (!text) return [];
    return [text, slugify(text)];
  }).filter(Boolean))];
}

function normalizeInventoryLookupKey(value) {
  return slugify(String(value || "").trim()).toLowerCase();
}

async function getOrCreateCategoryId(name, parentId = null, autoCreate = false) {
  const categoryName = String(name || "").trim();
  if (!categoryName) return null;

  const rows = await query(
    "SELECT id FROM categories WHERE LOWER(slug) = LOWER(?) OR LOWER(name) = LOWER(?) LIMIT 1",
    [slugify(categoryName), categoryName]
  );
  if (rows[0]?.id) return rows[0].id;
  if (!autoCreate) return null;

  const result = await query(
    `INSERT INTO categories (name, slug, parent_id, status, is_active)
     VALUES (?, ?, ?, 'active', 1)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [categoryName, slugify(categoryName), parentId]
  );
  return result.insertId;
}

async function getCategoryIdForInventoryRow(row, autoCreate = false) {
  const category = getInventoryValue(row, ["Category"]);
  const subcategory = getInventoryValue(row, ["Subcategory"]);
  const categoryId = await getOrCreateCategoryId(category, null, autoCreate);
  if (!subcategory) return categoryId;
  return getOrCreateCategoryId(subcategory, categoryId, autoCreate);
}

async function syncProductCategoryRelations(productId, categoryId) {
  if (!categoryId) return;

  const rows = await query("SELECT id, parent_id AS parentId FROM categories WHERE id = ? LIMIT 1", [categoryId]);
  const primaryCategory = rows[0];
  if (!primaryCategory) return;

  await query(
    `INSERT INTO product_categories (product_id, category_id, relation_type)
     VALUES (?, ?, 'primary')
     ON DUPLICATE KEY UPDATE relation_type = VALUES(relation_type)`,
    [productId, categoryId]
  );

  if (primaryCategory.parentId) {
    await query(
      `INSERT INTO product_categories (product_id, category_id, relation_type)
       VALUES (?, ?, 'secondary')
       ON DUPLICATE KEY UPDATE relation_type = VALUES(relation_type)`,
      [productId, primaryCategory.parentId]
    );
  }
}

async function getOrCreateBrandForInventoryRow(row, autoCreate = false) {
  const brandName = getInventoryValue(row, ["Brand"]);
  if (!brandName) return { brandId: null, brandName: "" };

  const rows = await query(
    "SELECT id, name FROM brands WHERE LOWER(slug) = LOWER(?) OR LOWER(name) = LOWER(?) LIMIT 1",
    [slugify(brandName), brandName]
  );
  if (rows[0]?.id) return { brandId: rows[0].id, brandName: rows[0].name || brandName };
  if (!autoCreate) return { brandId: null, brandName };

  const result = await query(
    `INSERT INTO brands (name, slug, status, is_authorized)
     VALUES (?, ?, 'active', 1)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [brandName, slugify(brandName)]
  );
  return { brandId: result.insertId, brandName };
}

async function processInventoryRow(row, updateControls = {}) {
  await ensureInventoryRelationshipTables();
  const asin = getInventoryValue(row, ["ASIN"]);
  const rowSku = getInventoryValue(row, ["SKU"]);
  const sku = rowSku || asin;
  const existing = await findProductByMasterKey({ asin, sku });
  const categoryId = await getCategoryIdForInventoryRow(row, updateControls.autoCreateMissingCategoryBrand);
  const effectiveCategoryId = categoryId || existing?.categoryId || null;
  const brandInfo = await getOrCreateBrandForInventoryRow(row, updateControls.autoCreateMissingCategoryBrand);
  const productName = getInventoryValue(row, ["Product Name"]);
  const sellingPrice = getInventoryValue(row, ["Selling Price"]);
  const mrp = getInventoryValue(row, ["MRP"]);
  const stockQuantity = getInventoryValue(row, ["Stock Quantity"]);
  const status = getInventoryValue(row, ["Product Status", "Status"]);
  const stockStatus = getInventoryValue(row, ["Stock Status"]);
  const statusFromStock = getProductStatusFromStockStatus(stockStatus);
  const imageUrl = getInventoryValue(row, ["Primary Image URL"]);
  const nextSlug = getInventoryValue(row, ["Product Slug"]) || productName || asin;

  if (existing && updateControls.importType === "create-only") return "skipped";
  if (!existing && updateControls.importType === "update-only") return "skipped";

  if (existing) {
    const assignments = [
      "is_deleted = 0",
      "is_visible = 1",
      "deleted_at = NULL"
    ];
    const values = [];
    const normalizedAsin = String(existing.asin || "").toLowerCase();
    const normalizedSku = String(existing.sku || "").toLowerCase();

    if (asin && normalizedAsin !== asin.toLowerCase()) {
      assignments.push("asin = ?");
      values.push(asin);
    }
    if (rowSku && normalizedSku !== rowSku.toLowerCase()) {
      assignments.push("sku = ?");
      values.push(rowSku);
    }

    if (updateControls.basicInfo) {
      if (categoryId) {
        assignments.push("category_id = ?");
        values.push(categoryId);
      }
      if (brandInfo.brandId) {
        assignments.push("brand_id = ?");
        values.push(brandInfo.brandId);
      }
      ["name", "slug", "brand"].forEach((field) => {
        const value = field === "name" ? productName : field === "slug" ? slugify(nextSlug) : brandInfo.brandName;
        if (value) {
          assignments.push(`${field} = ?`);
          values.push(value);
        }
      });
      if (status && !statusFromStock) {
        assignments.push("status = ?");
        values.push(normalizeInventoryDbStatus(status));
      }
    }

    if (existing.isDeleted) {
      assignments.push("status = 'active'");
    }

    if (updateControls.stock && statusFromStock) {
      assignments.push("status = ?");
      values.push(statusFromStock);
    }

    if (updateControls.pricing) {
      if (sellingPrice !== "") {
        assignments.push("price = ?");
        values.push(parseInventoryNumber(sellingPrice));
      }
      if (mrp !== "") {
        assignments.push("mrp = ?");
        values.push(parseInventoryNumber(mrp));
      }
      assignments.push("tax_included = ?");
      values.push(normalizeBooleanCell(getInventoryValue(row, ["Tax Included"])));
      const taxRate = getInventoryValue(row, ["Tax Percentage"]);
      if (taxRate !== "") {
        assignments.push("tax_rate = ?");
        values.push(parseInventoryNumber(taxRate));
      }
    }

    if (updateControls.stock && (stockQuantity !== "" || stockStatus)) {
      assignments.push("stock_quantity = ?");
      values.push(stockStatus ? getStockQuantityFromStockStatus(stockQuantity, stockStatus) : parseInventoryNumber(stockQuantity));
    }

    if (updateControls.description) {
      const shortDescription = getInventoryValue(row, ["Short Description"]);
      const description = getInventoryValue(row, ["Description"]);
      if (shortDescription) {
        assignments.push("short_description = ?");
        values.push(shortDescription);
      }
      if (description) {
        assignments.push("description = ?");
        values.push(description);
      }
    }

    if (updateControls.media && imageUrl) {
      assignments.push("image_url = ?");
      values.push(imageUrl);
    }

    if (assignments.length) {
      values.push(existing.id);
      await query(`UPDATE products SET ${assignments.join(", ")} WHERE id = ?`, values);
    }
    const productId = existing.id;
    await syncProductCategoryRelations(productId, effectiveCategoryId);
    if (updateControls.media) await replaceProductMedia(productId, row, productName || existing.name || asin);
    if (updateControls.description) await replaceProductHighlights(productId, row);
    if (updateControls.specifications) await replaceProductSpecifications(productId, row);
    if (updateControls.policies) await replaceProductPolicies(productId, row);
    if (updateControls.faqs) await replaceProductFaqs(productId, row);
    if (updateControls.variantGroups) await upsertProductVariantGroup(productId, row);
    await replaceProductRelatedProducts(productId, row, effectiveCategoryId);
    return "updated";
  }

  const result = await query(
    `INSERT INTO products
      (category_id, brand_id, asin, sku, name, slug, brand, short_description, description, price, mrp, tax_included, tax_rate, stock_quantity, image_url, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      categoryId,
      brandInfo.brandId,
      asin,
      sku,
      productName || asin,
      slugify(nextSlug),
      brandInfo.brandName || "Unknown",
      getInventoryValue(row, ["Short Description"]),
      getInventoryValue(row, ["Description"]),
      parseInventoryNumber(sellingPrice, 0),
      parseInventoryNumber(mrp, parseInventoryNumber(sellingPrice, 0)),
      normalizeBooleanCell(getInventoryValue(row, ["Tax Included"])),
      parseInventoryNumber(getInventoryValue(row, ["Tax Percentage"]), 0),
      stockStatus ? getStockQuantityFromStockStatus(stockQuantity, stockStatus) : parseInventoryNumber(stockQuantity, 0),
      imageUrl,
      statusFromStock || normalizeInventoryDbStatus(status || "draft")
    ]
  );
  const productId = result.insertId;
  await syncProductCategoryRelations(productId, effectiveCategoryId);
  await replaceProductMedia(productId, row, productName || asin);
  await replaceProductHighlights(productId, row);
  await replaceProductSpecifications(productId, row);
  await replaceProductPolicies(productId, row);
  await replaceProductFaqs(productId, row);
  await upsertProductVariantGroup(productId, row);
  await replaceProductRelatedProducts(productId, row, effectiveCategoryId);
  return "created";
}

function getJobProgress(job) {
  const percentage = job.totalRows ? Math.round((job.processedRows / job.totalRows) * 100) : 0;
  return {
    jobId: job.id,
    status: job.status,
    totalRows: job.totalRows,
    processedRows: job.processedRows,
    successRows: job.successRows,
    failedRows: job.failedRows,
    currentBatch: job.currentBatch,
    batchSize: job.batchSize,
    percentageCompleted: percentage,
    validation: job.validation,
    report: job.report,
    error: job.error || ""
  };
}

async function saveInventoryFailedRows(importId, failedRows = []) {
  if (!failedRows.length) return;

  for (const item of failedRows) {
    await query(
      `INSERT INTO inventory_import_failed_rows
        (import_id, \`row_number\`, asin, sku, error_reason, original_row_data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        importId,
        Number(item.rowNumber || 0),
        item.asin || null,
        item.sku || null,
        [
          `Reason: ${(item.errors || []).join("; ") || "Import failed"}`,
          `How to fix: ${(item.fixes || []).join("; ") || getInventoryFixGuidance((item.errors || [])[0])}`
        ].join(" | "),
        JSON.stringify(item.row || {})
      ]
    );
  }
}

async function persistInventoryJobProgress(job) {
  await ensureInventoryImportTables();
  await query(
    `UPDATE inventory_import_jobs
     SET processed_rows = ?,
         success_rows = ?,
         failed_rows = ?,
         current_batch = ?,
         status = ?,
         report_data = ?,
         completed_at = CASE WHEN ? IN ('completed', 'failed', 'cancelled') THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE completed_at END
     WHERE id = ?`,
    [
      job.processedRows,
      job.successRows,
      job.failedRows,
      job.currentBatch,
      job.status,
      JSON.stringify(job.report || {}),
      job.status,
      job.id
    ]
  );
}

async function restoreInventoryImportJob(jobId) {
  const cachedJob = inventoryImportJobs.get(jobId);
  if (cachedJob) return cachedJob;

  await ensureInventoryImportTables();
  const rows = await query("SELECT * FROM inventory_import_jobs WHERE id = ? LIMIT 1", [jobId]);
  if (!rows.length) return null;

  const row = rows[0];
  const report = parseJsonValue(row.report_data, {});
  const config = report.config || {};
  const templateType = String(row.template_type || "full-product");
  const importType = String(row.import_type || "create-update");
  const autoCreateMissingCategoryBrand = normalizeBooleanFlag(config.autoCreateMissingCategoryBrand);
  const updateControls = parseInventoryUpdateControls(config.updateControls, templateType);

  try {
    await fs.access(row.stored_file_path);
  } catch {
    throw new ApiError(410, "The uploaded inventory file is no longer available. Please upload it again.");
  }

  const workbookRows = await readInventoryWorkbook(row.stored_file_path, row.file_name);
  const validation = await runInventoryValidation({
    rows: workbookRows,
    templateType,
    importType,
    autoCreateMissingCategoryBrand
  });
  const job = {
    id: row.id,
    status: row.status,
    filePath: row.stored_file_path,
    originalFileName: row.file_name,
    templateType,
    importType,
    autoCreateMissingCategoryBrand,
    updateControls,
    validation,
    validRows: validation.validRowDetails || [],
    totalRows: Number(row.total_rows || validation.validRows || 0),
    processedRows: Number(row.processed_rows || 0),
    successRows: Number(row.success_rows || 0),
    failedRows: Number(row.failed_rows || 0),
    currentBatch: Number(row.current_batch || 0),
    batchSize: inventoryImportBatchSize,
    cancelRequested: false,
    createdAt: row.created_at,
    report: {
      createdAt: report.createdAt || row.created_at,
      finishedAt: report.finishedAt || null,
      createdRows: Number(report.createdRows || 0),
      updatedRows: Number(report.updatedRows || 0),
      skippedRows: Number(report.skippedRows || 0),
      failedRows: Array.isArray(report.failedRows) ? report.failedRows : [],
      config: {
        autoCreateMissingCategoryBrand,
        updateControls
      }
    },
    error: report.error || ""
  };

  inventoryImportJobs.set(jobId, job);
  return job;
}

function processInventoryJob(jobId) {
  const job = inventoryImportJobs.get(jobId);
  if (!job || !["queued", "processing"].includes(job.status)) return;
  if (job.cancelRequested) {
    job.status = "cancelled";
    job.report.finishedAt = new Date().toISOString();
    persistInventoryJobProgress(job).catch(() => {});
    return;
  }

  job.status = "processing";
  const start = job.processedRows;
  const batch = job.validRows.slice(start, start + job.batchSize);
  job.currentBatch = Math.floor(start / job.batchSize) + 1;

  Promise.all(batch.map(async (item) => {
    try {
      const action = await processInventoryRow(item.row, {
        ...job.updateControls,
        importType: job.importType,
        autoCreateMissingCategoryBrand: job.autoCreateMissingCategoryBrand
      });
      if (action === "skipped") {
        job.report.skippedRows += 1;
      } else {
        job.successRows += 1;
        job.report[action === "created" ? "createdRows" : "updatedRows"] += 1;
      }
    } catch (error) {
      job.failedRows += 1;
      const failedRow = {
        rowNumber: item.rowNumber,
        asin: item.asin,
        sku: item.sku,
        errors: [error.message || "Import failed"],
        fixes: [getInventoryFixGuidance(error.message)],
        row: item.row
      };
      job.report.failedRows.push(failedRow);
      await saveInventoryFailedRows(job.id, [failedRow]);
    } finally {
      job.processedRows += 1;
    }
  })).then(() => {
    if (job.processedRows >= job.totalRows) {
      job.status = job.failedRows ? "failed" : "completed";
      job.report.finishedAt = new Date().toISOString();
      persistInventoryJobProgress(job).catch(() => {});
      return;
    }
    persistInventoryJobProgress(job).catch(() => {});
    setTimeout(() => processInventoryJob(jobId), 20);
  }).catch((error) => {
    job.status = "failed";
    job.error = error.message || "Import job failed";
    job.report.finishedAt = new Date().toISOString();
    persistInventoryJobProgress(job).catch(() => {});
  });
}

function appendInventoryExportFilters(filters, values, request) {
  const source = request.query || request.body || {};
  const exportType = String(source.exportType || "all").trim();
  const categorySlug = String(source.category || source.categorySlug || "").trim();
  const subcategorySlug = String(source.subcategory || source.subcategorySlug || "").trim();
  const brand = String(source.brand || "").trim();
  const status = String(source.status || "").trim();
  const stockStatus = String(source.stockStatus || "").trim();
  const startDate = parseExportDate(source.startDate);
  const endDate = parseExportDate(source.endDate);

  if (subcategorySlug) {
    filters.push("c.slug = ?");
    values.push(subcategorySlug);
  } else if (categorySlug) {
    filters.push("(c.slug = ? OR parent.slug = ?)");
    values.push(categorySlug, categorySlug);
  }

  if (brand) {
    filters.push("p.brand = ?");
    values.push(brand);
  }

  if (exportType === "active") {
    filters.push("p.status = 'active'");
  } else if (exportType === "inactive") {
    filters.push("(p.status = 'archived' OR p.is_visible = 0)");
  } else if (exportType === "draft") {
    filters.push("p.status = 'draft'");
  } else if (status) {
    filters.push("p.status = ?");
    values.push(status);
  }

  if (stockStatus === "in-stock") {
    filters.push("p.stock_quantity > p.low_stock_threshold");
  }

  if (stockStatus === "low-stock" || exportType === "low-stock") {
    filters.push("p.stock_quantity > 0 AND p.stock_quantity <= p.low_stock_threshold");
  }

  if (stockStatus === "out-of-stock") {
    filters.push("(p.stock_quantity <= 0 OR p.status = 'out_of_stock')");
  }

  if (startDate) {
    filters.push("p.created_at >= ?");
    values.push(startDate);
  }

  if (endDate) {
    filters.push("p.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    values.push(endDate);
  }
}

const inventoryExportColumns = [
  "Product Name",
  "ASIN",
  "SKU",
  "Product Slug",
  "Product Type",
  "Product Status",
  "Brand",
  "Category",
  "Subcategory",
  "Collection",
  "Featured Product",
  "Selling Price",
  "MRP",
  "Tax Included",
  "Tax Percentage",
  "Stock Quantity",
  "Low Stock Threshold",
  "Stock Status",
  "Availability Message",
  "Delivery Estimate",
  "Dispatch Time",
  "Short Description",
  "Description",
  "Highlight 1",
  "Highlight 2",
  "Highlight 3",
  "Highlight 4",
  "Highlight 5",
  "Primary Image URL",
  "Gallery Image URL 1",
  "Gallery Image URL 2",
  "Gallery Image URL 3",
  "Gallery Image URL 4",
  "Gallery Image URL 5",
  "Video URL 1",
  "Video URL 2",
  "Spec Group 1",
  "Spec Label 1",
  "Spec Value 1",
  "Spec Group 2",
  "Spec Label 2",
  "Spec Value 2",
  "Spec Group 3",
  "Spec Label 3",
  "Spec Value 3",
  "Shipping Information",
  "Return & Refund",
  "Warranty Support",
  "COD Information",
  "FAQ Question 1",
  "FAQ Answer 1",
  "FAQ Question 2",
  "FAQ Answer 2",
  "FAQ Question 3",
  "FAQ Answer 3",
  "Related Products Mode",
  "Auto Related By Category",
  "Manual Related ASIN",
  "Manual Related SKU",
  "Variant Group Name",
  "Variant Type",
  "Variant Value",
  "Meta Title",
  "Canonical URL",
  "Meta Description",
  "Meta Keywords",
  "OG Image URL",
  "Created At",
  "Updated At"
];

function formatExportFileDate() {
  return new Date().toISOString().slice(0, 10);
}

function getInventoryExportFileName(exportType = "complete") {
  return `avyona-${exportType || "complete"}-inventory-${formatExportFileDate()}.xlsx`;
}

function mapInventoryExportRows(rows = []) {
  return rows.map((product) => [
    product.name || "",
    product.asin || "",
    product.sku || "",
    product.slug || "",
    "simple",
    product.status || "",
    product.brand || "",
    product.categoryName || product.categorySlug || "",
    product.subcategoryName || product.subcategorySlug || "",
    product.categoryName || product.categorySlug || "",
    product.featuredProduct ? "Yes" : "No",
    product.price ?? "",
    product.mrp ?? "",
    Number(product.taxIncluded || 0) ? "Yes" : "No",
    product.taxRate ?? "",
    product.stockQuantity ?? "",
    product.lowStockThreshold ?? "",
    product.stockStatus || "",
    product.availabilityMessage || "",
    product.deliveryEstimate || "",
    product.dispatchTime || "",
    product.shortDescription || "",
    product.description || "",
    product.highlight1 || "",
    product.highlight2 || "",
    product.highlight3 || "",
    product.highlight4 || "",
    product.highlight5 || "",
    product.imageUrl || "",
    product.galleryImage1 || "",
    product.galleryImage2 || "",
    product.galleryImage3 || "",
    product.galleryImage4 || "",
    product.galleryImage5 || "",
    product.videoUrl1 || "",
    product.videoUrl2 || "",
    product.specGroup1 || "",
    product.specLabel1 || "",
    product.specValue1 || "",
    product.specGroup2 || "",
    product.specLabel2 || "",
    product.specValue2 || "",
    product.specGroup3 || "",
    product.specLabel3 || "",
    product.specValue3 || "",
    product.shippingInformation || "",
    product.returnRefund || "",
    product.warrantySupport || "",
    product.codInformation || "",
    product.faqQuestion1 || "",
    product.faqAnswer1 || "",
    product.faqQuestion2 || "",
    product.faqAnswer2 || "",
    product.faqQuestion3 || "",
    product.faqAnswer3 || "",
    product.relatedProductsMode || "",
    product.autoRelatedByCategory || "",
    product.manualRelatedAsin || "",
    product.manualRelatedSku || "",
    product.variantGroupName || "",
    product.variantType || "",
    product.variantValue || "",
    product.metaTitle || "",
    product.canonicalUrl || "",
    product.metaDescription || "",
    product.metaKeywords || "",
    product.ogImageUrl || "",
    product.createdAt || "",
    product.updatedAt || ""
  ]);
}

function buildInventoryExportQuery(filters, values, limit = null, offset = null) {
  const whereClause = `WHERE ${filters.join(" AND ")}`;
  const pagingClause = Number.isInteger(limit) && Number.isInteger(offset) ? "LIMIT ? OFFSET ?" : "";
  return {
    sql: `SELECT
      p.id,
      p.asin,
      p.sku,
      p.name,
      p.slug,
      p.brand,
      COALESCE(parent.name, c.name) AS categoryName,
      COALESCE(parent.slug, c.slug) AS categorySlug,
      CASE WHEN parent.id IS NULL THEN '' ELSE c.name END AS subcategoryName,
      CASE WHEN parent.id IS NULL THEN '' ELSE c.slug END AS subcategorySlug,
      p.status,
      p.is_featured AS featuredProduct,
      p.price,
      p.mrp,
      p.tax_included AS taxIncluded,
      p.tax_rate AS taxRate,
      p.stock_quantity AS stockQuantity,
      p.low_stock_threshold AS lowStockThreshold,
      CASE
        WHEN p.stock_quantity <= 0 OR p.status = 'out_of_stock' THEN 'out-of-stock'
        WHEN p.stock_quantity <= p.low_stock_threshold THEN 'low-stock'
        ELSE 'in-stock'
      END AS stockStatus,
      p.short_description AS shortDescription,
      p.description,
      p.image_url AS imageUrl,
      p.created_at AS createdAt,
      p.updated_at AS updatedAt
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN categories parent ON parent.id = c.parent_id
     ${whereClause}
     ORDER BY p.name ASC, p.asin ASC
     ${pagingClause}`,
    values: Number.isInteger(limit) && Number.isInteger(offset) ? [...values, limit, offset] : values
  };
}

function getInventoryExportJobProgress(job) {
  const percentageCompleted = job.totalRows ? Math.round((Number(job.processedRows || 0) / Number(job.totalRows || 1)) * 100) : 0;
  return {
    jobId: job.id,
    status: job.status,
    exportType: job.exportType,
    fileName: job.fileName,
    totalRows: job.totalRows,
    processedRows: job.processedRows,
    percentageCompleted,
    message: job.message || "",
    createdAt: job.createdAt,
    completedAt: job.completedAt || null,
    ready: job.status === "completed"
  };
}

async function persistInventoryExportJob(job) {
  await ensureInventoryImportTables();
  await query(
    `UPDATE inventory_export_jobs
     SET stored_file_path = ?,
         total_rows = ?,
         processed_rows = ?,
         status = ?,
         message = ?,
         completed_at = CASE WHEN ? IN ('completed', 'failed') THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE completed_at END
     WHERE id = ?`,
    [
      job.filePath || null,
      job.totalRows || 0,
      job.processedRows || 0,
      job.status,
      job.message || null,
      job.status,
      job.id
    ]
  );
}

async function processInventoryExportJob(jobId) {
  const job = inventoryExportJobs.get(jobId);
  if (!job || !["queued", "processing"].includes(job.status)) return;

  try {
    job.status = "processing";
    job.message = "Export file is being generated in the background.";
    await persistInventoryExportJob(job);

    const filters = ["p.is_deleted = 0"];
    const values = [];
    appendInventoryExportFilters(filters, values, { query: job.filters });
    const countRows = await query(
      `SELECT COUNT(*) AS total
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN categories parent ON parent.id = c.parent_id
       WHERE ${filters.join(" AND ")}`,
      values
    );
    job.totalRows = Number(countRows[0]?.total || 0);

    const exportDir = path.resolve(process.cwd(), "uploads", "inventory-exports");
    await fs.mkdir(exportDir, { recursive: true });
    job.filePath = path.join(exportDir, `${job.id}.xlsx`);

    const workbook = XLSX.utils.book_new();
    const sheetRows = [inventoryExportColumns];
    const batchSize = 5000;
    let offset = 0;

    while (offset < job.totalRows || (job.totalRows === 0 && offset === 0)) {
      const exportQuery = buildInventoryExportQuery(filters, values, batchSize, offset);
      const rows = await query(exportQuery.sql, exportQuery.values);
      sheetRows.push(...mapInventoryExportRows(rows));
      job.processedRows += rows.length;
      await persistInventoryExportJob(job);
      if (!rows.length || rows.length < batchSize) break;
      offset += batchSize;
    }

    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
    worksheet["!cols"] = inventoryExportColumns.map((column) => ({ wch: Math.max(14, column.length + 2) }));
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory Export");
    XLSX.writeFile(workbook, job.filePath, { bookType: "xlsx" });

    job.status = "completed";
    job.completedAt = new Date().toISOString();
    job.message = "Export ready. Download the Excel file from this dashboard.";
    await persistInventoryExportJob(job);
  } catch (error) {
    job.status = "failed";
    job.completedAt = new Date().toISOString();
    job.message = error.message || "Inventory export failed.";
    await persistInventoryExportJob(job).catch(() => {});
  }
}

export async function listProducts(request, response) {
  await ensureProductSortOrderColumn();
  const filters = ["p.is_deleted = 0"];
  const values = [];
  const { page, limit, offset } = getPagination(request);
  const categoryIds = getQueryList(request.query, "categoryId").map(Number).filter(Number.isFinite);
  const categorySlugs = [...new Set([
    ...getQueryList(request.query, "categorySlug"),
    ...getQueryList(request.query, "category")
  ])];
  const brands = getQueryList(request.query, "brand");
  const availability = [...new Set([
    ...getQueryList(request.query, "availability"),
    ...getQueryList(request.query, "stock")
  ])];
  const minRating = getNumericFilter(request.query, ["rating", "minRating"]);

  if (categoryIds.length) {
    appendInFilter(filters, values, "p.category_id", categoryIds);
  }

  if (categorySlugs.length) {
    filters.push(`p.category_id IN (
      SELECT c.id
      FROM categories c
      LEFT JOIN categories parent ON parent.id = c.parent_id
      WHERE c.slug IN (${categorySlugs.map(() => "?").join(", ")})
        OR parent.slug IN (${categorySlugs.map(() => "?").join(", ")})
    )`);
    values.push(...categorySlugs, ...categorySlugs);
  }

  if (request.query.status) {
    filters.push("p.status = ?");
    values.push(String(request.query.status));
  }

  appendInFilter(filters, values, "p.brand", brands);

  if (request.query.minPrice) {
    filters.push("p.price >= ?");
    values.push(Number(request.query.minPrice));
  }

  if (request.query.maxPrice) {
    filters.push("p.price <= ?");
    values.push(Number(request.query.maxPrice));
  }

  if (minRating !== null) {
    filters.push("p.rating >= ?");
    values.push(minRating);
  }

  if (availability.length === 1 && availability[0] === "in-stock") {
    filters.push("p.stock_quantity > 0");
  }

  if (availability.length === 1 && availability[0] === "out-of-stock") {
    filters.push("p.stock_quantity <= 0");
  }

  const hasSearch = appendSearchFilter(filters, values, request.query.search);

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const sortClause = hasSearch && (!request.query.sort || request.query.sort === "relevance" || request.query.sort === "newest" || request.query.sort === "latest")
    ? "searchRank DESC, p.created_at DESC"
    : getSortClause(request.query.sort);
  const searchRankSql = hasSearch ? getSearchRankSql() : "0";
  const searchRankValues = hasSearch ? getSearchRankValues(request.query.search) : [];
  try {
    const countRows = await query(
      `SELECT COUNT(*) AS total
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${whereClause}`,
      values
    );
    const total = Number(countRows[0]?.total || 0);
    const rows = await query(
      `SELECT
      p.id,
      p.category_id AS categoryId,
      p.variant_group_id AS variantGroupDbId,
      vg.group_id AS variantGroupId,
      vg.group_name AS variantGroupName,
      vg.variant_type AS variantType,
      c.name AS categoryName,
      c.slug AS categorySlug,
      p.asin,
      p.sku,
      p.barcode,
      p.model_number AS modelNumber,
      p.name,
      p.slug,
      p.brand,
      p.short_description AS shortDescription,
      p.price,
      p.mrp,
      p.stock_quantity AS stockQuantity,
      p.rating,
      p.review_count AS reviewCount,
      p.image_url AS imageUrl,
      p.sort_order AS sortOrder,
      COALESCE(p.name, p.asin) AS variantValue,
      p.status,
      p.created_at AS createdAt,
      p.updated_at AS updatedAt,
      ${searchRankSql} AS searchRank
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN variant_groups vg ON vg.id = p.variant_group_id
     ${whereClause}
      ORDER BY ${sortClause}
      LIMIT ? OFFSET ?`,
      [...searchRankValues, ...values, limit, offset]
    );

    const productsWithMedia = await attachProductMedia(rows);
    const facetRows = await query(
      `SELECT p.brand, c.name AS categoryName, c.slug AS categorySlug, p.stock_quantity AS stockQuantity, p.price
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${whereClause}
       LIMIT 10000`,
      values
    );

    response.json({
      success: true,
      count: productsWithMedia.length,
      data: productsWithMedia,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: offset + productsWithMedia.length < total,
        hasPreviousPage: page > 1
      },
      facets: {
        brands: getFacetRows(facetRows, "brand"),
        categories: getCategoryFacetRows(facetRows),
        availability: [
          { value: "in-stock", count: facetRows.filter((item) => Number(item.stockQuantity || 0) > 0).length },
          { value: "out-of-stock", count: facetRows.filter((item) => Number(item.stockQuantity || 0) <= 0).length }
        ],
        price: {
          min: facetRows.length ? Math.min(...facetRows.map((item) => Number(item.price || 0))) : 0,
          max: facetRows.length ? Math.max(...facetRows.map((item) => Number(item.price || 0))) : 0
        }
      }
    });
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
    const rows = filterLocalProducts(await readLocalProducts(), request);
    const paginated = paginateLocalProducts(rows, request);
    response.json({
      success: true,
      count: paginated.data.length,
      data: paginated.data,
      pagination: paginated.pagination,
      facets: {
        brands: getFacetRows(rows, "brand"),
        categories: getCategoryFacetRows(rows),
        availability: [
          { value: "in-stock", count: rows.filter((item) => Number(item.stockQuantity || 0) > 0).length },
          { value: "out-of-stock", count: rows.filter((item) => Number(item.stockQuantity || 0) <= 0).length }
        ],
        price: {
          min: rows.length ? Math.min(...rows.map((item) => Number(item.price || 0))) : 0,
          max: rows.length ? Math.max(...rows.map((item) => Number(item.price || 0))) : 0
        }
      },
      source: "local-file"
    });
  }
}

export async function exportInventoryProducts(request, response) {
  const filters = ["p.is_deleted = 0"];
  const values = [];
  appendInventoryExportFilters(filters, values, request);
  const exportQuery = buildInventoryExportQuery(filters, values, 50000, 0);
  const rows = await query(exportQuery.sql, exportQuery.values);

  response.json({
    success: true,
    count: rows.length,
    data: rows
  });
}

export async function createInventoryExportJob(request, response) {
  await ensureInventoryImportTables();
  const filters = request.body || {};
  const exportType = String(filters.exportType || "complete").trim();
  const jobId = `exp-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const job = {
    id: jobId,
    status: "queued",
    exportType,
    filters,
    fileName: getInventoryExportFileName(exportType),
    filePath: "",
    totalRows: 0,
    processedRows: 0,
    message: "Export queued. You can keep using the dashboard.",
    createdAt: new Date().toISOString(),
    completedAt: null
  };

  inventoryExportJobs.set(jobId, job);
  await query(
    `INSERT INTO inventory_export_jobs
      (id, file_name, stored_file_path, export_type, requested_by, filters_json, total_rows, processed_rows, status, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      job.id,
      job.fileName,
      null,
      job.exportType,
      request.admin?.email || request.admin?.fullName || "Unknown admin",
      JSON.stringify(job.filters || {}),
      0,
      0,
      job.status,
      job.message
    ]
  );

  setTimeout(() => processInventoryExportJob(job.id), 20);

  response.status(202).json({
    success: true,
    data: getInventoryExportJobProgress(job)
  });
}

export async function getInventoryExportJob(request, response) {
  const jobId = String(request.params.jobId || "");
  const liveJob = inventoryExportJobs.get(jobId);
  if (liveJob) {
    response.json({ success: true, data: getInventoryExportJobProgress(liveJob) });
    return;
  }

  await ensureInventoryImportTables();
  const rows = await query(
    `SELECT
      id,
      file_name AS fileName,
      stored_file_path AS filePath,
      export_type AS exportType,
      total_rows AS totalRows,
      processed_rows AS processedRows,
      status,
      message,
      created_at AS createdAt,
      completed_at AS completedAt
     FROM inventory_export_jobs
     WHERE id = ?
     LIMIT 1`,
    [jobId]
  );
  if (!rows.length) throw new ApiError(404, "Export job not found");
  response.json({ success: true, data: getInventoryExportJobProgress(rows[0]) });
}

export async function listInventoryExportJobs(request, response) {
  await ensureInventoryImportTables();
  const rows = await query(
    `SELECT
      id AS jobId,
      file_name AS fileName,
      export_type AS exportType,
      requested_by AS requestedBy,
      total_rows AS totalRows,
      processed_rows AS processedRows,
      status,
      message,
      created_at AS createdAt,
      completed_at AS completedAt
     FROM inventory_export_jobs
     ORDER BY created_at DESC
     LIMIT 50`
  );
  response.json({ success: true, count: rows.length, data: rows });
}

export async function downloadInventoryExportFile(request, response) {
  await ensureInventoryImportTables();
  const rows = await query(
    "SELECT file_name AS fileName, stored_file_path AS filePath, status FROM inventory_export_jobs WHERE id = ? LIMIT 1",
    [String(request.params.jobId || "")]
  );
  if (!rows.length) throw new ApiError(404, "Export job not found");
  if (rows[0].status !== "completed" || !rows[0].filePath) throw new ApiError(409, "Export file is not ready yet");

  response.download(rows[0].filePath, rows[0].fileName);
}

async function runInventoryValidation({ rows = [], templateType = "full-product", importType = "create-update", autoCreateMissingCategoryBrand = false }) {
  const requiredColumns = getRequiredInventoryColumns(templateType);
  const validRows = [];
  const failedRows = [];
  const duplicateAsins = [];
  const duplicateSkus = [];
  const asinCounts = new Map();
  const skuCounts = new Map();
  const productKeys = [];
  const categoryNames = new Set();
  const brandNames = new Set();
  const relatedKeys = new Set();

  rows.forEach((row) => {
    const asin = getInventoryValue(row, ["ASIN"]);
    const sku = getInventoryValue(row, ["SKU"]) || asin;
    if (asin) asinCounts.set(asin.toLowerCase(), (asinCounts.get(asin.toLowerCase()) || 0) + 1);
    if (sku) skuCounts.set(sku.toLowerCase(), (skuCounts.get(sku.toLowerCase()) || 0) + 1);
  });

  asinCounts.forEach((count, asin) => {
    if (count > 1) duplicateAsins.push(asin);
  });
  skuCounts.forEach((count, sku) => {
    if (count > 1) duplicateSkus.push(sku);
  });

  rows.forEach((row) => {
    const asin = getInventoryValue(row, ["ASIN"]);
    const sku = getInventoryValue(row, ["SKU"]) || asin;
    if (asin || sku) productKeys.push({ asin, sku });
    const category = getInventoryValue(row, ["Category"]);
    const subcategory = getInventoryValue(row, ["Subcategory"]);
    const brand = getInventoryValue(row, ["Brand"]);
    splitRelatedKeys(getInventoryValue(row, ["Manual Related ASIN", "Manual Related ASIN/SKU"])).forEach((relatedKey) => relatedKeys.add(relatedKey));
    splitRelatedKeys(getInventoryValue(row, ["Manual Related SKU"])).forEach((relatedKey) => relatedKeys.add(relatedKey));
    if (category) categoryNames.add(category);
    if (subcategory) categoryNames.add(subcategory);
    if (brand) brandNames.add(brand);
  });

  const existingProducts = productKeys.length ? await queryProductKeysInChunks(productKeys) : [];
  const existingByAsin = new Map(existingProducts.map((product) => [String(product.asin || "").toLowerCase(), product]));
  const existingBySku = new Map(existingProducts.map((product) => [String(product.sku || "").toLowerCase(), product]));
  const categoryLookupValues = getInventoryLookupValues(categoryNames);
  const brandLookupValues = getInventoryLookupValues(brandNames);

  const categoryRows = categoryLookupValues.length ? await queryScalarValuesInChunks(categoryLookupValues, (chunk) => ({
    sql: `SELECT id, name, slug FROM categories
      WHERE LOWER(name) IN (${chunk.map(() => "LOWER(?)").join(",")})
         OR LOWER(slug) IN (${chunk.map(() => "LOWER(?)").join(",")})`,
    params: [...chunk, ...chunk]
  })) : [];
  const brandRows = brandLookupValues.length ? await queryScalarValuesInChunks(brandLookupValues, (chunk) => ({
    sql: `SELECT name AS brand FROM brands
      WHERE LOWER(name) IN (${chunk.map(() => "LOWER(?)").join(",")})
      UNION
      SELECT DISTINCT brand FROM products
      WHERE LOWER(brand) IN (${chunk.map(() => "LOWER(?)").join(",")})`,
    params: [...chunk, ...chunk]
  })) : [];
  const relatedRows = relatedKeys.size ? await queryScalarValuesInChunks([...relatedKeys], (chunk) => ({
    sql: `SELECT asin, sku FROM products
      WHERE is_deleted = 0
        AND (LOWER(asin) IN (${chunk.map(() => "LOWER(?)").join(",")})
         OR LOWER(sku) IN (${chunk.map(() => "LOWER(?)").join(",")}))`,
    params: [...chunk, ...chunk]
  })) : [];
  const categoryKeys = new Set(categoryRows.flatMap((category) => [category.name, category.slug].map(normalizeInventoryLookupKey)));
  const brandKeys = new Set(brandRows.map((brand) => normalizeInventoryLookupKey(brand.brand)));
  const existingRelatedKeys = new Set(relatedRows.flatMap((product) => [product.asin, product.sku].map((value) => String(value || "").toLowerCase()).filter(Boolean)));
  const slugValues = rows.map((row) => getInventoryValue(row, ["Product Slug"])).filter(Boolean);
  const existingSlugs = slugValues.length ? await queryScalarValuesInChunks(slugValues, (chunk) => ({
    sql: `SELECT id, slug, asin, sku FROM products
      WHERE is_deleted = 0
        AND LOWER(slug) IN (${chunk.map(() => "LOWER(?)").join(",")})`,
    params: chunk
  })) : [];
  const slugOwners = new Map(existingSlugs.map((product) => [String(product.slug || "").toLowerCase(), product]));
  let newProducts = 0;
  let existingProductRows = 0;
  let productsToUpdate = 0;
  let productsToCreate = 0;
  let skippedProducts = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const errors = [];
    const rowKeys = Object.keys(row).map(normalizeInventoryColumnName);
    requiredColumns.forEach((column) => {
      if (!rowKeys.includes(normalizeInventoryColumnName(column))) errors.push(`Missing required column: ${column}`);
    });

    const asin = getInventoryValue(row, ["ASIN"]);
    const sku = getInventoryValue(row, ["SKU"]) || asin;
    const matchingByAsin = asin ? existingByAsin.get(asin.toLowerCase()) : null;
    const matchingBySku = sku ? existingBySku.get(sku.toLowerCase()) : null;
    const existingProduct = matchingByAsin || matchingBySku || null;

    if (!asin) errors.push("ASIN is required");
    if (!sku) errors.push("SKU is required");
    if (asin && duplicateAsins.includes(asin.toLowerCase())) errors.push("Duplicate ASIN inside Excel");
    if (sku && duplicateSkus.includes(sku.toLowerCase())) errors.push("Duplicate SKU inside Excel");
    if (matchingByAsin && matchingBySku && Number(matchingByAsin.id) !== Number(matchingBySku.id)) {
      errors.push("ASIN and SKU belong to different products");
    }
    const shouldSkipExistingCreateOnly = importType === "create-only" && existingProduct;
    const shouldSkipMissingUpdateOnly = importType === "update-only" && !existingProduct;
    if (templateType !== "full-product" && !existingProduct && !shouldSkipMissingUpdateOnly) {
      errors.push("Product does not exist for update template");
    }

    const category = getInventoryValue(row, ["Category"]);
    const subcategory = getInventoryValue(row, ["Subcategory"]);
    const brand = getInventoryValue(row, ["Brand"]);
    if (templateType === "full-product" && !existingProduct && !category) errors.push("Category is required for new products");
    if (templateType === "full-product" && !brand) errors.push("Brand is required");
    if (!autoCreateMissingCategoryBrand && templateType === "full-product" && category && !categoryKeys.has(normalizeInventoryLookupKey(category))) errors.push("Category does not exist");
    if (!autoCreateMissingCategoryBrand && templateType === "full-product" && subcategory && !categoryKeys.has(normalizeInventoryLookupKey(subcategory))) errors.push("Subcategory does not exist");
    if (!autoCreateMissingCategoryBrand && templateType === "full-product" && brand && !brandKeys.has(normalizeInventoryLookupKey(brand))) errors.push("Brand does not exist");

    const sellingPrice = getInventoryValue(row, ["Selling Price"]);
    const mrp = getInventoryValue(row, ["MRP"]);
    const stockQuantity = getInventoryValue(row, ["Stock Quantity"]);
    const status = getInventoryValue(row, ["Product Status", "Status"]);
    const stockStatus = getInventoryValue(row, ["Stock Status"]);
    if ((templateType === "full-product" || templateType === "price-update") && !isValidNumberText(sellingPrice)) errors.push("Selling Price format is invalid");
    if ((templateType === "full-product" || templateType === "price-update") && !isValidNumberText(mrp)) errors.push("MRP format is invalid");
    if ((templateType === "full-product" || templateType === "stock-update") && !isValidNumberText(stockQuantity)) errors.push("Stock Quantity must be numeric");
    if (status && !isValidProductStatus(status)) errors.push("Product Status value is invalid");
    if (stockStatus && !isValidStockStatus(stockStatus)) errors.push("Stock Status value is invalid");

    ["Primary Image URL", "Gallery Image URL 1", "Gallery Image URL 2", "Gallery Image URL 3", "Gallery Image URL 4", "Gallery Image URL 5", "Video URL 1", "Video URL 2", "OG Image URL"].forEach((column) => {
      const url = getInventoryValue(row, [column]);
      if (!isValidUrlText(url)) errors.push(`${column} is not a valid URL`);
    });

    const slug = getInventoryValue(row, ["Product Slug"]);
    const slugOwner = slug ? slugOwners.get(slug.toLowerCase()) : null;
    if (slug && slugOwner && (!existingProduct || Number(slugOwner.id) !== Number(existingProduct.id))) {
      errors.push("Product Slug is already used by another product");
    }

    [
      ...splitRelatedKeys(getInventoryValue(row, ["Manual Related ASIN", "Manual Related ASIN/SKU"])),
      ...splitRelatedKeys(getInventoryValue(row, ["Manual Related SKU"]))
    ].forEach((relatedKey) => {
      if (!existingRelatedKeys.has(relatedKey.toLowerCase())) errors.push(`Related product ASIN/SKU does not exist: ${relatedKey}`);
    });

    const rowStatus = shouldSkipExistingCreateOnly || shouldSkipMissingUpdateOnly ? "skipped" : existingProduct ? "existing" : "new";
    const resultRow = { rowNumber, asin, sku, status: rowStatus, row };
    if (errors.length) {
      failedRows.push({
        ...resultRow,
        errors,
        fixes: [...new Set(errors.map(getInventoryFixGuidance))]
      });
    } else {
      validRows.push(resultRow);
      if (rowStatus === "skipped") skippedProducts += 1;
      else if (existingProduct) {
        existingProductRows += 1;
        productsToUpdate += 1;
      } else {
        newProducts += 1;
        productsToCreate += 1;
      }
    }
  });

  return {
    totalRows: rows.length,
    validRows: validRows.length,
    failedRows: failedRows.length,
    duplicateAsins,
    duplicateSkus,
    newProducts,
    existingProducts: existingProductRows,
    productsToUpdate,
    productsToCreate,
    skippedProducts,
    validRowDetails: validRows,
    failedRowDetails: failedRows
  };
}

export async function validateInventoryImport(request, response) {
  const validation = await runInventoryValidation({
    rows: Array.isArray(request.body?.rows) ? request.body.rows : [],
    templateType: String(request.body?.templateType || "full-product").trim(),
    importType: String(request.body?.importType || "create-update").trim(),
    autoCreateMissingCategoryBrand: normalizeBooleanFlag(request.body?.autoCreateMissingCategoryBrand)
  });

  response.json({
    success: true,
    data: validation
  });
}

export async function createInventoryImportJob(request, response) {
  if (!request.file) {
    throw new ApiError(400, `Inventory file is required. Supported formats: ${SUPPORTED_TABULAR_FORMAT_LABEL}.`);
  }

  await ensureInventoryImportTables();
  const rows = await readInventoryWorkbook(request.file.path, request.file.originalname);
  const templateType = String(request.body?.templateType || "full-product").trim();
  const importType = String(request.body?.importType || "create-update").trim();
  const updateControls = parseInventoryUpdateControls(request.body?.updateControls, templateType);
  const autoCreateMissingCategoryBrand = normalizeBooleanFlag(request.body?.autoCreateMissingCategoryBrand);
  const validation = await runInventoryValidation({
    rows,
    templateType,
    importType,
    autoCreateMissingCategoryBrand
  });
  const jobId = `inv-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const job = {
    id: jobId,
    status: validation.validRows ? "queued" : "failed",
    filePath: request.file.path,
    originalFileName: request.file.originalname,
    templateType,
    importType,
    autoCreateMissingCategoryBrand,
    updateControls,
    validation,
    validRows: validation.validRowDetails || [],
    totalRows: validation.validRows || 0,
    processedRows: 0,
    successRows: 0,
    failedRows: validation.failedRows || 0,
    currentBatch: 0,
    batchSize: inventoryImportBatchSize,
    cancelRequested: false,
    createdAt: new Date().toISOString(),
    report: {
      createdAt: new Date().toISOString(),
      finishedAt: null,
      createdRows: 0,
      updatedRows: 0,
      skippedRows: 0,
      failedRows: validation.failedRowDetails || [],
      config: {
        autoCreateMissingCategoryBrand,
        updateControls
      }
    }
  };
  inventoryImportJobs.set(jobId, job);
  await query(
    `INSERT INTO inventory_import_jobs
      (id, file_name, stored_file_path, template_type, import_type, uploaded_by, total_rows, processed_rows, success_rows, failed_rows, current_batch, status, report_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      job.id,
      job.originalFileName,
      job.filePath,
      job.templateType,
      job.importType,
      request.admin?.email || request.admin?.fullName || "Unknown admin",
      job.totalRows,
      job.processedRows,
      job.successRows,
      job.failedRows,
      job.currentBatch,
      job.status,
      JSON.stringify(job.report)
    ]
  );
  await saveInventoryFailedRows(job.id, validation.failedRowDetails || []);

  response.status(201).json({
    success: true,
    data: getJobProgress(job)
  });
}

export async function startInventoryImportJob(request, response) {
  const job = await restoreInventoryImportJob(String(request.params.jobId || ""));
  if (!job) throw new ApiError(404, "Import job not found");
  if (job.status === "completed") throw new ApiError(409, "Import job is already completed");
  if (job.status === "failed" && job.processedRows >= job.totalRows && job.totalRows > 0) {
    throw new ApiError(409, "Import job already finished with failed rows. Review the failed-row report or retry those rows.");
  }
  if (!["queued", "failed"].includes(job.status)) throw new ApiError(409, "Import job cannot be started in its current state");
  if (!job.validation.validRows) throw new ApiError(400, "Import job has no valid rows to process");

  job.status = "queued";
  job.cancelRequested = false;
  setTimeout(() => processInventoryJob(job.id), 10);

  response.json({
    success: true,
    data: getJobProgress(job)
  });
}

export async function getInventoryImportJob(request, response) {
  const job = inventoryImportJobs.get(String(request.params.jobId || ""));
  if (!job) {
    await ensureInventoryImportTables();
    const rows = await query("SELECT * FROM inventory_import_jobs WHERE id = ? LIMIT 1", [String(request.params.jobId || "")]);
    if (!rows.length) throw new ApiError(404, "Import job not found");
    const row = rows[0];
    response.json({
      success: true,
      data: {
        jobId: row.id,
        status: row.status,
        totalRows: Number(row.total_rows || 0),
        processedRows: Number(row.processed_rows || 0),
        successRows: Number(row.success_rows || 0),
        failedRows: Number(row.failed_rows || 0),
        currentBatch: Number(row.current_batch || 0),
        batchSize: inventoryImportBatchSize,
        percentageCompleted: row.total_rows ? Math.round((Number(row.processed_rows || 0) / Number(row.total_rows || 0)) * 100) : 0,
        report: parseJsonValue(row.report_data, {})
      }
    });
    return;
  }

  response.json({
    success: true,
    data: getJobProgress(job)
  });
}

export async function cancelInventoryImportJob(request, response) {
  const job = await restoreInventoryImportJob(String(request.params.jobId || ""));
  if (!job) throw new ApiError(404, "Import job not found");
  if (["completed", "failed", "cancelled"].includes(job.status)) {
    response.json({ success: true, data: getJobProgress(job) });
    return;
  }

  job.cancelRequested = true;
  job.status = "cancelled";
  job.report.finishedAt = new Date().toISOString();
  await persistInventoryJobProgress(job);
  response.json({
    success: true,
    data: getJobProgress(job)
  });
}

export async function listInventoryImportHistory(_request, response) {
  await ensureInventoryImportTables();
  const rows = await query(
    `SELECT
      id AS importId,
      file_name AS fileName,
      template_type AS templateType,
      import_type AS importType,
      uploaded_by AS uploadedBy,
      total_rows AS totalRows,
      success_rows AS successRows,
      failed_rows AS failedRows,
      status,
      created_at AS createdAt,
      completed_at AS completedAt
     FROM inventory_import_jobs
     ORDER BY created_at DESC
     LIMIT 100`
  );

  response.json({
    success: true,
    data: rows.map((row) => ({
      ...row,
      originalRowData: parseJsonValue(row.originalRowData, {})
    }))
  });
}

export async function listInventoryImportFailedRows(request, response) {
  await ensureInventoryImportTables();
  const importId = String(request.params.jobId || request.query.importId || "").trim();
  const values = [];
  const where = importId ? "WHERE import_id = ?" : "";
  if (importId) values.push(importId);
  const rows = await query(
    `SELECT
      import_id AS importId,
      \`row_number\` AS rowNumber,
      asin,
      sku,
      error_reason AS errorReason,
      original_row_data AS originalRowData,
      created_at AS createdAt
     FROM inventory_import_failed_rows
     ${where}
     ORDER BY created_at DESC, \`row_number\` ASC
     LIMIT 1000`,
    values
  );

  response.json({ success: true, data: rows });
}

export async function downloadInventoryImportOriginal(request, response) {
  await ensureInventoryImportTables();
  const rows = await query("SELECT file_name AS fileName, stored_file_path AS storedFilePath FROM inventory_import_jobs WHERE id = ? LIMIT 1", [String(request.params.jobId || "")]);
  if (!rows.length) throw new ApiError(404, "Import job not found");

  response.download(rows[0].storedFilePath, rows[0].fileName);
}

export async function retryInventoryImportFailedRows(request, response) {
  await ensureInventoryImportTables();
  const sourceJobId = String(request.params.jobId || "").trim();
  const failedRows = await query(
    `SELECT \`row_number\` AS rowNumber, asin, sku, error_reason AS errorReason, original_row_data AS originalRowData
     FROM inventory_import_failed_rows
     WHERE import_id = ?
     ORDER BY \`row_number\` ASC`,
    [sourceJobId]
  );
  if (!failedRows.length) throw new ApiError(404, "No failed rows found for retry");

  const sourceRows = await query("SELECT template_type AS templateType, import_type AS importType, stored_file_path AS storedFilePath, file_name AS fileName FROM inventory_import_jobs WHERE id = ? LIMIT 1", [sourceJobId]);
  if (!sourceRows.length) throw new ApiError(404, "Import job not found");
  const rows = failedRows.map((row) => parseJsonValue(row.originalRowData, {}));
  const validation = await runInventoryValidation({
    rows,
    templateType: sourceRows[0].templateType,
    importType: sourceRows[0].importType,
    autoCreateMissingCategoryBrand: normalizeBooleanFlag(request.body?.autoCreateMissingCategoryBrand)
  });
  const jobId = `inv-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const job = {
    id: jobId,
    status: validation.validRows ? "queued" : "failed",
    filePath: sourceRows[0].storedFilePath,
    originalFileName: `retry-${sourceRows[0].fileName}`,
    templateType: sourceRows[0].templateType,
    importType: sourceRows[0].importType,
    autoCreateMissingCategoryBrand: normalizeBooleanFlag(request.body?.autoCreateMissingCategoryBrand),
    updateControls: parseInventoryUpdateControls(request.body?.updateControls, sourceRows[0].templateType),
    validation,
    validRows: validation.validRowDetails || [],
    totalRows: validation.validRows || 0,
    processedRows: 0,
    successRows: 0,
    failedRows: validation.failedRows || 0,
    currentBatch: 0,
    batchSize: inventoryImportBatchSize,
    cancelRequested: false,
    createdAt: new Date().toISOString(),
    report: {
      createdAt: new Date().toISOString(),
      finishedAt: null,
      createdRows: 0,
      updatedRows: 0,
      skippedRows: 0,
      failedRows: validation.failedRowDetails || [],
      config: {
        autoCreateMissingCategoryBrand: normalizeBooleanFlag(request.body?.autoCreateMissingCategoryBrand),
        updateControls: parseInventoryUpdateControls(request.body?.updateControls, sourceRows[0].templateType)
      }
    }
  };
  inventoryImportJobs.set(jobId, job);
  await query(
    `INSERT INTO inventory_import_jobs
      (id, file_name, stored_file_path, template_type, import_type, uploaded_by, total_rows, processed_rows, success_rows, failed_rows, current_batch, status, report_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [job.id, job.originalFileName, job.filePath, job.templateType, job.importType, request.admin?.email || "Unknown admin", job.totalRows, 0, 0, job.failedRows, 0, job.status, JSON.stringify(job.report)]
  );
  await saveInventoryFailedRows(job.id, validation.failedRowDetails || []);

  response.status(201).json({ success: true, data: getJobProgress(job) });
}

export async function getProductById(request, response) {
  const productIdentifier = String(request.params.id || "").trim();
  const numericProductId = Number(productIdentifier);
  const whereClause = Number.isInteger(numericProductId) && numericProductId > 0
    ? "(p.id = ? OR p.slug = ? OR p.asin = ?)"
    : "(p.slug = ? OR p.asin = ?)";
  const values = Number.isInteger(numericProductId) && numericProductId > 0
    ? [numericProductId, productIdentifier, productIdentifier]
    : [productIdentifier, productIdentifier];
  let rows;
  try {
    rows = await query(
    `SELECT
      p.id,
      p.category_id AS categoryId,
      p.variant_group_id AS variantGroupDbId,
      vg.group_id AS variantGroupId,
      vg.group_name AS variantGroupName,
      vg.variant_type AS variantType,
      c.name AS categoryName,
      c.slug AS categorySlug,
      p.asin,
      p.sku,
      p.barcode,
      p.model_number AS modelNumber,
      p.name,
      p.slug,
      p.brand,
      p.short_description AS shortDescription,
      p.description,
      p.price,
      p.mrp,
      p.stock_quantity AS stockQuantity,
      p.rating,
      p.review_count AS reviewCount,
      p.image_url AS imageUrl,
      COALESCE(p.name, p.asin) AS variantValue,
      p.status,
      p.created_at AS createdAt,
      p.updated_at AS updatedAt
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN variant_groups vg ON vg.id = p.variant_group_id
     WHERE ${whereClause}
       AND p.is_deleted = 0
     LIMIT 1`,
      values
    );
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
    const products = await readLocalProducts();
    const product = products.find((item) => !item.isDeleted && (String(item.id) === String(request.params.id) || item.slug === request.params.id || item.asin === request.params.id));
    if (!product) throw new ApiError(404, "Product not found");
    response.json({ success: true, data: product });
    return;
  }

  if (!rows.length) {
    throw new ApiError(404, "Product not found");
  }

  const productsWithMedia = await attachProductMedia(rows);

  response.json({
    success: true,
    data: productsWithMedia[0]
  });
}

export async function createProduct(request, response) {
  await ensureProductSortOrderColumn();
  const {
    categoryId,
    categorySlug,
    asin,
    sku,
    barcode,
    modelNumber,
    name,
    slug,
    brand,
    shortDescription = "",
    description = "",
    price,
    mrp,
    stockQuantity = 0,
    rating = 0,
    reviewCount = 0,
    imageUrl = "",
    imageUrls = [],
    videoUrls = [],
    highlights = [],
    specGroups = [],
    faqs = [],
    policies = [],
    status = "draft",
    sortOrder = 0
  } = request.body || {};

  if ((!categoryId && !categorySlug) || !asin || !name || !brand || price == null || mrp == null) {
    throw new ApiError(400, "categoryId/categorySlug, asin, name, brand, price, and mrp are required");
  }

  try {
    let resolvedCategoryId = categoryId ? Number(categoryId) : null;
    if (!resolvedCategoryId && categorySlug) {
      const categories = await query("SELECT id FROM categories WHERE slug = ? LIMIT 1", [categorySlug]);
      resolvedCategoryId = categories[0]?.id || null;
    }

    if (!resolvedCategoryId) {
      throw new ApiError(400, "A valid product category is required");
    }

    const productSlug = slug ? slugify(slug) : slugify(name);

    const result = await query(
      `INSERT INTO products
      (category_id, asin, sku, barcode, model_number, name, slug, brand, short_description, description, price, mrp, stock_quantity, rating, review_count, image_url, sort_order, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resolvedCategoryId,
        String(asin).trim(),
        sku ? String(sku).trim() : null,
        barcode ? String(barcode).trim() : null,
        modelNumber ? String(modelNumber).trim() : null,
        name,
        productSlug,
        brand,
        shortDescription,
        description,
        price,
        mrp,
        stockQuantity,
        rating,
        reviewCount,
        imageUrl,
        Number(sortOrder || 0),
        status
      ]
    );

    await replaceProductMediaAssets(result.insertId, normalizeImageUrls(imageUrls, imageUrl), videoUrls, name);
    await replaceProductDetailsFromPayload(result.insertId, { highlights, specGroups, faqs, policies });

    const created = await attachProductMedia(await query("SELECT * FROM products WHERE id = ? LIMIT 1", [result.insertId]));

    response.status(201).json({
      success: true,
      data: created[0]
    });
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
    const products = await readLocalProducts();
    const created = normalizeLocalProduct(request.body || {});
    const nextProducts = [created, ...products.filter((product) => product.slug !== created.slug && product.asin !== created.asin)];
    await writeLocalProducts(nextProducts);
    response.status(201).json({
      success: true,
      data: created,
      source: "local-file"
    });
  }
}

export async function updateProduct(request, response) {
  await ensureProductSortOrderColumn();
  const {
    categoryId,
    categorySlug,
    asin,
    sku,
    barcode,
    modelNumber,
    name,
    brand,
    shortDescription,
    description,
    price,
    mrp,
    stockQuantity,
    rating,
    reviewCount,
    imageUrl,
    imageUrls,
    videoUrls,
    highlights,
    specGroups,
    faqs,
    policies,
    status,
    sortOrder
  } = request.body || {};

  try {
    const existing = await query("SELECT id, name FROM products WHERE id = ? LIMIT 1", [Number(request.params.id)]);
    if (!existing.length) {
      throw new ApiError(404, "Product not found");
    }

    let resolvedCategoryId = categoryId ? Number(categoryId) : null;
    if (!resolvedCategoryId && categorySlug) {
      const categories = await query("SELECT id FROM categories WHERE slug = ? LIMIT 1", [categorySlug]);
      resolvedCategoryId = categories[0]?.id || null;
    }

    const nextName = name || existing[0].name;
    await query(
      `UPDATE products
       SET
        category_id = COALESCE(?, category_id),
        asin = COALESCE(?, asin),
        sku = COALESCE(?, sku),
        barcode = COALESCE(?, barcode),
        model_number = COALESCE(?, model_number),
        name = COALESCE(?, name),
        slug = ?,
        brand = COALESCE(?, brand),
        short_description = COALESCE(?, short_description),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        mrp = COALESCE(?, mrp),
        stock_quantity = COALESCE(?, stock_quantity),
        rating = COALESCE(?, rating),
        review_count = COALESCE(?, review_count),
        image_url = COALESCE(?, image_url),
        sort_order = COALESCE(?, sort_order),
        status = COALESCE(?, status)
       WHERE id = ?`,
      [
        resolvedCategoryId ?? null,
        asin ? String(asin).trim() : null,
        sku ? String(sku).trim() : null,
        barcode ? String(barcode).trim() : null,
        modelNumber ? String(modelNumber).trim() : null,
        name ?? null,
        slugify(nextName),
        brand ?? null,
        shortDescription ?? null,
        description ?? null,
        price ?? null,
        mrp ?? null,
        stockQuantity ?? null,
        rating ?? null,
        reviewCount ?? null,
        imageUrl ?? null,
        sortOrder === undefined || sortOrder === "" ? null : Number(sortOrder),
        status ?? null,
        Number(request.params.id)
      ]
    );

    if ((Array.isArray(imageUrls) && imageUrls.length) || (Array.isArray(videoUrls) && videoUrls.length)) {
      await replaceProductMediaAssets(Number(request.params.id), normalizeImageUrls(imageUrls || [], imageUrl), videoUrls || [], nextName);
    }
    await replaceProductDetailsFromPayload(Number(request.params.id), {
      highlights,
      specGroups,
      faqs,
      policies
    });

    const updated = await attachProductMedia(await query("SELECT * FROM products WHERE id = ? LIMIT 1", [Number(request.params.id)]));

    response.json({
      success: true,
      data: updated[0]
    });
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;

    const products = await readLocalProducts();
    const index = products.findIndex((item) => !item.isDeleted && (String(item.id) === String(request.params.id) || item.slug === request.params.id || item.asin === request.params.id));
    if (index === -1) {
      throw new ApiError(404, "Product not found");
    }

    const current = products[index];
    const nextName = name ?? current.name;
    const updated = {
      ...current,
      categorySlug: categorySlug ?? current.categorySlug,
      categoryId: categoryId ?? current.categoryId,
      asin: asin ? String(asin).trim() : current.asin,
      sku: sku ? String(sku).trim() : current.sku,
      barcode: barcode ? String(barcode).trim() : current.barcode,
      modelNumber: modelNumber ? String(modelNumber).trim() : current.modelNumber,
      name: nextName,
      slug: slug ? slugify(slug) : slugify(nextName),
      brand: brand ?? current.brand,
      shortDescription: shortDescription ?? current.shortDescription,
      description: description ?? current.description,
      price: price ?? current.price,
      mrp: mrp ?? current.mrp,
      stockQuantity: stockQuantity ?? current.stockQuantity,
      rating: rating ?? current.rating,
      reviewCount: reviewCount ?? current.reviewCount,
      imageUrl: imageUrl ?? current.imageUrl,
      highlights: Array.isArray(highlights) ? highlights : current.highlights,
      specs: Array.isArray(specGroups) ? specGroups : current.specs,
      faqs: Array.isArray(faqs) ? faqs : current.faqs,
      policies: Array.isArray(policies) ? policies : current.policies,
      sortOrder: sortOrder ?? current.sortOrder,
      status: status ?? current.status,
      updatedAt: new Date().toISOString()
    };

    const nextProducts = [...products];
    nextProducts[index] = updated;
    await writeLocalProducts(nextProducts);

    response.json({
      success: true,
      data: updated,
      source: "local-file"
    });
  }
}

export async function upsertProductByAsinSku(request, response) {
  const masterKey = getProductMasterKey(request.body || {});

  if (!masterKey.asin || !masterKey.sku) {
    throw new ApiError(400, "Both ASIN and SKU are required as separate product master keys");
  }

  request.body = {
    ...(request.body || {}),
    asin: masterKey.asin,
    sku: masterKey.sku
  };

  try {
    const existingProduct = await findProductByMasterKey(masterKey);

    if (existingProduct) {
      if (existingProduct.isDeleted) {
        await query(
          `UPDATE products
           SET is_deleted = 0,
               is_visible = 1,
               deleted_at = NULL,
               status = 'active'
           WHERE id = ?`,
          [existingProduct.id]
        );
      }
      request.params = {
        ...(request.params || {}),
        id: existingProduct.id
      };
      await updateProduct(request, response);
      return;
    }

    await createProduct(request, response);
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;

    const products = await readLocalProducts();
    const existingIndex = products.findIndex((product) => {
      const productAsin = String(product.asin || "").toLowerCase();
      const productSku = String(product.sku || "").toLowerCase();
      const asin = String(masterKey.asin || "").toLowerCase();
      const sku = String(masterKey.sku || "").toLowerCase();
      return productAsin === asin || productSku === sku;
    });

    if (existingIndex >= 0) {
      const current = products[existingIndex];
      const asinMatches = String(current.asin || "").toLowerCase() === String(masterKey.asin || "").toLowerCase();
      const skuMatches = String(current.sku || "").toLowerCase() === String(masterKey.sku || "").toLowerCase();
      const conflictingProduct = products.find((product, index) => {
        if (index === existingIndex) return false;
        if (product.isDeleted) return false;
        return String(product.asin || "").toLowerCase() === String(masterKey.asin || "").toLowerCase()
          || String(product.sku || "").toLowerCase() === String(masterKey.sku || "").toLowerCase();
      });

      if (!asinMatches && !skuMatches) {
        throw new ApiError(409, "ASIN and SKU belong to different products. Fix the import row before updating inventory.");
      }

      if (conflictingProduct) {
        throw new ApiError(409, "ASIN and SKU belong to different products. Fix the import row before updating inventory.");
      }

      const nextName = request.body.name ?? current.name;
      const updated = {
        ...current,
        ...request.body,
        asin: masterKey.asin,
        sku: masterKey.sku,
        slug: request.body.slug ? slugify(request.body.slug) : current.slug || slugify(nextName),
        isDeleted: false,
        isVisible: true,
        deletedAt: null,
        status: current.isDeleted ? "active" : request.body.status ?? current.status,
        updatedAt: new Date().toISOString()
      };
      const nextProducts = [...products];
      nextProducts[existingIndex] = updated;
      await writeLocalProducts(nextProducts);
      response.json({
        success: true,
        action: "updated",
        masterKey: masterKey.key,
        data: updated,
        source: "local-file"
      });
      return;
    }

    const created = normalizeLocalProduct(request.body || {});
    await writeLocalProducts([created, ...products]);
    response.status(201).json({
      success: true,
      action: "created",
      masterKey: masterKey.key,
      data: created,
      source: "local-file"
    });
  }
}

export async function deleteProduct(request, response) {
  try {
    const result = await query(
      "UPDATE products SET is_deleted = 1, is_visible = 0, status = 'archived', deleted_at = NOW() WHERE id = ? AND is_deleted = 0",
      [Number(request.params.id)]
    );

    if (!result.affectedRows) {
      throw new ApiError(404, "Product not found");
    }

    response.json({
      success: true,
      message: "Product deleted successfully"
    });
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;

    const products = await readLocalProducts();
    const targetIndex = products.findIndex((item) => !item.isDeleted && (String(item.id) === String(request.params.id) || item.slug === request.params.id || item.asin === request.params.id));
    if (targetIndex === -1 || products[targetIndex]?.isDeleted) {
      throw new ApiError(404, "Product not found");
    }

    const nextProducts = [...products];
    nextProducts[targetIndex] = {
      ...nextProducts[targetIndex],
      isDeleted: true,
      isVisible: false,
      status: "archived",
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await writeLocalProducts(nextProducts);

    response.json({
      success: true,
      message: "Product deleted successfully",
      source: "local-file"
    });
  }
}
