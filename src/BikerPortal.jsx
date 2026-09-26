import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

/*  بوابة البايكر — دلو ورغوة | বাইকার পোর্টাল
    هوية دلو ورغوة (برتقالي) · ثنائية اللغة (عربي + বাংলা)
    شاشات: ملفي · تسليم/استلام الدراجة (٤ اتجاهات + عداد + أضرار + قائمة تحقق) · سجل الوقود (فاتورة إلزامية)
    كل بايكر يرى دراجته المخصّصة وسجلاته فقط (RLS via biker_employee_id).
    الصور تُرفع إلى مخزن field-evidence (عام).
*/

const CSS = `
.bp-wrap{font-family:'Segoe UI',Tahoma,system-ui,sans-serif;direction:rtl;background:linear-gradient(160deg,#FFF9F0,#FFF3DC 60%,#FFEACC);min-height:100dvh;color:#15243a;padding:14px 10px 70px}
.bp-card{max-width:560px;margin:0 auto 14px;background:#fff;border-radius:18px;box-shadow:0 6px 22px rgba(20,36,58,.08);overflow:hidden}
.bp-head{background:linear-gradient(135deg,#E8712B,#CC5200);color:#fff;padding:18px 18px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.bp-head h1{font-size:19px;font-weight:900;margin:0}
.bp-head .s{opacity:.95;font-size:12px;margin-top:4px;line-height:1.5}
.bp-logout{background:rgba(255,255,255,.18);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:9px;padding:7px 12px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit;flex-shrink:0;line-height:1.4}
.bp-prof{max-width:560px;margin:0 auto 14px;display:flex;gap:10px}
.bp-pcell{flex:1;background:#fff;border:1px solid #f0e2ce;border-radius:14px;padding:12px 10px;text-align:center;box-shadow:0 3px 14px rgba(232,113,43,.06)}
.bp-pcell .k{font-size:10.5px;color:#a8834f;font-weight:700}
.bp-pcell .v{font-size:15px;font-weight:900;color:#15243a;margin-top:3px}
.bp-tabs{display:flex;gap:6px;max-width:560px;margin:0 auto 14px}
.bp-tab{flex:1;padding:10px 4px;text-align:center;border-radius:12px;background:#fff;border:1.5px solid #f0e2ce;font-weight:800;font-size:12.5px;cursor:pointer;color:#8a6d47;line-height:1.45}
.bp-tab .bn{display:block;font-size:9px;font-weight:600;opacity:.75}
.bp-tab.on{background:linear-gradient(135deg,#E8712B,#CC5200);color:#fff;border-color:#E8712B}
.bp-sec{padding:16px 18px}
.bp-lbl{font-size:13px;font-weight:800;color:#334155;margin:14px 0 6px;display:block}
.bp-lbl .bn{font-weight:600;color:#94a3b8;font-size:11px}
.bp-req{color:#c0392b;font-weight:900}
.bp-in,.bp-sel,.bp-ta{width:100%;padding:11px 13px;border:1.5px solid #e6dccb;border-radius:11px;font-size:14px;font-family:inherit;background:#fffdf9;box-sizing:border-box}
.bp-in:focus,.bp-sel:focus,.bp-ta:focus{outline:none;border-color:#E8712B}
.bp-ta{min-height:64px;resize:vertical}
.bp-bike{display:flex;align-items:center;gap:10px;background:#fff4e9;border:1.5px solid #f0b27f;border-radius:12px;padding:12px 14px}
.bp-bike .ic{font-size:24px}
.bp-bike .p{font-weight:900;font-size:16px;color:#CC5200}
.bp-bike .m{font-size:11px;color:#a8834f}
.bp-row{display:flex;gap:10px}.bp-row>*{flex:1}
.bp-seg{display:flex;gap:8px}
.bp-seg button{flex:1;padding:11px 6px;border-radius:11px;border:1.5px solid #e6dccb;background:#fffdf9;font-weight:800;font-size:13px;cursor:pointer;color:#8a6d47;font-family:inherit;line-height:1.4}
.bp-seg button .bn{display:block;font-size:10px;font-weight:600;opacity:.75}
.bp-seg button.on{background:#15243a;color:#fff;border-color:#15243a}
.bp-chklist{border:1.5px solid #eee4d3;border-radius:12px;overflow:hidden;margin-top:6px}
.bp-chk{display:flex;align-items:center;gap:10px;padding:11px 13px;font-size:13.5px;font-weight:700;color:#334155;border-bottom:1px solid #f4ece0;background:#fffdf9}
.bp-chk:last-child{border-bottom:none}
.bp-chk input{width:22px;height:22px;accent-color:#2E7D32;flex-shrink:0}
.bp-chk .bn{font-weight:600;color:#94a3b8;font-size:10.5px}
.bp-chk .tx{flex:1}
.bp-pgrid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:6px}
.bp-pbox{border:1.5px dashed #f0b27f;border-radius:12px;background:#fff8f1;overflow:hidden;position:relative;min-height:96px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;text-align:center}
.bp-pbox input{display:none}
.bp-pbox .cap{font-size:12px;font-weight:800;color:#CC5200;padding:6px}
.bp-pbox .cap .bn{display:block;font-size:9.5px;font-weight:600;color:#a8834f}
.bp-pbox .em{font-size:22px;margin-top:6px}
.bp-pbox.done{border-style:solid;border-color:#2E7D32}
.bp-pbox img{width:100%;height:96px;object-fit:cover;display:block}
.bp-pbox .tag{position:absolute;top:5px;inset-inline-start:5px;background:rgba(21,36,58,.75);color:#fff;font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:20px}
.bp-photo{margin-top:6px}
.bp-photo input{display:none}
.bp-photo label{display:inline-flex;align-items:center;gap:7px;padding:11px 15px;background:#fff4e9;border:1.5px dashed #f0b27f;border-radius:11px;color:#CC5200;font-weight:800;font-size:13px;cursor:pointer}
.bp-thumbs{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.bp-thumbs img{width:66px;height:66px;object-fit:cover;border-radius:10px;border:1px solid #e6dccb}
.bp-btn{width:100%;margin-top:18px;padding:14px;background:linear-gradient(135deg,#E8712B,#CC5200);color:#fff;border:none;border-radius:12px;font-weight:900;font-size:15px;cursor:pointer;font-family:inherit}
.bp-btn:disabled{opacity:.6}
.bp-msg{margin-top:12px;padding:11px 13px;border-radius:11px;font-size:13px;font-weight:700}
.bp-ok{background:#e9f7ee;color:#1b7a3d}.bp-err{background:#fdeaea;color:#c0392b}
.bp-list{margin-top:6px}
.bp-item{border:1px solid #f0e2ce;border-radius:11px;padding:10px 12px;margin-bottom:7px;font-size:12.5px;background:#fffdf9}
.bp-item .t{font-weight:800;color:#15243a}.bp-item .m{color:#a8834f;font-size:11.5px;margin-top:2px}
.bp-note{font-size:11.5px;color:#a8834f;margin-top:6px;line-height:1.6}
.bp-logo{width:60px;height:60px;border-radius:16px;background:linear-gradient(135deg,#E8712B,#f5a35f);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:30px;box-shadow:0 8px 20px rgba(232,113,43,.32);overflow:hidden}
.bp-logo img{width:70%;height:70%;object-fit:contain}
`;

