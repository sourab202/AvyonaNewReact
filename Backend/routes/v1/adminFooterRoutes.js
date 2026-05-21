import { Router } from "express";
import { uploadFooterImage } from "../../controllers/footerController.js";
import { requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { uploadFooterImage as uploadFooterImageMiddleware } from "../../middlewares/upload.js";
import { requireAdminPermission } from "../../utils/accessControl.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.post(
  "/upload",
  asyncHandler(requireAdminAuth),
  asyncHandler(requireAdminPermission("settings", "edit")),
  uploadFooterImageMiddleware.single("image"),
  asyncHandler(uploadFooterImage)
);

export default router;
