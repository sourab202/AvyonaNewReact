import React from "react";
import { Link } from "react-router-dom";
import { DEFAULT_APP_SETTINGS } from "../../../../shared/appSettings";
import { fetchPublicFooter } from "../../api/settingsApi";
import { resolveMediaUrl } from "../../utils/media";

function sortFooterItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => (item.status || "active") === "active")
    .slice()
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
}

function normalizeFooterData(payload = {}) {
  const footer = {
    ...DEFAULT_APP_SETTINGS.footer,
    ...(payload || {}),
    branding: {
      ...DEFAULT_APP_SETTINGS.footer.branding,
      ...(payload.branding || {})
    },
    support: {
      ...DEFAULT_APP_SETTINGS.footer.support,
      ...(payload.support || {})
    },
    newsletter: {
      ...DEFAULT_APP_SETTINGS.footer.newsletter,
      ...(payload.newsletter || {})
    },
    design: {
      ...DEFAULT_APP_SETTINGS.footer.design,
      ...(payload.design || {})
    }
  };

  return {
    ...footer,
    branding: {
      ...footer.branding,
      footerLogo: resolveMediaUrl(footer.branding.footerLogo),
      backgroundWatermarkImage: resolveMediaUrl(footer.branding.backgroundWatermarkImage)
    },
    quickLinks: sortFooterItems(footer.quickLinks),
    faqLinks: sortFooterItems(footer.faqLinks),
    policyLinks: sortFooterItems(footer.policyLinks),
    socialLinks: sortFooterItems(footer.socialLinks).map((item) => ({
      ...item,
      icon: resolveMediaUrl(item.icon)
    })),
    paymentIcons: sortFooterItems(footer.paymentIcons).map((item) => ({
      ...item,
      icon: resolveMediaUrl(item.icon)
    }))
  };
}

function isInternalLink(url = "") {
  return String(url || "").startsWith("/");
}

function FooterLink({ to, children }) {
  const href = String(to || "#").trim() || "#";
  if (isInternalLink(href)) return <Link to={href}>{children}</Link>;
  return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
}

