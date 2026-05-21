import { Router } from "express";
import { listPublicBlogTags } from "../../controllers/blogController.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listPublicBlogTags));

export default router;
