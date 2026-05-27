import { Router } from "express";
import {
  createAdminProductPaymentIconItem,
  deleteAdminProductPaymentIconItem,
  getAdminProductPaymentIcons,
  reorderAdminProductPaymentIconItems,
  saveAdminProductPaymentIcons,
  updateAdminProductPaymentIconItem,
  updateAdminProductPaymentIconItemStatus,
  updateAdminProductPaymentIconSettings
} from "../../controllers/settingsController.js";
import { uploadPaymentIcon } from "../../controllers/uploadController.js";
import { requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { uploadPaymentIcon as uploadPaymentIconMiddleware } from "../../middlewares/upload.js";
import { hasAdminPermission } from "../../utils/accessControl.js";
import { ApiError } from "../../utils/apiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

function requireHomepageOrSettingsPermission(actionName = "view") {
  return async (request, _response, next) => {
    const [hasHomepagePermission, hasSettingsPermission] = await Promise.all([
      hasAdminPermission(request.admin, "homepage", actionName),
      hasAdminPermission(request.admin, "settings", actionName)
    ]);

    if (!hasHomepagePermission && !hasSettingsPermission) {
      next(new ApiError(403, `Permission denied: homepage/settings.${actionName}`));
      return;
    }

    next();
  };
}

router.get("/", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("view")), asyncHandler(getAdminProductPaymentIcons));
router.put("/", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("edit")), asyncHandler(saveAdminProductPaymentIcons));
router.put("/settings", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("edit")), asyncHandler(updateAdminProductPaymentIconSettings));
router.post("/items", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("create")), asyncHandler(createAdminProductPaymentIconItem));
router.put("/items/:id", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("edit")), asyncHandler(updateAdminProductPaymentIconItem));
router.delete("/items/:id", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("delete")), asyncHandler(deleteAdminProductPaymentIconItem));
router.patch("/items/:id/status", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("edit")), asyncHandler(updateAdminProductPaymentIconItemStatus));
router.patch("/items/reorder", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("edit")), asyncHandler(reorderAdminProductPaymentIconItems));
router.post(
  "/upload",
  asyncHandler(requireAdminAuth),
  asyncHandler(requireHomepageOrSettingsPermission("create")),
  uploadPaymentIconMiddleware.single("icon"),
  asyncHandler(uploadPaymentIcon)
);

export default router;
