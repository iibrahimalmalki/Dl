import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";

const V_STATUS={
  active:{ar:"تعمل",c:"#087443",bg:"#e7f7ef"},
  stolen:{ar:"مسروقة",c:"#b42318",bg:"#feecea"},
  maintenance:{ar:"صيانة",c:"#b54708",bg:"#fef3e2"},
  spare:{ar:"احتياطية/بديلة",c:"#1d5bbf",bg:"#eef4ff"},
  retired:{ar:"مسحوبة",c:"#64748b",bg:"#f1f5f9"},
};
const V_ORDER=["stolen","maintenance","active","spare","retired"];
const INCIDENT_TYPES=["سرقة","تخريب","عطل","حادث مروري","فقدان جهاز","أخرى"];
const IT_ICON={"سرقة":"alert","تخريب":"alert","عطل":"wrench","حادث مروري":"alert","فقدان جهاز":"pin","أخرى":"doc"};
const INC_STATUS={
  open:{ar:"مفتوحة",c:"#b42318",bg:"#feecea"},
  investigating:{ar:"قيد التحقيق",c:"#b54708",bg:"#fef3e2"},
  resolved:{ar:"مُعالجة",c:"#1d5bbf",bg:"#eef4ff"},
  closed:{ar:"مغلقة",c:"#087443",bg:"#e7f7ef"},
};
const SEV={low:{ar:"منخفضة",c:"#64748b"},med:{ar:"متوسطة",c:"#b54708"},high:{ar:"عالية",c:"#c2410c"},critical:{ar:"حرجة",c:"#b42318"}};
// حالات المفتاح التي تُعد فجوة تتطلب معالجة
const KEY_BAD=s=>!s||/مفقود|لا يوجد|بحوزة|غير محدد|غير متاح/.test(s);
const fmtD=d=>d?new Date(d+"T00:00:00").toLocaleDateString("en-GB"):"—";

