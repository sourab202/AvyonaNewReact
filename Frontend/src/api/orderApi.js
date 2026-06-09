const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api/v1";
const CUSTOMER_TOKEN_KEY = "avyonaCustomerToken";

async function orderRequest(path, options = {}) {
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
  if (!response.ok) {
    const error = new Error(body.message || "Unable to process order request");
    error.status = response.status;
    error.data = body;
    throw error;
  }
  return body;
}

export async function createStorefrontOrder(payload) {
  return orderRequest("/orders", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createRazorpayPaymentOrder(payload) {
  return orderRequest("/orders/payment/razorpay/order", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function verifyRazorpayPayment(payload) {
  return orderRequest("/orders/payment/razorpay/verify", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getRazorpayPaymentStatus(payload) {
  const params = new URLSearchParams();
  if (payload.orderId) params.set("orderId", payload.orderId);
  if (payload.orderNumber) params.set("orderNumber", payload.orderNumber);
  if (payload.contact) params.set("contact", payload.contact);
  return orderRequest(`/orders/payment/razorpay/status?${params.toString()}`, {
    method: "GET"
  });
}

export function loadRazorpayCheckout() {
  if (typeof window === "undefined") return Promise.reject(new Error("Payment checkout is unavailable"));
  if (window.Razorpay) return Promise.resolve(window.Razorpay);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-avyona-razorpay="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Razorpay), { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load Razorpay checkout")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.avyonaRazorpay = "true";
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error("Unable to load Razorpay checkout"));
    document.head.appendChild(script);
  });
}

export async function launchRazorpayCheckout(options) {
  const Razorpay = await loadRazorpayCheckout();

  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };
    const checkout = new Razorpay({
      ...options,
      handler: (paymentResponse) => settle(resolve, paymentResponse),
      modal: {
        ondismiss: () => settle(reject, new Error("Payment window was closed before completion"))
      }
    });

    checkout.on("payment.failed", (failure) => {
      settle(
        reject,
        new Error(failure?.error?.description || failure?.error?.reason || "Payment failed")
      );
    });
    checkout.open();
  });
}

export async function trackStorefrontOrder(payload) {
  const response = await fetch(`${API_BASE_URL}/orders/track`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || "Unable to track order");
  }

  return response.json();
}
