import { Router } from "express";
import {
  getAdminFooterSettings,
  updateAdminFooterSettings
} from "../../controllers/footerController.js";
import { requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { requireAdminPermission } from "../../utils/accessControl.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.get(
  "/",
  asyncHandler(requireAdminAuth),
  asyncHandler(requireAdminPermission("settings", "view")),
  asyncHandler(getAdminFooterSettings)
);

router.put(
  "/",
  asyncHandler(requireAdminAuth),
  asyncHandler(requireAdminPermission("settings", "edit")),
  asyncHandler(updateAdminFooterSettings)
);

export default router;
