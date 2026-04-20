import { apiFetch } from "../utils/auth.js";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { buildWhatsAppUrl } from "../utils/whatsapp";

async function readJsonSafe(res) {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); }
  catch { throw new Error("Risposta non valida"); }
}

const DAYS_IT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const MONTHS_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 06:00 → 21:00
const HOUR_PX = 64; // altezza di ogni ora in pixel

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Dom
  d.setDate(d.getDate() - day + 1); // Lunedì
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatHour(value) {
  if (!value) return "";
  try { return new Date(value).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

function getOrderTop(dt) {
  if (!dt) return null;
  const d = new Date(dt);
  const h = d.getHours() + d.getMinutes() / 60;
  const offset = h - 6; // 6 = prima ora
  if (offset < 0 || offset > 15) return null;
  return offset * HOUR_PX;
}

// Mini calendario mensile
function MiniCalendar({ selectedDate, onSelectDate, onMonthChange }) {
  const [month, setMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  function prevMonth() {
    const m = new Date(month.getFullYear(), month.getMonth() - 1, 1);
    setMonth(m);
    onMonthChange && onMonthChange(m);
  }
  function nextMonth() {
    const m = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    setMonth(m);
    onMonthChange && onMonthChange(m);
  }

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last  = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    let startDow = first.getDay(); // 0=Dom
    startDow = startDow === 0 ? 6 : startDow - 1; // converti a Lun=0
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      cells.push(new Date(month.getFullYear(), month.getMonth(), d));
    }
    return cells;
  }, [month]);

  const todayKey = toDateKey(new Date());
  const selKey   = toDateKey(selectedDate);

  return (
    <div style={{ userSelect: "none" }}>
      {/* Header mese */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button onClick={prevMonth} style={{ border: "none", background: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6, fontSize: "1rem", color: "var(--ink-2)" }}>&#x2039;</button>
        <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--ink)" }}>
          {MONTHS_IT[month.getMonth()]} {month.getFullYear()}
        </span>
        <button onClick={nextMonth} style={{ border: "none", background: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6, fontSize: "1rem", color: "var(--ink-2)" }}>&#x203A;</button>
      </div>

      {/* Giorni settimana */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 4 }}>
        {["L","M","M","G","V","S","D"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: "0.68rem", fontWeight: 700, color: "var(--ink-3)", padding: "2px 0" }}>{d}</div>
        ))}
      </div>

      {/* Celle giorni */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
        {days.map((d, i) => {
          if (!d) return <div key={i} />;
          const key = toDateKey(d);
          const isToday = key === todayKey;
          const isSelected = key === selKey;
          return (
            <div
              key={i}
              onClick={() => onSelectDate(d)}
              style={{
                textAlign: "center",
                padding: "5px 2px",
                borderRadius: 6,
                fontSize: "0.78rem",
                fontWeight: isToday || isSelected ? 700 : 400,
                cursor: "pointer",
                background: isSelected ? "var(--accent)" : isToday ? "var(--accent-light)" : "transparent",
                color: isSelected ? "#fff" : isToday ? "var(--accent)" : "var(--ink)",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--surface-2)"; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isToday ? "var(--accent-light)" : "transparent"; }}
            >
              {d.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Popup ordine
function OrderPopup({ order, onClose, onOpen }) {
  const isDelivery = order.fulfillment?.type === "delivery";
  const waUrl = buildWhatsAppUrl(order);
  const hasAllergen = (order.items || []).some(it => it.allergenOption && it.allergenOption !== "standard");

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: "absolute",
        zIndex: 200,
        background: "var(--surface)",
        border: "1.5px solid var(--border)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--shadow-lg)",
        padding: "14px 16px",
        minWidth: 240,
        maxWidth: 300,
        left: "50%",
        transform: "translateX(-50%)",
        top: "calc(100% + 8px)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--ink)" }}>
            {order.customer?.name || "—"}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--ink-3)", marginTop: 2 }}>
            {formatHour(order.fulfillment?.deliveryDateTime)} · {isDelivery ? "Consegna" : "Ritiro"}
          </div>
        </div>
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "1.1rem", color: "var(--ink-3)", padding: 0 }}>&#x2715;</button>
      </div>

      {hasAllergen && (
        <div style={{ marginBottom: 8, background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", borderRadius: 6, padding: "4px 8px", fontSize: "0.72rem", fontWeight: 700 }}>
          &#x26A0; Allergeni presenti
        </div>
      )}

      <div style={{ display: "grid", gap: 3, marginBottom: 10 }}>
        {(order.items || []).map((it, i) => (
          <div key={i} style={{ fontSize: "0.8rem", color: "var(--ink-2)" }}>
            • {it.productName || "Prodotto"}
            {it.variantName ? ` — ${it.variantName}` : ""}
            {it.weightGrams ? ` · ${(it.weightGrams / 1000).toFixed(1)}kg` : ""}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn-primary btn-sm" style={{ flex: 1 }} onClick={onOpen}>
          Apri ordine
        </button>
        {waUrl && (
          <a href={waUrl} target="_blank" rel="noreferrer" style={{
            display: "inline-flex", alignItems: "center", padding: "6px 12px",
            background: "#dcfce7", border: "1.5px solid #86efac", borderRadius: "var(--r-sm)",
            color: "#15803d", fontSize: "0.78rem", fontWeight: 600, textDecoration: "none",
          }}>
            WA
          </a>
        )}
      </div>
    </div>
  );
}

// Card evento nel calendario
function EventCard({ order, onClick, isSelected }) {
  const isDelivery = order.fulfillment?.type === "delivery";
  const hasAllergen = (order.items || []).some(it => it.allergenOption && it.allergenOption !== "standard");
  const status = order.productionStatus || "attesa";
  const bg = isDelivery ? "#dbeafe" : "#fef3c7";
  const border = isDelivery ? "#93c5fd" : "#fcd34d";
  const textColor = isDelivery ? "#1e40af" : "#92400e";

  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(order); }}
      style={{
        background: bg,
        border: `1.5px solid ${border}`,
        borderLeft: `3px solid ${isDelivery ? "#2563eb" : "#d97706"}`,
        borderRadius: 6,
        padding: "3px 6px",
        cursor: "pointer",
        marginBottom: 2,
        boxShadow: isSelected ? "0 0 0 2px var(--accent)" : "none",
        transition: "box-shadow 0.1s, opacity 0.1s",
        opacity: 1,
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
      onMouseLeave={e => e.currentTarget.style.opacity = "1"}
    >
      <div style={{ fontWeight: 700, fontSize: "0.72rem", color: textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {formatHour(order.fulfillment?.deliveryDateTime)} {order.customer?.name || "—"}
      </div>
      <div style={{ fontSize: "0.66rem", color: textColor, opacity: 0.8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {(order.items || []).map(it => it.productName).filter(Boolean).join(", ")}
      </div>
      {hasAllergen && (
        <span style={{ position: "absolute", top: 2, right: 4, fontSize: "0.65rem" }}>&#x26A0;</span>
      )}
    </div>
  );
}

export default function OrdersList() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedOrder, setSelectedOrder] = useState(null);
  const today = new Date(); today.setHours(0,0,0,0);

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/orders");
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(data?.error || "Errore");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  // 7 giorni dalla data selezionata (lunedì della settimana)
  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
  const weekDays  = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Indice per data
  const ordersByDay = useMemo(() => {
    const map = new Map();
    const q = search.toLowerCase();
    const visible = orders.filter(o => !q ||
      (o.customer?.name || "").toLowerCase().includes(q) ||
      (o.customer?.phone || "").toLowerCase().includes(q)
    );
    for (const o of visible) {
      const dt = o.fulfillment?.deliveryDateTime;
      if (!dt) continue;
      const key = dt.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(o);
    }
    return map;
  }, [orders, search]);

  const totalThisWeek = useMemo(() => {
    return weekDays.reduce((acc, d) => acc + (ordersByDay.get(toDateKey(d))?.length || 0), 0);
  }, [weekDays, ordersByDay]);

  function goToday() { setSelectedDate(new Date()); }
  function goPrevWeek() { setSelectedDate(d => addDays(d, -7)); }
  function goNextWeek() { setSelectedDate(d => addDays(d, 7)); }

  const nowHour = new Date().getHours() + new Date().getMinutes() / 60;
  const nowTop  = (nowHour - 6) * HOUR_PX;
  const todayKey = toDateKey(today);

  return (
    <div style={{ display: "flex", gap: 0, height: "calc(100vh - 80px)", overflow: "hidden", background: "var(--bg)" }}>

      {/* ── SIDEBAR SINISTRA ── */}
      <div style={{
        width: 220,
        flexShrink: 0,
        borderRight: "1.5px solid var(--border)",
        padding: "16px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        overflowY: "auto",
      }}>
        <button
          className="btn-primary"
          onClick={() => navigate("/nuovo-ordine")}
          style={{ width: "100%", borderRadius: 24 }}
        >
          &#xFF0B; Nuovo ordine
        </button>

        {/* Mini calendario */}
        <MiniCalendar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onMonthChange={() => {}}
        />

        {/* Ricerca */}
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ink-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Cerca</div>
          <input
            type="text"
            placeholder="Cliente o telefono..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontSize: "0.85rem" }}
          />
        </div>

        {/* Info settimana */}
        <div style={{ fontSize: "0.78rem", color: "var(--ink-3)" }}>
          {loading ? "Caricamento..." : `${totalThisWeek} ordini questa settimana · ${orders.length} totali`}
        </div>
      </div>

      {/* ── AREA CALENDARIO ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header navigazione settimana */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          borderBottom: "1.5px solid var(--border)",
          background: "var(--surface)",
          flexShrink: 0,
        }}>
          <button onClick={goPrevWeek} style={{ border: "1.5px solid var(--border)", background: "var(--surface)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700, color: "var(--ink-2)" }}>
            &#x2039;
          </button>
          <button onClick={goNextWeek} style={{ border: "1.5px solid var(--border)", background: "var(--surface)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700, color: "var(--ink-2)" }}>
            &#x203A;
          </button>
          <span style={{ fontFamily: "var(--font-title)", fontSize: "1.1rem", fontWeight: 700, color: "var(--ink)" }}>
            {MONTHS_IT[weekStart.getMonth()]} {weekStart.getFullYear()}
          </span>
          <button onClick={goToday} style={{ marginLeft: 8, border: "1.5px solid var(--border)", background: "var(--surface)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink-2)" }}>
            Oggi
          </button>
        </div>

        {/* Header giorni */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "48px repeat(7, 1fr)",
          borderBottom: "1.5px solid var(--border)",
          background: "var(--surface)",
          flexShrink: 0,
        }}>
          <div /> {/* colonna ore */}
          {weekDays.map((d, i) => {
            const key = toDateKey(d);
            const isToday = key === todayKey;
            const isSelected = key === toDateKey(selectedDate);
            const count = ordersByDay.get(key)?.length || 0;
            return (
              <div
                key={i}
                onClick={() => setSelectedDate(d)}
                style={{
                  textAlign: "center",
                  padding: "8px 4px",
                  cursor: "pointer",
                  borderLeft: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {["Lun","Mar","Mer","Gio","Ven","Sab","Dom"][i]}
                </div>
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  marginTop: 2,
                  background: isToday ? "var(--accent)" : isSelected ? "var(--accent-light)" : "transparent",
                  color: isToday ? "#fff" : isSelected ? "var(--accent)" : "var(--ink)",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                }}>
                  {d.getDate()}
                </div>
                {count > 0 && (
                  <div style={{ fontSize: "0.65rem", color: "var(--accent)", fontWeight: 700, marginTop: 2 }}>
                    {count}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Griglia ore */}
        <div style={{ flex: 1, overflowY: "auto", position: "relative" }} onClick={() => setSelectedOrder(null)}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "48px repeat(7, 1fr)",
            position: "relative",
            minHeight: HOURS.length * HOUR_PX,
          }}>

            {/* Colonna ore */}
            <div>
              {HOURS.map(h => (
                <div key={h} style={{
                  height: HOUR_PX,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "flex-end",
                  paddingRight: 8,
                  paddingTop: 4,
                  fontSize: "0.65rem",
                  color: "var(--ink-muted)",
                  fontWeight: 600,
                  borderTop: "1px solid var(--border)",
                }}>
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* Colonne giorni */}
            {weekDays.map((d, di) => {
              const key = toDateKey(d);
              const dayOrders = ordersByDay.get(key) || [];
              const isToday = key === todayKey;

              return (
                <div
                  key={di}
                  style={{
                    borderLeft: "1px solid var(--border)",
                    position: "relative",
                    background: isToday ? "rgba(37,99,235,0.02)" : "transparent",
                  }}
                >
                  {/* Linee ore */}
                  {HOURS.map(h => (
                    <div key={h} style={{ height: HOUR_PX, borderTop: "1px solid var(--border)" }} />
                  ))}

                  {/* Linea ora corrente */}
                  {isToday && nowTop >= 0 && nowTop <= HOURS.length * HOUR_PX && (
                    <div style={{
                      position: "absolute",
                      top: nowTop,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: "var(--accent)",
                      zIndex: 5,
                    }}>
                      <div style={{
                        position: "absolute",
                        left: -4,
                        top: -4,
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "var(--accent)",
                      }} />
                    </div>
                  )}

                  {/* Ordini posizionati */}
                  {dayOrders.map(o => {
                    const top = getOrderTop(o.fulfillment?.deliveryDateTime);
                    if (top === null) return null;
                    const isSelected = selectedOrder?.id === o.id;
                    return (
                      <div key={o.id} style={{ position: "absolute", top, left: 2, right: 2, zIndex: isSelected ? 100 : 10 }}>
                        <EventCard
                          order={o}
                          isSelected={isSelected}
                          onClick={() => setSelectedOrder(isSelected ? null : o)}
                        />
                        {isSelected && (
                          <OrderPopup
                            order={o}
                            onClose={() => setSelectedOrder(null)}
                            onOpen={() => navigate(`/ordini/${o.id}`)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
