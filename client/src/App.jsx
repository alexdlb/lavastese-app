import { useState } from "react";
import { Routes, Route, Link, useLocation, Navigate, useNavigate } from "react-router-dom";
import { getUser, clearAuth, isLoggedIn } from "./utils/auth.js";
import Home from "./pages/Home.jsx";
import OrdersList from "./pages/OrdersList.jsx";
import NewOrder from "./pages/NewOrder.jsx";
import OrderDetail from "./pages/OrderDetail.jsx";
import Products from "./pages/Products.jsx";
import WeeklyAgenda from "./pages/WeeklyAgenda.jsx";
import Login from "./pages/Login.jsx";
import Users from "./pages/Users.jsx";

/* ================================
   ROUTE PROTETTA
================================ */
function ProtectedRoute({ children, ruoli }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  if (ruoli) {
    const user = getUser();
    if (!user || !ruoli.includes(user.ruolo)) {
      return <Navigate to="/" replace />;
    }
  }
  return children;
}

const NAV_ITEMS = [
  { to: "/nuovo-ordine",       label: "Nuovo ordine", ruoli: ["admin", "operatore"] },
  { to: "/ordini",             label: "Ordini",        ruoli: ["admin", "operatore"] },
  { to: "/prodotti",           label: "Prodotti",      ruoli: ["admin"] },
  { to: "/agenda-settimanale", label: "Agenda",        ruoli: ["admin", "operatore", "produzione"] },
  { to: "/utenti",             label: "Utenti",        ruoli: ["admin"] },
];

