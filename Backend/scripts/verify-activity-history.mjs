import fs from "node:fs/promises";
import { pool, query } from "../config/db.js";
import { logActivity } from "../services/activityLogger.js";

const baseUrl = process.env.API_BASE_URL || "http://localhost:4000/api/v1";
const superToken = process.env.ADMIN_TEST_TOKEN || "local-dev-admin-token";
const stamp = Date.now();
const password = "AuditHistory123!";
const adminEmail = `audit-admin-${stamp}@avyona.local`;
const viewerEmail = `audit-viewer-${stamp}@avyona.local`;
const testMarker = `audit-test-${stamp}`;
const startedAt = new Date();
const results = [];
const createdAdminIds = [];
const createdLogIds = [];
let productId;

function check(label, condition) {
  results.push({ label, passed: Boolean(condition) });
  if (!condition) throw new Error(label);
}

async function api(path, { token = superToken, ...options } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  return { response, payload: await response.json().catch(() => ({})) };
}

async function createUser(role, email) {
  const result = await api("/admin/access/users", {
    method: "POST",
    body: JSON.stringify({ mode: "manual", fullName: `Audit ${role}`, email, role, password })
  });
  check(`${role} test user created`, result.response.status === 201);
  createdAdminIds.push(result.payload.data.user.id);
  const login = await api("/admin/auth/login", {
    token: "",
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  check(`${role} login succeeds`, login.response.ok && Boolean(login.payload.data?.token));
  return login.payload.data.token;
}

try {
  const adminToken = await createUser("admin", adminEmail);
  const viewerToken = await createUser("viewer", viewerEmail);

  const superView = await api("/admin/activity-logs?limit=10");
  check("Super Admin can view activity history", superView.response.ok);
  const adminView = await api("/admin/activity-logs?limit=10", { token: adminToken });
  check("Admin can view activity history", adminView.response.ok);
  const viewerView = await api("/admin/activity-logs?limit=10", { token: viewerToken });
  check("Viewer API access is blocked", viewerView.response.status === 403);
  check("Viewer receives the required permission message", viewerView.payload.message === "You do not have permission to view activity history.");

  const categories = await api("/categories");
  const category = categories.payload.data?.[0];
  check("A category is available for product testing", Boolean(category?.id));

  const created = await api("/products", {
    method: "POST",
    body: JSON.stringify({
      categoryId: category.id,
      asin: `AUDIT${stamp}`,
      sku: `AUDIT-${stamp}`,
      name: `Audit Product ${stamp}`,
      brand: "Avyona QA",
      price: 100,
      mrp: 120,
      status: "draft"
    })
  });
  check("Product creation succeeds", created.response.status === 201);
  productId = created.payload.data?.id;

  const updated = await api(`/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify({ price: 90 })
  });
  check("Product update succeeds", updated.response.ok);
  const statusUpdated = await api(`/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "active" })
  });
  check("Product status update succeeds", statusUpdated.response.ok);
  const deleted = await api(`/products/${productId}`, { method: "DELETE" });
  check("Product soft delete succeeds", deleted.response.ok);

  const codOriginal = Boolean(category.codEnabled);
  const codChanged = await api(`/categories/${category.id}/cod`, {
    method: "PATCH",
    body: JSON.stringify({ codEnabled: !codOriginal })
  });
  check("Category COD change succeeds", codChanged.response.ok);
  await api(`/categories/${category.id}/cod`, {
    method: "PATCH",
    body: JSON.stringify({ codEnabled: codOriginal })
  });

  const payment = await api("/settings/payment");
  const paymentSaved = await api("/settings/payment", {
    method: "PUT",
    body: JSON.stringify({ settings: payment.payload.data })
  });
  check("Payment settings update succeeds", paymentSaved.response.ok);

  await api("/admin/auth/login", {
    token: "",
    method: "POST",
    body: JSON.stringify({ email: adminEmail, password: "definitely-wrong" })
  });

  await logActivity({
    request: {
      admin: { id: createdAdminIds[0], fullName: "Audit Admin", email: adminEmail, role: "admin" },
      headers: { "user-agent": "Avyona audit test" },
      ip: "127.0.0.1"
    },
    action: "permission_changed",
    module: "users_access",
    entityType: "test",
    entityName: testMarker,
    oldValues: { api_key: "old-secret", nested: { password: "old-password" } },
    newValues: { api_key: "new-secret", nested: { password: "new-password" } },
    description: "Sensitive masking integration test"
  });

  const requiredActions = [
    "product_updated", "product_status_changed", "product_deleted", "category_cod_changed",
    "razorpay_settings_updated", "login_success", "login_failed"
  ];
  const rows = await query(
    `SELECT id, action, old_values AS oldValues, new_values AS newValues
     FROM activity_logs
     WHERE created_at >= ?
       AND ((entity_id = ? AND entity_type = 'product')
        OR entity_name = ?
        OR admin_email IN (?, ?)
        OR action IN ('category_cod_changed', 'razorpay_settings_updated', 'cod_global_changed'))
     ORDER BY id DESC`,
    [startedAt, String(productId), testMarker, adminEmail, viewerEmail]
  );
  createdLogIds.push(...rows.map((row) => row.id));
  for (const action of requiredActions) {
    check(`${action} creates an activity record`, rows.some((row) => row.action === action));
  }
  const masked = rows.find((row) => row.action === "permission_changed" && String(row.newValues).includes("***masked***"));
  check("Sensitive old and new values are masked", Boolean(masked) && !String(masked.newValues).includes("new-secret"));

  const menuSource = await fs.readFile(new URL("../../Dashboard/src/components/layout/Sidebar.jsx", import.meta.url), "utf8");
  check("Activity History menu is restricted to Admin and Super Admin", menuSource.includes('roles: ["admin", "super_admin"]'));

  console.table(results);
  console.log(`Activity History verification passed (${results.length}/${results.length}).`);
} finally {
  if (productId) {
    await query("DELETE FROM product_media_assets WHERE product_id = ?", [productId]).catch(() => undefined);
    await query("DELETE FROM products WHERE id = ?", [productId]).catch(() => undefined);
  }
  for (const id of createdAdminIds.reverse()) {
    await query("DELETE FROM admins WHERE id = ?", [id]).catch(() => undefined);
  }
  await query(
    `DELETE FROM activity_logs
     WHERE entity_name = ? OR admin_email IN (?, ?) OR (entity_id = ? AND entity_type = 'product')`,
    [testMarker, adminEmail, viewerEmail, String(productId || "")]
  ).catch(() => undefined);
  if (createdLogIds.length) {
    await query(`DELETE FROM activity_logs WHERE id IN (${createdLogIds.map(() => "?").join(",")})`, createdLogIds).catch(() => undefined);
  }
  await pool.end();
}
