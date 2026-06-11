import crypto from "node:crypto";
import { pool, query } from "../config/db.js";
import { getActiveRazorpayCredentials } from "../services/paymentSettings.js";
import { ApiError } from "../utils/apiError.js";
import { markAbandonedCheckoutRecoveredByOrder } from "../services/abandonedCheckoutService.js";

const razorpayApiBaseUrl = "https://api.razorpay.com/v1";
let paymentStorageReady = false;

export async function ensureRazorpayPaymentStorage() {
  if (paymentStorageReady) return;

  const requiredOrderColumns = [
    ["payment_gateway", "VARCHAR(50) NULL"],
    ["razorpay_order_id", "VARCHAR(160) NULL"],
    ["razorpay_payment_id", "VARCHAR(160) NULL"],
    ["payment_signature", "VARCHAR(255) NULL"],
    ["paid_at", "DATETIME NULL"],
    ["payment_error", "TEXT NULL"]
  ];

  for (const [columnName, definition] of requiredOrderColumns) {
    const rows = await query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'orders'
         AND column_name = ?
       LIMIT 1`,
      [columnName]
    );
    if (!rows.length) {
      await query(`ALTER TABLE orders ADD COLUMN ${columnName} ${definition}`);
    }
  }

  await query(
    `CREATE TABLE IF NOT EXISTS payments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      order_id INT UNSIGNED NOT NULL,
      gateway_name VARCHAR(80) NOT NULL,
      gateway_order_id VARCHAR(160) NULL,
      gateway_payment_id VARCHAR(160) NULL,
      payment_method VARCHAR(80) NULL,
      payment_status ENUM('pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded') NOT NULL DEFAULT 'pending',
      paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
      payment_time DATETIME NULL,
      refund_reference VARCHAR(160) NULL,
      gateway_response_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_payments_order_gateway (order_id, gateway_name),
      INDEX idx_payments_order_status (order_id, payment_status),
      CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )`
  );

  await query(
    `CREATE TABLE IF NOT EXISTS payment_webhook_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      provider VARCHAR(30) NOT NULL DEFAULT 'razorpay',
      event_id VARCHAR(160) NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      processing_status ENUM('processing', 'processed', 'ignored', 'failed') NOT NULL DEFAULT 'processing',
      payload_json JSON NOT NULL,
      processing_error VARCHAR(500) NULL,
      processed_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_payment_webhook_provider_event (provider, event_id),
      INDEX idx_payment_webhook_type_status (event_type, processing_status)
    )`
  );

  const requiredIndexes = [
    ["idx_orders_razorpay_order", "razorpay_order_id"],
    ["idx_orders_razorpay_payment", "razorpay_payment_id"]
  ];
  for (const [indexName, columnName] of requiredIndexes) {
    const rows = await query(
      `SELECT 1
       FROM information_schema.statistics
       WHERE table_schema = DATABASE()
         AND table_name = 'orders'
         AND index_name = ?
       LIMIT 1`,
      [indexName]
    );
    if (!rows.length) {
      await query(`CREATE INDEX ${indexName} ON orders(${columnName})`);
    }
  }

  paymentStorageReady = true;
}

function normalizeIdentifier(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeContact(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s()-]/g, "");
}

function timingSafeSignatureMatch(expected, received) {
  const expectedBuffer = Buffer.from(String(expected || ""), "utf8");
  const receivedBuffer = Buffer.from(String(received || ""), "utf8");
  return expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function getRazorpayErrorMessage(payload, fallback) {
  return String(payload?.error?.description || payload?.error?.reason || fallback).trim();
}

async function getConfiguredRazorpayCredentials({ requireEnabled = false } = {}) {
  const credentials = await getActiveRazorpayCredentials();
  if (requireEnabled && !credentials.enabled) {
    throw new ApiError(503, "Online payment is currently unavailable");
  }
  if (!credentials.keyId || !credentials.keySecret) {
    throw new ApiError(503, "Razorpay payment credentials are not configured");
  }
  return credentials;
}

async function requestRazorpay(path, credentials, options = {}) {
  const authorization = Buffer.from(
    `${credentials.keyId}:${credentials.keySecret}`,
    "utf8"
  ).toString("base64");

  let response;
  try {
    response = await fetch(`${razorpayApiBaseUrl}${path}`, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${authorization}`,
        ...(options.body ? { "Content-Type": "application/json" } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(15_000)
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new ApiError(504, "Razorpay request timed out");
    }
    throw new ApiError(502, "Unable to connect to Razorpay");
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new ApiError(
      response.status === 401 ? 502 : 502,
      getRazorpayErrorMessage(payload, "Razorpay could not process the request")
    );
  }

  return payload;
}

