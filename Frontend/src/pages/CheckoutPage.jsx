import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trackAnalyticsEvent } from "../api/analyticsApi";
import { applyCustomerCreditPoints, fetchCustomerWallet } from "../api/customerApi";
import {
  formatCurrency,
  getCheckoutPaymentMethods,
  getCheckoutShippingOptions,
  getMergedProfile,
  readStorage,
  writeStorage
} from "../utils/storefront";
import { couponRules, validateCoupon } from "../../../shared/coupons";
import { validateCheckoutCoupon } from "../api/couponApi";
import { createStorefrontOrder } from "../api/orderApi";

export default function CheckoutPage({ context }) {
  const navigate = useNavigate();
  const availableCoupons = context.coupons?.length ? context.coupons : couponRules;
  const siteSettings = context.siteSettings || {};
  const general = siteSettings.general || {};
  const paymentSettings = siteSettings.payment || {};
  const shippingSettings = siteSettings.shipping || {};
  const paymentIcons = [];
  const shippingOptions = getCheckoutShippingOptions(context);
  const paymentMethods = getCheckoutPaymentMethods(context);
  const mergedProfile = getMergedProfile(context.authUser, context.customerProfile);
  const [savedFirstName = "", ...savedLastParts] = mergedProfile.fullName.split(/\s+/).filter(Boolean);
  const savedLastName = savedLastParts.join(" ");
  const [form, setForm] = useState({
    contact: context.customerProfile.contact || mergedProfile.email || "",
    firstName: context.customerProfile.firstName || savedFirstName,
    lastName: context.customerProfile.lastName || savedLastName,
    address1: context.customerProfile.address || "",
    address2: "",
    companyName: "",
    city: "",
    state: "Telangana",
    pinCode: String(context.customerProfile.address || "").match(/\b(\d{6})\b/)?.[1] || "",
    phone: mergedProfile.mobile || "",
    shippingMethod: shippingOptions[0]?.id || "standard",
    paymentMethod: paymentMethods[0]?.id || "phonepe",
    billingAddress: "same",
    checkoutMode: context.authUser ? "login" : "guest"
  });
  const [couponCode, setCouponCode] = useState(() => readStorage("avyonaPendingCoupon", ""));
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponMessage, setCouponMessage] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [pointsInput, setPointsInput] = useState("");
  const [appliedPoints, setAppliedPoints] = useState(0);
  const [pointsMessage, setPointsMessage] = useState("");
  const [walletData, setWalletData] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const checkoutTrackedRef = useRef(false);
  const subtotal = context.cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  const customerAvailablePoints = walletData?.availablePoints || 0;
  const pointsPerRupee   = walletData?.pointsPerRupee   || 10;
  const maxRedeemPercent = walletData?.maxRedeemPercent || 20;
  const minRedeemPoints  = walletData?.minRedeemPoints  || 100;
  const maxDiscountRupees = Math.floor(subtotal * (maxRedeemPercent / 100));
  const maxPointsUsable   = Math.min(customerAvailablePoints, maxDiscountRupees * pointsPerRupee);
  const selectedShipping = shippingOptions.find((option) => option.id === form.shippingMethod) || shippingOptions[0];
  const shipping = Number(selectedShipping?.price || 0);
  const appliedCouponResult = appliedCoupon
    ? validateCoupon(appliedCoupon.code, { items: context.cart, subtotal, coupons: availableCoupons })
    : { valid: false, discount: 0 };
  const discount = appliedCouponResult.valid ? Number(appliedCouponResult.discount || 0) : 0;
  const creditDiscount = Math.floor(appliedPoints / pointsPerRupee);
  const total = Math.max(0, subtotal - discount - creditDiscount) + shipping;
  const hasRequiredAddress = ["contact", "firstName", "lastName", "address1", "city", "state", "pinCode", "phone"].every((key) => String(form[key] || "").trim());

  useEffect(() => {
    document.body.classList.add("checkout-page");
    return () => document.body.classList.remove("checkout-page");
  }, []);

  useEffect(() => {
    if (checkoutTrackedRef.current || !context.cart.length) return;
    checkoutTrackedRef.current = true;
    trackAnalyticsEvent({
      eventType: "checkout_start",
      cartValue: subtotal,
      metadata: {
        itemCount: context.cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0)
      }
    });
  }, [context.cart, subtotal]);

  useEffect(() => {
    if (!context.authUser) return;
    setForm((current) => ({
      ...current,
      contact: current.contact || context.customerProfile.contact || mergedProfile.email || "",
      firstName: current.firstName || context.customerProfile.firstName || savedFirstName,
      lastName: current.lastName || context.customerProfile.lastName || savedLastName,
      address1: current.address1 || context.customerProfile.address || "",
      phone: current.phone || mergedProfile.mobile || "",
      checkoutMode: "login"
    }));
  }, [context.authUser, context.customerProfile, mergedProfile.email, mergedProfile.mobile, savedFirstName, savedLastName]);

  useEffect(() => {
    if (!shippingOptions.some((option) => option.id === form.shippingMethod)) {
      setForm((current) => ({ ...current, shippingMethod: shippingOptions[0]?.id || "standard" }));
    }
  }, [form.shippingMethod, shippingOptions]);

  useEffect(() => {
    if (!paymentMethods.some((method) => method.id === form.paymentMethod)) {
      setForm((current) => ({ ...current, paymentMethod: paymentMethods[0]?.id || "phonepe" }));
    }
  }, [form.paymentMethod, paymentMethods]);

  useEffect(() => {
    if (!context.authUser) {
      setWalletData(null);
      setAppliedPoints(0);
      return;
    }
    setWalletLoading(true);
    fetchCustomerWallet()
      .then((res) => setWalletData(res.data || null))
      .catch(() => setWalletData(null))
      .finally(() => setWalletLoading(false));
  }, [context.authUser]);

  useEffect(() => {
    if (!appliedCoupon) return;
    if (appliedCouponResult.valid) return;
    setCouponMessage(appliedCouponResult.message);
    setAppliedCoupon(null);
  }, [appliedCoupon, appliedCouponResult.message, appliedCouponResult.valid]);

  useEffect(() => {
    if (!couponCode || appliedCoupon || couponMessage || !subtotal) return;
    const result = validateCoupon(couponCode, { items: context.cart, subtotal, coupons: availableCoupons });
    if (!result.valid) return;
    setAppliedCoupon(result.coupon);
    setCouponCode(result.coupon.code);
    setCouponMessage(result.message);
  }, [appliedCoupon, availableCoupons, context.cart, couponCode, couponMessage, subtotal]);

  const applyCoupon = async (event) => {
    event.preventDefault();
    setIsApplyingCoupon(true);

    try {
      const response = await validateCheckoutCoupon({
        code: couponCode,
        subtotal,
        items: context.cart.map((item) => ({
          productId: item.id,
          slug: item.slug,
          name: item.name,
          category: item.category,
          categorySlug: item.categorySlug,
          price: item.price,
          quantity: item.quantity || 1
        })),
        hasOtherOffers: Number(appliedPoints || 0) > 0
      });
      const result = response.data || {};
      const coupon = result.coupon;

      setCouponMessage(response.message || `${coupon.code} applied successfully.`);
      setAppliedCoupon(coupon);
      setCouponCode(coupon.code);
      writeStorage("avyonaPendingCoupon", coupon.code);
      context.notify(response.message || `${coupon.code} applied successfully.`);
    } catch (error) {
      const fallback = validateCoupon(couponCode, { items: context.cart, subtotal, coupons: availableCoupons });
      setCouponMessage(error.data?.message || fallback.message);

      if (!fallback.valid) {
        setAppliedCoupon(null);
        setIsApplyingCoupon(false);
        return;
      }

      setAppliedCoupon(fallback.coupon);
      setCouponCode(fallback.coupon.code);
      writeStorage("avyonaPendingCoupon", fallback.coupon.code);
      context.notify(fallback.message);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    writeStorage("avyonaPendingCoupon", "");
    setCouponMessage("Coupon removed.");
  };

  const applyPoints = async (event) => {
    event.preventDefault();
    const requested = parseInt(pointsInput, 10);
    if (!requested || requested <= 0) {
      setPointsMessage("Enter a valid number of points.");
      return;
    }
    if (customerAvailablePoints < minRedeemPoints) {
      setPointsMessage(`You need at least ${minRedeemPoints} points to redeem. You have ${customerAvailablePoints}.`);
      return;
    }
    if (requested > customerAvailablePoints) {
      setPointsMessage(`You only have ${customerAvailablePoints} points available.`);
      return;
    }
    if (requested > maxPointsUsable) {
      setPointsMessage(`Maximum ${maxPointsUsable} points (₹${maxDiscountRupees} off) can be used on this order.`);
      return;
    }
    try {
      const response = await applyCustomerCreditPoints({ points: requested, orderSubtotal: Math.max(0, subtotal - discount) });
      const pointsApplied = Number(response.data?.pointsApplied || 0);
      const discountRupees = Number(response.data?.discountRupees || 0);
      setAppliedPoints(pointsApplied);
      setPointsMessage(`${pointsApplied} points applied - Rs ${discountRupees} off your order.`);
      context.notify(`${pointsApplied} credit points applied!`);
    } catch (error) {
      setAppliedPoints(0);
      setPointsMessage(error.message || "Unable to apply credit points.");
    }
  };

  const removePoints = () => {
    setAppliedPoints(0);
    setPointsInput("");
    setPointsMessage("Credit points removed.");
  };

  const applyAllPoints = async () => {
    setPointsInput(String(maxPointsUsable));
    try {
      const response = await applyCustomerCreditPoints({ points: maxPointsUsable, orderSubtotal: Math.max(0, subtotal - discount) });
      const pointsApplied = Number(response.data?.pointsApplied || 0);
      const discountRupees = Number(response.data?.discountRupees || 0);
      setAppliedPoints(pointsApplied);
      setPointsMessage(`${pointsApplied} points applied - Rs ${discountRupees} off your order.`);
      context.notify(`${pointsApplied} credit points applied!`);
    } catch (error) {
      setAppliedPoints(0);
      setPointsMessage(error.message || "Unable to apply credit points.");
    }
  };

  const submitOrder = async (event) => {
    event.preventDefault();
    if (!context.cart.length || !hasRequiredAddress || isSubmittingOrder) return;

    setIsSubmittingOrder(true);
    const createdAt = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const deliveryAddress = `${form.address1}${form.address2 ? `, ${form.address2}` : ""}, ${form.city}, ${form.state} - ${form.pinCode}`;
    let orderNumber = `AVY-${Date.now().toString().slice(-6)}`;
    let backendOrder = null;

    try {
      const response = await createStorefrontOrder({
        customer: {
          firstName: form.firstName,
          lastName: form.lastName,
          contact: form.contact,
          email: form.contact.includes("@") ? form.contact : "",
          phone: form.phone
        },
        address: {
          line1: form.address1,
          line2: form.address2,
          city: form.city,
          state: form.state,
          pincode: form.pinCode
        },
        items: context.cart.map((item) => ({
          asin: item.asin || item.slug,
          slug: item.slug,
          name: item.name,
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 1),
          variantLabel: item.variantLabel || ""
        })),
        pricing: {
          subtotal,
          discount,
          shipping,
          total
        },
        paymentMethod: form.paymentMethod,
        shippingMethod: form.shippingMethod,
        couponCode: appliedCoupon?.code || "",
        creditPoints: appliedPoints
      });

      backendOrder = response.data || null;
      orderNumber = backendOrder?.orderNumber || orderNumber;
      trackAnalyticsEvent({
        eventType: "purchase",
        orderNumber,
        cartValue: Number(backendOrder?.totalAmount ?? total),
        metadata: {
          itemCount: context.cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0),
          paymentMethod: form.paymentMethod,
          paymentStatus: backendOrder?.paymentStatus || ""
        }
      });
    } catch (error) {
      context.notify(error.message || "Unable to place order. Please check stock, coupon, and delivery details.");
      setIsSubmittingOrder(false);
      return;
    }

    const finalTotal = Number(backendOrder?.totalAmount ?? total);
    const finalDiscount = Number(backendOrder?.discount ?? discount);
    const finalCreditDiscount = Number(backendOrder?.creditDiscount ?? creditDiscount);
    const finalShipping = Number(backendOrder?.shippingFee ?? shipping);
    const paymentStatus = backendOrder?.paymentStatus || "pending";

    const newOrders = context.cart.map((item) => ({
      orderNumber,
      slug: item.slug,
      name: item.name,
      image: item.image,
      category: item.category,
      quantity: Number(item.quantity || 1),
      total: Number(item.price || 0) * Number(item.quantity || 1),
      orderTotal: finalTotal,
      discount: finalDiscount,
      creditDiscount: finalCreditDiscount,
      couponCode: appliedCoupon?.code || "",
      shipping: finalShipping,
      paymentMethod: form.paymentMethod,
      paymentStatus,
      deliveryAddress,
      contact: form.contact,
      date: createdAt,
      status: paymentStatus === "failed" ? "Payment Failed" : "Order Confirmed"
    }));
    context.setOrders([...newOrders, ...context.orders].slice(0, 24));
    context.setCustomerProfile({
      ...context.customerProfile,
      firstName: form.firstName,
      lastName: form.lastName,
      contact: form.contact,
      phone: form.phone,
      address: `${form.address1}, ${form.city}, ${form.state} - ${form.pinCode}`
    });
    if (paymentStatus !== "failed") {
      context.setCart([]);
    }
    context.notify(paymentStatus === "failed" ? "Test payment failed. Order was recorded for QA." : "Order placed successfully");
    setIsSubmittingOrder(false);
    navigate(`/order-confirmation/${orderNumber}`, {
      state: {
        orderNumber,
        items: newOrders,
        total: finalTotal,
        discount: finalDiscount,
        creditDiscount: finalCreditDiscount,
        couponCode: appliedCoupon?.code || "",
        shipping: finalShipping,
        paymentMethod: form.paymentMethod,
        paymentStatus,
        deliveryAddress,
        contact: form.contact,
        date: createdAt
      }
    });
  };

  return (
    <div className="checkout-page">
      <header className="checkout-header">
        <div className="container checkout-header-inner">
          <Link className="checkout-brand" to="/" aria-label={`${general.storeName || "Avyona"} home`}>
            {general.logoUrl ? <img src={general.logoUrl} alt={`${general.storeName || "Avyona"} logo`} /> : <span>{general.storeName || "Avyona"}</span>}
          </Link>
          <div className="checkout-header-meta">
            <span>Secure Checkout</span>
            <span>{shippingSettings.deliveryTime || "Fast Delivery Available"}</span>
            <span>{paymentSettings.codEnabled ? "COD Available" : "Prepaid Orders Only"}</span>
          </div>
        </div>
      </header>
      <main className="container checkout-main">
        <form className="checkout-layout" onSubmit={submitOrder}>
          <section className="checkout-form-panel">
            <div className="checkout-section">
              <div className="section-topline"><h2>Contact</h2><Link to="/account" className="checkout-inline-link">Login for faster checkout</Link></div>
              <div className="checkout-choice-row">
                <label className="choice-pill">
                  <input type="radio" name="checkoutMode" checked={form.checkoutMode === "guest"} onChange={() => setForm({ ...form, checkoutMode: "guest" })} />
                  <span>Continue as Guest</span>
                </label>
                <label className="choice-pill">
                  <input type="radio" name="checkoutMode" checked={form.checkoutMode === "login"} onChange={() => setForm({ ...form, checkoutMode: "login" })} />
                  <span>Login</span>
                </label>
              </div>
              {form.checkoutMode === "login" && !context.authUser ? <p className="checkout-login-note">Login is not active yet for this session. Continue as guest or <Link to="/account">open account</Link>.</p> : null}
              {context.authUser ? <p className="checkout-login-note">Signed in as {context.authUser.email || context.authUser.mobile}. Saved details are ready to use.</p> : null}
              <div className="field-group"><label className="field-label">Email or Mobile Number</label><input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} required /></div>
            </div>
            <div className="checkout-section">
              <h2>Delivery</h2>
              <div className="field-group"><label className="field-label">Country/Region</label><select value="India" disabled><option>India</option></select></div>
              <div className="field-grid two-col">
                <div className="field-group"><label className="field-label">First Name</label><input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></div>
                <div className="field-group"><label className="field-label">Last Name</label><input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required /></div>
              </div>
              <div className="field-group"><label className="field-label">Company</label><input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} placeholder="Company (optional)" /></div>
              <div className="field-group"><label className="field-label">Address</label><input value={form.address1} onChange={(event) => setForm({ ...form, address1: event.target.value })} required /></div>
              <div className="field-group"><label className="field-label">Apartment, Suite, etc.</label><input value={form.address2} onChange={(event) => setForm({ ...form, address2: event.target.value })} placeholder="Apartment, suite, etc. (optional)" /></div>
              <div className="field-grid location-grid">
                <div className="field-group"><label className="field-label">City</label><input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} required /></div>
                <div className="field-group"><label className="field-label">State</label><input value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} required /></div>
                <div className="field-group"><label className="field-label">PIN Code</label><input value={form.pinCode} onChange={(event) => setForm({ ...form, pinCode: event.target.value })} required /></div>
              </div>
              <div className="field-group"><label className="field-label">Phone</label><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required /></div>
              {hasRequiredAddress ? (
                <p className="delivery-estimate">
                  {`Estimated delivery in ${shippingSettings.deliveryTime || "3 to 5 business days"} - `}
                  {paymentSettings.codEnabled ? "COD available for eligible PINs" : "Prepaid payment required"}
                </p>
              ) : null}
            </div>
            <div className="checkout-section">
              <h2>Shipping Method</h2>
              <div className="option-stack">
                {shippingOptions.map((option) => (
                  <label key={option.id} className={`shipping-option ${form.shippingMethod === option.id ? "active" : ""}`}>
                    <input type="radio" name="shippingMethod" checked={form.shippingMethod === option.id} onChange={() => setForm({ ...form, shippingMethod: option.id })} />
                    <span className="option-copy">
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                    <span className="option-price">{option.price === 0 ? "Free" : formatCurrency(option.price, context)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="checkout-section">
              <h2>Payment</h2>
              <p className="section-note">All transactions are secure and encrypted.</p>
              <div className="option-stack payment-stack">
                {paymentMethods.map((method) => (
                  <label key={method.id} className="payment-option">
                    <input type="radio" name="paymentMethod" checked={form.paymentMethod === method.id} onChange={() => setForm({ ...form, paymentMethod: method.id })} />
                    <div className="payment-option-body">
                      <div className="payment-option-head">
                        <strong>{method.label}</strong>
                        {method.id === "cod" ? (
                          <span className="payment-support-copy">Available on eligible PIN codes</span>
                        ) : (
                          <div className="checkout-payment-icons">
                            {paymentIcons.map((icon, index) => icon ? <img key={`${method.id}-${icon}`} src={icon} alt={`Payment icon ${index + 1}`} loading="lazy" /> : null)}
                          </div>
                        )}
                      </div>
                      <p>{method.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="trust-mini-grid"><span>SSL Secure</span><span>100% Safe Payment</span><span>Fast Delivery Available</span></div>
            </div>
            <div className="checkout-section">
              <h2>Billing Address</h2>
              <div className="option-stack">
                <label className="billing-option">
                  <input type="radio" name="billingAddress" checked={form.billingAddress === "same"} onChange={() => setForm({ ...form, billingAddress: "same" })} />
                  <span>Same as shipping address</span>
                </label>
                <label className="billing-option">
                  <input type="radio" name="billingAddress" checked={form.billingAddress === "different"} onChange={() => setForm({ ...form, billingAddress: "different" })} />
                  <span>Use a different billing address</span>
                </label>
              </div>
            </div>
            <div className="checkout-cta-wrap"><button className="checkout-pay-button" type="submit" disabled={!context.cart.length || isSubmittingOrder}>{isSubmittingOrder ? "Placing Order..." : context.cart.length ? "Pay Now" : "Cart Empty"}</button><p className="checkout-cta-note">Secure Checkout. You will not be charged until you confirm.</p></div>
          </section>
          <aside className="checkout-summary-panel">
            <details className="mobile-summary-toggle" open>
              <summary><span>Order Summary</span><strong>{formatCurrency(total, context)}</strong></summary>
              <div className="mobile-summary-body">
                <div className="summary-shell">
                  <div className="summary-items">
                    {context.cart.length ? context.cart.map((item) => <article key={`${item.slug}:${item.variantLabel || ""}`} className="summary-item"><div className="summary-item-art"><img src={item.image} alt={item.name} /></div><div className="summary-item-copy"><h3>{item.name}</h3><p className="summary-meta">{`Quantity: ${item.quantity}`}</p></div><strong className="summary-item-price">{formatCurrency(Number(item.price || 0) * Number(item.quantity || 1), context)}</strong></article>) : <div className="checkout-empty-state"><h3>Your cart is empty</h3><p>Add products before continuing to checkout.</p><Link to="/">Continue Shopping</Link></div>}
                  </div>
                  <div className="summary-totals">
                    <form className="checkout-coupon-form" onSubmit={applyCoupon}>
                      <label>
                        <span>Coupon Code</span>
                        <div className="checkout-coupon-input-row">
                          <input value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="SUMMER15" />
                          {appliedCoupon ? (
                            <button type="button" onClick={removeCoupon}>Remove</button>
                          ) : (
                            <button type="submit" disabled={!context.cart.length || isApplyingCoupon}>{isApplyingCoupon ? "Applying..." : "Apply"}</button>
                          )}
                        </div>
                      </label>
                      {couponMessage ? <p className={appliedCoupon ? "coupon-message success" : "coupon-message"}>{couponMessage}</p> : null}
                    </form>
                    <div className="checkout-coupon-suggestions">
                      {availableCoupons.slice(0, 3).map((coupon) => (
                        <button key={coupon.code} type="button" onClick={() => setCouponCode(coupon.code)}>
                          {coupon.code}
                        </button>
                      ))}
                    </div>
                    {walletLoading && context.authUser && (
                      <div style={{ padding: "12px 14px", border: "1px solid #bbf7d0", borderRadius: "12px", background: "#f0fdf4", color: "#166534", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                        Loading your credit points...
                      </div>
                    )}
                    {!walletLoading && customerAvailablePoints > 0 && !walletData?.isBlocked && (
                      <div style={cpWrapStyle}>
                        <div style={cpHeaderStyle}>
                          <div>
                            <p style={cpEyebrowStyle}>Credit Points</p>
                            <strong style={cpTitleStyle}>Use Credit Points</strong>
                          </div>
                          <div style={cpBadgeStyle}>
                            <span style={cpBadgeLabelStyle}>{customerAvailablePoints.toLocaleString()} pts</span>
                            <span style={cpBadgeValueStyle}>= ₹{Math.floor(customerAvailablePoints / pointsPerRupee)}</span>
                          </div>
                        </div>

                        {appliedPoints > 0 ? (
                          <div style={cpAppliedRowStyle}>
                            <div>
                              <strong style={cpAppliedTextStyle}>
                                {appliedPoints.toLocaleString()} pts applied — saving ₹{creditDiscount}
                              </strong>
                              <p style={cpRemainingStyle}>
                                {(customerAvailablePoints - appliedPoints).toLocaleString()} pts remaining after this order
                              </p>
                            </div>
                            <button type="button" style={cpRemoveButtonStyle} onClick={removePoints}>Remove</button>
                          </div>
                        ) : (
                          <form style={cpFormStyle} onSubmit={applyPoints}>
                            <div style={cpInputRowStyle}>
                              <input
                                style={cpInputStyle}
                                type="number"
                                min="1"
                                max={maxPointsUsable}
                                placeholder={`Max ${maxPointsUsable} pts`}
                                value={pointsInput}
                                onChange={(e) => setPointsInput(e.target.value)}
                              />
                              <button type="submit" style={cpApplyButtonStyle} disabled={!context.cart.length}>
                                Apply
                              </button>
                            </div>
                            <button type="button" style={cpUseAllButtonStyle} onClick={applyAllPoints}>
                              Use all {maxPointsUsable.toLocaleString()} pts (₹{Math.floor(maxPointsUsable / pointsPerRupee)} off)
                            </button>
                          </form>
                        )}

                        {pointsMessage && (
                          <p style={appliedPoints > 0 ? cpMessageSuccessStyle : cpMessageNeutralStyle}>
                            {pointsMessage}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="summary-row"><span>Subtotal</span><strong>{formatCurrency(subtotal, context)}</strong></div>
                    {discount > 0 ? <div className="summary-row discount-row"><span>{`Coupon${appliedCoupon?.code ? ` (${appliedCoupon.code})` : ""}`}</span><strong>{`-${formatCurrency(discount, context)}`}</strong></div> : null}
                    {creditDiscount > 0 ? <div className="summary-row discount-row"><span>Credit Points ({appliedPoints.toLocaleString()} pts)</span><strong>{`-₹${creditDiscount}`}</strong></div> : null}
                    <div className="summary-row"><span>Shipping</span><strong>{shipping === 0 ? "Free" : formatCurrency(shipping, context)}</strong></div>
                    <div className="summary-row total-row"><span>Total</span><strong>{formatCurrency(total, context)}</strong></div>
                  </div>
                </div>
              </div>
            </details>
          </aside>
        </form>
      </main>
    </div>
  );
}

/* ─── Credit Points Styles ─────────────────────────────────────────────── */
const cpWrapStyle = {
  display: "grid",
  gap: "12px",
  padding: "14px",
  border: "1px solid #bbf7d0",
  borderRadius: "12px",
  background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
  marginBottom: "4px"
};

const cpHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "10px"
};

const cpEyebrowStyle = {
  margin: "0 0 2px",
  color: "#166534",
  fontSize: "10px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.1em"
};

const cpTitleStyle = {
  color: "#0f172a",
  fontSize: "15px"
};

const cpBadgeStyle = {
  display: "grid",
  gap: "2px",
  padding: "8px 12px",
  border: "1px solid #86efac",
  borderRadius: "10px",
  background: "#ffffff",
  textAlign: "right"
};

const cpBadgeLabelStyle = {
  display: "block",
  color: "#1d4ed8",
  fontSize: "13px",
  fontWeight: 800
};

const cpBadgeValueStyle = {
  display: "block",
  color: "#166534",
  fontSize: "12px",
  fontWeight: 700
};

const cpFormStyle = { display: "grid", gap: "8px" };

const cpInputRowStyle = { display: "flex", gap: "8px" };

const cpInputStyle = {
  flex: 1,
  minHeight: "40px",
  padding: "0 12px",
  border: "1px solid #86efac",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "14px"
};

const cpApplyButtonStyle = {
  minHeight: "40px",
  padding: "0 16px",
  border: "1px solid #166534",
  borderRadius: "8px",
  background: "#166534",
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap"
};

const cpUseAllButtonStyle = {
  minHeight: "36px",
  padding: "0 12px",
  border: "1px solid #86efac",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#166534",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
  textAlign: "left"
};

const cpAppliedRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap"
};

const cpAppliedTextStyle = {
  display: "block",
  color: "#166534",
  fontSize: "14px"
};

const cpRemainingStyle = {
  margin: "4px 0 0",
  color: "#4a9d54",
  fontSize: "12px",
  fontWeight: 600
};

const cpRemoveButtonStyle = {
  minHeight: "34px",
  padding: "0 12px",
  border: "1px solid #fca5a5",
  borderRadius: "8px",
  background: "#fff1f2",
  color: "#dc2626",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
  flexShrink: 0
};

const cpMessageSuccessStyle = {
  margin: 0,
  color: "#166534",
  fontSize: "12px",
  fontWeight: 700
};

const cpMessageNeutralStyle = {
  margin: 0,
  color: "#b45309",
  fontSize: "12px",
  fontWeight: 700
};
