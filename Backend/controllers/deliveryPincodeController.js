import { pool, query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";
import { readTabularBuffer, SUPPORTED_TABULAR_FORMAT_LABEL } from "../utils/tabularImport.js";

const VALID_STATUSES = new Set(["active", "inactive"]);
const VALID_IMPORT_MODES = new Set(["update", "skip", "replace"]);
const VALID_BULK_ACTIONS = new Set(["activate", "deactivate", "delete", "cod_yes", "cod_no"]);
const MESSAGE_TEMPLATE_KEYS = {
  availableCod: "delivery_pincodes__available_cod_template",
  availableNoCod: "delivery_pincodes__available_no_cod_template",
  unavailable: "delivery_pincodes__unavailable_template"
};
const DEFAULT_MESSAGE_TEMPLATES = {
  availableCod: "Delivery Available for {pincode} ({state}). Cash on Delivery Available. Estimated delivery: {delivery_time}.",
  availableNoCod: "Delivery Available for {pincode} ({state}). Cash on Delivery Not Available. Estimated delivery: {delivery_time}.",
  unavailable: "Delivery Unavailable for {pincode}."
};

function actorFrom(request) {
  return {
    id: request.admin?.id || null,
    name: request.admin?.fullName || request.admin?.email || "Unknown admin"
  };
}

function normalizeBoolean(value, fieldName = "COD Available") {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (value === true || value === 1 || ["yes", "y", "1", "true", "available", "enabled"].includes(normalized)) return 1;
  if (value === false || value === 0 || ["no", "n", "0", "false", "unavailable", "disabled"].includes(normalized)) return 0;
  throw new ApiError(400, `${fieldName} must be Yes or No`);
}

function normalizePayload(source = {}) {
  const state = String(source.state || "").trim();
  const pincode = String(source.pincode ?? "").trim().replace(/\.0+$/, "");
  const rawStatus = String(source.status || "active").trim().toLowerCase();
  const status = rawStatus === "enabled" ? "active" : rawStatus === "disabled" ? "inactive" : rawStatus;

  if (!state) throw new ApiError(400, "State is required");
  if (!/^\d{6}$/.test(pincode)) throw new ApiError(400, "Pincode must contain exactly 6 digits");
  if (!VALID_STATUSES.has(status)) throw new ApiError(400, "Status must be active or inactive");

  return {
    state,
    pincode,
    codAvailable: normalizeBoolean(source.codAvailable ?? source.cod_available),
    status
  };
}

function mapRow(row) {
  return {
    id: Number(row.id),
    state: row.state,
    pincode: row.pincode,
    codAvailable: Boolean(row.codAvailable),
    status: row.status,
    createdBy: row.createdBy || "Unknown admin",
    updatedBy: row.updatedBy || "Unknown admin",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

const SELECT_COLUMNS = `
  dp.id,
  dp.state,
  dp.pincode,
  dp.cod_available AS codAvailable,
  dp.status,
  COALESCE(ca.full_name, dp.created_by_name) AS createdBy,
  COALESCE(ua.full_name, dp.updated_by_name) AS updatedBy,
  dp.created_at AS createdAt,
  dp.updated_at AS updatedAt
`;

async function getById(id) {
  const rows = await query(
    `SELECT ${SELECT_COLUMNS}
     FROM delivery_pincodes dp
     LEFT JOIN admins ca ON ca.id = dp.created_by
     LEFT JOIN admins ua ON ua.id = dp.updated_by
     WHERE dp.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

async function getMessageTemplates() {
  const keys = Object.values(MESSAGE_TEMPLATE_KEYS);
  const placeholders = keys.map(() => "?").join(", ");
  const rows = await query(
    `SELECT setting_key AS settingKey, setting_value AS settingValue
     FROM app_settings WHERE setting_key IN (${placeholders})`,
    keys
  );
  const values = Object.fromEntries(rows.map((row) => [row.settingKey, row.settingValue]));

  return Object.fromEntries(
    Object.entries(MESSAGE_TEMPLATE_KEYS).map(([name, key]) => [
      name,
      String(values[key] || DEFAULT_MESSAGE_TEMPLATES[name])
    ])
  );
}

export async function getDeliveryPincodeMessageSettings(_request, response) {
  response.json({
    success: true,
    data: await getMessageTemplates(),
    placeholders: ["{pincode}", "{state}", "{delivery_time}"]
  });
}

export async function updateDeliveryPincodeMessageSettings(request, response) {
  const templates = {};
  Object.keys(MESSAGE_TEMPLATE_KEYS).forEach((name) => {
    const value = String(request.body?.[name] || "").trim();
    if (!value) throw new ApiError(400, "All delivery message templates are required");
    if (value.length > 1000) throw new ApiError(400, "Each delivery message template must be 1,000 characters or less");
    templates[name] = value;
  });

  for (const [name, key] of Object.entries(MESSAGE_TEMPLATE_KEYS)) {
    await query(
      `INSERT INTO app_settings (setting_key, setting_value, setting_group)
       VALUES (?, ?, 'delivery_pincodes')
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_group = VALUES(setting_group)`,
      [key, templates[name]]
    );
  }

  response.json({ success: true, data: await getMessageTemplates() });
}

export async function listDeliveryPincodes(request, response) {
  const search = String(request.query.search || "").trim();
  const cod = String(request.query.cod || "").trim().toLowerCase();
  const status = String(request.query.status || "").trim().toLowerCase();
  const where = [];
  const values = [];

  if (search) {
    where.push("(dp.pincode LIKE ? OR dp.state LIKE ?)");
    values.push(`%${search}%`, `%${search}%`);
  }
  if (cod === "yes" || cod === "no") {
    where.push("dp.cod_available = ?");
    values.push(cod === "yes" ? 1 : 0);
  }
  if (VALID_STATUSES.has(status)) {
    where.push("dp.status = ?");
    values.push(status);
  }

  const rows = await query(
    `SELECT ${SELECT_COLUMNS}
     FROM delivery_pincodes dp
     LEFT JOIN admins ca ON ca.id = dp.created_by
     LEFT JOIN admins ua ON ua.id = dp.updated_by
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY dp.updated_at DESC, dp.id DESC`,
    values
  );

  response.json({ success: true, data: rows.map(mapRow) });
}

export async function createDeliveryPincode(request, response) {
  const payload = normalizePayload(request.body);
  const actor = actorFrom(request);

  try {
    const result = await query(
      `INSERT INTO delivery_pincodes
       (state, pincode, cod_available, status, created_by, updated_by, created_by_name, updated_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [payload.state, payload.pincode, payload.codAvailable, payload.status, actor.id, actor.id, actor.name, actor.name]
    );
    response.status(201).json({ success: true, data: await getById(result.insertId) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") throw new ApiError(409, "This pincode already exists");
    throw error;
  }
}

export async function updateDeliveryPincode(request, response) {
  const payload = normalizePayload(request.body);
  const actor = actorFrom(request);

  try {
    const result = await query(
      `UPDATE delivery_pincodes
       SET state = ?, pincode = ?, cod_available = ?, status = ?,
           updated_by = ?, updated_by_name = ?
       WHERE id = ?`,
      [payload.state, payload.pincode, payload.codAvailable, payload.status, actor.id, actor.name, request.params.id]
    );
    if (!result.affectedRows) throw new ApiError(404, "Delivery pincode not found");
    response.json({ success: true, data: await getById(request.params.id) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") throw new ApiError(409, "This pincode already exists");
    throw error;
  }
}

export async function updateDeliveryPincodeStatus(request, response) {
  const status = String(request.body?.status || "").trim().toLowerCase();
  if (!VALID_STATUSES.has(status)) throw new ApiError(400, "Status must be active or inactive");
  const actor = actorFrom(request);
  const result = await query(
    "UPDATE delivery_pincodes SET status = ?, updated_by = ?, updated_by_name = ? WHERE id = ?",
    [status, actor.id, actor.name, request.params.id]
  );
  if (!result.affectedRows) throw new ApiError(404, "Delivery pincode not found");
  response.json({ success: true, data: await getById(request.params.id) });
}

export async function deleteDeliveryPincode(request, response) {
  const result = await query("DELETE FROM delivery_pincodes WHERE id = ?", [request.params.id]);
  if (!result.affectedRows) throw new ApiError(404, "Delivery pincode not found");
  response.json({ success: true, message: "Delivery pincode deleted" });
}

export async function bulkUpdateDeliveryPincodes(request, response) {
  const ids = [...new Set((Array.isArray(request.body?.ids) ? request.body.ids : []).map(Number).filter(Number.isInteger))];
  const action = String(request.body?.action || "").trim().toLowerCase();
  if (!ids.length) throw new ApiError(400, "Select at least one pincode");
  if (!VALID_BULK_ACTIONS.has(action)) throw new ApiError(400, "Invalid bulk action");

  const placeholders = ids.map(() => "?").join(", ");
  if (action === "delete") {
    const result = await query(`DELETE FROM delivery_pincodes WHERE id IN (${placeholders})`, ids);
    response.json({ success: true, affectedRows: result.affectedRows });
    return;
  }

  const actor = actorFrom(request);
  const field = action.startsWith("cod_") ? "cod_available" : "status";
  const value = action === "activate" ? "active" : action === "deactivate" ? "inactive" : action === "cod_yes" ? 1 : 0;
  const result = await query(
    `UPDATE delivery_pincodes SET ${field} = ?, updated_by = ?, updated_by_name = ? WHERE id IN (${placeholders})`,
    [value, actor.id, actor.name, ...ids]
  );
  response.json({ success: true, affectedRows: result.affectedRows });
}

function getPincodeFixGuidance(message) {
  if (message === "State is required") return "Enter the state name in the State column.";
  if (message.includes("exactly 6 digits")) return "Format Pincode as six digits, for example 500084. Remove spaces, letters, and decimal values.";
  if (message.includes("COD Available")) return "Use Yes or No in the COD Available column.";
  if (message.includes("Status")) return "Use Active or Inactive in the Status column.";
  return "Correct this row using the downloaded delivery pincode template and upload it again.";
}

function readImportRows(buffer, fileName) {
  const rawRows = readTabularBuffer(buffer, fileName);
  const nonEmptyRows = rawRows.filter((row) => Object.values(row).some((value) => String(value ?? "").trim()));
  const validRows = [];
  const failedRows = [];

  nonEmptyRows.forEach((raw, index) => {
    const normalized = Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [String(key).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"), value])
    );
    const source = {
      state: normalized.state ?? normalized.state_name ?? normalized.region,
      pincode: normalized.pincode ?? normalized.pin_code ?? normalized.postal_code ?? normalized.zip_code ?? normalized.zip,
      codAvailable: normalized.cod_available ?? normalized.cod ?? normalized.cash_on_delivery ?? normalized.cod_status,
      status: normalized.status ?? normalized.delivery_status ?? "active"
    };
    const errors = [];
    const state = String(source.state || "").trim();
    const pincode = String(source.pincode ?? "").trim().replace(/\.0+$/, "");
    const rawStatus = String(source.status || "active").trim().toLowerCase();
    const status = rawStatus === "enabled" ? "active" : rawStatus === "disabled" ? "inactive" : rawStatus;
    let codAvailable = null;

    if (!state) errors.push("State is required");
    if (!/^\d{6}$/.test(pincode)) errors.push("Pincode must contain exactly 6 digits");
    if (!VALID_STATUSES.has(status)) errors.push("Status must be active or inactive");
    try {
      codAvailable = normalizeBoolean(source.codAvailable);
    } catch (error) {
      errors.push(error.message);
    }

    if (!errors.length) {
      validRows.push({
        rowNumber: index + 2,
        data: { state, pincode, codAvailable, status }
      });
    } else {
      failedRows.push({
        rowNumber: index + 2,
        pincode,
        reason: errors.join("; "),
        howToFix: [...new Set(errors.map(getPincodeFixGuidance))].join(" "),
        row: raw
      });
    }
  });

  return { validRows, failedRows, totalRows: nonEmptyRows.length };
}

export async function importDeliveryPincodes(request, response) {
  if (!request.file?.buffer) {
    throw new ApiError(400, `Delivery pincode file is required. Supported formats: ${SUPPORTED_TABULAR_FORMAT_LABEL}.`);
  }
  const mode = String(request.body?.mode || "").trim().toLowerCase();
  if (!VALID_IMPORT_MODES.has(mode)) throw new ApiError(400, "Import mode must be update, skip, or replace");

  const parsed = readImportRows(request.file.buffer, request.file.originalname);
  if (!parsed.totalRows) {
    throw new ApiError(
      400,
      "The uploaded file has no delivery pincode rows.",
      { howToFix: "Add a header row and at least one data row using the downloaded template." }
    );
  }
  if (mode === "replace" && parsed.failedRows.length) {
    throw new ApiError(
      400,
      "Replace all was cancelled because the uploaded file contains invalid rows.",
      {
        howToFix: "Fix every failed row before using Replace All, or use Update/Skip mode to import only valid rows.",
        failedRows: parsed.failedRows
      }
    );
  }
  const rows = parsed.validRows;
  if (!rows.length) {
    throw new ApiError(
      400,
      "No valid delivery pincode rows were found.",
      { failedRows: parsed.failedRows }
    );
  }
  const actor = actorFrom(request);
  const connection = await pool.getConnection();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  try {
    await connection.beginTransaction();
    if (mode === "replace") await connection.query("DELETE FROM delivery_pincodes");

    for (const item of rows) {
      const row = item.data;
      const [existing] = await connection.query("SELECT id FROM delivery_pincodes WHERE pincode = ? LIMIT 1", [row.pincode]);
      if (existing.length && mode === "skip") {
        skipped += 1;
        continue;
      }

      if (existing.length) {
        await connection.query(
          `UPDATE delivery_pincodes
           SET state = ?, cod_available = ?, status = ?, updated_by = ?, updated_by_name = ?
           WHERE id = ?`,
          [row.state, row.codAvailable, row.status, actor.id, actor.name, existing[0].id]
        );
        updated += 1;
      } else {
        await connection.query(
          `INSERT INTO delivery_pincodes
           (state, pincode, cod_available, status, created_by, updated_by, created_by_name, updated_by_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [row.state, row.pincode, row.codAvailable, row.status, actor.id, actor.id, actor.name, actor.name]
        );
        inserted += 1;
      }
    }

    await connection.commit();
    response.json({
      success: true,
      data: {
        total: parsed.totalRows,
        validRows: parsed.validRows.length,
        failedRows: parsed.failedRows.length,
        failedRowDetails: parsed.failedRows,
        inserted,
        updated,
        skipped,
        mode
      }
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function checkDeliveryPincode(request, response) {
  const pincode = String(request.params.pincode || "").trim();
  if (!/^\d{6}$/.test(pincode)) throw new ApiError(400, "Pincode must contain exactly 6 digits");

  const rows = await query(
    "SELECT state, pincode, cod_available AS codAvailable, status FROM delivery_pincodes WHERE pincode = ? LIMIT 1",
    [pincode]
  );
  const row = rows[0];
  const available = Boolean(row && row.status === "active");
  const messageTemplates = await getMessageTemplates();

  response.json({
    success: true,
    data: {
      pincode,
      state: row?.state || "",
      available,
      codAvailable: available && Boolean(row?.codAvailable),
      status: row?.status || "unavailable"
    },
    messageTemplates
  });
}