/* قائمة التحقق الأساسية للدراجة (أفضل الممارسات) */
const CHECKLIST = [
  { id: "engine", ar: "صوت المحرك سليم", bn: "ইঞ্জিনের শব্দ ঠিক" },
  { id: "brakes", ar: "الفرامل تعمل", bn: "ব্রেক কাজ করে" },
  { id: "tires", ar: "الإطارات سليمة", bn: "টায়ার ঠিক আছে" },
  { id: "lights", ar: "الأنوار والإشارات", bn: "লাইট ও সিগন্যাল" },
  { id: "mirrors", ar: "المرايا سليمة", bn: "আয়না ঠিক আছে" },
  { id: "horn", ar: "البوق (الزمّور)", bn: "হর্ন" },
  { id: "chain", ar: "السلسلة والجنزير", bn: "চেইন" },
  { id: "oil", ar: "مستوى الزيت", bn: "তেলের স্তর" },
  { id: "box", ar: "صندوق التوصيل", bn: "ডেলিভারি বক্স" },
  { id: "plate", ar: "اللوحة والاستمارة", bn: "প্লেট ও কাগজপত্র" },
];

/* عناصر العهدة (الأدوات والمواد) */
const ASSET_ITEMS = [
  { key: "uniform", ar: "الزي (الملابس)", bn: "ইউনিফর্ম" },
  { key: "shoes", ar: "الحذاء", bn: "জুতা" },
  { key: "vest", ar: "سترة عاكسة", bn: "রিফ্লেক্টিভ ভেস্ট" },
  { key: "helmet", ar: "الخوذة", bn: "হেলমেট" },
  { key: "pump", ar: "المضخة", bn: "পাম্প" },
  { key: "box", ar: "الصندوق", bn: "বক্স" },
  { key: "vacuum", ar: "المكنسة", bn: "ভ্যাকুয়াম" },
  { key: "bucket", ar: "الدلو", bn: "বালতি" },
  { key: "hose", ar: "الخرطوم", bn: "হোস পাইপ" },
  { key: "brush", ar: "الفرشاة", bn: "ব্রাশ" },
  { key: "towels", ar: "المناشف", bn: "তোয়ালে" },
  { key: "cleaners", ar: "مواد التنظيف", bn: "ক্লিনিং সামগ্রী" },
];
const CONDITIONS = [
  { v: "good", ar: "جيدة", bn: "ভালো" },
  { v: "fair", ar: "متوسطة", bn: "মাঝারি" },
  { v: "damaged", ar: "تالفة", bn: "ক্ষতিগ্রস্ত" },
];

function idToEmail(v) {
  const t = (v || "").trim();
  if (/^\d+$/.test(t)) return `biker${t}@dalu.sa`;
  return `biker.${t.toLowerCase()}@dalu.sa`;
}

