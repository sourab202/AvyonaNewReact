import { Router } from "express";
import { getPublicWhyShop } from "../../controllers/settingsController.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.get("/why-shop", asyncHandler(getPublicWhyShop));

export default router;
