import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCustomerById, updateCustomerBusinessDetails } from "../../api/customerApi";
import { formatCurrency } from "../../utils/storefront";
import fallbackCustomers from "../../data/customers";
import { formatOrderStatusLabel } from "../../../../shared/orderStatusFlow";

const GST_NUMBER_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;

function DetailCard({ title, children }) {
  return (
    <section style={detailCardStyle}>
      <div>
        <h3 style={{ margin: 0, color: "#0f172a" }}>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function formatDate(value, options) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", options || {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatStatusLabel(value) {
  return String(value || "")
    .split("_")
    .join(" ")
    .split("-")
    .join(" ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getAccountStatusStyle(status) {
  if (status === "active") return { background: "#dcfce7", color: "#15803d" };
  if (status === "inactive") return { background: "#fef3c7", color: "#a16207" };
  if (status === "blocked") return { background: "#fee2e2", color: "#dc2626" };
  return { background: "#e2e8f0", color: "#475569" };
}

function getOrderStatusStyle(status) {
  if (status === "pending") return { background: "#fef3c7", color: "#9a6700" };
  if (status === "confirmed") return { background: "#dbeafe", color: "#2563eb" };
  if (status === "packed") return { background: "#f3e8ff", color: "#9333ea" };
  if (status === "shipped") return { background: "#e0e7ff", color: "#4f46e5" };
  if (status === "out_for_delivery") return { background: "#ccfbf1", color: "#0f766e" };
  if (status === "delivered") return { background: "#dcfce7", color: "#16a34a" };
  if (status === "cancelled") return { background: "#fee2e2", color: "#ef4444" };
  if (status === "returned") return { background: "#e5e7eb", color: "#6b7280" };
  return { background: "#f8fafc", color: "#475569" };
}

function getPaymentStatusStyle(status) {
  const normalizedStatus = getPaymentStatusLabel(status);

  if (normalizedStatus === "Paid") return { background: "#dcfce7", color: "#16a34a" };
  if (normalizedStatus === "Unpaid") return { background: "#fee2e2", color: "#ef4444" };
  if (normalizedStatus === "Partial") return { background: "#ffedd5", color: "#ea580c" };
  if (normalizedStatus === "Refunded") return { background: "#e5e7eb", color: "#6b7280" };
  return { background: "#f8fafc", color: "#475569" };
}

function getPaymentStatusLabel(status) {
  if (status === "paid" || status === "authorized") return "Paid";
  if (status === "partially-refunded") return "Partial";
  if (status === "refunded") return "Refunded";
  if (status === "pending" || status === "failed" || status === "cod-pending") return "Unpaid";
  return formatStatusLabel(status);
}

function normalizeFallbackCustomer(customer) {
  return {
    id: customer.id,
    fullName: customer.fullName || customer.name || "",
    email: customer.email || "",
    phone: customer.phone || "",
    totalOrders: Number(customer.totalOrders || customer.orders || 0),
    totalSpend: Number(customer.totalSpend || customer.spent || 0),
    createdAt: customer.createdAt || "",
    lastOrderDate: customer.lastOrderDate || "",
    accountStatus: customer.accountStatus || customer.status || "inactive",
    emailVerified: Boolean(customer.emailVerified),
    phoneVerified: Boolean(customer.phoneVerified),
    savedAddresses: customer.savedAddresses || [],
    orderHistory: customer.orderHistory || [],
    notes: customer.notes || []
  };
}

export default function CustomerDetails() {
  const { customerId } = useParams();
  const [customer, setCustomer] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState("");
  const [accountStatus, setAccountStatus] = React.useState("inactive");
  const [emailVerified, setEmailVerified] = React.useState(false);
  const [phoneVerified, setPhoneVerified] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState("");
  const [businessForm, setBusinessForm] = React.useState({ isBusinessAccount: false, businessName: "", gstNumber: "" });
  const [businessMessage, setBusinessMessage] = React.useState("");

  React.useEffect(() => {
    let isMounted = true;

    const loadCustomer = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await fetchCustomerById(customerId);

        if (!isMounted) return;

        const nextCustomer = response.data?.data || null;

        setCustomer(nextCustomer);
        setAccountStatus(nextCustomer?.accountStatus || "inactive");
        setEmailVerified(Boolean(nextCustomer?.emailVerified));
        setPhoneVerified(Boolean(nextCustomer?.phoneVerified));
        setBusinessForm({
          isBusinessAccount: Boolean(nextCustomer?.businessDetails?.isBusinessAccount || nextCustomer?.isBusinessAccount || nextCustomer?.businessName || nextCustomer?.gstNumber),
          businessName: nextCustomer?.businessDetails?.businessName || nextCustomer?.businessName || "",
          gstNumber: nextCustomer?.businessDetails?.gstNumber || nextCustomer?.gstNumber || ""
        });
        setStatusMessage("");
        setBusinessMessage("");
      } catch (error) {
        if (!isMounted) return;

        const fallbackCustomer = fallbackCustomers
          .map(normalizeFallbackCustomer)
          .find((entry) => String(entry.id) === String(customerId));

        if (fallbackCustomer) {
          setCustomer(fallbackCustomer);
          setAccountStatus(fallbackCustomer.accountStatus || "inactive");
          setEmailVerified(Boolean(fallbackCustomer.emailVerified));
          setPhoneVerified(Boolean(fallbackCustomer.phoneVerified));
          setBusinessForm({ isBusinessAccount: false, businessName: "", gstNumber: "" });
          setStatusMessage("");
          setBusinessMessage("");
          setErrorMessage(error.response?.data?.message || "Backend customer details are unavailable right now. Showing demo preview data.");
          return;
        }

        setErrorMessage(error.response?.data?.message || "We could not load this customer right now.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadCustomer();

    return () => {
      isMounted = false;
    };
  }, [customerId]);

  const handleAccountUpdate = () => {
    setCustomer((currentCustomer) => (
      currentCustomer ? {
        ...currentCustomer,
        accountStatus,
        emailVerified,
        phoneVerified
      } : currentCustomer
    ));

    setStatusMessage("Account settings updated locally for this dashboard preview.");
  };

  const saveBusinessDetails = async () => {
    const payload = {
      isBusinessAccount: Boolean(businessForm.isBusinessAccount || businessForm.businessName || businessForm.gstNumber),
      businessName: String(businessForm.businessName || "").trim(),
      gstNumber: String(businessForm.gstNumber || "").trim().toUpperCase()
    };

    if (payload.gstNumber && !GST_NUMBER_PATTERN.test(payload.gstNumber)) {
      setBusinessMessage("GST Number format is invalid.");
      return;
    }

    try {
      const response = await updateCustomerBusinessDetails(customer.id, payload);
      const next = response.data?.data || payload;
      setBusinessForm({
        isBusinessAccount: Boolean(next.businessDetails?.isBusinessAccount || next.isBusinessAccount || next.businessName || next.gstNumber),
        businessName: next.businessDetails?.businessName || next.businessName || "",
        gstNumber: next.businessDetails?.gstNumber || next.gstNumber || ""
      });
      setCustomer((current) => current ? {
        ...current,
        businessDetails: next.businessDetails || payload,
        isBusinessAccount: Boolean(next.businessDetails?.isBusinessAccount || next.isBusinessAccount || next.businessName || next.gstNumber),
        businessName: next.businessDetails?.businessName || next.businessName || "",
        gstNumber: next.businessDetails?.gstNumber || next.gstNumber || ""
      } : current);
      setBusinessMessage(response.data?.message || "Business details updated.");
    } catch (error) {
      setBusinessMessage(error.response?.data?.message || "Could not update business details.");
    }
  };

  const removeBusinessDetails = async () => {
    try {
      const response = await updateCustomerBusinessDetails(customer.id, { isBusinessAccount: false, businessName: "", gstNumber: "" });
      setBusinessForm({ isBusinessAccount: false, businessName: "", gstNumber: "" });
      setCustomer((current) => current ? {
        ...current,
        businessDetails: { isBusinessAccount: false, businessName: "", gstNumber: "" },
        isBusinessAccount: false,
        businessName: "",
        gstNumber: ""
      } : current);
      setBusinessMessage(response.data?.message || "Business details removed.");
    } catch (error) {
      setBusinessMessage(error.response?.data?.message || "Could not remove business details.");
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: "grid", gap: "16px" }}>
        <div>
          <h2 style={{ margin: 0 }}>Customer Details</h2>
          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            Loading customer profile, contact details, and order history.
          </p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div style={{ display: "grid", gap: "16px" }}>
        <div>
          <h2 style={{ margin: 0 }}>Customer Details</h2>
          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            We could not find a customer matching this dashboard route.
          </p>
        </div>
        <DetailCard title="Missing Customer">
          <p style={{ margin: 0, color: "#475569" }}>
            {errorMessage || "Return to the customers table and open another customer record."}
          </p>
          <div>
            <Link to="/dashboard/customers" style={primaryLinkStyle}>
              Back to Customers
            </Link>
          </div>
        </DetailCard>
      </div>
    );
  }

  const customerTier = Number(customer.totalSpend || 0) >= 15000 ? "High Value" : "Standard";

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <div style={pageHeaderStyle}>
        <div>
          <h2 style={{ margin: 0 }}>Customer Details</h2>
          <p style={{ margin: "8px 0 0", color: "#698096" }}>
            Review the full customer profile from one admin page.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link to="/dashboard/customers" style={secondaryLinkStyle}>
            Back to Customers
          </Link>
          <span style={{ ...pillBaseStyle, ...getAccountStatusStyle(accountStatus) }}>
            {formatStatusLabel(accountStatus)}
          </span>
        </div>
      </div>

      {errorMessage ? (
        <div style={previewNoticeStyle}>
          {errorMessage}
        </div>
      ) : null}

      <DetailCard title="Customer Summary">
        <div style={summaryGridStyle}>
          <div style={detailItemStyle}>
            <span>Customer ID</span>
            <strong>{customer.id}</strong>
          </div>
          <div style={detailItemStyle}>
            <span>Total Orders</span>
            <strong>{Number(customer.totalOrders || 0)}</strong>
          </div>
          <div style={detailItemStyle}>
            <span>Total Spend</span>
            <strong>{formatCurrency(Number(customer.totalSpend || 0))}</strong>
          </div>
          <div style={detailItemStyle}>
            <span>Last Order Date</span>
            <strong>{formatDate(customer.lastOrderDate)}</strong>
          </div>
        </div>
      </DetailCard>

      <div style={twoColumnGridStyle}>
        <DetailCard title="Contact Details">
          <div style={detailStackStyle}>
            <div style={detailItemStyle}>
              <span>Full Name</span>
              <strong>{customer.fullName || "Not available"}</strong>
            </div>
            <div style={detailItemStyle}>
              <span>Email</span>
              <strong>{customer.email || "Not available"}</strong>
            </div>
            <div style={detailItemStyle}>
              <span>Phone</span>
              <strong>{customer.phone || "Not available"}</strong>
            </div>
            <div style={detailItemStyle}>
              <span>Registration Date</span>
              <strong>{formatDate(customer.createdAt, { day: "2-digit", month: "short", year: "numeric" })}</strong>
            </div>
          </div>
        </DetailCard>

        <DetailCard title="Account Status">
          <div style={detailStackStyle}>
            <div style={detailItemStyle}>
              <span>Current Status</span>
              <span style={{ ...pillBaseStyle, ...getAccountStatusStyle(accountStatus) }}>
                {formatStatusLabel(accountStatus)}
              </span>
            </div>
            <div style={detailItemStyle}>
              <span>Manage Status</span>
              <select value={accountStatus} onChange={(event) => setAccountStatus(event.target.value)} style={inputStyle}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <div style={detailItemStyle}>
              <span>Customer Tier</span>
              <strong>{customerTier}</strong>
            </div>
            <div style={detailItemStyle}>
              <span>Last Activity</span>
              <strong>{formatDate(customer.lastOrderDate || customer.createdAt)}</strong>
            </div>
            <div style={detailItemStyle}>
              <span>Email Verified</span>
              <label style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={emailVerified}
                  onChange={(event) => setEmailVerified(event.target.checked)}
                />
                <strong>{emailVerified ? "Verified" : "Not Verified"}</strong>
              </label>
            </div>
            <div style={detailItemStyle}>
              <span>Phone Verified</span>
              <label style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={phoneVerified}
                  onChange={(event) => setPhoneVerified(event.target.checked)}
                />
                <strong>{phoneVerified ? "Verified" : "Not Verified"}</strong>
              </label>
            </div>
            <div style={detailItemStyle}>
              <span>Admin Action</span>
              <div style={{ display: "grid", gap: "10px" }}>
                <button type="button" style={primaryButtonStyle} onClick={handleAccountUpdate}>
                  Save Account Status
                </button>
                <span style={mutedTextStyle}>{statusMessage || "Manage access and verification state for this customer."}</span>
              </div>
            </div>
          </div>
        </DetailCard>
      </div>

      <DetailCard title="Business / GST Details">
        <div style={detailStackStyle}>
          <div style={summaryGridStyle}>
            <div style={detailItemStyle}>
              <span>Business Account</span>
              <strong>{businessForm.isBusinessAccount || businessForm.businessName || businessForm.gstNumber ? "Yes" : "No"}</strong>
            </div>
            <div style={detailItemStyle}>
              <span>Business Name</span>
              <strong>{businessForm.businessName || "Not available"}</strong>
            </div>
            <div style={detailItemStyle}>
              <span>GST Number</span>
              <strong>{businessForm.gstNumber || "Not available"}</strong>
            </div>
          </div>
          <div style={twoColumnGridStyle}>
            <label style={detailItemStyle}>
              <span>Business Account</span>
              <span style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={Boolean(businessForm.isBusinessAccount)}
                  onChange={(event) => setBusinessForm((current) => ({ ...current, isBusinessAccount: event.target.checked }))}
                />
                <strong>{businessForm.isBusinessAccount ? "Enabled" : "Disabled"}</strong>
              </span>
            </label>
            <label style={detailItemStyle}>
              <span>Business Name</span>
              <input
                value={businessForm.businessName}
                onChange={(event) => setBusinessForm((current) => ({ ...current, businessName: event.target.value }))}
                style={inputStyle}
                placeholder="Optional"
              />
            </label>
            <label style={detailItemStyle}>
              <span>GST Number</span>
              <input
                value={businessForm.gstNumber}
                onChange={(event) => setBusinessForm((current) => ({ ...current, gstNumber: event.target.value.toUpperCase() }))}
                style={inputStyle}
                placeholder="Optional"
              />
            </label>
            <div style={detailItemStyle}>
              <span>Admin Action</span>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button type="button" style={primaryButtonStyle} onClick={saveBusinessDetails}>Save GST Details</button>
                <button type="button" style={dangerButtonStyle} onClick={removeBusinessDetails}>Remove GST Details</button>
              </div>
              <span style={mutedTextStyle}>{businessMessage || "Business fields are optional and appear on invoices only when GST is available."}</span>
            </div>
          </div>
        </div>
      </DetailCard>

      <DetailCard title="Saved Addresses">
        {customer.savedAddresses?.length ? (
          <div style={twoColumnGridStyle}>
            {customer.savedAddresses.map((address) => (
              <div key={address.id} style={detailItemStyle}>
                <div style={addressGridStyle}>
                  <div style={addressFieldStyle}>
                    <span>Address Type</span>
                    <strong>{address.addressType || (address.isDefault ? "Primary" : "Saved")}</strong>
                  </div>
                  <div style={addressFieldStyle}>
                    <span>Phone</span>
                    <strong>{address.phone || "Not available"}</strong>
                  </div>
                  <div style={addressFieldStyle}>
                    <span>Full Address</span>
                    <strong>{address.fullAddress || "Not available"}</strong>
                  </div>
                  <div style={addressFieldStyle}>
                    <span>City</span>
                    <strong>{address.city || "Not available"}</strong>
                  </div>
                  <div style={addressFieldStyle}>
                    <span>State</span>
                    <strong>{address.state || "Not available"}</strong>
                  </div>
                  <div style={addressFieldStyle}>
                    <span>Pincode</span>
                    <strong>{address.pincode || "Not available"}</strong>
                  </div>
                  <div style={addressFieldStyle}>
                    <span>Country</span>
                    <strong>{address.country || "Not available"}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={emptyStateStyle}>No saved addresses are stored for this customer yet.</p>
        )}
      </DetailCard>

      <DetailCard title="Order History">
        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={tableHeadStyle}>Order ID</th>
                <th style={tableHeadStyle}>Date</th>
                <th style={tableHeadStyle}>Amount</th>
                <th style={tableHeadStyle}>Payment Status</th>
                <th style={tableHeadStyle}>Order Status</th>
                <th style={tableHeadStyle}>View Order</th>
              </tr>
            </thead>
            <tbody>
              {customer.orderHistory?.length ? (
                customer.orderHistory.map((order) => (
                  <tr key={order.id}>
                    <td style={tableCellStyle}>
                      <div style={{ display: "grid", gap: "4px" }}>
                        <strong>{order.orderNumber}</strong>
                        <span style={mutedTextStyle}>{`Order ID: ${order.id}`}</span>
                      </div>
                    </td>
                    <td style={tableCellStyle}>{formatDate(order.createdAt)}</td>
                    <td style={tableCellStyle}>
                      <strong>{formatCurrency(Number(order.totalAmount || 0))}</strong>
                    </td>
                    <td style={tableCellStyle}>
                      <span style={{ ...pillBaseStyle, ...getPaymentStatusStyle(order.paymentStatus) }}>
                        {getPaymentStatusLabel(order.paymentStatus)}
                      </span>
                    </td>
                    <td style={tableCellStyle}>
                      <span style={{ ...pillBaseStyle, ...getOrderStatusStyle(order.status) }}>
                        {formatOrderStatusLabel(order.status)}
                      </span>
                    </td>
                    <td style={tableCellStyle}>
                      <Link to={`/dashboard/orders/${order.id}`} style={primaryLinkStyle}>
                        View Order
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ ...tableCellStyle, textAlign: "center", color: "#64748b", padding: "28px 16px" }}>
                    No order history is available for this customer yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DetailCard>

      <DetailCard title="Notes / Activity">
        {customer.notes?.length ? (
          <div style={detailStackStyle}>
            {customer.notes.map((note, index) => (
              <div key={`${note.createdAt || "note"}-${index}`} style={detailItemStyle}>
                <strong>{note.title || "Customer note"}</strong>
                <span>{note.body || "No note content provided."}</span>
                <span style={mutedTextStyle}>{formatDate(note.createdAt, { day: "2-digit", month: "short", year: "numeric" })}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={detailStackStyle}>
            <div style={detailItemStyle}>
              <span>Recent Activity</span>
              <strong>{customer.lastOrderDate ? "Customer has placed at least one order." : "No recent activity found."}</strong>
            </div>
            <div style={detailItemStyle}>
              <span>Admin Notes</span>
              <strong>No admin notes have been added for this customer yet.</strong>
            </div>
            <div style={detailItemStyle}>
              <span>Last Updated</span>
              <strong>{formatDate(customer.lastOrderDate || customer.createdAt)}</strong>
            </div>
          </div>
        )}
      </DetailCard>
    </div>
  );
}

const pageHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap"
};

const twoColumnGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "20px"
};

const detailCardStyle = {
  background: "#fff",
  borderRadius: "16px",
  border: "1px solid rgba(203, 213, 225, 0.7)",
  boxShadow: "0 14px 34px rgba(174, 203, 190, 0.18)",
  padding: "18px",
  display: "grid",
  gap: "14px"
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "12px"
};

const detailStackStyle = {
  display: "grid",
  gap: "12px"
};

const addressGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px"
};

const addressFieldStyle = {
  display: "grid",
  gap: "6px",
  color: "#334155"
};

const detailItemStyle = {
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #e5edf5",
  background: "#f8fafc",
  display: "grid",
  gap: "6px",
  color: "#334155"
};

const inputStyle = {
  width: "100%",
  minHeight: "38px",
  padding: "0 12px",
  borderRadius: "10px",
  border: "1px solid #d4dbe6",
  background: "#fff",
  boxSizing: "border-box",
  color: "#0f172a",
  fontSize: "14px"
};

const checkboxRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  color: "#334155"
};

const tableWrapperStyle = {
  overflowX: "auto",
  border: "1px solid #e5edf5",
  borderRadius: "14px",
  background: "#fff"
};

const tableStyle = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  minWidth: "760px",
  background: "#fff"
};

const tableHeadStyle = {
  padding: "14px 16px",
  textAlign: "left",
  fontSize: "13px",
  fontWeight: 700,
  color: "#475569",
  background: "#f8fafc",
  borderBottom: "1px solid #e5edf5",
  whiteSpace: "nowrap"
};

const tableCellStyle = {
  padding: "14px 16px",
  borderBottom: "1px solid #eef2f7",
  verticalAlign: "middle",
  color: "#0f172a"
};

const primaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "30px",
  padding: "0 14px",
  borderRadius: "9px",
  background: "#0f172a",
  color: "#fff",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: "13px",
  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.18)"
};

const primaryButtonStyle = {
  minHeight: "36px",
  padding: "0 16px",
  borderRadius: "10px",
  border: "none",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "14px",
  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.18)"
};

const dangerButtonStyle = {
  minHeight: "36px",
  padding: "0 16px",
  borderRadius: "10px",
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#dc2626",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "14px"
};

const secondaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "36px",
  padding: "0 16px",
  borderRadius: "10px",
  border: "1px solid #d4dbe6",
  background: "#fff",
  color: "#334155",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: "14px"
};

const pillBaseStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "28px",
  padding: "0 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 700,
  lineHeight: 1,
  whiteSpace: "nowrap"
};

const mutedTextStyle = {
  margin: 0,
  color: "#8aa0b5",
  fontSize: "13px"
};

const emptyStateStyle = {
  margin: 0,
  color: "#64748b"
};

const previewNoticeStyle = {
  padding: "14px 16px",
  borderRadius: "14px",
  border: "1px solid #fed7aa",
  background: "#fff7ed",
  color: "#c2410c",
  fontWeight: 600
};
