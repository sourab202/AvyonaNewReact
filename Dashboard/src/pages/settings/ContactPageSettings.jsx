import React from "react";
import {
  FaBolt,
  FaBriefcase,
  FaClock,
  FaEnvelope,
  FaHeadset,
  FaHeart,
  FaLeaf,
  FaLock,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaShieldAlt
} from "react-icons/fa";
import {
  fetchContactPageSettings,
  fetchGeneralSettings,
  updateContactPageSettings,
  updateGeneralSettings,
  uploadSettingsAsset
} from "../../api/adminApi";
import { resolveAdminMediaUrl } from "../../utils/media";
import { DEFAULT_APP_SETTINGS, mergeSettings } from "../../../../shared/appSettings";

const DEFAULTS = DEFAULT_APP_SETTINGS.contactPage;
const ICONS = {
  leaf: FaLeaf,
  headset: FaHeadset,
  briefcase: FaBriefcase,
  envelope: FaEnvelope,
  phone: FaPhoneAlt,
  clock: FaClock,
  location: FaMapMarkerAlt,
  lock: FaLock,
  shield: FaShieldAlt,
  bolt: FaBolt,
  heart: FaHeart
};
const ICON_OPTIONS = Object.keys(ICONS);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function TextField({ label, value, onChange, textarea = false, type = "text" }) {
  const Control = textarea ? "textarea" : "input";
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <Control type={textarea ? undefined : type} rows={textarea ? 3 : undefined} value={value || ""} onChange={(event) => onChange(event.target.value)} style={textarea ? textareaStyle : inputStyle} />
    </label>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <label style={toggleStyle}>
      <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
      <strong>{value ? "Enabled" : "Disabled"}</strong>
    </label>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={colorRowStyle}>
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} style={colorStyle} />
        <input value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle} />
      </span>
    </label>
  );
}

function NumberField({ label, value, min, max, onChange }) {
  return <TextField label={`${label} (${min}-${max})`} type="number" value={value} onChange={(next) => onChange(Number(next))} />;
}

function Panel({ eyebrow, title, copy, children }) {
  return (
    <section style={panelStyle}>
      <div style={panelHeadStyle}>
        <span style={eyebrowStyle}>{eyebrow}</span>
        <h3 style={panelTitleStyle}>{title}</h3>
        {copy ? <p style={copyStyle}>{copy}</p> : null}
      </div>
      {children}
    </section>
  );
}

function IconPreview({ builtin, imageUrl, size = 48, color = "#15803d", background = "transparent" }) {
  const Icon = ICONS[builtin] || FaShieldAlt;
  return (
    <span style={{ ...iconPreviewStyle, width: `${Math.min(size, 90)}px`, height: `${Math.min(size, 90)}px`, color, background }}>
      {imageUrl
        ? <img src={resolveAdminMediaUrl(imageUrl)} alt="" style={iconImageStyle} />
        : <Icon style={{ width: "72%", height: "72%" }} />}
    </span>
  );
}