export default function Fleet({opId,owner}){
  const[tab,setTab]=useState("veh");
  const[loading,setLoading]=useState(true);
  const[veh,setVeh]=useState([]);const[inc,setInc]=useState([]);
  const[vForm,setVForm]=useState(null);const[iForm,setIForm]=useState(null);
  const[msg,setMsg]=useState(null);const[busy,setBusy]=useState(false);
  const note=(ok,t)=>setMsg({ok,t});

  const load=async()=>{
    setLoading(true);
    let vq=supabase.from("fleet_vehicles").select("*").eq("active",true);
    let iq=supabase.from("fleet_incidents").select("*").eq("active",true);
    if(opId&&opId!=="all"){vq=vq.eq("operator_id",opId);iq=iq.eq("operator_id",opId);}
    const[v,i]=await Promise.all([vq,iq]);
    const vr=(v.data||[]).slice().sort((a,b)=>V_ORDER.indexOf(a.status)-V_ORDER.indexOf(b.status)||(a.plate||"").localeCompare(b.plate||""));
    const ir=(i.data||[]).slice().sort((a,b)=>String(b.occurred_on||"").localeCompare(String(a.occurred_on||"")));
    setVeh(vr);setInc(ir);setLoading(false);
  };
  useEffect(()=>{load();/*eslint-disable-next-line*/},[opId]);

  const k=useMemo(()=>{
    const n=veh.length;
    return{
      total:n,
      active:veh.filter(v=>v.status==="active").length,
      stolen:veh.filter(v=>v.status==="stolen").length,
      maint:veh.filter(v=>v.status==="maintenance").length,
      spare:veh.filter(v=>v.status==="spare").length,
      gps:n?Math.round(veh.filter(v=>v.has_gps).length/n*100):0,
      cam:n?Math.round(veh.filter(v=>v.has_camera).length/n*100):0,
      openInc:inc.filter(x=>x.status==="open"||x.status==="investigating").length,
      keyGaps:veh.filter(v=>KEY_BAD(v.key_status)).length,
    };
  },[veh,inc]);

  const saveV=async()=>{
    if(!vForm.plate||!vForm.plate.trim()){note(false,"أدخل رقم اللوحة");return;}
    setBusy(true);
    const row={operator_id:(opId&&opId!=="all")?opId:null,plate:vForm.plate.trim(),plate_en:vForm.plate_en||null,make:vForm.make||null,
      model_year:vForm.model_year?Number(vForm.model_year):null,vin:vForm.vin||null,serial_no:vForm.serial_no||null,
      has_gps:!!vForm.has_gps,has_camera:!!vForm.has_camera,key_status:vForm.key_status||null,key_holder:vForm.key_holder||null,
      current_biker:vForm.current_biker||null,status:vForm.status||"active",notes:vForm.notes||null,active:vForm.active!==false};
    try{
      if(vForm.id)await supabase.from("fleet_vehicles").update(row).eq("id",vForm.id);
      else await supabase.from("fleet_vehicles").insert(row);
      setVForm(null);note(true,"تم الحفظ");await load();
    }catch(e){note(false,"خطأ: "+(e.message||e));}
    setBusy(false);
  };
  const saveI=async()=>{
    if(!iForm.incident_type){note(false,"اختر نوع الحادثة");return;}
    setBusy(true);
    const vlabel=iForm.vehicle_id?(veh.find(v=>v.id===iForm.vehicle_id)?.plate||iForm.vehicle_label):iForm.vehicle_label;
    const row={operator_id:(opId&&opId!=="all")?opId:null,vehicle_id:iForm.vehicle_id||null,vehicle_label:vlabel||null,
      incident_type:iForm.incident_type,title:iForm.title||null,biker:iForm.biker||null,occurred_on:iForm.occurred_on||null,
      reported_on:iForm.reported_on||null,police_report_no:iForm.police_report_no||null,case_no:iForm.case_no||null,
      emergency_refs:iForm.emergency_refs||null,responsibility:iForm.responsibility||null,corrective_actions:iForm.corrective_actions||null,
      severity:iForm.severity||"high",status:iForm.status||"open",notes:iForm.notes||null,active:iForm.active!==false};
    try{
      if(iForm.id)await supabase.from("fleet_incidents").update(row).eq("id",iForm.id);
      else await supabase.from("fleet_incidents").insert(row);
      setIForm(null);note(true,"تم الحفظ");await load();
    }catch(e){note(false,"خطأ: "+(e.message||e));}
    setBusy(false);
  };
  const delV=async(v)=>{if(!confirm("حذف مركبة «"+v.plate+"»؟"))return;await supabase.from("fleet_vehicles").delete().eq("id",v.id);await load();};
  const delI=async(x)=>{if(!confirm("حذف الحادثة؟"))return;await supabase.from("fleet_incidents").delete().eq("id",x.id);await load();};

  if(loading)return <div className="dw-skel" style={{height:260}}/>;

  return(<div className="fl">
    <style>{CSS}</style>
    {msg&&msg.t&&<div className={"fl-toast"+(msg.ok?" ok":" err")} onClick={()=>setMsg(null)}>{msg.t}</div>}

    <div className="fl-kpis">
      <Kpi ic="bike" c="#0f172a" l="إجمالي المركبات" n={k.total}/>
      <Kpi ic="check" c="#087443" l="تعمل" n={k.active}/>
      <Kpi ic="alert" c="#b42318" l="مسروقة" n={k.stolen} d={k.stolen?"بلاغات مفتوحة":""}/>
      <Kpi ic="pin" c="#1d5bbf" l="تغطية التتبّع GPS" n={k.gps+"%"}/>
      <Kpi ic="camera" c="#7c3aed" l="تغطية الكاميرات" n={k.cam+"%"}/>
      <Kpi ic="key" c={k.keyGaps?"#c2410c":"#087443"} l="فجوات المفاتيح" n={k.keyGaps}/>
    </div>

    <div className="fl-tabs">
      <button className={tab==="veh"?"on":""} onClick={()=>setTab("veh")}><Icon n="bike" s={16}/> المركبات <span>{veh.length}</span></button>
      <button className={tab==="inc"?"on":""} onClick={()=>setTab("inc")}><Icon n="alert" s={16}/> الحوادث والأعطال <span>{inc.length}</span></button>
      <button className={tab==="key"?"on":""} onClick={()=>setTab("key")}><Icon n="key" s={16}/> المفاتيح</button>
    </div>

    {tab==="veh"&&<div className="fl-panel">
      <div className="fl-ph"><b>سجل المركبات</b><button className="fl-add" onClick={()=>setVForm({status:"active",has_gps:false,has_camera:false})}><Icon n="plus" s={15}/> إضافة مركبة</button></div>
      <div className="fl-grid">
        {veh.map(v=>{const s=V_STATUS[v.status]||V_STATUS.active;return(
          <div key={v.id} className="fl-card">
            <div className="fl-crow">
              <div className="fl-plate"><Icon n="bike" s={18}/><div><b>{v.plate}</b>{v.plate_en&&v.plate_en!=="—"&&<small>{v.plate_en}</small>}</div></div>
              <span className="fl-badge" style={{color:s.c,background:s.bg}}>{s.ar}</span>
            </div>
            <div className="fl-meta">
              {v.current_biker&&<span className="fl-mi"><Icon n="employees" s={13}/> {v.current_biker}</span>}
              {v.make&&<span className="fl-mi"><Icon n="bike" s={13}/> {v.make}{v.model_year?" "+v.model_year:""}</span>}
            </div>
            <div className="fl-tags">
              <span className={"fl-tag"+(v.has_gps?" y":" n")}><Icon n="pin" s={12}/> تتبّع {v.has_gps?"✓":"✕"}</span>
              <span className={"fl-tag"+(v.has_camera?" y":" n")}><Icon n="camera" s={12}/> كاميرا {v.has_camera?"✓":"✕"}</span>
              <span className={"fl-tag"+(KEY_BAD(v.key_status)?" w":" y")}><Icon n="key" s={12}/> {v.key_status||"مفتاح؟"}</span>
            </div>
            {v.notes&&<p className="fl-note">{v.notes}</p>}
            <div className="fl-act">
              <button onClick={()=>setVForm({...v})}><Icon n="edit" s={14}/> تعديل</button>
              <button className="d" onClick={()=>delV(v)}><Icon n="trash" s={14}/></button>
            </div>
          </div>);})}
        {!veh.length&&<Empty t="لا توجد مركبات مسجّلة بعد."/>}
      </div>
    </div>}

    {tab==="inc"&&<div className="fl-panel">
      <div className="fl-ph"><b>سجل الحوادث والأعطال</b><button className="fl-add" onClick={()=>setIForm({incident_type:"عطل",severity:"high",status:"open"})}><Icon n="plus" s={15}/> تسجيل حادثة</button></div>
      <div className="fl-inc">
        {inc.map(x=>{const st=INC_STATUS[x.status]||INC_STATUS.open;const sv=SEV[x.severity]||SEV.high;return(
          <div key={x.id} className="fl-icard">
            <div className="fl-ic-l"><span className="fl-ic-ico" style={{color:sv.c}}><Icon n={IT_ICON[x.incident_type]||"alert"} s={18}/></span></div>
            <div className="fl-ic-b">
              <div className="fl-ic-h">
                <b>{x.title||x.incident_type}</b>
                <span className="fl-badge" style={{color:st.c,background:st.bg}}>{st.ar}</span>
              </div>
              <div className="fl-ic-tags">
                <span className="fl-chip">{x.incident_type}</span>
                {x.vehicle_label&&<span className="fl-chip"><Icon n="bike" s={11}/> {x.vehicle_label}</span>}
                {x.biker&&<span className="fl-chip"><Icon n="employees" s={11}/> {x.biker}</span>}
                <span className="fl-chip" style={{color:sv.c}}>خطورة: {sv.ar}</span>
                {x.occurred_on&&<span className="fl-chip"><Icon n="calendar" s={11}/> {fmtD(x.occurred_on)}</span>}
              </div>
              {(x.police_report_no||x.case_no||x.emergency_refs)&&<div className="fl-refs">
                {x.police_report_no&&<span>بلاغ: <b>{x.police_report_no}</b></span>}
                {x.case_no&&<span>قضية: <b>{x.case_no}</b></span>}
                {x.emergency_refs&&<span>{x.emergency_refs}</span>}
              </div>}
              {x.responsibility&&x.responsibility!=="—"&&<p className="fl-p"><b>المسؤولية:</b> {x.responsibility}</p>}
              {x.corrective_actions&&<p className="fl-p"><b>الإجراءات:</b> {x.corrective_actions}</p>}
              {x.notes&&<p className="fl-note">{x.notes}</p>}
              <div className="fl-act">
                <button onClick={()=>setIForm({...x})}><Icon n="edit" s={14}/> تعديل</button>
                <button className="d" onClick={()=>delI(x)}><Icon n="trash" s={14}/></button>
              </div>
            </div>
          </div>);})}
        {!inc.length&&<Empty t="لا توجد حوادث مسجّلة."/>}
      </div>
    </div>}

    {tab==="key"&&<div className="fl-panel">
      <div className="fl-ph"><b>إدارة مفاتيح السلاسل</b><span className="fl-hint">تُدار حالة المفتاح من بطاقة كل مركبة</span></div>
      <table className="fl-tbl">
        <thead><tr><th>المركبة</th><th>حالة المفتاح</th><th>لدى</th><th>البايكر الحالي</th></tr></thead>
        <tbody>
          {veh.map(v=>{const bad=KEY_BAD(v.key_status);return(
            <tr key={v.id}>
              <td><b>{v.plate}</b></td>
              <td><span className={"fl-kdot"+(bad?" bad":" ok")}/>{v.key_status||"غير محدد"}</td>
              <td>{v.key_holder||"—"}</td>
              <td>{v.current_biker||"—"}</td>
            </tr>);})}
          {!veh.length&&<tr><td colSpan={4} style={{textAlign:"center",color:"#94a3b8",padding:20}}>لا بيانات</td></tr>}
        </tbody>
      </table>
      <div className="fl-recs"><b>توصيات تصحيحية:</b> نقطة مركزية واحدة لحفظ نُسخ المفاتيح مع نسخة احتياطية موثّقة · استرجاع المفاتيح بحوزة أطراف خارجية · دراسة الانتقال لأقفال بالكود لإنهاء مشكلة «المفتاح المفقود» نهائياً.</div>
    </div>}

    {vForm&&<VehModal f={vForm} set={setVForm} save={saveV} busy={busy}/>}
    {iForm&&<IncModal f={iForm} set={setIForm} save={saveI} busy={busy} veh={veh}/>}
  </div>);
}

