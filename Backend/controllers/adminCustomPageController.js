import { pool, query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";

const validPageTypes = new Set(["policy", "about", "landing", "information", "custom"]);
const validPageStatuses = new Set(["draft", "active", "inactive", "published"]);
const validRobots = new Set(["index/follow", "noindex/follow", "noindex/nofollow"]);
const validBlockTypes = new Set(["text", "image", "image_text", "heading", "banner", "two_column", "faq", "button"]);
const validBlockStatuses = new Set(["active", "inactive"]);
const validTextAlignments = new Set(["left", "center", "right"]);
const customCssMaxLength = 10000;

function toBooleanInt(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback ? 1 : 0;
  return ["true", "1", "yes", "on"].includes(String(value).toLowerCase()) || value === true ? 1 : 0;
}

function toNullableString(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function toMysqlDateTime(value) {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 19).replace("T", " ");
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const localDateTime = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/);
  if (localDateTime) {
    return `${localDateTime[1]} ${localDateTime[2]}:${localDateTime[3] || "00"}`;
  }

  const mysqlDateTime = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
  if (mysqlDateTime) {
    return `${mysqlDateTime[1]} ${mysqlDateTime[2]}`;
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 19).replace("T", " ");
  }

  return null;
}

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function createSlug(title = "custom-page") {
  return String(title || "custom-page")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "custom-page";
}

