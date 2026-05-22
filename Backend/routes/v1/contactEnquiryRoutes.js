import { Router } from "express";
import {
  createContactEnquiry,
  deleteContactEnquiry,
  getContactEnquiry,
  listContactEnquiries,
  updateContactEnquiryStatus
} from "../../controllers/contactEnquiryController.js";
import { requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { rateLimit } from "../../middlewares/rateLimit.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requireAdminPermission } from "../../utils/accessControl.js";

const router = Router();
const contactSubmissionRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, keyPrefix: "contact-enquiry" });

router.post("/", contactSubmissionRateLimit, asyncHandler(createContactEnquiry));
router.get("/", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("contact_enquiries", "view")), asyncHandler(listContactEnquiries));
router.get("/:id", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("contact_enquiries", "view")), asyncHandler(getContactEnquiry));
router.patch("/:id/status", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("contact_enquiries", "edit")), asyncHandler(updateContactEnquiryStatus));
router.delete("/:id", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("contact_enquiries", "delete")), asyncHandler(deleteContactEnquiry));

export default router;
