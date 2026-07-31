import{useState,useEffect}from"react";
import{supabase}from"./supabase";

// لوحة القيادة — بيانات حيّة من قاعدة البيانات
export default function DashboardHome(){
  const[st,setSt]=useState(null);
  useEffect(()=>{(async()=>{
    const[{data:apps},{data:visits},{data:emps}]=await Promise.all([
      supabase.from("applicants").select("full_name,application_number,status,ai_classification,ai_score_total,location,saudi_city,bangladesh_district,submitted_at").order("submitted_at",{ascending:false}),
      supabase.from("page_visits").select("page,step,session_id").eq("page","ad_page"),
      supabase.from("employees").select("full_name,employee_id"),
    ]);
    // إحصاء المتقدّمين
    const A=apps||[];
    const accepted=A.filter(a=>a.status==="accepted").length;
    const rejected=A.filter(a=>a.status==="rejected").length;
    const pending=A.filter(a=>a.status==="pending"||!a.status).length;
    const strong=A.filter(a=>a.ai_classification==="strong"||a.ai_classification==="accepted").length;
    // القمع
    const sess={};(visits||[]).forEach(v=>{const m=String(v.step||"").match(/^([0-9])/);if(!m)return;const lv=+m[1];sess[v.session_id]=Math.max(sess[v.session_id]||0,lv);});
    const svals=Object.values(sess);
    const reached=lv=>svals.filter(x=>x>=lv).length;
    const total0=reached(0)||svals.length;
    const funnel=[["دخول الإعلان",reached(0)],["المزايا",reached(1)],["الحاسبة",reached(2)],["يوم في الحياة",reached(3)],["الأسئلة",reached(4)],["زر التقديم",reached(5)]];
    setSt({A,accepted,rejected,pending,strong,funnel,total0,emps:emps||[]});
  })();},[]);

  if(!st)return(<div style={{display:"flex",gap:14,flexWrap:"wrap"}}>{[1,2,3,4].map(i=><div key={i} className="dw-skel" style={{height:104,flex:"1 1 180px"}}/>)}</div>);
  const {A,accepted,rejected,pending,strong,funnel,total0}=st;
  const recent=A.slice(0,4);
  const clr=s=>s==="accepted"?"#12b76a":s==="rejected"?"#f04438":"#f79009";
  const scoreCol=v=>v==null?["#eef1f4","#94a3b8"]:v>=6.5?["#e7f7ef","#087443"]:v>=5?["#fef3e2","#b54708"]:["#feecea","#b42318"];
  const stName=s=>s==="accepted"?"مقبول":s==="rejected"?"مرفوض":"معلّق";
  const stCls=s=>s==="accepted"?"p-acc":s==="rejected"?"p-rej":"p-pend";
  const av=(name,i)=>{const c=["#f79009","#12b76a","#2e90fa","#7c3aed","#64748b","#e8712b"][i%6];return c;};

  return(<>
    {/* KPIs */}
    <div className="dw-kpis">
      <Kpi label="المتقدّمون" icon="🧲" ib="#fff2e8" n={A.length} delta={`${strong} أقوياء`} up/>
      <Kpi label="قيد المراجعة" icon="⏳" ib="#fef3e2" n={pending} delta="بانتظار القرار" tone="amb"/>
      <Kpi label="مقبولون" icon="✅" ib="#e7f7ef" n={accepted} delta="نشطون" up/>
      <Kpi label="مرفوضون" icon="✕" ib="#feecea" n={rejected} delta="مؤرشفون" tone="mut"/>
    </div>

    <div className="dw-row dw-2">
      {/* Funnel */}
      <div className="dw-panel">
        <div className="dw-ph"><b>قمع التوظيف</b><span className="dw-a">من زيارة الإعلان للتقديم</span></div>
        <div className="dw-pb dw-fun">
          {funnel.map(([lbl,val],i)=>{const pct=total0?Math.round(val/total0*100):0;return(
            <div className="dw-frow" key={i}><span className="dw-fl">{lbl}</span><div className="dw-fbar"><div className="dw-ffill" style={{width:`${Math.max(pct,6)}%`}}>{val}</div></div><span className="dw-fv">{pct}%</span></div>
          );})}
        </div>
      </div>
      {/* Donut */}
      <div className="dw-panel">
        <div className="dw-ph"><b>حالة المتقدّمين</b></div>
        <div className="dw-pb" style={{display:"flex",alignItems:"center",gap:18}}>
          <Donut a={accepted} p={pending} r={rejected} total={A.length}/>
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:9}}>
            <Leg c="#12b76a" t="مقبول" v={accepted}/>
            <Leg c="#f79009" t="قيد المراجعة" v={pending}/>
            <Leg c="#f04438" t="مرفوض" v={rejected}/>
          </div>
        </div>
      </div>
    </div>

    {/* Recent applicants */}
    <div className="dw-row">
      <div className="dw-panel">
        <div className="dw-ph"><b>أحدث المتقدّمين</b><span className="dw-a">الكل ({A.length})</span></div>
        <div style={{overflow:"auto"}}>
        <table className="dw-tbl">
          <thead><tr><th>المتقدّم</th><th className="dw-hm">الموقع</th><th>تقييم AI</th><th>الحالة</th></tr></thead>
          <tbody>{recent.map((a,i)=>{const[bg,cl]=scoreCol(a.ai_score_total);return(
            <tr key={i}>
              <td><div className="dw-cand"><div className="dw-cav" style={{background:av(a.full_name,i)}}>{(a.full_name||"?").trim().charAt(0)}</div><div><div style={{fontWeight:700}}>{a.full_name||"—"}</div><small>#{a.application_number||"—"}</small></div></div></td>
              <td className="dw-hm">{a.location==="inside_ksa"?`الرياض · ${a.saudi_city||"—"}`:`خارج · ${a.bangladesh_district||"—"}`}</td>
              <td><span className="dw-score" style={{background:bg,color:cl}}>{a.ai_score_total!=null?Number(a.ai_score_total).toFixed(2):"—"}</span></td>
              <td><span className={"dw-pill "+stCls(a.status)}><span className="dw-dot"/>{stName(a.status)}</span></td>
            </tr>);})}</tbody>
        </table>
        </div>
      </div>
    </div>

    {/* May payroll snapshot (historical real data) */}
    <div className="dw-row dw-2b">
      <div className="dw-panel">
        <div className="dw-ph"><b>عمولة المشرف — مايو</b></div>
        <div className="dw-pb">
          <div style={{fontSize:28,fontWeight:800,letterSpacing:"-.5px"}}>853.20 <span style={{fontSize:13,color:"#64748b",fontWeight:600}}>ريال</span></div>
          <div className="dw-goal">سلمان المالكي · 540 طلب فريق · معدل 1.58 ريال/طلب</div>
          <div className="dw-track"><div style={{width:"90%"}}/></div>
          <div className="dw-goal">90% من السقف الكامل</div>
        </div>
      </div>
      <div className="dw-panel">
        <div className="dw-ph"><b>أداء الفريق — مايو</b><span className="dw-a">هدف 200+ غسلة</span></div>
        <div className="dw-pb dw-team">
          {[["Midul Hassan","#1648",216,83,"#12b76a"],["Mohamad Rakib","#1700",191,73,"#f79009"],["Ariful Islam","#1624 · يغادر يوليو",133,51,"#94a3b8"]].map((t,i)=>(
            <div className="dw-tm" key={i}><div className="dw-tn">{t[0]}<small>{t[1]}</small></div><div className="dw-tbar"><div style={{width:`${t[3]}%`,height:"100%",borderRadius:6,background:t[4]}}/></div><span className="dw-tv">{t[2]}</span></div>
          ))}
        </div>
      </div>
    </div>
  </>);
}

