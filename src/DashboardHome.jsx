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

  useEffect(()=>{(async()=>{
    const q=(t,c)=>supabase.from(t).select(c).then(({data})=>data||[]).then(x=>x,()=>[]);
    const[apps,visits,emps,teams,ivs,onb,ops,pay,viol,rounds,vexp,docs,fveh,finc,hunits,hpays,hviol,screq,scitems,setts]=await Promise.all([
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
    ]);
    setD({apps,visits,emps,teams,ivs,onb,ops,pay,viol,rounds,vexp,docs,fveh,finc,hunits,hpays,hviol,screq,scitems,setts});
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

    // ── مركز التنبيهات ──
    const alerts=[];
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

    return{A,accepted,rejected,pending,funnel,total0,bikers,teams:d.teams,opP,opsL,washes,avgRating,topBikers,maxW,payP,payrollTotal,
      openViol,finesTotal,avgComp,rounds:d.rounds,vendMonth,expTotal,ivPending,onbAvg,
      docExpired:docExpired.length,docSoon:docSoon.length,nVeh:fveh.length,stolen,fMaint,fIncOpen,gpsCov,
      hpNext,hpNextDl,hvOpen,houseMonthly,scPending,scLow,revenue,costs,margin,alerts};
  },[d]);

  if(!s)return(<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>{[...Array(6)].map((_,i)=><div key={i} className="dw-skel" style={{height:92}}/>)}</div>);

  const {A,accepted,rejected,pending,funnel,total0,bikers,teams,opP,washes,avgRating,topBikers,maxW,payP,payrollTotal,openViol,finesTotal,avgComp,vendMonth,expTotal,ivPending,onbAvg,
    docExpired,docSoon,nVeh,stolen,fMaint,fIncOpen,gpsCov,hpNext,hpNextDl,hvOpen,houseMonthly,scPending,scLow,revenue,costs,margin,alerts}=s;
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

    {/* شريط المؤشرات الأساسي */}
    <div className="dh-kpis">
      <Kpi label="البايكرز" ic="bike" ib="#fff2e8" c="#E8712B" n={bikers.length} sub={`${teams.length} فرق`} onClick={()=>nav("employees")}/>
      <Kpi label="المتقدّمون" ic="applicants" ib="#eef4ff" c="#1d5bbf" n={A.length} sub={`${pending} قيد المراجعة`} onClick={()=>nav("recruitment")}/>
      <Kpi label={"غسلات · "+(opP?periodAr(opP):"—")} ic="operations" ib="#e7f7ef" c="#087443" n={washes.toLocaleString("en-US")} sub={avgRating?`تقييم ${avgRating.toFixed(2)}`:"لا بيانات بعد"} onClick={()=>nav("operations")}/>
      <Kpi label={"رواتب · "+(payP?periodAr(payP):"—")} ic="payroll" ib="#f6f2ff" c="#6d4bcb" n={payrollTotal?money(payrollTotal):"—"} sub={payP?"آخر مسير":"لم يُشغّل بعد"} onClick={()=>nav("payroll")}/>
      <Kpi label="الامتثال الميداني" ic="rounds" ib="#eefaf3" c="#087443" n={avgComp!=null?avgComp+"%":"—"} sub={s.rounds.length?`${s.rounds.length} جولة`:"لا جولات بعد"} onClick={()=>nav("field_rounds")}/>
      <Kpi label="مخالفات مفتوحة" ic="complaints" ib="#feecea" c="#b42318" n={openViol} sub={finesTotal?money(finesTotal)+" غرامات":"لا مخالفات"} tone="red" onClick={()=>nav("complaints")}/>
    </div>

    {/* شريط تشغيلي — الوحدات الجديدة */}
    <div className="dh-ops">
      <Kpi label="الأسطول" ic="bike" ib="#eef4ff" c="#1d5bbf" n={nVeh} sub={`${fIncOpen} حوادث · تتبّع ${gpsCov}%`} tone={stolen?"red":""} onClick={()=>nav("fleet")}/>
      <Kpi label="السكن — الدفعة القادمة" ic="home" ib="#fff2e8" c="#c2410c" n={hpNext?money(hpNext.amount):"—"} sub={hpNext?`تستحق ${fmtD(hpNext.due_date)}`:"مكتمل"} onClick={()=>nav("housing")}/>
      <Kpi label="الوثائق — عاجلة ≤30" ic="doc" ib="#fef3e2" c="#b54708" n={docSoon} sub={docExpired?`${docExpired} منتهية`:"لا منتهية"} tone={docExpired?"red":""} onClick={()=>nav("renewals")}/>
      <Kpi label="الإمداد — طلبات معلّقة" ic="bucket" ib="#eefaf3" c="#087443" n={scPending} sub={scLow?`${scLow} تحت الحدّ`:"المخزون متوازن"} onClick={()=>nav("supply")}/>
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
        <div className="dw-ph"><b>لمحة مالية · {periodAr(payP||curMonth())}</b><span className="dw-a" onClick={()=>nav("pricing")} role="button">التسعير <Icon n="fwd" s={12} style={{verticalAlign:"-2px"}}/></span></div>
        <div className="dw-pb dh-fin">
          <div className="dh-fin-row hi"><span className="dh-fin-ic" style={{background:"#e7f7ef",color:"#087443"}}><Icon n="cash" s={16}/></span><div style={{flex:1}}><div className="dh-fin-l">إيراد سويتر التقديري</div></div><b>{revenue?money(revenue):"—"}</b></div>
          <div className="dh-fin-row"><span className="dh-fin-ic" style={{background:"#f6f2ff",color:"#6d4bcb"}}><Icon n="payroll" s={16}/></span><div style={{flex:1}}><div className="dh-fin-l">رواتب الفريق</div></div><b>{payrollTotal?money(payrollTotal):"—"}</b></div>
          <div className="dh-fin-row"><span className="dh-fin-ic" style={{background:"#fff2e8",color:"#b54708"}}><Icon n="vendors" s={16}/></span><div style={{flex:1}}><div className="dh-fin-l">مصروفات موردين (الشهر)</div></div><b>{vendMonth?money(vendMonth):"—"}</b></div>
          <div className="dh-fin-row"><span className="dh-fin-ic" style={{background:"#eef4ff",color:"#1d5bbf"}}><Icon n="home" s={16}/></span><div style={{flex:1}}><div className="dh-fin-l">إيجار السكن (شهرياً)</div></div><b>{houseMonthly?money(houseMonthly):"—"}</b></div>
          <div className="dh-fin-row"><span className="dh-fin-ic" style={{background:"#feecea",color:"#b42318"}}><Icon n="alert" s={16}/></span><div style={{flex:1}}><div className="dh-fin-l">غرامات مخالفات</div></div><b>{finesTotal?money(finesTotal):"—"}</b></div>
          <div className="dh-fin-row"><span className="dh-fin-ic" style={{background:"#eef1f4",color:"#334155"}}><Icon n="reports" s={16}/></span><div style={{flex:1}}><div className="dh-fin-l">إجمالي المصروفات المسجّلة (تأسيس+تشغيل)</div></div><b>{expTotal?money(expTotal):"—"}</b></div>
          <div className="dh-fin-tot"><span>الهامش التقديري (إيراد − تكاليف الشهر)</span><b style={{color:margin>=0?"#087443":"#b42318"}}>{revenue?money(margin):"—"}</b></div>
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

function Kpi({label,ic,c,ib,n,sub,tone,onClick}){
  const dc=tone==="red"?"#b42318":"#64748b";
  return(<div className={"dh-kpi"+(onClick?" dw-clk":"")} onClick={onClick}>
    <div className="dh-kh"><span className="dh-kl">{label}</span><span className="dh-ki" style={{background:ib,color:c}}><Icon n={ic} s={17}/></span></div>
    <div className="dh-kn">{n}</div><div className="dh-kd" style={{color:dc}}>{sub}</div>
  </div>);
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
.dh-kd{font-size:11px;font-weight:700;margin-top:2px}
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
@media(max-width:1100px){.dh-kpis{grid-template-columns:repeat(3,1fr)}.dh-ops{grid-template-columns:repeat(2,1fr)}.dh-quick{grid-template-columns:repeat(4,1fr)}.dh-al-list{grid-template-columns:1fr}}
@media(max-width:640px){.dh-kpis{grid-template-columns:repeat(2,1fr)}.dh-ops{grid-template-columns:repeat(2,1fr)}.dh-quick{grid-template-columns:repeat(4,1fr)}}
`;