/* ---------- شاشة الدخول ---------- */
function Login() {
  const [bid, setBid] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    setErr("");
    if (!bid || !pw) { setErr("أدخل رقم البايكر والرقم السري · নম্বর ও পাসওয়ার্ড দিন"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: idToEmail(bid), password: pw });
      if (error) { setErr("رقم البايكر أو الرقم السري غير صحيح · নম্বর বা পাসওয়ার্ড ভুল"); setBusy(false); return; }
    } catch (e) { setErr("تعذّر الدخول · লগইন ব্যর্থ: " + (e.message || e)); setBusy(false); }
  }
  return (
    <div className="bp-wrap"><style>{CSS}</style>
      <div className="bp-card" style={{ maxWidth: 380, marginTop: "8vh" }}>
        <div className="bp-sec" style={{ textAlign: "center", padding: "30px 24px" }}>
          <div className="bp-logo">
            <img src="/brand-mark.png" alt="" onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentNode.append("🪣"); }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#15243a" }}>بوابة البايكر</div>
          <div style={{ fontSize: 12.5, color: "#a8834f", fontWeight: 700, marginTop: 2, marginBottom: 4 }}>বাইকার পোর্টাল — দলু ওয়ারঘওয়া</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>سجّل الدخول برقمك · আপনার নম্বর দিয়ে লগইন করুন</div>

          <label className="bp-lbl" style={{ textAlign: "right" }}>رقم البايكر <span className="bn">/ বাইকার নম্বর</span></label>
          <input className="bp-in" inputMode="text" value={bid} onChange={e => setBid(e.target.value)} placeholder="1624" />
          <label className="bp-lbl" style={{ textAlign: "right" }}>الرقم السري <span className="bn">/ পাসওয়ার্ড</span></label>
          <input className="bp-in" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••"
            onKeyDown={e => { if (e.key === "Enter") go(); }} />
          <button className="bp-btn" onClick={go} disabled={busy}>{busy ? "جارٍ الدخول… · লগইন হচ্ছে…" : "دخول · প্রবেশ"}</button>
          {err && <div className="bp-msg bp-err">{err}</div>}
        </div>
      </div>
    </div>
  );
}

export default function BikerPortal() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { try { sub.subscription.unsubscribe(); } catch (e) {} };
  }, []);
  if (session === undefined) return <div className="bp-wrap"><style>{CSS}</style><div className="bp-card"><div className="bp-sec">جارٍ التحميل… · লোড হচ্ছে…</div></div></div>;
  if (!session) return <Login />;
  return <Portal />;
}

function Portal() {
  const [me, setMe] = useState(null);
  const [myBike, setMyBike] = useState(null);
  const [temp, setTemp] = useState(false);   // حائز مؤقت (بديل)
  const [tab, setTab] = useState("profile");
  const [err, setErr] = useState("");

  useEffect(() => { (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErr("الرجاء تسجيل الدخول · অনুগ্রহ করে লগইন করুন"); return; }
      const { data: au } = await supabase.from("app_users")
        .select("biker_employee_id,display_name,operator_id,position").eq("id", user.id).single();
      if (!au || !au.biker_employee_id) { setErr("هذا الحساب غير مرتبط ببايكر · এই অ্যাকাউন্ট বাইকারের সাথে যুক্ত নয়"); return; }
      const m = { uid: user.id, biker_employee_id: au.biker_employee_id, name: au.display_name, operator_id: au.operator_id };
      // ربط رقم البايكر بمعرّف الموظف (uuid) المستخدم في الأسطول
      const { data: emp } = await supabase.from("employees").select("id,full_name").eq("employee_id", au.biker_employee_id).maybeSingle();
      const empId = emp ? emp.id : null;
      m.emp_id = empId;
      setMe(m);
      if (empId) {
        // الدراجة التي يحوزها هذا البايكر حالياً: إمّا حائز مؤقت، أو مخصّصة له ولا يحوزها أحد مؤقتاً
        const { data: bk } = await supabase.from("fleet_vehicles")
          .select("id,plate,make,biker_employee_id,held_by,held_until,held_reason,needs_receipt_update")
          .eq("active", true)
          .or(`held_by.eq.${empId},and(held_by.is.null,biker_employee_id.eq.${empId})`).limit(1);
        const b = bk && bk[0] ? bk[0] : null;
        setMyBike(b);
        setTemp(!!(b && b.held_by === empId && b.biker_employee_id !== empId));
      }
    } catch (e) { setErr("تعذّر تحميل البيانات · ডেটা লোড ব্যর্থ: " + (e.message || e)); }
  })(); }, []);

  if (err) return <div className="bp-wrap"><style>{CSS}</style><div className="bp-card"><div className="bp-sec"><div className="bp-msg bp-err">{err}</div><button className="bp-btn" onClick={() => supabase.auth.signOut()}>خروج · লগআউট</button></div></div></div>;
  if (!me) return <div className="bp-wrap"><style>{CSS}</style><div className="bp-card"><div className="bp-sec">جارٍ التحميل… · লোড হচ্ছে…</div></div></div>;

  return (
    <div className="bp-wrap">
      <style>{CSS}</style>
      <div className="bp-card">
        <div className="bp-head">
          <div>
            <h1>بوابة البايكر</h1>
            <div className="s">أهلاً {me.name} · স্বাগতম<br />رقمك · আপনার নম্বর: {me.biker_employee_id}</div>
          </div>
          <button className="bp-logout" onClick={() => supabase.auth.signOut()}>خروج<br />লগআউট</button>
        </div>
      </div>

      <div className="bp-prof">
        <div className="bp-pcell"><div className="k">الاسم · নাম</div><div className="v" style={{ fontSize: 13 }}>{me.name || "—"}</div></div>
        <div className="bp-pcell"><div className="k">رقم البايكر · নম্বর</div><div className="v">{me.biker_employee_id}</div></div>
        <div className="bp-pcell"><div className="k">دراجتي · আমার বাইক</div><div className="v" style={{ fontSize: 13 }}>{myBike ? myBike.plate : "—"}</div></div>
      </div>

      {myBike && myBike.needs_receipt_update && (
        <div className="bp-card" style={{ marginBottom: 14 }}>
          <div className="bp-sec" style={{ padding: "12px 16px" }}>
            <div className="bp-msg bp-err" style={{ margin: 0 }}>
              ⚠️ مطلوب تحديث الاستلام: افتح تبويب «الدراجة» وسجّل استلامًا فعليًا بقراءة العدّاد والصور.<br />
              রিসিট আপডেট প্রয়োজন: «বাইক» ট্যাবে গিয়ে প্রকৃত ওডোমিটার ও ছবিসহ গ্রহণ রেকর্ড করুন।
            </div>
          </div>
        </div>
      )}

      {temp && myBike && (
        <div className="bp-card" style={{ marginBottom: 14 }}>
          <div className="bp-sec" style={{ padding: "12px 16px" }}>
            <div className="bp-msg bp-ok" style={{ margin: 0 }}>
              🔁 حيازة مؤقتة: دراجة {myBike.plate} بعهدتك حالياً كبديل{myBike.held_until ? ` حتى ${myBike.held_until}` : ""}.<br />
              অস্থায়ী দায়িত্ব: বাইক {myBike.plate} বর্তমানে আপনার কাছে (বদলি)।
            </div>
          </div>
        </div>
      )}

      <div className="bp-tabs">
        <div className={"bp-tab" + (tab === "profile" ? " on" : "")} onClick={() => setTab("profile")}>ملفي<span className="bn">প্রোফাইল</span></div>
        <div className={"bp-tab" + (tab === "handover" ? " on" : "")} onClick={() => setTab("handover")}>الدراجة<span className="bn">বাইক হস্তান্তর</span></div>
        <div className={"bp-tab" + (tab === "fuel" ? " on" : "")} onClick={() => setTab("fuel")}>الوقود<span className="bn">জ্বালানি</span></div>
        <div className={"bp-tab" + (tab === "assets" ? " on" : "")} onClick={() => setTab("assets")}>العهدة<span className="bn">সরঞ্জাম</span></div>
      </div>

      {tab === "profile" && <Profile me={me} myBike={myBike} onGo={setTab} />}
      {tab === "handover" && <Handover me={me} myBike={myBike} />}
      {tab === "fuel" && <Fuel me={me} myBike={myBike} />}
      {tab === "assets" && <Assets me={me} />}
    </div>
  );
}

