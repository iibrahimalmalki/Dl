import{useState,useEffect,useMemo,useCallback,useRef}from"react";
import{supabase,SUPA_URL,SUPA_ANON,compressImage,uploadTicketImage}from"./supabase";
import Icon from"./Icon";
import{useToast}from"./ui";
import{KitStyle,usePrompt,useConfirm}from"./uiKit";
import{normSearch,searchOrFilter,bikerOptions,bikerKey,applyFilters,tabCounts,TABS,checkTicketUrl,isPageUrl,isImageResponse,PAGE_URL_MSG,periodLabel as pLabel}from"./ticketsLib";

const nowPeriod=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;};
const periodLabel=p=>p==="all"?"كل الأشهر":pLabel(p);
// حالة العرض (الشهر، البايكر، التبويب) محفوظة في الجلسة حتى لا تضيع عند فتح شكوى والعودة
const VIEW_KEY="st.view";
const loadView=()=>{try{return JSON.parse(sessionStorage.getItem(VIEW_KEY)||"null")||{};}catch(e){return{};}};
const PAGE=30;
const publicUrl=path=>path?`${SUPA_URL}/storage/v1/object/public/sweater-tickets/${encodeURI(path)}`:null;

const STAGES={
  pending_review:{ar:"بانتظار المراجعة",color:"var(--warn-ink)",bg:"var(--warn-bg)"},
  reviewed:{ar:"بانتظار اعتمادك",color:"var(--info-ink)",bg:"var(--info-bg)"},
  decided:{ar:"مُعتمدة القرار",color:"var(--ink-2)",bg:"var(--soft)"},
};
const DEC={
  approved:{ar:"معتمدة (تُحتسب على البايكر)",color:"var(--bad-ink)",bg:"var(--bad-bg)"},
  rejected:{ar:"مرفوضة (لا تُحتسب)",color:"var(--ok-ink)",bg:"var(--ok-bg)"},
};

// سجل الحركات: الحقول المتتبَّعة وتسمياتها + عرض القيم
const FL={decision:"القرار",status:"الحالة",qc_recommendation:"توصية الجودة",qc_notes:"ملاحظة الجودة",sub_category:"الفئة الفرعية",description:"الوصف",biker_name:"البايكر",sweater_id:"رقم البايكر",sweater_ticket_no:"رقم سويتر",sweater_decision:"قرار سويتر",compensation:"التعويض",has_image:"صورة",sweater_pic_url:"رابط الصورة",no_customer_image:"لا صورة عميل",coach:"رسائل التطوير"};
const DV={approved:"معتمدة",rejected:"مرفوضة",pending:"معلّقة",accept:"قبول",reject:"رفض",pending_review:"قيد المراجعة",reviewed:"روجعت",decided:"مبتوتة"};
const dv=v=>v===true?"نعم":v===false?"لا":(v==null||v==="")?"—":(DV[v]||(typeof v==="object"?"—":String(v)));
function diffRow(o,n){const ch=[];Object.keys(FL).forEach(k=>{const a=o?o[k]:undefined,b=n?n[k]:undefined;if(JSON.stringify(a??null)!==JSON.stringify(b??null))ch.push({k,a,b});});return ch;}
const fmtDT2=iso=>new Date(iso).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});

