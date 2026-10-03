// الاستلام اليومي من مندوب سويتر — تبويب «الاستلام» في بوابة البايكر.
// أي بايكر حاضر يسجّل الشحنة (وقت، مندوب، كميات، مناشف مُرجَعة، صور، ملاحظة) ثم يوزّعها، وكل بايكر يؤكد نصيبه.
import { useEffect, useMemo, useState } from "react";
import { splitAll, splitList, splitErrors, normPhone, validateReceive, balances, isLate, riyadhHM, riyadhDay, toLocalInput, MAX_BACK_H } from "./engine";
import { loadBiker, createDelivery, saveDistribution, confirmShares, photoUrl } from "./store";

export const DR_CSS = `
.dr{display:flex;flex-direction:column;gap:12px;max-width:560px;margin:0 auto;min-width:0;font-size:15px;line-height:1.6}
.dr *{box-sizing:border-box}
.dr-card{padding:16px;border-radius:18px;display:flex;flex-direction:column;gap:10px;min-width:0}
.dr h2{font-size:17px;font-weight:900;margin:0;color:var(--ink)}
.dr h2 .bn,.dr-l .bn{font-size:.8em;font-weight:600;color:var(--mut)}
.dr-mut{color:var(--mut);font-size:13px}
.dr-num{font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:isolate}
.dr-row{display:flex;align-items:center;gap:10px;min-width:0}.dr-grow{flex:1;min-width:0}
.dr .g-btn{min-height:50px;font-size:15px;border-radius:13px;flex-wrap:wrap;line-height:1.35}
.dr-big{min-height:72px!important;font-size:18px!important;font-weight:900!important}
.dr-big .bn{flex-basis:100%;font-size:14px;font-weight:600}
.dr-btns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.dr-note{padding:11px 13px;border-radius:12px;background:var(--soft);border:1px solid var(--line);font-size:14px;color:var(--ink-2)}
.dr-note.ok{background:var(--ok-bg);color:var(--ok-ink);border-color:transparent}
.dr-note.bad{background:var(--bad-bg);color:var(--bad-ink);border-color:transparent}
.dr-note.warn{background:var(--warn-bg);color:var(--warn-ink);border-color:transparent}
.dr-mine{border:2px solid var(--p)!important;background:var(--p-50)}
.dr-it{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--line)}
.dr-it:first-of-type{border-top:none}
.dr-ic{width:44px;height:44px;border-radius:12px;background:var(--p-100);color:var(--p-ink);display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none}
.dr-ic img{width:100%;height:100%;object-fit:cover}
.dr-l{font-weight:800;color:var(--ink);font-size:14.5px;line-height:1.4}.dr-l .bn{display:block}
.dr-step{display:flex;align-items:center;gap:6px}
.dr-step button{width:46px;height:46px;border-radius:12px;border:1px solid var(--line-2);background:var(--glass-2);color:var(--ink);font:inherit;font-size:22px;font-weight:900;cursor:pointer;line-height:1}
.dr-step button:disabled{opacity:.4;cursor:default}
.dr-step input{width:56px;height:46px;text-align:center;font-size:18px;font-weight:900;border-radius:12px;border:1px solid var(--line-2);background:var(--glass-3);color:var(--ink);font-family:inherit}
.dr-step button:focus-visible,.dr-step input:focus-visible{outline:none;box-shadow:var(--glow)}
.dr-dots{display:flex;gap:5px;justify-content:center}.dr-dots i{width:8px;height:8px;border-radius:50%;background:var(--line-2)}
.dr-dots i.done{background:var(--ok)}.dr-dots i.now{background:var(--p);width:20px;border-radius:6px}
.dr-q{font-size:19px;font-weight:900;color:var(--ink);line-height:1.45}.dr-q .bn{display:block;font-size:14px;font-weight:600;color:var(--mut)}
.dr-in{width:100%;min-height:52px;font-size:17px!important}
.dr-photos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.dr-ph{position:relative;border-radius:12px;overflow:hidden;aspect-ratio:4/3;background:var(--soft);border:1px solid var(--line)}
.dr-ph img{width:100%;height:100%;object-fit:cover;display:block}
.dr-ph button{position:absolute;top:6px;inset-inline-start:6px;width:36px;height:36px;border-radius:50%;border:none;background:rgba(10,14,39,.72);color:#fff;font-size:18px;cursor:pointer}
.dr-cap{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;aspect-ratio:4/3;border-radius:12px;border:2px dashed rgba(var(--p-rgb),.55);background:var(--p-50);color:var(--p-ink);font-weight:900;cursor:pointer;text-align:center;padding:8px}
.dr-cap input{position:absolute;width:1px;height:1px;opacity:0}
.dr-cap:focus-within{box-shadow:var(--glow)}
.dr-sum{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid var(--line);font-size:14px}.dr-sum:first-child{border-top:none}
.dr-hist>div{padding:9px 0;border-top:1px solid var(--line)}.dr-hist>div:first-child{border-top:none}
.dr-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:20px;font-size:12px;font-weight:800;background:var(--soft);color:var(--mut)}
.dr-pill.ok{background:var(--ok-bg);color:var(--ok-ink)}.dr-pill.bad{background:var(--bad-bg);color:var(--bad-ink)}.dr-pill.warn{background:var(--warn-bg);color:var(--warn-ink)}
.dr-dist{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--line)}
`;

