// الاستلام اليومي — صفحة المتابعة للمالك والمشرف: اليوم، الأرصدة، سجل التسليمات، المناشف، الإعدادات.
import { useEffect, useMemo, useState } from "react";
import { balances, isLate, monthSummary, riyadhDay, riyadhHM, normPhone, csvCell, waMessage, deliverySlot, SLOTS, WINDOWS, courierStats, missedDays } from "./engine";
import { courierReport } from "./report";
import { loadAdmin, photoUrl, addAdjustment, saveItem, saveCourier, loadSplit, setSplit, copyText } from "./store";

const CSS = `
.da{display:flex;flex-direction:column;gap:14px;min-width:0}
.da *{box-sizing:border-box}
.da-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.da-card{padding:16px 18px;display:flex;flex-direction:column;gap:12px;min-width:0}
.da h3{margin:0;font-size:15px;font-weight:800;color:var(--ink)}
.da-mut{color:var(--mut);font-size:12.5px}
.da-num{font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:isolate}
.da-note{padding:11px 13px;border-radius:12px;font-size:13px;background:var(--soft);border:1px solid var(--line);color:var(--ink-2);line-height:1.7}
.da-note.warn{background:var(--warn-bg);color:var(--warn-ink);border-color:transparent}
.da-note.bad{background:var(--bad-bg);color:var(--bad-ink);border-color:transparent}
.da-note.ok{background:var(--ok-bg);color:var(--ok-ink);border-color:transparent}
.da-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.da-kv{display:flex;flex-wrap:wrap;gap:6px}
.da-photos{display:flex;gap:8px;flex-wrap:wrap}
.da-photos button{width:84px;height:64px;border-radius:10px;overflow:hidden;border:1px solid var(--line);padding:0;background:var(--soft);cursor:zoom-in}
.da-photos img{width:100%;height:100%;object-fit:cover;display:block}
.da-twrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
.da-tbl td,.da-tbl th{white-space:nowrap}
.da-zoom{position:fixed;inset:0;z-index:1000;background:rgba(5,8,20,.86);display:flex;align-items:center;justify-content:center;padding:16px;cursor:zoom-out}
.da-zoom img{max-width:100%;max-height:100%;border-radius:12px}
.da-zoom button{position:absolute;top:14px;inset-inline-end:14px}
.da-row{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}.da-row>*{flex:1;min-width:140px}
.da-f{display:flex;flex-direction:column;gap:5px;font-size:12.5px;font-weight:700;color:var(--ink-2)}
.da-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.da-kpis>div{padding:12px 14px;border-radius:14px;background:var(--soft);border:1px solid var(--line)}
.da-kpis b{display:block;font-size:22px;font-weight:900;color:var(--ink)}.da-kpis span{font-size:12px;color:var(--mut);font-weight:700}
`;
const fmt = t => riyadhDay(t).split("-").reverse().join("/") + " · " + riyadhHM(t);
const monthOf = t => riyadhDay(t).slice(0, 7);
// شارة تصنيف وقت التسليم: لا شيء داخل النافذتين، وإلا «ليلي» أو «متأخر +المدة»
const SlotBadge = ({ t }) => { const s = deliverySlot(t); if (!s || s.ok) return null;
  return <span className={"g-badge " + SLOTS[s.kind].tone}>{s.kind === "late" ? "متأخر " + fmtMin(s.lateMin) : "ليلي — خارج النافذة"}</span>; };
// مدة بالعربية بلا اتجاه LTR حتى لا تنقلب الأرقام: «1 س 50 د»
const fmtMin = m => m >= 60 ? Math.floor(m / 60) + " س " + (m % 60) + " د" : m + " د";
const hhmm = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const AR_M = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const mLabel = m => { const [y, mm] = m.split("-"); return AR_M[+mm - 1] + " " + y; };

function Photo({ path, onOpen }) {
  const [u, setU] = useState(null);
  useEffect(() => { let on = true; photoUrl(path).then(x => { if (on) setU(x || ""); }).catch(() => { if (on) setU(""); }); return () => { on = false; }; }, [path]);
  return <button type="button" onClick={() => u && onOpen(u)} aria-label="تكبير الصورة">{u ? <img src={u} alt="صورة الشحنة" /> : u === "" ? <span className="da-mut">تعذّر</span> : <span className="g-spin" />}</button>;
}

