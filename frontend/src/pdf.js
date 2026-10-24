import { DAYS, PERIOD_NAMES, buildInsights, pctChange, pdfMoney } from "./analysis";

const TEAL = [14, 92, 99], GOLD = [227, 162, 26], INK = [18, 38, 42], MUTED = [93, 115, 119], CAP = [127, 176, 176];

async function toDataUrl(url) {
  const blob = await (await fetch(url)).blob();
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}
const fmtDay = (s) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-PH", { dateStyle: "medium", timeZone: "UTC" });
const changeText = (now, prev) => {
  const c = pctChange(now, prev);
  return c === null ? "n/a" : `${c > 0 ? "+" : ""}${c}%`;
};

export async function downloadAnalysisPdf(a, period) {
  const [{ jsPDF }, at] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = [at.default, at.autoTable, at.default?.default].find((f) => typeof f === "function");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const t = a.totals, p = a.previous;
  let y = 0;

  // header band
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, W, 82, "F");
  try { doc.addImage(await toDataUrl("/icon-192.png"), "PNG", M, 19, 44, 44); } catch { /* logo is optional */ }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("conwiInventory", M + 56, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text(`Sales analysis: ${PERIOD_NAMES[period]} (${fmtDay(a.range.from)} to ${fmtDay(a.range.to)})`, M + 56, 60);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}`, W - M, 42, { align: "right" });
  y = 112;

  const need = (h) => { if (y + h > H - 50) { doc.addPage(); y = 50; } };
  const heading = (text) => {
    need(60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(text, M, y);
    y += 12;
  };
  const table = (title, head, body, right = []) => {
    if (!body.length) return;
    heading(title);
    autoTable(doc, {
      startY: y, head: [head], body, margin: { left: M, right: M }, theme: "striped",
      styles: { fontSize: 9, cellPadding: 5, textColor: INK },
      headStyles: { fillColor: TEAL, textColor: 255 },
      alternateRowStyles: { fillColor: [244, 248, 247] },
      columnStyles: Object.fromEntries(right.map((i) => [i, { halign: "right" }])),
      didParseCell: (d) => { if (right.includes(d.column.index)) d.cell.styles.halign = "right"; },
    });
    y = doc.lastAutoTable.finalY + 24;
  };

  // summary
  const avg = (r, o) => (o ? r / o : 0);
  table("Summary", ["", "This period", "Previous period", "Change"], [
    ["Income", pdfMoney(t.revenue), pdfMoney(p.revenue), changeText(t.revenue, p.revenue)],
    ["Commission earned", pdfMoney(t.commission), pdfMoney(p.commission), changeText(t.commission, p.commission)],
    ["Orders", t.orders, p.orders, changeText(t.orders, p.orders)],
    ["Average order", pdfMoney(avg(t.revenue, t.orders)), pdfMoney(avg(p.revenue, p.orders)), changeText(avg(t.revenue, t.orders), avg(p.revenue, p.orders))],
  ], [1, 2, 3]);

  // insights
  heading("Key insights");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const line of buildInsights(a, pdfMoney)) {
    const lines = doc.splitTextToSize(line, W - 2 * M - 16);
    need(lines.length * 13 + 8);
    doc.setFillColor(...GOLD);
    doc.circle(M + 3, y - 3, 2.2, "F");
    doc.setTextColor(...INK);
    doc.text(lines, M + 16, y);
    y += lines.length * 13 + 5;
  }
  y += 14;

  // income chart (capital + commission)
  if (t.orders) {
    need(190);
    heading("Income: capital and commission");
    const cx = M, cw = W - 2 * M, ch = 110, top = y + 14;
    const b = a.buckets, max = Math.max(1, ...b.map((k) => k.revenue));
    const gap = 3, bw = Math.max(2, (cw - gap * (b.length - 1)) / b.length);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Tallest bar: ${pdfMoney(max)}`, cx, y + 4);
    doc.setFillColor(...CAP); doc.rect(W - M - 150, y - 4, 8, 8, "F"); doc.text("Capital", W - M - 138, y + 3);
    doc.setFillColor(...GOLD); doc.rect(W - M - 85, y - 4, 8, 8, "F"); doc.text("Commission", W - M - 73, y + 3);
    b.forEach((k, i) => {
      const x = cx + i * (bw + gap);
      const hc = (k.capital / max) * ch, hm = (k.commission / max) * ch;
      if (hc > 0) { doc.setFillColor(...CAP); doc.rect(x, top + ch - hc, bw, hc, "F"); }
      if (hm > 0) { doc.setFillColor(...GOLD); doc.rect(x, top + ch - hc - hm, bw, hm, "F"); }
    });
    doc.setDrawColor(214, 224, 221);
    doc.line(cx, top + ch, cx + cw, top + ch);
    const step = Math.ceil(b.length / 8);
    doc.setFontSize(7.5);
    b.forEach((k, i) => { if (i % step === 0) doc.text(k.label, cx + i * (bw + gap) + bw / 2, top + ch + 11, { align: "center" }); });
    y = top + ch + 36;
  }

  table("Sales by category", ["Category", "Sold", "Income", "Commission"],
    a.categories.map((c) => [c.name, c.qty, pdfMoney(c.revenue), pdfMoney(c.commission)]), [1, 2, 3]);
  table("Best sellers (by quantity)", ["Product", "Sold", "Income", "Commission"],
    a.top.map((r) => [r.name, r.qty, pdfMoney(r.revenue), pdfMoney(r.commission)]), [1, 2, 3]);
  table("Biggest commission earners", ["Product", "Sold", "Commission"],
    a.top_commission.map((r) => [r.name, r.qty, pdfMoney(r.commission)]), [1, 2]);
  table("Payment methods", ["Method", "Orders", "Income"],
    a.payments.map((r) => [r.method.charAt(0).toUpperCase() + r.method.slice(1), r.orders, pdfMoney(r.revenue)]), [1, 2]);
  table("Sales by day of the week", ["Day", "Orders", "Income"],
    a.weekdays.map((d) => [DAYS[d.day], d.orders, pdfMoney(d.revenue)]), [1, 2]);
  table(`Slow movers: no sales this period (${a.slow.count} products, ${pdfMoney(a.slow.tied_up)} tied up)`, ["Product", "In stock", "Capital tied up"],
    a.slow.items.map((r) => [r.name, r.stock, pdfMoney(r.tied_up)]), [1, 2]);
  table("Stock to refill", ["Product", "Left"],
    a.inventory.alerts.map((r) => [r.name, r.stock === 0 ? "Out of stock" : r.stock]), [1]);

  // footer on every page
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("conwiInventory", M, H - 24);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 24, { align: "right" });
  }
  doc.save(`conwiInventory-analysis-${period}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
