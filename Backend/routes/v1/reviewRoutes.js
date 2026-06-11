import { Router } from "express";
import {
  createAdminReview,
  deleteReview,
  editReview,
  getReviews,
  getStorefrontProductReviewMedia,
  getStorefrontProductReviews,
  getStorefrontProductReviewSummary,
  patchReviewReply,
  patchReviewVisibility,
  submitGuestReview,
  uploadCustomerReviewMedia
} from "../../controllers/reviewController.js";
import { optionalCustomerAuth, requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { uploadMedia } from "../../middlewares/upload.js";
import { requireAdminPermission } from "../../utils/accessControl.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.get("/product/:productId/summary", asyncHandler(getStorefrontProductReviewSummary));
router.get("/product/:productId/media", asyncHandler(optionalCustomerAuth), asyncHandler(getStorefrontProductReviewMedia));
router.get("/product/:productId", asyncHandler(optionalCustomerAuth), asyncHandler(getStorefrontProductReviews));
router.post("/media", uploadMedia.single("media"), asyncHandler(uploadCustomerReviewMedia));
router.post("/guest", asyncHandler(submitGuestReview));
router.get("/", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("reviews", "view")), asyncHandler(getReviews));
router.post("/", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("reviews", "create")), asyncHandler(createAdminReview));
router.patch("/:reviewId", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("reviews", "edit")), asyncHandler(editReview));
router.patch("/:reviewId/reply", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("reviews", "edit")), asyncHandler(patchReviewReply));
router.patch("/:reviewId/visibility", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("reviews", "edit")), asyncHandler(patchReviewVisibility));
router.delete("/:reviewId", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("reviews", "delete")), asyncHandler(deleteReview));

export default router;
