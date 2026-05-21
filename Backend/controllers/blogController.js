import { query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toNullableString(value, maxLength = 500, fieldName = "Value") {
  const text = String(value ?? "").trim();
  if (text.length > maxLength) throw new ApiError(400, `${fieldName} must be ${maxLength} characters or less`);
  return text || null;
}

function parseBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return defaultValue;
  return ["true", "1", "yes", "on"].includes(normalized);
}

function normalizeStatus(value, fallback = "draft") {
  const status = String(value || fallback).trim().toLowerCase();
  return ["draft", "active", "inactive"].includes(status) ? status : fallback;
}

function normalizeTagStatus(value, fallback = "active") {
  const status = String(value || fallback).trim().toLowerCase();
  return ["active", "inactive"].includes(status) ? status : fallback;
}

function parseId(value, label = "id") {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, `Invalid ${label}`);
  return id;
}

function toDateTime(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw} 00:00:00`;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, "Published date is invalid");
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function mapBlogRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    title: row.title || "",
    slug: row.slug || "",
    subtitle: row.subtitle || "",
    excerpt: row.excerpt || "",
    content: row.content || "",
    featuredImageUrl: row.featuredImageUrl || "",
    image: row.featuredImageUrl || "",
    authorName: row.authorName || "",
    tagId: row.tagId ? Number(row.tagId) : null,
    tagName: row.tagName || "",
    tagSlug: row.tagSlug || "",
    tag: row.tagName || "",
    status: row.status || "draft",
    showOnHomepage: Boolean(row.showOnHomepage),
    homepageSortOrder: Number(row.homepageSortOrder || 0),
    publishedAt: row.publishedAt,
    metaTitle: row.metaTitle || "",
    metaDescription: row.metaDescription || "",
    metaKeywords: row.metaKeywords || "",
    canonicalUrl: row.canonicalUrl || "",
    ogImageUrl: row.ogImageUrl || "",
    ogImage: row.ogImageUrl || "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt
  };
}

function mapTagRow(row) {
  return {
    id: Number(row.id),
    name: row.name || "",
    slug: row.slug || "",
    status: row.status || "active",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

const BLOG_SELECT = `SELECT
  b.id,
  b.title,
  b.slug,
  b.subtitle,
  b.excerpt,
  b.content,
  b.featured_image_url AS featuredImageUrl,
  b.author_name AS authorName,
  b.tag_id AS tagId,
  t.name AS tagName,
  t.slug AS tagSlug,
  b.status,
  b.show_on_homepage AS showOnHomepage,
  b.homepage_sort_order AS homepageSortOrder,
  b.published_at AS publishedAt,
  b.meta_title AS metaTitle,
  b.meta_description AS metaDescription,
  b.meta_keywords AS metaKeywords,
  b.canonical_url AS canonicalUrl,
  b.og_image_url AS ogImageUrl,
  b.created_at AS createdAt,
  b.updated_at AS updatedAt,
  b.deleted_at AS deletedAt
 FROM blogs b
 LEFT JOIN blog_tags t ON t.id = b.tag_id`;

async function getBlogById(id, includeDeleted = false) {
  const rows = await query(
    `${BLOG_SELECT} WHERE b.id = ? ${includeDeleted ? "" : "AND b.deleted_at IS NULL"} LIMIT 1`,
    [id]
  );
  if (!rows.length) throw new ApiError(404, "Blog not found");
  return mapBlogRow(rows[0]);
}

async function assertUniqueBlogSlug(slug, excludedId = null) {
  const rows = excludedId
    ? await query("SELECT id FROM blogs WHERE slug = ? AND id != ? LIMIT 1", [slug, excludedId])
    : await query("SELECT id FROM blogs WHERE slug = ? LIMIT 1", [slug]);
  if (rows.length) throw new ApiError(409, "A blog with this slug already exists");
}

async function assertUniqueTagSlug(slug, excludedId = null) {
  const rows = excludedId
    ? await query("SELECT id FROM blog_tags WHERE slug = ? AND id != ? LIMIT 1", [slug, excludedId])
    : await query("SELECT id FROM blog_tags WHERE slug = ? LIMIT 1", [slug]);
  if (rows.length) throw new ApiError(409, "A blog tag with this slug already exists");
}

async function resolveTagId(payload) {
  if (payload.tagId) return parseId(payload.tagId, "tag id");
  const tagName = String(payload.tagName || payload.tag || "").trim();
  if (!tagName) return null;

  const tagSlug = slugify(tagName);
  const existing = await query("SELECT id FROM blog_tags WHERE slug = ? LIMIT 1", [tagSlug]);
  if (existing.length) return Number(existing[0].id);

  const result = await query(
    "INSERT INTO blog_tags (name, slug, status) VALUES (?, ?, 'active')",
    [tagName, tagSlug]
  );
  return Number(result.insertId);
}

async function validateBlogPayload(payload = {}, existingId = null) {
  const title = toNullableString(payload.title, 220, "Blog title");
  if (!title) throw new ApiError(400, "Blog title is required");

  const slug = slugify(payload.slug || title);
  if (!slug) throw new ApiError(400, "Blog slug is required");
  await assertUniqueBlogSlug(slug, existingId);

  return {
    title,
    slug,
    subtitle: toNullableString(payload.subtitle, 255, "Short subtitle"),
    excerpt: toNullableString(payload.excerpt, 2000, "Short excerpt"),
    content: String(payload.content || "").trim() || null,
    featuredImageUrl: toNullableString(payload.featuredImageUrl ?? payload.featured_image_url ?? payload.image, 500, "Featured image URL"),
    authorName: toNullableString(payload.authorName ?? payload.author_name, 160, "Author name"),
    tagId: await resolveTagId(payload),
    status: normalizeStatus(payload.status),
    showOnHomepage: parseBoolean(payload.showOnHomepage ?? payload.show_on_homepage, false),
    homepageSortOrder: Number.isFinite(Number(payload.homepageSortOrder ?? payload.homepage_sort_order))
      ? Math.floor(Number(payload.homepageSortOrder ?? payload.homepage_sort_order))
      : 0,
    publishedAt: toDateTime(payload.publishedAt ?? payload.published_at),
    metaTitle: toNullableString(payload.metaTitle ?? payload.meta_title, 180, "Meta title"),
    metaDescription: toNullableString(payload.metaDescription ?? payload.meta_description, 2000, "Meta description"),
    metaKeywords: toNullableString(payload.metaKeywords ?? payload.meta_keywords, 2000, "Meta keywords"),
    canonicalUrl: toNullableString(payload.canonicalUrl ?? payload.canonical_url, 500, "Canonical URL"),
    ogImageUrl: toNullableString(payload.ogImageUrl ?? payload.og_image_url ?? payload.ogImage, 500, "OG image URL")
  };
}

function buildBlogWhere({ includeDeleted = false, publicOnly = false, homepageOnly = false, query: search = "", status = "", tag = "" } = {}) {
  const clauses = [];
  const values = [];

  if (!includeDeleted) clauses.push("b.deleted_at IS NULL");
  if (publicOnly) clauses.push("b.status = 'active'");
  if (homepageOnly) clauses.push("b.show_on_homepage = 1");
  if (status && status !== "all") {
    clauses.push("b.status = ?");
    values.push(normalizeStatus(status, "active"));
  }
  if (tag && tag !== "all") {
    clauses.push("(t.slug = ? OR t.name = ?)");
    values.push(String(tag), String(tag));
  }
  if (search) {
    clauses.push("(b.title LIKE ? OR b.subtitle LIKE ? OR b.excerpt LIKE ? OR t.name LIKE ?)");
    const like = `%${String(search).trim()}%`;
    values.push(like, like, like, like);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    values
  };
}

export async function listAdminBlogs(request, response) {
  const { where, values } = buildBlogWhere(request.query);
  const sort = request.query.sort === "oldest" ? "ASC" : "DESC";
  const rows = await query(`${BLOG_SELECT} ${where} ORDER BY b.published_at ${sort}, b.created_at ${sort}`, values);
  response.json({ success: true, data: rows.map(mapBlogRow) });
}

export async function createAdminBlog(request, response) {
  const payload = await validateBlogPayload(request.body);
  const result = await query(
    `INSERT INTO blogs
      (title, slug, subtitle, excerpt, content, featured_image_url, author_name, tag_id, status, show_on_homepage,
       homepage_sort_order, published_at, meta_title, meta_description, meta_keywords, canonical_url, og_image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.title,
      payload.slug,
      payload.subtitle,
      payload.excerpt,
      payload.content,
      payload.featuredImageUrl,
      payload.authorName,
      payload.tagId,
      payload.status,
      payload.showOnHomepage ? 1 : 0,
      payload.homepageSortOrder,
      payload.publishedAt,
      payload.metaTitle,
      payload.metaDescription,
      payload.metaKeywords,
      payload.canonicalUrl,
      payload.ogImageUrl
    ]
  );

  const blog = await getBlogById(result.insertId);
  response.status(201).json({ success: true, data: blog });
}

