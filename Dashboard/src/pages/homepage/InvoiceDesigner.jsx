import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAdminInvoicePreview, fetchAdminInvoiceSamplePdf, fetchAdminSettings, updateAdminSettings, uploadAdminImage } from "../../api/adminApi";
import { resolveAdminMediaUrl } from "../../utils/media";

const DEFAULT_SETTINGS = {
  logoUrl: "",
  logoSource: "",
  headerText: "",
  footerText: "",
  footerThankYouNote: "Thank you for shopping with us!",
  computerGeneratedNote: "Computer-generated invoice. No signature required.",
  supportContactNote: "",
  websiteUrl: "",
  watermarkUrl: "",
  qrCodeUrl: "",
  bottomNoteText: "",
  signatureUrl: "",
  stampUrl: "",
  businessName: "",
  gstNumber: "",
  address: "",
  supportEmail: "",
  supportPhone: "",
  showLogo: true,
  showGst: true,
  showSupportDetails: true,
  showProductImage: false,
  showSkuAsin: true,
  showTax: true,
  showCreditPoints: true,
  showFooterNote: true,
  showWatermark: true,
  showQrCode: true,
  thankYouNote: "Thank you for shopping with us!",
  returnPolicyNote: "",
  warrantyNote: "",
  supportNote: ""
};

const SECTION_TOGGLES = [
  { key: "showLogo", label: "Show Logo", hint: "Display store logo in the invoice header" },
  { key: "showGst", label: "Show GST Number", hint: "Include GSTIN in the Sold By section" },
  { key: "showSupportDetails", label: "Show Support Details", hint: "Show email and phone in the Sold By section and footer" },
  { key: "showProductImage", label: "Show Product Image", hint: "Display a thumbnail next to each line item" },
  { key: "showSkuAsin", label: "Show SKU / ASIN", hint: "Show product SKU and ASIN code below the product name" },
  { key: "showTax", label: "Show Tax", hint: "Show computed tax amount per line item (when tax rate > 0)" },
  { key: "showCreditPoints", label: "Show Credit Points Discount", hint: "Show credit points redeemed as a discount row in the summary" },
  { key: "showFooterNote", label: "Show Footer Note", hint: "Show the footer note text at the bottom of the invoice" },
  { key: "showWatermark", label: "Show Watermark", hint: "Display a pale watermark image behind the invoice content" },
  { key: "showQrCode", label: "Show QR Code", hint: "Display the QR code in the invoice footer" }
];

function resolvePreviewUrl(value) {
  return resolveAdminMediaUrl(value);
}

