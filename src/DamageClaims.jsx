import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import ActivityLog from"./ActivityLog";
const DC_FL={status:"الحالة",biker_name:"البايكر",biker_share:"حصة البايكر",company_share:"حصة الشركة",recovered_amount:"المُحصّل",resolution_method:"طريقة التسوية",booking_ref:"مرجع الحجز",complaint_ref:"مرجع الشكوى",investigation_notes:"ملاحظات التحقيق",evidence:"الإثبات"};
const DC_DV={investigating:"قيد التحقيق",charged:"محمّلة",recovering:"قيد التحصيل",closed:"مغلقة",dismissed:"مرفوضة",cash:"نقدي",salary:"خصم راتب",center:"مركز معتمد"};

const money=n=>Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})+" ﷼";
const CAP=0.5; // سقف الخصم الشهري = 50% من الراتب الأساسي
const fmtD=d=>d?new Date(d+"T00:00:00").toLocaleDateString("en-GB"):"—";

const STATUS={
  investigating:{ar:"قيد التحقيق",bg:"#fef3e2",c:"#b54708"},
  proven:{ar:"ثابتة (تم الإثبات)",bg:"#eef4ff",c:"#1d5bbf"},
  agreed:{ar:"متفق عليها",bg:"#eef4ff",c:"#1d5bbf"},
  deducting:{ar:"قيد الخصم",bg:"#fff3e2",c:"#c2410c"},
  settled:{ar:"مُسدَّدة",bg:"#e7f7ef",c:"#087443"},
  waived:{ar:"متنازَل عنها",bg:"#eef1f4",c:"#64748b"},
  dismissed:{ar:"أُسقطت (لم تثبت)",bg:"#feecea",c:"#b42318"},
};
const STATUS_ORDER=["investigating","proven","agreed","deducting","settled","waived","dismissed"];
const CLOSED=["settled","waived","dismissed"];
const METHOD={
  cash:{ar:"تعويض نقدي مباشر",ic:"cash",c:"#1d5bbf"},
  center:{ar:"إصلاح عبر مركز معتمد (بسعر مخفّض — دون نقد مباشر)",ic:"wrench",c:"#087443"},
  amicable:{ar:"تسوية ودية على مستويات",ic:"compare",c:"#b54708"},
};
const METHOD_ORDER=["cash","center","amicable"];
const blank=()=>({sweater_id:"",biker_name:"",incident_date:new Date().toISOString().slice(0,10),description:"",
  total_cost:"",company_share:"",biker_share:"",monthly_base:"1000",installment_months:"10",recovered_amount:"0",
  status:"investigating",resolution_method:"cash",approved_center:"",booking_ref:"",complaint_ref:"",evidence:"",investigation_notes:"",agreement_notes:""});

