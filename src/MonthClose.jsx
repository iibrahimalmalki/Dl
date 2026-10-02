// الإقفال الشهري — خمس خطوات. 1: استيراد ملفات سويتر (SSP) التسعة للشهر المختار فقط، بلا حذف إطلاقاً.
// 2: المطابقة مع كشف سويتر (MonthRecon.jsx) — تظهر عند وجود بيانات محفوظة للشهر.
// الخطوات 3–5 بطاقات «قريباً» تفتح الصفحات الحالية (التسوية · الرواتب).
import{useState,useEffect,useMemo,useRef}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import DataTable from"./DataTable";
import{useToast,Badge,EmptyState}from"./ui";
import{KINDS,KIND_AR,detectKind,readSheet,buildMonth}from"./sspImport";
import MonthRecon,{DECISIONS}from"./MonthRecon";

const MAR=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const periodAr=p=>{const[y,m]=String(p||"").split("-");return(MAR[+m-1]||m||"")+" "+(y||"");};
const prevMonth=()=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");};
const STEPS=[{n:1,t:"الملفات"},{n:2,t:"المطابقة"},{n:3,t:"التسوية",nav:"settlement"},{n:4,t:"الرواتب",nav:"payroll"},{n:5,t:"القفل"}];
const BLOCK=["no_bookings","empty_month","missing_cols"];
const chunk=(a,n)=>{const o=[];for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n));return o;};
const fmtT=s=>s?new Date(s).toLocaleString("en-GB",{dateStyle:"short",timeStyle:"short"}):"—";

