// «الجوال» في عُهد البايكر — فحص IMEI والخط والملحقات وبيانات العرض. دوال نقية بلا DOM ولا Supabase.
// الفحص نفسه في القاعدة (docs/sql/custody_phone.sql: _imei_digits و_imei_ok): 15 رقماً + مجموع Luhn،
// والأرقام العربية/الفارسية/البنغالية تُوحَّد إلى لاتينية، والمسافات والشرطات تُحذف.
// التصميم: docs/design/custody_phone.md. الإقرار يحمل phone داخل صنف «phone» في biker_assets.items، والقطعة المعتمدة serial_no + specs.

export const PHONE_KEY = "phone";
export const isDevice = a => !!a && a.item_type === "device";

const DIGITS = { "٠": 0, "١": 1, "٢": 2, "٣": 3, "٤": 4, "٥": 5, "٦": 6, "٧": 7, "٨": 8, "٩": 9,
  "۰": 0, "۱": 1, "۲": 2, "۳": 3, "۴": 4, "۵": 5, "۶": 6, "۷": 7, "۸": 8, "۹": 9,
  "০": 0, "১": 1, "২": 2, "৩": 3, "৪": 4, "৫": 5, "৬": 6, "৭": 7, "৮": 8, "৯": 9 };
export const latinDigits = s => String(s == null ? "" : s).replace(/[٠-٩۰-۹০-৯]/g, d => String(DIGITS[d]));
// مثل _imei_digits: توحيد الأرقام وحذف المسافات والشرطات (حرف غير رقمي يبقى فيُرفض في الفحص)
export const imeiDigits = s => latinDigits(s).replace(/[\s-]/g, "");

// مثل _imei_ok: 15 رقماً، والخانات الزوجية (من اليسار، بدءاً من 1) تُضاعف ويُطرح 9 إن تجاوزت 9
export function imeiOk(s) {
  const p = imeiDigits(s);
  if (!/^[0-9]{15}$/.test(p)) return false;
  let sum = 0;
  for (let i = 1; i <= 15; i++) { const d = +p[i - 1]; sum += i % 2 === 0 ? (d * 2 > 9 ? d * 2 - 9 : d * 2) : d; }
  return sum % 10 === 0;
}

const HINT_AR = "اطلب ⁦*#06#⁩ من الجوال لإظهار الرقم", HINT_BN = "ফোনে ⁦*#06#⁩ ডায়াল করুন — নম্বরটি দেখা যাবে";
export const IMEI_HINT = { ar: HINT_AR, bn: HINT_BN };

// حالة حقل IMEI أثناء الكتابة ⇒ {state: empty|typing|ok|bad, n, ar, bn}
export function imeiStatus(s) {
  const p = imeiDigits(s);
  if (!p) return { state: "empty", n: 0, ar: "", bn: "" };
  if (/[^0-9]/.test(p)) return { state: "bad", n: p.length, ar: "أرقام فقط — بلا حروف أو رموز.", bn: "শুধু সংখ্যা — কোনো অক্ষর বা চিহ্ন নয়।" };
  if (p.length < 15) return { state: "typing", n: p.length, ar: `${p.length} من 15 رقماً`, bn: `15 এর মধ্যে ${p.length}` };
  if (p.length > 15) return { state: "bad", n: p.length, ar: `IMEI يجب أن يكون 15 رقماً (الآن ${p.length}).`, bn: `IMEI অবশ্যই 15 সংখ্যার হতে হবে (এখন ${p.length})।` };
  if (!imeiOk(p)) return { state: "bad", n: 15, ar: `الرقم غير صحيح — تأكد منه: ${HINT_AR}.`, bn: `নম্বরটি সঠিক নয় — আবার দেখুন: ${HINT_BN}।` };
  return { state: "ok", n: 15, ar: "رقم صحيح ✓", bn: "সঠিক নম্বর ✓" };
}

// خطأ IMEI عند الإرسال ⇒ {ar, bn} أو null
export function imeiError(s) {
  const st = imeiStatus(s);
  if (st.state === "ok") return null;
  if (st.state === "empty") return { ar: `IMEI إلزامي — ${HINT_AR}.`, bn: `IMEI বাধ্যতামূলক — ${HINT_BN}।` };
  if (st.state === "typing") return { ar: `IMEI يجب أن يكون 15 رقماً (الآن ${st.n}).`, bn: `IMEI অবশ্যই 15 সংখ্যার হতে হবে (এখন ${st.n})।` };
  return { ar: st.ar, bn: st.bn };
}

