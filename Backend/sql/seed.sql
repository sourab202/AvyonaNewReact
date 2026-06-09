USE avyona_admin;

INSERT INTO admins (full_name, email, phone, password_hash, role, status, is_active)
VALUES (
  'Sourab Kumar',
  'sourab@thedoveberry.com',
  '+91 98765 43210',
  '$2a$10$emBRVSUen../oAczdWrwmuNtoBBwqX2.iCirgGZ51dW5cHU4F1V9q',
  'super_admin',
  'active',
  1
)
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  phone = VALUES(phone),
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  status = VALUES(status),
  is_active = VALUES(is_active);

INSERT INTO roles (name, display_name, description, is_system, status) VALUES
  ('super_admin', 'Super Admin', 'Complete dashboard access including users, roles, permissions, security rules, settings, and destructive actions.', 1, 'active'),
  ('admin', 'Admin', 'Broad dashboard management access for everyday administration, excluding highest-risk security ownership controls.', 1, 'active'),
  ('product_manager', 'Product Manager', 'Manage products, categories, brands, variations, media, pricing, inventory, and homepage product placement.', 1, 'active'),
  ('order_manager', 'Order Manager', 'Manage orders, status updates, fulfillment workflow, and order exports.', 1, 'active'),
  ('marketing_manager', 'Marketing Manager', 'Manage coupons, homepage promotions, featured sections, reviews, and campaign visibility.', 1, 'active'),
  ('support_staff', 'Support Staff', 'View and update customer support records with limited order and customer access.', 1, 'active'),
  ('viewer', 'Viewer', 'Read-only access to dashboard records and reports.', 1, 'active')
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  description = VALUES(description),
  is_system = VALUES(is_system),
  status = VALUES(status);

