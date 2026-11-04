import { useEffect, useState } from "react";
import { api, peso } from "../api";
import { Meter, Modal, PeriodTabs } from "../ui";

const SUGGESTED = ["Stock purchase", "Rent", "Electricity", "Transport", "Supplies", "Other"];
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const fmtDay = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-PH", { dateStyle: "medium" }) : "-");
const EMPTY = () => ({ amount: "", category: "", note: "", expense_date: today() });

export default function Expenses() {
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null); // form.id present = editing
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api(`/expenses?period=${period}`).then(setData).catch((e) => setErr(e.message));
  useEffect(() => { setErr(""); load(); }, [period]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function openEdit(e) {
    setErr("");
    setForm({ id: e.id, amount: e.amount, category: e.category, note: e.note, expense_date: e.expense_date || today() });
  }

  async function save(ev) {
    ev.preventDefault();
    setBusy(true); setErr("");
    try {
      if (form.id) await api(`/expenses/${form.id}`, { method: "PUT", body: form });
      else await api("/expenses", { method: "POST", body: form });
      setForm(null);
      await load();
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }

  async function remove(e) {
    if (!confirm(`Delete this ${peso(e.amount)} expense?`)) return;
    try { await api(`/expenses/${e.id}`, { method: "DELETE" }); await load(); } catch (ex) { setErr(ex.message); }
  }

  return (
    <>
      <div className="page-head">
        <h1>Expenses</h1>
        <div className="head-actions">
          <PeriodTabs value={period} onChange={setPeriod} />
          <button className="btn primary" onClick={() => { setErr(""); setForm(EMPTY()); }}>+ Add expense</button>
        </div>
      </div>

      {err && !form && <p className="err">{err}</p>}
      {!data ? <p className="muted">Loading…</p> : (
        <>
          <section className="strip two">
            <div className="cell gold"><span>Total spent</span><b>{peso(data.total)}</b></div>
            <div className="cell"><span>Entries</span><b>{data.count}</b></div>
          </section>

          {data.categories.length > 0 && (
            <section className="panel">
              <h2>By category</h2>
              {data.categories.map((c) => (
                <div key={c.name} className="top-gap-s">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{c.name}</strong><span>{peso(c.total)}</span>
                  </div>
                  <Meter used={c.total} limit={data.total} />
                </div>
              ))}
            </section>
          )}

          {data.expenses.length === 0 ? <p className="empty">No expenses in this period. Click “Add expense” to record one.</p> : (
            <div className="scroll flat">
              <table className="table stack">
                <thead><tr><th>Category</th><th>Note</th><th>Date</th><th className="num">Amount</th><th></th></tr></thead>
                <tbody>{data.expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="title"><strong>{e.category || "Other"}</strong></td>
                    <td data-label="Note">{e.note || "-"}</td>
                    <td data-label="Date">{fmtDay(e.expense_date)}</td>
                    <td className="num red" data-label="Amount"><strong>{peso(e.amount)}</strong></td>
                    <td className="row-actions">
                      <button className="btn small" onClick={() => openEdit(e)}>Edit</button>{" "}
                      <button className="btn small danger" onClick={() => remove(e)}>Delete</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {data.count > data.expenses.length && <p className="muted small top-gap">Showing the latest {data.expenses.length} entries. Totals above include all of them.</p>}
        </>
      )}

      {form && (
        <Modal title={form.id ? "Edit expense" : "Add expense"} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <div className="form">
              <label className="field">Amount
                <input type="number" min="0" step="0.01" inputMode="decimal" required autoFocus value={form.amount} onChange={(e) => set("amount", e.target.value)} />
              </label>
              <label className="field">Date
                <input type="date" required max={today()} value={form.expense_date} onChange={(e) => set("expense_date", e.target.value)} />
              </label>
              <label className="field wide-col">Category (what was it for?)
                <input value={form.category} maxLength={60} list="expense-cats" onChange={(e) => set("category", e.target.value)} />
                <datalist id="expense-cats">{SUGGESTED.map((s) => <option key={s} value={s} />)}</datalist>
              </label>
              <div className="wide-col tabs">
                {SUGGESTED.map((s) => <button type="button" key={s} onClick={() => set("category", s)}>{s}</button>)}
              </div>
              <label className="field wide-col">Note (optional)
                <input value={form.note} maxLength={200} onChange={(e) => set("note", e.target.value)} />
              </label>
            </div>
            {err && <p className="err">{err}</p>}
            <div className="actions">
              <button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn primary" disabled={busy}>{busy ? "Saving…" : form.id ? "Save changes" : "Save expense"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
