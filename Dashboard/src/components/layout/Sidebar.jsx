import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FaBox,
  FaCog,
  FaHome,
  FaImages,
  FaEnvelope,
  FaPercent,
  FaList,
  FaShoppingCart,
  FaSignOutAlt,
  FaTachometerAlt,
  FaTags,
  FaUsers,
  FaChevronDown
} from "react-icons/fa";
import { clearAdminToken } from "../../api/adminApi";
import { canViewModule } from "../../utils/accessControl";

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: FaTachometerAlt, module: "dashboard" },
  { label: "Homepage", to: "/dashboard/homepage", icon: FaHome, module: "homepage" },
  { label: "Products", to: "/dashboard/products", icon: FaBox, module: "products" },
  { label: "Variations", to: "/dashboard/variations", icon: FaTags, module: "variations" },
  { label: "Coupons", to: "/dashboard/coupons", icon: FaPercent, module: "coupons" },
  { label: "Categories", to: "/dashboard/categories", icon: FaList, module: "categories" },
  { label: "Website Images", to: "/dashboard/website-images", icon: FaImages, module: "homepage" },
  { label: "Orders", to: "/dashboard/orders", icon: FaShoppingCart, module: "orders" },
  { label: "Customers", to: "/dashboard/customers", icon: FaUsers, module: "customers" },
  { label: "Contact Enquiries", to: "/dashboard/contact-enquiries", icon: FaEnvelope, module: "contact_enquiries" },
  {
    label: "Settings",
    to: "/dashboard/settings/main",
    icon: FaCog,
    module: "settings",
    children: [
      { label: "Main", to: "/dashboard/settings/main", module: "settings" },
      { label: "Header", to: "/dashboard/settings/header", module: "settings" },
      { label: "Footer", to: "/dashboard/settings/footer", module: "settings" },
      { label: "Contact Page", to: "/dashboard/settings/contact-page", module: "settings" },
      { label: "Theme", to: "/dashboard/settings/theme", module: "settings" }
    ]
  }
];

export default function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAdminToken();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-brand-block">
        <p className="dashboard-eyebrow">Admin Panel</p>
        <h2>Avyona Admin</h2>
        <p>Backend control panel for products, orders, customers, and website management.</p>
      </div>

      <nav className="dashboard-nav" aria-label="Admin navigation">
        {navItems.filter((item) => canViewModule(item.module)).map((item) => {
          const visibleChildren = (item.children || []).filter((child) => canViewModule(child.module));

          if (visibleChildren.length) {
            return (
              <div key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => `dashboard-nav-link${isActive ? " is-active" : ""}`}
                >
                  <item.icon className="dashboard-nav-icon" aria-hidden="true" />
                  {item.label}
                  <FaChevronDown style={{ marginLeft: "auto", fontSize: "11px" }} aria-hidden="true" />
                </NavLink>
                {visibleChildren.map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    className={({ isActive }) => `dashboard-nav-sublink${isActive ? " is-active" : ""}`}
                  >
                    {child.label}
                  </NavLink>
                ))}
              </div>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              className={({ isActive }) => `dashboard-nav-link${isActive ? " is-active" : ""}`}
            >
              <item.icon className="dashboard-nav-icon" aria-hidden="true" />
              {item.label}
            </NavLink>
          );
        })}

        <button className="dashboard-nav-link dashboard-nav-button" type="button" onClick={handleLogout}>
          <FaSignOutAlt className="dashboard-nav-icon" aria-hidden="true" />
          Logout
        </button>
      </nav>
    </aside>
  );
}
