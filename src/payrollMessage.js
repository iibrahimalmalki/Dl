// رسالة الواتساب لسطر المسير (البند 17 من docs/design/payroll_pipeline.md). دالة نقية بلا DOM ولا Supabase.
// النموذج المعتمد من المالك (2026-10-14) حرفياً: عربي + English + বাংলা في رسالة واحدة، وسطر التحويل بعد Net Bonus.
// أرقام إنجليزية في كل الأسطر (البنغالي أيضاً: 2026 لا ২০২৬). سطر Production فقط إن كانت مكافأة الإنتاج > 0، والإكراميات دائماً.
// «كلمة من الإدارة» نص حر بثلاث لغات يكتبه المالك قبل النسخ. لا مقارنة بأي بايكر آخر (القاعدة 6). المشرف: رسالة عربية مستقلة.

// (نسخة صغيرة من latinDigits في complaintsReport.js/custodyPhone.js: الاستيراد منهما ينشئ حزمة مشتركة بين حزم كسولة)
const DIG = { "٠": 0, "١": 1, "٢": 2, "٣": 3, "٤": 4, "٥": 5, "٦": 6, "٧": 7, "٨": 8, "٩": 9, "۰": 0, "۱": 1, "۲": 2, "۳": 3, "۴": 4, "۵": 5, "۶": 6, "۷": 7, "۸": 8, "۹": 9, "০": 0, "১": 1, "২": 2, "৩": 3, "৪": 4, "৫": 5, "৬": 6, "৭": 7, "৮": 8, "৯": 9 };
const latin = s => String(s == null ? "" : s).replace(/[٠-٩۰-۹০-৯]/g, d => String(DIG[d]));
const n2 = v => (Math.round((Number(v) || 0) * 100) / 100).toFixed(2);
const int = v => String(Math.round(Number(v) || 0));
export const last4 = ref => { const d = latin(ref).replace(/\s/g, ""); return d ? "…" + d.slice(-4) : ""; };
// نسبة الشكاوى: تقريب عادي (كتقرير الشكاوى: 2.1052 ⇒ 2.11) إلا إذا عبر التقريب حدّ شريحة السلامة (payrollEngine: ≥1 · ≥1.5 · ≥2 · >3)،
// فيُعرض على جانب الشريحة التي حُسب بها المسير فعلاً (1.996 ⇒ 1.99 لا 2.00، و3.004 ⇒ 3.01 لا 3.00)
export const pct2 = v => {
  const x = Number(v) || 0, r = Math.round(x * 100) / 100;
  if ([1, 1.5, 2].some(b => x < b && r >= b)) return (Math.floor(x * 100 + 1e-9) / 100).toFixed(2);
  if (x > 3 && r <= 3) return (Math.ceil(x * 100 - 1e-9) / 100).toFixed(2);
  return r.toFixed(2);
};

const MONTHS = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  bn: ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"],
};
export const monthOnly = (period, lang = "ar") => (MONTHS[lang] || MONTHS.ar)[+String(period || "").split("-")[1] - 1] || "";
export const monthName = (period, lang = "ar") => `${monthOnly(period, lang)} ${String(period || "").split("-")[0] || ""}`.trim();

// أسماء العرض من ملف الموظف (employees.name_ar / name_bn / name_en — docs/sql/employee_display_names.sql و employee_name_en.sql)،
// تمرَّر في names = {ar, bn, en}. الفارغ ⇒ الاسم الأول من الاسم المسجّل (full_name / سطر المسير).
export function displayName(line = {}, lang = "ar", names = {}) {
  const own = String((names && names[lang]) || "").trim();
  if (own) return own;
  const full = String(line.name || "").trim();
  return full.split(/\s+/)[0] || full;
}

