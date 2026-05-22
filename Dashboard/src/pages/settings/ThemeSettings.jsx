import React from "react";
import { FaRedo, FaSave, FaSearch, FaShoppingCart, FaUser } from "react-icons/fa";
import { fetchAdminThemeSettings, updateAdminThemeSettings } from "../../api/adminApi";
import { cloneSettings, DEFAULT_APP_SETTINGS, mergeSettings } from "../../../../shared/appSettings";

const themeTabs = [
  { id: "colors", label: "Colors", description: "Manage your website global colors." },
  { id: "typography", label: "Typography", description: "Control font families, heading scale, body text, and text weights." },
  { id: "buttons", label: "Buttons", description: "Configure button colors, radius, borders, hover states, and sizes." },
  { id: "cards-shadows", label: "Cards & Shadows", description: "Adjust card radius, borders, surfaces, and shadow depth." },
  { id: "layout-spacing", label: "Layout & Spacing", description: "Set container width, section gaps, page padding, and spacing rhythm." },
  { id: "product-cards", label: "Product Cards", description: "Tune storefront product card image, pricing, badge, and action styling." },
  { id: "custom-css", label: "Custom CSS", description: "Add carefully scoped CSS for advanced storefront theme changes." },
  { id: "preview", label: "Preview", description: "Review the current theme against sample storefront components before publishing." }
];

const previewChecks = ["Header", "Product Card", "Button", "Form Input", "Footer", "Mobile Preview"];

const colorFields = [
  { key: "primaryColor", label: "Primary Color" },
  { key: "secondaryColor", label: "Secondary Color" },
  { key: "accentColor", label: "Accent Color" },
  { key: "backgroundColor", label: "Background Color" },
  { key: "surfaceColor", label: "Surface/Card Color" },
  { key: "textColor", label: "Text Color" },
  { key: "mutedTextColor", label: "Muted Text Color" },
  { key: "borderColor", label: "Border Color" },
  { key: "successColor", label: "Success Color" },
  { key: "errorColor", label: "Error Color" }
];

const buttonColorFields = [
  { key: "primaryBackground", label: "Primary Button Background" },
  { key: "primaryTextColor", label: "Primary Button Text Color" },
  { key: "secondaryBackground", label: "Secondary Button Background" },
  { key: "secondaryTextColor", label: "Secondary Button Text Color" }
];

const cardColorFields = [
  { key: "background", label: "Card Background" },
  { key: "borderColor", label: "Card Border Color" }
];

const productCardColorFields = [
  { key: "priceColor", label: "Price Color" },
  { key: "mrpColor", label: "MRP Color" }
];

const fontFamilyOptions = [
  "Inter",
  "Poppins",
  "Nunito",
  "Lato",
  "Montserrat",
  "Roboto",
  "Nunito Sans",
  "Open Sans",
  "Manrope",
  "DM Sans",
  "Plus Jakarta Sans",
  "System Default"
];

const weightOptions = [300, 400, 500, 600, 700, 800, 900];
const buttonHoverOptions = [
  { value: "darken", label: "Darken" },
  { value: "lift", label: "Lift" },
  { value: "outline", label: "Outline" },
  { value: "none", label: "None" }
];
const cardShadowOptions = [
  { value: "none", label: "None" },
  { value: "subtle", label: "Subtle" },
  { value: "soft", label: "Soft" },
  { value: "elevated", label: "Elevated" },
  { value: "strong", label: "Strong" }
];
const productImageRatioOptions = ["1:1", "4:5", "3:4", "16:9"];

const hexPattern = /^#[0-9a-f]{6}$/i;
const customCssMaxLength = 10000;
const invalidColorMessage = "Invalid color format. Use HEX like #22C55E.";

function normalizeColors(value = {}) {
  return {
    ...DEFAULT_APP_SETTINGS.theme.colors,
    ...(value || {})
  };
}

function normalizeTypography(value = {}) {
  const typography = {
    ...DEFAULT_APP_SETTINGS.theme.typography,
    ...(value || {})
  };

  return {
    ...typography,
    baseFontSize: Number(typography.baseFontSize) || DEFAULT_APP_SETTINGS.theme.typography.baseFontSize,
    headingFontWeight: Number(typography.headingFontWeight) || DEFAULT_APP_SETTINGS.theme.typography.headingFontWeight,
    bodyFontWeight: Number(typography.bodyFontWeight) || DEFAULT_APP_SETTINGS.theme.typography.bodyFontWeight,
    lineHeight: Number(typography.lineHeight) || DEFAULT_APP_SETTINGS.theme.typography.lineHeight,
    letterSpacing: Number(typography.letterSpacing) || DEFAULT_APP_SETTINGS.theme.typography.letterSpacing
  };
}

function normalizeButtons(value = {}) {
  const buttons = {
    ...DEFAULT_APP_SETTINGS.theme.buttons,
    ...(value || {})
  };

  return {
    ...buttons,
    borderRadius: Number(buttons.borderRadius) || DEFAULT_APP_SETTINGS.theme.buttons.borderRadius,
    height: Number(buttons.height) || DEFAULT_APP_SETTINGS.theme.buttons.height,
    fontWeight: Number(buttons.fontWeight) || DEFAULT_APP_SETTINGS.theme.buttons.fontWeight
  };
}

function normalizeCards(value = {}) {
  const cards = {
    ...DEFAULT_APP_SETTINGS.theme.cards,
    ...(value || {})
  };

  return {
    ...cards,
    borderRadius: Number(cards.borderRadius) || DEFAULT_APP_SETTINGS.theme.cards.borderRadius,
    padding: Number(cards.padding) || DEFAULT_APP_SETTINGS.theme.cards.padding
  };
}

function normalizeLayout(value = {}) {
  const layout = {
    ...DEFAULT_APP_SETTINGS.theme.layout,
    ...(value || {})
  };

  return {
    ...layout,
    websiteMaxWidth: Number(layout.websiteMaxWidth) || DEFAULT_APP_SETTINGS.theme.layout.websiteMaxWidth,
    sectionPaddingDesktop: Number(layout.sectionPaddingDesktop) || DEFAULT_APP_SETTINGS.theme.layout.sectionPaddingDesktop,
    sectionPaddingMobile: Number(layout.sectionPaddingMobile) || DEFAULT_APP_SETTINGS.theme.layout.sectionPaddingMobile,
    sectionGap: Number(layout.sectionGap) || DEFAULT_APP_SETTINGS.theme.layout.sectionGap,
    containerRadius: Number(layout.containerRadius) || DEFAULT_APP_SETTINGS.theme.layout.containerRadius,
    mobileCompactMode: Boolean(layout.mobileCompactMode)
  };
}

function normalizeProductCards(value = {}) {
  const productCards = {
    ...DEFAULT_APP_SETTINGS.theme.productCards,
    ...(value || {})
  };

  return {
    ...productCards,
    showDiscountBadge: productCards.showDiscountBadge !== false,
    showRating: productCards.showRating !== false,
    showAddToCartButton: productCards.showAddToCartButton !== false,
    borderRadius: Number(productCards.borderRadius) || DEFAULT_APP_SETTINGS.theme.productCards.borderRadius,
    titleLines: Number(productCards.titleLines) || DEFAULT_APP_SETTINGS.theme.productCards.titleLines
  };
}

function normalizeCustomCss(value = {}) {
  return {
    ...DEFAULT_APP_SETTINGS.theme.customCss,
    ...(value || {}),
    css: String(value?.css || "")
  };
}

