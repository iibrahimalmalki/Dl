import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{HOUSING_VIOLATIONS,HOUSING_REDLINES,suggestFine}from"./housingPolicy";

const money=n=>Number(n||0).toLocaleString("en-US",{maximumFractionDigits:0})+" ﷼";
const fmtD=d=>d?new Date(d+"T00:00:00").toLocaleDateString("en-GB"):"—";
const daysLeft=end=>{if(!end)return null;const t=new Date();t.setHours(0,0,0,0);return Math.round((new Date(end+"T00:00:00")-t)/86400000);};
const payBand=p=>{if(p.paid)return{ar:"مسدّدة",c:"#087443",bg:"#e7f7ef"};const d=daysLeft(p.due_date);if(d==null)return{ar:"—",c:"#94a3b8",bg:"#f4f5f7"};if(d<0)return{ar:"متأخرة",c:"#b42318",bg:"#feecea"};if(d<=15)return{ar:"مستحقّة قريباً",c:"#c2410c",bg:"#ffedd5"};return{ar:"قادمة",c:"#1d5bbf",bg:"#eef4ff"};};

export default function Housing({opId}){
  const[tab,setTab]=useState("units");
  const[loading,setLoading]=useState(true);
  const[units,setUnits]=useState([]);const[occ,setOcc]=useState([]);const[pays,setPays]=useState([]);const[vios,setVios]=useState([]);
  const[uForm,setUForm]=useState(null);const[oForm,setOForm]=useState(null);const[pForm,setPForm]=useState(null);const[vForm,setVForm]=useState(null);
  const[msg,setMsg]=useState(null);const[busy,setBusy]=useState(false);
  const note=(ok,t)=>setMsg({ok,t});

  const load=async()=>{
    setLoading(true);
    let uq=supabase.from("housing_units").select("*").eq("active",true);
    if(opId&&opId!=="all")uq=uq.eq("operator_id",opId);
    const[u,o,p,v]=await Promise.all([
      uq,
      supabase.from("housing_occupants").select("*").eq("active",true),
      supabase.from("housing_payments").select("*").order("seq"),
      supabase.from("housing_violations").select("*").eq("active",true).order("incident_date",{ascending:false}),
    ]);
    setUnits(u.data||[]);setOcc(o.data||[]);setPays(p.data||[]);setVios(v.data||[]);setLoading(false);
  };
  useEffect(()=>{load();/*eslint-disable-next-line*/},[opId]);

  const k=useMemo(()=>{
    const due=pays.filter(p=>!p.paid);
    const next=due.slice().sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date)))[0];
    return{
      units:units.length, occ:occ.length,
      paidSum:pays.filter(p=>p.paid).reduce((s,p)=>s+Number(p.amount||0),0),
      dueSum:due.reduce((s,p)=>s+Number(p.amount||0),0),
      next, openVio:vios.filter(v=>v.status!=="closed").length,
    };
  },[units,occ,pays,vios]);

  const unitName=id=>units.find(u=>u.id===id)?.name||"—";
  const savRow=async(table,row,form,close)=>{
    setBusy(true);
    try{
      if(form.id)await supabase.from(table).update(row).eq("id",form.id);
      else await supabase.from(table).insert(row);
      close();note(true,"تم الحفظ");await load();
    }catch(e){note(false,"خطأ: "+(e.message||e));}
    setBusy(false);
  };
  const delRow=async(table,id,hard)=>{if(!confirm("تأكيد الحذف؟"))return;if(hard)await supabase.from(table).delete().eq("id",id);else await supabase.from(table).update({active:false}).eq("id",id);await load();};
  const togglePaid=async(p)=>{await supabase.from("housing_payments").update({paid:!p.paid,paid_date:!p.paid?new Date().toISOString().slice(0,10):null}).eq("id",p.id);await load();};

  if(loading)return <div className="dw-skel" style={{height:260}}/>;

  const uid=units[0]?.id;
  return(<div className="hs">
    <style>{CSS}</style>
    {msg&&msg.t&&<div className={"hs-toast"+(msg.ok?" ok":" err")} onClick={()=>setMsg(null)}>{msg.t}</div>}

    <div className="hs-kpis">
      <Kpi ic="home" c="#0f172a" l="الوحدات السكنية" n={k.units}/>
      <Kpi ic="employees" c="#1d5bbf" l="الساكنون" n={k.occ}/>
      <Kpi ic="cash" c="#c2410c" l="الدفعة القادمة" n={k.next?money(k.next.amount):"—"} d={k.next?fmtD(k.next.due_date):"مكتمل"}/>
      <Kpi ic="check" c="#087443" l="مسدَّد" n={money(k.paidSum)}/>
      <Kpi ic="clock" c="#b54708" l="مستحقّ متبقٍّ" n={money(k.dueSum)}/>
      <Kpi ic="alert" c={k.openVio?"#b42318":"#087443"} l="مخالفات مفتوحة" n={k.openVio}/>
    </div>

    <div className="hs-tabs">
      <button className={tab==="units"?"on":""} onClick={()=>setTab("units")}><Icon n="home" s={16}/> الوحدات <span>{units.length}</span></button>
      <button className={tab==="occ"?"on":""} onClick={()=>setTab("occ")}><Icon n="employees" s={16}/> الساكنون <span>{occ.length}</span></button>
      <button className={tab==="pays"?"on":""} onClick={()=>setTab("pays")}><Icon n="cash" s={16}/> الدفعات <span>{pays.length}</span></button>
      <button className={tab==="vio"?"on":""} onClick={()=>setTab("vio")}><Icon n="alert" s={16}/> المخالفات</button>
    </div>

    {tab==="units"&&<div className="hs-panel">
      <div className="hs-ph"><b>الوحدات السكنية</b><button className="hs-add" onClick={()=>setUForm({status:"active",rooms:3,kitchens:1,capacity:4,beds:4})}><Icon n="plus" s={15}/> إضافة وحدة</button></div>
      <div className="hs-grid">
        {units.map(u=>{const dl=daysLeft(u.end_date);return(
          <div key={u.id} className="hs-card">
            <div className="hs-crow"><div className="hs-utitle"><Icon n="home" s={18}/><div><b>{u.name}</b><small>{u.unit_no} · {u.unit_type}</small></div></div><span className="hs-badge ok">نشط</span></div>
            <div className="hs-facts">
              {u.national_address&&<span><Icon n="pin" s={12}/> {u.national_address}</span>}
              <span><Icon n="ruler" s={12}/> {u.area_m2}م² · {u.rooms} غرف · مطبخ {u.kitchens}</span>
              <span><Icon n="vendors" s={12}/> {u.provider}</span>
              {u.deed_no&&<span><Icon n="doc" s={12}/> صك {u.deed_no}</span>}
              <span><Icon n="employees" s={12}/> {occ.filter(o=>o.unit_id===u.id).length}/{u.capacity} ساكن · {u.beds} سرير</span>
              <span><Icon n="cash" s={12}/> {money(u.annual_rent)}/سنة · وديعة {money(u.deposit)}</span>
              <span><Icon n="calendar" s={12}/> {fmtD(u.start_date)} → {fmtD(u.end_date)} {dl!=null&&<em className={"hs-dl"+(dl<=30?" w":"")}>({dl} يوم)</em>}</span>
            </div>
            {u.notes&&<p className="hs-note">{u.notes}</p>}
            <div className="hs-act"><button onClick={()=>setUForm({...u})}><Icon n="edit" s={14}/> تعديل</button><button className="d" onClick={()=>delRow("housing_units",u.id,false)}><Icon n="trash" s={14}/></button></div>
          </div>);})}
        {!units.length&&<Empty t="لا وحدات سكنية بعد."/>}
      </div>
    </div>}

    {tab==="occ"&&<div className="hs-panel">
      <div className="hs-ph"><b>الساكنون <span className="hs-hint">تُزوَّد بها شركة منزل (أسماء/جوالات/هويات)</span></b><button className="hs-add" onClick={()=>setOForm({unit_id:uid,move_in:new Date().toISOString().slice(0,10)})}><Icon n="plus" s={15}/> إضافة ساكن</button></div>
      <table className="hs-tbl">
        <thead><tr><th>الاسم</th><th>الجوال</th><th>الهوية/الإقامة</th><th>الصفة</th><th>الوحدة</th><th>الدخول</th><th></th></tr></thead>
        <tbody>
          {occ.map(o=>(<tr key={o.id}>
            <td><b>{o.name}</b></td><td>{o.mobile||"—"}</td><td>{o.national_id||<span className="hs-miss">مطلوب</span>}</td><td>{o.role||"—"}</td>
            <td>{unitName(o.unit_id)}</td><td>{fmtD(o.move_in)}</td>
            <td className="hs-tact"><button onClick={()=>setOForm({...o})}><Icon n="edit" s={13}/></button><button className="d" onClick={()=>delRow("housing_occupants",o.id,false)}><Icon n="trash" s={13}/></button></td>
          </tr>))}
          {!occ.length&&<tr><td colSpan={7} className="hs-empt">لا ساكنون مسجّلون</td></tr>}
        </tbody>
      </table>
    </div>}

    {tab==="pays"&&<div className="hs-panel">
      <div className="hs-ph"><b>جدول دفعات الإيجار/الخدمة</b><button className="hs-add" onClick={()=>setPForm({unit_id:uid,amount:5110,paid:false})}><Icon n="plus" s={15}/> إضافة دفعة</button></div>
      <table className="hs-tbl">
        <thead><tr><th>#</th><th>تاريخ الاستحقاق</th><th>المبلغ</th><th>الحالة</th><th>تاريخ السداد</th><th></th></tr></thead>
        <tbody>
          {pays.map(p=>{const b=payBand(p);return(<tr key={p.id}>
            <td><b>{p.seq||"—"}</b></td><td>{fmtD(p.due_date)}</td><td><b>{money(p.amount)}</b></td>
            <td><span className="hs-badge" style={{color:b.c,background:b.bg}}>{b.ar}</span></td>
            <td>{p.paid?fmtD(p.paid_date):"—"}</td>
            <td className="hs-tact">
              <button className={p.paid?"":"ok"} onClick={()=>togglePaid(p)} title={p.paid?"إلغاء السداد":"تحديد كمسدّدة"}><Icon n={p.paid?"refresh":"check"} s={13}/></button>
              <button onClick={()=>setPForm({...p})}><Icon n="edit" s={13}/></button>
              <button className="d" onClick={()=>delRow("housing_payments",p.id,true)}><Icon n="trash" s={13}/></button>
            </td>
          </tr>);})}
          {!pays.length&&<tr><td colSpan={6} className="hs-empt">لا دفعات</td></tr>}
        </tbody>
        {pays.length>0&&<tfoot><tr><td colSpan={2}>الإجمالي</td><td colSpan={4}><b>{money(pays.reduce((s,p)=>s+Number(p.amount||0),0))}</b> · مسدَّد {money(k.paidSum)} · متبقٍّ {money(k.dueSum)}</td></tr></tfoot>}
      </table>
      <div className="hs-recs">مهلة السداد 15 يوماً بعد كل استحقاق قبل حق المؤجر بالفسخ (لأن الدورة أقل من 180 يوماً).</div>
    </div>}

    {tab==="vio"&&<div className="hs-panel">
      <div className="hs-ph"><b>مخالفات السكن</b><button className="hs-add" onClick={()=>setVForm({unit_id:uid,occurrence:1,status:"open",incident_date:new Date().toISOString().slice(0,10)})}><Icon n="plus" s={15}/> تسجيل مخالفة</button></div>
      {vios.length>0&&<div className="hs-violog">
        {vios.map(v=>(<div key={v.id} className="hs-vrow">
          <span className="hs-vico"><Icon n="alert" s={16}/></span>
          <div style={{flex:1,minWidth:0}}>
            <div className="hs-vh"><b>{v.category}</b><span className="hs-badge" style={{color:v.status==="closed"?"#087443":"#b42318",background:v.status==="closed"?"#e7f7ef":"#feecea"}}>{v.status==="closed"?"مغلقة":"مفتوحة"}</span></div>
            <div className="hs-vmeta">{v.occupant&&<span><Icon n="employees" s={11}/> {v.occupant}</span>}<span>المرة {v.occurrence}</span>{v.amount!=null&&<span>{money(v.amount)}</span>}{v.incident_date&&<span>{fmtD(v.incident_date)}</span>}{v.action&&<span>{v.action}</span>}</div>
            {v.notes&&<p className="hs-note">{v.notes}</p>}
          </div>
          <div className="hs-tact"><button onClick={()=>setVForm({...v})}><Icon n="edit" s={13}/></button><button className="d" onClick={()=>delRow("housing_violations",v.id,false)}><Icon n="trash" s={13}/></button></div>
        </div>))}
      </div>}

      <div className="hs-poltitle">اللائحة المعتمدة (اتفاقية منزل)</div>
      <table className="hs-tbl hs-pol">
        <thead><tr><th>المخالفة</th><th>المرة 1</th><th>المرة 2</th><th>المرة 3</th><th>المرة 4</th></tr></thead>
        <tbody>{HOUSING_VIOLATIONS.map(r=>(<tr key={r.cat}><td><b>{r.cat}</b></td>{r.steps.map((s,i)=><td key={i} className={s.includes("إخلاء")?"hs-evict":""}>{s}</td>)}</tr>))}</tbody>
      </table>
      <div className="hs-red"><Icon n="alert" s={14}/> خطوط حمراء — إخلاء فوري من المرة الأولى بلا إنذار: {HOUSING_REDLINES.join(" · ")}</div>
    </div>}

    {uForm&&<UnitModal f={uForm} set={setUForm} busy={busy} save={()=>{const r={operator_id:(opId&&opId!=="all")?opId:null,name:uForm.name,national_address:uForm.national_address||null,unit_no:uForm.unit_no||null,unit_type:uForm.unit_type||null,floor:uForm.floor||null,area_m2:num(uForm.area_m2),rooms:num(uForm.rooms),kitchens:num(uForm.kitchens),deed_no:uForm.deed_no||null,provider:uForm.provider||null,provider_cr:uForm.provider_cr||null,contact_name:uForm.contact_name||null,contact_phone:uForm.contact_phone||null,lease_ref:uForm.lease_ref||null,start_date:uForm.start_date||null,end_date:uForm.end_date||null,annual_rent:num(uForm.annual_rent),deposit:num(uForm.deposit),per_person_day:num(uForm.per_person_day),capacity:num(uForm.capacity),beds:num(uForm.beds),status:uForm.status||"active",notes:uForm.notes||null};if(!r.name){note(false,"أدخل اسم الوحدة");return;}savRow("housing_units",r,uForm,()=>setUForm(null));}}/>}
    {oForm&&<OccModal f={oForm} set={setOForm} busy={busy} units={units} save={()=>{const r={unit_id:oForm.unit_id||null,name:(oForm.name||"").trim(),mobile:oForm.mobile||null,national_id:oForm.national_id||null,role:oForm.role||null,move_in:oForm.move_in||null,active:oForm.active!==false};if(!r.name){note(false,"أدخل اسم الساكن");return;}savRow("housing_occupants",r,oForm,()=>setOForm(null));}}/>}
    {pForm&&<PayModal f={pForm} set={setPForm} busy={busy} save={()=>{const r={unit_id:pForm.unit_id||null,operator_id:(opId&&opId!=="all")?opId:null,seq:num(pForm.seq),due_date:pForm.due_date||null,amount:num(pForm.amount),paid:!!pForm.paid,paid_date:pForm.paid?(pForm.paid_date||new Date().toISOString().slice(0,10)):null,method:pForm.method||null,ref:pForm.ref||null};savRow("housing_payments",r,pForm,()=>setPForm(null));}}/>}
    {vForm&&<VioModal f={vForm} set={setVForm} busy={busy} units={units} save={()=>{const r={unit_id:vForm.unit_id||null,occupant:vForm.occupant||null,category:vForm.category||null,occurrence:num(vForm.occurrence),amount:vForm.amount===""||vForm.amount==null?null:num(vForm.amount),action:vForm.action||null,incident_date:vForm.incident_date||null,status:vForm.status||"open",notes:vForm.notes||null,active:true};if(!r.category){note(false,"اختر نوع المخالفة");return;}savRow("housing_violations",r,vForm,()=>setVForm(null));}}/>}
  </div>);
}
const num=v=>v===""||v==null?null:Number(v);

