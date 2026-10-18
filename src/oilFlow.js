// مسار تغيير الزيت كما يجري فعلاً — منطق نقي بلا DOM ولا Supabase.
// القاعدة: docs/sql/oil_flow.sql. البايكر يرفع الطلب في تطبيق سويتر ثم في البوابة (لقطة الطلب + العدّاد وصورته)،
// ثم يحدّث التنفيذ (لقطة التنفيذ من سويتر + العدّاد وصورته). الإدارة تراجع الصور فتعتمد أو ترفض بسبب، وتضيف نيابة عن البايكر، وتلغي بسبب.
import { parseNum } from "./fleetRequests.js";

const t = v => (v ? new Date(v).getTime() : 0);
// الطلب المفتوح: requested، أو sent القديم (قبل إلغاء خطوة «أُرسل لسويتر») — كلاهما «قيد المتابعة مع سويتر»
export const isFollowing = r => !!r && (r.status === "requested" || r.status === "sent");

// للبوابة: الطلب المفتوح، وما ينتظر المراجعة، والسجل بلا الملغى
export function bikerOil(rows) {
  const r = (rows || []).filter(x => x.status !== "cancelled").sort((a, b) => t(b.requested_at) - t(a.requested_at));
  return { open: r.find(isFollowing) || null, review: r.find(x => x.status === "done") || null, list: r };
}

// للإدارة: قيد المتابعة (الأقدم أولاً)، بانتظار المراجعة (الأقدم أولاً)، المعتمدة والملغاة (الأحدث أولاً)
export function splitOilAdmin(rows) {
  const r = rows || [];
  const asc = (a, b) => t(a.requested_at) - t(b.requested_at);
  return {
    follow: r.filter(isFollowing).sort(asc),
    review: r.filter(x => x.status === "done").sort((a, b) => t(a.done_at) - t(b.done_at)),
    approved: r.filter(x => x.status === "approved").sort((a, b) => t(b.done_at || b.approved_at) - t(a.done_at || a.approved_at)),
    cancelled: r.filter(x => x.status === "cancelled").sort((a, b) => t(b.cancelled_at) - t(a.cancelled_at)),
  };
}

// «نفس الدقيقة» كما تفرضها confirm_oil_change: الدقيقة الحالية لا تتجاوز دقيقة رفع الطلب
export const sameMinute = (requestedAt, now = Date.now()) => Math.floor(t(now) / 60000) <= Math.floor(t(requestedAt) / 60000);

// المسافة والأيام منذ آخر تغيير معتمد (محفوظة لحظة الطلب) ⇒ {km, days, interval, early} أو null بلا تغيير سابق
export function sinceLast(r) {
  if (!r || r.since_km == null) return null;
  const km = Number(r.since_km), days = r.since_days == null ? null : Number(r.since_days), interval = r.interval_km == null ? null : Number(r.interval_km);
  return { km, days, interval, early: interval != null && km < interval };
}
export const sinceAr = r => {
  const s = sinceLast(r);
  return s ? `${s.km} كم و${s.days ?? "—"} يوم منذ آخر تغيير معتمد` : "لا تغيير معتمد سابق";
};

// ── تحقق نماذج البوابة ⇒ {field, ar, bn} أو null ──
const NEED = {
  odometer: { ar: "أدخل قراءة العدّاد.", bn: "ওডোমিটার লিখুন।" },
  odoPhoto: { ar: "التقط صورة العدّاد.", bn: "ওডোমিটারের ছবি তুলুন।" },
  shot: { ar: "ارفع لقطة شاشة طلب تغيير الزيت من تطبيق سويتر.", bn: "সুইটার অ্যাপে তেল পরিবর্তনের অনুরোধের স্ক্রিনশট দিন।" },
  execShot: { ar: "ارفع لقطة من تطبيق سويتر تثبت التنفيذ.", bn: "কাজ সম্পন্নের প্রমাণ হিসেবে সুইটার অ্যাপের স্ক্রিনশট দিন।" },
};
const need = field => ({ field, ...NEED[field] });
export function oilRequestFormError({ odometer, odoPhoto, shot }) {
  if (!shot) return need("shot");
  if (parseNum(odometer) == null) return need("odometer");
  if (!odoPhoto) return need("odoPhoto");
  return null;
}
export function oilExecFormError({ odometer, odoPhoto, shot }, req, now = Date.now()) {
  if (req && sameMinute(req.requested_at, now)) return { field: "form", ar: "انتظر دقيقة بعد رفع الطلب ثم حدّث التنفيذ.", bn: "অনুরোধের পর এক মিনিট অপেক্ষা করে আপডেট দিন।" };
  if (!shot) return need("execShot");
  const n = parseNum(odometer);
  if (n == null) return need("odometer");
  if (req && req.odometer != null && n < Number(req.odometer)) return { field: "odometer", ar: `العدّاد أقل من عدّاد الطلب (${req.odometer}).`, bn: `ওডোমিটার অনুরোধের রিডিং (${req.odometer}) থেকে কম।` };
  if (!odoPhoto) return need("odoPhoto");
  return null;
}

// ── نموذج «إضافة» في الإدارة ⇒ نص عربي أو null ──
export function addOilFormError({ vehicle, odometer, odoPhoto, at, done }, now = Date.now()) {
  if (!vehicle) return "اختر الدراجة.";
  if (parseNum(odometer) == null) return "أدخل قراءة العدّاد.";
  if (!odoPhoto) return "أرفق صورة العدّاد.";
  const d = at ? t(at) : now;
  if (isNaN(d) || d > now + 3600e3) return done ? "تاريخ التنفيذ في المستقبل." : "تاريخ الطلب في المستقبل.";
  if (d < now - 400 * 864e5) return "التاريخ أقدم من 400 يوم.";
  return null;
}