function validateCustomCss(css = "") {
  const value = String(css || "").trim();
  if (!value) return "";

  if (value.length > customCssMaxLength) {
    return "Custom CSS must be 10,000 characters or less.";
  }

  const lowered = value.toLowerCase();
  if (/<\/?\s*script\b/i.test(value)) {
    return "Script tags are not allowed.";
  }

  if (/<\/?\s*[a-z][^>]*>/i.test(value)) {
    return "HTML tags are not allowed.";
  }

  if (/\bjavascript\s*:/i.test(lowered)) {
    return "javascript: URLs are not allowed.";
  }

  if (/\biframe\b/i.test(value)) {
    return "Iframe is not allowed.";
  }

  if (/@import\b/i.test(value)) {
    return "@import is not allowed.";
  }

  if (/\bexpression\s*\(/i.test(value)) {
    return "CSS expression() is not allowed.";
  }

  if (/\bonerror\s*=/i.test(value) || /\bonclick\s*=/i.test(value)) {
    return "Inline event handlers are not allowed.";
  }

  if (/url\(\s*['\"]?\s*https?:\/\//i.test(value)) {
    return "External URLs are not allowed.";
  }

  if (!/[{}]/.test(value)) {
    return "Custom CSS must include CSS selectors and declarations.";
  }

  if (!/\.avyona-theme[\s.#:[,{>+~]/i.test(`${value} `)) {
    return "Custom CSS must be scoped under .avyona-theme.";
  }

  return "";
}

function isValidHex(value) {
  return hexPattern.test(String(value || "").trim());
}

function resolvePreviewFontFamily(fontFamily) {
  return fontFamily === "System Default"
    ? "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    : `${fontFamily}, system-ui, sans-serif`;
}

export default function ThemeSettings() {
  const [activeTab, setActiveTab] = React.useState(themeTabs[0].id);
  const [settings, setSettings] = React.useState(() => cloneSettings(DEFAULT_APP_SETTINGS));
  const [colors, setColors] = React.useState(() => normalizeColors(DEFAULT_APP_SETTINGS.theme.colors));
  const [typography, setTypography] = React.useState(() => normalizeTypography(DEFAULT_APP_SETTINGS.theme.typography));
  const [buttons, setButtons] = React.useState(() => normalizeButtons(DEFAULT_APP_SETTINGS.theme.buttons));
  const [cards, setCards] = React.useState(() => normalizeCards(DEFAULT_APP_SETTINGS.theme.cards));
  const [layout, setLayout] = React.useState(() => normalizeLayout(DEFAULT_APP_SETTINGS.theme.layout));
  const [productCards, setProductCards] = React.useState(() => normalizeProductCards(DEFAULT_APP_SETTINGS.theme.productCards));
  const [customCss, setCustomCss] = React.useState(() => normalizeCustomCss(DEFAULT_APP_SETTINGS.theme.customCss));
  const [previewMode, setPreviewMode] = React.useState("desktop");
  const [statusMessage, setStatusMessage] = React.useState("Theme settings are ready.");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const currentTab = themeTabs.find((tab) => tab.id === activeTab) || themeTabs[0];

  React.useEffect(() => {
    let isMounted = true;

    async function loadThemeSettings() {
      setIsLoading(true);
      try {
        const response = await fetchAdminThemeSettings();
        const merged = mergeSettings(DEFAULT_APP_SETTINGS, { theme: response.data?.data || {} });
        if (!isMounted) return;
        setSettings(merged);
        setColors(normalizeColors(merged.theme?.colors));
        setTypography(normalizeTypography(merged.theme?.typography));
        setButtons(normalizeButtons(merged.theme?.buttons));
        setCards(normalizeCards(merged.theme?.cards));
        setLayout(normalizeLayout(merged.theme?.layout));
        setProductCards(normalizeProductCards(merged.theme?.productCards));
        setCustomCss(normalizeCustomCss(merged.theme?.customCss));
        setStatusMessage("Theme settings loaded from backend.");
      } catch (error) {
        if (!isMounted) return;
        setSettings(cloneSettings(DEFAULT_APP_SETTINGS));
        setColors(normalizeColors(DEFAULT_APP_SETTINGS.theme.colors));
        setTypography(normalizeTypography(DEFAULT_APP_SETTINGS.theme.typography));
        setButtons(normalizeButtons(DEFAULT_APP_SETTINGS.theme.buttons));
        setCards(normalizeCards(DEFAULT_APP_SETTINGS.theme.cards));
        setLayout(normalizeLayout(DEFAULT_APP_SETTINGS.theme.layout));
        setProductCards(normalizeProductCards(DEFAULT_APP_SETTINGS.theme.productCards));
        setCustomCss(normalizeCustomCss(DEFAULT_APP_SETTINGS.theme.customCss));
        setStatusMessage(error.response?.data?.message || "Showing default theme settings.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadThemeSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateColor = (key, value) => {
    setColors((current) => ({
      ...current,
      [key]: String(value || "").toUpperCase()
    }));
  };

  const updateTypography = (key, value) => {
    setTypography((current) => ({
      ...current,
      [key]: value
    }));
  };

  const updateButton = (key, value) => {
    const shouldUppercase = buttonColorFields.some((field) => field.key === key);
    setButtons((current) => ({
      ...current,
      [key]: shouldUppercase && typeof value === "string" ? value.toUpperCase() : value
    }));
  };

  const updateCard = (key, value) => {
    const shouldUppercase = cardColorFields.some((field) => field.key === key);
    setCards((current) => ({
      ...current,
      [key]: shouldUppercase && typeof value === "string" ? value.toUpperCase() : value
    }));
  };

  const updateLayout = (key, value) => {
    setLayout((current) => ({
      ...current,
      [key]: value
    }));
  };

  const updateProductCard = (key, value) => {
    const shouldUppercase = productCardColorFields.some((field) => field.key === key);
    setProductCards((current) => ({
      ...current,
      [key]: shouldUppercase && typeof value === "string" ? value.toUpperCase() : value
    }));
  };

  const updateCustomCss = (value) => {
    setCustomCss({ css: value });
  };

  const resetActiveTab = () => {
    if (activeTab === "custom-css") {
      setCustomCss(normalizeCustomCss(DEFAULT_APP_SETTINGS.theme.customCss));
      setStatusMessage("Custom CSS reset to default. Save Theme to publish changes.");
      return;
    }

    if (activeTab === "product-cards") {
      setProductCards(normalizeProductCards(DEFAULT_APP_SETTINGS.theme.productCards));
      setStatusMessage("Product cards reset to default. Save Theme to publish changes.");
      return;
    }

    if (activeTab === "layout-spacing") {
      setLayout(normalizeLayout(DEFAULT_APP_SETTINGS.theme.layout));
      setStatusMessage("Layout and spacing reset to default. Save Theme to publish changes.");
      return;
    }

    if (activeTab === "cards-shadows") {
      setCards(normalizeCards(DEFAULT_APP_SETTINGS.theme.cards));
      setStatusMessage("Cards and shadows reset to default. Save Theme to publish changes.");
      return;
    }

    if (activeTab === "buttons") {
      setButtons(normalizeButtons(DEFAULT_APP_SETTINGS.theme.buttons));
      setStatusMessage("Buttons reset to default. Save Theme to publish changes.");
      return;
    }

    if (activeTab === "typography") {
      setTypography(normalizeTypography(DEFAULT_APP_SETTINGS.theme.typography));
      setStatusMessage("Typography reset to default. Save Theme to publish changes.");
      return;
    }

    setColors(normalizeColors(DEFAULT_APP_SETTINGS.theme.colors));
    setStatusMessage("Colors reset to default. Save Theme to publish changes.");
  };

  const saveTheme = async () => {
    const invalidField = colorFields.find((field) => !isValidHex(colors[field.key]));
    if (invalidField) {
      setStatusMessage(invalidColorMessage);
      return;
    }

    const invalidButtonColor = buttonColorFields.find((field) => !isValidHex(buttons[field.key]));
    if (invalidButtonColor) {
      setStatusMessage(invalidColorMessage);
      return;
    }

    const invalidCardColor = cardColorFields.find((field) => !isValidHex(cards[field.key]));
    if (invalidCardColor) {
      setStatusMessage(invalidColorMessage);
      return;
    }

    const invalidProductCardColor = productCardColorFields.find((field) => !isValidHex(productCards[field.key]));
    if (invalidProductCardColor) {
      setStatusMessage(invalidColorMessage);
      return;
    }

    if (!fontFamilyOptions.includes(typography.fontFamily)) {
      setStatusMessage("Font Family must be one of the available theme fonts.");
      return;
    }

    if (typography.baseFontSize < 12 || typography.baseFontSize > 22) {
      setStatusMessage("Base Font Size must be between 12 and 22.");
      return;
    }

    if (typography.lineHeight < 1 || typography.lineHeight > 2.2) {
      setStatusMessage("Line Height must be between 1 and 2.2.");
      return;
    }

    if (typography.letterSpacing < 0 || typography.letterSpacing > 2) {
      setStatusMessage("Letter Spacing must be between 0 and 2.");
      return;
    }

    if (buttons.borderRadius < 0 || buttons.borderRadius > 40) {
      setStatusMessage("Button Border Radius must be between 0 and 40.");
      return;
    }

    if (buttons.height < 32 || buttons.height > 64) {
      setStatusMessage("Button Height must be between 32 and 64.");
      return;
    }

    if (!weightOptions.includes(Number(buttons.fontWeight))) {
      setStatusMessage("Button Font Weight must be one of the available weight options.");
      return;
    }

    if (!buttonHoverOptions.some((option) => option.value === buttons.hoverStyle)) {
      setStatusMessage("Button Hover Style must be one of the available options.");
      return;
    }

    if (cards.borderRadius < 0 || cards.borderRadius > 40) {
      setStatusMessage("Card Border Radius must be between 0 and 40.");
      return;
    }

    if (cards.padding < 8 || cards.padding > 40) {
      setStatusMessage("Card Padding must be between 8 and 40.");
      return;
    }

    if (!cardShadowOptions.some((option) => option.value === cards.shadowStyle)) {
      setStatusMessage("Card Shadow Style must be one of the available options.");
      return;
    }

    if (layout.websiteMaxWidth < 960 || layout.websiteMaxWidth > 1800) {
      setStatusMessage("Website Max Width must be between 960 and 1800.");
      return;
    }

    if (layout.sectionPaddingDesktop < 24 || layout.sectionPaddingDesktop > 140) {
      setStatusMessage("Section Padding Desktop must be between 24 and 140.");
      return;
    }

    if (layout.sectionPaddingMobile < 12 || layout.sectionPaddingMobile > 80) {
      setStatusMessage("Section Padding Mobile must be between 12 and 80.");
      return;
    }

    if (layout.sectionGap < 12 || layout.sectionGap > 96) {
      setStatusMessage("Section Gap must be between 12 and 96.");
      return;
    }

    if (layout.containerRadius < 0 || layout.containerRadius > 40) {
      setStatusMessage("Container Radius must be between 0 and 40.");
      return;
    }

    if (!productImageRatioOptions.includes(productCards.imageRatio)) {
      setStatusMessage("Product Card Image Ratio must be one of the available options.");
      return;
    }

    if (productCards.borderRadius < 0 || productCards.borderRadius > 40) {
      setStatusMessage("Product Card Border Radius must be between 0 and 40.");
      return;
    }

    if (!cardShadowOptions.some((option) => option.value === productCards.shadowStyle)) {
      setStatusMessage("Product Card Shadow must be one of the available options.");
      return;
    }

    if (productCards.titleLines < 1 || productCards.titleLines > 4) {
      setStatusMessage("Product Title Lines must be between 1 and 4.");
      return;
    }

    const customCssError = validateCustomCss(customCss.css);
    if (customCssError) {
      setStatusMessage(customCssError);
      return;
    }

    setIsSaving(true);
    const nextSettings = mergeSettings(settings, {
      theme: {
        ...(settings.theme || {}),
        colors,
        typography,
        buttons,
        cards,
        layout,
        productCards,
        customCss
      }
    });

    try {
      const response = await updateAdminThemeSettings({ theme: nextSettings.theme });
      const savedSettings = mergeSettings(DEFAULT_APP_SETTINGS, { theme: response.data?.data || nextSettings.theme });
      setSettings(savedSettings);
      setColors(normalizeColors(savedSettings.theme?.colors));
      setTypography(normalizeTypography(savedSettings.theme?.typography));
      setButtons(normalizeButtons(savedSettings.theme?.buttons));
      setCards(normalizeCards(savedSettings.theme?.cards));
      setLayout(normalizeLayout(savedSettings.theme?.layout));
      setProductCards(normalizeProductCards(savedSettings.theme?.productCards));
      setCustomCss(normalizeCustomCss(savedSettings.theme?.customCss));
      setStatusMessage("Theme settings saved successfully. Website will use this theme on the next refresh or visibility update.");
    } catch (error) {
      setSettings(nextSettings);
      setStatusMessage(error.response?.data?.message || "Theme settings updated locally for preview. Sign in as admin to save them.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="dashboard-admin-page dashboard-page-shell">
      <div className="dashboard-page-heading">
        <div>
          <h2 style={{ margin: 0 }}>Theme Settings</h2>
          <p className="dashboard-page-copy">
            Control website colors, buttons, cards, spacing, and global design style.
          </p>
          <p className="dashboard-source-message">{isLoading ? "Loading theme settings..." : statusMessage}</p>
        </div>
        <div style={headerActionStyle}>
          <button className="dashboard-secondary-button" type="button" onClick={resetActiveTab} disabled={isSaving}>
            <FaRedo aria-hidden="true" /> Reset to Default
          </button>
          <button className="dashboard-primary-button" type="button" onClick={saveTheme} disabled={isSaving || isLoading}>
            <FaSave aria-hidden="true" /> {isSaving ? "Saving..." : "Save Theme"}
          </button>
        </div>
      </div>

      <nav style={tabsStyle} role="tablist" aria-label="Theme settings tabs">
        {themeTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`theme-settings-panel-${tab.id}`}
              id={`theme-settings-tab-${tab.id}`}
              style={isActive ? activeTabStyle : tabStyle}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === "colors" ? (
        <ColorsTab colors={colors} typography={typography} buttons={buttons} cards={cards} onColorChange={updateColor} />
      ) : activeTab === "typography" ? (
        <TypographyTab colors={colors} typography={typography} buttons={buttons} cards={cards} onTypographyChange={updateTypography} />
      ) : activeTab === "buttons" ? (
        <ButtonsTab colors={colors} typography={typography} buttons={buttons} cards={cards} onButtonChange={updateButton} />
      ) : activeTab === "cards-shadows" ? (
        <CardsTab colors={colors} typography={typography} buttons={buttons} cards={cards} onCardChange={updateCard} />
      ) : activeTab === "layout-spacing" ? (
        <LayoutTab colors={colors} typography={typography} buttons={buttons} cards={cards} layout={layout} onLayoutChange={updateLayout} />
      ) : activeTab === "product-cards" ? (
        <ProductCardsTab colors={colors} typography={typography} buttons={buttons} cards={cards} productCards={productCards} onProductCardChange={updateProductCard} />
      ) : activeTab === "custom-css" ? (
        <CustomCssTab colors={colors} typography={typography} buttons={buttons} cards={cards} productCards={productCards} customCss={customCss} onCustomCssChange={updateCustomCss} />
      ) : activeTab === "preview" ? (
        <PreviewTab
          colors={colors}
          typography={typography}
          buttons={buttons}
          cards={cards}
          layout={layout}
          productCards={productCards}
          customCss={customCss}
          previewMode={previewMode}
          onPreviewModeChange={setPreviewMode}
          onSaveTheme={saveTheme}
          isSaving={isSaving}
          isLoading={isLoading}
        />
      ) : (
        <section style={panelStyle}>
          <div>
            <span style={eyebrowStyle}>Theme / {currentTab.label}</span>
            <h3 style={sectionTitleStyle}>{currentTab.label}</h3>
            <p style={sectionCopyStyle}>{currentTab.description}</p>
          </div>
          <div
            id={`theme-settings-panel-${currentTab.id}`}
            role="tabpanel"
            aria-labelledby={`theme-settings-tab-${currentTab.id}`}
            style={panelBodyStyle}
          >
            <strong>{currentTab.label} controls will be added here.</strong>
          </div>
        </section>
      )}
    </div>
  );
}

function ColorsTab({ colors, typography, buttons, cards, onColorChange }) {
  return (
    <div
      id="theme-settings-panel-colors"
      role="tabpanel"
      aria-labelledby="theme-settings-tab-colors"
      style={colorsLayoutStyle}
    >
      <section style={panelStyle}>
        <div>
          <span style={eyebrowStyle}>Theme / Colors</span>
          <h3 style={sectionTitleStyle}>Color Palette</h3>
          <p style={sectionCopyStyle}>Manage your website global colors.</p>
        </div>

        <div style={colorGridStyle}>
          {colorFields.map((field) => (
            <ColorField
              key={field.key}
              label={field.label}
              value={colors[field.key]}
              isInvalid={!isValidHex(colors[field.key])}
              onChange={(value) => onColorChange(field.key, value)}
            />
          ))}
        </div>
      </section>

      <section style={previewPanelStyle}>
        <div style={previewHeaderStyle}>
          <div>
            <span style={eyebrowStyle}>Live Preview</span>
            <h3 style={sectionTitleStyle}>Website Preview</h3>
            <p style={sectionCopyStyle}>See how the selected colors will look across key storefront elements.</p>
          </div>
        </div>
        <ThemePreview colors={colors} typography={typography} buttons={buttons} cards={cards} />
      </section>
    </div>
  );
}

function TypographyTab({ colors, typography, buttons, cards, onTypographyChange }) {
  return (
    <div
      id="theme-settings-panel-typography"
      role="tabpanel"
      aria-labelledby="theme-settings-tab-typography"
      style={colorsLayoutStyle}
    >
      <section style={panelStyle}>
        <div>
          <span style={eyebrowStyle}>Theme / Typography</span>
          <h3 style={sectionTitleStyle}>Typography</h3>
          <p style={sectionCopyStyle}>Control common font and text appearance.</p>
        </div>

        <div style={typographyGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Font Family</span>
            <select
              value={typography.fontFamily}
              onChange={(event) => onTypographyChange("fontFamily", event.target.value)}
              style={selectInputStyle}
            >
              {fontFamilyOptions.map((font) => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>
          </label>

          <NumberField label="Base Font Size" suffix="px" min={12} max={22} step={1} value={typography.baseFontSize} onChange={(value) => onTypographyChange("baseFontSize", value)} />
          <SelectField label="Heading Font Weight" value={typography.headingFontWeight} options={weightOptions} onChange={(value) => onTypographyChange("headingFontWeight", value)} />
          <SelectField label="Body Font Weight" value={typography.bodyFontWeight} options={weightOptions} onChange={(value) => onTypographyChange("bodyFontWeight", value)} />
          <NumberField label="Line Height" min={1} max={2.2} step={0.05} value={typography.lineHeight} onChange={(value) => onTypographyChange("lineHeight", value)} />
          <NumberField label="Letter Spacing" suffix="px" min={0} max={2} step={0.05} value={typography.letterSpacing} onChange={(value) => onTypographyChange("letterSpacing", value)} />
        </div>
      </section>

      <section style={previewPanelStyle}>
        <div style={previewHeaderStyle}>
          <div>
            <span style={eyebrowStyle}>Live Preview</span>
            <h3 style={sectionTitleStyle}>Typography Preview</h3>
            <p style={sectionCopyStyle}>Preview heading, body, and button text with your selected typography.</p>
          </div>
        </div>
        <ThemePreview colors={colors} typography={typography} buttons={buttons} cards={cards} />
      </section>
    </div>
  );
}

function ButtonsTab({ colors, typography, buttons, cards, onButtonChange }) {
  return (
    <div
      id="theme-settings-panel-buttons"
      role="tabpanel"
      aria-labelledby="theme-settings-tab-buttons"
      style={colorsLayoutStyle}
    >
      <section style={panelStyle}>
        <div>
          <span style={eyebrowStyle}>Theme / Buttons</span>
          <h3 style={sectionTitleStyle}>Buttons</h3>
          <p style={sectionCopyStyle}>Control button style across the website.</p>
        </div>

        <div style={colorGridStyle}>
          {buttonColorFields.map((field) => (
            <ColorField
              key={field.key}
              label={field.label}
              value={buttons[field.key]}
              isInvalid={!isValidHex(buttons[field.key])}
              onChange={(value) => onButtonChange(field.key, value)}
            />
          ))}
          <NumberField label="Button Border Radius" suffix="px" min={0} max={40} step={1} value={buttons.borderRadius} onChange={(value) => onButtonChange("borderRadius", value)} />
          <NumberField label="Button Height" suffix="px" min={32} max={64} step={1} value={buttons.height} onChange={(value) => onButtonChange("height", value)} />
          <SelectField label="Button Font Weight" value={buttons.fontWeight} options={weightOptions} onChange={(value) => onButtonChange("fontWeight", value)} />
          <label style={fieldStyle}>
            <span style={labelStyle}>Button Hover Style</span>
            <select value={buttons.hoverStyle} onChange={(event) => onButtonChange("hoverStyle", event.target.value)} style={selectInputStyle}>
              {buttonHoverOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section style={previewPanelStyle}>
        <div style={previewHeaderStyle}>
          <div>
            <span style={eyebrowStyle}>Live Preview</span>
            <h3 style={sectionTitleStyle}>Button Preview</h3>
            <p style={sectionCopyStyle}>Applies to Add to Cart, Buy Now, Submit, Continue Shopping, Track Order, and Read More.</p>
          </div>
        </div>
        <ButtonPreview colors={colors} typography={typography} buttons={buttons} />
      </section>
    </div>
  );
}

function CardsTab({ colors, typography, buttons, cards, onCardChange }) {
  return (
    <div
      id="theme-settings-panel-cards-shadows"
      role="tabpanel"
      aria-labelledby="theme-settings-tab-cards-shadows"
      style={colorsLayoutStyle}
    >
      <section style={panelStyle}>
        <div>
          <span style={eyebrowStyle}>Theme / Cards & Shadows</span>
          <h3 style={sectionTitleStyle}>Cards & Shadows</h3>
          <p style={sectionCopyStyle}>Control common card appearance.</p>
        </div>

        <div style={colorGridStyle}>
          {cardColorFields.map((field) => (
            <ColorField
              key={field.key}
              label={field.label}
              value={cards[field.key]}
              isInvalid={!isValidHex(cards[field.key])}
              onChange={(value) => onCardChange(field.key, value)}
            />
          ))}
          <NumberField label="Card Border Radius" suffix="px" min={0} max={40} step={1} value={cards.borderRadius} onChange={(value) => onCardChange("borderRadius", value)} />
          <NumberField label="Card Padding" suffix="px" min={8} max={40} step={1} value={cards.padding} onChange={(value) => onCardChange("padding", value)} />
          <label style={fieldStyle}>
            <span style={labelStyle}>Card Shadow Style</span>
            <select value={cards.shadowStyle} onChange={(event) => onCardChange("shadowStyle", event.target.value)} style={selectInputStyle}>
              {cardShadowOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section style={previewPanelStyle}>
        <div style={previewHeaderStyle}>
          <div>
            <span style={eyebrowStyle}>Live Preview</span>
            <h3 style={sectionTitleStyle}>Card Preview</h3>
            <p style={sectionCopyStyle}>Applies to product, category, profile, contact, review, and dashboard preview cards.</p>
          </div>
        </div>
        <CardPreview colors={colors} typography={typography} buttons={buttons} cards={cards} />
      </section>
    </div>
  );
}

function LayoutTab({ colors, typography, buttons, cards, layout, onLayoutChange }) {
  return (
    <div
      id="theme-settings-panel-layout-spacing"
      role="tabpanel"
      aria-labelledby="theme-settings-tab-layout-spacing"
      style={colorsLayoutStyle}
    >
      <section style={panelStyle}>
        <div>
          <span style={eyebrowStyle}>Theme / Layout & Spacing</span>
          <h3 style={sectionTitleStyle}>Layout & Spacing</h3>
          <p style={sectionCopyStyle}>Control global website spacing and max-width.</p>
        </div>

        <div style={colorGridStyle}>
          <NumberField label="Website Max Width" suffix="px" min={960} max={1800} step={20} value={layout.websiteMaxWidth} onChange={(value) => onLayoutChange("websiteMaxWidth", value)} />
          <NumberField label="Section Padding Desktop" suffix="px" min={24} max={140} step={4} value={layout.sectionPaddingDesktop} onChange={(value) => onLayoutChange("sectionPaddingDesktop", value)} />
          <NumberField label="Section Padding Mobile" suffix="px" min={12} max={80} step={2} value={layout.sectionPaddingMobile} onChange={(value) => onLayoutChange("sectionPaddingMobile", value)} />
          <NumberField label="Section Gap" suffix="px" min={12} max={96} step={4} value={layout.sectionGap} onChange={(value) => onLayoutChange("sectionGap", value)} />
          <NumberField label="Container Radius" suffix="px" min={0} max={40} step={1} value={layout.containerRadius} onChange={(value) => onLayoutChange("containerRadius", value)} />
          <label style={toggleCardStyle}>
            <span>
              <strong style={labelStyle}>Mobile Layout Compact Mode</strong>
              <small style={toggleHelpStyle}>Reduce mobile spacing for denser storefront sections.</small>
            </span>
            <input
              type="checkbox"
              checked={layout.mobileCompactMode}
              onChange={(event) => onLayoutChange("mobileCompactMode", event.target.checked)}
              style={checkboxStyle}
            />
          </label>
        </div>
      </section>

      <section style={previewPanelStyle}>
        <div style={previewHeaderStyle}>
          <div>
            <span style={eyebrowStyle}>Live Preview</span>
            <h3 style={sectionTitleStyle}>Layout Preview</h3>
            <p style={sectionCopyStyle}>Preview max width, section padding, gaps, container radius, and mobile compact mode.</p>
          </div>
        </div>
        <LayoutPreview colors={colors} typography={typography} buttons={buttons} cards={cards} layout={layout} />
      </section>
    </div>
  );
}

function ProductCardsTab({ colors, typography, buttons, cards, productCards, onProductCardChange }) {
  return (
    <div
      id="theme-settings-panel-product-cards"
      role="tabpanel"
      aria-labelledby="theme-settings-tab-product-cards"
      style={colorsLayoutStyle}
    >
      <section style={panelStyle}>
        <div>
          <span style={eyebrowStyle}>Theme / Product Cards</span>
          <h3 style={sectionTitleStyle}>Product Cards</h3>
          <p style={sectionCopyStyle}>Control ecommerce product card design.</p>
        </div>

        <div style={colorGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Product Card Image Ratio</span>
            <select value={productCards.imageRatio} onChange={(event) => onProductCardChange("imageRatio", event.target.value)} style={selectInputStyle}>
              {productImageRatioOptions.map((ratio) => (
                <option key={ratio} value={ratio}>{ratio}</option>
              ))}
            </select>
          </label>
          <NumberField label="Product Card Border Radius" suffix="px" min={0} max={40} step={1} value={productCards.borderRadius} onChange={(value) => onProductCardChange("borderRadius", value)} />
          <label style={fieldStyle}>
            <span style={labelStyle}>Product Card Shadow</span>
            <select value={productCards.shadowStyle} onChange={(event) => onProductCardChange("shadowStyle", event.target.value)} style={selectInputStyle}>
              {cardShadowOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <NumberField label="Product Title Lines" min={1} max={4} step={1} value={productCards.titleLines} onChange={(value) => onProductCardChange("titleLines", value)} />
          {productCardColorFields.map((field) => (
            <ColorField
              key={field.key}
              label={field.label}
              value={productCards[field.key]}
              isInvalid={!isValidHex(productCards[field.key])}
              onChange={(value) => onProductCardChange(field.key, value)}
            />
          ))}
          <ToggleField label="Show Discount Badge" checked={productCards.showDiscountBadge} onChange={(checked) => onProductCardChange("showDiscountBadge", checked)} />
          <ToggleField label="Show Rating" checked={productCards.showRating} onChange={(checked) => onProductCardChange("showRating", checked)} />
          <ToggleField label="Show Add to Cart Button" checked={productCards.showAddToCartButton} onChange={(checked) => onProductCardChange("showAddToCartButton", checked)} />
        </div>
      </section>

      <section style={previewPanelStyle}>
        <div style={previewHeaderStyle}>
          <div>
            <span style={eyebrowStyle}>Live Preview</span>
            <h3 style={sectionTitleStyle}>Product Card Preview</h3>
            <p style={sectionCopyStyle}>Preview image ratio, title clamp, price colors, badges, ratings, and add-to-cart button.</p>
          </div>
        </div>
        <ProductCardPreview colors={colors} typography={typography} buttons={buttons} cards={cards} productCards={productCards} />
      </section>
    </div>
  );
}

function CustomCssTab({ colors, typography, buttons, cards, productCards, customCss, onCustomCssChange }) {
  const cssValidationMessage = validateCustomCss(customCss.css);
  const scopedCss = cssValidationMessage ? "" : customCss.css;

  return (
    <div
      id="theme-settings-panel-custom-css"
      role="tabpanel"
      aria-labelledby="theme-settings-tab-custom-css"
      style={colorsLayoutStyle}
    >
      <section style={panelStyle}>
        <div>
          <span style={eyebrowStyle}>Theme / Custom CSS</span>
          <h3 style={sectionTitleStyle}>Custom CSS</h3>
          <p style={sectionCopyStyle}>Give admin controlled manual design editing without touching code.</p>
        </div>

        <label style={fieldStyle}>
          <span style={labelStyle}>Custom Website CSS</span>
          <textarea
            value={customCss.css}
            onChange={(event) => onCustomCssChange(event.target.value)}
            placeholder={".avyona-theme .product-card {\n  border-radius: 20px;\n}"}
            rows={16}
            spellCheck={false}
            maxLength={customCssMaxLength}
            style={cssTextareaStyle}
          />
        </label>

        <div style={cssRulesStyle}>
          <strong>Rules</strong>
          <span>CSS only. Scope selectors under <code>.avyona-theme</code>. Maximum {customCssMaxLength.toLocaleString()} characters.</span>
          <span>Blocked: script tags, javascript:, @import, expression(), iframe, onerror=, onclick=, and external URLs.</span>
        </div>
        <p style={cssValidationMessage ? errorTextStyle : helperTextStyle}>
          {cssValidationMessage || "Custom CSS is valid for preview."}
        </p>
      </section>

      <section style={previewPanelStyle}>
        <div style={previewHeaderStyle}>
          <div>
            <span style={eyebrowStyle}>Live Preview</span>
            <h3 style={sectionTitleStyle}>Scoped CSS Preview</h3>
            <p style={sectionCopyStyle}>CSS is applied only inside the .avyona-theme preview wrapper.</p>
          </div>
        </div>
        <div className="avyona-theme" style={customCssPreviewShellStyle}>
          {scopedCss ? <style>{scopedCss}</style> : null}
          <ProductCardPreview colors={colors} typography={typography} buttons={buttons} cards={cards} productCards={productCards} />
        </div>
      </section>
    </div>
  );
}

function PreviewTab({
  colors,
  typography,
  buttons,
  cards,
  layout,
  productCards,
  customCss,
  previewMode,
  onPreviewModeChange,
  onSaveTheme,
  isSaving,
  isLoading
}) {
  return (
    <section
      id="theme-settings-panel-preview"
      role="tabpanel"
      aria-labelledby="theme-settings-tab-preview"
      style={{ ...panelStyle, marginTop: "18px" }}
    >
      <div style={previewHeaderStyle}>
        <div>
          <span style={eyebrowStyle}>Theme / Preview</span>
          <h3 style={sectionTitleStyle}>Theme Preview</h3>
          <p style={sectionCopyStyle}>See theme effects before saving.</p>
        </div>
        <div style={headerActionStyle}>
          <button
            className={previewMode === "desktop" ? "dashboard-primary-button" : "dashboard-secondary-button"}
            type="button"
            onClick={() => onPreviewModeChange("desktop")}
          >
            Preview Desktop
          </button>
          <button
            className={previewMode === "mobile" ? "dashboard-primary-button" : "dashboard-secondary-button"}
            type="button"
            onClick={() => onPreviewModeChange("mobile")}
          >
            Preview Mobile
          </button>
          <button className="dashboard-primary-button" type="button" onClick={onSaveTheme} disabled={isSaving || isLoading}>
            <FaSave aria-hidden="true" /> {isSaving ? "Saving..." : "Save Theme"}
          </button>
        </div>
      </div>

      <div style={previewCheckGridStyle} aria-label="Theme preview checklist">
        {previewChecks.map((item) => (
          <span key={item} style={{
            ...previewCheckItemStyle,
            borderColor: item === "Mobile Preview" && previewMode === "mobile" ? colors.primaryColor : colors.borderColor,
            background: item === "Mobile Preview" && previewMode === "mobile" ? colors.backgroundColor : colors.surfaceColor,
            color: colors.textColor
          }}>
            <span style={{ ...previewCheckDotStyle, background: item === "Mobile Preview" && previewMode !== "mobile" ? colors.mutedTextColor : colors.successColor }} />
            {item}
          </span>
        ))}
      </div>

      <FullThemePreview
        colors={colors}
        typography={typography}
        buttons={buttons}
        cards={cards}
        layout={layout}
        productCards={productCards}
        customCss={customCss}
        previewMode={previewMode}
      />
    </section>
  );
}

function FullThemePreview({ colors, typography, buttons, cards, layout, productCards, customCss, previewMode }) {
  const cssValidationMessage = validateCustomCss(customCss.css);
  const scopedCss = cssValidationMessage ? "" : customCss.css;
  const fontFamily = resolvePreviewFontFamily(typography.fontFamily);
  const isMobile = previewMode === "mobile";
  const aspectRatio = productCards.imageRatio.replace(":", " / ");
  const previewWidth = isMobile ? "390px" : "100%";
  const sectionPadding = isMobile
    ? Math.max(14, Math.round((layout.mobileCompactMode ? layout.sectionPaddingMobile * 0.45 : layout.sectionPaddingMobile * 0.6)))
    : Math.max(22, Math.round(layout.sectionPaddingDesktop / 2));
  const sectionGap = Math.max(12, Math.round(layout.sectionGap / 2));
  const previewLabel = isMobile ? "Mobile Preview" : "Desktop Preview";
  const typeStyle = {
    fontFamily,
    fontSize: `${typography.baseFontSize}px`,
    fontWeight: typography.bodyFontWeight,
    lineHeight: typography.lineHeight,
    letterSpacing: `${typography.letterSpacing}px`
  };
  const productCardStyle = {
    ...getCardStyle({
      ...cards,
      borderRadius: productCards.borderRadius,
      shadowStyle: productCards.shadowStyle
    }),
    color: colors.textColor
  };

  return (
    <div style={fullPreviewStageStyle}>
      <div
        className="avyona-theme"
        style={{
          ...fullPreviewOuterStyle,
          ...typeStyle,
          width: previewWidth,
          maxWidth: previewWidth,
          background: colors.backgroundColor,
          color: colors.textColor,
          borderColor: colors.borderColor,
          borderRadius: `${layout.containerRadius}px`
        }}
      >
        {scopedCss ? <style>{scopedCss}</style> : null}

        <div style={{ ...fullPreviewModeBarStyle, background: colors.secondaryColor, color: buttons.primaryTextColor }}>
          <strong>{previewLabel}</strong>
          <span>{isMobile ? "390px storefront check" : "Full-width storefront check"}</span>
        </div>

        <header
          style={{
            ...fullPreviewHeaderStyle,
            gridTemplateColumns: isMobile ? "1fr auto" : "150px minmax(160px, 1fr) auto",
            background: colors.surfaceColor,
            borderColor: colors.borderColor
          }}
        >
          <strong style={{ ...fullPreviewLogoStyle, color: colors.secondaryColor }}>
            <span style={{ width: "18px", height: "18px", borderRadius: "999px", background: colors.primaryColor }} />
            avyona
          </strong>
          {!isMobile ? (
            <div style={{ ...searchBoxStyle, borderColor: colors.borderColor }}>
              <span style={{ color: colors.mutedTextColor }}>Search products, brands and more...</span>
              <span style={{ ...searchButtonStyle, background: colors.primaryColor }}><FaSearch aria-hidden="true" /></span>
            </div>
          ) : null}
          <div style={fullPreviewHeaderActionsStyle}>
            <FaUser aria-hidden="true" />
            <FaShoppingCart aria-hidden="true" />
          </div>
        </header>

        <main style={{ ...fullPreviewMainStyle, padding: `${sectionPadding}px`, gap: `${sectionGap}px` }}>
          <section
            style={{
              ...fullPreviewHeroStyle,
              gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) 220px",
              gap: `${sectionGap}px`
            }}
          >
            <div>
              <p style={{ ...previewEyebrowStyle, color: colors.accentColor }}>Style that moves with you</p>
              <h4 style={{ margin: "8px 0", color: colors.textColor, fontWeight: typography.headingFontWeight, fontSize: isMobile ? "22px" : "30px", lineHeight: 1.15 }}>
                Curated premium electronic products
              </h4>
              <p style={{ margin: 0, maxWidth: "420px", color: colors.mutedTextColor }}>Theme colors, typography, cards, buttons, spacing, and ecommerce components in one preview.</p>
              <div style={fullPreviewButtonRowStyle}>
                <button type="button" className="primary-button" style={getPrimaryButtonStyle(buttons)}>Add to Cart</button>
                <button type="button" className="secondary-button" style={getSecondaryButtonStyle(buttons, colors)}>Read More</button>
              </div>
            </div>
            <article className="category-card" style={{ ...getCardStyle(cards), display: "grid", gap: "10px", alignContent: "center" }}>
              <span style={{ ...sampleCategoryIconStyle, background: colors.primaryColor }} />
              <strong style={{ color: colors.textColor }}>Audio</strong>
              <span style={{ color: colors.mutedTextColor, fontSize: "13px" }}>Category card sample</span>
            </article>
          </section>

          <section
            style={{
              ...fullPreviewGridStyle,
              gridTemplateColumns: isMobile ? "1fr" : "minmax(210px, 0.9fr) minmax(260px, 1.1fr) minmax(220px, 0.9fr)"
            }}
          >
            <article className="product-card" style={productCardStyle}>
              <div style={{ ...productPreviewImageStyle, aspectRatio, background: colors.backgroundColor }}>
                {productCards.showDiscountBadge ? <span style={{ ...discountBadgeStyle, background: colors.errorColor }}>20% OFF</span> : null}
                <div style={{ ...sampleImageStyle, background: buttons.primaryBackground }} />
              </div>
              <div style={productPreviewBodyStyle}>
                <strong style={{ ...productPreviewTitleStyle, WebkitLineClamp: productCards.titleLines }}>
                  Premium Wireless Headphones
                </strong>
                {productCards.showRating ? <span style={{ color: colors.accentColor, fontWeight: 900 }}>Rating 4.5 <small style={{ color: colors.mutedTextColor }}>(128)</small></span> : null}
                <div style={priceRowStyle}>
                  <strong style={{ color: productCards.priceColor }}>INR 4,999</strong>
                  <span style={{ color: productCards.mrpColor, textDecoration: "line-through" }}>INR 6,999</span>
                </div>
                {productCards.showAddToCartButton ? <button type="button" style={getPrimaryButtonStyle(buttons)}>Add to Cart</button> : null}
              </div>
            </article>

            <article style={{ ...getCardStyle(cards), display: "grid", gap: "14px" }}>
              <strong style={{ color: colors.textColor }}>Form Sample</strong>
              <div style={sampleFormStyle}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Name</span>
                  <input value="Aarav Sharma" readOnly style={{ ...sampleInputStyle, borderColor: colors.borderColor, background: colors.surfaceColor, color: colors.textColor }} />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Message</span>
                  <textarea value="Please help me choose the right camera." readOnly rows={3} style={{ ...sampleInputStyle, borderColor: colors.borderColor, background: colors.surfaceColor, color: colors.textColor, resize: "none", paddingTop: "10px" }} />
                </label>
                <button type="button" style={getPrimaryButtonStyle(buttons)}>Submit</button>
              </div>
            </article>

            <article style={{ ...getCardStyle(cards), display: "grid", gap: "12px", alignContent: "start" }}>
              <strong style={{ color: colors.textColor }}>Review Card</strong>
              <span style={{ ...reviewStarsStyle, color: colors.successColor }}>5.0 rating</span>
              <p style={{ margin: 0, color: colors.mutedTextColor }}>Clean layout, fast delivery, and the theme preview keeps every storefront part easy to inspect.</p>
              <strong style={{ color: colors.textColor }}>Priya M.</strong>
            </article>
          </section>
        </main>

        <footer style={{ ...fullPreviewFooterStyle, background: colors.secondaryColor, color: buttons.primaryTextColor }}>
          <strong>avyona</strong>
          <span>Footer sample</span>
          <span>Support | Contact | Track Order</span>
        </footer>
      </div>
    </div>
  );
}

function ToggleField({ label, checked, onChange }) {
  return (
    <label style={toggleCardStyle}>
      <span>
        <strong style={labelStyle}>{label}</strong>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} style={checkboxStyle} />
    </label>
  );
}

function NumberField({ label, value, min, max, step, suffix = "", onChange }) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={numberInputShellStyle}>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          style={numberInputStyle}
        />
        {suffix ? <span style={inputSuffixStyle}>{suffix}</span> : null}
      </span>
    </label>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <select value={value} onChange={(event) => onChange(Number(event.target.value))} style={selectInputStyle}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function ColorField({ label, value, isInvalid, onChange }) {
  const safePickerValue = isValidHex(value) ? value : "#000000";

  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={{ ...colorInputShellStyle, borderColor: isInvalid ? "#FCA5A5" : "#dbe3ec" }}>
        <input
          type="color"
          value={safePickerValue}
          onChange={(event) => onChange(event.target.value)}
          style={colorPickerStyle}
          aria-label={`${label} picker`}
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={hexInputStyle}
          aria-label={label}
          maxLength={7}
        />
      </span>
    </label>
  );
}

function ThemePreview({ colors, typography, buttons, cards }) {
  const fontFamily = resolvePreviewFontFamily(typography.fontFamily);
  const typeStyle = {
    fontFamily,
    fontSize: `${typography.baseFontSize}px`,
    fontWeight: typography.bodyFontWeight,
    lineHeight: typography.lineHeight,
    letterSpacing: `${typography.letterSpacing}px`
  };

  return (
    <div style={{ ...storefrontPreviewStyle, ...typeStyle, background: colors.backgroundColor, color: colors.textColor, borderColor: colors.borderColor }}>
      <div style={{ ...previewNavStyle, background: colors.surfaceColor, borderColor: colors.borderColor }}>
        <strong style={{ color: colors.secondaryColor }}>avyona</strong>
        <div style={{ ...searchBoxStyle, borderColor: colors.borderColor }}>
          <span style={{ color: colors.mutedTextColor }}>Search products...</span>
          <span style={{ ...searchButtonStyle, background: colors.primaryColor }}><FaSearch aria-hidden="true" /></span>
        </div>
        <span style={previewIconStyle}><FaUser aria-hidden="true" /></span>
        <span style={previewIconStyle}><FaShoppingCart aria-hidden="true" /></span>
      </div>

      <div style={previewHeroStyle}>
        <div>
          <p style={{ ...previewEyebrowStyle, color: colors.accentColor }}>Style that moves with you</p>
          <h4 style={{ margin: "8px 0", color: colors.textColor, fontWeight: typography.headingFontWeight }}>Curated premium electronic products</h4>
          <p style={{ margin: 0, color: colors.mutedTextColor }}>From trusted domestic and global imported brands.</p>
          <button type="button" style={getPrimaryButtonStyle(buttons)}>
            Shop Now
          </button>
        </div>
        <div style={{ ...previewProductStyle, ...getCardStyle(cards), borderColor: cards.borderColor }}>
          <span style={{ background: colors.secondaryColor }} />
          <strong style={{ color: colors.textColor }}>Product Card</strong>
          <small style={{ color: colors.mutedTextColor }}>Card surface and border preview</small>
        </div>
      </div>

      <div style={componentPreviewGridStyle}>
        <div style={{ ...componentCardStyle, borderColor: colors.borderColor, background: colors.surfaceColor }}>
          <span style={{ color: colors.mutedTextColor }}>Success</span>
          <strong style={{ color: colors.successColor }}>Order confirmed</strong>
        </div>
        <div style={{ ...componentCardStyle, borderColor: colors.borderColor, background: colors.surfaceColor }}>
          <span style={{ color: colors.mutedTextColor }}>Error</span>
          <strong style={{ color: colors.errorColor }}>Payment failed</strong>
        </div>
      </div>
    </div>
  );
}

function ButtonPreview({ colors, typography, buttons }) {
  const fontFamily = resolvePreviewFontFamily(typography.fontFamily);
  const typeStyle = {
    fontFamily,
    fontSize: `${typography.baseFontSize}px`,
    lineHeight: typography.lineHeight,
    letterSpacing: `${typography.letterSpacing}px`
  };
  const buttonLabels = ["Add to Cart", "Buy Now", "Submit", "Continue Shopping", "Track Order", "Read More"];

  return (
    <div style={{ ...buttonPreviewStyle, ...typeStyle, background: colors.backgroundColor, borderColor: colors.borderColor }}>
      <div style={buttonPreviewGridStyle}>
        {buttonLabels.map((label, index) => (
          <button
            key={label}
            type="button"
            style={index % 2 === 0 ? getPrimaryButtonStyle(buttons) : getSecondaryButtonStyle(buttons, colors)}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ ...hoverPreviewStyle, background: colors.surfaceColor, borderColor: colors.borderColor }}>
        <span style={{ color: colors.mutedTextColor }}>Hover Style</span>
        <strong style={{ color: colors.textColor }}>{buttonHoverOptions.find((option) => option.value === buttons.hoverStyle)?.label || "Darken"}</strong>
      </div>
    </div>
  );
}

function CardPreview({ colors, typography, buttons, cards }) {
  const fontFamily = resolvePreviewFontFamily(typography.fontFamily);
  const cardLabels = ["Product Card", "Category Card", "Profile Card", "Contact Card", "Review Card", "Dashboard Preview"];

  return (
    <div style={{ ...cardPreviewShellStyle, background: colors.backgroundColor, borderColor: colors.borderColor, fontFamily }}>
      {cardLabels.map((label, index) => (
        <article key={label} style={{ ...cardPreviewItemStyle, ...getCardStyle(cards) }}>
          <span style={{ ...cardPreviewIconStyle, background: index % 2 === 0 ? buttons.primaryBackground : colors.accentColor }} />
          <strong style={{ color: colors.textColor }}>{label}</strong>
          <p style={{ margin: 0, color: colors.mutedTextColor }}>Common surface, border, radius, padding, and shadow preview.</p>
        </article>
      ))}
    </div>
  );
}

function LayoutPreview({ colors, typography, buttons, cards, layout }) {
  const fontFamily = resolvePreviewFontFamily(typography.fontFamily);
  const scaleWidth = Math.max(68, Math.min(100, Math.round((layout.websiteMaxWidth / 1800) * 100)));
  const mobilePadding = layout.mobileCompactMode ? Math.max(8, Math.round(layout.sectionPaddingMobile * 0.62)) : layout.sectionPaddingMobile;

  return (
    <div style={{ ...layoutPreviewShellStyle, background: colors.backgroundColor, borderColor: colors.borderColor, fontFamily }}>
      <div style={{ ...layoutPreviewContainerStyle, width: `${scaleWidth}%`, borderRadius: `${layout.containerRadius}px`, padding: `${Math.round(layout.sectionPaddingDesktop / 4)}px`, gap: `${Math.round(layout.sectionGap / 4)}px` }}>
        <section style={{ ...getCardStyle(cards), display: "grid", gap: "10px" }}>
          <strong style={{ color: colors.textColor }}>Desktop Section</strong>
          <p style={{ margin: 0, color: colors.mutedTextColor }}>Max width {layout.websiteMaxWidth}px with {layout.sectionPaddingDesktop}px section padding.</p>
          <button type="button" style={getPrimaryButtonStyle(buttons)}>Shop Now</button>
        </section>
        <section style={{ ...getCardStyle(cards), display: "grid", gap: "10px" }}>
          <strong style={{ color: colors.textColor }}>Section Gap</strong>
          <p style={{ margin: 0, color: colors.mutedTextColor }}>Current spacing rhythm: {layout.sectionGap}px.</p>
        </section>
      </div>

      <div style={{ ...mobilePreviewStyle, borderColor: colors.borderColor, borderRadius: `${layout.containerRadius}px`, padding: `${Math.round(mobilePadding / 3)}px` }}>
        <strong style={{ color: colors.textColor }}>Mobile</strong>
        <span style={{ color: colors.mutedTextColor }}>{layout.mobileCompactMode ? "Compact mode on" : "Standard spacing"}</span>
      </div>
    </div>
  );
}

function ProductCardPreview({ colors, typography, buttons, cards, productCards }) {
  const fontFamily = resolvePreviewFontFamily(typography.fontFamily);
  const aspectRatio = productCards.imageRatio.replace(":", " / ");
  const cardStyle = {
    ...getCardStyle({
      ...cards,
      borderRadius: productCards.borderRadius,
      shadowStyle: productCards.shadowStyle
    }),
    fontFamily,
    color: colors.textColor
  };

  return (
    <div style={{ ...productCardPreviewShellStyle, background: colors.backgroundColor, borderColor: colors.borderColor }}>
      <article style={{ ...productPreviewCardStyle, ...cardStyle }}>
        <div style={{ ...productPreviewImageStyle, aspectRatio, background: colors.backgroundColor }}>
          {productCards.showDiscountBadge ? <span style={{ ...discountBadgeStyle, background: colors.errorColor }}>20% OFF</span> : null}
          <div style={{ ...productPreviewObjectStyle, background: buttons.primaryBackground }} />
        </div>
        <div style={productPreviewBodyStyle}>
          <strong style={{ ...productPreviewTitleStyle, WebkitLineClamp: productCards.titleLines }}>
            Premium Wireless Headphones with Noise Isolation
          </strong>
          {productCards.showRating ? <span style={{ color: colors.accentColor, fontWeight: 900 }}>★ 4.5 <small style={{ color: colors.mutedTextColor }}>(128)</small></span> : null}
          <div style={priceRowStyle}>
            <strong style={{ color: productCards.priceColor }}>₹4,999</strong>
            <span style={{ color: productCards.mrpColor, textDecoration: "line-through" }}>₹6,999</span>
          </div>
          {productCards.showAddToCartButton ? <button type="button" style={getPrimaryButtonStyle(buttons)}>Add to Cart</button> : null}
        </div>
      </article>
    </div>
  );
}

function getShadowValue(shadowStyle) {
  if (shadowStyle === "none") return "none";
  if (shadowStyle === "subtle") return "0 6px 16px rgba(15, 23, 42, 0.06)";
  if (shadowStyle === "elevated") return "0 18px 45px rgba(15, 23, 42, 0.14)";
  if (shadowStyle === "strong") return "0 26px 70px rgba(15, 23, 42, 0.22)";
  return "0 12px 30px rgba(15, 23, 42, 0.10)";
}

function getCardStyle(cards) {
  return {
    padding: `${cards.padding}px`,
    borderRadius: `${cards.borderRadius}px`,
    border: `1px solid ${cards.borderColor}`,
    background: cards.background,
    boxShadow: getShadowValue(cards.shadowStyle)
  };
}

function getPrimaryButtonStyle(buttons) {
  return {
    minHeight: `${buttons.height}px`,
    padding: "0 18px",
    border: 0,
    borderRadius: `${buttons.borderRadius}px`,
    background: buttons.primaryBackground,
    color: buttons.primaryTextColor,
    fontWeight: buttons.fontWeight,
    cursor: "pointer"
  };
}

function getSecondaryButtonStyle(buttons, colors) {
  return {
    minHeight: `${buttons.height}px`,
    padding: "0 18px",
    border: `1px solid ${colors.borderColor}`,
    borderRadius: `${buttons.borderRadius}px`,
    background: buttons.secondaryBackground,
    color: buttons.secondaryTextColor,
    fontWeight: buttons.fontWeight,
    cursor: "pointer"
  };
}

const headerActionStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap"
};

const tabsStyle = {
  display: "flex",
  gap: "10px",
  marginTop: "18px",
  overflowX: "auto",
  padding: "10px",
  borderRadius: "14px",
  border: "1px solid #dbe3ec",
  background: "#ffffff"
};

const tabStyle = {
  minHeight: "40px",
  padding: "0 14px",
  borderRadius: "10px",
  border: "1px solid transparent",
  background: "#ffffff",
  color: "#334155",
  fontSize: "13px",
  fontWeight: 900,
  whiteSpace: "nowrap",
  cursor: "pointer"
};

const activeTabStyle = {
  ...tabStyle,
  borderColor: "#bbf7d0",
  background: "#ecfdf3",
  color: "#16a34a"
};

const colorsLayoutStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(360px, 0.85fr) minmax(420px, 1.15fr)",
  gap: "18px",
  marginTop: "18px",
  alignItems: "start"
};

const panelStyle = {
  display: "grid",
  gap: "18px",
  padding: "22px",
  borderRadius: "16px",
  border: "1px solid #dbe3ec",
  background: "#ffffff",
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.06)"
};

const previewPanelStyle = {
  ...panelStyle,
  minWidth: 0
};

const previewHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "start"
};

const eyebrowStyle = {
  display: "inline-flex",
  color: "#16a34a",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: "8px"
};

const sectionTitleStyle = {
  margin: 0,
  color: "#0f172a",
  fontSize: "24px"
};

const sectionCopyStyle = {
  margin: "8px 0 0",
  color: "#526377",
  lineHeight: 1.6,
  maxWidth: "760px"
};

const colorGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "16px"
};

const typographyGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "16px"
};

const fieldStyle = {
  display: "grid",
  gap: "8px"
};

const labelStyle = {
  color: "#111827",
  fontSize: "12px",
  fontWeight: 900
};

const colorInputShellStyle = {
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr)",
  alignItems: "center",
  gap: "10px",
  minHeight: "42px",
  padding: "5px",
  border: "1px solid #dbe3ec",
  borderRadius: "8px",
  background: "#ffffff"
};

const colorPickerStyle = {
  width: "30px",
  height: "30px",
  padding: 0,
  border: 0,
  borderRadius: "6px",
  background: "transparent",
  cursor: "pointer"
};

const hexInputStyle = {
  width: "100%",
  border: 0,
  outline: 0,
  color: "#111827",
  fontSize: "13px",
  fontWeight: 900,
  textTransform: "uppercase"
};

const selectInputStyle = {
  width: "100%",
  minHeight: "42px",
  border: "1px solid #dbe3ec",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#111827",
  fontSize: "13px",
  fontWeight: 800,
  padding: "0 12px"
};

const numberInputShellStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  minHeight: "42px",
  border: "1px solid #dbe3ec",
  borderRadius: "8px",
  background: "#ffffff",
  overflow: "hidden"
};

const numberInputStyle = {
  width: "100%",
  border: 0,
  outline: 0,
  color: "#111827",
  fontSize: "13px",
  fontWeight: 900,
  padding: "0 12px"
};

const inputSuffixStyle = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 800,
  paddingRight: "12px"
};

const toggleCardStyle = {
  minHeight: "42px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "10px 12px",
  border: "1px solid #dbe3ec",
  borderRadius: "8px",
  background: "#ffffff"
};

const toggleHelpStyle = {
  display: "block",
  marginTop: "4px",
  color: "#64748b",
  fontSize: "12px",
  lineHeight: 1.35
};

const checkboxStyle = {
  width: "18px",
  height: "18px",
  accentColor: "#16a34a"
};

const cssTextareaStyle = {
  width: "100%",
  minHeight: "330px",
  resize: "vertical",
  boxSizing: "border-box",
  border: "1px solid #dbe3ec",
  borderRadius: "10px",
  background: "#0f172a",
  color: "#e5e7eb",
  fontFamily: "Consolas, Monaco, monospace",
  fontSize: "13px",
  lineHeight: 1.55,
  padding: "14px"
};

const cssRulesStyle = {
  display: "grid",
  gap: "6px",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #dbe3ec",
  background: "#f8fafc",
  color: "#475569",
  fontSize: "13px",
  lineHeight: 1.45
};

const helperTextStyle = {
  margin: 0,
  color: "#0f766e",
  fontSize: "13px",
  fontWeight: 800
};

const errorTextStyle = {
  ...helperTextStyle,
  color: "#b91c1c"
};

const storefrontPreviewStyle = {
  overflow: "hidden",
  border: "1px solid",
  borderRadius: "14px"
};

const previewNavStyle = {
  display: "grid",
  gridTemplateColumns: "120px minmax(180px, 1fr) 34px 34px",
  gap: "12px",
  alignItems: "center",
  padding: "16px",
  borderBottom: "1px solid"
};

const searchBoxStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  minHeight: "40px",
  border: "1px solid",
  borderRadius: "8px",
  background: "#ffffff",
  overflow: "hidden",
  fontSize: "12px"
};

const searchButtonStyle = {
  display: "grid",
  placeItems: "center",
  alignSelf: "stretch",
  width: "42px",
  color: "#ffffff"
};

const previewIconStyle = {
  display: "grid",
  placeItems: "center",
  color: "#111827"
};

const previewHeroStyle = {
  display: "grid",
  gridTemplateColumns: "1.1fr 0.9fr",
  gap: "18px",
  alignItems: "center",
  padding: "34px 26px"
};

const previewEyebrowStyle = {
  margin: 0,
  fontSize: "12px",
  fontWeight: 900
};

const previewButtonStyle = {
  marginTop: "18px",
  minHeight: "40px",
  padding: "0 18px",
  border: 0,
  borderRadius: "8px",
  color: "#ffffff",
  fontWeight: 900
};

const previewProductStyle = {
  display: "grid",
  gap: "8px",
  minHeight: "160px",
  padding: "18px",
  border: "1px solid",
  borderRadius: "14px",
  alignContent: "center"
};

const componentPreviewGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px",
  padding: "0 16px 16px"
};

const componentCardStyle = {
  display: "grid",
  gap: "6px",
  padding: "14px",
  border: "1px solid",
  borderRadius: "10px"
};

const buttonPreviewStyle = {
  display: "grid",
  gap: "16px",
  padding: "18px",
  border: "1px solid",
  borderRadius: "14px"
};

const buttonPreviewGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px"
};

const hoverPreviewStyle = {
  display: "grid",
  gap: "6px",
  padding: "14px",
  border: "1px solid",
  borderRadius: "10px"
};

const cardPreviewShellStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "14px",
  padding: "18px",
  border: "1px solid",
  borderRadius: "14px"
};

const cardPreviewItemStyle = {
  display: "grid",
  gap: "8px",
  alignContent: "start",
  minHeight: "150px"
};

const cardPreviewIconStyle = {
  width: "42px",
  height: "42px",
  borderRadius: "10px"
};

const layoutPreviewShellStyle = {
  display: "grid",
  gap: "18px",
  padding: "18px",
  border: "1px solid",
  borderRadius: "14px"
};

const layoutPreviewContainerStyle = {
  display: "grid",
  margin: "0 auto",
  border: "1px dashed #cbd5e1",
  background: "rgba(255,255,255,0.62)"
};

const mobilePreviewStyle = {
  width: "min(190px, 100%)",
  display: "grid",
  gap: "6px",
  border: "1px solid",
  background: "#ffffff"
};

const productCardPreviewShellStyle = {
  display: "grid",
  justifyItems: "center",
  padding: "18px",
  border: "1px solid",
  borderRadius: "14px"
};

const customCssPreviewShellStyle = {
  display: "grid",
  gap: "12px"
};

const productPreviewCardStyle = {
  width: "min(280px, 100%)",
  overflow: "hidden"
};

const fullPreviewStageStyle = {
  display: "flex",
  justifyContent: "center",
  overflowX: "auto",
  padding: "8px 0 2px"
};

const fullPreviewOuterStyle = {
  minWidth: "280px",
  overflow: "hidden",
  border: "1px solid",
  transition: "width 180ms ease, max-width 180ms ease"
};

const fullPreviewModeBarStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "9px 14px",
  fontSize: "12px",
  fontWeight: 800
};

