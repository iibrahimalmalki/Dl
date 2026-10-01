import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";

const nowPeriod=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;};
const periodLabel=p=>{const[y,m]=p.split("-");return`${["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"][+m-1]||m} ${y}`;};
const AR=n=>Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const TARGET=200; // هدف الغسلات الشهري

const RANK=["يحتاج تحسين","جيد","ممتاز","متميز"];
function standing(rating,cpct,fines,compliance){
  let s;
  if(rating>=4.75&&cpct<1&&fines===0)s={ar:"متميز",color:"var(--ok-ink)",bg:"var(--ok-bg)",ic:"star"};
  else if(rating>=4.5&&cpct<1.5)s={ar:"ممتاز",color:"var(--info-ink)",bg:"var(--info-bg)",ic:"check"};
  else if(rating>=4.0)s={ar:"جيد",color:"var(--warn-ink)",bg:"var(--warn-bg)",ic:"performance"};
  else s={ar:"يحتاج تحسين",color:"var(--bad-ink)",bg:"var(--bad-bg)",ic:"alert"};
  // سقف الالتزام الميداني: <60% يخفض للأدنى، <80% لا يتجاوز «جيد»
  if(compliance!=null){
    const cap=compliance<60?0:compliance<80?1:3;
    if(RANK.indexOf(s.ar)>cap){const m=[{ar:"يحتاج تحسين",color:"var(--bad-ink)",bg:"var(--bad-bg)",ic:"alert"},{ar:"جيد",color:"var(--warn-ink)",bg:"var(--warn-bg)",ic:"performance"}];s=m[Math.min(cap,1)];}
  }
  return s;
}

