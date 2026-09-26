import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

/*  بوابة البايكر — دلو ورغوة
    شاشتان: تسليم/استلام الدراجة + سجل الوقود
    كل بايكر يرى ويضيف سجلاته فقط (محمي بـ RLS via biker_employee_id).
    الصور تُرفع إلى مخزن field-evidence (عام).
*/

const CSS = `
.bp-wrap{font-family:'Tajawal',system-ui,sans-serif;direction:rtl;background:#eef1f4;min-height:100vh;color:#1c2630;padding:14px 10px 60px}
.bp-card{max-width:560px;margin:0 auto 14px;background:#fff;border-radius:14px;box-shadow:0 3px 16px rgba(0,0,0,.07);overflow:hidden}
.bp-head{background:linear-gradient(135deg,#0b5c46,#0f7a5c);color:#fff;padding:18px 18px}
.bp-head h1{font-size:19px;font-weight:800;margin:0}
.bp-head .s{opacity:.9;font-size:12.5px;margin-top:3px}
.bp-tabs{display:flex;gap:8px;max-width:560px;margin:0 auto 14px}
.bp-tab{flex:1;padding:11px;text-align:center;border-radius:10px;background:#fff;border:1px solid #e2e6ea;font-weight:700;font-size:13.5px;cursor:pointer;color:#41505e}
.bp-tab.on{background:#0f7a5c;color:#fff;border-color:#0f7a5c}
.bp-sec{padding:16px 18px}
.bp-lbl{font-size:12.5px;font-weight:700;color:#41505e;margin:12px 0 5px;display:block}
.bp-in,.bp-sel,.bp-ta{width:100%;padding:10px 12px;border:1px solid #d7dde3;border-radius:9px;font-size:14px;font-family:inherit;background:#fbfcfd}
.bp-ta{min-height:64px;resize:vertical}
.bp-row{display:flex;gap:10px}.bp-row>*{flex:1}
.bp-seg{display:flex;gap:8px}
.bp-seg button{flex:1;padding:10px;border-radius:9px;border:1px solid #d7dde3;background:#fbfcfd;font-weight:700;font-size:13px;cursor:pointer;color:#41505e}
.bp-seg button.on{background:#0b5c46;color:#fff;border-color:#0b5c46}
.bp-chk{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:13.5px}
.bp-chk input{width:20px;height:20px}
.bp-photo{margin-top:6px}
.bp-photo input{display:none}
.bp-photo label{display:inline-flex;align-items:center;gap:6px;padding:10px 14px;background:#eef4fb;border:1.5px dashed #9db8d6;border-radius:9px;color:#274963;font-weight:700;font-size:13px;cursor:pointer}
.bp-thumbs{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.bp-thumbs img{width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #d7dde3}
.bp-btn{width:100%;margin-top:16px;padding:13px;background:#0f7a5c;color:#fff;border:none;border-radius:10px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit}
.bp-btn:disabled{opacity:.6}
.bp-msg{margin-top:10px;padding:10px 12px;border-radius:9px;font-size:13px;font-weight:600}
.bp-ok{background:#e5f3ec;color:#0f7a5c} .bp-err{background:#fdeaea;color:#c0392b}
.bp-list{margin-top:6px}
.bp-item{border:1px solid #eef1f4;border-radius:9px;padding:9px 11px;margin-bottom:7px;font-size:12.5px;background:#fafbfc}
.bp-item .t{font-weight:700}.bp-item .m{color:#66727e;font-size:11.5px;margin-top:2px}
.bp-note{font-size:11.5px;color:#66727e;margin-top:4px}
`;

/* يحوّل رقم البايكر إلى إيميل الحساب خلف الكواليس */
function idToEmail(v) {
  const t = (v || "").trim();
  if (/^\d+$/.test(t)) return `biker${t}@dalu.sa`;      // رقم → biker1624@dalu.sa
  return `biker.${t.toLowerCase()}@dalu.sa`;             // عابد → biker.abed@dalu.sa
}

