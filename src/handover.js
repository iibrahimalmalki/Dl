// تسليم/استلام الدراجة — بنود المستلَمات وصور الصندوق والتحقق من النموذج (منطق نقي، بلا DOM).

// قائمة التحقق (حالة الدراجة) — بند box يسأل عن سلامة الصندوق، لا عن استلامه
export const CHECKLIST = [
  { id: "engine", ar: "صوت المحرك سليم", bn: "ইঞ্জিনের শব্দ ঠিক", short: "صوت المحرك", en: "Engine sound" },
  { id: "brakes", ar: "الفرامل تعمل", bn: "ব্রেক কাজ করে", short: "الفرامل", en: "Brakes" },
  { id: "tires", ar: "الإطارات سليمة", bn: "টায়ার ঠিক আছে", short: "الإطارات", en: "Tyres" },
  { id: "lights", ar: "الأنوار والإشارات", bn: "লাইট ও সিগন্যাল", short: "الأنوار والإشارات", en: "Lights & signals" },
  { id: "mirrors", ar: "المرايا سليمة", bn: "আয়না ঠিক আছে", short: "المرايا", en: "Mirrors" },
  { id: "horn", ar: "البوق (الزمّور)", bn: "হর্ন", short: "البوق", en: "Horn" },
  { id: "chain", ar: "السلسلة والجنزير", bn: "চেইন", short: "السلسلة والجنزير", en: "Chain" },
  { id: "oil", ar: "مستوى الزيت", bn: "তেলের স্তর", short: "مستوى الزيت", en: "Oil level" },
  { id: "box", ar: "الصندوق سليم ومثبّت", bn: "বক্স ঠিক ও শক্তভাবে লাগানো", short: "سلامة الصندوق وتثبيته", en: "Box condition & mounting" },
  { id: "plate_on", ar: "اللوحة مركّبة", bn: "প্লেট লাগানো", short: "اللوحة", en: "Number plate" },
  { id: "papers", ar: "الاستمارة مع الدراجة", bn: "কাগজপত্র সাথে আছে", short: "الاستمارة", en: "Registration papers" },
];
// بنود قديمة تبقى معروضة في السجلات السابقة (قبل تقسيم «اللوحة والاستمارة»)
export const LEGACY_CHECKLIST = [
  { id: "plate", ar: "اللوحة والاستمارة", bn: "প্লেট ও কাগজপত্র", short: "اللوحة والاستمارة", en: "Plate & registration" },
];
// بنود قائمة التحقق الموجودة فعلاً في سجل (الحالية + القديمة إن وُجدت فيه)
// السجل القديم (بمفتاح plate) يُعرض كما حُفظ: لا تُضاف إليه البنود الجديدة التي لم تكن فيه
export const checklistOf = ck => { const k = ck || {}, has = id => k[id] === true || k[id] === false, legacy = LEGACY_CHECKLIST.some(c => has(c.id));
  return [...CHECKLIST, ...LEGACY_CHECKLIST].filter(c => has(c.id) || (!legacy && CHECKLIST.includes(c))); };

// المستلَمات: نعم/لا إلزامي لكل بند؛ للمفاتيح عدد 0–3
export const RECEIVED_ITEMS = [
  { id: "box", ar: "صندوق الغسيل", bn: "ওয়াশ বক্স", en: "Wash box", withNote: true },
  { id: "bike_key", ar: "مفتاح الدراجة", bn: "বাইকের চাবি", en: "Bike key", count: "bike_keys" },
  { id: "box_key", ar: "مفتاح الصندوق", bn: "বক্সের চাবি", en: "Box key", count: "box_keys" },
];
// صور الصندوق الخمس (إلزامية إذا استُلم الصندوق)
export const BOX_PHOTOS = [
  { id: "box_front", ar: "الصندوق — أمام", bn: "বক্স — সামনে", tag: "أمام", folder: "handover-box-front" },
  { id: "box_back", ar: "الصندوق — خلف", bn: "বক্স — পিছনে", tag: "خلف", folder: "handover-box-back" },
  { id: "box_right", ar: "الصندوق — يمين", bn: "বক্স — ডান", tag: "يمين", folder: "handover-box-right" },
  { id: "box_left", ar: "الصندوق — يسار", bn: "বক্স — বাম", tag: "يسار", folder: "handover-box-left" },
  { id: "box_inside", ar: "الصندوق — من الداخل (مفتوحاً)", bn: "বক্স — ভিতরে (খোলা)", tag: "داخل", folder: "handover-box-inside" },
];
export const BIKE_PHOTOS = ["front", "back", "right", "left"];

