import { Router } from "express";
import { getPublicFooter } from "../../controllers/footerController.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(getPublicFooter));

export default router;
