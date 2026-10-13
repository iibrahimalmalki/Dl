// رسالة الواتساب لسطر المسير (البند 17 من docs/design/payroll_pipeline.md). دالة نقية بلا DOM ولا Supabase.
// النموذج (طلب المالك): عربي / English / বাংলা — الغسلات، التقييم، الشكاوى (مرفوعة/محسوبة/مرفوضة/النسبة)، تفصيل سعر الغسلة،
// الإنتاج، الإكراميات، الصافي، «كلمة من الإدارة» قابلة للتعديل، وبعد الدفع: المبلغ والتاريخ وآخر 4 أرقام من المرجع.
// المشرف بالعربي فقط. أرقام إنجليزية دائماً. لا مقارنة بأي بايكر آخر (القاعدة 6).

const DIG = { "٠": 0, "١": 1, "٢": 2, "٣": 3, "٤": 4, "٥": 5, "٦": 6, "٧": 7, "٨": 8, "٩": 9, "۰": 0, "۱": 1, "۲": 2, "۳": 3, "۴": 4, "۵": 5, "۶": 6, "۷": 7, "۸": 8, "۹": 9, "০": 0, "১": 1, "২": 2, "৩": 3, "৪": 4, "৫": 5, "৬": 6, "৭": 7, "৮": 8, "৯": 9 };
const latin = s => String(s == null ? "" : s).replace(/[٠-٩۰-۹০-৯]/g, d => String(DIG[d]));
const n2 = v => (Math.round((Number(v) || 0) * 100) / 100).toFixed(2);
const int = v => String(Math.round(Number(v) || 0));
export const last4 = ref => { const d = latin(ref).replace(/\s/g, ""); return d ? "…" + d.slice(-4) : ""; };

const MONTHS = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  bn: ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"],
};
export const monthName = (period, lang = "ar") => { const [y, m] = String(period || "").split("-"); return `${(MONTHS[lang] || MONTHS.ar)[+m - 1] || m} ${y || ""}`.trim(); };

// أرقام السطر من computed (ما حُسب به المسير فعلاً) مع inputs احتياطاً
export function lineFacts(line = {}, complaints = null) {
  const c = line.computed || {}, i = line.inputs || {};
  const rate = Number(c.rate_per_wash) || 0, q = Number(c.quality_riyal) || 0, s = Number(c.safety_riyal) || 0;
  const counted = c.complaint_approved ?? i.complaint_approved;
  return {
    name: String(line.name || "").trim(), period: line.period,
    washes: Number(c.net_washes ?? i.net_washes) || 0, rating: c.rating ?? i.rating,
    raised: complaints && complaints.raised != null ? complaints.raised : null,
    counted: counted === "" || counted == null ? (complaints ? complaints.counted : null) : Number(counted),
    rejected: complaints && complaints.rejected != null ? complaints.rejected : null,
    pct: c.complaint_pct,
    baseRate: Math.round((rate - q - s) * 100) / 100, quality: q, safety: s, rate,
    bonusBase: Number(c.bonus_base) || Math.round((Number(c.net_washes) || 0) * rate * 100) / 100,
    production: Number(c.production) || 0, tips: Number(c.tips ?? i.tips) || 0, deductions: Number(c.deductions) || 0,
    net: Number(line.net_bonus) || 0,
    paid: line.payment_status === "paid", paidAmount: line.paid_amount, paidAt: line.paid_at ? String(line.paid_at).slice(0, 10) : null, ref: last4(line.payment_ref),
  };
}

const T = {
  ar: { hi: n => `السلام عليكم ${n} 👋`, title: (m) => `مسير ${m} — دلو ورغوة`, washes: "🧽 الغسلات الصافية", rating: "⭐ التقييم",
    compl: (r, c, j, p) => `📋 الشكاوى: ${[r != null ? `${r} مرفوعة` : null, c != null ? `${c} محسوبة` : null, j != null ? `${j} مرفوضة` : null, p != null ? `النسبة ${n2(p)}%` : null].filter(Boolean).join(" · ")}`,
    rate: (b, q, s, t) => `💵 سعر الغسلة: ${n2(b)} + جودة ${n2(q)} + سلامة ${n2(s)} = ${n2(t)}`, prod: "➕ الإنتاج", tips: "🎁 الإكراميات", ded: "➖ الاستقطاعات",
    net: "✅ الصافي", sar: "ريال", paid: (a, d, r) => `💳 تم التحويل: ${n2(a)} ريال${d ? ` بتاريخ ${d}` : ""}${r ? ` — المرجع ${r}` : ""}`, note: "💬 كلمة من الإدارة" },
  en: { hi: n => `Hello ${n} 👋`, title: (m) => `Payroll ${m} — Dalu Warghwah`, washes: "🧽 Net washes", rating: "⭐ Rating",
    compl: (r, c, j, p) => `📋 Complaints: ${[r != null ? `${r} raised` : null, c != null ? `${c} counted` : null, j != null ? `${j} rejected` : null, p != null ? `rate ${n2(p)}%` : null].filter(Boolean).join(" · ")}`,
    rate: (b, q, s, t) => `💵 Rate per wash: ${n2(b)} + quality ${n2(q)} + safety ${n2(s)} = ${n2(t)}`, prod: "➕ Production", tips: "🎁 Tips", ded: "➖ Deductions",
    net: "✅ Net", sar: "SAR", paid: (a, d, r) => `💳 Transferred: ${n2(a)} SAR${d ? ` on ${d}` : ""}${r ? ` — ref ${r}` : ""}`, note: "💬 A word from management" },
  bn: { hi: n => `আসসালামু আলাইকুম ${n} 👋`, title: (m) => `${m} বেতন — Dalu Warghwah`, washes: "🧽 নিট ওয়াশ", rating: "⭐ রেটিং",
    compl: (r, c, j, p) => `📋 অভিযোগ: ${[r != null ? `${r} এসেছে` : null, c != null ? `${c} গণনা হয়েছে` : null, j != null ? `${j} বাতিল` : null, p != null ? `হার ${n2(p)}%` : null].filter(Boolean).join(" · ")}`,
    rate: (b, q, s, t) => `💵 প্রতি ওয়াশ: ${n2(b)} + মান ${n2(q)} + নিরাপত্তা ${n2(s)} = ${n2(t)}`, prod: "➕ উৎপাদন বোনাস", tips: "🎁 টিপস", ded: "➖ কর্তন",
    net: "✅ নিট", sar: "রিয়াল", paid: (a, d, r) => `💳 পাঠানো হয়েছে: ${n2(a)} রিয়াল${d ? ` (${d})` : ""}${r ? ` — রেফারেন্স ${r}` : ""}`, note: "💬 ম্যানেজমেন্টের কথা" },
};

