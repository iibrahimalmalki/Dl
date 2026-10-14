// صفحة «المستخدمون» — منطق نقي (بلا DOM ولا Supabase): الجوال المقروء، وآخر دخول، والنوع، وملخص الصلاحيات، والفلترة.
import { POS_BY_KEY } from "./orgRoles";

// أرقام الجوال من الحقل mobile أو من اسم المستخدم التقني (966…@dalu.team) ← صيغة مقروءة
export function phoneOf(u = {}) {
  let d = String(u.mobile || "").replace(/\D/g, "");
  if (!d) { const m = /^(\d{9,15})@/.exec(String(u.email || "")); if (m) d = m[1]; }
  if (!d) return "";
  if (/^9665\d{8}$/.test(d)) d = "0" + d.slice(3);
  if (/^05\d{8}$/.test(d)) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  if (/^880\d{10}$/.test(d)) return `+880 ${d.slice(3, 7)} ${d.slice(7)}`;
  return d;
}
// اسم المستخدم تقني (مولَّد من الجوال) — يُخفى في البطاقة ويظهر في التفاصيل
export const isTechEmail = e => /^(\d{9,15}|dw[0-9a-z]+)@dalu\.team$/i.test(String(e || ""));

export function kindOf(u = {}) {
  if (u.is_owner) return "owner";
  if (u.biker_employee_id) return "biker";
  return "admin";
}

// الدور الظاهر تحت الاسم
export function roleLabel(u = {}) {
  if (u.is_owner) return "المالك · صلاحية كاملة";
  if (u.biker_employee_id) return "بايكر · رقم " + u.biker_employee_id;
  const p = POS_BY_KEY[u.position];
  return p ? p.ar : "إداري — بلا منصب محدد";
}

// rows: [{user_id, can_edit}] ← {user_id: {edit, view}} (view = عرض فقط)
export function permSummary(rows = []) {
  const m = {};
  rows.forEach(r => { const s = (m[r.user_id] = m[r.user_id] || { edit: 0, view: 0 }); r.can_edit ? s.edit++ : s.view++; });
  return m;
}
export function permText(s) {
  if (!s || (!s.edit && !s.view)) return "بلا صلاحيات";
  return [s.edit && `تعديل ${s.edit}`, s.view && `عرض ${s.view}`].filter(Boolean).join(" · ") + " وحدات";
}

// «منذ متى» بصيغة الصفحة: الآن / قبل N دقيقة / ساعة / أمس / قبل N يوم ← {ago, days}
function since(ts, now) {
  const min = Math.max(0, Math.floor((now - new Date(ts).getTime()) / 60000));
  if (min < 60) return { ago: min < 2 ? "الآن" : `قبل ${min} دقيقة`, days: 0 };
  const h = Math.floor(min / 60);
  if (h < 24) return { ago: `قبل ${h} ساعة`, days: 0 };
  const d = Math.floor(h / 24);
  return { ago: d === 1 ? "أمس" : `قبل ${d} يوم`, days: d };
}

// آخر دخول ← {t, tone}. ts غير معروف (undefined) = البيانات غير متاحة بعد
export function lastSeen(ts, now = Date.now()) {
  if (ts === undefined) return null;
  if (!ts) return { t: "لم يدخل بعد", tone: "warn" };
  const s = since(ts, now);
  if (s.ago === "الآن") return { t: "دخل الآن", tone: "ok" };
  return { t: `آخر دخول ${s.ago}`, tone: s.days === 0 ? "ok" : s.days > 7 ? "warn" : "" };
}

// آخر نشاط (أحدث تجديد لجلسة في auth.sessions — admin_users_activity_ex) ← {t, tone}. undefined = غير متاح بعد
export function lastActive(ts, now = Date.now()) {
  if (ts === undefined) return null;
  if (!ts) return { t: "لا جلسة نشطة", tone: "" }; // خرج أو لم يدخل بعد — ليس تنبيهاً بذاته («لم يدخل بعد» ينبّه في سطر الدخول)
  const s = since(ts, now);
  return { t: `آخر نشاط ${s.ago}`, tone: s.days > 7 ? "warn" : s.days === 0 ? "ok" : "" };
}

// آخر تسجيل للبايكر في البوابة (أحدث ما سجّله بنفسه) ← {t, tone}. undefined = غير متاح بعد
export const PORTAL_KIND = { bike_receive: "استلام دراجة", bike_return: "تسليم دراجة", custody: "إقرار عهدة", custody_update: "تحديث حالة عهدة", fuel: "طلب وقود", support: "دعم",
  fuel_fill: "تعبئة وقود", oil: "تغيير زيت", daily: "استلام يومي" };
export function portalLast(ts, kind, now = Date.now()) {
  if (ts === undefined) return null;
  if (!ts) return { t: "آخر تسجيل في البوابة: لا شيء بعد", tone: "warn" };
  const s = since(ts, now);
  return { t: `آخر تسجيل في البوابة: ${PORTAL_KIND[kind] || "نشاط"} ${s.ago}`, tone: s.days > 7 ? "warn" : "" };
}

export const FILTERS = [
  { k: "all", ar: "الكل" }, { k: "admin", ar: "الإدارة" }, { k: "biker", ar: "البايكرز" },
  { k: "never", ar: "لم يدخل بعد" }, { k: "off", ar: "موقوفون" },
];
// act: {user_id: last_sign_in_at|null} أو null إن لم تتوفر
export function matches(u, f, act) {
  if (f === "all") return true;
  if (f === "off") return !u.is_owner && !u.active;
  if (f === "never") return !!act && act[u.id] === null;
  if (f === "admin") return kindOf(u) !== "biker";
  return kindOf(u) === f;
}
export function filterUsers(users = [], f = "all", q = "", act = null) {
  const s = String(q).trim().toLowerCase(), sd = s.replace(/\D/g, "");
  return users.filter(u => matches(u, f, act) && (!s
    || [u.display_name, u.email, u.biker_employee_id, roleLabel(u)].some(x => String(x || "").toLowerCase().includes(s))
    || (sd.length >= 3 && phoneOf(u).replace(/\D/g, "").includes(sd))));
}
export function counts(users = [], act = null) {
  return Object.fromEntries(FILTERS.map(x => [x.k, users.filter(u => matches(u, x.k, act)).length]));
}

// الحذف النهائي مسموح فقط لحساب لم يُستخدم (إن عُرف آخر دخول). غير ذلك ⇒ الإيقاف.
export const canHardDelete = (u, act) => !u.is_owner && (!act || act[u.id] === null);
// تأكيد الحذف بكتابة الاسم كما هو (تُتجاهل المسافات الزائدة وحالة الأحرف)
export const confirmName = (u, typed) => {
  const n = s => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
  return !!n(typed) && n(typed) === n(u.display_name || u.email);
};