export default function InvoiceDesigner() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saveState, setSaveState] = useState("idle");
  const [loadState, setLoadState] = useState("loading");
  const [uploadStates, setUploadStates] = useState({
    logo: { uploading: false, error: "" },
    qr: { uploading: false, error: "" },
    watermark: { uploading: false, error: "" },
    signature: { uploading: false, error: "" },
    stamp: { uploading: false, error: "" }
  });
  const [previewState, setPreviewState] = useState("idle");
  const [previewBlobUrl, setPreviewBlobUrl] = useState("");
  const previewRef = React.useRef(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const response = await fetchAdminSettings();
        const raw = response.data?.data || response.data || {};
        const saved = raw.invoiceDesigner || {};
        if (isMounted) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...saved,
            logoSource: saved.logoSource || saved.logoUrl || "",
            footerThankYouNote: saved.footerThankYouNote || saved.thankYouNote || DEFAULT_SETTINGS.footerThankYouNote,
            computerGeneratedNote: saved.computerGeneratedNote || saved.footerText || DEFAULT_SETTINGS.computerGeneratedNote,
            supportContactNote: saved.supportContactNote || saved.supportNote || ""
          });
          setLoadState("ready");
        }
      } catch {
        if (isMounted) setLoadState("ready");
      }
    }
    load();
    return () => { isMounted = false; };
  }, []);

  function update(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaveState("saving");
    try {
      const response = await fetchAdminSettings();
      const current = response.data?.data || response.data || {};
      const nextSettings = {
        ...settings,
        logoUrl: settings.logoSource || settings.logoUrl,
        footerText: settings.computerGeneratedNote || settings.footerText,
        thankYouNote: settings.footerThankYouNote || settings.thankYouNote,
        supportNote: settings.supportContactNote || settings.supportNote
      };
      await updateAdminSettings({ settings: { ...current, invoiceDesigner: nextSettings } });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  }

  async function handlePreview() {
    setPreviewState("loading");
    try {
      const response = await fetchAdminInvoicePreview(false);
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
      const blob = new Blob([response.data], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
      setPreviewState("ready");
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch {
      setPreviewState("error");
      setTimeout(() => setPreviewState("idle"), 3000);
    }
  }

  async function handleDownloadSample() {
    try {
      const response = await fetchAdminInvoiceSamplePdf();
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "sample-invoice-AVY-SAMPLE-001.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch {
      // silently ignore — print dialog may have been blocked
    }
  }

  function closePreview() {
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    setPreviewBlobUrl("");
    setPreviewState("idle");
  }

  async function handleImageUpload(field, file) {
    if (!file) return;
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);
    if (!allowed.has(file.type)) {
      setUploadStates((prev) => ({ ...prev, [field]: { uploading: false, error: "Upload a PNG, JPG, WebP, or SVG image." } }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadStates((prev) => ({ ...prev, [field]: { uploading: false, error: "Image must be under 2 MB." } }));
      return;
    }
    setUploadStates((prev) => ({ ...prev, [field]: { uploading: true, error: "" } }));
    try {
      const res = await uploadAdminImage(file);
      const url = res.data?.url || res.data?.data?.url || "";
      const keyMap = { logo: "logoUrl", qr: "qrCodeUrl", watermark: "watermarkUrl", signature: "signatureUrl", stamp: "stampUrl" };
      update(keyMap[field], url);
      setUploadStates((prev) => ({ ...prev, [field]: { uploading: false, error: "" } }));
    } catch {
      setUploadStates((prev) => ({ ...prev, [field]: { uploading: false, error: "Upload failed. Please try again." } }));
    }
  }

  const saveLabel = saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "Save Settings";

  if (loadState === "loading") {
    return (
      <section className="dashboard-page-shell">
        <div style={heroCardStyle}>
          <span style={eyebrowStyle}>Invoice Designer</span>
          <h2 style={titleStyle}>Loading settings...</h2>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-page-shell">
      <div style={heroCardStyle}>
        <span style={eyebrowStyle}>Thank You Page</span>
        <h2 style={titleStyle}>Invoice Designer</h2>
        <p style={copyStyle}>
          Customise every aspect of the PDF invoice — branding, business info, which sections appear, and the text shown to customers.
        </p>
      </div>

      <div style={actionBarStyle}>
        <Link to="/dashboard/homepage/thank-you-page" style={backLinkStyle}>← Back to Thank You Page</Link>
        <div style={actionRightStyle}>
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewState === "loading"}
            style={previewState === "loading" ? previewButtonLoadingStyle : previewButtonStyle}
          >
            {previewState === "loading" ? "Loading..." : previewState === "error" ? "Preview failed" : "Preview Invoice"}
          </button>
          <button
            type="button"
            onClick={handleDownloadSample}
            style={downloadSampleButtonStyle}
          >
            Download Sample
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveState === "saving"}
            style={saveState === "saved" ? savedButtonStyle : saveState === "error" ? errorButtonStyle : saveButtonStyle}
          >
            {saveLabel}
          </button>
        </div>
      </div>

      {/* ── Row 1: Branding + Business Info ── */}
      <div style={gridStyle}>

        {/* Invoice Branding */}
        <article style={panelStyle}>
          <div style={panelHeadStyle}>
            <h3 style={panelTitleStyle}>Invoice Branding</h3>
            <p style={panelCopyStyle}>Logo, header line, footer line, and signature / stamp images.</p>
          </div>

          <div style={fieldGroupStyle}>

            {/* Logo */}
            <ImageUploadRow
              label="Logo Source"
              hint="Overrides the store logo — leave empty to use the store logo from General Settings"
              fieldKey="logo"
              value={settings.logoSource || settings.logoUrl}
              onClear={() => { update("logoSource", ""); update("logoUrl", ""); }}
              onUpload={(file) => handleImageUpload("logo", file)}
              uploadState={uploadStates.logo}
            />

            <div style={dividerStyle} />

            <label style={fieldRowStyle}>
              <div style={fieldLabelRowStyle}>
                <span style={labelStyle}>Header Text</span>
                <span style={hintStyle}>Small line shown below the logo in the invoice header</span>
              </div>
              <input
                type="text"
                value={settings.headerText}
                onChange={(e) => update("headerText", e.target.value)}
                placeholder="e.g. Authorised Reseller · ISO Certified"
                style={inputStyle}
              />
            </label>

            <label style={fieldRowStyle}>
              <div style={fieldLabelRowStyle}>
                <span style={labelStyle}>Computer-generated Invoice Note</span>
                <span style={hintStyle}>Legal note shown in the invoice footer</span>
              </div>
              <input
                type="text"
                value={settings.computerGeneratedNote}
                onChange={(e) => update("computerGeneratedNote", e.target.value)}
                placeholder="Computer-generated invoice. No signature required."
                style={inputStyle}
              />
            </label>

            <div style={dividerStyle} />

            <ImageUploadRow
              label="QR Code Image / URL"
              hint="Upload a QR image, or paste a URL in the field below"
              fieldKey="qr"
              value={settings.qrCodeUrl}
              onClear={() => update("qrCodeUrl", "")}
              onUpload={(file) => handleImageUpload("qr", file)}
              uploadState={uploadStates.qr}
              previewStyle={{ maxHeight: "72px", maxWidth: "72px", objectFit: "contain", borderRadius: "8px", border: "1px solid #e5edf5", background: "#f8fafc", padding: "6px" }}
            />

            <label style={fieldRowStyle}>
              <div style={fieldLabelRowStyle}>
                <span style={labelStyle}>QR Code URL</span>
                <span style={hintStyle}>Optional direct URL if you do not upload an image</span>
              </div>
              <input
                type="text"
                value={settings.qrCodeUrl}
                onChange={(e) => update("qrCodeUrl", e.target.value)}
                placeholder="https://yourstore.com/pay-or-track"
                style={inputStyle}
              />
            </label>

            <div style={dividerStyle} />

            <ImageUploadRow
              label="Watermark Image"
              hint="Pale background image shown behind the invoice table and totals"
              fieldKey="watermark"
              value={settings.watermarkUrl}
              onClear={() => update("watermarkUrl", "")}
              onUpload={(file) => handleImageUpload("watermark", file)}
              uploadState={uploadStates.watermark}
              previewStyle={{ maxHeight: "86px", maxWidth: "180px", objectFit: "contain", borderRadius: "8px", border: "1px solid #e5edf5", background: "#f8fafc", padding: "6px", opacity: 0.55 }}
            />

            <div style={dividerStyle} />

            {/* Signature */}
            <ImageUploadRow
              label="Signature Image (Optional)"
              hint="Authorised signatory image shown in the bottom right — PNG with transparent background recommended"
              fieldKey="signature"
              value={settings.signatureUrl}
              onClear={() => update("signatureUrl", "")}
              onUpload={(file) => handleImageUpload("signature", file)}
              uploadState={uploadStates.signature}
              previewStyle={{ maxHeight: "48px", maxWidth: "160px", objectFit: "contain" }}
            />

            {/* Stamp */}
            <ImageUploadRow
              label="Company Stamp / Seal (Optional)"
              hint="Round stamp or seal image shown beside the signature — PNG with transparent background recommended"
              fieldKey="stamp"
              value={settings.stampUrl}
              onClear={() => update("stampUrl", "")}
              onUpload={(file) => handleImageUpload("stamp", file)}
              uploadState={uploadStates.stamp}
              previewStyle={{ maxHeight: "64px", maxWidth: "64px", objectFit: "contain" }}
            />

          </div>
        </article>

        {/* Business Information */}
        <article style={panelStyle}>
          <div style={panelHeadStyle}>
            <h3 style={panelTitleStyle}>Business Information</h3>
            <p style={panelCopyStyle}>Shown in the "Sold By" section of the invoice. Leave a field empty to use the value from General Settings.</p>
          </div>

          <div style={fieldGroupStyle}>
            {[
              { key: "businessName", label: "Business / Legal Name", placeholder: "Uses store name from General Settings" },
              { key: "gstNumber", label: "Business GSTIN", placeholder: "Uses GST from General Settings" },
              { key: "supportPhone", label: "Toll-free / Phone", placeholder: "Uses phone from General Settings", type: "tel" },
              { key: "supportEmail", label: "Support Email", placeholder: "Uses email from General Settings", type: "email" },
              { key: "websiteUrl", label: "Website URL", placeholder: "https://avyona.com", type: "url" }
            ].map(({ key, label, placeholder, type }) => (
              <label key={key} style={fieldRowStyle}>
                <div style={fieldLabelRowStyle}>
                  <span style={labelStyle}>{label}</span>
                </div>
                <input
                  type={type || "text"}
                  value={settings[key]}
                  onChange={(e) => update(key, e.target.value)}
                  placeholder={placeholder}
                  style={inputStyle}
                />
              </label>
            ))}
            <label style={fieldRowStyle}>
              <div style={fieldLabelRowStyle}>
                <span style={labelStyle}>Business Address</span>
              </div>
              <textarea
                value={settings.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="Uses address from General Settings"
                rows={3}
                style={{ ...inputStyle, minHeight: "80px", paddingTop: "10px", paddingBottom: "10px", resize: "vertical" }}
              />
            </label>
          </div>
        </article>

      </div>

      {/* ── Row 2: Invoice Sections ── */}
      <article style={panelStyle}>
        <div style={panelHeadStyle}>
          <h3 style={panelTitleStyle}>Invoice Sections</h3>
          <p style={panelCopyStyle}>Toggle which sections and columns appear on the invoice.</p>
        </div>
        <div style={toggleGridStyle}>
          {SECTION_TOGGLES.map(({ key, label, hint }) => (
            <div key={key} style={toggleItemStyle}>
              <div>
                <span style={labelStyle}>{label}</span>
                <span style={{ ...hintStyle, display: "block", marginTop: "2px" }}>{hint}</span>
              </div>
              <button
                type="button"
                style={toggleButtonStyle(settings[key])}
                onClick={() => update(key, !settings[key])}
              >
                <span style={toggleKnobStyle(settings[key])} />
                <span style={toggleLabelTextStyle}>{settings[key] ? "On" : "Off"}</span>
              </button>
            </div>
          ))}
        </div>
      </article>

      {/* ── Row 3: Editable Notes ── */}
      <article style={panelStyle}>
        <div style={panelHeadStyle}>
          <h3 style={panelTitleStyle}>Invoice Notes</h3>
          <p style={panelCopyStyle}>Custom text shown at the bottom of the invoice. Leave a note blank to hide that section.</p>
        </div>
        <div style={notesGridStyle}>
          {[
            { key: "footerThankYouNote", label: "Footer Thank-you Note", placeholder: "Thank you for shopping with us!" },
            { key: "computerGeneratedNote", label: "Computer-generated Invoice Note", placeholder: "Computer-generated invoice. No signature required." },
            { key: "supportContactNote", label: "Support Contact Note", placeholder: "For support, contact support@yourstore.com." },
            { key: "bottomNoteText", label: "Bottom Note Text", placeholder: "Order note or final customer message." }
          ].map(({ key, label, placeholder }) => (
            <label key={key} style={fieldRowStyle}>
              <div style={fieldLabelRowStyle}>
                <span style={labelStyle}>{label}</span>
              </div>
              <textarea
                value={settings[key]}
                onChange={(e) => update(key, e.target.value)}
                placeholder={placeholder}
                rows={2}
                style={{ ...inputStyle, minHeight: "64px", paddingTop: "10px", paddingBottom: "10px", resize: "vertical" }}
              />
            </label>
          ))}
        </div>
      </article>

      {/* ── Invoice Preview ── */}
      {previewBlobUrl && (
        <article ref={previewRef} style={previewPanelStyle}>
          <div style={previewPanelHeadStyle}>
            <div>
              <span style={eyebrowStyle}>Sample Invoice Preview</span>
              <p style={panelCopyStyle}>Demo order data with your current saved settings. Save first to reflect any unsaved changes.</p>
            </div>
            <div style={previewHeadActionsStyle}>
              <button type="button" onClick={handlePreview} disabled={previewState === "loading"} style={refreshPreviewButtonStyle}>
                {previewState === "loading" ? "Refreshing..." : "Refresh"}
              </button>
              <button type="button" onClick={closePreview} style={closePreviewButtonStyle}>Close</button>
            </div>
          </div>
          <iframe src={previewBlobUrl} style={previewIframeStyle} title="Invoice Preview" sandbox="allow-scripts allow-same-origin" />
        </article>
      )}

    </section>
  );
}

function ImageUploadRow({ label, hint, fieldKey, value, onClear, onUpload, uploadState, previewStyle }) {
  const previewUrl = resolvePreviewUrl(value);
  const defaultPreviewStyle = { maxHeight: "52px", maxWidth: "160px", objectFit: "contain", borderRadius: "8px", border: "1px solid #e5edf5", background: "#f8fafc", padding: "6px" };
  return (
    <div style={fieldRowStyle}>
      <div style={fieldLabelRowStyle}>
        <span style={labelStyle}>{label}</span>
        <span style={hintStyle}>{hint}</span>
      </div>
      {previewUrl && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={previewUrl} alt="" style={previewStyle || defaultPreviewStyle} />
          <button type="button" onClick={onClear} style={removeButtonStyle}>Remove</button>
        </div>
      )}
      <label style={uploadLabelStyle}>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          style={{ display: "none" }}
          onChange={(e) => onUpload(e.target.files?.[0])}
        />
        {uploadState.uploading ? "Uploading..." : previewUrl ? "Replace Image" : "Upload Image"}
      </label>
      {uploadState.error && <span style={errorTextStyle}>{uploadState.error}</span>}
    </div>
  );
}

function toggleButtonStyle(enabled) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "36px",
    padding: "0 12px 0 6px",
    borderRadius: "999px",
    border: enabled ? "1px solid #16a34a" : "1px solid #cbd5e1",
    background: enabled ? "#f0fdf4" : "#f8fafc",
    cursor: "pointer",
    flexShrink: 0
  };
}

