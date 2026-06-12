import React from "react";
import {
  FaClipboardList,
  FaKey,
  FaLock,
  FaShieldAlt,
  FaUserShield,
  FaUsers
} from "react-icons/fa";
import {
  createAccessUser,
  deleteAccessUser,
  fetchAccessLogs,
  fetchAccessRoles,
  fetchAccessSecurityRules,
  fetchAccessUsers,
  fetchRolePermissions,
  resetAccessUserPassword,
  updateAccessSecurityRules,
  updateAccessUser,
  updateRolePermissions
} from "../../api/adminApi";

const tabs = [
  { id: "roles", label: "Roles", icon: FaUserShield },
  { id: "users", label: "Users", icon: FaUsers },
  { id: "permissions", label: "Permissions", icon: FaKey },
  { id: "activity-logs", label: "Activity Logs", icon: FaClipboardList },
  { id: "security-rules", label: "Security Rules", icon: FaLock }
];

const actions = ["view", "create", "edit", "delete", "export"];
const modules = [
  ["dashboard", "Dashboard"],
  ["products", "Products"],
  ["categories", "Categories"],
  ["brands", "Brands"],
  ["variations", "Variations"],
  ["orders", "Orders"],
  ["customers", "Customers"],
  ["contact_enquiries", "Contact Enquiries"],
  ["coupons", "Coupons"],
  ["credit_points", "Credit Points"],
  ["homepage", "Homepage"],
  ["pages", "Pages"],
  ["blogs", "Blogs"],
  ["reviews", "Reviews"],
  ["settings", "Settings"],
  ["theme_settings", "Theme Settings"]
];

const emptyInvite = { fullName: "", email: "", phone: "", role: "viewer", password: "" };

function titleCase(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN");
}

function createPermissionDraft(rows = []) {
  const lookup = Object.fromEntries(rows.map((row) => [row.moduleName, row]));
  return Object.fromEntries(modules.map(([key]) => [
    key,
    Object.fromEntries(actions.map((action) => {
      const suffix = action.charAt(0).toUpperCase() + action.slice(1);
      return [action, Boolean(lookup[key]?.[`can${suffix}`])];
    }))
  ]));
}

