import{useMemo,useState}from"react";
import Icon from"./Icon";
import{DISTRICTS,DISTRICT_LIST,calcGeoScore,ZONE_COLORS}from"./geoScoring";

const TEAM=new Set(["كيشوريغانج","ماداريبور","باريسال"]);

const CRITERIA=[
  {k:"M1",w:23,mul:2.3,ic:"globe",ar:"شبكة الهجرة إلى السعودية",src:"BMET 2024–2025",rev:false,
   desc:"حجم تدفّق الهجرة المسجّل من المقاطعة نحو السعودية خلال 2024–2025.",
   why:"الهجرة العالية = شبكة اجتماعية معرفة بالعمل في السعودية = وثائق أسهل وتكيّف أسرع.",
   bands:[["10","أكثر من 40,000 مهاجر/سنة — أعلى 10 مقاطعات وطنياً"],["8–9","20,000–40,000 مهاجر/سنة"],["6–7","10,000–20,000 مهاجر/سنة"],["4–5","5,000–10,000 مهاجر/سنة"],["1–3","أقل من 5,000 أو لا بيانات"]]},
  {k:"M2",w:18,mul:1.8,ic:"pin",ar:"التوافق المناخي والجسدي",src:"BBS + بيانات مناخية",rev:false,
   desc:"توافق مناخ المنطقة الأصلية مع العمل الميداني في الرياض (حرارة، رطوبة، وقوف مطوّل).",
   why:"من نشأ في سهول حارّة رطبة جسده متكيّف حرارياً؛ أبناء الجبال الباردة يعانون ضربات الشمس.",
   bands:[["10","سهول حارّة رطبة — دلتا الغانج (باريسال، ماداريبور، تشاندبور، كيشوريغانج)"],["8–9","سهول حارّة — شمال وسط بنغلادش"],["6–7","معتدل إلى دافئ — مناطق وسطى"],["3–5","جبال معتدلة — تلال شيتاغونغ"],["1–2","جبال عالية باردة — CHT الداخلية"]]},
  {k:"M3",w:18,mul:1.8,ic:"wrench",ar:"ثقافة العمل الميداني",src:"BIDS + ADB + IFPRI",rev:false,
   desc:"انتشار ثقافة العمل الجسدي الشاق وقيادة الدراجة في البيئة المحلية.",
   why:"من يعمل في الأرض 10 ساعات يومياً منذ الطفولة يرى جدول عمل الرياض راحة.",
   bands:[["10","زراعة مكثّفة + صيد — العمل الجسدي أسلوب حياة يومي"],["8–9","زراعي مختلط — عمل يدوي موسمي غالب"],["6–7","تجاري/زراعي متوازن"],["4–5","تجاري غالب — ثقافة مكاتب ومحلات"],["1–3","جبلي/بدائل — لا ثقافة عمل ميداني مستمر"]]},
  {k:"M4",w:14,mul:1.4,ic:"alert",ar:"سلامة صحية",src:"WHO + DGHS",rev:true,excl:true,
   desc:"انخفاض الأمراض التي تُسبب رفض الفحص الطبي (Wafid): السل، HIV، الكبد B/C، الزُهري، الملاريا.",
   why:"معيار عكسي — كلما قلّ انتشار أمراض Wafid ارتفعت الدرجة ونسبة اجتياز الفحص.",
   bands:[["10","منخفض جداً — لا ملاريا، سل ضمن المعدل الوطني"],["8–9","منخفض — يمرّ فحص Wafid بنسبة عالية"],["6–7","متوسط — يستوجب فحصاً مشدداً"],["3–5","مرتفع — ملاريا أو سل فوق المعدل"],["1–2","خطر مرتفع جداً — CHT: ملاريا 35%+، سل 791/100k"]]},
  {k:"M5",w:9,mul:0.9,ic:"lock",ar:"سلامة أمنية",src:"ACLED + تقارير أمنية",rev:true,excl:true,
   desc:"انخفاض المخاطر الأمنية المؤثرة على استقرار الموظف أو المؤدية لسجل جنائي.",
   why:"معيار عكسي — قرب ممرات المخدرات/التوترات العرقية يخفض الدرجة. السعودية نفّذت 122 حكم إعدام تهريب في 2024 (75% أجانب).",
   bands:[["10","مستقر تماماً — لا نزاعات ولا ممرات تهريب"],["8–9","مستقر نسبياً — حوادث فردية معزولة"],["6–7","مخاوف متوسطة — توترات سياسية موسمية"],["3–5","مرتفعة — قرب ممرات مخدرات أو توترات عرقية"],["1–2","خطر مرتفع جداً — CHT: نزاع مسلح، ممر يابا"]]},
  {k:"M6",w:9,mul:0.9,ic:"star",ar:"عوامل الاستقرار الشخصي",src:"BBS + NIPORT",rev:false,
   desc:"عوامل تزيد ثبات الموظف والتزامه: الدين (مسلم)، الإعالة، التعليم الأساسي، انخفاض التعاطي.",
   why:"يُطبَّق على مستوى المنطقة كمؤشر تدعيم؛ القرار الفردي يبقى على المتقدّم نفسه لا على أصله.",
   bands:[["10","الأربعة عوامل مجتمعة"],["8–9","3 من 4 عوامل"],["6–7","عاملان"],["4–5","عامل واحد"],["1–3","لا عوامل استقرار"]]},
  {k:"M7",w:9,mul:0.9,ic:"bike",ar:"سوق الدراجات النارية",src:"newbikebd + motorcyclevalley 2026",rev:false,support:true,
   desc:"كثافة وكالات الدراجات في المقاطعة كمؤشر على انتشار القيادة اليومية.",
   why:"الوكالة لا تُفتح إلا حيث طلب كافٍ — عدد الوكالات = مؤشر الاستخدام الفعلي. مؤشر مساند لا يُرفض منفرداً.",
   bands:[["10","4+ وكالات رسمية (كيشوريغانج 4، باريسال 5)"],["9","3 وكالات (تشاندبور)"],["8","2 وكالات (ماداريبور، فيني، كوميلا)"],["6","1 وكالة (ناريسينغدي، نواخالي، تانغيل)"],["1","0 وكالة (رانغاماتي)"]]},
];

