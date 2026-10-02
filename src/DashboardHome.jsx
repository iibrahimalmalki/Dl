import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{payoutForBiker}from"./sweaterContract";
import{bikerScore,trend}from"./scorecard";
import DashHero from"./DashHero";
import Assistant from"./Assistant";
import ChartTip from"./ChartTip";
import{usePeriod}from"./period";

const money=n=>Number(n||0).toLocaleString("en-US",{maximumFractionDigits:0})+" ﷼";
const MN=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const periodAr=p=>{if(!p)return"—";const[y,m]=String(p).split("-");return`${MN[(+m||1)-1]} ${y}`;};
// نطاق أشهر بأسماء كاملة: «مايو — يوليو 2026»، وعبر سنتين «ديسمبر 2025 — فبراير 2026»
const monthName=p=>MN[(+String(p).split("-")[1]||1)-1];
const rangeMonths=(a,b)=>a===b?periodAr(a):String(a).slice(0,4)===String(b).slice(0,4)?`${monthName(a)} — ${monthName(b)} ${String(b).slice(0,4)}`:`${periodAr(a)} — ${periodAr(b)}`;
const periodShort=p=>{if(!p)return"—";const[,m]=String(p).split("-");return MN[(+m||1)-1].slice(0,3);};
const curMonth=()=>new Date().toISOString().slice(0,7);
const maxPeriod=arr=>arr.reduce((mx,r)=>r.period&&r.period>mx?r.period:mx,"");
const fmtD=d=>d?new Date(d+"T00:00:00").toLocaleDateString("en-GB"):"—";
const RATE=20; // ﷼ لكل غسلة (السعر الثابت قبل أغسطس 2026 حسب العقد)

