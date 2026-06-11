import { Router } from "express";
import {
  captureAbandonedCheckout,
  getAdminAbandonedCheckout,
  listAdminAbandonedCheckouts,
  markAbandonedCheckoutRecovered,
  recoverAbandonedCheckout,
  updateAdminAbandonedCheckoutStatus
} from "../../controllers/abandonedCheckoutController.js";
import { optionalCustomerAuth, requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { requireAdminPermission } from "../../utils/accessControl.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.post("/capture", asyncHandler(optionalCustomerAuth), asyncHandler(captureAbandonedCheckout));
router.post("/:token/recover", asyncHandler(optionalCustomerAuth), asyncHandler(recoverAbandonedCheckout));
router.post("/mark-recovered", asyncHandler(optionalCustomerAuth), asyncHandler(markAbandonedCheckoutRecovered));
router.get("/", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("orders", "view")), asyncHandler(listAdminAbandonedCheckouts));
router.get("/:id", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("orders", "view")), asyncHandler(getAdminAbandonedCheckout));
router.patch("/:id/status", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("orders", "edit")), asyncHandler(updateAdminAbandonedCheckoutStatus));

export default router;
