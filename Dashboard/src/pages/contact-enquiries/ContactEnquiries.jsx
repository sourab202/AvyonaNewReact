import React from "react";
import {
  deleteContactEnquiry,
  fetchContactEnquiries,
  fetchContactEnquiry,
  updateContactEnquiryStatus
} from "../../api/adminApi";
import { canAccess } from "../../utils/accessControl";

const STATUS_OPTIONS = ["New", "In Progress", "Resolved", "Closed"];
const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "b2c", label: "Customer Support" },
  { key: "b2b", label: "Business Enquiry" },
  { key: "new", label: "New" },
  { key: "resolved", label: "Resolved" }
];

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getStatusStyle(status) {
  if (status === "New") return { background: "#dbeafe", color: "#1d4ed8" };
  if (status === "In Progress") return { background: "#fef3c7", color: "#a16207" };
  if (status === "Resolved") return { background: "#dcfce7", color: "#15803d" };
  if (status === "Closed") return { background: "#e5e7eb", color: "#475569" };
  return { background: "#f8fafc", color: "#475569" };
}

export default function ContactEnquiries() {
  const [enquiries, setEnquiries] = React.useState([]);
  const [selectedEnquiry, setSelectedEnquiry] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [message, setMessage] = React.useState("Loading contact enquiries...");
  const [updatingId, setUpdatingId] = React.useState("");
  const [deletingId, setDeletingId] = React.useState("");
  const [pendingDelete, setPendingDelete] = React.useState(null);
  const [activeFilter, setActiveFilter] = React.useState("all");
  const canEdit = canAccess("contact_enquiries", "edit");
  const canDelete = canAccess("contact_enquiries", "delete");

  const filteredEnquiries = React.useMemo(() => {
    if (activeFilter === "b2c") return enquiries.filter((enquiry) => enquiry.enquiryType === "B2C");
    if (activeFilter === "b2b") return enquiries.filter((enquiry) => enquiry.enquiryType === "B2B");
    if (activeFilter === "new") return enquiries.filter((enquiry) => enquiry.status === "New");
    if (activeFilter === "resolved") return enquiries.filter((enquiry) => enquiry.status === "Resolved");
    return enquiries;
  }, [activeFilter, enquiries]);

  const loadEnquiries = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchContactEnquiries();
      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      setEnquiries(rows);
      setMessage(rows.length ? "Contact enquiries loaded from backend." : "No contact enquiries have been submitted yet.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to load contact enquiries.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadEnquiries();
  }, [loadEnquiries]);

  const handleView = async (enquiry) => {
    setSelectedEnquiry(enquiry);
    try {
      const response = await fetchContactEnquiry(enquiry.id);
      if (response.data?.data) setSelectedEnquiry(response.data.data);
    } catch {
      setSelectedEnquiry(enquiry);
    }
  };

  const handleStatusChange = async (enquiryId, status) => {
    setUpdatingId(enquiryId);
    try {
      const response = await updateContactEnquiryStatus(enquiryId, status);
      const updated = response.data?.data;
      if (updated) {
        setEnquiries((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setSelectedEnquiry((current) => (current?.id === updated.id ? updated : current));
      }
      setMessage("Contact enquiry status updated.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to update contact enquiry status.");
    } finally {
      setUpdatingId("");
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const enquiryId = pendingDelete.id;
    setDeletingId(enquiryId);
    try {
      await deleteContactEnquiry(enquiryId);
      setEnquiries((current) => current.filter((item) => item.id !== enquiryId));
      setSelectedEnquiry((current) => (current?.id === enquiryId ? null : current));
      setPendingDelete(null);
      setMessage("Contact enquiry deleted.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to delete contact enquiry.");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="dashboard-admin-page dashboard-page-shell">
      <div className="dashboard-page-heading">
        <div>
          <h2 style={{ margin: 0 }}>Contact Enquiries</h2>
          <p className="dashboard-page-copy">
            View B2C customer support requests and B2B business enquiries submitted from the website.
          </p>
          <p className="dashboard-source-message">{message}</p>
        </div>
        <div className="dashboard-chip-row-tight">
          <span className="dashboard-badge">{`${filteredEnquiries.length} of ${enquiries.length} Enquiries`}</span>
          <button className="dashboard-secondary-button" type="button" onClick={loadEnquiries} disabled={isLoading}>
            Refresh
          </button>
        </div>
      </div>

      <section className="dashboard-filter-panel" aria-label="Contact enquiry filters">
        <div className="dashboard-chip-row-tight">
          {FILTER_OPTIONS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={activeFilter === filter.key ? "dashboard-primary-button" : "dashboard-secondary-button"}
              onClick={() => setActiveFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <section className="dashboard-table-card">
        <table className="dashboard-data-table dashboard-contact-enquiries-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEnquiries.map((enquiry) => (
              <tr key={enquiry.id}>
                <td>
                  <strong>{enquiry.name}</strong>
                  {enquiry.companyName ? <span className="dashboard-muted-cell">{enquiry.companyName}</span> : null}
                </td>
                <td>{enquiry.enquiryType}</td>
                <td>{enquiry.email}</td>
                <td>{enquiry.phone}</td>
                <td>
                  <span style={{ ...statusPillStyle, ...getStatusStyle(enquiry.status) }}>{enquiry.status}</span>
                </td>
                <td>{formatDate(enquiry.createdAt)}</td>
                <td>
                  <div className="dashboard-row-actions">
                    <button className="dashboard-icon-action dashboard-primary-button" type="button" onClick={() => handleView(enquiry)}>
                      View
                    </button>
                    <select
                      aria-label={`Update status for ${enquiry.name}`}
                      value={enquiry.status}
                      disabled={!canEdit || updatingId === enquiry.id}
                      onChange={(event) => handleStatusChange(enquiry.id, event.target.value)}
                      style={statusSelectStyle}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    <button
                      className="dashboard-icon-action dashboard-danger-button"
                      type="button"
                      disabled={!canDelete || deletingId === enquiry.id}
                      onClick={() => setPendingDelete(enquiry)}
                    >
                      {deletingId === enquiry.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && !filteredEnquiries.length ? (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", color: "#64748b", padding: "28px 16px" }}>
                  No contact enquiries found for this filter.
                </td>
              </tr>
            ) : null}
            {isLoading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", color: "#64748b", padding: "28px 16px" }}>
                  Loading contact enquiries...
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {selectedEnquiry ? (
        <div style={modalOverlayStyle} role="dialog" aria-modal="true" aria-labelledby="contact-enquiry-title">
          <section style={modalPanelStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <p className="dashboard-eyebrow" style={{ color: "#16a34a", marginBottom: "0.35rem" }}>
                  {selectedEnquiry.enquiryType}
                </p>
                <h3 id="contact-enquiry-title" style={{ margin: 0 }}>{selectedEnquiry.name}</h3>
              </div>
              <button className="dashboard-secondary-button" type="button" onClick={() => setSelectedEnquiry(null)}>
                Close
              </button>
            </div>

            <div style={detailGridStyle}>
              <Detail label="Email" value={selectedEnquiry.email} />
              <Detail label="Phone" value={selectedEnquiry.phone} />
              <Detail label="Company" value={selectedEnquiry.companyName || "-"} />
              <Detail label="Order ID" value={selectedEnquiry.orderId || "-"} />
              <Detail label="Status" value={selectedEnquiry.status} />
              <Detail label="Date" value={formatDate(selectedEnquiry.createdAt)} />
            </div>

            <div style={messageBoxStyle}>
              <span style={detailLabelStyle}>Message</span>
              <p style={{ margin: "0.45rem 0 0", color: "#0f172a", whiteSpace: "pre-wrap" }}>{selectedEnquiry.message}</p>
            </div>
          </section>
        </div>
      ) : null}

      {pendingDelete ? (
        <div style={modalOverlayStyle} role="dialog" aria-modal="true" aria-labelledby="delete-contact-enquiry-title">
          <section style={confirmPanelStyle}>
            <h3 id="delete-contact-enquiry-title" style={{ margin: 0 }}>Delete contact enquiry?</h3>
            <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.55 }}>
              This will hide the enquiry from the dashboard list while keeping it in the database for audit history.
            </p>
            <div style={confirmMetaStyle}>
              <strong>{pendingDelete.name}</strong>
              <span>{pendingDelete.email}</span>
            </div>
            <div style={confirmActionRowStyle}>
              <button className="dashboard-secondary-button" type="button" onClick={() => setPendingDelete(null)} disabled={Boolean(deletingId)}>
                Cancel
              </button>
              <button className="dashboard-danger-button" type="button" onClick={handleDelete} disabled={Boolean(deletingId)}>
                {deletingId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div style={detailCardStyle}>
      <span style={detailLabelStyle}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const statusPillStyle = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "28px",
  padding: "0 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 800,
  whiteSpace: "nowrap"
};

const statusSelectStyle = {
  minHeight: "32px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  background: "#fff",
  color: "#0f172a",
  fontSize: "12px",
  fontWeight: 800,
  padding: "0 8px"
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  display: "grid",
  placeItems: "center",
  padding: "24px",
  background: "rgba(15, 23, 42, 0.38)"
};

const modalPanelStyle = {
  width: "min(720px, 100%)",
  maxHeight: "calc(100vh - 48px)",
  overflow: "auto",
  borderRadius: "18px",
  border: "1px solid #dbe3ec",
  background: "#ffffff",
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.22)",
  padding: "18px"
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "start",
  marginBottom: "16px"
};

const detailGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px"
};

const detailCardStyle = {
  display: "grid",
  gap: "4px",
  padding: "12px",
  borderRadius: "12px",
  background: "#f8fafc",
  border: "1px solid #e5e7eb"
};

const detailLabelStyle = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.04em"
};

const messageBoxStyle = {
  marginTop: "12px",
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #e5e7eb",
  background: "#ffffff"
};

const confirmPanelStyle = {
  width: "min(440px, 100%)",
  borderRadius: "16px",
  border: "1px solid #fecaca",
  background: "#ffffff",
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.22)",
  padding: "20px"
};

const confirmMetaStyle = {
  display: "grid",
  gap: "4px",
  marginTop: "14px",
  padding: "12px",
  borderRadius: "12px",
  background: "#f8fafc",
  color: "#0f172a"
};

const confirmActionRowStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "18px"
};