function IconEditor({ title, value, isUploading, onChange, onUpload, minSize = 20, maxSize = 100 }) {
  const inputId = `contact-icon-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <article style={subPanelStyle}>
      <div style={iconEditorHeadStyle}>
        <IconPreview builtin={value.builtin} imageUrl={value.imageUrl || value.iconUrl} size={value.size || value.iconSize} color={value.color || value.iconColor} background={value.iconBackground} />
        <Toggle label={`${title} visible`} value={value.enabled ?? value.showIcon} onChange={(next) => onChange("enabled", next)} />
      </div>
      <label style={fieldStyle}>
        <span style={labelStyle}>Built-in Icon</span>
        <select value={value.builtin || value.iconBuiltin} onChange={(event) => onChange("builtin", event.target.value)} style={inputStyle}>
          {ICON_OPTIONS.map((icon) => <option key={icon} value={icon}>{icon.charAt(0).toUpperCase() + icon.slice(1)}</option>)}
        </select>
      </label>
      <div style={iconUploadRowStyle}>
        <label htmlFor={inputId} style={isUploading ? disabledButtonStyle : secondaryButtonStyle}>
          {isUploading ? "Uploading..." : value.imageUrl || value.iconUrl ? "Replace Image" : "Upload Image"}
        </label>
        {value.imageUrl || value.iconUrl ? <button type="button" onClick={() => onChange("imageUrl", "")} style={dangerButtonStyle}>Use Built-in</button> : null}
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={isUploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            event.target.value = "";
          }}
          style={{ display: "none" }}
        />
      </div>
      <small style={hintStyle}>PNG, JPG, or WebP. Maximum 2 MB. Uploaded image overrides the built-in icon.</small>
      <NumberField label="Icon Size" value={value.size || value.iconSize} min={minSize} max={maxSize} onChange={(next) => onChange("size", next)} />
      <ColorField label="Icon Color" value={value.color || value.iconColor} onChange={(next) => onChange("color", next)} />
      {Object.prototype.hasOwnProperty.call(value, "iconBackground")
        ? <ColorField label="Icon Circle Background" value={value.iconBackground} onChange={(next) => onChange("iconBackground", next)} />
        : null}
    </article>
  );
}

export default function ContactPageSettings() {
  const [settings, setSettings] = React.useState(() => clone(DEFAULTS));
  const [general, setGeneral] = React.useState(() => clone(DEFAULT_APP_SETTINGS.general));
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [uploadingIcon, setUploadingIcon] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [tone, setTone] = React.useState("success");

  React.useEffect(() => {
    let mounted = true;
    Promise.all([fetchContactPageSettings(), fetchGeneralSettings()])
      .then(([contactResponse, generalResponse]) => {
        if (!mounted) return;
        setSettings(mergeSettings(DEFAULTS, contactResponse.data?.data || {}));
        setGeneral(mergeSettings(DEFAULT_APP_SETTINGS.general, generalResponse.data?.data || {}));
      })
      .catch((error) => {
        if (!mounted) return;
        setMessage(error.response?.data?.message || "Unable to load Contact Page settings.");
        setTone("warning");
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const update = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setMessage("");
  };

  const updateNested = (group, key, value) => {
    setSettings((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));
    setMessage("");
  };

  const updateGeneral = (key, value) => {
    setGeneral((current) => ({ ...current, [key]: value }));
    setMessage("");
  };

  const updateEnquiry = (key, field, value) => {
    setSettings((current) => ({
      ...current,
      enquiryTypes: current.enquiryTypes.map((item) => item.key === key ? { ...item, [field]: value } : item)
    }));
    setMessage("");
  };

  const updateHeroIcon = (side, field, value) => {
    setSettings((current) => ({
      ...current,
      heroIcons: {
        ...current.heroIcons,
        [side]: { ...current.heroIcons[side], [field]: value }
      }
    }));
    setMessage("");
  };

  const updateDetailIcon = (key, field, value) => {
    setSettings((current) => ({
      ...current,
      details: {
        ...current.details,
        icons: {
          ...current.details.icons,
          [key]: { ...current.details.icons[key], [field]: value }
        }
      }
    }));
    setMessage("");
  };

  const uploadIcon = async (target, file) => {
    if (file.size > 2 * 1024 * 1024) {
      setMessage("Icon image must be 2 MB or less.");
      setTone("warning");
      return;
    }
    setUploadingIcon(target);
    try {
      const response = await uploadSettingsAsset(file, "contact-page-icon");
      const imageUrl = response.data?.data?.url || response.data?.url || "";
      if (target.startsWith("hero-")) {
        updateHeroIcon(target.replace("hero-", ""), "imageUrl", imageUrl);
      } else if (target.startsWith("detail-")) {
        updateDetailIcon(target.replace("detail-", ""), "imageUrl", imageUrl);
      } else if (target.startsWith("trust-")) {
        updateTrust(target.replace("trust-", ""), "iconUrl", imageUrl);
      } else {
        updateEnquiry(target.replace("enquiry-", ""), "iconUrl", imageUrl);
      }
      setMessage("Icon uploaded. Save & Publish to show it on the frontend.");
      setTone("success");
    } catch (error) {
      setMessage(error.response?.data?.message || "Icon upload failed.");
      setTone("warning");
    } finally {
      setUploadingIcon("");
    }
  };

  const updateTrust = (key, field, value) => {
    setSettings((current) => ({
      ...current,
      trustItems: current.trustItems.map((item) => item.key === key ? { ...item, [field]: value } : item)
    }));
    setMessage("");
  };

  const save = async () => {
    if (settings.customCss && !/\.contact-page[\s.#:[,{>+~]/i.test(`${settings.customCss} `)) {
      setMessage("Custom CSS must be scoped under .contact-page.");
      setTone("warning");
      return;
    }
    setIsSaving(true);
    try {
      const response = await updateContactPageSettings({ settings });
      const generalResponse = await updateGeneralSettings({ settings: general });
      setSettings(mergeSettings(DEFAULTS, response.data?.data || settings));
      setGeneral(mergeSettings(DEFAULT_APP_SETTINGS.general, generalResponse.data?.data || general));
      window.localStorage.setItem("avyonaContactPageUpdatedAt", String(Date.now()));
      setMessage("Contact Page settings saved and published.");
      setTone("success");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to save Contact Page settings.");
      setTone("warning");
    } finally {
      setIsSaving(false);
    }
  };

  const activeEnquiries = settings.enquiryTypes.filter((item) => item.enabled);
  const activeTrustItems = settings.trustItems.filter((item) => item.enabled);
  const design = settings.design;
  const previewStyle = {
    "--contact-accent": design.customerAccent,
    "--contact-accent-dark": design.customerAccentDark,
    "--contact-accent-soft": design.customerAccentSoft,
    "--contact-surface": design.surfaceColor,
    "--contact-text": design.textColor,
    "--contact-muted": design.mutedTextColor,
    "--contact-border": design.borderColor,
    "--contact-radius": `${design.cardRadius}px`,
    "--contact-input-radius": `${design.inputRadius}px`,
    background: design.pageBackground
  };

  return (
    <section className="dashboard-page-shell" style={pageStyle}>
      <div style={heroStyle}>
        <div>
          <span style={eyebrowStyle}>Settings / Contact Page</span>
          <h2 style={titleStyle}>Contact Page Manager</h2>
          <p style={copyStyle}>Manually control every visible message, enquiry option, form label, contact card, trust item, color, size, layout, and custom CSS.</p>
        </div>
        <div style={actionStyle}>
          <Toggle label="Frontend page" value={settings.enabled} onChange={(value) => update("enabled", value)} />
          <button type="button" onClick={() => setSettings(clone(DEFAULTS))} disabled={isSaving} style={secondaryButtonStyle}>Reset Defaults</button>
          <button type="button" onClick={save} disabled={isSaving || isLoading || Boolean(uploadingIcon)} style={saveButtonStyle}>{isSaving ? "Saving..." : "Save & Publish"}</button>
        </div>
      </div>

      {message ? <div style={{ ...messageStyle, ...(tone === "warning" ? warningStyle : successStyle) }}>{message}</div> : null}

      <div style={layoutStyle}>
        <div style={editorStyle}>
          <Panel eyebrow="Hero Content" title="Page heading and introduction">
            <div style={gridStyle}>
              <TextField label="Hero Title" value={settings.heroTitle} onChange={(value) => update("heroTitle", value)} />
              <TextField label="Section Heading" value={settings.sectionTitle} onChange={(value) => update("sectionTitle", value)} />
              <TextField label="Hero Line 1" value={settings.heroLineOne} onChange={(value) => update("heroLineOne", value)} textarea />
              <TextField label="Hero Line 2" value={settings.heroLineTwo} onChange={(value) => update("heroLineTwo", value)} textarea />
            </div>
          </Panel>

          <Panel eyebrow="Visual Icons" title="Hero and enquiry-card icons" copy="Change built-in icons or upload your own image for every visual shown in the highlighted section.">
            <div style={cardGridStyle}>
              {["left", "right"].map((side) => (
                <IconEditor
                  key={side}
                  title={`${side === "left" ? "Left" : "Right"} Hero Icon`}
                  value={settings.heroIcons[side]}
                  minSize={32}
                  maxSize={240}
                  isUploading={uploadingIcon === `hero-${side}`}
                  onChange={(field, value) => updateHeroIcon(side, field, value)}
                  onUpload={(file) => uploadIcon(`hero-${side}`, file)}
                />
              ))}
              {settings.enquiryTypes.map((item) => (
                <IconEditor
                  key={`icon-${item.key}`}
                  title={`${item.title} Card Icon`}
                  value={{
                    builtin: item.iconBuiltin,
                    iconUrl: item.iconUrl,
                    iconSize: item.iconSize,
                    iconColor: item.iconColor,
                    iconBackground: item.iconBackground,
                    showIcon: item.showIcon
                  }}
                  isUploading={uploadingIcon === `enquiry-${item.key}`}
                  maxSize={100}
                  onChange={(field, value) => {
                    const fieldMap = { enabled: "showIcon", builtin: "iconBuiltin", imageUrl: "iconUrl", size: "iconSize", color: "iconColor" };
                    updateEnquiry(item.key, fieldMap[field] || field, value);
                  }}
                  onUpload={(file) => uploadIcon(`enquiry-${item.key}`, file)}
                />
              ))}
            </div>
          </Panel>

          <Panel eyebrow="Enquiry Types" title="Customer and business cards" copy="Each card can be renamed, rewritten, or hidden independently.">
            <div style={cardGridStyle}>
              {settings.enquiryTypes.map((item) => (
                <article key={item.key} style={subPanelStyle}>
                  <Toggle label={`${item.key.toUpperCase()} enquiry`} value={item.enabled} onChange={(value) => updateEnquiry(item.key, "enabled", value)} />
                  <TextField label="Short Label" value={item.label} onChange={(value) => updateEnquiry(item.key, "label", value)} />
                  <TextField label="Card / Form Title" value={item.title} onChange={(value) => updateEnquiry(item.key, "title", value)} />
                  <TextField label="Description" value={item.description} onChange={(value) => updateEnquiry(item.key, "description", value)} textarea />
                  <TextField label="Button Text" value={item.buttonText} onChange={(value) => updateEnquiry(item.key, "buttonText", value)} />
                </article>
              ))}
            </div>
          </Panel>

          <Panel eyebrow="Form Content" title="Form labels, buttons, and feedback">
            <div style={gridStyle}>
              <TextField label="Form Introduction" value={settings.formIntro} onChange={(value) => update("formIntro", value)} textarea />
              <TextField label="Full Name Placeholder" value={settings.fullNamePlaceholder} onChange={(value) => update("fullNamePlaceholder", value)} />
              <TextField label="Company Name Placeholder" value={settings.companyNamePlaceholder} onChange={(value) => update("companyNamePlaceholder", value)} />
              <TextField label="Email Placeholder" value={settings.emailPlaceholder} onChange={(value) => update("emailPlaceholder", value)} />
              <TextField label="Phone Placeholder" value={settings.phonePlaceholder} onChange={(value) => update("phonePlaceholder", value)} />
              <TextField label="Order ID Placeholder" value={settings.orderIdPlaceholder} onChange={(value) => update("orderIdPlaceholder", value)} />
              <TextField label="Message Placeholder" value={settings.messagePlaceholder} onChange={(value) => update("messagePlaceholder", value)} />
              <TextField label="Submit Button" value={settings.submitButtonText} onChange={(value) => update("submitButtonText", value)} />
              <TextField label="Submitting Button" value={settings.submittingButtonText} onChange={(value) => update("submittingButtonText", value)} />
              <TextField label="Success Message" value={settings.successMessage} onChange={(value) => update("successMessage", value)} textarea />
              <TextField label="Fallback Error Message" value={settings.errorMessage} onChange={(value) => update("errorMessage", value)} textarea />
            </div>
          </Panel>

          <Panel eyebrow="Contact Details" title="Values, labels, and visibility" copy="These shared support values also update Settings → Main and every other storefront area that uses them.">
            <div style={gridStyle}>
              <TextField label="Support Email" type="email" value={general.supportEmail} onChange={(value) => updateGeneral("supportEmail", value)} />
              <TextField label="Support Phone" value={general.supportPhone} onChange={(value) => updateGeneral("supportPhone", value)} />
              <TextField label="Working Hours" value={general.workingHours} onChange={(value) => updateGeneral("workingHours", value)} textarea />
              <TextField label="Business Address" value={general.businessAddress} onChange={(value) => updateGeneral("businessAddress", value)} textarea />
            </div>
            <div style={cardGridStyle}>
              {[
                ["Email", "emailLabel", "showEmail"],
                ["Phone", "phoneLabel", "showPhone"],
                ["Working Hours", "hoursLabel", "showHours"],
                ["Address", "addressLabel", "showAddress"]
              ].map(([name, labelKey, showKey]) => (
                <article key={showKey} style={subPanelStyle}>
                  <Toggle label={`Show ${name}`} value={settings.details[showKey]} onChange={(value) => updateNested("details", showKey, value)} />
                  <TextField label={`${name} Label`} value={settings.details[labelKey]} onChange={(value) => updateNested("details", labelKey, value)} />
                  {showKey === "showPhone" ? <TextField label="No Phone Message" value={settings.details.emptyPhoneText} onChange={(value) => updateNested("details", "emptyPhoneText", value)} /> : null}
                </article>
              ))}
            </div>
            <div style={sectionDividerStyle}>
              <span style={eyebrowStyle}>Contact Detail Icons</span>
              <strong style={sectionSubtitleStyle}>Email, phone, working hours, and address icons</strong>
            </div>
            <div style={cardGridStyle}>
              {[
                ["email", "Email Icon"],
                ["phone", "Phone Icon"],
                ["hours", "Working Hours Icon"],
                ["address", "Address Icon"]
              ].map(([key, title]) => {
                const icon = settings.details.icons[key];
                return (
                  <IconEditor
                    key={`detail-${key}`}
                    title={title}
                    value={{
                      builtin: icon.builtin,
                      imageUrl: icon.imageUrl,
                      size: icon.size,
                      color: icon.color,
                      iconBackground: icon.background,
                      enabled: icon.showIcon
                    }}
                    isUploading={uploadingIcon === `detail-${key}`}
                    minSize={12}
                    maxSize={64}
                    onChange={(field, value) => {
                      const fieldMap = { enabled: "showIcon", iconBackground: "background" };
                      updateDetailIcon(key, fieldMap[field] || field, value);
                    }}
                    onUpload={(file) => uploadIcon(`detail-${key}`, file)}
                  />
                );
              })}
            </div>
          </Panel>

          <Panel eyebrow="Trust Strip" title="Service commitments">
            <div style={cardGridStyle}>
              {settings.trustItems.map((item) => (
                <article key={item.key} style={subPanelStyle}>
                  <Toggle label="Show Item" value={item.enabled} onChange={(value) => updateTrust(item.key, "enabled", value)} />
                  <TextField label="Trust Text" value={item.label} onChange={(value) => updateTrust(item.key, "label", value)} />
                </article>
              ))}
            </div>
            <div style={sectionDividerStyle}>
              <span style={eyebrowStyle}>Trust Strip Icons</span>
              <strong style={sectionSubtitleStyle}>Fast response, security, privacy, and customer-first icons</strong>
            </div>
            <div style={cardGridStyle}>
              {settings.trustItems.map((item) => (
                <IconEditor
                  key={`trust-icon-${item.key}`}
                  title={`${item.label} Icon`}
                  value={{
                    builtin: item.iconBuiltin,
                    iconUrl: item.iconUrl,
                    iconSize: item.iconSize,
                    iconColor: item.iconColor,
                    showIcon: item.showIcon
                  }}
                  isUploading={uploadingIcon === `trust-${item.key}`}
                  minSize={12}
                  maxSize={64}
                  onChange={(field, value) => {
                    const fieldMap = { enabled: "showIcon", builtin: "iconBuiltin", imageUrl: "iconUrl", size: "iconSize", color: "iconColor" };
                    updateTrust(item.key, fieldMap[field] || field, value);
                  }}
                  onUpload={(file) => uploadIcon(`trust-${item.key}`, file)}
                />
              ))}
            </div>
          </Panel>

          <Panel eyebrow="Theme & Layout" title="Colors, sizing, spacing, and responsive typography">
            <div style={gridStyle}>
              {[
                ["Customer Accent", "customerAccent"], ["Customer Dark Accent", "customerAccentDark"], ["Customer Soft Accent", "customerAccentSoft"],
                ["Business Accent", "businessAccent"], ["Business Dark Accent", "businessAccentDark"], ["Business Soft Accent", "businessAccentSoft"],
                ["Page Background", "pageBackground"], ["Hero Background", "heroBackground"], ["Surface Color", "surfaceColor"],
                ["Text Color", "textColor"], ["Muted Text Color", "mutedTextColor"], ["Border Color", "borderColor"], ["Trust Background", "trustBackground"]
              ].map(([label, key]) => <ColorField key={key} label={label} value={design[key]} onChange={(value) => updateNested("design", key, value)} />)}
              <NumberField label="Card Radius" value={design.cardRadius} min={0} max={48} onChange={(value) => updateNested("design", "cardRadius", value)} />
              <NumberField label="Input Radius" value={design.inputRadius} min={0} max={30} onChange={(value) => updateNested("design", "inputRadius", value)} />
              <NumberField label="Content Width" value={design.contentMaxWidth} min={680} max={1440} onChange={(value) => updateNested("design", "contentMaxWidth", value)} />
              <NumberField label="Section Gap" value={design.sectionGap} min={12} max={80} onChange={(value) => updateNested("design", "sectionGap", value)} />
              <NumberField label="Desktop Heading" value={design.headingFontSize} min={28} max={84} onChange={(value) => updateNested("design", "headingFontSize", value)} />
              <NumberField label="Mobile Heading" value={design.mobileHeadingFontSize} min={24} max={56} onChange={(value) => updateNested("design", "mobileHeadingFontSize", value)} />
            </div>
          </Panel>

          <Panel eyebrow="Advanced CSS" title="Scoped custom styling" copy="Selectors must start under .contact-page. HTML, scripts, imports, expressions, and external URLs are rejected by the backend.">
            <textarea value={settings.customCss || ""} onChange={(event) => update("customCss", event.target.value)} placeholder={".contact-page .contact-hero {\n  min-height: 320px;\n}"} style={cssStyle} />
          </Panel>
        </div>

        <aside style={previewPanelStyle}>
          <span style={eyebrowStyle}>Live Preview</span>
          <h3 style={panelTitleStyle}>Contact Page</h3>
          <div className="contact-page" style={{ ...previewStyle, ...previewRootStyle }}>
            {settings.customCss ? <style>{settings.customCss}</style> : null}
            <div style={{ ...previewHeroStyle, background: design.heroBackground, borderColor: design.borderColor, borderRadius: `${design.cardRadius}px` }}>
              {settings.heroIcons.left.enabled ? <IconPreview {...settings.heroIcons.left} size={54} /> : <span />}
              <div>
                <h2 style={{ margin: 0, color: design.textColor }}>{settings.heroTitle}</h2>
                <p>{settings.heroLineOne}</p>
                <p>{settings.heroLineTwo}</p>
              </div>
              {settings.heroIcons.right.enabled ? <IconPreview {...settings.heroIcons.right} size={54} /> : <span />}
            </div>
            <strong style={{ color: design.textColor }}>{settings.sectionTitle}</strong>
            <div style={previewCardsStyle}>
              {activeEnquiries.map((item) => (
                <div key={item.key} style={{ ...previewCardStyle, background: design.surfaceColor, borderColor: design.borderColor, borderRadius: `${design.cardRadius}px` }}>
                  {item.showIcon ? <IconPreview builtin={item.iconBuiltin} imageUrl={item.iconUrl} size={Math.min(item.iconSize, 52)} color={item.iconColor} background={item.iconBackground} /> : null}
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                  <span style={{ ...previewButtonStyle, background: item.key === "b2b" ? design.businessAccent : design.customerAccent }}>{item.buttonText}</span>
                </div>
              ))}
            </div>
            <div style={{ ...previewCardStyle, background: design.surfaceColor, borderColor: design.borderColor, borderRadius: `${design.cardRadius}px` }}>
              <strong>{activeEnquiries[0]?.title || "Contact Form"}</strong>
              <small>{settings.formIntro}</small>
              <div style={{ ...previewInputStyle, borderRadius: `${design.inputRadius}px` }}>{settings.fullNamePlaceholder}</div>
              <div style={{ ...previewInputStyle, borderRadius: `${design.inputRadius}px` }}>{settings.messagePlaceholder}</div>
              <span style={{ ...previewButtonStyle, background: design.customerAccent }}>{settings.submitButtonText}</span>
            </div>
            <div style={previewDetailsStyle}>
              {[
                ["email", settings.details.emailLabel, general.supportEmail],
                ["phone", settings.details.phoneLabel, general.supportPhone || settings.details.emptyPhoneText],
                ["hours", settings.details.hoursLabel, general.workingHours],
                ["address", settings.details.addressLabel, general.businessAddress]
              ].map(([key, label, value]) => {
                const icon = settings.details.icons[key];
                return (
                  <div key={key} style={previewDetailItemStyle}>
                    {icon.showIcon ? <IconPreview builtin={icon.builtin} imageUrl={icon.imageUrl} size={34} color={icon.color} background={icon.background} /> : null}
                    <strong>{label}</strong>
                    <small>{value}</small>
                  </div>
                );
              })}
            </div>
            <div style={{ ...previewTrustStyle, background: design.trustBackground, borderColor: design.borderColor, borderRadius: `${design.cardRadius}px` }}>
              {activeTrustItems.map((item) => (
                <small key={item.key} style={previewTrustItemStyle}>
                  {item.showIcon ? <IconPreview builtin={item.iconBuiltin} imageUrl={item.iconUrl} size={22} color={item.iconColor} /> : null}
                  {item.label}
                </small>
              ))}
            </div>
          </div>
          <button type="button" onClick={save} disabled={isSaving || isLoading || Boolean(uploadingIcon)} style={{ ...saveButtonStyle, width: "100%" }}>{isSaving ? "Saving..." : "Save & Publish"}</button>
        </aside>
      </div>
    </section>
  );
}

const pageStyle = { display: "grid", gap: "18px" };
const heroStyle = { display: "flex", justifyContent: "space-between", gap: "24px", alignItems: "flex-start", flexWrap: "wrap", padding: "26px", border: "1px solid #dbe5df", borderRadius: "20px", background: "linear-gradient(135deg,#fff,#eefaf1)" };
const titleStyle = { margin: "4px 0", fontSize: "32px", color: "#0f172a" };
const eyebrowStyle = { color: "#15803d", fontSize: "11px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" };
const copyStyle = { margin: 0, color: "#64748b", lineHeight: 1.55 };
const actionStyle = { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" };
const layoutStyle = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 0.42fr)", gap: "18px", alignItems: "start" };
const editorStyle = { display: "grid", gap: "18px" };
const panelStyle = { display: "grid", gap: "18px", padding: "22px", border: "1px solid #dbe3ec", borderRadius: "16px", background: "#fff", boxShadow: "0 10px 28px rgba(15,23,42,.05)" };
const panelHeadStyle = { display: "grid", gap: "5px" };
const panelTitleStyle = { margin: 0, color: "#0f172a", fontSize: "20px" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "14px" };
const cardGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "14px" };
const subPanelStyle = { display: "grid", gap: "12px", padding: "15px", border: "1px solid #e2e8f0", borderRadius: "13px", background: "#f8fafc" };
const fieldStyle = { display: "grid", gap: "7px" };
const labelStyle = { color: "#334155", fontSize: "13px", fontWeight: 800 };
const inputStyle = { width: "100%", boxSizing: "border-box", minHeight: "42px", padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: "9px", background: "#fff", color: "#0f172a" };
const textareaStyle = { ...inputStyle, minHeight: "88px", resize: "vertical", fontFamily: "inherit" };
const cssStyle = { ...textareaStyle, minHeight: "220px", fontFamily: "Consolas, monospace" };
const toggleStyle = { display: "flex", alignItems: "center", gap: "9px", color: "#334155", fontSize: "13px", fontWeight: 800 };
const colorRowStyle = { display: "grid", gridTemplateColumns: "48px 1fr", gap: "8px" };
const colorStyle = { width: "48px", height: "42px", padding: "3px", border: "1px solid #cbd5e1", borderRadius: "9px", background: "#fff" };
const saveButtonStyle = { minHeight: "42px", padding: "10px 17px", border: 0, borderRadius: "10px", background: "#16a34a", color: "#fff", fontWeight: 900, cursor: "pointer" };
const secondaryButtonStyle = { ...saveButtonStyle, border: "1px solid #cbd5e1", background: "#fff", color: "#334155" };
const messageStyle = { padding: "12px 15px", borderRadius: "10px", fontWeight: 800 };
const successStyle = { background: "#ecfdf3", color: "#166534", border: "1px solid #bbf7d0" };
const warningStyle = { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" };
const iconPreviewStyle = { display: "grid", placeItems: "center", flex: "0 0 auto", overflow: "hidden", borderRadius: "999px" };
const iconImageStyle = { width: "100%", height: "100%", objectFit: "contain" };
const iconEditorHeadStyle = { display: "flex", alignItems: "center", gap: "12px" };
const iconUploadRowStyle = { display: "flex", gap: "8px", flexWrap: "wrap" };
const dangerButtonStyle = { ...secondaryButtonStyle, color: "#b91c1c", borderColor: "#fecaca" };
const disabledButtonStyle = { ...secondaryButtonStyle, opacity: 0.55, cursor: "not-allowed" };
const hintStyle = { color: "#64748b", lineHeight: 1.45 };
const sectionDividerStyle = { display: "grid", gap: "4px", paddingTop: "8px", borderTop: "1px solid #e2e8f0" };
const sectionSubtitleStyle = { color: "#0f172a", fontSize: "16px" };
const previewPanelStyle = { ...panelStyle, position: "sticky", top: "18px" };
const previewRootStyle = { display: "grid", gap: "13px", padding: "12px", border: "1px solid #e2e8f0", borderRadius: "14px", color: "var(--contact-text)" };
const previewHeroStyle = { display: "grid", gridTemplateColumns: "64px 1fr 64px", alignItems: "center", gap: "8px", padding: "20px 12px", textAlign: "center", border: "1px solid" };
const previewCardsStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: "9px" };
const previewCardStyle = { display: "grid", gap: "8px", padding: "12px", border: "1px solid", color: "var(--contact-text)" };
const previewButtonStyle = { display: "inline-flex", justifyContent: "center", padding: "7px 9px", borderRadius: "6px", color: "#fff", fontSize: "11px", fontWeight: 900 };
const previewInputStyle = { padding: "8px", border: "1px solid var(--contact-border)", color: "var(--contact-muted)", fontSize: "11px" };
const previewDetailsStyle = { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", border: "1px solid var(--contact-border)", borderRadius: "8px", overflow: "hidden" };
const previewDetailItemStyle = { display: "grid", justifyItems: "center", gap: "4px", minWidth: 0, padding: "9px", textAlign: "center", border: "1px solid #e2e8f0" };
const previewTrustStyle = { display: "flex", gap: "8px", justifyContent: "space-around", flexWrap: "wrap", padding: "10px", border: "1px solid" };
const previewTrustItemStyle = { display: "inline-flex", alignItems: "center", gap: "5px", fontWeight: 800 };
