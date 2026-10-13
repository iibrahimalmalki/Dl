// تقرير شكاوى البايكر الشهري (عربي + বাংলা) للطباعة PDF — منطق نقي بلا DOM ولا Supabase.
// المصدر: ops_tickets (period + sweater_id) وops_biker_month (الغسلات والتقييم)، والصور من sweater-tickets (عام).
// لا يُعرض للبايكر: qc_recommendation ولا qc_notes ولا من اتخذ القرار (decided_by) — لا تُقرأ هنا إطلاقاً.
import { bikerQualityRiyal, bikerSafetyRiyal } from "./payrollEngine";
import { fontFaces, FONT_STACK } from "./fonts";

// أرقام إنجليزية فقط: الأرقام العربية/الفارسية/البنغالية في أي نص ⇒ لاتينية
const DIG = { "٠": 0, "١": 1, "٢": 2, "٣": 3, "٤": 4, "٥": 5, "٦": 6, "٧": 7, "٨": 8, "٩": 9, "۰": 0, "۱": 1, "۲": 2, "۳": 3, "۴": 4, "۵": 5, "۶": 6, "۷": 7, "۸": 8, "۹": 9,
  "০": 0, "১": 1, "২": 2, "৩": 3, "৪": 4, "৫": 5, "৬": 6, "৭": 7, "৮": 8, "৯": 9 };
export const latinDigits = s => String(s == null ? "" : s).replace(/[٠-٩۰-۹০-৯]/g, d => DIG[d]);
const esc = s => latinDigits(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n2 = v => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MON_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MON_BN = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const monthOf = (p, M) => { const [y, m] = String(p || "").split("-"); return M[+m - 1] ? `${M[+m - 1]} ${y}` : String(p || ""); };
export const periodAr = p => monthOf(p, MON_AR);
export const periodBn = p => monthOf(p, MON_BN);
const nextMonth = (p, M) => { const [y, m] = String(p || "").split("-").map(Number); return M[(m || 1) % 12] || ""; };

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

// هدف الشهر القادم: أكبر عدد شكاوى يبقي النسبة دون 1% (ريال السلامة كامل 1.00) + شريحة التقييم التالية لريال الجودة.
// الزيادة = (سعر الغسلة المستهدف − الحالي) × غسلات هذا الشهر
const Q_STEPS = [4.00, 4.25, 4.50, 4.75];
export function nextTarget({ approved, base, washes, rating }) {
  let max = 0;
  while (base > 0 && bikerSafetyRiyal(pctOf(max + 1, base)) === 1) max++;
  const r = Number(rating) || 0, w = Number(washes) || 0;
  const ratingTarget = Q_STEPS.find(t => t > r) || null;
  const cur = rate(bikerQualityRiyal(r), bikerSafetyRiyal(pctOf(approved, base)));
  const tgt = rate(bikerQualityRiyal(ratingTarget || r), 1);
  return { max, done: approved <= max && !ratingTarget, ratingTarget, curRate: cur, rate: tgt, gain: Math.max(0, Math.round((tgt - cur) * w * 100) / 100) };
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
  approved: { ar: "تمت مراجعة الصور واحتُسبت عليك.", bn: "ছবি দেখে আপনার বিরুদ্ধে গণনা করা হয়েছে।" },
  rejected: { ar: "قرار الإدارة لصالحك.", bn: "ম্যানেজমেন্ট আপনার পক্ষে সিদ্ধান্ত দিয়েছে।" },
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
    reasonAr: reasonAr || DEFAULT_REASON[d].ar, reasonBn: reasonBn || (reasonAr ? NO_BN : DEFAULT_REASON[d].bn),
    reasonBnMissing: !!reasonAr && !reasonBn,
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
    // المكافأة على الغسلات الصافية نفسها (المدفوعة + إلغاء العميل) كما في نموذج المالك
    scenarios: ops ? costScenarios({ approved: approved.length, base, washes: base, rating }) : [],
    target: ops ? nextTarget({ approved: approved.length, base, washes: base, rating }) : null,
    approvedCards: a, rejectedCards: r, picCount: [...a, ...r].reduce((s, c) => s + c.pics.length, 0),
    missingBn: [...a, ...r].filter(c => (!c.descBn && c.descAr) || c.reasonBnMissing).map(c => c.no),
  };
}

