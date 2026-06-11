import fs from "fs/promises";
import path from "path";
import { query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";

const localCategoriesPath = path.resolve(process.cwd(), "data", "local-categories.json");
const SYSTEM_FALLBACK_CATEGORY_SLUGS = new Set([
  "uncategorized",
  "uncategorized-products",
  "archived-category-products"
]);

const DEFAULT_LOCAL_CATEGORIES = [
  {
    id: 1,
    name: "Personal Audio",
    slug: "personal-audio",
    parentId: null,
    parentCategory: null,
    categoryType: "main_category",
    description: "Headphones, earbuds, and neckbands for daily listening.",
    imageUrl: "/uploads/1778905681611-1.jpg",
    bannerImageUrl: "/uploads/1778905676761-2.jpg",
    iconUrl: null,
    status: "active",
    showInMenu: true,
    featuredCategory: true,
    categoryDiscountLabel: "",
    dynamicRuleJson: null,
    sortOrder: 1,
    metaTitle: "Personal Audio Collection | Avyona",
    metaDescription: "Shop personal audio products including headphones, earbuds, and neckbands.",
    keywords: "personal audio, headphones, earbuds, neckbands",
    isActive: true
  },
  {
    id: 2,
    name: "Professional Audio",
    slug: "professional-audio",
    parentId: null,
    parentCategory: null,
    categoryType: "main_category",
    description: "Creator and studio-style audio gear.",
    imageUrl: "/uploads/1778905690894-2.jpg",
    bannerImageUrl: "/uploads/1778905694351-1.jpg",
    iconUrl: null,
    status: "active",
    showInMenu: true,
    featuredCategory: true,
    categoryDiscountLabel: "",
    dynamicRuleJson: null,
    sortOrder: 2,
    metaTitle: "Professional Audio Collection | Avyona",
    metaDescription: "Discover microphones, monitors, and creator-focused professional audio gear.",
    keywords: "professional audio, studio audio, creator gear",
    isActive: true
  },
  {
    id: 3,
    name: "Digital Camera",
    slug: "digital-camera",
    parentId: null,
    parentCategory: null,
    categoryType: "main_category",
    description: "Compact and creator-friendly digital cameras.",
    imageUrl: "/uploads/1778905725221-3.jpg",
    bannerImageUrl: "/uploads/1778905722313-3.jpg",
    iconUrl: null,
    status: "active",
    showInMenu: true,
    featuredCategory: true,
    categoryDiscountLabel: "",
    dynamicRuleJson: null,
    sortOrder: 3,
    metaTitle: "Digital Camera Collection | Avyona",
    metaDescription: "Browse digital cameras for travel, family, and creator use.",
    keywords: "digital camera, compact camera, creator camera",
    isActive: true
  },
  {
    id: 4,
    name: "Security Camera",
    slug: "security-camera",
    parentId: null,
    parentCategory: null,
    categoryType: "main_category",
    description: "Indoor and outdoor smart camera setups.",
    imageUrl: "/uploads/1778905743764-4.jpg",
    bannerImageUrl: "/uploads/1778905747088-4.jpg",
    iconUrl: null,
    status: "active",
    showInMenu: true,
    featuredCategory: false,
    categoryDiscountLabel: "",
    dynamicRuleJson: null,
    sortOrder: 4,
    metaTitle: "Security Camera Collection | Avyona",
    metaDescription: "Explore indoor and outdoor security camera collections.",
    keywords: "security camera, smart camera, surveillance",
    isActive: true
  },
  {
    id: 5,
    name: "Avyona Digital Photo Frames",
    slug: "digital-photo-frames",
    parentId: null,
    parentCategory: null,
    categoryType: "main_category",
    description: "Smart digital frames for gifting and family memories.",
    imageUrl: "/uploads/1778905660564-web-category-image.jpg",
    bannerImageUrl: "/uploads/1778905663964-web-category-banner-image.jpg",
    iconUrl: null,
    status: "active",
    showInMenu: true,
    featuredCategory: true,
    categoryDiscountLabel: "",
    dynamicRuleJson: null,
    sortOrder: 5,
    metaTitle: "Digital Photo Frames Collection | Avyona",
    metaDescription: "Shop digital photo frames for gifting, family sharing, and home display.",
    keywords: "digital photo frame, smart frame, gifting frame",
    isActive: true
  },
  {
    id: 6,
    name: "Reading Light",
    slug: "reading-light",
    parentId: null,
    parentCategory: null,
    categoryType: "main_category",
    description: "Portable and bedside reading lights.",
    imageUrl: "/uploads/1778905761612-5.jpg",
    bannerImageUrl: "/uploads/1778905758847-5.jpg",
    iconUrl: null,
    status: "active",
    showInMenu: true,
    featuredCategory: false,
    categoryDiscountLabel: "",
    dynamicRuleJson: null,
    sortOrder: 6,
    metaTitle: "Reading Light Collection | Avyona",
    metaDescription: "Find clip-on and bedside reading lights for everyday use.",
    keywords: "reading light, bedside lamp, clip light",
    isActive: true
  }
];

const CATEGORY_SELECT = `SELECT
  c.id,
  c.name,
  c.slug,
  c.parent_id AS parentId,
  parent.name AS parentCategory,
  CASE
    WHEN c.parent_id IS NULL THEN 'main_category'
    ELSE 'subcategory'
  END AS categoryType,
  (
    SELECT COUNT(*)
    FROM categories child
    WHERE child.parent_id = c.id
  ) AS childCount,
  (
    SELECT COUNT(*)
    FROM products product
    WHERE product.category_id = c.id
      OR product.category_id IN (
        SELECT child.id
        FROM categories child
        WHERE child.parent_id = c.id
      )
  ) AS productCount,
  c.description,
  c.image_url AS imageUrl,
  c.banner_image_url AS bannerImageUrl,
  c.icon_url AS iconUrl,
  c.status,
  c.show_in_menu AS showInMenu,
  c.featured_category AS featuredCategory,
  c.category_discount_label AS categoryDiscountLabel,
  c.dynamic_rule_json AS dynamicRuleJson,
  c.sort_order AS sortOrder,
  c.meta_title AS metaTitle,
  c.meta_description AS metaDescription,
  c.meta_keywords AS keywords,
  c.cod_enabled AS codEnabled,
  c.is_active AS isActive,
  c.created_at AS createdAt,
  c.updated_at AS updatedAt
 FROM categories c
 LEFT JOIN categories parent ON parent.id = c.parent_id`;

function isDatabaseUnavailable(error) {
  if (process.env.REQUIRE_MYSQL === "true") return false;
  return ["ECONNREFUSED", "ER_NO_SUCH_TABLE", "ER_BAD_DB_ERROR", "PROTOCOL_CONNECTION_LOST"].includes(error?.code);
}

async function readLocalCategories() {
  try {
    const raw = await fs.readFile(localCategoriesPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_LOCAL_CATEGORIES;
  } catch {
    return DEFAULT_LOCAL_CATEGORIES;
  }
}

async function writeLocalCategories(categories) {
  await fs.mkdir(path.dirname(localCategoriesPath), { recursive: true });
  await fs.writeFile(localCategoriesPath, JSON.stringify(categories, null, 2));
}

function hydrateLocalCategories(categories) {
  const byId = new Map(categories.map((category) => [Number(category.id), category]));

  return categories.map((category) => {
    const parent = category.parentId ? byId.get(Number(category.parentId)) : null;
    return {
      ...category,
      parentId: category.parentId ?? null,
      parentCategory: parent?.name || null,
      categoryType: category.parentId ? "subcategory" : "main_category",
      childCount: categories.filter((item) => Number(item.parentId || 0) === Number(category.id)).length,
      productCount: Number(category.productCount || 0),
      showInMenu: Boolean(category.showInMenu),
      featuredCategory: Boolean(category.featuredCategory),
      isActive: category.status === "active"
    };
  }).sort((left, right) => {
    const parentSort = Number(left.parentId ? byId.get(Number(left.parentId))?.sortOrder || left.sortOrder || 0 : left.sortOrder || 0)
      - Number(right.parentId ? byId.get(Number(right.parentId))?.sortOrder || right.sortOrder || 0 : right.sortOrder || 0);
    if (parentSort !== 0) return parentSort;
    if (Boolean(left.parentId) !== Boolean(right.parentId)) return left.parentId ? 1 : -1;
    return Number(left.sortOrder || 0) - Number(right.sortOrder || 0) || String(left.name).localeCompare(String(right.name));
  });
}

function parseCategoryId(value, fieldName = "category id") {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, `Invalid ${fieldName}`);
  }

  return id;
}

