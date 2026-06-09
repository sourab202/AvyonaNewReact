export const DEFAULT_APP_SETTINGS = {
  general: {
    storeName: "Avyona",
    logoUrl: "",
    faviconUrl: "",
    brandTagline: "Style that moves with you",
    businessLegalName: "Avyona",
    supportEmail: "support@avyona.com",
    supportPhone: "+91 98765 43210",
    businessAddress: "Bengaluru, Karnataka, India",
    gstNumber: "29ABCDE1234F1Z5",
    workingHours: "Monday to Saturday, 10:00 AM to 7:00 PM"
  },
  contactPage: {
    enabled: true,
    heroTitle: "Contact Us",
    heroLineOne: "Need help with an order or business enquiry?",
    heroLineTwo: "We're here to help.",
    sectionTitle: "How can we help you?",
    heroIcons: {
      left: { enabled: true, builtin: "leaf", imageUrl: "", size: 124, color: "#1f7a34" },
      right: { enabled: true, builtin: "headset", imageUrl: "", size: 150, color: "#1f2937" }
    },
    enquiryTypes: [
      {
        key: "b2c",
        label: "B2C",
        title: "Customer Support",
        description: "Order help, returns, warranty, delivery support.",
        buttonText: "Continue",
        iconBuiltin: "headset",
        iconUrl: "",
        iconSize: 44,
        iconColor: "#1479b8",
        iconBackground: "#eaf5ff",
        showIcon: true,
        enabled: true
      },
      {
        key: "b2b",
        label: "B2B",
        title: "Business Enquiry",
        description: "Bulk orders, dealership, partnerships, corporate enquiries.",
        buttonText: "Continue",
        iconBuiltin: "briefcase",
        iconUrl: "",
        iconSize: 44,
        iconColor: "#155aa8",
        iconBackground: "#dcefff",
        showIcon: true,
        enabled: true
      }
    ],
    formIntro: "Fill in the details below and our team will get back to you.",
    fullNamePlaceholder: "Full Name *",
    companyNamePlaceholder: "Company Name *",
    emailPlaceholder: "Email Address *",
    phonePlaceholder: "Phone Number *",
    orderIdPlaceholder: "Order ID (Optional)",
    messagePlaceholder: "Message *",
    submitButtonText: "Submit Enquiry",
    submittingButtonText: "Submitting...",
    successMessage: "Thank you. Our team will contact you shortly.",
    errorMessage: "Unable to submit contact enquiry",
    details: {
      emailLabel: "Email Us",
      phoneLabel: "Call Us",
      hoursLabel: "Working Hours",
      addressLabel: "Our Address",
      emptyPhoneText: "Phone support coming soon",
      showEmail: true,
      showPhone: true,
      showHours: true,
      showAddress: true,
      icons: {
        email: { builtin: "envelope", imageUrl: "", size: 18, color: "#18794e", background: "#eaf7ee", showIcon: true },
        phone: { builtin: "phone", imageUrl: "", size: 18, color: "#18794e", background: "#eaf7ee", showIcon: true },
        hours: { builtin: "clock", imageUrl: "", size: 18, color: "#18794e", background: "#eaf7ee", showIcon: true },
        address: { builtin: "location", imageUrl: "", size: 18, color: "#18794e", background: "#eaf7ee", showIcon: true }
      }
    },
    trustItems: [
      { key: "fast-response", label: "Fast Response", iconBuiltin: "bolt", iconUrl: "", iconSize: 18, iconColor: "#16a34a", enabled: true, showIcon: true },
      { key: "secure-safe", label: "Secure & Safe", iconBuiltin: "lock", iconUrl: "", iconSize: 18, iconColor: "#16a34a", enabled: true, showIcon: true },
      { key: "privacy", label: "100% Privacy", iconBuiltin: "shield", iconUrl: "", iconSize: 18, iconColor: "#16a34a", enabled: true, showIcon: true },
      { key: "customer-first", label: "Customer First", iconBuiltin: "heart", iconUrl: "", iconSize: 18, iconColor: "#16a34a", enabled: true, showIcon: true }
    ],
    design: {
      customerAccent: "#198754",
      customerAccentDark: "#146c43",
      customerAccentSoft: "#eef9f0",
      businessAccent: "#1f8fce",
      businessAccentDark: "#1479b8",
      businessAccentSoft: "#eef7ff",
      pageBackground: "#ffffff",
      heroBackground: "#f7fbf8",
      surfaceColor: "#ffffff",
      textColor: "#111827",
      mutedTextColor: "#52606b",
      borderColor: "#cbd5e1",
      trustBackground: "#f8faf9",
      cardRadius: 12,
      inputRadius: 6,
      contentMaxWidth: 980,
      sectionGap: 32,
      headingFontSize: 56,
      mobileHeadingFontSize: 35
    },
    customCss: ""
  },
  store: {
    defaultCurrency: "INR",
    currencyFormat: "INR 1,999.00",
    taxInclusion: "inclusive",
    defaultLanguage: "English",
    timezone: "Asia/Kolkata",
    guestCheckoutEnabled: true,
    accountCreationEnabled: true
  },
  payment: {
    codEnabled: true,
    razorpayEnabled: true,
    stripeEnabled: false,
    upiWalletEnabled: true,
    paymentSuccessRule: "Mark order as confirmed after gateway success",
    paymentFailureHandling: "Retry allowed and order kept pending",
    refundSettings: "Manual review before refund approval"
  },
  shipping: {
    deliveryZones: "India-wide with metro priority zones",
    deliveryTime: "3 to 5 business days",
    dispatchTime: "24 to 48 hours",
    pincodeServiceability: "Enabled for supported pin codes"
  },
  tracking: {
    orderStatusFlow: "Pending to Delivered with return states",
    trackingPageEnabled: true,
    defaultStatusMessages: "Shown on public tracking timeline",
    expectedDeliveryLogic: "Calculated from dispatch and shipping settings",
    autoStatusUpdates: false,
    orderIdIsTrackingId: true,
    orderIdPrefix: "AVY",
    orderIdFormatLogic: "Prefix plus numeric sequence, for example AVY12345"
  },
  notifications: {
    orderPlacedEmailEnabled: true,
    orderShippedEmailEnabled: true,
    orderDeliveredEmailEnabled: true,
    whatsappNotificationsEnabled: false,
    smsNotificationsEnabled: false,
    newOrderAlertEnabled: true,
    lowStockAlertEnabled: true
  },
  security: {
    superAdminEnabled: true,
    staffRoleEnabled: true,
    productsAccess: "Configurable by role",
    ordersAccess: "Configurable by role",
    settingsAccess: "Restricted to Super Admin",
    passwordRules: "Strong password policy required",
    sessionTimeout: "30 minutes of inactivity"
  },
  whatsapp: {
    enabled: false,
    number: "+919876543210",
    defaultMessage: "Hi Avyona, I need help.",
    productMessage: "Hi Avyona, I need help with this product: {{productName}} - {{productUrl}}",
    orderMessage: "Hi Avyona, I need help with my order: {{orderId}}",
    position: "bottom-right",
    iconUrl: "",
    buttonColor: "#25D366",
    iconSize: 28,
    hoverText: "Need Help? Chat with us",
    showMobile: true,
    showDesktop: true,
    showAllPages: true,
    hideCheckout: false,
    hideOrderConfirmation: false,
    hideAdmin: true
  },
  header: {
    logoWidth: 150,
    logoHeight: 30,
    logoMaxWidth: 180,
    brandTextSize: 24,
    headerBackground: "#FFFFFF",
    headerTextColor: "#111827",
    headerBorderColor: "#E5E7EB",
    headerShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
    headerTopPadding: 24,
    headerBottomPadding: 22,
    headerGap: 28,
    searchMaxWidth: 760,
    searchHeight: 42,
    searchRadius: 999,
    searchBackground: "#FFFFFF",
    searchTextColor: "#111827",
    searchBorderColor: "#E5E7EB",
    searchPlaceholder: "Search products, brands, ASIN, SKU, features",
    searchIconText: "⌕",
    searchIconSize: 14,
    searchIconColor: "#6B7280",
    utilityGap: 12,
    accountText: "Sign In",
    showAccountText: false,
    accountIconSize: 17,
    accountButtonSize: 38,
    accountColor: "#111827",
    accountBackground: "#FFFFFF",
    accountRadius: 999,
    wishlistIconSize: 17,
    wishlistButtonSize: 38,
    wishlistColor: "#111827",
    wishlistBackground: "#FFFFFF",
    wishlistRadius: 999,
    cartText: "Cart",
    showCartText: false,
    cartIconSize: 17,
    cartButtonHeight: 30,
    cartButtonPaddingX: 10,
    cartBackground: "#22C55E",
    cartTextColor: "#FFFFFF",
    cartRadius: 8,
    cartBadgeBackground: "#FFFFFF",
    cartBadgeTextColor: "#16A34A"
  },
  theme: {
    colors: {
      primaryColor: "#22C55E",
      secondaryColor: "#111827",
      accentColor: "#16A34A",
      backgroundColor: "#F6FAF7",
      surfaceColor: "#FFFFFF",
      textColor: "#111827",
      mutedTextColor: "#6B7280",
      borderColor: "#E5E7EB",
      successColor: "#22C55E",
      errorColor: "#EF4444"
    },
    typography: {
      fontFamily: "Inter",
      baseFontSize: 16,
      headingFontWeight: 800,
      bodyFontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: 0
    },
    buttons: {
      primaryBackground: "#22C55E",
      primaryTextColor: "#FFFFFF",
      secondaryBackground: "#FFFFFF",
      secondaryTextColor: "#16A34A",
      borderRadius: 12,
      height: 42,
      fontWeight: 800,
      hoverStyle: "darken"
    },
    cards: {
      background: "#FFFFFF",
      borderRadius: 18,
      borderColor: "#E5E7EB",
      shadowStyle: "soft",
      padding: 16
    },
    layout: {
      websiteMaxWidth: 1280,
      sectionPaddingDesktop: 64,
      sectionPaddingMobile: 28,
      sectionGap: 32,
      containerRadius: 14,
      mobileCompactMode: false
    },
    productCards: {
      imageRatio: "1:1",
      showDiscountBadge: true,
      showRating: true,
      showAddToCartButton: true,
      borderRadius: 18,
      shadowStyle: "soft",
      titleLines: 2,
      priceColor: "#111827",
      mrpColor: "#9CA3AF"
    },
    customCss: {
      css: ""
    }
  },
  footer: {
    branding: {
      footerLogo: "",
      backgroundWatermarkImage: "",
      tagline: "Style that moves with you",
      description: "Curated premium electronic products from trusted domestic and global imported brands.",
      copyrightText: "Copyright 2026 Avyona. All rights reserved."
    },
    quickLinks: [
      { id: "quick-home", label: "Home", url: "/", sortOrder: 1, status: "active" },
      { id: "quick-about", label: "About", url: "/about", sortOrder: 2, status: "active" },
      { id: "quick-products", label: "Products", url: "/collections", sortOrder: 3, status: "active" },
      { id: "quick-photo-frame", label: "Photo Frame", url: "/category/digital-photo-frames", sortOrder: 4, status: "active" },
      { id: "quick-audio", label: "Audio", url: "/category/personal-audio", sortOrder: 5, status: "active" },
      { id: "quick-camera", label: "Camera", url: "/category/digital-camera", sortOrder: 6, status: "active" },
      { id: "quick-reading-light", label: "Reading Light", url: "/category/reading-light", sortOrder: 7, status: "active" },
      { id: "quick-contact-us", label: "Contact Us", url: "/contact-us", sortOrder: 8, status: "active" }
    ],
    faqLinks: [
      { id: "faq-orders", questionText: "How do I track my order?", answer: "Use the Track Order page with your order number to view the latest order status.", url: "/track-order", sortOrder: 1, status: "active" },
      { id: "faq-shipping", questionText: "What are the shipping timelines?", answer: "Most eligible orders are dispatched within 24 to 48 hours and delivered in 3 to 5 business days.", url: "/checkout", sortOrder: 2, status: "active" },
      { id: "faq-returns", questionText: "How do returns work?", answer: "Return and exchange requests are reviewed by support based on the product condition and applicable policy.", url: "/checkout", sortOrder: 3, status: "active" },
      { id: "faq-support", questionText: "How can I contact support?", answer: "Email or call our support team during working hours and we will help with product or order questions.", url: "/contact-us", sortOrder: 4, status: "active" }
    ],
    support: {
      sectionTitle: "Support",
      emailLabel: "Email",
      supportEmail: "support@avyona.com",
      emailHelpText: "We usually respond within one business day.",
      phoneLabel: "Phone",
      supportPhone: "+91 98765 43210",
      phoneHelpText: "Call us for order and product support.",
      workingHours: "Monday to Saturday, 10:00 AM to 7:00 PM"
    },
    newsletter: {
      enabled: true,
      title: "Stay Updated",
      emailPlaceholder: "Enter your email",
      buttonText: "Subscribe",
      description: "Get offers, product launches, and helpful buying guides from Avyona.",
      successMessage: "Thank you for subscribing."
    },
    socialLinks: [
      { id: "social-facebook", name: "Facebook", url: "https://facebook.com", icon: "", sortOrder: 1, status: "active" },
      { id: "social-instagram", name: "Instagram", url: "https://instagram.com", icon: "", sortOrder: 2, status: "active" },
      { id: "social-youtube", name: "YouTube", url: "https://youtube.com", icon: "", sortOrder: 3, status: "active" }
    ],
    paymentIcons: [
      { id: "payment-visa", name: "Visa", icon: "", sortOrder: 1, status: "active" },
      { id: "payment-mastercard", name: "Mastercard", icon: "", sortOrder: 2, status: "active" },
      { id: "payment-upi", name: "UPI", icon: "", sortOrder: 3, status: "active" },
      { id: "payment-cod", name: "Cash on Delivery", icon: "", sortOrder: 4, status: "active" }
    ],
    policyLinks: [
      { id: "policy-terms", label: "Terms & Conditions", url: "/terms-and-conditions", sortOrder: 1, status: "active" },
      { id: "policy-privacy", label: "Privacy Policy", url: "/privacy-policy", sortOrder: 2, status: "active" },
      { id: "policy-refund", label: "Refund Policy", url: "/refund-policy", sortOrder: 3, status: "active" },
      { id: "policy-shipping", label: "Shipping Policy", url: "/shipping-policy", sortOrder: 4, status: "active" },
      { id: "policy-warranty", label: "Warranty Policy", url: "/warranty-policy", sortOrder: 5, status: "active" }
    ],
    design: {
      backgroundColor: "#0f172a",
      textColor: "#f8fafc",
      accentColor: "#5db467",
      linkColor: "#ffffff",
      layoutStyle: "columns",
      customCss: ""
    }
  },
  thankYouPage: {
    successTitle: "Thank you for your order",
    successSubtitle: "Your order has been placed successfully.",
    confirmationLabel: "ORDER CONFIRMED",
    useCustomIcon: false,
    customIconUrl: "",
    showThankYouMessage: true,
    showTrackOrderButton: true,
    trackOrderButtonText: "Track Order",
    trackOrderButtonStyle: "primary",
    showContinueShoppingButton: true,
    continueShoppingButtonText: "Continue Shopping",
    continueShoppingButtonStyle: "secondary",
    showDownloadInvoiceButton: false,
    downloadInvoiceButtonText: "Download Invoice",
    downloadInvoiceButtonStyle: "secondary"
  },
  invoiceDesigner: {
    showLogo: true,
    logoSource: "",
    businessName: "",
    address: "",
    supportPhone: "",
    supportEmail: "",
    gstNumber: "",
    footerThankYouNote: "Thank you for shopping with us!",
    computerGeneratedNote: "Computer-generated invoice. No signature required.",
    supportContactNote: "",
    websiteUrl: "",
    showWatermark: true,
    watermarkUrl: "",
    showQrCode: true,
    qrCodeUrl: "",
    bottomNoteText: "",
    showCreditPoints: true,
    showFooterNote: true
  },
  homepage: {
    heroBanners: [
      {
        id: "hero-1",
        mediaType: "image",
        desktopImage: "",
        mobileImage: "",
        desktopVideo: "",
        mobileVideo: "",
        altText: "Avyona featured electronics collection",
        title: "Shop Avyona Favorites",
        subtitle: "Discover audio, cameras, frames, and smart essentials selected for everyday use.",
        textEnabled: true,
        titleFontSize: 56,
        subtitleFontSize: 17,
        fontFamily: "Montserrat",
        fontStyle: "normal",
        fontWeight: "800",
        ctaEnabled: true,
        buttonText: "View All Collections",
        buttonLink: "/collections",
        status: "active",
        sortOrder: 1
      },
      {
        id: "hero-2",
        mediaType: "image",
        desktopImage: "",
        mobileImage: "",
        desktopVideo: "",
        mobileVideo: "",
        altText: "Avyona setup upgrade banner",
        title: "Upgrade Your Setup",
        subtitle: "Explore trusted electronics for work, travel, gifting, and home.",
        textEnabled: true,
        titleFontSize: 56,
        subtitleFontSize: 17,
        fontFamily: "Montserrat",
        fontStyle: "normal",
        fontWeight: "800",
        ctaEnabled: true,
        buttonText: "Shop Now",
        buttonLink: "/collections",
        status: "active",
        sortOrder: 2
      },
      {
        id: "hero-3",
        mediaType: "image",
        desktopImage: "",
        mobileImage: "",
        desktopVideo: "",
        mobileVideo: "",
        altText: "Fresh Avyona product picks",
        title: "Fresh Picks Are Here",
        subtitle: "Find new arrivals and popular products in one easy storefront.",
        textEnabled: true,
        titleFontSize: 56,
        subtitleFontSize: 17,
        fontFamily: "Montserrat",
        fontStyle: "normal",
        fontWeight: "800",
        ctaEnabled: true,
        buttonText: "Explore Products",
        buttonLink: "/collections",
        status: "active",
        sortOrder: 3
      }
    ],
    globalHeroCta: {
      enabled: false,
      buttonText: "Shop Now",
      buttonLink: "/collections"
    },
    browseCategoriesSettings: {
      enabled: true,
      title: "Shop by Category",
      subtitle: "",
      cardsPerRow: 4,
      mobileCardsPerRow: 1,
      sortOrder: 10
    },
    ourProductsSettings: {
      enabled: true,
      title: "Our Products",
      subtitle: "",
      cardsPerRow: 4,
      mobileCardsPerRow: 2,
      buttonDisplayType: "both",
      sortOrder: 20
    },
    bestSellerProductsSettings: {
      enabled: true,
      title: "Best Sellers and Trending",
      subtitle: "",
      cardsPerRow: 4,
      mobileCardsPerRow: 2,
      buttonDisplayType: "both",
      sortOrder: 40
    },
    newArrivalProductsSettings: {
      enabled: true,
      title: "New Arrivals",
      subtitle: "",
      cardsPerRow: 3,
      mobileCardsPerRow: 2,
      buttonDisplayType: "both",
      sortOrder: 60
    },
    featuredBrandsSettings: {
      enabled: true,
      title: "Featured Brands",
      subtitle: "",
      cardsPerRow: 6,
      mobileCardsPerRow: 2,
      sortOrder: 80
    },
    whyShopSettings: {
      enabled: true,
      title: "Why Shop With Avyona",
      subtitle: "Trust Avyona for genuine products, flexible payments, secure checkout, and quick delivery.",
      cardsPerRow: 4,
      mobileCardsPerRow: 1,
      sortOrder: 82,
      backgroundColor: "#f8fafc",
      textColor: "#0f172a",
      customCss: ""
    },
    productPaymentIconsSettings: {
      enabled: true,
      title: "Payment Options",
      subtitle: "Secure payment methods available",
      cardsPerRow: 7,
      mobileCardsPerRow: 3,
      sortOrder: 20,
      backgroundColor: "#ffffff",
      textColor: "#0f172a",
      customCss: ""
    },
    newsletterSettings: {
      enabled: true,
      title: "Stay Updated",
      subtitle: "Get offers, product launches, and helpful buying guides from Avyona.",
      cardsPerRow: 1,
      mobileCardsPerRow: 1,
      sortOrder: 90
    },
    blogPostsSettings: {
      enabled: true,
      title: "Blog",
      subtitle: "Buying guides and electronics insights that support discovery",
      cardsPerRow: 3,
      tabletCardsPerRow: 2,
      mobileCardsPerRow: 1,
      sortOrder: 85
    },
    creditPointsSettings: {
      enabled: true,
      title: "Credit Points",
      subtitle: "Shop, earn, and save. Every purchase brings you closer to cashback rewards.",
      cardsPerRow: 4,
      mobileCardsPerRow: 1,
      sortOrder: 35
    },
    browseCategories: [],
    browseCategoryCardCount: 6,
    ourProducts: [],
    bestSellerCategories: [
      "personal-audio",
      "professional-audio",
      "digital-camera",
      "security-camera",
      "digital-photo-frames",
      "reading-light"
    ],
    bestSellerProducts: [],
    newArrivalProducts: [],
    featuredBrands: [],
    productPaymentIcons: [
      {
        id: "payment-icon-visa",
        paymentName: "Visa",
        iconUrl: "",
        altText: "Visa payment option",
        iconSize: 44,
        iconBackgroundColor: "#ffffff",
        iconBorderColor: "#e5e7eb",
        iconRadius: 14,
        sortOrder: 1,
        status: "active"
      },
      {
        id: "payment-icon-mastercard",
        paymentName: "Mastercard",
        iconUrl: "",
        altText: "Mastercard payment option",
        iconSize: 44,
        iconBackgroundColor: "#ffffff",
        iconBorderColor: "#e5e7eb",
        iconRadius: 14,
        sortOrder: 2,
        status: "active"
      },
      {
        id: "payment-icon-upi",
        paymentName: "UPI",
        iconUrl: "",
        altText: "UPI payment option",
        iconSize: 44,
        iconBackgroundColor: "#ffffff",
        iconBorderColor: "#e5e7eb",
        iconRadius: 14,
        sortOrder: 3,
        status: "active"
      },
      {
        id: "payment-icon-google-pay",
        paymentName: "Google Pay",
        iconUrl: "",
        altText: "Google Pay payment option",
        iconSize: 44,
        iconBackgroundColor: "#ffffff",
        iconBorderColor: "#e5e7eb",
        iconRadius: 14,
        sortOrder: 4,
        status: "active"
      },
      {
        id: "payment-icon-phonepe",
        paymentName: "PhonePe",
        iconUrl: "",
        altText: "PhonePe payment option",
        iconSize: 44,
        iconBackgroundColor: "#ffffff",
        iconBorderColor: "#e5e7eb",
        iconRadius: 14,
        sortOrder: 5,
        status: "active"
      },
      {
        id: "payment-icon-cod",
        paymentName: "COD",
        iconUrl: "",
        altText: "Cash on Delivery payment option",
        iconSize: 44,
        iconBackgroundColor: "#ffffff",
        iconBorderColor: "#e5e7eb",
        iconRadius: 14,
        sortOrder: 6,
        status: "active"
      },
      {
        id: "payment-icon-razorpay",
        paymentName: "Razorpay",
        iconUrl: "",
        altText: "Razorpay payment option",
        iconSize: 44,
        iconBackgroundColor: "#ffffff",
        iconBorderColor: "#e5e7eb",
        iconRadius: 14,
        sortOrder: 7,
        status: "active"
      }
    ],
    whyShopItems: [
      {
        id: "why-shop-genuine-products",
        iconUrl: "",
        iconPosition: "left",
        iconSize: 42,
        title: "Genuine Products",
        titleFontSize: 18,
        textColor: "#0f172a",
        cardBackgroundColor: "#ffffff",
        cardBorderColor: "#e5e7eb",
        cardRadius: 16,
        sortOrder: 1,
        status: "active"
      },
      {
        id: "why-shop-cod-available",
        iconUrl: "",
        iconPosition: "left",
        iconSize: 42,
        title: "COD Available",
        titleFontSize: 18,
        textColor: "#0f172a",
        cardBackgroundColor: "#ffffff",
        cardBorderColor: "#e5e7eb",
        cardRadius: 16,
        sortOrder: 2,
        status: "active"
      },
      {
        id: "why-shop-secure-payments",
        iconUrl: "",
        iconPosition: "left",
        iconSize: 42,
        title: "Secure Payments",
        titleFontSize: 18,
        textColor: "#0f172a",
        cardBackgroundColor: "#ffffff",
        cardBorderColor: "#e5e7eb",
        cardRadius: 16,
        sortOrder: 3,
        status: "active"
      },
      {
        id: "why-shop-fast-shipping",
        iconUrl: "",
        iconPosition: "left",
        iconSize: 42,
        title: "Fast Shipping",
        titleFontSize: 18,
        textColor: "#0f172a",
        cardBackgroundColor: "#ffffff",
        cardBorderColor: "#e5e7eb",
        cardRadius: 16,
        sortOrder: 4,
        status: "active"
      }
    ]
  }
};

