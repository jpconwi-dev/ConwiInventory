import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { api, fmtBytes } from "./api";
import { useAuth } from "./auth";
import { Meter } from "./ui";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Sales from "./pages/Sales";
import Storage from "./pages/Storage";

function Shell() {
  const { user, ready, signOut } = useAuth();
  const { pathname } = useLocation();
  const [storage, setStorage] = useState(null);

  useEffect(() => {
    if (user) api("/storage").then(setStorage).catch(() => {});
  }, [user, pathname]);

  if (!ready) return <p className="boot">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">conwi<b>Inventory</b></div>
        <nav className="nav">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/sell">Sell</NavLink>
          <NavLink to="/products">Products</NavLink>
          <NavLink to="/sales">Sales</NavLink>
          <NavLink to="/storage">Storage</NavLink>
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
        <Route path="sell" element={<POS />} />
        <Route path="products" element={<Products />} />
        <Route path="sales" element={<Sales />} />
        <Route path="storage" element={<Storage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
