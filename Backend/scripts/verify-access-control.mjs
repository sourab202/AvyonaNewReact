import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { pool, query } from "../config/db.js";
import { loginAdmin } from "../controllers/adminAuthController.js";
import { hasAdminPermission, requireAdminPermission } from "../utils/accessControl.js";
import { canAccess } from "../../Dashboard/src/utils/accessControl.js";

dotenv.config();

const results = [];

function check(label, condition) {
  results.push({ label, passed: Boolean(condition) });
}

async function checkBackend(role, moduleName, actionName) {
  return hasAdminPermission(
    {
      id: null,
      fullName: `Test ${role}`,
      email: `${role}@access-check.local`,
      role,
      status: "active",
      isActive: true
    },
    moduleName,
    actionName
  );
}

async function verifySuspendedLoginIsBlocked() {
  const email = "access-check-suspended@avyona.local";
  const password = "AccessCheck123!";
  const passwordHash = await bcrypt.hash(password, 4);

  await query(
    `INSERT INTO admins (full_name, email, password_hash, role, status, is_active)
     VALUES (?, ?, ?, 'viewer', 'suspended', 1)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role), status = VALUES(status), is_active = VALUES(is_active)`,
    ["Suspended Access Check", email, passwordHash]
  );

  try {
    await loginAdmin(
      { body: { email, password } },
      { json: () => undefined }
    );
    return false;
  } catch (error) {
    return error.statusCode === 401;
  } finally {
    await query("DELETE FROM admins WHERE email = ?", [email]);
  }
}

async function verifyPermissionMiddlewareBlocks(role, moduleName, actionName) {
  return new Promise((resolve) => {
    const middleware = requireAdminPermission(moduleName, actionName);
    middleware(
      {
        admin: {
          id: null,
          fullName: `Test ${role}`,
          email: `${role}@middleware-check.local`,
          role,
          status: "active",
          isActive: true
        }
      },
      {},
      (error) => resolve(error?.statusCode === 403)
    );
  });
}

check("Viewer can view products", canAccess("products", "view", "viewer"));
check("Viewer cannot edit products", !canAccess("products", "edit", "viewer"));
check("Delete button hides if permission is missing", !canAccess("products", "delete", "viewer"));
check("Product Manager frontend can manage products", canAccess("products", "edit", "product_manager"));
check("Product Manager frontend cannot manage orders", !canAccess("orders", "edit", "product_manager"));
check("Order Manager frontend can update orders", canAccess("orders", "edit", "order_manager"));
check("Order Manager frontend cannot edit products", !canAccess("products", "edit", "order_manager"));
check("Marketing Manager frontend can manage homepage", canAccess("homepage", "edit", "marketing_manager"));
check("Marketing Manager frontend can manage coupons", canAccess("coupons", "edit", "marketing_manager"));
check("Marketing Manager frontend can create reviews", canAccess("reviews", "create", "marketing_manager"));
check("Support Staff frontend can view customers", canAccess("customers", "view", "support_staff"));
check("Support Staff frontend cannot delete customers", !canAccess("customers", "delete", "support_staff"));
check("Admin frontend cannot access Sensitive Access", !canAccess("sensitive_access", "manage_admin_users", "admin"));
check("Super Admin frontend can access Manage Access", canAccess("sensitive_access", "manage_admin_users", "super_admin"));

check("Viewer backend can view products", await checkBackend("viewer", "products", "view"));
check("Viewer backend cannot edit products", !(await checkBackend("viewer", "products", "edit")));
check("Product Manager backend can edit products", await checkBackend("product_manager", "products", "edit"));
check("Product Manager backend cannot edit orders", !(await checkBackend("product_manager", "orders", "edit")));
check("Order Manager backend can edit orders", await checkBackend("order_manager", "orders", "edit"));
check("Order Manager backend cannot edit products", !(await checkBackend("order_manager", "products", "edit")));
check("Marketing Manager backend can edit homepage", await checkBackend("marketing_manager", "homepage", "edit"));
check("Marketing Manager backend can edit coupons", await checkBackend("marketing_manager", "coupons", "edit"));
check("Marketing Manager backend can create reviews", await checkBackend("marketing_manager", "reviews", "create"));
check("Support Staff backend can view customers", await checkBackend("support_staff", "customers", "view"));
check("Support Staff backend cannot delete customers", !(await checkBackend("support_staff", "customers", "delete")));
check("Admin backend cannot access Manage Access sensitive controls", !(await checkBackend("admin", "sensitive_access", "manage_admin_users")));
check("Suspended user cannot login", await verifySuspendedLoginIsBlocked());
check("Backend permission middleware blocks unauthorized API calls", await verifyPermissionMiddlewareBlocks("viewer", "products", "delete"));

const failed = results.filter((result) => !result.passed);

for (const result of results) {
  console.log(`${result.passed ? "PASS" : "FAIL"} ${result.label}`);
}

if (failed.length) {
  console.error(`\n${failed.length} access-control check(s) failed.`);
  await pool.end();
  process.exit(1);
}

console.log(`\nAll ${results.length} access-control checks passed.`);
await pool.end();
