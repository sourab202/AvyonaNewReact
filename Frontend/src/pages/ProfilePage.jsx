import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { deleteCustomerAddress, fetchCustomerAddresses, fetchCustomerReferral, fetchCustomerTransactions, fetchCustomerWallet, fetchMyReviews, saveCustomerAddress, updateCustomerProfile } from "../api/customerApi";
import { resolveMediaUrl } from "../utils/media";
import { compressImageFile, formatCurrency, getMergedProfile } from "../utils/storefront";

function ProfileProductImage({ src, alt }) {
  return src ? <img src={resolveMediaUrl(src)} alt={alt} /> : <span className="profile-no-image">No image</span>;
}

const TX_LABELS = {
  signup_bonus:      "Signup Bonus",
  referral_bonus:    "Referral Bonus",
  purchase_cashback: "Purchase Cashback",
  review_reward:     "Review Reward",
  milestone_reward:  "Milestone Reward",
  manual_adjustment: "Manual Adjustment",
  redemption:        "Redeemed at Checkout",
  expiry:            "Points Expired"
};

const ACCOUNT_SECTIONS = [
  { id: "profile", label: "Profile", icon: "👤" },
  { id: "orders", label: "Orders", icon: "🧾" },
  { id: "rewards", label: "Rewards", icon: "₹" },
  { id: "addresses", label: "Addresses", icon: "📍" },
  { id: "wishlist", label: "Wishlist", icon: "♡" },
  { id: "reviews", label: "My Reviews", icon: "★" },
  { id: "cart", label: "Cart", icon: "🛒" }
];

function EmptyState({ icon, title, copy, actionLabel, to = "/" }) {
  return (
    <div className="profile-empty-state">
      <span className="profile-empty-icon" aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
      {actionLabel ? <Link className="secondary-button" to={to}>{actionLabel}</Link> : null}
    </div>
  );
}

function getReviewStatus(review) {
  const raw = String(review.visibilityStatus || review.visibility || review.status || "private").toLowerCase();
  if (raw.includes("public") || raw === "approved") return "Public";
  if (raw.includes("hidden")) return "Hidden";
  return "Private";
}

function getOrderId(order, index) {
  return order.orderNumber || order.orderId || order.id || `AVY-${String(index + 1).padStart(4, "0")}`;
}

function formatProfileDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function MyRewards({ authUser }) {
  const [walletData, setWalletData]       = useState(null);
  const [transactions, setTransactions]   = useState([]);
  const [referral, setReferral]           = useState(null);
  const [loading, setLoading]             = useState(false);

  const refresh = React.useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    const [walletRes, txRes, referralRes] = await Promise.allSettled([
      fetchCustomerWallet(),
      fetchCustomerTransactions({ limit: 5 }),
      fetchCustomerReferral()
    ]);
    if (walletRes.status === "fulfilled") setWalletData(walletRes.value.data || null);
    if (txRes.status === "fulfilled")     setTransactions(txRes.value.data?.transactions || []);
    if (referralRes.status === "fulfilled") setReferral(referralRes.value.data || null);
    setLoading(false);
  }, [authUser]);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-refresh when the tab regains visibility or the window regains focus
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  if (!authUser) return null;

  if (loading && !walletData) {
    return (
      <section className="profile-card" style={{ display: "grid", gap: "20px" }}>
        <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
          Loading your rewards...
        </div>
      </section>
    );
  }

  const available         = Number(walletData?.availablePoints  || 0);
  const usedPts           = Number(walletData?.usedPoints        || 0);
  const expiredPts        = Number(walletData?.expiredPoints     || 0);
  const ppr               = Number(walletData?.pointsPerRupee   || 10);
  const cashbackValue     = Math.floor(available / ppr);
  const nextExpiry        = walletData?.nextExpiry               || null;
  const expiringSoonPts   = Number(walletData?.expiringSoonPoints || 0);
  const isBlocked         = Boolean(walletData?.isBlocked);
  const expiryLabel       = nextExpiry
    ? new Date(nextExpiry).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  return (
    <section className="profile-card" style={{ display: "grid", gap: "20px" }}>
      <div className="profile-section-head">
        <div>
          <p className="eyebrow">Credit Points</p>
          <h2>My Rewards</h2>
          <p style={{ margin: "4px 0 0", color: "#667085", fontSize: "14px" }}>
            Use your points as cashback at checkout. {ppr} points = ₹1
          </p>
        </div>
        {loading && <span style={{ fontSize: "12px", color: "#94a3b8", alignSelf: "center" }}>Refreshing...</span>}
      </div>

      {/* Blocked wallet banner */}
      {isBlocked && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", border: "1px solid #fca5a5", borderRadius: "12px", background: "#fff1f2" }}>
          <span style={{ fontSize: "18px" }}>⛔</span>
          <p style={{ margin: 0, color: "#dc2626", fontSize: "13px", fontWeight: 700 }}>Your credit points wallet is blocked. Contact support to resolve this.</p>
        </div>
      )}

      <div className="profile-rewards-summary">
        {[
          { label: "Available Points", value: available.toLocaleString(), sub: `${ppr} points = ₹1` },
          { label: "Cashback Value", value: `₹${cashbackValue}`, sub: "usable at checkout" },
          { label: "Referral Code", value: referral?.referralCode || "Not ready", sub: `${Number(referral?.successfulReferrals || 0)} successful referral(s)` }
        ].map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.sub}</small>
          </div>
        ))}
      </div>

      {!isBlocked && (
        <div className="profile-rewards-cta">
          <div>
            <strong>{`₹${cashbackValue} cashback available`}</strong>
            <span>{`${available.toLocaleString()} points can be used during checkout.`}</span>
          </div>
          <button type="button" className="primary-button" onClick={() => window.location.href = "/checkout"}>
            Use at Checkout
          </button>
        </div>
      )}

      {referral?.referralCode && (
        <div className="profile-referral-row">
          <span>{referral.referralCode}</span>
          <button type="button" className="secondary-button" onClick={() => navigator.clipboard?.writeText(referral.referralCode)}>
            Copy Code
          </button>
        </div>
      )}

      <div className="profile-rewards-mini">
        <span>{`Used: ${usedPts.toLocaleString()} pts`}</span>
        <span>{`Expired: ${expiredPts.toLocaleString()} pts`}</span>
      </div>

      {/* Expiry Alert */}
      {expiringSoonPts > 0 && expiryLabel && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", border: "1px solid #fde68a", borderRadius: "12px", background: "#fefce8" }}>
          <span style={{ fontSize: "18px" }}>⚠</span>
          <p style={{ margin: 0, color: "#a16207", fontSize: "13px", fontWeight: 700 }}>
            <strong>{expiringSoonPts.toLocaleString()} points</strong> expiring soon — next expiry on <strong>{expiryLabel}</strong>. Use them before they expire!
          </p>
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <p style={{ margin: "0 0 12px", color: "#334155", fontSize: "13px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>Recent Activity</p>
        {transactions.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: "14px" }}>No transactions yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "8px" }}>
            {transactions.map((tx) => {
              const isEarned = Number(tx.points) > 0;
              const label    = TX_LABELS[tx.type] || tx.type;
              const dateStr  = new Date(tx.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
              return (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "12px 16px", border: "1px solid #f1f5f9", borderRadius: "10px", background: "#f8fafc" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ display: "grid", placeItems: "center", width: "32px", height: "32px", borderRadius: "8px", background: isEarned ? "#f0fdf4" : "#fdf4ff", fontSize: "14px" }}>
                      {isEarned ? "+" : "−"}
                    </span>
                    <div>
                      <strong style={{ display: "block", color: "#0f172a", fontSize: "14px" }}>{label}</strong>
                      <span style={{ color: "#94a3b8", fontSize: "12px" }}>{dateStr}</span>
                    </div>
                  </div>
                  <strong style={{ color: isEarned ? "#166534" : "#7c3aed", fontSize: "15px", whiteSpace: "nowrap" }}>
                    {isEarned ? "+" : ""}{Number(tx.points).toLocaleString()} pts
                  </strong>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default function ProfilePage({ context }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const merged = getMergedProfile(context.authUser, context.customerProfile);
  const [profile, setProfile] = useState(merged);
  const [addresses, setAddresses] = useState([]);
  const [reviews, setReviews] = useState([]);
  const requestedSection = searchParams.get("section");
  const initialSection = ACCOUNT_SECTIONS.some((section) => section.id === requestedSection) ? requestedSection : "profile";
  const [activeSection, setActiveSection] = useState(initialSection);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [heroWallet, setHeroWallet] = useState(null);
  const [reviewPage, setReviewPage] = useState(1);
  const [addressForm, setAddressForm] = useState({
    addressType: "Home",
    fullName: merged.fullName || "",
    phone: merged.mobile || "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    isDefault: true
  });

  useEffect(() => {
    setProfile(getMergedProfile(context.authUser, context.customerProfile));
  }, [context.authUser, context.customerProfile]);

  useEffect(() => {
    const nextSection = searchParams.get("section");
    if (ACCOUNT_SECTIONS.some((section) => section.id === nextSection)) {
      setActiveSection(nextSection);
    } else {
      setActiveSection("profile");
    }
  }, [searchParams]);

  useEffect(() => {
    document.body.classList.add("profile-page");
    return () => document.body.classList.remove("profile-page");
  }, []);

  useEffect(() => {
    if (!context.authUser) return undefined;
    let isMounted = true;

    async function loadAccountData() {
      const [addressResult, reviewResult, walletResult] = await Promise.allSettled([
        fetchCustomerAddresses(),
        fetchMyReviews(),
        fetchCustomerWallet()
      ]);

      if (!isMounted) return;
      if (addressResult.status === "fulfilled") {
        setAddresses(Array.isArray(addressResult.value.data) ? addressResult.value.data : []);
      }
      if (reviewResult.status === "fulfilled") {
        setReviews(Array.isArray(reviewResult.value.data) ? reviewResult.value.data : []);
      }
      if (walletResult.status === "fulfilled") {
        setHeroWallet(walletResult.value.data || null);
      }
    }

    loadAccountData();

    return () => {
      isMounted = false;
    };
  }, [context.authUser]);

  if (!context.authUser) return <Navigate to="/account" replace />;

  const saveProfile = async (event) => {
    event.preventDefault();
    const parts = profile.fullName.split(/\s+/);
    try {
      const response = await updateCustomerProfile({
        fullName: profile.fullName,
        email: profile.email,
        mobile: profile.mobile
      });
      const customer = response.data?.customer;
      if (customer) {
        context.setAuthUser({ id: customer.id, fullName: customer.fullName, email: customer.email, mobile: customer.mobile });
      }
      context.setCustomerProfile({
        ...context.customerProfile,
        firstName: parts.slice(0, 1).join(" "),
        lastName: parts.slice(1).join(" "),
        email: profile.email,
        phone: profile.mobile,
        address: profile.address,
        image: profile.image
      });
      context.notify("Profile saved");
      setIsEditingProfile(false);
    } catch (error) {
      context.notify(error.message || "Could not save profile");
    }
  };

  const submitAddress = async (event) => {
    event.preventDefault();
    try {
      const response = await saveCustomerAddress(addressForm);
      setAddresses(Array.isArray(response.data) ? response.data : []);
      setAddressForm((current) => ({
        ...current,
        line1: "",
        line2: "",
        city: "",
        state: "",
        pincode: "",
        isDefault: false
      }));
      context.notify("Address saved");
      setShowAddressForm(false);
    } catch (error) {
      context.notify(error.message || "Could not save address");
    }
  };

  const editAddress = (address) => {
    setAddressForm({
      addressType: address.addressType || "Home",
      fullName: address.fullName || profile.fullName || "",
      phone: address.phone || profile.mobile || "",
      line1: address.line1 || "",
      line2: address.line2 || "",
      city: address.city || "",
      state: address.state || "",
      pincode: address.pincode || "",
      country: address.country || "India",
      isDefault: Boolean(address.isDefault),
      id: address.id
    });
    setShowAddressForm(true);
  };

  const removeAddress = async (addressId) => {
    try {
      const response = await deleteCustomerAddress(addressId);
      setAddresses(Array.isArray(response.data) ? response.data : []);
      context.notify("Address deleted");
    } catch (error) {
      context.notify(error.message || "Could not delete address");
    }
  };

  const makeDefaultAddress = async (address) => {
    try {
      const response = await saveCustomerAddress({ ...address, isDefault: true });
      setAddresses(Array.isArray(response.data) ? response.data : []);
      context.notify("Default address updated");
    } catch (error) {
      context.notify(error.message || "Could not update default address");
    }
  };

  const updateProfileImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      context.notify("Please upload a valid image file");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      context.notify("Profile image must be under 5 MB");
      event.target.value = "";
      return;
    }

    try {
      const image = await compressImageFile(file);
      setProfile((current) => ({ ...current, image }));
      context.setCustomerProfile({
        ...context.customerProfile,
        image
      });
      context.notify("Profile image updated");
    } catch {
      context.notify("Could not update profile image");
    }
  };

  const firstName = profile.fullName?.split(" ")[0] || "Customer";
  const availablePoints = Number(heroWallet?.availablePoints || 0);
  const pointsPerRupee = Number(heroWallet?.pointsPerRupee || 10);
  const cashbackValue = Math.floor(availablePoints / pointsPerRupee);
  const cartTotal = context.cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);

  const productList = (items, type) => (
    <div className="profile-product-grid">
      {items.map((item) => (
        <article key={`${type}:${item.slug}:${item.variantLabel || ""}`} className="profile-product-card">
          <Link className="profile-product-media" to={`/product/${item.slug}`}>
            <ProfileProductImage src={item.image} alt={item.name} />
          </Link>
          <div className="profile-product-copy">
            <h3>{item.name}</h3>
            <p>{item.category}{item.variantLabel ? ` | ${item.variantLabel}` : ""}</p>
            {type === "cart" ? <span>{`Qty: ${item.quantity}`}</span> : <span>Saved item</span>}
          </div>
          <div className="profile-product-actions">
            <strong>{formatCurrency(type === "cart" ? Number(item.price || 0) * Number(item.quantity || 1) : item.price)}</strong>
            <button
              className="profile-text-danger"
              type="button"
              onClick={() => {
                if (type === "cart") {
                  context.removeCartItem(item.slug, item.variantLabel || "");
                } else {
                  context.setWishlist((current) => current.filter((entry) => !(entry.slug === item.slug && String(entry.variantLabel || "") === String(item.variantLabel || ""))));
                  context.notify("Removed from wishlist");
                }
              }}
            >
              Remove
            </button>
          </div>
        </article>
      ))}
    </div>
  );

  const renderSection = () => {
    if (activeSection === "profile") {
      return (
        <section className="profile-card profile-panel-card">
          <div className="profile-section-head">
            <div><p className="eyebrow">Profile Details</p><h2>Personal information</h2></div>
            <button className="secondary-button" type="button" onClick={() => setIsEditingProfile((current) => !current)}>
              {isEditingProfile ? "Cancel" : "Edit"}
            </button>
          </div>
          <div className="profile-detail-card">
            <div className="profile-avatar-wrap">
              <img className="profile-avatar" src={profile.image} alt="Profile avatar" />
              <label className="profile-avatar-edit" htmlFor="profileImageInput">Edit Photo</label>
              <input id="profileImageInput" name="profileImage" type="file" accept="image/*" hidden onChange={updateProfileImage} />
            </div>
            {!isEditingProfile ? (
              <div className="profile-detail-list">
                <div><span>Name</span><strong>{profile.fullName || "Not added"}</strong></div>
                <div><span>Phone</span><strong>{profile.mobile || "Not added"}</strong></div>
                <div><span>Email</span><strong>{profile.email || "Not added"}</strong></div>
                <div><span>Default Address</span><strong>{profile.address || "Not added"}</strong></div>
              </div>
            ) : (
              <form id="profile-details-form" name="profileDetailsForm" className="profile-form" onSubmit={saveProfile}>
                <div className="profile-form-grid">
                  <label className="profile-field" htmlFor="profile-full-name"><span>Full Name</span><input id="profile-full-name" name="fullName" autoComplete="name" value={profile.fullName} onChange={(event) => setProfile({ ...profile, fullName: event.target.value })} required /></label>
                  <label className="profile-field" htmlFor="profile-email"><span>Email Address</span><input id="profile-email" name="email" type="email" autoComplete="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label>
                  <label className="profile-field" htmlFor="profile-mobile"><span>Mobile Number</span><input id="profile-mobile" name="mobile" autoComplete="tel" value={profile.mobile} onChange={(event) => setProfile({ ...profile, mobile: event.target.value })} /></label>
                  <label className="profile-field" htmlFor="profile-address"><span>Default Address</span><textarea id="profile-address" name="address" autoComplete="street-address" rows="4" value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} /></label>
                </div>
                <div className="profile-form-actions"><button className="primary-button" type="submit">Save Profile</button></div>
              </form>
            )}
          </div>
        </section>
      );
    }

    if (activeSection === "orders") {
      return (
        <section className="profile-card profile-panel-card">
          <div className="profile-section-head"><div><p className="eyebrow">Orders</p><h2>Recent orders</h2></div></div>
          {context.orders.length ? (
            <div className="profile-order-list">
              {context.orders.map((order, index) => (
                <article key={`${order.slug}:${index}`} className="profile-order-card">
                  <ProfileProductImage src={order.image} alt={order.name} />
                  <div>
                    <h3>{order.name}</h3>
                    <p>{`${getOrderId(order, index)} | ${order.category}`}</p>
                    <div className="profile-order-meta"><span>{order.date}</span><span>{order.status}</span><span>{`Qty: ${order.quantity}`}</span></div>
                  </div>
                  <div className="profile-order-actions">
                    <strong>{formatCurrency(order.total)}</strong>
                    <Link className="secondary-button" to={`/track-order?order=${encodeURIComponent(getOrderId(order, index))}`}>Track Order</Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon="🧾" title="No orders yet" copy="Your completed purchases will appear here once you place an order." actionLabel="Continue Shopping" />
          )}
        </section>
      );
    }

    if (activeSection === "rewards") return <MyRewards authUser={context.authUser} />;

    if (activeSection === "addresses") {
      return (
        <section className="profile-card profile-panel-card">
          <div className="profile-section-head">
            <div><p className="eyebrow">Addresses</p><h2>Saved delivery addresses</h2></div>
            <button className="primary-button" type="button" onClick={() => setShowAddressForm((current) => !current)}>
              {showAddressForm ? "Cancel" : "Add New Address"}
            </button>
          </div>
          {showAddressForm ? (
            <form className="profile-form profile-address-form" onSubmit={submitAddress}>
              <div className="profile-form-grid">
                <label className="profile-field"><span>Label</span><input value={addressForm.addressType} onChange={(event) => setAddressForm({ ...addressForm, addressType: event.target.value })} /></label>
                <label className="profile-field"><span>Full Name</span><input value={addressForm.fullName} onChange={(event) => setAddressForm({ ...addressForm, fullName: event.target.value })} required /></label>
                <label className="profile-field"><span>Phone</span><input value={addressForm.phone} onChange={(event) => setAddressForm({ ...addressForm, phone: event.target.value })} required /></label>
                <label className="profile-field profile-field-wide"><span>Address Line 1</span><input value={addressForm.line1} onChange={(event) => setAddressForm({ ...addressForm, line1: event.target.value })} required /></label>
                <label className="profile-field profile-field-wide"><span>Address Line 2</span><input value={addressForm.line2} onChange={(event) => setAddressForm({ ...addressForm, line2: event.target.value })} /></label>
                <label className="profile-field"><span>City</span><input value={addressForm.city} onChange={(event) => setAddressForm({ ...addressForm, city: event.target.value })} required /></label>
                <label className="profile-field"><span>State</span><input value={addressForm.state} onChange={(event) => setAddressForm({ ...addressForm, state: event.target.value })} required /></label>
                <label className="profile-field"><span>Pincode</span><input value={addressForm.pincode} onChange={(event) => setAddressForm({ ...addressForm, pincode: event.target.value })} required /></label>
              </div>
              <div className="profile-form-actions"><button className="primary-button" type="submit">Save Address</button></div>
            </form>
          ) : null}
          {addresses.length ? (
            <div className="profile-address-grid">
              {addresses.map((address) => (
                <article key={address.id} className="profile-address-card">
                  <div><h3>{address.addressType || "Address"}</h3>{address.isDefault ? <span>Default</span> : null}</div>
                  <strong>{address.fullName}</strong>
                  <p>{address.phone}</p>
                  <p>{`${address.line1}${address.line2 ? `, ${address.line2}` : ""}, ${address.city}, ${address.state} ${address.pincode}`}</p>
                  <div className="profile-address-actions">
                    <button type="button" onClick={() => editAddress(address)}>Edit</button>
                    {!address.isDefault ? <button type="button" onClick={() => makeDefaultAddress(address)}>Make Default</button> : null}
                    <button type="button" className="profile-text-danger" onClick={() => removeAddress(address.id)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon="📍" title="No saved addresses" copy="Add a delivery address once and reuse it during checkout." />
          )}
        </section>
      );
    }

    if (activeSection === "wishlist") {
      return (
        <section className="profile-card profile-panel-card">
          <div className="profile-section-head"><div><p className="eyebrow">Wishlist</p><h2>Saved products</h2></div></div>
          {context.wishlist.length ? productList(context.wishlist, "wishlist") : <EmptyState icon="♡" title="No wishlist items" copy="Save products you like and come back to them anytime." actionLabel="Continue Shopping" />}
        </section>
      );
    }

    if (activeSection === "reviews") {
      const sortedReviews = [...reviews].sort((left, right) => new Date(right.submittedAt || right.createdAt || right.date || 0) - new Date(left.submittedAt || left.createdAt || left.date || 0));
      const reviewsPerPage = 6;
      const totalReviewPages = Math.max(1, Math.ceil(sortedReviews.length / reviewsPerPage));
      const safeReviewPage = Math.min(reviewPage, totalReviewPages);
      const visibleReviews = sortedReviews.slice((safeReviewPage - 1) * reviewsPerPage, safeReviewPage * reviewsPerPage);
      return (
        <section className="profile-card profile-panel-card">
          <div className="profile-section-head"><div><p className="eyebrow">My Reviews</p><h2>Submitted reviews</h2></div></div>
          {reviews.length ? (
            <>
            <div className="profile-review-grid">
              {visibleReviews.map((review) => {
                const status = getReviewStatus(review);
                const rating = Math.max(0, Math.min(5, Number(review.rating || 0)));
                const media = Array.isArray(review.media) ? review.media : [];
                return (
                  <article key={review.reviewId || review.id} className="profile-review-card">
                    <div className="profile-review-top">
                      <span className={`profile-status-badge status-${status.toLowerCase()}`}>{status}</span>
                      <span>{formatProfileDate(review.submittedAt || review.createdAt || review.date)}</span>
                    </div>
                    <h3>{review.productName || review.product_name || "Product"}</h3>
                    <div className="profile-review-stars" aria-label={`${rating} out of 5 stars`}>
                      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
                    </div>
                    <div className="profile-review-badges">
                      {review.verifiedPurchase || review.isVerifiedPurchase ? <span>Verified Purchase</span> : null}
                      {review.isAnonymous || review.anonymous ? <span>Anonymous</span> : null}
                    </div>
                    <strong>{review.reviewTitle || review.title || "Product review"}</strong>
                    {review.reviewText || review.comment ? <p>{review.reviewText || review.comment}</p> : null}
                    {media.length ? (
                      <div className="profile-review-media">
                        {media.slice(0, 3).map((item, index) => {
                          const url = item.url || item.mediaUrl || item;
                          const isVideo = String(item.type || item.mediaType || url).toLowerCase().includes("video") || /\.(mp4|webm|ogg)$/i.test(String(url));
                          return isVideo
                            ? <video key={`${url}:${index}`} src={url} controls />
                            : <img key={`${url}:${index}`} src={url} alt={`${review.productName || "Review"} media ${index + 1}`} />;
                        })}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
            {totalReviewPages > 1 ? (
              <div className="profile-pagination">
                <button type="button" disabled={safeReviewPage <= 1} onClick={() => setReviewPage((page) => Math.max(1, page - 1))}>Previous</button>
                <span>{`Page ${safeReviewPage} of ${totalReviewPages}`}</span>
                <button type="button" disabled={safeReviewPage >= totalReviewPages} onClick={() => setReviewPage((page) => Math.min(totalReviewPages, page + 1))}>Next</button>
              </div>
            ) : null}
            </>
          ) : (
            <EmptyState icon="★" title="No reviews yet" copy="Your submitted product reviews will appear here." actionLabel="Continue Shopping" />
          )}
        </section>
      );
    }

    return (
      <section className="profile-card profile-panel-card">
        <div className="profile-section-head"><div><p className="eyebrow">Cart</p><h2>Added to cart</h2></div><strong>{formatCurrency(cartTotal)}</strong></div>
        {context.cart.length ? productList(context.cart, "cart") : <EmptyState icon="🛒" title="Your cart is empty" copy="Products you add to cart will appear here before checkout." actionLabel="Continue Shopping" />}
      </section>
    );
  };

  return (
    <main className="container profile-main">
      <section className="profile-shell">
        <div className="profile-hero">
          <div className="profile-hero-copy">
            <p className="eyebrow">My Account</p>
            <h1>{`Welcome back, ${firstName}`}</h1>
            <p>{profile.email || "Manage your Avyona account details."}</p>
          </div>
          <div className="profile-hero-actions">
            <Link className="secondary-button" to="/">Continue Shopping</Link>
            <button className="primary-button" type="button" onClick={() => { context.setAuthUser(null); navigate("/account"); }}>Logout</button>
          </div>
          <div className="profile-hero-stats">
            <div><span>Rewards</span><strong>{availablePoints.toLocaleString()} pts</strong><small>{formatCurrency(cashbackValue)} value</small></div>
            <div><span>Orders</span><strong>{context.orders.length}</strong><small>total orders</small></div>
            <div><span>Cart</span><strong>{context.cart.length}</strong><small>{formatCurrency(cartTotal)}</small></div>
          </div>
        </div>

        <section className="profile-dashboard-layout">
          <aside className="profile-account-sidebar">
            <div className="profile-sidebar-user">
              <img className="profile-sidebar-avatar" src={profile.image} alt="Profile avatar" />
              <div><strong>{profile.fullName || "Customer"}</strong><span>{profile.email || "No email added"}</span></div>
            </div>
            <nav className="profile-account-nav" aria-label="Account sections">
              {ACCOUNT_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={activeSection === section.id ? "active" : ""}
                  onClick={() => {
                    setActiveSection(section.id);
                    setSearchParams(section.id === "profile" ? {} : { section: section.id });
                  }}
                >
                  <span aria-hidden="true">{section.icon}</span>
                  {section.label}
                </button>
              ))}
              <button type="button" className="profile-logout-button" onClick={() => { context.setAuthUser(null); navigate("/account"); }}>
                <span aria-hidden="true">↗</span>
                Logout
              </button>
            </nav>
          </aside>
          <div className="profile-content-panel">{renderSection()}</div>
        </section>
      </section>
    </main>
  );
}
