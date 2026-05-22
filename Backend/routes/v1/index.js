import { Router } from "express";
import { pingDatabase } from "../../config/db.js";
import adminAuthRoutes from "./adminAuthRoutes.js";
import adminFooterItemsRoutes from "./adminFooterItemsRoutes.js";
import adminFooterRoutes from "./adminFooterRoutes.js";
import adminFooterSettingsRoutes from "./adminFooterSettingsRoutes.js";
import analyticsRoutes from "./analyticsRoutes.js";
import blogRoutes from "./blogRoutes.js";
import blogTagRoutes from "./blogTagRoutes.js";
import categoryRoutes from "./categoryRoutes.js";
import contactEnquiryRoutes from "./contactEnquiryRoutes.js";
import { deleteContactEnquiry } from "../../controllers/contactEnquiryController.js";
import customerRoutes from "./customerRoutes.js";
import customerAccountRoutes from "./customerAccountRoutes.js";
import creditPointsRoutes from "./creditPointsRoutes.js";
import adminCreditPointsRoutes from "./adminCreditPointsRoutes.js";
import couponRoutes from "./couponRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import orderRoutes from "./orderRoutes.js";
import productRoutes from "./productRoutes.js";
import publicFooterRoutes from "./publicFooterRoutes.js";
import publicBlogRoutes from "./publicBlogRoutes.js";
import publicBlogTagRoutes from "./publicBlogTagRoutes.js";
import reviewRoutes from "./reviewRoutes.js";
import seoRoutes from "./seoRoutes.js";
import settingsRoutes from "./settingsRoutes.js";
import uploadRoutes from "./uploadRoutes.js";
import variantGroupRoutes from "./variantGroupRoutes.js";
import {
  getAdminThemeSettings,
  getPublicThemeSettings,
  updateAdminThemeSettings
} from "../../controllers/settingsController.js";
import { requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { requireAdminPermission } from "../../utils/accessControl.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.get("/health", async (_request, response) => {
  let database = "connected";

  try {
    await pingDatabase();
  } catch {
    database = "unavailable";
  }

  response.json({
    success: true,
    message: "Avyona backend is running",
    services: {
      api: "ok",
      database
    }
  });
});

router.use("/admin/auth", adminAuthRoutes);
router.use("/admin/footer", adminFooterRoutes);
router.use("/admin/footer-settings", adminFooterSettingsRoutes);
router.use("/admin/footer-items", adminFooterItemsRoutes);
router.get(
  "/admin/theme-settings",
  asyncHandler(requireAdminAuth),
  asyncHandler(requireAdminPermission("theme_settings", "view")),
  asyncHandler(getAdminThemeSettings)
);
router.put(
  "/admin/theme-settings",
  asyncHandler(requireAdminAuth),
  asyncHandler(requireAdminPermission("theme_settings", "edit")),
  asyncHandler(updateAdminThemeSettings)
);
router.use("/admin/blogs", blogRoutes);
router.use("/admin/blog-tags", blogTagRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/footer", publicFooterRoutes);
router.get("/theme-settings", asyncHandler(getPublicThemeSettings));
router.use("/blogs", publicBlogRoutes);
router.use("/blog-tags", publicBlogTagRoutes);
router.use("/categories", categoryRoutes);
router.use("/contact-enquiries", contactEnquiryRoutes);
router.delete(
  "/admin/contact-enquiries/:id",
  asyncHandler(requireAdminAuth),
  asyncHandler(requireAdminPermission("contact_enquiries", "delete")),
  asyncHandler(deleteContactEnquiry)
);
router.use("/products", productRoutes);
router.use("/reviews", reviewRoutes);
router.use("/seo", seoRoutes);
router.use("/variant-groups", variantGroupRoutes);
router.use("/customers", customerRoutes);
router.use("/customer", customerAccountRoutes);
router.use("/customer/credits", creditPointsRoutes);
router.use("/admin/credits", adminCreditPointsRoutes);
router.use("/coupons", couponRoutes);
router.use("/orders", orderRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/settings", settingsRoutes);
router.use("/uploads", uploadRoutes);

export default router;
