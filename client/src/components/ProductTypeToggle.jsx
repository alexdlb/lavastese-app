import { PRODUCT_TYPES } from "../utils/productTypes.js";

// Selettore Dolce / Salato. fill = i due tasti occupano tutta la larghezza.
export default function ProductTypeToggle({ value, onChange, fill = false }) {
  return (
    <div style={{ display: "flex", gap: fill ? 8 : 6, flexShrink: 0 }}>
      {Object.entries(PRODUCT_TYPES).map(([key, t]) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            style={{
              ...(fill ? { flex: 1 } : { padding: "0 14px", minHeight: "var(--touch)", fontSize: "0.85rem", borderRadius: "var(--r-sm)" }),
              fontWeight: 700,
              border: active ? `2px solid ${t.accent}` : "1.5px solid var(--border)",
              background: active ? t.headerBg : "transparent",
              color: active ? t.color : "var(--ink-3)",
              boxShadow: "none",
              transform: "none",
            }}
          >
            {t.icon} {t.label}
          </button>
        );
      })}
    </div>
  );
}