function toNullableString(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function toSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;

  return defaultValue;
}

function normalizeDynamicRuleJson(value) {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) return value;
  return null;
}

function isSystemFallbackCategory(category) {
  return SYSTEM_FALLBACK_CATEGORY_SLUGS.has(String(category?.slug || "").toLowerCase());
}

function normalizeCategoryPayload(payload = {}) {
  const name = String(payload.name || "").trim();
  const slug = toSlug(payload.slug || payload.name || "");
  const parentIdValue = payload.parentId === "" || payload.parentId === null || payload.parentId === undefined
    ? null
    : Number(payload.parentId);
  const sortOrderValue = payload.sortOrder === "" || payload.sortOrder === null || payload.sortOrder === undefined
    ? 0
    : Number(payload.sortOrder);
  const status = String(payload.status || "active").trim().toLowerCase() === "inactive" ? "inactive" : "active";

  if (!name) {
    throw new ApiError(400, "Category name is required");
  }

  if (!slug) {
    throw new ApiError(400, "Category slug is required");
  }

  if (parentIdValue !== null && (!Number.isInteger(parentIdValue) || parentIdValue <= 0)) {
    throw new ApiError(400, "Parent category must be a valid category id");
  }

  if (!Number.isFinite(sortOrderValue)) {
    throw new ApiError(400, "Sort order must be a valid number");
  }

  return {
    name,
    slug,
    parentId: parentIdValue,
    imageUrl: toNullableString(payload.imageUrl || payload.image),
    bannerImageUrl: toNullableString(payload.bannerImageUrl || payload.banner),
    description: toNullableString(payload.description),
    status,
    showInMenu: parseBoolean(payload.showInMenu, true),
    featuredCategory: parseBoolean(payload.featuredCategory ?? payload.isFeatured, false),
    dynamicRuleJson: normalizeDynamicRuleJson(payload.dynamicRuleJson),
    sortOrder: Math.max(0, Math.round(sortOrderValue)),
    metaTitle: toNullableString(payload.metaTitle),
    metaDescription: toNullableString(payload.metaDescription),
    keywords: toNullableString(payload.keywords),
    isActive: status === "active",
    codEnabled: parseBoolean(payload.codEnabled, true)
  };
}

