import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{LEVELS,computeBiker,computeSupervisor,summarize,complaintPct,IN_KIND_TOTAL}from"./payrollEngine";

const AR=n=>Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const nowPeriod=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;};
const periodLabel=p=>{const[y,m]=p.split("-");const mn=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"][+m-1]||m;return`${mn} ${y}`;};
const BLANK_B=()=>({level:"M1",net_washes:"",rating:"",complaint_approved:"",tips:"",dmg:"",abs:"",mat:"",trn:""});

export default function Payroll({opId}){
  const[period,setPeriod]=useState(nowPeriod());
  const[loading,setLoading]=useState(true);
  const[bikers,setBikers]=useState([]);     // [{employee_id,name,biker_id,inp:{...}}]
  const[sup,setSup]=useState({name:"سلمان المالكي",team_orders:"",team_rating:"",team_complaint_approved:"",deductions:""});
  const[supAuto,setSupAuto]=useState(true);  // اشتقاق مدخلات الفريق تلقائياً
  const[runId,setRunId]=useState(null);
  const[status,setStatus]=useState("draft");
  const[msg,setMsg]=useState(null);const[saving,setSaving]=useState(false);
  const[openDeduct,setOpenDeduct]=useState({});

  // تحميل الفريق + كشف الشهر إن وُجد
  useEffect(()=>{(async()=>{
    setLoading(true);setMsg(null);
    let q=supabase.from("employees").select("id,full_name,employee_id,operator_id").not("employee_id","is",null).order("employee_id");
    if(opId&&opId!=="all")q=q.eq("operator_id",opId);
    const{data:emps}=await q;
    // كشف محفوظ؟
    let runQ=supabase.from("payroll_runs").select("*").eq("period",period);
    if(opId&&opId!=="all")runQ=runQ.eq("operator_id",opId);
    const{data:runs}=await runQ.limit(1);
    const run=runs&&runs[0];
    let lines=[];
    if(run){const{data:l}=await supabase.from("payroll_lines").select("*").eq("run_id",run.id).order("sort");lines=l||[];}
    // بناء صفوف البايكرز
    const savedByEmp={};lines.filter(l=>l.role==="biker").forEach(l=>{if(l.employee_id)savedByEmp[l.employee_id]=l;});
    const rows=(emps||[]).map(e=>{
      const s=savedByEmp[e.id];const inp=s?.inputs||{};
      return{employee_id:e.id,name:e.full_name||s?.name||"—",biker_id:e.employee_id,
        inp:{level:inp.level||"M1",net_washes:inp.net_washes??"",rating:inp.rating??"",complaint_approved:inp.complaint_approved??"",tips:inp.tips??"",dmg:inp.dmg??"",abs:inp.abs??"",mat:inp.mat??"",trn:inp.trn??""}};
    });
    setBikers(rows);
    const supLine=lines.find(l=>l.role==="supervisor");
    if(supLine){const i=supLine.inputs||{};setSup({name:supLine.name||"سلمان المالكي",team_orders:i.team_orders??"",team_rating:i.team_rating??"",team_complaint_approved:i.team_complaint_approved??"",deductions:i.deductions??""});setSupAuto(!!i.auto);}
    else setSup(s=>({...s,team_orders:"",team_rating:"",team_complaint_approved:"",deductions:""}));
    setRunId(run?.id||null);setStatus(run?.status||"draft");
    setLoading(false);
  })();},[period,opId]);

  const setB=(i,k,v)=>setBikers(p=>p.map((b,j)=>j===i?{...b,inp:{...b.inp,[k]:v}}:b));

  // حساب حي
  const computed=useMemo(()=>{
    const bl=bikers.map(b=>{
      const washes=+b.inp.net_washes||0;
      const cpct=complaintPct(b.inp.complaint_approved,washes);
      return{...b,res:computeBiker({name:b.name,biker_id:b.biker_id,level:b.inp.level,net_washes:washes,rating:+b.inp.rating||0,complaint_pct:cpct,tips:+b.inp.tips||0,deduct_damage:+b.inp.dmg||0,deduct_absence:+b.inp.abs||0,deduct_materials:+b.inp.mat||0,deduct_training:+b.inp.trn||0}),cpct};
    });
    // اشتقاق الفريق
    const totW=bl.reduce((a,b)=>a+(+b.inp.net_washes||0),0);
    const rated=bl.filter(b=>+b.inp.rating>0);
    const avgR=rated.length?rated.reduce((a,b)=>a+ +b.inp.rating,0)/rated.length:0;
    const totAppr=bl.reduce((a,b)=>a+(+b.inp.complaint_approved||0),0);
    const teamOrders=supAuto?totW:(+sup.team_orders||0);
    const teamRating=supAuto?Math.round(avgR*1000)/1000:(+sup.team_rating||0);
    const teamCPct=supAuto?complaintPct(totAppr,totW):complaintPct(sup.team_complaint_approved,totW);
    const supRes=computeSupervisor({name:sup.name,team_orders:teamOrders,team_rating:teamRating,team_complaint_pct:teamCPct,deductions:+sup.deductions||0});
    const sum=summarize([...bl.map(b=>b.res),supRes]);
    return{bl,supRes,sum,teamOrders,teamRating,teamCPct};
  },[bikers,sup,supAuto]);

  const save=async(approve)=>{
    setSaving(true);setMsg(null);
    try{
      const opv=(opId&&opId!=="all")?opId:null;
      // upsert run
      let rid=runId;
      const runPayload={operator_id:opv,period,status:approve?"approved":status,updated_at:new Date().toISOString()};
      if(rid){await supabase.from("payroll_runs").update(runPayload).eq("id",rid);}
      else{const{data,error}=await supabase.from("payroll_runs").insert(runPayload).select().single();if(error)throw error;rid=data.id;setRunId(rid);}
      // استبدال السطور
      await supabase.from("payroll_lines").delete().eq("run_id",rid);
      const rows=[];
      computed.bl.forEach((b,i)=>rows.push({run_id:rid,operator_id:opv,employee_id:b.employee_id,role:"biker",name:b.name,biker_id:b.biker_id,level:b.inp.level,inputs:b.inp,computed:b.res,base:b.res.base,net_bonus:b.res.net_bonus,total:b.res.total,sort:i}));
      rows.push({run_id:rid,operator_id:opv,role:"supervisor",name:sup.name,level:null,inputs:{...sup,auto:supAuto},computed:computed.supRes,base:computed.supRes.base,net_bonus:computed.supRes.net_bonus,total:computed.supRes.total,sort:99});
      const{error:e2}=await supabase.from("payroll_lines").insert(rows);if(e2)throw e2;
      if(approve)setStatus("approved");
      setMsg({ok:true,t:approve?"تم اعتماد المسير":"تم حفظ المسير"});
    }catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setSaving(false);
  };

  const exportCSV=()=>{
    const H=["الدور","الاسم","ID","المستوى","الغسلات/الطلبات","التقييم","نسبة الشكاوى%","ريال الجودة","ريال السلامة","المعدل","المحور الثابت","إكراميات","مكافأة إنتاج","الاستقطاعات","صافي المكافأة","الأساسي","إجمالي الحزمة"];
    const rows=[H];
    computed.bl.forEach(b=>{const r=b.res;rows.push(["بايكر",r.name,r.biker_id,r.level,r.net_washes,r.rating,b.cpct,r.quality_riyal,r.safety_riyal,r.rate_per_wash,r.fixed,r.tips,r.production,r.deductions,r.net_bonus,r.base,r.total]);});
    const s=computed.supRes;rows.push(["مشرف",s.name,"—","—",s.team_orders,s.team_rating,computed.teamCPct,s.quality_riyal,s.safety_riyal,s.rate_per_order,s.orders_riyal,"—","—",s.deductions,s.net_bonus,s.base,s.total]);
    rows.push([]);rows.push(["الإجمالي","","","","","","","","","","","","","",computed.sum.net_bonus,computed.sum.base,computed.sum.total]);
    const csv="﻿"+rows.map(r=>r.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const b=new Blob([csv],{type:"text/csv;charset=utf-8;"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`payroll_${period}.csv`;a.click();URL.revokeObjectURL(u);
  };

  if(loading)return <div className="dw-skel" style={{height:280}}/>;

  return(<div className="pr">
    <style>{CSS}</style>

    {/* شريط علوي: الشهر + الحالة + الأزرار */}
    <div className="pr-bar">
      <div className="pr-month">
        <Icon n="calendar" s={16}/>
        <input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/>
      </div>
      <span className={"pr-status "+(status==="approved"?"ap":"df")}><span className="pr-dot"/>{status==="approved"?"معتمد":"مسودة"}</span>
      <div style={{flex:1}}/>
      <button className="pr-btn ghost" onClick={exportCSV}><Icon n="download" s={15}/> تصدير</button>
      <button className="pr-btn" onClick={()=>save(false)} disabled={saving}><Icon n="save" s={15}/> {saving?"جارٍ الحفظ…":"حفظ"}</button>
      <button className="pr-btn ok" onClick={()=>save(true)} disabled={saving}><Icon n="check" s={15}/> اعتماد</button>
    </div>
    {msg&&<div className={"pr-msg "+(msg.ok?"ok":"err")}>{msg.t}</div>}

    {/* ملخص المسير */}
    <div className="pr-kpis">
      <Sum ic="employees" c="#E8712B" bg="#fff2e8" t="أعضاء الفريق" v={computed.sum.count}/>
      <Sum ic="payroll" c="#087443" bg="#e7f7ef" t="إجمالي الحزمة" v={AR(computed.sum.total)} sar/>
      <Sum ic="performance" c="#175cd3" bg="#eff6ff" t="صافي المكافآت المصروفة" v={AR(computed.sum.net_bonus)} sar/>
      <Sum ic="star" c="#b54708" bg="#fef3e2" t="إكراميات + إنتاج" v={AR(computed.sum.tips+computed.sum.production)} sar/>
    </div>
    <div className="pr-note"><Icon n="alert" s={13}/> الراتب الأساسي مدفوع مسبقاً — المبلغ المحوَّل شهرياً هو «صافي المكافأة». المزايا العينية {AR(IN_KIND_TOTAL)} ر غير نقدية.</div>

    {/* البايكرز */}
    <div className="pr-sec-h"><Icon n="applicants" s={16}/> البايكرز <span>({computed.bl.length})</span></div>
    {computed.bl.length===0&&<div className="pr-empty">لا يوجد بايكرز مسجّلون بأرقام سويتر. أضِف الموظفين وأرقامهم أولاً من شاشة الموظفين.</div>}
    {computed.bl.map((b,i)=>{const r=b.res;const od=openDeduct[i];return(
      <div className="pr-card" key={b.employee_id}>
        <div className="pr-ch">
          <div className="pr-name">{b.name}<small>#{b.biker_id}</small></div>
          <select className="pr-lvl" value={b.inp.level} onChange={e=>setB(i,"level",e.target.value)}>
            {Object.entries(LEVELS).map(([k,v])=><option key={k} value={k}>{k} · {v.salary} ر</option>)}
          </select>
        </div>
        <div className="pr-inputs">
          <Fld l="الغسلات الصافية"><input type="number" inputMode="numeric" value={b.inp.net_washes} onChange={e=>setB(i,"net_washes",e.target.value)} placeholder="0"/></Fld>
          <Fld l="متوسط التقييم"><input type="number" step="0.01" inputMode="decimal" value={b.inp.rating} onChange={e=>setB(i,"rating",e.target.value)} placeholder="4.50"/></Fld>
          <Fld l="شكاوى معتمدة"><input type="number" inputMode="numeric" value={b.inp.complaint_approved} onChange={e=>setB(i,"complaint_approved",e.target.value)} placeholder="0"/></Fld>
          <Fld l="إكراميات (ر)"><input type="number" step="0.01" inputMode="decimal" value={b.inp.tips} onChange={e=>setB(i,"tips",e.target.value)} placeholder="0"/></Fld>
        </div>
        <div className="pr-chips">
          <span className="pr-chip">جودة <b>{r.quality_riyal.toFixed(2)}</b></span>
          <span className="pr-chip">سلامة <b>{r.safety_riyal.toFixed(2)}</b></span>
          <span className="pr-chip">شكاوى <b>{b.cpct}%</b></span>
          <span className="pr-chip hot">المعدل/غسلة <b>{r.rate_per_wash.toFixed(2)}</b></span>
          {r.production>0&&<span className="pr-chip good"><Icon n="star" s={11}/> إنتاج {r.production}</span>}
          {(+b.inp.rating>0&&+b.inp.rating<4)&&<span className="pr-chip warn"><Icon n="alert" s={11}/> تقييم &lt;4 يوقف الإنتاج</span>}
        </div>
        <div className="pr-deduct-t" onClick={()=>setOpenDeduct(p=>({...p,[i]:!od}))}>
          <Icon n={od?"x":"trash"} s={13}/> الاستقطاعات {r.deductions>0&&<b style={{color:"#b42318"}}>−{AR(r.deductions)} ر</b>} {r.deduction_capped&&<span className="pr-cap">مُقيّدة بسقف 50%</span>}
          <span style={{marginInlineStart:"auto",color:"#94a3b8"}}>{od?"▲":"▼"}</span>
        </div>
        {od&&<div className="pr-inputs pr-ded">
          <Fld l="ضرر (50%)"><input type="number" value={b.inp.dmg} onChange={e=>setB(i,"dmg",e.target.value)} placeholder="0"/></Fld>
          <Fld l="غياب (÷30)"><input type="number" value={b.inp.abs} onChange={e=>setB(i,"abs",e.target.value)} placeholder="0"/></Fld>
          <Fld l="مواد تالفة"><input type="number" value={b.inp.mat} onChange={e=>setB(i,"mat",e.target.value)} placeholder="0"/></Fld>
          <Fld l="رفض تدريب"><input type="number" value={b.inp.trn} onChange={e=>setB(i,"trn",e.target.value)} placeholder="0"/></Fld>
        </div>}
        <div className="pr-res">
          <div><span>صافي المكافأة</span><b className="big">{AR(r.net_bonus)}<i>ر</i></b></div>
          <div className="pr-res-x"><span>الأساسي {r.level}</span><b>{AR(r.base)}</b></div>
          <div className="pr-res-t"><span>إجمالي الحزمة</span><b>{AR(r.total)}<i>ر</i></b></div>
        </div>
      </div>);})}

    {/* المشرف */}
    <div className="pr-sec-h"><Icon n="users" s={16}/> المشرف الميداني</div>
    <div className="pr-card sup">
      <div className="pr-ch">
        <input className="pr-supname" value={sup.name} onChange={e=>setSup({...sup,name:e.target.value})} placeholder="اسم المشرف"/>
        <label className="pr-auto"><input type="checkbox" checked={supAuto} onChange={e=>setSupAuto(e.target.checked)}/> اشتقاق من الفريق</label>
      </div>
      <div className="pr-inputs">
        <Fld l="طلبات الفريق"><input type="number" value={supAuto?computed.teamOrders:sup.team_orders} disabled={supAuto} onChange={e=>setSup({...sup,team_orders:e.target.value})}/></Fld>
        <Fld l="متوسط تقييم الفريق"><input type="number" step="0.001" value={supAuto?computed.teamRating:sup.team_rating} disabled={supAuto} onChange={e=>setSup({...sup,team_rating:e.target.value})}/></Fld>
        <Fld l={supAuto?"نسبة الشكاوى%":"شكاوى الفريق المعتمدة"}><input type="number" step="0.01" value={supAuto?computed.teamCPct:sup.team_complaint_approved} disabled={supAuto} onChange={e=>setSup({...sup,team_complaint_approved:e.target.value})}/></Fld>
        <Fld l="استقطاعات (ر)"><input type="number" value={sup.deductions} onChange={e=>setSup({...sup,deductions:e.target.value})} placeholder="0"/></Fld>
      </div>
      <div className="pr-chips">
        <span className="pr-chip">جودة الفريق <b>{computed.supRes.quality_riyal.toFixed(2)}</b></span>
        <span className="pr-chip">سلامة الفريق <b>{computed.supRes.safety_riyal.toFixed(2)}</b></span>
        <span className="pr-chip hot">المعدل/طلب <b>{computed.supRes.rate_per_order.toFixed(2)}</b></span>
      </div>
      <div className="pr-res">
        <div><span>العمولة المتغيرة</span><b className="big">{AR(computed.supRes.net_bonus)}<i>ر</i></b></div>
        <div className="pr-res-x"><span>الراتب الثابت</span><b>{AR(computed.supRes.base)}</b></div>
        <div className="pr-res-t"><span>إجمالي المشرف</span><b>{AR(computed.supRes.total)}<i>ر</i></b></div>
      </div>
    </div>

    <div className="pr-grand">
      <div><span>مسير {periodLabel(period)}</span><small>{computed.sum.count} أفراد · إجمالي الحزمة</small></div>
      <b>{AR(computed.sum.total)} <i>ريال</i></b>
    </div>
  </div>);
}

function Sum({ic,c,bg,t,v,sar}){return(<div className="pr-kpi"><span className="pr-ki" style={{background:bg,color:c}}><Icon n={ic} s={17}/></span><div><div className="pr-kv">{v}{sar&&<i> ر</i>}</div><div className="pr-kl">{t}</div></div></div>);}
function Fld({l,children}){return(<label className="pr-fld"><span>{l}</span>{children}</label>);}

const CSS=`
.pr{--b:#E8712B}
.pr-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.pr-month{display:flex;align-items:center;gap:7px;background:#fff;border:1px solid #e6e9ee;border-radius:11px;padding:7px 11px;color:#64748b}
.pr-month input{border:none;outline:none;font-family:inherit;font-size:13px;font-weight:700;color:#0f172a;background:none}
.pr-status{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:800}
.pr-status.df{background:#fef3e2;color:#b54708}.pr-status.ap{background:#e7f7ef;color:#087443}
.pr-dot{width:7px;height:7px;border-radius:50%;background:currentColor}
.pr-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 13px;border-radius:11px;border:none;background:#0f172a;color:#fff;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
.pr-btn.ghost{background:#fff;border:1px solid #e6e9ee;color:#334155}
.pr-btn.ok{background:linear-gradient(135deg,#12b76a,#087443)}
.pr-btn:disabled{opacity:.6}
.pr-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:12px}
.pr-msg.ok{background:#e7f7ef;color:#087443}.pr-msg.err{background:#feecea;color:#b42318}
.pr-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.pr-kpi{background:#fff;border:1px solid #eceef1;border-radius:15px;padding:14px;display:flex;align-items:center;gap:11px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.pr-ki{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.pr-kv{font-size:19px;font-weight:800;letter-spacing:-.5px}.pr-kv i{font-size:11px;color:#94a3b8;font-weight:600;font-style:normal}
.pr-kl{font-size:11.5px;color:#64748b;font-weight:600;margin-top:1px}
.pr-note{display:flex;align-items:center;gap:7px;background:#fffbeb;border:1px solid #fde9c8;color:#92600e;font-size:11.5px;font-weight:600;border-radius:11px;padding:9px 12px;margin:12px 0}
.pr-sec-h{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;color:#0f172a;margin:18px 0 10px}
.pr-sec-h span{color:#94a3b8;font-weight:600;font-size:12px}
.pr-empty{background:#fff;border:1px dashed #e6e9ee;border-radius:14px;padding:22px;text-align:center;color:#94a3b8;font-size:12.5px}
.pr-card{background:#fff;border:1px solid #eceef1;border-radius:16px;padding:14px;margin-bottom:11px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.pr-card.sup{border-color:#d3c5f5;background:linear-gradient(180deg,#faf8ff,#fff)}
.pr-ch{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.pr-name{font-size:14.5px;font-weight:800;color:#0f172a}.pr-name small{color:#94a3b8;font-weight:600;font-size:11.5px;margin-inline-start:6px}
.pr-lvl,.pr-supname{border:1px solid #e6e9ee;border-radius:10px;padding:7px 10px;font-family:inherit;font-size:12.5px;font-weight:700;color:#0f172a;background:#fff;outline:none}
.pr-supname{flex:1}
.pr-auto{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:#6941c6;white-space:nowrap}
.pr-inputs{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}
.pr-fld{display:flex;flex-direction:column;gap:4px}
.pr-fld span{font-size:10.5px;color:#64748b;font-weight:600}
.pr-fld input{border:1px solid #e6e9ee;border-radius:10px;padding:9px 10px;font-family:inherit;font-size:13.5px;font-weight:700;color:#0f172a;outline:none;width:100%;box-sizing:border-box;text-align:center}
.pr-fld input:focus{border-color:var(--b);box-shadow:0 0 0 3px rgba(232,113,43,.1)}
.pr-fld input:disabled{background:#f6f7f9;color:#64748b}
.pr-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:11px}
.pr-chip{display:inline-flex;align-items:center;gap:5px;background:#f6f7f9;border:1px solid #eceef1;border-radius:9px;padding:4px 9px;font-size:11px;color:#64748b;font-weight:600}
.pr-chip b{color:#0f172a}
.pr-chip.hot{background:#fff2e8;border-color:#ffd9bd;color:#b54708}.pr-chip.hot b{color:#b54708}
.pr-chip.good{background:#e7f7ef;border-color:#b7e4cd;color:#087443}.pr-chip.good b{color:#087443}
.pr-chip.warn{background:#feecea;border-color:#f7bfba;color:#b42318}
.pr-deduct-t{display:flex;align-items:center;gap:7px;margin-top:11px;padding-top:11px;border-top:1px dashed #eceef1;font-size:12px;font-weight:700;color:#64748b;cursor:pointer}
.pr-cap{background:#feecea;color:#b42318;border-radius:8px;padding:1px 7px;font-size:10px}
.pr-ded{margin-top:10px}
.pr-res{display:flex;align-items:center;gap:14px;margin-top:12px;padding-top:12px;border-top:1px solid #f1f3f5;flex-wrap:wrap}
.pr-res span{font-size:10.5px;color:#94a3b8;font-weight:600;display:block}
.pr-res .big{font-size:22px;font-weight:800;color:#087443;letter-spacing:-.5px}
.pr-res b i{font-size:11px;color:#94a3b8;font-weight:600;font-style:normal;margin-inline-start:2px}
.pr-res-x{margin-inline-start:auto;text-align:center}.pr-res-x b{font-size:14px;font-weight:700;color:#334155}
.pr-res-t{text-align:center}.pr-res-t b{font-size:16px;font-weight:800;color:#0f172a}
.pr-grand{display:flex;align-items:center;justify-content:space-between;gap:12px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;border-radius:16px;padding:16px 20px;margin-top:16px}
.pr-grand span{font-size:14px;font-weight:800;display:block}.pr-grand small{font-size:11px;color:#94a3b8}
.pr-grand b{font-size:24px;font-weight:800;letter-spacing:-.5px}.pr-grand b i{font-size:12px;color:#cbd5e1;font-weight:600;font-style:normal}
@media(max-width:720px){
  .pr-kpis{grid-template-columns:1fr 1fr}
  .pr-inputs{grid-template-columns:1fr 1fr}
}
`;
