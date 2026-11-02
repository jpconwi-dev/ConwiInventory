import { useEffect, useState } from "react";
import { api, fmtDate, peso } from "../api";
import { Modal, PeriodTabs } from "../ui";

const SERVICES = [["all", "All"], ["gcash", "GCash"], ["load", "Load"], ["utang", "Utang"]];
const LABEL = { gcash: "GCash", load: "Load", utang: "Utang" };
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const fmtDay = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-PH", { dateStyle: "medium" }) : "-");
const EMPTY = () => ({ service: "gcash", direction: "in", amount: "", fee: "", customer: "", note: "", entry_date: today() });

export default function Estores() {
  const [period, setPeriod] = useState("day");
  const [service, setService] = useState("all");
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api(`/estores?period=${period}&service=${service}`).then(setData).catch((e) => setErr(e.message));
  useEffect(() => { setErr(""); load(); }, [period, service]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await api("/estores", { method: "POST", body: form });
      setForm(null);
      await load();
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }

  async function toggle(entry) {
    setErr("");
    try {
      await api(`/estores/${entry.id}/done`, { method: "POST", body: { done: entry.status !== "done" } });
      await load();
    } catch (ex) { setErr(ex.message); }
  }

  async function remove(entry) {
    if (!confirm(`Delete this ${LABEL[entry.service]} entry of ${peso(entry.amount)}?`)) return;
    try { await api(`/estores/${entry.id}`, { method: "DELETE" }); await load(); } catch (ex) { setErr(ex.message); }
  }

  const t = data?.totals;
  return (
    <>
      <div className="page-head">
        <h1>Estores</h1>
        <div className="head-actions">
          <PeriodTabs value={period} onChange={setPeriod} />
          <button className="btn primary" onClick={() => { setErr(""); setForm(EMPTY()); }}>+ New entry</button>
        </div>
      </div>

      <div className="tabs top-gap-s" role="tablist">
        {SERVICES.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={service === k} className={service === k ? "on" : ""} onClick={() => setService(k)}>{label}</button>
        ))}
      </div>

      {err && !form && <p className="err">{err}</p>}
      {!data ? <p className="muted">Loading…</p> : (
        <>
          <section className="strip">
            <div className="cell"><span>Cash in (received)</span><b>{peso(t.cash_in)}</b></div>
            <div className="cell"><span>Cash out (received)</span><b>{peso(t.cash_out)}</b></div>
            <div className="cell gold"><span>Fees earned</span><b>{peso(t.fees)}</b></div>
            <div className="cell"><span>Pending</span><b>{t.pending}</b><em className="delta">{peso(t.pending_amount)}</em></div>
          </section>

          {data.entries.length === 0 ? <p className="empty">No entries yet. Tap “New entry” to add one.</p> : (
            <div className="scroll flat">
              <table className="table stack">
                <thead><tr><th>Service</th><th>Type</th><th>Who / note</th><th>Date</th><th className="num">Fee</th><th className="num">Amount</th><th>Status</th><th></th></tr></thead>
                <tbody>{data.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="title"><strong>{LABEL[e.service]}</strong>{e.source === "public" && <span className="badge low src">From store form</span>}</td>
                    <td data-label="Type"><span className={`badge ${e.direction === "in" ? "ok" : "low"}`}>{e.direction === "in" ? "Cash in" : "Cash out"}</span></td>
                    <td data-label="Who / note">{[e.customer, e.note].filter(Boolean).join(" · ") || "-"}</td>
                    <td data-label="Date">{fmtDay(e.entry_date)}{e.status === "done" && <span className="muted small"> · received {fmtDate(e.done_at)}</span>}</td>
                    <td className="num gold-text" data-label="Fee">{peso(e.fee)}</td>
                    <td className="num" data-label="Amount"><strong>{peso(e.amount)}</strong></td>
                    <td data-label="Status">{e.status === "done" ? <span className="badge ok">Received</span> : <span className="badge low">Pending</span>}</td>
                    <td className="row-actions">
                      <button className={`btn small ${e.status === "done" ? "" : "primary"}`} onClick={() => toggle(e)}>
                        {e.status === "done" ? "Undo" : "✓ Cash received"}
                      </button>{" "}
                      <button className="btn small danger" onClick={() => remove(e)}>Delete</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <p className="muted small top-gap">Only entries you confirm with “Cash received” are recorded in the totals above. Confirm an entry only after you have physically received the cash. Pending entries stay on the list until then.</p>
        </>
      )}

      {form && (
        <Modal title="New Estores entry" onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <div className="form">
              <label className="field">Service
                <select value={form.service} onChange={(e) => set("service", e.target.value)}>
                  <option value="gcash">GCash</option><option value="load">Load</option><option value="utang">Utang</option>
                </select>
              </label>
              <label className="field">Type
                <select value={form.direction} onChange={(e) => set("direction", e.target.value)}>
                  <option value="in">Cash in</option><option value="out">Cash out</option>
                </select>
              </label>
              <label className="field">Amount
                <input type="number" min="0" step="0.01" inputMode="decimal" required autoFocus value={form.amount} onChange={(e) => set("amount", e.target.value)} />
              </label>
              <label className="field">Fee / commission (optional)
                <input type="number" min="0" step="0.01" inputMode="decimal" value={form.fee} onChange={(e) => set("fee", e.target.value)} />
              </label>
              <label className="field wide-col">Date
                <input type="date" required max={today()} value={form.entry_date} onChange={(e) => set("entry_date", e.target.value)} />
              </label>
              <label className="field wide-col">{form.service === "utang" ? "Name (who owes)" : "Customer (optional)"}
                <input value={form.customer} maxLength={80} required={form.service === "utang"} onChange={(e) => set("customer", e.target.value)} />
              </label>
              <label className="field wide-col">Note (optional)
                <input value={form.note} maxLength={200} onChange={(e) => set("note", e.target.value)} />
              </label>
            </div>
            {err && <p className="err">{err}</p>}
            <div className="actions">
              <button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save as pending"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
