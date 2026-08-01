import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";

const nowPeriod=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;};
const periodLabel=p=>{const[y,m]=p.split("-");return`${["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"][+m-1]||m} ${y}`;};
const AR=n=>Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const TARGET=200; // هدف الغسلات الشهري

function standing(rating,cpct,fines){
  if(rating>=4.75&&cpct<1&&fines===0)return{ar:"متميز",color:"#087443",bg:"#e7f7ef",ic:"star"};
  if(rating>=4.5&&cpct<1.5)return{ar:"ممتاز",color:"#175cd3",bg:"#eff6ff",ic:"check"};
  if(rating>=4.0)return{ar:"جيد",color:"#b54708",bg:"#fef3e2",ic:"performance"};
  return{ar:"يحتاج تحسين",color:"#b42318",bg:"#feecea",ic:"alert"};
}

export default function Performance({opId}){
  const[period,setPeriod]=useState(nowPeriod());
  const[loading,setLoading]=useState(true);
  const[emps,setEmps]=useState([]);const[ops,setOps]=useState([]);const[lines,setLines]=useState([]);const[viol,setViol]=useState([]);

  useEffect(()=>{(async()=>{
    setLoading(true);
    const opF=q=>(opId&&opId!=="all")?q.eq("operator_id",opId):q;
    const{data:e}=await supabase.from("employees").select("id,full_name,employee_id").not("employee_id","is",null).order("employee_id");
    const[{data:o},{data:v}]=await Promise.all([
      opF(supabase.from("ops_biker_month").select("*").eq("period",period)),
      opF(supabase.from("violations").select("sweater_id,status,fine_applied,code").eq("period",period)),
    ]);
    let runQ=supabase.from("payroll_runs").select("id").eq("period",period);runQ=(opId&&opId!=="all")?runQ.eq("operator_id",opId):runQ;
    const{data:runs}=await runQ.limit(1);
    let ln=[];if(runs&&runs[0]){const{data:l}=await supabase.from("payroll_lines").select("*").eq("run_id",runs[0].id);ln=l||[];}
    setEmps(e||[]);setOps(o||[]);setViol(v||[]);setLines(ln);
    setLoading(false);
  })();},[period,opId]);

  const rows=useMemo(()=>{
    const opBySid={};ops.forEach(o=>{if(o.sweater_id)opBySid[String(o.sweater_id).trim()]=o;});
    const lnBySid={};lines.filter(l=>l.role==="biker").forEach(l=>{if(l.biker_id)lnBySid[String(l.biker_id).trim()]=l;});
    return emps.map(e=>{
      const sid=String(e.employee_id).trim();const o=opBySid[sid]||{};const l=lnBySid[sid];
      const vs=viol.filter(x=>String(x.sweater_id).trim()===sid);
      const fines=vs.filter(x=>x.status==="confirmed").reduce((a,x)=>a+Number(x.fine_applied||0),0);
      const rating=o.rating!=null?Number(o.rating):null;const cpct=Number(o.complaint_pct||0);
      const netBonus=l?Number(l.net_bonus):(l===undefined?null:0);
      return{name:e.full_name,sid,net_washes:o.net_washes||0,rating,cpct,approved:o.approved_complaints||0,
        violations:vs.length,fines,net_bonus:netBonus,
        st:standing(rating||0,cpct,fines),hasData:o.sweater_id!=null||vs.length>0};
    });
  },[emps,ops,lines,viol]);

  const team=useMemo(()=>{
    const withData=rows.filter(r=>r.hasData);
    const rated=withData.filter(r=>r.rating!=null);
    return{bikers:withData.length,washes:withData.reduce((a,r)=>a+r.net_washes,0),
      avgRating:rated.length?rated.reduce((a,r)=>a+r.rating,0)/rated.length:0,
      violations:withData.reduce((a,r)=>a+r.violations,0),fines:withData.reduce((a,r)=>a+r.fines,0)};
  },[rows]);

  if(loading)return <div className="dw-skel" style={{height:280}}/>;
  const hasAny=rows.some(r=>r.hasData);

  return(<div className="pf">
    <style>{CSS}</style>
    <div className="pf-bar">
      <div className="pf-month"><Icon n="calendar" s={16}/><input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></div>
    </div>

    <div className="pf-kpis">
      <K ic="employees" c="#E8712B" bg="#fff2e8" t="بايكرز مقيّمون" v={team.bikers}/>
      <K ic="operations" c="#175cd3" bg="#eff6ff" t="إجمالي الغسلات" v={team.washes}/>
      <K ic="star" c="#087443" bg="#e7f7ef" t="متوسط تقييم الفريق" v={team.avgRating?team.avgRating.toFixed(2):"—"}/>
      <K ic="complaints" c="#b42318" bg="#feecea" t="غرامات مؤكّدة" v={AR(team.fines)} sar/>
    </div>

    {!hasAny?<div className="pf-empty"><div className="pf-empty-ic"><Icon n="performance" s={30}/></div><h3>لا بيانات أداء في {periodLabel(period)}</h3><p>الأداء يُجمَّع تلقائياً من العمليات (الغسلات والتقييم) والرواتب والمخالفات. ارفع تقارير سويتر في العمليات أولاً.</p></div>:
    <div className="pf-list">{rows.filter(r=>r.hasData).map(r=>{const pct=Math.min(Math.round(r.net_washes/TARGET*100),100);return(
      <div className="pf-card" key={r.sid}>
        <div className="pf-c-top">
          <div className="pf-av">{(r.name||"?").trim().charAt(0)}</div>
          <div style={{flex:1,minWidth:0}}>
            <div className="pf-name">{r.name||"—"}<small>#{r.sid}</small></div>
            <span className="pf-stand" style={{background:r.st.bg,color:r.st.color}}><Icon n={r.st.ic} s={12}/> {r.st.ar}</span>
          </div>
          {r.rating!=null&&<div className="pf-rate"><b>{r.rating.toFixed(2)}</b><span>التقييم</span></div>}
        </div>
        <div className="pf-metrics">
          <M t="الغسلات الصافية" v={r.net_washes} sub={`الهدف ${TARGET}`}/>
          <M t="نسبة الشكاوى" v={r.cpct+"%"} tone={r.cpct<1?"g":r.cpct<2?"a":"r"}/>
          <M t="مخالفات" v={r.violations} sub={r.fines>0?`${AR(r.fines)} ر`:"لا غرامات"} tone={r.violations?"r":"g"}/>
          <M t="صافي المكافأة" v={r.net_bonus!=null?AR(r.net_bonus):"—"} sub="ريال"/>
        </div>
        <div className="pf-track"><div style={{width:pct+"%",background:pct>=100?"#12b76a":pct>=75?"#E8712B":"#f79009"}}/></div>
        <div className="pf-track-l">{r.net_washes} من {TARGET} غسلة · {pct}%</div>
      </div>);})}</div>}
  </div>);
}
function K({ic,c,bg,t,v,sar}){return(<div className="pf-kpi"><span className="pf-ki" style={{background:bg,color:c}}><Icon n={ic} s={17}/></span><div><div className="pf-kv">{v}{sar&&<i> ر</i>}</div><div className="pf-kl">{t}</div></div></div>);}
function M({t,v,sub,tone}){const c=tone==="g"?"#087443":tone==="a"?"#b54708":tone==="r"?"#b42318":"#0f172a";return(<div className="pf-m"><div className="pf-m-v" style={{color:c}}>{v}</div><div className="pf-m-t">{t}</div>{sub&&<div className="pf-m-s">{sub}</div>}</div>);}

