import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAdminSettings, updateAdminSettings, uploadAdminImage } from "../../api/adminApi";
import { resolveAdminMediaUrl } from "../../utils/media";

const DEFAULT_SETTINGS = {
  successTitle: "Thank you for your order",
  successSubtitle: "Your order has been placed successfully.",
  confirmationLabel: "ORDER CONFIRMED",
  useCustomIcon: false,
  customIconUrl: "",
  showThankYouMessage: true,
  showTrackOrderButton: true,
  trackOrderButtonText: "Track Order",
  trackOrderButtonStyle: "primary",
  showContinueShoppingButton: true,
  continueShoppingButtonText: "Continue Shopping",
  continueShoppingButtonStyle: "secondary",
  showDownloadInvoiceButton: false,
  downloadInvoiceButtonText: "Download Invoice",
  downloadInvoiceButtonStyle: "secondary"
};

const BUTTON_STYLE_OPTIONS = [
  { value: "primary", label: "Primary (Dark filled)" },
  { value: "secondary", label: "Secondary (Light outlined)" },
  { value: "ghost", label: "Ghost (Text only)" }
];

function resolvePreviewUrl(value) {
  return resolveAdminMediaUrl(value);
}

export default function ThankYouPageSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saveState, setSaveState] = useState("idle");
  const [loadState, setLoadState] = useState("loading");
  const [iconUploadState, setIconUploadState] = useState({ uploading: false, error: "" });

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const response = await fetchAdminSettings();
        const raw = response.data?.data || response.data || {};
        const saved = raw.thankYouPage || {};
        if (isMounted) {
          setSettings({ ...DEFAULT_SETTINGS, ...saved });
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
      await updateAdminSettings({ settings: { ...current, thankYouPage: settings } });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  }

  async function handleIconUpload(file) {
    if (!file) return;
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);
    if (!allowed.has(file.type)) {
      setIconUploadState({ uploading: false, error: "Upload a PNG, JPG, WebP, or SVG image." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setIconUploadState({ uploading: false, error: "Image must be under 2 MB." });
      return;
    }
    setIconUploadState({ uploading: true, error: "" });
    try {
      const response = await uploadAdminImage(file);
      const url = response.data?.url || response.data?.data?.url || "";
      update("customIconUrl", url);
      setIconUploadState({ uploading: false, error: "" });
    } catch {
      setIconUploadState({ uploading: false, error: "Upload failed. Please try again." });
    }
  }

  const saveLabel = saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "Save Settings";
  const iconPreviewUrl = resolvePreviewUrl(settings.customIconUrl);

  if (loadState === "loading") {
    return (
      <section className="dashboard-page-shell">
        <div style={heroCardStyle}>
          <span style={eyebrowStyle}>Homepage Section</span>
          <h2 style={titleStyle}>Thank You Page</h2>
          <p style={copyStyle}>Loading settings...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-page-shell">
      <div style={heroCardStyle}>
        <span style={eyebrowStyle}>Homepage Section</span>
        <h2 style={titleStyle}>Thank You Page</h2>
        <p style={copyStyle}>
          Manage order confirmation content, buttons, trust messages, and invoice design shown to customers after a successful order.
        </p>
      </div>

      <div style={actionBarStyle}>
        <Link to="/dashboard/homepage" style={backLinkStyle}>← Back to Homepage</Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={saveState === "saving"}
          style={saveState === "saved" ? savedButtonStyle : saveState === "error" ? errorButtonStyle : saveButtonStyle}
        >
          {saveLabel}
        </button>
      </div>

      <div style={gridStyle}>

        {/* ── Page Content ── */}
        <article style={panelStyle}>
          <div style={panelHeadStyle}>
            <h3 style={panelTitleStyle}>Page Content</h3>
            <p style={panelCopyStyle}>Text shown on the confirmation page after a customer places an order.</p>
          </div>

          <div style={fieldGroupStyle}>
            <label style={fieldRowStyle}>
              <div style={fieldLabelRowStyle}>
                <span style={labelStyle}>Enable Thank You Message</span>
                <span style={hintStyle}>Show or hide the full confirmation message block</span>
              </div>
              <button
                type="button"
                style={toggleButtonStyle(settings.showThankYouMessage)}
                onClick={() => update("showThankYouMessage", !settings.showThankYouMessage)}
              >
                <span style={toggleKnobStyle(settings.showThankYouMessage)} />
                <span style={toggleLabelTextStyle}>{settings.showThankYouMessage ? "Enabled" : "Disabled"}</span>
              </button>
            </label>

            <label style={fieldRowStyle}>
              <div style={fieldLabelRowStyle}>
                <span style={labelStyle}>Order Confirmation Label</span>
                <span style={hintStyle}>Eyebrow label shown above the title — e.g. ORDER CONFIRMED</span>
              </div>
              <input
                type="text"
                value={settings.confirmationLabel}
                onChange={(e) => update("confirmationLabel", e.target.value)}
                placeholder="ORDER CONFIRMED"
                style={inputStyle}
              />
            </label>

            <label style={fieldRowStyle}>
              <div style={fieldLabelRowStyle}>
                <span style={labelStyle}>Success Title</span>
                <span style={hintStyle}>Main heading customers see after placing an order</span>
              </div>
              <input
                type="text"
                value={settings.successTitle}
                onChange={(e) => update("successTitle", e.target.value)}
                placeholder="Thank you for your order"
                style={inputStyle}
              />
            </label>

            <label style={fieldRowStyle}>
              <div style={fieldLabelRowStyle}>
                <span style={labelStyle}>Success Subtitle</span>
                <span style={hintStyle}>Supporting line shown below the title</span>
              </div>
              <input
                type="text"
                value={settings.successSubtitle}
                onChange={(e) => update("successSubtitle", e.target.value)}
                placeholder="Your order has been placed successfully."
                style={inputStyle}
              />
            </label>
          </div>

          {/* Icon */}
          <div style={dividerStyle} />
          <div style={panelHeadStyle}>
            <h4 style={subHeadStyle}>Success Icon</h4>
            <p style={panelCopyStyle}>Use the default animated tick or upload a custom icon image.</p>
          </div>

          <div style={fieldGroupStyle}>
            <label style={fieldRowStyle}>
              <div style={fieldLabelRowStyle}>
                <span style={labelStyle}>Use Custom Icon</span>
                <span style={hintStyle}>Off = animated tick icon; On = your uploaded image</span>
              </div>
              <button
                type="button"
                style={toggleButtonStyle(settings.useCustomIcon)}
                onClick={() => update("useCustomIcon", !settings.useCustomIcon)}
              >
                <span style={toggleKnobStyle(settings.useCustomIcon)} />
                <span style={toggleLabelTextStyle}>{settings.useCustomIcon ? "Custom icon" : "Default tick"}</span>
              </button>
            </label>

            {settings.useCustomIcon && (
              <div style={fieldRowStyle}>
                <div style={fieldLabelRowStyle}>
                  <span style={labelStyle}>Custom Icon Image</span>
                  <span style={hintStyle}>PNG, JPG, WebP, or SVG — max 2 MB</span>
                </div>
                {iconPreviewUrl && (
                  <div style={iconPreviewWrapStyle}>
                    <img src={iconPreviewUrl} alt="Custom success icon preview" style={iconPreviewStyle} />
                    <button type="button" onClick={() => update("customIconUrl", "")} style={removeIconButtonStyle}>Remove</button>
                  </div>
                )}
                <label style={uploadLabelStyle}>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    style={{ display: "none" }}
                    onChange={(e) => handleIconUpload(e.target.files?.[0])}
                  />
                  {iconUploadState.uploading ? "Uploading..." : iconPreviewUrl ? "Replace Image" : "Upload Image"}
                </label>
                {iconUploadState.error && <span style={errorTextStyle}>{iconUploadState.error}</span>}
              </div>
            )}
          </div>
        </article>

        {/* ── Buttons ── */}
        <article style={panelStyle}>
          <div style={panelHeadStyle}>
            <h3 style={panelTitleStyle}>Buttons</h3>
            <p style={panelCopyStyle}>Configure which action buttons appear and how they are labelled.</p>
          </div>

          <div style={fieldGroupStyle}>
            <ButtonRow
              label="Track Order Button"
              hint="Links customer to the order tracking page"
              enabled={settings.showTrackOrderButton}
              onToggle={() => update("showTrackOrderButton", !settings.showTrackOrderButton)}
              text={settings.trackOrderButtonText}
              onTextChange={(v) => update("trackOrderButtonText", v)}
              buttonStyle={settings.trackOrderButtonStyle}
              onStyleChange={(v) => update("trackOrderButtonStyle", v)}
            />

            <div style={dividerStyle} />

            <ButtonRow
              label="Continue Shopping Button"
              hint="Links customer back to the collections page"
              enabled={settings.showContinueShoppingButton}
              onToggle={() => update("showContinueShoppingButton", !settings.showContinueShoppingButton)}
              text={settings.continueShoppingButtonText}
              onTextChange={(v) => update("continueShoppingButtonText", v)}
              buttonStyle={settings.continueShoppingButtonStyle}
              onStyleChange={(v) => update("continueShoppingButtonStyle", v)}
            />

            <div style={dividerStyle} />

            <ButtonRow
              label="Download Invoice Button"
              hint="Allows customer to download a PDF invoice for the order"
              enabled={settings.showDownloadInvoiceButton}
              onToggle={() => update("showDownloadInvoiceButton", !settings.showDownloadInvoiceButton)}
              text={settings.downloadInvoiceButtonText}
              onTextChange={(v) => update("downloadInvoiceButtonText", v)}
              buttonStyle={settings.downloadInvoiceButtonStyle}
              onStyleChange={(v) => update("downloadInvoiceButtonStyle", v)}
            />
          </div>
        </article>

      </div>

      {/* Invoice Designer sub-nav */}
      <article style={subNavCardStyle}>
        <div style={subNavBodyStyle}>
          <div>
            <strong style={subNavTitleStyle}>Invoice Designer</strong>
            <p style={subNavCopyStyle}>
              Customise the PDF invoice — branding, logo, business info, sections, and editable notes.
            </p>
          </div>
          <Link to="/dashboard/homepage/thank-you-page/invoice-designer" style={subNavLinkStyle}>
            Open Invoice Designer →
          </Link>
        </div>
      </article>

      {/* Live preview */}
      <article style={previewPanelStyle}>
        <div style={panelHeadStyle}>
          <span style={eyebrowStyle}>Preview</span>
          <h4 style={subHeadStyle}>How the page will appear</h4>
        </div>
        <div style={previewCardStyle}>
          <div style={previewIconStyle}>
            {settings.useCustomIcon && iconPreviewUrl
              ? <img src={iconPreviewUrl} alt="Success icon" style={{ width: "52px", height: "52px", objectFit: "contain" }} />
              : <span style={{ fontSize: "28px", color: "#ffffff", fontWeight: 900 }}>✓</span>}
          </div>
          {settings.showThankYouMessage && (
            <>
              <span style={previewEyebrowStyle}>{settings.confirmationLabel || "ORDER CONFIRMED"}</span>
              <strong style={previewTitleStyle}>{settings.successTitle || "Thank you for your order"}</strong>
              <p style={previewSubtitleStyle}>{settings.successSubtitle || "Your order has been placed successfully."}</p>
            </>
          )}
          <div style={previewButtonRowStyle}>
            {settings.showTrackOrderButton && (
              <span style={previewButtonStyle(settings.trackOrderButtonStyle)}>{settings.trackOrderButtonText || "Track Order"}</span>
            )}
            {settings.showContinueShoppingButton && (
              <span style={previewButtonStyle(settings.continueShoppingButtonStyle)}>{settings.continueShoppingButtonText || "Continue Shopping"}</span>
            )}
            {settings.showDownloadInvoiceButton && (
              <span style={previewButtonStyle(settings.downloadInvoiceButtonStyle)}>{settings.downloadInvoiceButtonText || "Download Invoice"}</span>
            )}
          </div>
        </div>
      </article>

    </section>
  );
}

function ButtonRow({ label, hint, enabled, onToggle, text, onTextChange, buttonStyle, onStyleChange }) {
  return (
    <div style={buttonRowWrapStyle}>
      <div style={buttonRowHeaderStyle}>
        <div>
          <span style={labelStyle}>{label}</span>
          <span style={{ ...hintStyle, display: "block", marginTop: "2px" }}>{hint}</span>
        </div>
        <button
          type="button"
          style={toggleButtonStyle(enabled)}
          onClick={onToggle}
        >
          <span style={toggleKnobStyle(enabled)} />
          <span style={toggleLabelTextStyle}>{enabled ? "Show" : "Hide"}</span>
        </button>
      </div>
      {enabled && (
        <div style={buttonRowFieldsStyle}>
          <label style={inlineFieldStyle}>
            <span style={labelStyle}>Button Text</span>
            <input
              type="text"
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={inlineFieldStyle}>
            <span style={labelStyle}>Button Style</span>
            <select value={buttonStyle} onChange={(e) => onStyleChange(e.target.value)} style={inputStyle}>
              {BUTTON_STYLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

function previewButtonStyle(style) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "36px",
    padding: "0 16px",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "default"
  };
  if (style === "secondary") {
    return { ...base, background: "#f1f5f9", color: "#0f172a", border: "1px solid #e2e8f0" };
  }
  if (style === "ghost") {
    return { ...base, background: "transparent", color: "#16a34a", border: "1px solid #16a34a" };
  }
  return { ...base, background: "linear-gradient(135deg, #0f172a 0%, #1f4336 100%)", color: "#ffffff", border: "none" };
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

const toggleLabelTextStyle = {
  fontSize: "13px",
  fontWeight: 700,
  color: "#0f172a"
};

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

const titleStyle = {
  margin: 0,
  fontSize: "32px",
  color: "#0f172a"
};

const copyStyle = {
  margin: 0,
  color: "#526377",
  maxWidth: "760px",
  lineHeight: 1.65
};

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

const backLinkStyle = {
  color: "#475569",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none"
};

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

const savedButtonStyle = {
  ...saveButtonStyle,
  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
};

const errorButtonStyle = {
  ...saveButtonStyle,
  background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)"
};

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

const panelHeadStyle = {
  display: "grid",
  gap: "4px"
};

const panelTitleStyle = {
  margin: 0,
  fontSize: "20px",
  color: "#0f172a"
};

const subHeadStyle = {
  margin: 0,
  fontSize: "16px",
  color: "#0f172a"
};

const panelCopyStyle = {
  margin: 0,
  color: "#64748b",
  fontSize: "13px",
  lineHeight: 1.55
};

const fieldGroupStyle = {
  display: "grid",
  gap: "12px"
};

const fieldRowStyle = {
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #e5edf5",
  background: "#f8fafc",
  display: "grid",
  gap: "10px"
};

const fieldLabelRowStyle = {
  display: "grid",
  gap: "3px"
};

const labelStyle = {
  color: "#0f172a",
  fontSize: "13px",
  fontWeight: 700
};

const hintStyle = {
  color: "#64748b",
  fontSize: "12px"
};

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

const dividerStyle = {
  borderTop: "1px solid #e5edf5"
};

const iconPreviewWrapStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px"
};

const iconPreviewStyle = {
  width: "56px",
  height: "56px",
  objectFit: "contain",
  borderRadius: "12px",
  border: "1px solid #e5edf5",
  background: "#f8fafc",
  padding: "6px"
};

const removeIconButtonStyle = {
  padding: "6px 12px",
  borderRadius: "8px",
  border: "1px solid #fecaca",
  background: "#fff5f5",
  color: "#dc2626",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer"
};

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

const errorTextStyle = {
  color: "#dc2626",
  fontSize: "12px",
  fontWeight: 600
};

const buttonRowWrapStyle = {
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #e5edf5",
  background: "#f8fafc",
  display: "grid",
  gap: "12px"
};

const buttonRowHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "12px"
};

const buttonRowFieldsStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px"
};

const inlineFieldStyle = {
  display: "grid",
  gap: "6px"
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

const previewCardStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "10px",
  padding: "32px 24px",
  borderRadius: "16px",
  background: "linear-gradient(135deg, #ffffff 0%, #f5fbf7 58%, #edf7ff 100%)",
  border: "1px solid rgba(203, 213, 225, 0.7)",
  textAlign: "center"
};

const previewIconStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "64px",
  height: "64px",
  borderRadius: "999px",
  background: "#16a34a",
  flexShrink: 0
};

