import axios from "axios";

const ADMIN_TOKEN_KEY = "avyonaAdminToken";
const ADMIN_LOGGED_OUT_KEY = "avyonaAdminLoggedOut";
const ADMIN_AUTH_EVENT = "avyonaAdminAuthChanged";
const LOCAL_DEV_ADMIN_TOKEN = "local-dev-admin-token";

function getLocalDevAdminToken() {
  if (import.meta.env?.PROD) return "";
  return LOCAL_DEV_ADMIN_TOKEN;
}

function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ADMIN_AUTH_EVENT));
  }
}

export function getAdminToken() {
  if (typeof window === "undefined") return "";
  const storedToken = window.localStorage.getItem(ADMIN_TOKEN_KEY);
  if (storedToken) return storedToken;
  if (window.localStorage.getItem(ADMIN_LOGGED_OUT_KEY) === "true") return "";
  return getLocalDevAdminToken();
}

export function setAdminToken(token) {
  if (typeof window === "undefined") return;
  if (!token) {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    window.localStorage.setItem(ADMIN_LOGGED_OUT_KEY, "true");
    notifyAuthChanged();
    return;
  }

  window.localStorage.removeItem(ADMIN_LOGGED_OUT_KEY);
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
  notifyAuthChanged();
}

export function clearAdminToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  window.localStorage.setItem(ADMIN_LOGGED_OUT_KEY, "true");
  notifyAuthChanged();
}

export function subscribeAdminAuth(listener) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(ADMIN_AUTH_EVENT, listener);
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener(ADMIN_AUTH_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export const adminApi = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:4000/api/v1"
});

adminApi.interceptors.request.use((config) => {
  const token = getAdminToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && getAdminToken()) {
      clearAdminToken();
      if (window.location.pathname !== "/dashboard/login") {
        window.location.assign("/dashboard/login");
      }
    }

    return Promise.reject(error);
  }
);

export function bootstrapAdmin(payload) {
  return adminApi.post("/admin/auth/bootstrap", payload);
}

export async function loginAdmin(payload) {
  const response = await adminApi.post("/admin/auth/login", payload);
  const token = response.data?.data?.token || "";

  if (token) {
    setAdminToken(token);
  }

  return response;
}

export function fetchCurrentAdmin() {
  return adminApi.get("/admin/auth/me");
}

export function fetchBackendHealth() {
  return adminApi.get("/health");
}

export function fetchDeliveryPincodes(params) {
  return adminApi.get("/delivery-pincodes/admin", { params });
}

export function fetchDeliveryPincodeMessageSettings() {
  return adminApi.get("/delivery-pincodes/admin/message-settings");
}

export function updateDeliveryPincodeMessageSettings(payload) {
  return adminApi.put("/delivery-pincodes/admin/message-settings", payload);
}

export function createDeliveryPincode(payload) {
  return adminApi.post("/delivery-pincodes/admin", payload);
}

export function updateDeliveryPincode(id, payload) {
  return adminApi.put(`/delivery-pincodes/admin/${id}`, payload);
}

export function updateDeliveryPincodeStatus(id, status) {
  return adminApi.patch(`/delivery-pincodes/admin/${id}/status`, { status });
}

export function deleteDeliveryPincode(id) {
  return adminApi.delete(`/delivery-pincodes/admin/${id}`);
}

export function bulkUpdateDeliveryPincodes(ids, action) {
  return adminApi.post("/delivery-pincodes/admin/bulk", { ids, action });
}

export function importDeliveryPincodes(file, mode) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", mode);
  return adminApi.post("/delivery-pincodes/admin/import", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
}

export function fetchDashboardSummary(params) {
  return adminApi.get("/dashboard/summary", { params });
}

export function fetchDashboardAnalytics(params) {
  return adminApi.get("/dashboard/analytics", { params });
}

export function fetchAdminSettings() {
  return adminApi.get("/settings");
}

export function updateAdminSettings(payload) {
  return adminApi.put("/settings", payload);
}

export function fetchAdminThemeSettings() {
  return adminApi.get("/admin/theme-settings");
}

export function updateAdminThemeSettings(payload) {
  return adminApi.put("/admin/theme-settings", payload);
}

export function fetchGeneralSettings() {
  return adminApi.get("/settings/general");
}

export function fetchPaymentSettings() {
  return adminApi.get("/settings/payment");
}

export function updatePaymentSettings(payload) {
  return adminApi.put("/settings/payment", payload);
}

export function testPaymentConnection() {
  return adminApi.post("/settings/payment/test-connection");
}