// received: {box: true|"note"|false|null, bike_key, box_key: true|false|null, bike_keys, box_keys, reasons:{[id]:text}}
// «نعم مع ملاحظة» للصندوق ("note"): الصندوق موجود ويوثَّق بصوره، والملاحظة في reasons.box
export const emptyReceived = () => ({ box: null, bike_key: null, box_key: null, bike_keys: 1, box_keys: 1, reasons: {} });

// items_ok: كل بنود قائمة التحقق سليمة وكل المستلَمات «نعم»
export const itemsOk = (checks, received, checklistIds) =>
  (checklistIds || []).every(id => !!(checks || {})[id]) && RECEIVED_ITEMS.every(it => !!received && received[it.id] === true);
// تنبيه قبل الحفظ عند إزالة علامة 3 بنود أو أكثر (لمنع الإزالة بالخطأ)
export const badChecksConfirm = n => n >= 3 ? `حدّدت ${n} بنود غير سليمة — هل هذا صحيح؟ · আপনি ${n} টি সমস্যা চিহ্নিত করেছেন — ঠিক আছে?` : null;

// التحقق من النموذج → أول رسالة خطأ (عربي · বাংলা) أو null
// f: {odometer, photos:{front,back,right,left,odometer, box_front…}, received, pledge}
export function validateHandover(f) {
  const p = f.photos || {}, r = f.received || {};
  if (!String(f.odometer ?? "").trim() || !(Number(f.odometer) >= 0)) return "أدخل قراءة العدّاد · ওডোমিটার লিখুন";
  if (!BIKE_PHOTOS.every(k => p[k])) return "التقط صور الاتجاهات الأربعة · চারদিকের ছবি তুলুন";
  if (!p.odometer) return "أرفق صورة العدّاد · ওডোমিটারের ছবি দিন";
  for (const it of RECEIVED_ITEMS) {
    if (it.withNote && r[it.id] === "note") { if (!String((r.reasons || {})[it.id] || "").trim()) return `اكتب الملاحظة على «${it.ar}» · নোট লিখুন`; continue; }
    if (r[it.id] !== true && r[it.id] !== false) return `أجب عن «${it.ar}»: نعم أو لا · «${it.bn}» হ্যাঁ বা না বলুন`;
    if (r[it.id] === false && !String((r.reasons || {})[it.id] || "").trim()) return `اكتب سبب «لا» لـ«${it.ar}» · কারণ লিখুন`;
    if (it.count && r[it.id] === true) {
      const n = r[it.count];
      if (!Number.isInteger(n) || n < 0 || n > 3) return `عدد ${it.ar} من 0 إلى 3 · চাবির সংখ্যা ০–৩`;
      if (n === 0) return `اخترت «نعم» لـ«${it.ar}» فالعدد لا يكون 0 · সংখ্যা ০ হতে পারে না`;
    }
  }
  if ((r.box === true || r.box === "note") && !BOX_PHOTOS.every(b => p[b.id])) return "التقط صور الصندوق الخمس · বক্সের পাঁচটি ছবি তুলুন";
  if (!f.pledge) return "يجب الموافقة على التعهّد قبل الحفظ · সংরক্ষণের আগে অঙ্গীকারে সম্মতি দিন";
  return null;
}