INSERT INTO permissions (permission_key, module_name, action_name, display_name, description, is_sensitive, is_available) VALUES
  ('dashboard.view', 'dashboard', 'view', 'View Dashboard', 'View dashboard metrics and summaries.', 0, 1),
  ('products.view', 'products', 'view', 'View Products', 'View product catalog records.', 0, 1),
  ('products.create', 'products', 'create', 'Create Products', 'Create new product records.', 0, 1),
  ('products.edit', 'products', 'edit', 'Edit Products', 'Edit product records.', 0, 1),
  ('products.delete', 'products', 'delete', 'Delete Products', 'Delete product records.', 1, 1),
  ('products.export', 'products', 'export', 'Export Products', 'Export product records.', 0, 1),
  ('categories.view', 'categories', 'view', 'View Categories', 'View category records.', 0, 1),
  ('categories.create', 'categories', 'create', 'Create Categories', 'Create category records.', 0, 1),
  ('categories.edit', 'categories', 'edit', 'Edit Categories', 'Edit category records.', 0, 1),
  ('categories.delete', 'categories', 'delete', 'Delete Categories', 'Delete category records.', 0, 1),
  ('categories.export', 'categories', 'export', 'Export Categories', 'Export category records.', 0, 1),
  ('brands.view', 'brands', 'view', 'View Brands', 'View brand records.', 0, 1),
  ('brands.create', 'brands', 'create', 'Create Brands', 'Create brand records.', 0, 1),
  ('brands.edit', 'brands', 'edit', 'Edit Brands', 'Edit brand records.', 0, 1),
  ('brands.delete', 'brands', 'delete', 'Delete Brands', 'Delete brand records.', 0, 1),
  ('brands.export', 'brands', 'export', 'Export Brands', 'Export brand records.', 0, 1),
  ('variations.view', 'variations', 'view', 'View Variations', 'View variation records.', 0, 1),
  ('variations.create', 'variations', 'create', 'Create Variations', 'Create variation records.', 0, 1),
  ('variations.edit', 'variations', 'edit', 'Edit Variations', 'Edit variation records.', 0, 1),
  ('variations.delete', 'variations', 'delete', 'Delete Variations', 'Delete variation records.', 0, 1),
  ('variations.export', 'variations', 'export', 'Export Variations', 'Export variation records.', 0, 1),
  ('orders.view', 'orders', 'view', 'View Orders', 'View order records.', 0, 1),
  ('orders.create', 'orders', 'create', 'Create Orders', 'Create/manual order records.', 0, 1),
  ('orders.edit', 'orders', 'edit', 'Edit Orders', 'Edit order status and fulfillment details.', 0, 1),
  ('orders.export', 'orders', 'export', 'Export Orders', 'Export order records.', 0, 1),
  ('customers.view', 'customers', 'view', 'View Customers', 'View customer records.', 0, 1),
  ('customers.edit', 'customers', 'edit', 'Edit Customers', 'Edit customer records.', 0, 1),
  ('customers.export', 'customers', 'export', 'Export Customers', 'Export customer records.', 1, 1),
  ('contact_enquiries.view', 'contact_enquiries', 'view', 'View Contact Enquiries', 'View customer and business contact enquiries.', 0, 1),
  ('contact_enquiries.edit', 'contact_enquiries', 'edit', 'Edit Contact Enquiries', 'Update contact enquiry status.', 0, 1),
  ('contact_enquiries.export', 'contact_enquiries', 'export', 'Export Contact Enquiries', 'Export contact enquiry records.', 1, 1),
  ('coupons.view', 'coupons', 'view', 'View Coupons', 'View coupon records.', 0, 1),
  ('coupons.create', 'coupons', 'create', 'Create Coupons', 'Create coupon records.', 0, 1),
  ('coupons.edit', 'coupons', 'edit', 'Edit Coupons', 'Edit coupon records.', 0, 1),
  ('coupons.delete', 'coupons', 'delete', 'Delete Coupons', 'Delete coupon records.', 0, 1),
  ('coupons.export', 'coupons', 'export', 'Export Coupons', 'Export coupon records.', 0, 1),
  ('credit_points.view', 'credit_points', 'view', 'View Credit Points', 'View credit points rewards, wallets, transactions, and referral activity.', 0, 1),
  ('credit_points.create', 'credit_points', 'create', 'Create Credit Point Rules', 'Create reward rules and credit point campaigns.', 0, 1),
  ('credit_points.edit', 'credit_points', 'edit', 'Edit Credit Points', 'Edit reward settings, wallets, and expiry processing.', 1, 1),
  ('credit_points.delete', 'credit_points', 'delete', 'Delete Credit Point Rules', 'Delete non-default reward rules.', 1, 1),
  ('credit_points.export', 'credit_points', 'export', 'Export Credit Points', 'Export credit points wallet and transaction data.', 1, 1),
  ('homepage.view', 'homepage', 'view', 'View Homepage', 'View homepage configuration.', 0, 1),
  ('homepage.create', 'homepage', 'create', 'Create Homepage Content', 'Create homepage content blocks.', 0, 1),
  ('homepage.edit', 'homepage', 'edit', 'Edit Homepage', 'Edit homepage content.', 0, 1),
  ('homepage.delete', 'homepage', 'delete', 'Delete Homepage Content', 'Delete homepage content blocks.', 0, 1),
  ('pages.view', 'pages', 'view', 'View Pages', 'View custom website pages, policy pages, and landing pages.', 0, 1),
  ('pages.create', 'pages', 'create', 'Create Pages', 'Create custom website pages, policy pages, and landing pages.', 0, 1),
  ('pages.edit', 'pages', 'edit', 'Edit Pages', 'Edit custom page details, content blocks, SEO, visibility, and custom CSS.', 0, 1),
  ('pages.delete', 'pages', 'delete', 'Delete Pages', 'Delete custom pages and page content blocks.', 1, 1),
  ('pages.publish', 'pages', 'publish', 'Publish Pages', 'Publish custom pages and change live page status.', 1, 1),
  ('blogs.view', 'blogs', 'view', 'View Blogs', 'View blog articles and tags.', 0, 1),
  ('blogs.create', 'blogs', 'create', 'Create Blogs', 'Create blog articles and tags.', 0, 1),
  ('blogs.edit', 'blogs', 'edit', 'Edit Blogs', 'Edit blog articles, tags, SEO, and homepage placement.', 0, 1),
  ('blogs.delete', 'blogs', 'delete', 'Delete Blogs', 'Delete blog articles and tags.', 0, 1),
  ('blogs.publish', 'blogs', 'publish', 'Publish Blogs', 'Activate, inactivate, or publish blog articles.', 1, 1),
  ('reviews.view', 'reviews', 'view', 'View Reviews', 'View product reviews.', 0, 1),
  ('reviews.create', 'reviews', 'create', 'Create Reviews', 'Create admin review records.', 0, 1),
  ('reviews.edit', 'reviews', 'edit', 'Edit Reviews', 'Moderate or update reviews.', 0, 1),
  ('reviews.delete', 'reviews', 'delete', 'Delete Reviews', 'Delete product reviews.', 0, 1),
  ('reviews.export', 'reviews', 'export', 'Export Reviews', 'Export review records.', 0, 1),
  ('settings.view', 'settings', 'view', 'View Settings', 'View dashboard settings.', 0, 1),
  ('settings.edit', 'settings', 'edit', 'Edit Settings', 'Edit dashboard settings.', 0, 1),
  ('theme_settings.view', 'theme_settings', 'view', 'View Theme Settings', 'View website theme settings.', 0, 1),
  ('theme_settings.edit', 'theme_settings', 'edit', 'Edit Theme Settings', 'Edit website theme settings.', 0, 1),
  ('sensitive.manage_admin_users', 'sensitive_access', 'manage_admin_users', 'Manage admin users', 'Invite, edit, suspend, or remove dashboard users.', 1, 1),
  ('sensitive.manage_roles', 'sensitive_access', 'manage_roles', 'Manage roles', 'Change role structure and role-level access boundaries.', 1, 1),
  ('sensitive.manage_payment_settings', 'sensitive_access', 'manage_payment_settings', 'Manage payment settings', 'Modify payment methods and gateway behavior.', 1, 1),
  ('sensitive.process_refunds', 'sensitive_access', 'process_refunds', 'Process refunds', 'Trigger or approve refund-related order actions.', 1, 1),
  ('sensitive.export_customer_data', 'sensitive_access', 'export_customer_data', 'Export customer data', 'Download customer records and personal data.', 1, 1),
  ('sensitive.view_customer_contact', 'sensitive_access', 'view_customer_contact', 'View customer phone/email', 'View sensitive customer contact details.', 1, 1),
  ('sensitive.delete_orders', 'sensitive_access', 'delete_orders', 'Delete orders', 'Remove order records.', 1, 1),
  ('sensitive.change_payment_status', 'sensitive_access', 'change_payment_status', 'Change payment status', 'Alter paid, unpaid, failed, or refunded states.', 1, 1),
  ('sensitive.publish_homepage_changes', 'sensitive_access', 'publish_homepage_changes', 'Publish homepage changes', 'Push storefront homepage changes live.', 1, 1),
  ('sensitive.manage_api_keys', 'sensitive_access', 'manage_api_keys', 'Manage API keys', 'Create, rotate, or revoke integration keys.', 1, 1),
  ('sensitive.view_revenue_reports', 'sensitive_access', 'view_revenue_reports', 'View revenue reports', 'Access financial reporting and revenue summaries.', 1, 1)
