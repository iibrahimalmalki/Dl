// صفحة الهبوط — دلو ورغوة | بوابة الدخول الموحّدة
// نظام دخول كامل: البايكرز يدخلون بوابتهم، والموظفون/الإدارة يدخلون المنصّة.
// (التوظيف لم يعد عامًّا هنا — يُدار من لوحة الموارد البشرية «إعلان التوظيف».)

const CSS = `
@keyframes lp-fade{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes lp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.lp-wrap{min-height:100dvh;background:linear-gradient(160deg,#FFF9F0,#FFF3DC 55%,#FFE7C9);display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',Tahoma,sans-serif;position:relative;overflow:hidden;direction:rtl}
.lp-blob{position:fixed;border-radius:50%;pointer-events:none;filter:blur(2px)}
.lp-card{position:relative;z-index:2;width:100%;max-width:440px;padding:44px 24px;text-align:center;animation:lp-fade .6s ease both}
.lp-logo{width:98px;height:98px;margin:0 auto 18px;border-radius:26px;background:linear-gradient(135deg,#E8712B,#f5a35f);display:flex;align-items:center;justify-content:center;box-shadow:0 12px 30px rgba(232,113,43,.38);animation:lp-float 5s ease-in-out infinite;overflow:hidden}
.lp-logo img{width:70%;height:70%;object-fit:contain}
.lp-logo span{font-size:46px}
.lp-title{color:#15243a;font-size:27px;font-weight:900;letter-spacing:-.5px;margin-bottom:3px}
.lp-sub{color:#b07d3f;font-size:13.5px;font-weight:600;margin-bottom:3px}
.lp-sub2{color:#9aa7b4;font-size:11.5px;margin-bottom:30px}
.lp-grid{display:flex;flex-direction:column;gap:13px}
.lp-btn{display:flex;align-items:center;gap:15px;background:rgba(255,255,255,.94);backdrop-filter:blur(6px);border:2px solid transparent;border-radius:20px;padding:18px;cursor:pointer;width:100%;text-align:right;transition:transform .18s,box-shadow .18s,border-color .18s;box-shadow:0 6px 22px rgba(20,36,58,.07);font-family:inherit}
.lp-btn:hover{transform:translateY(-3px);box-shadow:0 14px 34px rgba(20,36,58,.13)}
.lp-btn:active{transform:translateY(-1px)}
.lp-ic{flex-shrink:0;width:56px;height:56px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:27px}
.lp-txt{flex:1;min-width:0}
.lp-txt b{display:block;color:#15243a;font-size:17px;font-weight:900;margin-bottom:2px}
.lp-txt span{display:block;color:#8a97a4;font-size:11.5px;line-height:1.5}
.lp-arrow{flex-shrink:0;font-size:20px;font-weight:900;transition:transform .18s}
.lp-btn:hover .lp-arrow{transform:translateX(-5px)}
.lp-biker{border-color:#fed7aa}.lp-biker .lp-ic{background:#fff1e4;color:#E8712B}.lp-biker .lp-arrow{color:#E8712B}
.lp-staff{border-color:#c7d2fe;background:linear-gradient(135deg,#1e293b,#0f172a)}
.lp-staff .lp-ic{background:rgba(255,255,255,.12);color:#fff}
.lp-staff .lp-txt b{color:#fff}.lp-staff .lp-txt span{color:#94a3b8}
.lp-staff .lp-arrow{color:#fff}
.lp-foot{margin-top:28px;color:#b0a189;font-size:11px;line-height:1.7}
.lp-foot b{color:#8a7350;font-weight:800}
`;

export default function LandingPage({ onBiker, onLogin }) {
  return (
    <div className="lp-wrap">
      <style>{CSS}</style>
      <div className="lp-blob" style={{ top: -110, insetInlineStart: -90, width: 340, height: 340, background: "radial-gradient(circle,rgba(232,113,43,.16),transparent 70%)" }} />
      <div className="lp-blob" style={{ bottom: -120, insetInlineEnd: -100, width: 360, height: 360, background: "radial-gradient(circle,rgba(46,125,50,.12),transparent 70%)" }} />

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
