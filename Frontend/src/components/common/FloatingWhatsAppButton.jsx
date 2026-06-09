import React from "react";
import { useLocation } from "react-router-dom";
import { DEFAULT_APP_SETTINGS } from "../../../../shared/appSettings";
import { resolveMediaUrl } from "../../utils/media";

function normalizePhoneNumber(value = "") {
  return String(value || "").replace(/[^\d]/g, "");
}

function getProductFromPath(pathname = "", products = []) {
  const match = pathname.match(/^\/product\/([^/]+)/);
  if (!match) return null;
  const slug = decodeURIComponent(match[1] || "");
  return products.find((product) => String(product.slug || "") === slug) || null;
}

function buildSmartMessage({ settings, pathname, products }) {
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";
  const product = getProductFromPath(pathname, products);
  if (product) {
    return String(settings.productMessage || DEFAULT_APP_SETTINGS.whatsapp.productMessage)
      .replace(/\{\{productName\}\}/g, product.name || "this product")
      .replace(/\{\{productUrl\}\}/g, currentUrl);
  }

  const orderMatch = pathname.match(/^\/order-confirmation\/([^/]+)/);
  if (orderMatch) {
    return String(settings.orderMessage || DEFAULT_APP_SETTINGS.whatsapp.orderMessage)
      .replace(/\{\{orderId\}\}/g, decodeURIComponent(orderMatch[1] || ""));
  }

  return String(settings.defaultMessage || DEFAULT_APP_SETTINGS.whatsapp.defaultMessage);
}

function WhatsAppGlyph({ size = 28 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M16.02 3.2c-7.04 0-12.76 5.64-12.76 12.6 0 2.23.6 4.4 1.72 6.3L3.2 28.8l6.9-1.76a12.94 12.94 0 0 0 5.92 1.46c7.04 0 12.76-5.64 12.76-12.6S23.06 3.2 16.02 3.2Zm0 22.92c-1.84 0-3.64-.5-5.2-1.44l-.38-.22-4.1 1.04 1.08-3.94-.26-.4a10.14 10.14 0 0 1-1.56-5.36c0-5.64 4.64-10.22 10.34-10.22 5.72 0 10.36 4.58 10.36 10.22 0 5.64-4.64 10.32-10.28 10.32Zm5.66-7.7c-.3-.16-1.82-.88-2.1-.98-.28-.1-.48-.16-.68.16-.2.3-.78.98-.96 1.18-.18.2-.36.22-.66.08-.3-.16-1.28-.46-2.44-1.48-.9-.8-1.52-1.8-1.7-2.1-.18-.3-.02-.46.14-.62.14-.14.3-.36.46-.54.16-.18.2-.3.3-.5.1-.2.06-.38-.02-.54-.08-.16-.68-1.62-.94-2.22-.24-.58-.5-.5-.68-.5h-.58c-.2 0-.54.08-.82.38-.28.3-1.08 1.04-1.08 2.54s1.12 2.96 1.28 3.16c.16.2 2.2 3.32 5.34 4.66.74.32 1.32.5 1.78.64.74.24 1.42.2 1.96.12.6-.08 1.82-.74 2.08-1.44.26-.7.26-1.3.18-1.44-.08-.14-.28-.22-.58-.38Z" />
    </svg>
  );
}

export default function FloatingWhatsAppButton({ context }) {
  const location = useLocation();
  const settings = {
    ...DEFAULT_APP_SETTINGS.whatsapp,
    ...(context?.siteSettings?.whatsapp || {})
  };
  const pathname = location.pathname || "/";
  const phoneNumber = normalizePhoneNumber(settings.number);

  if (!settings.enabled || !phoneNumber) return null;
  if (settings.hideAdmin && /^\/dashboard(?:\/|$)/i.test(pathname)) return null;
  if (settings.hideCheckout && /^\/checkout\/?$/i.test(pathname)) return null;
  if (settings.hideOrderConfirmation && /^\/order-confirmation(?:\/|$)/i.test(pathname)) return null;
  if (!settings.showMobile && !settings.showDesktop) return null;

  const message = buildSmartMessage({
    settings,
    pathname,
    products: context?.allProducts || []
  });
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  const positionClass = settings.position === "bottom-left" ? "is-left" : "is-right";
  const visibilityClass = `${settings.showMobile ? "show-mobile" : "hide-mobile"} ${settings.showDesktop ? "show-desktop" : "hide-desktop"}`;
  const iconUrl = resolveMediaUrl(settings.iconUrl || "");
  const iconSize = Math.min(44, Math.max(20, Number(settings.iconSize || 28)));

  return (
    <a
      className={`whatsapp-floating-button ${positionClass} ${visibilityClass}`}
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={settings.hoverText || "Need Help? Chat with us"}
      style={{
        "--whatsapp-button-color": settings.buttonColor || "#25D366",
        "--whatsapp-icon-size": `${iconSize}px`
      }}
    >
      {iconUrl ? <img src={iconUrl} alt="" /> : <WhatsAppGlyph size={iconSize} />}
      <span>{settings.hoverText || "Need Help? Chat with us"}</span>
    </a>
  );
}
