import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{useToast}from"./ui";
import{LEVELS,computeBiker,computeSupervisor,summarize,complaintPct,complaintRatio,IN_KIND_TOTAL}from"./payrollEngine";
import{payrollRoster,tipsCheck}from"./payrollRoster";

const PAY_STATUS={paid:{ar:"مدفوعة"},deferred:{ar:"مؤجَّلة"},pending:{ar:"بانتظار الدفع"}}; // كما في payrollLine.js (بلا استيراد حتى لا تنشأ حزمة مشتركة)
const RUN_ST={approved:"معتمد",partially_paid:"مدفوع جزئياً",paid:"مدفوع"};
// حالة دفع السطر (للعرض فقط — التسجيل من القاعدة حالياً)
const payOf=l=>l&&l.payment_status?{st:l.payment_status,at:l.paid_at,amt:l.paid_amount,ref:l.payment_ref,fee:Number(l.bank_fee)||0,base:l.base_paid,note:l.pay_note}:null;
const AR=n=>Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
// الافتراضي الشهر السابق (كالإقفال الشهري): مسير الشهر يُعدّ بعد انتهائه
const prevPeriod=()=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;};
const periodLabel=p=>{const[y,m]=p.split("-");const mn=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"][+m-1]||m;return`${mn} ${y}`;};

// القفل: المسير غير «draft» لا يُحفظ ولا يُعدَّل ولا يُسحب إليه (التصحيح بسطر تسوية لاحقاً)، والاعتماد للمالك فقط
// (يفرضهما أيضاً payroll_runs_guard/payroll_lines_guard في القاعدة). وضع «الكل» للعرض فقط.
export default function Payroll({opId,owner}){
  const[period,setPeriod]=useState(prevPeriod());
  const[loading,setLoading]=useState(true);
  const[bikers,setBikers]=useState([]);     // [{employee_id,name,biker_id,inp:{...}}]
  const[sup,setSup]=useState({name:"",team_orders:"",team_rating:"",team_complaint_approved:"",deductions:""});
  const[unlinked,setUnlinked]=useState([]);   // صفوف عمليات بلا موظف مربوط (كانت تُستبعد بصمت)
  const[stlTips,setStlTips]=useState(null);   // sweater_settlements.tip_amount للشهر
  const[supPay,setSupPay]=useState(null);   // حالة دفع سطر المشرف المحفوظ
  const[supAuto,setSupAuto]=useState(true);  // اشتقاق مدخلات الفريق تلقائياً
  const[runId,setRunId]=useState(null);
  const[status,setStatus]=useState("draft");
  const toast=useToast();
  const[msg,setMsgRaw]=useState(null);const[saving,setSaving]=useState(false);
  // رسائل النجاح → Toast؛ الأخطاء تبقى في الصفحة
  const setMsg=m=>{if(m&&m.ok){toast.ok(m.t,undefined,m.t.length>60?7000:undefined);setMsgRaw(null);}else setMsgRaw(m);};
  const[openDeduct,setOpenDeduct]=useState({});
  const[ops,setOps]=useState({});           // {sweater_id:{net_washes,rating,approved_complaints}}
  const[fromOps,setFromOps]=useState(false); // هل عُبّئت المدخلات من العمليات

  // تحميل الفريق + كشف الشهر إن وُجد
  useEffect(()=>{(async()=>{
    setLoading(true);setMsg(null);
    // كل الموظفين الحقيقيين؛ الفرز للمسير (بايكر نشط في الشهر) في payrollRoster
    let q=supabase.from("employees").select("id,full_name,employee_id,operator_id,staff_role,start_date,is_test").order("employee_id"); // التجريبي يُستبعد في payrollRoster (ويُعرف رقمه فلا يظهر «غير مربوط»)
    if(opId&&opId!=="all")q=q.eq("operator_id",opId);
    const[{data:emps},{data:offs},{data:stl}]=await Promise.all([q,
      supabase.from("offboarding").select("employee_id,sweater_id,last_day").not("last_day","is",null),
      (()=>{let sq=supabase.from("sweater_settlements").select("tip_amount").eq("period",period);if(opId&&opId!=="all")sq=sq.eq("operator_id",opId);return sq;})()]);
    const stlT=(stl||[]).filter(x=>Number(x.tip_amount)>0); // tip_amount افتراضه 0 قبل قبول الفاتورة ⇒ 0 = غير معروفsetStlTips(stlT.length?stlT.reduce((a,x)=>a+Number(x.tip_amount),0):null);
    // كشف محفوظ؟
    // وضع «الكل»: لا يُحمَّل مسير مشغّل بعينه (كان يأخذ مسيراً عشوائياً ثم يكتب فوقه)
    let run=null;
    if(opId&&opId!=="all"){const{data:runs}=await supabase.from("payroll_runs").select("*").eq("period",period).eq("operator_id",opId).limit(1);run=runs&&runs[0];}
    let lines=[];
    if(run){const{data:l}=await supabase.from("payroll_lines").select("*").eq("run_id",run.id).order("sort");lines=l||[];}
    // بيانات العمليات لهذا الشهر (المشتقّة من تقارير سويتر)
    let opsQ=supabase.from("ops_biker_month").select("sweater_id,biker_name,net_washes,rating,approved_complaints,tips").eq("period",period);
    if(opId&&opId!=="all")opsQ=opsQ.eq("operator_id",opId);
    const{data:opsRows}=await opsQ;
    const opsMap={};(opsRows||[]).forEach(o=>{if(o.sweater_id)opsMap[String(o.sweater_id).trim()]=o;});
    setOps(opsMap);
    const hasRun=lines.length>0;let usedOps=false;
    // بناء صفوف البايكرز
    const savedByEmp={};lines.filter(l=>l.role==="biker").forEach(l=>{if(l.employee_id)savedByEmp[l.employee_id]=l;});
    const R=payrollRoster({emps:emps||[],offboarding:offs||[],ops:opsRows||[],period,savedIds:Object.keys(savedByEmp)});
    setUnlinked(R.unlinked);
    const rows=R.bikers.map(e=>{
      const s=savedByEmp[e.id];const inp=s?.inputs||{};
      const o=opsMap[String(e.employee_id).trim()];
      // إن لم يوجد كشف محفوظ لكن توجد بيانات عمليات → عبّئ منها
      const useOps=!s&&o;if(useOps)usedOps=true;
      return{employee_id:e.id,name:e.full_name||s?.name||"—",biker_id:e.employee_id,noStart:!e.start_date,pay:payOf(s),
        inp:{level:inp.level||"M1",
          net_washes:inp.net_washes??(useOps?o.net_washes:""),
          rating:inp.rating??(useOps&&o.rating!=null?o.rating:""),
          complaint_approved:inp.complaint_approved??(useOps?o.approved_complaints:""),
          tips:inp.tips??(useOps&&o.tips!=null?o.tips:""),qd:inp.qd??"",dmg:inp.dmg??"",abs:inp.abs??"",mat:inp.mat??"",trn:inp.trn??""}};
    });
    setBikers(rows);setFromOps(usedOps&&!hasRun);
    const supLine=lines.find(l=>l.role==="supervisor");setSupPay(payOf(supLine));
    const supName=R.supervisor?R.supervisor.full_name:"";
    if(supLine){const i=supLine.inputs||{};setSup({name:supLine.name||supName,team_orders:i.team_orders??"",team_rating:i.team_rating??"",team_complaint_approved:i.team_complaint_approved??"",deductions:i.deductions??""});setSupAuto(!!i.auto);}
    else setSup({name:supName,team_orders:"",team_rating:"",team_complaint_approved:"",deductions:""});
    setRunId(run?.id||null);setStatus(run?.status||"draft");
    setLoading(false);
  })();},[period,opId]);

  const setB=(i,k,v)=>setBikers(p=>p.map((b,j)=>j===i?{...b,inp:{...b.inp,[k]:v}}:b));
  const syncFromOps=()=>{setBikers(p=>p.map(b=>{const o=ops[String(b.biker_id).trim()];if(!o)return b;return{...b,inp:{...b.inp,net_washes:o.net_washes??b.inp.net_washes,rating:o.rating!=null?o.rating:b.inp.rating,complaint_approved:o.approved_complaints??b.inp.complaint_approved,tips:o.tips!=null?o.tips:b.inp.tips}};}));setFromOps(true);setMsg({ok:true,t:"تم سحب الغسلات والتقييم والشكاوى والإكراميات من العمليات"});};
  const opsCount=Object.keys(ops).length;
  const allOps=!opId||opId==="all";
  const locked=status!=="draft";   // approved / final وما بعدهما
  const ro=locked||allOps;

  // حساب حي
  const computed=useMemo(()=>{
    const bl=bikers.map(b=>{
      const washes=+b.inp.net_washes||0;
      // الشريحة من النسبة الكاملة، والمعروض مقرّب
      const cpct=complaintPct(b.inp.complaint_approved,washes);
      const noRating=String(b.inp.rating??"").trim()==="";
      return{...b,noRating,noWashes:!washes,res:computeBiker({name:b.name,biker_id:b.biker_id,level:b.inp.level,net_washes:washes,rating:+b.inp.rating||0,complaint_pct:complaintRatio(b.inp.complaint_approved,washes),tips:+b.inp.tips||0,quality_deduction:+b.inp.qd||0,deduct_damage:+b.inp.dmg||0,deduct_absence:+b.inp.abs||0,deduct_materials:+b.inp.mat||0,deduct_training:+b.inp.trn||0}),cpct};
    });
    // اشتقاق الفريق
    const totW=bl.reduce((a,b)=>a+(+b.inp.net_washes||0),0);
    const rated=bl.filter(b=>+b.inp.rating>0);
    const avgR=rated.length?rated.reduce((a,b)=>a+ +b.inp.rating,0)/rated.length:0;
    const totAppr=bl.reduce((a,b)=>a+(+b.inp.complaint_approved||0),0);
    const teamOrders=supAuto?totW:(+sup.team_orders||0);
    const teamRating=supAuto?avgR:(+sup.team_rating||0);   // بلا تقريب قبل الشريحة
    // اليدوي يقسم على طلبات الفريق اليدوية (كان يقسم على مجموع غسلات البايكرز)
    const teamRatio=supAuto?complaintRatio(totAppr,totW):complaintRatio(sup.team_complaint_approved,teamOrders);
    const teamCPct=Math.round(teamRatio*100)/100;
    const supRes=computeSupervisor({name:sup.name,team_orders:teamOrders,team_rating:teamRating,team_complaint_pct:teamRatio,deductions:+sup.deductions||0});
    const sum=summarize([...bl.map(b=>b.res),supRes]);
    const tipsWarn=tipsCheck(bl.reduce((a,b)=>a+(+b.inp.tips||0),0),stlTips);
    return{bl,supRes,sum,teamOrders,teamRating,teamCPct,tipsWarn};
  },[bikers,sup,supAuto,stlTips]);

  const save=async(approve)=>{
    if(ro||(approve&&!owner))return;
    if(approve&&!window.confirm(`اعتماد مسير ${periodLabel(period)} نهائي: لا تعديل بعده إلا بسطر تسوية. متابعة؟`))return;
    setSaving(true);setMsg(null);
    try{
      const opv=opId;
      // upsert run
      let rid=runId;
      // المسير يبقى draft أثناء استبدال الأسطر (الحارس يرفض تعديل أسطر مسير معتمد)، ثم يُعتمد في الخطوة الأخيرة
      const runPayload={operator_id:opv,period,status:"draft",updated_at:new Date().toISOString()};
      if(rid){const{data:u,error}=await supabase.from("payroll_runs").update(runPayload).eq("id",rid).select("id");if(error)throw error;if(!u||!u.length)throw new Error("لم يُحدَّث المسير — تحقّق من الصلاحية أو حالة المسير");}
      else{const{data,error}=await supabase.from("payroll_runs").insert(runPayload).select().single();if(error)throw error;rid=data.id;setRunId(rid);}
      // استبدال السطور
      const{error:e1}=await supabase.from("payroll_lines").delete().eq("run_id",rid);if(e1)throw e1;
      const rows=[];
      computed.bl.forEach((b,i)=>rows.push({run_id:rid,operator_id:opv,period,employee_id:b.employee_id,role:"biker",name:b.name,biker_id:b.biker_id,level:b.inp.level,inputs:b.inp,computed:b.res,base:b.res.base,net_bonus:b.res.net_bonus,total:b.res.total,sort:i}));
      rows.push({run_id:rid,operator_id:opv,period,role:"supervisor",name:sup.name,level:null,inputs:{...sup,auto:supAuto},computed:computed.supRes,base:computed.supRes.base,net_bonus:computed.supRes.net_bonus,total:computed.supRes.total,sort:99});
      const{error:e2}=await supabase.from("payroll_lines").insert(rows);if(e2)throw e2;
      if(approve){const{data:u3,error:e3}=await supabase.from("payroll_runs").update({status:"approved",updated_at:new Date().toISOString()}).eq("id",rid).select("id");if(e3)throw e3;if(!u3||!u3.length)throw new Error("لم يُعتمد المسير — تحقّق من الصلاحية");setStatus("approved");}
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

  if(loading)return <div className="g-skel" style={{height:280}}/>;

  return(<div className="pr">
    <style>{CSS}</style>

    {/* شريط علوي: الشهر + الحالة + الأزرار */}
    <div className="pr-bar">
      <div className="pr-month">
        <Icon n="calendar" s={16}/>
        <input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/>
      </div>
      {!allOps&&<span className={"pr-status "+(locked?"ap":"df")}><span className="pr-dot"/>{locked?(RUN_ST[status]||"معتمد"):"مسودة"}</span>}
      <div style={{flex:1}}/>
      {!ro&&opsCount>0&&<button className="pr-btn ghost" onClick={syncFromOps} title="سحب الغسلات والتقييم والشكاوى من تقارير سويتر المرفوعة في العمليات"><Icon n="refresh" s={15}/> سحب من العمليات</button>}
      {!allOps&&<button className="pr-btn ghost" onClick={exportCSV}><Icon n="download" s={15}/> تصدير</button>}
      {!ro&&<button className="pr-btn" onClick={()=>save(false)} disabled={saving}><Icon n="save" s={15}/> {saving?"جارٍ الحفظ…":"حفظ"}</button>}
      {!ro&&owner&&<button className="pr-btn ok" onClick={()=>save(true)} disabled={saving}><Icon n="check" s={15}/> اعتماد</button>}
    </div>
    {allOps&&<div className="pr-msg pr-lock"><Icon n="alert" s={13}/> وضع «كل المشغّلين» معاينة محسوبة من العمليات لا المسير المحفوظ — اختر مشغّلاً لعرض مسيره أو تعديله أو اعتماده.</div>}
    {!allOps&&locked&&<div className="pr-msg pr-lock"><Icon n="lock" s={13}/> المسير معتمد ومقفل — لا حفظ ولا تعديل ولا سحب من العمليات. التصحيح بسطر تسوية فقط.</div>}
    {!ro&&!owner&&<div className="pr-msg pr-lock"><Icon n="alert" s={13}/> اعتماد المسير للمالك فقط — احفظ المسودة ليعتمدها.</div>}
    {msg&&<div className={"pr-msg "+(msg.ok?"ok":"err")}>{msg.t}</div>}
    {fromOps&&!ro&&<div className="pr-msg ok" style={{background:"var(--info-bg)",color:"var(--info-ink)"}}><Icon n="operations" s={13} style={{verticalAlign:"-2px"}}/> المدخلات معبّأة تلقائياً من تقارير سويتر (العمليات) — يمكنك التعديل يدوياً قبل الحفظ.</div>}

    {unlinked.length>0&&<div className="pr-msg err"><Icon n="alert" s={13}/> بايكرز في تقارير الشهر غير مربوطين بموظف — لن يظهروا في المسير حتى تُربط أرقامهم من شاشة الموظفين: {unlinked.map(u=>`${u.biker_name||"—"} #${u.sweater_id}`).join("، ")}</div>}
    {!allOps&&!sup.name&&<div className="pr-msg err"><Icon n="alert" s={13}/> لا مشرف محدّد — عيّن دور «supervisor» للمشرف في جدول الموظفين أو اكتب اسمه في بطاقة المشرف.</div>}
    {computed.tipsWarn&&<div className="pr-msg err"><Icon n="alert" s={13}/> مجموع الإكراميات {AR(computed.tipsWarn.total)} ر ≠ إكراميات الفاتورة {AR(computed.tipsWarn.invoice)} ر (الفرق {AR(computed.tipsWarn.diff)} ر)</div>}

    {/* ملخص المسير */}
    <div className="pr-kpis">
      <Sum ic="employees" c="var(--p)" bg="var(--p-100)" t="أعضاء الفريق" v={computed.sum.count}/>
      <Sum ic="payroll" c="var(--ok-ink)" bg="var(--ok-bg)" t="إجمالي الحزمة" v={AR(computed.sum.total)} sar/>
      <Sum ic="performance" c="var(--info-ink)" bg="var(--info-bg)" t="صافي المكافآت المصروفة" v={AR(computed.sum.net_bonus)} sar/>
      <Sum ic="star" c="var(--warn-ink)" bg="var(--warn-bg)" t="إكراميات + إنتاج" v={AR(computed.sum.tips+computed.sum.production)} sar/>
    </div>
    <div className="pr-note"><Icon n="alert" s={13}/> الراتب الأساسي مدفوع مسبقاً — المبلغ المحوَّل شهرياً هو «صافي المكافأة». المزايا العينية {AR(IN_KIND_TOTAL)} ر غير نقدية.</div>

    <fieldset className="pr-fs" disabled={ro}>
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
          <span className="pr-chip">شكاوى <b>{b.cpct.toFixed(2)}%</b></span>
          <span className="pr-chip hot">المعدل/غسلة <b>{r.rate_per_wash.toFixed(2)}</b></span>
          {r.production>0&&<span className="pr-chip good"><Icon n="star" s={11}/> إنتاج {r.production}</span>}
          {(+b.inp.rating>0&&+b.inp.rating<4)&&<span className="pr-chip warn"><Icon n="alert" s={11}/> تقييم &lt;4 يوقف الإنتاج</span>}
          {b.noRating&&<span className="pr-chip caut"><Icon n="alert" s={11}/> لا تقييم — أدخله يدوياً (لا يُحتسب 0 تلقائياً)</span>}
          {b.noWashes&&<span className="pr-chip caut"><Icon n="alert" s={11}/> بدون غسلات — تأكد</span>}
          {b.noStart&&<span className="pr-chip caut"><Icon n="alert" s={11}/> تاريخ المباشرة غير مُدخل</span>}
          {r.base_deducted>0&&<span className="pr-chip bad"><Icon n="alert" s={11}/> الاستقطاعات تتجاوز المكافأة — يُخصم {AR(r.base_deducted)} ر من الأساس</span>}
        </div>
        <div className="pr-deduct-t" onClick={()=>setOpenDeduct(p=>({...p,[i]:!od}))}>
          <Icon n={od?"x":"trash"} s={13}/> الاستقطاعات {r.deductions>0&&<b style={{color:"var(--bad-ink)"}}>−{AR(r.deductions)} ر</b>} {r.deduction_capped&&<span className="pr-cap">مُقيّدة بسقف 50%</span>}
          <span style={{marginInlineStart:"auto",color:"var(--mut-2)"}}>{od?"▲":"▼"}</span>
        </div>
        {od&&<div className="pr-inputs pr-ded">
          <Fld l="خصم الجودة"><input type="number" value={b.inp.qd} onChange={e=>setB(i,"qd",e.target.value)} placeholder="0"/></Fld>
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
        {locked&&<PayRow p={b.pay}/>}
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
        <Fld l="متوسط تقييم الفريق"><input type="number" step="0.001" value={supAuto?Math.round(computed.teamRating*1000)/1000:sup.team_rating} disabled={supAuto} onChange={e=>setSup({...sup,team_rating:e.target.value})}/></Fld>
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
      {locked&&<PayRow p={supPay}/>}
    </div>

    </fieldset>

    <div className="pr-grand">
      <div><span>مسير {periodLabel(period)}</span><small>{computed.sum.count} أفراد · إجمالي الحزمة</small></div>
      <b>{AR(computed.sum.total)} <i>ريال</i></b>
    </div>
  </div>);
}

function Sum({ic,c,bg,t,v,sar}){return(<div className="pr-kpi"><span className="pr-ki" style={{background:bg,color:c}}><Icon n={ic} s={17}/></span><div><div className="pr-kv">{v}{sar&&<i> ر</i>}</div><div className="pr-kl">{t}</div></div></div>);}
function PayRow({p}){if(!p)return null;const S=PAY_STATUS[p.st]||PAY_STATUS.pending;
  return(<div className="pr-chips pr-pay"><span className={"pr-chip "+(p.st==="paid"?"good":"caut")}>{S.ar}{p.amt!=null&&<b> {AR(p.amt)} ر</b>}</span>
    {p.at&&<span className="pr-chip">{p.at}</span>}{p.ref&&<span className="pr-chip" dir="ltr">{p.ref}</span>}{p.fee>0&&<span className="pr-chip">رسوم التحويل {AR(p.fee)} (على المؤسسة)</span>}
    {p.base===true&&<span className="pr-chip good">الأساس مدفوع</span>}{p.note&&<span className="pr-chip">{p.note}</span>}</div>);}
function Fld({l,children}){return(<label className="pr-fld"><span>{l}</span>{children}</label>);}

const CSS=`
.pr{--b:var(--p)}
.pr-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.pr-month{display:flex;align-items:center;gap:7px;background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:11px;padding:7px 11px;color:var(--mut)}
.pr-month input{border:none;outline:none;font-family:inherit;font-size:13px;font-weight:700;color:var(--ink);background:none}
.pr-status{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:800}
.pr-status.df{background:var(--warn-bg);color:var(--warn-ink)}.pr-status.ap{background:var(--ok-bg);color:var(--ok-ink)}
.pr-fs{border:0;padding:0;margin:0;min-width:0}
.pr-lock{display:flex;align-items:center;gap:7px;background:var(--soft);color:var(--ink-2)}
.pr-dot{width:7px;height:7px;border-radius:50%;background:currentColor}
.pr-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 13px;border-radius:11px;border:none;background:var(--ink);color:var(--bg);font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
.pr-btn.ghost{background:var(--glass-2);border:1px solid var(--line-2);color:var(--ink-2)}
.pr-btn.ok{background:linear-gradient(135deg,var(--ok),color-mix(in srgb,var(--ok) 72%,black))}
.pr-btn:disabled{opacity:.6}
.pr-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:12px}
.pr-msg.ok{background:var(--ok-bg);color:var(--ok-ink)}.pr-msg.err{background:var(--bad-bg);color:var(--bad-ink)}
.pr-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.pr-kpi{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:15px;padding:14px;display:flex;align-items:center;gap:11px;box-shadow:var(--shadow)}
.pr-ki{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.pr-kv{font-size:19px;font-weight:800;letter-spacing:-.5px}.pr-kv i{font-size:11px;color:var(--mut-2);font-weight:600;font-style:normal}
.pr-kl{font-size:11.5px;color:var(--mut);font-weight:600;margin-top:1px}
.pr-note{display:flex;align-items:center;gap:7px;background:var(--warn-bg);border:1px solid color-mix(in srgb,var(--warn) 35%,transparent);color:var(--warn-ink);font-size:11.5px;font-weight:600;border-radius:11px;padding:9px 12px;margin:12px 0}
.pr-sec-h{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;color:var(--ink);margin:18px 0 10px}
.pr-sec-h span{color:var(--mut-2);font-weight:600;font-size:12px}
.pr-empty{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px dashed var(--line);border-radius:14px;padding:22px;text-align:center;color:var(--mut-2);font-size:12.5px}
.pr-card{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:16px;padding:14px;margin-bottom:11px;box-shadow:var(--shadow)}
.pr-card.sup{border-color:color-mix(in srgb,var(--info) 35%,transparent);background:linear-gradient(180deg,var(--info-bg),var(--glass-3))}
.pr-ch{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.pr-name{font-size:14.5px;font-weight:800;color:var(--ink)}.pr-name small{color:var(--mut-2);font-weight:600;font-size:11.5px;margin-inline-start:6px}
.pr-lvl,.pr-supname{border:1px solid var(--line);border-radius:10px;padding:7px 10px;font-family:inherit;font-size:12.5px;font-weight:700;color:var(--ink);background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);outline:none}
.pr-supname{flex:1}
.pr-auto{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:var(--info-ink);white-space:nowrap}
.pr-inputs{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}
.pr-fld{display:flex;flex-direction:column;gap:4px}
.pr-fld span{font-size:10.5px;color:var(--mut);font-weight:600}
.pr-fld input{border:1px solid var(--line-2);border-radius:10px;padding:9px 10px;font-family:inherit;font-size:13.5px;font-weight:700;color:var(--ink);outline:none;width:100%;box-sizing:border-box;text-align:center}
.pr-fld input:focus{border-color:var(--b);box-shadow:0 0 0 3px rgba(232,113,43,.1)}
.pr-fld input:disabled{background:var(--soft);color:var(--mut)}
.pr-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:11px}
.pr-chip{display:inline-flex;align-items:center;gap:5px;background:var(--soft);border:1px solid var(--line-2);border-radius:9px;padding:4px 9px;font-size:11px;color:var(--mut);font-weight:600}
.pr-chip b{color:var(--ink)}
.pr-chip.hot{background:var(--p-100);border-color:rgba(var(--p-rgb),.35);color:var(--warn-ink)}.pr-chip.hot b{color:var(--warn-ink)}
.pr-chip.caut{background:var(--warn-bg);color:var(--warn-ink)}.pr-chip.bad{background:var(--bad-bg);color:var(--bad-ink)}
.pr-chip.good{background:var(--ok-bg);border-color:color-mix(in srgb,var(--ok) 35%,transparent);color:var(--ok-ink)}.pr-chip.good b{color:var(--ok-ink)}
.pr-chip.warn{background:var(--bad-bg);border-color:color-mix(in srgb,var(--bad) 35%,transparent);color:var(--bad-ink)}
.pr-deduct-t{display:flex;align-items:center;gap:7px;margin-top:11px;padding-top:11px;border-top:1px dashed var(--line);font-size:12px;font-weight:700;color:var(--mut);cursor:pointer}
.pr-cap{background:var(--bad-bg);color:var(--bad-ink);border-radius:8px;padding:1px 7px;font-size:10px}
.pr-ded{margin-top:10px}
.pr-res{display:flex;align-items:center;gap:14px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);flex-wrap:wrap}
.pr-res span{font-size:10.5px;color:var(--mut-2);font-weight:600;display:block}
.pr-res .big{font-size:22px;font-weight:800;color:var(--ok-ink);letter-spacing:-.5px}
.pr-res b i{font-size:11px;color:var(--mut-2);font-weight:600;font-style:normal;margin-inline-start:2px}
.pr-res-x{margin-inline-start:auto;text-align:center}.pr-res-x b{font-size:14px;font-weight:700;color:var(--ink-2)}
.pr-res-t{text-align:center}.pr-res-t b{font-size:16px;font-weight:800;color:var(--ink)}
.pr-grand{display:flex;align-items:center;justify-content:space-between;gap:12px;background:linear-gradient(135deg,var(--ink),var(--ink));color:var(--bg);border-radius:16px;padding:16px 20px;margin-top:16px}
.pr-grand span{font-size:14px;font-weight:800;display:block}.pr-grand small{font-size:11px;color:var(--mut-2)}
.pr-grand b{font-size:24px;font-weight:800;letter-spacing:-.5px}.pr-grand b i{font-size:12px;color:var(--mut-2);font-weight:600;font-style:normal}
@media(max-width:720px){
  .pr-kpis{grid-template-columns:1fr 1fr}
  .pr-inputs{grid-template-columns:1fr 1fr}
}
`;