/* ================= ملفي ================= */
function Profile({ me, myBike, onGo }) {
  const [ho, setHo] = useState(0);
  const [fl, setFl] = useState(0);
  useEffect(() => { (async () => {
    const { count: c1 } = await supabase.from("bike_handovers").select("id", { count: "exact", head: true });
    const { count: c2 } = await supabase.from("fuel_logs").select("id", { count: "exact", head: true });
    setHo(c1 || 0); setFl(c2 || 0);
  })(); }, []);
  return (
    <div className="bp-card"><div className="bp-sec">
      <label className="bp-lbl">بياناتي <span className="bn">/ আমার তথ্য</span></label>
      <div className="bp-item"><div className="t">الاسم · নাম: {me.name || "—"}</div><div className="m">رقم البايكر · বাইকার নম্বর: {me.biker_employee_id}</div></div>
      <div className="bp-item"><div className="t">الدراجة المخصّصة · নির্ধারিত বাইক: {myBike ? myBike.plate : "غير محدّدة — راجع الإدارة · নির্ধারিত নয়"}</div>{myBike && myBike.make && <div className="m">{myBike.make}</div>}</div>

      <label className="bp-lbl" style={{ marginTop: 14 }}>ملخّص سجلاتي <span className="bn">/ আমার রেকর্ড সারাংশ</span></label>
      <div className="bp-row">
        <div className="bp-pcell"><div className="k">تقارير الدراجة · বাইক রিপোর্ট</div><div className="v">{ho}</div></div>
        <div className="bp-pcell"><div className="k">تعبئات الوقود · রিফুয়েল</div><div className="v">{fl}</div></div>
      </div>

      <label className="bp-lbl" style={{ marginTop: 14 }}>النماذج <span className="bn">/ ফর্মসমূহ</span></label>
      <button className="bp-btn" style={{ marginTop: 6 }} onClick={() => onGo("handover")}>📋 تسليم / استلام الدراجة · বাইক হস্তান্তর / গ্রহণ</button>
      <button className="bp-btn" onClick={() => onGo("fuel")}>⛽ تسجيل تعبئة وقود · জ্বালানি রেকর্ড</button>
      <div className="bp-note">التوثيق المنتظم يحمي حقّك ويوضّح التزامك. · নিয়মিত ডকুমেন্টেশন আপনার অধিকার রক্ষা করে।</div>
    </div></div>
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

/* مربّع تصوير اتجاه واحد */
function PhotoBox({ id, cap, capBn, tag, file, onPick }) {
  return (
    <label className={"bp-pbox" + (file ? " done" : "")} htmlFor={id}>
      {file ? <img src={URL.createObjectURL(file)} alt="" /> : <><div className="em">📷</div><div className="cap">{cap}<span className="bn">{capBn}</span></div></>}
      <span className="tag">{tag}{file ? " ✓" : ""}</span>
      <input id={id} type="file" accept="image/*" capture="environment" onChange={e => onPick((e.target.files || [])[0] || null)} />
    </label>
  );
}

/* رسالة عدم وجود دراجة مخصّصة */
function NoBike() {
  return (
    <div className="bp-card"><div className="bp-sec">
      <div className="bp-msg bp-err">لا توجد دراجة مخصّصة لك حالياً — يرجى مراجعة الإدارة.<br />বর্তমানে কোনো বাইক নির্ধারিত নেই — অনুগ্রহ করে ম্যানেজমেন্টের সাথে যোগাযোগ করুন।</div>
    </div></div>
  );
}

/* ================= تسليم/استلام ================= */
function Handover({ me, myBike }) {
  const [direction, setDirection] = useState("receive");
  const [odometer, setOdometer] = useState("");
  const [checks, setChecks] = useState(() => Object.fromEntries(CHECKLIST.map(c => [c.id, true])));
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [right, setRight] = useState(null);
  const [left, setLeft] = useState(null);
  const [odoPhoto, setOdoPhoto] = useState(null);
  const [damages, setDamages] = useState([]);
  const [notes, setNotes] = useState("");
  const [pledge, setPledge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [recent, setRecent] = useState([]);

  async function loadRecent() {
    const { data } = await supabase.from("bike_handovers")
      .select("id,plate,direction,odometer,created_at").order("created_at", { ascending: false }).limit(8);
    setRecent(data || []);
  }
  useEffect(() => { loadRecent(); }, []);

  if (!myBike) return <NoBike />;

  async function submit() {
    setMsg(null);
    if (!odometer) { setMsg({ t: "err", m: "أدخل قراءة العدّاد · ওডোমিটার লিখুন" }); return; }
    if (!front || !back || !right || !left) { setMsg({ t: "err", m: "التقط صور الاتجاهات الأربعة · চারদিকের ছবি তুলুন" }); return; }
    if (!odoPhoto) { setMsg({ t: "err", m: "أرفق صورة العدّاد · ওডোমিটারের ছবি দিন" }); return; }
    if (!pledge) { setMsg({ t: "err", m: "يجب الموافقة على التعهّد قبل الحفظ · সংরক্ষণের আগে অঙ্গীকারে সম্মতি দিন" }); return; }
    setBusy(true);
    try {
      const bid = me.biker_employee_id;
      const [pf, pb, pr, pl, po] = await Promise.all([
        uploadPhoto(front, "handover-front", bid),
        uploadPhoto(back, "handover-back", bid),
        uploadPhoto(right, "handover-right", bid),
        uploadPhoto(left, "handover-left", bid),
        uploadPhoto(odoPhoto, "handover-odometer", bid),
      ]);
      const dmg = [];
      for (const f of damages) dmg.push(await uploadPhoto(f, "handover-damage", bid));
      const allChecked = CHECKLIST.every(c => checks[c.id]);
      const { error } = await supabase.from("bike_handovers").insert({
        operator_id: me.operator_id, vehicle_id: myBike.id, plate: myBike.plate,
        biker_employee_id: bid, biker_name: me.name, direction,
        odometer: Number(odometer),
        engine_sound_ok: !!checks.engine, items_ok: allChecked,
        checklist: checks,
        photo_front: pf, photo_back: pb, photo_right: pr, photo_left: pl, photo_odometer: po,
        damage_photos: dmg,
        photos: { front: pf, back: pb, right: pr, left: pl, odometer: po, damages: dmg },
        condition_notes: notes || null, pledge_accepted: true, created_by: me.uid,
      });
      if (error) throw error;
      if (direction === "receive") { try { await supabase.from("fleet_vehicles").update({ needs_receipt_update: false }).eq("id", myBike.id); } catch (e) {} }
      setMsg({ t: "ok", m: "تم تسجيل حالة الدراجة بنجاح ✅ · সফলভাবে সংরক্ষিত" });
      setOdometer(""); setNotes(""); setFront(null); setBack(null); setRight(null); setLeft(null); setOdoPhoto(null); setDamages([]); setPledge(false);
      setChecks(Object.fromEntries(CHECKLIST.map(c => [c.id, true])));
      loadRecent();
    } catch (e) { setMsg({ t: "err", m: "خطأ · ত্রুটি: " + (e.message || e) }); }
    setBusy(false);
  }

  return (
    <div className="bp-card"><div className="bp-sec">
      <label className="bp-lbl">الدراجة المخصّصة <span className="bn">/ নির্ধারিত বাইক</span></label>
      <div className="bp-bike"><span className="ic">🏍️</span><div><div className="p">{myBike.plate}</div>{myBike.make && <div className="m">{myBike.make}</div>}</div></div>

      <label className="bp-lbl">نوع العملية <span className="bn">/ অপারেশন ধরন</span></label>
      <div className="bp-seg">
        <button className={direction === "receive" ? "on" : ""} onClick={() => setDirection("receive")}>استلام<span className="bn">গ্রহণ</span></button>
        <button className={direction === "return" ? "on" : ""} onClick={() => setDirection("return")}>تسليم<span className="bn">হস্তান্তর</span></button>
      </div>

      <label className="bp-lbl">قراءة العدّاد (كم) <span className="bp-req">*</span> <span className="bn">/ ওডোমিটার (কিমি)</span></label>
      <input className="bp-in" type="number" inputMode="numeric" value={odometer} onChange={e => setOdometer(e.target.value)} placeholder="14230" />

      <label className="bp-lbl">قائمة التحقق <span className="bn">/ চেকলিস্ট</span></label>
      <div className="bp-chklist">
        {CHECKLIST.map(c => (
          <label className="bp-chk" key={c.id} htmlFor={"ck_" + c.id}>
            <input id={"ck_" + c.id} type="checkbox" checked={!!checks[c.id]} onChange={e => setChecks(s => ({ ...s, [c.id]: e.target.checked }))} />
            <span className="tx">{c.ar} <span className="bn">/ {c.bn}</span></span>
          </label>
        ))}
      </div>

      <label className="bp-lbl">تصوير الدراجة من ٤ اتجاهات <span className="bp-req">*</span> <span className="bn">/ চারদিক থেকে ছবি</span></label>
      <div className="bp-pgrid">
        <PhotoBox id="ph_f" cap="أمامي" capBn="সামনে" tag="أمام" file={front} onPick={setFront} />
        <PhotoBox id="ph_b" cap="خلفي" capBn="পিছনে" tag="خلف" file={back} onPick={setBack} />
        <PhotoBox id="ph_r" cap="يمين" capBn="ডান" tag="يمين" file={right} onPick={setRight} />
        <PhotoBox id="ph_l" cap="يسار" capBn="বাম" tag="يسار" file={left} onPick={setLeft} />
      </div>

      <label className="bp-lbl">صورة العدّاد <span className="bp-req">*</span> <span className="bn">/ ওডোমিটারের ছবি</span></label>
      <div className="bp-pgrid" style={{ gridTemplateColumns: "1fr" }}>
        <PhotoBox id="ph_o" cap="صورة العدّاد" capBn="ওডোমিটার" tag="العداد" file={odoPhoto} onPick={setOdoPhoto} />
      </div>

      <label className="bp-lbl">صور إضافية للأضرار (اختياري) <span className="bn">/ ক্ষতির অতিরিক্ত ছবি</span></label>
      <div className="bp-photo">
        <label htmlFor="dmg">📷 إضافة صور أضرار · ক্ষতির ছবি</label>
        <input id="dmg" type="file" accept="image/*" capture="environment" multiple onChange={e => setDamages(Array.from(e.target.files || []))} />
      </div>
      <div className="bp-thumbs">{damages.map((f, i) => <img key={i} src={URL.createObjectURL(f)} alt="" />)}</div>

      <label className="bp-lbl">ملاحظات الحالة <span className="bn">/ অবস্থার নোট</span></label>
      <textarea className="bp-ta" value={notes} onChange={e => setNotes(e.target.value)} placeholder="أي عطل أو خدش… · কোনো ত্রুটি বা দাগ…" />
      <div className="bp-note">التوثيق الكامل يحمي حقّك عند التسليم والاستلام. · সম্পূর্ণ ডকুমেন্টেশন আপনার অধিকার রক্ষা করে।</div>

      <label className="bp-chk" style={{ marginTop: 14, background: "#fff8f1", border: "1.5px solid #f0b27f", borderRadius: 12, padding: "12px 13px", alignItems: "flex-start" }}>
        <input type="checkbox" checked={pledge} onChange={e => setPledge(e.target.checked)} style={{ marginTop: 2 }} />
        <span className="tx" style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.7 }}>
          أتعهّد بالمحافظة على الدراجة والالتزام بتعليمات المرور، وأتحمّل مسؤولية أي أضرار تنتج عن سوء الاستخدام.
          <span className="bn" style={{ display: "block", margintop: 3 }}>আমি বাইকের যত্ন নেওয়া ও ট্রাফিক নিয়ম মেনে চলার অঙ্গীকার করছি এবং অপব্যবহারজনিত যেকোনো ক্ষতির দায় নিচ্ছি।</span>
        </span>
      </label>

      <button className="bp-btn" onClick={submit} disabled={busy}>{busy ? "جارٍ الحفظ… · সংরক্ষণ হচ্ছে…" : "حفظ التقرير · রিপোর্ট সংরক্ষণ"}</button>
      {msg && <div className={"bp-msg " + (msg.t === "ok" ? "bp-ok" : "bp-err")}>{msg.m}</div>}

      <label className="bp-lbl" style={{ marginTop: 18 }}>آخر سجلاتك <span className="bn">/ সর্বশেষ রেকর্ড</span></label>
      <div className="bp-list">
        {recent.length === 0 ? <div className="bp-note">لا يوجد بعد · এখনও নেই</div> :
          recent.map(r => <div className="bp-item" key={r.id}>
            <div className="t">{r.plate || "—"} · {r.direction === "receive" ? "استلام · গ্রহণ" : "تسليم · হস্তান্তর"} · العدّاد {r.odometer}</div>
            <div className="m">{new Date(r.created_at).toLocaleString("ar")}</div>
          </div>)}
      </div>
    </div></div>
  );
}

/* ================= سجل الوقود ================= */
function Fuel({ me, myBike }) {
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
      .select("id,plate,fuel_type,odometer,amount,fill_at").order("fill_at", { ascending: false }).limit(8);
    setRecent(data || []);
  }
  useEffect(() => { loadRecent(); }, []);

  if (!myBike) return <NoBike />;

  async function submit() {
    setMsg(null);
    if (!odometer) { setMsg({ t: "err", m: "أدخل قراءة العدّاد · ওডোমিটার লিখুন" }); return; }
    if (!amount) { setMsg({ t: "err", m: "أدخل المبلغ · পরিমাণ লিখুন" }); return; }
    if (!odoFile) { setMsg({ t: "err", m: "أرفق صورة العدّاد · ওডোমিটারের ছবি দিন" }); return; }
    if (!recFile) { setMsg({ t: "err", m: "إرفاق الفاتورة إلزامي · রসিদ সংযুক্ত করা আবশ্যক" }); return; }
    setBusy(true);
    try {
      const odoUrl = await uploadPhoto(odoFile, "fuel-odometer", me.biker_employee_id);
      const recUrl = await uploadPhoto(recFile, "fuel-receipt", me.biker_employee_id);
      const { error } = await supabase.from("fuel_logs").insert({
        operator_id: me.operator_id, vehicle_id: myBike.id, plate: myBike.plate,
        biker_employee_id: me.biker_employee_id, biker_name: me.name, fuel_type: fuelType,
        odometer: Number(odometer), amount: Number(amount), liters: liters ? Number(liters) : null,
        odometer_photo_url: odoUrl, receipt_photo_url: recUrl, notes: notes || null, created_by: me.uid,
      });
      if (error) throw error;
      setMsg({ t: "ok", m: "تم تسجيل التعبئة بنجاح ✅ · সফলভাবে সংরক্ষিত" });
      setOdometer(""); setAmount(""); setLiters(""); setOdoFile(null); setRecFile(null); setNotes(""); loadRecent();
    } catch (e) { setMsg({ t: "err", m: "خطأ · ত্রুটি: " + (e.message || e) }); }
    setBusy(false);
  }

  return (
    <div className="bp-card"><div className="bp-sec">
      <label className="bp-lbl">الدراجة المخصّصة <span className="bn">/ নির্ধারিত বাইক</span></label>
      <div className="bp-bike"><span className="ic">🏍️</span><div><div className="p">{myBike.plate}</div>{myBike.make && <div className="m">{myBike.make}</div>}</div></div>

      <label className="bp-lbl">النوع <span className="bn">/ ধরন</span></label>
      <div className="bp-seg">
        <button className={fuelType === "petrol" ? "on" : ""} onClick={() => setFuelType("petrol")}>بنزين<span className="bn">পেট্রল</span></button>
        <button className={fuelType === "oil" ? "on" : ""} onClick={() => setFuelType("oil")}>زيت<span className="bn">অয়েল</span></button>
      </div>

      <div className="bp-row">
        <div><label className="bp-lbl">العدّاد (كم) <span className="bp-req">*</span> <span className="bn">/ ওডোমিটার</span></label>
          <input className="bp-in" type="number" inputMode="numeric" value={odometer} onChange={e => setOdometer(e.target.value)} placeholder="14230" /></div>
        <div><label className="bp-lbl">المبلغ (ريال) <span className="bp-req">*</span> <span className="bn">/ পরিমাণ</span></label>
          <input className="bp-in" type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="50" /></div>
      </div>
      <label className="bp-lbl">اللترات (اختياري) <span className="bn">/ লিটার (ঐচ্ছিক)</span></label>
      <input className="bp-in" type="number" inputMode="decimal" value={liters} onChange={e => setLiters(e.target.value)} placeholder="8.2" />

      <label className="bp-lbl">صورة العدّاد بعد التعبئة <span className="bp-req">*</span> <span className="bn">/ ওডোমিটারের ছবি</span></label>
      <div className="bp-pgrid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <PhotoBox id="f_odo" cap="صورة العدّاد" capBn="ওডোমিটার" tag="العداد" file={odoFile} onPick={setOdoFile} />
        <PhotoBox id="f_rec" cap="صورة الفاتورة" capBn="রসিদ" tag="الفاتورة *" file={recFile} onPick={setRecFile} />
      </div>
      <div className="bp-note">إرفاق الفاتورة إلزامي لاعتماد التعبئة. · রসিদ সংযুক্ত করা আবশ্যক।</div>

      <label className="bp-lbl">ملاحظات (اختياري) <span className="bn">/ নোট</span></label>
      <textarea className="bp-ta" value={notes} onChange={e => setNotes(e.target.value)} placeholder="…" />

      <button className="bp-btn" onClick={submit} disabled={busy}>{busy ? "جارٍ الحفظ… · সংরক্ষণ হচ্ছে…" : "حفظ التعبئة · রিফুয়েল সংরক্ষণ"}</button>
      {msg && <div className={"bp-msg " + (msg.t === "ok" ? "bp-ok" : "bp-err")}>{msg.m}</div>}

      <label className="bp-lbl" style={{ marginTop: 18 }}>سجل تعبئاتك <span className="bn">/ আপনার রিফুয়েল রেকর্ড</span></label>
      <div className="bp-list">
        {recent.length === 0 ? <div className="bp-note">لا يوجد بعد · এখনও নেই</div> :
          recent.map(r => <div className="bp-item" key={r.id}>
            <div className="t">{r.plate || "—"} · {r.fuel_type === "oil" ? "زيت · অয়েল" : "بنزين · পেট্রল"} · {r.amount ? r.amount + "﷼" : "—"} · العدّاد {r.odometer}</div>
            <div className="m">{new Date(r.fill_at).toLocaleString("ar")}</div>
          </div>)}
      </div>
    </div></div>
  );
}

