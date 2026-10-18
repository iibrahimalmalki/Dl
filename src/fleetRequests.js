// طلبات الوقود وتغيير الزيت و«تنبيهات الأسطول» — منطق نقي بلا DOM ولا Supabase.
// القاعدة: docs/sql/fleet_requests.sql (طُبِّق 2026-10-12). الدوال تُستدعى من FuelOil.jsx (البوابة) و FleetRequests.jsx (الإدارة).
// مبدأ البوابة: لا منع ولا رسائل تحليلية للدرّاج — الرفض فقط لنقص حقل إلزامي، ولا يُعرض له أي رقم استهلاك أو مقارنة.

// حالات طلب الوقود والزيت (عربي + بنغالي للبوابة)
export const FUEL_STATUS = {
  requested: { ar: "مطلوب", bn: "অনুরোধ করা হয়েছে", tone: "warn" },
  transferred: { ar: "حُوِّل", bn: "টাকা পাঠানো হয়েছে", tone: "ok" },
  closed: { ar: "مُغلق", bn: "বন্ধ", tone: "info" },
  rejected: { ar: "مرفوض", bn: "প্রত্যাখ্যাত", tone: "bad" },
  cancelled: { ar: "ملغى", bn: "বাতিল", tone: "info" },
};
// الزيت (docs/sql/oil_flow.sql): لا خطوة «أُرسل لسويتر» — المفتوح (requested، أو sent القديم) «قيد المتابعة مع سويتر»
const OIL_FOLLOW = { ar: "قيد المتابعة مع سويتر", bn: "সুইটারের সাথে ফলো-আপ চলছে", tone: "info" };
export const OIL_STATUS = {
  requested: OIL_FOLLOW,
  sent: OIL_FOLLOW,
  done: { ar: "نُفّذ — بانتظار المراجعة", bn: "সম্পন্ন — যাচাইয়ের অপেক্ষায়", tone: "warn" },
  approved: { ar: "معتمد", bn: "অনুমোদিত", tone: "ok" },
  cancelled: { ar: "ملغى", bn: "বাতিল", tone: "bad" },
};
export const statusOf = (map, s) => map[s] || { ar: s || "—", bn: "", tone: "info" };

// أنواع التنبيهات كما تعيدها fleet_alerts() — للإدارة فقط
export const ALERT_KINDS = {
  high_consumption: { ar: "فحص صيانة مقترح (استهلاك عالٍ)", ic: "alert" },
  close_fills: { ar: "تعبئتان متقاربتان", ic: "fuel" },
  no_receipts: { ar: "حُوِّل بلا فواتير", ic: "doc" },
  fill_without_request: { ar: "تعبئة بلا طلب محوَّل", ic: "fuel" },
  odometer_backwards: { ar: "عدّاد أقل من القراءة السابقة", ic: "alert" },
  odometer_jump: { ar: "قفزة عدّاد غير منطقية", ic: "alert" },
  oil_due: { ar: "تغيير الزيت مستحق", ic: "bike" },
  oil_overdue: { ar: "طلب زيت لم يُنفَّذ", ic: "clock" },
};
export const alertAr = k => (ALERT_KINDS[k] || {}).ar || k;

// الحدود القابلة للضبط (fleet_alert_settings) — الترتيب والوصف في صفحة الإدارة
export const SETTINGS = [
  { k: "fuel_low_pct", ar: "استهلاك عالٍ: نسبة الانخفاض عن متوسط آخر 3 طلبات", unit: "%" },
  { k: "fuel_min_km_per_50", ar: "استهلاك عالٍ قبل 3 طلبات: أقل كيلومترات لكل 50﷼", unit: "كم" },
  { k: "fill_gap_km", ar: "تعبئتان متقاربتان: فرق العدّاد أقل من", unit: "كم" },
  { k: "fill_gap_hours", ar: "تعبئتان متقاربتان: الفرق الزمني أقل من", unit: "ساعة" },
  { k: "receipt_grace_days", ar: "مهلة الفواتير بعد التحويل", unit: "يوم" },
  { k: "odo_max_km_per_day", ar: "قفزة عدّاد: أكثر من", unit: "كم/يوم" },
  { k: "oil_interval_km", ar: "استحقاق تغيير الزيت منذ آخر تغيير معتمد", unit: "كم" },
  { k: "oil_exec_days", ar: "مهلة تنفيذ طلب الزيت", unit: "يوم" },
  { k: "fuel_price_91", ar: "سعر لتر بنزين 91", unit: "﷼" },
  { k: "fuel_topup_amount", ar: "رصيد الوقود: مبلغ الدفعة التلقائية", unit: "﷼" },
  { k: "fuel_topup_threshold", ar: "رصيد الوقود: دفعة تلقائية تحت", unit: "﷼" },
  { k: "fuel_fill_tolerance", ar: "رصيد الوقود: أقصى تجاوز للرصيد في تعبئة", unit: "﷼" },
  { k: "fuel_price_min", ar: "سعر اللتر: تحذير تحت", unit: "﷼" },
  { k: "fuel_price_max", ar: "سعر اللتر: تحذير فوق", unit: "﷼" },
  { k: "fuel_wallet_start", ar: "رصيد الوقود: بداية الحساب", unit: "YYYYMMDD" },
];
// قيمة حدّ صالحة: موجبة، والنسبة أقل من 100 (كما تفرضه set_fleet_alert_setting)
export const settingError = (k, v) => {
  const n = parseNum(v);
  if (n == null || n <= 0) return "أدخل قيمة موجبة";
  if (k === "fuel_low_pct" && n >= 100) return "النسبة أقل من 100";
  return null;
};

