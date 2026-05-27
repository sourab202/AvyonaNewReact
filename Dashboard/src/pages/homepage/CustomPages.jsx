import React from "react";
import { Link } from "react-router-dom";
import {
  FaColumns,
  FaCopy,
  FaDesktop,
  FaEdit,
  FaEye,
  FaGripVertical,
  FaHeading,
  FaImage,
  FaLink,
  FaMobileAlt,
  FaMousePointer,
  FaPaperPlane,
  FaPlus,
  FaQuestionCircle,
  FaRegSave,
  FaSearch,
  FaTrash,
  FaFont
} from "react-icons/fa";
import {
  createBlock as createBlockRequest,
  createPage as createPageRequest,
  deletePage as deletePageRequest,
  deleteBlock as deleteBlockRequest,
  duplicatePage as duplicatePageRequest,
  getPage,
  getPages,
  reorderBlocks as reorderBlocksRequest,
  updateBlock as updateBlockRequest,
  updatePage as updatePageRequest,
  updatePageStatus as updatePageStatusRequest,
  uploadPageImage
} from "../../api/pagesApi";

const statusOptions = ["All Status", "Active", "Inactive", "Draft", "Published"];
const locationOptions = ["All Locations", "Header", "Footer", "Both", "Hidden", "Draft Only"];
const pageTypeOptions = ["Policy Page", "About Page", "Landing Page", "Information Page", "Custom Page"];
const pageStatusOptions = ["Draft", "Active", "Inactive"];
const robotsOptions = ["index/follow", "noindex/follow", "noindex/nofollow"];
const contentWidthOptions = ["Default", "Narrow", "Wide", "Full Width"];
const blockTypeOptions = [
  { id: "text", type: "Text Block", label: "Text", icon: FaFont },
  { id: "image", type: "Image Block", label: "Image", icon: FaImage },
  {
    id: "image-text-left",
    type: "Image + Text Block",
    label: "Left Image + Right Text",
    icon: FaColumns,
    defaults: { imageTextLayout: "image-left", title: "Left Image + Right Text Section" }
  },
  {
    id: "image-text-right",
    type: "Image + Text Block",
    label: "Right Image + Left Text",
    icon: FaColumns,
    defaults: { imageTextLayout: "text-left", title: "Right Image + Left Text Section" }
  },
  { id: "heading", type: "Heading Block", label: "Heading", icon: FaHeading },
  { id: "banner", type: "Full Width Banner", label: "Banner", icon: FaImage },
  { id: "two-column", type: "Two Column Content", label: "Two Column", icon: FaColumns },
  { id: "faq", type: "FAQ Block", label: "FAQ", icon: FaQuestionCircle },
  { id: "button", type: "CTA Button Block", label: "Button", icon: FaMousePointer }
];

const blockTypeValueByLabel = {
  "Text Block": "text",
  "Image Block": "image",
  "Image + Text Block": "image_text",
  "Heading Block": "heading",
  "Full Width Banner": "banner",
  "Two Column Content": "two_column",
  "FAQ Block": "faq",
  "CTA Button Block": "button"
};

const pageTypeValueByLabel = {
  "Policy Page": "policy",
  "About Page": "about",
  "Landing Page": "landing",
  "Information Page": "information",
  "Custom Page": "custom"
};

const pageTypeLabelByValue = Object.fromEntries(
  Object.entries(pageTypeValueByLabel).map(([label, value]) => [value, label])
);

function getNowLabel() {
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date()).replace(",", "");
}

function createSlug(title) {
  return String(title || "new-page")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "new-page";
}

function getDefaultBlockContent(type) {
  if (type === "Heading Block") return "Section heading";
  if (type === "Image Block") return "Image URL or uploaded image will appear here";
  if (type === "Image + Text Block") return "Image with supporting text";
  if (type === "Full Width Banner") return "Banner headline";
  if (type === "Two Column Content") return "Left column | Right column";
  if (type === "FAQ Block") return "Question? Answer.";
  if (type === "CTA Button Block") return "Button label and destination";
  return "Write page content here";
}

function createDefaultImageSettings() {
  return {
    imageUrl: "",
    imageName: "",
    imageAltText: "",
    imageCaption: "",
    imagePosition: "top",
    imageWidth: "100%",
    borderRadius: 0
  };
}

function createDefaultTextSettings() {
  return {
    textHeading: "Text heading",
    paragraphText: "Write page content here",
    textAlign: "left",
    fontSize: 16,
    textColor: "#0f172a",
    backgroundColor: "#ffffff",
    padding: 24,
    customCssClass: ""
  };
}

function createDefaultImageTextSettings() {
  return {
    ...createDefaultImageSettings(),
    imageTextHeading: "Image and text heading",
    imageTextParagraph: "Write supporting content for this image and text section.",
    buttonText: "",
    buttonLink: "",
    imageTextLayout: "image-left",
    imageTextAlign: "left"
  };
}