const fullPreviewHeaderStyle = {
  display: "grid",
  gap: "14px",
  alignItems: "center",
  padding: "16px",
  borderBottom: "1px solid"
};

const fullPreviewLogoStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "20px",
  fontWeight: 900
};

const fullPreviewHeaderActionsStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "14px"
};

const fullPreviewMainStyle = {
  display: "grid"
};

const fullPreviewHeroStyle = {
  display: "grid",
  alignItems: "center"
};

const fullPreviewButtonRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginTop: "18px"
};

const fullPreviewGridStyle = {
  display: "grid",
  gap: "14px",
  alignItems: "stretch"
};

const fullPreviewFooterStyle = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: "10px",
  padding: "16px",
  fontSize: "13px"
};

const previewCheckGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "10px",
  marginBottom: "16px"
};

const previewCheckItemStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  minHeight: "38px",
  padding: "0 12px",
  border: "1px solid",
  borderRadius: "12px",
  fontSize: "13px",
  fontWeight: 800
};

const previewCheckDotStyle = {
  width: "9px",
  height: "9px",
  borderRadius: "999px",
  flex: "0 0 auto"
};

const sampleImageStyle = {
  width: "46%",
  aspectRatio: "1 / 1",
  borderRadius: "999px",
  boxShadow: "inset -18px -14px 0 rgba(0,0,0,0.12)"
};

