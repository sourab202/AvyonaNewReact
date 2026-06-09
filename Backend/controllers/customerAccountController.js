import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { pool, query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";
import { signCustomerToken } from "../utils/jwt.js";
import { grantSignupBonus } from "../services/creditPointsRewards.js";
import { validateReferralAtSignup } from "../services/creditPointsSecurity.js";
import {
  getCustomerBusinessDetails,
  normalizeBusinessDetails,
  publicBusinessDetails,
  saveCustomerBusinessDetails
} from "../services/customerBusinessDetails.js";

function publicCustomer(customer) {
  const [firstName = "", ...lastParts] = String(customer.fullName || "").split(/\s+/).filter(Boolean);
  const businessDetails = publicBusinessDetails(customer.businessDetails || customer);
  return {
    id: customer.id,
    fullName: customer.fullName,
    email: customer.email,
    mobile: customer.phone || "",
    firstName,
    lastName: lastParts.join(" "),
    city: customer.city || "",
    state: customer.state || "",
    businessDetails,
    isBusinessAccount: businessDetails.isBusinessAccount,
    businessName: businessDetails.businessName,
    gstNumber: businessDetails.gstNumber
  };
}

function getProductIdentifier(item) {
  return String(item.asin || item.slug || "").trim();
}

function mapProductRow(row) {
  return {
    slug: row.slug,
    asin: row.asin,
    name: row.name,
    category: row.categoryName || "Products",
    price: Number(row.price || 0),
    quantity: Number(row.quantity || 1),
    image: row.imageUrl || "/images/optimized/frame-1.webp",
    variantLabel: row.variantLabel || ""
  };
}

function mapAddressRow(row) {
  return {
    id: row.id,
    addressType: row.addressType || "Home",
    fullName: row.fullName,
    phone: row.phone || "",
    line1: row.line1,
    line2: row.line2 || "",
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    country: row.country || "India",
    isDefault: Boolean(row.isDefault)
  };
}

async function ensurePasswordResetTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS customer_password_resets (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      customer_id INT UNSIGNED NOT NULL,
      token_hash VARCHAR(128) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_customer_password_resets_token (token_hash),
      CONSTRAINT fk_customer_password_resets_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )`
  );
}

async function findProduct(connection, item) {
  const identifier = getProductIdentifier(item);
  if (!identifier) return null;

  const [rows] = await connection.execute(
    `SELECT id, asin, slug, name, price, image_url AS imageUrl
     FROM products
     WHERE (asin = ? OR slug = ?)
       AND status = 'active'
       AND is_visible = 1
       AND is_deleted = 0
     LIMIT 1`,
    [identifier, identifier]
  );

  return rows[0] || null;
}

async function getOrCreateCart(connection, customerId) {
  const [cartRows] = await connection.execute(
    "SELECT id FROM carts WHERE customer_id = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1",
    [customerId]
  );

  if (cartRows[0]) return cartRows[0].id;

  const [result] = await connection.execute(
    "INSERT INTO carts (customer_id, status) VALUES (?, 'active')",
    [customerId]
  );

  return result.insertId;
}

export async function signupCustomer(request, response) {
  const fullName = String(request.body?.fullName || "").trim();
  const email    = String(request.body?.email    || "").trim().toLowerCase();
  const phone    = String(request.body?.mobile   || request.body?.phone || "").trim();
  const password = String(request.body?.password || "");
  const referredByCode = String(request.body?.referralCode || "").trim().toUpperCase() || null;
  const businessDetails = normalizeBusinessDetails(request.body?.businessDetails || request.body || {});
  const ipAddress = request.headers["x-forwarded-for"]?.split(",")[0]?.trim() || request.ip || null;
  const rawDevice = String(request.body?.deviceFingerprint || request.headers["x-device-fingerprint"] || request.headers["user-agent"] || "").trim();
  const deviceHash = rawDevice ? crypto.createHash("sha256").update(rawDevice).digest("hex") : null;

  if (!fullName || !email || !phone || password.length < 6) {
    throw new ApiError(400, "Full name, email, mobile, and a 6+ character password are required");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  if (referredByCode) {
    await validateReferralAtSignup({ referralCode: referredByCode, email, phone, deviceHash, ipAddress });
  }

  // ── Abuse check 1: duplicate email ────────────────────────────────────────
  const byEmail = await query(
    "SELECT id, password_hash AS passwordHash FROM customers WHERE email = ? LIMIT 1",
    [email]
  );
  if (byEmail[0]?.passwordHash) {
    throw new ApiError(409, "An account with that email already exists");
  }

  // ── Abuse check 2: duplicate phone ───────────────────────────────────────
  // Prevent creating multiple accounts under different emails with the same
  // phone number to farm signup bonuses.
  if (phone) {
    const byPhone = await query(
      "SELECT id FROM customers WHERE phone = ? AND password_hash IS NOT NULL AND status = 'active' LIMIT 1",
      [phone]
    );
    if (byPhone[0]) {
      throw new ApiError(409, "A verified account is already registered with that mobile number");
    }
  }

  // ── Create or finalise the customer record ────────────────────────────────
  let customerId = byEmail[0]?.id || null;
  const isNewAccount = !customerId;

  if (customerId) {
    await query(
      `UPDATE customers
       SET full_name = ?, phone = ?, password_hash = ?, status = 'active'
       WHERE id = ?`,
      [fullName, phone, passwordHash, customerId]
    );
  } else {
    const result = await query(
      `INSERT INTO customers (full_name, email, phone, password_hash, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [fullName, email, phone, passwordHash]
    );
    customerId = result.insertId;
  }

  await saveCustomerBusinessDetails(customerId, businessDetails);

  // ── Store referral code if provided (validated in reward service) ─────────
  if (referredByCode && isNewAccount) {
    await query(
      `INSERT INTO customer_referral_codes
         (customer_id, referral_code, referred_by_code, referral_status, signup_ip, signup_device_hash, referred_at)
       VALUES (?, ?, ?, 'pending', ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         referred_by_code = IF(referred_by_code IS NULL, VALUES(referred_by_code), referred_by_code),
         referral_status = IF(referral_status IN ('none', 'blocked'), VALUES(referral_status), referral_status),
         signup_ip = COALESCE(signup_ip, VALUES(signup_ip)),
         signup_device_hash = COALESCE(signup_device_hash, VALUES(signup_device_hash)),
         referred_at = COALESCE(referred_at, VALUES(referred_at))`,
      [customerId, _generateReferralCode(customerId), referredByCode, ipAddress, deviceHash]
    );
  } else if (isNewAccount) {
    await query(
      `INSERT INTO customer_referral_codes
         (customer_id, referral_code, referral_status, signup_ip, signup_device_hash)
       VALUES (?, ?, 'none', ?, ?)
       ON DUPLICATE KEY UPDATE
         signup_ip = COALESCE(signup_ip, VALUES(signup_ip)),
         signup_device_hash = COALESCE(signup_device_hash, VALUES(signup_device_hash))`,
      [customerId, _generateReferralCode(customerId), ipAddress, deviceHash]
    );
  }

  const rows = await query(
    "SELECT id, full_name AS fullName, email, phone, city, state FROM customers WHERE id = ? LIMIT 1",
    [customerId]
  );
  const customer = rows[0];
  customer.businessDetails = await getCustomerBusinessDetails(customerId);

  // ── Grant signup bonus (non-fatal — fires after response for new accounts) ─
  // Only new accounts receive the bonus; updating a password-less stub does not.
  if (isNewAccount) {
    // Fire-and-forget: do not await — response is already sent
    grantSignupBonus(customerId, { ipAddress }).catch(() => {});
  }

  response.status(201).json({
    success: true,
    data: {
      token: signCustomerToken(customer),
      customer: publicCustomer(customer)
    }
  });
}

