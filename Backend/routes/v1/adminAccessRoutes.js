import { Router } from "express";
import {
  acceptAdminInvite,
  createAccessUser,
  deleteAccessUser,
  getAccessSecurityRules,
  getRolePermissions,
  listAccessLogs,
  listAccessRoles,
  listAccessUsers,
  resetAccessUserPassword,
  updateAccessSecurityRules,
  updateAccessUser,
  updateRolePermissions
} from "../../controllers/adminAccessController.js";
import { requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { requireAdminPermission } from "../../utils/accessControl.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.post("/invitations/accept", asyncHandler(acceptAdminInvite));
router.use(asyncHandler(requireAdminAuth));
router.use(asyncHandler(requireAdminPermission("sensitive_access", "manage_admin_users")));

router.get("/roles", asyncHandler(listAccessRoles));
router.get("/users", asyncHandler(listAccessUsers));
router.post("/users", asyncHandler(createAccessUser));
router.patch("/users/:id", asyncHandler(updateAccessUser));
router.delete("/users/:id", asyncHandler(deleteAccessUser));
router.post("/users/:id/reset-password", asyncHandler(resetAccessUserPassword));
router.get("/roles/:role/permissions", asyncHandler(getRolePermissions));
router.put("/roles/:role/permissions", asyncHandler(updateRolePermissions));
router.get("/logs", asyncHandler(listAccessLogs));
router.get("/security-rules", asyncHandler(getAccessSecurityRules));
router.put("/security-rules", asyncHandler(updateAccessSecurityRules));

export default router;
