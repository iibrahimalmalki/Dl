import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useToast } from "./ui";
import { humanError } from "./errors";
import { Btn, ErrorNote, FieldErr, UploadBar, Skel, OfflineHint, useOnline, loadDraft, saveDraft } from "./uiKit";
import { DEFAULT_FUEL_AMOUNT, FUEL_STATUS, OIL_STATUS, statusOf, parseNum, intInput, decInput, fuelRequestError, fillError, oilRequestError, oilConfirmError, bikerRpcError, openOil } from "./fleetRequests";

/*  بوابة البايكر — الوقود والزيت | জ্বালানি ও তেল
    ١) اطلب وقوداً (عدّاد + صورته + 50﷼) ← تحوّل الإدارة ← ٢) سجّل كل تعبئة بفاتورتها وعدّادها.
    ٣) تغيير الزيت: اطلب (عدّاد + صورة) ← ترسله الإدارة لسويتر ← أكّد التنفيذ (عدّاد + فاتورة/ملصق + اسم مسؤول سويتر).
    مبدأ ثابت: الطلب يُقبل دائماً، ولا يرى الدرّاج أي رقم استهلاك أو تعليق أو مقارنة — التحليل للإدارة فقط.
    كل الكتابة عبر دوال القاعدة (request_fuel, add_fuel_fill, request_oil_change, confirm_oil_change): الهوية والدراجة من القاعدة.
*/

const DRAFT = bid => "bp.fueloil." + bid;
const day = v => (v ? new Date(v).toLocaleDateString("ar") : "—");
const Badge = ({ st }) => <span className={"g-badge " + st.tone}><i />{st.ar} · <span className="bn" style={{ display: "inline" }}>{st.bn}</span></span>;
const focusField = id => setTimeout(() => { const el = document.getElementById(id); if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); try { el.focus({ preventScroll: true }); } catch (e) { /* */ } } }, 30);

// رفع الصور مع ذاكرة: إعادة المحاولة تكمل من حيث توقفت
function useUploads(bid, uploadPhoto) {
  const done = React.useRef(new Map());
  const [prog, setProg] = useState(null);
  async function run(jobs) {   // jobs: [[file, folder]] ⇒ روابط بالترتيب
    const urls = [];
    setProg({ done: 0, total: jobs.length });
    for (let i = 0; i < jobs.length; i++) {
      const [file, folder] = jobs[i];
      let url = done.current.get(file);
      if (!url) { try { url = await uploadPhoto(file, folder, bid); } catch (e) { e.photoNo = i + 1; throw e; } done.current.set(file, url); }
      urls.push(url); setProg({ done: i + 1, total: jobs.length });
    }
    return urls;
  }
  return { run, prog, clear: () => { setProg(null); }, reset: () => { done.current = new Map(); setProg(null); } };
}
const toErr = e => bikerRpcError(e) || humanError(e, e && e.photoNo != null ? { photo: e.photoNo } : {});

