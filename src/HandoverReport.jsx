// تقرير استلام/تسليم الدراجة — لوحة كاملة مشتركة بين المالك/المشرف (من سجل الأسطول) والبايكر (من «آخر سجلاتك»).
// عمود واحد على الجوال بلا تمرير أفقي. المالك/المشرف: «تمت المراجعة»، «رسالة لسويتر»، «طباعة / PDF».
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "./supabase";
import { humanError } from "./errors";
import { checklistOf, RECEIVED_ITEMS, BOX_PHOTOS, handoverIssues, handoverSweaterMessage, riyadhStamp, damagePart, damageType } from "./handover";
import { copyText } from "./daily/store";
import { STATES, handoverState, fixInfo, redoOf, validateFixReason, fixPatch, approvePatch } from "./handoverStatus";

const CSS = `
.hr-ov{position:fixed;inset:0;z-index:1200;background:var(--bg);overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;direction:rtl;font-family:var(--font);color:var(--ink)}
.hr-ov *{box-sizing:border-box}
.hr-bar{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:10px;padding:10px 14px;padding-top:max(10px,env(safe-area-inset-top));background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border-bottom:1px solid var(--line)}
.hr-bar h1{flex:1;min-width:0;margin:0;font-size:16px;font-weight:900;line-height:1.35}
.hr-bar h1 .bn{display:block;font-size:11px;font-weight:600;color:var(--mut)}
.hr-x{min-width:44px;min-height:44px;border-radius:12px;border:1px solid var(--line-2);background:var(--glass-2);color:var(--ink);font:inherit;font-size:14px;font-weight:800;cursor:pointer;padding:0 12px}
.hr-x:focus-visible,.hr-ph button:focus-visible{outline:none;box-shadow:var(--glow)}
.hr-body{max-width:760px;margin:0 auto;padding:12px 12px calc(28px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:12px}
.hr-card{padding:14px 16px;border-radius:16px;display:flex;flex-direction:column;gap:10px;min-width:0}
.hr-card h2{margin:0;font-size:15px;font-weight:900;color:var(--ink)}
.hr-card h2 .bn{font-size:11px;font-weight:600;color:var(--mut);margin-inline-start:6px}
.hr-mut{color:var(--mut);font-size:12.5px}
.hr-num{font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:isolate}
.hr-kv{display:grid;grid-template-columns:1fr;gap:0}
.hr-kv>div{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:8px 0;border-top:1px solid var(--line);min-width:0}
.hr-kv>div:first-child{border-top:none}
.hr-kv span{color:var(--mut);font-size:12.5px;font-weight:700;flex:none}
.hr-kv b{font-size:14px;text-align:end;min-width:0;overflow-wrap:anywhere}
@media(min-width:640px){.hr-kv{grid-template-columns:1fr 1fr;column-gap:24px}.hr-kv>div:nth-child(2){border-top:none}}
.hr-warn{background:var(--warn-bg);border:1px solid color-mix(in srgb,var(--warn) 40%,transparent)}
.hr-warn h2{color:var(--warn-ink)}
.hr-okc{background:var(--ok-bg);color:var(--ok-ink);font-weight:800}
.hr-ol{margin:0;padding-inline-start:22px;display:flex;flex-direction:column;gap:6px;font-size:14px;line-height:1.6;color:var(--ink)}
.hr-ol li{overflow-wrap:anywhere}
.hr-line{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-top:1px solid var(--line);font-size:14px;min-width:0}
.hr-line:first-of-type{border-top:none}
.hr-line .t{flex:1;min-width:0;overflow-wrap:anywhere}
.hr-line .t small{display:block;color:var(--mut);font-size:12px}
.hr-ic{width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;flex:none}
.hr-ic.ok{background:var(--ok-bg);color:var(--ok-ink)}.hr-ic.bad{background:var(--bad-bg);color:var(--bad-ink)}.hr-ic.warn{background:var(--warn-bg);color:var(--warn-ink)}.hr-ic.na{background:var(--soft);color:var(--mut)}
.hr-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media(min-width:640px){.hr-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
.hr-ph{display:flex;flex-direction:column;gap:4px;min-width:0}
.hr-ph button{width:100%;aspect-ratio:4/3;border-radius:12px;overflow:hidden;border:1px solid var(--line);padding:0;background:var(--soft);cursor:zoom-in}
.hr-ph img{width:100%;height:100%;object-fit:cover;display:block}
.hr-ph span{font-size:11.5px;font-weight:700;color:var(--mut);text-align:center;overflow-wrap:anywhere}
.hr-sub{font-size:12.5px;font-weight:800;color:var(--ink-2);margin-top:4px}
.hr-dmg{border:1px solid var(--line);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:8px;margin-top:8px;min-width:0}
.hr-dmg-h{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-weight:900;font-size:14px}
.hr-tag{display:inline-flex;padding:2px 9px;border-radius:20px;font-size:12px;font-weight:800;background:var(--soft);color:var(--ink-2)}
.hr-tag.t{background:var(--bad-bg);color:var(--bad-ink)}
.hr-dmg .hr-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.hr-dmg p{margin:0;font-size:14px;line-height:1.6;overflow-wrap:anywhere}
.hr-acts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.hr-acts .g-btn{min-height:48px}
.hr-msg{margin:0;max-height:300px;overflow:auto;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;font-family:inherit;font-size:13px;line-height:1.7;padding:12px;border-radius:12px;background:var(--soft);border:1px solid var(--line);unicode-bidi:plaintext;text-align:start}
.hr-pick{display:flex;align-items:flex-start;gap:10px;padding:7px 0;border-top:1px solid var(--line);font-size:13.5px;cursor:pointer}
.hr-pick:first-of-type{border-top:none}
.hr-pick input{width:20px;height:20px;flex:none;margin-top:2px;accent-color:var(--p)}
.hr-pick span{flex:1;min-width:0;overflow-wrap:anywhere}
.hr-st{display:inline-flex;align-items:center;gap:4px;font-weight:800}.hr-st.ok{color:var(--ok-ink)}.hr-st.warn{color:var(--warn-ink)}.hr-st.bad{color:var(--bad-ink)}
.hr-fix{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:12px;background:var(--bad-bg);border:1px solid color-mix(in srgb,var(--bad) 35%,transparent)}
.hr-fix textarea{width:100%;min-height:72px;border-radius:10px;border:1px solid var(--line-2);padding:10px;font:inherit;font-size:14px;background:var(--glass-3);color:var(--ink);resize:vertical}
.hr-wa{background:linear-gradient(135deg,#128C7E,#075E54)!important;color:#fff!important;border-color:transparent!important}
.hr-zoom{position:fixed;inset:0;z-index:1300;background:rgba(5,8,20,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px}
.hr-zoom img{max-width:100%;max-height:calc(100dvh - 120px);border-radius:12px;object-fit:contain}
.hr-zoom .cap{color:#fff;font-size:13px;font-weight:700;margin-top:8px;text-align:center}
.hr-zoom .nav{display:flex;gap:10px;margin-top:10px}
.hr-zoom button{min-width:52px;min-height:46px;border-radius:12px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.12);color:#fff;font:inherit;font-size:16px;font-weight:800;cursor:pointer}
`;
const fmtFull = t => { const s = riyadhStamp(t); return `${s.date} — ${s.ar}`; };
const VEH_COLS = "plate,plate_en,make,model_year,color,vin,serial_no";

