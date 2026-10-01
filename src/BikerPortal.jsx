import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";
import TOOLREFS from "./toolRefs";
import { ThemeToggle, Orbs, useToast } from "./ui";
import { daysLeft, docStatus, docBn, dayText, dayTextBn } from "./renewalsLib";

/*  بوابة البايكر — دلو ورغوة | বাইকার পোর্টাল
    هوية دلو ورغوة (برتقالي) · ثنائية اللغة (عربي + বাংলা)
    شاشات: ملفي · تسليم/استلام الدراجة (٤ اتجاهات + عداد + أضرار + قائمة تحقق) · سجل الوقود (فاتورة إلزامية)
    كل بايكر يرى دراجته المخصّصة وسجلاته فقط (RLS via biker_employee_id).
    الصور تُرفع إلى مخزن field-evidence (عام).
*/

const CSS = `
.bp-wrap{font-family:var(--font);direction:rtl;background:var(--bg);min-height:100dvh;color:var(--ink);padding:66px 10px 70px;position:relative}
.bp-wrap>*:not(.g-orbs):not(.g-corner){position:relative;z-index:1}
.bp-wrap .bn,.bp-wrap :lang(bn){font-family:system-ui,-apple-system,'Noto Sans Bengali','Segoe UI',sans-serif}
.bp-card{max-width:560px;margin:0 auto 14px;border-radius:18px;overflow:hidden}
.bp-head{background:linear-gradient(135deg,var(--a),var(--p));color:#fff;padding:18px 18px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.bp-head h1{font-size:19px;font-weight:900;margin:0}
.bp-head .s{font-size:12.5px;font-weight:600;margin-top:4px;line-height:1.5}
.bp-logout{background:rgba(255,255,255,.18);color:#fff;border:1px solid rgba(255,255,255,.45);border-radius:11px;padding:7px 14px;min-height:44px;min-width:44px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit;flex-shrink:0;line-height:1.4}
.bp-prof{max-width:560px;margin:0 auto 14px;display:flex;gap:10px}
.bp-pcell{flex:1;background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:14px;padding:12px 10px;text-align:center;box-shadow:var(--shadow)}
.bp-pcell .k{font-size:10.5px;color:var(--mut);font-weight:700}
.bp-pcell .v{font-size:15px;font-weight:900;color:var(--ink);margin-top:3px}
.bp-tabs{display:flex;gap:6px;max-width:560px;margin:0 auto 14px;padding:5px;border-radius:16px;background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);box-shadow:var(--shadow)}
.bp-tab{flex:1;min-height:48px;padding:8px 4px;text-align:center;border-radius:12px;background:transparent;border:1px solid transparent;font-weight:800;font-size:12.5px;cursor:pointer;color:var(--mut);line-height:1.45;font-family:inherit}
.bp-tab .bn{display:block;font-size:10px;font-weight:600}
.bp-tab.on{background:linear-gradient(135deg,var(--a),var(--p));color:#fff;box-shadow:0 6px 16px -8px rgba(var(--p-rgb),.8)}
.bp-tab:focus-visible,.bp-seg button:focus-visible,.bp-btn:focus-visible,.bp-logout:focus-visible{outline:none;box-shadow:var(--glow)}
.bp-sec{padding:16px 18px}
.bp-lbl{font-size:13px;font-weight:800;color:var(--ink-2);margin:14px 0 6px;display:block}
.bp-lbl .bn{font-weight:600;color:var(--mut);font-size:11px}
.bp-req{color:var(--bad-ink);font-weight:900}
.bp-in,.bp-sel,.bp-ta{min-height:46px;padding:11px 13px;font-size:15px}
.bp-ta{min-height:72px;resize:vertical}
.bp-bike{display:flex;align-items:center;gap:10px;background:var(--p-50);border:1px solid rgba(var(--p-rgb),.35);border-radius:12px;padding:12px 14px}
.bp-bike .ic{font-size:24px}
.bp-bike .p{font-weight:900;font-size:16px;color:var(--p-700)}
.bp-bike .m{font-size:11.5px;color:var(--mut)}
:root[data-theme=dark] .bp-bike .p{color:var(--p)}
.bp-row{display:flex;gap:10px}.bp-row>*{flex:1}
.bp-seg{display:flex;gap:8px}
.bp-seg button{flex:1;min-height:48px;padding:9px 6px;border-radius:11px;border:1px solid var(--line-2);background:var(--glass-2);font-weight:800;font-size:13px;cursor:pointer;color:var(--mut);font-family:inherit;line-height:1.4}
.bp-seg button .bn{display:block;font-size:10.5px;font-weight:600}
.bp-seg button.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.bp-chklist{border:1px solid var(--line-2);border-radius:12px;overflow:hidden;margin-top:6px}
.bp-chk{display:flex;align-items:center;gap:10px;min-height:48px;box-sizing:border-box;padding:11px 13px;font-size:13.5px;font-weight:700;color:var(--ink-2);border-bottom:1px solid var(--line);background:var(--glass-2)}
.bp-chk:last-child{border-bottom:none}
.bp-chk input{width:22px;height:22px;accent-color:var(--ok);flex-shrink:0}
.bp-chk .bn{font-weight:600;color:var(--mut);font-size:11px}
.bp-chk .tx{flex:1}
.bp-chk.pledge{margin-top:14px;background:var(--p-50);border:1px solid rgba(var(--p-rgb),.35);border-radius:12px;padding:12px 13px;align-items:flex-start}
.bp-pgrid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:6px}
.bp-pbox{border:1.5px dashed rgba(var(--p-rgb),.5);border-radius:12px;background:var(--p-50);overflow:hidden;position:relative;min-height:96px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;text-align:center}
.bp-pbox input{display:none}
.bp-pbox .cap{font-size:12px;font-weight:800;color:var(--p-700);padding:6px}
.bp-pbox .cap .bn{display:block;font-size:10px;font-weight:600;color:var(--mut)}
:root[data-theme=dark] .bp-pbox .cap,:root[data-theme=dark] .bp-photo label,:root[data-theme=dark] .bp-acap{color:var(--p)}
.bp-pbox .em{font-size:22px;margin-top:6px}
.bp-pbox.done{border-style:solid;border-color:var(--ok)}
.bp-pbox img{width:100%;height:96px;object-fit:cover;display:block}
.bp-pbox .tag{position:absolute;top:5px;inset-inline-start:5px;background:rgba(10,14,39,.75);color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:20px}
.bp-photo{margin-top:6px}
.bp-photo input{display:none}
.bp-photo label{display:inline-flex;align-items:center;gap:7px;min-height:46px;box-sizing:border-box;padding:11px 15px;background:var(--p-50);border:1.5px dashed rgba(var(--p-rgb),.5);border-radius:11px;color:var(--p-700);font-weight:800;font-size:13px;cursor:pointer}
.bp-thumbs{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.bp-thumbs img{width:66px;height:66px;object-fit:cover;border-radius:10px;border:1px solid var(--line-2)}
.bp-btn{width:100%;min-height:50px;margin-top:18px;padding:14px;background:linear-gradient(135deg,var(--a),var(--p));color:#fff;border:none;border-radius:12px;font-weight:900;font-size:15px;cursor:pointer;font-family:inherit;box-shadow:0 8px 20px -10px rgba(var(--p-rgb),.9)}
.bp-btn:disabled{opacity:.6}
.bp-msg{margin-top:12px;padding:11px 13px;border-radius:11px;font-size:13px;font-weight:700}
.bp-ok{background:var(--ok-bg);color:var(--ok-ink)}.bp-err{background:var(--bad-bg);color:var(--bad-ink)}
.bp-list{margin-top:6px}
.bp-item{border:1px solid var(--line);border-radius:11px;padding:10px 12px;margin-bottom:7px;font-size:12.5px;background:var(--glass-2)}
.bp-item .t{font-weight:800;color:var(--ink);display:flex;align-items:center;gap:8px;flex-wrap:wrap}.bp-item .m{color:var(--mut);font-size:11.5px;margin-top:2px}
.bp-item .t .g-badge{margin-inline-start:auto}
.bp-note{font-size:11.5px;color:var(--mut);margin-top:6px;line-height:1.6}
.bp-logo{width:60px;height:60px;border-radius:16px;background:linear-gradient(135deg,var(--a),var(--p));display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:30px;box-shadow:0 8px 20px rgba(var(--p-rgb),.32);overflow:hidden}
.bp-logo img{width:70%;height:70%;object-fit:contain}
.bp-aitem{border-bottom:1px solid var(--line);background:var(--glass-2)}.bp-aitem:last-child{border-bottom:none}
.bp-aitem.on{background:var(--p-50)}
.bp-arow{display:flex;align-items:center;gap:10px;min-height:48px;padding:10px 13px;cursor:pointer}
.bp-arow input[type=checkbox]{width:22px;height:22px;accent-color:var(--ok);flex:none}
.bp-arow .tx{flex:1;font-size:13.5px;font-weight:700;color:var(--ink-2)}
.bp-arow .tx .bn{font-weight:600;color:var(--mut);font-size:11px}
.bp-aref{width:46px;height:46px;border-radius:10px;object-fit:cover;border:1px solid var(--line-2);flex:none;background:#fff}
.bp-aref.ph{display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--mut-2);background:var(--soft)}
.bp-acap{display:inline-flex;align-items:center;gap:8px;min-height:44px;box-sizing:border-box;padding:9px 13px;background:var(--p-50);border:1.5px dashed rgba(var(--p-rgb),.5);border-radius:11px;color:var(--p-700);font-weight:800;font-size:12.5px;cursor:pointer}
.bp-acap input{display:none}
.bp-athumb{width:40px;height:40px;border-radius:8px;object-fit:cover;border:1px solid var(--line-2)}
.bp-done{color:var(--ok-ink)}
.bp-doc{border:1px solid var(--line);border-radius:14px;padding:12px 13px;margin-bottom:9px;background:var(--glass-2)}
.bp-doc-h{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px}
.bp-doc-h .t{font-weight:900;font-size:15px;color:var(--ink)}.bp-doc-h .bn{font-size:12px;color:var(--mut);font-weight:600}
.bp-dbadge{flex-direction:column;gap:1px;border-radius:12px;padding:5px 11px;flex:none;line-height:1.3}
.bp-dbadge b{font-weight:800}.bp-doc-h .bp-dbadge .bn{color:inherit;font-size:11px;font-weight:600}
.bp-doc .m{font-size:12.5px;color:var(--mut)}.bp-doc .m b{color:var(--ink);direction:ltr;unicode-bidi:isolate}
.bp-btn.bp-call{margin-top:10px;min-height:46px;padding:11px;font-size:14px}
.bp-ntf.un{border-color:rgba(var(--p-rgb),.45);background:var(--p-50)}
`;

