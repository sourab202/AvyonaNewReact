import React from "react";
import * as XLSX from "xlsx";
import {
  FaCheckCircle,
  FaDownload,
  FaExclamationTriangle,
  FaFileExcel,
  FaFileUpload,
  FaHistory,
  FaPlay,
  FaSyncAlt,
  FaTasks
} from "react-icons/fa";
import {
  cancelInventoryImportJob,
  createInventoryExportJob,
  createInventoryImportJob,
  fetchCategories,
  downloadInventoryExportFile,
  downloadInventoryOriginalFile,
  fetchInventoryExportJob,
  fetchInventoryExportJobs,
  fetchInventoryFailedRows,
  fetchInventoryImportHistory,
  fetchInventoryImportJob,
  retryInventoryFailedRows,
  startInventoryImportJob
} from "../../api/adminApi";

const tabs = [
  {
    id: "upload",
    label: "Upload Inventory",
    icon: FaFileUpload,
    title: "Upload Inventory",
    description: "Upload CSV or XLSX inventory files. ASIN and SKU are separate required columns, and both are used as product identity.",
    actions: ["Require ASIN column", "Require SKU column", "Map file columns"]
  },
  {
    id: "validation",
    label: "Validation Results",
    icon: FaCheckCircle,
    title: "Validation Results",
    description: "Review valid rows, warnings, missing ASIN or SKU values, duplicate keys, and ASIN/SKU mismatch issues before import.",
    actions: ["Check ASIN keys", "Check SKU keys", "Confirm data mapping"]
  },
  {
    id: "progress",
    label: "Import Progress",
    icon: FaTasks,
    title: "Import Progress",
    description: "Track import batches while rows are matched by ASIN and SKU and product records are created or updated.",
    actions: ["Matched products", "Created products", "Updated products"]
  },
  {
    id: "history",
    label: "Import History",
    icon: FaHistory,
    title: "Import History",
    description: "View previous inventory imports, who uploaded them, ASIN and SKU row counts, import status, and timestamps.",
    actions: ["Recent imports", "ASIN summary", "SKU summary"]
  },
  {
    id: "failed",
    label: "Failed Rows",
    icon: FaExclamationTriangle,
    title: "Failed Rows",
    description: "Inspect rows that failed validation or update, including missing ASIN, missing SKU, or mismatched keys.",
    actions: ["Failure reason", "Original ASIN", "Original SKU"]
  },
  {
    id: "export",
    label: "Export Inventory",
    icon: FaDownload,
    title: "Export Inventory",
    description: "Export current product inventory with separate ASIN and SKU columns so exported files can be re-imported safely.",
    actions: ["Export with ASIN", "Export with SKU", "Export XLSX"]
  },
  {
    id: "update",
    label: "Update Existing Inventory",
    icon: FaSyncAlt,
    title: "Update Existing Inventory",
    description: "Update existing products by ASIN and SKU. If either key exists for the same product, update it; if neither exists, create a new product.",
    actions: ["Match by ASIN", "Match by SKU", "Create if both keys are new"]
  }
];

const excelTemplates = [
  {
    id: "full-product",
    name: "Full Product Template",
    fileName: "avyona-full-product-template.xlsx",
    description: "Use this for new product creation and full product updates.",
    columns: [
      "Product Name",
      "ASIN",
      "SKU",
      "Product Slug",
      "Product Type",
      "Product Status",
      "Brand",
      "Category",
      "Subcategory",
      "Collection",
      "Featured Product",
      "Selling Price",
      "MRP",
      "Tax Included",
      "Tax Percentage",
      "Stock Quantity",
      "Low Stock Threshold",
      "Stock Status",
      "Availability Message",
      "Delivery Estimate",
      "Dispatch Time",
      "Short Description",
      "Description",
      "Highlight 1",
      "Highlight 2",
      "Highlight 3",
      "Highlight 4",
      "Highlight 5",
      "Primary Image URL",
      "Gallery Image URL 1",
      "Gallery Image URL 2",
      "Gallery Image URL 3",
      "Gallery Image URL 4",
      "Gallery Image URL 5",
      "Video URL 1",
      "Video URL 2",
      "Spec Group 1",
      "Spec Label 1",
      "Spec Value 1",
      "Spec Group 2",
      "Spec Label 2",
      "Spec Value 2",
      "Spec Group 3",
      "Spec Label 3",
      "Spec Value 3",
      "Shipping Information",
      "Return & Refund",
      "Warranty Support",
      "COD Information",
      "FAQ Question 1",
      "FAQ Answer 1",
      "FAQ Question 2",
      "FAQ Answer 2",
      "FAQ Question 3",
      "FAQ Answer 3",
      "Related Products Mode",
      "Auto Related By Category",
      "Manual Related ASIN",
      "Manual Related SKU",
      "Variant Group Name",
      "Variant Type",
      "Variant Value",
      "Meta Title",
      "Canonical URL",
      "Meta Description",
      "Meta Keywords",
      "OG Image URL"
    ],
    sampleRows: [
      [
        "Avyona Aura 10 Frame",
        "B0AVYFRAME10",
        "AVY-FRAME-10",
        "avyona-aura-10-frame",
        "simple",
        "active",
        "Avyona",
        "Digital Photo Frames",
        "Smart Frames",
        "Aura Collection",
        "Yes",
        "9999",
        "12999",
        "Yes",
        "18",
        "45",
        "5",
        "in-stock",
        "Available for immediate dispatch",
        "3-7 business days",
        "Within 24-48 hours",
        "Premium digital frame for family photos.",
        "Write the full product description here.",
        "10 inch HD display",
        "Wi-Fi photo sharing",
        "Cloud album support",
        "Gift-ready packaging",
        "Warranty included",
        "https://example.com/primary-image.webp",
        "https://example.com/gallery-1.webp",
        "https://example.com/gallery-2.webp",
        "https://example.com/gallery-3.webp",
        "https://example.com/gallery-4.webp",
        "https://example.com/gallery-5.webp",
        "https://example.com/video-1.mp4",
        "https://example.com/video-2.mp4",
        "General Information",
        "Brand",
        "Avyona",
        "Display",
        "Screen Size",
        "10 inch",
        "Connectivity",
        "Wi-Fi",
        "Supported",
        "Ships with standard delivery.",
        "Return allowed as per policy.",
        "1 year warranty support.",
        "COD available for eligible pincodes.",
        "Does it support Wi-Fi?",
        "Yes, it supports Wi-Fi photo sharing.",
        "Is warranty included?",
        "Yes, warranty support is included.",
        "Can I gift this product?",
        "Yes, it is gift-ready.",
        "auto-and-manual",
        "Yes",
        "B0AVYFRAME8, B0AVYFRAME12",
        "AVY-FRAME-8, AVY-FRAME-12",
        "Aura Frames",
        "Color",
        "Pearl White",
        "Avyona Aura 10 Frame",
        "https://www.avyona.com/product/avyona-aura-10-frame",
        "Buy Avyona Aura 10 Frame for smart photo sharing.",
        "digital frame, smart frame, avyona",
        "https://example.com/og-image.webp"
      ]
    ]
  },
  {
    id: "stock-update",
    name: "Stock Update Template",
    fileName: "avyona-stock-update-template.xlsx",
    description: "Use this for inventory quantity and stock visibility updates. Stock Status accepts in-stock, active, available, out-of-stock, inactive, and unavailable.",
    columns: [
      "ASIN",
      "SKU",
      "Stock Quantity",
      "Stock Status",
      "Availability Message"
    ],
    sampleRows: [
      ["B0AVYFRAME10", "AVY-FRAME-10", "45", "in-stock", "Available for immediate dispatch"]
    ]
  },
  {
    id: "price-update",
    name: "Price Update Template",
    fileName: "avyona-price-update-template.xlsx",
    description: "Use this for price-only updates without changing product content.",
    columns: [
      "ASIN",
      "SKU",
      "MRP",
      "Selling Price",
      "Tax Included"
    ],
    sampleRows: [
      ["B0AVYFRAME10", "AVY-FRAME-10", "12999", "9999", "Yes"]
    ]
  }
];

