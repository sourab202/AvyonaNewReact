const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api/v1";
const blogCache = new Map();
const CACHE_TTL_MS = 60_000;

async function fetchCachedBlogJson(url, message) {
  const cached = blogCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(message);
  }

  const data = await response.json();
  blogCache.set(url, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

export function fetchHomepageBlogs() {
  return fetchCachedBlogJson(`${API_BASE_URL}/blogs/homepage`, "Unable to fetch homepage blogs");
}

export function fetchStorefrontBlogs(params = {}) {
  const searchParams = new URLSearchParams(params);
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return fetchCachedBlogJson(`${API_BASE_URL}/blogs${suffix}`, "Unable to fetch blogs");
}

export function fetchStorefrontBlog(slug) {
  return fetchCachedBlogJson(`${API_BASE_URL}/blogs/${encodeURIComponent(slug)}`, "Unable to fetch blog");
}

export function fetchStorefrontBlogTags() {
  return fetchCachedBlogJson(`${API_BASE_URL}/blog-tags`, "Unable to fetch blog tags");
}
