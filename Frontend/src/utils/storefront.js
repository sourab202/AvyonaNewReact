export function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures.
  }
}

export function toOptimizedAssetName(value) {
  return String(value || "")
    .split("/")
    .pop()
    ?.replace(/\.[^.]+$/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "";
}

export function getOptimizedAssetPath(value) {
  if (typeof value !== "string" || !value) return value;
  if (/^(data:|https?:|blob:)/i.test(value)) return value;
  const staticImagesPrefix = "/im" + "ages/";
  if (value.includes(`${staticImagesPrefix}optimized/`)) return "";

  const normalizedValue = value.startsWith("/") ? value : `/${value}`;
  const isRasterImage = new RegExp(`^${staticImagesPrefix}.+\\.(png|jpe?g)$`, "i").test(normalizedValue);
  if (isRasterImage) return "";
  return normalizedValue;
}

export function getSiteSettings(source) {
  if (source?.siteSettings) return source.siteSettings;
  if (source?.general || source?.store || source?.payment || source?.shipping || source?.tracking) return source;
  return {};
}

export function getCurrencyConfig(source) {
  const settings = getSiteSettings(source);
  const store = settings.store || {};
  const currency = String(store.defaultCurrency || "INR").toUpperCase();
  const timezone = store.timezone || "Asia/Kolkata";
  const locale = timezone === "Asia/Kolkata" || currency === "INR" ? "en-IN" : "en-US";

  return {
    currency,
    locale
  };
}

export function formatCurrency(value, source) {
  const { currency, locale } = getCurrencyConfig(source);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function getProductVariantByKey(product, variantKey) {
  if (!product || !Array.isArray(product.variants) || !product.variants.length) return null;
  if (!variantKey) return product.variants[0] || null;
  return product.variants.find((variant) => String(variant.key) === String(variantKey)) || null;
}

export function getProductIdentifier(productOrIdentifier) {
  if (typeof productOrIdentifier === "string") return productOrIdentifier;
  return productOrIdentifier?.slug || productOrIdentifier?.asin || "";
}

export function buildProductPath(productOrSlug, variantOrKey) {
  const identifier = getProductIdentifier(productOrSlug);
  if (!identifier) return "/product";

  const variantKey = typeof variantOrKey === "string" ? variantOrKey : variantOrKey?.key;
  const encodedIdentifier = encodeURIComponent(identifier);
  const encodedVariantKey = variantKey ? encodeURIComponent(variantKey) : "";
  return encodedVariantKey ? `/product/${encodedIdentifier}/${encodedVariantKey}` : `/product/${encodedIdentifier}`;
}

export function getCheckoutPaymentMethods(source) {
  const settings = getSiteSettings(source);
  const payment = settings.payment || {};

  return [
    {
      id: "test_success",
      label: "Test Payment Success",
      description: "Simulate a successful prepaid payment for checkout testing.",
      enabled: true
    },
    {
      id: "test_failure",
      label: "Test Payment Failure",
      description: "Simulate a failed payment without reducing product stock.",
      enabled: true
    },
    {
      id: "phonepe",
      label: "PhonePe Payment Gateway",
      description: "Use UPI, debit cards, credit cards, or net banking through PhonePe.",
      enabled: Boolean(payment.phonepeEnabled)
    },
    {
      id: "razorpay",
      label: "Razorpay Secure",
      description: "Pay with UPI, domestic and international cards, wallets, and net banking with Razorpay.",
      enabled: Boolean(payment.razorpayEnabled)
    },
    {
      id: "stripe",
      label: "Stripe",
      description: "Pay using cards and supported digital payment methods through Stripe.",
      enabled: Boolean(payment.stripeEnabled)
    },
    {
      id: "cod",
      label: "Cash on Delivery",
      description: "Pay when your order arrives. Confirmation calls may be required before dispatch.",
      enabled: payment.codEnabled !== false
    }
  ].filter((method) => method.enabled);
}

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenize(value) {
  return normalizeText(value).split(/\s+/).filter(Boolean);
}

function getTokenRoot(token) {
  if (token.length <= 3) return token;
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("es") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("s") && token.length > 3) return token.slice(0, -1);
  return token;
}

function getTokenSignature(token) {
  return getTokenRoot(token)
    .replace(/ph/g, "f")
    .replace(/ght/g, "gt")
    .replace(/ck/g, "k")
    .replace(/qu/g, "kw")
    .replace(/tion/g, "shun")
    .replace(/([a-z])\1+/g, "$1")
    .replace(/[aeiou]/g, "");
}

function getEditDistance(left, right) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const rows = Array.from({ length: left.length + 1 }, (_, row) => [row]);
  for (let column = 0; column <= right.length; column += 1) rows[0][column] = column;
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + cost
      );
    }
  }
  return rows[left.length][right.length];
}

function isLooseTokenMatch(queryToken, candidateToken) {
  if (queryToken === candidateToken) return true;
  const queryRoot = getTokenRoot(queryToken);
  const candidateRoot = getTokenRoot(candidateToken);
  const querySignature = getTokenSignature(queryToken);
  const candidateSignature = getTokenSignature(candidateToken);
  if (queryRoot === candidateRoot || (querySignature && querySignature === candidateSignature)) return true;
  if (queryToken.length >= 4 && candidateToken.includes(queryToken)) return true;
  if (candidateToken.length >= 4 && queryToken.includes(candidateToken)) return true;
  if (getEditDistance(queryRoot, candidateRoot) <= (queryToken.length >= 7 || candidateToken.length >= 7 ? 2 : 1)) return true;
  return getEditDistance(querySignature, candidateSignature) <= 2;
}