// أيقونات مضمّنة (من Icon.jsx) حتى لا يصير Icon حزمة مشتركة تكبّر خريطة التحميل في الحزمة الرئيسية
const P = { check: "M20 6 9 17l-5-5", inbox: "M22 12h-6l-2 3h-4l-2-3H2 M5.5 5h13a1 1 0 0 1 .9.6L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l2.6-6.4A1 1 0 0 1 5.5 5z",
  ruler: "M5 3h4l12 12-6 6L3 9V5a2 2 0 0 1 2-2z M9 7l2 2 M13 11l2 2", star: "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z",
  camera: "M4 8a2 2 0 0 1 2-2h1.5l1.2-1.8A1 1 0 0 1 9.5 4h5a1 1 0 0 1 .8.2L16.5 6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  doc: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6 M9 17h6", bucket: "M4 8h16l-1.5 11a2 2 0 0 1-2 1.8H7.5a2 2 0 0 1-2-1.8z M3 8a9 4 0 0 1 18 0 M8 8a7 3 0 0 1 8 0",
  shirt: "M8 3l4 3 4-3 4 4-3 3v10H7V10L4 7z" };
const Icon = ({ n, s = 20 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }} aria-hidden="true">{(P[n] || "").split(" M").map((seg, i) => <path key={i} d={(i ? "M" : "") + seg} />)}</svg>;
const ICON = { freshener: "star", mat: "ruler", tissue: "doc", seat_cover: "shirt", wet_wipes: "bucket", towel_clean: "check" };
const Bn = ({ children }) => <span className="bn" lang="bn">{children}</span>;
export const fmtWhen = t => { try { return riyadhDay(t).slice(5).split("-").reverse().join("/") + " · " + riyadhHM(t); } catch { return "—"; } };

export function ItemIcon({ item, img }) {
  if (item.kind === "towel" && img) return <span className="dr-ic"><img src={img} alt="" /></span>;
  return <span className="dr-ic"><Icon n={ICON[item.key] || "bucket"} s={22} /></span>;
}
export function Stepper({ value, onChange, max, label }) {
  const v = value || 0;
  return <div className="dr-step">
    <button type="button" aria-label={"إنقاص " + (label || "")} disabled={v <= 0} onClick={() => onChange(Math.max(0, v - 1))}>−</button>
    <input inputMode="numeric" aria-label={label} value={v} onChange={e => { const n = parseInt(String(e.target.value).replace(/\D/g, "") || "0", 10); onChange(max != null ? Math.min(max, n) : Math.min(9999, n)); }} />
    <button type="button" aria-label={"زيادة " + (label || "")} disabled={max != null && v >= max} onClick={() => onChange(v + 1)}>+</button>
  </div>;
}

