import { query } from "../config/db.js";

async function columnExists(tableName, columnName) {
  const rows = await query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return Boolean(rows[0]);
}

async function indexExists(tableName, indexName) {
  const rows = await query(
    `SELECT 1
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
     LIMIT 1`,
    [tableName, indexName]
  );
  return Boolean(rows[0]);
}

export async function runSchemaMigrations() {
  await query(
    `CREATE TABLE IF NOT EXISTS abandoned_checkouts (
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
    )`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS abandoned_checkout_events (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      abandoned_checkout_id INT UNSIGNED NOT NULL,
      event_type VARCHAR(80) NOT NULL,
      event_data JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_abandoned_checkout_events_checkout (abandoned_checkout_id, created_at),
      CONSTRAINT fk_abandoned_checkout_events_checkout
        FOREIGN KEY (abandoned_checkout_id) REFERENCES abandoned_checkouts(id) ON DELETE CASCADE
    )`
  );

  await query(
    `CREATE TABLE IF NOT EXISTS coupon_categories (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      coupon_id INT UNSIGNED NOT NULL,
      category_id INT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_coupon_category (coupon_id, category_id),
      INDEX idx_coupon_categories_category_id (category_id),
      CONSTRAINT fk_coupon_categories_coupon
        FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
      CONSTRAINT fk_coupon_categories_category
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    )`
  );

  if (!(await columnExists("categories", "cod_enabled"))) {
    await query(
      "ALTER TABLE categories ADD COLUMN cod_enabled TINYINT(1) NOT NULL DEFAULT 1"
    );
  }

  await query(
    `INSERT INTO app_settings (setting_key, setting_value, setting_group)
     VALUES ('cod_enabled', 'true', 'payment')
     ON DUPLICATE KEY UPDATE setting_group = VALUES(setting_group)`
  );

  if (!(await indexExists("products", "idx_products_fulltext_search"))) {
    await query(
      `ALTER TABLE products
       ADD FULLTEXT INDEX idx_products_fulltext_search
       (name, brand, asin, sku, barcode, model_number, short_description, description)`
    );
  }

  if (!(await columnExists("analytics_abandoned_carts", "customer_id"))) {
    await query(
      "ALTER TABLE analytics_abandoned_carts ADD COLUMN customer_id INT UNSIGNED NULL AFTER session_id"
    );
  }
  if (!(await columnExists("analytics_abandoned_carts", "last_cart_at"))) {
    await query(
      "ALTER TABLE analytics_abandoned_carts ADD COLUMN last_cart_at TIMESTAMP NULL AFTER cart_value"
    );
  }
  if (!(await columnExists("analytics_abandoned_carts", "abandoned_at"))) {
    await query(
      "ALTER TABLE analytics_abandoned_carts ADD COLUMN abandoned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER last_cart_at"
    );
  }
  if (!(await indexExists("analytics_abandoned_carts", "uq_abandoned_cart_session_event"))) {
    await query(
      `ALTER TABLE analytics_abandoned_carts
       ADD UNIQUE INDEX uq_abandoned_cart_session_event (session_id, last_cart_event_id)`
    );
  }
  if (!(await indexExists("analytics_abandoned_carts", "idx_abandoned_carts_metric"))) {
    await query(
      `ALTER TABLE analytics_abandoned_carts
       ADD INDEX idx_abandoned_carts_metric (metric_recorded, abandoned_at)`
    );
  }
}