export default function FuelOil({ me, myBike, kit }) {
  // kit: uploadPhoto/PhotoBox/NoBike من BikerPortal (تبقى في حزمتها؛ لا استيراد متبادل بين الحزمتين)
  const bid = me.biker_employee_id;
  const [reqs, setReqs] = useState(null), [fills, setFills] = useState(null), [oils, setOils] = useState(null), [loadErr, setLoadErr] = useState(null);
  // فشل القراءة لا يُعرض قوائم فارغة: تبقى «جارٍ التحميل» مع رسالة إعادة المحاولة (وإلا ظهر نموذج زيت جديد رغم وجود طلب مفتوح)
  async function load() {
    setLoadErr(null);
    try {
    const [a, b, c] = await Promise.all([
      supabase.from("fuel_requests").select("id,plate,amount,odometer,status,requested_at,transferred_at").eq("biker_employee_id", bid).order("requested_at", { ascending: false }).limit(8),
      supabase.from("fuel_logs").select("id,plate,odometer,amount,fill_at,request_id").eq("biker_employee_id", bid).eq("legacy", false).order("fill_at", { ascending: false }).limit(8),
      supabase.from("maintenance_requests").select("id,plate,status,odometer,requested_at,sent_at,done_at,approved_at").eq("biker_employee_id", bid).order("requested_at", { ascending: false }).limit(6),
    ]);
    const bad = [a, b, c].find(x => x.error);
    if (bad) throw bad.error;
    setReqs(a.data || []); setFills(b.data || []); setOils(c.data || []);
    } catch (e) { setLoadErr(humanError(e)); }
  }
  useEffect(() => { load(); }, [bid]);
  if (!myBike) return <kit.NoBike />;
  return (<>
    <div className="bp-card g-card"><div className="bp-sec" style={{ padding: "12px 16px" }}>
      <div className="bp-bike" style={{ margin: 0 }}><span className="ic">🏍️</span><div><div className="p">{myBike.plate}</div>{myBike.make && <div className="m">{myBike.make}</div>}</div></div>
    </div></div>
    {loadErr && <div className="bp-card g-card"><div className="bp-sec"><ErrorNote e={loadErr} who={bid} onRetry={load} onLogin={() => supabase.auth.signOut()} /></div></div>}
    <FuelRequest me={me} kit={kit} onSaved={load} />
    <FillForm me={me} kit={kit} hasTransfer={!!(reqs && reqs.some(r => r.transferred_at))} onSaved={load} />
    <MyFuel reqs={reqs} fills={fills} />
    <Oil me={me} kit={kit} oils={oils} onSaved={load} />
  </>);
}

/* ---------- ١) اطلب وقوداً ---------- */
function FuelRequest({ me, kit, onSaved }) {
  const bid = me.biker_employee_id;
  const d0 = React.useMemo(() => (loadDraft(DRAFT(bid)) || {}).req || {}, [bid]);
  const [odometer, setOdometer] = useState(d0.odometer || "");
  const [amount, setAmount] = useState(d0.amount || String(DEFAULT_FUEL_AMOUNT));
  const [photo, setPhoto] = useState(null);
  const [fe, setFe] = useState(null), [err, setErr] = useState(null), [busy, setBusy] = useState(false);
  const up = useUploads(bid, kit.uploadPhoto); const { PhotoBox } = kit; const toast = useToast(); const online = useOnline();
  useEffect(() => { const d = loadDraft(DRAFT(bid)) || {}; saveDraft(DRAFT(bid), { ...d, req: { odometer, amount } }); }, [odometer, amount]);
  async function submit() {
    setErr(null);
    const v = fuelRequestError({ odometer, amount, odoPhoto: photo });
    if (v) { setFe(v); focusField({ odometer: "fr_odo", amount: "fr_amt", odoPhoto: "fr_ph" }[v.field]); return; }
    setFe(null); setBusy(true);
    try {
      const [url] = await up.run([[photo, "fuel-request-odometer"]]);
      const { error } = await supabase.rpc("request_fuel", { p_odometer: parseNum(odometer), p_odometer_photo_url: url, p_amount: parseNum(amount) });
      if (error) throw error;
      toast.ok("تم إرسال طلب الوقود ✓", "জ্বালানির অনুরোধ পাঠানো হয়েছে", 3500);
      up.reset(); setOdometer(""); setAmount(String(DEFAULT_FUEL_AMOUNT)); setPhoto(null);
      const d = loadDraft(DRAFT(bid)) || {}; saveDraft(DRAFT(bid), { ...d, req: null });
      onSaved();
    } catch (e) { setErr(toErr(e)); }
    setBusy(false); up.clear();
  }
  const errAt = f => fe && fe.field === f ? <FieldErr t={fe} /> : null;
  const inv = f => fe && fe.field === f ? " k-inv" : "";
  return <div className="bp-card g-card bp-free"><div className="bp-sec">
    <h2 className="bp-wiz-h" style={{ marginTop: 0 }}>⛽ اطلب وقوداً<span className="bn">জ্বালানির অনুরোধ</span></h2>
    <div className="bp-row">
      <div><label className="bp-lbl" htmlFor="fr_odo">العدّاد (كم) <span className="bp-req">*</span> <span className="bn">/ ওডোমিটার</span></label>
        <input id="fr_odo" className={"g-input bp-in" + inv("odometer")} inputMode="numeric" value={odometer} onChange={e => { setOdometer(intInput(e.target.value)); setFe(null); }} placeholder="14230" dir="ltr" style={{ textAlign: "right" }} />{errAt("odometer")}</div>
      <div><label className="bp-lbl" htmlFor="fr_amt">المبلغ (ريال) <span className="bp-req">*</span> <span className="bn">/ পরিমাণ</span></label>
        <input id="fr_amt" className={"g-input bp-in" + inv("amount")} inputMode="decimal" value={amount} onChange={e => { setAmount(decInput(e.target.value)); setFe(null); }} dir="ltr" style={{ textAlign: "right" }} />{errAt("amount")}</div>
    </div>
    <label className="bp-lbl">صورة العدّاد <span className="bp-req">*</span> <span className="bn">/ ওডোমিটারের ছবি</span></label>
    <div className={"bp-pgrid" + inv("odoPhoto")} style={{ gridTemplateColumns: "1fr" }}><PhotoBox id="fr_ph" cap="صورة العدّاد" capBn="ওডোমিটার" tag="العداد *" file={photo} onPick={x => { setPhoto(x); setFe(null); }} /></div>
    {errAt("odoPhoto")}
    {err && <div style={{ marginTop: 12 }}><ErrorNote e={err} who={bid} busy={busy} onRetry={submit} onLogin={() => supabase.auth.signOut()} /></div>}
    {busy && up.prog && <UploadBar done={up.prog.done} total={up.prog.total} />}
    <Btn kind="primary" block big busy={busy} disabled={!online} style={{ marginTop: 12 }} onClick={submit} bn={busy ? "পাঠানো হচ্ছে…" : "অনুরোধ পাঠান"}>{busy ? "جارٍ الإرسال…" : "أرسل الطلب"}</Btn>
    {!online && <OfflineHint />}
  </div></div>;
}

