import { query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";
import { DEFAULT_APP_SETTINGS } from "../shared/appSettings.js";

const footerSettingsTableName = "footer_settings";
const footerItemsTableName = "footer_items";
let footerTablesReady = false;

const allowedFooterAssetTypes = new Set([
  "footer-logo",
  "footer-watermark",
  "footer-social-icon",
  "footer-payment-icon"
]);
const allowedFooterItemTypes = new Set(["quick_link", "faq", "policy", "social", "payment"]);
const footerListKeyByType = {
  quick_link: "quickLinks",
  faq: "faqLinks",
  policy: "policyLinks",
  social: "socialLinks",
  payment: "paymentIcons"
};

function serializeValue(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function parseValue(rawValue, fallbackValue) {
  if (typeof fallbackValue === "boolean") return String(rawValue) === "true";
  if (typeof fallbackValue === "number") {
    const number = Number(rawValue);
    return Number.isFinite(number) ? number : fallbackValue;
  }
  if (Array.isArray(fallbackValue) || (fallbackValue && typeof fallbackValue === "object")) {
    try {
      return JSON.parse(rawValue || (Array.isArray(fallbackValue) ? "[]" : "{}"));
    } catch {
      return fallbackValue;
    }
  }
  return String(rawValue ?? "");
}

async function ensureFooterTables() {
  if (footerTablesReady) return;

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

  footerTablesReady = true;
}

function normalizeItemType(value) {
  const itemType = String(value || "").trim().toLowerCase();
  if (!allowedFooterItemTypes.has(itemType)) {
    throw new ApiError(400, "Invalid footer item type");
  }
  return itemType;
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase() === "inactive" ? "inactive" : "active";
}

function parseMetadataJson(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function getDefaultFaqAnswer(item = {}) {
  const defaults = DEFAULT_APP_SETTINGS.footer?.faqLinks || [];
  const match = defaults.find((link) => (
    link.id === item.itemUid || link.questionText === item.questionText
  ));
  return match?.answer || "";
}

function normalizeFooterItemPayload(payload = {}, fallback = {}) {
  const itemType = normalizeItemType(payload.itemType ?? payload.item_type ?? fallback.itemType);
  const sortOrder = Number(payload.sortOrder ?? payload.sort_order ?? fallback.sortOrder ?? 0);
  const fallbackMetadata = parseMetadataJson(fallback.metadataJson);
  const payloadMetadata = parseMetadataJson(payload.metadataJson ?? payload.metadata_json);
  const answer = payload.answer === undefined
    ? fallbackMetadata.answer
    : String(payload.answer || "").trim();
  const metadataJson = itemType === "faq"
    ? { ...fallbackMetadata, ...payloadMetadata, answer: answer || "" }
    : (payload.metadataJson ?? payload.metadata_json ?? fallback.metadataJson ?? null);

  return {
    itemUid: String(payload.itemUid ?? payload.item_uid ?? payload.id ?? fallback.itemUid ?? `${itemType}-${Date.now()}`).trim(),
    itemType,
    label: payload.label === undefined ? fallback.label ?? null : String(payload.label || "").trim(),
    questionText: payload.questionText === undefined && payload.question_text === undefined
      ? fallback.questionText ?? null
      : String(payload.questionText ?? payload.question_text ?? "").trim(),
    name: payload.name === undefined ? fallback.name ?? null : String(payload.name || "").trim(),
    url: payload.url === undefined ? fallback.url ?? null : String(payload.url || "").trim(),
    iconUrl: payload.iconUrl === undefined && payload.icon_url === undefined && payload.icon === undefined
      ? fallback.iconUrl ?? null
      : String(payload.iconUrl ?? payload.icon_url ?? payload.icon ?? "").trim(),
    sortOrder: Number.isFinite(sortOrder) ? Math.floor(sortOrder) : Number(fallback.sortOrder || 0),
    status: normalizeStatus(payload.status ?? fallback.status),
    metadataJson
  };
}

function mapFooterItemRow(row) {
  const metadataJson = parseMetadataJson(row.metadataJson);
  return {
    id: Number(row.id),
    itemUid: row.itemUid,
    itemType: row.itemType,
    label: row.label || "",
    questionText: row.questionText || "",
    name: row.name || "",
    url: row.url || "",
    iconUrl: row.iconUrl || "",
    sortOrder: Number(row.sortOrder || 0),
    status: row.status === "inactive" ? "inactive" : "active",
    answer: metadataJson.answer || "",
    metadataJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function getFooterItemById(id) {
  const rows = await query(
    `SELECT
       id,
       item_uid AS itemUid,
       item_type AS itemType,
       label,
       question_text AS questionText,
       name,
       url,
       icon_url AS iconUrl,
       sort_order AS sortOrder,
       status,
       metadata_json AS metadataJson,
       created_at AS createdAt,
       updated_at AS updatedAt
     FROM ${footerItemsTableName}
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function fetchFooterItems(type = "") {
  await ensureFooterTables();
  const params = [];
  let where = "";
  if (type) {
    where = "WHERE item_type = ?";
    params.push(normalizeItemType(type));
  }
  const rows = await query(
    `SELECT
       id,
       item_uid AS itemUid,
       item_type AS itemType,
       label,
       question_text AS questionText,
       name,
       url,
       icon_url AS iconUrl,
       sort_order AS sortOrder,
       status,
       metadata_json AS metadataJson,
       created_at AS createdAt,
       updated_at AS updatedAt
     FROM ${footerItemsTableName}
     ${where}
     ORDER BY item_type ASC, sort_order ASC, id ASC`,
    params
  );
  return rows.map(mapFooterItemRow);
}

function groupFooterItems(items = []) {
  return items.reduce((groups, item) => {
    const key = footerListKeyByType[item.itemType] || item.itemType;
    const normalized = {
      id: item.itemUid,
      sortOrder: item.sortOrder,
      status: item.status
    };
    if (item.itemType === "quick_link" || item.itemType === "policy") {
      groups[key].push({ ...normalized, label: item.label, url: item.url });
    } else if (item.itemType === "faq") {
      groups[key].push({ ...normalized, questionText: item.questionText, answer: item.answer || getDefaultFaqAnswer(item), url: item.url });
    } else if (item.itemType === "social") {
      groups[key].push({ ...normalized, name: item.name, url: item.url, icon: item.iconUrl });
    } else if (item.itemType === "payment") {
      groups[key].push({ ...normalized, name: item.name, icon: item.iconUrl });
    }
    return groups;
  }, {
    quickLinks: [],
    faqLinks: [],
    policyLinks: [],
    socialLinks: [],
    paymentIcons: []
  });
}

async function upsertFooterSetting(group, key, value) {
  await query(
    `INSERT INTO ${footerSettingsTableName} (setting_key, setting_value, setting_group)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       setting_value = VALUES(setting_value),
       setting_group = VALUES(setting_group)`,
    [key, serializeValue(value), group]
  );
}

async function insertFooterItem(item) {
  const result = await query(
    `INSERT INTO ${footerItemsTableName}
      (item_uid, item_type, label, question_text, name, url, icon_url, sort_order, status, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      item.metadataJson ? JSON.stringify(item.metadataJson) : null
    ]
  );
  return Number(result.insertId);
}

async function updateFooterItemRow(id, item) {
  await query(
    `UPDATE ${footerItemsTableName}
     SET item_uid = ?,
         item_type = ?,
         label = ?,
         question_text = ?,
         name = ?,
         url = ?,
         icon_url = ?,
         sort_order = ?,
         status = ?,
         metadata_json = ?
     WHERE id = ?`,
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
      item.metadataJson ? JSON.stringify(item.metadataJson) : null,
      id
    ]
  );
}

async function fetchFooterSettings() {
  await ensureFooterTables();
  const rows = await query(
    `SELECT setting_key AS settingKey, setting_value AS settingValue, setting_group AS settingGroup
     FROM ${footerSettingsTableName}
     ORDER BY setting_group ASC, setting_key ASC`
  );
  const settings = {};
  rows.forEach((row) => {
    const group = row.settingGroup || "branding";
    const fallbackValue = DEFAULT_APP_SETTINGS.footer?.[group]?.[row.settingKey];
    settings[group] = {
      ...(settings[group] || {}),
      [row.settingKey]: parseValue(row.settingValue, fallbackValue)
    };
  });

  return {
    ...DEFAULT_APP_SETTINGS.footer,
    ...settings
  };
}

export async function getPublicFooter(_request, response) {
  const settings = await fetchFooterSettings();
  const items = await fetchFooterItems();
  const activeItems = items.filter((item) => item.status === "active");

  response.json({
    success: true,
    data: {
      ...settings,
      ...(items.length ? groupFooterItems(activeItems) : {})
    }
  });
}

export async function getAdminFooterSettings(_request, response) {
  const settings = await fetchFooterSettings();

  response.json({
    success: true,
    data: settings
  });
}

export async function updateAdminFooterSettings(request, response) {
  await ensureFooterTables();
  const payload = request.body?.settings || request.body || {};

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError(400, "A valid footer settings object is required");
  }

  const groups = ["branding", "support", "newsletter", "design"];
  for (const group of groups) {
    if (!payload[group] || typeof payload[group] !== "object" || Array.isArray(payload[group])) continue;
    for (const [key, value] of Object.entries(payload[group])) {
      await upsertFooterSetting(group, key, value);
    }
  }

  response.json({
    success: true,
    message: "Footer settings saved successfully",
    data: payload
  });
}

export async function getAdminFooterItems(request, response) {
  const items = await fetchFooterItems(String(request.query?.type || ""));

  response.json({
    success: true,
    data: {
      items,
      grouped: groupFooterItems(items)
    }
  });
}

export async function createAdminFooterItem(request, response) {
  await ensureFooterTables();
  const item = normalizeFooterItemPayload(request.body || {});
  const id = await insertFooterItem(item);
  const created = await getFooterItemById(id);

  response.status(201).json({
    success: true,
    message: "Footer item created successfully",
    data: mapFooterItemRow(created)
  });
}

export async function updateAdminFooterItem(request, response) {
  await ensureFooterTables();
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "A valid footer item id is required");
  const existing = await getFooterItemById(id);
  if (!existing) throw new ApiError(404, "Footer item not found");

  const item = normalizeFooterItemPayload(request.body || {}, existing);
  await updateFooterItemRow(id, item);
  const updated = await getFooterItemById(id);

  response.json({
    success: true,
    message: "Footer item updated successfully",
    data: mapFooterItemRow(updated)
  });
}

export async function deleteAdminFooterItem(request, response) {
  await ensureFooterTables();
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "A valid footer item id is required");
  const result = await query(`DELETE FROM ${footerItemsTableName} WHERE id = ?`, [id]);
  if (!result.affectedRows) throw new ApiError(404, "Footer item not found");

  response.json({
    success: true,
    message: "Footer item deleted successfully"
  });
}

export async function updateAdminFooterItemStatus(request, response) {
  await ensureFooterTables();
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "A valid footer item id is required");
  const status = normalizeStatus(request.body?.status);
  const result = await query(`UPDATE ${footerItemsTableName} SET status = ? WHERE id = ?`, [status, id]);
  if (!result.affectedRows) throw new ApiError(404, "Footer item not found");
  const updated = await getFooterItemById(id);

  response.json({
    success: true,
    message: "Footer item status updated successfully",
    data: mapFooterItemRow(updated)
  });
}

