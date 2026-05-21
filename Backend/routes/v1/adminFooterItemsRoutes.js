import { Router } from "express";
import {
  createAdminFooterItem,
  deleteAdminFooterItem,
  getAdminFooterItems,
  reorderAdminFooterItems,
  updateAdminFooterItem,
  updateAdminFooterItemStatus
} from "../../controllers/footerController.js";
import { requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { requireAdminPermission } from "../../utils/accessControl.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.get(
  "/",
  asyncHandler(requireAdminAuth),
  asyncHandler(requireAdminPermission("settings", "view")),
  asyncHandler(getAdminFooterItems)
);

router.post(
  "/",
  asyncHandler(requireAdminAuth),
  asyncHandler(requireAdminPermission("settings", "edit")),
  asyncHandler(createAdminFooterItem)
);

router.patch(
  "/reorder",
  asyncHandler(requireAdminAuth),
  asyncHandler(requireAdminPermission("settings", "edit")),
  asyncHandler(reorderAdminFooterItems)
);

router.put(
  "/:id",
  asyncHandler(requireAdminAuth),
  asyncHandler(requireAdminPermission("settings", "edit")),
  asyncHandler(updateAdminFooterItem)
);

router.delete(
  "/:id",
  asyncHandler(requireAdminAuth),
  asyncHandler(requireAdminPermission("settings", "delete")),
  asyncHandler(deleteAdminFooterItem)
);

router.patch(
  "/:id/status",
  asyncHandler(requireAdminAuth),
  asyncHandler(requireAdminPermission("settings", "edit")),
  asyncHandler(updateAdminFooterItemStatus)
);

export default router;