export default function DailyReceive({ me }) {
  const empId = me && me.emp_id;
  const [d, setD] = useState(null);
  const [view, setView] = useState(null); // null | {k:"form"} | {k:"dist", delivery}
  const [towelImg, setTowelImg] = useState(null);
  const [msg, setMsg] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => { let on = true; import("../academy/images").then(m => { if (on) setTowelImg((m.default || {}).towelblue || null); }).catch(() => {}); return () => { on = false; }; }, []);
  useEffect(() => { if (!empId) return; let on = true; loadBiker(empId, me && me.uid).then(r => { if (on) setD(r); }).catch(e => { if (on) setD({ items: [], couriers: [], team: [], deliveries: [], shares: [], adjustments: [], ready: false, error: e }); }); return () => { on = false; }; }, [empId, reload]);

  if (!empId) return <div className="dr"><style>{DR_CSS}</style><div className="dr-card g-card"><div className="dr-note bad">حسابك غير مرتبط بسجل موظف. راجع الإدارة. · <Bn>আপনার অ্যাকাউন্ট কর্মী রেকর্ডের সাথে যুক্ত নয়</Bn></div></div></div>;
  if (!d) return <div className="dr"><style>{DR_CSS}</style><div className="dr-card g-card"><div className="dr-row dr-mut"><div className="g-spin" />جارٍ التحميل… · <Bn>লোড হচ্ছে…</Bn></div></div></div>;

  const items = d.items.filter(i => i.active);
  const itemOf = k => d.items.find(i => i.key === k) || { key: k, name_ar: k, name_bn: "" };
  const nameOf = id => id === empId ? "أنا" : ((d.team.find(t => t.id === id) || {}).full_name || "متدرب مرافق");
  const courierOf = id => d.couriers.find(c => c.id === id);
  const operatorId = d.operatorId ?? null;
  const done = (m, ok = true) => { setMsg({ ok, t: m }); setView(null); setReload(x => x + 1); try { window.scrollTo(0, 0); } catch { /* */ } };

  const ctx = { d, empId, items, itemOf, nameOf, courierOf, operatorId, towelImg, done, setView, setMsg, setD };
  return <div className="dr"><style>{DR_CSS}</style>
    {!d.ready && <div className="dr-note warn">الاستلام اليومي لم يُفعَّل بعد في القاعدة — لا يمكن الحفظ حتى يعتمده المالك. · <Bn>এখনও চালু হয়নি — মালিকের অনুমোদনের অপেক্ষায়</Bn></div>}
    {d.error && <div className="dr-note bad">تعذّر تحميل بعض البيانات: {String(d.error.message || d.error)}</div>}
    {msg && <div className={"dr-note " + (msg.ok ? "ok" : "bad")} role="status">{msg.t}</div>}
    {!view ? <Home ctx={ctx} /> : view.k === "form" ? <Form ctx={ctx} /> : view.k === "dist" ? <Dist delivery={view.delivery} ctx={ctx} /> : null}
  </div>;

}

