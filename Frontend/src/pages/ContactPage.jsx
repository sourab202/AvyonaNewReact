import React, { useEffect, useState } from "react";
import { submitContactEnquiry } from "../api/contactApi";
import { fetchPublicContactPageSettings } from "../api/settingsApi";
import { DEFAULT_APP_SETTINGS, mergeSettings } from "../../../shared/appSettings";
import { resolveMediaUrl } from "../utils/media";
import {
  FaBriefcase,
  FaBoxOpen,
  FaClock,
  FaEnvelope,
  FaHeadset,
  FaHeart,
  FaLeaf,
  FaLock,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaRegUser,
  FaShieldAlt,
  FaBolt
} from "react-icons/fa";

const configurableIcons = {
  leaf: FaLeaf,
  headset: FaHeadset,
  briefcase: FaBriefcase,
  envelope: FaEnvelope,
  phone: FaPhoneAlt,
  clock: FaClock,
  location: FaMapMarkerAlt,
  lock: FaLock,
  shield: FaShieldAlt,
  bolt: FaBolt,
  heart: FaHeart
};

function ConfigurableIcon({ builtin, imageUrl, size, color }) {
  const Icon = configurableIcons[builtin] || FaShieldAlt;
  const dimension = `${Number(size || 48)}px`;
  return imageUrl
    ? <img src={resolveMediaUrl(imageUrl)} alt="" style={{ width: dimension, height: dimension, objectFit: "contain" }} />
    : <Icon style={{ width: dimension, height: dimension, color }} />;
}

