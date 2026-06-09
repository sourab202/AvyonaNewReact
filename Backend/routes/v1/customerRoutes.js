import { Router } from "express";
import { getCustomerDetails, listCustomers, updateCustomerBusinessDetails } from "../../controllers/customerController.js";
import { requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { requireAdminPermission } from "../../utils/accessControl.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("customers", "view")), asyncHandler(listCustomers));
router.get("/:id", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("customers", "view")), asyncHandler(getCustomerDetails));
router.patch("/:id/business-details", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("customers", "edit")), asyncHandler(updateCustomerBusinessDetails));

export default router;
