import { query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";

const VALID_ENQUIRY_TYPES = new Set(["B2C", "B2B"]);
const VALID_STATUSES = new Set(["New", "In Progress", "Resolved", "Closed"]);
const DUPLICATE_WINDOW_MINUTES = 30;
const DUPLICATE_MESSAGE = "You have already submitted this enquiry. Please wait for our team to respond.";

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeEnquiryType(value) {
  const normalized = cleanText(value).toUpperCase();
  if (normalized === "CUSTOMER" || normalized === "B2C") return "B2C";
  if (normalized === "BUSINESS" || normalized === "B2B") return "B2B";
  return normalized;
}

function validateLength(value, fieldName, min, max) {
  if (value.length < min || value.length > max) {
    throw new ApiError(400, `${fieldName} must be between ${min} and ${max} characters`);
  }
}

function validateEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, "A valid email address is required");
  }
}

function validatePhone(phone) {
  if (!/^(?:\+91)?\d+$/.test(phone)) {
    throw new ApiError(400, "Phone must contain numbers only and may start with +91");
  }

  const digits = phone.replace(/^\+/, "");
  if (digits.length < 10 || digits.length > 15) {
    throw new ApiError(400, "Phone must be between 10 and 15 digits");
  }
}

function mapContactEnquiry(row) {
  return {
    id: row.id,
    enquiryType: row.enquiry_type,
    name: row.name,
    companyName: row.company_name || "",
    email: row.email,
    phone: row.phone,
    orderId: row.order_id || "",
    message: row.message,
    status: row.status,
    isDeleted: Boolean(row.is_deleted),
    deletedAt: row.deleted_at,
    createdAt: row.created_at
  };
}

export async function createContactEnquiry(request, response) {
  const enquiryType = normalizeEnquiryType(request.body.enquiryType || request.body.enquiry_type);
  const name = cleanText(request.body.name);
  const companyName = cleanText(request.body.companyName || request.body.company_name);
  const email = cleanText(request.body.email).toLowerCase();
  const phone = cleanText(request.body.phone);
  const orderId = cleanText(request.body.orderId || request.body.order_id);
  const message = cleanText(request.body.message);

  if (!VALID_ENQUIRY_TYPES.has(enquiryType)) {
    throw new ApiError(400, "enquiryType must be B2C or B2B");
  }

  if (!name || !email || !phone || !message) {
    throw new ApiError(400, "name, email, phone, and message are required");
  }

  validateLength(name, "name", 2, 100);
  validateEmail(email);
  validatePhone(phone);
  validateLength(message, "message", 10, 1000);

  if (enquiryType === "B2B" && !companyName) {
    throw new ApiError(400, "companyName is required for business enquiries");
  }

  if (companyName) {
    validateLength(companyName, "companyName", 2, 180);
  }

  const duplicateRows = await query(
    `SELECT id
     FROM contact_enquiries
     WHERE is_deleted = 0
       AND email = ?
       AND phone = ?
       AND message = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
     LIMIT 1`,
    [email, phone, message, DUPLICATE_WINDOW_MINUTES]
  );

  if (duplicateRows.length) {
    throw new ApiError(409, DUPLICATE_MESSAGE);
  }

  const result = await query(
    `INSERT INTO contact_enquiries
      (enquiry_type, name, company_name, email, phone, order_id, message, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'New')`,
    [
      enquiryType,
      name,
      companyName || null,
      email,
      phone,
      orderId || null,
      message
    ]
  );

  const rows = await query("SELECT * FROM contact_enquiries WHERE id = ? LIMIT 1", [result.insertId]);

  response.status(201).json({
    success: true,
    message: "Contact enquiry submitted",
    data: mapContactEnquiry(rows[0])
  });
}

export async function listContactEnquiries(request, response) {
  const status = cleanText(request.query.status);
  const enquiryType = normalizeEnquiryType(request.query.enquiryType || request.query.enquiry_type);
  const search = cleanText(request.query.search);
  const clauses = ["is_deleted = 0"];
  const values = [];

  if (status && VALID_STATUSES.has(status)) {
    clauses.push("status = ?");
    values.push(status);
  }

  if (enquiryType && VALID_ENQUIRY_TYPES.has(enquiryType)) {
    clauses.push("enquiry_type = ?");
    values.push(enquiryType);
  }

  if (search) {
    clauses.push("(name LIKE ? OR company_name LIKE ? OR email LIKE ? OR phone LIKE ? OR order_id LIKE ?)");
    const likeSearch = `%${search}%`;
    values.push(likeSearch, likeSearch, likeSearch, likeSearch, likeSearch);
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await query(
    `SELECT *
     FROM contact_enquiries
     ${whereSql}
     ORDER BY created_at DESC, id DESC`,
    values
  );

  response.json({
    success: true,
    count: rows.length,
    data: rows.map(mapContactEnquiry)
  });
}

export async function getContactEnquiry(request, response) {
  const enquiryId = Number(request.params.id);

  if (!Number.isInteger(enquiryId) || enquiryId <= 0) {
    throw new ApiError(400, "Invalid contact enquiry id");
  }

  const rows = await query("SELECT * FROM contact_enquiries WHERE id = ? AND is_deleted = 0 LIMIT 1", [enquiryId]);

  if (!rows.length) {
    throw new ApiError(404, "Contact enquiry not found");
  }

  response.json({
    success: true,
    data: mapContactEnquiry(rows[0])
  });
}

export async function updateContactEnquiryStatus(request, response) {
  const enquiryId = Number(request.params.id);
  const status = cleanText(request.body.status);

  if (!Number.isInteger(enquiryId) || enquiryId <= 0) {
    throw new ApiError(400, "Invalid contact enquiry id");
  }

  if (!VALID_STATUSES.has(status)) {
    throw new ApiError(400, "status must be New, In Progress, Resolved, or Closed");
  }

  const result = await query("UPDATE contact_enquiries SET status = ? WHERE id = ? AND is_deleted = 0 LIMIT 1", [status, enquiryId]);

  if (!result.affectedRows) {
    throw new ApiError(404, "Contact enquiry not found");
  }

  const rows = await query("SELECT * FROM contact_enquiries WHERE id = ? LIMIT 1", [enquiryId]);

  response.json({
    success: true,
    message: "Contact enquiry status updated",
    data: mapContactEnquiry(rows[0])
  });
}

export async function deleteContactEnquiry(request, response) {
  const enquiryId = Number(request.params.id);

  if (!Number.isInteger(enquiryId) || enquiryId <= 0) {
    throw new ApiError(400, "Invalid contact enquiry id");
  }

  const result = await query(
    "UPDATE contact_enquiries SET is_deleted = 1, deleted_at = NOW() WHERE id = ? AND is_deleted = 0 LIMIT 1",
    [enquiryId]
  );

  if (!result.affectedRows) {
    throw new ApiError(404, "Contact enquiry not found");
  }

  response.json({
    success: true,
    message: "Contact enquiry deleted"
  });
}
