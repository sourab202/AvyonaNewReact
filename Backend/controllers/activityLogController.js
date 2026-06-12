import { query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";

const ALLOWED_ROLES = new Set(["admin", "super_admin"]);
const FILTER_COLUMNS = {
  admin_id: "admin_id",
  role: "role_name",
  module: "module",
  action: "action",
  entity_type: "entity_type"
};

export function requireActivityHistoryRole(request, _response, next) {
  if (!ALLOWED_ROLES.has(String(request.admin?.role || "").toLowerCase())) {
    next(new ApiError(403, "You do not have permission to view activity history."));
    return;
  }
  next();
}

function parseJson(value) {
  if (value == null || typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function mapLog(row) {
  return {
    ...row,
    oldValues: parseJson(row.oldValues),
    newValues: parseJson(row.newValues),
    changes: parseJson(row.changes)
  };
}

export async function listActivityLogs(request, response) {
  const page = Math.max(1, Number(request.query.page) || 1);
  const limit = Math.min(100, Math.max(10, Number(request.query.limit) || 25));
  const where = [];
  const values = [];
  const search = String(request.query.search || "").trim();

  if (search) {
    where.push(`(admin_name LIKE ? OR admin_email LIKE ? OR action LIKE ? OR module LIKE ?
      OR entity_name LIKE ? OR entity_id LIKE ? OR description LIKE ? OR ip_address LIKE ?)`);
    values.push(...Array(8).fill(`%${search}%`));
  }
  for (const [parameter, column] of Object.entries(FILTER_COLUMNS)) {
    const value = String(request.query[parameter] || "").trim();
    if (value) {
      where.push(`${column} = ?`);
      values.push(value);
    }
  }
  if (request.query.date_from) {
    where.push("created_at >= ?");
    values.push(`${request.query.date_from} 00:00:00`);
  }
  if (request.query.date_to) {
    where.push("created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    values.push(`${request.query.date_to} 00:00:00`);
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [countRows, rows, modules, actions, admins] = await Promise.all([
    query(`SELECT COUNT(*) AS total FROM activity_logs ${clause}`, values),
    query(
      `SELECT id, admin_id AS adminId, admin_name AS adminName, admin_email AS adminEmail,
              role_name AS roleName, action, module, entity_type AS entityType,
              entity_id AS entityId, entity_name AS entityName, description,
              ip_address AS ipAddress, created_at AS createdAt
       FROM activity_logs ${clause}
       ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...values, limit, (page - 1) * limit]
    ),
    query("SELECT DISTINCT module FROM activity_logs ORDER BY module"),
    query("SELECT DISTINCT action FROM activity_logs ORDER BY action"),
    query(`SELECT DISTINCT admin_id AS id, admin_name AS name, admin_email AS email
           FROM activity_logs WHERE admin_name IS NOT NULL ORDER BY admin_name`)
  ]);
  const total = Number(countRows[0]?.total || 0);

  response.json({
    success: true,
    data: rows,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    filters: {
      modules: modules.map((row) => row.module),
      actions: actions.map((row) => row.action),
      admins
    }
  });
}

export async function getActivityLog(request, response) {
  const rows = await query(
    `SELECT id, admin_id AS adminId, admin_name AS adminName, admin_email AS adminEmail,
            role_name AS roleName, action, module, entity_type AS entityType,
            entity_id AS entityId, entity_name AS entityName, old_values AS oldValues,
            new_values AS newValues, changes, description, ip_address AS ipAddress,
            user_agent AS userAgent, created_at AS createdAt
     FROM activity_logs WHERE id = ? LIMIT 1`,
    [Number(request.params.id)]
  );
  if (!rows[0]) throw new ApiError(404, "Activity log not found");
  response.json({ success: true, data: mapLog(rows[0]) });
}