/* ================= العهدة (الأدوات والمواد) ================= */
const condAr = (v) => (CONDITIONS.find(c => c.v === v) || {}).ar || v;
function Assets({ me }) {
  const [rows, setRows] = useState(() => Object.fromEntries(
    ASSET_ITEMS.map(it => [it.key, { present: false, qty: 1, condition: "good" }])
  ));
  const [notes, setNotes] = useState("");
  const [pledge, setPledge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [recent, setRecent] = useState([]);

  async function loadRecent() {
    const { data } = await supabase.from("biker_assets")
      .select("id,items,notes,created_at").order("created_at", { ascending: false }).limit(6);
    setRecent(data || []);
  }
  useEffect(() => { loadRecent(); }, []);

  function setItem(key, patch) { setRows(s => ({ ...s, [key]: { ...s[key], ...patch } })); }

  async function submit() {
    setMsg(null);
    const chosen = ASSET_ITEMS.filter(it => rows[it.key].present);
    if (chosen.length === 0) { setMsg({ t: "err", m: "حدّد العناصر المستلمة أولاً · অন্তত একটি সরঞ্জাম নির্বাচন করুন" }); return; }
    if (!pledge) { setMsg({ t: "err", m: "يجب الموافقة على التعهّد قبل الحفظ · সংরক্ষণের আগে অঙ্গীকারে সম্মতি দিন" }); return; }
    setBusy(true);
    try {
      const items = chosen.map(it => ({
        key: it.key, name_ar: it.ar, name_bn: it.bn,
        qty: Number(rows[it.key].qty) || 1, condition: rows[it.key].condition,
      }));
      const { error } = await supabase.from("biker_assets").insert({
        operator_id: me.operator_id, biker_employee_id: me.biker_employee_id, biker_name: me.name,
        items, pledge_accepted: true, notes: notes || null, status: "declared", created_by: me.uid,
      });
      if (error) throw error;
      setMsg({ t: "ok", m: "تم تسجيل العهدة بنجاح ✅ · সফলভাবে সংরক্ষিত" });
      setRows(Object.fromEntries(ASSET_ITEMS.map(it => [it.key, { present: false, qty: 1, condition: "good" }])));
      setNotes(""); setPledge(false); loadRecent();
    } catch (e) { setMsg({ t: "err", m: "خطأ · ত্রুটি: " + (e.message || e) }); }
    setBusy(false);
  }

  return (
    <div className="bp-card"><div className="bp-sec">
      <label className="bp-lbl">إقرار العهدة — الأدوات والمواد <span className="bn">/ সরঞ্জাম ও উপকরণের ঘোষণা</span></label>
      <div className="bp-note" style={{ marginBottom: 4 }}>حدّد ما استلمته، والكمية، وحالته. · আপনি যা পেয়েছেন, পরিমাণ ও অবস্থা নির্বাচন করুন।</div>

      <div className="bp-chklist">
        {ASSET_ITEMS.map(it => {
          const r = rows[it.key];
          return (
            <div key={it.key} style={{ borderBottom: "1px solid #f4ece0", background: r.present ? "#fff8f1" : "#fffdf9" }}>
              <label className="bp-chk" htmlFor={"as_" + it.key} style={{ borderBottom: "none" }}>
                <input id={"as_" + it.key} type="checkbox" checked={r.present} onChange={e => setItem(it.key, { present: e.target.checked })} />
                <span className="tx">{it.ar} <span className="bn">/ {it.bn}</span></span>
              </label>
              {r.present && (
                <div className="bp-row" style={{ padding: "0 13px 12px", gap: 8 }}>
                  <div style={{ flex: "0 0 34%" }}>
                    <label className="bp-lbl" style={{ margin: "0 0 4px", fontSize: 11.5 }}>الكمية <span className="bn">/ পরিমাণ</span></label>
                    <input className="bp-in" type="number" inputMode="numeric" min="1" value={r.qty}
                      onChange={e => setItem(it.key, { qty: e.target.value })} style={{ padding: "9px 11px" }} />
                  </div>
                  <div>
                    <label className="bp-lbl" style={{ margin: "0 0 4px", fontSize: 11.5 }}>الحالة <span className="bn">/ অবস্থা</span></label>
                    <select className="bp-sel" value={r.condition} onChange={e => setItem(it.key, { condition: e.target.value })} style={{ padding: "9px 11px" }}>
                      {CONDITIONS.map(c => <option key={c.v} value={c.v}>{c.ar} / {c.bn}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <label className="bp-lbl">ملاحظات (اختياري) <span className="bn">/ নোট (ঐচ্ছিক)</span></label>
      <textarea className="bp-ta" value={notes} onChange={e => setNotes(e.target.value)} placeholder="أي تفاصيل عن العهدة… · সরঞ্জাম সম্পর্কে বিস্তারিত…" />

      <label className="bp-chk" style={{ marginTop: 14, background: "#fff8f1", border: "1.5px solid #f0b27f", borderRadius: 12, padding: "12px 13px", alignItems: "flex-start" }}>
        <input type="checkbox" checked={pledge} onChange={e => setPledge(e.target.checked)} style={{ marginTop: 2 }} />
        <span className="tx" style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.7 }}>
          أُقرّ وأتعهّد بأن ما ذكرته أعلاه صحيح، وأنني استلمت هذه العهدة وأتحمّل مسؤوليتها والمحافظة عليها.
          <span className="bn" style={{ display: "block", marginTop: 3 }}>আমি ঘোষণা করছি যে উপরের তথ্য সঠিক, আমি এই সরঞ্জাম বুঝে নিয়েছি এবং এর যত্ন ও দায়িত্ব নিচ্ছি।</span>
        </span>
      </label>

      <button className="bp-btn" onClick={submit} disabled={busy}>{busy ? "جارٍ الحفظ… · সংরক্ষণ হচ্ছে…" : "حفظ إقرار العهدة · ঘোষণা সংরক্ষণ"}</button>
      {msg && <div className={"bp-msg " + (msg.t === "ok" ? "bp-ok" : "bp-err")}>{msg.m}</div>}

      <label className="bp-lbl" style={{ marginTop: 18 }}>آخر إقراراتك <span className="bn">/ সর্বশেষ ঘোষণা</span></label>
      <div className="bp-list">
        {recent.length === 0 ? <div className="bp-note">لا يوجد بعد · এখনও নেই</div> :
          recent.map(r => {
            const its = Array.isArray(r.items) ? r.items : [];
            return (
              <div className="bp-item" key={r.id}>
                <div className="t">{its.length} عنصر · {its.length} টি সরঞ্জাম</div>
                <div className="m">{its.map(x => `${x.name_ar}${x.qty > 1 ? "×" + x.qty : ""} (${condAr(x.condition)})`).join("، ")}</div>
                <div className="m">{new Date(r.created_at).toLocaleString("ar")}</div>
              </div>
            );
          })}
      </div>
    </div></div>
  );
}