export async function reorderAdminFooterItems(request, response) {
  await ensureFooterTables();
  const entries = Array.isArray(request.body?.items)
    ? request.body.items
    : (Array.isArray(request.body?.ids) ? request.body.ids.map((id, index) => ({ id, sortOrder: index + 1 })) : []);

  if (!entries.length) {
    throw new ApiError(400, "Footer item reorder payload is required");
  }

  await Promise.all(entries.map((entry, index) => {
    const id = Number(entry.id);
    const sortOrder = Number.isFinite(Number(entry.sortOrder)) ? Math.floor(Number(entry.sortOrder)) : index + 1;
    if (!Number.isInteger(id) || id <= 0) return Promise.resolve();
    return query(`UPDATE ${footerItemsTableName} SET sort_order = ? WHERE id = ?`, [sortOrder, id]);
  }));

  const items = await fetchFooterItems(String(request.body?.type || ""));

  response.json({
    success: true,
    message: "Footer items reordered successfully",
    data: {
      items,
      grouped: groupFooterItems(items)
    }
  });
}

export async function uploadFooterImage(request, response) {
  if (!request.file) {
    throw new ApiError(400, "Footer image file is required");
  }

  const assetType = String(request.body?.assetType || request.query?.assetType || "").trim().toLowerCase();
  if (assetType && !allowedFooterAssetTypes.has(assetType)) {
    throw new ApiError(400, "Invalid footer image asset type");
  }

  response.status(201).json({
    success: true,
    data: {
      assetType: assetType || "footer-image",
      url: `/uploads/footer/${request.file.filename}`
    },
    url: `/uploads/footer/${request.file.filename}`
  });
}
