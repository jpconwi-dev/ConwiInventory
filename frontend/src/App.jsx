import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { api, fmtBytes } from "./api";
import { useAuth } from "./auth";
import { Meter } from "./ui";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Analysis from "./pages/Analysis";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Sales from "./pages/Sales";
import Storage from "./pages/Storage";

const Icon = ({ children }) => (
  <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">{children}</svg>
);
const NAV = [
  ["/", "Dashboard", <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>],
  ["/analysis", "Analysis", <><path d="M3 20h18" /><rect x="5" y="11" width="3" height="9" /><rect x="10.5" y="5" width="3" height="15" /><rect x="16" y="14" width="3" height="6" /></>],
  ["/sell", "Sell", <><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /><path d="M2 3h3l2.7 11.4a1 1 0 0 0 1 .6h9.7a1 1 0 0 0 1-.8L21 7H6" /></>],
  ["/products", "Products", <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>],
  ["/sales", "Sales", <><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" /><path d="M9 8h6M9 12h6" /></>],
  ["/storage", "Storage", <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>],
];

function Shell() {
  const { user, ready, signOut } = useAuth();
  const { pathname } = useLocation();
  const [storage, setStorage] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user) api("/storage").then(setStorage).catch(() => {});
  }, [user, pathname]);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("no-scroll", open);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
    };
  }, [open]);

  if (!ready) return <p className="boot">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="shell">
      <header className="topbar">
        <button className="menu-btn" aria-label="Open menu" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen(true)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <img src="/logo-mark.svg" alt="" width="28" height="28" />
        <span className="top-title">conwi<b>Inventory</b></span>
      </header>

      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <aside id="sidebar" className={`side ${open ? "open" : ""}`}>
        <div className="side-head">
          <div className="brand"><img src="/logo-mark.svg" alt="" width="32" height="32" />conwi<b>Inventory</b></div>
          <button className="close-btn" aria-label="Close menu" onClick={() => setOpen(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <nav className="nav">
          {NAV.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === "/"}><Icon>{icon}</Icon>{label}</NavLink>
          ))}
        </nav>
        <div className="side-foot">
          {storage?.supported && (
            <NavLink to="/storage" className="mini-storage">
              <span>Database {fmtBytes(storage.used_bytes)} of {fmtBytes(storage.limit_bytes)}</span>
              <Meter used={storage.used_bytes} limit={storage.limit_bytes} />
            </NavLink>
          )}
          <button className="linklike" onClick={signOut}>Log out ({user.username})</button>
        </div>
      </aside>

      <main className="main"><Outlet /></main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="analysis" element={<Analysis />} />
        <Route path="sell" element={<POS />} />
        <Route path="products" element={<Products />} />
        <Route path="sales" element={<Sales />} />
        <Route path="storage" element={<Storage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
