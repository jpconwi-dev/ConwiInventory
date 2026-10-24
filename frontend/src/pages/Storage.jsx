import { useEffect, useState } from "react";
import { api, fmtBytes, fmtDate } from "../api";
import { Meter } from "../ui";

const TARGETS = {
  stock_movements: { label: "Stock movement log", days: 90, note: "Safe to clear. It only records past restocks and sales for reference." },
  sales: { label: "Old sales history", days: 365, note: "This also removes those sales from your income charts and totals." },
};

export default function Storage() {
  const [s, setS] = useState(null);
  const [target, setTarget] = useState("stock_movements");
  const [days, setDays] = useState(90);
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api("/storage").then(setS).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const pick = (t) => { setTarget(t); setDays(TARGETS[t].days); setPreview(null); setMsg(""); };

  async function run(dry_run) {
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await api("/storage/cleanup", { method: "POST", body: { target, older_than_days: Number(days), dry_run } });
      if (dry_run) setPreview(r.count);
      else { setPreview(null); setMsg(`Deleted ${r.count} records. The meter can take a moment to update.`); load(); }
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  async function confirmDelete() {
    if (confirm(`Permanently delete ${preview} records older than ${days} days? This cannot be undone.`)) run(false);
  }

  if (!s) return <p className="muted">{err || "Loading…"}</p>;
  const pct = s.limit_bytes ? (s.used_bytes / s.limit_bytes) * 100 : 0;

  return (
    <>
      <div className="page-head"><h1>Storage</h1></div>
      {!s.supported ? <p className="empty">Storage size is only available when the backend is connected to Neon (PostgreSQL).</p> : (
        <>
          <section className="panel">
            <h2>{fmtBytes(s.used_bytes)} used of {fmtBytes(s.limit_bytes)}</h2>
            <Meter used={s.used_bytes} limit={s.limit_bytes} />
            <p className={pct > 85 ? "err" : "muted small"}>
              {pct > 85 ? "Almost full. Clear old records below to make room." : `${pct.toFixed(1)}% of your database storage is in use.`}
              {" "}The limit comes from STORAGE_LIMIT_MB on your server, so match it to your Neon plan.
            </p>
          </section>

          <div className="grid2">
            <section className="panel">
              <h2>What is using space</h2>
              <table className="table">
                <thead><tr><th>Table</th><th className="num">Rows</th><th className="num">Size</th></tr></thead>
                <tbody>{s.tables.map((t) => (
                  <tr key={t.name}><td>{t.name}</td><td className="num">{t.rows ?? "-"}</td><td className="num">{fmtBytes(t.bytes)}</td></tr>
                ))}</tbody>
              </table>
              {s.oldest_sale && <p className="muted small top-gap">Your oldest sale is from {fmtDate(s.oldest_sale)}.</p>}
            </section>

            <section className="panel">
              <h2>Free up space</h2>
              <div className="tabs">
                {Object.entries(TARGETS).map(([k, v]) => (
                  <button key={k} className={target === k ? "on" : ""} onClick={() => pick(k)}>{v.label}</button>
                ))}
              </div>
              <p className="muted small top-gap">{TARGETS[target].note}</p>
              <label className="field">Delete records older than (days)
                <input type="number" min="1" value={days} onChange={(e) => { setDays(e.target.value); setPreview(null); }} />
              </label>
              {err && <p className="err">{err}</p>}
              {msg && <p className="ok-text">{msg}</p>}
              {preview === null ? (
                <button className="btn" disabled={busy || !days} onClick={() => run(true)}>Check how many will be deleted</button>
              ) : preview === 0 ? (
                <p className="muted">Nothing is older than {days} days.</p>
              ) : (
                <button className="btn danger" disabled={busy} onClick={confirmDelete}>Delete {preview} records</button>
              )}
              <p className="muted small top-gap">To remove products, use the Delete button on the Products page.</p>
            </section>
          </div>
        </>
      )}
    </>
  );
}
