// تقرير شكاوى البايكر الشهري (عربي + বাংলা) للطباعة PDF — منطق نقي بلا DOM ولا Supabase.
// المصدر: ops_tickets (period + sweater_id) وops_biker_month (الغسلات والتقييم)، والصور من sweater-tickets (عام).
// لا يُعرض للبايكر: qc_recommendation ولا qc_notes ولا من اتخذ القرار (decided_by) — لا تُقرأ هنا إطلاقاً.
import { bikerQualityRiyal, bikerSafetyRiyal } from "./payrollEngine";
import { fontFaces, FONT_STACK } from "./fonts";

// أرقام إنجليزية فقط: الأرقام العربية/الفارسية/البنغالية في أي نص ⇒ لاتينية
const DIG = { "٠": 0, "١": 1, "٢": 2, "٣": 3, "٤": 4, "٥": 5, "٦": 6, "٧": 7, "٨": 8, "٩": 9, "۰": 0, "۱": 1, "۲": 2, "۳": 3, "۴": 4, "۵": 5, "۶": 6, "۷": 7, "۸": 8, "۹": 9,
  "০": 0, "১": 1, "২": 2, "৩": 3, "৪": 4, "৫": 5, "৬": 6, "৭": 7, "৮": 8, "৯": 9 };
export const latinDigits = s => String(s == null ? "" : s).replace(/[٠-٩۰-۹০-৯]/g, d => DIG[d]);
const esc = s => latinDigits(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const n2 = v => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MON_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MON_BN = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const monthOf = (p, M) => { const [y, m] = String(p || "").split("-"); return M[+m - 1] ? `${M[+m - 1]} ${y}` : String(p || ""); };
export const periodAr = p => monthOf(p, MON_AR);
export const periodBn = p => monthOf(p, MON_BN);

// نسبة الشكاوى = المحسوبة ÷ الغسلات الصافية × 100، والصافي = collect_payment + cancel_client
export const netBase = ops => (Number(ops && ops.collect_payment) || 0) + (Number(ops && ops.cancel_client) || 0);
export const pctOf = (count, base) => (base > 0 ? Math.round(count / base * 10000) / 100 : 0);
const rate = (qR, sR) => Math.round((2 + qR + sR) * 100) / 100; // HR-POL-003: ثابت 2 + ريال الجودة + ريال السلامة

// «ماذا كلّفتك الشكاوى»: الوضع الفعلي ثم سطر لكل شريحة أعلى لريال السلامة لو كانت الشكاوى أقل.
// المكافأة = الغسلات (net_washes كما في المسير) × سعر الغسلة؛ الفرق عن الوضع الفعلي.
export function costScenarios({ approved, base, washes, rating }) {
  const qR = bikerQualityRiyal(rating), w = Number(washes) || 0;
  const row = c => { const pct = pctOf(c, base), sR = bikerSafetyRiyal(pct), r = rate(qR, sR); return { count: c, pct, sR, qR, rate: r, bonus: Math.round(w * r * 100) / 100 }; };
  const actual = row(approved), out = [{ ...actual, actual: true, diff: 0 }];
  let last = actual.sR;
  for (let c = approved - 1; c >= 0; c--) {
    const x = row(c);
    if (x.sR > last) { out.push({ ...x, actual: false, diff: Math.round((x.bonus - actual.bonus) * 100) / 100 }); last = x.sR; }
  }
  return out;
}

// هدف الشهر القادم: أكبر عدد شكاوى يبقي النسبة دون 1% (ريال السلامة كامل) على أساس غسلات هذا الشهر
export function nextTarget({ approved, base, washes, rating }) {
  const max = base > 0 ? Math.ceil(base / 100) - 1 : 0;
  const full = costScenarios({ approved: Math.min(approved, max), base, washes, rating })[0];
  const cur = costScenarios({ approved, base, washes, rating })[0];
  return { max, done: approved <= max, gain: Math.max(0, Math.round((full.bonus - cur.bonus) * 100) / 100) };
}

// ترجمة بنغالية لنصوص coach (ticket_coach في القاعدة): مفتاحها الفئة العربية قبل « · »
export const COACH_BN = {
  "ظرف عميل": { cat: "গ্রাহকের কারণ",
    correct: "এটি সাধারণত আপনার নিয়ন্ত্রণের বাইরে। জরুরি হলো: ছবি দিয়ে প্রমাণ রাখুন এবং সঙ্গে সঙ্গে সুপারভাইজারকে জানান।",
    tip: "গ্রাহক বাতিল বা পরিবর্তন করলে দ্রুত সুপারভাইজারকে একটি নোট পাঠান, এতে আপনার রেকর্ড সুরক্ষিত থাকবে।",
    motivate: "আপনার রেকর্ড পরিষ্কার — এভাবেই চালিয়ে যান, অর্ডার ও আয় বাড়বে।" },
  "الحضور": { cat: "উপস্থিতি",
    correct: "সময়মতো উপস্থিত হওয়া সার্ভিসের মূল ভিত্তি। পৌঁছানো সম্ভব না হলে অনেক আগেই সুপারভাইজারকে জানান, যাতে বিকল্প ব্যবস্থা করা যায়।",
    tip: "প্রথম অর্ডারের যথেষ্ট আগে নিজেকে ও বাইক প্রস্তুত রাখুন।",
    motivate: "প্রতিটি অর্ডার সময়মতো শেষ করলে রেটিং ও আয় দুটোই বাড়ে।" },
  "الالتزام بالوقت": { cat: "সময়ানুবর্তিতা",
    correct: "হাতে কিছু সময় রেখে আগেই পৌঁছানোর জন্য পথ ও সময়ের পরিকল্পনা করুন।",
    tip: "লোকেশন আগেই দেখে নিন; দেরি হওয়ার সম্ভাবনা থাকলে গ্রাহককে জানান।",
    motivate: "আগে পৌঁছালে গ্রাহকের আস্থা বাড়ে এবং আপনার রেটিং ওঠে।" },
  "التعامل": { cat: "আচরণ",
    correct: "যেকোনো পরিস্থিতিতে প্রতিটি গ্রাহকের সাথে ভদ্র, শান্ত ও সম্মানজনক আচরণ করুন।",
    tip: "আন্তরিক সালাম দিয়ে শুরু করুন এবং কী করবেন সংক্ষেপে বুঝিয়ে বলুন।",
    motivate: "ভালো আচরণে চমৎকার রেটিং ও বারবার অর্ডার আসে।" },
  "الأدوات": { cat: "সরঞ্জাম",
    correct: "দিন শুরুর আগে সব সরঞ্জাম ও উপকরণ সম্পূর্ণ আছে কিনা নিশ্চিত করুন।",
    tip: "কোনো সরঞ্জাম বা উপকরণ কম থাকলে সঙ্গে সঙ্গে সুপারভাইজারের মাধ্যমে সরবরাহের অনুরোধ করুন।",
    motivate: "সম্পূর্ণ কিট = দ্রুত ও নিখুঁত সার্ভিস = বেশি আয়।" },
  "اكتمال الخدمة": { cat: "সম্পূর্ণ সার্ভিস",
    correct: "অর্ডারে উল্লেখিত প্রতিটি অতিরিক্ত সার্ভিস শেষ করার আগে সম্পন্ন করুন।",
    tip: "শুরুর আগে পুরো অর্ডারের বিবরণ পড়ুন এবং শেষে মিলিয়ে দেখুন।",
    motivate: "সম্পূর্ণ সার্ভিস গ্রাহকের সন্তুষ্টি ও আপনার রেটিং বাড়ায়।" },
  "العناية والأضرار": { cat: "যত্ন ও ক্ষতি",
    correct: "ধোয়ার আগে ও পরে গাড়ি পরীক্ষা করুন; আগে থেকে থাকা যেকোনো ক্ষতির ছবি তুলে সঙ্গে সঙ্গে জানান।",
    tip: "ছবি দিয়ে প্রমাণ রাখলে যেকোনো দাবি থেকে আপনি ও প্রতিষ্ঠান সুরক্ষিত থাকে।",
    motivate: "গাড়ির যত্ন নিলে সুনাম তৈরি হয়, আর সুনামে আয় বাড়ে।" },
  "إتقان التنظيف": { cat: "পরিষ্কারের মান",
    correct: "ভালোভাবে ঘষে পরিষ্কার করুন এবং ধোয়ার ক্রম মেনে চলুন: পানি, তারপর সাবান, তারপর স্পঞ্জ, তারপর তোয়ালে।",
    tip: "শক্ত দাগে যথেষ্ট সময় দিন; শেষ করতে তাড়াহুড়ো করবেন না।",
    motivate: "নিখুঁত কাজে রেটিং ও অর্ডার বাড়ে — আপনার মানই আপনার আয়।" },
  "تغطية كل المناطق": { cat: "সব অংশ পরিষ্কার",
    correct: "সব অংশ পরিষ্কার না করে শেষ করবেন না: চাকা, কোণ, দরজার ভেতরের অংশ ও কিনারা।",
    tip: "শেষ করার আগে গাড়ির চারপাশে একবার পুরো ঘুরে শেষবার দেখে নিন।",
    motivate: "সম্পূর্ণ ওয়াশ মানে সন্তুষ্ট গ্রাহক ও উচ্চ রেটিং।" },
  "التجفيف": { cat: "শুকানো",
    correct: "পানির দাগ এড়াতে পরিষ্কার তোয়ালে দিয়ে গাড়ি সম্পূর্ণ শুকিয়ে নিন।",
    tip: "শুকনো তোয়ালে দিয়ে ওপর থেকে নিচে শুকানো শুরু করুন।",
    motivate: "শেষে ভালোভাবে শুকানোই গ্রাহকের মনে আলাদা ছাপ ফেলে।" },
  "تطوير الأداء": { cat: "কাজের উন্নতি",
    correct: "এই অভিযোগের বিস্তারিত দেখুন এবং প্রতিটি অর্ডারে সর্বোচ্চ মান বজায় রাখুন।",
    tip: "আবার না হওয়ার জন্য সুপারভাইজারের কাছে যেকোনো ব্যাখ্যা চেয়ে নিন।",
    motivate: "প্রতিটি অভিযোগই নিজের কাজ উন্নত করে আয় বাড়ানোর একটি সুযোগ।" },
};
// نص coach بالعربي والإنجليزي ⇒ الجزء العربي فقط
export const arPart = s => String(s || "").split(/\s+(?=[A-Za-z])/)[0].trim();
const catAr = coach => String((coach && coach.cat) || "").split("·")[0].trim();

// «المطلوب منك»: المحسوبة ⇒ التصحيح (correct)، المرفوضة ⇒ النصيحة (tip) بلا لوم
export function coachLines(coach, decision) {
  const k = decision === "approved" ? "correct" : "tip";
  const bn = COACH_BN[catAr(coach)] || COACH_BN["تطوير الأداء"];
  return { cat: catAr(coach) || "تطوير الأداء", catBn: bn.cat, ar: arPart(coach && coach[k]) || "", bn: bn[k] };
}

// السبب الظاهر للبايكر: reason_ar/reason_bn إن عبّأها المشرف، وإلا نص ثابت حسب القرار (لا qc_notes)
export const DEFAULT_REASON = {
  approved: { ar: "راجعتها الإدارة مع الصور وثبتت الملاحظة، فاحتُسبت عليك.",
    bn: "ব্যবস্থাপনা ছবিসহ যাচাই করে অভিযোগটি সঠিক পেয়েছে, তাই এটি আপনার বিরুদ্ধে গণ্য হয়েছে।" },
  rejected: { ar: "راجعتها الإدارة مع الصور ولم تثبت عليك، فرُفضت لصالحك.",
    bn: "ব্যবস্থাপনা ছবিসহ যাচাই করে অভিযোগটি আপনার বিরুদ্ধে প্রমাণিত হয়নি, তাই এটি আপনার পক্ষে বাতিল হয়েছে।" },
};
export const NO_BN = "বাংলা অনুবাদ এখনও যোগ করা হয়নি";

const picsOf = t => (Array.isArray(t.stored_pics) && t.stored_pics.length ? t.stored_pics : (t.stored_pic_path ? [t.stored_pic_path] : []));
const byNo = (a, b) => (Number(a.ticket_no) || 0) - (Number(b.ticket_no) || 0) || String(a.ticket_date || "").localeCompare(String(b.ticket_date || ""));

// بطاقة التذكرة كما تُعرض للبايكر — حقول محدّدة فقط (لا qc_* ولا decided_by)
export function ticketCard(t, picUrl = p => p) {
  const d = t.decision === "approved" ? "approved" : "rejected";
  const reasonAr = String(t.reason_ar || "").trim(), reasonBn = String(t.reason_bn || "").trim();
  return {
    no: t.ticket_no, sweaterNo: t.sweater_ticket_no || null, date: t.ticket_date || "", booking: t.booking_ref || "",
    descAr: String(t.description || "").trim(), descBn: String(t.desc_bn || "").trim(),
    reasonAr: reasonAr || DEFAULT_REASON[d].ar, reasonBn: reasonBn || (reasonAr ? "" : DEFAULT_REASON[d].bn),
    coach: coachLines(t.coach, d), pics: picsOf(t).map(picUrl),
  };
}

// بيانات التقرير كاملة. tickets: صفوف ops_tickets للبايكر والشهر · ops: صفه في ops_biker_month (أو null)
export function reportData({ tickets = [], ops = null, period, sid, name }, picUrl) {
  const rows = (tickets || []).slice().sort(byNo);
  const approved = rows.filter(t => t.decision === "approved"), rejected = rows.filter(t => t.decision === "rejected");
  const base = netBase(ops), washes = Number(ops && ops.net_washes) || 0, rating = Number(ops && ops.rating) || 0;
  const pending = rows.length - approved.length - rejected.length;
  const a = approved.map(t => ticketCard(t, picUrl)), r = rejected.map(t => ticketCard(t, picUrl));
  return {
    period, sid: String(sid || "").trim(), name: name || (rows[0] && rows[0].biker_name) || (ops && ops.biker_name) || "",
    total: rows.length, approved: approved.length, rejected: rejected.length, pending, base, washes, rating,
    pct: pctOf(approved.length, base), hasOps: !!ops,
    scenarios: ops ? costScenarios({ approved: approved.length, base, washes, rating }) : [],
    target: ops ? nextTarget({ approved: approved.length, base, washes, rating }) : null,
    approvedCards: a, rejectedCards: r, picCount: [...a, ...r].reduce((s, c) => s + c.pics.length, 0),
    missingBn: [...a, ...r].filter(c => !c.descBn && c.descAr).map(c => c.no),
  };
}

// ── صفحة الطباعة (A4، @media print) ──
const bi = (ar, bn, cls = "") => `<div class="bi ${cls}"><div class="ar">${esc(ar)}</div>${bn ? `<div class="bn" dir="ltr">${esc(bn)}</div>` : ""}</div>`;

function cardHTML(c, tone) {
  const field = (lAr, lBn, vAr, vBn, wide) => `<div class="f${wide ? " w" : ""}"><div class="fl">${esc(lAr)} <span class="bn" dir="ltr">${esc(lBn)}</span></div>${bi(vAr, vBn)}</div>`;
  const pics = c.pics.length ? `<div class="pics">${c.pics.map(u => `<div class="ph"><img src="${esc(u)}" alt="" loading="eager"/></div>`).join("")}</div>`
    : `<div class="nopic">${bi("لا توجد صور لهذه الشكوى", "এই অভিযোগের কোনো ছবি নেই")}</div>`;
  return `<section class="card ${tone}">
  <div class="ch"><b>#${esc(c.no)}</b>${c.sweaterNo ? `<span>سويتر ${esc(c.sweaterNo)}</span>` : ""}<span class="cat">${esc(c.coach.cat)} · <span class="bn" dir="ltr">${esc(c.coach.catBn)}</span></span></div>
  <div class="meta"><span>التاريخ <span class="bn" dir="ltr">তারিখ</span>: <b dir="ltr">${esc(c.date)}</b></span><span>رقم الحجز <span class="bn" dir="ltr">বুকিং নং</span>: <b dir="ltr">${esc(c.booking)}</b></span></div>
  ${field("شكوى العميل", "গ্রাহকের অভিযোগ", c.descAr || "—", c.descBn || (c.descAr ? NO_BN : ""), true)}
  ${field(tone === "red" ? "سبب الاحتساب" : "سبب الرفض", tone === "red" ? "গণ্য হওয়ার কারণ" : "বাতিলের কারণ", c.reasonAr, c.reasonBn, true)}
  ${pics}
  <div class="todo">${bi("المطلوب منك: " + c.coach.ar, "আপনার করণীয়: " + c.coach.bn)}</div>
</section>`;
}

export function buildReportHTML(d, { site = "", fontBase } = {}) {
  const kpi = (v, ar, bn, c) => `<div class="k"><b style="color:${c}">${esc(v)}</b><span>${esc(ar)}</span><span class="bn" dir="ltr">${esc(bn)}</span></div>`;
  const sc = d.scenarios.map(s => `<tr class="${s.actual ? "act" : ""}"><td>${s.actual ? `وضعك الفعلي <span class="bn" dir="ltr">আপনার বর্তমান অবস্থা</span>` : `لو كانت ${s.count} <span class="bn" dir="ltr">যদি ${s.count} টি হতো</span>`}</td>
    <td class="n">${s.count}</td><td class="n">${s.pct.toFixed(2)}%</td><td class="n">${s.sR.toFixed(2)}</td><td class="n">${s.rate.toFixed(2)}</td><td class="n">${n2(s.bonus)}</td><td class="n ${s.diff > 0 ? "up" : ""}">${s.actual ? "—" : "+" + n2(s.diff)}</td></tr>`).join("");
  const t = d.target;
  const target = !t ? "" : t.done
    ? bi(`هدف الشهر القادم: حافظ على ${t.max} شكوى أو أقل (أقل من 1%) لتبقى في ريال السلامة الكامل 1.00.`,
      `আগামী মাসের লক্ষ্য: ${t.max} টি বা তার কম অভিযোগ রাখুন (1% এর কম), যাতে পূর্ণ সেফটি রিয়াল 1.00 বজায় থাকে।`)
    : bi(`هدف الشهر القادم: ${t.max} شكوى أو أقل (أقل من 1%) ⇒ ريال السلامة كامل 1.00 وزيادة تقارب ${n2(t.gain)} ﷼ على عدد غسلات هذا الشهر.`,
      `আগামী মাসের লক্ষ্য: ${t.max} টি বা তার কম অভিযোগ (1% এর কম) ⇒ পূর্ণ সেফটি রিয়াল 1.00 এবং এই মাসের ওয়াশ সংখ্যায় প্রায় ${n2(t.gain)} রিয়াল বেশি।`);
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>تقرير شكاوى ${esc(d.name)} — ${esc(d.period)}</title>
<style>${fontFaces(fontBase)}
@page{size:A4;margin:12mm}
*{box-sizing:border-box}html,body{margin:0;background:#f1f5f9}
body{font-family:${FONT_STACK};color:#0f172a;font-size:10.5pt;line-height:1.55}
.page{width:210mm;margin:0 auto;background:#fff;padding:12mm}
.bar{position:sticky;top:0;z-index:5;display:flex;gap:8px;justify-content:center;align-items:center;padding:10px;background:#0f172a;color:#fff;font-size:13px}
.bar button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:9px 18px;background:#e8712b;color:#fff;cursor:pointer}.bar button:disabled{opacity:.5;cursor:wait}
.bn{font-family:'Noto Sans Bengali',${FONT_STACK};direction:ltr;unicode-bidi:isolate}
.bi .bn{display:block;text-align:left;color:#334155;font-size:9.5pt;margin-top:1mm}
.hd{display:flex;align-items:center;gap:5mm;border-bottom:3px solid #e8712b;padding-bottom:4mm;margin-bottom:5mm}
.hd img{width:16mm;height:16mm;object-fit:contain}.hd h1{margin:0;font-size:16pt}.hd .sub{font-size:10pt;color:#475569}
.hd .who{margin-inline-start:auto;text-align:left;font-size:10pt}.hd .who b{display:block;font-size:13pt}
.msg{background:#fff7ed;border:1px solid #fed7aa;border-radius:3mm;padding:3mm 4mm;margin-bottom:5mm}
.ks{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin-bottom:5mm}
.k{border:1px solid #e2e8f0;border-radius:3mm;padding:3mm 2mm;text-align:center}.k b{display:block;font-size:18pt;line-height:1.2}.k span{display:block;font-size:9pt;color:#475569}
h2{font-size:12.5pt;margin:6mm 0 3mm}h2 .bn{font-size:10pt;color:#475569;margin-inline-start:2mm}
table{width:100%;border-collapse:collapse;font-size:9.5pt;break-inside:avoid}th,td{border-bottom:1px solid #e2e8f0;padding:1.6mm 1.5mm;text-align:right;vertical-align:top}
th{background:#f8fafc;font-size:8.8pt}th .bn,td .bn{display:block;font-size:8pt;color:#64748b}td.n{text-align:left;direction:ltr;font-weight:600;white-space:nowrap}
tr.act td{background:#fef2f2;font-weight:700}td.up{color:#047857}
.note{font-size:8.5pt;color:#64748b;margin-top:1.5mm}
.goal{border:2px dashed #047857;border-radius:3mm;padding:3mm 4mm;background:#ecfdf5;margin:5mm 0;break-inside:avoid}
.sec{font-size:13pt;margin:7mm 0 3mm;padding:2mm 4mm;border-radius:2mm;color:#fff;break-after:avoid}.sec.red{background:#b42318}.sec.green{background:#067647}
.sec .bn{display:inline;color:#fff;font-size:10pt;margin-inline-start:3mm}
.card{border:1.5px solid #e2e8f0;border-radius:3mm;padding:3mm 4mm;margin-bottom:4mm;break-inside:avoid;page-break-inside:avoid}
.card.red{border-color:#fda29b;border-inline-start:5px solid #b42318}.card.green{border-color:#a6f4c5;border-inline-start:5px solid #067647}
.ch{display:flex;gap:3mm;align-items:baseline;flex-wrap:wrap}.ch b{font-size:13pt}.ch .cat{margin-inline-start:auto;font-weight:700}
.meta{display:flex;gap:6mm;flex-wrap:wrap;font-size:9pt;color:#475569;margin:1mm 0 2mm}.meta .bn{display:inline}
.f{margin:1.5mm 0}.fl{font-size:8.8pt;color:#64748b;font-weight:700}.fl .bn{display:inline;font-weight:400}
.pics{display:grid;grid-template-columns:1fr 1fr;gap:2mm;margin:2mm 0}.ph{height:60mm;border:1px solid #e2e8f0;border-radius:2mm;background:#f8fafc;display:flex;align-items:center;justify-content:center;overflow:hidden}
.ph img{max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain}
.nopic{font-size:9pt;color:#64748b;margin:2mm 0}
.todo{background:#f8fafc;border-radius:2mm;padding:2mm 3mm;font-weight:600}
.empty{color:#64748b;font-size:10pt;margin:2mm 0 4mm}
.ft{margin-top:6mm;font-size:8pt;color:#94a3b8;text-align:center}
@media print{html,body{background:#fff}.bar{display:none}.page{width:auto;margin:0;padding:0}}
</style></head><body>
<div class="bar"><span id="st">جارٍ تحميل الصور والخط… · ছবি লোড হচ্ছে…</span><button id="pr" disabled>طباعة / حفظ PDF</button></div>
<div class="page">
<header class="hd"><img src="${esc(site)}/brand-mark.png" alt=""/>
  <div><h1>تقرير شكاوى العملاء — ${esc(periodAr(d.period))}</h1><div class="sub bn" dir="ltr">গ্রাহক অভিযোগ রিপোর্ট — ${esc(periodBn(d.period))}</div><div class="sub">مؤسسة دلو ورغوة التجارية</div></div>
  <div class="who"><b>${esc(d.name)}</b><div>رقم البايكر · <span class="bn" dir="ltr">বাইকার নং</span></div><b dir="ltr">${esc(d.sid)}</b></div></header>
<div class="msg">${bi("هذا التقرير ليس عقوبة. هدفه أن ترى أخطاء الشهر بالصور وتتجنّبها، فتقلّ شكاواك ويرتفع ريال السلامة ومكافأتك.",
  "এই রিপোর্ট কোনো শাস্তি নয়। এর উদ্দেশ্য হলো ছবিসহ এই মাসের ভুলগুলো দেখে সেগুলো এড়িয়ে চলা, যাতে আপনার অভিযোগ কমে এবং সেফটি রিয়াল ও বোনাস বাড়ে।")}</div>
<div class="ks">${kpi(d.total, "الشكاوى المرفوعة", "মোট অভিযোগ", "#0f172a")}${kpi(d.approved, "المحسوبة عليك", "আপনার বিরুদ্ধে গণ্য", "#b42318")}${kpi(d.rejected, "المرفوضة لصالحك", "আপনার পক্ষে বাতিল", "#067647")}${kpi(d.hasOps ? d.pct.toFixed(2) + "%" : "—", "نسبة الشكاوى", "অভিযোগের হার", "#b54708")}</div>
${d.pending ? `<div class="note">${bi(`${d.pending} شكوى ما زالت بانتظار القرار ولم تدخل الحساب.`, `${d.pending} টি অভিযোগের সিদ্ধান্ত এখনও বাকি, তাই হিসাবে ধরা হয়নি।`)}</div>` : ""}
${d.hasOps ? `<h2>ماذا كلّفتك الشكاوى؟ <span class="bn" dir="ltr">অভিযোগে আপনার কত ক্ষতি হলো?</span></h2>
<table><thead><tr><th>الحالة<span class="bn" dir="ltr">অবস্থা</span></th><th>الشكاوى المحسوبة<span class="bn" dir="ltr">গণ্য অভিযোগ</span></th><th>النسبة<span class="bn" dir="ltr">হার</span></th><th>ريال السلامة<span class="bn" dir="ltr">সেফটি রিয়াল</span></th><th>سعر الغسلة<span class="bn" dir="ltr">প্রতি ওয়াশ রেট</span></th><th>مكافأة الغسلات ﷼<span class="bn" dir="ltr">ওয়াশ বোনাস</span></th><th>الفرق ﷼<span class="bn" dir="ltr">পার্থক্য</span></th></tr></thead><tbody>${sc}</tbody></table>
<div class="note">${bi(`النسبة = المحسوبة ÷ الغسلات الصافية (${d.base} = المدفوعة + إلغاء العميل). سعر الغسلة = 2 + ريال الجودة (${n2(d.scenarios[0].qR)} لتقييم ${d.rating.toFixed(2)}) + ريال السلامة، والمكافأة على ${d.washes} غسلة (HR-POL-003). المسير المعتمد هو المرجع.`,
  `হার = গণ্য অভিযোগ ÷ নেট ওয়াশ (${d.base})। প্রতি ওয়াশ রেট = 2 + কোয়ালিটি রিয়াল (${n2(d.scenarios[0].qR)}) + সেফটি রিয়াল; বোনাস ${d.washes} ওয়াশের উপর। চূড়ান্ত হিসাব বেতন শিটে।`)}</div>
<div class="goal">${target}</div>` : `<div class="note">${bi("لا توجد أرقام تشغيل لهذا الشهر بعد، فلا تُحسب النسبة ولا المكافأة.", "এই মাসের অপারেশন ডেটা এখনও নেই, তাই হার ও বোনাস হিসাব করা যায়নি।")}</div>`}
<div class="sec red">الشكاوى المحسوبة عليك (${d.approved}) <span class="bn" dir="ltr">আপনার বিরুদ্ধে গণ্য অভিযোগ</span></div>
${d.approvedCards.length ? d.approvedCards.map(c => cardHTML(c, "red")).join("") : `<div class="empty">${bi("لا شكاوى محسوبة عليك هذا الشهر — ممتاز.", "এই মাসে আপনার বিরুদ্ধে কোনো অভিযোগ গণ্য হয়নি — চমৎকার।")}</div>`}
<div class="sec green">الشكاوى المرفوضة لصالحك (${d.rejected}) <span class="bn" dir="ltr">আপনার পক্ষে বাতিল হওয়া অভিযোগ</span></div>
${d.rejectedCards.length ? d.rejectedCards.map(c => cardHTML(c, "green")).join("") : `<div class="empty">${bi("لا شكاوى مرفوضة هذا الشهر.", "এই মাসে কোনো অভিযোগ বাতিল হয়নি।")}</div>`}
<div class="ft">مؤسسة دلو ورغوة التجارية · شريك امتياز سويتر · HR-POL-003 · ${esc(d.period)}</div>
</div>
<script>(function(){var b=document.getElementById("pr"),s=document.getElementById("st");
var imgs=[].slice.call(document.images),wait=imgs.map(function(i){return i.complete?Promise.resolve():new Promise(function(r){i.onload=i.onerror=r;});});
var f=(document.fonts&&document.fonts.ready)?document.fonts.ready:Promise.resolve();
Promise.all([f].concat(wait)).then(function(){var bad=imgs.filter(function(i){return !i.naturalWidth;}).length;
s.textContent=bad?("تعذّر تحميل "+bad+" صورة — راجعها قبل الطباعة"):"جاهز للطباعة · প্রিন্টের জন্য প্রস্তুত";b.disabled=false;});
b.addEventListener("click",function(){window.print();});})();</script>
</body></html>`;
}
