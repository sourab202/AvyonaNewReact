import React from "react";
import { Outlet, matchPath, useLocation } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import "../../index.css";

const pageMeta = [
  {
    path: "/dashboard/products/new",
    title: "Add Product",
    subtitle: "Create a new product for the Avyona ecommerce website."
  },
  {
    path: "/dashboard/products/inventory-manager",
    title: "Inventory Manager",
    subtitle: "Import, validate, update, and export product inventory in bulk."
  },
  {
    path: "/dashboard/homepage/:section",
    title: "Homepage",
    subtitle: "Configure storefront homepage sections, ordering, media, and product placement."
  },
  {
    path: "/dashboard/homepage",
    title: "Homepage",
    subtitle: "Manage homepage sections, banners, categories, products, and featured content."
  },
  {
    path: "/dashboard/products",
    title: "Products",
    subtitle: ""
  },
  {
    path: "/dashboard/variations",
    title: "Variations",
    subtitle: "Manage product variants such as color, size, finish, price, and stock combinations."
  },
  {
    path: "/dashboard/coupons",
    title: "Coupons",
    subtitle: "Create, review, and manage promotional coupon rules."
  },
  {
    path: "/dashboard/categories",
    title: "Categories",
    subtitle: "Manage category structure used across the storefront and backend."
  },
  {
    path: "/dashboard/website-images",
    title: "Website Images",
    subtitle: "Manage reusable storefront images, media placement, and uploaded assets."
  },
  {
    path: "/dashboard/orders/abandoned-checkouts",
    title: "Abandoned Checkouts",
    subtitle: "Review incomplete checkouts, recovery activity, and recovered revenue."
  },
  {
    path: "/dashboard/orders",
    title: "Orders",
    subtitle: "Track purchases, update order status, and manage fulfillment flow."
  },
  {
    path: "/dashboard/customers",
    title: "Customers",
    subtitle: "View customer records, order history, and business insights."
  },
  {
    path: "/dashboard/contact-enquiries",
    title: "Contact Enquiries",
    subtitle: "Review customer support and business enquiry messages from the website."
  },
  {
    path: "/dashboard/settings",
    title: "Settings",
    subtitle: "Manage backend access, uploads, and store-level configuration."
  },
  {
    path: "/dashboard/settings/main",
    title: "Main Settings",
    subtitle: "Manage the existing dashboard settings in one place."
  },
  {
    path: "/dashboard/settings/header",
    title: "Header Settings",
    subtitle: ""
  },
  {
    path: "/dashboard/settings/footer",
    title: "Footer Settings",
    subtitle: ""
  },
  {
    path: "/dashboard/settings/contact-page",
    title: "Contact Page Settings",
    subtitle: ""
  },
  {
    path: "/dashboard/settings/theme",
    title: "Theme Settings",
    subtitle: "Control website colors, buttons, cards, spacing, and global design style."
  },
  {
    path: "/dashboard",
    title: "Dashboard",
    subtitle: "Monitor revenue, orders, customers, and product activity from the admin backend."
  }
];

function getPageMeta(pathname) {
  return pageMeta.find((item) => matchPath({ path: item.path, end: true }, pathname)) || pageMeta[pageMeta.length - 1];
}

export default function AdminLayout() {
  const location = useLocation();
  const currentPage = getPageMeta(location.pathname);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("avyona-dashboard-sidebar") === "collapsed";
  });

  const handleToggleSidebar = React.useCallback(() => {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("avyona-dashboard-sidebar", next ? "collapsed" : "expanded");
      }
      return next;
    });
  }, []);

  return (
    <div className={`dashboard-shell${isSidebarCollapsed ? " is-sidebar-collapsed" : ""}`}>
      <Sidebar isCollapsed={isSidebarCollapsed} onToggleCollapse={handleToggleSidebar} />
      <div className="dashboard-main">
        <Header title={currentPage.title} subtitle={currentPage.subtitle} />
        <main className="dashboard-overview">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
