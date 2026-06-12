import React from "react";
import * as XLSX from "xlsx";
import {
  deleteWebsiteImage,
  fetchWebsiteImages,
  restoreWebsiteImage,
  updateWebsiteImage,
  uploadAdminImage
} from "../../api/adminApi";
import { resolveAdminMediaUrl } from "../../utils/media";

function getPreviewUrl(url) {
  return resolveAdminMediaUrl(url);
}

function formatSource(source) {
  if (source === "uploaded") return "Uploaded";
  if (source === "frontend") return "Website Asset";
  return "Image";
}

function getUsedInText(image) {
  if (image.sectionPath) return image.sectionPath;
  if (image.linkedPaths?.length) return image.linkedPaths.join(", ");
  return "Not assigned";
}

function getLinkedProductText(image, key) {
  const values = key === "asin" ? image.linkedAsins : image.linkedSkus;
  if (Array.isArray(values) && values.length) return values.join(", ");
  const linkedProducts = Array.isArray(image.linkedProducts) ? image.linkedProducts : [];
  return [...new Set(linkedProducts.map((product) => product[key]).filter(Boolean))].join(", ");
}

function buildExportRows(images) {
  return images.map((image) => ({
    "Image URL": image.url || "",
    "Preview URL": getPreviewUrl(image.url),
    "Original Name": image.originalName || "",
    Filename: image.filename || "",
    Source: formatSource(image.source),
    Status: image.status || "",
    "Alt Text": image.altText || "",
    "Used In Section": getUsedInText(image),
    "Linked ASIN": getLinkedProductText(image, "asin"),
    "Linked SKU": getLinkedProductText(image, "sku"),
    "Linked Product Names": (image.linkedProducts || []).map((product) => product.productName).filter(Boolean).join(", "),
    "Mime Type": image.mimeType || "",
    "Size Bytes": image.sizeBytes || "",
    "Created At": image.createdAt || "",
    "Updated At": image.updatedAt || ""
  }));
}

