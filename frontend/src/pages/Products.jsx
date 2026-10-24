import { useEffect, useState } from "react";
import { api, peso } from "../api";
import { Modal, StatusBadge } from "../ui";

const normName = (s) => s.toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim();
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
const SORTS = {
  "name-asc": ["Name A to Z", byName],
  "name-desc": ["Name Z to A", (a, b) => byName(b, a)],
  newest: ["Newest first", (a, b) => b.id - a.id],
  "stock-asc": ["Stock: low to high", (a, b) => a.stock - b.stock],
  "stock-desc": ["Stock: high to low", (a, b) => b.stock - a.stock],
  "price-asc": ["Price: low to high", (a, b) => a.price - b.price],
  "price-desc": ["Price: high to low", (a, b) => b.price - a.price],
  "comm-desc": ["Commission: high to low", (a, b) => b.commission - a.commission],
};

const blank = { name: "", category: "", sku: "", real_price: "", commission: "", stock: "", low_stock_at: 5 };

function ProductForm({ initial, rows, onClose, onSaved, onAddStock, onEditExisting }) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const price = (Number(f.real_price) || 0) + (Number(f.commission) || 0);
  const dup = f.name.trim() ? rows.find((r) => r.id !== f.id && normName(r.name) === normName(f.name)) : null;

  async function save(e) {
    e.preventDefault();
    setErr("");
    try {
      if (f.id) await api(`/products/${f.id}`, { method: "PUT", body: f });
      else await api("/products", { method: "POST", body: f });
      onSaved();
    } catch (ex) {
      setErr(ex.message);
    }
  }

  return (
    <Modal title={f.id ? "Edit product" : "Add product"} onClose={onClose}>
      <form onSubmit={save} className="form">
        <label className="field wide-col">Product name<input value={f.name} onChange={set("name")} required autoFocus /></label>
        {dup && (
          <div className="dup wide-col" role="alert">
            <b>"{dup.name}" already exists</b> with {dup.stock} in stock. You don't need to add it again.
            <div className="actions">
              <button type="button" className="btn small" onClick={() => onAddStock(dup)}>Add stock to it</button>
              <button type="button" className="btn small" onClick={() => onEditExisting(dup)}>Edit it</button>
            </div>
          </div>
        )}
        <label className="field">Category<input value={f.category} onChange={set("category")} /></label>
        <label className="field">SKU or barcode (optional)<input value={f.sku || ""} onChange={set("sku")} /></label>
        <label className="field">Real price (what you pay)
          <input type="number" min="0" step="0.01" value={f.real_price} onChange={set("real_price")} required />
        </label>
        <label className="field">Commission per item (what you earn)
          <input type="number" min="0" step="0.01" value={f.commission} onChange={set("commission")} required />
        </label>
        <div className="field wide-col price-box">
          <span>Selling price</span><b>{peso(price)}</b>
        </div>
        {!f.id && <label className="field">Quantity in stock<input type="number" min="0" step="1" value={f.stock} onChange={set("stock")} required /></label>}
        <label className="field">Warn me when stock is at or below<input type="number" min="0" step="1" value={f.low_stock_at} onChange={set("low_stock_at")} /></label>
        {err && <p className="err wide-col">{err}</p>}
        <div className="actions wide-col">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!!dup}>{f.id ? "Save changes" : "Add product"}</button>
        </div>
      </form>
    </Modal>
  );
}

function AdjustStock({ p, onClose, onSaved }) {
  const [change, setChange] = useState("");
  const [err, setErr] = useState("");
  const n = Number(change) || 0;

  async function save(e) {
    e.preventDefault();
    try {
      await api(`/products/${p.id}/stock`, { method: "POST", body: { change: n } });
      onSaved();
    } catch (ex) {
      setErr(ex.message);
    }
  }
  return (
    <Modal title={`Stock: ${p.name}`} onClose={onClose}>
      <form onSubmit={save} className="form one">
        <p className="muted">Now in stock: <b>{p.stock}</b>. Type a positive number to add stock, or a negative number to remove it (for damaged or lost items).</p>
        <label className="field">Add or remove<input type="number" step="1" value={change} onChange={(e) => setChange(e.target.value)} autoFocus required /></label>
        <p>New quantity: <b>{Math.max(0, p.stock + n)}</b></p>
        {err && <p className="err">{err}</p>}
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={n === 0}>Update stock</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Products() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("name-asc");
  const [form, setForm] = useState(null);
  const [adjust, setAdjust] = useState(null);
  const [err, setErr] = useState("");

  const load = () => api("/products").then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const matches = (p) =>
    (filter === "all" || (filter === "in" && p.status !== "out") || p.status === filter) &&
    `${p.name} ${p.category} ${p.sku || ""}`.toLowerCase().includes(q.toLowerCase());
  const shown = rows.filter(matches).sort(SORTS[sort][1]);
  const done = () => { setForm(null); setAdjust(null); load(); };

  async function remove(p) {
    if (!confirm(`Delete "${p.name}"? Past sales keep their records.`)) return;
    try { await api(`/products/${p.id}`, { method: "DELETE" }); load(); } catch (e) { setErr(e.message); }
  }

  return (
    <>
      <div className="page-head">
        <h1>Products</h1>
        <button className="btn primary" onClick={() => setForm(blank)}>Add product</button>
      </div>
      <div className="toolbar">
        <input className="search" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="tabs">
          {[["all", "All"], ["in", "In stock"], ["low", "Low"], ["out", "Out of stock"]].map(([k, l]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <select className="sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort products">
          {Object.entries(SORTS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>
      {err && <p className="err">{err}</p>}
      {rows.length === 0 ? <p className="empty">No products yet. Add your first product with its real price and your commission.</p> : (
        <div className="scroll">
          <table className="table">
            <thead><tr><th>Product</th><th className="num">Real price</th><th className="num">Commission</th><th className="num">Selling price</th><th>Status</th><th /></tr></thead>
            <tbody>{shown.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong><div className="muted small">{[p.category, p.sku].filter(Boolean).join(" · ")}</div></td>
                <td className="num">{peso(p.real_price)}</td>
                <td className="num gold-text">{peso(p.commission)}</td>
                <td className="num">{peso(p.price)}</td>
                <td><StatusBadge p={p} /></td>
                <td className="row-actions">
                  <button className="btn small" onClick={() => setAdjust(p)}>Stock</button>
                  <button className="btn small" onClick={() => setForm({ ...p, real_price: String(p.real_price), commission: String(p.commission) })}>Edit</button>
                  <button className="btn small danger" onClick={() => remove(p)}>Delete</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {form && (
        <ProductForm key={form.id || "new"} initial={form} rows={rows} onClose={() => setForm(null)} onSaved={done}
          onAddStock={(p) => { setForm(null); setAdjust(p); }}
          onEditExisting={(p) => setForm({ ...p, real_price: String(p.real_price), commission: String(p.commission) })} />
      )}
      {adjust && <AdjustStock p={adjust} onClose={() => setAdjust(null)} onSaved={done} />}
    </>
  );
}
