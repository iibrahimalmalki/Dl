import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";

const money=n=>Number(n||0).toLocaleString("en-US",{maximumFractionDigits:0})+" ﷼";
const periodAr=p=>{if(!p)return"—";const[y,m]=String(p).split("-");const M=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];return`${M[(+m||1)-1]} ${y}`;};
const curMonth=()=>new Date().toISOString().slice(0,7);
const maxPeriod=arr=>arr.reduce((mx,r)=>r.period&&r.period>mx?r.period:mx,"");

// لوحة القيادة الشاملة — بيانات حيّة من كل وحدات النظام
export default function DashboardHome({onNav}){
  const nav=k=>onNav&&onNav(k);
  const[d,setD]=useState(null);

  useEffect(()=>{(async()=>{
    const q=(t,c)=>supabase.from(t).select(c).then(({data})=>data||[]).then(x=>x,()=>[]);
    const[apps,visits,emps,teams,ivs,onb,ops,pay,viol,rounds,vexp]=await Promise.all([
      q("applicants","full_name,application_number,status,ai_classification,ai_score_total,location,saudi_city,bangladesh_district,submitted_at"),
      supabase.from("page_visits").select("step,session_id").eq("page","ad_page").then(({data})=>data||[],()=>[]),
      q("employees","full_name,employee_id,team_id,staff_role"),
      q("teams","id,name,supervisor_user_id"),
      q("interview_sessions","status,decision,rating"),
      q("onboarding","progress"),
      q("ops_biker_month","period,biker_name,net_washes,rating,complaint_pct"),
      q("payroll_lines","period,role,total"),
      q("violations","status,severity,fine_applied"),
      q("field_rounds","compliance_pct,period,status"),
      q("vendor_expenses","exp_date,amount"),
    ]);
    setD({apps,visits,emps,teams,ivs,onb,ops,pay,viol,rounds,vexp});
  })();},[]);

  const s=useMemo(()=>{
    if(!d)return null;
    const A=d.apps;
    const accepted=A.filter(a=>a.status==="accepted").length;
    const rejected=A.filter(a=>a.status==="rejected").length;
    const pending=A.filter(a=>a.status==="pending"||!a.status).length;
    const strong=A.filter(a=>a.ai_classification==="strong"||a.ai_classification==="accepted").length;
    // القمع
    const sess={};d.visits.forEach(v=>{const m=String(v.step||"").match(/^([0-9])/);if(!m)return;sess[v.session_id]=Math.max(sess[v.session_id]||0,+m[1]);});
    const sv=Object.values(sess);const reached=lv=>sv.filter(x=>x>=lv).length;
    const total0=reached(0)||sv.length;
    const funnel=[["دخول الإعلان",reached(0)],["المزايا",reached(1)],["الحاسبة",reached(2)],["يوم في الحياة",reached(3)],["الأسئلة",reached(4)],["زر التقديم",reached(5)]];
    // الفريق
    const bikers=d.emps.filter(e=>e.staff_role!=="manager");
    const managers=d.emps.filter(e=>e.staff_role==="manager");
    // العمليات — آخر فترة
    const opP=maxPeriod(d.ops);const opsL=d.ops.filter(o=>o.period===opP);
    const washes=opsL.reduce((a,o)=>a+Number(o.net_washes||0),0);
    const ratings=opsL.map(o=>Number(o.rating)).filter(x=>x>0);
    const avgRating=ratings.length?ratings.reduce((a,b)=>a+b,0)/ratings.length:0;
    const topBikers=[...opsL].sort((a,b)=>Number(b.net_washes||0)-Number(a.net_washes||0)).slice(0,6);
    const maxW=topBikers.reduce((m,o)=>Math.max(m,Number(o.net_washes||0)),0)||1;
    // الرواتب — آخر فترة
    const payP=maxPeriod(d.pay);const payL=d.pay.filter(p=>p.period===payP);
    const payrollTotal=payL.reduce((a,p)=>a+Number(p.total||0),0);
    // الجودة والامتثال
    const openViol=d.viol.filter(v=>!["closed","settled","paid","rejected"].includes(String(v.status||"").toLowerCase())).length;
    const finesTotal=d.viol.reduce((a,v)=>a+Number(v.fine_applied||0),0);
    const compVals=d.rounds.map(r=>Number(r.compliance_pct)).filter(x=>!isNaN(x));
    const avgComp=compVals.length?Math.round(compVals.reduce((a,b)=>a+b,0)/compVals.length):null;
    // المالية
    const vendMonth=d.vexp.filter(e=>String(e.exp_date||"").slice(0,7)===curMonth()).reduce((a,e)=>a+Number(e.amount||0),0);
    // التوظيف الجاري
    const ivPending=d.ivs.filter(i=>i.status!=="completed").length;
    const onbAvg=d.onb.length?Math.round(d.onb.reduce((a,o)=>a+Number(o.progress||0),0)/d.onb.length):0;
    return{A,accepted,rejected,pending,strong,funnel,total0,bikers,managers,teams:d.teams,opP,opsL,washes,avgRating,topBikers,maxW,payP,payrollTotal,openViol,finesTotal,avgComp,rounds:d.rounds,vendMonth,ivPending,onbAvg};
  },[d]);

  if(!s)return(<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>{[...Array(6)].map((_,i)=><div key={i} className="dw-skel" style={{height:92}}/>)}</div>);

  const {A,accepted,rejected,pending,strong,funnel,total0,bikers,teams,opP,washes,avgRating,topBikers,maxW,payP,payrollTotal,openViol,finesTotal,avgComp,vendMonth,ivPending,onbAvg}=s;
  const recent=A.slice(0,4);
  const scoreCol=v=>v==null?["#eef1f4","#94a3b8"]:v>=6.5?["#e7f7ef","#087443"]:v>=5?["#fef3e2","#b54708"]:["#feecea","#b42318"];
  const stName=x=>x==="accepted"?"مقبول":x==="rejected"?"مرفوض":"معلّق";
  const stCls=x=>x==="accepted"?"p-acc":x==="rejected"?"p-rej":"p-pend";
  const av=i=>["#f79009","#12b76a","#2e90fa","#7c3aed","#64748b","#e8712b"][i%6];

  return(<div className="dh">
    <style>{CSS}</style>

    {/* شريط مؤشرات شامل */}
    <div className="dh-kpis">
      <Kpi label="البايكرز" ic="bike" ib="#fff2e8" c="#E8712B" n={bikers.length} sub={`${teams.length} فرق`} onClick={()=>nav("employees")}/>
      <Kpi label="المتقدّمون" ic="applicants" ib="#eef4ff" c="#1d5bbf" n={A.length} sub={`${pending} قيد المراجعة`} onClick={()=>nav("recruitment")}/>
      <Kpi label={"غسلات · "+(opP?periodAr(opP):"—")} ic="operations" ib="#e7f7ef" c="#087443" n={washes.toLocaleString("en-US")} sub={avgRating?`تقييم ${avgRating.toFixed(2)}`:"لا بيانات بعد"} onClick={()=>nav("operations")}/>
      <Kpi label={"رواتب · "+(payP?periodAr(payP):"—")} ic="payroll" ib="#f6f2ff" c="#6d4bcb" n={payrollTotal?money(payrollTotal):"—"} sub={payP?"آخر مسير":"لم يُشغّل بعد"} onClick={()=>nav("payroll")}/>
      <Kpi label="الامتثال الميداني" ic="rounds" ib="#eefaf3" c="#087443" n={avgComp!=null?avgComp+"%":"—"} sub={s.rounds.length?`${s.rounds.length} جولة`:"لا جولات بعد"} onClick={()=>nav("field_rounds")}/>
      <Kpi label="مخالفات مفتوحة" ic="complaints" ib="#feecea" c="#b42318" n={openViol} sub={finesTotal?money(finesTotal)+" غرامات":"لا مخالفات"} tone="red" onClick={()=>nav("complaints")}/>
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
        <div className="dw-ph"><b>لمحة مالية</b><span className="dw-a">{periodAr(payP||curMonth())}</span></div>
        <div className="dw-pb dh-fin">
          <div className="dh-fin-row"><span className="dh-fin-ic" style={{background:"#f6f2ff",color:"#6d4bcb"}}><Icon n="payroll" s={16}/></span><div style={{flex:1}}><div className="dh-fin-l">رواتب الفريق (آخر مسير)</div></div><b>{payrollTotal?money(payrollTotal):"—"}</b></div>
          <div className="dh-fin-row"><span className="dh-fin-ic" style={{background:"#fff2e8",color:"#b54708"}}><Icon n="vendors" s={16}/></span><div style={{flex:1}}><div className="dh-fin-l">مصروفات موردين (هذا الشهر)</div></div><b>{vendMonth?money(vendMonth):"—"}</b></div>
          <div className="dh-fin-row"><span className="dh-fin-ic" style={{background:"#feecea",color:"#b42318"}}><Icon n="alert" s={16}/></span><div style={{flex:1}}><div className="dh-fin-l">غرامات مخالفات</div></div><b>{finesTotal?money(finesTotal):"—"}</b></div>
          <div className="dh-fin-tot"><span>إجمالي التكاليف التقديري</span><b>{money((payrollTotal||0)+(vendMonth||0))}</b></div>
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
      {[["recruitment","المتقدّمون","applicants"],["interviews","المقابلات","interview"],["operations","العمليات","operations"],["payroll","الرواتب","payroll"],["complaints","الشكاوى","complaints"],["field_rounds","الجولات","rounds"],["org","الهيكل","building"],["vendors","الموردون","vendors"]].map(([k,ar,ic])=>(
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
.dh-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:14px}
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
.dh-fin-ic{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none}
.dh-fin-l{font-size:12.5px;color:#475569;font-weight:600}
.dh-fin-row b{font-size:14px;font-weight:800;color:#0f172a}
.dh-fin-tot{display:flex;align-items:center;justify-content:space-between;border-top:1px dashed #e6e9ee;margin-top:4px;padding-top:11px;font-size:12.5px;color:#64748b;font-weight:700}
.dh-fin-tot b{font-size:17px;font-weight:800;color:#0f172a}
.dh-empty{display:flex;flex-direction:column;align-items:center;gap:5px;padding:26px 16px;text-align:center;color:#94a3b8}
.dh-empty b{font-size:13.5px;color:#334155}.dh-empty span{font-size:11.5px;max-width:320px;line-height:1.6}
.dh-quick{display:grid;grid-template-columns:repeat(8,1fr);gap:10px;margin-top:14px}
.dh-q{display:flex;flex-direction:column;align-items:center;gap:7px;background:#fff;border:1px solid #eceef1;border-radius:14px;padding:14px 8px;font-family:inherit;font-size:11.5px;font-weight:700;color:#334155;cursor:pointer;box-shadow:0 1px 2px rgba(16,24,40,.05);transition:border-color .15s,transform .15s}
.dh-q:hover{border-color:#f5c9a8;transform:translateY(-1px)}
.dh-q-ic{width:38px;height:38px;border-radius:11px;background:#fff2e8;color:#E8712B;display:flex;align-items:center;justify-content:center}
@media(max-width:1100px){.dh-kpis{grid-template-columns:repeat(3,1fr)}.dh-quick{grid-template-columns:repeat(4,1fr)}}
@media(max-width:640px){.dh-kpis{grid-template-columns:repeat(2,1fr)}.dh-quick{grid-template-columns:repeat(4,1fr)}}
`;
