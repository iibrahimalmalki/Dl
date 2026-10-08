// قراءة/حفظ صلاحيات بوابة البايكر (biker_tab_rules) — قبل تطبيق docs/sql/biker_tabs.sql: الوضع الافتراضي بلا خطأ
import { supabase } from "./supabase";
import { toRows } from "./bikerTabs";

const isMissing = e => !!e && (e.code === "PGRST205" || e.code === "42P01" || /biker_tab_rules/.test(String(e.message || "")) && /does not exist|schema cache/i.test(String(e.message || "")));

// ⇒ {rules, missing, error}
export async function loadTabRules() {
  try {
    const { data, error } = await supabase.from("biker_tab_rules").select("tab_key,visible,in_bottom_nav,updated_at");
    if (error) return { rules: [], missing: isMissing(error), error: isMissing(error) ? null : error };
    return { rules: data || [], missing: false, error: null };
  } catch (e) { return { rules: [], missing: false, error: e }; }
}

export async function saveTabRules(map, uid) {
  const { error } = await supabase.from("biker_tab_rules").upsert(toRows(map, uid), { onConflict: "tab_key" });
  if (error) throw error;
}