const previewEyebrowStyle = {
  color: "#16a34a",
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase"
};

const previewTitleStyle = {
  display: "block",
  fontSize: "22px",
  fontWeight: 700,
  color: "#0f172a",
  lineHeight: 1.2
};

const previewSubtitleStyle = {
  margin: 0,
  color: "#64748b",
  fontSize: "14px",
  maxWidth: "400px"
};

const previewButtonRowStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  justifyContent: "center",
  marginTop: "8px"
};

const subNavCardStyle = {
  background: "linear-gradient(135deg, #fff 0%, #f0fdf4 60%, #edf7ff 100%)",
  borderRadius: "18px",
  border: "1px solid rgba(22, 163, 74, 0.2)",
  boxShadow: "0 10px 28px rgba(22, 163, 74, 0.08)",
  padding: "20px 24px"
};

const subNavBodyStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap"
};

const subNavTitleStyle = {
  fontSize: "16px",
  fontWeight: 700,
  color: "#0f172a"
};

const subNavCopyStyle = {
  margin: "4px 0 0",
  color: "#64748b",
  fontSize: "13px",
  lineHeight: 1.5
};

const subNavLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "40px",
  padding: "0 20px",
  borderRadius: "999px",
  background: "linear-gradient(135deg, #0f172a 0%, #1f4336 100%)",
  color: "#fff",
  fontWeight: 700,
  fontSize: "14px",
  textDecoration: "none",
  flexShrink: 0
};
