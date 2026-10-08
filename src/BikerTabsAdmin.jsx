// صلاحيات البايكرز — المالك يحدّد أيّ تبويبات بوابة البايكر تظهر، وأيّها في الشريط السفلي للجوال (إعداد عام لكل البايكرز)
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import Icon from "./Icon";
import { useToast } from "./ui";
import { KitStyle, Btn, Skel, ErrorNote } from "./uiKit";
import { humanError } from "./errors";
import { BIKER_TABS, RULE_KEYS, MAX_BOTTOM, ruleMap, resolveTabs, toRows, bottomCount } from "./bikerTabs";
import { loadTabRules, saveTabRules } from "./bikerTabsStore";

const same = (a, b) => RULE_KEYS.every(k => a[k].visible === b[k].visible && (a[k].visible && a[k].bottom) === (b[k].visible && b[k].bottom));

export default function BikerTabsAdmin() {
  const toast = useToast();
  const [state, setState] = useState(null);      // {missing, error}
  const [saved, setSaved] = useState(null);      // آخر إعداد محفوظ (خريطة)
  const [map, setMap] = useState(null);          // الإعداد الجاري تعديله
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setState(null);
    const r = await loadTabRules();
    const m = ruleMap(r.rules);
    setSaved(m); setMap(JSON.parse(JSON.stringify(m)));
    setState({ missing: r.missing, error: r.error });
  };
  useEffect(() => { load(); }, []);

  const preview = useMemo(() => map ? resolveTabs(toRows(map)) : null, [map]);
  if (!state || !map) return <Skel rows={4} />;

  const dirty = !same(map, saved);
  const nBottom = bottomCount(map);
  const set = (k, patch) => setMap(m => ({ ...m, [k]: { ...m[k], ...patch } }));
  const reset = () => setMap(ruleMap([]));
  const save = async () => {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await saveTabRules(map, user && user.id);
      setSaved(JSON.parse(JSON.stringify(map)));
      toast.ok("تم حفظ صلاحيات البايكرز", "تظهر للبايكر عند فتح البوابة أو تحديثها");
    } catch (e) { const h = humanError(e); toast.bad("تعذّر الحفظ", h.ar); }
    setBusy(false);
  };

  return (<div className="bt">
    <style>{CSS}</style><KitStyle />
    <div className="bt-hint"><Icon n="alert" s={14} /> إعداد عام لكل البايكرز. «ملفي» صفحتهم الرئيسية ويبقى ظاهراً دائماً. الإخفاء يخصّ الواجهة فقط، وحماية البيانات على صلاحيات القاعدة.</div>
    {state.missing && <div className="bt-warn"><Icon n="lock" s={14} /> جدول الصلاحيات غير مُفعّل بعد في القاعدة (<code dir="ltr">docs/sql/biker_tabs.sql</code>). البوابة تعرض كل التبويبات الآن، والحفظ متوقف حتى يُطبَّق.</div>}
    {state.error && <ErrorNote e={humanError(state.error)} onRetry={load} />}

    <div className="bt-grid">
      <section className="g-card bt-card" aria-label="التبويبات">
        <div className="bt-head"><b>تبويبات بوابة البايكر</b><span className="bt-cnt">الشريط السفلي: {nBottom}/{MAX_BOTTOM}</span></div>
        <div className="bt-cols" aria-hidden="true"><span>التبويب</span><span>ظاهر</span><span>الشريط السفلي</span></div>
        {BIKER_TABS.map(t => {
          if (t.fixed) return (<div className="bt-row fixed" key={t.k}>
            <span className="bt-name"><span className="bt-ic"><Icon n={t.ic} s={17} /></span><span><b>{t.ar}</b><small lang="bn">{t.bn}</small></span></span>
            <span className="bt-fix">دائماً</span><span className="bt-fix">أول زر</span></div>);
          const v = map[t.k], full = !v.bottom && nBottom >= MAX_BOTTOM;
          return (<div className={"bt-row" + (v.visible ? "" : " off")} key={t.k}>
            <span className="bt-name"><span className="bt-ic"><Icon n={t.ic} s={17} /></span><span><b>{t.ar}</b><small lang="bn">{t.bn}</small></span></span>
            <Sw on={v.visible} label={`إظهار «${t.ar}»`} onChange={on => set(t.k, { visible: on })} />
            <Sw on={v.visible && v.bottom} disabled={!v.visible || full} label={`«${t.ar}» في الشريط السفلي`}
              title={!v.visible ? "التبويب مخفي" : full ? `الحد الأقصى ${MAX_BOTTOM}` : ""} onChange={on => set(t.k, { bottom: on })} />
          </div>);
        })}
        {nBottom >= MAX_BOTTOM && <div className="bt-note">الشريط السفلي ممتلئ ({MAX_BOTTOM} + «الرئيسية» + «المزيد»). أزل تبويباً لتضيف غيره.</div>}
        <div className="bt-acts">
          <Btn kind="text" onClick={reset} disabled={busy}>الإعداد الافتراضي</Btn>
          {dirty && <Btn kind="text" onClick={() => setMap(JSON.parse(JSON.stringify(saved)))} disabled={busy}>تراجع</Btn>}
          <Btn kind="primary" busy={busy} disabled={!dirty || state.missing} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ"}</Btn>
        </div>
      </section>

      <section className="g-card bt-card" aria-label="معاينة">
        <div className="bt-head"><b>كيف يراها البايكر</b><span className="bt-cnt">{preview.nav.length} من 8 تبويبات</span></div>
        <div className="bt-phone" dir="rtl">
          <div className="bt-ph-lbl">القائمة («المزيد»)</div>
          <div className="bt-ph-list">{preview.nav.map(n => { const t = BIKER_TABS.find(x => x.k === n.k); return <span key={n.k} className="bt-ph-i"><Icon n={t.ic} s={14} />{n.ar}</span>; })}</div>
          <div className="bt-ph-lbl">الشريط السفلي</div>
          <div className="bt-ph-bar">{preview.bottom.map(b => <span key={b.k} className="bt-ph-b"><Icon n={b.ic} s={18} /><span>{b.ar}</span></span>)}
            <span className="bt-ph-b"><Icon n="menu" s={18} /><span>المزيد</span></span></div>
        </div>
      </section>
    </div>
  </div>);
}