/* قائمة التحقق الأساسية للدراجة (أفضل الممارسات) */
/* خلفية الكرات + زر الثيم في الزاوية — مرة واحدة في جذر كل شاشة */
const Chrome = () => <><Orbs /><div className="g-corner"><ThemeToggle /></div></>;

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

/* عناصر العهدة (الأدوات والمواد) — مطابقة لملف الأدوات، مع صورة مرجعية لكل صنف */
const ASSET_ITEMS = [
  // السلامة والملابس
  { key: "uniform", ar: "الزي (ملابس العمل)", bn: "ইউনিফর্ম", img: null },
  { key: "helmet", ar: "الخوذة", bn: "হেলমেট", img: "helmet" },
  { key: "safety_chest", ar: "واقي الصدر", bn: "বুকের সুরক্ষা", img: "safety_chest" },
  { key: "safety_limbs", ar: "واقيات اليدين والساقين", bn: "হাত ও পায়ের সুরক্ষা", img: "safety_limbs" },
  { key: "shoes", ar: "حذاء السلامة", bn: "নিরাপত্তা জুতা", img: "shoes" },
  { key: "headlight", ar: "كشّاف الرأس", bn: "হেডলাইট", img: "headlight" },
  // نظام الماء
  { key: "water_tank", ar: "خزان الماء", bn: "পানির ট্যাংক", img: null },
  { key: "water_motor", ar: "موتور/مضخة الماء", bn: "ওয়াটার মোটর", img: "water_motor" },
  { key: "water_gun", ar: "مسدس الماء", bn: "ওয়াটার গান", img: "water_gun" },
  // الفرش
  { key: "floor_brush", ar: "فرشاة الأرضية", bn: "ফ্লোর ব্রাশ", img: "floor_brush" },
  { key: "tyre_brush", ar: "فرشاة الإطارات", bn: "টায়ার ব্রাশ", img: "tyre_brush" },
  { key: "small_brush", ar: "فرشاة صغيرة", bn: "ছোট ব্রাশ", img: "small_brush" },
  { key: "ac_brush", ar: "فرشاة المكيّف", bn: "এসি ব্রাশ", img: "ac_brush" },
  // الإسفنج
  { key: "sponge_body", ar: "إسفنجة البودي", bn: "বডি স্পঞ্জ", img: "sponge_body" },
  { key: "sponge_tyre", ar: "إسفنجة الإطارات", bn: "টায়ার স্পঞ্জ", img: "sponge_tyre" },
  // المكنسة
  { key: "vacuum", ar: "المكنسة الكهربائية", bn: "ভ্যাকুয়াম ক্লিনার", img: "vacuum" },
  // المناشف
  { key: "towel_body", ar: "منشفة البودي (زرقاء)", bn: "বডি তোয়ালে (নীল)", img: "towel_body" },
  { key: "towel_dashboard", ar: "منشفة التابلوه (خضراء)", bn: "ড্যাশবোর্ড তোয়ালে (সবুজ)", img: "towel_dashboard" },
  { key: "towel_glass", ar: "منشفة الزجاج (صفراء)", bn: "গ্লাস তোয়ালে (হলুদ)", img: "towel_glass" },
  { key: "towel_tyre", ar: "منشفة الإطارات", bn: "টায়ার তোয়ালে", img: "towel_tyre" },
  // مواد التنظيف والتلميع
  { key: "dashboard_polish", ar: "ملمّع التابلوه", bn: "ড্যাশবোর্ড পলিশ", img: "dashboard_polish" },
  { key: "tyre_polish", ar: "ملمّع الإطارات", bn: "টায়ার পলিশ", img: "tyre_polish" },
  { key: "stain_remover", ar: "مزيل البقع", bn: "স্টেন রিমুভার", img: "stain_remover" },
  { key: "last_touch", ar: "اللمسة الأخيرة", bn: "লাস্ট টাচ", img: "last_touch" },
  { key: "glass_cleaner", ar: "منظّف الزجاج", bn: "গ্লাস ক্লিনার", img: "glass_cleaner" },
  // إضافات
  { key: "service_box", ar: "صندوق الخدمة الإضافي", bn: "সার্ভিস বক্স", img: "service_box" },
  { key: "soap_bottle", ar: "عبوة الصابون الفارغة", bn: "সাবানের বোতল", img: "soap_bottle" },
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
    <div className="bp-wrap"><style>{CSS}</style><Chrome />
      <div className="bp-card g-card" style={{ maxWidth: 380, marginTop: "8vh" }}>
        <div className="bp-sec" style={{ textAlign: "center", padding: "30px 24px" }}>
          <div className="bp-logo">
            <img src="/brand-mark.png" alt="" onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentNode.append("🪣"); }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)" }}>بوابة البايكر</div>
          <div className="bn" style={{ fontSize: 12.5, color: "var(--mut)", fontWeight: 700, marginTop: 2, marginBottom: 4 }}>বাইকার পোর্টাল — দলু ওয়ারঘওয়া</div>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 6 }}>سجّل الدخول برقمك · আপনার নম্বর দিয়ে লগইন করুন</div>

          <label className="bp-lbl" style={{ textAlign: "right" }}>رقم البايكر <span className="bn">/ বাইকার নম্বর</span></label>
          <input className="g-input bp-in" inputMode="text" value={bid} onChange={e => setBid(e.target.value)} placeholder="1624" />
          <label className="bp-lbl" style={{ textAlign: "right" }}>الرقم السري <span className="bn">/ পাসওয়ার্ড</span></label>
          <input className="g-input bp-in" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••"
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
  if (session === undefined) return <div className="bp-wrap"><style>{CSS}</style><Chrome /><div className="bp-card g-card"><div className="bp-sec" style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--mut)" }}><div className="g-spin" />جارٍ التحميل… · <span className="bn">লোড হচ্ছে…</span></div></div></div>;
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

  if (err) return <div className="bp-wrap"><style>{CSS}</style><Chrome /><div className="bp-card g-card"><div className="bp-sec"><div className="bp-msg bp-err">{err}</div><button className="bp-btn" onClick={() => supabase.auth.signOut()}>خروج · লগআউট</button></div></div></div>;
  if (!me) return <div className="bp-wrap"><style>{CSS}</style><Chrome /><div className="bp-card g-card"><div className="bp-sec" style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--mut)" }}><div className="g-spin" />جارٍ التحميل… · <span className="bn">লোড হচ্ছে…</span></div></div></div>;

  return (
    <div className="bp-wrap">
      <style>{CSS}</style><Chrome />
      <div className="bp-card g-card">
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
        <div className="bp-card g-card" style={{ marginBottom: 14 }}>
          <div className="bp-sec" style={{ padding: "12px 16px" }}>
            <div className="bp-msg bp-err" style={{ margin: 0 }}>
              <span className="g-badge warn" style={{ marginBottom: 6 }}><i />مطلوب · <span className="bn">প্রয়োজন</span></span><br />
              ⚠️ مطلوب تحديث الاستلام: افتح تبويب «الدراجة» وسجّل استلامًا فعليًا بقراءة العدّاد والصور.<br />
              রিসিট আপডেট প্রয়োজন: «বাইক» ট্যাবে গিয়ে প্রকৃত ওডোমিটার ও ছবিসহ গ্রহণ রেকর্ড করুন।
            </div>
          </div>
        </div>
      )}

      {temp && myBike && (
        <div className="bp-card g-card" style={{ marginBottom: 14 }}>
          <div className="bp-sec" style={{ padding: "12px 16px" }}>
            <div className="bp-msg bp-ok" style={{ margin: 0 }}>
              🔁 حيازة مؤقتة: دراجة {myBike.plate} بعهدتك حالياً كبديل{myBike.held_until ? ` حتى ${myBike.held_until}` : ""}.<br />
              অস্থায়ী দায়িত্ব: বাইক {myBike.plate} বর্তমানে আপনার কাছে (বদলি)।
            </div>
          </div>
        </div>
      )}

      <div className="bp-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "profile"} className={"bp-tab" + (tab === "profile" ? " on" : "")} onClick={() => setTab("profile")}>ملفي<span className="bn">প্রোফাইল</span></button>
        <button type="button" role="tab" aria-selected={tab === "handover"} className={"bp-tab" + (tab === "handover" ? " on" : "")} onClick={() => setTab("handover")}>الدراجة<span className="bn">বাইক হস্তান্তর</span></button>
        <button type="button" role="tab" aria-selected={tab === "fuel"} className={"bp-tab" + (tab === "fuel" ? " on" : "")} onClick={() => setTab("fuel")}>الوقود<span className="bn">জ্বালানি</span></button>
        <button type="button" role="tab" aria-selected={tab === "docs"} className={"bp-tab" + (tab === "docs" ? " on" : "")} onClick={() => setTab("docs")}>وثائقي<span className="bn">আমার কাগজপত্র</span></button>
        <button type="button" role="tab" aria-selected={tab === "assets"} className={"bp-tab" + (tab === "assets" ? " on" : "")} onClick={() => setTab("assets")}>العهدة<span className="bn">সরঞ্জাম</span></button>
      </div>

      {tab === "profile" && <Profile me={me} myBike={myBike} onGo={setTab} />}
      {tab === "handover" && <Handover me={me} myBike={myBike} />}
      {tab === "fuel" && <Fuel me={me} myBike={myBike} />}
      {tab === "assets" && <Assets me={me} />}
      {tab === "docs" && <Docs me={me} />}
    </div>
  );
}

