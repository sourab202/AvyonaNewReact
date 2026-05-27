import { query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";

const publicStatuses = ["active", "published"];

function parseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function mapPublicPage(row = {}) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    pageType: row.page_type,
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
    updatedAt: row.updated_at
  };
}

function mapPublicNavigationPage(row = {}) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    url: `/pages/${row.slug}`,
    pageType: row.page_type,
    sortOrder: row.sort_order
  };
}

function mapPublicBlock(row = {}) {
  return {
    id: row.id,
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
    customCssClass: row.custom_css_class
  };
}

function getPublicPageWhereClause(alias = "") {
  const prefix = alias ? `${alias}.` : "";
  return `${prefix}deleted_at IS NULL
    AND ${prefix}is_live_url_enabled = 1
    AND ${prefix}status IN (?, ?)`;
}

export async function listPublicPages(_request, response) {
  const rows = await query(
    `SELECT *
     FROM custom_pages
     WHERE ${getPublicPageWhereClause()}
     ORDER BY COALESCE(published_at, updated_at) DESC, title ASC`,
    publicStatuses
  );

  response.json({
    success: true,
    data: rows.map(mapPublicPage)
  });
}

export async function getPublicPageBySlug(request, response) {
  const slug = String(request.params.slug || "").trim().toLowerCase();
  const previewEnabled = String(request.query.preview || "").toLowerCase() === "true";
  const pages = await query(
    `SELECT *
     FROM custom_pages
     WHERE slug = ?
       AND deleted_at IS NULL
       ${previewEnabled ? "" : "AND is_live_url_enabled = 1 AND status IN (?, ?)"}
     LIMIT 1`,
    previewEnabled ? [slug] : [slug, ...publicStatuses]
  );
  const page = pages[0];

  if (!page) throw new ApiError(404, "Page not found");

  const blocks = await query(
    `SELECT *
     FROM custom_page_blocks
     WHERE page_id = ?
       AND deleted_at IS NULL
       AND status = 'active'
     ORDER BY sort_order ASC, id ASC`,
    [page.id]
  );

  response.json({
    success: true,
    data: {
      ...mapPublicPage(page),
      blocks: blocks.map(mapPublicBlock)
    }
  });
}

export async function getPublicHeaderPages(_request, response) {
  const rows = await query(
    `SELECT id, title, slug, page_type, header_sort_order AS sort_order
     FROM custom_pages
     WHERE deleted_at IS NULL
       AND is_live_url_enabled = 1
       AND status = 'active'
       AND show_in_header = 1
     ORDER BY header_sort_order ASC, title ASC`,
    []
  );

  response.json({
    success: true,
    data: rows.map(mapPublicNavigationPage)
  });
}

export async function getPublicFooterPages(_request, response) {
  const rows = await query(
    `SELECT id, title, slug, page_type, footer_sort_order AS sort_order
     FROM custom_pages
     WHERE deleted_at IS NULL
       AND is_live_url_enabled = 1
       AND status = 'active'
       AND show_in_footer = 1
     ORDER BY footer_sort_order ASC, title ASC`,
    []
  );

  response.json({
    success: true,
    data: rows.map(mapPublicNavigationPage)
  });
}