// ما يُحفظ تحت checklist.received (العدد والسبب فقط لما ينطبق)
export function receivedRecord(r) {
  const out = { box: r.box === true || r.box === "note", bike_key: r.bike_key === true, box_key: r.box_key === true, reasons: {} };
  if (r.box === "note") out.box_note = String((r.reasons || {}).box || "").trim();
  if (out.bike_key) out.bike_keys = r.bike_keys;
  if (out.box_key) out.box_keys = r.box_keys;
  RECEIVED_ITEMS.forEach(it => { if (r[it.id] === false) out.reasons[it.id] = String(r.reasons[it.id] || "").trim(); });
  return out;
}

// ملخص سجل للعرض (السجلات القديمة بلا received ⇒ null)
export function handoverSummary(row, checklistIds) {
  const ck = row.checklist || {}, rec = ck.received || null;
  const badChecks = (checklistIds || []).filter(id => ck[id] === false);
  const missing = rec ? RECEIVED_ITEMS.filter(it => rec[it.id] === false).map(it => it.id) : [];
  const issues = handoverIssues(row);
  return { rec, badChecks, missing, issues, warn: issues.length > 0 };
}

/* ── التقرير ورسالة سويتر ── */
// الملاحظات: بنود التحقق غير السليمة + المستلَمات «لا» + «نعم مع ملاحظة» (ملاحظة البايكر تُعرض منفصلة)
// → [{key, ar, en}] بنص جاهز للعرض والرسالة
export function handoverIssues(row) {
  const ck = (row && row.checklist) || {}, notes = ck.notes || {}, rec = ck.received || null, out = [];
  checklistOf(ck).forEach(c => { if (ck[c.id] === false) { const n = String(notes[c.id] || "").trim();
    out.push({ key: "ck:" + c.id, ar: `${c.short}: غير سليم${n ? " — " + n : ""}`, en: `${c.en}: not OK${n ? " — " + n : ""}` }); } });
  if (rec) RECEIVED_ITEMS.forEach(it => {
    const why = String(((rec.reasons || {})[it.id]) || "").trim();
    if (rec[it.id] === false) out.push({ key: "rc:" + it.id, ar: `${it.ar}: لم يُستلم${why ? " — " + why : ""}`, en: `${it.en}: not received${why ? " — " + why : ""}` });
    else if (it.id === "box" && rec.box_note) out.push({ key: "rc:box_note", ar: `${it.ar}: مستلَم مع ملاحظة — ${rec.box_note}`, en: `${it.en}: received with a note — ${rec.box_note}` });
  });
  return out;
}

// التاريخ DD/MM/YYYY والوقت 12 ساعة بتوقيت الرياض (UTC+3)، بأرقام لاتينية
export function riyadhStamp(t) {
  const d = new Date(new Date(t).getTime() + 3 * 3600e3), p = n => String(n).padStart(2, "0");
  const h = d.getUTCHours(), h12 = h % 12 || 12, pm = h >= 12;
  return { date: `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`, ar: `${p(h12)}:${p(d.getUTCMinutes())} ${pm ? "م" : "ص"}`, en: `${p(h12)}:${p(d.getUTCMinutes())} ${pm ? "PM" : "AM"}` };
}
const makeAr = m => String(m || "").replace(/\s*\([^)]*\)\s*/g, " ").trim();
const makeEn = m => { const x = String(m || "").match(/\(([^)]+)\)/); return x ? x[1].trim() : makeAr(m); };