export default function HandoverReport({ row: row0, vehicle: veh0, mode = "biker", saved = false, onClose, onReviewed }) {
  const admin = mode === "admin";
  const [row, setRow] = useState(row0);
  const [veh, setVeh] = useState(veh0 && veh0.vin !== undefined ? veh0 : null);
  const [zoom, setZoom] = useState(null), nPh = useRef(0); // index في قائمة الصور
  const [wa, setWa] = useState(false), [ex, setEx] = useState([]), [note, setNote] = useState(""), [busy, setBusy] = useState("");
  const [fix, setFix] = useState(null), [fixErr, setFixErr] = useState(""); // نص سبب «يحتاج تصحيح» أثناء الكتابة
  // بيانات الدراجة: المالك/المشرف بصلاحية الأسطول، والبايكر لدراجته فقط (fleet_biker_self_sel)
  useEffect(() => { if (veh || !row.vehicle_id) return; let on = true;
    supabase.from("fleet_vehicles").select(VEH_COLS).eq("id", row.vehicle_id).maybeSingle().then(({ data }) => { if (on) setVeh(data || veh0 || {}); }, () => { if (on) setVeh(veh0 || {}); });
    return () => { on = false; }; }, [row.vehicle_id]);
  useEffect(() => { const k = e => { if (e.key === "Escape") { if (zoom != null) setZoom(null); else onClose && onClose(); }
    else if (zoom != null && (e.key === "ArrowLeft" || e.key === "ArrowRight")) setZoom(z => { const n = z + (e.key === "ArrowLeft" ? 1 : -1); return n < 0 || n >= nPh.current ? z : n; }); }; /* RTL: اليسار = التالية */ window.addEventListener("keydown", k); const o = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { window.removeEventListener("keydown", k); document.body.style.overflow = o; }; }, [zoom]);

  const v = veh || veh0 || {}, ck = row.checklist || {}, rec = ck.received || null, p = row.photos || {}, notes = ck.notes || {};
  const ret = row.direction === "return", issues = useMemo(() => handoverIssues(row), [row]);
  const bikerNote = String(row.condition_notes || "").trim();
  const dItems = Array.isArray(p.damage_items) ? p.damage_items.filter(Boolean) : [];
  const items = checklistOf(ck).slice().sort((a, b) => (ck[a.id] === false ? 0 : 1) - (ck[b.id] === false ? 0 : 1));
  const photos = [
    ...[["front", "الدراجة — أمام"], ["back", "الدراجة — خلف"], ["right", "الدراجة — يمين"], ["left", "الدراجة — يسار"]].map(([k, l]) => ({ url: p[k] || row["photo_" + k], label: l, g: "bike" })),
    { url: p.odometer || row.photo_odometer, label: "العدّاد", g: "bike" },
    ...BOX_PHOTOS.map(b => ({ url: p[b.id], label: b.ar, g: "box" })),
    // بطاقات الأضرار (photos.damage_items) أو الصور القديمة بلا تفاصيل
    ...(dItems.length ? dItems.flatMap((d, n) => [{ url: d.close, label: `ضرر ${n + 1} — قريبة`, g: "dmg", d: n }, { url: d.wide, label: `ضرر ${n + 1} — بعيدة`, g: "dmg", d: n }])
      : (p.damages || row.damage_photos || []).filter(Boolean).map((u, i) => ({ url: u, label: "ضرر " + (i + 1), g: "dmg" }))),
  ].filter(x => x.url);
  nPh.current = photos.length;
  const msgKeys = [...issues.map(i => i.key), ...(bikerNote ? ["biker_note"] : [])];
  const msg = handoverSweaterMessage(row, v, { exclude: ex });

  const denied = error => /row-level|42501|PGRST116/.test(String(error.message || error.code)) ? "لا تملك صلاحية المراجعة (تحتاج صلاحية تعديل «الأسطول»)." : "تعذّر الحفظ: " + error.message;
  const review = async () => {
    setBusy("review"); setNote("");
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("bike_handovers").update(approvePatch(u && u.user ? u.user.id : null)).eq("id", row.id).select("*").single();
    setBusy("");
    if (error) return setNote(denied(error));
    setRow(data); onReviewed && onReviewed(data);
  };
  // «يحتاج تصحيح»: سبب إلزامي ← status='needs_fix' + checklist.fix؛ إشعار البايكر يرسله مشغّل SQL (docs/sql/handover_needs_fix.sql)
  const sendFix = async () => {
    const e = validateFixReason(fix); if (e) return setFixErr(e);
    setBusy("fix"); setFixErr(""); setNote("");
    const { data: u } = await supabase.auth.getUser();
    const uid = u && u.user ? u.user.id : null, name = u && u.user && u.user.user_metadata ? u.user.user_metadata.display_name || null : null;
    const { data, error } = await supabase.from("bike_handovers").update(fixPatch(row, fix, uid, name)).eq("id", row.id).select("*").single();
    setBusy("");
    if (error) return setFixErr(denied(error));
    setRow(data); setFix(null); setNote("أُرجع التسجيل للبايكر ✓"); onReviewed && onReviewed(data);
  };
  const st = handoverState(row), fx = fixInfo(row), prevId = redoOf(row);
  const copy = async () => { const ok = await copyText(msg); setNote(ok ? "تم نسخ الرسالة ✓" : "تعذّر النسخ — حدّد النص وانسخه يدوياً"); };
  const openWa = () => window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank", "noopener");
  const pdf = async () => {
    setBusy("pdf"); setNote("");
    try {
      const [{ renderHTML, canvasToPdfA4 }, { FONT_STACK }] = await Promise.all([import("./exportKit"), import("./fonts")]);
      const canvas = await renderHTML(reportHTML({ row, v, issues, bikerNote, items, rec, photos, ret, dItems, FONT_STACK }), { width: 794 });
      await canvasToPdfA4(canvas, `handover-${(row.plate || "").replace(/\s+/g, "")}-${riyadhStamp(row.created_at).date.replace(/\//g, "-")}.pdf`);
    } catch (e) { const h = humanError(e); setNote("تعذّر إنشاء PDF — " + h.ar + " (" + h.code + ")"); }
    setBusy("");
  };

  const Line = ({ ok, warn, t, sub, k }) => <div className="hr-line" key={k}><span className={"hr-ic " + (ok == null ? "na" : warn ? "warn" : ok ? "ok" : "bad")}>{ok == null ? "—" : warn ? "!" : ok ? "✓" : "✗"}</span><span className="t">{t}{sub && <small>{sub}</small>}</span></div>;

  // بوابة على body: أي أب بـbackdrop-filter يحبس position:fixed تحت شريط التنقّل
  return createPortal(<div className="hr-ov" role="dialog" aria-modal="true" aria-label="تقرير الدراجة"><style>{CSS}</style>
    <div className="hr-bar"><h1>تقرير {ret ? "تسليم" : "استلام"} دراجة<span className="bn" lang="bn">{ret ? "বাইক হস্তান্তর রিপোর্ট" : "বাইক গ্রহণ রিপোর্ট"}</span></h1>
      <button type="button" className="hr-x" onClick={onClose} aria-label="إغلاق">✕ إغلاق</button></div>
    <div className="hr-body">
      {saved && <div className="g-card hr-card hr-okc" role="status">تم حفظ {ret ? "التسليم" : "الاستلام"} ✓ · <span lang="bn">সংরক্ষিত</span></div>}

      <section className="g-card hr-card">
        <div className="hr-kv">
          <div><span>التاريخ والوقت</span><b className="hr-num">{fmtFull(row.created_at)}</b></div>
          <div><span>المراجعة</span><b><span className={"hr-st " + STATES[st].tone}>{st === "reviewed" ? "✓ " : st === "needs_fix" ? "↩ " : ""}{STATES[st].ar}{st === "reviewed" && row.reviewed_at ? <> <span className="hr-num">{riyadhStamp(row.reviewed_at).date}</span></> : null}</span></b></div>
          <div><span>{ret ? "المسلِّم" : "المستلم"}</span><b>{row.biker_name || "—"} <span className="hr-num hr-mut">{row.biker_employee_id}</span></b></div>
          <div><span>اللوحة</span><b>{row.plate || v.plate || "—"}{v.plate_en ? <> <span className="hr-mut">·</span> <span className="hr-num hr-mut">{v.plate_en}</span></> : null}</b></div>
          <div><span>الصنع والموديل</span><b>{[v.make, v.model_year].filter(Boolean).join(" · ") || "—"}</b></div>
          <div><span>اللون</span><b>{v.color || "—"}</b></div>
          <div><span>رقم الهيكل (VIN)</span><b className="hr-num">{v.vin || "—"}</b></div>
          <div><span>الرقم التسلسلي</span><b className="hr-num">{v.serial_no || "—"}</b></div>
          <div><span>قراءة العدّاد</span><b className="hr-num">{row.odometer != null ? row.odometer + " km" : "—"}</b></div>
        </div>
      </section>

      {st === "needs_fix" && fx && <section className="g-card hr-card hr-fix" role="status"><b style={{ color: "var(--bad-ink)" }}>↩ أُرجع للبايكر — يحتاج تصحيح</b>
        <div style={{ fontSize: 14, overflowWrap: "anywhere" }}>{fx.reason}</div>
        <span className="hr-mut">{fx.by_name ? fx.by_name + " · " : ""}<span className="hr-num">{fx.at ? fmtFull(fx.at) : ""}</span></span></section>}
      {prevId && <section className="g-card hr-card hr-mut" style={{ fontSize: 13 }}>↻ إعادة تسجيل لسجل سابق أُرجع للتصحيح{ck.redo_reason ? <> — السبب كان: {ck.redo_reason}</> : null}</section>}

      {issues.length || bikerNote ? <section className="g-card hr-card hr-warn"><h2>⚠ ملاحظات ({issues.length})<span className="bn" lang="bn">সমস্যা</span></h2>
        {issues.length > 0 && <ol className="hr-ol">{issues.map(i => <li key={i.key}>{i.ar}</li>)}</ol>}
        {bikerNote && <div className="hr-mut" style={{ color: "var(--ink-2)" }}><b>ملاحظة البايكر:</b> {bikerNote}</div>}</section>
        : <section className="g-card hr-card hr-okc">لا ملاحظات ✓ · <span lang="bn">কোনো সমস্যা নেই</span></section>}

      <section className="g-card hr-card"><h2>قائمة التحقق<span className="bn" lang="bn">চেকলিস্ট</span></h2>
        <div>{items.map(c => Line({ k: c.id, ok: ck[c.id] == null ? null : ck[c.id] !== false, t: c.ar, sub: ck[c.id] === false ? (notes[c.id] || "غير سليم") : null }))}</div></section>

      <section className="g-card hr-card"><h2>المستلَمات<span className="bn" lang="bn">যা পেয়েছি</span></h2>
        {rec ? <div>{RECEIVED_ITEMS.map(it => { const ok = rec[it.id] === true, boxNote = it.id === "box" && rec.box_note;
          return Line({ k: it.id, ok, warn: !!boxNote, t: it.ar + (it.count && ok ? ` (${rec[it.count]})` : ""), sub: boxNote ? "مستلَم مع ملاحظة — " + rec.box_note : !ok ? "لم يُستلم" + ((rec.reasons || {})[it.id] ? " — " + rec.reasons[it.id] : "") : null }); })}</div>
          : <span className="hr-mut">— (سجل قبل إضافة المستلَمات)</span>}</section>

      <section className="g-card hr-card"><h2>الصور<span className="bn" lang="bn">ছবি</span> <span className="hr-mut hr-num">({photos.length})</span></h2>
        {[["bike", "الدراجة والعدّاد"], ["box", "الصندوق"], ...(dItems.length ? [] : [["dmg", "الأضرار"]])].map(([g, t]) => { const list = photos.map((x, i) => ({ ...x, i })).filter(x => x.g === g); return list.length ? <div key={g}><div className="hr-sub">{t}</div>
          <div className="hr-grid">{list.map(x => <div className="hr-ph" key={x.i}><button type="button" onClick={() => setZoom(x.i)} aria-label={"تكبير " + x.label}><img src={x.url} alt={x.label} loading="lazy" /></button><span>{x.label}</span></div>)}</div></div> : null; })}
        {!photos.length && <span className="hr-mut">لا صور في هذا السجل.</span>}</section>

      {dItems.length > 0 && <section className="g-card hr-card"><h2>الأضرار ({dItems.length})<span className="bn" lang="bn">ক্ষতি</span></h2>
        {dItems.map((d, n) => { const pr = damagePart(d.part), ty = damageType(d.type), ph = photos.map((x, i) => ({ ...x, i })).filter(x => x.g === "dmg" && x.d === n);
          return <div className="hr-dmg" key={n}>
            <div className="hr-dmg-h">ضرر {n + 1} <span className="hr-tag">📍 {pr.ar}</span><span className="hr-tag t">{ty.ar}</span></div>
            <div className="hr-grid">{ph.map(x => <div className="hr-ph" key={x.i}><button type="button" onClick={() => setZoom(x.i)} aria-label={"تكبير " + x.label}><img src={x.url} alt={x.label} loading="lazy" /></button><span>{x.label.split("— ")[1]}</span></div>)}</div>
            <p>{d.note || <span className="hr-mut">بلا وصف</span>}</p>
          </div>; })}</section>}

      <section className="g-card hr-card"><h2>ملاحظات البايكر والتعهّد<span className="bn" lang="bn">নোট ও অঙ্গীকার</span></h2>
        <div style={{ fontSize: 14 }}>{bikerNote || <span className="hr-mut">لا ملاحظات.</span>}</div>
        <div className="hr-mut">{row.pledge_accepted ? "✓ وافق البايكر على التعهّد بالمحافظة على الدراجة والالتزام بتعليمات المرور." : "— لم يُسجَّل التعهّد."}</div></section>

      {admin && <section className="g-card hr-card"><h2>الإجراءات</h2>
        <div className="hr-acts">
          {st !== "reviewed" && <button className="g-btn primary" disabled={busy === "review"} onClick={review}>{busy === "review" ? "…" : "✓ تمت المراجعة"}</button>}
          {st !== "needs_fix" && <button className="g-btn" aria-expanded={fix != null} style={{ color: "var(--bad-ink)" }} onClick={() => { setFix(f => f == null ? "" : null); setFixErr(""); }}>↩ يحتاج تصحيح</button>}
          <button className="g-btn" aria-expanded={wa} onClick={() => setWa(x => !x)}>💬 رسالة لسويتر</button>
          <button className="g-btn" disabled={busy === "pdf"} onClick={pdf}>{busy === "pdf" ? "جارٍ الإنشاء…" : "🖨 طباعة / PDF"}</button>
        </div>
        {fix != null && <div className="hr-fix">
          <label htmlFor="hr-fix-r" style={{ fontWeight: 800, fontSize: 13 }}>سبب الإرجاع للبايكر (إلزامي) — يصله إشعار به</label>
          <textarea id="hr-fix-r" value={fix} maxLength={500} autoFocus onChange={e => { setFix(e.target.value); setFixErr(""); }} placeholder="مثال: صورة الضرر 3 غير واضحة، أعد تصويرها من قريب" />
          {fixErr && <div role="alert" style={{ color: "var(--bad-ink)", fontSize: 12.5, fontWeight: 700 }}>{fixErr}</div>}
          <div className="hr-acts"><button className="g-btn" onClick={() => { setFix(null); setFixErr(""); }}>إلغاء</button><button className="g-btn primary" disabled={busy === "fix"} onClick={sendFix}>{busy === "fix" ? "…" : "إرجاع للبايكر"}</button></div>
        </div>}
        {note && <div className="hr-mut" role="status" style={{ color: "var(--ink-2)", fontWeight: 700 }}>{note}</div>}
        {wa && <>
          {msgKeys.length > 0 && <div><div className="hr-sub">ما يُرسَل لسويتر (أزل ما لا يخصّهم):</div>
            {issues.map(i => <label className="hr-pick" key={i.key}><input type="checkbox" checked={!ex.includes(i.key)} onChange={e => setEx(x => e.target.checked ? x.filter(k => k !== i.key) : [...x, i.key])} /><span>{i.ar}</span></label>)}
            {bikerNote && <label className="hr-pick"><input type="checkbox" checked={!ex.includes("biker_note")} onChange={e => setEx(x => e.target.checked ? x.filter(k => k !== "biker_note") : [...x, "biker_note"])} /><span>ملاحظة البايكر: {bikerNote}</span></label>}</div>}
          <pre className="hr-msg" dir="auto">{msg}</pre>
          <div className="hr-acts"><button className="g-btn" onClick={copy}>نسخ</button><button className="g-btn hr-wa" onClick={openWa}>إرسال واتساب</button></div>
          <span className="hr-mut">📷 أرفق الصور يدوياً في واتساب بعد إرسال الرسالة.</span>
        </>}
      </section>}
    </div>
    {zoom != null && photos[zoom] && <div className="hr-zoom" role="dialog" aria-label="صورة مكبّرة" onClick={e => { if (e.target === e.currentTarget) setZoom(null); }}>
      <img src={photos[zoom].url} alt={photos[zoom].label} />
      <div className="cap">{photos[zoom].label} · <span className="hr-num">{zoom + 1}/{photos.length}</span></div>
      <div className="nav"><button type="button" aria-label="السابقة" disabled={zoom === 0} onClick={() => setZoom(zoom - 1)}>›</button>
        <button type="button" onClick={() => setZoom(null)}>إغلاق</button>
        <button type="button" aria-label="التالية" disabled={zoom === photos.length - 1} onClick={() => setZoom(zoom + 1)}>‹</button></div>
    </div>}
  </div>, document.body);
}

