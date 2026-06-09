import React from "react";
import { resolveMediaUrl } from "../utils/media";
import { formatCurrency } from "../utils/storefront";
import { trackStorefrontOrder } from "../api/orderApi";
import { formatOrderStatusLabel, ORDER_STATUS_FLOW } from "../../../shared/orderStatusFlow";

function formatDateTime(value) {
  if (!value) return "Not available";

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

function getOrderStatusClass(status) {
  if (status === "delivered") return "delivered";
  if (status === "out_for_delivery") return "out-for-delivery";
  if (status === "shipped") return "shipped";
  if (status === "packed") return "packed";
  if (status === "confirmed") return "confirmed";
  if (status === "cancelled" || status === "returned") return "cancelled";
  return "pending";
}

function getStepState(stepStatus, currentStatus) {
  const currentIndex = ORDER_STATUS_FLOW.indexOf(currentStatus);
  const stepIndex = ORDER_STATUS_FLOW.indexOf(stepStatus);

  if (stepIndex === -1 || currentIndex === -1) {
    return "upcoming";
  }

  if (stepIndex < currentIndex) {
    return "completed";
  }

  if (stepIndex === currentIndex) {
    return "current";
  }

  return "upcoming";
}

function getTimelineStepTitle(stepStatus) {
  if (stepStatus === "pending") return "Order Placed";
  if (stepStatus === "confirmed") return "Confirmed";
  if (stepStatus === "packed") return "Packed";
  if (stepStatus === "shipped") return "Shipped";
  if (stepStatus === "out_for_delivery") return "Out for Delivery";
  if (stepStatus === "delivered") return "Delivered";
  if (stepStatus === "cancelled") return "Cancelled";
  if (stepStatus === "returned") return "Returned";
  return formatOrderStatusLabel(stepStatus);
}

function buildTimelineSteps(order) {
  const statusTimeline = order.statusTimeline || [];

  return ORDER_STATUS_FLOW.map((stepStatus) => {
    const matchedEvents = statusTimeline.filter((event) => event.status === stepStatus);
    const latestEvent = matchedEvents[matchedEvents.length - 1] || null;

    return {
      status: stepStatus,
      title: latestEvent?.title || getTimelineStepTitle(stepStatus),
      dateTime: latestEvent?.dateTime || "",
      note: latestEvent?.note || "",
      state: getStepState(stepStatus, order.status)
    };
  });
}

function getPaymentStatusLabel(status) {
  if (status === "paid" || status === "authorized") return "Paid";
  if (status === "partially-refunded") return "Partially Refunded";
  if (status === "refunded") return "Refunded";
  if (status === "cod-pending") return "Cash on Delivery";
  if (status === "pending" || status === "failed") return "Pending";
  return formatOrderStatusLabel(status);
}

export default function TrackOrderPage({ context }) {
  const siteSettings = context?.siteSettings || {};
  const trackingSettings = siteSettings.tracking || {};
  const [orderId, setOrderId] = React.useState("");
  const [contactValue, setContactValue] = React.useState("");
  const [searched, setSearched] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [errorMessage, setErrorMessage] = React.useState("");

  const handleTrackOrder = async (event) => {
    event.preventDefault();

    const safeOrderId = orderId.trim().toLowerCase();
    const safeContact = contactValue.trim().toLowerCase();

    setSearched(true);
    setErrorMessage("");

    try {
      const response = await trackStorefrontOrder({ orderNumber: safeOrderId, contact: safeContact });
      setResult(response.data || null);
      return;
    } catch (error) {
      setResult(null);
      setErrorMessage(error.message || "We could not find an order matching that Order ID and email/phone combination.");
    }
  };

  return (
    <main className="container track-order-page">
      {trackingSettings.trackingPageEnabled === false ? (
        <section className="track-order-feedback is-error">
          Order tracking is currently disabled by the admin team. Please contact support for order updates.
        </section>
      ) : null}

      <section className="track-order-hero">
        <span className="track-order-eyebrow">Order Tracking</span>
        <h1>Track Your Order</h1>
        <p>Enter your Order ID and the email or phone used at checkout to see the latest delivery progress.</p>
      </section>

      <section className="track-order-search-card">
        <form className="track-order-form" onSubmit={handleTrackOrder}>
          <label className="track-order-field">
            <span>Order ID</span>
            <input
              type="text"
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              placeholder={`Example: ${(trackingSettings.orderIdPrefix || "AVY")}-1001`}
            />
          </label>

          <label className="track-order-field">
            <span>Email or Phone</span>
            <input
              type="text"
              value={contactValue}
              onChange={(event) => setContactValue(event.target.value)}
              placeholder="example@email.com or +91 9876543210"
            />
          </label>

          <button className="track-order-submit" type="submit">
            Track Order
          </button>
        </form>

        <p className="track-order-help">
          Use the Order ID from your confirmation message with the email or phone used at checkout.
        </p>
      </section>

      {errorMessage ? (
        <section className="track-order-feedback is-error">
          {errorMessage}
        </section>
      ) : null}

      {result ? (
        <section className="track-order-result">
          <div className="track-order-summary-grid">
            <article className="track-order-card">
              <span className="track-order-card-label">Order Summary</span>
              <h2>{result.orderId}</h2>
              <div className="track-order-meta-grid">
                <div>
                  <span>Placed On</span>
                  <strong>{formatDateTime(result.summary.placedAt)}</strong>
                </div>
                <div>
                  <span>Total Amount</span>
                  <strong>{formatCurrency(result.summary.totalAmount, context)}</strong>
                </div>
                <div>
                  <span>Payment Status</span>
                  <strong>{getPaymentStatusLabel(result.paymentStatus)}</strong>
                </div>
              </div>
            </article>

            <article className="track-order-card">
              <span className="track-order-card-label">Current Status</span>
              <div className={`track-order-status-badge is-${getOrderStatusClass(result.status)}`}>
                {formatOrderStatusLabel(result.status)}
              </div>
              <div className="track-order-meta-grid">
                <div>
                  <span>Courier</span>
                  <strong>{result.courierName || "To be assigned"}</strong>
                </div>
                <div>
                  <span>Expected Delivery</span>
                  <strong>{formatDateTime(result.expectedDeliveryDate)}</strong>
                </div>
              </div>
            </article>
          </div>

          <div className="track-order-content-grid">
            <article className="track-order-card">
              <span className="track-order-card-label">Delivery Details</span>
              <div className="track-order-address">
                <strong>{result.deliveryAddress.fullName}</strong>
                <p>{result.deliveryAddress.line1}</p>
                <p>{result.deliveryAddress.line2}</p>
                <p>{`${result.deliveryAddress.city}, ${result.deliveryAddress.state} ${result.deliveryAddress.pincode}`}</p>
                <p>{result.deliveryAddress.country}</p>
                <p>{result.deliveryAddress.phone}</p>
              </div>
            </article>

            <article className="track-order-card">
              <span className="track-order-card-label">Ordered Products</span>
              <div className="track-order-items">
                {result.orderedItems.map((item) => (
                  <div key={item.id} className="track-order-item">
                    <img src={resolveMediaUrl(item.image)} alt={item.name} />
                    <div>
                      <strong>{item.name}</strong>
                      <p>{`Qty: ${item.quantity}`}</p>
                      <p>{formatCurrency(item.price, context)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <article className="track-order-card track-order-timeline-card">
            <span className="track-order-card-label">Tracking Timeline</span>
            <p className="track-order-timeline-intro">
              {trackingSettings.defaultStatusMessages || "This timeline is driven by the order statusTimeline history."}
            </p>
            <div className="track-order-timeline">
              {buildTimelineSteps(result).map((event) => (
                <div key={event.status} className={`track-order-timeline-item is-${event.state}`}>
                  <div className={`track-order-timeline-dot is-${event.state}`} />
                  <div className="track-order-timeline-content">
                    <div className="track-order-timeline-head">
                      <strong>{event.title}</strong>
                      <span>{event.dateTime ? formatDateTime(event.dateTime) : "Awaiting update"}</span>
                    </div>
                    <p>{formatOrderStatusLabel(event.status)}</p>
                    <small>{event.note || (event.state === "upcoming" ? "This step has not been reached yet." : "Status update recorded.")}</small>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {!result && !errorMessage && searched ? (
        <section className="track-order-feedback">
          Enter a valid Order ID and email/phone combination to see tracking details.
        </section>
      ) : null}
    </main>
  );
}
