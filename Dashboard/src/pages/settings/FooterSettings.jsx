import React from "react";
import { fetchAdminSettings, updateAdminSettings, uploadFooterImage } from "../../api/adminApi";
import { resolveAdminMediaUrl, toStoredUploadUrl } from "../../utils/media";
import { DEFAULT_APP_SETTINGS, mergeSettings } from "../../../../shared/appSettings";
import ImageUploadField from "../../components/common/ImageUploadField";

const footerTabs = [
  { id: "branding", label: "Branding" },
  { id: "quick-links", label: "Quick Links" },
  { id: "faq-links", label: "FAQ Links" },
  { id: "support", label: "Support" },
  { id: "newsletter", label: "Newsletter" },
  { id: "social-links", label: "Social Links" },
  { id: "payment-icons", label: "Payment Icons" },
  { id: "policy-links", label: "Policy Links" },
  { id: "design-css", label: "Design / Custom CSS" },
  { id: "preview", label: "Preview" }
];

const footerBrandingDefaults = DEFAULT_APP_SETTINGS.footer.branding;
const footerQuickLinksDefaults = DEFAULT_APP_SETTINGS.footer.quickLinks;
const footerFaqLinksDefaults = DEFAULT_APP_SETTINGS.footer.faqLinks;
const footerSupportDefaults = DEFAULT_APP_SETTINGS.footer.support;
const footerNewsletterDefaults = DEFAULT_APP_SETTINGS.footer.newsletter;
const footerSocialLinksDefaults = DEFAULT_APP_SETTINGS.footer.socialLinks;
const footerPaymentIconsDefaults = DEFAULT_APP_SETTINGS.footer.paymentIcons;
const footerPolicyLinksDefaults = DEFAULT_APP_SETTINGS.footer.policyLinks;
const footerDesignDefaults = DEFAULT_APP_SETTINGS.footer.design;
const allowedImageExtensions = new Set(["png", "jpg", "jpeg", "webp"]);
const allowedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxImageSizeBytes = 2 * 1024 * 1024;

function getFooterBranding(settings = DEFAULT_APP_SETTINGS) {
  return {
    ...footerBrandingDefaults,
    ...(settings.footer?.branding || {})
  };
}

function getFooterSupport(settings = DEFAULT_APP_SETTINGS) {
  return {
    ...footerSupportDefaults,
    ...(settings.footer?.support || {})
  };
}

function getFooterNewsletter(settings = DEFAULT_APP_SETTINGS) {
  return {
    ...footerNewsletterDefaults,
    ...(settings.footer?.newsletter || {})
  };
}

function getFooterDesign(settings = DEFAULT_APP_SETTINGS) {
  const design = {
    ...footerDesignDefaults,
    ...(settings.footer?.design || {})
  };
  if (String(design.linkColor || "").toLowerCase() === "#d9f99d") design.linkColor = "#ffffff";
  return {
    ...design
  };
}