function validateCustomPageCss(value = "") {
  const css = String(value || "").trim();
  if (!css) return null;

  if (css.length > customCssMaxLength) {
    throw new ApiError(400, "Custom Page CSS must be 10,000 characters or less");
  }

  if (!/\.avyona-custom-page[\s.#:[,{>+~]/i.test(`${css} `)) {
    throw new ApiError(400, "Custom Page CSS must be scoped to .avyona-custom-page");
  }

  const unsafePatterns = [
    /<\s*script\b/i,
    /\bjavascript\s*:/i,
    /@import\b/i,
    /\biframe\b/i,
    /\sonclick\s*=/i,
    /\sonerror\s*=/i
  ];

  if (unsafePatterns.some((pattern) => pattern.test(css))) {
    throw new ApiError(400, "Custom Page CSS contains unsafe content");
  }

  return css;
}

function normalizePagePayload(body = {}, existing = {}) {
  const title = toNullableString(body.title ?? body.pageTitle ?? existing.title);
  if (!title) throw new ApiError(400, "Page title is required");

  const slug = createSlug(body.slug ?? body.pageSlug ?? existing.slug ?? title);
  const pageType = String(body.pageType ?? body.page_type ?? existing.pageType ?? "custom").toLowerCase();
  const status = String(body.status ?? existing.status ?? "draft").toLowerCase();
  const robots = String(body.robots ?? existing.robots ?? "index/follow").toLowerCase();
  const rawCustomCss = body.customCss ?? body.custom_css ?? body.styleSettings?.customCss ?? existing.customCss;

  return {
    title,
    slug,
    pageType: validPageTypes.has(pageType) ? pageType : "custom",
    status: validPageStatuses.has(status) ? status : "draft",
    showInHeader: toBooleanInt(body.showInHeader ?? body.show_in_header, existing.showInHeader),
    showInFooter: toBooleanInt(body.showInFooter ?? body.show_in_footer, existing.showInFooter),
    headerSortOrder: toInteger(body.headerSortOrder ?? body.header_sort_order, existing.headerSortOrder || 0),
    footerSortOrder: toInteger(body.footerSortOrder ?? body.footer_sort_order, existing.footerSortOrder || 0),
    isLiveUrlEnabled: toBooleanInt(body.isLiveUrlEnabled ?? body.is_live_url_enabled, existing.isLiveUrlEnabled),
    publishedAt: toMysqlDateTime(body.publishedAt ?? body.published_at ?? existing.publishedAt),
    metaTitle: toNullableString(body.metaTitle ?? body.meta_title ?? existing.metaTitle),
    metaDescription: toNullableString(body.metaDescription ?? body.meta_description ?? existing.metaDescription),
    metaKeywords: toNullableString(body.metaKeywords ?? body.meta_keywords ?? existing.metaKeywords),
    canonicalUrl: toNullableString(body.canonicalUrl ?? body.canonical_url ?? existing.canonicalUrl),
    ogTitle: toNullableString(body.ogTitle ?? body.og_title ?? existing.ogTitle),
    ogDescription: toNullableString(body.ogDescription ?? body.og_description ?? existing.ogDescription),
    ogImageUrl: toNullableString(body.ogImageUrl ?? body.og_image_url ?? existing.ogImageUrl),
    robots: validRobots.has(robots) ? robots : "index/follow",
    customCss: validateCustomPageCss(rawCustomCss)
  };
}

function normalizeBlockPayload(body = {}, existing = {}, index = 0) {
  const blockType = String(body.blockType ?? body.block_type ?? existing.blockType ?? "text").toLowerCase().replace(/-/g, "_");
  const status = String(body.status ?? existing.status ?? "active").toLowerCase();
  const textAlignment = String(body.textAlignment ?? body.text_alignment ?? existing.textAlignment ?? "left").toLowerCase();
  const rawContent = body.content ?? existing.content ?? null;

  return {
    blockType: validBlockTypes.has(blockType) ? blockType : "text",
    blockTitle: toNullableString(body.blockTitle ?? body.block_title ?? existing.blockTitle),
    content: rawContent === null || rawContent === undefined || rawContent === "" ? null : JSON.stringify(rawContent),
    imageUrl: toNullableString(body.imageUrl ?? body.image_url ?? existing.imageUrl),
    imageAlt: toNullableString(body.imageAlt ?? body.image_alt ?? existing.imageAlt),
    imageTitle: toNullableString(body.imageTitle ?? body.image_title ?? existing.imageTitle),
    imageCaption: toNullableString(body.imageCaption ?? body.image_caption ?? existing.imageCaption),
    layoutPosition: toNullableString(body.layoutPosition ?? body.layout_position ?? existing.layoutPosition),
    imageWidth: toNullableString(body.imageWidth ?? body.image_width ?? existing.imageWidth),
    borderRadius: body.borderRadius || body.border_radius ? toInteger(body.borderRadius ?? body.border_radius, existing.borderRadius || 0) : existing.borderRadius ?? null,
    textAlignment: validTextAlignments.has(textAlignment) ? textAlignment : "left",
    fontSize: body.fontSize || body.font_size ? toInteger(body.fontSize ?? body.font_size, existing.fontSize || 16) : existing.fontSize ?? null,
    textColor: toNullableString(body.textColor ?? body.text_color ?? existing.textColor),
    backgroundColor: toNullableString(body.backgroundColor ?? body.background_color ?? existing.backgroundColor),
    buttonText: toNullableString(body.buttonText ?? body.button_text ?? existing.buttonText),
    buttonLink: toNullableString(body.buttonLink ?? body.button_link ?? existing.buttonLink),
    sortOrder: toInteger(body.sortOrder ?? body.sort_order, existing.sortOrder ?? index),
    status: validBlockStatuses.has(status) ? status : "active",
    customCssClass: toNullableString(body.customCssClass ?? body.custom_css_class ?? existing.customCssClass)
  };
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function mapPage(row = {}) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    pageType: row.page_type,
    status: row.status,
    showInHeader: Boolean(row.show_in_header),
    showInFooter: Boolean(row.show_in_footer),
    headerSortOrder: row.header_sort_order,
    footerSortOrder: row.footer_sort_order,
    isLiveUrlEnabled: Boolean(row.is_live_url_enabled),
    publishedAt: row.published_at,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    metaKeywords: row.meta_keywords,
    canonicalUrl: row.canonical_url,
    ogTitle: row.og_title,
    ogDescription: row.og_description,
    ogImageUrl: row.og_image_url,
    robots: row.robots,
    customCss: row.custom_css,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  };
}

function mapBlock(row = {}) {
  return {
    id: row.id,
    pageId: row.page_id,
    blockType: row.block_type,
    blockTitle: row.block_title,
    content: parseJson(row.content),
    imageUrl: row.image_url,
    imageAlt: row.image_alt,
    imageTitle: row.image_title,
    imageCaption: row.image_caption,
    layoutPosition: row.layout_position,
    imageWidth: row.image_width,
    borderRadius: row.border_radius,
    textAlignment: row.text_alignment,
    fontSize: row.font_size,
    textColor: row.text_color,
    backgroundColor: row.background_color,
    buttonText: row.button_text,
    buttonLink: row.button_link,
    sortOrder: row.sort_order,
    status: row.status,
    customCssClass: row.custom_css_class,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  };
}

