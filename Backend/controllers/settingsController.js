import { query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";
import { DEFAULT_APP_SETTINGS, getPublicSettings, mergeSettings } from "../../shared/appSettings.js";

const settingsTableName = "app_settings";
const legacySettingsTableName = "app_settings_legacy_json";
const themeSettingsTableName = "theme_settings";
const footerSettingsTableName = "footer_settings";
const footerItemsTableName = "footer_items";
const faviconMaxSizeBytes = 1 * 1024 * 1024;
let appSettingsTableReady = false;
let themeSettingsTableReady = false;
let footerSettingsTablesReady = false;

const generalSettingKeyByPath = {
  "general.storeName": "store_name",
  "general.logoUrl": "store_logo_url",
  "general.faviconUrl": "favicon_url",
  "general.brandTagline": "brand_tagline",
  "general.businessLegalName": "business_name",
  "general.supportEmail": "support_email",
  "general.supportPhone": "support_phone",
  "general.businessAddress": "business_address",
  "general.gstNumber": "gst_number",
  "general.workingHours": "working_hours"
};
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+]?[\d\s().-]{7,20}$/;
const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;
const publicImageUrlPattern = /^(https?:\/\/|\/(?:uploads|images)\/)/i;
const customCssMaxLength = 10000;
const hexColorPattern = /^#[0-9a-f]{6}$/i;
const rgbColorPattern = /^rgb\(\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*\)$/i;
const rgbaColorPattern = /^rgba\(\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(0|1|0?\.\d+)\s*\)$/i;

const generalPathBySettingKey = Object.fromEntries(
  Object.entries(generalSettingKeyByPath).map(([path, key]) => [key, path])
);

function getSettingPathKey(path) {
  return generalSettingKeyByPath[path] || path.replace(/\./g, "__");
}

function getSettingKeyPath(key) {
  return generalPathBySettingKey[key] || key.replace(/__/g, ".");
}

function flattenSettings(settings = {}, prefix = "") {
  return Object.entries(settings || {}).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return flattenSettings(value, path);
    }
    return [{ path, key: getSettingPathKey(path), group: path.split(".")[0] || "general", value }];
  });
}

function setNestedValue(target, path, value) {
  const parts = String(path || "").split(".").filter(Boolean);
  if (!parts.length) return;
  let cursor = target;
  parts.slice(0, -1).forEach((part) => {
    if (!cursor[part] || typeof cursor[part] !== "object" || Array.isArray(cursor[part])) {
      cursor[part] = {};
    }
    cursor = cursor[part];
  });
  cursor[parts[parts.length - 1]] = value;
}

function getNestedValue(source, path) {
  return String(path || "").split(".").reduce((current, part) => current?.[part], source);
}

