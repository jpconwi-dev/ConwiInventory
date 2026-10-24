import { useEffect, useMemo, useState } from "react";
import { api, fmtDate, peso } from "../api";
import { Modal } from "../ui";

export default function POS() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState({});
  const [method, setMethod] = useState("cash");
  const [paid, setPaid] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const load = () => api("/products").then(setProducts).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId[id], qty })).filter((l) => l.p);
  const total = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const commission = lines.reduce((s, l) => s + l.p.commission * l.qty, 0);
  const paidNum = paid === "" ? total : Number(paid);
  const shown = products.filter((p) => `${p.name} ${p.category} ${p.sku || ""}`.toLowerCase().includes(q.toLowerCase()));

  const setQty = (p, qty) =>
    setCart((c) => {
      const n = { ...c };
      const v = Math.max(0, Math.min(Number(qty) || 0, p.stock));
      if (v === 0) delete n[p.id]; else n[p.id] = v;
      return n;
    });

  async function checkout() {
    setBusy(true);
    setErr("");
    try {
      const r = await api("/sales", {
        method: "POST",
        body: { items: lines.map((l) => ({ product_id: l.p.id, qty: l.qty })), payment_method: method, amount_paid: paidNum },
      });
      setReceipt(r);
      setCart({});
      setPaid("");
      load();
    } catch (e) {
      setErr(e.message);
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head"><h1>Sell</h1></div>
      <div className="pos">
        <section>
          <input className="search" placeholder="Search by name, category or SKU" value={q} onChange={(e) => setQ(e.target.value)} />
          {products.length === 0 ? <p className="muted">No products yet. Add some on the Products page first.</p> : (
            <div className="tiles">
              {shown.map((p) => (
                <button key={p.id} className="tile" disabled={p.stock <= 0} onClick={() => setQty(p, (cart[p.id] || 0) + 1)}>
                  <strong>{p.name}</strong>
                  <span className="price">{peso(p.price)}</span>
                  <span className={`small ${p.status === "out" ? "red" : "muted"}`}>
                    {p.status === "out" ? "Out of stock" : `${p.stock - (cart[p.id] || 0)} available`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="cart">
          <h2>Current sale</h2>
          {lines.length === 0 ? <p className="muted">Tap a product to add it.</p> : (
            <ul>
              {lines.map(({ p, qty }) => (
                <li key={p.id}>
                  <div><strong>{p.name}</strong><span className="muted small">{peso(p.price)} each</span></div>
                  <div className="qty">
                    <button onClick={() => setQty(p, qty - 1)} aria-label={`Remove one ${p.name}`}>−</button>
                    <input value={qty} onChange={(e) => setQty(p, e.target.value)} inputMode="numeric" aria-label={`${p.name} quantity`} />
                    <button onClick={() => setQty(p, qty + 1)} disabled={qty >= p.stock} aria-label={`Add one ${p.name}`}>+</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="sum"><span>Total</span><b>{peso(total)}</b></div>
          <div className="sum gold-text"><span>Your commission</span><b>{peso(commission)}</b></div>
          <label className="field">Payment
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Cash</option><option value="gcash">GCash</option><option value="other">Other</option>
            </select>
          </label>
          <label className="field">Amount received
            <input type="number" min="0" step="0.01" value={paid} placeholder={total ? total.toFixed(2) : "0.00"} onChange={(e) => setPaid(e.target.value)} />
          </label>
          {lines.length > 0 && <div className="sum"><span>Change</span><b>{peso(Math.max(0, paidNum - total))}</b></div>}
          {err && <p className="err">{err}</p>}
          <button className="btn primary wide" disabled={busy || lines.length === 0 || paidNum < total} onClick={checkout}>
            {busy ? "Saving…" : "Complete sale"}
          </button>
        </aside>
      </div>

      {receipt && (
        <Modal title="Sale complete" onClose={() => setReceipt(null)}>
          <div className="receipt">
            <h3>conwiInventory</h3>
            <p className="muted small">{receipt.receipt_no} · {fmtDate(receipt.created_at)}</p>
            <table className="table">
              <tbody>{receipt.items.map((i) => (
                <tr key={i.name}><td>{i.qty} × {i.name}</td><td className="num">{peso(i.subtotal)}</td></tr>
              ))}</tbody>
            </table>
            <div className="sum"><span>Total</span><b>{peso(receipt.total)}</b></div>
            <div className="sum"><span>Received</span><span>{peso(receipt.amount_paid)}</span></div>
            <div className="sum"><span>Change</span><span>{peso(receipt.change_due)}</span></div>
          </div>
          <div className="actions">
            <button className="btn" onClick={() => window.print()}>Print receipt</button>
            <button className="btn primary" onClick={() => setReceipt(null)}>New sale</button>
          </div>
        </Modal>
      )}
    </>
  );
}