function downloadExcelTemplate(template) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([template.columns, ...template.sampleRows]);
  worksheet["!cols"] = template.columns.map((column) => ({ wch: Math.max(14, String(column).length + 2) }));
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory Template");
  XLSX.writeFile(workbook, template.fileName, { bookType: "xlsx" });
}

function formatExportDate() {
  return new Date().toISOString().slice(0, 10);
}

function downloadFailedRows(failedRows) {
  const flattenedRows = failedRows.map((item) => ({
    Row: item.rowNumber,
    ASIN: item.asin,
    SKU: item.sku,
    Errors: item.errorReason || (item.errors || []).join("; "),
    "How to Fix": (item.fixes || []).join("; ") || extractFixFromStoredError(item.errorReason),
    ...(item.originalRowData || item.row || {})
  }));
  const worksheet = XLSX.utils.json_to_sheet(flattenedRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Failed Rows");
  XLSX.writeFile(workbook, `avyona-failed-inventory-rows-${formatExportDate()}.xlsx`, { bookType: "xlsx" });
}

const SUPPORTED_IMPORT_EXTENSIONS = [".xlsx", ".xls", ".csv", ".tsv", ".txt"];
const SUPPORTED_IMPORT_ACCEPT = SUPPORTED_IMPORT_EXTENSIONS.join(",");

function isSupportedImportFile(file) {
  const name = String(file?.name || "").toLowerCase();
  return SUPPORTED_IMPORT_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function extractFixFromStoredError(errorReason) {
  const marker = "How to fix:";
  const value = String(errorReason || "");
  const index = value.toLowerCase().indexOf(marker.toLowerCase());
  return index >= 0 ? value.slice(index + marker.length).trim() : "";
}

function downloadBlob(response, fallbackFileName) {
  const disposition = response.headers?.["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const fileName = match?.[1] || fallbackFileName;
  const blobUrl = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}

export default function InventoryManager() {
  const fileInputRef = React.useRef(null);
  const [activeTab, setActiveTab] = React.useState(tabs[0].id);
  const [uploadConfig, setUploadConfig] = React.useState({
    file: null,
    importType: "create-update",
    templateType: "full-product",
    autoCreateMissingCategoryBrand: true,
    updateControls: {
      basicInfo: true,
      pricing: true,
      stock: true,
      media: false,
      description: true,
      specifications: false,
      seo: false,
      policies: false,
      faqs: false,
      variantGroups: false
    }
  });
  const [validationMessage, setValidationMessage] = React.useState("");
  const [validationResult, setValidationResult] = React.useState(null);
  const [isValidating, setIsValidating] = React.useState(false);
  const [importJob, setImportJob] = React.useState(null);
  const [isStartingImport, setIsStartingImport] = React.useState(false);
  const [importHistory, setImportHistory] = React.useState([]);
  const [failedRows, setFailedRows] = React.useState([]);
  const [selectedHistory, setSelectedHistory] = React.useState(null);
  const [historyMessage, setHistoryMessage] = React.useState("");
  const [categories, setCategories] = React.useState([]);
  const [exportFilters, setExportFilters] = React.useState({
    exportType: "complete",
    category: "",
    subcategory: "",
    brand: "",
    status: "",
    stockStatus: "",
    startDate: "",
    endDate: ""
  });
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportMessage, setExportMessage] = React.useState("");
  const [exportJob, setExportJob] = React.useState(null);
  const [exportJobs, setExportJobs] = React.useState([]);
  const [isDraggingFile, setIsDraggingFile] = React.useState(false);
  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const ActiveIcon = activeTabConfig.icon;
  const parentCategories = React.useMemo(
    () => categories.filter((category) => !category.parentId && category.status !== "inactive"),
    [categories]
  );
  const subcategories = React.useMemo(() => {
    const selectedCategory = categories.find((category) => category.slug === exportFilters.category);
    return categories.filter((category) => Number(category.parentId || 0) === Number(selectedCategory?.id || 0));
  }, [categories, exportFilters.category]);

  React.useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      try {
        const response = await fetchCategories();
        if (!isMounted) return;
        setCategories(Array.isArray(response.data?.data) ? response.data.data : []);
      } catch {
        if (isMounted) setCategories([]);
      }
    }

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!importJob?.jobId || !["queued", "validating", "processing"].includes(importJob.status)) return undefined;

    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetchInventoryImportJob(importJob.jobId);
        setImportJob(response.data?.data || null);
      } catch {
        window.clearInterval(intervalId);
      }
    }, 1500);

    return () => window.clearInterval(intervalId);
  }, [importJob?.jobId, importJob?.status]);

  const loadExportJobs = React.useCallback(async () => {
    try {
      const response = await fetchInventoryExportJobs();
      setExportJobs(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch {
      setExportJobs([]);
    }
  }, []);

  React.useEffect(() => {
    if (activeTab === "export") loadExportJobs();
  }, [activeTab, loadExportJobs]);

  React.useEffect(() => {
    if (!exportJob?.jobId || !["queued", "processing"].includes(exportJob.status)) return undefined;

    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetchInventoryExportJob(exportJob.jobId);
        const nextJob = response.data?.data || null;
        setExportJob(nextJob);
        if (nextJob?.status === "completed") {
          setExportMessage("Export ready. Download the Excel file when you are ready.");
          loadExportJobs();
        }
        if (nextJob?.status === "failed") {
          setExportMessage(nextJob.message || "Export failed.");
          loadExportJobs();
        }
      } catch (error) {
        setExportMessage(error.response?.data?.message || error.message || "Unable to refresh export status.");
      }
    }, 1500);

    return () => window.clearInterval(intervalId);
  }, [exportJob?.jobId, exportJob?.status, loadExportJobs]);

  React.useEffect(() => {
    if (!["history", "failed"].includes(activeTab)) return;
    let isMounted = true;

    async function loadImportRecords() {
      try {
        const [historyResponse, failedResponse] = await Promise.all([
          fetchInventoryImportHistory(),
          fetchInventoryFailedRows()
        ]);
        if (!isMounted) return;
        setImportHistory(Array.isArray(historyResponse.data?.data) ? historyResponse.data.data : []);
        setFailedRows(Array.isArray(failedResponse.data?.data) ? failedResponse.data.data : []);
      } catch (error) {
        if (isMounted) setHistoryMessage(error.response?.data?.message || error.message || "Unable to load import records.");
      }
    }

    loadImportRecords();

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  const updateExportFilter = (key, value) => {
    setExportFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "category" ? { subcategory: "" } : null)
    }));
  };

  const updateUploadConfig = (key, value) => {
    setUploadConfig((current) => ({
      ...current,
      [key]: value
    }));
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === "update") {
      updateUploadConfig("importType", "update-only");
    }
  };

  const selectInventoryFile = (file) => {
    if (!file) return;
    if (!isSupportedImportFile(file)) {
      setValidationMessage("Unsupported format. Upload XLSX, XLS, CSV, TSV, or delimited TXT.");
      updateUploadConfig("file", null);
      return;
    }
    setValidationMessage("");
    updateUploadConfig("file", file);
  };

  const openInventoryFilePicker = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  const handleDropInventoryFile = (event) => {
    event.preventDefault();
    setIsDraggingFile(false);
    selectInventoryFile(event.dataTransfer.files?.[0] || null);
  };

  const updateImportControl = (key, value) => {
    setUploadConfig((current) => ({
      ...current,
      updateControls: {
        ...current.updateControls,
        [key]: value
      }
    }));
  };

  const handleStartValidation = async () => {
    if (!uploadConfig.file) {
      setValidationMessage("Select an XLSX, XLS, CSV, TSV, or TXT inventory file before validation.");
      return;
    }

    if (!isSupportedImportFile(uploadConfig.file)) {
      setValidationMessage("Unsupported format. Upload XLSX, XLS, CSV, TSV, or delimited TXT.");
      return;
    }

    setIsValidating(true);
    setValidationMessage("");
    setValidationResult(null);

    try {
      const formData = new FormData();
      formData.append("file", uploadConfig.file);
      formData.append("importType", uploadConfig.importType);
      formData.append("templateType", uploadConfig.templateType);
      formData.append("autoCreateMissingCategoryBrand", String(uploadConfig.autoCreateMissingCategoryBrand));
      formData.append("updateControls", JSON.stringify(uploadConfig.updateControls));
      const response = await createInventoryImportJob(formData);
      const job = response.data?.data || null;
      setImportJob(job);
      setValidationResult(job?.validation || null);
      setValidationMessage(`${uploadConfig.file.name} validation completed.`);
      setActiveTab("validation");
    } catch (error) {
      const message = error.response?.data?.message || error.message || "Unable to validate inventory file.";
      const fix = error.response?.data?.details?.howToFix;
      setValidationMessage(fix ? `${message} How to fix: ${fix}` : message);
    } finally {
      setIsValidating(false);
    }
  };

  const cancelValidation = () => {
    setValidationResult(null);
    setImportJob(null);
    setValidationMessage("");
  };

  const handleStartImport = async () => {
    if (!importJob?.jobId) {
      setValidationMessage("Create and validate an import job before starting import.");
      return;
    }

    setIsStartingImport(true);
    try {
      const response = await startInventoryImportJob(importJob.jobId);
      setImportJob(response.data?.data || null);
      setActiveTab("progress");
    } catch (error) {
      setValidationMessage(error.response?.data?.message || error.message || "Unable to start import.");
    } finally {
      setIsStartingImport(false);
    }
  };

  const handleCancelImport = async () => {
    if (!importJob?.jobId) {
      cancelValidation();
      return;
    }

    try {
      const response = await cancelInventoryImportJob(importJob.jobId);
      setImportJob(response.data?.data || null);
    } catch {
      cancelValidation();
    }
  };

  const viewImportReport = async (jobId) => {
    try {
      const response = await fetchInventoryImportJob(jobId);
      const report = response.data?.data || null;
      setSelectedHistory(report);
      setImportJob(report);
      setActiveTab("progress");
    } catch (error) {
      setHistoryMessage(error.response?.data?.message || error.message || "Unable to load import report.");
    }
  };

  const downloadOriginalFile = async (jobId) => {
    try {
      const response = await downloadInventoryOriginalFile(jobId);
      downloadBlob(response, `${jobId}.xlsx`);
    } catch (error) {
      setHistoryMessage(error.response?.data?.message || error.message || "Unable to download original file.");
    }
  };

  const downloadFailedRowsForJob = async (jobId) => {
    try {
      const response = await fetchInventoryFailedRows(jobId);
      downloadFailedRows(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (error) {
      setHistoryMessage(error.response?.data?.message || error.message || "Unable to download failed rows.");
    }
  };

  const retryFailedRowsForJob = async (jobId) => {
    try {
      const response = await retryInventoryFailedRows(jobId, { updateControls: uploadConfig.updateControls });
      setImportJob(response.data?.data || null);
      setValidationResult(response.data?.data?.validation || null);
      setActiveTab("validation");
    } catch (error) {
      setHistoryMessage(error.response?.data?.message || error.message || "Unable to retry failed rows.");
    }
  };

  const handleExportInventory = async () => {
    setIsExporting(true);
    setExportMessage("");

    try {
      const response = await createInventoryExportJob(exportFilters);
      const nextJob = response.data?.data || null;
      setExportJob(nextJob);
      setExportMessage(nextJob?.message || "Export queued. You can keep using the dashboard.");
      loadExportJobs();
    } catch (error) {
      setExportMessage(error.response?.data?.message || error.message || "Unable to export inventory.");
    } finally {
      setIsExporting(false);
    }
  };

  const downloadExportJobFile = async (jobId) => {
    try {
      const response = await downloadInventoryExportFile(jobId);
      downloadBlob(response, `avyona-inventory-export-${formatExportDate()}.xlsx`);
    } catch (error) {
      setExportMessage(error.response?.data?.message || error.message || "Unable to download export file.");
    }
  };

  return (
    <section className="dashboard-page-shell dashboard-admin-page inventory-manager-page" style={pageStyle}>
      <div className="dashboard-page-heading">
        <div>
          <h2 style={{ margin: 0 }}>Inventory Manager</h2>
          <p className="dashboard-page-copy">
            Import, validate, update, and export product inventory from one controlled workflow.
          </p>
        </div>
        <span style={statusPillStyle}>Products / Inventory Manager</span>
      </div>

      <div className="inventory-manager-tabs" style={tabListStyle} role="tablist" aria-label="Inventory manager sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabChange(tab.id)}
              className="inventory-manager-tab"
              style={{
                ...tabButtonStyle,
                ...(isActive ? activeTabButtonStyle : null)
              }}
            >
              <Icon aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <article className="inventory-manager-panel" style={panelStyle}>
          <div className="inventory-manager-rule-banner" style={ruleBannerStyle}>
            <strong>Master key rule</strong>
            <span>ASIN and SKU are separate unique product identity fields for every import, update, and export.</span>
            <span>If ASIN or SKU exists for the same product, the row updates that product. If both are new, the row creates a new product.</span>
            <span>If ASIN belongs to one product and SKU belongs to another, the row must fail validation.</span>
          </div>

          <div style={panelHeaderStyle}>
            <div style={panelTitleRowStyle}>
              <span style={panelIconStyle}>
                <ActiveIcon aria-hidden="true" />
              </span>
              <div>
                <p style={eyebrowStyle}>Inventory Import & Export</p>
                <h3 style={panelTitleStyle}>{activeTabConfig.title}</h3>
              </div>
            </div>
          </div>

          <p style={panelCopyStyle}>{activeTabConfig.description}</p>

          <div className="inventory-manager-action-grid" style={actionGridStyle}>
            {activeTabConfig.actions.map((action) => (
              <div key={action} style={actionCardStyle}>
                <FaTasks aria-hidden="true" />
                <strong>{action}</strong>
              </div>
            ))}
          </div>

          {["upload", "update"].includes(activeTab) ? (
            <section className="inventory-manager-section" style={exportPanelStyle}>
              <div className="inventory-manager-section-header" style={templateHeaderStyle}>
                <div>
                  <p style={eyebrowStyle}>{activeTab === "update" ? "Update Existing Inventory" : "Upload Inventory"}</p>
                  <h4 style={templateTitleStyle}>
                    {activeTab === "update" ? "Prepare Existing Product Updates For Validation" : "Prepare Inventory File For Validation"}
                  </h4>
                </div>
                <span style={modulePillStyle}>XLSX, XLS, CSV, TSV, TXT</span>
              </div>

              <section className="inventory-manager-template-panel" style={templatePanelStyle}>
                <div className="inventory-manager-section-header" style={templateHeaderStyle}>
                  <div>
                    <p style={eyebrowStyle}>Excel Templates</p>
                    <h4 style={templateTitleStyle}>Download Import Templates</h4>
                  </div>
                  <span style={modulePillStyle}>ASIN + SKU Required</span>
                </div>

                <div className="inventory-manager-template-grid" style={templateGridStyle}>
                  {excelTemplates.map((template) => (
                    <article className="inventory-manager-template-card" key={template.id} style={templateCardStyle}>
                      <div className="inventory-manager-template-card-header" style={templateCardHeaderStyle}>
                        <span style={templateIconStyle}>
                          <FaFileExcel aria-hidden="true" />
                        </span>
                        <div>
                          <strong>{template.name}</strong>
                          <p style={templateDescriptionStyle}>{template.description}</p>
                        </div>
                      </div>
                      <div style={columnPreviewStyle}>
                        {template.columns.slice(0, 6).map((column) => (
                          <span key={column} style={columnPillStyle}>{column}</span>
                        ))}
                        {template.columns.length > 6 ? <span style={columnPillStyle}>{`+${template.columns.length - 6} more`}</span> : null}
                      </div>
                      <button type="button" onClick={() => downloadExcelTemplate(template)} style={downloadButtonStyle}>
                        <FaDownload aria-hidden="true" />
                        Download Template
                      </button>
                    </article>
                  ))}
                </div>
              </section>

              <div className="inventory-manager-upload-grid" style={exportGridStyle}>
                <div style={fieldStyle}>
                  <span>Select File</span>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={openInventoryFilePicker}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openInventoryFilePicker();
                      }
                    }}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setIsDraggingFile(true);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setIsDraggingFile(true);
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={handleDropInventoryFile}
                    style={{
                      ...dropzoneStyle,
                      ...(isDraggingFile ? dropzoneActiveStyle : null)
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={SUPPORTED_IMPORT_ACCEPT}
                      onChange={(event) => selectInventoryFile(event.target.files?.[0] || null)}
                      style={hiddenFileInputStyle}
                    />
                    <span style={dropzoneIconWrapStyle}>
                      <FaFileExcel aria-hidden="true" style={dropzoneIconStyle} />
                    </span>
                    <span style={dropzoneTextStyle}>
                      <strong>{uploadConfig.file ? uploadConfig.file.name : "Click or drag a product data file"}</strong>
                      <small>{uploadConfig.file ? `${Math.max(1, Math.round(uploadConfig.file.size / 1024))} KB selected` : "XLSX, XLS, CSV, TSV, or delimited TXT"}</small>
                    </span>
                  </div>
                </div>

                <label style={fieldStyle}>
                  <span>Select Import Type</span>
                  <select value={uploadConfig.importType} onChange={(event) => updateUploadConfig("importType", event.target.value)} style={inputStyle}>
                    <option value="create-only">Create New Only</option>
                    <option value="update-only">Update Existing Only</option>
                    <option value="create-update">Create + Update</option>
                  </select>
                </label>

                <label style={fieldStyle}>
                  <span>Select Template Type</span>
                  <select value={uploadConfig.templateType} onChange={(event) => updateUploadConfig("templateType", event.target.value)} style={inputStyle}>
                    <option value="full-product">Full Product Template</option>
                    <option value="stock-update">Stock Update Template</option>
                    <option value="price-update">Price Update Template</option>
                  </select>
                </label>

                <label style={toggleFieldStyle}>
                  <input
                    type="checkbox"
                    checked={uploadConfig.autoCreateMissingCategoryBrand}
                    onChange={(event) => updateUploadConfig("autoCreateMissingCategoryBrand", event.target.checked)}
                  />
                  <span>Auto-create missing category/brand</span>
                </label>
              </div>

              <section className="inventory-manager-control-panel" style={controlPanelStyle}>
                <div>
                  <p style={eyebrowStyle}>Update Control Options</p>
                  <h4 style={templateTitleStyle}>Choose Fields Allowed To Overwrite</h4>
                  <p style={controlCopyStyle}>Unchecked sections will be protected during import, preventing accidental overwrite.</p>
                </div>

                <div className="inventory-manager-control-grid" style={controlGridStyle}>
                  {[
                    ["basicInfo", "Update product basic info"],
                    ["pricing", "Update pricing"],
                    ["stock", "Update stock"],
                    ["media", "Update media"],
                    ["description", "Update description"],
                    ["specifications", "Update specifications"],
                    ["seo", "Update SEO"],
                    ["policies", "Update policies"],
                    ["faqs", "Update FAQs"],
                    ["variantGroups", "Update variant groups"]
                  ].map(([key, label]) => (
                    <label key={key} style={checkboxCardStyle}>
                      <input
                        type="checkbox"
                        checked={uploadConfig.updateControls[key]}
                        onChange={(event) => updateImportControl(key, event.target.checked)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </section>

              <div style={exportActionRowStyle}>
                <button type="button" disabled={!uploadConfig.file || isValidating} onClick={handleStartValidation} style={downloadButtonStyle}>
                  <FaPlay aria-hidden="true" />
                  {isValidating ? "Validating..." : "Start Validation"}
                </button>
                {validationMessage ? <span style={exportMessageStyle}>{validationMessage}</span> : null}
              </div>
            </section>
          ) : null}

          {activeTab === "validation" ? (
            <section className="inventory-manager-section" style={exportPanelStyle}>
              <div style={templateHeaderStyle}>
                <div>
                  <p style={eyebrowStyle}>Validation Results</p>
                  <h4 style={templateTitleStyle}>Inventory Import Validation Summary</h4>
                </div>
                <span style={modulePillStyle}>No Invalid Rows Imported</span>
              </div>

              {validationResult ? (
                <>
                  <div className="inventory-manager-result-grid" style={resultGridStyle}>
                    {[
                      ["Total rows", validationResult.totalRows],
                      ["Valid rows", validationResult.validRows],
                      ["Failed rows", validationResult.failedRows],
                      ["Duplicate ASINs", validationResult.duplicateAsins?.length || 0],
                      ["Duplicate SKUs", validationResult.duplicateSkus?.length || 0],
                      ["New products", validationResult.newProducts],
                      ["Existing products", validationResult.existingProducts],
                      ["Products to update", validationResult.productsToUpdate],
                      ["Products to create", validationResult.productsToCreate],
                      ["Products to skip", validationResult.skippedProducts]
                    ].map(([label, value]) => (
                      <div key={label} style={resultCardStyle}>
                        <span>{label}</span>
                        <strong>{value || 0}</strong>
                      </div>
                    ))}
                  </div>

                  {validationResult.failedRowDetails?.length ? (
                    <div style={failedRowsPanelStyle}>
                      <strong>Failed Rows</strong>
                      <div style={failedRowsListStyle}>
                        {validationResult.failedRowDetails.slice(0, 8).map((item) => (
                          <div key={`${item.rowNumber}-${item.asin}-${item.sku}`} style={failedRowStyle}>
                            <span>{`Row ${item.rowNumber}`}</span>
                            <strong>{`${item.asin || "Missing ASIN"} / ${item.sku || "Missing SKU"}`}</strong>
                            <small>{`Reason: ${(item.errors || []).join("; ")}`}</small>
                            <small style={{ color: "#166534" }}>{`How to fix: ${(item.fixes || []).join("; ")}`}</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div style={exportActionRowStyle}>
                    <button type="button" disabled={validationResult.validRows <= 0 || isStartingImport} onClick={handleStartImport} style={downloadButtonStyle}>
                      <FaPlay aria-hidden="true" />
                      {isStartingImport ? "Starting..." : "Start Import"}
                    </button>
                    <button
                      type="button"
                      disabled={!validationResult.failedRowDetails?.length}
                      onClick={() => downloadFailedRows(validationResult.failedRowDetails || [])}
                      style={secondaryButtonStyle}
                    >
                      <FaDownload aria-hidden="true" />
                      Download Failed Rows
                    </button>
                    <button type="button" onClick={handleCancelImport} style={secondaryButtonStyle}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div style={placeholderStyle}>
                  <strong>No validation run yet.</strong>
                  <p>Upload an XLSX, XLS, CSV, TSV, or TXT inventory file and click Start Validation.</p>
                </div>
              )}
            </section>
          ) : null}

          {activeTab === "progress" ? (
            <section className="inventory-manager-section" style={exportPanelStyle}>
              <div style={templateHeaderStyle}>
                <div>
                  <p style={eyebrowStyle}>Import Progress</p>
                  <h4 style={templateTitleStyle}>Background Import Job</h4>
                </div>
                <span style={modulePillStyle}>{importJob?.status || "No Job"}</span>
              </div>

              {importJob ? (
                <>
                  <div style={progressBarTrackStyle}>
                    <div style={{ ...progressBarFillStyle, width: `${Math.min(100, Number(importJob.percentageCompleted || 0))}%` }} />
                  </div>

                  <div className="inventory-manager-result-grid" style={resultGridStyle}>
                    {[
                      ["Total rows", importJob.totalRows],
                      ["Processed rows", importJob.processedRows],
                      ["Success rows", importJob.successRows],
                      ["Failed rows", importJob.failedRows],
                      ["Skipped rows", importJob.report?.skippedRows || 0],
                      ["Current batch", importJob.currentBatch],
                      ["Percentage completed", `${importJob.percentageCompleted || 0}%`]
                    ].map(([label, value]) => (
                      <div key={label} style={resultCardStyle}>
                        <span>{label}</span>
                        <strong>{value || 0}</strong>
                      </div>
                    ))}
                  </div>

                  <div style={exportActionRowStyle}>
                    {["queued", "processing", "validating"].includes(importJob.status) ? (
                      <button type="button" onClick={handleCancelImport} style={secondaryButtonStyle}>
                        Cancel Import
                      </button>
                    ) : null}
                    {importJob.report?.failedRows?.length ? (
                      <button type="button" onClick={() => downloadFailedRows(importJob.report.failedRows)} style={secondaryButtonStyle}>
                        <FaDownload aria-hidden="true" />
                        Download Failed Rows
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <div style={placeholderStyle}>
                  <strong>No import job started yet.</strong>
                  <p>Validate an uploaded product data file, then click Start Import.</p>
                </div>
              )}
            </section>
          ) : null}

          {activeTab === "history" ? (
            <section className="inventory-manager-section" style={exportPanelStyle}>
              <div style={templateHeaderStyle}>
                <div>
                  <p style={eyebrowStyle}>Import History</p>
                  <h4 style={templateTitleStyle}>Stored Inventory Uploads</h4>
                </div>
                <span style={modulePillStyle}>{`${importHistory.length} Imports`}</span>
              </div>

              {historyMessage ? <span style={exportMessageStyle}>{historyMessage}</span> : null}

              <div className="inventory-manager-table-wrap" style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {["Import ID", "File name", "Template type", "Import type", "Uploaded by", "Total rows", "Success rows", "Failed rows", "Status", "Created date", "Completed date", "Actions"].map((heading) => (
                        <th key={heading} style={thStyle}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importHistory.length ? importHistory.map((item) => (
                      <tr key={item.importId}>
                        <td style={tdStyle}>{item.importId}</td>
                        <td style={tdStyle}>{item.fileName}</td>
                        <td style={tdStyle}>{item.templateType}</td>
                        <td style={tdStyle}>{item.importType}</td>
                        <td style={tdStyle}>{item.uploadedBy || "Unknown"}</td>
                        <td style={tdStyle}>{item.totalRows || 0}</td>
                        <td style={tdStyle}>{item.successRows || 0}</td>
                        <td style={tdStyle}>{item.failedRows || 0}</td>
                        <td style={tdStyle}>{item.status}</td>
                        <td style={tdStyle}>{item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN") : ""}</td>
                        <td style={tdStyle}>{item.completedAt ? new Date(item.completedAt).toLocaleString("en-IN") : ""}</td>
                        <td style={tdStyle}>
                          <div style={tableActionStyle}>
                            <button type="button" onClick={() => viewImportReport(item.importId)} style={miniButtonStyle}>View report</button>
                            <button type="button" onClick={() => downloadOriginalFile(item.importId)} style={miniButtonStyle}>Download original</button>
                            <button type="button" onClick={() => downloadFailedRowsForJob(item.importId)} style={miniButtonStyle}>Download failed</button>
                            <button type="button" onClick={() => retryFailedRowsForJob(item.importId)} style={miniButtonStyle}>Retry failed</button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td style={tdStyle} colSpan={12}>No import history yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeTab === "failed" ? (
            <section className="inventory-manager-section" style={exportPanelStyle}>
              <div style={templateHeaderStyle}>
                <div>
                  <p style={eyebrowStyle}>Failed Rows</p>
                  <h4 style={templateTitleStyle}>Rows Blocked From Import</h4>
                </div>
                <button type="button" onClick={() => downloadFailedRows(failedRows)} style={secondaryButtonStyle}>
                  <FaDownload aria-hidden="true" />
                  Download Failed Excel
                </button>
              </div>

              <div className="inventory-manager-table-wrap" style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {["Import ID", "Row number", "ASIN", "SKU", "Error reason", "How to fix", "Original row data"].map((heading) => (
                        <th key={heading} style={thStyle}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {failedRows.length ? failedRows.map((item) => (
                      <tr key={`${item.importId}-${item.rowNumber}-${item.asin}-${item.sku}`}>
                        <td style={tdStyle}>{item.importId}</td>
                        <td style={tdStyle}>{item.rowNumber}</td>
                        <td style={tdStyle}>{item.asin}</td>
                        <td style={tdStyle}>{item.sku}</td>
                        <td style={tdStyle}>{item.errorReason}</td>
                        <td style={tdStyle}>{extractFixFromStoredError(item.errorReason) || "Correct the row using the downloaded template."}</td>
                        <td style={tdStyle}>{JSON.stringify(item.originalRowData || {})}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td style={tdStyle} colSpan={7}>No failed rows yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeTab === "export" ? (
            <section className="inventory-manager-section" style={exportPanelStyle}>
              <div style={templateHeaderStyle}>
                <div>
                  <p style={eyebrowStyle}>Export Inventory</p>
                  <h4 style={templateTitleStyle}>Export Product Inventory To Excel</h4>
                </div>
                <span style={modulePillStyle}>XLSX Output</span>
              </div>

              <div className="inventory-manager-upload-grid" style={exportGridStyle}>
                <label style={fieldStyle}>
                  <span>Export Type</span>
                  <select value={exportFilters.exportType} onChange={(event) => updateExportFilter("exportType", event.target.value)} style={inputStyle}>
                    <option value="complete">Complete inventory</option>
                    <option value="category">Selected category</option>
                    <option value="brand">Selected brand</option>
                    <option value="low-stock">Low stock products</option>
                    <option value="active">Active products</option>
                    <option value="inactive">Inactive products</option>
                    <option value="draft">Draft products</option>
                    <option value="status">Status-wise Products</option>
                  </select>
                </label>

                <label style={fieldStyle}>
                  <span>Category</span>
                  <select value={exportFilters.category} onChange={(event) => updateExportFilter("category", event.target.value)} style={inputStyle}>
                    <option value="">All Categories</option>
                    {parentCategories.map((category) => (
                      <option key={category.slug} value={category.slug}>{category.name}</option>
                    ))}
                  </select>
                </label>

                <label style={fieldStyle}>
                  <span>Subcategory</span>
                  <select value={exportFilters.subcategory} onChange={(event) => updateExportFilter("subcategory", event.target.value)} style={inputStyle} disabled={!exportFilters.category}>
                    <option value="">{exportFilters.category ? "All Subcategories" : "Choose category first"}</option>
                    {subcategories.map((subcategory) => (
                      <option key={subcategory.slug} value={subcategory.slug}>{subcategory.name}</option>
                    ))}
                  </select>
                </label>

                <label style={fieldStyle}>
                  <span>Brand</span>
                  <input type="text" value={exportFilters.brand} onChange={(event) => updateExportFilter("brand", event.target.value)} placeholder="Example: Avyona" style={inputStyle} />
                </label>

                <label style={fieldStyle}>
                  <span>Status</span>
                  <select value={exportFilters.status} onChange={(event) => updateExportFilter("status", event.target.value)} style={inputStyle}>
                    <option value="">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </label>

                <label style={fieldStyle}>
                  <span>Stock Status</span>
                  <select value={exportFilters.stockStatus} onChange={(event) => updateExportFilter("stockStatus", event.target.value)} style={inputStyle}>
                    <option value="">All Stock Status</option>
                    <option value="in-stock">In Stock</option>
                    <option value="low-stock">Low Stock</option>
                    <option value="out-of-stock">Out of Stock</option>
                  </select>
                </label>

                <label style={fieldStyle}>
                  <span>Start Date</span>
                  <input type="date" value={exportFilters.startDate} onChange={(event) => updateExportFilter("startDate", event.target.value)} style={inputStyle} />
                </label>

                <label style={fieldStyle}>
                  <span>End Date</span>
                  <input type="date" value={exportFilters.endDate} onChange={(event) => updateExportFilter("endDate", event.target.value)} style={inputStyle} />
                </label>
              </div>

              <div style={exportActionRowStyle}>
                <button type="button" onClick={handleExportInventory} disabled={isExporting} style={downloadButtonStyle}>
                  <FaDownload aria-hidden="true" />
                  {isExporting ? "Queuing..." : "Generate Export"}
                </button>
                {exportMessage ? <span style={exportMessageStyle}>{exportMessage}</span> : null}
              </div>

              {exportJob ? (
                <div style={progressPanelStyle}>
                  <div style={progressBarTrackStyle}>
                    <div style={{ ...progressBarFillStyle, width: `${Math.min(100, Number(exportJob.percentageCompleted || 0))}%` }} />
                  </div>
                  <div className="inventory-manager-result-grid" style={resultGridStyle}>
                    {[
                      ["Status", exportJob.status],
                      ["Export type", exportJob.exportType],
                      ["Total rows", exportJob.totalRows],
                      ["Processed rows", exportJob.processedRows],
                      ["Completed", `${exportJob.percentageCompleted || 0}%`]
                    ].map(([label, value]) => (
                      <div key={label} style={resultCardStyle}>
                        <span>{label}</span>
                        <strong>{value || 0}</strong>
                      </div>
                    ))}
                  </div>
                  {exportJob.status === "completed" ? (
                    <button type="button" onClick={() => downloadExportJobFile(exportJob.jobId)} style={secondaryButtonStyle}>
                      <FaDownload aria-hidden="true" />
                      Download Export
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="inventory-manager-table-wrap" style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {["Export ID", "Type", "Rows", "Status", "Requested by", "Created", "Completed", "Action"].map((heading) => (
                        <th key={heading} style={thStyle}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {exportJobs.length ? exportJobs.map((item) => (
                      <tr key={item.jobId}>
                        <td style={tdStyle}>{item.jobId}</td>
                        <td style={tdStyle}>{item.exportType}</td>
                        <td style={tdStyle}>{item.totalRows || 0}</td>
                        <td style={tdStyle}>{item.status}</td>
                        <td style={tdStyle}>{item.requestedBy || "Unknown"}</td>
                        <td style={tdStyle}>{item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN") : ""}</td>
                        <td style={tdStyle}>{item.completedAt ? new Date(item.completedAt).toLocaleString("en-IN") : ""}</td>
                        <td style={tdStyle}>
                          {item.status === "completed" ? (
                            <button type="button" onClick={() => downloadExportJobFile(item.jobId)} style={miniButtonStyle}>Download</button>
                          ) : (
                            <button type="button" onClick={() => setExportJob(item)} style={miniButtonStyle}>View</button>
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td style={tdStyle} colSpan={8}>No export jobs yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <div style={placeholderStyle}>
            <strong>{`${activeTabConfig.title} workspace`}</strong>
            <p>
              This workspace is connected to backend validation, import progress, history, failed-row reporting,
              ASIN/SKU matching, and inventory export actions.
            </p>
          </div>
      </article>
    </section>
  );
}

const pageStyle = {
  display: "grid",
  gap: "20px"
};

const statusPillStyle = {
  alignSelf: "flex-start",
  padding: "8px 12px",
  borderRadius: "999px",
  background: "#ecfdf5",
  color: "#047857",
  fontSize: "13px",
  fontWeight: 800
};

const tabListStyle = {
  display: "grid",
  gap: "8px",
  padding: "12px",
  borderRadius: "14px",
  border: "1px solid #dbe7f0",
  background: "#fff",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.05)"
};

const tabButtonStyle = {
  minHeight: "44px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "0 12px",
  borderRadius: "10px",
  border: "1px solid transparent",
  background: "transparent",
  color: "#475569",
  fontWeight: 800,
  textAlign: "left",
  cursor: "pointer"
};

const activeTabButtonStyle = {
  borderColor: "#99f6e4",
  background: "#f0fdfa",
  color: "#0f766e"
};

const panelStyle = {
  display: "grid",
  gap: "18px",
  padding: "20px",
  borderRadius: "16px",
  border: "1px solid #dbe7f0",
  background: "#fff",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)"
};

const ruleBannerStyle = {
  display: "grid",
  gap: "6px",
  padding: "14px 16px",
  borderRadius: "12px",
  border: "1px solid #99f6e4",
  background: "#f0fdfa",
  color: "#115e59",
  fontSize: "13px",
  lineHeight: 1.5
};

const panelHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
  flexWrap: "wrap"
};

const panelTitleRowStyle = {
  display: "flex",
  gap: "12px",
  alignItems: "center"
};

const panelIconStyle = {
  width: "44px",
  height: "44px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "12px",
  background: "#0f766e",
  color: "#fff"
};

const eyebrowStyle = {
  margin: "0 0 4px",
  color: "#0f766e",
  fontSize: "12px",
  fontWeight: 900,
  textTransform: "uppercase"
};

const panelTitleStyle = {
  margin: 0,
  color: "#0f172a",
  fontSize: "22px"
};

const modulePillStyle = {
  padding: "7px 10px",
  borderRadius: "999px",
  background: "#f8fafc",
  border: "1px solid #dbe2ea",
  color: "#475569",
  fontSize: "12px",
  fontWeight: 800
};

const panelCopyStyle = {
  margin: 0,
  color: "#64748b",
  lineHeight: 1.6
};

const templateHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
  flexWrap: "wrap"
};

const templateTitleStyle = {
  margin: 0,
  color: "#0f172a",
  fontSize: "18px"
};

const templatePanelStyle = {
  display: "grid",
  gap: "14px",
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #dbe7f0",
  background: "#fbfdff"
};

const templateGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "12px"
};

const templateCardStyle = {
  display: "grid",
  gap: "14px",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  background: "#fff"
};

const templateCardHeaderStyle = {
  display: "flex",
  gap: "10px",
  alignItems: "flex-start"
};

const templateIconStyle = {
  width: "36px",
  height: "36px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  borderRadius: "10px",
  background: "#ecfdf5",
  color: "#047857"
};

const templateDescriptionStyle = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "13px",
  lineHeight: 1.45
};

const columnPreviewStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px"
};

const columnPillStyle = {
  padding: "5px 8px",
  borderRadius: "999px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: "11px",
  fontWeight: 800
};

const downloadButtonStyle = {
  minHeight: "38px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  padding: "0 12px",
  borderRadius: "10px",
  border: "1px solid #0f766e",
  background: "#0f766e",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer"
};

const secondaryButtonStyle = {
  ...downloadButtonStyle,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155"
};

const exportPanelStyle = {
  display: "grid",
  gap: "16px",
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #dbe7f0",
  background: "#fff"
};

const exportGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "12px"
};

const fieldStyle = {
  display: "grid",
  gap: "7px",
  gridTemplateRows: "20px 76px",
  color: "#334155",
  fontSize: "13px",
  fontWeight: 800
};

const inputStyle = {
  width: "100%",
  height: "76px",
  padding: "0 16px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
  boxSizing: "border-box",
  fontSize: "14px",
  fontWeight: 700
};

const hiddenFileInputStyle = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0
};

const dropzoneStyle = {
  height: "76px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "0 14px",
  borderRadius: "12px",
  border: "1px dashed #94a3b8",
  background: "#f8fafc",
  color: "#0f172a",
  cursor: "pointer",
  boxSizing: "border-box",
  transition: "border-color 160ms ease, background 160ms ease"
};

const dropzoneActiveStyle = {
  borderColor: "#0f766e",
  background: "#ecfdf5"
};

const dropzoneIconStyle = {
  color: "#0f766e",
  fontSize: "20px"
};

const dropzoneIconWrapStyle = {
  width: "38px",
  height: "38px",
  flex: "0 0 38px",
  display: "grid",
  placeItems: "center",
  borderRadius: "10px",
  background: "#ecfdf5"
};

const dropzoneTextStyle = {
  minWidth: 0,
  display: "grid",
  gap: "3px",
  lineHeight: 1.25
};

const exportActionRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap"
};

const toggleFieldStyle = {
  minHeight: "76px",
  display: "flex",
  alignItems: "center",
  gap: "9px",
  alignSelf: "end",
  padding: "0 16px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: "14px",
  fontWeight: 800
};

const controlPanelStyle = {
  display: "grid",
  gap: "14px",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  background: "#f8fafc"
};

const controlCopyStyle = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: "13px"
};

const controlGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "10px"
};

const checkboxCardStyle = {
  minHeight: "42px",
  display: "flex",
  alignItems: "center",
  gap: "9px",
  padding: "0 12px",
  borderRadius: "10px",
  border: "1px solid #dbe2ea",
  background: "#fff",
  color: "#334155",
  fontSize: "13px",
  fontWeight: 800
};

const exportMessageStyle = {
  color: "#475569",
  fontSize: "13px",
  fontWeight: 800
};

const progressPanelStyle = {
  display: "grid",
  gap: "12px",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #dbeafe",
  background: "#f8fbff"
};

const resultGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "12px"
};

const resultCardStyle = {
  display: "grid",
  gap: "8px",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#475569"
};

const failedRowsPanelStyle = {
  display: "grid",
  gap: "12px",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #fecaca",
  background: "#fff7f7"
};

const failedRowsListStyle = {
  display: "grid",
  gap: "8px"
};

const failedRowStyle = {
  display: "grid",
  gridTemplateColumns: "80px minmax(180px, 0.5fr) minmax(0, 1fr)",
  gap: "10px",
  alignItems: "center",
  padding: "10px",
  borderRadius: "10px",
  background: "#fff",
  color: "#7f1d1d",
  fontSize: "13px"
};

const progressBarTrackStyle = {
  width: "100%",
  height: "12px",
  borderRadius: "999px",
  overflow: "hidden",
  background: "#e2e8f0"
};

const progressBarFillStyle = {
  height: "100%",
  borderRadius: "999px",
  background: "#0f766e",
  transition: "width 180ms ease"
};

const tableWrapStyle = {
  width: "100%",
  overflowX: "auto",
  border: "1px solid #e2e8f0",
  borderRadius: "12px"
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "1100px"
};

const thStyle = {
  padding: "10px",
  background: "#f8fafc",
  color: "#334155",
  fontSize: "12px",
  textAlign: "left",
  borderBottom: "1px solid #e2e8f0"
};

const tdStyle = {
  padding: "10px",
  color: "#475569",
  fontSize: "12px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top"
};

const tableActionStyle = {
  display: "flex",
  gap: "6px",
  flexWrap: "wrap"
};

const miniButtonStyle = {
  minHeight: "28px",
  padding: "0 8px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  fontSize: "11px",
  fontWeight: 800,
  cursor: "pointer"
};

const actionGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "12px"
};

const actionCardStyle = {
  minHeight: "82px",
  display: "grid",
  alignContent: "center",
  gap: "10px",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#0f172a"
};

const placeholderStyle = {
  display: "grid",
  gap: "8px",
  padding: "16px",
  borderRadius: "12px",
  border: "1px dashed #cbd5e1",
  background: "#fbfdff",
  color: "#475569",
  lineHeight: 1.6
};
