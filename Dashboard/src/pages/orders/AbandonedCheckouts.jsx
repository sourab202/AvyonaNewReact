import React from "react";
import { Link } from "react-router-dom";
import {
  fetchAbandonedCheckout,
  fetchAbandonedCheckouts,
  updateAbandonedCheckoutStatus
} from "../../api/adminApi";

const money = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
}).format(Number(value || 0));

const dateTime = (value) => value
  ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
  : "-";

const label = (value) => String(value || "-").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function Address({ value }) {
  if (!value) return <span style={mutedStyle}>Not provided</span>;
  return (
    <span>
      {[value.firstName, value.lastName].filter(Boolean).join(" ")}
      {[value.line1, value.line2, value.city, value.state, value.pincode].filter(Boolean).length ? <br /> : null}
      {[value.line1, value.line2, value.city, value.state, value.pincode].filter(Boolean).join(", ")}
      {value.phone ? <><br />{value.phone}</> : null}
    </span>
  );
}

export default function AbandonedCheckouts() {
  const [rows, setRows] = React.useState([]);
  const [summary, setSummary] = React.useState({});
  const [pagination, setPagination] = React.useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = React.useState({ search: "", status: "", recoveryStatus: "", startDate: "", endDate: "" });
  const [appliedFilters, setAppliedFilters] = React.useState(filters);
  const [selected, setSelected] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");

  const loadRows = React.useCallback(async (page = 1) => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetchAbandonedCheckouts({ ...appliedFilters, page, limit: 20 });
      setRows(response.data.data.rows || []);
      setSummary(response.data.data.summary || {});
      setPagination(response.data.data.pagination || { page, totalPages: 1, total: 0 });
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to load abandoned checkouts.");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  React.useEffect(() => {
    loadRows(1);
  }, [loadRows]);

  const openDetails = async (id) => {
    try {
      const response = await fetchAbandonedCheckout(id);
      setSelected(response.data.data);
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to load checkout details.");
    }
  };

  const changeStatus = async (id, status) => {
    try {
      await updateAbandonedCheckoutStatus(id, status);
      setSelected(null);
      await loadRows(pagination.page);
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to update checkout status.");
    }
  };

  const copyRecoveryLink = async (url) => {
    await navigator.clipboard.writeText(url);
    setMessage("Recovery link copied.");
  };

  const cards = [
    ["Total Checkouts", summary.total || 0],
    ["Active", summary.active || 0],
    ["Recovered", summary.recovered || 0],
    ["Recovery Rate", `${summary.recoveryRate || 0}%`],
    ["Abandoned Value", money(summary.abandonedValue)],
    ["Recovered Value", money(summary.recoveredValue)]
  ];

  return (
    <section style={pageStyle}>
      <div className="dashboard-page-heading">
        <div>
          <h2 style={{ margin: 0 }}>Abandoned Checkouts</h2>
          <p style={mutedStyle}>Track customers who entered checkout details but did not complete their order.</p>
        </div>
        <Link to="/dashboard/orders" style={secondaryLinkStyle}>All Orders</Link>
      </div>

      <div style={cardGridStyle}>
        {cards.map(([title, value]) => (
          <article key={title} className="dashboard-panel" style={cardStyle}>
            <span style={mutedStyle}>{title}</span>
            <strong style={{ fontSize: "24px" }}>{value}</strong>
          </article>
        ))}
      </div>

      <section className="dashboard-panel" style={panelStyle}>
        <form
          style={filterStyle}
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedFilters(filters);
          }}
        >
          <input style={controlStyle} value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search name, email, phone, token" />
          <select style={controlStyle} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="recovered">Recovered</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select style={controlStyle} value={filters.recoveryStatus} onChange={(event) => setFilters({ ...filters, recoveryStatus: event.target.value })}>
            <option value="">All recovery states</option>
            <option value="not_sent">Not Sent</option>
            <option value="sent">Sent</option>
            <option value="clicked">Clicked</option>
            <option value="recovered">Recovered</option>
          </select>
          <input style={controlStyle} type="date" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} aria-label="Created from" />
          <input style={controlStyle} type="date" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} aria-label="Created to" />
          <button style={primaryButtonStyle} type="submit">Apply Filters</button>
        </form>
        {message ? <p style={messageStyle}>{message}</p> : null}

        <div style={{ overflowX: "auto" }}>
          <table className="dashboard-data-table" style={{ width: "100%", minWidth: "1260px" }}>
            <thead>
              <tr>
                {["Customer", "Email / Phone", "Items", "Total", "Status", "Recovery", "Last Activity", "Created", "Actions"].map((heading) => <th key={heading}>{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((checkout) => (
                <tr key={checkout.id}>
                  <td><strong>{checkout.customerName || "Guest Customer"}</strong></td>
                  <td>{checkout.email || "-"}<br /><span style={mutedStyle}>{checkout.phone || "-"}</span></td>
                  <td>{(checkout.cartItems || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0)}</td>
                  <td><strong>{money(checkout.totalAmount)}</strong></td>
                  <td><span style={badgeStyle(checkout.status)}>{label(checkout.status)}</span></td>
                  <td>{label(checkout.recoveryStatus)}</td>
                  <td>{dateTime(checkout.lastActivityAt)}</td>
                  <td>{dateTime(checkout.createdAt)}</td>
                  <td>
                    <div style={actionStyle}>
                      <button type="button" style={linkButtonStyle} onClick={() => openDetails(checkout.id)}>View</button>
                      <button type="button" style={linkButtonStyle} onClick={() => copyRecoveryLink(checkout.recoveryUrl)}>Copy Link</button>
                      {checkout.status === "active" ? (
                        <>
                          <button type="button" style={linkButtonStyle} onClick={() => changeStatus(checkout.id, "expired")}>Expire</button>
                          <button type="button" style={dangerButtonStyle} onClick={() => changeStatus(checkout.id, "cancelled")}>Cancel</button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && !loading ? <tr><td colSpan="9" style={{ padding: "28px", textAlign: "center" }}>No abandoned checkouts match these filters.</td></tr> : null}
              {loading ? <tr><td colSpan="9" style={{ padding: "28px", textAlign: "center" }}>Loading abandoned checkouts...</td></tr> : null}
            </tbody>
          </table>
        </div>

        <div style={paginationStyle}>
          <span style={mutedStyle}>{`${pagination.total || 0} checkout(s)`}</span>
          <div style={actionStyle}>
            <button style={secondaryButtonStyle} type="button" disabled={pagination.page <= 1} onClick={() => loadRows(pagination.page - 1)}>Previous</button>
            <span>{`Page ${pagination.page} of ${pagination.totalPages}`}</span>
            <button style={secondaryButtonStyle} type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => loadRows(pagination.page + 1)}>Next</button>
          </div>
        </div>
      </section>

      {selected ? (
        <div style={overlayStyle} role="presentation" onMouseDown={() => setSelected(null)}>
          <article style={modalStyle} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header style={modalHeaderStyle}>
              <div>
                <p style={eyebrowStyle}>Checkout #{selected.id}</p>
                <h3 style={{ margin: "4px 0 0" }}>{selected.customerName || "Guest Customer"}</h3>
              </div>
              <button type="button" style={secondaryButtonStyle} onClick={() => setSelected(null)}>Close</button>
            </header>
            <div style={detailGridStyle}>
              <section><h4>Customer</h4><p>{selected.email || "-"}<br />{selected.phone || "-"}</p></section>
              <section><h4>Checkout</h4><p>{label(selected.status)} / {label(selected.recoveryStatus)}<br />{money(selected.totalAmount)}</p></section>
              <section><h4>Shipping Address</h4><p><Address value={selected.shippingAddress} /></p></section>
              <section><h4>Billing Address</h4><p><Address value={selected.billingAddress || selected.shippingAddress} /></p></section>
            </div>
            <section>
              <h4>Cart Products</h4>
              <div style={listStyle}>
                {(selected.cartItems || []).map((item, index) => (
                  <div key={`${item.slug || item.asin || item.name}-${index}`} style={listItemStyle}>
                    <span><strong>{item.name || "Product"}</strong><br /><small>{item.variantLabel || item.asin || item.slug || ""}</small></span>
                    <strong>{`${Number(item.quantity || 1)} x ${money(item.price)}`}</strong>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h4>Recovery</h4>
              <div style={recoveryStyle}><span>{selected.recoveryUrl}</span><button type="button" style={linkButtonStyle} onClick={() => copyRecoveryLink(selected.recoveryUrl)}>Copy</button></div>
              {selected.orderId ? <p>Recovered as <Link to={`/dashboard/orders/${selected.orderId}`}>{selected.orderNumber || `order #${selected.orderId}`}</Link>.</p> : null}
            </section>
            <section>
              <h4>Timeline</h4>
              <div style={listStyle}>
                {(selected.events || []).map((event) => (
                  <div key={event.id} style={listItemStyle}><strong>{label(event.eventType)}</strong><span style={mutedStyle}>{dateTime(event.createdAt)}</span></div>
                ))}
              </div>
            </section>
          </article>
        </div>
      ) : null}
    </section>
  );
}

const pageStyle = { display: "grid", gap: "18px" };
const panelStyle = { display: "grid", gap: "16px", padding: "18px" };
const cardGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" };
const cardStyle = { display: "grid", gap: "8px", padding: "16px" };
const filterStyle = { display: "flex", flexWrap: "wrap", gap: "10px" };
const controlStyle = { minHeight: "40px", minWidth: "160px", flex: "1 1 170px", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "0 11px", background: "#fff" };
const primaryButtonStyle = { minHeight: "40px", border: 0, borderRadius: "10px", padding: "0 16px", background: "#0f766e", color: "#fff", fontWeight: 800, cursor: "pointer" };
const secondaryButtonStyle = { minHeight: "36px", border: "1px solid #cbd5e1", borderRadius: "9px", padding: "0 12px", background: "#fff", color: "#334155", fontWeight: 700, cursor: "pointer" };
const secondaryLinkStyle = { ...secondaryButtonStyle, display: "inline-flex", alignItems: "center", textDecoration: "none" };
const mutedStyle = { color: "#64748b", fontSize: "13px", margin: "5px 0 0" };
const messageStyle = { margin: 0, padding: "10px 12px", borderRadius: "10px", background: "#ecfdf5", color: "#047857", fontWeight: 700 };
const actionStyle = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" };
const linkButtonStyle = { border: 0, padding: 0, background: "transparent", color: "#0f766e", fontWeight: 800, cursor: "pointer" };
const dangerButtonStyle = { ...linkButtonStyle, color: "#b91c1c" };
const paginationStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" };
const badgeStyle = (status) => ({ display: "inline-flex", padding: "5px 9px", borderRadius: "999px", background: status === "recovered" ? "#dcfce7" : status === "active" ? "#fef3c7" : "#f1f5f9", color: status === "recovered" ? "#166534" : status === "active" ? "#92400e" : "#475569", fontSize: "12px", fontWeight: 800 });
const overlayStyle = { position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: "20px", background: "rgba(15, 23, 42, 0.58)" };
const modalStyle = { width: "min(900px, 100%)", maxHeight: "90vh", overflowY: "auto", display: "grid", gap: "18px", padding: "20px", borderRadius: "18px", background: "#fff", boxShadow: "0 30px 80px rgba(15, 23, 42, 0.28)" };
const modalHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" };
const eyebrowStyle = { margin: 0, color: "#0f766e", fontSize: "12px", fontWeight: 800, textTransform: "uppercase" };
const detailGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px" };
const listStyle = { display: "grid", gap: "8px" };
const listItemStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "11px 12px", border: "1px solid #e2e8f0", borderRadius: "10px", background: "#f8fafc" };
const recoveryStyle = { display: "flex", justifyContent: "space-between", gap: "12px", padding: "11px", borderRadius: "10px", background: "#f8fafc", overflowWrap: "anywhere" };
