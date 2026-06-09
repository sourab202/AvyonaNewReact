import React from "react";
import { Link, useParams } from "react-router-dom";
import orders, { orderStatusOptions } from "../../data/orders";
import { formatCurrency } from "../../utils/storefront";
import { formatOrderStatusLabel } from "../../../../shared/orderStatusFlow";
import { fetchOrder, updateOrderTracking } from "../../api/adminApi";

function DetailCard({ title, children }) {
  return (
    <section
      style={detailCardStyle}
    >
      <div>
        <h3 style={{ margin: 0, color: "#0f172a" }}>{title}</h3>
      </div>
      {children}
    </section>
  );
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
  const normalizedStatus = String(status || "").replaceAll("-", "_");

  if (normalizedStatus === "paid" || normalizedStatus === "authorized") return { background: "#dcfce7", color: "#16a34a" };
  if (normalizedStatus === "pending" || normalizedStatus === "cod_pending") return { background: "#fef3c7", color: "#9a6700" };
  if (normalizedStatus === "failed") return { background: "#fee2e2", color: "#dc2626" };
  if (normalizedStatus === "refunded" || normalizedStatus === "partially_refunded") return { background: "#dbeafe", color: "#2563eb" };
  return { background: "#f8fafc", color: "#475569" };
}

function getPaymentBadgeLabel(status) {
  const normalizedStatus = String(status || "").replaceAll("-", "_");
  if (normalizedStatus === "paid") return "Paid";
  if (normalizedStatus === "authorized") return "Authorized";
  if (normalizedStatus === "partially_refunded") return "Partially Refunded";
  if (normalizedStatus === "refunded") return "Refunded";
  if (normalizedStatus === "failed") return "Failed";
  if (normalizedStatus === "pending" || normalizedStatus === "cod_pending") return "Pending";
  return formatOrderStatusLabel(normalizedStatus);
}

