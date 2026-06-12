import React from "react";
import {
  fetchAdminSettings,
  fetchCategories,
  fetchGeneralSettings,
  fetchPaymentSettings,
  testPaymentConnection,
  updateAdminSettings,
  updateCategoryCod,
  updateGeneralSettings,
  updatePaymentSettings,
  uploadSettingsAsset
} from "../../api/adminApi";
import { resolveAdminMediaUrl, toStoredUploadUrl } from "../../utils/media";
import {
  cloneSettings,
  DEFAULT_APP_SETTINGS,
  getSettingValue,
  mergeSettings,
  SETTINGS_SECTIONS,
  setSettingValue
} from "../../../../shared/appSettings";
import { ManageAccessPanel } from "./ManageAccess";
import { canAccess } from "../../utils/accessControl";

const MANAGE_ACCESS_SECTION = {
  id: "manage-access",
  label: "Manage Access",
  description: "Manage dashboard users, roles, permissions, activity logs, and security rules."
};

const SETTINGS_NAV_SECTIONS = [...SETTINGS_SECTIONS, MANAGE_ACCESS_SECTION];

function formatFieldValue(field, value) {
  if (field.type === "boolean") {
    return value ? "Enabled" : "Disabled";
  }

  if (field.type === "select") {
    return field.options.find((option) => option.value === value)?.label || String(value || "");
  }

  return String(value || "");
}

function renderFieldControl(field, value, onChange) {
  if (field.type === "boolean") {
    return (
      <label style={toggleFieldStyle}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{Boolean(value) ? "Enabled" : "Disabled"}</span>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        value={String(value || "")}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        style={textareaStyle}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select value={String(value || "")} onChange={(event) => onChange(event.target.value)} style={inputStyle}>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={field.type || "text"}
      value={String(value || "")}
      onChange={(event) => onChange(event.target.value)}
      style={inputStyle}
    />
  );
}

const allowedBrandAssetExtensions = new Set(["png", "jpg", "jpeg", "webp", "svg"]);
const logoMaxSizeBytes = 2 * 1024 * 1024;
const faviconMaxSizeBytes = 1 * 1024 * 1024;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+]?[\d\s().-]{7,20}$/;
const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;
const whatsappPhonePattern = /^\+?\d{10,15}$/;
const whatsappIconMaxSizeBytes = 1 * 1024 * 1024;

function getMediaPreviewUrl(value) {
  return resolveAdminMediaUrl(value);
}

function getStoredMediaUrl(value) {
  return toStoredUploadUrl(value);
}

function validateBrandAssetFile(file, maxSizeBytes) {
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase() || "";
  if (!allowedBrandAssetExtensions.has(extension)) {
    return "Upload a PNG, JPG, JPEG, WebP, or SVG image.";
  }
  if (file.size > maxSizeBytes) {
    return `Image is too large. Maximum size is ${Math.round(maxSizeBytes / 1024 / 1024)} MB.`;
  }
  return "";
}

function validateGeneralSettings(general = {}) {
  if (!String(general.storeName || "").trim()) return "Store Name is required.";
  if (!emailPattern.test(String(general.supportEmail || "").trim())) return "Support Email must be a valid email address.";
  const phone = String(general.supportPhone || "").trim();
  if (phone && !phonePattern.test(phone)) return "Support Phone must be a valid phone number.";
  const gstNumber = String(general.gstNumber || "").trim();
  if (gstNumber && !gstPattern.test(gstNumber)) return "GST Number format is invalid.";
  if (String(general.businessAddress || "").length > 500) return "Business Address must be 500 characters or less.";
  if (String(general.workingHours || "").length > 200) return "Working Hours must be 200 characters or less.";
  if (String(general.brandTagline || "").length > 160) return "Brand Tagline must be 160 characters or less.";
  return "";
}

function validateWhatsAppSettings(whatsapp = {}) {
  const number = String(whatsapp.number || "").replace(/[^\d+]/g, "");
  if (whatsapp.enabled && !whatsappPhonePattern.test(number)) return "WhatsApp Number must include country code, for example +919876543210.";
  if (String(whatsapp.defaultMessage || "").trim().length > 300) return "Default WhatsApp Message must be 300 characters or less.";
  if (String(whatsapp.productMessage || "").trim().length > 500) return "Product WhatsApp Message must be 500 characters or less.";
  if (String(whatsapp.orderMessage || "").trim().length > 300) return "Order WhatsApp Message must be 300 characters or less.";
  if (!["bottom-right", "bottom-left"].includes(String(whatsapp.position || ""))) return "Choose a valid WhatsApp Button Position.";
  if (Number(whatsapp.iconSize) < 20 || Number(whatsapp.iconSize) > 44) return "WhatsApp Icon Size must be between 20 and 44.";
  return "";
}

function GeneralSettingsPanel({ settings, isSaving, isLoading, uploadStates, onFieldChange, onSave, onUpload, onClearUploadError }) {
  const general = settings.general || {};

  return (
    <>
      <section style={heroCardStyle}>
        <span style={eyebrowStyle}>General Settings</span>
        <h3 style={{ margin: 0, fontSize: "32px", color: "#0f172a" }}>Store Identity</h3>
        <p style={{ margin: 0, color: "#526377", maxWidth: "760px" }}>
          Manage the identity that appears across the storefront, checkout, footer, and future invoices or emails.
        </p>
      </section>

      <section style={sectionActionBarStyle}>
        <div style={{ display: "grid", gap: "4px" }}>
          <span style={eyebrowStyle}>Active Tab</span>
          <strong style={{ color: "#0f172a", fontSize: "18px" }}>General</strong>
        </div>
        <button type="button" onClick={onSave} disabled={isSaving || isLoading} style={saveButtonStyle}>
          {isSaving ? "Saving General..." : "Save General"}
        </button>
      </section>

      <div style={contentGridStyle}>
        <article style={panelStyle}>
          <div>
            <h4 style={{ margin: 0, color: "#0f172a", fontSize: "20px" }}>Brand Assets</h4>
          </div>
          <div style={{ display: "grid", gap: "14px" }}>
            <label style={settingRowStyle}>
              <span style={settingLabelStyle}>Store Name</span>
              <input value={general.storeName || ""} onChange={(event) => onFieldChange("general.storeName", event.target.value)} style={inputStyle} />
            </label>
            <ImageUploadSetting
              label="Store Logo"
              value={general.logoUrl || ""}
              onChange={(value) => onFieldChange("general.logoUrl", value)}
              onUpload={(file) => onUpload("general.logoUrl", file)}
              onRemove={() => onFieldChange("general.logoUrl", "")}
              uploadState={uploadStates["general.logoUrl"]}
              onClearError={() => onClearUploadError("general.logoUrl")}
              maxSizeBytes={logoMaxSizeBytes}
              helper="PNG, JPG, JPEG, WebP, or SVG. Max 2 MB."
            />
            <ImageUploadSetting
              label="Favicon"
              value={general.faviconUrl || ""}
              onChange={(value) => onFieldChange("general.faviconUrl", value)}
              onUpload={(file) => onUpload("general.faviconUrl", file)}
              onRemove={() => onFieldChange("general.faviconUrl", "")}
              uploadState={uploadStates["general.faviconUrl"]}
              onClearError={() => onClearUploadError("general.faviconUrl")}
              maxSizeBytes={faviconMaxSizeBytes}
              helper="PNG, JPG, JPEG, WebP, or SVG. Max 1 MB."
              compact
            />
            <label style={settingRowStyle}>
              <span style={settingLabelStyle}>Brand Tagline</span>
              <input value={general.brandTagline || ""} onChange={(event) => onFieldChange("general.brandTagline", event.target.value)} style={inputStyle} />
            </label>
          </div>
        </article>

        <article style={panelStyle}>
          <div>
            <h4 style={{ margin: 0, color: "#0f172a", fontSize: "20px" }}>Support & Business Details</h4>
          </div>
          <div style={{ display: "grid", gap: "14px" }}>
            <label style={settingRowStyle}>
              <span style={settingLabelStyle}>Business / Legal Name</span>
              <input value={general.businessLegalName || ""} onChange={(event) => onFieldChange("general.businessLegalName", event.target.value)} style={inputStyle} />
            </label>
            <label style={settingRowStyle}>
              <span style={settingLabelStyle}>Support Email</span>
              <input type="email" value={general.supportEmail || ""} onChange={(event) => onFieldChange("general.supportEmail", event.target.value)} style={inputStyle} />
            </label>
            <label style={settingRowStyle}>
              <span style={settingLabelStyle}>Support Phone</span>
              <input value={general.supportPhone || ""} onChange={(event) => onFieldChange("general.supportPhone", event.target.value)} style={inputStyle} />
            </label>
            <label style={settingRowStyle}>
              <span style={settingLabelStyle}>Business Address</span>
              <textarea value={general.businessAddress || ""} onChange={(event) => onFieldChange("general.businessAddress", event.target.value)} rows={3} style={textareaStyle} />
            </label>
            <label style={settingRowStyle}>
              <span style={settingLabelStyle}>GST Number</span>
              <input value={general.gstNumber || ""} onChange={(event) => onFieldChange("general.gstNumber", event.target.value)} style={inputStyle} />
            </label>
            <label style={settingRowStyle}>
              <span style={settingLabelStyle}>Working Hours</span>
              <textarea value={general.workingHours || ""} onChange={(event) => onFieldChange("general.workingHours", event.target.value)} rows={3} style={textareaStyle} />
            </label>
          </div>
        </article>
      </div>

      <GeneralSettingsPreview general={general} />
    </>
  );
}

