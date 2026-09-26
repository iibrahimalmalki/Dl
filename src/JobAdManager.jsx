import { useState, useEffect } from "react";
import { supabase } from "./supabase";

/*  إعلان التوظيف — لوحة الموارد البشرية
    تحرير محتوى صفحة التوظيف العامة (يقرأها RecruitmentAd من جدول job_ad)
    + فتح/إغلاق التوظيف + مشاركة الرابط العام ومعاينته.
*/

const CSS = `
.ja-wrap{font-family:'Segoe UI',Tahoma,system-ui,sans-serif;direction:rtl;color:#15243a;max-width:820px}
.ja-card{background:#fff;border:1px solid #eceef1;border-radius:16px;padding:18px 20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(16,24,40,.05)}
.ja-card h3{font-size:15px;font-weight:800;color:#CC5200;margin:0 0 4px}
.ja-card .hint{font-size:12px;color:#64748b;margin:0 0 14px;line-height:1.6}
.ja-lbl{font-size:12.5px;font-weight:700;color:#334155;margin:12px 0 5px;display:block}
.ja-in,.ja-ta{width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;background:#fafbfc;box-sizing:border-box}
.ja-in:focus,.ja-ta:focus{outline:none;border-color:#E8712B}
.ja-ta{min-height:56px;resize:vertical;line-height:1.7}
.ja-row{display:flex;gap:12px;flex-wrap:wrap}.ja-row>*{flex:1;min-width:180px}
.ja-switch{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px 15px}
.ja-switch .t{font-size:14px;font-weight:800}
.ja-switch .s{font-size:11.5px;color:#64748b;margin-top:2px}
.ja-toggle{position:relative;width:52px;height:30px;border-radius:20px;background:#cbd5e1;cursor:pointer;transition:.2s;flex-shrink:0;border:none}
.ja-toggle.on{background:#16a34a}
.ja-toggle::after{content:"";position:absolute;top:3px;inset-inline-start:3px;width:24px;height:24px;border-radius:50%;background:#fff;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.ja-toggle.on::after{inset-inline-start:25px}
.ja-ben{display:flex;gap:8px;align-items:center;margin-bottom:8px}
.ja-ben input{padding:9px 10px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:13px;font-family:inherit;background:#fafbfc;box-sizing:border-box}
.ja-ben .ic{width:52px;text-align:center;flex:none}
.ja-ben .bn{flex:1;min-width:0}.ja-ben .ar{flex:1;min-width:0;direction:rtl}
.ja-del{width:32px;height:32px;border:none;border-radius:8px;background:#feecea;color:#b42318;font-size:16px;font-weight:800;cursor:pointer;flex:none}
.ja-add{margin-top:4px;padding:9px 14px;background:#fff4e9;border:1.5px dashed #f0b27f;border-radius:10px;color:#CC5200;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit}
.ja-save{padding:12px 22px;background:linear-gradient(135deg,#E8712B,#CC5200);color:#fff;border:none;border-radius:11px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit}
.ja-save:disabled{opacity:.6}
.ja-msg{margin-top:12px;padding:10px 13px;border-radius:10px;font-size:13px;font-weight:700}
.ja-ok{background:#e9f7ee;color:#1b7a3d}.ja-err{background:#fdeaea;color:#c0392b}
.ja-link{display:flex;gap:8px;align-items:center;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 8px 8px 12px;flex-wrap:wrap}
.ja-link code{flex:1;min-width:160px;font-size:12.5px;color:#334155;direction:ltr;text-align:left;word-break:break-all}
.ja-linkbtns{display:flex;gap:7px;flex-wrap:wrap}
.ja-b{padding:8px 13px;border:none;border-radius:9px;font-weight:800;font-size:12.5px;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px}
.ja-b.copy{background:#15243a;color:#fff}.ja-b.wa{background:#25D366;color:#fff}.ja-b.prev{background:#eef2f7;color:#334155}
`;

