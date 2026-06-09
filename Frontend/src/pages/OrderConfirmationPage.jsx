import React, { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { formatCurrency } from "../utils/storefront";
import ProductCard from "../components/product/ProductCard";
import { trackStorefrontOrder } from "../api/orderApi";
import { getCustomerToken } from "../api/customerApi";
import { resolveMediaUrl } from "../utils/media";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api/v1";

const PAYMENT_LABELS = {
  cod: "Cash on Delivery",
  razorpay: "Razorpay",
  stripe: "Stripe",
  phonepe: "PhonePe",
  test_success: "Test Payment (Success)",
  test_failure: "Test Payment (Failed)"
};

function getPaymentLabel(method) {
  return PAYMENT_LABELS[String(method || "").toLowerCase()] || String(method || "-");
}

function getStatusChip(paymentStatus) {
  if (paymentStatus === "paid") return { label: "Paid", tone: "success" };
  if (paymentStatus === "authorized") return { label: "Authorized", tone: "success" };
  if (paymentStatus === "cod_pending") return { label: "Pay on Delivery", tone: "info" };
  if (paymentStatus === "failed") return { label: "Payment Failed", tone: "error" };
  return { label: "Pending", tone: "neutral" };
}

function formatStatus(value, fallback = "-") {
  const status = String(value || "").trim();
  if (!status) return fallback;
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatOrderDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function buildAddressString(address) {
  if (!address) return "";
  return [
    address.line1,
    address.line2,
    address.city,
    address.state && address.pincode ? `${address.state} - ${address.pincode}` : address.state || address.pincode
  ].filter(Boolean).join(", ");
}

function getThankYouButtonClass(style) {
  if (style === "ghost") return "thankyou-button-ghost";
  if (style === "primary") return "primary-button";
  return "secondary-button";
}

function getBannerCopy(paymentStatus, settings) {
  if (paymentStatus === "failed") {
    return {
      label: "PAYMENT FAILED",
      title: "Payment could not be completed",
      subtitle: "Your order was recorded for review. Please retry payment or contact support if money was deducted."
    };
  }

  return {
    label: settings.confirmationLabel || "ORDER CONFIRMED",
    title: settings.successTitle || "Thank you for your order",
    subtitle: settings.successSubtitle || "Your order has been placed successfully."
  };
}

export default function OrderConfirmationPage({ context }) {
  const { orderNumber } = useParams();
  const { state } = useLocation();
  const storedItems = context.orders.filter((order) => order.orderNumber === orderNumber);
  const storedFirst = storedItems[0] || {};
  const initialContact = (
    state?.contact ||
    storedFirst.contact ||
    context.customerProfile?.contact ||
    context.customerProfile?.email ||
    ""
  );

  const [fetchState, setFetchState] = useState(initialContact ? "loading" : "needs-contact");
  const [apiOrder, setApiOrder] = useState(null);
  const [contactInput, setContactInput] = useState("");
  const [contactError, setContactError] = useState("");

  useEffect(() => {
    if (!orderNumber || !initialContact) return;
    fetchOrderDetails(initialContact);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber]);

  async function fetchOrderDetails(contact) {
    setFetchState("loading");
    try {
      const response = await trackStorefrontOrder({ orderNumber, contact });
      setApiOrder(response.data?.data || response.data || null);
      setFetchState("ready");
    } catch {
      setFetchState(state?.items || storedItems.length ? "fallback" : "error");
    }
  }

  function handleContactSubmit(event) {
    event.preventDefault();
    const trimmed = contactInput.trim();
    if (!trimmed) {
      setContactError("Please enter your email address or phone number.");
      return;
    }
    setContactError("");
    fetchOrderDetails(trimmed);
  }

  if (!orderNumber) return <Navigate to="/" replace />;

  let items = [];
  let total = 0;
  let subtotal = 0;
  let discount = 0;
  let creditDiscount = 0;
  let couponCode = "";
  let shipping = 0;
  let paymentMethod = "";
  let paymentStatus = "";
  let orderStatus = "";
  let deliveryAddress = "";
  let contact = initialContact;
  let date = "";

  if (apiOrder) {
    items = (apiOrder.orderedItems || []).map((item) => ({
      name: item.name,
      category: item.category || "",
      quantity: Number(item.quantity || 1),
      total: Number(item.total || 0),
      image: item.image || "",
      slug: item.slug || ""
    }));
    subtotal = Number(apiOrder.summary?.subtotal || 0);
    total = Number(apiOrder.summary?.totalAmount || 0);
    discount = Number(apiOrder.summary?.couponDiscount || 0);
    creditDiscount = Number(apiOrder.summary?.creditDiscount || 0);
    couponCode = apiOrder.summary?.couponCode || "";
    shipping = Number(apiOrder.summary?.shippingFee || 0);
    paymentMethod = apiOrder.paymentMethod || "";
    paymentStatus = apiOrder.paymentStatus || "";
    orderStatus = apiOrder.status || "";
    deliveryAddress = buildAddressString(apiOrder.deliveryAddress);
    contact = apiOrder.deliveryAddress?.email || apiOrder.deliveryAddress?.phone || initialContact;
    date = formatOrderDate(apiOrder.summary?.placedAt);
  } else {
    items = state?.items || storedItems;
    total = Number(state?.total ?? storedFirst.orderTotal ?? 0);
    discount = Number(state?.discount ?? storedFirst.discount ?? 0);
    creditDiscount = Number(state?.creditDiscount ?? storedFirst.creditDiscount ?? 0);
    couponCode = state?.couponCode ?? storedFirst.couponCode ?? "";
    shipping = Number(state?.shipping ?? storedFirst.shipping ?? 0);
    subtotal = Math.max(0, total + discount + creditDiscount - shipping);
    paymentMethod = state?.paymentMethod ?? storedFirst.paymentMethod ?? "";
    paymentStatus = state?.paymentStatus ?? storedFirst.paymentStatus ?? "";
    orderStatus = state?.orderStatus ?? storedFirst.orderStatus ?? storedFirst.status ?? "";
    deliveryAddress = state?.deliveryAddress ?? storedFirst.deliveryAddress ?? "";
    contact = state?.contact ?? storedFirst.contact ?? initialContact;
    date = state?.date ?? storedFirst.date ?? "";
  }

  const thankYouSettings = context.siteSettings?.thankYouPage || {};
  const statusChip = getStatusChip(paymentStatus);
  const bannerCopy = getBannerCopy(paymentStatus, thankYouSettings);
  const showMessage = thankYouSettings.showThankYouMessage !== false;
  const showTrackOrder = thankYouSettings.showTrackOrderButton !== false;
  const showContinueShopping = thankYouSettings.showContinueShoppingButton !== false;
  const showInvoice = Boolean(thankYouSettings.showDownloadInvoiceButton);
  const useCustomIcon = Boolean(thankYouSettings.useCustomIcon && thankYouSettings.customIconUrl && paymentStatus !== "failed");

  async function handleDownloadInvoice() {
    const token = getCustomerToken();
    const invoiceUrl = `${API_BASE_URL}/orders/${encodeURIComponent(orderNumber)}/invoice`;

    if (token) {
      try {
        const response = await fetch(invoiceUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error("Unable to download invoice");
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `invoice-${orderNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
      } catch {
        alert("Unable to download invoice. Please try again.");
      }
      return;
    }

    if (!contact) {
      alert("Contact information is required to download the invoice. Please track your order instead.");
      return;
    }
    window.open(`${invoiceUrl}?contact=${encodeURIComponent(contact)}`, "_blank", "noopener,noreferrer");
  }

  const purchasedSlugs = new Set(items.map((item) => item.slug).filter(Boolean));
  const recommended = (context.allProducts || [])
    .filter((product) => !purchasedSlugs.has(product.slug) && product.availableStock > 0)
    .slice(0, 4);

  if (fetchState === "loading") {
    return (
      <main className="container thankyou-page">
        <section className="thankyou-banner">
          <div className="thankyou-banner-body">
            <p className="eyebrow">Just a moment...</p>
            <h1>Loading your order</h1>
            <p className="thankyou-banner-sub">Fetching your order details from our server.</p>
          </div>
        </section>
      </main>
    );
  }

  if (fetchState === "needs-contact") {
    return (
      <main className="container thankyou-page">
        <section className="thankyou-banner">
          <div className="thankyou-banner-body">
            <p className="eyebrow">Verify Your Order</p>
            <h1>Enter your details to view this order</h1>
            <p className="thankyou-banner-sub">
              Enter the email address or phone number used at checkout for order <strong>{orderNumber}</strong>.
            </p>
          </div>
        </section>
        <section className="thankyou-actions" style={{ flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <form onSubmit={handleContactSubmit} style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
            <input
              type="text"
              value={contactInput}
              onChange={(event) => setContactInput(event.target.value)}
              placeholder="Email address or phone number"
              style={{ padding: "0 16px", minHeight: "48px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "15px", minWidth: "260px" }}
            />
            <button type="submit" className="primary-button">View Order</button>
          </form>
          {contactError ? <p style={{ color: "#dc2626", fontSize: "14px", margin: 0 }}>{contactError}</p> : null}
          <Link to="/track-order" className="secondary-button" style={{ marginTop: "4px" }}>Track Order Instead</Link>
        </section>
      </main>
    );
  }

  if (fetchState === "error") {
    return (
      <main className="container thankyou-page">
        <section className="thankyou-banner thankyou-banner-error">
          <div className="thankyou-banner-body">
            <p className="eyebrow">Order Lookup</p>
            <h1>We could not find your order</h1>
            <p className="thankyou-banner-sub">Please double-check your order number and contact details.</p>
          </div>
        </section>
        <section className="thankyou-actions">
          <Link className="primary-button" to="/track-order">Track Order</Link>
          <Link className="secondary-button" to="/collections">Continue Shopping</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="container thankyou-page">
      <section className={`thankyou-banner ${paymentStatus === "failed" ? "thankyou-banner-error" : ""}`}>
        <div className="thankyou-banner-icon" aria-hidden="true">
          {useCustomIcon ? (
            <img className="thankyou-custom-icon" src={thankYouSettings.customIconUrl} alt="" />
          ) : paymentStatus === "failed" ? (
            <span className="thankyou-error-icon">!</span>
          ) : (
            <svg className="thankyou-check-svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle className="thankyou-check-circle" cx="36" cy="36" r="34" />
              <path className="thankyou-check-path" d="M20 37L30 47L52 25" />
            </svg>
          )}
        </div>
        <div className="thankyou-banner-body">
          {showMessage ? (
            <>
              <p className="eyebrow">{bannerCopy.label}</p>
              <h1>{bannerCopy.title}</h1>
              <p className="thankyou-banner-sub">{bannerCopy.subtitle}</p>
            </>
          ) : null}
          <div className="thankyou-order-badge">
            <span>Order ID</span>
            <strong>{orderNumber}</strong>
            {date ? <span className="thankyou-order-date">{date}</span> : null}
          </div>
        </div>
      </section>

      {items.length > 0 ? (
        <div className="thankyou-grid">
          <article className="thankyou-card">
            <h2 className="thankyou-card-title">Order Summary</h2>
            <div className="thankyou-items">
              {items.map((item, index) => (
                <div key={`${item.slug || item.name}:${index}`} className="thankyou-item">
                  {item.image ? (
                    <img src={resolveMediaUrl(item.image)} alt={item.name} className="thankyou-item-img" />
                  ) : (
                    <div className="thankyou-item-img" style={{ background: "#f1f5f9" }} />
                  )}
                  <div className="thankyou-item-info">
                    <strong>{item.name}</strong>
                    {item.category ? <span>{item.category}</span> : null}
                  </div>
                  <span className="thankyou-item-qty">x{item.quantity}</span>
                  <strong className="thankyou-item-price">{formatCurrency(item.total, context)}</strong>
                </div>
              ))}
            </div>

            <div className="thankyou-totals">
              <div className="thankyou-total-row"><span>Subtotal</span><span>{formatCurrency(subtotal, context)}</span></div>
              {discount > 0 ? (
                <div className="thankyou-total-row thankyou-discount-row">
                  <span>{couponCode ? `Coupon (${couponCode})` : "Coupon Discount"}</span>
                  <span>-{formatCurrency(discount, context)}</span>
                </div>
              ) : null}
              {creditDiscount > 0 ? (
                <div className="thankyou-total-row thankyou-discount-row">
                  <span>Credit Points</span>
                  <span>-{formatCurrency(creditDiscount, context)}</span>
                </div>
              ) : null}
              <div className="thankyou-total-row"><span>Shipping</span><span>{shipping > 0 ? formatCurrency(shipping, context) : "Free"}</span></div>
              <div className="thankyou-total-row thankyou-grand-total"><span>Total</span><strong>{formatCurrency(total, context)}</strong></div>
            </div>
          </article>

          <div className="thankyou-aside">
            <article className="thankyou-card">
              <h2 className="thankyou-card-title">Delivery Details</h2>
              <dl className="thankyou-detail-list">
                {deliveryAddress ? <div className="thankyou-detail-row"><dt>Address</dt><dd>{deliveryAddress}</dd></div> : null}
                {contact ? <div className="thankyou-detail-row"><dt>Email / Phone</dt><dd>{contact}</dd></div> : null}
              </dl>
            </article>

            <article className="thankyou-card">
              <h2 className="thankyou-card-title">Payment Details</h2>
              <dl className="thankyou-detail-list">
                <div className="thankyou-detail-row">
                  <dt>Order Status</dt>
                  <dd>
                    <span className={`thankyou-status-chip thankyou-status-${paymentStatus === "failed" ? "error" : "success"}`}>
                      {formatStatus(orderStatus, paymentStatus === "paid" ? "Confirmed" : "Pending")}
                    </span>
                  </dd>
                </div>
                <div className="thankyou-detail-row"><dt>Payment Method</dt><dd>{getPaymentLabel(paymentMethod)}</dd></div>
                <div className="thankyou-detail-row">
                  <dt>Payment Status</dt>
                  <dd><span className={`thankyou-status-chip thankyou-status-${statusChip.tone}`}>{statusChip.label}</span></dd>
                </div>
                {paymentStatus === "paid" ? (
                  <div className="thankyou-detail-row"><dt>Message</dt><dd>Payment successful</dd></div>
                ) : null}
              </dl>
            </article>
          </div>
        </div>
      ) : null}

      <section className="thankyou-actions">
        {showTrackOrder ? (
          <Link className={getThankYouButtonClass(thankYouSettings.trackOrderButtonStyle)} to="/track-order">
            {thankYouSettings.trackOrderButtonText || "Track Order"}
          </Link>
        ) : null}
        {showInvoice ? (
          <button className={getThankYouButtonClass(thankYouSettings.downloadInvoiceButtonStyle)} type="button" onClick={handleDownloadInvoice}>
            {thankYouSettings.downloadInvoiceButtonText || "Download Invoice"}
          </button>
        ) : null}
        {showContinueShopping ? (
          <Link className={getThankYouButtonClass(thankYouSettings.continueShoppingButtonStyle)} to="/collections">
            {thankYouSettings.continueShoppingButtonText || "Continue Shopping"}
          </Link>
        ) : null}
      </section>

      {recommended.length > 0 ? (
        <section className="thankyou-recs">
          <div className="thankyou-recs-header">
            <h2>You Might Also Like</h2>
            <Link to="/collections" className="eyebrow" style={{ textDecoration: "none" }}>View All</Link>
          </div>
          <div className="thankyou-recs-grid">
            {recommended.map((product) => (
              <ProductCard key={product.slug} product={product} context={context} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
