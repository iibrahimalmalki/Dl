// بطاقة أداء A4 واحدة (PDF) — بأسلوب تقرير الجولة: ترويسة بالهوية، أرقام، أيام، تفصيل العمولة، جولات، مخالفات، ملخص بنغالي
import{FONT_STACK}from"./fonts";
import{dailySVG,sparkSVG,PAL_PRINT}from"./perfCharts";
import{bikerBrief,nextHints,LEVEL_AR}from"./scorecard";
import{renderHTML,canvasToPdfA4}from"./exportKit";

const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const M=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
export const periodAr=p=>{const[y,m]=String(p||"").split("-");return(M[+m-1]||m||"")+" "+(y||"");};
const n2=v=>Number(v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const tone=v=>v>=0.75?["#E7F7EF","#087443"]:v>=0.25?["#FFF3E2","#B54708"]:["#FEECEA","#B42318"];

// s: bikerScore · info: {name,sid,team,photo,line,violations,series:{washes,rating,cpct}}
export function cardHTML(s,info){
  const site=(typeof location!=="undefined"&&location.origin)||"";
  const [qb,qc]=tone(s.qR),[sb,sc]=tone(s.sR);
  const ini=(info.name||"?").trim().charAt(0);
  const line=info.line&&info.line.computed?info.line.computed:info.line;
  const approved=line&&line.bonus_base!=null?Number(line.bonus_base)+Number(line.production||0):null;
  const expect=s.bonusBase+s.production;
  const rows=[["ثابت 2 ر × "+s.washes+" غسلة",s.fixed],["ريال الجودة "+s.qR.toFixed(2)+" × "+s.washes,s.quality],["ريال السلامة "+s.sR.toFixed(2)+" × "+s.washes,s.safety],["مكافأة الإنتاج",s.production]];
  const k=(v,l,sub,c)=>`<div class="k"><b style="color:${c||"#0F172A"}">${v}</b><span>${l}</span>${sub?`<i>${esc(sub)}</i>`:""}</div>`;
  const hints=nextHints(s,"ar");
  return`<div class="pc" dir="rtl"><style>
.pc{width:794px;height:1123px;box-sizing:border-box;background:#fff;color:#0F172A;font-family:${FONT_STACK};padding:0;position:relative;overflow:hidden}
.pc *{box-sizing:border-box}
.hd{background:linear-gradient(135deg,#F59E0B,#E8712B);color:#fff;padding:26px 34px 22px;display:flex;align-items:center;gap:18px}
.hd .ph{width:78px;height:78px;border-radius:50%;border:3px solid rgba(255,255,255,.85);background:#fff;color:#E8712B;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;overflow:hidden;flex:none}
.hd .ph img{width:100%;height:100%;object-fit:cover}
.hd h1{margin:0;font-size:24px;font-weight:700}.hd .m{font-size:13px;margin-top:4px}
.hd .r{margin-inline-start:auto;text-align:left;font-size:12px;line-height:1.6}.hd .r b{display:block;font-size:17px}
.hd .r img{height:38px;display:block;margin:0 0 8px auto;background:#fff;border-radius:10px;padding:4px 8px}
.bd{padding:20px 34px}
.ks{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px}
.k{border:1px solid #E5E7EB;border-radius:12px;padding:10px 8px;text-align:center}.k b{font-size:22px;font-weight:700;display:block;line-height:1.2}.k span{font-size:11px;color:#64748B;font-weight:500}.k i{display:block;font-style:normal;font-size:10px;color:#94A3B8;margin-top:2px}
h3{font-size:14px;margin:14px 0 8px;color:#CC5200;font-weight:700}
.box{border:1px solid #E5E7EB;border-radius:12px;padding:10px 12px}
table{width:100%;border-collapse:collapse;font-size:12.5px}td{padding:6px 4px;border-bottom:1px solid #F1F5F9}td.n{text-align:left;direction:ltr;font-weight:600}
tr.t td{border-bottom:none;font-weight:700;font-size:14px;color:#CC5200}
.pill{display:inline-block;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700}
.g2{display:grid;grid-template-columns:1.25fr 1fr;gap:14px}
.hint{font-size:12px;line-height:1.9;margin:0;padding-inline-start:16px}
.bn{font-family:'Noto Sans Bengali',${FONT_STACK};background:#FFF4EC;border:1px solid #FFE6D6;border-radius:12px;padding:10px 14px;font-size:12px;line-height:1.8;white-space:pre-line;direction:ltr;text-align:left}
.ft{position:absolute;bottom:0;left:0;right:0;padding:10px 34px;font-size:10px;color:#94A3B8;display:flex;justify-content:space-between;border-top:1px solid #F1F5F9}
.sp{display:flex;gap:14px}.sp div{flex:1;font-size:11px;color:#64748B}.sp b{color:#0F172A;font-size:12px}
</style>
<div class="hd"><div class="ph">${info.photo?`<img src="${esc(info.photo)}" crossorigin="anonymous" alt=""/>`:esc(ini)}</div>
  <div><h1>${esc(info.name||s.name)}</h1><div class="m">رقم سويتر ${esc(s.sid)}${info.team?" · "+esc(info.team):""} · ${esc(LEVEL_AR[s.level]||s.level)}</div></div>
  <div class="r"><img src="${site}/brand-logo.png" alt=""/><b>بطاقة الأداء الشهرية</b>${esc(periodAr(s.period))}</div></div>
<div class="bd">
  <div class="ks">${k(s.washes,"غسلة صافية",s.workDays?`${s.workDays} يوم · ${s.dailyAvg}/يوم`:"")}${k(s.rating?s.rating.toFixed(2):"—","التقييم","",qc)}${k(s.complaintPct+"%","الشكاوى",s.complaints+" معتمدة",sc)}${k(s.compliance?s.compliance.pct+"%":"—","الالتزام الميداني",s.compliance&&s.compliance.date?s.compliance.date:"")}${k(n2(s.ratePerWash),"أجر الغسلة (ر)","2 + "+s.qR.toFixed(2)+" + "+s.sR.toFixed(2),"#CC5200")}</div>
  <h3>الغسلات اليومية${s.bestDay?` — أفضل يوم ${esc(s.bestDay.date)} (${s.bestDay.n})`:""}</h3>
  <div class="box">${dailySVG(s.days,s.period,{pal:PAL_PRINT,width:720,height:150,avg:s.dailyAvg||null,tips:false})}</div>
  <div class="g2">
    <div><h3>تفصيل العمولة المتوقعة</h3><div class="box"><table>${rows.map(([l,v])=>`<tr><td>${esc(l)}</td><td class="n">${n2(v)}</td></tr>`).join("")}
      <tr class="t"><td>الإجمالي المتوقع</td><td class="n">${n2(expect)}</td></tr>
      ${approved!=null?`<tr><td>المسير المعتمد</td><td class="n">${n2(approved)}${Math.abs(approved-expect)>0.01?` <span class="pill" style="background:#FFF3E2;color:#B54708">فرق ${n2(approved-expect)}</span>`:""}</td></tr>`:""}
      ${s.fines?`<tr><td>غرامات مؤكدة</td><td class="n" style="color:#B42318">-${n2(s.fines)}</td></tr>`:""}</table></div></div>
    <div><h3>الهدف التالي</h3><div class="box">${hints.length?`<ul class="hint">${hints.map(h=>`<li>${esc(h)}</li>`).join("")}</ul>`:`<p class="hint">في أعلى الدرجات — حافظ على المستوى</p>`}
      <div style="margin-top:8px"><span class="pill" style="background:${qb};color:${qc}">جودة ${s.qR.toFixed(2)}</span> <span class="pill" style="background:${sb};color:${sc}">سلامة ${s.sR.toFixed(2)}</span>${s.production?` <span class="pill" style="background:#FFE6D6;color:#CC5200">إنتاج +${s.production}</span>`:""}</div></div>
      ${info.series?`<h3>اتجاه 6 أشهر</h3><div class="box sp"><div><b>الغسلات</b>${sparkSVG(info.series.washes,{color:"#E8712B",width:90,height:30})}</div><div><b>التقييم</b>${sparkSVG(info.series.rating,{color:"#087443",width:90,height:30})}</div><div><b>الشكاوى %</b>${sparkSVG(info.series.cpct,{color:"#B42318",width:90,height:30})}</div></div>`:""}</div>
  </div>
  <div class="g2"><div><h3>آخر الجولات الميدانية</h3><div class="box"><table>${s.rounds.length?s.rounds.map(r=>`<tr><td>${esc(r.round_date||"")}</td><td>${esc(r.effect||"")}</td><td class="n">${r.compliance_pct!=null?r.compliance_pct+"%":"—"}</td></tr>`).join(""):`<tr><td>لا جولات</td></tr>`}</table></div></div>
    <div><h3>المخالفات المؤكدة</h3><div class="box"><table>${(info.violations||[]).length?info.violations.map(v=>`<tr><td>${esc(v.code||"مخالفة")}</td><td class="n">${n2(v.fine_applied)}</td></tr>`).join(""):`<tr><td>لا مخالفات هذا الشهر</td></tr>`}</table></div></div></div>
  <h3>সারসংক্ষেপ · الملخص بالبنغالي</h3><div class="bn">${esc(bikerBrief(s,"bn"))}</div>
</div>
<div class="ft"><span>مؤسسة دلو ورغوة التجارية · شريك امتياز سويتر · HR-POL-003</span><span>${esc(new Date().toISOString().slice(0,10))}</span></div>
</div>`;
}
export async function downloadCardPdf(s,info){
  const canvas=await renderHTML(cardHTML(s,info),{width:794,height:1123,scale:2});
  await canvasToPdfA4(canvas,`performance-${s.sid}-${s.period}.pdf`);
}
