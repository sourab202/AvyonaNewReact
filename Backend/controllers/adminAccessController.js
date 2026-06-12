import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";
import { SYSTEM_ROLES, assertCanDeleteAdmin } from "../utils/accessControl.js";
import { safelyLogActivity } from "../services/activityLogger.js";

const ROLE_NAMES = new Set(Object.values(SYSTEM_ROLES));
const USER_STATUSES = new Set(["active", "inactive", "suspended", "invite_pending"]);
const PERMISSION_ACTIONS = ["view", "create", "edit", "delete", "export", "approve"];
const SECURITY_SETTINGS_KEY = "admin_access_security_rules";
const DEFAULT_SECURITY_RULES = {
  sessionTimeoutMinutes: 30,
  passwordMinLength: 10,
  loginAttemptLimit: 5,
  autoLockFailedAttempts: true,
  confirmBeforeDelete: true,
  reasonForRefundCancel: true
};

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeStatus(value, fallback = "active") {
  const status = String(value || fallback).trim().toLowerCase().replace(/\s+/g, "_");
  if (!USER_STATUSES.has(status)) throw new ApiError(400, "Invalid admin status");
  return status;
}

function validateRole(role, currentAdmin) {
  if (!ROLE_NAMES.has(role)) throw new ApiError(400, "Invalid admin role");
  if (role === SYSTEM_ROLES.SUPER_ADMIN && currentAdmin.role !== SYSTEM_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "Only Super Admin can assign the Super Admin role");
  }
}

function formatDate(value) {
  return value ? new Date(value).toISOString() : null;
}

function mapAdmin(row) {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone || "",
    role: row.role,
    status: row.status,
    isActive: Boolean(row.isActive),
    lastLoginAt: formatDate(row.lastLoginAt),
    invitedAt: formatDate(row.invitedAt),
    inviteExpiresAt: formatDate(row.inviteExpiresAt),
    createdAt: formatDate(row.createdAt)
  };
}

function requestDevice(request) {
  return String(request.headers["user-agent"] || "").slice(0, 180) || null;
}

async function writeAudit(request, action, entityId, recordName, metadata = {}, status = "success") {
  await query(
    `INSERT INTO audit_logs
      (admin_id, admin_name, admin_role, action, module_name, entity_type, entity_id,
       record_name, ip_address, device_label, status, metadata_json)
     VALUES (?, ?, ?, ?, 'sensitive_access', 'admin_user', ?, ?, ?, ?, ?, ?)`,
    [
      request.admin?.id || null,
      request.admin?.fullName || request.admin?.email || "System",
      request.admin?.role || "system",
      action,
      String(entityId || ""),
      recordName || null,
      request.ip || null,
      requestDevice(request),
      status,
      JSON.stringify(metadata)
    ]
  );
}

async function fetchAdmin(adminId) {
  const rows = await query(
    `SELECT id, full_name AS fullName, email, phone, role, status, is_active AS isActive,
            last_login_at AS lastLoginAt, invited_at AS invitedAt,
            invite_expires_at AS inviteExpiresAt, created_at AS createdAt
     FROM admins WHERE id = ? LIMIT 1`,
    [adminId]
  );
  return rows[0] || null;
}

export async function listAccessRoles(_request, response) {
  const rows = await query(
    `SELECT r.id, r.name, r.display_name AS displayName, r.description,
            r.is_system AS isSystem, r.status, COUNT(a.id) AS usersCount
     FROM roles r
     LEFT JOIN admins a ON a.role = r.name
     GROUP BY r.id, r.name, r.display_name, r.description, r.is_system, r.status
     ORDER BY r.id`
  );
  response.json({ success: true, data: rows.map((row) => ({ ...row, isSystem: Boolean(row.isSystem), usersCount: Number(row.usersCount || 0) })) });
}

export async function listAccessUsers(_request, response) {
  const rows = await query(
    `SELECT id, full_name AS fullName, email, phone, role, status, is_active AS isActive,
            last_login_at AS lastLoginAt, invited_at AS invitedAt,
            invite_expires_at AS inviteExpiresAt, created_at AS createdAt
     FROM admins ORDER BY created_at DESC, id DESC`
  );
  response.json({ success: true, data: rows.map(mapAdmin) });
}

