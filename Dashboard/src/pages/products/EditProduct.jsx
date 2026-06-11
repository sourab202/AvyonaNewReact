import React from "react";
import { Link, useParams } from "react-router-dom";
import AddProduct, { buildProductFormDataFromStorefrontProduct } from "./AddProduct";
import { allProducts } from "../../data/storefront-content";
import { fetchProduct } from "../../api/adminApi";

function normalizeBackendProduct(product) {
  const imageUrl = product.imageUrl || "";
  const gallery = Array.isArray(product.galleryUrls) && product.galleryUrls.length
    ? product.galleryUrls
    : (imageUrl ? [imageUrl] : []);

  return {
    id: product.id,
    asin: product.asin,
    sku: product.asin,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.categoryName || "",
    collectionSlug: product.categorySlug || "",
    price: Number(product.price || 0),
    mrp: Number(product.mrp || product.price || 0),
    image: gallery[0] || imageUrl,
    gallery,
    highlights: Array.isArray(product.highlights) ? product.highlights : [product.shortDescription].filter(Boolean),
    description: product.description || "",
    availableStock: Number(product.stockQuantity || 0),
    stockTone: Number(product.stockQuantity || 0) > 0 ? "in-stock" : "out-of-stock",
    stockNote: Number(product.stockQuantity || 0) > 0 ? "In stock" : "Out of stock",
    variants: [],
    specGroups: Array.isArray(product.specs) ? product.specs : [],
    faqs: Array.isArray(product.faqs) ? product.faqs : [],
    policies: Array.isArray(product.policies) ? product.policies : []
  };
}

export default function EditProduct() {
  const { productId } = useParams();
  const [backendProduct, setBackendProduct] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");

  React.useEffect(() => {
    let isMounted = true;

    async function loadProduct() {
      setIsLoading(true);
      setLoadError("");

      try {
        const response = await fetchProduct(productId);
        if (!isMounted) return;
        setBackendProduct(normalizeBackendProduct(response.data?.data || {}));
      } catch (error) {
        if (!isMounted) return;
        setLoadError(error.response?.data?.message || "Unable to load product from backend.");
        setBackendProduct(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [productId]);

  const fallbackProduct = React.useMemo(
    () => allProducts.find((entry) => entry.slug === productId || String(entry.id || "") === String(productId)),
    [productId]
  );
  const product = backendProduct || fallbackProduct;

  const initialProductData = React.useMemo(
    () => (product ? buildProductFormDataFromStorefrontProduct(product) : null),
    [product]
  );

  if (isLoading) {
    return (
      <div style={{ padding: "20px", borderRadius: "12px", background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", color: "#475569", fontWeight: 700 }}>
        Loading product details...
      </div>
    );
  }

  if (!product || !initialProductData) {
    return (
      <div style={{ display: "grid", gap: "16px" }}>
        <div>
          <h2 style={{ margin: 0 }}>Edit Product</h2>
          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            We could not find a product matching this dashboard route.
          </p>
          {loadError ? <p style={{ margin: "8px 0 0", color: "#b91c1c" }}>{loadError}</p> : null}
        </div>
        <div
          style={{
            padding: "20px",
            borderRadius: "12px",
            background: "#fff",
            boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
            display: "grid",
            gap: "12px"
          }}
        >
          <p style={{ margin: 0, color: "#475569" }}>
            Return to the products table and choose another item to edit.
          </p>
          <div>
            <Link
              to="/dashboard/products"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "40px",
                padding: "0 16px",
                borderRadius: "8px",
                background: "#16a34a",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 700
              }}
            >
              Back to Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <AddProduct initialProductData={initialProductData} mode="edit" />;
}
