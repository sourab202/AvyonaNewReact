const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api/v1";
const responseCache = new Map();
const DEFAULT_CACHE_TTL_MS = 60_000;

async function fetchJson(url, { cacheTtl = DEFAULT_CACHE_TTL_MS } = {}) {
  const now = Date.now();
  const cached = responseCache.get(url);
  if (cached && cached.expiresAt > now) return cached.data;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Unable to fetch products");
  }

  const data = await response.json();
  responseCache.set(url, { data, expiresAt: now + cacheTtl });
  return data;
}

export async function fetchStorefrontProducts(params = {}) {
  const searchParams = new URLSearchParams(params);
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return fetchJson(`${API_BASE_URL}/products${suffix}`);
}

export async function fetchStorefrontProduct(productId) {
  return fetchJson(`${API_BASE_URL}/products/${encodeURIComponent(productId)}`);
}

export async function checkDeliveryPincode(pincode) {
  const response = await fetch(`${API_BASE_URL}/delivery-pincodes/check/${encodeURIComponent(pincode)}?_=${Date.now()}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Unable to check delivery availability");
  }

  return response.json();
}

export async function fetchStorefrontProductReviews(productId, token = "", params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const response = await fetch(`${API_BASE_URL}/reviews/product/${encodeURIComponent(productId)}${suffix}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    throw new Error("Unable to fetch product reviews");
  }

  return response.json();
}

export async function fetchProductReviewSummary(productId) {
  const response = await fetch(`${API_BASE_URL}/reviews/product/${encodeURIComponent(productId)}/summary`);

  if (!response.ok) {
    throw new Error("Unable to fetch product review summary");
  }

  return response.json();
}

export async function fetchProductReviewMediaGallery(productId, token = "") {
  const response = await fetch(`${API_BASE_URL}/reviews/product/${encodeURIComponent(productId)}/media`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    throw new Error("Unable to fetch product review media");
  }

  return response.json();
}

export async function submitGuestReview(payload) {
  const response = await fetch(`${API_BASE_URL}/reviews/guest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Unable to submit guest review");
  }

  return response.json();
}

export async function uploadGuestReviewMedia(file) {
  const formData = new FormData();
  formData.append("media", file);

  const response = await fetch(`${API_BASE_URL}/reviews/media`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Unable to upload review media");
  }

  return response.json();
}
