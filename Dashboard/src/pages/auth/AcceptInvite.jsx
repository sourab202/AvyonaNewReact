import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { acceptAdminInvite } from "../../api/adminApi";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const token = searchParams.get("token") || "";

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    setIsSaving(true);
    setMessage("");
    try {
      const response = await acceptAdminInvite({ token, password });
      setMessage(response.data?.message || "Password created. You can now sign in.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to accept this invite.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main style={pageStyle}>
      <form onSubmit={handleSubmit} style={cardStyle}>
        <div>
          <span style={eyebrowStyle}>Avyona Dashboard</span>
          <h1 style={titleStyle}>Set your admin password</h1>
          <p style={copyStyle}>Create a secure password to activate your dashboard invitation.</p>
        </div>
        <label style={fieldStyle}>
          <span>Password</span>
          <input type="password" minLength={10} required value={password} onChange={(event) => setPassword(event.target.value)} style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          <span>Confirm password</span>
          <input type="password" minLength={10} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} style={inputStyle} />
        </label>
        {message ? <p style={messageStyle}>{message}</p> : null}
        <button type="submit" disabled={!token || isSaving} style={buttonStyle}>{isSaving ? "Activating..." : "Activate Account"}</button>
        <Link to="/dashboard/login" style={linkStyle}>Back to login</Link>
      </form>
    </main>
  );
}

const pageStyle = { minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", background: "#f1f5f9" };
const cardStyle = { width: "min(100%, 440px)", display: "grid", gap: "18px", padding: "28px", borderRadius: "20px", background: "#fff", boxShadow: "0 24px 60px rgba(15,23,42,.12)" };
const eyebrowStyle = { color: "#15803d", fontSize: "12px", fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase" };
const titleStyle = { margin: "8px 0 0", color: "#0f172a", fontSize: "28px" };
const copyStyle = { margin: "8px 0 0", color: "#64748b", lineHeight: 1.55 };
const fieldStyle = { display: "grid", gap: "7px", color: "#334155", fontWeight: 800 };
const inputStyle = { width: "100%", minHeight: "44px", padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: "10px" };
const buttonStyle = { minHeight: "44px", border: 0, borderRadius: "10px", background: "#16a34a", color: "#fff", fontWeight: 900, cursor: "pointer" };
const messageStyle = { margin: 0, padding: "12px", borderRadius: "10px", background: "#f1f5f9", color: "#334155" };
const linkStyle = { color: "#166534", fontWeight: 800, textAlign: "center" };
