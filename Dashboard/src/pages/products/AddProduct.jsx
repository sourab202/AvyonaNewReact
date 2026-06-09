import React from "react";
import { FaPlus, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { createProduct, fetchCategories, updateProduct, uploadAdminImage, uploadAdminMedia } from "../../api/adminApi";
import {
  createEmptySpecGroup,
  createEmptySpecItem,
  createEmptyVariant,
  createFaqItem,
  createInitialProductData,
  createPolicyItem
} from "../../data/productFormData";
import { flattenCategoryTree, fallbackCategoryTree } from "../../data/category-data";
import { allProducts, featuredProducts } from "../../data/storefront-content";
import { toStoredUploadUrl } from "../../utils/media";

const sectionCardStyle = {
  background: "#fff",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
  padding: "24px",
  display: "grid",
  gap: "18px"
};

const fieldGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "16px"
};

const fieldStyle = {
  display: "grid",
  gap: "8px",
  color: "#334155",
  fontWeight: 600
};

const inputStyle = {
  width: "100%",
  minHeight: "44px",
  padding: "0 12px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
  background: "#fff"
};

const textareaStyle = {
  ...inputStyle,
  minHeight: "110px",
  padding: "12px"
};

const sectionCopyStyle = {
  margin: 0,
  color: "#64748b"
};

const helperTextStyle = {
  color: "#64748b",
  fontSize: "12px"
};

const smallMutedTextStyle = {
  margin: 0,
  color: "#64748b",
  fontSize: "13px"
};

const actionButtonStyle = {
  padding: "11px 18px",
  borderRadius: "8px",
  fontWeight: 700,
  cursor: "pointer"
};

const uploadDropzoneStyle = {
  minHeight: "160px",
  borderRadius: "14px",
  border: "2px dashed #cbd5e1",
  background: "#f8fafc",
  display: "grid",
  placeItems: "center",
  gap: "8px",
  textAlign: "center",
  padding: "20px",
  cursor: "pointer",
  color: "#334155"
};

const fileListStyle = {
  display: "grid",
  gap: "10px"
};

const fileChipStyle = {
  display: "grid",
  gridTemplateColumns: "72px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "14px",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#0f172a"
};

const filePreviewFrameStyle = {
  width: "72px",
  height: "72px",
  borderRadius: "12px",
  overflow: "hidden",
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  display: "grid",
  placeItems: "center"
};

const imagePreviewStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block"
};

const videoPreviewStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
  background: "#020617"
};

const fileNameStyle = {
  minWidth: 0,
  fontWeight: 600,
  color: "#0f172a",
  wordBreak: "break-word"
};

const fileRemoveButtonStyle = {
  minHeight: "30px",
  padding: "0 10px",
  borderRadius: "999px",
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b91c1c",
  fontWeight: 700,
  cursor: "pointer"
};

function createPseudoUpload(name, url = "") {
  return {
    name,
    url,
    type: ""
  };
}

function normalizeSelectedFiles(files) {
  return Array.from(files || []).map((file) => ({
    name: file.name,
    url: URL.createObjectURL(file),
    type: file.type || "",
    file
  }));
}

function revokePreviewUrl(file) {
  if (file?.url && typeof file.url === "string" && file.url.startsWith("blob:")) {
    URL.revokeObjectURL(file.url);
  }
}

function getTotalStock(product) {
  if (Array.isArray(product.variants) && product.variants.length) {
    return product.variants.reduce((sum, variant) => sum + Number(variant.availableStock || 0), 0);
  }

  return Number(product.availableStock || 0);
}

function getStockStatus(product, totalStock) {
  if (product.stockTone === "out-of-stock" || totalStock <= 0) return "out-of-stock";
  if (totalStock <= 5) return "low-stock";
  return "in-stock";
}

function mapPolicyItems(product) {
  return [
    createPolicyItem("Shipping Information"),
    createPolicyItem("Return & Refund"),
    createPolicyItem("Warranty Support"),
    createPolicyItem("COD Information")
  ].map((item) => {
    if (item.title === "Shipping Information") {
      return {
        ...item,
        content: product.shippingText || ""
      };
    }

    if (item.title === "Return & Refund") {
      return {
        ...item,
        content: product.returnSummary || ""
      };
    }

    if (item.title === "Warranty Support") {
      return {
        ...item,
        content: product.warrantySummary || ""
      };
    }

    return {
      ...item,
      content: product.codText || ""
    };
  });
}

const featuredProductSlugs = new Set(featuredProducts.map((product) => product.slug));

export function buildProductFormDataFromStorefrontProduct(product) {
  const base = createInitialProductData();
  const totalStock = getTotalStock(product);
  const stockStatus = getStockStatus(product, totalStock);
  const productImages = [...new Set([
    product.image,
    ...(Array.isArray(product.gallery) ? product.gallery : [])
  ].filter(Boolean))];

  return {
    ...base,
    id: product.id,
    basicInfo: {
      ...base.basicInfo,
      productName: product.name || "",
      brand: product.brand || "",
      category: product.collectionSlug || "",
      subcategory: product.category || "",
      slug: product.slug || "",
      sku: product.sku || "",
      productType: Array.isArray(product.variants) && product.variants.length ? "variant" : "simple",
      status: product.stockTone === "out-of-stock" ? "inactive" : "active",
      featured: featuredProductSlugs.has(product.slug)
    },
    pricingInventory: {
      ...base.pricingInventory,
      sellingPrice: String(product.price || ""),
      mrp: String(product.mrp || ""),
      taxIncluded: true,
      stockQuantity: String(totalStock || ""),
      lowStockThreshold: "5",
      stockStatus,
      availabilityMessage: product.stockNote || ""
    },
    media: {
      ...base.media,
      images: productImages.map((image, index) => createPseudoUpload(index === 0 ? "Current product image" : `Gallery image ${index + 1}`, image)),
      videos: [
        ...(product.video ? [createPseudoUpload("Current product video", product.video)] : []),
        ...(Array.isArray(product.videoUrls) ? product.videoUrls : [])
          .filter((url) => url && url !== product.video)
          .map((url, index) => createPseudoUpload(`Current product video ${index + 2}`, url))
      ]
    },
    variants: Array.isArray(product.variants) && product.variants.length
      ? product.variants.map((variant) => ({
          id: `${Date.now()}-${Math.random()}`,
          variantType: "Color",
          variantValue: variant.label || "",
          variantPrice: String(variant.price || ""),
          variantSku: variant.key || "",
          variantStock: String(variant.availableStock || ""),
          variantImage: variant.image ? createPseudoUpload(`Variant image - ${variant.label || "Option"}`, variant.image) : null
        }))
      : base.variants,
    highlights: Array.isArray(product.highlights) && product.highlights.length ? product.highlights : base.highlights,
    description: {
      content: Array.isArray(product.description) ? product.description.join("\n\n") : String(product.description || "")
    },
    specifications: Array.isArray(product.specGroups) && product.specGroups.length
      ? product.specGroups.map((group) => ({
          id: `${Date.now()}-${Math.random()}`,
          name: group.title || "",
          items: Array.isArray(group.items) && group.items.length
            ? group.items.map((item) => ({
                id: `${Date.now()}-${Math.random()}`,
                label: item[0] || "",
                value: item[1] || ""
              }))
            : [createEmptySpecItem()]
        }))
      : base.specifications,
    policies: {
      deliveryEstimate: product.deliveryText || "",
      dispatchTime: product.dispatchText || "",
      items: mapPolicyItems(product)
    },
    faqs: Array.isArray(product.faqs) && product.faqs.length
      ? product.faqs.map((faq) => ({
          id: `${Date.now()}-${Math.random()}`,
          question: faq.question || "",
          answer: faq.answer || ""
        }))
      : base.faqs,
    relatedProducts: base.relatedProducts,
    seo: {
      metaTitle: product.name || "",
      metaDescription: Array.isArray(product.description) ? String(product.description[0] || "") : String(product.description || ""),
      metaKeywords: [product.brand, product.category, product.name].filter(Boolean).join(", "),
      canonicalUrl: product.slug ? `https://www.avyona.com/product/${product.slug}` : "",
      ogImage: product.image ? createPseudoUpload("Current OG image", product.image) : null
    }
  };
}

