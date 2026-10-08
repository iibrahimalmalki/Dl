// لوحة الإدارة ← «الدعم والأفكار»: صندوق طلبات البايكرز للمالك والسفيرين — الرد وتغيير الحالة (الإغلاق برد مكتوب)
import { useEffect, useMemo, useState } from "react";
import { KINDS, STATUS, OPEN_STATUSES, kindOf, validateReply, inboxSummary } from "./lib";
import { loadInbox, replyTicket, shotUrl } from "./store";
import { BIKER_TABS } from "../bikerTabs";
const screenAr = k => (BIKER_TABS.find(t => t.k === k) || { ar: k }).ar;

const CSS = `
.sa{display:flex;flex-direction:column;gap:14px;min-width:0}
.sa *{box-sizing:border-box}
.sa-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}
.sa-bar label{display:flex;flex-direction:column;gap:5px;font-size:12.5px;font-weight:700;color:var(--ink-2);min-width:150px;flex:1}
.sa-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.sa-kpis>div{padding:12px 14px;border-radius:14px;background:var(--soft);border:1px solid var(--line)}
.sa-kpis b{display:block;font-size:22px;font-weight:900;color:var(--ink);font-variant-numeric:tabular-nums}.sa-kpis span{font-size:12px;color:var(--mut);font-weight:700}
.sa-card{padding:14px 16px;display:flex;flex-direction:column;gap:10px;min-width:0}
.sa-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sa-top h3{margin:0;font-size:14.5px;font-weight:800;color:var(--ink)}
.sa-mut{color:var(--mut);font-size:12px}
.sa-body{white-space:pre-wrap;word-break:break-word;font-size:13.5px;line-height:1.8;color:var(--ink-2)}
.sa-shots{display:flex;gap:8px;flex-wrap:wrap}
.sa-shots img,.sa-shots span{width:84px;height:84px;object-fit:cover;border-radius:10px;border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;color:var(--mut);font-size:11px}
.sa-reply{display:flex;flex-direction:column;gap:8px}
.sa-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.sa-note{padding:10px 12px;border-radius:12px;font-size:13px;background:var(--soft);border:1px solid var(--line);line-height:1.7}
.sa-note.bad{background:var(--bad-bg);color:var(--bad-ink);border-color:transparent}
.sa-note.warn{background:var(--warn-bg);color:var(--warn-ink);border-color:transparent}
`;
const fmt = t => new Date(t).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });

function Shot({ path }) {
  const [u, setU] = useState(null);
  useEffect(() => { let on = true; shotUrl(path).then(x => on && setU(x || ""), () => on && setU("")); return () => { on = false; }; }, [path]);
  return u ? <a href={u} target="_blank" rel="noreferrer"><img src={u} alt="لقطة الشاشة" /></a> : <span>{u === "" ? "تعذّر" : "…"}</span>;
}

function Ticket({ t, onSaved }) {
  const [f, setF] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const s = STATUS[t.status] || STATUS.new, k = kindOf(t.kind);
  const late = OPEN_STATUSES.includes(t.status) && !t.replied_at && Date.now() - new Date(t.created_at).getTime() > 24 * 3600e3;
  const save = async () => {
    const e = validateReply(f); if (e.length) return setErr(e[0]);
    setBusy(true); setErr("");
    const r = await replyTicket(t.id, f); setBusy(false);
    if (r.error) return setErr(/row-level|42501|permission/i.test(String(r.error.message || r.error.code)) ? "لا تملك صلاحية الرد (تحتاج تعديل «التعاقد والإعداد»)." : "تعذّر الحفظ: " + (r.error.message || r.error));
    setF(null); onSaved(r.ticket);
  };
  return <div className="g-card sa-card">
    <div className="sa-top"><h3>#{t.seq} · {k.ar}</h3><span className={"g-badge " + s.tone}><i />{s.ar}</span>{late && <span className="g-badge bad">بلا رد منذ أكثر من 24 ساعة</span>}
      {t.supply_request_id && <span className="g-badge brand">حُوِّل لطلبات الإمداد</span>}</div>
    <span className="sa-mut">{t.biker_name || "—"} ({t.biker_employee_id || "—"}) · {fmt(t.created_at)}{t.screen ? " · من شاشة: " + screenAr(t.screen) : ""}</span>
    <div className="sa-body">{t.body}</div>
    {(t.photos || []).length > 0 && <div className="sa-shots">{t.photos.map(p => <Shot key={p} path={p} />)}</div>}
    {t.reply && !f && <div className="sa-note"><b>الرد:</b> {t.reply}{t.replied_at ? <span className="sa-mut"> · {fmt(t.replied_at)}</span> : null}</div>}
    {!f ? <div className="sa-row"><button className="g-btn sm" onClick={() => setF({ status: t.status === "new" ? "in_review" : t.status, reply: t.reply || "" })}>رد / تغيير الحالة</button></div>
      : <div className="sa-reply">
        <div className="sa-row" role="radiogroup" aria-label="الحالة">{Object.entries(STATUS).map(([key, v]) => <button key={key} type="button" role="radio" aria-checked={f.status === key} className={"g-btn sm" + (f.status === key ? " primary" : "")} onClick={() => setF({ ...f, status: key })}>{v.ar}</button>)}</div>
        <textarea className="g-textarea" rows={3} value={f.reply} maxLength={2000} onChange={e => setF({ ...f, reply: e.target.value })} placeholder="الرد للبايكر — يصله إشعار. «تم التنفيذ» و«لن يُنفَّذ» تحتاج رداً مكتوباً." />
        {err && <div className="sa-note bad" role="alert">{err}</div>}
        <div className="sa-row"><button className="g-btn" onClick={() => { setF(null); setErr(""); }}>إلغاء</button><button className="g-btn primary" disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ وإشعار البايكر"}</button></div>
      </div>}
  </div>;
}