const RUOLO_COLOR = {
  admin:      { bg: "#eff4ff", color: "#1e40af", border: "#bfdbfe" },
  operatore:  { bg: "#f0fdf4", color: "#14532d", border: "#86efac" },
  produzione: { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
};

/* ================================
   LAYOUT PRINCIPALE CON HEADER
================================ */
function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const user = getUser();
  const ruoloBadge = RUOLO_COLOR[user?.ruolo] || RUOLO_COLOR.operatore;
  const navVisibili = NAV_ITEMS.filter(item => item.ruoli.includes(user?.ruolo));
  const isAgenda = location.pathname === "/agenda-settimanale";

  function handleLogout() {
    clearAuth();
    setShowUserMenu(false);
    navigate("/login");
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>

      {/* HEADER */}
      <header style={{
        background: "var(--surface)",
        borderBottom: "1.5px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <div style={{
          maxWidth: isAgenda ? "100%" : 1200,
          margin: "0 auto",
          padding: "0 24px",
          height: 68,
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}>

          {/* Logo */}
          <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <img
              src="/uploads/logo/lavastese.png"
              alt="Lavastese logo"
              style={{
                height: 42,
                width: "auto",
                objectFit: "contain",
                borderRadius: 6,
              }}
              onError={e => { e.currentTarget.style.display = "none"; }}
            />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
              <span style={{ fontFamily: "var(--font-title)", fontSize: "1.45rem", color: "var(--ink)", letterSpacing: "-0.01em" }}>
                Lavastese
              </span>
              <span style={{ fontSize: "0.68rem", color: "var(--ink-muted)", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 1 }}>
                Pasticceria
              </span>
            </div>
          </Link>

          {/* Nav filtrata per ruolo */}
          <nav style={{ display: "flex", gap: 4, flex: 1 }}>
            {navVisibili.map(({ to, label }) => {
              const active = location.pathname === to ||
                (to !== "/" && location.pathname.startsWith(to));
              return (
                <Link
                  key={to}
                  to={to}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px 16px",
                    borderRadius: "var(--r-sm)",
                    textDecoration: "none",
                    fontSize: "0.92rem",
                    fontWeight: active ? 600 : 500,
                    color: active ? "var(--accent)" : "var(--ink-2)",
                    background: active ? "var(--accent-light)" : "transparent",
                    transition: "all 0.15s",
                    minHeight: "var(--touch)",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface-2)"; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Utente corrente + dropdown logout */}
          <div style={{ flexShrink: 0, position: "relative" }}>
            <button
              onClick={() => setShowUserMenu(m => !m)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 14px",
                background: "var(--surface-2)",
                border: "1.5px solid var(--border)",
                borderRadius: "var(--r-sm)",
                cursor: "pointer",
                minHeight: 44,
                boxShadow: "none",
              }}
            >
              <div style={{
                width: 30, height: 30,
                borderRadius: "var(--r-sm)",
                background: ruoloBadge.bg,
                border: `1.5px solid ${ruoloBadge.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.75rem", fontWeight: 800,
                color: ruoloBadge.color,
                flexShrink: 0, textTransform: "uppercase",
              }}>
                {user?.username?.slice(0, 2) || "?"}
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>
                  {user?.username || "Utente"}
                </div>
                <div style={{ fontSize: "0.72rem", color: ruoloBadge.color, fontWeight: 600, lineHeight: 1 }}>
                  {user?.ruolo}
                </div>
              </div>
              <span style={{ color: "var(--ink-3)", fontSize: "0.75rem", marginLeft: 2 }}>
                {showUserMenu ? "v" : ">"}
              </span>
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                background: "var(--surface)",
                border: "1.5px solid var(--border)",
                borderRadius: "var(--r-md)",
                boxShadow: "var(--shadow-lg)",
                minWidth: 190,
                overflow: "hidden",
                zIndex: 100,
              }}>
                <div style={{
                  padding: "14px 18px",
                  borderBottom: "1.5px solid var(--border)",
                  background: "var(--surface-2)",
                }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--ink-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    Sessione attiva
                  </div>
                  <div style={{ fontWeight: 700, color: "var(--ink)" }}>{user?.username}</div>
                  <span style={{
                    display: "inline-block", marginTop: 6,
                    padding: "2px 10px", borderRadius: "var(--r-full)",
                    fontSize: "0.72rem", fontWeight: 600,
                    background: ruoloBadge.bg, color: ruoloBadge.color,
                    border: `1px solid ${ruoloBadge.border}`,
                  }}>
                    {user?.ruolo}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    width: "100%", padding: "14px 18px",
                    textAlign: "left", background: "transparent",
                    border: "none", borderRadius: 0,
                    color: "var(--danger)", fontWeight: 600,
                    fontSize: "0.9rem", cursor: "pointer",
                    boxShadow: "none", minHeight: 48,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--danger-light)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  Esci
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Overlay chiudi dropdown */}
      {showUserMenu && (
        <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setShowUserMenu(false)} />
      )}

      {/* MAIN */}
      <main style={{
        flex: 1,
        maxWidth: isAgenda ? "100%" : 1200,
        width: "100%",
        margin: "0 auto",
        padding: "28px 24px",
      }}>
        <Routes>
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/nuovo-ordine" element={<ProtectedRoute ruoli={["admin","operatore"]}><NewOrder /></ProtectedRoute>} />
          <Route path="/ordini" element={<ProtectedRoute ruoli={["admin","operatore"]}><OrdersList /></ProtectedRoute>} />
          <Route path="/ordini/:id" element={<ProtectedRoute ruoli={["admin","operatore"]}><OrderDetail /></ProtectedRoute>} />
          <Route path="/prodotti" element={<ProtectedRoute ruoli={["admin"]}><Products /></ProtectedRoute>} />
          <Route path="/agenda-settimanale" element={<ProtectedRoute ruoli={["admin","operatore","produzione"]}><WeeklyAgenda /></ProtectedRoute>} />
          <Route path="/utenti" element={<ProtectedRoute ruoli={["admin"]}><Users /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

/* ================================
   APP ROOT
================================ */
export default function App() {
  const location = useLocation();

  if (location.pathname === "/login") {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    );
  }

  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/*" element={<Layout />} />
    </Routes>
  );
}
