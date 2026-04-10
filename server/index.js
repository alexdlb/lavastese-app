import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import {
  query,
  execute,
  testConnection,
  initDb,
} from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "lavastese_secret_change_in_production";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "20mb" }));

/* =========================
   UPLOAD CONFIG
========================= */

const uploadsRoot = path.join(__dirname, "uploads");
const ordersDir = path.join(uploadsRoot, "orders");
const signaturesDir = path.join(uploadsRoot, "signatures");

[uploadsRoot, ordersDir, signaturesDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "signature") {
      cb(null, signaturesDir);
    } else {
      cb(null, ordersDir);
    }
  },
  filename: (req, file, cb) => {
    const safeName = String(file.originalname || "file").replace(/\s+/g, "-");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({ storage });

app.use("/uploads", express.static(uploadsRoot));

/* =========================
   HELPERS
========================= */

function safeParseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function extractBase64Signature(order) {
  if (!order || typeof order !== "object") return "";

  const candidates = [
    order.signature,
    order.signatureDataUrl,
    order.signatureUrl, // se per errore ci finisce il base64
  ];

  for (const value of candidates) {
    if (typeof value !== "string") continue;
    if (value.startsWith("data:image/png;base64,")) {
      return value;
    }
  }

  return "";
}

function saveBase64SignatureToFile(signatureValue) {
  if (!signatureValue || typeof signatureValue !== "string") return "";

  const match = signatureValue.match(/^data:image\/png;base64,(.+)$/);
  if (!match) return "";

  const base64 = match[1];
  const filename = `${Date.now()}-signature.png`;
  const filePath = path.join(signaturesDir, filename);

  fs.writeFileSync(filePath, Buffer.from(base64, "base64"));

  return `/uploads/signatures/${filename}`;
}

function ensureOrderSignatureUrl(order) {
  if (!order || typeof order !== "object") return order;

  if (
    typeof order.signatureUrl === "string" &&
    order.signatureUrl.startsWith("/uploads/signatures/")
  ) {
    return order;
  }

  const base64Signature = extractBase64Signature(order);

  if (base64Signature) {
    const signatureUrl = saveBase64SignatureToFile(base64Signature);
    if (signatureUrl) {
      order.signatureUrl = signatureUrl;
    }
  }

  return order;
}

function normalizeOrderRow(row) {
  const parsed = safeParseJson(row.data);

  if (parsed && typeof parsed === "object") {
    parsed.id = row.id;

    // Compatibilità con ordini vecchi o nuovi
    ensureOrderSignatureUrl(parsed);

    return parsed;
  }

  return { id: row.id };
}

/* =========================
   HEALTH
========================= */

app.get("/api/health", async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

/* =========================
   AUTH MIDDLEWARE
========================= */

function requireAuth(...ruoli) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token  = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Non autenticato" });
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;

      if (ruoli.length > 0 && !ruoli.includes(payload.ruolo)) {
        return res.status(403).json({ error: "Permesso negato" });
      }

      next();
    } catch {
      return res.status(401).json({ error: "Token non valido o scaduto" });
    }
  };
}

/* =========================
   AUTH ROUTES
========================= */

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, pin } = req.body || {};

    if (!username || !pin) {
      return res.status(400).json({ error: "Username e PIN obbligatori" });
    }

    const [rows] = await query(
      "SELECT * FROM users WHERE username = ? LIMIT 1",
      [String(username).trim()]
    );

    if (!rows.length) {
      return res.status(401).json({ error: "Credenziali non valide" });
    }

    const user = rows[0];
    const pinOk = await bcrypt.compare(String(pin), user.pin_hash);

    if (!pinOk) {
      return res.status(401).json({ error: "Credenziali non valide" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, ruolo: user.ruolo },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, ruolo: user.ruolo },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore login" });
  }
});

// Dati utente corrente
app.get("/api/auth/me", requireAuth(), (req, res) => {
  res.json({ user: req.user });
});