export default function SweaterTickets({opId,me,owner}){
  const v0=useMemo(loadView,[]);
  const[period,setPeriod]=useState(v0.period||"2026-06");
  const[biker,setBiker]=useState(v0.biker||"");
  const[loading,setLoading]=useState(true);
  const[rows,setRows]=useState([]);
  const[filter,setFilter]=useState(v0.tab||"all");
  const[periods,setPeriods]=useState([]);   // [{p,n}] الأشهر التي فيها شكاوى
  const[q,setQ]=useState("");               // نص البحث
  const[sres,setSres]=useState(null);       // نتائج البحث (كل الأشهر) أو null
  const[searching,setSearching]=useState(false);
  const[limit,setLimit]=useState(PAGE);
  const[badImg,setBadImg]=useState({});     // رابط → فشل تحميله
  const[pdlg,askUrl]=usePrompt();
  const[cdlg,ask]=useConfirm();
  const[canEdit,setCanEdit]=useState(!!owner);
  const toast=useToast();
  const[msg,setMsgRaw]=useState(null);
  // رسائل النجاح → Toast؛ الأخطاء تبقى في الصفحة
  const setMsg=m=>{if(m&&m.ok){toast.ok(m.t,undefined,m.t.length>60?7000:undefined);setMsgRaw(null);}else setMsgRaw(m);};
  const[busy,setBusy]=useState({});   // id -> true
  const[draft,setDraft]=useState({}); // id -> {rec, notes}
  const[lightbox,setLightbox]=useState(null);
  const[edit,setEdit]=useState(null);   // تعديل الشكوى
  const[hist,setHist]=useState({});     // id -> {open,loading,rows}
  const fileRef=useRef(null);const upTarget=useRef(null);

  const load=useCallback(async()=>{
    setLoading(true);setMsg(null);
    let qq=supabase.from("ops_tickets").select("*").order("ticket_date",{ascending:false});
    if(period!=="all")qq=qq.eq("period",period);
    if(opId&&opId!=="all")qq=qq.eq("operator_id",opId);
    const{data,error}=await qq;
    if(error)setMsg({ok:false,t:"تعذّر جلب الشكاوى: "+error.message});
    setRows(data||[]);setLoading(false);
  },[period,opId]);
  useEffect(()=>{load();},[load]);
  // الأشهر المتاحة + عدد شكاوى كل شهر (لقائمة الشهر و«كل الأشهر»)
  useEffect(()=>{(async()=>{
    let qq=supabase.from("ops_tickets").select("period");if(opId&&opId!=="all")qq=qq.eq("operator_id",opId);
    const{data}=await qq;const m={};(data||[]).forEach(r=>{if(r.period)m[r.period]=(m[r.period]||0)+1;});
    setPeriods(Object.keys(m).sort().reverse().map(p=>({p,n:m[p]})));
  })();},[opId]);
  useEffect(()=>{try{sessionStorage.setItem(VIEW_KEY,JSON.stringify({period,biker,tab:filter}));}catch(e){}},[period,biker,filter]);
  useEffect(()=>{setLimit(PAGE);},[period,biker,filter,sres]);
  // البحث برقم الشكوى/الطلب: من القاعدة، في كل الأشهر، بعد حرفين وبتأخير قصير
  const runSearch=useCallback(async(text)=>{
    const f=searchOrFilter(text);if(!f){setSres(null);return;}
    setSearching(true);
    let qq=supabase.from("ops_tickets").select("*").or(f).order("ticket_date",{ascending:false}).limit(60);
    if(opId&&opId!=="all")qq=qq.eq("operator_id",opId);
    const{data,error}=await qq;setSearching(false);
    if(error){setMsg({ok:false,t:"تعذّر البحث: "+error.message});return;}
    setSres(data||[]);
  },[opId]);
  useEffect(()=>{if(!normSearch(q)){setSres(null);return;}const h=setTimeout(()=>runSearch(q),300);return()=>clearTimeout(h);},[q,runSearch]);
  // تحديث صف في القائمتين (الشهر ونتائج البحث)
  const patchRow=(id,data)=>{if(!data)return;const f=p=>p&&p.map(r=>r.id===id?{...r,...data}:r);setRows(f);setSres(f);};

  // صلاحية التحرير (مسؤول الجودة) — المالك يملك كل شيء
  useEffect(()=>{(async()=>{
    if(owner){setCanEdit(true);return;}
    const uid=me&&me.id;if(!uid){setCanEdit(false);return;}
    const{data}=await supabase.from("user_permissions").select("can_edit").eq("user_id",uid).eq("module","complaints").maybeSingle();
    setCanEdit(!!(data&&data.can_edit));
  })();},[me,owner]);

  // realtime
  useEffect(()=>{
    const ch=supabase.channel("ops_tickets_rt").on("postgres_changes",{event:"*",schema:"public",table:"ops_tickets"},()=>{load();if(normSearch(q))runSearch(q);}).subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[load,q,runSearch]);

  const setB=(id,v)=>setBusy(p=>({...p,[id]:v}));

  // سحب صورة من رابط وتخزينها عندنا. لا يُمرَّر ticket_id للدالة: الصف يُحدَّث هنا فقط بعد التأكد أن الملف صورة فعلاً
  const pullImage=async(t,urlArg,uniq)=>{
    const url=urlArg||t.sweater_pic_url;
    if(!url){setMsg({ok:false,t:"لا يوجد رابط صورة من سويتر لهذه الشكوى"});return false;}
    const chk=checkTicketUrl(url,t);
    if(!chk.ok){setMsg({ok:false,t:chk.msg});return false;}   // رابط صفحة: لا استدعاء للدالة
    setB(t.id,true);setMsg(null);
    try{
      const{data}=await supabase.auth.getSession();const s=data&&data.session;
      if(!s||!s.access_token)throw new Error("انتهت الجلسة — سجّل الدخول من جديد");
      const path=`${t.period}/${t.booking_ref||t.id}${uniq?"-u"+Date.now():""}.jpg`;
      const res=await fetch(`${SUPA_URL}/functions/v1/ticket-image-pull`,{method:"POST",headers:{Authorization:`Bearer ${s.access_token}`,apikey:SUPA_ANON,"Content-Type":"application/json"},body:JSON.stringify({url,path})});
      let out=null;try{out=await res.json();}catch(_){}
      if(out&&out.error==="NOT_IMAGE")throw Object.assign(new Error(PAGE_URL_MSG),{notImage:true});
      if(!res.ok||!out||!out.url)throw new Error((out&&out.message)||("HTTP "+res.status));
      // تحقّق مستقل من الملف المخزَّن (يحمي حتى قبل نشر الدالة المعدّلة): نوعه وأول بايتاته
      const head=await fetch(out.url,{headers:{Range:"bytes=0-31"},cache:"no-store"}).catch(()=>null);
      const buf=head&&head.ok?new Uint8Array(await head.arrayBuffer()):null;
      if(!head||!head.ok)throw new Error("تعذّر التحقق من الملف المسحوب — أعد المحاولة");
      if(!isImageResponse(head.headers.get("content-type"),buf))throw Object.assign(new Error(PAGE_URL_MSG),{notImage:true});
      const pics=[...(t.stored_pics||[]),out.path];
      const patch={stored_pics:pics,stored_pic_path:t.stored_pic_path||out.path,has_image:true,no_customer_image:false,...(urlArg?{sweater_pic_url:url}:{})};
      const{data:row,error}=await supabase.from("ops_tickets").update(patch).eq("id",t.id).select().single();
      if(error)throw error;
      patchRow(t.id,row);
      setMsg({ok:true,t:"تم سحب الصورة وتخزينها في نظامنا"});
      return true;
    }catch(e){setMsg({ok:false,t:e.notImage?e.message:"تعذّر سحب الصورة: "+(e.message||e)});return false;}
    finally{setB(t.id,false);}
  };

  // إرفاق صورة بلصق رابطها — حوار يشرح الفرق بين رابط الصورة ورابط صفحة التذكرة
  const addByUrl=async(t)=>{
    const url=await askUrl({title:"رابط صورة الشكوى",ok:"سحب الصورة",
      hint:<>الصق <b>رابط الصورة نفسها</b> لا رابط صفحة التذكرة. في سويتر: اضغط مطوّلاً على الصورة واختر «نسخ عنوان الصورة».{t.sweater_ticket_no?<> هذه الشكوى رقم <b dir="ltr">{t.sweater_ticket_no}</b>.</>:null}</>,
      label:"رابط الصورة",placeholder:"https://…/image.jpg",value:isPageUrl(t.sweater_pic_url)?"":(t.sweater_pic_url||""),
      check:v=>{const c=checkTicketUrl(v,t);return c.ok?{warn:c.warn}:{error:c.msg};}});
    if(!url)return;
    await pullImage(t,url,true);   // الرابط يُحفظ في sweater_pic_url فقط بعد نجاح السحب والتحقق
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
      patchRow(t.id,data);
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
      patchRow(t.id,data);
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
      patchRow(t.id,data);
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
      patchRow(t.id,data);
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
      patchRow(t.id,data);
      setMsg({ok:true,t:decision==="approved"?"تم اعتماد الشكوى — ستُحتسب على البايكر في الرواتب":"تم رفض الشكوى — لن تُحتسب"});
    }catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setB(t.id,false);
  };

  // تحرير الشكوى
  const openEdit=(t)=>setEdit({id:t.id,sweater_ticket_no:t.sweater_ticket_no||"",sub_category:t.sub_category||"",description:t.description||"",biker_name:t.biker_name||"",sweater_id:t.sweater_id||"",sweater_decision:t.sweater_decision||"",compensation:t.compensation||"",qc_notes:t.qc_notes||""});
  const saveEdit=async()=>{
    const e=edit;if(!e)return;setB(e.id,true);setMsg(null);
    try{
      const patch={sweater_ticket_no:e.sweater_ticket_no||null,sub_category:e.sub_category||null,description:e.description||null,biker_name:e.biker_name||null,sweater_id:e.sweater_id||null,sweater_decision:e.sweater_decision||null,compensation:e.compensation||null,qc_notes:e.qc_notes||null};
      const{data,error}=await supabase.from("ops_tickets").update(patch).eq("id",e.id).select().single();
      if(error)throw error;
      patchRow(e.id,data);
      setEdit(null);setMsg({ok:true,t:"تم حفظ التعديل — سُجّل في سجل الحركات"});
      if(hist[e.id]&&hist[e.id].open)loadHist({id:e.id},true);
    }catch(err){setMsg({ok:false,t:"تعذّر الحفظ: "+(err.message||err)});}
    setB(e.id,false);
  };
  // سجل الحركات (تايملاين)
  const loadHist=async(t,force)=>{
    const cur=hist[t.id];
    if(cur&&cur.open&&!force){setHist(p=>({...p,[t.id]:{...cur,open:false}}));return;}
    setHist(p=>({...p,[t.id]:{open:true,loading:true,rows:(cur&&cur.rows)||[]}}));
    const{data}=await supabase.from("audit_log").select("action,actor_email,changed_at,old_data,new_data").eq("table_name","ops_tickets").eq("row_id",t.id).order("changed_at",{ascending:false});
    setHist(p=>({...p,[t.id]:{open:true,loading:false,rows:data||[]}}));
  };
  // إعادة فتح شكوى مبتوتة لتعديل سلسلة الاعتماد
  const reopen=async(t)=>{
    if(!(await ask({title:"إعادة فتح القرار",ar:"إعادة فتح الشكوى لتغيير القرار؟ سيُسجَّل ذلك في سجل الحركات.",ok:"إعادة الفتح",cancel:"رجوع"})))return;
    setB(t.id,true);setMsg(null);
    try{
      const{data,error}=await supabase.from("ops_tickets").update({decision:"pending",status:"reviewed"}).eq("id",t.id).select().single();
      if(error)throw error;
      patchRow(t.id,data);
      setMsg({ok:true,t:"أُعيد فتح الشكوى — يمكنك تغيير القرار الآن"});
      if(hist[t.id]&&hist[t.id].open)loadHist(t,true);
    }catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setB(t.id,false);
  };

  // النطاق: نتائج البحث (كل الأشهر، بلا فلتر شهر/بايكر) أو الشهر المختار ∩ البايكر ∩ التبويب
  const searchOn=sres!==null;
  const base=searchOn?sres:rows;
  const bk=searchOn?"":biker;
  const counts=useMemo(()=>tabCounts(base,bk),[base,bk]);
  const scoped=useMemo(()=>bk?base.filter(r=>bikerKey(r)===bk):base,[base,bk]);
  const totals={count:scoped.length,pending:counts.pending_review,reviewed:counts.reviewed,approved:counts.approved};
  const shown=useMemo(()=>applyFilters(base,{biker:bk,tab:filter}),[base,bk,filter]);
  const bikers=useMemo(()=>{const o=bikerOptions(rows);if(biker&&!o.some(x=>x.key===biker))o.unshift({key:biker,name:biker,id:"",n:0});return o;},[rows,biker]);
  const bikerName=k=>{const o=bikers.find(x=>x.key===k);return o?`${o.name}${o.id&&o.id!==o.name?" · "+o.id:""}`:k;};
  const clearAll=()=>{setQ("");setSres(null);setBiker("");setFilter("all");};
  const showMonth=searchOn||period==="all";

  if(loading&&!rows.length)return <div className="g-skel" style={{height:280}}/>;

  return(<div className="st">
    <style>{CSS}</style><KitStyle/>
    <div className="st-search">
      <Icon n="search" s={16}/>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث برقم الشكوى أو رقم الطلب" inputMode="search" aria-label="ابحث برقم الشكوى أو رقم الطلب" dir="auto"/>
      {searching&&<span className="g-spin st-sspin" aria-hidden="true"/>}
      {q&&<button className="st-sx" onClick={()=>{setQ("");setSres(null);}} aria-label="مسح البحث"><Icon n="x" s={14}/></button>}
    </div>
    <div className="st-bar">
      <label className="st-month"><Icon n="calendar" s={16}/>
        <select value={period} onChange={e=>setPeriod(e.target.value)} disabled={searchOn} aria-label="الشهر">
          <option value="all">كل الأشهر</option>
          {(periods.some(x=>x.p===period)||period==="all"?periods:[{p:period,n:0},...periods]).map(x=><option key={x.p} value={x.p}>{periodLabel(x.p)} ({x.n})</option>)}
        </select></label>
      <label className="st-month st-biker"><Icon n="users" s={16}/>
        <select value={searchOn?"":biker} onChange={e=>setBiker(e.target.value)} disabled={searchOn} aria-label="البايكر">
          <option value="">كل البايكرز ({rows.length})</option>
          {bikers.map(x=><option key={x.key} value={x.key}>{x.name}{x.id&&x.id!==x.name?" · "+x.id:""} ({x.n})</option>)}
        </select></label>
      <div style={{flex:1}}/>
      <button className="st-refresh" onClick={()=>{load();if(searchOn)runSearch(q);}}><Icon n="refresh" s={14}/> تحديث</button>
    </div>
    {(searchOn||biker||filter!=="all")&&<div className="st-chips">
      {searchOn&&<span className="st-chip">بحث: <b dir="ltr">{normSearch(q)}</b> · كل الأشهر والبايكرز<button onClick={()=>{setQ("");setSres(null);}} aria-label="إزالة البحث"><Icon n="x" s={11}/></button></span>}
      {!searchOn&&biker&&<span className="st-chip">البايكر: {bikerName(biker)}<button onClick={()=>setBiker("")} aria-label="إزالة فلتر البايكر"><Icon n="x" s={11}/></button></span>}
      {filter!=="all"&&<span className="st-chip">{(TABS.find(x=>x[0]===filter)||[])[1]}<button onClick={()=>setFilter("all")} aria-label="إزالة فلتر الحالة"><Icon n="x" s={11}/></button></span>}
      <button className="st-clear" onClick={clearAll}>مسح الفلاتر</button>
    </div>}
    {msg&&<div className={"st-msg "+(msg.ok?"ok":"err")}>{msg.t}</div>}

    <div className="st-kpis">
      <K ic="complaints" c="var(--ink-2)" bg="var(--soft)" t={searchOn?"نتائج البحث":period==="all"?"كل الشكاوى":"شكاوى الشهر"} v={totals.count}/>
      <K ic="clock" c="var(--warn-ink)" bg="var(--warn-bg)" t="بانتظار المراجعة" v={totals.pending}/>
      <K ic="eye" c="var(--info-ink)" bg="var(--info-bg)" t="بانتظار اعتمادك" v={totals.reviewed}/>
      <K ic="alert" c="var(--bad-ink)" bg="var(--bad-bg)" t="معتمدة (تُحتسب)" v={totals.approved}/>
    </div>

    <div className="st-flow"><Icon n="alert" s={13}/> المسار: سويتر ← سحب الصورة ← مراجعة مسؤول الجودة وتوصيته ← اعتمادك أو رفضك (نهائي) ← احتساب في الرواتب.</div>

    <div className="st-filters">
      {TABS.map(([k,l])=><button key={k} className={"st-fb"+(filter===k?" on":"")} onClick={()=>setFilter(k)}>{l} <span className="st-fn">{counts[k]||0}</span></button>)}
    </div>

    {shown.length===0?(searchOn?<div className="st-empty"><div className="st-empty-ic"><Icon n="search" s={30}/></div><h3>لا توجد شكوى بهذا الرقم</h3><p>تأكد من الرقم، أو أنها لم تُستورد من تقرير سويتر بعد.</p></div>
      :<div className="st-empty"><div className="st-empty-ic"><Icon n="complaints" s={30}/></div><h3>لا شكاوى ضمن هذا التصنيف في {periodLabel(period)}{biker?" لـ"+bikerName(biker):""}</h3><p>تُستورد شكاوى العملاء من تقارير سويتر الشهرية. بعد الاستيراد يسحب مسؤول الجودة الصور ويكتب توصيته، ثم تظهر لك للاعتماد أو الرفض.</p></div>):
    <>{shown.slice(0,limit).map(t=>{
      const stg=STAGES[t.status]||STAGES.pending_review;const dec=DEC[t.decision];const d=draft[t.id]||{};const b=!!busy[t.id];
      const stored=(t.stored_pics&&t.stored_pics.length)?t.stored_pics:(t.stored_pic_path?[t.stored_pic_path]:[]);
      const gallery=stored.map(publicUrl);
      if(t.sweater_pic_url&&!stored.length&&!isPageUrl(t.sweater_pic_url))gallery.push(t.sweater_pic_url);   // رابط صفحة سويتر لا يُعرض كصورة
      const img=gallery[0]||null;
      return(<div className="st-card" key={t.id} style={{borderInlineStartColor:dec?dec.color:stg.color}}>
        <div className="st-top">
          <div className="st-thumb" onClick={()=>gallery.length&&openLb(gallery,0)}>
            {img&&!badImg[img]?<img src={img} alt="صورة الشكوى" loading="lazy" onError={()=>setBadImg(p=>({...p,[img]:true}))}/>:<span className="st-noimg">{img?<Icon n="alert" s={18}/>:<Icon n="image" s={20}/>}</span>}
            {stored.length>0&&<span className="st-saved" title="مخزّنة في نظامنا"><Icon n="check" s={10}/></span>}
            {gallery.length>1&&<span className="st-more">+{gallery.length-1}</span>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div className="st-h">{showMonth&&t.period&&<span className="st-mon">{periodLabel(t.period)}</span>}{(t.sweater_ticket_no||t.ticket_no!=null)&&<span className="st-no">شكوى #{t.sweater_ticket_no||String(t.ticket_no).padStart(4,"0")}</span>}{t.sweater_decision&&<span className={"st-sw"+(t.sweater_decision==="report"?"":" hot")}>سويتر: {t.sweater_decision==="report"?"بلاغ":t.sweater_decision}</span>}<b>{t.sub_category||t.description||"شكوى عميل"}</b>{t.compensation&&<span className="st-comp">تعويض العميل: {t.compensation}</span>}{!img&&t.no_customer_image&&<span className="st-noimgtag"><Icon n="image" s={11}/> لا توجد صورة من العميل</span>}</div>
            <div className="st-sub"><span>{t.biker_name||"—"}{t.sweater_id?` · #${t.sweater_id}`:""}</span><span className="st-dot">·</span><span>{t.ticket_date||""}</span>{t.booking_ref&&<><span className="st-dot">·</span><span>حجز {t.booking_ref}</span></>}</div>
            {t.description&&t.sub_category&&<div className="st-desc">{t.description}</div>}
          </div>
          <span className="st-stage" style={{background:(dec||stg).bg,color:(dec||stg).color}}>{dec?dec.ar:stg.ar}</span>
        </div>

        {/* معرض صور الشكوى (يراه الجميع) */}
        {stored.length>0&&<div className="st-strip">
          {stored.map((p,gi)=>badImg[publicUrl(p)]?(<div className="st-badimg" key={p} role="status">
            <span><Icon n="alert" s={13}/> تعذّر عرض الصورة</span>
            {canEdit&&<button onClick={()=>removeImg(t,p)} disabled={b}><Icon n="x" s={11}/> حذف</button>}
          </div>):(<div className="st-sthumb" key={p}>
            <img src={publicUrl(p)} alt="صورة" loading="lazy" onClick={()=>openLb(stored.map(publicUrl),gi)} onError={()=>setBadImg(q0=>({...q0,[publicUrl(p)]:true}))}/>
            {canEdit&&<button className="st-del" title="حذف" onClick={()=>removeImg(t,p)} disabled={b}><Icon n="x" s={10}/></button>}
          </div>))}
        </div>}

        {/* إدارة صور الشكوى — سحب من سويتر أو رفع يدوي (عدة صور) أو توثيق عدم وجود صورة */}
        {canEdit&&<div className="st-imgrow">
          <span className="st-imglbl">صور الشكوى:</span>
          {t.sweater_pic_url&&!stored.length&&!isPageUrl(t.sweater_pic_url)&&<button className="st-pull" onClick={()=>pullImage(t)} disabled={b}><Icon n="download" s={13}/> {b?"…":"سحب من سويتر"}</button>}
          <button className="st-url" onClick={()=>addByUrl(t)} disabled={b}><Icon n="link" s={13}/> رابط الصورة</button>
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

        {/* أدوات: تحرير · سجل الحركات · إعادة فتح */}
        {(canEdit||owner)&&<div className="st-tools">
          {canEdit&&<button className="st-tbtn" onClick={()=>openEdit(t)}><Icon n="edit" s={12}/> تعديل</button>}
          <button className={"st-tbtn"+(hist[t.id]&&hist[t.id].open?" on":"")} onClick={()=>loadHist(t)}><Icon n="clock" s={12}/> سجل الحركات{hist[t.id]&&hist[t.id].rows&&hist[t.id].rows.length?` (${hist[t.id].rows.length})`:""}</button>
          {owner&&(t.decision==="approved"||t.decision==="rejected")&&<button className="st-tbtn warn" onClick={()=>reopen(t)}><Icon n="refresh" s={12}/> إعادة فتح القرار</button>}
        </div>}
        {hist[t.id]&&hist[t.id].open&&<div className="st-hist">
          {hist[t.id].loading?<div className="st-hist-l">جارٍ التحميل…</div>:
           (!hist[t.id].rows.length?<div className="st-hist-l">لا حركات مسجّلة بعد</div>:
            hist[t.id].rows.map((h,i)=>{const ch=h.action==="UPDATE"?diffRow(h.old_data,h.new_data):[];return(
              <div className="st-hi" key={i}>
                <div className="st-hi-top"><b>{h.action==="INSERT"?"أُنشئت الشكوى":h.action==="DELETE"?"حُذفت الشكوى":"تحديث"}</b><span>{fmtDT2(h.changed_at)}{h.actor_email?" · "+h.actor_email:""}</span></div>
                {h.action==="UPDATE"&&(ch.length?<div className="st-hi-ch">{ch.map((c,j)=><div key={j}><span className="st-hi-f">{FL[c.k]}:</span> من <s>{dv(c.a)}</s> إلى <b>{dv(c.b)}</b></div>)}</div>:<div className="st-hi-ch dim">تحديث بيانات فنية/صور</div>)}
              </div>);}))}
        </div>}
      </div>);})}
    {shown.length>limit&&<button className="st-more-btn" onClick={()=>setLimit(l=>l+PAGE)}>عرض المزيد ({shown.length-limit} متبقية)</button>}</>}

    {edit&&<div className="st-ov" onClick={()=>setEdit(null)}>
      <div className="st-modal" onClick={e=>e.stopPropagation()}>
        <div className="st-mh"><b>تعديل الشكوى</b><button className="st-x" onClick={()=>setEdit(null)}><Icon n="x" s={15}/></button></div>
        <label className="st-fl">رقم سويتر<input value={edit.sweater_ticket_no} onChange={e=>setEdit({...edit,sweater_ticket_no:e.target.value})}/></label>
        <label className="st-fl">الفئة الفرعية<input value={edit.sub_category} onChange={e=>setEdit({...edit,sub_category:e.target.value})}/></label>
        <label className="st-fl">الوصف<textarea value={edit.description} onChange={e=>setEdit({...edit,description:e.target.value})}/></label>
        <div className="st-frow">
          <label className="st-fl">البايكر<input value={edit.biker_name} onChange={e=>setEdit({...edit,biker_name:e.target.value})}/></label>
          <label className="st-fl">رقم البايكر<input value={edit.sweater_id} onChange={e=>setEdit({...edit,sweater_id:e.target.value})}/></label>
        </div>
        <div className="st-frow">
          <label className="st-fl">قرار سويتر<input value={edit.sweater_decision} onChange={e=>setEdit({...edit,sweater_decision:e.target.value})}/></label>
          <label className="st-fl">التعويض<input value={edit.compensation} onChange={e=>setEdit({...edit,compensation:e.target.value})}/></label>
        </div>
        <label className="st-fl">ملاحظة الجودة<textarea value={edit.qc_notes} onChange={e=>setEdit({...edit,qc_notes:e.target.value})}/></label>
        <div className="st-mact"><button className="st-save" onClick={saveEdit} disabled={!!busy[edit.id]}><Icon n="save" s={14}/> {busy[edit.id]?"جارٍ الحفظ…":"حفظ"}</button><button className="st-cancel" onClick={()=>setEdit(null)}>إلغاء</button></div>
        <div className="st-mnote2">كل تعديل يُسجَّل تلقائياً في «سجل الحركات» باسمك ووقته.</div>
      </div>
    </div>}

    {lightbox&&<div className="st-lb" onClick={()=>setLightbox(null)}>
      <img src={lightbox.imgs[lightbox.i]} alt="صورة الشكوى" onClick={e=>e.stopPropagation()}/>
      {lightbox.imgs.length>1&&<><button className="st-lbnav prev" onClick={e=>{e.stopPropagation();lbNav(-1);}}><Icon n="fwd" s={22}/></button>
      <button className="st-lbnav next" onClick={e=>{e.stopPropagation();lbNav(1);}}><Icon n="back" s={22}/></button>
      <span className="st-lbcount">{lightbox.i+1} / {lightbox.imgs.length}</span></>}
      <button className="st-lbx" onClick={()=>setLightbox(null)}><Icon n="x" s={20}/></button>
    </div>}
    <input ref={fileRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={onFile}/>
    {pdlg}{cdlg}
  </div>);
}

function K({ic,c,bg,t,v}){return(<div className="st-kpi"><span className="st-ki" style={{background:bg,color:c}}><Icon n={ic} s={17}/></span><div><div className="st-kv">{v}</div><div className="st-kl">{t}</div></div></div>);}

const CSS=`
.st{--b:var(--p)}
.st-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.st-month{display:flex;align-items:center;gap:7px;background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:11px;padding:7px 11px;color:var(--mut)}
.st-month input,.st-month select{border:none;outline:none;font-family:inherit;font-size:13px;font-weight:700;color:var(--ink);background:none;min-height:30px;max-width:100%;min-width:0}
.st-month{min-width:0;max-width:100%}.st-month select:disabled{opacity:.55}
.st-month option{color:#0f172a}
.st-search{display:flex;align-items:center;gap:8px;background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1.5px solid var(--line-2);border-radius:13px;padding:0 12px;margin-bottom:10px;color:var(--mut);min-height:48px}
.st-search:focus-within{border-color:var(--p);box-shadow:var(--glow)}
.st-search input{flex:1;min-width:0;border:none;outline:none;background:none;font-family:inherit;font-size:15px;font-weight:700;color:var(--ink);min-height:44px}
.st-sx{width:36px;height:36px;border-radius:50%;border:none;background:var(--soft);color:var(--ink-2);cursor:pointer;display:flex;align-items:center;justify-content:center;flex:none}
.st-sspin{width:16px!important;height:16px!important;border-width:2px!important;margin:0!important;flex:none}
.st-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px}
.st-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 6px 4px 10px;border-radius:20px;background:var(--p-50);border:1px solid rgba(var(--p-rgb),.35);color:var(--p-ink);font-size:11.5px;font-weight:800}
.st-chip button{width:22px;height:22px;border-radius:50%;border:none;background:rgba(var(--p-rgb),.15);color:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
.st-clear{border:none;background:none;color:var(--mut);font-family:inherit;font-size:11.5px;font-weight:800;text-decoration:underline;cursor:pointer;padding:6px}
.st-fn{display:inline-block;min-width:18px;padding:0 5px;margin-inline-start:3px;border-radius:10px;background:var(--soft);color:inherit;font-size:10.5px;font-variant-numeric:tabular-nums}
.st-fb.on .st-fn{background:rgba(255,255,255,.22)}
.st-mon{font-size:10.5px;font-weight:800;color:var(--info-ink);background:var(--info-bg);border-radius:6px;padding:2px 8px;flex:none}
.st-badimg{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:6px 8px;border-radius:9px;border:1px dashed color-mix(in srgb,var(--bad) 45%,transparent);background:var(--bad-bg);color:var(--bad-ink);font-size:10.5px;font-weight:800}
.st-badimg span{display:inline-flex;align-items:center;gap:4px}
.st-badimg button{display:inline-flex;align-items:center;gap:3px;border:none;border-radius:7px;background:rgba(180,35,24,.12);color:inherit;font-family:inherit;font-size:10.5px;font-weight:800;padding:3px 7px;cursor:pointer}
.st-more-btn{display:block;width:100%;padding:12px;border-radius:12px;border:1px dashed var(--line-2);background:var(--glass-2);color:var(--ink-2);font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;margin-bottom:10px}
.st-refresh{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:11px;border:1px solid var(--line);background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);color:var(--ink-2);font-family:inherit;font-size:12px;font-weight:800;cursor:pointer}
.st-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:12px}
.st-msg.ok{background:var(--ok-bg);color:var(--ok-ink)}.st-msg.err{background:var(--bad-bg);color:var(--bad-ink)}
.st-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px}
.st-kpi{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:15px;padding:13px;display:flex;align-items:center;gap:11px;box-shadow:var(--shadow)}
.st-ki{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.st-kv{font-size:19px;font-weight:800;letter-spacing:-.5px}
.st-kl{font-size:11px;color:var(--mut);font-weight:600}
.st-flow{display:flex;align-items:flex-start;gap:7px;background:var(--warn-bg);border:1px solid color-mix(in srgb,var(--warn) 35%,transparent);color:var(--warn-ink);font-size:11.5px;font-weight:600;border-radius:11px;padding:10px 12px;margin-bottom:12px;line-height:1.6}
.st-filters{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.st-fb{padding:6px 12px;border-radius:20px;border:1px solid var(--line);background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);font-family:inherit;font-size:11.5px;font-weight:700;color:var(--mut);cursor:pointer}
.st-fb.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.st-card{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-inline-start:3px solid var(--line);border-radius:14px;padding:13px 15px;margin-bottom:10px;box-shadow:var(--shadow)}
.st-top{display:flex;align-items:flex-start;gap:12px}
.st-thumb{position:relative;width:56px;height:56px;border-radius:11px;overflow:hidden;flex:none;background:var(--soft);border:1px solid var(--line);cursor:pointer;display:flex;align-items:center;justify-content:center}
.st-thumb img{width:100%;height:100%;object-fit:cover}
.st-noimg{color:var(--mut-2)}
.st-noimgtag{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;color:var(--mut);background:var(--soft);border:1px solid var(--line-2);border-radius:6px;padding:2px 8px}
.st-imgrow{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)}
.st-imglbl{font-size:11px;font-weight:700;color:var(--mut-2)}
.st-upl{display:inline-flex;align-items:center;gap:5px;padding:7px 11px;border-radius:9px;border:1px solid color-mix(in srgb,var(--info) 35%,transparent);background:var(--info-bg);color:var(--info-ink);font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer}
.st-upl:disabled{opacity:.55}
.st-noimgbtn{display:inline-flex;align-items:center;gap:5px;padding:7px 11px;border-radius:9px;border:1px solid var(--line-2);background:var(--glass-2);color:var(--mut);font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer}
.st-noimgbtn.on{background:var(--soft);color:var(--ink-2);border-color:var(--line-2)}
.st-noimgbtn:disabled{opacity:.55}
.st-more{position:absolute;inset-block-start:2px;inset-inline-start:2px;background:rgba(15,23,42,.82);color:#fff;font-size:9.5px;font-weight:800;border-radius:6px;padding:1px 5px}
.st-strip{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
.st-sthumb{position:relative;width:52px;height:52px;border-radius:9px;overflow:hidden;border:1px solid var(--line);background:var(--soft)}
.st-sthumb img{width:100%;height:100%;object-fit:cover;cursor:pointer;display:block}
.st-del{position:absolute;inset-block-start:2px;inset-inline-end:2px;width:16px;height:16px;border-radius:50%;border:none;background:rgba(180,35,24,.9);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
.st-del:disabled{opacity:.5}
.st-lbnav{position:absolute;inset-block-start:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:none;background:rgba(255,255,255,.16);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}
.st-lbnav.prev{inset-inline-end:14px}.st-lbnav.next{inset-inline-start:14px}
.st-lbcount{position:absolute;inset-block-end:20px;inset-inline-start:50%;transform:translateX(-50%);color:#fff;font-size:13px;font-weight:700;background:rgba(0,0,0,.4);padding:3px 12px;border-radius:20px}
.st-saved{position:absolute;inset-block-end:2px;inset-inline-end:2px;width:15px;height:15px;border-radius:50%;background:var(--ok);color:#fff;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff}
.st-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px}
.st-no{font-size:10.5px;font-weight:800;color:var(--ink);background:var(--soft);border:1px solid var(--line);border-radius:6px;padding:2px 8px;flex:none;letter-spacing:.3px}
.st-sw{font-size:10px;font-weight:800;color:var(--ink-2);background:var(--soft);border:1px solid var(--line);border-radius:6px;padding:2px 8px;flex:none}
.st-sw.hot{color:var(--warn-ink);background:var(--p-50);border-color:rgba(var(--p-rgb),.35)}
.st-h b{font-size:13.5px;font-weight:800;color:var(--ink)}
.st-comp{font-size:10.5px;font-weight:700;color:var(--p-700);background:var(--p-100);border:1px solid rgba(var(--p-rgb),.35);border-radius:6px;padding:2px 7px}
.st-sub{font-size:11.5px;color:var(--mut);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.st-dot{color:var(--mut-2)}
.st-desc{margin-top:5px;font-size:11.5px;color:var(--ink-2);line-height:1.6}
.st-stage{align-self:flex-start;padding:4px 11px;border-radius:20px;font-size:10.5px;font-weight:800;flex:none;white-space:nowrap}
.st-qc{margin-top:11px;padding:10px 12px;background:var(--soft);border:1px solid var(--line);border-radius:11px}
.st-qcrec{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:800}
.st-qcrec.accept{color:var(--bad-ink)}.st-qcrec.reject{color:var(--ok-ink)}
.st-qcnote{margin-top:6px;font-size:12px;color:var(--ink-2);line-height:1.6;white-space:pre-wrap}
.st-qcmeta{margin-top:5px;font-size:10.5px;color:var(--mut-2)}
.st-panel{margin-top:11px;padding-top:11px;border-top:1px solid var(--line)}
.st-prow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.st-pull{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:10px;border:1px solid color-mix(in srgb,var(--info) 35%,transparent);background:var(--info-bg);color:var(--info-ink);font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer}
.st-url{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:10px;border:1px solid color-mix(in srgb,var(--info) 35%,transparent);background:var(--info-bg);color:var(--info-ink);font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer}
.st-url:disabled{opacity:.55}
.st-pull:disabled{opacity:.55}
.st-rec{display:flex;gap:6px;margin-inline-start:auto}
.st-recb{display:inline-flex;align-items:center;gap:5px;padding:8px 14px;border-radius:10px;border:1px solid var(--line);background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);font-family:inherit;font-size:12px;font-weight:800;color:var(--mut);cursor:pointer}
.st-recb.accept.on{background:var(--bad-bg);color:var(--bad-ink);border-color:color-mix(in srgb,var(--bad) 35%,transparent)}
.st-recb.reject.on{background:var(--ok-bg);color:var(--ok-ink);border-color:color-mix(in srgb,var(--ok) 35%,transparent)}
.st-notes{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;padding:9px 11px;font-family:inherit;font-size:12.5px;color:var(--ink);outline:none;resize:vertical;min-height:64px;line-height:1.6}
.st-notes:focus{border-color:var(--b);box-shadow:0 0 0 3px rgba(232,113,43,.1)}
.st-submit{margin-top:9px;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:10px;border:none;background:var(--ink);color:var(--bg);font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.st-submit:disabled{opacity:.55}
.st-decide{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:11px;padding-top:11px;border-top:1px solid var(--line)}
.st-decl{font-size:12px;font-weight:800;color:var(--ink)}
.st-approve{display:inline-flex;align-items:center;gap:6px;padding:9px 15px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--bad),color-mix(in srgb,var(--bad) 72%,black));color:#fff;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer}
.st-reject{display:inline-flex;align-items:center;gap:6px;padding:9px 15px;border-radius:10px;border:1px solid color-mix(in srgb,var(--ok) 35%,transparent);background:var(--ok-bg);color:var(--ok-ink);font-family:inherit;font-size:12px;font-weight:800;cursor:pointer}
.st-approve:disabled,.st-reject:disabled{opacity:.55}
.st-wait{display:inline-flex;align-items:center;gap:5px;margin-top:11px;font-size:11.5px;font-weight:700;color:var(--info-ink)}
.st-decided{display:flex;align-items:center;gap:5px;margin-top:10px;font-size:11px;color:var(--mut)}
.st-tools{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px;padding-top:10px;border-top:1px dashed var(--line)}
.st-tbtn{display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:9px;border:1px solid var(--line-2);background:var(--glass-2);color:var(--ink-2);font-family:inherit;font-size:11px;font-weight:800;cursor:pointer}
.st-tbtn.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.st-tbtn.warn{border-color:color-mix(in srgb,var(--warn) 35%,transparent);background:var(--warn-bg);color:var(--warn-ink)}
.st-hist{margin-top:9px;border:1px solid var(--line);border-radius:11px;background:var(--soft);padding:8px 10px}
.st-hist-l{font-size:11.5px;color:var(--mut-2);font-weight:600;padding:6px 2px}
.st-hi{padding:8px 0;border-bottom:1px solid var(--line)}
.st-hi:last-child{border-bottom:none}
.st-hi-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.st-hi-top b{font-size:12px;color:var(--ink);font-weight:800}
.st-hi-top span{font-size:10.5px;color:var(--mut-2);font-weight:600}
.st-hi-ch{margin-top:5px;display:flex;flex-direction:column;gap:3px}
.st-hi-ch div{font-size:11px;color:var(--ink-2);font-weight:600;line-height:1.6}
.st-hi-ch.dim{color:var(--mut-2)}
.st-hi-f{font-weight:800;color:var(--ink)}
.st-hi-ch s{color:var(--bad-ink)}
.st-hi-ch b{color:var(--ok-ink)}
.st-ov{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:9500;padding:16px}
.st-modal{background:var(--glass-3);border-radius:18px;width:min(520px,100%);max-height:90vh;overflow:auto;box-shadow:var(--shadow-lg);padding:16px}
.st-mh{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:15px;font-weight:800;color:var(--ink);margin-bottom:12px}
.st-x{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);color:var(--ink-2);cursor:pointer;display:flex;align-items:center;justify-content:center}
.st-fl{display:flex;flex-direction:column;gap:4px;font-size:11.5px;font-weight:700;color:var(--ink-2);margin-bottom:10px;flex:1}
.st-fl input,.st-fl textarea{border:1px solid var(--line-2);border-radius:10px;padding:9px 11px;font-family:inherit;font-size:13px;font-weight:600;color:var(--ink);outline:none;background:var(--glass-3)}
.st-fl textarea{min-height:64px;resize:vertical}
.st-frow{display:flex;gap:10px}
.st-mact{display:flex;gap:9px;margin-top:6px}
.st-save{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:11px;border-radius:11px;border:none;background:linear-gradient(135deg,var(--ok),color-mix(in srgb,var(--ok) 72%,black));color:#fff;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer}
.st-save:disabled{opacity:.6}
.st-cancel{padding:11px 16px;border-radius:11px;border:1px solid var(--line-2);background:var(--glass-2);color:var(--ink-2);font-family:inherit;font-size:13px;font-weight:800;cursor:pointer}
.st-mnote2{font-size:10.5px;color:var(--mut-2);font-weight:600;margin-top:9px;text-align:center}
.st-empty{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px dashed var(--line);border-radius:16px;padding:40px 24px;text-align:center}
.st-empty-ic{width:64px;height:64px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--soft),var(--track));color:var(--ink-2)}
.st-empty h3{font-size:16px;margin:0 0 8px}.st-empty p{color:var(--mut);font-size:12.5px;max-width:460px;margin:0 auto;line-height:1.7}
.st-lb{position:fixed;inset:0;background:rgba(15,23,42,.86);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px}
.st-lb img{max-width:100%;max-height:100%;border-radius:12px}
.st-lbx{position:absolute;inset-block-start:16px;inset-inline-end:16px;width:40px;height:40px;border-radius:50%;border:none;background:rgba(255,255,255,.15);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}
@media(max-width:720px){.st-kpis{grid-template-columns:1fr 1fr}.st-rec{margin-inline-start:0;width:100%}.st-recb{flex:1;justify-content:center}}
`;
