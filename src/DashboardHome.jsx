import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{payoutForBiker}from"./sweaterContract";

const money=n=>Number(n||0).toLocaleString("en-US",{maximumFractionDigits:0})+" ﷼";
const periodAr=p=>{if(!p)return"—";const[y,m]=String(p).split("-");const M=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];return`${M[(+m||1)-1]} ${y}`;};
const curMonth=()=>new Date().toISOString().slice(0,7);
const maxPeriod=arr=>arr.reduce((mx,r)=>r.period&&r.period>mx?r.period:mx,"");
const fmtD=d=>d?new Date(d+"T00:00:00").toLocaleDateString("en-GB"):"—";

// لوحة القيادة الشاملة — بيانات حيّة من كل وحدات النظام
export default function DashboardHome({onNav}){
  const nav=k=>onNav&&onNav(k);
  const[d,setD]=useState(null);
  const[selFin,setSelFin]=useState(null);   // الشهر المعروض في اللوحة المالية

  useEffect(()=>{(async()=>{
    const q=(t,c)=>supabase.from(t).select(c).then(({data})=>data||[]).then(x=>x,()=>[]);
    const[apps,visits,emps,teams,ivs,onb,ops,pay,viol,rounds,vexp,docs,fveh,finc,hunits,hpays,hviol,screq,scitems,setts,fin,tix]=await Promise.all([
      q("applicants","full_name,application_number,status,ai_classification,ai_score_total,location,saudi_city,bangladesh_district,submitted_at"),
      supabase.from("page_visits").select("step,session_id").eq("page","ad_page").then(({data})=>data||[],()=>[]),
      q("employees","full_name,employee_id,team_id,staff_role,profession_ok"),
      q("teams","id,name,supervisor_user_id"),
      q("interview_sessions","status,decision,rating"),
      q("onboarding","progress"),
      q("ops_biker_month","period,biker_name,net_washes,rating,complaint_pct"),
      q("payroll_lines","period,role,total"),
      q("violations","status,severity,fine_applied"),
      q("field_rounds","compliance_pct,period,status"),
      q("vendor_expenses","exp_date,amount"),
      q("renewal_docs","doc_type,subject,end_date,active"),
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
    ]);
    setD({apps,visits,emps,teams,ivs,onb,ops,pay,viol,rounds,vexp,docs,fveh,finc,hunits,hpays,hviol,screq,scitems,setts,fin,tix});
  })();},[]);

  const s=useMemo(()=>{
    if(!d)return null;
    const today=new Date();today.setHours(0,0,0,0);
    const dLeft=end=>end?Math.round((new Date(end+"T00:00:00")-today)/86400000):null;
    const A=d.apps;
    const accepted=A.filter(a=>a.status==="accepted").length;
    const rejected=A.filter(a=>a.status==="rejected").length;
    const pending=A.filter(a=>a.status==="pending"||!a.status).length;
    // القمع
    const sess={};d.visits.forEach(v=>{const m=String(v.step||"").match(/^([0-9])/);if(!m)return;sess[v.session_id]=Math.max(sess[v.session_id]||0,+m[1]);});
    const sv=Object.values(sess);const reached=lv=>sv.filter(x=>x>=lv).length;
    const total0=reached(0)||sv.length;
    const funnel=[["دخول الإعلان",reached(0)],["المزايا",reached(1)],["الحاسبة",reached(2)],["يوم في الحياة",reached(3)],["الأسئلة",reached(4)],["زر التقديم",reached(5)]];
    const bikers=d.emps.filter(e=>e.staff_role!=="manager");
    // العمليات
    const opP=maxPeriod(d.ops);const opsL=d.ops.filter(o=>o.period===opP);
    const washes=opsL.reduce((a,o)=>a+Number(o.net_washes||0),0);
    const ratings=opsL.map(o=>Number(o.rating)).filter(x=>x>0);
    const avgRating=ratings.length?ratings.reduce((a,b)=>a+b,0)/ratings.length:0;
    const topBikers=[...opsL].sort((a,b)=>Number(b.net_washes||0)-Number(a.net_washes||0)).slice(0,6);
    const maxW=topBikers.reduce((m,o)=>Math.max(m,Number(o.net_washes||0)),0)||1;
    // الرواتب
    const payP=maxPeriod(d.pay);const payL=d.pay.filter(p=>p.period===payP);
    const payrollTotal=payL.reduce((a,p)=>a+Number(p.total||0),0);
    // الجودة
    const openViol=d.viol.filter(v=>!["closed","settled","paid","rejected"].includes(String(v.status||"").toLowerCase())).length;
    const finesTotal=d.viol.reduce((a,v)=>a+Number(v.fine_applied||0),0);
    const compVals=d.rounds.map(r=>Number(r.compliance_pct)).filter(x=>!isNaN(x));
    const avgComp=compVals.length?Math.round(compVals.reduce((a,b)=>a+b,0)/compVals.length):null;
    const vendMonth=d.vexp.filter(e=>String(e.exp_date||"").slice(0,7)===curMonth()).reduce((a,e)=>a+Number(e.amount||0),0);
    const expTotal=d.vexp.reduce((a,e)=>a+Number(e.amount||0),0);
    const ivPending=d.ivs.filter(i=>i.status!=="completed").length;
    const onbAvg=d.onb.length?Math.round(d.onb.reduce((a,o)=>a+Number(o.progress||0),0)/d.onb.length):0;

    // ── الوحدات الجديدة ──
    const docsA=d.docs.filter(x=>x.active!==false);
    const docExpired=docsA.filter(x=>{const l=dLeft(x.end_date);return l!=null&&l<0;});
    const docSoon=docsA.filter(x=>{const l=dLeft(x.end_date);return l!=null&&l>=0&&l<=30;});
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

    // ── الإيراد والهامش ── (يفضّل صافي تسوية سويتر المعتمدة، وإلا تقدير مرتبط بالفترة)
    const settRow=(d.setts||[]).find(x=>x.period===opP&&x.status==="confirmed"&&x.net_total!=null);
    const revenue=settRow?Number(settRow.net_total):opsL.reduce((a,o)=>a+payoutForBiker(Number(o.net_washes||0),opP).total,0);
    const costs=(payrollTotal||0)+(vendMonth||0)+houseMonthly+(finesTotal||0);
    const margin=revenue-costs;

    // ── التدفّق النقدي الفعلي (كشف الحساب البنكي المصنّف) ──
    const fin=d.fin||[];
    const finP=maxPeriod(fin);
    const finRows=fin.filter(x=>x.period===finP);
    const hasFin=finRows.length>0;
    const cashIn=finRows.filter(x=>x.direction==="in").reduce((a,x)=>a+Number(x.amount||0),0);
    const cashOut=finRows.filter(x=>x.direction==="out"&&!x.is_capital).reduce((a,x)=>a+Number(x.amount||0),0);
    const cashSweater=finRows.filter(x=>x.direction==="in"&&x.category==="إيراد سويتر").reduce((a,x)=>a+Number(x.amount||0),0);
    const cashFund=cashIn-cashSweater;
    const cashNet=cashIn-cashOut;
    const coverPct=cashOut>0?Math.round(cashSweater/cashOut*100):null;

    // ── شكاوى سويتر (مسار الجودة والاعتماد) ──
    const tix=d.tix||[];
    const tixP=maxPeriod(tix)||opP;
    const tPending=tix.filter(t=>t.status==="pending_review").length;
    const tReviewed=tix.filter(t=>t.status==="reviewed").length;
    const tApproved=tix.filter(t=>t.period===tixP&&t.decision==="approved").length;
    const tTotal=tix.length;

    // ── مركز التنبيهات ──
    const alerts=[];
    if(tReviewed)alerts.push({sev:"warn",ic:"complaints",t:`${tReviewed} شكوى سويتر بانتظار اعتمادك`,k:"complaints"});
    if(hasFin&&cashNet<0)alerts.push({sev:"warn",ic:"cash",t:`عجز نقدي ${money(Math.abs(cashNet))} في ${periodAr(finP)} — مُغطّى بتمويل داخلي`,k:"reports"});
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

    // ── سلاسل شهرية (آخر 6 أشهر) ──
    const allP=[...new Set([...d.ops.map(o=>o.period),...(d.fin||[]).map(f=>f.period),...(d.setts||[]).map(x=>x.period),...(d.tix||[]).map(t=>t.period)].filter(Boolean))].sort();
    const last6=allP.slice(-6);
    const washByP=p=>d.ops.filter(o=>o.period===p).reduce((a,o)=>a+Number(o.net_washes||0),0);
    const revByP=p=>{const r=(d.setts||[]).find(x=>x.period===p&&x.status==="confirmed"&&x.net_total!=null);return r?Number(r.net_total):d.ops.filter(o=>o.period===p).reduce((a,o)=>a+payoutForBiker(Number(o.net_washes||0),p).total,0);};
    const cashOf=p=>{const f=(d.fin||[]).filter(x=>x.period===p);if(!f.length)return null;const i=f.filter(x=>x.direction==="in").reduce((a,x)=>a+Number(x.amount||0),0);const o=f.filter(x=>x.direction==="out"&&!x.is_capital).reduce((a,x)=>a+Number(x.amount||0),0);const sw=f.filter(x=>x.direction==="in"&&x.category==="إيراد سويتر").reduce((a,x)=>a+Number(x.amount||0),0);return{i,o,net:i-o,sw};};
    const apprByP=p=>(d.tix||[]).filter(t=>t.period===p&&t.decision==="approved").length;
    const series={months:last6,wash:last6.map(washByP),rev:last6.map(revByP),cash:last6.map(p=>{const c=cashOf(p);return c?c.net:0;}),appr:last6.map(apprByP)};
    const finChart=last6.map(p=>{const c=cashOf(p);return{p,i:c?c.i:0,o:c?c.o:0,net:c?c.net:0,sw:c?c.sw:0,has:!!c};});
    const iCur=last6.length-1;
    const dOf=arr=>{if(arr.length<2)return null;const c=arr[iCur],pv=arr[iCur-1];if(pv==null||pv===0)return null;return Math.round((c-pv)/Math.abs(pv)*100);};
    const deltas={wash:dOf(series.wash),rev:dOf(series.rev),cash:dOf(series.cash),appr:dOf(series.appr)};

    // ── الأهداف وإشارات الصحّة ──
    const bikersN=opsL.length||1;
    const avgWashPer=washes/bikersN;
    const complaintPctCur=washes?apprByP(opP)/washes*100:0;
    const targets=[
      {k:"غسلات/بايكر (الحدّ المضمون)",v:avgWashPer,t:196,unit:"",good:avgWashPer>=196,warn:avgWashPer>=170,fmt:x=>Math.round(x)},
      {k:"متوسط التقييم",v:avgRating,t:4.75,unit:"",good:avgRating>=4.75,warn:avgRating>=4.5,fmt:x=>x?x.toFixed(2):"—"},
      {k:"نسبة الشكاوى المعتمدة",v:complaintPctCur,t:1,unit:"%",good:complaintPctCur<=1,warn:complaintPctCur<=2,fmt:x=>x.toFixed(1)},
      {k:"تغطية إيراد سويتر",v:coverPct==null?0:coverPct,t:100,unit:"%",good:coverPct!=null&&coverPct>=100,warn:coverPct!=null&&coverPct>=70,fmt:x=>Math.round(x)},
      {k:"الامتثال الميداني",v:avgComp,t:99,unit:"%",good:avgComp!=null&&avgComp>=99,warn:avgComp!=null&&avgComp>=90,fmt:x=>x==null?"—":x},
    ];

    // ── رؤى ذكية ──
    const insights=[];
    if(deltas.wash!=null)insights.push({tone:deltas.wash>=0?"good":"bad",ic:"operations",t:`الغسلات ${deltas.wash>=0?"ارتفعت":"انخفضت"} ${Math.abs(deltas.wash)}% عن الشهر السابق (${washes.toLocaleString("en-US")} غسلة).`});
    if(coverPct!=null)insights.push({tone:coverPct>=100?"good":"bad",ic:"cash",t:coverPct>=100?`إيراد سويتر يغطّي المصروف بالكامل (${coverPct}%).`:`إيراد سويتر يغطّي ${coverPct}% فقط من المصروف — الفجوة تُموَّل داخلياً.`});
    const belowMin=opsL.filter(o=>Number(o.net_washes||0)<196).length;
    if(belowMin)insights.push({tone:"warn",ic:"bike",t:`${belowMin} بايكر تحت الحدّ المضمون (196 غسلة) — أثر على الشريحة والحافز.`});
    if(avgRating&&avgRating<4.75)insights.push({tone:"warn",ic:"star",t:`متوسط التقييم ${avgRating.toFixed(2)} دون شرط الحافز (4.75).`});
    if(topBikers[0]&&Number(topBikers[0].net_washes||0)>0)insights.push({tone:"good",ic:"performance",t:`${topBikers[0].biker_name} الأعلى إنتاجية هذا الشهر (${Number(topBikers[0].net_washes||0)} غسلة).`});
    if(tReviewed)insights.push({tone:"warn",ic:"complaints",t:`${tReviewed} شكوى بانتظار اعتمادك — قرارها يؤثّر على رواتب البايكرز.`});
    const toneRank={bad:0,warn:1,good:2};
    insights.sort((a,b)=>toneRank[a.tone]-toneRank[b.tone]);
    const insTop=insights.slice(0,3);

    return{series,finChart,deltas,targets,insTop,
      A,accepted,rejected,pending,funnel,total0,bikers,teams:d.teams,opP,opsL,washes,avgRating,topBikers,maxW,payP,payrollTotal,
      openViol,finesTotal,avgComp,rounds:d.rounds,vendMonth,expTotal,ivPending,onbAvg,
      docExpired:docExpired.length,docSoon:docSoon.length,nVeh:fveh.length,stolen,fMaint,fIncOpen,gpsCov,
      hpNext,hpNextDl,hvOpen,houseMonthly,scPending,scLow,revenue,costs,margin,alerts,
      finP,hasFin,cashIn,cashOut,cashSweater,cashFund,cashNet,coverPct,
      tixP,tPending,tReviewed,tApproved,tTotal};
  },[d]);

  if(!s)return(<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>{[...Array(6)].map((_,i)=><div key={i} className="dw-skel" style={{height:92}}/>)}</div>);

  const {A,accepted,rejected,pending,funnel,total0,bikers,teams,opP,washes,avgRating,topBikers,maxW,payP,payrollTotal,openViol,finesTotal,avgComp,vendMonth,expTotal,ivPending,onbAvg,
    docExpired,docSoon,nVeh,stolen,fMaint,fIncOpen,gpsCov,hpNext,hpNextDl,hvOpen,houseMonthly,scPending,scLow,revenue,costs,margin,alerts,
    finP,hasFin,cashIn,cashOut,cashSweater,cashFund,cashNet,coverPct,tixP,tPending,tReviewed,tApproved,tTotal,
    series,finChart,deltas,targets,insTop}=s;
  // اللوحة المالية: الشهر المختار (أو الأحدث)
  const fS=(finChart.find(x=>x.p===selFin))||finChart[finChart.length-1]||{i:0,o:0,net:0,sw:0,has:false,p:finP};
  const selFund=fS.i-fS.sw, selCover=fS.o>0?Math.round(fS.sw/fS.o*100):null;
  const finMax=Math.max(1,...finChart.map(x=>Math.max(x.i,x.o)));
  const recent=A.slice(0,4);
  const scoreCol=v=>v==null?["#eef1f4","#94a3b8"]:v>=6.5?["#e7f7ef","#087443"]:v>=5?["#fef3e2","#b54708"]:["#feecea","#b42318"];
  const stName=x=>x==="accepted"?"مقبول":x==="rejected"?"مرفوض":"معلّق";
  const stCls=x=>x==="accepted"?"p-acc":x==="rejected"?"p-rej":"p-pend";
  const av=i=>["#f79009","#12b76a","#2e90fa","#7c3aed","#64748b","#e8712b"][i%6];
  const sevC={crit:["#feecea","#b42318"],warn:["#fff3e2","#c2410c"],info:["#eef4ff","#1d5bbf"]};

  return(<div className="dh">
    <style>{CSS}</style>

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
      <div className="dh-ins-h"><Icon n="robot" s={16}/> رؤى ذكية</div>
      <div className="dh-ins-list">
        {insTop.map((x,i)=>{const cc=x.tone==="good"?"#087443":x.tone==="bad"?"#b42318":"#b54708";const bg=x.tone==="good"?"#e7f7ef":x.tone==="bad"?"#feecea":"#fef3e2";return(
          <div className="dh-ins-i" key={i} style={{borderInlineStartColor:cc}}><span className="dh-ins-ic" style={{background:bg,color:cc}}><Icon n={x.ic} s={14}/></span><span>{x.t}</span></div>);})}
      </div>
    </div>}

    {/* شريط المؤشرات الأساسي */}
    <div className="dh-kpis">
      <Kpi label="البايكرز" ic="bike" ib="#fff2e8" c="#E8712B" n={bikers.length} sub={`${teams.length} فرق`} onClick={()=>nav("employees")}/>
      <Kpi label="المتقدّمون" ic="applicants" ib="#eef4ff" c="#1d5bbf" n={A.length} sub={`${pending} قيد المراجعة`} onClick={()=>nav("recruitment")}/>
      <Kpi label={"غسلات · "+(opP?periodAr(opP):"—")} ic="operations" ib="#e7f7ef" c="#087443" n={washes.toLocaleString("en-US")} sub={avgRating?`تقييم ${avgRating.toFixed(2)}`:"لا بيانات بعد"} delta={deltas.wash} spark={series.wash} onClick={()=>nav("operations")}/>
      <Kpi label={"رواتب · "+(payP?periodAr(payP):"—")} ic="payroll" ib="#f6f2ff" c="#6d4bcb" n={payrollTotal?money(payrollTotal):"—"} sub={payP?"آخر مسير":"لم يُشغّل بعد"} onClick={()=>nav("payroll")}/>
      <Kpi label="الامتثال الميداني" ic="rounds" ib="#eefaf3" c="#087443" n={avgComp!=null?avgComp+"%":"—"} sub={s.rounds.length?`${s.rounds.length} جولة`:"لا جولات بعد"} onClick={()=>nav("field_rounds")}/>
      <Kpi label="شكاوى سويتر" ic="complaints" ib="#feecea" c="#b42318" n={tPending+tReviewed} sub={tReviewed?`${tReviewed} بانتظار اعتمادك`:(tTotal?`${tApproved} معتمدة · ${tTotal} إجمالاً`:"لا شكاوى")} tone={tReviewed?"red":""} delta={deltas.appr} inv spark={series.appr} onClick={()=>nav("complaints")}/>
    </div>

    {/* شريط تشغيلي — الوحدات الجديدة */}
    <div className="dh-ops">
      <Kpi label="الأسطول" ic="bike" ib="#eef4ff" c="#1d5bbf" n={nVeh} sub={`${fIncOpen} حوادث · تتبّع ${gpsCov}%`} tone={stolen?"red":""} onClick={()=>nav("fleet")}/>
      <Kpi label="السكن — الدفعة القادمة" ic="home" ib="#fff2e8" c="#c2410c" n={hpNext?money(hpNext.amount):"—"} sub={hpNext?`تستحق ${fmtD(hpNext.due_date)}`:"مكتمل"} onClick={()=>nav("housing")}/>
      <Kpi label="الوثائق — عاجلة ≤30" ic="doc" ib="#fef3e2" c="#b54708" n={docSoon} sub={docExpired?`${docExpired} منتهية`:"لا منتهية"} tone={docExpired?"red":""} onClick={()=>nav("renewals")}/>
      <Kpi label="الإمداد — طلبات معلّقة" ic="bucket" ib="#eefaf3" c="#087443" n={scPending} sub={scLow?`${scLow} تحت الحدّ`:"المخزون متوازن"} onClick={()=>nav("supply")}/>
    </div>

    {/* أهداف الأداء — إشارات صحّة مقابل العقد */}
    <div className="dw-row">
      <div className="dw-panel">
        <div className="dw-ph"><b>أهداف الأداء · {opP?periodAr(opP):"—"}</b><span className="dw-a">مقابل معايير العقد</span></div>
        <div className="dw-pb dh-targets">
          {targets.map((g,i)=>{const cc=g.good?"#087443":g.warn?"#b54708":"#b42318";const bg=g.good?"#e7f7ef":g.warn?"#fef3e2":"#feecea";const pct=g.v==null?0:Math.max(0,Math.min(100,g.unit==="%"||g.t<=5?(g.v/g.t*100):(g.v/g.t*100)));return(
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
            <Leg c="#12b76a" t="مقبول" v={accepted}/><Leg c="#f79009" t="قيد المراجعة" v={pending}/><Leg c="#f04438" t="مرفوض" v={rejected}/>
            <div className="dh-mini"><span>مقابلات معلّقة</span><b>{ivPending}</b></div>
            <div className="dh-mini"><span>متوسط التعاقد</span><b>{onbAvg}%</b></div>
          </div>
        </div>
      </div>
    </div>

    {/* العمليات + المالية */}
    <div className="dw-row dw-2">
      <div className="dw-panel">
        <div className="dw-ph"><b>أداء البايكرز — {opP?periodAr(opP):"—"}</b><span className="dw-a" onClick={()=>nav("operations")} role="button">العمليات <Icon n="fwd" s={12} style={{verticalAlign:"-2px"}}/></span></div>
        <div className="dw-pb">
          {topBikers.length===0?<Empty t="لا بيانات عمليات بعد" s="ارفع تقارير سويتر الشهرية لتظهر الغسلات هنا."/>:
          <div className="dw-team">{topBikers.map((o,i)=>(
            <div className="dw-tm" key={i}><div className="dw-tn">{o.biker_name||"—"}<small>{o.rating?`تقييم ${Number(o.rating).toFixed(2)}`:""}</small></div><div className="dw-tbar"><div style={{width:`${Math.round(Number(o.net_washes||0)/maxW*100)}%`,height:"100%",borderRadius:6,background:i===0?"#12b76a":"#E8712B"}}/></div><span className="dw-tv">{Number(o.net_washes||0)}</span></div>))}</div>}
        </div>
      </div>
      <div className="dw-panel">
        <div className="dw-ph"><b>التدفّق النقدي · {periodAr(fS.p)}</b><span className="dw-a" onClick={()=>nav("reports")} role="button">التقارير <Icon n="fwd" s={12} style={{verticalAlign:"-2px"}}/></span></div>
        <div className="dw-pb">
          {finChart.some(x=>x.has)?<>
            {/* مخطّط الأشهر — داخل/خارج (اضغط لاختيار الشهر) */}
            <div className="dh-cf">{finChart.map((x,i)=>{const sel=x.p===fS.p;return(
              <button key={i} className={"dh-cf-col"+(sel?" on":"")} onClick={()=>setSelFin(x.p)} title={periodAr(x.p)}>
                <div className="dh-cf-bars">
                  <div className="dh-cf-in" style={{height:Math.max(2,Math.round(x.i/finMax*46))+"px"}}/>
                  <div className="dh-cf-out" style={{height:Math.max(2,Math.round(x.o/finMax*46))+"px"}}/>
                </div>
                <span className="dh-cf-m">{periodAr(x.p).split(" ")[0].slice(0,3)}</span>
              </button>);})}</div>
            <div className="dh-cf-lg"><span><i style={{background:"#12b76a"}}/>داخل</span><span><i style={{background:"#f04438"}}/>خارج</span></div>
            <div className="dh-fin" style={{marginTop:10}}>
              <div className="dh-fin-row hi"><span className="dh-fin-ic" style={{background:"#e7f7ef",color:"#087443"}}><Icon n="cash" s={16}/></span><div style={{flex:1}}><div className="dh-fin-l">النقد الداخل</div><div style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>سويتر {money(fS.sw)} · تمويل {money(selFund)}</div></div><b>{money(fS.i)}</b></div>
              <div className="dh-fin-row"><span className="dh-fin-ic" style={{background:"#feecea",color:"#b42318"}}><Icon n="payroll" s={16}/></span><div style={{flex:1}}><div className="dh-fin-l">النقد الخارج (تشغيلي)</div></div><b>{money(fS.o)}</b></div>
              <div className="dh-fin-row"><span className="dh-fin-ic" style={{background:"#eef4ff",color:"#1d5bbf"}}><Icon n="chart" s={16}/></span><div style={{flex:1}}><div className="dh-fin-l">تغطية إيراد سويتر للمصروف</div></div><b style={{color:selCover!=null&&selCover>=100?"#087443":"#b54708"}}>{selCover!=null?selCover+"%":"—"}</b></div>
              <div className="dh-fin-tot"><span>الصافي النقدي</span><b style={{color:fS.net>=0?"#087443":"#b42318"}}>{money(fS.net)}</b></div>
              {fS.net<0&&<div style={{fontSize:11,color:"#b54708",fontWeight:700,marginTop:-2}}>عجز تشغيلي مُغطّى بتمويل داخلي.</div>}
            </div>
          </>:<div className="dh-fin">
            <div className="dh-fin-row hi"><span className="dh-fin-ic" style={{background:"#e7f7ef",color:"#087443"}}><Icon n="cash" s={16}/></span><div style={{flex:1}}><div className="dh-fin-l">إيراد سويتر التقديري</div></div><b>{revenue?money(revenue):"—"}</b></div>
            <div className="dh-fin-row"><span className="dh-fin-ic" style={{background:"#f6f2ff",color:"#6d4bcb"}}><Icon n="payroll" s={16}/></span><div style={{flex:1}}><div className="dh-fin-l">رواتب الفريق</div></div><b>{payrollTotal?money(payrollTotal):"—"}</b></div>
            <div className="dh-fin-tot"><span>الهامش التقديري</span><b style={{color:margin>=0?"#087443":"#b42318"}}>{revenue?money(margin):"—"}</b></div>
          </div>}
        </div>
      </div>
    </div>

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
  </div>);
}

function Kpi({label,ic,c,ib,n,sub,tone,onClick,delta,spark,inv}){
  const dc=tone==="red"?"#b42318":"#64748b";
  const up=delta!=null&&delta>=0;const good=inv?!up:up;const dcol=delta==null?null:(delta===0?"#94a3b8":good?"#087443":"#b42318");
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
  return(<svg width="118" height="118" viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.9" fill="none" stroke="#eef1f4" strokeWidth="6"/>{arc(A,"#12b76a",c1)}{arc(P,"#f79009",c2)}{arc(R,"#f04438",c3)}<text x="21" y="20.5" textAnchor="middle" fontSize="7" fontWeight="800" fill="#0f172a">{total}</text><text x="21" y="27" textAnchor="middle" fontSize="3.2" fill="#64748b">إجمالي</text></svg>);
}
function Leg({c,t,v}){return(<div style={{display:"flex",alignItems:"center",gap:8,fontSize:12.5,color:"#64748b"}}><i style={{width:10,height:10,borderRadius:3,background:c}}/>{t}<b style={{marginInlineStart:"auto",color:"#0f172a"}}>{v}</b></div>);}

const CSS=`
.dh-alerts{background:#fff;border:1px solid #eceef1;border-radius:15px;padding:14px 16px;margin-bottom:14px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.dh-al-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.dh-al-h span{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;color:#0f172a}
.dh-al-h b{background:#feecea;color:#b42318;font-size:11px;font-weight:800;padding:2px 9px;border-radius:20px}
.dh-al-ok{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;color:#087443;background:#e7f7ef;border-radius:11px;padding:11px 13px}
.dh-al-list{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.dh-al{display:flex;align-items:center;gap:9px;border:none;border-radius:11px;padding:10px 12px;cursor:pointer;font-family:inherit;text-align:start;width:100%}
.dh-al-ic{display:flex;flex:none}
.dh-al-t{flex:1;font-size:12.5px;font-weight:700;line-height:1.4}
.dh-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:14px}
.dh-ops{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
.dh-kpi{background:#fff;border:1px solid #eceef1;border-radius:15px;padding:14px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.dh-kh{display:flex;align-items:center;justify-content:space-between;gap:6px}
.dh-kl{font-size:11px;color:#64748b;font-weight:700;line-height:1.3}
.dh-ki{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none}
.dh-kn{font-size:23px;font-weight:800;margin-top:9px;letter-spacing:-.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dh-kd{font-size:11px;font-weight:700}
.dh-kfoot{display:flex;align-items:flex-end;justify-content:space-between;gap:6px;margin-top:3px}
.dh-spark{flex:none;opacity:.9}
.dh-delta{font-size:11px;font-weight:800;margin-inline-start:7px;vertical-align:2px;white-space:nowrap}
.dh-ins{background:linear-gradient(135deg,#0f2a43,#1a3f5f);border-radius:15px;padding:14px 16px;margin-bottom:14px;box-shadow:0 1px 2px rgba(16,24,40,.08)}
.dh-ins-h{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:800;color:#fff;margin-bottom:11px}
.dh-ins-list{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.dh-ins-i{display:flex;align-items:flex-start;gap:9px;background:rgba(255,255,255,.96);border-inline-start:3px solid #ccc;border-radius:11px;padding:10px 12px;font-size:12px;font-weight:600;color:#1d2939;line-height:1.55}
.dh-ins-ic{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex:none}
.dh-targets{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
.dh-tg{display:flex;flex-direction:column;gap:6px}
.dh-tg-top{display:flex;flex-direction:column;gap:2px}
.dh-tg-k{font-size:11px;color:#64748b;font-weight:700;line-height:1.35;min-height:30px}
.dh-tg-v{font-size:17px;font-weight:800}.dh-tg-v small{font-size:10.5px;color:#94a3b8;font-weight:600}
.dh-tg-bar{height:6px;border-radius:6px;background:#eef1f4;overflow:hidden}.dh-tg-bar div{height:100%;border-radius:6px}
.dh-tg-badge{align-self:flex-start;font-size:10px;font-weight:800;padding:2px 9px;border-radius:20px}
.dh-cf{display:flex;align-items:flex-end;gap:6px;height:64px;padding:0 2px}
.dh-cf-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;background:none;border:none;cursor:pointer;padding:4px 2px 0;border-radius:8px;font-family:inherit}
.dh-cf-col.on{background:#f4f7fb}
.dh-cf-bars{display:flex;align-items:flex-end;gap:3px;height:48px}
.dh-cf-in{width:8px;border-radius:3px 3px 0 0;background:#12b76a}
.dh-cf-out{width:8px;border-radius:3px 3px 0 0;background:#f04438}
.dh-cf-col.on .dh-cf-in{background:#087443}.dh-cf-col.on .dh-cf-out{background:#b42318}
.dh-cf-m{font-size:9.5px;color:#94a3b8;font-weight:700}
.dh-cf-col.on .dh-cf-m{color:#0f172a}
.dh-cf-lg{display:flex;gap:14px;justify-content:center;margin-top:6px;font-size:10.5px;color:#64748b;font-weight:600}
.dh-cf-lg span{display:flex;align-items:center;gap:5px}.dh-cf-lg i{width:9px;height:9px;border-radius:3px}
.dh-mini{display:flex;align-items:center;justify-content:space-between;font-size:11.5px;color:#64748b;border-top:1px solid #f1f3f5;padding-top:7px}
.dh-mini b{color:#0f172a;font-size:13px}
.dh-fin{display:flex;flex-direction:column;gap:10px}
.dh-fin-row{display:flex;align-items:center;gap:11px}
.dh-fin-row.hi{background:#f4fbf7;border:1px solid #d6f0e2;border-radius:11px;padding:8px 10px;margin:-2px 0}
.dh-fin-ic{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none}
.dh-fin-l{font-size:12.5px;color:#475569;font-weight:600}
.dh-fin-row b{font-size:14px;font-weight:800;color:#0f172a}
.dh-fin-tot{display:flex;align-items:center;justify-content:space-between;border-top:1px dashed #e6e9ee;margin-top:4px;padding-top:11px;font-size:12.5px;color:#64748b;font-weight:700}
.dh-fin-tot b{font-size:17px;font-weight:800}
.dh-empty{display:flex;flex-direction:column;align-items:center;gap:5px;padding:26px 16px;text-align:center;color:#94a3b8}
.dh-empty b{font-size:13.5px;color:#334155}.dh-empty span{font-size:11.5px;max-width:320px;line-height:1.6}
.dh-quick{display:grid;grid-template-columns:repeat(8,1fr);gap:10px;margin-top:14px}
.dh-q{display:flex;flex-direction:column;align-items:center;gap:7px;background:#fff;border:1px solid #eceef1;border-radius:14px;padding:14px 8px;font-family:inherit;font-size:11.5px;font-weight:700;color:#334155;cursor:pointer;box-shadow:0 1px 2px rgba(16,24,40,.05);transition:border-color .15s,transform .15s}
.dh-q:hover{border-color:#f5c9a8;transform:translateY(-1px)}
.dh-q-ic{width:38px;height:38px;border-radius:11px;background:#fff2e8;color:#E8712B;display:flex;align-items:center;justify-content:center}
@media(max-width:1100px){.dh-kpis{grid-template-columns:repeat(3,1fr)}.dh-ops{grid-template-columns:repeat(2,1fr)}.dh-quick{grid-template-columns:repeat(4,1fr)}.dh-al-list{grid-template-columns:1fr}.dh-ins-list{grid-template-columns:1fr}.dh-targets{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.dh-kpis{grid-template-columns:repeat(2,1fr)}.dh-ops{grid-template-columns:repeat(2,1fr)}.dh-quick{grid-template-columns:repeat(4,1fr)}.dh-targets{grid-template-columns:repeat(2,1fr)}.dh-tg-k{min-height:0}}
`;
