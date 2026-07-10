import{useState,useEffect}from"react";
import{supabase,SITE_URL}from"./supabase";
import{calcGeoScore,ZONE_COLORS}from"./geoScoring";
import{analyzeApplicantLocal,logOutcome,getLearningStats,ARIFUL_BENCHMARK}from"./localAI";
const ST={pending:{ar:"قيد المراجعة",color:"#f59e0b",bg:"#fffbeb"},shortlisted:{ar:"مرشح",color:"#2563eb",bg:"#eff6ff"},interview:{ar:"مقابلة",color:"#7c3aed",bg:"#f5f3ff"},accepted:{ar:"مقبول",color:"#16a34a",bg:"#f0fdf4"},rejected:{ar:"مرفوض",color:"#dc2626",bg:"#fff5f5"}};
const CL={strong:{ar:"مرشح قوي ⭐",color:"#16a34a"},accepted:{ar:"مقبول ✅",color:"#2563eb"},needs_interview:{ar:"يحتاج مقابلة 🔍",color:"#f59e0b"},rejected:{ar:"غير مناسب ❌",color:"#dc2626"}};
export default function AdminDashboard({onLogout}){
  const[list,setList]=useState([]);const[loading,setLoading]=useState(true);const[sel,setSel]=useState(null);const[filter,setFilter]=useState("all");const[search,setSearch]=useState("");const[analyzing,setAnalyzing]=useState(null);const[tab,setTab]=useState("applicants");
  const[empList,setEmpList]=useState([]);const[empLoading,setEmpLoading]=useState(false);const[selEmp,setSelEmp]=useState(null);const[empSearch,setEmpSearch]=useState("");
  useEffect(()=>{load();},[]);
  const load=async()=>{setLoading(true);const{data}=await supabase.from("applicants").select("*").order("application_number",{ascending:true});setList(data||[]);setLoading(false);};
  const loadEmp=async()=>{setEmpLoading(true);const{data}=await supabase.from("employees").select("*").order("created_at",{ascending:false});setEmpList(data||[]);setEmpLoading(false);};
  useEffect(()=>{if(tab==="employees"&&empList.length===0)loadEmp();},[tab]);
  const upStatus=async(id,status)=>{await supabase.from("applicants").update({status}).eq("id",id);setList(p=>p.map(a=>a.id===id?{...a,status}:a));if(sel?.id===id)setSel(p=>({...p,status}));};
  const saveNotes=async(id,n)=>{await supabase.from("applicants").update({admin_notes:n}).eq("id",id);setList(p=>p.map(a=>a.id===id?{...a,admin_notes:n}:a));};
  const delApp=async(id)=>{await supabase.from("applicants").delete().eq("id",id);setList(p=>p.filter(a=>a.id!==id));setSel(null);};
  const delEmp=async(id)=>{await supabase.from("employees").delete().eq("id",id);setEmpList(p=>p.filter(e=>e.id!==id));setSelEmp(null);};
  const analyze=async(a)=>{setAnalyzing(a.id);try{const res=await fetch("https://cnmggdrlkgsyrjxmvydv.supabase.co/functions/v1/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({applicant:a})});if(!res.ok)throw new Error(`${res.status}`);const ev=await res.json();if(ev.error)throw new Error(ev.error);await supabase.from("applicants").update({ai_score_total:ev.score_total,ai_score_technical:ev.score_technical,ai_score_behavioral:ev.score_behavioral,score_physical:ev.score_physical,score_responsibility:ev.score_responsibility,ai_classification:ev.classification,ai_notes:ev.recommendation,ai_evaluation_json:ev}).eq("id",a.id);setList(p=>p.map(x=>x.id===a.id?{...x,ai_score_total:ev.score_total,ai_classification:ev.classification,ai_evaluation_json:ev}:x));if(sel?.id===a.id)setSel(p=>({...p,ai_evaluation_json:ev,ai_score_total:ev.score_total,ai_classification:ev.classification}));}catch(e){alert("خطأ: "+e.message);}setAnalyzing(null);};
  const filtered=list.filter(a=>{const mf=filter==="all"||a.status===filter||a.ai_classification===filter;const ms=!search||a.full_name?.toLowerCase().includes(search.toLowerCase())||a.whatsapp?.includes(search)||String(a.application_number).includes(search);return mf&&ms;});
  const stats={total:list.length,pending:list.filter(a=>a.status==="pending").length,strong:list.filter(a=>a.ai_classification==="strong").length,accepted:list.filter(a=>a.status==="accepted").length};
  if(sel)return <Detail a={sel} onBack={()=>setSel(null)} onStatus={upStatus} onAnalyze={analyze} onSaveNotes={saveNotes} onDelete={delApp} analyzing={analyzing===sel.id}/>;
  if(selEmp)return <EmpDetail e={selEmp} onBack={()=>setSelEmp(null)} onDelete={delEmp}/>;
  return(<div style={s.root}>
    <div style={s.hdr}><div><div style={s.hT}>لوحة التحكم</div><div style={s.hS}>دلو ورغوة</div></div><div style={{display:"flex",gap:8}}><button onClick={()=>{load();if(tab==="employees")loadEmp();}} style={s.bSm}>🔄</button><button onClick={onLogout} style={{...s.bSm,background:"rgba(0,0,0,0.2)"}}>خروج</button></div></div>
    <div style={{display:"flex",borderBottom:"2px solid #f1f5f9",background:"#fff"}}>
      <button onClick={()=>setTab("applicants")} style={{flex:1,padding:"12px 0",border:"none",background:"none",fontSize:13,fontWeight:700,color:tab==="applicants"?"#E8712B":"#64748b",borderBottom:tab==="applicants"?"2px solid #E8712B":"2px solid transparent",cursor:"pointer"}}>📋 المتقدمون ({list.length})</button>
      <button onClick={()=>setTab("employees")} style={{flex:1,padding:"12px 0",border:"none",background:"none",fontSize:13,fontWeight:700,color:tab==="employees"?"#E8712B":"#64748b",borderBottom:tab==="employees"?"2px solid #E8712B":"2px solid transparent",cursor:"pointer"}}>👤 الموظفون ({empList.length})</button>
    </div>
    {tab==="applicants"&&<>
      <div style={s.statsR}>{[{l:"إجمالي",v:stats.total,c:"#E8712B"},{l:"قيد المراجعة",v:stats.pending,c:"#f59e0b"},{l:"أقوياء",v:stats.strong,c:"#16a34a"},{l:"مقبولون",v:stats.accepted,c:"#2563eb"}].map(st=><div key={st.l} style={s.stCard}><div style={{fontSize:22,fontWeight:900,color:st.c}}>{st.v}</div><div style={{fontSize:10,color:"#64748b",marginTop:2}}>{st.l}</div></div>)}</div>
      <div style={s.tb}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 بحث..." style={s.sInp}/><select value={filter} onChange={e=>setFilter(e.target.value)} style={s.fSel}><option value="all">الكل</option><option value="pending">قيد المراجعة</option><option value="strong">AI: قوي</option><option value="interview">مقابلة</option><option value="accepted">مقبول</option><option value="rejected">مرفوض</option></select></div>
      <div style={s.lst}>{loading&&<div style={s.emp}>جاري التحميل...</div>}{!loading&&filtered.length===0&&<div style={s.emp}>لا يوجد متقدمون</div>}{filtered.map(a=><Card key={a.id} a={a} onClick={()=>setSel(a)} onAnalyze={analyze} analyzing={analyzing===a.id}/>)}</div>
    </>}
    {tab==="employees"&&<>
      <div style={{padding:"12px 16px 4px",display:"flex",gap:8}}><input value={empSearch} onChange={e=>setEmpSearch(e.target.value)} placeholder="🔍 بحث..." style={s.sInp}/><button onClick={loadEmp} style={{padding:"10px 12px",background:"#f1f5f9",border:"none",borderRadius:10,fontSize:11,cursor:"pointer",flexShrink:0}}>🔄</button></div>
      <div style={{padding:"0 16px 4px"}}><span style={{color:"#64748b",fontSize:11}}>إجمالي: <strong>{empList.length}</strong></span></div>
      <div style={s.lst}>{empLoading&&<div style={s.emp}>جاري التحميل...</div>}{!empLoading&&empList.length===0&&<div style={s.emp}>لا يوجد موظفون</div>}{empList.filter(e=>!empSearch||e.full_name?.toLowerCase().includes(empSearch.toLowerCase())||e.employee_id?.includes(empSearch)||e.mobile?.includes(empSearch)).map(e=><EmpCard key={e.id} e={e} onClick={()=>setSelEmp(e)}/>)}</div>
    </>}
  </div>);
}
function Card({a,onClick,onAnalyze,analyzing}){const st=ST[a.status]||ST.pending;const cl=a.ai_classification?CL[a.ai_classification]:null;const geo=a.bangladesh_district?calcGeoScore(a.bangladesh_district):null;return(<div style={s.card} onClick={onClick}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}><div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"flex-end",marginBottom:3}}><div style={{color:"#1e293b",fontSize:14,fontWeight:800}}>{a.full_name||"—"}</div>{a.application_number&&<div style={{background:"#fff7ed",color:"#E8712B",fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:20,border:"1px solid #fed7aa"}}>#{a.application_number}</div>}</div><div style={{color:"#64748b",fontSize:11,marginBottom:2}}>{a.whatsapp} · {a.age} سنة</div>{(a.bangladesh_district||a.saudi_city)&&<div style={{color:"#94a3b8",fontSize:10,marginBottom:2}}>{a.location==="inside_ksa"?`🇸🇦 ${a.saudi_city||"—"} ${a.ready_for_riyadh==="yes"?"• مستعد للرياض ✅":""}`:a.bangladesh_district?`🇧🇩 ${a.bangladesh_district} — ${a.bangladesh_city||""}`:""}</div>}{geo&&<div style={{background:ZONE_COLORS[geo.zone].bg,border:`1px solid ${ZONE_COLORS[geo.zone].border}`,borderRadius:8,padding:"2px 8px",display:"inline-block",marginTop:2}}><span style={{color:ZONE_COLORS[geo.zone].text,fontSize:10,fontWeight:700}}>{geo.zone==="green"?"🟢":geo.zone==="yellow"?"🟡":"🔴"} {geo.score}/100</span></div>}</div><div>{a.ai_score_total!=null?<div style={{width:46,height:46,borderRadius:"50%",background:"linear-gradient(135deg,#E8712B,#f59e0b)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}><div style={{color:"#fff",fontSize:14,fontWeight:900,lineHeight:1}}>{Number(a.ai_score_total).toFixed(1)}</div><div style={{color:"rgba(255,255,255,0.8)",fontSize:9}}>/10</div></div>:<div style={{width:46,height:46,borderRadius:"50%",background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",color:"#94a3b8",fontSize:18}}>—</div>}</div></div><div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><div style={{padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700,color:st.color,background:st.bg}}>{st.ar}</div>{cl&&<div style={{padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700,color:cl.color,background:"#f8fafc"}}>{cl.ar}</div>}<div style={{flex:1}}/>{!a.ai_score_total&&<button onClick={e=>{e.stopPropagation();onAnalyze(a);}} disabled={analyzing} style={{padding:"5px 10px",background:"linear-gradient(135deg,#7c3aed,#6d28d9)",border:"none",borderRadius:8,color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer"}}>{analyzing?"⟳":"🤖 AI"}</button>}</div></div>);}

function Detail({a,onBack,onStatus,onAnalyze,onSaveNotes,onDelete,analyzing}){
  const[notes,setNotes]=useState(a.admin_notes||"");const[saving,setSaving]=useState(false);const[del,setDel]=useState(false);const[showInvite,setShowInvite]=useState(false);const[showIQ,setShowIQ]=useState(false);const[iLink,setILink]=useState("");const[editMode,setEditMode]=useState(false);const[ed,setEd]=useState({full_name:a.full_name||"",whatsapp:a.whatsapp||"",age:a.age||"",height_cm:a.height_cm||"",weight_kg:a.weight_kg||"",marital_status:a.marital_status||"",children_count:a.children_count||0,passport_or_iqama:a.passport_or_iqama||""});const[eSaving,setESaving]=useState(false);
  const[session,setSession]=useState(null);const[aiReport,setAiReport]=useState(null);const[loadingReport,setLoadingReport]=useState(false);

  useEffect(()=>{
    supabase.from("interview_sessions").select("*").eq("applicant_id",a.id).eq("status","completed").order("created_at",{ascending:false}).limit(1).single()
    .then(({data})=>{if(data)setSession(data);});
  },[a.id]);

  const genReport=async()=>{
    setLoadingReport(true);
    try{
      const res=await fetch("https://cnmggdrlkgsyrjxmvydv.supabase.co/functions/v1/analyze",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({applicant:{...a,interview_answers:session?.answers||a.interview_answers,interview_questions:session?.questions}})
      });
      const ev=await res.json();
      setAiReport(ev);
      await supabase.from("applicants").update({ai_score_total:ev.score_total,ai_score_technical:ev.score_technical,ai_score_behavioral:ev.score_behavioral,score_physical:ev.score_physical,score_responsibility:ev.score_responsibility,ai_classification:ev.classification,ai_notes:ev.recommendation,ai_evaluation_json:ev}).eq("id",a.id);
    }catch(e){alert("خطأ: "+e.message);}
    setLoadingReport(false);
  };

  const runLocalAnalysis=()=>{
    const ev=analyzeApplicantLocal({...a,interview_answers:session?.answers||a.interview_answers},calcGeoScore);
    setAiReport(ev);
    supabase.from("applicants").update({ai_score_total:ev.score_total,ai_score_technical:ev.score_technical,ai_score_behavioral:ev.score_behavioral,score_physical:ev.score_physical,score_responsibility:ev.score_responsibility,ai_classification:ev.classification,ai_notes:ev.recommendation,ai_evaluation_json:ev}).eq("id",a.id);
  };

  const exportMD=()=>{
    const geo=a.bangladesh_district?calcGeoScore(a.bangladesh_district):null;
    const qs=session?.questions||[];
    const ans=session?.answers||a.interview_answers||{};
    const md=`# تقرير المتقدم — ${a.full_name}
**رقم الطلب:** #${a.application_number} | **التاريخ:** ${new Date().toLocaleDateString("ar-SA")}

---

## البيانات الأساسية
| البند | القيمة |
|---|---|
| العمر | ${a.age} سنة |
| الطول | ${a.height_cm} سم |
| الوزن | ${a.weight_kg} كغ |
| الموقع | ${a.location==="inside_ksa"?"داخل المملكة":"خارج"} |
| الرخصة | ${a.has_license?"✅ نعم":"❌ لا"} |
| الحالة | ${a.marital_status==="married"?`متزوج — ${a.children_count||0} أبناء`:"أعزب"} |
| المحافظة | ${a.bangladesh_district||"—"} |
| المدينة | ${a.bangladesh_city||"—"} |
| نقاط المنطقة | ${geo?.score||"—"}/100 (${geo?.zone||"—"}) |

---

## الأسئلة السلوكية
| # | السؤال | الإجابة |
|---|---|---|
| 1 | رفض عميل فجأة | ${a.q1_client_refusal||"—"} |
| 2 | فواحة/مناديل خارج الطلب | ${a.q2_equipment_damage||"—"} |
| 3 | سبب ترك العمل | ${a.q3_left_previous_job||"—"} |
| 4 | خصم من الراتب | ${a.q4_salary_deduction||"—"} |
| 5 | هدف بعد سنة | ${a.q5_one_year_goal||"—"} |
| 6 | زميل مشكلة | ${a.q6_difficult_colleague||"—"} |

---

## وصف الغسيل
${a.car_wash_description||"لم يُجب"}

---

## إجابات المقابلة الشخصية
${qs.map((q,i)=>`**س${i+1}:** ${q.ar}\n**الإجابة:** ${ans[i]||"—"}`).join("\n\n")}

---

## تحليل الذكاء الاصطناعي
- **الدرجة الكلية:** ${a.ai_score_total?.toFixed(1)||"لم يُحلل"}/10
- **التصنيف:** ${a.ai_classification||"—"}
- **اللياقة:** ${a.score_physical?.toFixed(1)||"—"}/10
- **المسؤولية:** ${a.score_responsibility?.toFixed(1)||"—"}/10
- **الكفاءة الفنية:** ${a.ai_score_technical?.toFixed(1)||"—"}/10
- **السلوكيات:** ${a.ai_score_behavioral?.toFixed(1)||"—"}/10

${a.ai_evaluation_json?.recommendation?`**التوصية:** ${a.ai_evaluation_json.recommendation}`:""}
${a.ai_evaluation_json?.ariful_comparison?`**مقارنة بأريفول:** ${a.ai_evaluation_json.ariful_comparison}`:""}

---

## ملاحظاتي
${a.admin_notes||"لا توجد"}
`;
    const blob=new Blob([md],{type:"text/markdown"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;link.download=`applicant-${a.application_number}-${a.full_name.replace(/\s/g,"-")}.md`;
    link.click();URL.revokeObjectURL(url);
  };
  const ev=a.ai_evaluation_json;const st=ST[a.status]||ST.pending;const geo=a.bangladesh_district?calcGeoScore(a.bangladesh_district):null;
  const save=async()=>{setSaving(true);await onSaveNotes(a.id,notes);setSaving(false);};
  const saveEdit=async()=>{setESaving(true);const{error}=await supabase.from("applicants").update(ed).eq("id",a.id);if(error)alert("خطأ: "+error.message);else{setEditMode(false);Object.assign(a,ed);}setESaving(false);};
  const mapUrl=a.bangladesh_city?`https://maps.google.com/maps?q=${encodeURIComponent((a.bangladesh_city||"")+" "+(a.bangladesh_district||"")+" Bangladesh")}`:"";
  return(<div style={s.root}>
    <div style={{background:"linear-gradient(135deg,#E8712B,#CC5200)",padding:"14px 20px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:100}}><button onClick={onBack} style={s.bSm}>← رجوع</button><div style={{flex:1,textAlign:"right"}}><div style={{color:"#fff",fontSize:15,fontWeight:900}}>{a.full_name}</div><div style={{color:"rgba(255,255,255,0.75)",fontSize:11}}>طلب #{a.application_number}</div></div><div style={{padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700,color:st.color,background:"rgba(255,255,255,0.9)"}}>{st.ar}</div></div>
    <div style={{padding:"12px 16px 80px",display:"flex",flexDirection:"column",gap:12,maxWidth:560,margin:"0 auto"}}>

      {/* موقع المتقدم */}
      <div style={s.sec}><div style={{color:"#1e293b",fontSize:13,fontWeight:800,marginBottom:12}}>📍 الموقع والمنطقة</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:geo?10:0}}>
          {[[a.location==="inside_ksa"?"🇸🇦 داخل المملكة":"🇧🇩 خارج","الموقع"],[a.saudi_city||"—","المدينة السعودية"],[a.bangladesh_district||"—","المحافظة"],[a.bangladesh_city||"—","المدينة/القرية"],[a.ready_for_riyadh==="yes"?"✅ نعم":a.ready_for_riyadh==="no"?"❌ لا":"—","مستعد للرياض"]].map(([v,l])=><div key={l} style={{background:"#f8fafc",borderRadius:10,padding:"8px 12px"}}><div style={{color:"#94a3b8",fontSize:10,marginBottom:2}}>{l}</div><div style={{color:"#1e293b",fontSize:12,fontWeight:600}}>{v}</div></div>)}
        </div>
        {geo&&<div style={{background:ZONE_COLORS[geo.zone].bg,border:`1.5px solid ${ZONE_COLORS[geo.zone].border}`,borderRadius:10,padding:"10px 14px",marginBottom:8}}><div style={{color:ZONE_COLORS[geo.zone].text,fontSize:12,fontWeight:800,marginBottom:4}}>{ZONE_COLORS[geo.zone].label}</div><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>{Object.entries(geo.d).filter(([k])=>k.startsWith("M")).map(([k,v])=><div key={k} style={{textAlign:"center",background:"rgba(255,255,255,0.6)",borderRadius:6,padding:"4px 2px"}}><div style={{color:ZONE_COLORS[geo.zone].text,fontSize:9,opacity:0.7}}>{k}</div><div style={{color:ZONE_COLORS[geo.zone].text,fontSize:12,fontWeight:800}}>{v}</div></div>)}</div><div style={{color:ZONE_COLORS[geo.zone].text,fontSize:11,fontWeight:700,marginTop:6}}>النقاط الكلية: {geo.score}/100</div></div>}
        {a.bangladesh_city&&<a href={mapUrl} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:6,color:"#2563eb",fontSize:12,fontWeight:700,textDecoration:"none",marginTop:4}}>🗺️ عرض على الخريطة ←</a>}
      </div>

      {/* البيانات */}
      <div style={s.sec}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{color:"#1e293b",fontSize:13,fontWeight:800}}>👤 البيانات الشخصية</div><button onClick={()=>setEditMode(!editMode)} style={{padding:"5px 12px",background:editMode?"#f1f5f9":"linear-gradient(135deg,#E8712B,#d4631f)",border:"none",borderRadius:8,color:editMode?"#475569":"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>{editMode?"❌ إلغاء":"✏️ تعديل"}</button></div>
        {editMode?(<div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[["الاسم","full_name","text"],["واتساب","whatsapp","text"],["الجواز/الإقامة","passport_or_iqama","text"]].map(([l,k,t])=><div key={k}><div style={{color:"#64748b",fontSize:11,marginBottom:3,textAlign:"right"}}>{l}</div><input type={t} value={ed[k]} onChange={e=>setEd(p=>({...p,[k]:e.target.value}))} style={s.inp}/></div>)}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>{[["العمر","age",25,38],["الطول","height_cm",160,200],["الوزن","weight_kg",40,120]].map(([l,k,mn,mx])=><div key={k}><div style={{color:"#64748b",fontSize:11,marginBottom:3,textAlign:"right"}}>{l}</div><input type="number" min={mn} max={mx} value={ed[k]} onChange={e=>setEd(p=>({...p,[k]:e.target.value}))} style={s.inp}/></div>)}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div><div style={{color:"#64748b",fontSize:11,marginBottom:3,textAlign:"right"}}>الحالة</div><select value={ed.marital_status} onChange={e=>setEd(p=>({...p,marital_status:e.target.value}))} style={s.inp}><option value="single">أعزب</option><option value="married">متزوج</option><option value="divorced">مطلق</option></select></div>{ed.marital_status==="married"&&<div><div style={{color:"#64748b",fontSize:11,marginBottom:3,textAlign:"right"}}>الأبناء</div><select value={ed.children_count} onChange={e=>setEd(p=>({...p,children_count:+e.target.value}))} style={s.inp}>{[0,1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}</select></div>}</div>
          <button onClick={saveEdit} disabled={eSaving} style={{...s.bFull,background:"linear-gradient(135deg,#2E7D32,#1b5e20)"}}>{eSaving?"جاري الحفظ...":"💾 حفظ التعديلات"}</button>
        </div>):(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{[["الاسم",a.full_name],["رقم الطلب",`#${a.application_number}`],["واتساب",a.whatsapp],["العمر",`${a.age} سنة`],["الطول",`${a.height_cm} سم`],["الوزن",`${a.weight_kg} كغ`],["الرخصة",a.has_license?"✅ نعم":"❌ لا"],["الحالة",a.marital_status==="married"?`متزوج — ${a.children_count||0} أبناء`:a.marital_status==="single"?"أعزب":"مطلق"],["الجواز",a.passport_or_iqama]].map(([l,v])=><div key={l} style={{background:"#f8fafc",borderRadius:10,padding:"8px 12px"}}><div style={{color:"#94a3b8",fontSize:10,marginBottom:2}}>{l}</div><div style={{color:"#1e293b",fontSize:12,fontWeight:600}}>{v||"—"}</div></div>)}</div>)}
      </div>

      {/* الملفات */}
      <div style={s.sec}><div style={{color:"#1e293b",fontSize:13,fontWeight:800,marginBottom:12}}>📎 الملفات</div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{a.personal_photo_url&&<FCard l="الصورة" url={a.personal_photo_url} type="image"/>}{a.license_image_url&&<FCard l="الرخصة" url={a.license_image_url} type="image"/>}{a.iqama_image_url&&<FCard l="الإقامة" url={a.iqama_image_url} type="image"/>}{a.passport_image_url&&<FCard l="الجواز" url={a.passport_image_url} type="image"/>}{a.driving_video_url&&<FCard l="الفيديو" url={a.driving_video_url} type="video"/>}</div></div>

      {/* وصف الغسيل */}
      <div style={s.sec}><div style={{color:"#1e293b",fontSize:13,fontWeight:800,marginBottom:10}}>🔧 وصف الغسيل</div><div style={{background:"#f8fafc",borderRadius:10,padding:12,color:"#1e293b",fontSize:12,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{a.car_wash_description||"—"}</div></div>

      {/* الأسئلة */}
      <div style={s.sec}><div style={{color:"#1e293b",fontSize:13,fontWeight:800,marginBottom:10}}>🧠 الأسئلة السلوكية</div>{[["رفض عميل",a.q1_client_refusal],["فواحة/مناديل",a.q2_equipment_damage],["سبب ترك العمل",a.q3_left_previous_job],["خصم الراتب",a.q4_salary_deduction],["هدف بعد سنة",a.q5_one_year_goal],["زميل مشكلة",a.q6_difficult_colleague]].map(([q,ans],i)=><div key={i} style={{background:"#f8fafc",borderRadius:10,padding:"8px 12px",marginBottom:6}}><div style={{color:"#E8712B",fontSize:10,fontWeight:700,marginBottom:3}}>{i+1}. {q}</div><div style={{color:"#1e293b",fontSize:12,lineHeight:1.6}}>{ans||"—"}</div></div>)}</div>

      {/* إجابات المقابلة — السؤال + الجواب */}
      {(session||a.interview_answers)&&<div style={s.sec}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <button onClick={exportMD} style={{padding:"6px 12px",background:"linear-gradient(135deg,#475569,#334155)",border:"none",borderRadius:8,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>📄 تصدير MD</button>
          <div style={{color:"#1e293b",fontSize:13,fontWeight:800}}>🎯 إجابات المقابلة</div>
        </div>
        <div style={{background:"#eff6ff",borderRadius:8,padding:"6px 12px",marginBottom:10}}><span style={{color:"#1d4ed8",fontSize:11,fontWeight:700}}>✅ اكتملت المقابلة — {(session?.questions||[]).length} سؤال</span></div>
        {(session?.questions||[]).map((q,i)=>{
          const ans=(session?.answers||a.interview_answers||{})[i];
          return(
            <div key={i} style={{background:"#f8fafc",borderRadius:10,padding:"10px 12px",marginBottom:8,border:"1px solid #e2e8f0"}}>
              <div style={{color:"#7c3aed",fontSize:10,fontWeight:800,marginBottom:4}}>سؤال {i+1}</div>
              <div style={{color:"#1e293b",fontSize:12,fontWeight:700,marginBottom:6,lineHeight:1.5}}>{q.ar}</div>
              <div style={{background:"#fff",borderRadius:8,padding:"8px 10px",borderRight:"3px solid #7c3aed"}}>
                <div style={{color:"#475569",fontSize:12,lineHeight:1.6}}>{ans||<span style={{color:"#94a3b8",fontStyle:"italic"}}>لم يُجب</span>}</div>
              </div>
            </div>
          );
        })}
        {/* إذا كانت الإجابات فقط بدون أسئلة */}
        {!session&&a.interview_answers&&Object.entries(a.interview_answers).map(([i,ans])=>(
          <div key={i} style={{background:"#f8fafc",borderRadius:10,padding:"8px 12px",marginBottom:6}}>
            <div style={{color:"#7c3aed",fontSize:10,fontWeight:700,marginBottom:3}}>سؤال {+i+1}</div>
            <div style={{color:"#1e293b",fontSize:12,lineHeight:1.6}}>{ans||"—"}</div>
          </div>
        ))}
      </div>}

      {/* تحليل AI */}
      <div style={s.sec}><div style={{color:"#1e293b",fontSize:13,fontWeight:800,marginBottom:12}}>🤖 تحليل الذكاء الاصطناعي</div>

        {/* أزرار التحليل */}
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <button onClick={runLocalAnalysis}
            style={{...s.bFull,background:"linear-gradient(135deg,#0891b2,#0e7490)",flex:1}}>
            ⚙️ محرك محلي (فوري)
          </button>
          <button onClick={genReport} disabled={loadingReport}
            style={{...s.bFull,background:"linear-gradient(135deg,#7c3aed,#6d28d9)",flex:1,opacity:loadingReport?0.6:1}}>
            {loadingReport?"⟳ جاري...":"🧠 Claude AI"}
          </button>
        </div>
        {aiReport?.engine==="local"&&<div style={{background:"#ecfeff",border:"1px solid #67e8f9",borderRadius:10,padding:"6px 12px",marginBottom:10,textAlign:"center"}}><span style={{color:"#0e7490",fontSize:11,fontWeight:700}}>⚙️ تحليل بالمحرك المحلي — بدون API خارجي، فوري ومجاني</span></div>}

        {/* عرض التقرير الذكي */}
        {(aiReport||a.ai_evaluation_json)&&(()=>{const ev=aiReport||a.ai_evaluation_json;return(<div>
          <div style={{textAlign:"center",marginBottom:14}}>
            <div style={{fontSize:42,fontWeight:900,color:"#E8712B"}}>{Number(a.ai_score_total||ev?.score_total||0).toFixed(1)}</div>
            <div style={{color:"#64748b",fontSize:11}}>الدرجة الكلية من 10</div>
          </div>
          {/* أشرطة الأداء */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            {[{l:"🏃 اللياقة",v:a.score_physical||ev?.score_physical||0,c:"#16a34a",w:"15%"},
              {l:"👨‍👩‍👧 المسؤولية",v:a.score_responsibility||ev?.score_responsibility||0,c:"#7c3aed",w:"25%"},
              {l:"🔧 الفني",v:a.ai_score_technical||ev?.score_technical||0,c:"#2563eb",w:"30%"},
              {l:"🧠 السلوكي",v:a.ai_score_behavioral||ev?.score_behavioral||0,c:"#E8712B",w:"30%"}
            ].map(d=><div key={d.l} style={{background:"#f8fafc",borderRadius:12,padding:"10px 12px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:10,color:"#64748b"}}>{d.w}</span>
                <span style={{fontSize:10,color:"#94a3b8"}}>{d.l}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{flex:1,height:6,background:"#e2e8f0",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(+d.v/10)*100}%`,background:d.c,borderRadius:3,transition:"width 0.5s"}}/>
                </div>
                <span style={{fontSize:14,fontWeight:900,color:d.c}}>{Number(d.v).toFixed(1)}</span>
              </div>
            </div>)}
          </div>
          {a.ai_classification&&<div style={{textAlign:"center",fontSize:14,fontWeight:800,color:CL[a.ai_classification]?.color,padding:"6px 0 10px"}}>{CL[a.ai_classification]?.ar}</div>}
          {ev&&<>
            {ev.technical_notes&&<EB c="#2563eb" t="🔧 الكفاءة الفنية" txt={ev.technical_notes}/>}
            {ev.behavioral_notes&&<EB c="#7c3aed" t="🧠 السلوكيات" txt={ev.behavioral_notes}/>}
            {ev.strengths?.length>0&&<EB c="#16a34a" t="✅ نقاط القوة" list={ev.strengths}/>}
            {ev.weaknesses?.length>0&&<EB c="#dc2626" t="⚠️ نقاط الضعف" list={ev.weaknesses}/>}
            {ev.recommendation&&<EB c="#1e293b" t="📋 التوصية النهائية" txt={ev.recommendation} accent/>}
            {ev.ariful_comparison&&<EB c="#7c3aed" t="⭐ مقارنة بأريفول" txt={ev.ariful_comparison} accent/>}
          </>}
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button onClick={genReport} disabled={loadingReport} style={{...s.bFull,background:"linear-gradient(135deg,#7c3aed,#6d28d9)",flex:2}}>{loadingReport?"⟳ جاري...":"🔄 إعادة التحليل"}</button>
            <button onClick={exportMD} style={{...s.bFull,background:"linear-gradient(135deg,#475569,#334155)",flex:1}}>📄 MD</button>
          </div>
        </div>);})()}

        {!a.ai_score_total&&!aiReport&&<p style={{color:"#94a3b8",fontSize:12,textAlign:"center",padding:"8px 0"}}>اضغط "تحليل ذكي شامل" للبدء</p>}
      </div>

      {/* إدارة المقابلة */}
      <div style={s.sec}><div style={{color:"#1e293b",fontSize:13,fontWeight:800,marginBottom:12}}>📅 إدارة المقابلة</div><div style={{display:"flex",flexDirection:"column",gap:10}}><button onClick={()=>setShowInvite(true)} style={{...s.bFull,background:"linear-gradient(135deg,#16a34a,#15803d)"}}>📱 إرسال دعوة مقابلة</button><button onClick={()=>setShowIQ(!showIQ)} style={{...s.bFull,background:"linear-gradient(135deg,#2563eb,#1d4ed8)"}}>🎯 إرسال أسئلة المقابلة</button>{iLink&&<div style={{background:"#eff6ff",border:"1px solid #93c5fd",borderRadius:12,padding:"10px 14px"}}><div style={{color:"#1d4ed8",fontSize:11,fontWeight:700,marginBottom:4}}>رابط المقابلة:</div><div style={{color:"#1e40af",fontSize:10,wordBreak:"break-all",marginBottom:8}}>{iLink}</div><button onClick={()=>{const msg=`🇸🇦 يرجى الإجابة على هذه الأسئلة:\n${iLink}\n\n🇬🇧 Please answer these questions:\n${iLink}\n\n🇧🇩 দয়া করে এই প্রশ্নগুলোর উত্তর দিন:\n${iLink}`;window.open(`https://wa.me/${a.whatsapp?.replace(/[^0-9]/g,"")}?text=${encodeURIComponent(msg)}`);}} style={{...s.bFull,background:"linear-gradient(135deg,#16a34a,#15803d)"}}>📱 إرسال على واتساب</button></div>}</div>{showIQ&&<IQPanel applicant={a} onGenerated={l=>{setILink(l);setShowIQ(false);}}/>}</div>

      {/* تغيير الحالة */}
      <div style={s.sec}><div style={{color:"#1e293b",fontSize:13,fontWeight:800,marginBottom:10}}>📌 تغيير الحالة</div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{Object.entries(ST).map(([k,v])=><button key={k} onClick={()=>{onStatus(a.id,k);logOutcome(a.id,k,a.ai_classification);}} style={{padding:"8px 14px",border:`2px solid ${v.color}`,borderRadius:12,fontSize:11,fontWeight:700,cursor:"pointer",background:a.status===k?v.color:"#fff",color:a.status===k?"#fff":v.color}}>{v.ar}</button>)}</div>
        {(()=>{const stats=getLearningStats();return stats.total_decisions>0?<div style={{marginTop:10,background:"#f8fafc",borderRadius:10,padding:"8px 12px"}}><div style={{color:"#64748b",fontSize:10}}>📊 قرارات مسجّلة للتعلم: <strong>{stats.total_decisions}</strong> {stats.ready_for_calibration?"— جاهز للمعايرة! 🎉":`(يحتاج ${30-stats.total_decisions} إضافية للمعايرة)`}</div></div>:null;})()}
      </div>

      {/* ملاحظات */}
      <div style={s.sec}><div style={{color:"#1e293b",fontSize:13,fontWeight:800,marginBottom:10}}>📝 ملاحظاتي</div><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="أضف ملاحظاتك..." style={{...s.inp,resize:"vertical",width:"100%",boxSizing:"border-box"}}/><button onClick={save} disabled={saving} style={{...s.bFull,marginTop:8,background:"linear-gradient(135deg,#16a34a,#15803d)"}}>{saving?"جاري الحفظ...":"💾 حفظ الملاحظات"}</button></div>

      {/* حذف */}
      <div style={s.sec}><div style={{color:"#1e293b",fontSize:13,fontWeight:800,marginBottom:10}}>⚠️ منطقة الخطر</div>{!del?<button onClick={()=>setDel(true)} style={{...s.bFull,background:"#fff",border:"2px solid #dc2626",color:"#dc2626"}}>🗑️ حذف هذا الطلب</button>:<div style={{background:"#fff5f5",border:"1.5px solid #dc2626",borderRadius:12,padding:14}}><div style={{color:"#dc2626",fontWeight:700,fontSize:13,textAlign:"right",marginBottom:10}}>⚠️ هل أنت متأكد؟</div><div style={{display:"flex",gap:8}}><button onClick={()=>onDelete(a.id)} style={{...s.bFull,background:"#dc2626"}}>نعم</button><button onClick={()=>setDel(false)} style={{...s.bFull,background:"#f1f5f9",color:"#475569"}}>إلغاء</button></div></div>}</div>
    </div>
    {showInvite&&<InviteModal a={a} onClose={()=>setShowInvite(false)}/>}
  </div>);
}
function InviteModal({a,onClose}){const[date,setDate]=useState("");const[time,setTime]=useState("");const[loc,setLoc]=useState("");const send=()=>{if(!date||!time){alert("يرجى تحديد التاريخ والوقت");return;}const msg=`🇸🇦 *دعوة مقابلة شخصية*\nالسلام عليكم ${a.full_name}،\nاجتزت المرحلة الأولى (طلب #${a.application_number}) ✅\n📅 ${date} | ⏰ ${time} | 📍 ${loc||"سيتم تحديده"}\nيرجى التأكيد.\n\n🇬🇧 *Interview Invitation*\n${date} | ${time} | ${loc||"TBC"}\n\n🇧🇩 *সাক্ষাৎকার*\n📅 ${date} | ⏰ ${time}`;window.open(`https://wa.me/${a.whatsapp?.replace(/[^0-9]/g,"")}?text=${encodeURIComponent(msg)}`);onClose();};return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:16}}><div style={{background:"#fff",borderRadius:20,padding:"24px 20px",width:"100%",maxWidth:400}}><div style={{color:"#1e293b",fontSize:16,fontWeight:900,textAlign:"right",marginBottom:16}}>📅 دعوة مقابلة — {a.full_name}</div><div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>{[["التاريخ *","date",date,setDate],["الوقت *","time",time,setTime],["المكان","text",loc,setLoc]].map(([l,t,v,fn])=><div key={l}><div style={{color:"#1e293b",fontSize:12,fontWeight:700,textAlign:"right",marginBottom:3}}>{l}</div><input type={t} value={v} onChange={e=>fn(e.target.value)} style={{width:"100%",padding:"10px 12px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>)}</div><button onClick={send} style={{...s.bFull,background:"linear-gradient(135deg,#16a34a,#15803d)",marginBottom:8}}>📱 إرسال واتساب</button><button onClick={onClose} style={{...s.bFull,background:"#f1f5f9",color:"#475569"}}>إلغاء</button></div></div>);}
function IQPanel({applicant:a,onGenerated}){const[loading,setLoading]=useState(false);const BASE=[{ar:"صِف موقفاً صعباً مررت به — كيف تصرفت؟",bn:"কঠিন পরিস্থিতি?"},{ar:"كيف تتعامل مع طلب خارج التطبيق؟",bn:"অ্যাপের বাইরের অনুরোধ?"},{ar:"إذا طلب المشرف شيئاً تعتقد أنه خطأ؟",bn:"সুপারভাইজার ভুল?"},{ar:"كيف تدير وقتك مع طلبات متعددة؟",bn:"একাধিক অর্ডার?"},{ar:"أمامك سيارة — اشرح الغسيل وأنت تنفذه",bn:"গাড়ি ধোয়ার ধাপ বলুন"}];
const weak=[];const checks=[{q:"لماذا تركت العمل؟",a:a.q3_left_previous_job},{q:"الخصم من الراتب؟",a:a.q4_salary_deduction},{q:"هدفك بعد سنة؟",a:a.q5_one_year_goal},{q:"زميل مشكلة؟",a:a.q6_difficult_colleague}];
checks.forEach(c=>{if(!c.a||c.a.length<20)weak.push({ar:`أجبت بشكل مختصر على "${c.q}" — أعد الإجابة`,bn:`বিস্তারিত উত্তর দিন`});});
const all=[...weak,...BASE];
const gen=async()=>{setLoading(true);try{const{data}=await supabase.from("interview_sessions").insert({applicant_id:a.id,questions:all,status:"pending"}).select().single();if(data)onGenerated(`${SITE_URL}?interview=${data.id}`);}catch(e){alert("خطأ: "+e.message);}setLoading(false);};
return(<div style={{background:"#eff6ff",border:"1px solid #93c5fd",borderRadius:14,padding:14,marginTop:10}}><div style={{color:"#1d4ed8",fontSize:12,fontWeight:800,marginBottom:8}}>الأسئلة ({all.length}):</div>{weak.length>0&&<div style={{background:"#fef9c3",borderRadius:8,padding:"4px 10px",marginBottom:6,color:"#854d0e",fontSize:11,fontWeight:700}}>⚠️ {weak.length} أسئلة متابعة</div>}{all.map((q,i)=><div key={i} style={{color:"#1e40af",fontSize:10,marginBottom:2}}>{i+1}. {q.ar}</div>)}<button onClick={gen} disabled={loading} style={{...s.bFull,background:"linear-gradient(135deg,#2563eb,#1d4ed8)",marginTop:10}}>{loading?"⟳ جاري...":"🔗 إنشاء الرابط"}</button></div>);}
function EmpCard({e,onClick}){return(<div style={s.card} onClick={onClick}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{background:"#fff7ed",color:"#E8712B",fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:20,border:"1px solid #fed7aa"}}>{e.employee_id||"—"}</div><div style={{color:"#1e293b",fontSize:14,fontWeight:800}}>{e.full_name||"—"}</div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>{[[e.nationality,"🌍"],[e.mobile,"📱"],[e.source,"📥"],[e.time_in_saudi,"⏱️"]].map(([v,ic],i)=>v?<div key={i} style={{color:"#64748b",fontSize:11}}>{ic} {v}</div>:null)}</div></div>);}
function EmpDetail({e,onBack,onDelete}){const[del,setDel]=useState(false);const FIELDS=[["القسم الأول",null],["الاسم",e.full_name],["رقم الهوية",e.id_number],["الجوال",e.mobile],["الميلاد",e.date_of_birth],["الجنسية",e.nationality],["ID سويتر",e.employee_id],["القسم الثاني",null],["الدولة الأصلية",e.home_country],["المنطقة",e.region],["المدينة",e.city],["المدة في السعودية",e.time_in_saudi],["السكن الرياض",e.residence_riyadh],["القسم الثالث",null],["المصدر",e.source],["المحيل",e.referrer_name],["الصلة",e.referrer_relation],["أقارب في الفريق",e.has_relative_in_team],["اسم القريب",e.relative_name],["القسم الرابع",null],["العمل السابق",e.previous_job],["خبرة الغسيل",e.car_wash_experience],["عمل مع تطبيقات",e.worked_with_app]];
return(<div style={s.root}><div style={{background:"linear-gradient(135deg,#1e293b,#334155)",padding:"14px 20px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:100}}><button onClick={onBack} style={s.bSm}>← رجوع</button><div style={{flex:1,textAlign:"right"}}><div style={{color:"#fff",fontSize:15,fontWeight:900}}>{e.full_name}</div><div style={{color:"rgba(255,255,255,0.6)",fontSize:11}}>ID: {e.employee_id||"—"}</div></div></div><div style={{padding:"12px 16px 80px",display:"flex",flexDirection:"column",gap:12,maxWidth:560,margin:"0 auto"}}><div style={s.sec}>{FIELDS.map(([l,v],i)=>l.includes("القسم")?<div key={i} style={{color:"#E8712B",fontSize:12,fontWeight:900,marginTop:i>0?10:0,marginBottom:4,borderBottom:"1px solid #f1f5f9",paddingBottom:3}}>{l}</div>:v?<div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:5}}><div style={{color:"#94a3b8",fontSize:11,textAlign:"right"}}>{l}</div><div style={{color:"#1e293b",fontSize:12,fontWeight:600,textAlign:"right"}}>{v}</div></div>:null)}</div><div style={s.sec}><div style={{color:"#1e293b",fontSize:13,fontWeight:800,marginBottom:10}}>⚠️ منطقة الخطر</div>{!del?<button onClick={()=>setDel(true)} style={{...s.bFull,background:"#fff",border:"2px solid #dc2626",color:"#dc2626"}}>🗑️ حذف</button>:<div style={{background:"#fff5f5",border:"1.5px solid #dc2626",borderRadius:12,padding:14}}><div style={{color:"#dc2626",fontWeight:700,textAlign:"right",marginBottom:10}}>⚠️ هل أنت متأكد؟</div><div style={{display:"flex",gap:8}}><button onClick={()=>onDelete(e.id)} style={{...s.bFull,background:"#dc2626"}}>نعم</button><button onClick={()=>setDel(false)} style={{...s.bFull,background:"#f1f5f9",color:"#475569"}}>إلغاء</button></div></div>}</div></div></div>);}
function EB({c,t,txt,list,accent}){return(<div style={{background:accent?"#fdf4ff":"#f8fafc",borderRadius:10,padding:"8px 12px",marginBottom:6,...(accent?{borderRight:`3px solid ${c}`}:{})}}><div style={{color:c,fontWeight:700,fontSize:11,marginBottom:3}}>{t}</div>{txt&&<div style={{color:"#475569",fontSize:12,lineHeight:1.6}}>{txt}</div>}{list?.map((x,i)=><div key={i} style={{color:"#475569",fontSize:12}}>• {x}</div>)}</div>);}
function FCard({l,url,type}){return(<div style={{background:"#f8fafc",borderRadius:12,padding:10,textAlign:"center",minWidth:80}}><div style={{color:"#64748b",fontSize:10,marginBottom:6,fontWeight:600}}>{l}</div>{type==="image"?<img src={url} alt={l} style={{width:70,height:70,objectFit:"cover",borderRadius:8,cursor:"pointer"}} onClick={()=>window.open(url,"_blank")}/>:<a href={url} target="_blank" rel="noreferrer" style={{display:"block",padding:"6px",background:"#2563eb",borderRadius:8,color:"#fff",fontSize:10,fontWeight:700,textDecoration:"none"}}>▶ مشاهدة</a>}</div>);}
const s={root:{minHeight:"100dvh",background:"#f8fafc",fontFamily:"'Segoe UI',Tahoma,sans-serif",direction:"rtl"},hdr:{background:"linear-gradient(135deg,#E8712B,#CC5200)",padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100},hT:{color:"#fff",fontSize:18,fontWeight:900},hS:{color:"rgba(255,255,255,0.75)",fontSize:11},bSm:{padding:"8px 14px",background:"rgba(255,255,255,0.2)",border:"none",borderRadius:10,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"},statsR:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,padding:"12px 16px"},stCard:{background:"#fff",borderRadius:12,padding:"12px 10px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},tb:{padding:"0 16px 12px",display:"flex",gap:8},sInp:{flex:1,padding:"10px 14px",border:"1.5px solid #e2e8f0",borderRadius:12,fontSize:12,outline:"none",direction:"rtl"},fSel:{padding:"10px 12px",border:"1.5px solid #e2e8f0",borderRadius:12,fontSize:11,outline:"none",background:"#fff"},lst:{padding:"0 16px 80px",display:"flex",flexDirection:"column",gap:10},emp:{textAlign:"center",color:"#94a3b8",padding:"40px 0",fontSize:13},card:{background:"#fff",borderRadius:16,padding:"14px 16px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",cursor:"pointer",border:"1.5px solid #f1f5f9"},sec:{background:"#fff",borderRadius:16,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},inp:{width:"100%",padding:"10px 12px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:13,outline:"none",direction:"rtl",fontFamily:"inherit"},bFull:{width:"100%",padding:12,border:"none",borderRadius:12,color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer"}};
