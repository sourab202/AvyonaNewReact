import React from "react";
import { useNavigate } from "react-router-dom";
import { FaGripVertical } from "react-icons/fa";
import { deleteCategory, fetchCategories, updateCategory } from "../../api/adminApi";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { canAccess } from "../../utils/accessControl";
import { resolveAdminMediaUrl } from "../../utils/media";

function getPreviewUrl(url) {
  return resolveAdminMediaUrl(url);
}

function normalizeRow(category) {
  return {
    raw: category,
    id: category.id,
    image: category.imageUrl || category.categoryImage || "",
    categoryName: category.name || category.categoryName || "",
    parentCategory: category.parentCategory || "None",
    slug: category.slug || "",
    status: category.status === "active" ? "Active" : "Inactive",
    showInMenu: category.showInMenu ? "Yes" : "No",
    featured: category.featuredCategory ? "Yes" : "No",
    sortOrder: Number(category.sortOrder || 0)
  };
}

function buildCategoryPayload(category, status) {
  return {
    name: category.name || category.categoryName || "",
    slug: category.slug || "",
    parentId: category.parentId || null,
    imageUrl: category.imageUrl || category.categoryImage || "",
    bannerImageUrl: category.bannerImageUrl || "",
    description: category.description || "",
    status,
    showInMenu: Boolean(category.showInMenu),
    featuredCategory: Boolean(category.featuredCategory),
    dynamicRuleJson: category.dynamicRuleJson || {},
    sortOrder: Number(category.sortOrder || 0),
    metaTitle: category.metaTitle || "",
    metaDescription: category.metaDescription || "",
    keywords: category.keywords || ""
  };
}