/* ---------- ٢) سجّل تعبئة ---------- */
function FillForm({ me, kit, hasTransfer, onSaved }) {
  const bid = me.biker_employee_id;
  const d0 = React.useMemo(() => (loadDraft(DRAFT(bid)) || {}).fill || {}, [bid]);
  const [odometer, setOdometer] = useState(d0.odometer || ""), [amount, setAmount] = useState(d0.amount || ""), [liters, setLiters] = useState(d0.liters || ""), [notes, setNotes] = useState(d0.notes || "");
  const [odoPh, setOdoPh] = useState(null), [recPh, setRecPh] = useState(null);
  const [fe, setFe] = useState(null), [err, setErr] = useState(null), [busy, setBusy] = useState(false);
  const up = useUploads(bid, kit.uploadPhoto); const { PhotoBox } = kit; const toast = useToast(); const online = useOnline();
  useEffect(() => { const d = loadDraft(DRAFT(bid)) || {}; saveDraft(DRAFT(bid), { ...d, fill: { odometer, amount, liters, notes } }); }, [odometer, amount, liters, notes]);
  async function submit() {
    setErr(null);
    const v = fillError({ odometer, amount, liters, odoPhoto: odoPh, receipt: recPh });
    if (v) { setFe(v); focusField({ odometer: "ff_odo", amount: "ff_amt", liters: "ff_lit", odoPhoto: "ff_odo_ph", receipt: "ff_rec_ph" }[v.field]); return; }
    setFe(null); setBusy(true);
    try {
      const [o, r] = await up.run([[odoPh, "fuel-odometer"], [recPh, "fuel-receipt"]]);
      const { error } = await supabase.rpc("add_fuel_fill", { p_odometer: parseNum(odometer), p_amount: parseNum(amount), p_liters: liters === "" ? null : parseNum(liters),
        p_odometer_photo_url: o, p_receipt_photo_url: r, p_notes: notes.trim() || null });
      if (error) throw error;
      toast.ok("تم تسجيل التعبئة ✓", "রিফুয়েল সংরক্ষিত", 3500);
      up.reset(); setOdometer(""); setAmount(""); setLiters(""); setNotes(""); setOdoPh(null); setRecPh(null);
      const d = loadDraft(DRAFT(bid)) || {}; saveDraft(DRAFT(bid), { ...d, fill: null });
      onSaved();
    } catch (e) { setErr(toErr(e)); }
    setBusy(false); up.clear();
  }
  const errAt = f => fe && fe.field === f ? <FieldErr t={fe} /> : null;
  const inv = f => fe && fe.field === f ? " k-inv" : "";
  return <div className="bp-card g-card bp-free"><div className="bp-sec">
    <h2 className="bp-wiz-h" style={{ marginTop: 0 }}>🧾 سجّل تعبئة<span className="bn">রিফুয়েল রেকর্ড করুন</span></h2>
    <div className="bp-note" style={{ marginTop: 0 }}>{hasTransfer ? "سجّل كل تعبئة بفاتورتها وصورة العدّاد." : "بعد وصول مبلغ الوقود، سجّل كل تعبئة بفاتورتها."}
      <span className="bn" style={{ display: "block" }}>{hasTransfer ? "প্রতিটি রিফুয়েল রসিদ ও ওডোমিটারের ছবিসহ রেকর্ড করুন।" : "টাকা পাওয়ার পর প্রতিটি রিফুয়েল রসিদসহ রেকর্ড করুন।"}</span></div>
    <div className="bp-row">
      <div><label className="bp-lbl" htmlFor="ff_odo">العدّاد (كم) <span className="bp-req">*</span> <span className="bn">/ ওডোমিটার</span></label>
        <input id="ff_odo" className={"g-input bp-in" + inv("odometer")} inputMode="numeric" value={odometer} onChange={e => { setOdometer(intInput(e.target.value)); setFe(null); }} placeholder="14230" dir="ltr" style={{ textAlign: "right" }} />{errAt("odometer")}</div>
      <div><label className="bp-lbl" htmlFor="ff_amt">المبلغ (ريال) <span className="bp-req">*</span> <span className="bn">/ পরিমাণ</span></label>
        <input id="ff_amt" className={"g-input bp-in" + inv("amount")} inputMode="decimal" value={amount} onChange={e => { setAmount(decInput(e.target.value)); setFe(null); }} placeholder="25" dir="ltr" style={{ textAlign: "right" }} />{errAt("amount")}</div>
    </div>
    <label className="bp-lbl" htmlFor="ff_lit">اللترات (اختياري) <span className="bn">/ লিটার (ঐচ্ছিক)</span></label>
    <input id="ff_lit" className={"g-input bp-in" + inv("liters")} inputMode="decimal" value={liters} onChange={e => { setLiters(decInput(e.target.value)); setFe(null); }} placeholder="11" dir="ltr" style={{ textAlign: "right" }} />{errAt("liters")}
    <label className="bp-lbl">صورة العدّاد والفاتورة <span className="bp-req">*</span> <span className="bn">/ ওডোমিটার ও রসিদের ছবি</span></label>
    <div className="bp-pgrid" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div className={inv("odoPhoto")}><PhotoBox id="ff_odo_ph" cap="صورة العدّاد" capBn="ওডোমিটার" tag="العداد *" file={odoPh} onPick={x => { setOdoPh(x); setFe(null); }} /></div>
      <div className={inv("receipt")}><PhotoBox id="ff_rec_ph" cap="صورة الفاتورة" capBn="রসিদ" tag="الفاتورة *" file={recPh} onPick={x => { setRecPh(x); setFe(null); }} /></div>
    </div>
    {errAt("odoPhoto")}{errAt("receipt")}
    <label className="bp-lbl" htmlFor="ff_notes">ملاحظات (اختياري) <span className="bn">/ নোট</span></label>
    <textarea id="ff_notes" className="g-textarea bp-ta" value={notes} onChange={e => setNotes(e.target.value)} placeholder="…" maxLength={1000} />
    {err && <div style={{ marginTop: 12 }}><ErrorNote e={err} who={bid} busy={busy} onRetry={submit} onLogin={() => supabase.auth.signOut()} /></div>}
    {busy && up.prog && <UploadBar done={up.prog.done} total={up.prog.total} />}
    <Btn kind="primary" block big busy={busy} disabled={!online} style={{ marginTop: 12 }} onClick={submit} bn={busy ? "সংরক্ষণ হচ্ছে…" : "রিফুয়েল সংরক্ষণ"}>{busy ? "جارٍ الحفظ…" : "حفظ التعبئة"}</Btn>
    {!online && <OfflineHint />}
  </div></div>;
}

