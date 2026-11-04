import { api, peso } from "./api";
import { pdfMoney } from "./analysis";

export const EXPORT_LABELS = {
  all: "Everything",
  sales: "Sales",
  stock_movements: "Stock log",
  estore_entries: "Estores",
  expenses: "Expenses",
  products: "Products",
};

const stamp = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const TEAL = [14, 92, 99];

export async function fetchExport(target, days) {
  const q = new URLSearchParams({ target });
  if (days) q.set("older_than_days", String(days));
  const data = await api(`/export?${q}`);
  data.datasets = data.datasets.filter((d) => d.rows.length > 0);
  return data;
}

function save(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const baseName = (data) =>
  `conwiInventory-${data.target}${data.older_than_days ? `-older-than-${data.older_than_days}d` : ""}-${stamp()}`;
const title = (data) =>
  `conwiInventory backup: ${EXPORT_LABELS[data.target]}${data.older_than_days ? ` older than ${data.older_than_days} days` : ""}`;
const isMoney = (ds, i) => ds.money.includes(ds.columns[i]);

// ---------- CSV (one file per table, zipped when there are several) ----------
const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (ds) => "\ufeff" + [ds.columns, ...ds.rows].map((r) => r.map(csvCell).join(",")).join("\r\n");

export async function downloadCsv(data) {
  const name = baseName(data);
  if (data.datasets.length === 1) {
    const ds = data.datasets[0];
    return save(new Blob([toCsv(ds)], { type: "text/csv;charset=utf-8" }), `${name}-${ds.name.toLowerCase().replace(/\s+/g, "-")}.csv`);
  }
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  data.datasets.forEach((ds) => zip.file(`${ds.name.toLowerCase().replace(/\s+/g, "-")}.csv`, toCsv(ds)));
  save(await zip.generateAsync({ type: "blob" }), `${name}-csv.zip`);
}

// ---------- Excel ----------
export async function downloadExcel(data) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "conwiInventory";
  data.datasets.forEach((ds) => {
    const ws = wb.addWorksheet(ds.name.slice(0, 31));
    ws.addRow(ds.columns);
    ds.rows.forEach((r) => ws.addRow(r));
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E5C63" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ds.columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      if (isMoney(ds, i)) col.numFmt = '"₱"#,##0.00';
      const longest = Math.max(c.length, ...ds.rows.slice(0, 500).map((r) => String(r[i] ?? "").length));
      col.width = Math.min(45, longest + 3);
    });
  });
  const buf = await wb.xlsx.writeBuffer();
  save(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${baseName(data)}.xlsx`);
}

// ---------- PDF ----------
export async function downloadPdf(data) {
  const [{ jsPDF }, at] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = [at.default, at.autoTable, at.default?.default].find((f) => typeof f === "function");
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const M = 36;
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, W, 58, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title(data), M, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated ${data.generated_at}`, M, 46);
  let y = 84;
  data.datasets.forEach((ds) => {
    if (y > doc.internal.pageSize.getHeight() - 90) { doc.addPage(); y = 50; }
    doc.setTextColor(18, 38, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`${ds.name} (${ds.rows.length})`, M, y);
    const right = {};
    ds.columns.forEach((_, i) => { if (isMoney(ds, i) || typeof ds.rows[0][i] === "number") right[i] = { halign: "right" }; });
    autoTable(doc, {
      startY: y + 8,
      head: [ds.columns],
      body: ds.rows.map((r) => r.map((v, i) => (isMoney(ds, i) ? pdfMoney(v) : v ?? ""))),
      margin: { left: M, right: M },
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 4, textColor: [18, 38, 42] },
      headStyles: { fillColor: TEAL, textColor: 255 },
      columnStyles: right,
    });
    y = doc.lastAutoTable.finalY + 30;
  });
  save(doc.output("blob"), `${baseName(data)}.pdf`);
}

// ---------- Word ----------
export async function downloadWord(data) {
  const d = await import("docx");
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, HeadingLevel, ShadingType, AlignmentType, PageOrientation } = d;
  const cell = (text, { head = false, right = false } = {}) =>
    new TableCell({
      shading: head ? { type: ShadingType.CLEAR, fill: "0E5C63", color: "auto" } : undefined,
      children: [new Paragraph({
        alignment: right ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [new TextRun({ text: String(text ?? ""), size: 16, bold: head, color: head ? "FFFFFF" : "12262A" })],
      })],
    });
  const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: title(data), color: "0E5C63" })] }),
    new Paragraph({ children: [new TextRun({ text: `Generated ${data.generated_at}`, color: "5D7377" })] }),
  ];
  data.datasets.forEach((ds) => {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300 }, children: [new TextRun({ text: `${ds.name} (${ds.rows.length})` })] }));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, children: ds.columns.map((c, i) => cell(c, { head: true, right: isMoney(ds, i) })) }),
        ...ds.rows.map((r) => new TableRow({ children: r.map((v, i) => cell(isMoney(ds, i) ? peso(v) : v, { right: isMoney(ds, i) })) })),
      ],
    }));
  });
  const doc = new Document({
    creator: "conwiInventory",
    sections: [{ properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } }, children }],
  });
  save(await Packer.toBlob(doc), `${baseName(data)}.docx`);
}

export const FORMATS = [
  ["xlsx", "Excel (.xlsx)", downloadExcel],
  ["csv", "Dataset (.csv)", downloadCsv],
  ["pdf", "PDF", downloadPdf],
  ["docx", "Word (.docx)", downloadWord],
];
