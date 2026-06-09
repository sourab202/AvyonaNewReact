import { Router } from "express";
import {
  bulkUpdateDeliveryPincodes,
  checkDeliveryPincode,
  createDeliveryPincode,
  deleteDeliveryPincode,
  getDeliveryPincodeMessageSettings,
  importDeliveryPincodes,
  listDeliveryPincodes,
  updateDeliveryPincode,
  updateDeliveryPincodeStatus,
  updateDeliveryPincodeMessageSettings
} from "../../controllers/deliveryPincodeController.js";
import { requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { uploadDeliveryPincodes } from "../../middlewares/upload.js";
import { hasAdminPermission } from "../../utils/accessControl.js";
import { ApiError } from "../../utils/apiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

function requireHomepageOrSettingsPermission(actionName = "view") {
  return async (request, _response, next) => {
    const [homepage, settings] = await Promise.all([
      hasAdminPermission(request.admin, "homepage", actionName),
      hasAdminPermission(request.admin, "settings", actionName)
    ]);
    if (!homepage && !settings) {
      next(new ApiError(403, `Permission denied: homepage/settings.${actionName}`));
      return;
    }
    next();
  };
}

function requireBulkPermission() {
  return async (request, response, next) => {
    const actionName = request.body?.action === "delete" ? "delete" : "edit";
    return requireHomepageOrSettingsPermission(actionName)(request, response, next);
  };
}

function requireImportPermission() {
  return async (request, response, next) => {
    const actionName = request.body?.mode === "replace" ? "delete" : "create";
    return requireHomepageOrSettingsPermission(actionName)(request, response, next);
  };
}

router.get("/check/:pincode", asyncHandler(checkDeliveryPincode));
router.get("/admin", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("view")), asyncHandler(listDeliveryPincodes));
router.get("/admin/message-settings", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("view")), asyncHandler(getDeliveryPincodeMessageSettings));
router.put("/admin/message-settings", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("edit")), asyncHandler(updateDeliveryPincodeMessageSettings));
router.post("/admin", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("create")), asyncHandler(createDeliveryPincode));
router.put("/admin/:id", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("edit")), asyncHandler(updateDeliveryPincode));
router.patch("/admin/:id/status", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("edit")), asyncHandler(updateDeliveryPincodeStatus));
router.delete("/admin/:id", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("delete")), asyncHandler(deleteDeliveryPincode));
router.post("/admin/bulk", asyncHandler(requireAdminAuth), asyncHandler(requireBulkPermission()), asyncHandler(bulkUpdateDeliveryPincodes));
router.post(
  "/admin/import",
  asyncHandler(requireAdminAuth),
  uploadDeliveryPincodes.single("file"),
  asyncHandler(requireImportPermission()),
  asyncHandler(importDeliveryPincodes)
);

export default router;
