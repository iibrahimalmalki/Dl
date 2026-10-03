// أكاديمية التدريب — لوحة المالك والمشرف: متابعة البايكرز، تقييم المشرف العملي، مكتبة الفيديو.
// تقييم المشرف من حسابه (evaluator_id = auth.uid())؛ الحساب نفسه في evalResult (engine.js) كما في الأكاديمية الأصلية.
import { useEffect, useMemo, useState } from "react";
import { CFG, MODS, WASH, PATH, allSteps, modName, curIdx, doneCount, certified, stateFrom, missFrom, topMiss, wrongsOf, evalResult, CLIPS, VIDEO_FILES, fmtTime } from "./engine";
import { loadAll, savePractical, listVideos, uploadVideo } from "./store";

const MAX_MB = 100; // حد bucket training في docs/sql/academy.sql
const fmtDate = d => { try { return new Date(d).toLocaleDateString("ar-SA-u-nu-latn-ca-gregory", { day: "numeric", month: "short", year: "numeric" }); } catch { return "—"; } };
const fmtMB = b => b ? (b / 1048576).toFixed(1) + " ميجا" : "—";
const CSS = `
.aa{display:flex;flex-direction:column;gap:14px;min-width:0}
.aa *{box-sizing:border-box}
.aa-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.aa-card{padding:16px 18px;display:flex;flex-direction:column;gap:12px;min-width:0}
.aa h3{margin:0;font-size:15px;font-weight:800;color:var(--ink)}
.aa-mut{color:var(--mut);font-size:12.5px}
.aa-num{font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:isolate}
.aa-note{padding:11px 13px;border-radius:12px;font-size:13px;background:var(--soft);border:1px solid var(--line);color:var(--ink-2);line-height:1.7}
.aa-note.warn{background:var(--warn-bg);color:var(--warn-ink);border-color:transparent}
.aa-note.bad{background:var(--bad-bg);color:var(--bad-ink);border-color:transparent}
.aa-note.ok{background:var(--ok-bg);color:var(--ok-ink);border-color:transparent}
.aa-tbl td,.aa-tbl th{white-space:nowrap}
.aa-tbl tbody tr{cursor:pointer}
.aa-prog{display:flex;align-items:center;gap:8px;min-width:110px}.aa-prog .g-track{flex:1}
@media(max-width:640px){
  .aa-tbl thead{display:none}
  .aa-tbl,.aa-tbl tbody,.aa-tbl tr,.aa-tbl td{display:block;width:100%}
  .aa-tbl tr{padding:10px 4px;border-bottom:1px solid var(--line)}
  .aa-tbl td{border:none!important;padding:3px 6px!important;display:flex;justify-content:space-between;align-items:center;gap:10px;white-space:normal}
  .aa-tbl td::before{content:attr(data-l);font-size:11.5px;color:var(--mut);font-weight:700}
  .aa-tbl td.nm{font-size:14.5px;font-weight:800}.aa-tbl td.nm::before{display:none}
}
.aa-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.aa-unit{display:flex;flex-direction:column;gap:5px}
.aa-unit>div:first-child{display:flex;justify-content:space-between;font-size:13px}
.aa-list>div{padding:9px 0;border-top:1px solid var(--line);display:flex;align-items:center;gap:10px}.aa-list>div:first-child{border-top:none}
.aa-list .g{flex:1;min-width:0}
.aa-ev{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}
.aa-ev:first-of-type{border-top:none}
.aa-ev .ok{display:block;font-size:12px;color:var(--ok-ink);margin-top:2px}
.aa-seg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:3px;border-radius:12px;background:var(--soft);border:1px solid var(--line);min-width:290px}
.aa-seg.two{grid-template-columns:repeat(2,minmax(0,1fr));min-width:180px}
.aa-seg button{min-height:40px;border:none;border-radius:9px;background:transparent;color:var(--mut);font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;padding:4px 6px}
.aa-seg button:focus-visible{outline:none;box-shadow:var(--glow)}
.aa-seg button.on[data-v="2"]{background:var(--ok-bg);color:var(--ok-ink)}
.aa-seg button.on[data-v="1"]{background:var(--warn-bg);color:var(--warn-ink)}
.aa-seg button.on[data-v="0"]{background:var(--bad-bg);color:var(--bad-ink)}
@media(max-width:640px){.aa-ev{grid-template-columns:1fr}.aa-seg,.aa-seg.two{min-width:0}}
.aa-res{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.aa-res .big{font-size:34px;font-weight:900}
.aa-res .big.pass{color:var(--ok-ink)}.aa-res .big.fail{color:var(--bad-ink)}
.aa-f{display:flex;flex-direction:column;gap:5px;font-size:12.5px;font-weight:700;color:var(--ink-2)}
.aa-row{display:flex;gap:12px;flex-wrap:wrap}.aa-row>*{flex:1;min-width:180px}
.aa-vid{display:flex;flex-direction:column;gap:10px}
.aa-clips{display:flex;flex-wrap:wrap;gap:6px}
.aa-up{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:42px;padding:9px 15px;border-radius:var(--r-sm);border:1.5px dashed rgba(var(--p-rgb),.5);background:var(--p-50);color:var(--p-ink);font-weight:800;font-size:13px;cursor:pointer}
.aa-up input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.aa-up:focus-within{box-shadow:var(--glow)}
`;

