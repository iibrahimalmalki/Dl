// سجل التسليم والاستلام (bike_handovers) — تبويب في صفحة الأسطول للمالك والمشرف.
// جدول على الشاشات الواسعة وبطاقات على الجوال؛ الضغط يفتح التقرير الكامل (HandoverReport).
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { handoverSummary } from "./handover";

const HandoverReport = lazy(() => import("./HandoverReport"));

const CSS = `
.hl-filters{display:flex;gap:10px;flex-wrap:wrap;padding:12px 18px;border-bottom:1px solid var(--line)}
.hl-filters label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:var(--ink-2);min-width:140px;flex:1;max-width:260px}
.hl-twrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
.hl-tbl{width:100%;border-collapse:collapse;font-size:13px}
.hl-tbl th{font-size:11px;color:var(--mut);font-weight:700;text-align:start;padding:9px 12px;border-bottom:1px solid var(--line);white-space:nowrap;background:var(--glass-2)}
.hl-tbl td{padding:10px 12px;border-bottom:1px solid var(--line);white-space:nowrap;vertical-align:middle;color:var(--ink)}
.hl-tbl tbody tr{cursor:pointer}.hl-tbl tbody tr:hover{background:var(--hover)}
.hl-tbl tr.warn td:first-child{box-shadow:inset -3px 0 0 var(--warn)}
.hl-num{font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:isolate}
.hl-ok{color:var(--ok-ink);font-weight:800}.hl-bad{color:var(--bad-ink);font-weight:800}.hl-na{color:var(--mut-2)}
.hl-nb{display:inline-block;font-size:11px;font-weight:800;padding:2px 9px;border-radius:20px;background:var(--warn-bg);color:var(--warn-ink);white-space:nowrap}
.hl-nb.ok{background:var(--ok-bg);color:var(--ok-ink)}
.hl-cards{display:none;flex-direction:column;gap:10px;padding:12px}
.hl-card{all:unset;box-sizing:border-box;display:flex;flex-direction:column;gap:6px;padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:var(--glass-2);cursor:pointer;min-width:0;text-align:start}
.hl-card:focus-visible{outline:2px solid var(--brand,#3b82f6);outline-offset:2px}
.hl-card.warn{border-inline-start:4px solid var(--warn)}
.hl-card .r{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;min-width:0}
.hl-card .p{font-size:15px;font-weight:800;color:var(--ink)}
.hl-card .m{font-size:12.5px;color:var(--ink-2);overflow-wrap:anywhere}
.hl-card .d{font-size:11.5px;color:var(--mut)}
@media (max-width:640px){.hl-twrap{display:none}.hl-cards{display:flex}.hl-filters{padding:10px 12px}.hl-filters label{max-width:none}}
`;
const fmt = t => { try { return new Date(t).toLocaleString("en-GB", { timeZone: "Asia/Riyadh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; } };
const Tick = ({ v, n }) => v == null ? <span className="hl-na">—</span> : v ? <span className="hl-ok">✓{n != null ? <> <span className="hl-num">{n}</span></> : null}</span> : <span className="hl-bad">✗</span>;
const dirAr = d => d === "receive" ? "استلام" : d === "return" ? "تسليم" : d || "—";
const NotesBadge = ({ n }) => n ? <span className="hl-nb">ملاحظات: <span className="hl-num">{n}</span></span> : <span className="hl-nb ok">لا ملاحظات ✓</span>;

export default function HandoverLog({ veh = [] }) {
  const [rows, setRows] = useState(null), [err, setErr] = useState(""), [open, setOpen] = useState(null);
  const [fPlate, setFPlate] = useState(""), [fBiker, setFBiker] = useState("");
  const load = async () => {
    const { data, error } = await supabase.from("bike_handovers").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) { setErr(error.message); setRows([]); } else setRows(data || []);
  };
  useEffect(() => { load(); }, []);
  const plates = useMemo(() => [...new Set([...(rows || []).map(r => r.plate).filter(Boolean), ...veh.map(v => v.plate)])].sort(), [rows, veh]);
  const bikers = useMemo(() => { const m = new Map(); (rows || []).forEach(r => { if (r.biker_employee_id) m.set(r.biker_employee_id, r.biker_name || r.biker_employee_id); }); return [...m.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]))); }, [rows]);
  const list = (rows || []).filter(r => (!fPlate || r.plate === fPlate) && (!fBiker || r.biker_employee_id === fBiker));
  const onReviewed = u => setRows(rs => (rs || []).map(x => x.id === u.id ? u : x));
  const openRow = open && (rows || []).find(r => r.id === open);
  if (!rows) return <div style={{ padding: 18 }}><div className="g-skel box" style={{ height: 120 }} /></div>;
  return <>
    <style>{CSS}</style>
    <div className="hl-filters">
      <label>الدراجة<select className="g-select" value={fPlate} onChange={e => setFPlate(e.target.value)}><option value="">الكل</option>{plates.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
      <label>البايكر<select className="g-select" value={fBiker} onChange={e => setFBiker(e.target.value)}><option value="">الكل</option>{bikers.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
    </div>
    {err && <div style={{ margin: "10px 18px", padding: "10px 12px", borderRadius: 10, background: "var(--bad-bg)", color: "var(--bad-ink)", fontSize: 13 }} role="alert">{err}</div>}
    {!list.length ? <div style={{ textAlign: "center", color: "var(--mut)", padding: 26 }}>لا توجد سجلات تسليم أو استلام.</div> : <>
      <div className="hl-twrap"><table className="hl-tbl">
        <thead><tr><th>التاريخ والوقت</th><th>الدراجة</th><th>البايكر</th><th>النوع</th><th>العدّاد</th><th>الصندوق</th><th>مفتاح الدراجة</th><th>مفتاح الصندوق</th><th>الملاحظات</th><th>المراجعة</th></tr></thead>
        <tbody>{list.map(r => { const S = handoverSummary(r), rec = S.rec;
          return <tr key={r.id} className={S.warn ? "warn" : ""} onClick={() => setOpen(r.id)} tabIndex={0} onKeyDown={e => { if (e.key === "Enter") setOpen(r.id); }} aria-label={"فتح تقرير " + (r.plate || "")}>
            <td className="hl-num">{fmt(r.created_at)}</td>
            <td><b>{r.plate || "—"}</b></td>
            <td>{r.biker_name || "—"} <span className="hl-na hl-num">{r.biker_employee_id}</span></td>
            <td>{dirAr(r.direction)}</td>
            <td className="hl-num">{r.odometer ?? "—"}</td>
            <td><Tick v={rec ? rec.box : null} /></td>
            <td><Tick v={rec ? rec.bike_key : null} n={rec && rec.bike_key ? rec.bike_keys : null} /></td>
            <td><Tick v={rec ? rec.box_key : null} n={rec && rec.box_key ? rec.box_keys : null} /></td>
            <td><NotesBadge n={S.issues.length} /></td>
            <td>{r.reviewed_at ? <span className="hl-ok">✓ <span className="hl-num">{fmt(r.reviewed_at)}</span></span> : <span className="hl-na">بانتظار المراجعة</span>}</td>
          </tr>; })}</tbody>
      </table></div>
      <div className="hl-cards">{list.map(r => { const S = handoverSummary(r);
        return <button type="button" key={r.id} className={"hl-card" + (S.warn ? " warn" : "")} onClick={() => setOpen(r.id)}>
          <div className="r"><span className="p">{r.plate || "—"}</span><NotesBadge n={S.issues.length} /></div>
          <div className="m">{r.biker_name || "—"} <span className="hl-na hl-num">{r.biker_employee_id}</span> · {dirAr(r.direction)}</div>
          <div className="r"><span className="d hl-num">{fmt(r.created_at)}</span>{r.reviewed_at ? <span className="hl-ok" style={{ fontSize: 11.5 }}>✓ تمت المراجعة</span> : <span className="d">بانتظار المراجعة</span>}</div>
        </button>; })}</div>
    </>}
    {openRow && <Suspense fallback={null}><HandoverReport row={openRow} vehicle={veh.find(v => v.id === openRow.vehicle_id)} mode="admin" onReviewed={onReviewed} onClose={() => setOpen(null)} /></Suspense>}
  </>;
}