/* ---------- طلباتي وتعبئاتي: الحالة فقط، بلا أي رقم تحليلي ---------- */
function MyFuel({ reqs, fills }) {
  return <div className="bp-card g-card"><div className="bp-sec">
    <label className="bp-lbl" style={{ marginTop: 0 }}>طلباتي <span className="bn">/ আমার অনুরোধ</span></label>
    <div className="bp-list">
      {reqs === null ? <Skel rows={2} card={false} /> : reqs.length === 0 ? <div className="g-empty" style={{ padding: "14px 10px" }}><b>لا يوجد بعد · <span className="bn">এখনও নেই</span></b></div> :
        reqs.map(r => <div className="bp-item" key={r.id}>
          <div className="t">{r.amount}﷼ · العدّاد · <span className="bn" style={{ display: "inline" }}>ওডোমিটার</span> {r.odometer}<Badge st={statusOf(FUEL_STATUS, r.status)} /></div>
          <div className="m">{day(r.requested_at)}{r.transferred_at && <> · حُوِّل · <span className="bn" style={{ display: "inline" }}>টাকা পাঠানো</span> {day(r.transferred_at)}</>}</div>
        </div>)}
    </div>
    <label className="bp-lbl">تعبئاتي <span className="bn">/ আমার রিফুয়েল</span></label>
    <div className="bp-list">
      {fills === null ? <Skel rows={2} card={false} /> : fills.length === 0 ? <div className="g-empty" style={{ padding: "14px 10px" }}><b>لا يوجد بعد · <span className="bn">এখনও নেই</span></b></div> :
        fills.map(r => <div className="bp-item" key={r.id}>
          <div className="t">{r.amount ? r.amount + "﷼" : "—"} · العدّاد · <span className="bn" style={{ display: "inline" }}>ওডোমিটার</span> {r.odometer ?? "—"}<span className="g-badge info"><i />مُرسل · <span className="bn" style={{ display: "inline" }}>জমা দেওয়া</span></span></div>
          <div className="m">{day(r.fill_at)}</div>
        </div>)}
    </div>
  </div></div>;
}