// Logout (lato server non serve, il client elimina il token)
app.post("/api/auth/logout", (req, res) => {
  res.json({ ok: true });
});

/* =========================
   USERS (solo admin)
========================= */

app.get("/api/users", requireAuth("admin"), async (req, res) => {
  try {
    const [rows] = await query(
      "SELECT id, username, ruolo, created_at FROM users ORDER BY username ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore lettura utenti" });
  }
});

app.post("/api/users", requireAuth("admin"), async (req, res) => {
  try {
    const { username, pin, ruolo } = req.body || {};

    if (!username || !pin || !ruolo) {
      return res.status(400).json({ error: "Username, PIN e ruolo obbligatori" });
    }

    if (!["admin", "operatore", "produzione"].includes(ruolo)) {
      return res.status(400).json({ error: "Ruolo non valido" });
    }

    if (String(pin).length < 4 || String(pin).length > 8) {
      return res.status(400).json({ error: "Il PIN deve essere di 4-8 cifre" });
    }

    const [existing] = await query(
      "SELECT id FROM users WHERE username = ? LIMIT 1",
      [String(username).trim()]
    );

    if (existing.length) {
      return res.status(409).json({ error: "Username già esistente" });
    }

    const pin_hash = await bcrypt.hash(String(pin), 10);

    const [result] = await execute(
      "INSERT INTO users (username, pin_hash, ruolo) VALUES (?, ?, ?)",
      [String(username).trim(), pin_hash, ruolo]
    );

    res.status(201).json({
      id: result.insertId,
      username: String(username).trim(),
      ruolo,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore creazione utente" });
  }
});

app.patch("/api/users/:id", requireAuth("admin"), async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { pin, ruolo } = req.body || {};

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "ID utente non valido" });
    }

    const [exists] = await query("SELECT id FROM users WHERE id = ?", [userId]);
    if (!exists.length) {
      return res.status(404).json({ error: "Utente non trovato" });
    }

    if (pin) {
      if (String(pin).length < 4 || String(pin).length > 8) {
        return res.status(400).json({ error: "Il PIN deve essere di 4-8 cifre" });
      }
      const pin_hash = await bcrypt.hash(String(pin), 10);
      await execute("UPDATE users SET pin_hash = ? WHERE id = ?", [pin_hash, userId]);
    }

    if (ruolo) {
      if (!["admin", "operatore", "produzione"].includes(ruolo)) {
        return res.status(400).json({ error: "Ruolo non valido" });
      }
      await execute("UPDATE users SET ruolo = ? WHERE id = ?", [ruolo, userId]);
    }

    const [rows] = await query(
      "SELECT id, username, ruolo FROM users WHERE id = ?",
      [userId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore modifica utente" });
  }
});

app.delete("/api/users/:id", requireAuth("admin"), async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "ID utente non valido" });
    }

    // Impedisce di eliminare se stesso
    if (userId === req.user.id) {
      return res.status(400).json({ error: "Non puoi eliminare il tuo account" });
    }

    const [exists] = await query("SELECT id FROM users WHERE id = ?", [userId]);
    if (!exists.length) {
      return res.status(404).json({ error: "Utente non trovato" });
    }

    await execute("DELETE FROM users WHERE id = ?", [userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore eliminazione utente" });
  }
});

/* =========================
   UPLOAD FOTO
========================= */

app.post("/api/upload-order-photo", requireAuth("admin","operatore"), upload.single("photo"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Nessun file" });
  }

  const photoUrl = `/uploads/orders/${req.file.filename}`;
  res.json({ photoUrl });
});

/* =========================
   UPLOAD FIRMA
========================= */

app.post("/api/upload-signature", requireAuth("admin","operatore"), upload.single("signature"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Nessuna firma" });
  }

  const signatureUrl = `/uploads/signatures/${req.file.filename}`;
  res.json({ signatureUrl });
});

/* =========================
   ORDERS
========================= */

app.get("/api/orders", requireAuth("admin","operatore"), async (req, res) => {
  try {
    const [rows] = await query("SELECT * FROM orders ORDER BY id DESC");
    res.json(rows.map(normalizeOrderRow));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore lettura ordini" });
  }
});