function Kpi({ic,c,l,n,d}){return(<div className="fl-kpi"><div className="fl-kh"><span className="fl-kl">{l}</span><span className="fl-ki" style={{color:c,background:c+"18"}}><Icon n={ic} s={16}/></span></div><div className="fl-kn">{n}</div>{d?<div className="fl-kd" style={{color:c}}>{d}</div>:null}</div>);}
function Empty({t}){return<div className="fl-empty"><Icon n="bike" s={30}/><p>{t}</p></div>;}
function Fld({l,children}){return(<label className="fl-fld"><span>{l}</span>{children}</label>);}

function VehModal({f,set,save,busy}){
  const u=(k,v)=>set({...f,[k]:v});
  return(<div className="fl-scrim" onClick={()=>set(null)}><div className="fl-modal" onClick={e=>e.stopPropagation()}>
    <div className="fl-mh"><b>{f.id?"تعديل مركبة":"إضافة مركبة"}</b><button onClick={()=>set(null)}><Icon n="x" s={18}/></button></div>
    <div className="fl-mb">
      <div className="fl-2">
        <Fld l="رقم اللوحة *"><input value={f.plate||""} onChange={e=>u("plate",e.target.value)} placeholder="5529 ق ب"/></Fld>
        <Fld l="اللوحة (EN)"><input value={f.plate_en||""} onChange={e=>u("plate_en",e.target.value)} placeholder="5529 BG"/></Fld>
      </div>
      <div className="fl-2">
        <Fld l="النوع"><input value={f.make||""} onChange={e=>u("make",e.target.value)} placeholder="بوكسر"/></Fld>
        <Fld l="سنة الصنع"><input type="number" value={f.model_year||""} onChange={e=>u("model_year",e.target.value)} placeholder="2024"/></Fld>
      </div>
      <div className="fl-2">
        <Fld l="رقم الهيكل VIN"><input value={f.vin||""} onChange={e=>u("vin",e.target.value)}/></Fld>
        <Fld l="الرقم التسلسلي"><input value={f.serial_no||""} onChange={e=>u("serial_no",e.target.value)}/></Fld>
      </div>
      <div className="fl-2">
        <Fld l="الحالة"><select value={f.status||"active"} onChange={e=>u("status",e.target.value)}>{Object.entries(V_STATUS).map(([k,v])=><option key={k} value={k}>{v.ar}</option>)}</select></Fld>
        <Fld l="البايكر الحالي"><input value={f.current_biker||""} onChange={e=>u("current_biker",e.target.value)} placeholder="الاسم (الرقم)"/></Fld>
      </div>
      <div className="fl-2">
        <Fld l="حالة المفتاح"><input value={f.key_status||""} onChange={e=>u("key_status",e.target.value)} placeholder="متوفر / مفقود / لا يوجد"/></Fld>
        <Fld l="المفتاح بحوزة"><input value={f.key_holder||""} onChange={e=>u("key_holder",e.target.value)}/></Fld>
      </div>
      <div className="fl-chk">
        <label><input type="checkbox" checked={!!f.has_gps} onChange={e=>u("has_gps",e.target.checked)}/> جهاز تتبّع GPS</label>
        <label><input type="checkbox" checked={!!f.has_camera} onChange={e=>u("has_camera",e.target.checked)}/> كاميرا مثبّتة</label>
      </div>
      <Fld l="ملاحظات"><textarea value={f.notes||""} onChange={e=>u("notes",e.target.value)} rows={2}/></Fld>
    </div>
    <div className="fl-mf"><button className="g" onClick={()=>set(null)}>إلغاء</button><button className="p" disabled={busy} onClick={save}>{busy?"...":"حفظ"}</button></div>
  </div></div>);
}

