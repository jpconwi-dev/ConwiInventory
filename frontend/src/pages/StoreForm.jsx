import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, peso } from "../api";

const KEY = "estore_tokens";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }); // YYYY-MM-DD
const fmtDay = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-PH", { dateStyle: "medium" }) : "-");
const readTokens = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const blank = () => ({ service: "gcash", direction: "in", amount: "", customer: "", note: "", entry_date: today(), pin: "" });

export default function StoreForm() {
  const [f, setF] = useState(blank);
  const [pinNeeded, setPinNeeded] = useState(false);
  const [mine, setMine] = useState([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const refresh = () => {
    const tokens = readTokens();
    if (!tokens.length) return setMine([]);
    api("/public/estores/status", { method: "POST", body: { tokens } }).then(setMine).catch(() => {});
  };
  useEffect(() => {
    api("/public/estores/config").then((c) => setPinNeeded(c.pin_required)).catch(() => {});
    refresh();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(""); setOk("");
    try {
      const r = await api("/public/estores", { method: "POST", body: f });
      localStorage.setItem(KEY, JSON.stringify([r.token, ...readTokens()].slice(0, 50)));
      setOk(`Saved: ${peso(r.amount)}. Waiting for the owner to confirm the cash.`);
      setF((x) => ({ ...blank(), pin: x.pin }));
      refresh();
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }

  return (
    <div className="store">
      <form onSubmit={submit} className="login-card store-card">
        <img src="/logo-mark.svg" alt="" width="52" height="52" />
        <h1>Estores</h1>
        <p className="muted">Add a GCash, load or utang entry. The owner confirms it once the cash is received.</p>

        <div className="tabs" role="tablist">
          <button type="button" className={f.service === "gcash" ? "on" : ""} onClick={() => set("service", "gcash")}>GCash</button>
          <button type="button" className={f.service === "load" ? "on" : ""} onClick={() => set("service", "load")}>Load</button>
          <button type="button" className={f.service === "utang" ? "on" : ""} onClick={() => set("service", "utang")}>Utang</button>
        </div>

        {f.service === "gcash" && (
          <div className="tabs top-gap" role="tablist">
            <button type="button" className={f.direction === "in" ? "on" : ""} onClick={() => set("direction", "in")}>Cash in</button>
            <button type="button" className={f.direction === "out" ? "on" : ""} onClick={() => set("direction", "out")}>Cash out</button>
          </div>
        )}

        <label className="field">Amount
          <input type="number" min="1" step="0.01" inputMode="decimal" required value={f.amount} onChange={(e) => set("amount", e.target.value)} />
        </label>
        <label className="field">Date
          <input type="date" required max={today()} value={f.entry_date} onChange={(e) => set("entry_date", e.target.value)} />
        </label>
        <label className="field">{f.service === "load" ? "Number to load" : f.service === "utang" ? "Name (who owes)" : "Customer name (optional)"}
          <input value={f.customer} maxLength={80} required={f.service === "utang"} onChange={(e) => set("customer", e.target.value)} />
        </label>
        <label className="field">Note (optional)
          <input value={f.note} maxLength={200} onChange={(e) => set("note", e.target.value)} />
        </label>
        {pinNeeded && (
          <label className="field">PIN
            <input type="password" inputMode="numeric" required value={f.pin} onChange={(e) => set("pin", e.target.value)} />
          </label>
        )}
        {err && <p className="err">{err}</p>}
        {ok && <p className="ok-text">{ok}</p>}
        <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Submit"}</button>
        <Link to="/login" className="store-link">Owner log in</Link>
      </form>

      {mine.length > 0 && (
        <section className="login-card store-card store-list">
          <h2>Your entries</h2>
          {mine.map((e) => (
            <div key={e.token} className="store-row">
              <div>
                <strong>{e.service === "load" ? "Load" : e.service === "utang" ? "Utang" : e.direction === "in" ? "GCash cash in" : "GCash cash out"}</strong>
                <span className="muted small">{fmtDay(e.entry_date)}{e.customer ? ` · ${e.customer}` : ""}</span>
              </div>
              <div className="store-amt">
                <b>{peso(e.amount)}</b>
                <span className={`badge ${e.status === "done" ? "ok" : "low"}`}>{e.status === "done" ? (e.service === "utang" ? "Paid" : "Confirmed") : (e.service === "utang" ? "Unpaid" : "Pending")}</span>
              </div>
            </div>
          ))}
          <button type="button" className="btn small" onClick={refresh}>Refresh status</button>
        </section>
      )}
    </div>
  );
}
