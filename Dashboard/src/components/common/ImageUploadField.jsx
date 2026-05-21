import React from "react";
import { resolveAdminMediaUrl } from "../../utils/media";

export default function ImageUploadField({
  label,
  value,
  uploadState,
  onUpload,
  onRemove,
  compact = false,
  accept = "image/png,image/jpeg,image/webp",
  helperText = "PNG, JPG, JPEG, or WebP. Max 2 MB."
}) {
  const inputRef = React.useRef(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const previewUrl = resolveAdminMediaUrl(value);
  const isUploading = uploadState?.status === "uploading";
  const error = uploadState?.error || "";

  const handleFiles = (files) => {
    const file = files?.[0];
    if (!file || isUploading) return;
    onUpload(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const openPicker = () => {
    if (!isUploading) inputRef.current?.click();
  };

  return (
    <div style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <button
        type="button"
        onClick={openPicker}
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
        disabled={isUploading}
        style={{
          ...uploadBoxStyle,
          ...(compact ? compactUploadBoxStyle : null),
          ...(isDragging ? uploadBoxActiveStyle : null),
          ...(isUploading ? uploadBoxLoadingStyle : null)
        }}
      >
        {isUploading ? (
          <span style={uploadCopyStyle}>
            <strong>Uploading...</strong>
            <small>Please wait</small>
          </span>
        ) : previewUrl ? (
          <img src={previewUrl} alt={label} style={compact ? compactUploadPreviewStyle : uploadPreviewStyle} />
        ) : (
          <span style={uploadCopyStyle}>
            <strong>Click or drag image here</strong>
            <small>{helperText}</small>
          </span>
        )}
      </button>
      <input ref={inputRef} type="file" accept={accept} onChange={(event) => handleFiles(event.target.files)} style={{ display: "none" }} />
      <div style={imageActionRowStyle}>
        <button type="button" onClick={openPicker} disabled={isUploading} style={secondaryButtonStyle}>
          {value ? "Replace Image" : "Upload Image"}
        </button>
        {value ? (
          <button type="button" onClick={onRemove} disabled={isUploading} style={dangerButtonStyle}>
            Remove Image
          </button>
        ) : null}
      </div>
      {error ? <small style={errorStyle}>{error}</small> : null}
    </div>
  );
}

const fieldStyle = {
  display: "grid",
  gap: "8px"
};

const labelStyle = {
  color: "#334155",
  fontSize: "13px",
  fontWeight: 800
};

const uploadBoxStyle = {
  width: "100%",
  minHeight: "168px",
  border: "1px dashed #94a3b8",
  borderRadius: "14px",
  background: "#f8fafc",
  display: "grid",
  placeItems: "center",
  padding: "14px",
  cursor: "pointer",
  overflow: "hidden",
  transition: "border-color 160ms ease, background 160ms ease, opacity 160ms ease"
};

const compactUploadBoxStyle = {
  minHeight: "118px"
};

const uploadBoxActiveStyle = {
  borderColor: "#0f766e",
  background: "#f0fdfa"
};

const uploadBoxLoadingStyle = {
  cursor: "wait",
  opacity: 0.78
};

const uploadPreviewStyle = {
  maxWidth: "100%",
  maxHeight: "138px",
  objectFit: "contain"
};

const compactUploadPreviewStyle = {
  maxWidth: "72px",
  maxHeight: "72px",
  objectFit: "contain"
};

const uploadCopyStyle = {
  display: "grid",
  gap: "4px",
  textAlign: "center",
  color: "#475569"
};

const imageActionRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px"
};

const secondaryButtonStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 800,
  padding: "10px 14px",
  cursor: "pointer"
};

const dangerButtonStyle = {
  border: "1px solid #fecaca",
  borderRadius: "12px",
  background: "#fff1f2",
  color: "#b91c1c",
  fontWeight: 800,
  padding: "10px 14px",
  cursor: "pointer"
};

const errorStyle = {
  color: "#b91c1c",
  fontWeight: 700
};
