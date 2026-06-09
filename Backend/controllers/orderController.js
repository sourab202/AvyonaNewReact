import { pool, query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";
import { ORDER_STATUS_FLOW } from "../shared/orderStatusFlow.js";
import { grantReferralBonus, grantPurchaseCashback, grantMilestoneReward } from "../services/creditPointsRewards.js";
import {
  getCustomerBusinessDetails,
  ensureOrderBusinessDetailsTable,
  publicBusinessDetails,
  saveCustomerBusinessDetails,
  saveOrderBusinessDetails
} from "../services/customerBusinessDetails.js";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

// ── Invoice helpers ──────────────────────────────────────────────

const INVOICE_PAYMENT_LABELS = {
  cod: "Cash on Delivery",
  razorpay: "Razorpay",
  stripe: "Stripe",
  phonepe: "PhonePe",
  test_success: "Online Payment",
  test_failure: "Online Payment"
};

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function capitalize(str) {
  return String(str || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function ensureOrderAddressTypeIndex(connection = pool) {
  const executor = connection.execute ? connection : pool;
  const [indexes] = await executor.execute("SHOW INDEX FROM order_addresses");
  const existingOrderOnlyUnique = indexes.some((index) =>
    index.Key_name === "order_id" &&
    Number(index.Non_unique) === 0 &&
    index.Column_name === "order_id"
  );
  const hasOrderTypeUnique = indexes.some((index) => index.Key_name === "uq_order_addresses_order_type");

  if (existingOrderOnlyUnique) {
    await executor.execute("ALTER TABLE order_addresses DROP FOREIGN KEY fk_order_addresses_order");
    await executor.execute("ALTER TABLE order_addresses DROP INDEX order_id");
  }
  if (!hasOrderTypeUnique) {
    await executor.execute("CREATE UNIQUE INDEX uq_order_addresses_order_type ON order_addresses(order_id, address_type)");
  }
  if (existingOrderOnlyUnique) {
    await executor.execute(
      "ALTER TABLE order_addresses ADD CONSTRAINT fk_order_addresses_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE"
    );
  }
}

function buildOrderAddressPayload(source = {}, fallback = {}) {
  const fullName = [
    source.firstName ?? fallback.firstName,
    source.lastName ?? fallback.lastName
  ].filter(Boolean).join(" ").trim() || fallback.fullName || "Guest Customer";

  return {
    fullName,
    email: String(source.email ?? fallback.email ?? "").trim() || null,
    phone: String(source.phone ?? fallback.phone ?? "").trim() || null,
    line1: String(source.line1 ?? fallback.line1 ?? "").trim(),
    line2: String(source.line2 ?? fallback.line2 ?? "").trim() || null,
    landmark: String(source.landmark ?? fallback.landmark ?? "").trim() || null,
    city: String(source.city ?? fallback.city ?? "").trim(),
    state: String(source.state ?? fallback.state ?? "").trim(),
    pincode: String(source.pincode ?? fallback.pincode ?? "").trim(),
    country: String(source.country ?? fallback.country ?? "India").trim() || "India"
  };
}

function formatInvoiceCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

async function loadInvoiceStoreSettings() {
  try {
    const rows = await query(
      `SELECT setting_key AS k, setting_value AS v, setting_group AS g
       FROM app_settings
       WHERE setting_group IN ('general', 'store', 'thankYouPage')`
    );
    const gen = {}, st = {}, ty = {};
    rows.forEach(({ k, v, g }) => {
      const val = String(v ?? "");
      if (g === "general") gen[k] = val;
      else if (g === "store") st[k.replace(/^store__/, "")] = val;
      else if (g === "thankYouPage") ty[k.replace(/^thankYouPage__/, "")] = val;
    });
    return {
      storeName: gen.store_name || "Avyona",
      businessLegalName: gen.business_name || "Avyona",
      businessAddress: gen.business_address || "Bengaluru, Karnataka, India",
      supportEmail: gen.support_email || "support@avyona.com",
      supportPhone: gen.support_phone || "",
      gstNumber: gen.gst_number || "",
      logoUrl: gen.store_logo_url || "",
      taxInclusion: st.taxInclusion || "inclusive",
      showDownloadInvoiceButton: ty.showDownloadInvoiceButton !== "false"
    };
  } catch {
    return {
      storeName: "Avyona",
      businessLegalName: "Avyona",
      businessAddress: "Bengaluru, Karnataka, India",
      supportEmail: "support@avyona.com",
      supportPhone: "",
      gstNumber: "",
      logoUrl: "",
      taxInclusion: "inclusive",
      showDownloadInvoiceButton: true
    };
  }
}

async function loadInvoiceDesignerSettings() {
  try {
    const rows = await query(
      "SELECT setting_key AS k, setting_value AS v FROM app_settings WHERE setting_group = 'invoiceDesigner'"
    );
    const map = {};
    rows.forEach((row) => {
      const field = String(row.k || "").replace(/^invoiceDesigner__/, "");
      map[field] = String(row.v ?? "");
    });
      const bool = (key, def) => (map[key] === "" ? def : map[key] === "true");
      return {
      logoUrl: map.logoSource || map.logoUrl || "",
      logoSource: map.logoSource || map.logoUrl || "",
      headerText: map.headerText || "",
      footerText: map.computerGeneratedNote || map.footerText || "",
      footerThankYouNote: map.footerThankYouNote || map.thankYouNote || "Thank you for shopping with us!",
      computerGeneratedNote: map.computerGeneratedNote || map.footerText || "Computer-generated invoice. No signature required.",
      supportContactNote: map.supportContactNote || map.supportNote || "",
      websiteUrl: map.websiteUrl || "",
      watermarkUrl: map.watermarkUrl || "",
      qrCodeUrl: map.qrCodeUrl || "",
      bottomNoteText: map.bottomNoteText || "",
      signatureUrl: map.signatureUrl || "",
      stampUrl: map.stampUrl || "",
      businessName: map.businessName || "",
      gstNumber: map.gstNumber || "",
      address: map.address || "",
      supportEmail: map.supportEmail || "",
      supportPhone: map.supportPhone || "",
      showLogo: bool("showLogo", true),
      showGst: bool("showGst", true),
      showSupportDetails: bool("showSupportDetails", true),
      showProductImage: bool("showProductImage", false),
      showSkuAsin: bool("showSkuAsin", true),
      showTax: bool("showTax", true),
      showCreditPoints: bool("showCreditPoints", true),
      showFooterNote: bool("showFooterNote", true),
      showWatermark: bool("showWatermark", true),
      showQrCode: bool("showQrCode", true),
      thankYouNote: map.footerThankYouNote || map.thankYouNote || "Thank you for shopping with us!",
      returnPolicyNote: map.returnPolicyNote || "",
      warrantyNote: map.warrantyNote || "",
      supportNote: map.supportContactNote || map.supportNote || ""
    };
  } catch {
    return {
      logoUrl: "", logoSource: "", headerText: "", footerText: "", footerThankYouNote: "Thank you for shopping with us!",
      computerGeneratedNote: "Computer-generated invoice. No signature required.", supportContactNote: "",
      websiteUrl: "", watermarkUrl: "", qrCodeUrl: "", bottomNoteText: "", signatureUrl: "", stampUrl: "",
      businessName: "", gstNumber: "", address: "", supportEmail: "", supportPhone: "",
      showLogo: true, showGst: true, showSupportDetails: true, showProductImage: false,
      showSkuAsin: true, showTax: true, showCreditPoints: true, showFooterNote: true, showWatermark: true, showQrCode: true,
      thankYouNote: "Thank you for shopping with us!",
      returnPolicyNote: "", warrantyNote: "", supportNote: ""
    };
  }
}

const INVOICE_PAYMENT_STATUS_LABELS = {
  paid: "Paid",
  authorized: "Authorized",
  cod_pending: "Pay on Delivery",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partially Refunded",
  pending: "Pending"
};

function buildInvoiceHtml(order, items, store, address, designer = {}, noPrint = false) {
  const paymentLabel = INVOICE_PAYMENT_LABELS[String(order.paymentMethod || "").toLowerCase()] || capitalize(order.paymentMethod) || "Online Payment";
  const paymentStatusLabel = INVOICE_PAYMENT_STATUS_LABELS[String(order.paymentStatus || "").toLowerCase()] || capitalize(order.paymentStatus || "Pending");
  const paymentStatusKey = String(order.paymentStatus || "pending").toLowerCase();

  // Merge designer overrides over store defaults
  const bizName = designer.businessName || store.businessLegalName || store.storeName;
  const bizAddress = designer.address || store.businessAddress;
  const bizEmail = designer.supportEmail || store.supportEmail;
  const bizPhone = designer.supportPhone || store.supportPhone;
  const bizGst = designer.showGst !== false ? (designer.gstNumber || store.gstNumber) : "";
  const resolvedLogoUrl = designer.showLogo !== false ? (designer.logoUrl || store.logoUrl) : "";
  const watermarkUrl = designer.showWatermark !== false ? (designer.watermarkUrl || "") : "";
  const headerText = designer.headerText || "";
  const footerText = designer.computerGeneratedNote || designer.footerText || (designer.showFooterNote !== false ? "Computer-generated invoice. No signature required." : "");
  const thankYouNote = designer.footerThankYouNote || designer.thankYouNote || "Thank you for shopping with us!";
  const supportContactNote = designer.supportContactNote || designer.supportNote || [bizPhone, bizEmail].filter(Boolean).join(" | ");
  const websiteUrl = String(designer.websiteUrl || "").trim();
  const bottomNoteText = String(designer.bottomNoteText || "").trim();
  const showQrCode = designer.showQrCode !== false;

  const orderDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  const billingAddress = address.billingAddress || address;
  const shippingAddress = address.shippingAddress || address;
  const billingAddressParts = [
    billingAddress.line1,
    billingAddress.line2,
    billingAddress.landmark,
    [billingAddress.city, billingAddress.state].filter(Boolean).join(", "),
    billingAddress.pincode,
    billingAddress.country !== "India" ? billingAddress.country : ""
  ].filter(Boolean);
  const shippingAddressParts = [
    shippingAddress.line1,
    shippingAddress.line2,
    shippingAddress.landmark,
    [shippingAddress.city, shippingAddress.state].filter(Boolean).join(", "),
    shippingAddress.pincode,
    shippingAddress.country !== "India" ? shippingAddress.country : ""
  ].filter(Boolean);
  const customerBusinessName = String(address.businessName || "").trim();
  const customerGstNumber = String(address.gstNumber || "").trim().toUpperCase();

  // Per-item enrichment
  const showSkuAsin = designer.showSkuAsin !== false;
  const showTaxCol = designer.showTax !== false;
  const showProductImage = designer.showProductImage === true;
  const globalTaxInclusive = store.taxInclusion !== "exclusive";

  const itemsCalc = items.map((item) => {
    const qty = Number(item.quantity || 1);
    const unitPrice = Number(item.unitPrice || 0);
    const total = Number(item.totalPrice || unitPrice * qty);
    const mrp = Number(item.mrp || 0);
    const taxRate = Number(item.taxRate || 0);
    const taxIncluded = item.taxIncluded != null ? Number(item.taxIncluded) !== 0 : globalTaxInclusive;
    const discountTotal = mrp > unitPrice ? Math.round((mrp - unitPrice) * qty) : 0;
    let taxAmount = 0;
    if (taxRate > 0) {
      taxAmount = taxIncluded
        ? Math.round((unitPrice * qty * taxRate) / (100 + taxRate))
        : Math.round((unitPrice * qty * taxRate) / 100);
    }
    const skuAsin = showSkuAsin ? [item.sku, item.asin].filter(Boolean).join(" / ") : "";
    return { ...item, qty, unitPrice, total, mrp, discountTotal, taxAmount, skuAsin };
  });

  const hasTax = showTaxCol && itemsCalc.some((i) => i.taxAmount > 0);
  const taxTotal = showTaxCol ? itemsCalc.reduce((sum, item) => sum + Number(item.taxAmount || 0), 0) : 0;
  const couponDiscount = Number(order.couponDiscount || 0);
  const creditDiscount = designer.showCreditPoints !== false ? Number(order.creditDiscount || 0) : 0;

  const logoHtml = resolvedLogoUrl
    ? `<img src="${escapeHtml(resolvedLogoUrl)}" alt="${escapeHtml(store.storeName)}" class="inv-logo" />`
    : `<div class="inv-brand-text">${escapeHtml(store.storeName)}</div>`;
  const watermarkHtml = watermarkUrl
    ? `<img src="${escapeHtml(watermarkUrl)}" alt="" class="inv-watermark" />`
    : "";

  const itemRowsHtml = itemsCalc.map((item) => `
    <tr>
      <td class="col-name">
        <span class="item-name">${escapeHtml(item.name)}</span>
        ${item.skuAsin ? `<span class="item-sku">${escapeHtml(item.skuAsin)}</span>` : ""}
      </td>
      <td class="col-qty">${item.qty}</td>
      <td class="col-price">${formatInvoiceCurrency(item.unitPrice)}</td>
      <td class="col-total">${formatInvoiceCurrency(item.total)}</td>
    </tr>`).join("");

  const qrHtml = showQrCode && designer.qrCodeUrl
    ? `<div class="qr-box"><img src="${escapeHtml(designer.qrCodeUrl)}" alt="QR code" /><span>Scan QR</span></div>`
    : "";

  // Notes HTML
  const notesHtml = [
    designer.returnPolicyNote ? `<div class="note-item"><strong>Return Policy:</strong> ${escapeHtml(designer.returnPolicyNote)}</div>` : "",
    designer.warrantyNote ? `<div class="note-item"><strong>Warranty:</strong> ${escapeHtml(designer.warrantyNote)}</div>` : "",
    designer.supportNote ? `<div class="note-item"><strong>Support:</strong> ${escapeHtml(designer.supportNote)}</div>` : ""
  ].filter(Boolean).join("");

  // Signature / stamp
  const signatureHtml = designer.signatureUrl
    ? `<img src="${escapeHtml(designer.signatureUrl)}" alt="Authorised Signature" class="sig-img" />`
    : "";
  const stampHtml = designer.stampUrl
    ? `<img src="${escapeHtml(designer.stampUrl)}" alt="Company Stamp" class="stamp-img" />`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${escapeHtml(order.orderNumber)} — ${escapeHtml(store.storeName)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
      font-size: 13px;
      color: #111827;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body { padding: 24px 16px 40px; }

    .no-print { max-width: 820px; margin: 0 auto 12px; display: flex; justify-content: flex-end; }
    .print-btn { padding: 9px 22px; border-radius: 8px; border: none; background: #111827; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; }
    .print-btn:hover { background: #1f2937; }

    .invoice { max-width: 820px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 20px rgba(0,0,0,0.09); overflow: hidden; position: relative; }
    .invoice > *:not(.inv-watermark) { position: relative; z-index: 1; }
    .inv-watermark { position: absolute; z-index: 0; left: 50%; top: 42%; width: min(390px, 58%); max-height: 310px; object-fit: contain; transform: translate(-50%, -50%); opacity: 0.12; pointer-events: none; }

    /* 1. Header */
    .inv-header { padding: 28px 32px 24px; border-top: 4px solid #111827; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
    .inv-logo { max-height: 48px; max-width: 160px; object-fit: contain; display: block; margin-bottom: 10px; }
    .inv-store-name { font-size: 18px; font-weight: 800; color: #111827; letter-spacing: -0.02em; }
    .inv-store-line { font-size: 12px; color: #6b7280; line-height: 1.65; margin-top: 3px; }
    .inv-store-gst { font-size: 11px; font-weight: 700; color: #374151; margin-top: 5px; }
    .inv-header-tag { text-align: right; flex-shrink: 0; }
    .inv-title { font-size: 30px; font-weight: 900; letter-spacing: -0.04em; color: #111827; text-transform: uppercase; }
    .inv-number { font-size: 13px; font-weight: 700; color: #16a34a; margin-top: 6px; font-family: "Courier New", monospace; }
    .inv-meta-list { margin-top: 10px; display: grid; gap: 3px; }
    .inv-meta-row { display: flex; justify-content: flex-end; align-items: center; gap: 8px; font-size: 12px; }
    .inv-meta-label { color: #9ca3af; }
    .inv-meta-val { font-weight: 600; color: #374151; }
    .p-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .p-paid, .p-authorized { background: #dcfce7; color: #15803d; }
    .p-cod_pending { background: #dbeafe; color: #1d4ed8; }
    .p-failed { background: #fee2e2; color: #b91c1c; }
    .p-refunded, .p-partially_refunded { background: #f3e8ff; color: #7e22ce; }
    .p-pending { background: #f1f5f9; color: #475569; }

    /* 2. Customer */
    .inv-customer { padding: 16px 32px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .address-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
    .inv-section-cap { font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #9ca3af; margin-bottom: 7px; }
    .inv-cust-name { font-size: 14px; font-weight: 700; color: #111827; }
    .inv-cust-line { font-size: 12px; color: #6b7280; line-height: 1.65; margin-top: 2px; }
    .inv-gst-box { margin-top: 10px; padding: 10px 12px; border: 1px solid #dbeafe; border-radius: 8px; background: #eff6ff; display: grid; gap: 3px; }
    .inv-gst-box strong { font-size: 12px; color: #1e3a8a; }
    .inv-gst-box span { font-size: 11px; color: #334155; font-weight: 700; }

    /* 3. Product table */
    .inv-table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 520px; }
    thead tr { background: #111827; border-bottom: 2px solid #111827; }
    th { padding: 10px 12px; text-align: left; font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #ffffff; white-space: nowrap; }
    td { padding: 12px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; font-size: 13px; }
    tbody tr:last-child td { border-bottom: none; }
    .col-img { width: 50px; padding: 8px 12px; }
    .item-img { width: 38px; height: 38px; object-fit: contain; border-radius: 6px; border: 1px solid #f3f4f6; background: #f9fafb; display: block; }
    .item-img-placeholder { width: 38px; height: 38px; border-radius: 6px; background: #f3f4f6; display: block; }
    .col-num { width: 28px; color: #9ca3af; font-size: 12px; text-align: center; }
    .item-name { font-weight: 600; color: #111827; display: block; line-height: 1.3; }
    .item-sku { font-size: 11px; color: #9ca3af; display: block; margin-top: 2px; font-family: "Courier New", monospace; }
    .col-qty { width: 36px; text-align: center; color: #6b7280; font-weight: 600; }
    .col-price { width: 84px; text-align: right; color: #6b7280; }
    .col-disc { width: 84px; text-align: right; }
    .disc-val { color: #16a34a; font-weight: 600; }
    .col-tax { width: 72px; text-align: right; color: #6b7280; }
    .col-total { width: 90px; text-align: right; font-weight: 700; color: #111827; }
    .muted { color: #d1d5db; }

    /* 4. Payment Summary */
    .inv-summary { padding: 16px 32px 22px; background: #f9fafb; border-top: 1px solid #e5e7eb; }
    .summary-inner { max-width: 260px; margin-left: auto; }
    .sum-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 13px; }
    .sum-lbl { color: #6b7280; }
    .sum-val { font-weight: 600; color: #374151; }
    .sum-disc .sum-lbl, .sum-disc .sum-val { color: #16a34a; }
    .sum-grand { margin-top: 10px; padding-top: 10px; border-top: 2px solid #111827; }
    .sum-grand .sum-lbl { font-size: 15px; font-weight: 800; color: #111827; }
    .sum-grand .sum-val { font-size: 20px; font-weight: 800; color: #16a34a; }

    /* 5. Footer area */
    .inv-footer-area { border-top: 1px solid #e5e7eb; }
    .inv-notes-block { padding: 14px 32px; display: grid; gap: 6px; border-bottom: 1px solid #f3f4f6; }
    .note-item { font-size: 11px; color: #6b7280; line-height: 1.6; }
    .note-item strong { color: #374151; }
    .inv-auth-row { display: flex; justify-content: flex-end; align-items: flex-end; gap: 24px; padding: 14px 32px; border-bottom: 1px solid #f3f4f6; }
    .auth-block { display: flex; flex-direction: column; align-items: center; gap: 5px; }
    .sig-img { max-height: 48px; max-width: 160px; object-fit: contain; display: block; }
    .stamp-img { max-height: 60px; max-width: 60px; object-fit: contain; display: block; }
    .auth-label { font-size: 9px; font-weight: 700; color: #9ca3af; letter-spacing: 0.1em; text-transform: uppercase; padding-top: 4px; border-top: 1px solid #e5e7eb; width: 100%; text-align: center; }
    .inv-footer-bar { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding: 14px 32px; background: #f9fafb; font-size: 11px; color: #6b7280; }
    .footer-lines { display: grid; gap: 4px; }
    .footer-ty { font-weight: 700; color: #374151; }
    .footer-note { color: #6b7280; }
    .qr-box { width: 74px; flex: 0 0 74px; display: grid; gap: 4px; justify-items: center; color: #6b7280; font-size: 9px; font-weight: 700; text-transform: uppercase; }
    .qr-box img { width: 64px; height: 64px; object-fit: contain; border: 1px solid #e5e7eb; background: #fff; }

    @media print {
      body { background: #fff !important; padding: 0 !important; }
      .no-print { display: none !important; }
      .invoice { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="print-btn" onclick="window.print()">Save as PDF / Print</button>
  </div>

  <div class="invoice">
    ${watermarkHtml}

    <!-- 1. Logo + Business Info -->
    <div class="inv-header">
      <div>
        ${logoHtml}
        <div class="inv-store-name">${escapeHtml(bizName)}</div>
        ${headerText ? `<div class="inv-store-line">${escapeHtml(headerText)}</div>` : ""}
        ${bizAddress ? `<div class="inv-store-line">${escapeHtml(bizAddress)}</div>` : ""}
        ${designer.showSupportDetails !== false && bizPhone ? `<div class="inv-store-line">${escapeHtml(bizPhone)}</div>` : ""}
        ${designer.showSupportDetails !== false && bizEmail ? `<div class="inv-store-line">${escapeHtml(bizEmail)}</div>` : ""}
        ${bizGst ? `<div class="inv-store-gst">GSTIN: ${escapeHtml(bizGst)}</div>` : ""}
      </div>
      <div class="inv-header-tag">
        <div class="inv-title">Invoice</div>
        <div class="inv-number">${escapeHtml(order.orderNumber)}</div>
        <div class="inv-meta-list">
          <div class="inv-meta-row">
            <span class="inv-meta-label">Invoice No.</span>
            <span class="inv-meta-val">${escapeHtml(order.orderNumber)}</span>
          </div>
          <div class="inv-meta-row">
            <span class="inv-meta-label">Order No.</span>
            <span class="inv-meta-val">${escapeHtml(order.orderNumber)}</span>
          </div>
          <div class="inv-meta-row">
            <span class="inv-meta-label">Date</span>
            <span class="inv-meta-val">${orderDate}</span>
          </div>
          <div class="inv-meta-row">
            <span class="inv-meta-label">Payment</span>
            <span class="inv-meta-val">${escapeHtml(paymentLabel)}</span>
          </div>
          <div class="inv-meta-row">
            <span class="inv-meta-label">Status</span>
            <span class="inv-meta-val"><span class="p-badge p-${escapeHtml(paymentStatusKey)}">${escapeHtml(paymentStatusLabel)}</span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. Customer Details -->
    <div class="inv-customer">
      <div class="address-card">
      <div class="inv-section-cap">Bill To</div>
      <div class="inv-cust-name">${escapeHtml(billingAddress.fullName || "Customer")}</div>
      ${(address.email || address.phone) ? `<div class="inv-cust-line">${[address.email, address.phone].filter(Boolean).map(escapeHtml).join("  ·  ")}</div>` : ""}
      ${billingAddressParts.length ? `<div class="inv-cust-line">${escapeHtml(billingAddressParts.join(", "))}</div>` : ""}
      ${customerGstNumber ? `<div class="inv-cust-line"><strong>GSTIN:</strong> ${escapeHtml(customerGstNumber)}</div><div class="inv-cust-line"><strong>Business Name:</strong> ${escapeHtml(customerBusinessName || billingAddress.fullName || "Business Customer")}</div>` : ""}
      </div>
      <div class="address-card">
        <div class="inv-section-cap">Ship To</div>
        <div class="inv-cust-name">${escapeHtml(shippingAddress.fullName || "Customer")}</div>
        ${shippingAddressParts.length ? `<div class="inv-cust-line">${escapeHtml(shippingAddressParts.join(", "))}</div>` : ""}
        ${(shippingAddress.email || shippingAddress.phone) ? `<div class="inv-cust-line">${[shippingAddress.email, shippingAddress.phone].filter(Boolean).map(escapeHtml).join(" | ")}</div>` : ""}
      </div>
    </div>

    <!-- 3. Product Table -->
    <div class="inv-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Product Description</th>
            <th style="text-align:center">Qty</th>
            <th style="text-align:right">Unit Price</th>
            <th style="text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRowsHtml}</tbody>
      </table>
    </div>

    <!-- 4. Payment Summary -->
    <div class="inv-summary">
      <div class="summary-inner">
        <div class="sum-row">
          <span class="sum-lbl">Subtotal</span>
          <span class="sum-val">${formatInvoiceCurrency(order.subtotal)}</span>
        </div>
        ${taxTotal > 0 ? `
        <div class="sum-row">
          <span class="sum-lbl">GST</span>
          <span class="sum-val">${formatInvoiceCurrency(taxTotal)}</span>
        </div>` : ""}
        ${couponDiscount > 0 ? `
        <div class="sum-row sum-disc">
          <span class="sum-lbl">${order.couponCode ? `Coupon (${escapeHtml(order.couponCode)})` : "Coupon Discount"}</span>
          <span class="sum-val">−${formatInvoiceCurrency(couponDiscount)}</span>
        </div>` : ""}
        ${creditDiscount > 0 ? `
        <div class="sum-row sum-disc">
          <span class="sum-lbl">Credit Points</span>
          <span class="sum-val">−${formatInvoiceCurrency(creditDiscount)}</span>
        </div>` : ""}
        <div class="sum-row">
          <span class="sum-lbl">Shipping</span>
          <span class="sum-val">${Number(order.shippingFee) > 0 ? formatInvoiceCurrency(order.shippingFee) : "Free"}</span>
        </div>
        <div class="sum-row sum-grand">
          <span class="sum-lbl">Total Amount</span>
          <span class="sum-val">${formatInvoiceCurrency(order.totalAmount)}</span>
        </div>
      </div>
    </div>

    <!-- 5. Footer Note -->
    <div class="inv-footer-area">
      ${notesHtml ? `<div class="inv-notes-block">${notesHtml}</div>` : ""}
      ${signatureHtml || stampHtml ? `
      <div class="inv-auth-row">
        ${stampHtml ? `<div class="auth-block">${stampHtml}<span class="auth-label">Company Seal</span></div>` : ""}
        ${signatureHtml ? `<div class="auth-block">${signatureHtml}<span class="auth-label">Authorised Signatory</span></div>` : ""}
      </div>` : ""}
      <div class="inv-footer-bar">
        <div class="footer-lines">
          <span class="footer-ty">${escapeHtml(thankYouNote)}</span>
          ${designer.showFooterNote !== false && footerText ? `<span class="footer-note">${escapeHtml(footerText)}</span>` : ""}
          ${supportContactNote ? `<span class="footer-note">${escapeHtml(supportContactNote)}</span>` : ""}
          ${websiteUrl ? `<span class="footer-note">${escapeHtml(websiteUrl)}</span>` : ""}
          ${bottomNoteText ? `<span class="footer-note">${escapeHtml(bottomNoteText)}</span>` : ""}
        </div>
        ${qrHtml}
      </div>
    </div>

  </div>
  ${noPrint ? "" : '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},700);});</script>'}
</body>
</html>`;
}

function formatPdfCurrency(value) {
  return `INR ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0
  }).format(Number(value || 0))}`;
}

function resolveLocalInvoiceAsset(url) {
  const value = String(url || "").trim();
  if (!value.startsWith("/uploads/")) return "";
  const uploadRoot = path.resolve(process.cwd(), "uploads");
  const assetPath = path.resolve(uploadRoot, value.replace(/^\/uploads\//, ""));
  if (!assetPath.startsWith(uploadRoot)) return "";
  return fs.existsSync(assetPath) ? assetPath : "";
}

function drawPdfKeyValue(doc, label, value, x, y, width = 240) {
  if (!value) return y;
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#6b7280").text(label, x, y, { width });
  doc.font("Helvetica").fontSize(10).fillColor("#111827").text(String(value), x, y + 12, { width });
  return y + 34;
}

function addPdfPageIfNeeded(doc, y, required = 80) {
  if (y + required <= doc.page.height - doc.page.margins.bottom) return y;
  doc.addPage();
  return doc.page.margins.top;
}

function drawInvoiceWatermark(doc, imagePath, left, top, width, height) {
  if (!imagePath) return;
  try {
    const maxWidth = Math.min(330, width * 0.68);
    const maxHeight = Math.min(260, height * 0.62);
    doc.save();
    doc.opacity(0.12);
    doc.image(imagePath, left + (width - maxWidth) / 2, top + (height - maxHeight) / 2, {
      fit: [maxWidth, maxHeight],
      align: "center",
      valign: "center"
    });
    doc.restore();
  } catch {
    doc.restore?.();
  }
}

function sendInvoicePdf(response, order, items, store, address, designer = {}, filenamePrefix = "invoice") {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const filename = `${filenamePrefix}-${String(order.orderNumber || "sample").replace(/[^a-z0-9-]/gi, "-")}.pdf`;

  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  response.setHeader("X-Content-Type-Options", "nosniff");
  doc.pipe(response);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const bizName = designer.businessName || store.businessLegalName || store.storeName;
  const bizAddress = designer.address || store.businessAddress;
  const bizEmail = designer.supportEmail || store.supportEmail;
  const bizPhone = designer.supportPhone || store.supportPhone;
  const bizGst = designer.showGst !== false ? (designer.gstNumber || store.gstNumber) : "";
  const logoPath = designer.showLogo !== false ? resolveLocalInvoiceAsset(designer.logoUrl || store.logoUrl) : "";
  const qrPath = designer.showQrCode !== false ? resolveLocalInvoiceAsset(designer.qrCodeUrl) : "";
  const watermarkPath = designer.showWatermark !== false ? resolveLocalInvoiceAsset(designer.watermarkUrl || designer.logoUrl || store.logoUrl) : "";
  const websiteUrl = String(designer.websiteUrl || "").trim();
  const footerThankYouNote = designer.footerThankYouNote || designer.thankYouNote || "Thank you for shopping with us!";
  const computerGeneratedNote = designer.computerGeneratedNote || designer.footerText || "Computer-generated invoice. No signature required.";
  const supportContactNote = designer.supportContactNote || designer.supportNote || [bizPhone, bizEmail].filter(Boolean).join(" | ");
  const bottomNoteText = String(designer.bottomNoteText || "").trim();
  const paymentLabel = INVOICE_PAYMENT_LABELS[String(order.paymentMethod || "").toLowerCase()] || capitalize(order.paymentMethod) || "Online Payment";
  const paymentStatusLabel = INVOICE_PAYMENT_STATUS_LABELS[String(order.paymentStatus || "").toLowerCase()] || capitalize(order.paymentStatus || "Pending");
  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "";
  const billingAddress = address.billingAddress || address;
  const shippingAddress = address.shippingAddress || address;
  const billingAddressParts = [
    billingAddress.line1,
    billingAddress.line2,
    billingAddress.landmark,
    [billingAddress.city, billingAddress.state].filter(Boolean).join(", "),
    billingAddress.pincode,
    billingAddress.country !== "India" ? billingAddress.country : ""
  ].filter(Boolean);
  const shippingAddressParts = [
    shippingAddress.line1,
    shippingAddress.line2,
    shippingAddress.landmark,
    [shippingAddress.city, shippingAddress.state].filter(Boolean).join(", "),
    shippingAddress.pincode,
    shippingAddress.country !== "India" ? shippingAddress.country : ""
  ].filter(Boolean);
  const customerBusinessName = String(address.businessName || "").trim();
  const customerGstNumber = String(address.gstNumber || "").trim().toUpperCase();
  const showSkuAsin = designer.showSkuAsin !== false;
  const showTaxCol = designer.showTax !== false;
  const globalTaxInclusive = store.taxInclusion !== "exclusive";
  const itemsCalc = items.map((item) => {
    const qty = Number(item.quantity || 1);
    const unitPrice = Number(item.unitPrice || 0);
    const total = Number(item.totalPrice || unitPrice * qty);
    const taxRate = Number(item.taxRate || 0);
    const taxIncluded = item.taxIncluded != null ? Number(item.taxIncluded) !== 0 : globalTaxInclusive;
    const taxAmount = taxRate > 0
      ? Math.round((unitPrice * qty * taxRate) / (taxIncluded ? 100 + taxRate : 100))
      : 0;
    const skuAsin = showSkuAsin ? [item.sku, item.asin].filter(Boolean).join(" / ") : "";
    return { ...item, qty, unitPrice, total, taxAmount, skuAsin };
  });
  const hasTax = showTaxCol && itemsCalc.some((item) => item.taxAmount > 0);
  const taxTotal = showTaxCol ? itemsCalc.reduce((sum, item) => sum + Number(item.taxAmount || 0), 0) : 0;
  const couponDiscount = Number(order.couponDiscount || 0);
  const creditDiscount = designer.showCreditPoints !== false ? Number(order.creditDiscount || 0) : 0;

  doc.fillColor("#111827");
  if (logoPath) {
    try {
      doc.image(logoPath, left, 28, { fit: [150, 46] });
    } catch {
      doc.font("Helvetica-Bold").fontSize(20).text(store.storeName || "Avyona", left, 34);
    }
  } else {
    doc.font("Helvetica-Bold").fontSize(20).text(store.storeName || "Avyona", left, 34);
  }

  doc.font("Helvetica-Bold").fontSize(24).fillColor("#050505").text("INVOICE", right - 170, 26, { width: 170, align: "right" });

  let y = 90;
  doc.font("Helvetica-Bold").fontSize(21).fillColor("#050505").text(bizName || store.storeName || "Avyona", left, y, { width: 330 });
  y = doc.y + 12;
  if (designer.headerText) {
    doc.font("Helvetica").fontSize(9).fillColor("#4b5563").text(designer.headerText, left, y, { width: 260 });
    y += 13;
  }
  if (bizAddress) {
    doc.font("Helvetica").fontSize(9).fillColor("#4b5563").text(bizAddress, left, y, { width: 260 });
    y = doc.y + 4;
  }
  if (designer.showSupportDetails !== false && (bizPhone || bizEmail)) {
    doc.font("Helvetica").fontSize(9).fillColor("#4b5563").text([bizPhone, bizEmail].filter(Boolean).join(" | "), left, y, { width: 260 });
    y = doc.y + 4;
  }
  if (bizGst) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#374151").text(`GSTIN: ${bizGst}`, left, y);
    y = doc.y + 2;
  }

  let metaY = 62;
  const compactMeta = (label, value) => {
    if (!value) return;
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#6b7280").text(`${label}:`, right - 180, metaY, { width: 78, align: "right" });
    doc.font("Helvetica").fontSize(8.5).fillColor("#4b5563").text(String(value), right - 98, metaY, { width: 98, align: "left" });
    metaY += 13;
  };
  compactMeta("Invoice #", order.orderNumber || "");
  compactMeta("Order #", order.orderNumber || "");
  compactMeta("Date", orderDate);
  compactMeta("Payment", paymentLabel);

  y = Math.max(y + 14, 184, metaY + 22);
  doc.moveTo(left, y).lineTo(right, y).lineWidth(2).strokeColor("#050505").stroke();
  doc.lineWidth(1);
  y += 12;
  const shippingContactLine = [shippingAddress.email, shippingAddress.phone].filter(Boolean).join(" | ");
  const cardGap = 16;
  const cardWidth = (pageWidth - cardGap) / 2;
  const cardHeight = customerGstNumber ? 128 : 104;
  const shipX = left + cardWidth + cardGap;
  doc.roundedRect(left, y, cardWidth, cardHeight, 4).fillAndStroke("#f7f7f7", "#f1f5f9");
  doc.roundedRect(shipX, y, cardWidth, cardHeight, 4).fillAndStroke("#f7f7f7", "#f1f5f9");
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#111827").text("BILL TO", left + 12, y + 12, { width: cardWidth - 24 });
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#111827").text("SHIP TO", shipX + 12, y + 12, { width: cardWidth - 24 });
  doc.moveTo(left + 12, y + 29).lineTo(left + cardWidth - 12, y + 29).strokeColor("#d9d9d9").stroke();
  doc.moveTo(shipX + 12, y + 29).lineTo(shipX + cardWidth - 12, y + 29).strokeColor("#d9d9d9").stroke();
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text(billingAddress.fullName || "Customer", left + 12, y + 30, { width: cardWidth - 24 });
  doc.font("Helvetica").fontSize(8.5).fillColor("#4b5563");
  let billY = y + 45;
  if (billingAddressParts.length) {
    doc.text(billingAddressParts.join(", "), left + 12, billY, { width: cardWidth - 24, height: 28 });
    billY = y + 76;
  }
  if (billingAddress.email) {
    doc.text(String(billingAddress.email), left + 12, billY, { width: cardWidth - 24 });
    billY += 12;
  }
  if (billingAddress.phone) {
    doc.text(String(billingAddress.phone), left + 12, billY, { width: cardWidth - 24 });
    billY += 12;
  }
  if (customerGstNumber) {
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#111827").text(`GSTIN: ${customerGstNumber}`, left + 12, billY, { width: cardWidth - 24 });
    doc.text(`Business Name: ${customerBusinessName || billingAddress.fullName || "Business Customer"}`, left + 12, billY + 12, { width: cardWidth - 24 });
  }
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text(shippingAddress.fullName || "Customer", shipX + 12, y + 30, { width: cardWidth - 24 });
  doc.font("Helvetica").fontSize(8.5).fillColor("#4b5563").text(shippingAddressParts.join(", ") || "Shipping address not available", shipX + 12, y + 47, { width: cardWidth - 24, height: 44 });
  if (shippingContactLine) doc.text(shippingContactLine, shipX + 12, y + 94, { width: cardWidth - 24 });
  y += cardHeight + 24;

  y = addPdfPageIfNeeded(doc, y, 110);
  const watermarkTop = y - 112;
  drawInvoiceWatermark(doc, watermarkPath, left, watermarkTop, pageWidth, 300);
  doc.rect(left, y, pageWidth, 26).fill("#111827");
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
  doc.text("#", left + 12, y + 9, { width: 28 });
  doc.text("PRODUCT DESCRIPTION", left + 48, y + 9, { width: pageWidth - 300 });
  doc.text("QTY", right - 230, y + 9, { width: 40, align: "right" });
  doc.text("UNIT PRICE", right - 178, y + 9, { width: 78, align: "right" });
  doc.text("AMOUNT", right - 88, y + 9, { width: 88, align: "right" });
  y += 32;

  itemsCalc.forEach((item, index) => {
    y = addPdfPageIfNeeded(doc, y, 60);
    const productWidth = pageWidth - 300;
    const rowStart = y;
    doc.font("Helvetica").fontSize(8.5).fillColor("#374151").text(String(index + 1), left + 12, rowStart, { width: 28 });
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#111827").text(item.name || "Product", left + 48, y, { width: productWidth });
    let itemTextBottom = doc.y;
    if (item.skuAsin) {
      doc.font("Helvetica").fontSize(8).fillColor("#6b7280").text(`(${item.skuAsin})`, left + 48, itemTextBottom + 3, { width: productWidth });
      itemTextBottom = doc.y;
    }
    doc.font("Helvetica").fontSize(9).fillColor("#374151");
    doc.text(String(item.qty), right - 230, rowStart, { width: 40, align: "right" });
    doc.text(formatPdfCurrency(item.unitPrice), right - 178, rowStart, { width: 78, align: "right" });
    doc.font("Helvetica-Bold").text(formatPdfCurrency(item.total), right - 88, rowStart, { width: 88, align: "right" });
    y = Math.max(itemTextBottom, rowStart + 18) + 12;
    doc.moveTo(left, y - 4).lineTo(right, y - 4).strokeColor("#f3f4f6").stroke();
  });

  y = addPdfPageIfNeeded(doc, y + 8, 120);
  const summaryX = right - 240;
  const summaryRow = (label, value, bold = false, tone = "#374151") => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 12 : 10).fillColor(bold ? "#111827" : "#6b7280").text(label, summaryX, y, { width: 120 });
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 12 : 10).fillColor(tone).text(value, right - 100, y, { width: 100, align: "right" });
    y += bold ? 22 : 18;
  };
  summaryRow("Subtotal", formatPdfCurrency(order.subtotal));
  if (taxTotal > 0) summaryRow("GST", formatPdfCurrency(taxTotal));
  if (couponDiscount > 0) summaryRow(order.couponCode ? `Coupon (${order.couponCode})` : "Coupon Discount", `-${formatPdfCurrency(couponDiscount)}`, false, "#16a34a");
  if (creditDiscount > 0) summaryRow("Credit Points", `-${formatPdfCurrency(creditDiscount)}`, false, "#16a34a");
  summaryRow("Shipping", Number(order.shippingFee) > 0 ? formatPdfCurrency(order.shippingFee) : "Free");
  doc.moveTo(summaryX, y).lineTo(right, y).strokeColor("#111827").stroke();
  y += 10;
  summaryRow("Total Amount", formatPdfCurrency(order.totalAmount), true, "#111827");

  y = addPdfPageIfNeeded(doc, y + 10, 86);
  const notes = [
    designer.returnPolicyNote ? `Return Policy: ${designer.returnPolicyNote}` : "",
    designer.warrantyNote ? `Warranty: ${designer.warrantyNote}` : "",
    designer.supportNote ? `Support: ${designer.supportNote}` : ""
  ].filter(Boolean);
  if (notes.length) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text("Notes", left, y);
    y += 16;
    notes.forEach((note) => {
      doc.font("Helvetica").fontSize(9).fillColor("#4b5563").text(note, left, y, { width: pageWidth });
      y = doc.y + 6;
    });
  }

  const signaturePath = resolveLocalInvoiceAsset(designer.signatureUrl);
  const stampPath = resolveLocalInvoiceAsset(designer.stampUrl);
  if (signaturePath || stampPath) {
    y = addPdfPageIfNeeded(doc, y + 8, 80);
    if (stampPath) {
      try {
        doc.image(stampPath, right - 230, y, { fit: [58, 58] });
        doc.font("Helvetica").fontSize(8).fillColor("#6b7280").text("Company Seal", right - 235, y + 62, { width: 70, align: "center" });
      } catch {}
    }
    if (signaturePath) {
      try {
        doc.image(signaturePath, right - 150, y, { fit: [130, 48] });
      } catch {}
      doc.font("Helvetica").fontSize(8).fillColor("#6b7280").text("Authorised Signatory", right - 150, y + 62, { width: 130, align: "center" });
    }
    y += 86;
  }

  y = addPdfPageIfNeeded(doc, y + 4, 76);
  doc.moveTo(left, y).lineTo(right, y).strokeColor("#e5e7eb").stroke();
  y += 14;
  const footerLeftWidth = qrPath ? pageWidth - 96 : pageWidth;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#111827").text(footerThankYouNote, left, y, { width: footerLeftWidth });
  let footerTextY = doc.y + 6;
  if (designer.showFooterNote !== false && computerGeneratedNote) {
    doc.font("Helvetica").fontSize(8).fillColor("#4b5563").text(computerGeneratedNote, left, footerTextY, { width: footerLeftWidth });
    footerTextY = doc.y + 4;
  }
  if (supportContactNote) {
    doc.font("Helvetica").fontSize(8).fillColor("#4b5563").text(supportContactNote, left, footerTextY, { width: footerLeftWidth });
    footerTextY = doc.y + 4;
  }
  if (websiteUrl) {
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#111827").text(websiteUrl, left, footerTextY, { width: footerLeftWidth });
    footerTextY = doc.y + 4;
  }
  if (bottomNoteText) {
    doc.font("Helvetica").fontSize(8).fillColor("#6b7280").text(bottomNoteText, left, footerTextY, { width: footerLeftWidth });
  }
  if (qrPath) {
    try {
      doc.image(qrPath, right - 72, y, { fit: [64, 64] });
      doc.font("Helvetica").fontSize(7).fillColor("#6b7280").text("Scan QR", right - 72, y + 66, { width: 64, align: "center" });
    } catch {}
  } else if (designer.showQrCode !== false && designer.qrCodeUrl) {
    doc.roundedRect(right - 72, y, 64, 64, 4).strokeColor("#d1d5db").stroke();
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#111827").text("QR", right - 72, y + 22, { width: 64, align: "center" });
    doc.font("Helvetica").fontSize(5.5).fillColor("#6b7280").text(String(designer.qrCodeUrl), right - 68, y + 34, { width: 56, align: "center" });
  }

  doc.end();
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

export async function listOrders(_request, response) {
  const rows = await query(
    `SELECT
      o.id,
      o.customer_id AS customerId,
      c.full_name AS customerName,
      c.email AS customerEmail,
      c.phone AS customerPhone,
      o.order_number AS orderNumber,
      o.status,
      o.payment_status AS paymentStatus,
      o.payment_method AS paymentMethod,
      o.payment_gateway AS paymentGateway,
      o.razorpay_order_id AS razorpayOrderId,
      o.razorpay_payment_id AS razorpayPaymentId,
      o.payment_signature AS paymentSignature,
      o.paid_at AS paidAt,
      o.payment_error AS paymentError,
      o.subtotal,
      o.shipping_fee AS shippingFee,
      o.total_amount AS totalAmount,
      (
        SELECT COUNT(*)
        FROM order_items item
        WHERE item.order_id = o.id
      ) AS itemCount,
      o.created_at AS createdAt,
      o.updated_at AS updatedAt
     FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     ORDER BY o.created_at DESC`
  );

  response.json({
    success: true,
    count: rows.length,
    data: rows
  });
}

export async function getAdminOrderDetails(request, response) {
  const orderId = Number(request.params.id);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new ApiError(400, "Invalid order ID");
  }

  const orderRows = await query(
    `SELECT
      o.id,
      o.customer_id AS customerId,
      c.full_name AS customerName,
      c.email AS customerEmail,
      c.phone AS customerPhone,
      o.order_number AS orderNumber,
      o.status,
      o.payment_status AS paymentStatus,
      o.payment_method AS paymentMethod,
      o.payment_gateway AS paymentGateway,
      o.razorpay_order_id AS razorpayOrderId,
      o.razorpay_payment_id AS razorpayPaymentId,
      o.paid_at AS paidAt,
      o.payment_error AS paymentError,
      o.courier_name AS courierName,
      o.expected_delivery_date AS expectedDeliveryDate,
      o.subtotal,
      o.shipping_fee AS shippingFee,
      o.total_amount AS totalAmount,
      o.coupon_discount AS couponDiscount,
      o.credit_discount AS creditDiscount,
      o.created_at AS createdAt,
      o.updated_at AS updatedAt
     FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE o.id = ?
     LIMIT 1`,
    [orderId]
  );
  const order = orderRows[0];

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const [items, addresses, timeline] = await Promise.all([
    query(
      `SELECT
        oi.id,
        oi.product_id AS productId,
        oi.product_name AS name,
        oi.quantity,
        oi.unit_price AS unitPrice,
        oi.total_price AS lineTotal,
        p.slug,
        p.sku,
        p.image_url AS image,
        c.name AS category
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE oi.order_id = ?
       ORDER BY oi.id ASC`,
      [orderId]
    ),
    query(
      `SELECT address_type AS addressType, full_name AS fullName, email, phone,
              line1, line2, landmark, city, state, pincode AS postalCode, country
       FROM order_addresses
       WHERE order_id = ?`,
      [orderId]
    ),
    query(
      `SELECT id, status, title, note, event_time AS dateTime
       FROM order_status_timeline
       WHERE order_id = ?
       ORDER BY event_time DESC, id DESC`,
      [orderId]
    )
  ]);

  const shippingAddress = addresses.find((address) => address.addressType === "delivery") || {};
  const billingAddress = addresses.find((address) => address.addressType === "billing") || shippingAddress;
  const discountTotal = Number(order.couponDiscount || 0) + Number(order.creditDiscount || 0);

  response.json({
    success: true,
    data: {
      id: order.id,
      orderNumber: order.orderNumber,
      placedAt: order.createdAt,
      updatedAt: order.updatedAt,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      courierName: order.courierName || "",
      expectedDeliveryDate: order.expectedDeliveryDate,
      customer: {
        id: order.customerId || "Guest",
        fullName: order.customerName || shippingAddress.fullName || "Guest Customer",
        email: order.customerEmail || shippingAddress.email || "",
        phone: order.customerPhone || shippingAddress.phone || ""
      },
      shippingAddress,
      billingAddress,
      products: items.map((item) => ({
        ...item,
        sku: item.sku || "Not available",
        image: item.image || "",
        category: item.category || "",
        variantLabel: "",
        unitPrice: Number(item.unitPrice || 0),
        lineTotal: Number(item.lineTotal || 0)
      })),
      pricing: {
        subtotal: Number(order.subtotal || 0),
        shippingFee: Number(order.shippingFee || 0),
        discountTotal,
        taxTotal: 0,
        grandTotal: Number(order.totalAmount || 0),
        currency: "INR"
      },
      payment: {
        method: order.paymentMethod || "Not selected",
        gateway: order.paymentGateway || "",
        razorpayOrderId: order.razorpayOrderId || "",
        razorpayPaymentId: order.razorpayPaymentId || "",
        paidAt: order.paidAt,
        paymentError: order.paymentError || "",
        refundStatus: order.paymentStatus === "refunded"
          ? "refunded"
          : order.paymentStatus === "partially_refunded"
            ? "partially_refunded"
            : "not_refunded"
      },
      notes: {
        customerNote: "",
        adminRemark: ""
      },
      timeline
    }
  });
}

function normalizePaymentStatus(paymentMethod) {
  const method = String(paymentMethod || "").toLowerCase();
  if (method === "cod") return "cod_pending";
  if (["test_success", "test-payment-success", "test_payment_success"].includes(method)) return "paid";
  if (["test_failure", "test-payment-failure", "test_payment_failure"].includes(method)) return "failed";
  return "pending";
}

function shouldReduceStock(paymentStatus) {
  return ["paid", "authorized", "cod_pending"].includes(paymentStatus);
}

function createOrderNumber() {
  return `AVY-${Date.now().toString().slice(-8)}`;
}

function calculateCouponDiscount(coupon, subtotal) {
  if (!coupon) return 0;
  const minimumOrderAmount = Number(coupon.minimumOrderAmount || 0);
  if (subtotal < minimumOrderAmount) {
    throw new ApiError(400, `Coupon requires a minimum cart value of ${minimumOrderAmount}`);
  }

  const rawDiscount = coupon.discountType === "fixed"
    ? Number(coupon.discountValue || 0)
    : subtotal * (Number(coupon.discountValue || 0) / 100);
  const cappedDiscount = coupon.maximumDiscountAmount
    ? Math.min(rawDiscount, Number(coupon.maximumDiscountAmount || 0))
    : rawDiscount;

  return Math.max(0, Math.min(subtotal, Math.round(cappedDiscount)));
}

async function calculateCreditRedemption(connection, customerId, requestedPoints, subtotalAfterCoupon) {
  const pts = Math.floor(Number(requestedPoints || 0));
  if (!pts) return { pointsApplied: 0, discountRupees: 0, pointsPerRupee: 10 };
  if (!customerId) throw new ApiError(401, "Login is required to redeem credit points");

  const [settingsRows] = await connection.execute("SELECT * FROM credit_settings LIMIT 1");
  const settings = settingsRows[0] || {
    points_per_rupee: 10,
    min_redeem_points: 100,
    max_redeem_percent: 20
  };

  await connection.execute(
    "INSERT IGNORE INTO customer_credit_wallets (customer_id) VALUES (?)",
    [customerId]
  );

  const [walletRows] = await connection.execute(
    "SELECT * FROM customer_credit_wallets WHERE customer_id = ? FOR UPDATE",
    [customerId]
  );
  const wallet = walletRows[0];
  const pointsPerRupee = Number(settings.points_per_rupee || 10);
  const availablePoints = Number(wallet?.available_points || 0);

  if (wallet?.is_blocked) throw new ApiError(403, "Your credit points wallet is blocked.");
  if (availablePoints < Number(settings.min_redeem_points || 100)) {
    throw new ApiError(400, `You need at least ${settings.min_redeem_points || 100} points to redeem.`);
  }
  if (pts > availablePoints) {
    throw new ApiError(400, `You only have ${availablePoints} points available.`);
  }

  const maxDiscountRupees = Math.floor(Number(subtotalAfterCoupon || 0) * (Number(settings.max_redeem_percent || 20) / 100));
  const maxPointsAllowed = maxDiscountRupees * pointsPerRupee;
  const pointsApplied = Math.min(pts, maxPointsAllowed, availablePoints);
  const discountRupees = Math.floor(pointsApplied / pointsPerRupee);

  if (pointsApplied <= 0 || discountRupees <= 0) {
    throw new ApiError(400, "Credit points cannot be applied to this order.");
  }

  return { pointsApplied, discountRupees, pointsPerRupee };
}

export async function createOrder(request, response) {
  const {
    customer = {},
    address = {},
    billingAddress = {},
    items = [],
    paymentMethod = "cod",
    couponCode = "",
    creditPoints = 0
  } = request.body || {};

  if (!Array.isArray(items) || !items.length) {
    throw new ApiError(400, "Order must include at least one item");
  }

  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || customer.fullName || "Guest Customer";
  const email = String(customer.email || customer.contact || "").trim() || null;
  const phone = String(customer.phone || "").trim() || null;
  const line1 = String(address.line1 || "").trim();
  const city = String(address.city || "").trim();
  const state = String(address.state || "").trim();
  const pincode = String(address.pincode || "").trim();
  const billingSameAsShipping = billingAddress.sameAsShipping !== false;

  if (!line1 || !city || !state || !pincode || !phone) {
    throw new ApiError(400, "Delivery address and phone are required");
  }
  if (!billingSameAsShipping) {
    const billingLine1 = String(billingAddress.line1 || "").trim();
    const billingCity = String(billingAddress.city || "").trim();
    const billingState = String(billingAddress.state || "").trim();
    const billingPincode = String(billingAddress.pincode || "").trim();
    const billingPhone = String(billingAddress.phone || "").trim();
    if (!billingLine1 || !billingCity || !billingState || !billingPincode || !billingPhone) {
      throw new ApiError(400, "Billing address and phone are required");
    }
  }

  await ensureOrderAddressTypeIndex();
  const shippingFee = 0;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let customerId = request.customer?.id || null;
    if (email) {
      const [existingCustomers] = await connection.execute(
        "SELECT id FROM customers WHERE id = ? OR email = ? LIMIT 1",
        [customerId || 0, email]
      );

      if (existingCustomers[0]) {
        customerId = existingCustomers[0].id;
        await connection.execute(
          `UPDATE customers
           SET full_name = ?, phone = COALESCE(?, phone), city = ?, state = ?
           WHERE id = ?`,
          [fullName, phone, city, state, customerId]
        );
      } else {
        const [customerResult] = await connection.execute(
          `INSERT INTO customers (full_name, email, phone, city, state, total_orders, total_spent)
           VALUES (?, ?, ?, ?, ?, 0, 0)`,
          [fullName, email, phone, city, state]
        );
        customerId = customerResult.insertId;
      }
    }

    const submittedBusiness = publicBusinessDetails({
      ...(customer.businessDetails || customer),
      businessName: billingAddress.businessName || customer.businessDetails?.businessName || customer.businessName,
      gstNumber: billingAddress.gstNumber || customer.businessDetails?.gstNumber || customer.gstNumber,
      isBusinessAccount: Boolean(
        billingAddress.businessName ||
        billingAddress.gstNumber ||
        customer.businessDetails?.isBusinessAccount ||
        customer.isBusinessAccount
      )
    });
    const savedBusiness = customerId ? await getCustomerBusinessDetails(customerId, connection) : publicBusinessDetails();
    const orderBusinessDetails = publicBusinessDetails({
      isBusinessAccount: submittedBusiness.isBusinessAccount || savedBusiness.isBusinessAccount,
      businessName: submittedBusiness.businessName || savedBusiness.businessName,
      gstNumber: submittedBusiness.gstNumber || savedBusiness.gstNumber
    });

    if (customerId && (submittedBusiness.isBusinessAccount || submittedBusiness.businessName || submittedBusiness.gstNumber)) {
      await saveCustomerBusinessDetails(customerId, submittedBusiness, connection);
    }

    const orderNumber = createOrderNumber();
    const paymentStatus = normalizePaymentStatus(paymentMethod);
    const paymentGateway = String(paymentMethod || "").toLowerCase() === "razorpay"
      ? "razorpay"
      : null;
    const reduceStock = shouldReduceStock(paymentStatus);
    const normalizedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const identifier = String(item.asin || item.slug || "").trim();
      if (!identifier) {
        throw new ApiError(400, "Each order item must include a product identifier");
      }

      const [productRows] = await connection.execute(
        `SELECT p.id, p.asin, p.slug, p.name, p.price, p.mrp, p.stock_quantity AS stockQuantity, p.status, p.is_visible AS isVisible, p.is_deleted AS isDeleted,
          c.name AS category, c.slug AS categorySlug
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.asin = ? OR p.slug = ?
         LIMIT 1
         FOR UPDATE`,
        [identifier, identifier]
      );
      const product = productRows[0];

      if (!product || product.isDeleted || !product.isVisible || product.status !== "active") {
        throw new ApiError(400, `Product ${identifier} is not available for checkout`);
      }

      const quantity = Math.max(1, Number(item.quantity || 1));
      const availableStock = Number(product.stockQuantity || 0);
      if (availableStock < quantity) {
        throw new ApiError(409, `${product.name} has only ${availableStock} unit(s) available`);
      }

      const unitPrice = Number(product.price || 0);
      const totalPrice = unitPrice * quantity;
      subtotal += totalPrice;
      normalizedItems.push({
        productId: product.id,
        name: product.name,
        category: product.category,
        categorySlug: product.categorySlug,
        quantity,
        unitPrice,
        totalPrice,
        mrp: Number(product.mrp || 0)
      });
    }

    let coupon = null;
    if (couponCode) {
      const [couponRows] = await connection.execute(
        `SELECT
          id,
          code,
          discount_type AS discountType,
          discount_value AS discountValue,
          minimum_order_amount AS minimumOrderAmount,
          maximum_discount_amount AS maximumDiscountAmount,
          usage_limit AS usageLimit,
          used_count AS usedCount,
          starts_at AS startsAt,
          ends_at AS endsAt,
          COALESCE(end_date, DATE(ends_at)) AS endDate,
          status,
          customer_eligibility AS customerEligibility,
          one_use_per_customer AS oneUsePerCustomer,
          stackable
         FROM coupons
         WHERE code = ?
           AND status = 'active'
           AND (starts_at IS NULL OR starts_at <= NOW())
           AND (COALESCE(end_date, DATE(ends_at)) IS NULL OR COALESCE(end_date, DATE(ends_at)) >= CURDATE())
           AND (usage_limit IS NULL OR used_count < usage_limit)
         LIMIT 1
         FOR UPDATE`,
        [String(couponCode).trim().toUpperCase()]
      );
      coupon = couponRows[0] || null;
      if (!coupon) {
        throw new ApiError(400, "Coupon is invalid, expired, paused, or fully used");
      }

      const [categoryRows] = await connection.execute(
        `SELECT c.name, c.slug
         FROM coupon_categories cc
         JOIN categories c ON c.id = cc.category_id
         WHERE cc.coupon_id = ?`,
        [coupon.id]
      );
      if (categoryRows.length) {
        const eligibleCategories = new Set(categoryRows.flatMap((row) => [row.name, row.slug].map((value) => String(value || "").toLowerCase())));
        const hasEligibleItem = normalizedItems.some((item) =>
          eligibleCategories.has(String(item.category || "").toLowerCase()) ||
          eligibleCategories.has(String(item.categorySlug || "").toLowerCase())
        );
        if (!hasEligibleItem) throw new ApiError(400, "This coupon is not valid for the products in your cart");
      }

      if (customerId) {
        const [customerCouponRows] = await connection.execute(
          `SELECT
            COUNT(*) AS orderCount,
            SUM(CASE WHEN coupon_code = ? THEN 1 ELSE 0 END) AS couponUseCount
           FROM orders
           WHERE customer_id = ?
             AND status NOT IN ('cancelled', 'failed')`,
          [coupon.code, customerId]
        );
        const stats = customerCouponRows[0] || {};
        if (coupon.customerEligibility === "new" && Number(stats.orderCount || 0) > 0) {
          throw new ApiError(400, "This coupon is valid only for new customers");
        }
        if (coupon.oneUsePerCustomer && Number(stats.couponUseCount || 0) > 0) {
          throw new ApiError(400, "This coupon has already been used by this customer");
        }
      } else if (coupon.customerEligibility === "returning" || coupon.oneUsePerCustomer) {
        throw new ApiError(401, "Login is required to use this coupon");
      }
      if (coupon.customerEligibility === "returning" && customerId) {
        const [returningRows] = await connection.execute(
          "SELECT COUNT(*) AS orderCount FROM orders WHERE customer_id = ? AND status NOT IN ('cancelled', 'failed')",
          [customerId]
        );
        if (Number(returningRows[0]?.orderCount || 0) <= 0) {
          throw new ApiError(400, "This coupon is valid only for returning customers");
        }
      }
      if (Number(creditPoints || 0) > 0 && !coupon.stackable) {
        throw new ApiError(400, "This coupon cannot be combined with other offers");
      }
    }

    const couponDiscount = calculateCouponDiscount(coupon, subtotal);
    const creditRedemption = await calculateCreditRedemption(connection, customerId, creditPoints, Math.max(0, subtotal - couponDiscount));
    const discount = couponDiscount + creditRedemption.discountRupees;
    const totalAmount = Math.max(0, subtotal - discount) + shippingFee;
    const [orderResult] = await connection.execute(
      `INSERT INTO orders
        (customer_id, order_number, status, payment_status, payment_method, payment_gateway,
         subtotal, shipping_fee, total_amount,
         coupon_code, coupon_discount, credit_discount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customerId, orderNumber, "pending", paymentStatus, paymentMethod, paymentGateway,
       subtotal, shippingFee, totalAmount,
       coupon ? String(couponCode).trim().toUpperCase() : null, couponDiscount, creditRedemption.discountRupees]
    );
    const orderId = orderResult.insertId;

    await saveOrderBusinessDetails(orderId, customerId, orderBusinessDetails, connection);

    const deliveryPayload = buildOrderAddressPayload(address, {
      firstName: customer.firstName,
      lastName: customer.lastName,
      fullName,
      email,
      phone,
      line1,
      city,
      state,
      pincode,
      country: "India"
    });
    const billingPayload = billingSameAsShipping
      ? deliveryPayload
      : buildOrderAddressPayload(billingAddress, {
          firstName: customer.firstName,
          lastName: customer.lastName,
          fullName,
          email,
          phone,
          country: "India"
        });

    await connection.execute(
      `INSERT INTO order_addresses
        (order_id, address_type, full_name, email, phone, line1, line2, landmark, city, state, pincode, country)
       VALUES (?, 'delivery', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'India')`,
      [
        orderId,
        deliveryPayload.fullName,
        deliveryPayload.email,
        deliveryPayload.phone,
        deliveryPayload.line1,
        deliveryPayload.line2,
        deliveryPayload.landmark,
        deliveryPayload.city,
        deliveryPayload.state,
        deliveryPayload.pincode
      ]
    );
    if (!billingSameAsShipping) {
      await connection.execute(
        `INSERT INTO order_addresses
          (order_id, address_type, full_name, email, phone, line1, line2, landmark, city, state, pincode, country)
         VALUES (?, 'billing', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          billingPayload.fullName,
          billingPayload.email || email,
          billingPayload.phone,
          billingPayload.line1,
          billingPayload.line2,
          billingPayload.landmark,
          billingPayload.city,
          billingPayload.state,
          billingPayload.pincode,
          billingPayload.country
        ]
      );
    }

    if (customerId) {
      const [addressRows] = await connection.execute(
        "SELECT id FROM customer_addresses WHERE customer_id = ? LIMIT 1",
        [customerId]
      );
      const makeDefault = addressRows.length ? 0 : 1;
      await connection.execute(
        `INSERT INTO customer_addresses
          (customer_id, address_type, full_name, phone, line1, line2, city, state, pincode, country, is_default)
         VALUES (?, 'Home', ?, ?, ?, ?, ?, ?, ?, 'India', ?)`,
        [
          customerId,
          fullName,
          phone,
          line1,
          address.line2 || null,
          city,
          state,
          pincode,
          makeDefault
        ]
      );
    }

    for (const item of normalizedItems) {
      await connection.execute(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price, product_mrp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.productId, item.name, item.quantity, item.unitPrice, item.totalPrice, item.mrp || null]
      );

      if (reduceStock) {
        const [stockResult] = await connection.execute(
          `UPDATE products
           SET stock_quantity = stock_quantity - ?, sold_quantity = sold_quantity + ?
           WHERE id = ? AND stock_quantity >= ?`,
          [item.quantity, item.quantity, item.productId, item.quantity]
        );
        if (!stockResult.affectedRows) {
          throw new ApiError(409, `${item.name} is no longer available in the requested quantity`);
        }
      }
    }

    if (reduceStock && coupon && couponDiscount > 0) {
      await connection.execute("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?", [coupon.id]);
    }

    if (creditRedemption.pointsApplied > 0) {
      await connection.execute(
        `UPDATE customer_credit_wallets
         SET available_points = available_points - ?,
             used_points = used_points + ?
         WHERE customer_id = ?`,
        [creditRedemption.pointsApplied, creditRedemption.pointsApplied, customerId]
      );
      await connection.execute(
        `INSERT INTO credit_transactions
           (customer_id, transaction_type, points, cashback_value, reference_id, reference_type, note, status)
         VALUES (?, 'redemption', ?, ?, ?, 'order', ?, 'used')`,
        [
          customerId,
          -creditRedemption.pointsApplied,
          creditRedemption.discountRupees,
          String(orderId),
          `Redeemed on order ${orderNumber}`
        ]
      );
    }

    await connection.execute(
      `INSERT INTO order_status_timeline (order_id, status, title, note, event_time)
       VALUES (?, 'pending', 'Order pending', ?, NOW())`,
      [
        orderId,
        [
          couponCode ? `Coupon ${couponCode} applied` : "",
          creditRedemption.pointsApplied > 0 ? `${creditRedemption.pointsApplied} credit points redeemed` : "",
          "Free shipping"
        ].filter(Boolean).join(". ")
      ]
    );

    if (customerId) {
      await connection.execute(
        `UPDATE customers
         SET total_orders = total_orders + 1, total_spent = total_spent + ?
         WHERE id = ?`,
        [totalAmount, customerId]
      );
    }

    await connection.commit();

    response.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        id: orderId,
        orderNumber,
        status: "pending",
        paymentStatus,
        paymentMethod,
        paymentGateway,
        subtotal,
        discount,
        couponDiscount,
        creditDiscount: creditRedemption.discountRupees,
        creditPointsRedeemed: creditRedemption.pointsApplied,
        shippingFee,
        totalAmount
      }
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function trackOrder(request, response) {
  const orderNumber = String(request.body?.orderNumber || request.body?.orderId || request.query?.orderNumber || request.query?.orderId || "").trim();
  const contact = String(request.body?.contact || request.body?.identity || request.query?.contact || request.query?.identity || "").trim().toLowerCase();

  if (!orderNumber || !contact) {
    throw new ApiError(400, "Order ID and email/phone are required");
  }

  const orderRows = await query(
    `SELECT
      o.id,
      o.order_number AS orderNumber,
      o.status,
      o.payment_status AS paymentStatus,
      o.payment_method AS paymentMethod,
      o.courier_name AS courierName,
      o.expected_delivery_date AS expectedDeliveryDate,
      o.subtotal,
      o.shipping_fee AS shippingFee,
      o.total_amount AS totalAmount,
      o.coupon_code AS couponCode,
      o.coupon_discount AS couponDiscount,
      o.credit_discount AS creditDiscount,
      o.created_at AS createdAt,
      oa.full_name AS fullName,
      oa.email,
      oa.phone,
      oa.line1,
      oa.line2,
      oa.landmark,
      oa.city,
      oa.state,
      oa.pincode,
      oa.country
     FROM orders o
     LEFT JOIN order_addresses oa ON oa.order_id = o.id AND oa.address_type = 'delivery'
     WHERE LOWER(o.order_number) = LOWER(?)
       AND (LOWER(oa.email) = ? OR LOWER(oa.phone) = ?)
     LIMIT 1`,
    [orderNumber, contact, contact]
  );
  const order = orderRows[0];

  if (!order) {
    throw new ApiError(404, "We could not find an order matching that Order ID and email/phone combination.");
  }

  const [items, timeline] = await Promise.all([
    query(
      `SELECT
        oi.id,
        oi.product_name AS name,
        oi.quantity,
        oi.unit_price AS price,
        oi.total_price AS total,
        p.slug,
        p.image_url AS image
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.id ASC`,
      [order.id]
    ),
    query(
      `SELECT status, title, note, event_time AS dateTime
       FROM order_status_timeline
       WHERE order_id = ?
       ORDER BY event_time ASC, id ASC`,
      [order.id]
    )
  ]);

  response.json({
    success: true,
    data: {
      orderId: order.orderNumber,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      courierName: order.courierName || "",
      expectedDeliveryDate: order.expectedDeliveryDate,
      summary: {
        placedAt: order.createdAt,
        subtotal: Number(order.subtotal || 0),
        shippingFee: Number(order.shippingFee || 0),
        totalAmount: Number(order.totalAmount || 0),
        couponCode: order.couponCode || "",
        couponDiscount: Number(order.couponDiscount || 0),
        creditDiscount: Number(order.creditDiscount || 0)
      },
      deliveryAddress: {
        fullName: order.fullName,
        email: order.email || "",
        phone: order.phone || "",
        line1: order.line1 || "",
        line2: order.line2 || order.landmark || "",
        city: order.city || "",
        state: order.state || "",
        pincode: order.pincode || "",
        country: order.country || "India"
      },
      orderedItems: items.map((item) => ({
        ...item,
        price: Number(item.price || 0),
        total: Number(item.total || 0),
        image: item.image || ""
      })),
      statusTimeline: timeline
    }
  });
}

export async function updateOrderStatus(request, response) {
  const { status, courierName, expectedDeliveryDate, note } = request.body || {};
  const allowedStatuses = ORDER_STATUS_FLOW;
  const normalizedStatus = String(status || "");

  if (!allowedStatuses.includes(normalizedStatus)) {
    throw new ApiError(400, "Invalid order status");
  }

  const orderId = Number(request.params.id);
  const connection = await pool.getConnection();
  let currentOrder;
  let updatedOrder;
  let transitionedToDelivered = false;

  try {
    await connection.beginTransaction();

    const [currentRows] = await connection.execute(
      `SELECT id, customer_id AS customerId, order_number AS orderNumber, status,
              payment_method AS paymentMethod, payment_status AS paymentStatus,
              payment_gateway AS paymentGateway,
              total_amount AS totalAmount,
              courier_name AS courierName, expected_delivery_date AS expectedDeliveryDate
       FROM orders
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [orderId]
    );

    currentOrder = currentRows[0];

    if (!currentOrder) {
      throw new ApiError(404, "Order not found");
    }

    const fulfillmentStatuses = new Set([
      "confirmed",
      "packed",
      "shipped",
      "out_for_delivery",
      "delivered"
    ]);
    if (
      [
        currentOrder.paymentMethod,
        currentOrder.paymentGateway
      ].some((value) => String(value || "").toLowerCase() === "razorpay") &&
      fulfillmentStatuses.has(normalizedStatus) &&
      !["paid", "authorized"].includes(currentOrder.paymentStatus)
    ) {
      throw new ApiError(409, "Razorpay payment must be verified before confirming or fulfilling this order");
    }

    await connection.execute(
      `UPDATE orders
       SET status = ?, courier_name = ?, expected_delivery_date = ?
       WHERE id = ?`,
      [
        normalizedStatus,
        courierName ? String(courierName).trim() : null,
        expectedDeliveryDate ? String(expectedDeliveryDate) : null,
        orderId
      ]
    );

    if (currentOrder.status !== normalizedStatus) {
      await connection.execute(
        `INSERT INTO order_status_timeline (order_id, status, title, note, event_time)
         VALUES (?, ?, ?, ?, NOW())`,
        [
          orderId,
          normalizedStatus,
          buildTimelineTitle(normalizedStatus),
          note ? String(note).trim() : null
        ]
      );
    }

    const [rows] = await connection.execute(
      `SELECT id, order_number AS orderNumber, status, payment_method AS paymentMethod, total_amount AS totalAmount,
              courier_name AS courierName, expected_delivery_date AS expectedDeliveryDate
       FROM orders
       WHERE id = ?
       LIMIT 1`,
      [orderId]
    );

    updatedOrder = rows[0];
    transitionedToDelivered = normalizedStatus === "delivered" && currentOrder.status !== "delivered" && currentOrder.customerId;

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  response.json({
    success: true,
    data: updatedOrder
  });

  // Fire credit rewards when an order reaches 'delivered' for the first time
  if (transitionedToDelivered) {
    grantReferralBonus(currentOrder.customerId, { orderId }).catch(() => {});
    grantPurchaseCashback(currentOrder.customerId, orderId, updatedOrder.totalAmount).catch(() => {});
    grantMilestoneReward(currentOrder.customerId, orderId).catch(() => {});
  }
}

export async function previewAdminInvoice(request, response) {
  const withPrint = String(request.query?.print || "").trim() === "1";
  const asPdf = String(request.query?.pdf || "").trim() === "1";

  const demoOrder = {
    id: 0,
    orderNumber: "AVY-SAMPLE-001",
    status: "confirmed",
    paymentStatus: "paid",
    paymentMethod: "razorpay",
    subtotal: 3598,
    shippingFee: 0,
    totalAmount: 3138,
    couponCode: "WELCOME10",
    couponDiscount: 360,
    creditDiscount: 100,
    createdAt: new Date().toISOString()
  };

  const demoItems = [
    {
      name: "Wireless Bluetooth Headphones Pro",
      quantity: 1,
      unitPrice: 1999,
      totalPrice: 1999,
      mrp: 2499,
      sku: "WBH-PRO-001",
      asin: "B09XYZ1234",
      taxRate: 18,
      taxIncluded: 1,
      imageUrl: ""
    },
    {
      name: "USB-C Fast Charger 65W",
      quantity: 2,
      unitPrice: 799,
      totalPrice: 1598,
      mrp: 999,
      sku: "USC-65W-V2",
      asin: null,
      taxRate: 12,
      taxIncluded: 1,
      imageUrl: ""
    }
  ];

  const demoAddress = {
    fullName: "Priya Sharma",
    email: "priya.sharma@example.com",
    phone: "+91 98765 43210",
    line1: "Flat 204, Greenview Apartments",
    line2: "Koramangala 5th Block",
    landmark: "Near Sony World Junction",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560095",
    country: "India",
    businessName: "Priya Sharma Retail",
    gstNumber: "29ABCDE1234F1Z5"
  };

  const [store, designer] = await Promise.all([
    loadInvoiceStoreSettings(),
    loadInvoiceDesignerSettings()
  ]);

  if (asPdf) {
    sendInvoicePdf(response, demoOrder, demoItems, store, demoAddress, designer, "sample-invoice");
    return;
  }

  const html = buildInvoiceHtml(demoOrder, demoItems, store, demoAddress, designer, !withPrint);

  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.send(html);
}

const ORDER_INVOICE_SELECT = `
  SELECT
    o.id,
    o.order_number AS orderNumber,
    o.status,
    o.payment_status AS paymentStatus,
    o.payment_method AS paymentMethod,
    o.subtotal,
    o.shipping_fee AS shippingFee,
    o.total_amount AS totalAmount,
    o.coupon_code AS couponCode,
    o.coupon_discount AS couponDiscount,
    o.credit_discount AS creditDiscount,
    o.created_at AS createdAt,
    da.full_name AS deliveryFullName,
    da.email AS deliveryEmail,
    da.phone AS deliveryPhone,
    da.line1 AS deliveryLine1,
    da.line2 AS deliveryLine2,
    da.landmark AS deliveryLandmark,
    da.city AS deliveryCity,
    da.state AS deliveryState,
    da.pincode AS deliveryPincode,
    da.country AS deliveryCountry,
    COALESCE(ba.full_name, da.full_name) AS billingFullName,
    COALESCE(ba.email, da.email) AS billingEmail,
    COALESCE(ba.phone, da.phone) AS billingPhone,
    COALESCE(ba.line1, da.line1) AS billingLine1,
    COALESCE(ba.line2, da.line2) AS billingLine2,
    COALESCE(ba.landmark, da.landmark) AS billingLandmark,
    COALESCE(ba.city, da.city) AS billingCity,
    COALESCE(ba.state, da.state) AS billingState,
    COALESCE(ba.pincode, da.pincode) AS billingPincode,
    COALESCE(ba.country, da.country) AS billingCountry,
    obd.business_name AS businessName,
    obd.gst_number AS gstNumber
  FROM orders o
  LEFT JOIN order_addresses da ON da.order_id = o.id AND da.address_type = 'delivery'
  LEFT JOIN order_addresses ba ON ba.order_id = o.id AND ba.address_type = 'billing'
  LEFT JOIN order_business_details obd ON obd.order_id = o.id`;

export async function downloadOrderInvoice(request, response) {
  const orderNumber = String(request.params.orderNumber || "").trim();
  if (!orderNumber) throw new ApiError(400, "Order ID is required");

  await ensureOrderBusinessDetailsTable();
  let orderRows;

  if (request.admin) {
    // Admin path — can access any order
    orderRows = await query(
      `${ORDER_INVOICE_SELECT} WHERE LOWER(o.order_number) = LOWER(?) LIMIT 1`,
      [orderNumber]
    );
  } else if (request.customer) {
    // Customer path — must own the order (by customer_id or matching email)
    const customerEmail = String(request.customer.email || "").trim().toLowerCase();
    orderRows = await query(
      `${ORDER_INVOICE_SELECT}
       WHERE LOWER(o.order_number) = LOWER(?)
         AND (o.customer_id = ? OR LOWER(da.email) = ?)
       LIMIT 1`,
      [orderNumber, request.customer.id, customerEmail]
    );
    if (!orderRows[0]) throw new ApiError(403, "You do not have permission to access this invoice");
  } else {
    // Guest path — require contact (email or phone) in query param
    const contact = String(request.query?.contact || request.query?.identity || "").trim().toLowerCase();
    if (!contact) throw new ApiError(401, "Contact (email or phone) is required to access this invoice");
    orderRows = await query(
      `${ORDER_INVOICE_SELECT}
       WHERE LOWER(o.order_number) = LOWER(?)
         AND (LOWER(da.email) = ? OR LOWER(da.phone) = ?)
       LIMIT 1`,
      [orderNumber, contact, contact]
    );
    if (!orderRows[0]) throw new ApiError(404, "Order not found. Please check your Order ID and email/phone.");
  }

  const order = orderRows[0];
  if (!order) throw new ApiError(404, "Order not found");

  const [items, store, designer] = await Promise.all([
    query(
      `SELECT
        oi.product_name AS name,
        oi.quantity,
        oi.unit_price AS unitPrice,
        oi.total_price AS totalPrice,
        COALESCE(oi.product_mrp, p.mrp) AS mrp,
        p.sku,
        p.asin,
        p.tax_rate AS taxRate,
        p.tax_included AS taxIncluded,
        p.image_url AS imageUrl
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.id ASC`,
      [order.id]
    ),
    loadInvoiceStoreSettings(),
    loadInvoiceDesignerSettings()
  ]);

  const address = {
    fullName: order.billingFullName || order.deliveryFullName || "",
    email: order.billingEmail || order.deliveryEmail || "",
    phone: order.billingPhone || order.deliveryPhone || "",
    line1: order.billingLine1 || order.deliveryLine1 || "",
    line2: order.billingLine2 || order.deliveryLine2 || "",
    landmark: order.billingLandmark || order.deliveryLandmark || "",
    city: order.billingCity || order.deliveryCity || "",
    state: order.billingState || order.deliveryState || "",
    pincode: order.billingPincode || order.deliveryPincode || "",
    country: order.billingCountry || order.deliveryCountry || "India",
    billingAddress: {
      fullName: order.billingFullName || order.deliveryFullName || "",
      email: order.billingEmail || order.deliveryEmail || "",
      phone: order.billingPhone || order.deliveryPhone || "",
      line1: order.billingLine1 || order.deliveryLine1 || "",
      line2: order.billingLine2 || order.deliveryLine2 || "",
      landmark: order.billingLandmark || order.deliveryLandmark || "",
      city: order.billingCity || order.deliveryCity || "",
      state: order.billingState || order.deliveryState || "",
      pincode: order.billingPincode || order.deliveryPincode || "",
      country: order.billingCountry || order.deliveryCountry || "India"
    },
    shippingAddress: {
      fullName: order.deliveryFullName || "",
      email: order.deliveryEmail || "",
      phone: order.deliveryPhone || "",
      line1: order.deliveryLine1 || "",
      line2: order.deliveryLine2 || "",
      landmark: order.deliveryLandmark || "",
      city: order.deliveryCity || "",
      state: order.deliveryState || "",
      pincode: order.deliveryPincode || "",
      country: order.deliveryCountry || "India"
    },
    businessName: order.businessName || "",
    gstNumber: order.gstNumber || ""
  };

  sendInvoicePdf(response, order, items, store, address, designer);
}