function WhatsAppAccessPanel({ whatsapp = {}, isSaving, isLoading, uploadState, onFieldChange, onSave, onUpload, onClearUploadError }) {
  const iconPreviewUrl = getMediaPreviewUrl(whatsapp.iconUrl);

  return (
    <section style={savedDetailsPanelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "grid", gap: "6px" }}>
          <span style={eyebrowStyle}>WhatsApp Access</span>
          <h4 style={{ margin: 0, color: "#0f172a", fontSize: "20px" }}>Floating Support Button</h4>
          <p style={{ margin: 0, color: "#526377", maxWidth: "720px" }}>
            Control the WhatsApp chat button shown on frontend pages. Product and order pages can use smart messages automatically.
          </p>
        </div>
        <button type="button" onClick={onSave} disabled={isSaving || isLoading} style={saveButtonStyle}>
          {isSaving ? "Saving..." : "Save WhatsApp"}
        </button>
      </div>

      <div style={contentGridStyle}>
        <article style={panelStyle}>
          <h4 style={{ margin: 0, color: "#0f172a", fontSize: "18px" }}>Basic Controls</h4>
          <div style={{ display: "grid", gap: "14px" }}>
            <BooleanSetting label="Enable WhatsApp Button" value={whatsapp.enabled} onChange={(value) => onFieldChange("whatsapp.enabled", value)} />
            <label style={settingRowStyle}>
              <span style={settingLabelStyle}>WhatsApp Number</span>
              <input value={whatsapp.number || ""} onChange={(event) => onFieldChange("whatsapp.number", event.target.value)} placeholder="+919876543210" style={inputStyle} />
              <small style={settingValueStyle}>Include country code. Spaces are removed before opening WhatsApp.</small>
            </label>
            <label style={settingRowStyle}>
              <span style={settingLabelStyle}>Default Message</span>
              <textarea value={whatsapp.defaultMessage || ""} onChange={(event) => onFieldChange("whatsapp.defaultMessage", event.target.value)} rows={3} style={textareaStyle} />
            </label>
            <label style={settingRowStyle}>
              <span style={settingLabelStyle}>Button Position</span>
              <select value={whatsapp.position || "bottom-right"} onChange={(event) => onFieldChange("whatsapp.position", event.target.value)} style={inputStyle}>
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
              </select>
            </label>
            <BooleanSetting label="Show on Mobile" value={whatsapp.showMobile} onChange={(value) => onFieldChange("whatsapp.showMobile", value)} />
            <BooleanSetting label="Show on Desktop" value={whatsapp.showDesktop} onChange={(value) => onFieldChange("whatsapp.showDesktop", value)} />
          </div>
        </article>

        <article style={panelStyle}>
          <h4 style={{ margin: 0, color: "#0f172a", fontSize: "18px" }}>Icon Controls</h4>
          <div style={{ display: "grid", gap: "14px" }}>
            <label style={settingRowStyle}>
              <span style={settingLabelStyle}>Default WhatsApp Icon</span>
              <strong style={detailValueStyle}>Enabled when no custom icon is uploaded.</strong>
            </label>
            <ImageUploadSetting
              label="Custom Icon Upload"
              value={whatsapp.iconUrl || ""}
              onChange={(value) => onFieldChange("whatsapp.iconUrl", value)}
              onUpload={(file) => onUpload("whatsapp.iconUrl", file)}
              onRemove={() => onFieldChange("whatsapp.iconUrl", "")}
              uploadState={uploadState}
              onClearError={(error = "") => onClearUploadError("whatsapp.iconUrl", error)}
              maxSizeBytes={whatsappIconMaxSizeBytes}
              helper="PNG, JPG, JPEG, WebP, or SVG. Max 1 MB."
              compact
            />
            {iconPreviewUrl ? <img src={iconPreviewUrl} alt="WhatsApp icon preview" style={faviconPreviewStyle} /> : null}
            <label style={settingRowStyle}>
              <span style={settingLabelStyle}>Icon Size</span>
              <input type="number" min="20" max="44" value={whatsapp.iconSize || 28} onChange={(event) => onFieldChange("whatsapp.iconSize", Number(event.target.value))} style={inputStyle} />
            </label>
            <label style={settingRowStyle}>
              <span style={settingLabelStyle}>Button Color</span>
              <input type="color" value={whatsapp.buttonColor || "#25D366"} onChange={(event) => onFieldChange("whatsapp.buttonColor", event.target.value)} style={{ ...inputStyle, padding: "4px 8px" }} />
            </label>
            <label style={settingRowStyle}>
              <span style={settingLabelStyle}>Hover Text</span>
              <input value={whatsapp.hoverText || ""} onChange={(event) => onFieldChange("whatsapp.hoverText", event.target.value)} style={inputStyle} />
            </label>
          </div>
        </article>

        <article style={panelStyle}>
          <h4 style={{ margin: 0, color: "#0f172a", fontSize: "18px" }}>Page Controls</h4>
          <div style={{ display: "grid", gap: "14px" }}>
            <BooleanSetting label="Show on All Pages" value={whatsapp.showAllPages} onChange={(value) => onFieldChange("whatsapp.showAllPages", value)} />
            <BooleanSetting label="Hide on Checkout" value={whatsapp.hideCheckout} onChange={(value) => onFieldChange("whatsapp.hideCheckout", value)} />
            <BooleanSetting label="Hide on Order Confirmation" value={whatsapp.hideOrderConfirmation} onChange={(value) => onFieldChange("whatsapp.hideOrderConfirmation", value)} />
            <BooleanSetting label="Hide on Admin/Dashboard" value={whatsapp.hideAdmin} onChange={(value) => onFieldChange("whatsapp.hideAdmin", value)} />
          </div>
        </article>

        <article style={panelStyle}>
          <h4 style={{ margin: 0, color: "#0f172a", fontSize: "18px" }}>Smart Messages</h4>
          <div style={{ display: "grid", gap: "14px" }}>
            <label style={settingRowStyle}>
              <span style={settingLabelStyle}>Product Page Message</span>
              <textarea value={whatsapp.productMessage || ""} onChange={(event) => onFieldChange("whatsapp.productMessage", event.target.value)} rows={4} style={textareaStyle} />
              <small style={settingValueStyle}>Supported: {"{{productName}}"} and {"{{productUrl}}"}</small>
            </label>
            <label style={settingRowStyle}>
              <span style={settingLabelStyle}>Order Page Message</span>
              <textarea value={whatsapp.orderMessage || ""} onChange={(event) => onFieldChange("whatsapp.orderMessage", event.target.value)} rows={3} style={textareaStyle} />
              <small style={settingValueStyle}>Supported: {"{{orderId}}"}</small>
            </label>
          </div>
        </article>
      </div>
    </section>
  );
}

