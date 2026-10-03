// سجل التسليم والاستلام (bike_handovers) — تبويب في صفحة الأسطول للمالك والمشرف.
// السجلات القديمة (بلا checklist.received ولا صور صندوق) تُعرض بـ«—».
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { CHECKLIST, RECEIVED_ITEMS, BOX_PHOTOS, handoverSummary } from "./handover";

const CSS = `
.hl-filters{display:flex;gap:10px;flex-wrap:wrap;padding:12px 18px;border-bottom:1px solid var(--line)}
.hl-filters label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:var(--ink-2);min-width:160px;flex:1;max-width:260px}
.hl-twrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
.hl-tbl{width:100%;border-collapse:collapse;font-size:13px}
.hl-tbl th{font-size:11px;color:var(--mut);font-weight:700;text-align:start;padding:9px 12px;border-bottom:1px solid var(--line);white-space:nowrap;background:var(--glass-2)}
.hl-tbl td{padding:10px 12px;border-bottom:1px solid var(--line);white-space:nowrap;vertical-align:middle;color:var(--ink)}
.hl-tbl tbody tr{cursor:pointer}.hl-tbl tbody tr:hover{background:var(--hover)}
.hl-tbl tr.warn td:first-child{box-shadow:inset -3px 0 0 var(--warn)}
.hl-num{font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:isolate}
.hl-ok{color:var(--ok-ink);font-weight:800}.hl-bad{color:var(--bad-ink);font-weight:800}.hl-na{color:var(--mut-2)}
.hl-det{padding:14px 18px;background:var(--soft);display:flex;flex-direction:column;gap:12px;white-space:normal}
.hl-sec b{display:block;font-size:12.5px;margin-bottom:6px;color:var(--ink)}
.hl-chips{display:flex;flex-wrap:wrap;gap:6px}
.hl-chip{font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:20px;background:var(--ok-bg);color:var(--ok-ink)}.hl-chip.bad{background:var(--bad-bg);color:var(--bad-ink)}.hl-chip.na{background:var(--glass-3);color:var(--mut)}
.hl-photos{display:flex;flex-wrap:wrap;gap:8px}
.hl-ph{display:flex;flex-direction:column;gap:3px;font-size:10.5px;color:var(--mut);font-weight:700;text-align:center;width:92px}
.hl-ph button{width:92px;height:70px;border-radius:10px;overflow:hidden;border:1px solid var(--line);padding:0;background:var(--glass-3);cursor:zoom-in}
.hl-ph img{width:100%;height:100%;object-fit:cover;display:block}
.hl-zoom{position:fixed;inset:0;z-index:1000;background:rgba(5,8,20,.86);display:flex;align-items:center;justify-content:center;padding:16px;cursor:zoom-out}
.hl-zoom img{max-width:100%;max-height:100%;border-radius:12px}
.hl-zoom button{position:absolute;top:14px;inset-inline-end:14px}
.hl-warn{display:inline-block;font-size:11px;font-weight:800;padding:2px 8px;border-radius:20px;background:var(--warn-bg);color:var(--warn-ink);margin-inline-start:6px}
`;
const fmt = t => { try { return new Date(t).toLocaleString("en-GB", { timeZone: "Asia/Riyadh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; } };
const Tick = ({ v, n }) => v == null ? <span className="hl-na">—</span> : v ? <span className="hl-ok">✓{n != null ? <> <span className="hl-num">{n}</span></> : null}</span> : <span className="hl-bad">✗</span>;

export default function HandoverLog({ veh = [] }) {
  const [rows, setRows] = useState(null), [err, setErr] = useState(""), [open, setOpen] = useState(null), [zoom, setZoom] = useState(null);
  const [fPlate, setFPlate] = useState(""), [fBiker, setFBiker] = useState(""), [busy, setBusy] = useState(null);
  const load = async () => {
    const { data, error } = await supabase.from("bike_handovers").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) { setErr(error.message); setRows([]); } else setRows(data || []);
  };
  useEffect(() => { load(); }, []);
  const ids = CHECKLIST.map(c => c.id);
  const plates = useMemo(() => [...new Set([...(rows || []).map(r => r.plate).filter(Boolean), ...veh.map(v => v.plate)])].sort(), [rows, veh]);
  const bikers = useMemo(() => { const m = new Map(); (rows || []).forEach(r => { if (r.biker_employee_id) m.set(r.biker_employee_id, r.biker_name || r.biker_employee_id); }); return [...m.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]))); }, [rows]);
  const list = (rows || []).filter(r => (!fPlate || r.plate === fPlate) && (!fBiker || r.biker_employee_id === fBiker));
  const review = async r => {
    setBusy(r.id); setErr("");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("bike_handovers").update({ reviewed_by: u && u.user ? u.user.id : null, reviewed_at: new Date().toISOString() }).eq("id", r.id).select("id").single();
    setBusy(null);
    if (error) return setErr(/row-level|42501|0 rows|PGRST116/.test(String(error.message || error.code)) ? "لا تملك صلاحية المراجعة (تحتاج صلاحية تعديل «الأسطول»)." : "تعذّر الحفظ: " + error.message);
    load();
  };
  if (!rows) return <div style={{ padding: 18 }}><div className="g-skel box" style={{ height: 120 }} /></div>;
  return <>
    <style>{CSS}</style>
    <div className="hl-filters">
      <label>الدراجة<select className="g-select" value={fPlate} onChange={e => setFPlate(e.target.value)}><option value="">الكل</option>{plates.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
      <label>البايكر<select className="g-select" value={fBiker} onChange={e => setFBiker(e.target.value)}><option value="">الكل</option>{bikers.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
    </div>
    {err && <div style={{ margin: "10px 18px", padding: "10px 12px", borderRadius: 10, background: "var(--bad-bg)", color: "var(--bad-ink)", fontSize: 13 }} role="alert">{err}</div>}
    {!list.length ? <div style={{ textAlign: "center", color: "var(--mut)", padding: 26 }}>لا توجد سجلات تسليم أو استلام.</div> :
      <div className="hl-twrap"><table className="hl-tbl">
        <thead><tr><th>التاريخ والوقت</th><th>الدراجة</th><th>البايكر</th><th>النوع</th><th>العدّاد</th><th>الصندوق</th><th>مفتاح الدراجة</th><th>مفتاح الصندوق</th><th>ملاحظات</th><th>المراجعة</th></tr></thead>
        <tbody>{list.map(r => { const S = handoverSummary(r, ids), rec = S.rec, isOpen = open === r.id;
          return [<tr key={r.id} className={S.warn ? "warn" : ""} onClick={() => setOpen(isOpen ? null : r.id)} tabIndex={0} onKeyDown={e => { if (e.key === "Enter") setOpen(isOpen ? null : r.id); }} aria-expanded={isOpen}>
            <td className="hl-num">{fmt(r.created_at)}{S.warn && <span className="hl-warn">⚠ تنبيه</span>}</td>
            <td><b>{r.plate || "—"}</b></td>
            <td>{r.biker_name || "—"} <span className="hl-na hl-num">{r.biker_employee_id}</span></td>
            <td>{r.direction === "receive" ? "استلام" : r.direction === "return" ? "تسليم" : r.direction || "—"}</td>
            <td className="hl-num">{r.odometer ?? "—"}</td>
            <td><Tick v={rec ? rec.box : null} /></td>
            <td><Tick v={rec ? rec.bike_key : null} n={rec && rec.bike_key ? rec.bike_keys : null} /></td>
            <td><Tick v={rec ? rec.box_key : null} n={rec && rec.box_key ? rec.box_keys : null} /></td>
            <td style={{ whiteSpace: "normal", maxWidth: 220 }}>{r.condition_notes || "—"}</td>
            <td>{r.reviewed_at ? <span className="hl-ok">✓ <span className="hl-num">{fmt(r.reviewed_at)}</span></span> : <button className="g-btn sm" disabled={busy === r.id} onClick={e => { e.stopPropagation(); review(r); }}>{busy === r.id ? "…" : "تمت المراجعة"}</button>}</td>
          </tr>, isOpen && <tr key={r.id + "-d"}><td colSpan={10} style={{ padding: 0 }}><Detail r={r} S={S} onZoom={setZoom} /></td></tr>]; })}</tbody>
      </table></div>}
    {zoom && <div className="hl-zoom" role="dialog" aria-label="صورة مكبّرة" onClick={() => setZoom(null)}><img src={zoom} alt="صورة مكبّرة" /><button className="g-btn" onClick={() => setZoom(null)}>إغلاق</button></div>}
  </>;
}

function Detail({ r, S, onZoom }) {
  const ck = r.checklist || {}, p = r.photos || {}, rec = S.rec;
  const ph = (url, label, k) => <div className="hl-ph" key={k}>{url ? <button type="button" onClick={() => onZoom(url)} aria-label={"تكبير " + label}><img src={url} alt={label} loading="lazy" /></button> : <button type="button" disabled style={{ cursor: "default" }}><span className="hl-na">—</span></button>}{label}</div>;
  const bike = [["front", "أمام"], ["back", "خلف"], ["right", "يمين"], ["left", "يسار"]].map(([k, l]) => ph(p[k] || r["photo_" + k], "الدراجة — " + l, k));
  const dmg = (p.damages || r.damage_photos || []).filter(Boolean);
  return <div className="hl-det">
    <div className="hl-sec"><b>قائمة التحقق</b><div className="hl-chips">{CHECKLIST.map(c => <span key={c.id} className={"hl-chip" + (ck[c.id] === false ? " bad" : ck[c.id] == null ? " na" : "")}>{ck[c.id] === false ? "✗" : ck[c.id] == null ? "—" : "✓"} {c.ar}</span>)}</div></div>
    <div className="hl-sec"><b>المستلَمات</b>{rec ? <div className="hl-chips">{RECEIVED_ITEMS.map(it => <span key={it.id} className={"hl-chip" + (rec[it.id] ? "" : " bad")}>{rec[it.id] ? "✓" : "✗"} {it.ar}{it.count && rec[it.id] ? ` (${rec[it.count]})` : ""}{!rec[it.id] && rec.reasons && rec.reasons[it.id] ? ` — ${rec.reasons[it.id]}` : ""}</span>)}</div> : <span className="hl-na">— (سجل قبل إضافة المستلَمات)</span>}</div>
    <div className="hl-sec"><b>صور الدراجة والعدّاد</b><div className="hl-photos">{bike}{ph(p.odometer || r.photo_odometer, "العدّاد", "odo")}</div></div>
    <div className="hl-sec"><b>صور الصندوق</b>{BOX_PHOTOS.some(b => p[b.id]) ? <div className="hl-photos">{BOX_PHOTOS.map(b => ph(p[b.id], b.ar, b.id))}</div> : <span className="hl-na">—</span>}</div>
    <div className="hl-sec"><b>صور الأضرار</b>{dmg.length ? <div className="hl-photos">{dmg.map((u, i) => ph(u, "ضرر " + (i + 1), "d" + i))}</div> : <span className="hl-na">—</span>}</div>
    {r.condition_notes && <div className="hl-sec"><b>ملاحظات البايكر</b><span>{r.condition_notes}</span></div>}
  </div>;
}
