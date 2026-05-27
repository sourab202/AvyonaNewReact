const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api/v1";

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || "Unable to fetch custom page");
    error.status = response.status;
    throw error;
  }

  return payload;
}

export function fetchCustomPage(slug, { preview = false } = {}) {
  const suffix = preview ? "?preview=true" : "";
  return fetchJson(`${API_BASE_URL}/pages/${encodeURIComponent(slug)}${suffix}`);
}

export function fetchHeaderPages() {
  return fetchJson(`${API_BASE_URL}/pages/navigation/header`);
}

export function fetchFooterPages() {
  return fetchJson(`${API_BASE_URL}/pages/navigation/footer`);
}
