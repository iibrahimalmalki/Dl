import{useState,useEffect,useMemo,useRef}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{useToast,Modal,Tabs,Badge}from"./ui";
import{daysLeft,docStatus,dayText,STATUS_TABS,waPhone,bikerMessage,buildICS}from"./renewalsLib";

const DOC_TYPES=["تأمين مركبة","استمارة سير","رخصة قيادة","إقامة","رخصة عمل","جواز سفر","تأمين صحي","رخصة بلدية","عقد إيجار","عقد تشغيلي","ملحق عقد","سجل تجاري","اشتراك/رخصة تشغيل","أخرى"];
const TYPE_ICON={"تأمين مركبة":"bike","استمارة سير":"id","رخصة قيادة":"id","إقامة":"id","رخصة عمل":"id","جواز سفر":"id","تأمين صحي":"doc","رخصة بلدية":"building","عقد إيجار":"home","عقد تشغيلي":"reports","ملحق عقد":"doc","سجل تجاري":"building","اشتراك/رخصة تشغيل":"doc","أخرى":"doc"};

// ألوان الحالة من تصنيف الأيام (منتهية/≤7 bad · ≤14 warn · ≤30 info · سارية ok)
function band(days){
  const st=docStatus(days);
  if(!st.tone)return{...st,c:"var(--mut-2)",bg:"var(--soft)"};
  return{...st,c:`var(--${st.tone}-ink)`,bg:`var(--${st.tone}-bg)`};
}
const todayISO=()=>{const t=new Date();return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0");};
const fmtD=d=>d?new Date(d+"T00:00:00").toLocaleDateString("en-GB"):"—";

export default function Renewals({opId}){
  const[loading,setLoading]=useState(true);
  const[docs,setDocs]=useState([]);
  const[emps,setEmps]=useState([]);
  const[veh,setVeh]=useState([]);
  const[filter,setFilter]=useState("all");const[stab,setStab]=useState("all");
  const[ren,setRen]=useState(null);const[flash,setFlash]=useState(null);const rowRefs=useRef({});
  const[form,setForm]=useState(null);const toast=useToast();const[msg,setMsgRaw]=useState(null);
  // رسائل النجاح → Toast؛ الأخطاء تبقى في الصفحة
  const setMsg=m=>{if(m&&m.ok){toast.ok(m.t,undefined,m.t.length>60?7000:undefined);setMsgRaw(null);}else setMsgRaw(m);};const[busy,setBusy]=useState(false);
  const note=(ok,t)=>setMsg({ok,t});

  const load=async()=>{
    setLoading(true);
    let q=supabase.from("renewal_docs").select("*").eq("active",true);
    if(opId&&opId!=="all")q=q.or("operator_id.eq."+opId+",operator_id.is.null");
    const{data}=await q;
    const rows=(data||[]).map(r=>({...r,_d:daysLeft(r.end_date)}));
    rows.sort((a,b)=>(a._d==null?1e9:a._d)-(b._d==null?1e9:b._d));
    setDocs(rows);setLoading(false);
  };
  useEffect(()=>{load();/*eslint-disable-next-line*/},[opId]);
  useEffect(()=>{supabase.from("employees").select("id,full_name,employee_id,mobile").order("full_name").then(({data})=>setEmps(data||[]));},[]);
  useEffect(()=>{supabase.from("fleet_vehicles").select("id,plate,plate_en").eq("active",true).order("plate").then(({data})=>setVeh(data||[]));},[]);

  const kpis=useMemo(()=>{
    const withEnd=docs.filter(d=>d._d!=null);
    const nearest=withEnd.filter(d=>d._d>=0).reduce((m,d)=>m==null||d._d<m._d?d:m,null);
    const min=withEnd.length?Math.min(...withEnd.map(d=>d._d)):null;
    return{total:docs.length,nearest,min,urgent:withEnd.filter(d=>d._d<=7).length,expired:withEnd.filter(d=>d._d<0).length,valid:withEnd.filter(d=>d._d>30).length};
  },[docs]);
  const tabDef=STATUS_TABS.find(t=>t.k===stab)||STATUS_TABS[0];
  const shown=docs.filter(d=>(filter==="all"||d.doc_type===filter)&&tabDef.f(d._d));
  const tabItems=STATUS_TABS.map(t=>({k:t.k,ar:t.ar,n:docs.filter(d=>(filter==="all"||d.doc_type===filter)&&t.f(d._d)).length}));
  const empOf=id=>emps.find(x=>x.id===id);

  // الوصول من البحث الشامل/الإشعارات: dw:open {table:'renewal_docs',id} ← تمييز الصف
  const focusDoc=id=>{if(!id)return;setFilter("all");setStab("all");setFlash(id);
    setTimeout(()=>{const el=rowRefs.current[id];if(el)el.scrollIntoView({behavior:"smooth",block:"center"});},60);
    setTimeout(()=>setFlash(f=>f===id?null:f),2000);};
  useEffect(()=>{
    const h=e=>{const d=e.detail||{};if(d.table==="renewal_docs")focusDoc(d.id);};
    window.addEventListener("dw:open",h);
    // حدث سابق لتحميل الصفحة (الصفحة lazy) — يحفظه Shell في window.__dwLast
    const last=window.__dwLast;if(!loading&&last&&last.table==="renewal_docs"&&Date.now()-last.t<8000){window.__dwLast=null;focusDoc(last.id);}
    return()=>window.removeEventListener("dw:open",h);
  /*eslint-disable-next-line*/},[loading]);

  // رسالة واتساب ثنائية اللغة للبايكر صاحب الوثيقة
  const bikerWa=d=>{const e=empOf(d.employee_id);if(!e)return;
    const txt=bikerMessage({name:e.full_name||d.subject,docType:d.doc_type,end:d.end_date,days:d._d});
    window.open("https://wa.me/"+waPhone(e.mobile)+"?text="+encodeURIComponent(txt),"_blank");};

  // تقويم .ics لكل الوثائق السارية التي تنتهي خلال 120 يوماً
  const exportICS=()=>{
    const ics=buildICS(docs);const n=(ics.match(/BEGIN:VEVENT/g)||[]).length;
    if(!n){toast.info("لا وثائق تنتهي خلال 120 يوماً");return;}
    const url=URL.createObjectURL(new Blob([ics],{type:"text/calendar;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download="dalu-renewals.ics";document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);toast.ok("تم تصدير "+n+" موعد انتهاء");};

  // تجديد: صف جديد بنفس النوع/الموضوع/الروابط، ثم إيقاف القديم مع ملاحظة الربط
  const openRenew=d=>setRen({old:d,start_date:d.end_date||todayISO(),end_date:"",provider:d.provider||"",ref_no:"",cost:"",file:null});
  const saveRenew=async()=>{
    const r=ren,o=r.old;
    if(!r.end_date){note(false,"أدخل تاريخ النهاية الجديد");return;}
    if(r.start_date&&r.end_date<r.start_date){note(false,"تاريخ النهاية قبل تاريخ البداية");return;}
    setBusy(true);note(false,"");
    try{
      const row={operator_id:o.operator_id||null,doc_type:o.doc_type,title:o.title||null,subject:o.subject,subject_kind:o.subject_kind||null,
        employee_id:o.employee_id||null,vehicle_id:o.vehicle_id||null,provider:r.provider||null,ref_no:r.ref_no||null,
        start_date:r.start_date||null,end_date:r.end_date,notes:"تجديد لـ "+o.id,active:true};
      const cost=r.cost!==""&&r.cost!=null?Number(r.cost):null;
      let res=await supabase.from("renewal_docs").insert(cost!=null?{...row,cost}:row).select("id").single();
      // عمود cost غير موجود بعد ← تُحفظ التكلفة في الملاحظات
      if(res.error&&cost!=null&&/cost/i.test(res.error.message||"")){
        res=await supabase.from("renewal_docs").insert({...row,notes:row.notes+" · التكلفة: "+cost+" ﷼"}).select("id").single();
      }
      if(res.error)throw res.error;
      const nid=res.data.id;
      if(r.file){
        const path=nid+"/"+Date.now()+"_"+r.file.name.replace(/[^\w.\-]+/g,"_");
        const up=await supabase.storage.from("legal-docs").upload(path,r.file,{upsert:true});
        if(up.error)throw up.error;
        await supabase.from("renewal_docs").update({storage_path:path}).eq("id",nid);
      }
      const old=await supabase.from("renewal_docs").update({active:false,notes:(o.notes||"")+" · جُدِّدت بتاريخ "+todayISO()+" → "+nid}).eq("id",o.id);
      if(old.error)throw old.error;
      setRen(null);note(true,"تم تجديد «"+o.doc_type+" — "+o.subject+"» حتى "+fmtD(r.end_date));await load();
    }catch(e){note(false,"تعذّر التجديد: "+(e.message||e));}
    setBusy(false);
  };

  const save=async()=>{
    if(!form.subject.trim()){note(false,"أدخل موضوع الوثيقة (اللوحة/الاسم)");return;}
    setBusy(true);note(false,"");
    const row={operator_id:(opId&&opId!=="all")?opId:null,doc_type:form.doc_type,title:form.title||null,subject:form.subject.trim(),subject_kind:form.subject_kind||null,employee_id:form.employee_id||null,vehicle_id:form.vehicle_id||null,provider:form.provider||null,ref_no:form.ref_no||null,start_date:form.start_date||null,end_date:form.end_date||null,notes:form.notes||null,active:form.active!==false};
    try{
      if(form.id)await supabase.from("renewal_docs").update(row).eq("id",form.id);
      else await supabase.from("renewal_docs").insert(row);
      setForm(null);note(true,"تم الحفظ");await load();
    }catch(e){note(false,"خطأ: "+(e.message||e));}
    setBusy(false);
  };
  const del=async(d)=>{if(!confirm("حذف وثيقة «"+d.subject+"»؟"))return;if(d.storage_path)await supabase.storage.from("legal-docs").remove([d.storage_path]);await supabase.from("renewal_docs").delete().eq("id",d.id);await load();};
  const edit=(d)=>setForm({...d});   // تعديل للتصحيح فقط — التجديد عبر openRenew

  // إبلاغ يدوي عبر واتساب للمالية والرئيس لاستكمال السداد/التجديد
  const notifyPay=(d)=>{
    const days=d._d;
    const msg="مطلوب استكمال إجراءات السداد/التجديد\n"+
      "الوثيقة: "+d.doc_type+" — "+d.subject+"\n"+
      (d.provider?"الجهة: "+d.provider+"\n":"")+
      (d.ref_no?"الرقم: "+d.ref_no+"\n":"")+
      "تاريخ الانتهاء: "+fmtD(d.end_date)+(days!=null?" ("+(days<0?"منتهية":days+" يوم")+")":"")+"\n\n"+
      "إلى: المالية والرئيس — يرجى اعتماد السداد وإكمال الإجراء.";
    window.open("https://wa.me/966566884419?text="+encodeURIComponent(msg),"_blank");
  };

  // ── مرفقات أصلية (دلو تخزين خاص legal-docs) ──
  const upload=async(file)=>{
    if(!file||!form.id)return;
    setBusy(true);note(false,"");
    try{
      const safe=file.name.replace(/[^\w.\-]+/g,"_");
      const path=form.id+"/"+Date.now()+"_"+safe;
      const{error}=await supabase.storage.from("legal-docs").upload(path,file,{upsert:true});
      if(error)throw error;
      if(form.storage_path)await supabase.storage.from("legal-docs").remove([form.storage_path]);
      await supabase.from("renewal_docs").update({storage_path:path}).eq("id",form.id);
      setForm({...form,storage_path:path});note(true,"تم إرفاق الملف الأصلي");await load();
    }catch(e){note(false,"تعذّر الرفع: "+(e.message||e));}
    setBusy(false);
  };
  const viewFile=async(path)=>{
    const{data,error}=await supabase.storage.from("legal-docs").createSignedUrl(path,120);
    if(error){note(false,"تعذّر فتح المرفق: "+error.message);return;}
    window.open(data.signedUrl,"_blank");
  };

  if(loading)return <div className="g-skel" style={{height:260}}/>;

  return(<div className="rn">
    <style>{CSS}</style>
    {msg&&msg.t&&<div className={"rn-msg "+(msg.ok?"ok":"err")}>{msg.t}</div>}

    <div className="rn-kpis">
      <K ic="doc" c="var(--p)" bg="var(--p-100)" t="وثائق مُتابَعة" v={kpis.total}/>
      <K ic="alert" c="var(--p-700)" bg="var(--p-100)" t="عاجلة (≤7 أو منتهية)" v={kpis.urgent}/>
      <K ic="xCircle" c="var(--bad-ink)" bg="var(--bad-bg)" t="منتهية" v={kpis.expired}/>
      <K ic="clock" c="var(--info-ink)" bg="var(--info-bg)" t="أقل أيام متبقية" v={kpis.min==null?"—":kpis.min}/>
      <K ic="checkCircle" c="var(--ok-ink)" bg="var(--ok-bg)" t="سارية (>30)" v={kpis.valid}/>
      <K ic="calendar" c="var(--info)" bg="var(--info-bg)" t="أقرب انتهاء" v={kpis.nearest?fmtD(kpis.nearest.end_date):"—"} small/>
    </div>

    <div className="rn-bar">
      <Tabs items={tabItems} value={stab} onChange={setStab}/>
      <div style={{flex:1}}/>
      <button className="g-btn" onClick={exportICS} title="ملف iCalendar لكل الوثائق السارية التي تنتهي خلال 120 يوماً"><Icon n="calendar" s={15}/> تصدير تقويم (.ics)</button>
    </div>
    <div className="rn-bar">
      <div className="rn-filters"><button className={filter==="all"?"on":""} onClick={()=>setFilter("all")}>الكل</button>{DOC_TYPES.map(t=><button key={t} className={filter===t?"on":""} onClick={()=>setFilter(t)}>{t}</button>)}</div>
      <button className="rn-add" onClick={()=>setForm({doc_type:"تأمين مركبة",title:"",subject:"",subject_kind:"مركبة",provider:"",ref_no:"",start_date:"",end_date:"",notes:"",active:true})}><Icon n="plus" s={15}/> وثيقة جديدة</button>
    </div>

    {shown.length===0?<div className="rn-empty"><div className="rn-empty-ic"><Icon n="doc" s={30}/></div><h3>لا وثائق{filter!=="all"?` من نوع «${filter}»`:""}{stab!=="all"?` في «${tabDef.ar}»`:""}</h3><p>أضف وثائق التأمين والاستمارات والرخص والإقامات لمتابعة صلاحيتها والتنبيه قبل انتهائها.</p></div>:
    <div className="rn-list">{shown.map(d=>{const b=band(d._d);return(
      <div className={"rn-item"+(flash===d.id?" flash":"")} key={d.id} ref={el=>{rowRefs.current[d.id]=el;}} style={{borderInlineStartColor:b.c}}>
        <div className="rn-ic" style={{background:b.bg,color:b.c}}><Icon n={TYPE_ICON[d.doc_type]||"doc"} s={16}/></div>
        <div style={{flex:1,minWidth:0}}>
          <div className="rn-name">{d.subject}<span className="rn-type">{d.doc_type}</span></div>
          <div className="rn-sub">{d.provider?`${d.provider} · `:""}{d.ref_no?`رقم ${d.ref_no} · `:""}تنتهي {fmtD(d.end_date)}</div>
        </div>
        <div className="rn-daysbox">
          <span className="rn-days" style={{color:b.c}}>{d._d==null?"—":d._d<0?`${Math.abs(d._d)}-`:d._d}</span>
          <small>{d._d==null?"":"يوم"}</small>
        </div>
        <Badge tone={b.tone} dot className="rn-band">{dayText(d._d)}</Badge>
        <div className="rn-act"><button className="wa" onClick={()=>notifyPay(d)} title="إبلاغ المالية والرئيس عبر واتساب للسداد/التجديد"><Icon n="phone" s={13}/></button>{d.storage_path&&<button className="att" onClick={()=>viewFile(d.storage_path)} title="عرض المرفق الأصلي"><Icon n="eye" s={13}/></button>}{(()=>{const e=d.subject_kind==="شخص"&&empOf(d.employee_id);return e&&e.mobile?<button className="wa" onClick={()=>bikerWa(d)} title="رسالة للبايكر (عربي + বাংলা)"><Icon n="send" s={13}/></button>:null;})()}<button className="ren" onClick={()=>openRenew(d)} title="تجديد — وثيقة جديدة وإيقاف الحالية"><Icon n="refresh" s={13}/> تجديد</button><button onClick={()=>edit(d)} title="تعديل للتصحيح"><Icon n="edit" s={13}/></button><button className="del" onClick={()=>del(d)} title="حذف"><Icon n="trash" s={13}/></button></div>
      </div>);})}</div>}

    <div className="rn-legend">
      {[["منتهية أو ≤7 أيام","bad"],["≤14 يوماً","warn"],["≤30 يوماً","info"],["سارية: أكثر من 30","ok"]].map(([t,tone])=><Badge key={t} tone={tone} dot>{t}</Badge>)}
    </div>

    {form&&<div className="rn-modal" onClick={e=>{if(e.target.className==="rn-modal")setForm(null);}}>
      <div className="rn-sheet">
        <div className="rn-sheet-h"><b>{form.id?"تعديل وثيقة (تصحيح)":"وثيقة جديدة"}</b><button onClick={()=>setForm(null)}><Icon n="x" s={16}/></button></div>
        <div className="rn-g2"><F l="نوع الوثيقة"><select value={form.doc_type} onChange={e=>setForm({...form,doc_type:e.target.value})}>{DOC_TYPES.map(t=><option key={t}>{t}</option>)}</select></F><F l="نوع الموضوع"><select value={form.subject_kind} onChange={e=>setForm({...form,subject_kind:e.target.value})}><option value="مركبة">مركبة</option><option value="شخص">شخص</option><option value="مؤسسة">مؤسسة</option></select></F></div>
        {form.subject_kind==="شخص"&&<F l="الموظف المرتبط"><select value={form.employee_id||""} onChange={e=>{const id=e.target.value;const emp=emps.find(x=>x.id===id);setForm({...form,employee_id:id||null,subject:emp?emp.full_name:form.subject});}}><option value="">— اختر موظفاً —</option>{emps.map(x=><option key={x.id} value={x.id}>{x.full_name}{x.employee_id?" ("+x.employee_id+")":""}</option>)}</select></F>}
        {form.subject_kind==="مركبة"&&<F l="المركبة المرتبطة"><select value={form.vehicle_id||""} onChange={e=>{const id=e.target.value;const v=veh.find(x=>x.id===id);setForm({...form,vehicle_id:id||null,subject:v?(v.plate+(v.plate_en&&v.plate_en!=="—"?" / "+v.plate_en:"")):form.subject});}}><option value="">— اختر مركبة —</option>{veh.map(x=><option key={x.id} value={x.id}>{x.plate}</option>)}</select></F>}
        <F l="الموضوع (اللوحة / الاسم)"><input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="مثال: 5532 ق ب / سلمان المالكي"/></F>
        <F l="العنوان"><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="تأمين المسؤولية تجاه الغير"/></F>
        <div className="rn-g2"><F l="الجهة المُصدِرة"><input value={form.provider} onChange={e=>setForm({...form,provider:e.target.value})} placeholder="التعاونية للتأمين"/></F><F l="رقم الوثيقة"><input value={form.ref_no} onChange={e=>setForm({...form,ref_no:e.target.value})}/></F></div>
        <div className="rn-g2"><F l="تاريخ البداية"><input type="date" value={form.start_date||""} onChange={e=>setForm({...form,start_date:e.target.value})}/></F><F l="تاريخ النهاية"><input type="date" value={form.end_date||""} onChange={e=>setForm({...form,end_date:e.target.value})}/></F></div>
        {form.end_date&&<div className="rn-preview" style={{background:band(daysLeft(form.end_date)).bg,color:band(daysLeft(form.end_date)).c}}><Icon n="clock" s={13}/> {band(daysLeft(form.end_date)).ar} — {dayText(daysLeft(form.end_date))}</div>}
        <F l="ملاحظات"><textarea rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="VIN، تسلسلي، تفاصيل…"/></F>
        <div className="rn-attach">
          <div className="rn-attach-h"><Icon n="doc" s={14}/> المرفق الأصلي (تخزين خاص مؤمّن)</div>
          {!form.id?<div className="rn-attach-hint">احفظ الوثيقة أولاً ثم أرفق ملفها الأصلي.</div>:
          <div className="rn-attach-row">
            {form.storage_path&&<button type="button" className="rn-b ghost" onClick={()=>viewFile(form.storage_path)}><Icon n="eye" s={13}/> عرض الحالي</button>}
            <label className="rn-b ghost" style={{cursor:"pointer"}}><Icon n="save" s={13}/> {form.storage_path?"استبدال الملف":"إرفاق ملف"}<input type="file" accept="image/*,application/pdf" style={{display:"none"}} onChange={e=>upload(e.target.files&&e.target.files[0])}/></label>
          </div>}
        </div>
        <div className="rn-mact"><button className="rn-b brand" onClick={save} disabled={busy}><Icon n="save" s={14}/> حفظ</button>{form.id&&<button className="rn-b danger" onClick={()=>del(form)}><Icon n="trash" s={14}/> حذف</button>}<div style={{flex:1}}/><button className="rn-b ghost" onClick={()=>setForm(null)}>إلغاء</button></div>
      </div>
    </div>}
    <Modal open={!!ren} onClose={()=>!busy&&setRen(null)} title="تجديد وثيقة" sub={ren?ren.old.doc_type+" — "+ren.old.subject+" · تنتهي "+fmtD(ren.old.end_date):""}
      foot={<><button className="g-btn ghost" onClick={()=>setRen(null)} disabled={busy}>إلغاء</button><button className="g-btn primary" onClick={saveRenew} disabled={busy}><Icon n="refresh" s={14}/> {busy?"جارٍ الحفظ…":"حفظ التجديد"}</button></>}>
      {ren&&<>
        <div className="rn-g2"><F l="تاريخ البداية الجديد"><input type="date" value={ren.start_date||""} onChange={e=>setRen({...ren,start_date:e.target.value})}/></F><F l="تاريخ النهاية الجديد *"><input type="date" value={ren.end_date} onChange={e=>setRen({...ren,end_date:e.target.value})}/></F></div>
        {ren.end_date&&(()=>{const b=band(daysLeft(ren.end_date));return<div className="rn-preview" style={{background:b.bg,color:b.c}}><Icon n="clock" s={13}/> {dayText(daysLeft(ren.end_date))}</div>;})()}
        <div className="rn-g2"><F l="الجهة المُصدِرة / المزوّد"><input value={ren.provider} onChange={e=>setRen({...ren,provider:e.target.value})}/></F><F l="رقم المرجع الجديد"><input value={ren.ref_no} onChange={e=>setRen({...ren,ref_no:e.target.value})}/></F></div>
        <F l="التكلفة (اختياري) ﷼"><input type="number" inputMode="decimal" min="0" value={ren.cost} onChange={e=>setRen({...ren,cost:e.target.value})}/></F>
        <F l="ملف الوثيقة الجديدة (اختياري)"><input type="file" accept="image/*,application/pdf" onChange={e=>setRen({...ren,file:e.target.files&&e.target.files[0]||null})}/></F>
        <p className="rn-hint">يُنشأ سجلّ جديد بنفس النوع والموضوع والروابط، وتُوقَف الوثيقة الحالية مع ملاحظة تربطها بالجديدة.</p>
      </>}
    </Modal>
  </div>);
}

function K({ic,c,bg,t,v,small}){return(<div className="rn-kpi"><span className="rn-ki" style={{background:bg,color:c}}><Icon n={ic} s={16}/></span><div style={{minWidth:0}}><div className={"rn-kv"+(small?" sm":"")}>{v}</div><div className="rn-kl">{t}</div></div></div>);}
function F({l,children}){return(<label className="rn-f"><span>{l}</span>{children}</label>);}

const CSS=`
.rn{--b:var(--p)}
.rn-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:12px}
.rn-msg.ok{background:var(--ok-bg);color:var(--ok-ink)}.rn-msg.err{background:var(--bad-bg);color:var(--bad-ink)}
.rn-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:11px;margin-bottom:14px}
.rn-kpi{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:14px;padding:12px;display:flex;align-items:center;gap:10px;box-shadow:var(--shadow)}
.rn-ki{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none}
.rn-kv{font-size:19px;font-weight:800;letter-spacing:-.5px}.rn-kv.sm{font-size:13px}.rn-kl{font-size:10.5px;color:var(--mut);font-weight:600;line-height:1.3}
.rn-bar{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.rn-filters{display:flex;gap:6px;flex-wrap:wrap;flex:1}
.rn-filters button{background:var(--glass-2);border:1px solid var(--line-2);border-radius:20px;padding:5px 12px;font-family:inherit;font-size:11.5px;font-weight:700;color:var(--mut);cursor:pointer}
.rn-filters button.on{background:var(--ink);border-color:var(--line-2);color:var(--bg)}
.rn-add{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,var(--p),var(--a));border:none;border-radius:11px;padding:9px 15px;color:#fff;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;flex:none}
.rn-list{display:flex;flex-direction:column;gap:9px}
.rn-item{display:flex;align-items:center;gap:12px;background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-inline-start:4px solid;border-radius:14px;padding:11px 14px;box-shadow:var(--shadow)}
.rn-ic{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.rn-name{font-size:13.5px;font-weight:800;color:var(--ink);display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.rn-type{font-size:10px;font-weight:800;background:var(--soft);color:var(--mut);padding:1px 8px;border-radius:20px}
.rn-sub{font-size:11px;color:var(--mut-2);margin-top:2px}
.rn-daysbox{text-align:center;flex:none;min-width:44px}
.rn-days{font-size:18px;font-weight:800;letter-spacing:-.5px}.rn-daysbox small{display:block;font-size:9px;color:var(--mut-2)}
.rn-band{flex:none}
.rn-act{display:flex;gap:6px;flex:none;align-items:center}
.rn-act button.ren{width:auto;padding:0 10px;gap:5px;font-family:inherit;font-size:11.5px;font-weight:800;color:var(--p-ink);background:var(--p-50);border-color:rgba(var(--p-rgb),.35)}
.rn-item.flash{animation:rn-flash 2s var(--ease)}
@keyframes rn-flash{0%,50%{box-shadow:0 0 0 3px rgba(var(--p-rgb),.55),var(--shadow);background:var(--p-50)}100%{box-shadow:var(--shadow)}}
.rn-hint{font-size:11.5px;color:var(--mut);margin:4px 0 0;line-height:1.6}
.rn-bar .g-tabs{max-width:100%}
@media(max-width:640px){.rn-item{flex-wrap:wrap}.rn-act{width:100%;justify-content:flex-end}}
.rn-act button{border:1px solid var(--line-2);background:var(--glass-2);width:30px;height:30px;border-radius:9px;cursor:pointer;color:var(--mut);display:flex;align-items:center;justify-content:center}
.rn-act button.del{color:var(--bad-ink);background:var(--bad-bg);border-color:color-mix(in srgb,var(--bad) 35%,transparent)}
.rn-act button.att{color:var(--info-ink);background:var(--info-bg);border-color:color-mix(in srgb,var(--info) 35%,transparent)}
.rn-act button.wa{color:var(--ok-ink);background:var(--ok-bg);border-color:color-mix(in srgb,var(--ok) 35%,transparent)}
.rn-attach{border:1px dashed var(--line);border-radius:12px;padding:11px 12px;margin-bottom:10px;background:var(--soft)}
.rn-attach-h{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800;color:var(--ink-2);margin-bottom:8px}
.rn-attach-hint{font-size:11.5px;color:var(--mut-2)}
.rn-attach-row{display:flex;gap:8px;flex-wrap:wrap}
.rn-legend{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.rn-lg{font-size:10.5px;font-weight:800;padding:3px 11px;border-radius:20px}
.rn-empty{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px dashed var(--line);border-radius:16px;padding:38px 24px;text-align:center}
.rn-empty-ic{width:60px;height:60px;border-radius:16px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--p-100),var(--p-100));color:var(--b)}
.rn-empty h3{font-size:15px;margin:0 0 7px}.rn-empty p{color:var(--mut);font-size:12px;max-width:420px;margin:0 auto;line-height:1.7}
.rn-modal{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:flex-end;justify-content:center;z-index:100}
.rn-sheet{background:var(--glass-3);border-radius:20px 20px 0 0;padding:18px;width:100%;max-width:560px;max-height:92vh;overflow:auto}
@media(min-width:560px){.rn-modal{align-items:center}.rn-sheet{border-radius:18px}}
.rn-sheet-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.rn-sheet-h b{font-size:15px;font-weight:800}
.rn-sheet-h button{border:none;background:var(--soft);width:30px;height:30px;border-radius:9px;cursor:pointer;color:var(--mut);display:flex;align-items:center;justify-content:center}
.rn-f{display:flex;flex-direction:column;gap:5px;margin-bottom:10px}
.rn-f span{font-size:11px;color:var(--mut);font-weight:600}
.rn-f input,.rn-f select,.rn-f textarea{border:1px solid var(--line-2);border-radius:10px;padding:10px 12px;font-family:inherit;font-size:13px;outline:none;background:var(--glass-3);color:var(--ink)}
.rn-f input:focus,.rn-f select:focus,.rn-f textarea:focus{border-color:var(--b);box-shadow:var(--glow)}
.rn-g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.rn-preview{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800;border-radius:10px;padding:9px 11px;margin-bottom:10px}
.rn-mact{display:flex;gap:8px;align-items:center;margin-top:4px}
.rn-b{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:11px;border:none;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;background:var(--ink);color:var(--bg)}
.rn-b.brand{background:linear-gradient(135deg,var(--p),var(--a))}
.rn-b.ghost{background:var(--glass-2);border:1px solid var(--line-2);color:var(--ink-2)}
.rn-b.danger{background:var(--bad-bg);color:var(--bad-ink)}
@media(max-width:1000px){.rn-kpis{grid-template-columns:repeat(3,1fr)}}
@media(max-width:640px){.rn-kpis{grid-template-columns:repeat(2,1fr)}.rn-g2{grid-template-columns:1fr}}
`;