// ── صفحة الطباعة (A4، @media print) — على نموذج المالك (Midul_Complaints_July2026_AR-BN.pdf) ──
const bi = (ar, bn, cls = "") => `<div class="bi ${cls}"><div class="ar">${esc(ar)}</div>${bn ? `<div class="bn" dir="ltr">${esc(bn)}</div>` : ""}</div>`;
const lab = (ar, bn) => `<div class="lb"><b>${esc(ar)}</b><span class="bn" dir="ltr">${esc(bn)}</span></div>`;
const firstName = n => String(n || "").trim().split(/\s+/)[0] || "";

function cardHTML(c, tone) {
  const red = tone === "red";
  const pics = c.pics.length ? `<div class="pics">${c.pics.map((u, i) => `<a class="ph" href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="صورة ${i + 1}"/><span class="pn">صورة ${i + 1} · <span class="bn" dir="ltr">ছবি ${i + 1}</span></span></a>`).join("")}</div>`
    : `<div class="nopic">لا توجد صورة من العميل · <span class="bn" dir="ltr">গ্রাহকের কোনো ছবি নেই</span></div>`;
  return `<section class="card ${tone}">
  <div class="ch"><div><h3>#${esc(c.no)} ${esc(c.coach.cat)}</h3><div class="bn sub" dir="ltr">${esc(c.coach.catBn)}</div></div>
    <div class="dt"><div><span class="mut">التاريخ · </span><span class="bn mut" dir="ltr">তারিখ</span> <b dir="ltr">${esc(c.date)}</b></div><div><span class="mut">الحجز · </span><span class="bn mut" dir="ltr">বুকিং</span> <b dir="ltr">${esc(c.booking)}</b></div></div></div>
  <div class="row">${lab("شكوى العميل", "গ্রাহকের অভিযোগ")}${bi(c.descAr ? "«" + c.descAr + "»" : "—", c.descBn ? "“" + c.descBn + "”" : (c.descAr ? NO_BN : ""))}</div>
  <div class="row">${lab(red ? "سبب الاحتساب" : "سبب الرفض", red ? "কেন গণনা হয়েছে" : "কেন বাতিল হয়েছে")}${bi(c.reasonAr, c.reasonBn, "reason " + tone)}</div>
  ${pics}
  <div class="row todo">${lab("المطلوب منك", "আপনার করণীয়")}${bi(c.coach.ar, c.coach.bn)}</div>
</section>`;
}

