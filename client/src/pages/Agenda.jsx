import { useEffect, useMemo, useState } from "react";

// yyyy-mm-dd da ISO/datetime-local
function getDayKey(iso) {
  return iso.slice(0, 10);
}

function formatDay(key) {
  const d = new Date(key);
  return d.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatKgFromGrams(weightGrams) {
  if (!weightGrams) return "—";
  // 1 cifra decimale va bene per una pasticceria
  return `${(weightGrams / 1000).toFixed(1)} kg`;
}

export default function Agenda() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch("/api/orders-agenda")
      .then((r) => r.json())
      .then(setOrders)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  // Raggruppa per giorno (gli ordini arrivano già ordinati per data/ora dal backend)
  const grouped = useMemo(() => {
    const map = new Map();
    for (const o of orders) {
      const key = getDayKey(o.fulfillment.deliveryDateTime);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(o);
    }
    return Array.from(map.entries()); // [[day, orders]]
  }, [orders]);

  if (loading) return <p>Caricamento agenda...</p>;
  if (orders.length === 0) return <p>Nessun ordine in agenda.</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>Agenda Produzione</h2>
        <button onClick={load} style={{ marginLeft: "auto" }}>
          Aggiorna
        </button>
      </div>

      <p style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>
        Vista essenziale: prodotto + peso (kg), ordinato per giorno e ora.
      </p>

      {grouped.map(([day, list]) => (
        <div key={day} style={{ marginTop: 18 }}>
          <h3 style={{ marginBottom: 8, borderBottom: "2px solid #eee", paddingBottom: 6 }}>
            📅 {formatDay(day)}
          </h3>

          <div style={{ display: "grid", gap: 8 }}>
            {list.map((o) => (
              <div
                key={o.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                {/* ORA */}
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  {formatTime(o.fulfillment.deliveryDateTime)}
                </div>

                {/* SOLO PRODOTTI + PESO */}
                <div style={{ display: "grid", gap: 4, fontSize: 14 }}>
                  {o.items.map((it, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span>• {it.nameSnapshot}</span>
                      <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
                        {formatKgFromGrams(it.weightGrams)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}