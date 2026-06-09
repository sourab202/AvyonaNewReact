import crypto from "node:crypto";
import { query } from "../config/db.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

const TABLE_NAME = "payment_gateway_settings";
const ENCRYPTION_VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const MASKED_SECRET = "••••••••••••";
const LEGACY_MASKED_SECRET = "********";
const DEFAULT_SETTINGS = Object.freeze({
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
  description: "Order Payment"
});

let tableReady = false;

function getEncryptionKey() {
  const configuredKey = String(env.paymentSettingsEncryptionKey || "").trim();
  const developmentFallback = env.nodeEnv !== "production" ? String(env.jwtSecret || "").trim() : "";
  const source = configuredKey || developmentFallback;

  if (source.length < 32) {
    throw new Error("PAYMENT_SETTINGS_ENCRYPTION_KEY must contain at least 32 characters");
  }

  return crypto.createHash("sha256").update(source, "utf8").digest();
}

export function encryptPaymentSecret(value) {
  const plaintext = String(value || "");
  if (!plaintext) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64")
  ].join(":");
}

export function decryptPaymentSecret(value) {
  const encrypted = String(value || "");
  if (!encrypted) return "";

  const [version, ivValue, authTagValue, ciphertextValue] = encrypted.split(":");
  if (version !== ENCRYPTION_VERSION || !ivValue || !authTagValue || !ciphertextValue) {
    throw new Error("Stored payment secret has an invalid encrypted format");
  }

  try {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getEncryptionKey(),
      Buffer.from(ivValue, "base64")
    );
    decipher.setAuthTag(Buffer.from(authTagValue, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    throw new Error("Stored payment secret could not be decrypted");
  }
}

export async function ensurePaymentSettingsTable() {
  if (tableReady) return;

  await query(
    `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
      provider VARCHAR(30) NOT NULL DEFAULT 'razorpay',
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      mode ENUM('test', 'live') NOT NULL DEFAULT 'test',
      test_key_id VARCHAR(255) NULL,
      test_key_secret_encrypted TEXT NULL,
      test_webhook_secret_encrypted TEXT NULL,
      live_key_id VARCHAR(255) NULL,
      live_key_secret_encrypted TEXT NULL,
      live_webhook_secret_encrypted TEXT NULL,
      currency CHAR(3) NOT NULL DEFAULT 'INR',
      button_text VARCHAR(80) NOT NULL DEFAULT 'Pay Now',
      description VARCHAR(180) NOT NULL DEFAULT 'Order Payment',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT chk_payment_gateway_settings_singleton CHECK (id = 1)
    )`
  );
  await query(
    `INSERT IGNORE INTO ${TABLE_NAME}
      (id, provider, enabled, mode, currency, button_text, description)
     VALUES (1, 'razorpay', 0, 'test', 'INR', 'Pay Now', 'Order Payment')`
  );
  tableReady = true;
}

function normalizeText(value, fallback, maxLength, fieldName) {
  const text = String(value ?? fallback ?? "").trim();
  if (text.length > maxLength) {
    throw new ApiError(400, `${fieldName} must be ${maxLength} characters or less`);
  }
  return text;
}

function normalizeKeyId(value, fieldName) {
  const keyId = normalizeText(value, "", 255, fieldName);
  if (keyId && !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) {
    throw new ApiError(400, `${fieldName} is not a valid Razorpay Key ID`);
  }
  return keyId;
}

function normalizeSecretInput(value, fieldName) {
  if (
    value === undefined ||
    value === null ||
    value === MASKED_SECRET ||
    value === LEGACY_MASKED_SECRET
  ) {
    return undefined;
  }
  const secret = String(value).trim();
  if (secret.length > 500) {
    throw new ApiError(400, `${fieldName} must be 500 characters or less`);
  }
  return secret;
}

function mapPaymentSettingsRow(row = {}, includeSecrets = false) {
  const result = {
    provider: row.provider || DEFAULT_SETTINGS.provider,
    enabled: Boolean(row.enabled),
    mode: row.mode === "live" ? "live" : "test",
    testKeyId: row.testKeyId || "",
    testKeySecretConfigured: Boolean(row.testKeySecretEncrypted),
    testWebhookSecretConfigured: Boolean(row.testWebhookSecretEncrypted),
    liveKeyId: row.liveKeyId || "",
    liveKeySecretConfigured: Boolean(row.liveKeySecretEncrypted),
    liveWebhookSecretConfigured: Boolean(row.liveWebhookSecretEncrypted),
    currency: row.currency || DEFAULT_SETTINGS.currency,
    buttonText: row.buttonText || DEFAULT_SETTINGS.buttonText,
    description: row.description || DEFAULT_SETTINGS.description,
    updatedAt: row.updatedAt || null
  };

  if (!includeSecrets) {
    return {
      ...result,
      testKeySecret: result.testKeySecretConfigured ? MASKED_SECRET : "",
      testWebhookSecret: result.testWebhookSecretConfigured ? MASKED_SECRET : "",
      liveKeySecret: result.liveKeySecretConfigured ? MASKED_SECRET : "",
      liveWebhookSecret: result.liveWebhookSecretConfigured ? MASKED_SECRET : ""
    };
  }

  return {
    ...result,
    testKeySecret: decryptPaymentSecret(row.testKeySecretEncrypted),
    testWebhookSecret: decryptPaymentSecret(row.testWebhookSecretEncrypted),
    liveKeySecret: decryptPaymentSecret(row.liveKeySecretEncrypted),
    liveWebhookSecret: decryptPaymentSecret(row.liveWebhookSecretEncrypted)
  };
}

async function readPaymentSettingsRow() {
  await ensurePaymentSettingsTable();
  const rows = await query(
    `SELECT
      provider,
      enabled,
      mode,
      test_key_id AS testKeyId,
      test_key_secret_encrypted AS testKeySecretEncrypted,
      test_webhook_secret_encrypted AS testWebhookSecretEncrypted,
      live_key_id AS liveKeyId,
      live_key_secret_encrypted AS liveKeySecretEncrypted,
      live_webhook_secret_encrypted AS liveWebhookSecretEncrypted,
      currency,
      button_text AS buttonText,
      description,
      updated_at AS updatedAt
     FROM ${TABLE_NAME}
     WHERE id = 1
     LIMIT 1`
  );
  return rows[0] || {};
}

export async function getPaymentSettings(options = {}) {
  return mapPaymentSettingsRow(await readPaymentSettingsRow(), options.includeSecrets === true);
}

export async function savePaymentSettings(payload = {}) {
  const currentRow = await readPaymentSettingsRow();
  const provider = String(
    payload.provider ?? currentRow.provider ?? DEFAULT_SETTINGS.provider
  ).trim().toLowerCase();
  const mode = String(
    payload.mode ?? currentRow.mode ?? DEFAULT_SETTINGS.mode
  ).trim().toLowerCase();
  const currency = String(
    payload.currency ?? currentRow.currency ?? DEFAULT_SETTINGS.currency
  ).trim().toUpperCase();

  if (provider !== "razorpay") throw new ApiError(400, "Payment provider must be Razorpay");
  if (!["test", "live"].includes(mode)) throw new ApiError(400, "Payment mode must be test or live");
  if (currency !== "INR") throw new ApiError(400, "Razorpay currency must be INR");

  const testKeySecret = normalizeSecretInput(payload.testKeySecret, "Test Key Secret");
  const testWebhookSecret = normalizeSecretInput(payload.testWebhookSecret, "Test Webhook Secret");
  const liveKeySecret = normalizeSecretInput(payload.liveKeySecret, "Live Key Secret");
  const liveWebhookSecret = normalizeSecretInput(payload.liveWebhookSecret, "Live Webhook Secret");

  const values = {
    provider,
    enabled: payload.enabled === undefined ? Boolean(currentRow.enabled) : payload.enabled === true,
    mode,
    testKeyId: normalizeKeyId(
      payload.testKeyId ?? currentRow.testKeyId,
      "Test Key ID"
    ),
    testKeySecretEncrypted: testKeySecret === undefined
      ? currentRow.testKeySecretEncrypted || null
      : encryptPaymentSecret(testKeySecret),
    testWebhookSecretEncrypted: testWebhookSecret === undefined
      ? currentRow.testWebhookSecretEncrypted || null
      : encryptPaymentSecret(testWebhookSecret),
    liveKeyId: normalizeKeyId(
      payload.liveKeyId ?? currentRow.liveKeyId,
      "Live Key ID"
    ),
    liveKeySecretEncrypted: liveKeySecret === undefined
      ? currentRow.liveKeySecretEncrypted || null
      : encryptPaymentSecret(liveKeySecret),
    liveWebhookSecretEncrypted: liveWebhookSecret === undefined
      ? currentRow.liveWebhookSecretEncrypted || null
      : encryptPaymentSecret(liveWebhookSecret),
    currency,
    buttonText: normalizeText(
      payload.buttonText,
      currentRow.buttonText || DEFAULT_SETTINGS.buttonText,
      80,
      "Payment Button Text"
    ),
    description: normalizeText(
      payload.description,
      currentRow.description || DEFAULT_SETTINGS.description,
      180,
      "Checkout Description"
    )
  };

  await query(
    `INSERT INTO ${TABLE_NAME}
      (id, provider, enabled, mode, test_key_id, test_key_secret_encrypted,
       test_webhook_secret_encrypted, live_key_id, live_key_secret_encrypted,
       live_webhook_secret_encrypted, currency, button_text, description)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       provider = VALUES(provider),
       enabled = VALUES(enabled),
       mode = VALUES(mode),
       test_key_id = VALUES(test_key_id),
       test_key_secret_encrypted = VALUES(test_key_secret_encrypted),
       test_webhook_secret_encrypted = VALUES(test_webhook_secret_encrypted),
       live_key_id = VALUES(live_key_id),
       live_key_secret_encrypted = VALUES(live_key_secret_encrypted),
       live_webhook_secret_encrypted = VALUES(live_webhook_secret_encrypted),
       currency = VALUES(currency),
       button_text = VALUES(button_text),
       description = VALUES(description)`,
    [
      values.provider,
      values.enabled ? 1 : 0,
      values.mode,
      values.testKeyId || null,
      values.testKeySecretEncrypted,
      values.testWebhookSecretEncrypted,
      values.liveKeyId || null,
      values.liveKeySecretEncrypted,
      values.liveWebhookSecretEncrypted,
      values.currency,
      values.buttonText,
      values.description
    ]
  );

  return getPaymentSettings();
}

export async function getActiveRazorpayCredentials() {
  const settings = await getPaymentSettings({ includeSecrets: true });
  const isLive = settings.mode === "live";

  return {
    provider: settings.provider,
    enabled: settings.enabled,
    mode: settings.mode,
    keyId: isLive ? settings.liveKeyId : settings.testKeyId,
    keySecret: isLive ? settings.liveKeySecret : settings.testKeySecret,
    webhookSecret: isLive ? settings.liveWebhookSecret : settings.testWebhookSecret,
    currency: settings.currency,
    buttonText: settings.buttonText,
    description: settings.description
  };
}

export { DEFAULT_SETTINGS as DEFAULT_PAYMENT_SETTINGS, MASKED_SECRET as MASKED_PAYMENT_SECRET };