function validateScopedCss(css = "") {
  const value = String(css || "").trim();
  if (!value) return "";
  const lowered = value.toLowerCase();
  const blockedPatterns = [
    /<\s*script/i,
    /<\/\s*script/i,
    /\bjavascript\s*:/i,
    /\bon\w+\s*=/i,
    /\bexpression\s*\(/i,
    /\bimport\s*\(/i,
    /@import/i
  ];
  if (blockedPatterns.some((pattern) => pattern.test(value))) {
    return "Custom CSS cannot include JavaScript, script tags, event handlers, expressions, or imports.";
  }
  if (lowered.includes("{") && !/\.avyona-footer[\s.#:[,{>+~]/i.test(`${value} `)) {
    return "Custom CSS must be scoped to .avyona-footer.";
  }
  return "";
}

function normalizeQuickLinks(value = footerQuickLinksDefaults) {
  const source = Array.isArray(value) ? value : footerQuickLinksDefaults;

  return source
    .map((link, index) => ({
      id: String(link.id || `quick-link-${Date.now()}-${index}`),
      label: String(link.label || "").trim(),
      url: String(link.url || "").trim(),
      sortOrder: Number.isFinite(Number(link.sortOrder)) ? Number(link.sortOrder) : index + 1,
      status: link.status === "inactive" ? "inactive" : "active"
    }))
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    .map((link, index) => ({ ...link, sortOrder: index + 1 }));
}

function normalizeFaqLinks(value = footerFaqLinksDefaults) {
  const source = Array.isArray(value) ? value : footerFaqLinksDefaults;

  return source
    .map((link, index) => ({
      id: String(link.id || `faq-link-${Date.now()}-${index}`),
      questionText: String(link.questionText || "").trim(),
      answer: String(link.answer || "").trim(),
      url: String(link.url || "").trim(),
      sortOrder: Number.isFinite(Number(link.sortOrder)) ? Number(link.sortOrder) : index + 1,
      status: link.status === "inactive" ? "inactive" : "active"
    }))
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    .map((link, index) => ({ ...link, sortOrder: index + 1 }));
}

function normalizeSocialLinks(value = footerSocialLinksDefaults) {
  const source = Array.isArray(value) ? value : footerSocialLinksDefaults;

  return source
    .map((link, index) => ({
      id: String(link.id || `social-link-${Date.now()}-${index}`),
      name: String(link.name || "").trim(),
      url: String(link.url || "").trim(),
      icon: String(link.icon || "").trim(),
      sortOrder: Number.isFinite(Number(link.sortOrder)) ? Number(link.sortOrder) : index + 1,
      status: link.status === "inactive" ? "inactive" : "active"
    }))
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    .map((link, index) => ({ ...link, sortOrder: index + 1 }));
}

function normalizePaymentIcons(value = footerPaymentIconsDefaults) {
  const source = Array.isArray(value) ? value : footerPaymentIconsDefaults;

  return source
    .map((payment, index) => ({
      id: String(payment.id || `payment-icon-${Date.now()}-${index}`),
      name: String(payment.name || "").trim(),
      icon: String(payment.icon || "").trim(),
      sortOrder: Number.isFinite(Number(payment.sortOrder)) ? Number(payment.sortOrder) : index + 1,
      status: payment.status === "inactive" ? "inactive" : "active"
    }))
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    .map((payment, index) => ({ ...payment, sortOrder: index + 1 }));
}

function normalizePolicyLinks(value = footerPolicyLinksDefaults) {
  const source = Array.isArray(value) ? value : footerPolicyLinksDefaults;

  return source
    .map((link, index) => ({
      id: String(link.id || `policy-link-${Date.now()}-${index}`),
      label: String(link.label || "").trim(),
      url: String(link.url || "").trim(),
      sortOrder: Number.isFinite(Number(link.sortOrder)) ? Number(link.sortOrder) : index + 1,
      status: link.status === "inactive" ? "inactive" : "active"
    }))
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    .map((link, index) => ({ ...link, sortOrder: index + 1 }));
}

function validateImageFile(file) {
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase() || "";
  if (!allowedImageExtensions.has(extension) || !allowedImageMimeTypes.has(file?.type)) {
    return "Upload a PNG, JPG, JPEG, or WebP image.";
  }
  if (file.size > maxImageSizeBytes) {
    return "Image is too large. Maximum size is 2 MB.";
  }
  return "";
}

export default function FooterSettings() {
  const [activeTab, setActiveTab] = React.useState(footerTabs[0].id);
  const [settings, setSettings] = React.useState(() => mergeSettings(DEFAULT_APP_SETTINGS, {}));
  const [branding, setBranding] = React.useState(() => getFooterBranding(DEFAULT_APP_SETTINGS));
  const [quickLinks, setQuickLinks] = React.useState(() => normalizeQuickLinks(footerQuickLinksDefaults));
  const [faqLinks, setFaqLinks] = React.useState(() => normalizeFaqLinks(footerFaqLinksDefaults));
  const [support, setSupport] = React.useState(() => getFooterSupport(DEFAULT_APP_SETTINGS));
  const [newsletter, setNewsletter] = React.useState(() => getFooterNewsletter(DEFAULT_APP_SETTINGS));
  const [socialLinks, setSocialLinks] = React.useState(() => normalizeSocialLinks(footerSocialLinksDefaults));
  const [paymentIcons, setPaymentIcons] = React.useState(() => normalizePaymentIcons(footerPaymentIconsDefaults));
  const [policyLinks, setPolicyLinks] = React.useState(() => normalizePolicyLinks(footerPolicyLinksDefaults));
  const [design, setDesign] = React.useState(() => getFooterDesign(DEFAULT_APP_SETTINGS));
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState("");
  const [isFallback, setIsFallback] = React.useState(false);
  const [uploadStates, setUploadStates] = React.useState({});
  const currentTab = footerTabs.find((tab) => tab.id === activeTab) || footerTabs[0];

  React.useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      setIsLoading(true);
      setStatusMessage("");

      try {
        const response = await fetchAdminSettings();
        if (!isMounted) return;
        const merged = mergeSettings(DEFAULT_APP_SETTINGS, response.data?.data || {});
        setSettings(merged);
        setBranding(getFooterBranding(merged));
        setQuickLinks(normalizeQuickLinks(merged.footer?.quickLinks));
        setFaqLinks(normalizeFaqLinks(merged.footer?.faqLinks));
        setSupport(getFooterSupport(merged));
        setNewsletter(getFooterNewsletter(merged));
        setSocialLinks(normalizeSocialLinks(merged.footer?.socialLinks));
        setPaymentIcons(normalizePaymentIcons(merged.footer?.paymentIcons));
        setPolicyLinks(normalizePolicyLinks(merged.footer?.policyLinks));
        setDesign(getFooterDesign(merged));
        setIsFallback(false);
        setStatusMessage("Footer settings loaded from backend.");
      } catch (error) {
        if (!isMounted) return;
        setSettings(mergeSettings(DEFAULT_APP_SETTINGS, {}));
        setBranding(getFooterBranding(DEFAULT_APP_SETTINGS));
        setQuickLinks(normalizeQuickLinks(footerQuickLinksDefaults));
        setFaqLinks(normalizeFaqLinks(footerFaqLinksDefaults));
        setSupport(getFooterSupport(DEFAULT_APP_SETTINGS));
        setNewsletter(getFooterNewsletter(DEFAULT_APP_SETTINGS));
        setSocialLinks(normalizeSocialLinks(footerSocialLinksDefaults));
        setPaymentIcons(normalizePaymentIcons(footerPaymentIconsDefaults));
        setPolicyLinks(normalizePolicyLinks(footerPolicyLinksDefaults));
        setDesign(getFooterDesign(DEFAULT_APP_SETTINGS));
        setIsFallback(true);
        setStatusMessage("Showing local footer preview. Sign in as admin to load and save settings.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateBrandingField = (key, value) => {
    setBranding((current) => ({
      ...current,
      [key]: value
    }));
  };

  const updateQuickLink = (linkId, key, value) => {
    setQuickLinks((current) => current.map((link) => (
      link.id === linkId ? { ...link, [key]: key === "sortOrder" ? Number(value || 0) : value } : link
    )));
  };

  const addQuickLink = () => {
    setQuickLinks((current) => [
      ...current,
      {
        id: `quick-link-${Date.now()}`,
        label: "",
        url: "",
        sortOrder: current.length + 1,
        status: "active"
      }
    ]);
  };

  const deleteQuickLink = (linkId) => {
    setQuickLinks((current) => normalizeQuickLinks(current.filter((link) => link.id !== linkId)));
  };

  const moveQuickLink = (linkId, direction) => {
    setQuickLinks((current) => {
      const ordered = normalizeQuickLinks(current);
      const index = ordered.findIndex((link) => link.id === linkId);
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return ordered;
      const next = [...ordered];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next.map((link, linkIndex) => ({ ...link, sortOrder: linkIndex + 1 }));
    });
  };

  const updateFaqLink = (linkId, key, value) => {
    setFaqLinks((current) => current.map((link) => (
      link.id === linkId ? { ...link, [key]: key === "sortOrder" ? Number(value || 0) : value } : link
    )));
  };

  const addFaqLink = () => {
    setFaqLinks((current) => [
      ...current,
      {
        id: `faq-link-${Date.now()}`,
        questionText: "",
        answer: "",
        url: "",
        sortOrder: current.length + 1,
        status: "active"
      }
    ]);
  };

  const deleteFaqLink = (linkId) => {
    setFaqLinks((current) => normalizeFaqLinks(current.filter((link) => link.id !== linkId)));
  };

  const moveFaqLink = (linkId, direction) => {
    setFaqLinks((current) => {
      const ordered = normalizeFaqLinks(current);
      const index = ordered.findIndex((link) => link.id === linkId);
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return ordered;
      const next = [...ordered];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next.map((link, linkIndex) => ({ ...link, sortOrder: linkIndex + 1 }));
    });
  };

  const updateSupportField = (key, value) => {
    setSupport((current) => ({
      ...current,
      [key]: value
    }));
  };

  const updateNewsletterField = (key, value) => {
    setNewsletter((current) => ({
      ...current,
      [key]: value
    }));
  };

  const updateSocialLink = (linkId, key, value) => {
    setSocialLinks((current) => current.map((link) => (
      link.id === linkId ? { ...link, [key]: key === "sortOrder" ? Number(value || 0) : value } : link
    )));
  };

  const addSocialLink = () => {
    setSocialLinks((current) => [
      ...current,
      {
        id: `social-link-${Date.now()}`,
        name: "",
        url: "",
        icon: "",
        sortOrder: current.length + 1,
        status: "active"
      }
    ]);
  };

  const deleteSocialLink = (linkId) => {
    setSocialLinks((current) => normalizeSocialLinks(current.filter((link) => link.id !== linkId)));
  };

  const moveSocialLink = (linkId, direction) => {
    setSocialLinks((current) => {
      const ordered = normalizeSocialLinks(current);
      const index = ordered.findIndex((link) => link.id === linkId);
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return ordered;
      const next = [...ordered];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next.map((link, linkIndex) => ({ ...link, sortOrder: linkIndex + 1 }));
    });
  };

  const updatePaymentIcon = (paymentId, key, value) => {
    setPaymentIcons((current) => current.map((payment) => (
      payment.id === paymentId ? { ...payment, [key]: key === "sortOrder" ? Number(value || 0) : value } : payment
    )));
  };

  const addPaymentIcon = () => {
    setPaymentIcons((current) => [
      ...current,
      {
        id: `payment-icon-${Date.now()}`,
        name: "",
        icon: "",
        sortOrder: current.length + 1,
        status: "active"
      }
    ]);
  };

  const deletePaymentIcon = (paymentId) => {
    setPaymentIcons((current) => normalizePaymentIcons(current.filter((payment) => payment.id !== paymentId)));
  };

  const movePaymentIcon = (paymentId, direction) => {
    setPaymentIcons((current) => {
      const ordered = normalizePaymentIcons(current);
      const index = ordered.findIndex((payment) => payment.id === paymentId);
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return ordered;
      const next = [...ordered];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next.map((payment, paymentIndex) => ({ ...payment, sortOrder: paymentIndex + 1 }));
    });
  };

  const updatePolicyLink = (linkId, key, value) => {
    setPolicyLinks((current) => current.map((link) => (
      link.id === linkId ? { ...link, [key]: key === "sortOrder" ? Number(value || 0) : value } : link
    )));
  };

  const addPolicyLink = () => {
    setPolicyLinks((current) => [
      ...current,
      {
        id: `policy-link-${Date.now()}`,
        label: "",
        url: "",
        sortOrder: current.length + 1,
        status: "active"
      }
    ]);
  };

  const deletePolicyLink = (linkId) => {
    setPolicyLinks((current) => normalizePolicyLinks(current.filter((link) => link.id !== linkId)));
  };

  const movePolicyLink = (linkId, direction) => {
    setPolicyLinks((current) => {
      const ordered = normalizePolicyLinks(current);
      const index = ordered.findIndex((link) => link.id === linkId);
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return ordered;
      const next = [...ordered];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next.map((link, linkIndex) => ({ ...link, sortOrder: linkIndex + 1 }));
    });
  };

  const updateDesignField = (key, value) => {
    setDesign((current) => ({
      ...current,
      [key]: value
    }));
  };

  const setUploadState = (key, nextState) => {
    setUploadStates((current) => ({
      ...current,
      [key]: {
        ...(current[key] || {}),
        ...nextState
      }
    }));
  };

  const handleImageUpload = async (key, file) => {
    const validationMessage = validateImageFile(file);
    if (validationMessage) {
      setUploadState(key, { status: "error", error: validationMessage });
      setStatusMessage(validationMessage);
      setIsFallback(true);
      return;
    }

    setUploadState(key, { status: "uploading", error: "" });
    setStatusMessage("");

    try {
      const response = await uploadFooterImage(file, key === "footerLogo" ? "footer-logo" : "footer-watermark");
      const uploadedUrl = toStoredUploadUrl(response.data?.data?.url || response.data?.url || "");
      updateBrandingField(key, uploadedUrl);
      setUploadState(key, { status: "success", error: "" });
      setIsFallback(false);
      setStatusMessage("Image uploaded. Save Branding to publish it.");
    } catch (error) {
      const message = error.response?.data?.message || "Image upload failed. Check file type, file size, and admin login.";
      setUploadState(key, { status: "error", error: message });
      setIsFallback(true);
      setStatusMessage(message);
    }
  };

  const handleSocialIconUpload = async (linkId, file) => {
    const validationMessage = validateImageFile(file);
    if (validationMessage) {
      setUploadState(`social-${linkId}`, { status: "error", error: validationMessage });
      setStatusMessage(validationMessage);
      setIsFallback(true);
      return;
    }

    setUploadState(`social-${linkId}`, { status: "uploading", error: "" });
    setStatusMessage("");

    try {
      const response = await uploadFooterImage(file, "footer-social-icon");
      const uploadedUrl = toStoredUploadUrl(response.data?.data?.url || response.data?.url || "");
      updateSocialLink(linkId, "icon", uploadedUrl);
      setUploadState(`social-${linkId}`, { status: "success", error: "" });
      setIsFallback(false);
      setStatusMessage("Social icon uploaded. Save Social Links to publish it.");
    } catch (error) {
      const message = error.response?.data?.message || "Social icon upload failed. Check file type, file size, and admin login.";
      setUploadState(`social-${linkId}`, { status: "error", error: message });
      setIsFallback(true);
      setStatusMessage(message);
    }
  };

  const handlePaymentIconUpload = async (paymentId, file) => {
    const validationMessage = validateImageFile(file);
    if (validationMessage) {
      setUploadState(`payment-${paymentId}`, { status: "error", error: validationMessage });
      setStatusMessage(validationMessage);
      setIsFallback(true);
      return;
    }

    setUploadState(`payment-${paymentId}`, { status: "uploading", error: "" });
    setStatusMessage("");

    try {
      const response = await uploadFooterImage(file, "footer-payment-icon");
      const uploadedUrl = toStoredUploadUrl(response.data?.data?.url || response.data?.url || "");
      updatePaymentIcon(paymentId, "icon", uploadedUrl);
      setUploadState(`payment-${paymentId}`, { status: "success", error: "" });
      setIsFallback(false);
      setStatusMessage("Payment icon uploaded. Save Payment Icons to publish it.");
    } catch (error) {
      const message = error.response?.data?.message || "Payment icon upload failed. Check file type, file size, and admin login.";
      setUploadState(`payment-${paymentId}`, { status: "error", error: message });
      setIsFallback(true);
      setStatusMessage(message);
    }
  };

  const saveBranding = async () => {
    setIsSaving(true);
    setStatusMessage("");

    try {
      const nextSettings = mergeSettings(settings, {
        footer: {
          ...(settings.footer || {}),
          branding
        }
      });
      const response = await updateAdminSettings({ settings: nextSettings });
      const savedSettings = mergeSettings(DEFAULT_APP_SETTINGS, response.data?.data || nextSettings);
      setSettings(savedSettings);
      setBranding(getFooterBranding(savedSettings));
      setIsFallback(false);
      setStatusMessage("Footer branding saved successfully.");
    } catch (error) {
      setIsFallback(true);
      setStatusMessage(error.response?.data?.message || "Footer branding updated locally for preview. Sign in as admin to save it.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveQuickLinks = async () => {
    setIsSaving(true);
    setStatusMessage("");

    try {
      const normalizedQuickLinks = normalizeQuickLinks(quickLinks);
      const nextSettings = mergeSettings(settings, {
        footer: {
          ...(settings.footer || {}),
          quickLinks: normalizedQuickLinks
        }
      });
      const response = await updateAdminSettings({ settings: nextSettings });
      const savedSettings = mergeSettings(DEFAULT_APP_SETTINGS, response.data?.data || nextSettings);
      setSettings(savedSettings);
      setQuickLinks(normalizeQuickLinks(savedSettings.footer?.quickLinks));
      setIsFallback(false);
      setStatusMessage("Footer quick links saved successfully.");
    } catch (error) {
      setIsFallback(true);
      setStatusMessage(error.response?.data?.message || "Footer quick links updated locally for preview. Sign in as admin to save them.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveFaqLinks = async () => {
    setIsSaving(true);
    setStatusMessage("");

    try {
      const normalizedFaqLinks = normalizeFaqLinks(faqLinks);
      const nextSettings = mergeSettings(settings, {
        footer: {
          ...(settings.footer || {}),
          faqLinks: normalizedFaqLinks
        }
      });
      const response = await updateAdminSettings({ settings: nextSettings });
      const savedSettings = mergeSettings(DEFAULT_APP_SETTINGS, response.data?.data || nextSettings);
      setSettings(savedSettings);
      setFaqLinks(normalizeFaqLinks(savedSettings.footer?.faqLinks));
      setIsFallback(false);
      setStatusMessage("Footer FAQ links saved successfully.");
    } catch (error) {
      setIsFallback(true);
      setStatusMessage(error.response?.data?.message || "Footer FAQ links updated locally for preview. Sign in as admin to save them.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveSupport = async () => {
    setIsSaving(true);
    setStatusMessage("");

    try {
      const nextSettings = mergeSettings(settings, {
        footer: {
          ...(settings.footer || {}),
          support
        }
      });
      const response = await updateAdminSettings({ settings: nextSettings });
      const savedSettings = mergeSettings(DEFAULT_APP_SETTINGS, response.data?.data || nextSettings);
      setSettings(savedSettings);
      setSupport(getFooterSupport(savedSettings));
      setIsFallback(false);
      setStatusMessage("Footer support details saved successfully.");
    } catch (error) {
      setIsFallback(true);
      setStatusMessage(error.response?.data?.message || "Footer support details updated locally for preview. Sign in as admin to save them.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveNewsletter = async () => {
    setIsSaving(true);
    setStatusMessage("");

    try {
      const nextSettings = mergeSettings(settings, {
        footer: {
          ...(settings.footer || {}),
          newsletter
        }
      });
      const response = await updateAdminSettings({ settings: nextSettings });
      const savedSettings = mergeSettings(DEFAULT_APP_SETTINGS, response.data?.data || nextSettings);
      setSettings(savedSettings);
      setNewsletter(getFooterNewsletter(savedSettings));
      setIsFallback(false);
      setStatusMessage("Footer newsletter settings saved successfully.");
    } catch (error) {
      setIsFallback(true);
      setStatusMessage(error.response?.data?.message || "Footer newsletter settings updated locally for preview. Sign in as admin to save them.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveSocialLinks = async () => {
    setIsSaving(true);
    setStatusMessage("");

    try {
      const normalizedSocialLinks = normalizeSocialLinks(socialLinks);
      const nextSettings = mergeSettings(settings, {
        footer: {
          ...(settings.footer || {}),
          socialLinks: normalizedSocialLinks
        }
      });
      const response = await updateAdminSettings({ settings: nextSettings });
      const savedSettings = mergeSettings(DEFAULT_APP_SETTINGS, response.data?.data || nextSettings);
      setSettings(savedSettings);
      setSocialLinks(normalizeSocialLinks(savedSettings.footer?.socialLinks));
      setIsFallback(false);
      setStatusMessage("Footer social links saved successfully.");
    } catch (error) {
      setIsFallback(true);
      setStatusMessage(error.response?.data?.message || "Footer social links updated locally for preview. Sign in as admin to save them.");
    } finally {
      setIsSaving(false);
    }
  };

  const savePaymentIcons = async () => {
    setIsSaving(true);
    setStatusMessage("");

    try {
      const normalizedPaymentIcons = normalizePaymentIcons(paymentIcons);
      const nextSettings = mergeSettings(settings, {
        footer: {
          ...(settings.footer || {}),
          paymentIcons: normalizedPaymentIcons
        }
      });
      const response = await updateAdminSettings({ settings: nextSettings });
      const savedSettings = mergeSettings(DEFAULT_APP_SETTINGS, response.data?.data || nextSettings);
      setSettings(savedSettings);
      setPaymentIcons(normalizePaymentIcons(savedSettings.footer?.paymentIcons));
      setIsFallback(false);
      setStatusMessage("Footer payment icons saved successfully.");
    } catch (error) {
      setIsFallback(true);
      setStatusMessage(error.response?.data?.message || "Footer payment icons updated locally for preview. Sign in as admin to save them.");
    } finally {
      setIsSaving(false);
    }
  };

  const savePolicyLinks = async () => {
    setIsSaving(true);
    setStatusMessage("");

    try {
      const normalizedPolicyLinks = normalizePolicyLinks(policyLinks);
      const nextSettings = mergeSettings(settings, {
        footer: {
          ...(settings.footer || {}),
          policyLinks: normalizedPolicyLinks
        }
      });
      const response = await updateAdminSettings({ settings: nextSettings });
      const savedSettings = mergeSettings(DEFAULT_APP_SETTINGS, response.data?.data || nextSettings);
      setSettings(savedSettings);
      setPolicyLinks(normalizePolicyLinks(savedSettings.footer?.policyLinks));
      setIsFallback(false);
      setStatusMessage("Footer policy links saved successfully.");
    } catch (error) {
      setIsFallback(true);
      setStatusMessage(error.response?.data?.message || "Footer policy links updated locally for preview. Sign in as admin to save them.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveDesign = async () => {
    const validationMessage = validateScopedCss(design.customCss);
    if (validationMessage) {
      setIsFallback(true);
      setStatusMessage(validationMessage);
      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    try {
      const nextSettings = mergeSettings(settings, {
        footer: {
          ...(settings.footer || {}),
          design
        }
      });
      const response = await updateAdminSettings({ settings: nextSettings });
      const savedSettings = mergeSettings(DEFAULT_APP_SETTINGS, response.data?.data || nextSettings);
      setSettings(savedSettings);
      setDesign(getFooterDesign(savedSettings));
      setIsFallback(false);
      setStatusMessage("Footer design settings saved successfully.");
    } catch (error) {
      setIsFallback(true);
      setStatusMessage(error.response?.data?.message || "Footer design settings updated locally for preview. Sign in as admin to save them.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveFooter = async () => {
    const validationMessage = validateScopedCss(design.customCss);
    if (validationMessage) {
      setIsFallback(true);
      setStatusMessage(validationMessage);
      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    try {
      const nextSettings = mergeSettings(settings, {
        footer: {
          ...(settings.footer || {}),
          branding,
          quickLinks: normalizeQuickLinks(quickLinks),
          faqLinks: normalizeFaqLinks(faqLinks),
          support,
          newsletter,
          socialLinks: normalizeSocialLinks(socialLinks),
          paymentIcons: normalizePaymentIcons(paymentIcons),
          policyLinks: normalizePolicyLinks(policyLinks),
          design
        }
      });
      const response = await updateAdminSettings({ settings: nextSettings });
      const savedSettings = mergeSettings(DEFAULT_APP_SETTINGS, response.data?.data || nextSettings);
      setSettings(savedSettings);
      setBranding(getFooterBranding(savedSettings));
      setQuickLinks(normalizeQuickLinks(savedSettings.footer?.quickLinks));
      setFaqLinks(normalizeFaqLinks(savedSettings.footer?.faqLinks));
      setSupport(getFooterSupport(savedSettings));
      setNewsletter(getFooterNewsletter(savedSettings));
      setSocialLinks(normalizeSocialLinks(savedSettings.footer?.socialLinks));
      setPaymentIcons(normalizePaymentIcons(savedSettings.footer?.paymentIcons));
      setPolicyLinks(normalizePolicyLinks(savedSettings.footer?.policyLinks));
      setDesign(getFooterDesign(savedSettings));
      setIsFallback(false);
      setStatusMessage("Footer settings saved successfully.");
    } catch (error) {
      setIsFallback(true);
      setStatusMessage(error.response?.data?.message || "Footer settings updated locally for preview. Sign in as admin to save them.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={pageStyle}>
      <section style={introStyle}>
        <div>
          <span style={eyebrowStyle}>Settings / Footer</span>
          <h2 style={titleStyle}>Footer Settings</h2>
          <p style={copyStyle}>
            Manage footer content in focused tabs. Branding is ready now; the remaining footer tabs are placeholders for the next steps.
          </p>
        </div>
      </section>

      {statusMessage ? (
        <section style={{ ...feedbackStyle, ...(isFallback ? feedbackWarningStyle : feedbackSuccessStyle) }}>
          {statusMessage}
        </section>
      ) : null}

      <section style={tabsShellStyle}>
        <div style={tabsStyle} role="tablist" aria-label="Footer settings tabs">
          {footerTabs.map((tab) => {
            const isActive = tab.id === activeTab;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`footer-settings-panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  ...tabButtonStyle,
                  ...(isActive ? activeTabButtonStyle : null)
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          id={`footer-settings-panel-${currentTab.id}`}
          role="tabpanel"
          aria-label={currentTab.label}
          style={panelStyle}
        >
          {activeTab === "branding" ? (
            <BrandingTab
              branding={branding}
              uploadStates={uploadStates}
              isLoading={isLoading}
              isSaving={isSaving}
              onChange={updateBrandingField}
              onUpload={handleImageUpload}
              onSave={saveBranding}
            />
          ) : activeTab === "quick-links" ? (
            <QuickLinksTab
              links={quickLinks}
              isLoading={isLoading}
              isSaving={isSaving}
              onAdd={addQuickLink}
              onChange={updateQuickLink}
              onDelete={deleteQuickLink}
              onMove={moveQuickLink}
              onSave={saveQuickLinks}
            />
          ) : activeTab === "faq-links" ? (
            <FaqLinksTab
              links={faqLinks}
              isLoading={isLoading}
              isSaving={isSaving}
              onAdd={addFaqLink}
              onChange={updateFaqLink}
              onDelete={deleteFaqLink}
              onMove={moveFaqLink}
              onSave={saveFaqLinks}
            />
          ) : activeTab === "support" ? (
            <SupportTab
              support={support}
              isLoading={isLoading}
              isSaving={isSaving}
              onChange={updateSupportField}
              onSave={saveSupport}
            />
          ) : activeTab === "newsletter" ? (
            <NewsletterTab
              newsletter={newsletter}
              isLoading={isLoading}
              isSaving={isSaving}
              onChange={updateNewsletterField}
              onSave={saveNewsletter}
            />
          ) : activeTab === "social-links" ? (
            <SocialLinksTab
              links={socialLinks}
              uploadStates={uploadStates}
              isLoading={isLoading}
              isSaving={isSaving}
              onAdd={addSocialLink}
              onChange={updateSocialLink}
              onDelete={deleteSocialLink}
              onMove={moveSocialLink}
              onUpload={handleSocialIconUpload}
              onSave={saveSocialLinks}
            />
          ) : activeTab === "payment-icons" ? (
            <PaymentIconsTab
              payments={paymentIcons}
              uploadStates={uploadStates}
              isLoading={isLoading}
              isSaving={isSaving}
              onAdd={addPaymentIcon}
              onChange={updatePaymentIcon}
              onDelete={deletePaymentIcon}
              onMove={movePaymentIcon}
              onUpload={handlePaymentIconUpload}
              onSave={savePaymentIcons}
            />
          ) : activeTab === "policy-links" ? (
            <PolicyLinksTab
              links={policyLinks}
              isLoading={isLoading}
              isSaving={isSaving}
              onAdd={addPolicyLink}
              onChange={updatePolicyLink}
              onDelete={deletePolicyLink}
              onMove={movePolicyLink}
              onSave={savePolicyLinks}
            />
          ) : activeTab === "design-css" ? (
            <DesignCssTab
              design={design}
              isLoading={isLoading}
              isSaving={isSaving}
              onChange={updateDesignField}
              onSave={saveDesign}
            />
          ) : activeTab === "preview" ? (
            <PreviewTab
              branding={branding}
              quickLinks={quickLinks}
              faqLinks={faqLinks}
              support={support}
              newsletter={newsletter}
              socialLinks={socialLinks}
              paymentIcons={paymentIcons}
              policyLinks={policyLinks}
              design={design}
              isLoading={isLoading}
              isSaving={isSaving}
              onSave={saveFooter}
            />
          ) : (
            <span style={eyebrowStyle}>{currentTab.label}</span>
          )}
        </div>
      </section>
    </div>
  );
}

function BrandingTab({ branding, uploadStates, isLoading, isSaving, onChange, onUpload, onSave }) {
  return (
    <div style={brandingGridStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <span style={eyebrowStyle}>Branding</span>
          <h3 style={sectionTitleStyle}>Footer Branding</h3>
        </div>
        <button type="button" onClick={onSave} disabled={isLoading || isSaving} style={saveButtonStyle}>
          {isSaving ? "Saving..." : "Save Branding"}
        </button>
      </div>

      <div style={twoColumnGridStyle}>
        <ImageUploadField
          label="Footer Logo"
          value={branding.footerLogo}
          uploadState={uploadStates.footerLogo}
          onUpload={(file) => onUpload("footerLogo", file)}
          onRemove={() => onChange("footerLogo", "")}
        />
        <ImageUploadField
          label="Background Watermark Image"
          value={branding.backgroundWatermarkImage}
          uploadState={uploadStates.backgroundWatermarkImage}
          onUpload={(file) => onUpload("backgroundWatermarkImage", file)}
          onRemove={() => onChange("backgroundWatermarkImage", "")}
        />
      </div>

      <div style={twoColumnGridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Footer Tagline</span>
          <input value={branding.tagline || ""} onChange={(event) => onChange("tagline", event.target.value)} style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Copyright Text</span>
          <input value={branding.copyrightText || ""} onChange={(event) => onChange("copyrightText", event.target.value)} style={inputStyle} />
        </label>
      </div>

      <label style={fieldStyle}>
        <span style={labelStyle}>Footer Description</span>
        <textarea value={branding.description || ""} onChange={(event) => onChange("description", event.target.value)} rows={4} style={textareaStyle} />
      </label>
    </div>
  );
}

function QuickLinksTab({ links, isLoading, isSaving, onAdd, onChange, onDelete, onMove, onSave }) {
  const [editingLinkId, setEditingLinkId] = React.useState("");
  const orderedLinks = normalizeQuickLinks(links);

  return (
    <div style={brandingGridStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <span style={eyebrowStyle}>Quick Links</span>
          <h3 style={sectionTitleStyle}>Footer Quick Links</h3>
        </div>
        <div style={headerActionRowStyle}>
          <button type="button" onClick={onAdd} disabled={isLoading || isSaving} style={secondaryButtonStyle}>
            Add Link
          </button>
          <button type="button" onClick={onSave} disabled={isLoading || isSaving} style={saveButtonStyle}>
            {isSaving ? "Saving..." : "Save Quick Links"}
          </button>
        </div>
      </div>

      <div style={quickLinksListStyle}>
        {orderedLinks.map((link, index) => {
          const isEditing = editingLinkId === link.id || (!link.label && !link.url);

          return (
            <article key={link.id} style={quickLinkCardStyle}>
              <div style={quickLinkFieldsStyle}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Link Label</span>
                  <input disabled={!isEditing || isSaving} value={link.label} onChange={(event) => onChange(link.id, "label", event.target.value)} style={inputStyle} placeholder="Example: Home" />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Link URL</span>
                  <input disabled={!isEditing || isSaving} value={link.url} onChange={(event) => onChange(link.id, "url", event.target.value)} style={inputStyle} placeholder="/collections" />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Sort Order</span>
                  <input disabled={!isEditing || isSaving} type="number" min="1" value={link.sortOrder} onChange={(event) => onChange(link.id, "sortOrder", event.target.value)} style={inputStyle} />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Status</span>
                  <select disabled={!isEditing || isSaving} value={link.status} onChange={(event) => onChange(link.id, "status", event.target.value)} style={inputStyle}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>
              <div style={quickLinkActionRowStyle}>
                <button type="button" onClick={() => setEditingLinkId(isEditing ? "" : link.id)} disabled={isSaving} style={smallButtonStyle}>
                  {isEditing ? "Done" : "Edit Link"}
                </button>
                <button type="button" onClick={() => onMove(link.id, "up")} disabled={index === 0 || isSaving} style={smallButtonStyle}>
                  Move Up
                </button>
                <button type="button" onClick={() => onMove(link.id, "down")} disabled={index === orderedLinks.length - 1 || isSaving} style={smallButtonStyle}>
                  Move Down
                </button>
                <button
                  type="button"
                  onClick={() => onChange(link.id, "status", link.status === "active" ? "inactive" : "active")}
                  disabled={isSaving}
                  style={link.status === "active" ? statusActiveButtonStyle : smallButtonStyle}
                >
                  {link.status === "active" ? "Active" : "Inactive"}
                </button>
                <button type="button" onClick={() => onDelete(link.id)} disabled={isSaving} style={dangerButtonStyle}>
                  Delete Link
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function FaqLinksTab({ links, isLoading, isSaving, onAdd, onChange, onDelete, onMove, onSave }) {
  const [editingLinkId, setEditingLinkId] = React.useState("");
  const orderedLinks = normalizeFaqLinks(links);

  return (
    <div style={brandingGridStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <span style={eyebrowStyle}>FAQ Links</span>
          <h3 style={sectionTitleStyle}>Footer FAQ Links</h3>
        </div>
        <div style={headerActionRowStyle}>
          <button type="button" onClick={onAdd} disabled={isLoading || isSaving} style={secondaryButtonStyle}>
            Add
          </button>
          <button type="button" onClick={onSave} disabled={isLoading || isSaving} style={saveButtonStyle}>
            {isSaving ? "Saving..." : "Save FAQ Links"}
          </button>
        </div>
      </div>

      <div style={quickLinksListStyle}>
        {orderedLinks.map((link, index) => {
          const isEditing = editingLinkId === link.id || (!link.questionText && !link.answer);

          return (
            <article key={link.id} style={quickLinkCardStyle}>
              <div style={quickLinkFieldsStyle}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Question Text</span>
                  <input disabled={!isEditing || isSaving} value={link.questionText} onChange={(event) => onChange(link.id, "questionText", event.target.value)} style={inputStyle} placeholder="Example: How do I track my order?" />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Answer Text</span>
                  <textarea disabled={!isEditing || isSaving} value={link.answer} onChange={(event) => onChange(link.id, "answer", event.target.value)} rows={3} style={textareaStyle} placeholder="Example: Use the Track Order page with your order number." />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Optional Link URL</span>
                  <input disabled={!isEditing || isSaving} value={link.url} onChange={(event) => onChange(link.id, "url", event.target.value)} style={inputStyle} placeholder="/track-order" />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Sort Order</span>
                  <input disabled={!isEditing || isSaving} type="number" min="1" value={link.sortOrder} onChange={(event) => onChange(link.id, "sortOrder", event.target.value)} style={inputStyle} />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Status</span>
                  <select disabled={!isEditing || isSaving} value={link.status} onChange={(event) => onChange(link.id, "status", event.target.value)} style={inputStyle}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>
              <div style={quickLinkActionRowStyle}>
                <button type="button" onClick={() => setEditingLinkId(isEditing ? "" : link.id)} disabled={isSaving} style={smallButtonStyle}>
                  {isEditing ? "Done" : "Edit"}
                </button>
                <button type="button" onClick={() => onMove(link.id, "up")} disabled={index === 0 || isSaving} style={smallButtonStyle}>
                  Move Up
                </button>
                <button type="button" onClick={() => onMove(link.id, "down")} disabled={index === orderedLinks.length - 1 || isSaving} style={smallButtonStyle}>
                  Move Down
                </button>
                <button
                  type="button"
                  onClick={() => onChange(link.id, "status", link.status === "active" ? "inactive" : "active")}
                  disabled={isSaving}
                  style={link.status === "active" ? statusActiveButtonStyle : smallButtonStyle}
                >
                  {link.status === "active" ? "Active" : "Inactive"}
                </button>
                <button type="button" onClick={() => onDelete(link.id)} disabled={isSaving} style={dangerButtonStyle}>
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function SupportTab({ support, isLoading, isSaving, onChange, onSave }) {
  return (
    <div style={brandingGridStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <span style={eyebrowStyle}>Support</span>
          <h3 style={sectionTitleStyle}>Footer Support Details</h3>
        </div>
        <button type="button" onClick={onSave} disabled={isLoading || isSaving} style={saveButtonStyle}>
          {isSaving ? "Saving..." : "Save Support"}
        </button>
      </div>

      <div style={twoColumnGridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Support Section Title</span>
          <input value={support.sectionTitle || ""} onChange={(event) => onChange("sectionTitle", event.target.value)} style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Email Label</span>
          <input value={support.emailLabel || ""} onChange={(event) => onChange("emailLabel", event.target.value)} style={inputStyle} />
        </label>
      </div>

      <div style={twoColumnGridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Support Email</span>
          <input type="email" value={support.supportEmail || ""} onChange={(event) => onChange("supportEmail", event.target.value)} style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Email Help Text</span>
          <input value={support.emailHelpText || ""} onChange={(event) => onChange("emailHelpText", event.target.value)} style={inputStyle} />
        </label>
      </div>

      <div style={twoColumnGridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Phone Label</span>
          <input value={support.phoneLabel || ""} onChange={(event) => onChange("phoneLabel", event.target.value)} style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Support Phone</span>
          <input value={support.supportPhone || ""} onChange={(event) => onChange("supportPhone", event.target.value)} style={inputStyle} />
        </label>
      </div>

      <div style={twoColumnGridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Phone Help Text</span>
          <input value={support.phoneHelpText || ""} onChange={(event) => onChange("phoneHelpText", event.target.value)} style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Working Hours</span>
          <input value={support.workingHours || ""} onChange={(event) => onChange("workingHours", event.target.value)} style={inputStyle} />
        </label>
      </div>
    </div>
  );
}

function NewsletterTab({ newsletter, isLoading, isSaving, onChange, onSave }) {
  return (
    <div style={brandingGridStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <span style={eyebrowStyle}>Newsletter</span>
          <h3 style={sectionTitleStyle}>Footer Newsletter Signup</h3>
        </div>
        <button type="button" onClick={onSave} disabled={isLoading || isSaving} style={saveButtonStyle}>
          {isSaving ? "Saving..." : "Save Newsletter"}
        </button>
      </div>

      <label style={toggleFieldStyle}>
        <input type="checkbox" checked={newsletter.enabled !== false} onChange={(event) => onChange("enabled", event.target.checked)} />
        <span>Enable Newsletter</span>
      </label>

      <div style={twoColumnGridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Newsletter Title</span>
          <input value={newsletter.title || ""} onChange={(event) => onChange("title", event.target.value)} style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Email Placeholder</span>
          <input value={newsletter.emailPlaceholder || ""} onChange={(event) => onChange("emailPlaceholder", event.target.value)} style={inputStyle} />
        </label>
      </div>

      <div style={twoColumnGridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Button Text / Icon</span>
          <input value={newsletter.buttonText || ""} onChange={(event) => onChange("buttonText", event.target.value)} style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Success Message</span>
          <input value={newsletter.successMessage || ""} onChange={(event) => onChange("successMessage", event.target.value)} style={inputStyle} />
        </label>
      </div>

      <label style={fieldStyle}>
        <span style={labelStyle}>Description</span>
        <textarea value={newsletter.description || ""} onChange={(event) => onChange("description", event.target.value)} rows={4} style={textareaStyle} />
      </label>
    </div>
  );
}

function SocialLinksTab({ links, uploadStates, isLoading, isSaving, onAdd, onChange, onDelete, onMove, onUpload, onSave }) {
  const [editingLinkId, setEditingLinkId] = React.useState("");
  const orderedLinks = normalizeSocialLinks(links);

  return (
    <div style={brandingGridStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <span style={eyebrowStyle}>Social Links</span>
          <h3 style={sectionTitleStyle}>Footer Social Media Links</h3>
        </div>
        <div style={headerActionRowStyle}>
          <button type="button" onClick={onAdd} disabled={isLoading || isSaving} style={secondaryButtonStyle}>
            Add Social Link
          </button>
          <button type="button" onClick={onSave} disabled={isLoading || isSaving} style={saveButtonStyle}>
            {isSaving ? "Saving..." : "Save Social Links"}
          </button>
        </div>
      </div>

      <div style={quickLinksListStyle}>
        {orderedLinks.map((link, index) => {
          const isEditing = editingLinkId === link.id || (!link.name && !link.url);

          return (
            <article key={link.id} style={quickLinkCardStyle}>
              <div style={socialLinkGridStyle}>
                <ImageUploadField
                  label="Social Icon"
                  value={link.icon}
                  uploadState={uploadStates[`social-${link.id}`]}
                  onUpload={(file) => onUpload(link.id, file)}
                  onRemove={() => onChange(link.id, "icon", "")}
                  compact
                />
                <div style={quickLinkFieldsStyle}>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Social Name</span>
                    <input disabled={!isEditing || isSaving} value={link.name} onChange={(event) => onChange(link.id, "name", event.target.value)} style={inputStyle} placeholder="Example: Instagram" />
                  </label>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Social URL</span>
                    <input disabled={!isEditing || isSaving} value={link.url} onChange={(event) => onChange(link.id, "url", event.target.value)} style={inputStyle} placeholder="https://instagram.com/avyona" />
                  </label>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Sort Order</span>
                    <input disabled={!isEditing || isSaving} type="number" min="1" value={link.sortOrder} onChange={(event) => onChange(link.id, "sortOrder", event.target.value)} style={inputStyle} />
                  </label>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Status</span>
                    <select disabled={!isEditing || isSaving} value={link.status} onChange={(event) => onChange(link.id, "status", event.target.value)} style={inputStyle}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
              </div>
              <div style={quickLinkActionRowStyle}>
                <button type="button" onClick={() => setEditingLinkId(isEditing ? "" : link.id)} disabled={isSaving} style={smallButtonStyle}>
                  {isEditing ? "Done" : "Edit"}
                </button>
                <button type="button" onClick={() => onMove(link.id, "up")} disabled={index === 0 || isSaving} style={smallButtonStyle}>
                  Move Up
                </button>
                <button type="button" onClick={() => onMove(link.id, "down")} disabled={index === orderedLinks.length - 1 || isSaving} style={smallButtonStyle}>
                  Move Down
                </button>
                <button
                  type="button"
                  onClick={() => onChange(link.id, "status", link.status === "active" ? "inactive" : "active")}
                  disabled={isSaving}
                  style={link.status === "active" ? statusActiveButtonStyle : smallButtonStyle}
                >
                  {link.status === "active" ? "Active" : "Inactive"}
                </button>
                <button type="button" onClick={() => onDelete(link.id)} disabled={isSaving} style={dangerButtonStyle}>
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function PaymentIconsTab({ payments, uploadStates, isLoading, isSaving, onAdd, onChange, onDelete, onMove, onUpload, onSave }) {
  const [editingPaymentId, setEditingPaymentId] = React.useState("");
  const orderedPayments = normalizePaymentIcons(payments);

  return (
    <div style={brandingGridStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <span style={eyebrowStyle}>Payment Icons</span>
          <h3 style={sectionTitleStyle}>Footer Payment Method Icons</h3>
        </div>
        <div style={headerActionRowStyle}>
          <button type="button" onClick={onAdd} disabled={isLoading || isSaving} style={secondaryButtonStyle}>
            Add Payment Icon
          </button>
          <button type="button" onClick={onSave} disabled={isLoading || isSaving} style={saveButtonStyle}>
            {isSaving ? "Saving..." : "Save Payment Icons"}
          </button>
        </div>
      </div>

      <div style={quickLinksListStyle}>
        {orderedPayments.map((payment, index) => {
          const isEditing = editingPaymentId === payment.id || !payment.name;

          return (
            <article key={payment.id} style={quickLinkCardStyle}>
              <div style={socialLinkGridStyle}>
                <ImageUploadField
                  label="Payment Icon"
                  value={payment.icon}
                  uploadState={uploadStates[`payment-${payment.id}`]}
                  onUpload={(file) => onUpload(payment.id, file)}
                  onRemove={() => onChange(payment.id, "icon", "")}
                  compact
                />
                <div style={quickLinkFieldsStyle}>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Payment Name</span>
                    <input disabled={!isEditing || isSaving} value={payment.name} onChange={(event) => onChange(payment.id, "name", event.target.value)} style={inputStyle} placeholder="Example: Visa" />
                  </label>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Sort Order</span>
                    <input disabled={!isEditing || isSaving} type="number" min="1" value={payment.sortOrder} onChange={(event) => onChange(payment.id, "sortOrder", event.target.value)} style={inputStyle} />
                  </label>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Status</span>
                    <select disabled={!isEditing || isSaving} value={payment.status} onChange={(event) => onChange(payment.id, "status", event.target.value)} style={inputStyle}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
              </div>
              <div style={quickLinkActionRowStyle}>
                <button type="button" onClick={() => setEditingPaymentId(isEditing ? "" : payment.id)} disabled={isSaving} style={smallButtonStyle}>
                  {isEditing ? "Done" : "Edit"}
                </button>
                <button type="button" onClick={() => onMove(payment.id, "up")} disabled={index === 0 || isSaving} style={smallButtonStyle}>
                  Move Up
                </button>
                <button type="button" onClick={() => onMove(payment.id, "down")} disabled={index === orderedPayments.length - 1 || isSaving} style={smallButtonStyle}>
                  Move Down
                </button>
                <button
                  type="button"
                  onClick={() => onChange(payment.id, "status", payment.status === "active" ? "inactive" : "active")}
                  disabled={isSaving}
                  style={payment.status === "active" ? statusActiveButtonStyle : smallButtonStyle}
                >
                  {payment.status === "active" ? "Active" : "Inactive"}
                </button>
                <button type="button" onClick={() => onDelete(payment.id)} disabled={isSaving} style={dangerButtonStyle}>
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function PolicyLinksTab({ links, isLoading, isSaving, onAdd, onChange, onDelete, onMove, onSave }) {
  const [editingLinkId, setEditingLinkId] = React.useState("");
  const orderedLinks = normalizePolicyLinks(links);

  return (
    <div style={brandingGridStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <span style={eyebrowStyle}>Policy Links</span>
          <h3 style={sectionTitleStyle}>Footer Legal and Policy Links</h3>
        </div>
        <div style={headerActionRowStyle}>
          <button type="button" onClick={onAdd} disabled={isLoading || isSaving} style={secondaryButtonStyle}>
            Add Policy Link
          </button>
          <button type="button" onClick={onSave} disabled={isLoading || isSaving} style={saveButtonStyle}>
            {isSaving ? "Saving..." : "Save Policy Links"}
          </button>
        </div>
      </div>

      <div style={quickLinksListStyle}>
        {orderedLinks.map((link, index) => {
          const isEditing = editingLinkId === link.id || (!link.label && !link.url);

          return (
            <article key={link.id} style={quickLinkCardStyle}>
              <div style={quickLinkFieldsStyle}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Policy Label</span>
                  <input disabled={!isEditing || isSaving} value={link.label} onChange={(event) => onChange(link.id, "label", event.target.value)} style={inputStyle} placeholder="Example: Privacy Policy" />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Policy URL</span>
                  <input disabled={!isEditing || isSaving} value={link.url} onChange={(event) => onChange(link.id, "url", event.target.value)} style={inputStyle} placeholder="/privacy-policy" />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Sort Order</span>
                  <input disabled={!isEditing || isSaving} type="number" min="1" value={link.sortOrder} onChange={(event) => onChange(link.id, "sortOrder", event.target.value)} style={inputStyle} />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Status</span>
                  <select disabled={!isEditing || isSaving} value={link.status} onChange={(event) => onChange(link.id, "status", event.target.value)} style={inputStyle}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>
              <div style={quickLinkActionRowStyle}>
                <button type="button" onClick={() => setEditingLinkId(isEditing ? "" : link.id)} disabled={isSaving} style={smallButtonStyle}>
                  {isEditing ? "Done" : "Edit"}
                </button>
                <button type="button" onClick={() => onMove(link.id, "up")} disabled={index === 0 || isSaving} style={smallButtonStyle}>
                  Move Up
                </button>
                <button type="button" onClick={() => onMove(link.id, "down")} disabled={index === orderedLinks.length - 1 || isSaving} style={smallButtonStyle}>
                  Move Down
                </button>
                <button
                  type="button"
                  onClick={() => onChange(link.id, "status", link.status === "active" ? "inactive" : "active")}
                  disabled={isSaving}
                  style={link.status === "active" ? statusActiveButtonStyle : smallButtonStyle}
                >
                  {link.status === "active" ? "Active" : "Inactive"}
                </button>
                <button type="button" onClick={() => onDelete(link.id)} disabled={isSaving} style={dangerButtonStyle}>
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function DesignCssTab({ design, isLoading, isSaving, onChange, onSave }) {
  const cssValidationMessage = validateScopedCss(design.customCss);

  return (
    <div style={brandingGridStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <span style={eyebrowStyle}>Design / Custom CSS</span>
          <h3 style={sectionTitleStyle}>Footer Design Controls</h3>
        </div>
        <button type="button" onClick={onSave} disabled={isLoading || isSaving || Boolean(cssValidationMessage)} style={saveButtonStyle}>
          {isSaving ? "Saving..." : "Save Design"}
        </button>
      </div>

      <div style={twoColumnGridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Footer Background Color</span>
          <div style={colorFieldStyle}>
            <input type="color" value={design.backgroundColor || "#0f172a"} onChange={(event) => onChange("backgroundColor", event.target.value)} style={colorInputStyle} />
            <input value={design.backgroundColor || ""} onChange={(event) => onChange("backgroundColor", event.target.value)} style={inputStyle} />
          </div>
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Text Color</span>
          <div style={colorFieldStyle}>
            <input type="color" value={design.textColor || "#f8fafc"} onChange={(event) => onChange("textColor", event.target.value)} style={colorInputStyle} />
            <input value={design.textColor || ""} onChange={(event) => onChange("textColor", event.target.value)} style={inputStyle} />
          </div>
        </label>
      </div>

      <div style={twoColumnGridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Accent Color</span>
          <div style={colorFieldStyle}>
            <input type="color" value={design.accentColor || "#5db467"} onChange={(event) => onChange("accentColor", event.target.value)} style={colorInputStyle} />
            <input value={design.accentColor || ""} onChange={(event) => onChange("accentColor", event.target.value)} style={inputStyle} />
          </div>
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Link Color</span>
          <div style={colorFieldStyle}>
            <input type="color" value={design.linkColor || "#ffffff"} onChange={(event) => onChange("linkColor", event.target.value)} style={colorInputStyle} />
            <input value={design.linkColor || ""} onChange={(event) => onChange("linkColor", event.target.value)} style={inputStyle} />
          </div>
        </label>
      </div>

      <label style={fieldStyle}>
        <span style={labelStyle}>Footer Layout Style</span>
        <select value={design.layoutStyle || "columns"} onChange={(event) => onChange("layoutStyle", event.target.value)} style={inputStyle}>
          <option value="columns">Columns</option>
          <option value="compact">Compact</option>
          <option value="centered">Centered</option>
          <option value="stacked">Stacked</option>
        </select>
      </label>

      <label style={fieldStyle}>
        <span style={labelStyle}>Custom CSS</span>
        <textarea
          value={design.customCss || ""}
          onChange={(event) => onChange("customCss", event.target.value)}
          rows={8}
          style={codeTextareaStyle}
          placeholder={".avyona-footer {\n  border-top: 1px solid rgba(255,255,255,0.12);\n}"}
        />
        <small style={cssValidationMessage ? errorStyle : helperTextStyle}>
          {cssValidationMessage || "CSS only. All custom CSS must be scoped to .avyona-footer."}
        </small>
      </label>
    </div>
  );
}

function PreviewTab({ branding, quickLinks, faqLinks, support, newsletter, socialLinks, paymentIcons, policyLinks, design, isLoading, isSaving, onSave }) {
  const [previewMode, setPreviewMode] = React.useState("desktop");
  const activeQuickLinks = normalizeQuickLinks(quickLinks).filter((link) => link.status === "active");
  const activeFaqLinks = normalizeFaqLinks(faqLinks).filter((link) => link.status === "active");
  const activeSocialLinks = normalizeSocialLinks(socialLinks).filter((link) => link.status === "active");
  const activePaymentIcons = normalizePaymentIcons(paymentIcons).filter((payment) => payment.status === "active");
  const activePolicyLinks = normalizePolicyLinks(policyLinks).filter((link) => link.status === "active");
  const footerLogo = resolveAdminMediaUrl(branding.footerLogo);
  const watermarkImage = resolveAdminMediaUrl(branding.backgroundWatermarkImage);
  const previewWidth = previewMode === "mobile" ? "390px" : "100%";
  const customCss = validateScopedCss(design.customCss) ? "" : String(design.customCss || "");

  return (
    <div style={brandingGridStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <span style={eyebrowStyle}>Preview</span>
          <h3 style={sectionTitleStyle}>Footer Preview</h3>
        </div>
        <div style={headerActionRowStyle}>
          <button
            type="button"
            onClick={() => setPreviewMode("desktop")}
            style={previewMode === "desktop" ? activePreviewButtonStyle : secondaryButtonStyle}
          >
            Preview Desktop
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode("mobile")}
            style={previewMode === "mobile" ? activePreviewButtonStyle : secondaryButtonStyle}
          >
            Preview Mobile
          </button>
          <button type="button" onClick={onSave} disabled={isLoading || isSaving} style={saveButtonStyle}>
            {isSaving ? "Saving..." : "Save Footer"}
          </button>
        </div>
      </div>

      <div style={previewFrameOuterStyle}>
        <div style={{ ...previewFrameStyle, maxWidth: previewWidth }}>
          <style>{customCss}</style>
          <footer
            className={`avyona-footer avyona-footer-${design.layoutStyle || "columns"}`}
            style={{
              ...footerPreviewStyle,
              backgroundColor: design.backgroundColor || "#0f172a",
              color: design.textColor || "#f8fafc",
              backgroundImage: watermarkImage ? `linear-gradient(rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.92)), url("${watermarkImage}")` : "none"
            }}
          >
            <div style={previewMode === "mobile" ? footerPreviewMobileGridStyle : footerPreviewGridStyle}>
              <section style={previewColumnStyle}>
                {footerLogo ? <img src={footerLogo} alt="Footer logo preview" style={footerLogoPreviewStyle} /> : <strong style={previewBrandTextStyle}>Avyona</strong>}
                <strong style={{ color: design.accentColor || "#5db467" }}>{branding.tagline || "Footer tagline"}</strong>
                <p style={previewCopyStyle}>{branding.description || "Footer description"}</p>
              </section>

              <PreviewLinkColumn title="Quick Links" links={activeQuickLinks.map((link) => ({ label: link.label, url: link.url }))} linkColor={design.linkColor} />
              <PreviewLinkColumn title="FAQ" links={activeFaqLinks.map((link) => ({ label: link.questionText, url: link.url, answer: link.answer }))} linkColor={design.linkColor} />

              <section style={previewColumnStyle}>
                <h4 style={previewHeadingStyle}>{support.sectionTitle || "Support"}</h4>
                <span>{support.emailLabel || "Email"}: {support.supportEmail || "support@avyona.com"}</span>
                {support.emailHelpText ? <small style={previewSmallStyle}>{support.emailHelpText}</small> : null}
                <span>{support.phoneLabel || "Phone"}: {support.supportPhone || "+91 98765 43210"}</span>
                {support.phoneHelpText ? <small style={previewSmallStyle}>{support.phoneHelpText}</small> : null}
                {support.workingHours ? <small style={previewSmallStyle}>{support.workingHours}</small> : null}
              </section>
            </div>

            {newsletter.enabled !== false ? (
              <section style={newsletterPreviewStyle}>
                <div>
                  <h4 style={previewHeadingStyle}>{newsletter.title || "Newsletter"}</h4>
                  <p style={previewCopyStyle}>{newsletter.description || ""}</p>
                </div>
                <div style={newsletterFormPreviewStyle}>
                  <span style={newsletterInputPreviewStyle}>{newsletter.emailPlaceholder || "Enter your email"}</span>
                  <span style={{ ...newsletterButtonPreviewStyle, backgroundColor: design.accentColor || "#5db467" }}>{newsletter.buttonText || "Subscribe"}</span>
                </div>
              </section>
            ) : null}

            <div style={footerPreviewBottomStyle}>
              <div style={iconRowStyle}>
                {activeSocialLinks.map((link) => (
                  <PreviewIcon key={link.id} src={link.icon} label={link.name} />
                ))}
              </div>
              <div style={iconRowStyle}>
                {activePaymentIcons.map((payment) => (
                  <PreviewIcon key={payment.id} src={payment.icon} label={payment.name} wide />
                ))}
              </div>
            </div>

            <div style={policyPreviewStyle}>
              {activePolicyLinks.map((link) => (
                <span key={link.id} style={{ color: design.linkColor || "#ffffff" }}>{link.label}</span>
              ))}
            </div>

            <small style={previewSmallStyle}>{branding.copyrightText || "Copyright 2026 Avyona. All rights reserved."}</small>
          </footer>
        </div>
      </div>
    </div>
  );
}

function PreviewLinkColumn({ title, links, linkColor }) {
  return (
    <section style={previewColumnStyle}>
      <h4 style={previewHeadingStyle}>{title}</h4>
      {links.map((link, index) => (
        <span key={`${link.label}-${index}`} style={{ color: linkColor || "#ffffff" }}>{link.label || link.url}</span>
      ))}
    </section>
  );
}

function PreviewIcon({ src, label, wide = false }) {
  const previewUrl = resolveAdminMediaUrl(src);

  if (previewUrl) {
    return <img src={previewUrl} alt={label} title={label} style={wide ? paymentPreviewIconStyle : socialPreviewIconStyle} />;
  }

  return <span title={label} style={wide ? paymentFallbackIconStyle : socialFallbackIconStyle}>{String(label || "?").slice(0, 2).toUpperCase()}</span>;
}

const pageStyle = {
  display: "grid",
  gap: "20px"
};

const introStyle = {
  padding: "22px",
  borderRadius: "20px",
  background: "linear-gradient(135deg, #ffffff 0%, #f4fbf6 55%, #edf7ff 100%)",
  border: "1px solid rgba(203, 213, 225, 0.7)",
  boxShadow: "0 14px 34px rgba(174, 203, 190, 0.18)"
};

const eyebrowStyle = {
  color: "#0f766e",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase"
};

const titleStyle = {
  margin: "8px 0 0",
  color: "#0f172a",
  fontSize: "32px"
};

const copyStyle = {
  margin: "8px 0 0",
  color: "#526377",
  maxWidth: "760px",
  lineHeight: 1.55
};

const feedbackStyle = {
  borderRadius: "16px",
  padding: "14px 16px",
  border: "1px solid transparent",
  fontWeight: 600
};

const feedbackSuccessStyle = {
  background: "#f0fdf4",
  color: "#166534",
  borderColor: "#bbf7d0"
};

const feedbackWarningStyle = {
  background: "#fff7ed",
  color: "#c2410c",
  borderColor: "#fdba74"
};

const tabsShellStyle = {
  display: "grid",
  gap: "16px"
};

const tabsStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  padding: "14px",
  borderRadius: "18px",
  background: "#ffffff",
  border: "1px solid rgba(203, 213, 225, 0.75)",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)"
};

const tabButtonStyle = {
  minHeight: "38px",
  padding: "0 14px",
  borderRadius: "999px",
  border: "1px solid #dbe5ee",
  background: "#f8fafc",
  color: "#334155",
  fontSize: "13px",
  fontWeight: 800,
  cursor: "pointer"
};

const activeTabButtonStyle = {
  background: "linear-gradient(135deg, #0f172a 0%, #1f4336 100%)",
  color: "#ffffff",
  borderColor: "rgba(15, 23, 42, 0.12)",
  boxShadow: "0 12px 22px rgba(15, 23, 42, 0.16)"
};

const panelStyle = {
  minHeight: "260px",
  padding: "20px",
  borderRadius: "18px",
  background: "#ffffff",
  border: "1px solid rgba(203, 213, 225, 0.7)",
  boxShadow: "0 14px 34px rgba(174, 203, 190, 0.18)"
};

const brandingGridStyle = {
  display: "grid",
  gap: "18px"
};

const panelHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap"
};

const headerActionRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap"
};

const sectionTitleStyle = {
  margin: "6px 0 0",
  color: "#0f172a",
  fontSize: "22px"
};

const twoColumnGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "16px"
};

const fieldStyle = {
  display: "grid",
  gap: "8px"
};

const toggleFieldStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  color: "#0f172a",
  fontWeight: 700,
  padding: "14px",
  borderRadius: "14px",
  background: "#f8fafc",
  border: "1px solid #e5edf5"
};

const labelStyle = {
  color: "#64748b",
  fontSize: "13px",
  fontWeight: 700
};

const inputStyle = {
  width: "100%",
  minHeight: "44px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  padding: "0 14px",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "14px"
};

const textareaStyle = {
  ...inputStyle,
  padding: "12px 14px",
  minHeight: "110px",
  resize: "vertical"
};

const codeTextareaStyle = {
  ...textareaStyle,
  minHeight: "190px",
  fontFamily: "Consolas, Monaco, 'Courier New', monospace",
  lineHeight: 1.5
};

const colorFieldStyle = {
  display: "grid",
  gridTemplateColumns: "56px minmax(0, 1fr)",
  gap: "10px",
  alignItems: "center"
};

const colorInputStyle = {
  width: "56px",
  height: "44px",
  padding: "4px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  background: "#ffffff"
};

const uploadBoxStyle = {
  width: "100%",
  minHeight: "168px",
  border: "1px dashed #94a3b8",
  borderRadius: "14px",
  background: "#f8fafc",
  display: "grid",
  placeItems: "center",
  padding: "14px",
  cursor: "pointer",
  overflow: "hidden"
};

const compactUploadBoxStyle = {
  minHeight: "118px"
};

const uploadBoxActiveStyle = {
  borderColor: "#0f766e",
  background: "#f0fdfa"
};

const uploadPreviewStyle = {
  maxWidth: "100%",
  maxHeight: "138px",
  objectFit: "contain"
};

const compactUploadPreviewStyle = {
  maxWidth: "72px",
  maxHeight: "72px",
  objectFit: "contain"
};

const uploadCopyStyle = {
  display: "grid",
  gap: "4px",
  textAlign: "center",
  color: "#475569"
};

const imageActionRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px"
};

const quickLinksListStyle = {
  display: "grid",
  gap: "14px"
};

const quickLinkCardStyle = {
  display: "grid",
  gap: "12px",
  padding: "14px",
  borderRadius: "14px",
  background: "#f8fafc",
  border: "1px solid #e5edf5"
};

const quickLinkFieldsStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "12px"
};

const quickLinkActionRowStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap"
};

const socialLinkGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
  alignItems: "start"
};

const saveButtonStyle = {
  minHeight: "40px",
  padding: "0 16px",
  borderRadius: "999px",
  border: "1px solid rgba(15, 23, 42, 0.1)",
  background: "linear-gradient(135deg, #0f172a 0%, #1f4336 100%)",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer"
};

const secondaryButtonStyle = {
  minHeight: "34px",
  padding: "0 12px",
  borderRadius: "999px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 700,
  cursor: "pointer"
};

const dangerButtonStyle = {
  ...secondaryButtonStyle,
  borderColor: "#fecaca",
  color: "#991b1b",
  background: "#fff7f7"
};

const smallButtonStyle = {
  ...secondaryButtonStyle,
  minHeight: "32px",
  fontSize: "12px"
};

const statusActiveButtonStyle = {
  ...smallButtonStyle,
  borderColor: "#bbf7d0",
  color: "#166534",
  background: "#f0fdf4"
};

const activePreviewButtonStyle = {
  ...secondaryButtonStyle,
  borderColor: "#bbf7d0",
  color: "#166534",
  background: "#f0fdf4"
};

const errorStyle = {
  color: "#b91c1c",
  fontSize: "13px",
  fontWeight: 700
};

const helperTextStyle = {
  color: "#475569",
  fontSize: "13px",
  fontWeight: 600
};

const previewFrameOuterStyle = {
  display: "grid",
  justifyItems: "center",
  padding: "16px",
  borderRadius: "16px",
  background: "#eef5ef",
  border: "1px solid #dbe5ee",
  overflowX: "auto"
};

const previewFrameStyle = {
  width: "100%",
  transition: "max-width 180ms ease"
};

const footerPreviewStyle = {
  borderRadius: "16px",
  padding: "28px",
  display: "grid",
  gap: "22px",
  backgroundSize: "cover",
  backgroundPosition: "center",
  boxShadow: "0 18px 38px rgba(15, 23, 42, 0.16)",
  overflow: "hidden"
};

const footerPreviewGridStyle = {
  display: "grid",
  gridTemplateColumns: "1.4fr repeat(3, minmax(0, 1fr))",
  gap: "20px"
};

const footerPreviewMobileGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "18px"
};

const previewColumnStyle = {
  display: "grid",
  alignContent: "start",
  gap: "8px",
  minWidth: 0
};

const footerLogoPreviewStyle = {
  maxWidth: "150px",
  maxHeight: "56px",
  objectFit: "contain"
};

const previewBrandTextStyle = {
  fontSize: "22px",
  color: "inherit"
};

const previewHeadingStyle = {
  margin: 0,
  color: "inherit",
  fontSize: "15px"
};

const previewCopyStyle = {
  margin: 0,
  color: "inherit",
  opacity: 0.78,
  fontSize: "13px",
  lineHeight: 1.5
};

const previewSmallStyle = {
  color: "inherit",
  opacity: 0.68,
  fontSize: "12px",
  lineHeight: 1.45
};

const newsletterPreviewStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
  padding: "16px",
  borderRadius: "14px",
  background: "rgba(255, 255, 255, 0.08)"
};

const newsletterFormPreviewStyle = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap"
};

const newsletterInputPreviewStyle = {
  minHeight: "38px",
  minWidth: "180px",
  padding: "9px 12px",
  borderRadius: "999px",
  background: "rgba(255, 255, 255, 0.12)",
  color: "inherit",
  opacity: 0.82
};

const newsletterButtonPreviewStyle = {
  minHeight: "38px",
  padding: "9px 14px",
  borderRadius: "999px",
  color: "#ffffff",
  fontWeight: 800
};

const footerPreviewBottomStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap"
};

const iconRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap"
};

const socialPreviewIconStyle = {
  width: "32px",
  height: "32px",
  borderRadius: "999px",
  objectFit: "contain",
  background: "rgba(255, 255, 255, 0.12)",
  padding: "5px"
};

const paymentPreviewIconStyle = {
  width: "48px",
  height: "30px",
  borderRadius: "8px",
  objectFit: "contain",
  background: "rgba(255, 255, 255, 0.12)",
  padding: "5px"
};

const socialFallbackIconStyle = {
  ...socialPreviewIconStyle,
  display: "grid",
  placeItems: "center",
  fontSize: "11px",
  fontWeight: 800
};

const paymentFallbackIconStyle = {
  ...paymentPreviewIconStyle,
  display: "grid",
  placeItems: "center",
  fontSize: "10px",
  fontWeight: 800
};

const policyPreviewStyle = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  fontSize: "12px",
  fontWeight: 700
};
