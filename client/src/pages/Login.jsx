import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveAuth } from "../utils/auth.js";

const TASTI = ["1","2","3","4","5","6","7","8","9","C","0","OK"];

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [pin, setPin]           = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  function handleTasto(t) {
    if (t === "C") {
      setPin(p => p.slice(0, -1));
      return;
    }
    if (t === "OK") {
      handleLogin();
      return;
    }
    if (pin.length >= 8) return;
    setPin(p => p + t);
  }

  async function handleLogin() {
    if (!username.trim()) { setError("Inserisci il nome utente"); return; }
    if (pin.length < 4)   { setError("Il PIN deve avere almeno 4 cifre"); return; }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), pin }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Credenziali non valide");
        setPin("");
        return;
      }

      saveAuth(data.token, data.user);
      navigate("/");
    } catch (err) {
      console.error(err);
      setError("Errore di connessione");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1.5px solid var(--border)",
        borderRadius: "var(--r-xl)",
        boxShadow: "var(--shadow-lg)",
        padding: "40px 36px",
        width: "100%",
        maxWidth: 400,
      }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            fontFamily: "var(--font-title)",
            fontSize: "2rem",
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}>
            Lavastese
          </div>
          <div style={{
            fontSize: "0.8rem",
            color: "var(--ink-muted)",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginTop: 4,
          }}>
            Gestionale pasticceria
          </div>
        </div>

        {/* Username */}
        <label style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{
            fontSize: "0.78rem",
            fontWeight: 700,
            color: "var(--ink-3)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}>
            Nome utente
          </span>
          <input
            type="text"
            value={username}
            onChange={e => { setUsername(e.target.value); setError(""); }}
            placeholder="es. mario"
            autoCapitalize="none"
            autoCorrect="off"
            style={{ fontSize: "1.1rem", textAlign: "center", letterSpacing: "0.05em" }}
          />
        </label>

        {/* Display PIN */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: 10,
          marginBottom: 20,
          minHeight: 28,
        }}>
          {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
            <div key={i} style={{
              width: 14, height: 14,
              borderRadius: "50%",
              background: i < pin.length ? "var(--accent)" : "var(--border)",
              transition: "background 0.15s",
              flexShrink: 0,
            }} />
          ))}
        </div>

        {/* Errore */}
        {error && (
          <div style={{
            background: "var(--danger-light)",
            border: "1.5px solid #fca5a5",
            color: "var(--danger)",
            borderRadius: "var(--r-sm)",
            padding: "10px 14px",
            fontSize: "0.88rem",
            fontWeight: 500,
            textAlign: "center",
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Tastiera PIN */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
        }}>
          {TASTI.map(t => {
            const isOk    = t === "OK";
            const isCanc  = t === "C";

            return (
              <button
                key={t}
                onClick={() => handleTasto(t)}
                disabled={loading}
                style={{
                  minHeight: 64,
                  fontSize: isOk || isCanc ? "0.95rem" : "1.4rem",
                  fontWeight: 700,
                  borderRadius: "var(--r-md)",
                  border: "1.5px solid",
                  borderColor: isOk
                    ? "var(--accent)"
                    : isCanc
                    ? "var(--border-strong)"
                    : "var(--border)",
                  background: isOk
                    ? "var(--accent)"
                    : isCanc
                    ? "var(--surface-2)"
                    : "var(--surface)",
                  color: isOk
                    ? "#fff"
                    : isCanc
                    ? "var(--danger)"
                    : "var(--ink)",
                  boxShadow: isOk ? "0 4px 14px rgba(37,99,235,0.25)" : "var(--shadow-sm)",
                  cursor: "pointer",
                  transition: "all 0.12s",
                  fontFamily: "var(--font-ui)",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {loading && isOk ? "..." : t}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