export async function createAccessUser(request, response) {
  const mode = String(request.body?.mode || "email").toLowerCase();
  const fullName = String(request.body?.fullName || "").trim();
  const email = String(request.body?.email || "").trim().toLowerCase();
  const phone = String(request.body?.phone || "").trim() || null;
  const role = normalizeRole(request.body?.role || SYSTEM_ROLES.VIEWER);
  const password = String(request.body?.password || "");

  if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, "Full name and a valid email are required");
  }
  validateRole(role, request.admin);

  const existing = await query("SELECT id FROM admins WHERE email = ? LIMIT 1", [email]);
  if (existing[0]) throw new ApiError(409, "An admin user with this email already exists");

  let status = "active";
  let inviteToken = null;
  let inviteTokenHash = null;
  let inviteExpiresAt = null;
  let passwordHash;

  if (mode === "manual") {
    if (password.length < 10) throw new ApiError(400, "Temporary password must be at least 10 characters");
    passwordHash = await bcrypt.hash(password, 10);
  } else if (mode === "email") {
    inviteToken = crypto.randomBytes(32).toString("hex");
    inviteTokenHash = crypto.createHash("sha256").update(inviteToken).digest("hex");
    inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
    status = "invite_pending";
  } else {
    throw new ApiError(400, "Onboarding mode must be email or manual");
  }

  const result = await query(
    `INSERT INTO admins
      (full_name, email, phone, password_hash, role, status, is_active, invited_at, invite_token_hash, invite_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [
      fullName,
      email,
      phone,
      passwordHash,
      role,
      status,
      mode === "email" ? new Date() : null,
      inviteTokenHash,
      inviteExpiresAt
    ]
  );

  const admin = mapAdmin(await fetchAdmin(result.insertId));
  const dashboardOrigin = String(process.env.DASHBOARD_ORIGIN || "http://localhost:5174").replace(/\/+$/, "");
  const inviteUrl = inviteToken ? `${dashboardOrigin}/dashboard/accept-invite?token=${inviteToken}` : null;
  await writeAudit(request, mode === "email" ? "Invited admin user" : "Created admin user", admin.id, admin.email, { role, mode });
  await safelyLogActivity({
    request, action: "admin_created", module: "users_access", entityType: "admin_user",
    entityId: admin.id, entityName: admin.email, newValues: admin,
    description: mode === "email" ? "Admin user invited" : "Admin user created"
  });

  response.status(201).json({
    success: true,
    data: {
      user: admin,
      inviteUrl,
      emailDelivery: mode === "email" ? "not_configured" : null
    }
  });
}

export async function updateAccessUser(request, response) {
  const target = await fetchAdmin(request.params.id);
  if (!target) throw new ApiError(404, "Admin user not found");

  const fullName = String(request.body?.fullName ?? target.fullName).trim();
  const phone = String(request.body?.phone ?? target.phone ?? "").trim() || null;
  const role = normalizeRole(request.body?.role ?? target.role);
  const status = normalizeStatus(request.body?.status, target.status);

  validateRole(role, request.admin);
  if (target.role === SYSTEM_ROLES.SUPER_ADMIN && request.admin.role !== SYSTEM_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "Only Super Admin can modify another Super Admin");
  }
  if (Number(target.id) === Number(request.admin.id) && status !== "active") {
    throw new ApiError(400, "You cannot deactivate or suspend your own account");
  }

  await query(
    `UPDATE admins
     SET full_name = ?, phone = ?, role = ?, status = ?, is_active = ?
     WHERE id = ?`,
    [fullName, phone, role, status, status === "active" || status === "invite_pending" ? 1 : 0, target.id]
  );
  const updated = mapAdmin(await fetchAdmin(target.id));
  await writeAudit(request, "Updated admin user", target.id, target.email, { role, status });
  await safelyLogActivity({
    request,
    action: target.role !== updated.role ? "role_changed" : "admin_updated",
    module: "users_access", entityType: "admin_user", entityId: target.id,
    entityName: target.email, oldValues: target, newValues: updated,
    description: "Admin user updated"
  });
  response.json({ success: true, data: updated });
}

export async function deleteAccessUser(request, response) {
  const target = await fetchAdmin(request.params.id);
  if (!target) throw new ApiError(404, "Admin user not found");
  assertCanDeleteAdmin(request.admin, target);
  if (Number(target.id) === Number(request.admin.id)) throw new ApiError(400, "You cannot delete your own account");

  await query("DELETE FROM admins WHERE id = ?", [target.id]);
  await writeAudit(request, "Deleted admin user", target.id, target.email, { role: target.role });
  await safelyLogActivity({
    request, action: "admin_deleted", module: "users_access", entityType: "admin_user",
    entityId: target.id, entityName: target.email, oldValues: target,
    description: "Admin user deleted"
  });
  response.json({ success: true, message: "Admin user deleted" });
}

export async function resetAccessUserPassword(request, response) {
  const target = await fetchAdmin(request.params.id);
  if (!target) throw new ApiError(404, "Admin user not found");
  const password = String(request.body?.password || "");
  if (password.length < 10) throw new ApiError(400, "Temporary password must be at least 10 characters");

  await query(
    `UPDATE admins
     SET password_hash = ?, password_reset_token_hash = NULL, password_reset_expires_at = NULL,
         status = 'active', is_active = 1
     WHERE id = ?`,
    [await bcrypt.hash(password, 10), target.id]
  );
  await writeAudit(request, "Reset admin password", target.id, target.email);
  response.json({ success: true, message: "Temporary password saved" });
}

export async function acceptAdminInvite(request, response) {
  const token = String(request.body?.token || "");
  const password = String(request.body?.password || "");
  if (!token || password.length < 10) throw new ApiError(400, "A valid invite token and 10+ character password are required");

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const rows = await query(
    `SELECT id FROM admins
     WHERE invite_token_hash = ? AND status = 'invite_pending'
       AND invite_expires_at > NOW() LIMIT 1`,
    [tokenHash]
  );
  if (!rows[0]) throw new ApiError(400, "Invite link is invalid or expired");

  await query(
    `UPDATE admins
     SET password_hash = ?, status = 'active', is_active = 1,
         invite_token_hash = NULL, invite_expires_at = NULL
     WHERE id = ?`,
    [await bcrypt.hash(password, 10), rows[0].id]
  );
  response.json({ success: true, message: "Password created. You can now sign in." });
}

export async function getRolePermissions(request, response) {
  const role = normalizeRole(request.params.role);
  validateRole(role, request.admin);
  const rows = await query(
    `SELECT rp.module_name AS moduleName, rp.can_view AS canView, rp.can_create AS canCreate,
            rp.can_edit AS canEdit, rp.can_delete AS canDelete, rp.can_export AS canExport,
            rp.can_approve AS canApprove
     FROM role_permissions rp
     JOIN roles r ON r.id = rp.role_id
     WHERE r.name = ? ORDER BY rp.module_name`,
    [role]
  );
  response.json({ success: true, data: rows });
}

export async function updateRolePermissions(request, response) {
  const role = normalizeRole(request.params.role);
  validateRole(role, request.admin);
  if (role === SYSTEM_ROLES.SUPER_ADMIN) throw new ApiError(400, "Super Admin permissions are always unrestricted");
  const modules = Array.isArray(request.body?.modules) ? request.body.modules : [];
  const roleRows = await query("SELECT id FROM roles WHERE name = ? LIMIT 1", [role]);
  if (!roleRows[0]) throw new ApiError(404, "Role not found");

  for (const item of modules) {
    const moduleName = String(item.moduleName || "").trim().toLowerCase();
    if (!moduleName || moduleName === "sensitive_access") continue;
    const values = PERMISSION_ACTIONS.map((action) => Boolean(item[action]) ? 1 : 0);
    await query(
      `INSERT INTO role_permissions
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_export, can_approve)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         can_view = VALUES(can_view), can_create = VALUES(can_create),
         can_edit = VALUES(can_edit), can_delete = VALUES(can_delete),
         can_export = VALUES(can_export), can_approve = VALUES(can_approve)`,
      [roleRows[0].id, moduleName, ...values]
    );
  }
  await writeAudit(request, "Updated role permissions", role, role, { modules: modules.length });
  await safelyLogActivity({
    request, action: "permission_changed", module: "users_access", entityType: "role",
    entityId: role, entityName: role, newValues: { modules },
    description: `Permissions updated for ${role}`
  });
  response.json({ success: true, message: "Role permissions saved" });
}

export async function listAccessLogs(_request, response) {
  const rows = await query(
    `SELECT id, admin_name AS adminName, admin_role AS adminRole, action, module_name AS moduleName,
            record_name AS recordName, ip_address AS ipAddress, device_label AS deviceLabel,
            status, created_at AS createdAt
     FROM audit_logs ORDER BY created_at DESC LIMIT 200`
  );
  response.json({ success: true, data: rows });
}

export async function getAccessSecurityRules(_request, response) {
  const rows = await query("SELECT setting_value AS settingValue FROM app_settings WHERE setting_key = ? LIMIT 1", [SECURITY_SETTINGS_KEY]);
  let saved = {};
  try {
    saved = JSON.parse(rows[0]?.settingValue || "{}");
  } catch {
    saved = {};
  }
  response.json({ success: true, data: { ...DEFAULT_SECURITY_RULES, ...saved } });
}

export async function updateAccessSecurityRules(request, response) {
  const rules = { ...DEFAULT_SECURITY_RULES, ...(request.body || {}) };
  rules.sessionTimeoutMinutes = Math.max(5, Math.min(480, Number(rules.sessionTimeoutMinutes) || 30));
  rules.passwordMinLength = Math.max(8, Math.min(64, Number(rules.passwordMinLength) || 10));
  rules.loginAttemptLimit = Math.max(3, Math.min(20, Number(rules.loginAttemptLimit) || 5));
  await query(
    `INSERT INTO app_settings (setting_key, setting_value, setting_group)
     VALUES (?, ?, 'security')
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_group = VALUES(setting_group)`,
    [SECURITY_SETTINGS_KEY, JSON.stringify(rules)]
  );
  await writeAudit(request, "Updated access security rules", SECURITY_SETTINGS_KEY, "Access security rules");
  response.json({ success: true, data: rules });
}
