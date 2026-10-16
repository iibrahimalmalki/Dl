// «رصيد وقود متجدد» — منطق نقي بلا DOM ولا Supabase.
// القاعدة: docs/sql/fuel_wallet.sql. البايكر لا يطلب وقوداً: يستلم دفعة، يسجّل تعبئاته، وتحت العتبة تُنشأ دفعة تلقائية للإدارة.
// يُستدعى من FuelOil.jsx (البوابة) و FleetRequests.jsx (الإدارة) و Reports.jsx (المصروفات).
import { parseNum, errCode } from "./fleetRequests.js";

export const DEFAULT_WALLET = { threshold: 10, topup: 50, tolerance: 10 };
const n = v => (v == null || v === "" ? null : Number(v));
const t = v => (v ? new Date(v).getTime() : 0);
// ﷼ بلا كسور زائدة: 15 ⇒ "15"، 7.5 ⇒ "7.5"، 2.326 ⇒ "2.33"
export const sar = v => { const x = Number(v); return isFinite(x) ? String(Math.round(x * 100) / 100) : "—"; };

// رصيد البايكر من my_fuel_balance() (صف واحد) ⇒ {balance, threshold, topup, tolerance}
export function walletOf(row) {
  const r = Array.isArray(row) ? row[0] : row;
  if (!r) return null;
  return { balance: n(r.balance) ?? 0, threshold: n(r.threshold) ?? DEFAULT_WALLET.threshold, topup: n(r.topup_amount) ?? DEFAULT_WALLET.topup, tolerance: n(r.tolerance) ?? DEFAULT_WALLET.tolerance };
}

// الطلب المفتوح (مطلوب) — واحد على الأكثر لكل بايكر
export const openTopup = reqs => (reqs || []).filter(r => r.status === "requested").sort((a, b) => t(b.requested_at) - t(a.requested_at))[0] || null;
// زر «دفعة مستعجلة»: فقط برصيد تحت العتبة وبلا طلب مفتوح (والقاعدة تفرض الشرطين)
export const canUrgent = (w, reqs) => !!w && w.balance < w.threshold && !openTopup(reqs);

// حالة الدفعة القادمة للبوابة: مطلوب ⇒ «أُرسل للإدارة»؛ وإلا آخر قرار (حُوِّلت / رُفض)؛ وإلا لا شيء
export function nextTopup(reqs) {
  const open = openTopup(reqs);
  if (open) return { kind: "sent", req: open, ar: `طلب ${sar(open.amount)} ﷼ أُرسل للإدارة`, bn: `${sar(open.amount)} ﷼ অনুরোধ ম্যানেজমেন্টে পাঠানো হয়েছে`, tone: "warn" };
  const last = (reqs || []).filter(r => r.status === "transferred" || r.status === "rejected" || r.status === "closed")
    .sort((a, b) => t(b.transferred_at || b.rejected_at || b.requested_at) - t(a.transferred_at || a.rejected_at || a.requested_at))[0];
  if (!last) return null;
  if (last.status === "rejected") return { kind: "rejected", req: last, ar: "رُفض طلب الدفعة" + (last.reject_reason ? ` — ${last.reject_reason}` : ""), bn: "টাকার অনুরোধ প্রত্যাখ্যাত", tone: "bad" };
  return { kind: "transferred", req: last, ar: `حُوِّلت ${sar(last.amount_actual ?? last.amount)} ﷼`, bn: `${sar(last.amount_actual ?? last.amount)} ﷼ পাঠানো হয়েছে`, tone: "ok" };
}

// حالة التعبئة (عربي + بنغالي)
export const FILL_STATUS = {
  submitted: { ar: "بانتظار المراجعة", bn: "পর্যালোচনার অপেক্ষায়", tone: "info" },
  approved: { ar: "معتمدة", bn: "অনুমোদিত", tone: "ok" },
  rejected: { ar: "مرفوضة", bn: "প্রত্যাখ্যাত", tone: "bad" },
};
export const fillStatus = s => FILL_STATUS[s] || FILL_STATUS.submitted;

// تحقق نموذج التعبئة قبل الإرسال: الحقول الإلزامية (اللترات إلزامية الآن) + سقف الرصيد. ⇒ {field, ar, bn} أو null
export function walletFillError({ odometer, amount, liters, odoPhoto, receipt }, w) {
  if (parseNum(odometer) == null) return { field: "odometer", ar: "أدخل قراءة العدّاد.", bn: "ওডোমিটার লিখুন।" };
  const a = parseNum(amount);
  if (!(a > 0)) return { field: "amount", ar: "أدخل المبلغ.", bn: "পরিমাণ লিখুন।" };
  if (!(parseNum(liters) > 0)) return { field: "liters", ar: "أدخل اللترات.", bn: "লিটার লিখুন।" };
  if (w && a > w.balance + w.tolerance) return { field: "amount", ar: `المبلغ أكبر من رصيدك (${sar(w.balance)} ﷼).`, bn: `পরিমাণ আপনার ব্যালেন্সের (${sar(w.balance)} ﷼) চেয়ে বেশি।` };
  if (!odoPhoto) return { field: "odoPhoto", ar: "التقط صورة العدّاد.", bn: "ওডোমিটারের ছবি তুলুন।" };
  if (!receipt) return { field: "receipt", ar: "التقط صورة الفاتورة.", bn: "রসিদের ছবি তুলুন।" };
  return null;
}

