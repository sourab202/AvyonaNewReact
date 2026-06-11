CREATE TABLE IF NOT EXISTS coupon_categories (
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
);

SET @cod_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'categories'
    AND COLUMN_NAME = 'cod_enabled'
);
SET @cod_column_sql = IF(
  @cod_column_exists = 0,
  'ALTER TABLE categories ADD COLUMN cod_enabled TINYINT(1) NOT NULL DEFAULT 1',
  'SELECT 1'
);
PREPARE cod_column_statement FROM @cod_column_sql;
EXECUTE cod_column_statement;
DEALLOCATE PREPARE cod_column_statement;

INSERT INTO app_settings (setting_key, setting_value, setting_group)
VALUES ('cod_enabled', 'true', 'payment')
ON DUPLICATE KEY UPDATE setting_group = VALUES(setting_group);

SET @fulltext_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND INDEX_NAME = 'idx_products_fulltext_search'
);
SET @fulltext_index_sql = IF(
  @fulltext_index_exists = 0,
  'ALTER TABLE products ADD FULLTEXT INDEX idx_products_fulltext_search (name, brand, asin, sku, barcode, model_number, short_description, description)',
  'SELECT 1'
);
PREPARE fulltext_index_statement FROM @fulltext_index_sql;
EXECUTE fulltext_index_statement;
DEALLOCATE PREPARE fulltext_index_statement;

ALTER TABLE analytics_abandoned_carts
  ADD COLUMN IF NOT EXISTS customer_id INT UNSIGNED NULL AFTER session_id,
  ADD COLUMN IF NOT EXISTS last_cart_at TIMESTAMP NULL AFTER cart_value,
  ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER last_cart_at;