export default function AcademyAdmin({ me, owner }) {
  const [tab, setTab] = useState("track");
  const [d, setD] = useState(null);
  const [sel, setSel] = useState(null);     // employee id في التفصيل
  const [evalFor, setEvalFor] = useState(null); // {emp, kind}
  const [reload, setReload] = useState(0);
  useEffect(() => { let on = true; setD(null); loadAll().then(r => { if (on) setD(r); }).catch(e => { if (on) setD({ employees: [], attempts: [], practicals: [], ready: false, error: e }); }); return () => { on = false; }; }, [reload]);

  const rows = useMemo(() => {
    if (!d) return [];
    return d.employees.filter(e => e.staff_role !== "manager").map(e => {
      const at = d.attempts.filter(a => a.employee_id === e.id), pr = d.practicals.filter(p => p.employee_id === e.id), st = stateFrom(at, pr);
      const last = [...at, ...pr].map(x => x.created_at).sort().pop() || null, ci = curIdx(st);
      const prac = k => { const sup = pr.filter(p => p.kind === k && p.mode === "sup"); return sup.some(p => p.pass) ? "pass" : sup.length ? "fail" : pr.some(p => p.kind === k) ? "self" : "none"; };
      return { e, at, pr, st, last, ci, done: doneCount(st), cert: certified(st), pin: prac("interior"), pex: prac("exterior") };
    });
  }, [d]);

  const head = <div className="aa-top">
    <div className="g-tabs" role="tablist">{[["track", "المتابعة"], ["video", "مكتبة الفيديو"]].map(([k, l]) =>
      <button key={k} role="tab" aria-selected={tab === k} className={"g-tab" + (tab === k ? " on" : "")} onClick={() => { setTab(k); setSel(null); setEvalFor(null); }}>{l}</button>)}</div>
    {tab === "track" && !evalFor && <button className="g-btn primary" onClick={() => setEvalFor({ emp: sel || "", kind: "interior" })}>+ تقييم عملي جديد</button>}
  </div>;

  let body;
  if (!d) body = <div className="g-card aa-card"><div className="g-skel box" style={{ height: 160 }} /></div>;
  else if (tab === "video") body = <Videos owner={owner} />;
  else if (evalFor) body = <EvalForm me={me} rows={rows} init={evalFor} ready={d.ready} onDone={() => { setEvalFor(null); setReload(x => x + 1); }} onCancel={() => setEvalFor(null)} />;
  else if (sel) body = <Detail row={rows.find(r => r.e.id === sel)} onBack={() => setSel(null)} onEval={kind => setEvalFor({ emp: sel, kind })} />;
  else body = <Track rows={rows} d={d} onOpen={setSel} />;

  return <div className="aa"><style>{CSS}</style>{head}
    {d && !d.ready && <div className="aa-note warn">جداول الأكاديمية لم تُنشأ بعد في القاعدة (docs/sql/academy.sql بانتظار موافقة المالك). الصفحة تعمل للعرض، لكن لا توجد نتائج محفوظة ولا يمكن حفظ تقييم أو رفع فيديو حتى التطبيق.</div>}
    {d && d.error && <div className="aa-note bad">تعذّر تحميل بعض البيانات: {String(d.error.message || d.error)}</div>}
    {body}</div>;
}