// لوحة القيادة الشاملة — بيانات حيّة من كل وحدات النظام، مع نطاق زمني وفلاتر ومقارنة
export default function DashboardHome({onNav,theme="light"}){
  const nav=k=>onNav&&onNav(k);
  // فتح بطاقة أداء البايكر مباشرة (Performance يقرأ dw:open أو window.__dwLast)
  const openPerf=sid=>{nav("performance");if(sid)setTimeout(()=>window.dispatchEvent(new CustomEvent("dw:open",{detail:{view:"performance",table:"ops_biker_month",id:sid}})),300);};
  const[d,setD]=useState(null);
  const[gran,setGran]=useState("month");        // شهري/يومي (اللوحة المالية)
  const[fBiker,setFBiker]=useState("");         // فلتر البايكر
  const[fCat,setFCat]=useState("");             // فلتر الفئة المالية
  const[period,setPeriod]=usePeriod();          // الفترة المشتركة (البطل والمساعد)
  // محدّد فترة واحد: نطاق الأقسام التفصيلية مشتق من الفترة المشتركة (PeriodSelector في البطل)
  // «آخر 3 أشهر» ← آخر 3 أشهر فيها بيانات، وغيرها ← آخر شهر فيه بيانات
  const preset=period==="quarter"?"m3":"this";

  useEffect(()=>{(async()=>{
    const q=(t,c)=>supabase.from(t).select(c).then(({data})=>data||[]).then(x=>x,()=>[]);
    const[apps,visits,emps,teams,ivs,onb,ops,pay,viol,rounds,vexp,docs,fveh,finc,hunits,hpays,hviol,screq,scitems,setts,fin,tix,daily,ins]=await Promise.all([
      q("applicants","full_name,application_number,status,ai_classification,ai_score_total,location,saudi_city,bangladesh_district,submitted_at"),
      supabase.from("page_visits").select("step,session_id").eq("page","ad_page").then(({data})=>data||[],()=>[]),
      q("employees","full_name,employee_id,team_id,staff_role,profession_ok"),
      q("teams","id,name,supervisor_user_id"),
      q("interview_sessions","status,decision,rating"),
      q("onboarding","progress"),
      q("ops_biker_month","period,sweater_id,biker_name,net_washes,rating,complaint_pct,approved_complaints"),
      q("payroll_lines","period,role,total"),
      q("violations","status,severity,fine_applied"),
      q("field_rounds","compliance_pct,period,status,round_date,sweater_id"),
      q("vendor_expenses","exp_date,amount"),
      q("renewal_docs","id,doc_type,subject,end_date,active"),
      q("fleet_vehicles","plate,status,has_gps,has_camera,active"),
      q("fleet_incidents","title,status,active"),
      q("housing_units","name,annual_rent,active"),
      q("housing_payments","seq,due_date,amount,paid"),
      q("housing_violations","category,status,active"),
      q("sc_requests","status,title"),
      q("sc_items","name,qty_on_hand,reorder_level,active"),
      q("sweater_settlements","period,net_total,status"),
      q("finance_monthly","period,direction,category,amount,is_capital"),
      q("ops_tickets","period,status,decision"),
      q("ops_daily","day,period,total_bookings,washes,cancel_client,cancel_admin,avg_quality"),
      supabase.from("insights").select("scope_ar,tone,icon,title,body,recommendation,severity,sort").eq("active",true).order("sort").then(({data})=>data||[],()=>[]),
    ]);
    setD({apps,visits,emps,teams,ivs,onb,ops,pay,viol,rounds,vexp,docs,fveh,finc,hunits,hpays,hviol,screq,scitems,setts,fin,tix,daily,ins});
  })();},[]);

  const s=useMemo(()=>{
    if(!d)return null;
    const today=new Date();today.setHours(0,0,0,0);
    const dLeft=end=>end?Math.round((new Date(end+"T00:00:00")-today)/86400000):null;

    // ── قائمة كل الفترات المتاحة ──
    const allP=[...new Set([...d.ops.map(o=>o.period),...(d.fin||[]).map(f=>f.period),...(d.setts||[]).map(x=>x.period),...(d.tix||[]).map(t=>t.period),...d.pay.map(p=>p.period),...d.rounds.map(r=>r.period)].filter(Boolean))].sort();
    const maxP=allP[allP.length-1]||curMonth();

    // ── حلّ النطاق المختار → قائمة أشهر P ──
    let P=preset==="m3"?allP.slice(-3):[maxP];
    if(!P.length)P=[maxP];
    const from=P[0],to=P[P.length-1];
    const nMonths=P.length;
    const inRange=p=>P.indexOf(p)>=0;
    const rangeLabel=nMonths===1?periodAr(from):
      rangeMonths(from,to);

    // ── نطاق المقارنة (نافذة سابقة بنفس الطول) ──
    const sIdx=allP.indexOf(from);
    const prevP=sIdx>0?allP.slice(Math.max(0,sIdx-nMonths),sIdx):[];
    const inPrev=p=>prevP.indexOf(p)>=0;
    const prevLabel=prevP.length?rangeMonths(prevP[0],prevP[prevP.length-1]):null;
    const delta=(cur,pv)=>(pv==null||pv===0||!prevP.length)?null:Math.round((cur-pv)/Math.abs(pv)*100);

    // ── مُجمِّعات على قائمة أشهر ──
    const bikerOf=o=>!fBiker||o.biker_name===fBiker;
    const washesOf=list=>d.ops.filter(o=>list.indexOf(o.period)>=0&&bikerOf(o)).reduce((a,o)=>a+Number(o.net_washes||0),0);
    const ratingsOf=list=>{const r=d.ops.filter(o=>list.indexOf(o.period)>=0&&bikerOf(o)).map(o=>Number(o.rating)).filter(x=>x>0);return r.length?r.reduce((a,b)=>a+b,0)/r.length:0;};
    const revByP=p=>{const r=(d.setts||[]).find(x=>x.period===p&&x.status==="confirmed"&&x.net_total!=null);if(r&&!fBiker)return Number(r.net_total);return d.ops.filter(o=>o.period===p&&bikerOf(o)).reduce((a,o)=>a+payoutForBiker(Number(o.net_washes||0),p).total,0);};
    const revOf=list=>list.reduce((a,p)=>a+revByP(p),0);
    const payrollOf=list=>d.pay.filter(p=>list.indexOf(p.period)>=0).reduce((a,p)=>a+Number(p.total||0),0);
    const apprOf=list=>(d.tix||[]).filter(t=>list.indexOf(t.period)>=0&&t.decision==="approved").length;
    const cashOf=list=>{const f=(d.fin||[]).filter(x=>list.indexOf(x.period)>=0);const i=f.filter(x=>x.direction==="in").reduce((a,x)=>a+Number(x.amount||0),0);const o=f.filter(x=>x.direction==="out"&&!x.is_capital).reduce((a,x)=>a+Number(x.amount||0),0);const sw=f.filter(x=>x.direction==="in"&&x.category==="إيراد سويتر").reduce((a,x)=>a+Number(x.amount||0),0);return{i,o,net:i-o,sw,has:f.length>0};};
    const compOf=list=>{const r=d.rounds.filter(x=>list.indexOf(x.period)>=0&&x.compliance_pct!=null).map(x=>Number(x.compliance_pct));const g=r.length?r:d.rounds.map(x=>Number(x.compliance_pct)).filter(x=>!isNaN(x));return g.length?Math.round(g.reduce((a,b)=>a+b,0)/g.length):null;};

    // القيم الحالية والسابقة
    const washes=washesOf(P),washesPrev=washesOf(prevP);
    const avgRating=ratingsOf(P),avgRatingPrev=ratingsOf(prevP);
    const revenue=revOf(P),revenuePrev=revOf(prevP);
    const payrollTotal=payrollOf(P),payrollPrev=payrollOf(prevP);
    const tApproved=apprOf(P),tApprovedPrev=apprOf(prevP);
    const cash=cashOf(P),cashPrev=cashOf(prevP);
    const avgComp=compOf(P);

    // أعلى البايكرز عبر النطاق
    const bmap={};d.ops.filter(o=>inRange(o.period)&&bikerOf(o)).forEach(o=>{const k=o.biker_name||"—";if(!bmap[k])bmap[k]={biker_name:k,net_washes:0,rs:[]};bmap[k].net_washes+=Number(o.net_washes||0);if(Number(o.rating)>0)bmap[k].rs.push(Number(o.rating));});
    const topBikers=Object.values(bmap).map(b=>{
      // أجر الغسلة الحالي (آخر شهر في النطاق) والاتجاه عبر كل الأشهر — scorecard/HR-POL-003
      const mine=d.ops.filter(o=>(o.biker_name||"—")===b.biker_name&&bikerOf(o)).sort((x,y)=>String(x.period).localeCompare(String(y.period)));
      const lastIn=mine.filter(o=>inRange(o.period)).slice(-1)[0];
      const sc=lastIn?bikerScore(lastIn):null;
      return{...b,rating:b.rs.length?b.rs.reduce((a,c)=>a+c,0)/b.rs.length:0,sid:lastIn&&lastIn.sweater_id!=null?String(lastIn.sweater_id).trim():null,rate:sc?sc.ratePerWash:null,tr:trend(mine.map(o=>Number(o.net_washes)||0))};
    }).sort((a,b)=>b.net_washes-a.net_washes).slice(0,6);
    const maxW=topBikers.reduce((m,o)=>Math.max(m,o.net_washes),0)||1;
    const nBikers=Object.keys(bmap).length||1;

    // خيارات الفلاتر
    const bikerOpts=[...new Set(d.ops.map(o=>o.biker_name).filter(Boolean))].sort();
    const catOpts=[...new Set((d.fin||[]).filter(x=>x.direction==="out"&&!x.is_capital).map(x=>x.category))].filter(Boolean).sort();

    // ── سلاسل شهرية (النطاق أو آخر 6) للرسوم والمخطّط المالي ──
    const chartMonths=nMonths>=2?P:allP.slice(-6);
    const spark6=allP.slice(-6);
    const finChart=chartMonths.map(p=>{const c=cashOf([p]);return{p,i:c.i,o:c.o,net:c.net,sw:c.sw,has:c.has};});
    const series={wash:spark6.map(p=>washesOf([p])),rev:spark6.map(revByP),cash:spark6.map(p=>cashOf([p]).net),appr:spark6.map(p=>apprOf([p]))};

    // ── العرض اليومي (من الحجوزات) داخل النطاق ──
    const dayRows=(d.daily||[]).filter(x=>inRange(x.period)).sort((a,b)=>String(a.day).localeCompare(String(b.day)));
    const dailyWashTot=dayRows.reduce((a,x)=>a+Number(x.washes||0),0);
    const daily=dayRows.map(x=>({day:x.day,washes:Number(x.washes||0),earned:Number(x.washes||0)*RATE,q:x.avg_quality!=null?Number(x.avg_quality):null}));

    // ── فئات المصروف عبر النطاق (لفلتر الفئة) ──
    const catAgg={};(d.fin||[]).filter(x=>x.direction==="out"&&!x.is_capital&&inRange(x.period)).forEach(x=>{catAgg[x.category]=(catAgg[x.category]||0)+Number(x.amount||0);});
    const catList=Object.entries(catAgg).map(([k,v])=>({k,v})).sort((a,b)=>b.v-a.v);
    const catTotal=catList.reduce((a,c)=>a+c.v,0)||1;
    const selCatVal=fCat?(catAgg[fCat]||0):null;
    const selCatTrend=fCat?chartMonths.map(p=>(d.fin||[]).filter(x=>x.period===p&&x.category===fCat&&x.direction==="out").reduce((a,x)=>a+Number(x.amount||0),0)):[];

    // ── مؤشرات الحالة الراهنة (غير مرتبطة بالنطاق) ──
    const A=d.apps;
    const accepted=A.filter(a=>a.status==="accepted").length;
    const rejected=A.filter(a=>a.status==="rejected").length;
    const pending=A.filter(a=>a.status==="pending"||!a.status).length;
    const sess={};d.visits.forEach(v=>{const m=String(v.step||"").match(/^([0-9])/);if(!m)return;sess[v.session_id]=Math.max(sess[v.session_id]||0,+m[1]);});
    const sv=Object.values(sess);const reached=lv=>sv.filter(x=>x>=lv).length;
    const total0=reached(0)||sv.length;
    const funnel=[["دخول الإعلان",reached(0)],["المزايا",reached(1)],["الحاسبة",reached(2)],["يوم في الحياة",reached(3)],["الأسئلة",reached(4)],["زر التقديم",reached(5)]];
    const bikers=d.emps.filter(e=>e.staff_role!=="manager");
    const openViol=d.viol.filter(v=>!["closed","settled","paid","rejected"].includes(String(v.status||"").toLowerCase())).length;
    const finesTotal=d.viol.reduce((a,v)=>a+Number(v.fine_applied||0),0);
    const ivPending=d.ivs.filter(i=>i.status!=="completed").length;
    const onbAvg=d.onb.length?Math.round(d.onb.reduce((a,o)=>a+Number(o.progress||0),0)/d.onb.length):0;
    const docsA=d.docs.filter(x=>x.active!==false);
    const docExpired=docsA.filter(x=>{const l=dLeft(x.end_date);return l!=null&&l<0;});
    const docSoon=docsA.filter(x=>{const l=dLeft(x.end_date);return l!=null&&l>=0&&l<=30;});
    // شرائح تراكمية غير منتهية: ≤7 · ≤14 · ≤30
    const docLe=n=>docsA.filter(x=>{const l=dLeft(x.end_date);return l!=null&&l>=0&&l<=n;}).length;
    const docD7=docLe(7),docD14=docLe(14);
    const fveh=d.fveh.filter(v=>v.active!==false);
    const stolen=fveh.filter(v=>v.status==="stolen").length;
    const fMaint=fveh.filter(v=>v.status==="maintenance").length;
    const fIncOpen=d.finc.filter(i=>i.active!==false&&(i.status==="open"||i.status==="investigating")).length;
    const gpsCov=fveh.length?Math.round(fveh.filter(v=>v.has_gps).length/fveh.length*100):0;
    const hpUnpaid=d.hpays.filter(p=>!p.paid);
    const hpOverdue=hpUnpaid.filter(p=>{const l=dLeft(p.due_date);return l!=null&&l<0;});
    const hpNext=hpUnpaid.slice().sort((a,b)=>String(a.due_date||"").localeCompare(String(b.due_date||"")))[0];
    const hpNextDl=hpNext?dLeft(hpNext.due_date):null;
    const hvOpen=d.hviol.filter(v=>v.active!==false&&v.status!=="closed").length;
    const houseMonthly=d.hunits.filter(u=>u.active!==false).reduce((a,u)=>a+Number(u.annual_rent||0),0)/12;
    const scPending=d.screq.filter(r=>r.status==="submitted").length;
    const scLow=d.scitems.filter(i=>i.active!==false&&Number(i.reorder_level||0)>0&&Number(i.qty_on_hand||0)<=Number(i.reorder_level||0)).length;
    const coverPct=cash.o>0?Math.round(cash.sw/cash.o*100):null;
    const margin=revenue-((payrollTotal||0)+houseMonthly*nMonths+(finesTotal||0));

    // ── شكاوى سويتر (طابور حيّ + معتمدة بالنطاق) ──
    const tix=d.tix||[];
    const tPending=tix.filter(t=>t.status==="pending_review").length;
    const tReviewed=tix.filter(t=>t.status==="reviewed").length;
    const tTotal=tix.length;

    // ── مركز التنبيهات ──
    const alerts=[];
    if(tReviewed)alerts.push({sev:"warn",ic:"complaints",t:`${tReviewed} شكوى سويتر بانتظار اعتمادك`,k:"complaints"});
    if(cash.has&&cash.net<0)alerts.push({sev:"warn",ic:"cash",t:`عجز نقدي ${money(Math.abs(cash.net))} في ${rangeLabel} — مُغطّى بتمويل داخلي`,k:"reports"});
    if(tPending)alerts.push({sev:"info",ic:"clock",t:`${tPending} شكوى بانتظار مراجعة الجودة`,k:"complaints"});
    if(stolen)alerts.push({sev:"crit",ic:"bike",t:`${stolen} دراجة مسروقة — البلاغ قائم`,k:"fleet"});
    if(docExpired.length)alerts.push({sev:"crit",ic:"doc",t:`${docExpired.length} وثيقة منتهية الصلاحية`,k:"renewals"});
    if(hpOverdue.length)alerts.push({sev:"crit",ic:"cash",t:`${hpOverdue.length} دفعة سكن متأخّرة`,k:"housing"});
    if(docSoon.length)alerts.push({sev:"warn",ic:"doc",t:`${docSoon.length} وثيقة تنتهي خلال 30 يوماً`,k:"renewals"});
    if(hpNext&&hpNextDl!=null&&hpNextDl>=0&&hpNextDl<=20)alerts.push({sev:"warn",ic:"cash",t:`دفعة إيجار ${money(hpNext.amount)} تستحق ${fmtD(hpNext.due_date)} (${hpNextDl} يوم)`,k:"housing"});
    if(fIncOpen)alerts.push({sev:"warn",ic:"alert",t:`${fIncOpen} حادثة أسطول مفتوحة`,k:"fleet"});
    if(hvOpen)alerts.push({sev:"warn",ic:"home",t:`${hvOpen} مخالفة سكن مفتوحة`,k:"housing"});
    if(scLow)alerts.push({sev:"warn",ic:"bucket",t:`${scLow} صنف تحت حدّ إعادة الطلب`,k:"supply"});
    if(fMaint)alerts.push({sev:"info",ic:"wrench",t:`${fMaint} دراجة في الصيانة`,k:"fleet"});
    if(scPending)alerts.push({sev:"info",ic:"bucket",t:`${scPending} طلب إمداد بانتظار الاعتماد`,k:"supply"});
    const profMismatch=d.emps.filter(e=>e.profession_ok===false).length;
    if(profMismatch)alerts.push({sev:"warn",ic:"employees",t:`${profMismatch} مهنة غير مطابقة للنشاط — تغيير مطلوب (1,000﷼/فرد)`,k:"employees"});
    if(openViol)alerts.push({sev:"info",ic:"complaints",t:`${openViol} مخالفة/شكوى مفتوحة`,k:"complaints"});
    const sevRank={crit:0,warn:1,info:2};
    alerts.sort((a,b)=>sevRank[a.sev]-sevRank[b.sev]);

    // ── الأهداف مقابل العقد (على متوسط النطاق) ──
    const avgWashPer=washes/nBikers/nMonths;
    const complaintPctCur=washes?tApproved/washes*100:0;
    const targets=[
      {k:"غسلات/بايكر شهرياً (الحدّ المضمون)",v:avgWashPer,t:196,unit:"",good:avgWashPer>=196,warn:avgWashPer>=170,fmt:x=>Math.round(x)},
      {k:"متوسط التقييم",v:avgRating,t:4.75,unit:"",good:avgRating>=4.75,warn:avgRating>=4.5,fmt:x=>x?x.toFixed(2):"—"},
      {k:"نسبة الشكاوى المعتمدة",v:complaintPctCur,t:1,unit:"%",good:complaintPctCur<=1,warn:complaintPctCur<=2,fmt:x=>x.toFixed(1)},
      {k:"تغطية إيراد سويتر",v:coverPct==null?0:coverPct,t:100,unit:"%",good:coverPct!=null&&coverPct>=100,warn:coverPct!=null&&coverPct>=70,fmt:x=>Math.round(x)},
      {k:"الامتثال الميداني",v:avgComp,t:99,unit:"%",good:avgComp!=null&&avgComp>=99,warn:avgComp!=null&&avgComp>=90,fmt:x=>x==null?"—":x},
    ];

    // ── رؤى ذكية ──
    const insights=[];
    const dW=delta(washes,washesPrev);
    if(dW!=null)insights.push({tone:dW>=0?"good":"bad",ic:"operations",t:`الغسلات ${dW>=0?"ارتفعت":"انخفضت"} ${Math.abs(dW)}% مقابل ${prevLabel} (${washes.toLocaleString("en-US")} غسلة في ${rangeLabel}).`});
    if(coverPct!=null)insights.push({tone:coverPct>=100?"good":"bad",ic:"cash",t:coverPct>=100?`إيراد سويتر يغطّي المصروف بالكامل (${coverPct}%) في ${rangeLabel}.`:`إيراد سويتر يغطّي ${coverPct}% فقط من المصروف — الفجوة تُموَّل داخلياً.`});
    const belowMin=Object.values(bmap).filter(b=>b.net_washes/nMonths<196).length;
    if(belowMin&&!fBiker)insights.push({tone:"warn",ic:"bike",t:`${belowMin} بايكر تحت الحدّ المضمون (196 غسلة/شهر) — أثر على الشريحة والحافز.`});
    if(avgRating&&avgRating<4.75)insights.push({tone:"warn",ic:"star",t:`متوسط التقييم ${avgRating.toFixed(2)} دون شرط الحافز (4.75).`});
    if(topBikers[0]&&topBikers[0].net_washes>0)insights.push({tone:"good",ic:"performance",t:`${topBikers[0].biker_name} الأعلى إنتاجية في ${rangeLabel} (${topBikers[0].net_washes} غسلة).`});
    if(catList[0])insights.push({tone:"warn",ic:"cash",t:`أعلى بند مصروف في ${rangeLabel}: ${catList[0].k} بمقدار ${money(catList[0].v)} (${Math.round(catList[0].v/catTotal*100)}%).`});
    if(tReviewed)insights.push({tone:"warn",ic:"complaints",t:`${tReviewed} شكوى بانتظار اعتمادك — قرارها يؤثّر على رواتب البايكرز.`});
    const toneRank={bad:0,warn:1,good:2};
    insights.sort((a,b)=>toneRank[a.tone]-toneRank[b.tone]);
    const insTop=insights.slice(0,3);

    return{
      allP,maxP,P,from,to,nMonths,rangeLabel,prevLabel,bikerOpts,catOpts,
      washes,avgRating,revenue,payrollTotal,tApproved,cash,avgComp,coverPct,margin,
      deltas:{wash:delta(washes,washesPrev),rev:delta(revenue,revenuePrev),cash:delta(cash.net,cashPrev.net),out:delta(cash.o,cashPrev.o),pay:delta(payrollTotal,payrollPrev),appr:delta(tApproved,tApprovedPrev),rating:avgRatingPrev?delta(avgRating,avgRatingPrev):null},
      series,finChart,daily,dailyWashTot,catList,catTotal,selCatVal,selCatTrend,
      topBikers,maxW,nBikers,targets,insTop,
      A,accepted,rejected,pending,funnel,total0,bikers,teams:d.teams,
      openViol,finesTotal,avgComp2:avgComp,rounds:d.rounds,ivPending,onbAvg,
      docExpired:docExpired.length,docSoon:docSoon.length,docD7,docD14,nVeh:fveh.length,stolen,fMaint,fIncOpen,gpsCov,
      hpNext,hpNextDl,hvOpen,houseMonthly,scPending,scLow,alerts,
      tPending,tReviewed,tTotal};
  },[d,preset,fBiker,fCat]);

  if(!s)return(<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>{[...Array(6)].map((_,i)=><div key={i} className="dw-skel" style={{height:92}}/>)}</div>);

  const {allP,maxP,rangeLabel,prevLabel,nMonths,bikerOpts,catOpts,washes,avgRating,revenue,payrollTotal,tApproved,cash,avgComp,coverPct,margin,
    deltas,series,finChart,daily,dailyWashTot,catList,catTotal,selCatVal,selCatTrend,topBikers,maxW,nBikers,targets,insTop,
    A,accepted,rejected,pending,funnel,total0,bikers,teams,openViol,ivPending,onbAvg,
    docExpired,docSoon,docD7,docD14,nVeh,stolen,fMaint,fIncOpen,gpsCov,hpNext,hpNextDl,hvOpen,scPending,scLow,alerts,
    tPending,tReviewed,tTotal}=s;

  const finMax=Math.max(1,...finChart.map(x=>Math.max(x.i,x.o)));
  const dMaxW=Math.max(1,...daily.map(x=>x.washes));
  const recent=A.slice(0,4);
  const scoreCol=v=>v==null?["var(--track)","var(--mut-2)"]:v>=6.5?["var(--ok-bg)","var(--ok-ink)"]:v>=5?["var(--warn-bg)","var(--warn-ink)"]:["var(--bad-bg)","var(--bad-ink)"];
  const stName=x=>x==="accepted"?"مقبول":x==="rejected"?"مرفوض":"معلّق";
  const stCls=x=>x==="accepted"?"p-acc":x==="rejected"?"p-rej":"p-pend";
  const av=i=>["var(--warn)","var(--ok)","var(--info)","var(--info)","var(--mut)","var(--p)"][i%6];
  const sevC={crit:["var(--bad-bg)","var(--bad-ink)"],warn:["var(--warn-bg)","var(--warn-ink)"],info:["var(--info-bg)","var(--info-ink)"]};

  return(<div className="dh" data-theme={theme}>
    <style>{CSS}</style>
    <div className="dh-orbs" aria-hidden><span className="dh-orb a"/><span className="dh-orb b"/><span className="dh-orb c"/></div>

    <div className="dh-layout"><div className="dh-main">
    {/* البطل: الغسلات + الالتزام + المؤشرات الأساسية للفترة المشتركة */}
    <DashHero d={d} period={period} onPeriod={setPeriod} onNav={nav}/>

    {/* الفلاتر (الفترة من البطل أعلاه) */}
    <div className="dh-period">
      <div className="dh-filters">
        <div className="dh-fsel">
          <Icon n="bike" s={13}/>
          <select value={fBiker} onChange={e=>setFBiker(e.target.value)}>
            <option value="">كل البايكرز</option>
            {bikerOpts.map(b=><option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="dh-fsel">
          <Icon n="cash" s={13}/>
          <select value={fCat} onChange={e=>setFCat(e.target.value)}>
            <option value="">كل المصروفات</option>
            {catOpts.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {(fBiker||fCat)&&<button className="dh-clear" onClick={()=>{setFBiker("");setFCat("");}}>مسح الفلاتر ✕</button>}
      </div>
    </div>

    {/* ملخّص الفترة */}
    <div className="dh-summary">
      <div className="dh-sm-h"><Icon n="chart" s={15}/> ملخّص <b>{rangeLabel}</b>{fBiker&&<em>· {fBiker}</em>}{prevLabel&&<span className="dh-sm-cmp">مقارنةً بـ{prevLabel}</span>}</div>
      <div className="dh-sm-grid">
        <SM t="الغسلات" v={washes.toLocaleString("en-US")} dl={deltas.wash}/>
        <SM t="إيراد سويتر" v={money(revenue)} dl={deltas.rev}/>
        <SM t="النقد الخارج" v={money(cash.o)} dl={deltas.out} inv/>
        <SM t="الصافي النقدي" v={money(cash.net)} dl={deltas.cash} col={cash.net>=0?"var(--ok-ink)":"var(--bad-ink)"}/>
        <SM t="الرواتب" v={payrollTotal?money(payrollTotal):"—"} dl={deltas.pay} inv/>
        <SM t="شكاوى معتمدة" v={tApproved} dl={deltas.appr} inv/>
      </div>
    </div>

    {/* مركز التنبيهات والأولويات */}
    <div className="dh-alerts">
      <div className="dh-al-h"><span><Icon n="bell" s={16}/> تنبيهات وأولويات</span>{alerts.length>0&&<b>{alerts.length}</b>}</div>
      {alerts.length===0?
        <div className="dh-al-ok"><Icon n="check" s={16}/> لا تنبيهات عاجلة — كل المؤشرات ضمن النطاق.</div>:
        <div className="dh-al-list">
          {alerts.map((a,i)=>{const[bg,c]=sevC[a.sev];return(
            <button key={i} className="dh-al" style={{background:bg}} onClick={()=>nav(a.k)}>
              <span className="dh-al-ic" style={{color:c}}><Icon n={a.ic} s={15}/></span>
              <span className="dh-al-t" style={{color:c}}>{a.t}</span>
              <Icon n="fwd" s={12} style={{color:c,opacity:.6}}/>
            </button>);})}
        </div>}
    </div>

    {/* رؤى ذكية */}
    {insTop.length>0&&<div className="dh-ins">
      <div className="dh-ins-h"><Icon n="robot" s={16}/> رؤى ذكية · {rangeLabel}</div>
      <div className="dh-ins-list">
        {insTop.map((x,i)=>{const cc=x.tone==="good"?"var(--ok-ink)":x.tone==="bad"?"var(--bad-ink)":"var(--warn-ink)";const bg=x.tone==="good"?"var(--ok-bg)":x.tone==="bad"?"var(--bad-bg)":"var(--warn-bg)";return(
          <div className="dh-ins-i" key={i} style={{borderInlineStartColor:cc}}><span className="dh-ins-ic" style={{background:bg,color:cc}}><Icon n={x.ic} s={14}/></span><span>{x.t}</span></div>);})}
      </div>
    </div>}

    {/* تحليلات ذكية شاملة — مخزّنة في القاعدة */}
    {d.ins&&d.ins.length>0&&<div className="dh-ai">
      <div className="dh-ai-head"><span className="dh-ai-hl"><Icon n="robot" s={16}/> تحليلات ذكية · شاملة</span><span className="dh-ai-cnt">{d.ins.length} رؤية</span></div>
      <div className="dh-ai-list">
        {d.ins.map((x,i)=>{const cc=x.tone==="good"?"var(--ok-ink)":x.tone==="bad"?"var(--bad-ink)":x.tone==="warn"?"var(--warn-ink)":"var(--ink-2)";const bg=x.tone==="good"?"var(--ok-bg)":x.tone==="bad"?"var(--bad-bg)":x.tone==="warn"?"var(--warn-bg)":"var(--track)";return(
          <div className="dh-ai-i" key={i} style={{borderInlineStartColor:cc}}>
            <div className="dh-ai-t"><span className="dh-ins-ic" style={{background:bg,color:cc}}><Icon n={x.icon||"robot"} s={14}/></span><b>{x.title}</b>{x.scope_ar&&<span className="dh-ai-tag">{x.scope_ar}</span>}</div>
            <div className="dh-ai-b">{x.body}</div>
            {x.recommendation&&<div className="dh-ai-r">↪ {x.recommendation}</div>}
          </div>);})}
      </div>
    </div>}

    {/* شريط المؤشرات الأساسي */}
    <div className="dh-kpis">
      <Kpi label="البايكرز" ic="bike" ib="var(--p-100)" c="var(--p)" n={bikers.length} sub={`${teams.length} فرق`} onClick={()=>nav("employees")}/>
      <Kpi label="المتقدّمون" ic="applicants" ib="var(--info-bg)" c="var(--info-ink)" n={A.length} sub={`${pending} قيد المراجعة`} onClick={()=>nav("recruitment")}/>
      <Kpi label={"غسلات · "+rangeLabel} ic="operations" ib="var(--ok-bg)" c="var(--ok-ink)" n={washes.toLocaleString("en-US")} sub={avgRating?`تقييم ${avgRating.toFixed(2)}`:"لا بيانات بعد"} delta={deltas.wash} spark={series.wash} onClick={()=>nav("operations")}/>
      <Kpi label={"إيراد سويتر · "+rangeLabel} ic="cash" ib="var(--ok-bg)" c="var(--ok-ink)" n={revenue?money(revenue):"—"} sub={coverPct!=null?`تغطية ${coverPct}%`:"—"} delta={deltas.rev} spark={series.rev} onClick={()=>nav("reports")}/>
      <Kpi label={"رواتب · "+rangeLabel} ic="payroll" ib="var(--info-bg)" c="var(--info-ink)" n={payrollTotal?money(payrollTotal):"—"} sub={nMonths>1?`${nMonths} أشهر`:"مسير الشهر"} delta={deltas.pay} inv onClick={()=>nav("payroll")}/>
      <Kpi label="شكاوى سويتر" ic="complaints" ib="var(--bad-bg)" c="var(--bad-ink)" n={tPending+tReviewed} sub={tReviewed?`${tReviewed} بانتظار اعتمادك`:(tTotal?`${tApproved} معتمدة بالفترة`:"لا شكاوى")} tone={tReviewed?"red":""} delta={deltas.appr} inv spark={series.appr} onClick={()=>nav("complaints")}/>
    </div>

    {/* شريط تشغيلي — الوحدات الجديدة (حالة راهنة) */}
    <div className="dh-ops">
      <Kpi label="الأسطول" ic="bike" ib="var(--info-bg)" c="var(--info-ink)" n={nVeh} sub={`${fIncOpen} حوادث · تتبّع ${gpsCov}%`} tone={stolen?"red":""} onClick={()=>nav("fleet")}/>
      <Kpi label="السكن — الدفعة القادمة" ic="home" ib="var(--p-100)" c="var(--warn-ink)" n={hpNext?money(hpNext.amount):"—"} sub={hpNext?`تستحق ${fmtD(hpNext.due_date)}`:"مكتمل"} onClick={()=>nav("housing")}/>
      <Kpi label="الوثائق — عاجلة (≤7 + منتهية)" ic="doc" ib="var(--bad-bg)" c="var(--bad-ink)" n={docD7+docExpired} tone={docD7+docExpired?"red":""} onClick={()=>nav("renewals")}
        sub={<span className="dh-docs" title={`منتهية: ${docExpired}`}><span className="g-badge bad">≤7 · {docD7}</span><span className="g-badge warn">≤14 · {docD14}</span><span className="g-badge info">≤30 · {docSoon}</span></span>}/>
      <Kpi label="الإمداد — طلبات معلّقة" ic="bucket" ib="var(--ok-bg)" c="var(--ok-ink)" n={scPending} sub={scLow?`${scLow} تحت الحدّ`:"المخزون متوازن"} onClick={()=>nav("supply")}/>
    </div>

    {/* أهداف الأداء */}
    <div className="dw-row">
      <div className="dw-panel">
        <div className="dw-ph"><b>أهداف الأداء · {rangeLabel}</b><span className="dw-a">مقابل معايير العقد</span></div>
        <div className="dw-pb dh-targets">
          {targets.map((g,i)=>{const cc=g.good?"var(--ok-ink)":g.warn?"var(--warn-ink)":"var(--bad-ink)";const bg=g.good?"var(--ok-bg)":g.warn?"var(--warn-bg)":"var(--bad-bg)";const pct=g.v==null?0:Math.max(0,Math.min(100,g.v/g.t*100));return(
            <div className="dh-tg" key={i}>
              <div className="dh-tg-top"><span className="dh-tg-k">{g.k}</span><span className="dh-tg-v" style={{color:cc}}>{g.fmt(g.v)}{g.unit}<small> / {g.t}{g.unit}</small></span></div>
              <div className="dh-tg-bar"><div style={{width:Math.max(3,Math.min(100,pct))+"%",background:cc}}/></div>
              <span className="dh-tg-badge" style={{background:bg,color:cc}}>{g.good?"مطابق":g.warn?"قريب":"دون الهدف"}</span>
            </div>);})}
        </div>
      </div>
    </div>

    {/* التوظيف */}
    <div className="dw-row dw-2">
      <div className="dw-panel">
        <div className="dw-ph"><b>قمع التوظيف</b><span className="dw-a">من زيارة الإعلان للتقديم</span></div>
        <div className="dw-pb dw-fun">
          {funnel.map(([lbl,val],i)=>{const pct=total0?Math.round(val/total0*100):0;return(
            <div className="dw-frow" key={i}><span className="dw-fl">{lbl}</span><div className="dw-fbar"><div className="dw-ffill" style={{width:`${Math.max(pct,6)}%`}}>{val}</div></div><span className="dw-fv">{pct}%</span></div>);})}
        </div>
      </div>
      <div className="dw-panel">
        <div className="dw-ph"><b>حالة المتقدّمين</b></div>
        <div className="dw-pb" style={{display:"flex",alignItems:"center",gap:18}}>
          <Donut a={accepted} p={pending} r={rejected} total={A.length}/>
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:9}}>
            <Leg c="var(--ok)" t="مقبول" v={accepted}/><Leg c="var(--warn)" t="قيد المراجعة" v={pending}/><Leg c="var(--bad)" t="مرفوض" v={rejected}/>
            <div className="dh-mini"><span>مقابلات معلّقة</span><b>{ivPending}</b></div>
            <div className="dh-mini"><span>متوسط التعاقد</span><b>{onbAvg}%</b></div>
          </div>
        </div>
      </div>
    </div>

    {/* العمليات + المالية */}
    <div className="dw-row dw-2">
      <div className="dw-panel">
        <div className="dw-ph"><b>أداء البايكرز — {rangeLabel}</b><span className="dw-a" onClick={()=>nav("operations")} role="button">العمليات <Icon n="fwd" s={12} style={{verticalAlign:"-2px"}}/></span></div>
        <div className="dw-pb">
          {topBikers.length===0?<Empty t="لا بيانات عمليات بعد" s="ارفع تقارير سويتر الشهرية لتظهر الغسلات هنا."/>:
          <div className="dw-team">{topBikers.map((o,i)=>(
            <div className="dw-tm dw-clk" key={i} role="button" tabIndex={0} title="فتح بطاقة الأداء" onClick={()=>openPerf(o.sid)} onKeyDown={e=>e.key==="Enter"&&openPerf(o.sid)}><div className="dw-tn">{o.biker_name||"—"}<small>{o.rating?`تقييم ${Number(o.rating).toFixed(2)}`:""}{o.rate!=null&&<span className="dw-rate"> · {o.rate.toFixed(2)} ر/غسلة</span>}<span className={"dw-trd "+o.tr.dir} title={`الاتجاه ${o.tr.pct}%`}>{o.tr.dir==="up"?"▲":o.tr.dir==="down"?"▼":"■"}</span></small></div><div className="dw-tbar"><div style={{width:`${Math.round(o.net_washes/maxW*100)}%`,height:"100%",borderRadius:6,background:i===0?"linear-gradient(90deg,var(--ok),color-mix(in srgb,var(--ok) 70%,white))":"linear-gradient(90deg,var(--a),var(--p))"}}/></div><span className="dw-tv">{o.net_washes}</span></div>))}</div>}
        </div>
      </div>
      <div className="dw-panel">
        <div className="dw-ph">
          <b>التدفّق النقدي · {rangeLabel}</b>
          <div className="dh-gran">
            <button className={gran==="month"?"on":""} onClick={()=>setGran("month")}>شهري</button>
            <button className={gran==="day"?"on":""} onClick={()=>setGran("day")}>يومي</button>
          </div>
        </div>
        <div className="dw-pb">
          {gran==="day"?(
            daily.length===0?<Empty t="لا بيانات يومية في هذا النطاق" s="العرض اليومي يعتمد على تقارير الحجوزات."/>:
            <>
              <div className="dh-note">الإنتاج والإيراد المُكتسب يومياً (من الحجوزات، {RATE}﷼/غسلة). المصروفات البنكية تبقى شهرية.</div>
              <ChartTip label="الغسلات اليومية"><div className="dh-cf dh-cf-day">{daily.map((x,i)=>(
                <div key={i} className="dh-cf-col" data-tip={`${x.day.slice(8)}/${x.day.slice(5,7)}: ${x.washes} غسلة`}>
                  <div className="dh-cf-bars"><div className="dh-cf-in" style={{height:Math.max(2,Math.round(x.washes/dMaxW*46))+"px",width:"100%"}}/></div>
                  {(i===0||i===daily.length-1||i===Math.floor(daily.length/2))&&<span className="dh-cf-m">{x.day.slice(8)}/{x.day.slice(5,7)}</span>}
                </div>))}</div></ChartTip>
              <div className="dh-fin" style={{marginTop:10}}>
                <div className="dh-fin-row hi"><span className="dh-fin-ic" style={{background:"var(--ok-bg)",color:"var(--ok-ink)"}}><Icon n="operations" s={16}/></span><div style={{flex:1}}><div className="dh-fin-l">إجمالي الغسلات · {rangeLabel}</div><div style={{fontSize:11,color:"var(--dh-mut2)",fontWeight:600}}>{daily.length} يوم عمل</div></div><b>{dailyWashTot.toLocaleString("en-US")}</b></div>
                <div className="dh-fin-row"><span className="dh-fin-ic" style={{background:"var(--info-bg)",color:"var(--info-ink)"}}><Icon n="cash" s={16}/></span><div style={{flex:1}}><div className="dh-fin-l">إيراد مُكتسب تقديري ({RATE}﷼/غسلة)</div></div><b>{money(dailyWashTot*RATE)}</b></div>
                <div className="dh-fin-tot"><span>متوسط يومي</span><b>{Math.round(dailyWashTot/Math.max(1,daily.length))} غسلة</b></div>
              </div>
            </>
          ):(
            finChart.some(x=>x.has)?<>
              <ChartTip label="التدفّق النقدي الشهري"><div className="dh-cf">{finChart.map((x,i)=>(
                <div key={i} className="dh-cf-col" data-tip={`${periodAr(x.p)}: داخل ${money(x.i)} · خارج ${money(x.o)}`}>
                  <div className="dh-cf-bars">
                    <div className="dh-cf-in" style={{height:Math.max(2,Math.round(x.i/finMax*46))+"px"}}/>
                    <div className="dh-cf-out" style={{height:Math.max(2,Math.round(x.o/finMax*46))+"px"}}/>
                  </div>
                  <span className="dh-cf-m">{periodShort(x.p)}</span>
                </div>))}</div></ChartTip>
              <div className="dh-cf-lg"><span><i style={{background:"var(--ok)"}}/>داخل</span><span><i style={{background:"var(--bad)"}}/>خارج</span></div>
              <div className="dh-fin" style={{marginTop:10}}>
                <div className="dh-fin-row hi"><span className="dh-fin-ic" style={{background:"var(--ok-bg)",color:"var(--ok-ink)"}}><Icon n="cash" s={16}/></span><div style={{flex:1}}><div className="dh-fin-l">النقد الداخل</div><div style={{fontSize:11,color:"var(--dh-mut2)",fontWeight:600}}>سويتر {money(cash.sw)} · تمويل {money(cash.i-cash.sw)}</div></div><b>{money(cash.i)}</b></div>
                <div className="dh-fin-row"><span className="dh-fin-ic" style={{background:"var(--bad-bg)",color:"var(--bad-ink)"}}><Icon n="payroll" s={16}/></span><div style={{flex:1}}><div className="dh-fin-l">النقد الخارج (تشغيلي)</div></div><b>{money(cash.o)}</b></div>
                <div className="dh-fin-row"><span className="dh-fin-ic" style={{background:"var(--info-bg)",color:"var(--info-ink)"}}><Icon n="chart" s={16}/></span><div style={{flex:1}}><div className="dh-fin-l">تغطية إيراد سويتر للمصروف</div></div><b style={{color:coverPct!=null&&coverPct>=100?"var(--ok-ink)":"var(--warn-ink)"}}>{coverPct!=null?coverPct+"%":"—"}</b></div>
                <div className="dh-fin-tot"><span>الصافي النقدي</span><b style={{color:cash.net>=0?"var(--ok-ink)":"var(--bad-ink)"}}>{money(cash.net)}</b></div>
                {cash.net<0&&<div style={{fontSize:11,color:"var(--warn-ink)",fontWeight:700,marginTop:-2}}>عجز تشغيلي مُغطّى بتمويل داخلي.</div>}
              </div>
            </>:<Empty t="لا بيانات مالية في هذا النطاق" s="ارفع كشف الحساب البنكي لعرض التدفّق النقدي."/>
          )}
        </div>
      </div>
    </div>

    {/* المصروفات حسب الفئة */}
    {catList.length>0&&<div className="dw-row">
      <div className="dw-panel">
        <div className="dw-ph"><b>المصروفات حسب الفئة · {rangeLabel}</b><span className="dw-a">{selCatVal!=null?`${fCat}: ${money(selCatVal)}`:`إجمالي ${money(catTotal)}`}</span></div>
        <div className="dw-pb">
          {selCatVal!=null&&selCatTrend.length>1&&<div className="dh-note">اتجاه «{fCat}» عبر الأشهر: {selCatTrend.map(v=>money(v)).join(" · ")}</div>}
          <div className="dh-catlist">
            {catList.slice(0,10).map((c,i)=>{const pct=Math.round(c.v/catTotal*100);const on=fCat===c.k;return(
              <button key={i} className={"dh-cat"+(on?" on":"")} onClick={()=>setFCat(on?"":c.k)}>
                <span className="dh-cat-k">{c.k}</span>
                <div className="dh-cat-bar"><div style={{width:Math.max(3,pct)+"%"}}/></div>
                <span className="dh-cat-v">{money(c.v)}<small> {pct}%</small></span>
              </button>);})}
          </div>
        </div>
      </div>
    </div>}

    {/* أحدث المتقدّمين */}
    <div className="dw-row">
      <div className="dw-panel">
        <div className="dw-ph"><b>أحدث المتقدّمين</b><span className="dw-a" onClick={()=>nav("recruitment")} role="button">عرض الكل ({A.length}) <Icon n="fwd" s={13} style={{verticalAlign:"-2px"}}/></span></div>
        <div style={{overflow:"auto"}}>
        {recent.length===0?<Empty t="لا متقدّمين بعد" s="شارك رابط الإعلان لبدء استقبال الطلبات."/>:
        <table className="dw-tbl">
          <thead><tr><th>المتقدّم</th><th className="dw-hm">الموقع</th><th>تقييم AI</th><th>الحالة</th></tr></thead>
          <tbody>{recent.map((a,i)=>{const[bg,cl]=scoreCol(a.ai_score_total);return(
            <tr key={i} onClick={()=>nav("recruitment")} style={{cursor:"pointer"}}>
              <td><div className="dw-cand"><div className="dw-cav" style={{background:av(i)}}>{(a.full_name||"?").trim().charAt(0)}</div><div><div style={{fontWeight:700}}>{a.full_name||"—"}</div><small>#{a.application_number||"—"}</small></div></div></td>
              <td className="dw-hm">{a.location==="inside_ksa"?`الرياض · ${a.saudi_city||"—"}`:`خارج · ${a.bangladesh_district||"—"}`}</td>
              <td><span className="dw-score" style={{background:bg,color:cl}}>{a.ai_score_total!=null?Number(a.ai_score_total).toFixed(2):"—"}</span></td>
              <td><span className={"dw-pill "+stCls(a.status)}><span className="dw-dot"/>{stName(a.status)}</span></td>
            </tr>);})}</tbody>
        </table>}
        </div>
      </div>
    </div>

    {/* اختصارات الوحدات */}
    <div className="dh-quick">
      {[["recruitment","المتقدّمون","applicants"],["interviews","المقابلات","interview"],["operations","العمليات","operations"],["payroll","الرواتب","payroll"],["pricing","التسعير","cash"],["complaints","الشكاوى","complaints"],["field_rounds","الجولات","rounds"],["fleet","الأسطول","bike"],["housing","السكن","home"],["renewals","الوثائق","doc"],["supply","الإمداد","bucket"],["vendors","الموردون","vendors"],["org","الهيكل","building"]].map(([k,ar,ic])=>(
        <button key={k} className="dh-q" onClick={()=>nav(k)}><span className="dh-q-ic"><Icon n={ic} s={18}/></span>{ar}</button>))}
    </div>
    </div>
    {/* مساعد العمليات: جانبي على الشاشات الواسعة، وورقة سفلية على الجوال */}
    <Assistant d={d} period={period} onNav={nav}/>
    </div>
  </div>);
}

function SM({t,v,dl,inv,col}){
  const up=dl!=null&&dl>=0;const good=inv?!up:up;const dc=dl==null?null:(dl===0?"var(--dh-mut2)":good?"var(--ok-ink)":"var(--bad-ink)");
  return(<div className="dh-sm"><span className="dh-sm-t">{t}</span><span className="dh-sm-v" style={col?{color:col}:null}>{v}</span>{dl!=null&&<span className="dh-sm-d" style={{color:dc}}>{dl>0?"▲":dl<0?"▼":"■"} {Math.abs(dl)}%</span>}</div>);
}
function Kpi({label,ic,c,ib,n,sub,tone,onClick,delta,spark,inv}){
  const dc=tone==="red"?"var(--bad-ink)":"var(--dh-mut)";
  const up=delta!=null&&delta>=0;const good=inv?!up:up;const dcol=delta==null?null:(delta===0?"var(--dh-mut2)":good?"var(--ok-ink)":"var(--bad-ink)");
  return(<div className={"dh-kpi"+(onClick?" dw-clk":"")} onClick={onClick}>
    <div className="dh-kh"><span className="dh-kl">{label}</span><span className="dh-ki" style={{background:ib,color:c}}><Icon n={ic} s={17}/></span></div>
    <div className="dh-kn">{n}{delta!=null&&<span className="dh-delta" style={{color:dcol}}>{delta>0?"▲":delta<0?"▼":"■"} {Math.abs(delta)}%</span>}</div>
    <div className="dh-kfoot"><span className="dh-kd" style={{color:dc}}>{sub}</span>{spark&&spark.length>1&&<Spark data={spark} col={c}/>}</div>
  </div>);
}
function Spark({data,col}){
  const mx=Math.max(...data),mn=Math.min(...data),rng=(mx-mn)||1,W=54,H=18;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*W},${(H-2)-((v-mn)/rng)*(H-4)+1}`).join(" ");
  const ly=(H-2)-((data[data.length-1]-mn)/rng)*(H-4)+1;
  return(<svg width={W} height={H} className="dh-spark" viewBox={`0 0 ${W} ${H}`}><polyline points={pts} fill="none" stroke={col} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/><circle cx={W} cy={ly} r="2" fill={col}/></svg>);
}
function Empty({t,s}){return(<div className="dh-empty"><Icon n="inbox" s={26}/><b>{t}</b><span>{s}</span></div>);}
function Donut({a,p,r,total}){
  const T=Math.max(a+p+r,1);const seg=v=>v/T*100;const A=seg(a),P=seg(p),R=seg(r);
  let off=25;const arc=(len,col,o)=>(<circle cx="21" cy="21" r="15.9" fill="none" stroke={col} strokeWidth="6" strokeDasharray={`${len} ${100-len}`} strokeDashoffset={o} transform="rotate(-90 21 21)"/>);
  const c1=off;off-=A;const c2=off;off-=P;const c3=off;
  return(<svg width="118" height="118" viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.9" fill="none" className="dh-donut-track" strokeWidth="6"/>{arc(A,"var(--ok)",c1)}{arc(P,"var(--warn)",c2)}{arc(R,"var(--bad)",c3)}<text x="21" y="20.5" textAnchor="middle" fontSize="7" fontWeight="800" className="dh-donut-n">{total}</text><text x="21" y="27" textAnchor="middle" fontSize="3.2" className="dh-donut-l">إجمالي</text></svg>);
}
function Leg({c,t,v}){return(<div style={{display:"flex",alignItems:"center",gap:8,fontSize:12.5,color:"var(--dh-mut)"}}><i style={{width:10,height:10,borderRadius:3,background:c}}/>{t}<b style={{marginInlineStart:"auto",color:"var(--dh-ink)"}}>{v}</b></div>);}

// ── التصميم الزجاجي (Glass) — فاتح افتراضياً، داكن عبر data-theme="dark" ──
// كل الألوان عبر رموز --dh-* حتى تعمل البطاقات في السمتين. الهوية: برتقالي #E8712B/#F59E0B، وردي #FB7185، navy #0A0E27.
const CSS=`
/* ── التخطيط: المحتوى + مساعد العمليات ── */
.dh-layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:16px;align-items:start}
.dh-main{min-width:0}
@media(max-width:1279px){.dh-layout{grid-template-columns:minmax(0,1fr)}}