export const SETTINGS_SECTIONS = [
  {
    id: "general",
    label: "General Settings",
    description: "Control the core brand identity that flows from admin settings into the website, checkout, emails, and invoices.",
    impact: {
      eyebrow: "Branding Impact",
      title: "Admin branding settings should stay consistent everywhere customers see your brand.",
      description: "These values connect dashboard settings to the storefront identity, checkout trust signals, transactional communication, and invoice documents.",
      items: ["Website header and footer", "Checkout page", "Customer emails", "Invoices"]
    },
    groups: [
      {
        title: "Brand Assets",
        fields: [
          { key: "general.storeName", label: "Store Name", type: "text" },
          { key: "general.logoUrl", label: "Store Logo", type: "text" },
          { key: "general.faviconUrl", label: "Favicon", type: "text" },
          { key: "general.brandTagline", label: "Brand Tagline", type: "text" }
        ]
      },
      {
        title: "Business Details",
        fields: [
          { key: "general.businessLegalName", label: "Business / Legal Name", type: "text" },
          { key: "general.supportEmail", label: "Support Email", type: "email" },
          { key: "general.supportPhone", label: "Support Phone", type: "text" },
          { key: "general.businessAddress", label: "Business Address", type: "textarea" },
          { key: "general.gstNumber", label: "GST Number", type: "text" },
          { key: "general.workingHours", label: "Working Hours", type: "textarea" }
        ]
      }
    ]
  },
  {
    id: "store",
    label: "Store Settings",
    description: "Manage the core ecommerce behavior that controls pricing display, checkout rules, and order flow.",
    impact: {
      eyebrow: "Commerce Impact",
      title: "Store settings shape how prices appear and how customers move through checkout.",
      description: "These controls define currency presentation, tax visibility, regional defaults, and whether customers can place orders as guests or create accounts during checkout.",
      items: ["Pricing display", "Checkout behavior", "Order flow"]
    },
    groups: [
      {
        title: "Regional Commerce Defaults",
        fields: [
          { key: "store.defaultCurrency", label: "Default Currency", type: "text" },
          { key: "store.currencyFormat", label: "Currency Format", type: "text" },
          {
            key: "store.taxInclusion",
            label: "Tax Inclusion",
            type: "select",
            options: [
              { label: "Inclusive pricing", value: "inclusive" },
              { label: "Exclusive pricing", value: "exclusive" }
            ]
          },
          { key: "store.defaultLanguage", label: "Default Language", type: "text" },
          { key: "store.timezone", label: "Timezone", type: "text" }
        ]
      },
      {
        title: "Checkout & Account Rules",
        fields: [
          { key: "store.guestCheckoutEnabled", label: "Guest Checkout", type: "boolean" },
          { key: "store.accountCreationEnabled", label: "Account Creation", type: "boolean" }
        ]
      }
    ]
  },
  {
    id: "payment",
    label: "Payment Settings",
    description: "Control revenue-critical payment methods, payment outcomes, and refund behavior across checkout and backend order processing.",
    impact: {
      eyebrow: "Revenue Impact",
      title: "Payment settings connect admin controls to checkout options, backend transaction handling, and order status logic.",
      description: "This module determines which payment methods appear to customers, how successful and failed payments are treated, and how refunds should move through the system.",
      items: ["Checkout page", "Payment options shown to users", "Order status updates"]
    },
    groups: [
      {
        title: "Payment Methods",
        fields: [
          { key: "payment.codEnabled", label: "Cash on Delivery", type: "boolean" },
          { key: "payment.razorpayEnabled", label: "Razorpay", type: "boolean" },
          { key: "payment.stripeEnabled", label: "Stripe", type: "boolean" },
          { key: "payment.upiWalletEnabled", label: "UPI / Wallet", type: "boolean" }
        ]
      },
      {
        title: "Transaction Rules",
        fields: [
          { key: "payment.paymentSuccessRule", label: "Payment Success Rule", type: "textarea" },
          { key: "payment.paymentFailureHandling", label: "Payment Failure Handling", type: "textarea" },
          { key: "payment.refundSettings", label: "Refund Settings", type: "textarea" }
        ]
      }
    ]
  },
  {
    id: "shipping",
    label: "Shipping & Delivery",
    description: "Control logistics rules, delivery promises, and serviceability details that shape checkout and tracking expectations.",
    impact: {
      eyebrow: "Delivery Impact",
      title: "Shipping settings define what customers see before purchase and what the business promises after checkout.",
      description: "This module controls free-shipping messaging, zone coverage, dispatch speed, and expected delivery timing used across the storefront and tracking flow.",
      items: ["Product page delivery info", "Checkout delivery calculation", "Track order expected delivery"]
    },
    groups: [
      {
        title: "Free Shipping & Delivery",
        fields: [
          { key: "shipping.deliveryZones", label: "Delivery Zones", type: "textarea" },
          { key: "shipping.deliveryTime", label: "Delivery Time", type: "text" }
        ]
      },
      {
        title: "Fulfillment Operations",
        fields: [
          { key: "shipping.dispatchTime", label: "Dispatch Time", type: "text" },
          { key: "shipping.pincodeServiceability", label: "Pincode Serviceability", type: "textarea" }
        ]
      }
    ]
  },
  {
    id: "tracking",
    label: "Order & Tracking Settings",
    description: "Control the tracking engine used by admin and the public track order page, including status flow, delivery logic, and order ID rules.",
    impact: {
      eyebrow: "Tracking Impact",
      title: "This module is the control center for how orders are identified, updated, and tracked by customers.",
      description: "Since order ID and tracking ID are the same in this system, these settings affect admin order management, the public tracking page, delivery expectations, and overall customer confidence.",
      items: ["Admin dashboard", "Track order page", "Customer experience"]
    },
    groups: [
      {
        title: "Tracking Flow",
        fields: [
          { key: "tracking.orderStatusFlow", label: "Order Status Flow", type: "textarea" },
          { key: "tracking.trackingPageEnabled", label: "Tracking Page", type: "boolean" },
          { key: "tracking.defaultStatusMessages", label: "Default Status Messages", type: "textarea" },
          { key: "tracking.autoStatusUpdates", label: "Auto Status Updates", type: "boolean" }
        ]
      },
      {
        title: "Delivery & Tracking ID Logic",
        fields: [
          { key: "tracking.expectedDeliveryLogic", label: "Expected Delivery Logic", type: "textarea" },
          { key: "tracking.orderIdIsTrackingId", label: "Order ID = Tracking ID", type: "boolean" },
          { key: "tracking.orderIdPrefix", label: "Order ID Prefix", type: "text" },
          { key: "tracking.orderIdFormatLogic", label: "Order ID Format Logic", type: "textarea" }
        ]
      }
    ]
  },
  {
    id: "notifications",
    label: "Notification Settings",
    description: "Control customer communication and admin alerting across email, WhatsApp, SMS, and dashboard updates.",
    impact: {
      eyebrow: "Communication Impact",
      title: "Notification settings determine how reliably customers hear from the brand during their order journey.",
      description: "This module controls key order emails, future WhatsApp and SMS support, and the admin alerts needed to respond quickly to sales and inventory events.",
      items: ["Customer trust", "Order communication", "Retention"]
    },
    groups: [
      {
        title: "Customer Notifications",
        fields: [
          { key: "notifications.orderPlacedEmailEnabled", label: "Order Placed Email", type: "boolean" },
          { key: "notifications.orderShippedEmailEnabled", label: "Order Shipped Email", type: "boolean" },
          { key: "notifications.orderDeliveredEmailEnabled", label: "Order Delivered Email", type: "boolean" },
          { key: "notifications.whatsappNotificationsEnabled", label: "WhatsApp Notifications", type: "boolean" },
          { key: "notifications.smsNotificationsEnabled", label: "SMS Notifications", type: "boolean" }
        ]
      },
      {
        title: "Admin Alerts",
        fields: [
          { key: "notifications.newOrderAlertEnabled", label: "New Order Alert", type: "boolean" },
          { key: "notifications.lowStockAlertEnabled", label: "Low Stock Alert", type: "boolean" }
        ]
      }
    ]
  },
    {
      id: "whatsapp",
      label: "WhatsApp Access",
      description: "Manage the floating WhatsApp support button shown on the storefront, including visibility, message templates, icon styling, and page rules.",
    impact: {
      eyebrow: "Support Impact",
      title: "WhatsApp Access helps customers reach support faster from product, order, and checkout journeys.",
      description: "This module controls the floating support button, mobile and desktop visibility, smart messages, and where the button appears across the storefront.",
      items: ["Product support", "Order help", "Customer trust", "Faster response"]
    },
      groups: []
    },
    {
      id: "header",
      label: "Header Controls",
      description: "Manually control the storefront header logo, search bar, account icon, wishlist icon, cart button, text, colors, sizing, and spacing.",
      impact: {
        eyebrow: "Header Impact",
        title: "Header controls affect the first navigation area customers use on every storefront page.",
        description: "Use these settings to fine tune brand logo sizing, search experience, account and cart action styling, spacing, and color balance.",
        items: ["Storefront header", "Search bar", "Account and cart actions", "Mobile header"]
      },
      groups: []
    },
    {
      id: "security",
    label: "Security & Admin Control",
    description: "Manage dashboard access, role permissions, password protection, and session security across the admin system.",
    impact: {
      eyebrow: "Security Impact",
      title: "Security settings control who can operate the dashboard and how sensitive actions are protected.",
      description: "This module defines admin role boundaries, feature access levels, password protection, and session limits that safeguard the entire business system.",
      items: ["Security of entire system"]
    },
    groups: [
      {
        title: "Admin Roles",
        fields: [
          { key: "security.superAdminEnabled", label: "Super Admin", type: "boolean" },
          { key: "security.staffRoleEnabled", label: "Staff", type: "boolean" }
        ]
      },
      {
        title: "Permissions & Protection",
        fields: [
          { key: "security.productsAccess", label: "Products Access", type: "text" },
          { key: "security.ordersAccess", label: "Orders Access", type: "text" },
          { key: "security.settingsAccess", label: "Settings Access", type: "text" },
          { key: "security.passwordRules", label: "Password Rules", type: "textarea" },
          { key: "security.sessionTimeout", label: "Session Timeout", type: "text" }
        ]
      }
    ]
  }
];

