import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createCategory,
  fetchCategories,
  fetchCategory,
  updateCategory,
  uploadAdminImage
} from "../../api/adminApi";
import { resolveAdminMediaUrl, toStoredUploadUrl } from "../../utils/media";

function createSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getPreviewUrl(url) {
  return resolveAdminMediaUrl(url);
}

function normalizeCategoryForm(category = {}) {
  return {
    categoryName: category.name || category.categoryName || "",
    slug: category.slug || "",
    parentId: category.parentId || "",
    categoryImage: category.imageUrl || category.categoryImage || "",
    bannerImage: category.bannerImageUrl || category.bannerImage || "",
    showInMenu: category.showInMenu ?? true,
    featuredCategory: category.featuredCategory ?? category.featured ?? false,
    sortOrder: category.sortOrder ?? "",
    status: category.status || "active",
    shortDescription: category.description || category.shortDescription || "",
    metaTitle: category.metaTitle || "",
    metaDescription: category.metaDescription || "",
    keywords: category.keywords || ""
  };
}

function ImageUploadBox({ label, value, helper, isUploading, onUpload, onChange }) {
  const inputRef = React.useRef(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleFiles = (files) => {
    const file = files?.[0];
    if (file) onUpload(file);
  };

  return (
    <div style={uploadFieldStyle}>
      <div style={uploadHeadStyle}>
        <span style={fieldLabelStyle}>{label}</span>
        {value ? <span style={smallStatusStyle}>Image selected</span> : null}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        style={{
          ...dropzoneStyle,
          ...(isDragging ? dropzoneActiveStyle : null)
        }}
      >
        {value ? (
          <img src={getPreviewUrl(value)} alt={label} style={previewImageStyle} />
        ) : (
          <span style={dropzoneCopyStyle}>
            <strong>{isUploading ? "Uploading..." : `Drag ${label.toLowerCase()} here`}</strong>
            <small>or click to upload image file</small>
          </span>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(event) => handleFiles(event.target.files)}
        style={{ display: "none" }}
      />

      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder=""
        style={inputStyle}
      />
      <small style={helperTextStyle}>{helper}</small>
    </div>
  );
}

export default function AddCategory() {
  const navigate = useNavigate();
  const { categoryId } = useParams();
  const isEditMode = Boolean(categoryId);
  const [parentOptions, setParentOptions] = React.useState([]);
  const [form, setForm] = React.useState(() => normalizeCategoryForm());
  const [slugEditedManually, setSlugEditedManually] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState("");
  const [messageTone, setMessageTone] = React.useState("success");
  const [isSaving, setIsSaving] = React.useState(false);
  const [uploadingField, setUploadingField] = React.useState("");

  React.useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      try {
        const response = await fetchCategories();
        if (!isMounted) return;
        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        setParentOptions(rows.filter((category) => String(category.id) !== String(categoryId)));
      } catch {
        if (isMounted) setParentOptions([]);
      }
    }

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, [categoryId]);

  React.useEffect(() => {
    if (!isEditMode) return undefined;
    let isMounted = true;

    async function loadCategory() {
      try {
        const response = await fetchCategory(categoryId);
        if (!isMounted) return;
        const loadedForm = normalizeCategoryForm(response.data?.data || {});
        setForm(loadedForm);
        setSlugEditedManually(Boolean(loadedForm.slug));
      } catch (error) {
        if (!isMounted) return;
        setMessageTone("error");
        setStatusMessage(error.response?.data?.message || "Unable to load category details.");
      }
    }

    loadCategory();

    return () => {
      isMounted = false;
    };
  }, [categoryId, isEditMode]);

  const setFormValue = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleCategoryNameChange = (value) => {
    setForm((current) => ({
      ...current,
      categoryName: value,
      slug: slugEditedManually ? current.slug : createSlug(value)
    }));
  };

  const handleSlugChange = (value) => {
    setSlugEditedManually(true);
    setFormValue("slug", createSlug(value));
  };

  const uploadCategoryImage = async (field, file) => {
    setUploadingField(field);
    setStatusMessage("");

    try {
      const response = await uploadAdminImage(file);
      const uploadedUrl = response.data?.data?.url || "";
      setFormValue(field, toStoredUploadUrl(uploadedUrl));
    } catch (error) {
      setMessageTone("error");
      setStatusMessage(error.response?.data?.message || "Unable to upload image.");
    } finally {
      setUploadingField("");
    }
  };

  const buildPayload = () => ({
    name: form.categoryName,
    slug: form.slug,
    parentId: form.parentId || null,
    imageUrl: form.categoryImage,
    bannerImageUrl: form.bannerImage,
    description: form.shortDescription,
    status: form.status,
    showInMenu: Boolean(form.showInMenu),
    featuredCategory: Boolean(form.featuredCategory),
    sortOrder: Number(form.sortOrder || 0),
    metaTitle: form.metaTitle,
    metaDescription: form.metaDescription,
    keywords: form.keywords
  });

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.categoryName.trim() || !form.slug.trim()) {
      setMessageTone("error");
      setStatusMessage("Category name and slug are required.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    try {
      const payload = buildPayload();
      if (isEditMode) {
        await updateCategory(categoryId, payload);
      } else {
        await createCategory(payload);
      }

      setMessageTone("success");
      setStatusMessage(isEditMode ? "Category saved and connected to the website." : "Category created and published to the website.");
      window.setTimeout(() => navigate("/dashboard/categories"), 800);
    } catch (error) {
      setMessageTone("error");
      setStatusMessage(error.response?.data?.message || "Unable to save category.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <span style={eyebrowStyle}>Category Form</span>
          <h2 style={heroTitleStyle}>{isEditMode ? "Edit Category" : "Add Category"}</h2>
          <p style={heroCopyStyle}>
            Add category details, upload card and banner images, control storefront visibility, and publish the category to the website.
          </p>
        </div>

        <button type="button" style={secondaryButtonStyle} onClick={() => navigate("/dashboard/categories")}>
          Back to Categories
        </button>
      </section>

      {statusMessage ? (
        <section style={{ ...feedbackStyle, ...(messageTone === "error" ? errorFeedbackStyle : null) }}>{statusMessage}</section>
      ) : null}

      <form onSubmit={handleSubmit} style={formStyle}>
        <section style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={eyebrowStyle}>Section 1</span>
            <h3 style={sectionTitleStyle}>Basic Info</h3>
          </div>

          <div style={fieldGridStyle}>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Category Name</span>
              <input value={form.categoryName} onChange={(event) => handleCategoryNameChange(event.target.value)} placeholder="Example: Personal Audio" style={inputStyle} />
            </label>

            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Slug</span>
              <input value={form.slug} onChange={(event) => handleSlugChange(event.target.value)} placeholder="personal-audio" style={inputStyle} />
            </label>

            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Parent Category</span>
              <select value={form.parentId} onChange={(event) => setFormValue("parentId", event.target.value)} style={inputStyle}>
                <option value="">None (Main Category)</option>
                {parentOptions.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>

            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Sort Order</span>
              <input type="number" value={form.sortOrder} onChange={(event) => setFormValue("sortOrder", event.target.value)} placeholder="1" style={inputStyle} />
            </label>
          </div>
        </section>

        <section style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={eyebrowStyle}>Section 2</span>
            <h3 style={sectionTitleStyle}>Category Images</h3>
            <p style={sectionCopyStyle}>Use drag and drop or click to upload. Category image is used in cards; banner image is used on the website category page.</p>
          </div>

          <div style={fieldGridStyle}>
            <ImageUploadBox
              label="Category Image"
              value={form.categoryImage}
              helper="Used on homepage/category cards and dashboard list rows."
              isUploading={uploadingField === "categoryImage"}
              onUpload={(file) => uploadCategoryImage("categoryImage", file)}
              onChange={(value) => setFormValue("categoryImage", value)}
            />
            <ImageUploadBox
              label="Banner Image"
              value={form.bannerImage}
              helper="Used on the frontend website category landing page."
              isUploading={uploadingField === "bannerImage"}
              onUpload={(file) => uploadCategoryImage("bannerImage", file)}
              onChange={(value) => setFormValue("bannerImage", value)}
            />
          </div>
        </section>

        <section style={twoColumnSectionStyle}>
          <div style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>
              <span style={eyebrowStyle}>Section 3</span>
              <h3 style={sectionTitleStyle}>Display Settings</h3>
            </div>
            <label style={toggleFieldStyle}>
              <span>Show in Menu</span>
              <input type="checkbox" checked={Boolean(form.showInMenu)} onChange={(event) => setFormValue("showInMenu", event.target.checked)} />
            </label>
            <label style={toggleFieldStyle}>
              <span>Featured on Homepage</span>
              <input type="checkbox" checked={Boolean(form.featuredCategory)} onChange={(event) => setFormValue("featuredCategory", event.target.checked)} />
            </label>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Status</span>
              <select value={form.status} onChange={(event) => setFormValue("status", event.target.value)} style={inputStyle}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          <div style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>
              <span style={eyebrowStyle}>Section 4</span>
              <h3 style={sectionTitleStyle}>Description</h3>
            </div>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Short Description</span>
              <textarea value={form.shortDescription} onChange={(event) => setFormValue("shortDescription", event.target.value)} placeholder="Write a short category description" style={textareaStyle} />
            </label>
          </div>
        </section>

        <section style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={eyebrowStyle}>Section 5</span>
            <h3 style={sectionTitleStyle}>SEO</h3>
          </div>

          <div style={fieldGridStyle}>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Meta Title</span>
              <input value={form.metaTitle} onChange={(event) => setFormValue("metaTitle", event.target.value)} placeholder="Category Collection | Avyona" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Keywords</span>
              <input value={form.keywords} onChange={(event) => setFormValue("keywords", event.target.value)} placeholder="keyword 1, keyword 2" style={inputStyle} />
            </label>
          </div>

          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Meta Description</span>
            <textarea value={form.metaDescription} onChange={(event) => setFormValue("metaDescription", event.target.value)} placeholder="Short SEO description for the category page" style={textareaStyle} />
          </label>
        </section>

        <div style={actionsRowStyle}>
          <button type="button" style={secondaryButtonStyle} onClick={() => navigate("/dashboard/categories")}>Cancel</button>
          <button type="submit" style={primaryButtonStyle} disabled={isSaving}>{isSaving ? "Saving..." : isEditMode ? "Save Category" : "Create & Publish Category"}</button>
        </div>
      </form>
    </div>
  );
}

const pageStyle = { display: "grid", gap: "16px" };
const formStyle = { display: "grid", gap: "15px" };

const heroStyle = {
  background: "linear-gradient(135deg, #ffffff 0%, #f4fbf6 55%, #edf7ff 100%)",
  borderRadius: "16px",
  border: "1px solid rgba(203, 213, 225, 0.7)",
  boxShadow: "0 10px 26px rgba(174, 203, 190, 0.14)",
  padding: "22px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap"
};

const heroTitleStyle = { margin: "8px 0 0", fontSize: "38px", color: "#0f172a" };
const heroCopyStyle = { margin: "10px 0 0", color: "#526377", maxWidth: "760px" };

const sectionCardStyle = {
  background: "#ffffff",
  borderRadius: "12px",
  border: "1px solid rgba(203, 213, 225, 0.75)",
  boxShadow: "0 8px 22px rgba(174, 203, 190, 0.08)",
  padding: "16px",
  display: "grid",
  gap: "14px"
};

const sectionHeaderStyle = { display: "grid", gap: "5px" };
const sectionTitleStyle = { margin: 0, color: "#0f172a", fontSize: "20px" };
const sectionCopyStyle = { margin: 0, color: "#64748b", lineHeight: 1.5 };

const twoColumnSectionStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "15px",
  alignItems: "stretch"
};

const fieldGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "14px"
};

