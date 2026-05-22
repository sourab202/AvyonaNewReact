import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
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
const HomepageConfigurePage = React.lazy(() => import("../pages/homepage/HomepageConfigurePage"));
const ThankYouPageSettings = React.lazy(() => import("../pages/homepage/ThankYouPageSettings"));
const InvoiceDesigner = React.lazy(() => import("../pages/homepage/InvoiceDesigner"));
const OrderDetails = React.lazy(() => import("../pages/orders/OrderDetails"));
const Orders = React.lazy(() => import("../pages/orders/Orders"));
const AddProduct = React.lazy(() => import("../pages/products/AddProduct"));
const EditProduct = React.lazy(() => import("../pages/products/EditProduct"));
const InventoryManager = React.lazy(() => import("../pages/products/InventoryManager"));
const Products = React.lazy(() => import("../pages/products/Products"));
const Reviews = React.lazy(() => import("../pages/reviews/Reviews"));
const Settings = React.lazy(() => import("../pages/settings/Settings"));
const BlankSettingsPage = React.lazy(() => import("../pages/settings/BlankSettingsPage"));
const FooterSettings = React.lazy(() => import("../pages/settings/FooterSettings"));
const ThemeSettings = React.lazy(() => import("../pages/settings/ThemeSettings"));
const Variations = React.lazy(() => import("../pages/variations/Variations"));
const WebsiteImages = React.lazy(() => import("../pages/images/WebsiteImages"));

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
          <Route index element={<DashboardHome context={resolvedContext} allProducts={resolvedProducts} />} />
          <Route path="homepage" element={<Homepage />} />
          <Route path="credit-points" element={<Navigate to="/dashboard/homepage/credit-points" replace />} />
          <Route path="homepage/credit-points" element={<CreditPoints />} />
          <Route path="homepage/credit-points-section" element={<Navigate to="/dashboard/homepage/credit-points" replace />} />
          <Route path="homepage/hero-banner" element={<HomepageConfigurePage sectionKey="hero-banner" />} />
          <Route path="homepage/browse-categories" element={<HomepageConfigurePage sectionKey="browse-categories" />} />
          <Route path="homepage/our-products" element={<HomepageConfigurePage sectionKey="our-products" />} />
          <Route path="homepage/best-sellers" element={<HomepageConfigurePage sectionKey="best-sellers" />} />
          <Route path="homepage/new-arrivals" element={<HomepageConfigurePage sectionKey="new-arrivals" />} />
          <Route path="homepage/featured-brands" element={<HomepageConfigurePage sectionKey="featured-brands" />} />
          <Route path="homepage/newsletter" element={<HomepageConfigurePage sectionKey="newsletter" />} />
          <Route path="homepage/blog-posts" element={<BlogPosts />} />
          <Route path="homepage/thank-you-page" element={<ThankYouPageSettings />} />
          <Route path="homepage/thank-you-page/invoice-designer" element={<InvoiceDesigner />} />
          <Route path="homepage/reviews" element={<Navigate to="/dashboard/reviews" replace />} />
          <Route path="products" element={<Products />} />
          <Route path="products/new" element={<AddProduct />} />
          <Route path="products/inventory-manager" element={<InventoryManager />} />
          <Route path="products/:productId/edit" element={<EditProduct />} />
          <Route path="variations" element={<Variations />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="categories" element={<Categories />} />
          <Route path="categories/new" element={<AddCategory />} />
          <Route path="categories/:categoryId/edit" element={<AddCategory />} />
          <Route path="website-images" element={<WebsiteImages />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:orderId" element={<OrderDetails />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:customerId" element={<CustomerDetails />} />
          <Route path="contact-enquiries" element={<ContactEnquiries />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="reviews/new" element={<Reviews />} />
          <Route path="settings" element={<Navigate to="/dashboard/settings/main" replace />} />
          <Route path="settings/main" element={<Settings />} />
          <Route path="settings/header" element={<BlankSettingsPage />} />
          <Route path="settings/footer" element={<FooterSettings />} />
          <Route path="settings/contact-page" element={<BlankSettingsPage />} />
          <Route path="settings/theme" element={<ThemeSettings />} />
          <Route path="settings/manage-access" element={<Settings initialSection="manage-access" />} />
        </Route>
      </Routes>
    </React.Suspense>
  );
}
