export const PERIODS = [
  ["day", "Day"],
  ["week", "Week"],
  ["month", "Month"],
  ["half", "Half year"],
  ["year", "Year"],
];

export function PeriodTabs({ value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {PERIODS.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost" onClick={onClose} aria-label="Close">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatusBadge({ p }) {
  if (p.status === "out") return <span className="badge out">Out of stock</span>;
  if (p.status === "low") return <span className="badge low">Low: {p.stock} left</span>;
  return <span className="badge ok">Available: {p.stock}</span>;
}

export function Meter({ used, limit }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const level = pct > 85 ? "hot" : pct > 65 ? "warm" : "";
  return (
    <div className="meter" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <i className={level} style={{ width: `${pct}%` }} />
    </div>
  );
}
