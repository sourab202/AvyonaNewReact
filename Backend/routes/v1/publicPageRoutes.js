import { Router } from "express";
import {
  getPublicFooterPages,
  getPublicHeaderPages,
  getPublicPageBySlug,
  listPublicPages
} from "../../controllers/publicCustomPageController.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listPublicPages));
router.get("/navigation/header", asyncHandler(getPublicHeaderPages));
router.get("/navigation/footer", asyncHandler(getPublicFooterPages));
router.get("/:slug", asyncHandler(getPublicPageBySlug));

export default router;