/* ── الشاشة الرئيسية ── */
function Home({ ctx }) {
  const { d, empId, items, itemOf, nameOf, courierOf, operatorId, towelImg, done, setView, setMsg, setD } = ctx;
  const mine = d.shares.filter(s => s.employee_id === empId && s.status === "pending");
  const groups = Object.values(mine.reduce((a, s) => { (a[s.delivery_id] = a[s.delivery_id] || { id: s.delivery_id, at: s.received_at, by: s.received_by, rows: [] }).rows.push(s); return a; }, {}));
  const undist = d.deliveries.filter(x => x.received_by === empId && x.status === "received");
  const trainee = d.inSplit === false;
  const bal = balances(d.shares, d.adjustments, d.deliveries.filter(x => x.status === "received").map(x => ({ received_by: x.received_by, lines: x.daily_delivery_lines || [] })))[empId] || {};
  return <>
    {trainee && <div className="dr-note warn" role="status"><b>أنت متدرب مرافق — لا نصيب لك حالياً · <Bn>আপনি প্রশিক্ষণার্থী</Bn></b><div className="dr-mut">يمكنك تسجيل استلام من المندوب إن كنت الحاضر الوحيد، ويُوزَّع على زملائك. · <Bn>একা থাকলে ডেলিভারি গ্রহণ করতে পারো</Bn></div></div>}
    {!trainee && groups.map(g => <Share key={g.id} g={g} ctx={ctx} />)}
    {undist.map(x => <section key={x.id} className="dr-card g-card dr-mine"><h2>وزّع شحنة {fmtWhen(x.received_at)} <Bn>বিতরণ বাকি</Bn></h2>
      <span className="dr-mut">سجّلت الاستلام ولم تعتمد التوزيع بعد.</span>
      <button className="g-btn primary block" onClick={() => setView({ k: "dist", delivery: x })}>أكمل التوزيع · <Bn>বিতরণ করো</Bn></button></section>)}
    <button className="g-btn primary block dr-big" disabled={!d.ready} onClick={() => { setMsg(null); setView({ k: "form" }); }}>
      <Icon n="inbox" s={22} /> استلام من مندوب سويتر <Bn>সুইটার ডেলিভারি গ্রহণ</Bn></button>
    {!trainee && <section className="dr-card g-card"><h2>رصيدي · <Bn>আমার কাছে আছে</Bn></h2>
      {items.map(i => <div key={i.key} className="dr-it"><ItemIcon item={i} img={towelImg} /><div className="dr-l">{i.name_ar}<Bn>{i.name_bn}</Bn></div><b className="dr-num" style={{ fontSize: 20 }}>{bal[i.key] || 0}</b></div>)}
      {!items.length && <span className="dr-mut">لا أصناف.</span>}</section>}
    <section className="dr-card g-card"><h2>آخر الاستلامات · <Bn>সাম্প্রতিক ডেলিভারি</Bn></h2>
      {d.deliveries.length ? <div className="dr-hist">{d.deliveries.slice(0, 7).map(x => { const c = courierOf(x.courier_id); return <div key={x.id}>
        <div className="dr-row"><b className="dr-num">{fmtWhen(x.received_at)}</b>{isLate(x.received_at) && <span className="dr-pill warn">متأخر</span>}<span className="dr-grow" /><span className={"dr-pill " + (x.status === "distributed" ? "ok" : "warn")}>{x.status === "distributed" ? "وُزّع" : "بانتظار التوزيع"}</span></div>
        <div className="dr-mut">المستلم: {nameOf(x.received_by)} · المندوب: {c ? c.name : "—"}</div></div>; })}</div>
        : <span className="dr-mut">لا استلامات بعد · <Bn>এখনও কোনো ডেলিভারি নেই</Bn></span>}</section>
  </>;
}

/* ── تأكيد النصيب ── */
function Share({ g, ctx }) {
  const { d, empId, items, itemOf, nameOf, courierOf, operatorId, towelImg, done, setView, setMsg, setD } = ctx;
  const [short, setShort] = useState(false), [act, setAct] = useState(() => Object.fromEntries(g.rows.map(s => [s.id, s.qty]))), [note, setNote] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const submit = async isShort => {
    setErr("");
    if (isShort && !g.rows.some(s => act[s.id] < s.qty)) return setErr("عدّل العدد الفعلي للصنف الناقص · কম পাওয়া জিনিসের সংখ্যা দিন");
    setBusy(true); const r = await confirmShares(g.rows, isShort ? act : null, note.trim()); setBusy(false);
    if (r.error) return setErr("تعذّر الحفظ: " + (r.error.message || r.error));
    done(isShort ? "سُجّل البلاغ وأُرسل للمالك · রিপোর্ট পাঠানো হয়েছে" : "تم تأكيد استلام نصيبك ✓ · নিশ্চিত হয়েছে");
  };
  return <section className="dr-card g-card dr-mine" aria-live="polite">
    <h2>نصيبي اليوم · <Bn>আজ আমার ভাগ</Bn></h2>
    <span className="dr-mut">من {nameOf(g.by)} · {fmtWhen(g.at)}</span>
    {g.rows.map(s => { const i = itemOf(s.item_key); return <div key={s.id} className="dr-it"><ItemIcon item={i} img={towelImg} /><div className="dr-l">{i.name_ar}<Bn>{i.name_bn}</Bn></div>
      {short ? <Stepper value={act[s.id]} max={s.qty} label={i.name_ar} onChange={n => setAct(a => ({ ...a, [s.id]: n }))} /> : <b className="dr-num" style={{ fontSize: 20 }}>{s.qty}</b>}</div>; })}
    {short && <><span className="dr-mut">أدخل العدد الذي وصلك فعلاً لكل صنف · <Bn>আসলে কত পেয়েছ লিখো</Bn></span>
      <textarea className="g-textarea" rows={2} placeholder="ملاحظة · নোট" value={note} onChange={e => setNote(e.target.value)} /></>}
    {err && <div className="dr-note bad" role="alert">{err}</div>}
    {short ? <div className="dr-btns"><button className="g-btn block" disabled={busy} onClick={() => setShort(false)}>رجوع · <Bn>ফিরে যাও</Bn></button><button className="g-btn primary block" disabled={busy} onClick={() => submit(true)}>أرسل البلاغ · <Bn>পাঠাও</Bn></button></div>
      : <div className="dr-btns"><button className="g-btn primary block" disabled={busy} onClick={() => submit(false)}>✓ استلمت · <Bn>পেয়েছি</Bn></button><button className="g-btn block" disabled={busy} onClick={() => setShort(true)}>ناقص · <Bn>কম পেয়েছি</Bn></button></div>}
  </section>;
}