function IncModal({f,set,save,busy,veh}){
  const u=(k,v)=>set({...f,[k]:v});
  return(<div className="fl-scrim" onClick={()=>set(null)}><div className="fl-modal" onClick={e=>e.stopPropagation()}>
    <div className="fl-mh"><b>{f.id?"تعديل حادثة":"تسجيل حادثة/عطل"}</b><button onClick={()=>set(null)}><Icon n="x" s={18}/></button></div>
    <div className="fl-mb">
      <div className="fl-2">
        <Fld l="نوع الحادثة *"><select value={f.incident_type||""} onChange={e=>u("incident_type",e.target.value)}>{INCIDENT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></Fld>
        <Fld l="المركبة"><select value={f.vehicle_id||""} onChange={e=>u("vehicle_id",e.target.value)}><option value="">— اختر —</option>{veh.map(v=><option key={v.id} value={v.id}>{v.plate}</option>)}</select></Fld>
      </div>
      <Fld l="العنوان"><input value={f.title||""} onChange={e=>u("title",e.target.value)} placeholder="وصف مختصر"/></Fld>
      <div className="fl-2">
        <Fld l="البايكر"><input value={f.biker||""} onChange={e=>u("biker",e.target.value)}/></Fld>
        <Fld l="الخطورة"><select value={f.severity||"high"} onChange={e=>u("severity",e.target.value)}>{Object.entries(SEV).map(([k,v])=><option key={k} value={k}>{v.ar}</option>)}</select></Fld>
      </div>
      <div className="fl-2">
        <Fld l="تاريخ الحادثة"><input type="date" value={f.occurred_on||""} onChange={e=>u("occurred_on",e.target.value)}/></Fld>
        <Fld l="تاريخ الإبلاغ"><input type="date" value={f.reported_on||""} onChange={e=>u("reported_on",e.target.value)}/></Fld>
      </div>
      <div className="fl-2">
        <Fld l="رقم البلاغ الرسمي"><input value={f.police_report_no||""} onChange={e=>u("police_report_no",e.target.value)}/></Fld>
        <Fld l="رقم القضية"><input value={f.case_no||""} onChange={e=>u("case_no",e.target.value)}/></Fld>
      </div>
      <Fld l="بلاغات الطوارئ (911)"><input value={f.emergency_refs||""} onChange={e=>u("emergency_refs",e.target.value)} placeholder="911: ... / ..."/></Fld>
      <Fld l="توزيع المسؤولية"><textarea value={f.responsibility||""} onChange={e=>u("responsibility",e.target.value)} rows={2}/></Fld>
      <Fld l="الإجراءات التصحيحية"><textarea value={f.corrective_actions||""} onChange={e=>u("corrective_actions",e.target.value)} rows={2}/></Fld>
      <div className="fl-2">
        <Fld l="الحالة"><select value={f.status||"open"} onChange={e=>u("status",e.target.value)}>{Object.entries(INC_STATUS).map(([k,v])=><option key={k} value={k}>{v.ar}</option>)}</select></Fld>
        <div/>
      </div>
      <Fld l="ملاحظات"><textarea value={f.notes||""} onChange={e=>u("notes",e.target.value)} rows={2}/></Fld>
    </div>
    <div className="fl-mf"><button className="g" onClick={()=>set(null)}>إلغاء</button><button className="p" disabled={busy} onClick={save}>{busy?"...":"حفظ"}</button></div>
  </div></div>);
}

const CSS=`
.fl{--brand:#E8712B;--ink:#0f172a;--mut:#64748b;--line:#eceef1;--bg:#f4f5f7;--r:16px}
.fl *{box-sizing:border-box}
.fl-toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:80;padding:11px 18px;border-radius:12px;font-weight:700;font-size:13px;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer}
.fl-toast.ok{background:#087443}.fl-toast.err{background:#b42318}
.fl-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
.fl-kpi{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 15px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.fl-kh{display:flex;align-items:center;justify-content:space-between;gap:6px}
.fl-kl{font-size:11.5px;color:var(--mut);font-weight:600;line-height:1.3}
.fl-ki{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:none}
.fl-kn{font-size:24px;font-weight:800;margin-top:8px;letter-spacing:-.5px}
.fl-kd{font-size:11px;font-weight:700;margin-top:1px}
.fl-tabs{display:flex;gap:8px;margin:16px 0 14px;flex-wrap:wrap}
.fl-tabs button{display:flex;align-items:center;gap:7px;padding:9px 15px;border-radius:11px;border:1px solid var(--line);background:#fff;font-family:inherit;font-size:13.5px;font-weight:700;color:var(--mut);cursor:pointer}
.fl-tabs button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.fl-tabs button span{background:rgba(120,130,150,.16);padding:1px 8px;border-radius:20px;font-size:11px}
.fl-tabs button.on span{background:rgba(255,255,255,.2)}
.fl-panel{background:#fff;border:1px solid var(--line);border-radius:var(--r);box-shadow:0 1px 2px rgba(16,24,40,.05);overflow:hidden}
.fl-ph{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 18px;border-bottom:1px solid var(--line)}
.fl-ph b{font-size:14.5px;font-weight:800}
.fl-hint{font-size:11.5px;color:var(--mut)}
.fl-add{display:flex;align-items:center;gap:6px;background:var(--brand);color:#fff;border:none;padding:8px 13px;border-radius:10px;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
.fl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:13px;padding:16px 18px}
.fl-card{border:1px solid var(--line);border-radius:14px;padding:14px;background:#fff;display:flex;flex-direction:column;gap:9px}
.fl-crow{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.fl-plate{display:flex;align-items:center;gap:9px;color:var(--brand)}
.fl-plate b{font-size:15px;font-weight:800;color:var(--ink);display:block}
.fl-plate small{font-size:11px;color:var(--mut);display:block}
.fl-badge{font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;white-space:nowrap}
.fl-meta{display:flex;flex-wrap:wrap;gap:6px 12px}
.fl-mi{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--mut);font-weight:600}
.fl-tags{display:flex;flex-wrap:wrap;gap:6px}
.fl-tag{display:flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:8px}
.fl-tag.y{background:#e7f7ef;color:#087443}.fl-tag.n{background:#f1f5f9;color:#94a3b8}.fl-tag.w{background:#fef3e2;color:#b54708}
.fl-note{font-size:11.5px;color:var(--mut);line-height:1.6;margin:0;background:var(--bg);padding:8px 10px;border-radius:9px}
.fl-act{display:flex;gap:7px;margin-top:2px}
.fl-act button{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:7px;border-radius:9px;border:1px solid var(--line);background:#fff;font-family:inherit;font-size:12px;font-weight:700;color:var(--ink);cursor:pointer}
.fl-act button.d{flex:0 0 40px;color:#b42318}
.fl-inc{display:flex;flex-direction:column;padding:6px 0}
.fl-icard{display:flex;gap:12px;padding:14px 18px;border-bottom:1px solid var(--line)}
.fl-icard:last-child{border-bottom:none}
.fl-ic-ico{width:38px;height:38px;border-radius:11px;background:var(--bg);display:flex;align-items:center;justify-content:center}
.fl-ic-b{flex:1;min-width:0}
.fl-ic-h{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.fl-ic-h b{font-size:14px;font-weight:800}
.fl-ic-tags{display:flex;flex-wrap:wrap;gap:6px;margin:7px 0}
.fl-chip{display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--mut);background:var(--bg);padding:3px 9px;border-radius:8px}
.fl-refs{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11.5px;color:var(--mut);margin:4px 0 6px}
.fl-refs b{color:var(--ink)}
.fl-p{font-size:12.5px;line-height:1.7;margin:4px 0;color:#334155}.fl-p b{color:var(--ink)}
.fl-tbl{width:100%;border-collapse:collapse}
.fl-tbl th{font-size:11px;color:var(--mut);font-weight:700;text-align:right;padding:11px 18px;border-bottom:1px solid var(--line);background:#fafbfc}
.fl-tbl td{padding:12px 18px;border-bottom:1px solid var(--line);font-size:13px}
.fl-tbl tr:last-child td{border-bottom:none}
.fl-kdot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-inline-end:8px;vertical-align:middle}
.fl-kdot.ok{background:#12b76a}.fl-kdot.bad{background:#f79009}
.fl-recs{font-size:12px;line-height:1.8;color:#334155;padding:14px 18px;background:#fff8f3;border-top:1px solid var(--line)}.fl-recs b{color:var(--brand)}
.fl-empty{text-align:center;padding:40px;color:#cbd5e1}.fl-empty p{color:#94a3b8;font-size:13px;margin-top:8px}
.fl-scrim{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:70;display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow:auto}
.fl-modal{background:#fff;border-radius:16px;width:100%;max-width:540px;box-shadow:0 20px 60px rgba(0,0,0,.3);margin:auto}
.fl-mh{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--line)}
.fl-mh b{font-size:15px;font-weight:800}
.fl-mh button{background:none;border:none;cursor:pointer;color:var(--mut);display:flex}
.fl-mb{padding:16px 18px;display:flex;flex-direction:column;gap:11px}
.fl-2{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.fl-fld{display:flex;flex-direction:column;gap:5px}
.fl-fld>span{font-size:12px;font-weight:700;color:var(--ink)}
.fl-fld input,.fl-fld select,.fl-fld textarea{border:1px solid #dfe3e8;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:13px;outline:none;background:#fff;width:100%}
.fl-fld input:focus,.fl-fld select:focus,.fl-fld textarea:focus{border-color:var(--brand)}
.fl-fld textarea{resize:vertical}
.fl-chk{display:flex;gap:18px;flex-wrap:wrap}
.fl-chk label{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--ink);cursor:pointer}
.fl-mf{display:flex;gap:10px;justify-content:flex-end;padding:14px 18px;border-top:1px solid var(--line)}
.fl-mf button{padding:9px 20px;border-radius:10px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;border:1px solid var(--line)}
.fl-mf button.g{background:#fff;color:var(--mut)}
.fl-mf button.p{background:var(--brand);color:#fff;border-color:var(--brand)}
.fl-mf button.p:disabled{opacity:.6}
@media(max-width:900px){.fl-kpis{grid-template-columns:1fr 1fr 1fr}.fl-2{grid-template-columns:1fr}}
`;