const CSS=`
.pf{--b:#E8712B}
.pf-bar{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.pf-month{display:flex;align-items:center;gap:7px;background:#fff;border:1px solid #e6e9ee;border-radius:11px;padding:7px 11px;color:#64748b}
.pf-month input{border:none;outline:none;font-family:inherit;font-size:13px;font-weight:700;color:#0f172a;background:none}
.pf-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.pf-kpi{background:#fff;border:1px solid #eceef1;border-radius:15px;padding:13px;display:flex;align-items:center;gap:11px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.pf-ki{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.pf-kv{font-size:19px;font-weight:800;letter-spacing:-.5px}.pf-kv i{font-size:11px;color:#94a3b8;font-weight:600;font-style:normal}
.pf-kl{font-size:11px;color:#64748b;font-weight:600}
.pf-list{display:flex;flex-direction:column;gap:11px}
.pf-card{background:#fff;border:1px solid #eceef1;border-radius:16px;padding:15px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.pf-c-top{display:flex;align-items:center;gap:12px;margin-bottom:13px}
.pf-av{width:44px;height:44px;border-radius:13px;background:linear-gradient(135deg,#E8712B,#f5a35f);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px;flex:none}
.pf-name{font-size:14.5px;font-weight:800;color:#0f172a}.pf-name small{color:#94a3b8;font-weight:600;margin-inline-start:6px;font-size:11.5px}
.pf-stand{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:20px;font-size:10.5px;font-weight:800;margin-top:4px}
.pf-rate{text-align:center;flex:none}.pf-rate b{font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-.5px;display:block;line-height:1}.pf-rate span{font-size:10px;color:#94a3b8}
.pf-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
.pf-m{background:#fafbfc;border:1px solid #f1f3f5;border-radius:11px;padding:10px 8px;text-align:center}
.pf-m-v{font-size:16px;font-weight:800;letter-spacing:-.3px}
.pf-m-t{font-size:10px;color:#64748b;font-weight:600;margin-top:2px}
.pf-m-s{font-size:9.5px;color:#94a3b8;margin-top:1px}
.pf-track{height:8px;background:#eef0f3;border-radius:6px;overflow:hidden}
.pf-track div{height:100%;border-radius:6px}
.pf-track-l{font-size:10.5px;color:#94a3b8;margin-top:5px;font-weight:600}
.pf-empty{background:#fff;border:1px dashed #e6e9ee;border-radius:16px;padding:40px 24px;text-align:center}
.pf-empty-ic{width:64px;height:64px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#eff6ff,#dbeafe);color:#175cd3}
.pf-empty h3{font-size:16px;margin:0 0 8px}.pf-empty p{color:#64748b;font-size:12.5px;max-width:440px;margin:0 auto;line-height:1.7}
@media(max-width:720px){.pf-kpis{grid-template-columns:1fr 1fr}.pf-metrics{grid-template-columns:1fr 1fr}}
`;