/* ── البطل ── */
.dh-hero{padding:18px 20px;margin-bottom:14px}
.dh-hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px}
.dh-hero-k{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:800;color:var(--ink-2)}
.dh-hero-r{font-size:12px;color:var(--mut);margin-top:3px}.dh-hero-r span{color:var(--mut-2)}
.dh-hero-na{color:var(--mut);font-size:13px;margin:8px 0 2px}
.dh-hero-body{display:grid;grid-template-columns:minmax(0,1.3fr) auto minmax(0,1.5fr);gap:22px;align-items:center}
/* حجم الرقم من عرض خليته (container query) لا من عرض الشاشة — كان يُقصّ على سطح المكتب بين الشريط الجانبي واللوحة الجانبية */
.dh-hero-main{container-type:inline-size;min-width:0;justify-self:stretch;width:100%}
.dh-hero-n{font-size:clamp(48px,7vw,76px);font-size:clamp(34px,30cqi,76px);white-space:nowrap;font-weight:800;line-height:1;letter-spacing:-2px;background:linear-gradient(135deg,var(--a),var(--p));-webkit-background-clip:text;background-clip:text;color:transparent}
.dh-hd{display:inline-block;margin-top:8px;font-size:12px;font-weight:800}.dh-hd.up{color:var(--ok-ink)}.dh-hd.down{color:var(--bad-ink)}.dh-hd.n{color:var(--mut)}
.dh-hero-g{background:none;border:none;padding:0;cursor:pointer;border-radius:50%;font-family:inherit;color:inherit}
.dh-hero-g:focus-visible,.dh-hm-i:focus-visible{outline:none;box-shadow:var(--glow)}
.dh-hero-mini{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.dh-hm-i{display:flex;flex-direction:column;gap:3px;text-align:start;background:var(--soft);border:1px solid var(--line);border-radius:14px;padding:11px 12px;cursor:pointer;font-family:inherit;color:var(--ink);transition:transform .2s var(--ease),border-color .2s var(--ease)}
.dh-hm-i:hover{transform:translateY(-2px);border-color:rgba(var(--p-rgb),.35)}
.dh-hm-l{display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:var(--mut)}
.dh-hm-i b{font-size:21px;font-weight:800;letter-spacing:-.4px}.dh-hm-i b.t-ok{color:var(--ok-ink)}.dh-hm-i b.t-warn{color:var(--warn-ink)}.dh-hm-i b.t-bad{color:var(--bad-ink)}
.dh-hm-i small{font-size:11px;color:var(--mut)}.dh-hm-i .dh-hd{margin-top:0;font-size:11px}
@media(max-width:1000px){.dh-hero-body{grid-template-columns:1fr auto}.dh-hero-mini{grid-column:1/-1}}
@media(max-width:560px){.dh-hero{padding:15px}.dh-hero-body{grid-template-columns:1fr;justify-items:center;text-align:center;gap:14px}.dh-hero-mini{grid-template-columns:1fr 1fr 1fr;gap:7px}.dh-hm-i{padding:9px 8px}.dh-hm-i b{font-size:17px}.dh-hero-top{justify-content:center;text-align:center}}

.dh{position:relative;overflow-x:clip;max-width:100%;--dh-bg:#F5F6FA;--dh-glass:rgba(255,255,255,.66);--dh-glass2:rgba(255,255,255,.82);--dh-line:rgba(15,23,42,.09);--dh-ink:#0F172A;--dh-mut:#64748B;--dh-mut2:#94A3B8;--dh-track:#EEF1F4;--dh-soft:rgba(15,23,42,.04);--dh-hero:linear-gradient(135deg,#0f2a43,#1a3f5f);--dh-shadow:0 10px 30px -18px rgba(15,23,42,.25);--p:#E8712B;--p-rgb:232,113,43;--a:#F59E0B;--s:#FB7185;color:var(--dh-ink)}
.dh[data-theme=dark]{--dh-bg:#0A0E27;--dh-glass:rgba(255,255,255,.07);--dh-glass2:rgba(255,255,255,.10);--dh-line:rgba(255,255,255,.13);--dh-ink:#F8FAFC;--dh-mut:#A3AFC2;--dh-mut2:#7C8AA0;--dh-track:rgba(255,255,255,.10);--dh-soft:rgba(255,255,255,.06);--dh-hero:linear-gradient(135deg,rgba(15,23,42,.9),rgba(23,33,52,.9));--dh-shadow:0 10px 40px -18px rgba(0,0,0,.7)}
/* الكرات الضبابية خلف اللوحة */
.dh-orbs{position:absolute;inset:-20px;overflow:hidden;pointer-events:none;z-index:0;border-radius:24px}
.dh-orb{position:absolute;border-radius:9999px;filter:blur(80px);opacity:.28;will-change:transform}
.dh-orb.a{width:420px;height:420px;top:-140px;right:-120px;background:radial-gradient(circle,var(--p),transparent 65%);animation:dhFloat 14s ease-in-out infinite}
.dh-orb.b{width:380px;height:380px;top:38%;left:-160px;background:radial-gradient(circle,#2563EB,transparent 65%);opacity:.18;animation:dhFloat 18s ease-in-out infinite reverse}
.dh-orb.c{width:320px;height:320px;bottom:-140px;right:30%;background:radial-gradient(circle,var(--s),transparent 65%);opacity:.2;animation:dhFloat 22s ease-in-out infinite}
.dh[data-theme=dark] .dh-orb{opacity:.5}.dh[data-theme=dark] .dh-orb.b{opacity:.35}.dh[data-theme=dark] .dh-orb.c{opacity:.3}
@keyframes dhFloat{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(30px,-40px,0)}}
.dh>*:not(.dh-orbs){position:relative;z-index:1}
/* بطاقة زجاجية بحافة متدرجة */
.dh .glass,.dh-period,.dh-alerts,.dh-kpi,.dh-ai,.dh .dw-panel,.dh-q{position:relative;background:var(--dh-glass);backdrop-filter:blur(20px) saturate(140%);-webkit-backdrop-filter:blur(20px) saturate(140%);border:1px solid var(--dh-line);border-radius:18px;box-shadow:var(--dh-shadow)}
.dh .dw-panel{overflow:hidden}
.dh-kpi::before,.dh .dw-panel::before,.dh-q::before,.dh-alerts::before,.dh-ai::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;background:linear-gradient(135deg,rgba(245,158,11,.55),rgba(232,113,43,.12) 45%,rgba(251,113,133,.45));-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;opacity:.9}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.dh-period,.dh-alerts,.dh-kpi,.dh-ai,.dh .dw-panel,.dh-q{background:var(--dh-glass2)}}
/* دخول متدرج */
.dh-period,.dh-summary,.dh-alerts,.dh-ins,.dh-ai,.dh-kpis,.dh-ops,.dh .dw-row,.dh-quick{animation:dhUp .45s ease-out both}
.dh-summary{animation-delay:.05s}.dh-alerts{animation-delay:.1s}.dh-kpis{animation-delay:.15s}.dh-ops{animation-delay:.2s}.dh .dw-row{animation-delay:.25s}.dh-quick{animation-delay:.3s}
@keyframes dhUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.dh-orb{animation:none!important}.dh-period,.dh-summary,.dh-alerts,.dh-ins,.dh-ai,.dh-kpis,.dh-ops,.dh .dw-row,.dh-quick{animation:none}}
/* رأس اللوحات (يلغي ألوان Shell الافتراضية داخل اللوحة) */
.dh .dw-ph{border-bottom:1px solid var(--dh-line)}.dh .dw-ph b{color:var(--dh-ink)}
.dh .dw-tbl th{background:var(--dh-soft);color:var(--dh-mut);border-bottom:1px solid var(--dh-line)}
.dh .dw-tbl td{border-bottom:1px solid var(--dh-line);color:var(--dh-ink)}.dh .dw-tbl tbody tr:hover{background:var(--dh-soft)}
.dh .dw-cand small{color:var(--dh-mut)}.dh .dw-fl{color:var(--dh-mut)}.dh .dw-fv{color:var(--dh-mut)}
.dh .dw-fbar{background:var(--dh-track)}.dh .dw-ffill{background:linear-gradient(90deg,var(--a),var(--p))}
.dh .dw-tbar{background:var(--dh-track)}.dh .dw-tn{color:var(--dh-ink)}.dh .dw-tn small{color:var(--dh-mut)}.dh .dw-tv{color:var(--dh-ink)}
.dh .dw-a{color:var(--p)}
.dh .dh-donut-track{stroke:var(--dh-track)}.dh .dh-donut-n{fill:var(--dh-ink)}.dh .dh-donut-l{fill:var(--dh-mut)}
/* الفترة والفلاتر */
.dh-period{padding:12px 14px;margin-bottom:14px}
.dh-fsel select{max-width:100%;min-width:0;font-family:inherit;font-size:12.5px;font-weight:600;color:var(--dh-ink);border:1px solid var(--dh-line);border-radius:9px;padding:6px 8px;background:var(--dh-glass2);cursor:pointer}
.dh-filters{display:flex;flex-wrap:wrap;align-items:center;gap:9px}
.dh-fsel{display:flex;align-items:center;gap:6px;color:var(--dh-mut);min-width:0;max-width:100%}.dh-fsel select{flex:1;min-width:0}
.dh-clear{border:none;background:var(--bad-bg);color:var(--bad-ink);font-family:inherit;font-size:11.5px;font-weight:700;padding:6px 11px;border-radius:9px;cursor:pointer}
/* ملخّص الفترة (بطل) */
.dh-summary{background:var(--dh-hero);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:14px 16px;margin-bottom:14px;box-shadow:0 20px 50px -30px rgba(0,0,0,.6);position:relative;overflow:hidden}
.dh-summary::after{content:"";position:absolute;inset:auto -60px -120px auto;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(232,113,43,.45),transparent 65%);filter:blur(30px);pointer-events:none}
.dh-sm-h{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:#cfe0f0;margin-bottom:11px;position:relative}
.dh-sm-h b{color:#fff;font-weight:800}
.dh-sm-h em{color:#f6b98e;font-style:normal;font-weight:700}
.dh-sm-cmp{margin-inline-start:auto;font-size:11px;color:#9fb8cf;font-weight:600}
.dh-sm-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;position:relative}
.dh-sm{background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-radius:12px;padding:9px 11px;display:flex;flex-direction:column;gap:2px}
.dh-sm-t{font-size:10.5px;color:#b8c7d8;font-weight:700}
.dh-sm-v{font-size:16px;font-weight:800;color:#fff;letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dh-sm-d{font-size:10.5px;font-weight:800}
/* التنبيهات */
.dh-alerts{padding:14px 16px;margin-bottom:14px}
.dh-al-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.dh-al-h span{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;color:var(--dh-ink)}
.dh-al-h b{background:var(--bad-bg);color:var(--bad-ink);font-size:11px;font-weight:800;padding:2px 9px;border-radius:20px}
.dh-al-ok{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;color:var(--ok-ink);background:var(--ok-bg);border-radius:11px;padding:11px 13px}
.dh-al-list{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.dh-al{display:flex;align-items:center;gap:9px;border:none;border-radius:11px;padding:10px 12px;cursor:pointer;font-family:inherit;text-align:start;width:100%;transition:transform .15s}
.dh-al:hover{transform:translateX(-3px)}
.dh-al-ic{display:flex;flex:none}
.dh-al-t{flex:1;font-size:12.5px;font-weight:700;line-height:1.4}
/* المؤشرات */
.dh-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:14px}
.dh-ops{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
.dh-kpi{padding:14px;transition:transform .2s,box-shadow .2s}
.dh-kpi.dw-clk:hover{transform:translateY(-4px);box-shadow:0 0 40px -10px rgba(var(--p-rgb),.45),var(--dh-shadow);border-color:transparent}
.dh-kh{display:flex;align-items:center;justify-content:space-between;gap:6px}
.dh-kl{font-size:11px;color:var(--dh-mut);font-weight:700;line-height:1.3}
.dh-ki{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none;filter:drop-shadow(0 0 6px rgba(0,0,0,.05))}
.dh-docs{display:inline-flex;gap:4px;flex-wrap:wrap}.dh-docs .g-badge{padding:1px 7px;font-size:10.5px;direction:ltr;unicode-bidi:isolate}
.dw-rate{color:var(--p-ink);font-weight:700}.dw-trd{margin-inline-start:5px;font-size:10px;font-weight:800}.dw-trd.up{color:var(--ok-ink)}.dw-trd.down{color:var(--bad-ink)}.dw-trd.flat{color:var(--mut-2)}
.dh-kn{font-size:23px;font-weight:800;margin-top:9px;letter-spacing:-.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:linear-gradient(90deg,var(--dh-ink),var(--dh-ink));-webkit-background-clip:text;background-clip:text}
.dh-kd{font-size:11px;font-weight:700}
.dh-kfoot{display:flex;align-items:flex-end;justify-content:space-between;gap:6px;margin-top:3px}
.dh-spark{flex:none;opacity:.9}
.dh-delta{font-size:11px;font-weight:800;margin-inline-start:7px;vertical-align:2px;white-space:nowrap}
/* الرؤى */
.dh-ins{background:var(--dh-hero);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:14px 16px;margin-bottom:14px;box-shadow:0 20px 50px -30px rgba(0,0,0,.6)}
.dh-ins-h{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:800;color:#fff;margin-bottom:11px}
.dh-ins-list{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.dh-ins-i{display:flex;align-items:flex-start;gap:9px;background:rgba(255,255,255,.96);border-inline-start:3px solid #ccc;border-radius:11px;padding:10px 12px;font-size:12px;font-weight:600;color:#1d2939;line-height:1.55}
.dh-ins-ic{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex:none}
.dh-ai{padding:14px 16px;margin-bottom:14px}
.dh-ai-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:11px}
.dh-ai-hl{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:800;color:var(--dh-ink)}
.dh-ai-cnt{font-size:11px;font-weight:700;color:var(--dh-mut);background:var(--dh-soft);border-radius:20px;padding:3px 10px}
.dh-ai-list{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.dh-ai-i{border:1px solid var(--dh-line);border-inline-start:3px solid #ccc;border-radius:12px;padding:11px 13px;background:var(--dh-soft)}
.dh-ai-t{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--dh-ink)}
.dh-ai-t b{font-weight:800;line-height:1.4}
.dh-ai-tag{margin-inline-start:auto;font-size:10px;font-weight:700;color:var(--dh-mut);background:var(--dh-soft);border-radius:20px;padding:2px 8px;flex:none}
.dh-ai-b{font-size:11.5px;color:var(--dh-mut);font-weight:600;line-height:1.65;margin-top:7px}
.dh-ai-r{font-size:11px;color:#175cd3;font-weight:700;line-height:1.55;margin-top:6px;background:#eff6ff;border-radius:8px;padding:6px 9px}
.dh[data-theme=dark] .dh-ai-r{background:rgba(37,99,235,.18);color:#93c5fd}
@media(max-width:1100px){.dh-ai-list{grid-template-columns:1fr}}
/* الأهداف */
.dh-targets{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
.dh-tg{display:flex;flex-direction:column;gap:6px}
.dh-tg-top{display:flex;flex-direction:column;gap:2px}
.dh-tg-k{font-size:11px;color:var(--dh-mut);font-weight:700;line-height:1.35;min-height:30px}
.dh-tg-v{font-size:17px;font-weight:800}.dh-tg-v small{font-size:10.5px;color:var(--dh-mut2);font-weight:600}
.dh-tg-bar{height:6px;border-radius:6px;background:var(--dh-track);overflow:hidden}.dh-tg-bar div{height:100%;border-radius:6px}
.dh-tg-badge{align-self:flex-start;font-size:10px;font-weight:800;padding:2px 9px;border-radius:20px}
.dh-gran{display:flex;gap:2px;background:var(--dh-soft);border-radius:9px;padding:2px}
.dh-gran button{border:none;background:none;font-family:inherit;font-size:11.5px;font-weight:700;color:var(--dh-mut);padding:5px 12px;border-radius:7px;cursor:pointer}
.dh-gran button.on{background:var(--dh-glass2);color:var(--dh-ink);box-shadow:0 1px 2px rgba(16,24,40,.1)}
.dh-note{font-size:11px;color:var(--dh-mut2);font-weight:600;margin-bottom:8px;line-height:1.5}
/* التدفق النقدي */
.dh-cf{display:flex;align-items:flex-end;gap:6px;height:64px;padding:0 2px}
.dh-cf-day{gap:2px}
.dh-cf-day .dh-cf-bars{gap:0}
.dh-cf-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;background:none;border:none;padding:4px 2px 0;border-radius:8px;font-family:inherit}
.dh-cf-bars{display:flex;align-items:flex-end;gap:3px;height:48px}
.dh-cf-in{width:8px;border-radius:3px 3px 0 0;background:linear-gradient(180deg,#32d583,var(--ok))}
.dh-cf-out{width:8px;border-radius:3px 3px 0 0;background:linear-gradient(180deg,#fb7185,var(--bad))}
.dh-cf-m{font-size:9.5px;color:var(--dh-mut2);font-weight:700;white-space:nowrap}
.dh-cf-lg{display:flex;gap:14px;justify-content:center;margin-top:6px;font-size:10.5px;color:var(--dh-mut);font-weight:600}
.dh-cf-lg span{display:flex;align-items:center;gap:5px}.dh-cf-lg i{width:9px;height:9px;border-radius:3px}
.dh-catlist{display:flex;flex-direction:column;gap:7px}
.dh-cat{display:flex;align-items:center;gap:10px;border:1px solid transparent;background:var(--dh-soft);border-radius:10px;padding:8px 11px;cursor:pointer;font-family:inherit;text-align:start;width:100%}
.dh-cat:hover{border-color:var(--dh-line)}
.dh-cat.on{border-color:var(--p);background:rgba(var(--p-rgb),.10)}
.dh-cat-k{flex:none;width:38%;font-size:12px;font-weight:700;color:var(--dh-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dh-cat-bar{flex:1;height:8px;background:var(--dh-track);border-radius:6px;overflow:hidden}.dh-cat-bar div{height:100%;background:linear-gradient(90deg,var(--a),var(--p));border-radius:6px}
.dh-cat-v{flex:none;font-size:12px;font-weight:800;color:var(--dh-ink);white-space:nowrap}.dh-cat-v small{color:var(--dh-mut2);font-weight:600}
.dh-mini{display:flex;align-items:center;justify-content:space-between;font-size:11.5px;color:var(--dh-mut);border-top:1px solid var(--dh-line);padding-top:7px}
.dh-mini b{color:var(--dh-ink);font-size:13px}
.dh-fin{display:flex;flex-direction:column;gap:10px}
.dh-fin-row{display:flex;align-items:center;gap:11px}
.dh-fin-row.hi{background:rgba(18,183,106,.08);border:1px solid rgba(18,183,106,.25);border-radius:11px;padding:8px 10px;margin:-2px 0}
.dh-fin-ic{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none}
.dh-fin-l{font-size:12.5px;color:var(--dh-mut);font-weight:600}
.dh-fin-row b{font-size:14px;font-weight:800;color:var(--dh-ink)}
.dh-fin-tot{display:flex;align-items:center;justify-content:space-between;border-top:1px dashed var(--dh-line);margin-top:4px;padding-top:11px;font-size:12.5px;color:var(--dh-mut);font-weight:700}
.dh-fin-tot b{font-size:17px;font-weight:800}
.dh-empty{display:flex;flex-direction:column;align-items:center;gap:5px;padding:26px 16px;text-align:center;color:var(--dh-mut2)}
.dh-empty b{font-size:13.5px;color:var(--dh-ink)}.dh-empty span{font-size:11.5px;max-width:320px;line-height:1.6}
/* الاختصارات */
.dh-quick{display:grid;grid-template-columns:repeat(8,1fr);gap:10px;margin-top:14px}
.dh-q{display:flex;flex-direction:column;align-items:center;gap:7px;padding:14px 8px;font-family:inherit;font-size:11.5px;font-weight:700;color:var(--dh-ink);cursor:pointer;transition:transform .15s,box-shadow .2s}
.dh-q:hover{transform:translateY(-3px);box-shadow:0 0 34px -10px rgba(var(--p-rgb),.5),var(--dh-shadow)}
.dh-q-ic{width:38px;height:38px;border-radius:11px;background:rgba(var(--p-rgb),.14);color:var(--p);display:flex;align-items:center;justify-content:center}
.dh-q:hover .dh-q-ic{filter:drop-shadow(0 0 6px rgba(var(--p-rgb),.7))}
@media(max-width:1100px){.dh-kpis{grid-template-columns:repeat(3,1fr)}.dh-ops{grid-template-columns:repeat(2,1fr)}.dh-quick{grid-template-columns:repeat(4,1fr)}.dh-al-list{grid-template-columns:1fr}.dh-ins-list{grid-template-columns:1fr}.dh-targets{grid-template-columns:repeat(2,1fr)}.dh-sm-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:640px){.dh-kpis{grid-template-columns:repeat(2,1fr)}.dh-ops{grid-template-columns:repeat(2,1fr)}.dh-quick{grid-template-columns:repeat(4,1fr)}.dh-targets{grid-template-columns:repeat(2,1fr)}.dh-tg-k{min-height:0}.dh-sm-grid{grid-template-columns:repeat(2,1fr)}.dh-cat-k{width:34%}.dh-orb{filter:blur(50px)}}
`;