function downloadImageSheet(images, filename) {
  const rows = buildExportRows(images);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = Object.keys(rows[0] || { "Image URL": "" }).map((header) => ({ wch: Math.min(60, Math.max(14, header.length + 8)) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Image Details");
  XLSX.writeFile(workbook, filename, { bookType: "xlsx" });
}

export default function WebsiteImages() {
  const [images, setImages] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [savingUrl, setSavingUrl] = React.useState("");
  const [editingUrl, setEditingUrl] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [uploadPanelOpen, setUploadPanelOpen] = React.useState(false);
  const [isDraggingUpload, setIsDraggingUpload] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [viewMode, setViewMode] = React.useState("visual");
  const [activeImageUrl, setActiveImageUrl] = React.useState("");
  const [pendingUploadFiles, setPendingUploadFiles] = React.useState([]);
  const [selectedUrls, setSelectedUrls] = React.useState(() => new Set());
  const fileInputRef = React.useRef(null);

  const loadImages = React.useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetchWebsiteImages({ includeDeleted: true });
      setImages(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to load website images.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadImages();
  }, [loadImages]);

  const updateLocalImage = (url, patch) => {
    setImages((current) => current.map((image) => image.url === url ? { ...image, ...patch } : image));
  };

  const handleSave = async (image) => {
    setSavingUrl(image.url);
    setMessage("");

    try {
      await updateWebsiteImage({
        url: image.url,
        altText: image.altText || "",
        sectionPath: image.sectionPath || "",
        status: image.status || "active"
      });
      setMessage("Image details updated.");
      setEditingUrl("");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to update image details.");
    } finally {
      setSavingUrl("");
    }
  };

  const handleDelete = async (image) => {
    const confirmed = window.confirm(`Delete this image from Website Images?\n\n${image.url}`);
    if (!confirmed) return;

    setSavingUrl(image.url);
    setMessage("");

    try {
      await deleteWebsiteImage(image.url);
      updateLocalImage(image.url, { status: "inactive", isDeleted: true });
      setMessage("Image moved to Deleted. The file is retained and can be restored.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to delete image.");
    } finally {
      setSavingUrl("");
    }
  };

  const handleRestore = async (image) => {
    setSavingUrl(image.url);
    setMessage("");

    try {
      await restoreWebsiteImage(image.url);
      updateLocalImage(image.url, { status: "active", isDeleted: false });
      setMessage("Image restored successfully.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to restore image.");
    } finally {
      setSavingUrl("");
    }
  };

  const stageUploadFiles = (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;

    setPendingUploadFiles((current) => {
      const existing = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const next = [...current];
      files.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!existing.has(key)) next.push(file);
      });
      return next;
    });

    setMessage(`${files.length} image${files.length === 1 ? "" : "s"} selected. Click Upload to save.`);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadPendingFiles = async () => {
    if (!pendingUploadFiles.length) {
      setMessage("Select one or more images before upload.");
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      await Promise.all(pendingUploadFiles.map((file) => uploadAdminImage(file)));
      await loadImages();
      const count = pendingUploadFiles.length;
      setPendingUploadFiles([]);
      setUploadPanelOpen(false);
      setMessage(`${count} image${count === 1 ? "" : "s"} uploaded. Add alt text and section path, then save.`);
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to upload image.");
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = (event) => {
    stageUploadFiles(event.target.files);
  };

  const toggleSelected = (url) => {
    setSelectedUrls((current) => {
      const next = new Set(current);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const selectedImages = images.filter((image) => selectedUrls.has(image.url));

  const exportImages = (targetImages, filename) => {
    if (!targetImages.length) {
      setMessage("Select at least one image to export.");
      return;
    }
    downloadImageSheet(targetImages, filename);
    setMessage("Image details sheet downloaded.");
  };

  const filteredImages = images.filter((image) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesStatus = statusFilter === "all"
      ? !image.isDeleted
      : statusFilter === "deleted"
        ? image.isDeleted
        : !image.isDeleted && image.status === statusFilter;
    const matchesSearch = !query || [
      image.url,
      image.altText,
      image.sectionPath,
      image.filename,
      image.originalName,
      ...(image.linkedPaths || [])
    ].some((value) => String(value || "").toLowerCase().includes(query));

    return matchesStatus && matchesSearch;
  });

  const activeImage = images.find((image) => image.url === activeImageUrl);

  const renderImageDetails = (image) => {
    if (!image) return null;

    const isEditing = editingUrl === image.url;

    return (
      <div style={detailsPanelStyle}>
        <div style={detailsPreviewStyle}>
          <img src={getPreviewUrl(image.url)} alt={image.altText || image.originalName || "Website image"} style={imageStyle} />
        </div>
        <div style={detailsContentStyle}>
          <div style={cardHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>{formatSource(image.source)}</p>
              <h2 style={cardTitleStyle}>{image.originalName || image.filename || "Website image"}</h2>
            </div>
            <span style={{ ...badgeStyle, ...staticBadgeStyle, ...(image.isDeleted ? deletedBadgeStyle : image.status === "active" ? activeBadgeStyle : inactiveBadgeStyle) }}>
              {image.isDeleted ? "Deleted" : image.status === "active" ? "Active" : "Inactive"}
            </span>
          </div>

          <div style={infoStackStyle}>
            <div style={infoBlockStyle}>
              <span style={labelStyle}>Image URL</span>
              <p style={pathStyle}>{image.url}</p>
            </div>
            <div style={infoBlockStyle}>
              <span style={labelStyle}>Used In Section</span>
              <p style={usedInStyle}>{getUsedInText(image)}</p>
            </div>
            <div style={infoBlockStyle}>
              <span style={labelStyle}>Alt Text</span>
              <p style={usedInStyle}>{image.altText || "Alt text not added"}</p>
            </div>
            <div style={infoBlockStyle}>
              <span style={labelStyle}>Linked ASIN / SKU</span>
              <p style={usedInStyle}>{getLinkedProductText(image, "asin") || "No ASIN linked"} / {getLinkedProductText(image, "sku") || "No SKU linked"}</p>
            </div>
          </div>

          {isEditing ? (
            <div style={editorPanelStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>Alt Text</span>
                <input
                  value={image.altText || ""}
                  onChange={(event) => updateLocalImage(image.url, { altText: event.target.value })}
                  placeholder="Describe the image for SEO and accessibility"
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span style={labelStyle}>Used In Section / Path</span>
                <textarea
                  value={image.sectionPath || ""}
                  onChange={(event) => updateLocalImage(image.url, { sectionPath: event.target.value })}
                  placeholder="Example: Homepage hero banner, Product page gallery, Category card, Footer logo"
                  style={textareaStyle}
                />
              </label>

              {image.linkedPaths?.length ? (
                <div style={linkedBoxStyle}>
                  <strong>Detected Source</strong>
                  <p>{image.linkedPaths.join(", ")}</p>
                </div>
              ) : null}

              <select
                value={image.status || "active"}
                onChange={(event) => updateLocalImage(image.url, { status: event.target.value })}
                style={inputStyle}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          ) : null}

          <div style={actionRowStyle}>
            {image.isDeleted ? (
              <button type="button" onClick={() => handleRestore(image)} disabled={savingUrl === image.url} style={restoreButtonStyle}>
                {savingUrl === image.url ? "Restoring..." : "Restore"}
              </button>
            ) : isEditing ? (
              <>
                <button type="button" onClick={() => handleSave(image)} disabled={savingUrl === image.url} style={primaryButtonStyle}>
                  {savingUrl === image.url ? "Saving..." : "Save"}
                </button>
                <button type="button" onClick={() => setEditingUrl("")} disabled={savingUrl === image.url} style={secondaryButtonStyle}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setEditingUrl(image.url)} style={primaryButtonStyle}>
                Edit
              </button>
            )}
            {!image.isDeleted ? (
              <button type="button" onClick={() => handleDelete(image)} disabled={savingUrl === image.url} style={dangerButtonStyle}>
                Delete
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <p style={eyebrowStyle}>Website Control</p>
          <h1 style={titleStyle}>Website Images</h1>
          <p style={subtextStyle}>Manage image alt text, section paths, active status, uploads, edits, and deleted visibility for overall Avyona website images.</p>
        </div>
        <div style={heroActionsStyle}>
          <button type="button" onClick={() => setUploadPanelOpen((current) => !current)} style={uploadButtonStyle}>
            {uploading ? "Uploading..." : "Add New Image"}
          </button>
          <button type="button" onClick={() => exportImages(images, "avyona-website-image-details.xlsx")} style={secondaryButtonStyle}>
            Download All Details
          </button>
          <button type="button" onClick={() => exportImages(selectedImages, "avyona-selected-image-details.xlsx")} style={secondaryButtonStyle}>
            Download Selected
          </button>
        </div>
      </section>

      {uploadPanelOpen ? (
        <section style={uploadPanelStyle}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDraggingUpload(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingUpload(true);
            }}
            onDragLeave={() => setIsDraggingUpload(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDraggingUpload(false);
              stageUploadFiles(event.dataTransfer.files);
            }}
            style={{
              ...uploadDropzoneStyle,
              ...(isDraggingUpload ? uploadDropzoneActiveStyle : null)
            }}
          >
            <strong>{uploading ? "Uploading..." : "Click to add or drag and drop"}</strong>
            <span>Select one or multiple images, then click Upload</span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleUpload} disabled={uploading} style={{ display: "none" }} />
          {pendingUploadFiles.length ? (
            <div style={pendingUploadStyle}>
              <div>
                <strong>{pendingUploadFiles.length} image{pendingUploadFiles.length === 1 ? "" : "s"} ready</strong>
                <p style={pendingHelpStyle}>Upload will start only after pressing Upload.</p>
              </div>
              <div style={pendingFileListStyle}>
                {pendingUploadFiles.slice(0, 5).map((file) => (
                  <span key={`${file.name}-${file.size}-${file.lastModified}`} style={pendingFileStyle}>{file.name}</span>
                ))}
                {pendingUploadFiles.length > 5 ? <span style={pendingFileStyle}>+{pendingUploadFiles.length - 5} more</span> : null}
              </div>
              <div style={actionRowStyle}>
                <button type="button" onClick={uploadPendingFiles} disabled={uploading} style={primaryButtonStyle}>
                  {uploading ? "Uploading..." : "Upload"}
                </button>
                <button type="button" onClick={() => setPendingUploadFiles([])} disabled={uploading} style={secondaryButtonStyle}>
                  Clear
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section style={toolbarStyle}>
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by image path, alt text, filename, or linked section"
          style={inputStyle}
        />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={selectStyle}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="deleted">Deleted / Recoverable</option>
        </select>
        <div style={viewToggleStyle}>
          <button type="button" onClick={() => setViewMode("visual")} style={viewMode === "visual" ? activeViewButtonStyle : viewButtonStyle}>Images</button>
          <button type="button" onClick={() => setViewMode("list")} style={viewMode === "list" ? activeViewButtonStyle : viewButtonStyle}>List</button>
        </div>
        <button type="button" onClick={loadImages} style={secondaryButtonStyle}>Refresh</button>
      </section>

      {message ? <div style={messageStyle}>{message}</div> : null}

      <section style={summaryStyle}>
        <span style={pillStyle}>{`Active Images: ${images.filter((image) => !image.isDeleted).length}`}</span>
        <span style={pillStyle}>{`Deleted: ${images.filter((image) => image.isDeleted).length}`}</span>
        <span style={pillStyle}>{`Showing: ${filteredImages.length}`}</span>
        <span style={pillStyle}>{`Selected: ${selectedUrls.size}`}</span>
        <span style={pillStyle}>Existing page controls are unchanged</span>
      </section>

      {loading ? (
        <section style={emptyStyle}>Loading website images...</section>
      ) : (
        <>
          {viewMode === "visual" ? (
            <>
              <section style={compactGridStyle}>
                {filteredImages.map((image) => (
                  <article key={image.url} style={activeImageUrl === image.url ? activeCompactCardStyle : compactCardStyle}>
                    <label style={selectImageStyle}>
                      <input type="checkbox" checked={selectedUrls.has(image.url)} onChange={() => toggleSelected(image.url)} />
                      <span>Select</span>
                    </label>
                    <button type="button" onClick={() => setActiveImageUrl(image.url)} style={visualImageButtonStyle}>
                      <img src={getPreviewUrl(image.url)} alt={image.altText || image.originalName || "Website image"} style={imageStyle} />
                    </button>
                    <span style={{ ...badgeStyle, ...(image.isDeleted ? deletedBadgeStyle : image.status === "active" ? activeBadgeStyle : inactiveBadgeStyle) }}>
                      {image.isDeleted ? "Deleted" : image.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </article>
                ))}
              </section>
              {!filteredImages.length ? <div style={emptyStyle}>No images found for the selected filters.</div> : null}
            </>
          ) : (
            <section style={listStyle}>
              {filteredImages.map((image) => (
                <article key={image.url} style={activeImageUrl === image.url ? activeListRowStyle : listRowStyle}>
                  <label style={rowSelectStyle}>
                    <input type="checkbox" checked={selectedUrls.has(image.url)} onChange={() => toggleSelected(image.url)} />
                    <span>Select</span>
                  </label>
                  <button type="button" onClick={() => setActiveImageUrl(image.url)} style={listThumbButtonStyle}>
                    <img src={getPreviewUrl(image.url)} alt={image.altText || image.originalName || "Website image"} style={imageStyle} />
                  </button>
                  <div style={listTextStyle}>
                    <strong>{image.originalName || image.filename || "Website image"}</strong>
                    <span>{image.url}</span>
                    <small>{getLinkedProductText(image, "asin") || "No ASIN"} / {getLinkedProductText(image, "sku") || "No SKU"}</small>
                  </div>
                  <span style={{ ...listBadgeStyle, ...(image.isDeleted ? deletedBadgeStyle : image.status === "active" ? activeBadgeStyle : inactiveBadgeStyle) }}>
                    {image.isDeleted ? "Deleted" : image.status === "active" ? "Active" : "Inactive"}
                  </span>
                  <div style={listActionsStyle}>
                    <button type="button" onClick={() => setActiveImageUrl(image.url)} style={secondaryButtonStyle}>Details</button>
                    {!image.isDeleted ? <button
                      type="button"
                      onClick={() => {
                        setActiveImageUrl(image.url);
                        setEditingUrl(image.url);
                      }}
                      style={primaryButtonStyle}
                    >
                      Edit
                    </button> : null}
                    {image.isDeleted
                      ? <button type="button" onClick={() => handleRestore(image)} disabled={savingUrl === image.url} style={restoreButtonStyle}>Restore</button>
                      : <button type="button" onClick={() => handleDelete(image)} disabled={savingUrl === image.url} style={dangerButtonStyle}>Delete</button>}
                  </div>
                </article>
              ))}
              {!filteredImages.length ? <div style={emptyStyle}>No images found for the selected filters.</div> : null}
            </section>
          )}
        </>
      )}

      {activeImage ? (
        <div
          style={modalOverlayStyle}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview and actions"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setActiveImageUrl("");
              setEditingUrl("");
            }
          }}
        >
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <p style={eyebrowStyle}>Image Preview</p>
                <h2 style={modalTitleStyle}>{activeImage.originalName || activeImage.filename || "Website image"}</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveImageUrl("");
                  setEditingUrl("");
                }}
                style={closeButtonStyle}
                aria-label="Close image preview"
              >
                x
              </button>
            </div>
            {renderImageDetails(activeImage)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const pageStyle = {
  display: "grid",
  gap: "16px"
};

const heroStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
  padding: "24px",
  border: "1px solid #dbe7df",
  borderRadius: "14px",
  background: "linear-gradient(135deg, #ffffff 0%, #eef8f0 100%)"
};

const heroActionsStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  justifyContent: "flex-end"
};

const uploadPanelStyle = {
  padding: "16px",
  border: "1px solid #dbe7df",
  borderRadius: "14px",
  background: "#ffffff"
};

const uploadDropzoneStyle = {
  width: "100%",
  minHeight: "150px",
  border: "1px dashed #94a3b8",
  borderRadius: "12px",
  background: "#f8fafc",
  color: "#334155",
  display: "grid",
  gap: "8px",
  placeItems: "center",
  alignContent: "center",
  cursor: "pointer",
  fontWeight: 800
};

const uploadDropzoneActiveStyle = {
  borderColor: "#16a34a",
  background: "#f0fdf4",
  color: "#166534"
};

const pendingUploadStyle = {
  display: "grid",
  gap: "10px",
  marginTop: "12px",
  padding: "12px",
  border: "1px solid #dbeafe",
  borderRadius: "10px",
  background: "#f8fbff"
};

const pendingHelpStyle = {
  margin: "4px 0 0",
  color: "#64748b",
  fontSize: "13px"
};

const pendingFileListStyle = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap"
};

const pendingFileStyle = {
  maxWidth: "220px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minHeight: "28px",
  display: "inline-flex",
  alignItems: "center",
  padding: "0 9px",
  borderRadius: "999px",
  background: "#eef2ff",
  color: "#3730a3",
  fontSize: "12px",
  fontWeight: 800
};

const eyebrowStyle = {
  margin: 0,
  color: "#15803d",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const titleStyle = {
  margin: "8px 0 0",
  fontSize: "34px",
  lineHeight: 1.1
};

const subtextStyle = {
  margin: "12px 0 0",
  color: "#64748b",
  maxWidth: "760px"
};

const toolbarStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 1fr) 180px 180px 120px",
  gap: "12px",
  padding: "16px",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  background: "#fff"
};

const viewToggleStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "6px",
  padding: "4px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  background: "#f8fafc"
};

const viewButtonStyle = {
  minHeight: "34px",
  border: 0,
  borderRadius: "6px",
  background: "transparent",
  color: "#475569",
  fontWeight: 800,
  cursor: "pointer"
};

const activeViewButtonStyle = {
  ...viewButtonStyle,
  background: "#ffffff",
  color: "#166534",
  boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)"
};

const summaryStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap"
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "15px",
  alignItems: "stretch"
};

const compactGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
  gap: "12px",
  alignItems: "stretch"
};

const compactCardStyle = {
  position: "relative",
  height: "150px",
  overflow: "hidden",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  background: "#f8fafc"
};

const activeCompactCardStyle = {
  ...compactCardStyle,
  borderColor: "#16a34a",
  boxShadow: "0 0 0 3px rgba(22, 163, 74, 0.14)"
};

const visualImageButtonStyle = {
  width: "100%",
  height: "100%",
  padding: 0,
  border: 0,
  background: "transparent",
  cursor: "pointer",
  display: "block"
};

const cardStyle = {
  display: "grid",
  gridTemplateRows: "190px 1fr",
  gap: "12px",
  padding: "14px",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  background: "#fff",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
  minHeight: "560px"
};

const previewStyle = {
  position: "relative",
  height: "190px",
  borderRadius: "10px",
  overflow: "hidden",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0"
};

const imageStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block"
};

const badgeStyle = {
  position: "absolute",
  top: "10px",
  left: "10px",
  padding: "5px 9px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 800
};

const staticBadgeStyle = {
  position: "static",
  display: "inline-flex",
  alignItems: "center",
  alignSelf: "start"
};

const selectImageStyle = {
  position: "absolute",
  top: "10px",
  right: "10px",
  zIndex: 2,
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  minHeight: "28px",
  padding: "0 8px",
  borderRadius: "999px",
  background: "rgba(255, 255, 255, 0.92)",
  color: "#0f172a",
  fontSize: "12px",
  fontWeight: 800,
  boxShadow: "0 6px 16px rgba(15, 23, 42, 0.12)"
};

const activeBadgeStyle = {
  color: "#166534",
  background: "#dcfce7"
};

const inactiveBadgeStyle = {
  color: "#92400e",
  background: "#fef3c7"
};

const deletedBadgeStyle = {
  color: "#991b1b",
  background: "#fee2e2"
};

const contentStyle = {
  display: "grid",
  gridTemplateRows: "auto auto 1fr auto",
  gap: "10px",
  minWidth: 0,
  height: "100%"
};

const detailsPanelStyle = {
  display: "grid",
  gridTemplateColumns: "260px minmax(0, 1fr)",
  gap: "16px",
  padding: 0,
  border: 0,
  borderRadius: 0,
  background: "#fff"
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "grid",
  placeItems: "center",
  padding: "24px",
  background: "rgba(15, 23, 42, 0.55)"
};

const modalStyle = {
  width: "min(980px, 100%)",
  maxHeight: "90vh",
  overflow: "auto",
  display: "grid",
  gap: "16px",
  padding: "18px",
  borderRadius: "12px",
  background: "#fff",
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)"
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
  gap: "14px",
  borderBottom: "1px solid #e2e8f0",
  paddingBottom: "12px"
};

const modalTitleStyle = {
  margin: "5px 0 0",
  fontSize: "22px",
  lineHeight: 1.2
};

const closeButtonStyle = {
  width: "36px",
  height: "36px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  background: "#fff",
  color: "#334155",
  fontSize: "18px",
  fontWeight: 800,
  cursor: "pointer"
};

const detailsPreviewStyle = {
  height: "210px",
  overflow: "hidden",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  background: "#f1f5f9"
};

const detailsContentStyle = {
  display: "grid",
  gap: "12px",
  minWidth: 0
};

const listStyle = {
  display: "grid",
  gap: "10px"
};

const listRowStyle = {
  display: "grid",
  gridTemplateColumns: "84px 76px minmax(0, 1fr) 90px auto",
  gap: "12px",
  alignItems: "center",
  minHeight: "86px",
  padding: "10px",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  background: "#fff"
};

const activeListRowStyle = {
  ...listRowStyle,
  borderColor: "#16a34a",
  boxShadow: "0 0 0 3px rgba(22, 163, 74, 0.12)"
};

const rowSelectStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  color: "#0f172a",
  fontSize: "12px",
  fontWeight: 800
};