ON DUPLICATE KEY UPDATE
  module_name = VALUES(module_name),
  action_name = VALUES(action_name),
  display_name = VALUES(display_name),
  description = VALUES(description),
  is_sensitive = VALUES(is_sensitive),
  is_available = VALUES(is_available);

INSERT INTO blog_tags (name, slug, status) VALUES
  ('Buying Guide', 'buying-guide', 'active'),
  ('Product Tips', 'product-tips', 'active'),
  ('Smart Living', 'smart-living', 'active'),
  ('Audio Guide', 'audio-guide', 'active'),
  ('Camera Guide', 'camera-guide', 'active'),
  ('Home Security', 'home-security', 'active'),
  ('Gift Ideas', 'gift-ideas', 'active')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  status = VALUES(status);

INSERT INTO role_permissions
  (role_id, module_name, can_view, can_create, can_edit, can_delete, can_export, can_approve)
SELECT r.id, module_name, 1, 1, 1, 1, 1, 1
FROM roles r
JOIN (
  SELECT 'dashboard' AS module_name UNION ALL
  SELECT 'products' UNION ALL
  SELECT 'categories' UNION ALL
  SELECT 'brands' UNION ALL
  SELECT 'variations' UNION ALL
  SELECT 'orders' UNION ALL
  SELECT 'customers' UNION ALL
  SELECT 'contact_enquiries' UNION ALL
  SELECT 'coupons' UNION ALL
  SELECT 'credit_points' UNION ALL
  SELECT 'homepage' UNION ALL
  SELECT 'pages' UNION ALL
  SELECT 'blogs' UNION ALL
  SELECT 'reviews' UNION ALL
  SELECT 'settings' UNION ALL
  SELECT 'theme_settings' UNION ALL
  SELECT 'sensitive_access'
) modules
WHERE r.name = 'super_admin'
ON DUPLICATE KEY UPDATE
  can_view = VALUES(can_view),
  can_create = VALUES(can_create),
  can_edit = VALUES(can_edit),
  can_delete = VALUES(can_delete),
  can_export = VALUES(can_export),
  can_approve = VALUES(can_approve);

INSERT INTO role_permissions
  (role_id, module_name, can_view, can_create, can_edit, can_delete, can_export, can_approve)
