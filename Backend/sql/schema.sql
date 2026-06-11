CREATE DATABASE IF NOT EXISTS avyona_admin;
USE avyona_admin;

CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin', 'admin', 'product_manager', 'order_manager', 'marketing_manager', 'support_staff', 'viewer', 'editor') NOT NULL DEFAULT 'admin',
  status ENUM('active', 'inactive', 'suspended', 'invite_pending') NOT NULL DEFAULT 'active',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  invited_at DATETIME NULL,
  invite_token_hash VARCHAR(255) NULL,
  invite_expires_at DATETIME NULL,
  password_reset_token_hash VARCHAR(255) NULL,
  password_reset_expires_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE admins ADD COLUMN phone VARCHAR(30) NULL;
ALTER TABLE admins ADD COLUMN status ENUM('active', 'inactive', 'suspended', 'invite_pending') NOT NULL DEFAULT 'active';
ALTER TABLE admins ADD COLUMN last_login_at DATETIME NULL;
ALTER TABLE admins ADD COLUMN invited_at DATETIME NULL;
ALTER TABLE admins ADD COLUMN invite_token_hash VARCHAR(255) NULL;
ALTER TABLE admins ADD COLUMN invite_expires_at DATETIME NULL;
ALTER TABLE admins ADD COLUMN password_reset_token_hash VARCHAR(255) NULL;
ALTER TABLE admins ADD COLUMN password_reset_expires_at DATETIME NULL;
ALTER TABLE admins MODIFY COLUMN role ENUM('super_admin', 'admin', 'product_manager', 'order_manager', 'marketing_manager', 'support_staff', 'viewer', 'editor') NOT NULL DEFAULT 'admin';

CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  display_name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 1,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE roles ADD COLUMN is_system TINYINT(1) NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS permissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  permission_key VARCHAR(140) NOT NULL UNIQUE,
  module_name VARCHAR(80) NOT NULL,
  action_name VARCHAR(80) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  is_sensitive TINYINT(1) NOT NULL DEFAULT 0,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_permissions_module_action (module_name, action_name)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  role_id INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NULL,
  module_name VARCHAR(80) NOT NULL,
  can_view TINYINT(1) NOT NULL DEFAULT 0,
  can_create TINYINT(1) NOT NULL DEFAULT 0,
  can_edit TINYINT(1) NOT NULL DEFAULT 0,
  can_delete TINYINT(1) NOT NULL DEFAULT 0,
  can_export TINYINT(1) NOT NULL DEFAULT 0,
  can_approve TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_role_permission_module (role_id, module_name),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE SET NULL
);

ALTER TABLE role_permissions ADD COLUMN permission_id INT UNSIGNED NULL;
ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS admin_roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED NOT NULL,
  role_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_role (admin_id, role_id),
  CONSTRAINT fk_admin_roles_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
  CONSTRAINT fk_admin_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_custom_permissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  effect ENUM('allow', 'deny') NOT NULL DEFAULT 'allow',
  reason VARCHAR(255) NULL,
  assigned_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_custom_permission (admin_id, permission_id),
  CONSTRAINT fk_user_custom_permissions_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_custom_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_custom_permissions_assigned_by FOREIGN KEY (assigned_by) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS admin_login_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  refresh_token_hash VARCHAR(255) NULL,
  ip_address VARCHAR(64) NULL,
  user_agent TEXT NULL,
  device_label VARCHAR(160) NULL,
  status ENUM('active', 'revoked', 'expired') NOT NULL DEFAULT 'active',
  expires_at DATETIME NOT NULL,
  last_used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  CONSTRAINT fk_admin_login_sessions_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contact_enquiries (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  enquiry_type ENUM('B2C', 'B2B') NOT NULL,
  name VARCHAR(160) NOT NULL,
  company_name VARCHAR(180) NULL,
  email VARCHAR(180) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  order_id VARCHAR(80) NULL,
  message TEXT NOT NULL,
  status ENUM('New', 'In Progress', 'Resolved', 'Closed') NOT NULL DEFAULT 'New',
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_contact_enquiries_status_created (status, created_at),
  KEY idx_contact_enquiries_type_created (enquiry_type, created_at),
  KEY idx_contact_enquiries_deleted_created (is_deleted, created_at)
);

CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  parent_id INT UNSIGNED NULL,
  description TEXT NULL,
  image_url VARCHAR(255) NULL,
  banner_image_url VARCHAR(255) NULL,
  icon_url VARCHAR(255) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  show_in_menu TINYINT(1) NOT NULL DEFAULT 1,
  featured_category TINYINT(1) NOT NULL DEFAULT 0,
  category_discount_label VARCHAR(120) NULL,
  dynamic_rule_json JSON NULL,
  sort_order INT NOT NULL DEFAULT 0,
  meta_title VARCHAR(180) NULL,
  meta_description TEXT NULL,
  meta_keywords TEXT NULL,
  cod_enabled TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS brands (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  logo_url VARCHAR(500) NULL,
  description TEXT NULL,
  country VARCHAR(80) NULL,
  is_authorized TINYINT(1) NOT NULL DEFAULT 1,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS variant_groups (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  group_id VARCHAR(24) NULL UNIQUE,
  group_name VARCHAR(180) NOT NULL,
  variant_type VARCHAR(80) NOT NULL,
  status ENUM('draft', 'saved') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  brand_id INT UNSIGNED NULL,
  variant_group_id INT UNSIGNED NULL,
  asin VARCHAR(32) NOT NULL,
  sku VARCHAR(80) NULL,
  barcode VARCHAR(80) NULL,
  model_number VARCHAR(120) NULL,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  brand VARCHAR(120) NOT NULL,
  short_description VARCHAR(255) NULL,
  description TEXT NULL,
  price DECIMAL(10, 2) NOT NULL,
  mrp DECIMAL(10, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  tax_included TINYINT(1) NOT NULL DEFAULT 1,
  tax_rate DECIMAL(6, 2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(10, 2) NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 5,
  reserved_stock INT NOT NULL DEFAULT 0,
  sold_quantity INT NOT NULL DEFAULT 0,
  rating DECIMAL(3, 2) NOT NULL DEFAULT 0,
  review_count INT NOT NULL DEFAULT 0,
  image_url VARCHAR(255) NULL,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  is_new_arrival TINYINT(1) NOT NULL DEFAULT 0,
  is_best_seller TINYINT(1) NOT NULL DEFAULT 0,
  is_visible TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  status ENUM('draft', 'active', 'archived', 'out_of_stock') NOT NULL DEFAULT 'draft',
  stock_status VARCHAR(20) GENERATED ALWAYS AS (
    CASE
      WHEN stock_quantity <= 0 OR status = 'out_of_stock' THEN 'out-of-stock'
      WHEN stock_quantity <= low_stock_threshold THEN 'low-stock'
      ELSE 'in-stock'
    END
  ) STORED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_products_asin (asin),
  UNIQUE KEY uq_products_sku (sku),
  UNIQUE KEY uq_products_slug (slug),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_products_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL,
  CONSTRAINT fk_products_variant_group FOREIGN KEY (variant_group_id) REFERENCES variant_groups(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS variant_group_products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  variant_group_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_variant_group_product (variant_group_id, product_id),
  CONSTRAINT fk_variant_group_products_group FOREIGN KEY (variant_group_id) REFERENCES variant_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_variant_group_products_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  relation_type ENUM('primary', 'secondary') NOT NULL DEFAULT 'secondary',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_product_category_relation (product_id, category_id),
  CONSTRAINT fk_product_categories_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_product_categories_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_media (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  media_type ENUM('image', 'video') NOT NULL DEFAULT 'image',
  url VARCHAR(500) NOT NULL,
  alt_text VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_media_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_variants (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  variant_type VARCHAR(80) NOT NULL,
  variant_value VARCHAR(120) NOT NULL,
  sku VARCHAR(80) NULL,
  asin VARCHAR(32) NULL,
  price DECIMAL(10, 2) NULL,
  mrp DECIMAL(10, 2) NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  image_url VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_highlights (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  highlight_text VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_highlights_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_spec_groups (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  group_name VARCHAR(140) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_spec_groups_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_spec_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  spec_group_id INT UNSIGNED NOT NULL,
  spec_label VARCHAR(140) NOT NULL,
  spec_value TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_spec_items_group FOREIGN KEY (spec_group_id) REFERENCES product_spec_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_related_products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  related_product_id INT UNSIGNED NOT NULL,
  relation_type ENUM('manual', 'auto') NOT NULL DEFAULT 'manual',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_product_related_product (product_id, related_product_id),
  CONSTRAINT fk_product_related_source FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_product_related_target FOREIGN KEY (related_product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_policy_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  policy_title VARCHAR(140) NOT NULL,
  policy_body TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_policy_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_faqs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  question VARCHAR(255) NOT NULL,
  answer TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_faqs_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NULL,
  status ENUM('active', 'inactive', 'blocked') NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  city VARCHAR(120) NULL,
  state VARCHAR(120) NULL,
  total_orders INT NOT NULL DEFAULT 0,
  total_spent DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE customers ADD COLUMN password_hash VARCHAR(255) NULL;
ALTER TABLE customers ADD COLUMN status ENUM('active', 'inactive', 'blocked') NOT NULL DEFAULT 'active';
ALTER TABLE customers ADD COLUMN last_login_at DATETIME NULL;

CREATE TABLE IF NOT EXISTS customer_business_details (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  is_business_account TINYINT(1) NOT NULL DEFAULT 0,
  business_name VARCHAR(180) NULL,
  gst_number VARCHAR(20) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customer_business_customer (customer_id),
  INDEX idx_customer_business_gst (gst_number),
  CONSTRAINT fk_customer_business_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customer_password_resets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customer_password_resets_token (token_hash),
  CONSTRAINT fk_customer_password_resets_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customer_addresses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  address_type VARCHAR(40) NOT NULL DEFAULT 'Home',
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NULL,
  line1 VARCHAR(180) NOT NULL,
  line2 VARCHAR(180) NULL,
  city VARCHAR(120) NOT NULL,
  state VARCHAR(120) NOT NULL,
  pincode VARCHAR(20) NOT NULL,
  country VARCHAR(80) NOT NULL DEFAULT 'India',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_customer_addresses_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS carts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NULL,
  session_id VARCHAR(120) NULL,
  status ENUM('active', 'converted', 'abandoned') NOT NULL DEFAULT 'active',
  coupon_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_carts_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cart_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  cart_id BIGINT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  variant_id INT UNSIGNED NULL,
  quantity INT NOT NULL DEFAULT 1,
  price_at_time DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cart_product_variant (cart_id, product_id, variant_id),
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS wishlists (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NULL,
  session_id VARCHAR(120) NULL,
  product_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wishlist_customer_product (customer_id, product_id),
  CONSTRAINT fk_wishlists_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_wishlists_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  customer_id INT UNSIGNED NULL,
  rating TINYINT UNSIGNED NOT NULL,
  title VARCHAR(180) NULL,
  review_text TEXT NULL,
  media_json JSON NULL,
  is_verified_purchase TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  admin_reply TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_product_reviews_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS product_search_attributes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  keywords TEXT NULL,
  tags_json JSON NULL,
  filter_group VARCHAR(120) NULL,
  filter_value VARCHAR(180) NULL,
  attribute_name VARCHAR(120) NULL,
  attribute_value VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_search_attributes_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NULL,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  status ENUM('pending', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned') NOT NULL DEFAULT 'pending',
  payment_status ENUM('pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded', 'cod_pending') NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(50) NOT NULL,
  payment_gateway VARCHAR(50) NULL,
  razorpay_order_id VARCHAR(160) NULL,
  razorpay_payment_id VARCHAR(160) NULL,
  payment_signature VARCHAR(255) NULL,
  paid_at DATETIME NULL,
  payment_error TEXT NULL,
  courier_name VARCHAR(120) NULL,
  expected_delivery_date DATETIME NULL,
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  shipping_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  coupon_code VARCHAR(50) NULL,
  coupon_discount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  credit_discount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NULL,
  product_name VARCHAR(160) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  product_mrp DECIMAL(10, 2) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_addresses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  address_type ENUM('delivery', 'billing') NOT NULL DEFAULT 'delivery',
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NULL,
  phone VARCHAR(30) NULL,
  line1 VARCHAR(180) NOT NULL,
  line2 VARCHAR(180) NULL,
  landmark VARCHAR(180) NULL,
  city VARCHAR(120) NOT NULL,
  state VARCHAR(120) NOT NULL,
  pincode VARCHAR(20) NOT NULL,
  country VARCHAR(80) NOT NULL DEFAULT 'India',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_order_addresses_order_type (order_id, address_type),
  CONSTRAINT fk_order_addresses_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS abandoned_checkouts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  checkout_token VARCHAR(120) NOT NULL UNIQUE,
  customer_id INT UNSIGNED NULL,
  customer_name VARCHAR(180) NULL,
  email VARCHAR(180) NULL,
  phone VARCHAR(40) NULL,
  cart_items JSON NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  shipping_address JSON NULL,
  billing_address JSON NULL,
  payment_method VARCHAR(60) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  recovery_status VARCHAR(40) NOT NULL DEFAULT 'not_sent',
  recovery_url VARCHAR(500) NULL,
  source VARCHAR(80) NULL DEFAULT 'website',
  device_info VARCHAR(255) NULL,
  ip_address VARCHAR(80) NULL,
  user_agent TEXT NULL,
  last_activity_at TIMESTAMP NULL,
  recovered_at TIMESTAMP NULL,
  order_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_abandoned_status_created (status, created_at),
  INDEX idx_abandoned_email_phone (email, phone),
  INDEX idx_abandoned_order (order_id),
  CONSTRAINT fk_abandoned_checkout_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_abandoned_checkout_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS abandoned_checkout_events (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  abandoned_checkout_id INT UNSIGNED NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  event_data JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_abandoned_checkout_events_checkout (abandoned_checkout_id, created_at),
  CONSTRAINT fk_abandoned_checkout_events_checkout
    FOREIGN KEY (abandoned_checkout_id) REFERENCES abandoned_checkouts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_business_details (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  customer_id INT UNSIGNED NULL,
  business_name VARCHAR(180) NULL,
  gst_number VARCHAR(20) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_order_business_order (order_id),
  INDEX idx_order_business_customer (customer_id),
  CONSTRAINT fk_order_business_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_business_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_status_timeline (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  status VARCHAR(50) NOT NULL,
  title VARCHAR(120) NOT NULL,
  note VARCHAR(255) NULL,
  event_time DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_status_timeline_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
  review_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  customer_id INT UNSIGNED NULL,
  order_id INT UNSIGNED NULL,
  reviewer_name VARCHAR(160) NOT NULL,
  reviewer_email VARCHAR(190) NULL,
  rating TINYINT UNSIGNED NOT NULL,
  review_title VARCHAR(180) NOT NULL,
  review_text TEXT NOT NULL,
  review_type ENUM('customer_review', 'guest_review', 'admin_review') NOT NULL DEFAULT 'guest_review',
  is_verified_purchase TINYINT(1) NOT NULL DEFAULT 0,
  is_anonymous TINYINT(1) NOT NULL DEFAULT 0,
  visibility_status ENUM('public', 'hidden', 'private_to_reviewer', 'deleted') NOT NULL DEFAULT 'hidden',
  admin_reply TEXT NULL,
  admin_reply_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

ALTER TABLE reviews ADD COLUMN admin_reply TEXT NULL;
ALTER TABLE reviews ADD COLUMN admin_reply_at DATETIME NULL;

CREATE TABLE IF NOT EXISTS review_media (
  media_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  review_id BIGINT UNSIGNED NOT NULL,
  media_type ENUM('image', 'video') NOT NULL,
  media_url VARCHAR(500) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_media_review FOREIGN KEY (review_id) REFERENCES reviews(review_id) ON DELETE CASCADE
);

CREATE INDEX idx_review_media_review_sort ON review_media(review_id, sort_order);

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  source_queue_id BIGINT UNSIGNED NULL,
  event_uid VARCHAR(120) NULL,
  event_fingerprint CHAR(64) NULL,
  event_name VARCHAR(120) NOT NULL DEFAULT '',
  event_type VARCHAR(40) NOT NULL,
  user_id INT UNSIGNED NULL,
  session_id VARCHAR(80) NULL,
  customer_id INT UNSIGNED NULL,
  product_id INT UNSIGNED NULL,
  category_id INT UNSIGNED NULL,
  clicked_product_id INT UNSIGNED NULL,
  product_asin VARCHAR(80) NULL,
  product_slug VARCHAR(180) NULL,
  search_query VARCHAR(255) NULL,
  search_result_count INT UNSIGNED NULL,
  quantity INT UNSIGNED NULL,
  order_id INT UNSIGNED NULL,
  order_number VARCHAR(80) NULL,
  cart_value DECIMAL(12, 2) NULL,
  event_data JSON NULL,
  metadata_json JSON NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_analytics_source_queue (source_queue_id),
  UNIQUE KEY uniq_analytics_event_uid (event_uid),
  UNIQUE KEY uniq_analytics_event_fingerprint (event_fingerprint),
  INDEX idx_analytics_event_type_date (event_type, occurred_at),
  INDEX idx_analytics_session_date (session_id, occurred_at),
  INDEX idx_analytics_product_date (product_id, occurred_at),
  INDEX idx_analytics_category_date (category_id, occurred_at),
  INDEX idx_analytics_customer_date (customer_id, occurred_at),
  CONSTRAINT fk_analytics_events_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_analytics_events_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_analytics_events_clicked_product FOREIGN KEY (clicked_product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_analytics_events_category_current FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_analytics_events_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS analytics_event_queue (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(40) NOT NULL,
  session_id VARCHAR(80) NULL,
  customer_id INT UNSIGNED NULL,
  product_id INT UNSIGNED NULL,
  category_id INT UNSIGNED NULL,
  order_id INT UNSIGNED NULL,
  status ENUM('pending', 'processing', 'processed', 'failed') NOT NULL DEFAULT 'pending',
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  payload_json JSON NOT NULL,
  error_message VARCHAR(500) NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_analytics_queue_status_created (status, created_at),
  INDEX idx_analytics_queue_event_date (event_type, occurred_at),
  INDEX idx_analytics_queue_session_date (session_id, occurred_at),
  CONSTRAINT fk_analytics_queue_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_analytics_queue_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_analytics_queue_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS daily_product_metrics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_key VARCHAR(220) NOT NULL,
  product_id INT UNSIGNED NULL,
  product_name VARCHAR(255) NULL,
  product_slug VARCHAR(180) NULL,
  product_asin VARCHAR(80) NULL,
  `date` DATE NOT NULL,
  views BIGINT UNSIGNED NOT NULL DEFAULT 0,
  add_to_cart BIGINT UNSIGNED NOT NULL DEFAULT 0,
  purchases BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_daily_product_metrics_key_date (product_key, `date`),
  INDEX idx_daily_product_metrics_product_date (product_id, `date`),
  INDEX idx_daily_product_metrics_views (`date`, views),
  CONSTRAINT fk_daily_product_metrics_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS daily_search_metrics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  search_query VARCHAR(255) NOT NULL,
  `date` DATE NOT NULL,
  `count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  total_result_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  zero_result_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  clicked_product_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_clicked_product_id INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_daily_search_metrics_query_date (search_query, `date`),
  INDEX idx_daily_search_metrics_count (`date`, `count`),
  INDEX idx_daily_search_metrics_zero_results (`date`, zero_result_count),
  CONSTRAINT fk_daily_search_metrics_clicked_product FOREIGN KEY (last_clicked_product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS daily_category_metrics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_key VARCHAR(180) NOT NULL,
  category_id INT UNSIGNED NULL,
  category_name VARCHAR(255) NULL,
  category_slug VARCHAR(180) NULL,
  `date` DATE NOT NULL,
  views BIGINT UNSIGNED NOT NULL DEFAULT 0,
  conversions BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_daily_category_metrics_key_date (category_key, `date`),
  INDEX idx_daily_category_metrics_category_date (category_id, `date`),
  INDEX idx_daily_category_metrics_views (`date`, views),
  CONSTRAINT fk_daily_category_metrics_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS daily_funnel_metrics (
  `date` DATE NOT NULL PRIMARY KEY,
  sessions BIGINT UNSIGNED NOT NULL DEFAULT 0,
  users BIGINT UNSIGNED NOT NULL DEFAULT 0,
  product_views BIGINT UNSIGNED NOT NULL DEFAULT 0,
  searches BIGINT UNSIGNED NOT NULL DEFAULT 0,
  add_to_cart BIGINT UNSIGNED NOT NULL DEFAULT 0,
  checkout BIGINT UNSIGNED NOT NULL DEFAULT 0,
  purchase BIGINT UNSIGNED NOT NULL DEFAULT 0,
  abandoned_carts BIGINT UNSIGNED NOT NULL DEFAULT 0,
  category_views BIGINT UNSIGNED NOT NULL DEFAULT 0,
  remove_from_cart BIGINT UNSIGNED NOT NULL DEFAULT 0,
  wishlist_add BIGINT UNSIGNED NOT NULL DEFAULT 0,
  filter_applied BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_abandoned_carts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(80) NOT NULL,
  customer_id INT UNSIGNED NULL,
  last_cart_event_id BIGINT UNSIGNED NOT NULL,
  cart_value DECIMAL(12, 2) NULL,
  last_cart_at TIMESTAMP NOT NULL,
  abandoned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metric_recorded TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_abandoned_cart_session_event (session_id, last_cart_event_id),
  INDEX idx_abandoned_carts_metric (metric_recorded, abandoned_at),
  CONSTRAINT fk_abandoned_carts_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_abandoned_carts_event FOREIGN KEY (last_cart_event_id) REFERENCES analytics_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analytics_daily_sessions (
  `date` DATE NOT NULL,
  session_id VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`date`, session_id)
);

CREATE TABLE IF NOT EXISTS analytics_daily_users (
  `date` DATE NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`date`, user_id),
  CONSTRAINT fk_analytics_daily_users_customer FOREIGN KEY (user_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analytics_processing_state (
  processor_name VARCHAR(80) NOT NULL PRIMARY KEY,
  last_event_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_run_at TIMESTAMP NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_import_jobs (
  id VARCHAR(80) NOT NULL PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  stored_file_path VARCHAR(500) NOT NULL,
  template_type VARCHAR(80) NOT NULL,
  import_type VARCHAR(80) NOT NULL,
  uploaded_by VARCHAR(180) NULL,
  total_rows INT NOT NULL DEFAULT 0,
  processed_rows INT NOT NULL DEFAULT 0,
  success_rows INT NOT NULL DEFAULT 0,
  failed_rows INT NOT NULL DEFAULT 0,
  current_batch INT NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'queued',
  report_data JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS inventory_import_failed_rows (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  import_id VARCHAR(80) NOT NULL,
  `row_number` INT NOT NULL,
  asin VARCHAR(80) NULL,
  sku VARCHAR(120) NULL,
  error_reason TEXT NOT NULL,
  original_row_data JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_inventory_failed_import (import_id),
  CONSTRAINT fk_inventory_failed_import FOREIGN KEY (import_id) REFERENCES inventory_import_jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory_export_jobs (
  id VARCHAR(80) NOT NULL PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  stored_file_path VARCHAR(500) NULL,
  export_type VARCHAR(80) NOT NULL,
  requested_by VARCHAR(180) NULL,
  filters_json JSON NULL,
  total_rows INT NOT NULL DEFAULT 0,
  processed_rows INT NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'queued',
  message TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL
);

ALTER TABLE products ADD COLUMN stock_status VARCHAR(20) GENERATED ALWAYS AS (
  CASE
    WHEN stock_quantity <= 0 OR status = 'out_of_stock' THEN 'out-of-stock'
    WHEN stock_quantity <= low_stock_threshold THEN 'low-stock'
    ELSE 'in-stock'
  END
) STORED;

CREATE TABLE IF NOT EXISTS analytics_funnel_daily (
  metric_date DATE NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  total BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (metric_date, event_type)
);

CREATE TABLE IF NOT EXISTS analytics_product_daily (
  metric_date DATE NOT NULL,
  product_key VARCHAR(220) NOT NULL,
  product_id INT UNSIGNED NULL,
  product_name VARCHAR(255) NULL,
  product_slug VARCHAR(180) NULL,
  product_asin VARCHAR(80) NULL,
  views BIGINT UNSIGNED NOT NULL DEFAULT 0,
  add_to_cart BIGINT UNSIGNED NOT NULL DEFAULT 0,
  purchases BIGINT UNSIGNED NOT NULL DEFAULT 0,
  revenue DECIMAL(14, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (metric_date, product_key),
  INDEX idx_analytics_product_daily_views (metric_date, views),
  CONSTRAINT fk_analytics_product_daily_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS analytics_search_daily (
  metric_date DATE NOT NULL,
  search_query VARCHAR(255) NOT NULL,
  total BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (metric_date, search_query),
  INDEX idx_analytics_search_daily_total (metric_date, total)
);

CREATE TABLE IF NOT EXISTS analytics_recent_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  source_event_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(40) NOT NULL,
  search_query VARCHAR(255) NULL,
  label VARCHAR(255) NOT NULL,
  quantity INT UNSIGNED NULL,
  cart_value DECIMAL(12, 2) NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_analytics_recent_occurred (occurred_at),
  CONSTRAINT fk_analytics_recent_source_event FOREIGN KEY (source_event_id) REFERENCES analytics_events(id) ON DELETE SET NULL
);

ALTER TABLE analytics_events ADD COLUMN source_queue_id BIGINT UNSIGNED NULL;
ALTER TABLE analytics_events ADD COLUMN event_uid VARCHAR(120) NULL;
ALTER TABLE analytics_events ADD COLUMN event_fingerprint CHAR(64) NULL;
ALTER TABLE analytics_events ADD COLUMN event_name VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE analytics_events ADD COLUMN event_type VARCHAR(40) NULL;
ALTER TABLE analytics_events ADD COLUMN user_id INT UNSIGNED NULL;
ALTER TABLE analytics_events ADD COLUMN category_id INT UNSIGNED NULL;
ALTER TABLE analytics_events ADD COLUMN clicked_product_id INT UNSIGNED NULL;
ALTER TABLE analytics_events ADD COLUMN product_asin VARCHAR(80) NULL;
ALTER TABLE analytics_events ADD COLUMN product_slug VARCHAR(180) NULL;
ALTER TABLE analytics_events ADD COLUMN search_query VARCHAR(255) NULL;
ALTER TABLE analytics_events ADD COLUMN search_result_count INT UNSIGNED NULL;
ALTER TABLE analytics_events ADD COLUMN quantity INT UNSIGNED NULL;
ALTER TABLE analytics_events ADD COLUMN order_id INT UNSIGNED NULL;
ALTER TABLE analytics_events ADD COLUMN order_number VARCHAR(80) NULL;
ALTER TABLE analytics_events ADD COLUMN cart_value DECIMAL(12, 2) NULL;
ALTER TABLE analytics_events ADD COLUMN event_data JSON NULL;
ALTER TABLE analytics_events ADD COLUMN occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX idx_analytics_event_type_date ON analytics_events(event_type, occurred_at);
CREATE INDEX idx_analytics_session_date ON analytics_events(session_id, occurred_at);
CREATE INDEX idx_analytics_product_date ON analytics_events(product_id, occurred_at);
CREATE INDEX idx_analytics_category_date ON analytics_events(category_id, occurred_at);
CREATE INDEX idx_analytics_customer_date ON analytics_events(customer_id, occurred_at);
CREATE UNIQUE INDEX uniq_analytics_source_queue ON analytics_events(source_queue_id);
CREATE UNIQUE INDEX uniq_analytics_event_uid ON analytics_events(event_uid);
CREATE UNIQUE INDEX uniq_analytics_event_fingerprint ON analytics_events(event_fingerprint);
ALTER TABLE analytics_events ADD CONSTRAINT fk_analytics_events_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE analytics_event_queue ADD COLUMN category_id INT UNSIGNED NULL;
ALTER TABLE daily_search_metrics ADD COLUMN total_result_count BIGINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE daily_search_metrics ADD COLUMN zero_result_count BIGINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE daily_search_metrics ADD COLUMN clicked_product_count BIGINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE daily_search_metrics ADD COLUMN last_clicked_product_id INT UNSIGNED NULL;
ALTER TABLE daily_funnel_metrics ADD COLUMN abandoned_carts BIGINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE daily_funnel_metrics ADD COLUMN users BIGINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(50) NULL;
ALTER TABLE orders ADD COLUMN coupon_discount DECIMAL(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN credit_discount DECIMAL(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN payment_gateway VARCHAR(50) NULL;
ALTER TABLE orders ADD COLUMN razorpay_order_id VARCHAR(160) NULL;
ALTER TABLE orders ADD COLUMN razorpay_payment_id VARCHAR(160) NULL;
ALTER TABLE orders ADD COLUMN payment_signature VARCHAR(255) NULL;
ALTER TABLE orders ADD COLUMN paid_at DATETIME NULL;
ALTER TABLE orders ADD COLUMN payment_error TEXT NULL;
ALTER TABLE order_items ADD COLUMN product_mrp DECIMAL(10, 2) NULL;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  gateway_name VARCHAR(80) NOT NULL,
  gateway_order_id VARCHAR(160) NULL,
  gateway_payment_id VARCHAR(160) NULL,
  payment_method VARCHAR(80) NULL,
  payment_status ENUM('pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded') NOT NULL DEFAULT 'pending',
  paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  payment_time DATETIME NULL,
  refund_reference VARCHAR(160) NULL,
  gateway_response_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payments_order_gateway (order_id, gateway_name),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

ALTER TABLE payments ADD UNIQUE KEY uq_payments_order_gateway (order_id, gateway_name);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(30) NOT NULL DEFAULT 'razorpay',
  event_id VARCHAR(160) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  processing_status ENUM('processing', 'processed', 'ignored', 'failed') NOT NULL DEFAULT 'processing',
  payload_json JSON NOT NULL,
  processing_error VARCHAR(500) NULL,
  processed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment_webhook_provider_event (provider, event_id),
  INDEX idx_payment_webhook_type_status (event_type, processing_status)
);

CREATE TABLE IF NOT EXISTS shipments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  courier_partner VARCHAR(120) NULL,
  awb_number VARCHAR(120) NULL,
  tracking_url VARCHAR(500) NULL,
  shipping_status ENUM('pending', 'packed', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned') NOT NULL DEFAULT 'pending',
  estimated_delivery_date DATETIME NULL,
  shipped_at DATETIME NULL,
  delivered_at DATETIME NULL,
  delivery_attempts INT NOT NULL DEFAULT 0,
  shipping_address_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shipments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_shipments_address FOREIGN KEY (shipping_address_id) REFERENCES order_addresses(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS return_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  order_item_id INT UNSIGNED NULL,
  reason VARCHAR(255) NOT NULL,
  return_status ENUM('requested', 'approved', 'rejected', 'pickup_scheduled', 'received', 'completed', 'cancelled') NOT NULL DEFAULT 'requested',
  refund_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  refund_status ENUM('not_started', 'pending', 'processed', 'failed') NOT NULL DEFAULT 'not_started',
  refund_method VARCHAR(80) NULL,
  pickup_tracking_id VARCHAR(120) NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_return_requests_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_return_requests_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_return_requests_admin FOREIGN KEY (processed_by) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS coupons (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(60) NOT NULL UNIQUE,
  title VARCHAR(140) NOT NULL,
  description TEXT NULL,
  discount_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
  discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
  minimum_order_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  maximum_discount_amount DECIMAL(12, 2) NULL,
  usage_limit INT NULL,
  used_count INT NOT NULL DEFAULT 0,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  end_date DATE NULL,
  status ENUM('active', 'inactive', 'expired') NOT NULL DEFAULT 'active',
  show_on_homepage TINYINT(1) NOT NULL DEFAULT 0,
  show_on_product_page TINYINT(1) NOT NULL DEFAULT 0,
  homepage_sort_order INT NOT NULL DEFAULT 0,
  product_page_sort_order INT NOT NULL DEFAULT 0,
  background_image_url VARCHAR(500) NULL,
  offer_badge_text VARCHAR(80) NULL,
  offer_card_title VARCHAR(160) NULL,
  offer_card_description VARCHAR(500) NULL,
  offer_button_text VARCHAR(80) NULL,
  offer_button_link VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupon_categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  coupon_id INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_coupon_category (coupon_id, category_id),
  INDEX idx_coupon_categories_category_id (category_id),
  CONSTRAINT fk_coupon_categories_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  CONSTRAINT fk_coupon_categories_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coupon_products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  coupon_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_coupon_product (coupon_id, product_id),
  CONSTRAINT fk_coupon_products_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  CONSTRAINT fk_coupon_products_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(180) NOT NULL UNIQUE,
  source VARCHAR(80) NULL,
  status ENUM('subscribed', 'unsubscribed') NOT NULL DEFAULT 'subscribed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seo_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  page_type VARCHAR(80) NOT NULL,
  reference_id VARCHAR(80) NULL,
  meta_title VARCHAR(180) NULL,
  meta_description TEXT NULL,
  meta_keywords TEXT NULL,
  canonical_url VARCHAR(500) NULL,
  og_title VARCHAR(180) NULL,
  og_description TEXT NULL,
  og_image VARCHAR(500) NULL,
  schema_json JSON NULL,
  robots_index TINYINT(1) NOT NULL DEFAULT 1,
  robots_follow TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_seo_reference (page_type, reference_id)
);

CREATE TABLE IF NOT EXISTS cms_pages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  page_type VARCHAR(80) NOT NULL DEFAULT 'content',
  status ENUM('draft', 'active', 'inactive', 'archived') NOT NULL DEFAULT 'draft',
  sort_order INT NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  updated_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cms_pages_created_by FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL,
  CONSTRAINT fk_cms_pages_updated_by FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS custom_pages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(220) NOT NULL,
  slug VARCHAR(220) NOT NULL,
  page_type ENUM('policy', 'about', 'landing', 'information', 'custom') NOT NULL DEFAULT 'custom',
  status ENUM('draft', 'active', 'inactive', 'published') NOT NULL DEFAULT 'draft',
  show_in_header TINYINT(1) NOT NULL DEFAULT 0,
  show_in_footer TINYINT(1) NOT NULL DEFAULT 0,
  header_sort_order INT NOT NULL DEFAULT 0,
  footer_sort_order INT NOT NULL DEFAULT 0,
  is_live_url_enabled TINYINT(1) NOT NULL DEFAULT 0,
  published_at DATETIME NULL,
  meta_title VARCHAR(180) NULL,
  meta_description TEXT NULL,
  meta_keywords TEXT NULL,
  canonical_url VARCHAR(500) NULL,
  og_title VARCHAR(180) NULL,
  og_description TEXT NULL,
  og_image_url VARCHAR(500) NULL,
  robots ENUM('index/follow', 'noindex/follow', 'noindex/nofollow') NOT NULL DEFAULT 'index/follow',
  custom_css MEDIUMTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_custom_pages_slug (slug),
  INDEX idx_custom_pages_status_deleted (status, deleted_at),
  INDEX idx_custom_pages_header_sort (show_in_header, status, header_sort_order),
  INDEX idx_custom_pages_footer_sort (show_in_footer, status, footer_sort_order),
  INDEX idx_custom_pages_live_slug (is_live_url_enabled, slug, status),
  INDEX idx_custom_pages_deleted_updated (deleted_at, updated_at)
);

ALTER TABLE custom_pages ADD COLUMN custom_css MEDIUMTEXT NULL;

CREATE TABLE IF NOT EXISTS custom_page_blocks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  page_id BIGINT UNSIGNED NOT NULL,
  block_type ENUM('text', 'image', 'image_text', 'heading', 'banner', 'two_column', 'faq', 'button') NOT NULL,
  block_title VARCHAR(220) NULL,
  content JSON NULL,
  image_url VARCHAR(500) NULL,
  image_alt VARCHAR(255) NULL,
  image_title VARCHAR(255) NULL,
  image_caption TEXT NULL,
  layout_position VARCHAR(80) NULL,
  image_width VARCHAR(20) NULL,
  border_radius INT NULL,
  text_alignment ENUM('left', 'center', 'right') NOT NULL DEFAULT 'left',
  font_size INT NULL,
  text_color VARCHAR(32) NULL,
  background_color VARCHAR(32) NULL,
  button_text VARCHAR(160) NULL,
  button_link VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  custom_css_class VARCHAR(160) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_custom_page_blocks_page_sort (page_id, status, sort_order),
  INDEX idx_custom_page_blocks_deleted_sort (deleted_at, sort_order),
  CONSTRAINT fk_custom_page_blocks_page FOREIGN KEY (page_id) REFERENCES custom_pages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cms_sections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  page_id BIGINT UNSIGNED NULL,
  section_key VARCHAR(120) NOT NULL,
  component_key VARCHAR(120) NULL,
  title VARCHAR(180) NULL,
  content_json JSON NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cms_sections_page FOREIGN KEY (page_id) REFERENCES cms_pages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cms_banners (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  section_id BIGINT UNSIGNED NULL,
  title VARCHAR(180) NULL,
  desktop_media_url VARCHAR(500) NULL,
  mobile_media_url VARCHAR(500) NULL,
  media_type ENUM('image', 'video') NOT NULL DEFAULT 'image',
  alt_text VARCHAR(255) NULL,
  headline VARCHAR(180) NULL,
  subheadline TEXT NULL,
  cta_text VARCHAR(120) NULL,
  cta_link VARCHAR(500) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cms_banners_section FOREIGN KEY (section_id) REFERENCES cms_sections(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS blog_tags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_blog_tags_status (status)
);

CREATE TABLE IF NOT EXISTS blogs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(220) NOT NULL,
  slug VARCHAR(220) NOT NULL UNIQUE,
  subtitle VARCHAR(255) NULL,
  excerpt TEXT NULL,
  content LONGTEXT NULL,
  featured_image_url VARCHAR(500) NULL,
  author_name VARCHAR(160) NULL,
  tag_id BIGINT UNSIGNED NULL,
  status ENUM('draft', 'active', 'inactive') NOT NULL DEFAULT 'draft',
  show_on_homepage TINYINT(1) NOT NULL DEFAULT 0,
  homepage_sort_order INT NOT NULL DEFAULT 0,
  published_at DATETIME NULL,
  meta_title VARCHAR(180) NULL,
  meta_description TEXT NULL,
  meta_keywords TEXT NULL,
  canonical_url VARCHAR(500) NULL,
  og_image_url VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_blogs_tag (tag_id),
  INDEX idx_blogs_status_published (status, published_at),
  INDEX idx_blogs_homepage (show_on_homepage, homepage_sort_order),
  INDEX idx_blogs_deleted (deleted_at),
  CONSTRAINT fk_blogs_tag FOREIGN KEY (tag_id) REFERENCES blog_tags(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(220) NOT NULL,
  slug VARCHAR(220) NOT NULL UNIQUE,
  author_id INT UNSIGNED NULL,
  featured_image VARCHAR(500) NULL,
  excerpt TEXT NULL,
  content LONGTEXT NULL,
  tags_json JSON NULL,
  category_id INT UNSIGNED NULL,
  meta_title VARCHAR(180) NULL,
  meta_description TEXT NULL,
  published_at DATETIME NULL,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_blog_posts_author FOREIGN KEY (author_id) REFERENCES admins(id) ON DELETE SET NULL,
  CONSTRAINT fk_blog_posts_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS form_leads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  form_type VARCHAR(80) NOT NULL,
  name VARCHAR(140) NULL,
  email VARCHAR(180) NULL,
  phone VARCHAR(40) NULL,
  subject VARCHAR(180) NULL,
  message TEXT NULL,
  product_id INT UNSIGNED NULL,
  order_id INT UNSIGNED NULL,
  status ENUM('new', 'assigned', 'in_progress', 'closed', 'spam') NOT NULL DEFAULT 'new',
  assigned_to INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_form_leads_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_form_leads_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_form_leads_admin FOREIGN KEY (assigned_to) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_type ENUM('admin', 'customer', 'guest') NOT NULL DEFAULT 'customer',
  user_id VARCHAR(80) NULL,
  type VARCHAR(80) NOT NULL,
  title VARCHAR(180) NOT NULL,
  message TEXT NULL,
  channel ENUM('in_app', 'email', 'sms', 'whatsapp') NOT NULL DEFAULT 'in_app',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  sent_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(120) NULL,
  customer_id INT UNSIGNED NULL,
  event_name VARCHAR(120) NOT NULL,
  product_id INT UNSIGNED NULL,
  category_id INT UNSIGNED NULL,
  page_url VARCHAR(500) NULL,
  source VARCHAR(120) NULL,
  medium VARCHAR(120) NULL,
  campaign VARCHAR(180) NULL,
  device_type VARCHAR(80) NULL,
  ip_address VARCHAR(80) NULL,
  user_agent TEXT NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_analytics_events_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_analytics_events_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_analytics_events_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS uploaded_assets (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  original_name VARCHAR(255) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  asset_type ENUM('image', 'video', 'file') NOT NULL DEFAULT 'image',
  url VARCHAR(500) NOT NULL,
  alt_text VARCHAR(255) NULL,
  section_path VARCHAR(500) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  uploaded_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_uploaded_assets_admin FOREIGN KEY (uploaded_by) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED NULL,
  admin_name VARCHAR(120) NULL,
  admin_role VARCHAR(80) NULL,
  action VARCHAR(120) NOT NULL,
  module_name VARCHAR(80) NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) NULL,
  record_name VARCHAR(180) NULL,
  ip_address VARCHAR(64) NULL,
  device_label VARCHAR(180) NULL,
  status ENUM('success', 'failed') NOT NULL DEFAULT 'success',
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

ALTER TABLE audit_logs ADD COLUMN admin_name VARCHAR(120) NULL;
ALTER TABLE audit_logs ADD COLUMN admin_role VARCHAR(80) NULL;
ALTER TABLE audit_logs ADD COLUMN module_name VARCHAR(80) NULL;
ALTER TABLE audit_logs ADD COLUMN record_name VARCHAR(180) NULL;
ALTER TABLE audit_logs ADD COLUMN ip_address VARCHAR(64) NULL;
ALTER TABLE audit_logs ADD COLUMN device_label VARCHAR(180) NULL;
ALTER TABLE audit_logs ADD COLUMN status ENUM('success', 'failed') NOT NULL DEFAULT 'success';

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(120) NOT NULL PRIMARY KEY,
  setting_value TEXT NULL,
  setting_group VARCHAR(80) NOT NULL DEFAULT 'general',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_app_settings_group (setting_group)
);

CREATE TABLE IF NOT EXISTS payment_gateway_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  provider VARCHAR(30) NOT NULL DEFAULT 'razorpay',
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  mode ENUM('test', 'live') NOT NULL DEFAULT 'test',
  test_key_id VARCHAR(255) NULL,
  test_key_secret_encrypted TEXT NULL,
  test_webhook_secret_encrypted TEXT NULL,
  live_key_id VARCHAR(255) NULL,
  live_key_secret_encrypted TEXT NULL,
  live_webhook_secret_encrypted TEXT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  button_text VARCHAR(80) NOT NULL DEFAULT 'Pay Now',
  description VARCHAR(180) NOT NULL DEFAULT 'Order Payment',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_payment_gateway_settings_singleton CHECK (id = 1)
);

INSERT IGNORE INTO payment_gateway_settings
  (id, provider, enabled, mode, currency, button_text, description)
VALUES
  (1, 'razorpay', 0, 'test', 'INR', 'Pay Now', 'Order Payment');

CREATE TABLE IF NOT EXISTS theme_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  primary_color VARCHAR(7) NOT NULL DEFAULT '#22C55E',
  secondary_color VARCHAR(7) NOT NULL DEFAULT '#111827',
  accent_color VARCHAR(7) NOT NULL DEFAULT '#16A34A',
  background_color VARCHAR(7) NOT NULL DEFAULT '#F6FAF7',
  surface_color VARCHAR(7) NOT NULL DEFAULT '#FFFFFF',
  text_color VARCHAR(7) NOT NULL DEFAULT '#111827',
  muted_text_color VARCHAR(7) NOT NULL DEFAULT '#6B7280',
  border_color VARCHAR(7) NOT NULL DEFAULT '#E5E7EB',
  success_color VARCHAR(7) NOT NULL DEFAULT '#22C55E',
  error_color VARCHAR(7) NOT NULL DEFAULT '#EF4444',
  font_family VARCHAR(80) NOT NULL DEFAULT 'Inter',
  base_font_size INT NOT NULL DEFAULT 16,
  heading_font_weight INT NOT NULL DEFAULT 800,
  body_font_weight INT NOT NULL DEFAULT 400,
  line_height DECIMAL(4,2) NOT NULL DEFAULT 1.50,
  button_radius INT NOT NULL DEFAULT 12,
  button_height INT NOT NULL DEFAULT 42,
  card_radius INT NOT NULL DEFAULT 18,
  card_shadow VARCHAR(30) NOT NULL DEFAULT 'soft',
  section_padding_desktop INT NOT NULL DEFAULT 64,
  section_padding_mobile INT NOT NULL DEFAULT 28,
  website_max_width INT NOT NULL DEFAULT 1280,
  product_image_ratio VARCHAR(20) NOT NULL DEFAULT '1:1',
  custom_css MEDIUMTEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_theme_settings_singleton CHECK (id = 1)
);

INSERT IGNORE INTO theme_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS footer_settings (
  setting_key VARCHAR(120) NOT NULL PRIMARY KEY,
  setting_value TEXT NULL,
  setting_group VARCHAR(80) NOT NULL DEFAULT 'branding',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_footer_settings_group (setting_group)
);

CREATE TABLE IF NOT EXISTS footer_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  item_uid VARCHAR(120) NOT NULL,
  item_type ENUM('quick_link', 'faq', 'policy', 'social', 'payment') NOT NULL,
  label VARCHAR(180) NULL,
  question_text VARCHAR(255) NULL,
  name VARCHAR(180) NULL,
  url VARCHAR(500) NULL,
  icon_url VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_footer_items_uid_type (item_uid, item_type),
  INDEX idx_footer_items_type_status_sort (item_type, status, sort_order),
  INDEX idx_footer_items_type_sort (item_type, sort_order)
);

CREATE TABLE IF NOT EXISTS homepage_why_shop_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  section_enabled TINYINT(1) NOT NULL DEFAULT 1,
  section_title VARCHAR(180) NOT NULL DEFAULT 'Why Shop With Avyona',
  section_subtitle TEXT NULL,
  cards_per_row INT NOT NULL DEFAULT 4,
  mobile_cards_per_row INT NOT NULL DEFAULT 1,
  section_sort_order INT NOT NULL DEFAULT 82,
  background_color VARCHAR(32) NOT NULL DEFAULT '#f8fafc',
  text_color VARCHAR(32) NOT NULL DEFAULT '#0f172a',
  custom_css MEDIUMTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_homepage_why_shop_settings_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS homepage_why_shop_items (
  id VARCHAR(120) NOT NULL PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  icon_url VARCHAR(500) NULL,
  icon_position ENUM('left', 'right', 'top') NOT NULL DEFAULT 'left',
  icon_size INT NOT NULL DEFAULT 42,
  font_size INT NOT NULL DEFAULT 18,
  text_color VARCHAR(32) NOT NULL DEFAULT '#0f172a',
  card_background VARCHAR(32) NOT NULL DEFAULT '#ffffff',
  card_border_color VARCHAR(32) NOT NULL DEFAULT '#e5e7eb',
  card_radius INT NOT NULL DEFAULT 16,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_homepage_why_shop_items_status_sort (status, sort_order),
  INDEX idx_homepage_why_shop_items_deleted_sort (deleted_at, sort_order)
);

CREATE TABLE IF NOT EXISTS product_payment_icon_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  section_enabled TINYINT(1) NOT NULL DEFAULT 1,
  section_title VARCHAR(180) NOT NULL DEFAULT 'Payment Options',
  section_subtitle TEXT NULL,
  icons_per_row INT NOT NULL DEFAULT 7,
  mobile_icons_per_row INT NOT NULL DEFAULT 3,
  sort_order INT NOT NULL DEFAULT 20,
  background_color VARCHAR(32) NOT NULL DEFAULT '#ffffff',
  text_color VARCHAR(32) NOT NULL DEFAULT '#0f172a',
  custom_css MEDIUMTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_product_payment_icon_settings_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS product_payment_icons (
  id VARCHAR(120) NOT NULL PRIMARY KEY,
  payment_name VARCHAR(180) NOT NULL,
  icon_url VARCHAR(500) NULL,
  icon_alt_text VARCHAR(240) NULL,
  icon_size INT NOT NULL DEFAULT 44,
  icon_background_color VARCHAR(32) NOT NULL DEFAULT '#ffffff',
  icon_border_color VARCHAR(32) NOT NULL DEFAULT '#e5e7eb',
  icon_radius INT NOT NULL DEFAULT 14,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_product_payment_icons_status_sort (status, sort_order),
  INDEX idx_product_payment_icons_deleted_sort (deleted_at, sort_order)
);

ALTER TABLE custom_page_blocks ADD COLUMN image_width VARCHAR(20) NULL;
ALTER TABLE custom_page_blocks ADD COLUMN border_radius INT NULL;

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_status_sort ON categories(status, sort_order);
CREATE INDEX idx_brands_status_sort ON brands(status, sort_order);
CREATE UNIQUE INDEX uq_products_asin ON products(asin);
CREATE UNIQUE INDEX uq_products_sku ON products(sku);
CREATE UNIQUE INDEX uq_products_slug ON products(slug);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_stock_status ON products(stock_status);
CREATE INDEX idx_products_stock_safety ON products(stock_quantity, low_stock_threshold, status);
CREATE INDEX idx_products_category_status ON products(category_id, status);
CREATE INDEX idx_products_brand_status ON products(brand_id, status);
CREATE INDEX idx_products_asin ON products(asin);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_model_number ON products(model_number);
CREATE FULLTEXT INDEX idx_products_catalog_fulltext ON products(name, brand, asin, sku, barcode, model_number, short_description, description);
CREATE FULLTEXT INDEX idx_products_fulltext_search ON products(name, brand, asin, sku, barcode, model_number, short_description, description);
CREATE INDEX idx_inventory_import_jobs_status_created ON inventory_import_jobs(status, created_at);
CREATE INDEX idx_inventory_import_jobs_template_type ON inventory_import_jobs(template_type, import_type);
CREATE INDEX idx_inventory_import_failed_rows_keys ON inventory_import_failed_rows(asin, sku);
CREATE INDEX idx_inventory_export_jobs_status_created ON inventory_export_jobs(status, created_at);
CREATE INDEX idx_inventory_export_jobs_type_created ON inventory_export_jobs(export_type, created_at);
CREATE INDEX idx_admins_status ON admins(status);
CREATE INDEX idx_admin_login_sessions_admin_status ON admin_login_sessions(admin_id, status);
CREATE INDEX idx_permissions_module_action ON permissions(module_name, action_name);
CREATE INDEX idx_user_custom_permissions_admin ON user_custom_permissions(admin_id);
CREATE INDEX idx_audit_logs_admin_created ON audit_logs(admin_id, created_at);
CREATE INDEX idx_audit_logs_module_created ON audit_logs(module_name, created_at);
CREATE INDEX idx_products_visibility ON products(status, is_visible, is_deleted);
CREATE INDEX idx_products_sort_order ON products(sort_order, created_at);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_status_created ON orders(status, created_at);
CREATE INDEX idx_orders_razorpay_order ON orders(razorpay_order_id);
CREATE INDEX idx_orders_razorpay_payment ON orders(razorpay_payment_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_product_media_product_sort ON product_media(product_id, sort_order);
CREATE INDEX idx_product_variants_product_sort ON product_variants(product_id, sort_order);
CREATE INDEX idx_carts_customer_status ON carts(customer_id, status);
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX idx_wishlists_customer ON wishlists(customer_id);
CREATE INDEX idx_product_reviews_product_status ON product_reviews(product_id, status);
CREATE INDEX idx_reviews_product_visibility ON reviews(product_id, visibility_status);
CREATE INDEX idx_reviews_customer_created ON reviews(customer_id, created_at);
CREATE INDEX idx_reviews_order ON reviews(order_id);
CREATE INDEX idx_review_media_review_sort ON review_media(review_id, sort_order);
CREATE INDEX idx_product_search_filter ON product_search_attributes(filter_group, filter_value);
CREATE INDEX idx_payments_order_status ON payments(order_id, payment_status);
CREATE INDEX idx_shipments_order_status ON shipments(order_id, shipping_status);
CREATE INDEX idx_return_requests_order_status ON return_requests(order_id, return_status);
CREATE INDEX idx_cms_sections_key ON cms_sections(section_key, status);
CREATE INDEX idx_cms_banners_section_sort ON cms_banners(section_id, status, sort_order);
CREATE INDEX idx_blog_posts_status_date ON blog_posts(status, published_at);
CREATE INDEX idx_form_leads_status ON form_leads(status, created_at);
CREATE INDEX idx_notifications_user_read ON notifications(user_type, user_id, is_read);
CREATE INDEX idx_analytics_events_name_date ON analytics_events(event_name, created_at);

-- ─── Credit Points System ─────────────────────────────────────────────────────

-- Canonical credit module table names:
--   credit_settings
--   customer_credit_wallets
--   credit_transactions
--   reward_rules
--   customer_referral_codes
--   credit_fraud_logs
-- Keep this naming style consistently. Do not introduce alternate names
-- for credit transactions or referral tracking.
CREATE TABLE IF NOT EXISTS credit_settings (
  id                    INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  points_per_rupee      INT           NOT NULL DEFAULT 10,
  min_redeem_points     INT           NOT NULL DEFAULT 100,
  max_redeem_percent    DECIMAL(5,2)  NOT NULL DEFAULT 20.00,
  expiry_days           INT           NOT NULL DEFAULT 365,
  expiry_warning_days   INT           NOT NULL DEFAULT 30,
  referrer_bonus_points INT           NOT NULL DEFAULT 300,
  referee_bonus_points  INT           NOT NULL DEFAULT 500,
  updated_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- One settings row is seeded on first use; subsequent changes update it.
INSERT IGNORE INTO credit_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS customer_credit_wallets (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id      INT UNSIGNED NOT NULL UNIQUE,
  total_points     INT          NOT NULL DEFAULT 0,
  available_points INT          NOT NULL DEFAULT 0,
  used_points      INT          NOT NULL DEFAULT 0,
  expired_points   INT          NOT NULL DEFAULT 0,
  is_blocked       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_credit_wallet_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id      INT UNSIGNED    NOT NULL,
  transaction_type ENUM(
    'signup_bonus', 'referral_bonus', 'purchase_cashback',
    'review_reward', 'milestone_reward', 'manual_adjustment',
    'redemption', 'expiry'
  )                                NOT NULL,
  points           INT             NOT NULL,
  cashback_value   DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  reference_id     VARCHAR(100)    NULL,
  reference_type   VARCHAR(60)     NULL,
  note             TEXT            NULL,
  status           ENUM('active', 'used', 'expired', 'pending') NOT NULL DEFAULT 'active',
  expiry_date      DATE            NULL,
  created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_credit_tx_customer_date    (customer_id, created_at),
  INDEX idx_credit_tx_customer_status  (customer_id, status),
  INDEX idx_credit_tx_expiry           (expiry_date, status),
  CONSTRAINT fk_credit_tx_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS credit_fraud_logs (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id    INT UNSIGNED    NULL,
  violation_type VARCHAR(80)     NOT NULL,
  metadata       JSON            NULL,
  ip_address     VARCHAR(64)     NULL,
  reviewed       TINYINT(1)      NOT NULL DEFAULT 0,
  reviewed_by    INT UNSIGNED    NULL,
  reviewed_at    DATETIME        NULL,
  created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fraud_logs_customer      (customer_id, created_at),
  INDEX idx_fraud_logs_type_date     (violation_type, created_at),
  INDEX idx_fraud_logs_reviewed      (reviewed, created_at),
  CONSTRAINT fk_fraud_logs_customer  FOREIGN KEY (customer_id)  REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_fraud_logs_reviewer  FOREIGN KEY (reviewed_by)  REFERENCES admins(id)    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reward_rules (
  id               INT UNSIGNED   NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rule_name        VARCHAR(120)   NOT NULL,
  rule_type        ENUM('cashback', 'bonus', 'campaign', 'milestone') NOT NULL,
  trigger_event    ENUM('signup', 'referral', 'purchase', 'review', 'milestone', 'manual_reward', 'festival_campaign') NOT NULL,
  reward_points    INT            NOT NULL DEFAULT 0,
  cashback_value   DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  cashback_percent DECIMAL(6,3)   NULL,
  milestone_order_count INT        NULL,
  reward_target    ENUM('customer', 'referrer', 'referee', 'both') NOT NULL DEFAULT 'customer',
  priority         INT            NOT NULL DEFAULT 100,
  max_usage        INT            NULL,
  used_count       INT            NOT NULL DEFAULT 0,
  status           ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  expiry_date      DATE           NULL,
  min_order_value  DECIMAL(10,2)  NULL,
  max_reward_limit INT            NULL,
  is_default       TINYINT(1)     NOT NULL DEFAULT 0,
  created_at       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_reward_rules_type_status (rule_type, status),
  INDEX idx_reward_rules_trigger     (trigger_event, status)
);

ALTER TABLE reward_rules ADD COLUMN cashback_percent DECIMAL(6,3) NULL;
ALTER TABLE reward_rules ADD COLUMN milestone_order_count INT NULL;
ALTER TABLE reward_rules ADD COLUMN reward_target ENUM('customer', 'referrer', 'referee', 'both') NOT NULL DEFAULT 'customer';
ALTER TABLE reward_rules ADD COLUMN priority INT NOT NULL DEFAULT 100;
ALTER TABLE reward_rules ADD COLUMN max_usage INT NULL;
ALTER TABLE reward_rules ADD COLUMN used_count INT NOT NULL DEFAULT 0;
CREATE INDEX idx_reward_rules_milestone ON reward_rules(trigger_event, status, milestone_order_count);
CREATE INDEX idx_reward_rules_active_priority ON reward_rules(trigger_event, status, priority, expiry_date);

UPDATE reward_rules
SET reward_target = 'customer', priority = COALESCE(priority, 100)
WHERE trigger_event IN ('signup', 'purchase', 'review', 'milestone');

UPDATE reward_rules
SET reward_target = 'referrer', priority = COALESCE(priority, 100)
WHERE trigger_event = 'referral' AND rule_name IN ('Referral Bonus', 'Referrer Bonus');

INSERT INTO reward_rules (rule_name, rule_type, trigger_event, reward_points, cashback_value, reward_target, priority, status, is_default)
SELECT 'New Customer Signup', 'bonus', 'signup', 500, 50.00, 'customer', 100, 'active', 1
WHERE NOT EXISTS (SELECT 1 FROM reward_rules WHERE trigger_event = 'signup' AND is_default = 1);

INSERT INTO reward_rules (rule_name, rule_type, trigger_event, reward_points, cashback_value, reward_target, priority, status, is_default)
SELECT 'Referral Bonus', 'bonus', 'referral', 300, 30.00, 'referrer', 100, 'active', 1
WHERE NOT EXISTS (SELECT 1 FROM reward_rules WHERE trigger_event = 'referral' AND reward_target IN ('referrer', 'both') AND is_default = 1);

INSERT INTO reward_rules (rule_name, rule_type, trigger_event, reward_points, cashback_value, reward_target, priority, status, is_default)
SELECT 'Referral Join Bonus', 'bonus', 'referral', 500, 50.00, 'referee', 100, 'active', 1
WHERE NOT EXISTS (SELECT 1 FROM reward_rules WHERE trigger_event = 'referral' AND reward_target IN ('referee', 'both') AND is_default = 1);

INSERT INTO reward_rules (rule_name, rule_type, trigger_event, reward_points, cashback_value, cashback_percent, reward_target, priority, status, min_order_value, is_default)
SELECT 'Purchase Cashback', 'cashback', 'purchase', 0, 0.00, 0.200, 'customer', 100, 'active', 0.00, 1
WHERE NOT EXISTS (SELECT 1 FROM reward_rules WHERE trigger_event = 'purchase' AND is_default = 1);

UPDATE reward_rules
SET cashback_percent = COALESCE(cashback_percent, 0.200),
    reward_points = CASE WHEN rule_name = 'Purchase Cashback' THEN 0 ELSE reward_points END,
    cashback_value = CASE WHEN rule_name = 'Purchase Cashback' THEN 0.00 ELSE cashback_value END,
    min_order_value = COALESCE(min_order_value, 0.00)
WHERE trigger_event = 'purchase' AND is_default = 1;

INSERT INTO reward_rules (rule_name, rule_type, trigger_event, reward_points, cashback_value, reward_target, priority, status, is_default)
SELECT 'Verified Review Reward', 'bonus', 'review', 100, 10.00, 'customer', 100, 'active', 1
WHERE NOT EXISTS (SELECT 1 FROM reward_rules WHERE trigger_event = 'review' AND is_default = 1);

INSERT INTO reward_rules (rule_name, rule_type, trigger_event, reward_points, cashback_value, milestone_order_count, reward_target, priority, status, is_default)
SELECT '5 Order Milestone', 'milestone', 'milestone', 500, 50.00, 5, 'customer', 100, 'active', 1
WHERE NOT EXISTS (SELECT 1 FROM reward_rules WHERE trigger_event = 'milestone' AND is_default = 1);

UPDATE reward_rules
SET milestone_order_count = COALESCE(milestone_order_count, 5)
WHERE trigger_event = 'milestone' AND is_default = 1;

CREATE TABLE IF NOT EXISTS customer_referral_codes (
  id                    INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id           INT UNSIGNED  NOT NULL UNIQUE,
  referral_code         VARCHAR(20)   NOT NULL UNIQUE,
  referred_by_code      VARCHAR(20)   NULL,
  referral_status       ENUM('none', 'pending', 'successful', 'blocked') NOT NULL DEFAULT 'none',
  blocked_reason        VARCHAR(255)  NULL,
  signup_ip             VARCHAR(64)   NULL,
  signup_device_hash    VARCHAR(128)  NULL,
  referred_at           DATETIME      NULL,
  successful_at         DATETIME      NULL,
  total_referrals       INT           NOT NULL DEFAULT 0,
  successful_referrals  INT           NOT NULL DEFAULT 0,
  points_earned         INT           NOT NULL DEFAULT 0,
  created_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_referral_code          (referral_code),
  INDEX idx_referral_referred_by   (referred_by_code),
  INDEX idx_referral_status        (referral_status),
  INDEX idx_referral_device        (signup_device_hash),
  CONSTRAINT fk_referral_codes_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

ALTER TABLE customer_referral_codes ADD COLUMN referral_status ENUM('none', 'pending', 'successful', 'blocked') NOT NULL DEFAULT 'none';
ALTER TABLE customer_referral_codes ADD COLUMN blocked_reason VARCHAR(255) NULL;
ALTER TABLE customer_referral_codes ADD COLUMN signup_ip VARCHAR(64) NULL;
ALTER TABLE customer_referral_codes ADD COLUMN signup_device_hash VARCHAR(128) NULL;
ALTER TABLE customer_referral_codes ADD COLUMN referred_at DATETIME NULL;
ALTER TABLE customer_referral_codes ADD COLUMN successful_at DATETIME NULL;
CREATE INDEX idx_referral_status ON customer_referral_codes(referral_status);
CREATE INDEX idx_referral_device ON customer_referral_codes(signup_device_hash);

UPDATE customer_referral_codes
SET referral_status = 'pending',
    referred_at = COALESCE(referred_at, created_at)
WHERE referred_by_code IS NOT NULL
  AND referral_status = 'none';

CREATE TABLE IF NOT EXISTS delivery_pincodes (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  state           VARCHAR(120) NOT NULL,
  pincode         VARCHAR(6) NOT NULL,
  cod_available   TINYINT(1) NOT NULL DEFAULT 0,
  status          ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by      INT UNSIGNED NULL,
  updated_by      INT UNSIGNED NULL,
  created_by_name VARCHAR(160) NULL,
  updated_by_name VARCHAR(160) NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_delivery_pincodes_pincode (pincode),
  INDEX idx_delivery_pincodes_state (state),
  INDEX idx_delivery_pincodes_status_cod (status, cod_available),
  CONSTRAINT fk_delivery_pincodes_created_by FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL,
  CONSTRAINT fk_delivery_pincodes_updated_by FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL
);