const listThumbButtonStyle = {
  width: "76px",
  height: "64px",
  padding: 0,
  overflow: "hidden",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  background: "#f8fafc",
  cursor: "pointer"
};

const listTextStyle = {
  display: "grid",
  gap: "4px",
  minWidth: 0,
  color: "#334155"
};

const listBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "28px",
  padding: "0 9px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 800
};

const listActionsStyle = {
  display: "flex",
  gap: "8px",
  justifyContent: "flex-end",
  flexWrap: "wrap"
};

const cardHeaderStyle = {
  minHeight: "50px",
  display: "flex",
  justifyContent: "space-between",
  gap: "10px"
};

const cardTitleStyle = {
  margin: "4px 0 0",
  fontSize: "16px",
  lineHeight: 1.25,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden"
};

const pathStyle = {
  margin: "4px 0 0",
  color: "#64748b",
  fontSize: "12px",
  lineHeight: 1.35,
  wordBreak: "break-all",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden"
};

const infoStackStyle = {
  display: "grid",
  gap: "8px"
};

const infoBlockStyle = {
  minHeight: "54px",
  padding: "9px",
  border: "1px solid #edf2f7",
  borderRadius: "8px",
  background: "#fbfdff"
};

const usedInStyle = {
  margin: "4px 0 0",
  color: "#475569",
  fontSize: "12px",
  lineHeight: 1.4,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden"
};