SELECT r.id, defaults.module_name, defaults.can_view, defaults.can_create, defaults.can_edit, defaults.can_delete, defaults.can_export, defaults.can_approve
FROM roles r
JOIN (
  SELECT 'admin' AS role_name, 'dashboard' AS module_name, 1 AS can_view, 0 AS can_create, 0 AS can_edit, 0 AS can_delete, 0 AS can_export, 0 AS can_approve UNION ALL
  SELECT 'admin', 'products', 1, 1, 1, 1, 1, 0 UNION ALL
  SELECT 'admin', 'categories', 1, 1, 1, 1, 1, 0 UNION ALL
  SELECT 'admin', 'brands', 1, 1, 1, 1, 1, 0 UNION ALL
  SELECT 'admin', 'variations', 1, 1, 1, 1, 1, 0 UNION ALL
  SELECT 'admin', 'orders', 1, 1, 1, 0, 1, 0 UNION ALL
  SELECT 'admin', 'customers', 1, 0, 1, 0, 1, 0 UNION ALL
  SELECT 'admin', 'contact_enquiries', 1, 0, 1, 1, 1, 0 UNION ALL
  SELECT 'admin', 'coupons', 1, 1, 1, 1, 1, 0 UNION ALL
  SELECT 'admin', 'credit_points', 1, 1, 1, 1, 1, 0 UNION ALL
  SELECT 'admin', 'homepage', 1, 1, 1, 1, 0, 0 UNION ALL
  SELECT 'admin', 'pages', 1, 1, 1, 1, 0, 1 UNION ALL
  SELECT 'admin', 'blogs', 1, 1, 1, 1, 0, 1 UNION ALL
  SELECT 'admin', 'reviews', 1, 1, 1, 1, 1, 0 UNION ALL
  SELECT 'admin', 'settings', 1, 0, 1, 0, 0, 0 UNION ALL
  SELECT 'admin', 'theme_settings', 1, 0, 1, 0, 0, 0 UNION ALL
  SELECT 'product_manager', 'dashboard', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'product_manager', 'products', 1, 1, 1, 1, 1, 0 UNION ALL
  SELECT 'product_manager', 'categories', 1, 1, 1, 1, 1, 0 UNION ALL
  SELECT 'product_manager', 'brands', 1, 1, 1, 1, 1, 0 UNION ALL
  SELECT 'product_manager', 'variations', 1, 1, 1, 1, 1, 0 UNION ALL
  SELECT 'product_manager', 'homepage', 1, 0, 1, 0, 0, 0 UNION ALL
  SELECT 'product_manager', 'pages', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'product_manager', 'blogs', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'order_manager', 'dashboard', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'order_manager', 'orders', 1, 1, 1, 0, 1, 0 UNION ALL
  SELECT 'order_manager', 'customers', 1, 0, 1, 0, 0, 0 UNION ALL
  SELECT 'order_manager', 'contact_enquiries', 1, 0, 1, 0, 0, 0 UNION ALL
  SELECT 'marketing_manager', 'dashboard', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'marketing_manager', 'coupons', 1, 1, 1, 1, 1, 0 UNION ALL
  SELECT 'marketing_manager', 'credit_points', 1, 1, 1, 0, 1, 0 UNION ALL
  SELECT 'marketing_manager', 'homepage', 1, 1, 1, 1, 0, 0 UNION ALL
  SELECT 'marketing_manager', 'pages', 1, 1, 1, 1, 0, 1 UNION ALL
  SELECT 'marketing_manager', 'blogs', 1, 1, 1, 1, 0, 1 UNION ALL
  SELECT 'marketing_manager', 'reviews', 1, 1, 1, 1, 1, 0 UNION ALL
  SELECT 'support_staff', 'dashboard', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'support_staff', 'orders', 1, 0, 1, 0, 0, 0 UNION ALL
  SELECT 'support_staff', 'customers', 1, 0, 1, 0, 0, 0 UNION ALL
  SELECT 'support_staff', 'contact_enquiries', 1, 0, 1, 0, 0, 0 UNION ALL
  SELECT 'viewer', 'dashboard', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'viewer', 'products', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'viewer', 'categories', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'viewer', 'brands', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'viewer', 'variations', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'viewer', 'orders', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'viewer', 'customers', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'viewer', 'contact_enquiries', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'viewer', 'coupons', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'viewer', 'credit_points', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'viewer', 'homepage', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'viewer', 'pages', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'viewer', 'blogs', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'viewer', 'reviews', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'viewer', 'settings', 1, 0, 0, 0, 0, 0 UNION ALL
  SELECT 'viewer', 'theme_settings', 1, 0, 0, 0, 0, 0
) defaults ON defaults.role_name = r.name
ON DUPLICATE KEY UPDATE
  can_view = VALUES(can_view),
  can_create = VALUES(can_create),
  can_edit = VALUES(can_edit),
  can_delete = VALUES(can_delete),
  can_export = VALUES(can_export),
  can_approve = VALUES(can_approve);

INSERT INTO admin_roles (admin_id, role_id)
SELECT a.id, r.id
FROM admins a
JOIN roles r ON r.name = 'super_admin'
WHERE a.email = 'sourab@thedoveberry.com'
ON DUPLICATE KEY UPDATE admin_id = VALUES(admin_id);

