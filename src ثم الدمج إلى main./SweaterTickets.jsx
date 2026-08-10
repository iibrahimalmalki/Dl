import{useState,useEffect,useMemo,useCallback,useRef}from"react";
import{supabase,SUPA_URL,SUPA_ANON,compressImage,uploadTicketImage}from"./supabase";
import Icon from"./Icon";

const nowPeriod=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;};
const MON=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const periodLabel=p=>{const[y,m]=String(p).split("-");return`${MON[+m-1]||m} ${y}`;};
const publicUrl=path=>path?`${SUPA_URL}/storage/v1/object/public/sweater-tickets/${encodeURI(path)}`:null;

const STAGES={
  pending_review:{ar:"بانتظار المراجعة",color:"#b54708",bg:"#fef3e2"},
  reviewed:{ar:"بانتظار اعتمادك",color:"#175cd3",bg:"#eff6ff"},
  decided:{ar:"مُعتمدة القرار",color:"#475467",bg:"#f2f4f7"},
};
const DEC={
  approved:{ar:"معتمدة (تُحتسب على البايكر)",color:"#b42318",bg:"#feecea"},
  rejected:{ar:"مرفوضة (لا تُحتسب)",color:"#087443",bg:"#e7f7ef"},
};

export default function SweaterTickets({opId,me,owner}){
  const[period,setPeriod]=useState("2026-06");
  const[loading,setLoading]=useState(true);
  const[rows,setRows]=useState([]);
  const[filter,setFilter]=useState("all");
  const[canEdit,setCanEdit]=useState(!!owner);
  const[msg,setMsg]=useState(null);
  const[busy,setBusy]=useState({});   // id -> true
  const[draft,setDraft]=useState({}); // id -> {rec, notes}
  const[lightbox,setLightbox]=useState(null);
  const fileRef=useRef(null);const upTarget=useRef(null);

  const load=useCallback(async()=>{
    setLoading(true);setMsg(null);
    let q=supabase.from("ops_tickets").select("*").eq("period",period).order("ticket_date",{ascending:false});
    if(opId&&opId!=="all")q=q.eq("operator_id",opId);
    const{data,error}=await q;
    if(error)setMsg({ok:false,t:"تعذّر جلب الشكاوى: "+error.message});
    setRows(data||[]);setLoading(false);
  },[period,opId]);
  useEffect(()=>{load();},[load]);

  // صلاحية التحرير (مسؤول الجودة) — المالك يملك كل شيء
  useEffect(()=>{(async()=>{
    if(owner){setCanEdit(true);return;}
    const uid=me&&me.id;if(!uid){setCanEdit(false);return;}
    const{data}=await supabase.from("user_permissions").select("can_edit").eq("user_id",uid).eq("module","complaints").maybeSingle();
    setCanEdit(!!(data&&data.can_edit));
  })();},[me,owner]);

  // realtime
  useEffect(()=>{
    const ch=supabase.channel("ops_tickets_rt").on("postgres_changes",{event:"*",schema:"public",table:"ops_tickets"},()=>load()).subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[load]);

  const setB=(id,v)=>setBusy(p=>({...p,[id]:v}));

  const pullImage=async(t)=>{
    if(!t.sweater_pic_url){setMsg({ok:false,t:"لا يوجد رابط صورة من سويتر لهذه الشكوى"});return;}
    setB(t.id,true);setMsg(null);
    try{
      const{data}=await supabase.auth.getSession();const s=data&&data.session;
      if(!s||!s.access_token)throw new Error("انتهت الجلسة — سجّل الدخول من جديد");
      const path=`${t.period}/${t.booking_ref||t.id}.jpg`;
      const res=await fetch(`${SUPA_URL}/functions/v1/ticket-image-pull`,{method:"POST",headers:{Authorization:`Bearer ${s.access_token}`,apikey:SUPA_ANON,"Content-Type":"application/json"},body:JSON.stringify({url:t.sweater_pic_url,path,ticket_id:t.id})});
      let out=null;try{out=await res.json();}catch(_){}
      if(!res.ok||!out||!out.url)throw new Error((out&&out.message)||("HTTP "+res.status));
      const pics=[...(t.stored_pics||[]),out.path];
      await supabase.from("ops_tickets").update({stored_pics:pics}).eq("id",t.id);
      setRows(p=>p.map(r=>r.id===t.id?{...r,stored_pic_path:out.path,stored_pics:pics,has_image:true}:r));
      setMsg({ok:true,t:"تم سحب الصورة وتخزينها في نظامنا"});
    }catch(e){setMsg({ok:false,t:"تعذّر سحب الصورة: "+(e.message||e)});}
    setB(t.id,false);
  };

  // رفع يدوي: مسؤول الجودة ينزّل الصورة من سويتر ويرفعها هنا
  const pickImage=(t)=>{upTarget.current=t;if(fileRef.current){fileRef.current.value="";fileRef.current.click();}};
  const onFile=async(e)=>{
    const files=Array.from(e.target.files||[]);const t=upTarget.current;upTarget.current=null;
    if(!files.length||!t)return;
    setB(t.id,true);setMsg(null);
    try{
      const added=[];
      for(let i=0;i<files.length;i++){
        const c=await compressImage(files[i]);
        const path=`${t.period}/${t.booking_ref||t.id}-m${Date.now()}-${i}.jpg`;
        const out=await uploadTicketImage(path,c,null);
        added.push(out.path);
      }
      const pics=[...(t.stored_pics||[]),...added];
      const{data,error}=await supabase.from("ops_tickets").update({stored_pics:pics,stored_pic_path:t.stored_pic_path||pics[0],has_image:true,no_customer_image:false}).eq("id",t.id).select().single();
      if(error)throw error;
      setRows(p=>p.map(r=>r.id===t.id?data:r));
      setMsg({ok:true,t:`تم رفع ${added.length} صورة وربطها بالشكوى`});
    }catch(err){setMsg({ok:false,t:"تعذّر رفع الصور: "+(err.message||err)});}
    setB(t.id,false);
  };
  // حذف صورة من المعرض
  const removeImg=async(t,path)=>{
    setB(t.id,true);setMsg(null);
    try{
      const pics=(t.stored_pics||[]).filter(p=>p!==path);
      const{data,error}=await supabase.from("ops_tickets").update({stored_pics:pics,stored_pic_path:pics[0]||null,has_image:pics.length>0}).eq("id",t.id).select().single();
      if(error)throw error;
      setRows(p=>p.map(r=>r.id===t.id?data:r));
    }catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setB(t.id,false);
  };
  const openLb=(imgs,i)=>setLightbox({imgs,i:i||0});
  const lbNav=(dir)=>setLightbox(l=>l?{...l,i:(l.i+dir+l.imgs.length)%l.imgs.length}:l);
  // وسم: العميل لم يرفع صورة (نقطة جودة موثّقة)
  const toggleNoImage=async(t)=>{
    setB(t.id,true);setMsg(null);
    try{
      const{data,error}=await supabase.from("ops_tickets").update({no_customer_image:!t.no_customer_image}).eq("id",t.id).select().single();
      if(error)throw error;
      setRows(p=>p.map(r=>r.id===t.id?data:r));
    }catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setB(t.id,false);
  };

  const submitRec=async(t)=>{
    const d=draft[t.id]||{};
    if(!d.rec){setMsg({ok:false,t:"اختر التوصية: قبول أو رفض"});return;}
    setB(t.id,true);setMsg(null);
    try{
      const{data,error}=await supabase.from("ops_tickets").update({qc_recommendation:d.rec,qc_notes:d.notes||null}).eq("id",t.id).select().single();
      if(error)throw error;
      setRows(p=>p.map(r=>r.id===t.id?data:r));
      setDraft(p=>{const n={...p};delete n[t.id];return n;});
      setMsg({ok:true,t:"تم إرسال التوصية للاعتماد"});
    }catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setB(t.id,false);
  };

  const decide=async(t,decision)=>{
    setB(t.id,true);setMsg(null);
    try{
      const{data,error}=await supabase.from("ops_tickets").update({decision}).eq("id",t.id).select().single();
      if(error)throw error;
      setRows(p=>p.map(r=>r.id===t.id?data:r));
      setMsg({ok:true,t:decision==="approved"?"تم اعتماد الشكوى — ستُحتسب على البايكر في الرواتب":"تم رفض الشكوى — لن تُحتسب"});
    }catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setB(t.id,false);
  };

  const totals=useMemo(()=>({
    count:rows.length,
    pending:rows.filter(r=>r.status==="pending_review").length,
    reviewed:rows.filter(r=>r.status==="reviewed").length,
    approved:rows.filter(r=>r.decision==="approved").length,
  }),[rows]);

  const shown=useMemo(()=>{
    if(filter==="all")return rows;
    if(filter==="approved"||filter==="rejected")return rows.filter(r=>r.decision===filter);
    return rows.filter(r=>r.status===filter);
  },[rows,filter]);

  if(loading)return <div className="dw-skel" style={{height:280}}/>;

  return(<div className="st">
    <style>{CSS}</style>
    <div className="st-bar">
      <div className="st-month"><Icon n="calendar" s={16}/><input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></div>
      <div style={{flex:1}}/>
      <button className="st-refresh" onClick={load}><Icon n="refresh" s={14}/> تحديث</button>
    </div>
    {msg&&<div className={"st-msg "+(msg.ok?"ok":"err")}>{msg.t}</div>}

    <div className="st-kpis">
      <K ic="complaints" c="#475467" bg="#f2f4f7" t="شكاوى الشهر" v={totals.count}/>
      <K ic="clock" c="#b54708" bg="#fef3e2" t="بانتظار المراجعة" v={totals.pending}/>
      <K ic="eye" c="#175cd3" bg="#eff6ff" t="بانتظار اعتمادك" v={totals.reviewed}/>
      <K ic="alert" c="#b42318" bg="#feecea" t="معتمدة (تُحتسب)" v={totals.approved}/>
    </div>

    <div className="st-flow"><Icon n="alert" s={13}/> المسار: سويتر ← سحب الصورة ← مراجعة مسؤول الجودة وتوصيته ← اعتمادك أو رفضك (نهائي) ← احتساب في الرواتب.</div>

    <div className="st-filters">
      {[["all","الكل"],["pending_review","بانتظار المراجعة"],["reviewed","بانتظار الاعتماد"],["approved","معتمدة"],["rejected","مرفوضة"]].map(([k,l])=>
        <button key={k} className={"st-fb"+(filter===k?" on":"")} onClick={()=>setFilter(k)}>{l}</button>)}
    </div>

    {shown.length===0?<div className="st-empty"><div className="st-empty-ic"><Icon n="complaints" s={30}/></div><h3>لا شكاوى ضمن هذا التصنيف في {periodLabel(period)}</h3><p>تُستورد شكاوى العملاء من تقارير سويتر الشهرية. بعد الاستيراد يسحب مسؤول الجودة الصور ويكتب توصيته، ثم تظهر لك للاعتماد أو الرفض.</p></div>:
    shown.map(t=>{
      const stg=STAGES[t.status]||STAGES.pending_review;const dec=DEC[t.decision];const d=draft[t.id]||{};const b=!!busy[t.id];
      const stored=(t.stored_pics&&t.stored_pics.length)?t.stored_pics:(t.stored_pic_path?[t.stored_pic_path]:[]);
      const gallery=stored.map(publicUrl);
      if(t.sweater_pic_url&&!stored.length)gallery.push(t.sweater_pic_url);
      const img=gallery[0]||null;
      return(<div className="st-card" key={t.id} style={{borderInlineStartColor:dec?dec.color:stg.color}}>
        <div className="st-top">
          <div className="st-thumb" onClick={()=>gallery.length&&openLb(gallery,0)}>
            {img?<img src={img} alt="صورة الشكوى" loading="lazy"/>:<span className="st-noimg"><Icon n="image" s={20}/></span>}
            {stored.length>0&&<span className="st-saved" title="مخزّنة في نظامنا"><Icon n="check" s={10}/></span>}
            {gallery.length>1&&<span className="st-more">+{gallery.length-1}</span>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div className="st-h">{(t.sweater_ticket_no||t.ticket_no!=null)&&<span className="st-no">شكوى #{t.sweater_ticket_no||String(t.ticket_no).padStart(4,"0")}</span>}{t.sweater_decision&&<span className={"st-sw"+(t.sweater_decision==="report"?"":" hot")}>سويتر: {t.sweater_decision==="report"?"بلاغ":t.sweater_decision}</span>}<b>{t.sub_category||t.description||"شكوى عميل"}</b>{t.compensation&&<span className="st-comp">تعويض العميل: {t.compensation}</span>}{!img&&t.no_customer_image&&<span className="st-noimgtag"><Icon n="image" s={11}/> لا توجد صورة من العميل</span>}</div>
            <div className="st-sub"><span>{t.biker_name||"—"}{t.sweater_id?` · #${t.sweater_id}`:""}</span><span className="st-dot">·</span><span>{t.ticket_date||""}</span>{t.booking_ref&&<><span className="st-dot">·</span><span>حجز {t.booking_ref}</span></>}</div>
            {t.description&&t.sub_category&&<div className="st-desc">{t.description}</div>}
          </div>
          <span className="st-stage" style={{background:(dec||stg).bg,color:(dec||stg).color}}>{dec?dec.ar:stg.ar}</span>
        </div>

        {/* معرض صور الشكوى (يراه الجميع) */}
        {stored.length>0&&<div className="st-strip">
          {stored.map((p,gi)=>(<div className="st-sthumb" key={p}>
            <img src={publicUrl(p)} alt="صورة" loading="lazy" onClick={()=>openLb(stored.map(publicUrl),gi)}/>
            {canEdit&&<button className="st-del" title="حذف" onClick={()=>removeImg(t,p)} disabled={b}><Icon n="x" s={10}/></button>}
          </div>))}
        </div>}

        {/* إدارة صور الشكوى — سحب من سويتر أو رفع يدوي (عدة صور) أو توثيق عدم وجود صورة */}
        {canEdit&&<div className="st-imgrow">
          <span className="st-imglbl">صور الشكوى:</span>
          {t.sweater_pic_url&&!stored.length&&<button className="st-pull" onClick={()=>pullImage(t)} disabled={b}><Icon n="download" s={13}/> {b?"…":"سحب من سويتر"}</button>}
          <button className="st-upl" onClick={()=>pickImage(t)} disabled={b}><Icon n="image" s={13}/> {stored.length?"إضافة صور":"رفع صور يدوياً"}</button>
          {stored.length===0&&<button className={"st-noimgbtn"+(t.no_customer_image?" on":"")} onClick={()=>toggleNoImage(t)} disabled={b}><Icon n={t.no_customer_image?"check":"x"} s={13}/> {t.no_customer_image?"موثّق: لا صورة":"لا توجد صورة"}</button>}
        </div>}

        {/* توصية الجودة (إن وُجدت) */}
        {t.qc_recommendation&&<div className="st-qc">
          <span className={"st-qcrec "+t.qc_recommendation}><Icon n={t.qc_recommendation==="accept"?"check":"x"} s={12}/> توصية الجودة: {t.qc_recommendation==="accept"?"قبول الشكوى (مسؤولية البايكر)":"رفض الشكوى (غير مبررة)"}</span>
          {t.qc_notes&&<div className="st-qcnote">{t.qc_notes}</div>}
          {t.qc_at&&<div className="st-qcmeta">بتاريخ {new Date(t.qc_at).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>}
        </div>}

        {/* أدوات مسؤول الجودة — قبل المراجعة */}
        {canEdit&&t.status==="pending_review"&&<div className="st-panel">
          <div className="st-prow">
            <div className="st-rec">
              <button className={"st-recb accept"+(d.rec==="accept"?" on":"")} onClick={()=>setDraft(p=>({...p,[t.id]:{...d,rec:"accept"}}))}><Icon n="check" s={13}/> قبول</button>
              <button className={"st-recb reject"+(d.rec==="reject"?" on":"")} onClick={()=>setDraft(p=>({...p,[t.id]:{...d,rec:"reject"}}))}><Icon n="x" s={13}/> رفض</button>
            </div>
          </div>
          <textarea className="st-notes" value={d.notes||""} onChange={e=>setDraft(p=>({...p,[t.id]:{...d,notes:e.target.value}}))} placeholder="ملاحظات ودراسة الجودة (سبب التوصية، ما ظهر في الصورة، توصية للبايكر…)"/>
          <button className="st-submit" onClick={()=>submitRec(t)} disabled={b}><Icon n="send" s={14}/> {b?"جارٍ الإرسال…":"إرسال التوصية للاعتماد"}</button>
        </div>}

        {/* قرار المالك — بعد المراجعة */}
        {owner&&t.status==="reviewed"&&<div className="st-decide">
          <span className="st-decl">قرارك النهائي:</span>
          <button className="st-approve" onClick={()=>decide(t,"approved")} disabled={b}><Icon n="check" s={14}/> اعتماد (تُحتسب)</button>
          <button className="st-reject" onClick={()=>decide(t,"rejected")} disabled={b}><Icon n="x" s={14}/> رفض</button>
        </div>}
        {!owner&&t.status==="reviewed"&&<div className="st-wait"><Icon n="clock" s={12}/> بانتظار اعتماد المالك</div>}

        {t.decided_at&&<div className="st-decided"><Icon n="check" s={12}/> {t.decision==="approved"?"اعتمدها المالك":"رفضها المالك"} بتاريخ {new Date(t.decided_at).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>}
      </div>);})}

    {lightbox&&<div className="st-lb" onClick={()=>setLightbox(null)}>
      <img src={lightbox.imgs[lightbox.i]} alt="صورة الشكوى" onClick={e=>e.stopPropagation()}/>
      {lightbox.imgs.length>1&&<><button className="st-lbnav prev" onClick={e=>{e.stopPropagation();lbNav(-1);}}><Icon n="fwd" s={22}/></button>
      <button className="st-lbnav next" onClick={e=>{e.stopPropagation();lbNav(1);}}><Icon n="back" s={22}/></button>
      <span className="st-lbcount">{lightbox.i+1} / {lightbox.imgs.length}</span></>}
      <button className="st-lbx" onClick={()=>setLightbox(null)}><Icon n="x" s={20}/></button>
    </div>}
    <input ref={fileRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={onFile}/>
  </div>);
}

function K({ic,c,bg,t,v}){return(<div className="st-kpi"><span className="st-ki" style={{background:bg,color:c}}><Icon n={ic} s={17}/></span><div><div className="st-kv">{v}</div><div className="st-kl">{t}</div></div></div>);}

const CSS=`
.st{--b:#E8712B}
.st-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.st-month{display:flex;align-items:center;gap:7px;background:#fff;border:1px solid #e6e9ee;border-radius:11px;padding:7px 11px;color:#64748b}
.st-month input{border:none;outline:none;font-family:inherit;font-size:13px;font-weight:700;color:#0f172a;background:none}
.st-refresh{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:11px;border:1px solid #e6e9ee;background:#fff;color:#475467;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer}
.st-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:12px}
.st-msg.ok{background:#e7f7ef;color:#087443}.st-msg.err{background:#feecea;color:#b42318}
.st-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px}
.st-kpi{background:#fff;border:1px solid #eceef1;border-radius:15px;padding:13px;display:flex;align-items:center;gap:11px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.st-ki{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.st-kv{font-size:19px;font-weight:800;letter-spacing:-.5px}
.st-kl{font-size:11px;color:#64748b;font-weight:600}
.st-flow{display:flex;align-items:flex-start;gap:7px;background:#fffbeb;border:1px solid #fde9c8;color:#92600e;font-size:11.5px;font-weight:600;border-radius:11px;padding:10px 12px;margin-bottom:12px;line-height:1.6}
.st-filters{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.st-fb{padding:6px 12px;border-radius:20px;border:1px solid #e6e9ee;background:#fff;font-family:inherit;font-size:11.5px;font-weight:700;color:#64748b;cursor:pointer}
.st-fb.on{background:#0f172a;color:#fff;border-color:#0f172a}
.st-card{background:#fff;border:1px solid #eceef1;border-inline-start:3px solid #ccc;border-radius:14px;padding:13px 15px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.st-top{display:flex;align-items:flex-start;gap:12px}
.st-thumb{position:relative;width:56px;height:56px;border-radius:11px;overflow:hidden;flex:none;background:#f2f4f7;border:1px solid #eceef1;cursor:pointer;display:flex;align-items:center;justify-content:center}
.st-thumb img{width:100%;height:100%;object-fit:cover}
.st-noimg{color:#b0b7c3}
.st-noimgtag{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;color:#64748b;background:#f4f5f7;border:1px solid #e6e9ee;border-radius:6px;padding:2px 8px}
.st-imgrow{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px dashed #f1f3f5}
.st-imglbl{font-size:11px;font-weight:700;color:#94a3b8}
.st-upl{display:inline-flex;align-items:center;gap:5px;padding:7px 11px;border-radius:9px;border:1px solid #cdb4f0;background:#f6f0ff;color:#6941c6;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer}
.st-upl:disabled{opacity:.55}
.st-noimgbtn{display:inline-flex;align-items:center;gap:5px;padding:7px 11px;border-radius:9px;border:1px solid #e6e9ee;background:#fff;color:#64748b;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer}
.st-noimgbtn.on{background:#eef2f6;color:#475467;border-color:#cbd5e1}
.st-noimgbtn:disabled{opacity:.55}
.st-more{position:absolute;inset-block-start:2px;inset-inline-start:2px;background:rgba(15,23,42,.82);color:#fff;font-size:9.5px;font-weight:800;border-radius:6px;padding:1px 5px}
.st-strip{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
.st-sthumb{position:relative;width:52px;height:52px;border-radius:9px;overflow:hidden;border:1px solid #eceef1;background:#f2f4f7}
.st-sthumb img{width:100%;height:100%;object-fit:cover;cursor:pointer;display:block}
.st-del{position:absolute;inset-block-start:2px;inset-inline-end:2px;width:16px;height:16px;border-radius:50%;border:none;background:rgba(180,35,24,.9);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
.st-del:disabled{opacity:.5}
.st-lbnav{position:absolute;inset-block-start:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:none;background:rgba(255,255,255,.16);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}
.st-lbnav.prev{inset-inline-end:14px}.st-lbnav.next{inset-inline-start:14px}
.st-lbcount{position:absolute;inset-block-end:20px;inset-inline-start:50%;transform:translateX(-50%);color:#fff;font-size:13px;font-weight:700;background:rgba(0,0,0,.4);padding:3px 12px;border-radius:20px}
.st-saved{position:absolute;inset-block-end:2px;inset-inline-end:2px;width:15px;height:15px;border-radius:50%;background:#12b76a;color:#fff;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff}
.st-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px}
.st-no{font-size:10.5px;font-weight:800;color:#0f172a;background:#eef2f7;border:1px solid #dde3ec;border-radius:6px;padding:2px 8px;flex:none;letter-spacing:.3px}
.st-sw{font-size:10px;font-weight:800;color:#475467;background:#f2f4f7;border:1px solid #e4e7ec;border-radius:6px;padding:2px 8px;flex:none}
.st-sw.hot{color:#b54708;background:#fff4e8;border-color:#fddcb9}
.st-h b{font-size:13.5px;font-weight:800;color:#0f172a}
.st-comp{font-size:10.5px;font-weight:700;color:#7a3d00;background:#fff2e6;border:1px solid #fddcb9;border-radius:6px;padding:2px 7px}
.st-sub{font-size:11.5px;color:#64748b;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.st-dot{color:#cbd5e1}
.st-desc{margin-top:5px;font-size:11.5px;color:#475467;line-height:1.6}
.st-stage{align-self:flex-start;padding:4px 11px;border-radius:20px;font-size:10.5px;font-weight:800;flex:none;white-space:nowrap}
.st-qc{margin-top:11px;padding:10px 12px;background:#fafbfc;border:1px solid #f1f3f5;border-radius:11px}
.st-qcrec{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:800}
.st-qcrec.accept{color:#b42318}.st-qcrec.reject{color:#087443}
.st-qcnote{margin-top:6px;font-size:12px;color:#475467;line-height:1.6;white-space:pre-wrap}
.st-qcmeta{margin-top:5px;font-size:10.5px;color:#94a3b8}
.st-panel{margin-top:11px;padding-top:11px;border-top:1px solid #f1f3f5}
.st-prow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.st-pull{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:10px;border:1px solid #bcd7fb;background:#eff6ff;color:#175cd3;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer}
.st-pull:disabled{opacity:.55}
.st-rec{display:flex;gap:6px;margin-inline-start:auto}
.st-recb{display:inline-flex;align-items:center;gap:5px;padding:8px 14px;border-radius:10px;border:1px solid #e6e9ee;background:#fff;font-family:inherit;font-size:12px;font-weight:800;color:#64748b;cursor:pointer}
.st-recb.accept.on{background:#feecea;color:#b42318;border-color:#f7bfba}
.st-recb.reject.on{background:#e7f7ef;color:#087443;border-color:#a6e5c3}
.st-notes{width:100%;box-sizing:border-box;border:1px solid #e6e9ee;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:12.5px;color:#0f172a;outline:none;resize:vertical;min-height:64px;line-height:1.6}
.st-notes:focus{border-color:var(--b);box-shadow:0 0 0 3px rgba(232,113,43,.1)}
.st-submit{margin-top:9px;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:10px;border:none;background:#0f172a;color:#fff;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.st-submit:disabled{opacity:.55}
.st-decide{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:11px;padding-top:11px;border-top:1px solid #f1f3f5}
.st-decl{font-size:12px;font-weight:800;color:#0f172a}
.st-approve{display:inline-flex;align-items:center;gap:6px;padding:9px 15px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97066,#b42318);color:#fff;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer}
.st-reject{display:inline-flex;align-items:center;gap:6px;padding:9px 15px;border-radius:10px;border:1px solid #a6e5c3;background:#e7f7ef;color:#087443;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer}
.st-approve:disabled,.st-reject:disabled{opacity:.55}
.st-wait{display:inline-flex;align-items:center;gap:5px;margin-top:11px;font-size:11.5px;font-weight:700;color:#175cd3}
.st-decided{display:flex;align-items:center;gap:5px;margin-top:10px;font-size:11px;color:#64748b}
.st-empty{background:#fff;border:1px dashed #e6e9ee;border-radius:16px;padding:40px 24px;text-align:center}
.st-empty-ic{width:64px;height:64px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f2f4f7,#e6e9ee);color:#475467}
.st-empty h3{font-size:16px;margin:0 0 8px}.st-empty p{color:#64748b;font-size:12.5px;max-width:460px;margin:0 auto;line-height:1.7}
.st-lb{position:fixed;inset:0;background:rgba(15,23,42,.86);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px}
.st-lb img{max-width:100%;max-height:100%;border-radius:12px}
.st-lbx{position:absolute;inset-block-start:16px;inset-inline-end:16px;width:40px;height:40px;border-radius:50%;border:none;background:rgba(255,255,255,.15);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}
@media(max-width:720px){.st-kpis{grid-template-columns:1fr 1fr}.st-rec{margin-inline-start:0;width:100%}.st-recb{flex:1;justify-content:center}}
`;