const DEALERS=[
  ["باريسال",5,"Ratul Auto-Yamaha ×2 + Max Motors-Honda + Bangladesh Motors-Honda + Karmo Unnayan"],
  ["كيشوريغانج",4,"Honda Bitan + Anik Honda + Shahanaz Motors + Yamaha (Sadar)"],
  ["تشاندبور",3,"Fahad Honda + Chand Auto + Mobarok Motors"],
  ["كوميلا","2+","Biker's Gallery-Yamaha + Samia Auto-Honda (+ غير مدرجة)"],
  ["ماداريبور",2,"Goura Motors-Yamaha + Padma Motors-Honda"],
  ["فيني",2,"Modina Motors-Yamaha + Gold Wing-Honda"],
  ["ناريسينغدي","1+","Jom Jom Motors-Yamaha"],
  ["براهمانباريا","1+","Khan Sons-Honda (Stadium Market)"],
  ["نواخالي",1,"Abrar Motors-Yamaha"],
  ["تانغيل",1,"M/S Mamun Motors-Yamaha"],
  ["رانغاماتي",0,"لا وكالة مدرجة في أي موقع"],
];

const MCOLS=["M1","M2","M3","M4","M5","M6","M7"];

export default function Sourcing(){
  const[open,setOpen]=useState("M1");
  const rows=useMemo(()=>DISTRICT_LIST.map(name=>{
    const r=calcGeoScore(name);return{name,en:DISTRICTS[name]?.en,...r};
  }).sort((a,b)=>b.score-a.score),[]);
  const kpis=useMemo(()=>{
    const g=rows.filter(r=>r.zone==="green").length;
    const y=rows.filter(r=>r.zone==="yellow").length;
    const rd=rows.filter(r=>r.zone==="red").length;
    return{g,y,rd,total:rows.length};
  },[rows]);

  return(<div className="sc">
    <style>{CSS}</style>

    <div className="sc-hero">
      <div className="sc-hero-ic"><Icon n="globe" s={26}/></div>
      <div style={{flex:1}}><h2>معايير الاستقطاب البنغلاديشي</h2><p>7 معايير موزونة · 100 نقطة · نظام v2.0 — يونيو 2026. تُحسب الدرجات والمناطق آلياً من المحرّك المعتمد في استمارة التقديم.</p></div>
    </div>

    <div className="sc-note"><Icon n="alert" s={13}/> نموذج <b>استقطاب إقليمي</b>: يوجّه <b>أين</b> نبحث اعتماداً على شبكات الهجرة وكثافة الدراجات والمناخ ومتطلبات Wafid — القرار الفردي يبقى على المتقدّم نفسه لا على منطقته.</div>

    {/* مؤشرات */}
    <div className="sc-kpis">
      <div className="sc-kpi"><span className="sc-ki" style={{background:"#f0fdf4",color:"#16a34a"}}><Icon n="checkCircle" s={17}/></span><div><div className="sc-kv">{kpis.g}</div><div className="sc-kl">مناطق خضراء</div></div></div>
      <div className="sc-kpi"><span className="sc-ki" style={{background:"#fffbeb",color:"#d97706"}}><Icon n="alert" s={17}/></span><div><div className="sc-kv">{kpis.y}</div><div className="sc-kl">صفراء — بشروط</div></div></div>
      <div className="sc-kpi"><span className="sc-ki" style={{background:"#fff5f5",color:"#dc2626"}}><Icon n="xCircle" s={17}/></span><div><div className="sc-kv">{kpis.rd}</div><div className="sc-kl">محظورة</div></div></div>
      <div className="sc-kpi"><span className="sc-ki" style={{background:"#eef2ff",color:"#4f46e5"}}><Icon n="pin" s={17}/></span><div><div className="sc-kv">{kpis.total}</div><div className="sc-kl">مناطق مُقيّمة</div></div></div>
    </div>

    {/* ترتيب المناطق */}
    <div className="sc-panel">
      <div className="sc-ph"><b><Icon n="chart" s={15}/> ترتيب المناطق</b><span>محسوب آلياً · مرتّب تنازلياً</span></div>
      <div className="sc-tblwrap">
        <table className="sc-tbl">
          <thead><tr><th>#</th><th>المنطقة</th>{MCOLS.map(m=><th key={m} className="sc-mh">{m}</th>)}<th>النقاط</th><th>المنطقة</th></tr></thead>
          <tbody>{rows.map((r,i)=>{const z=ZONE_COLORS[r.zone];return(
            <tr key={r.name} className={r.instant_reject?"sc-rej":""}>
              <td className="sc-rank">{i+1}</td>
              <td><div className="sc-dn">{r.name}{TEAM.has(r.name)&&<span className="sc-team" title="منطقة فريقنا الحالي">✦</span>}<small>{r.en}</small></div></td>
              {MCOLS.map(m=>{const v=r.d[m];const low=(m==="M4"||m==="M5")&&v<5;return<td key={m} className={"sc-mc"+(low?" low":"")}>{v}</td>;})}
              <td className="sc-score">{r.score}</td>
              <td><span className="sc-zone" style={{background:z.bg,color:z.text,borderColor:z.border}}>{r.zone==="green"?"خضراء":r.zone==="yellow"?"صفراء":"محظورة"}</span></td>
            </tr>);})}</tbody>
        </table>
      </div>
      <div className="sc-legendrow">
        <span className="sc-lg"><i className="d green"/> 78+ استقطاب مباشر</span>
        <span className="sc-lg"><i className="d yellow"/> 58–77 مقبول بشروط</span>
        <span className="sc-lg"><i className="d red"/> أقل من 58 أو إقصاء فوري</span>
        <span className="sc-lg">✦ منطقة فريقنا الحالي</span>
      </div>
    </div>

    {/* قواعد الإقصاء */}
    <div className="sc-excl">
      <div className="sc-excl-h"><Icon n="xCircle" s={15}/> قواعد الإقصاء الفوري</div>
      <div className="sc-excl-b">
        <div className="sc-ex"><b>M4 &lt; 5</b><span>رفض فوري — خطر صحي (رفض Wafid مؤكد)</span></div>
        <div className="sc-ex"><b>M5 &lt; 5</b><span>رفض فوري — خطر أمني (تورّط في جرائم أو مخدرات)</span></div>
        <div className="sc-ex support"><b>M7 = 0</b><span>مؤشر إقصاء مساند فقط — لا يُرفض منفرداً</span></div>
      </div>
    </div>

    {/* المعايير السبعة */}
    <div className="sc-ph2"><Icon n="ruler" s={16}/> المعايير السبعة وأوزانها</div>
    {CRITERIA.map(c=>{const on=open===c.k;return(
      <div className="sc-crit" key={c.k}>
        <div className="sc-crit-h" onClick={()=>setOpen(on?"":c.k)}>
          <span className="sc-crit-ic"><Icon n={c.ic} s={16}/></span>
          <div className="sc-crit-t"><b>{c.k} — {c.ar}</b><small>{c.src}</small></div>
          {c.rev&&<span className="sc-tagr">عكسي</span>}
          {c.excl&&<span className="sc-tage">إقصاء</span>}
          {c.support&&<span className="sc-tags">مساند</span>}
          <span className="sc-crit-w">{c.w}%</span>
          <span className={"sc-chev"+(on?" up":"")}><Icon n="fwd" s={14}/></span>
        </div>
        <div className="sc-wbar"><div style={{width:(c.w/23*100)+"%"}}/></div>
        {on&&<div className="sc-crit-b">
          <p className="sc-desc">{c.desc}</p>
          <div className="sc-bands">{c.bands.map(([pt,txt],i)=>(
            <div className="sc-band" key={i}><span className="sc-band-pt">{pt}</span><span className="sc-band-tx">{txt}</span></div>))}</div>
          <div className="sc-why"><Icon n="robot" s={13}/> {c.why}</div>
        </div>}
      </div>);})}

    {/* وكالات الدراجات */}
    <div className="sc-ph2" style={{marginTop:18}}><Icon n="bike" s={16}/> وكالات الدراجات — تفصيل M7</div>
    <div className="sc-panel">
      <div className="sc-tblwrap">
        <table className="sc-tbl sc-deal">
          <thead><tr><th>المنطقة</th><th>عدد الوكالات</th><th>الوكالات الموثّقة</th></tr></thead>
          <tbody>{DEALERS.map((d,i)=>(
            <tr key={i} className={d[1]===0?"sc-rej":""}>
              <td><b>{d[0]}</b></td>
              <td className="sc-dealn">{d[1]}</td>
              <td className="sc-dealt">{d[2]}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <div className="sc-src">المصدر: newbikebd.com/sales-point · motorcyclevalley.com · motorcyclebd.com — بيانات وكالات 2026. BRTA لا تنشر توزيع التسجيل حسب المقاطعة، لذا يُعتمد عدد الوكالات كمؤشر مساند.</div>
    </div>
  </div>);
}

const CSS=`
.sc{--b:#E8712B}
.sc-hero{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid #eceef1;border-radius:16px;padding:18px;margin-bottom:12px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.sc-hero-ic{width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#fff2e8,#ffe2cc);color:var(--b);display:flex;align-items:center;justify-content:center;flex:none}
.sc-hero h2{font-size:17px;margin:0 0 4px}.sc-hero p{color:#64748b;font-size:12.5px;margin:0;line-height:1.6}
.sc-note{display:flex;align-items:flex-start;gap:8px;background:#eef4ff;border:1px solid #d5e3fb;color:#1d5bbf;font-size:12px;font-weight:600;border-radius:12px;padding:10px 13px;margin-bottom:14px;line-height:1.7}
.sc-note b{font-weight:800}
.sc-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
.sc-kpi{background:#fff;border:1px solid #eceef1;border-radius:15px;padding:13px;display:flex;align-items:center;gap:11px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.sc-ki{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.sc-kv{font-size:20px;font-weight:800;letter-spacing:-.5px}.sc-kl{font-size:11px;color:#64748b;font-weight:600}
.sc-panel{background:#fff;border:1px solid #eceef1;border-radius:16px;box-shadow:0 1px 2px rgba(16,24,40,.05);margin-bottom:14px;overflow:hidden}
.sc-ph{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #f1f3f5}
.sc-ph b{font-size:14px;font-weight:800;display:inline-flex;align-items:center;gap:8px}
.sc-ph span{font-size:11px;color:#94a3b8}
.sc-tblwrap{overflow-x:auto}
.sc-tbl{width:100%;border-collapse:collapse;min-width:640px}
.sc-tbl th{font-size:10.5px;color:#64748b;font-weight:700;text-align:right;padding:9px 10px;border-bottom:1px solid #eceef1;background:#fafbfc;white-space:nowrap}
.sc-tbl td{padding:9px 10px;border-bottom:1px solid #f4f5f7;font-size:12.5px}
.sc-tbl tr:last-child td{border-bottom:none}
.sc-mh{text-align:center}
.sc-rank{color:#94a3b8;font-weight:800;width:26px}
.sc-dn{font-size:12.5px;font-weight:800;color:#0f172a;white-space:nowrap}.sc-dn small{color:#94a3b8;font-weight:600;margin-inline-start:6px;font-size:10.5px}
.sc-team{color:#E8712B;margin-inline-start:5px}
.sc-mc{text-align:center;font-weight:700;color:#475569}
.sc-mc.low{color:#dc2626;background:#fff5f5;font-weight:800;border-radius:6px}
.sc-score{font-weight:800;color:#0f172a;font-size:13.5px}
.sc-zone{display:inline-block;padding:3px 11px;border-radius:20px;font-size:11px;font-weight:800;border:1px solid}
.sc-rej{background:#fffafa}
.sc-legendrow{display:flex;flex-wrap:wrap;gap:14px;padding:11px 16px;border-top:1px solid #f1f3f5;font-size:11px;color:#64748b;font-weight:600}
.sc-lg{display:inline-flex;align-items:center;gap:6px}
.sc-lg .d{width:9px;height:9px;border-radius:50%}
.sc-lg .d.green{background:#16a34a}.sc-lg .d.yellow{background:#d97706}.sc-lg .d.red{background:#dc2626}
.sc-excl{background:#fff;border:1px solid #eceef1;border-radius:16px;box-shadow:0 1px 2px rgba(16,24,40,.05);margin-bottom:14px;overflow:hidden}
.sc-excl-h{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:800;color:#b42318;padding:13px 16px;background:#fff5f5;border-bottom:1px solid #fde0dd}
.sc-excl-b{padding:6px 16px 12px}
.sc-ex{display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid #f6f7f9}
.sc-ex:last-child{border-bottom:none}
.sc-ex b{font-size:13px;font-weight:800;color:#b42318;background:#feecea;padding:3px 11px;border-radius:8px;flex:none;min-width:66px;text-align:center;font-family:monospace}
.sc-ex.support b{color:#b54708;background:#fef3e2}
.sc-ex span{font-size:12px;color:#475569;font-weight:600}
.sc-ph2{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;margin:4px 0 11px}
.sc-crit{background:#fff;border:1px solid #eceef1;border-radius:14px;margin-bottom:9px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.sc-crit-h{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer}
.sc-crit-ic{width:32px;height:32px;border-radius:10px;background:#fff2e8;color:var(--b);display:flex;align-items:center;justify-content:center;flex:none}
.sc-crit-t{flex:1;min-width:0}.sc-crit-t b{font-size:13px;font-weight:800;display:block}.sc-crit-t small{font-size:10.5px;color:#94a3b8}
.sc-tagr,.sc-tage,.sc-tags{font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:20px}
.sc-tagr{background:#eef2ff;color:#4f46e5}.sc-tage{background:#feecea;color:#b42318}.sc-tags{background:#fef3e2;color:#b54708}
.sc-crit-w{font-size:15px;font-weight:800;color:var(--b);flex:none}
.sc-chev{color:#94a3b8;transition:transform .2s;transform:rotate(-90deg)}.sc-chev.up{transform:rotate(90deg)}
.sc-wbar{height:4px;background:#f1f3f5}.sc-wbar div{height:100%;background:linear-gradient(90deg,var(--b),#f5a35f)}
.sc-crit-b{padding:12px 14px}
.sc-desc{font-size:12.5px;color:#334155;line-height:1.7;margin:0 0 12px;font-weight:600}
.sc-bands{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
.sc-band{display:flex;gap:10px;align-items:flex-start}
.sc-band-pt{font-size:11px;font-weight:800;color:#0f172a;background:#f4f5f7;border-radius:7px;padding:3px 9px;flex:none;min-width:42px;text-align:center;font-family:monospace}
.sc-band-tx{font-size:11.5px;color:#64748b;line-height:1.6;padding-top:2px}
.sc-why{display:flex;align-items:flex-start;gap:7px;font-size:11.5px;color:#6d4bcb;background:#f6f2ff;border:1px solid #e3d9fb;border-radius:10px;padding:9px 11px;line-height:1.6;font-weight:600}
.sc-deal{min-width:520px}
.sc-dealn{text-align:center;font-weight:800;color:#0f172a}
.sc-dealt{font-size:11.5px;color:#64748b;line-height:1.5}
.sc-src{font-size:10.5px;color:#94a3b8;padding:11px 16px;border-top:1px solid #f1f3f5;line-height:1.7}
@media(max-width:720px){.sc-kpis{grid-template-columns:1fr 1fr}}
`;
