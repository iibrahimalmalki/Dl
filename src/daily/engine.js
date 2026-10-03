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
// متأخر: بين 23:00 و08:00 بتوقيت الرياض
export const isLate = t => { const h = riyadhHour(t); return h != null && (h >= 23 || h < 8); };

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
export const toLocalInput = t => { const d = new Date(t); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
export const csvCell = v => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