async function getCategoryRowById(categoryId) {
  const rows = await query(
    `${CATEGORY_SELECT}
     WHERE c.id = ?
     LIMIT 1`,
    [categoryId]
  );

  return rows[0] || null;
}

async function ensureParentCategoryExists(parentId, excludedCategoryId = null) {
  if (parentId === null) return;

  if (excludedCategoryId !== null && parentId === excludedCategoryId) {
    throw new ApiError(400, "A category cannot be its own parent");
  }

  const parentRows = await query(
    "SELECT id FROM categories WHERE id = ? LIMIT 1",
    [parentId]
  );

  if (!parentRows[0]) {
    throw new ApiError(404, "Parent category not found");
  }
}

async function ensureUniqueSlug(slug, excludedCategoryId = null) {
  const rows = excludedCategoryId === null
    ? await query("SELECT id FROM categories WHERE slug = ? LIMIT 1", [slug])
    : await query("SELECT id FROM categories WHERE slug = ? AND id != ? LIMIT 1", [slug, excludedCategoryId]);

  if (rows[0]) {
    throw new ApiError(409, "Category slug already exists");
  }
}

async function ensureFallbackCategory(excludedCategoryId) {
  const fallbackNames = ["Uncategorized", "Uncategorized Products", "Archived Category Products"];

  for (const name of fallbackNames) {
    const slug = toSlug(name);
    const rows = await query("SELECT id FROM categories WHERE slug = ? LIMIT 1", [slug]);
    if (rows[0] && Number(rows[0].id) !== Number(excludedCategoryId)) return Number(rows[0].id);
  }

  for (const name of fallbackNames) {
    const slug = toSlug(name);
    const duplicateRows = await query("SELECT id FROM categories WHERE slug = ? LIMIT 1", [slug]);
    if (duplicateRows[0]) continue;

    const result = await query(
      `INSERT INTO categories
        (name, slug, parent_id, description, status, show_in_menu, featured_category, sort_order, meta_title, meta_description, meta_keywords, is_active)
       VALUES (?, ?, NULL, ?, 'inactive', 0, 0, 9999, ?, ?, ?, 0)`,
      [
        name,
        slug,
        "System category used to preserve products when an admin deletes their original category.",
        name,
        "Products moved here after their original category was deleted.",
        "uncategorized, archived category"
      ]
    );

    return Number(result.insertId);
  }

  throw new ApiError(409, "Unable to create a fallback category for linked products");
}

function buildCategoryTree(rows) {
  const byId = new Map();
  const roots = [];

  rows.forEach((row) => {
    byId.set(row.id, {
      ...row,
      children: []
    });
  });

  rows.forEach((row) => {
    const current = byId.get(row.id);

    if (row.parentId && byId.has(row.parentId)) {
      byId.get(row.parentId).children.push(current);
      return;
    }

    roots.push(current);
  });

  return roots;
}

