import { Router } from "express";
import {
  getActivityLog,
  listActivityLogs,
  requireActivityHistoryRole
} from "../../controllers/activityLogController.js";
import { requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.use(asyncHandler(requireAdminAuth));
router.use(requireActivityHistoryRole);
router.get("/", asyncHandler(listActivityLogs));
router.get("/:id", asyncHandler(getActivityLog));

export default router;