// رقم الخط: اختياري، أرقام فقط 9–15 (يُقبل +966 والمسافات)
export const simDigits = s => latinDigits(s).replace(/\D/g, "");
export function simError(s) {
  const d = simDigits(s);
  if (!String(s || "").trim()) return null;
  if (d.length < 9 || d.length > 15) return { ar: "رقم الخط من 9 إلى 15 رقماً — أو اتركه فارغاً.", bn: "সিম নম্বর 9 থেকে 15 সংখ্যা — অথবা খালি রাখুন।" };
  return null;
}
export function brandError(s) {
  const t = String(s || "").trim();
  if (t.length < 2 || t.length > 60) return { ar: "اكتب الماركة والموديل (مثل Samsung A15).", bn: "ব্র্যান্ড ও মডেল লিখুন (যেমন Samsung A15)।" };
  return null;
}

export const blankPhone = () => ({ brand_model: "", imei: "", sim: "", acc: { charger: false, holder: false, case: false }, imeiPhoto: null });
export const ACCESSORIES = [
  { k: "charger", ar: "شاحن", bn: "চার্জার" },
  { k: "holder", ar: "حامل", bn: "হোল্ডার" },
  { k: "case", ar: "كفر", bn: "কভার" },
];

// أول خطأ في بيانات جوال الإقرار ⇒ {field: imei|imei_photo|brand|sim, ar, bn} أو null (ترتيب الحقول في النموذج)
export function phoneError(p = {}, { needImeiPhoto = true } = {}) {
  let e = imeiError(p.imei); if (e) return { field: "imei", ...e };
  if (needImeiPhoto && !p.imeiPhoto) return { field: "imei_photo", ar: "صوّر شاشة IMEI بعد طلب ⁦*#06#⁩ — إلزامي.", bn: "⁦*#06#⁩ ডায়াল করে IMEI স্ক্রিনের ছবি তুলুন — বাধ্যতামূলক।" };
  e = brandError(p.brand_model); if (e) return { field: "brand", ...e };
  e = simError(p.sim); if (e) return { field: "sim", ...e };
  return null;
}

const accOf = a => ({ charger: !!(a && a.charger), holder: !!(a && a.holder), case: !!(a && a.case) });
// phone داخل صنف الإقرار (biker_assets.items[].phone): الـIMEI والخط بأرقام لاتينية
export function phoneItem(p = {}, imeiPhotoUrl = null) {
  const sim = simDigits(p.sim);
  return { brand_model: String(p.brand_model || "").trim(), imei: imeiDigits(p.imei), sim: sim || null, acc: accOf(p.acc), imei_photo: imeiPhotoUrl || null };
}
// specs للقطعة (custody_assets.specs) — نفس القائمة البيضاء في custody_review
export function phoneSpecs(p = {}) {
  const sim = simDigits(p.sim).slice(0, 15);
  const o = { brand_model: String(p.brand_model || "").trim().slice(0, 60) || undefined, sim: sim || undefined, acc: accOf(p.acc) };
  return JSON.parse(JSON.stringify(o));
}

// العرض: آخر 4 أرقام فقط للبايكر وفي القوائم
export const maskImei = s => { const p = imeiDigits(s); return p ? "…" + p.slice(-4) : ""; };
export const accLabels = (a, lang = "ar") => ACCESSORIES.filter(x => a && a[x.k]).map(x => x[lang]);

// رسائل القاعدة (custody_review والقيد والفهرس) ⇒ نص عربي مفهوم، وإلا null
export function imeiServerError(msg) {
  const m = String(msg || "");
  if (/IMEI_DUPLICATE|custody_assets_active_device_serial|duplicate key/.test(m)) return "هذا الـIMEI مسجّل لجهاز نشط آخر — تأكد من الرقم أو استبدل الجهاز القديم أولاً.";
  if (/IMEI_MISMATCH/.test(m)) return "الـIMEI المُقَرّ لا يطابق الجهاز المسجَّل لهذا البايكر — ارفض الإقرار بالسبب ليصحّحه.";
  if (/IMEI_INVALID|custody_assets_device_imei_ck/.test(m)) return "IMEI الجوال ناقص أو غير صحيح (15 رقماً) — الجهاز لا يُحفظ بدونه.";
  return null;
}