function toggleKnobStyle(enabled) {
  return {
    display: "block",
    width: "20px",
    height: "20px",
    borderRadius: "999px",
    background: enabled ? "#16a34a" : "#94a3b8",
    transition: "background 0.2s"
  };
}

const toggleLabelTextStyle = { fontSize: "13px", fontWeight: 700, color: "#0f172a" };

const heroCardStyle = {
  background: "linear-gradient(135deg, #ffffff 0%, #f4fbf6 55%, #edf7ff 100%)",
  borderRadius: "20px",
  border: "1px solid rgba(203, 213, 225, 0.7)",
  boxShadow: "0 14px 34px rgba(174, 203, 190, 0.18)",
  padding: "22px",
  display: "grid",
  gap: "8px"
};

const eyebrowStyle = {
  color: "#0f766e",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase"
};

const titleStyle = { margin: 0, fontSize: "32px", color: "#0f172a" };

const copyStyle = { margin: 0, color: "#526377", maxWidth: "760px", lineHeight: 1.65 };

const actionBarStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
  padding: "14px 18px",
  borderRadius: "18px",
  background: "#ffffff",
  border: "1px solid rgba(203, 213, 225, 0.75)",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)"
};

const backLinkStyle = { color: "#475569", fontSize: "14px", fontWeight: 600, textDecoration: "none" };

