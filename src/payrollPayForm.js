// نموذج «تسجيل الدفع» في صفحة المسير (للمالك) — يستدعي record_payroll_payment (docs/sql/payroll_record_payment.sql).
// دوال نقية بلا DOM ولا Supabase: القيم الابتدائية، والتحقق (مرآة لقواعد الدالة حتى تظهر الأخطاء قبل الإرسال)، ووسائط الاستدعاء، والملخص.
// القاعدة هي المرجع: أي رفض منها يُعرض كما هو.

export const PAY_ST = [
  { v: "paid", ar: "مدفوعة" },
  { v: "deferred", ar: "مؤجَّلة" },
  { v: "pending", ar: "بانتظار الدفع" },
];
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
export const capOf = line => r2(Math.max(Number(line && line.net_bonus) || 0, 0));
export const periodStart = period => String(period || "").slice(0, 7) + "-01";

// القيم الابتدائية من السطر المحفوظ؛ غير المدفوع ⇒ المبلغ = المكافأة والتاريخ = اليوم
export function payFormInit(line = {}, today = "") {
  const paid = line.payment_status === "paid";
  return {
    status: line.payment_status || "pending",
    // مدفوع بلا تاريخ مسجّل (عابد: ترحيل يوليو) ⇒ فارغ لا «اليوم» — لا يُسجَّل تاريخ لم يُدخله أحد
    paid_at: paid ? (line.paid_at ? String(line.paid_at).slice(0, 10) : "") : today,
    amount: paid && line.paid_amount != null ? String(line.paid_amount) : String(capOf(line)),
    ref: line.payment_ref || "",
    fee: paid && Number(line.bank_fee) ? String(line.bank_fee) : "0",
    note: line.pay_note || "",
    base: line.base_paid === true ? "yes" : line.base_paid === false ? "no" : "",
    base_at: line.base_paid_at ? String(line.base_paid_at).slice(0, 10) : "",
  };
}

// تغيير الحالة: ملاحظة السطر السابقة (سبب التأجيل مثلاً) لا تنتقل إلى الحالة الجديدة ما لم يعدّلها المالك
export function statusPatch(f = {}, line = {}, status) {
  const old = String(line.pay_note || "").trim(), cur = String(f.note || "").trim();
  if (cur && cur !== old) return { status, note: f.note };   // عدّلها المالك ⇒ تبقى
  return { status, note: status === (line.payment_status || "pending") ? line.pay_note || "" : "" };
}

// أرقام عربية، والفاصلة العشرية العربية «٫»، وفواصل الآلاف («٬» و«,») تُحذف
const num = s => { const t = String(s == null ? "" : s).trim().replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/٫/g, ".").replace(/[٬,\s]/g, ""); return t === "" ? null : Number(t); };

// أول خطأ ⇒ {field, ar} أو null — نفس قواعد record_payroll_payment
export function payFormError(f = {}, line = {}, { period = line.period, today = "" } = {}) {
  const start = periodStart(period), cap = capOf(line), note = String(f.note || "").trim();
  if (f.status === "paid") {
    if (!f.paid_at) return { field: "paid_at", ar: "تاريخ الدفع إلزامي." };
    if (f.paid_at < start || (today && f.paid_at > today)) return { field: "paid_at", ar: `تاريخ الدفع بين ${start} و${today}.` };
    const a = num(f.amount);
    if (a == null) return { field: "amount", ar: "المبلغ المدفوع إلزامي." };
    if (isNaN(a)) return { field: "amount", ar: "المبلغ ليس رقماً صحيحاً." };
    if (r2(a) < 0 || r2(a) > cap) return { field: "amount", ar: `المبلغ بين 0 و${cap.toFixed(2)} (المكافأة الصافية).` };
    if (r2(a) === 0 && cap > 0) return { field: "amount", ar: "المبلغ صفر والمكافأة موجبة — اختر «مؤجَّلة» أو «بانتظار الدفع»." };
    if (r2(a) < cap && !note) return { field: "note", ar: `دفع جزئي (${r2(a).toFixed(2)} من ${cap.toFixed(2)}) — اكتب السبب في الملاحظة.` };
    const fee = num(f.fee);
    if (fee != null && (isNaN(fee) || fee < 0 || fee > 50)) return { field: "fee", ar: "رسوم الحوالة بين 0 و50." };
    if (String(f.ref || "").trim().length > 40) return { field: "ref", ar: "مرجع الحوالة أطول من 40 حرفاً." };
  } else if (f.status === "deferred") {
    if (!note) return { field: "note", ar: "سبب التأجيل إلزامي في الملاحظة." };
  } else if (f.status === "pending") {
    if (line.payment_status && line.payment_status !== "pending" && !note)
      return { field: "note", ar: "التراجع إلى «بانتظار الدفع» يحتاج سبباً في الملاحظة." };
  } else return { field: "status", ar: "اختر حالة الدفع." };
  if (f.base_at && f.base !== "yes") return { field: "base_at", ar: "تاريخ صرف الأساس مع «الأساس مدفوع» فقط." };
  if (f.base === "yes" && f.base_at && (f.base_at < start || (today && f.base_at > today))) return { field: "base_at", ar: `تاريخ صرف الأساس بين ${start} و${today}.` };
  // الدالة تُبقي التاريخ المسجّل إن أُرسل فارغاً مع «مدفوع»؛ المسح = «غير مدفوع» ثم «مدفوع» بلا تاريخ
  if (f.base === "yes" && !f.base_at && line.base_paid_at) return { field: "base_at", ar: "لمسح تاريخ الأساس: سجّل «غير مدفوع» أولاً ثم «مدفوع» بلا تاريخ." };
  return null;
}