export function updateGeneralSettings(payload) {
  return adminApi.put("/settings/general", payload);
}

export function fetchContactPageSettings() {
  return adminApi.get("/settings/contact-page");
}

export function updateContactPageSettings(payload) {
  return adminApi.put("/settings/contact-page", payload);
}

export function fetchBrowseCategoriesSettings() {
  return adminApi.get("/settings/homepage/browse-categories");
}

export function updateBrowseCategoriesSettings(payload) {
  return adminApi.put("/settings/homepage/browse-categories", payload);
}

export function fetchHomepageSectionSettings(sectionKey) {
  return adminApi.get(`/settings/homepage/sections/${sectionKey}`);
}

export function updateHomepageSectionSettings(sectionKey, payload) {
  return adminApi.put(`/settings/homepage/sections/${sectionKey}`, payload);
}

export function fetchWhyShopHomepage() {
  return adminApi.get("/admin/homepage/why-shop");
}

export function updateWhyShopSettings(payload) {
  return adminApi.put("/admin/homepage/why-shop/settings", payload);
}

export function createWhyShopItem(payload) {
  return adminApi.post("/admin/homepage/why-shop/items", payload);
}

export function updateWhyShopItem(itemId, payload) {
  return adminApi.put(`/admin/homepage/why-shop/items/${encodeURIComponent(itemId)}`, payload);
}

export function deleteWhyShopItem(itemId) {
  return adminApi.delete(`/admin/homepage/why-shop/items/${encodeURIComponent(itemId)}`);
}

export function updateWhyShopItemStatus(itemId, status) {
  return adminApi.patch(`/admin/homepage/why-shop/items/${encodeURIComponent(itemId)}/status`, { status });
}

export function reorderWhyShopItems(orderedIds) {
  return adminApi.patch("/admin/homepage/why-shop/items/reorder", { orderedIds });
}

export function fetchProductPaymentIconsHomepage() {
  return adminApi.get("/admin/homepage/product-payment-icons");
}

export function saveProductPaymentIconsHomepage(payload) {
  return adminApi.put("/admin/homepage/product-payment-icons", payload);
}

export function updateProductPaymentIconSettings(payload) {
  return adminApi.put("/admin/homepage/product-payment-icons/settings", payload);
}

export function createProductPaymentIconItem(payload) {
  return adminApi.post("/admin/homepage/product-payment-icons/items", payload);
}

export function updateProductPaymentIconItem(itemId, payload) {
  return adminApi.put(`/admin/homepage/product-payment-icons/items/${encodeURIComponent(itemId)}`, payload);
}

export function deleteProductPaymentIconItem(itemId) {
  return adminApi.delete(`/admin/homepage/product-payment-icons/items/${encodeURIComponent(itemId)}`);
}

export function updateProductPaymentIconItemStatus(itemId, status) {
  return adminApi.patch(`/admin/homepage/product-payment-icons/items/${encodeURIComponent(itemId)}/status`, { status });
}

export function reorderProductPaymentIconItems(orderedIds) {
  return adminApi.patch("/admin/homepage/product-payment-icons/items/reorder", { orderedIds });
}

export function fetchCreditSummary() {
  return adminApi.get("/admin/credits/summary");
}

export function fetchCreditRules(params) {
  return adminApi.get("/admin/credits/rules", { params });
}

export function createCreditRule(payload) {
  return adminApi.post("/admin/credits/rules", payload);
}

export function updateCreditRule(ruleId, payload) {
  return adminApi.put(`/admin/credits/rules/${ruleId}`, payload);
}

export function updateCreditRuleStatus(ruleId, status) {
  return adminApi.patch(`/admin/credits/rules/${ruleId}/status`, { status });
}

export function deleteCreditRule(ruleId) {
  return adminApi.delete(`/admin/credits/rules/${ruleId}`);
}

export function fetchCreditSettings() {
  return adminApi.get("/admin/credits/settings");
}

export function updateCreditSettings(payload) {
  return adminApi.put("/admin/credits/settings", payload);
}

export function fetchCreditWallets(params) {
  return adminApi.get("/admin/credits/wallets", { params });
}

export function fetchCreditWalletDetails(customerId) {
  return adminApi.get(`/admin/credits/wallets/${customerId}`);
}

export function adjustCreditWallet(customerId, payload) {
  return adminApi.post(`/admin/credits/wallets/${customerId}/adjust`, payload);
}

export function updateCreditWalletBlocked(customerId, isBlocked) {
  return adminApi.patch(`/admin/credits/wallets/${customerId}/block`, { isBlocked });
}

