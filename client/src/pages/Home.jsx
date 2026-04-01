import { apiFetch } from "../utils/auth.js";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function formatTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  } catch { return value; }
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("it-IT", { day: "2-digit", month: "long" });
  } catch { return value; }
}

const QUICK_ACTIONS = [
  {
    to: "/nuovo-ordine",
    icon: "＋",
    label: "Nuovo ordine",
    sub: "Inserisci rapidamente un ordine",
    accent: "#2563eb",
    light: "#eff4ff",
    border: "#bfdbfe",
  },
  {
    to: "/ordini",
    icon: "📋",
    label: "Ordini",
    sub: "Visualizza e modifica gli ordini",
    accent: "#7c3aed",
    light: "#f5f3ff",
    border: "#ddd6fe",
  },
  {
    to: "/prodotti",
    icon: "🎂",
    label: "Prodotti",
    sub: "Gestisci categorie e catalogo",
    accent: "#059669",
    light: "#ecfdf5",
    border: "#a7f3d0",
  },
  {
    to: "/agenda-settimanale",
    icon: "📅",
    label: "Agenda",
    sub: "Vista settimanale degli ordini",
    accent: "#d97706",
    light: "#fffbeb",
    border: "#fde68a",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [todayOrders, setTodayOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      try {
        const res = await apiFetch("/api/orders");
        const text = await res.text();
        const data = text ? JSON.parse(text) : [];
        const today = new Date().toISOString().slice(0, 10);
        const filtered = (Array.isArray(data) ? data : [])
          .filter(o => o.fulfillment?.deliveryDateTime?.startsWith(today))
          .sort((a, b) => (a.fulfillment?.deliveryDateTime || "").localeCompare(b.fulfillment?.deliveryDateTime || ""));
        setTodayOrders(filtered);
      } catch {
        setTodayOrders([]);
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, []);

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Buongiorno" : now.getHours() < 18 ? "Buon pomeriggio" : "Buonasera";

  return (
    <div style={{ display: "grid", gap: "var(--gap-xl)" }}>

      {/* HEADER HERO */}
      <div style={{
        background: "var(--surface)",
        border: "1.5px solid var(--border)",
        borderRadius: "var(--r-xl)",
        padding: "32px 36px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "var(--shadow-sm)",
        gap: 24,
      }}>
        <div>
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
            Dashboard
          </div>
          <h1 style={{ margin: 0, fontSize: "2rem" }}>{greeting} 👋</h1>
          <p style={{ marginTop: 8, color: "var(--ink-3)", fontSize: "1rem" }}>
            {now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div style={{
          textAlign: "right",
          flexShrink: 0,
        }}>
          <div style={{ fontSize: "3rem", fontFamily: "var(--font-title)", color: "var(--ink)", lineHeight: 1 }}>
            {loading ? "—" : todayOrders.length}
          </div>
          <div style={{ fontSize: "0.82rem", color: "var(--ink-3)", marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {todayOrders.length === 1 ? "ordine oggi" : "ordini oggi"}
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div>
        <h2 style={{ marginBottom: 16, fontSize: "1.1rem", fontFamily: "var(--font-ui)", fontWeight: 700, color: "var(--ink-2)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Accesso rapido
        </h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "var(--gap)",
        }}>
          {QUICK_ACTIONS.map(({ to, icon, label, sub, accent, light, border }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              style={{
                background: light,
                border: `1.5px solid ${border}`,
                borderRadius: "var(--r-lg)",
                padding: "24px 22px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 12,
                minHeight: 150,
                textAlign: "left",
                boxShadow: "none",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow = "var(--shadow-md)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <span style={{ fontSize: "2rem" }}>{icon}</span>
              <div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: accent, fontFamily: "var(--font-ui)" }}>
                  {label}
                </div>
                <div style={{ fontSize: "0.84rem", color: "var(--ink-3)", marginTop: 4, lineHeight: 1.4 }}>
                  {sub}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ORDINI DI OGGI */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontFamily: "var(--font-ui)", fontWeight: 700, color: "var(--ink-2)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Ordini di oggi
          </h2>
          <button className="btn-ghost btn-sm" onClick={() => navigate("/ordini")}>
            Vedi tutti →
          </button>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div className="loading-text">Caricamento...</div>
          ) : todayOrders.length === 0 ? (
            <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--ink-3)" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>🎉</div>
              <div style={{ fontWeight: 500 }}>Nessun ordine previsto per oggi</div>
            </div>
          ) : (
            todayOrders.map((o, i) => (
              <div
                key={o.id}
                onClick={() => navigate(`/ordini/${o.id}`)}
                style={{
                  padding: "18px 24px",
                  borderBottom: i < todayOrders.length - 1 ? "1.5px solid var(--border)" : "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: "var(--r-sm)",
                    background: o.fulfillment?.type === "delivery" ? "var(--accent-light)" : "var(--warning-light)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.2rem",
                    flexShrink: 0,
                  }}>
                    {o.fulfillment?.type === "delivery" ? "🚗" : "🛍️"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--ink)" }}>
                      {o.customer?.name || "Cliente"}
                    </div>
                    <div style={{ fontSize: "0.84rem", color: "var(--ink-3)", marginTop: 2 }}>
                      {o.items?.length || 0} {o.items?.length === 1 ? "prodotto" : "prodotti"}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                    {formatTime(o.fulfillment?.deliveryDateTime)}
                  </div>
                  <span className={`badge ${o.fulfillment?.type === "delivery" ? "badge-blue" : "badge-orange"}`} style={{ marginTop: 4 }}>
                    {o.fulfillment?.type === "delivery" ? "Consegna" : "Ritiro"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