export default function MonthClose({opId,ops=[],onOp,me,owner,onNav}){
  const toast=useToast();
  const[period,setPeriod]=useState(prevMonth());
  const[files,setFiles]=useState([]);            // [{id,filename,kind,rows,headers}]
  const[reading,setReading]=useState(false);const[drag,setDrag]=useState(false);
  const[emps,setEmps]=useState({});               // employee_id → id
  const[saved,setSaved]=useState(0);              // صفوف ops_biker_month للشهر والمشغّل
  const[uploads,setUploads]=useState([]);
  const[existing,setExisting]=useState(null);     // Set(booking_ref) من ops_tickets
  const[confirmTmp,setConfirmTmp]=useState(false);const[saving,setSaving]=useState(false);
  const[recon,setRecon]=useState(null);           // حالة الخطوة 2 من MonthRecon
  const seq=useRef(0);const single=opId&&opId!=="all";

  const loadStatus=async()=>{
    if(!single){setSaved(0);setUploads([]);return;}
    const[{count},{data:up}]=await Promise.all([
      supabase.from("ops_biker_month").select("sweater_id",{count:"exact",head:true}).eq("operator_id",opId).eq("period",period),
      supabase.from("report_uploads").select("kind,filename,rows,uploaded_at").eq("operator_id",opId).eq("period",period).order("uploaded_at",{ascending:false}).limit(30),
    ]);
    setSaved(count||0);setUploads(up||[]);
  };
  useEffect(()=>{loadStatus();setConfirmTmp(false);setRecon(null);/*eslint-disable-next-line*/},[period,opId]);
  useEffect(()=>{(async()=>{const{data}=await supabase.from("employees").select("id,employee_id").not("employee_id","is",null);
    const m={};(data||[]).forEach(e=>{m[String(e.employee_id).trim()]=e.id;});setEmps(m);})();},[]);

  const addFiles=async list=>{
    const arr=[...(list||[])].filter(f=>/\.(csv|xlsx|xls)$/i.test(f.name));if(!arr.length)return;
    setReading(true);const out=[];
    for(const f of arr){try{const{rows,headers}=readSheet(await f.arrayBuffer());out.push({id:++seq.current,filename:f.name,kind:detectKind(f.name,headers),rows,headers});}
      catch(e){toast.bad("تعذّرت قراءة "+f.name,String(e.message||e));}}
    // نفس الاسم يستبدل القديم
    setFiles(p=>[...p.filter(x=>!out.some(o=>o.filename===x.filename)),...out]);setReading(false);setConfirmTmp(false);
  };
  const setKind=(id,kind)=>setFiles(p=>p.map(f=>f.id===id?{...f,kind:kind||null}:f));
  const drop=id=>setFiles(p=>p.filter(f=>f.id!==id));

  const built=useMemo(()=>files.length?buildMonth(files.map(f=>({kind:f.kind,filename:f.filename,rows:f.rows})),period):null,[files,period]);
  const refsKey=built?built.tickets.map(t=>t.booking_ref).filter(Boolean).sort().join(","):"";
  useEffect(()=>{let live=true;setExisting(null);if(!refsKey)return;(async()=>{
    const s=new Set();for(const c of chunk(refsKey.split(","),150)){const{data,error}=await supabase.from("ops_tickets").select("booking_ref").in("booking_ref",c);if(error)return;(data||[]).forEach(r=>s.add(String(r.booking_ref)));}
    if(live)setExisting(s);})();return()=>{live=false;};},[refsKey]);

  const bikers=useMemo(()=>(built?built.bikers:[]).map(b=>({...b,emp:b.sweater_id?emps[String(b.sweater_id).trim()]||null:null})),[built,emps]);
  const blocked=!built||built.warnings.some(w=>BLOCK.includes(w.code));
  const incomplete=built&&built.warnings.some(w=>w.code==="incomplete");
  const newTickets=built&&existing?built.tickets.filter(t=>!existing.has(String(t.booking_ref))).length:null;

  const save=async()=>{
    if(!single||blocked||(incomplete&&!confirmTmp)||saving)return;
    setSaving(true);const now=new Date().toISOString();
    const fail=(table,error)=>{toast.bad(`تعذّر الحفظ في ${table}`,error.message||String(error),0);setSaving(false);};
    try{
      // 1) ops_biker_month — بلا approved_complaints/complaint_pct لتبقى قيمتهما
      const bm=bikers.filter(b=>b.sweater_id).map(b=>({operator_id:opId,period,sweater_id:b.sweater_id,employee_id:b.emp,biker_name:b.biker_name,
        net_washes:b.net_washes,collect_payment:b.collect_payment,cancel_client:b.cancel_client,cancel_admin:b.cancel_admin,rating:b.rating,daily:b.daily,updated_at:now}));
      if(bm.length){const{error}=await supabase.from("ops_biker_month").upsert(bm,{onConflict:"operator_id,period,sweater_id"});if(error)return fail("ops_biker_month",error);}
      // 2) ops_daily
      if(built.daily.length){const{error}=await supabase.from("ops_daily").upsert(built.daily,{onConflict:"day"});if(error)return fail("ops_daily",error);}
      // 3) sweater_adjustments — الموجود يبقى كما هو
      if(built.adjustments.length){const{error}=await supabase.from("sweater_adjustments").upsert(built.adjustments.map(a=>({...a,operator_id:opId})),{onConflict:"booking_ref,kind",ignoreDuplicates:true});if(error)return fail("sweater_adjustments",error);}
      // 4) ops_tickets — إدخال الجديد فقط، وللموجود تعبئة sub_category/compensation إن كانتا فارغتين
      let ins=0,upd=0;
      if(built.tickets.length){
        const refs=[...new Set(built.tickets.map(t=>t.booking_ref).filter(Boolean))];const have={};
        for(const c of chunk(refs,150)){const{data,error}=await supabase.from("ops_tickets").select("id,booking_ref,sub_category,compensation").in("booking_ref",c);if(error)return fail("ops_tickets",error);(data||[]).forEach(r=>{(have[String(r.booking_ref)]=have[String(r.booking_ref)]||[]).push(r);});}
        const fresh=built.tickets.filter(t=>!t.booking_ref||!have[String(t.booking_ref)]).map(t=>({operator_id:opId,period,booking_ref:t.booking_ref||"",sweater_id:t.sweater_id||"",biker_name:t.biker_name||"",
          ticket_date:t.ticket_date||"",description:t.description||"",sub_category:t.sub_category,compensation:t.compensation,decision:"pending",status:"pending_review",has_image:false}));
        if(fresh.length){const{error}=await supabase.from("ops_tickets").insert(fresh);if(error)return fail("ops_tickets",error);ins=fresh.length;}
        for(const t of built.tickets){for(const r of have[String(t.booking_ref)]||[]){const patch={};
          if(r.sub_category==null&&t.sub_category!=null)patch.sub_category=t.sub_category;if(r.compensation==null&&t.compensation!=null)patch.compensation=t.compensation;
          if(Object.keys(patch).length){const{error}=await supabase.from("ops_tickets").update(patch).eq("id",r.id);if(error)return fail("ops_tickets",error);upd++;}}}
      }
      // 5) report_uploads — صف لكل ملف
      const ups=files.filter(f=>f.kind).map(f=>({operator_id:opId,period,kind:f.kind,filename:f.filename,rows:f.rows.length,uploaded_at:now}));
      if(ups.length){const{error}=await supabase.from("report_uploads").insert(ups);if(error)return fail("report_uploads",error);}
      toast.ok(`حُفظت بيانات ${periodAr(period)}${incomplete?" (مؤقت)":""}`,`${bm.length} بايكر · ${built.daily.length} يوم · ${built.adjustments.length} تعديل · ${ins} تذكرة جديدة${upd?` · ${upd} محدّثة`:""}`,8000);
      setFiles([]);setConfirmTmp(false);await loadStatus();
    }catch(e){toast.bad("خطأ أثناء الحفظ",String(e.message||e),0);}
    setSaving(false);
  };

  const byKind=k=>files.filter(f=>f.kind===k);
  const unknown=files.filter(f=>!f.kind);
  const s=built&&built.summary;

  return(<div className="mc">
    <style>{CSS}</style>
    <div className="g-card pad mc-top">
      <div className="g-row">
        <label className="mc-month"><Icon n="calendar" s={16}/><span className="g-sr">الشهر</span><input className="g-input" type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></label>
        <b className="mc-pl">{periodAr(period)}</b>
      </div>
      <ol className="mc-steps" aria-label="خطوات الإقفال">
        {STEPS.map(st=>{
          const done=st.n===1?saved>0:st.n===2?!!(recon&&recon.saved):false;
          const badge=st.n===1?<Badge tone={done?"ok":"warn"}>{done?"مكتملة":"بانتظار الرفع"}</Badge>
            :st.n===2?(done?<Badge tone="ok">مكتملة · {DECISIONS[recon.decision]||recon.decision}</Badge>:saved>0?<Badge tone="warn">بانتظار المطابقة</Badge>:<Badge>بعد الملفات</Badge>)
            :<Badge>قريباً</Badge>;
          return<li key={st.n} className={(st.n<=2?"on ":"soon ")+(done?"done":"")}>
          <span className="mc-sn">{done?<Icon n="check" s={14}/>:st.n}</span><span>{st.t}</span>{badge}</li>;})}
      </ol>
    </div>

    {!single?<div className="g-card"><EmptyState variant="stack" title="اختر المشغّل" text="الإقفال الشهري يُحفظ لمشغّل واحد؛ اختره هنا ثم ارفع ملفات سويتر.">
      {onOp&&ops.length>0&&<label className="mc-op"><span className="g-sr">المشغّل</span><select className="g-select" value="" onChange={e=>e.target.value&&onOp(e.target.value)}>
        <option value="">اختر المشغّل…</option>{ops.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
    </EmptyState></div>:<>

    <section className="g-card pad" aria-labelledby="mc-s1">
      <h3 id="mc-s1" className="mc-h"><span className="mc-sn">1</span> استيراد ملفات سويتر — {periodAr(period)} {saved>0&&<Badge tone="ok">محفوظ: {saved} بايكر</Badge>}</h3>
      <label className={"mc-drop"+(drag?" over":"")} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);addFiles(e.dataTransfer.files);}}>
        <input type="file" accept=".csv,.xlsx,.xls" multiple className="g-sr" onChange={e=>{addFiles(e.target.files);e.target.value="";}}/>
        <span className="mc-di"><Icon n="download" s={22}/></span>
        <b>{reading?"جارٍ القراءة…":"اسحب ملفات سويتر هنا أو اضغط للاختيار"}</b>
        <small>حتى 9 ملفات (‎_ssp__…‎ ‎.csv/.xlsx‎) — يُؤخذ شهر {periodAr(period)} فقط من كل ملف</small>
      </label>

      <ul className="mc-files">
        {KINDS.map(k=>{const fs=byKind(k);return<li key={k} className={fs.length?"have":""}>
          <span className={"mc-fi "+(fs.length?"ok":k==="bookings"?"bad":"")}><Icon n={fs.length?"check":k==="bookings"?"alert":"doc"} s={14}/></span>
          <div className="mc-fn"><b>{KIND_AR[k]}{k==="bookings"&&<Badge tone="brand">إلزامي</Badge>}{/_cum$/.test(k)&&<Badge>للعرض فقط</Badge>}</b>
            {fs.length?fs.map(f=><small key={f.id} dir="ltr">{f.filename} · {f.rows.length} rows <button className="g-btn ghost sm" onClick={()=>drop(f.id)} aria-label={"إزالة "+f.filename}><Icon n="x" s={12}/></button></small>)
              :<small className={k==="bookings"?"mc-bad":"g-mut"}>ناقص{k!=="bookings"&&!/_cum$/.test(k)?" — اختياري، لكن أرقامه ستكون صفراً":""}</small>}</div>
        </li>;})}
        {unknown.map(f=><li key={f.id} className="unk"><span className="mc-fi bad"><Icon n="alert" s={14}/></span>
          <div className="mc-fn"><b dir="ltr">{f.filename}</b><small>ملف غير معروف — حدّد نوعه أو أزله</small></div>
          <select className="g-select" value="" onChange={e=>setKind(f.id,e.target.value)} aria-label={"نوع "+f.filename}><option value="">النوع…</option>{KINDS.map(k=><option key={k} value={k}>{KIND_AR[k]}</option>)}</select>
          <button className="g-btn ghost sm" onClick={()=>drop(f.id)} aria-label={"إزالة "+f.filename}><Icon n="x" s={13}/></button></li>)}
      </ul>

      {built&&<>
        {built.warnings.length>0&&<div className="mc-warn" role="status">{built.warnings.map((w,i)=><Badge key={i} tone={BLOCK.includes(w.code)?"bad":"warn"}>{w.ar}</Badge>)}</div>}

        {s&&<div className="mc-sum">
          <div className="mc-eq" aria-label="الصافي المتوقع">
            <span><b>{s.online}</b><small>أونلاين</small></span><i>+</i>
            <span><b>{s.add}</b><small>إضافات (إلغاء عميل)</small></span><i>−</i>
            <span><b>{s.deduct}</b><small>خصم بايكر</small></span><i>−</i>
            <span><b>{s.maintenance}</b><small>صيانة</small></span><i>−</i>
            <span><b>{s.freeWash}</b><small>تعويض غسلة مجانية</small></span><i>=</i>
            <span className="tot"><b>{s.expectedNet}</b><small>الصافي المتوقع</small></span>
          </div>
          <div className="g-row mc-meta">
            <Badge tone="info">التذاكر: {built.tickets.length}{newTickets!=null?` · جديدة ${newTickets}`:""}</Badge>
            {s.otherComp>0&&<Badge>تعويضات مالية: {s.otherComp} ر</Badge>}
            {built.coverage.min&&<Badge>التغطية: <span dir="ltr">{built.coverage.min} → {built.coverage.max}</span></Badge>}
            {built.coverage.exportDate&&<Badge>تاريخ التصدير: <span dir="ltr">{built.coverage.exportDate}</span></Badge>}
          </div>
        </div>}

        {bikers.length>0&&<DataTable caption="معاينة البايكرز" rows={bikers} rowKey={b=>b.sweater_id||b.biker_name} pageSize={20} initialSort={{k:"net",dir:-1}}
          columns={[
            {k:"name",label:"البايكر",value:b=>b.biker_name,search:true,render:b=><span className="mc-bk"><b>{b.biker_name||"—"}</b><small dir="ltr">#{b.sweater_id||"—"}</small></span>},
            {k:"net",label:"غسلات",num:true,value:b=>b.net_washes,render:b=><b>{b.net_washes}</b>},
            {k:"cc",label:"إلغاء عميل",num:true,value:b=>b.cancel_client},
            {k:"ca",label:"إلغاء إدارة",num:true,value:b=>b.cancel_admin},
            {k:"rt",label:"تقييم",num:true,value:b=>b.rating,render:b=>b.rating!=null?b.rating.toFixed(2):"—"},
            {k:"days",label:"أيام عمل",num:true,value:b=>b.days,hideSm:true},
            {k:"link",label:"الربط بموظف",sortable:false,render:b=>!b.sweater_id?<Badge tone="bad">بلا رقم — لن يُحفظ</Badge>:b.emp?<Badge tone="ok">مرتبط</Badge>:<Badge tone="warn">غير مرتبط</Badge>},
          ]}/>}

        <div className="mc-act">
          {incomplete&&<label className="mc-cf"><input type="checkbox" checked={confirmTmp} onChange={e=>setConfirmTmp(e.target.checked)}/> الشهر غير مكتمل — حفظ مؤقت</label>}
          <button className="g-btn primary" onClick={save} disabled={saving||blocked||(incomplete&&!confirmTmp)}><Icon n="save" s={15}/> {saving?"جارٍ الحفظ…":"حفظ بيانات الشهر"}</button>
          {blocked&&<small className="mc-bad">الحفظ معطّل حتى تُعالج التحذيرات الحمراء</small>}
        </div>
      </>}

      <div className="mc-last">
        <h4>آخر رفع — {periodAr(period)}</h4>
        {uploads.length?<div className="g-twrap"><table className="g-tbl"><thead><tr><th scope="col">الملف</th><th scope="col">النوع</th><th scope="col" className="num">الصفوف</th><th scope="col">الوقت</th></tr></thead>
          <tbody>{uploads.map((u,i)=><tr key={i}><td dir="ltr" className="mc-tf">{u.filename}</td><td>{KIND_AR[u.kind]||u.kind}</td><td className="num">{u.rows}</td><td dir="ltr">{fmtT(u.uploaded_at)}</td></tr>)}</tbody></table></div>
          :<EmptyState compact variant="ring" title="لا رفع مسجّل لهذا الشهر" text="بعد الحفظ يظهر هنا كل ملف رُفع مع عدد صفوفه ووقته."/>}
      </div>
    </section>

    {saved>0&&<MonthRecon period={period} opId={opId} me={me} owner={owner} reloadKey={(uploads[0]&&uploads[0].uploaded_at)||saved} onStatus={setRecon}/>}

    <div className="mc-next">
      {STEPS.slice(2).map(st=><div key={st.n} className="g-card pad mc-soon">
        <div className="g-row"><span className="mc-sn">{st.n}</span><b>{st.t}</b><Badge>قريباً</Badge></div>
        <p className="g-mut">{st.nav?"تُدمج في الإقفال لاحقاً — استخدم الصفحة الحالية الآن.":"قفل الشهر بعد اكتمال الخطوات السابقة."}</p>
        {st.nav&&onNav&&<button className="g-btn sm" onClick={()=>onNav(st.nav)}><Icon n="fwd" s={13}/> افتح {st.t}</button>}
      </div>)}
    </div>
    </>}
  </div>);
}

