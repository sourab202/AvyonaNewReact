import { query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";
import { DEFAULT_APP_SETTINGS, getPublicSettings, mergeSettings } from "../../shared/appSettings.js";

const settingsTableName = "app_settings";
const legacySettingsTableName = "app_settings_legacy_json";
const footerSettingsTableName = "footer_settings";
const footerItemsTableName = "footer_items";
const faviconMaxSizeBytes = 1 * 1024 * 1024;
let appSettingsTableReady = false;
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
  const rows = await query(
    `SELECT setting_key AS settingKey, setting_value AS settingValue
     FROM ${settingsTableName}`
  );

  if (!rows.length) {
    return null;
  }

  const settings = {};
  rows.forEach((row) => {
    const path = getSettingKeyPath(row.settingKey);
    const fallbackValue = getNestedValue(DEFAULT_APP_SETTINGS, path);
    setNestedValue(settings, path, parseSettingValue(row.settingValue, fallbackValue));
  });

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

  await writeStoredFooterSettings(settings.footer || DEFAULT_APP_SETTINGS.footer);
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