export default function Performance({opId}){
  const[period,setPeriod]=useState(nowPeriod());
  const[loading,setLoading]=useState(true);
  const[emps,setEmps]=useState([]);const[ops,setOps]=useState([]);const[lines,setLines]=useState([]);const[viol,setViol]=useState([]);const[rounds,setRounds]=useState([]);

  useEffect(()=>{(async()=>{
    setLoading(true);
    const opF=q=>(opId&&opId!=="all")?q.eq("operator_id",opId):q;
    const{data:e}=await supabase.from("employees").select("id,full_name,employee_id").not("employee_id","is",null).order("employee_id");
    const[{data:o},{data:v},{data:fr}]=await Promise.all([
      opF(supabase.from("ops_biker_month").select("*").eq("period",period)),
      opF(supabase.from("violations").select("sweater_id,status,fine_applied,code").eq("period",period)),
      opF(supabase.from("field_rounds").select("sweater_id,compliance_pct,effect,round_date").eq("period",period).order("round_date",{ascending:false})),
    ]);
    setRounds(fr||[]);
    let runQ=supabase.from("payroll_runs").select("id").eq("period",period);runQ=(opId&&opId!=="all")?runQ.eq("operator_id",opId):runQ;
    const{data:runs}=await runQ.limit(1);
    let ln=[];if(runs&&runs[0]){const{data:l}=await supabase.from("payroll_lines").select("*").eq("run_id",runs[0].id);ln=l||[];}
    setEmps(e||[]);setOps(o||[]);setViol(v||[]);setLines(ln);
    setLoading(false);
  })();},[period,opId]);

  const rows=useMemo(()=>{
    const opBySid={};ops.forEach(o=>{if(o.sweater_id)opBySid[String(o.sweater_id).trim()]=o;});
    const lnBySid={};lines.filter(l=>l.role==="biker").forEach(l=>{if(l.biker_id)lnBySid[String(l.biker_id).trim()]=l;});
    const frBySid={};rounds.forEach(r=>{const k=String(r.sweater_id||"").trim();if(k&&!frBySid[k])frBySid[k]=r;}); // الأحدث (مرتّبة تنازلياً)
    return emps.map(e=>{
      const sid=String(e.employee_id).trim();const o=opBySid[sid]||{};const l=lnBySid[sid];const fr=frBySid[sid];
      const vs=viol.filter(x=>String(x.sweater_id).trim()===sid);
      const fines=vs.filter(x=>x.status==="confirmed").reduce((a,x)=>a+Number(x.fine_applied||0),0);
      const rating=o.rating!=null?Number(o.rating):null;const cpct=Number(o.complaint_pct||0);
      const netBonus=l?Number(l.net_bonus):(l===undefined?null:0);
      const compliance=fr&&fr.compliance_pct!=null?Number(fr.compliance_pct):null;
      return{name:e.full_name,sid,net_washes:o.net_washes||0,rating,cpct,approved:o.approved_complaints||0,
        violations:vs.length,fines,net_bonus:netBonus,compliance,
        st:standing(rating||0,cpct,fines,compliance),hasData:o.sweater_id!=null||vs.length>0||fr!=null};
    });
  },[emps,ops,lines,viol,rounds]);

  const team=useMemo(()=>{
    const withData=rows.filter(r=>r.hasData);
    const rated=withData.filter(r=>r.rating!=null);
    return{bikers:withData.length,washes:withData.reduce((a,r)=>a+r.net_washes,0),
      avgRating:rated.length?rated.reduce((a,r)=>a+r.rating,0)/rated.length:0,
      violations:withData.reduce((a,r)=>a+r.violations,0),fines:withData.reduce((a,r)=>a+r.fines,0)};
  },[rows]);

  if(loading)return <div className="g-skel" style={{height:280}}/>;
  const hasAny=rows.some(r=>r.hasData);

  return(<div className="pf">
    <style>{CSS}</style>
    <div className="pf-bar">
      <div className="pf-month"><Icon n="calendar" s={16}/><input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></div>
    </div>

    <div className="pf-kpis">
      <K ic="employees" c="var(--p)" bg="var(--p-100)" t="بايكرز مقيّمون" v={team.bikers}/>
      <K ic="operations" c="var(--info-ink)" bg="var(--info-bg)" t="إجمالي الغسلات" v={team.washes}/>
      <K ic="star" c="var(--ok-ink)" bg="var(--ok-bg)" t="متوسط تقييم الفريق" v={team.avgRating?team.avgRating.toFixed(2):"—"}/>
      <K ic="complaints" c="var(--bad-ink)" bg="var(--bad-bg)" t="غرامات مؤكّدة" v={AR(team.fines)} sar/>
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
          <div className="pf-stats">
            {r.rating!=null&&<div className="pf-rate"><b>{r.rating.toFixed(2)}</b><span>التقييم</span></div>}
            {r.compliance!=null&&<div className="pf-rate"><b style={{color:r.compliance>=80?"var(--ok-ink)":r.compliance>=60?"var(--warn-ink)":"var(--bad-ink)"}}>{r.compliance}%</b><span>الالتزام</span></div>}
          </div>
        </div>
        <div className="pf-metrics">
          <M t="الغسلات الصافية" v={r.net_washes} sub={`الهدف ${TARGET}`}/>
          <M t="نسبة الشكاوى" v={r.cpct+"%"} tone={r.cpct<1?"g":r.cpct<2?"a":"r"}/>
          <M t="مخالفات" v={r.violations} sub={r.fines>0?`${AR(r.fines)} ر`:"لا غرامات"} tone={r.violations?"r":"g"}/>
          <M t="الالتزام الميداني" v={r.compliance!=null?r.compliance+"%":"—"} tone={r.compliance==null?null:r.compliance>=80?"g":r.compliance>=60?"a":"r"}/>
          <M t="صافي المكافأة" v={r.net_bonus!=null?AR(r.net_bonus):"—"} sub="ريال"/>
        </div>
        <div className="pf-track"><div style={{width:pct+"%",background:pct>=100?"var(--ok)":pct>=75?"var(--p)":"var(--warn)"}}/></div>
        <div className="pf-track-l">{r.net_washes} من {TARGET} غسلة · {pct}%</div>
      </div>);})}</div>}
  </div>);
}
function K({ic,c,bg,t,v,sar}){return(<div className="pf-kpi"><span className="pf-ki" style={{background:bg,color:c}}><Icon n={ic} s={17}/></span><div><div className="pf-kv">{v}{sar&&<i> ر</i>}</div><div className="pf-kl">{t}</div></div></div>);}
function M({t,v,sub,tone}){const c=tone==="g"?"var(--ok-ink)":tone==="a"?"var(--warn-ink)":tone==="r"?"var(--bad-ink)":"var(--ink)";return(<div className="pf-m"><div className="pf-m-v" style={{color:c}}>{v}</div><div className="pf-m-t">{t}</div>{sub&&<div className="pf-m-s">{sub}</div>}</div>);}