export default function Categories() {
  const navigate = useNavigate();
  const [categoryRows, setCategoryRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [updatingCategoryId, setUpdatingCategoryId] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState(50);
  const [selectedCategoryIds, setSelectedCategoryIds] = React.useState([]);
  const [bulkCategoryAction, setBulkCategoryAction] = React.useState("");
  const [runningBulkAction, setRunningBulkAction] = React.useState(false);
  const [draggedCategoryId, setDraggedCategoryId] = React.useState("");
  const canCreateCategories = canAccess("categories", "create");
  const canEditCategories = canAccess("categories", "edit");
  const canDeleteCategories = canAccess("categories", "delete");

  const totalPages = Math.max(1, Math.ceil(categoryRows.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = categoryRows.length ? (safeCurrentPage - 1) * rowsPerPage : 0;
  const paginatedCategoryRows = categoryRows.slice(pageStart, pageStart + rowsPerPage);
  const pageEnd = categoryRows.length ? pageStart + paginatedCategoryRows.length : 0;
  const visibleCategoryIds = React.useMemo(() => paginatedCategoryRows.map((row) => String(row.id)), [paginatedCategoryRows]);
  const selectedVisibleCount = visibleCategoryIds.filter((id) => selectedCategoryIds.includes(id)).length;
  const isCurrentPageSelected = visibleCategoryIds.length > 0 && selectedVisibleCount === visibleCategoryIds.length;

  const loadCategories = React.useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetchCategories();
      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      setCategoryRows(rows.map(normalizeRow));
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to load categories from backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useAutoRefresh(loadCategories);

  const handleToggleStatus = async (row) => {
    const nextStatus = row.status === "Active" ? "inactive" : "active";
    setUpdatingCategoryId(row.id);
    setMessage("");

    try {
      const response = await updateCategory(row.id, buildCategoryPayload(row.raw, nextStatus));
      const updatedCategory = response.data?.data || { ...row.raw, status: nextStatus };
      setCategoryRows((current) =>
        current.map((category) =>
          category.id === row.id ? normalizeRow(updatedCategory) : category
        )
      );
      setMessage(`Category marked ${nextStatus === "active" ? "active" : "inactive"}. Storefront category sections will auto-refresh.`);
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to update category status.");
    } finally {
      setUpdatingCategoryId("");
    }
  };

  const handleDelete = async (row) => {
    const confirmed = window.confirm(`Delete category "${row.categoryName}"?`);
    if (!confirmed) return;

    try {
      await deleteCategory(row.id);
      setCategoryRows((current) => current.filter((category) => category.id !== row.id));
      setSelectedCategoryIds((current) => current.filter((id) => String(id) !== String(row.id)));
      setMessage("Category deleted successfully.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to delete category.");
    }
  };

  const toggleSelectedCategory = (categoryId) => {
    const id = String(categoryId);
    setSelectedCategoryIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleCurrentPageSelection = () => {
    setSelectedCategoryIds((current) => {
      if (isCurrentPageSelected) return current.filter((id) => !visibleCategoryIds.includes(id));
      return Array.from(new Set([...current, ...visibleCategoryIds]));
    });
  };

  const handleBulkCategoryStatus = async (status) => {
    if (!selectedCategoryIds.length) return;
    setMessage("");
    try {
      const selectedRows = categoryRows.filter((row) => selectedCategoryIds.includes(String(row.id)));
      const updates = await Promise.all(selectedRows.map((row) => updateCategory(row.id, buildCategoryPayload(row.raw, status))));
      const updatedById = new Map(updates.map((response, index) => [
        String(selectedRows[index].id),
        normalizeRow(response.data?.data || { ...selectedRows[index].raw, status })
      ]));
      setCategoryRows((current) => current.map((row) => updatedById.get(String(row.id)) || row));
      setSelectedCategoryIds([]);
      setMessage(`${selectedRows.length} category(s) updated.`);
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to update selected categories.");
      await loadCategories();
    }
  };

  const handleBulkCategoryDelete = async () => {
    if (!selectedCategoryIds.length) return;
    const confirmed = window.confirm(`Delete ${selectedCategoryIds.length} selected category(s)?`);
    if (!confirmed) return;
    try {
      await Promise.all(selectedCategoryIds.map((categoryId) => deleteCategory(categoryId)));
      setCategoryRows((current) => current.filter((row) => !selectedCategoryIds.includes(String(row.id))));
      setSelectedCategoryIds([]);
      setMessage("Selected categories deleted successfully.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to delete selected categories.");
      await loadCategories();
    }
  };

  const handleApplyBulkCategoryAction = async () => {
    if (!bulkCategoryAction || !selectedCategoryIds.length || runningBulkAction) return;

    setRunningBulkAction(true);
    try {
      if (bulkCategoryAction === "active") {
        await handleBulkCategoryStatus("active");
      } else if (bulkCategoryAction === "inactive") {
        await handleBulkCategoryStatus("inactive");
      } else if (bulkCategoryAction === "show-menu") {
        await handleBulkCategoryDisplay("showInMenu", true);
      } else if (bulkCategoryAction === "hide-menu") {
        await handleBulkCategoryDisplay("showInMenu", false);
      } else if (bulkCategoryAction === "featured") {
        await handleBulkCategoryDisplay("featuredCategory", true);
      } else if (bulkCategoryAction === "unfeatured") {
        await handleBulkCategoryDisplay("featuredCategory", false);
      } else if (bulkCategoryAction === "delete") {
        await handleBulkCategoryDelete();
      }
      setBulkCategoryAction("");
    } finally {
      setRunningBulkAction(false);
    }
  };

  const handleBulkCategoryDisplay = async (field, value) => {
    if (!selectedCategoryIds.length) return;
    setMessage("");
    try {
      const selectedRows = categoryRows.filter((row) => selectedCategoryIds.includes(String(row.id)));
      const updates = await Promise.all(
        selectedRows.map((row) => updateCategory(row.id, {
          ...buildCategoryPayload(row.raw, row.raw.status || row.status.toLowerCase()),
          [field]: value
        }))
      );
      const updatedById = new Map(updates.map((response, index) => [
        String(selectedRows[index].id),
        normalizeRow(response.data?.data || { ...selectedRows[index].raw, [field]: value })
      ]));
      setCategoryRows((current) => current.map((row) => updatedById.get(String(row.id)) || row));
      setSelectedCategoryIds([]);
      setMessage(`${selectedRows.length} category display setting(s) updated.`);
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to update selected category display settings.");
      await loadCategories();
    }
  };

  const persistCategoryOrder = async (orderedRows) => {
    const sequencedRows = orderedRows.map((row, index) => ({
      ...row,
      sortOrder: pageStart + index + 1,
      raw: { ...row.raw, sortOrder: pageStart + index + 1 }
    }));

    setCategoryRows((current) => {
      const byId = new Map(sequencedRows.map((row) => [String(row.id), row]));
      return current
        .map((row) => byId.get(String(row.id)) || row)
        .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0) || String(left.categoryName).localeCompare(String(right.categoryName)));
    });

    try {
      await Promise.all(sequencedRows.map((row) => updateCategory(row.id, buildCategoryPayload(row.raw, row.raw.status || row.status.toLowerCase()))));
      setMessage("Category sort order saved.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to save category sort order.");
      await loadCategories();
    }
  };

  const handleCategoryDrop = async (targetCategoryId) => {
    if (!draggedCategoryId || String(draggedCategoryId) === String(targetCategoryId)) return;
    const orderedRows = [...paginatedCategoryRows];
    const fromIndex = orderedRows.findIndex((row) => String(row.id) === String(draggedCategoryId));
    const toIndex = orderedRows.findIndex((row) => String(row.id) === String(targetCategoryId));
    if (fromIndex < 0 || toIndex < 0) return;

    const [movedRow] = orderedRows.splice(fromIndex, 1);
    orderedRows.splice(toIndex, 0, movedRow);
    setDraggedCategoryId("");
    await persistCategoryOrder(orderedRows);
  };

  const handleCategorySortOrderChange = async (row, value) => {
    const nextSortOrder = Math.max(0, Math.round(Number(value || 0)));
    if (nextSortOrder === Number(row.sortOrder || 0)) return;
    setUpdatingCategoryId(row.id);
    setMessage("");
    try {
      const response = await updateCategory(row.id, {
        ...buildCategoryPayload(row.raw, row.raw.status || row.status.toLowerCase()),
        sortOrder: nextSortOrder
      });
      const updatedRow = normalizeRow(response.data?.data || { ...row.raw, sortOrder: nextSortOrder });
      setCategoryRows((current) =>
        current
          .map((category) => category.id === row.id ? updatedRow : category)
          .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0) || String(left.categoryName).localeCompare(String(right.categoryName)))
      );
      setMessage("Category sort order saved.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to save category sort order.");
    } finally {
      setUpdatingCategoryId("");
    }
  };

  return (
    <div style={pageStyle}>
      <section style={headerStyle}>
        <div>
          <span style={eyebrowStyle}>Dashboard Module</span>
          <h2 style={titleStyle}>Categories</h2>
          <p style={copyStyle}>Manage website categories with image upload, hierarchy, storefront visibility, featured placement, and SEO control.</p>
        </div>

        <div style={headerActionsStyle}>
          <button type="button" style={secondaryButtonStyle} onClick={loadCategories}>Refresh</button>
          {canCreateCategories ? (
            <button type="button" style={addButtonStyle} onClick={() => navigate("/dashboard/categories/new")}>Add Category</button>
          ) : null}
        </div>
      </section>

      {message ? <section style={feedbackStyle}>{message}</section> : null}

      <section style={tableCardStyle}>
        <div style={displaySettingsIntroStyle}>
          <div>
            <span style={eyebrowStyle}>Display Settings</span>
            <h3 style={displayTitleStyle}>Menu, Featured Placement & Sort Priority</h3>
            <p style={displayCopyStyle}>Categories listed here are loaded from backend. Active and featured categories appear on the frontend website according to display settings.</p>
          </div>
          <div style={bulkPanelStyle}>
            <span style={summaryPillStyle}>{`Total: ${categoryRows.length}`}</span>
            <span style={summaryPillStyle}>{`Showing: ${categoryRows.length ? `${pageStart + 1}-${pageEnd}` : "0"}`}</span>
            <span style={summaryPillStyle}>{`Selected: ${selectedCategoryIds.length}`}</span>
            <select value={rowsPerPage} onChange={(event) => { setRowsPerPage(Number(event.target.value)); setCurrentPage(1); }} style={filterInputStyle}>
              {[10, 20, 50, 100].map((count) => <option key={count} value={count}>{`${count} / page`}</option>)}
            </select>
          </div>
        </div>

        <div style={bulkActionBarStyle}>
          <strong>{`${selectedCategoryIds.length} category(s) selected`}</strong>
          <select
            value={bulkCategoryAction}
            onChange={(event) => setBulkCategoryAction(event.target.value)}
            style={bulkSelectStyle}
            disabled={!selectedCategoryIds.length || runningBulkAction}
            aria-label="Bulk category action"
          >
            <option value="">Select bulk action</option>
            {canEditCategories ? <option value="active">Mark selected active</option> : null}
            {canEditCategories ? <option value="inactive">Mark selected inactive</option> : null}
            {canEditCategories ? <option value="show-menu">Show selected in menu</option> : null}
            {canEditCategories ? <option value="hide-menu">Hide selected from menu</option> : null}
            {canEditCategories ? <option value="featured">Mark selected featured</option> : null}
            {canEditCategories ? <option value="unfeatured">Remove selected featured</option> : null}
            {canDeleteCategories ? <option value="delete">Delete selected</option> : null}
          </select>
          <button
            type="button"
            style={{
              ...addButtonStyle,
              ...(!selectedCategoryIds.length || !bulkCategoryAction || runningBulkAction ? disabledButtonStyle : null)
            }}
            disabled={!selectedCategoryIds.length || !bulkCategoryAction || runningBulkAction}
            onClick={handleApplyBulkCategoryAction}
          >
            {runningBulkAction ? "Applying..." : "Apply"}
          </button>
          {selectedCategoryIds.length ? (
            <button type="button" style={secondaryButtonStyle} onClick={() => setSelectedCategoryIds([])} disabled={runningBulkAction}>Clear</button>
          ) : null}
        </div>

        {message ? <div style={inlineFeedbackStyle}>{message}</div> : null}

        <div className="dashboard-table-card dashboard-inline-table-card">
          <table className="dashboard-data-table dashboard-categories-admin-table" style={tableStyle}>
            <thead>
              <tr>
                <th style={tableHeaderStyle} aria-label="Drag handle"></th>
                <th style={tableHeaderStyle}>
                  <input type="checkbox" checked={isCurrentPageSelected} onChange={toggleCurrentPageSelection} aria-label="Select all categories on this page" />
                </th>
                {["Image", "Category Name", "Parent Category", "Slug", "Status", "Show in Menu", "Featured", "Sort Order", "Actions"].map((heading) => (
                  <th key={heading} style={tableHeaderStyle}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedCategoryRows.map((row) => (
                <tr
                  key={row.id}
                  draggable={canEditCategories}
                  onDragStart={() => setDraggedCategoryId(String(row.id))}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleCategoryDrop(row.id)}
                  className={String(draggedCategoryId) === String(row.id) ? "dashboard-row-dragging" : ""}
                >
                  <td style={tableCellStyle}>
                    <button type="button" className="dashboard-drag-handle" title="Drag to reorder" disabled={!canEditCategories}>
                      <FaGripVertical aria-hidden="true" />
                    </button>
                  </td>
                  <td style={tableCellStyle}>
                    <input type="checkbox" checked={selectedCategoryIds.includes(String(row.id))} onChange={() => toggleSelectedCategory(row.id)} aria-label={`Select ${row.categoryName}`} />
                  </td>
                  <td style={tableCellStyle}>
                    <div style={imageCellStyle}>
                      {getPreviewUrl(row.image) ? <img src={getPreviewUrl(row.image)} alt={row.categoryName} style={imageStyle} /> : null}
                    </div>
                  </td>
                  <td style={tableCellStyle}>
                    <div style={{ display: "grid", gap: "4px" }}>
                      <strong style={{ color: "#0f172a" }}>{row.categoryName}</strong>
                      <span style={{ color: "#64748b", fontSize: "12px" }}>{`ID ${row.id}`}</span>
                    </div>
                  </td>
                  <td style={tableCellStyle}>{row.parentCategory}</td>
                  <td style={tableCellStyle}>{row.slug}</td>
                  <td style={tableCellStyle}><span style={{ ...badgeStyle, ...(row.status === "Active" ? activeBadgeStyle : inactiveBadgeStyle) }}>{row.status}</span></td>
                  <td style={tableCellStyle}><span style={{ ...badgeStyle, ...(row.showInMenu === "Yes" ? menuBadgeStyle : neutralBadgeStyle) }}>{row.showInMenu}</span></td>
                  <td style={tableCellStyle}><span style={{ ...badgeStyle, ...(row.featured === "Yes" ? featuredBadgeStyle : neutralBadgeStyle) }}>{row.featured}</span></td>
                  <td style={tableCellStyle}>
                    <input
                      type="number"
                      min="0"
                      defaultValue={row.sortOrder}
                      className="dashboard-sort-input"
                      disabled={!canEditCategories || updatingCategoryId === row.id}
                      onBlur={(event) => handleCategorySortOrderChange(row, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                      aria-label={`Sort order for ${row.categoryName}`}
                    />
                  </td>
                  <td style={tableCellStyle}>
                    <div style={actionsStyle}>
                      {canEditCategories ? (
                        <>
                          <button
                            type="button"
                            style={row.status === "Active" ? inactiveButtonStyle : activeButtonStyle}
                            disabled={updatingCategoryId === row.id}
                            onClick={() => handleToggleStatus(row)}
                          >
                            {updatingCategoryId === row.id ? "Saving..." : row.status === "Active" ? "Inactive" : "Active"}
                          </button>
                          <button type="button" style={editButtonStyle} onClick={() => navigate(`/dashboard/categories/${row.id}/edit`)}>Edit</button>
                        </>
                      ) : null}
                      {canDeleteCategories ? (
                        <button type="button" style={deleteButtonStyle} onClick={() => handleDelete(row)}>Delete</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}

              {!paginatedCategoryRows.length ? (
                <tr>
                  <td colSpan="11" style={{ ...tableCellStyle, textAlign: "center", color: "#64748b", padding: "30px" }}>
                    {loading ? "Loading categories..." : "No categories found. Add a category to publish it to the website."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={paginationBarStyle}>
          <strong>{`Page ${safeCurrentPage} of ${totalPages}`}</strong>
          <div style={headerActionsStyle}>
            <button type="button" style={secondaryButtonStyle} disabled={safeCurrentPage === 1} onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}>Previous</button>
            <button type="button" style={secondaryButtonStyle} disabled={safeCurrentPage === totalPages} onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}>Next</button>
          </div>
        </div>
      </section>
    </div>
  );
}

const pageStyle = { display: "grid", gap: "16px", width: "100%" };

const headerStyle = {
  background: "linear-gradient(135deg, #ffffff 0%, #f4fbf6 55%, #edf7ff 100%)",
  borderRadius: "16px",
  border: "1px solid rgba(203, 213, 225, 0.7)",
  boxShadow: "0 10px 26px rgba(174, 203, 190, 0.14)",
  padding: "22px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap"
};

const titleStyle = { margin: "8px 0 0", fontSize: "38px", color: "#0f172a" };
const copyStyle = { margin: "10px 0 0", color: "#526377", maxWidth: "760px" };
const headerActionsStyle = { display: "flex", gap: "10px", flexWrap: "nowrap" };

const tableCardStyle = {
  background: "#ffffff",
  borderRadius: "14px",
  border: "1px solid rgba(203, 213, 225, 0.75)",
  boxShadow: "0 8px 22px rgba(174, 203, 190, 0.08)",
  padding: "16px",
  overflow: "hidden"
};

const displaySettingsIntroStyle = {
  display: "grid",
  gap: "8px",
  marginBottom: "14px",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #e5edf5",
  background: "#f8fafc"
};

const displayTitleStyle = { margin: "6px 0 0", color: "#0f172a", fontSize: "20px" };
const displayCopyStyle = { margin: "8px 0 0", color: "#64748b", lineHeight: 1.55 };

const tableStyle = { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" };
const tableHeaderStyle = { textAlign: "left", padding: "14px 12px", fontSize: "13px", color: "#334155", borderBottom: "1px solid #e5edf5" };
const tableCellStyle = { padding: "14px 12px", color: "#0f172a", borderBottom: "1px solid #eef2f7", verticalAlign: "middle" };

const imageCellStyle = { width: "64px", height: "64px", borderRadius: "12px", overflow: "hidden", background: "#f8fafc", border: "1px solid #e5edf5" };
const imageStyle = { width: "100%", height: "100%", objectFit: "cover", display: "block" };
const actionsStyle = { display: "flex", gap: "8px", flexWrap: "wrap" };

const bulkPanelStyle = { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" };
const bulkActionBarStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  marginBottom: "14px",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #dbe6ef",
  background: "#ffffff"
};
const paginationBarStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginTop: "14px", padding: "12px 4px 0" };
const filterInputStyle = { minHeight: "36px", padding: "0 12px", borderRadius: "10px", border: "1px solid #d4dbe6", background: "#fff", color: "#0f172a", fontWeight: 700 };
const bulkSelectStyle = { ...filterInputStyle, minWidth: "220px", flex: "0 1 260px" };
const summaryPillStyle = { display: "inline-flex", alignItems: "center", minHeight: "34px", padding: "0 12px", borderRadius: "999px", background: "#ffffff", border: "1px solid #edf2f7", color: "#475569", fontWeight: 700, fontSize: "12px" };
const inlineFeedbackStyle = { ...summaryPillStyle, width: "fit-content", margin: "0 0 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534" };

const badgeStyle = { display: "inline-flex", alignItems: "center", minHeight: "28px", padding: "0 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 };
const activeBadgeStyle = { background: "#dcfce7", color: "#166534" };
const inactiveBadgeStyle = { background: "#e5e7eb", color: "#374151" };
const featuredBadgeStyle = { background: "#dbeafe", color: "#1d4ed8" };
const menuBadgeStyle = { background: "#ccfbf1", color: "#0f766e" };
const neutralBadgeStyle = { background: "#f1f5f9", color: "#475569" };

const addButtonStyle = { minHeight: "42px", padding: "0 16px", borderRadius: "9px", border: "1px solid rgba(15, 23, 42, 0.1)", background: "#16a34a", color: "#ffffff", fontWeight: 800, cursor: "pointer" };
const disabledButtonStyle = { opacity: 0.5, cursor: "not-allowed" };
const secondaryButtonStyle = { minHeight: "42px", padding: "0 16px", borderRadius: "9px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", fontWeight: 800, cursor: "pointer" };
const editButtonStyle = { minHeight: "34px", padding: "0 12px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", fontWeight: 800, cursor: "pointer" };
const activeButtonStyle = { minHeight: "34px", padding: "0 12px", borderRadius: "8px", border: "1px solid #bbf7d0", background: "#dcfce7", color: "#166534", fontWeight: 800, cursor: "pointer" };
const inactiveButtonStyle = { minHeight: "34px", padding: "0 12px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#f3f4f6", color: "#374151", fontWeight: 800, cursor: "pointer" };
const deleteButtonStyle = { minHeight: "34px", padding: "0 12px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", fontWeight: 800, cursor: "pointer" };
const feedbackStyle = { borderRadius: "12px", padding: "12px 14px", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", fontWeight: 800 };
const eyebrowStyle = { color: "#0f766e", fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" };
