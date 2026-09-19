import { apiFetch, getUser } from "../utils/auth.js";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { printOrder } from "../utils/print.js";

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

function formatCream(grams) {
  return grams >= 1000 ? `${(grams / 1000).toFixed(2).replace(".", ",")} kg` : `${Math.round(grams)} g`;
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
   TIPI PRODOTTO (dolce / salato)
================================ */
const TIPI = {
  dolce: {
    label: "Dolce",
    icon: "🍰",
    accent: "#ec4899",
    bg: "#fdf2f8",
    headerBg: "#fce7f3",
    color: "#9d174d",
  },
  salato: {
    label: "Salato",
    icon: "🥖",
    accent: "#f97316",
    bg: "#fff7ed",
    headerBg: "#ffedd5",
    color: "#9a3412",
  },
};

/* ================================
   CARD SINGOLO ORDINE
================================ */
function OrderCard({ order, items, tipo, onStatusChange, onNavigate }) {
  const [saving, setSaving] = useState(false);
  const [askPrint, setAskPrint] = useState(false);
  const [printing, setPrinting] = useState(false);

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
      if (newStatus === "pronto") setAskPrint(true);
    } catch (err) {
      console.error(err);
      alert(err.message || "Errore aggiornamento stato");
    } finally {
      setSaving(false);
    }
  }

  async function handlePrint() {
    setPrinting(true);
    try {
      await printOrder(order.id);
      setAskPrint(false);
    } catch (err) {
      console.error(err);
      alert(err.message || "Errore stampa");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div style={{
      width: 220,
      flexShrink: 0,
      border: `2px solid ${stile.border}`,
      borderTop: `4px solid ${TIPI[tipo].accent}`,
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
          {isDelivery && order.fulfillment?.deliveryPerson && (
            <span style={{ fontWeight: 700, color: "var(--ink-2)" }}> · {order.fulfillment.deliveryPerson}</span>
          )}
        </div>

        {order.acknowledgedBy && (
          <div style={{
            marginTop: 5,
            display: "inline-block",
            background: "#dcfce7",
            color: "#14532d",
            border: "1px solid #86efac",
            borderRadius: 4,
            padding: "1px 7px",
            fontSize: "0.7rem",
            fontWeight: 700,
          }}>
            ✓ In carico a {order.acknowledgedBy}
          </div>
        )}

        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {items.map((it, idx) => {
            const hasAllergen = it.allergenOption && it.allergenOption !== "standard";
            const allergenLabel = hasAllergen
              ? it.allergenOption.replace(/_/g, " ").replace("no ", "No ")
              : null;
            return (
              <div key={idx} style={{
                background: "rgba(0,0,0,0.04)",
                borderRadius: "var(--r-sm)",
                padding: "6px 8px",
                borderLeft: hasAllergen ? "3px solid #f59e0b" : "3px solid transparent",
              }}>
                {/* Prodotto + variante */}
                <div style={{
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  color: "var(--ink)",
                }}>
                  {it.productName || "Prodotto"}
                  {it.variantName && (
                    <span style={{
                      marginLeft: 5,
                      fontWeight: 500,
                      color: "var(--accent)",
                      fontSize: "0.75rem",
                    }}>
                      — {it.variantName}
                    </span>
                  )}
                  {it.weightGrams ? (
                    <span style={{ fontWeight: 400, color: "var(--ink-3)", fontSize: "0.73rem", marginLeft: 5 }}>
                      {(it.weightGrams / 1000).toFixed(1)} kg
                    </span>
                  ) : null}
                  {it.persons ? (
                    <span style={{ fontWeight: 400, color: "var(--ink-3)", fontSize: "0.73rem", marginLeft: 5 }}>
                      {it.persons} pers.
                    </span>
                  ) : null}
                  {it.pieces ? (
                    <span style={{ fontWeight: 400, color: "var(--ink-3)", fontSize: "0.73rem", marginLeft: 5 }}>
                      {it.pieces} pz
                    </span>
                  ) : null}
                </div>

                {/* Allergeni */}
                {hasAllergen && (
                  <div style={{
                    marginTop: 3,
                    display: "inline-block",
                    background: "#fef3c7",
                    color: "#92400e",
                    border: "1px solid #fde68a",
                    borderRadius: 4,
                    padding: "1px 6px",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                  }}>
                    ⚠ {allergenLabel}
                  </div>
                )}

                {/* Note prodotto */}
                {it.notes && (
                  <div style={{
                    marginTop: 3,
                    fontSize: "0.72rem",
                    color: "var(--ink-2)",
                    fontStyle: "italic",
                  }}>
                    {it.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Note ordine */}
        {order.notes && (
          <div style={{
            marginTop: 6,
            padding: "5px 8px",
            background: "#eff6ff",
            borderRadius: "var(--r-sm)",
            fontSize: "0.72rem",
            color: "#1e40af",
            borderLeft: "3px solid #93c5fd",
            fontStyle: "italic",
          }}>
            {order.notes}
          </div>
        )}
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

      {askPrint && createPortal(
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
          onClick={e => e.target === e.currentTarget && !printing && setAskPrint(false)}
        >
          <div style={{
            background: "var(--surface)",
            borderRadius: "var(--r-xl)",
            padding: "28px 32px",
            maxWidth: 420,
            width: "100%",
            boxShadow: "var(--shadow-lg)",
          }}>
            <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-title)" }}>
              Ordine completato ✓
            </h3>
            <p style={{ margin: "0 0 20px", color: "var(--ink-2)" }}>
              {order.customer?.name || "Cliente"}
              {order.orderNumber ? ` — ordine ${order.orderNumber}` : ""}
              <br />
              Vuoi stampare la comanda?
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn-primary"
                onClick={handlePrint}
                disabled={printing}
                style={{ flex: 1 }}
              >
                {printing ? "Preparo la stampa..." : "🖨️ Stampa"}
              </button>
              <button onClick={() => setAskPrint(false)} disabled={printing}>
                No
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ================================
   BANNER NUOVI ORDINI DI OGGI
================================ */
function NewOrdersBanner({ orders, onAck }) {
  const [ackingId, setAckingId] = useState(null);

  if (orders.length === 0) return null;

  async function ack(order) {
    setAckingId(order.id);
    await onAck(order);
    setAckingId(null);
  }

  return (
    <div style={{
      background: "#fef2f2",
      border: "2px solid #ef4444",
      borderRadius: "var(--r-lg)",
      overflow: "hidden",
      boxShadow: "0 4px 16px rgba(239,68,68,0.18)",
    }}>
      <div style={{
        background: "#ef4444",
        color: "#fff",
        padding: "9px 20px",
        fontWeight: 800,
        fontSize: "0.85rem",
        letterSpacing: "0.07em",
        textTransform: "uppercase",
      }}>
        🔔 {orders.length === 1 ? "Nuovo ordine per oggi" : `${orders.length} nuovi ordini per oggi`}
      </div>
      <div style={{ display: "grid" }}>
        {orders.map((o, i) => (
          <div key={o.id} style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px 18px",
            padding: "12px 20px",
            borderTop: i === 0 ? "none" : "1px solid #fecaca",
          }}>
            <span style={{ fontWeight: 800, fontSize: "1.2rem", color: "#b91c1c", fontVariantNumeric: "tabular-nums" }}>
              {formatHour(o.fulfillment?.deliveryDateTime)}
            </span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, color: "var(--ink)" }}>
                {o.customer?.name || "Cliente"}
                <span style={{ fontWeight: 500, color: "var(--ink-3)", fontSize: "0.8rem", marginLeft: 8 }}>
                  {o.fulfillment?.type === "delivery" ? "🚗 Consegna" : "🛍️ Ritiro"}
                </span>
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--ink-2)", marginTop: 2 }}>
                {(o.items || []).map(it =>
                  [it.productName, it.variantName, it.weightGrams ? `${(it.weightGrams / 1000).toFixed(1)} kg` : ""]
                    .filter(Boolean).join(" ")
                ).join(" · ") || "—"}
              </div>
            </div>
            <button
              onClick={() => ack(o)}
              disabled={ackingId === o.id}
              style={{
                background: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: "var(--r-sm)",
                minHeight: "var(--touch)",
                padding: "0 34px",
                fontWeight: 800,
                fontSize: "1rem",
                boxShadow: "0 4px 12px rgba(239,68,68,0.3)",
              }}
            >
              {ackingId === o.id ? "..." : "OK"}
            </button>
          </div>
        ))}
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
  const [typeByProductId, setTypeByProductId] = useState({});
  const [creamByVariantId, setCreamByVariantId] = useState({});

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/orders");
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(data?.error || "Errore caricamento ordini");
      setOrders(Array.isArray(data) ? data : []);

      // Tipo prodotto (dolce/salato): se non disponibile, tutto "dolce"
      try {
        const pRes = await apiFetch("/api/products?limit=200");
        const pData = await readJsonSafe(pRes);
        if (pRes.ok && Array.isArray(pData)) {
          setTypeByProductId(Object.fromEntries(pData.map(p => [String(p.id), p.productType])));
        }
      } catch (e) {
        console.error(e);
      }

      // Grammi di crema per kg, per gusto (variante)
      try {
        const vRes = await apiFetch("/api/variants?limit=200");
        const vData = await readJsonSafe(vRes);
        if (vRes.ok && Array.isArray(vData)) {
          setCreamByVariantId(Object.fromEntries(
            vData.filter(v => v.creamGPerKg > 0).map(v => [String(v.id), { name: v.name, gPerKg: v.creamGPerKg }])
          ));
        }
      } catch (e) {
        console.error(e);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Errore caricamento agenda");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  // Aggiorna lo stato localmente senza ricaricare tutto
  const handleStatusChange = useCallback((orderId, newStatus) => {
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, productionStatus: newStatus } : o
    ));
  }, []);

  // Presa visione di un nuovo ordine: salva chi e quando lo ha confermato
  const handleAck = useCallback(async (order) => {
    const acknowledgedBy = getUser()?.username || "";
    const acknowledgedAt = new Date().toISOString();
    try {
      const res = await apiFetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...order, acknowledgedAt, acknowledgedBy }),
      });
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(data?.error || "Errore conferma ordine");
      setOrders(prev => prev.map(o =>
        o.id === order.id ? { ...o, acknowledgedAt, acknowledgedBy } : o
      ));
    } catch (err) {
      console.error(err);
      alert(err.message || "Errore conferma ordine");
    }
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

  // Crema necessaria per un giorno: kg di torta x g/kg del gusto, raggruppata per gusto
  const creamForOrders = useCallback((dayOrders) => {
    const perGusto = new Map();
    let totalGrams = 0;
    for (const o of dayOrders) {
      for (const it of o.items || []) {
        const cream = creamByVariantId[String(it.variantId)];
        if (!cream || !it.weightGrams) continue;
        if (typeByProductId[String(it.productId)] === "salato") continue;
        const grams = (it.weightGrams / 1000) * cream.gPerKg;
        perGusto.set(cream.name, (perGusto.get(cream.name) || 0) + grams);
        totalGrams += grams;
      }
    }
    return { totalGrams, perGusto: Array.from(perGusto.entries()) };
  }, [creamByVariantId, typeByProductId]);

  // Righe di un ordine appartenenti a un tipo (dolce/salato)
  const itemsOfType = useCallback((order, tipo) =>
    (order.items || []).filter(it =>
      (typeByProductId[String(it.productId)] === "salato" ? "salato" : "dolce") === tipo
    ), [typeByProductId]);

  const today = new Date();
  const totalThisWeek = grouped.reduce((acc, { items }) => acc + items.length, 0);
  // Nuovi = creati con la data di creazione, non ancora confermati, consegna oggi
  const newOrdersToday = orders
    .filter(o =>
      o.createdAt && !o.acknowledgedAt && o.fulfillment?.deliveryDateTime &&
      sameDay(new Date(o.fulfillment.deliveryDateTime), today)
    )
    .sort((a, b) =>
      new Date(a.fulfillment.deliveryDateTime).getTime() - new Date(b.fulfillment.deliveryDateTime).getTime()
    );
  const todayItems = grouped.find(g => sameDay(g.day, today))?.items || [];
  const creamToday = creamForOrders(todayItems);

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

      {/* BANNER NUOVI ORDINI DI OGGI */}
      {!loading && <NewOrdersBanner orders={newOrdersToday} onAck={handleAck} />}

      {/* CREMA DA PREPARARE OGGI */}
      {!loading && (
        <div style={{
          background: "#fffbeb",
          border: "2px solid #fde68a",
          borderRadius: "var(--r-lg)",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px 24px",
        }}>
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              🍮 Crema da preparare oggi
            </div>
            <div style={{ fontFamily: "var(--font-title)", fontSize: "1.8rem", color: "#92400e", lineHeight: 1.1, marginTop: 2 }}>
              {creamToday.totalGrams > 0 ? formatCream(creamToday.totalGrams) : "—"}
            </div>
          </div>
          {creamToday.perGusto.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {creamToday.perGusto.map(([nome, g]) => (
                <span key={nome} style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  border: "1px solid #fde68a",
                  borderRadius: "var(--r-full)",
                  padding: "4px 12px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}>
                  {nome}: <strong>{formatCream(g)}</strong>
                </span>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: "0.85rem", color: "#92400e", opacity: 0.75 }}>
              Nessuna crema da preparare oggi
            </span>
          )}
        </div>
      )}

      {error && <div className="error-box">{error}</div>}

      {loading ? (
        <div className="loading-text">Caricamento agenda...</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {grouped.map(({ day, items }) => {
            const isToday = sameDay(day, today);
            const isPast = day < today && !isToday;
            const cream = creamForOrders(items);

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
                        {cream.totalGrams > 0 && (
                          <span
                            title={cream.perGusto.map(([n, g]) => `${n}: ${formatCream(g)}`).join("\n")}
                            style={{
                              background: "#fef3c7",
                              color: "#92400e",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              padding: "3px 11px",
                              borderRadius: "var(--r-full)",
                            }}
                          >
                            🍮 Crema: {formatCream(cream.totalGrams)}
                          </span>
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

                {/* ORDINI IN ORIZZONTALE — sezioni Dolce / Salato */}
                {items.length > 0 && (
                  <div style={{ display: "grid" }}>
                    {Object.entries(TIPI).map(([tipo, t]) => {
                      const rows = items
                        .map(o => ({ order: o, lines: itemsOfType(o, tipo) }))
                        .filter(r => r.lines.length > 0);
                      if (rows.length === 0) return null;
                      return (
                        <div key={tipo} style={{ background: t.bg, borderTop: `3px solid ${t.accent}` }}>
                          <div style={{
                            padding: "8px 20px",
                            background: t.headerBg,
                            color: t.color,
                            fontWeight: 800,
                            fontSize: "0.8rem",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                          }}>
                            {t.icon} {t.label} · {rows.length}
                            {tipo === "dolce" && cream.perGusto.length > 0 && (
                              <span style={{ marginLeft: 14, fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>
                                🍮 {cream.perGusto.map(([n, g]) => `${n}: ${formatCream(g)}`).join(" · ")}
                              </span>
                            )}
                          </div>
                          <div style={{
                            padding: "16px 20px",
                            display: "flex",
                            flexDirection: "row",
                            gap: 12,
                            overflowX: "auto",
                            WebkitOverflowScrolling: "touch",
                            scrollbarWidth: "thin",
                          }}>
                            {rows.map(({ order, lines }) => (
                              <OrderCard
                                key={order.id}
                                order={order}
                                items={lines}
                                tipo={tipo}
                                onStatusChange={handleStatusChange}
                                onNavigate={id => navigate(`/ordini/${id}`)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
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
