export const PERIOD_NAMES = {
  day: "Today", week: "Last 7 days", month: "Last 30 days", half: "Last 6 months", year: "Last 12 months",
};
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
export const pctChange = (now, prev) => (prev ? Math.round(((now - prev) / prev) * 1000) / 10 : null);
// jsPDF's built-in fonts cannot draw the peso sign, so the PDF uses "PHP"
export const pdfMoney = (n) =>
  "PHP " + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function buildInsights(a, money) {
  const t = a.totals;
  const out = [];
  if (!t.orders) {
    out.push("There are no sales in this period yet, so there is nothing to analyse. Record some sales on the Sell page.");
  } else {
    const ch = pctChange(t.revenue, a.previous.revenue);
    out.push(
      ch === null
        ? "There were no sales in the previous period, so there is nothing to compare with yet."
        : `Income is ${ch >= 0 ? "up" : "down"} ${Math.abs(ch)}% compared with the previous period of the same length (${money(a.previous.revenue)} before).`
    );
    out.push(`You made ${t.orders} sale${t.orders === 1 ? "" : "s"}, averaging ${money(t.revenue / t.orders)} per sale. You keep about ${money(t.commission / t.orders)} commission on each one.`);
    if (a.top[0]) out.push(`${a.top[0].name} is your best seller with ${a.top[0].qty} sold.`);
    if (a.top_commission[0]) out.push(`${a.top_commission[0].name} earned you the most commission: ${money(a.top_commission[0].commission)}.`);
    const day = a.weekdays.reduce((m, d) => (d.orders > m.orders ? d : m), a.weekdays[0]);
    const hour = a.hours.reduce((m, h) => (h.orders > m.orders ? h : m), a.hours[0]);
    out.push(`Your busiest day is ${DAYS[day.day]} and your busiest hour is ${hourLabel(hour.hour)}.`);
    if (a.categories.length > 1) out.push(`${a.categories[0].name} brings in the most commission (${money(a.categories[0].commission)}).`);
  }
  if (a.slow.count) out.push(`${a.slow.count} product${a.slow.count === 1 ? " had" : "s had"} no sales in this period and tie up ${money(a.slow.tied_up)} of your capital.`);
  if (a.stock.out || a.stock.low) out.push(`${a.stock.out} product${a.stock.out === 1 ? " is" : "s are"} out of stock and ${a.stock.low} ${a.stock.low === 1 ? "is" : "are"} running low.`);
  return out;
}