INSERT INTO app_settings (setting_key, setting_value, setting_group)
VALUES
  ('store_name', 'Avyona', 'general'),
  ('store_logo_url', '/uploads/settings/1778912520806-avyona-logo-2.png', 'general'),
  ('favicon_url', '/favicon.ico', 'general'),
  ('brand_tagline', 'Style that moves with you', 'general'),
  ('business_name', 'Avyona', 'general'),
  ('support_email', 'support@avyona.com', 'general'),
  ('support_phone', '+91 98765 43210', 'general'),
  ('business_address', 'Bengaluru, Karnataka, India', 'general'),
  ('gst_number', '29ABCDE1234F1Z5', 'general'),
  ('working_hours', 'Monday to Saturday, 10:00 AM to 7:00 PM', 'general'),
  ('store__defaultCurrency', 'INR', 'store'),
  ('store__currencyFormat', 'INR 1,999.00', 'store'),
  ('store__taxInclusion', 'inclusive', 'store'),
  ('store__defaultLanguage', 'English', 'store'),
  ('store__timezone', 'Asia/Kolkata', 'store'),
  ('store__guestCheckoutEnabled', 'true', 'store'),
  ('store__accountCreationEnabled', 'true', 'store'),
  ('payment__codEnabled', 'true', 'payment'),
  ('payment__razorpayEnabled', 'true', 'payment'),
  ('payment__stripeEnabled', 'false', 'payment'),
  ('payment__upiWalletEnabled', 'true', 'payment'),
  ('shipping__deliveryZones', 'India-wide with metro priority zones', 'shipping'),
  ('shipping__deliveryTime', '3 to 5 business days', 'shipping'),
  ('shipping__dispatchTime', '24 to 48 hours', 'shipping'),
  ('shipping__pincodeServiceability', 'Enabled for supported pin codes', 'shipping')
ON DUPLICATE KEY UPDATE
  setting_value = VALUES(setting_value),
  setting_group = VALUES(setting_group);

DELETE FROM app_settings
WHERE setting_key IN ('shipping__shippingCharges', 'shipping__freeShippingThreshold');

INSERT INTO categories (
  name,
  slug,
  parent_id,
  description,
  image_url,
  banner_image_url,
  status,
  show_in_menu,
  featured_category,
  sort_order,
  meta_title,
  meta_description,
  meta_keywords
) VALUES
('Personal Audio', 'personal-audio', NULL, 'Headphones, earbuds, and neckbands for daily listening.', '/uploads/1778905681611-1.jpg', '/uploads/1778905676761-2.jpg', 'active', 1, 1, 1, 'Personal Audio Collection | Avyona', 'Shop personal audio products including headphones, earbuds, and neckbands.', 'personal audio, headphones, earbuds, neckbands'),
('Professional Audio', 'professional-audio', NULL, 'Creator and studio-style audio gear.', '/uploads/1778905690894-2.jpg', '/uploads/1778905694351-1.jpg', 'active', 1, 1, 2, 'Professional Audio Collection | Avyona', 'Discover microphones, monitors, and creator-focused professional audio gear.', 'professional audio, studio audio, creator gear'),
('Digital Camera', 'digital-camera', NULL, 'Compact and creator-friendly digital cameras.', '/uploads/1778905725221-3.jpg', '/uploads/1778905722313-3.jpg', 'active', 1, 1, 3, 'Digital Camera Collection | Avyona', 'Browse digital cameras for travel, family, and creator use.', 'digital camera, compact camera, creator camera'),
('Security Camera', 'security-camera', NULL, 'Indoor and outdoor smart camera setups.', '/uploads/1778905743764-4.jpg', '/uploads/1778905747088-4.jpg', 'active', 1, 0, 4, 'Security Camera Collection | Avyona', 'Explore indoor and outdoor security camera collections.', 'security camera, smart camera, surveillance'),
('Avyona Digital Photo Frames', 'digital-photo-frames', NULL, 'Smart digital frames for gifting and family memories.', '/uploads/1778905660564-web-category-image.jpg', '/uploads/1778905663964-web-category-banner-image.jpg', 'active', 1, 1, 5, 'Digital Photo Frames Collection | Avyona', 'Shop digital photo frames for gifting, family sharing, and home display.', 'digital photo frame, smart frame, gifting frame'),
('Reading Light', 'reading-light', NULL, 'Portable and bedside reading lights.', '/uploads/1778905761612-5.jpg', '/uploads/1778905758847-5.jpg', 'active', 1, 0, 6, 'Reading Light Collection | Avyona', 'Find clip-on and bedside reading lights for everyday use.', 'reading light, bedside lamp, clip light')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  parent_id = VALUES(parent_id),
  description = VALUES(description),
  image_url = VALUES(image_url),
  banner_image_url = VALUES(banner_image_url),
  status = VALUES(status),
  show_in_menu = VALUES(show_in_menu),
  featured_category = VALUES(featured_category),
  sort_order = VALUES(sort_order),
  meta_title = VALUES(meta_title),
  meta_description = VALUES(meta_description),
  meta_keywords = VALUES(meta_keywords),
  is_active = IF(VALUES(status) = 'active', 1, 0);

INSERT INTO categories (
  name,
  slug,
  parent_id,
  description,
  image_url,
  banner_image_url,
  status,
  show_in_menu,
  featured_category,
  sort_order,
  meta_title,
  meta_description,
  meta_keywords
)
SELECT
  'Earbuds',
  'earbuds',
  parent.id,
  'Wireless and everyday earbuds under Personal Audio.',
  '/uploads/1778905681611-1.jpg',
  '/uploads/1778905676761-2.jpg',
  'active',
  1,
  0,
  11,
  'Earbuds Collection | Avyona',
  'Browse earbuds under the Personal Audio collection.',
  'earbuds, wireless earbuds, personal audio'