// رسائل أخطاء دوال الرصيد للبوابة (raise exception 'CODE')
const WALLET_BIKER = {
  LITERS_REQUIRED: { ar: "أدخل اللترات.", bn: "লিটার লিখুন।" },
  ODOMETER_NOT_INCREASING: { ar: "قراءة العدّاد يجب أن تكون أكبر من آخر تعبئة.", bn: "ওডোমিটার আগের রিফুয়েলের চেয়ে বেশি হতে হবে।" },
  DUPLICATE_FILL: { ar: "هذه التعبئة مسجّلة من قبل.", bn: "এই রিফুয়েল আগেই রেকর্ড করা হয়েছে।" },
  OVER_BALANCE: { ar: "المبلغ أكبر من رصيدك.", bn: "পরিমাণ আপনার ব্যালেন্সের চেয়ে বেশি।" },
  OPEN_REQUEST: { ar: "طلب دفعة مفتوح بالفعل — بانتظار الإدارة.", bn: "একটি অনুরোধ ইতিমধ্যে খোলা — ম্যানেজমেন্টের অপেক্ষায়।" },
  BALANCE_OK: { ar: "رصيدك يكفي — لا حاجة لدفعة مستعجلة.", bn: "আপনার ব্যালেন্স যথেষ্ট — জরুরি টাকার দরকার নেই।" },
  REASON_REQUIRED: { ar: "اكتب السبب.", bn: "কারণ লিখুন।" },
  REASON_TOO_LONG: { ar: "السبب طويل جداً.", bn: "কারণ খুব লম্বা।" },
  USE_WALLET: { ar: "طلب الوقود صار تلقائياً — حدّث الصفحة.", bn: "জ্বালানির অনুরোধ এখন স্বয়ংক্রিয় — পেজ রিফ্রেশ করুন।" },
};
export function walletRpcError(err) {
  const c = errCode(err), x = c && WALLET_BIKER[c];
  return x ? { key: "rpc", code: "E-" + c, ar: x.ar, bn: x.bn } : null;
}

// ── الإدارة ──
// سعر اللتر (للعرض) — null بلا لترات
export const pricePerLiter = f => { const a = n(f && f.amount), l = n(f && f.liters); return a > 0 && l > 0 ? Math.round(a / l * 100) / 100 : null; };
// الدفعات: بانتظار التحويل (الأقدم أولاً) والتعبئات بانتظار الاعتماد (الأقدم أولاً)
export const pendingTopups = rows => (rows || []).filter(r => r.status === "requested").sort((a, b) => t(a.requested_at) - t(b.requested_at));
export const pendingFills = rows => (rows || []).filter(f => !f.legacy && f.status === "submitted").sort((a, b) => t(a.fill_at) - t(b.fill_at));
export const SOURCE_AR = { auto: "تلقائية", urgent: "مستعجلة", manual: "يدوية" };
// نموذج التحويل: رقم العملية إلزامي، والمبلغ والرسوم أرقام صالحة ⇒ نص خطأ أو null
export function transferFormError({ txn, amount, fee }) {
  if (!String(txn || "").trim()) return "أدخل رقم العملية البنكية.";
  const a = parseNum(amount), f = parseNum(fee);
  if (!(a > 0) || a > 1000) return "المبلغ غير صالح.";
  if (f == null || f < 0 || f > 50) return "الرسوم غير صالحة.";
  return null;
}

// ── المصروفات: صفوف fuel_expenses_monthly (period, category, amount, n) ⇒ مجموع كل فئة + صفوف التفصيل للنطاق ──
// scope: "all" أو "month" مع period = YYYY-MM
const FUEL_TITLE = { "وقود": "فواتير وقود معتمدة", "رسوم بنكية": "رسوم تحويل دفعات الوقود" };
export function fuelExpenses(rows, scope, period) {
  const inScope = (rows || []).filter(r => (scope === "all" || r.period === period) && Number(r.amount));
  const by = {};
  inScope.forEach(r => { by[r.category] = (by[r.category] || 0) + Number(r.amount); });
  return {
    cats: Object.entries(by).map(([label, val]) => ({ label, val: Math.round(val * 100) / 100 })),
    rows: inScope.map(r => ({ date: r.period + "-01", vendor: "—", cat: r.category, title: (FUEL_TITLE[r.category] || r.category) + ` (${r.n})`, amount: Number(r.amount) })),
  };
}
