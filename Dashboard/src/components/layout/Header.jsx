import React from "react";

export default function Header({ title, subtitle, actions = null }) {
  return (
    <header className="dashboard-hero-card">
      <div>
        <p className="dashboard-eyebrow">Backend Control Panel</p>
        <h1>{title || "Admin Dashboard"}</h1>
        {subtitle ? <p className="dashboard-hero-copy">{subtitle}</p> : null}
      </div>
      <div className="dashboard-hero-actions">
        <div className="header-user-pill">
          <span className="header-user-avatar">A</span>
          <span className="header-user-copy">
            <strong>Admin User</strong>
            <span>Dashboard Access</span>
          </span>
        </div>
        {actions}
      </div>
    </header>
  );
}
