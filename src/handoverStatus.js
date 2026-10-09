// حالة مراجعة تسجيل استلام/تسليم الدراجة (منطق نقي، بلا DOM ولا Supabase).
// الأعمدة الموجودة: status (نص حر، الافتراضي 'submitted'؛ وتوجد 'baseline' للاستلام الافتتاحي)، reviewed_by، reviewed_at.
// «يحتاج تصحيح»: status='needs_fix' والسبب ووقته ومن أرجعه في checklist.fix = {reason, at, by, by_name}.
// إعادة التسجيل: السجل الجديد يحمل checklist.redo_of = معرّف السجل المُرجَع.

export const MIN_FIX_REASON = 5;
export const STATES = {
  pending: { ar: "بانتظار المراجعة", bn: "পর্যালোচনার অপেক্ষায়", tone: "warn" },
  reviewed: { ar: "تمت المراجعة", bn: "পর্যালোচনা হয়েছে", tone: "ok" },
  needs_fix: { ar: "يحتاج تصحيح", bn: "সংশোধন দরকার", tone: "bad" },
};
export const STATE_KEYS = Object.keys(STATES);

export function handoverState(row) {
  if (!row) return "pending";
  if (row.status === "needs_fix") return "needs_fix";
  if (row.reviewed_at || row.status === "reviewed") return "reviewed";
  return "pending";
}
export const fixInfo = row => { const f = ((row && row.checklist) || {}).fix; return f && f.reason ? f : null; };
export const redoOf = row => (((row && row.checklist) || {}).redo_of) || null;

// سبب الإرجاع → رسالة خطأ أو null
export function validateFixReason(s) {
  const t = String(s || "").trim();
  if (t.length < MIN_FIX_REASON) return `اكتب سبب الإرجاع (${MIN_FIX_REASON} أحرف على الأقل)، مثل: صورة الضرر 3 غير واضحة.`;
  if (t.length > 500) return "السبب أطول من 500 حرف.";
  return null;
}
// تعديل السجل عند «يحتاج تصحيح» (يحفظ بقية checklist كما هي، ويلغي أي مراجعة سابقة)
export const fixPatch = (row, reason, by, byName, now = new Date().toISOString()) => ({
  status: "needs_fix", reviewed_by: null, reviewed_at: null,
  checklist: { ...((row && row.checklist) || {}), fix: { reason: String(reason || "").trim(), at: now, by: by || null, by_name: byName || null } },
});
// «تمت المراجعة»: status='reviewed' (سجل الإرجاع السابق يبقى في checklist.fix للتاريخ)
export const approvePatch = (by, now = new Date().toISOString()) => ({ status: "reviewed", reviewed_by: by || null, reviewed_at: now });

// آخر تسجيل للبايكر (rows أي ترتيب)
export const latestRow = rows => (rows || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;
// هل أُعيد تسجيل هذا السجل؟ (يوجد سجل أحدث يشير إليه)
export const redoneBy = (row, rows) => (rows || []).find(r => redoOf(r) === row.id) || null;

// فلترة سجل الإدارة: "" = الكل، أو أحد مفاتيح STATES
export const filterByState = (rows, st) => (rows || []).filter(r => !st || handoverState(r) === st);
export const countByState = rows => Object.fromEntries(STATE_KEYS.map(k => [k, filterByState(rows, k).length]));

// نص الإشعار للبايكر (عربي ثم بنغالي) — يطابق ما يكتبه مشغّل SQL
export const fixNoticeText = reason => ({
  title: "تسجيل استلام الدراجة يحتاج تصحيح · বাইক গ্রহণ রেকর্ড সংশোধন দরকার",
  body: `تسجيل استلام الدراجة يحتاج تصحيح: ${String(reason || "").trim()}\nবাইক গ্রহণ রেকর্ড সংশোধন দরকার: ${String(reason || "").trim()}`,
});
