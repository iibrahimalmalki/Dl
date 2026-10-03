// تسليم/استلام الدراجة — بنود المستلَمات وصور الصندوق والتحقق من النموذج (منطق نقي، بلا DOM).

// قائمة التحقق (حالة الدراجة) — بند box يسأل عن سلامة الصندوق، لا عن استلامه
export const CHECKLIST = [
  { id: "engine", ar: "صوت المحرك سليم", bn: "ইঞ্জিনের শব্দ ঠিক" },
  { id: "brakes", ar: "الفرامل تعمل", bn: "ব্রেক কাজ করে" },
  { id: "tires", ar: "الإطارات سليمة", bn: "টায়ার ঠিক আছে" },
  { id: "lights", ar: "الأنوار والإشارات", bn: "লাইট ও সিগন্যাল" },
  { id: "mirrors", ar: "المرايا سليمة", bn: "আয়না ঠিক আছে" },
  { id: "horn", ar: "البوق (الزمّور)", bn: "হর্ন" },
  { id: "chain", ar: "السلسلة والجنزير", bn: "চেইন" },
  { id: "oil", ar: "مستوى الزيت", bn: "তেলের স্তর" },
  { id: "box", ar: "الصندوق سليم ومثبّت", bn: "বক্স ঠিক ও শক্তভাবে লাগানো" },
  { id: "plate", ar: "اللوحة والاستمارة", bn: "প্লেট ও কাগজপত্র" },
];

// المستلَمات: نعم/لا إلزامي لكل بند؛ للمفاتيح عدد 0–3
export const RECEIVED_ITEMS = [
  { id: "box", ar: "صندوق الغسيل", bn: "ওয়াশ বক্স" },
  { id: "bike_key", ar: "مفتاح الدراجة", bn: "বাইকের চাবি", count: "bike_keys" },
  { id: "box_key", ar: "مفتاح الصندوق", bn: "বক্সের চাবি", count: "box_keys" },
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

// received: {box, bike_key, box_key: true|false|null, bike_keys, box_keys, reasons:{[id]:text}}
export const emptyReceived = () => ({ box: null, bike_key: null, box_key: null, bike_keys: 1, box_keys: 1, reasons: {} });

// items_ok: كل بنود قائمة التحقق سليمة وكل المستلَمات «نعم»
export const itemsOk = (checks, received, checklistIds) =>
  (checklistIds || []).every(id => !!(checks || {})[id]) && RECEIVED_ITEMS.every(it => !!received && received[it.id] === true);

// التحقق من النموذج → أول رسالة خطأ (عربي · বাংলা) أو null
// f: {odometer, photos:{front,back,right,left,odometer, box_front…}, received, pledge}
export function validateHandover(f) {
  const p = f.photos || {}, r = f.received || {};
  if (!String(f.odometer ?? "").trim() || !(Number(f.odometer) >= 0)) return "أدخل قراءة العدّاد · ওডোমিটার লিখুন";
  if (!BIKE_PHOTOS.every(k => p[k])) return "التقط صور الاتجاهات الأربعة · চারদিকের ছবি তুলুন";
  if (!p.odometer) return "أرفق صورة العدّاد · ওডোমিটারের ছবি দিন";
  for (const it of RECEIVED_ITEMS) {
    if (r[it.id] !== true && r[it.id] !== false) return `أجب عن «${it.ar}»: نعم أو لا · «${it.bn}» হ্যাঁ বা না বলুন`;
    if (r[it.id] === false && !String((r.reasons || {})[it.id] || "").trim()) return `اكتب سبب «لا» لـ«${it.ar}» · কারণ লিখুন`;
    if (it.count && r[it.id] === true) {
      const n = r[it.count];
      if (!Number.isInteger(n) || n < 0 || n > 3) return `عدد ${it.ar} من 0 إلى 3 · চাবির সংখ্যা ০–৩`;
      if (n === 0) return `اخترت «نعم» لـ«${it.ar}» فالعدد لا يكون 0 · সংখ্যা ০ হতে পারে না`;
    }
  }
  if (r.box === true && !BOX_PHOTOS.every(b => p[b.id])) return "التقط صور الصندوق الخمس · বক্সের পাঁচটি ছবি তুলুন";
  if (!f.pledge) return "يجب الموافقة على التعهّد قبل الحفظ · সংরক্ষণের আগে অঙ্গীকারে সম্মতি দিন";
  return null;
}

// ما يُحفظ تحت checklist.received (العدد والسبب فقط لما ينطبق)
export function receivedRecord(r) {
  const out = { box: r.box === true, bike_key: r.bike_key === true, box_key: r.box_key === true, reasons: {} };
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
  return { rec, badChecks, missing, warn: badChecks.length > 0 || missing.length > 0 };
}