// رسالة سويتر: عربي ثم إنجليزي. exclude: مفاتيح ملاحظات يستبعدها المالك (منها "biker_note")
export function handoverSweaterMessage(row, vehicle, { exclude = [] } = {}) {
  const v = vehicle || {}, ret = row.direction === "return", st = riyadhStamp(row.created_at);
  const ck = row.checklist || {}, rec = ck.received || null, ex = new Set(exclude);
  const issues = handoverIssues(row).filter(i => !ex.has(i.key));
  const bikerNote = !ex.has("biker_note") ? String(row.condition_notes || "").trim() : "";
  const tick = (it, lang) => { if (!rec) return null; const ok = rec[it.id] === true, n = it.count && ok ? ` (${rec[it.count]})` : "", flag = it.id === "box" && rec.box_note ? " ⚠" : "";
    return `${lang === "en" ? it.en : it.ar}${n} ${ok ? "✓" : "✗"}${flag}`; };
  const order = ["bike_key", "box", "box_key"].map(id => RECEIVED_ITEMS.find(i => i.id === id));
  const sec = lang => {
    const A = lang === "ar", L = [];
    L.push(A ? `🏍️ تقرير ${ret ? "تسليم" : "استلام"} دراجة — دلو ورغوة (شريك 47)` : `🏍️ Motorcycle ${ret ? "return" : "handover"} report — Dalu Warghwah (SSP ID47)`);
    L.push(A ? `التاريخ: ${st.date} — الوقت: ${st.ar}` : `Date: ${st.date} — Time: ${st.en}`);
    const plate = A ? (row.plate || v.plate || "—") : (v.plate_en || row.plate || v.plate || "—");
    const mk = [A ? makeAr(v.make) : makeEn(v.make), v.model_year].filter(Boolean).join(" ");
    L.push((A ? "الدراجة: " : "Motorcycle: ") + [plate, mk || null, v.vin ? (A ? "رقم الهيكل: " : "VIN: ") + v.vin : null].filter(Boolean).join(" — "));
    L.push((A ? (ret ? "المسلِّم: " : "المستلم: ") : (ret ? "Returned by: " : "Received by: ")) + `${row.biker_name || "—"}${row.biker_employee_id ? ` (${row.biker_employee_id})` : ""}`);
    if (row.odometer != null) L.push(A ? `العدّاد: ${row.odometer} كم` : `Odometer: ${row.odometer} km`);
    if (rec) L.push((A ? "المستلَمات: " : "Items: ") + order.map(it => tick(it, lang)).join(" · "));
    L.push("");
    if (issues.length || bikerNote) {
      if (issues.length) { L.push(A ? "ملاحظات تحتاج معالجة:" : "Issues to resolve:"); issues.forEach((i, k) => L.push(`${k + 1}. ${A ? i.ar : i.en}`)); }
      if (bikerNote) L.push((A ? "ملاحظة البايكر: " : "Rider note: ") + bikerNote);
      L.push("");
      L.push(A ? "نرجو معالجة الملاحظات أعلاه وإفادتنا بالموعد." : "Please resolve the above and advise the expected date.");
    } else L.push(A ? `تم ${ret ? "التسليم" : "الاستلام"} بلا ملاحظات ✓` : `${ret ? "Returned" : "Received"} with no issues ✓`);
    return L.join("\n");
  };
  return sec("ar") + "\n\n" + sec("en");
}

/* ── النموذج بالخطوات (بوابة البايكر) ── */
// سبع خطوات بزر أساسي واحد لكل شاشة؛ «صور الصندوق» تُتخطّى إن لم يُستلَم الصندوق
export const HANDOVER_STEPS = [
  { k: "odo", ar: "العملية والعدّاد", bn: "ধরন ও ওডোমিটার" },
  { k: "photos", ar: "صور الدراجة", bn: "বাইকের ছবি" },
  { k: "check", ar: "قائمة التحقق", bn: "চেকলিস্ট" },
  { k: "recv", ar: "المستلَمات", bn: "যা পেয়েছি" },
  { k: "box", ar: "صور الصندوق", bn: "বক্সের ছবি" },
  { k: "notes", ar: "الأضرار والملاحظات", bn: "ক্ষতি ও নোট" },
  { k: "review", ar: "مراجعة وحفظ", bn: "দেখে সংরক্ষণ" },
];
export const boxNeeded = r => !!r && (r.box === true || r.box === "note");
export const stepSkipped = (i, f) => HANDOVER_STEPS[i] && HANDOVER_STEPS[i].k === "box" && !boxNeeded(f.received);
// الخطوة التالية/السابقة مع التخطّي
export const stepMove = (i, d, f) => { let j = i + d; while (j > 0 && j < HANDOVER_STEPS.length - 1 && stepSkipped(j, f)) j += d; return Math.max(0, Math.min(HANDOVER_STEPS.length - 1, j)); };
// العدّاد: أرقام عربية/بنغالية ← لاتينية
export const odoNum = v => String(v ?? "").replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x0660).replace(/[০-৯]/g, d => d.charCodeAt(0) - 0x09E6).replace(/[^\d.]/g, "");