export function resetCreditWallet(customerId, payload = {}) {
  return adminApi.post(`/admin/credits/wallets/${customerId}/reset`, payload);
}

export function fetchCreditTransactions(params) {
  return adminApi.get("/admin/credits/transactions", { params });
}

export function runCreditExpiryJob() {
  return adminApi.post("/admin/credits/expiry/run");
}

export function fetchUpcomingCreditExpirations(params) {
  return adminApi.get("/admin/credits/expiry/upcoming", { params });
}

export function fetchCreditFraudLogs(params) {
  return adminApi.get("/admin/credits/fraud-logs", { params });
}

export function reviewCreditFraudLog(logId) {
  return adminApi.patch(`/admin/credits/fraud-logs/${logId}/review`);
}

export function fetchProducts(params) {
  return adminApi.get("/products", { params });
}

export function fetchProduct(productId) {
  return adminApi.get(`/products/${productId}`);
}

export function createProduct(payload) {
  return adminApi.post("/products", payload);
}

export function upsertInventoryProduct(payload) {
  return adminApi.post("/products/inventory/upsert", payload);
}

export function validateInventoryImport(payload) {
  return adminApi.post("/products/inventory/validate", payload);
}

export function createInventoryImportJob(payload) {
  return adminApi.post("/products/inventory/jobs", payload, {
    headers: { "Content-Type": "multipart/form-data" }
  });
}

export function fetchInventoryImportJob(jobId) {
  return adminApi.get(`/products/inventory/jobs/${jobId}`);
}

export function fetchInventoryImportHistory() {
  return adminApi.get("/products/inventory/history");
}

export function fetchInventoryFailedRows(jobId = "") {
  return jobId
    ? adminApi.get(`/products/inventory/jobs/${jobId}/failed-rows`)
    : adminApi.get("/products/inventory/failed-rows");
}

export function downloadInventoryOriginalFile(jobId) {
  return adminApi.get(`/products/inventory/jobs/${jobId}/original`, { responseType: "blob" });
}

export function retryInventoryFailedRows(jobId, payload = {}) {
  return adminApi.post(`/products/inventory/jobs/${jobId}/retry-failed`, payload);
}

export function startInventoryImportJob(jobId) {
  return adminApi.post(`/products/inventory/jobs/${jobId}/start`);
}

export function cancelInventoryImportJob(jobId) {
  return adminApi.post(`/products/inventory/jobs/${jobId}/cancel`);
}

export function fetchInventoryExportProducts(params) {
  return adminApi.get("/products/inventory/export", { params });
}

export function createInventoryExportJob(payload) {
  return adminApi.post("/products/inventory/export/jobs", payload);
}

export function fetchInventoryExportJob(jobId) {
  return adminApi.get(`/products/inventory/export/jobs/${jobId}`);
}

export function fetchInventoryExportJobs() {
  return adminApi.get("/products/inventory/export/jobs");
}

export function downloadInventoryExportFile(jobId) {
  return adminApi.get(`/products/inventory/export/jobs/${jobId}/download`, { responseType: "blob" });
}

export function updateProduct(productId, payload) {
  return adminApi.patch(`/products/${productId}`, payload);
}

export function deleteProduct(productId) {
  return adminApi.delete(`/products/${productId}`);
}

export function createAdminReview(payload) {
  return adminApi.post("/reviews", payload);
}

export function fetchReviews() {
  return adminApi.get("/reviews");
}

export function updateReview(reviewId, payload) {
  return adminApi.patch(`/reviews/${reviewId}`, payload);
}

export function updateReviewReply(reviewId, adminReply) {
  return adminApi.patch(`/reviews/${reviewId}/reply`, { adminReply });
}

export function updateReviewVisibility(reviewId, visibilityStatus) {
  return adminApi.patch(`/reviews/${reviewId}/visibility`, { visibilityStatus });
}

export function deleteReview(reviewId) {
  return adminApi.delete(`/reviews/${reviewId}`);
}

export function fetchCategories() {
  return adminApi.get("/categories");
}

export function fetchCategory(categoryId) {
  return adminApi.get(`/categories/${categoryId}`);
}

export function createCategory(payload) {
  return adminApi.post("/categories", payload);
}

export function updateCategory(categoryId, payload) {
  return adminApi.put(`/categories/${categoryId}`, payload);
}

export function updateCategoryCod(categoryId, codEnabled) {
  return adminApi.patch(`/categories/${categoryId}/cod`, { codEnabled });
}