export async function getAdminBlog(request, response) {
  const blog = await getBlogById(parseId(request.params.id, "blog id"));
  response.json({ success: true, data: blog });
}

export async function updateAdminBlog(request, response) {
  const id = parseId(request.params.id, "blog id");
  await getBlogById(id);
  const payload = await validateBlogPayload(request.body, id);

  await query(
    `UPDATE blogs SET
      title = ?, slug = ?, subtitle = ?, excerpt = ?, content = ?, featured_image_url = ?, author_name = ?,
      tag_id = ?, status = ?, show_on_homepage = ?, homepage_sort_order = ?, published_at = ?, meta_title = ?,
      meta_description = ?, meta_keywords = ?, canonical_url = ?, og_image_url = ?
     WHERE id = ?`,
    [
      payload.title,
      payload.slug,
      payload.subtitle,
      payload.excerpt,
      payload.content,
      payload.featuredImageUrl,
      payload.authorName,
      payload.tagId,
      payload.status,
      payload.showOnHomepage ? 1 : 0,
      payload.homepageSortOrder,
      payload.publishedAt,
      payload.metaTitle,
      payload.metaDescription,
      payload.metaKeywords,
      payload.canonicalUrl,
      payload.ogImageUrl,
      id
    ]
  );

  const blog = await getBlogById(id);
  response.json({ success: true, data: blog });
}

