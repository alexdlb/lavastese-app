import { apiFetch } from "../utils/auth.js";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { buildWhatsAppUrl } from "../utils/whatsapp";

async function readJsonSafe(res) {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); }
  catch { throw new Error("Risposta non valida dal server"); }
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("it-IT", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return value; }
}

export default function OrdersList() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/orders");
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(data?.error || "Errore caricamento ordini");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOrders(); }, []);

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    return !q ||
      (o.customer?.name || "").toLowerCase().includes(q) ||
      (o.customer?.phone || "").toLowerCase().includes(q);
  });

  return (
    <div style={{ display: "grid", gap: "var(--gap-lg)" }}>

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Ordini</h1>
          <p style={{ marginTop: 6, color: "var(--ink-3)" }}>
            {loading ? "Caricamento..." : `${orders.length} ordini totali`}
          </p>
        </div>
        <button className="btn-primary" onClick={() => navigate("/nuovo-ordine")}>
          ＋ Nuovo ordine
        </button>
      </div>

      {/* SEARCH */}
      <div style={{ position: "relative" }}>
        <span style={{
          position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
          color: "var(--ink-3)", fontSize: "1rem", pointerEvents: "none",
        }}>🔍</span>
        <input
          type="text"
          placeholder="Cerca per cliente o telefono..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 42 }}
        />
      </div>

      {/* LISTA */}
      {loading ? (
        <div className="loading-text">Caricamento ordini...</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 600, color: "var(--ink-2)" }}>
            {search ? "Nessun risultato trovato" : "Nessun ordine presente"}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "var(--gap)" }}>
          {filtered.map(o => {
            const waUrl = buildWhatsAppUrl(o);
            const isDelivery = o.fulfillment?.type === "delivery";

            return (
              <div
                key={o.id}
                className="card"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 16,
                  alignItems: "center",
                  padding: "20px 24px",
                  cursor: "pointer",
                  transition: "box-shadow 0.15s, transform 0.15s",
                }}
                onClick={() => navigate(`/ordini/${o.id}`)}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = "var(--shadow-md)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {/* LEFT */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
                  <div style={{
                    width: 50,
                    height: 50,
                    borderRadius: "var(--r-sm)",
                    background: isDelivery ? "var(--accent-light)" : "var(--warning-light)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.4rem",
                    flexShrink: 0,
                  }}>
                    {isDelivery ? "🚗" : "🛍️"}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--ink)" }}>
                      {o.customer?.name || "—"}
                    </div>
                    <div style={{ fontSize: "0.88rem", color: "var(--ink-3)", marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span>{o.customer?.phone || "—"}</span>
                      <span>•</span>
                      <span>{formatDateTime(o.fulfillment?.deliveryDateTime)}</span>
                      <span>•</span>
                      <span>{o.items?.length || 0} {o.items?.length === 1 ? "prodotto" : "prodotti"}</span>
                    </div>
                  </div>
                </div>

                {/* RIGHT */}
                <div
                  style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}
                  onClick={e => e.stopPropagation()}
                >
                  <span className={`badge ${isDelivery ? "badge-blue" : "badge-orange"}`}>
                    {isDelivery ? "Consegna" : "Ritiro"}
                  </span>

                  <a
                    href={waUrl || undefined}
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => {
                      if (!waUrl) { e.preventDefault(); alert("Numero cliente mancante"); }
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "9px 14px",
                      background: "#dcfce7",
                      border: "1.5px solid #86efac",
                      borderRadius: "var(--r-sm)",
                      color: "#15803d",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      textDecoration: "none",
                      minHeight: "var(--touch)",
                    }}
                  >
                    WhatsApp
                  </a>

                  <button
                    className="btn-sm"
                    onClick={() => navigate(`/ordini/${o.id}`)}
                    style={{ flexShrink: 0 }}
                  >
                    Apri →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
