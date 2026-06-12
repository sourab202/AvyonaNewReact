import fs from "node:fs/promises";
import path from "node:path";
import { pool, query } from "../config/db.js";

const baseUrl = process.env.API_BASE_URL || "http://localhost:4000/api/v1";
const adminToken = process.env.ADMIN_TEST_TOKEN || "local-dev-admin-token";
const stamp = Date.now();
const asin = `SOFT${stamp}`.slice(0, 32);
const sku = `SOFT-SKU-${stamp}`;
const slug = `soft-delete-test-${stamp}`;
const results = [];
let productId = null;
let imageUrl = "";

function check(label, condition) {
  results.push({ label, passed: Boolean(condition) });
  if (!condition) throw new Error(label);
}

async function request(route, options = {}) {
  const headers = {
    Authorization: `Bearer ${adminToken}`,
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {})
  };
  const response = await fetch(`${baseUrl}${route}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function cleanup() {
  if (productId) {
    await query("DELETE FROM products WHERE id = ?", [productId]).catch(() => undefined);
  }
  if (imageUrl) {
    const filename = imageUrl.replace(/^\/uploads\//, "");
    await query("DELETE FROM uploaded_assets WHERE url = ?", [imageUrl]).catch(() => undefined);
    await fs.rm(path.resolve(process.cwd(), "uploads", filename), { force: true }).catch(() => undefined);
    const metadataPath = path.resolve(process.cwd(), "data", "website-image-assets.json");
    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));
      delete metadata[imageUrl];
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    } catch {
      // Metadata cleanup is best effort for isolated lifecycle test records.
    }
  }
}

try {
  const categories = await request("/categories");
  const category = (categories.payload.data || []).find((item) => item.id);
  check("A product category is available for lifecycle testing", Boolean(category?.id));

  const productPayload = {
    categoryId: category.id,
    asin,
    sku,
    name: `Soft Delete Test ${stamp}`,
    slug,
    brand: "Lifecycle Test",
    price: 999,
    mrp: 1299,
    stockQuantity: 5,
    status: "draft"
  };
  const created = await request("/products", { method: "POST", body: JSON.stringify(productPayload) });
  productId = created.payload.data?.id;
  check("Product can be created", created.response.status === 201 && Boolean(productId));

  const deleted = await request(`/products/${productId}`, { method: "DELETE" });
  check("Product delete endpoint succeeds", deleted.response.ok);
  const [deletedRow] = await query("SELECT is_deleted AS isDeleted, deleted_at AS deletedAt FROM products WHERE id = ?", [productId]);
  check("Product row is retained as soft deleted", deletedRow?.isDeleted === 1 && Boolean(deletedRow.deletedAt));

  const publicProduct = await request(`/products/${productId}`);
  check("Soft-deleted product is hidden from public product lookup", publicProduct.response.status === 404);

  const recycleBin = await request(`/products/deleted/list?search=${encodeURIComponent(asin)}`);
  check("Deleted product is visible in the admin recovery list", recycleBin.response.ok && recycleBin.payload.data?.some((item) => Number(item.id) === Number(productId)));

  const recreated = await request("/products", {
    method: "POST",
    body: JSON.stringify({ ...productPayload, name: `Restored Product ${stamp}` })
  });
  check("Adding the same product restores the deleted row", recreated.response.ok && recreated.payload.action === "restored" && Number(recreated.payload.data?.id) === Number(productId));
  const duplicateCount = await query("SELECT COUNT(*) AS total FROM products WHERE asin = ?", [asin]);
  check("Product recovery does not create a duplicate row", Number(duplicateCount[0]?.total) === 1);

  await request(`/products/${productId}`, { method: "DELETE" });
  const restored = await request(`/products/${productId}/restore`, { method: "PATCH" });
  check("Product can be explicitly restored", restored.response.ok && restored.payload.action === "restored");

  const imageForm = new FormData();
  imageForm.append("image", new Blob(["soft-delete-image"], { type: "image/png" }), `soft-delete-${stamp}.png`);
  const uploaded = await request("/uploads/image", { method: "POST", body: imageForm });
  imageUrl = uploaded.payload.data?.url || "";
  check("Image can be uploaded", uploaded.response.status === 201 && imageUrl.startsWith("/uploads/"));

  const deletedImage = await request("/uploads/images", {
    method: "DELETE",
    body: JSON.stringify({ url: imageUrl })
  });
  check("Image is moved to deleted items", deletedImage.response.ok);
  const imagePath = path.resolve(process.cwd(), "uploads", imageUrl.replace(/^\/uploads\//, ""));
  await fs.access(imagePath);
  check("Soft-deleted image file remains on disk", true);

  const deletedImages = await request("/uploads/images?includeDeleted=true");
  check("Deleted image appears in the recovery list", deletedImages.response.ok && deletedImages.payload.data?.some((item) => item.url === imageUrl && item.isDeleted));

  const restoredImage = await request("/uploads/images/restore", {
    method: "PATCH",
    body: JSON.stringify({ url: imageUrl })
  });
  check("Deleted image can be restored", restoredImage.response.ok);
  const [assetRow] = await query("SELECT is_deleted AS isDeleted, status FROM uploaded_assets WHERE url = ? ORDER BY id DESC LIMIT 1", [imageUrl]);
  check("Restored image metadata is active", assetRow?.isDeleted === 0 && assetRow.status === "active");
} finally {
  await cleanup();
  await pool.end();
}

for (const result of results) {
  console.log(`${result.passed ? "PASS" : "FAIL"} ${result.label}`);
}
console.log(`\nAll ${results.length} soft-delete lifecycle checks passed.`);