export async function deleteAdminBlog(request, response) {
  const id = parseId(request.params.id, "blog id");
  await getBlogById(id);
  await query("UPDATE blogs SET deleted_at = NOW(), status = 'inactive', show_on_homepage = 0 WHERE id = ?", [id]);
  response.json({ success: true, message: "Blog soft deleted" });
}

export async function updateAdminBlogStatus(request, response) {
  const id = parseId(request.params.id, "blog id");
  const status = normalizeStatus(request.body.status, "active");
  await getBlogById(id);
  await query("UPDATE blogs SET status = ? WHERE id = ?", [status, id]);
  const blog = await getBlogById(id);
  response.json({ success: true, data: blog });
}

export async function updateAdminBlogHomepage(request, response) {
  const id = parseId(request.params.id, "blog id");
  const showOnHomepage = parseBoolean(request.body.showOnHomepage ?? request.body.show_on_homepage, false);
  const homepageSortOrder = Number.isFinite(Number(request.body.homepageSortOrder ?? request.body.homepage_sort_order))
    ? Math.floor(Number(request.body.homepageSortOrder ?? request.body.homepage_sort_order))
    : 0;
  await getBlogById(id);
  await query("UPDATE blogs SET show_on_homepage = ?, homepage_sort_order = ? WHERE id = ?", [showOnHomepage ? 1 : 0, homepageSortOrder, id]);
  const blog = await getBlogById(id);
  response.json({ success: true, data: blog });
}

export async function listBlogTags(_request, response) {
  const rows = await query("SELECT id, name, slug, status, created_at AS createdAt, updated_at AS updatedAt FROM blog_tags ORDER BY name ASC");
  response.json({ success: true, data: rows.map(mapTagRow) });
}