async function getPageRow(id, connection = null) {
  const executor = connection || { query: async (...args) => [await query(...args)] };
  const [rows] = await executor.query(
    "SELECT * FROM custom_pages WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [id]
  );
  return rows[0] || null;
}

async function ensureSlugAvailable(slug, pageId = null) {
  const rows = await query(
    "SELECT id FROM custom_pages WHERE slug = ? AND deleted_at IS NULL AND (? IS NULL OR id <> ?) LIMIT 1",
    [slug, pageId, pageId]
  );
  if (rows.length) throw new ApiError(409, "Page slug already exists");
}

async function readBlocks(pageId) {
  const rows = await query(
    `SELECT *
     FROM custom_page_blocks
     WHERE page_id = ? AND deleted_at IS NULL
     ORDER BY sort_order ASC, id ASC`,
    [pageId]
  );
  return rows.map(mapBlock);
}

export async function listAdminPages(request, response) {
  const search = String(request.query.search || "").trim();
  const status = String(request.query.status || "").trim().toLowerCase();
  const showIn = String(request.query.showIn || request.query.show_in || "").trim().toLowerCase();
  const where = ["deleted_at IS NULL"];
  const values = [];

  if (search) {
    where.push("(title LIKE ? OR slug LIKE ?)");
    values.push(`%${search}%`, `%${search}%`);
  }

  if (validPageStatuses.has(status)) {
    where.push("status = ?");
    values.push(status);
  }

  if (showIn === "header") where.push("show_in_header = 1");
  if (showIn === "footer") where.push("show_in_footer = 1");
  if (showIn === "both") where.push("show_in_header = 1 AND show_in_footer = 1");
  if (showIn === "hidden") where.push("show_in_header = 0 AND show_in_footer = 0 AND is_live_url_enabled = 1");
  if (showIn === "draft") where.push("status = 'draft'");

  const rows = await query(
    `SELECT *
     FROM custom_pages
     WHERE ${where.join(" AND ")}
     ORDER BY updated_at DESC, id DESC`,
    values
  );

  response.json({ success: true, data: rows.map(mapPage) });
}

export async function createAdminPage(request, response) {
  const page = normalizePagePayload(request.body || {});
  await ensureSlugAvailable(page.slug);

  const result = await query(
    `INSERT INTO custom_pages
      (title, slug, page_type, status, show_in_header, show_in_footer, header_sort_order, footer_sort_order,
       is_live_url_enabled, published_at, meta_title, meta_description, meta_keywords, canonical_url,
       og_title, og_description, og_image_url, robots, custom_css)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      page.title, page.slug, page.pageType, page.status, page.showInHeader, page.showInFooter,
      page.headerSortOrder, page.footerSortOrder, page.isLiveUrlEnabled, page.publishedAt,
      page.metaTitle, page.metaDescription, page.metaKeywords, page.canonicalUrl,
      page.ogTitle, page.ogDescription, page.ogImageUrl, page.robots, page.customCss
    ]
  );

  const created = await getPageRow(result.insertId);
  response.status(201).json({ success: true, data: { ...mapPage(created), blocks: [] } });
}

export async function getAdminPage(request, response) {
  const page = await getPageRow(request.params.id);
  if (!page) throw new ApiError(404, "Custom page not found");
  const blocks = await readBlocks(page.id);
  response.json({ success: true, data: { ...mapPage(page), blocks } });
}

export async function updateAdminPage(request, response) {
  const existing = await getPageRow(request.params.id);
  if (!existing) throw new ApiError(404, "Custom page not found");
  const page = normalizePagePayload(request.body || {}, mapPage(existing));
  await ensureSlugAvailable(page.slug, existing.id);

  await query(
    `UPDATE custom_pages
     SET title = ?, slug = ?, page_type = ?, status = ?, show_in_header = ?, show_in_footer = ?,
         header_sort_order = ?, footer_sort_order = ?, is_live_url_enabled = ?, published_at = ?,
         meta_title = ?, meta_description = ?, meta_keywords = ?, canonical_url = ?,
         og_title = ?, og_description = ?, og_image_url = ?, robots = ?, custom_css = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [
      page.title, page.slug, page.pageType, page.status, page.showInHeader, page.showInFooter,
      page.headerSortOrder, page.footerSortOrder, page.isLiveUrlEnabled, page.publishedAt,
      page.metaTitle, page.metaDescription, page.metaKeywords, page.canonicalUrl,
      page.ogTitle, page.ogDescription, page.ogImageUrl, page.robots, page.customCss, existing.id
    ]
  );

  const updated = await getPageRow(existing.id);
  const blocks = await readBlocks(existing.id);
  response.json({ success: true, data: { ...mapPage(updated), blocks } });
}