function Kpi({ic,c,l,n,d}){return(<div className="hs-kpi"><div className="hs-kh"><span className="hs-kl">{l}</span><span className="hs-ki" style={{color:c,background:c+"18"}}><Icon n={ic} s={16}/></span></div><div className="hs-kn">{n}</div>{d?<div className="hs-kd" style={{color:c}}>{d}</div>:null}</div>);}
function Empty({t}){return<div className="hs-empty"><Icon n="home" s={30}/><p>{t}</p></div>;}
function Fld({l,children}){return(<label className="hs-fld"><span>{l}</span>{children}</label>);}
function Modal({title,set,busy,save,children}){return(<div className="hs-scrim" onClick={()=>set(null)}><div className="hs-modal" onClick={e=>e.stopPropagation()}><div className="hs-mh"><b>{title}</b><button onClick={()=>set(null)}><Icon n="x" s={18}/></button></div><div className="hs-mb">{children}</div><div className="hs-mf"><button className="g" onClick={()=>set(null)}>إلغاء</button><button className="p" disabled={busy} onClick={save}>{busy?"...":"حفظ"}</button></div></div></div>);}

function UnitModal({f,set,busy,save}){const u=(k,v)=>set({...f,[k]:v});return(<Modal title={f.id?"تعديل وحدة":"إضافة وحدة"} set={set} busy={busy} save={save}>
  <Fld l="اسم الوحدة *"><input value={f.name||""} onChange={e=>u("name",e.target.value)} placeholder="سكن الفريق — F1-1-49"/></Fld>
  <Fld l="العنوان الوطني"><input value={f.national_address||""} onChange={e=>u("national_address",e.target.value)}/></Fld>
  <div className="hs-2"><Fld l="رقم الوحدة"><input value={f.unit_no||""} onChange={e=>u("unit_no",e.target.value)}/></Fld><Fld l="النوع/الطابق"><input value={f.unit_type||""} onChange={e=>u("unit_type",e.target.value)}/></Fld></div>
  <div className="hs-2"><Fld l="المساحة م²"><input type="number" value={f.area_m2||""} onChange={e=>u("area_m2",e.target.value)}/></Fld><Fld l="الغرف"><input type="number" value={f.rooms||""} onChange={e=>u("rooms",e.target.value)}/></Fld></div>
  <div className="hs-2"><Fld l="رقم الصك"><input value={f.deed_no||""} onChange={e=>u("deed_no",e.target.value)}/></Fld><Fld l="المزوّد"><input value={f.provider||""} onChange={e=>u("provider",e.target.value)}/></Fld></div>
  <div className="hs-2"><Fld l="السعة (أشخاص)"><input type="number" value={f.capacity||""} onChange={e=>u("capacity",e.target.value)}/></Fld><Fld l="الأسرّة"><input type="number" value={f.beds||""} onChange={e=>u("beds",e.target.value)}/></Fld></div>
  <div className="hs-2"><Fld l="تاريخ البداية"><input type="date" value={f.start_date||""} onChange={e=>u("start_date",e.target.value)}/></Fld><Fld l="تاريخ النهاية"><input type="date" value={f.end_date||""} onChange={e=>u("end_date",e.target.value)}/></Fld></div>
  <div className="hs-2"><Fld l="الإيجار السنوي"><input type="number" value={f.annual_rent||""} onChange={e=>u("annual_rent",e.target.value)}/></Fld><Fld l="الوديعة"><input type="number" value={f.deposit||""} onChange={e=>u("deposit",e.target.value)}/></Fld></div>
  <Fld l="ملاحظات"><textarea rows={2} value={f.notes||""} onChange={e=>u("notes",e.target.value)}/></Fld>
</Modal>);}