// قالب A4 عمودي (794px) للطباعة/PDF بالشعار
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function reportHTML({ row, v, issues, bikerNote, items, rec, photos, ret, dItems = [], FONT_STACK }) {
  const ck = row.checklist || {}, notes = ck.notes || {}, site = (typeof location !== "undefined" && location.origin) || "";
  const kv = [["التاريخ والوقت", fmtFull(row.created_at)], [ret ? "المسلِّم" : "المستلم", `${row.biker_name || "—"} — ${row.biker_employee_id || "—"}`], ["اللوحة", `${row.plate || v.plate || "—"}${v.plate_en ? " · " + v.plate_en : ""}`],
    ["الصنع والموديل", [v.make, v.model_year].filter(Boolean).join(" · ") || "—"], ["اللون", v.color || "—"], ["رقم الهيكل (VIN)", v.vin || "—"], ["الرقم التسلسلي", v.serial_no || "—"], ["العدّاد", row.odometer != null ? row.odometer + " km" : "—"],
    ["المراجعة", handoverState(row) === "needs_fix" ? "يحتاج تصحيح — " + ((fixInfo(row) || {}).reason || "") : row.reviewed_at ? "روجع " + riyadhStamp(row.reviewed_at).date : "بانتظار المراجعة"]];
  return `<div class="hp" dir="rtl"><style>
.hp{width:794px;background:#fff;color:#0F172A;font-family:${FONT_STACK};padding:0 0 24px}
.hp *{box-sizing:border-box}
.hd{background:linear-gradient(135deg,#F59E0B,#E8712B);color:#fff;padding:22px 32px;display:flex;align-items:center;gap:16px}
.hd img{height:44px;background:#fff;border-radius:10px;padding:5px 9px}
.hd h1{margin:0;font-size:22px}.hd .m{font-size:12.5px;margin-top:3px}
.bd{padding:16px 32px}
h3{font-size:14px;color:#CC5200;margin:14px 0 6px}
table{width:100%;border-collapse:collapse;font-size:12.5px}td{padding:5px 6px;border-bottom:1px solid #F1F5F9;vertical-align:top}td.k{color:#64748B;width:34%}
.warn{background:#FFF3E2;border:1px solid #F5C77E;border-radius:10px;padding:8px 12px;font-size:12.5px}
.warn ol{margin:4px 0;padding-inline-start:20px}
.ok{background:#E7F7EF;color:#087443;border-radius:10px;padding:8px 12px;font-size:12.5px;font-weight:700}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;font-size:12px}
.b{font-weight:700}.g{color:#087443}.r{color:#B42318}.y{color:#B54708}
.ph{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.ph div{font-size:10.5px;color:#64748B;text-align:center}
.ph img{width:100%;height:120px;object-fit:cover;border-radius:8px;border:1px solid #E5E7EB;display:block;margin-bottom:3px}
.ft{font-size:10.5px;color:#94A3B8;text-align:center;margin-top:14px}
.dm{border:1px solid #F5C77E;background:#FFF8EC;border-radius:8px;padding:6px 10px;font-size:12px;margin-bottom:6px}
</style>
<div class="hd"><img src="${site}/brand-logo.png" alt=""/><div><h1>تقرير ${ret ? "تسليم" : "استلام"} دراجة</h1><div class="m">دلو ورغوة — شريك 47 · ${esc(row.plate || "")} · ${esc(fmtFull(row.created_at))}</div></div></div>
<div class="bd">
<table>${kv.map(([k, x]) => `<tr><td class="k">${esc(k)}</td><td class="b">${esc(x)}</td></tr>`).join("")}</table>
<h3>ملخص الملاحظات</h3>
${issues.length || bikerNote ? `<div class="warn">${issues.length ? `<ol>${issues.map(i => `<li>${esc(i.ar)}</li>`).join("")}</ol>` : ""}${bikerNote ? `<div><b>ملاحظة البايكر:</b> ${esc(bikerNote)}</div>` : ""}</div>` : `<div class="ok">لا ملاحظات ✓</div>`}
<h3>قائمة التحقق</h3>
<div class="cols">${items.map(c => `<div class="${ck[c.id] === false ? "r b" : ck[c.id] == null ? "" : "g"}">${ck[c.id] === false ? "✗" : ck[c.id] == null ? "—" : "✓"} ${esc(c.ar)}${ck[c.id] === false && notes[c.id] ? " — " + esc(notes[c.id]) : ""}</div>`).join("")}</div>
<h3>المستلَمات</h3>
<div class="cols">${rec ? RECEIVED_ITEMS.map(it => { const ok = rec[it.id] === true, bn = it.id === "box" && rec.box_note;
    return `<div class="${bn ? "y b" : ok ? "g" : "r b"}">${bn ? "!" : ok ? "✓" : "✗"} ${esc(it.ar)}${it.count && ok ? ` (${rec[it.count]})` : ""}${bn ? " — " + esc(rec.box_note) : !ok && (rec.reasons || {})[it.id] ? " — " + esc(rec.reasons[it.id]) : ""}</div>`; }).join("") : "<div>— (سجل قبل إضافة المستلَمات)</div>"}</div>
${dItems.length ? `<h3>الأضرار (${dItems.length})</h3>${dItems.map((d, n) => `<div class="dm"><div class="b">ضرر ${n + 1} — المكان: ${esc(damagePart(d.part).ar)} · النوع: ${esc(damageType(d.type).ar)}</div><div>${esc(d.note || "")}</div></div>`).join("")}` : ""}
${photos.length ? `<h3>الصور</h3><div class="ph">${photos.map(x => `<div><img src="${esc(x.url)}" crossorigin="anonymous" alt=""/>${esc(x.label)}</div>`).join("")}</div>` : ""}
<h3>التعهّد</h3><div style="font-size:12px">${row.pledge_accepted ? "✓ وافق البايكر على التعهّد بالمحافظة على الدراجة والالتزام بتعليمات المرور." : "— لم يُسجَّل التعهّد."}</div>
<div class="ft">أُنشئ من المنصة التشغيلية — دلو ورغوة · ${esc(fmtFull(new Date().toISOString()))}</div>
</div></div>`;
}
