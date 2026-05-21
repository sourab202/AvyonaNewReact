import { ApiError } from "./apiError.js";
import { query } from "../config/db.js";

export const SYSTEM_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  PRODUCT_MANAGER: "product_manager",
  ORDER_MANAGER: "order_manager",
  MARKETING_MANAGER: "marketing_manager",
  SUPPORT_STAFF: "support_staff",
  VIEWER: "viewer"
};

export function isSuperAdmin(admin) {
  return admin?.role === SYSTEM_ROLES.SUPER_ADMIN;
}

export function requireSuperAdmin(admin, message = "Only Super Admin can perform this action.") {
  if (!isSuperAdmin(admin)) {
    throw new ApiError(403, message);
  }
}

export function assertCanCreateRole(admin, roleName) {
  if (roleName === SYSTEM_ROLES.SUPER_ADMIN) {
    requireSuperAdmin(admin, "Only Super Admin can create another Super Admin.");
  }
}

export function assertCanDeleteAdmin(admin, targetAdmin) {
  if (targetAdmin?.role === SYSTEM_ROLES.SUPER_ADMIN && !isSuperAdmin(admin)) {
    throw new ApiError(403, "Normal admins cannot delete a Super Admin account.");
  }
}

const permissionColumnByAction = {
  view: "can_view",
  create: "can_create",
  edit: "can_edit",
  delete: "can_delete",
  export: "can_export",
  approve: "can_approve",
  publish: "can_approve"
};

export async function hasAdminPermission(admin, moduleName, actionName = "view") {
  if (!admin || admin.isActive === false || (admin.status && admin.status !== "active")) return false;
  if (isSuperAdmin(admin)) return true;

  const action = String(actionName || "view").toLowerCase();
  const module = String(moduleName || "").toLowerCase();
  const permissionColumn = permissionColumnByAction[action];
  if (!module || !permissionColumn) return false;

  const customPermissions = admin.id
    ? await query(
        `SELECT ucp.effect
         FROM user_custom_permissions ucp
         JOIN permissions p ON p.id = ucp.permission_id
         WHERE ucp.admin_id = ?
           AND p.module_name = ?
           AND p.action_name = ?
         LIMIT 1`,
        [admin.id, module, action]
      )
    : [];

  if (customPermissions[0]?.effect === "deny") return false;
  if (customPermissions[0]?.effect === "allow") return true;

  const rows = await query(
    `SELECT rp.${permissionColumn} AS allowed
     FROM roles r
     JOIN role_permissions rp ON rp.role_id = r.id
     WHERE r.name = ?
       AND r.status = 'active'
       AND rp.module_name = ?
     LIMIT 1`,
    [admin.role, module]
  );

  return Boolean(rows[0]?.allowed);
}

export function requireAdminPermission(moduleName, actionName = "view") {
  return async (request, _response, next) => {
    try {
      const allowed = await hasAdminPermission(request.admin, moduleName, actionName);
      if (!allowed) {
        next(new ApiError(403, `Permission denied: ${moduleName}.${actionName}`));
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
