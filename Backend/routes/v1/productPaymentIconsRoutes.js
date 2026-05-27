import { Router } from "express";
import { getPublicProductPaymentIcons } from "../../controllers/settingsController.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(getPublicProductPaymentIcons));

export default router;
