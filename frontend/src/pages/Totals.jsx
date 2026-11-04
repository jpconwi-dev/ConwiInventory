import { useEffect, useState } from "react";
import { api, peso } from "../api";
import { PeriodTabs } from "../ui";

function Rows({ rows }) {
  return (
    <table className="table">
      <tbody>{rows.map(([label, value, cls]) => (
        <tr key={label}><td>{label}</td><td className={`num ${cls || ""}`}><strong>{value}</strong></td></tr>
      ))}</tbody>
    </table>
  );
}

export default function Totals() {
  const [period, setPeriod] = useState("month");
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setErr("");
    api(`/totals?period=${period}`).then(setD).catch((e) => setErr(e.message));
  }, [period]);

  return (
    <>
      <div className="page-head">
        <h1>Income totals</h1>
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>
      {err && <p className="err">{err}</p>}
      {!d ? <p className="muted">Loading…</p> : (
        <>
          <section className="strip">
            <div className="cell gold"><span>Total earnings</span><b>{peso(d.total_earnings)}</b></div>
            <div className="cell"><span>Expenses</span><b>{peso(d.expenses)}</b></div>
            <div className="cell"><span>Net (earnings − expenses)</span><b className={d.net < 0 ? "red" : "ok-text"}>{peso(d.net)}</b></div>
            <div className="cell"><span>Utang not yet paid</span><b>{peso(d.utang.unpaid)}</b><em className="delta">{d.utang.unpaid_count} unpaid</em></div>
          </section>

          <div className="grid2">
            <section className="panel">
              <h2>Products (sales)</h2>
              <Rows rows={[["Orders", d.products.orders], ["Sales amount", peso(d.products.sales)], ["Commission earned", peso(d.products.earnings), "gold-text"]]} />
            </section>
            <section className="panel">
              <h2>GCash</h2>
              <Rows rows={[["Confirmed entries", d.gcash.count], ["Cash in", peso(d.gcash.cash_in)], ["Cash out", peso(d.gcash.cash_out)], ["Fees earned", peso(d.gcash.earnings), "gold-text"]]} />
            </section>
          </div>
          <div className="grid2 top-gap">
            <section className="panel">
              <h2>Load</h2>
              <Rows rows={[["Confirmed entries", d.load.count], ["Load amount", peso(d.load.amount)], ["Fees earned", peso(d.load.earnings), "gold-text"]]} />
            </section>
            <section className="panel">
              <h2>Utang</h2>
              <Rows rows={[["Paid back this period", peso(d.utang.paid), "ok-text"], ["Entries paid", d.utang.paid_count], ["Still unpaid (all time)", peso(d.utang.unpaid), "red"]]} />
            </section>
          </div>
          <p className="muted small top-gap">Total earnings = product commission + GCash fees + load fees. Utang is money you lent, so it is not counted as earnings; it is shown as paid back or still unpaid. Only GCash, load and utang entries you confirmed (cash received) are counted.</p>
        </>
      )}
    </>
  );
}