export function buildReportHTML(d, { site = "", fontBase, issued = "" } = {}) {
  const kpi = (v, ar, bn, c) => `<div class="k"><div class="kl">${esc(ar)} · <span class="bn" dir="ltr">${esc(bn)}</span></div><b style="color:${c}">${esc(v)}</b></div>`;
  const sc = d.scenarios.map(s => `<tr class="${s.actual ? "act" : ""}"><td>${s.actual ? `${s.count} ← أنت · <span class="bn" dir="ltr">আপনি</span>` : s.count}</td>
    <td class="n">${s.pct.toFixed(2)}%</td><td class="n">${s.sR.toFixed(2)}</td><td class="n">${s.rate.toFixed(2)}</td><td class="n">${n2(s.bonus)}</td><td class="n ${s.diff > 0 ? "up" : ""}">${s.actual ? "—" : "+" + n2(s.diff)}</td></tr>`).join("");
  const t = d.target, nmAr = nextMonth(d.period, MON_AR), nmBn = nextMonth(d.period, MON_BN);
  // نقاط الهدف: الأرقام أولاً ثم «المطلوب منك» من الشكاوى المحسوبة (بلا تكرار، 3 على الأكثر)
  const goals = [];
  if (t) {
    const cond = `${t.max === 0 ? "صفر شكاوى" : t.max === 1 ? "شكوى واحدة أو أقل" : t.max + " شكاوى أو أقل"}${t.ratingTarget ? " + تقييم " + t.ratingTarget.toFixed(2) : ""}`;
    const condBn = `সর্বোচ্চ ${t.max}টি অভিযোগ${t.ratingTarget ? " + রেটিং " + t.ratingTarget.toFixed(2) : ""}`;
    goals.push(t.gain > 0
      ? [`${cond} ← سعر الغسلة ${t.rate.toFixed(2)} بدل ${t.curRate.toFixed(2)} (+${n2(t.gain)} ريال على ${d.base} غسلة).`,
         `${condBn} → প্রতি ওয়াশ ${t.curRate.toFixed(2)} এর বদলে ${t.rate.toFixed(2)} (${d.base} ওয়াশে +${n2(t.gain)} রিয়াল)।`]
      : [`حافظ على ${cond}: سعر الغسلة ${t.rate.toFixed(2)} ريال — أعلى شريحة.`, `${condBn} বজায় রাখুন: প্রতি ওয়াশ ${t.rate.toFixed(2)} রিয়াল — সর্বোচ্চ ধাপ।`]);
  }
  const seen = new Set();
  d.approvedCards.forEach(c => { if (c.coach.ar && !seen.has(c.coach.ar) && seen.size < 3) { seen.add(c.coach.ar); goals.push([c.coach.ar, c.coach.bn]); } });
  const fn = firstName(d.name);
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>تقرير شكاوى ${esc(d.name)} — ${esc(d.period)}</title>
<style>${fontFaces(fontBase)}
@page{size:A4;margin:12mm 12mm 14mm;@bottom-center{content:counter(page) " من " counter(pages);font-size:8pt;color:#64748b}}
*{box-sizing:border-box}html,body{margin:0;background:#f1f5f9}
body{font-family:${FONT_STACK};color:#0f172a;font-size:10.5pt;line-height:1.55}
.page{width:210mm;margin:0 auto;background:#fff;padding:12mm}
.bar{position:sticky;top:0;z-index:5;display:flex;gap:8px;justify-content:center;align-items:center;padding:10px;background:#0f172a;color:#fff;font-size:13px}
.bar button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:9px 18px;background:#e8712b;color:#fff;cursor:pointer}.bar button:disabled{opacity:.5;cursor:wait}
.bn{font-family:'Noto Sans Bengali',${FONT_STACK};unicode-bidi:isolate}
.bi .bn{display:block;text-align:left;color:#334155;font-size:9.5pt;margin-top:.8mm}
.mut{color:#64748b}
.hd{display:flex;align-items:flex-start;gap:5mm;border-bottom:3px solid #e8712b;padding-bottom:3mm;margin-bottom:5mm}
.hd h1{margin:0;font-size:17pt}.hd .sub{font-size:11pt;font-weight:600}.hd .who{font-size:10pt;color:#334155;margin-top:1mm}
.org{margin-inline-start:auto;text-align:left;color:#e8712b;font-weight:700;font-size:10pt;display:flex;gap:3mm;align-items:center}.org img{width:12mm;height:12mm;object-fit:contain}
.msg{background:#f8fafc;border:1px solid #e2e8f0;border-radius:3mm;padding:3mm 4mm;margin-bottom:5mm}
.ks{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin-bottom:5mm}
.k{border:1px solid #e2e8f0;border-radius:3mm;padding:2.5mm 3mm}.k .kl{font-size:8.5pt;color:#64748b}.k .kl .bn{display:inline}.k b{display:block;font-size:19pt;line-height:1.3}
h2{font-size:13pt;margin:6mm 0 3mm;border-inline-start:4px solid #e8712b;padding-inline-start:3mm;break-after:avoid}h2 .bn{font-size:9.5pt;color:#64748b;margin-inline-start:3mm;font-weight:400}
table{width:100%;border-collapse:collapse;font-size:9.5pt;break-inside:avoid}th,td{border-bottom:1px solid #e2e8f0;padding:1.8mm 1.5mm;text-align:center}
th{background:#f8fafc;font-size:9pt}th .bn{display:block;font-size:8pt;color:#64748b;font-weight:400}td.n{direction:ltr;white-space:nowrap}
tr.act td{background:#fef2f2;font-weight:700}td.up{color:#047857;font-weight:700}
.goal{border:1px solid #bfdbfe;border-radius:3mm;padding:3mm 4mm;background:#eff6ff;break-inside:avoid}.goal ul{margin:0;padding-inline-start:5mm}.goal li{margin:1.5mm 0}
.sec{margin:7mm 0 3mm;padding:3mm 4mm;border-radius:2.5mm;color:#fff;display:flex;justify-content:space-between;gap:4mm;break-after:avoid}.sec.red{background:#b42318}.sec.green{background:#067647}
.sec h2{border:0;margin:0;padding:0;color:#fff}.sec h2 .cnt{display:inline-block;background:#fff;border-radius:10px;padding:0 2.5mm;font-size:9pt;margin-inline-start:2mm}.sec.red .cnt{color:#b42318}.sec.green .cnt{color:#067647}
.sec .bn{color:#fff;font-size:9.5pt}.sec .bi .bn{color:#fff}.sec .sm{font-size:9.5pt;max-width:48%}
.card{border:1px solid #e2e8f0;border-radius:3mm;padding:3mm 4mm;margin-bottom:4mm;break-inside:avoid;page-break-inside:avoid}
.card.red{border-inline-end:4px solid #b42318}.card.green{border-inline-end:4px solid #067647}
.ch{display:flex;justify-content:space-between;gap:4mm;padding-bottom:2mm;border-bottom:1px solid #f1f5f9}.ch h3{margin:0;font-size:13pt}.ch .sub{font-size:9pt;color:#475569}.ch .dt{font-size:9pt;text-align:left}.ch .dt .bn{display:inline}
.row{display:grid;grid-template-columns:30mm 1fr;gap:3mm;padding:2mm 0;border-bottom:1px solid #f1f5f9}
.lb b{display:block;font-size:9.5pt}.lb .bn{font-size:8.5pt;color:#64748b}
.reason .ar{font-weight:700}.reason.red .ar{color:#b42318}.reason.green .ar{color:#067647}
.pics{display:grid;grid-template-columns:1fr 1fr;gap:2.5mm;margin:2.5mm 0}
.ph{position:relative;height:60mm;border:1px solid #e2e8f0;border-radius:2mm;background:#f8fafc;display:flex;align-items:center;justify-content:center;overflow:hidden;text-decoration:none}
.ph img{width:100%;height:100%;object-fit:contain}.ph .pn{position:absolute;bottom:1mm;inset-inline-start:1.5mm;font-size:7.5pt;color:#1d4ed8;background:rgba(255,255,255,.85);border-radius:1.5mm;padding:0 1.5mm}.ph .pn .bn{display:inline}
.nopic{font-size:9pt;color:#64748b;background:#f8fafc;border-radius:2mm;padding:2mm 3mm;margin:2.5mm 0}.nopic .bn{display:inline}
.todo{background:#eff6ff;border-radius:2mm;padding:2mm 3mm;border:0}
.empty{color:#64748b;font-size:10pt;margin:2mm 0 4mm}
.note{font-size:8.5pt;color:#64748b;margin-top:1.5mm}
.ft{margin-top:6mm;padding-top:2mm;border-top:1px solid #e2e8f0;font-size:8.5pt;color:#64748b}
@media print{html,body{background:#fff}.bar{display:none}.page{width:auto;margin:0;padding:0}}
</style></head><body>
<div class="bar"><span id="st">جارٍ تحميل الصور والخط… · ছবি লোড হচ্ছে…</span><button id="pr" disabled>طباعة / حفظ PDF</button></div>
<div class="page">
<header class="hd"><div><h1>تقرير شكاوى العملاء — ${esc(periodAr(d.period))}</h1><div class="sub bn" dir="ltr">গ্রাহক অভিযোগ রিপোর্ট — ${esc(periodBn(d.period))}</div>
  <div class="who">${esc(d.name)} · <b dir="ltr">${esc(d.sid)}</b></div></div>
  <div class="org"><div>مؤسسة دلو ورغوة<br/><span dir="ltr">Dalu Warghwah Est.</span></div><img src="${esc(site)}/brand-mark.png" alt=""/></div></header>
<div class="msg">${bi(`أخي ${fn}، هذا تقرير بكل شكاوى العملاء عليك في شهر ${MON_AR[(+String(d.period).split("-")[1] || 1) - 1] || ""}، مع الصور. الهدف أن تعرف بالضبط أين الأخطاء وكيف تتجنّبها، فتزيد مكافأتك.`,
  `ভাই ${fn}, এটি ${MON_BN[(+String(d.period).split("-")[1] || 1) - 1] || ""} মাসে আপনার বিরুদ্ধে আসা সব গ্রাহক অভিযোগের রিপোর্ট, ছবিসহ। উদ্দেশ্য হলো আপনি ঠিক কোথায় ভুল হচ্ছে তা জানবেন এবং কীভাবে এড়াবেন — যাতে আপনার বোনাস বাড়ে।`)}</div>
<div class="ks">${kpi(d.total, "الشكاوى", "মোট অভিযোগ", "#0f172a")}${kpi(d.approved, "محسوبة عليك", "গণনা হয়েছে", "#b42318")}${kpi(d.rejected, "مرفوضة لصالحك", "বাতিল হয়েছে", "#067647")}${kpi(d.hasOps ? d.pct.toFixed(2) + "%" : "—", "نسبة الشكاوى", "অভিযোগের হার", "#b42318")}</div>
${d.pending ? `<div class="note">${bi(`${d.pending} شكوى ما زالت بانتظار القرار ولم تدخل الحساب.`, `${d.pending}টি অভিযোগের সিদ্ধান্ত এখনও বাকি, তাই হিসাবে ধরা হয়নি।`)}</div>` : ""}
${d.hasOps ? `<h2>ماذا كلّفتك الشكاوى؟ <span class="bn" dir="ltr">অভিযোগে আপনার কত ক্ষতি হয়েছে?</span></h2>
<table><thead><tr><th>محسوبة<span class="bn" dir="ltr">গণনা</span></th><th>النسبة<span class="bn" dir="ltr">হার</span></th><th>ريال السلامة<span class="bn" dir="ltr">সেফটি</span></th><th>سعر الغسلة<span class="bn" dir="ltr">প্রতি ওয়াশ</span></th><th>المكافأة (${d.base} غسلة)<span class="bn" dir="ltr">বোনাস (${d.base} ওয়াশ)</span></th><th>الزيادة<span class="bn" dir="ltr">বৃদ্ধি</span></th></tr></thead><tbody>${sc}</tbody></table>
<div class="note">سعر الغسلة = 2 + ريال الجودة (${n2(d.scenarios[0].qR)} لتقييم ${d.rating.toFixed(2)}) + ريال السلامة · HR-POL-003 · المسير المعتمد هو المرجع.</div>
<h2>هدف ${esc(nmAr)} <span class="bn" dir="ltr">${esc(nmBn)}ের লক্ষ্য</span></h2>
<div class="goal"><ul>${goals.map(g => `<li>${bi(g[0], g[1])}</li>`).join("")}</ul></div>` : `<div class="note">${bi("لا توجد أرقام تشغيل لهذا الشهر بعد، فلا تُحسب النسبة ولا المكافأة.", "এই মাসের অপারেশন ডেটা এখনও নেই, তাই হার ও বোনাস হিসাব করা যায়নি।")}</div>`}
<div class="sec red"><div><h2>الشكاوى المحسوبة عليك<span class="cnt">${d.approved}</span></h2><div class="bn" dir="ltr">যে অভিযোগগুলো আপনার বিরুদ্ধে গণনা হয়েছে</div></div>
  <div class="sm">${bi("هذه أثّرت على مكافأتك — ركّز عليها.", "এগুলো আপনার বোনাস কমিয়েছে — এগুলোতে মনোযোগ দিন।")}</div></div>
${d.approvedCards.length ? d.approvedCards.map(c => cardHTML(c, "red")).join("") : `<div class="empty">${bi("لا شكاوى محسوبة عليك هذا الشهر — ممتاز.", "এই মাসে আপনার বিরুদ্ধে কোনো অভিযোগ গণনা হয়নি — চমৎকার।")}</div>`}
<div class="sec green"><div><h2>الشكاوى المرفوضة لصالحك<span class="cnt">${d.rejected}</span></h2><div class="bn" dir="ltr">যে অভিযোগগুলো আপনার পক্ষে বাতিল হয়েছে</div></div>
  <div class="sm">${bi("لم تؤثّر على مكافأتك، لكن فيها دروس مفيدة.", "এগুলো বোনাসে প্রভাব ফেলেনি, তবে শেখার বিষয় আছে।")}</div></div>
${d.rejectedCards.length ? d.rejectedCards.map(c => cardHTML(c, "green")).join("") : `<div class="empty">${bi("لا شكاوى مرفوضة هذا الشهر.", "এই মাসে কোনো অভিযোগ বাতিল হয়নি।")}</div>`}
<div class="ft">مؤسسة دلو ورغوة التجارية · شريك سويتر · الأرقام بالريال السعودي${issued ? ` · تاريخ الإصدار <span dir="ltr">${esc(issued)}</span>` : ""}</div>
</div>
<script>(function(){var b=document.getElementById("pr"),s=document.getElementById("st");
var imgs=[].slice.call(document.images),wait=imgs.map(function(i){return i.complete?Promise.resolve():new Promise(function(r){i.onload=i.onerror=r;});});
var f=(document.fonts&&document.fonts.ready)?document.fonts.ready:Promise.resolve();
var done=false;function ready(){if(done)return;done=true;var bad=imgs.filter(function(i){return !i.naturalWidth;}).length;
s.textContent=bad?("تعذّر تحميل "+bad+" صورة — راجعها قبل الطباعة"):"جاهز للطباعة · প্রিন্টের জন্য প্রস্তুত";b.disabled=false;}
Promise.all([f].concat(wait)).then(ready);setTimeout(ready,15000);
b.addEventListener("click",function(){window.print();});})();</script>
</body></html>`;
}
