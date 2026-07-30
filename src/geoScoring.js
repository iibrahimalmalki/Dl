// نظام التقييم الجغرافي v2.0 — دلو ورغوة
export const DISTRICTS = {
  "كيشوريغانج": { en:"Kishoreganj",  M1:10,M2:10,M3:10,M4:9,M5:9,M6:9,M7:10 },
  "كوميلا":     { en:"Cumilla",      M1:10,M2:9, M3:9, M4:9,M5:9,M6:9,M7:8  },
  "براهمانباريا":{ en:"Brahmanbaria", M1:10,M2:9, M3:9, M4:9,M5:8,M6:9,M7:8  },
  "تشاندبور":   { en:"Chandpur",     M1:9, M2:9, M3:9, M4:9,M5:9,M6:9,M7:9  },
  "ناريسينغدي": { en:"Narsingdi",    M1:9, M2:9, M3:8, M4:9,M5:9,M6:9,M7:8  },
  "نواخالي":   { en:"Noakhali",     M1:9, M2:8, M3:8, M4:9,M5:8,M6:9,M7:8  },
  "تانغيل":    { en:"Tangail",      M1:9, M2:8, M3:8, M4:9,M5:8,M6:8,M7:8  },
  "ماداريبور":  { en:"Madaripur",    M1:7, M2:9, M3:9, M4:9,M5:8,M6:8,M7:8  },
  "باريسال":   { en:"Barisal",      M1:6, M2:9, M3:9, M4:9,M5:8,M6:8,M7:10 },
  "فيني":      { en:"Feni",         M1:8, M2:8, M3:8, M4:9,M5:8,M6:8,M7:8  },
  "رانغاماتي": { en:"Rangamati",    M1:1, M2:1, M3:1, M4:1,M5:1,M6:3,M7:1  },
  "باندربان":  { en:"Bandarban",    M1:1, M2:1, M3:1, M4:1,M5:1,M6:3,M7:1  },
  "كوكس بازار":{ en:"Cox's Bazar",  M1:2, M2:2, M3:3, M4:2,M5:2,M6:4,M7:3  },
  "دهاكا":     { en:"Dhaka",        M1:8, M2:7, M3:7, M4:8,M5:8,M6:8,M7:8  },
  "جيسور":     { en:"Jessore",      M1:7, M2:8, M3:8, M4:8,M5:7,M6:8,M7:7  },
  "راجشاهي":   { en:"Rajshahi",     M1:7, M2:7, M3:7, M4:8,M5:7,M6:8,M7:6  },
  "سيلهيت":    { en:"Sylhet",       M1:6, M2:7, M3:7, M4:8,M5:7,M6:8,M7:6  },
  "مومينشاهي":  { en:"Mymensingh",   M1:8, M2:8, M3:8, M4:8,M5:8,M6:8,M7:7  },
  "أخرى":      { en:"Other",        M1:5, M2:5, M3:5, M4:7,M5:7,M6:7,M7:5  },
};

// ─── مطابقة أسماء المناطق بأي لغة (عربي/إنجليزي/بنغالي) ───
// يبني خريطة أسماء بديلة تلقائياً من الحقل en + أسماء بنغالية شائعة
const BENGALI_ALIASES = {
  "কিশোরগঞ্জ":"كيشوريغانج","কুমিল্লা":"كوميلا","ব্রাহ্মণবাড়িয়া":"براهمانباريا",
  "চাঁদপুর":"تشاندبور","নরসিংদী":"ناريسينغدي","নোয়াখালী":"نواخالي","টাঙ্গাইল":"تانغيل",
  "মাদারীপুর":"ماداريبور","বরিশাল":"باريسال","ফেনী":"فيني","রাঙ্গামাটি":"رانغاماتي",
  "রাঙামাটি":"رانغاماتي","বান্দরবান":"باندربان","কক্সবাজার":"كوكس بازار","কক্সবাজর":"كوكس بازار",
  "ঢাকা":"دهاكا","যশোর":"جيسور","রাজশাহী":"راجشاهي","সিলেট":"سيلهيت","ময়মনসিংহ":"مومينشاهي"
};
const NAME_INDEX = (() => {
  const idx = {};
  for (const [ar, v] of Object.entries(DISTRICTS)) {
    idx[ar.trim().toLowerCase()] = ar;                         // العربية نفسها
    if (v.en) idx[v.en.trim().toLowerCase()] = ar;             // الإنجليزية
  }
  for (const [bn, ar] of Object.entries(BENGALI_ALIASES)) idx[bn.trim().toLowerCase()] = ar;
  return idx;
})();

export function normalizeDistrict(input) {
  if (!input) return null;
  const key = String(input).trim().toLowerCase();
  if (NAME_INDEX[key]) return NAME_INDEX[key];
  // مطابقة جزئية متسامحة (يتجاهل الفراغات وعلامات مثل ')
  const clean = key.replace(/['`’\-\s]/g, "");
  for (const [k, ar] of Object.entries(NAME_INDEX)) {
    if (k.replace(/['`’\-\s]/g, "") === clean) return ar;
  }
  return null;
}

export function calcGeoScore(district) {
  const norm = normalizeDistrict(district);
  const d = norm ? DISTRICTS[norm] : DISTRICTS[district];
  if (!d) return null;
  const score = (d.M1*2.3)+(d.M2*1.8)+(d.M3*1.8)+(d.M4*1.4)+(d.M5*0.9)+(d.M6*0.9)+(d.M7*0.9);
  const instant_reject = d.M4<5 || d.M5<5;
  const zone = instant_reject ? "red" : score>=78 ? "green" : score>=58 ? "yellow" : "red";
  return { score: Math.round(score*10)/10, zone, d, instant_reject };
}

export const DISTRICT_LIST = Object.keys(DISTRICTS);

export const SAUDI_CITIES = [
  "الرياض","جدة","مكة المكرمة","المدينة المنورة","الدمام",
  "الخبر","الطائف","تبوك","أبها","القصيم","حائل","نجران","جازان","الجوف","عرعر","ينبع"
];

export const ZONE_COLORS = {
  green:  { bg:"#f0fdf4", border:"#86efac", text:"#16a34a", label:"🟢 منطقة خضراء — استقطاب مباشر" },
  yellow: { bg:"#fffbeb", border:"#fcd34d", text:"#d97706", label:"🟡 منطقة صفراء — مقبول بشروط" },
  red:    { bg:"#fff5f5", border:"#fca5a5", text:"#dc2626", label:"🔴 منطقة محظورة — رفض فوري" },
};