export async function createCategory(request, response) {
  const payload = normalizeCategoryPayload(request.body);

  try {
    await ensureParentCategoryExists(payload.parentId);
    await ensureUniqueSlug(payload.slug);

    const result = await query(
      `INSERT INTO categories (
        name,
        slug,
        parent_id,
        description,
        image_url,
        banner_image_url,
        status,
        show_in_menu,
        featured_category,
        dynamic_rule_json,
        sort_order,
        meta_title,
        meta_description,
        meta_keywords,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.name,
        payload.slug,
        payload.parentId,
        payload.description,
        payload.imageUrl,
        payload.bannerImageUrl,
        payload.status,
        payload.showInMenu ? 1 : 0,
        payload.featuredCategory ? 1 : 0,
        payload.dynamicRuleJson ? JSON.stringify(payload.dynamicRuleJson) : null,
        payload.sortOrder,
        payload.metaTitle,
        payload.metaDescription,
        payload.keywords,
        payload.isActive ? 1 : 0
      ]
    );

    const category = await getCategoryRowById(result.insertId);

    response.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category
    });
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;

    const categories = hydrateLocalCategories(await readLocalCategories());
    if (categories.some((category) => category.slug === payload.slug)) {
      throw new ApiError(409, "Category slug already exists");
    }
    if (payload.parentId && !categories.some((category) => Number(category.id) === Number(payload.parentId))) {
      throw new ApiError(404, "Parent category not found");
    }

    const now = new Date().toISOString();
    const created = {
      id: Date.now(),
      ...payload,
      childCount: 0,
      productCount: 0,
      parentCategory: null,
      categoryType: payload.parentId ? "subcategory" : "main_category",
      createdAt: now,
      updatedAt: now
    };
    const nextCategories = hydrateLocalCategories([...categories, created]);
    await writeLocalCategories(nextCategories);

    response.status(201).json({
      success: true,
      message: "Category created successfully",
      data: hydrateLocalCategories(nextCategories).find((category) => category.id === created.id),
      source: "local-file"
    });
  }
}

export async function listCategories(_request, response) {
  try {
    const rows = await query(
      `${CATEGORY_SELECT}
       WHERE c.slug NOT IN ('uncategorized', 'uncategorized-products', 'archived-category-products')
       ORDER BY COALESCE(parent.sort_order, c.sort_order) ASC, c.parent_id IS NOT NULL ASC, c.sort_order ASC, c.name ASC`
    );

    response.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
    const rows = hydrateLocalCategories(await readLocalCategories()).filter((category) => !isSystemFallbackCategory(category));
    response.json({
      success: true,
      count: rows.length,
      data: rows,
      source: "local-file"
    });
  }
}

export async function getCategoryTree(_request, response) {
  try {
    const rows = await query(
      `${CATEGORY_SELECT}
       WHERE c.status = 'active'
         AND (c.parent_id IS NULL OR parent.status = 'active')
       ORDER BY COALESCE(parent.sort_order, c.sort_order) ASC, c.parent_id IS NOT NULL ASC, c.sort_order ASC, c.name ASC`
    );

    response.json({
      success: true,
      count: rows.length,
      data: buildCategoryTree(rows)
    });
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
    const rows = hydrateLocalCategories(await readLocalCategories()).filter((category) => category.status === "active");
    response.json({
      success: true,
      count: rows.length,
      data: buildCategoryTree(rows),
      source: "local-file"
    });
  }
}

export async function getCategoryById(request, response) {
  let categoryId;
  try {
    categoryId = parseCategoryId(request.params.id);
    const category = await getCategoryRowById(categoryId);

    if (!category) {
      throw new ApiError(404, "Category not found");
    }

    response.json({
      success: true,
      data: category
    });
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
    const rows = hydrateLocalCategories(await readLocalCategories());
    const category = rows.find((item) => String(item.id) === String(request.params.id) || item.slug === request.params.id);
    if (!category) throw new ApiError(404, "Category not found");
    response.json({ success: true, data: category, source: "local-file" });
  }
}

export async function updateCategory(request, response) {
  let categoryId;
  try {
    categoryId = parseCategoryId(request.params.id);
    const existingCategory = await getCategoryRowById(categoryId);

    if (!existingCategory) {
      throw new ApiError(404, "Category not found");
    }

    const payload = normalizeCategoryPayload(request.body);

    await ensureParentCategoryExists(payload.parentId, categoryId);
    await ensureUniqueSlug(payload.slug, categoryId);

    await query(
      `UPDATE categories
       SET
         name = ?,
         slug = ?,
         parent_id = ?,
         description = ?,
         image_url = ?,
         banner_image_url = ?,
         status = ?,
         show_in_menu = ?,
         featured_category = ?,
         dynamic_rule_json = ?,
         sort_order = ?,
         meta_title = ?,
         meta_description = ?,
         meta_keywords = ?,
         is_active = ?
       WHERE id = ?`,
      [
        payload.name,
        payload.slug,
        payload.parentId,
        payload.description,
        payload.imageUrl,
        payload.bannerImageUrl,
        payload.status,
        payload.showInMenu ? 1 : 0,
        payload.featuredCategory ? 1 : 0,
        payload.dynamicRuleJson ? JSON.stringify(payload.dynamicRuleJson) : null,
        payload.sortOrder,
        payload.metaTitle,
        payload.metaDescription,
        payload.keywords,
        payload.isActive ? 1 : 0,
        categoryId
      ]
    );

    const category = await getCategoryRowById(categoryId);

    response.json({
      success: true,
      message: "Category updated successfully",
      data: category
    });
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;

    const payload = normalizeCategoryPayload(request.body);
    const categories = hydrateLocalCategories(await readLocalCategories());
    const index = categories.findIndex((category) => String(category.id) === String(request.params.id) || category.slug === request.params.id);
    if (index === -1) throw new ApiError(404, "Category not found");

    const currentId = categories[index].id;
    if (payload.parentId && Number(payload.parentId) === Number(currentId)) {
      throw new ApiError(400, "A category cannot be its own parent");
    }
    if (payload.parentId && !categories.some((category) => Number(category.id) === Number(payload.parentId))) {
      throw new ApiError(404, "Parent category not found");
    }
    if (categories.some((category) => category.slug === payload.slug && Number(category.id) !== Number(currentId))) {
      throw new ApiError(409, "Category slug already exists");
    }

    const updated = {
      ...categories[index],
      ...payload,
      id: currentId,
      updatedAt: new Date().toISOString()
    };
    const nextCategories = [...categories];
    nextCategories[index] = updated;
    const hydrated = hydrateLocalCategories(nextCategories);
    await writeLocalCategories(hydrated);

    response.json({
      success: true,
      message: "Category updated successfully",
      data: hydrated.find((category) => Number(category.id) === Number(currentId)),
      source: "local-file"
    });
  }
}

export async function updateCategoryCod(request, response) {
  const categoryId = parseCategoryId(request.params.id);
  const codEnabled = parseBoolean(request.body?.codEnabled, true);
  const result = await query(
    "UPDATE categories SET cod_enabled = ? WHERE id = ? LIMIT 1",
    [codEnabled ? 1 : 0, categoryId]
  );

  if (!result.affectedRows) {
    throw new ApiError(404, "Category not found");
  }

  response.json({
    success: true,
    message: "Category COD setting updated successfully",
    data: await getCategoryRowById(categoryId)
  });
}

export async function deleteCategory(request, response) {
  let categoryId;
  try {
    categoryId = parseCategoryId(request.params.id);
    const existingCategory = await getCategoryRowById(categoryId);

    if (!existingCategory) {
      throw new ApiError(404, "Category not found");
    }

    const childRows = await query(
      "SELECT COUNT(*) AS totalChildren FROM categories WHERE parent_id = ?",
      [categoryId]
    );
    const productRows = await query(
      "SELECT COUNT(*) AS totalProducts FROM products WHERE category_id = ?",
      [categoryId]
    );

    if (Number(productRows[0]?.totalProducts || 0) > 0) {
      const fallbackCategoryId = await ensureFallbackCategory(categoryId);
      await query("UPDATE products SET category_id = ? WHERE category_id = ?", [fallbackCategoryId, categoryId]);
    }

    if (Number(childRows[0]?.totalChildren || 0) > 0) {
      await query("UPDATE categories SET parent_id = NULL WHERE parent_id = ?", [categoryId]);
    }

    await query("DELETE FROM categories WHERE id = ? LIMIT 1", [categoryId]);

    response.json({
      success: true,
      message: "Category deleted successfully"
    });
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;

    const categories = hydrateLocalCategories(await readLocalCategories());
    const target = categories.find((category) => String(category.id) === String(request.params.id) || category.slug === request.params.id);
    if (!target) throw new ApiError(404, "Category not found");
    const nextCategories = categories
      .filter((category) => Number(category.id) !== Number(target.id))
      .map((category) => Number(category.parentId || 0) === Number(target.id) ? { ...category, parentId: null } : category);
    await writeLocalCategories(hydrateLocalCategories(nextCategories));

    response.json({
      success: true,
      message: "Category deleted successfully",
      source: "local-file"
    });
  }
}
