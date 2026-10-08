// صلاحيات بوابة البايكر: أيّ التبويبات تظهر، وأيّها في الشريط السفلي للجوال — منطق نقي (بلا DOM ولا Supabase)
// المصدر: جدول biker_tab_rules (docs/sql/biker_tabs.sql) — صف لكل تبويب، إعداد عام لكل البايكرز.
// الجدول الفارغ أو غير الموجود ⇒ الوضع الافتراضي (كل التبويبات ظاهرة والشريط السفلي كما كان).

// ترتيب التبويبات كما في البوابة. «ملفي» (profile) الصفحة الرئيسية: ظاهر دائماً وأول الشريط السفلي.
export const BIKER_TABS = [
  { k: "profile", ar: "ملفي", bn: "প্রোফাইল", ic: "home", bar: "الرئيسية", barBn: "হোম", fixed: true },
  { k: "handover", ar: "الدراجة", bn: "বাইক", ic: "bike" },
  { k: "fuel", ar: "الوقود", bn: "জ্বালানি", ic: "fuel" },
  { k: "perf", ar: "أدائي", bn: "আমার কাজ", ic: "performance" },
  { k: "docs", ar: "وثائقي", bn: "আমার কাগজপত্র", ic: "doc" },
  { k: "assets", ar: "العهدة", bn: "সরঞ্জাম", ic: "key" },
  { k: "daily", ar: "الاستلام", bn: "ডেলিভারি", ic: "inbox" },
  { k: "academy", ar: "الأكاديمية", bn: "একাডেমি", ic: "star" },
];
export const TAB_KEYS = BIKER_TABS.map(t => t.k);
export const RULE_KEYS = BIKER_TABS.filter(t => !t.fixed).map(t => t.k);   // ما يمكن التحكم فيه
export const DEFAULT_BOTTOM = ["handover", "daily", "academy"];             // بعد «الرئيسية»
export const MAX_BOTTOM = 3;                                                // + «الرئيسية» + «المزيد» = 5 أزرار

// rules: [{tab_key, visible, in_bottom_nav}] ⇒ خريطة {k: {visible, bottom}} لكل تبويب قابل للتحكم
export function ruleMap(rules) {
  const by = {};
  (rules || []).forEach(r => { if (r && RULE_KEYS.includes(r.tab_key)) by[r.tab_key] = r; });
  const out = {};
  RULE_KEYS.forEach(k => {
    const r = by[k];
    out[k] = {
      visible: r && typeof r.visible === "boolean" ? r.visible : true,
      bottom: r && typeof r.in_bottom_nav === "boolean" ? r.in_bottom_nav : DEFAULT_BOTTOM.includes(k),
    };
  });
  return out;
}

// ما يراه البايكر: nav (القائمة الجانبية/«المزيد») و bottom (الشريط السفلي) و isOpen(k)
export function resolveTabs(rules) {
  const m = ruleMap(rules);
  const isOpen = k => k === "profile" || !!(m[k] && m[k].visible);
  const nav = BIKER_TABS.filter(t => isOpen(t.k)).map(({ k, ar, bn }) => ({ k, ar, bn }));
  const extra = RULE_KEYS.filter(k => m[k].visible && m[k].bottom).slice(0, MAX_BOTTOM);
  const bottom = ["profile", ...extra].map(k => {
    const t = BIKER_TABS.find(x => x.k === k);
    return { k, ar: t.bar || t.ar, bn: t.barBn || t.bn, ic: t.ic };
  });
  return { nav, bottom, isOpen };
}

// تحويل خريطة الإعداد (من صفحة الإدارة) إلى صفوف للحفظ — تبويب مخفي لا يبقى في الشريط السفلي
export function toRows(map, by) {
  return RULE_KEYS.map(k => {
    const v = (map && map[k]) || { visible: true, bottom: false };
    return { tab_key: k, visible: !!v.visible, in_bottom_nav: !!(v.visible && v.bottom), updated_by: by || null, updated_at: new Date().toISOString() };
  });
}

export const bottomCount = map => RULE_KEYS.filter(k => map[k] && map[k].visible && map[k].bottom).length;
