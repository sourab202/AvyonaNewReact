import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
  FaChevronDown,
  FaAngleDoubleLeft,
  FaAngleDoubleRight
} from "react-icons/fa";
import { clearAdminToken, logoutAdmin } from "../../api/adminApi";
import { canViewModule, getCurrentAdminRole } from "../../utils/accessControl";

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: FaTachometerAlt, module: "dashboard" },
  { label: "Homepage", to: "/dashboard/homepage", icon: FaHome, module: "homepage" },
  { label: "Products", to: "/dashboard/products", icon: FaBox, module: "products" },
  { label: "Variations", to: "/dashboard/variations", icon: FaTags, module: "variations" },
  { label: "Coupons", to: "/dashboard/coupons", icon: FaPercent, module: "coupons" },
  { label: "Categories", to: "/dashboard/categories", icon: FaList, module: "categories" },
  { label: "Website Images", to: "/dashboard/website-images", icon: FaImages, module: "homepage" },
  {
    label: "Orders",
    to: "/dashboard/orders",
    icon: FaShoppingCart,
    module: "orders",
    children: [
      { label: "All Orders", to: "/dashboard/orders", module: "orders" },
      { label: "Abandoned Checkouts", to: "/dashboard/orders/abandoned-checkouts", module: "orders" }
    ]
  },
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
      { label: "Theme", to: "/dashboard/settings/theme", module: "theme_settings" },
      { label: "Activity History", to: "/dashboard/settings/activity-history", module: "settings", roles: ["admin", "super_admin"] }
    ]
  }
];

export default function Sidebar({ isCollapsed = false, onToggleCollapse }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [openDropdowns, setOpenDropdowns] = React.useState(() => ({
    settings: location.pathname.startsWith("/dashboard/settings"),
    orders: location.pathname.startsWith("/dashboard/orders")
  }));
  const currentRole = getCurrentAdminRole();

  const handleLogout = async () => {
    try {
      await logoutAdmin();
    } catch {
      // The local session must still end if the audit endpoint is temporarily unavailable.
    }
    clearAdminToken();
    navigate("/dashboard/login", { replace: true });
  };

  React.useEffect(() => {
    if (location.pathname.startsWith("/dashboard/settings")) {
      setOpenDropdowns((current) => ({ ...current, settings: true }));
    }
    if (location.pathname.startsWith("/dashboard/orders")) {
      setOpenDropdowns((current) => ({ ...current, orders: true }));
    }
  }, [location.pathname]);

  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-brand-block">
        <div className="dashboard-brand-head">
          <span className="dashboard-brand-mark" aria-hidden="true">A</span>
          <button
            type="button"
            className="dashboard-sidebar-toggle"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <FaAngleDoubleRight aria-hidden="true" /> : <FaAngleDoubleLeft aria-hidden="true" />}
          </button>
        </div>
        <div className="dashboard-brand-copy">
          <p className="dashboard-eyebrow">Admin Panel</p>
          <h2>Avyona Admin</h2>
          <p>Backend control panel for products, orders, customers, and website management.</p>
        </div>
      </div>

      <nav className="dashboard-nav" aria-label="Admin navigation">
        {navItems.filter((item) => canViewModule(item.module)).map((item) => {
          const visibleChildren = (item.children || []).filter((child) => canViewModule(child.module) && (!child.roles || child.roles.includes(currentRole)));

          if (visibleChildren.length) {
            const dropdownKey = item.label.toLowerCase();
            const isDropdownOpen = Boolean(openDropdowns[dropdownKey]) && !isCollapsed;
            const isSectionActive = location.pathname === item.to || visibleChildren.some((child) => location.pathname.startsWith(child.to));
            const toggleDropdown = () => {
              if (isCollapsed) {
                navigate(item.to);
                return;
              }
              setOpenDropdowns((current) => ({ ...current, [dropdownKey]: !current[dropdownKey] }));
            };

            return (
              <div key={item.to} className={`dashboard-nav-group${isDropdownOpen ? " is-open" : ""}`}>
                <button
                  type="button"
                  className={`dashboard-nav-link dashboard-nav-button dashboard-nav-dropdown-toggle${isSectionActive ? " is-active" : ""}`}
                  onClick={toggleDropdown}
                  aria-expanded={isDropdownOpen}
                  aria-controls={`${dropdownKey}-submenu`}
                >
                  <item.icon className="dashboard-nav-icon" aria-hidden="true" />
                  <span className="dashboard-nav-label">{item.label}</span>
                  <FaChevronDown className={`dashboard-nav-chevron${isDropdownOpen ? " is-open" : ""}`} aria-hidden="true" />
                </button>
                <div id={`${dropdownKey}-submenu`} className="dashboard-nav-submenu" hidden={!isDropdownOpen}>
                  {visibleChildren.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      end={child.to === "/dashboard/orders"}
                      className={({ isActive }) => `dashboard-nav-sublink${isActive ? " is-active" : ""}`}
                    >
                      <span className="dashboard-nav-label">{child.label}</span>
                    </NavLink>
                  ))}
                </div>
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
              <span className="dashboard-nav-label">{item.label}</span>
            </NavLink>
          );
        })}

        <button className="dashboard-nav-link dashboard-nav-button" type="button" onClick={handleLogout}>
          <FaSignOutAlt className="dashboard-nav-icon" aria-hidden="true" />
          <span className="dashboard-nav-label">Logout</span>
        </button>
      </nav>
    </aside>
  );
}
