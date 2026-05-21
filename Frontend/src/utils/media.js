const API_MEDIA_ORIGIN = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api/v1")
  .replace(/\/api\/v\d+\/?$/i, "")
  .replace(/\/$/, "");

export function resolveMediaUrl(value, fallback = "") {
  const url = String(value || "").trim();
  if (!url) return fallback;
  if (/^(data|blob):/i.test(url)) return url;

  const localUploadMatch = url.match(/^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.\d+\.\d+):4000(\/uploads\/.*)$/i);
  if (localUploadMatch) return `${API_MEDIA_ORIGIN}${localUploadMatch[1]}`;

  if (url.startsWith("/uploads/")) return `${API_MEDIA_ORIGIN}${url}`;
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith("/") ? url : `/${url}`;
}

export function resolveMediaList(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((value) => resolveMediaUrl(value))
    .filter(Boolean);
}