const saveButtonStyle = {
  minHeight: "40px",
  padding: "0 20px",
  borderRadius: "999px",
  border: "1px solid rgba(15, 23, 42, 0.1)",
  background: "linear-gradient(135deg, #0f172a 0%, #1f4336 100%)",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "14px"
};

const savedButtonStyle = { ...saveButtonStyle, background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)" };
const errorButtonStyle = { ...saveButtonStyle, background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)" };

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "20px"
};

const panelStyle = {
  background: "#fff",
  borderRadius: "18px",
  border: "1px solid rgba(203, 213, 225, 0.7)",
  boxShadow: "0 14px 34px rgba(174, 203, 190, 0.18)",
  padding: "20px",
  display: "grid",
  gap: "18px",
  alignContent: "start"
};

const panelHeadStyle = { display: "grid", gap: "4px" };
const panelTitleStyle = { margin: 0, fontSize: "20px", color: "#0f172a" };
const panelCopyStyle = { margin: 0, color: "#64748b", fontSize: "13px", lineHeight: 1.55 };
const fieldGroupStyle = { display: "grid", gap: "12px" };

const fieldRowStyle = {
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #e5edf5",
  background: "#f8fafc",
  display: "grid",
  gap: "10px"
};

const fieldLabelRowStyle = { display: "grid", gap: "3px" };
const labelStyle = { color: "#0f172a", fontSize: "13px", fontWeight: 700 };
const hintStyle = { color: "#64748b", fontSize: "12px" };