export function cloneSettings(settings = DEFAULT_APP_SETTINGS) {
  return JSON.parse(JSON.stringify(settings));
}

export function mergeSettings(baseSettings = DEFAULT_APP_SETTINGS, overrides = {}) {
  const base = cloneSettings(baseSettings);

  function mergeInto(target, source) {
    Object.entries(source || {}).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        target[key] = [...value];
        return;
      }

      if (value && typeof value === "object") {
        const current = target[key] && typeof target[key] === "object" ? target[key] : {};
        target[key] = mergeInto({ ...current }, value);
        return;
      }

      target[key] = value;
    });

    return target;
  }

  return mergeInto(base, overrides);
}

export function getSettingValue(settings, path) {
  return path.split(".").reduce((current, key) => (current ? current[key] : undefined), settings);
}

export function setSettingValue(settings, path, value) {
  const next = cloneSettings(settings);
  const keys = path.split(".");
  let current = next;

  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      current[key] = value;
      return;
    }

    current[key] = current[key] && typeof current[key] === "object" ? { ...current[key] } : {};
    current = current[key];
  });

  return next;
}

function normalizePublicHomepageSectionSettings(value = {}, fallback = {}) {
  const cardsPerRow = Number(value?.cardsPerRow);
  const tabletCardsPerRow = Number(value?.tabletCardsPerRow);
  const mobileCardsPerRow = Number(value?.mobileCardsPerRow);
  const sortOrder = Number(value?.sortOrder);
  const shouldIncludeButtonDisplayType = Object.prototype.hasOwnProperty.call(fallback, "buttonDisplayType") || value?.buttonDisplayType !== undefined;
  const buttonDisplayType = ["view_product", "add_to_cart", "both", "none"].includes(value?.buttonDisplayType)
    ? value.buttonDisplayType
    : (fallback.buttonDisplayType || "both");

  return {
    ...fallback,
    ...(value || {}),
    enabled: value?.enabled !== false,
    title: String(value?.title || fallback.title || "").trim(),
    subtitle: String(value?.subtitle || fallback.subtitle || "").trim(),
    cardsPerRow: Number.isInteger(cardsPerRow) ? Math.min(10, Math.max(1, cardsPerRow)) : fallback.cardsPerRow,
    tabletCardsPerRow: Number.isInteger(tabletCardsPerRow) ? Math.min(6, Math.max(1, tabletCardsPerRow)) : (fallback.tabletCardsPerRow || fallback.cardsPerRow),
    mobileCardsPerRow: Number.isInteger(mobileCardsPerRow) ? Math.min(3, Math.max(1, mobileCardsPerRow)) : fallback.mobileCardsPerRow,
    ...(shouldIncludeButtonDisplayType ? { buttonDisplayType } : {}),
    sortOrder: Number.isFinite(sortOrder) ? Math.floor(sortOrder) : fallback.sortOrder
  };
}

