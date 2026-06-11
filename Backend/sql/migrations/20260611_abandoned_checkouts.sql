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
