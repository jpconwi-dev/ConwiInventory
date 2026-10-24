import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, peso } from "../api";
import { DAYS, buildInsights, hourLabel, pctChange } from "../analysis";
import { PeriodTabs } from "../ui";

function Delta({ now, prev }) {
  const c = pctChange(now, prev);
  if (c === null) return <em className="delta">no earlier data</em>;
  return <em className={`delta ${c >= 0 ? "up" : "down"}`}>{c >= 0 ? "▲" : "▼"} {Math.abs(c)}% vs previous</em>;
}

function MiniChart({ data, xKey, xFormat, interval = 0 }) {
  return (
    <div className="chart short">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#d6e0dd" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} tickFormatter={xFormat} interval={interval} />
          <YAxis tick={{ fontSize: 11 }} width={52} tickFormatter={(v) => `₱${v}`} />
          <Tooltip formatter={(v) => peso(v)} labelFormatter={xFormat} />
          <Bar dataKey="revenue" name="Income" fill="#0e5c63" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Analysis() {
  const [period, setPeriod] = useState("week");
  const [a, setA] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setErr("");
    setA(null);
    api(`/analysis?period=${period}`).then(setA).catch((e) => setErr(e.message));
  }, [period]);

  async function savePdf() {
    setBusy(true);
    setErr("");
    try {
      const { downloadAnalysisPdf } = await import("../pdf");
      await downloadAnalysisPdf(a, period);
    } catch (e) {
      setErr(`Could not create the PDF. ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  const t = a?.totals;
  const avg = (r, o) => (o ? r / o : 0);

  return (
    <>
      <div className="page-head">
        <h1>Analysis</h1>
        <div className="head-actions">
          <PeriodTabs value={period} onChange={setPeriod} />
          <button className="btn primary" disabled={!a || busy} onClick={savePdf}>{busy ? "Preparing PDF…" : "Save as PDF"}</button>
        </div>
      </div>
      {err && <p className="err">{err}</p>}
      {!a ? <p className="muted">{err ? "" : "Crunching the numbers…"}</p> : (
        <>
          <section className="strip">
            <div className="cell"><span>Income</span><b>{peso(t.revenue)}</b><Delta now={t.revenue} prev={a.previous.revenue} /></div>
            <div className="cell gold"><span>Commission</span><b>{peso(t.commission)}</b><Delta now={t.commission} prev={a.previous.commission} /></div>
            <div className="cell"><span>Orders</span><b>{t.orders}</b><Delta now={t.orders} prev={a.previous.orders} /></div>
            <div className="cell"><span>Average order</span><b>{peso(avg(t.revenue, t.orders))}</b><Delta now={avg(t.revenue, t.orders)} prev={avg(a.previous.revenue, a.previous.orders)} /></div>
          </section>

          <section className="panel">
            <h2>Key insights</h2>
            <ul className="insights">{buildInsights(a, peso).map((l) => <li key={l}>{l}</li>)}</ul>
          </section>

          {t.orders > 0 && (
            <>
              <div className="grid2">
                <section className="panel">
                  <h2>Income by day of the week</h2>
                  <MiniChart data={a.weekdays.map((d) => ({ ...d, name: DAYS[d.day].slice(0, 3) }))} xKey="name" />
                </section>
                <section className="panel">
                  <h2>Income by hour</h2>
                  <MiniChart data={a.hours} xKey="hour" xFormat={hourLabel} interval={2} />
                </section>
              </div>

              <div className="grid2 gap-top">
                <section className="panel">
                  <h2>Categories</h2>
                  <div className="xscroll">
                    <table className="table">
                      <thead><tr><th>Category</th><th className="num">Sold</th><th className="num">Commission</th></tr></thead>
                      <tbody>{a.categories.map((c) => (
                        <tr key={c.name}>
                          <td>{c.name}<div className="share" style={{ width: `${a.totals.commission ? (c.commission / a.totals.commission) * 100 : 0}%` }} /></td>
                          <td className="num">{c.qty}</td><td className="num gold-text">{peso(c.commission)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </section>
                <section className="panel">
                  <h2>Payment methods</h2>
                  <table className="table">
                    <thead><tr><th>Method</th><th className="num">Orders</th><th className="num">Income</th></tr></thead>
                    <tbody>{a.payments.map((p) => (
                      <tr key={p.method}><td style={{ textTransform: "capitalize" }}>{p.method}</td><td className="num">{p.orders}</td><td className="num">{peso(p.revenue)}</td></tr>
                    ))}</tbody>
                  </table>
                </section>
              </div>

              <div className="grid2 gap-top">
                <section className="panel">
                  <h2>Biggest commission earners</h2>
                  <table className="table">
                    <thead><tr><th>Product</th><th className="num">Sold</th><th className="num">Commission</th></tr></thead>
                    <tbody>{a.top_commission.map((r) => (
                      <tr key={r.name}><td>{r.name}</td><td className="num">{r.qty}</td><td className="num gold-text">{peso(r.commission)}</td></tr>
                    ))}</tbody>
                  </table>
                </section>
                <section className="panel">
                  <h2>Slow movers</h2>
                  {a.slow.count === 0 ? <p className="muted">Every product in stock sold at least once.</p> : (
                    <>
                      <p className="muted small">{a.slow.count} products had no sales and tie up {peso(a.slow.tied_up)}.</p>
                      <table className="table">
                        <thead><tr><th>Product</th><th className="num">In stock</th><th className="num">Capital</th></tr></thead>
                        <tbody>{a.slow.items.map((r) => (
                          <tr key={r.name}><td>{r.name}</td><td className="num">{r.stock}</td><td className="num">{peso(r.tied_up)}</td></tr>
                        ))}</tbody>
                      </table>
                    </>
                  )}
                </section>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
