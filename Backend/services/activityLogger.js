import { query } from "../config/db.js";

const MASK = "***masked***";
const SENSITIVE_KEY = /(^|_)(password|token|secret|key|api_key|webhook_secret)(_|$)/i;

function safeJson(value) {
  if (value === undefined) return null;
  return value;
}

export function maskSensitiveValues(value, parentKey = "") {
  if (SENSITIVE_KEY.test(parentKey)) return MASK;
  if (Array.isArray(value)) return value.map((item) => maskSensitiveValues(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? MASK : maskSensitiveValues(item, key)
      ])
    );
  }
  return value;
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function buildChanges(oldValues, newValues) {
  const oldObject = oldValues && typeof oldValues === "object" ? oldValues : {};
  const newObject = newValues && typeof newValues === "object" ? newValues : {};
  const changes = {};

  for (const key of new Set([...Object.keys(oldObject), ...Object.keys(newObject)])) {
    if (!valuesEqual(oldObject[key], newObject[key])) {
      changes[key] = {
        old: oldObject[key] === undefined ? null : oldObject[key],
        new: newObject[key] === undefined ? null : newObject[key]
      };
    }
  }
  return changes;
}

function getRequestIp(request) {
  const forwarded = String(request?.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request?.ip || request?.socket?.remoteAddress || null;
}

export async function logActivity({
  request,
  action,
  module,
  entityType = null,
  entityId = null,
  entityName = null,
  oldValues = null,
  newValues = null,
  changes,
  description = null,
  adminId,
  adminName,
  adminEmail,
  roleName
}) {
  const actor = request?.admin || {};
  const maskedOld = maskSensitiveValues(safeJson(oldValues));
  const maskedNew = maskSensitiveValues(safeJson(newValues));
  const maskedChanges = maskSensitiveValues(
    changes === undefined ? buildChanges(maskedOld, maskedNew) : changes
  );

  await query(
    `INSERT INTO activity_logs
      (admin_id, admin_name, admin_email, role_name, action, module, entity_type,
       entity_id, entity_name, old_values, new_values, changes, description,
       ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      adminId ?? actor.id ?? null,
      adminName ?? actor.fullName ?? null,
      adminEmail ?? actor.email ?? null,
      roleName ?? actor.role ?? null,
      String(action),
      String(module),
      entityType ? String(entityType) : null,
      entityId == null ? null : String(entityId),
      entityName ? String(entityName).slice(0, 255) : null,
      maskedOld == null ? null : JSON.stringify(maskedOld),
      maskedNew == null ? null : JSON.stringify(maskedNew),
      maskedChanges && Object.keys(maskedChanges).length ? JSON.stringify(maskedChanges) : null,
      description ? String(description) : null,
      getRequestIp(request),
      String(request?.headers?.["user-agent"] || "") || null
    ]
  );
}

export async function safelyLogActivity(payload) {
  try {
    await logActivity(payload);
  } catch (error) {
    console.error("[ActivityLog] Failed to write audit event:", error.message);
  }
}
