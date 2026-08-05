import{useState,useEffect,useMemo}from"react";
import{supabase,ensureFreshToken,compressImage,uploadAuthed}from"./supabase";
import Icon from"./Icon";
import{AXES,ITEMS,bikerItems,mgmtItems,compliance,complianceByAxis,effect,RESP_AR}from"./fieldChecklist";
import{analyzeRound}from"./fieldAnalysis";
import{openReport,buildWhatsApp}from"./fieldReport";
import FieldChecklistForm,{FCF_CSS}from"./FieldChecklistForm";

const nowPeriod=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;};
const periodLabel=p=>{const[y,m]=p.split("-");return`${["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"][+m-1]||m} ${y}`;};
const todayStr=()=>new Date().toISOString().slice(0,10);
const nowTime=()=>{const d=new Date();return`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;};
const RES=[["pass","✓","مطابق","g"],["half","≈","جزئي","a"],["fail","✕","غير مطابق","r"],["excused","∅","معفى (إمداد)","m"]];
const MRES=[["pass","✓","متوفّر","g"],["fail","✕","ناقص","r"]];

export default function FieldRounds({opId}){
  const[period,setPeriod]=useState(nowPeriod());
  const[loading,setLoading]=useState(true);
  const[emps,setEmps]=useState([]);
  const[rounds,setRounds]=useState([]);
  const[showNew,setShowNew]=useState(false);const[showReq,setShowReq]=useState(false);const[reqSid,setReqSid]=useState("");
  const[editId,setEditId]=useState(null);   // معرّف الجولة الجاري تعديلها (null = جولة جديدة)
  const[hd,setHd]=useState({sweater_id:"",date:todayStr(),time:nowTime(),location:"",location_url:"",gps_lat:null,gps_lng:null,inspector:""});
  const[me,setMe]=useState("");            // اسم المستخدم المسجّل — يملأ منفّذ الجولة تلقائياً
  const[geo,setGeo]=useState("");          // حالة تحديد الموقع: ""/"loading"/"done"/"err"
  const[res,setRes]=useState({});
  const[itemNotes,setItemNotes]=useState({});   // ملاحظات الإعفاء لكل بند
  const[photos,setPhotos]=useState({});   // {itemN:[url,...]} حسب ترتيب الزوايا
  const[uploading,setUploading]=useState("");
  const[notes,setNotes]=useState("");
  const[msg,setMsg]=useState(null);const[saving,setSaving]=useState(false);
  const[viewer,setViewer]=useState(null); // رابط صورة للعرض المكبّر

  const upload=async(n,idx,file)=>{
    if(!file)return;const key=`${n}-${idx}`;setUploading(key);setMsg(null);
    try{
      await ensureFreshToken();
      const img=await compressImage(file);
      const rand=Math.floor(Math.random()*1e9);
      const op=(opId&&opId!=="all")?opId:"default";
      const path=`${op}/${hd.date.slice(0,7)}/${hd.sweater_id||"x"}/${n}-${idx}-${Date.now()}-${rand}.jpg`;
      const publicUrl=await uploadAuthed("field-evidence",path,img,"image/jpeg");
      setPhotos(p=>{const a=[...(p[n]||[])];a[idx]=publicUrl;return{...p,[n]:a};});
    }catch(e){setMsg({ok:false,t:"تعذّر رفع الصورة: "+(e.message||e)});}
    setUploading("");
  };

  // اسم المستخدم المسجّل دخوله — لملء «منفّذ الجولة» تلقائياً
  useEffect(()=>{(async()=>{
    try{const{data:{user}}=await supabase.auth.getUser();if(!user)return;
      const{data:au}=await supabase.from("app_users").select("display_name").eq("id",user.id).maybeSingle();
      const nm=(au&&au.display_name)||user.email||"";setMe(nm);
      setHd(h=>h.inspector?h:{...h,inspector:nm});
    }catch(_){}
  })();},[]);

  // تحديد الموقع المباشر عبر الخرائط (GPS المتصفّح)
  const locate=()=>{
    if(!navigator.geolocation){setGeo("err");setMsg({ok:false,t:"جهازك لا يدعم تحديد الموقع"});return;}
    setGeo("loading");setMsg(null);
    navigator.geolocation.getCurrentPosition(pos=>{
      const lat=+pos.coords.latitude.toFixed(6),lng=+pos.coords.longitude.toFixed(6);
      const url=`https://maps.google.com/?q=${lat},${lng}`;
      setHd(h=>({...h,gps_lat:lat,gps_lng:lng,location_url:url,location:h.location||`${lat}, ${lng}`}));
      setGeo("done");
    },err=>{setGeo("err");setMsg({ok:false,t:err.code===1?"تم رفض إذن الموقع — فعّله من إعدادات المتصفح":"تعذّر تحديد الموقع"});},
    {enableHighAccuracy:true,timeout:10000,maximumAge:0});
  };

  useEffect(()=>{(async()=>{
    setLoading(true);setMsg(null);
    const{data:e}=await supabase.from("employees").select("id,full_name,employee_id").not("employee_id","is",null).order("employee_id");
    setEmps(e||[]);
    let q=supabase.from("field_rounds").select("*").eq("period",period).order("round_date",{ascending:false});
    if(opId&&opId!=="all")q=q.eq("operator_id",opId);
    const{data}=await q;setRounds(data||[]);
    setLoading(false);
  })();},[period,opId]);

  const comp=useMemo(()=>compliance(res),[res]);
  const cAxis=useMemo(()=>complianceByAxis(res),[res]);
  const eff=effect(comp.pct);
  const empBySid=useMemo(()=>{const m={};emps.forEach(e=>{if(e.employee_id)m[String(e.employee_id).trim()]=e;});return m;},[emps]);

  // تفريغ النموذج للحالة الابتدائية
  const resetForm=()=>{setHd({sweater_id:"",date:todayStr(),time:nowTime(),location:"",location_url:"",gps_lat:null,gps_lng:null,inspector:me});setGeo("");setRes({});setItemNotes({});setPhotos({});setNotes("");setEditId(null);};
  // فتح نموذج تعديل جولة محفوظة — يحمّل بياناتها بالكامل
  const startEdit=(r)=>{
    setEditId(r.id);
    setHd({sweater_id:r.sweater_id||"",date:r.round_date||todayStr(),time:r.round_time||"",location:r.location||"",location_url:r.location_url||"",gps_lat:r.gps_lat??null,gps_lng:r.gps_lng??null,inspector:r.inspector||me||""});
    setRes(r.results||{});setItemNotes(r.item_notes||{});setPhotos(r.photos||{});setNotes(r.notes||"");
    setGeo(r.gps_lat?"done":"");setShowReq(false);setShowNew(true);setMsg(null);
    if(typeof window!=="undefined")window.scrollTo({top:0,behavior:"smooth"});
  };
  const editingRound=editId?rounds.find(x=>x.id===editId):null;

  const save=async()=>{
    if(!hd.sweater_id){setMsg({ok:false,t:"اختر البايكر"});return;}
    setSaving(true);setMsg(null);
    try{
      const emp=empBySid[String(hd.sweater_id).trim()];
      const cleanPhotos={};Object.entries(photos).forEach(([k,arr])=>{const f=(arr||[]).filter(Boolean);if(f.length)cleanPhotos[k]=f;});
      const cleanNotes={};Object.entries(itemNotes).forEach(([k,v])=>{if(v&&String(v).trim())cleanNotes[k]=v.trim();});
      // تاريخ جولات البايكر للتحليل (نستبعد الجولة الجاري تعديلها كي لا تُقارن بنفسها)
      let histQ=supabase.from("field_rounds").select("results,compliance_pct,round_date").eq("sweater_id",hd.sweater_id).order("round_date",{ascending:false}).limit(13);
      if(editId)histQ=histQ.neq("id",editId);
      const{data:hist}=await histQ;
      const roundObj={results:res,item_notes:cleanNotes,compliance_pct:comp.pct,round_date:hd.date,biker_name:emp?.full_name||"",sweater_id:hd.sweater_id,action_items:comp.actions};
      const analysis=analyzeRound(roundObj,(hist||[]).slice(0,12));
      const row={operator_id:(opId&&opId!=="all")?opId:null,period:hd.date.slice(0,7),employee_id:emp?.id||null,sweater_id:hd.sweater_id,biker_name:emp?.full_name||"",round_date:hd.date,round_time:hd.time||null,location:hd.location||null,location_url:hd.location_url||null,gps_lat:hd.gps_lat,gps_lng:hd.gps_lng,inspector:hd.inspector||me||null,results:res,item_notes:cleanNotes,photos:cleanPhotos,compliance_pct:comp.pct,effect:eff.key,action_items:comp.actions,by_axis:cAxis,ai_analysis:analysis,notes:notes||null};
      if(editId){
        const{data,error}=await supabase.from("field_rounds").update(row).eq("id",editId).select().single();
        if(error)throw error;
        // إن تغيّر الشهر خارج الفلتر الحالي نُزيل السطر، وإلا نُحدّثه في مكانه
        setRounds(p=>row.period===period?p.map(x=>x.id===editId?data:x):p.filter(x=>x.id!==editId));
        setMsg({ok:true,t:"تم حفظ التعديلات على الجولة"});
      }else{
        const{data,error}=await supabase.from("field_rounds").insert(row).select().single();
        if(error)throw error;
        if(row.period===period)setRounds(p=>[data,...p]);
        setMsg({ok:true,t:"تم حفظ الجولة"});
      }
      setShowNew(false);resetForm();
    }catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setSaving(false);
  };
  const del=async(r)=>{if(!confirm("حذف هذه الجولة؟"))return;const{error}=await supabase.from("field_rounds").delete().eq("id",r.id);if(!error)setRounds(p=>p.filter(x=>x.id!==r.id));};
  const requestSelf=async()=>{
    if(!reqSid){setMsg({ok:false,t:"اختر البايكر"});return;}
    const emp=empBySid[String(reqSid).trim()];
    const row={operator_id:(opId&&opId!=="all")?opId:null,period,employee_id:emp?.id||null,sweater_id:reqSid,biker_name:emp?.full_name||"",round_date:todayStr(),source:"self",status:"requested",results:{},inspector:"توثيق ذاتي"};
    const{data,error}=await supabase.from("field_rounds").insert(row).select().single();
    if(error){setMsg({ok:false,t:"خطأ: "+error.message});return;}
    setRounds(p=>[data,...p]);setShowReq(false);setReqSid("");setMsg({ok:true,t:"تم طلب التوثيق الذاتي — سيظهر للبايكر في بوابته"});
  };
  const markReviewed=async(r)=>{const{error}=await supabase.from("field_rounds").update({status:"reviewed"}).eq("id",r.id);if(!error)setRounds(p=>p.map(x=>x.id===r.id?{...x,status:"reviewed"}:x));};
  // رسالة واتساب ثنائية اللغة: تُنسخ للحافظة وتُفتح في واتساب لاختيار المستلم
  const waSend=async(r)=>{
    const text=buildWhatsApp(r,"دلو ورغوة");
    try{await navigator.clipboard?.writeText(text);setMsg({ok:true,t:"تم تجهيز رسالة الواتساب ونسخها — اختر المستلم في واتساب"});}catch(_){}
    try{window.open("https://wa.me/?text="+encodeURIComponent(text),"_blank");}catch(_){}
  };

  const kpis=useMemo(()=>{
    const done=rounds.length;const rated=rounds.filter(r=>r.compliance_pct!=null);
    const avg=rated.length?Math.round(rated.reduce((a,r)=>a+Number(r.compliance_pct),0)/rated.length*10)/10:null;
    const flagged=rounds.filter(r=>r.effect==="deduct"||r.effect==="warn").length;
    const actions=rounds.reduce((a,r)=>a+((r.action_items||[]).length),0);
    return{done,avg,flagged,actions};
  },[rounds]);

  if(loading)return <div className="dw-skel" style={{height:280}}/>;

  return(<div className="fr">
    <style>{CSS+FCF_CSS}</style>
    <div className="fr-bar">
      <div className="fr-month"><Icon n="calendar" s={16}/><input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></div>
      <div style={{flex:1}}/>
      <button className="fr-btn ghost" onClick={()=>{setShowReq(!showReq);setMsg(null);}}><Icon n="camera" s={15}/> طلب توثيق ذاتي</button>
      <button className="fr-btn" onClick={()=>{if(showNew){setShowNew(false);resetForm();}else{resetForm();setShowNew(true);setShowReq(false);}setMsg(null);}}><Icon n={showNew?"x":"plus"} s={15}/> {showNew?"إغلاق":"جولة جديدة"}</button>
    </div>
    {msg&&<div className={"fr-msg "+(msg.ok?"ok":"err")}>{msg.t}</div>}
    {showReq&&<div className="fr-req">
      <div className="fr-req-h"><Icon n="camera" s={15}/> طلب توثيق ذاتي من البايكر</div>
      <div className="fr-req-b">
        <select value={reqSid} onChange={e=>setReqSid(e.target.value)}><option value="">اختر البايكر…</option>{emps.map(e=><option key={e.id} value={e.employee_id}>{e.full_name} · #{e.employee_id}</option>)}</select>
        <button className="fr-btn ok" onClick={requestSelf}><Icon n="check" s={15}/> إرسال الطلب</button>
      </div>
      <div className="fr-req-n">سيصل الطلب للبايكر في بوابته لتوثيق جولته بالصور والتقييم الذاتي، ثم تراجعها هنا وتعتمدها.</div>
    </div>}

    {showNew&&<div className="fr-new">
      {editId&&<div className="fr-editbar"><div><Icon n="edit" s={14}/> <b>تعديل جولة محفوظة</b> — {editingRound?.biker_name||hd.sweater_id} · {editingRound?.round_date||hd.date}</div><button className="fr-cancel" onClick={()=>{setShowNew(false);resetForm();}}><Icon n="x" s={13}/> إلغاء التعديل</button></div>}
      {/* رأس الجولة */}
      <div className="fr-hd">
        <label className="fr-fld"><span>البايكر</span>
          <select value={hd.sweater_id} onChange={e=>setHd({...hd,sweater_id:e.target.value})}>
            <option value="">اختر…</option>{emps.map(e=><option key={e.id} value={e.employee_id}>{e.full_name} · #{e.employee_id}</option>)}
          </select></label>
        <label className="fr-fld"><span>تاريخ الجولة</span><input type="date" value={hd.date} onChange={e=>setHd({...hd,date:e.target.value})}/></label>
        <label className="fr-fld"><span>وقت الجولة</span><input type="time" value={hd.time} onChange={e=>setHd({...hd,time:e.target.value})}/></label>
        <label className="fr-fld"><span>المكان</span>
          <div className="fr-loc">
            <input value={hd.location} onChange={e=>setHd({...hd,location:e.target.value})} placeholder="اسم الموقع أو حدّده تلقائياً"/>
            <button type="button" className={"fr-locbtn"+(geo==="done"?" ok":"")} onClick={locate} title="تحديد موقعي الحالي">
              {geo==="loading"?<span className="fr-locsp">…</span>:<Icon n="target" s={15}/>}
            </button>
          </div>
          {hd.location_url&&<a className="fr-locurl" href={hd.location_url} target="_blank" rel="noreferrer"><Icon n="target" s={11}/> عرض على الخريطة ({hd.gps_lat}, {hd.gps_lng})</a>}
        </label>
        <label className="fr-fld"><span>منفّذ الجولة</span><input value={hd.inspector} onChange={e=>setHd({...hd,inspector:e.target.value})} placeholder="يُملأ تلقائياً حسب حسابك"/></label>
      </div>

      <FieldChecklistForm items={ITEMS} res={res} onRes={(n,v)=>setRes(p=>({...p,[n]:v}))} notes={itemNotes} onNote={(n,t)=>setItemNotes(p=>({...p,[n]:t}))} photos={photos} onUpload={upload} uploading={uploading} onView={setViewer}/>
      <label className="fr-fld" style={{marginTop:4}}><span>ملاحظات / إجراءات تصحيحية</span><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="اختياري"/></label>

      {/* مؤشرات المحاور */}
      <div className="fr-axmeters">
        {Object.entries(AXES).map(([ax,meta])=>{const a=cAxis[ax];const col=a.pct==null?"#cbd5e1":a.pct>=80?"#12b76a":a.pct>=60?"#f79009":"#f04438";return(
          <div className="fr-axm" key={ax}><div className="fr-axm-h"><span>{meta.ar}</span><b style={{color:col}}>{a.pct!=null?a.pct+"%":"—"}</b></div><div className="fr-axm-t"><div style={{width:(a.pct==null?0:Math.max(a.pct,3))+"%",background:col}}/></div></div>);})}
      </div>
      {/* النتيجة الحيّة */}
      <div className="fr-score" style={{borderColor:eff.bg}}>
        <div className="fr-score-l"><div className="fr-pct" style={{color:eff.color}}>{comp.pct!=null?comp.pct+"%":"—"}</div><div className="fr-pct-s">الإجمالي ({comp.points}/{comp.denom} بند)</div></div>
        <div className="fr-eff" style={{background:eff.bg,color:eff.color}}>{eff.ar}</div>
        {comp.actions.length>0&&<div className="fr-act"><Icon n="alert" s={12}/> {comp.actions.length} بند إدارة → طلب دعم سويتر</div>}
      </div>
      <button className="fr-btn ok" style={{width:"100%",marginTop:12}} onClick={save} disabled={saving}><Icon n="save" s={15}/> {saving?"جارٍ الحفظ…":editId?"حفظ التعديلات":"حفظ الجولة"}</button>
    </div>}

    {/* ملخص */}
    <div className="fr-kpis">
      <K ic="rounds" c="#E8712B" bg="#fff2e8" t="جولات الشهر" v={kpis.done}/>
      <K ic="performance" c="#087443" bg="#e7f7ef" t="متوسط الامتثال" v={kpis.avg!=null?kpis.avg+"%":"—"}/>
      <K ic="alert" c="#b54708" bg="#fef3e2" t="جولات دون الهدف" v={kpis.flagged}/>
      <K ic="wrench" c="#175cd3" bg="#eff6ff" t="إجراءات إدارة" v={kpis.actions}/>
    </div>
    <div className="fr-hint"><Icon n="alert" s={13}/> تُنفَّذ الجولة مرة شهرياً لكل بايكر على الأقل. بنود الإدارة (⚠) لا تدخل درجة البايكر وتتحوّل لإجراءات. الامتثال ≥80% لا أثر · 60–79% تنبيه · &lt;60% خصم جودة.</div>

    {/* السجل */}
    {rounds.length===0?<div className="fr-empty"><div className="fr-empty-ic"><Icon n="rounds" s={30}/></div><h3>لا جولات في {periodLabel(period)}</h3><p>نفّذ جولة ميدانية لكل بايكر وفق لائحة الالتزام (14 بنداً) — النتيجة تغذّي درجة الأداء تلقائياً.</p></div>:
    rounds.map(r=>{const ef=effect(r.compliance_pct);const self=r.source==="self";const stMap={requested:["مطلوب — بانتظار البايكر","#b54708","#fef3e2"],submitted:["ذاتي — بانتظار المراجعة","#175cd3","#eff6ff"],reviewed:["ذاتي — تمت المراجعة","#087443","#e7f7ef"]};const stx=self?stMap[r.status]:null;return(
      <div className="fr-card" key={r.id} style={{borderInlineStartColor:ef.color}}>
        <div className="fr-c-top">
          <div><div className="fr-c-name">{r.biker_name||"—"}<small>#{r.sweater_id}</small>{self&&<span className="fr-self">توثيق ذاتي</span>}</div><div className="fr-c-sub">{r.round_date}{r.round_time?" · "+r.round_time:""}{r.location?" · "+r.location:""}{r.inspector?" · "+r.inspector:""}{r.location_url?<> · <a href={r.location_url} target="_blank" rel="noreferrer" style={{color:"#1d5bbf",fontWeight:700,textDecoration:"none"}}>الخريطة</a></>:null}</div></div>
          <div className="fr-c-pct" style={{color:ef.color}}>{r.compliance_pct!=null?r.compliance_pct+"%":"—"}</div>
        </div>
        {stx&&<div className="fr-c-st" style={{background:stx[2],color:stx[1]}}><span className="fr-sdot" style={{background:stx[1]}}/>{stx[0]}</div>}
        {r.status!=="requested"&&<div className="fr-c-eff" style={{background:ef.bg,color:ef.color}}>{ef.ar}</div>}
        {(r.action_items||[]).length>0&&<div className="fr-c-act"><Icon n="wrench" s={12}/> بنود إدارة معلّقة: {(r.action_items||[]).map(n=>"#"+n).join("، ")}</div>}
        {r.notes&&<div className="fr-c-notes">{r.notes}</div>}
        {(()=>{const all=Object.values(r.photos||{}).flat().filter(Boolean);return all.length>0&&<div className="fr-c-gal"><div className="fr-c-gal-h"><Icon n="camera" s={12}/> {all.length} صورة توثيق</div><div className="fr-c-thumbs">{all.slice(0,8).map((u,i)=><img key={i} src={u} onClick={()=>setViewer(u)}/>)}{all.length>8&&<span className="fr-more">+{all.length-8}</span>}</div></div>;})()}
        <div className="fr-c-actions">
          {r.status!=="requested"&&<button className="fr-report" onClick={()=>openReport(r,r.ai_analysis,"دلو ورغوة")}><Icon n="print" s={14}/> تقرير الجولة</button>}
          {r.status!=="requested"&&<button className="fr-edit" onClick={()=>startEdit(r)}><Icon n="edit" s={13}/> تعديل</button>}
          {r.status!=="requested"&&<button className="fr-wa" onClick={()=>waSend(r)}><Icon n="send" s={13}/> واتساب</button>}
          {self&&r.status==="submitted"&&<button className="fr-review" onClick={()=>markReviewed(r)}><Icon n="check" s={14}/> مراجعة واعتماد</button>}
          <div style={{flex:1}}/>
          <button className="fr-del" onClick={()=>del(r)}><Icon n="trash" s={13}/> حذف</button>
        </div>
      </div>);})}

    {viewer&&<div className="fr-viewer" onClick={()=>setViewer(null)}><img src={viewer}/><button className="fr-v-close"><Icon n="x" s={20}/></button></div>}
  </div>);
}
function K({ic,c,bg,t,v}){return(<div className="fr-kpi"><span className="fr-ki" style={{background:bg,color:c}}><Icon n={ic} s={17}/></span><div><div className="fr-kv">{v}</div><div className="fr-kl">{t}</div></div></div>);}

const CSS=`
.fr{--b:#E8712B}
.fr-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.fr-month{display:flex;align-items:center;gap:7px;background:#fff;border:1px solid #e6e9ee;border-radius:11px;padding:7px 11px;color:#64748b}
.fr-month input{border:none;outline:none;font-family:inherit;font-size:13px;font-weight:700;color:#0f172a;background:none}
.fr-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:11px;border:none;background:#0f172a;color:#fff;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.fr-btn.ok{background:linear-gradient(135deg,#12b76a,#087443)}
.fr-btn.ghost{background:#fff;border:1px solid #e6e9ee;color:#334155}
.fr-btn:disabled{opacity:.55}
.fr-req{background:#fff;border:1px solid #eceef1;border-radius:14px;padding:14px;margin-bottom:14px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.fr-req-h{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;margin-bottom:10px}
.fr-req-b{display:flex;gap:8px;flex-wrap:wrap}
.fr-req-b select{flex:1;min-width:160px;border:1px solid #e6e9ee;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:13px;font-weight:600;outline:none;background:#fff}
.fr-req-n{font-size:11px;color:#94a3b8;margin-top:8px;line-height:1.6}
.fr-self{display:inline-block;margin-inline-start:6px;background:#eff6ff;color:#175cd3;font-size:9.5px;font-weight:800;padding:1px 8px;border-radius:20px}
.fr-c-st{display:inline-flex;align-items:center;gap:5px;margin-top:9px;padding:4px 11px;border-radius:20px;font-size:11px;font-weight:800}
.fr-sdot{width:6px;height:6px;border-radius:50%}
.fr-review{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:9px;border:none;background:linear-gradient(135deg,#12b76a,#087443);color:#fff;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer}
.fr-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:12px}
.fr-msg.ok{background:#e7f7ef;color:#087443}.fr-msg.err{background:#feecea;color:#b42318}
.fr-new{background:#fff;border:1px solid #eceef1;border-radius:16px;padding:16px;margin-bottom:14px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.fr-hd{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.fr-fld{display:flex;flex-direction:column;gap:4px}
.fr-fld span{font-size:11px;color:#64748b;font-weight:600}
.fr-fld select,.fr-fld input{border:1px solid #e6e9ee;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:13px;font-weight:600;color:#0f172a;outline:none;background:#fff;width:100%;box-sizing:border-box}
.fr-fld select:focus,.fr-fld input:focus{border-color:var(--b);box-shadow:0 0 0 3px rgba(232,113,43,.1)}
.fr-loc{display:flex;gap:7px;align-items:stretch}
.fr-loc input{flex:1}
.fr-locbtn{flex:none;width:42px;border:1px solid #e6e9ee;border-radius:10px;background:#fff2e8;color:var(--b);display:flex;align-items:center;justify-content:center;cursor:pointer}
.fr-locbtn:hover{background:#ffe6d2}
.fr-locbtn.ok{background:#e7f7ef;color:#087443;border-color:#b7e4cd}
.fr-locsp{font-size:16px;font-weight:800;color:var(--b)}
.fr-locurl{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#1d5bbf;margin-top:5px;text-decoration:none}
.fr-legend{display:flex;flex-wrap:wrap;gap:10px;align-items:center;background:#fafbfc;border:1px solid #f1f3f5;border-radius:11px;padding:9px 12px;margin-bottom:6px}
.fr-lg{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:#475569;font-weight:600}
.fr-lg .fr-o{width:22px;height:22px;font-size:12px;cursor:default}
.fr-lg-cam{color:#175cd3;margin-inline-start:auto}
.fr-axis{margin-bottom:6px}
.fr-axis-h{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:800;color:#0f172a;margin:12px 0 6px;padding-bottom:5px;border-bottom:1px solid #f1f3f5}
.fr-item{display:flex;flex-direction:column;gap:9px;padding:10px 0;border-bottom:1px solid #f6f7f9}
.fr-i-row{display:flex;align-items:center;gap:10px}
.fr-item.mg{opacity:.9}
.fr-i-cam{color:#94a3b8;font-weight:700}.fr-i-cam.ok{color:#087443}
.fr-photos{display:flex;flex-wrap:wrap;gap:7px;padding-inline-start:31px}
.fr-ph{width:66px;height:66px;border-radius:10px;border:1.5px dashed #d7dde5;background:#fafbfc;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;color:#94a3b8;overflow:hidden;flex:none;position:relative}
.fr-ph:hover{border-color:var(--b);color:var(--b)}
.fr-ph span{font-size:8.5px;font-weight:700;text-align:center;line-height:1.15;padding:0 3px}
.fr-ph.has{border-style:solid;border-color:#b7e4cd}
.fr-ph img{width:100%;height:100%;object-fit:cover}
.fr-ph-up{font-size:18px;color:var(--b);font-weight:800}
.fr-c-gal{margin-top:10px}
.fr-c-gal-h{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:#64748b;font-weight:700;margin-bottom:6px}
.fr-c-thumbs{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.fr-c-thumbs img{width:52px;height:52px;border-radius:9px;object-fit:cover;cursor:pointer;border:1px solid #eceef1}
.fr-more{font-size:12px;color:#64748b;font-weight:700}
.fr-viewer{position:fixed;inset:0;background:rgba(2,6,12,.9);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px}
.fr-viewer img{max-width:100%;max-height:100%;border-radius:12px}
.fr-v-close{position:fixed;top:16px;inset-inline-start:16px;width:42px;height:42px;border-radius:50%;border:none;background:rgba(255,255,255,.15);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}
.fr-i-txt{flex:1;min-width:0;display:flex;gap:9px}
.fr-i-n{width:22px;height:22px;border-radius:7px;background:#f4f5f7;color:#64748b;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex:none}
.fr-i-ar{font-size:12.5px;font-weight:600;color:#0f172a;line-height:1.4}
.fr-i-resp{font-size:10px;color:#94a3b8;margin-top:2px}
.fr-i-opts{display:flex;gap:4px;flex:none}
.fr-o{width:30px;height:30px;border-radius:9px;border:1px solid #e6e9ee;background:#fff;font-size:14px;font-weight:800;cursor:pointer;color:#94a3b8;display:flex;align-items:center;justify-content:center}
.fr-o.g.on{background:#e7f7ef;border-color:#b7e4cd;color:#087443}
.fr-o.a.on{background:#fef3e2;border-color:#fbdba7;color:#b54708}
.fr-o.r.on{background:#feecea;border-color:#f7bfba;color:#b42318}
.fr-o.m.on{background:#eef0f3;border-color:#d7dde5;color:#475569}
.fr-exnote{display:flex;align-items:center;gap:7px;margin-top:8px;padding-inline-start:31px}
.fr-exnote input{flex:1;border:1px solid #d7dde5;border-radius:9px;padding:8px 10px;font-family:inherit;font-size:12px;outline:none;background:#fffdf7}
.fr-exnote input:focus{border-color:#b54708;box-shadow:0 0 0 3px rgba(181,71,8,.1)}
.fr-exnote>svg{color:#b54708;flex:none}
.fr-axmeters{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}
.fr-axm{background:#fafbfc;border:1px solid #f1f3f5;border-radius:10px;padding:9px 10px}
.fr-axm-h{display:flex;align-items:center;justify-content:space-between;font-size:10.5px;color:#64748b;font-weight:700;margin-bottom:6px}
.fr-axm-h b{font-size:12px}
.fr-axm-t{height:6px;background:#eef0f3;border-radius:5px;overflow:hidden}.fr-axm-t div{height:100%;border-radius:5px}
.fr-report{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:9px;border:1px solid #ffd9bd;background:#fff7f0;color:#b54708;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer}
.fr-report:hover{background:#fff2e8}
.fr-score{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px;padding:13px;border:2px solid #eee;border-radius:13px;background:#fafbfc}
.fr-pct{font-size:26px;font-weight:800;letter-spacing:-.5px;line-height:1}
.fr-pct-s{font-size:10.5px;color:#94a3b8;margin-top:2px}
.fr-eff{font-size:12px;font-weight:800;padding:6px 12px;border-radius:20px}
.fr-act{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#b54708}
.fr-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px}
.fr-kpi{background:#fff;border:1px solid #eceef1;border-radius:15px;padding:13px;display:flex;align-items:center;gap:11px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.fr-ki{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.fr-kv{font-size:19px;font-weight:800;letter-spacing:-.5px}.fr-kl{font-size:11px;color:#64748b;font-weight:600}
.fr-hint{display:flex;align-items:flex-start;gap:7px;background:#fffbeb;border:1px solid #fde9c8;color:#92600e;font-size:11.5px;font-weight:600;border-radius:11px;padding:10px 12px;margin-bottom:14px;line-height:1.6}
.fr-card{background:#fff;border:1px solid #eceef1;border-inline-start:3px solid #ccc;border-radius:14px;padding:13px 15px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.fr-c-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.fr-c-name{font-size:14px;font-weight:800;color:#0f172a}.fr-c-name small{color:#94a3b8;font-weight:600;margin-inline-start:6px;font-size:11.5px}
.fr-c-sub{font-size:11.5px;color:#64748b;margin-top:2px}
.fr-c-pct{font-size:22px;font-weight:800;letter-spacing:-.5px;flex:none}
.fr-c-eff{display:inline-block;margin-top:10px;font-size:11px;font-weight:800;padding:4px 11px;border-radius:20px}
.fr-c-act{display:flex;align-items:center;gap:6px;margin-top:9px;font-size:11.5px;color:#175cd3;font-weight:700;background:#eff6ff;border-radius:8px;padding:6px 10px}
.fr-c-notes{margin-top:9px;font-size:12px;color:#475569;background:#fafbfc;border:1px solid #f1f3f5;border-radius:8px;padding:8px 10px}
.fr-c-actions{display:flex;flex-wrap:wrap;align-items:center;gap:7px;justify-content:flex-end;margin-top:10px}
.fr-edit{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:9px;border:1px solid #cfe0f7;background:#f5f9ff;color:#1d5bbf;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer}
.fr-edit:hover{background:#e9f2ff}
.fr-wa{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:9px;border:1px solid #b7e4cd;background:#effaf3;color:#087443;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer}
.fr-wa:hover{background:#e2f6ea}
.fr-editbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;background:#f5f9ff;border:1px solid #cfe0f7;border-radius:11px;padding:9px 12px;margin-bottom:12px;font-size:12.5px;color:#1d5bbf}
.fr-editbar b{font-weight:800}
.fr-cancel{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:8px;border:1px solid #d7dde5;background:#fff;color:#475569;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer}
.fr-del{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:8px;border:1px solid #f7bfba;background:#fff;color:#b42318;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer}
.fr-empty{background:#fff;border:1px dashed #e6e9ee;border-radius:16px;padding:40px 24px;text-align:center}
.fr-empty-ic{width:64px;height:64px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#fff2e8,#ffe2cc);color:var(--b)}
.fr-empty h3{font-size:16px;margin:0 0 8px}.fr-empty p{color:#64748b;font-size:12.5px;max-width:440px;margin:0 auto;line-height:1.7}
@media(max-width:720px){.fr-kpis{grid-template-columns:1fr 1fr}.fr-hd{grid-template-columns:1fr}.fr-axmeters{grid-template-columns:1fr 1fr}}
`;