// أرقام الإدخال: عربية/فارسية/بنغالية ← لاتينية، والفاصلة العشرية العربية
export function parseNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim()
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[০-৯]/g, d => String(d.charCodeAt(0) - 0x09E6))
    .replace(/[٫,]/g, ".").replace(/\s+/g, "");
  if (!s || !/^\d+(\.\d*)?$/.test(s)) return null;
  return Number(s);
}

// تنقية الحقول الرقمية أثناء الكتابة: أرقام عربية/فارسية/بنغالية ← لاتينية
const latin = v => String(v ?? "").replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x0660).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x06F0).replace(/[০-৯]/g, d => d.charCodeAt(0) - 0x09E6);
// العدّاد: أرقام صحيحة فقط — الفاصلة وفاصل الآلاف يُحذفان (14,230 ⇒ 14230، لا 14.23)
export const intInput = v => latin(v).replace(/\D/g, "");
// المبلغ واللترات: فاصلة عشرية واحدة (الفاصلة العربية ⇒ نقطة)، وما بعد النقطة الثانية يُحذف
export const decInput = v => { const s = latin(v).replace(/[٫,]/g, ".").replace(/[^\d.]/g, ""); const i = s.indexOf("."); return i < 0 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, ""); };

// ── تحقق نماذج البوابة: حقل إلزامي ناقص فقط (لا حدود ولا مقارنات) ⇒ {field, ar, bn} أو null ──
const NEED = {
  odometer: { ar: "أدخل قراءة العدّاد.", bn: "ওডোমিটার লিখুন।" },
  odoPhoto: { ar: "التقط صورة العدّاد.", bn: "ওডোমিটারের ছবি তুলুন।" },
  amount: { ar: "أدخل المبلغ.", bn: "পরিমাণ লিখুন।" },
  receipt: { ar: "التقط صورة الفاتورة.", bn: "রসিদের ছবি তুলুন।" },
  liters: { ar: "أدخل اللترات (رقم موجب).", bn: "লিটার লিখুন (ধনাত্মক সংখ্যা)।" },
};
export const need = field => ({ field, ...NEED[field] });
// نماذج الزيت: oilRequestFormError / oilExecFormError في oilFlow.js