function BooleanSetting({ label, value, onChange }) {
  return (
    <label style={settingRowStyle}>
      <span style={settingLabelStyle}>{label}</span>
      {renderFieldControl({ type: "boolean" }, Boolean(value), onChange)}
    </label>
  );
}

function isEnabledSetting(value) {
  if (value === false || value === 0 || String(value).trim().toLowerCase() === "false") return false;
  return value === true || value === 1 || String(value).trim() === "1";
}

const defaultPaymentSettings = {
  provider: "razorpay",
  enabled: false,
  mode: "test",
  testKeyId: "",
  testKeySecret: "",
  testWebhookSecret: "",
  liveKeyId: "",
  liveKeySecret: "",
  liveWebhookSecret: "",
  currency: "INR",
  buttonText: "Pay Now",
  description: "Order Payment",
  codEnabled: true
};

function PaymentSecretField({ label, value, configured, onChange }) {
  return (
    <label style={settingRowStyle}>
      <span style={settingLabelStyle}>{label}</span>
      <input
        type="password"
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="new-password"
        placeholder={configured ? "Stored securely. Enter a new value only to replace it." : "Enter secret"}
        style={inputStyle}
      />
      <small style={settingValueStyle}>
        {configured ? "Encrypted secret is configured." : "Not configured."}
      </small>
    </label>
  );
}

function PaymentSettingsPanel({
  settings,
  isLoading,
  isSaving,
  isTesting,
  categories,
  onChange,
  onCategoryChange,
  onSave,
  onTest
}) {
  const update = (key, value) => onChange({ ...settings, [key]: value });

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <section style={heroCardStyle}>
        <span style={eyebrowStyle}>Main Settings / Payment</span>
        <h3 style={{ margin: 0, fontSize: "32px", color: "#0f172a" }}>Razorpay Payment Settings</h3>
        <p style={{ margin: 0, color: "#526377", maxWidth: "760px" }}>
          Control online payments, test and live credentials, webhook secrets, and checkout display text.
        </p>
      </section>

      <div style={contentGridStyle}>
        <article style={panelStyle}>
          <h4 style={{ margin: 0, color: "#0f172a", fontSize: "20px" }}>General</h4>
          <BooleanSetting label="Enable Online Payment" value={settings.enabled} onChange={(value) => update("enabled", value)} />
          <BooleanSetting label="Enable Cash on Delivery" value={settings.codEnabled} onChange={(value) => update("codEnabled", value)} />
          <label style={settingRowStyle}>
            <span style={settingLabelStyle}>Mode</span>
            <select value={settings.mode || "test"} onChange={(event) => update("mode", event.target.value)} style={inputStyle}>
              <option value="test">Test</option>
              <option value="live">Live</option>
            </select>
          </label>
          <label style={settingRowStyle}>
            <span style={settingLabelStyle}>Currency</span>
            <input value={settings.currency || "INR"} readOnly style={{ ...inputStyle, background: "#f8fafc" }} />
          </label>
        </article>

        <article style={panelStyle}>
          <h4 style={{ margin: 0, color: "#0f172a", fontSize: "20px" }}>COD Allowed Categories</h4>
          <p style={{ margin: 0, color: "#526377" }}>
            Cash on Delivery is available only when every product in the cart belongs to an allowed primary category.
          </p>
          <div style={{ display: "grid", gap: "10px" }}>
            {categories.map((category) => (
              <label key={category.id} style={categoryCodRowStyle}>
                <strong style={{ color: "#0f172a" }}>{category.name}</strong>
                <span style={categoryCodToggleStyle}>
                  <input
                    type="checkbox"
                    checked={isEnabledSetting(category.codEnabled)}
                    onChange={(event) => onCategoryChange(category.id, event.target.checked)}
                  />
                  <span>{isEnabledSetting(category.codEnabled) ? "On" : "Off"}</span>
                </span>
              </label>
            ))}
            {!categories.length ? <span style={settingValueStyle}>No categories are available.</span> : null}
          </div>
        </article>

        <article style={panelStyle}>
          <h4 style={{ margin: 0, color: "#0f172a", fontSize: "20px" }}>Test Razorpay Keys</h4>
          <label style={settingRowStyle}>
            <span style={settingLabelStyle}>Test Key ID</span>
            <input value={settings.testKeyId || ""} onChange={(event) => update("testKeyId", event.target.value)} style={inputStyle} />
          </label>
          <PaymentSecretField label="Test Key Secret" value={settings.testKeySecret} configured={settings.testKeySecretConfigured} onChange={(value) => update("testKeySecret", value)} />
          <PaymentSecretField label="Test Webhook Secret" value={settings.testWebhookSecret} configured={settings.testWebhookSecretConfigured} onChange={(value) => update("testWebhookSecret", value)} />
        </article>

        <article style={panelStyle}>
          <h4 style={{ margin: 0, color: "#0f172a", fontSize: "20px" }}>Live Razorpay Keys</h4>
          <label style={settingRowStyle}>
            <span style={settingLabelStyle}>Live Key ID</span>
            <input value={settings.liveKeyId || ""} onChange={(event) => update("liveKeyId", event.target.value)} style={inputStyle} />
          </label>
          <PaymentSecretField label="Live Key Secret" value={settings.liveKeySecret} configured={settings.liveKeySecretConfigured} onChange={(value) => update("liveKeySecret", value)} />
          <PaymentSecretField label="Live Webhook Secret" value={settings.liveWebhookSecret} configured={settings.liveWebhookSecretConfigured} onChange={(value) => update("liveWebhookSecret", value)} />
        </article>

        <article style={panelStyle}>
          <h4 style={{ margin: 0, color: "#0f172a", fontSize: "20px" }}>Checkout Display</h4>
          <label style={settingRowStyle}>
            <span style={settingLabelStyle}>Payment Button Text</span>
            <input value={settings.buttonText || ""} onChange={(event) => update("buttonText", event.target.value)} style={inputStyle} />
          </label>
          <label style={settingRowStyle}>
            <span style={settingLabelStyle}>Checkout Description</span>
            <textarea value={settings.description || ""} onChange={(event) => update("description", event.target.value)} rows={3} style={textareaStyle} />
          </label>
        </article>
      </div>

      <section style={sectionActionBarStyle}>
        <div style={{ display: "grid", gap: "4px" }}>
          <span style={eyebrowStyle}>Actions</span>
          <strong style={{ color: "#0f172a", fontSize: "18px" }}>
            Secrets remain encrypted and are never returned in plain text.
          </strong>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button type="button" onClick={onTest} disabled={isTesting || isLoading || isSaving} style={secondaryButtonStyle}>
            {isTesting ? "Testing Connection..." : "Test Connection"}
          </button>
          <button type="button" onClick={onSave} disabled={isSaving || isLoading || isTesting} style={saveButtonStyle}>
            {isSaving ? "Saving Payment..." : "Save Payment"}
          </button>
        </div>
      </section>
    </div>
  );
}