export async function deleteAdminPage(request, response) {
  const page = await getPageRow(request.params.id);
  if (!page) throw new ApiError(404, "Custom page not found");
  await query("UPDATE custom_pages SET deleted_at = NOW(), status = 'inactive' WHERE id = ?", [page.id]);
  await query("UPDATE custom_page_blocks SET deleted_at = NOW(), status = 'inactive' WHERE page_id = ?", [page.id]);
  response.json({ success: true, message: "Custom page deleted" });
}

export async function updateAdminPageStatus(request, response) {
  const status = String(request.body?.status || "").toLowerCase();
  if (!validPageStatuses.has(status)) throw new ApiError(400, "Valid page status is required");
  const page = await getPageRow(request.params.id);
  if (!page) throw new ApiError(404, "Custom page not found");
  const publishedAt = status === "published" || status === "active"
    ? toMysqlDateTime(request.body?.publishedAt || page.published_at || new Date())
    : toMysqlDateTime(page.published_at);
  const isLiveUrlEnabled = status === "active" || status === "published" ? 1 : 0;

  await query(
    "UPDATE custom_pages SET status = ?, is_live_url_enabled = ?, published_at = ? WHERE id = ? AND deleted_at IS NULL",
    [status, isLiveUrlEnabled, publishedAt, page.id]
  );

  const updated = await getPageRow(page.id);
  response.json({ success: true, data: mapPage(updated) });
}

