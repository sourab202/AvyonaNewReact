import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AccessRoute from "../components/access/AccessRoute";
import { getCurrentAdminRole } from "../utils/accessControl";
import AdminLayout from "../components/layout/AdminLayout";
import { allProducts as storefrontProducts } from "../data/storefront-content";

const AddCategory = React.lazy(() => import("../pages/categories/AddCategory"));
const Categories = React.lazy(() => import("../pages/categories/Categories"));
const ContactEnquiries = React.lazy(() => import("../pages/contact-enquiries/ContactEnquiries"));
const CustomerDetails = React.lazy(() => import("../pages/customers/CustomerDetails"));
const Customers = React.lazy(() => import("../pages/customers/Customers"));
const Coupons = React.lazy(() => import("../pages/coupons/Coupons"));
const DashboardHome = React.lazy(() => import("../pages/dashboard/DashboardHome"));
const CreditPoints = React.lazy(() => import("../pages/credit-points/CreditPoints"));
const Homepage = React.lazy(() => import("../pages/homepage/Homepage"));
const BlogPosts = React.lazy(() => import("../pages/homepage/BlogPosts"));
const CustomPages = React.lazy(() => import("../pages/homepage/CustomPages"));
const HomepageConfigurePage = React.lazy(() => import("../pages/homepage/HomepageConfigurePage"));
const ThankYouPageSettings = React.lazy(() => import("../pages/homepage/ThankYouPageSettings"));
const InvoiceDesigner = React.lazy(() => import("../pages/homepage/InvoiceDesigner"));
const DeliveryPincodes = React.lazy(() => import("../pages/homepage/DeliveryPincodes"));
const OrderDetails = React.lazy(() => import("../pages/orders/OrderDetails"));
const Orders = React.lazy(() => import("../pages/orders/Orders"));
const AbandonedCheckouts = React.lazy(() => import("../pages/orders/AbandonedCheckouts"));
const AddProduct = React.lazy(() => import("../pages/products/AddProduct"));
const EditProduct = React.lazy(() => import("../pages/products/EditProduct"));
const InventoryManager = React.lazy(() => import("../pages/products/InventoryManager"));
const Products = React.lazy(() => import("../pages/products/Products"));
const Reviews = React.lazy(() => import("../pages/reviews/Reviews"));
const Settings = React.lazy(() => import("../pages/settings/Settings"));
const ContactPageSettings = React.lazy(() => import("../pages/settings/ContactPageSettings"));
const FooterSettings = React.lazy(() => import("../pages/settings/FooterSettings"));
const ThemeSettings = React.lazy(() => import("../pages/settings/ThemeSettings"));
const Variations = React.lazy(() => import("../pages/variations/Variations"));
const WebsiteImages = React.lazy(() => import("../pages/images/WebsiteImages"));
const ActivityHistory = React.lazy(() => import("../pages/settings/ActivityHistory"));

function protectedPage(module, element, action = "view") {
  return (
    <AccessRoute module={module} action={action}>
      {element}
    </AccessRoute>
  );
}

function activityHistoryPage(element) {
  return ["admin", "super_admin"].includes(getCurrentAdminRole())
    ? element
    : <Navigate to="/dashboard" replace />;
}

const previewContext = {
  cart: [],
  wishlist: [],
  authUser: null,
  accounts: [],
  customerProfile: {},
  orders: [],
  notify: () => {},
  isCartOpen: false,
  setIsCartOpen: () => {},
  addToCart: () => {},
  updateCartQuantity: () => {},
  removeCartItem: () => {},
  toggleWishlist: () => {},
  setCart: () => {},
  setAuthUser: () => {},
  setAccounts: () => {},
  setCustomerProfile: () => {},
  setOrders: () => {}
};

