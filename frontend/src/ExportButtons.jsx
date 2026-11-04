import { useState } from "react";
import { FORMATS, fetchExport } from "./export";

/** Download buttons for a backup of one table (or everything). `days` limits it to records older than N days. */
export default function ExportButtons({ target, days }) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function go(key, fn) {
    setBusy(key); setErr(""); setMsg("");
    try {
      const data = await fetchExport(target, days);
      if (data.datasets.length === 0) { setMsg("There are no records to download for this choice."); return; }
      await fn(data);
      setMsg(`Downloaded ${data.datasets.map((d) => `${d.rows.length} ${d.name.toLowerCase()}`).join(", ")}.`);
    } catch (e) { setErr(e.message || "Could not create the file"); } finally { setBusy(""); }
  }

  return (
    <div>
      <div className="head-actions">
        {FORMATS.map(([key, label, fn]) => (
          <button key={key} className="btn" disabled={!!busy} onClick={() => go(key, fn)}>
            {busy === key ? "Preparing…" : label}
          </button>
        ))}
      </div>
      {err && <p className="err">{err}</p>}
      {msg && <p className="ok-text small">{msg}</p>}
    </div>
  );
}