// ── رسائل أخطاء الدوال (raise exception 'CODE') ──
const RPC_BIKER = {
  NOT_A_BIKER: { ar: "هذا الحساب غير مرتبط برقم بايكر. تواصل مع الإدارة.", bn: "এই অ্যাকাউন্ট বাইকার নম্বরের সাথে যুক্ত নয়। ম্যানেজমেন্টকে জানান।", action: "whatsapp" },
  NO_BIKE: { ar: "لا توجد دراجة مخصّصة لك الآن. تواصل مع الإدارة.", bn: "এখন আপনার নামে কোনো বাইক নেই। ম্যানেজমেন্টকে জানান।", action: "whatsapp" },
  ODOMETER_REQUIRED: NEED.odometer, PHOTO_REQUIRED: { ar: "الصور المطلوبة ناقصة.", bn: "প্রয়োজনীয় ছবি নেই।" },
  AMOUNT_REQUIRED: NEED.amount, BAD_LITERS: NEED.liters,
  TECH_NAME_REQUIRED: { ar: "اكتب اسم الفني.", bn: "টেকনিশিয়ানের নাম লিখুন।" },   // confirm_oil_change القديمة (قبل oil_flow.sql)
  NOTES_TOO_LONG: { ar: "الملاحظات طويلة جداً.", bn: "নোট খুব লম্বা।" },
  ALREADY_DONE: { ar: "هذا الطلب لم يعد مفتوحاً — حدّث الصفحة.", bn: "এই অনুরোধ আর খোলা নেই — পেজ রিফ্রেশ করুন।" },
  // الزيت (docs/sql/oil_flow.sql)
  SHOT_REQUIRED: { ar: "لقطة سويتر ناقصة.", bn: "সুইটারের স্ক্রিনশট নেই।" },
  SAME_MINUTE: { ar: "انتظر دقيقة بعد رفع الطلب ثم حدّث التنفيذ.", bn: "অনুরোধের পর এক মিনিট অপেক্ষা করে আপডেট দিন।" },
  ODOMETER_BELOW_REQUEST: { ar: "العدّاد أقل من عدّاد الطلب.", bn: "ওডোমিটার অনুরোধের রিডিং থেকে কম।" },
  TECH_NAME_TOO_LONG: { ar: "اسم الفني طويل جداً.", bn: "টেকনিশিয়ানের নাম খুব লম্বা।" },
  USE_NEW_OIL_REQUEST: { ar: "حدّث الصفحة ثم أعد المحاولة.", bn: "পেজ রিফ্রেশ করে আবার চেষ্টা করুন।" },
  NOT_FOUND: { ar: "الطلب غير موجود.", bn: "অনুরোধ পাওয়া যায়নি।", action: "whatsapp" },
};
export const errCode = err => { const m = String((err && (err.message || err.details)) || err || ""); const x = m.match(/\b([A-Z][A-Z_]{3,})\b/); return x ? x[1] : null; };
// للبوابة: شكل ErrorNote ({key, code, ar, bn, action}) أو null ⇒ يُستعمل humanError للأخطاء العامة (شبكة، جلسة…)
export function bikerRpcError(err) {
  const c = errCode(err), t = c && RPC_BIKER[c];
  return t ? { key: "rpc", code: "E-" + c, ar: t.ar, bn: t.bn, action: t.action } : null;
}
const RPC_ADMIN = {
  FORBIDDEN: "لا تملك صلاحية تعديل «تنبيهات الأسطول».",
  REF_REQUIRED: "أدخل مرجع التحويل.",
  BAD_DATE: "التاريخ غير منطقي (مستقبلي أو قبل الطلب).",
  NOT_REQUESTED: "حالة الطلب تغيّرت — حدّث الصفحة.",
  NOT_DONE: "لم يرفع البايكر التنفيذ بعد — حدّث الصفحة.",
  NOT_FOUND: "الطلب غير موجود.",
  BAD_KEY: "حدّ غير معروف.",
  BAD_VALUE: "قيمة غير صالحة (موجبة، والنسبة أقل من 100).",
  NOTE_TOO_LONG: "الملاحظة طويلة جداً.",
  // رصيد الوقود (docs/sql/fuel_wallet.sql)
  TXN_REQUIRED: "أدخل رقم العملية البنكية.",
  DUPLICATE_TXN: "رقم العملية مستعمل لدفعة أخرى.",
  BAD_AMOUNT: "المبلغ غير صالح.",
  BAD_FEE: "الرسوم غير صالحة.",
  REASON_REQUIRED: "اكتب السبب.",
  REASON_TOO_LONG: "السبب طويل جداً.",
  ALREADY_REVIEWED: "رُوجعت هذه التعبئة من قبل — حدّث الصفحة.",
  DECISION_REQUIRED: "اختر اعتماد أو رفض.",
  // الزيت (docs/sql/oil_flow.sql)
  ALREADY_CANCELLED: "أُلغي هذا الطلب من قبل — حدّث الصفحة.",
  NO_BIKER: "لا بايكر مخصّص لهذه الدراجة ولا حائز لها.",
  PHOTO_REQUIRED: "أرفق صورة العدّاد.",
  ODOMETER_REQUIRED: "أدخل قراءة العدّاد.",
  BAD_URL: "رابط صورة غير صالح.",
  INACTIVE_VEHICLE: "الدراجة غير نشطة.",
  PROOF_NEEDS_DONE: "لقطة التنفيذ مع «تغيير منفّذ» فقط.",
};
export const adminRpcError = err => { const c = errCode(err); return (c && RPC_ADMIN[c]) || ("خطأ: " + String((err && err.message) || err || "")); };

