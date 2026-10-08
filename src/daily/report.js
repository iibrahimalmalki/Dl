// تقرير أداء مندوب التوصيل لسويتر — صفحة HTML مستقلة للطباعة أو الحفظ PDF (عربي/إنجليزي).
// منطق نقي بلا Supabase: يُبنى من بيانات صفحة المتابعة ويُختبر في tests/dailyEngine.test.mjs.
import { WINDOWS, SLOTS, deliverySlot, courierStats, missedDays, riyadhDay, riyadhHM } from "./engine";

export const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hm = m => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const dmy = day => day.split("-").reverse().join("/");
const dur = m => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

// month 'YYYY-MM'؛ deliveries كل التسليمات (لحساب الأيام الفائتة عبر حدود الشهر)؛ today 'YYYY-MM-DD'
export function courierReport({ month, deliveries = [], shares = [], items = [], couriers = [], today, company = "مؤسسة دلو ورغوة", w = WINDOWS }) {
  const inMonth = deliveries.filter(d => riyadhDay(d.received_at).slice(0, 7) === month).sort((a, b) => (a.received_at < b.received_at ? -1 : 1));
  const ids = new Set(inMonth.map(d => d.id));
  const st = courierStats(inMonth, shares.filter(s => ids.has(s.delivery_id)), w);
  const [y, m] = month.split("-");
  const monthEnd = new Date(Date.UTC(+y, +m, 0)).toISOString().slice(0, 10);
  const to = today && today < monthEnd ? today : monthEnd;
  const missed = missedDays(deliveries, month + "-01", to, { w });
  const cName = id => { const c = couriers.find(x => x.id === id); return c ? `${c.name} (${c.phone})` : "—"; };
  const item = k => items.find(x => x.key === k) || { name_ar: k };
  const shortOf = id => shares.filter(s => s.delivery_id === id && s.status === "short").reduce((a, s) => a + Math.max(0, (s.qty || 0) - Math.max(0, s.qty_actual ?? 0)), 0);
  const a = st.all;
  const kpi = (v, ar, en, tone) => `<div class="k ${tone || ""}"><b>${esc(v)}</b><span>${ar}<br><i>${en}</i></span></div>`;
  const rows = inMonth.map(d => {
    const s = deliverySlot(d.received_at, w), sl = SLOTS[s.kind], sh = shortOf(d.id);
    const lines = (d.daily_delivery_lines || []).filter(l => l.qty > 0).map(l => { const i = item(l.item_key); return `<div><b>${l.qty}</b> — ${esc(i.name_ar)}${i.name_en ? `<br><i dir="ltr">${esc(i.name_en)}</i>` : ""}</div>`; }).join("");
    return `<tr class="${sl.tone}"><td>${dmy(riyadhDay(d.received_at))}</td><td dir="ltr">${riyadhHM(d.received_at)}</td>`
      + `<td>${sl.ar}<br><i>${sl.en}</i>${s.kind === "late" ? `<br><b dir="ltr">+${dur(s.lateMin)}</b>` : ""}</td>`
      + `<td>${esc(cName(d.courier_id))}</td><td>${lines || "—"}</td><td>${d.towels_returned || 0}</td><td>${sh ? `<b>${sh}</b>` : "—"}</td></tr>`;
  }).join("");
  const per = Object.entries(st.byCourier).map(([id, c]) => `<tr><td>${esc(cName(id))}</td><td>${c.count}</td><td>${c.onTimePct}%</td><td>${c.night}</td><td>${c.late}</td><td dir="ltr">${c.late ? dur(c.lateMinAvg) + " / " + dur(c.lateMinMax) : "—"}</td><td>${c.shortDeliveries}</td></tr>`).join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>تقرير مندوب التوصيل ${esc(month)}</title><style>
body{font-family:Tahoma,Arial,sans-serif;color:#1c1917;margin:0;padding:24px;font-size:12.5px;line-height:1.6;background:#fff}
h1{font-size:19px;margin:0}h2{font-size:14px;margin:22px 0 8px;border-bottom:2px solid #0f766e;padding-bottom:4px}
i{font-style:normal;color:#78716c;font-size:11px}.sub{color:#57534e;margin:4px 0 0}
.ks{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-top:14px}
.k{border:1px solid #e7e5e4;border-radius:10px;padding:8px 10px}.k b{display:block;font-size:20px}.k.bad b{color:#b91c1c}.k.warn b{color:#b45309}.k.ok b{color:#15803d}
table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #e7e5e4;padding:5px 7px;text-align:start;vertical-align:top}
th{background:#f5f5f4;font-size:11.5px}tr.bad td{background:#fef2f2}tr.warn td{background:#fffbeb}
.note{background:#f5f5f4;border-radius:10px;padding:10px 12px;margin-top:10px}.foot{margin-top:24px;color:#78716c;font-size:11px}
@media print{body{padding:0}@page{margin:12mm}tr{break-inside:avoid}}
</style></head><body>
<h1>تقرير التزام مندوب التوصيل — ${esc(company)}<br><i>Courier delivery compliance report</i></h1>
<p class="sub">الفترة / Period: <b dir="ltr">${m}/${y}</b> · حتى / up to <b dir="ltr">${dmy(to)}</b></p>
<div class="note">النافذتان المتفق عليهما (توقيت الرياض) / Agreed windows (Riyadh time):
مسائية من <b>${hm(w.eveningFrom)}</b> إلى <b>00:00</b> بعد انتهاء دوام البايكرز، أو صباحية من <b>${hm(w.morningFrom)}</b> إلى <b>${hm(w.morningTo)}</b> قبل أول طلب، وتسليم كل يوم أو يومين.
<br><i dir="ltr" style="display:block;text-align:left">Evening ${hm(w.eveningFrom)}–00:00 after the bikers' shift, or morning ${hm(w.morningFrom)}–${hm(w.morningTo)} before the first order. Expected every 1–2 days.</i></div>
<div class="ks">
${kpi(a.count, "تسليمات", "Deliveries")}
${kpi(a.onTimePct == null ? "—" : a.onTimePct + "%", "في الموعد", "On time", a.onTimePct == null ? "" : a.onTimePct >= 90 ? "ok" : "bad")}
${kpi(a.late, "متأخر خلال الدوام", "Late (during shift)", a.late ? "bad" : "ok")}
${kpi(a.late ? dur(a.lateMinAvg) : "—", "متوسط التأخير", "Avg. delay", a.late ? "bad" : "")}
${kpi(a.night, "ليلي خارج النافذة", "Night (outside window)", a.night ? "warn" : "ok")}
${kpi(missed.length, "أيام بلا تسليم", "Missed days", missed.length ? "bad" : "ok")}
${kpi(a.shortDeliveries, "تسليمات فيها نقص", "Short deliveries", a.shortDeliveries ? "warn" : "ok")}
</div>
${per ? `<h2>حسب المندوب / By courier</h2><table><thead><tr><th>المندوب / Courier</th><th>تسليمات</th><th>في الموعد</th><th>ليلي</th><th>متأخر</th><th>متوسط/أقصى تأخير</th><th>فيها نقص</th></tr></thead><tbody>${per}</tbody></table>` : ""}
${missed.length ? `<h2>أيام عمل بلا تسليم بعد مهلة يومين / Work days without delivery (after 2-day allowance)</h2><p dir="ltr" style="text-align:right">${missed.map(dmy).join(" · ")}</p>` : ""}
<h2>سجل التسليمات / Delivery log</h2>
${rows ? `<table><thead><tr><th>التاريخ<br><i>Date</i></th><th>الوقت<br><i>Time</i></th><th>التصنيف<br><i>Status</i></th><th>المندوب<br><i>Courier</i></th><th>الكميات المستلمة<br><i>Received</i></th><th>ربطات مستعملة مُرجَعة<br><i>Used bundles returned</i></th><th>نقص مُبلَّغ<br><i>Reported short</i></th></tr></thead><tbody>${rows}</tbody></table>` : `<p>لا تسليمات مسجّلة في هذه الفترة / No deliveries recorded.</p>`}
<p class="foot">كل وقت أعلاه مسجّل لحظة الاستلام مع صور الشحنة في نظام ${esc(company)}، والنقص مُبلَّغ من البايكر عند استلام نصيبه. صدر في ${dmy(today || riyadhDay(Date.now()))}.<br>
<i>Each time is recorded at handover with shipment photos; shortages are reported by bikers when confirming their share.</i></p>
</body></html>`;
}
