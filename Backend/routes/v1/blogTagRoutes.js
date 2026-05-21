import { Router } from "express";
import { createBlogTag, deleteBlogTag, listBlogTags, updateBlogTag } from "../../controllers/blogController.js";
import { requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { requireAdminPermission } from "../../utils/accessControl.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("blogs", "view")), asyncHandler(listBlogTags));
router.post("/", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("blogs", "create")), asyncHandler(createBlogTag));
router.put("/:id", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("blogs", "edit")), asyncHandler(updateBlogTag));
router.delete("/:id", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("blogs", "delete")), asyncHandler(deleteBlogTag));

export default router;
