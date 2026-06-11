const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api/v1";
const CUSTOMER_TOKEN_KEY = "avyonaCustomerToken";

async function abandonedCheckoutRequest(path, options = {}) {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(CUSTOMER_TOKEN_KEY) : "";
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Unable to save checkout");
  return body;
}

export function captureAbandonedCheckout(payload) {
  return abandonedCheckoutRequest("/abandoned-checkouts/capture", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function recoverAbandonedCheckout(checkoutToken) {
  return abandonedCheckoutRequest(`/abandoned-checkouts/${encodeURIComponent(checkoutToken)}/recover`, {
    method: "POST"
  });
}
