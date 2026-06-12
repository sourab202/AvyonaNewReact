import { Router } from "express";
import { bootstrapAdmin, getCurrentAdmin, loginAdmin, logoutAdmin } from "../../controllers/adminAuthController.js";
import { requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { rateLimit } from "../../middlewares/rateLimit.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();
const adminAuthRateLimit = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "admin-auth" });
const adminBootstrapRateLimit = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: "admin-bootstrap" });

router.post("/bootstrap", adminBootstrapRateLimit, asyncHandler(bootstrapAdmin));
router.post("/login", adminAuthRateLimit, asyncHandler(loginAdmin));
router.post("/logout", asyncHandler(requireAdminAuth), asyncHandler(logoutAdmin));
router.get("/me", asyncHandler(requireAdminAuth), asyncHandler(getCurrentAdmin));

export default router;
