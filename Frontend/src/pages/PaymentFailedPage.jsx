import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  createRazorpayPaymentOrder,
  getRazorpayPaymentStatus,
  launchRazorpayCheckout,
  verifyRazorpayPayment
} from "../api/orderApi";

function formatPaymentStatus(value) {
  const status = String(value || "pending").toLowerCase();
  return status === "failed" ? "Failed" : status === "paid" ? "Paid" : "Pending";
}

export default function PaymentFailedPage({ context }) {
  const { orderNumber } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const initialContact = state?.contact || context.customerProfile?.contact || context.customerProfile?.email || "";
  const [contact, setContact] = useState(initialContact);
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [message, setMessage] = useState(state?.message || "Your payment could not be completed.");
  const [isLoading, setIsLoading] = useState(Boolean(initialContact));
  const [isRetrying, setIsRetrying] = useState(false);
  const supportEmail = context.siteSettings?.general?.supportEmail || "support@avyona.com";
  const storeName = context.siteSettings?.general?.storeName || "Avyona";

  useEffect(() => {
    if (!initialContact) return;
    let active = true;

    getRazorpayPaymentStatus({
      orderId: state?.orderId,
      orderNumber,
      contact: initialContact
    })
      .then((response) => {
        if (!active) return;
        const status = response.data || {};
        if (status.paymentStatus === "paid") {
          navigate(`/order-confirmation/${orderNumber}`, {
            replace: true,
            state: {
              orderNumber,
              contact: initialContact,
              paymentMethod: "razorpay",
              paymentStatus: "paid",
              orderStatus: status.status || "confirmed"
            }
          });
          return;
        }
        setPaymentStatus(status.paymentStatus || "pending");
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [initialContact, navigate, orderNumber, state?.orderId]);

  async function retryPayment() {
    const verifiedContact = contact.trim();
    if (!verifiedContact) {
      setMessage("Enter the email address or phone number used for this order.");
      return;
    }

    setIsRetrying(true);
    try {
      const gatewayResponse = await createRazorpayPaymentOrder({
        orderId: state?.orderId,
        orderNumber,
        contact: verifiedContact
      });
      const gatewayOrder = gatewayResponse.data || {};
      const paymentResponse = await launchRazorpayCheckout({
        key: gatewayOrder.keyId,
        amount: gatewayOrder.amount,
        currency: gatewayOrder.currency || "INR",
        name: storeName,
        description: gatewayOrder.description || "Order Payment",
        order_id: gatewayOrder.razorpayOrderId,
        notes: { order_number: orderNumber },
        theme: { color: "#23844f" }
      });
      const verificationResponse = await verifyRazorpayPayment({
        orderId: state?.orderId,
        orderNumber,
        contact: verifiedContact,
        razorpayOrderId: paymentResponse.razorpay_order_id,
        razorpayPaymentId: paymentResponse.razorpay_payment_id,
        razorpaySignature: paymentResponse.razorpay_signature
      });
      const verified = verificationResponse.data || {};
      context.setCart([]);
      context.notify("Payment successful. Order confirmed.");
      navigate(`/order-confirmation/${orderNumber}`, {
        replace: true,
        state: {
          orderNumber,
          contact: verifiedContact,
          paymentMethod: "razorpay",
          paymentStatus: verified.paymentStatus || "paid",
          orderStatus: verified.status || "confirmed"
        }
      });
    } catch (error) {
      setMessage(error.message || "Payment could not be completed.");
      setPaymentStatus("failed");
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <main className="payment-result-page">
      <section className="payment-result-card payment-result-card-error">
        <span className="payment-result-icon" aria-hidden="true">!</span>
        <p className="payment-result-label">PAYMENT INCOMPLETE</p>
        <h1>Payment could not be completed</h1>
        <p>{message}</p>

        <dl className="payment-result-details">
          <div><dt>Order ID</dt><dd>{orderNumber}</dd></div>
          <div><dt>Payment Status</dt><dd>{isLoading ? "Checking..." : formatPaymentStatus(paymentStatus)}</dd></div>
        </dl>

        {!initialContact ? (
          <label className="payment-result-contact">
            <span>Email or phone used for this order</span>
            <input value={contact} onChange={(event) => setContact(event.target.value)} />
          </label>
        ) : null}

        <p className="payment-result-help">
          Your order already exists and remains pending until payment is verified. If money was deducted, contact{" "}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
        </p>
        <div className="payment-result-actions">
          <button className="primary-button" type="button" onClick={retryPayment} disabled={isRetrying || isLoading}>
            {isRetrying ? "Opening Payment..." : "Retry Payment"}
          </button>
          <Link className="secondary-button" to="/contact-us">Contact Support</Link>
        </div>
      </section>
    </main>
  );
}