async function loadCheckoutOrder(connection, request, { forUpdate = false } = {}) {
  const orderId = Number(request.body?.orderId || request.query?.orderId || 0);
  const orderNumber = normalizeIdentifier(
    request.body?.orderNumber || request.query?.orderNumber,
    50
  );

  if (!orderId && !orderNumber) {
    throw new ApiError(400, "orderId or orderNumber is required");
  }

  const [rows] = await connection.execute(
    `SELECT
       o.id,
       o.customer_id AS customerId,
       o.order_number AS orderNumber,
       o.status,
       o.payment_status AS paymentStatus,
       o.payment_method AS paymentMethod,
       o.payment_gateway AS paymentGateway,
       o.razorpay_order_id AS razorpayOrderId,
       o.razorpay_payment_id AS razorpayPaymentId,
       o.paid_at AS paidAt,
       o.payment_error AS paymentError,
       o.total_amount AS totalAmount,
       o.coupon_code AS couponCode,
       o.coupon_discount AS couponDiscount,
       oa.email,
       oa.phone
     FROM orders o
     LEFT JOIN order_addresses oa
       ON oa.order_id = o.id AND oa.address_type = 'delivery'
     WHERE ${orderId ? "o.id = ?" : "o.order_number = ?"}
     LIMIT 1
     ${forUpdate ? "FOR UPDATE" : ""}`,
    [orderId || orderNumber]
  );
  const order = rows[0];

  if (!order) throw new ApiError(404, "Order not found");
  if (orderNumber && order.orderNumber !== orderNumber) {
    throw new ApiError(404, "Order not found");
  }

  if (request.customer?.id) {
    if (Number(order.customerId || 0) !== Number(request.customer.id)) {
      throw new ApiError(403, "You cannot access this order");
    }
  } else {
    const suppliedContact = normalizeContact(
      request.body?.contact || request.query?.contact
    );
    const validContacts = [order.email, order.phone].map(normalizeContact).filter(Boolean);
    if (!suppliedContact || !validContacts.includes(suppliedContact)) {
      throw new ApiError(403, "Order contact verification failed");
    }
  }

  return order;
}

function assertRazorpayOrder(order) {
  if (
    String(order.paymentGateway || order.paymentMethod || "").toLowerCase() !== "razorpay"
  ) {
    throw new ApiError(400, "This order is not configured for Razorpay payment");
  }
  if (["cancelled", "returned"].includes(order.status)) {
    throw new ApiError(409, `Payment cannot be processed for a ${order.status} order`);
  }
}