function OccModal({f,set,busy,save,units}){const u=(k,v)=>set({...f,[k]:v});return(<Modal title={f.id?"تعديل ساكن":"إضافة ساكن"} set={set} busy={busy} save={save}>
  <Fld l="الاسم *"><input value={f.name||""} onChange={e=>u("name",e.target.value)}/></Fld>
  <div className="hs-2"><Fld l="الجوال"><input value={f.mobile||""} onChange={e=>u("mobile",e.target.value)}/></Fld><Fld l="الهوية/الإقامة"><input value={f.national_id||""} onChange={e=>u("national_id",e.target.value)}/></Fld></div>
  <div className="hs-2"><Fld l="الصفة"><input value={f.role||""} onChange={e=>u("role",e.target.value)} placeholder="بايكر"/></Fld><Fld l="الوحدة"><select value={f.unit_id||""} onChange={e=>u("unit_id",e.target.value)}><option value="">—</option>{units.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Fld></div>
  <Fld l="تاريخ الدخول"><input type="date" value={f.move_in||""} onChange={e=>u("move_in",e.target.value)}/></Fld>
</Modal>);}

function PayModal({f,set,busy,save}){const u=(k,v)=>set({...f,[k]:v});return(<Modal title={f.id?"تعديل دفعة":"إضافة دفعة"} set={set} busy={busy} save={save}>
  <div className="hs-2"><Fld l="رقم الدفعة"><input type="number" value={f.seq||""} onChange={e=>u("seq",e.target.value)}/></Fld><Fld l="المبلغ"><input type="number" value={f.amount||""} onChange={e=>u("amount",e.target.value)}/></Fld></div>
  <Fld l="تاريخ الاستحقاق"><input type="date" value={f.due_date||""} onChange={e=>u("due_date",e.target.value)}/></Fld>
  <label className="hs-chk"><input type="checkbox" checked={!!f.paid} onChange={e=>u("paid",e.target.checked)}/> مسدّدة</label>
  {f.paid&&<Fld l="تاريخ السداد"><input type="date" value={f.paid_date||""} onChange={e=>u("paid_date",e.target.value)}/></Fld>}
</Modal>);}

function VioModal({f,set,busy,save,units}){const u=(k,v)=>set({...f,[k]:v});return(<Modal title={f.id?"تعديل مخالفة":"تسجيل مخالفة"} set={set} busy={busy} save={save}>
  <Fld l="نوع المخالفة *"><select value={f.category||""} onChange={e=>u("category",e.target.value)}><option value="">— اختر —</option>{HOUSING_VIOLATIONS.map(v=><option key={v.cat}>{v.cat}</option>)}</select></Fld>
  <div className="hs-2"><Fld l="الساكن"><input value={f.occupant||""} onChange={e=>u("occupant",e.target.value)}/></Fld><Fld l="رقم المرة"><select value={f.occurrence||1} onChange={e=>{const o=Number(e.target.value);const fine=suggestFine(o);u("occurrence",o);set(s=>({...s,occurrence:o,amount:fine==null?"":fine}));}}>{[1,2,3,4].map(n=><option key={n} value={n}>المرة {n}</option>)}</select></Fld></div>
  <div className="hs-2"><Fld l="الغرامة (﷼)"><input type="number" value={f.amount??""} onChange={e=>u("amount",e.target.value)} placeholder="إخلاء = فارغ"/></Fld><Fld l="الإجراء"><input value={f.action||""} onChange={e=>u("action",e.target.value)} placeholder="إنذار / غرامة / إخلاء"/></Fld></div>
  <div className="hs-2"><Fld l="التاريخ"><input type="date" value={f.incident_date||""} onChange={e=>u("incident_date",e.target.value)}/></Fld><Fld l="الحالة"><select value={f.status||"open"} onChange={e=>u("status",e.target.value)}><option value="open">مفتوحة</option><option value="closed">مغلقة</option></select></Fld></div>
  <Fld l="ملاحظات"><textarea rows={2} value={f.notes||""} onChange={e=>u("notes",e.target.value)}/></Fld>
</Modal>);}

const CSS=`
.hs{--brand:#E8712B;--ink:#0f172a;--mut:#64748b;--line:#eceef1;--bg:#f4f5f7}
.hs *{box-sizing:border-box}
.hs-toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:80;padding:11px 18px;border-radius:12px;font-weight:700;font-size:13px;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer}
.hs-toast.ok{background:#087443}.hs-toast.err{background:#b42318}
.hs-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
.hs-kpi{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 15px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.hs-kh{display:flex;align-items:center;justify-content:space-between;gap:6px}
.hs-kl{font-size:11.5px;color:var(--mut);font-weight:600;line-height:1.3}
.hs-ki{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:none}
.hs-kn{font-size:22px;font-weight:800;margin-top:8px;letter-spacing:-.5px}
.hs-kd{font-size:11px;font-weight:700;margin-top:1px}
.hs-tabs{display:flex;gap:8px;margin:16px 0 14px;flex-wrap:wrap}
.hs-tabs button{display:flex;align-items:center;gap:7px;padding:9px 15px;border-radius:11px;border:1px solid var(--line);background:#fff;font-family:inherit;font-size:13.5px;font-weight:700;color:var(--mut);cursor:pointer}
.hs-tabs button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.hs-tabs button span{background:rgba(120,130,150,.16);padding:1px 8px;border-radius:20px;font-size:11px}
.hs-tabs button.on span{background:rgba(255,255,255,.2)}
.hs-panel{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 1px 2px rgba(16,24,40,.05);overflow:hidden}
.hs-ph{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 18px;border-bottom:1px solid var(--line)}
.hs-ph b{font-size:14.5px;font-weight:800}
.hs-hint{font-size:11px;color:var(--mut);font-weight:500;margin-inline-start:6px}
.hs-add{display:flex;align-items:center;gap:6px;background:var(--brand);color:#fff;border:none;padding:8px 13px;border-radius:10px;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;flex:none}
.hs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:13px;padding:16px 18px}
.hs-card{border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px}
.hs-crow{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.hs-utitle{display:flex;align-items:center;gap:9px;color:var(--brand)}
.hs-utitle b{font-size:14.5px;font-weight:800;color:var(--ink);display:block}.hs-utitle small{font-size:11px;color:var(--mut);display:block}
.hs-badge{font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;white-space:nowrap}
.hs-badge.ok{color:#087443;background:#e7f7ef}
.hs-facts{display:flex;flex-direction:column;gap:5px}
.hs-facts span{display:flex;align-items:center;gap:6px;font-size:12px;color:#475569;font-weight:600}
.hs-dl{font-style:normal;color:#087443;font-weight:700}.hs-dl.w{color:#c2410c}
.hs-note{font-size:11.5px;color:var(--mut);line-height:1.6;margin:0;background:var(--bg);padding:8px 10px;border-radius:9px}
.hs-act{display:flex;gap:7px}
.hs-act button{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:7px;border-radius:9px;border:1px solid var(--line);background:#fff;font-family:inherit;font-size:12px;font-weight:700;color:var(--ink);cursor:pointer}
.hs-act button.d{flex:0 0 40px;color:#b42318}
.hs-tbl{width:100%;border-collapse:collapse}
.hs-tbl th{font-size:11px;color:var(--mut);font-weight:700;text-align:right;padding:11px 16px;border-bottom:1px solid var(--line);background:#fafbfc}
.hs-tbl td{padding:11px 16px;border-bottom:1px solid var(--line);font-size:12.5px}
.hs-tbl tfoot td{background:#fafbfc;font-size:12px;color:var(--mut)}
.hs-tbl tr:last-child td{border-bottom:none}
.hs-miss,.hs-empt{color:#b42318}.hs-empt{text-align:center;color:#94a3b8;padding:20px}
.hs-tact{display:flex;gap:5px;justify-content:flex-end}
.hs-tact button{border:1px solid var(--line);background:#fff;width:28px;height:28px;border-radius:8px;cursor:pointer;color:var(--mut);display:flex;align-items:center;justify-content:center}
.hs-tact button.ok{color:#087443;background:#e7f7ef;border-color:#bbe8cf}
.hs-tact button.d{color:#b42318}
.hs-recs{font-size:11.5px;color:#475569;padding:12px 16px;background:#fff8f3;border-top:1px solid var(--line)}
.hs-violog{display:flex;flex-direction:column;padding:6px 0;border-bottom:1px solid var(--line)}
.hs-vrow{display:flex;gap:11px;padding:12px 18px}
.hs-vico{width:34px;height:34px;border-radius:10px;background:#feecea;color:#b42318;display:flex;align-items:center;justify-content:center;flex:none}
.hs-vh{display:flex;align-items:center;gap:9px}.hs-vh b{font-size:13.5px;font-weight:800}
.hs-vmeta{display:flex;flex-wrap:wrap;gap:5px 12px;margin-top:5px;font-size:11.5px;color:var(--mut);font-weight:600}
.hs-vmeta span{display:flex;align-items:center;gap:4px}
.hs-poltitle{font-size:12.5px;font-weight:800;padding:14px 18px 4px}
.hs-pol td.hs-evict{color:#b42318;font-weight:700}
.hs-red{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:#b42318;background:#feecea;margin:12px 18px 16px;padding:11px 13px;border-radius:11px}
.hs-empty{text-align:center;padding:40px;color:#cbd5e1}.hs-empty p{color:#94a3b8;font-size:13px;margin-top:8px}
.hs-scrim{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:70;display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow:auto}
.hs-modal{background:#fff;border-radius:16px;width:100%;max-width:540px;box-shadow:0 20px 60px rgba(0,0,0,.3);margin:auto}
.hs-mh{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--line)}
.hs-mh b{font-size:15px;font-weight:800}.hs-mh button{background:none;border:none;cursor:pointer;color:var(--mut);display:flex}
.hs-mb{padding:16px 18px;display:flex;flex-direction:column;gap:11px}
.hs-2{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.hs-fld{display:flex;flex-direction:column;gap:5px}
.hs-fld>span{font-size:12px;font-weight:700}
.hs-fld input,.hs-fld select,.hs-fld textarea{border:1px solid #dfe3e8;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:13px;outline:none;background:#fff;width:100%}
.hs-fld input:focus,.hs-fld select:focus,.hs-fld textarea:focus{border-color:var(--brand)}
.hs-chk{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer}
.hs-mf{display:flex;gap:10px;justify-content:flex-end;padding:14px 18px;border-top:1px solid var(--line)}
.hs-mf button{padding:9px 20px;border-radius:10px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;border:1px solid var(--line)}
.hs-mf button.g{background:#fff;color:var(--mut)}.hs-mf button.p{background:var(--brand);color:#fff;border-color:var(--brand)}.hs-mf button.p:disabled{opacity:.6}
@media(max-width:900px){.hs-kpis{grid-template-columns:1fr 1fr 1fr}.hs-2{grid-template-columns:1fr}}
`;