function NumberSetting({ label, value, min = 0, max = 1000, step = 1, onChange }) {
  return (
    <label style={settingRowStyle}>
      <span style={settingLabelStyle}>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(event) => onChange(Number(event.target.value))}
        style={inputStyle}
      />
    </label>
  );
}

function ColorSetting({ label, value, onChange }) {
  return (
    <label style={settingRowStyle}>
      <span style={settingLabelStyle}>{label}</span>
      <input type="color" value={value || "#ffffff"} onChange={(event) => onChange(event.target.value)} style={{ ...inputStyle, padding: "4px 8px" }} />
    </label>
  );
}

function TextSetting({ label, value, onChange, placeholder = "" }) {
  return (
    <label style={settingRowStyle}>
      <span style={settingLabelStyle}>{label}</span>
      <input value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={inputStyle} />
    </label>
  );
}

function HeaderControlsPanel({ header = {}, isSaving, isLoading, onFieldChange, onSave }) {
  const field = (key) => `header.${key}`;

  return (
    <section style={savedDetailsPanelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "grid", gap: "6px" }}>
          <span style={eyebrowStyle}>Header Manual Controls</span>
          <h4 style={{ margin: 0, color: "#0f172a", fontSize: "20px" }}>Logo, Search, Account and Cart</h4>
          <p style={{ margin: 0, color: "#526377", maxWidth: "760px" }}>
            Control the storefront header sizing, text, colors, spacing, search icon, account action, wishlist action, and cart styling from one dashboard card.
          </p>
        </div>
        <button type="button" onClick={onSave} disabled={isSaving || isLoading} style={saveButtonStyle}>
          {isSaving ? "Saving Header..." : "Save Header"}
        </button>
      </div>

      <div style={contentGridStyle}>
        <article style={panelStyle}>
          <h4 style={{ margin: 0, color: "#0f172a", fontSize: "18px" }}>Logo and Header Layout</h4>
          <div style={{ display: "grid", gap: "14px" }}>
            <NumberSetting label="Logo Width" value={header.logoWidth} min={60} max={360} onChange={(value) => onFieldChange(field("logoWidth"), value)} />
            <NumberSetting label="Logo Height" value={header.logoHeight} min={18} max={120} onChange={(value) => onFieldChange(field("logoHeight"), value)} />
            <NumberSetting label="Logo Max Width" value={header.logoMaxWidth} min={80} max={420} onChange={(value) => onFieldChange(field("logoMaxWidth"), value)} />
            <NumberSetting label="Brand Text Size" value={header.brandTextSize} min={14} max={48} onChange={(value) => onFieldChange(field("brandTextSize"), value)} />
            <NumberSetting label="Header Top Padding" value={header.headerTopPadding} min={0} max={60} onChange={(value) => onFieldChange(field("headerTopPadding"), value)} />
            <NumberSetting label="Header Bottom Padding" value={header.headerBottomPadding} min={0} max={60} onChange={(value) => onFieldChange(field("headerBottomPadding"), value)} />
            <NumberSetting label="Header Gap" value={header.headerGap} min={0} max={80} onChange={(value) => onFieldChange(field("headerGap"), value)} />
          </div>
        </article>

        <article style={panelStyle}>
          <h4 style={{ margin: 0, color: "#0f172a", fontSize: "18px" }}>Header Colors</h4>
          <div style={{ display: "grid", gap: "14px" }}>
            <ColorSetting label="Header Background" value={header.headerBackground} onChange={(value) => onFieldChange(field("headerBackground"), value)} />
            <ColorSetting label="Header Text Color" value={header.headerTextColor} onChange={(value) => onFieldChange(field("headerTextColor"), value)} />
            <ColorSetting label="Header Border Color" value={header.headerBorderColor} onChange={(value) => onFieldChange(field("headerBorderColor"), value)} />
            <TextSetting label="Header Shadow CSS" value={header.headerShadow} onChange={(value) => onFieldChange(field("headerShadow"), value)} placeholder="0 10px 24px rgba(...)" />
          </div>
        </article>

        <article style={panelStyle}>
          <h4 style={{ margin: 0, color: "#0f172a", fontSize: "18px" }}>Search Bar</h4>
          <div style={{ display: "grid", gap: "14px" }}>
            <TextSetting label="Search Placeholder" value={header.searchPlaceholder} onChange={(value) => onFieldChange(field("searchPlaceholder"), value)} />
            <TextSetting label="Search Icon Text / Symbol" value={header.searchIconText} onChange={(value) => onFieldChange(field("searchIconText"), value)} placeholder="⌕" />
            <NumberSetting label="Search Max Width" value={header.searchMaxWidth} min={220} max={1200} onChange={(value) => onFieldChange(field("searchMaxWidth"), value)} />
            <NumberSetting label="Search Height" value={header.searchHeight} min={32} max={72} onChange={(value) => onFieldChange(field("searchHeight"), value)} />
            <NumberSetting label="Search Border Radius" value={header.searchRadius} min={0} max={999} onChange={(value) => onFieldChange(field("searchRadius"), value)} />
            <NumberSetting label="Search Icon Size" value={header.searchIconSize} min={10} max={32} onChange={(value) => onFieldChange(field("searchIconSize"), value)} />
            <ColorSetting label="Search Background" value={header.searchBackground} onChange={(value) => onFieldChange(field("searchBackground"), value)} />
            <ColorSetting label="Search Text Color" value={header.searchTextColor} onChange={(value) => onFieldChange(field("searchTextColor"), value)} />
            <ColorSetting label="Search Border Color" value={header.searchBorderColor} onChange={(value) => onFieldChange(field("searchBorderColor"), value)} />
            <ColorSetting label="Search Icon Color" value={header.searchIconColor} onChange={(value) => onFieldChange(field("searchIconColor"), value)} />
          </div>
        </article>

        <article style={panelStyle}>
          <h4 style={{ margin: 0, color: "#0f172a", fontSize: "18px" }}>Sign In and Wishlist</h4>
          <div style={{ display: "grid", gap: "14px" }}>
            <TextSetting label="Sign In Text" value={header.accountText} onChange={(value) => onFieldChange(field("accountText"), value)} />
            <BooleanSetting label="Show Sign In Text" value={header.showAccountText} onChange={(value) => onFieldChange(field("showAccountText"), value)} />
            <NumberSetting label="Sign In Icon Size" value={header.accountIconSize} min={12} max={42} onChange={(value) => onFieldChange(field("accountIconSize"), value)} />
            <NumberSetting label="Sign In Button Size" value={header.accountButtonSize} min={28} max={72} onChange={(value) => onFieldChange(field("accountButtonSize"), value)} />
            <NumberSetting label="Sign In Radius" value={header.accountRadius} min={0} max={999} onChange={(value) => onFieldChange(field("accountRadius"), value)} />
            <ColorSetting label="Sign In Color" value={header.accountColor} onChange={(value) => onFieldChange(field("accountColor"), value)} />
            <ColorSetting label="Sign In Background" value={header.accountBackground} onChange={(value) => onFieldChange(field("accountBackground"), value)} />
            <NumberSetting label="Wishlist Icon Size" value={header.wishlistIconSize} min={12} max={42} onChange={(value) => onFieldChange(field("wishlistIconSize"), value)} />
            <NumberSetting label="Wishlist Button Size" value={header.wishlistButtonSize} min={28} max={72} onChange={(value) => onFieldChange(field("wishlistButtonSize"), value)} />
            <ColorSetting label="Wishlist Color" value={header.wishlistColor} onChange={(value) => onFieldChange(field("wishlistColor"), value)} />
            <ColorSetting label="Wishlist Background" value={header.wishlistBackground} onChange={(value) => onFieldChange(field("wishlistBackground"), value)} />
          </div>
        </article>

        <article style={panelStyle}>
          <h4 style={{ margin: 0, color: "#0f172a", fontSize: "18px" }}>Cart Button</h4>
          <div style={{ display: "grid", gap: "14px" }}>
            <TextSetting label="Cart Text" value={header.cartText} onChange={(value) => onFieldChange(field("cartText"), value)} />
            <BooleanSetting label="Show Cart Text" value={header.showCartText} onChange={(value) => onFieldChange(field("showCartText"), value)} />
            <NumberSetting label="Cart Icon Size" value={header.cartIconSize} min={12} max={42} onChange={(value) => onFieldChange(field("cartIconSize"), value)} />
            <NumberSetting label="Cart Button Height" value={header.cartButtonHeight} min={28} max={78} onChange={(value) => onFieldChange(field("cartButtonHeight"), value)} />
            <NumberSetting label="Cart Horizontal Padding" value={header.cartButtonPaddingX} min={4} max={40} onChange={(value) => onFieldChange(field("cartButtonPaddingX"), value)} />
            <NumberSetting label="Cart Radius" value={header.cartRadius} min={0} max={999} onChange={(value) => onFieldChange(field("cartRadius"), value)} />
            <ColorSetting label="Cart Background" value={header.cartBackground} onChange={(value) => onFieldChange(field("cartBackground"), value)} />
            <ColorSetting label="Cart Text Color" value={header.cartTextColor} onChange={(value) => onFieldChange(field("cartTextColor"), value)} />
            <ColorSetting label="Cart Badge Background" value={header.cartBadgeBackground} onChange={(value) => onFieldChange(field("cartBadgeBackground"), value)} />
            <ColorSetting label="Cart Badge Text Color" value={header.cartBadgeTextColor} onChange={(value) => onFieldChange(field("cartBadgeTextColor"), value)} />
            <NumberSetting label="Utility Gap" value={header.utilityGap} min={0} max={48} onChange={(value) => onFieldChange(field("utilityGap"), value)} />
          </div>
        </article>
      </div>
    </section>
  );
}

