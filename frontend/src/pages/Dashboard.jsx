import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, peso } from "../api";
import { PeriodTabs } from "../ui";

export default function Dashboard() {
  const [period, setPeriod] = useState("week");
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setErr("");
    api(`/reports?period=${period}`).then(setD).catch((e) => setErr(e.message));
  }, [period]);

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>
      {err && <p className="err">{err}</p>}
      {!d ? <p className="muted">Loading…</p> : (
        <>
          <section className="strip">
            <div className="cell"><span>Income</span><b>{peso(d.totals.revenue)}</b></div>
            <div className="cell gold"><span>Commission earned</span><b>{peso(d.totals.commission)}</b></div>
            <div className="cell"><span>Orders</span><b>{d.totals.orders}</b></div>
            <div className="cell"><span>Items sold</span><b>{d.totals.items}</b></div>
          </section>

          <section className="panel">
            <h2>Income, split into capital and commission</h2>
            <p className="muted small">Each bar is what customers paid. The gold part is your commission; the rest covers the real price of the products.</p>
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#d6e0dd" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 12 }} width={56} tickFormatter={(v) => `₱${v}`} />
                  <Tooltip formatter={(v) => peso(v)} />
                  <Legend />
                  <Bar dataKey="capital" name="Capital (real price)" stackId="a" fill="#7fb0b0" />
                  <Bar dataKey="commission" name="Commission" stackId="a" fill="#e3a21a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid2">
            <section className="panel">
              <h2>Best sellers</h2>
              {d.top.length === 0 ? <p className="muted">No sales in this period yet.</p> : (
                <table className="table">
                  <thead><tr><th>Product</th><th className="num">Sold</th><th className="num">Commission</th></tr></thead>
                  <tbody>{d.top.map((t) => (
                    <tr key={t.name}><td>{t.name}</td><td className="num">{t.qty}</td><td className="num">{peso(t.commission)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </section>
            <section className="panel">
              <h2>Needs restocking</h2>
              {d.inventory.alerts.length === 0 ? <p className="muted">Everything is above its alert level.</p> : (
                <table className="table">
                  <tbody>{d.inventory.alerts.map((a) => (
                    <tr key={a.name}><td>{a.name}</td><td className="num">{a.stock === 0 ? <span className="badge out">Out of stock</span> : <span className="badge low">{a.stock} left</span>}</td></tr>
                  ))}</tbody>
                </table>
              )}
              <p className="muted small top-gap">
                Stock on hand cost {peso(d.inventory.stock_cost)}. Selling all of it would earn {peso(d.inventory.stock_commission)} commission.
              </p>
            </section>
          </div>
        </>
      )}
    </>
  );
}