/* شاشة الدخول (رقم البايكر + الرقم السري) */
function Login() {
  const [bid, setBid] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    setErr("");
    if (!bid || !pw) { setErr("أدخل رقم البايكر والرقم السري."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: idToEmail(bid), password: pw });
      if (error) { setErr("رقم البايكر أو الرقم السري غير صحيح."); setBusy(false); return; }
      // onAuthStateChange في الأعلى سيعيد العرض تلقائياً
    } catch (e) { setErr("تعذّر الدخول: " + (e.message || e)); setBusy(false); }
  }
  return (
    <div className="bp-wrap"><style>{CSS}</style>
      <div className="bp-card">
        <div className="bp-head"><h1>بوابة البايكر — دلو ورغوة</h1><div className="s">سجّل الدخول برقمك</div></div>
        <div className="bp-sec">
          <label className="bp-lbl">رقم البايكر</label>
          <input className="bp-in" inputMode="text" value={bid} onChange={e => setBid(e.target.value)} placeholder="مثال: 1624" />
          <label className="bp-lbl">الرقم السري</label>
          <input className="bp-in" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="الرقم السري"
            onKeyDown={e => { if (e.key === "Enter") go(); }} />
          <button className="bp-btn" onClick={go} disabled={busy}>{busy ? "جارٍ الدخول…" : "دخول"}</button>
          {err && <div className="bp-msg bp-err">{err}</div>}
        </div>
      </div>
    </div>
  );
}

export default function BikerPortal() {
  const [session, setSession] = useState(undefined); // undefined=تحميل
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { try { sub.subscription.unsubscribe(); } catch (e) {} };
  }, []);
  if (session === undefined) return <div className="bp-wrap"><style>{CSS}</style><div className="bp-card"><div className="bp-sec">جارٍ التحميل…</div></div></div>;
  if (!session) return <Login />;
  return <Portal />;
}

