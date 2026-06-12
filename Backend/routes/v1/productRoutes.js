import { Router } from "express";
import {
  createProduct,
  cancelInventoryImportJob,
  createInventoryExportJob,
  createInventoryImportJob,
  deleteProduct,
  downloadInventoryExportFile,
  downloadInventoryImportOriginal,
  exportInventoryProducts,
  getInventoryExportJob,
  getInventoryImportJob,
  listInventoryExportJobs,
  getProductById,
  listInventoryImportFailedRows,
  listInventoryImportHistory,
  listDeletedProducts,
  retryInventoryImportFailedRows,
  listProducts,
  restoreProduct,
  startInventoryImportJob,
  updateProduct,
  validateInventoryImport,
  upsertProductByAsinSku
} from "../../controllers/productController.js";
import { requireAdminAuth } from "../../middlewares/authMiddleware.js";
import { uploadInventory } from "../../middlewares/upload.js";
import { requireAdminPermission } from "../../utils/accessControl.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listProducts));
router.get("/inventory/export", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "view")), asyncHandler(exportInventoryProducts));
router.post("/inventory/export/jobs", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "view")), asyncHandler(createInventoryExportJob));
router.get("/inventory/export/jobs", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "view")), asyncHandler(listInventoryExportJobs));
router.get("/inventory/export/jobs/:jobId", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "view")), asyncHandler(getInventoryExportJob));
router.get("/inventory/export/jobs/:jobId/download", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "view")), asyncHandler(downloadInventoryExportFile));
router.get("/inventory/history", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "view")), asyncHandler(listInventoryImportHistory));
router.get("/inventory/failed-rows", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "view")), asyncHandler(listInventoryImportFailedRows));
router.post("/inventory/validate", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "edit")), asyncHandler(validateInventoryImport));
router.post("/inventory/jobs", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "edit")), uploadInventory.single("file"), asyncHandler(createInventoryImportJob));
router.get("/inventory/jobs/:jobId", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "view")), asyncHandler(getInventoryImportJob));
router.get("/inventory/jobs/:jobId/original", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "view")), asyncHandler(downloadInventoryImportOriginal));
router.get("/inventory/jobs/:jobId/failed-rows", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "view")), asyncHandler(listInventoryImportFailedRows));
router.post("/inventory/jobs/:jobId/start", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "edit")), asyncHandler(startInventoryImportJob));
router.post("/inventory/jobs/:jobId/cancel", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "edit")), asyncHandler(cancelInventoryImportJob));
router.post("/inventory/jobs/:jobId/retry-failed", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "edit")), asyncHandler(retryInventoryImportFailedRows));
router.post("/inventory/upsert", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "edit")), asyncHandler(upsertProductByAsinSku));
router.get("/deleted/list", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "view")), asyncHandler(listDeletedProducts));
router.get("/:id", asyncHandler(getProductById));
router.post("/", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "create")), asyncHandler(createProduct));
router.patch("/:id", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "edit")), asyncHandler(updateProduct));
router.patch("/:id/restore", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "edit")), asyncHandler(restoreProduct));
router.delete("/:id", asyncHandler(requireAdminAuth), asyncHandler(requireAdminPermission("products", "delete")), asyncHandler(deleteProduct));

export default router;
