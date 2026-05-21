import React from "react";
import { fetchAdminSettings, fetchGeneralSettings, updateAdminSettings, updateGeneralSettings, uploadSettingsAsset } from "../../api/adminApi";
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
  const [activeSection, setActiveSection] = React.useState(initialSection);
  const [settings, setSettings] = React.useState(() => cloneSettings(DEFAULT_APP_SETTINGS));
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState("");
  const [usingFallback, setUsingFallback] = React.useState(false);
  const [uploadStates, setUploadStates] = React.useState({});

  const currentSection = React.useMemo(
    () => SETTINGS_NAV_SECTIONS.find((section) => section.id === activeSection) || SETTINGS_SECTIONS[0],
    [activeSection]
  );
  const isManageAccessSection = activeSection === MANAGE_ACCESS_SECTION.id;

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
        const [settingsResult, generalResult] = await Promise.allSettled([
          fetchAdminSettings(),
          fetchGeneralSettings()
        ]);
        if (!isMounted) return;
        const settingsData = settingsResult.status === "fulfilled" ? settingsResult.value.data?.data || {} : {};
        const generalData = generalResult.status === "fulfilled" ? generalResult.value.data?.data || {} : {};
        const mergedSettings = mergeSettings(DEFAULT_APP_SETTINGS, settingsData);
        setSettings(mergeSettings(mergedSettings, { general: generalData }));
        setUsingFallback(settingsResult.status === "rejected" || generalResult.status === "rejected");
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
    const validationMessage = validateBrandAssetFile(file, fieldKey.endsWith("faviconUrl") ? faviconMaxSizeBytes : logoMaxSizeBytes);
    if (validationMessage) {
      setUploadState(fieldKey, { status: "error", error: validationMessage });
      setUsingFallback(true);
      setStatusMessage(validationMessage);
      return;
    }

    try {
      setUploadState(fieldKey, { status: "uploading", error: "" });
      const response = await uploadSettingsAsset(file, fieldKey.endsWith("faviconUrl") ? "favicon" : "logo");
      const uploadedUrl = getStoredMediaUrl(response.data?.data?.url || "");
      setSettings((current) => setSettingValue(current, fieldKey, uploadedUrl));
      setUploadState(fieldKey, { status: "success", error: "" });
      setUsingFallback(false);
      setStatusMessage(`${fieldKey.endsWith("faviconUrl") ? "Favicon" : "Store logo"} uploaded. Save General to publish it.`);
    } catch (error) {
      setUploadState(fieldKey, { status: "error", error: error.response?.data?.message || "Upload failed." });
      setUsingFallback(true);
      setStatusMessage(error.response?.data?.message || "Image upload failed. Check login and upload permissions.");
    }
  };

  const handleSave = async () => {
    if (activeSection === "general") {
      const validationMessage = validateGeneralSettings(settings.general || {});
      if (validationMessage) {
        setUsingFallback(true);
        setStatusMessage(validationMessage);
        return;
      }
    }

    setIsSaving(true);

    try {
      const response = activeSection === "general"
        ? await updateGeneralSettings(settings.general || {})
        : await updateAdminSettings({ settings });
      setSettings((current) => {
        if (activeSection === "general") {
          return mergeSettings(current, { general: response.data?.data || current.general || {} });
        }
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

      <section style={settingsShellStyle}>
        <aside style={settingsTabsStyle} aria-label="Settings modules">
          <div style={sidebarHeaderStyle}>
            <span style={eyebrowStyle}>Sidebar</span>
            <strong style={{ color: "#0f172a", fontSize: "18px" }}>Settings</strong>
          </div>
          {SETTINGS_NAV_SECTIONS.map((section) => (
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

        <div style={settingsContentStyle}>
          {isManageAccessSection ? (
            <ManageAccessPanel />
          ) : (
            <>
              <section style={heroCardStyle}>
                <span style={eyebrowStyle}>Admin Settings Module</span>
                <h3 style={{ margin: 0, fontSize: "32px", color: "#0f172a" }}>{currentSection.label}</h3>
                <p style={{ margin: 0, color: "#526377", maxWidth: "760px" }}>{currentSection.description}</p>
              </section>

              <section style={sectionActionBarStyle}>
                <div style={{ display: "grid", gap: "4px" }}>
                  <span style={eyebrowStyle}>Active Tab</span>
                  <strong style={{ color: "#0f172a", fontSize: "18px" }}>{getTabLabel(currentSection.id, currentSection.label)}</strong>
                </div>
                <button type="button" onClick={handleSave} disabled={isSaving || isLoading} style={saveButtonStyle}>
                  {isSaving ? `Saving ${getTabLabel(currentSection.id, currentSection.label)}...` : `Save ${getTabLabel(currentSection.id, currentSection.label)}`}
                </button>
              </section>

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
  if (sectionId === "payment") return "Payments";
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

const settingsShellStyle = {
  display: "grid",
  gridTemplateColumns: "300px minmax(0, 1fr)",
  gap: "20px",
  alignItems: "start"
};

const settingsTabsStyle = {
  display: "grid",
  gap: "12px"
};

const sidebarHeaderStyle = {
  display: "grid",
  gap: "4px",
  padding: "8px 4px 2px"
};

const settingsContentStyle = {
  display: "grid",
  gap: "20px"
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
