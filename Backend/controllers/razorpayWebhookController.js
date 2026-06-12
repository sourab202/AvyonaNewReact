import crypto from "node:crypto";
import { pool } from "../config/db.js";
import { ensureRazorpayPaymentStorage } from "./razorpayPaymentController.js";
import { getActiveRazorpayCredentials } from "../services/paymentSettings.js";
import { ApiError } from "../utils/apiError.js";
import { safelyLogActivity } from "../services/activityLogger.js";

const supportedEvents = new Set([
  "payment.captured",
  "payment.failed",
  "order.paid",
  "refund.processed"
]);

function safeString(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function signaturesMatch(expected, received) {
  const expectedBuffer = Buffer.from(safeString(expected), "utf8");
  const receivedBuffer = Buffer.from(safeString(received), "utf8");
  return expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function getEntity(payload, entityName) {
  return payload?.payload?.[entityName]?.entity || null;
}

function getWebhookReferences(payload) {
  const payment = getEntity(payload, "payment");
  const order = getEntity(payload, "order");
  const refund = getEntity(payload, "refund");

  return {
    payment,
    order,
    refund,
    razorpayOrderId: safeString(payment?.order_id || order?.id),
    razorpayPaymentId: safeString(payment?.id || refund?.payment_id),
    errorDescription: safeString(
      payment?.error_description ||
      payment?.error_reason ||
      payment?.error_code ||
      "Razorpay reported payment failure"
    )
  };
}

async function lockOrderByGatewayReference(connection, references) {
  const conditions = [];
  const values = [];

  if (references.razorpayOrderId) {
    conditions.push("o.razorpay_order_id = ?");
    values.push(references.razorpayOrderId);
  }
  if (references.razorpayPaymentId) {
    conditions.push("o.razorpay_payment_id = ?");
    values.push(references.razorpayPaymentId);
    conditions.push(
      "EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.gateway_name = 'razorpay' AND p.gateway_payment_id = ?)"
    );
    values.push(references.razorpayPaymentId);
  }

  if (!conditions.length) return null;

  const [rows] = await connection.execute(
    `SELECT
       o.id,
       o.order_number AS orderNumber,
       o.status,
       o.payment_status AS paymentStatus,
       o.total_amount AS totalAmount,
       o.coupon_code AS couponCode,
       o.coupon_discount AS couponDiscount,
       o.razorpay_order_id AS razorpayOrderId,
       o.razorpay_payment_id AS razorpayPaymentId
     FROM orders o
     WHERE ${conditions.join(" OR ")}
     LIMIT 1
     FOR UPDATE`,
    values
  );

  return rows[0] || null;
}

async function markOrderPaid(connection, order, references, payload) {
  if (order.paymentStatus !== "paid") {
    const [items] = await connection.execute(
      `SELECT product_id AS productId, product_name AS productName, quantity
       FROM order_items
       WHERE order_id = ?
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
           razorpay_payment_id = COALESCE(NULLIF(?, ''), razorpay_payment_id),
           paid_at = COALESCE(paid_at, NOW()),
           payment_error = NULL
       WHERE id = ?`,
      [references.razorpayPaymentId, order.id]
    );
    await connection.execute(
      `INSERT INTO order_status_timeline
         (order_id, status, title, note, event_time)
       VALUES (?, 'confirmed', 'Order confirmed', 'Razorpay webhook confirmed payment', NOW())`,
      [order.id]
    );
  }

  await connection.execute(
    `INSERT INTO payments
       (order_id, gateway_name, gateway_order_id, gateway_payment_id, payment_method,
        payment_status, paid_amount, payment_time, gateway_response_json)
     VALUES (?, 'razorpay', ?, ?, 'razorpay', 'paid', ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       gateway_order_id = COALESCE(VALUES(gateway_order_id), gateway_order_id),
       gateway_payment_id = COALESCE(VALUES(gateway_payment_id), gateway_payment_id),
       payment_status = 'paid',
       paid_amount = VALUES(paid_amount),
       payment_time = COALESCE(payment_time, NOW()),
       gateway_response_json = VALUES(gateway_response_json)`,
    [
      order.id,
      references.razorpayOrderId || null,
      references.razorpayPaymentId || null,
      order.totalAmount,
      JSON.stringify(payload)
    ]
  );
}

async function markPaymentFailed(connection, order, references, payload) {
  if (order.paymentStatus === "paid" || order.paymentStatus === "refunded") return;

  await connection.execute(
    `UPDATE orders
     SET payment_status = 'failed',
         razorpay_payment_id = COALESCE(NULLIF(?, ''), razorpay_payment_id),
         payment_error = ?
     WHERE id = ?`,
    [references.razorpayPaymentId, references.errorDescription, order.id]
  );
  await connection.execute(
    `INSERT INTO payments
       (order_id, gateway_name, gateway_order_id, gateway_payment_id, payment_method,
        payment_status, paid_amount, gateway_response_json)
     VALUES (?, 'razorpay', ?, ?, 'razorpay', 'failed', 0, ?)
     ON DUPLICATE KEY UPDATE
       gateway_payment_id = COALESCE(VALUES(gateway_payment_id), gateway_payment_id),
       payment_status = IF(payment_status = 'paid', payment_status, 'failed'),
       gateway_response_json = VALUES(gateway_response_json)`,
    [
      order.id,
      references.razorpayOrderId || null,
      references.razorpayPaymentId || null,
      JSON.stringify(payload)
    ]
  );
}

async function markRefundProcessed(connection, order, references, payload) {
  const refundAmountPaise = Number(references.refund?.amount || 0);
  const orderAmountPaise = Math.round(Number(order.totalAmount || 0) * 100);
  const refundStatus = refundAmountPaise > 0 && refundAmountPaise < orderAmountPaise
    ? "partially_refunded"
    : "refunded";

  await connection.execute(
    `UPDATE orders
     SET payment_status = ?,
         status = CASE WHEN ? = 'refunded' THEN 'cancelled' ELSE status END,
         payment_error = NULL
     WHERE id = ?`,
    [refundStatus, refundStatus, order.id]
  );
  if (refundStatus === "refunded" && order.status !== "cancelled") {
    await connection.execute(
      `INSERT INTO order_status_timeline
         (order_id, status, title, note, event_time)
       VALUES (?, 'cancelled', 'Order cancelled', 'Full Razorpay refund processed', NOW())`,
      [order.id]
    );
  }
  await connection.execute(
    `INSERT INTO payments
       (order_id, gateway_name, gateway_order_id, gateway_payment_id, payment_method,
        payment_status, paid_amount, payment_time, refund_reference, gateway_response_json)
     VALUES (?, 'razorpay', ?, ?, 'razorpay', ?, ?, NOW(), ?, ?)
     ON DUPLICATE KEY UPDATE
       payment_status = VALUES(payment_status),
       refund_reference = VALUES(refund_reference),
       gateway_response_json = VALUES(gateway_response_json)`,
    [
      order.id,
      references.razorpayOrderId || order.razorpayOrderId || null,
      references.razorpayPaymentId || order.razorpayPaymentId || null,
      refundStatus,
      order.totalAmount,
      safeString(references.refund?.id, 160) || null,
      JSON.stringify(payload)
    ]
  );
}

export async function handleRazorpayWebhook(request, response) {
  await ensureRazorpayPaymentStorage();

  const rawBody = Buffer.isBuffer(request.rawBody)
    ? request.rawBody
    : Buffer.from(JSON.stringify(request.body || {}), "utf8");
  const receivedSignature = safeString(request.headers["x-razorpay-signature"], 255);
  const credentials = await getActiveRazorpayCredentials();

  if (!credentials.webhookSecret) {
    throw new ApiError(503, "Razorpay webhook secret is not configured");
  }
  if (!receivedSignature) {
    throw new ApiError(400, "Razorpay webhook signature is required");
  }

  const expectedSignature = crypto
    .createHmac("sha256", credentials.webhookSecret)
    .update(rawBody)
    .digest("hex");
  if (!signaturesMatch(expectedSignature, receivedSignature)) {
    throw new ApiError(400, "Razorpay webhook signature verification failed");
  }

  const payload = request.body || {};
  const eventType = safeString(payload.event, 100);
  const eventId = safeString(
    request.headers["x-razorpay-event-id"] ||
    crypto.createHash("sha256").update(rawBody).digest("hex"),
    160
  );
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [eventResult] = await connection.execute(
      `INSERT IGNORE INTO payment_webhook_events
         (provider, event_id, event_type, processing_status, payload_json)
       VALUES ('razorpay', ?, ?, 'processing', ?)`,
      [eventId, eventType || "unknown", JSON.stringify(payload)]
    );

    if (!eventResult.affectedRows) {
      const [existingRows] = await connection.execute(
        `SELECT processing_status AS processingStatus
         FROM payment_webhook_events
         WHERE provider = 'razorpay' AND event_id = ?
         LIMIT 1
         FOR UPDATE`,
        [eventId]
      );
      if (existingRows[0]?.processingStatus !== "failed") {
        await connection.rollback();
        response.json({
          success: true,
          message: "Webhook event already received"
        });
        return;
      }
      await connection.execute(
        `UPDATE payment_webhook_events
         SET event_type = ?,
             processing_status = 'processing',
             payload_json = ?,
             processing_error = NULL,
             processed_at = NULL
         WHERE provider = 'razorpay' AND event_id = ?`,
        [eventType || "unknown", JSON.stringify(payload), eventId]
      );
    }

    if (!supportedEvents.has(eventType)) {
      await connection.execute(
        `UPDATE payment_webhook_events
         SET processing_status = 'ignored', processed_at = NOW()
         WHERE provider = 'razorpay' AND event_id = ?`,
        [eventId]
      );
      await connection.commit();
      response.json({ success: true, message: "Webhook event ignored" });
      return;
    }

    const references = getWebhookReferences(payload);
    const order = await lockOrderByGatewayReference(connection, references);
    if (!order) {
      throw new ApiError(404, "Webhook order could not be matched");
    }

    if (eventType === "payment.captured" || eventType === "order.paid") {
      await markOrderPaid(connection, order, references, payload);
    } else if (eventType === "payment.failed") {
      await markPaymentFailed(connection, order, references, payload);
    } else if (eventType === "refund.processed") {
      await markRefundProcessed(connection, order, references, payload);
    }

    await connection.execute(
      `UPDATE payment_webhook_events
       SET processing_status = 'processed', processed_at = NOW(), processing_error = NULL
       WHERE provider = 'razorpay' AND event_id = ?`,
      [eventId]
    );
    await connection.commit();
    const nextPaymentStatus = eventType === "payment.failed"
      ? "failed"
      : eventType === "refund.processed"
        ? (Number(references.refund?.amount || 0) < Math.round(Number(order.totalAmount || 0) * 100) ? "partially_refunded" : "refunded")
        : "paid";
    await safelyLogActivity({
      request,
      action: "payment_status_updated",
      module: "orders",
      entityType: "order",
      entityId: order.id,
      entityName: order.orderNumber,
      oldValues: { paymentStatus: order.paymentStatus },
      newValues: { paymentStatus: nextPaymentStatus },
      roleName: "system",
      description: `Razorpay ${eventType} updated the order payment status`
    });

    response.json({
      success: true,
      message: "Webhook processed successfully"
    });
  } catch (error) {
    await connection.rollback();
    try {
      await connection.execute(
        `INSERT INTO payment_webhook_events
           (provider, event_id, event_type, processing_status, payload_json, processing_error)
         VALUES ('razorpay', ?, ?, 'failed', ?, ?)
         ON DUPLICATE KEY UPDATE
           processing_status = 'failed',
           processing_error = VALUES(processing_error)`,
        [
          eventId,
          eventType || "unknown",
          JSON.stringify(payload),
          safeString(error.message || "Webhook processing failed")
        ]
      );
    } catch {
      // Preserve the original webhook processing error.
    }
    throw error;
  } finally {
    connection.release();
  }
}