const PRAC = { pass: ["ok", "ناجح"], fail: ["bad", "لم ينجح"], self: ["info", "تدرّب ذاتياً"], none: ["", "لم يبدأ"] };
const PracBadge = ({ s }) => <span className={"g-badge " + PRAC[s][0]}>{PRAC[s][1]}</span>;

function Track({ rows, onOpen }) {
  if (!rows.length) return <div className="g-card aa-card"><div className="g-empty"><b>لا بايكرز</b><p>لا يوجد موظفون برقم سويتر في القاعدة.</p></div></div>;
  return <div className="g-card aa-card" style={{ padding: "8px 6px" }}>
    <table className="g-tbl aa-tbl"><thead><tr><th>البايكر</th><th>المحطة الحالية</th><th>المنجز</th><th>آخر نشاط</th><th>العملي الداخلي</th><th>العملي الخارجي</th><th>الحالة</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.e.id} tabIndex={0} onClick={() => onOpen(r.e.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(r.e.id); } }}>
        <td className="nm" data-l="البايكر">{r.e.full_name} <span className="aa-mut aa-num">#{r.e.employee_id}</span></td>
        <td data-l="المحطة الحالية">{r.cert ? "—" : PATH[r.ci].name.ar}</td>
        <td data-l="المنجز"><span className="aa-prog"><span className={"g-track" + (r.cert ? " ok" : "")}><i style={{ width: r.done * 10 + "%" }} /></span><b className="aa-num">{r.done}/10</b></span></td>
        <td data-l="آخر نشاط">{r.last ? fmtDate(r.last) : "—"}</td>
        <td data-l="العملي الداخلي"><PracBadge s={r.pin} /></td>
        <td data-l="العملي الخارجي"><PracBadge s={r.pex} /></td>
        <td data-l="الحالة">{r.cert ? <span className="g-badge ok"><i />معتمد</span> : <span className="g-badge">قيد التدريب</span>}</td>
      </tr>)}</tbody></table></div>;
}

function Detail({ row, onBack, onEval }) {
  if (!row) return null;
  const { e, at, pr, st } = row, miss = topMiss(missFrom(at), 8), sup = pr.filter(p => p.mode === "sup"), self = pr.filter(p => p.mode === "self");
  return <>
    <div className="aa-top"><button className="g-btn" onClick={onBack}>→ كل البايكرز</button>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="g-btn" onClick={() => onEval("interior")}>تقييم الداخلي</button><button className="g-btn" onClick={() => onEval("exterior")}>تقييم الخارجي</button></div></div>
    <div className="g-card aa-card"><div className="aa-top"><div><h3 style={{ fontSize: 18 }}>{e.full_name}</h3><span className="aa-mut aa-num">#{e.employee_id}</span></div>
      {row.cert ? <span className="g-badge ok"><i />معتمد</span> : <span className="g-badge">المحطة الحالية: {PATH[row.ci].name.ar} · <span className="aa-num">{row.done}/10</span></span>}</div></div>
    <div className="aa-grid">
      <div className="g-card aa-card"><h3>أفضل نتيجة لكل وحدة</h3>{MODS.map(m => { const b = st.best[m.id]; return <div className="aa-unit" key={m.id}><div><span>{m.name.ar}</span><b className="aa-num">{b == null ? "—" : b + "%"}</b></div><div className={"g-track" + ((b || 0) >= CFG.passMark ? " ok" : "")}><i style={{ width: (b || 0) + "%" }} /></div></div>; })}
        <div className="aa-unit"><div><span>الاختبار الشامل</span><b>{st.finalPass ? "ناجح" : at.some(a => a.module === "final") ? "لم ينجح بعد" : "—"}</b></div></div></div>
      <div className="g-card aa-card"><h3>نقاط تحتاج تصحيح</h3>{miss.length ? miss.map((m, i) => <div key={i} className="aa-note bad" style={{ display: "flex", gap: 8 }}><b className="aa-num">×{m.n}</b><span>{m.why.ar}</span></div>) : <span className="aa-mut">لا أخطاء متكررة.</span>}</div>
    </div>
    <div className="g-card aa-card"><h3>تقييمات المشرف <span className="aa-mut">· تدريب ذاتي: <span className="aa-num">{self.length}</span> مرة</span></h3>
      {sup.length ? <div className="aa-list">{sup.map(p => { const r = p.marks && p.rules ? evalResult(WASH[p.kind], p.marks, p.rules) : null; return <div key={p.id} style={{ alignItems: "flex-start" }}>
        <div className="g"><b>{modName(p.kind).ar}</b> <span className="aa-mut">· {p.evaluator_name || "—"} · {fmtDate(p.created_at)}{p.minutes ? ` · ${p.minutes} دقيقة` : ""}</span>
          {r && r.skipped.length > 0 && <div className="aa-mut" style={{ color: "var(--bad-ink)" }}>لم يُنفَّذ: {r.skipped.join("، ")}</div>}
          {r && r.broken.length > 0 && <div className="aa-mut" style={{ color: "var(--bad-ink)" }}>خالف: {r.broken.join("، ")}</div>}
          {r && r.weak.length > 0 && <div className="aa-mut" style={{ color: "var(--warn-ink)" }}>يحتاج تحسين: {r.weak.join("، ")}</div>}
          {p.note && <div className="aa-mut">ملاحظات: {p.note}</div>}</div>
        <span className={"g-badge aa-num " + (p.pass ? "ok" : "bad")}>{p.pct}%</span></div>; })}</div> : <span className="aa-mut">لا توجد تقييمات مشرف بعد.</span>}</div>
    <div className="g-card aa-card"><h3>سجل المحاولات <span className="aa-mut aa-num">({at.length})</span></h3>
      {at.length ? <div className="aa-list">{at.slice(0, 40).map(a => <div key={a.id}><div className="g"><b>{modName(a.module).ar}</b> <span className="aa-mut">· {fmtDate(a.created_at)}{wrongsOf(a).length ? ` · أخطاء: ${wrongsOf(a).length}` : ""}</span></div>
        <span className={"g-badge aa-num " + (a.pass ? "ok" : "bad")}>{a.pct}%</span></div>)}</div> : <span className="aa-mut">لا محاولات بعد.</span>}</div>
  </>;
}