app.get("/api/orders/:id", requireAuth("admin","operatore"), async (req, res) => {
  try {
    const [rows] = await query("SELECT * FROM orders WHERE id = ?", [
      req.params.id,
    ]);

    if (!rows.length) {
      return res.status(404).json({ error: "Ordine non trovato" });
    }

    res.json(normalizeOrderRow(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore lettura ordine" });
  }
});

app.post("/api/orders", requireAuth("admin","operatore"), async (req, res) => {
  try {
    let order = req.body || {};
    order = ensureOrderSignatureUrl(order);

    const [result] = await execute(
      "INSERT INTO orders (data) VALUES (?)",
      [JSON.stringify(order)]
    );

    order.id = result.insertId;

    await execute("UPDATE orders SET data = ? WHERE id = ?", [
      JSON.stringify(order),
      order.id,
    ]);

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore salvataggio ordine" });
  }
});

app.put("/api/orders/:id", requireAuth("admin","operatore","produzione"), async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: "ID ordine non valido" });
    }

    const [existing] = await query(
      "SELECT id FROM orders WHERE id = ?",
      [orderId]
    );

    if (!existing.length) {
      return res.status(404).json({ error: "Ordine non trovato" });
    }

    let order = req.body || {};
    order.id = orderId;
    order = ensureOrderSignatureUrl(order);

    await execute("UPDATE orders SET data = ? WHERE id = ?", [
      JSON.stringify(order),
      orderId,
    ]);

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore modifica ordine" });
  }
});

app.delete("/api/orders/:id", requireAuth("admin","operatore"), async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: "ID ordine non valido" });
    }

    const [existing] = await query(
      "SELECT id FROM orders WHERE id = ?",
      [orderId]
    );

    if (!existing.length) {
      return res.status(404).json({ error: "Ordine non trovato" });
    }

    await execute("DELETE FROM orders WHERE id = ?", [orderId]);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore eliminazione ordine" });
  }
});

/* =========================
   PDF ORDINE
========================= */

