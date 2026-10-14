import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{useToast}from"./ui";
import ActivityLog from"./ActivityLog";
import CustodyDeclarations from"./CustodyDeclarations";
import{timeline,replacementRow}from"./custodyLifecycle";
import{extractRows,condAr}from"./custodyRound";
import{ACCESSORIES,blankPhone,imeiDigits,imeiError,brandError,simError,phoneSpecs,maskImei,accLabels,isDevice,imeiServerError}from"./custodyPhone";
const CU_FL={name:"العهدة",status:"الحالة",start_date:"البداية",end_date:"النهاية",biker_name:"البايكر",sweater_id:"رقم البايكر",life_months:"العمر (شهر)",category:"الفئة"};
const CU_FL_X={last_check_at:"آخر جرد",last_check_condition:"حالة آخر جرد",decision_status:"قرار المالك",decision_note:"نص القرار"};
const CU_DV={active:"نشطة",due:"مستحقة",replaced:"مُستبدلة",returned:"مُرجعة",planned:"مخطّطة",missing:"ناقصة",ok:"سليمة",damaged:"تالفة",lost:"مفقودة",pending:"بانتظار قرار المالك",decided:"قرّر المالك"};

// الكتالوج وخريطة أصناف بوابة البايكر في ملف مستقل (تستعمله البوابة أيضاً)
import{CATALOG}from"./custodyCatalog";
export{CATALOG};
const MODE_OF=t=>t==="motorcycle"?"buy":["cleaning","sponge","towel","consumable"].includes(t)?"reorder":"replace";
const addMonths=(iso,m)=>{const d=new Date(iso);d.setMonth(d.getMonth()+Math.round(m));return d.toISOString().slice(0,10);};
const daysBetween=(a,b)=>Math.round((new Date(b)-new Date(a))/864e5);
const today=()=>new Date().toISOString().slice(0,10);
// الجوال (device): IMEI إلزامي بفحص القاعدة نفسه، والماركة إلزامية، والخط اختياري ⇒ أول خطأ نصاً أو null
const phoneFormError=p=>{const e=imeiError(p.imei)||brandError(p.brand_model)||simError(p.sim);return e?e.ar:null;};
const errText=e=>imeiServerError(e&&e.message)||(e&&e.message)||"لا صلاحية";