export async function listPublicBlogTags(_request, response) {
  const rows = await query("SELECT id, name, slug, status, created_at AS createdAt, updated_at AS updatedAt FROM blog_tags WHERE status = 'active' ORDER BY name ASC");
  response.json({ success: true, data: rows.map(mapTagRow) });
}

export async function createBlogTag(request, response) {
  const name = toNullableString(request.body.name, 120, "Tag name");
  if (!name) throw new ApiError(400, "Tag name is required");
  const slug = slugify(request.body.slug || name);
  await assertUniqueTagSlug(slug);
  const status = normalizeTagStatus(request.body.status);
  const result = await query("INSERT INTO blog_tags (name, slug, status) VALUES (?, ?, ?)", [name, slug, status]);
  const rows = await query("SELECT id, name, slug, status, created_at AS createdAt, updated_at AS updatedAt FROM blog_tags WHERE id = ?", [result.insertId]);
  response.status(201).json({ success: true, data: mapTagRow(rows[0]) });
}

export async function updateBlogTag(request, response) {
  const id = parseId(request.params.id, "tag id");
  const name = toNullableString(request.body.name, 120, "Tag name");
  if (!name) throw new ApiError(400, "Tag name is required");
  const slug = slugify(request.body.slug || name);
  await assertUniqueTagSlug(slug, id);
  const status = normalizeTagStatus(request.body.status);
  const result = await query("UPDATE blog_tags SET name = ?, slug = ?, status = ? WHERE id = ?", [name, slug, status, id]);
  if (!result.affectedRows) throw new ApiError(404, "Blog tag not found");
  const rows = await query("SELECT id, name, slug, status, created_at AS createdAt, updated_at AS updatedAt FROM blog_tags WHERE id = ?", [id]);
  response.json({ success: true, data: mapTagRow(rows[0]) });
}

export async function deleteBlogTag(request, response) {
  const id = parseId(request.params.id, "tag id");
  await query("UPDATE blogs SET tag_id = NULL WHERE tag_id = ?", [id]);
  const result = await query("DELETE FROM blog_tags WHERE id = ?", [id]);
  if (!result.affectedRows) throw new ApiError(404, "Blog tag not found");
  response.json({ success: true, message: "Blog tag deleted" });
}

export async function listHomepageBlogs(_request, response) {
  const { where, values } = buildBlogWhere({ publicOnly: true, homepageOnly: true });
  const rows = await query(`${BLOG_SELECT} ${where} ORDER BY b.homepage_sort_order ASC, b.published_at DESC, b.created_at DESC`, values);
  response.json({ success: true, data: rows.map(mapBlogRow) });
}

export async function listPublicBlogs(request, response) {
  const { where, values } = buildBlogWhere({ ...request.query, publicOnly: true });
  const sort = request.query.sort === "oldest" ? "ASC" : "DESC";
  const rows = await query(`${BLOG_SELECT} ${where} ORDER BY b.published_at ${sort}, b.created_at ${sort}`, values);
  response.json({ success: true, data: rows.map(mapBlogRow) });
}

export async function getPublicBlogBySlug(request, response) {
  const slug = slugify(request.params.slug);
  const rows = await query(
    `${BLOG_SELECT} WHERE b.slug = ? AND b.status = 'active' AND b.deleted_at IS NULL LIMIT 1`,
    [slug]
  );
  if (!rows.length) throw new ApiError(404, "Blog not found");
  response.json({ success: true, data: mapBlogRow(rows[0]) });
}

export async function uploadBlogImage(request, response) {
  if (!request.file) {
    response.status(400).json({
      success: false,
      message: "Blog image file is required"
    });
    return;
  }

  response.status(201).json({
    success: true,
    data: {
      filename: request.file.filename,
      originalName: request.file.originalname,
      mimeType: request.file.mimetype,
      size: request.file.size,
      url: `/uploads/blogs/${request.file.filename}`
    }
  });
}