export function getPublicSettings(settings = DEFAULT_APP_SETTINGS) {
  const now = new Date();
  const publicHeroBanners = Array.isArray(settings.homepage?.heroBanners)
    ? settings.homepage.heroBanners
        .filter((banner) => {
          if (banner.status !== "active") return false;
          const startDate = banner.startDate ? new Date(`${String(banner.startDate).slice(0, 10)}T00:00:00`) : null;
          const endDate = banner.endDate ? new Date(`${String(banner.endDate).slice(0, 10)}T23:59:59`) : null;
          if (startDate && now < startDate) return false;
          if (endDate && now > endDate) return false;
          return true;
        })
        .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    : DEFAULT_APP_SETTINGS.homepage.heroBanners;

  return {
    general: {
      storeName: settings.general.storeName,
      logoUrl: settings.general.logoUrl,
      faviconUrl: settings.general.faviconUrl,
      brandTagline: settings.general.brandTagline,
      businessLegalName: settings.general.businessLegalName,
      supportEmail: settings.general.supportEmail,
      supportPhone: settings.general.supportPhone,
      businessAddress: settings.general.businessAddress,
      gstNumber: settings.general.gstNumber,
      workingHours: settings.general.workingHours
    },
    contactPage: settings.contactPage,
    store: {
      defaultCurrency: settings.store.defaultCurrency,
      currencyFormat: settings.store.currencyFormat,
      taxInclusion: settings.store.taxInclusion,
      defaultLanguage: settings.store.defaultLanguage,
      timezone: settings.store.timezone,
      guestCheckoutEnabled: settings.store.guestCheckoutEnabled,
      accountCreationEnabled: settings.store.accountCreationEnabled
    },
    payment: {
      codEnabled: settings.payment.codEnabled,
      razorpayEnabled: settings.payment.razorpayEnabled,
      stripeEnabled: settings.payment.stripeEnabled,
      upiWalletEnabled: settings.payment.upiWalletEnabled
    },
    shipping: {
      deliveryZones: settings.shipping.deliveryZones,
      deliveryTime: settings.shipping.deliveryTime,
      dispatchTime: settings.shipping.dispatchTime,
      pincodeServiceability: settings.shipping.pincodeServiceability
    },
    tracking: {
      trackingPageEnabled: settings.tracking.trackingPageEnabled,
      defaultStatusMessages: settings.tracking.defaultStatusMessages,
      expectedDeliveryLogic: settings.tracking.expectedDeliveryLogic,
      orderIdIsTrackingId: settings.tracking.orderIdIsTrackingId,
      orderIdPrefix: settings.tracking.orderIdPrefix,
      orderIdFormatLogic: settings.tracking.orderIdFormatLogic
    },
    notifications: {
      orderPlacedEmailEnabled: settings.notifications.orderPlacedEmailEnabled,
      orderShippedEmailEnabled: settings.notifications.orderShippedEmailEnabled,
      orderDeliveredEmailEnabled: settings.notifications.orderDeliveredEmailEnabled,
      whatsappNotificationsEnabled: settings.notifications.whatsappNotificationsEnabled,
      smsNotificationsEnabled: settings.notifications.smsNotificationsEnabled
    },
    whatsapp: {
      ...DEFAULT_APP_SETTINGS.whatsapp,
      ...(settings.whatsapp || {})
    },
    header: {
      ...DEFAULT_APP_SETTINGS.header,
      ...(settings.header || {})
    },
    theme: {
      ...DEFAULT_APP_SETTINGS.theme,
      ...(settings.theme || {}),
      colors: {
        ...DEFAULT_APP_SETTINGS.theme.colors,
        ...(settings.theme?.colors || {})
      },
      typography: {
        ...DEFAULT_APP_SETTINGS.theme.typography,
        ...(settings.theme?.typography || {})
      },
      buttons: {
        ...DEFAULT_APP_SETTINGS.theme.buttons,
        ...(settings.theme?.buttons || {})
      },
      cards: {
        ...DEFAULT_APP_SETTINGS.theme.cards,
        ...(settings.theme?.cards || {})
      },
      layout: {
        ...DEFAULT_APP_SETTINGS.theme.layout,
        ...(settings.theme?.layout || {})
      },
      productCards: {
        ...DEFAULT_APP_SETTINGS.theme.productCards,
        ...(settings.theme?.productCards || {})
      },
      customCss: {
        ...DEFAULT_APP_SETTINGS.theme.customCss,
        ...(settings.theme?.customCss || {})
      }
    },
    footer: {
      ...DEFAULT_APP_SETTINGS.footer,
      ...(settings.footer || {}),
      branding: {
        ...DEFAULT_APP_SETTINGS.footer.branding,
        ...(settings.footer?.branding || {})
      },
      quickLinks: Array.isArray(settings.footer?.quickLinks)
        ? settings.footer.quickLinks
        : DEFAULT_APP_SETTINGS.footer.quickLinks,
      faqLinks: Array.isArray(settings.footer?.faqLinks)
        ? settings.footer.faqLinks
        : DEFAULT_APP_SETTINGS.footer.faqLinks,
      support: {
        ...DEFAULT_APP_SETTINGS.footer.support,
        ...(settings.footer?.support || {})
      },
      newsletter: {
        ...DEFAULT_APP_SETTINGS.footer.newsletter,
        ...(settings.footer?.newsletter || {})
      },
      socialLinks: Array.isArray(settings.footer?.socialLinks)
        ? settings.footer.socialLinks
        : DEFAULT_APP_SETTINGS.footer.socialLinks,
      paymentIcons: Array.isArray(settings.footer?.paymentIcons)
        ? settings.footer.paymentIcons
        : DEFAULT_APP_SETTINGS.footer.paymentIcons,
      policyLinks: Array.isArray(settings.footer?.policyLinks)
        ? settings.footer.policyLinks
        : DEFAULT_APP_SETTINGS.footer.policyLinks,
      design: {
        ...DEFAULT_APP_SETTINGS.footer.design,
        ...(settings.footer?.design || {})
      }
    },
    thankYouPage: {
      ...DEFAULT_APP_SETTINGS.thankYouPage,
      ...(settings.thankYouPage || {})
    },
    homepage: {
      heroBanners: publicHeroBanners,
      globalHeroCta: settings.homepage?.globalHeroCta || DEFAULT_APP_SETTINGS.homepage.globalHeroCta,
      browseCategories: Array.isArray(settings.homepage?.browseCategories)
        ? settings.homepage.browseCategories
        : DEFAULT_APP_SETTINGS.homepage.browseCategories,
      browseCategoriesSettings: {
        ...DEFAULT_APP_SETTINGS.homepage.browseCategoriesSettings,
        ...(settings.homepage?.browseCategoriesSettings || {}),
        cardsPerRow: Number.isInteger(Number(settings.homepage?.browseCategoriesSettings?.cardsPerRow))
          ? Math.min(10, Math.max(1, Number(settings.homepage.browseCategoriesSettings.cardsPerRow)))
          : DEFAULT_APP_SETTINGS.homepage.browseCategoriesSettings.cardsPerRow,
        mobileCardsPerRow: Number.isInteger(Number(settings.homepage?.browseCategoriesSettings?.mobileCardsPerRow))
          ? Math.min(3, Math.max(1, Number(settings.homepage.browseCategoriesSettings.mobileCardsPerRow)))
          : DEFAULT_APP_SETTINGS.homepage.browseCategoriesSettings.mobileCardsPerRow
      },
      ourProductsSettings: normalizePublicHomepageSectionSettings(settings.homepage?.ourProductsSettings, DEFAULT_APP_SETTINGS.homepage.ourProductsSettings),
      bestSellerProductsSettings: normalizePublicHomepageSectionSettings(settings.homepage?.bestSellerProductsSettings, DEFAULT_APP_SETTINGS.homepage.bestSellerProductsSettings),
      newArrivalProductsSettings: normalizePublicHomepageSectionSettings(settings.homepage?.newArrivalProductsSettings, DEFAULT_APP_SETTINGS.homepage.newArrivalProductsSettings),
      featuredBrandsSettings: normalizePublicHomepageSectionSettings(settings.homepage?.featuredBrandsSettings, DEFAULT_APP_SETTINGS.homepage.featuredBrandsSettings),
      whyShopSettings: normalizePublicHomepageSectionSettings(settings.homepage?.whyShopSettings, DEFAULT_APP_SETTINGS.homepage.whyShopSettings),
      productPaymentIconsSettings: normalizePublicHomepageSectionSettings(settings.homepage?.productPaymentIconsSettings, DEFAULT_APP_SETTINGS.homepage.productPaymentIconsSettings),
      newsletterSettings: normalizePublicHomepageSectionSettings(settings.homepage?.newsletterSettings, DEFAULT_APP_SETTINGS.homepage.newsletterSettings),
      blogPostsSettings: normalizePublicHomepageSectionSettings(settings.homepage?.blogPostsSettings, DEFAULT_APP_SETTINGS.homepage.blogPostsSettings),
      creditPointsSettings: normalizePublicHomepageSectionSettings(settings.homepage?.creditPointsSettings, DEFAULT_APP_SETTINGS.homepage.creditPointsSettings),
      browseCategoryCardCount: Number.isInteger(Number(settings.homepage?.browseCategoryCardCount))
        ? Math.min(10, Math.max(1, Number(settings.homepage.browseCategoryCardCount)))
        : DEFAULT_APP_SETTINGS.homepage.browseCategoryCardCount,
      ourProducts: Array.isArray(settings.homepage?.ourProducts)
        ? settings.homepage.ourProducts
        : DEFAULT_APP_SETTINGS.homepage.ourProducts,
      bestSellerProducts: Array.isArray(settings.homepage?.bestSellerProducts)
        ? settings.homepage.bestSellerProducts
        : DEFAULT_APP_SETTINGS.homepage.bestSellerProducts,
      bestSellerCategories: Array.isArray(settings.homepage?.bestSellerCategories)
        ? settings.homepage.bestSellerCategories
        : DEFAULT_APP_SETTINGS.homepage.bestSellerCategories,
      newArrivalProducts: Array.isArray(settings.homepage?.newArrivalProducts)
        ? settings.homepage.newArrivalProducts
        : DEFAULT_APP_SETTINGS.homepage.newArrivalProducts,
      featuredBrands: Array.isArray(settings.homepage?.featuredBrands)
        ? settings.homepage.featuredBrands
        : DEFAULT_APP_SETTINGS.homepage.featuredBrands,
      whyShopItems: Array.isArray(settings.homepage?.whyShopItems)
        ? settings.homepage.whyShopItems
            .filter((item) => String(item.status || "active").toLowerCase() === "active")
            .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
        : DEFAULT_APP_SETTINGS.homepage.whyShopItems,
      productPaymentIcons: Array.isArray(settings.homepage?.productPaymentIcons)
        ? settings.homepage.productPaymentIcons
            .filter((item) => String(item.status || "active").toLowerCase() === "active")
            .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
        : DEFAULT_APP_SETTINGS.homepage.productPaymentIcons
    }
  };
}
