// إقرار العهدة في بوابة البايكر — قواعد التحقق وبيانات العرض. دوال نقية بلا DOM ولا Supabase.
// الحالات (CONDITIONS في BikerPortal): good جيدة · fair متوسطة · poor سيئة · damaged تالفة.
// السيئة والتالفة ⇒ الملاحظة إلزامية، ويُرفع لها طلب استبدال تلقائياً (المشغّل biker_assets_replace في docs/sql/custody_replacement.sql).

export const BAD_CONDITIONS = ["poor", "damaged"];
export const isBad = c => BAD_CONDITIONS.includes(c);

// chosen: [{key, ar, bn}] الأصناف المحدّدة بترتيب العرض · rows: {[key]: {photo, condition, note}}
// ⇒ أول خطأ {key, field: "photo"|"note", ar, bn} أو null
export function declarationError(chosen = [], rows = {}) {
  for (const it of chosen) {
    const r = rows[it.key] || {};
    if (!r.photo) return { key: it.key, field: "photo",
      ar: `صوّر الصنف «${it.ar}» — الصورة إلزامية لكل صنف.`,
      bn: `«${it.bn || it.ar}» এর ছবি তুলুন — প্রতিটি সরঞ্জামের ছবি বাধ্যতামূলক।` };
    if (isBad(r.condition) && !String(r.note || "").trim()) return { key: it.key, field: "note",
      ar: `اكتب وش التالف بالضبط في «${it.ar}» — إلزامي للحالة السيئة أو التالفة.`,
      bn: `«${it.bn || it.ar}» এ ঠিক কী নষ্ট লিখুন — খারাপ বা ক্ষতিগ্রস্ত অবস্থায় বাধ্যতামূলক।` };
  }
  return null;
}

// صنف الإقرار المحفوظ في biker_assets.items
export function declarationItem(it, r, photoUrl) {
  const note = String(r.note || "").trim();
  return { key: it.key, name_ar: it.ar, name_bn: it.bn, qty: Number(r.qty) || 1, condition: r.condition, photo: photoUrl || null, note: note || null };
}

// أصناف الإقرار التي تحتاج استبدالاً + مرجع طلبها (يضيفه المشغّل: replace_request_id و replace_ref)
export function replacementsOf(items = []) {
  return (Array.isArray(items) ? items : []).filter(x => x && isBad(x.condition))
    .map(x => ({ key: x.key, name: x.name_ar, ref: x.replace_ref || null, requestId: x.replace_request_id || null }));
}

// آخر إقرار لكل بايكر أولاً، ثم الأقدم — للعرض في صفحة المالك
export function groupByBiker(rows = []) {
  const m = new Map();
  [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).forEach(r => {
    const k = String(r.biker_employee_id || r.biker_name || "—");
    if (!m.has(k)) m.set(k, { biker_employee_id: r.biker_employee_id, biker_name: r.biker_name, rows: [] });
    m.get(k).rows.push(r);
  });
  return [...m.values()];
}