function getProductSearchText(product) {
  const specText = (product.specGroups || []).flatMap((group) => [group.title, ...group.items.flat()]).join(" ");
  return normalizeText([
    product.name,
    product.brand,
    product.category,
    product.collectionSlug,
    product.sku,
    product.asin,
    ...(product.highlights || []),
    ...(product.description || []),
    specText
  ].join(" "));
}

function scoreProduct(product, query) {
  const normalizedQuery = normalizeText(query);
  const tokens = tokenize(query);
  const searchableText = getProductSearchText(product);
  const searchableTokens = tokenize(searchableText);
  if (!normalizedQuery) return Math.round(product.rating * 10) + Number(product.reviewCount || 0);
  let score = 0;
  if (normalizeText(product.name) === normalizedQuery) score += 180;
  if (normalizeText(product.brand) === normalizedQuery) score += 110;
  if (normalizeText(product.category) === normalizedQuery) score += 100;
  if (normalizeText(product.name).includes(normalizedQuery)) score += 120;
  if (searchableText.includes(normalizedQuery)) score += 45;
  tokens.forEach((token) => {
    if (searchableTokens.some((candidate) => isLooseTokenMatch(token, candidate))) score += 12;
    if (normalizeText(product.name).includes(token)) score += 22;
    if (normalizeText(product.brand).includes(token)) score += 16;
    if (normalizeText(product.category).includes(token)) score += 12;
  });
  return score + Math.round(Number(product.rating || 0) * 4);
}

function isQueryMatch(product, query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;
  const tokens = tokenize(query);
  const searchableTokens = tokenize(getProductSearchText(product));
  return tokens.every((token) => searchableTokens.some((candidate) => isLooseTokenMatch(token, candidate)));
}

export function getSearchResults(allProducts, query) {
  return allProducts
    .map((product) => ({ product, score: scoreProduct(product, query) }))
    .filter((entry) => isQueryMatch(entry.product, query))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.product.rating !== left.product.rating) return right.product.rating - left.product.rating;
      return Number(right.product.reviewCount || 0) - Number(left.product.reviewCount || 0);
    });
}

export function getSuggestionEntries(allProducts) {
  const entries = new Map();

  allProducts.forEach((product) => {
    [
      { label: product.name, type: "Product" },
      { label: product.category, type: "Category" },
      { label: product.brand, type: "Brand" },
      { label: product.asin, type: "ASIN" },
      { label: `${product.brand} ${product.category}`, type: "Search" }
    ].forEach((entry) => {
      entries.set(`${entry.type}:${entry.label}`, {
        ...entry,
        tokens: tokenize(entry.label)
      });
    });
  });

  return [...entries.values()];
}

export function getSuggestionScore(query, entry) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return 0;

  const queryTokens = tokenize(query);
  const labelText = normalizeText(entry.label);
  let score = 0;

  if (labelText === normalizedQuery) score += 180;
  if (labelText.includes(normalizedQuery)) score += 90;

  queryTokens.forEach((token) => {
    if (entry.tokens.some((candidate) => isLooseTokenMatch(token, candidate))) score += 35;
    if (labelText.includes(token)) score += 10;
  });

  if (entry.type === "Product") score += 8;
  if (entry.type === "Category") score += 5;

  return score;
}

export function getInitials(name) {
  return String(name || "A")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "A";
}

export function createInitialAvatar(name) {
  const initials = getInitials(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#5db467"/><stop offset="100%" stop-color="#4a9d54"/></linearGradient></defs><rect width="240" height="240" rx="120" fill="url(#g)"/><text x="50%" y="54%" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="88" font-weight="700" fill="#ffffff">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function compressImageFile(file, maxDimension = 900, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const canvasContext = canvas.getContext("2d");

      if (!canvasContext) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Canvas not supported"));
        return;
      }

      canvasContext.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image load failed"));
    };

    image.src = objectUrl;
  });
}

export function getReviewStorageKey(slug) {
  return `avyonaReviews:${slug}`;
}

export function getMergedProfile(authUser, customerProfile) {
  const firstName = String(customerProfile.firstName || "").trim();
  const lastName = String(customerProfile.lastName || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || authUser?.fullName || "Avyona Customer";
  const businessDetails = customerProfile.businessDetails || authUser?.businessDetails || {};
  const businessName = customerProfile.businessName || businessDetails.businessName || authUser?.businessName || "";
  const gstNumber = customerProfile.gstNumber || businessDetails.gstNumber || authUser?.gstNumber || "";
  const isBusinessAccount = Boolean(customerProfile.isBusinessAccount || businessDetails.isBusinessAccount || authUser?.isBusinessAccount || businessName || gstNumber);
  return {
    fullName,
    email: customerProfile.email || authUser?.email || "",
    mobile: customerProfile.phone || authUser?.mobile || "",
    address: customerProfile.address || "",
    image: customerProfile.image || createInitialAvatar(fullName),
    businessDetails: { isBusinessAccount, businessName, gstNumber },
    isBusinessAccount,
    businessName,
    gstNumber
  };
}

export function copyText(value, onSuccess) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(value).then(onSuccess).catch(() => {});
    return;
  }
  const input = document.createElement("input");
  input.value = value;
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  document.body.removeChild(input);
  onSuccess();
}
