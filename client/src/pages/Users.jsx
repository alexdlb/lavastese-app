import { useEffect, useState } from "react";
import { apiFetch } from "../utils/auth.js";

const RUOLI = ["admin", "operatore", "produzione"];

const RUOLO_BADGE = {
  admin:      { bg: "#eff4ff", color: "#1e40af", border: "#bfdbfe" },
  operatore:  { bg: "#f0fdf4", color: "#14532d", border: "#86efac" },
  produzione: { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
};

export default function Users() {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  // Form nuovo utente
  const [newUsername, setNewUsername] = useState("");
  const [newPin, setNewPin]           = useState("");
  const [newRuolo, setNewRuolo]       = useState("operatore");
  const [creating, setCreating]       = useState(false);

  // Modifica
  const [editing, setEditing]     = useState(null); // { id, username, ruolo }
  const [editPin, setEditPin]     = useState("");
  const [editRuolo, setEditRuolo] = useState("");
  const [saving, setSaving]       = useState(false);

  const [toast, setToast] = useState("");

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const res  = await apiFetch("/api/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Errore");
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleCreate() {
    if (!newUsername.trim()) { setError("Username obbligatorio"); return; }
    if (newPin.length < 4)   { setError("PIN minimo 4 cifre"); return; }

    setCreating(true);
    setError("");
    try {
      const res  = await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({ username: newUsername.trim(), pin: newPin, ruolo: newRuolo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Errore");
      setNewUsername(""); setNewPin(""); setNewRuolo("operatore");
      await loadUsers();
      showToast("Utente creato");
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  function openEdit(user) {
    setEditing(user);
    setEditPin("");
    setEditRuolo(user.ruolo);
    setError("");
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      const body = {};
      if (editPin.length >= 4) body.pin = editPin;
      if (editRuolo !== editing.ruolo) body.ruolo = editRuolo;

      if (Object.keys(body).length === 0) {
        setEditing(null);
        return;
      }

      const res  = await apiFetch(`/api/users/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Errore");
      setEditing(null);
      await loadUsers();
      showToast("Utente aggiornato");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user) {
    if (!confirm(`Eliminare l'utente "${user.username}"?`)) return;
    try {
      const res  = await apiFetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Errore");
      await loadUsers();
      showToast("Utente eliminato");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--gap-xl)" }}>

      {/* TOAST */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 999,
          background: "var(--ink)", color: "#fff",
          padding: "13px 24px", borderRadius: "var(--r-md)",
          fontWeight: 600, fontSize: "0.92rem",
          boxShadow: "var(--shadow-lg)",
        }}>
          {toast}
        </div>
      )}

      {/* HEADER */}
      <div>
        <h1 style={{ margin: 0 }}>Utenti</h1>
        <p style={{ marginTop: 8, color: "var(--ink-3)" }}>
          Gestione accessi al gestionale
        </p>
      </div>

      {error && (
        <div className="error-box">{error}</div>
      )}

      {/* CREA NUOVO UTENTE */}
      <div style={{
        background: "var(--accent-light)",
        border: "1.5px solid #bfdbfe",
        borderRadius: "var(--r-xl)",
        padding: "24px 28px",
      }}>
        <h2 style={{ margin: "0 0 20px", fontSize: "1.15rem", color: "var(--accent)" }}>
          Nuovo utente
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "var(--gap)", alignItems: "end" }}>
          <label>
            Username
            <input
              type="text"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              placeholder="es. mario"
              autoCapitalize="none"
            />
          </label>
          <label>
            PIN (4-8 cifre)
            <input
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={e => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="es. 1234"
            />
          </label>
          <label>
            Ruolo
            <select value={newRuolo} onChange={e => setNewRuolo(e.target.value)}>
              {RUOLI.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              background: "var(--accent)", color: "#fff",
              border: "none", borderRadius: "var(--r-sm)",
              minHeight: "var(--touch)", padding: "0 24px",
              fontWeight: 700, fontSize: "0.95rem",
              boxShadow: "0 4px 14px rgba(37,99,235,0.25)",
            }}
          >
            {creating ? "..." : "Crea"}
          </button>
        </div>
      </div>

      {/* LISTA UTENTI */}
      <div style={{
        background: "var(--surface)",
        border: "1.5px solid var(--border)",
        borderRadius: "var(--r-xl)",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
      }}>
        <div style={{
          padding: "18px 24px",
          borderBottom: "1.5px solid var(--border)",
          background: "var(--surface-2)",
          fontWeight: 700,
          fontSize: "0.82rem",
          color: "var(--ink-3)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}>
          {users.length} {users.length === 1 ? "utente" : "utenti"}
        </div>

        {loading ? (
          <div className="loading-text">Caricamento...</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--ink-muted)" }}>
            Nessun utente
          </div>
        ) : users.map((user, i) => {
          const badge = RUOLO_BADGE[user.ruolo] || RUOLO_BADGE.operatore;
          const isEditing = editing?.id === user.id;

          return (
            <div key={user.id} style={{
              borderBottom: i < users.length - 1 ? "1.5px solid var(--border)" : "none",
            }}>
              {/* Riga utente */}
              <div style={{
                padding: "16px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: 44, height: 44,
                    borderRadius: "var(--r-sm)",
                    background: badge.bg,
                    border: `1.5px solid ${badge.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.2rem", flexShrink: 0,
                  }}>
                    {user.ruolo === "admin" ? "A" : user.ruolo === "operatore" ? "O" : "P"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--ink)" }}>
                      {user.username}
                    </div>
                    <span style={{
                      display: "inline-block",
                      marginTop: 4,
                      padding: "2px 10px",
                      borderRadius: "var(--r-full)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      background: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                    }}>
                      {user.ruolo}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn-sm"
                    onClick={() => isEditing ? setEditing(null) : openEdit(user)}
                  >
                    {isEditing ? "Chiudi" : "Modifica"}
                  </button>
                  <button
                    className="btn-danger btn-sm"
                    onClick={() => handleDelete(user)}
                  >
                    Elimina
                  </button>
                </div>
              </div>

              {/* Form modifica inline */}
              {isEditing && (
                <div style={{
                  padding: "16px 24px 20px",
                  background: "var(--surface-2)",
                  borderTop: "1.5px solid var(--border)",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr auto",
                  gap: "var(--gap)",
                  alignItems: "end",
                }}>
                  <label>
                    Nuovo PIN (lascia vuoto per non cambiare)
                    <input
                      type="password"
                      inputMode="numeric"
                      value={editPin}
                      onChange={e => setEditPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      placeholder="nuovo PIN..."
                    />
                  </label>
                  <label>
                    Ruolo
                    <select value={editRuolo} onChange={e => setEditRuolo(e.target.value)}>
                      {RUOLI.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      background: "var(--accent)", color: "#fff",
                      border: "none", borderRadius: "var(--r-sm)",
                      minHeight: "var(--touch)", padding: "0 24px",
                      fontWeight: 700,
                    }}
                  >
                    {saving ? "..." : "Salva"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