function bikerText(f, lang, note) {
  const t = T[lang] || T.ar, L = [];
  L.push(t.hi(f.name), t.title(monthName(f.period, lang)), "");
  L.push(`${t.washes}: ${int(f.washes)}`);
  if (f.rating != null && f.rating !== "") L.push(`${t.rating}: ${n2(f.rating)}`);
  if (f.raised != null || f.counted != null || f.pct != null) L.push(t.compl(f.raised, f.counted, f.rejected, f.pct));
  if (f.rate) L.push(t.rate(f.baseRate, f.quality, f.safety, f.rate), `   ${int(f.washes)} × ${n2(f.rate)} = ${n2(f.bonusBase)}`);
  if (f.production) L.push(`${t.prod}: ${n2(f.production)}`);
  if (f.tips) L.push(`${t.tips}: ${n2(f.tips)}`);
  if (f.deductions) L.push(`${t.ded}: −${n2(f.deductions)}`);
  L.push(`${t.net}: ${n2(f.net)} ${t.sar}`);
  if (f.paid && f.paidAmount != null) L.push("", t.paid(f.paidAmount, f.paidAt, f.ref));
  if (String(note || "").trim()) L.push("", `${t.note}: ${String(note).trim()}`);
  return latin(L.join("\n"));
}

// المشرف: عربي فقط — أرقام الفريق من computed
function supervisorText(line, note) {
  const c = line.computed || {}, L = [];
  L.push(`السلام عليكم ${String(line.name || "").trim()} 👋`, `مسير ${monthName(line.period, "ar")} — دلو ورغوة (المشرف)`, "");
  if (c.team_orders != null) L.push(`🧽 طلبات الفريق: ${int(c.team_orders)}`);
  if (c.team_rating != null) L.push(`⭐ متوسط تقييم الفريق: ${n2(c.team_rating)}`);
  if (c.team_complaint_pct != null) L.push(`📋 نسبة شكاوى الفريق: ${n2(c.team_complaint_pct)}%`);
  if (c.rate_per_order != null) L.push(`💵 المعدل لكل طلب: ${n2(c.rate_per_order)}`);
  if (Number(c.deductions)) L.push(`➖ الاستقطاعات: −${n2(c.deductions)}`);
  L.push(`✅ العمولة: ${n2(line.net_bonus)} ريال`);
  if (line.payment_status === "paid" && line.paid_amount != null)
    L.push("", `💳 تم التحويل: ${n2(line.paid_amount)} ريال${line.paid_at ? ` بتاريخ ${String(line.paid_at).slice(0, 10)}` : ""}${line.payment_ref ? ` — المرجع ${last4(line.payment_ref)}` : ""}`);
  else if (line.payment_status === "deferred") L.push("", "⏳ العمولة مؤجَّلة");
  if (String(note || "").trim()) L.push("", `💬 كلمة من الإدارة: ${String(note).trim()}`);
  return latin(L.join("\n"));
}

// lang: ar | en | bn | all (الثلاث بالترتيب بفاصل) — المشرف عربي دائماً
export const MSG_LANGS = [{ v: "all", ar: "الثلاث" }, { v: "ar", ar: "عربي" }, { v: "en", ar: "English" }, { v: "bn", ar: "বাংলা" }];
export function payrollMessage(line = {}, { lang = "all", note = "", complaints = null } = {}) {
  if (line.role === "supervisor") return supervisorText(line, note);
  const f = lineFacts(line, complaints);
  if (lang === "all") return ["ar", "en", "bn"].map(l => bikerText(f, l, note)).join("\n\n— — —\n\n");
  return bikerText(f, lang, note);
}

// عدّ شكاوى الشهر للبايكر من ops_tickets: مرفوعة = كل التذاكر، محسوبة = approved، مرفوضة = rejected
export function complaintCounts(tickets = []) {
  const t = tickets || [];
  return { raised: t.length, counted: t.filter(x => x.decision === "approved").length, rejected: t.filter(x => x.decision === "rejected").length };
}