function formatCategoryLabel(categorySlug) {
  return categorySlug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function SectionCard({ title, description, children }) {
  return (
    <section style={sectionCardStyle}>
      <div>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <p style={{ ...sectionCopyStyle, marginTop: "8px" }}>{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function AddProduct({ initialProductData = null, mode = "add" }) {
  const navigate = useNavigate();
  const imageInputRef = React.useRef(null);
  const videoInputRef = React.useRef(null);
  const mediaRef = React.useRef({ images: [], videos: [] });
  const [productData, setProductData] = React.useState(() => initialProductData || createInitialProductData());
  const [isSavingProduct, setIsSavingProduct] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState("");
  const [saveTone, setSaveTone] = React.useState("success");
  const [backendCategories, setBackendCategories] = React.useState([]);
  const {
    basicInfo,
    pricingInventory,
    media,
    variants,
    highlights,
    description: descriptionData,
    specifications: specGroups,
    policies: policyDetails,
    faqs,
    relatedProducts,
    seo
  } = productData;

  const updateSection = (sectionKey, patch) => {
    setProductData((current) => ({
      ...current,
      [sectionKey]: {
        ...current[sectionKey],
        ...patch
      }
    }));
  };
  const updateBasicInfo = (key, value) => {
    updateSection("basicInfo", { [key]: value });
  };
  const updatePricingInventory = (key, value) => {
    updateSection("pricingInventory", { [key]: value });
  };
  const updateMedia = (key, value) => {
    updateSection("media", { [key]: value });
  };
  const appendMediaFiles = React.useCallback((key, files, { multiple = true } = {}) => {
    const nextFiles = normalizeSelectedFiles(files);

    if (!nextFiles.length) return;

    setProductData((current) => {
      const existingFiles = Array.isArray(current.media[key]) ? current.media[key] : [];
      return {
        ...current,
        media: {
          ...current.media,
          [key]: multiple ? [...existingFiles, ...nextFiles] : nextFiles.slice(0, 1)
        }
      };
    });
  }, []);
  const removeMediaFile = React.useCallback((key, indexToRemove) => {
    setProductData((current) => {
      const removedFile = (current.media[key] || [])[indexToRemove];
      revokePreviewUrl(removedFile);

      return {
        ...current,
        media: {
          ...current.media,
          [key]: (current.media[key] || []).filter((_, index) => index !== indexToRemove)
        }
      };
    });
  }, []);
  const handleDropzoneDrop = React.useCallback((event, key, options) => {
    event.preventDefault();
    appendMediaFiles(key, event.dataTransfer?.files || [], options);
  }, [appendMediaFiles]);
  React.useEffect(() => {
    mediaRef.current = {
      images: productData.media.images,
      videos: productData.media.videos
    };
  }, [productData.media.images, productData.media.videos]);
  React.useEffect(() => () => {
    mediaRef.current.images.forEach(revokePreviewUrl);
    mediaRef.current.videos.forEach(revokePreviewUrl);
  }, []);
  const updateVariant = (variantId, key, value) => {
    setProductData((current) => ({
      ...current,
      variants: current.variants.map((variant) => (
        variant.id === variantId ? { ...variant, [key]: value } : variant
      ))
    }));
  };
  const addVariantRow = () => {
    setProductData((current) => ({
      ...current,
      variants: [...current.variants, createEmptyVariant()]
    }));
  };
  const removeVariantRow = (variantId) => {
    setProductData((current) => {
      if (current.variants.length === 1) {
        return { ...current, variants: [createEmptyVariant()] };
      }

      return {
        ...current,
        variants: current.variants.filter((variant) => variant.id !== variantId)
      };
    });
  };
  const updateHighlight = (index, value) => {
    setProductData((current) => ({
      ...current,
      highlights: current.highlights.map((item, itemIndex) => (itemIndex === index ? value : item))
    }));
  };
  const addHighlightField = () => {
    setProductData((current) => ({
      ...current,
      highlights: [...current.highlights, ""]
    }));
  };
  const updateSpecGroupName = (groupId, value) => {
    setProductData((current) => ({
      ...current,
      specifications: current.specifications.map((group) => (group.id === groupId ? { ...group, name: value } : group))
    }));
  };
  const updateSpecItem = (groupId, itemId, key, value) => {
    setProductData((current) => ({
      ...current,
      specifications: current.specifications.map((group) => (
        group.id === groupId
          ? {
              ...group,
              items: group.items.map((item) => (
                item.id === itemId ? { ...item, [key]: value } : item
              ))
            }
          : group
      ))
    }));
  };
  const addSpecGroup = () => {
    setProductData((current) => ({
      ...current,
      specifications: [...current.specifications, createEmptySpecGroup()]
    }));
  };
  const removeSpecGroup = (groupId) => {
    setProductData((current) => {
      if (current.specifications.length === 1) {
        return { ...current, specifications: [createEmptySpecGroup()] };
      }

      return {
        ...current,
        specifications: current.specifications.filter((group) => group.id !== groupId)
      };
    });
  };
  const addSpecItem = (groupId) => {
    setProductData((current) => ({
      ...current,
      specifications: current.specifications.map((group) => (
        group.id === groupId
          ? { ...group, items: [...group.items, createEmptySpecItem()] }
          : group
      ))
    }));
  };
  const removeSpecItem = (groupId, itemId) => {
    setProductData((current) => ({
      ...current,
      specifications: current.specifications.map((group) => {
        if (group.id !== groupId) return group;
        if (group.items.length === 1) {
          return { ...group, items: [createEmptySpecItem()] };
        }

        return { ...group, items: group.items.filter((item) => item.id !== itemId) };
      })
    }));
  };
  const updatePolicyField = (key, value) => {
    updateSection("policies", { [key]: value });
  };
  const updatePolicyItem = (itemId, key, value) => {
    setProductData((current) => ({
      ...current,
      policies: {
        ...current.policies,
        items: current.policies.items.map((item) => (
        item.id === itemId ? { ...item, [key]: value } : item
        ))
      }
    }));
  };
  const addPolicyItem = () => {
    setProductData((current) => ({
      ...current,
      policies: {
        ...current.policies,
        items: [...current.policies.items, createPolicyItem("")]
      }
    }));
  };
  const removePolicyItem = (itemId) => {
    setProductData((current) => ({
      ...current,
      policies: {
        ...current.policies,
        items: current.policies.items.length === 1
          ? [createPolicyItem("")]
          : current.policies.items.filter((item) => item.id !== itemId)
      }
    }));
  };
  const updateFaq = (faqId, key, value) => {
    setProductData((current) => ({
      ...current,
      faqs: current.faqs.map((faq) => (
        faq.id === faqId ? { ...faq, [key]: value } : faq
      ))
    }));
  };
  const addFaq = () => {
    setProductData((current) => ({
      ...current,
      faqs: [...current.faqs, createFaqItem()]
    }));
  };
  const removeFaq = (faqId) => {
    setProductData((current) => {
      if (current.faqs.length === 1) {
        return { ...current, faqs: [createFaqItem()] };
      }

      return {
        ...current,
        faqs: current.faqs.filter((faq) => faq.id !== faqId)
      };
    });
  };
  const updateRelatedProducts = (key, value) => {
    updateSection("relatedProducts", { [key]: value });
  };
  const addManualRelatedProduct = (productSlug) => {
    setProductData((current) => (
      current.relatedProducts.manualSelections.includes(productSlug)
        ? current
        : {
            ...current,
            relatedProducts: {
              ...current.relatedProducts,
              manualSelections: [...current.relatedProducts.manualSelections, productSlug],
              searchTerm: ""
            }
          }
    ));
  };
  const removeManualRelatedProduct = (productSlug) => {
    setProductData((current) => ({
      ...current,
      relatedProducts: {
        ...current.relatedProducts,
        manualSelections: current.relatedProducts.manualSelections.filter((slug) => slug !== productSlug)
      }
    }));
  };
  const updateSeo = (key, value) => {
    updateSection("seo", { [key]: value });
  };

  React.useEffect(() => {
    let isMounted = true;

    async function loadBackendCategories() {
      try {
        const response = await fetchCategories();
        if (!isMounted) return;
        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        setBackendCategories(rows);
      } catch {
        if (isMounted) setBackendCategories([]);
      }
    }

    loadBackendCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  const uploadProductImages = async () => {
    const imageFiles = Array.isArray(media.images) ? media.images : [];
    const uploadedUrls = [];

    for (const image of imageFiles) {
      if (image.file) {
        const response = await uploadAdminImage(image.file);
        const uploadedUrl = response.data?.data?.url || "";
        uploadedUrls.push(toStoredUploadUrl(uploadedUrl));
      } else if (image.url) {
        uploadedUrls.push(image.url);
      }
    }

    return uploadedUrls.filter(Boolean);
  };

  const uploadProductVideos = async () => {
    const videoFiles = Array.isArray(media.videos) ? media.videos : [];
    const uploadedUrls = [];

    for (const video of videoFiles) {
      if (video.file) {
        const response = await uploadAdminMedia(video.file);
        const uploadedUrl = response.data?.data?.url || response.data?.url || "";
        uploadedUrls.push(toStoredUploadUrl(uploadedUrl));
      } else if (video.url) {
        uploadedUrls.push(toStoredUploadUrl(video.url));
      }
    }

    return uploadedUrls.filter(Boolean);
  };

  const buildProductPayload = async (publishStatus) => {
    const productCategorySlug = basicInfo.subcategory || basicInfo.category;
    const categoryRecord = backendCategories.find((category) => category.slug === productCategorySlug);
    const productImageUrls = await uploadProductImages();
    const productVideoUrls = await uploadProductVideos();
    const primaryImageUrl = productImageUrls[0] || "";
    const cleanedHighlights = highlights.map((item) => String(item || "").trim()).filter(Boolean);
    const descriptionText = String(descriptionData.content || "").trim();
    const shortDescription = cleanedHighlights[0] || descriptionText.split(/\n+/)[0] || "";

    return {
      categoryId: categoryRecord?.id || undefined,
      categorySlug: productCategorySlug,
      asin: basicInfo.sku || basicInfo.slug || `AVY-${Date.now()}`,
      name: basicInfo.productName,
      slug: basicInfo.slug,
      brand: basicInfo.brand,
      shortDescription,
      description: descriptionText,
      price: Number(pricingInventory.sellingPrice || 0),
      mrp: Number(pricingInventory.mrp || pricingInventory.sellingPrice || 0),
      stockQuantity: Number(pricingInventory.stockQuantity || 0),
      rating: 0,
      reviewCount: 0,
      imageUrl: primaryImageUrl,
      imageUrls: productImageUrls,
      videoUrls: productVideoUrls,
      status: publishStatus
    };
  };

  const handleSaveProduct = async (publishStatus) => {
    if (!basicInfo.productName.trim() || !basicInfo.brand.trim() || !basicInfo.category || !pricingInventory.sellingPrice) {
      setSaveTone("error");
      setSaveMessage("Product name, brand, category, and selling price are required before saving.");
      return;
    }

    setIsSavingProduct(true);
    setSaveMessage("");

    try {
      const payload = await buildProductPayload(publishStatus);

      if (mode === "edit" && initialProductData?.id) {
        await updateProduct(initialProductData.id, payload);
      } else {
        await createProduct(payload);
      }

      setSaveTone("success");
      setSaveMessage(publishStatus === "active" ? "Product published successfully. It will appear on the storefront after refresh." : "Product draft saved successfully.");
      window.setTimeout(() => navigate("/dashboard/products"), 700);
    } catch (error) {
      setSaveTone("error");
      setSaveMessage(error.response?.data?.message || error.message || "Unable to save product. Check backend login, database connection, and required fields.");
    } finally {
      setIsSavingProduct(false);
    }
  };

  const sellingPrice = Number(pricingInventory.sellingPrice || 0);
  const mrp = Number(pricingInventory.mrp || 0);
  const discountPercentage = mrp > 0 && sellingPrice > 0 && mrp > sellingPrice
    ? Math.round(((mrp - sellingPrice) / mrp) * 100)
    : 0;
  const productCatalog = React.useMemo(
    () => allProducts.map((product) => ({
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      category: product.category,
      collectionSlug: product.collectionSlug,
      price: Number(product.price || product.variants?.[0]?.price || 0)
    })),
    []
  );
  const availableCategories = React.useMemo(() => {
    const sourceCategories = backendCategories.length ? backendCategories : flattenCategoryTree(fallbackCategoryTree);
    return sourceCategories
      .filter((category) => !category.parentId && category.status === "active")
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
  }, [backendCategories]);
  const availableSubcategories = React.useMemo(() => {
    const sourceCategories = backendCategories.length ? backendCategories : flattenCategoryTree(fallbackCategoryTree);
    const selectedCategory = sourceCategories.find((category) => category.slug === basicInfo.category);
    return sourceCategories
      .filter((category) => Number(category.parentId || 0) === Number(selectedCategory?.id || 0))
      .filter((category) => category.status === "active")
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
  }, [backendCategories, basicInfo.category]);
  const autoRelatedEnabled = relatedProducts.selectorMode !== "manual-only" && relatedProducts.autoByCategory;
  const manualRelatedEnabled = relatedProducts.selectorMode !== "auto-only";
  const autoRelatedProducts = React.useMemo(() => {
    if (!autoRelatedEnabled || !basicInfo.category) return [];

    return productCatalog
      .filter((product) => product.collectionSlug === basicInfo.category && product.slug !== basicInfo.slug)
      .slice(0, 8);
  }, [autoRelatedEnabled, basicInfo.category, basicInfo.slug, productCatalog]);
  const manualRelatedProducts = React.useMemo(
    () => relatedProducts.manualSelections
      .map((slug) => productCatalog.find((product) => product.slug === slug))
      .filter(Boolean),
    [productCatalog, relatedProducts.manualSelections]
  );
  const manualSearchResults = React.useMemo(() => {
    if (!manualRelatedEnabled) return [];

    const searchTerm = relatedProducts.searchTerm.trim().toLowerCase();

    return productCatalog
      .filter((product) => product.slug !== basicInfo.slug)
      .filter((product) => !relatedProducts.manualSelections.includes(product.slug))
      .filter((product) => (
        !searchTerm
          || product.name.toLowerCase().includes(searchTerm)
          || product.brand.toLowerCase().includes(searchTerm)
          || product.category.toLowerCase().includes(searchTerm)
          || product.slug.toLowerCase().includes(searchTerm)
      ))
      .slice(0, searchTerm ? 8 : 6);
  }, [basicInfo.slug, manualRelatedEnabled, productCatalog, relatedProducts.manualSelections, relatedProducts.searchTerm]);
  const finalRelatedProducts = React.useMemo(() => {
    const combined = [
      ...(autoRelatedEnabled ? autoRelatedProducts : []),
      ...(manualRelatedEnabled ? manualRelatedProducts : [])
    ];

    return combined.filter((product, index, items) => (
      items.findIndex((item) => item.slug === product.slug) === index
    ));
  }, [autoRelatedEnabled, autoRelatedProducts, manualRelatedEnabled, manualRelatedProducts]);
  const seoTitleLength = seo.metaTitle.trim().length;
  const seoDescriptionLength = seo.metaDescription.trim().length;
  const suggestedCanonicalUrl = basicInfo.slug
    ? `https://www.avyona.com/product/${basicInfo.slug}`
    : "https://www.avyona.com/product/your-product-slug";
  const isEditMode = mode === "edit";
  const actionBar = (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={() => navigate("/dashboard/products")}
        style={{
          ...actionButtonStyle,
          border: "1px solid #cbd5e1",
          background: "#fff",
          color: "#334155"
        }}
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={isSavingProduct}
        onClick={() => handleSaveProduct("draft")}
        style={{
          ...actionButtonStyle,
          border: "1px solid #cbd5e1",
          background: "#fff",
          color: "#334155"
        }}
      >
        {isSavingProduct ? "Saving..." : "Save Draft"}
      </button>
      <button
        type="button"
        disabled={isSavingProduct}
        onClick={() => handleSaveProduct("active")}
        style={{
          ...actionButtonStyle,
          border: "none",
          background: "#16a34a",
          color: "#fff"
        }}
      >
        {isSavingProduct ? "Publishing..." : isEditMode ? "Update Product" : "Publish Product"}
      </button>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap"
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>{isEditMode ? "Edit Product" : "Add Product"}</h2>
          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            {isEditMode
              ? "Update the existing product using the same structured form sections used for product creation."
              : "Use section cards to build the full product setup step by step without making the page messy."}
          </p>
        </div>
        {actionBar}
      </div>

      <SectionCard
        title="Basic Info"
        description="Main product identity details like name, brand, category, SKU, and publishing status."
      >
        <div style={fieldGridStyle}>
          <label style={fieldStyle}>
            <span>Product Name</span>
            <input
              type="text"
              placeholder="Enter product name"
              style={inputStyle}
              value={basicInfo.productName}
              onChange={(event) => updateBasicInfo("productName", event.target.value)}
            />
          </label>
          <label style={fieldStyle}>
            <span>Brand</span>
            <input
              type="text"
              placeholder="Enter brand name"
              style={inputStyle}
              value={basicInfo.brand}
              onChange={(event) => updateBasicInfo("brand", event.target.value)}
            />
          </label>
          <label style={fieldStyle}>
            <span>Category</span>
            <select
              value={basicInfo.category}
              style={inputStyle}
              onChange={(event) => {
                updateBasicInfo("category", event.target.value);
                updateBasicInfo("subcategory", "");
              }}
            >
              <option value="" disabled>Select category</option>
              {availableCategories.map((category) => (
                <option key={category.slug} value={category.slug}>{category.name}</option>
              ))}
            </select>
          </label>
          <label style={fieldStyle}>
            <span>Subcategory</span>
            <select
              style={inputStyle}
              value={basicInfo.subcategory}
              onChange={(event) => updateBasicInfo("subcategory", event.target.value)}
              disabled={!basicInfo.category}
            >
              <option value="">{basicInfo.category ? "Select subcategory" : "Choose category first"}</option>
              {availableSubcategories.map((subcategory) => (
                <option key={subcategory.slug} value={subcategory.slug}>{subcategory.name}</option>
              ))}
            </select>
            <small style={helperTextStyle}>
              Connects product to category and subcategory so frontend listings and filters stay aligned.
            </small>
          </label>
          <label style={fieldStyle}>
            <span>Product Slug</span>
            <input
              type="text"
              placeholder="enter-product-slug"
              style={inputStyle}
              value={basicInfo.slug}
              onChange={(event) => updateBasicInfo("slug", event.target.value)}
            />
          </label>
          <label style={fieldStyle}>
            <span>SKU</span>
            <input
              type="text"
              placeholder="Enter SKU"
              style={inputStyle}
              value={basicInfo.sku}
              onChange={(event) => updateBasicInfo("sku", event.target.value)}
            />
          </label>
          <label style={fieldStyle}>
            <span>Product Type</span>
            <select
              value={basicInfo.productType}
              style={inputStyle}
              onChange={(event) => updateBasicInfo("productType", event.target.value)}
            >
              <option value="" disabled>Select product type</option>
              <option value="simple">Simple Product</option>
              <option value="variant">Variant Product</option>
              <option value="bundle">Bundle Product</option>
            </select>
          </label>
          <label style={fieldStyle}>
            <span>Product Status</span>
            <select
              value={basicInfo.status}
              style={inputStyle}
              onChange={(event) => updateBasicInfo("status", event.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label style={{ ...fieldStyle, justifyContent: "end" }}>
            <span>Featured Product</span>
            <button
              type="button"
              onClick={() => updateBasicInfo("featured", !basicInfo.featured)}
              style={{
                minHeight: "44px",
                borderRadius: "999px",
                border: "1px solid #cbd5e1",
                background: basicInfo.featured ? "#16a34a" : "#f8fafc",
                color: basicInfo.featured ? "#fff" : "#334155",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              {basicInfo.featured ? "Featured: On" : "Featured: Off"}
            </button>
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Pricing & Inventory"
        description="Selling price, MRP, stock quantity, stock note, and product availability."
      >
        <div style={fieldGridStyle}>
          <label style={fieldStyle}>
            <span>Selling Price</span>
            <input
              type="number"
              placeholder="Enter selling price"
              style={inputStyle}
              value={pricingInventory.sellingPrice}
              onChange={(event) => updatePricingInventory("sellingPrice", event.target.value)}
            />
          </label>
          <label style={fieldStyle}>
            <span>MRP</span>
            <input
              type="number"
              placeholder="Enter MRP"
              style={inputStyle}
              value={pricingInventory.mrp}
              onChange={(event) => updatePricingInventory("mrp", event.target.value)}
            />
          </label>
          <label style={fieldStyle}>
            <span>Discount %</span>
            <input
              type="text"
              value={`${discountPercentage}%`}
              readOnly
              style={{ ...inputStyle, background: "#f8fafc", color: "#475569" }}
            />
          </label>
          <label style={{ ...fieldStyle, justifyContent: "end" }}>
            <span>Tax Included</span>
            <button
              type="button"
              onClick={() => updatePricingInventory("taxIncluded", !pricingInventory.taxIncluded)}
              style={{
                minHeight: "44px",
                borderRadius: "999px",
                border: "1px solid #cbd5e1",
                background: pricingInventory.taxIncluded ? "#16a34a" : "#f8fafc",
                color: pricingInventory.taxIncluded ? "#fff" : "#334155",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              {pricingInventory.taxIncluded ? "Tax Included: On" : "Tax Included: Off"}
            </button>
          </label>
          <label style={fieldStyle}>
            <span>Stock Quantity</span>
            <input
              type="number"
              placeholder="Enter stock quantity"
              style={inputStyle}
              value={pricingInventory.stockQuantity}
              onChange={(event) => updatePricingInventory("stockQuantity", event.target.value)}
            />
          </label>
          <label style={fieldStyle}>
            <span>Low Stock Threshold</span>
            <input
              type="number"
              placeholder="Enter low stock threshold"
              style={inputStyle}
              value={pricingInventory.lowStockThreshold}
              onChange={(event) => updatePricingInventory("lowStockThreshold", event.target.value)}
            />
          </label>
          <label style={fieldStyle}>
            <span>Stock Status</span>
            <select
              value={pricingInventory.stockStatus}
              style={inputStyle}
              onChange={(event) => updatePricingInventory("stockStatus", event.target.value)}
            >
              <option value="in-stock">In Stock</option>
              <option value="low-stock">Low Stock</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
          </label>
          <label style={fieldStyle}>
            <span>Availability Message</span>
            <input
              type="text"
              placeholder="Example: Available for immediate dispatch"
              style={inputStyle}
              value={pricingInventory.availabilityMessage}
              onChange={(event) => updatePricingInventory("availabilityMessage", event.target.value)}
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Media"
        description="Upload product images and videos with drag and drop or click to upload."
      >
        <div style={fieldGridStyle}>
          <div style={fieldStyle}>
            <span>Images</span>
            <input
              ref={imageInputRef}
              type="file"
              multiple
              accept="image/*"
              style={{ display: "none" }}
              onChange={(event) => {
                appendMediaFiles("images", event.target.files || [], { multiple: true });
                event.target.value = "";
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => imageInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  imageInputRef.current?.click();
                }
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDropzoneDrop(event, "images", { multiple: true })}
              style={uploadDropzoneStyle}
            >
              <strong>Drag images here</strong>
              <span style={helperTextStyle}>or click to upload image files</span>
            </div>
            <small style={helperTextStyle}>
              {media.images.length ? `${media.images.length} image file(s) selected` : "No images selected yet"}
            </small>
            {media.images.length ? (
              <div style={fileListStyle}>
                {media.images.map((file, index) => (
                  <div key={`${file.name}-${index}`} style={fileChipStyle}>
                    <div style={filePreviewFrameStyle}>
                      {file.url ? (
                        <img src={file.url} alt={file.name} style={imagePreviewStyle} />
                      ) : (
                        <span style={helperTextStyle}>Image</span>
                      )}
                    </div>
                    <span style={fileNameStyle}>{file.name}</span>
                    <button type="button" onClick={() => removeMediaFile("images", index)} style={fileRemoveButtonStyle}>Remove</button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div style={fieldStyle}>
            <span>Videos</span>
            <input
              ref={videoInputRef}
              type="file"
              multiple
              accept="video/*"
              style={{ display: "none" }}
              onChange={(event) => {
                appendMediaFiles("videos", event.target.files || [], { multiple: true });
                event.target.value = "";
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => videoInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  videoInputRef.current?.click();
                }
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDropzoneDrop(event, "videos", { multiple: true })}
              style={uploadDropzoneStyle}
            >
              <strong>Drag videos here</strong>
              <span style={helperTextStyle}>or click to upload video files</span>
            </div>
            <small style={helperTextStyle}>
              {media.videos.length ? `${media.videos.length} video file(s) selected` : "No videos selected yet"}
            </small>
            {media.videos.length ? (
              <div style={fileListStyle}>
                {media.videos.map((file, index) => (
                  <div key={`${file.name}-${index}`} style={fileChipStyle}>
                    <div style={filePreviewFrameStyle}>
                      {file.url ? (
                        <video src={file.url} style={videoPreviewStyle} muted playsInline preload="metadata" />
                      ) : (
                        <span style={helperTextStyle}>Video</span>
                      )}
                    </div>
                    <span style={fileNameStyle}>{file.name}</span>
                    <button type="button" onClick={() => removeMediaFile("videos", index)} style={fileRemoveButtonStyle}>Remove</button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </SectionCard>

      {mode !== "add" ? (
        <SectionCard
          title="Variants"
          description="Manage product variants like color, size, variant images, variant prices, and stock."
        >
          <div style={{ display: "grid", gap: "16px" }}>
            {variants.map((variant, index) => (
              <div
                key={variant.id}
                style={{
                  padding: "18px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "grid",
                  gap: "16px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                  <div>
                    <strong>{`Variant ${index + 1}`}</strong>
                    <p style={{ ...sectionCopyStyle, marginTop: "6px" }}>
                      Add variant identity, price, stock, SKU, and image.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeVariantRow(variant.id)}
                    style={{
                      minHeight: "38px",
                      padding: "0 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      color: "#334155",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    Remove
                  </button>
                </div>

                <div style={fieldGridStyle}>
                  <label style={fieldStyle}>
                    <span>Variant Type</span>
                    <select
                      value={variant.variantType}
                      style={inputStyle}
                      onChange={(event) => updateVariant(variant.id, "variantType", event.target.value)}
                    >
                      <option value="Color">Color</option>
                      <option value="Size">Size</option>
                      <option value="Storage">Storage</option>
                      <option value="Style">Style</option>
                    </select>
                  </label>
                  <label style={fieldStyle}>
                    <span>Variant Value</span>
                    <input
                      type="text"
                      placeholder="Example: Pearl White"
                      style={inputStyle}
                      value={variant.variantValue}
                      onChange={(event) => updateVariant(variant.id, "variantValue", event.target.value)}
                    />
                  </label>
                  <label style={fieldStyle}>
                    <span>Variant Price</span>
                    <input
                      type="number"
                      placeholder="Enter variant price"
                      style={inputStyle}
                      value={variant.variantPrice}
                      onChange={(event) => updateVariant(variant.id, "variantPrice", event.target.value)}
                    />
                  </label>
                  <label style={fieldStyle}>
                    <span>Variant SKU</span>
                    <input
                      type="text"
                      placeholder="Enter variant SKU"
                      style={inputStyle}
                      value={variant.variantSku}
                      onChange={(event) => updateVariant(variant.id, "variantSku", event.target.value)}
                    />
                  </label>
                  <label style={fieldStyle}>
                    <span>Variant Stock</span>
                    <input
                      type="number"
                      placeholder="Enter variant stock"
                      style={inputStyle}
                      value={variant.variantStock}
                      onChange={(event) => updateVariant(variant.id, "variantStock", event.target.value)}
                    />
                  </label>
                  <label style={fieldStyle}>
                    <span>Variant Image</span>
                    <input
                      type="file"
                      style={{ ...inputStyle, paddingTop: "10px" }}
                      onChange={(event) => updateVariant(variant.id, "variantImage", event.target.files?.[0] || null)}
                    />
                    <small style={helperTextStyle}>
                      {variant.variantImage ? variant.variantImage.name : "No variant image selected"}
                    </small>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <button
              type="button"
              onClick={addVariantRow}
              style={{
                ...actionButtonStyle,
                border: "none",
                background: "#0f172a",
                color: "#fff"
              }}
            >
              Add Another Variant
            </button>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Product Highlights"
        description="Short bullet-point highlights shown near the top of the product page."
      >
        <div style={{ display: "grid", gap: "16px" }}>
          {highlights.map((highlight, index) => (
            <label key={`highlight-${index}`} style={fieldStyle}>
              <span>{`Highlight ${index + 1}`}</span>
              <input
                type="text"
                placeholder={`Enter highlight ${index + 1}`}
                style={inputStyle}
                value={highlight}
                onChange={(event) => updateHighlight(index, event.target.value)}
              />
            </label>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <button
            type="button"
            onClick={addHighlightField}
            style={{
              ...actionButtonStyle,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#334155"
            }}
          >
            <FaPlus aria-hidden="true" />
            Add More Highlights
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="Description"
        description="Long-form product description content shown on the product page."
      >
        <label style={fieldStyle}>
          <span>Description</span>
          <textarea
            rows="6"
            placeholder="Write the full product description"
            style={textareaStyle}
            value={descriptionData.content}
            onChange={(event) => setProductData((current) => ({
              ...current,
              description: {
                ...current.description,
                content: event.target.value
              }
            }))}
          />
        </label>
      </SectionCard>

      <SectionCard
        title="Specifications"
        description="Technical details grouped into sections like General, Display, Battery, or Connectivity."
      >
        <div style={{ display: "grid", gap: "16px" }}>
          {specGroups.map((group, groupIndex) => (
            <div
              key={group.id}
              style={{
                padding: "18px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "grid",
                gap: "16px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                <div>
                  <strong>{`Spec Group ${groupIndex + 1}`}</strong>
                  <p style={{ ...sectionCopyStyle, marginTop: "6px" }}>
                    Add a group name and then define label/value specification rows inside it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeSpecGroup(group.id)}
                  style={{
                    minHeight: "38px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    color: "#334155",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Remove Group
                </button>
              </div>

              <label style={fieldStyle}>
                <span>Spec Group Name</span>
                <input
                  type="text"
                  placeholder="Example: General Information"
                  style={inputStyle}
                  value={group.name}
                  onChange={(event) => updateSpecGroupName(group.id, event.target.value)}
                />
              </label>

              <div style={{ display: "grid", gap: "12px" }}>
                {group.items.map((item, itemIndex) => (
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto",
                      gap: "12px",
                      alignItems: "end"
                    }}
                  >
                    <label style={fieldStyle}>
                      <span>{`Label ${itemIndex + 1}`}</span>
                      <input
                        type="text"
                        placeholder="Example: Brand"
                        style={inputStyle}
                        value={item.label}
                        onChange={(event) => updateSpecItem(group.id, item.id, "label", event.target.value)}
                      />
                    </label>

                    <label style={fieldStyle}>
                      <span>{`Value ${itemIndex + 1}`}</span>
                      <input
                        type="text"
                        placeholder="Example: Sony"
                        style={inputStyle}
                        value={item.value}
                        onChange={(event) => updateSpecItem(group.id, item.id, "value", event.target.value)}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => removeSpecItem(group.id, item.id)}
                      style={{
                        minHeight: "44px",
                        padding: "0 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        color: "#334155",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <button
                  type="button"
                  onClick={() => addSpecItem(group.id)}
                  style={{
                    ...actionButtonStyle,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    color: "#334155"
                  }}
                >
                  <FaPlus aria-hidden="true" />
                  Add Spec Row
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <button
            type="button"
            onClick={addSpecGroup}
            style={{
              ...actionButtonStyle,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              border: "none",
              background: "#0f172a",
              color: "#fff"
            }}
          >
            <FaPlus aria-hidden="true" />
            Add Spec Group
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="Delivery / Policy"
        description="Delivery, dispatch, shipping, COD, return, and warranty information."
      >
        <div style={fieldGridStyle}>
          <label style={fieldStyle}>
            <span>Delivery Estimate</span>
            <input
              type="text"
              placeholder="Example: 3-7 business days"
              style={inputStyle}
              value={policyDetails.deliveryEstimate}
              onChange={(event) => updatePolicyField("deliveryEstimate", event.target.value)}
            />
          </label>
          <label style={fieldStyle}>
            <span>Dispatch Time</span>
            <input
              type="text"
              placeholder="Example: Within 24-48 hours"
              style={inputStyle}
              value={policyDetails.dispatchTime}
              onChange={(event) => updatePolicyField("dispatchTime", event.target.value)}
            />
          </label>
        </div>

        <div style={{ display: "grid", gap: "16px" }}>
          {policyDetails.items.map((item, index) => (
            <div
              key={item.id}
              style={{
                padding: "18px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "grid",
                gap: "14px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                <strong>{`Policy Block ${index + 1}`}</strong>
                <button
                  type="button"
                  onClick={() => removePolicyItem(item.id)}
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "999px",
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    color: "#334155",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer"
                  }}
                  aria-label={`Remove policy block ${index + 1}`}
                >
                  <FaTimes aria-hidden="true" />
                </button>
              </div>

              <label style={fieldStyle}>
                <span>Section Title</span>
                <input
                  type="text"
                  placeholder="Example: Shipping Information"
                  style={inputStyle}
                  value={item.title}
                  onChange={(event) => updatePolicyItem(item.id, "title", event.target.value)}
                />
              </label>

              <label style={fieldStyle}>
                <span>Section Content</span>
                <textarea
                  rows="4"
                  placeholder="Write section details"
                  style={textareaStyle}
                  value={item.content}
                  onChange={(event) => updatePolicyItem(item.id, "content", event.target.value)}
                />
              </label>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <button
            type="button"
            onClick={addPolicyItem}
            style={{
              ...actionButtonStyle,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#334155"
            }}
          >
            <FaPlus aria-hidden="true" />
            Add More Policy Blocks
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="FAQ"
        description="Common questions and answers shown on the product page."
      >
        <div style={{ display: "grid", gap: "16px" }}>
          {faqs.map((faq, index) => (
            <div
              key={faq.id}
              style={{
                padding: "18px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "grid",
                gap: "14px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                <strong>{`FAQ ${index + 1}`}</strong>
                <button
                  type="button"
                  onClick={() => removeFaq(faq.id)}
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "999px",
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    color: "#334155",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer"
                  }}
                  aria-label={`Remove FAQ ${index + 1}`}
                >
                  <FaTimes aria-hidden="true" />
                </button>
              </div>

              <label style={fieldStyle}>
                <span>Question</span>
                <input
                  type="text"
                  placeholder="Enter FAQ question"
                  style={inputStyle}
                  value={faq.question}
                  onChange={(event) => updateFaq(faq.id, "question", event.target.value)}
                />
              </label>

              <label style={fieldStyle}>
                <span>Answer</span>
                <textarea
                  rows="4"
                  placeholder="Enter FAQ answer"
                  style={textareaStyle}
                  value={faq.answer}
                  onChange={(event) => updateFaq(faq.id, "answer", event.target.value)}
                />
              </label>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <button
            type="button"
            onClick={addFaq}
            style={{
              ...actionButtonStyle,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#334155"
            }}
          >
            <FaPlus aria-hidden="true" />
            Add More FAQ
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="Related Products"
        description="Configure the products that power the You Might Also Like section with auto-matching and manual overrides."
      >
        <div style={{ display: "grid", gap: "18px" }}>
          <div style={fieldGridStyle}>
            <label style={fieldStyle}>
              <span>Related Products Selector</span>
              <select
                value={relatedProducts.selectorMode}
                style={inputStyle}
                onChange={(event) => updateRelatedProducts("selectorMode", event.target.value)}
              >
                <option value="auto-and-manual">Auto + Manual</option>
                <option value="auto-only">Auto Only</option>
                <option value="manual-only">Manual Only</option>
              </select>
              <small style={helperTextStyle}>
                Choose whether recommendations should come from the same collection automatically, manual picks, or both.
              </small>
            </label>

            <label style={{ ...fieldStyle, justifyContent: "end" }}>
              <span>Auto Related by Category / Collection</span>
              <button
                type="button"
                onClick={() => updateRelatedProducts("autoByCategory", !relatedProducts.autoByCategory)}
                disabled={relatedProducts.selectorMode === "manual-only"}
                style={{
                  minHeight: "44px",
                  borderRadius: "999px",
                  border: "1px solid #cbd5e1",
                  background: autoRelatedEnabled ? "#16a34a" : "#f8fafc",
                  color: autoRelatedEnabled ? "#fff" : "#334155",
                  opacity: relatedProducts.selectorMode === "manual-only" ? 0.55 : 1,
                  fontWeight: 700,
                  cursor: relatedProducts.selectorMode === "manual-only" ? "not-allowed" : "pointer"
                }}
              >
                {autoRelatedEnabled ? "Auto Related: On" : "Auto Related: Off"}
              </button>
              <small style={helperTextStyle}>
                Uses the product collection to suggest related items automatically.
              </small>
            </label>
          </div>

          <div
            style={{
              padding: "18px",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              display: "grid",
              gap: "14px"
            }}
          >
            <div>
              <strong>Auto Related Preview</strong>
              <p style={{ ...smallMutedTextStyle, marginTop: "6px" }}>
                {basicInfo.category
                  ? `Products from ${formatCategoryLabel(basicInfo.category)} will be suggested automatically.`
                  : "Choose the product category first to see automatic related product suggestions."}
              </p>
            </div>

            {autoRelatedEnabled && autoRelatedProducts.length ? (
              <div style={{ display: "grid", gap: "10px" }}>
                {autoRelatedProducts.map((product) => (
                  <div
                    key={`auto-related-${product.slug}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      background: "#fff",
                      border: "1px solid #dbe2ea"
                    }}
                  >
                    <div style={{ display: "grid", gap: "4px" }}>
                      <strong>{product.name}</strong>
                      <p style={smallMutedTextStyle}>{`${product.brand} - ${product.category}`}</p>
                    </div>
                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: "999px",
                        background: "#dcfce7",
                        color: "#166534",
                        fontSize: "12px",
                        fontWeight: 700
                      }}
                    >
                      Auto Match
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: "1px dashed #cbd5e1",
                  background: "#fff"
                }}
              >
                <p style={smallMutedTextStyle}>
                  {autoRelatedEnabled
                    ? "No same-category products found yet for auto related suggestions."
                    : "Auto related suggestions are currently turned off."}
                </p>
              </div>
            )}
          </div>

          <div
            style={{
              padding: "18px",
              borderRadius: "12px",
              border: "1px solid #dbe2ea",
              background: "#fff",
              display: "grid",
              gap: "12px"
            }}
          >
            <div>
              <strong>Final Related Products Preview</strong>
              <p style={{ ...smallMutedTextStyle, marginTop: "6px" }}>
                This is the combined list that the frontend can later use for You Might Also Like.
              </p>
            </div>

            {finalRelatedProducts.length ? (
              <div style={{ display: "grid", gap: "10px" }}>
                {finalRelatedProducts.map((product, index) => (
                  <div
                    key={`final-related-${product.slug}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0"
                    }}
                  >
                    <div style={{ display: "grid", gap: "4px" }}>
                      <strong>{`${index + 1}. ${product.name}`}</strong>
                      <p style={smallMutedTextStyle}>{`${product.brand} - ${product.category}`}</p>
                    </div>
                    <span style={{ color: "#0f172a", fontWeight: 700 }}>{product.slug}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={smallMutedTextStyle}>No related products selected yet.</p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="SEO"
        description="Set search and social metadata so the product can later publish clean SEO tags from admin."
      >
        <div style={{ display: "grid", gap: "18px" }}>
          <div style={fieldGridStyle}>
            <label style={fieldStyle}>
              <span>Meta Title</span>
              <input
                type="text"
                placeholder="Enter meta title"
                style={inputStyle}
                value={seo.metaTitle}
                onChange={(event) => updateSeo("metaTitle", event.target.value)}
              />
              <small style={helperTextStyle}>
                {`${seoTitleLength}/60 characters. Best for search listings and browser titles.`}
              </small>
            </label>

            <label style={fieldStyle}>
              <span>Canonical URL</span>
              <input
                type="url"
                placeholder="https://www.avyona.com/product/your-product-slug"
                style={inputStyle}
                value={seo.canonicalUrl}
                onChange={(event) => updateSeo("canonicalUrl", event.target.value)}
              />
              <small style={helperTextStyle}>
                {`Suggested: ${suggestedCanonicalUrl}`}
              </small>
            </label>
          </div>

          <label style={fieldStyle}>
            <span>Meta Description</span>
            <textarea
              rows="4"
              placeholder="Write meta description"
              style={textareaStyle}
              value={seo.metaDescription}
              onChange={(event) => updateSeo("metaDescription", event.target.value)}
            />
            <small style={helperTextStyle}>
              {`${seoDescriptionLength}/160 characters. Keep it clear, product-specific, and click-friendly.`}
            </small>
          </label>

          <label style={fieldStyle}>
            <span>Meta Keywords</span>
            <input
              type="text"
              placeholder="keyword 1, keyword 2, keyword 3"
              style={inputStyle}
              value={seo.metaKeywords}
              onChange={(event) => updateSeo("metaKeywords", event.target.value)}
            />
            <small style={helperTextStyle}>
              Add comma-separated keywords for internal SEO planning and future admin tag generation.
            </small>
          </label>

          <label style={fieldStyle}>
            <span>OG Image</span>
            <input
              type="file"
              accept="image/*"
              style={{ ...inputStyle, paddingTop: "10px" }}
              onChange={(event) => updateSeo("ogImage", event.target.files?.[0] || null)}
            />
            <small style={helperTextStyle}>
              {seo.ogImage
                ? `Selected OG image: ${seo.ogImage.name}`
                : "Upload the social sharing image that should appear in Open Graph previews."}
            </small>
          </label>

          <div
            style={{
              padding: "18px",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              display: "grid",
              gap: "10px"
            }}
          >
            <div>
              <strong>SEO Preview Summary</strong>
              <p style={{ ...smallMutedTextStyle, marginTop: "6px" }}>
                This gives the admin a quick preview of the core SEO values that can later be turned into frontend tags.
              </p>
            </div>

            <div style={{ display: "grid", gap: "8px" }}>
              <div>
                <strong>{seo.metaTitle || basicInfo.productName || "Product meta title preview"}</strong>
              </div>
              <p style={smallMutedTextStyle}>
                {seo.canonicalUrl || suggestedCanonicalUrl}
              </p>
              <p style={smallMutedTextStyle}>
                {seo.metaDescription || "Your product meta description preview will appear here once you add it."}
              </p>
              <p style={smallMutedTextStyle}>
                {seo.metaKeywords
                  ? `Keywords: ${seo.metaKeywords}`
                  : "Keywords: no keywords added yet."}
              </p>
              <p style={smallMutedTextStyle}>
                {seo.ogImage
                  ? `OG Image ready: ${seo.ogImage.name}`
                  : "OG Image: no image selected yet."}
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      <section
        style={{
          ...sectionCardStyle,
          position: "sticky",
          bottom: "16px"
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>Save / Publish</h3>
        <p style={{ ...sectionCopyStyle, marginTop: "8px" }}>
          Save the product as a draft or publish it once all sections are completed.
        </p>
        {saveMessage ? (
          <p style={{
            margin: "10px 0 0",
            padding: "10px 12px",
            borderRadius: "10px",
            background: saveTone === "error" ? "#fef2f2" : "#ecfdf5",
            color: saveTone === "error" ? "#b91c1c" : "#166534",
            fontWeight: 700
          }}>
            {saveMessage}
          </p>
        ) : null}
      </div>
        {actionBar}
      </section>
    </div>
  );
}
