const API_MEDIA_ORIGIN = (import.meta.env?.VITE_API_BASE_URL || "http://localhost:4000/api/v1")
  .replace(/\/api\/v\d+\/?$/i, "")
  .replace(/\/$/, "");
const STOREFRONT_MEDIA_ORIGIN = (import.meta.env?.VITE_STOREFRONT_URL || "http://localhost:5173")
  .replace(/\/$/, "");

export function toStoredUploadUrl(value) {
  const url = String(value || "").trim();
  const localUploadMatch = url.match(/^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.\d+\.\d+):4000(\/uploads\/.*)$/i);
  if (localUploadMatch) return localUploadMatch[1];
  return url;
}

export function resolveAdminMediaUrl(value, fallback = "") {
  const url = toStoredUploadUrl(value);
  if (!url) return fallback;
  if (/^(data|blob):/i.test(url)) return url;
  if (url.startsWith("/uploads/")) return `${API_MEDIA_ORIGIN}${url}`;
  if (url.startsWith("/images/")) return `${STOREFRONT_MEDIA_ORIGIN}${url}`;
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith("/") ? url : `/${url}`;
}