function Portal() {
  const [me, setMe] = useState(null);       // {uid, biker_employee_id, name, operator_id}
  const [bikes, setBikes] = useState([]);
  const [tab, setTab] = useState("handover");
  const [err, setErr] = useState("");

  useEffect(() => { (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErr("الرجاء تسجيل الدخول."); return; }
      const { data: au } = await supabase.from("app_users")
        .select("biker_employee_id,display_name,operator_id,position").eq("id", user.id).single();
      if (!au || !au.biker_employee_id) { setErr("هذا الحساب غير مرتبط ببايكر."); return; }
      setMe({ uid: user.id, biker_employee_id: au.biker_employee_id, name: au.display_name, operator_id: au.operator_id });
      const { data: bk } = await supabase.from("fleet_vehicles")
        .select("id,plate,make,biker_employee_id").eq("active", true).order("plate");
      setBikes(bk || []);
    } catch (e) { setErr("تعذّر تحميل البيانات: " + (e.message || e)); }
  })(); }, []);

  if (err) return <div className="bp-wrap"><style>{CSS}</style><div className="bp-card"><div className="bp-sec"><div className="bp-msg bp-err">{err}</div></div></div></div>;
  if (!me) return <div className="bp-wrap"><style>{CSS}</style><div className="bp-card"><div className="bp-sec">جارٍ التحميل…</div></div></div>;

  return (
    <div className="bp-wrap">
      <style>{CSS}</style>
      <div className="bp-card">
        <div className="bp-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>بوابة البايكر</h1>
            <div className="s">أهلاً {me.name} · رقمك: {me.biker_employee_id}</div>
          </div>
          <button onClick={() => supabase.auth.signOut()}
            style={{ background: "rgba(255,255,255,.18)", color: "#fff", border: "1px solid rgba(255,255,255,.35)", borderRadius: 8, padding: "6px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>خروج</button>
        </div>
      </div>
      <div className="bp-tabs">
        <div className={"bp-tab" + (tab === "handover" ? " on" : "")} onClick={() => setTab("handover")}>تسليم / استلام الدراجة</div>
        <div className={"bp-tab" + (tab === "fuel" ? " on" : "")} onClick={() => setTab("fuel")}>سجل الوقود</div>
      </div>
      {tab === "handover" ? <Handover me={me} bikes={bikes} /> : <Fuel me={me} bikes={bikes} />}
    </div>
  );
}

/* ---------- رفع صورة ---------- */
async function uploadPhoto(file, folder, bikerId) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `biker-portal/${folder}/${bikerId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("field-evidence").upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
  if (error) throw error;
  return supabase.storage.from("field-evidence").getPublicUrl(path).data.publicUrl;
}

function defaultBike(bikes, me) {
  const mine = bikes.find(b => String(b.biker_employee_id || "") === String(me.biker_employee_id));
  return mine ? mine.id : (bikes[0] ? bikes[0].id : "");
}

/* ================= شاشة التسليم/الاستلام ================= */
function Handover({ me, bikes }) {
  const [vehicleId, setVehicleId] = useState(defaultBike(bikes, me));
  const [direction, setDirection] = useState("receive");
  const [odometer, setOdometer] = useState("");
  const [engineOk, setEngineOk] = useState(true);
  const [itemsOk, setItemsOk] = useState(true);
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [recent, setRecent] = useState([]);

  async function loadRecent() {
    const { data } = await supabase.from("bike_handovers")
      .select("id,plate,direction,odometer,created_at").order("created_at", { ascending: false }).limit(5);
    setRecent(data || []);
  }
  useEffect(() => { loadRecent(); }, []);

  async function submit() {
    setMsg(null);
    if (!vehicleId) { setMsg({ t: "err", m: "اختر الدراجة." }); return; }
    if (!odometer) { setMsg({ t: "err", m: "أدخل قراءة العدّاد." }); return; }
    if (files.length === 0) { setMsg({ t: "err", m: "أرفق صورة واحدة على الأقل لحالة الدراجة." }); return; }
    setBusy(true);
    try {
      const urls = [];
      for (const f of files) urls.push(await uploadPhoto(f, "handover", me.biker_employee_id));
      const bike = bikes.find(b => b.id === vehicleId);
      const { error } = await supabase.from("bike_handovers").insert({
        operator_id: me.operator_id, vehicle_id: vehicleId, plate: bike ? bike.plate : null,
        biker_employee_id: me.biker_employee_id, biker_name: me.name, direction,
        odometer: Number(odometer), engine_sound_ok: engineOk, items_ok: itemsOk,
        condition_notes: notes || null, photos: urls, created_by: me.uid,
      });
      if (error) throw error;
      setMsg({ t: "ok", m: "تم تسجيل حالة الدراجة بنجاح ✅" });
      setOdometer(""); setNotes(""); setFiles([]); loadRecent();
    } catch (e) { setMsg({ t: "err", m: "خطأ: " + (e.message || e) }); }
    setBusy(false);
  }

  return (
    <div className="bp-card"><div className="bp-sec">
      <label className="bp-lbl">الدراجة</label>
      <select className="bp-sel" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
        {bikes.map(b => <option key={b.id} value={b.id}>{b.plate}{b.make ? " — " + b.make : ""}</option>)}
      </select>

      <label className="bp-lbl">نوع العملية</label>
      <div className="bp-seg">
        <button className={direction === "receive" ? "on" : ""} onClick={() => setDirection("receive")}>استلام (بدء الاستخدام)</button>
        <button className={direction === "return" ? "on" : ""} onClick={() => setDirection("return")}>تسليم (إرجاع)</button>
      </div>

      <label className="bp-lbl">قراءة العدّاد (كم)</label>
      <input className="bp-in" type="number" inputMode="numeric" value={odometer} onChange={e => setOdometer(e.target.value)} placeholder="مثال: 14230" />

      <div className="bp-chk"><input type="checkbox" checked={engineOk} onChange={e => setEngineOk(e.target.checked)} id="eng" /><label htmlFor="eng">صوت المحرك سليم</label></div>
      <div className="bp-chk"><input type="checkbox" checked={itemsOk} onChange={e => setItemsOk(e.target.checked)} id="itm" /><label htmlFor="itm">الأدوات والملحقات كاملة</label></div>

      <label className="bp-lbl">ملاحظات الحالة (أي عطل أو خدش)</label>
      <textarea className="bp-ta" value={notes} onChange={e => setNotes(e.target.value)} placeholder="اكتب أي ملاحظة على حالة الدراجة…" />

      <label className="bp-lbl">صور حالة الدراجة (الهيكل، الإطارات، المرايا، العدّاد)</label>
      <div className="bp-photo">
        <label htmlFor="hph">📷 التقاط / إرفاق صور</label>
        <input id="hph" type="file" accept="image/*" capture="environment" multiple
          onChange={e => setFiles(Array.from(e.target.files || []))} />
      </div>
      <div className="bp-thumbs">{files.map((f, i) => <img key={i} src={URL.createObjectURL(f)} alt="" />)}</div>
      <div className="bp-note">التوثيق بالصور يحمي حقّك ويوضّح حالة الدراجة عند التسليم والاستلام.</div>

      <button className="bp-btn" onClick={submit} disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ التقرير"}</button>
      {msg && <div className={"bp-msg " + (msg.t === "ok" ? "bp-ok" : "bp-err")}>{msg.m}</div>}

      <label className="bp-lbl" style={{ marginTop: 18 }}>آخر سجلاتك</label>
      <div className="bp-list">
        {recent.length === 0 ? <div className="bp-note">لا يوجد بعد.</div> :
          recent.map(r => <div className="bp-item" key={r.id}>
            <div className="t">{r.plate || "—"} · {r.direction === "receive" ? "استلام" : "تسليم"} · العدّاد {r.odometer}</div>
            <div className="m">{new Date(r.created_at).toLocaleString("ar")}</div>
          </div>)}
      </div>
    </div></div>
  );
}

/* ================= شاشة سجل الوقود ================= */
function Fuel({ me, bikes }) {
  const [vehicleId, setVehicleId] = useState(defaultBike(bikes, me));
  const [fuelType, setFuelType] = useState("petrol");
  const [odometer, setOdometer] = useState("");
  const [amount, setAmount] = useState("");
  const [liters, setLiters] = useState("");
  const [odoFile, setOdoFile] = useState(null);
  const [recFile, setRecFile] = useState(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [recent, setRecent] = useState([]);

  async function loadRecent() {
    const { data } = await supabase.from("fuel_logs")
      .select("id,plate,fuel_type,odometer,amount,fill_at").order("fill_at", { ascending: false }).limit(5);
    setRecent(data || []);
  }
  useEffect(() => { loadRecent(); }, []);

  async function submit() {
    setMsg(null);
    if (!vehicleId) { setMsg({ t: "err", m: "اختر الدراجة." }); return; }
    if (!odometer) { setMsg({ t: "err", m: "أدخل قراءة العدّاد." }); return; }
    if (!odoFile) { setMsg({ t: "err", m: "أرفق صورة العدّاد." }); return; }
    setBusy(true);
    try {
      const odoUrl = await uploadPhoto(odoFile, "fuel-odometer", me.biker_employee_id);
      const recUrl = recFile ? await uploadPhoto(recFile, "fuel-receipt", me.biker_employee_id) : null;
      const bike = bikes.find(b => b.id === vehicleId);
      const { error } = await supabase.from("fuel_logs").insert({
        operator_id: me.operator_id, vehicle_id: vehicleId, plate: bike ? bike.plate : null,
        biker_employee_id: me.biker_employee_id, biker_name: me.name, fuel_type: fuelType,
        odometer: Number(odometer), amount: amount ? Number(amount) : null, liters: liters ? Number(liters) : null,
        odometer_photo_url: odoUrl, receipt_photo_url: recUrl, notes: notes || null, created_by: me.uid,
      });
      if (error) throw error;
      setMsg({ t: "ok", m: "تم تسجيل التعبئة بنجاح ✅" });
      setOdometer(""); setAmount(""); setLiters(""); setOdoFile(null); setRecFile(null); setNotes(""); loadRecent();
    } catch (e) { setMsg({ t: "err", m: "خطأ: " + (e.message || e) }); }
    setBusy(false);
  }

  return (
    <div className="bp-card"><div className="bp-sec">
      <label className="bp-lbl">الدراجة</label>
      <select className="bp-sel" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
        {bikes.map(b => <option key={b.id} value={b.id}>{b.plate}{b.make ? " — " + b.make : ""}</option>)}
      </select>

      <label className="bp-lbl">النوع</label>
      <div className="bp-seg">
        <button className={fuelType === "petrol" ? "on" : ""} onClick={() => setFuelType("petrol")}>بنزين</button>
        <button className={fuelType === "oil" ? "on" : ""} onClick={() => setFuelType("oil")}>زيت</button>
      </div>

      <div className="bp-row">
        <div><label className="bp-lbl">قراءة العدّاد (كم)</label>
          <input className="bp-in" type="number" inputMode="numeric" value={odometer} onChange={e => setOdometer(e.target.value)} placeholder="14230" /></div>
        <div><label className="bp-lbl">المبلغ (ريال)</label>
          <input className="bp-in" type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="50" /></div>
      </div>
      <label className="bp-lbl">اللترات (اختياري)</label>
      <input className="bp-in" type="number" inputMode="decimal" value={liters} onChange={e => setLiters(e.target.value)} placeholder="مثال: 8.2" />

      <label className="bp-lbl">صورة العدّاد بعد التعبئة (إلزامي)</label>
      <div className="bp-photo">
        <label htmlFor="odo">📷 صورة العدّاد</label>
        <input id="odo" type="file" accept="image/*" capture="environment" onChange={e => setOdoFile((e.target.files || [])[0] || null)} />
      </div>
      {odoFile && <div className="bp-thumbs"><img src={URL.createObjectURL(odoFile)} alt="" /></div>}

      <label className="bp-lbl">صورة الفاتورة (اختياري)</label>
      <div className="bp-photo">
        <label htmlFor="rec">📷 صورة الفاتورة</label>
        <input id="rec" type="file" accept="image/*" capture="environment" onChange={e => setRecFile((e.target.files || [])[0] || null)} />
      </div>
      {recFile && <div className="bp-thumbs"><img src={URL.createObjectURL(recFile)} alt="" /></div>}

      <label className="bp-lbl">ملاحظات (اختياري)</label>
      <textarea className="bp-ta" value={notes} onChange={e => setNotes(e.target.value)} placeholder="…" />

      <button className="bp-btn" onClick={submit} disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ التعبئة"}</button>
      {msg && <div className={"bp-msg " + (msg.t === "ok" ? "bp-ok" : "bp-err")}>{msg.m}</div>}

      <label className="bp-lbl" style={{ marginTop: 18 }}>آخر تعبئاتك</label>
      <div className="bp-list">
        {recent.length === 0 ? <div className="bp-note">لا يوجد بعد.</div> :
          recent.map(r => <div className="bp-item" key={r.id}>
            <div className="t">{r.plate || "—"} · {r.fuel_type === "oil" ? "زيت" : "بنزين"} · {r.amount ? r.amount + "﷼" : "—"} · العدّاد {r.odometer}</div>
            <div className="m">{new Date(r.fill_at).toLocaleString("ar")}</div>
          </div>)}
      </div>
    </div></div>
  );
}
