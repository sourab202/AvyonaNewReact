import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import Login from "./pages/auth/Login";
import { fetchCurrentAdmin, getAdminToken, subscribeAdminAuth } from "./api/adminApi";

function ProtectedDashboard({ isAuthenticated }) {
  const [isVerifying, setIsVerifying] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      if (!isAuthenticated) return;
      setIsVerifying(true);
      try {
        await fetchCurrentAdmin();
      } catch {
        // 401 responses are handled globally by adminApi. Network-only failures still allow local preview mode.
      } finally {
        if (isMounted) setIsVerifying(false);
      }
    }

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isVerifying) return <div style={{ padding: "24px", color: "#475569", fontWeight: 700 }}>Checking admin session...</div>;
  return <AppRoutes />;
}

function App() {
  const [adminToken, setAdminTokenState] = React.useState(() => getAdminToken());

  React.useEffect(() => {
    return subscribeAdminAuth(() => {
      setAdminTokenState(getAdminToken());
    });
  }, []);

  const isAuthenticated = Boolean(adminToken);

  return (
    <Routes>
      <Route path="/login" element={<Login isAuthenticated={isAuthenticated} />} />
      <Route path="/dashboard/*" element={<ProtectedDashboard isAuthenticated={isAuthenticated} />} />
      <Route path="/homepage/hero-banner" element={<Navigate to="/dashboard/homepage/hero-banner" replace />} />
      <Route path="/homepage/browse-categories" element={<Navigate to="/dashboard/homepage/browse-categories" replace />} />
      <Route path="/homepage/our-products" element={<Navigate to="/dashboard/homepage/our-products" replace />} />
      <Route path="/homepage/best-sellers" element={<Navigate to="/dashboard/homepage/best-sellers" replace />} />
      <Route path="/homepage/new-arrivals" element={<Navigate to="/dashboard/homepage/new-arrivals" replace />} />
      <Route path="/homepage/featured-brands" element={<Navigate to="/dashboard/homepage/featured-brands" replace />} />
      <Route path="/homepage/why-shop" element={<Navigate to="/dashboard/homepage/why-shop" replace />} />
      <Route path="/homepage/product-payment-icons" element={<Navigate to="/dashboard/homepage/product-payment-icons" replace />} />
      <Route path="/homepage/newsletter" element={<Navigate to="/dashboard/homepage/newsletter" replace />} />
      <Route path="/homepage/blog-posts" element={<Navigate to="/dashboard/homepage/blog-posts" replace />} />
      <Route path="/homepage/credit-points" element={<Navigate to="/dashboard/homepage/credit-points" replace />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