// متقن 2 / يحتاج تحسين 1 / لم يُنفَّذ 0 — والقواعد: التزم 1 / خالف 0
const Seg = ({ v, on, two }) => <div className={"aa-seg" + (two ? " two" : "")} role="radiogroup">
  {(two ? [[1, "التزم", 2], [0, "خالف", 0]] : [[2, "متقن", 2], [1, "يحتاج تحسين", 1], [0, "لم يُنفَّذ", 0]]).map(([x, l, dv]) =>
    <button key={x} type="button" role="radio" aria-checked={v === x} data-v={dv} className={v === x ? "on" : ""} onClick={() => on(x)}>{l}</button>)}</div>;

function EvalForm({ me, rows, init, ready, onDone, onCancel }) {
  const [emp, setEmp] = useState(init.emp || "");
  const [kind, setKind] = useState(init.kind || "interior");
  const [marks, setMarks] = useState({}), [rules, setRules] = useState({});
  const [mins, setMins] = useState(""), [note, setNote] = useState("");
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false), [saved, setSaved] = useState(null);
  const W = WASH[kind], steps = allSteps(W), r = evalResult(W, marks, rules);
  const row = rows.find(x => x.e.id === emp), self = row && me && me.biker_employee_id && String(me.biker_employee_id).trim() === String(row.e.employee_id);
  const setK = k => { setKind(k); setMarks({}); setRules({}); };
  const save = async () => {
    setErr("");
    if (!emp) return setErr("اختر البايكر.");
    if (self) return setErr("لا يمكنك تقييم نفسك.");
    if (r.missing) return setErr("قيّم كل الخطوات والقواعد قبل الحفظ.");
    const m = mins.trim() === "" ? null : Math.round(+mins);
    if (m != null && !(m > 0 && m < 600)) return setErr("مدة الغسلة بالدقائق غير صحيحة.");
    setBusy(true);
    const s = await savePractical({ employee_id: emp, kind, mode: "sup", evaluator_id: me && me.id, evaluator_name: (me && me.display_name) || null, pct: r.pct, pass: r.pass, minutes: m, marks, rules, note: note.trim() || null });
    setBusy(false);
    if (s.missing) return setErr("لا يمكن الحفظ: جداول الأكاديمية لم تُنشأ بعد (بانتظار موافقة المالك على docs/sql/academy.sql).");
    if (s.error) return setErr(/row-level security|42501/.test(String(s.error.message || s.error.code)) ? "لا تملك صلاحية حفظ تقييم عملي (تحتاج صلاحية تعديل «الجولات الميدانية»)." : "تعذّر الحفظ: " + (s.error.message || s.error));
    setSaved({ ...r, name: row.e.full_name });
  };
  if (saved) return <div className="g-card aa-card">
    <div className="aa-res"><span className={"big aa-num " + (saved.pass ? "pass" : "fail")}>{saved.pct}%</span><div><h3>{saved.pass ? "معتمد" : "يحتاج إعادة"} — {modName(kind).ar}</h3><span className="aa-mut">{saved.name} · حُفظ التقييم</span></div></div>
    {[["لم يُنفَّذ", saved.skipped, "bad"], ["خالف", saved.broken, "bad"], ["يحتاج تحسين", saved.weak, "warn"]].filter(x => x[1].length).map(([t, l, c]) => <div key={t} className={"aa-note " + c}><b>{t}:</b> {l.join("، ")}</div>)}
    <button className="g-btn primary" onClick={onDone}>تم</button></div>;
  let n = 0;
  return <>
    <div className="aa-top"><button className="g-btn" onClick={onCancel}>→ رجوع</button></div>
    <div className="g-card aa-card"><h3>تقييم المشرف · التطبيق العملي</h3><span className="aa-mut">يعبّئه المشرف وهو يشاهد البايكر يغسل سيارة حقيقية. المقيّم: <b>{(me && me.display_name) || "—"}</b></span>
      {!ready && <div className="aa-note warn">الحفظ غير متاح قبل إنشاء جداول الأكاديمية.</div>}
      <div className="aa-row"><label className="aa-f">البايكر<select className="g-select" value={emp} onChange={e => setEmp(e.target.value)}><option value="">— اختر —</option>{rows.map(x => <option key={x.e.id} value={x.e.id}>{x.e.full_name} · {x.e.employee_id}</option>)}</select></label>
        <div className="aa-f">الوحدة<div className="g-seg" role="tablist">{[["interior", "الغسيل الداخلي"], ["exterior", "الغسيل الخارجي"]].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={kind === k} className={"g-seg-b" + (kind === k ? " on" : "")} onClick={() => setK(k)}>{l}</button>)}</div></div></div>
      {self && <div className="aa-note bad">لا يمكنك تقييم نفسك.</div>}</div>
    {W.phases.map(p => <div className="g-card aa-card" key={p.id} style={{ gap: 0 }}><h3 style={{ marginBottom: 4 }}>{p.name.ar}</h3>
      {p.steps.map(s => { const key = "s" + n; n++; return <div className="aa-ev" key={key}><div><b className="aa-num">{n}.</b> {s.t.ar}<span className="ok">✓ {s.ok.ar}</span></div><Seg v={marks[key]} on={x => setMarks(m => ({ ...m, [key]: x }))} /></div>; })}</div>)}
    <div className="g-card aa-card" style={{ gap: 0 }}><h3 style={{ marginBottom: 4 }}>القواعد الأربع</h3>
      {W.rules.map((ru, i) => <div className="aa-ev" key={i}><div>{ru.r.ar}</div><Seg two v={rules["r" + i]} on={x => setRules(m => ({ ...m, ["r" + i]: x }))} /></div>)}</div>
    <div className="g-card aa-card"><div className="aa-row"><label className="aa-f">مدة الغسلة بالدقائق<input className="g-input" inputMode="numeric" value={mins} onChange={e => setMins(e.target.value.replace(/[^\d]/g, ""))} /></label></div>
      <label className="aa-f">ملاحظات المشرف<textarea className="g-textarea" rows={3} value={note} onChange={e => setNote(e.target.value)} /></label></div>
    <div className="g-card aa-card"><div className="aa-res"><span className={"big aa-num " + (r.pass ? "pass" : "fail")}>{r.pct}%</span>
      <div className="aa-mut">النتيجة = مجموع الخطوات ÷ (<span className="aa-num">{steps.length}</span> × 2). النجاح من <span className="aa-num">{CFG.passMark}%</span> بلا خطوة «لم يُنفَّذ» وبلا قاعدة «خالف».
        {r.missing ? <div>لم تُقيَّم كل الخطوات والقواعد بعد.</div> : <div><b style={{ color: r.pass ? "var(--ok-ink)" : "var(--bad-ink)" }}>{r.pass ? "ناجح" : "راسب"}</b>{r.skipped.length ? ` · لم يُنفَّذ: ${r.skipped.length}` : ""}{r.broken.length ? ` · خالف: ${r.broken.length}` : ""}</div>}</div></div>
      {err && <div className="aa-note bad" role="alert">{err}</div>}
      <button className="g-btn primary" disabled={busy || !ready} onClick={save}>{busy ? "جارٍ الحفظ…" : "احفظ التقييم"}</button></div>
  </>;
}

