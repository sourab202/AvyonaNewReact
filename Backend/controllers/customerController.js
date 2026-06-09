import { query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";
import { ensureCustomerBusinessDetailsTable, saveCustomerBusinessDetails } from "../services/customerBusinessDetails.js";

function getAccountStatus(customer) {
  if (Number(customer.totalOrders || 0) > 0) {
    return "active";
  }

  return "inactive";
}

function formatSavedAddresses(customer) {
  const hasLocation = customer.city || customer.state;

  if (!hasLocation) {
    return [];
  }

  return [
    {
      id: `primary-${customer.id}`,
      addressType: "Home",
      fullAddress: [customer.city, customer.state].filter(Boolean).join(", "),
      city: customer.city || "",
      state: customer.state || "",
      pincode: "500001",
      country: "India",
      phone: customer.phone || "",
      isDefault: true
    }
  ];
}

export async function listCustomers(_request, response) {
  await ensureCustomerBusinessDetailsTable();
  const rows = await query(
    `SELECT
      c.id,
      c.full_name AS fullName,
      c.email,
      c.phone,
      c.city,
      c.state,
      c.total_orders AS totalOrders,
      c.total_spent AS totalSpent,
      c.created_at AS createdAt,
      MAX(o.created_at) AS lastOrderDate
     FROM customers c
     LEFT JOIN orders o ON o.customer_id = c.id
     GROUP BY c.id, c.full_name, c.email, c.phone, c.city, c.state, c.total_orders, c.total_spent, c.created_at
     ORDER BY c.created_at DESC`
  );

  const businessRows = rows.length
    ? await query(
        `SELECT
          customer_id AS customerId,
          is_business_account AS isBusinessAccount,
          business_name AS businessName,
          gst_number AS gstNumber
         FROM customer_business_details
         WHERE customer_id IN (${rows.map(() => "?").join(",")})`,
        rows.map((customer) => customer.id)
      )
    : [];
  const businessByCustomer = new Map(businessRows.map((row) => [Number(row.customerId), row]));

  const data = rows.map((customer) => {
    const business = businessByCustomer.get(Number(customer.id)) || {};
    return {
      ...customer,
      businessDetails: {
        isBusinessAccount: Boolean(business.isBusinessAccount || business.businessName || business.gstNumber),
        businessName: business.businessName || "",
        gstNumber: business.gstNumber || ""
      },
      isBusinessAccount: Boolean(business.isBusinessAccount || business.businessName || business.gstNumber),
      businessName: business.businessName || "",
      gstNumber: business.gstNumber || "",
      accountStatus: getAccountStatus(customer),
      savedAddresses: formatSavedAddresses(customer)
    };
  });

  response.json({
    success: true,
    count: data.length,
    data
  });
}

export async function getCustomerDetails(request, response) {
  const customerId = Number(request.params.id);

  if (!Number.isFinite(customerId) || customerId <= 0) {
    throw new ApiError(400, "Invalid customer id");
  }

  await ensureCustomerBusinessDetailsTable();

  const customerRows = await query(
    `SELECT
      c.id,
      c.full_name AS fullName,
      c.email,
      c.phone,
      c.city,
      c.state,
      c.total_orders AS totalOrders,
      c.total_spent AS totalSpent,
      c.created_at AS createdAt,
      MAX(o.created_at) AS lastOrderDate
     FROM customers c
     LEFT JOIN orders o ON o.customer_id = c.id
     WHERE c.id = ?
     GROUP BY c.id, c.full_name, c.email, c.phone, c.city, c.state, c.total_orders, c.total_spent, c.created_at
     LIMIT 1`,
    [customerId]
  );

  const customer = customerRows[0];

  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  const orderHistory = await query(
    `SELECT
      id,
      order_number AS orderNumber,
      status,
      payment_method AS paymentMethod,
      CASE
        WHEN status = 'cancelled' THEN 'refunded'
        WHEN LOWER(payment_method) LIKE '%cod%' THEN 'pending'
        ELSE 'paid'
      END AS paymentStatus,
      subtotal,
      shipping_fee AS shippingFee,
      total_amount AS totalAmount,
      created_at AS createdAt,
      updated_at AS updatedAt
     FROM orders
     WHERE customer_id = ?
     ORDER BY created_at DESC`,
    [customerId]
  );

  const businessRows = await query(
    `SELECT
      is_business_account AS isBusinessAccount,
      business_name AS businessName,
      gst_number AS gstNumber
     FROM customer_business_details
     WHERE customer_id = ?
     LIMIT 1`,
    [customerId]
  );
  const business = businessRows[0] || {};
  const businessDetails = {
    isBusinessAccount: Boolean(business.isBusinessAccount || business.businessName || business.gstNumber),
    businessName: business.businessName || "",
    gstNumber: business.gstNumber || ""
  };

  response.json({
    success: true,
    data: {
      ...customer,
      businessDetails,
      isBusinessAccount: businessDetails.isBusinessAccount,
      businessName: businessDetails.businessName,
      gstNumber: businessDetails.gstNumber,
      accountStatus: getAccountStatus(customer),
      emailVerified: Boolean(customer.email),
      phoneVerified: Boolean(customer.phone),
      savedAddresses: formatSavedAddresses(customer),
      orderHistory,
      notes: []
    }
  });
}

export async function updateCustomerBusinessDetails(request, response) {
  const customerId = Number(request.params.id);

  if (!Number.isFinite(customerId) || customerId <= 0) {
    throw new ApiError(400, "Invalid customer id");
  }

  const customerRows = await query("SELECT id FROM customers WHERE id = ? LIMIT 1", [customerId]);
  if (!customerRows[0]) {
    throw new ApiError(404, "Customer not found");
  }

  const businessDetails = await saveCustomerBusinessDetails(customerId, request.body || {});

  response.json({
    success: true,
    message: businessDetails.isBusinessAccount || businessDetails.businessName || businessDetails.gstNumber
      ? "Business details updated"
      : "Business details removed",
    data: {
      businessDetails,
      isBusinessAccount: businessDetails.isBusinessAccount,
      businessName: businessDetails.businessName,
      gstNumber: businessDetails.gstNumber
    }
  });
}