const fieldStyle = { display: "grid", gap: "7px" };
const fieldLabelStyle = { color: "#334155", fontWeight: 800, fontSize: "13px" };

const inputStyle = {
  width: "100%",
  minHeight: "42px",
  padding: "0 12px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
  background: "#fff",
  color: "#0f172a"
};

const textareaStyle = { ...inputStyle, minHeight: "96px", padding: "11px 12px", resize: "vertical" };
const helperTextStyle = { color: "#64748b", fontSize: "12px", fontWeight: 500 };

const uploadFieldStyle = { display: "grid", gap: "9px" };
const uploadHeadStyle = { display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" };
const smallStatusStyle = { color: "#166534", fontSize: "12px", fontWeight: 800 };

const dropzoneStyle = {
  minHeight: "210px",
  border: "1px dashed #94a3b8",
  borderRadius: "12px",
  background: "#f8fafc",
  cursor: "pointer",
  overflow: "hidden",
  padding: 0
};

const dropzoneActiveStyle = { borderColor: "#16a34a", background: "#f0fdf4" };
const dropzoneCopyStyle = { display: "grid", placeItems: "center", gap: "8px", minHeight: "210px", color: "#334155" };
const previewImageStyle = { width: "100%", height: "210px", objectFit: "cover", display: "block" };

const toggleFieldStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  minHeight: "48px",
  padding: "0 12px",
  borderRadius: "9px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 800
};

const actionsRowStyle = { display: "flex", justifyContent: "flex-end", gap: "12px", flexWrap: "wrap" };

const primaryButtonStyle = {
  minHeight: "42px",
  padding: "0 18px",
  borderRadius: "9px",
  border: "1px solid rgba(15, 23, 42, 0.1)",
  background: "#16a34a",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer"
};

const secondaryButtonStyle = {
  minHeight: "42px",
  padding: "0 18px",
  borderRadius: "9px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 800,
  cursor: "pointer"
};

const feedbackStyle = {
  borderRadius: "12px",
  padding: "12px 14px",
  background: "#f0fdf4",
  color: "#166534",
  border: "1px solid #bbf7d0",
  fontWeight: 800
};

const errorFeedbackStyle = { background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" };

const eyebrowStyle = {
  color: "#0f766e",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};