export default function DailyAdmin({ me, owner }) {
  const [tab, setTab] = useState("today");
  const [d, setD] = useState(null), [reload, setReload] = useState(0), [zoom, setZoom] = useState(null);
  useEffect(() => { let on = true; setD(null); loadAdmin().then(r => { if (on) setD(r); }).catch(e => { if (on) setD({ items: [], couriers: [], deliveries: [], shares: [], adjustments: [], employees: [], ready: false, error: e }); }); return () => { on = false; }; }, [reload]);
  const ctx = useMemo(() => {
    if (!d) return null;
    const empName = id => (d.employees.find(e => e.id === id) || {}).full_name || "—";
    const item = k => d.items.find(i => i.key === k) || { key: k, name_ar: k };
    const courier = id => d.couriers.find(c => c.id === id) || null;
    const undist = d.deliveries.filter(x => x.status === "received").map(x => ({ received_by: x.received_by, lines: x.daily_delivery_lines || [] }));
    return { empName, item, courier, bal: balances(d.shares, d.adjustments, undist) };
  }, [d]);
  const reloadAll = () => setReload(x => x + 1);
  const TABS = [["today", "اليوم"], ["bal", "الأرصدة"], ["log", "سجل التسليمات"], ["courier", "أداء المندوب"], ["towels", "المناشف"], ["settings", "الإعدادات"]];
  return <div className="da"><style>{CSS}</style>
    <div className="g-tabs" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={"g-tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{l}</button>)}</div>
    {d && !d.ready && <div className="da-note warn">جداول الاستلام اليومي لم تُنشأ بعد (docs/sql/daily_receive.sql بانتظار موافقة المالك). الصفحة للعرض فقط حتى التطبيق.</div>}
    {d && d.error && <div className="da-note bad">تعذّر تحميل بعض البيانات: {String(d.error.message || d.error)}</div>}
    {!d ? <div className="g-card da-card"><div className="g-skel box" style={{ height: 160 }} /></div>
      : tab === "today" ? <Today d={d} c={ctx} onZoom={setZoom} />
      : tab === "bal" ? <Bal d={d} c={ctx} me={me} onSaved={reloadAll} />
      : tab === "log" ? <Log d={d} c={ctx} />
      : tab === "courier" ? <Courier d={d} c={ctx} />
      : tab === "towels" ? <Towels d={d} />
      : <Settings d={d} owner={owner} onSaved={reloadAll} />}
    {zoom && <div className="da-zoom" role="dialog" aria-label="صورة الشحنة" onClick={() => setZoom(null)}><img src={zoom} alt="صورة الشحنة مكبّرة" /><button className="g-btn" onClick={() => setZoom(null)}>إغلاق</button></div>}
  </div>;
}

const Lines = ({ x, c }) => <div className="da-kv">{(x.daily_delivery_lines || []).filter(l => l.qty > 0).map(l => <span key={l.item_key} className="g-badge brand">{c.item(l.item_key).name_ar} <b className="da-num">{l.qty}</b></span>)}
  {x.towels_returned > 0 && <span className="g-badge">ربطات مستعملة مُرجَعة <b className="da-num">{x.towels_returned}</b></span>}</div>;

// شارتا «لم يُرسل» لرسالتي القروبين (بعد التوزيع فقط)
const SentBadges = ({ x }) => x.status !== "distributed" ? null : <>{!x.shared_sweater_at && <span className="g-badge bad">لم يُرسل لسويتر</span>}{!x.shared_ops_at && <span className="g-badge bad">لم يُرسل للعمليات</span>}</>;
// رسالتا القروبين لتسليم (للمالك والمشرف: نسخ فقط، لا يغيّر shared_*_at)
const msgsFor = (x, d, c) => { const r = d.employees.find(e => e.id === x.received_by) || { id: x.received_by, full_name: c.empName(x.received_by) };
  const input = { delivery: x, lines: x.daily_delivery_lines || [], items: d.items, courier: c.courier(x.courier_id), receiver: r, shares: d.shares.filter(s => s.delivery_id === x.id), team: d.employees };
  return { sweater: waMessage(input, "sweater"), ops: waMessage(input, "ops") }; };
function CopyMsgs({ x, d, c }) {
  const [st, setSt] = useState("");
  const cp = async k => { const ok = await copyText(msgsFor(x, d, c)[k]); setSt(ok ? (k === "sweater" ? "نُسخت رسالة سويتر" : "نُسخت رسالة العمليات") : "تعذّر النسخ"); setTimeout(() => setSt(""), 2500); };
  return <div className="da-top" style={{ justifyContent: "flex-start" }}><button className="g-btn sm" onClick={() => cp("sweater")}>نسخ رسالة سويتر</button><button className="g-btn sm" onClick={() => cp("ops")}>نسخ رسالة العمليات</button>{st && <span className="da-mut" role="status">{st}</span>}</div>;
}

function DeliveryCard({ x, d, c, onZoom }) {
  const co = c.courier(x.courier_id), sh = d.shares.filter(s => s.delivery_id === x.id);
  const pend = [...new Set(sh.filter(s => s.status === "pending").map(s => s.employee_id))], short = [...new Set(sh.filter(s => s.status === "short").map(s => s.employee_id))];
  return <div className="g-card da-card">
    <div className="da-top"><div><h3><span className="da-num">{fmt(x.received_at)}</span> <SlotBadge t={x.received_at} /></h3>
      <span className="da-mut">المستلم: <b>{c.empName(x.received_by)}</b> · المندوب: <b>{co ? co.name : "—"}</b> {co && <a className="da-num" href={"tel:" + co.phone}>{co.phone}</a>}</span></div>
      <div className="da-kv">{x.status === "distributed" ? <span className="g-badge ok"><i />وُزّع</span> : <span className="g-badge warn"><i />بانتظار التوزيع</span>}<SentBadges x={x} /></div></div>
    <Lines x={x} c={c} />
    {x.note && <div className="da-note">ملاحظة المستلم: {x.note}</div>}
    <div className="da-photos">{(x.photos || []).map(p => <Photo key={p} path={p} onOpen={onZoom} />)}</div>
    {x.status === "distributed" && (pend.length ? <div className="da-note warn">لم يؤكد بعد: {pend.map(c.empName).join("، ")}</div> : <div className="da-note ok">أكّد الجميع استلام أنصبتهم.</div>)}
    {short.length > 0 && <div className="da-note bad">أبلغ بنقص: {short.map(id => { const n = sh.filter(s => s.employee_id === id && s.status === "short"); return c.empName(id) + " (" + n.map(s => c.item(s.item_key).name_ar + " " + s.qty_actual + "/" + s.qty).join("، ") + (n[0] && n[0].note ? " — " + n[0].note : "") + ")"; }).join(" · ")}</div>}
    {x.status === "distributed" && <CopyMsgs x={x} d={d} c={c} />}
  </div>;
}

function Today({ d, c, onZoom }) {
  const today = riyadhDay(Date.now()), y = riyadhDay(Date.now() - 864e5);
  // «اليوم» التشغيلي: شحنات الليلة (من أمس 12 ظهراً) تُحسب لليوم
  const list = d.deliveries.filter(x => riyadhDay(x.received_at) === today || (riyadhDay(x.received_at) === y && +riyadhHM(x.received_at).slice(0, 2) >= 12));
  const open = d.deliveries.filter(x => !list.includes(x) && (x.status === "received" || d.shares.some(s => s.delivery_id === x.id && s.status === "pending")));
  return <>
    {list.length ? list.map(x => <DeliveryCard key={x.id} x={x} d={d} c={c} onZoom={onZoom} />)
      : <div className="g-card da-card"><div className="g-empty" style={{ padding: "26px 10px" }}><b>لم تصل شحنة اليوم بعد</b><p>تظهر هنا فور تسجيلها من بوابة البايكر (منذ 12 ظهر أمس).</p></div></div>}
    {open.length > 0 && <><h3>تسليمات سابقة لم تكتمل</h3>{open.slice(0, 10).map(x => <DeliveryCard key={x.id} x={x} d={d} c={c} onZoom={onZoom} />)}</>}
  </>;
}

function Bal({ d, c, me, onSaved }) {
  const items = d.items.filter(i => i.active), emps = d.employees;
  const [f, setF] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const save = async () => {
    setErr("");
    const n = parseInt(f.qty, 10);
    if (!f.emp || !f.item) return setErr("اختر البايكر والصنف.");
    if (!(n > 0)) return setErr("أدخل كمية صحيحة.");
    if (!f.reason.trim()) return setErr("اكتب السبب.");
    setBusy(true); const r = await addAdjustment({ employee_id: f.emp, item_key: f.item, delta: f.type === "add" ? n : -n, reason: (f.type === "use" ? "صرف: " : f.type === "loss" ? "فاقد: " : "تسوية: ") + f.reason.trim() }); setBusy(false);
    if (r.error) return setErr(/row-level|42501/.test(String(r.error.message || r.error.code)) ? "لا تملك صلاحية التسوية (تحتاج تعديل «الجولات الميدانية» أو «سلاسل الإمداد»)." : "تعذّر الحفظ: " + (r.error.message || r.error));
    setF(null); onSaved();
  };
  return <>
    <div className="da-top"><span className="da-mut">الرصيد = المستلم المؤكد − المنصرف. ما لم يؤكَّد يبقى على المستلم الأول.</span>
      {!f && <button className="g-btn primary" onClick={() => setF({ emp: "", item: "", type: "use", qty: "", reason: "" })}>+ تسجيل صرف/تسوية</button>}</div>
    {f && <div className="g-card da-card"><h3>صرف / تسوية</h3>
      <div className="da-row">
        <label className="da-f">البايكر<select className="g-select" value={f.emp} onChange={e => setF({ ...f, emp: e.target.value })}><option value="">—</option>{emps.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></label>
        <label className="da-f">الصنف<select className="g-select" value={f.item} onChange={e => setF({ ...f, item: e.target.value })}><option value="">—</option>{d.items.map(i => <option key={i.key} value={i.key}>{i.name_ar}</option>)}</select></label>
        <label className="da-f">النوع<select className="g-select" value={f.type} onChange={e => setF({ ...f, type: e.target.value })}><option value="use">صرف (−)</option><option value="loss">فاقد (−)</option><option value="add">تسوية بالزيادة (+)</option><option value="sub">تسوية بالنقص (−)</option></select></label>
        <label className="da-f">الكمية<input className="g-input" inputMode="numeric" value={f.qty} onChange={e => setF({ ...f, qty: e.target.value.replace(/\D/g, "") })} /></label></div>
      <label className="da-f">السبب<input className="g-input" value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} placeholder="مثلاً: صُرفت لعملاء يوم 3" /></label>
      {err && <div className="da-note bad" role="alert">{err}</div>}
      <div className="da-top"><button className="g-btn" onClick={() => setF(null)}>إلغاء</button><button className="g-btn primary" disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ السطر"}</button></div>
      <span className="da-mut">يُضاف سطر جديد ولا تُعدَّل الأسطر السابقة.</span></div>}
    <div className="g-card da-card" style={{ padding: "8px 6px" }}><div className="da-twrap"><table className="g-tbl da-tbl"><thead><tr><th>البايكر</th>{items.map(i => <th key={i.key}>{i.name_ar}</th>)}</tr></thead>
      <tbody>{emps.map(e => <tr key={e.id}><td>{e.full_name}</td>{items.map(i => { const v = (c.bal[e.id] || {})[i.key] || 0; return <td key={i.key} className="num" style={{ color: v < 0 ? "var(--bad-ink)" : undefined }}><span className="da-num">{v}</span></td>; })}</tr>)}</tbody></table></div></div>
    {d.adjustments.length > 0 && <div className="g-card da-card"><h3>آخر أسطر الصرف والتسوية</h3>
      <div className="da-twrap"><table className="g-tbl compact da-tbl"><thead><tr><th>التاريخ</th><th>البايكر</th><th>الصنف</th><th>الكمية</th><th>السبب</th></tr></thead>
        <tbody>{d.adjustments.slice(0, 30).map(a => <tr key={a.id}><td className="da-num">{fmt(a.created_at)}</td><td>{c.empName(a.employee_id)}</td><td>{c.item(a.item_key).name_ar}</td><td className="num"><span className="da-num">{a.delta > 0 ? "+" + a.delta : a.delta}</span></td><td style={{ whiteSpace: "normal" }}>{a.reason}</td></tr>)}</tbody></table></div></div>}
  </>;
}

function useMonths(d) {
  return useMemo(() => { const s = new Set(d.deliveries.map(x => monthOf(x.received_at))); s.add(monthOf(Date.now())); return [...s].sort().reverse(); }, [d]);
}

function Log({ d, c }) {
  const months = useMonths(d), [m, setM] = useState(months[0]);
  const list = d.deliveries.filter(x => monthOf(x.received_at) === m), sum = monthSummary(list);
  const csv = () => {
    const items = d.items;
    const head = ["التاريخ", "وقت التسليم", "التصنيف", "دقائق التأخير", "المستلم", "المندوب", "جوال المندوب", ...items.map(i => i.name_ar), "ربطات مستعملة مُرجَعة", "الحالة", "ملاحظة", "أُرسل لسويتر", "أُرسل للعمليات"];
    const rows = list.map(x => { const co = c.courier(x.courier_id), L = Object.fromEntries((x.daily_delivery_lines || []).map(l => [l.item_key, l.qty]));
      const sl = deliverySlot(x.received_at);
      return [riyadhDay(x.received_at), riyadhHM(x.received_at), SLOTS[sl.kind].ar, sl.lateMin || 0, c.empName(x.received_by), co ? co.name : "", co ? co.phone : "", ...items.map(i => L[i.key] || 0), x.towels_returned || 0, x.status === "distributed" ? "وُزّع" : "بانتظار التوزيع", x.note || "", x.shared_sweater_at ? riyadhDay(x.shared_sweater_at) + " " + riyadhHM(x.shared_sweater_at) : "لا", x.shared_ops_at ? riyadhDay(x.shared_ops_at) + " " + riyadhHM(x.shared_ops_at) : "لا"]; });
    const txt = "﻿" + [head, ...rows].map(r => r.map(csvCell).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" })); a.download = `daily-deliveries-${m}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return <>
    <div className="da-top"><label className="da-f" style={{ minWidth: 180 }}>الشهر<select className="g-select" value={m} onChange={e => setM(e.target.value)}>{months.map(x => <option key={x} value={x}>{mLabel(x)}</option>)}</select></label>
      <button className="g-btn" disabled={!list.length} onClick={csv}>تصدير CSV</button></div>
    <div className="da-kpis"><div><b className="da-num">{sum.count}</b><span>تسليمات</span></div><div><b className="da-num" style={{ color: sum.late ? "var(--warn-ink)" : undefined }}>{sum.late}</b><span>خارج النافذتين</span></div>
      <div><b className="da-num">{sum.avgTime || "—"}</b><span>متوسط وقت التسليم</span></div>
      {d.items.filter(i => sum.items[i.key]).map(i => <div key={i.key}><b className="da-num">{sum.items[i.key]}</b><span>{i.name_ar}</span></div>)}</div>
    {list.length ? <div className="g-card da-card" style={{ padding: "8px 6px" }}><div className="da-twrap"><table className="g-tbl da-tbl"><thead><tr><th>التاريخ</th><th>وقت التسليم</th><th>المستلم</th><th>المندوب</th><th>الكميات</th><th>الحالة</th></tr></thead>
      <tbody>{list.map(x => { const co = c.courier(x.courier_id); return <tr key={x.id}><td className="da-num">{riyadhDay(x.received_at)}</td>
        <td><span className="da-num">{riyadhHM(x.received_at)}</span> <SlotBadge t={x.received_at} /></td>
        <td>{c.empName(x.received_by)}</td><td>{co ? <>{co.name} <a className="da-num" href={"tel:" + co.phone}>{co.phone}</a></> : "—"}</td>
        <td style={{ whiteSpace: "normal" }}><Lines x={x} c={c} /></td>
        <td><div className="da-kv">{x.status === "distributed" ? <span className="g-badge ok">وُزّع</span> : <span className="g-badge warn">بانتظار التوزيع</span>}<SentBadges x={x} /></div></td></tr>; })}</tbody></table></div></div>
      : <div className="g-card da-card"><div className="g-empty" style={{ padding: "26px 10px" }}><b>لا تسليمات في {mLabel(m)}</b></div></div>}
  </>;
}

// أداء مندوب سويتر: الالتزام بالنافذتين، التأخير، الأيام بلا تسليم، النقص — وتقرير للطباعة يُرسل لسويتر
function Courier({ d, c }) {
  const months = useMonths(d), [m, setM] = useState(months[0]);
  const list = d.deliveries.filter(x => monthOf(x.received_at) === m), ids = new Set(list.map(x => x.id));
  const st = courierStats(list, d.shares.filter(s => ids.has(s.delivery_id))), a = st.all;
  const today = riyadhDay(Date.now()), end = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5), 0)).toISOString().slice(0, 10);
  const missed = missedDays(d.deliveries, m + "-01", today < end ? today : end);
  const exc = list.filter(x => isLate(x.received_at)).sort((p, q) => (p.received_at < q.received_at ? 1 : -1));
  const print = () => { const w = window.open("", "_blank"); if (!w) return;
    w.document.write(courierReport({ month: m, deliveries: d.deliveries, shares: d.shares, items: d.items, couriers: d.couriers, today }) + "<script>window.onload=()=>window.print()<\/script>"); w.document.close(); };
  const K = ({ v, l, tone, rtl }) => <div><b className={rtl ? undefined : "da-num"} style={{ color: tone ? `var(--${tone}-ink)` : undefined }}>{v}</b><span>{l}</span></div>;
  return <>
    <div className="da-top"><label className="da-f" style={{ minWidth: 180 }}>الشهر<select className="g-select" value={m} onChange={e => setM(e.target.value)}>{months.map(x => <option key={x} value={x}>{mLabel(x)}</option>)}</select></label>
      <button className="g-btn primary" onClick={print}>تقرير لسويتر (طباعة / PDF)</button></div>
    <div className="da-note">النافذتان المتفق عليهما: مسائية من <b className="da-num">{hhmm(WINDOWS.eveningFrom)}</b> إلى <b className="da-num">00:00</b> بعد انتهاء الدوام، أو صباحية من <b className="da-num">{hhmm(WINDOWS.morningFrom)}</b> إلى <b className="da-num">{hhmm(WINDOWS.morningTo)}</b> قبل أول طلب، وتسليم كل يوم أو يومين. ما بعد {hhmm(WINDOWS.morningTo)} يُحسب تأخيراً بالدقائق.</div>
    <div className="da-kpis">
      <K v={a.count} l="تسليمات" />
      <K v={a.onTimePct == null ? "—" : a.onTimePct + "%"} l="في الموعد" tone={a.onTimePct == null ? null : a.onTimePct >= 90 ? "ok" : "bad"} />
      <K v={a.late} l="متأخر خلال الدوام" tone={a.late ? "bad" : null} />
      <K v={a.late ? fmtMin(a.lateMinAvg) : "—"} l="متوسط التأخير" rtl />
      <K v={a.night} l="ليلي خارج النافذة" tone={a.night ? "warn" : null} />
      <K v={missed.length} l="أيام بلا تسليم" tone={missed.length ? "bad" : null} />
      <K v={a.shortDeliveries} l="تسليمات فيها نقص" tone={a.shortDeliveries ? "warn" : null} />
    </div>
    {Object.keys(st.byCourier).length > 0 && <div className="g-card da-card" style={{ padding: "8px 6px" }}><div className="da-twrap"><table className="g-tbl da-tbl"><thead><tr><th>المندوب</th><th>تسليمات</th><th>في الموعد</th><th>ليلي</th><th>متأخر</th><th>متوسط / أقصى تأخير</th><th>فيها نقص</th><th>آخر تسليم</th></tr></thead>
      <tbody>{Object.entries(st.byCourier).map(([id, s]) => { const co = c.courier(id); return <tr key={id}><td>{co ? <>{co.name} <a className="da-num" href={"tel:" + co.phone}>{co.phone}</a></> : "—"}</td>
        <td className="num">{s.count}</td><td className="num"><span className="da-num">{s.onTimePct}%</span></td><td className="num">{s.night}</td><td className="num">{s.late}</td>
        <td>{s.late ? fmtMin(s.lateMinAvg) + " / " + fmtMin(s.lateMinMax) : "—"}</td><td className="num">{s.shortDeliveries}</td><td className="da-num">{s.last ? fmt(s.last) : "—"}</td></tr>; })}</tbody></table></div></div>}
    {missed.length > 0 && <div className="da-note bad">أيام عمل بلا تسليم بعد مهلة يومين: <span className="da-num">{missed.map(x => x.slice(8) + "/" + x.slice(5, 7)).join(" · ")}</span></div>}
    {exc.length > 0 ? <div className="g-card da-card"><h3>التسليمات خارج النافذتين</h3>
      <div className="da-twrap"><table className="g-tbl compact da-tbl"><thead><tr><th>التاريخ</th><th>الوقت</th><th>التصنيف</th><th>المندوب</th><th>المستلم</th></tr></thead>
        <tbody>{exc.map(x => { const co = c.courier(x.courier_id); return <tr key={x.id}><td className="da-num">{riyadhDay(x.received_at)}</td><td className="da-num">{riyadhHM(x.received_at)}</td><td><SlotBadge t={x.received_at} /></td><td>{co ? co.name : "—"}</td><td>{c.empName(x.received_by)}</td></tr>; })}</tbody></table></div></div>
      : list.length > 0 && <div className="da-note ok">كل تسليمات {mLabel(m)} داخل النافذتين.</div>}
    {!list.length && <div className="g-card da-card"><div className="g-empty" style={{ padding: "26px 10px" }}><b>لا تسليمات مسجّلة في {mLabel(m)}</b><p>يُبنى الأداء من تسليمات «الاستلام اليومي». سجّل كل تسليم من بوابة المستلم بدل واتساب ليظهر هنا وفي التقرير.</p></div></div>}
  </>;
}