/* ================= وثائقي ================= */
const ADMIN_WA = "966566884419";
function Docs({ me }) {
  const [docs, setDocs] = useState(null);
  const [notes, setNotes] = useState([]);
  const [reads, setReads] = useState({});
  useEffect(() => { (async () => {
    // RLS (renewal_docs_self_sel) يعيد وثائق هذا البايكر فقط
    const { data } = await supabase.from("renewal_docs")
      .select("id,doc_type,subject,end_date,ref_no,active").eq("active", true).order("end_date", { ascending: true });
    setDocs((data || []).map(d => ({ ...d, _d: daysLeft(d.end_date) })));
    // آخر 5 إشعارات وثائق خاصة بالبايكر
    const { data: ns } = await supabase.from("notifications").select("id,title,body,severity,created_at,entity_id")
      .eq("category", "renewals").eq("audience", "user").eq("user_id", me.uid)
      .order("created_at", { ascending: false }).limit(5);
    const list = ns || [];
    setNotes(list);
    if (list.length) {
      // نفس آلية Notifications.jsx: notification_reads(notification_id,user_id,read_at)
      const { data: rd } = await supabase.from("notification_reads").select("notification_id,read_at")
        .eq("user_id", me.uid).in("notification_id", list.map(n => n.id));
      const m = {}; (rd || []).forEach(x => { if (x.read_at) m[x.notification_id] = x.read_at; });
      setReads(m);
      const un = list.filter(n => !m[n.id]);
      if (un.length) {
        const ts = new Date().toISOString();
        try { await supabase.from("notification_reads").upsert(un.map(n => ({ notification_id: n.id, user_id: me.uid, read_at: ts })), { onConflict: "notification_id,user_id" }); } catch (e) {}
      }
    }
  })(); }, [me.uid]);
  const callAdmin = d => {
    const txt = `السلام عليكم، أنا ${me.name || ""} (رقم ${me.biker_employee_id}). وثيقة ${d.doc_type} تنتهي ${d.end_date || ""} — أحتاج المساعدة في التجديد.\nআমার ${docBn(d.doc_type)} ${d.end_date || ""} তারিখে শেষ হবে — নবায়নে সাহায্য প্রয়োজন।`;
    window.open("https://wa.me/" + ADMIN_WA + "?text=" + encodeURIComponent(txt), "_blank");
  };
  const fmt = d => d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB") : "—";
  return (
    <div className="bp-docs">
      {notes.length > 0 && <div className="bp-card g-card"><div className="bp-sec">
        <label className="bp-lbl" style={{ marginTop: 0 }}>تنبيهات وثائقي <span className="bn">/ কাগজপত্রের নোটিশ</span></label>
        {notes.map(n => <div className={"bp-item bp-ntf" + (reads[n.id] ? "" : " un")} key={n.id}>
          <div className="t"><span className={"g-badge " + (n.severity === "crit" ? "bad" : n.severity === "warn" ? "warn" : "info")}><i />{n.severity === "crit" ? "عاجل · জরুরি" : "تنبيه · সতর্কতা"}</span>{n.title}</div>
          {n.body && <div className="m" style={{ whiteSpace: "pre-line" }}>{n.body}</div>}
          <div className="m">{new Date(n.created_at).toLocaleString("ar")}</div>
        </div>)}
      </div></div>}
      <div className="bp-card g-card"><div className="bp-sec">
        <label className="bp-lbl" style={{ marginTop: 0 }}>وثائقي <span className="bn">/ আমার কাগজপত্র</span></label>
        {docs === null ? <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--mut)" }}><div className="g-spin" />جارٍ التحميل… · <span className="bn">লোড হচ্ছে…</span></div>
        : docs.length === 0 ? <div className="g-empty" style={{ padding: "18px 10px" }}><b>لا وثائق مسجّلة · <span className="bn">কোনো কাগজপত্র নেই</span></b></div>
        : docs.map(d => { const st = docStatus(d._d); return (
          <div className="bp-doc" key={d.id}>
            <div className="bp-doc-h">
              <div><div className="t">{d.doc_type}</div><div className="bn">{docBn(d.doc_type)}</div></div>
              <span className={"g-badge bp-dbadge " + st.tone}><b>{dayText(d._d)}</b><span className="bn">{dayTextBn(d._d)}</span></span>
            </div>
            <div className="m">تاريخ الانتهاء · <span className="bn">মেয়াদ শেষ</span>: <b>{fmt(d.end_date)}</b>{d.ref_no ? " · " + d.ref_no : ""}</div>
            {d._d != null && d._d <= 14 && <button className="bp-btn bp-call" onClick={() => callAdmin(d)}>📞 اتصال بالإدارة · <span className="bn">অফিসে যোগাযোগ</span></button>}
          </div>); })}
      </div></div>
    </div>
  );
}

