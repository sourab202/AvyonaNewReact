import { Router } from "express";
import { getPublicBlogBySlug, listHomepageBlogs, listPublicBlogs } from "../../controllers/blogController.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.get("/homepage", asyncHandler(listHomepageBlogs));
router.get("/", asyncHandler(listPublicBlogs));
router.get("/:slug", asyncHandler(getPublicBlogBySlug));

export default router;