export default function DamageClaims({owner,opId}){
  const[rows,setRows]=useState([]);
  const[emps,setEmps]=useState([]);
  const[loading,setLoading]=useState(true);
  const[busy,setBusy]=useState(false);
  const[form,setForm]=useState(null);      // كائن الإدخال/التعديل
  const[msg,setMsg]=useState(null);
  const note=(ok,t)=>setMsg({ok,t});

  const load=async()=>{
    setLoading(true);
    const{data}=await supabase.from("damage_claims").select("*").order("incident_date",{ascending:false});
    setRows(data||[]);setLoading(false);
  };
  useEffect(()=>{load();},[]);
  useEffect(()=>{supabase.from("employees").select("id,full_name,employee_id,staff_role").order("full_name").then(({data})=>setEmps((data||[]).filter(e=>e.staff_role!=="manager")));},[]);

  const tot=useMemo(()=>rows.reduce((a,r)=>{
    const charged=Number(r.biker_share||0),rec=Number(r.recovered_amount||0);
    const outstanding=CLOSED.includes(r.status)?0:Math.max(0,charged-rec);
    return{charged:a.charged+charged,recovered:a.recovered+rec,outstanding:a.outstanding+outstanding,
      open:a.open+(CLOSED.includes(r.status)?0:1),company:a.company+Number(r.company_share||0)};
  },{charged:0,recovered:0,outstanding:0,open:0,company:0}),[rows]);

  // حسابات النموذج (سقف 50%)
  const calc=useMemo(()=>{
    if(!form)return null;
    const share=Number(form.biker_share||0);
    const base=Number(form.monthly_base||0);
    const months=Math.max(1,Number(form.installment_months||1));
    const cap=base*CAP;
    const monthly=+(share/months).toFixed(2);
    const over=cap>0&&monthly>cap;
    const minMonths=cap>0?Math.ceil(share/cap):null;
    return{cap,monthly,over,minMonths,share,base,months};
  },[form]);

  const pickEmp=id=>{const e=emps.find(x=>x.id===id);if(!e)return;setForm(f=>({...f,employee_id:id,biker_name:e.full_name+(e.employee_id?` (${e.employee_id})`:""),sweater_id:e.employee_id||f.sweater_id}));};

  const save=async(close)=>{
    if(!owner){note(false,"الإدخال والتعديل مقصور على المالك");return;}
    if(!form.biker_name){note(false,"أدخل اسم البايكر");return;}
    setBusy(true);
    const c=calc;
    const row={
      operator_id:(opId&&opId!=="all")?opId:null,
      employee_id:form.employee_id||null,sweater_id:form.sweater_id||null,biker_name:form.biker_name||null,
      incident_date:form.incident_date||null,description:form.description||null,
      resolution_method:form.resolution_method||"cash",approved_center:form.approved_center||null,
      booking_ref:form.booking_ref||null,complaint_ref:form.complaint_ref||null,
      total_cost:num(form.total_cost),company_share:num(form.company_share),biker_share:num(form.biker_share),
      monthly_base:num(form.monthly_base),installment_months:form.installment_months===""?null:Number(form.installment_months),
      monthly_deduction:c?c.monthly:null,recovered_amount:num(form.recovered_amount),
      status:form.status||"investigating",evidence:form.evidence||null,
      investigation_notes:form.investigation_notes||null,agreement_notes:form.agreement_notes||null,
      updated_at:new Date().toISOString(),
    };
    let error;
    if(form.id){({error}=await supabase.from("damage_claims").update(row).eq("id",form.id));}
    else{({error}=await supabase.from("damage_claims").insert(row));}
    if(error)note(false,"خطأ: "+error.message);
    else{note(true,form.id?"تم تحديث الدعوى":"تم تسجيل الدعوى");if(close)setForm(null);await load();}
    setBusy(false);
  };
  const edit=r=>setForm({...r,
    incident_date:r.incident_date||"",total_cost:r.total_cost??"",company_share:r.company_share??"",biker_share:r.biker_share??"",
    monthly_base:r.monthly_base??"1000",installment_months:r.installment_months??"",recovered_amount:r.recovered_amount??"0",
    resolution_method:r.resolution_method||"cash",approved_center:r.approved_center||"",booking_ref:r.booking_ref||"",complaint_ref:r.complaint_ref||""});
  const del=async(r)=>{if(!owner)return;if(!confirm("حذف دعوى الضرر؟"))return;await supabase.from("damage_claims").delete().eq("id",r.id);await load();};

  if(loading)return(<div className="dw-skel" style={{height:200}}/>);

  return(<div className="dc">
    <style>{CSS}</style>
    {msg&&msg.t&&<div className={"dc-toast"+(msg.ok?" ok":" err")} onClick={()=>setMsg(null)}>{msg.t}</div>}

    <div className="dc-kpis">
      <Kpi l="المحمّل على البايكرز" n={money(tot.charged)} sub={`${rows.length} دعوى`} c="#E8712B" big/>
      <Kpi l="المُحصّل" n={money(tot.recovered)} c="#087443"/>
      <Kpi l="المتبقّي القائم" n={money(tot.outstanding)} sub={`${tot.open} مفتوحة`} c="#b54708"/>
      <Kpi l="تحمّل المؤسسة" n={money(tot.company)} c="#1d5bbf"/>
    </div>

    <div className="dc-bar">
      <div className="dc-hint"><Icon n="alert" s={15}/> كل حالة تُدخَل يدوياً: تحقيق وإثبات ← اختيار طريقة المعالجة (نقد مباشر / مركز معتمد بسعر مخفّض دون نقد للعميل / تسوية ودية) ← أي تحميل على البايكر يُخصم شهرياً بما لا يتجاوز <b>50%</b> من الراتب الأساسي.</div>
      {owner&&<button className="dc-b brand" onClick={()=>setForm(blank())}><Icon n="plus" s={15}/> دعوى ضرر جديدة</button>}
    </div>

    {form&&<div className="dc-form">
      <div className="dc-fh"><b>{form.id?"تعديل دعوى":"دعوى ضرر جديدة"}</b><button className="dc-x" onClick={()=>setForm(null)}><Icon n="x" s={16}/></button></div>
      <div className="dc-grid">
        <label className="dc-wide"><span>البايكر</span>
          <div className="dc-row2">
            <select value={form.employee_id||""} onChange={e=>pickEmp(e.target.value)}><option value="">— اختر من الموظفين —</option>{emps.map(x=><option key={x.id} value={x.id}>{x.full_name}{x.employee_id?` (${x.employee_id})`:""}</option>)}</select>
            <input placeholder="أو اكتب الاسم" value={form.biker_name} onChange={e=>setForm({...form,biker_name:e.target.value})}/>
            <input placeholder="رقم سويتر" value={form.sweater_id} onChange={e=>setForm({...form,sweater_id:e.target.value})} style={{maxWidth:110}}/>
          </div>
        </label>
        <label><span>تاريخ الحادثة</span><input type="date" value={form.incident_date} onChange={e=>setForm({...form,incident_date:e.target.value})}/></label>
        <label><span>الحالة</span><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{STATUS_ORDER.map(k=><option key={k} value={k}>{STATUS[k].ar}</option>)}</select></label>
        <label><span>رقم الطلب</span><input value={form.booking_ref} onChange={e=>setForm({...form,booking_ref:e.target.value})} placeholder="رقم حجز سويتر"/></label>
        <label><span>مرجع الشكوى/الإفادة</span><input value={form.complaint_ref} onChange={e=>setForm({...form,complaint_ref:e.target.value})} placeholder="DW-CMP-…"/></label>
        <label><span>طريقة المعالجة</span><select value={form.resolution_method} onChange={e=>setForm({...form,resolution_method:e.target.value})}>{METHOD_ORDER.map(k=><option key={k} value={k}>{METHOD[k].ar}</option>)}</select></label>
        {form.resolution_method==="center"&&<label><span>المركز المعتمد</span><input value={form.approved_center} onChange={e=>setForm({...form,approved_center:e.target.value})} placeholder="اسم مركز الصيانة"/></label>}
        <label className="dc-wide"><span>وصف الحادثة/الضرر</span><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="ماذا حدث، والمركبة، وطبيعة الضرر…"/></label>
        <label><span>إجمالي التكلفة (﷼)</span><input type="number" value={form.total_cost} onChange={e=>setForm({...form,total_cost:e.target.value})}/></label>
        <label><span>تحمّل المؤسسة (﷼)</span><input type="number" value={form.company_share} onChange={e=>setForm({...form,company_share:e.target.value})}/></label>
        <label><span>تحميل البايكر (﷼)</span><input type="number" value={form.biker_share} onChange={e=>setForm({...form,biker_share:e.target.value})}/></label>
        <label><span>الراتب الأساسي (﷼)</span><input type="number" value={form.monthly_base} onChange={e=>setForm({...form,monthly_base:e.target.value})}/></label>
        <label><span>عدد أشهر التقسيط</span><input type="number" value={form.installment_months} onChange={e=>setForm({...form,installment_months:e.target.value})}/></label>
        <label><span>المُحصّل (﷼)</span><input type="number" value={form.recovered_amount} onChange={e=>setForm({...form,recovered_amount:e.target.value})}/></label>
        <label className="dc-wide"><span>الدليل</span><input value={form.evidence} onChange={e=>setForm({...form,evidence:e.target.value})} placeholder="إشعار موقّع، صور التطبيق، رقم الطلب…"/></label>
        <label className="dc-wide"><span>ملاحظات التحقيق</span><textarea value={form.investigation_notes} onChange={e=>setForm({...form,investigation_notes:e.target.value})}/></label>
        <label className="dc-wide"><span>ملاحظات الاتفاق/التحميل</span><textarea value={form.agreement_notes} onChange={e=>setForm({...form,agreement_notes:e.target.value})}/></label>
      </div>

      {calc&&<div className={"dc-cap"+(calc.over?" over":"")}>
        <div><span>الدفعة الشهرية</span><b>{money(calc.monthly)}</b></div>
        <div><span>سقف 50% من الأساس</span><b>{money(calc.cap)}</b></div>
        {calc.over?
          <div className="dc-warn"><Icon n="alert" s={14}/> الدفعة تتجاوز السقف — الحدّ الأدنى المسموح <b>{calc.minMonths}</b> شهراً (≤ {money(calc.cap)}/شهر).</div>:
          <div className="dc-ok"><Icon n="check" s={14}/> ضمن السقف النظامي.</div>}
      </div>}

      <div className="dc-save">
        <button className="dc-b brand" disabled={busy} onClick={()=>save(true)}><Icon n="save" s={14}/> حفظ</button>
        <button className="dc-b ghost" disabled={busy} onClick={()=>setForm(null)}>إلغاء</button>
      </div>
    </div>}

    {rows.length===0?<div className="dc-empty"><Icon n="alert" s={28}/><b>لا دعاوى ضرر مسجّلة</b><span>سجّل كل حالة ضرر لمركبة عميل بعد التحقيق والإثبات.</span></div>:
    <div className="dc-list">
      {rows.map(r=>{const s=STATUS[r.status]||STATUS.investigating;const charged=Number(r.biker_share||0),rec=Number(r.recovered_amount||0);
        const outstanding=CLOSED.includes(r.status)?0:Math.max(0,charged-rec);
        const cap=Number(r.monthly_base||0)*CAP;const md=Number(r.monthly_deduction||0);const over=cap>0&&md>cap;
        return(
        <div className="dc-card" key={r.id}>
          <div className="dc-ch">
            <div className="dc-who"><span className="dc-av"><Icon n="alert" s={15}/></span><div><b>{r.biker_name||"—"}</b><small>{fmtD(r.incident_date)}{r.sweater_id?` · #${r.sweater_id}`:""}{r.booking_ref?` · طلب ${r.booking_ref}`:""}</small></div></div>
            <span className="dc-badge" style={{background:s.bg,color:s.c}}>{s.ar}</span>
          </div>
          {(()=>{const m=METHOD[r.resolution_method]||METHOD.cash;return(
            <div className="dc-method" style={{color:m.c}}><Icon n={m.ic} s={13}/> {m.ar}{r.approved_center?` — ${r.approved_center}`:""}{r.complaint_ref?` · ${r.complaint_ref}`:""}</div>);})()}
          {r.description&&<p className="dc-desc">{r.description}</p>}
          <div className="dc-figs">
            <F l="إجمالي" v={money(r.total_cost)}/>
            <F l="المؤسسة" v={money(r.company_share)}/>
            <F l="على البايكر" v={money(r.biker_share)} hi/>
            <F l="مُحصّل" v={money(r.recovered_amount)}/>
            <F l="متبقٍّ" v={money(outstanding)} c={outstanding>0?"#b54708":"#087443"}/>
            <F l="الدفعة/شهر" v={r.installment_months?`${money(md)} × ${r.installment_months}`:"—"} c={over?"#b42318":undefined}/>
          </div>
          {over&&<div className="dc-warn sm"><Icon n="alert" s={13}/> الدفعة الشهرية تتجاوز سقف 50% من الأساس ({money(cap)}).</div>}
          {r.evidence&&<div className="dc-ev"><Icon n="doc" s={13}/> {r.evidence}</div>}
          <div className="dc-acts">
            {owner&&<button className="dc-b sm ghost" onClick={()=>edit(r)}><Icon n="doc" s={13}/> تعديل</button>}
            <ActivityLog table="damage_claims" rowId={r.id} labels={DC_FL} valueMap={DC_DV} entityName="الدعوى"/>
            {owner&&<button className="dc-b sm del" onClick={()=>del(r)}><Icon n="trash" s={13}/></button>}
          </div>
        </div>);})}
    </div>}

    <p className="dc-disc">القاعدة: يُحمَّل البايكر قيمة التعويض بعد التحقيق والإثبات وباتفاق الإدارة، ويُخصم من الراتب على دفعات لا تتجاوز 50% من الراتب الأساسي الشهري (متوافق مع سقف الاستقطاعات في سياسة الرواتب). كل حالة تُقدَّر على حدة.</p>
  </div>);
}

