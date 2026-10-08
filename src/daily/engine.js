// الاستلام اليومي من مندوب سويتر — منطق نقي (بلا DOM وبلا Supabase).

// قسمة كمية بالتساوي على البايكرز؛ باقي القسمة يذهب للمستلم. → {[bikerId]: qty}
export function splitEven(qty, bikerIds, receiverId) {
  const ids = [...new Set((bikerIds || []).filter(Boolean))];
  if (receiverId && !ids.includes(receiverId)) ids.push(receiverId);
  const out = {}; ids.forEach(id => { out[id] = 0; });
  const q = Math.max(0, Math.floor(+qty || 0));
  if (!ids.length || !q) return out;
  const base = Math.floor(q / ids.length), rest = q - base * ids.length;
  ids.forEach(id => { out[id] = base; });
  if (rest) { if (receiverId) out[receiverId] += rest; else out[ids[0]] += rest; }
  return out;
}
// قائمة التوزيع: المشمولون فقط (in_daily_split ≠ false). المستلم غير المشمول (متدرب مرافق) لا يدخل القسمة
// ونصيبه صفر، فيذهب باقي القسمة لأول المشمولين. → {ids, receiver}
export function splitList(bikers, receiverId, receiverIncluded = true) {
  const ids = (bikers || []).filter(b => b && b.id && b.in_daily_split !== false).map(b => b.id);
  const receiver = receiverIncluded && receiverId ? receiverId : null;
  if (receiver && !ids.includes(receiver)) ids.unshift(receiver);
  return { ids: [...new Set(receiverIncluded ? ids : ids.filter(id => id !== receiverId))], receiver };
}
// قسمة كل الأصناف: lines {[item]: qty} → {[item]: {[bikerId]: qty}}
export const splitAll = (lines, bikerIds, receiverId) => Object.fromEntries(Object.entries(lines || {}).filter(([, q]) => q > 0).map(([k, q]) => [k, splitEven(q, bikerIds, receiverId)]));
// شرط الاعتماد: مجموع الأنصبة لكل صنف = الكمية المستلمة، ولا قيم سالبة
export function splitErrors(lines, plan) {
  const bad = [];
  Object.entries(lines || {}).forEach(([k, q]) => { if (!(q > 0)) return; const p = (plan || {})[k] || {}, vals = Object.values(p);
    if (vals.some(v => !(Number.isInteger(v) && v >= 0))) bad.push(k); else if (vals.reduce((a, v) => a + v, 0) !== q) bad.push(k); });
  return bad;
}

