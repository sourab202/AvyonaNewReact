import { Router } from "express";
import {
  activateCoupon,
  createCoupon,
  deactivateCoupon,
  deleteCoupon,
  getCouponById,
  listHomepageOffers,
  listProductPageOffers,
  listCoupons,
  updateCoupon,
  updateCouponStatus,
  uploadCouponBackgroundImage,
  validateCouponForCheckout
} from "../../controllers/couponController.js";
import { optionalCustomerAuth, requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { uploadCouponImage } from "../../middlewares/upload.js";
import { requireAdminPermission } from "../../utils/accessControl.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listCoupons));
router.get("/homepage-offers", asyncHandler(listHomepageOffers));
router.get("/product-page-offers", asyncHandler(listProductPageOffers));
router.get("/product-offers", asyncHandler(listProductPageOffers));
router.get("/offers/homepage", asyncHandler(listHomepageOffers));
router.get("/offers/product-page", asyncHandler(listProductPageOffers));
router.post("/validate", asyncHandler(optionalCustomerAuth), asyncHandler(validateCouponForCheckout));
router.post("/background-image", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("coupons", "edit")), uploadCouponImage.single("image"), asyncHandler(uploadCouponBackgroundImage));
router.get("/:id", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("coupons", "view")), asyncHandler(getCouponById));
router.post("/", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("coupons", "create")), asyncHandler(createCoupon));
router.put("/:id", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("coupons", "edit")), asyncHandler(updateCoupon));
router.patch("/:id/status", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("coupons", "edit")), asyncHandler(updateCouponStatus));
router.patch("/:id/activate", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("coupons", "edit")), asyncHandler(activateCoupon));
router.patch("/:id/deactivate", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("coupons", "edit")), asyncHandler(deactivateCoupon));
router.delete("/:id", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("coupons", "delete")), asyncHandler(deleteCoupon));

export default router;