export function deleteCategory(categoryId) {
  return adminApi.delete(`/categories/${categoryId}`);
}

export function fetchContactEnquiries(params) {
  return adminApi.get("/contact-enquiries", { params });
}

export function fetchContactEnquiry(enquiryId) {
  return adminApi.get(`/contact-enquiries/${enquiryId}`);
}

export function updateContactEnquiryStatus(enquiryId, status) {
  return adminApi.patch(`/contact-enquiries/${enquiryId}/status`, { status });
}

export function deleteContactEnquiry(enquiryId) {
  return adminApi.delete(`/admin/contact-enquiries/${enquiryId}`);
}

export function fetchOrders() {
  return adminApi.get("/orders");
}

export function fetchAbandonedCheckouts(params) {
  return adminApi.get("/admin/abandoned-checkouts", { params });
}

export function fetchAbandonedCheckout(checkoutId) {
  return adminApi.get(`/admin/abandoned-checkouts/${checkoutId}`);
}

export function updateAbandonedCheckoutStatus(checkoutId, status) {
  return adminApi.patch(`/admin/abandoned-checkouts/${checkoutId}/status`, { status });
}

export function fetchOrder(orderId) {
  return adminApi.get(`/orders/${orderId}`);
}

export function fetchAdminInvoicePreview(withPrint = false) {
  return adminApi.get(`/orders/invoice-preview${withPrint ? "?print=1" : ""}`, { responseType: "text" });
}

export function fetchAdminInvoiceSamplePdf() {
  return adminApi.get("/orders/invoice-preview?pdf=1", { responseType: "blob" });
}

export function fetchCoupons(params) {
  return adminApi.get("/coupons", { params });
}

export function createCoupon(payload) {
  return adminApi.post("/coupons", payload);
}

export function updateCoupon(couponId, payload) {
  return adminApi.put(`/coupons/${couponId}`, payload);
}

export function updateCouponStatus(couponId, status) {
  return adminApi.patch(`/coupons/${couponId}/status`, { status });
}

export function activateCoupon(couponId) {
  return adminApi.patch(`/coupons/${couponId}/activate`);
}

export function deactivateCoupon(couponId) {
  return adminApi.patch(`/coupons/${couponId}/deactivate`);
}

export function deleteCoupon(couponId) {
  return adminApi.delete(`/coupons/${couponId}`);
}

export function uploadCouponBackgroundImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  return adminApi.post("/coupons/background-image", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
}

export function updateOrderTracking(orderId, payload) {
  return adminApi.patch(`/orders/${orderId}/status`, payload);
}

export function fetchVariantGroups() {
  return adminApi.get("/variant-groups");
}

export function createVariantGroup(payload) {
  return adminApi.post("/variant-groups", payload);
}

export function updateVariantGroup(groupId, payload) {
  return adminApi.patch(`/variant-groups/${groupId}`, payload);
}

export function deleteVariantGroup(groupId) {
  return adminApi.delete(`/variant-groups/${groupId}`);
}

export function uploadAdminImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  return adminApi.post("/uploads/image", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
}

export function uploadWhyShopIcon(file) {
  const formData = new FormData();
  formData.append("icon", file);

  return adminApi.post("/admin/homepage/why-shop/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
}

export function uploadPaymentIcon(file) {
  const formData = new FormData();
  formData.append("icon", file);

  return adminApi.post("/admin/homepage/product-payment-icons/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
}

export function uploadSettingsAsset(file, assetType) {
  const formData = new FormData();
  if (assetType) formData.append("assetType", assetType);
  formData.append("asset", file);
  const queryString = assetType ? `?assetType=${encodeURIComponent(assetType)}` : "";

  return adminApi.post(`/settings/upload${queryString}`, formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
}

export function uploadFooterImage(file, assetType) {
  const formData = new FormData();
  if (assetType) formData.append("assetType", assetType);
  formData.append("image", file);
  const queryString = assetType ? `?assetType=${encodeURIComponent(assetType)}` : "";

  return adminApi.post(`/admin/footer/upload${queryString}`, formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
}

export function fetchWebsiteImages() {
  return adminApi.get("/uploads/images");
}

export function updateWebsiteImage(payload) {
  return adminApi.patch("/uploads/images", payload);
}

export function deleteWebsiteImage(url) {
  return adminApi.delete("/uploads/images", { data: { url } });
}

export function uploadAdminMedia(file) {
  const formData = new FormData();
  formData.append("media", file);

  return adminApi.post("/uploads/media", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
}
