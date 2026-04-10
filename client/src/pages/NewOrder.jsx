import { apiFetch, getUser } from "../utils/auth.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

function emptyItem() {
  return {
    productId: "",
    productName: "",
    productSearch: "",
    subProductId: "",
    subProductName: "",
    variantId: "",
    variantName: "",
    persons: "",
    weightKg: "",
    notes: "",
    allergenOption: "standard",
  };
}

async function readJsonSafe(res) {
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Risposta non valida dal server");
  }
}

/* =========================
   VARIANT AUTOCOMPLETE
========================= */

function VariantAutocomplete({ variants, value, variantName, onChange }) {
  const [search, setSearch] = useState(variantName || "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!value) setSearch("");
    else setSearch(variantName || "");
  }, [value, variantName]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return variants.filter(v => v.name.toLowerCase().startsWith(q)).slice(0, 20);
  }, [search, variants]);

  function select(v) {
    setSearch(v.name);
    setOpen(false);
    onChange({ variantId: String(v.id), variantName: v.name });
  }

  function handleInput(e) {
    setSearch(e.target.value);
    setOpen(true);
    if (!e.target.value) onChange({ variantId: "", variantName: "" });
  }

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        if (!value) setSearch("");
        else setSearch(variantName || "");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [value, variantName]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        value={search}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        placeholder="Cerca variante..."
        autoComplete="off"
      />
      {open && search.trim().length > 0 && filtered.length > 0 && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0, right: 0,
          background: "var(--surface)",
          border: "1.5px solid var(--border)",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--shadow-lg)",
          zIndex: 500,
          maxHeight: 200,
          overflowY: "auto",
        }}>
          {filtered.map(v => (
            <div
              key={v.id}
              onMouseDown={() => select(v)}
              style={{
                padding: "10px 14px",
                cursor: "pointer",
                borderBottom: "1px solid var(--border)",
                background: String(v.id) === String(value) ? "var(--accent-light)" : "transparent",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--accent-light)"}
              onMouseLeave={e => e.currentTarget.style.background = String(v.id) === String(value) ? "var(--accent-light)" : "transparent"}
            >
              <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--ink)" }}>{v.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================
   CALENDAR PICKER
========================= */

const MONTHS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const DAYS_IT = ["Lu", "Ma", "Me", "Gi", "Ve", "Sa", "Do"];

const TIME_SLOTS = [];
for (let h = 7; h <= 20; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, "0")}:00`);
  TIME_SLOTS.push(`${String(h).padStart(2, "0")}:30`);
}

function CalendarPicker({ value, onChange }) {
  // value è una stringa "YYYY-MM-DDTHH:MM" o ""
  const today = new Date();

  const parsedDate = value ? new Date(value) : null;
  const selectedDateStr = parsedDate
    ? `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`
    : "";
  const selectedTime = parsedDate
    ? `${String(parsedDate.getHours()).padStart(2, "0")}:${String(parsedDate.getMinutes()).padStart(2, "0")}`
    : "";

  const [viewYear, setViewYear] = useState(parsedDate ? parsedDate.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsedDate ? parsedDate.getMonth() : today.getMonth());

  function buildDateStr(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function emitChange(dateStr, timeStr) {
    if (!dateStr || !timeStr) {
      onChange("");
      return;
    }
    onChange(`${dateStr}T${timeStr}`);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  // Celle del calendario
  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    // Lunedì = 0
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const result = [];

    for (let i = 0; i < startDow; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) result.push(d);

    return result;
  }, [viewYear, viewMonth]);

  const todayStr = buildDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>

      {/* Calendario */}
      <div style={{ minWidth: 260 }}>
        {/* Header mese */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <button type="button" onClick={prevMonth} style={navBtnStyle}>‹</button>
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            {MONTHS_IT[viewMonth]} {viewYear}
          </span>
          <button type="button" onClick={nextMonth} style={navBtnStyle}>›</button>
        </div>

        {/* Intestazione giorni */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
          {DAYS_IT.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#6b7280" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Celle */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />;

            const dateStr = buildDateStr(viewYear, viewMonth, day);
            const isSelected = dateStr === selectedDateStr;
            const isToday = dateStr === todayStr;
            const isPast = dateStr < todayStr;

            return (
              <button
                key={dateStr}
                type="button"
                disabled={isPast}
                onClick={() => emitChange(dateStr, selectedTime || "09:00")}
                style={{
                  padding: "6px 0",
                  borderRadius: 6,
                  border: isToday && !isSelected ? "1px solid #6366f1" : "1px solid transparent",
                  background: isSelected ? "#6366f1" : "transparent",
                  color: isSelected ? "#fff" : isPast ? "#d1d5db" : "#111827",
                  fontWeight: isSelected ? 700 : 400,
                  fontSize: 13,
                  cursor: isPast ? "default" : "pointer",
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slot orari */}
      <div style={{ minWidth: 140 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: "#374151" }}>Orario</div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 4,
          maxHeight: 232,
          overflowY: "auto",
          paddingRight: 4,
        }}>
          {TIME_SLOTS.map(slot => {
            const isSelected = slot === selectedTime;
            return (
              <button
                key={slot}
                type="button"
                disabled={!selectedDateStr}
                onClick={() => emitChange(selectedDateStr, slot)}
                style={{
                  padding: "5px 4px",
                  borderRadius: 6,
                  border: "1px solid",
                  borderColor: isSelected ? "#6366f1" : "#e5e7eb",
                  background: isSelected ? "#6366f1" : "#fff",
                  color: isSelected ? "#fff" : !selectedDateStr ? "#d1d5db" : "#111827",
                  fontSize: 12,
                  cursor: !selectedDateStr ? "default" : "pointer",
                  fontWeight: isSelected ? 700 : 400,
                }}
              >
                {slot}
              </button>
            );
          })}
        </div>
        {!selectedDateStr && (
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
            Seleziona prima una data
          </div>
        )}
      </div>

      {/* Riepilogo selezione */}
      {value && (
        <div style={{ alignSelf: "flex-end" }}>
          <div style={{
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 13,
          }}>
            <span style={{ fontWeight: 600 }}>📅 </span>
            {new Date(value).toLocaleDateString("it-IT", {
              weekday: "long", day: "2-digit", month: "long", year: "numeric"
            })}
            {" ore "}
            <span style={{ fontWeight: 600 }}>{selectedTime}</span>
          </div>
          <button
            type="button"
            onClick={() => onChange("")}
            style={{ marginTop: 6, fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            × Cancella selezione
          </button>
        </div>
      )}
    </div>
  );
}

const navBtnStyle = {
  background: "none",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  width: 28,
  height: 28,
  cursor: "pointer",
  fontSize: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};

/* =========================
   PRODUCT AUTOCOMPLETE
========================= */

function ProductAutocomplete({ products, value, productName, onChange }) {
  // value = productId, productName = nome prodotto selezionato
  const [search, setSearch] = useState(productName || "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Sincronizza il testo quando il prodotto viene resettato dall'esterno
  useEffect(() => {
    if (!value) setSearch("");
    else setSearch(productName || "");
  }, [value, productName]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter(p =>
      p.name.toLowerCase().startsWith(q) ||
      (p.categoryName || p.category || "").toLowerCase().startsWith(q)
    ).slice(0, 30);
  }, [search, products]);

  function select(p) {
    setSearch(p.name);
    setOpen(false);
    onChange({ productId: String(p.id), productName: p.name });
  }

  function handleInput(e) {
    setSearch(e.target.value);
    setOpen(true);
    if (!e.target.value) {
      onChange({ productId: "", productName: "" });
    }
  }

  // Chiudi cliccando fuori
  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        // Se non è stato selezionato nulla, ripristina testo al prodotto corrente
        if (!value) setSearch("");
        else setSearch(productName || "");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [value, productName]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        value={search}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        placeholder="Cerca prodotto..."
        autoComplete="off"
      />
      {open && search.trim().length > 0 && filtered.length > 0 && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          right: 0,
          background: "var(--surface)",
          border: "1.5px solid var(--border)",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--shadow-lg)",
          zIndex: 500,
          maxHeight: 260,
          overflowY: "auto",
        }}>
          {filtered.map(p => (
            <div
              key={p.id}
              onMouseDown={() => select(p)}
              style={{
                padding: "12px 16px",
                cursor: "pointer",
                borderBottom: "1px solid var(--border)",
                background: String(p.id) === String(value) ? "var(--accent-light)" : "transparent",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--accent-light)"}
              onMouseLeave={e => e.currentTarget.style.background = String(p.id) === String(value) ? "var(--accent-light)" : "transparent"}
            >
              <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--ink)" }}>{p.name}</div>
              {(p.categoryName || p.category) && (
                <div style={{ fontSize: "0.76rem", color: "var(--ink-3)", marginTop: 2 }}>
                  {p.categoryName || p.category}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */

export default function NewOrder() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [allVariants, setAllVariants] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [customer, setCustomer] = useState({ name: "", phone: "", email: "" });

  const [fulfillment, setFulfillment] = useState({
    type: "pickup",
    deliveryDateTime: "",
    address: { line1: "", line2: "", city: "", notes: "" },
    deliveryFeeCents: null,
  });

  const [items, setItems] = useState([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [invoiceRequested, setInvoiceRequested] = useState(false);
  const [invoiceData, setInvoiceData] = useState({
    ragioneSociale: "",
    partitaIva: "",
    via: "",
    citta: "",
    provincia: "",
    cap: "",
    pec: "",
    sdi: "",
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");

  const sigCanvasRef = useRef(null);
  const sigDrawingRef = useRef(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");

  useEffect(() => {
    async function loadProducts() {
      try {
        const [prodRes, varRes] = await Promise.all([
          apiFetch("/api/products"),
          apiFetch("/api/variants?limit=200"),
        ]);
        const prodData = await readJsonSafe(prodRes);
        const varData  = await readJsonSafe(varRes);

        if (!prodRes.ok) throw new Error(prodData?.error || "Errore caricamento prodotti");

        setProducts(Array.isArray(prodData) ? prodData : []);
        setAllVariants(Array.isArray(varData) ? varData : []);
      } catch (err) {
        console.error(err);
        setError(err.message || "Errore caricamento prodotti");
        setProducts([]);
      }
    }

    loadProducts();
  }, []);

  const productById = useMemo(() => {
    const m = new Map();
    products.forEach((p) => m.set(String(p.id), p));
    return m;
  }, [products]);

  function updateItem(idx, patch) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function addRow() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeRow(idx) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  function getSignaturePoint(event) {
    const canvas = sigCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    if (event.touches && event.touches.length > 0) {
      return {
        x: event.touches[0].clientX - rect.left,
        y: event.touches[0].clientY - rect.top,
      };
    }

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function startSignature(event) {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;

    sigDrawingRef.current = true;
    const ctx = canvas.getContext("2d");
    const { x, y } = getSignaturePoint(event);

    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function moveSignature(event) {
    if (!sigDrawingRef.current) return;

    event.preventDefault();

    const canvas = sigCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const { x, y } = getSignaturePoint(event);

    ctx.lineTo(x, y);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function endSignature() {
    if (!sigDrawingRef.current) return;
    sigDrawingRef.current = false;
    saveSignature();
  }

  function getSignatureDataUrlFromCanvas() {
    const canvas = sigCanvasRef.current;
    if (!canvas) return "";

    const blank = document.createElement("canvas");
    blank.width = canvas.width;
    blank.height = canvas.height;

    if (canvas.toDataURL() === blank.toDataURL()) {
      return "";
    }

    return canvas.toDataURL("image/png");
  }

  function saveSignature() {
    const dataUrl = getSignatureDataUrlFromCanvas();
    setSignatureDataUrl(dataUrl);
  }

  function clearSignature() {
    const canvas = sigCanvasRef.current;
    if (!canvas) {
      setSignatureDataUrl("");
      return;
    }

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl("");
  }

  async function uploadSignatureIfNeeded(dataUrl) {
    if (!dataUrl) return "";

    const blob = await fetch(dataUrl).then((r) => r.blob());
    const formData = new FormData();
    formData.append("signature", blob, "signature.png");

    const res = await apiFetch("/api/upload-signature", {
      method: "POST",
      body: formData,
    });

    const data = await readJsonSafe(res);

    if (!res.ok) {
      throw new Error(data?.error || "Errore upload firma");
    }

    return data?.signatureUrl || "";
  }

  async function save() {
    setError("");
    setSaving(true);

    try {
      let uploadedPhotoUrl = photoUrl;

      if (photoFile) {
        const formData = new FormData();
        formData.append("photo", photoFile);

        const uploadRes = await apiFetch("/api/upload-order-photo", {
          method: "POST",
          body: formData,
        });

        const uploadData = await readJsonSafe(uploadRes);

        if (!uploadRes.ok) {
          setError(uploadData?.error || "Errore upload foto");
          return;
        }

        uploadedPhotoUrl = uploadData?.photoUrl || "";
        setPhotoUrl(uploadedPhotoUrl);
      }

      const currentSignatureDataUrl = getSignatureDataUrlFromCanvas();
      setSignatureDataUrl(currentSignatureDataUrl);

      const signatureUrl = await uploadSignatureIfNeeded(currentSignatureDataUrl);

      const normalizedItems = items.map((it) => {
        const product = productById.get(String(it.productId));
        const subs = Array.isArray(product?.subProducts) ? product.subProducts : [];
        const sub = subs.find(s => String(s.id) === String(it.subProductId));

        return {
          ...it,
          persons: it.persons === "" ? null : Number(it.persons),
          weightGrams: it.weightKg === "" ? null : Math.round(Number(it.weightKg) * 1000),
          productName: product?.name || it.productName || "",
          subProductName: sub?.name || it.subProductName || "",
          variantName: it.variantName || "",
          categoryName: product?.categoryName || product?.category || "",
        };
      });

      const payload = {
        customer,
        operatore: getUser()?.username || "",
        fulfillment: {
          type: fulfillment.type,
          deliveryDateTime: fulfillment.deliveryDateTime,
          address: fulfillment.type === "delivery" ? fulfillment.address : null,
          deliveryFeeCents:
            fulfillment.type === "delivery" ? fulfillment.deliveryFeeCents : null,
        },
        items: normalizedItems,
        notes,
        invoiceRequested,
        invoiceData: invoiceRequested ? invoiceData : null,
        signature: currentSignatureDataUrl,
        signatureDataUrl: currentSignatureDataUrl,
        signatureUrl,
        photoUrl: uploadedPhotoUrl,
      };

      const res = await apiFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readJsonSafe(res);

      if (!res.ok) {
        setError(data?.errors?.join(" • ") || data?.error || "Errore salvataggio");
        return;
      }

      // Redirect alla home dopo salvataggio
      navigate("/");
    } catch (err) {
      console.error(err);
      setError(err.message || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Nuovo ordine</h2>

      {error && (
        <div
          className="error-box" style={{ marginBottom: "var(--gap)" }}
        >
          {error}
        </div>
      )}

      {/* CLIENTE */}
      <section className="card">
        <h3 style={{ marginTop: 0, fontFamily: "var(--font-title)", fontSize: "1.2rem" }}>Cliente</h3>

        <div style={{ display: "grid", gap: "var(--gap)", gridTemplateColumns: "1fr 1fr 1fr" }}>
          <label>
            Nome*
            <input
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            />
          </label>

          <label>
            Telefono*
            <input
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            />
          </label>

          <label>
            Email
            <input
              value={customer.email}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
            />
          </label>
        </div>
      </section>

      {/* FATTURA */}
      <section className="card" style={{ marginTop: "var(--gap)" }}>
        <h3 style={{ marginTop: 0, fontFamily: "var(--font-title)", fontSize: "1.2rem" }}>Fattura</h3>
        <label style={{ display: "flex", gap: 10, alignItems: "center", textTransform: "none", letterSpacing: 0, fontSize: "0.95rem", fontWeight: 500, color: "var(--ink-2)" }}>
          <input
            type="checkbox"
            checked={invoiceRequested}
            onChange={(e) => setInvoiceRequested(e.target.checked)}
          />
          Il cliente richiede fattura
        </label>

        {invoiceRequested && (
          <div style={{ marginTop: "var(--gap)", display: "grid", gap: "var(--gap)" }}>
            <div style={{ display: "grid", gap: "var(--gap)", gridTemplateColumns: "1fr 1fr" }}>
              <label>
                Ragione Sociale
                <input
                  type="text"
                  value={invoiceData.ragioneSociale}
                  onChange={e => setInvoiceData(p => ({ ...p, ragioneSociale: e.target.value }))}
                  placeholder="Es. Mario Rossi S.r.l."
                />
              </label>
              <label>
                Partita IVA
                <input
                  type="text"
                  value={invoiceData.partitaIva}
                  onChange={e => setInvoiceData(p => ({ ...p, partitaIva: e.target.value }))}
                  placeholder="Es. IT12345678901"
                />
              </label>
            </div>
            <div style={{ display: "grid", gap: "var(--gap)", gridTemplateColumns: "2fr 1fr 1fr" }}>
              <label>
                Via / Indirizzo
                <input
                  type="text"
                  value={invoiceData.via}
                  onChange={e => setInvoiceData(p => ({ ...p, via: e.target.value }))}
                  placeholder="Es. Via Roma 1"
                />
              </label>
              <label>
                Città
                <input
                  type="text"
                  value={invoiceData.citta}
                  onChange={e => setInvoiceData(p => ({ ...p, citta: e.target.value }))}
                  placeholder="Es. Milano"
                />
              </label>
              <label>
                Provincia
                <input
                  type="text"
                  value={invoiceData.provincia}
                  onChange={e => setInvoiceData(p => ({ ...p, provincia: e.target.value }))}
                  placeholder="Es. MI"
                  maxLength={2}
                />
              </label>
            </div>
            <div style={{ display: "grid", gap: "var(--gap)", gridTemplateColumns: "1fr 1fr 1fr" }}>
              <label>
                CAP
                <input
                  type="text"
                  value={invoiceData.cap}
                  onChange={e => setInvoiceData(p => ({ ...p, cap: e.target.value }))}
                  placeholder="Es. 20100"
                  maxLength={5}
                />
              </label>
              <label>
                PEC
                <input
                  type="text"
                  value={invoiceData.pec}
                  onChange={e => setInvoiceData(p => ({ ...p, pec: e.target.value }))}
                  placeholder="Es. mario@pec.it"
                />
              </label>
              <label>
                Codice SDI
                <input
                  type="text"
                  value={invoiceData.sdi}
                  onChange={e => setInvoiceData(p => ({ ...p, sdi: e.target.value }))}
                  placeholder="Es. ABCDE12"
                  maxLength={7}
                />
              </label>
            </div>
          </div>
        )}
      </section>

      {/* CONSEGNA */}
      <section className="card" style={{ marginTop: "var(--gap)" }}>
        <h3 style={{ marginTop: 0, fontFamily: "var(--font-title)", fontSize: "1.2rem" }}>Consegna / Ritiro</h3>

        <div style={{ display: "grid", gap: "var(--gap)", gridTemplateColumns: "200px 1fr", marginBottom: 16 }}>
          <label>
            Tipo*
            <select
              value={fulfillment.type}
              onChange={(e) => setFulfillment({ ...fulfillment, type: e.target.value })}
            >
              <option value="pickup">Ritiro</option>
              <option value="delivery">Consegna</option>
            </select>
          </label>

          {fulfillment.type === "delivery" && (
            <label>
              Costo consegna (opzionale, €)
              <input
                type="number"
                min="0"
                step="0.50"
                value={
                  fulfillment.deliveryFeeCents === null
                    ? ""
                    : (fulfillment.deliveryFeeCents / 100).toFixed(2)
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    return setFulfillment({ ...fulfillment, deliveryFeeCents: null });
                  }
                  const cents = Math.round(Number(v) * 100);
                  setFulfillment({
                    ...fulfillment,
                    deliveryFeeCents: Number.isFinite(cents) ? cents : null,
                  });
                }}
              />
            </label>
          )}
        </div>

        {/* Calendario */}
        <div style={{ marginBottom: 4, fontWeight: 600, fontSize: 13 }}>
          Data e ora {fulfillment.type === "pickup" ? "ritiro" : "consegna"}*
        </div>
        <CalendarPicker
          value={fulfillment.deliveryDateTime}
          onChange={(v) => setFulfillment({ ...fulfillment, deliveryDateTime: v })}
        />

        {/* Indirizzo consegna */}
        {fulfillment.type === "delivery" && (
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gap: 10,
              gridTemplateColumns: "2fr 1fr",
            }}
          >
            <label>
              Indirizzo*
              <input
                value={fulfillment.address.line1}
                onChange={(e) =>
                  setFulfillment({
                    ...fulfillment,
                    address: { ...fulfillment.address, line1: e.target.value },
                  })
                }
              />
            </label>

            <label>
              Città*
              <input
                value={fulfillment.address.city}
                onChange={(e) =>
                  setFulfillment({
                    ...fulfillment,
                    address: { ...fulfillment.address, city: e.target.value },
                  })
                }
              />
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              Note consegna (citofono, interno, ecc.)
              <input
                value={fulfillment.address.notes}
                onChange={(e) =>
                  setFulfillment({
                    ...fulfillment,
                    address: { ...fulfillment.address, notes: e.target.value },
                  })
                }
              />
            </label>
          </div>
        )}
      </section>

      {/* PRODOTTI */}
      <section className="card" style={{ marginTop: "var(--gap)" }}>
        <h3 style={{ marginTop: 0, fontFamily: "var(--font-title)", fontSize: "1.2rem" }}>Prodotti</h3>

        <div style={{ display: "grid", gap: "var(--gap)" }}>
          {items.map((it, idx) => {
            const p = productById.get(String(it.productId));
            const allowPersons = p?.allowPersons ?? true;
            const allowWeight = p?.allowWeight ?? true;

            return (
              <div key={idx} style={{ border: "1.5px dashed var(--border-strong)", borderRadius: "var(--r-md)", padding: 16, background: "var(--surface-2)" }}>
                {/* Riga 1: Prodotto + Variante */}
                <div style={{ display: "grid", gap: "var(--gap)", gridTemplateColumns: "2fr 1.5fr" }}>
                  <label>
                    Prodotto*
                    <ProductAutocomplete
                      products={products}
                      value={it.productId}
                      productName={it.productName}
                      onChange={({ productId, productName }) =>
                        updateItem(idx, {
                          productId,
                          productName,
                          subProductId: "",
                          subProductName: "",
                          variantId: "",
                          variantName: "",
                          persons: "",
                          weightKg: "",
                        })
                      }
                    />
                  </label>

                  {/* Variante: autocomplete globale */}
                  <label>
                    Variante
                    <VariantAutocomplete
                      variants={allVariants}
                      value={it.variantId || ""}
                      variantName={it.variantName || ""}
                      onChange={({ variantId, variantName }) =>
                        updateItem(idx, { variantId, variantName })
                      }
                    />
                  </label>
                </div>

                {/* Riga 2: Persone, Peso, Allergeni */}
                <div style={{ display: "grid", gap: "var(--gap)", gridTemplateColumns: "1fr 1fr 1.5fr", marginTop: "var(--gap)" }}>
                  <label>
                    Persone
                    <input
                      type="number"
                      min="1"
                      step="1"
                      disabled={!allowPersons}
                      value={it.persons}
                      onChange={(e) => updateItem(idx, { persons: e.target.value })}
                    />
                  </label>

                  <label>
                    Peso (kg)
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      disabled={!allowWeight}
                      value={it.weightKg}
                      onChange={(e) => updateItem(idx, { weightKg: e.target.value })}
                    />
                  </label>

                  <label>
                    Allergeni
                    <select
                      value={it.allergenOption || "standard"}
                      onChange={(e) => updateItem(idx, { allergenOption: e.target.value })}
                    >
                      <option value="standard">Standard</option>
                      <option value="no_glutine">No glutine</option>
                      <option value="no_lattosio">No lattosio</option>
                      <option value="no_glutine_lattosio">No glutine e no lattosio</option>
                    </select>
                  </label>
                </div>

                <label style={{ display: "block", marginTop: 10 }}>
                  Note prodotto
                  <input
                    value={it.notes}
                    onChange={(e) => updateItem(idx, { notes: e.target.value })}
                  />
                </label>

                <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button type="button" onClick={() => removeRow(idx)} disabled={items.length === 1}>
                    Rimuovi riga
                  </button>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>
                    {p
                      ? p.name + (it.variantName ? " — " + it.variantName : (it.subProductName ? " — " + it.subProductName : ""))
                      : "Seleziona un prodotto"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <button type="button" onClick={addRow} style={{ marginTop: "var(--gap)" }}>
          + Aggiungi prodotto
        </button>
      </section>

      {/* FIRMA E FOTO */}
      <section className="card" style={{ marginTop: "var(--gap)" }}>
        <h3 style={{ marginTop: 0, fontFamily: "var(--font-title)", fontSize: "1.2rem" }}>Firma e foto</h3>

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Firma cliente</div>

            <div
              style={{
                border: "1.5px solid var(--border)",
                borderRadius: "var(--r-md)",
                overflow: "hidden",
                background: "#fff",
                width: "100%",
                maxWidth: 520,
              }}
            >
              <canvas
                ref={sigCanvasRef}
                width={520}
                height={180}
                style={{
                  width: "100%",
                  height: 180,
                  display: "block",
                  background: "#fff",
                  touchAction: "none",
                }}
                onMouseDown={startSignature}
                onMouseMove={moveSignature}
                onMouseUp={endSignature}
                onMouseLeave={endSignature}
                onTouchStart={startSignature}
                onTouchMove={moveSignature}
                onTouchEnd={endSignature}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button type="button" onClick={clearSignature}>
                Cancella firma
              </button>
            </div>

            {signatureDataUrl && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>
                  Anteprima firma salvata
                </div>
                <img
                  src={signatureDataUrl}
                  alt="Firma cliente"
                  style={{
                    maxWidth: 260,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    background: "#fff",
                  }}
                />
              </div>
            )}
          </div>

          <label>
            Foto ordine
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            />
          </label>

          {photoUrl && (
            <img
              src={photoUrl}
              alt="preview"
              style={{ maxWidth: 200, borderRadius: 8 }}
            />
          )}
        </div>
      </section>

      {/* NOTE */}
      <section className="card" style={{ marginTop: "var(--gap)" }}>
        <h3 style={{ marginTop: 0, fontFamily: "var(--font-title)", fontSize: "1.2rem" }}>Note ordine</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </section>

      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <button type="button" className="btn-primary btn-lg" onClick={save} disabled={saving}>
          {saving ? "Salvataggio..." : "Salva ordine"}
        </button>
      </div>
    </div>
  );
}
