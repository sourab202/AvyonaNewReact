import bcrypt from "bcryptjs";
import { query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";
import { signAdminToken } from "../utils/jwt.js";
import { safelyLogActivity } from "../services/activityLogger.js";

export async function bootstrapAdmin(request, response) {
  const { fullName, email, password } = request.body || {};

  if (!fullName || !email || !password) {
    throw new ApiError(400, "fullName, email, and password are required");
  }

  const existingAdmins = await query("SELECT id FROM admins LIMIT 1");
  if (existingAdmins.length) {
    throw new ApiError(409, "An admin already exists. Use login instead.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query(
    "INSERT INTO admins (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)",
    [fullName, String(email).toLowerCase(), passwordHash, "super_admin"]
  );

  const admins = await query(
    "SELECT id, full_name AS fullName, email, role FROM admins WHERE id = ? LIMIT 1",
    [result.insertId]
  );
  const admin = admins[0];

  response.status(201).json({
    success: true,
    data: {
      admin,
      token: signAdminToken(admin)
    }
  });
}

export async function loginAdmin(request, response) {
  const { email, password } = request.body || {};

  if (!email || !password) {
    throw new ApiError(400, "email and password are required");
  }

  const admins = await query(
    "SELECT id, full_name AS fullName, email, password_hash AS passwordHash, role, status, is_active AS isActive FROM admins WHERE email = ? LIMIT 1",
    [String(email).toLowerCase()]
  );
  const admin = admins[0];

  if (!admin || !admin.isActive || admin.status !== "active") {
    await safelyLogActivity({
      request,
      action: "login_failed",
      module: "users_access",
      entityType: "admin_user",
      entityName: String(email).toLowerCase(),
      adminEmail: String(email).toLowerCase(),
      description: "Admin login failed"
    });
    throw new ApiError(401, "Invalid email or password");
  }

  const isValidPassword = await bcrypt.compare(password, admin.passwordHash);
  if (!isValidPassword) {
    await safelyLogActivity({
      request,
      action: "login_failed",
      module: "users_access",
      entityType: "admin_user",
      entityId: admin.id,
      entityName: admin.email,
      adminId: admin.id,
      adminName: admin.fullName,
      adminEmail: admin.email,
      roleName: admin.role,
      description: "Admin login failed"
    });
    throw new ApiError(401, "Invalid email or password");
  }

  await query("UPDATE admins SET last_login_at = NOW() WHERE id = ?", [admin.id]);
  await safelyLogActivity({
    request,
    action: "login_success",
    module: "users_access",
    entityType: "admin_user",
    entityId: admin.id,
    entityName: admin.email,
    adminId: admin.id,
    adminName: admin.fullName,
    adminEmail: admin.email,
    roleName: admin.role,
    description: "Admin logged in successfully"
  });

  response.json({
    success: true,
    data: {
      admin: {
        id: admin.id,
        fullName: admin.fullName,
        email: admin.email,
        role: admin.role
      },
      token: signAdminToken(admin)
    }
  });
}

export async function logoutAdmin(request, response) {
  await safelyLogActivity({
    request,
    action: "logout",
    module: "users_access",
    entityType: "admin_user",
    entityId: request.admin?.id,
    entityName: request.admin?.email,
    description: "Admin logged out"
  });
  response.json({ success: true, message: "Logged out successfully" });
}

export async function getCurrentAdmin(request, response) {
  response.json({
    success: true,
    data: request.admin
  });
}