const CSS=`
.pf{--b:var(--p)}
.pf-bar{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.pf-month{display:flex;align-items:center;gap:7px;background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:11px;padding:7px 11px;color:var(--mut)}
.pf-month input{border:none;outline:none;font-family:inherit;font-size:13px;font-weight:700;color:var(--ink);background:none}
.pf-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.pf-kpi{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:15px;padding:13px;display:flex;align-items:center;gap:11px;box-shadow:var(--shadow)}
.pf-ki{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.pf-kv{font-size:19px;font-weight:800;letter-spacing:-.5px}.pf-kv i{font-size:11px;color:var(--mut-2);font-weight:600;font-style:normal}
.pf-kl{font-size:11px;color:var(--mut);font-weight:600}
.pf-list{display:flex;flex-direction:column;gap:11px}
.pf-card{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:16px;padding:15px;box-shadow:var(--shadow)}
.pf-c-top{display:flex;align-items:center;gap:12px;margin-bottom:13px}
.pf-av{width:44px;height:44px;border-radius:13px;background:linear-gradient(135deg,var(--p),var(--a));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px;flex:none}
.pf-name{font-size:14.5px;font-weight:800;color:var(--ink)}.pf-name small{color:var(--mut-2);font-weight:600;margin-inline-start:6px;font-size:11.5px}
.pf-stand{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:20px;font-size:10.5px;font-weight:800;margin-top:4px}
.pf-stats{display:flex;gap:16px;flex:none}
.pf-rate{text-align:center;flex:none}.pf-rate b{font-size:22px;font-weight:800;color:var(--ink);letter-spacing:-.5px;display:block;line-height:1}.pf-rate span{font-size:10px;color:var(--mut-2)}
.pf-metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px}
.pf-m{background:var(--soft);border:1px solid var(--line);border-radius:11px;padding:10px 8px;text-align:center}
.pf-m-v{font-size:16px;font-weight:800;letter-spacing:-.3px}
.pf-m-t{font-size:10px;color:var(--mut);font-weight:600;margin-top:2px}
.pf-m-s{font-size:9.5px;color:var(--mut-2);margin-top:1px}
.pf-track{height:8px;background:var(--track);border-radius:6px;overflow:hidden}
.pf-track div{height:100%;border-radius:6px}
.pf-track-l{font-size:10.5px;color:var(--mut-2);margin-top:5px;font-weight:600}
.pf-empty{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px dashed var(--line);border-radius:16px;padding:40px 24px;text-align:center}
.pf-empty-ic{width:64px;height:64px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--info-bg),var(--info-bg));color:var(--info-ink)}
.pf-empty h3{font-size:16px;margin:0 0 8px}.pf-empty p{color:var(--mut);font-size:12.5px;max-width:440px;margin:0 auto;line-height:1.7}
@media(max-width:720px){.pf-kpis{grid-template-columns:1fr 1fr}.pf-metrics{grid-template-columns:1fr 1fr 1fr}}
`;