const inputStyle = {
  width: "100%",
  minHeight: "44px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  padding: "0 14px",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "14px",
  boxSizing: "border-box"
};

const dividerStyle = { borderTop: "1px solid #e5edf5" };

const uploadLabelStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "36px",
  padding: "0 14px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer"
};

const removeButtonStyle = {
  padding: "6px 12px",
  borderRadius: "8px",
  border: "1px solid #fecaca",
  background: "#fff5f5",
  color: "#dc2626",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer"
};

const errorTextStyle = { color: "#dc2626", fontSize: "12px", fontWeight: 600 };

const toggleGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px"
};

const toggleItemStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "12px",
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #e5edf5",
  background: "#f8fafc"
};

const notesGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px"
};

const actionRightStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap"
};

const previewButtonStyle = {
  minHeight: "40px",
  padding: "0 16px",
  borderRadius: "999px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "14px"
};

const previewButtonLoadingStyle = {
  ...previewButtonStyle,
  color: "#94a3b8",
  cursor: "not-allowed"
};

const downloadSampleButtonStyle = {
  minHeight: "40px",
  padding: "0 16px",
  borderRadius: "999px",
  border: "1px solid #0f766e",
  background: "#f0fdfa",
  color: "#0f766e",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "14px"
};

const previewPanelStyle = {
  background: "#fff",
  borderRadius: "18px",
  border: "1px solid rgba(203, 213, 225, 0.7)",
  boxShadow: "0 14px 34px rgba(174, 203, 190, 0.18)",
  padding: "20px",
  display: "grid",
  gap: "16px"
};

const previewPanelHeadStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap"
};

const previewHeadActionsStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexShrink: 0
};

const refreshPreviewButtonStyle = {
  minHeight: "34px",
  padding: "0 14px",
  borderRadius: "999px",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#475569",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "13px"
};

const closePreviewButtonStyle = {
  minHeight: "34px",
  padding: "0 14px",
  borderRadius: "999px",
  border: "1px solid #fecaca",
  background: "#fff5f5",
  color: "#dc2626",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "13px"
};

const previewIframeStyle = {
  width: "100%",
  height: "860px",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  background: "#f3f4f6",
  display: "block"
};