function isSafeFooterCss(value = "") {
  const css = String(value || "").trim();
  if (!css) return false;
  if (css.length > 10000) return false;
  if (!/\.avyona-footer[\s.#:[,{>+~]/i.test(`${css} `)) return false;
  if (!/[{}]/.test(css)) return false;
  return !/(<\/?\s*[a-z][^>]*>|javascript:|on\w+\s*=|expression\s*\(|import\s*\(|@import|\biframe\b)/i.test(css);
}

function FooterFaqAccordion({ items = [] }) {
  const [openId, setOpenId] = React.useState("");

  return (
    <div className="footer-faq-list">
      {items.map((item) => {
        const itemId = item.id || item.questionText;
        const isOpen = openId === itemId;

        return (
          <div key={itemId} className={`footer-faq-item${isOpen ? " open" : ""}`}>
            <button type="button" onClick={() => setOpenId(isOpen ? "" : itemId)} aria-expanded={isOpen}>
              <span>{item.questionText}</span>
              <span aria-hidden="true">{isOpen ? "-" : "+"}</span>
            </button>
            {isOpen ? (
              <div className="footer-faq-answer">
                <p>{item.answer || "Details will be updated soon."}</p>
                {item.url ? <FooterLink to={item.url}>Learn more</FooterLink> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function SiteFooter({ context }) {
  const siteSettings = context.siteSettings || {};
  const general = siteSettings.general || {};
  const [footer, setFooter] = React.useState(() => normalizeFooterData(siteSettings.footer || DEFAULT_APP_SETTINGS.footer));
  const [newsletterMessage, setNewsletterMessage] = React.useState("");

  React.useEffect(() => {
    setFooter(normalizeFooterData(siteSettings.footer || DEFAULT_APP_SETTINGS.footer));
  }, [siteSettings.footer]);

  React.useEffect(() => {
    let isMounted = true;

    async function loadFooter() {
      try {
        const response = await fetchPublicFooter();
        const payload = response.data?.data || response.data || {};
        if (isMounted) setFooter(normalizeFooterData(payload));
      } catch {
        if (isMounted) setFooter(normalizeFooterData(siteSettings.footer || DEFAULT_APP_SETTINGS.footer));
      }
    }

    loadFooter();

    return () => {
      isMounted = false;
    };
  }, [siteSettings.footer]);

  const branding = footer.branding || {};
  const support = footer.support || {};
  const newsletter = footer.newsletter || {};
  const design = footer.design || {};
  const footerLogo = branding.footerLogo || resolveMediaUrl(general.logoUrl);
  const supportEmail = support.supportEmail || general.supportEmail || "support@avyona.com";
  const supportPhone = support.supportPhone || general.supportPhone || "";
  const defaultFooterDesign = DEFAULT_APP_SETTINGS.footer.design || {};
  const footerStyle = {
    ...(design.backgroundColor && design.backgroundColor !== defaultFooterDesign.backgroundColor ? { "--footer-background": design.backgroundColor } : {}),
    ...(design.textColor && design.textColor !== defaultFooterDesign.textColor ? { "--footer-text": design.textColor } : {}),
    ...(design.accentColor && design.accentColor !== defaultFooterDesign.accentColor ? { "--footer-accent": design.accentColor } : {}),
    ...(design.linkColor && design.linkColor !== defaultFooterDesign.linkColor ? { "--footer-link": design.linkColor } : {})
  };

  const handleNewsletterSubmit = (event) => {
    event.preventDefault();
    setNewsletterMessage(newsletter.successMessage || "Thank you for subscribing.");
    event.currentTarget.reset();
  };

  return (
    <footer className={`site-footer avyona-footer avyona-footer-${design.layoutStyle || "columns"}`} id="support" style={footerStyle}>
      {branding.backgroundWatermarkImage ? <img className="footer-watermark" src={branding.backgroundWatermarkImage} alt="" loading="lazy" aria-hidden="true" /> : null}
      {isSafeFooterCss(design.customCss) ? <style>{design.customCss}</style> : null}
      <div className="container footer-grid footer-desktop-grid">
        <div className="footer-brand-column">
          <div className="brand-lockup footer-brand">
            {footerLogo ? <img className="brand-logo footer-logo" src={footerLogo} alt={`${general.storeName || "Avyona"} logo`} loading="lazy" /> : <span className="brand-text">{general.storeName || "Avyona"}</span>}
          </div>
          {branding.tagline ? <strong className="footer-tagline">{branding.tagline}</strong> : null}
          <p className="footer-copy">{branding.description || general.brandTagline || DEFAULT_APP_SETTINGS.footer.branding.description}</p>
          {footer.socialLinks.length ? (
            <div className="footer-icon-row footer-social-row" aria-label="Social links">
              {footer.socialLinks.map((item) => (
                <FooterLink key={item.id || item.name} to={item.url}>
                  {item.icon ? <img src={item.icon} alt="" loading="lazy" /> : <span>{String(item.name || "").slice(0, 1)}</span>}
                  <span className="sr-only">{item.name}</span>
                </FooterLink>
              ))}
            </div>
          ) : null}
          {footer.paymentIcons.length ? (
            <div className="footer-icon-row footer-payment-row" aria-label="Payment methods">
              {footer.paymentIcons.map((item) => (
                <span key={item.id || item.name}>
                  {item.icon ? <img src={item.icon} alt="" loading="lazy" /> : item.name}
                </span>
              ))}
            </div>
          ) : null}
          {branding.copyrightText ? <span className="footer-copyright">{branding.copyrightText}</span> : null}
          {footer.policyLinks.length ? (
            <div className="footer-policy-row">
              {footer.policyLinks.map((item) => (
                <FooterLink key={item.id || item.label} to={item.url}>{item.label}</FooterLink>
              ))}
            </div>
          ) : null}
        </div>
        <div className="footer-middle-column">
          {footer.quickLinks.length ? (
            <section>
              <h3>Quick Actions</h3>
              {footer.quickLinks.map((item) => (
                <FooterLink key={item.id || item.label} to={item.url}>{item.label}</FooterLink>
              ))}
            </section>
          ) : null}
          {footer.faqLinks.length ? (
            <section>
              <h3>FAQ</h3>
              <FooterFaqAccordion items={footer.faqLinks} />
            </section>
          ) : null}
        </div>
        <div className="footer-support-column">
          <h3>{support.sectionTitle || "Support"}</h3>
          {support.emailLabel ? <strong>{support.emailLabel}</strong> : null}
          {supportEmail ? <a href={`mailto:${supportEmail}`}>{supportEmail}</a> : null}
          {support.emailHelpText ? <span>{support.emailHelpText}</span> : null}
          {support.phoneLabel ? <strong>{support.phoneLabel}</strong> : null}
          {supportPhone ? <a href={`tel:${supportPhone.replace(/\s+/g, "")}`}>{supportPhone}</a> : null}
          {support.phoneHelpText ? <span>{support.phoneHelpText}</span> : null}
          {support.workingHours ? <span>{support.workingHours}</span> : null}
          {newsletter.enabled ? (
            <form className="footer-newsletter" onSubmit={handleNewsletterSubmit}>
              {newsletter.title ? <h3>{newsletter.title}</h3> : null}
              <div>
                <input type="email" placeholder={newsletter.emailPlaceholder || "Enter your email"} required />
                <button type="submit" aria-label={newsletter.buttonText || "Subscribe"}>{newsletter.buttonText || "Subscribe"}</button>
              </div>
              {newsletter.description ? <p>{newsletter.description}</p> : null}
              {newsletterMessage ? <span>{newsletterMessage}</span> : null}
            </form>
          ) : null}
        </div>
      </div>
      <div className="container footer-mobile-layout">
        <div className="brand-lockup footer-brand">
          {footerLogo ? <img className="brand-logo footer-logo" src={footerLogo} alt={`${general.storeName || "Avyona"} logo`} loading="lazy" /> : <span className="brand-text">{general.storeName || "Avyona"}</span>}
        </div>
        {branding.tagline ? <strong className="footer-tagline">{branding.tagline}</strong> : null}
        <p className="footer-copy">{branding.description || general.brandTagline || DEFAULT_APP_SETTINGS.footer.branding.description}</p>

        {footer.quickLinks.length ? (
          <section className="footer-mobile-section">
            <h3>Quick Actions</h3>
            <div className="footer-mobile-link-list">
              {footer.quickLinks.map((item) => (
                <FooterLink key={item.id || item.label} to={item.url}>{item.label}</FooterLink>
              ))}
            </div>
          </section>
        ) : null}

        <section className="footer-mobile-section footer-mobile-support">
          <h3>{support.sectionTitle || "Support"}</h3>
          {support.emailLabel ? <strong>{support.emailLabel}</strong> : null}
          {supportEmail ? <a href={`mailto:${supportEmail}`}>{supportEmail}</a> : null}
          {support.emailHelpText ? <span>{support.emailHelpText}</span> : null}
          {support.phoneLabel ? <strong>{support.phoneLabel}</strong> : null}
          {supportPhone ? <a href={`tel:${supportPhone.replace(/\s+/g, "")}`}>{supportPhone}</a> : null}
          {support.phoneHelpText ? <span>{support.phoneHelpText}</span> : null}
          {support.workingHours ? <span>{support.workingHours}</span> : null}
        </section>

        {newsletter.enabled ? (
          <form className="footer-newsletter footer-mobile-newsletter" onSubmit={handleNewsletterSubmit}>
            {newsletter.title ? <h3>{newsletter.title}</h3> : null}
            <div>
              <input type="email" placeholder={newsletter.emailPlaceholder || "Enter your email"} required />
              <button type="submit" aria-label={newsletter.buttonText || "Subscribe"}>{newsletter.buttonText || "Subscribe"}</button>
            </div>
            {newsletter.description ? <p>{newsletter.description}</p> : null}
            {newsletterMessage ? <span>{newsletterMessage}</span> : null}
          </form>
        ) : null}

        {footer.faqLinks.length ? (
          <section className="footer-mobile-section">
            <h3>FAQ</h3>
            <FooterFaqAccordion items={footer.faqLinks} />
          </section>
        ) : null}

        {footer.paymentIcons.length ? (
          <div className="footer-icon-row footer-payment-row" aria-label="Payment methods">
            {footer.paymentIcons.map((item) => (
              <span key={item.id || item.name}>
                {item.icon ? <img src={item.icon} alt="" loading="lazy" /> : item.name}
              </span>
            ))}
          </div>
        ) : null}

        {footer.policyLinks.length ? (
          <div className="footer-policy-row">
            {footer.policyLinks.map((item) => (
              <FooterLink key={item.id || item.label} to={item.url}>{item.label}</FooterLink>
            ))}
          </div>
        ) : null}

        {footer.socialLinks.length ? (
          <div className="footer-icon-row footer-social-row" aria-label="Social links">
            {footer.socialLinks.map((item) => (
              <FooterLink key={item.id || item.name} to={item.url}>
                {item.icon ? <img src={item.icon} alt="" loading="lazy" /> : <span>{String(item.name || "").slice(0, 1)}</span>}
                <span className="sr-only">{item.name}</span>
              </FooterLink>
            ))}
          </div>
        ) : null}

        {branding.copyrightText ? <span className="footer-copyright">{branding.copyrightText}</span> : null}
      </div>
    </footer>
  );
}
