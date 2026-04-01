MIGRAZIONE SQLITE -> MYSQL

1) Crea un database MySQL, ad esempio:
   CREATE DATABASE pasticceria CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

2) Nel backend installa le dipendenze:
   npm i mysql2 better-sqlite3

3) Crea lo schema e migra i dati:
   node ../mysql-migration/migrate-sqlite-to-mysql.mjs --sqlite ./pasticceria.db --mysql "mysql://root:PASSWORD@localhost:3306/pasticceria" --create-schema

4) Se vuoi rilanciare la migrazione senza ricreare lo schema:
   node ../mysql-migration/migrate-sqlite-to-mysql.mjs --sqlite ./pasticceria.db --mysql "mysql://root:PASSWORD@localhost:3306/pasticceria"

Note:
- Lo script usa UPSERT: se lo rilanci non duplica i record.
- Migra queste tabelle, se presenti: products, sub_products, orders.
- La tabella orders mantiene il campo data come JSON MySQL.
- I campi data/ora restano come stringhe ISO per non rompere il backend attuale.