function serializeSettingValue(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function flattenFooterSettings(footer = {}) {
  return ["branding", "support", "newsletter", "design"].flatMap((group) => (
    Object.entries(footer[group] || {}).map(([key, value]) => ({
      key,
      group,
      value
    }))
  ));
}

function normalizeFooterItemRows(footer = {}) {
  const itemGroups = [
    { key: "quickLinks", type: "quick_link" },
    { key: "faqLinks", type: "faq" },
    { key: "policyLinks", type: "policy" },
    { key: "socialLinks", type: "social" },
    { key: "paymentIcons", type: "payment" }
  ];

  return itemGroups.flatMap(({ key, type }) => (
    Array.isArray(footer[key]) ? footer[key] : []
  ).map((item, index) => ({
    itemUid: String(item.id || `${type}-${index + 1}`),
    itemType: type,
    label: item.label ?? null,
    questionText: item.questionText ?? null,
    name: item.name ?? null,
    url: item.url ?? null,
    iconUrl: item.icon ?? null,
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Math.floor(Number(item.sortOrder)) : index + 1,
    status: item.status === "inactive" ? "inactive" : "active",
    metadataJson: type === "faq" ? JSON.stringify({ answer: String(item.answer || "").trim() }) : null
  })));
}

function parseFooterMetadata(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function getDefaultFooterFaqAnswer(row = {}) {
  const defaults = DEFAULT_APP_SETTINGS.footer?.faqLinks || [];
  const match = defaults.find((link) => (
    link.id === row.itemUid || link.questionText === row.questionText
  ));
  return match?.answer || "";
}

function parseSettingValue(rawValue, fallbackValue) {
  if (Array.isArray(fallbackValue) || (fallbackValue && typeof fallbackValue === "object")) {
    try {
      return JSON.parse(rawValue || (Array.isArray(fallbackValue) ? "[]" : "{}"));
    } catch {
      return fallbackValue;
    }
  }
  if (typeof fallbackValue === "boolean") return String(rawValue) === "true";
  if (typeof fallbackValue === "number") {
    const number = Number(rawValue);
    return Number.isFinite(number) ? number : fallbackValue;
  }
  return String(rawValue ?? "");
}

function validateCustomCssValue(css = "") {
  const value = String(css || "").trim();
  if (!value) return "";

  if (value.length > customCssMaxLength) {
    throw new ApiError(400, "Custom CSS must be 10,000 characters or less.");
  }

  const lowered = value.toLowerCase();
  if (/<\/?\s*script\b/i.test(value)) {
    throw new ApiError(400, "Script tags are not allowed in Custom CSS.");
  }
  if (/<\/?\s*[a-z][^>]*>/i.test(value)) {
    throw new ApiError(400, "HTML tags are not allowed in Custom CSS.");
  }
  if (/\bjavascript\s*:/i.test(lowered)) {
    throw new ApiError(400, "javascript: URLs are not allowed in Custom CSS.");
  }
  if (/@import\b/i.test(value)) {
    throw new ApiError(400, "@import is not allowed in Custom CSS.");
  }
  if (/\bexpression\s*\(/i.test(value)) {
    throw new ApiError(400, "CSS expression() is not allowed in Custom CSS.");
  }
  if (/\biframe\b/i.test(value)) {
    throw new ApiError(400, "Iframe is not allowed in Custom CSS.");
  }
  if (/\bonerror\s*=/i.test(value) || /\bonclick\s*=/i.test(value)) {
    throw new ApiError(400, "Inline event handlers are not allowed in Custom CSS.");
  }
  if (/url\(\s*['\"]?\s*https?:\/\//i.test(value)) {
    throw new ApiError(400, "External URLs are not allowed in Custom CSS.");
  }
  if (!/[{}]/.test(value)) {
    throw new ApiError(400, "Custom CSS must include CSS selectors and declarations.");
  }
  if (!/\.avyona-theme[\s.#:[,{>+~]/i.test(`${value} `)) {
    throw new ApiError(400, "Custom CSS must be scoped under .avyona-theme.");
  }

  return value;
}

function validateThemeColor(value, fieldName = "Color") {
  const color = String(value || "").trim();

  if (!color) {
    throw new ApiError(400, `${fieldName} is required.`);
  }
  if (/<\/?\s*script\b/i.test(color) || /\bjavascript\s*:/i.test(color)) {
    throw new ApiError(400, `${fieldName} contains unsafe content.`);
  }
  if (!hexColorPattern.test(color) && !rgbColorPattern.test(color) && !rgbaColorPattern.test(color)) {
    throw new ApiError(400, `${fieldName} must be a valid HEX, rgb(), or rgba() color.`);
  }

  return color;
}

function validateThemeColors(theme = DEFAULT_APP_SETTINGS.theme) {
  const colorFieldsToValidate = [
    ["colors.primaryColor", "Primary Color", theme.colors?.primaryColor],
    ["colors.secondaryColor", "Secondary Color", theme.colors?.secondaryColor],
    ["colors.accentColor", "Accent Color", theme.colors?.accentColor],
    ["colors.backgroundColor", "Background Color", theme.colors?.backgroundColor],
    ["colors.surfaceColor", "Surface Color", theme.colors?.surfaceColor],
    ["colors.textColor", "Text Color", theme.colors?.textColor],
    ["colors.mutedTextColor", "Muted Text Color", theme.colors?.mutedTextColor],
    ["colors.borderColor", "Border Color", theme.colors?.borderColor],
    ["colors.successColor", "Success Color", theme.colors?.successColor],
    ["colors.errorColor", "Error Color", theme.colors?.errorColor],
    ["buttons.primaryBackground", "Primary Button Background", theme.buttons?.primaryBackground],
    ["buttons.primaryTextColor", "Primary Button Text Color", theme.buttons?.primaryTextColor],
    ["buttons.secondaryBackground", "Secondary Button Background", theme.buttons?.secondaryBackground],
    ["buttons.secondaryTextColor", "Secondary Button Text Color", theme.buttons?.secondaryTextColor],
    ["cards.background", "Card Background", theme.cards?.background],
    ["cards.borderColor", "Card Border Color", theme.cards?.borderColor],
    ["productCards.priceColor", "Price Color", theme.productCards?.priceColor],
    ["productCards.mrpColor", "MRP Color", theme.productCards?.mrpColor]
  ];

  colorFieldsToValidate.forEach(([_path, label, value]) => validateThemeColor(value, label));
}

function mapThemeRowToSettings(row = {}) {
  if (!row || !Object.keys(row).length) return null;

  return {
    colors: {
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      accentColor: row.accent_color,
      backgroundColor: row.background_color,
      surfaceColor: row.surface_color,
      textColor: row.text_color,
      mutedTextColor: row.muted_text_color,
      borderColor: row.border_color,
      successColor: row.success_color,
      errorColor: row.error_color
    },
    typography: {
      fontFamily: row.font_family,
      baseFontSize: Number(row.base_font_size),
      headingFontWeight: Number(row.heading_font_weight),
      bodyFontWeight: Number(row.body_font_weight),
      lineHeight: Number(row.line_height)
    },
    buttons: {
      borderRadius: Number(row.button_radius),
      height: Number(row.button_height)
    },
    cards: {
      borderRadius: Number(row.card_radius),
      shadowStyle: row.card_shadow
    },
    layout: {
      sectionPaddingDesktop: Number(row.section_padding_desktop),
      sectionPaddingMobile: Number(row.section_padding_mobile),
      websiteMaxWidth: Number(row.website_max_width)
    },
    productCards: {
      imageRatio: row.product_image_ratio
    },
    customCss: {
      css: row.custom_css || ""
    }
  };
}

function getThemeSettingValues(theme = DEFAULT_APP_SETTINGS.theme) {
  const mergedTheme = mergeSettings(DEFAULT_APP_SETTINGS.theme, theme || {});
  const customCss = validateCustomCssValue(mergedTheme.customCss.css || "");
  validateThemeColors(mergedTheme);

  return [
    mergedTheme.colors.primaryColor,
    mergedTheme.colors.secondaryColor,
    mergedTheme.colors.accentColor,
    mergedTheme.colors.backgroundColor,
    mergedTheme.colors.surfaceColor,
    mergedTheme.colors.textColor,
    mergedTheme.colors.mutedTextColor,
    mergedTheme.colors.borderColor,
    mergedTheme.colors.successColor,
    mergedTheme.colors.errorColor,
    mergedTheme.typography.fontFamily,
    Number(mergedTheme.typography.baseFontSize),
    Number(mergedTheme.typography.headingFontWeight),
    Number(mergedTheme.typography.bodyFontWeight),
    Number(mergedTheme.typography.lineHeight),
    Number(mergedTheme.buttons.borderRadius),
    Number(mergedTheme.buttons.height),
    Number(mergedTheme.cards.borderRadius),
    mergedTheme.cards.shadowStyle,
    Number(mergedTheme.layout.sectionPaddingDesktop),
    Number(mergedTheme.layout.sectionPaddingMobile),
    Number(mergedTheme.layout.websiteMaxWidth),
    mergedTheme.productCards.imageRatio,
    customCss
  ];
}

async function tableExists(tableName) {
  const rows = await query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function getTableColumns(tableName) {
  try {
    return await query(`SHOW COLUMNS FROM ${tableName}`);
  } catch {
    return [];
  }
}

async function createKeyValueSettingsTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS ${settingsTableName} (
      setting_key VARCHAR(120) NOT NULL PRIMARY KEY,
      setting_value TEXT NULL,
      setting_group VARCHAR(80) NOT NULL DEFAULT 'general',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_app_settings_group (setting_group)
    )`
  );
}

async function createThemeSettingsTable() {
  const defaults = DEFAULT_APP_SETTINGS.theme;

  await query(
    `CREATE TABLE IF NOT EXISTS ${themeSettingsTableName} (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
      primary_color VARCHAR(7) NOT NULL DEFAULT ?,
      secondary_color VARCHAR(7) NOT NULL DEFAULT ?,
      accent_color VARCHAR(7) NOT NULL DEFAULT ?,
      background_color VARCHAR(7) NOT NULL DEFAULT ?,
      surface_color VARCHAR(7) NOT NULL DEFAULT ?,
      text_color VARCHAR(7) NOT NULL DEFAULT ?,
      muted_text_color VARCHAR(7) NOT NULL DEFAULT ?,
      border_color VARCHAR(7) NOT NULL DEFAULT ?,
      success_color VARCHAR(7) NOT NULL DEFAULT ?,
      error_color VARCHAR(7) NOT NULL DEFAULT ?,
      font_family VARCHAR(80) NOT NULL DEFAULT ?,
      base_font_size INT NOT NULL DEFAULT ?,
      heading_font_weight INT NOT NULL DEFAULT ?,
      body_font_weight INT NOT NULL DEFAULT ?,
      line_height DECIMAL(4,2) NOT NULL DEFAULT ?,
      button_radius INT NOT NULL DEFAULT ?,
      button_height INT NOT NULL DEFAULT ?,
      card_radius INT NOT NULL DEFAULT ?,
      card_shadow VARCHAR(30) NOT NULL DEFAULT ?,
      section_padding_desktop INT NOT NULL DEFAULT ?,
      section_padding_mobile INT NOT NULL DEFAULT ?,
      website_max_width INT NOT NULL DEFAULT ?,
      product_image_ratio VARCHAR(20) NOT NULL DEFAULT ?,
      custom_css MEDIUMTEXT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT chk_theme_settings_singleton CHECK (id = 1)
    )`,
    [
      defaults.colors.primaryColor,
      defaults.colors.secondaryColor,
      defaults.colors.accentColor,
      defaults.colors.backgroundColor,
      defaults.colors.surfaceColor,
      defaults.colors.textColor,
      defaults.colors.mutedTextColor,
      defaults.colors.borderColor,
      defaults.colors.successColor,
      defaults.colors.errorColor,
      defaults.typography.fontFamily,
      defaults.typography.baseFontSize,
      defaults.typography.headingFontWeight,
      defaults.typography.bodyFontWeight,
      defaults.typography.lineHeight,
      defaults.buttons.borderRadius,
      defaults.buttons.height,
      defaults.cards.borderRadius,
      defaults.cards.shadowStyle,
      defaults.layout.sectionPaddingDesktop,
      defaults.layout.sectionPaddingMobile,
      defaults.layout.websiteMaxWidth,
      defaults.productCards.imageRatio
    ]
  );
}

async function ensureThemeSettingsTable() {
  if (themeSettingsTableReady) return;
  await createThemeSettingsTable();
  themeSettingsTableReady = true;
}

async function createFooterSettingsTables() {
  await query(
    `CREATE TABLE IF NOT EXISTS ${footerSettingsTableName} (
      setting_key VARCHAR(120) NOT NULL PRIMARY KEY,
      setting_value TEXT NULL,
      setting_group VARCHAR(80) NOT NULL DEFAULT 'branding',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_footer_settings_group (setting_group)
    )`
  );

  await query(
    `CREATE TABLE IF NOT EXISTS ${footerItemsTableName} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      item_uid VARCHAR(120) NOT NULL,
      item_type ENUM('quick_link', 'faq', 'policy', 'social', 'payment') NOT NULL,
      label VARCHAR(180) NULL,
      question_text VARCHAR(255) NULL,
      name VARCHAR(180) NULL,
      url VARCHAR(500) NULL,
      icon_url VARCHAR(500) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      metadata_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_footer_items_uid_type (item_uid, item_type),
      INDEX idx_footer_items_type_status_sort (item_type, status, sort_order),
      INDEX idx_footer_items_type_sort (item_type, sort_order)
    )`
  );
}

async function ensureFooterSettingsTables() {
  if (footerSettingsTablesReady) return;
  await createFooterSettingsTables();
  footerSettingsTablesReady = true;
}

async function ensureAppSettingsTable() {
  if (appSettingsTableReady) return;

  const exists = await tableExists(settingsTableName);
  if (exists) {
    const columns = await getTableColumns(settingsTableName);
    const hasSettingKey = columns.some((column) => column.Field === "setting_key");
    if (!hasSettingKey) {
      const legacyExists = await tableExists(legacySettingsTableName);
      if (!legacyExists) {
        await query(`RENAME TABLE ${settingsTableName} TO ${legacySettingsTableName}`);
      }
    }
  }

  await createKeyValueSettingsTable();

  const currentRows = await query(`SELECT COUNT(*) AS count FROM ${settingsTableName}`);
  if (Number(currentRows[0]?.count || 0) === 0) {
    let seedSettings = DEFAULT_APP_SETTINGS;
    if (await tableExists(legacySettingsTableName)) {
      const legacyRows = await query(
        `SELECT settings_json AS settingsJson FROM ${legacySettingsTableName} WHERE id = 1 LIMIT 1`
      );
      if (legacyRows[0]?.settingsJson) {
        try {
          const parsed = typeof legacyRows[0].settingsJson === "string"
            ? JSON.parse(legacyRows[0].settingsJson)
            : legacyRows[0].settingsJson;
          seedSettings = mergeSettings(DEFAULT_APP_SETTINGS, parsed || {});
        } catch {
          seedSettings = DEFAULT_APP_SETTINGS;
        }
      }
    }
    await writeStoredSettings(seedSettings);
  }

  appSettingsTableReady = true;
}

function clampInteger(value, min, max, fieldName) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < min || number > max) {
    throw new ApiError(400, `${fieldName} must be between ${min} and ${max}`);
  }

  return number;
}

function normalizeBrowseCategoriesSettings(payload = {}) {
  return {
    enabled: payload.enabled !== false,
    title: String(payload.title || DEFAULT_APP_SETTINGS.homepage.browseCategoriesSettings.title).trim(),
    subtitle: String(payload.subtitle || "").trim(),
    cardsPerRow: clampInteger(payload.cardsPerRow, 1, 10, "cardsPerRow"),
    mobileCardsPerRow: clampInteger(payload.mobileCardsPerRow, 1, 3, "mobileCardsPerRow"),
    sortOrder: Number.isFinite(Number(payload.sortOrder)) ? Math.floor(Number(payload.sortOrder)) : DEFAULT_APP_SETTINGS.homepage.browseCategoriesSettings.sortOrder
  };
}

function normalizeGeneralSettings(payload = {}) {
  const fallback = DEFAULT_APP_SETTINGS.general;
  const general = {
    storeName: String(payload.storeName ?? fallback.storeName ?? "").trim(),
    logoUrl: String(payload.logoUrl ?? fallback.logoUrl ?? "").trim(),
    faviconUrl: String(payload.faviconUrl ?? fallback.faviconUrl ?? "").trim(),
    brandTagline: String(payload.brandTagline ?? fallback.brandTagline ?? "").trim(),
    businessLegalName: String(payload.businessLegalName ?? fallback.businessLegalName ?? "").trim(),
    supportEmail: String(payload.supportEmail ?? fallback.supportEmail ?? "").trim(),
    supportPhone: String(payload.supportPhone ?? fallback.supportPhone ?? "").trim(),
    businessAddress: String(payload.businessAddress ?? fallback.businessAddress ?? "").trim(),
    gstNumber: String(payload.gstNumber ?? fallback.gstNumber ?? "").trim(),
    workingHours: String(payload.workingHours ?? fallback.workingHours ?? "").trim()
  };

  if (!general.storeName) {
    throw new ApiError(400, "Store Name is required.");
  }
  if (!emailPattern.test(general.supportEmail)) {
    throw new ApiError(400, "Support Email must be a valid email address.");
  }
  if (general.supportPhone && !phonePattern.test(general.supportPhone)) {
    throw new ApiError(400, "Support Phone must be a valid phone number.");
  }
  if (general.gstNumber && !gstPattern.test(general.gstNumber)) {
    throw new ApiError(400, "GST Number format is invalid.");
  }
  if (general.businessAddress.length > 500) {
    throw new ApiError(400, "Business Address must be 500 characters or less.");
  }
  if (general.workingHours.length > 200) {
    throw new ApiError(400, "Working Hours must be 200 characters or less.");
  }
  if (general.brandTagline.length > 160) {
    throw new ApiError(400, "Brand Tagline must be 160 characters or less.");
  }
  ["logoUrl", "faviconUrl"].forEach((key) => {
    if (general[key] && !publicImageUrlPattern.test(general[key])) {
      throw new ApiError(400, `${key === "logoUrl" ? "Store Logo" : "Favicon"} must be a clean public image URL.`);
    }
  });

  return general;
}

const homepageSectionSettingsKeyBySection = {
  "browse-categories": "browseCategoriesSettings",
  "our-products": "ourProductsSettings",
  "best-sellers": "bestSellerProductsSettings",
  "new-arrivals": "newArrivalProductsSettings",
  "featured-brands": "featuredBrandsSettings",
  newsletter: "newsletterSettings",
  "blog-posts": "blogPostsSettings",
  "credit-points": "creditPointsSettings"
};

function getHomepageSectionSettingsKey(sectionKey) {
  const settingsKey = homepageSectionSettingsKeyBySection[String(sectionKey || "").trim()];
  if (!settingsKey) {
    throw new ApiError(404, "Homepage section settings not found");
  }
  return settingsKey;
}

function normalizeHomepageSectionSettings(payload = {}, fallback = DEFAULT_APP_SETTINGS.homepage.ourProductsSettings) {
  const allowedButtonDisplayTypes = new Set(["view_product", "add_to_cart", "both", "none"]);
  const shouldIncludeButtonDisplayType = Object.prototype.hasOwnProperty.call(fallback, "buttonDisplayType") || payload.buttonDisplayType !== undefined;
  const buttonDisplayType = allowedButtonDisplayTypes.has(payload.buttonDisplayType)
    ? payload.buttonDisplayType
    : (fallback.buttonDisplayType || "both");

  return {
    enabled: payload.enabled !== false,
    title: String(payload.title || fallback.title || "").trim(),
    subtitle: String(payload.subtitle || "").trim(),
    cardsPerRow: clampInteger(payload.cardsPerRow, 1, 10, "cardsPerRow"),
    tabletCardsPerRow: clampInteger(payload.tabletCardsPerRow ?? fallback.tabletCardsPerRow ?? payload.cardsPerRow, 1, 6, "tabletCardsPerRow"),
    mobileCardsPerRow: clampInteger(payload.mobileCardsPerRow, 1, 3, "mobileCardsPerRow"),
    ...(shouldIncludeButtonDisplayType ? { buttonDisplayType } : {}),
    sortOrder: Number.isFinite(Number(payload.sortOrder)) ? Math.floor(Number(payload.sortOrder)) : fallback.sortOrder
  };
}

async function readStoredSettings() {
  await ensureAppSettingsTable();
  await ensureThemeSettingsTable();
  const [rows, themeSettings] = await Promise.all([
    query(
      `SELECT setting_key AS settingKey, setting_value AS settingValue
       FROM ${settingsTableName}`
    ),
    readStoredThemeSettings()
  ]);

  if (!rows.length) {
    return themeSettings ? { theme: themeSettings } : null;
  }

  const settings = {};
  rows.forEach((row) => {
    const path = getSettingKeyPath(row.settingKey);
    const fallbackValue = getNestedValue(DEFAULT_APP_SETTINGS, path);
    setNestedValue(settings, path, parseSettingValue(row.settingValue, fallbackValue));
  });

  if (themeSettings) {
    settings.theme = mergeSettings(settings.theme || {}, themeSettings);
  } else {
    await writeStoredThemeSettings(settings.theme || DEFAULT_APP_SETTINGS.theme);
  }

  const footerSettings = await readStoredFooterSettings();
  if (footerSettings) {
    settings.footer = {
      ...(settings.footer || {}),
      ...footerSettings
    };
  }

  return settings;
}

async function writeStoredSettings(settings) {
  await createKeyValueSettingsTable();
  await ensureThemeSettingsTable();
  const entries = flattenSettings(settings);
  if (!entries.length) return;

  await Promise.all(entries.map((entry) => query(
    `INSERT INTO ${settingsTableName} (setting_key, setting_value, setting_group)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       setting_value = VALUES(setting_value),
       setting_group = VALUES(setting_group)`,
    [entry.key, serializeSettingValue(entry.value), entry.group]
  )));

  await writeStoredThemeSettings(settings.theme || DEFAULT_APP_SETTINGS.theme);
  await writeStoredFooterSettings(settings.footer || DEFAULT_APP_SETTINGS.footer);
}

async function readStoredThemeSettings() {
  await ensureThemeSettingsTable();

  const rows = await query(
    `SELECT
       primary_color,
       secondary_color,
       accent_color,
       background_color,
       surface_color,
       text_color,
       muted_text_color,
       border_color,
       success_color,
       error_color,
       font_family,
       base_font_size,
       heading_font_weight,
       body_font_weight,
       line_height,
       button_radius,
       button_height,
       card_radius,
       card_shadow,
       section_padding_desktop,
       section_padding_mobile,
       website_max_width,
       product_image_ratio,
       custom_css
     FROM ${themeSettingsTableName}
     WHERE id = 1
     LIMIT 1`
  );

  return rows[0] ? mapThemeRowToSettings(rows[0]) : null;
}

async function writeStoredThemeSettings(theme = DEFAULT_APP_SETTINGS.theme) {
  await ensureThemeSettingsTable();

  await query(
    `INSERT INTO ${themeSettingsTableName} (
       id,
       primary_color,
       secondary_color,
       accent_color,
       background_color,
       surface_color,
       text_color,
       muted_text_color,
       border_color,
       success_color,
       error_color,
       font_family,
       base_font_size,
       heading_font_weight,
       body_font_weight,
       line_height,
       button_radius,
       button_height,
       card_radius,
       card_shadow,
       section_padding_desktop,
       section_padding_mobile,
       website_max_width,
       product_image_ratio,
       custom_css
     )
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       primary_color = VALUES(primary_color),
       secondary_color = VALUES(secondary_color),
       accent_color = VALUES(accent_color),
       background_color = VALUES(background_color),
       surface_color = VALUES(surface_color),
       text_color = VALUES(text_color),
       muted_text_color = VALUES(muted_text_color),
       border_color = VALUES(border_color),
       success_color = VALUES(success_color),
       error_color = VALUES(error_color),
       font_family = VALUES(font_family),
       base_font_size = VALUES(base_font_size),
       heading_font_weight = VALUES(heading_font_weight),
       body_font_weight = VALUES(body_font_weight),
       line_height = VALUES(line_height),
       button_radius = VALUES(button_radius),
       button_height = VALUES(button_height),
       card_radius = VALUES(card_radius),
       card_shadow = VALUES(card_shadow),
       section_padding_desktop = VALUES(section_padding_desktop),
       section_padding_mobile = VALUES(section_padding_mobile),
       website_max_width = VALUES(website_max_width),
       product_image_ratio = VALUES(product_image_ratio),
       custom_css = VALUES(custom_css)`,
    getThemeSettingValues(theme)
  );
}

async function readStoredFooterSettings() {
  await ensureFooterSettingsTables();

  const [settingsRows, itemRows] = await Promise.all([
    query(
      `SELECT setting_key AS settingKey, setting_value AS settingValue, setting_group AS settingGroup
       FROM ${footerSettingsTableName}`
    ),
    query(
      `SELECT
         item_uid AS itemUid,
         item_type AS itemType,
         label,
         question_text AS questionText,
         name,
         url,
         icon_url AS iconUrl,
         sort_order AS sortOrder,
         status,
         metadata_json AS metadataJson
       FROM ${footerItemsTableName}
       ORDER BY item_type ASC, sort_order ASC, id ASC`
    )
  ]);

  if (!settingsRows.length && !itemRows.length) {
    return null;
  }

  const footer = {};
  settingsRows.forEach((row) => {
    const group = row.settingGroup || "branding";
    const fallbackValue = DEFAULT_APP_SETTINGS.footer?.[group]?.[row.settingKey];
    footer[group] = {
      ...(footer[group] || {}),
      [row.settingKey]: parseSettingValue(row.settingValue, fallbackValue)
    };
  });

  const quickLinks = [];
  const faqLinks = [];
  const policyLinks = [];
  const socialLinks = [];
  const paymentIcons = [];

  itemRows.forEach((row) => {
    const base = {
      id: row.itemUid,
      sortOrder: Number(row.sortOrder || 0),
      status: row.status === "inactive" ? "inactive" : "active"
    };

    if (row.itemType === "quick_link") {
      quickLinks.push({ ...base, label: row.label || "", url: row.url || "" });
    } else if (row.itemType === "faq") {
      const metadata = parseFooterMetadata(row.metadataJson);
      faqLinks.push({ ...base, questionText: row.questionText || "", answer: metadata.answer || getDefaultFooterFaqAnswer(row), url: row.url || "" });
    } else if (row.itemType === "policy") {
      policyLinks.push({ ...base, label: row.label || "", url: row.url || "" });
    } else if (row.itemType === "social") {
      socialLinks.push({ ...base, name: row.name || "", url: row.url || "", icon: row.iconUrl || "" });
    } else if (row.itemType === "payment") {
      paymentIcons.push({ ...base, name: row.name || "", icon: row.iconUrl || "" });
    }
  });

  if (quickLinks.length) footer.quickLinks = quickLinks;
  if (faqLinks.length) footer.faqLinks = faqLinks;
  if (policyLinks.length) footer.policyLinks = policyLinks;
  if (socialLinks.length) footer.socialLinks = socialLinks;
  if (paymentIcons.length) footer.paymentIcons = paymentIcons;

  return footer;
}

async function writeStoredFooterSettings(footer = DEFAULT_APP_SETTINGS.footer) {
  await ensureFooterSettingsTables();

  const scalarEntries = flattenFooterSettings(footer);
  const itemEntries = normalizeFooterItemRows(footer);

  await query(`DELETE FROM ${footerSettingsTableName}`);
  await query(`DELETE FROM ${footerItemsTableName}`);

  if (scalarEntries.length) {
    await Promise.all(scalarEntries.map((entry) => query(
      `INSERT INTO ${footerSettingsTableName} (setting_key, setting_value, setting_group)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         setting_value = VALUES(setting_value),
         setting_group = VALUES(setting_group)`,
      [entry.key, serializeSettingValue(entry.value), entry.group]
    )));
  }

  if (itemEntries.length) {
    await Promise.all(itemEntries.map((item) => query(
      `INSERT INTO ${footerItemsTableName}
        (item_uid, item_type, label, question_text, name, url, icon_url, sort_order, status, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         label = VALUES(label),
         question_text = VALUES(question_text),
         name = VALUES(name),
         url = VALUES(url),
         icon_url = VALUES(icon_url),
         sort_order = VALUES(sort_order),
         status = VALUES(status),
         metadata_json = VALUES(metadata_json)`,
      [
        item.itemUid,
        item.itemType,
        item.label,
        item.questionText,
        item.name,
        item.url,
        item.iconUrl,
        item.sortOrder,
        item.status,
        item.metadataJson
      ]
    )));
  }
}

export async function getAdminSettings(_request, response) {
  const storedSettings = await readStoredSettings();
  const settings = mergeSettings(DEFAULT_APP_SETTINGS, storedSettings || {});

  response.json({
    success: true,
    data: settings
  });
}

export async function updateAdminSettings(request, response) {
  const incomingSettings = request.body?.settings;

  if (!incomingSettings || typeof incomingSettings !== "object" || Array.isArray(incomingSettings)) {
    throw new ApiError(400, "A valid settings object is required");
  }

  const settings = mergeSettings(DEFAULT_APP_SETTINGS, incomingSettings);

  await writeStoredSettings(settings);

  response.json({
    success: true,
    message: "Settings saved successfully",
    data: settings
  });
}

export async function getAdminThemeSettings(_request, response) {
  const storedSettings = await readStoredSettings();
  const settings = mergeSettings(DEFAULT_APP_SETTINGS, storedSettings || {});

  response.json({
    success: true,
    data: settings.theme
  });
}

export async function updateAdminThemeSettings(request, response) {
  const incomingThemeSettings = request.body?.theme || request.body?.settings || request.body;

  if (!incomingThemeSettings || typeof incomingThemeSettings !== "object" || Array.isArray(incomingThemeSettings)) {
    throw new ApiError(400, "A valid theme settings object is required");
  }

  const storedSettings = await readStoredSettings();
  const currentSettings = mergeSettings(DEFAULT_APP_SETTINGS, storedSettings || {});
  const theme = mergeSettings(currentSettings.theme || DEFAULT_APP_SETTINGS.theme, incomingThemeSettings);
  theme.customCss = {
    ...(theme.customCss || {}),
    css: validateCustomCssValue(theme.customCss?.css || "")
  };
  validateThemeColors(theme);
  const settings = mergeSettings(currentSettings, { theme });

  await writeStoredSettings(settings);
  const savedSettings = mergeSettings(DEFAULT_APP_SETTINGS, await readStoredSettings() || {});

  response.json({
    success: true,
    message: "Theme settings saved successfully",
    data: savedSettings.theme
  });
}

export async function getAdminGeneralSettings(_request, response) {
  const storedSettings = await readStoredSettings();
  const settings = mergeSettings(DEFAULT_APP_SETTINGS, storedSettings || {});

  response.json({
    success: true,
    data: settings.general
  });
}

export async function updateAdminGeneralSettings(request, response) {
  const incomingGeneralSettings = request.body?.settings || request.body?.general || request.body;

  if (!incomingGeneralSettings || typeof incomingGeneralSettings !== "object" || Array.isArray(incomingGeneralSettings)) {
    throw new ApiError(400, "A valid general settings object is required");
  }

  const storedSettings = await readStoredSettings();
  const currentSettings = mergeSettings(DEFAULT_APP_SETTINGS, storedSettings || {});
  const general = normalizeGeneralSettings({
    ...(currentSettings.general || {}),
    ...incomingGeneralSettings
  });
  const settings = mergeSettings(currentSettings, { general });

  await writeStoredSettings(settings);

  response.json({
    success: true,
    message: "General settings saved successfully",
    data: general
  });
}

export async function getAdminBrowseCategoriesSettings(_request, response) {
  const storedSettings = await readStoredSettings();
  const settings = mergeSettings(DEFAULT_APP_SETTINGS, storedSettings || {});

  response.json({
    success: true,
    data: settings.homepage.browseCategoriesSettings
  });
}

export async function getAdminHomepageSectionSettings(request, response) {
  const settingsKey = getHomepageSectionSettingsKey(request.params.sectionKey);
  const storedSettings = await readStoredSettings();
  const settings = mergeSettings(DEFAULT_APP_SETTINGS, storedSettings || {});

  response.json({
    success: true,
    data: settings.homepage[settingsKey]
  });
}

export async function updateAdminHomepageSectionSettings(request, response) {
  const settingsKey = getHomepageSectionSettingsKey(request.params.sectionKey);
  const storedSettings = await readStoredSettings();
  const currentSettings = mergeSettings(DEFAULT_APP_SETTINGS, storedSettings || {});
  const sectionSettings = settingsKey === "browseCategoriesSettings"
    ? normalizeBrowseCategoriesSettings(request.body || {})
    : normalizeHomepageSectionSettings(request.body || {}, DEFAULT_APP_SETTINGS.homepage[settingsKey]);
  const settings = mergeSettings(currentSettings, {
    homepage: {
      ...(currentSettings.homepage || {}),
      [settingsKey]: sectionSettings,
      ...(settingsKey === "browseCategoriesSettings" ? { browseCategoryCardCount: sectionSettings.cardsPerRow } : {})
    }
  });

  await writeStoredSettings(settings);

  response.json({
    success: true,
    message: "Homepage section settings saved successfully",
    data: sectionSettings
  });
}

export async function updateAdminBrowseCategoriesSettings(request, response) {
  const storedSettings = await readStoredSettings();
  const currentSettings = mergeSettings(DEFAULT_APP_SETTINGS, storedSettings || {});
  const browseCategoriesSettings = normalizeBrowseCategoriesSettings(request.body || {});
  const settings = mergeSettings(currentSettings, {
    homepage: {
      ...(currentSettings.homepage || {}),
      browseCategoriesSettings,
      browseCategoryCardCount: browseCategoriesSettings.cardsPerRow
    }
  });

  await writeStoredSettings(settings);

  response.json({
    success: true,
    message: "Browse Categories settings saved successfully",
    data: browseCategoriesSettings
  });
}

export async function getPublicAppSettings(_request, response) {
  const storedSettings = await readStoredSettings();
  const settings = mergeSettings(DEFAULT_APP_SETTINGS, storedSettings || {});

  response.json({
    success: true,
    data: getPublicSettings(settings)
  });
}

export async function getPublicThemeSettings(_request, response) {
  const storedSettings = await readStoredSettings();
  const settings = mergeSettings(DEFAULT_APP_SETTINGS, storedSettings || {});
  const publicSettings = getPublicSettings(settings);

  response.json({
    success: true,
    data: publicSettings.theme
  });
}

export async function getPublicBrowseCategoriesSettings(_request, response) {
  const storedSettings = await readStoredSettings();
  const settings = mergeSettings(DEFAULT_APP_SETTINGS, storedSettings || {});
  const publicSettings = getPublicSettings(settings);

  response.json({
    success: true,
    data: publicSettings.homepage.browseCategoriesSettings
  });
}

export async function getPublicHomepageSectionSettings(request, response) {
  const settingsKey = getHomepageSectionSettingsKey(request.params.sectionKey);
  const storedSettings = await readStoredSettings();
  const settings = mergeSettings(DEFAULT_APP_SETTINGS, storedSettings || {});
  const publicSettings = getPublicSettings(settings);

  response.json({
    success: true,
    data: publicSettings.homepage[settingsKey]
  });
}

export async function uploadSettingsAsset(request, response) {
  if (!request.file) {
    throw new ApiError(400, "Settings image file is required");
  }

  const assetType = String(request.body?.assetType || request.query?.assetType || "").trim().toLowerCase();
  const uploadFolder = assetType.startsWith("footer-") ? "footer" : "settings";
  if (assetType === "favicon" && request.file.size > faviconMaxSizeBytes) {
    throw new ApiError(400, "Favicon image is too large. Maximum size is 1 MB.");
  }

  response.status(201).json({
    success: true,
    data: {
      url: `/uploads/${uploadFolder}/${request.file.filename}`
    },
    url: `/uploads/${uploadFolder}/${request.file.filename}`
  });
}
