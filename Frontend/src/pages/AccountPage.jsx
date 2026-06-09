import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { loginCustomer, requestCustomerPasswordReset, signupCustomer } from "../api/customerApi";
const GST_NUMBER_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^[6-9]\d{9}$/;
const ACCOUNT_CONTENT = {
  login: {
    eyebrow: "Member Access",
    heading: "Welcome Back",
    subtitle: "Access your orders, rewards, wishlist, and saved details in one place.",
    benefits: ["Track orders easily", "Earn credit rewards", "Faster checkout", "Save addresses"]
  },
  signup: {
    eyebrow: "New Account",
    heading: "Start Your Avyona Journey",
    headingLines: ["Start Your", "Avyona Journey"],
    subtitle: "Create your account to shop faster, earn rewards, track orders, and enjoy exclusive member benefits.",
    benefits: ["Signup reward benefits", "Referral rewards", "Faster checkout", "Business purchase support"]
  }
};

export default function AccountPage({ context }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [loginIdentity, setLoginIdentity] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signup, setSignup] = useState({
    fullName: "",
    email: "",
    mobile: "",
    referralCode: "",
    password: "",
    confirmPassword: "",
    isBusinessAccount: false,
    businessName: "",
    gstNumber: ""
  });
  const [forgotIdentity, setForgotIdentity] = useState("");
  const [signupConsent, setSignupConsent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.body.classList.add("account-page");
    return () => document.body.classList.remove("account-page");
  }, []);

  if (context.authUser) return <Navigate to="/profile" replace />;

  function applyCustomerSession(customer) {
    const businessDetails = customer.businessDetails || {
      isBusinessAccount: Boolean(customer.isBusinessAccount || customer.businessName || customer.gstNumber),
      businessName: customer.businessName || "",
      gstNumber: customer.gstNumber || ""
    };
    context.setAuthUser({ id: customer.id, fullName: customer.fullName, email: customer.email, mobile: customer.mobile, businessDetails });
    context.setCustomerProfile({
      firstName: customer.firstName || String(customer.fullName || "").split(" ")[0] || "",
      lastName: customer.lastName || String(customer.fullName || "").split(" ").slice(1).join(" "),
      contact: customer.email,
      email: customer.email,
      phone: customer.mobile,
      businessDetails,
      isBusinessAccount: businessDetails.isBusinessAccount,
      businessName: businessDetails.businessName,
      gstNumber: businessDetails.gstNumber
    });
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setForgotOpen(false);
    setError("");
  }

  const submitLogin = async (event) => {
    event.preventDefault();
    const identity = loginIdentity.trim().toLowerCase();
    try {
      const response = await loginCustomer({ identity, password: loginPassword });
      const customer = response.data?.customer;
      if (!customer) throw new Error("We could not match those account details.");
      applyCustomerSession(customer);
      context.notify("Login successful");
      navigate("/profile");
    } catch (error) {
      setError(error.message || "We could not match those account details.");
    }
  };

  const submitSignup = async (event) => {
    event.preventDefault();
    if (!signup.fullName || !signup.email || !signup.mobile || !signup.password || !signup.confirmPassword) {
      setError("Please complete all account details.");
      return;
    }
    if (!EMAIL_PATTERN.test(signup.email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!MOBILE_PATTERN.test(signup.mobile.trim())) {
      setError("Please enter a valid 10 digit Indian mobile number.");
      return;
    }
    if (signup.password !== signup.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (signup.gstNumber.trim() && !GST_NUMBER_PATTERN.test(signup.gstNumber.trim())) {
      setError("Please enter a valid GST number or leave it blank.");
      return;
    }
    if (!signupConsent) {
      setError("Please agree to the terms before creating an account.");
      return;
    }

    try {
      const response = await signupCustomer({
        fullName: signup.fullName.trim(),
        email: signup.email.trim(),
        mobile: signup.mobile.trim(),
        referralCode: signup.referralCode.trim(),
        password: signup.password,
        businessDetails: {
          isBusinessAccount: signup.isBusinessAccount,
          businessName: signup.businessName.trim(),
          gstNumber: signup.gstNumber.trim().toUpperCase()
        }
      });
      const customer = response.data?.customer;
      if (!customer) throw new Error("Account could not be created.");
      applyCustomerSession(customer);
      context.notify("Account created");
      navigate("/profile");
    } catch (error) {
      setError(error.message || "Account could not be created.");
    }
  };

  const submitForgot = async (event) => {
    event.preventDefault();
    if (!forgotIdentity.trim()) {
      setError("Please enter your email address or mobile number.");
      return;
    }
    try {
      const response = await requestCustomerPasswordReset({ identity: forgotIdentity.trim() });
      context.notify(response.message || "Password reset instructions sent");
      setForgotIdentity("");
      setForgotOpen(false);
      setError("");
    } catch (error) {
      setError(error.message || "Unable to request password reset.");
    }
  };

  const signInGoogle = async () => {
    const demoUser = { fullName: "Google Customer", email: "google.customer@avyona.example", mobile: "9999999999", password: "google-auth" };
    try {
      let response;
      try {
        response = await signupCustomer(demoUser);
      } catch {
        response = await loginCustomer({ identity: demoUser.email, password: demoUser.password });
      }
      const customer = response.data?.customer;
      if (!customer) throw new Error("Google sign in failed.");
      applyCustomerSession(customer);
      context.notify("Signed in with Google");
      navigate("/profile");
    } catch (error) {
      setError(error.message || "Google sign in failed.");
    }
  };

  const content = ACCOUNT_CONTENT[mode];

  const renderContentPanel = () => (
    <div className="account-brand-panel">
      <div className="account-brand-copy">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>
          {(content.headingLines || [content.heading]).map((line) => (
            <span key={line}>{line}</span>
          ))}
        </h1>
        <p>{content.subtitle}</p>
      </div>
      <ul className="account-benefit-list" aria-label="Account benefits">
        {content.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
      </ul>
    </div>
  );

  const renderLoginForm = () => (
    !forgotOpen ? (
      <form id="account-login-form" name="accountLoginForm" className="account-form account-form-login" onSubmit={submitLogin}>
        <label className="account-field" htmlFor="account-login-identity">
          <span>Email Address or Mobile Number</span>
          <input id="account-login-identity" name="loginIdentity" autoComplete="username" value={loginIdentity} onChange={(event) => setLoginIdentity(event.target.value)} required />
        </label>
        <label className="account-field" htmlFor="account-login-password">
          <span>Password</span>
          <input id="account-login-password" name="loginPassword" type="password" autoComplete="current-password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} required />
        </label>
        <div className="account-form-meta">
          <button className="account-text-link" type="button" onClick={() => { setForgotOpen(true); setError(""); }}>Forgot Password?</button>
        </div>
        <button className="primary-button account-submit" type="submit">Login</button>
        <div className="account-social-block">
          <div className="account-divider"><span>or</span></div>
          <button className="account-google-button" type="button" onClick={signInGoogle}>
            <span className="account-google-icon">G</span>
            <span>Sign in with Google</span>
          </button>
        </div>
        <p className="account-switch-copy">Don't have an account? <button className="account-inline-switch" type="button" onClick={() => switchMode("signup")}>Create Account</button></p>
        {error ? <p className="account-form-error">{error}</p> : null}
      </form>
    ) : (
      <form id="account-forgot-password-form" name="accountForgotPasswordForm" className="account-form account-form-forgot" onSubmit={submitForgot}>
        <label className="account-field" htmlFor="account-forgot-identity">
          <span>Email Address or Mobile Number</span>
          <input id="account-forgot-identity" name="forgotIdentity" autoComplete="username" value={forgotIdentity} onChange={(event) => setForgotIdentity(event.target.value)} required />
        </label>
        <button className="primary-button account-submit" type="submit">Send Reset Link</button>
        <p className="account-switch-copy">Remembered your password? <button className="account-inline-switch" type="button" onClick={() => setForgotOpen(false)}>Back to Login</button></p>
        {error ? <p className="account-form-error">{error}</p> : null}
      </form>
    )
  );

  const renderSignupForm = () => (
    <form id="account-signup-form" name="accountSignupForm" className="account-form account-form-signup" onSubmit={submitSignup}>
      <label className="account-field" htmlFor="account-signup-full-name"><span>Full Name</span><input id="account-signup-full-name" name="fullName" autoComplete="name" value={signup.fullName} onChange={(event) => setSignup({ ...signup, fullName: event.target.value })} required /></label>
      <div className="account-form-grid">
        <label className="account-field" htmlFor="account-signup-email"><span>Email Address</span><input id="account-signup-email" name="email" type="email" autoComplete="email" value={signup.email} onChange={(event) => setSignup({ ...signup, email: event.target.value })} required /></label>
        <label className="account-field" htmlFor="account-signup-mobile"><span>Mobile Number</span><input id="account-signup-mobile" name="mobile" autoComplete="tel" value={signup.mobile} onChange={(event) => setSignup({ ...signup, mobile: event.target.value })} required /></label>
      </div>
      <label className="account-field account-field-compact" htmlFor="account-signup-referral"><span>Referral Code</span><input id="account-signup-referral" name="referralCode" autoComplete="off" value={signup.referralCode} onChange={(event) => setSignup({ ...signup, referralCode: event.target.value.toUpperCase() })} placeholder="Optional" /></label>
      <div className="account-form-grid">
        <label className="account-field" htmlFor="account-signup-password"><span>Password</span><input id="account-signup-password" name="password" type="password" autoComplete="new-password" value={signup.password} onChange={(event) => setSignup({ ...signup, password: event.target.value })} required /></label>
        <label className="account-field" htmlFor="account-signup-confirm-password"><span>Confirm Password</span><input id="account-signup-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" value={signup.confirmPassword} onChange={(event) => setSignup({ ...signup, confirmPassword: event.target.value })} required /></label>
      </div>
      <label className="account-checkbox account-business-toggle" htmlFor="account-signup-business">
        <input id="account-signup-business" name="isBusinessAccount" type="checkbox" checked={signup.isBusinessAccount} onChange={(event) => setSignup({ ...signup, isBusinessAccount: event.target.checked })} />
        <span>Business Purchase Account</span>
      </label>
      <div className={`account-business-panel ${signup.isBusinessAccount ? "is-open" : ""}`} hidden={!signup.isBusinessAccount}>
        <label className="account-field" htmlFor="account-signup-business-name"><span>Business Name</span><input id="account-signup-business-name" name="businessName" autoComplete="organization" value={signup.businessName} onChange={(event) => setSignup({ ...signup, businessName: event.target.value })} placeholder="Optional" /></label>
        <label className="account-field" htmlFor="account-signup-gst"><span>GST Number</span><input id="account-signup-gst" name="gstNumber" autoComplete="off" value={signup.gstNumber} onChange={(event) => setSignup({ ...signup, gstNumber: event.target.value.toUpperCase() })} placeholder="Optional" /></label>
      </div>
      <label className="account-checkbox" htmlFor="account-signup-consent">
        <input id="account-signup-consent" name="signupConsent" type="checkbox" checked={signupConsent} onChange={(event) => setSignupConsent(event.target.checked)} />
        <span>I agree to the Terms of Service and Privacy Policy</span>
      </label>
      <button className="primary-button account-submit" type="submit">Create Account</button>
      <p className="account-switch-copy">Already have an account? <button className="account-inline-switch" type="button" onClick={() => switchMode("login")}>Login</button></p>
      {error ? <p className="account-form-error">{error}</p> : null}
    </form>
  );

  const renderFormPanel = () => (
    <div className="account-form-panel">
      <div className="account-form-header">
        <div>
          <span className="account-form-logo">Secure Account</span>
          <p className="account-trust-line">Your information stays protected for faster checkout.</p>
        </div>
        <Link className="account-back-link" to="/">Continue Shopping</Link>
      </div>
      <div className="account-tab-switcher" role="tablist" aria-label="Account mode">
        <span className={`account-tab-indicator ${mode === "signup" ? "is-signup" : ""}`} aria-hidden="true" />
        <button className={`account-tab ${mode === "login" ? "active" : ""}`} type="button" onClick={() => switchMode("login")}>Login</button>
        <button className={`account-tab ${mode === "signup" ? "active" : ""}`} type="button" onClick={() => switchMode("signup")}>Create Account</button>
      </div>
      <div className={`account-panel-frame is-${mode}`}>
        <div className={`account-panel ${mode === "login" ? "active" : ""}`} aria-hidden={mode !== "login"}>
          {renderLoginForm()}
        </div>
        <div className={`account-panel ${mode === "signup" ? "active" : ""}`} aria-hidden={mode !== "signup"}>
          {renderSignupForm()}
        </div>
      </div>
    </div>
  );

  return (
    <main className="container account-main">
      <section className={`account-shell is-${mode}`}>
        <div className="account-panel-slot account-content-slot">
          {renderContentPanel()}
        </div>
        <div className="account-panel-slot account-form-slot">
          {renderFormPanel()}
        </div>
      </section>
    </main>
  );
}