function Towels({ d }) {
  const towelKeys = d.items.filter(i => i.kind === "towel").map(i => i.key);
  const months = useMonths(d);
  const rows = months.map(m => { const L = d.deliveries.filter(x => monthOf(x.received_at) === m);
    const clean = L.reduce((a, x) => a + (x.daily_delivery_lines || []).filter(l => towelKeys.includes(l.item_key)).reduce((s, l) => s + l.qty, 0), 0), dirty = L.reduce((a, x) => a + (x.towels_returned || 0), 0);
    return { m, clean, dirty, diff: clean - dirty, n: L.length }; });
  return <div className="g-card da-card"><h3>ربطات المناشف: نظيفة مستلمة مقابل مستعملة مُرجَعة</h3>
    <span className="da-mut">الوحدة هي الربطة (ربطة لكل غسلة). الفرق الموجب = ربطات نظيفة عند الفريق لم يُرجَع مقابلها مستعملة بعد.</span>
    <div className="da-twrap"><table className="g-tbl da-tbl"><thead><tr><th>الشهر</th><th>تسليمات</th><th>نظيفة مستلمة</th><th>مستعملة مُرجَعة</th><th>الفرق</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.m}><td>{mLabel(r.m)}</td><td className="num">{r.n}</td><td className="num">{r.clean}</td><td className="num">{r.dirty}</td><td className="num" style={{ color: r.diff ? "var(--warn-ink)" : undefined, fontWeight: 800 }}><span className="da-num">{r.diff > 0 ? "+" + r.diff : r.diff}</span></td></tr>)}</tbody></table></div></div>;
}

