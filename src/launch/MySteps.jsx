// بوابة البايكر ← «ملفي»: حالة خطوات الحصر كما اعتمدها السفير (لا يظهر شيء قبل تفعيل المتتبع أو قبل أول قرار)
import { useEffect, useState } from "react";
import { STEPS, STEP_STATUS, stepMap, statusAt, bikerProgress } from "./lib";
import { loadMySteps } from "./store";

export default function MySteps({ me }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { let on = true; loadMySteps(me.emp_id).then(r => on && setRows(r.ready && !r.error ? r.steps : []), () => on && setRows([])); return () => { on = false; }; }, [me.emp_id]);
  if (!rows || !rows.length) return null;
  const m = stepMap(rows), p = bikerProgress(m, me.emp_id);
  return <div className="bp-card g-card" style={{ marginTop: 14 }}><div className="bp-sec">
    <label className="bp-lbl" style={{ marginTop: 0 }}>خطوات التسجيل في المنصة <span className="bn">/ প্ল্যাটফর্মে নিবন্ধনের ধাপ</span> · <b>{p.approved}/{p.total}</b></label>
    {STEPS.map(s => { const st = statusAt(m, me.emp_id, s.k), S = STEP_STATUS[st], r = (m[me.emp_id] || {})[s.k];
      return <div className="bp-item" key={s.k}>
        <div className="t">{s.ar} <span className="bn" style={{ fontWeight: 600, color: "var(--mut)" }}>{s.bn}</span>
          <span className={"g-badge " + S.tone}><i />{S.ar} · <span lang="bn">{S.bn}</span></span></div>
        <div className="m">يعتمدها: {s.by}</div>
        {st === "needs_fix" && r && r.note && <div className="bp-note" style={{ color: "var(--bad-ink)" }}>المطلوب: {r.note}</div>}
      </div>; })}
    {p.complete && <div className="bp-msg bp-ok">اكتملت خطواتك كلها. شكراً لك. <span className="bn">আপনার সব ধাপ সম্পন্ন। ধন্যবাদ।</span></div>}
  </div></div>;
}
