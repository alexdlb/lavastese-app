import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

function moneyEuroToCents(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function centsToEuroString(cents) {
  if (cents === null || cents === undefined) return "";
  return (Number(cents) / 100).toFixed(2);
}

export default function ProductManage() {
  const { id } = useParams();
  const isNew = id === "nuovo";
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [product, setProduct] = useState({
    id: "",
    name: "",
    category: "",
    status: "active",
    measure: { allowPersons: true, allowWeight: true },
    subProducts: []
  });

  const [newSub, setNewSub] = useState({ name: "", sku: "", priceEuro: "", isDefault: false, notes: "" });

  async function load() {
    setError("");
    setLoading(true);
    try {
      if (isNew) {
        setProduct({
          id: "",
          name: "",
          category: "",
          status: "active",
          measure: { allowPersons: true, allowWeight: true },
          subProducts: []
        });
        return;
      }
      const res = await fetch("/api/products");
      const data = await res.json();
      const p = (Array.isArray(data) ? data : []).find(x => x.id === id);
      if (!p) {
        setError("Prodotto non trovato");
        return;
      }
      setProduct(p);
    } catch {
      setError("Errore caricamento prodotto");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const subsSorted = useMemo(() => {
    const subs = Array.isArray(product.subProducts) ? product.subProducts : [];
    return subs.slice().sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault) || (a.name || "").localeCompare(b.name || ""));
  }, [product.subProducts]);

  async function saveProduct() {
    setError("");
    if (!product.name.trim()) return setError("Nome obbligatorio");
    setSaving(true);
    try {
      const payload = {
        name: product.name,
        category: product.category,
        status: product.status,
        measure: product.measure
      };
      const res = await fetch(isNew ? "/api/products" : `/api/products/${id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Errore salvataggio");
        return;
      }
      if (isNew) {
        navigate(`/prodotti/${data.id}`);
      } else {
        await load();
        alert("Prodotto salvato!");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct() {
    if (isNew) return;
    if (!confirm("Eliminare il prodotto? Verranno eliminati anche i sottoprodotti.")) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Errore eliminazione");
        return;
      }
      navigate("/prodotti");
    } finally {
      setSaving(false);
    }
  }

  async function addSubProduct() {
    setError("");
    if (isNew) return setError("Salva prima il prodotto.");
    if (!newSub.name.trim()) return setError("Nome sottoprodotto obbligatorio");

    const payload = {
      name: newSub.name,
      sku: newSub.sku,
      priceCents: moneyEuroToCents(newSub.priceEuro),
      isDefault: !!newSub.isDefault,
      notes: newSub.notes
    };

    setSaving(true);
    try {
      const res = await fetch(`/api/products/${id}/sub-products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Errore creazione sottoprodotto");
        return;
      }
      setNewSub({ name: "", sku: "", priceEuro: "", isDefault: false, notes: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function setDefaultSub(sp) {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/sub-products/${sp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Errore update sottoprodotto");
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteSub(sp) {
    if (!confirm("Eliminare sottoprodotto?")) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/sub-products/${sp.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Errore eliminazione sottoprodotto");
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div>Caricamento…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>{isNew ? "Nuovo prodotto" : "Gestisci prodotto"}</h2>
        <button onClick={() => navigate(-1)} style={{ marginLeft: "auto" }}>Indietro</button>
      </div>

      {error && (
        <div style={{ background: "#ffe9e9", border: "1px solid #ffb3b3", padding: 10, borderRadius: 8, marginTop: 12 }}>
          {error}
        </div>
      )}

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Dati prodotto</h3>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr 1fr" }}>
          <label>
            Nome*
            <input value={product.name} onChange={e => setProduct({ ...product, name: e.target.value })} style={{ width: "100%" }} />
          </label>

          <label>
            Categoria
            <input value={product.category || ""} onChange={e => setProduct({ ...product, category: e.target.value })} style={{ width: "100%" }} />
          </label>

          <label>
            Stato
            <select value={product.status || "active"} onChange={e => setProduct({ ...product, status: e.target.value })} style={{ width: "100%" }}>
              <option value="active">Attivo</option>
              <option value="archived">Archiviato</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={!!product.measure?.allowPersons}
              onChange={e => setProduct({ ...product, measure: { ...product.measure, allowPersons: e.target.checked } })}
            />
            Consenti “Persone”
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={!!product.measure?.allowWeight}
              onChange={e => setProduct({ ...product, measure: { ...product.measure, allowWeight: e.target.checked } })}
            />
            Consenti “Kg”
          </label>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <button onClick={saveProduct} disabled={saving}>{saving ? "Salvataggio…" : "Salva"}</button>
          {!isNew && (
            <button onClick={deleteProduct} disabled={saving} style={{ marginLeft: "auto" }}>
              Elimina
            </button>
          )}
        </div>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Sottoprodotti (varianti / pezzature)</h3>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
          <label>
            Nome*
            <input value={newSub.name} onChange={e => setNewSub({ ...newSub, name: e.target.value })} style={{ width: "100%" }} />
          </label>
          <label>
            SKU
            <input value={newSub.sku} onChange={e => setNewSub({ ...newSub, sku: e.target.value })} style={{ width: "100%" }} />
          </label>
          <label>
            Prezzo (opz., €)
            <input value={newSub.priceEuro} onChange={e => setNewSub({ ...newSub, priceEuro: e.target.value })} style={{ width: "100%" }} />
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 20 }}>
            <input type="checkbox" checked={newSub.isDefault} onChange={e => setNewSub({ ...newSub, isDefault: e.target.checked })} />
            Default
          </label>
        </div>

        <label style={{ display: "block", marginTop: 10 }}>
          Note
          <input value={newSub.notes} onChange={e => setNewSub({ ...newSub, notes: e.target.value })} style={{ width: "100%" }} />
        </label>

        <div style={{ marginTop: 10 }}>
          <button onClick={addSubProduct} disabled={saving || isNew}>+ Aggiungi sottoprodotto</button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {subsSorted.length === 0 ? (
            <div style={{ opacity: 0.75 }}>Nessun sottoprodotto.</div>
          ) : (
            subsSorted.map(sp => (
              <div key={sp.id} style={{ border: "1px dashed #ccc", borderRadius: 8, padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{sp.name} {sp.isDefault ? "• Default" : ""}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {sp.sku ? `SKU: ${sp.sku} • ` : ""}
                    Prezzo: {sp.priceCents == null ? "—" : `${centsToEuroString(sp.priceCents)} €`}
                  </div>
                </div>
                <button onClick={() => setDefaultSub(sp)} disabled={!!sp.isDefault || saving}>Default</button>
                <button onClick={() => deleteSub(sp)} disabled={saving}>Elimina</button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