// جوال سعودي → 05XXXXXXXX، أو null إن لم يكن صالحاً
export function normPhone(v) {
  let d = String(v || "").replace(/[٠-٩]/g, c => "٠١٢٣٤٥٦٧٨٩".indexOf(c)).replace(/\D/g, "");
  if (d.startsWith("00966")) d = d.slice(5); else if (d.startsWith("966")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return /^5\d{8}$/.test(d) ? "0" + d : null;
}

// الساعة بتوقيت الرياض (UTC+3 بلا توقيت صيفي)
export const riyadhHour = t => { const d = new Date(t); return Number.isNaN(d.getTime()) ? null : (d.getUTCHours() + 3) % 24; };
export const riyadhDay = t => new Date(new Date(t).getTime() + 3 * 3600e3).toISOString().slice(0, 10);
export const riyadhHM = t => { const d = new Date(new Date(t).getTime() + 3 * 3600e3); return d.toISOString().slice(11, 16); };
const riyadhMin = t => { const x = new Date(t).getTime(); if (Number.isNaN(x)) return null; const d = new Date(x + 3 * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes(); };

// نافذتا التسليم المتفق عليهما مع مندوب سويتر (دقائق من منتصف الليل بتوقيت الرياض):
// مسائية من نهاية وردية البايكر حتى 00:00، وصباحية 07:00–08:30 شاملة.
// eveningFrom (21:00) افتراض حتى يحدّد المالك نهاية الوردية.
export const WINDOWS = { eveningFrom: 21 * 60, morningFrom: 7 * 60, morningTo: 8 * 60 + 30 };
export const SLOTS = {
  evening: { ar: "مسائي — في الموعد", en: "Evening — on time", tone: "ok" },
  morning: { ar: "صباحي — في الموعد", en: "Morning — on time", tone: "ok" },
  night: { ar: "ليلي — خارج النافذة", en: "Night — outside window", tone: "warn" },
  late: { ar: "متأخر — خلال الدوام", en: "Late — during shift", tone: "bad" },
};
// تصنيف وقت التسليم ← {kind, ok, lateMin}؛ lateMin = الدقائق بعد 08:30 للمتأخر فقط
export function deliverySlot(t, w = WINDOWS) {
  const m = riyadhMin(t);
  if (m == null) return null;
  if (m >= w.eveningFrom) return { kind: "evening", ok: true, lateMin: 0 };
  if (m >= w.morningFrom && m <= w.morningTo) return { kind: "morning", ok: true, lateMin: 0 };
  if (m < w.morningFrom) return { kind: "night", ok: false, lateMin: 0 };
  return { kind: "late", ok: false, lateMin: m - w.morningTo };
}
// خارج النافذتين (ليلي أو متأخر)
export const isLate = t => { const s = deliverySlot(t); return !!s && !s.ok; };
// يوم العمل الذي يخدمه التسليم: المسائي لليوم التالي، وما عداه لنفس اليوم
export const serviceDay = (t, w = WINDOWS) => { const s = deliverySlot(t, w); return riyadhDay(new Date(t).getTime() + (s && s.kind === "evening" ? 864e5 : 0)); };

// حدود وقت الاستلام: لا مستقبل، وحتى 12 ساعة للخلف
export const MAX_BACK_H = 12;
export function receivedAtError(t, now = Date.now()) {
  const x = new Date(t).getTime();
  if (Number.isNaN(x)) return "وقت غير صالح";
  if (x > now + 60e3) return "لا يمكن تسجيل وقت في المستقبل";
  if (x < now - MAX_BACK_H * 3600e3) return `لا يمكن الرجوع أكثر من ${MAX_BACK_H} ساعة`;
  return null;
}

// التحقق من نموذج الاستلام → قائمة أخطاء (فارغة = صالح)
export function validateReceive(f, now = Date.now()) {
  const e = [];
  const t = receivedAtError(f.received_at, now); if (t) e.push(t);
  const hasCourier = f.courier_id || (f.newCourier && String(f.newCourier.name || "").trim() && normPhone(f.newCourier.phone));
  if (!hasCourier) e.push("اختر المندوب أو أدخل اسمه وجواله");
  if (!Object.values(f.qty || {}).some(q => q > 0)) e.push("أدخل كمية صنف واحد على الأقل");
  if (!(f.photos && f.photos.length)) e.push("أضف صورة واحدة على الأقل للشحنة");
  if (f.photos && f.photos.length > 4) e.push("4 صور كحد أقصى");
  return e;
}

// الرصيد لكل بايكر × صنف.
// shares: [{employee_id, item_key, qty, status, qty_actual, received_by}] — received_by هو مستلم التسليم
// adjustments: [{employee_id, item_key, delta}] (الصرف سالب)
// undistributed: [{received_by, lines:[{item_key, qty}]}] تسليمات لم تُوزَّع بعد — كاملة على المستلم
// النصيب pending يُحسب على المستلم؛ short يُحسب لصاحبه بـ qty_actual والفرق على المستلم.
export function balances(shares = [], adjustments = [], undistributed = []) {
  const b = {}, add = (emp, k, n) => { if (!emp || !n) return; b[emp] = b[emp] || {}; b[emp][k] = (b[emp][k] || 0) + n; };
  shares.forEach(s => {
    if (s.status === "confirmed") add(s.employee_id, s.item_key, s.qty);
    else if (s.status === "short") { const a = Math.max(0, Math.min(s.qty, s.qty_actual ?? 0)); add(s.employee_id, s.item_key, a); add(s.received_by, s.item_key, s.qty - a); }
    else add(s.received_by, s.item_key, s.qty);
  });
  undistributed.forEach(d => (d.lines || []).forEach(l => add(d.received_by, l.item_key, l.qty)));
  adjustments.forEach(a => add(a.employee_id, a.item_key, a.delta));
  return b;
}

// ملخص شهري: deliveries [{received_at, towels_returned, lines:[{item_key, qty}]}]
export function monthSummary(deliveries = []) {
  const items = {}; let late = 0, mins = 0, towelsReturned = 0;
  deliveries.forEach(d => {
    if (isLate(d.received_at)) late++;
    // متوسط الوقت على ساعة دائرية تبدأ 12 ظهراً حتى لا يفسد منتصف الليل المتوسط
    const [h, m] = riyadhHM(d.received_at).split(":").map(Number); mins += ((h * 60 + m) - 720 + 1440) % 1440;
    towelsReturned += d.towels_returned || 0;
    (d.lines || []).forEach(l => { items[l.item_key] = (items[l.item_key] || 0) + l.qty; });
  });
  const n = deliveries.length;
  let avg = null; if (n) { const a = Math.round(mins / n + 720) % 1440; avg = String(Math.floor(a / 60)).padStart(2, "0") + ":" + String(a % 60).padStart(2, "0"); }
  return { count: n, late, avgTime: avg, items, towelsReturned };
}

// تحويل وقت محلي من حقل datetime-local إلى ISO والعكس
// ── أداء المندوب ──
const addDays = (day, n) => new Date(Date.parse(day + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);

// أيام العمل بلا تسليم بعد مهلة maxGap يوماً (المتفق: تسليم كل يوم أو يومين ⇒ اليوم الثاني المتتالي بلا تسليم فائت).
// from/to أيام 'YYYY-MM-DD' شاملة؛ لا يبدأ العدّ قبل أول تسليم مسجّل في النظام (startDay) حتى لا يُحسب ما قبل الاستخدام.
export function missedDays(deliveries = [], from, to, { maxGap = 2, startDay = null, w = WINDOWS } = {}) {
  const served = new Set(deliveries.map(d => serviceDay(d.received_at, w)));
  const first = startDay || [...served].sort()[0];
  if (!first || !from || !to) return [];
  const out = []; let run = 0;
  for (let day = first < from ? first : from; day <= to; day = addDays(day, 1)) {
    if (day < first) continue;
    run = served.has(day) ? 0 : run + 1;
    if (run >= maxGap && day >= from) out.push(day);
  }
  return out;
}

// ملخص المندوبين: deliveries [{id, courier_id, received_at}]، shares [{delivery_id, status, qty, qty_actual}]
// ← {all, byCourier:{id: stats}}؛ stats: العدد، في الموعد، ليلي، متأخر، متوسط/أقصى دقائق التأخير، تسليمات فيها نقص وكميته، آخر تسليم
export function courierStats(deliveries = [], shares = [], w = WINDOWS) {
  const shortBy = {};
  shares.forEach(s => { if (s.status !== "short") return; const n = Math.max(0, (s.qty || 0) - Math.max(0, s.qty_actual ?? 0)); shortBy[s.delivery_id] = (shortBy[s.delivery_id] || 0) + n; });
  const blank = () => ({ count: 0, onTime: 0, night: 0, late: 0, lateMinSum: 0, lateMinMax: 0, shortDeliveries: 0, shortQty: 0, last: null });
  const all = blank(), byCourier = {};
  const add = (st, d, s) => {
    st.count++;
    if (s.ok) st.onTime++; else if (s.kind === "night") st.night++; else { st.late++; st.lateMinSum += s.lateMin; st.lateMinMax = Math.max(st.lateMinMax, s.lateMin); }
    if (d.id in shortBy) { st.shortDeliveries++; st.shortQty += shortBy[d.id]; }
    if (!st.last || d.received_at > st.last) st.last = d.received_at;
  };
  deliveries.forEach(d => { const s = deliverySlot(d.received_at, w); if (!s) return; add(all, d, s); add(byCourier[d.courier_id] = byCourier[d.courier_id] || blank(), d, s); });
  const fin = st => ({ ...st, onTimePct: st.count ? Math.round(st.onTime * 100 / st.count) : null, lateMinAvg: st.late ? Math.round(st.lateMinSum / st.late) : 0 });
  return { all: fin(all), byCourier: Object.fromEntries(Object.entries(byCourier).map(([k, v]) => [k, fin(v)])) };
}

export const toLocalInput = t => { const d = new Date(t); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
export const csvCell = v => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

/* ── رسالتا واتساب بعد الاستلام ── */
// صيغ مختصرة للأصناف المعروفة في الرسالة (الوحدة في المناشف = الربطة لكل غسلة)
const SHORT_AR = { freshener: "فواحة", mat: "دعاسة", tissue: "مناديل", seat_cover: "غطاء مقعد", wet_wipes: "مناديل مبللة", towel_clean: "ربطات مناشف" };
const SHORT_EN = { freshener: "Air freshener", mat: "Floor mat", tissue: "Tissues", seat_cover: "Seat cover", wet_wipes: "Wet wipes", towel_clean: "Towel bundles" };
const stripParen = s => String(s || "").replace(/\s*\([^)]*\)\s*/g, " ").trim();
export const itemLabel = (it, lang) => {
  if (lang === "en") return it.name_en ? (SHORT_EN[it.key] || (it.kind === "towel" ? "Towel bundles" : stripParen(it.name_en))) : (SHORT_AR[it.key] || stripParen(it.name_ar));
  return SHORT_AR[it.key] || (it.kind === "towel" ? "ربطات مناشف" : stripParen(it.name_ar));
};
// التاريخ DD/MM/YYYY والوقت 12 ساعة بتوقيت الرياض، بأرقام لاتينية
export function riyadhStamp(t) {
  const d = new Date(new Date(t).getTime() + 3 * 3600e3), p = n => String(n).padStart(2, "0");
  const h = d.getUTCHours(), h12 = h % 12 || 12, pm = h >= 12;
  return { date: `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`, ar: `${p(h12)}:${p(d.getUTCMinutes())} ${pm ? "م" : "ص"}`, en: `${p(h12)}:${p(d.getUTCMinutes())} ${pm ? "PM" : "AM"}` };
}
const who = p => p ? `${p.full_name || "—"}${p.employee_id ? ` (${p.employee_id})` : ""}` : "—";

// kind: "sweater" (تأكيد + الإجمالي) | "ops" (الإجمالي + التوزيع + من لم يؤكد)
// lines [{item_key, qty}] · items [{key,name_ar,name_en,kind,sort}] · courier {name, phone} · receiver {full_name, employee_id}
// shares [{employee_id,item_key,qty,status}] · team [{id, full_name, employee_id}]
export function waMessage({ delivery, lines, items, courier, receiver, shares = [], team = [] }, kind) {
  const byKey = Object.fromEntries((items || []).map(i => [i.key, i]));
  const order = k => (byKey[k] ? byKey[k].sort : 9999);
  const qtyLines = (lines || []).filter(l => l.qty > 0).sort((a, b) => order(a.item_key) - order(b.item_key));
  const it = k => byKey[k] || { key: k, name_ar: k, name_en: k };
  const list = (rows, lang) => rows.map(l => `${itemLabel(it(l.item_key), lang)} ${l.qty}`).join(" · ");
  const st = riyadhStamp(delivery.received_at), tr = delivery.towels_returned || 0, note = String(delivery.note || "").trim();
  const c = courier ? `${courier.name} — ${courier.phone}` : "—";
  // التوزيع لكل بايكر له نصيب
  const people = [];
  if (kind === "ops") {
    const per = {};
    shares.filter(s => s.qty > 0).forEach(s => { (per[s.employee_id] = per[s.employee_id] || []).push(s); });
    Object.keys(per).forEach(id => {
      const p = team.find(t => t.id === id) || (receiver && receiver.id === id ? receiver : { full_name: "—" });
      const rows = per[id].sort((a, b) => order(a.item_key) - order(b.item_key));
      people.push({ name: p.full_name || "—", label: who(p), rows, confirmed: rows.every(s => s.status === "confirmed"), short: rows.some(s => s.status === "short"), pending: rows.some(s => s.status === "pending") });
    });
    people.sort((a, b) => a.name.localeCompare(b.name));
  }
  const section = lang => {
    const A = lang === "ar", out = [];
    out.push(A ? "✅ تم الاستلام من المندوب" : "✅ Delivery received from courier");
    out.push(A ? "📦 استلام يومي — دلو ورغوة (شريك 47)" : "📦 Daily delivery — Dalu Warghwah (SSP ID47)");
    out.push(A ? `التاريخ: ${st.date} — الوقت: ${st.ar}` : `Date: ${st.date} — Time: ${st.en}`);
    out.push((A ? "المستلم: " : "Received by: ") + who(receiver));
    out.push((A ? "المندوب: " : "Courier: ") + c);
    out.push((A ? "الكميات المستلمة: " : "Received: ") + (qtyLines.length ? list(qtyLines, lang) : "—"));
    if (tr > 0) out.push(A ? `المُرجَع للمندوب: ربطات مناشف مستعملة ${tr}` : `Returned to courier: Used towel bundles ${tr}`);
    if (note) out.push((A ? "ملاحظة: " : "Note: ") + note);
    if (kind === "ops") {
      if (people.length) {
        out.push(A ? "التوزيع:" : "Distribution:");
        people.forEach(p => out.push(`- ${p.label}: ${list(p.rows, lang)}${p.short ? (A ? " (ناقص)" : " (short)") : p.confirmed ? " ✓" : ""}`));
        const pend = people.filter(p => p.pending).map(p => p.name);
        if (pend.length) out.push(A ? `بانتظار التأكيد من: ${pend.join("، ")}` : `Pending confirmation: ${pend.join(", ")}`);
      }
    } else out.push(A ? "أي فرق عن الكمية المُرسلة نرجو إبلاغنا اليوم." : "Please report any difference from the dispatched quantity today.");
    return out.join("\n");
  };
  return section("ar") + "\n\n" + section("en");
}
export const waLink = msg => "https://wa.me/?text=" + encodeURIComponent(msg);