/* ---------- ٣) تغيير الزيت ---------- */
function Oil({ me, kit, oils, onSaved }) {
  const open = oils ? openOil(oils) : null;
  return <div className="bp-card g-card bp-free"><div className="bp-sec">
    <h2 className="bp-wiz-h" style={{ marginTop: 0 }}>🛢️ تغيير الزيت<span className="bn">তেল পরিবর্তন</span></h2>
    {oils === null ? <Skel rows={2} card={false} /> : open ? <OilConfirm me={me} kit={kit} req={open} onSaved={onSaved} /> : <OilRequest me={me} kit={kit} onSaved={onSaved} />}
    {oils && oils.length > 0 && <>
      <label className="bp-lbl">طلبات الزيت <span className="bn">/ তেলের অনুরোধ</span></label>
      <div className="bp-list">{oils.map(r => <div className="bp-item" key={r.id}>
        <div className="t">العدّاد · <span className="bn" style={{ display: "inline" }}>ওডোমিটার</span> {r.odometer}<Badge st={statusOf(OIL_STATUS, r.status)} /></div>
        <div className="m">{day(r.requested_at)}</div>
      </div>)}</div>
    </>}
  </div></div>;
}

function OilRequest({ me, kit, onSaved }) {
  const bid = me.biker_employee_id;
  const [odometer, setOdometer] = useState(""), [photo, setPhoto] = useState(null);
  const [fe, setFe] = useState(null), [err, setErr] = useState(null), [busy, setBusy] = useState(false);
  const up = useUploads(bid, kit.uploadPhoto); const { PhotoBox } = kit; const toast = useToast(); const online = useOnline();
  async function submit() {
    setErr(null);
    const v = oilRequestError({ odometer, odoPhoto: photo });
    if (v) { setFe(v); focusField(v.field === "odometer" ? "or_odo" : "or_ph"); return; }
    setFe(null); setBusy(true);
    try {
      const [url] = await up.run([[photo, "oil-request-odometer"]]);
      const { error } = await supabase.rpc("request_oil_change", { p_odometer: parseNum(odometer), p_odometer_photo_url: url });
      if (error) throw error;
      toast.ok("تم إرسال طلب تغيير الزيت ✓", "তেল পরিবর্তনের অনুরোধ পাঠানো হয়েছে", 3500);
      up.reset(); setOdometer(""); setPhoto(null); onSaved();
    } catch (e) { setErr(toErr(e)); }
    setBusy(false); up.clear();
  }
  const errAt = f => fe && fe.field === f ? <FieldErr t={fe} /> : null;
  return <>
    <label className="bp-lbl" htmlFor="or_odo" style={{ marginTop: 0 }}>العدّاد (كم) <span className="bp-req">*</span> <span className="bn">/ ওডোমিটার</span></label>
    <input id="or_odo" className={"g-input bp-in" + (fe && fe.field === "odometer" ? " k-inv" : "")} inputMode="numeric" value={odometer} onChange={e => { setOdometer(intInput(e.target.value)); setFe(null); }} placeholder="14230" dir="ltr" style={{ textAlign: "right" }} />{errAt("odometer")}
    <label className="bp-lbl">صورة العدّاد <span className="bp-req">*</span> <span className="bn">/ ওডোমিটারের ছবি</span></label>
    <div className="bp-pgrid" style={{ gridTemplateColumns: "1fr" }}><PhotoBox id="or_ph" cap="صورة العدّاد" capBn="ওডোমিটার" tag="العداد *" file={photo} onPick={x => { setPhoto(x); setFe(null); }} /></div>
    {errAt("odoPhoto")}
    {err && <div style={{ marginTop: 12 }}><ErrorNote e={err} who={bid} busy={busy} onRetry={submit} onLogin={() => supabase.auth.signOut()} /></div>}
    {busy && up.prog && <UploadBar done={up.prog.done} total={up.prog.total} />}
    <Btn kind="primary" block big busy={busy} disabled={!online} style={{ marginTop: 12 }} onClick={submit} bn="তেল পরিবর্তনের অনুরোধ">{busy ? "جارٍ الإرسال…" : "اطلب تغيير الزيت"}</Btn>
    {!online && <OfflineHint />}
  </>;
}