const BLANK = {
  active: true, title_bn: "", title_ar: "", subtitle_bn: "", subtitle_ar: "",
  salary_base: 1000, benefits: [], requirements_bn: "", requirements_ar: "",
  closed_bn: "", closed_ar: "",
};

export default function JobAdManager() {
  const [f, setF] = useState(BLANK);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [copied, setCopied] = useState(false);

  const link = (typeof window !== "undefined" ? window.location.origin : "") + "/?apply=1";

  useEffect(() => { (async () => {
    const { data } = await supabase.from("job_ad").select("*").eq("id", "default").maybeSingle();
    if (data) setF({ ...BLANK, ...data, benefits: Array.isArray(data.benefits) ? data.benefits : [] });
    setLoading(false);
  })(); }, []);

  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const setBen = (i, k, v) => setF(s => ({ ...s, benefits: s.benefits.map((b, j) => j === i ? { ...b, [k]: v } : b) }));
  const addBen = () => setF(s => ({ ...s, benefits: [...s.benefits, { ic: "✅", bn: "", ar: "" }] }));
  const delBen = (i) => setF(s => ({ ...s, benefits: s.benefits.filter((_, j) => j !== i) }));

  async function save() {
    setMsg(null); setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        id: "default", active: !!f.active,
        title_bn: f.title_bn || null, title_ar: f.title_ar || null,
        subtitle_bn: f.subtitle_bn || null, subtitle_ar: f.subtitle_ar || null,
        salary_base: Number(f.salary_base) || 1000,
        benefits: (f.benefits || []).filter(b => (b.bn || b.ar || "").trim()),
        requirements_bn: f.requirements_bn || null, requirements_ar: f.requirements_ar || null,
        closed_bn: f.closed_bn || null, closed_ar: f.closed_ar || null,
        updated_at: new Date().toISOString(), updated_by: user ? user.id : null,
      };
      const { error } = await supabase.from("job_ad").upsert(payload, { onConflict: "id" });
      if (error) throw error;
      setMsg({ t: "ok", m: "تم حفظ الإعلان ونشره على الرابط العام ✅" });
    } catch (e) { setMsg({ t: "err", m: "تعذّر الحفظ: " + (e.message || e) }); }
    setBusy(false);
  }

  function copy() {
    try { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (e) {}
  }
  function shareWA() {
    const m = `🪣 وظيفة غسيل سيارات في الرياض · রিয়াদে গাড়ি ধোয়ার চাকরি\n\n👉 قدّم الآن · এখনই আবেদন করুন:\n${link}`;
    window.open("https://wa.me/?text=" + encodeURIComponent(m), "_blank");
  }

  if (loading) return <div className="ja-wrap"><style>{CSS}</style><div className="ja-card">جارٍ التحميل…</div></div>;

  return (
    <div className="ja-wrap">
      <style>{CSS}</style>

      <div className="ja-card">
        <div className="ja-switch">
          <div>
            <div className="t">{f.active ? "🟢 التوظيف مفتوح" : "🔴 التوظيف مغلق"}</div>
            <div className="s">عند الإغلاق يرى المتقدّمون رسالة اعتذار بدل الإعلان.</div>
          </div>
          <button className={"ja-toggle" + (f.active ? " on" : "")} onClick={() => set("active", !f.active)} aria-label="تبديل" />
        </div>
      </div>

      <div className="ja-card">
        <h3>مشاركة رابط التوظيف</h3>
        <p className="hint">هذا هو الرابط العام للإعلان — شاركه في واتساب والمجموعات. لا يحتاج المتقدّم لتسجيل دخول.</p>
        <div className="ja-link">
          <code>{link}</code>
          <div className="ja-linkbtns">
            <button className="ja-b copy" onClick={copy}>{copied ? "✓ نُسخ" : "📋 نسخ"}</button>
            <button className="ja-b wa" onClick={shareWA}>📤 واتساب</button>
            <button className="ja-b prev" onClick={() => window.open(link, "_blank")}>👁️ معاينة</button>
          </div>
        </div>
      </div>

      <div className="ja-card">
        <h3>العنوان الرئيسي</h3>
        <p className="hint">يظهر أعلى صفحة الإعلان. البنغالي هو الأبرز للمتقدّمين.</p>
        <div className="ja-row">
          <div><label className="ja-lbl">العنوان (بنغالي)</label><input className="ja-in" value={f.title_bn} onChange={e => set("title_bn", e.target.value)} placeholder="নতুন জীবনের শুরু…" /></div>
          <div><label className="ja-lbl">العنوان (عربي)</label><input className="ja-in" value={f.title_ar} onChange={e => set("title_ar", e.target.value)} placeholder="بداية حياة جديدة" /></div>
        </div>
        <div className="ja-row">
          <div><label className="ja-lbl">وصف مختصر (بنغالي)</label><input className="ja-in" value={f.subtitle_bn} onChange={e => set("subtitle_bn", e.target.value)} /></div>
          <div><label className="ja-lbl">وصف مختصر (عربي)</label><input className="ja-in" value={f.subtitle_ar} onChange={e => set("subtitle_ar", e.target.value)} /></div>
        </div>
      </div>

      <div className="ja-card">
        <h3>الراتب الأساسي (حاسبة الدخل)</h3>
        <p className="hint">الرقم المستخدم في حاسبة الدخل داخل الإعلان (ريال/شهر).</p>
        <label className="ja-lbl">الراتب الأساسي</label>
        <input className="ja-in" type="number" inputMode="numeric" style={{ maxWidth: 180 }} value={f.salary_base} onChange={e => set("salary_base", e.target.value)} placeholder="1000" />
      </div>

      <div className="ja-card">
        <h3>المزايا</h3>
        <p className="hint">كل ميزة: أيقونة (إيموجي) + نص بنغالي + نص عربي.</p>
        {(f.benefits || []).map((b, i) => (
          <div className="ja-ben" key={i}>
            <input className="ic" value={b.ic || ""} onChange={e => setBen(i, "ic", e.target.value)} placeholder="💰" />
            <input className="bn" value={b.bn || ""} onChange={e => setBen(i, "bn", e.target.value)} placeholder="বাংলা" />
            <input className="ar" value={b.ar || ""} onChange={e => setBen(i, "ar", e.target.value)} placeholder="عربي" />
            <button className="ja-del" onClick={() => delBen(i)} aria-label="حذف">×</button>
          </div>
        ))}
        <button className="ja-add" onClick={addBen}>+ إضافة ميزة</button>
      </div>

      <div className="ja-card">
        <h3>الشروط الأساسية</h3>
        <p className="hint">سطر الشروط الظاهر أسفل زر التقديم.</p>
        <label className="ja-lbl">الشروط (بنغالي)</label>
        <textarea className="ja-ta" value={f.requirements_bn} onChange={e => set("requirements_bn", e.target.value)} />
        <label className="ja-lbl">الشروط (عربي)</label>
        <textarea className="ja-ta" value={f.requirements_ar} onChange={e => set("requirements_ar", e.target.value)} />
      </div>

      <div className="ja-card">
        <h3>رسالة الإغلاق</h3>
        <p className="hint">تظهر للمتقدّمين عندما يكون التوظيف مغلقًا.</p>
        <label className="ja-lbl">رسالة الإغلاق (بنغالي)</label>
        <textarea className="ja-ta" value={f.closed_bn} onChange={e => set("closed_bn", e.target.value)} />
        <label className="ja-lbl">رسالة الإغلاق (عربي)</label>
        <textarea className="ja-ta" value={f.closed_ar} onChange={e => set("closed_ar", e.target.value)} />
      </div>

      <button className="ja-save" onClick={save} disabled={busy}>{busy ? "جارٍ الحفظ…" : "💾 حفظ ونشر"}</button>
      {msg && <div className={"ja-msg " + (msg.t === "ok" ? "ja-ok" : "ja-err")}>{msg.m}</div>}
    </div>
  );
}
