import multer from "multer";
import { Router } from "express";
import {
  createAdminBlog,
  deleteAdminBlog,
  getAdminBlog,
  listAdminBlogs,
  updateAdminBlog,
  updateAdminBlogHomepage,
  updateAdminBlogStatus,
  uploadBlogImage
} from "../../controllers/blogController.js";
import { requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { uploadBlogImage as uploadBlogImageMiddleware } from "../../middlewares/upload.js";
import { requireAdminPermission } from "../../utils/accessControl.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

function handleBlogUpload(request, response, next) {
  uploadBlogImageMiddleware.single("image")(request, response, (error) => {
    if (!error) {
      next();
      return;
    }

    const statusCode = error instanceof multer.MulterError || error.statusCode === 400 ? 400 : 500;
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "Blog image must be 5 MB or smaller"
      : error.message || "Blog image upload failed";

    response.status(statusCode).json({
      success: false,
      message
    });
  });
}

router.get("/", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("blogs", "view")), asyncHandler(listAdminBlogs));
router.post("/", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("blogs", "create")), asyncHandler(createAdminBlog));
router.post(
  "/upload",
  asyncHandler(requireAdminAuth),
  asyncHandler(requireAdminPermission("blogs", "create")),
  handleBlogUpload,
  asyncHandler(uploadBlogImage)
);
router.get("/:id", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("blogs", "view")), asyncHandler(getAdminBlog));
router.put("/:id", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("blogs", "edit")), asyncHandler(updateAdminBlog));
router.delete("/:id", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("blogs", "delete")), asyncHandler(deleteAdminBlog));
router.patch("/:id/status", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("blogs", "publish")), asyncHandler(updateAdminBlogStatus));
router.patch("/:id/homepage", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("blogs", "edit")), asyncHandler(updateAdminBlogHomepage));

export default router;