FROM categories parent
WHERE parent.slug = 'personal-audio'
ON DUPLICATE KEY UPDATE
  parent_id = VALUES(parent_id),
  description = VALUES(description),
  image_url = VALUES(image_url),
  banner_image_url = VALUES(banner_image_url),
  status = VALUES(status),
  show_in_menu = VALUES(show_in_menu),
  featured_category = VALUES(featured_category),
  sort_order = VALUES(sort_order),
  meta_title = VALUES(meta_title),
  meta_description = VALUES(meta_description),
  meta_keywords = VALUES(meta_keywords),
  is_active = IF(VALUES(status) = 'active', 1, 0);

INSERT INTO categories (
  name,
  slug,
  parent_id,
  description,
  image_url,
  banner_image_url,
  status,
  show_in_menu,
  featured_category,
  sort_order,
  meta_title,
  meta_description,
  meta_keywords
)
SELECT
  'Headphones',
  'headphones',
  parent.id,
  'Over-ear and on-ear headphones under Personal Audio.',
  '/uploads/1778905681611-1.jpg',
  '/uploads/1778905676761-2.jpg',
  'active',
  1,
  0,
  12,
  'Headphones Collection | Avyona',
  'Browse headphones under the Personal Audio collection.',
  'headphones, wireless headphones, personal audio'
FROM categories parent
WHERE parent.slug = 'personal-audio'
ON DUPLICATE KEY UPDATE
  parent_id = VALUES(parent_id),
  description = VALUES(description),
  image_url = VALUES(image_url),
  banner_image_url = VALUES(banner_image_url),
  status = VALUES(status),
  show_in_menu = VALUES(show_in_menu),
  featured_category = VALUES(featured_category),
  sort_order = VALUES(sort_order),
  meta_title = VALUES(meta_title),
  meta_description = VALUES(meta_description),
  meta_keywords = VALUES(meta_keywords),
  is_active = IF(VALUES(status) = 'active', 1, 0);

INSERT INTO categories (
  name,
  slug,
  parent_id,
  description,
  image_url,
  banner_image_url,
  status,
  show_in_menu,
  featured_category,
  sort_order,
  meta_title,
  meta_description,
  meta_keywords
)
SELECT
  'DSLR Cameras',
  'dslr-cameras',
  parent.id,
  'DSLR camera collection under Digital Camera.',
  '/uploads/1778905725221-3.jpg',
  '/uploads/1778905722313-3.jpg',
  'active',
  1,
  0,
  31,
  'DSLR Cameras Collection | Avyona',
  'Explore DSLR camera options under the Digital Camera collection.',
  'dslr cameras, digital camera, photography'
FROM categories parent
WHERE parent.slug = 'digital-camera'
ON DUPLICATE KEY UPDATE
  parent_id = VALUES(parent_id),
  description = VALUES(description),
  image_url = VALUES(image_url),
  banner_image_url = VALUES(banner_image_url),
  status = VALUES(status),
  show_in_menu = VALUES(show_in_menu),
  featured_category = VALUES(featured_category),
  sort_order = VALUES(sort_order),
  meta_title = VALUES(meta_title),
  meta_description = VALUES(meta_description),
  meta_keywords = VALUES(meta_keywords),
  is_active = IF(VALUES(status) = 'active', 1, 0);

INSERT INTO brands (name, slug, logo_url, description, country, is_authorized, status, sort_order) VALUES
  ('Avyona', 'avyona', '/images/optimized/avyona-logo.webp', 'Avyona owned and curated electronics products.', 'India', 1, 'active', 1),
  ('Sony', 'sony', '/images/optimized/sony.webp', 'Audio and creator electronics from Sony.', 'Japan', 1, 'active', 2),
  ('Kodak', 'kodak', '/images/optimized/kodak.webp', 'Camera and imaging products from Kodak.', 'United States', 1, 'active', 3),
  ('JBL', 'jbl', '/images/optimized/jbl.webp', 'Consumer audio products from JBL.', 'United States', 1, 'active', 4),
  ('AKG', 'akg', '/images/optimized/akg.webp', 'Professional and studio audio products from AKG.', 'Austria', 1, 'active', 5),
  ('Wyze', 'wyze', '/images/optimized/wyze.webp', 'Smart home and security camera products from Wyze.', 'United States', 1, 'active', 6),
  ('Glocusent', 'glocusent', '/images/optimized/glocuent.webp', 'Reading lights and personal utility electronics.', 'United States', 1, 'active', 7)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  logo_url = VALUES(logo_url),
  description = VALUES(description),
  country = VALUES(country),
  is_authorized = VALUES(is_authorized),
  status = VALUES(status),
  sort_order = VALUES(sort_order);

INSERT INTO products
  (category_id, asin, name, slug, brand, short_description, description, price, mrp, stock_quantity, rating, review_count, image_url, status)