export default function ContactPage({ context }) {
  const siteSettings = context?.siteSettings || {};
  const general = siteSettings.general || {};
  const supportPhone = general.supportPhone || "";
  const supportEmail = general.supportEmail || "support@avyona.com";
  const storeAddress = general.businessAddress || "Avyona, Surat, Gujarat, India";
  const workingHours = general.workingHours || "Mon - Sat: 10 AM - 7 PM";
  const [pageSettings, setPageSettings] = useState(() => mergeSettings(
    DEFAULT_APP_SETTINGS.contactPage,
    siteSettings.contactPage || {}
  ));
  const [enquiryType, setEnquiryType] = useState("b2c");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = () => {
      fetchPublicContactPageSettings()
        .then((response) => {
          if (!mounted) return;
          const next = mergeSettings(DEFAULT_APP_SETTINGS.contactPage, response.data || {});
          setPageSettings(next);
          const firstEnabled = next.enquiryTypes.find((item) => item.enabled);
          setEnquiryType((current) => next.enquiryTypes.some((item) => item.key === current && item.enabled)
            ? current
            : (firstEnabled?.key || "b2c"));
        })
        .catch(() => {});
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    load();
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      mounted = false;
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const enquiryTypes = pageSettings.enquiryTypes.filter((item) => item.enabled);
  const selectedType = enquiryTypes.find((type) => type.key === enquiryType) || enquiryTypes[0] || pageSettings.enquiryTypes[0];
  const design = pageSettings.design;
  const pageStyle = {
    "--contact-accent": enquiryType === "b2b" ? design.businessAccent : design.customerAccent,
    "--contact-accent-dark": enquiryType === "b2b" ? design.businessAccentDark : design.customerAccentDark,
    "--contact-accent-soft": enquiryType === "b2b" ? design.businessAccentSoft : design.customerAccentSoft,
    "--contact-business-accent": design.businessAccent,
    "--contact-business-accent-dark": design.businessAccentDark,
    "--contact-business-accent-soft": design.businessAccentSoft,
    "--contact-page-bg": design.pageBackground,
    "--contact-hero-bg": design.heroBackground,
    "--contact-surface": design.surfaceColor,
    "--contact-text": design.textColor,
    "--contact-muted": design.mutedTextColor,
    "--contact-border": design.borderColor,
    "--contact-trust-bg": design.trustBackground,
    "--contact-radius": `${design.cardRadius}px`,
    "--contact-input-radius": `${design.inputRadius}px`,
    "--contact-content-width": `${design.contentMaxWidth}px`,
    "--contact-section-gap": `${design.sectionGap}px`,
    "--contact-heading-size": `${design.headingFontSize}px`,
    "--contact-mobile-heading-size": `${design.mobileHeadingFontSize}px`
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitted(false);
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(form);

    try {
      await submitContactEnquiry({
        enquiryType: selectedType.label,
        name: String(formData.get("fullName") || "").trim(),
        companyName: String(formData.get("companyName") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        orderId: String(formData.get("orderId") || "").trim(),
        message: String(formData.get("message") || "").trim()
      });
      form.reset();
      setSubmitted(true);
      context?.notify?.("Contact request submitted");
    } catch (submissionError) {
      setError(submissionError.message || pageSettings.errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!pageSettings.enabled) {
    return <main className="container contact-page"><section className="contact-form-panel"><h1>Contact page is currently unavailable.</h1></section></main>;
  }

  return (
    <main className={`container contact-page ${enquiryType === "b2b" ? "is-business" : "is-customer"}`} style={pageStyle}>
      {pageSettings.customCss ? <style>{pageSettings.customCss}</style> : null}
      <section className="contact-hero">
        {pageSettings.heroIcons.left.enabled ? (
          <div className="contact-hero-visual contact-hero-visual-left" aria-hidden="true">
            <ConfigurableIcon {...pageSettings.heroIcons.left} />
          </div>
        ) : <div className="contact-hero-visual" aria-hidden="true" />}
        <div className="contact-hero-copy">
          <h1>{pageSettings.heroTitle}</h1>
          {pageSettings.heroLineOne ? <p>{pageSettings.heroLineOne}</p> : null}
          {pageSettings.heroLineTwo ? <p>{pageSettings.heroLineTwo}</p> : null}
        </div>
        {pageSettings.heroIcons.right.enabled ? (
          <div className="contact-hero-visual contact-hero-visual-right" aria-hidden="true">
            <ConfigurableIcon {...pageSettings.heroIcons.right} />
          </div>
        ) : <div className="contact-hero-visual" aria-hidden="true" />}
      </section>

      <section className="contact-section-heading">
        <h2>{pageSettings.sectionTitle}</h2>
        <span aria-hidden="true" />
      </section>

      <section className="contact-type-grid" aria-label="Choose enquiry type">
        {enquiryTypes.map((type) => (
          <button
            key={type.key}
            className={`contact-type-card ${enquiryType === type.key ? "is-active" : ""}`}
            type="button"
            onClick={() => {
              setEnquiryType(type.key);
              setSubmitted(false);
              setError("");
            }}
          >
            {type.showIcon ? (
              <span className="contact-type-icon" aria-hidden="true" style={{ background: type.iconBackground, color: type.iconColor }}>
                <ConfigurableIcon builtin={type.iconBuiltin} imageUrl={type.iconUrl} size={type.iconSize} color={type.iconColor} />
              </span>
            ) : null}
            <span className="contact-type-copy">
              <strong>{type.title}</strong>
              <p>{type.description}</p>
              <span className="contact-card-cta">{type.buttonText}</span>
            </span>
          </button>
        ))}
      </section>

      <section className="contact-form-panel">
        <div className="contact-form-head">
          <h2>{selectedType.title}</h2>
          <span aria-hidden="true" />
          <p>{pageSettings.formIntro}</p>
        </div>

        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="contact-form-grid">
            <label className="contact-field">
              <span className="sr-only">Name</span>
              <FaRegUser aria-hidden="true" />
              <input name="fullName" autoComplete="name" placeholder={pageSettings.fullNamePlaceholder} required />
            </label>
            {enquiryType === "b2b" ? (
              <label className="contact-field">
                <span className="sr-only">Company Name</span>
                <FaBriefcase aria-hidden="true" />
                <input name="companyName" autoComplete="organization" placeholder={pageSettings.companyNamePlaceholder} required />
              </label>
            ) : null}
            <label className="contact-field">
              <span className="sr-only">Email</span>
              <FaEnvelope aria-hidden="true" />
              <input name="email" type="email" autoComplete="email" placeholder={pageSettings.emailPlaceholder} required />
            </label>
            <label className="contact-field">
              <span className="sr-only">Phone</span>
              <FaPhoneAlt aria-hidden="true" />
              <input name="phone" type="tel" autoComplete="tel" placeholder={pageSettings.phonePlaceholder} required />
            </label>
            {enquiryType === "b2c" ? (
              <label className="contact-field">
                <span className="sr-only">Order ID optional</span>
                <FaBoxOpen aria-hidden="true" />
                <input name="orderId" placeholder={pageSettings.orderIdPlaceholder} />
              </label>
            ) : null}
          </div>

          <label className="contact-field contact-message-field">
            <span className="sr-only">Message</span>
            <textarea name="message" rows={5} placeholder={pageSettings.messagePlaceholder} required />
          </label>

          <button className="primary-button contact-submit-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? pageSettings.submittingButtonText : pageSettings.submitButtonText}
          </button>
          {error ? <p className="contact-error">{error}</p> : null}
          {submitted ? <p className="contact-success">{pageSettings.successMessage}</p> : null}
        </form>
      </section>

      <section className="contact-details-bar" aria-label="Contact details">
        {pageSettings.details.showEmail ? <article>
          {pageSettings.details.icons.email.showIcon ? (
            <span className="contact-detail-icon" style={{ background: pageSettings.details.icons.email.background }}>
              <ConfigurableIcon {...pageSettings.details.icons.email} />
            </span>
          ) : null}
          <strong>{pageSettings.details.emailLabel}</strong>
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
        </article> : null}
        {pageSettings.details.showPhone ? <article>
          {pageSettings.details.icons.phone.showIcon ? (
            <span className="contact-detail-icon" style={{ background: pageSettings.details.icons.phone.background }}>
              <ConfigurableIcon {...pageSettings.details.icons.phone} />
            </span>
          ) : null}
          <strong>{pageSettings.details.phoneLabel}</strong>
          {supportPhone ? <a href={`tel:${supportPhone.replace(/\s+/g, "")}`}>{supportPhone}</a> : <span>{pageSettings.details.emptyPhoneText}</span>}
        </article> : null}
        {pageSettings.details.showHours ? <article>
          {pageSettings.details.icons.hours.showIcon ? (
            <span className="contact-detail-icon" style={{ background: pageSettings.details.icons.hours.background }}>
              <ConfigurableIcon {...pageSettings.details.icons.hours} />
            </span>
          ) : null}
          <strong>{pageSettings.details.hoursLabel}</strong>
          <span>{workingHours}</span>
        </article> : null}
        {pageSettings.details.showAddress ? <article>
          {pageSettings.details.icons.address.showIcon ? (
            <span className="contact-detail-icon" style={{ background: pageSettings.details.icons.address.background }}>
              <ConfigurableIcon {...pageSettings.details.icons.address} />
            </span>
          ) : null}
          <strong>{pageSettings.details.addressLabel}</strong>
          <span>{storeAddress}</span>
        </article> : null}
      </section>

      <section className="contact-trust-strip" aria-label="Service commitments">
        {pageSettings.trustItems.filter((item) => item.enabled).map((item) => (
          <span key={item.key}>
            {item.showIcon ? <ConfigurableIcon builtin={item.iconBuiltin} imageUrl={item.iconUrl} size={item.iconSize} color={item.iconColor} /> : null}
            {item.label}
          </span>
        ))}
      </section>
    </main>
  );
}
