import { getAdminToken } from "../api/adminApi.js";

const rolePermissionMap = {
  super_admin: {
    "*": ["view", "create", "edit", "delete", "export", "publish"]
  },
  admin: {
    dashboard: ["view"],
    products: ["view", "create", "edit", "delete", "export"],
    categories: ["view", "create", "edit", "delete", "export"],
    brands: ["view", "create", "edit", "delete", "export"],
    variations: ["view", "create", "edit", "delete", "export"],
    orders: ["view", "create", "edit", "export"],
    customers: ["view", "edit", "export"],
    contact_enquiries: ["view", "edit", "delete", "export"],
    coupons: ["view", "create", "edit", "delete", "export"],
    homepage: ["view", "create", "edit", "delete"],
    blogs: ["view", "create", "edit", "delete", "publish"],
    credit_points: ["view", "create", "edit", "delete"],
    reviews: ["view", "create", "edit", "delete", "export"],
    settings: ["view", "edit"],
    theme_settings: ["view", "edit"]
  },
  product_manager: {
    dashboard: ["view"],
    products: ["view", "create", "edit", "delete", "export"],
    categories: ["view", "create", "edit", "delete", "export"],
    brands: ["view", "create", "edit", "delete", "export"],
    variations: ["view", "create", "edit", "delete", "export"],
    homepage: ["view", "edit"],
    blogs: ["view"]
  },
  order_manager: {
    dashboard: ["view"],
    orders: ["view", "create", "edit", "export"],
    customers: ["view", "edit"],
    contact_enquiries: ["view", "edit"]
  },
  marketing_manager: {
    dashboard: ["view"],
    coupons: ["view", "create", "edit", "delete", "export"],
    homepage: ["view", "create", "edit", "delete"],
    blogs: ["view", "create", "edit", "delete", "publish"],
    credit_points: ["view", "create", "edit", "delete"],
    reviews: ["view", "create", "edit", "delete", "export"]
  },
  support_staff: {
    dashboard: ["view"],
    orders: ["view", "edit"],
    customers: ["view", "edit"],
    contact_enquiries: ["view", "edit"]
  },
  viewer: {
    dashboard: ["view"],
    products: ["view"],
    categories: ["view"],
    brands: ["view"],
    variations: ["view"],
    orders: ["view"],
    customers: ["view"],
    contact_enquiries: ["view"],
    coupons: ["view"],
    homepage: ["view"],
    blogs: ["view"],
    credit_points: ["view"],
    reviews: ["view"],
    settings: ["view"],
    theme_settings: ["view"]
  },
  editor: {
    dashboard: ["view"],
    products: ["view", "edit"],
    categories: ["view", "edit"],
    homepage: ["view", "edit"],
    blogs: ["view", "edit"]
  }
};

function decodeJwtPayload(token) {
  if (!token || token === "local-dev-admin-token") return null;

  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(window.atob(normalized));
  } catch {
    return null;
  }
}

export function getCurrentAdminRole() {
  const token = getAdminToken();
  if (token === "local-dev-admin-token") return "super_admin";

  const payload = decodeJwtPayload(token);
  return String(payload?.role || "viewer").toLowerCase();
}

export function canAccess(moduleName, action = "view", role = getCurrentAdminRole()) {
  const normalizedRole = String(role || "viewer").toLowerCase();
  const normalizedModule = String(moduleName || "").toLowerCase();
  const normalizedAction = String(action || "view").toLowerCase();
  const permissions = rolePermissionMap[normalizedRole] || rolePermissionMap.viewer;

  if (permissions["*"]?.includes(normalizedAction)) return true;
  return Boolean(permissions[normalizedModule]?.includes(normalizedAction));
}

export function canViewModule(moduleName, role = getCurrentAdminRole()) {
  return canAccess(moduleName, "view", role);
}

export function getRolePermissions(role = getCurrentAdminRole()) {
  return rolePermissionMap[String(role || "viewer").toLowerCase()] || rolePermissionMap.viewer;
}
