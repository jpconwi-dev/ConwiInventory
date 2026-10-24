import { Fragment, useEffect, useState } from "react";
import { api, fmtDate, peso } from "../api";
import { PeriodTabs } from "../ui";

export default function Sales() {
  const [period, setPeriod] = useState("week");
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setErr("");
    api(`/sales?period=${period}`).then(setData).catch((e) => setErr(e.message));
  }, [period]);

  return (
    <>
      <div className="page-head">
        <h1>Sales</h1>
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>
      {err && <p className="err">{err}</p>}
      {!data ? <p className="muted">Loading…</p> : (
        <>
          <section className="strip three">
            <div className="cell"><span>Income</span><b>{peso(data.totals.revenue)}</b></div>
            <div className="cell gold"><span>Commission</span><b>{peso(data.totals.commission)}</b></div>
            <div className="cell"><span>Orders</span><b>{data.totals.orders}</b></div>
          </section>
          {data.sales.length === 0 ? <p className="empty">No sales in this period.</p> : (
            <div className="scroll flat">
              <table className="table stack">
                <thead><tr><th>Receipt</th><th>When</th><th>Payment</th><th className="num">Commission</th><th className="num">Total</th></tr></thead>
                <tbody>{data.sales.map((s) => (
                  <Fragment key={s.id}>
                    <tr className="click" onClick={() => setOpen(open === s.id ? null : s.id)}>
                      <td className="title"><strong>{s.receipt_no}</strong></td>
                      <td data-label="When">{fmtDate(s.created_at)}</td>
                      <td data-label="Payment">{s.payment_method}</td>
                      <td className="num gold-text" data-label="Commission">{peso(s.commission_total)}</td>
                      <td className="num" data-label="Total">{peso(s.total)}</td>
                    </tr>
                    {open === s.id && (
                      <tr className="detail"><td colSpan="5">
                        {s.items.map((i) => <div key={i.name}>{i.qty} × {i.name} <span className="muted">at {peso(i.unit_price)}</span> = {peso(i.subtotal)}</div>)}
                      </td></tr>
                    )}
                  </Fragment>
                ))}</tbody>
              </table>
            </div>
          )}
          {data.totals.orders > data.sales.length && <p className="muted small">Showing the latest {data.sales.length} orders. Totals above include all of them.</p>}
        </>
      )}
    </>
  );
}