function _generateReferralCode(customerId) {
  const prefix  = "AVY";
  const padded  = String(customerId).padStart(5, "0");
  const check   = (customerId * 7 + 13) % 10;
  return `${prefix}${padded}${check}`;
}

export async function loginCustomer(request, response) {
  const identity = String(request.body?.identity || "").trim().toLowerCase();
  const password = String(request.body?.password || "");

  if (!identity || !password) {
    throw new ApiError(400, "Email/mobile and password are required");
  }

  const rows = await query(
    `SELECT id, full_name AS fullName, email, phone, city, state, password_hash AS passwordHash, status
     FROM customers
     WHERE LOWER(email) = ? OR LOWER(phone) = ?
     LIMIT 1`,
    [identity, identity]
  );
  const customer = rows[0];

  if (!customer || !customer.passwordHash || !(await bcrypt.compare(password, customer.passwordHash))) {
    throw new ApiError(401, "We could not match those account details");
  }

  if (customer.status !== "active") {
    throw new ApiError(403, "This account is not active");
  }

  await query("UPDATE customers SET last_login_at = NOW() WHERE id = ?", [customer.id]);
  customer.businessDetails = await getCustomerBusinessDetails(customer.id);

  response.json({
    success: true,
    data: {
      token: signCustomerToken(customer),
      customer: publicCustomer(customer)
    }
  });
}