// البايكرز المشمولون بالتوزيع — تشغيل/إيقاف عبر set_daily_split (تتحقق من daily_staff(true) على الخادم)
function SplitMembers() {
  const [s, setS] = useState(null), [busy, setBusy] = useState(null), [err, setErr] = useState("");
  const load = () => loadSplit().then(setS).catch(() => setS({ list: [] }));
  useEffect(() => { load(); }, []);
  const toggle = async b => {
    setErr(""); setBusy(b.id);
    const r = await setSplit(b.id, !b.in_daily_split); setBusy(null);
    if (r.error) return setErr(/not allowed|42501/.test(String(r.error.message || r.error.code)) ? "لا تملك صلاحية تعديل الشمول (تحتاج تعديل «الجولات الميدانية» أو «سلاسل الإمداد»)." : "تعذّر الحفظ: " + (r.error.message || r.error));
    setS(x => ({ ...x, list: x.list.map(y => y.id === b.id ? { ...y, in_daily_split: !b.in_daily_split } : y) }));
  };
  return <div className="g-card da-card"><h3>البايكرز المشمولون بالتوزيع</h3>
    <span className="da-mut">غير المشمول (متدرب مرافق) لا يدخل القسمة ولا يظهر في جدول التوزيع، ويبقى قادراً على تسجيل استلام من المندوب.</span>
    {!s ? <div className="g-skel box" style={{ height: 80 }} /> : s.missing ? <span className="da-mut">يتاح بعد تطبيق daily_receive.sql.</span>
      : !s.list.length ? <span className="da-mut">لا بايكرز (أو لا تملك صلاحية العرض).</span>
      : <div className="da-twrap"><table className="g-tbl compact da-tbl"><thead><tr><th>البايكر</th><th>الحالة</th><th>في التوزيع</th></tr></thead>
        <tbody>{s.list.map(b => <tr key={b.id}><td>{b.full_name} <span className="da-mut da-num">#{b.employee_id}</span></td>
          <td>{b.in_daily_split ? <span className="g-badge ok">مشمول</span> : <span className="g-badge warn">متدرب مرافق</span>}</td>
          <td><button type="button" role="switch" aria-checked={!!b.in_daily_split} aria-label={"شمول " + b.full_name + " بالتوزيع"} className={"g-btn sm " + (b.in_daily_split ? "ok" : "")} disabled={busy === b.id} onClick={() => toggle(b)}>{busy === b.id ? "…" : b.in_daily_split ? "تشغيل ✓" : "إيقاف"}</button></td></tr>)}</tbody></table></div>}
    {(s && s.error) && <div className="da-note bad">{String(s.error.message || s.error)}</div>}
    {err && <div className="da-note bad" role="alert">{err}</div>}
  </div>;
}

