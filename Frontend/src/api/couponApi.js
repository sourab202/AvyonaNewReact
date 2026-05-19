import { getCustomerToken } from "./customerApi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api/v1";
const couponCache = new Map();
const CACHE_TTL_MS = 60_000;

export async function fetchStorefrontCoupons(params = {}) {
  const searchParams = new URLSearchParams(params);
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const url = `${API_BASE_URL}/coupons${suffix}`;
  const cached = couponCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Unable to fetch coupons");
  }

  const data = await response.json();
  couponCache.set(url, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

export async function fetchHomepageOffers() {
  return fetchCachedCouponJson(`${API_BASE_URL}/coupons/homepage-offers`, "Unable to fetch homepage offers");
}

export async function fetchProductPageOffers(params = {}) {
  const searchParams = new URLSearchParams(params);
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return fetchCachedCouponJson(`${API_BASE_URL}/coupons/product-page-offers${suffix}`, "Unable to fetch product page offers");
}

export async function fetchProductOffers(params = {}) {
  const searchParams = new URLSearchParams(params);
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return fetchCachedCouponJson(`${API_BASE_URL}/coupons/product-offers${suffix}`, "Unable to fetch product offers");
}

export async function validateCheckoutCoupon(payload) {
  const token = getCustomerToken();
  const response = await fetch(`${API_BASE_URL}/coupons/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.valid === false) {
    const error = new Error(data.message || "Unable to validate coupon");
    error.data = data;
    throw error;
  }

  return data;
}

async function fetchCachedCouponJson(url, message) {
  const cached = couponCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(message);
  }

  const data = await response.json();
  couponCache.set(url, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}
