// إطلاق المنصة للبايكرز — منطق نقي (بلا DOM ولا Supabase): مركز «الدعم والأفكار» ومتتبع الحصر.
// الجداول: support_tickets و relaunch_steps (docs/sql/launch_support.sql).

export const KINDS = [
  { k: "problem", ar: "مشكلة", bn: "সমস্যা", en: "Problem", hint: "زر لا يعمل، بيانات غلط في ملفي", hintBn: "বাটন কাজ করছে না, প্রোফাইলে ভুল তথ্য" },
  { k: "idea", ar: "فكرة", bn: "আইডিয়া", en: "Idea", hint: "تحسين على شاشة أو خطوة عمل", hintBn: "স্ক্রিন বা কাজের ধাপে উন্নতি" },
  { k: "question", ar: "سؤال", bn: "প্রশ্ন", en: "Question", hint: "كيف أسجّل، وش معنى هذا الرقم", hintBn: "কীভাবে নিবন্ধন করব, এই সংখ্যার মানে কী" },
  { k: "request", ar: "طلب", bn: "অনুরোধ", en: "Request", hint: "مواد أو صيانة أو وثيقة — يصل لطلبات الإمداد", hintBn: "উপকরণ, মেরামত বা কাগজপত্র" },
];
export const STATUS = {
  new: { ar: "مستلم", bn: "গৃহীত", tone: "info" },
  in_review: { ar: "قيد الفحص", bn: "পর্যালোচনায়", tone: "warn" },
  done: { ar: "تم التنفيذ", bn: "সম্পন্ন", tone: "ok" },
  wont_do: { ar: "لن يُنفَّذ", bn: "করা হবে না", tone: "bad" },
};
export const OPEN_STATUSES = ["new", "in_review"];
export const MAX_PHOTOS = 3, MIN_BODY = 3, MAX_BODY = 2000;
export const kindOf = k => KINDS.find(x => x.k === k) || { k, ar: k, bn: k, en: k };

// التحقق من نموذج البايكر ← قائمة أخطاء {ar, bn} (فارغة = صالح)
export function validateTicket({ kind, body, photos = [] } = {}) {
  const e = [];
  if (!KINDS.some(x => x.k === kind)) e.push({ f: "kind", ar: "اختر النوع.", bn: "ধরন বেছে নিন।" });
  const n = String(body || "").trim().length;
  if (n < MIN_BODY) e.push({ f: "body", ar: "اكتب الوصف.", bn: "বিবরণ লিখুন।" });
  else if (n > MAX_BODY) e.push({ f: "body", ar: `الوصف أطول من ${MAX_BODY} حرف.`, bn: `বিবরণ ${MAX_BODY} অক্ষরের বেশি।` });
  if (photos.length > MAX_PHOTOS) e.push({ f: "photos", ar: `حتى ${MAX_PHOTOS} لقطات فقط.`, bn: `সর্বোচ্চ ${MAX_PHOTOS}টি স্ক্রিনশট।` });
  return e;
}

// قرار السفير/المالك على طلب ← أخطاء نصية (فارغة = صالح). الإغلاق يحتاج رداً مكتوباً.
export function validateReply({ status, reply } = {}) {
  if (!STATUS[status]) return ["حالة غير معروفة."];
  if ((status === "done" || status === "wont_do") && !String(reply || "").trim()) return ["الإغلاق يحتاج رداً مكتوباً للبايكر (السبب أو ما نُفِّذ)."];
  if (String(reply || "").length > MAX_BODY) return [`الرد أطول من ${MAX_BODY} حرف.`];
  return [];
}

// ملخص الصندوق: المفتوح، والمتأخر عن 24 ساعة بلا رد، وعدد كل حالة
export function inboxSummary(tickets = [], now = Date.now()) {
  const by = Object.fromEntries(Object.keys(STATUS).map(k => [k, 0]));
  let open = 0, overdue = 0;
  tickets.forEach(t => {
    by[t.status] = (by[t.status] || 0) + 1;
    if (OPEN_STATUSES.includes(t.status)) {
      open++;
      if (!t.replied_at && now - new Date(t.created_at).getTime() > 24 * 3600e3) overdue++;
    }
  });
  return { open, overdue, by };
}

// ═══ متتبع الحصر ═══
// الخطوات بالترتيب، والسفير المعتمد لكل خطوة، ومفتاح تبويب البوابة الذي تفتحه
export const STEPS = [
  { k: "profile", ar: "بياناتي", bn: "আমার তথ্য", by: "سلمان", tab: "profile" },
  { k: "docs", ar: "وثائقي", bn: "আমার কাগজপত্র", by: "عمر", tab: "docs" },
  { k: "bike", ar: "الدراجة", bn: "বাইক", by: "سلمان", tab: "handover" },
  { k: "assets", ar: "العهدة", bn: "সরঞ্জাম", by: "سلمان", tab: "assets" },
  { k: "daily", ar: "الاستلام اليومي والوقود", bn: "দৈনিক গ্রহণ ও জ্বালানি", by: "سلمان", tab: "daily" },
  { k: "academy", ar: "الأكاديمية", bn: "একাডেমি", by: "عمر", tab: "academy" },
];
export const STEP_STATUS = {
  none: { ar: "لم يبدأ", bn: "শুরু হয়নি", tone: "" },
  in_progress: { ar: "جارٍ", bn: "চলছে", tone: "info" },
  needs_fix: { ar: "يحتاج تصحيح", bn: "সংশোধন দরকার", tone: "bad" },
  approved: { ar: "معتمد", bn: "অনুমোদিত", tone: "ok" },
};
export const stepOf = k => STEPS.find(s => s.k === k);

// rows: [{employee_id, step, status, note, decided_at}] ← {employee_id: {step: row}}
export function stepMap(rows = []) {
  const m = {};
  rows.forEach(r => { if (stepOf(r.step)) (m[r.employee_id] = m[r.employee_id] || {})[r.step] = r; });
  return m;
}
export const statusAt = (m, emp, step) => ((m[emp] || {})[step] || {}).status || "none";

// تقدّم بايكر واحد: المعتمد، والخطوة الحالية (أول خطوة غير معتمدة)، واكتمال الست
export function bikerProgress(m, emp) {
  const approved = STEPS.filter(s => statusAt(m, emp, s.k) === "approved").length;
  const cur = STEPS.find(s => statusAt(m, emp, s.k) !== "approved") || null;
  return { approved, total: STEPS.length, current: cur ? cur.k : null, complete: !cur };
}

// لكل خطوة: كم بايكر اعتُمدت له، وهل اكتملت عند الجميع (شرط فتح الخطوة التالية للجميع)
export function stepCoverage(m, empIds = []) {
  return STEPS.map(s => {
    const n = empIds.filter(id => statusAt(m, id, s.k) === "approved").length;
    return { k: s.k, approved: n, total: empIds.length, complete: empIds.length > 0 && n === empIds.length };
  });
}

// قرار الاعتماد ← أخطاء (فارغة = صالح): «يحتاج تصحيح» بلا ملاحظة مرفوض
export function validateStep({ status, note } = {}) {
  if (!["in_progress", "approved", "needs_fix"].includes(status)) return ["حالة غير معروفة."];
  if (status === "needs_fix" && !String(note || "").trim()) return ["اكتب ما يحتاج تصحيحاً."];
  if (String(note || "").length > 1000) return ["الملاحظة أطول من 1000 حرف."];
  return [];
}
