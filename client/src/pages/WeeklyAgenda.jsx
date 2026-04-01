import { apiFetch } from "../utils/auth.js";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

async function readJsonSafe(res) {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); }
  catch { throw new Error("Risposta non valida dal server"); }
}

function getStartOfWeek(baseDate = new Date()) {
  const d = new Date(baseDate);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatHour(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  } catch { return value; }
}

/* ================================
   STATI PRODUZIONE
================================ */
const STATI = {
  attesa: {
    label: "In attesa",
    bg: "var(--surface-2)",
    border: "var(--border)",
    headerBg: "#f3f4f6",
    headerColor: "var(--ink-3)",
    dot: "#9ca3af",
  },
  preparazione: {
    label: "In preparazione",
    bg: "#fffbeb",
    border: "#fde68a",
    headerBg: "#fef3c7",
    headerColor: "#92400e",
    dot: "#f59e0b",
  },
  pronto: {
    label: "Pronto ✓",
    bg: "#f0fdf4",
    border: "#86efac",
    headerBg: "#dcfce7",
    headerColor: "#14532d",
    dot: "#22c55e",
  },
};

/* ================================
   CARD SINGOLO ORDINE
================================ */
function OrderCard({ order, onStatusChange, onNavigate }) {
  const [saving, setSaving] = useState(false);

  const status = order.productionStatus || "attesa";
  const stile = STATI[status] || STATI.attesa;
  const isDelivery = order.fulfillment?.type === "delivery";

  async function setStatus(newStatus) {
    if (newStatus === status || saving) return;
    setSaving(true);
    try {
      const updated = { ...order, productionStatus: newStatus };
      const res = await apiFetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(data?.error || "Errore aggiornamento stato");
      onStatusChange(order.id, newStatus);
    } catch (err) {
      console.error(err);
      alert(err.message || "Errore aggiornamento stato");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      width: 220,
      flexShrink: 0,
      border: `2px solid ${stile.border}`,
      borderRadius: "var(--r-md)",
      background: stile.bg,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      transition: "box-shadow 0.15s, transform 0.15s",
      boxShadow: "var(--shadow-sm)",
    }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* HEADER CARD — stato corrente */}
      <div style={{
        background: stile.headerBg,
        padding: "7px 12px",
        display: "flex",
        alignItems: "center",
        gap: 6,
        borderBottom: `1.5px solid ${stile.border}`,
      }}>
        <div style={{
          width: 8, height: 8,
          borderRadius: "50%",
          background: stile.dot,
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: "0.7rem",
          fontWeight: 700,
          color: stile.headerColor,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          flex: 1,
        }}>
          {stile.label}
        </span>
        {saving && (
          <span style={{ fontSize: "0.65rem", color: stile.headerColor, opacity: 0.7 }}>⏳</span>
        )}
      </div>

      {/* BODY — info ordine, cliccabile per aprire */}
      <div
        style={{ padding: "12px 12px 8px", cursor: "pointer", flex: 1 }}
        onClick={() => onNavigate(order.id)}
      >
        <div style={{
          fontWeight: 800,
          fontSize: "1.15rem",
          color: isDelivery ? "var(--accent)" : "var(--warning)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
        }}>
          {formatHour(order.fulfillment?.deliveryDateTime)}
        </div>

        <div style={{
          fontWeight: 700,
          fontSize: "0.9rem",
          color: "var(--ink)",
          marginTop: 4,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {order.customer?.name || "Cliente"}
        </div>

        <div style={{ fontSize: "0.75rem", color: "var(--ink-3)", marginTop: 3 }}>
          {isDelivery ? "🚗 Consegna" : "🛍️ Ritiro"}
        </div>

        <div style={{ marginTop: 8, display: "grid", gap: 2 }}>
          {(order.items || []).slice(0, 3).map((it, idx) => (
            <div key={idx} style={{
              fontSize: "0.75rem",
              color: "var(--ink-2)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              • {it.productName || "Prodotto"}
              {it.weightGrams ? ` — ${(it.weightGrams / 1000).toFixed(1)} kg` : ""}
            </div>
          ))}
          {(order.items || []).length > 3 && (
            <div style={{ fontSize: "0.7rem", color: "var(--ink-muted)" }}>
              +{(order.items || []).length - 3} altri
            </div>
          )}
        </div>
      </div>

      {/* FOOTER — bottoni cambio stato */}
      <div style={{
        padding: "8px 10px",
        borderTop: `1.5px solid ${stile.border}`,
        display: "flex",
        gap: 5,
      }}>
        <button
          disabled={saving || status === "attesa"}
          onClick={e => { e.stopPropagation(); setStatus("attesa"); }}
          style={{
            flex: 1,
            minHeight: 34,
            padding: "5px 2px",
            fontSize: "0.68rem",
            fontWeight: 700,
            borderRadius: "var(--r-sm)",
            border: status === "attesa" ? "2px solid #9ca3af" : "1.5px solid var(--border)",
            background: status === "attesa" ? "#f3f4f6" : "transparent",
            color: "#374151",
            cursor: status === "attesa" ? "default" : "pointer",
            opacity: status === "attesa" ? 1 : 0.65,
            transition: "opacity 0.12s",
            boxShadow: "none",
            transform: "none",
          }}
        >
          ⚪ Attesa
        </button>

        <button
          disabled={saving || status === "preparazione"}
          onClick={e => { e.stopPropagation(); setStatus("preparazione"); }}
          style={{
            flex: 1,
            minHeight: 34,
            padding: "5px 2px",
            fontSize: "0.68rem",
            fontWeight: 700,
            borderRadius: "var(--r-sm)",
            border: status === "preparazione" ? "2px solid #f59e0b" : "1.5px solid #fde68a",
            background: status === "preparazione" ? "#fef3c7" : "transparent",
            color: "#92400e",
            cursor: status === "preparazione" ? "default" : "pointer",
            opacity: status === "preparazione" ? 1 : 0.65,
            transition: "opacity 0.12s",
            boxShadow: "none",
            transform: "none",
          }}
        >
          🟡 Prep.
        </button>

        <button
          disabled={saving || status === "pronto"}
          onClick={e => { e.stopPropagation(); setStatus("pronto"); }}
          style={{
            flex: 1,
            minHeight: 34,
            padding: "5px 2px",
            fontSize: "0.68rem",
            fontWeight: 700,
            borderRadius: "var(--r-sm)",
            border: status === "pronto" ? "2px solid #22c55e" : "1.5px solid #86efac",
            background: status === "pronto" ? "#dcfce7" : "transparent",
            color: "#14532d",
            cursor: status === "pronto" ? "default" : "pointer",
            opacity: status === "pronto" ? 1 : 0.65,
            transition: "opacity 0.12s",
            boxShadow: "none",
            transform: "none",
          }}
        >
          🟢 Pronto
        </button>
      </div>
    </div>
  );
}

/* ================================
   COMPONENTE PRINCIPALE
================================ */
export default function WeeklyAgenda() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/orders");
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(data?.error || "Errore caricamento ordini");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Errore caricamento agenda");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Aggiorna lo stato localmente senza ricaricare tutto
  const handleStatusChange = useCallback((orderId, newStatus) => {
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, productionStatus: newStatus } : o
    ));
  }, []);

  const weekDays = useMemo(() => {
    const start = getStartOfWeek(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, []);

  const grouped = useMemo(() => {
    return weekDays.map(day => {
      const items = orders
        .filter(o => {
          const dt = o.fulfillment?.deliveryDateTime;
          if (!dt) return false;
          const d = new Date(dt);
          return !Number.isNaN(d.getTime()) && sameDay(d, day);
        })
        .sort((a, b) =>
          new Date(a.fulfillment?.deliveryDateTime || 0).getTime() -
          new Date(b.fulfillment?.deliveryDateTime || 0).getTime()
        );
      return { day, items };
    });
  }, [orders, weekDays]);

  const today = new Date();
  const totalThisWeek = grouped.reduce((acc, { items }) => acc + items.length, 0);

  return (
    <div style={{ display: "grid", gap: "var(--gap-lg)" }}>

      {/* HEADER PAGINA */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Agenda settimanale</h1>
          <p style={{ marginTop: 6, color: "var(--ink-3)" }}>
            {loading ? "Caricamento..." : `${totalThisWeek} ordini questa settimana`}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Legenda stati */}
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {Object.entries(STATI).map(([key, s]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.8rem", color: "var(--ink-3)", fontWeight: 500 }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: s.dot }} />
                {s.label}
              </div>
            ))}
          </div>
          <button onClick={load} disabled={loading}>🔄 Aggiorna</button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {loading ? (
        <div className="loading-text">Caricamento agenda...</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {grouped.map(({ day, items }) => {
            const isToday = sameDay(day, today);
            const isPast = day < today && !isToday;

            // Contatori per stato (solo se ci sono ordini)
            const countPerStato = Object.fromEntries(
              Object.keys(STATI).map(s => [
                s,
                items.filter(o => (o.productionStatus || "attesa") === s).length,
              ])
            );

            return (
              <div
                key={day.toISOString()}
                style={{
                  background: "var(--surface)",
                  border: isToday ? "2px solid var(--accent)" : "1.5px solid var(--border)",
                  borderRadius: "var(--r-lg)",
                  overflow: "hidden",
                  opacity: isPast ? 0.55 : 1,
                  boxShadow: isToday ? "var(--shadow-md)" : "var(--shadow-sm)",
                }}
              >
                {/* INTESTAZIONE RIGA GIORNO */}
                <div style={{
                  background: isToday ? "var(--accent)" : "var(--surface-2)",
                  padding: "13px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  borderBottom: isToday ? "none" : "1.5px solid var(--border)",
                }}>
                  {/* Data */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                    <span style={{
                      fontFamily: "var(--font-title)",
                      fontSize: "1.55rem",
                      color: isToday ? "#fff" : "var(--ink)",
                      lineHeight: 1,
                      flexShrink: 0,
                    }}>
                      {day.getDate()}
                    </span>
                    <span style={{
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      textTransform: "capitalize",
                      letterSpacing: "0.02em",
                      color: isToday ? "rgba(255,255,255,0.9)" : "var(--ink-2)",
                    }}>
                      {day.toLocaleDateString("it-IT", { weekday: "long", month: "long" })}
                    </span>
                    {isToday && (
                      <span style={{
                        background: "rgba(255,255,255,0.22)",
                        color: "#fff",
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        padding: "2px 9px",
                        borderRadius: "var(--r-full)",
                        letterSpacing: "0.07em",
                        textTransform: "uppercase",
                        flexShrink: 0,
                      }}>
                        Oggi
                      </span>
                    )}
                  </div>

                  {/* Contatori a destra */}
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                    {items.length === 0 ? (
                      <span style={{ fontSize: "0.82rem", color: isToday ? "rgba(255,255,255,0.55)" : "var(--ink-muted)" }}>
                        Nessun ordine
                      </span>
                    ) : (
                      <>
                        {Object.entries(STATI).map(([key, s]) =>
                          countPerStato[key] > 0 ? (
                            <div key={key} style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              color: isToday ? "rgba(255,255,255,0.85)" : "var(--ink-3)",
                            }}>
                              <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot }} />
                              {countPerStato[key]}
                            </div>
                          ) : null
                        )}
                        <span style={{
                          background: isToday ? "rgba(255,255,255,0.22)" : "var(--ink)",
                          color: "#fff",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "3px 11px",
                          borderRadius: "var(--r-full)",
                        }}>
                          {items.length} {items.length === 1 ? "ordine" : "ordini"}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* ORDINI IN ORIZZONTALE */}
                {items.length > 0 && (
                  <div style={{
                    padding: "16px 20px",
                    display: "flex",
                    flexDirection: "row",
                    gap: 12,
                    overflowX: "auto",
                    WebkitOverflowScrolling: "touch",
                    scrollbarWidth: "thin",
                  }}>
                    {items.map(o => (
                      <OrderCard
                        key={o.id}
                        order={o}
                        onStatusChange={handleStatusChange}
                        onNavigate={id => navigate(`/ordini/${id}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