/* حالة الإقرار: مُرسل (declared) ← مُراجع (reviewed/approved/confirmed) */
function StatusBadge({ s }) {
  if (!s) return null;
  const rev = ["reviewed", "approved", "confirmed", "accepted"].includes(s);
  return rev ? <span className="g-badge ok"><i />مُراجع · <span className="bn">পর্যালোচিত</span></span>
    : s === "rejected" ? <span className="g-badge bad"><i />مرفوض · <span className="bn">প্রত্যাখ্যাত</span></span>
    : <span className="g-badge info"><i />مُرسل · <span className="bn">জমা দেওয়া</span></span>;
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
    <div className="bp-card g-card"><div className="bp-sec">
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
    <div className="bp-card g-card"><div className="bp-sec">
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
  const toast = useToast();
  const [msg, setMsgRaw] = useState(null);
  // رسائل النجاح → Toast؛ الأخطاء تبقى في الصفحة
  const setMsg = m => { if (m && m.t === "ok") { toast.ok(m.m); setMsgRaw(null); } else setMsgRaw(m); };
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
    <div className="bp-card g-card"><div className="bp-sec">
      <label className="bp-lbl">الدراجة المخصّصة <span className="bn">/ নির্ধারিত বাইক</span></label>
      <div className="bp-bike"><span className="ic">🏍️</span><div><div className="p">{myBike.plate}</div>{myBike.make && <div className="m">{myBike.make}</div>}</div></div>

      <label className="bp-lbl">نوع العملية <span className="bn">/ অপারেশন ধরন</span></label>
      <div className="bp-seg">
        <button className={direction === "receive" ? "on" : ""} onClick={() => setDirection("receive")}>استلام<span className="bn">গ্রহণ</span></button>
        <button className={direction === "return" ? "on" : ""} onClick={() => setDirection("return")}>تسليم<span className="bn">হস্তান্তর</span></button>
      </div>

      <label className="bp-lbl">قراءة العدّاد (كم) <span className="bp-req">*</span> <span className="bn">/ ওডোমিটার (কিমি)</span></label>
      <input className="g-input bp-in" type="number" inputMode="numeric" value={odometer} onChange={e => setOdometer(e.target.value)} placeholder="14230" />

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
      <textarea className="g-textarea bp-ta" value={notes} onChange={e => setNotes(e.target.value)} placeholder="أي عطل أو خدش… · কোনো ত্রুটি বা দাগ…" />
      <div className="bp-note">التوثيق الكامل يحمي حقّك عند التسليم والاستلام. · সম্পূর্ণ ডকুমেন্টেশন আপনার অধিকার রক্ষা করে।</div>

      <label className="bp-chk pledge">
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
        {recent.length === 0 ? <div className="g-empty" style={{ padding: "18px 10px" }}><b>لا يوجد بعد · <span className="bn">এখনও নেই</span></b></div> :
          recent.map(r => <div className="bp-item" key={r.id}>
            <div className="t">{r.plate || "—"} · {r.direction === "receive" ? "استلام · গ্রহণ" : "تسليم · হস্তান্তর"} · العدّاد {r.odometer}<span className="g-badge info"><i />مُرسل · <span className="bn">জমা দেওয়া</span></span></div>
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
  const toast = useToast();
  const [msg, setMsgRaw] = useState(null);
  // رسائل النجاح → Toast؛ الأخطاء تبقى في الصفحة
  const setMsg = m => { if (m && m.t === "ok") { toast.ok(m.m); setMsgRaw(null); } else setMsgRaw(m); };
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
    <div className="bp-card g-card"><div className="bp-sec">
      <label className="bp-lbl">الدراجة المخصّصة <span className="bn">/ নির্ধারিত বাইক</span></label>
      <div className="bp-bike"><span className="ic">🏍️</span><div><div className="p">{myBike.plate}</div>{myBike.make && <div className="m">{myBike.make}</div>}</div></div>

      <label className="bp-lbl">النوع <span className="bn">/ ধরন</span></label>
      <div className="bp-seg">
        <button className={fuelType === "petrol" ? "on" : ""} onClick={() => setFuelType("petrol")}>بنزين<span className="bn">পেট্রল</span></button>
        <button className={fuelType === "oil" ? "on" : ""} onClick={() => setFuelType("oil")}>زيت<span className="bn">অয়েল</span></button>
      </div>

      <div className="bp-row">
        <div><label className="bp-lbl">العدّاد (كم) <span className="bp-req">*</span> <span className="bn">/ ওডোমিটার</span></label>
          <input className="g-input bp-in" type="number" inputMode="numeric" value={odometer} onChange={e => setOdometer(e.target.value)} placeholder="14230" /></div>
        <div><label className="bp-lbl">المبلغ (ريال) <span className="bp-req">*</span> <span className="bn">/ পরিমাণ</span></label>
          <input className="g-input bp-in" type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="50" /></div>
      </div>
      <label className="bp-lbl">اللترات (اختياري) <span className="bn">/ লিটার (ঐচ্ছিক)</span></label>
      <input className="g-input bp-in" type="number" inputMode="decimal" value={liters} onChange={e => setLiters(e.target.value)} placeholder="8.2" />

      <label className="bp-lbl">صورة العدّاد بعد التعبئة <span className="bp-req">*</span> <span className="bn">/ ওডোমিটারের ছবি</span></label>
      <div className="bp-pgrid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <PhotoBox id="f_odo" cap="صورة العدّاد" capBn="ওডোমিটার" tag="العداد" file={odoFile} onPick={setOdoFile} />
        <PhotoBox id="f_rec" cap="صورة الفاتورة" capBn="রসিদ" tag="الفاتورة *" file={recFile} onPick={setRecFile} />
      </div>
      <div className="bp-note">إرفاق الفاتورة إلزامي لاعتماد التعبئة. · রসিদ সংযুক্ত করা আবশ্যক।</div>

      <label className="bp-lbl">ملاحظات (اختياري) <span className="bn">/ নোট</span></label>
      <textarea className="g-textarea bp-ta" value={notes} onChange={e => setNotes(e.target.value)} placeholder="…" />

      <button className="bp-btn" onClick={submit} disabled={busy}>{busy ? "جارٍ الحفظ… · সংরক্ষণ হচ্ছে…" : "حفظ التعبئة · রিফুয়েল সংরক্ষণ"}</button>
      {msg && <div className={"bp-msg " + (msg.t === "ok" ? "bp-ok" : "bp-err")}>{msg.m}</div>}

      <label className="bp-lbl" style={{ marginTop: 18 }}>سجل تعبئاتك <span className="bn">/ আপনার রিফুয়েল রেকর্ড</span></label>
      <div className="bp-list">
        {recent.length === 0 ? <div className="g-empty" style={{ padding: "18px 10px" }}><b>لا يوجد بعد · <span className="bn">এখনও নেই</span></b></div> :
          recent.map(r => <div className="bp-item" key={r.id}>
            <div className="t">{r.plate || "—"} · {r.fuel_type === "oil" ? "زيت · অয়েল" : "بنزين · পেট্রল"} · {r.amount ? r.amount + "﷼" : "—"} · العدّاد {r.odometer}<span className="g-badge info"><i />مُرسل · <span className="bn">জমা দেওয়া</span></span></div>
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
    ASSET_ITEMS.map(it => [it.key, { present: false, qty: 1, condition: "good", photo: null }])
  ));
  const [notes, setNotes] = useState("");
  const [pledge, setPledge] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const [msg, setMsgRaw] = useState(null);
  // رسائل النجاح → Toast؛ الأخطاء تبقى في الصفحة
  const setMsg = m => { if (m && m.t === "ok") { toast.ok(m.m); setMsgRaw(null); } else setMsgRaw(m); };
  const [recent, setRecent] = useState([]);

  async function loadRecent() {
    const { data } = await supabase.from("biker_assets")
      .select("id,items,notes,status,created_at").order("created_at", { ascending: false }).limit(6);
    setRecent(data || []);
  }
  useEffect(() => { loadRecent(); }, []);

  function setItem(key, patch) { setRows(s => ({ ...s, [key]: { ...s[key], ...patch } })); }
  const reset = () => setRows(Object.fromEntries(ASSET_ITEMS.map(it => [it.key, { present: false, qty: 1, condition: "good", photo: null }])));

  async function submit() {
    setMsg(null);
    const chosen = ASSET_ITEMS.filter(it => rows[it.key].present);
    if (chosen.length === 0) { setMsg({ t: "err", m: "حدّد العناصر المستلمة أولاً · অন্তত একটি সরঞ্জাম নির্বাচন করুন" }); return; }
    if (!pledge) { setMsg({ t: "err", m: "يجب الموافقة على التعهّد قبل الحفظ · সংরক্ষণের আগে অঙ্গীকারে সম্মতি দিন" }); return; }
    setBusy(true);
    try {
      const bid = me.biker_employee_id;
      const items = [];
      for (const it of chosen) {
        const r = rows[it.key];
        let photoUrl = null;
        if (r.photo) { try { photoUrl = await uploadPhoto(r.photo, "asset-" + it.key, bid); } catch (e) {} }
        items.push({ key: it.key, name_ar: it.ar, name_bn: it.bn, qty: Number(r.qty) || 1, condition: r.condition, photo: photoUrl });
      }
      const { error } = await supabase.from("biker_assets").insert({
        operator_id: me.operator_id, biker_employee_id: bid, biker_name: me.name,
        items, pledge_accepted: true, notes: notes || null, status: "declared", created_by: me.uid,
      });
      if (error) throw error;
      setMsg({ t: "ok", m: "تم تسجيل العهدة بنجاح ✅ · সফলভাবে সংরক্ষিত" });
      reset(); setNotes(""); setPledge(false); loadRecent();
    } catch (e) { setMsg({ t: "err", m: "خطأ · ত্রুটি: " + (e.message || e) }); }
    setBusy(false);
  }

  return (
    <div className="bp-card g-card"><div className="bp-sec">
      <label className="bp-lbl">إقرار العهدة — الأدوات والمواد <span className="bn">/ সরঞ্জাম ও উপকরণের ঘোষণা</span></label>
      <div className="bp-note" style={{ marginBottom: 4 }}>حدّد ما استلمته، والكمية، وحالته، وصوّر الصنف. · আপনি যা পেয়েছেন তা নির্বাচন করুন, পরিমাণ ও অবস্থা দিন এবং ছবি তুলুন।</div>

      <div className="bp-chklist">
        {ASSET_ITEMS.map(it => {
          const r = rows[it.key];
          const ref = it.img ? TOOLREFS[it.img] : null;
          return (
            <div className={"bp-aitem" + (r.present ? " on" : "")} key={it.key}>
              <label className="bp-arow" htmlFor={"as_" + it.key}>
                {ref ? <img className="bp-aref" src={ref} alt="" /> : <div className="bp-aref ph">🧰</div>}
                <input id={"as_" + it.key} type="checkbox" checked={r.present} onChange={e => setItem(it.key, { present: e.target.checked })} />
                <span className="tx">{it.ar} <span className="bn">/ {it.bn}</span></span>
              </label>
              {r.present && (
                <div style={{ padding: "0 13px 12px" }}>
                  <div className="bp-row" style={{ gap: 8 }}>
                    <div style={{ flex: "0 0 32%" }}>
                      <label className="bp-lbl" style={{ margin: "0 0 4px", fontSize: 11.5 }}>الكمية <span className="bn">/ পরিমাণ</span></label>
                      <input className="g-input bp-in" type="number" inputMode="numeric" min="1" value={r.qty}
                        onChange={e => setItem(it.key, { qty: e.target.value })} style={{ padding: "9px 11px" }} />
                    </div>
                    <div>
                      <label className="bp-lbl" style={{ margin: "0 0 4px", fontSize: 11.5 }}>الحالة <span className="bn">/ অবস্থা</span></label>
                      <select className="g-select bp-sel" value={r.condition} onChange={e => setItem(it.key, { condition: e.target.value })} style={{ padding: "9px 11px" }}>
                        {CONDITIONS.map(c => <option key={c.v} value={c.v}>{c.ar} / {c.bn}</option>)}
                      </select>
                    </div>
                  </div>
                  <label className="bp-lbl" style={{ margin: "8px 0 4px", fontSize: 11.5 }}>صورة الصنف (اختياري) <span className="bn">/ ছবি (ঐচ্ছিক)</span></label>
                  <label className="bp-acap" htmlFor={"asph_" + it.key}>
                    {r.photo ? <img className="bp-athumb" src={URL.createObjectURL(r.photo)} alt="" /> : <>📷 تصوير الصنف · ছবি তুলুন</>}
                    {r.photo && <span className="bp-done">✓ تم · হয়েছে</span>}
                    <input id={"asph_" + it.key} type="file" accept="image/*" capture="environment"
                      onChange={e => setItem(it.key, { photo: (e.target.files || [])[0] || null })} />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <label className="bp-lbl">ملاحظات (اختياري) <span className="bn">/ নোট (ঐচ্ছিক)</span></label>
      <textarea className="g-textarea bp-ta" value={notes} onChange={e => setNotes(e.target.value)} placeholder="أي تفاصيل عن العهدة… · সরঞ্জাম সম্পর্কে বিস্তারিত…" />

      <label className="bp-chk pledge">
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
        {recent.length === 0 ? <div className="g-empty" style={{ padding: "18px 10px" }}><b>لا يوجد بعد · <span className="bn">এখনও নেই</span></b></div> :
          recent.map(r => {
            const its = Array.isArray(r.items) ? r.items : [];
            return (
              <div className="bp-item" key={r.id}>
                <div className="t">{its.length} عنصر · {its.length} টি সরঞ্জাম<StatusBadge s={r.status} /></div>
                <div className="m">{its.map(x => `${x.name_ar}${x.qty > 1 ? "×" + x.qty : ""} (${condAr(x.condition)})`).join("، ")}</div>
                <div className="m">{new Date(r.created_at).toLocaleString("ar")}</div>
              </div>
            );
          })}
      </div>
    </div></div>
  );
}
