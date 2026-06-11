import { query } from "../config/db.js";
import { expireAbandonedCheckouts } from "../services/abandonedCheckoutService.js";
import { ApiError } from "../utils/apiError.js";

const VALID_STATUSES = new Set(["active", "recovered", "expired", "cancelled"]);
const VALID_RECOVERY_STATUSES = new Set(["not_sent", "sent", "clicked", "recovered"]);

function text(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength) || null;
}

function jsonValue(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

function serialize(value) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function normalizeCheckout(row) {
  if (!row) return null;
  return {
    ...row,
    subtotal: Number(row.subtotal || 0),
    totalAmount: Number(row.totalAmount || 0),
    cartItems: jsonValue(row.cartItems, []),
    shippingAddress: jsonValue(row.shippingAddress),
    billingAddress: jsonValue(row.billingAddress),
    eventData: jsonValue(row.eventData)
  };
}

function clientIp(request) {
  return text(request.headers["x-forwarded-for"]?.split(",")[0] || request.ip || request.socket?.remoteAddress, 80);
}

function storefrontBaseUrl(request) {
  return text(process.env.STOREFRONT_URL || request.headers.origin || "http://localhost:5173", 400)?.replace(/\/+$/, "");
}

async function addEventOnce(checkoutId, eventType, eventData = null) {
  const existing = await query(
    `SELECT id FROM abandoned_checkout_events
     WHERE abandoned_checkout_id = ? AND event_type = ?
     LIMIT 1`,
    [checkoutId, eventType]
  );
  if (existing[0]) return;
  await query(
    `INSERT INTO abandoned_checkout_events (abandoned_checkout_id, event_type, event_data)
     VALUES (?, ?, ?)`,
    [checkoutId, eventType, serialize(eventData)]
  );
}

export async function captureAbandonedCheckout(request, response) {
  const payload = request.body || {};
  const checkoutToken = text(payload.checkoutToken || payload.checkout_token, 120);
  const cartItems = Array.isArray(payload.cartItems || payload.cart_items)
    ? (payload.cartItems || payload.cart_items)
    : [];
  if (!checkoutToken) throw new ApiError(400, "checkout_token is required");
  if (!cartItems.length) throw new ApiError(400, "Cart items are required");

  const customer = payload.customer || {};
  const customerName = text(payload.customerName || customer.fullName || [customer.firstName, customer.lastName].filter(Boolean).join(" "), 180);
  const contact = text(customer.contact, 180);
  const email = text(payload.email || customer.email || (contact?.includes("@") ? contact : null), 180);
  const phone = text(payload.phone || customer.phone || (!contact?.includes("@") ? contact : null), 40);
  const shippingAddress = payload.shippingAddress ?? payload.shipping_address ?? null;
  const billingAddress = payload.billingAddress ?? payload.billing_address ?? null;
  const paymentMethod = text(payload.paymentMethod || payload.payment_method, 60);
  const recoveryUrl = `${storefrontBaseUrl(request)}/checkout?recover=${encodeURIComponent(checkoutToken)}`;
  const deviceInfo = text(payload.deviceInfo || payload.device_info, 255);
  const source = text(payload.source, 80) || "website";
  const userAgent = text(request.headers["user-agent"], 2000);

  await query(
    `INSERT INTO abandoned_checkouts
      (checkout_token, customer_id, customer_name, email, phone, cart_items, subtotal,
       total_amount, currency, shipping_address, billing_address, payment_method,
       recovery_url, source, device_info, ip_address, user_agent, last_activity_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       customer_id = COALESCE(VALUES(customer_id), customer_id),
       customer_name = COALESCE(VALUES(customer_name), customer_name),
       email = COALESCE(VALUES(email), email),
       phone = COALESCE(VALUES(phone), phone),
       cart_items = VALUES(cart_items),
       subtotal = VALUES(subtotal),
       total_amount = VALUES(total_amount),
       currency = VALUES(currency),
       shipping_address = COALESCE(VALUES(shipping_address), shipping_address),
       billing_address = COALESCE(VALUES(billing_address), billing_address),
       payment_method = COALESCE(VALUES(payment_method), payment_method),
       recovery_url = VALUES(recovery_url),
       source = VALUES(source),
       device_info = COALESCE(VALUES(device_info), device_info),
       ip_address = VALUES(ip_address),
       user_agent = VALUES(user_agent),
       last_activity_at = NOW(),
       status = CASE WHEN status = 'expired' THEN 'active' ELSE status END`,
    [
      checkoutToken,
      request.customer?.id || null,
      customerName,
      email,
      phone,
      serialize(cartItems),
      Number(payload.subtotal || 0),
      Number(payload.totalAmount ?? payload.total_amount ?? payload.subtotal ?? 0),
      text(payload.currency, 10) || "INR",
      serialize(shippingAddress),
      serialize(billingAddress),
      paymentMethod,
      recoveryUrl,
      source,
      deviceInfo,
      clientIp(request),
      userAgent
    ]
  );
  const rows = await query(
    "SELECT id, status, recovery_status AS recoveryStatus, recovery_url AS recoveryUrl FROM abandoned_checkouts WHERE checkout_token = ? LIMIT 1",
    [checkoutToken]
  );
  const checkout = rows[0];
  await addEventOnce(checkout.id, "checkout_started", { itemCount: cartItems.length });
  if (email || phone) await addEventOnce(checkout.id, "customer_info_added");
  if (shippingAddress && Object.keys(shippingAddress).some((key) => String(shippingAddress[key] || "").trim())) {
    await addEventOnce(checkout.id, "shipping_address_added");
  }
  if (paymentMethod) await addEventOnce(checkout.id, "payment_method_selected", { paymentMethod });

  response.status(201).json({ success: true, data: checkout });
}

export async function recoverAbandonedCheckout(request, response) {
  await expireAbandonedCheckouts();
  const token = text(request.params.token, 120);
  const rows = await query(
    `SELECT id, checkout_token AS checkoutToken, customer_id AS customerId,
            customer_name AS customerName, email, phone, cart_items AS cartItems,
            subtotal, total_amount AS totalAmount, currency,
            shipping_address AS shippingAddress, billing_address AS billingAddress,
            payment_method AS paymentMethod, status, recovery_status AS recoveryStatus,
            recovery_url AS recoveryUrl, source, last_activity_at AS lastActivityAt,
            created_at AS createdAt, recovered_at AS recoveredAt, order_id AS orderId
     FROM abandoned_checkouts WHERE checkout_token = ? LIMIT 1`,
    [token]
  );
  if (!rows[0]) throw new ApiError(404, "Abandoned checkout was not found");
  if (rows[0].status === "cancelled") throw new ApiError(410, "This checkout recovery link is no longer active");

  await query(
    `UPDATE abandoned_checkouts
     SET recovery_status = CASE WHEN status = 'recovered' THEN 'recovered' ELSE 'clicked' END,
         last_activity_at = NOW()
     WHERE id = ?`,
    [rows[0].id]
  );
  await query(
    `INSERT INTO abandoned_checkout_events (abandoned_checkout_id, event_type, event_data)
     VALUES (?, 'recovery_link_clicked', ?)`,
    [rows[0].id, serialize({ userAgent: text(request.headers["user-agent"], 500) })]
  );

  response.json({
    success: true,
    data: normalizeCheckout({ ...rows[0], recoveryStatus: rows[0].status === "recovered" ? "recovered" : "clicked" })
  });
}

export async function markAbandonedCheckoutRecovered(request, response) {
  const checkoutToken = text(request.body?.checkoutToken || request.body?.checkout_token, 120);
  const orderId = Number(request.body?.orderId || request.body?.order_id || 0);
  if (!checkoutToken || !orderId) throw new ApiError(400, "checkout_token and order_id are required");
  const orders = await query("SELECT id FROM orders WHERE id = ? LIMIT 1", [orderId]);
  if (!orders[0]) throw new ApiError(404, "Order was not found");
  const result = await query(
    `UPDATE abandoned_checkouts
     SET status = 'recovered', recovery_status = 'recovered', order_id = ?,
         recovered_at = NOW(), last_activity_at = NOW()
     WHERE checkout_token = ?
       AND order_id = ?
       AND status <> 'cancelled'`,
    [orderId, checkoutToken, orderId]
  );
  if (!result.affectedRows) throw new ApiError(404, "Abandoned checkout was not found");
  const rows = await query("SELECT id FROM abandoned_checkouts WHERE checkout_token = ? LIMIT 1", [checkoutToken]);
  await addEventOnce(rows[0].id, "order_recovered", { orderId });
  response.json({ success: true, message: "Checkout marked as recovered" });
}

export async function listAdminAbandonedCheckouts(request, response) {
  await expireAbandonedCheckouts();
  const page = Math.max(1, Number(request.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(request.query.limit || 20)));
  const filters = [];
  const values = [];
  const status = text(request.query.status, 40);
  const recoveryStatus = text(request.query.recoveryStatus || request.query.recovery_status, 40);
  const search = text(request.query.search, 180);
  if (status && VALID_STATUSES.has(status)) {
    filters.push("ac.status = ?");
    values.push(status);
  }
  if (recoveryStatus && VALID_RECOVERY_STATUSES.has(recoveryStatus)) {
    filters.push("ac.recovery_status = ?");
    values.push(recoveryStatus);
  }
  if (search) {
    filters.push("(ac.customer_name LIKE ? OR ac.email LIKE ? OR ac.phone LIKE ? OR ac.checkout_token LIKE ?)");
    values.push(...Array(4).fill(`%${search}%`));
  }
  if (request.query.startDate) {
    filters.push("ac.created_at >= ?");
    values.push(request.query.startDate);
  }
  if (request.query.endDate) {
    filters.push("ac.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    values.push(request.query.endDate);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const countRows = await query(`SELECT COUNT(*) AS total FROM abandoned_checkouts ac ${where}`, values);
  const rows = await query(
    `SELECT ac.id, ac.checkout_token AS checkoutToken, ac.customer_name AS customerName,
            ac.email, ac.phone, ac.cart_items AS cartItems, ac.subtotal,
            ac.total_amount AS totalAmount, ac.currency, ac.status,
            ac.recovery_status AS recoveryStatus, ac.recovery_url AS recoveryUrl,
            ac.payment_method AS paymentMethod, ac.last_activity_at AS lastActivityAt,
            ac.created_at AS createdAt, ac.recovered_at AS recoveredAt,
            ac.order_id AS orderId, o.order_number AS orderNumber
     FROM abandoned_checkouts ac
     LEFT JOIN orders o ON o.id = ac.order_id
     ${where}
     ORDER BY COALESCE(ac.last_activity_at, ac.created_at) DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, (page - 1) * limit]
  );
  const summaryRows = await query(
    `SELECT COUNT(*) AS total,
            SUM(status = 'active') AS active,
            SUM(status = 'recovered') AS recovered,
            COALESCE(SUM(CASE WHEN status <> 'recovered' THEN total_amount ELSE 0 END), 0) AS abandonedValue,
            COALESCE(SUM(CASE WHEN status = 'recovered' THEN total_amount ELSE 0 END), 0) AS recoveredValue
     FROM abandoned_checkouts`
  );
  const summary = summaryRows[0] || {};
  response.json({
    success: true,
    data: {
      rows: rows.map(normalizeCheckout),
      pagination: { page, limit, total: Number(countRows[0]?.total || 0), totalPages: Math.max(1, Math.ceil(Number(countRows[0]?.total || 0) / limit)) },
      summary: {
        total: Number(summary.total || 0),
        active: Number(summary.active || 0),
        recovered: Number(summary.recovered || 0),
        recoveryRate: Number(summary.total || 0) ? Math.round((Number(summary.recovered || 0) / Number(summary.total)) * 100) : 0,
        abandonedValue: Number(summary.abandonedValue || 0),
        recoveredValue: Number(summary.recoveredValue || 0)
      }
    }
  });
}

export async function getAdminAbandonedCheckout(request, response) {
  const rows = await query(
    `SELECT ac.id, ac.checkout_token AS checkoutToken, ac.customer_id AS customerId,
            ac.customer_name AS customerName, ac.email, ac.phone, ac.cart_items AS cartItems,
            ac.subtotal, ac.total_amount AS totalAmount, ac.currency,
            ac.shipping_address AS shippingAddress, ac.billing_address AS billingAddress,
            ac.payment_method AS paymentMethod, ac.status,
            ac.recovery_status AS recoveryStatus, ac.recovery_url AS recoveryUrl,
            ac.source, ac.device_info AS deviceInfo, ac.ip_address AS ipAddress,
            ac.user_agent AS userAgent, ac.last_activity_at AS lastActivityAt,
            ac.created_at AS createdAt, ac.updated_at AS updatedAt,
            ac.recovered_at AS recoveredAt, ac.order_id AS orderId,
            o.order_number AS orderNumber
     FROM abandoned_checkouts ac
     LEFT JOIN orders o ON o.id = ac.order_id
     WHERE ac.id = ? LIMIT 1`,
    [request.params.id]
  );
  if (!rows[0]) throw new ApiError(404, "Abandoned checkout was not found");
  const events = await query(
    `SELECT id, event_type AS eventType, event_data AS eventData, created_at AS createdAt
     FROM abandoned_checkout_events
     WHERE abandoned_checkout_id = ?
     ORDER BY created_at DESC, id DESC`,
    [request.params.id]
  );
  response.json({
    success: true,
    data: { ...normalizeCheckout(rows[0]), events: events.map(normalizeCheckout) }
  });
}

export async function updateAdminAbandonedCheckoutStatus(request, response) {
  const status = text(request.body?.status, 40);
  if (!VALID_STATUSES.has(status)) throw new ApiError(400, "Invalid abandoned checkout status");
  const result = await query(
    `UPDATE abandoned_checkouts
     SET status = ?,
         recovery_status = CASE WHEN ? = 'recovered' THEN 'recovered' ELSE recovery_status END,
         recovered_at = CASE WHEN ? = 'recovered' THEN COALESCE(recovered_at, NOW()) ELSE recovered_at END
     WHERE id = ?`,
    [status, status, status, request.params.id]
  );
  if (!result.affectedRows) throw new ApiError(404, "Abandoned checkout was not found");
  await query(
    `INSERT INTO abandoned_checkout_events (abandoned_checkout_id, event_type, event_data)
     VALUES (?, 'status_changed', ?)`,
    [request.params.id, serialize({ status, adminId: request.admin?.id || null })]
  );
  response.json({ success: true, message: "Abandoned checkout status updated" });
}