export async function requestCustomerPasswordReset(request, response) {
  const identity = String(request.body?.identity || "").trim().toLowerCase();

  if (!identity) {
    throw new ApiError(400, "Email or mobile number is required");
  }

  const rows = await query(
    `SELECT id
     FROM customers
     WHERE LOWER(email) = ? OR LOWER(phone) = ?
     LIMIT 1`,
    [identity, identity]
  );

  if (rows[0]) {
    await ensurePasswordResetTable();
    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    await query(
      `INSERT INTO customer_password_resets (customer_id, token_hash, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
      [rows[0].id, tokenHash]
    );
  }

  response.json({
    success: true,
    message: "If an account exists, password reset instructions will be sent shortly."
  });
}

export async function getCurrentCustomer(request, response) {
  const businessDetails = await getCustomerBusinessDetails(request.customer.id);
  response.json({
    success: true,
    data: {
      customer: publicCustomer({ ...request.customer, businessDetails })
    }
  });
}

export async function updateCurrentCustomer(request, response) {
  const fullName = String(request.body?.fullName || request.body?.name || "").trim();
  const email = String(request.body?.email || "").trim().toLowerCase();
  const phone = String(request.body?.mobile || request.body?.phone || "").trim();
  const city = String(request.body?.city || "").trim();
  const state = String(request.body?.state || "").trim();
  const hasBusinessPayload = Object.prototype.hasOwnProperty.call(request.body || {}, "businessDetails") ||
    Object.prototype.hasOwnProperty.call(request.body || {}, "businessName") ||
    Object.prototype.hasOwnProperty.call(request.body || {}, "gstNumber") ||
    Object.prototype.hasOwnProperty.call(request.body || {}, "isBusinessAccount") ||
    Object.prototype.hasOwnProperty.call(request.body || {}, "businessAccount");

  if (!fullName || !email) {
    throw new ApiError(400, "Full name and email are required");
  }

  const existing = await query(
    "SELECT id FROM customers WHERE email = ? AND id <> ? LIMIT 1",
    [email, request.customer.id]
  );

  if (existing[0]) {
    throw new ApiError(409, "Another account is already using that email");
  }

  await query(
    `UPDATE customers
     SET full_name = ?, email = ?, phone = ?, city = ?, state = ?
     WHERE id = ?`,
    [fullName, email, phone || null, city || null, state || null, request.customer.id]
  );

  let businessDetails = await getCustomerBusinessDetails(request.customer.id);
  if (hasBusinessPayload) {
    businessDetails = await saveCustomerBusinessDetails(request.customer.id, request.body?.businessDetails || request.body || {});
  }

  const rows = await query("SELECT id, full_name AS fullName, email, phone, city, state FROM customers WHERE id = ? LIMIT 1", [request.customer.id]);

  response.json({
    success: true,
    message: "Profile updated",
    data: {
      customer: publicCustomer({ ...rows[0], businessDetails })
    }
  });
}

export async function getCustomerAddresses(request, response) {
  const rows = await query(
    `SELECT
      id,
      address_type AS addressType,
      full_name AS fullName,
      phone,
      line1,
      line2,
      city,
      state,
      pincode,
      country,
      is_default AS isDefault
     FROM customer_addresses
     WHERE customer_id = ?
     ORDER BY is_default DESC, updated_at DESC`,
    [request.customer.id]
  );

  response.json({
    success: true,
    count: rows.length,
    data: rows.map(mapAddressRow)
  });
}

export async function saveCustomerAddress(request, response) {
  const addressId = Number(request.params.addressId || request.body?.id || 0);
  const addressType = String(request.body?.addressType || "Home").trim() || "Home";
  const fullName = String(request.body?.fullName || request.customer.fullName || "").trim();
  const phone = String(request.body?.phone || request.customer.phone || "").trim();
  const line1 = String(request.body?.line1 || "").trim();
  const line2 = String(request.body?.line2 || "").trim();
  const city = String(request.body?.city || "").trim();
  const state = String(request.body?.state || "").trim();
  const pincode = String(request.body?.pincode || "").trim();
  const country = String(request.body?.country || "India").trim() || "India";
  const isDefault = request.body?.isDefault === true || request.body?.isDefault === 1;

  if (!fullName || !phone || !line1 || !city || !state || !pincode) {
    throw new ApiError(400, "Full name, phone, address, city, state, and pincode are required");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (isDefault) {
      await connection.execute("UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?", [request.customer.id]);
    }

    if (addressId) {
      await connection.execute(
        `UPDATE customer_addresses
         SET address_type = ?, full_name = ?, phone = ?, line1 = ?, line2 = ?, city = ?, state = ?, pincode = ?, country = ?, is_default = ?
         WHERE id = ? AND customer_id = ?`,
        [addressType, fullName, phone, line1, line2 || null, city, state, pincode, country, isDefault ? 1 : 0, addressId, request.customer.id]
      );
    } else {
      await connection.execute(
        `INSERT INTO customer_addresses
          (customer_id, address_type, full_name, phone, line1, line2, city, state, pincode, country, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [request.customer.id, addressType, fullName, phone, line1, line2 || null, city, state, pincode, country, isDefault ? 1 : 0]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await getCustomerAddresses(request, response);
}

export async function deleteCustomerAddress(request, response) {
  const addressId = Number(request.params.addressId || 0);

  if (!addressId) {
    throw new ApiError(400, "Address id is required");
  }

  await query("DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?", [addressId, request.customer.id]);

  response.json({
    success: true,
    message: "Address deleted"
  });
}

export async function getCustomerCart(request, response) {
  const rows = await query(
    `SELECT
      p.slug,
      p.asin,
      p.name,
      c.name AS categoryName,
      ci.quantity,
      ci.price_at_time AS price,
      p.image_url AS imageUrl
     FROM carts cart
     INNER JOIN cart_items ci ON ci.cart_id = cart.id
     INNER JOIN products p ON p.id = ci.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE cart.customer_id = ?
       AND cart.status = 'active'
       AND p.is_deleted = 0
     ORDER BY ci.updated_at DESC`,
    [request.customer.id]
  );

  response.json({
    success: true,
    data: rows.map(mapProductRow)
  });
}

export async function syncCustomerCart(request, response) {
  const items = Array.isArray(request.body?.items) ? request.body.items : [];
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const cartId = await getOrCreateCart(connection, request.customer.id);
    await connection.execute("DELETE FROM cart_items WHERE cart_id = ?", [cartId]);

    for (const item of items) {
      const product = await findProduct(connection, item);
      if (!product) continue;
      const quantity = Math.max(1, Math.min(99, Number(item.quantity || 1)));
      const price = Number(item.price || product.price || 0);
      await connection.execute(
        `INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, price_at_time)
         VALUES (?, ?, NULL, ?, ?)`,
        [cartId, product.id, quantity, price]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await getCustomerCart(request, response);
}

export async function getCustomerWishlist(request, response) {
  const rows = await query(
    `SELECT
      p.slug,
      p.asin,
      p.name,
      c.name AS categoryName,
      1 AS quantity,
      p.price,
      p.image_url AS imageUrl
     FROM wishlists w
     INNER JOIN products p ON p.id = w.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE w.customer_id = ?
       AND p.is_deleted = 0
     ORDER BY w.created_at DESC`,
    [request.customer.id]
  );

  response.json({
    success: true,
    data: rows.map(mapProductRow)
  });
}

export async function syncCustomerWishlist(request, response) {
  const items = Array.isArray(request.body?.items) ? request.body.items : [];
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM wishlists WHERE customer_id = ?", [request.customer.id]);

    for (const item of items) {
      const product = await findProduct(connection, item);
      if (!product) continue;
      await connection.execute(
        "INSERT IGNORE INTO wishlists (customer_id, product_id) VALUES (?, ?)",
        [request.customer.id, product.id]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await getCustomerWishlist(request, response);
}

export async function getCustomerOrders(request, response) {
  const rows = await query(
    `SELECT
      o.id,
      o.order_number AS orderNumber,
      o.status,
      o.payment_status AS paymentStatus,
      o.payment_method AS paymentMethod,
      o.total_amount AS totalAmount,
      o.created_at AS createdAt,
      oi.product_name AS name,
      oi.quantity,
      oi.total_price AS total,
      p.slug,
      p.image_url AS image,
      c.name AS category
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN products p ON p.id = oi.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE o.customer_id = ?
     ORDER BY o.created_at DESC, oi.id ASC`,
    [request.customer.id]
  );

  response.json({
    success: true,
    data: rows.map((row) => ({
      ...row,
      total: Number(row.total || row.totalAmount || 0),
      date: row.createdAt,
      image: row.image || "/images/optimized/frame-1.webp",
      category: row.category || "Products"
    }))
  });
}