export function ManageAccessPanel() {
  const [activeTab, setActiveTab] = React.useState("roles");
  const [roles, setRoles] = React.useState([]);
  const [users, setUsers] = React.useState([]);
  const [logs, setLogs] = React.useState([]);
  const [securityRules, setSecurityRules] = React.useState({});
  const [selectedRole, setSelectedRole] = React.useState("admin");
  const [permissionDraft, setPermissionDraft] = React.useState({});
  const [inviteMode, setInviteMode] = React.useState("email");
  const [inviteForm, setInviteForm] = React.useState(emptyInvite);
  const [showUserForm, setShowUserForm] = React.useState(false);
  const [inviteUrl, setInviteUrl] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  const loadOverview = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [rolesResponse, usersResponse, logsResponse, rulesResponse] = await Promise.all([
        fetchAccessRoles(),
        fetchAccessUsers(),
        fetchAccessLogs(),
        fetchAccessSecurityRules()
      ]);
      setRoles(rolesResponse.data?.data || []);
      setUsers(usersResponse.data?.data || []);
      setLogs(logsResponse.data?.data || []);
      setSecurityRules(rulesResponse.data?.data || {});
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to load Manage Access data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadPermissions = React.useCallback(async (role) => {
    if (!role) return;
    try {
      const response = await fetchRolePermissions(role);
      setPermissionDraft(createPermissionDraft(response.data?.data || []));
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to load role permissions.");
    }
  }, []);

  React.useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  React.useEffect(() => {
    if (activeTab === "permissions") loadPermissions(selectedRole);
  }, [activeTab, loadPermissions, selectedRole]);

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");
    setInviteUrl("");
    try {
      const response = await createAccessUser({ ...inviteForm, mode: inviteMode });
      const data = response.data?.data || {};
      setInviteUrl(data.inviteUrl || "");
      setInviteForm(emptyInvite);
      await loadOverview();
      setMessage(inviteMode === "email"
        ? "Invite created. Share the secure setup link shown below. SMTP email delivery is not configured yet."
        : "Dashboard user created and activated.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to create dashboard user.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveUser = async (user) => {
    setIsSaving(true);
    try {
      await updateAccessUser(user.id, { fullName: user.fullName, phone: user.phone, role: user.role, status: user.status });
      await loadOverview();
      setMessage(`${user.fullName} updated.`);
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to update user.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeUser = async (user) => {
    if (!window.confirm(`Delete dashboard user ${user.email}?`)) return;
    try {
      await deleteAccessUser(user.id);
      await loadOverview();
      setMessage(`${user.fullName} deleted.`);
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to delete user.");
    }
  };

  const resetPassword = async (user) => {
    const password = window.prompt(`Enter a temporary password for ${user.email} (minimum 10 characters):`);
    if (!password) return;
    try {
      await resetAccessUserPassword(user.id, password);
      await loadOverview();
      setMessage(`Temporary password updated for ${user.fullName}.`);
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to reset password.");
    }
  };

  const savePermissions = async () => {
    setIsSaving(true);
    try {
      const payload = modules.map(([moduleName]) => ({ moduleName, ...permissionDraft[moduleName] }));
      await updateRolePermissions(selectedRole, payload);
      setMessage(`Permissions saved for ${titleCase(selectedRole)}.`);
      await loadPermissions(selectedRole);
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to save permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveSecurityRules = async () => {
    setIsSaving(true);
    try {
      const response = await updateAccessSecurityRules(securityRules);
      setSecurityRules(response.data?.data || securityRules);
      await loadOverview();
      setMessage("Security rules saved.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to save security rules.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateUserDraft = (id, field, value) => {
    setUsers((current) => current.map((user) => user.id === id ? { ...user, [field]: value } : user));
  };

  const roleOptions = roles.filter((role) => role.status === "active");

  return (
    <div className="manage-access">
      <section className="manage-access-intro">
        <div>
          <span className="manage-access-eyebrow">Admin Settings Module</span>
          <h2>Manage Access</h2>
          <p>Create dashboard users, assign roles, update permissions, review activity, and manage security controls.</p>
        </div>
        <span className="manage-access-badge"><FaShieldAlt /> Super Admin Control</span>
      </section>

      <nav className="manage-access-tabs" aria-label="Manage access sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} type="button" className={activeTab === tab.id ? "is-active" : ""} onClick={() => setActiveTab(tab.id)}>
              <Icon /> <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {message ? <div className="manage-access-message" role="status">{message}</div> : null}
      {isLoading ? <div className="manage-access-panel">Loading access data...</div> : null}

      {!isLoading && activeTab === "roles" ? (
        <section className="manage-access-panel">
          <div className="manage-access-heading"><div><h3>Roles</h3><p>System roles and the current number of assigned users.</p></div></div>
          <div className="manage-access-role-grid">
            {roles.map((role) => (
              <article key={role.name}>
                <div><strong>{role.displayName}</strong><span>{role.isSystem ? "System" : "Custom"}</span></div>
                <p>{role.description}</p>
                <small>{role.usersCount} user(s) · {titleCase(role.status)}</small>
                <button type="button" onClick={() => { setSelectedRole(role.name); setActiveTab("permissions"); }}>View Permissions</button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!isLoading && activeTab === "users" ? (
        <section className="manage-access-panel">
          <div className="manage-access-heading">
            <div><h3>Dashboard Users</h3><p>Email invite and manual password creation are both connected to the database.</p></div>
            <button type="button" className="primary" onClick={() => setShowUserForm((current) => !current)}>{showUserForm ? "Close Form" : "+ Add User"}</button>
          </div>

          {showUserForm ? (
            <form className="manage-access-form" onSubmit={handleCreateUser}>
              <div className="manage-access-mode">
                <button type="button" className={inviteMode === "email" ? "is-active" : ""} onClick={() => setInviteMode("email")}>Email Invite</button>
                <button type="button" className={inviteMode === "manual" ? "is-active" : ""} onClick={() => setInviteMode("manual")}>Manual ID/Password</button>
              </div>
              <div className="manage-access-form-grid">
                <label><span>Full Name</span><input required value={inviteForm.fullName} onChange={(event) => setInviteForm({ ...inviteForm, fullName: event.target.value })} /></label>
                <label><span>Email / Login ID</span><input type="email" required value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} /></label>
                <label><span>Phone</span><input value={inviteForm.phone} onChange={(event) => setInviteForm({ ...inviteForm, phone: event.target.value })} /></label>
                <label><span>Role</span><select value={inviteForm.role} onChange={(event) => setInviteForm({ ...inviteForm, role: event.target.value })}>{roleOptions.map((role) => <option key={role.name} value={role.name}>{role.displayName}</option>)}</select></label>
                {inviteMode === "manual" ? <label><span>Temporary Password</span><input type="password" minLength={10} required value={inviteForm.password} onChange={(event) => setInviteForm({ ...inviteForm, password: event.target.value })} /></label> : null}
              </div>
              <div className="manage-access-actions"><button type="button" onClick={() => setShowUserForm(false)}>Cancel</button><button className="primary" disabled={isSaving}>{isSaving ? "Saving..." : inviteMode === "email" ? "Create Invite" : "Create User"}</button></div>
              {inviteUrl ? <div className="manage-access-invite-link"><strong>Secure invite link</strong><input readOnly value={inviteUrl} /><button type="button" onClick={() => navigator.clipboard?.writeText(inviteUrl)}>Copy Link</button></div> : null}
            </form>
          ) : null}

          <div className="manage-access-table-wrap manage-access-users-table">
            <table>
              <thead><tr><th>User</th><th>Phone</th><th>Role</th><th>Status</th><th>Last Login</th><th>Created</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td data-label="User"><input aria-label={`Full name for ${user.email}`} value={user.fullName} onChange={(event) => updateUserDraft(user.id, "fullName", event.target.value)} /><small>{user.email}</small></td>
                    <td data-label="Phone"><input value={user.phone || ""} onChange={(event) => updateUserDraft(user.id, "phone", event.target.value)} /></td>
                    <td data-label="Role"><select value={user.role} onChange={(event) => updateUserDraft(user.id, "role", event.target.value)}>{roleOptions.map((role) => <option key={role.name} value={role.name}>{role.displayName}</option>)}</select></td>
                    <td data-label="Status"><select value={user.status} onChange={(event) => updateUserDraft(user.id, "status", event.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option><option value="invite_pending">Invite Pending</option></select></td>
                    <td data-label="Last Login">{formatDate(user.lastLoginAt)}</td><td data-label="Created">{formatDate(user.createdAt)}</td>
                    <td data-label="Actions"><div className="manage-access-row-actions"><button type="button" onClick={() => saveUser(user)}>Save</button><button type="button" onClick={() => resetPassword(user)}>Reset Password</button><button type="button" className="danger" disabled={user.role === "super_admin"} onClick={() => removeUser(user)}>Delete</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!isLoading && activeTab === "permissions" ? (
        <section className="manage-access-panel">
          <div className="manage-access-heading"><div><h3>Permission Matrix</h3><p>Changes are persisted to role_permissions and enforced by backend middleware.</p></div><div className="manage-access-heading-actions"><select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}>{roleOptions.filter((role) => role.name !== "super_admin").map((role) => <option key={role.name} value={role.name}>{role.displayName}</option>)}</select><button type="button" className="primary" disabled={isSaving} onClick={savePermissions}>Save Permissions</button></div></div>
          <div className="manage-access-permissions">
            <div className="permission-row permission-header"><strong>Module</strong>{actions.map((action) => <strong key={action}>{titleCase(action)}</strong>)}</div>
            {modules.map(([key, label]) => <div className="permission-row" key={key}><strong>{label}</strong>{actions.map((action) => <label key={action}><input type="checkbox" checked={Boolean(permissionDraft[key]?.[action])} onChange={() => setPermissionDraft((current) => ({ ...current, [key]: { ...current[key], [action]: !current[key]?.[action] } }))} /></label>)}</div>)}
          </div>
        </section>
      ) : null}

      {!isLoading && activeTab === "activity-logs" ? (
        <section className="manage-access-panel">
          <div className="manage-access-heading"><div><h3>Activity Logs</h3><p>Latest access-control and admin audit events.</p></div><button type="button" onClick={loadOverview}>Refresh</button></div>
          <div className="manage-access-table-wrap manage-access-logs-table"><table><thead><tr><th>Admin</th><th>Role</th><th>Action</th><th>Module</th><th>Record</th><th>Device/IP</th><th>Status</th><th>Date</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td data-label="Admin">{log.adminName || "System"}</td><td data-label="Role">{titleCase(log.adminRole)}</td><td data-label="Action">{log.action}</td><td data-label="Module">{titleCase(log.moduleName)}</td><td data-label="Record">{log.recordName || "-"}</td><td data-label="Device/IP">{log.deviceLabel || log.ipAddress || "-"}</td><td data-label="Status">{titleCase(log.status)}</td><td data-label="Date">{formatDate(log.createdAt)}</td></tr>)}</tbody></table></div>
        </section>
      ) : null}

      {!isLoading && activeTab === "security-rules" ? (
        <section className="manage-access-panel">
          <div className="manage-access-heading"><div><h3>Security Rules</h3><p>Operational access safeguards stored in application settings.</p></div><button type="button" className="primary" disabled={isSaving} onClick={saveSecurityRules}>Save Rules</button></div>
          <div className="manage-access-security-grid">
            <label><span>Session Timeout</span><input type="number" min="5" max="480" value={securityRules.sessionTimeoutMinutes || 30} onChange={(event) => setSecurityRules({ ...securityRules, sessionTimeoutMinutes: Number(event.target.value) })} /><small>minutes</small></label>
            <label><span>Password Minimum</span><input type="number" min="8" max="64" value={securityRules.passwordMinLength || 10} onChange={(event) => setSecurityRules({ ...securityRules, passwordMinLength: Number(event.target.value) })} /><small>characters</small></label>
            <label><span>Login Attempt Limit</span><input type="number" min="3" max="20" value={securityRules.loginAttemptLimit || 5} onChange={(event) => setSecurityRules({ ...securityRules, loginAttemptLimit: Number(event.target.value) })} /><small>attempts</small></label>
            {[["autoLockFailedAttempts", "Auto lock failed attempts"], ["confirmBeforeDelete", "Confirm before delete"], ["reasonForRefundCancel", "Require refund/cancel reason"]].map(([key, label]) => <label className="toggle" key={key}><input type="checkbox" checked={Boolean(securityRules[key])} onChange={(event) => setSecurityRules({ ...securityRules, [key]: event.target.checked })} /><span>{label}</span></label>)}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function ManageAccess() {
  return <ManageAccessPanel />;
}
