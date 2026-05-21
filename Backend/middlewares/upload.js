import fs from "fs";
import path from "path";
import multer from "multer";

const uploadDirectory = path.resolve(process.cwd(), "uploads");
const inventoryUploadDirectory = path.resolve(uploadDirectory, "inventory");
const settingsUploadDirectory = path.resolve(uploadDirectory, "settings");
const footerUploadDirectory = path.resolve(uploadDirectory, "footer");
const blogUploadDirectory = path.resolve(uploadDirectory, "blogs");
const allowedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);
const allowedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".svg"]);
const allowedCouponImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedCouponImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const allowedBlogImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedBlogImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const allowedFooterImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedFooterImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const allowedVideoMimeTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const allowedVideoExtensions = new Set([".mp4", ".webm", ".mov"]);

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

if (!fs.existsSync(inventoryUploadDirectory)) {
  fs.mkdirSync(inventoryUploadDirectory, { recursive: true });
}

if (!fs.existsSync(settingsUploadDirectory)) {
  fs.mkdirSync(settingsUploadDirectory, { recursive: true });
}

if (!fs.existsSync(footerUploadDirectory)) {
  fs.mkdirSync(footerUploadDirectory, { recursive: true });
}

if (!fs.existsSync(blogUploadDirectory)) {
  fs.mkdirSync(blogUploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, uploadDirectory),
  filename: (_request, file, callback) => {
    const safeName = `${Date.now()}-${String(file.originalname || "media")
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")}`;
    callback(null, safeName);
  }
});

const inventoryStorage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, inventoryUploadDirectory),
  filename: (_request, file, callback) => {
    const safeName = `${Date.now()}-${String(file.originalname || "inventory.xlsx")
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")}`;
    callback(null, safeName.endsWith(".xlsx") ? safeName : `${safeName}.xlsx`);
  }
});

const settingsAssetStorage = multer.diskStorage({
  destination: (request, _file, callback) => {
    const assetType = String(request.body?.assetType || request.query?.assetType || "").trim().toLowerCase();
    const uploadTarget = assetType.startsWith("footer-") ? footerUploadDirectory : settingsUploadDirectory;
    callback(null, uploadTarget);
  },
  filename: (_request, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const safeBaseName = String(path.basename(file.originalname || "settings-asset", extension))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "settings-asset";
    callback(null, `${Date.now()}-${safeBaseName}${extension}`);
  }
});

const footerImageStorage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, footerUploadDirectory),
  filename: (_request, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const safeBaseName = String(path.basename(file.originalname || "footer-image", extension))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "footer-image";
    callback(null, `${Date.now()}-${safeBaseName}${extension}`);
  }
});

const blogImageStorage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, blogUploadDirectory),
  filename: (_request, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const safeBaseName = String(path.basename(file.originalname || "blog-image", extension))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "blog-image";
    callback(null, `${Date.now()}-${safeBaseName}${extension}`);
  }
});

function createUploadError(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function fileFilter(_request, file, callback) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  if (!allowedImageMimeTypes.has(file.mimetype) || !allowedImageExtensions.has(extension)) {
    callback(new Error("Only JPG, PNG, WebP, and SVG image uploads are allowed"));
    return;
  }
  callback(null, true);
}

function couponImageFileFilter(_request, file, callback) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  if (!allowedCouponImageMimeTypes.has(file.mimetype) || !allowedCouponImageExtensions.has(extension)) {
    callback(new Error("Only JPG, PNG, and WebP coupon background images are allowed"));
    return;
  }
  callback(null, true);
}

function blogImageFileFilter(_request, file, callback) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  if (!file.mimetype.startsWith("image/") || !allowedBlogImageMimeTypes.has(file.mimetype) || !allowedBlogImageExtensions.has(extension)) {
    callback(createUploadError("Only JPG, PNG, and WebP blog images are allowed"));
    return;
  }
  callback(null, true);
}

function footerImageFileFilter(_request, file, callback) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  if (!allowedFooterImageMimeTypes.has(file.mimetype) || !allowedFooterImageExtensions.has(extension)) {
    callback(createUploadError("Only JPG, PNG, and WebP footer images are allowed"));
    return;
  }
  callback(null, true);
}

function mediaFileFilter(_request, file, callback) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  if (file.mimetype.startsWith("image/") && (!allowedImageMimeTypes.has(file.mimetype) || !allowedImageExtensions.has(extension))) {
    callback(new Error("Only JPG, PNG, WebP, and SVG image uploads are allowed"));
    return;
  }

  if (file.mimetype.startsWith("video/") && (!allowedVideoMimeTypes.has(file.mimetype) || !allowedVideoExtensions.has(extension))) {
    callback(new Error("Only MP4, WebM, and MOV video uploads are allowed"));
    return;
  }

  if (!file.mimetype.startsWith("image/") && !file.mimetype.startsWith("video/")) {
    callback(new Error("Only safe image and video uploads are allowed"));
    return;
  }
  callback(null, true);
}

function inventoryFileFilter(_request, file, callback) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  const allowedInventoryMimeTypes = new Set([
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
    "application/zip"
  ]);
  if (extension !== ".xlsx" || !allowedInventoryMimeTypes.has(file.mimetype)) {
    callback(new Error("Only .xlsx inventory files are allowed"));
    return;
  }

  callback(null, true);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

export const uploadCouponImage = multer({
  storage,
  fileFilter: couponImageFileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

export const uploadMedia = multer({
  storage,
  fileFilter: mediaFileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024
  }
});

export const uploadInventory = multer({
  storage: inventoryStorage,
  fileFilter: inventoryFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

export const uploadSettingsAsset = multer({
  storage: settingsAssetStorage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});

export const uploadFooterImage = multer({
  storage: footerImageStorage,
  fileFilter: footerImageFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});

export const uploadBlogImage = multer({
  storage: blogImageStorage,
  fileFilter: blogImageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});
