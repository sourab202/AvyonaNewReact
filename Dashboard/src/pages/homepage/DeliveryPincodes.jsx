import React from "react";
import * as XLSX from "xlsx";
import {
  bulkUpdateDeliveryPincodes,
  createDeliveryPincode,
  deleteDeliveryPincode,
  fetchDeliveryPincodeMessageSettings,
  fetchDeliveryPincodes,
  importDeliveryPincodes,
  updateDeliveryPincode,
  updateDeliveryPincodeMessageSettings,
  updateDeliveryPincodeStatus
} from "../../api/adminApi";

const EMPTY_FORM = { state: "", pincode: "", codAvailable: true, status: "active" };
const DEFAULT_MESSAGE_TEMPLATES = {
  availableCod: "Delivery Available for {pincode} ({state}). Cash on Delivery Available. Estimated delivery: {delivery_time}.",
  availableNoCod: "Delivery Available for {pincode} ({state}). Cash on Delivery Not Available. Estimated delivery: {delivery_time}.",
  unavailable: "Delivery Unavailable for {pincode}."
};

function renderTemplate(template, values) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, value),
    template
  );
}

function getErrorMessage(error, fallback) {
  const responseMessage = error?.response?.data?.message;
  const howToFix = error?.response?.data?.details?.howToFix;
  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return howToFix ? `${responseMessage} How to fix: ${howToFix}` : responseMessage;
  }
  if (typeof error?.message === "string" && error.message.trim() && error.message !== "Network Error") return error.message;
  if (error?.message === "Network Error") return "The server could not be reached. Confirm the backend is running and try again.";
  return fallback;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function DeliveryPincodes() {
  const [rows, setRows] = React.useState([]);
  const [search, setSearch] = React.useState("");
  const [codFilter, setCodFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState([]);
  const [editor, setEditor] = React.useState(null);
  const [pendingDelete, setPendingDelete] = React.useState(null);
  const [message, setMessage] = React.useState("Loading delivery pincodes...");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [importFile, setImportFile] = React.useState(null);
  const [importMode, setImportMode] = React.useState("update");
  const [importFailures, setImportFailures] = React.useState([]);
  const [messageTemplates, setMessageTemplates] = React.useState(DEFAULT_MESSAGE_TEMPLATES);
  const [isSavingTemplates, setIsSavingTemplates] = React.useState(false);

  const loadRows = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchDeliveryPincodes({
        search: search.trim() || undefined,
        cod: codFilter || undefined,
        status: statusFilter || undefined
      });
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      setRows(data);
      setSelectedIds((current) => current.filter((id) => data.some((row) => row.id === id)));
      setMessage(data.length ? `${data.length} delivery pincode(s) found.` : "No delivery pincodes match these filters.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to load delivery pincodes.");
    } finally {
      setIsLoading(false);
    }
  }, [codFilter, search, statusFilter]);

  React.useEffect(() => {
    const timer = window.setTimeout(loadRows, 250);
    return () => window.clearTimeout(timer);
  }, [loadRows]);

  React.useEffect(() => {
    fetchDeliveryPincodeMessageSettings()
      .then((response) => {
        if (response.data?.data) setMessageTemplates(response.data.data);
      })
      .catch((error) => setMessage(getErrorMessage(error, "Unable to load delivery message templates.")));
  }, []);

  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  const openCreate = () => setEditor({ id: null, form: { ...EMPTY_FORM } });
  const openEdit = (row) => setEditor({
    id: row.id,
    form: {
      state: row.state,
      pincode: row.pincode,
      codAvailable: row.codAvailable,
      status: row.status
    }
  });

  const saveEditor = async (event) => {
    event.preventDefault();
    if (!editor) return;
    setIsSaving(true);
    try {
      if (editor.id) {
        await updateDeliveryPincode(editor.id, editor.form);
        setMessage("Delivery pincode updated. The storefront checker now uses the new values.");
      } else {
        await createDeliveryPincode(editor.form);
        setMessage("Delivery pincode added.");
      }
      setEditor(null);
      await loadRows();
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to save delivery pincode.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (row) => {
    const nextStatus = row.status === "active" ? "inactive" : "active";
    try {
      await updateDeliveryPincodeStatus(row.id, nextStatus);
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, status: nextStatus, updatedAt: new Date().toISOString() } : item));
      setMessage(`Pincode ${row.pincode} is now ${nextStatus}.`);
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to update status.");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsSaving(true);
    try {
      await deleteDeliveryPincode(pendingDelete.id);
      setPendingDelete(null);
      setMessage("Delivery pincode deleted.");
      await loadRows();
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to delete delivery pincode.");
    } finally {
      setIsSaving(false);
    }
  };

  const runBulkAction = async (action) => {
    if (!selectedIds.length) return;
    const destructive = action === "delete";
    if (destructive && !window.confirm("Are you sure you want to delete the selected pincodes?")) return;
    setIsSaving(true);
    try {
      await bulkUpdateDeliveryPincodes(selectedIds, action);
      setSelectedIds([]);
      setMessage("Bulk action completed.");
      await loadRows();
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to complete bulk action.");
    } finally {
      setIsSaving(false);
    }
  };

  const runImport = async (event) => {
    event.preventDefault();
    if (!importFile) {
      setMessage("Choose an XLSX, XLS, CSV, TSV, or TXT file first.");
      return;
    }
    if (importMode === "replace" && !window.confirm("Replace all existing delivery pincodes with this spreadsheet?")) return;
    setIsSaving(true);
    setImportFailures([]);
    try {
      const response = await importDeliveryPincodes(importFile, importMode);
      const result = response.data?.data || {};
      setImportFailures(Array.isArray(result.failedRowDetails) ? result.failedRowDetails : []);
      setMessage(`Import complete: ${result.inserted || 0} added, ${result.updated || 0} updated, ${result.skipped || 0} skipped, ${result.failedRows || 0} failed.`);
      setImportFile(null);
      event.currentTarget.reset();
      await loadRows();
    } catch (error) {
      setImportFailures(Array.isArray(error.response?.data?.details?.failedRows) ? error.response.data.details.failedRows : []);
      setMessage(`Import failed: ${getErrorMessage(error, "Unable to import delivery pincodes.")}`);
    } finally {
      setIsSaving(false);
    }
  };

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([
      {
        State: "Telangana",
        Pincode: "500084",
        "COD Available": "Yes",
        Status: "Active"
      }
    ]);
    worksheet["!cols"] = [
      { wch: 22 },
      { wch: 12 },
      { wch: 18 },
      { wch: 14 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Delivery Pincodes");
    XLSX.writeFile(workbook, "avyona-delivery-pincodes-template.xlsx");
    setMessage("Delivery pincode Excel template downloaded.");
  };

  const saveMessageTemplates = async () => {
    setIsSavingTemplates(true);
    try {
      const response = await updateDeliveryPincodeMessageSettings(messageTemplates);
      if (response.data?.data) setMessageTemplates(response.data.data);
      setMessage("Delivery message templates saved. Product pages now use the updated text.");
    } catch (error) {
      setMessage(getErrorMessage(error, "Unable to save delivery message templates."));
    } finally {
      setIsSavingTemplates(false);
    }
  };

  const previewValues = {
    pincode: "487661",
    state: "MADHYA PRADESH",
    delivery_time: "3 to 5 business days"
  };

  return (
    <div className="dashboard-admin-page dashboard-page-shell delivery-pincodes-page">
      <div className="dashboard-page-heading">
        <div>
          <p className="dashboard-eyebrow">Homepage Management</p>
          <h2>Delivery Pincodes</h2>
          <p className="dashboard-page-copy">Manage delivery availability and Cash on Delivery manually or through Excel.</p>
          <p className="dashboard-source-message">{message}</p>
        </div>
        <button className="dashboard-primary-button" type="button" onClick={openCreate}>Add Pincode</button>
      </div>

      <section className="delivery-pincode-import-card">
        <div>
          <h3>Bulk File Import</h3>
          <p>Supports XLSX, XLS, CSV, TSV, and delimited TXT. Columns: State, Pincode, COD Available, Status.</p>
        </div>
        <form className="delivery-pincode-import-form" onSubmit={runImport}>
          <select value={importMode} onChange={(event) => setImportMode(event.target.value)} aria-label="Import mode">
            <option value="update">Update existing pincode</option>
            <option value="skip">Skip duplicate</option>
            <option value="replace">Replace all existing data</option>
          </select>
          <input type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" onChange={(event) => setImportFile(event.target.files?.[0] || null)} />
          <button className="dashboard-secondary-button" type="button" onClick={downloadTemplate}>Download Template</button>
          <button className="dashboard-secondary-button" type="submit" disabled={isSaving}>Upload File</button>
        </form>
        {importFailures.length ? (
          <div style={{ gridColumn: "1 / -1", display: "grid", gap: "8px" }}>
            <strong>{`${importFailures.length} row(s) failed`}</strong>
            {importFailures.slice(0, 20).map((failure) => (
              <div key={`${failure.rowNumber}-${failure.pincode}`} style={{ padding: "10px", border: "1px solid #fecaca", borderRadius: "10px", background: "#fff7f7" }}>
                <strong>{`Row ${failure.rowNumber}${failure.pincode ? ` - ${failure.pincode}` : ""}`}</strong>
                <p style={{ margin: "4px 0", color: "#b91c1c" }}>{`Reason: ${failure.reason}`}</p>
                <p style={{ margin: 0, color: "#166534" }}>{`How to fix: ${failure.howToFix}`}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="delivery-message-settings-card">
        <div className="delivery-message-settings-head">
          <div>
            <h3>Delivery Message Templates</h3>
            <p>Manually control the messages shown after customers check a pincode.</p>
          </div>
          <div className="delivery-modal-actions">
            <button className="dashboard-secondary-button" type="button" onClick={() => setMessageTemplates(DEFAULT_MESSAGE_TEMPLATES)}>
              Reset Defaults
            </button>
            <button className="dashboard-primary-button" type="button" onClick={saveMessageTemplates} disabled={isSavingTemplates}>
              {isSavingTemplates ? "Saving..." : "Save Messages"}
            </button>
          </div>
        </div>

        <p className="delivery-template-placeholders">
          Available placeholders: <code>{"{pincode}"}</code> <code>{"{state}"}</code> <code>{"{delivery_time}"}</code>
        </p>

        <div className="delivery-message-editor-grid">
          <label>
            Delivery Available + COD Available
            <textarea
              rows="4"
              value={messageTemplates.availableCod}
              onChange={(event) => setMessageTemplates((current) => ({ ...current, availableCod: event.target.value }))}
            />
            <span className="delivery-template-preview">{renderTemplate(messageTemplates.availableCod, previewValues)}</span>
          </label>
          <label>
            Delivery Available + COD Not Available
            <textarea
              rows="4"
              value={messageTemplates.availableNoCod}
              onChange={(event) => setMessageTemplates((current) => ({ ...current, availableNoCod: event.target.value }))}
            />
            <span className="delivery-template-preview">{renderTemplate(messageTemplates.availableNoCod, previewValues)}</span>
          </label>
          <label>
            Delivery Unavailable
            <textarea
              rows="4"
              value={messageTemplates.unavailable}
              onChange={(event) => setMessageTemplates((current) => ({ ...current, unavailable: event.target.value }))}
            />
            <span className="delivery-template-preview">{renderTemplate(messageTemplates.unavailable, previewValues)}</span>
          </label>
        </div>
      </section>

      <section className="dashboard-filter-panel delivery-pincode-toolbar">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by pincode or state"
          aria-label="Search delivery pincodes"
        />
        <select value={codFilter} onChange={(event) => setCodFilter(event.target.value)}>
          <option value="">All COD</option>
          <option value="yes">COD Yes</option>
          <option value="no">COD No</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button className="dashboard-secondary-button" type="button" onClick={() => { setSearch(""); setCodFilter(""); setStatusFilter(""); }}>Clear</button>
      </section>

      <section className="delivery-pincode-bulk-bar">
        <strong>{selectedIds.length} selected</strong>
        <button type="button" onClick={() => runBulkAction("activate")} disabled={!selectedIds.length || isSaving}>Activate Selected</button>
        <button type="button" onClick={() => runBulkAction("deactivate")} disabled={!selectedIds.length || isSaving}>Deactivate Selected</button>
        <button type="button" onClick={() => runBulkAction("cod_yes")} disabled={!selectedIds.length || isSaving}>Change COD to Yes</button>
        <button type="button" onClick={() => runBulkAction("cod_no")} disabled={!selectedIds.length || isSaving}>Change COD to No</button>
        <button className="is-danger" type="button" onClick={() => runBulkAction("delete")} disabled={!selectedIds.length || isSaving}>Delete Selected</button>
      </section>

      <section className="dashboard-table-card delivery-pincode-table-wrap">
        <table className="dashboard-data-table">
          <thead>
            <tr>
              <th><input type="checkbox" checked={allSelected} onChange={(event) => setSelectedIds(event.target.checked ? rows.map((row) => row.id) : [])} aria-label="Select all pincodes" /></th>
              <th>State</th>
              <th>Pincode</th>
              <th>COD</th>
              <th>Status</th>
              <th>Created By</th>
              <th>Updated By</th>
              <th>Updated Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => setSelectedIds((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} aria-label={`Select ${row.pincode}`} /></td>
                <td>{row.state}</td>
                <td><strong>{row.pincode}</strong></td>
                <td><span className={`delivery-pill ${row.codAvailable ? "is-yes" : "is-no"}`}>{row.codAvailable ? "Yes" : "No"}</span></td>
                <td>
                  <button className={`delivery-status-toggle ${row.status === "active" ? "is-active" : ""}`} type="button" onClick={() => toggleStatus(row)}>
                    {row.status === "active" ? "Active" : "Inactive"}
                  </button>
                </td>
                <td>{row.createdBy}</td>
                <td>{row.updatedBy}</td>
                <td>{formatDate(row.updatedAt)}</td>
                <td>
                  <div className="dashboard-row-actions">
                    <button className="dashboard-secondary-button" type="button" onClick={() => openEdit(row)}>Edit</button>
                    <button className="dashboard-danger-button" type="button" onClick={() => setPendingDelete(row)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && !rows.length ? <tr><td colSpan="9" className="delivery-empty-cell">No delivery pincodes found.</td></tr> : null}
            {isLoading ? <tr><td colSpan="9" className="delivery-empty-cell">Loading delivery pincodes...</td></tr> : null}
          </tbody>
        </table>
      </section>

      {editor ? (
        <div className="delivery-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delivery-editor-title">
          <form className="delivery-modal" onSubmit={saveEditor}>
            <div className="delivery-modal-head">
              <h3 id="delivery-editor-title">{editor.id ? "Edit Pincode" : "Add Pincode"}</h3>
              <button type="button" onClick={() => setEditor(null)} aria-label="Close">x</button>
            </div>
            <label>State<input required value={editor.form.state} onChange={(event) => setEditor({ ...editor, form: { ...editor.form, state: event.target.value } })} /></label>
            <label>Pincode<input required inputMode="numeric" maxLength="6" pattern="\d{6}" value={editor.form.pincode} onChange={(event) => setEditor({ ...editor, form: { ...editor.form, pincode: event.target.value.replace(/\D/g, "") } })} /></label>
            <label>COD Available<select value={editor.form.codAvailable ? "yes" : "no"} onChange={(event) => setEditor({ ...editor, form: { ...editor.form, codAvailable: event.target.value === "yes" } })}><option value="yes">Yes</option><option value="no">No</option></select></label>
            <label>Status<select value={editor.form.status} onChange={(event) => setEditor({ ...editor, form: { ...editor.form, status: event.target.value } })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            <div className="delivery-modal-actions">
              <button className="dashboard-secondary-button" type="button" onClick={() => setEditor(null)}>Cancel</button>
              <button className="dashboard-primary-button" type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</button>
            </div>
          </form>
        </div>
      ) : null}

      {pendingDelete ? (
        <div className="delivery-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delivery-delete-title">
          <section className="delivery-modal delivery-confirm-modal">
            <h3 id="delivery-delete-title">Are you sure you want to delete this pincode?</h3>
            <p>{pendingDelete.state} - {pendingDelete.pincode}</p>
            <div className="delivery-modal-actions">
              <button className="dashboard-secondary-button" type="button" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className="dashboard-danger-button" type="button" onClick={confirmDelete} disabled={isSaving}>{isSaving ? "Deleting..." : "Delete"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