export async function createRazorpayOrder(request, response) {
  await ensureRazorpayPaymentStorage();
  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    const order = await loadCheckoutOrder(connection, request);
    assertRazorpayOrder(order);

    if (order.paymentStatus === "paid") {
      throw new ApiError(409, "This order is already paid");
    }

    const credentials = await getConfiguredRazorpayCredentials({ requireEnabled: true });
    if (order.razorpayOrderId) {
      response.json({
        success: true,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          razorpayOrderId: order.razorpayOrderId,
          amount: Math.round(Number(order.totalAmount) * 100),
          currency: credentials.currency,
          keyId: credentials.keyId,
          buttonText: credentials.buttonText,
          description: credentials.description
        }
      });
      return;
    }

    const amount = Math.round(Number(order.totalAmount) * 100);
    if (!Number.isSafeInteger(amount) || amount < 100) {
      throw new ApiError(400, "Order amount must be at least INR 1.00");
    }

    const razorpayOrder = await requestRazorpay("/orders", credentials, {
      method: "POST",
      body: {
        amount,
        currency: credentials.currency,
        receipt: order.orderNumber.slice(0, 40),
        notes: {
          local_order_id: String(order.id),
          local_order_number: order.orderNumber
        }
      }
    });

    if (!razorpayOrder.id) {
      throw new ApiError(502, "Razorpay did not return an order ID");
    }

    await connection.beginTransaction();
    transactionStarted = true;
    const lockedOrder = await loadCheckoutOrder(connection, request, { forUpdate: true });
    if (lockedOrder.razorpayOrderId && lockedOrder.razorpayOrderId !== razorpayOrder.id) {
      await connection.rollback();
      transactionStarted = false;
      response.json({
        success: true,
        data: {
          orderId: lockedOrder.id,
          orderNumber: lockedOrder.orderNumber,
          razorpayOrderId: lockedOrder.razorpayOrderId,
          amount,
          currency: credentials.currency,
          keyId: credentials.keyId,
          buttonText: credentials.buttonText,
          description: credentials.description
        }
      });
      return;
    }

    await connection.execute(
      `UPDATE orders
       SET payment_gateway = 'razorpay',
           razorpay_order_id = ?,
           payment_status = 'pending',
           payment_error = NULL
       WHERE id = ?`,
      [razorpayOrder.id, order.id]
    );
    await connection.execute(
      `INSERT INTO payments
         (order_id, gateway_name, gateway_order_id, payment_method, payment_status, paid_amount, gateway_response_json)
       VALUES (?, 'razorpay', ?, 'razorpay', 'pending', 0, ?)
       ON DUPLICATE KEY UPDATE
         gateway_order_id = VALUES(gateway_order_id),
         payment_status = 'pending',
         gateway_response_json = VALUES(gateway_response_json)`,
      [order.id, razorpayOrder.id, JSON.stringify(razorpayOrder)]
    );
    await connection.commit();
    transactionStarted = false;

    response.status(201).json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount || amount,
        currency: razorpayOrder.currency || credentials.currency,
        keyId: credentials.keyId,
        buttonText: credentials.buttonText,
        description: credentials.description
      }
    });
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function verifyRazorpayPayment(request, response) {
  await ensureRazorpayPaymentStorage();
  const razorpayOrderId = normalizeIdentifier(
    request.body?.razorpayOrderId || request.body?.razorpay_order_id
  );
  const razorpayPaymentId = normalizeIdentifier(
    request.body?.razorpayPaymentId || request.body?.razorpay_payment_id
  );
  const razorpaySignature = normalizeIdentifier(
    request.body?.razorpaySignature || request.body?.razorpay_signature,
    255
  );

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new ApiError(
      400,
      "razorpayOrderId, razorpayPaymentId, and razorpaySignature are required"
    );
  }

  const credentials = await getConfiguredRazorpayCredentials();
  const expectedSignature = crypto
    .createHmac("sha256", credentials.keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`, "utf8")
    .digest("hex");
  const signatureValid = timingSafeSignatureMatch(expectedSignature, razorpaySignature);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const order = await loadCheckoutOrder(connection, request, { forUpdate: true });
    assertRazorpayOrder(order);

    if (order.razorpayOrderId !== razorpayOrderId) {
      throw new ApiError(400, "Razorpay order ID does not match this order");
    }

    if (!signatureValid) {
      if (order.paymentStatus !== "paid") {
        await connection.execute(
          `UPDATE orders SET payment_status = 'failed', payment_error = ? WHERE id = ?`,
          ["Razorpay signature verification failed", order.id]
        );
        await connection.execute(
          `UPDATE payments
           SET gateway_payment_id = ?, payment_status = 'failed', gateway_response_json = ?
           WHERE order_id = ? AND gateway_name = 'razorpay'`,
          [
            razorpayPaymentId,
            JSON.stringify({ verification: "failed" }),
            order.id
          ]
        );
      }
      await connection.commit();
      throw new ApiError(400, "Payment signature verification failed");
    }

    if (order.paymentStatus !== "paid") {
      const [items] = await connection.execute(
        `SELECT oi.product_id AS productId, oi.product_name AS productName, oi.quantity
         FROM order_items oi
         WHERE oi.order_id = ?
         FOR UPDATE`,
        [order.id]
      );

      for (const item of items) {
        if (!item.productId) continue;
        const [stockResult] = await connection.execute(
          `UPDATE products
           SET stock_quantity = stock_quantity - ?, sold_quantity = sold_quantity + ?
           WHERE id = ? AND stock_quantity >= ?`,
          [item.quantity, item.quantity, item.productId, item.quantity]
        );
        if (!stockResult.affectedRows) {
          throw new ApiError(
            409,
            `${item.productName} is no longer available in the requested quantity`
          );
        }
      }

      if (order.couponCode && Number(order.couponDiscount || 0) > 0) {
        await connection.execute(
          "UPDATE coupons SET used_count = used_count + 1 WHERE code = ?",
          [order.couponCode]
        );
      }

      await connection.execute(
        `UPDATE orders
         SET payment_status = 'paid',
             status = 'confirmed',
             razorpay_payment_id = ?,
             payment_signature = ?,
             paid_at = NOW(),
             payment_error = NULL
         WHERE id = ?`,
        [razorpayPaymentId, razorpaySignature, order.id]
      );
      await connection.execute(
        `INSERT INTO order_status_timeline
           (order_id, status, title, note, event_time)
         VALUES (?, 'confirmed', 'Order confirmed', 'Razorpay payment verified', NOW())`,
        [order.id]
      );
    }

    await connection.execute(
      `UPDATE payments
       SET gateway_payment_id = ?,
           payment_status = 'paid',
           paid_amount = ?,
           payment_time = COALESCE(payment_time, NOW()),
           gateway_response_json = ?
       WHERE order_id = ? AND gateway_name = 'razorpay'`,
      [
        razorpayPaymentId,
        order.totalAmount,
        JSON.stringify({ verification: "success" }),
        order.id
      ]
    );
    await markAbandonedCheckoutRecoveredByOrder(connection, order.id);
    await connection.commit();

    response.json({
      success: true,
      message: "Payment verified successfully",
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: "confirmed",
        paymentStatus: "paid",
        paymentGateway: "razorpay",
        razorpayOrderId,
        razorpayPaymentId,
        paidAt: new Date().toISOString()
      }
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // The invalid-signature branch commits the failure state before returning the error.
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function getRazorpayPaymentStatus(request, response) {
  await ensureRazorpayPaymentStorage();
  const connection = await pool.getConnection();
  try {
    const order = await loadCheckoutOrder(connection, request);
    assertRazorpayOrder(order);

    response.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentGateway: order.paymentGateway || "razorpay",
        razorpayOrderId: order.razorpayOrderId || "",
        razorpayPaymentId: order.razorpayPaymentId || "",
        amount: Number(order.totalAmount || 0),
        paidAt: order.paidAt || null,
        paymentError: order.paymentError || ""
      }
    });
  } finally {
    connection.release();
  }
}