function num(v){return v===""||v==null?null:Number(v);}
function Kpi({l,n,sub,c,big}){return(<div className={"dc-kpi"+(big?" big":"")}><span className="dc-kl">{l}</span><b style={{color:c}}>{n}</b>{sub&&<em>{sub}</em>}</div>);}
function F({l,v,hi,c}){return(<div className={"dc-f"+(hi?" hi":"")}><span>{l}</span><b style={c?{color:c}:null}>{v}</b></div>);}

const CSS=`
.dc{--brand:#E8712B;--ink:#0f172a;--mut:#64748b;--line:#eceef1}
.dc *{box-sizing:border-box}
.dc-toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:80;padding:11px 18px;border-radius:12px;font-weight:700;font-size:13px;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer}
.dc-toast.ok{background:#087443}.dc-toast.err{background:#b42318}
.dc-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
.dc-kpi{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 15px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.dc-kpi.big{background:linear-gradient(135deg,#fff7f2,#fff)}
.dc-kl{font-size:11.5px;color:var(--mut);font-weight:700;display:block}
.dc-kpi b{font-size:19px;font-weight:800;margin-top:6px;display:block;letter-spacing:-.5px}
.dc-kpi.big b{font-size:22px}
.dc-kpi em{font-size:11px;color:#94a3b8;font-style:normal;font-weight:600;display:block;margin-top:3px}
.dc-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.dc-hint{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--mut);font-weight:600;line-height:1.5}
.dc-hint b{color:#b42318}
.dc-b{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:11px;border:1px solid var(--line);background:#fff;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;color:var(--ink)}
.dc-b.brand{background:var(--brand);color:#fff;border-color:var(--brand)}
.dc-b.ghost:hover{border-color:var(--brand);color:var(--brand)}
.dc-b.sm{padding:6px 10px;font-size:11.5px}
.dc-b.del{background:#feecea;color:#b42318;border-color:#f5cfca}
.dc-b:disabled{opacity:.55}
.dc-form{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 18px;box-shadow:0 1px 2px rgba(16,24,40,.05);margin-bottom:14px}
.dc-fh{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.dc-fh b{font-size:15px;font-weight:800}
.dc-x{border:none;background:#f1f3f5;width:30px;height:30px;border-radius:9px;cursor:pointer;color:#64748b}
.dc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.dc-grid label{display:flex;flex-direction:column;gap:5px}
.dc-wide{grid-column:1/-1}
.dc-grid span{font-size:11.5px;color:var(--mut);font-weight:700}
.dc-grid input,.dc-grid select,.dc-grid textarea{border:1px solid #dfe3e8;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:13px;font-weight:600;outline:none;background:#fff;width:100%}
.dc-grid textarea{min-height:52px;resize:vertical}
.dc-row2{display:flex;gap:8px;flex-wrap:wrap}
.dc-row2 select,.dc-row2 input{flex:1;min-width:120px}
.dc-cap{display:flex;align-items:center;gap:18px;flex-wrap:wrap;background:#f4fbf7;border:1px solid #d6f0e2;border-radius:12px;padding:11px 14px;margin-top:12px}
.dc-cap.over{background:#feecea;border-color:#f5cfca}
.dc-cap>div{display:flex;flex-direction:column}
.dc-cap span{font-size:10.5px;color:var(--mut);font-weight:700}
.dc-cap b{font-size:15px;font-weight:800}
.dc-ok{color:#087443;font-weight:700;font-size:12px;display:flex;align-items:center;gap:6px;margin-inline-start:auto}
.dc-warn{color:#b42318;font-weight:700;font-size:12px;display:flex;align-items:center;gap:6px;margin-inline-start:auto}
.dc-warn.sm{margin:8px 0 0;font-size:11.5px}
.dc-save{display:flex;gap:10px;margin-top:14px}
.dc-empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:34px 16px;text-align:center;color:#94a3b8;background:#fff;border:1px solid var(--line);border-radius:16px}
.dc-empty b{font-size:14px;color:#334155}.dc-empty span{font-size:12px}
.dc-list{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.dc-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 16px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.dc-ch{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.dc-who{display:flex;align-items:center;gap:9px}
.dc-av{width:32px;height:32px;border-radius:10px;background:#feecea;color:#b42318;display:flex;align-items:center;justify-content:center;flex:none}
.dc-who b{font-size:13.5px;font-weight:800;display:block}.dc-who small{font-size:11px;color:var(--mut)}
.dc-badge{font-size:10.5px;font-weight:800;padding:3px 10px;border-radius:20px;white-space:nowrap}
.dc-method{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;margin:0 0 8px;line-height:1.4}
.dc-desc{font-size:12px;color:#475569;line-height:1.55;margin:0 0 10px}
.dc-figs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.dc-f{background:#f8fafc;border:1px solid var(--line);border-radius:9px;padding:7px 9px}
.dc-f.hi{background:#fff7f1;border-color:#f7d7bf}
.dc-f span{font-size:10px;color:var(--mut);font-weight:700;display:block}
.dc-f b{font-size:12.5px;font-weight:800}
.dc-ev{font-size:11px;color:#64748b;font-weight:600;margin-top:9px;display:flex;align-items:center;gap:6px}
.dc-warn.sm{color:#b42318}
.dc-acts{display:flex;gap:8px;margin-top:11px;border-top:1px solid #f1f3f5;padding-top:11px}
.dc-disc{font-size:11px;color:#94a3b8;line-height:1.7;margin:14px 2px 0}
@media(max-width:820px){.dc-kpis{grid-template-columns:1fr 1fr}.dc-grid{grid-template-columns:1fr}.dc-list{grid-template-columns:1fr}}
`;