export default function Custody({opId,owner,onGo}){
  const[rows,setRows]=useState([]);const[emps,setEmps]=useState([]);const[loading,setLoading]=useState(true);
  const toast=useToast();const[msg,setMsgRaw]=useState(null);
  // رسائل النجاح → Toast؛ الأخطاء تبقى في الصفحة
  const setMsg=m=>{if(m&&m.ok){toast.ok(m.t,undefined,m.t.length>60?7000:undefined);setMsgRaw(null);}else setMsgRaw(m);};const[tab,setTab]=useState("all");
  const[showAdd,setShowAdd]=useState(false);const[showExtract,setShowExtract]=useState(false);
  const[rounds,setRounds]=useState([]);const[exRound,setExRound]=useState("");
  const[decls,setDecls]=useState([]);const[tlOpen,setTlOpen]=useState(null);const[rev,setRev]=useState(0);
  const[f,setF]=useState({sweater_id:"",catKey:"moto",name:"",start_date:today(),life_months:36,lead_days:90,cost:"",ph:blankPhone()});
  const[repl,setRepl]=useState(null); // استبدال جوال: {id, ...بيانات الجهاز البديل}

  useEffect(()=>{(async()=>{
    setLoading(true);
    const[{data:e},ca,ba]=await Promise.all([
      supabase.from("employees").select("id,full_name,employee_id").not("employee_id","is",null).order("employee_id"),
      (()=>{let q=supabase.from("custody_assets").select("*").order("end_date",{ascending:true});if(opId&&opId!=="all")q=q.or("operator_id.eq."+opId+",operator_id.is.null");return q;})(),
      // تصريحات البوابة (تسجيل أول/تحديث حالة) لسجل كل قطعة
      supabase.from("biker_assets").select("id,kind,asset_id,items,status,reject_reason,reviewed_at,request_id,created_at").order("created_at",{ascending:false}).limit(500),
    ]);
    setEmps(e||[]);setRows(ca.data||[]);setDecls(ba.data||[]);setLoading(false);
  })();},[opId,rev]);

  const empBySid=useMemo(()=>{const m={};emps.forEach(x=>{if(x.employee_id)m[String(x.employee_id).trim()]=x;});return m;},[emps]);
  // «ناقصة» (سُجّلت ناقصة في جولة): بلا عدّاد حتى تُسلَّم
  const dep=r=>{if(r.status==="missing")return{age:0,rem:null,used:0,end:null,due:false};const life=(r.life_months||12)*30;const age=Math.max(0,daysBetween(r.start_date,today()));const end=r.end_date||addMonths(r.start_date,r.life_months||12);const rem=daysBetween(today(),end);const used=Math.min(100,Math.max(0,Math.round(age/life*100)));const due=r.status!=="replaced"&&r.status!=="returned"&&rem<=(r.lead_days||60);return{age,rem,used,end,due};};
  const shown=useMemo(()=>{
    let a=rows;if(tab==="due")a=rows.filter(r=>dep(r).due&&r.status!=="replaced"&&r.status!=="returned");
    else if(tab==="active")a=rows.filter(r=>r.status==="active"||r.status==="due");
    else if(tab==="pending")a=rows.filter(r=>r.decision_status==="pending");
    else if(tab==="reorder")a=rows.filter(r=>MODE_OF(r.item_type)==="reorder");
    return a;
  },[rows,tab]);
  const kpis=useMemo(()=>{const due=rows.filter(r=>dep(r).due&&r.status!=="replaced"&&r.status!=="returned");return{
    total:rows.length,due:due.length,
    buy:due.filter(r=>MODE_OF(r.item_type)==="buy").length,
    reorder:due.filter(r=>MODE_OF(r.item_type)==="reorder").length,
    pending:rows.filter(r=>r.decision_status==="pending").length,
  };},[rows]);

  const pickCat=k=>{const c=CATALOG.find(x=>x.key===k);setF(p=>({...p,catKey:k,name:c?c.name:"",life_months:c?c.life:12,lead_days:c?c.lead:60}));};
  const addCustody=async()=>{
    if(!f.sweater_id){setMsg({ok:false,t:"اختر البايكر"});return;}
    const c=CATALOG.find(x=>x.key===f.catKey);const emp=empBySid[String(f.sweater_id).trim()];
    const dev=c&&c.type==="device";if(dev){const pe=phoneFormError(f.ph);if(pe){setMsg({ok:false,t:pe});return;}}
    const row={operator_id:(opId&&opId!=="all")?opId:null,employee_id:emp?.id||null,biker_name:emp?.full_name||"",sweater_id:f.sweater_id,
      item_type:c?.type||"other",category:c?.category||null,name:f.name||c?.name||"عُهدة",name_en:c?.en||null,
      start_date:f.start_date,life_months:Number(f.life_months||12),end_date:addMonths(f.start_date,Number(f.life_months||12)),
      lead_days:Number(f.lead_days||60),cost:f.cost?Number(f.cost):null,source:"manual",
      ...(dev?{serial_no:imeiDigits(f.ph.imei),specs:phoneSpecs(f.ph)}:{})};
    const{data,error}=await supabase.from("custody_assets").insert(row).select().single();
    if(error){setMsg({ok:false,t:"خطأ: "+errText(error)});return;}
    if(dev)setF(p=>({...p,ph:blankPhone()}));
    setRows(p=>[...p,data].sort((a,b)=>(a.end_date||"")<(b.end_date||"")?-1:1));setShowAdd(false);setMsg({ok:true,t:"تمت إضافة العُهدة"});
  };

  const extractFromRound=async()=>{
    const r=rounds.find(x=>x.id===exRound);if(!r){setMsg({ok:false,t:"اختر جولة"});return;}
    const emp=empBySid[String(r.sweater_id).trim()];
    // ما سُجّل متوفّراً ⇒ نشط من تاريخ الجولة · ما سُجّل ناقصاً ⇒ «ناقصة» بلا عدّاد · غير المسجّل لا يُضاف (src/custodyRound.js)
    // الجوال لا يُستخرج من جولة: يحتاج IMEI الجهاز (يُضاف من «إضافة عُهدة» أو من إقرار البايكر)
    const mine=rows.filter(x=>emp?x.employee_id===emp.id:String(x.sweater_id)===String(r.sweater_id));
    const{rows:toAdd,unknown}=extractRows(r,mine,{operator_id:(opId&&opId!=="all")?opId:null,employee_id:emp?.id||null,biker_name:emp?.full_name||r.biker_name||""});
    const unk=unknown.length?` · لم تُسجَّل في الجولة (أضِفها يدوياً إن وُجدت): ${unknown.map(k=>(CATALOG.find(c=>c.key===k)||{}).name).join("، ")}`:"";
    if(!toAdd.length){setMsg({ok:false,t:"لا أصناف جديدة من هذه الجولة — المسجّل فيها مسجّل للبايكر مسبقاً"+unk});setShowExtract(false);return;}
    const{data,error}=await supabase.from("custody_assets").insert(toAdd).select();
    if(error){setMsg({ok:false,t:"خطأ: "+error.message});return;}
    setRows(p=>[...p,...(data||[])].sort((a,b)=>(a.end_date||"")<(b.end_date||"")?-1:1));setShowExtract(false);setExRound("");
    const nMiss=(data||[]).filter(x=>x.status==="missing").length;
    setMsg({ok:true,t:`تمت إضافة ${(data?.length||0)-nMiss} عُهدة نشطة (بداية ${r.round_date})${nMiss?` و${nMiss} «ناقصة» بلا عدّاد`:""}${unk}`});
  };
  const openExtract=async()=>{
    setShowExtract(true);setShowAdd(false);
    let q=supabase.from("field_rounds").select("id,biker_name,sweater_id,round_date,results,item_parts").order("round_date",{ascending:false}).limit(40);
    if(opId&&opId!=="all")q=q.or("operator_id.eq."+opId+",operator_id.is.null");
    const{data}=await q;setRounds(data||[]);
  };

  const reorder=async(r)=>{ // مستهلك → طلب سويتر + إعادة ضبط دورة الإهلاك
    const p=n=>String(n).padStart(2,"0");const d=new Date();
    const ref=`DW-${r.sweater_id||"x"}-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-C${Math.floor(1000+Math.random()*9000)}`;
    const item={n:null,ar:r.name,en:r.name_en||"",type:r.item_type,category:r.category||"مستهلكات",category_en:"",status:"reorder",status_ar:"إعادة طلب (استهلاك دورة العُهدة)",status_en:"Reorder (consumable cycle)",note:`عُهدة بدأت ${r.start_date} — انتهت دورتها`,parts_ar:"",parts_en:""};
    const{data:sr,error}=await supabase.from("supply_requests").insert({operator_id:r.operator_id||((opId&&opId!=="all")?opId:null),ref,round_id:r.round_id||null,biker_name:r.biker_name,sweater_id:r.sweater_id,requesting_dept:"التشغيل — دلو ورغوة",items:[item]}).select().single();
    if(error){setMsg({ok:false,t:"خطأ في إنشاء الطلب: "+error.message});return;}
    // إعادة ضبط دورة العُهدة المستهلكة
    const ns=today(),ne=addMonths(ns,r.life_months||1);
    const{data:up}=await supabase.from("custody_assets").update({start_date:ns,end_date:ne,status:"active",reorder_request_id:sr.id}).eq("id",r.id).select().single();
    if(up)setRows(pr=>pr.map(x=>x.id===r.id?up:x));
    setMsg({ok:true,t:`أُنشئ طلب سويتر ${ref} وأُعيدت دورة العُهدة — راجع «طلبات الإمداد»`});
  };
  const planReplace=async(r)=>{ // أصل معمّر/دراجة → وسم للتخطيط
    const{data}=await supabase.from("custody_assets").update({status:"due",notes:(r.notes?r.notes+" · ":"")+`خُطّط للاستبدال ${today()}`}).eq("id",r.id).select().single();
    if(data)setRows(p=>p.map(x=>x.id===r.id?data:x));
    setMsg({ok:true,t:r.item_type==="motorcycle"?"وُسمت الدراجة ضمن خطة الشراء":"وُسمت العُهدة للاستبدال"});
  };
  // الاستبدال الفعلي: القديمة «مُستبدلة»، وقطعة جديدة من نفس الصنف تبدأ اليوم بعمر كامل
  const markReplaced=async(r)=>{
    if(isDevice(r)){setRepl({id:r.id,...blankPhone(),brand_model:(r.specs&&r.specs.brand_model)||""});return;}
    if(!confirm(`تأكيد استبدال «${r.name}» لـ ${r.biker_name||"—"}؟ تبدأ قطعة جديدة اليوم بعمر كامل.`))return;
    const t=today();
    const{data:old,error}=await supabase.from("custody_assets").update({status:"replaced",notes:(r.notes?r.notes+" · ":"")+`استُبدلت ${t}`}).eq("id",r.id).select().single();
    if(error||!old){setMsg({ok:false,t:"تعذّر الاستبدال: "+((error&&error.message)||"لا صلاحية")});return;}
    const{data:nw,error:e2}=await supabase.from("custody_assets").insert(replacementRow(r,t)).select().single();
    setRows(p=>[...p.map(x=>x.id===r.id?old:x),...(nw?[nw]:[])]);
    setMsg(e2?{ok:false,t:"استُبدلت القديمة لكن تعذّر إنشاء البديلة: "+e2.message}:{ok:true,t:`استُبدلت ✓ — بدأت «${r.name}» جديدة اليوم حتى ${nw.end_date}`});
  };
  // استبدال الجوال: IMEI الجهاز البديل إلزامي. البديل يُنشأ أولاً (إن رُفض الـIMEI لا يتغيّر شيء) ثم تُوسم القديمة «مُستبدلة»
  const replaceDevice=async(r)=>{
    const pe=phoneFormError(repl);if(pe){setMsg({ok:false,t:pe});return;}
    const imei=imeiDigits(repl.imei);
    if(imei===imeiDigits(r.serial_no)){setMsg({ok:false,t:"IMEI البديل نفس IMEI الجهاز الحالي — أدخل رقم الجهاز الجديد."});return;}
    const t=today();
    const{data:nw,error:e1}=await supabase.from("custody_assets").insert(replacementRow(r,t,{serial_no:imei,specs:phoneSpecs(repl)})).select().single();
    if(e1||!nw){setMsg({ok:false,t:"تعذّر الاستبدال: "+errText(e1)});return;}
    const{data:old,error:e2}=await supabase.from("custody_assets").update({status:"replaced",notes:(r.notes?r.notes+" · ":"")+`استُبدلت ${t}`}).eq("id",r.id).select().single();
    setRows(p=>[...p.map(x=>x.id===r.id&&old?old:x),nw]);setRepl(null);
    setMsg(e2||!old?{ok:false,t:"أُنشئ الجهاز البديل لكن تعذّر وسم القديم «مُستبدلاً»: "+errText(e2)}:{ok:true,t:`استُبدل الجوال ✓ — الجديد IMEI ${maskImei(imei)} حتى ${nw.end_date}`});
  };
  // قرار المالك على التالفة/المفقودة: نص القرار إلزامي، ولا تحميل على البايكر من هنا (القرار يُنفَّذ بإجرائه المعتاد)
  const decide=async(r)=>{
    const note=(prompt(`قرار المالك على «${r.name}» (${condAr(r.last_check_condition)}${r.last_check_imei_ok===false?" · IMEI غير مطابق":""}) — اكتب القرار:`,"")||"").trim();
    if(!note)return;
    const{data:{user}}=await supabase.auth.getUser();
    const{data,error}=await supabase.from("custody_assets").update({decision_status:"decided",decision_note:note,decided_by:user?.id||null,decided_at:new Date().toISOString()}).eq("id",r.id).select().single();
    if(error||!data){setMsg({ok:false,t:"تعذّر حفظ القرار: "+errText(error)});return;}
    setRows(p=>p.map(x=>x.id===r.id?data:x));setMsg({ok:true,t:`سُجّل القرار على «${r.name}»`});
  };
  const del=async(r)=>{if(!confirm("حذف العُهدة؟"))return;const{error}=await supabase.from("custody_assets").delete().eq("id",r.id);if(!error)setRows(p=>p.filter(x=>x.id!==r.id));};

  if(loading)return<div className="g-skel" style={{height:280}}/>;

  return(<div className="cu">
    <style>{CSS}</style>
    <div className="cu-bar">
      <button className="cu-btn" onClick={()=>{setShowAdd(!showAdd);setShowExtract(false);setMsg(null);}}><Icon n="plus" s={15}/> إضافة عُهدة</button>
      <button className="cu-btn ghost" onClick={openExtract}><Icon n="rounds" s={15}/> استخراج من جولة</button>
    </div>
    {msg&&<div className={"cu-msg "+(msg.ok?"ok":"err")}>{msg.t}</div>}
    <CustodyDeclarations opId={opId} onGo={onGo} onChanged={()=>setRev(v=>v+1)}/>

    {showAdd&&<div className="cu-form">
      <div className="cu-grid">
        <label><span>البايكر</span><select value={f.sweater_id} onChange={e=>setF({...f,sweater_id:e.target.value})}><option value="">اختر…</option>{emps.map(e=><option key={e.id} value={e.employee_id}>{e.full_name} · #{e.employee_id}</option>)}</select></label>
        <label><span>العُهدة</span><select value={f.catKey} onChange={e=>pickCat(e.target.value)}>{CATALOG.map(c=><option key={c.key} value={c.key}>{c.name}</option>)}</select></label>
        <label><span>تاريخ البداية</span><input type="date" value={f.start_date} onChange={e=>setF({...f,start_date:e.target.value})}/></label>
        <label><span>العمر الافتراضي (شهر)</span><input type="number" min="1" value={f.life_months} onChange={e=>setF({...f,life_months:e.target.value})}/></label>
        <label><span>مهلة التخطيط (يوم)</span><input type="number" min="1" value={f.lead_days} onChange={e=>setF({...f,lead_days:e.target.value})}/></label>
        <label><span>التكلفة (اختياري)</span><input type="number" value={f.cost} onChange={e=>setF({...f,cost:e.target.value})}/></label>
      </div>
      {f.catKey==="phone"&&<PhoneForm p={f.ph} set={ph=>setF(x=>({...x,ph:{...x.ph,...ph}}))}/>}
      <div className="cu-endhint">تاريخ الانتهاء المتوقّع: <b>{f.start_date?addMonths(f.start_date,Number(f.life_months||12)):"—"}</b></div>
      <button className="cu-btn ok" style={{width:"100%",marginTop:10}} onClick={addCustody}><Icon n="save" s={15}/> حفظ العُهدة</button>
    </div>}

    {showExtract&&<div className="cu-form">
      <div className="cu-fh"><Icon n="rounds" s={15}/> استخراج العُهد من جولة ميدانية (تاريخ البداية = تاريخ الجولة)</div>
      <div className="cu-exrow">
        <select value={exRound} onChange={e=>setExRound(e.target.value)}><option value="">اختر جولة…</option>{rounds.map(r=><option key={r.id} value={r.id}>{r.biker_name||r.sweater_id} · #{r.sweater_id} · {r.round_date}</option>)}</select>
        <button className="cu-btn ok" onClick={extractFromRound}><Icon n="check" s={15}/> استخراج</button>
      </div>
      <div className="cu-note">يضيف فقط ما سُجّل <b>متوفّراً</b> في الجولة (ببداية تاريخ الجولة وعمره الافتراضي)، وما سُجّل <b>ناقصاً</b> يُضاف «ناقصة» بلا عدّاد حتى يُسلَّم بطلب إمداد. ما لم يُسجَّل في الجولة لا يُضاف — أضِفه يدوياً. المسجّل للبايكر لا يتكرّر.</div>
    </div>}

    <div className="cu-kpis">
      <K ic="bucket" c="var(--info-ink)" bg="var(--info-bg)" t="إجمالي العُهد" v={kpis.total}/>
      <K ic="alert" c="var(--warn-ink)" bg="var(--warn-bg)" t="قارب انتهاؤها" v={kpis.due}/>
      <K ic="bike" c="var(--bad-ink)" bg="var(--bad-bg)" t="تخطيط شراء" v={kpis.buy}/>
      <K ic="refresh" c="var(--ok-ink)" bg="var(--ok-bg)" t="إعادة طلب" v={kpis.reorder}/>
    </div>
    <div className="cu-hint"><Icon n="alert" s={13}/> يُحسب الإهلاك من تاريخ البداية × العمر الافتراضي. قبل النهاية بمهلة التخطيط: الأصول المعمّرة (الدراجة) → «خطّط للشراء»، والمواد المستهلكة → «طلب سويتر» يُنشئ طلب إمداد ويعيد ضبط دورة العُهدة.</div>

    {kpis.pending>0&&<button className="cu-pend" onClick={()=>setTab("pending")}><Icon n="alert" s={14}/> {kpis.pending} قطعة تالفة/مفقودة من الجولات — بانتظار قرار المالك</button>}
    <div className="cu-tabs">{[["all","الكل"],["due","قارب الانتهاء"],["reorder","المستهلكات"],["active","النشطة"],["pending",`بانتظار القرار${kpis.pending?` (${kpis.pending})`:""}`]].map(([k,l])=><button key={k} className={"cu-tab"+(tab===k?" on":"")} onClick={()=>setTab(k)}>{l}</button>)}</div>

    {shown.length===0?<div className="cu-empty"><div className="cu-empty-ic"><Icon n="bucket" s={30}/></div><h3>لا عُهد</h3><p>أضِف عُهدة يدوياً أو استخرجها من جولة ميدانية — ويبدأ احتساب الإهلاك وتخطيط الاستبدال/إعادة الطلب.</p></div>:
    shown.map(r=>{const d=dep(r);const mode=MODE_OF(r.item_type);const miss=r.status==="missing";const col=r.status==="replaced"||miss?"var(--mut-2)":d.due?"var(--bad)":d.used>=70?"var(--warn)":"var(--ok)";
      return(
      <div className={"cu-card"+(d.due?" due":"")} key={r.id} style={{borderInlineStartColor:col}}>
        <div className="cu-top">
          <div><div className="cu-name">{r.name}<span className="cu-cat">{r.category}</span>{r.status==="replaced"&&<span className="cu-badge rep">مُستبدلة</span>}{miss&&<span className="cu-badge rep">ناقصة — لا عدّاد</span>}{d.due&&r.status!=="replaced"&&<span className="cu-badge due">قارب الانتهاء</span>}{r.decision_status==="pending"&&<span className="cu-badge due">بانتظار قرار المالك</span>}</div>
            <div className="cu-sub">{r.biker_name||"—"} · #{r.sweater_id||"—"} · {r.name_en||""}</div></div>
          <div className="cu-rem" style={{color:col}}>{r.status==="replaced"||miss?"—":d.rem>=0?`${d.rem} يوم`:`متأخر ${Math.abs(d.rem)} يوم`}</div>
        </div>
        {isDevice(r)&&<div className="cu-dev"><span dir="ltr" title={r.serial_no||""}>IMEI {maskImei(r.serial_no)||"—"}</span>{r.specs&&r.specs.brand_model&&<span dir="ltr">{r.specs.brand_model}</span>}
          {r.specs&&r.specs.sim&&<span dir="ltr">☎ {r.specs.sim}</span>}{accLabels(r.specs&&r.specs.acc).map(a=><span key={a} className="cu-cat">{a}</span>)}</div>}
        {miss?<div className="cu-dates">🗓️ سُجّلت ناقصة في جولة <b>{r.start_date}</b> — يبدأ العدّاد عند تسليمها بطلب إمداد</div>:<>
        <div className="cu-dates">🗓️ البداية: <b>{r.start_date}</b> · الانتهاء المتوقّع: <b>{d.end}</b> · العمر: {r.life_months} شهر</div>
        <div className="cu-bar-t"><div style={{width:d.used+"%",background:col}}/></div>
        <div className="cu-used">استُهلك {d.used}% من العمر الافتراضي</div></>}
        {r.last_check_at&&<div className={"cu-chk "+(r.last_check_condition||"")}>🔎 آخر جرد: <b>{r.last_check_at}</b> · {condAr(r.last_check_condition)}{r.last_check_imei_ok===true?" · IMEI ✅":r.last_check_imei_ok===false?" · IMEI ❌ غير مطابق":""}{r.last_check_note?` — ${r.last_check_note}`:""}
          {r.last_check_photo&&<a href={r.last_check_photo} target="_blank" rel="noreferrer"> · صورة</a>}</div>}
        {r.decision_status==="pending"&&<div className="cu-dec"><Icon n="alert" s={13}/> بانتظار قرار المالك — لا يُحمَّل على البايكر تلقائياً{owner&&<button className="cu-b plan" onClick={()=>decide(r)}><Icon n="check" s={12}/> تسجيل القرار</button>}</div>}
        {r.decision_status==="decided"&&r.decision_note&&<div className="cu-notes">⚖️ قرار المالك{r.decided_at?` (${String(r.decided_at).slice(0,10)})`:""}: {r.decision_note}</div>}
        {r.notes&&<div className="cu-notes">{r.notes}</div>}
        <div className="cu-actions">
          {r.status!=="replaced"&&d.due&&mode==="reorder"&&<button className="cu-b reorder" onClick={()=>reorder(r)}><Icon n="refresh" s={13}/> طلب سويتر (إعادة)</button>}
          {r.status!=="replaced"&&d.due&&mode==="buy"&&<button className="cu-b buy" onClick={()=>planReplace(r)}><Icon n="bike" s={13}/> خطّط لشراء دراجة</button>}
          {r.status!=="replaced"&&d.due&&mode==="replace"&&<button className="cu-b plan" onClick={()=>planReplace(r)}><Icon n="alert" s={13}/> خطّط للاستبدال</button>}
          {r.status!=="replaced"&&!miss&&<button className="cu-b done" onClick={()=>markReplaced(r)}><Icon n="check" s={13}/> استُبدلت</button>}
          <button className="cu-b" onClick={()=>setTlOpen(tlOpen===r.id?null:r.id)} aria-expanded={tlOpen===r.id}><Icon n="clock" s={13}/> سجل القطعة</button>
          <ActivityLog table="custody_assets" rowId={r.id} labels={{...CU_FL,...CU_FL_X}} valueMap={CU_DV} entityName="العهدة"/>
          <div style={{flex:1}}/>
          {owner&&<button className="cu-b del" onClick={()=>del(r)}><Icon n="trash" s={12}/></button>}
        </div>
        {repl&&repl.id===r.id&&<div className="cu-form" style={{marginTop:10,marginBottom:0}}>
          <div className="cu-fh"><Icon n="refresh" s={15}/> استبدال الجوال — بيانات الجهاز البديل (IMEI إلزامي)</div>
          <PhoneForm p={repl} set={ph=>setRepl(x=>({...x,...ph}))}/>
          <div className="cu-actions"><button className="cu-b done" onClick={()=>replaceDevice(r)}><Icon n="check" s={13}/> تأكيد الاستبدال</button><button className="cu-b" onClick={()=>setRepl(null)}>إلغاء</button></div>
        </div>}
        {tlOpen===r.id&&isDevice(r)&&<div className="cu-notes" dir="ltr" style={{marginTop:8}}>IMEI: {r.serial_no||"—"}</div>}
        {tlOpen===r.id&&<ol className="cu-tl">{timeline(r,decls).map((ev,i)=><li key={i} className={"cu-tl-"+ev.type}><span className="cu-tl-at">{String(ev.at||"").slice(0,10)||"—"}</span><span>{ev.ar}</span>{ev.photo&&<a href={ev.photo} target="_blank" rel="noreferrer">صورة</a>}</li>)}</ol>}
      </div>);})}
  </div>);
}
// حقول الجوال في «إضافة عُهدة» و«استبدال»: IMEI بفحص فوري، الماركة والموديل، الخط، الملحقات
function PhoneForm({p,set}){
  const e=p.imei?imeiError(p.imei):null;
  return(<div className="cu-grid" style={{marginTop:10}}>
    <label><span>IMEI (إلزامي — ⁦*#06#⁩ على الجوال)</span><input dir="ltr" inputMode="numeric" autoComplete="off" value={p.imei} onChange={x=>set({imei:x.target.value})} placeholder="15 رقماً"/>
      {p.imei&&<em className={"cu-imei "+(e?"bad":"ok")}>{e?e.ar:"رقم صحيح ✓"}</em>}</label>
    <label><span>الماركة والموديل (إلزامي)</span><input dir="ltr" maxLength={60} value={p.brand_model} onChange={x=>set({brand_model:x.target.value})} placeholder="Samsung A15"/></label>
    <label><span>رقم الخط (اختياري)</span><input dir="ltr" inputMode="tel" value={p.sim} onChange={x=>set({sim:x.target.value})} placeholder="05xxxxxxxx"/></label>
    <div className="cu-accs">{ACCESSORIES.map(a=><label key={a.k}><input type="checkbox" checked={!!p.acc[a.k]} onChange={x=>set({acc:{...p.acc,[a.k]:x.target.checked}})}/>{a.ar}</label>)}</div>
  </div>);
}
function K({ic,c,bg,t,v}){return(<div className="cu-kpi"><span className="cu-ki" style={{background:bg,color:c}}><Icon n={ic} s={17}/></span><div><div className="cu-kv">{v}</div><div className="cu-kl">{t}</div></div></div>);}

const CSS=`
.cu{--b:var(--p)}
.cu-tl{list-style:none;margin:8px 0 0;padding:8px 10px;border-top:1px dashed var(--line);display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--ink-2)}
.cu-tl li{display:flex;gap:8px;flex-wrap:wrap;align-items:baseline;overflow-wrap:anywhere}.cu-tl-at{color:var(--mut);font-size:11px;font-variant-numeric:tabular-nums}
.cu-tl a{color:var(--b);font-weight:800;font-size:11px}.cu-tl-rejected{color:var(--bad-ink)}.cu-tl-approved{color:var(--ok-ink)}.cu-tl-replaced{font-weight:800}
.cu-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.cu-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:11px;border:none;background:var(--ink);color:var(--bg);font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.cu-btn.ghost{background:var(--glass-2);border:1px solid var(--line-2);color:var(--ink-2)}
.cu-btn.ok{background:linear-gradient(135deg,var(--ok),color-mix(in srgb,var(--ok) 72%,black))}
.cu-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:12px}
.cu-msg.ok{background:var(--ok-bg);color:var(--ok-ink)}.cu-msg.err{background:var(--bad-bg);color:var(--bad-ink)}
.cu-form{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:14px;box-shadow:var(--shadow)}
.cu-fh{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:800;margin-bottom:10px}
.cu-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.cu-grid label{display:flex;flex-direction:column;gap:4px}
.cu-grid span{font-size:11px;color:var(--mut);font-weight:600}
.cu-grid select,.cu-grid input{border:1px solid var(--line-2);border-radius:10px;padding:9px 11px;font-family:inherit;font-size:13px;font-weight:600;color:var(--ink);outline:none;background:var(--glass-3);width:100%;box-sizing:border-box}
.cu-dev{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:11.5px;font-weight:700;color:var(--ink-2);margin-top:6px}
.cu-imei{font-style:normal;font-size:11px;font-weight:700}.cu-imei.ok{color:var(--ok-ink)}.cu-imei.bad{color:var(--bad-ink)}
.cu-accs{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;grid-column:1/-1}.cu-accs label{flex-direction:row!important;align-items:center;gap:6px!important;font-size:12.5px;font-weight:700}
.cu-grid .cu-accs input{width:18px;height:18px;padding:0}
.cu-endhint{font-size:11.5px;color:var(--mut);margin-top:9px}.cu-endhint b{color:var(--ink)}
.cu-exrow{display:flex;gap:8px;flex-wrap:wrap}
.cu-exrow select{flex:1;min-width:180px;border:1px solid var(--line-2);border-radius:10px;padding:9px 11px;font-family:inherit;font-size:13px;font-weight:600;outline:none;background:var(--glass-3)}
.cu-note{font-size:11px;color:var(--mut-2);margin-top:8px;line-height:1.6}
.cu-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px}
.cu-kpi{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:15px;padding:13px;display:flex;align-items:center;gap:11px;box-shadow:var(--shadow)}
.cu-ki{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.cu-kv{font-size:19px;font-weight:800;letter-spacing:-.5px}.cu-kl{font-size:11px;color:var(--mut);font-weight:600}
.cu-hint{display:flex;align-items:flex-start;gap:7px;background:var(--warn-bg);border:1px solid color-mix(in srgb,var(--warn) 35%,transparent);color:var(--warn-ink);font-size:11.5px;font-weight:600;border-radius:11px;padding:10px 12px;margin-bottom:12px;line-height:1.6}
.cu-tabs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}
.cu-tab{padding:7px 14px;border-radius:20px;border:1px solid var(--line-2);background:var(--glass-2);color:var(--ink-2);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer}
.cu-tab.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.cu-card{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-inline-start:3px solid var(--line);border-radius:14px;padding:13px 15px;margin-bottom:10px;box-shadow:var(--shadow)}
.cu-card.due{background:var(--p-50)}
.cu-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.cu-name{font-size:14px;font-weight:800;color:var(--ink);display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cu-cat{font-size:10px;font-weight:700;color:var(--mut);background:var(--soft);border-radius:20px;padding:2px 9px}
.cu-badge{font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:20px}
.cu-badge.due{background:var(--bad-bg);color:var(--bad-ink)}.cu-badge.rep{background:var(--soft);color:var(--mut)}
.cu-sub{font-size:11.5px;color:var(--mut);margin-top:3px}
.cu-rem{font-size:15px;font-weight:800;flex:none}
.cu-dates{font-size:11px;color:var(--mut);margin-top:8px}.cu-dates b{color:var(--ink)}
.cu-bar-t{height:7px;background:var(--track);border-radius:5px;overflow:hidden;margin-top:7px}.cu-bar-t div{height:100%;border-radius:5px}
.cu-used{font-size:10.5px;color:var(--mut-2);margin-top:4px}
.cu-pend{display:flex;align-items:center;gap:7px;width:100%;margin-bottom:12px;padding:10px 12px;border-radius:11px;border:1px solid color-mix(in srgb,var(--warn) 35%,transparent);background:var(--warn-bg);color:var(--warn-ink);font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;text-align:start}
.cu-chk{margin-top:8px;font-size:11.5px;font-weight:600;color:var(--ok-ink);background:var(--ok-bg);border-radius:8px;padding:6px 10px}
.cu-chk.damaged,.cu-chk.lost{color:var(--warn-ink);background:var(--warn-bg)}.cu-chk a{color:inherit;font-weight:800}
.cu-dec{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:8px;font-size:11.5px;font-weight:800;color:var(--bad-ink);background:var(--bad-bg);border-radius:8px;padding:6px 10px}
.cu-dec .cu-b{margin-inline-start:auto}
.cu-notes{margin-top:8px;font-size:11.5px;color:var(--ink-2);background:var(--soft);border:1px solid var(--line);border-radius:8px;padding:7px 10px}
.cu-actions{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-top:11px}
.cu-b{display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:9px;border:1px solid var(--line-2);background:var(--glass-2);color:var(--ink-2);font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer}
.cu-b.reorder{border-color:color-mix(in srgb,var(--ok) 35%,transparent);background:var(--ok-bg);color:var(--ok-ink)}
.cu-b.buy{border-color:color-mix(in srgb,var(--bad) 35%,transparent);background:var(--bad-bg);color:var(--bad-ink)}
.cu-b.plan{border-color:color-mix(in srgb,var(--warn) 35%,transparent);background:var(--warn-bg);color:var(--warn-ink)}
.cu-b.done{border-color:color-mix(in srgb,var(--info) 35%,transparent);background:var(--info-bg);color:var(--info-ink)}
.cu-b.del{border-color:color-mix(in srgb,var(--bad) 35%,transparent);color:var(--bad-ink)}
.cu-empty{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px dashed var(--line);border-radius:16px;padding:40px 24px;text-align:center}
.cu-empty-ic{width:64px;height:64px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--p-100),var(--p-100));color:var(--b)}
.cu-empty h3{font-size:16px;margin:0 0 8px}.cu-empty p{color:var(--mut);font-size:12.5px;max-width:440px;margin:0 auto;line-height:1.7}
@media(max-width:720px){.cu-kpis{grid-template-columns:1fr 1fr}.cu-grid{grid-template-columns:1fr 1fr}}
`;