function Sw({ on, onChange, disabled, label, title }) {
  return <button type="button" role="switch" aria-checked={!!on} aria-label={label} title={title || undefined} disabled={disabled}
    className={"bt-sw" + (on ? " on" : "")} onClick={() => onChange(!on)}><i /></button>;
}

const CSS = `
.bt{display:flex;flex-direction:column;gap:12px;min-width:0}
.bt-hint{display:flex;gap:7px;align-items:flex-start;background:var(--info-bg);color:var(--info-ink);border-radius:11px;padding:10px 12px;font-size:12px;font-weight:600;line-height:1.6}
.bt-warn{display:flex;gap:7px;align-items:flex-start;background:var(--warn-bg);color:var(--warn-ink);border:1px solid color-mix(in srgb,var(--warn) 35%,transparent);border-radius:11px;padding:10px 12px;font-size:12px;font-weight:700;line-height:1.6}
.bt-warn code{font-size:11px;background:rgba(0,0,0,.06);padding:1px 5px;border-radius:5px}
.bt-grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:12px;align-items:start}
.bt-card{padding:14px;min-width:0}
.bt-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}
.bt-head b{font-size:14px}
.bt-cnt{font-size:11.5px;font-weight:700;color:var(--mut);white-space:nowrap}
.bt-cols,.bt-row{display:grid;grid-template-columns:minmax(0,1fr) 64px 92px;align-items:center;gap:8px}
.bt-cols{font-size:11px;font-weight:700;color:var(--mut);padding:0 4px 6px;border-bottom:1px solid var(--line)}
.bt-cols span:not(:first-child){text-align:center}
.bt-row{padding:9px 4px;border-bottom:1px solid var(--line);min-height:52px}
.bt-row:last-of-type{border-bottom:none}
.bt-row.off .bt-name{opacity:.55}
.bt-name{display:flex;align-items:center;gap:9px;min-width:0}
.bt-name b{display:block;font-size:13.5px}
.bt-name small{display:block;font-size:10.5px;color:var(--mut);font-family:system-ui,"Noto Sans Bengali",sans-serif}
.bt-ic{flex:none;width:32px;height:32px;border-radius:9px;display:grid;place-items:center;background:var(--soft);color:var(--ink-2)}
.bt-fix{text-align:center;font-size:11px;font-weight:700;color:var(--mut)}
.bt-sw{justify-self:center;position:relative;width:44px;height:26px;border-radius:99px;border:none;background:var(--track);cursor:pointer;transition:background .18s;padding:0}
.bt-sw i{position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .18s}
.bt-sw.on{background:var(--p)}
.bt-sw.on i{transform:translateX(-18px)}
.bt-sw:disabled{opacity:.4;cursor:not-allowed}
.bt-sw:focus-visible{outline:2px solid var(--p);outline-offset:2px}
.bt-note{font-size:11.5px;color:var(--warn-ink);font-weight:600;margin-top:8px}
.bt-acts{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px}
.bt-phone{border:1.5px solid var(--line-2);border-radius:20px;padding:12px;background:var(--bg-2)}
.bt-ph-lbl{font-size:11px;font-weight:700;color:var(--mut);margin:4px 0 6px}
.bt-ph-list{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.bt-ph-i{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;background:var(--glass);border:1px solid var(--line);border-radius:99px;padding:5px 10px}
.bt-ph-bar{display:flex;justify-content:space-around;gap:4px;background:var(--glass);border:1px solid var(--line);border-radius:14px;padding:8px 4px}
.bt-ph-b{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10.5px;font-weight:700;color:var(--ink-2);min-width:0;flex:1;text-align:center}
.bt-ph-b span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
@media(max-width:860px){.bt-grid{grid-template-columns:minmax(0,1fr)}}
@media(max-width:380px){.bt-cols,.bt-row{grid-template-columns:minmax(0,1fr) 52px 64px}.bt-cols span:last-child{font-size:10px}}
`;