// ── الإدارة ──
const t = v => (v ? new Date(v).getTime() : 0);
// الطلبات: «المطلوبة» غير المحوَّلة أولاً (الأقدم أولاً — الأطول انتظاراً)، ثم المحوَّلة، ثم المغلقة (الأحدث أولاً)
export function splitRequests(rows) {
  const r = rows || [];
  return {
    pending: r.filter(x => x.status === "requested").sort((a, b) => t(a.requested_at) - t(b.requested_at)),
    transferred: r.filter(x => x.status === "transferred").sort((a, b) => t(b.transferred_at) - t(a.transferred_at)),
    closed: r.filter(x => ["closed", "rejected", "cancelled"].includes(x.status)).sort((a, b) => t(b.requested_at) - t(a.requested_at)),
  };
}
// طلبات الزيت: bikerOil / splitOilAdmin في oilFlow.js
// منذ متى (ساعات/أيام) — نص عربي قصير
export function since(iso, now = Date.now()) {
  const h = Math.max(0, Math.floor((now - t(iso)) / 3600000));
  return h < 1 ? "أقل من ساعة" : h < 48 ? h + " ساعة" : Math.floor(h / 24) + " يوم";
}
// التنبيهات مجمّعة لكل دراجة (لا لكل درّاج)، بترتيب اللوحة
export function alertsByVehicle(alerts) {
  const m = new Map();
  (alerts || []).forEach(a => {
    const k = a.vehicle_id || "—";
    if (!m.has(k)) m.set(k, { vehicle_id: a.vehicle_id, plate: a.plate || "—", items: [] });
    m.get(k).items.push(a);
  });
  return [...m.values()].map(g => ({ ...g, items: g.items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "warn" ? -1 : 1) || t(b.at) - t(a.at)) }))
    .sort((a, b) => b.items.filter(i => i.severity === "warn").length - a.items.filter(i => i.severity === "warn").length || String(a.plate).localeCompare(String(b.plate)));
}
// تكلفة الكيلو لكل دراجة في شهر (YYYY-MM): مجموع التحويلات ÷ (أعلى − أدنى قراءة عدّاد في الشهر). عرض لا تنبيه.
// requests: fuel_requests (transferred_at, amount_actual|amount, odometer, requested_at, vehicle_id, plate)؛ fills: fuel_logs غير legacy وغير مرفوضة (fill_at, odometer)
export const riyadhMonth = (v = new Date()) => { const d = new Date(v); return isNaN(d) ? "" : d.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }).slice(0, 7); };
export function monthlyCostPerKm(month, requests, fills) {
  const inMonth = iso => !!iso && riyadhMonth(iso) === month;
  const m = new Map();
  const row = (id, plate) => { if (!m.has(id)) m.set(id, { vehicle_id: id, plate: plate || "—", amount: 0, min: null, max: null }); const r = m.get(id); if (plate && r.plate === "—") r.plate = plate; return r; };
  const read = (r, odo) => { const n = Number(odo); if (odo == null || odo === "" || !isFinite(n)) return; r.min = r.min == null ? n : Math.min(r.min, n); r.max = r.max == null ? n : Math.max(r.max, n); };
  (requests || []).forEach(q => {
    if (!q.vehicle_id) return;
    if (inMonth(q.transferred_at)) row(q.vehicle_id, q.plate).amount += Number(q.amount_actual ?? q.amount) || 0;   // المبلغ الفعلي المحوَّل إن وُجد
    if (inMonth(q.requested_at)) read(row(q.vehicle_id, q.plate), q.odometer);
  });
  (fills || []).forEach(f => { if (f.vehicle_id && !f.legacy && f.status !== "rejected" && inMonth(f.fill_at)) read(row(f.vehicle_id, f.plate), f.odometer); });
  return [...m.values()].map(r => {
    const km = r.min != null && r.max != null ? r.max - r.min : 0;
    return { vehicle_id: r.vehicle_id, plate: r.plate, amount: Math.round(r.amount * 100) / 100, km, perKm: km > 0 && r.amount > 0 ? Math.round(r.amount / km * 1000) / 1000 : null };
  }).filter(r => r.amount > 0 || r.km > 0).sort((a, b) => String(a.plate).localeCompare(String(b.plate)));
}
