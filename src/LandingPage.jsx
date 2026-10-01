// صفحة الهبوط — دلو ورغوة | بوابة الدخول الموحّدة
// نظام دخول كامل: البايكرز يدخلون بوابتهم، والموظفون/الإدارة يدخلون المنصّة.
// (التوظيف لم يعد عامًّا هنا — يُدار من لوحة الموارد البشرية «إعلان التوظيف».)

import { ThemeToggle, Orbs } from "./ui";

const CSS = `
.lp-wrap{min-height:100dvh;background:var(--bg);display:flex;align-items:center;justify-content:center;font-family:var(--font);position:relative;overflow:hidden;direction:rtl;color:var(--ink)}
@keyframes lp-fade{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes lp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.lp-card{position:relative;z-index:2;width:100%;max-width:440px;padding:72px 24px 44px;text-align:center;animation:lp-fade .6s ease both}
.lp-logo{width:98px;height:98px;margin:0 auto 18px;border-radius:26px;background:linear-gradient(135deg,var(--a),var(--p));display:flex;align-items:center;justify-content:center;box-shadow:0 12px 30px rgba(var(--p-rgb),.38);animation:lp-float 5s ease-in-out infinite;overflow:hidden}
.lp-logo img{width:70%;height:70%;object-fit:contain}
.lp-logo span{font-size:46px}
.lp-title{color:var(--ink);font-size:27px;font-weight:900;letter-spacing:-.5px;margin-bottom:3px}
.lp-sub{color:var(--p-700);font-size:13.5px;font-weight:700;margin-bottom:3px}
:root[data-theme=dark] .lp-sub{color:var(--p)}
.lp-sub2{color:var(--mut);font-size:12px;margin-bottom:30px;font-family:system-ui,-apple-system,'Noto Sans Bengali',sans-serif}
.lp-grid{display:flex;flex-direction:column;gap:13px}
.lp-btn{display:flex;align-items:center;gap:15px;background:var(--glass-2);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:20px;padding:18px;min-height:92px;cursor:pointer;width:100%;text-align:right;transition:transform .18s,box-shadow .18s,border-color .18s;box-shadow:var(--shadow);font-family:inherit;color:var(--ink)}
.lp-btn:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg)}
.lp-btn:active{transform:translateY(-1px)}
.lp-btn:focus-visible{outline:none;box-shadow:var(--glow)}
.lp-ic{flex-shrink:0;width:56px;height:56px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:27px}
.lp-txt{flex:1;min-width:0}
.lp-txt b{display:block;color:var(--ink);font-size:17px;font-weight:900;margin-bottom:2px}
.lp-txt span{display:block;color:var(--mut);font-size:12px;line-height:1.5}
.lp-arrow{flex-shrink:0;font-size:20px;font-weight:900;transition:transform .18s}
.lp-btn:hover .lp-arrow{transform:translateX(-5px)}
.lp-biker{border-color:rgba(var(--p-rgb),.35)}.lp-biker .lp-ic{background:var(--p-100);color:var(--p)}.lp-biker .lp-arrow{color:var(--p)}
.lp-staff{border-color:var(--line-2);background:linear-gradient(135deg,color-mix(in srgb,var(--navy) 80%,white),var(--navy))}
.lp-staff .lp-ic{background:rgba(255,255,255,.12);color:#fff}
.lp-staff .lp-txt b{color:#fff}.lp-staff .lp-txt span{color:rgba(255,255,255,.72)}
.lp-staff .lp-arrow{color:#fff}
.lp-foot{margin-top:28px;color:var(--mut);font-size:11.5px;line-height:1.7}
.lp-foot b{color:var(--ink-2);font-weight:800}
`;

export default function LandingPage({ onBiker, onLogin }) {
  return (
    <div className="lp-wrap">
      <style>{CSS}</style>
      <Orbs />
      <div className="g-corner"><ThemeToggle /></div>

      <div className="lp-card">
        <div className="lp-logo">
          <img src="/brand-mark.png" alt="دلو ورغوة" onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentNode.querySelector('span').style.display = "block"; }} />
          <span style={{ display: "none" }}>🪣</span>
        </div>
        <div className="lp-title">دلو ورغوة</div>
        <div className="lp-sub">منصّة إدارة العمليات · غسيل السيارات المتنقّل</div>
        <div className="lp-sub2">দলু ওয়ারঘওয়া — অপারেশন ম্যানেজমেন্ট প্ল্যাটফর্ম</div>

        <div className="lp-grid">
          <button className="lp-btn lp-biker" onClick={onBiker}>
            <div className="lp-ic">🏍️</div>
            <div className="lp-txt"><b>دخول البايكرز</b><span>ملفك ونماذج الدراجة والوقود والعهدة · বাইকার লগইন</span></div>
            <div className="lp-arrow">←</div>
          </button>

          <button className="lp-btn lp-staff" onClick={onLogin}>
            <div className="lp-ic">🔐</div>
            <div className="lp-txt"><b>دخول الموظفين والإدارة</b><span>المنصّة وملفك الوظيفي · কর্মী ও ব্যবস্থাপনা লগইন</span></div>
            <div className="lp-arrow">←</div>
          </button>
        </div>

        <div className="lp-foot">
          مؤسسة دلو ورغوة التجارية · شريك تشغيل <b>سويتر</b><br />
          جميع الحقوق محفوظة © 2026
        </div>
      </div>
    </div>
  );
}
