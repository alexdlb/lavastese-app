import { useEffect, useState } from "react";
import { apiFetch } from "../utils/auth.js";

async function readJsonSafe(res) {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); }
  catch { throw new Error("Risposta non valida dal server"); }
}

/* ================================
   SEARCH DROPDOWN
================================ */
function SearchDropdown({ value, onChange, suggestions, loading, placeholder, renderItem, onSelect }) {
  const open = value.trim().length > 0;
  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <span style={{
          position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
          color: "var(--ink-muted)", pointerEvents: "none", fontSize: "1rem",
        }}>&#x1F50D;</span>
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete="off"
          style={{ paddingLeft: 42 }}
        />
      </div>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0, right: 0,
          background: "var(--surface)",
          border: "1.5px solid var(--border)",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--shadow-lg)",
          zIndex: 500,
          overflow: "hidden",
          maxHeight: 300,
          overflowY: "auto",
        }}>
          {loading ? (
            <div style={{ padding: "14px 18px", color: "var(--ink-3)", fontSize: "0.9rem" }}>Ricerca in corso...</div>
          ) : suggestions.length === 0 ? (
            <div style={{ padding: "14px 18px", color: "var(--ink-muted)", fontSize: "0.9rem" }}>
              Nessun risultato per "<strong>{value}</strong>"
            </div>
          ) : suggestions.map(item => (
            <div
              key={item.id}
              onMouseDown={() => onSelect(item)}
              style={{
                padding: "13px 18px",
                cursor: "pointer",
                borderBottom: "1px solid var(--border)",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--accent-light)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {renderItem(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================
   SECTION HEADER (come nelle altre pagine)
================================ */
function SectionHeader({ icon, title, count, countLabel }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: "1.3rem" }}>{icon}</span>
        <h2 style={{ margin: 0, fontSize: "1.2rem" }}>{title}</h2>
      </div>
      {count != null && (
        <span style={{
          background: "var(--surface-2)",
          border: "1.5px solid var(--border)",
          borderRadius: "var(--r-full)",
          padding: "3px 12px",
          fontSize: "0.8rem",
          fontWeight: 700,
          color: "var(--ink-3)",
        }}>
          {count} {countLabel}
        </span>
      )}
    </div>
  );
}

/* ================================
   LIST ITEM CON STILE CARD
================================ */
function ListItem({ label, sub, badge, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "13px 16px",
        borderRadius: "var(--r-md)",
        cursor: "pointer",
        background: selected ? "var(--accent-light)" : "var(--surface)",
        border: selected ? "1.5px solid #bfdbfe" : "1.5px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        transition: "all 0.13s",
        boxShadow: selected ? "var(--shadow-sm)" : "none",
      }}
      onMouseEnter={e => { if (!selected) { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.borderColor = "var(--border-strong)"; } }}
      onMouseLeave={e => { if (!selected) { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.borderColor = "var(--border)"; } }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontWeight: 600,
          fontSize: "0.95rem",
          color: selected ? "var(--accent)" : "var(--ink)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontFamily: "var(--font-ui)",
        }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: "0.78rem", color: "var(--ink-3)", marginTop: 3 }}>{sub}</div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
        {badge && (
          <span className="badge badge-gray">{badge}</span>
        )}
        {selected && (
          <span style={{
            width: 28, height: 28,
            background: "var(--accent)",
            borderRadius: "var(--r-sm)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.75rem", color: "#fff",
          }}>&#x270E;</span>
        )}
      </div>
    </div>
  );
}

/* ================================
   EDITOR PANEL LATERALE
================================ */
function EditorPanel({ icon, title, accentColor = "var(--accent)", accentLight = "var(--accent-light)", onClose, children }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1.5px solid var(--border)",
      borderRadius: "var(--r-xl)",
      overflow: "hidden",
      boxShadow: "var(--shadow-lg)",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header colorato */}
      <div style={{
        background: accentLight,
        padding: "18px 22px",
        borderBottom: "1.5px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.4rem" }}>{icon}</span>
          <div>
            <div style={{
              fontFamily: "var(--font-title)",
              fontSize: "1.15rem",
              color: accentColor,
            }}>{title}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--ink-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Modifica
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 34, height: 34,
            minHeight: 34,
            padding: 0,
            borderRadius: "var(--r-sm)",
            background: "rgba(0,0,0,0.06)",
            border: "none",
            color: "var(--ink-2)",
            fontSize: "1rem",
            boxShadow: "none",
          }}
        >x</button>
      </div>

      {/* Body */}
      <div style={{
        padding: "22px 22px",
        display: "grid",
        gap: 16,
        overflowY: "auto",
        flex: 1,
      }}>
        {children}
      </div>
    </div>
  );
}

