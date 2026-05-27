import { Router } from "express";
import {
  createAdminWhyShopItem,
  deleteAdminWhyShopItem,
  getAdminWhyShop,
  reorderAdminWhyShopItems,
  updateAdminWhyShopItem,
  updateAdminWhyShopItemStatus,
  updateAdminWhyShopSettings
} from "../../controllers/settingsController.js";
import { uploadWhyShopIcon } from "../../controllers/uploadController.js";
import { requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { uploadWhyShopIcon as uploadWhyShopIconMiddleware } from "../../middlewares/upload.js";
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

router.get("/", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("view")), asyncHandler(getAdminWhyShop));
router.put("/settings", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("edit")), asyncHandler(updateAdminWhyShopSettings));
router.post("/items", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("create")), asyncHandler(createAdminWhyShopItem));
router.put("/items/:id", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("edit")), asyncHandler(updateAdminWhyShopItem));
router.delete("/items/:id", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("delete")), asyncHandler(deleteAdminWhyShopItem));
router.patch("/items/:id/status", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("edit")), asyncHandler(updateAdminWhyShopItemStatus));
router.patch("/items/reorder", asyncHandler(requireAdminAuth), asyncHandler(requireHomepageOrSettingsPermission("edit")), asyncHandler(reorderAdminWhyShopItems));
router.post(
  "/upload",
  asyncHandler(requireAdminAuth),
  asyncHandler(requireHomepageOrSettingsPermission("create")),
  uploadWhyShopIconMiddleware.single("icon"),
  asyncHandler(uploadWhyShopIcon)
);

export default router;