export async function duplicateAdminPage(request, response) {
  const source = await getPageRow(request.params.id);
  if (!source) throw new ApiError(404, "Custom page not found");
  const blocks = await readBlocks(source.id);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    let slug = createSlug(`${source.slug}-copy`);
    let suffix = 2;
    while ((await connection.query("SELECT id FROM custom_pages WHERE slug = ? AND deleted_at IS NULL LIMIT 1", [slug]))[0].length) {
      slug = createSlug(`${source.slug}-copy-${suffix}`);
      suffix += 1;
    }

    const [result] = await connection.query(
      `INSERT INTO custom_pages
        (title, slug, page_type, status, show_in_header, show_in_footer, header_sort_order, footer_sort_order,
         is_live_url_enabled, published_at, meta_title, meta_description, meta_keywords, canonical_url,
         og_title, og_description, og_image_url, robots, custom_css)
       VALUES (?, ?, ?, 'draft', 0, 0, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `${source.title} Copy`, slug, source.page_type, source.header_sort_order, source.footer_sort_order,
        source.meta_title, source.meta_description, source.meta_keywords, source.canonical_url,
        source.og_title, source.og_description, source.og_image_url, source.robots, source.custom_css
      ]
    );

    for (const block of blocks) {
      await connection.query(
        `INSERT INTO custom_page_blocks
          (page_id, block_type, block_title, content, image_url, image_alt, image_title, image_caption,
           layout_position, image_width, border_radius, text_alignment, font_size, text_color, background_color,
           button_text, button_link, sort_order, status, custom_css_class)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          result.insertId, block.blockType, block.blockTitle, JSON.stringify(block.content), block.imageUrl,
          block.imageAlt, block.imageTitle, block.imageCaption, block.layoutPosition, block.imageWidth,
          block.borderRadius, block.textAlignment, block.fontSize, block.textColor, block.backgroundColor,
          block.buttonText, block.buttonLink, block.sortOrder, block.status, block.customCssClass
        ]
      );
    }

    await connection.commit();
    const created = await getPageRow(result.insertId);
    response.status(201).json({ success: true, data: { ...mapPage(created), blocks } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function uploadAdminPageImage(request, response) {
  if (!request.file) throw new ApiError(400, "Custom page image file is required");
  response.status(201).json({
    success: true,
    data: {
      filename: request.file.filename,
      originalName: request.file.originalname,
      mimeType: request.file.mimetype,
      size: request.file.size,
      url: `/uploads/pages/${request.file.filename}`
    }
  });
}

export async function createAdminPageBlock(request, response) {
  const page = await getPageRow(request.params.pageId);
  if (!page) throw new ApiError(404, "Custom page not found");
  const block = normalizeBlockPayload(request.body || {});

  const result = await query(
    `INSERT INTO custom_page_blocks
      (page_id, block_type, block_title, content, image_url, image_alt, image_title, image_caption,
       layout_position, image_width, border_radius, text_alignment, font_size, text_color, background_color,
       button_text, button_link, sort_order, status, custom_css_class)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      page.id, block.blockType, block.blockTitle, block.content, block.imageUrl, block.imageAlt,
      block.imageTitle, block.imageCaption, block.layoutPosition, block.imageWidth, block.borderRadius,
      block.textAlignment, block.fontSize, block.textColor, block.backgroundColor, block.buttonText,
      block.buttonLink, block.sortOrder, block.status, block.customCssClass
    ]
  );

  const rows = await query("SELECT * FROM custom_page_blocks WHERE id = ? LIMIT 1", [result.insertId]);
  response.status(201).json({ success: true, data: mapBlock(rows[0]) });
}

export async function updateAdminPageBlock(request, response) {
  const page = await getPageRow(request.params.pageId);
  if (!page) throw new ApiError(404, "Custom page not found");
  const rows = await query(
    "SELECT * FROM custom_page_blocks WHERE id = ? AND page_id = ? AND deleted_at IS NULL LIMIT 1",
    [request.params.blockId, page.id]
  );
  if (!rows[0]) throw new ApiError(404, "Custom page block not found");
  const block = normalizeBlockPayload(request.body || {}, mapBlock(rows[0]));

  await query(
    `UPDATE custom_page_blocks
     SET block_type = ?, block_title = ?, content = ?, image_url = ?, image_alt = ?, image_title = ?,
         image_caption = ?, layout_position = ?, image_width = ?, border_radius = ?, text_alignment = ?,
         font_size = ?, text_color = ?, background_color = ?, button_text = ?, button_link = ?, sort_order = ?, status = ?,
         custom_css_class = ?
     WHERE id = ? AND page_id = ? AND deleted_at IS NULL`,
    [
      block.blockType, block.blockTitle, block.content, block.imageUrl, block.imageAlt, block.imageTitle,
      block.imageCaption, block.layoutPosition, block.imageWidth, block.borderRadius, block.textAlignment,
      block.fontSize, block.textColor, block.backgroundColor, block.buttonText, block.buttonLink,
      block.sortOrder, block.status, block.customCssClass, request.params.blockId, page.id
    ]
  );

  const updatedRows = await query("SELECT * FROM custom_page_blocks WHERE id = ? LIMIT 1", [request.params.blockId]);
  response.json({ success: true, data: mapBlock(updatedRows[0]) });
}

export async function deleteAdminPageBlock(request, response) {
  const page = await getPageRow(request.params.pageId);
  if (!page) throw new ApiError(404, "Custom page not found");
  await query(
    "UPDATE custom_page_blocks SET deleted_at = NOW(), status = 'inactive' WHERE id = ? AND page_id = ? AND deleted_at IS NULL",
    [request.params.blockId, page.id]
  );
  response.json({ success: true, message: "Custom page block deleted" });
}

export async function reorderAdminPageBlocks(request, response) {
  const page = await getPageRow(request.params.pageId);
  if (!page) throw new ApiError(404, "Custom page not found");
  const items = Array.isArray(request.body?.blocks) ? request.body.blocks : [];
  if (!items.length) throw new ApiError(400, "Blocks reorder list is required");

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const [index, item] of items.entries()) {
      await connection.query(
        "UPDATE custom_page_blocks SET sort_order = ? WHERE id = ? AND page_id = ? AND deleted_at IS NULL",
        [toInteger(item.sortOrder ?? item.sort_order, index + 1), item.id ?? item.blockId, page.id]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  response.json({ success: true, data: await readBlocks(page.id) });
}
