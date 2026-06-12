import { Router } from "express";
import { deleteImageAsset, listImageAssets, restoreImageAsset, updateImageAsset, uploadImage, uploadMedia, uploadPaymentIcon, uploadWhyShopIcon } from "../../controllers/uploadController.js";
import { requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { upload, uploadMedia as uploadMediaMiddleware, uploadPaymentIcon as uploadPaymentIconMiddleware, uploadWhyShopIcon as uploadWhyShopIconMiddleware } from "../../middlewares/upload.js";
import { ApiError } from "../../utils/apiError.js";
import { hasAdminPermission, requireAdminPermission } from "../../utils/accessControl.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

async function requireMediaUploadPermission(request, _response, next) {
  try {
    const allowed = await hasAdminPermission(request.admin, "products", "edit")
      || await hasAdminPermission(request.admin, "products", "create")
      || await hasAdminPermission(request.admin, "homepage", "create");
    if (!allowed) {
      next(new ApiError(403, "Permission denied: media.upload"));
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}

router.get("/images", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("homepage", "view")), asyncHandler(listImageAssets));
router.patch("/images", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("homepage", "edit")), asyncHandler(updateImageAsset));
router.patch("/images/restore", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("homepage", "edit")), asyncHandler(restoreImageAsset));
router.delete("/images", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("homepage", "delete")), asyncHandler(deleteImageAsset));
router.post("/image", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("homepage", "create")), upload.single("image"), asyncHandler(uploadImage));
router.post("/media", asyncHandler(requireAdminAuth), asyncHandler(requireMediaUploadPermission), uploadMediaMiddleware.single("media"), asyncHandler(uploadMedia));
router.post("/homepage/why-shop/icon", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("homepage", "create")), uploadWhyShopIconMiddleware.single("icon"), asyncHandler(uploadWhyShopIcon));
router.post("/homepage/payment-icons/icon", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("homepage", "create")), uploadPaymentIconMiddleware.single("icon"), asyncHandler(uploadPaymentIcon));

export default router;
