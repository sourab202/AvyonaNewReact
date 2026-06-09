import { query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";

export const GST_NUMBER_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;

export function normalizeBusinessDetails(payload = {}) {
  const businessAccount = Boolean(payload.businessAccount || payload.isBusinessAccount || payload.businessName || payload.gstNumber);
  const businessName = String(payload.businessName || "").trim();
  const gstNumber = String(payload.gstNumber || "").trim().toUpperCase();

  if (gstNumber && !GST_NUMBER_PATTERN.test(gstNumber)) {
    throw new ApiError(400, "GST Number format is invalid.");
  }

  return { businessAccount, businessName, gstNumber };
}

export function publicBusinessDetails(row = {}) {
  const businessName = String(row.businessName || row.business_name || "").trim();
  const gstNumber = String(row.gstNumber || row.gst_number || "").trim().toUpperCase();
  const isBusinessAccount = Boolean(row.isBusinessAccount || row.is_business_account || row.businessAccount || row.business_account || businessName || gstNumber);

  return { isBusinessAccount, businessName, gstNumber };
}

export async function ensureCustomerBusinessDetailsTable(executor = null) {
  const run = executor?.execute
    ? (sql, params = []) => executor.execute(sql, params)
    : (sql, params = []) => query(sql, params);

  await run(
    `CREATE TABLE IF NOT EXISTS customer_business_details (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      customer_id INT UNSIGNED NOT NULL,
      is_business_account TINYINT(1) NOT NULL DEFAULT 0,
      business_name VARCHAR(180) NULL,
      gst_number VARCHAR(20) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_customer_business_customer (customer_id),
      INDEX idx_customer_business_gst (gst_number),
      CONSTRAINT fk_customer_business_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )`
  );
}

export async function getCustomerBusinessDetails(customerId, executor = null) {
  if (!customerId) return publicBusinessDetails();
  await ensureCustomerBusinessDetailsTable(executor);

  const run = executor?.execute
    ? (sql, params = []) => executor.execute(sql, params).then(([rows]) => rows)
    : (sql, params = []) => query(sql, params);

  const rows = await run(
    `SELECT
      is_business_account AS isBusinessAccount,
      business_name AS businessName,
      gst_number AS gstNumber
     FROM customer_business_details
     WHERE customer_id = ?
     LIMIT 1`,
    [customerId]
  );

  return publicBusinessDetails(rows[0]);
}

export async function saveCustomerBusinessDetails(customerId, payload = {}, executor = null) {
  if (!customerId) return publicBusinessDetails();
  const details = normalizeBusinessDetails(payload);
  await ensureCustomerBusinessDetailsTable(executor);

  const run = executor?.execute
    ? (sql, params = []) => executor.execute(sql, params)
    : (sql, params = []) => query(sql, params);

  const shouldKeep = details.businessAccount || details.businessName || details.gstNumber;

  if (!shouldKeep) {
    await run("DELETE FROM customer_business_details WHERE customer_id = ?", [customerId]);
    return publicBusinessDetails();
  }

  await run(
    `INSERT INTO customer_business_details
      (customer_id, is_business_account, business_name, gst_number)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      is_business_account = VALUES(is_business_account),
      business_name = VALUES(business_name),
      gst_number = VALUES(gst_number)`,
    [
      customerId,
      details.businessAccount ? 1 : 0,
      details.businessName || null,
      details.gstNumber || null
    ]
  );

  return publicBusinessDetails(details);
}

export async function ensureOrderBusinessDetailsTable(executor = null) {
  const run = executor?.execute
    ? (sql, params = []) => executor.execute(sql, params)
    : (sql, params = []) => query(sql, params);

  await run(
    `CREATE TABLE IF NOT EXISTS order_business_details (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      order_id INT UNSIGNED NOT NULL,
      customer_id INT UNSIGNED NULL,
      business_name VARCHAR(180) NULL,
      gst_number VARCHAR(20) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_order_business_order (order_id),
      INDEX idx_order_business_customer (customer_id),
      CONSTRAINT fk_order_business_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      CONSTRAINT fk_order_business_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    )`
  );
}

export async function saveOrderBusinessDetails(orderId, customerId, payload = {}, executor = null) {
  if (!orderId) return publicBusinessDetails();
  const details = normalizeBusinessDetails(payload);
  if (!details.businessName && !details.gstNumber) return publicBusinessDetails();

  await ensureOrderBusinessDetailsTable(executor);
  const run = executor?.execute
    ? (sql, params = []) => executor.execute(sql, params)
    : (sql, params = []) => query(sql, params);

  await run(
    `INSERT INTO order_business_details
      (order_id, customer_id, business_name, gst_number)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      customer_id = VALUES(customer_id),
      business_name = VALUES(business_name),
      gst_number = VALUES(gst_number)`,
    [orderId, customerId || null, details.businessName || null, details.gstNumber || null]
  );

  return publicBusinessDetails(details);
}
