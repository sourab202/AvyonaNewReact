import { Router } from "express";
import { createOrder, downloadOrderInvoice, getAdminOrderDetails, listOrders, previewAdminInvoice, trackOrder, updateOrderStatus } from "../../controllers/orderController.js";
import {
  createRazorpayOrder,
  getRazorpayPaymentStatus,
  verifyRazorpayPayment
} from "../../controllers/razorpayPaymentController.js";
import { optionalAnyAuth, optionalCustomerAuth, requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { requireAdminPermission } from "../../utils/accessControl.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("orders", "view")), asyncHandler(listOrders));
router.post("/", asyncHandler(optionalCustomerAuth), asyncHandler(createOrder));
router.post("/payment/razorpay/order", asyncHandler(optionalCustomerAuth), asyncHandler(createRazorpayOrder));
router.post("/payment/razorpay/verify", asyncHandler(optionalCustomerAuth), asyncHandler(verifyRazorpayPayment));
router.get("/payment/razorpay/status", asyncHandler(optionalCustomerAuth), asyncHandler(getRazorpayPaymentStatus));
router.post("/track", asyncHandler(trackOrder));
router.get("/invoice-preview", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("orders", "view")), asyncHandler(previewAdminInvoice));
router.get("/:orderNumber/invoice", asyncHandler(optionalAnyAuth), asyncHandler(downloadOrderInvoice));
router.get("/:id", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("orders", "view")), asyncHandler(getAdminOrderDetails));
router.patch("/:id/status", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("orders", "edit")), asyncHandler(updateOrderStatus));

export default router;