function OilConfirm({ me, kit, req, onSaved }) {
  const bid = me.biker_employee_id;
  const [odometer, setOdometer] = useState(""), [odoPh, setOdoPh] = useState(null), [proof, setProof] = useState(null), [tech, setTech] = useState("");
  const [fe, setFe] = useState(null), [err, setErr] = useState(null), [busy, setBusy] = useState(false);
  const up = useUploads(bid, kit.uploadPhoto); const { PhotoBox } = kit; const toast = useToast(); const online = useOnline();
  async function submit() {
    setErr(null);
    const v = oilConfirmError({ odometer, odoPhoto: odoPh, proof, tech });
    if (v) { setFe(v); focusField({ odometer: "oc_odo", odoPhoto: "oc_odo_ph", proof: "oc_proof", tech: "oc_tech" }[v.field]); return; }
    setFe(null); setBusy(true);
    try {
      const [o, p] = await up.run([[odoPh, "oil-done-odometer"], [proof, "oil-done-proof"]]);
      const { error } = await supabase.rpc("confirm_oil_change", { p_id: req.id, p_odometer: parseNum(odometer), p_odometer_photo_url: o, p_proof_url: p, p_tech_name: tech.trim() });
      if (error) throw error;
      toast.ok("تم تأكيد تغيير الزيت ✓", "তেল পরিবর্তন নিশ্চিত হয়েছে", 3500);
      up.reset(); onSaved();
    } catch (e) { setErr(toErr(e)); }
    setBusy(false); up.clear();
  }
  const errAt = f => fe && fe.field === f ? <FieldErr t={fe} /> : null;
  const inv = f => fe && fe.field === f ? " k-inv" : "";
  const st = statusOf(OIL_STATUS, req.status);
  return <>
    <div className="bp-item" style={{ marginBottom: 4 }}><div className="t">طلبك الحالي · <span className="bn" style={{ display: "inline" }}>আপনার বর্তমান অনুরোধ</span> · {req.odometer}<Badge st={st} /></div><div className="m">{day(req.requested_at)}</div></div>
    <div className="bp-note">بعد تغيير الزيت أكّد هنا. <span className="bn" style={{ display: "inline" }}>তেল পরিবর্তনের পর এখানে নিশ্চিত করুন।</span></div>
    <label className="bp-lbl" htmlFor="oc_odo">العدّاد بعد التغيير (كم) <span className="bp-req">*</span> <span className="bn">/ পরিবর্তনের পর ওডোমিটার</span></label>
    <input id="oc_odo" className={"g-input bp-in" + inv("odometer")} inputMode="numeric" value={odometer} onChange={e => { setOdometer(intInput(e.target.value)); setFe(null); }} placeholder="14240" dir="ltr" style={{ textAlign: "right" }} />{errAt("odometer")}
    <label className="bp-lbl">صورة العدّاد والفاتورة أو ملصق الزيت <span className="bp-req">*</span> <span className="bn">/ ওডোমিটার ও রসিদ বা স্টিকারের ছবি</span></label>
    <div className="bp-pgrid" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div className={inv("odoPhoto")}><PhotoBox id="oc_odo_ph" cap="صورة العدّاد" capBn="ওডোমিটার" tag="العداد *" file={odoPh} onPick={x => { setOdoPh(x); setFe(null); }} /></div>
      <div className={inv("proof")}><PhotoBox id="oc_proof" cap="الفاتورة أو الملصق" capBn="রসিদ বা স্টিকার" tag="الإثبات *" file={proof} onPick={x => { setProof(x); setFe(null); }} /></div>
    </div>
    {errAt("odoPhoto")}{errAt("proof")}
    <label className="bp-lbl" htmlFor="oc_tech">اسم مسؤول الصيانة في سويتر <span className="bp-req">*</span> <span className="bn">/ সুইটারের মেইনটেন্যান্স দায়িত্বশীলের নাম</span></label>
    <input id="oc_tech" className={"g-input bp-in" + inv("tech")} value={tech} maxLength={120} onChange={e => { setTech(e.target.value); setFe(null); }} />{errAt("tech")}
    {err && <div style={{ marginTop: 12 }}><ErrorNote e={err} who={bid} busy={busy} onRetry={submit} onLogin={() => supabase.auth.signOut()} /></div>}
    {busy && up.prog && <UploadBar done={up.prog.done} total={up.prog.total} />}
    <Btn kind="primary" block big busy={busy} disabled={!online} style={{ marginTop: 12 }} onClick={submit} bn="নিশ্চিত করুন">{busy ? "جارٍ الحفظ…" : "أكّد تغيير الزيت"}</Btn>
    {!online && <OfflineHint />}
  </>;
}