// أرقام السطر من computed (ما حُسب به المسير فعلاً) مع inputs احتياطاً
export function lineFacts(line = {}, complaints = null) {
  const c = line.computed || {}, i = line.inputs || {};
  const rate = Number(c.rate_per_wash) || 0, q = Number(c.quality_riyal) || 0, s = Number(c.safety_riyal) || 0;
  const counted = c.complaint_approved ?? i.complaint_approved;
  return {
    washes: Number(c.net_washes ?? i.net_washes) || 0, rating: c.rating ?? i.rating,
    filed: complaints && complaints.raised != null ? complaints.raised : null,
    accepted: counted === "" || counted == null ? (complaints ? complaints.counted : null) : Number(counted),
    rejected: complaints && complaints.rejected != null ? complaints.rejected : null,
    pct: c.complaint_pct,
    baseRate: Math.round((rate - q - s) * 100) / 100, quality: q, safety: s, rate,
    washBonus: Number(c.bonus_base) || Math.round((Number(c.net_washes) || 0) * rate * 100) / 100,
    production: Number(c.production) || 0, tips: Number(c.tips ?? i.tips) || 0, deductions: Number(c.deductions) || 0,
    net: Number(line.net_bonus) || 0,
    paid: line.payment_status === "paid", paidAmount: line.paid_amount, paidAt: line.paid_at ? String(line.paid_at).slice(0, 10) : null, ref: last4(line.payment_ref),
  };
}

const SEP = "━━━━━━━━━━━━━━━━━━━━", RULE = "   ─────────────────────";
const v = x => (x == null || x === "" ? "—" : x);

// notes: {ar, en, bn} — «كلمة من الإدارة»؛ لغة فارغة لا يظهر سطرها، والثلاث فارغة ⇒ لا قسم
function bikerText(line, f, notes = {}, names = {}) {
  const p = line.period, y = String(p || "").split("-")[0] || "";
  const mAr = monthOnly(p, "ar"), mEn = monthOnly(p, "en"), mBn = monthOnly(p, "bn");
  const L = [
    `🟠 *دلو ورغوة × سويتر | ${mAr} ${y}*`,
    `Bucket & Foam × Sweater | ${mEn} ${y}`,
    `ডালু ওয়ারগওয়া × সুইটার | ${mBn} ${y}`,
    "",
    `السلام عليكم أخ *${displayName(line, "ar", names)}* 👋`,
    `Assalamu Alaikum, Brother *${displayName(line, "en", names)}*`,
    `আস-সালামু আলাইকুম, ভাই *${displayName(line, "bn", names)}*`,
    "",
    SEP,
    `✅ *تم صرف مكافأة ${mAr}*`,
    `✅ *${mEn} Bonus Has Been Paid*`,
    `✅ *${mBn} মাসের বোনাস পরিশোধ হয়েছে*`,
    SEP,
    "",
    "📊 *تفاصيل الأداء | Performance Details*",
    "",
    "🔹 الغسلات الصافية | Net Washes",
    `        *${int(f.washes)} washes*`,
    "",
    "⭐ التقييم | Rating",
    `        *${f.rating == null || f.rating === "" ? "—" : n2(f.rating)} / 5*`,
    "",
    SEP,
    "🚨 *تفاصيل الشكاوى | Complaint Details*",
    "",
    `   • مرفوعة | Filed:  *${v(f.filed)}*`,
    `   • محسوبة عليك | Accepted:  *${v(f.accepted)}*`,
    `   • مرفوضة لصالحك | Rejected:  *${v(f.rejected)}* 🎯`,
    "",
    `   ➡️ نسبة الشكاوى | Complaint rate: *${f.pct == null ? "—" : pct2(f.pct)}%*`,
    SEP,
    "",
    "💰 *تفاصيل المكافأة | Bonus Breakdown*",
    "",
    `   Base rate:         ${n2(f.baseRate)}`,
    `   Quality riyal:    +${n2(f.quality)}`,
    `   Safety riyal:     +${n2(f.safety)}`,
    RULE,
    `   Rate / wash:      ${n2(f.rate)} SAR`,
    `   ${int(f.washes)} × ${n2(f.rate)}     =  ${n2(f.washBonus)}`,
  ];
  if (f.production > 0) L.push(`   Production:      + ${n2(f.production)} 🏆`);
  // الاستقطاعات (قرار المالك 2026-10-14): بعد Production وعند > 0 فقط، حتى يساوي مجموع البنود صافي المكافأة
  if (f.deductions > 0) L.push(`   Deductions:      − ${n2(f.deductions)}`);
  L.push(`   Tips:            + ${n2(f.tips)}`, RULE, `💵 *Net Bonus: ${n2(f.net)} SAR*`);
  if (f.paid && f.paidAmount != null)
    L.push(`💳 تم التحويل | Transferred: *${n2(f.paidAmount)} SAR*${f.paidAt ? ` · ${f.paidAt}` : ""}${f.ref ? ` · Ref ${f.ref}` : ""}`);
  L.push(SEP);
  const ar = String(notes.ar || "").trim(), enN = String(notes.en || "").trim(), bn = String(notes.bn || "").trim();
  if (ar || enN || bn) {
    L.push("");
    if (ar) L.push("🏆 *كلمة من الإدارة:*", ar);
    if (enN) { if (ar) L.push(""); L.push(`*Management:* ${enN} 💪`); }
    if (bn) { if (ar || enN) L.push(""); L.push(`*ম্যানেজমেন্ট:* ${bn} 💪`); }
    L.push(SEP);
  }
  L.push("🏢 مؤسسة دلو ورغوة | Dalu Warghwah Est.", `📅 ${mAr} ${y} | ${mEn} ${y}`);
  return latin(L.join("\n"));
}