const CSS=`
.mc{display:flex;flex-direction:column;gap:14px}
.mc-top{display:flex;flex-direction:column;gap:12px}
.mc-month{display:inline-flex;align-items:center;gap:8px;color:var(--mut)}.mc-month .g-input{width:auto;min-width:160px}
.mc-pl{font-size:15px;color:var(--ink)}
.mc-op{display:block;margin:14px auto 0;max-width:280px}
.mc-steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.mc-steps li{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:10px 12px;border-radius:14px;border:1px solid var(--line);background:var(--glass-2);font-weight:600;font-size:13px;color:var(--mut)}
.mc-steps li.on{border-color:rgba(var(--p-rgb),.4);color:var(--ink)}
.mc-steps li.done .mc-sn{background:var(--ok-bg);color:var(--ok-ink)}
.mc-sn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9px;background:var(--p-100);color:var(--p-ink);font-weight:700;font-size:13px;flex:none}
.mc-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 12px;font-size:15px}
.mc-drop{display:flex;flex-direction:column;align-items:center;gap:6px;padding:26px 16px;border:2px dashed var(--line-2);border-radius:18px;background:var(--glass-2);cursor:pointer;text-align:center;transition:border-color .15s,background .15s}
.mc-drop:hover,.mc-drop.over{border-color:var(--p);background:var(--p-100)}
.mc-drop:focus-within{box-shadow:var(--glow)}
.mc-drop small{color:var(--mut);font-size:12px}
.mc-di{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:var(--p-100);color:var(--p-ink)}
.mc-files{list-style:none;margin:14px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}
.mc-files li{display:flex;align-items:flex-start;gap:10px;padding:9px 11px;border-radius:12px;border:1px solid var(--line);background:var(--glass-2)}
.mc-files li.have{border-color:color-mix(in srgb,var(--ok-ink) 30%,transparent)}
.mc-files li.unk{grid-column:1/-1;align-items:center;border-color:color-mix(in srgb,var(--bad-ink) 30%,transparent)}
.mc-files li.unk{flex-wrap:wrap}.mc-files li.unk .mc-fn{flex:1 1 180px}.mc-files li.unk .g-select{width:auto;flex:0 1 220px;min-width:150px}
.mc-fi{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--soft);color:var(--mut);flex:none}
.mc-fi.ok{background:var(--ok-bg);color:var(--ok-ink)}.mc-fi.bad{background:var(--bad-bg);color:var(--bad-ink)}
.mc-fn{min-width:0;display:flex;flex-direction:column;gap:2px}
.mc-fn b{font-size:13px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.mc-fn small{font-size:11.5px;color:var(--mut);word-break:break-all;display:flex;align-items:center;gap:4px;justify-content:flex-end}
.mc-fn small.g-mut,.mc-fn small.mc-bad{justify-content:flex-start}
.mc-bad{color:var(--bad-ink)!important}
.mc-warn{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 0}.mc-warn .g-badge{white-space:normal;line-height:1.6;text-align:start}
.mc-sum{margin:14px 0;padding:14px;border-radius:16px;border:1px solid var(--line);background:var(--glass-3)}
.mc-eq{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mc-eq span{display:flex;flex-direction:column;align-items:center;min-width:72px;padding:6px 8px;border-radius:12px;background:var(--glass-2)}
.mc-eq span b{font-size:20px;font-variant-numeric:tabular-nums}.mc-eq span small{font-size:11px;color:var(--mut);text-align:center}
.mc-eq span.tot{background:var(--p-100)}.mc-eq span.tot b{color:var(--p-ink)}
.mc-eq i{font-style:normal;font-weight:700;color:var(--mut)}
.mc-meta{margin-top:10px}
.mc-bk{display:flex;flex-direction:column}.mc-bk small{color:var(--mut);font-size:11px}
.mc-act{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px}
.mc-cf{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;background:var(--warn-bg);color:var(--warn-ink);font-weight:600;font-size:13px;cursor:pointer}
.mc-cf input{width:18px;height:18px;accent-color:var(--p)}
.mc-last{margin-top:18px}.mc-last h4{margin:0 0 8px;font-size:13.5px}
.mc-tf{max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mc-next{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.mc-steps li.soon{opacity:.55}
.mc-soon{opacity:.8}
.mc-soon p{font-size:12.5px;margin:8px 0 10px;line-height:1.7}
@media(max-width:900px){.mc-next{grid-template-columns:1fr}.mc-steps{grid-template-columns:repeat(3,1fr)}}
@media(max-width:640px){.mc-pl{display:none}.mc-next{grid-template-columns:1fr}.mc-steps{grid-template-columns:1fr 1fr}.mc-eq span{min-width:60px}.mc-tf{max-width:150px}}
`;
