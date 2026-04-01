-- Schema MySQL per il gestionale pasticceria
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(120) NULL,
  allowPersons TINYINT(1) NOT NULL DEFAULT 1,
  allowWeight TINYINT(1) NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  createdAt VARCHAR(40) NOT NULL,
  updatedAt VARCHAR(40) NOT NULL,
  INDEX idx_products_category (category),
  INDEX idx_products_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sub_products (
  id VARCHAR(80) PRIMARY KEY,
  productId VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(64) NULL,
  priceCents INT NULL,
  isDefault TINYINT(1) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  createdAt VARCHAR(40) NOT NULL,
  updatedAt VARCHAR(40) NOT NULL,
  CONSTRAINT fk_sub_products_product FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_sub_products_product (productId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(80) PRIMARY KEY,
  deliveryDateTime VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL,
  data JSON NOT NULL,
  INDEX idx_orders_delivery (deliveryDateTime),
  INDEX idx_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
