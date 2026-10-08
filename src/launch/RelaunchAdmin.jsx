// لوحة الإدارة ← «متتبع الحصر»: البايكرز × خطوات الحصر الست. السفير يعتمد الخطوة أو يطلب تصحيحها بملاحظة،
// والمالك يفتح تبويب الخطوة التالية للجميع من «صلاحيات البايكرز» حين تكتمل الخطوة عند الجميع.
import { useEffect, useMemo, useState } from "react";
import { STEPS, STEP_STATUS, stepMap, statusAt, bikerProgress, stepCoverage, validateStep } from "./lib";
import { loadTracker, saveStep } from "./store";

const CSS = `
.rl{display:flex;flex-direction:column;gap:14px;min-width:0}
.rl *{box-sizing:border-box}
.rl-note{padding:10px 12px;border-radius:12px;font-size:13px;background:var(--soft);border:1px solid var(--line);line-height:1.7}
.rl-note.warn{background:var(--warn-bg);color:var(--warn-ink);border-color:transparent}
.rl-note.bad{background:var(--bad-bg);color:var(--bad-ink);border-color:transparent}
.rl-note.ok{background:var(--ok-bg);color:var(--ok-ink);border-color:transparent}
.rl-twrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
.rl-tbl td,.rl-tbl th{white-space:nowrap;vertical-align:middle}
.rl-cell{border:1px solid var(--line);background:var(--glass-2);border-radius:10px;padding:6px 9px;min-height:40px;cursor:pointer;font:inherit;font-size:12px;font-weight:700;color:var(--ink-2);display:inline-flex;align-items:center;gap:6px}
.rl-cell.ok{background:var(--ok-bg);color:var(--ok-ink);border-color:transparent}
.rl-cell.bad{background:var(--bad-bg);color:var(--bad-ink);border-color:transparent}
.rl-cell.info{background:var(--info-bg);color:var(--info-ink);border-color:transparent}
.rl-cov{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.rl-cov>div{padding:10px 12px;border-radius:12px;background:var(--soft);border:1px solid var(--line)}
.rl-cov b{display:block;font-size:13px;color:var(--ink)}.rl-cov span{font-size:12px;color:var(--mut)}
.rl-ed{padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.rl-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.rl-ed h3{margin:0;font-size:14.5px}
`;

export default function RelaunchAdmin() {
  const [d, setD] = useState(null), [ed, setEd] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [r, setR] = useState(0);
  useEffect(() => { let on = true; loadTracker().then(x => on && setD(x), e => on && setD({ roster: [], steps: [], ready: true, error: e })); return () => { on = false; }; }, [r]);
  const m = useMemo(() => stepMap(d ? d.steps : []), [d]);
  const ids = (d ? d.roster : []).map(b => b.employee_id);
  const cov = stepCoverage(m, ids);
  const open = (b, s) => { const row = (m[b.employee_id] || {})[s.k] || {}; setErr(""); setEd({ b, s, status: row.status && row.status !== "none" ? row.status : "approved", note: row.note || "" }); };
  const save = async () => {
    const e = validateStep(ed); if (e.length) return setErr(e[0]);
    setBusy(true); setErr("");
    const x = await saveStep({ employee_id: ed.b.employee_id, step: ed.s.k, status: ed.status, note: ed.note }); setBusy(false);
    if (x.error) return setErr(/row-level|42501|permission/i.test(String(x.error.message || x.error.code)) ? "لا تملك صلاحية الاعتماد (تحتاج تعديل «التعاقد والإعداد»)." : "تعذّر الحفظ: " + (x.error.message || x.error));
    setEd(null); setR(n => n + 1);
  };
  return <div className="rl"><style>{CSS}</style>
    {!d ? <div className="g-card rl-ed"><div className="g-skel box" style={{ height: 140 }} /></div> : <>
      {!d.ready && <div className="rl-note warn">جداول المتتبع لم تُنشأ بعد (docs/sql/launch_support.sql بانتظار موافقة المالك).</div>}
      {d.error && <div className="rl-note bad">تعذّر التحميل: {String(d.error.message || d.error)}</div>}
      <div className="rl-note">كل بايكر يمر بالخطوات بالترتيب، والسفير يعتمد كل خطوة قبل التي بعدها. حين تكتمل خطوة عند الجميع يفتح المالك تبويبها التالي من «صلاحيات البايكرز». «بياناتي» و«وثائقي» تُدخلهما الإدارة ويتحقق منهما السفير.</div>
      <div className="rl-cov">{cov.map(c => { const s = STEPS.find(x => x.k === c.k); return <div key={c.k}><b>{s.ar} {c.complete ? "✓" : ""}</b><span>{c.approved} من {c.total} معتمد · {s.by}</span></div>; })}</div>
      {ed && <div className="g-card rl-ed">
        <h3>{ed.b.full_name} — {ed.s.ar} <span className="g-badge">{ed.s.by}</span></h3>
        <div className="rl-row" role="radiogroup" aria-label="القرار">{["approved", "needs_fix", "in_progress"].map(k => <button key={k} type="button" role="radio" aria-checked={ed.status === k} className={"g-btn sm" + (ed.status === k ? " primary" : "")} onClick={() => setEd({ ...ed, status: k })}>{STEP_STATUS[k].ar}</button>)}</div>
        <textarea className="g-textarea" rows={2} maxLength={1000} value={ed.note} onChange={e => setEd({ ...ed, note: e.target.value })} placeholder={ed.status === "needs_fix" ? "ما المطلوب تصحيحه؟ (يصل للبايكر)" : "ملاحظة اختيارية"} />
        {err && <div className="rl-note bad" role="alert">{err}</div>}
        <div className="rl-row"><button className="g-btn" onClick={() => setEd(null)}>إلغاء</button><button className="g-btn primary" disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ وإشعار البايكر"}</button></div>
      </div>}
      {d.roster.length ? <div className="g-card" style={{ padding: "8px 6px" }}><div className="rl-twrap"><table className="g-tbl rl-tbl">
        <thead><tr><th>البايكر</th>{STEPS.map(s => <th key={s.k}>{s.ar}<div style={{ fontWeight: 600, fontSize: 11, color: "var(--mut)" }}>{s.by}</div></th>)}<th>التقدّم</th></tr></thead>
        <tbody>{d.roster.map(b => { const p = bikerProgress(m, b.employee_id); return <tr key={b.employee_id}>
          <td><b>{b.full_name}</b><div style={{ fontSize: 11, color: "var(--mut)" }}>{b.biker_employee_id}</div></td>
          {STEPS.map(s => { const st = statusAt(m, b.employee_id, s.k), S = STEP_STATUS[st], row = (m[b.employee_id] || {})[s.k];
            return <td key={s.k}><button type="button" className={"rl-cell " + S.tone} title={row && row.note ? row.note : ""} onClick={() => open(b, s)}>{S.ar}</button></td>; })}
          <td><b>{p.approved}/{p.total}</b></td></tr>; })}</tbody></table></div></div>
        : d.ready && <div className="g-card rl-ed"><div className="g-empty" style={{ padding: "24px 10px" }}><b>لا بايكرز بحسابات نشطة، أو لا تملك صلاحية «التعاقد والإعداد».</b></div></div>}
    </>}
  </div>;
}
