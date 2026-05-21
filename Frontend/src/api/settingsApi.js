const settingsCache = new Map();
const CACHE_TTL_MS = 0;

async function fetchCachedJson(url, errorMessage) {
  const cached = settingsCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(errorMessage);
  }

  const data = await response.json();
  settingsCache.set(url, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

export async function fetchPublicSettings() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api/v1";
  return fetchCachedJson(`${apiBaseUrl}/settings/public`, "Unable to fetch public settings");
}

export async function fetchPublicFooter() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api/v1";
  return fetchCachedJson(`${apiBaseUrl}/footer`, "Unable to fetch footer settings");
}

export async function fetchGeneralSettings() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api/v1";
  return fetchCachedJson(`${apiBaseUrl}/settings/general`, "Unable to fetch general settings");
}

export async function fetchPublicBrowseCategoriesSettings() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api/v1";
  return fetchCachedJson(`${apiBaseUrl}/settings/public/homepage/browse-categories`, "Unable to fetch Browse Categories settings");
}