/* ================================
   COMPONENTE PRINCIPALE
================================ */
export default function Products() {
  const [categories, setCategories]           = useState([]);
  const [productOptions, setProductOptions]   = useState([]);
  const [loadingBase, setLoadingBase]         = useState(false);

  const [catSearch, setCatSearch]             = useState("");
  const [catSuggestions, setCatSuggestions]   = useState([]);
  const [loadingCat, setLoadingCat]           = useState(false);
  const [selectedCat, setSelectedCat]         = useState(null);
  const [editCatName, setEditCatName]         = useState("");

  const [prodSearch, setProdSearch]           = useState("");
  const [prodSuggestions, setProdSuggestions] = useState([]);
  const [loadingProd, setLoadingProd]         = useState(false);
  const [catFilter, setCatFilter]             = useState("");
  const [selectedProd, setSelectedProd]       = useState(null);
  const [editProd, setEditProd]               = useState({ name: "", categoryId: "" });

  const [newCatName, setNewCatName]           = useState("");
  const [newProdName, setNewProdName]         = useState("");
  const [newProdCatId, setNewProdCatId]       = useState("");
  const [newSubName, setNewSubName]           = useState("");

  // Varianti globali
  const [variants, setVariants]               = useState([]);
  const [varSearch, setVarSearch]             = useState("");
  const [varSuggestions, setVarSuggestions]   = useState([]);
  const [loadingVar, setLoadingVar]           = useState(false);
  const [selectedVar, setSelectedVar]         = useState(null);
  const [editVarName, setEditVarName]         = useState("");
  const [newVarName, setNewVarName]           = useState("");

  const [toast, setToast]                     = useState("");

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }

  /* ---- CARICAMENTO DATI ---- */

  async function loadBase() {
    setLoadingBase(true);
    try {
      const [catRes, prodRes, varRes] = await Promise.all([
        apiFetch("/api/categories?limit=200"),
        apiFetch("/api/products?limit=200"),
        apiFetch("/api/variants?limit=200"),
      ]);
      const cats  = await readJsonSafe(catRes);
      const prods = await readJsonSafe(prodRes);
      const vars  = await readJsonSafe(varRes);
      if (!catRes.ok)  throw new Error(cats?.error  || "Errore categorie");
      if (!prodRes.ok) throw new Error(prods?.error || "Errore prodotti");
      setCategories(Array.isArray(cats) ? cats : []);
      setProductOptions(Array.isArray(prods) ? prods : []);
      setVariants(Array.isArray(vars) ? vars : []);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoadingBase(false);
    }
  }

  useEffect(() => { loadBase(); }, []);

  /* Suggerimenti categorie */
  useEffect(() => {
    const v = catSearch.trim();
    if (!v) { setCatSuggestions([]); setLoadingCat(false); return; }
    setCatSuggestions([]);   // svuota subito mentre aspetta
    setLoadingCat(true);     // mostra "Ricerca in corso..." immediatamente
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/categories?search=${encodeURIComponent(v)}&limit=8`, { signal: ctrl.signal });
        const data = await readJsonSafe(res);
        setCatSuggestions(Array.isArray(data) ? data : []);
      } catch (e) { if (e.name !== "AbortError") console.error(e); }
      finally { setLoadingCat(false); }
    }, 300);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [catSearch]);

  /* Suggerimenti prodotti */
  useEffect(() => {
    const v = prodSearch.trim();
    if (!v) { setProdSuggestions([]); setLoadingProd(false); return; }
    setProdSuggestions([]);  // svuota subito mentre aspetta
    setLoadingProd(true);    // mostra "Ricerca in corso..." immediatamente
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: v, limit: "10" });
        if (catFilter) params.set("categoryId", catFilter);
        const res = await apiFetch(`/api/products?${params}`, { signal: ctrl.signal });
        const data = await readJsonSafe(res);
        setProdSuggestions(Array.isArray(data) ? data : []);
      } catch (e) { if (e.name !== "AbortError") console.error(e); }
      finally { setLoadingProd(false); }
    }, 300);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [prodSearch, catFilter]);

  /* Suggerimenti varianti */
  useEffect(() => {
    const v = varSearch.trim();
    if (!v) { setVarSuggestions([]); setLoadingVar(false); return; }
    setVarSuggestions([]); setLoadingVar(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/variants?search=${encodeURIComponent(v)}&limit=10`, { signal: ctrl.signal });
        const data = await readJsonSafe(res);
        setVarSuggestions(Array.isArray(data) ? data : []);
      } catch (e) { if (e.name !== "AbortError") console.error(e); }
      finally { setLoadingVar(false); }
    }, 300);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [varSearch]);

  /* ---- VARIANTI ---- */
  function selectVar(v) {
    setSelectedVar(v);
    setEditVarName(v.name || "");
    setVarSearch(v.name || "");
    setVarSuggestions([]);
    setSelectedCat(null);
    setSelectedProd(null);
  }

  function closeVar() {
    setSelectedVar(null);
    setEditVarName("");
    setVarSearch("");
  }

  async function createVar() {
    const name = newVarName.trim();
    if (!name) return;
    const res = await apiFetch("/api/variants", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await readJsonSafe(res);
    if (!res.ok) { alert(data?.error || "Errore"); return; }
    setNewVarName("");
    await loadBase();
    showToast("Variante creata");
  }

  async function saveVar() {
    if (!selectedVar) return;
    const name = editVarName.trim();
    if (!name) return;
    const res = await apiFetch(`/api/variants/${selectedVar.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await readJsonSafe(res);
    if (!res.ok) { alert(data?.error || "Errore"); return; }
    await loadBase();
    setSelectedVar({ ...selectedVar, name });
    showToast("Variante salvata");
  }

  async function deleteVar() {
    if (!selectedVar || !confirm("Eliminare la variante?")) return;
    const res = await apiFetch(`/api/variants/${selectedVar.id}`, { method: "DELETE" });
    const data = await readJsonSafe(res);
    if (!res.ok) { alert(data?.error || "Errore"); return; }
    await loadBase();
    closeVar();
    showToast("Variante eliminata");
  }

  async function refreshProd(id) {
    const res = await apiFetch("/api/products?limit=200");
    const data = await readJsonSafe(res);
    if (!Array.isArray(data)) return;
    const p = data.find(x => String(x.id) === String(id));
    if (p) {
      setSelectedProd(p);
      setEditProd({ name: p.name || "", categoryId: p.categoryId == null ? "" : String(p.categoryId) });
    }
  }

  /* ---- CATEGORIE ---- */

  function selectCat(cat) {
    setSelectedCat(cat);
    setEditCatName(cat.name || "");
    setCatSearch(cat.name || "");
    setCatSuggestions([]);
    // chiudi eventuale editor prodotto
    setSelectedProd(null);
  }

  function closeCat() {
    setSelectedCat(null);
    setEditCatName("");
    setCatSearch("");
  }

  async function createCat() {
    const name = newCatName.trim();
    if (!name) return;
    const res = await apiFetch("/api/categories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await readJsonSafe(res);
    if (!res.ok) { alert(data?.error || "Errore"); return; }
    setNewCatName("");
    await loadBase();
    showToast("OK Categoria creata");
  }

  async function saveCat() {
    if (!selectedCat) return;
    const name = editCatName.trim();
    if (!name) return;
    const res = await apiFetch(`/api/categories/${selectedCat.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await readJsonSafe(res);
    if (!res.ok) { alert(data?.error || "Errore"); return; }
    await loadBase();
    setSelectedCat({ ...selectedCat, name });
    showToast("OK Categoria salvata");
  }

  async function deleteCat() {
    if (!selectedCat || !confirm("Eliminare la categoria? I prodotti resteranno senza categoria.")) return;
    const res = await apiFetch(`/api/categories/${selectedCat.id}`, { method: "DELETE" });
    const data = await readJsonSafe(res);
    if (!res.ok) { alert(data?.error || "Errore"); return; }
    if (String(catFilter) === String(selectedCat.id)) setCatFilter("");
    await loadBase();
    closeCat();
    showToast("Categoria eliminata");
  }

  /* ---- PRODOTTI ---- */

  function selectProd(prod) {
    setSelectedProd(prod);
    setEditProd({ name: prod.name || "", categoryId: prod.categoryId == null ? "" : String(prod.categoryId) });
    setProdSearch(prod.name || "");
    setProdSuggestions([]);
    setNewSubName("");
    // chiudi eventuale editor categoria
    setSelectedCat(null);
  }

  function closeProd() {
    setSelectedProd(null);
    setEditProd({ name: "", categoryId: "" });
    setProdSearch("");
    setNewSubName("");
  }

  async function createProd() {
    const name = newProdName.trim();
    if (!name) return;
    const res = await apiFetch("/api/products", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, categoryId: newProdCatId || null }),
    });
    const data = await readJsonSafe(res);
    if (!res.ok) { alert(data?.error || "Errore"); return; }
    setNewProdName("");
    setNewProdCatId("");
    await loadBase();
    showToast("OK Prodotto creato");
  }

  async function saveProd() {
    if (!selectedProd) return;
    const name = editProd.name.trim();
    if (!name) return;
    const res = await apiFetch(`/api/products/${selectedProd.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, categoryId: editProd.categoryId || null }),
    });
    const data = await readJsonSafe(res);
    if (!res.ok) { alert(data?.error || "Errore"); return; }
    await loadBase();
    await refreshProd(selectedProd.id);
    showToast("OK Prodotto salvato");
  }

  async function deleteProd() {
    if (!selectedProd || !confirm("Eliminare il prodotto e i suoi sottoprodotti?")) return;
    const res = await apiFetch(`/api/products/${selectedProd.id}`, { method: "DELETE" });
    const data = await readJsonSafe(res);
    if (!res.ok) { alert(data?.error || "Errore"); return; }
    await loadBase();
    closeProd();
    showToast("Prodotto eliminato");
  }

  async function createSub() {
    if (!selectedProd) return;
    const name = newSubName.trim();
    if (!name) return;
    const res = await apiFetch(`/api/products/${selectedProd.id}/sub-products`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await readJsonSafe(res);
    if (!res.ok) { alert(data?.error || "Errore"); return; }
    setNewSubName("");
    await loadBase();
    await refreshProd(selectedProd.id);
    showToast("OK Sottoprodotto aggiunto");
  }

  async function deleteSub(subId) {
    if (!confirm("Eliminare il sottoprodotto?")) return;
    const res = await apiFetch(`/api/sub-products/${subId}`, { method: "DELETE" });
    const data = await readJsonSafe(res);
    if (!res.ok) { alert(data?.error || "Errore"); return; }
    await loadBase();
    if (selectedProd) await refreshProd(selectedProd.id);
    showToast("Sottoprodotto eliminato");
  }

  const showEditor = !!(selectedCat || selectedProd || selectedVar);
  const prodFiltered = productOptions.filter(p => !catFilter || String(p.categoryId) === String(catFilter));

  return (
    <div style={{ display: "grid", gap: "var(--gap-xl)" }}>

      {/* TOAST */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 999,
          background: "var(--ink)", color: "#fff",
          padding: "13px 24px",
          borderRadius: "var(--r-md)",
          fontFamily: "var(--font-ui)",
          fontWeight: 600, fontSize: "0.92rem",
          boxShadow: "var(--shadow-lg)",
          animation: "fadeInUp 0.22s ease",
        }}>
          {toast}
        </div>
      )}

      {/* HEADER PAGINA */}
      <div>
        <h1 style={{ margin: 0 }}>Prodotti</h1>
        <p style={{ marginTop: 8, color: "var(--ink-3)" }}>
          {loadingBase
            ? "Caricamento..."
            : (categories.length + " categorie \u00b7 " + productOptions.length + " prodotti")}
        </p>
      </div>

      {/* CREAZIONE RAPIDA */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)" }}>

        {/* Nuova categoria */}
        <div style={{
          background: "#ecfdf5",
          border: "1.5px solid #a7f3d0",
          borderRadius: "var(--r-xl)",
          padding: "22px 24px",
          boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: "1.5rem" }}>&#x1F3F7;</span>
            <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#065f46" }}>Nuova categoria</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Nome categoria..."
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createCat()}
              style={{ flex: 1, borderColor: "#a7f3d0" }}
            />
            <button
              onClick={createCat}
              disabled={!newCatName.trim()}
              style={{
                flexShrink: 0,
                background: "#059669", color: "#fff",
                border: "none", borderRadius: "var(--r-sm)",
                padding: "0 20px", fontWeight: 700,
                minHeight: "var(--touch)", fontSize: "0.9rem",
                boxShadow: "0 4px 12px rgba(5,150,105,0.25)",
              }}
            >
              Crea
            </button>
          </div>
        </div>

        {/* Nuovo prodotto */}
        <div style={{
          background: "#eff4ff",
          border: "1.5px solid #bfdbfe",
          borderRadius: "var(--r-xl)",
          padding: "22px 24px",
          boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: "1.5rem" }}>&#x1F382;</span>
            <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#1e40af" }}>Nuovo prodotto</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Nome prodotto..."
              value={newProdName}
              onChange={e => setNewProdName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createProd()}
              style={{ flex: 1, borderColor: "#bfdbfe" }}
            />
            <select
              value={newProdCatId}
              onChange={e => setNewProdCatId(e.target.value)}
              style={{ width: 150, flexShrink: 0, borderColor: "#bfdbfe" }}
            >
              <option value="">Senza cat.</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button
              onClick={createProd}
              disabled={!newProdName.trim()}
              style={{
                flexShrink: 0,
                background: "var(--accent)", color: "#fff",
                border: "none", borderRadius: "var(--r-sm)",
                padding: "0 20px", fontWeight: 700,
                minHeight: "var(--touch)", fontSize: "0.9rem",
                boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
              }}
            >
              Crea
            </button>
          </div>
        </div>
      </div>

      {/* Nuova variante */}
      <div style={{
        background: "#fffbeb",
        border: "1.5px solid #fde68a",
        borderRadius: "var(--r-xl)",
        padding: "22px 24px",
        boxShadow: "var(--shadow-sm)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: "1.5rem" }}>&#x1F4DD;</span>
          <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#92400e" }}>Nuova variante</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Es. Pan di Spagna, Pasta Sfoglia..."
            value={newVarName}
            onChange={e => setNewVarName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createVar()}
            style={{ flex: 1, borderColor: "#fde68a" }}
          />
          <button
            onClick={createVar}
            disabled={!newVarName.trim()}
            style={{
              flexShrink: 0,
              background: "#d97706", color: "#fff",
              border: "none", borderRadius: "var(--r-sm)",
              padding: "0 20px", fontWeight: 700,
              minHeight: "var(--touch)", fontSize: "0.9rem",
              boxShadow: "0 4px 12px rgba(217,119,6,0.25)",
            }}
          >
            Crea
          </button>
        </div>
      </div>

      {/* LAYOUT 3 COLONNE */}
      <div style={{
        display: "grid",
        gridTemplateColumns: showEditor ? "1fr 1fr 1fr 360px" : "1fr 1fr 1fr",
        gap: "var(--gap)",
        alignItems: "start",
      }}>

        {/* ---- CATEGORIE ---- */}
        <div style={{
          background: "var(--surface)",
          border: "1.5px solid var(--border)",
          borderRadius: "var(--r-xl)",
          boxShadow: "var(--shadow-sm)",
        }}>
          {/* Header sezione */}
          <div style={{
            padding: "18px 22px",
            borderBottom: "1.5px solid var(--border)",
            background: "var(--surface-2)",
            borderRadius: "var(--r-xl) var(--r-xl) 0 0",
          }}>
            <SectionHeader
              icon="&#x1F3F7;"
              title="Categorie"
              count={categories.length}
              countLabel={categories.length === 1 ? "categoria" : "categorie"}
            />
            <SearchDropdown
              value={catSearch}
              onChange={v => { setCatSearch(v); if (!v) setSelectedCat(null); }}
              suggestions={catSuggestions}
              loading={loadingCat}
              placeholder="Cerca categoria..."
              onSelect={selectCat}
              renderItem={cat => (
                <>
                  <div style={{ fontWeight: 600, color: "var(--ink)" }}>{cat.name}</div>
                  <div style={{ fontSize: "0.76rem", color: "var(--ink-3)", marginTop: 2 }}>
                    {cat.productsCount} {cat.productsCount === 1 ? "prodotto" : "prodotti"}
                  </div>
                </>
              )}
            />
          </div>

        </div>

        {/* ---- PRODOTTI ---- */}
        <div style={{
          background: "var(--surface)",
          border: "1.5px solid var(--border)",
          borderRadius: "var(--r-xl)",
          boxShadow: "var(--shadow-sm)",
        }}>
          {/* Header sezione */}
          <div style={{
            padding: "18px 22px",
            borderBottom: "1.5px solid var(--border)",
            background: "var(--surface-2)",
            borderRadius: "var(--r-xl) var(--r-xl) 0 0",
          }}>
            <SectionHeader
              icon="&#x1F382;"
              title="Prodotti"
              count={prodFiltered.length}
              countLabel={prodFiltered.length === 1 ? "prodotto" : "prodotti"}
            />
            <div style={{ display: "grid", gap: 10 }}>
              <select
                value={catFilter}
                onChange={e => setCatFilter(e.target.value)}
              >
                <option value="">Tutte le categorie</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <SearchDropdown
                value={prodSearch}
                onChange={v => { setProdSearch(v); if (!v) setSelectedProd(null); }}
                suggestions={prodSuggestions}
                loading={loadingProd}
                placeholder="Cerca prodotto..."
                onSelect={selectProd}
                renderItem={prod => (
                  <>
                    <div style={{ fontWeight: 600, color: "var(--ink)" }}>{prod.name}</div>
                    <div style={{ fontSize: "0.76rem", color: "var(--ink-3)", marginTop: 2 }}>
                      {prod.categoryName || prod.category || "Senza categoria"}
                      {prod.subProducts?.length > 0 && (" \u00b7 " + prod.subProducts.length + " sottoprodotti")}
                    </div>
                  </>
                )}
              />
            </div>
          </div>

        </div>

        {/* ---- VARIANTI ---- */}
        <div style={{
          background: "var(--surface)",
          border: "1.5px solid var(--border)",
          borderRadius: "var(--r-xl)",
          boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{
            padding: "18px 22px",
            borderBottom: "1.5px solid var(--border)",
            background: "var(--surface-2)",
            borderRadius: "var(--r-xl) var(--r-xl) 0 0",
          }}>
            <SectionHeader
              icon="&#x1F4DD;"
              title="Varianti"
              count={variants.length}
              countLabel={variants.length === 1 ? "variante" : "varianti"}
            />
            <SearchDropdown
              value={varSearch}
              onChange={v => { setVarSearch(v); if (!v) setSelectedVar(null); }}
              suggestions={varSuggestions}
              loading={loadingVar}
              placeholder="Cerca variante..."
              onSelect={selectVar}
              renderItem={v => (
                <div style={{ fontWeight: 600, color: "var(--ink)" }}>{v.name}</div>
              )}
            />
          </div>
          <div style={{ padding: "12px 16px", maxHeight: 460, overflowY: "auto", display: "grid", gap: 6 }}>
            {loadingBase ? (
              <div className="loading-text" style={{ padding: "20px 0" }}>Caricamento...</div>
            ) : variants.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--ink-muted)", padding: "24px 0", fontSize: "0.9rem" }}>
                Nessuna variante.<br />Creane una sopra.
              </div>
            ) : variants.map(v => (
              <ListItem
                key={v.id}
                label={v.name}
                selected={selectedVar?.id === v.id}
                onClick={() => selectedVar?.id === v.id ? closeVar() : selectVar(v)}
              />
            ))}
          </div>
        </div>

        {/* ---- EDITOR CATEGORIA ---- */}
        {selectedCat && (
          <EditorPanel
            icon="&#x1F3F7;"
            title={selectedCat.name}
            accentColor="#065f46"
            accentLight="#ecfdf5"
            onClose={closeCat}
          >
            <label>
              Nome categoria
              <input
                type="text"
                value={editCatName}
                onChange={e => setEditCatName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveCat()}
              />
            </label>

            <div style={{
              padding: "10px 14px",
              background: "var(--surface-2)",
              borderRadius: "var(--r-sm)",
              border: "1.5px solid var(--border)",
              fontSize: "0.88rem",
              color: "var(--ink-2)",
            }}>
              &#x1F4E6; {selectedCat.productsCount} {selectedCat.productsCount === 1 ? "prodotto associato" : "prodotti associati"}
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <button
                onClick={saveCat}
                style={{
                  background: "#059669", color: "#fff", border: "none",
                  borderRadius: "var(--r-sm)", minHeight: "var(--touch)",
                  fontWeight: 700, fontSize: "0.95rem",
                  boxShadow: "0 4px 12px rgba(5,150,105,0.25)",
                }}
              >
                &#x1F4BE; Salva modifiche
              </button>
              <button className="btn-danger" onClick={deleteCat}>
                &#x1F5D1; Elimina categoria
              </button>
            </div>
          </EditorPanel>
        )}

        {/* ---- EDITOR PRODOTTO ---- */}
        {selectedProd && !selectedCat && (
          <EditorPanel
            icon="&#x1F382;"
            title={selectedProd.name}
            accentColor="var(--accent)"
            accentLight="var(--accent-light)"
            onClose={closeProd}
          >
            <label>
              Nome prodotto
              <input
                type="text"
                value={editProd.name}
                onChange={e => setEditProd(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && saveProd()}
              />
            </label>

            <label>
              Categoria
              <select
                value={editProd.categoryId}
                onChange={e => setEditProd(p => ({ ...p, categoryId: e.target.value }))}
              >
                <option value="">Senza categoria</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>

            <div style={{ display: "grid", gap: 8 }}>
              <button
                onClick={saveProd}
                style={{
                  background: "var(--accent)", color: "#fff", border: "none",
                  borderRadius: "var(--r-sm)", minHeight: "var(--touch)",
                  fontWeight: 700, fontSize: "0.95rem",
                  boxShadow: "0 4px 14px rgba(37,99,235,0.25)",
                }}
              >
                &#x1F4BE; Salva modifiche
              </button>
              <button className="btn-danger" onClick={deleteProd}>
                &#x1F5D1; Elimina prodotto
              </button>
            </div>

            {/* Divisore sottoprodotti */}
            <div style={{
              borderTop: "1.5px solid var(--border)",
              paddingTop: 16,
              display: "grid",
              gap: 12,
            }}>
              <div style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "var(--ink-3)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}>
                Sottoprodotti
              </div>

              {/* Lista sottoprodotti */}
              {Array.isArray(selectedProd.subProducts) && selectedProd.subProducts.length > 0 ? (
                <div style={{ display: "grid", gap: 6 }}>
                  {selectedProd.subProducts.map(sp => (
                    <div key={sp.id} style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "11px 14px",
                      background: "var(--surface-2)",
                      border: "1.5px solid var(--border)",
                      borderRadius: "var(--r-sm)",
                    }}>
                      <span style={{ fontWeight: 500, color: "var(--ink)", fontSize: "0.9rem" }}>
                        {sp.name}
                      </span>
                      <button
                        className="btn-danger btn-sm"
                        onClick={() => deleteSub(sp.id)}
                        style={{ minHeight: 32, padding: "4px 12px", fontSize: "0.8rem" }}
                      >
                        &#x1F5D1;
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  textAlign: "center",
                  color: "var(--ink-muted)",
                  fontSize: "0.85rem",
                  padding: "12px 0",
                  fontStyle: "italic",
                }}>
                  Nessun sottoprodotto
                </div>
              )}

              {/* Aggiunta sottoprodotto */}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Nome sottoprodotto..."
                  value={newSubName}
                  onChange={e => setNewSubName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createSub()}
                  style={{ flex: 1 }}
                />
                <button
                  disabled={!newSubName.trim()}
                  onClick={createSub}
                  style={{
                    flexShrink: 0,
                    background: "var(--accent)", color: "#fff",
                    border: "none", borderRadius: "var(--r-sm)",
                    minHeight: "var(--touch)", padding: "0 16px",
                    fontWeight: 700, fontSize: "1rem",
                  }}
                >
                  +
                </button>
              </div>
            </div>
          </EditorPanel>
        )}

        {/* ---- EDITOR VARIANTE ---- */}
        {selectedVar && !selectedCat && !selectedProd && (
          <EditorPanel
            icon="&#x1F4DD;"
            title={selectedVar.name}
            accentColor="#92400e"
            accentLight="#fffbeb"
            onClose={closeVar}
          >
            <label>
              Nome variante
              <input
                type="text"
                value={editVarName}
                onChange={e => setEditVarName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveVar()}
              />
            </label>
            <div style={{ display: "grid", gap: 8 }}>
              <button
                onClick={saveVar}
                style={{
                  background: "#d97706", color: "#fff",
                  border: "none", borderRadius: "var(--r-sm)",
                  minHeight: "var(--touch)", fontWeight: 700, fontSize: "0.95rem",
                  boxShadow: "0 4px 12px rgba(217,119,6,0.25)",
                }}
              >
                Salva modifiche
              </button>
              <button className="btn-danger" onClick={deleteVar}>
                Elimina variante
              </button>
            </div>
          </EditorPanel>
        )}
      </div>

    </div>
  );
}