// خطأ الخطوة i بجانب الحقل نفسه → {field, ar, bn} أو null
// f: {odometer, photos, checks:{[id]: true|false|undefined}, received, pledge}
export function stepError(i, f) {
  const k = (HANDOVER_STEPS[i] || {}).k, p = f.photos || {}, r = f.received || {}, ck = f.checks || {};
  const E = (field, ar, bn) => ({ field, ar, bn });
  if (k === "odo") {
    const o = odoNum(f.odometer);
    if (!o || !(Number(o) >= 0)) return E("odometer", "أدخل قراءة العدّاد بالأرقام.", "ওডোমিটার সংখ্যায় লিখুন।");
    if (!p.odometer) return E("ph_odometer", "التقط صورة العدّاد.", "ওডোমিটারের ছবি তুলুন।");
  }
  if (k === "photos") { const m = BIKE_PHOTOS.find(x => !p[x]); if (m) return E("ph_" + m, "التقط الصور الأربع للدراجة.", "বাইকের চারদিকের ছবি তুলুন।"); }
  if (k === "check") { const c = CHECKLIST.find(x => ck[x.id] !== true && ck[x.id] !== false); if (c) return E("ck_" + c.id, `اختر «سليم» أو «غير سليم» لـ«${c.ar}».`, `«${c.bn}» — ঠিক বা সমস্যা বাছুন।`); }
  if (k === "recv") for (const it of RECEIVED_ITEMS) {
    const why = String((r.reasons || {})[it.id] || "").trim();
    if (it.withNote && r[it.id] === "note") { if (!why) return E("rc_" + it.id, `اكتب الملاحظة على «${it.ar}».`, "সমস্যাটি লিখুন।"); continue; }
    if (r[it.id] !== true && r[it.id] !== false) return E("rc_" + it.id, `أجب عن «${it.ar}».`, `«${it.bn}» — উত্তর দিন।`);
    if (r[it.id] === false && !why) return E("rc_" + it.id, `اكتب سبب «لا» لـ«${it.ar}».`, "কারণ লিখুন।");
    if (it.count && r[it.id] === true && !(Number.isInteger(r[it.count]) && r[it.count] >= 1 && r[it.count] <= 3)) return E("rc_" + it.id, `اختر عدد ${it.ar}.`, "চাবির সংখ্যা বাছুন।");
  }
  if (k === "box" && boxNeeded(r)) { const b = BOX_PHOTOS.find(x => !p[x.id]); if (b) return E("ph_" + b.id, "التقط صور الصندوق الخمس.", "বক্সের পাঁচটি ছবি তুলুন।"); }
  if (k === "review" && !f.pledge) return E("pledge", "وافق على التعهّد قبل الحفظ.", "সংরক্ষণের আগে অঙ্গীকারে সম্মতি দিন।");
  return null;
}
// أول خطوة فيها خطأ (للحفظ) → {i, err} أو null
export function firstStepError(f) {
  for (let i = 0; i < HANDOVER_STEPS.length; i++) { if (stepSkipped(i, f)) continue; const e = stepError(i, f); if (e) return { i, err: e }; }
  return null;
}
