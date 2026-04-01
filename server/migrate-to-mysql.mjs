import Database from "better-sqlite3";
import mysql from "mysql2/promise";
import fs from "fs";

const SQLITE_DB = "./pasticceria.db";

const MYSQL_CONFIG = {
  host: "localhost",
  user: "root",
  password: "",
  database: "pasticceria"
};

async function migrate() {

  console.log("Connessione SQLite...");
  const sqlite = new Database(SQLITE_DB);

  console.log("Connessione MySQL...");
  const mysqlConn = await mysql.createConnection(MYSQL_CONFIG);

  console.log("Creazione tabelle MySQL...");
  
  await mysqlConn.execute(`DROP TABLE IF EXISTS orders`);
await mysqlConn.execute(`DROP TABLE IF EXISTS sub_products`);
await mysqlConn.execute(`DROP TABLE IF EXISTS products`);

  await mysqlConn.execute(`
  CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    category VARCHAR(100),
    vat_rate INT
  )
  `);

  await mysqlConn.execute(`
  CREATE TABLE IF NOT EXISTS sub_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT,
    name VARCHAR(255),
    price_cents INT,
    is_default BOOLEAN
  )
  `);

 await mysqlConn.execute(`
  CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    legacy_id INT NULL,
    data JSON
  )
`);

  console.log("Migrazione ORDERS...");

  const orders = sqlite.prepare("SELECT * FROM orders").all();

  for (const order of orders) {
  await mysqlConn.execute(
    "INSERT INTO orders (legacy_id,data) VALUES (?,?)",
    [order.id ?? null, JSON.stringify(order)]
  );
}

  console.log("Ordini migrati:", orders.length);

 console.log("Migrazione prodotti dal seed...");

const { products: seed } = await import("./data/products.js");

for (const product of seed) {
  const [result] = await mysqlConn.execute(
    "INSERT INTO products (name,category,vat_rate) VALUES (?,?,?)",
    [product.name, product.category || null, 10]
  );

  if (product.subProducts) {
    for (const sub of product.subProducts) {
      await mysqlConn.execute(
        `INSERT INTO sub_products
         (product_id,name,price_cents,is_default)
         VALUES (?,?,?,?)`,
        [
          result.insertId,
          sub.name,
          sub.priceCents || 0,
          sub.isDefault ? 1 : 0
        ]
      );
    }
  }
}

console.log("Prodotti migrati:", seed.length);

  await mysqlConn.end();

  console.log("Migrazione completata");

}

migrate().catch(err => {
  console.error("Errore:", err);
});