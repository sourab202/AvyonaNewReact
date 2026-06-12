import React from "react";
import { FaEye, FaHistory, FaSearch, FaTimes } from "react-icons/fa";
import { fetchActivityLog, fetchActivityLogs } from "../../api/adminApi";

const emptyFilters = { search: "", module: "", action: "", admin_id: "", date_from: "", date_to: "" };
const label = (value) => String(value || "-").replaceAll("_", " ");
const dateTime = (value) => value ? new Date(value).toLocaleString() : "-";

function JsonPanel({ title, value }) {
  return (
    <section className="activity-json-panel">
      <h4>{title}</h4>
      <pre>{value ? JSON.stringify(value, null, 2) : "No data recorded"}</pre>
    </section>
  );
}

export default function ActivityHistory() {
  const [filters, setFilters] = React.useState(emptyFilters);
  const [applied, setApplied] = React.useState(emptyFilters);
  const [logs, setLogs] = React.useState([]);
  const [options, setOptions] = React.useState({ modules: [], actions: [], admins: [] });
  const [pagination, setPagination] = React.useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [detail, setDetail] = React.useState(null);

  const load = React.useCallback(async (page = 1) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchActivityLogs({ ...applied, page, limit: 25 });
      setLogs(response.data?.data || []);
      setOptions(response.data?.filters || { modules: [], actions: [], admins: [] });
      setPagination(response.data?.pagination || { page, totalPages: 1, total: 0 });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load activity history.");
    } finally {
      setLoading(false);
    }
  }, [applied]);

  React.useEffect(() => { load(1); }, [load]);

  const openDetail = async (id) => {
    try {
      const response = await fetchActivityLog(id);
      setDetail(response.data?.data || null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load activity details.");
    }
  };

  return (
    <div className="activity-history-page">
      <header className="activity-history-hero">
        <div className="activity-history-icon"><FaHistory /></div>
        <div>
          <span>SECURITY & GOVERNANCE</span>
          <h2>Activity History</h2>
          <p>Review dashboard changes, access events, and record-level history.</p>
        </div>
        <strong>{pagination.total} events</strong>
      </header>

      <form className="activity-filters" onSubmit={(event) => { event.preventDefault(); setApplied(filters); }}>
        <label className="activity-search"><FaSearch /><input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Search admin, action, entity or IP" /></label>
        <select value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })}><option value="">All modules</option>{options.modules.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}><option value="">All actions</option>{options.actions.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={filters.admin_id} onChange={(e) => setFilters({ ...filters, admin_id: e.target.value })}><option value="">All admins</option>{options.admins.map((item) => <option key={`${item.id}-${item.email}`} value={item.id || ""}>{item.name || item.email}</option>)}</select>
        <input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} aria-label="From date" />
        <input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} aria-label="To date" />
        <button type="submit">Apply</button>
        <button type="button" className="secondary" onClick={() => { setFilters(emptyFilters); setApplied(emptyFilters); }}>Reset</button>
      </form>

      {error ? <div className="activity-error">{error}</div> : null}
      <div className="activity-table-card">
        <div className="activity-table-scroll">
          <table>
            <thead><tr><th>Date & Time</th><th>Admin</th><th>Role</th><th>Module</th><th>Action</th><th>Entity</th><th>Description</th><th>IP Address</th><th>Details</th></tr></thead>
            <tbody>
              {!loading && !logs.length ? <tr><td colSpan="9" className="activity-empty">No activity matches these filters.</td></tr> : null}
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="activity-nowrap">{dateTime(log.createdAt)}</td>
                  <td><strong>{log.adminName || "System"}</strong><small>{log.adminEmail}</small></td>
                  <td><span className="activity-role">{label(log.roleName)}</span></td>
                  <td>{label(log.module)}</td>
                  <td><span className="activity-action">{label(log.action)}</span></td>
                  <td><strong>{log.entityName || label(log.entityType)}</strong><small>{log.entityId ? `#${log.entityId}` : ""}</small></td>
                  <td>{log.description || "-"}</td><td className="activity-nowrap">{log.ipAddress || "-"}</td>
                  <td><button className="activity-view" type="button" onClick={() => openDetail(log.id)}><FaEye /> View</button></td>
                </tr>
              ))}
              {loading ? <tr><td colSpan="9" className="activity-empty">Loading activity history...</td></tr> : null}
            </tbody>
          </table>
        </div>
        <footer className="activity-pagination">
          <span>Page {pagination.page} of {pagination.totalPages}</span>
          <div><button disabled={pagination.page <= 1 || loading} onClick={() => load(pagination.page - 1)}>Previous</button><button disabled={pagination.page >= pagination.totalPages || loading} onClick={() => load(pagination.page + 1)}>Next</button></div>
        </footer>
      </div>

      {detail ? (
        <div className="activity-modal-backdrop" role="presentation" onMouseDown={() => setDetail(null)}>
          <div className="activity-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span>{label(detail.module)}</span><h3>{label(detail.action)}</h3></div><button onClick={() => setDetail(null)} aria-label="Close"><FaTimes /></button></header>
            <div className="activity-detail-grid">
              <div><small>Admin</small><strong>{detail.adminName || "System"}</strong><span>{detail.adminEmail || "-"}</span></div>
              <div><small>Role</small><strong>{label(detail.roleName)}</strong></div>
              <div><small>Entity</small><strong>{detail.entityName || label(detail.entityType)}</strong><span>{detail.entityId || "-"}</span></div>
              <div><small>Timestamp</small><strong>{dateTime(detail.createdAt)}</strong></div>
              <div><small>IP Address</small><strong>{detail.ipAddress || "-"}</strong></div>
              <div><small>User Agent</small><span>{detail.userAgent || "-"}</span></div>
            </div>
            {detail.description ? <p className="activity-description">{detail.description}</p> : null}
            <div className="activity-json-grid"><JsonPanel title="Changed Fields" value={detail.changes} /><JsonPanel title="Old Values" value={detail.oldValues} /><JsonPanel title="New Values" value={detail.newValues} /></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
