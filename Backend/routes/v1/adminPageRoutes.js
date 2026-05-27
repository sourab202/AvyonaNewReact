import { Router } from "express";
import {
  createAdminPage,
  createAdminPageBlock,
  deleteAdminPage,
  deleteAdminPageBlock,
  duplicateAdminPage,
  getAdminPage,
  listAdminPages,
  reorderAdminPageBlocks,
  updateAdminPage,
  updateAdminPageBlock,
  updateAdminPageStatus,
  uploadAdminPageImage
} from "../../controllers/adminCustomPageController.js";
import { requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { uploadCustomPageImage } from "../../middlewares/upload.js";
import { requireAdminPermission } from "../../utils/accessControl.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.use(asyncHandler(requireAdminAuth));

router.get("/", asyncHandler(requireAdminPermission("pages", "view")), asyncHandler(listAdminPages));
router.post("/", asyncHandler(requireAdminPermission("pages", "create")), asyncHandler(createAdminPage));
router.post("/upload", asyncHandler(requireAdminPermission("pages", "create")), uploadCustomPageImage.single("image"), asyncHandler(uploadAdminPageImage));
router.get("/:id", asyncHandler(requireAdminPermission("pages", "view")), asyncHandler(getAdminPage));
router.put("/:id", asyncHandler(requireAdminPermission("pages", "edit")), asyncHandler(updateAdminPage));
router.delete("/:id", asyncHandler(requireAdminPermission("pages", "delete")), asyncHandler(deleteAdminPage));
router.patch("/:id/status", asyncHandler(requireAdminPermission("pages", "publish")), asyncHandler(updateAdminPageStatus));
router.post("/:id/duplicate", asyncHandler(requireAdminPermission("pages", "create")), asyncHandler(duplicateAdminPage));
router.post("/:pageId/blocks", asyncHandler(requireAdminPermission("pages", "edit")), asyncHandler(createAdminPageBlock));
router.put("/:pageId/blocks/:blockId", asyncHandler(requireAdminPermission("pages", "edit")), asyncHandler(updateAdminPageBlock));
router.delete("/:pageId/blocks/:blockId", asyncHandler(requireAdminPermission("pages", "delete")), asyncHandler(deleteAdminPageBlock));
router.patch("/:pageId/blocks/reorder", asyncHandler(requireAdminPermission("pages", "edit")), asyncHandler(reorderAdminPageBlocks));

export default router;
