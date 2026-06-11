import { query } from "../config/db.js";

export async function expireAbandonedCheckouts() {
  const result = await query(
    `UPDATE abandoned_checkouts
     SET status = 'expired'
     WHERE status = 'active'
       AND COALESCE(last_activity_at, created_at) < DATE_SUB(NOW(), INTERVAL 30 DAY)`
  );
  return Number(result.affectedRows || 0);
}

export async function linkAbandonedCheckoutToOrder(connection, checkoutToken, orderId, recovered = false) {
  const token = String(checkoutToken || "").trim();
  if (!token || !orderId) return false;

  const [result] = await connection.execute(
    recovered
      ? `UPDATE abandoned_checkouts
         SET status = 'recovered', recovery_status = 'recovered', order_id = ?,
             recovered_at = NOW(), last_activity_at = NOW()
         WHERE checkout_token = ? AND status <> 'cancelled'`
      : `UPDATE abandoned_checkouts
         SET order_id = ?, last_activity_at = NOW()
         WHERE checkout_token = ? AND status = 'active'`,
    [orderId, token]
  );
  if (!result.affectedRows) return false;

  const [rows] = await connection.execute(
    "SELECT id FROM abandoned_checkouts WHERE checkout_token = ? LIMIT 1",
    [token]
  );
  if (rows[0]) {
    await connection.execute(
      `INSERT INTO abandoned_checkout_events (abandoned_checkout_id, event_type, event_data)
       VALUES (?, ?, ?)`,
      [rows[0].id, recovered ? "order_recovered" : "order_created", JSON.stringify({ orderId })]
    );
  }
  return true;
}

export async function markAbandonedCheckoutRecoveredByOrder(connection, orderId) {
  if (!orderId) return false;
  const [rows] = await connection.execute(
    "SELECT id FROM abandoned_checkouts WHERE order_id = ? AND status <> 'cancelled' LIMIT 1",
    [orderId]
  );
  if (!rows[0]) return false;
  await connection.execute(
    `UPDATE abandoned_checkouts
     SET status = 'recovered', recovery_status = 'recovered', recovered_at = NOW(), last_activity_at = NOW()
     WHERE id = ?`,
    [rows[0].id]
  );
  await connection.execute(
    `INSERT INTO abandoned_checkout_events (abandoned_checkout_id, event_type, event_data)
     VALUES (?, 'order_recovered', ?)`,
    [rows[0].id, JSON.stringify({ orderId })]
  );
  return true;
}
