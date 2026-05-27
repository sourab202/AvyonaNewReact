import { query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";
import { DEFAULT_APP_SETTINGS, getPublicSettings, mergeSettings } from "../../shared/appSettings.js";

const settingsTableName = "app_settings";
const legacySettingsTableName = "app_settings_legacy_json";
const themeSettingsTableName = "theme_settings";
const footerSettingsTableName = "footer_settings";
const footerItemsTableName = "footer_items";
const whyShopSettingsTableName = "homepage_why_shop_settings";
const whyShopItemsTableName = "homepage_why_shop_items";
const productPaymentIconSettingsTableName = "product_payment_icon_settings";
const productPaymentIconsTableName = "product_payment_icons";
const faviconMaxSizeBytes = 1 * 1024 * 1024;
let appSettingsTableReady = false;
let themeSettingsTableReady = false;
let footerSettingsTablesReady = false;
let whyShopTablesReady = false;
let productPaymentIconTablesReady = false;

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

function validateCustomCssValue(css = "", scopeSelector = ".avyona-theme") {
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
  const escapedScope = scopeSelector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const scopePattern = new RegExp(`${escapedScope}[\\s.#:[,{>+~]`, "i");
  if (!scopePattern.test(`${value} `)) {
    throw new ApiError(400, `Custom CSS must be scoped under ${scopeSelector}.`);
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

async function createWhyShopTables() {
  const defaults = DEFAULT_APP_SETTINGS.homepage.whyShopSettings;

  await query(
    `CREATE TABLE IF NOT EXISTS ${whyShopSettingsTableName} (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
      section_enabled TINYINT(1) NOT NULL DEFAULT ?,
      section_title VARCHAR(180) NOT NULL DEFAULT ?,
      section_subtitle TEXT NULL,
      cards_per_row INT NOT NULL DEFAULT ?,
      mobile_cards_per_row INT NOT NULL DEFAULT ?,
      section_sort_order INT NOT NULL DEFAULT ?,
      background_color VARCHAR(32) NOT NULL DEFAULT ?,
      text_color VARCHAR(32) NOT NULL DEFAULT ?,
      custom_css MEDIUMTEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT chk_homepage_why_shop_settings_singleton CHECK (id = 1)
    )`,
    [
      defaults.enabled ? 1 : 0,
      defaults.title,
      defaults.cardsPerRow,
      defaults.mobileCardsPerRow,
      defaults.sortOrder,
      defaults.backgroundColor,
      defaults.textColor
    ]
  );

  await query(
    `CREATE TABLE IF NOT EXISTS ${whyShopItemsTableName} (
      id VARCHAR(120) NOT NULL PRIMARY KEY,
      title VARCHAR(180) NOT NULL,
      icon_url VARCHAR(500) NULL,
      icon_position ENUM('left', 'right', 'top') NOT NULL DEFAULT 'left',
      icon_size INT NOT NULL DEFAULT 42,
      font_size INT NOT NULL DEFAULT 18,
      text_color VARCHAR(32) NOT NULL DEFAULT '#0f172a',
      card_background VARCHAR(32) NOT NULL DEFAULT '#ffffff',
      card_border_color VARCHAR(32) NOT NULL DEFAULT '#e5e7eb',
      card_radius INT NOT NULL DEFAULT 16,
      sort_order INT NOT NULL DEFAULT 0,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      INDEX idx_homepage_why_shop_items_status_sort (status, sort_order),
      INDEX idx_homepage_why_shop_items_deleted_sort (deleted_at, sort_order)
    )`
  );
}

async function seedDefaultWhyShopRows() {
  const settingsDefaults = DEFAULT_APP_SETTINGS.homepage.whyShopSettings;
  await query(
    `INSERT IGNORE INTO ${whyShopSettingsTableName}
      (id, section_enabled, section_title, section_subtitle, cards_per_row, mobile_cards_per_row, section_sort_order, background_color, text_color, custom_css)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      settingsDefaults.enabled ? 1 : 0,
      settingsDefaults.title,
      settingsDefaults.subtitle,
      settingsDefaults.cardsPerRow,
      settingsDefaults.mobileCardsPerRow,
      settingsDefaults.sortOrder,
      settingsDefaults.backgroundColor,
      settingsDefaults.textColor,
      settingsDefaults.customCss || null
    ]
  );

  const itemRows = DEFAULT_APP_SETTINGS.homepage.whyShopItems.map(normalizeWhyShopItemPayload);
  for (const item of itemRows) {
    await query(
      `INSERT IGNORE INTO ${whyShopItemsTableName}
        (id, title, icon_url, icon_position, icon_size, font_size, text_color, card_background, card_border_color, card_radius, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.title,
        item.iconUrl || null,
        item.iconPosition,
        item.iconSize,
        item.titleFontSize,
        item.textColor,
        item.cardBackgroundColor,
        item.cardBorderColor,
        item.cardRadius,
        item.sortOrder,
        item.status
      ]
    );
  }
}

async function ensureWhyShopTables() {
  if (whyShopTablesReady) return;
  await createWhyShopTables();
  await seedDefaultWhyShopRows();
  whyShopTablesReady = true;
}

function normalizeProductPaymentIconPayload(item = {}, index = 0) {
  const fallback = DEFAULT_APP_SETTINGS.homepage.productPaymentIcons[index] || DEFAULT_APP_SETTINGS.homepage.productPaymentIcons[0] || {};
  const allowedStatuses = new Set(["active", "inactive"]);
  const status = allowedStatuses.has(String(item.status || "").toLowerCase()) ? String(item.status).toLowerCase() : (fallback.status || "active");

  return {
    id: String(item.id || fallback.id || `payment-icon-${index + 1}`).trim(),
    paymentName: String(item.paymentName || item.name || fallback.paymentName || "Payment").trim(),
    iconUrl: String(item.iconUrl || fallback.iconUrl || "").trim(),
    altText: String(item.altText || item.iconAltText || fallback.altText || "").trim(),
    iconSize: clampInteger(item.iconSize ?? fallback.iconSize ?? 44, 16, 120, "iconSize"),
    iconBackgroundColor: String(item.iconBackgroundColor || fallback.iconBackgroundColor || "#ffffff").trim(),
    iconBorderColor: String(item.iconBorderColor || fallback.iconBorderColor || "#e5e7eb").trim(),
    iconRadius: clampInteger(item.iconRadius ?? fallback.iconRadius ?? 14, 0, 48, "iconRadius"),
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Math.floor(Number(item.sortOrder)) : index + 1,
    status
  };
}

async function createProductPaymentIconTables() {
  const defaults = DEFAULT_APP_SETTINGS.homepage.productPaymentIconsSettings;

  await query(
    `CREATE TABLE IF NOT EXISTS ${productPaymentIconSettingsTableName} (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
      section_enabled TINYINT(1) NOT NULL DEFAULT ?,
      section_title VARCHAR(180) NOT NULL DEFAULT ?,
      section_subtitle TEXT NULL,
      icons_per_row INT NOT NULL DEFAULT ?,
      mobile_icons_per_row INT NOT NULL DEFAULT ?,
      sort_order INT NOT NULL DEFAULT ?,
      background_color VARCHAR(32) NOT NULL DEFAULT ?,
      text_color VARCHAR(32) NOT NULL DEFAULT ?,
      custom_css MEDIUMTEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT chk_product_payment_icon_settings_singleton CHECK (id = 1)
    )`,
    [
      defaults.enabled ? 1 : 0,
      defaults.title,
      defaults.cardsPerRow,
      defaults.mobileCardsPerRow,
      defaults.sortOrder,
      defaults.backgroundColor,
      defaults.textColor
    ]
  );

  await query(
    `CREATE TABLE IF NOT EXISTS ${productPaymentIconsTableName} (
      id VARCHAR(120) NOT NULL PRIMARY KEY,
      payment_name VARCHAR(180) NOT NULL,
      icon_url VARCHAR(500) NULL,
      icon_alt_text VARCHAR(240) NULL,
      icon_size INT NOT NULL DEFAULT 44,
      icon_background_color VARCHAR(32) NOT NULL DEFAULT '#ffffff',
      icon_border_color VARCHAR(32) NOT NULL DEFAULT '#e5e7eb',
      icon_radius INT NOT NULL DEFAULT 14,
      sort_order INT NOT NULL DEFAULT 0,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      INDEX idx_product_payment_icons_status_sort (status, sort_order),
      INDEX idx_product_payment_icons_deleted_sort (deleted_at, sort_order)
    )`
  );
}

async function seedDefaultProductPaymentIconRows() {
  const settingsDefaults = DEFAULT_APP_SETTINGS.homepage.productPaymentIconsSettings;
  await query(
    `INSERT IGNORE INTO ${productPaymentIconSettingsTableName}
      (id, section_enabled, section_title, section_subtitle, icons_per_row, mobile_icons_per_row, sort_order, background_color, text_color, custom_css)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      settingsDefaults.enabled ? 1 : 0,
      settingsDefaults.title,
      settingsDefaults.subtitle,
      settingsDefaults.cardsPerRow,
      settingsDefaults.mobileCardsPerRow,
      settingsDefaults.sortOrder,
      settingsDefaults.backgroundColor,
      settingsDefaults.textColor,
      settingsDefaults.customCss || null
    ]
  );

  const iconRows = DEFAULT_APP_SETTINGS.homepage.productPaymentIcons.map(normalizeProductPaymentIconPayload);
  for (const icon of iconRows) {
    await query(
      `INSERT IGNORE INTO ${productPaymentIconsTableName}
        (id, payment_name, icon_url, icon_alt_text, icon_size, icon_background_color, icon_border_color, icon_radius, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        icon.id,
        icon.paymentName,
        icon.iconUrl || null,
        icon.altText || null,
        icon.iconSize,
        icon.iconBackgroundColor,
        icon.iconBorderColor,
        icon.iconRadius,
        icon.sortOrder,
        icon.status
      ]
    );
  }
}

async function ensureProductPaymentIconTables() {
  if (productPaymentIconTablesReady) return;
  await createProductPaymentIconTables();
  await seedDefaultProductPaymentIconRows();
  productPaymentIconTablesReady = true;
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
  "why-shop": "whyShopSettings",
  "product-payment-icons": "productPaymentIconsSettings",
  newsletter: "newsletterSettings",
  "blog-posts": "blogPostsSettings",
  "credit-points": "creditPointsSettings"
};

const homepageSectionCssScopeBySettingsKey = {
  whyShopSettings: ".avyona-why-shop",
  productPaymentIconsSettings: ".avyona-product-payment-icons"
};

function getHomepageSectionSettingsKey(sectionKey) {
  const settingsKey = homepageSectionSettingsKeyBySection[String(sectionKey || "").trim()];
  if (!settingsKey) {
    throw new ApiError(404, "Homepage section settings not found");
  }
  return settingsKey;
}

function normalizeHomepageSectionSettings(payload = {}, fallback = DEFAULT_APP_SETTINGS.homepage.ourProductsSettings, cssScopeSelector = ".avyona-why-shop") {
  const allowedButtonDisplayTypes = new Set(["view_product", "add_to_cart", "both", "none"]);
  const shouldIncludeButtonDisplayType = Object.prototype.hasOwnProperty.call(fallback, "buttonDisplayType") || payload.buttonDisplayType !== undefined;
  const buttonDisplayType = allowedButtonDisplayTypes.has(payload.buttonDisplayType)
    ? payload.buttonDisplayType
    : (fallback.buttonDisplayType || "both");
  const customCss = String(payload.customCss || "").trim();
  const fallbackTabletCardsPerRow = Math.min(6, Math.max(1, Number(fallback.tabletCardsPerRow || fallback.cardsPerRow || 1)));

  if (customCss) {
    validateCustomCssValue(customCss, cssScopeSelector);
  }

  return {
    enabled: payload.enabled !== false,
    title: String(payload.title || fallback.title || "").trim(),
    subtitle: String(payload.subtitle || "").trim(),
    cardsPerRow: clampInteger(payload.cardsPerRow, 1, 10, "cardsPerRow"),
    tabletCardsPerRow: clampInteger(payload.tabletCardsPerRow ?? fallbackTabletCardsPerRow, 1, 6, "tabletCardsPerRow"),
    mobileCardsPerRow: clampInteger(payload.mobileCardsPerRow, 1, 3, "mobileCardsPerRow"),
    ...(shouldIncludeButtonDisplayType ? { buttonDisplayType } : {}),
    sortOrder: Number.isFinite(Number(payload.sortOrder)) ? Math.floor(Number(payload.sortOrder)) : fallback.sortOrder,
    ...(Object.prototype.hasOwnProperty.call(fallback, "backgroundColor") || payload.backgroundColor !== undefined
      ? { backgroundColor: String(payload.backgroundColor || fallback.backgroundColor || "#ffffff").trim() }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(fallback, "textColor") || payload.textColor !== undefined
      ? { textColor: String(payload.textColor || fallback.textColor || "#111827").trim() }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(fallback, "customCss") || payload.customCss !== undefined
      ? { customCss }
      : {})
  };
}

function normalizeWhyShopItemPayload(item = {}, index = 0) {
  const fallback = DEFAULT_APP_SETTINGS.homepage.whyShopItems[index] || DEFAULT_APP_SETTINGS.homepage.whyShopItems[0] || {};
  const allowedPositions = new Set(["left", "right", "top"]);
  const allowedStatuses = new Set(["active", "inactive"]);
  const iconPosition = allowedPositions.has(item.iconPosition) ? item.iconPosition : (fallback.iconPosition || "left");
  const status = allowedStatuses.has(String(item.status || "").toLowerCase()) ? String(item.status).toLowerCase() : (fallback.status || "active");

  return {
    id: String(item.id || fallback.id || `why-shop-item-${index + 1}`).trim(),
    title: String(item.title || fallback.title || "Trust Badge").trim(),
    iconUrl: String(item.iconUrl || fallback.iconUrl || "").trim(),
    iconPosition,
    iconSize: clampInteger(item.iconSize ?? fallback.iconSize ?? 42, 16, 120, "iconSize"),
    titleFontSize: clampInteger(item.titleFontSize ?? item.fontSize ?? fallback.titleFontSize ?? 18, 10, 42, "titleFontSize"),
    textColor: String(item.textColor || fallback.textColor || "#0f172a").trim(),
    cardBackgroundColor: String(item.cardBackgroundColor || item.cardBackground || fallback.cardBackgroundColor || "#ffffff").trim(),
    cardBorderColor: String(item.cardBorderColor || fallback.cardBorderColor || "#e5e7eb").trim(),
    cardRadius: clampInteger(item.cardRadius ?? fallback.cardRadius ?? 16, 0, 48, "cardRadius"),
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Math.floor(Number(item.sortOrder)) : index + 1,
    status
  };
}

function mapWhyShopSettingsRow(row = {}) {
  const fallback = DEFAULT_APP_SETTINGS.homepage.whyShopSettings;
  return normalizeHomepageSectionSettings({
    enabled: row.section_enabled !== undefined ? Boolean(row.section_enabled) : fallback.enabled,
    title: row.section_title ?? fallback.title,
    subtitle: row.section_subtitle ?? fallback.subtitle,
    cardsPerRow: row.cards_per_row ?? fallback.cardsPerRow,
    mobileCardsPerRow: row.mobile_cards_per_row ?? fallback.mobileCardsPerRow,
    sortOrder: row.section_sort_order ?? fallback.sortOrder,
    backgroundColor: row.background_color ?? fallback.backgroundColor,
    textColor: row.text_color ?? fallback.textColor,
    customCss: row.custom_css ?? fallback.customCss
  }, fallback);
}

function mapWhyShopItemRow(row = {}, index = 0) {
  return normalizeWhyShopItemPayload({
    id: row.id,
    title: row.title,
    iconUrl: row.icon_url,
    iconPosition: row.icon_position,
    iconSize: row.icon_size,
    titleFontSize: row.font_size,
    textColor: row.text_color,
    cardBackgroundColor: row.card_background,
    cardBorderColor: row.card_border_color,
    cardRadius: row.card_radius,
    sortOrder: row.sort_order,
    status: row.status
  }, index);
}

async function readHomepageWhyShopSettings() {
  await ensureWhyShopTables();
  const rows = await query(`SELECT * FROM ${whyShopSettingsTableName} WHERE id = 1 LIMIT 1`);
  return rows[0] ? mapWhyShopSettingsRow(rows[0]) : DEFAULT_APP_SETTINGS.homepage.whyShopSettings;
}

async function readHomepageWhyShopItems({ includeDeleted = false } = {}) {
  await ensureWhyShopTables();
  const rows = await query(
    `SELECT * FROM ${whyShopItemsTableName}
     ${includeDeleted ? "" : "WHERE deleted_at IS NULL"}
     ORDER BY sort_order ASC, created_at ASC`
  );

  if (!rows.length && !includeDeleted) {
    return DEFAULT_APP_SETTINGS.homepage.whyShopItems.map(normalizeWhyShopItemPayload);
  }

  return rows.map(mapWhyShopItemRow);
}

async function writeHomepageWhyShopSettings(settings = DEFAULT_APP_SETTINGS.homepage.whyShopSettings) {
  await ensureWhyShopTables();
  const normalized = normalizeHomepageSectionSettings(settings, DEFAULT_APP_SETTINGS.homepage.whyShopSettings, ".avyona-why-shop");
  await query(
    `INSERT INTO ${whyShopSettingsTableName}
      (id, section_enabled, section_title, section_subtitle, cards_per_row, mobile_cards_per_row, section_sort_order, background_color, text_color, custom_css)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      section_enabled = VALUES(section_enabled),
      section_title = VALUES(section_title),
      section_subtitle = VALUES(section_subtitle),
      cards_per_row = VALUES(cards_per_row),
      mobile_cards_per_row = VALUES(mobile_cards_per_row),
      section_sort_order = VALUES(section_sort_order),
      background_color = VALUES(background_color),
      text_color = VALUES(text_color),
      custom_css = VALUES(custom_css)`,
    [
      normalized.enabled ? 1 : 0,
      normalized.title,
      normalized.subtitle,
      normalized.cardsPerRow,
      normalized.mobileCardsPerRow,
      normalized.sortOrder,
      normalized.backgroundColor,
      normalized.textColor,
      normalized.customCss || null
    ]
  );
  return normalized;
}

async function replaceHomepageWhyShopItems(items = DEFAULT_APP_SETTINGS.homepage.whyShopItems) {
  await ensureWhyShopTables();
  const normalizedItems = (Array.isArray(items) && items.length ? items : DEFAULT_APP_SETTINGS.homepage.whyShopItems)
    .map(normalizeWhyShopItemPayload)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    .map((item, index) => ({ ...item, sortOrder: index + 1 }));
  const activeIds = normalizedItems.map((item) => item.id);

  if (activeIds.length) {
    await query(`UPDATE ${whyShopItemsTableName} SET deleted_at = NOW(), status = 'inactive' WHERE deleted_at IS NULL AND id NOT IN (?)`, [activeIds]);
  } else {
    await query(`UPDATE ${whyShopItemsTableName} SET deleted_at = NOW(), status = 'inactive' WHERE deleted_at IS NULL`);
  }

  for (const item of normalizedItems) {
    await query(
      `INSERT INTO ${whyShopItemsTableName}
        (id, title, icon_url, icon_position, icon_size, font_size, text_color, card_background, card_border_color, card_radius, sort_order, status, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
       ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        icon_url = VALUES(icon_url),
        icon_position = VALUES(icon_position),
        icon_size = VALUES(icon_size),
        font_size = VALUES(font_size),
        text_color = VALUES(text_color),
        card_background = VALUES(card_background),
        card_border_color = VALUES(card_border_color),
        card_radius = VALUES(card_radius),
        sort_order = VALUES(sort_order),
        status = VALUES(status),
        deleted_at = NULL`,
      [
        item.id,
        item.title,
        item.iconUrl || null,
        item.iconPosition,
        item.iconSize,
        item.titleFontSize,
        item.textColor,
        item.cardBackgroundColor,
        item.cardBorderColor,
        item.cardRadius,
        item.sortOrder,
        item.status
      ]
    );
  }

  return normalizedItems;
}

function mapProductPaymentIconSettingsRow(row = {}) {
  const fallback = DEFAULT_APP_SETTINGS.homepage.productPaymentIconsSettings;
  return normalizeHomepageSectionSettings({
    enabled: row.section_enabled !== undefined ? Boolean(row.section_enabled) : fallback.enabled,
    title: row.section_title ?? fallback.title,
    subtitle: row.section_subtitle ?? fallback.subtitle,
    cardsPerRow: row.icons_per_row ?? fallback.cardsPerRow,
    mobileCardsPerRow: row.mobile_icons_per_row ?? fallback.mobileCardsPerRow,
    sortOrder: row.sort_order ?? fallback.sortOrder,
    backgroundColor: row.background_color ?? fallback.backgroundColor,
    textColor: row.text_color ?? fallback.textColor,
    customCss: row.custom_css ?? fallback.customCss
  }, fallback, ".avyona-product-payment-icons");
}

function mapProductPaymentIconRow(row = {}, index = 0) {
  return normalizeProductPaymentIconPayload({
    id: row.id,
    paymentName: row.payment_name,
    iconUrl: row.icon_url,
    altText: row.icon_alt_text,
    iconSize: row.icon_size,
    iconBackgroundColor: row.icon_background_color,
    iconBorderColor: row.icon_border_color,
    iconRadius: row.icon_radius,
    sortOrder: row.sort_order,
    status: row.status
  }, index);
}

async function readProductPaymentIconSettings() {
  await ensureProductPaymentIconTables();
  const rows = await query(`SELECT * FROM ${productPaymentIconSettingsTableName} WHERE id = 1 LIMIT 1`);
  return rows[0] ? mapProductPaymentIconSettingsRow(rows[0]) : DEFAULT_APP_SETTINGS.homepage.productPaymentIconsSettings;
}

async function readProductPaymentIcons({ includeDeleted = false } = {}) {
  await ensureProductPaymentIconTables();
  const rows = await query(
    `SELECT * FROM ${productPaymentIconsTableName}
     ${includeDeleted ? "" : "WHERE deleted_at IS NULL"}
     ORDER BY sort_order ASC, created_at ASC`
  );

  if (!rows.length && !includeDeleted) {
    return DEFAULT_APP_SETTINGS.homepage.productPaymentIcons.map(normalizeProductPaymentIconPayload);
  }

  return rows.map(mapProductPaymentIconRow);
}

async function writeProductPaymentIconSettings(settings = DEFAULT_APP_SETTINGS.homepage.productPaymentIconsSettings) {
  await ensureProductPaymentIconTables();
  const normalized = normalizeHomepageSectionSettings(
    settings,
    DEFAULT_APP_SETTINGS.homepage.productPaymentIconsSettings,
    ".avyona-product-payment-icons"
  );
  await query(
    `INSERT INTO ${productPaymentIconSettingsTableName}
      (id, section_enabled, section_title, section_subtitle, icons_per_row, mobile_icons_per_row, sort_order, background_color, text_color, custom_css)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      section_enabled = VALUES(section_enabled),
      section_title = VALUES(section_title),
      section_subtitle = VALUES(section_subtitle),
      icons_per_row = VALUES(icons_per_row),
      mobile_icons_per_row = VALUES(mobile_icons_per_row),
      sort_order = VALUES(sort_order),
      background_color = VALUES(background_color),
      text_color = VALUES(text_color),
      custom_css = VALUES(custom_css)`,
    [
      normalized.enabled ? 1 : 0,
      normalized.title,
      normalized.subtitle,
      normalized.cardsPerRow,
      normalized.mobileCardsPerRow,
      normalized.sortOrder,
      normalized.backgroundColor,
      normalized.textColor,
      normalized.customCss || null
    ]
  );
  return normalized;
}

async function replaceProductPaymentIcons(items = DEFAULT_APP_SETTINGS.homepage.productPaymentIcons) {
  await ensureProductPaymentIconTables();
  const sourceItems = Array.isArray(items) ? items : DEFAULT_APP_SETTINGS.homepage.productPaymentIcons;
  const normalizedItems = sourceItems
    .map(normalizeProductPaymentIconPayload)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    .map((item, index) => ({ ...item, sortOrder: index + 1 }));
  const activeIds = normalizedItems.map((item) => item.id);

  if (activeIds.length) {
    await query(`UPDATE ${productPaymentIconsTableName} SET deleted_at = NOW(), status = 'inactive' WHERE deleted_at IS NULL AND id NOT IN (?)`, [activeIds]);
  } else {
    await query(`UPDATE ${productPaymentIconsTableName} SET deleted_at = NOW(), status = 'inactive' WHERE deleted_at IS NULL`);
  }

  for (const item of normalizedItems) {
    await query(
      `INSERT INTO ${productPaymentIconsTableName}
        (id, payment_name, icon_url, icon_alt_text, icon_size, icon_background_color, icon_border_color, icon_radius, sort_order, status, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
       ON DUPLICATE KEY UPDATE
        payment_name = VALUES(payment_name),
        icon_url = VALUES(icon_url),
        icon_alt_text = VALUES(icon_alt_text),
        icon_size = VALUES(icon_size),
        icon_background_color = VALUES(icon_background_color),
        icon_border_color = VALUES(icon_border_color),
        icon_radius = VALUES(icon_radius),
        sort_order = VALUES(sort_order),
        status = VALUES(status),
        deleted_at = NULL`,
      [
        item.id,
        item.paymentName,
        item.iconUrl || null,
        item.altText || null,
        item.iconSize,
        item.iconBackgroundColor,
        item.iconBorderColor,
        item.iconRadius,
        item.sortOrder,
        item.status
      ]
    );
  }

  return normalizedItems;
}

function createProductPaymentIconId(paymentName = "payment-icon") {
  const slug = String(paymentName || "payment-icon")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "payment-icon";
  return `payment-icon-${slug}-${Date.now()}`;
}

async function readProductPaymentIconData({ publicOnly = false } = {}) {
  const [settings, items] = await Promise.all([
    readProductPaymentIconSettings(),
    readProductPaymentIcons()
  ]);
  const sortedItems = items.sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
  const visibleItems = publicOnly ? sortedItems.filter((item) => item.status === "active") : sortedItems;
  const enabled = settings.enabled !== false && (!publicOnly || visibleItems.length > 0);

  return {
    settings: {
      ...settings,
      enabled
    },
    items: visibleItems
  };
}

export async function getAdminProductPaymentIcons(_request, response) {
  const data = await readProductPaymentIconData();
  response.json({ success: true, data });
}

export async function saveAdminProductPaymentIcons(request, response) {
  const settings = await writeProductPaymentIconSettings(request.body?.settings || {});
  const items = await replaceProductPaymentIcons(request.body?.items || []);

  response.json({
    success: true,
    message: "Product payment icons saved successfully",
    data: {
      settings,
      items
    }
  });
}

export async function updateAdminProductPaymentIconSettings(request, response) {
  const settings = await writeProductPaymentIconSettings(request.body || {});
  response.json({
    success: true,
    message: "Product payment icon settings saved successfully",
    data: settings
  });
}

export async function createAdminProductPaymentIconItem(request, response) {
  const currentItems = await readProductPaymentIcons();
  const sortOrder = Number(request.body?.sortOrder || 0) || Math.max(0, ...currentItems.map((item) => Number(item.sortOrder || 0))) + 1;
  const item = normalizeProductPaymentIconPayload({
    ...request.body,
    id: request.body?.id || createProductPaymentIconId(request.body?.paymentName),
    sortOrder
  }, currentItems.length);
  await replaceProductPaymentIcons([...currentItems, item]);

  response.status(201).json({
    success: true,
    message: "Product payment icon created successfully",
    data: item
  });
}

export async function updateAdminProductPaymentIconItem(request, response) {
  const itemId = String(request.params.id || "").trim();
  const currentItems = await readProductPaymentIcons();
  const existing = currentItems.find((item) => item.id === itemId);
  if (!existing) throw new ApiError(404, "Product payment icon not found");

  const updatedItem = normalizeProductPaymentIconPayload({ ...existing, ...request.body, id: itemId });
  const nextItems = currentItems.map((item) => item.id === itemId ? updatedItem : item);
  await replaceProductPaymentIcons(nextItems);

  response.json({
    success: true,
    message: "Product payment icon saved successfully",
    data: updatedItem
  });
}

export async function deleteAdminProductPaymentIconItem(request, response) {
  const itemId = String(request.params.id || "").trim();
  await ensureProductPaymentIconTables();
  const result = await query(`UPDATE ${productPaymentIconsTableName} SET deleted_at = NOW(), status = 'inactive' WHERE id = ? AND deleted_at IS NULL`, [itemId]);
  if (!result.affectedRows) throw new ApiError(404, "Product payment icon not found");

  response.json({
    success: true,
    message: "Product payment icon deleted successfully"
  });
}

export async function updateAdminProductPaymentIconItemStatus(request, response) {
  const itemId = String(request.params.id || "").trim();
  const status = String(request.body?.status || "").toLowerCase();
  if (!["active", "inactive"].includes(status)) throw new ApiError(400, "Status must be active or inactive");

  const currentItems = await readProductPaymentIcons();
  const existing = currentItems.find((item) => item.id === itemId);
  if (!existing) throw new ApiError(404, "Product payment icon not found");
  const updatedItem = { ...existing, status };
  await replaceProductPaymentIcons(currentItems.map((item) => item.id === itemId ? updatedItem : item));

  response.json({
    success: true,
    message: "Product payment icon status updated successfully",
    data: updatedItem
  });
}

export async function reorderAdminProductPaymentIconItems(request, response) {
  const orderedIds = Array.isArray(request.body?.orderedIds) ? request.body.orderedIds.map(String) : [];
  if (!orderedIds.length) throw new ApiError(400, "orderedIds is required");

  const currentItems = await readProductPaymentIcons();
  const itemById = new Map(currentItems.map((item) => [item.id, item]));
  const unknownIds = orderedIds.filter((id) => !itemById.has(id));
  if (unknownIds.length) throw new ApiError(400, `Unknown product payment icon id: ${unknownIds[0]}`);

  const orderedItems = [
    ...orderedIds.map((id, index) => ({ ...itemById.get(id), sortOrder: index + 1 })),
    ...currentItems
      .filter((item) => !orderedIds.includes(item.id))
      .map((item, index) => ({ ...item, sortOrder: orderedIds.length + index + 1 }))
  ];
  const savedItems = await replaceProductPaymentIcons(orderedItems);

  response.json({
    success: true,
    message: "Product payment icons reordered successfully",
    data: savedItems
  });
}

export async function getPublicProductPaymentIcons(_request, response) {
  const data = await readProductPaymentIconData({ publicOnly: true });
  if (!data.settings.enabled || !data.items.length) {
    response.json({
      success: true,
      data: {
        enabled: false,
        items: []
      }
    });
    return;
  }

  response.json({
    success: true,
    data: {
      enabled: true,
      section: data.settings,
      items: data.items
    }
  });
}

function createWhyShopItemId(title = "trust-badge") {
  const slug = String(title || "trust-badge")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "trust-badge";
  return `why-shop-${slug}-${Date.now()}`;
}

async function readHomepageWhyShopData({ publicOnly = false } = {}) {
  const [settings, items] = await Promise.all([
    readHomepageWhyShopSettings(),
    readHomepageWhyShopItems()
  ]);
  const sortedItems = items.sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
  const visibleItems = publicOnly ? sortedItems.filter((item) => item.status === "active") : sortedItems;
  const enabled = settings.enabled !== false && (!publicOnly || visibleItems.length > 0);

  return {
    settings: {
      ...settings,
      enabled
    },
    items: visibleItems
  };
}

export async function getAdminWhyShop(_request, response) {
  const data = await readHomepageWhyShopData();
  response.json({ success: true, data });
}

export async function updateAdminWhyShopSettings(request, response) {
  const settings = await writeHomepageWhyShopSettings(request.body || {});
  response.json({
    success: true,
    message: "Why Shop settings saved successfully",
    data: settings
  });
}

export async function createAdminWhyShopItem(request, response) {
  const currentItems = await readHomepageWhyShopItems();
  const sortOrder = Number(request.body?.sortOrder || 0) || Math.max(0, ...currentItems.map((item) => Number(item.sortOrder || 0))) + 1;
  const item = normalizeWhyShopItemPayload({
    ...request.body,
    id: request.body?.id || createWhyShopItemId(request.body?.title),
    sortOrder
  }, currentItems.length);
  await replaceHomepageWhyShopItems([...currentItems, item]);

  response.status(201).json({
    success: true,
    message: "Why Shop item created successfully",
    data: item
  });
}

export async function updateAdminWhyShopItem(request, response) {
  const itemId = String(request.params.id || "").trim();
  const currentItems = await readHomepageWhyShopItems();
  const existing = currentItems.find((item) => item.id === itemId);
  if (!existing) throw new ApiError(404, "Why Shop item not found");

  const updatedItem = normalizeWhyShopItemPayload({ ...existing, ...request.body, id: itemId });
  const nextItems = currentItems.map((item) => item.id === itemId ? updatedItem : item);
  await replaceHomepageWhyShopItems(nextItems);

  response.json({
    success: true,
    message: "Why Shop item saved successfully",
    data: updatedItem
  });
}

export async function deleteAdminWhyShopItem(request, response) {
  const itemId = String(request.params.id || "").trim();
  await ensureWhyShopTables();
  const result = await query(`UPDATE ${whyShopItemsTableName} SET deleted_at = NOW(), status = 'inactive' WHERE id = ? AND deleted_at IS NULL`, [itemId]);
  if (!result.affectedRows) throw new ApiError(404, "Why Shop item not found");

  response.json({
    success: true,
    message: "Why Shop item deleted successfully"
  });
}

export async function updateAdminWhyShopItemStatus(request, response) {
  const itemId = String(request.params.id || "").trim();
  const status = String(request.body?.status || "").toLowerCase();
  if (!["active", "inactive"].includes(status)) throw new ApiError(400, "Status must be active or inactive");

  const currentItems = await readHomepageWhyShopItems();
  const existing = currentItems.find((item) => item.id === itemId);
  if (!existing) throw new ApiError(404, "Why Shop item not found");
  const updatedItem = { ...existing, status };
  await replaceHomepageWhyShopItems(currentItems.map((item) => item.id === itemId ? updatedItem : item));

  response.json({
    success: true,
    message: "Why Shop item status updated successfully",
    data: updatedItem
  });
}

export async function reorderAdminWhyShopItems(request, response) {
  const orderedIds = Array.isArray(request.body?.orderedIds) ? request.body.orderedIds.map(String) : [];
  if (!orderedIds.length) throw new ApiError(400, "orderedIds is required");

  const currentItems = await readHomepageWhyShopItems();
  const itemById = new Map(currentItems.map((item) => [item.id, item]));
  const unknownIds = orderedIds.filter((id) => !itemById.has(id));
  if (unknownIds.length) throw new ApiError(400, `Unknown Why Shop item id: ${unknownIds[0]}`);

  const orderedItems = [
    ...orderedIds.map((id, index) => ({ ...itemById.get(id), sortOrder: index + 1 })),
    ...currentItems
      .filter((item) => !orderedIds.includes(item.id))
      .map((item, index) => ({ ...item, sortOrder: orderedIds.length + index + 1 }))
  ];
  const savedItems = await replaceHomepageWhyShopItems(orderedItems);

  response.json({
    success: true,
    message: "Why Shop items reordered successfully",
    data: savedItems
  });
}

export async function getPublicWhyShop(_request, response) {
  const data = await readHomepageWhyShopData({ publicOnly: true });
  if (!data.settings.enabled || !data.items.length) {
    response.json({
      success: true,
      data: {
        enabled: false,
        items: []
      }
    });
    return;
  }

  response.json({
    success: true,
    data: {
      enabled: true,
      section: data.settings,
      items: data.items
    }
  });
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
    const [whyShopSettings, whyShopItems, productPaymentIconsSettings, productPaymentIcons] = await Promise.all([
      readHomepageWhyShopSettings(),
      readHomepageWhyShopItems(),
      readProductPaymentIconSettings(),
      readProductPaymentIcons()
    ]);
    return mergeSettings(themeSettings ? { theme: themeSettings } : {}, {
      homepage: { whyShopSettings, whyShopItems, productPaymentIconsSettings, productPaymentIcons }
    });
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

  const [whyShopSettings, whyShopItems, productPaymentIconsSettings, productPaymentIcons] = await Promise.all([
    readHomepageWhyShopSettings(),
    readHomepageWhyShopItems(),
    readProductPaymentIconSettings(),
    readProductPaymentIcons()
  ]);
  settings.homepage = {
    ...(settings.homepage || {}),
    whyShopSettings,
    whyShopItems,
    productPaymentIconsSettings,
    productPaymentIcons
  };

  return settings;
}

async function writeStoredSettings(settings) {
  await createKeyValueSettingsTable();
  await ensureThemeSettingsTable();
  const productPaymentIconsSettings = settings.homepage?.productPaymentIconsSettings;
  if (productPaymentIconsSettings?.customCss) {
    validateCustomCssValue(productPaymentIconsSettings.customCss, ".avyona-product-payment-icons");
  }
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
  await Promise.all([
    writeHomepageWhyShopSettings(settings.homepage?.whyShopSettings || DEFAULT_APP_SETTINGS.homepage.whyShopSettings),
    replaceHomepageWhyShopItems(settings.homepage?.whyShopItems || DEFAULT_APP_SETTINGS.homepage.whyShopItems),
    writeProductPaymentIconSettings(settings.homepage?.productPaymentIconsSettings || DEFAULT_APP_SETTINGS.homepage.productPaymentIconsSettings),
    replaceProductPaymentIcons(settings.homepage?.productPaymentIcons || DEFAULT_APP_SETTINGS.homepage.productPaymentIcons)
  ]);
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
    : normalizeHomepageSectionSettings(
      request.body || {},
      DEFAULT_APP_SETTINGS.homepage[settingsKey],
      homepageSectionCssScopeBySettingsKey[settingsKey] || ".avyona-why-shop"
    );
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