function Videos({ owner }) {
  const [v, setV] = useState(null), [prog, setProg] = useState({}), [msg, setMsg] = useState({});
  const load = () => listVideos().then(setV).catch(() => setV({ map: {} }));
  useEffect(() => { load(); }, []);
  const up = async (key, f) => {
    if (!f) return;
    if (!/^video\//.test(f.type) && !/\.(mp4|mov|webm|m4v)$/i.test(f.name)) return setMsg(m => ({ ...m, [key]: { bad: 1, t: "اختر ملف فيديو (mp4)." } }));
    if (f.size > MAX_MB * 1048576) return setMsg(m => ({ ...m, [key]: { bad: 1, t: `الملف ${fmtMB(f.size)} — الحد ${MAX_MB} ميجا.` } }));
    setMsg(m => ({ ...m, [key]: null })); setProg(p => ({ ...p, [key]: 0 }));
    try { await uploadVideo(key, f, n => setProg(p => ({ ...p, [key]: n }))); setMsg(m => ({ ...m, [key]: { t: "تم الرفع ✓" } })); load(); }
    catch (e) { const t = String(e.message || e); setMsg(m => ({ ...m, [key]: { bad: 1, t: /training_videos|Bucket not found|not found/i.test(t) ? "لا يمكن الرفع: جداول/مخزن الأكاديمية لم تُنشأ بعد." : "تعذّر الرفع: " + t } })); }
    setProg(p => { const c = { ...p }; delete c[key]; return c; });
  };
  if (!v) return <div className="g-card aa-card"><div className="g-skel box" style={{ height: 120 }} /></div>;
  return <>
    <div className="aa-note">ثلاثة ملفات أصلية؛ كل مرحلة في الدروس تُعرض من ملفها بتوقيتها. الحد الأقصى للملف <span className="aa-num">{MAX_MB}</span> ميجا. إن لم يُرفع ملف تعمل الدروس بخطواتها مع رسالة «المقطع لم يُرفع بعد».{!owner && " الرفع للمالك فقط."}</div>
    {v.missing && <div className="aa-note warn">زر الرفع معطّل لأن جدول الفيديو ومخزن «training» لم يُنشآ بعد. يعمل الرفع مباشرة بعد تطبيق docs/sql/academy.sql.</div>}
    <div className="aa-grid">{VIDEO_FILES.map(f => { const row = v.map[f.key], p = prog[f.key], m = msg[f.key], clips = Object.entries(CLIPS).filter(([, c]) => c.file === f.key);
      return <div key={f.key} className="g-card aa-card aa-vid">
        <div className="aa-top"><h3>{f.name.ar}</h3>{row ? <span className="g-badge ok"><i />مرفوع</span> : <span className="g-badge warn"><i />غير مرفوع</span>}</div>
        <span className="aa-mut">{row ? `${fmtMB(row.size_bytes)} · ${fmtDate(row.uploaded_at)}` : "لم يُرفع بعد"}</span>
        <div className="aa-clips">{clips.map(([id, c]) => <span key={id} className="g-badge aa-num">{id} · {fmtTime(c.from)}–{fmtTime(c.to)}</span>)}</div>
        {p != null && <div><div className="g-track"><i style={{ width: p + "%" }} /></div><span className="aa-mut aa-num">{p}%</span></div>}
        {m && <div className={"aa-note " + (m.bad ? "bad" : "ok")} role="status">{m.t}</div>}
        {owner && v.missing && <button type="button" className="g-btn block" disabled>الرفع متاح بعد تطبيق academy.sql</button>}
        {owner && !v.missing && <label className="aa-up" aria-disabled={p != null}><input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v" disabled={p != null || v.missing} onChange={e => { const fl = e.target.files && e.target.files[0]; e.target.value = ""; up(f.key, fl); }} />{row ? "استبدال الملف" : "رفع الملف"}</label>}
      </div>; })}</div>
  </>;
}