export default function OrderDetails() {
  const { orderId } = useParams();
  const fallbackOrder = React.useMemo(
    () => orders.find((entry) => String(entry.id) === String(orderId)),
    [orderId]
  );
  const [currentOrder, setCurrentOrder] = React.useState(null);
  const [orderStatus, setOrderStatus] = React.useState("");
  const [courierName, setCourierName] = React.useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = React.useState("");
  const [trackingNote, setTrackingNote] = React.useState("");
  const [adminRemark, setAdminRemark] = React.useState("");
  const [statusMessage, setStatusMessage] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;

    async function loadOrder() {
      setIsLoading(true);
      setStatusMessage("");

      try {
        const response = await fetchOrder(orderId);
        if (!isMounted) return;
        applyLoadedOrder(response.data?.data);
      } catch {
        if (!isMounted) return;
        applyLoadedOrder(fallbackOrder || null);
        if (fallbackOrder) {
          setStatusMessage("Backend order details are unavailable. Showing local preview data.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    function applyLoadedOrder(order) {
      setCurrentOrder(order);
      setOrderStatus(order?.orderStatus || "");
      setCourierName(order?.courierName || "");
      setExpectedDeliveryDate(toDateTimeLocalValue(order?.expectedDeliveryDate));
      setTrackingNote("");
      setAdminRemark(order?.notes?.adminRemark || "");
    }

    loadOrder();
    return () => {
      isMounted = false;
    };
  }, [fallbackOrder, orderId]);

  const handleOrderStatusUpdate = async () => {
    if (!currentOrder) return;

    setIsSaving(true);

    try {
      await updateOrderTracking(currentOrder.id, {
        status: orderStatus,
        courierName,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate).toISOString() : null,
        note: trackingNote
      });
    } catch (error) {
      setStatusMessage(error.response?.data?.message || "Unable to update order tracking.");
      setIsSaving(false);
      return;
    }

    const nextTimeline = currentOrder.orderStatus !== orderStatus ? [
      {
        id: `${orderStatus}-${Date.now()}`,
        title: buildTimelineTitle(orderStatus),
        status: orderStatus,
        dateTime: new Date().toISOString(),
        note: trackingNote || "Tracking status updated from admin dashboard."
      },
      ...currentOrder.timeline
    ] : currentOrder.timeline;

    setCurrentOrder({
      ...currentOrder,
      orderStatus,
      courierName,
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate).toISOString() : "",
      timeline: nextTimeline,
      notes: {
        ...currentOrder.notes,
        adminRemark: adminRemark || currentOrder.notes.adminRemark || ""
      }
    });
    setTrackingNote("");
    setStatusMessage(`Tracking updated: ${formatOrderStatusLabel(orderStatus)}${courierName ? ` via ${courierName}` : ""}.`);
    setIsSaving(false);
  };

  if (isLoading) {
    return <p style={{ color: "#64748b" }}>Loading order details...</p>;
  }

  if (!currentOrder) {
    return (
      <div style={{ display: "grid", gap: "16px" }}>
        <div>
          <h2 style={{ margin: 0 }}>Order Details</h2>
          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            We could not find an order matching this admin route.
          </p>
        </div>
        <DetailCard title="Missing Order">
          <p style={{ margin: 0, color: "#475569" }}>
            Return to the orders table and open another order record.
          </p>
          <div>
            <Link to="/dashboard/orders" style={actionLinkStyle}>
              Back to Orders
            </Link>
          </div>
        </DetailCard>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap"
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Order Details</h2>
          <p style={{ margin: "8px 0 0", color: "#698096" }}>
            Review every operational detail of this order from one admin page.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link to="/dashboard/orders" style={secondaryLinkStyle}>
            Back to Orders
          </Link>
          <span style={summaryPillStyle}>{currentOrder.orderNumber}</span>
        </div>
      </div>

      <DetailCard title="Order Summary">
        <div style={detailGridStyle}>
          <div style={detailItemStyle}>
            <span>Order ID</span>
            <strong>{currentOrder.orderNumber}</strong>
          </div>
          <div style={detailItemStyle}>
            <span>Order Date</span>
            <strong>{currentOrder.placedAt}</strong>
          </div>
          <div style={detailItemStyle}>
            <span>Order Status</span>
            <span style={{ ...pillBaseStyle, ...getOrderStatusStyle(currentOrder.orderStatus) }}>
              {formatOrderStatusLabel(currentOrder.orderStatus)}
            </span>
          </div>
          <div style={detailItemStyle}>
            <span>Payment Status</span>
            <span style={{ ...pillBaseStyle, ...getPaymentStatusStyle(currentOrder.paymentStatus) }}>
              {getPaymentBadgeLabel(currentOrder.paymentStatus)}
            </span>
          </div>
          <div style={detailItemStyle}>
            <span>Payment Method</span>
            <strong>{currentOrder.payment.method}</strong>
          </div>
          <div style={detailItemStyle}>
            <span>Items Count</span>
            <strong>{currentOrder.products.length}</strong>
          </div>
          <div style={detailItemStyle}>
            <span>Total Amount</span>
            <strong>{formatCurrency(currentOrder.pricing.grandTotal)}</strong>
          </div>
          <div style={detailItemStyle}>
            <span>Courier Name</span>
            <strong>{currentOrder.courierName || "Not assigned yet"}</strong>
          </div>
          <div style={detailItemStyle}>
            <span>Expected Delivery</span>
            <strong>{currentOrder.expectedDeliveryDate ? formatDateTime(currentOrder.expectedDeliveryDate) : "Not scheduled yet"}</strong>
          </div>
        </div>
      </DetailCard>

      <DetailCard title="Customer Details">
        <div style={detailGridStyle}>
          <div style={detailItemStyle}>
            <span>Customer Name</span>
            <strong>{currentOrder.customer.fullName}</strong>
          </div>
          <div style={detailItemStyle}>
            <span>Email</span>
            <strong>{currentOrder.customer.email}</strong>
          </div>
          <div style={detailItemStyle}>
            <span>Phone Number</span>
            <strong>{currentOrder.customer.phone}</strong>
          </div>
          <div style={detailItemStyle}>
            <span>Customer ID</span>
            <strong>{currentOrder.customer.id}</strong>
          </div>
        </div>
      </DetailCard>

      <div style={twoColumnGridStyle}>
        <DetailCard title="Shipping Address">
          <AddressBlock address={currentOrder.shippingAddress} />
        </DetailCard>

        <DetailCard title="Billing Address">
          <AddressBlock
            address={currentOrder.billingAddress}
            sameAsShipping={isSameAddress(currentOrder.shippingAddress, currentOrder.billingAddress)}
          />
        </DetailCard>
      </div>

      <DetailCard title="Ordered Items">
        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={tableHeadStyle}>Product Image</th>
                <th style={tableHeadStyle}>Product Name</th>
                <th style={tableHeadStyle}>SKU</th>
                <th style={tableHeadStyle}>Variant</th>
                <th style={tableHeadStyle}>Price</th>
                <th style={tableHeadStyle}>Quantity</th>
                <th style={tableHeadStyle}>Total</th>
              </tr>
            </thead>
            <tbody>
              {currentOrder.products.map((item) => (
                <tr key={item.id}>
                  <td style={tableCellStyle}>
                    <div style={productImageCellStyle}>
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          style={productImageStyle}
                        />
                      ) : (
                        <div style={productImagePlaceholderStyle}>No Image</div>
                      )}
                    </div>
                  </td>
                  <td style={tableCellStyle}>
                    <div style={{ display: "grid", gap: "4px" }}>
                      <strong>{item.name}</strong>
                      <p style={mutedTextStyle}>{item.category}</p>
                    </div>
                  </td>
                  <td style={tableCellStyle}>
                    <strong>{item.sku}</strong>
                  </td>
                  <td style={tableCellStyle}>
                    <strong>{item.variantLabel || "Standard"}</strong>
                  </td>
                  <td style={tableCellStyle}>
                    <strong>{formatCurrency(item.unitPrice)}</strong>
                  </td>
                  <td style={tableCellStyle}>
                    <strong>{item.quantity}</strong>
                  </td>
                  <td style={tableCellStyle}>
                    <strong>{formatCurrency(item.lineTotal)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DetailCard>

      <DetailCard title="Payment Details">
        <div style={detailGridStyle}>
          <div style={detailItemStyle}>
            <span>Payment Gateway</span>
            <strong>{formatPaymentGateway(currentOrder.payment.gateway)}</strong>
          </div>
          <div style={detailItemStyle}>
            <span>Payment Status</span>
            <span style={{ ...pillBaseStyle, ...getPaymentStatusStyle(currentOrder.paymentStatus) }}>
              {getPaymentBadgeLabel(currentOrder.paymentStatus)}
            </span>
          </div>
          <div style={detailItemStyle}>
            <span>Razorpay Order ID</span>
            <strong style={breakableValueStyle}>{currentOrder.payment.razorpayOrderId || "Not available"}</strong>
          </div>
          <div style={detailItemStyle}>
            <span>Razorpay Payment ID</span>
            <strong style={breakableValueStyle}>{currentOrder.payment.razorpayPaymentId || "Not available"}</strong>
          </div>
          <div style={detailItemStyle}>
            <span>Paid Date</span>
            <strong>{currentOrder.payment.paidAt ? formatDateTime(currentOrder.payment.paidAt) : "Awaiting payment"}</strong>
          </div>
          <div style={detailItemStyle}>
            <span>Payment Error</span>
            <strong style={breakableValueStyle}>{currentOrder.payment.paymentError || "No payment error"}</strong>
          </div>
          <div style={detailItemStyle}>
            <span>Refund Status</span>
            <strong>{formatRefundStatus(currentOrder.payment.refundStatus)}</strong>
          </div>
        </div>
      </DetailCard>

      <DetailCard title="Tracking Controls">
        <div style={statusUpdateCardStyle}>
          <p style={{ margin: 0, color: "#698096" }}>
            Update tracking details here. Status changes automatically create a new timeline entry.
          </p>

          <label style={fieldStyle}>
            <span>Order Status</span>
            <select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)} style={inputStyle}>
              {orderStatusOptions.map((status) => (
                <option key={status} value={status}>{formatOrderStatusLabel(status)}</option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span>Courier Name</span>
            <input
              type="text"
              value={courierName}
              onChange={(event) => setCourierName(event.target.value)}
              placeholder="Blue Dart, Delhivery, etc."
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span>Expected Delivery Date</span>
            <input
              type="datetime-local"
              value={expectedDeliveryDate}
              onChange={(event) => setExpectedDeliveryDate(event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span>Tracking Note</span>
            <textarea
              value={trackingNote}
              onChange={(event) => setTrackingNote(event.target.value)}
              placeholder="Delayed due to weather, assigned to courier hub, customer requested reschedule..."
              style={textareaStyle}
            />
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <p style={{ margin: 0, color: "#698096" }}>
            {statusMessage || "Choose a status and update the order flow."}
          </p>
          <button type="button" style={primaryButtonStyle} onClick={handleOrderStatusUpdate} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Tracking Update"}
          </button>
        </div>
      </DetailCard>

      <div style={twoColumnGridStyle}>
        <DetailCard title="Notes / Timeline">
          <div style={{ display: "grid", gap: "10px" }}>
            <div style={noteBlockStyle}>
              <strong>Customer Note</strong>
              <p style={mutedTextStyle}>{currentOrder.notes.customerNote || "No customer note added."}</p>
            </div>
            <div style={noteBlockStyle}>
              <strong>Admin Remark</strong>
              <p style={mutedTextStyle}>{adminRemark || "No admin remark added."}</p>
            </div>
          </div>
        </DetailCard>

        <DetailCard title="Order Timeline">
          <div style={{ display: "grid", gap: "10px" }}>
            {currentOrder.timeline.map((event) => (
              <div key={event.id} style={timelineItemStyle}>
                <div>
                  <strong>{event.title}</strong>
                  <p style={mutedTextStyle}>{event.note || "No note added."}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong>{formatOrderStatusLabel(event.status)}</strong>
                  <p style={mutedTextStyle}>{event.dateTime}</p>
                </div>
              </div>
            ))}
          </div>
        </DetailCard>
      </div>
    </div>
  );
}

function AddressBlock({ address, sameAsShipping = false }) {
  return (
    <div style={{ display: "grid", gap: "12px" }}>
      {sameAsShipping ? (
        <div style={addressNoticeStyle}>
          Billing and shipping address are the same for this order.
        </div>
      ) : null}

      <div style={addressGridStyle}>
        <div style={detailItemStyle}>
          <span>Full Name</span>
          <strong>{address.fullName || "Not available"}</strong>
        </div>
        <div style={detailItemStyle}>
          <span>Phone</span>
          <strong>{address.phone || "Not available"}</strong>
        </div>
        <div style={detailItemStyle}>
          <span>Address line 1</span>
          <strong>{address.line1 || "Not available"}</strong>
        </div>
        <div style={detailItemStyle}>
          <span>Address line 2</span>
          <strong>{address.line2 || "Same as line 1 / Not provided"}</strong>
        </div>
        <div style={detailItemStyle}>
          <span>City</span>
          <strong>{address.city || "Not available"}</strong>
        </div>
        <div style={detailItemStyle}>
          <span>State</span>
          <strong>{address.state || "Not available"}</strong>
        </div>
        <div style={detailItemStyle}>
          <span>Pincode</span>
          <strong>{address.postalCode || "Not available"}</strong>
        </div>
        <div style={detailItemStyle}>
          <span>Country</span>
          <strong>{address.country || "Not available"}</strong>
        </div>
      </div>
    </div>
  );
}

function isSameAddress(firstAddress, secondAddress) {
  if (!firstAddress || !secondAddress) {
    return false;
  }

  return [
    "fullName",
    "phone",
    "line1",
    "line2",
    "city",
    "state",
    "postalCode",
    "country"
  ].every((field) => (firstAddress[field] || "") === (secondAddress[field] || ""));
}

function getPaidAmountLabel(order) {
  if (order.paymentStatus === "paid" || order.paymentStatus === "partially-refunded") {
    return formatCurrency(order.pricing.grandTotal);
  }

  if (order.paymentStatus === "refunded") {
    return `${formatCurrency(order.pricing.grandTotal)} refunded`;
  }

  return "Awaiting payment";
}

function formatPaymentGateway(value) {
  const gateway = String(value || "").trim();
  if (!gateway) return "Not available";
  return gateway.toLowerCase() === "razorpay" ? "Razorpay" : gateway;
}

function formatRefundStatus(value) {
  const normalized = String(value || "not_refunded").replaceAll("-", "_");
  if (normalized === "refunded") return "Refunded";
  if (normalized === "partially_refunded") return "Partially Refunded";
  return "Not Refunded";
}

function formatDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function toDateTimeLocalValue(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const pad = (part) => String(part).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildTimelineTitle(status) {
  if (status === "pending") return "Order pending";
  if (status === "confirmed") return "Order confirmed";
  if (status === "packed") return "Order packed";
  if (status === "shipped") return "Order shipped";
  if (status === "out_for_delivery") return "Out for delivery";
  if (status === "delivered") return "Order delivered";
  if (status === "cancelled") return "Order cancelled";
  if (status === "returned") return "Order returned";
  return "Order updated";
}

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

const detailGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "12px"
};

const statusUpdateCardStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(240px, 1fr))",
  gap: "14px"
};

const addressGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px"
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

const timelineItemStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #e5edf5",
  background: "#f8fafc"
};

const noteBlockStyle = {
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #e5edf5",
  background: "#f8fafc",
  display: "grid",
  gap: "8px"
};

const addressNoticeStyle = {
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  fontWeight: 600
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
  minWidth: "820px",
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

const productImageCellStyle = {
  width: "64px",
  height: "64px",
  borderRadius: "12px",
  overflow: "hidden",
  background: "#f8fafc",
  border: "1px solid #e5edf5",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const productImageStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block"
};

const productImagePlaceholderStyle = {
  padding: "8px",
  textAlign: "center",
  fontSize: "11px",
  fontWeight: 700,
  color: "#8aa0b5"
};

const fieldStyle = {
  display: "grid",
  gap: "8px",
  color: "#334155",
  fontWeight: 600
};

const inputStyle = {
  width: "100%",
  minHeight: "36px",
  padding: "0 12px",
  borderRadius: "10px",
  border: "1px solid #d4dbe6",
  boxSizing: "border-box",
  background: "#fff",
  color: "#0f172a",
  fontSize: "14px"
};

const textareaStyle = {
  minHeight: "110px",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #d4dbe6",
  boxSizing: "border-box",
  background: "#fff",
  color: "#0f172a",
  fontSize: "14px",
  resize: "vertical",
  fontFamily: "inherit"
};

const actionLinkStyle = {
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

const summaryPillStyle = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "34px",
  padding: "0 12px",
  borderRadius: "999px",
  background: "#ffffff",
  border: "1px solid #edf2f7",
  color: "#475569",
  fontWeight: 700,
  fontSize: "12px",
  boxShadow: "0 6px 16px rgba(15, 23, 42, 0.04)"
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

const breakableValueStyle = {
  overflowWrap: "anywhere"
};