export default function SupportAdmin() {
  const [d, setD] = useState(null), [st, setSt] = useState("open"), [kind, setKind] = useState("all"), [q, setQ] = useState("");
  useEffect(() => { loadInbox().then(setD, e => setD({ tickets: [], ready: true, error: e })); }, []);
  const list = useMemo(() => (d ? d.tickets : []).filter(t => (st === "all" || (st === "open" ? OPEN_STATUSES.includes(t.status) : t.status === st))
    && (kind === "all" || t.kind === kind) && (!q.trim() || [t.biker_name, t.biker_employee_id, t.body, String(t.seq)].some(x => String(x || "").toLowerCase().includes(q.trim().toLowerCase())))), [d, st, kind, q]);
  const sum = inboxSummary(d ? d.tickets : []);
  const upd = t => setD(x => ({ ...x, tickets: x.tickets.map(y => y.id === t.id ? t : y) }));
  return <div className="sa"><style>{CSS}</style>
    {!d ? <div className="g-card sa-card"><div className="g-skel box" style={{ height: 140 }} /></div> : <>
      {!d.ready && <div className="sa-note warn">جداول مركز الدعم لم تُنشأ بعد (docs/sql/launch_support.sql بانتظار موافقة المالك). حتى ذلك تُرفع الطلبات لسلمان في واتساب.</div>}
      {d.error && <div className="sa-note bad">تعذّر التحميل: {String(d.error.message || d.error)}</div>}
      <div className="sa-kpis"><div><b>{sum.open}</b><span>مفتوحة</span></div><div><b style={{ color: sum.overdue ? "var(--bad-ink)" : undefined }}>{sum.overdue}</b><span>بلا رد بعد 24 ساعة</span></div>
        <div><b>{sum.by.done}</b><span>تم التنفيذ</span></div><div><b>{sum.by.wont_do}</b><span>لن يُنفَّذ</span></div></div>
      <div className="sa-bar">
        <label>الحالة<select className="g-select" value={st} onChange={e => setSt(e.target.value)}><option value="open">المفتوحة</option><option value="all">الكل</option>{Object.entries(STATUS).map(([k2, v]) => <option key={k2} value={k2}>{v.ar}</option>)}</select></label>
        <label>النوع<select className="g-select" value={kind} onChange={e => setKind(e.target.value)}><option value="all">الكل</option>{KINDS.map(x => <option key={x.k} value={x.k}>{x.ar}</option>)}</select></label>
        <label>بحث<input className="g-input" value={q} onChange={e => setQ(e.target.value)} placeholder="اسم، رقم، نص، رقم الطلب" /></label>
      </div>
      <span className="sa-mut">الرد خلال 24 ساعة: سلمان للتشغيل، عمر للجودة والوثائق. «طلب» يُحوَّل تلقائياً إلى «طلبات الإمداد والتصعيد».</span>
      {list.length ? list.map(t => <Ticket key={t.id} t={t} onSaved={upd} />)
        : <div className="g-card sa-card"><div className="g-empty" style={{ padding: "24px 10px" }}><b>لا طلبات هنا</b></div></div>}
    </>}
  </div>;
}