SELECT c.id, 'B0000AURA10', 'Avyona Aura 10 Frame', 'avyona-aura-10-frame', 'Avyona',
  '10.1-inch HD IPS touchscreen frame',
  'Connected digital photo frame with app sharing, auto rotate, and built-in storage.',
  8999, 9999, 16, 4.90, 214, '/images/optimized/frame-2.webp', 'active'
FROM categories c
WHERE c.slug = 'digital-photo-frames'
ON DUPLICATE KEY UPDATE
  asin = VALUES(asin),
  category_id = VALUES(category_id),
  price = VALUES(price),
  mrp = VALUES(mrp),
  stock_quantity = VALUES(stock_quantity),
  status = VALUES(status);

INSERT INTO products
  (category_id, asin, name, slug, brand, short_description, description, price, mrp, stock_quantity, rating, review_count, image_url, status)
SELECT c.id, 'B0000KODAK1', 'Kodak ZoomLite Camera', 'kodak-zoomlite-camera', 'Kodak',
  'Travel-friendly compact digital camera',
  'Simple digital camera for family use, travel, and everyday capture.',
  18499, 20999, 11, 4.60, 84, '/images/optimized/camera-1.webp', 'active'
FROM categories c
WHERE c.slug = 'digital-camera'
ON DUPLICATE KEY UPDATE
  asin = VALUES(asin),
  category_id = VALUES(category_id),
  price = VALUES(price),
  mrp = VALUES(mrp),
  stock_quantity = VALUES(stock_quantity),
  status = VALUES(status);

UPDATE products p
JOIN brands b ON LOWER(b.name) = LOWER(p.brand)
SET p.brand_id = b.id
WHERE p.brand_id IS NULL;

INSERT INTO customers (full_name, email, phone, city, state, total_orders, total_spent) VALUES
('Rahul Mehta', 'rahul@example.com', '9876543210', 'Hyderabad', 'Telangana', 2, 16498),
('Priya Sharma', 'priya@example.com', '9123456780', 'Bengaluru', 'Karnataka', 1, 8999)
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  phone = VALUES(phone),
  city = VALUES(city),
  state = VALUES(state),
  total_orders = VALUES(total_orders),
  total_spent = VALUES(total_spent);

INSERT INTO orders
  (customer_id, order_number, status, payment_status, payment_method, courier_name, expected_delivery_date, subtotal, shipping_fee, total_amount)
SELECT c.id, 'AVY-1001', 'shipped', 'paid', 'PhonePe', 'Blue Dart', '2026-04-24 18:00:00', 8999, 0, 8999
FROM customers c
WHERE c.email = 'rahul@example.com'
ON DUPLICATE KEY UPDATE
  customer_id = VALUES(customer_id),
  status = VALUES(status),
  payment_status = VALUES(payment_status),
  payment_method = VALUES(payment_method),
  courier_name = VALUES(courier_name),
  expected_delivery_date = VALUES(expected_delivery_date),
  subtotal = VALUES(subtotal),
  shipping_fee = VALUES(shipping_fee),
  total_amount = VALUES(total_amount);

INSERT INTO orders
  (customer_id, order_number, status, payment_status, payment_method, courier_name, expected_delivery_date, subtotal, shipping_fee, total_amount)
SELECT c.id, 'AVY-1002', 'confirmed', 'cod_pending', 'Cash on Delivery', NULL, '2026-04-27 20:00:00', 8346, 0, 8346
FROM customers c
WHERE c.email = 'priya@example.com'
ON DUPLICATE KEY UPDATE
  customer_id = VALUES(customer_id),
  status = VALUES(status),
  payment_status = VALUES(payment_status),
  payment_method = VALUES(payment_method),
  courier_name = VALUES(courier_name),
  expected_delivery_date = VALUES(expected_delivery_date),
  subtotal = VALUES(subtotal),
  shipping_fee = VALUES(shipping_fee),
  total_amount = VALUES(total_amount);

INSERT INTO order_addresses
  (order_id, address_type, full_name, email, phone, line1, line2, landmark, city, state, pincode, country)
SELECT o.id, 'delivery', 'Rahul Mehta', 'rahul@example.com', '9876543210', 'Flat 402, Lakeview Residency', 'Madhapur', 'Near Inorbit Mall', 'Hyderabad', 'Telangana', '500081', 'India'
FROM orders o
WHERE o.order_number = 'AVY-1001'
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  email = VALUES(email),
  phone = VALUES(phone),
  line1 = VALUES(line1),
  line2 = VALUES(line2),
  landmark = VALUES(landmark),
  city = VALUES(city),
  state = VALUES(state),
  pincode = VALUES(pincode),
  country = VALUES(country);

INSERT INTO order_addresses
  (order_id, address_type, full_name, email, phone, line1, line2, landmark, city, state, pincode, country)