const fieldStyle = {
  display: "grid",
  gap: "6px"
};

const labelStyle = {
  color: "#334155",
  fontSize: "13px",
  fontWeight: 800
};

const inputStyle = {
  width: "100%",
  minHeight: "42px",
  padding: "0 12px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  background: "#fff",
  boxSizing: "border-box"
};

const selectStyle = {
  ...inputStyle
};

const smallSelectStyle = {
  ...inputStyle,
  width: "150px"
};

const textareaStyle = {
  ...inputStyle,
  minHeight: "68px",
  padding: "10px 12px",
  resize: "vertical"
};

const editorPanelStyle = {
  display: "grid",
  gap: "8px",
  padding: "10px",
  border: "1px solid #dbeafe",
  borderRadius: "10px",
  background: "#f8fbff"
};

const linkedBoxStyle = {
  padding: "10px",
  borderRadius: "8px",
  background: "#f8fafc",
  color: "#475569",
  fontSize: "12px"
};

const actionRowStyle = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
  flexWrap: "nowrap",
  alignSelf: "end",
  whiteSpace: "nowrap"
};

const uploadButtonStyle = {
  display: "inline-flex",
  border: 0,
  alignItems: "center",
  justifyContent: "center",
  minHeight: "42px",
  padding: "0 16px",
  borderRadius: "9px",
  background: "#16a34a",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer"
};

const primaryButtonStyle = {
  minHeight: "42px",
  padding: "0 14px",
  border: 0,
  borderRadius: "8px",
  background: "#16a34a",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer"
};

const secondaryButtonStyle = {
  minHeight: "42px",
  padding: "0 14px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  background: "#fff",
  color: "#334155",
  fontWeight: 800,
  cursor: "pointer"
};

const dangerButtonStyle = {
  minHeight: "42px",
  padding: "0 14px",
  border: "1px solid #fecaca",
  borderRadius: "8px",
  background: "#fef2f2",
  color: "#b91c1c",
  fontWeight: 800,
  cursor: "pointer"
};

const restoreButtonStyle = {
  ...primaryButtonStyle,
  background: "#0f766e"
};

const pillStyle = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "32px",
  padding: "0 11px",
  borderRadius: "999px",
  background: "#f1f5f9",
  color: "#334155",
  fontSize: "13px",
  fontWeight: 800
};

const messageStyle = {
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  fontWeight: 800
};

const emptyStyle = {
  padding: "28px",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  background: "#fff",
  color: "#64748b",
  fontWeight: 800
};
