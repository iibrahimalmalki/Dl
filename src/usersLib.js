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

// آخر دخول ← {t, tone}. ts غير معروف (undefined) = البيانات غير متاحة بعد
export function lastSeen(ts, now = Date.now()) {
  if (ts === undefined) return null;
  if (!ts) return { t: "لم يدخل بعد", tone: "warn" };
  const min = Math.max(0, Math.floor((now - new Date(ts).getTime()) / 60000));
  if (min < 60) return { t: min < 2 ? "دخل الآن" : `آخر دخول قبل ${min} دقيقة`, tone: "ok" };
  const h = Math.floor(min / 60);
  if (h < 24) return { t: `آخر دخول قبل ${h} ساعة`, tone: "ok" };
  const d = Math.floor(h / 24);
  return { t: d === 1 ? "آخر دخول أمس" : `آخر دخول قبل ${d} يوم`, tone: d > 7 ? "warn" : "" };
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