SELECT o.id, 'delivery', 'Priya Sharma', 'priya@example.com', '9123456780', '22, Green Park Avenue', NULL, 'Whitefield Main Road', 'Bengaluru', 'Karnataka', '560066', 'India'
FROM orders o
WHERE o.order_number = 'AVY-1002'
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  email = VALUES(email),
  phone = VALUES(phone),
  line1 = VALUES(line1),
  line2 = VALUES(line2),
  landmark = VALUES(landmark),
  city = VALUES(city),
  state = VALUES(state),
  pincode = VALUES(pincode),
  country = VALUES(country);

INSERT INTO order_status_timeline (order_id, status, title, note, event_time)
SELECT o.id, 'confirmed', 'Order placed', 'Customer completed checkout successfully.', '2026-04-18 10:25:00'
FROM orders o
WHERE o.order_number = 'AVY-1001'
  AND NOT EXISTS (
    SELECT 1
    FROM order_status_timeline t
    WHERE t.order_id = o.id
      AND t.status = 'confirmed'
      AND t.event_time = '2026-04-18 10:25:00'
  );

INSERT INTO order_status_timeline (order_id, status, title, note, event_time)
SELECT o.id, 'paid', 'Payment captured', 'PhonePe payment confirmed.', '2026-04-18 10:27:00'
FROM orders o
WHERE o.order_number = 'AVY-1001'
  AND NOT EXISTS (
    SELECT 1
    FROM order_status_timeline t
    WHERE t.order_id = o.id
      AND t.status = 'paid'
      AND t.event_time = '2026-04-18 10:27:00'
  );

INSERT INTO order_status_timeline (order_id, status, title, note, event_time)
SELECT o.id, 'packed', 'Packed', 'Warehouse packed the order.', '2026-04-19 09:40:00'
FROM orders o
WHERE o.order_number = 'AVY-1001'
  AND NOT EXISTS (
    SELECT 1
    FROM order_status_timeline t
    WHERE t.order_id = o.id
      AND t.status = 'packed'
      AND t.event_time = '2026-04-19 09:40:00'
  );

INSERT INTO order_status_timeline (order_id, status, title, note, event_time)
SELECT o.id, 'shipped', 'Shipped', 'Shipment handed over to courier partner.', '2026-04-20 14:15:00'
FROM orders o
WHERE o.order_number = 'AVY-1001'
  AND NOT EXISTS (
    SELECT 1
    FROM order_status_timeline t
    WHERE t.order_id = o.id
      AND t.status = 'shipped'
      AND t.event_time = '2026-04-20 14:15:00'
  );

INSERT INTO order_status_timeline (order_id, status, title, note, event_time)
SELECT o.id, 'confirmed', 'Order placed', 'COD order placed from website.', '2026-04-19 16:40:00'
FROM orders o
WHERE o.order_number = 'AVY-1002'
  AND NOT EXISTS (
    SELECT 1
    FROM order_status_timeline t
    WHERE t.order_id = o.id
      AND t.status = 'confirmed'
      AND t.event_time = '2026-04-19 16:40:00'
  );

INSERT INTO order_status_timeline (order_id, status, title, note, event_time)
SELECT o.id, 'confirmed', 'Order verified', 'Customer verified by support team.', '2026-04-19 16:55:00'
FROM orders o
WHERE o.order_number = 'AVY-1002'
  AND NOT EXISTS (
    SELECT 1
    FROM order_status_timeline t
    WHERE t.order_id = o.id
      AND t.title = 'Order verified'
      AND t.event_time = '2026-04-19 16:55:00'
  );

INSERT INTO coupons (
  code,
  title,
  description,
  discount_type,
  discount_value,
  minimum_order_amount,
  maximum_discount_amount,
  usage_limit,
  used_count,
  starts_at,
  ends_at,
  status
) VALUES
  ('SUMMER15', 'Summer Sale', '15% off on personal audio, digital cameras, and reading lights.', 'percentage', 15, 4999, 2500, 500, 126, '2026-04-01 00:00:00', '2026-06-30 23:59:59', 'active'),
  ('FIRST12', 'First Purchase', '12% off for new shoppers across eligible in-stock products.', 'percentage', 12, 2999, 1500, 1000, 284, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'active'),
  ('BUNDLE20', 'Bundle Sale', '20% off selected home setup and creator products.', 'percentage', 20, 9999, 4000, 300, 91, '2026-03-01 00:00:00', '2026-08-31 23:59:59', 'active'),
  ('AVYONA500', 'Flat Savings', 'Flat discount for carts above INR 6999.', 'fixed', 500, 6999, 500, 750, 212, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'active')
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  discount_type = VALUES(discount_type),
  discount_value = VALUES(discount_value),
  minimum_order_amount = VALUES(minimum_order_amount),
  maximum_discount_amount = VALUES(maximum_discount_amount),
  usage_limit = VALUES(usage_limit),
  used_count = VALUES(used_count),
  starts_at = VALUES(starts_at),
  ends_at = VALUES(ends_at),
  status = VALUES(status);