// وسائط supabase.rpc("record_payroll_payment", …): القيم صريحة دائماً ('' يمسح المرجع/الملاحظة)، والأساس null = بلا تغيير
export function payArgs(f = {}, line = {}) {
  const paid = f.status === "paid", fee = num(f.fee);
  return {
    p_line: line.id, p_status: f.status,
    p_paid_at: paid ? f.paid_at || null : null,
    p_amount: paid ? r2(num(f.amount)) : null,
    p_ref: paid ? String(f.ref || "").trim() : null,
    p_fee: paid ? (fee == null ? 0 : fee) : null,
    p_note: String(f.note || "").trim(),
    p_base_paid: f.base === "yes" ? true : f.base === "no" ? false : null,
    p_base_paid_at: f.base === "yes" && f.base_at ? f.base_at : null,
  };
}

// ملخص المسير المعتمد: المستحق والمدفوع والمؤجَّل والمعلّق والرسوم وعدد الأسطر لكل حالة،
// وshort = المتبقي من الدفعات الجزئية (سطر «مدفوع» بأقل من مكافأته — حالة المسير تعدّه مدفوعاً)
export function payTotals(lines = []) {
  const t = { due: 0, paid: 0, deferred: 0, pending: 0, short: 0, fees: 0, n: { paid: 0, deferred: 0, pending: 0, short: 0 } };
  (lines || []).forEach(l => {
    const cap = capOf(l), st = l.payment_status || "pending";
    t.due += cap; t.n[st] = (t.n[st] || 0) + 1;
    if (st === "paid") { const a = Number(l.paid_amount) || 0; t.paid += a; t.fees += Number(l.bank_fee) || 0; if (a < cap) { t.short += cap - a; t.n.short++; } }
    else if (st === "deferred") t.deferred += cap; else t.pending += cap;
  });
  for (const k of ["due", "paid", "deferred", "pending", "short", "fees"]) t[k] = r2(t[k]);
  return t;
}

// «تسجيل دفع للكل»: حوالة واحدة (تاريخ ومرجع واحد) لعدة أسطر — كل سطر بمكافأته كاملة عبر الدالة نفسها.
// b: {ids, paid_at, ref, fee, note} · الرسوم تُسجَّل مرة واحدة على أول سطر (حوالة واحدة)، والبقية null = بلا تغيير/0
export const bulkTotal = (lines = [], ids = []) => r2((lines || []).filter(l => ids.includes(l.id)).reduce((a, l) => a + capOf(l), 0));
export function bulkError(b = {}, lines = [], { period, today = "" } = {}) {
  const sel = (lines || []).filter(l => (b.ids || []).includes(l.id));
  if (!sel.length) return { field: "ids", ar: "حدّد سطراً واحداً على الأقل." };
  const start = periodStart(period || (sel[0] && sel[0].period));
  if (!b.paid_at) return { field: "paid_at", ar: "تاريخ الحوالة إلزامي." };
  if (b.paid_at < start || (today && b.paid_at > today)) return { field: "paid_at", ar: `تاريخ الحوالة بين ${start} و${today}.` };
  const fee = num(b.fee);
  if (fee != null && (isNaN(fee) || fee < 0 || fee > 50)) return { field: "fee", ar: "رسوم الحوالة بين 0 و50." };
  if (String(b.ref || "").trim().length > 40) return { field: "ref", ar: "مرجع الحوالة أطول من 40 حرفاً." };
  return null;
}
export function bulkArgs(b = {}, lines = []) {
  const fee = num(b.fee), note = String(b.note || "").trim(), ref = String(b.ref || "").trim();
  return (lines || []).filter(l => (b.ids || []).includes(l.id)).map((l, i) => ({
    p_line: l.id, p_status: "paid", p_paid_at: b.paid_at, p_amount: capOf(l),
    // المرجع الفارغ لا يمسح مرجعاً مسجّلاً (null = بلا تغيير)، والملاحظة الفارغة كذلك (تبقى ملاحظة الترحيل مثلاً)
    p_ref: ref || null, p_fee: i === 0 ? (fee == null ? 0 : fee) : null, p_note: note || null,
    p_base_paid: null, p_base_paid_at: null,
  }));
}
