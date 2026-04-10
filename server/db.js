import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root123",
  database: process.env.DB_NAME || "pasticceria",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
});

export async function testConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    console.log("✅ Connesso a MySQL");
  } finally {
    conn.release();
  }
}

async function hasTable(tableName) {
  const [rows] = await pool.query(
    `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `,
    [tableName]
  );

  return rows.length > 0;
}

async function hasColumn(tableName, columnName) {
  const [rows] = await pool.query(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [tableName, columnName]
  );

  return rows.length > 0;
}

async function ensureColumn(tableName, columnName, definitionSql) {
  const exists = await hasColumn(tableName, columnName);
  if (!exists) {
    await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${definitionSql}`);
  }
}

async function ensureIndex(tableName, indexName, sql) {
  const [rows] = await pool.query(
    `
      SELECT INDEX_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `,
    [tableName, indexName]
  );

  if (!rows.length) {
    await pool.query(sql);
  }
}

async function ensureForeignKeyProductsCategory() {
  const [fkRows] = await pool.query(
    `
      SELECT CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'products'
        AND COLUMN_NAME = 'category_id'
        AND REFERENCED_TABLE_NAME = 'categories'
    `
  );

  if (!fkRows.length) {
    try {
      await pool.query(`
        ALTER TABLE products
        ADD CONSTRAINT fk_products_category
        FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON DELETE SET NULL
      `);
    } catch (err) {
      const message = String(err.message || "");
      if (
        !message.includes("Duplicate") &&
        !message.includes("already exists")
      ) {
        console.warn("FK products.category_id non aggiunta:", err.message);
      }
    }
  }
}

async function migrateLegacyProductCategories() {
  const hasProducts = await hasTable("products");
  const hasCategories = await hasTable("categories");

  if (!hasProducts || !hasCategories) return;

  const hasCategoryText = await hasColumn("products", "category");
  const hasCategoryId = await hasColumn("products", "category_id");

  if (!hasCategoryText || !hasCategoryId) return;

  const [legacyProducts] = await pool.query(`
    SELECT id, category
    FROM products
    WHERE category IS NOT NULL
      AND TRIM(category) <> ''
      AND category_id IS NULL
  `);

  for (const row of legacyProducts) {
    const categoryName = String(row.category || "").trim();
    if (!categoryName) continue;

    const [existingCategory] = await pool.query(
      "SELECT id FROM categories WHERE LOWER(name) = LOWER(?) LIMIT 1",
      [categoryName]
    );

    let categoryId = existingCategory[0]?.id;

    if (!categoryId) {
      const [result] = await pool.execute(
        "INSERT INTO categories (name) VALUES (?)",
        [categoryName]
      );
      categoryId = result.insertId;
    }

    await pool.execute(
      "UPDATE products SET category_id = ? WHERE id = ?",
      [categoryId, row.id]
    );
  }
}

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_categories_name (name)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(120) NULL,
      vat_rate INT NOT NULL DEFAULT 10,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn(
    "products",
    "category_id",
    "category_id INT NULL AFTER name"
  );

  await ensureColumn(
    "products",
    "status",
    "status VARCHAR(20) NOT NULL DEFAULT 'active' AFTER vat_rate"
  );

  await ensureColumn(
    "products",
    "allow_persons",
    "allow_persons TINYINT(1) NOT NULL DEFAULT 1 AFTER status"
  );

  await ensureColumn(
    "products",
    "allow_weight",
    "allow_weight TINYINT(1) NOT NULL DEFAULT 1 AFTER allow_persons"
  );

  await ensureColumn(
    "products",
    "created_at",
    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  );

  await ensureIndex(
    "products",
    "idx_products_category_id",
    "CREATE INDEX idx_products_category_id ON products (category_id)"
  );

  await ensureForeignKeyProductsCategory();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sub_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      price_cents INT NOT NULL DEFAULT 0,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  await ensureColumn(
    "sub_products",
    "sku",
    "sku VARCHAR(64) NULL AFTER name"
  );

  await ensureColumn(
    "sub_products",
    "notes",
    "notes TEXT NULL AFTER is_default"
  );

  await ensureIndex(
    "sub_products",
    "idx_sub_products_product_id",
    "CREATE INDEX idx_sub_products_product_id ON sub_products (product_id)"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      legacy_id INT NULL,
      data JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(80) NOT NULL,
      pin_hash VARCHAR(255) NOT NULL,
      ruolo ENUM('admin','operatore','produzione') NOT NULL DEFAULT 'operatore',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_users_username (username)
    )
  `);

  // Crea utente admin di default se non esiste nessun utente
  const [userCount] = await pool.query("SELECT COUNT(*) AS cnt FROM users");
  if (userCount[0].cnt === 0) {
    const bcrypt = await import("bcryptjs");
    const defaultHash = await bcrypt.default.hash("1234", 10);
    await pool.execute(
      "INSERT INTO users (username, pin_hash, ruolo) VALUES (?, ?, ?)",
      ["admin", defaultHash, "admin"]
    );
    console.log("Utente admin creato con PIN 1234 — cambialo subito!");
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS variants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_variants_name (name)
    )
  `);

  await migrateLegacyProductCategories();

  console.log("✅ Tabelle MySQL verificate");
}

export const query = (...args) => pool.query(...args);
export const execute = (...args) => pool.execute(...args);
export const getConnection = () => pool.getConnection();

export default pool;