/* ── نموذج الاستلام: خطوة في كل شاشة ── */
function Form({ ctx }) {
  const { d, empId, items, itemOf, nameOf, courierOf, operatorId, towelImg, done, setView, setMsg, setD } = ctx;
  const [st, setSt] = useState(0);
  const [f, setF] = useState(() => ({ received_at: toLocalInput(Date.now()), courier_id: d.couriers.length ? "" : null, newCourier: d.couriers.length ? null : { name: "", phone: "" }, qty: {}, towels_returned: 0, photos: [], note: "" }));
  const [prev, setPrev] = useState([]), [busy, setBusy] = useState(""), [err, setErr] = useState("");
  useEffect(() => { const u = f.photos.map(p => URL.createObjectURL(p)); setPrev(u); return () => u.forEach(x => URL.revokeObjectURL(x)); }, [f.photos]);
  const set = p => setF(x => ({ ...x, ...p }));
  const N = 7, now = Date.now();
  const at = new Date(f.received_at).getTime();
  const stepErr = () => {
    if (st === 0) { if (Number.isNaN(at)) return "أدخل الوقت"; if (at > now + 60e3) return "لا يمكن وقت في المستقبل"; if (at < now - MAX_BACK_H * 3600e3) return `لا يمكن الرجوع أكثر من ${MAX_BACK_H} ساعة`; }
    if (st === 1) { if (f.newCourier) { if (!f.newCourier.name.trim()) return "اكتب اسم المندوب"; if (!normPhone(f.newCourier.phone)) return "رقم الجوال غير صحيح (05XXXXXXXX)"; } else if (!f.courier_id) return "اختر المندوب"; }
    if (st === 2 && !Object.values(f.qty).some(q => q > 0)) return "أدخل كمية صنف واحد على الأقل";
    if (st === 4 && !f.photos.length) return "أضف صورة واحدة على الأقل";
    return "";
  };
  const next = () => { const e = stepErr(); setErr(e); if (!e) { setSt(s => s + 1); try { window.scrollTo(0, 0); } catch { /* */ } } };
  const phone = f.newCourier ? normPhone(f.newCourier.phone) : null, dup = phone && d.couriers.find(c => c.phone === phone);
  const save = async () => {
    const form = { ...f, received_at: new Date(f.received_at).toISOString(), courier_id: f.newCourier ? (dup ? dup.id : null) : f.courier_id, newCourier: dup ? null : f.newCourier };
    const errs = validateReceive(form); if (errs.length) return setErr(errs.join(" · "));
    setErr(""); setBusy("…");
    try {
      const r = await createDelivery({ empId, operatorId, couriers: d.couriers }, form, s => setBusy(s.startsWith("photo") ? `رفع الصورة ${s.slice(5)} من ${f.photos.length}` : s === "courier" ? "حفظ المندوب" : "حفظ الاستلام"));
      if (r.missing) { setBusy(""); return setErr("لا يمكن الحفظ: جداول الاستلام اليومي لم تُنشأ بعد."); }
      if (r.error && !r.delivery) { setBusy(""); return setErr("تعذّر الحفظ: " + (r.error.message || r.error)); }
      if (r.error) { setBusy(""); return setErr("حُفظ الاستلام لكن تعذّر حفظ الكميات: " + (r.error.message || r.error)); }
      setBusy(""); setMsg({ ok: true, t: "حُفظ الاستلام ✓ — وزّعه الآن على البايكرز · এখন ভাগ করো" }); setView({ k: "dist", delivery: r.delivery });
      setD(x => ({ ...x, deliveries: [r.delivery, ...x.deliveries] }));
    } catch (e) { setBusy(""); setErr("تعذّر الحفظ: " + (e.message || e)); }
  };
  const addPhotos = fl => { const a = Array.from(fl || []).filter(x => /^image\//.test(x.type) || /\.(jpe?g|png|heic|webp)$/i.test(x.name)); if (!a.length) return; set({ photos: [...f.photos, ...a].slice(0, 4) }); setErr(""); };
  const c = d.couriers.find(x => x.id === f.courier_id);
  const Q = ({ ar, bn }) => <div className="dr-q">{ar}<Bn>{bn}</Bn></div>;
  let body;
  if (st === 0) body = <><Q ar="وقت الاستلام" bn="গ্রহণের সময়" />
    <div className="dr-note"><b className="dr-num" style={{ fontSize: 22 }}>{Number.isNaN(at) ? "—" : fmtWhen(at)}</b><div className="dr-mut">يُملأ تلقائياً بوقت الآن. عدّله فقط إن استلمت قبل قليل (حتى {MAX_BACK_H} ساعة). · <Bn>দরকার হলে আগের সময় দিন</Bn></div></div>
    <input type="datetime-local" className="g-input dr-in" value={f.received_at} max={toLocalInput(now)} min={toLocalInput(now - MAX_BACK_H * 3600e3)} onChange={e => set({ received_at: e.target.value })} aria-label="وقت الاستلام" />
    <button type="button" className="g-btn block" onClick={() => set({ received_at: toLocalInput(Date.now()) })}>الآن · <Bn>এখন</Bn></button></>;
  else if (st === 1) body = <><Q ar="مندوب سويتر" bn="সুইটার ডেলিভারি ম্যান" />
    {!f.newCourier ? <><select className="g-select dr-in" value={f.courier_id || ""} onChange={e => set({ courier_id: e.target.value })} aria-label="المندوب"><option value="">— اختر المندوب —</option>{d.couriers.map(x => <option key={x.id} value={x.id}>{x.name} · {x.phone}</option>)}</select>
      <button type="button" className="g-btn block" onClick={() => set({ newCourier: { name: "", phone: "" }, courier_id: null })}>+ مندوب جديد · <Bn>নতুন</Bn></button></>
      : <><label className="dr-l">الاسم · <Bn>নাম</Bn><input className="g-input dr-in" value={f.newCourier.name} onChange={e => set({ newCourier: { ...f.newCourier, name: e.target.value } })} autoComplete="off" /></label>
        <label className="dr-l">رقم الجوال · <Bn>মোবাইল</Bn><input className="g-input dr-in dr-num" inputMode="tel" placeholder="05XXXXXXXX" value={f.newCourier.phone} onChange={e => set({ newCourier: { ...f.newCourier, phone: e.target.value.replace(/[^\d+٠-٩ ]/g, "") } })} /></label>
        {phone && <span className="dr-mut">سيُحفظ: <b className="dr-num">{phone}</b></span>}
        {dup && <div className="dr-note">هذا الرقم مسجّل باسم «{dup.name}» — سيُستخدم المندوب نفسه.</div>}
        {d.couriers.length > 0 && <button type="button" className="g-btn block" onClick={() => set({ newCourier: null, courier_id: "" })}>اختيار من القائمة · <Bn>তালিকা থেকে</Bn></button>}</>}</>;
  else if (st === 2) body = <><Q ar="الكميات المستلمة" bn="কত পেয়েছ" />
    {items.map(i => <div key={i.key} className="dr-it"><ItemIcon item={i} img={towelImg} /><div className="dr-l">{i.name_ar}<Bn>{i.name_bn}</Bn></div><Stepper label={i.name_ar} value={f.qty[i.key]} onChange={n => set({ qty: { ...f.qty, [i.key]: n } })} /></div>)}</>;
  else if (st === 3) body = <><Q ar="المناشف المتسخة المُرجَعة للمندوب" bn="ময়লা তোয়ালে ফেরত দেওয়া হয়েছে" />
    <div className="dr-it"><ItemIcon item={{ key: "towel", kind: "towel" }} img={towelImg} /><div className="dr-l">مناشف متسخة<Bn>ময়লা তোয়ালে</Bn></div><Stepper label="المناشف المُرجَعة" value={f.towels_returned} onChange={n => set({ towels_returned: n })} /></div></>;
  else if (st === 4) body = <><Q ar="صور الشحنة (إلزامي)" bn="ছবি তোলো (বাধ্যতামূলক)" />
    <div className="dr-photos">{prev.map((u, i) => <div key={u} className="dr-ph"><img src={u} alt={"صورة " + (i + 1)} /><button type="button" aria-label="حذف الصورة" onClick={() => set({ photos: f.photos.filter((_, j) => j !== i) })}>×</button></div>)}
      {f.photos.length < 4 && <label className="dr-cap"><input type="file" accept="image/*" capture="environment" onChange={e => { addPhotos(e.target.files); e.target.value = ""; }} /><Icon n="camera" s={28} />صوّر · <Bn>ছবি তোলো</Bn></label>}</div>
    <span className="dr-mut">من 1 إلى 4 صور. تُضغط قبل الرفع. · <Bn>১–৪টি ছবি</Bn></span></>;
  else if (st === 5) body = <><Q ar="ملاحظة (اختياري)" bn="নোট (ঐচ্ছিক)" /><textarea className="g-textarea" rows={4} placeholder="نقص، تلف، تأخير… · কম, নষ্ট, দেরি…" value={f.note} onChange={e => set({ note: e.target.value })} /></>;
  else body = <><Q ar="مراجعة وتأكيد" bn="দেখে নিশ্চিত করো" />
    <div><div className="dr-sum"><span>الوقت</span><b className="dr-num">{fmtWhen(at)}</b></div>
      <div className="dr-sum"><span>المندوب</span><b>{f.newCourier ? (dup ? dup.name : f.newCourier.name + " (جديد)") : c ? c.name : "—"} <span className="dr-num">{f.newCourier ? phone : c ? c.phone : ""}</span></b></div>
      {items.filter(i => f.qty[i.key] > 0).map(i => <div key={i.key} className="dr-sum"><span>{i.name_ar}</span><b className="dr-num">{f.qty[i.key]}</b></div>)}
      <div className="dr-sum"><span>مناشف متسخة مُرجَعة</span><b className="dr-num">{f.towels_returned}</b></div>
      <div className="dr-sum"><span>الصور</span><b className="dr-num">{f.photos.length}</b></div>
      {f.note.trim() && <div className="dr-sum"><span>ملاحظة</span><span>{f.note}</span></div>}</div></>;
  return <>
    <div className="dr-row"><button className="g-btn sm" style={{ minHeight: 44 }} disabled={!!busy} onClick={() => setView(null)}>✕ إلغاء</button><span className="dr-grow" /><span className="dr-mut dr-num">{st + 1}/{N}</span></div>
    <div className="dr-dots" aria-hidden="true">{[...Array(N).keys()].map(i => <i key={i} className={i < st ? "done" : i === st ? "now" : ""} />)}</div>
    <section className="dr-card g-card">{body}</section>
    {err && <div className="dr-note bad" role="alert">{err}</div>}
    {busy && <div className="dr-note dr-row" role="status"><div className="g-spin" />{busy}</div>}
    <div className="dr-btns">{st > 0 ? <button className="g-btn block" disabled={!!busy} onClick={() => { setErr(""); setSt(s => s - 1); }}>السابق · <Bn>আগের</Bn></button> : <span />}
      {st < N - 1 ? <button className="g-btn primary block" onClick={next}>التالي · <Bn>পরের</Bn></button>
        : <button className="g-btn primary block" disabled={!!busy} onClick={save}>✓ تأكيد الاستلام · <Bn>নিশ্চিত</Bn></button>}</div>
  </>;
}

/* ── التوزيع ── */
function Dist({ delivery, ctx }) {
  const { d, empId, items, itemOf, nameOf, courierOf, operatorId, towelImg, done, setView, setMsg, setD } = ctx;
  const lines = Object.fromEntries((delivery.daily_delivery_lines || []).map(l => [l.item_key, l.qty]));
  // المشمولون فقط؛ المستلم المتدرب المرافق خارج القسمة ونصيبه صفر
  const { ids, receiver } = useMemo(() => splitList(d.team, empId, d.inSplit !== false), []);
  const [plan, setPlan] = useState(() => splitAll(lines, ids, receiver));
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const bad = splitErrors(lines, plan);
  const save = async () => { if (bad.length) return; setBusy(true); const r = await saveDistribution(delivery, plan, empId); setBusy(false);
    if (r.error) return setErr("تعذّر حفظ التوزيع: " + (r.error.message || r.error)); done("اعتُمد التوزيع ✓ — كل بايكر سيرى نصيبه · বিতরণ সম্পন্ন"); };
  return <>
    <div className="dr-row"><button className="g-btn sm" style={{ minHeight: 44 }} onClick={() => setView(null)}>→ رجوع</button></div>
    <section className="dr-card g-card"><h2>توزيع الشحنة · <Bn>ভাগ করো</Bn></h2>
      {!ids.length && <div className="dr-note bad">لا يوجد بايكر مشمول بالتوزيع — راجع المشرف. · <Bn>বিতরণের জন্য কেউ নেই</Bn></div>}
        {!receiver && <div className="dr-note warn">أنت متدرب مرافق: نصيبك صفر وتُقسم الشحنة على زملائك. · <Bn>তোমার ভাগ শূন্য</Bn></div>}
        <span className="dr-mut">قسمة متساوية والباقي {receiver ? "لك" : "لأول بايكر في القائمة"}. البايكر الغائب اجعل نصيبه 0. مجموع كل صنف يجب أن يساوي المستلم. · <Bn>অনুপস্থিত হলে ০ দাও</Bn></span></section>
    {Object.entries(lines).filter(([, q]) => q > 0).map(([k, q]) => { const i = itemOf(k), p = plan[k] || {}, s = Object.values(p).reduce((a, v) => a + v, 0);
      return <section key={k} className="dr-card g-card"><div className="dr-row"><ItemIcon item={i} img={towelImg} /><div className="dr-l dr-grow">{i.name_ar}<Bn>{i.name_bn}</Bn></div>
        <span className={"dr-pill dr-num " + (s === q ? "ok" : "bad")}>{s}/{q}</span></div>
        {ids.map(id => <div key={id} className="dr-dist"><span>{nameOf(id)}</span><Stepper label={i.name_ar + " — " + nameOf(id)} value={p[id]} onChange={n => setPlan(x => ({ ...x, [k]: { ...x[k], [id]: n } }))} /></div>)}</section>; })}
    {bad.length > 0 && <div className="dr-note bad" role="alert">المجموع لا يساوي الكمية المستلمة في: {bad.map(k => itemOf(k).name_ar).join("، ")}</div>}
    {err && <div className="dr-note bad" role="alert">{err}</div>}
    <button className="g-btn primary block dr-big" disabled={busy || bad.length > 0 || !ids.length} onClick={save}>{busy ? "جارٍ الحفظ…" : "اعتماد التوزيع · বিতরণ নিশ্চিত"}</button>
  </>;
}
export { photoUrl };