// المشرف: عربي فقط — أرقام الفريق من computed (خارج النموذج المعتمد للبايكر)
function supervisorText(line, note) {
  const c = line.computed || {}, L = [];
  L.push(`السلام عليكم ${String(line.name || "").trim()} 👋`, `مسير ${monthName(line.period, "ar")} — دلو ورغوة (المشرف)`, "");
  if (c.team_orders != null) L.push(`🧽 طلبات الفريق: ${int(c.team_orders)}`);
  if (c.team_rating != null) L.push(`⭐ متوسط تقييم الفريق: ${n2(c.team_rating)}`);
  if (c.team_complaint_pct != null) L.push(`📋 نسبة شكاوى الفريق: ${pct2(c.team_complaint_pct)}%`);
  if (c.rate_per_order != null) L.push(`💵 المعدل لكل طلب: ${n2(c.rate_per_order)}`);
  if (Number(c.deductions)) L.push(`➖ الاستقطاعات: −${n2(c.deductions)}`);
  L.push(`✅ العمولة: ${n2(line.net_bonus)} ريال`);
  if (line.payment_status === "paid" && line.paid_amount != null)
    L.push("", `💳 تم التحويل: ${n2(line.paid_amount)} ريال${line.paid_at ? ` بتاريخ ${String(line.paid_at).slice(0, 10)}` : ""}${line.payment_ref ? ` — المرجع ${last4(line.payment_ref)}` : ""}`);
  else if (line.payment_status === "deferred") L.push("", "⏳ العمولة مؤجَّلة");
  if (String(note || "").trim()) L.push("", `🏆 كلمة من الإدارة: ${String(note).trim()}`);
  return latin(L.join("\n"));
}

// notes: {ar, en, bn} للبايكر؛ المشرف يأخذ notes.ar فقط · names: {ar, bn, en} من ملف الموظف
export function payrollMessage(line = {}, { notes = {}, complaints = null, names = {} } = {}) {
  if (line.role === "supervisor") return supervisorText(line, notes.ar);
  return bikerText(line, lineFacts(line, complaints), notes, names);
}

// عدّ شكاوى الشهر للبايكر من ops_tickets: مرفوعة = كل التذاكر، محسوبة = approved، مرفوضة = rejected
export function complaintCounts(tickets = []) {
  const t = tickets || [];
  return { raised: t.length, counted: t.filter(x => x.decision === "approved").length, rejected: t.filter(x => x.decision === "rejected").length };
}