const sampleCategoryIconStyle = {
  width: "48px",
  height: "48px",
  borderRadius: "14px",
  boxShadow: "inset -12px -10px 0 rgba(0,0,0,0.12)"
};

const sampleFormStyle = {
  display: "grid",
  gap: "12px"
};

const sampleInputStyle = {
  width: "100%",
  minHeight: "42px",
  boxSizing: "border-box",
  border: "1px solid",
  borderRadius: "8px",
  background: "#ffffff",
  padding: "0 12px",
  outline: 0,
  font: "inherit"
};

const reviewStarsStyle = {
  fontSize: "13px",
  fontWeight: 900
};

const productPreviewImageStyle = {
  position: "relative",
  display: "grid",
  placeItems: "center",
  width: "100%",
  borderRadius: "10px",
  overflow: "hidden"
};

const discountBadgeStyle = {
  position: "absolute",
  top: "10px",
  left: "10px",
  color: "#ffffff",
  fontSize: "11px",
  fontWeight: 900,
  padding: "5px 8px",
  borderRadius: "999px"
};

const productPreviewObjectStyle = {
  width: "44%",
  aspectRatio: "1 / 1",
  borderRadius: "999px",
  boxShadow: "inset -18px -14px 0 rgba(0,0,0,0.12)"
};

const productPreviewBodyStyle = {
  display: "grid",
  gap: "10px",
  paddingTop: "14px"
};

const productPreviewTitleStyle = {
  display: "-webkit-box",
  overflow: "hidden",
  WebkitBoxOrient: "vertical",
  lineHeight: 1.35
};

const priceRowStyle = {
  display: "flex",
  alignItems: "baseline",
  gap: "8px"
};

const panelBodyStyle = {
  minHeight: "220px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  borderRadius: "14px",
  border: "1px dashed #cbd5e1",
  background: "#f8fafc",
  color: "#475569",
  textAlign: "center"
};
