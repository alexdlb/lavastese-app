import { apiFetch } from "../utils/auth.js";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { buildWhatsAppUrl } from "../utils/whatsapp";

async function readJsonSafe(res) {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); }
  catch { throw new Error("Risposta non valida dal server"); }
}

// I file statici (foto, firma) sono serviti dal backend.
// In sviluppo il proxy Vite li risolve, in produzione tutto
// gira sullo stesso dominio — il path relativo funziona in entrambi i casi.
function resolveUpload(url) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return url;
}

function prettyValue(value) {
  if (value == null || value === "") return "—";
  return String(value);
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("it-IT", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return value; }
}

function SectionCard({ title, icon, children, action }) {
  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div className="card-title" style={{ margin: 0 }}>
          {icon && <span style={{ fontSize: "1.2rem" }}>{icon}</span>}
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function loadOrder() {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/orders/${id}`);
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(data?.error || "Errore caricamento ordine");
      setOrder(data || null);
    } catch (err) {
      console.error(err);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOrder(); }, [id]);

  function updateCustomer(field, value) {
    setOrder(prev => ({ ...prev, customer: { ...(prev?.customer || {}), [field]: value } }));
  }

  function updateFulfillment(field, value) {
    setOrder(prev => ({ ...prev, fulfillment: { ...(prev?.fulfillment || {}), [field]: value } }));
  }

  function updateItem(index, field, value) {
    setOrder(prev => {
      const items = Array.isArray(prev?.items) ? [...prev.items] : [];
      items[index] = { ...(items[index] || {}), [field]: value };
      return { ...prev, items };
    });
  }

  function removeItem(index) {
    setOrder(prev => {
      const items = Array.isArray(prev?.items) ? [...prev.items] : [];
      items.splice(index, 1);
      return { ...prev, items };
    });
  }

  function addItem() {
    setOrder(prev => ({
      ...prev,
      items: [...(Array.isArray(prev?.items) ? prev.items : []), { productName: "", quantity: 1 }],
    }));
  }

  async function handleSave() {
    if (!order) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order),
      });
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(data?.error || "Errore salvataggio ordine");
      setOrder(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert(err.message || "Errore salvataggio ordine");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Vuoi eliminare questo ordine?")) return;
    try {
      const res = await apiFetch(`/api/orders/${id}`, { method: "DELETE" });
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(data?.error || "Errore eliminazione ordine");
      navigate("/ordini");
    } catch (err) {
      console.error(err);
      alert(err.message || "Errore eliminazione ordine");
    }
  }

  async function handlePdf() {
    try {
      const res = await apiFetch(`/api/orders/${id}/pdf`);
      if (!res.ok) {
        alert("Errore generazione PDF");
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error(err);
      alert(err.message || "Errore generazione PDF");
    }
  }

  if (loading) {
    return <div className="loading-text">Caricamento ordine...</div>;
  }

  if (!order) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 48 }}>
        <div style={{ fontSize: "2rem", marginBottom: 12 }}>❌</div>
        <p>Ordine non trovato.</p>
        <Link to="/ordini" style={{ marginTop: 16, display: "inline-block" }}>← Torna alla lista</Link>
      </div>
    );
  }

  const whatsappUrl = buildWhatsAppUrl(order);
  const isDelivery = order.fulfillment?.type === "delivery";

  return (
    <div style={{ display: "grid", gap: "var(--gap-lg)" }}>

      {/* TOPBAR */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-ghost btn-sm" onClick={() => navigate("/ordini")}>
            ← Ordini
          </button>
          <span style={{ color: "var(--border-strong)" }}>|</span>
          <span style={{ fontWeight: 700, color: "var(--ink)", fontSize: "1.05rem" }}>
            {order.customer?.name || "Ordine #" + id}
          </span>
          <span className={`badge ${isDelivery ? "badge-blue" : "badge-orange"}`}>
            {isDelivery ? "Consegna" : "Ritiro"}
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {saved && (
            <span className="badge badge-green" style={{ alignSelf: "center", fontSize: "0.85rem", padding: "6px 14px" }}>
              ✓ Salvato
            </span>
          )}

          <button
            onClick={handlePdf}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 18px",
              background: "var(--surface-2)",
              border: "1.5px solid var(--border)",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-2)",
              fontSize: "0.9rem",
              fontWeight: 600,
              minHeight: "var(--touch)",
            }}
          >
            PDF
          </button>

          <a
            href={whatsappUrl || undefined}
            target="_blank"
            rel="noreferrer"
            onClick={e => { if (!whatsappUrl) { e.preventDefault(); alert("Numero cliente mancante"); } }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 18px",
              background: "#dcfce7",
              border: "1.5px solid #86efac",
              borderRadius: "var(--r-sm)",
              color: "#15803d",
              fontSize: "0.9rem",
              fontWeight: 600,
              textDecoration: "none",
              minHeight: "var(--touch)",
            }}
          >
            WhatsApp
          </a>

          <button className="btn-danger btn-sm" onClick={handleDelete}>
            🗑 Elimina
          </button>

          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Salvataggio..." : "💾 Salva ordine"}
          </button>
        </div>
      </div>

      {/* CLIENTE */}
      <SectionCard title="Dati cliente" icon="👤">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--gap)" }}>
          <label>
            Nome
            <input type="text" value={order.customer?.name || ""} onChange={e => updateCustomer("name", e.target.value)} />
          </label>
          <label>
            Telefono
            <input type="text" value={order.customer?.phone || ""} onChange={e => updateCustomer("phone", e.target.value)} />
          </label>
          <label>
            Email
            <input type="text" value={order.customer?.email || ""} onChange={e => updateCustomer("email", e.target.value)} />
          </label>
        </div>
        {order.operatore && (
          <div style={{
            marginTop: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            background: "var(--surface-2)",
            border: "1.5px solid var(--border)",
            borderRadius: "var(--r-sm)",
            fontSize: "0.88rem",
            color: "var(--ink-3)",
          }}>
            <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>Operatore:</span>
            <span style={{ fontWeight: 700, color: "var(--ink)" }}>{order.operatore}</span>
          </div>
        )}
      </SectionCard>

      {/* CONSEGNA */}
      <SectionCard title="Consegna / Ritiro" icon="🚗">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)" }}>
          <label>
            Data / Ora
            <input type="text" value={order.fulfillment?.deliveryDateTime || ""} onChange={e => updateFulfillment("deliveryDateTime", e.target.value)} />
          </label>
          <label>
            Tipo
            <select value={order.fulfillment?.type || "pickup"} onChange={e => updateFulfillment("type", e.target.value)}>
              <option value="pickup">Ritiro</option>
              <option value="delivery">Consegna</option>
            </select>
          </label>
        </div>
        {order.fulfillment?.deliveryDateTime && (
          <div style={{ marginTop: 12, padding: "12px 16px", background: "var(--surface-2)", borderRadius: "var(--r-sm)", fontSize: "0.9rem", color: "var(--ink-2)" }}>
            📅 {formatDateTime(order.fulfillment.deliveryDateTime)}
          </div>
        )}
      </SectionCard>

      {/* PRODOTTI */}
      <SectionCard
        title="Prodotti"
        icon="🎂"
        action={
          <button className="btn-sm btn-primary" onClick={addItem}>＋ Aggiungi</button>
        }
      >
        {!Array.isArray(order.items) || order.items.length === 0 ? (
          <div style={{ color: "var(--ink-3)", textAlign: "center", padding: "24px 0" }}>
            Nessun prodotto presente.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "var(--gap)" }}>
            {order.items.map((item, index) => (
              <div key={index} style={{
                border: "1.5px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: 16,
                display: "grid",
                gap: 12,
                background: "var(--surface-2)",
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr auto", gap: "var(--gap)", alignItems: "end" }}>
                  <label>
                    Prodotto
                    <input type="text" value={item.productName || ""} onChange={e => updateItem(index, "productName", e.target.value)} />
                  </label>
                  <label>
                    Variante
                    <input type="text" value={item.variantName || ""} onChange={e => updateItem(index, "variantName", e.target.value)} placeholder="Es. Pan di Spagna" />
                  </label>
                  <label>
                    Quantità
                    <input type="number" min="1" value={item.quantity ?? 1} onChange={e => updateItem(index, "quantity", e.target.value)} />
                  </label>
                  <button className="btn-danger btn-sm" onClick={() => removeItem(index)} style={{ marginBottom: 0 }}>
                    🗑
                  </button>
                </div>
                {(item.allergenOption && item.allergenOption !== "standard") && (
                  <span className="badge badge-orange">⚠️ {item.allergenOption.replace(/_/g, " ")}</span>
                )}
                {item.notes && (
                  <div style={{ fontSize: "0.85rem", color: "var(--ink-3)", fontStyle: "italic" }}>
                    Note: {item.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* NOTE */}
      <SectionCard title="Note ordine" icon="📝">
        <textarea
          value={order.notes || ""}
          onChange={e => setOrder(prev => ({ ...prev, notes: e.target.value }))}
          rows={4}
          placeholder="Note aggiuntive sull'ordine..."
        />
        <label style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16, textTransform: "none", letterSpacing: 0, fontSize: "0.95rem", fontWeight: 500, color: "var(--ink-2)" }}>
          <input
            type="checkbox"
            checked={!!order.invoiceRequested}
            onChange={e => setOrder(prev => ({ ...prev, invoiceRequested: e.target.checked }))}
          />
          Il cliente richiede fattura
        </label>
      </SectionCard>

      {/* ALLEGATI */}
      <SectionCard title="Allegati" icon="📎">
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Foto ordine
            </div>
            {order.photoUrl ? (
              <img
                src={resolveUpload(order.photoUrl)}
                alt="Foto ordine"
                style={{ width: 220, borderRadius: "var(--r-md)", border: "1.5px solid var(--border)", display: "block" }}
              />
            ) : (
              <div style={{ color: "var(--ink-muted)", fontSize: "0.9rem" }}>Nessuna foto</div>
            )}
          </div>

          <div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Firma cliente
            </div>
            {(order.signatureUrl || order.signature || order.signatureDataUrl) ? (
              <img
                src={
                  order.signatureUrl
                    ? resolveUpload(order.signatureUrl)
                    : order.signature?.startsWith("data:image") ? order.signature
                    : order.signatureDataUrl?.startsWith("data:image") ? order.signatureDataUrl
                    : ""
                }
                alt="Firma cliente"
                style={{ maxWidth: 260, borderRadius: "var(--r-md)", border: "1.5px solid var(--border)", background: "#fff", display: "block" }}
              />
            ) : (
              <div style={{ color: "var(--ink-muted)", fontSize: "0.9rem" }}>Nessuna firma</div>
            )}
          </div>
        </div>
      </SectionCard>

    </div>
  );
}