app.get("/api/orders/:id/pdf", requireAuth("admin","operatore"), async (req, res) => {
  try {
    const [rows] = await query("SELECT * FROM orders WHERE id = ?", [
      req.params.id,
    ]);

    if (!rows.length) {
      return res.status(404).json({ error: "Ordine non trovato" });
    }

    const order = normalizeOrderRow(rows[0]);

    const doc = new PDFDocument({ margin: 50, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="ordine-${order.id}.pdf"`
    );
    doc.pipe(res);

    const pageW = doc.page.width;
    const margin = 50;
    const contentW = pageW - margin * 2;

    // ── HELPER: linea separatrice ──
    function hr(y) {
      doc.moveTo(margin, y).lineTo(pageW - margin, y)
        .strokeColor("#e4e7ec").lineWidth(1).stroke();
    }

    function label(text, x, y) {
      doc.fontSize(8).fillColor("#7a8899")
        .font("Helvetica-Bold")
        .text(text.toUpperCase(), x, y, { characterSpacing: 0.5 });
    }

    function value(text, x, y, opts) {
      doc.fontSize(11).fillColor("#0f1923")
        .font("Helvetica")
        .text(text, x, y, opts || {});
    }

    // ── HEADER: logo + titolo ──
    const logoPath = path.join(__dirname, "uploads", "logo", "lavastese.png");
    let headerY = margin;

    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, margin, headerY, { height: 48, fit: [160, 48] });
      } catch (e) {
        doc.fontSize(22).font("Helvetica-Bold").fillColor("#0f1923")
          .text("Lavastese", margin, headerY);
      }
    } else {
      doc.fontSize(22).font("Helvetica-Bold").fillColor("#0f1923")
        .text("Lavastese", margin, headerY);
    }

    // Scritta "Scheda Ordine" allineata a destra
    doc.fontSize(10).font("Helvetica").fillColor("#7a8899")
      .text("Scheda Ordine #" + (order.id || "-"), margin, headerY + 16, {
        width: contentW,
        align: "right",
      });

    doc.fontSize(8).fillColor("#7a8899")
      .text(
        new Date().toLocaleDateString("it-IT", {
          day: "2-digit", month: "long", year: "numeric",
        }),
        margin, headerY + 30,
        { width: contentW, align: "right" }
      );

    headerY += 60;
    hr(headerY);
    headerY += 16;

    // ── DATI CLIENTE ──
    label("Cliente", margin, headerY);
    headerY += 14;
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#0f1923")
      .text(order.customer?.name || "-", margin, headerY);
    headerY += 18;

    // Telefono ed email sulla stessa riga
    const phone = order.customer?.phone || "";
    const email = order.customer?.email || "";
    doc.fontSize(10).font("Helvetica").fillColor("#3d4a5a")
      .text(
        [phone, email].filter(Boolean).join("   |   ") || "-",
        margin, headerY
      );
    headerY += 24;
    hr(headerY);
    headerY += 16;

    // ── DATA E ORA RITIRO/CONSEGNA ──
    const tipo = order.fulfillment?.type === "delivery" ? "Consegna" : "Ritiro";
    label(tipo, margin, headerY);
    headerY += 14;

    const dtRaw = order.fulfillment?.deliveryDateTime;
    let dtFormatted = "-";
    if (dtRaw) {
      try {
        const d = new Date(dtRaw);
        const giorno = d.toLocaleDateString("it-IT", {
          weekday: "long", day: "2-digit", month: "long", year: "numeric",
        });
        const ora = d.toLocaleTimeString("it-IT", {
          hour: "2-digit", minute: "2-digit",
        });
        dtFormatted = giorno.charAt(0).toUpperCase() + giorno.slice(1) + " — ore " + ora;
      } catch { dtFormatted = dtRaw; }
    }

    doc.fontSize(12).font("Helvetica-Bold").fillColor("#2563eb")
      .text(dtFormatted, margin, headerY);
    headerY += 24;
    hr(headerY);
    headerY += 16;

    // ── PRODOTTI ──
    label("Prodotti ordinati", margin, headerY);
    headerY += 14;

    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) {
      doc.fontSize(11).font("Helvetica").fillColor("#7a8899")
        .text("Nessun prodotto", margin, headerY);
      headerY += 18;
    } else {
      items.forEach((it) => {
        // Nome prodotto
        doc.fontSize(12).font("Helvetica-Bold").fillColor("#0f1923")
          .text(it.productName || "-", margin, headerY);
        headerY += 16;

        // Dettagli: peso, persone, allergeni
        const details = [];
        if (it.weightGrams) details.push((it.weightGrams / 1000).toFixed(1) + " kg");
        if (it.persons)     details.push(it.persons + " persone");
        if (it.allergenOption && it.allergenOption !== "standard") {
          details.push(it.allergenOption.replace(/_/g, " "));
        }

        if (details.length) {
          doc.fontSize(10).font("Helvetica").fillColor("#3d4a5a")
            .text(details.join("   ·   "), margin + 10, headerY);
          headerY += 14;
        }

        // Note prodotto
        if (it.notes) {
          doc.fontSize(9).font("Helvetica").fillColor("#7a8899")
            .text("Note: " + it.notes, margin + 10, headerY);
          headerY += 14;
        }

        headerY += 4;
      });
    }

    // Note ordine
    if (order.notes) {
      hr(headerY);
      headerY += 14;
      label("Note ordine", margin, headerY);
      headerY += 14;
      doc.fontSize(10).font("Helvetica").fillColor("#3d4a5a")
        .text(order.notes, margin, headerY, { width: contentW });
      headerY += doc.heightOfString(order.notes, { width: contentW }) + 10;
    }

    hr(headerY);
    headerY += 16;

    // ── FIRMA ──
    label("Firma cliente", margin, headerY);
    headerY += 14;

    let firmaOk = false;

    if (order.signatureUrl && order.signatureUrl.startsWith("/uploads/signatures/")) {
      try {
        const rel = order.signatureUrl.startsWith("/")
          ? order.signatureUrl.slice(1) : order.signatureUrl;
        const filePath = path.join(__dirname, rel);
        if (fs.existsSync(filePath)) {
          doc.image(filePath, margin, headerY, { width: 220 });
          firmaOk = true;
          headerY += 100;
        }
      } catch (e) {
        console.warn("Errore firma PDF file:", e.message);
      }
    }

    if (!firmaOk) {
      const base64Sig = extractBase64Signature(order);
      if (base64Sig) {
        try {
          const b64 = base64Sig.replace(/^data:image\/png;base64,/, "");
          const img = Buffer.from(b64, "base64");
          doc.image(img, margin, headerY, { width: 220 });
          headerY += 100;
        } catch (e) {
          console.warn("Errore firma PDF base64:", e.message);
          doc.fontSize(10).fillColor("#7a8899").text("Firma non disponibile", margin, headerY);
          headerY += 18;
        }
      } else {
        doc.fontSize(10).font("Helvetica").fillColor("#7a8899")
          .text("Nessuna firma", margin, headerY);
        headerY += 18;
      }
    }

    // ── OPERATORE (footer) ──
    if (order.operatore) {
      headerY += 10;
      doc.fontSize(8).font("Helvetica").fillColor("#a8b4c0")
        .text("Ordine inserito da: " + order.operatore, margin, headerY);
    }

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore PDF" });
  }
});

/* =========================
   VARIANTS
========================= */

app.get("/api/variants", requireAuth("admin","operatore"), async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const limit  = Math.min(Number(req.query.limit || 100), 200);
    const params = [];
    let where = "";
    if (search) { where = "WHERE name LIKE ?"; params.push(`${search}%`); }
    const [rows] = await query(
      `SELECT id, name FROM variants ${where} ORDER BY name ASC LIMIT ?`,
      [...params, limit]
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: "Errore lettura varianti" }); }
});

app.post("/api/variants", requireAuth("admin"), async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "Nome obbligatorio" });
    const [existing] = await query("SELECT id FROM variants WHERE LOWER(name)=LOWER(?) LIMIT 1", [name]);
    if (existing.length) return res.status(409).json({ error: "Variante già esistente" });
    const [result] = await execute("INSERT INTO variants (name) VALUES (?)", [name]);
    res.status(201).json({ id: result.insertId, name });
  } catch (err) { console.error(err); res.status(500).json({ error: "Errore creazione variante" }); }
});

app.patch("/api/variants/:id", requireAuth("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body?.name || "").trim();
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID non valido" });
    if (!name) return res.status(400).json({ error: "Nome obbligatorio" });
    const [exists] = await query("SELECT id FROM variants WHERE id=?", [id]);
    if (!exists.length) return res.status(404).json({ error: "Variante non trovata" });
    const [dup] = await query("SELECT id FROM variants WHERE LOWER(name)=LOWER(?) AND id<>? LIMIT 1", [name, id]);
    if (dup.length) return res.status(409).json({ error: "Nome già in uso" });
    await execute("UPDATE variants SET name=? WHERE id=?", [name, id]);
    res.json({ id, name });
  } catch (err) { console.error(err); res.status(500).json({ error: "Errore modifica variante" }); }
});

app.delete("/api/variants/:id", requireAuth("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID non valido" });
    const [exists] = await query("SELECT id FROM variants WHERE id=?", [id]);
    if (!exists.length) return res.status(404).json({ error: "Variante non trovata" });
    await execute("DELETE FROM variants WHERE id=?", [id]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Errore eliminazione variante" }); }
});

/* =========================
   CATEGORIES
========================= */

app.get("/api/categories", requireAuth("admin"), async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const limitRaw = Number(req.query.limit || 50);
    const limit =
      Number.isInteger(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, 100)
        : 50;

    const params = [];
    let whereSql = "";

    if (search) {
      whereSql = "WHERE c.name LIKE ?";
      params.push(`${search}%`);
    }

    const [rows] = await query(
      `
        SELECT c.id, c.name, COUNT(p.id) AS productsCount
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id
        ${whereSql}
        GROUP BY c.id, c.name
        ORDER BY c.name ASC
        LIMIT ?
      `,
      [...params, limit]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore lettura categorie" });
  }
});

app.post("/api/categories", requireAuth("admin"), async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();

    if (!name) {
      return res.status(400).json({ error: "Nome categoria obbligatorio" });
    }

    const [existing] = await query(
      "SELECT id FROM categories WHERE LOWER(name) = LOWER(?) LIMIT 1",
      [name]
    );

    if (existing.length) {
      return res.status(409).json({ error: "Categoria già esistente" });
    }

    const [result] = await execute(
      "INSERT INTO categories (name) VALUES (?)",
      [name]
    );

    const [rows] = await query(
      "SELECT id, name FROM categories WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore creazione categoria" });
  }
});

app.patch("/api/categories/:id", requireAuth("admin"), async (req, res) => {
  try {
    const categoryId = Number(req.params.id);
    const name = String(req.body?.name || "").trim();

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({ error: "ID categoria non valido" });
    }

    if (!name) {
      return res.status(400).json({ error: "Nome categoria obbligatorio" });
    }

    const [exists] = await query(
      "SELECT id FROM categories WHERE id = ?",
      [categoryId]
    );

    if (!exists.length) {
      return res.status(404).json({ error: "Categoria non trovata" });
    }

    const [duplicate] = await query(
      "SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1",
      [name, categoryId]
    );

    if (duplicate.length) {
      return res
        .status(409)
        .json({ error: "Esiste già una categoria con questo nome" });
    }

    await execute(
      "UPDATE categories SET name = ? WHERE id = ?",
      [name, categoryId]
    );

    await execute(
      "UPDATE products SET category = ? WHERE category_id = ?",
      [name, categoryId]
    );

    const [rows] = await query(
      "SELECT id, name FROM categories WHERE id = ?",
      [categoryId]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore modifica categoria" });
  }
});

app.delete("/api/categories/:id", requireAuth("admin"), async (req, res) => {
  try {
    const categoryId = Number(req.params.id);

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({ error: "ID categoria non valido" });
    }

    const [exists] = await query(
      "SELECT id FROM categories WHERE id = ?",
      [categoryId]
    );

    if (!exists.length) {
      return res.status(404).json({ error: "Categoria non trovata" });
    }

    await execute(
      "UPDATE products SET category_id = NULL, category = NULL WHERE category_id = ?",
      [categoryId]
    );

    await execute("DELETE FROM categories WHERE id = ?", [categoryId]);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore eliminazione categoria" });
  }
});

/* =========================
   PRODUCTS
========================= */

app.get("/api/products", requireAuth("admin","operatore"), async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const categoryIdRaw = String(req.query.categoryId || "").trim();
    const limitRaw = Number(req.query.limit || 100);
    const limit =
      Number.isInteger(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, 200)
        : 100;

    const whereParts = [];
    const params = [];

    if (search) {
      whereParts.push(`
        (
          p.name LIKE ?
          OR c.name LIKE ?
          OR p.category LIKE ?
        )
      `);
      params.push(`${search}%`, `${search}%`, `${search}%`);
    }

    if (categoryIdRaw) {
      const categoryId = Number(categoryIdRaw);

      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return res.status(400).json({ error: "Categoria non valida" });
      }

      whereParts.push("p.category_id = ?");
      params.push(categoryId);
    }

    const whereSql = whereParts.length
      ? `WHERE ${whereParts.join(" AND ")}`
      : "";

    const [products] = await query(
      `
        SELECT
          p.id,
          p.name,
          p.category_id AS categoryId,
          c.name AS categoryName,
          COALESCE(c.name, p.category) AS category,
          p.vat_rate AS vatRate,
          p.status,
          p.allow_persons AS allowPersons,
          p.allow_weight AS allowWeight,
          p.created_at AS createdAt
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        ${whereSql}
        ORDER BY
          CASE WHEN COALESCE(c.name, p.category, '') = '' THEN 1 ELSE 0 END,
          COALESCE(c.name, p.category, '') ASC,
          p.name ASC
        LIMIT ?
      `,
      [...params, limit]
    );

    const productIds = products.map((p) => p.id);

    let subProducts = [];
    if (productIds.length) {
      const placeholders = productIds.map(() => "?").join(",");

      const [subs] = await query(
        `
          SELECT
            sp.id,
            sp.product_id AS productId,
            sp.name,
            sp.is_default AS isDefault
          FROM sub_products sp
          WHERE sp.product_id IN (${placeholders})
          ORDER BY sp.product_id ASC, sp.name ASC
        `,
        productIds
      );

      subProducts = subs;
    }

    const subsByProductId = new Map();

    for (const sp of subProducts) {
      const key = String(sp.productId);
      if (!subsByProductId.has(key)) {
        subsByProductId.set(key, []);
      }
      subsByProductId.get(key).push({
        ...sp,
        isDefault: !!sp.isDefault,
      });
    }

    res.json(
      products.map((p) => ({
        ...p,
        allowPersons: !!p.allowPersons,
        allowWeight: !!p.allowWeight,
        subProducts: subsByProductId.get(String(p.id)) || [],
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore lettura prodotti" });
  }
});

app.post("/api/products", requireAuth("admin"), async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const categoryIdRaw = req.body?.categoryId;
    const categoryId =
      categoryIdRaw === "" || categoryIdRaw == null
        ? null
        : Number(categoryIdRaw);

    if (!name) {
      return res.status(400).json({ error: "Nome prodotto obbligatorio" });
    }

    let categoryName = null;

    if (categoryId != null) {
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return res.status(400).json({ error: "Categoria non valida" });
      }

      const [catRows] = await query(
        "SELECT id, name FROM categories WHERE id = ?",
        [categoryId]
      );

      if (!catRows.length) {
        return res.status(404).json({ error: "Categoria non trovata" });
      }

      categoryName = catRows[0].name;
    }

    const [result] = await execute(
      `
        INSERT INTO products (
          name,
          category_id,
          category,
          vat_rate,
          status,
          allow_persons,
          allow_weight
        )
        VALUES (?, ?, ?, 10, 'active', 1, 1)
      `,
      [name, categoryId, categoryName]
    );

    const [rows] = await query(
      `
        SELECT
          p.id,
          p.name,
          p.category_id AS categoryId,
          c.name AS categoryName,
          COALESCE(c.name, p.category) AS category,
          p.vat_rate AS vatRate,
          p.status,
          p.allow_persons AS allowPersons,
          p.allow_weight AS allowWeight,
          p.created_at AS createdAt
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.id = ?
        LIMIT 1
      `,
      [result.insertId]
    );

    res.status(201).json({
      ...rows[0],
      allowPersons: !!rows[0]?.allowPersons,
      allowWeight: !!rows[0]?.allowWeight,
      subProducts: [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore creazione prodotto" });
  }
});

app.patch("/api/products/:id", requireAuth("admin"), async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const name = String(req.body?.name || "").trim();
    const categoryIdRaw = req.body?.categoryId;
    const categoryId =
      categoryIdRaw === "" || categoryIdRaw == null
        ? null
        : Number(categoryIdRaw);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: "ID prodotto non valido" });
    }

    if (!name) {
      return res.status(400).json({ error: "Nome prodotto obbligatorio" });
    }

    const [exists] = await query(
      "SELECT id FROM products WHERE id = ?",
      [productId]
    );

    if (!exists.length) {
      return res.status(404).json({ error: "Prodotto non trovato" });
    }

    let categoryName = null;

    if (categoryId != null) {
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return res.status(400).json({ error: "Categoria non valida" });
      }

      const [catRows] = await query(
        "SELECT id, name FROM categories WHERE id = ?",
        [categoryId]
      );

      if (!catRows.length) {
        return res.status(404).json({ error: "Categoria non trovata" });
      }

      categoryName = catRows[0].name;
    }

    await execute(
      `
        UPDATE products
        SET
          name = ?,
          category_id = ?,
          category = ?
        WHERE id = ?
      `,
      [name, categoryId, categoryName, productId]
    );

    const [productRows] = await query(
      `
        SELECT
          p.id,
          p.name,
          p.category_id AS categoryId,
          c.name AS categoryName,
          COALESCE(c.name, p.category) AS category,
          p.vat_rate AS vatRate,
          p.status,
          p.allow_persons AS allowPersons,
          p.allow_weight AS allowWeight,
          p.created_at AS createdAt
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.id = ?
        LIMIT 1
      `,
      [productId]
    );

    const [subRows] = await query(
      `
        SELECT
          sp.id,
          sp.product_id AS productId,
          sp.name,
          sp.is_default AS isDefault
        FROM sub_products sp
        WHERE sp.product_id = ?
        ORDER BY sp.name ASC
      `,
      [productId]
    );

    res.json({
      ...productRows[0],
      allowPersons: !!productRows[0]?.allowPersons,
      allowWeight: !!productRows[0]?.allowWeight,
      subProducts: subRows.map((sp) => ({
        ...sp,
        isDefault: !!sp.isDefault,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore modifica prodotto" });
  }
});

app.delete("/api/products/:id", requireAuth("admin"), async (req, res) => {
  try {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: "ID prodotto non valido" });
    }

    const [exists] = await query(
      "SELECT id FROM products WHERE id = ?",
      [productId]
    );

    if (!exists.length) {
      return res.status(404).json({ error: "Prodotto non trovato" });
    }

    await execute("DELETE FROM products WHERE id = ?", [productId]);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore eliminazione prodotto" });
  }
});

/* =========================
   SUB PRODUCTS
========================= */

app.post("/api/products/:id/sub-products", requireAuth("admin"), async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const name = String(req.body?.name || "").trim();

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: "ID prodotto non valido" });
    }

    if (!name) {
      return res.status(400).json({ error: "Nome sottoprodotto obbligatorio" });
    }

    const [productRows] = await query(
      "SELECT id FROM products WHERE id = ?",
      [productId]
    );

    if (!productRows.length) {
      return res.status(404).json({ error: "Prodotto non trovato" });
    }

    const [result] = await execute(
      `
        INSERT INTO sub_products (
          product_id,
          name,
          price_cents,
          is_default,
          sku,
          notes
        )
        VALUES (?, ?, 0, 0, NULL, NULL)
      `,
      [productId, name]
    );

    const [rows] = await query(
      `
        SELECT
          id,
          product_id AS productId,
          name,
          is_default AS isDefault
        FROM sub_products
        WHERE id = ?
      `,
      [result.insertId]
    );

    res.status(201).json({
      ...rows[0],
      isDefault: !!rows[0]?.isDefault,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore creazione sottoprodotto" });
  }
});

app.delete("/api/sub-products/:id", requireAuth("admin"), async (req, res) => {
  try {
    const subProductId = Number(req.params.id);

    if (!Number.isInteger(subProductId) || subProductId <= 0) {
      return res.status(400).json({ error: "ID sottoprodotto non valido" });
    }

    const [exists] = await query(
      "SELECT id FROM sub_products WHERE id = ?",
      [subProductId]
    );

    if (!exists.length) {
      return res.status(404).json({ error: "Sottoprodotto non trovato" });
    }

    await execute("DELETE FROM sub_products WHERE id = ?", [subProductId]);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore eliminazione sottoprodotto" });
  }
});

/* =========================
   START
========================= */

async function start() {
  await testConnection();
  await initDb();

  app.listen(PORT, () => {
    console.log("Server avviato su http://localhost:" + PORT);
  });
}

start();