function Kpi({label,icon,ib,n,delta,up,tone}){
  const dc=up?"#12b76a":tone==="amb"?"#b54708":tone==="mut"?"#94a3b8":"#f04438";
  return(<div className="dw-kpi"><div className="dw-kh"><span className="dw-kl">{label}</span><span className="dw-ki" style={{background:ib}}>{icon}</span></div><div className="dw-kn">{n}</div><div className="dw-kd" style={{color:dc}}>{up?"▲ ":""}{delta}</div></div>);
}
function Donut({a,p,r,total}){
  const T=Math.max(a+p+r,1);const seg=(v)=>v/T*100;const A=seg(a),P=seg(p),R=seg(r);
  let off=25;const arc=(len,col,o)=>(<circle cx="21" cy="21" r="15.9" fill="none" stroke={col} strokeWidth="6" strokeDasharray={`${len} ${100-len}`} strokeDashoffset={o} transform="rotate(-90 21 21)"/>);
  const c1=off;off-=A;const c2=off;off-=P;const c3=off;
  return(<svg width="120" height="120" viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.9" fill="none" stroke="#eef1f4" strokeWidth="6"/>{arc(A,"#12b76a",c1)}{arc(P,"#f79009",c2)}{arc(R,"#f04438",c3)}<text x="21" y="20.5" textAnchor="middle" fontSize="7" fontWeight="800" fill="#0f172a">{total}</text><text x="21" y="27" textAnchor="middle" fontSize="3.2" fill="#64748b">إجمالي</text></svg>);
}
function Leg({c,t,v}){return(<div style={{display:"flex",alignItems:"center",gap:8,fontSize:12.5,color:"#64748b"}}><i style={{width:10,height:10,borderRadius:3,background:c}}/>{t}<b style={{marginInlineStart:"auto",color:"#0f172a"}}>{v}</b></div>);}
