#!/usr/bin/env node
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import mysql from "mysql2/promise";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const sqlitePath = arg("--sqlite", "./pasticceria.db");
const mysqlUrl = arg("--mysql") || process.env.MYSQL_URL;
const createSchema = process.argv.includes("--create-schema");

if (!mysqlUrl) {
  console.error("Manca la connessione MySQL. Usa --mysql \"mysql://user:pass@localhost:3306/pasticceria\" oppure MYSQL_URL.");
  process.exit(1);
}

if (!fs.existsSync(sqlitePath)) {
  console.error(`File SQLite non trovato: ${sqlitePath}`);
  process.exit(1);
}

function tableExists(sqlite, name) {
  const row = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);
  return !!row;
}

async function main() {
  const sqlite = new Database(sqlitePath, { readonly: true });
  const mysqlConn = await mysql.createConnection(mysqlUrl);

  try {
    if (createSchema) {
      const schemaPath = path.join(path.dirname(new URL(import.meta.url).pathname), "schema.sql");
      const schemaSql = fs.readFileSync(schemaPath, "utf8");
      const statements = schemaSql
        .split(/;\s*\n/g)
        .map(s => s.trim())
        .filter(Boolean);
      for (const stmt of statements) {
        await mysqlConn.query(stmt);
      }
      console.log("Schema MySQL creato/verificato.");
    }

    await mysqlConn.beginTransaction();
    await mysqlConn.query("SET FOREIGN_KEY_CHECKS = 0");

    const counts = { products: 0, sub_products: 0, orders: 0 };

    if (tableExists(sqlite, "products")) {
      const rows = sqlite.prepare("SELECT * FROM products").all();
      for (const r of rows) {
        await mysqlConn.execute(
          `INSERT INTO products (id, name, category, allowPersons, allowWeight, status, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             category = VALUES(category),
             allowPersons = VALUES(allowPersons),
             allowWeight = VALUES(allowWeight),
             status = VALUES(status),
             createdAt = VALUES(createdAt),
             updatedAt = VALUES(updatedAt)`,
          [
            r.id,
            r.name,
            r.category ?? null,
            Number(r.allowPersons ?? 1),
            Number(r.allowWeight ?? 1),
            r.status ?? "active",
            r.createdAt,
            r.updatedAt,
          ]
        );
        counts.products++;
      }
    }

    if (tableExists(sqlite, "sub_products")) {
      const rows = sqlite.prepare("SELECT * FROM sub_products").all();
      for (const r of rows) {
        await mysqlConn.execute(
          `INSERT INTO sub_products (id, productId, name, sku, priceCents, isDefault, notes, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             productId = VALUES(productId),
             name = VALUES(name),
             sku = VALUES(sku),
             priceCents = VALUES(priceCents),
             isDefault = VALUES(isDefault),
             notes = VALUES(notes),
             createdAt = VALUES(createdAt),
             updatedAt = VALUES(updatedAt)`,
          [
            r.id,
            r.productId,
            r.name,
            r.sku ?? null,
            r.priceCents ?? null,
            Number(r.isDefault ?? 0),
            r.notes ?? null,
            r.createdAt,
            r.updatedAt,
          ]
        );
        counts.sub_products++;
      }
    }

    if (tableExists(sqlite, "orders")) {
      const rows = sqlite.prepare("SELECT * FROM orders").all();
      for (const r of rows) {
        let data = r.data;
        try {
          data = JSON.stringify(JSON.parse(r.data));
        } catch {
          data = JSON.stringify({ raw: r.data });
        }

        await mysqlConn.execute(
          `INSERT INTO orders (id, deliveryDateTime, status, data)
           VALUES (?, ?, ?, CAST(? AS JSON))
           ON DUPLICATE KEY UPDATE
             deliveryDateTime = VALUES(deliveryDateTime),
             status = VALUES(status),
             data = VALUES(data)`,
          [r.id, r.deliveryDateTime, r.status, data]
        );
        counts.orders++;
      }
    }

    await mysqlConn.query("SET FOREIGN_KEY_CHECKS = 1");
    await mysqlConn.commit();

    console.log("Migrazione completata.");
    console.log(JSON.stringify(counts, null, 2));
  } catch (err) {
    await mysqlConn.rollback();
    console.error("Errore migrazione:", err.message);
    process.exitCode = 1;
  } finally {
    await mysqlConn.end();
    sqlite.close();
  }
}

main();