function Settings({ d, owner, onSaved }) {
  const [err, setErr] = useState(""), [ni, setNi] = useState(null), [ec, setEc] = useState(null);
  const run = async p => { setErr(""); const r = await p; if (r.error) { setErr(/row-level|42501/.test(String(r.error.message || r.error.code)) ? "لا تملك صلاحية هذا التعديل." : "تعذّر الحفظ: " + (r.error.message || r.error)); return false; } onSaved(); return true; };
  const items = [...d.items].sort((a, b) => a.sort - b.sort);
  const move = (i, dir) => { const a = items[i], b = items[i + dir]; if (!b) return; run(Promise.all([saveItem({ key: a.key, sort: b.sort }), saveItem({ key: b.key, sort: a.sort })]).then(rs => rs.find(r => r.error) || { ok: true })); };
  return <>
    {err && <div className="da-note bad" role="alert">{err}</div>}
    <div className="g-card da-card"><div className="da-top"><h3>الأصناف</h3>{owner && !ni && <button className="g-btn" onClick={() => setNi({ key: "", name_ar: "", name_bn: "", name_en: "", kind: "addon" })}>+ صنف</button>}</div>
      {!owner && <span className="da-mut">تعديل الأصناف للمالك فقط.</span>}
      {ni && <div className="da-row">
        {!ni._edit && <label className="da-f">المفتاح (لاتيني)<input className="g-input da-num" value={ni.key} onChange={e => setNi({ ...ni, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} /></label>}
        <label className="da-f">الاسم<input className="g-input" value={ni.name_ar} onChange={e => setNi({ ...ni, name_ar: e.target.value })} /></label>
        <label className="da-f">বাংলা<input className="g-input" lang="bn" value={ni.name_bn || ""} onChange={e => setNi({ ...ni, name_bn: e.target.value })} /></label>
        <label className="da-f">English (للرسائل)<input className="g-input" dir="ltr" value={ni.name_en || ""} placeholder="فارغ ⇒ الاسم العربي" onChange={e => setNi({ ...ni, name_en: e.target.value })} /></label>
        <label className="da-f">النوع<select className="g-select" value={ni.kind} onChange={e => setNi({ ...ni, kind: e.target.value })}><option value="addon">خدمة إضافية</option><option value="towel">مناشف</option><option value="consumable">مستهلك</option></select></label>
        <div style={{ display: "flex", gap: 8, flex: "none" }}><button className="g-btn" onClick={() => setNi(null)}>إلغاء</button><button className="g-btn primary" disabled={!ni.key || !ni.name_ar.trim()} onClick={async () => { const row = { key: ni.key, name_ar: ni.name_ar.trim(), name_bn: (ni.name_bn || "").trim() || null, name_en: (ni.name_en || "").trim() || null, kind: ni.kind };
          if (await run(ni._edit ? saveItem(row) : saveItem({ ...row, sort: (items[items.length - 1] || { sort: 0 }).sort + 1, active: true }, true))) setNi(null); }}>{ni._edit ? "حفظ" : "إضافة"}</button></div></div>}
      <div className="da-twrap"><table className="g-tbl compact da-tbl"><thead><tr><th>الترتيب</th><th>الصنف</th><th>النوع</th><th>الحالة</th></tr></thead>
        <tbody>{items.map((i, k) => <tr key={i.key}><td>{owner ? <><button className="g-btn sm icon" aria-label="أعلى" disabled={!k} onClick={() => move(k, -1)}>↑</button> <button className="g-btn sm icon" aria-label="أسفل" disabled={k === items.length - 1} onClick={() => move(k, 1)}>↓</button></> : i.sort}</td>
          <td>{i.name_ar} <span className="da-mut" lang="bn">{i.name_bn}</span> <span className="da-mut" dir="ltr">{i.name_en}</span>{owner && !ni && <> <button className="g-btn sm" onClick={() => setNi({ ...i, _edit: true })}>تعديل</button></>}</td><td>{{ addon: "خدمة إضافية", towel: "مناشف", consumable: "مستهلك" }[i.kind]}</td>
          <td>{owner ? <button className={"g-btn sm " + (i.active ? "ok" : "")} onClick={() => run(saveItem({ key: i.key, active: !i.active }))}>{i.active ? "فعّال" : "معطّل"}</button> : i.active ? "فعّال" : "معطّل"}</td></tr>)}</tbody></table></div></div>
    <SplitMembers />
    <div className="g-card da-card"><h3>المندوبون</h3><span className="da-mut">يضيفهم البايكر عند الاستلام؛ هنا التعديل والتعطيل.</span>
      {d.couriers.length ? <div className="da-twrap"><table className="g-tbl compact da-tbl"><thead><tr><th>الاسم</th><th>الجوال</th><th>الحالة</th><th></th></tr></thead>
        <tbody>{d.couriers.map(co => ec && ec.id === co.id ? <tr key={co.id}><td><input className="g-input" value={ec.name} onChange={e => setEc({ ...ec, name: e.target.value })} /></td><td><input className="g-input da-num" inputMode="tel" value={ec.phone} onChange={e => setEc({ ...ec, phone: e.target.value })} /></td><td />
          <td><button className="g-btn sm" onClick={() => setEc(null)}>إلغاء</button> <button className="g-btn sm primary" onClick={async () => { const ph = normPhone(ec.phone); if (!ec.name.trim() || !ph) return setErr("الاسم والجوال (05XXXXXXXX) مطلوبان."); if (await run(saveCourier(co.id, { name: ec.name.trim(), phone: ph }))) setEc(null); }}>حفظ</button></td></tr>
          : <tr key={co.id}><td>{co.name}</td><td><a className="da-num" href={"tel:" + co.phone}>{co.phone}</a></td><td>{co.active ? <span className="g-badge ok">فعّال</span> : <span className="g-badge">معطّل</span>}</td>
            <td><button className="g-btn sm" onClick={() => setEc({ id: co.id, name: co.name, phone: co.phone })}>تعديل</button> <button className="g-btn sm" onClick={() => run(saveCourier(co.id, { active: !co.active }))}>{co.active ? "تعطيل" : "تفعيل"}</button></td></tr>)}</tbody></table></div>
        : <span className="da-mut">لا مندوبين بعد.</span>}</div>
  </>;
}