function createDefaultBlock(type = "Text Block", sortOrder = 1, defaults = {}) {
  const baseBlock = {
    id: `page-block-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    title: type.replace(" Block", " Section"),
    content: getDefaultBlockContent(type),
    status: "active",
    sortOrder
  };

  if (type === "Text Block") return { ...baseBlock, ...createDefaultTextSettings() };
  if (type === "Image Block") return { ...baseBlock, ...createDefaultImageSettings() };
  if (type === "Image + Text Block") return { ...baseBlock, ...createDefaultImageTextSettings(), ...defaults };
  return { ...baseBlock, ...defaults };
}

function createDefaultStyleSettings() {
  return {
    pageBackgroundColor: "#ffffff",
    textColor: "#333333",
    defaultFontSize: 16,
    contentWidth: "Default",
    sectionSpacing: 32,
    customCss: ".avyona-custom-page {\n  line-height: 1.8;\n}"
  };
}

function createDefaultSeoSettings(title = "") {
  return {
    metaTitle: title,
    metaDescription: "",
    metaKeywords: "",
    canonicalUrl: "",
    ogTitle: title,
    ogDescription: "",
    ogImageUrl: "",
    ogImageName: "",
    imageAltText: "",
    imageTitle: "",
    imageCaption: "",
    robotsSetting: "index/follow"
  };
}

function getBlockIcon(type) {
  return blockTypeOptions.find((option) => option.type === type)?.icon || FaFont;
}

function getBlockSummary(block) {
  if (block.type === "Text Block") return block.textHeading || block.paragraphText || "Text content";
  if (block.type === "Image Block") return block.imageCaption || block.imageName || "Image section";
  return block.content || block.title || block.type;
}

function deriveShowIn(visibility = {}) {
  if (visibility.draftOnly) return "Draft Only";
  if (visibility.hiddenLive) return "Hidden";
  if (visibility.header && visibility.footer) return "Both";
  if (visibility.header) return "Header";
  if (visibility.footer) return "Footer";
  return "Hidden";
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date).replace(",", "");
}

function mapApiPageToDashboardPage(page = {}) {
  const visibility = {
    header: Boolean(page.showInHeader),
    footer: Boolean(page.showInFooter),
    hiddenLive: Boolean(page.isLiveUrlEnabled) && !page.showInHeader && !page.showInFooter && page.status !== "draft",
    draftOnly: page.status === "draft"
  };
  const title = page.title || "Untitled Page";
  return {
    id: String(page.id),
    title,
    slug: page.slug || createSlug(title),
    pageType: pageTypeLabelByValue[page.pageType] || "Custom Page",
    status: page.status === "published" ? "active" : (page.status || "draft"),
    publishStatus: page.status === "published" ? "published" : "draft",
    showIn: deriveShowIn(visibility),
    visibility,
    headerSortOrder: Number(page.headerSortOrder || 0),
    footerSortOrder: Number(page.footerSortOrder || 0),
    publishDate: page.publishedAt || "",
    blocks: Array.isArray(page.blocks) ? page.blocks.map(mapApiBlockToDashboardBlock) : [],
    styleSettings: {
      ...createDefaultStyleSettings(),
      customCss: page.customCss || createDefaultStyleSettings().customCss
    },
    seoSettings: {
      ...createDefaultSeoSettings(title),
      metaTitle: page.metaTitle || "",
      metaDescription: page.metaDescription || "",
      metaKeywords: page.metaKeywords || "",
      canonicalUrl: page.canonicalUrl || "",
      ogTitle: page.ogTitle || "",
      ogDescription: page.ogDescription || "",
      ogImageUrl: page.ogImageUrl || "",
      robotsSetting: page.robots || "index/follow"
    },
    updatedAt: formatDateTime(page.updatedAt) || getNowLabel(),
    isPersisted: true
  };
}

function mapApiBlockToDashboardBlock(block = {}) {
  const content = block.content && typeof block.content === "object" ? block.content : {};
  const blockTypeByApiType = {
    text: "Text Block",
    image: "Image Block",
    image_text: "Image + Text Block",
    heading: "Heading Block",
    banner: "Full Width Banner",
    two_column: "Two Column Content",
    faq: "FAQ Block",
    button: "CTA Button Block"
  };
  const type = blockTypeByApiType[block.blockType] || "Text Block";
  const base = {
    id: String(block.id),
    type,
    title: block.blockTitle || content.heading || type.replace(" Block", " Section"),
    content: content.text || content.paragraph || "",
    status: block.status || "active",
    sortOrder: Number(block.sortOrder || 0)
  };

  if (type === "Text Block") {
    return {
      ...base,
      textHeading: content.heading || block.blockTitle || "",
      paragraphText: content.paragraph || content.text || "",
      textAlign: block.textAlignment || "left",
      fontSize: block.fontSize || 16,
      textColor: block.textColor || "#0f172a",
      backgroundColor: block.backgroundColor || "#ffffff",
      customCssClass: block.customCssClass || ""
    };
  }

  if (type === "Image Block") {
    return {
      ...base,
      imageUrl: block.imageUrl || "",
      imageAltText: block.imageAlt || "",
      imageTitle: block.imageTitle || "",
      imageCaption: block.imageCaption || "",
      imagePosition: block.layoutPosition || "top",
      imageWidth: block.imageWidth || content.imageWidth || "100%",
      borderRadius: block.borderRadius || content.borderRadius || 0
    };
  }

  if (type === "Image + Text Block") {
    return {
      ...base,
      imageUrl: block.imageUrl || "",
      imageAltText: block.imageAlt || "",
      imageTitle: block.imageTitle || "",
      imageCaption: block.imageCaption || "",
      imageTextHeading: content.heading || block.blockTitle || "",
      imageTextParagraph: content.paragraph || content.text || "",
      buttonText: block.buttonText || "",
      buttonLink: block.buttonLink || "",
      imageTextLayout: block.layoutPosition || "image-left",
      imageTextAlign: block.textAlignment || "left"
    };
  }

  return base;
}

function buildPagePayload(page = {}, forcedStatus = "") {
  const seoSettings = page.seoSettings || {};
  const styleSettings = page.styleSettings || {};
  const visibility = page.visibility || {};
  const status = forcedStatus || page.status || "draft";

  return {
    title: page.title,
    slug: page.slug || createSlug(page.title),
    pageType: pageTypeValueByLabel[page.pageType] || "custom",
    status,
    showInHeader: Boolean(visibility.header),
    showInFooter: Boolean(visibility.footer),
    headerSortOrder: Number(page.headerSortOrder || 0),
    footerSortOrder: Number(page.footerSortOrder || 0),
    isLiveUrlEnabled: Boolean(visibility.hiddenLive || visibility.header || visibility.footer) && status !== "draft",
    publishedAt: page.publishDate || null,
    metaTitle: seoSettings.metaTitle || page.title || "",
    metaDescription: seoSettings.metaDescription || "",
    metaKeywords: seoSettings.metaKeywords || "",
    canonicalUrl: seoSettings.canonicalUrl || "",
    ogTitle: seoSettings.ogTitle || seoSettings.metaTitle || page.title || "",
    ogDescription: seoSettings.ogDescription || seoSettings.metaDescription || "",
    ogImageUrl: seoSettings.ogImageUrl || "",
    robots: seoSettings.robotsSetting || "index/follow",
    customCss: styleSettings.customCss || ""
  };
}

function validatePageForm(page = {}) {
  const errors = [];
  const title = String(page.title || "").trim();
  const slug = String(page.slug || "").trim();
  const seoSettings = page.seoSettings || {};

  if (!title) errors.push("Page title is required.");
  if (!slug) errors.push("Page slug is required.");
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errors.push("Page slug can use lowercase letters, numbers, and hyphens only.");
  }
  if (seoSettings.canonicalUrl && !/^(https?:\/\/|\/)/i.test(seoSettings.canonicalUrl)) {
    errors.push("Canonical URL must start with /, http://, or https://.");
  }

  return errors;
}

function buildBlockPayload(block = {}) {
  const type = blockTypeValueByLabel[block.type] || "text";
  const baseContent = typeof block.content === "object" && block.content ? block.content : {};
  const content = {
    ...baseContent,
    text: typeof block.content === "string" ? block.content : baseContent.text,
    heading: block.textHeading || block.imageTextHeading || block.title || baseContent.heading || "",
    paragraph: block.paragraphText || block.imageTextParagraph || (typeof block.content === "string" ? block.content : baseContent.paragraph || ""),
    imageWidth: block.imageWidth || baseContent.imageWidth || "100%",
    borderRadius: Number(block.borderRadius || baseContent.borderRadius || 0)
  };

  if (type === "two_column") {
    const [left = "", right = ""] = String(block.content || "").split("|");
    content.left = baseContent.left || left.trim();
    content.right = baseContent.right || right.trim();
  }

  return {
    blockType: type,
    blockTitle: block.title || block.textHeading || block.imageTextHeading || block.type || "",
    content,
    imageUrl: block.imageUrl || "",
    imageAlt: block.imageAltText || "",
    imageTitle: block.imageTitle || block.imageAltText || "",
    imageCaption: block.imageCaption || "",
    layoutPosition: block.imageTextLayout || block.imagePosition || "",
    imageWidth: block.imageWidth || "100%",
    borderRadius: Number(block.borderRadius || 0),
    textAlignment: block.imageTextAlign || block.textAlign || "left",
    fontSize: Number(block.fontSize || 16),
    textColor: block.textColor || "",
    backgroundColor: block.backgroundColor || "",
    buttonText: block.buttonText || "",
    buttonLink: block.buttonLink || "",
    sortOrder: Number(block.sortOrder || 0),
    status: block.status || "active",
    customCssClass: block.customCssClass || ""
  };
}

function updateVisibilityOption(visibility = {}, option, checked) {
  const nextVisibility = {
    header: false,
    footer: false,
    hiddenLive: false,
    draftOnly: false,
    ...visibility
  };

  if (option === "both") {
    return {
      ...nextVisibility,
      header: checked,
      footer: checked,
      hiddenLive: false,
      draftOnly: false
    };
  }

  if (option === "hiddenLive" || option === "draftOnly") {
    return {
      ...nextVisibility,
      header: false,
      footer: false,
      hiddenLive: option === "hiddenLive" ? checked : false,
      draftOnly: option === "draftOnly" ? checked : false
    };
  }

  return {
    ...nextVisibility,
    [option]: checked,
    hiddenLive: false,
    draftOnly: false
  };
}

function ImageUploader({ id, imageUrl, imageName, altText, onUpload, onRemove, compact = false }) {
  const inputId = `custom-page-upload-${id}`;
  const [isDragging, setIsDragging] = React.useState(false);

  const handleFiles = (files) => {
    const file = files?.[0];
    if (file) onUpload(file);
  };

  const preventDefaults = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      style={{
        ...(compact ? compactImageDropzoneStyle : imageDropzoneStyle),
        ...(isDragging ? imageDropzoneActiveStyle : {})
      }}
      onDragEnter={(event) => {
        preventDefaults(event);
        setIsDragging(true);
      }}
      onDragOver={(event) => {
        preventDefaults(event);
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        preventDefaults(event);
        setIsDragging(false);
      }}
      onDrop={(event) => {
        preventDefaults(event);
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <div style={compact ? compactImagePreviewFrameStyle : imagePreviewFrameStyle}>
        {imageUrl ? (
          <img src={imageUrl} alt={altText || imageName || "Image preview"} style={imagePreviewStyle} />
        ) : (
          <span style={imagePreviewEmptyStyle}>Image</span>
        )}
      </div>
      <div style={imageDropzoneCopyStyle}>
        <span style={labelStyle}>Image Upload</span>
        <p style={helperCopyStyle}>Click to upload or drag and drop an image.</p>
        <div style={imageDropzoneActionsStyle}>
          <label htmlFor={inputId} style={secondaryButtonStyle}>{imageUrl ? "Replace image" : "Click to upload"}</label>
          {imageUrl ? <button type="button" onClick={onRemove} style={dangerButtonStyle}>Remove image</button> : null}
        </div>
        {imageName ? <small style={helperTextStyle}>{imageName}</small> : null}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
          style={hiddenFileInputStyle}
        />
      </div>
    </div>
  );
}

export default function CustomPages() {
  const [pages, setPages] = React.useState([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("All Status");
  const [locationFilter, setLocationFilter] = React.useState("All Locations");
  const [editingPageId, setEditingPageId] = React.useState("");
  const [screenMode, setScreenMode] = React.useState("list");
  const [selectedBlockType, setSelectedBlockType] = React.useState("Text Block");
  const [editingBlockId, setEditingBlockId] = React.useState("");
  const [previewMode, setPreviewMode] = React.useState("desktop");
  const [isLoadingPages, setIsLoadingPages] = React.useState(true);
  const [isLoadingEditor, setIsLoadingEditor] = React.useState(false);
  const [isSavingPage, setIsSavingPage] = React.useState(false);
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [validationErrors, setValidationErrors] = React.useState([]);
  const [notice, setNotice] = React.useState({ type: "", message: "" });
  const [draggedBlockId, setDraggedBlockId] = React.useState("");
  const [dragOverBlockId, setDragOverBlockId] = React.useState("");

  const editingPage = pages.find((page) => page.id === editingPageId);

  const loadPages = React.useCallback(async () => {
    setIsLoadingPages(true);
    setNotice({ type: "", message: "" });
    setValidationErrors([]);
    try {
      const response = await getPages();
      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      setPages(rows.map(mapApiPageToDashboardPage));
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to load pages from backend."
      });
      setPages([]);
    } finally {
      setIsLoadingPages(false);
    }
  }, []);

  React.useEffect(() => {
    loadPages();
  }, [loadPages]);

  const filteredPages = pages.filter((page) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || [page.title, page.slug].some((value) => String(value).toLowerCase().includes(query));
    const matchesStatus = statusFilter === "All Status"
      || page.status === statusFilter.toLowerCase()
      || page.publishStatus === statusFilter.toLowerCase();
    const matchesLocation = locationFilter === "All Locations" || deriveShowIn(page.visibility || {}) === locationFilter || page.showIn === locationFilter;
    return matchesSearch && matchesStatus && matchesLocation;
  });

  const updatePage = (pageId, values) => {
    setPages((current) => current.map((page) => page.id === pageId ? { ...page, ...values, updatedAt: getNowLabel() } : page));
  };

  const updateEditingPage = (values) => {
    if (editingPageId) updatePage(editingPageId, values);
  };

  const updateNestedPage = (key, values) => {
    if (!editingPage) return;
    updatePage(editingPage.id, {
      [key]: {
        ...(editingPage[key] || {}),
        ...values
      }
    });
  };

  const addPage = async () => {
    const nextNumber = pages.length + 1;
    const title = `New Page ${nextNumber}`;
    const draftPage = {
      id: "",
      title,
      slug: createSlug(title),
      pageType: "Custom Page",
      status: "draft",
      publishStatus: "draft",
      showIn: "Draft Only",
      visibility: { header: false, footer: false, hiddenLive: false, draftOnly: true },
      headerSortOrder: 0,
      footerSortOrder: 0,
      publishDate: "",
      blocks: [],
      styleSettings: createDefaultStyleSettings(),
      seoSettings: createDefaultSeoSettings(title),
      updatedAt: getNowLabel()
    };
    setIsSavingPage(true);
    setNotice({ type: "", message: "" });
    setValidationErrors([]);
    try {
      const response = await createPageRequest(buildPagePayload(draftPage, "draft"));
      const savedPage = mapApiPageToDashboardPage(response.data?.data || {});
      setPages((current) => [savedPage, ...current.filter((page) => page.id !== savedPage.id)]);
      setEditingPageId(savedPage.id);
      setEditingBlockId("");
      setScreenMode("editor");
      setNotice({ type: "success", message: "Page draft created successfully." });
      await loadPages();
      await loadPageIntoEditor(savedPage.id);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to create page draft."
      });
    } finally {
      setIsSavingPage(false);
    }
  };

  const duplicatePage = async (page) => {
    setIsSavingPage(true);
    setNotice({ type: "", message: "" });
    setValidationErrors([]);
    try {
      const response = await duplicatePageRequest(page.id);
      const duplicatedPage = mapApiPageToDashboardPage(response.data?.data || {});
      setPages((current) => [duplicatedPage, ...current.filter((item) => item.id !== duplicatedPage.id)]);
      setEditingPageId(duplicatedPage.id);
      setEditingBlockId("");
      setScreenMode("editor");
      setNotice({ type: "success", message: "Page duplicated successfully." });
      await loadPages();
      await loadPageIntoEditor(duplicatedPage.id);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to duplicate page."
      });
    } finally {
      setIsSavingPage(false);
    }
  };

  const deletePage = async (pageId) => {
    const page = pages.find((item) => item.id === pageId);
    const confirmed = window.confirm(`Delete "${page?.title || "this page"}"? This will remove it from the dashboard and frontend.`);
    if (!confirmed) return;

    setNotice({ type: "", message: "" });
    setValidationErrors([]);
    try {
      await deletePageRequest(pageId);
      setPages((current) => current.filter((item) => item.id !== pageId));
      if (editingPageId === pageId) {
        setEditingPageId("");
        setScreenMode("list");
      }
      setNotice({ type: "success", message: "Page deleted successfully." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to delete page."
      });
    }
  };

  const loadPageIntoEditor = async (pageId) => {
    const response = await getPage(pageId);
    const freshPage = mapApiPageToDashboardPage(response.data?.data || {});
    setPages((current) => current.some((page) => page.id === freshPage.id)
      ? current.map((page) => page.id === freshPage.id ? freshPage : page)
      : [freshPage, ...current]);
    setEditingPageId(freshPage.id);
    setEditingBlockId("");
    setScreenMode("editor");
    return freshPage;
  };

  const openEditor = async (pageId) => {
    setIsLoadingEditor(true);
    setNotice({ type: "", message: "" });
    setValidationErrors([]);
    try {
      await loadPageIntoEditor(pageId);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to open page editor."
      });
    } finally {
      setIsLoadingEditor(false);
    }
  };

  const closeEditor = () => {
    setEditingPageId("");
    setEditingBlockId("");
    setScreenMode("list");
  };

  const updatePageBlocks = (pageId, updater) => {
    setPages((current) => current.map((page) => {
      if (page.id !== pageId) return page;
      const currentBlocks = Array.isArray(page.blocks) ? page.blocks : [];
      const nextBlocks = updater(currentBlocks)
        .map((block, index) => ({ ...block, sortOrder: index + 1 }));
      return { ...page, blocks: nextBlocks, updatedAt: getNowLabel() };
    }));
  };

  const addBlock = async (pageId, type = selectedBlockType, defaults = {}) => {
    const page = pages.find((item) => item.id === pageId);
    const nextBlock = createDefaultBlock(type, (page?.blocks?.length || 0) + 1, defaults);
    setNotice({ type: "", message: "" });
    try {
      const response = await createBlockRequest(pageId, buildBlockPayload(nextBlock));
      const savedBlock = mapApiBlockToDashboardBlock(response.data?.data || {});
      updatePageBlocks(pageId, (blocks) => [...blocks, savedBlock]);
      setEditingBlockId(savedBlock.id);
      setNotice({ type: "success", message: "Block added successfully." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to add block."
      });
    }
  };

  const updateBlock = async (pageId, blockId, values) => {
    const page = pages.find((item) => item.id === pageId);
    const existingBlock = page?.blocks?.find((block) => block.id === blockId);
    if (!existingBlock) return null;
    const nextBlock = { ...existingBlock, ...values };
    updatePageBlocks(pageId, (blocks) => blocks.map((block) => block.id === blockId ? nextBlock : block));
    try {
      const response = await updateBlockRequest(pageId, blockId, buildBlockPayload(nextBlock));
      const savedBlock = mapApiBlockToDashboardBlock(response.data?.data || {});
      updatePageBlocks(pageId, (blocks) => blocks.map((block) => block.id === blockId ? savedBlock : block));
      return savedBlock;
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to save block changes."
      });
      return null;
    }
  };

  const duplicateBlock = async (pageId, block) => {
    const page = pages.find((item) => item.id === pageId);
    const blockIndex = page?.blocks?.findIndex((item) => item.id === block.id) ?? -1;
    const duplicate = {
      ...block,
      id: "",
      title: `${block.title || block.type} Copy`,
      status: "inactive",
      sortOrder: blockIndex + 2
    };

    try {
      const response = await createBlockRequest(pageId, buildBlockPayload(duplicate));
      const savedBlock = mapApiBlockToDashboardBlock(response.data?.data || {});
      updatePageBlocks(pageId, (blocks) => {
        const nextBlocks = [...blocks];
        nextBlocks.splice(blockIndex + 1, 0, savedBlock);
        return nextBlocks;
      });
      setEditingBlockId(savedBlock.id);
      setNotice({ type: "success", message: "Block duplicated successfully." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to duplicate block."
      });
    }
  };

  const deleteBlock = async (pageId, blockId) => {
    const confirmed = window.confirm("Delete this content block?");
    if (!confirmed) return;

    try {
      await deleteBlockRequest(pageId, blockId);
      updatePageBlocks(pageId, (blocks) => blocks.filter((block) => block.id !== blockId));
      setEditingBlockId((current) => current === blockId ? "" : current);
      setNotice({ type: "success", message: "Block deleted successfully." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to delete block."
      });
    }
  };

  const reorderBlockByDrag = async (pageId, sourceBlockId, targetBlockId) => {
    if (!sourceBlockId || !targetBlockId || sourceBlockId === targetBlockId) return;
    let nextOrderedBlocks = [];
    updatePageBlocks(pageId, (blocks) => {
      const ordered = [...blocks].sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
      const currentIndex = ordered.findIndex((block) => block.id === sourceBlockId);
      const targetIndex = ordered.findIndex((block) => block.id === targetBlockId);
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ordered.length) return ordered;
      const [selectedBlock] = ordered.splice(currentIndex, 1);
      ordered.splice(targetIndex, 0, selectedBlock);
      nextOrderedBlocks = ordered.map((block, index) => ({ ...block, sortOrder: index + 1 }));
      return ordered;
    });

    if (!nextOrderedBlocks.length) return;
    try {
      const response = await reorderBlocksRequest(pageId, nextOrderedBlocks.map((block) => ({ id: block.id, sortOrder: block.sortOrder })));
      const savedBlocks = Array.isArray(response.data?.data) ? response.data.data.map(mapApiBlockToDashboardBlock) : nextOrderedBlocks;
      updatePageBlocks(pageId, () => savedBlocks);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to reorder blocks."
      });
    } finally {
      setDraggedBlockId("");
      setDragOverBlockId("");
    }
  };

  const toggleBlockStatus = async (pageId, blockId) => {
    const page = pages.find((item) => item.id === pageId);
    const existingBlock = page?.blocks?.find((block) => block.id === blockId);
    if (!existingBlock) return;
    await updateBlock(pageId, blockId, { status: existingBlock.status === "active" ? "inactive" : "active" });
  };

  const uploadFile = (callback) => async (file) => {
    if (!file || !file.type?.startsWith("image/")) return;
    setNotice({ type: "", message: "" });
    setIsUploadingImage(true);
    setUploadProgress(0);
    try {
      const response = await uploadPageImage(file, (event) => {
        if (!event.total) return;
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      });
      const imageUrl = response.data?.data?.url || "";
      if (!imageUrl) throw new Error("Upload did not return an image URL.");
      callback(imageUrl, file);
      setUploadProgress(100);
      setNotice({ type: "success", message: "Image uploaded successfully." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || error.message || "Unable to upload image."
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const setPageStatus = async (pageId, status) => {
    setIsSavingPage(true);
    setNotice({ type: "", message: "" });
    try {
      const response = await updatePageStatusRequest(pageId, status);
      const updatedPage = mapApiPageToDashboardPage(response.data?.data || {});
      setPages((current) => current.map((page) => page.id === updatedPage.id ? { ...page, ...updatedPage, blocks: page.blocks || [] } : page));
      setNotice({ type: "success", message: `Page marked as ${status}.` });
      return updatedPage;
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to update page status."
      });
      return null;
    } finally {
      setIsSavingPage(false);
    }
  };

  const saveDraft = async () => {
    if (!editingPage) return;
    const errors = validatePageForm(editingPage);
    if (errors.length) {
      setValidationErrors(errors);
      setNotice({ type: "error", message: "Please fix validation errors before saving." });
      return;
    }
    setIsSavingPage(true);
    setNotice({ type: "", message: "" });
    setValidationErrors([]);
    try {
      const nextPage = { ...editingPage, status: "draft", publishStatus: "draft" };
      const response = editingPage.isPersisted
        ? await updatePageRequest(editingPage.id, buildPagePayload(nextPage, "draft"))
        : await createPageRequest(buildPagePayload(nextPage, "draft"));
      const savedPage = mapApiPageToDashboardPage(response.data?.data || {});
      await updatePageStatusRequest(savedPage.id, "draft");
      setPages((current) => current.map((page) => page.id === editingPage.id ? { ...savedPage, blocks: page.blocks || savedPage.blocks } : page));
      setEditingPageId(savedPage.id);
      setNotice({ type: "success", message: "Draft saved successfully." });
      await loadPages();
      await loadPageIntoEditor(savedPage.id);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to save draft."
      });
    } finally {
      setIsSavingPage(false);
    }
  };

  const publishPage = async () => {
    if (!editingPage) return;
    const errors = validatePageForm(editingPage);
    if (errors.length) {
      setValidationErrors(errors);
      setNotice({ type: "error", message: "Please fix validation errors before publishing." });
      return;
    }
    setIsSavingPage(true);
    setNotice({ type: "", message: "" });
    setValidationErrors([]);
    try {
      const nextPage = { ...editingPage, status: "active", publishStatus: "published" };
      await updatePageRequest(editingPage.id, buildPagePayload(nextPage, "active"));
      const response = await updatePageStatusRequest(editingPage.id, "active");
      const savedPage = mapApiPageToDashboardPage(response.data?.data || {});
      setPages((current) => current.map((page) => page.id === editingPage.id ? { ...page, ...savedPage } : page));
      setNotice({ type: "success", message: "Page published successfully." });
      await loadPages();
      await loadPageIntoEditor(savedPage.id);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to publish page."
      });
    } finally {
      setIsSavingPage(false);
    }
  };

  if (screenMode === "editor" && editingPage) {
    const sortedBlocks = [...(editingPage.blocks || [])].sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
    const styleSettings = editingPage.styleSettings || createDefaultStyleSettings();
    const seoSettings = editingPage.seoSettings || createDefaultSeoSettings(editingPage.title);

    return (
      <section className="dashboard-page-shell">
        <div style={editorTopBarStyle}>
          <div>
            <div style={breadcrumbStyle}>Dashboard / Homepage / Pages / Add / Edit Page</div>
            <h2 style={titleStyle}>Add / Edit Page</h2>
            <p style={copyStyle}>Create and manage custom website pages</p>
          </div>
          <div style={topActionsStyle}>
            <button type="button" onClick={closeEditor} style={secondaryButtonStyle}>Back to Pages</button>
            <button type="button" onClick={() => window.open(`/pages/${editingPage.slug}?preview=true`, "_blank", "noopener,noreferrer")} style={secondaryButtonStyle}><FaEye />Preview Page</button>
            <button type="button" onClick={saveDraft} disabled={isSavingPage} style={isSavingPage ? disabledActionButtonStyle : draftButtonStyle}><FaRegSave />{isSavingPage ? "Saving..." : "Save Draft"}</button>
            <button type="button" onClick={publishPage} style={primaryButtonStyle}><FaPaperPlane />Publish Page</button>
          </div>
        </div>
        {notice.message ? <div style={notice.type === "error" ? errorNoticeStyle : successNoticeStyle}>{notice.message}</div> : null}
        {validationErrors.length ? (
          <div style={validationNoticeStyle}>
            {validationErrors.map((error) => <span key={error}>{error}</span>)}
          </div>
        ) : null}
        {isUploadingImage ? (
          <div style={uploadProgressWrapStyle}>
            <span>Uploading image... {uploadProgress}%</span>
            <div style={uploadProgressTrackStyle}><div style={{ ...uploadProgressBarStyle, width: `${uploadProgress}%` }} /></div>
          </div>
        ) : null}

        <div style={editorTwoColumnStyle}>
          <div style={leftColumnStyle}>
            <section style={cardStyle}>
              <div style={cardHeadingStyle}>
                <span style={eyebrowStyle}>Page Details</span>
                <h3 style={panelTitleStyle}>Page Information</h3>
              </div>
              <div style={editorGridStyle}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Page Title</span>
                  <input value={editingPage.title} onChange={(event) => updateEditingPage({ title: event.target.value, slug: createSlug(event.target.value) })} style={inputStyle} />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Page Slug</span>
                  <input value={editingPage.slug} onChange={(event) => updateEditingPage({ slug: createSlug(event.target.value) })} style={inputStyle} />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Page Type</span>
                  <select value={editingPage.pageType || "Custom Page"} onChange={(event) => updateEditingPage({ pageType: event.target.value })} style={inputStyle}>
                    {pageTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Status</span>
                  <select value={editingPage.status === "active" ? "Active" : editingPage.status === "inactive" ? "Inactive" : "Draft"} onChange={(event) => updateEditingPage({ status: event.target.value.toLowerCase() })} style={inputStyle}>
                    {pageStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Publish Date</span>
                  <input type="datetime-local" value={editingPage.publishDate || ""} onChange={(event) => updateEditingPage({ publishDate: event.target.value })} style={inputStyle} />
                </label>
              </div>
            </section>

            <section style={cardStyle}>
              <div style={cardHeadingStyle}>
                <span style={eyebrowStyle}>Page Visibility</span>
                <h3 style={panelTitleStyle}>Show In</h3>
              </div>
              <div style={visibilityGridStyle}>
                {[
                  ["header", "Show in Header"],
                  ["footer", "Show in Footer"],
                  ["both", "Show in Both"],
                  ["hiddenLive", "Hidden but Live URL"],
                  ["draftOnly", "Draft Only"]
                ].map(([key, label]) => (
                  <label key={key} style={checkTileStyle}>
                    <input
                      type="checkbox"
                      checked={key === "both" ? Boolean(editingPage.visibility?.header && editingPage.visibility?.footer) : Boolean(editingPage.visibility?.[key])}
                      onChange={(event) => {
                        const nextVisibility = updateVisibilityOption(editingPage.visibility || {}, key, event.target.checked);
                        updateEditingPage({ visibility: nextVisibility, showIn: deriveShowIn(nextVisibility) });
                      }}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <div style={editorGridStyle}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Header Sort Order</span>
                  <input type="number" value={editingPage.headerSortOrder || 0} onChange={(event) => updateEditingPage({ headerSortOrder: Number(event.target.value || 0) })} style={inputStyle} />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Footer Sort Order</span>
                  <input type="number" value={editingPage.footerSortOrder || 0} onChange={(event) => updateEditingPage({ footerSortOrder: Number(event.target.value || 0) })} style={inputStyle} />
                </label>
              </div>
            </section>

            <section style={cardStyle}>
              <div style={cardHeadingStyle}>
                <div>
                  <span style={eyebrowStyle}>Content Builder</span>
                  <h3 style={panelTitleStyle}>Build your page content using sections/blocks</h3>
                </div>
              </div>
              <div style={blockButtonsStyle}>
                {blockTypeOptions.map(({ id, type, label, icon: Icon, defaults = {} }) => (
                  <button key={id} type="button" onClick={() => { setSelectedBlockType(type); addBlock(editingPage.id, type, defaults); }} style={blockTypeButtonStyle}>
                    <Icon />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <div style={compactBlockListStyle}>
                {sortedBlocks.map((block, index) => {
                  const Icon = getBlockIcon(block.type);
                  return (
                    <article
                      key={block.id}
                      style={{
                        ...blockListItemStyle,
                        ...(dragOverBlockId === block.id && draggedBlockId !== block.id ? blockListItemDragOverStyle : {}),
                        ...(draggedBlockId === block.id ? blockListItemDraggingStyle : {})
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (draggedBlockId && draggedBlockId !== block.id) setDragOverBlockId(block.id);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const sourceId = event.dataTransfer.getData("text/plain") || draggedBlockId;
                        reorderBlockByDrag(editingPage.id, sourceId, block.id);
                      }}
                    >
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", block.id);
                          setDraggedBlockId(block.id);
                        }}
                        onDragEnd={() => {
                          setDraggedBlockId("");
                          setDragOverBlockId("");
                        }}
                        style={dragHandleStyle}
                        title="Drag to reorder"
                        aria-label={`Drag ${block.title || block.type} to reorder`}
                      >
                        <FaGripVertical />
                      </button>
                      <div style={blockIconBoxStyle}><Icon /></div>
                      <div style={blockInfoStyle}>
                        <strong>{block.title || block.type}</strong>
                        <span>{getBlockSummary(block)}</span>
                      </div>
                      {block.imageUrl ? <img src={block.imageUrl} alt={block.imageAltText || ""} style={blockThumbStyle} /> : null}
                      <div style={compactBlockActionsStyle}>
                        <button type="button" onClick={() => setEditingBlockId((current) => current === block.id ? "" : block.id)} style={iconButtonStyle} title="Edit"><FaEdit /></button>
                        <button type="button" onClick={() => duplicateBlock(editingPage.id, block)} style={iconButtonStyle} title="Duplicate"><FaCopy /></button>
                        <button type="button" onClick={() => setEditingBlockId(block.id)} style={iconButtonStyle} title="Preview"><FaEye /></button>
                        <button type="button" onClick={() => deleteBlock(editingPage.id, block.id)} style={deleteIconButtonStyle} title="Delete"><FaTrash /></button>
                      </div>
                      <div style={moveActionsStyle}>
                        <button type="button" onClick={() => toggleBlockStatus(editingPage.id, block.id)} style={actionButtonStyle}>{block.status === "active" ? "Inactive" : "Active"}</button>
                      </div>
                      {editingBlockId === block.id ? (
                        <div style={blockEditorInlineStyle}>
                          <BlockEditor
                            block={block}
                            pageId={editingPage.id}
                            index={index}
                            updateBlock={updateBlock}
                            uploadFile={uploadFile}
                            onSaved={() => setEditingBlockId("")}
                          />
                        </div>
                      ) : null}
                    </article>
                  );
                })}
                {!sortedBlocks.length ? <div style={emptyBlocksStyle}>No content blocks yet. Add a block to start building this page.</div> : null}
              </div>
              <button type="button" onClick={() => addBlock(editingPage.id, selectedBlockType)} style={addNewBlockStyle}><FaPlus />Add New Block</button>
            </section>
          </div>

          <aside style={rightColumnStyle}>
            <section style={cardStyle}>
              <div style={cardHeaderRowStyle}>
                <h3 style={panelTitleStyle}>Live Preview</h3>
                <div style={previewToggleStyle}>
                  <button type="button" onClick={() => setPreviewMode("desktop")} style={previewMode === "desktop" ? activeToggleButtonStyle : toggleButtonStyle}><FaDesktop />Desktop</button>
                  <button type="button" onClick={() => setPreviewMode("mobile")} style={previewMode === "mobile" ? activeToggleButtonStyle : toggleButtonStyle}><FaMobileAlt />Mobile</button>
                </div>
              </div>
              <PagePreview page={editingPage} blocks={sortedBlocks} mode={previewMode} />
            </section>

            <section style={cardStyle}>
              <div style={cardHeadingStyle}>
                <span style={eyebrowStyle}>Section / Page Settings</span>
                <h3 style={panelTitleStyle}>Page Style Settings</h3>
              </div>
              <div style={settingsGridStyle}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Page Background Color</span>
                  <input type="color" value={styleSettings.pageBackgroundColor || "#ffffff"} onChange={(event) => updateNestedPage("styleSettings", { pageBackgroundColor: event.target.value })} style={colorInputStyle} />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Text Color</span>
                  <input type="color" value={styleSettings.textColor || "#333333"} onChange={(event) => updateNestedPage("styleSettings", { textColor: event.target.value })} style={colorInputStyle} />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Default Font Size</span>
                  <input type="number" value={styleSettings.defaultFontSize || 16} onChange={(event) => updateNestedPage("styleSettings", { defaultFontSize: Number(event.target.value || 16) })} style={inputStyle} />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Content Width</span>
                  <select value={styleSettings.contentWidth || "Default"} onChange={(event) => updateNestedPage("styleSettings", { contentWidth: event.target.value })} style={inputStyle}>
                    {contentWidthOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Section Spacing</span>
                  <input type="number" value={styleSettings.sectionSpacing || 32} onChange={(event) => updateNestedPage("styleSettings", { sectionSpacing: Number(event.target.value || 0) })} style={inputStyle} />
                </label>
                <label style={wideFieldStyle}>
                  <span style={labelStyle}>Custom Page CSS</span>
                  <textarea value={styleSettings.customCss || ""} onChange={(event) => updateNestedPage("styleSettings", { customCss: event.target.value })} style={codeTextareaStyle} />
                </label>
              </div>
            </section>

            <section style={cardStyle}>
              <div style={cardHeadingStyle}>
                <span style={eyebrowStyle}>SEO Settings</span>
                <h3 style={panelTitleStyle}>Search Preview Data</h3>
              </div>
              <div style={settingsGridStyle}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Meta Title</span>
                  <input value={seoSettings.metaTitle || ""} onChange={(event) => updateNestedPage("seoSettings", { metaTitle: event.target.value })} style={inputStyle} />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Canonical URL</span>
                  <input value={seoSettings.canonicalUrl || ""} onChange={(event) => updateNestedPage("seoSettings", { canonicalUrl: event.target.value })} style={inputStyle} />
                </label>
                <label style={wideFieldStyle}>
                  <span style={labelStyle}>Meta Description</span>
                  <textarea value={seoSettings.metaDescription || ""} onChange={(event) => updateNestedPage("seoSettings", { metaDescription: event.target.value })} style={textareaStyle} />
                </label>
                <label style={wideFieldStyle}>
                  <span style={labelStyle}>Meta Keywords</span>
                  <input value={seoSettings.metaKeywords || ""} onChange={(event) => updateNestedPage("seoSettings", { metaKeywords: event.target.value })} style={inputStyle} />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>OG Title</span>
                  <input value={seoSettings.ogTitle || ""} onChange={(event) => updateNestedPage("seoSettings", { ogTitle: event.target.value })} style={inputStyle} />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Robots Setting</span>
                  <select value={seoSettings.robotsSetting || "index/follow"} onChange={(event) => updateNestedPage("seoSettings", { robotsSetting: event.target.value })} style={inputStyle}>
                    {robotsOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label style={wideFieldStyle}>
                  <span style={labelStyle}>OG Description</span>
                  <textarea value={seoSettings.ogDescription || ""} onChange={(event) => updateNestedPage("seoSettings", { ogDescription: event.target.value })} style={textareaStyle} />
                </label>
                <label style={wideFieldStyle}>
                  <span style={labelStyle}>OG Image Upload</span>
                  <ImageUploader
                    id={`og-${editingPage.id}`}
                    imageUrl={seoSettings.ogImageUrl}
                    imageName={seoSettings.ogImageName}
                    altText={seoSettings.imageAltText || seoSettings.ogTitle || seoSettings.metaTitle}
                    compact
                    onUpload={uploadFile((imageUrl, file) => updateNestedPage("seoSettings", {
                      ogImageUrl: imageUrl,
                      ogImageName: file.name,
                      imageAltText: seoSettings.imageAltText || file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
                      imageTitle: seoSettings.imageTitle || file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")
                    }))}
                    onRemove={() => updateNestedPage("seoSettings", { ogImageUrl: "", ogImageName: "", imageAltText: "", imageTitle: "", imageCaption: "" })}
                  />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Image Alt Text</span>
                  <input value={seoSettings.imageAltText || ""} onChange={(event) => updateNestedPage("seoSettings", { imageAltText: event.target.value })} style={inputStyle} />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Image Title</span>
                  <input value={seoSettings.imageTitle || ""} onChange={(event) => updateNestedPage("seoSettings", { imageTitle: event.target.value })} style={inputStyle} />
                </label>
                <label style={wideFieldStyle}>
                  <span style={labelStyle}>Caption</span>
                  <input value={seoSettings.imageCaption || ""} onChange={(event) => updateNestedPage("seoSettings", { imageCaption: event.target.value })} style={inputStyle} />
                </label>
              </div>
            </section>
          </aside>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-page-shell">
      <div style={heroStyle}>
        <span style={eyebrowStyle}>Custom Pages Builder</span>
        <h2 style={titleStyle}>Pages</h2>
        <p style={copyStyle}>Create and manage custom website pages, policy pages, and landing pages.</p>
      </div>
      {notice.message ? <div style={notice.type === "error" ? errorNoticeStyle : successNoticeStyle}>{notice.message}</div> : null}

      <div style={toolbarStyle}>
        <button type="button" onClick={addPage} disabled={isSavingPage} style={isSavingPage ? disabledActionButtonStyle : primaryButtonStyle}>{isSavingPage ? "Creating..." : "Add New Page"}</button>
        <label style={filterFieldStyle}>
          <span style={labelStyle}>Search Page</span>
          <div style={searchInputWrapStyle}><FaSearch /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by title or slug" style={plainInputStyle} /></div>
        </label>
        <label style={filterFieldStyle}>
          <span style={labelStyle}>Filter by Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={inputStyle}>
            {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label style={filterFieldStyle}>
          <span style={labelStyle}>Filter by Show Location</span>
          <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} style={inputStyle}>
            {locationOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>

      <div style={contentLayoutStyle}>
        <div style={tablePanelStyle}>
          <div style={tableScrollerStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Page Title</th>
                  <th style={tableHeaderStyle}>Slug</th>
                  <th style={tableHeaderStyle}>Status</th>
                  <th style={tableHeaderStyle}>Show In</th>
                  <th style={tableHeaderStyle}>Last Updated</th>
                  <th style={tableHeaderStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingPages ? (
                  <tr><td colSpan="6" style={emptyTableCellStyle}><span style={spinnerStyle} /> Loading saved pages...</td></tr>
                ) : filteredPages.map((page) => (
                  <tr key={page.id} style={tableRowStyle}>
                    <td style={titleCellStyle}>{page.title}</td>
                    <td style={tableCellStyle}>/{page.slug}</td>
                    <td style={tableCellStyle}>
                      <span style={page.status === "active" ? activePillStyle : page.status === "draft" ? draftPillStyle : inactivePillStyle}>{page.status}</span>
                      <span style={page.publishStatus === "published" ? publishedPillStyle : draftPillStyle}>{page.publishStatus}</span>
                    </td>
                    <td style={tableCellStyle}>{deriveShowIn(page.visibility || {})}</td>
                    <td style={tableCellStyle}>{page.updatedAt}</td>
                    <td style={actionsCellStyle}>
                      <button type="button" onClick={() => window.open(`/pages/${page.slug}`, "_blank", "noopener,noreferrer")} style={actionButtonStyle}>View</button>
                      <button type="button" onClick={() => openEditor(page.id)} disabled={isLoadingEditor} style={isLoadingEditor ? disabledActionButtonStyle : actionButtonStyle}>{isLoadingEditor ? "Opening..." : "Edit"}</button>
                      <button type="button" onClick={() => duplicatePage(page)} disabled={isSavingPage} style={isSavingPage ? disabledActionButtonStyle : actionButtonStyle}>Duplicate</button>
                      <button type="button" onClick={() => setPageStatus(page.id, page.status === "active" ? "inactive" : "active")} disabled={isSavingPage} style={isSavingPage ? disabledActionButtonStyle : actionButtonStyle}>{page.status === "active" ? "Inactive" : "Active"}</button>
                      <button type="button" onClick={() => setPageStatus(page.id, page.publishStatus === "published" ? "draft" : "active")} disabled={isSavingPage} style={isSavingPage ? disabledActionButtonStyle : actionButtonStyle}>{page.publishStatus === "published" ? "Draft" : "Publish"}</button>
                      <button type="button" onClick={() => deletePage(page.id)} style={dangerButtonStyle}>Delete</button>
                    </td>
                  </tr>
                ))}
                {!isLoadingPages && !filteredPages.length ? (
                  <tr><td colSpan="6" style={emptyTableCellStyle}>No saved pages found. Use Add New Page to create your first page.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Link to="/dashboard/homepage" style={backButtonStyle}>Back to Homepage</Link>
    </section>
  );
}

function BlockEditor({ block: initialBlock, pageId, index, updateBlock, uploadFile, onSaved }) {
  const [draftBlock, setDraftBlock] = React.useState(initialBlock);

  React.useEffect(() => {
    setDraftBlock(initialBlock);
  }, [initialBlock]);

  const block = draftBlock;
  const patchBlock = (values) => setDraftBlock((current) => ({ ...current, ...values }));
  const saveBlock = async () => {
    const savedBlock = await updateBlock(pageId, initialBlock.id, draftBlock);
    if (savedBlock) onSaved?.();
  };

  if (block.type === "Text Block") {
    return (
      <>
        <div style={textBlockFieldsStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Heading</span>
            <input value={block.textHeading || ""} onChange={(event) => patchBlock({ textHeading: event.target.value, title: event.target.value || "Text Section" })} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Text alignment</span>
            <select value={block.textAlign || "left"} onChange={(event) => patchBlock({ textAlign: event.target.value })} style={inputStyle}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label style={wideFieldStyle}>
            <span style={labelStyle}>Paragraph text</span>
            <textarea value={block.paragraphText || ""} onChange={(event) => patchBlock({ paragraphText: event.target.value, content: event.target.value })} style={textareaStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Font size</span>
            <input type="number" min="10" max="72" value={block.fontSize || 16} onChange={(event) => patchBlock({ fontSize: Number(event.target.value || 16) })} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Padding</span>
            <input type="number" min="0" max="120" value={block.padding ?? 24} onChange={(event) => patchBlock({ padding: Number(event.target.value || 0) })} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Text color</span>
            <input type="color" value={block.textColor || "#0f172a"} onChange={(event) => patchBlock({ textColor: event.target.value })} style={colorInputStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Background color</span>
            <input type="color" value={block.backgroundColor || "#ffffff"} onChange={(event) => patchBlock({ backgroundColor: event.target.value })} style={colorInputStyle} />
          </label>
          <label style={wideFieldStyle}>
            <span style={labelStyle}>Custom CSS class optional</span>
            <input value={block.customCssClass || ""} onChange={(event) => patchBlock({ customCssClass: event.target.value })} placeholder="policy-intro" style={inputStyle} />
          </label>
        </div>
        <BlockEditorActions onSave={saveBlock} />
      </>
    );
  }

  if (block.type === "Image Block") {
    return (
      <>
        <div style={imageBlockFieldsStyle}>
          <ImageUploader
            id={block.id}
            imageUrl={block.imageUrl}
            imageName={block.imageName}
            altText={block.imageAltText}
            onUpload={uploadFile((imageUrl, file) => patchBlock({
              imageUrl,
              imageName: file.name,
              imageAltText: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
              imageTitle: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")
            }))}
            onRemove={() => patchBlock({ imageUrl: "", imageName: "", imageAltText: "", imageTitle: "", imageCaption: "" })}
          />
          <div style={imageSettingsGridStyle}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Image Alt Text</span>
              <input value={block.imageAltText || ""} onChange={(event) => patchBlock({ imageAltText: event.target.value })} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Image Title</span>
              <input value={block.imageTitle || ""} onChange={(event) => patchBlock({ imageTitle: event.target.value })} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Image Caption</span>
              <input value={block.imageCaption || ""} onChange={(event) => patchBlock({ imageCaption: event.target.value })} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Image Position</span>
              <select value={block.imagePosition || "top"} onChange={(event) => patchBlock({ imagePosition: event.target.value })} style={inputStyle}>
                <option value="top">Top</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="center">Center</option>
                <option value="full-width">Full Width</option>
              </select>
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Image Width</span>
              <select value={block.imageWidth || "100%"} onChange={(event) => patchBlock({ imageWidth: event.target.value })} style={inputStyle}>
                <option value="25%">25%</option>
                <option value="50%">50%</option>
                <option value="75%">75%</option>
                <option value="100%">100%</option>
              </select>
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Border Radius</span>
              <input type="number" min="0" max="80" value={block.borderRadius ?? 0} onChange={(event) => patchBlock({ borderRadius: Number(event.target.value || 0) })} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Sort Order</span>
              <input type="number" min="1" value={block.sortOrder || index + 1} readOnly style={inputStyle} />
            </label>
          </div>
        </div>
        <BlockEditorActions onSave={saveBlock} />
      </>
    );
  }

  if (block.type === "Image + Text Block") {
    return (
      <>
        <div style={imageBlockFieldsStyle}>
          <ImageUploader
            id={block.id}
            imageUrl={block.imageUrl}
            imageName={block.imageName}
            altText={block.imageAltText}
            onUpload={uploadFile((imageUrl, file) => patchBlock({
              imageUrl,
              imageName: file.name,
              imageAltText: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
              imageTitle: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")
            }))}
            onRemove={() => patchBlock({ imageUrl: "", imageName: "", imageAltText: "", imageTitle: "", imageCaption: "" })}
          />
          <div style={imageTextFieldsStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Heading</span>
            <input
              value={block.imageTextHeading || ""}
              onChange={(event) => patchBlock({
                imageTextHeading: event.target.value,
                title: event.target.value || "Image + Text Section"
              })}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Layout position</span>
            <select value={block.imageTextLayout || "image-left"} onChange={(event) => patchBlock({ imageTextLayout: event.target.value })} style={inputStyle}>
              <option value="image-left">Image Left / Text Right</option>
              <option value="text-left">Text Left / Image Right</option>
              <option value="image-top">Image Top / Text Bottom</option>
              <option value="text-top">Text Top / Image Bottom</option>
              <option value="overlay">Full image with overlay text</option>
            </select>
          </label>
          <label style={wideFieldStyle}>
            <span style={labelStyle}>Paragraph</span>
            <textarea
              value={block.imageTextParagraph || ""}
              onChange={(event) => patchBlock({
                imageTextParagraph: event.target.value,
                content: event.target.value
              })}
              style={textareaStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Button text optional</span>
            <input value={block.buttonText || ""} onChange={(event) => patchBlock({ buttonText: event.target.value })} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Button link optional</span>
            <input value={block.buttonLink || ""} onChange={(event) => patchBlock({ buttonLink: event.target.value })} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Image alt text</span>
            <input value={block.imageAltText || ""} onChange={(event) => patchBlock({ imageAltText: event.target.value })} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Image title</span>
            <input value={block.imageTitle || ""} onChange={(event) => patchBlock({ imageTitle: event.target.value })} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Image caption</span>
            <input value={block.imageCaption || ""} onChange={(event) => patchBlock({ imageCaption: event.target.value })} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Text alignment</span>
            <select value={block.imageTextAlign || "left"} onChange={(event) => patchBlock({ imageTextAlign: event.target.value })} style={inputStyle}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
          </div>
        </div>
        <BlockEditorActions onSave={saveBlock} />
      </>
    );
  }

  return (
    <>
      <div style={blockFieldsStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Block Title</span>
          <input value={block.title} onChange={(event) => patchBlock({ title: event.target.value })} style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Edit Block</span>
          <textarea value={block.content} onChange={(event) => patchBlock({ content: event.target.value })} style={textareaStyle} />
        </label>
      </div>
      <BlockEditorActions onSave={saveBlock} />
    </>
  );
}

function BlockEditorActions({ onSave }) {
  return (
    <div style={blockEditorActionsStyle}>
      <button type="button" onClick={onSave} style={primaryButtonStyle}>
        <FaRegSave />
        Save Block
      </button>
    </div>
  );
}

function PagePreview({ page, blocks, mode }) {
  const visibleBlocks = blocks.filter((block) => block.status !== "inactive");
  return (
    <div style={mode === "mobile" ? mobilePreviewShellStyle : previewShellStyle}>
      <div style={previewNavStyle}>
        <strong>AVYONA</strong>
        {mode === "desktop" ? <span>Home Shop Categories About Us Privacy Policy</span> : <span>Menu</span>}
      </div>
      <div style={previewHeroStyle}>
        <h4>{page.title}</h4>
        <p>Home / {page.title}</p>
      </div>
      <div style={previewContentStyle}>
        {visibleBlocks.length ? visibleBlocks.slice(0, 5).map((block) => (
          <div key={block.id} style={previewBlockStyle}>
            {block.type === "Image Block" && block.imageUrl ? <img src={block.imageUrl} alt={block.imageAltText || ""} style={previewImageStyle} /> : null}
            {block.type === "Image + Text Block" ? (
              <div style={block.imageTextLayout === "overlay" ? previewImageTextOverlayStyle : previewImageTextStyle}>
                {block.imageUrl ? <img src={block.imageUrl} alt={block.imageAltText || ""} style={previewImageTextImageStyle} /> : null}
                <div style={{ ...previewImageTextCopyStyle, textAlign: block.imageTextAlign || "left" }}>
                  <strong>{block.imageTextHeading || block.title}</strong>
                  <p>{block.imageTextParagraph || block.content}</p>
                  {block.buttonText ? <span style={previewButtonStyle}>{block.buttonText}</span> : null}
                </div>
              </div>
            ) : (
              <>
                <strong>{block.type === "Text Block" ? block.textHeading : block.title}</strong>
                <p>{block.type === "Text Block" ? block.paragraphText : block.content}</p>
              </>
            )}
          </div>
        )) : <p>No active content blocks yet.</p>}
      </div>
    </div>
  );
}

const heroStyle = {
  padding: "28px",
  border: "1px solid rgba(203, 213, 225, 0.72)",
  borderRadius: "24px",
  background: "linear-gradient(135deg, #ffffff 0%, #f3fbf5 58%, #e9f7ec 100%)",
  boxShadow: "0 18px 42px rgba(148, 163, 184, 0.14)"
};

const editorTopBarStyle = {
  position: "sticky",
  top: 0,
  zIndex: 5,
  display: "flex",
  justifyContent: "space-between",
  gap: "18px",
  alignItems: "center",
  padding: "18px 0",
  background: "#f8fafc"
};

const breadcrumbStyle = {
  color: "#64748b",
  fontSize: "13px",
  fontWeight: 800
};

const topActionsStyle = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: "10px"
};

const titleStyle = {
  margin: "8px 0 8px",
  color: "#0f172a",
  fontSize: "38px",
  lineHeight: 1.05
};

const copyStyle = {
  margin: 0,
  maxWidth: "760px",
  color: "#526377",
  lineHeight: 1.65
};

const eyebrowStyle = {
  color: "#16a34a",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const editorTwoColumnStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.08fr) minmax(360px, 0.92fr)",
  gap: "18px",
  alignItems: "start"
};

const leftColumnStyle = {
  display: "grid",
  gap: "18px",
  minWidth: 0
};

const rightColumnStyle = {
  display: "grid",
  gap: "18px",
  minWidth: 0
};

const cardStyle = {
  display: "grid",
  gap: "16px",
  padding: "18px",
  border: "1px solid rgba(203, 213, 225, 0.72)",
  borderRadius: "12px",
  background: "#ffffff",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)"
};

const cardHeadingStyle = {
  display: "grid",
  gap: "4px"
};

const cardHeaderRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px"
};

const panelTitleStyle = {
  margin: 0,
  color: "#0f172a",
  fontSize: "18px"
};

const editorGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "14px"
};

const settingsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "14px"
};

const fieldStyle = {
  display: "grid",
  gap: "7px",
  minWidth: 0
};

const wideFieldStyle = {
  ...fieldStyle,
  gridColumn: "1 / -1"
};

const labelStyle = {
  color: "#475569",
  fontSize: "12px",
  fontWeight: 900
};

const inputStyle = {
  width: "100%",
  minHeight: "42px",
  padding: "9px 11px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  color: "#0f172a",
  background: "#ffffff",
  boxSizing: "border-box",
  outline: "none"
};

const plainInputStyle = {
  width: "100%",
  border: 0,
  outline: 0,
  color: "#0f172a",
  background: "transparent"
};

const textareaStyle = {
  ...inputStyle,
  minHeight: "96px",
  resize: "vertical",
  lineHeight: 1.5
};

const codeTextareaStyle = {
  ...textareaStyle,
  minHeight: "180px",
  color: "#d1d5db",
  background: "#111827",
  fontFamily: "Consolas, monospace"
};

const colorInputStyle = {
  ...inputStyle,
  padding: "5px",
  cursor: "pointer"
};

const primaryButtonStyle = {
  minHeight: "42px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  padding: "0 14px",
  border: "1px solid #16a34a",
  borderRadius: "10px",
  background: "#16a34a",
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: 900,
  cursor: "pointer"
};

const draftButtonStyle = {
  ...primaryButtonStyle,
  borderColor: "#4f46e5",
  background: "#4f46e5"
};

const secondaryButtonStyle = {
  minHeight: "42px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  padding: "0 14px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "13px",
  fontWeight: 900,
  cursor: "pointer"
};

const actionButtonStyle = {
  minHeight: "32px",
  padding: "0 10px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "12px",
  fontWeight: 900,
  cursor: "pointer"
};

const dangerButtonStyle = {
  ...actionButtonStyle,
  borderColor: "#fecaca",
  color: "#b91c1c",
  background: "#fff7f7"
};

const disabledActionButtonStyle = {
  ...actionButtonStyle,
  opacity: 0.45,
  cursor: "not-allowed"
};

const successNoticeStyle = {
  padding: "12px 14px",
  border: "1px solid #bbf7d0",
  borderRadius: "10px",
  background: "#f0fdf4",
  color: "#166534",
  fontSize: "13px",
  fontWeight: 800
};

const errorNoticeStyle = {
  ...successNoticeStyle,
  borderColor: "#fecaca",
  background: "#fff7f7",
  color: "#b91c1c"
};

const validationNoticeStyle = {
  ...errorNoticeStyle,
  display: "grid",
  gap: "4px"
};

const uploadProgressWrapStyle = {
  display: "grid",
  gap: "8px",
  padding: "12px 14px",
  border: "1px solid #bfdbfe",
  borderRadius: "10px",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: "13px",
  fontWeight: 800
};

const uploadProgressTrackStyle = {
  overflow: "hidden",
  height: "8px",
  borderRadius: "999px",
  background: "#dbeafe"
};

const uploadProgressBarStyle = {
  height: "100%",
  borderRadius: "999px",
  background: "#2563eb",
  transition: "width 160ms ease"
};

const spinnerStyle = {
  width: "16px",
  height: "16px",
  display: "inline-block",
  marginRight: "8px",
  border: "2px solid #cbd5e1",
  borderTopColor: "#16a34a",
  borderRadius: "999px",
  verticalAlign: "middle"
};

const iconButtonStyle = {
  width: "34px",
  height: "34px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #dbe6ef",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#475569",
  cursor: "pointer"
};

const deleteIconButtonStyle = {
  ...iconButtonStyle,
  color: "#dc2626",
  borderColor: "#fecaca"
};

const visibilityGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "10px"
};

const checkTileStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minHeight: "42px",
  padding: "0 12px",
  border: "1px solid #dbe6ef",
  borderRadius: "10px",
  color: "#0f172a",
  fontSize: "13px",
  fontWeight: 850,
  background: "#ffffff"
};

const blockButtonsStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "10px"
};

const blockTypeButtonStyle = {
  minHeight: "42px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  border: "1px solid #dbe6ef",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "13px",
  fontWeight: 900,
  cursor: "pointer"
};

const compactBlockListStyle = {
  display: "grid",
  gap: "10px"
};

const blockListItemStyle = {
  display: "grid",
  gridTemplateColumns: "24px 42px minmax(0, 1fr) max-content max-content",
  gap: "12px",
  alignItems: "center",
  padding: "12px",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  background: "#ffffff"
};

const blockListItemDragOverStyle = {
  borderColor: "#22c55e",
  boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.14)"
};

const blockListItemDraggingStyle = {
  opacity: 0.58
};

const dragHandleStyle = {
  color: "#94a3b8",
  width: "24px",
  height: "42px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: 0,
  padding: 0,
  background: "transparent",
  cursor: "grab"
};

const blockIconBoxStyle = {
  width: "42px",
  height: "42px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "10px",
  background: "#f1f5f9",
  color: "#475569"
};

const blockInfoStyle = {
  display: "grid",
  gap: "4px",
  minWidth: 0,
  color: "#0f172a"
};

const blockThumbStyle = {
  width: "62px",
  height: "42px",
  objectFit: "cover",
  borderRadius: "8px",
  border: "1px solid #e2e8f0"
};

const compactBlockActionsStyle = {
  display: "flex",
  gap: "8px"
};

const moveActionsStyle = {
  gridColumn: "1 / -1",
  display: "flex",
  gap: "8px",
  flexWrap: "wrap"
};

const blockEditorInlineStyle = {
  gridColumn: "1 / -1",
  padding: "14px",
  border: "1px solid #dbe6ef",
  borderRadius: "12px",
  background: "#fbfdff"
};

const blockEditorActionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  paddingTop: "14px"
};

const addNewBlockStyle = {
  minHeight: "48px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  border: "1px dashed #cbd5e1",
  borderRadius: "12px",
  background: "#ffffff",
  color: "#4f46e5",
  fontSize: "14px",
  fontWeight: 900,
  cursor: "pointer"
};

const textBlockFieldsStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px"
};

const blockFieldsStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(180px, 0.35fr) minmax(0, 0.65fr)",
  gap: "12px"
};

const imageBlockFieldsStyle = {
  display: "grid",
  gap: "14px"
};

const imageSettingsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px"
};

const imageTextFieldsStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px"
};

const imageDropzoneStyle = {
  display: "grid",
  gridTemplateColumns: "160px minmax(0, 1fr)",
  gap: "14px",
  alignItems: "center",
  padding: "14px",
  border: "1px dashed #cbd5e1",
  borderRadius: "12px",
  background: "#ffffff"
};

const compactImageDropzoneStyle = {
  ...imageDropzoneStyle,
  gridTemplateColumns: "96px minmax(0, 1fr)"
};

const imageDropzoneActiveStyle = {
  borderColor: "#16a34a",
  background: "#f0fdf4"
};

const imagePreviewFrameStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "160px",
  aspectRatio: "4 / 3",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  background: "#f8fafc",
  overflow: "hidden"
};

const compactImagePreviewFrameStyle = {
  ...imagePreviewFrameStyle,
  width: "96px"
};

const imagePreviewStyle = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  display: "block"
};

const imagePreviewEmptyStyle = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 900,
  textTransform: "uppercase"
};

const imageDropzoneCopyStyle = {
  display: "grid",
  gap: "8px",
  minWidth: 0
};

const imageDropzoneActionsStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  alignItems: "center"
};

const previewToggleStyle = {
  display: "flex",
  gap: "6px",
  padding: "4px",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  background: "#f8fafc"
};

const toggleButtonStyle = {
  minHeight: "32px",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "0 10px",
  border: 0,
  borderRadius: "8px",
  background: "transparent",
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 900,
  cursor: "pointer"
};

const activeToggleButtonStyle = {
  ...toggleButtonStyle,
  background: "#dcfce7",
  color: "#166534"
};

const previewShellStyle = {
  overflow: "hidden",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  background: "#ffffff"
};

const mobilePreviewShellStyle = {
  ...previewShellStyle,
  width: "min(100%, 330px)",
  margin: "0 auto"
};

const previewNavStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  padding: "12px 16px",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
  fontSize: "12px"
};

const previewHeroStyle = {
  display: "grid",
  placeItems: "center",
  minHeight: "128px",
  padding: "18px",
  textAlign: "center",
  background: "#eef7ef"
};

const previewContentStyle = {
  display: "grid",
  gap: "16px",
  padding: "22px"
};

const previewBlockStyle = {
  display: "grid",
  gap: "8px",
  color: "#334155",
  fontSize: "13px",
  lineHeight: 1.55
};

const previewImageStyle = {
  width: "100%",
  maxHeight: "160px",
  objectFit: "cover",
  borderRadius: "10px"
};

const previewImageTextStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 0.42fr) minmax(0, 0.58fr)",
  gap: "14px",
  alignItems: "center"
};

const previewImageTextOverlayStyle = {
  position: "relative",
  display: "grid",
  minHeight: "150px",
  overflow: "hidden",
  borderRadius: "10px",
  background: "#0f172a"
};

const previewImageTextImageStyle = {
  width: "100%",
  height: "100%",
  maxHeight: "170px",
  objectFit: "cover",
  borderRadius: "10px"
};

const previewImageTextCopyStyle = {
  display: "grid",
  gap: "8px"
};

const previewButtonStyle = {
  width: "max-content",
  display: "inline-flex",
  alignItems: "center",
  minHeight: "30px",
  padding: "0 10px",
  borderRadius: "8px",
  background: "#16a34a",
  color: "#ffffff",
  fontSize: "12px",
  fontWeight: 900
};

const toolbarStyle = {
  display: "grid",
  gridTemplateColumns: "max-content repeat(3, minmax(180px, 1fr))",
  gap: "14px",
  alignItems: "end",
  marginTop: "22px",
  padding: "18px",
  border: "1px solid rgba(203, 213, 225, 0.72)",
  borderRadius: "12px",
  background: "#ffffff",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)"
};

const searchInputWrapStyle = {
  minHeight: "42px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "0 11px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#64748b"
};

const contentLayoutStyle = {
  display: "block",
  marginTop: "18px"
};

const tablePanelStyle = {
  minWidth: 0,
  border: "1px solid rgba(203, 213, 225, 0.72)",
  borderRadius: "12px",
  background: "#ffffff",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
  overflow: "hidden"
};

const tableScrollerStyle = {
  overflowX: "auto"
};

const tableStyle = {
  width: "100%",
  minWidth: "980px",
  borderCollapse: "collapse"
};

const tableHeaderStyle = {
  padding: "14px 16px",
  background: "#f8fafc",
  color: "#475569",
  fontSize: "12px",
  fontWeight: 900,
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  borderBottom: "1px solid #e2e8f0"
};

const tableRowStyle = {
  borderBottom: "1px solid #eef2f7"
};

const tableCellStyle = {
  padding: "14px 16px",
  color: "#475569",
  fontSize: "13px",
  verticalAlign: "top"
};

const titleCellStyle = {
  ...tableCellStyle,
  color: "#0f172a",
  fontWeight: 900
};

const actionsCellStyle = {
  ...tableCellStyle,
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  minWidth: "320px"
};

const emptyTableCellStyle = {
  padding: "28px",
  color: "#64748b",
  fontSize: "14px",
  fontWeight: 800,
  textAlign: "center"
};

const filterFieldStyle = {
  display: "grid",
  gap: "7px",
  minWidth: 0
};

const helperTextStyle = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 800
};

const helperCopyStyle = {
  margin: 0,
  color: "#64748b",
  fontSize: "13px",
  lineHeight: 1.45
};

const pillBaseStyle = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "26px",
  marginRight: "6px",
  padding: "0 9px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: 900,
  textTransform: "capitalize"
};

const activePillStyle = {
  ...pillBaseStyle,
  color: "#166534",
  background: "#dcfce7",
  border: "1px solid #bbf7d0"
};

const inactivePillStyle = {
  ...pillBaseStyle,
  color: "#475569",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0"
};

const publishedPillStyle = {
  ...pillBaseStyle,
  color: "#1d4ed8",
  background: "#dbeafe",
  border: "1px solid #bfdbfe"
};

const draftPillStyle = {
  ...pillBaseStyle,
  color: "#92400e",
  background: "#fef3c7",
  border: "1px solid #fde68a"
};

const emptyBlocksStyle = {
  padding: "18px",
  border: "1px dashed #cbd5e1",
  borderRadius: "12px",
  color: "#64748b",
  fontSize: "14px",
  fontWeight: 800,
  textAlign: "center",
  background: "#f8fafc"
};

const hiddenFileInputStyle = {
  position: "absolute",
  width: "1px",
  height: "1px",
  opacity: 0,
  pointerEvents: "none"
};

const backButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  width: "max-content",
  marginTop: "18px",
  padding: "10px 14px",
  borderRadius: "10px",
  background: "#f1f5f9",
  color: "#0f172a",
  fontSize: "13px",
  fontWeight: 900,
  textDecoration: "none"
};