function GeneralSettingsPreview({ general = {} }) {
  const logoPreviewUrl = getMediaPreviewUrl(general.logoUrl);
  const faviconPreviewUrl = getMediaPreviewUrl(general.faviconUrl);
  const details = [
    ["Store Name", general.storeName],
    ["Brand Tagline", general.brandTagline],
    ["Business / Legal Name", general.businessLegalName],
    ["Support Email", general.supportEmail],
    ["Support Phone", general.supportPhone],
    ["Business Address", general.businessAddress],
    ["GST Number", general.gstNumber],
    ["Working Hours", general.workingHours],
    ["Store Logo URL", general.logoUrl],
    ["Favicon URL", general.faviconUrl]
  ];

  return (
    <section style={savedDetailsPanelStyle}>
      <div style={{ display: "grid", gap: "6px" }}>
        <span style={eyebrowStyle}>Visible Details</span>
        <h4 style={{ margin: 0, color: "#0f172a", fontSize: "20px" }}>Current General Details</h4>
      </div>

      <div style={brandPreviewGridStyle}>
        <div style={brandPreviewTileStyle}>
          <span style={settingLabelStyle}>Store Logo</span>
          {logoPreviewUrl ? (
            <img src={logoPreviewUrl} alt="Current store logo" style={logoPreviewStyle} />
          ) : (
            <strong style={emptyValueStyle}>Not uploaded</strong>
          )}
        </div>
        <div style={brandPreviewTileStyle}>
          <span style={settingLabelStyle}>Favicon</span>
          {faviconPreviewUrl ? (
            <img src={faviconPreviewUrl} alt="Current favicon" style={faviconPreviewStyle} />
          ) : (
            <strong style={emptyValueStyle}>Not uploaded</strong>
          )}
        </div>
      </div>

      <div style={detailsGridStyle}>
        {details.map(([label, value]) => (
          <div key={label} style={detailItemStyle}>
            <span style={settingLabelStyle}>{label}</span>
            <strong style={detailValueStyle}>{String(value || "Not set")}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function ImageUploadSetting({ label, value, onChange, onUpload, onRemove, uploadState, onClearError, maxSizeBytes, helper, compact = false }) {
  const inputRef = React.useRef(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const previewUrl = getMediaPreviewUrl(value);
  const isUploading = uploadState?.status === "uploading";
  const error = uploadState?.error || "";
  const hasSuccess = Boolean(value) && !error && !isUploading;

  const handleFiles = (files) => {
    const file = files?.[0];
    if (!file) return;
    const validationMessage = validateBrandAssetFile(file, maxSizeBytes);
    if (validationMessage) {
      onClearError(validationMessage);
      return;
    }
    onClearError("");
    onUpload(file);
  };

  return (
    <div style={settingRowStyle}>
      <span style={settingLabelStyle}>{label}</span>
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
          ...uploadBoxStyle,
          ...(compact ? compactUploadBoxStyle : null),
          ...(isDragging ? uploadBoxActiveStyle : null)
        }}
      >
        {isUploading ? (
          <span style={uploadCopyStyle}>
            <strong>Uploading...</strong>
            <small>Please wait</small>
          </span>
        ) : previewUrl ? <img src={previewUrl} alt={label} style={compact ? faviconPreviewStyle : logoPreviewStyle} /> : (
          <span style={uploadCopyStyle}>
            <strong>Drag & drop image here</strong>
            <small>or click to upload</small>
          </span>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" onChange={(event) => handleFiles(event.target.files)} style={{ display: "none" }} />
      <div style={assetActionRowStyle}>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={isUploading} style={assetButtonStyle}>
          {value ? "Replace Image" : "Upload Image"}
        </button>
        {value ? (
          <button type="button" onClick={onRemove} disabled={isUploading} style={assetDangerButtonStyle}>
            Remove Image
          </button>
        ) : null}
      </div>
      <input value={value || ""} onChange={(event) => onChange(event.target.value)} style={inputStyle} />
      {hasSuccess ? <small style={fieldSuccessStyle}>Image uploaded successfully.</small> : null}
      {helper ? <small style={settingValueStyle}>{helper}</small> : null}
      {error ? <small style={fieldErrorStyle}>{error}</small> : null}
    </div>
  );
}

export default function Settings({ initialSection = SETTINGS_SECTIONS[0].id }) {
  const canManageAccess = canAccess("sensitive_access", "manage_admin_users");
  const availableSections = React.useMemo(
    () => canManageAccess ? SETTINGS_NAV_SECTIONS : SETTINGS_SECTIONS,
    [canManageAccess]
  );
  const safeInitialSection = canManageAccess || initialSection !== MANAGE_ACCESS_SECTION.id
    ? initialSection
    : SETTINGS_SECTIONS[0].id;
  const [activeSection, setActiveSection] = React.useState(safeInitialSection);
  const [settings, setSettings] = React.useState(() => cloneSettings(DEFAULT_APP_SETTINGS));
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState("");
  const [usingFallback, setUsingFallback] = React.useState(false);
  const [uploadStates, setUploadStates] = React.useState({});
  const [paymentSettings, setPaymentSettings] = React.useState(defaultPaymentSettings);
  const [paymentCategories, setPaymentCategories] = React.useState([]);
  const [isTestingPayment, setIsTestingPayment] = React.useState(false);

  const currentSection = React.useMemo(
    () => availableSections.find((section) => section.id === activeSection) || SETTINGS_SECTIONS[0],
    [activeSection, availableSections]
  );
  const isManageAccessSection = canManageAccess && activeSection === MANAGE_ACCESS_SECTION.id;

  const currentStatusMessage = statusMessage
    ? {
        text: statusMessage,
        style: usingFallback ? feedbackWarningStyle : feedbackSuccessStyle
      }
    : null;

  React.useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      setIsLoading(true);

      try {
        const [settingsResult, generalResult, paymentResult, categoriesResult] = await Promise.allSettled([
          fetchAdminSettings(),
          fetchGeneralSettings(),
          fetchPaymentSettings(),
          fetchCategories()
        ]);
        if (!isMounted) return;
        const settingsData = settingsResult.status === "fulfilled" ? settingsResult.value.data?.data || {} : {};
        const generalData = generalResult.status === "fulfilled" ? generalResult.value.data?.data || {} : {};
        const mergedSettings = mergeSettings(DEFAULT_APP_SETTINGS, settingsData);
        setSettings(mergeSettings(mergedSettings, { general: generalData }));
        if (paymentResult.status === "fulfilled") {
          setPaymentSettings({ ...defaultPaymentSettings, ...(paymentResult.value.data?.data || {}) });
        }
        if (categoriesResult.status === "fulfilled") {
          setPaymentCategories(Array.isArray(categoriesResult.value.data?.data) ? categoriesResult.value.data.data : []);
        }
        setUsingFallback(
          settingsResult.status === "rejected" ||
          generalResult.status === "rejected" ||
          paymentResult.status === "rejected" ||
          categoriesResult.status === "rejected"
        );
        setStatusMessage(
          settingsResult.status === "fulfilled" && generalResult.status === "fulfilled"
            ? "Settings loaded from backend."
            : "General settings loaded. Sign in as admin to load and save all settings."
        );
      } catch (error) {
        if (!isMounted) return;
        setSettings(cloneSettings(DEFAULT_APP_SETTINGS));
        setUsingFallback(true);
        setStatusMessage("Showing local settings preview because backend settings require admin authorization.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleFieldChange = (fieldKey, nextValue) => {
    setSettings((current) => setSettingValue(current, fieldKey, nextValue));
  };

  const setUploadState = (fieldKey, nextState) => {
    setUploadStates((current) => ({
      ...current,
      [fieldKey]: {
        ...(current[fieldKey] || {}),
        ...nextState
      }
    }));
  };

  const handleGeneralUpload = async (fieldKey, file) => {
    setStatusMessage("");
    const validationMessage = validateBrandAssetFile(
      file,
      fieldKey === "whatsapp.iconUrl" ? whatsappIconMaxSizeBytes : fieldKey.endsWith("faviconUrl") ? faviconMaxSizeBytes : logoMaxSizeBytes
    );
    if (validationMessage) {
      setUploadState(fieldKey, { status: "error", error: validationMessage });
      setUsingFallback(true);
      setStatusMessage(validationMessage);
      return;
    }

    try {
      setUploadState(fieldKey, { status: "uploading", error: "" });
      const response = await uploadSettingsAsset(file, fieldKey === "whatsapp.iconUrl" ? "whatsapp-icon" : fieldKey.endsWith("faviconUrl") ? "favicon" : "logo");
      const uploadedUrl = getStoredMediaUrl(response.data?.data?.url || "");
      setSettings((current) => setSettingValue(current, fieldKey, uploadedUrl));
      setUploadState(fieldKey, { status: "success", error: "" });
      setUsingFallback(false);
      setStatusMessage(`${fieldKey === "whatsapp.iconUrl" ? "WhatsApp icon" : fieldKey.endsWith("faviconUrl") ? "Favicon" : "Store logo"} uploaded. Save General to publish it.`);
    } catch (error) {
      setUploadState(fieldKey, { status: "error", error: error.response?.data?.message || "Upload failed." });
      setUsingFallback(true);
      setStatusMessage(error.response?.data?.message || "Image upload failed. Check login and upload permissions.");
    }
  };

  const handleSave = async () => {
    if (activeSection === "payment") {
      setIsSaving(true);
      try {
        const [response] = await Promise.all([
          updatePaymentSettings({ settings: paymentSettings }),
          ...paymentCategories.map((category) => updateCategoryCod(category.id, isEnabledSetting(category.codEnabled)))
        ]);
        setPaymentSettings({ ...defaultPaymentSettings, ...(response.data?.data || paymentSettings) });
        setUsingFallback(false);
        setStatusMessage("Payment settings saved successfully.");
      } catch (error) {
        setUsingFallback(true);
        setStatusMessage(error.response?.data?.message || "Unable to save payment settings.");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (activeSection === "general") {
      const validationMessage = validateGeneralSettings(settings.general || {});
      if (validationMessage) {
        setUsingFallback(true);
        setStatusMessage(validationMessage);
        return;
      }
    }

    if (activeSection === "whatsapp") {
      const whatsappValidationMessage = validateWhatsAppSettings(settings.whatsapp || {});
      if (whatsappValidationMessage) {
        setUsingFallback(true);
        setStatusMessage(whatsappValidationMessage);
        return;
      }
    }

    setIsSaving(true);

    try {
      const response = await updateAdminSettings({ settings });
      setSettings((current) => {
        return mergeSettings(DEFAULT_APP_SETTINGS, response.data?.data || settings);
      });
      setUsingFallback(false);
      setStatusMessage(activeSection === "general" ? "General settings saved successfully." : "Settings saved to backend successfully.");
    } catch (error) {
      setUsingFallback(true);
      setStatusMessage(error.response?.data?.message || "Settings updated locally for preview. Sign in as admin to persist them to backend.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPaymentConnection = async () => {
    setIsTestingPayment(true);
    try {
      const response = await testPaymentConnection();
      setUsingFallback(false);
      setStatusMessage(response.data?.message || "Razorpay connection is working.");
    } catch (error) {
      setUsingFallback(true);
      setStatusMessage(error.response?.data?.message || "Razorpay connection test failed.");
    } finally {
      setIsTestingPayment(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: 0 }}>Settings</h2>
          <p style={{ margin: "8px 0 0", color: "#698096" }}>
            Centralized settings now follow one flow: dashboard update, backend save, frontend fetch, dynamic storefront behavior.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={summaryPillStyle}>{`Modules: ${SETTINGS_NAV_SECTIONS.length}`}</span>
          <span style={summaryPillStyle}>{usingFallback ? "Local Preview Mode" : "Backend Connected"}</span>
        </div>
      </div>

      <section className="settings-page-shell">
        <aside className="settings-page-tabs" aria-label="Settings modules">
          <div style={sidebarHeaderStyle}>
            <span style={eyebrowStyle}>Sidebar</span>
            <strong style={{ color: "#0f172a", fontSize: "18px" }}>Settings</strong>
          </div>
          {availableSections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              style={{
                ...tabButtonStyle,
                ...(activeSection === section.id ? activeTabButtonStyle : null)
              }}
            >
              <strong>{getTabLabel(section.id, section.label)}</strong>
              <span>{section.description}</span>
            </button>
          ))}
        </aside>

        <div className="settings-page-content">
          {isManageAccessSection ? (
            <ManageAccessPanel />
          ) : (
            <>
              <section style={heroCardStyle}>
                <span style={eyebrowStyle}>Admin Settings Module</span>
                <h3 style={{ margin: 0, fontSize: "32px", color: "#0f172a" }}>{currentSection.label}</h3>
                <p style={{ margin: 0, color: "#526377", maxWidth: "760px" }}>{currentSection.description}</p>
              </section>

              {activeSection !== "payment" ? <section style={sectionActionBarStyle}>
                <div style={{ display: "grid", gap: "4px" }}>
                  <span style={eyebrowStyle}>Active Tab</span>
                  <strong style={{ color: "#0f172a", fontSize: "18px" }}>{getTabLabel(currentSection.id, currentSection.label)}</strong>
                </div>
                <button type="button" onClick={handleSave} disabled={isSaving || isLoading} style={saveButtonStyle}>
                  {isSaving ? `Saving ${getTabLabel(currentSection.id, currentSection.label)}...` : `Save ${getTabLabel(currentSection.id, currentSection.label)}`}
                </button>
              </section> : null}

              {currentStatusMessage ? (
                <section style={{ ...feedbackStyle, ...currentStatusMessage.style }}>
                  {currentStatusMessage.text}
                </section>
              ) : null}

              {activeSection === "general" ? (
                <GeneralSettingsPanel
                  settings={settings}
                  isSaving={isSaving}
                  isLoading={isLoading}
                  uploadStates={uploadStates}
                  onFieldChange={handleFieldChange}
                  onSave={handleSave}
                  onUpload={handleGeneralUpload}
                  onClearUploadError={(fieldKey, error = "") => setUploadState(fieldKey, { status: error ? "error" : "", error })}
                />
              ) : activeSection === "payment" ? (
                <PaymentSettingsPanel
                  settings={paymentSettings}
                  isLoading={isLoading}
                  isSaving={isSaving}
                  isTesting={isTestingPayment}
                  categories={paymentCategories}
                  onChange={setPaymentSettings}
                  onCategoryChange={(categoryId, codEnabled) => {
                    setPaymentCategories((current) => current.map((category) =>
                      Number(category.id) === Number(categoryId) ? { ...category, codEnabled } : category
                    ));
                  }}
                  onSave={handleSave}
                  onTest={handleTestPaymentConnection}
                />
              ) : activeSection === "whatsapp" ? (
                <WhatsAppAccessPanel
                  whatsapp={settings.whatsapp || DEFAULT_APP_SETTINGS.whatsapp}
                  isSaving={isSaving}
                  isLoading={isLoading}
                  uploadState={uploadStates["whatsapp.iconUrl"]}
                  onFieldChange={handleFieldChange}
                  onSave={handleSave}
                  onUpload={handleGeneralUpload}
                  onClearUploadError={(fieldKey, error = "") => setUploadState(fieldKey, { status: error ? "error" : "", error })}
                />
              ) : activeSection === "header" ? (
                <HeaderControlsPanel
                  header={settings.header || DEFAULT_APP_SETTINGS.header}
                  isSaving={isSaving}
                  isLoading={isLoading}
                  onFieldChange={handleFieldChange}
                  onSave={handleSave}
                />
              ) : (
                <>
              <section style={impactCardStyle}>
                <div style={{ display: "grid", gap: "8px" }}>
                  <span style={eyebrowStyle}>{currentSection.impact.eyebrow}</span>
                  <h4 style={{ margin: 0, fontSize: "22px", color: "#0f172a" }}>{currentSection.impact.title}</h4>
                  <p style={{ margin: 0, color: "#526377", maxWidth: "760px" }}>{currentSection.impact.description}</p>
                </div>

                <div style={impactGridStyle}>
                  {currentSection.impact.items.map((item) => (
                    <div key={item} style={impactItemStyle}>
                      <span style={impactDotStyle} />
                      <strong style={{ color: "#0f172a" }}>{item}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <div style={contentGridStyle}>
                {currentSection.groups.map((group) => (
                  <article key={group.title} style={panelStyle}>
                    <div>
                      <h4 style={{ margin: 0, color: "#0f172a", fontSize: "20px" }}>{group.title}</h4>
                    </div>
                    <div style={{ display: "grid", gap: "14px" }}>
                      {group.fields.map((field) => {
                        const value = getSettingValue(settings, field.key);

                        return (
                          <label key={field.key} style={settingRowStyle}>
                            <span style={settingLabelStyle}>{field.label}</span>
                            {renderFieldControl(field, value, (nextValue) => handleFieldChange(field.key, nextValue))}
                            <small style={settingValueStyle}>{formatFieldValue(field, value)}</small>
                          </label>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function getTabLabel(sectionId, fallbackLabel) {
  if (sectionId === "general") return "General";
  if (sectionId === "store") return "Store";
  if (sectionId === "payment") return "Payment";
  if (sectionId === "shipping") return "Shipping";
  if (sectionId === "tracking") return "Orders & Tracking";
  if (sectionId === "notifications") return "Notifications";
  if (sectionId === "security") return "Security";
  return fallbackLabel;
}

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap"
};

const feedbackStyle = {
  borderRadius: "16px",
  padding: "14px 16px",
  border: "1px solid transparent",
  fontWeight: 600
};

const secondaryButtonStyle = {
  minHeight: "42px",
  padding: "0 16px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 800,
  cursor: "pointer"
};

const feedbackSuccessStyle = {
  background: "#f0fdf4",
  color: "#166534",
  borderColor: "#bbf7d0"
};

const feedbackWarningStyle = {
  background: "#fff7ed",
  color: "#c2410c",
  borderColor: "#fdba74"
};

const sidebarHeaderStyle = {
  display: "grid",
  gap: "4px",
  padding: "8px 4px 2px"
};

const sectionActionBarStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "nowrap",
  padding: "16px 18px",
  borderRadius: "18px",
  background: "#ffffff",
  border: "1px solid rgba(203, 213, 225, 0.75)",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)"
};

const heroCardStyle = {
  background: "linear-gradient(135deg, #ffffff 0%, #f4fbf6 55%, #edf7ff 100%)",
  borderRadius: "20px",
  border: "1px solid rgba(203, 213, 225, 0.7)",
  boxShadow: "0 14px 34px rgba(174, 203, 190, 0.18)",
  padding: "22px",
  display: "grid",
  gap: "10px"
};

const impactCardStyle = {
  background: "linear-gradient(135deg, #f8fffb 0%, #f8fafc 100%)",
  borderRadius: "18px",
  border: "1px solid rgba(203, 213, 225, 0.8)",
  boxShadow: "0 14px 34px rgba(174, 203, 190, 0.12)",
  padding: "20px",
  display: "grid",
  gap: "18px"
};

const impactGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "12px"
};

const impactItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "14px",
  borderRadius: "14px",
  background: "#ffffff",
  border: "1px solid #e5edf5"
};

const impactDotStyle = {
  width: "10px",
  height: "10px",
  borderRadius: "999px",
  background: "#16a34a",
  boxShadow: "0 0 0 6px rgba(34, 197, 94, 0.12)"
};

const contentGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "20px"
};

const panelStyle = {
  background: "#fff",
  borderRadius: "18px",
  border: "1px solid rgba(203, 213, 225, 0.7)",
  boxShadow: "0 14px 34px rgba(174, 203, 190, 0.18)",
  padding: "18px",
  display: "grid",
  gap: "16px"
};

const tabButtonStyle = {
  width: "100%",
  textAlign: "left",
  border: "1px solid rgba(203, 213, 225, 0.75)",
  borderRadius: "18px",
  background: "#ffffff",
  padding: "16px",
  display: "grid",
  gap: "6px",
  color: "#334155",
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)"
};

const activeTabButtonStyle = {
  background: "linear-gradient(135deg, #0f172a 0%, #1f4336 100%)",
  color: "#ffffff",
  border: "1px solid rgba(15, 23, 42, 0.12)",
  boxShadow: "0 18px 32px rgba(15, 23, 42, 0.18)"
};

const settingRowStyle = {
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #e5edf5",
  background: "#f8fafc",
  display: "grid",
  gap: "8px"
};

const inputStyle = {
  width: "100%",
  minHeight: "44px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  padding: "0 14px",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "14px"
};

const textareaStyle = {
  ...inputStyle,
  padding: "12px 14px",
  minHeight: "88px",
  resize: "vertical"
};

const toggleFieldStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  color: "#0f172a",
  fontWeight: 600
};

const categoryCodRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  minHeight: "48px",
  padding: "10px 12px",
  border: "1px solid #dbe5ee",
  borderRadius: "12px",
  background: "#f8fafc"
};

const categoryCodToggleStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
  minWidth: "58px",
  color: "#334155",
  fontWeight: 700
};

const settingLabelStyle = {
  color: "#64748b",
  fontSize: "13px",
  fontWeight: 600
};

const settingValueStyle = {
  color: "#0f172a",
  fontSize: "13px"
};

const uploadBoxStyle = {
  width: "100%",
  minHeight: "132px",
  border: "1px dashed #94a3b8",
  borderRadius: "14px",
  background: "#ffffff",
  display: "grid",
  placeItems: "center",
  padding: "14px",
  cursor: "pointer"
};

const compactUploadBoxStyle = {
  minHeight: "96px"
};

const uploadBoxActiveStyle = {
  borderColor: "#0f766e",
  background: "#f0fdfa"
};

const uploadCopyStyle = {
  display: "grid",
  gap: "4px",
  textAlign: "center",
  color: "#475569"
};

const logoPreviewStyle = {
  maxWidth: "220px",
  maxHeight: "82px",
  objectFit: "contain"
};

const faviconPreviewStyle = {
  width: "48px",
  height: "48px",
  objectFit: "contain"
};

const assetActionRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px"
};

const assetButtonStyle = {
  minHeight: "34px",
  padding: "0 12px",
  borderRadius: "999px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 700,
  cursor: "pointer"
};

const assetDangerButtonStyle = {
  ...assetButtonStyle,
  borderColor: "#fecaca",
  color: "#991b1b",
  background: "#fff7f7"
};

const fieldErrorStyle = {
  color: "#b91c1c",
  fontSize: "13px",
  fontWeight: 700
};

const fieldSuccessStyle = {
  color: "#047857",
  fontSize: "13px",
  fontWeight: 700
};

const savedDetailsPanelStyle = {
  ...panelStyle,
  gap: "18px"
};

const brandPreviewGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "14px"
};

const brandPreviewTileStyle = {
  minHeight: "118px",
  borderRadius: "14px",
  border: "1px solid #e5edf5",
  background: "#f8fafc",
  display: "grid",
  alignContent: "center",
  justifyItems: "center",
  gap: "10px",
  padding: "14px"
};

const detailsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px"
};

const detailItemStyle = {
  display: "grid",
  gap: "6px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #e5edf5",
  background: "#ffffff",
  minWidth: 0
};

const detailValueStyle = {
  color: "#0f172a",
  fontSize: "14px",
  lineHeight: 1.45,
  overflowWrap: "anywhere",
  whiteSpace: "pre-wrap"
};

const emptyValueStyle = {
  color: "#94a3b8",
  fontSize: "13px"
};

const summaryPillStyle = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "34px",
  padding: "0 12px",
  borderRadius: "999px",
  background: "#ffffff",
  border: "1px solid #edf2f7",
  color: "#475569",
  fontWeight: 700,
  fontSize: "12px",
  boxShadow: "0 6px 16px rgba(15, 23, 42, 0.04)"
};

const saveButtonStyle = {
  minHeight: "40px",
  padding: "0 16px",
  borderRadius: "999px",
  border: "1px solid rgba(15, 23, 42, 0.1)",
  background: "linear-gradient(135deg, #0f172a 0%, #1f4336 100%)",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer"
};

const eyebrowStyle = {
  color: "#0f766e",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase"
};