export default function AppRoutes({ context, allProducts }) {
  const resolvedContext = context || previewContext;
  const resolvedProducts = allProducts || storefrontProducts;

  return (
    <React.Suspense fallback={<div style={{ padding: "24px", color: "#475569", fontWeight: 700 }}>Loading dashboard...</div>}>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={protectedPage("dashboard", <DashboardHome context={resolvedContext} allProducts={resolvedProducts} />)} />
          <Route path="homepage" element={protectedPage("homepage", <Homepage />)} />
          <Route path="credit-points" element={<Navigate to="/dashboard/homepage/credit-points" replace />} />
          <Route path="homepage/credit-points" element={protectedPage("credit_points", <CreditPoints />)} />
          <Route path="homepage/credit-points-section" element={<Navigate to="/dashboard/homepage/credit-points" replace />} />
          <Route path="homepage/hero-banner" element={protectedPage("homepage", <HomepageConfigurePage sectionKey="hero-banner" />, "edit")} />
          <Route path="homepage/browse-categories" element={protectedPage("homepage", <HomepageConfigurePage sectionKey="browse-categories" />, "edit")} />
          <Route path="homepage/our-products" element={protectedPage("homepage", <HomepageConfigurePage sectionKey="our-products" />, "edit")} />
          <Route path="homepage/best-sellers" element={protectedPage("homepage", <HomepageConfigurePage sectionKey="best-sellers" />, "edit")} />
          <Route path="homepage/new-arrivals" element={protectedPage("homepage", <HomepageConfigurePage sectionKey="new-arrivals" />, "edit")} />
          <Route path="homepage/featured-brands" element={protectedPage("homepage", <HomepageConfigurePage sectionKey="featured-brands" />, "edit")} />
          <Route path="homepage/why-shop" element={protectedPage("homepage", <HomepageConfigurePage sectionKey="why-shop" />, "edit")} />
          <Route path="homepage/product-payment-icons" element={protectedPage("homepage", <HomepageConfigurePage sectionKey="product-payment-icons" />, "edit")} />
          <Route path="homepage/delivery-pincodes" element={protectedPage("homepage", <DeliveryPincodes />)} />
          <Route path="homepage/pages" element={protectedPage("pages", <CustomPages />)} />
          <Route path="homepage/newsletter" element={protectedPage("homepage", <HomepageConfigurePage sectionKey="newsletter" />, "edit")} />
          <Route path="homepage/blog-posts" element={protectedPage("blogs", <BlogPosts />)} />
          <Route path="homepage/thank-you-page" element={protectedPage("homepage", <ThankYouPageSettings />, "edit")} />
          <Route path="homepage/thank-you-page/invoice-designer" element={protectedPage("homepage", <InvoiceDesigner />, "edit")} />
          <Route path="homepage/reviews" element={<Navigate to="/dashboard/reviews" replace />} />
          <Route path="products" element={protectedPage("products", <Products />)} />
          <Route path="products/new" element={protectedPage("products", <AddProduct />, "create")} />
          <Route path="products/inventory-manager" element={protectedPage("products", <InventoryManager />, "edit")} />
          <Route path="products/:productId/edit" element={protectedPage("products", <EditProduct />, "edit")} />
          <Route path="variations" element={protectedPage("variations", <Variations />)} />
          <Route path="coupons" element={protectedPage("coupons", <Coupons />)} />
          <Route path="categories" element={protectedPage("categories", <Categories />)} />
          <Route path="categories/new" element={protectedPage("categories", <AddCategory />, "create")} />
          <Route path="categories/:categoryId/edit" element={protectedPage("categories", <AddCategory />, "edit")} />
          <Route path="website-images" element={protectedPage("homepage", <WebsiteImages />)} />
          <Route path="orders" element={protectedPage("orders", <Orders />)} />
          <Route path="orders/abandoned-checkouts" element={protectedPage("orders", <AbandonedCheckouts />)} />
          <Route path="orders/:orderId" element={protectedPage("orders", <OrderDetails />)} />
          <Route path="customers" element={protectedPage("customers", <Customers />)} />
          <Route path="customers/:customerId" element={protectedPage("customers", <CustomerDetails />)} />
          <Route path="contact-enquiries" element={protectedPage("contact_enquiries", <ContactEnquiries />)} />
          <Route path="reviews" element={protectedPage("reviews", <Reviews />)} />
          <Route path="reviews/new" element={protectedPage("reviews", <Reviews />, "create")} />
          <Route path="settings" element={<Navigate to="/dashboard/settings/main" replace />} />
          <Route path="settings/main" element={protectedPage("settings", <Settings />)} />
          <Route path="settings/header" element={protectedPage("settings", <Settings initialSection="header" />)} />
          <Route path="settings/footer" element={protectedPage("settings", <FooterSettings />)} />
          <Route path="settings/contact-page" element={protectedPage("settings", <ContactPageSettings />)} />
          <Route path="settings/theme" element={protectedPage("theme_settings", <ThemeSettings />)} />
          <Route path="settings/manage-access" element={protectedPage("sensitive_access", <Settings initialSection="manage-access" />, "manage_admin_users")} />
          <Route path="settings/activity-history" element={activityHistoryPage(<ActivityHistory />)} />
        </Route>
      </Routes>
    </React.Suspense>
  );
}
