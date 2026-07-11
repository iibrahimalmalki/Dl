import{useState,useEffect}from"react";
import{supabase,SITE_URL}from"./supabase";
import{calcGeoScore,ZONE_COLORS}from"./geoScoring";
import{analyzeApplicantLocal,logOutcome,getLearningStats,ARIFUL_BENCHMARK}from"./localAI";
const ST={pending:{ar:"قيد المراجعة",color:"#f59e0b",bg:"#fffbeb"},shortlisted:{ar:"مرشح",color:"#2563eb",bg:"#eff6ff"},interview:{ar:"مقابلة",color:"#7c3aed",bg:"#f5f3ff"},accepted:{ar:"مقبول",color:"#16a34a",bg:"#f0fdf4"},rejected:{ar:"مرفوض",color:"#dc2626",bg:"#fff5f5"}};
const CL={strong:{ar:"مرشح قوي ⭐",color:"#16a34a"},accepted:{ar:"مقبول ✅",color:"#2563eb"},needs_interview:{ar:"يحتاج مقابلة 🔍",color:"#f59e0b"},rejected:{ar:"غير مناسب ❌",color:"#dc2626"}};
export default function AdminDashboard({onLogout}){
  const[list,setList]=useState([]);const[loading,setLoading]=useState(true);const[sel,setSel]=useState(null);const[filter,setFilter]=useState("all");const[geoFilter,setGeoFilter]=useState("all");const[sortBy,setSortBy]=useState("number");const[search,setSearch]=useState("");const[analyzing,setAnalyzing]=useState(null);const[tab,setTab]=useState("applicants");
  const[empList,setEmpList]=useState([]);const[empLoading,setEmpLoading]=useState(false);const[selEmp,setSelEmp]=useState(null);const[empSearch,setEmpSearch]=useState("");
  const[compareMode,setCompareMode]=useState(false);const[compareIds,setCompareIds]=useState([]);const[showCompare,setShowCompare]=useState(false);const[showStats,setShowStats]=useState(false);const[visits,setVisits]=useState([]);
  useEffect(()=>{load();},[]);
  const load=async()=>{setLoading(true);const{data}=await supabase.from("applicants").select("*").order("application_number",{ascending:true});setList(data||[]);setLoading(false);};
  const loadEmp=async()=>{setEmpLoading(true);const{data}=await supabase.from("employees").select("*").order("created_at",{ascending:false});setEmpList(data||[]);setEmpLoading(false);};
  const loadVisits=async()=>{const{data}=await supabase.from("page_visits").select("*").order("created_at",{ascending:false}).limit(3000);setVisits(data||[]);};
  useEffect(()=>{if(tab==="employees"&&empList.length===0)loadEmp();if(tab==="visits")loadVisits();},[tab]);

  const transferToEmployee=async(a)=>{
    try{
      const{data:existing}=await supabase.from("employees").select("id").eq("applicant_id",a.id).maybeSingle();
      if(existing)return existing.id;
      const hasWashExp=a.car_wash_description&&a.car_wash_description.trim().length>15;
      const{data:inserted,error}=await supabase.from("employees").insert({
        applicant_id:a.id,
        full_name:a.full_name,
        id_number:a.passport_or_iqama,
        mobile:a.whatsapp,
        nationality:"بنغلادشي",
        home_country:"بنغلادش",
        region:a.bangladesh_district,
        city:a.bangladesh_city,
        residence_riyadh:a.location==="inside_ksa"?(a.saudi_city||""):"",
        source:"منصة التوظيف",
        car_wash_experience:hasWashExp?"لديه خبرة (من الاستمارة)":"",
        worked_with_app:"",
      }).select().single();
      if(error){console.log("transfer error",error);return null;}
      return inserted?.id||null;
    }catch(e){console.log("transfer error",e);return null;}
  };

  const upStatus=async(id,status)=>{
    const a=list.find(x=>x.id===id);
    const hist=[...(a?.status_history||[]),{status,at:new Date().toISOString()}];
    await supabase.from("applicants").update({status,status_history:hist}).eq("id",id);
    setList(p=>p.map(x=>x.id===id?{...x,status,status_history:hist}:x));
    if(sel?.id===id)setSel(p=>({...p,status,status_history:hist}));
    logOutcome(id,status,a?.ai_classification);
    if(status==="accepted"&&a){
      const empId=await transferToEmployee(a);
      if(a.whatsapp){
        const link=empId?`${SITE_URL}/?employee=${empId}`:SITE_URL;
        const msg=`🎉 السلام عليكم ${a.full_name}،\nمبروك! تم قبولك ضمن فريقنا.\n\nيرجى إكمال ملفك عبر الرابط التالي لإتمام إجراءات التوظيف:\n${link}\n\n🎉 আসসালামু আলাইকুম ${a.full_name},\nঅভিনন্দন! আপনি আমাদের টিমে গৃহীত হয়েছেন।\n\nনিয়োগ প্রক্রিয়া সম্পন্ন করতে অনুগ্রহ করে এই লিংকে গিয়ে প্রোফাইল সম্পূর্ণ করুন:\n${link}`;
        window.open(`https://wa.me/${a.whatsapp?.replace(/[^0-9]/g,"")}?text=${encodeURIComponent(msg)}`);
      }
    }
    if(status==="rejected"&&a?.whatsapp){
      const msg=`السلام عليكم ${a.full_name}،\nشكراً لاهتمامك بالانضمام لفريقنا. بعد المراجعة، لم نتمكن من المتابعة في هذه المرحلة.\nنتمنى لك التوفيق ونرحب بتقديمك مستقبلاً.\n\nআসসালামু আলাইকুম ${a.full_name},\nআমাদের টিমে আগ্রহের জন্য ধন্যবাদ। পর্যালোচনার পর, এই মুহূর্তে আমরা এগিয়ে যেতে পারছি না।\nআপনার জন্য শুভকামনা।`;
      window.open(`https://wa.me/${a.whatsapp?.replace(/[^0-9]/g,"")}?text=${encodeURIComponent(msg)}`);
    }
  };
  const saveNotes=async(id,n)=>{await supabase.from("applicants").update({admin_notes:n}).eq("id",id);setList(p=>p.map(a=>a.id===id?{...a,admin_notes:n}:a));};
  const delApp=async(id)=>{await supabase.from("applicants").delete().eq("id",id);setList(p=>p.filter(a=>a.id!==id));setSel(null);};
  const delEmp=async(id)=>{await supabase.from("employees").delete().eq("id",id);setEmpList(p=>p.filter(e=>e.id!==id));setSelEmp(null);};
  const analyze=async(a)=>{setAnalyzing(a.id);try{const res=await fetch("https://cnmggdrlkgsyrjxmvydv.supabase.co/functions/v1/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({applicant:a})});if(!res.ok)throw new Error(`${res.status}`);const ev=await res.json();if(ev.error)throw new Error(ev.error);await supabase.from("applicants").update({ai_score_total:ev.score_total,ai_score_technical:ev.score_technical,ai_score_behavioral:ev.score_behavioral,score_physical:ev.score_physical,score_responsibility:ev.score_responsibility,ai_classification:ev.classification,ai_notes:ev.recommendation,ai_evaluation_json:ev}).eq("id",a.id);setList(p=>p.map(x=>x.id===a.id?{...x,ai_score_total:ev.score_total,ai_classification:ev.classification,ai_evaluation_json:ev}:x));if(sel?.id===a.id)setSel(p=>({...p,ai_evaluation_json:ev,ai_score_total:ev.score_total,ai_classification:ev.classification}));}catch(e){alert("خطأ: "+e.message);}setAnalyzing(null);};

  const geoOf=a=>a.bangladesh_district?calcGeoScore(a.bangladesh_district):null;
  let filtered=list.filter(a=>{const mf=filter==="all"||a.status===filter||a.ai_classification===filter;const ms=!search||a.full_name?.toLowerCase().includes(search.toLowerCase())||a.whatsapp?.includes(search)||String(a.application_number).includes(search);const g=geoOf(a);const mg=geoFilter==="all"||(g&&g.zone===geoFilter);return mf&&ms&&mg;});
  filtered=[...filtered].sort((x,y)=>{
    if(sortBy==="score")return(y.ai_score_total||0)-(x.ai_score_total||0);
    if(sortBy==="geo")return((geoOf(y)?.score)||0)-((geoOf(x)?.score)||0);
    return(x.application_number||0)-(y.application_number||0);
  });
  const stats={total:list.length,pending:list.filter(a=>a.status==="pending").length,strong:list.filter(a=>a.ai_classification==="strong").length,accepted:list.filter(a=>a.status==="accepted").length};

  const exportCSV=()=>{
    const rows=[["#","الاسم","واتساب","الحالة","تصنيف AI","الدرجة","المحافظة","نقاط المنطقة","مستعد للرياض","الرخصة"]];
    filtered.forEach(a=>{const g=geoOf(a);rows.push([a.application_number,a.full_name,a.whatsapp,ST[a.status]?.ar||a.status,CL[a.ai_classification]?.ar||"—",a.ai_score_total||"—",a.bangladesh_district||"—",g?.score||"—",a.ready_for_riyadh==="yes"?"نعم":a.ready_for_riyadh==="no"?"لا":"—",a.has_license?"نعم":"لا"]);});
    const csv="\uFEFF"+rows.map(r=>r.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=`applicants_${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);
  };

  const toggleCompare=id=>setCompareIds(p=>p.includes(id)?p.filter(x=>x!==id):p.length<3?[...p,id]:p);

  if(sel)return <Detail a={sel} onBack={()=>setSel(null)} onStatus={upStatus} onAnalyze={analyze} onSaveNotes={saveNotes} onDelete={delApp} analyzing={analyzing===sel.id}/>;
  if(selEmp)return <EmpDetail e={selEmp} onBack={()=>setSelEmp(null)} onDelete={delEmp} onUpdate={updated=>{setEmpList(p=>p.map(x=>x.id===updated.id?updated:x));setSelEmp(updated);}}/>;
  if(showCompare)return <ComparePanel ids={compareIds} list={list} onBack={()=>setShowCompare(false)}/>;
  if(showStats)return <StatsPanel list={list} onBack={()=>setShowStats(false)}/>;
  return(<div style={s.root}>
    <div style={s.hdr}><div><div style={s.hT}>لوحة التحكم</div><div style={s.hS}>دلو ورغوة</div></div><div style={{display:"flex",gap:8}}><button onClick={()=>{load();if(tab==="employees")loadEmp();if(tab==="visits")loadVisits();}} style={s.bSm}>🔄</button><button onClick={onLogout} style={{...s.bSm,background:"rgba(0,0,0,0.2)"}}>خروج</button></div></div>
    <div style={{display:"flex",borderBottom:"2px solid #f1f5f9",background:"#fff",overflowX:"auto"}}>
      <button onClick={()=>setTab("applicants")} style={{flex:1,padding:"12px 8px",border:"none",background:"none",fontSize:12,fontWeight:700,color:tab==="applicants"?"#E8712B":"#64748b",borderBottom:tab==="applicants"?"2px solid #E8712B":"2px solid transparent",cursor:"pointer",whiteSpace:"nowrap"}}>📋 المتقدمون ({list.length})</button>
      <button onClick={()=>setTab("employees")} style={{flex:1,padding:"12px 8px",border:"none",background:"none",fontSize:12,fontWeight:700,color:tab==="employees"?"#E8712B":"#64748b",borderBottom:tab==="employees"?"2px solid #E8712B":"2px solid transparent",cursor:"pointer",whiteSpace:"nowrap"}}>👤 الموظفون ({empList.length})</button>
      <button onClick={()=>setTab("visits")} style={{flex:1,padding:"12px 8px",border:"none",background:"none",fontSize:12,fontWeight:700,color:tab==="visits"?"#E8712B":"#64748b",borderBottom:tab==="visits"?"2px solid #E8712B":"2px solid transparent",cursor:"pointer",whiteSpace:"nowrap"}}>👁️ الزيارات</button>
    </div>
    {tab==="applicants"&&<>
      <div style={s.statsR}>{[{l:"إجمالي",v:stats.total,c:"#E8712B"},{l:"قيد المراجعة",v:stats.pending,c:"#f59e0b"},{l:"أقوياء",v:stats.strong,c:"#16a34a"},{l:"مقبولون",v:stats.accepted,c:"#2563eb"}].map(st=><div key={st.l} style={s.stCard}><div style={{fontSize:22,fontWeight:900,color:st.c}}>{st.v}</div><div style={{fontSize:10,color:"#64748b",marginTop:2}}>{st.l}</div></div>)}</div>
      <div style={{padding:"0 16px 8px",display:"flex",gap:8}}>
        <button onClick={()=>setShowStats(true)} style={{flex:1,padding:"8px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,fontSize:11,fontWeight:700,color:"#16a34a",cursor:"pointer"}}>📊 إحصائيات شهرية</button>
        <button onClick={exportCSV} style={{flex:1,padding:"8px",background:"#eff6ff",border:"1px solid #93c5fd",borderRadius:10,fontSize:11,fontWeight:700,color:"#2563eb",cursor:"pointer"}}>📥 تصدير Excel</button>
        <button onClick={()=>{setCompareMode(!compareMode);setCompareIds([]);}} style={{flex:1,padding:"8px",background:compareMode?"#7c3aed":"#f5f3ff",border:"1px solid #c4b5fd",borderRadius:10,fontSize:11,fontWeight:700,color:compareMode?"#fff":"#7c3aed",cursor:"pointer"}}>⚖️ {compareMode?"إلغاء المقارنة":"مقارنة"}</button>
      </div>
      {compareMode&&<div style={{padding:"0 16px 8px"}}><div style={{background:"#f5f3ff",borderRadius:10,padding:"8px 12px",fontSize:11,color:"#6d28d9",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>اختر حتى 3 متقدمين ({compareIds.length}/3)</span>{compareIds.length>=2&&<button onClick={()=>setShowCompare(true)} style={{padding:"4px 12px",background:"#7c3aed",border:"none",borderRadius:8,color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer"}}>قارن الآن ←</button>}</div></div>}
      <div style={s.tb}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 بحث..." style={s.sInp}/></div>
      <div style={{padding:"0 16px 8px",display:"flex",gap:8}}>
        <select value={filter} onChange={e=>setFilter(e.target.value)} style={{...s.fSel,flex:1}}><option value="all">كل الحالات</option><option value="pending">قيد المراجعة</option><option value="strong">AI: قوي</option><option value="interview">مقابلة</option><option value="accepted">مقبول</option><option value="rejected">مرفوض</option></select>
        <select value={geoFilter} onChange={e=>setGeoFilter(e.target.value)} style={{...s.fSel,flex:1}}><option value="all">كل المناطق</option><option value="green">🟢 خضراء</option><option value="yellow">🟡 صفراء</option><option value="red">🔴 محظورة</option></select>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{...s.fSel,flex:1}}><option value="number">ترتيب الطلب</option><option value="score">الأعلى درجة</option><option value="geo">الأفضل منطقة</option></select>
      </div>
      <div style={s.lst}>{loading&&<div style={s.emp}>جاري التحميل...</div>}{!loading&&filtered.length===0&&<div style={s.emp}>لا يوجد متقدمون</div>}{filtered.map(a=><Card key={a.id} a={a} onClick={()=>compareMode?toggleCompare(a.id):setSel(a)} onAnalyze={analyze} analyzing={analyzing===a.id} compareMode={compareMode} selected={compareIds.includes(a.id)}/>)}</div>
    </>}
    {tab==="employees"&&<>
      <div style={{padding:"12px 16px 4px",display:"flex",gap:8}}><input value={empSearch} onChange={e=>setEmpSearch(e.target.value)} placeholder="🔍 بحث..." style={s.sInp}/><button onClick={loadEmp} style={{padding:"10px 12px",background:"#f1f5f9",border:"none",borderRadius:10,fontSize:11,cursor:"pointer",flexShrink:0}}>🔄</button></div>
      <div style={{padding:"0 16px 4px"}}><span style={{color:"#64748b",fontSize:11}}>إجمالي: <strong>{empList.length}</strong></span></div>
      <div style={s.lst}>{empLoading&&<div style={s.emp}>جاري التحميل...</div>}{!empLoading&&empList.length===0&&<div style={s.emp}>لا يوجد موظفون</div>}{empList.filter(e=>!empSearch||e.full_name?.toLowerCase().includes(empSearch.toLowerCase())||e.employee_id?.includes(empSearch)||e.mobile?.includes(empSearch)).map(e=><EmpCard key={e.id} e={e} onClick={()=>setSelEmp(e)}/>)}</div>
    </>}
    {tab==="visits"&&<VisitsPanel visits={visits}/>}
  </div>);
}
function Card({a,onClick,onAnalyze,analyzing,compareMode,selected}){const st=ST[a.status]||ST.pending;const cl=a.ai_classification?CL[a.ai_classification]:null;const geo=a.bangladesh_district?calcGeoScore(a.bangladesh_district):null;const riyadhWarn=a.location==="inside_ksa"&&a.ready_for_riyadh==="no";return(<div style={{...s.card,...(compareMode&&selected?{border:"2px solid #7c3aed",background:"#f5f3ff"}:{}),...(riyadhWarn?{borderRight:"3px solid #dc2626"}:{})}} onClick={onClick}>{compareMode&&<div style={{marginBottom:6}}><input type="checkbox" checked={selected} readOnly style={{accentColor:"#7c3aed"}}/></div>}<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}><div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"flex-end",marginBottom:3}}><div style={{color:"#1e293b",fontSize:14,fontWeight:800}}>{a.full_name||"—"}</div>{a.application_number&&<div style={{background:"#fff7ed",color:"#E8712B",fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:20,border:"1px solid #fed7aa"}}>#{a.application_number}</div>}</div><div style={{color:"#64748b",fontSize:11,marginBottom:2}}>{a.whatsapp} · {a.age} سنة</div>{(a.bangladesh_district||a.saudi_city)&&<div style={{color:"#94a3b8",fontSize:10,marginBottom:2}}>{a.location==="inside_ksa"?`🇸🇦 ${a.saudi_city||"—"}`:a.bangladesh_district?`🇧🇩 ${a.bangladesh_district} — ${a.bangladesh_city||""}`:""}</div>}{riyadhWarn&&<div style={{background:"#fff5f5",border:"1px solid #fca5a5",borderRadius:8,padding:"2px 8px",display:"inline-block",marginTop:2,marginLeft:4}}><span style={{color:"#dc2626",fontSize:10,fontWeight:800}}>⚠️ غير مستعد للرياض</span></div>}{geo&&<div style={{background:ZONE_COLORS[geo.zone].bg,border:`1px solid ${ZONE_COLORS[geo.zone].border}`,borderRadius:8,padding:"2px 8px",display:"inline-block",marginTop:2}}><span style={{color:ZONE_COLORS[geo.zone].text,fontSize:10,fontWeight:700}}>{geo.zone==="green"?"🟢":geo.zone==="yellow"?"🟡":"🔴"} {geo.score}/100</span></div>}</div><div>{a.ai_score_total!=null?<div style={{width:46,height:46,borderRadius:"50%",background:"linear-gradient(135deg,#E8712B,#f59e0b)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}><div style={{color:"#fff",fontSize:14,fontWeight:900,lineHeight:1}}>{Number(a.ai_score_total).toFixed(1)}</div><div style={{color:"rgba(255,255,255,0.8)",fontSize:9}}>/10</div></div>:<div style={{width:46,height:46,borderRadius:"50%",background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",color:"#94a3b8",fontSize:18}}>—</div>}</div></div><div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><div style={{padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700,color:st.color,background:st.bg}}>{st.ar}</div>{cl&&<div style={{padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700,color:cl.color,background:"#f8fafc"}}>{cl.ar}</div>}<div style={{flex:1}}/>{!compareMode&&!a.ai_score_total&&<button onClick={e=>{e.stopPropagation();onAnalyze(a);}} disabled={analyzing} style={{padding:"5px 10px",background:"linear-gradient(135deg,#7c3aed,#6d28d9)",border:"none",borderRadius:8,color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer"}}>{analyzing?"⟳":"🤖 AI"}</button>}</div></div>);}

function VisitsPanel({visits}){
  const today=new Date().toDateString();
  const todayCount=visits.filter(v=>new Date(v.created_at).toDateString()===today).length;
  const byDay={};visits.forEach(v=>{const d=new Date(v.created_at).toLocaleDateString("ar-SA");byDay[d]=(byDay[d]||0)+1;});
  const days=Object.entries(byDay).slice(0,14);

  // قمع التحويل — يحسب عدد الجلسات الفريدة التي وصلت كل خطوة
  const buildFunnel=(page,stepDefs)=>{
    const rows=visits.filter(v=>v.page===page&&v.step);
    return stepDefs.map(([key,label])=>{
      const sessions=new Set(rows.filter(v=>v.step===key).map(v=>v.session_id).filter(Boolean));
      return{key,label,count:sessions.size};
    });
  };
  const adFunnel=buildFunnel("ad_page",[
    ["0_landed","دخول الصفحة"],
    ["1_benefits","وصل قسم المزايا"],
    ["2_calculator","وصل الحاسبة"],
    ["3_day_in_life","وصل يوم العمل"],
    ["4_faq","وصل الأسئلة الشائعة"],
    ["5_final_cta","وصل القسم الختامي"],
  ]);
  const formFunnel=buildFunnel("application_form",[
    ["step_1","بياناتك"],
    ["step_2","الرخصة"],
    ["step_3","المستندات"],
    ["step_4","الكفاءة"],
    ["step_5","سلوكيات"],
    ["step_6","تأكيد"],
    ["step_7_submitted","✅ أُرسل فعلياً"],
  ]);

  const Funnel=({title,data})=>{
    const max=data[0]?.count||1;
    return(<div style={s.sec}>
      <div style={{color:"#1e293b",fontSize:13,fontWeight:800,marginBottom:12}}>{title}</div>
      {data.every(d=>d.count===0)?<div style={{color:"#94a3b8",fontSize:12,textAlign:"center",padding:16}}>لا توجد بيانات كافية بعد</div>:
      data.map((d,i)=>{
        const prev=i>0?data[i-1].count:d.count;
        const dropPct=prev>0?Math.round(((prev-d.count)/prev)*100):0;
        const widthPct=max>0?Math.max(8,(d.count/max)*100):0;
        return(<div key={d.key} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
            <span style={{color:"#1e293b",fontSize:11,fontWeight:700}}>{d.label}</span>
            <span style={{color:"#64748b",fontSize:11}}>{d.count} {i>0&&dropPct>0&&<span style={{color:dropPct>=40?"#dc2626":dropPct>=20?"#d97706":"#94a3b8",fontWeight:700}}> (تسرب {dropPct}%)</span>}</span>
          </div>
          <div style={{height:10,background:"#f1f5f9",borderRadius:6,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${widthPct}%`,background:i===data.length-1?"#16a34a":dropPct>=40?"#dc2626":"#E8712B",borderRadius:6,transition:"width 0.5s"}}/>
          </div>
        </div>);
      })}
    </div>);
  };

  return(<div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <div style={s.stCard}><div style={{fontSize:22,fontWeight:900,color:"#E8712B"}}>{visits.length}</div><div style={{fontSize:10,color:"#64748b",marginTop:2}}>إجمالي الأحداث المسجّلة</div></div>
      <div style={s.stCard}><div style={{fontSize:22,fontWeight:900,color:"#16a34a"}}>{todayCount}</div><div style={{fontSize:10,color:"#64748b",marginTop:2}}>أحداث اليوم</div></div>
    </div>

    <Funnel title="📊 قمع صفحة الإعلان — أين يتوقف الزائر؟" data={adFunnel}/>
    <Funnel title="📝 قمع استمارة التقديم — أين يتسرب المتقدم؟" data={formFunnel}/>

    <div style={s.sec}><div style={{color:"#1e293b",fontSize:13,fontWeight:800,marginBottom:10}}>📅 آخر 14 يوماً</div>
      {days.length===0&&<div style={{color:"#94a3b8",fontSize:12,textAlign:"center",padding:20}}>لا توجد بيانات بعد</div>}
      {days.map(([d,c])=><div key={d} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #f1f5f9"}}><span style={{color:"#475569",fontSize:12}}>{d}</span><span style={{color:"#E8712B",fontWeight:800,fontSize:13}}>{c}</span></div>)}
    </div>
  </div>);
}

function StatsPanel({list,onBack}){
  const byMonth={};list.forEach(a=>{if(!a.created_at)return;const m=new Date(a.created_at).toLocaleDateString("ar-SA",{year:"numeric",month:"long"});byMonth[m]=byMonth[m]||{total:0,accepted:0,rejected:0};byMonth[m].total++;if(a.status==="accepted")byMonth[m].accepted++;if(a.status==="rejected")byMonth[m].rejected++;});
  const byGeo={};list.forEach(a=>{if(!a.bangladesh_district)return;byGeo[a.bangladesh_district]=(byGeo[a.bangladesh_district]||0)+1;});
  const topGeo=Object.entries(byGeo).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const acceptRate=list.length?Math.round((list.filter(a=>a.status==="accepted").length/list.length)*100):0;
  return(<div style={s.root}>
    <div style={{background:"linear-gradient(135deg,#16a34a,#15803d)",padding:"14px 20px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:100}}><button onClick={onBack} style={s.bSm}>← رجوع</button><div style={{color:"#fff",fontSize:16,fontWeight:900}}>📊 إحصائيات شهرية</div></div>
    <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div style={s.stCard}><div style={{fontSize:22,fontWeight:900,color:"#E8712B"}}>{list.length}</div><div style={{fontSize:10,color:"#64748b",marginTop:2}}>إجمالي كل الوقت</div></div>
        <div style={s.stCard}><div style={{fontSize:22,fontWeight:900,color:"#16a34a"}}>{acceptRate}%</div><div style={{fontSize:10,color:"#64748b",marginTop:2}}>معدل القبول</div></div>
      </div>
      <div style={s.sec}><div style={{color:"#1e293b",fontSize:13,fontWeight:800,marginBottom:10}}>📆 حسب الشهر</div>{Object.entries(byMonth).map(([m,d])=><div key={m} style={{padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#1e293b",fontSize:12,fontWeight:700}}>{m}</span><span style={{color:"#E8712B",fontWeight:800,fontSize:13}}>{d.total}</span></div><div style={{display:"flex",gap:10,fontSize:10,color:"#64748b"}}><span>✅ مقبول: {d.accepted}</span><span>❌ مرفوض: {d.rejected}</span></div></div>)}</div>
      <div style={s.sec}><div style={{color:"#1e293b",fontSize:13,fontWeight:800,marginBottom:10}}>🗺️ أكثر المناطق تقديماً</div>{topGeo.map(([g,c])=><div key={g} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f1f5f9"}}><span style={{color:"#475569",fontSize:12}}>{g}</span><span style={{color:"#2563eb",fontWeight:800,fontSize:13}}>{c}</span></div>)}</div>
    </div>
  </div>);
}

function ComparePanel({ids,list,onBack}){
  const items=ids.map(id=>list.find(a=>a.id===id)).filter(Boolean);
  const geoOf=a=>a.bangladesh_district?calcGeoScore(a.bangladesh_district):null;
  const rows=[
    ["الاسم",a=>a.full_name],
    ["الدرجة الكلية",a=>a.ai_score_total?Number(a.ai_score_total).toFixed(1)+"/10":"—"],
    ["التصنيف",a=>CL[a.ai_classification]?.ar||"—"],
    ["اللياقة",a=>a.score_physical?Number(a.score_physical).toFixed(1):"—"],
    ["المسؤولية",a=>a.score_responsibility?Number(a.score_responsibility).toFixed(1):"—"],
    ["الفني",a=>a.ai_score_technical?Number(a.ai_score_technical).toFixed(1):"—"],
    ["السلوكي",a=>a.ai_score_behavioral?Number(a.ai_score_behavioral).toFixed(1):"—"],
    ["المنطقة",a=>a.bangladesh_district||"—"],
    ["نقاط المنطقة",a=>geoOf(a)?.score||"—"],
    ["الرخصة",a=>a.has_license?"✅":"❌"],
    ["الحالة الاجتماعية",a=>a.marital_status==="married"?"متزوج":a.marital_status==="single"?"أعزب":"مطلق"],
    ["مستعد للرياض",a=>a.ready_for_riyadh==="yes"?"✅":a.ready_for_riyadh==="no"?"❌":"—"],
  ];
  return(<div style={s.root}>
    <div style={{background:"linear-gradient(135deg,#7c3aed,#6d28d9)",padding:"14px 20px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:100}}><button onClick={onBack} style={s.bSm}>← رجوع</button><div style={{color:"#fff",fontSize:16,fontWeight:900}}>⚖️ مقارنة المتقدمين</div></div>
    <div style={{padding:16,overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
        <tbody>
          {rows.map(([label,fn],i)=><tr key={label} style={{background:i%2===0?"#f8fafc":"#fff"}}>
            <td style={{padding:"10px 12px",fontSize:11,fontWeight:800,color:"#64748b",whiteSpace:"nowrap",borderBottom:"1px solid #f1f5f9"}}>{label}</td>
            {items.map(a=><td key={a.id} style={{padding:"10px 12px",fontSize:12,fontWeight:700,color:"#1e293b",textAlign:"center",borderBottom:"1px solid #f1f5f9"}}>{fn(a)}</td>)}
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>);
}


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

  const printCandidate=()=>{
    const geo=a.bangladesh_district?calcGeoScore(a.bangladesh_district):null;
    const qs=session?.questions||[];
    const ans=session?.answers||a.interview_answers||{};
    const ev=a.ai_evaluation_json;
    const zoneAr={green:"🟢 خضراء",yellow:"🟡 صفراء",red:"🔴 محظورة"}[geo?.zone]||"—";
    const row=(l,v)=>`<div class="row"><span class="l">${l}</span><span class="v">${v??"—"}</span></div>`;
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/><title>ملف المرشح — ${a.full_name}</title>
<style>
@page{size:A4;margin:14mm 12mm;}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1e293b;margin:0;font-size:12px;}
.hdr{background:linear-gradient(135deg,#E8712B,#f5a35f);color:#fff;padding:16px 20px;border-radius:12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
.hdr .name{font-size:20px;font-weight:900;}
.hdr .sub{font-size:11px;opacity:0.9;margin-top:2px;}
.badge{background:rgba(255,255,255,0.25);padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;}
.sec{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:10px;break-inside:avoid;}
.sec h3{margin:0 0 8px;font-size:13px;color:#E8712B;border-bottom:2px solid #fed7aa;padding-bottom:6px;}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.row{background:#f8fafc;border-radius:6px;padding:6px 10px;display:flex;justify-content:space-between;font-size:11px;}
.row .l{color:#94a3b8;}
.row .v{font-weight:700;}
.qa{background:#f8fafc;border-radius:8px;padding:8px 10px;margin-bottom:6px;break-inside:avoid;}
.qa .q{color:#7c3aed;font-size:10px;font-weight:700;margin-bottom:3px;}
.qa .a{font-size:11px;line-height:1.6;}
.zone{display:inline-block;padding:4px 12px;border-radius:8px;font-weight:700;font-size:11px;background:${geo?.zone==="green"?"#f0fdf4":geo?.zone==="yellow"?"#fffbeb":"#fff5f5"};color:${geo?.zone==="green"?"#16a34a":geo?.zone==="yellow"?"#d97706":"#dc2626"};}
.scorebox{text-align:center;padding:10px;background:#fff7ed;border-radius:10px;margin-bottom:10px;}
.scorebox .num{font-size:32px;font-weight:900;color:#E8712B;}
.bars{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;}
.bar{background:#f8fafc;border-radius:8px;padding:8px 10px;}
.bar .lbl{font-size:10px;color:#64748b;display:flex;justify-content:space-between;margin-bottom:4px;}
.bar .track{height:5px;background:#e2e8f0;border-radius:3px;overflow:hidden;}
.bar .fill{height:100%;background:#E8712B;}
.note{background:#f8fafc;border-right:3px solid #E8712B;border-radius:6px;padding:8px 10px;font-size:11px;line-height:1.7;margin-bottom:6px;}
.note.acc{background:#f0fdf4;border-color:#16a34a;}
.footer{text-align:center;color:#94a3b8;font-size:9px;margin-top:16px;}
ul{margin:0;padding-right:16px;font-size:11px;line-height:1.8;}
</style></head><body>

<div class="hdr">
  <div class="badge">طلب #${a.application_number}</div>
  <div style="text-align:left"><div class="name">${a.full_name}</div><div class="sub">${a.whatsapp||""} · ${ST[a.status]?.ar||a.status}</div></div>
</div>

<div class="sec"><h3>📍 الموقع والمنطقة</h3><div class="grid">
  ${row("الموقع",a.location==="inside_ksa"?"داخل المملكة":"خارج المملكة")}
  ${row("المدينة السعودية",a.saudi_city)}
  ${row("المحافظة",a.bangladesh_district)}
  ${row("المدينة/القرية",a.bangladesh_city)}
  ${row("مستعد للرياض",a.ready_for_riyadh==="yes"?"نعم":a.ready_for_riyadh==="no"?"لا":"—")}
  ${row("نقاط المنطقة",geo?`${geo.score}/100`:"—")}
</div>${geo?`<div style="margin-top:8px"><span class="zone">${zoneAr}</span></div>`:""}</div>

<div class="sec"><h3>👤 البيانات الشخصية</h3><div class="grid">
  ${row("العمر",a.age+" سنة")}
  ${row("الطول",a.height_cm+" سم")}
  ${row("الوزن",a.weight_kg+" كغ")}
  ${row("الرخصة",a.has_license?"نعم":"لا")}
  ${row("الحالة الاجتماعية",a.marital_status==="married"?`متزوج — ${a.children_count||0} أبناء`:a.marital_status==="single"?"أعزب":"مطلق")}
  ${row("الجواز/الإقامة",a.passport_or_iqama)}
</div></div>

<div class="sec"><h3>🔧 وصف الغسيل</h3><div class="note">${a.car_wash_description||"—"}</div></div>

<div class="sec"><h3>🧠 الأسئلة السلوكية</h3>
  ${[["رفض عميل",a.q1_client_refusal],["فواحة/مناديل",a.q2_equipment_damage],["سبب ترك العمل",a.q3_left_previous_job],["خصم الراتب",a.q4_salary_deduction],["هدف بعد سنة",a.q5_one_year_goal],["زميل مشكلة",a.q6_difficult_colleague]]
    .map(([q,ans2],i)=>`<div class="qa"><div class="q">${i+1}. ${q}</div><div class="a">${ans2||"—"}</div></div>`).join("")}
</div>

${qs.length?`<div class="sec"><h3>🎯 إجابات المقابلة</h3>${qs.map((q,i)=>`<div class="qa"><div class="q">سؤال ${i+1}: ${q.ar}</div><div class="a">${ans[i]||"—"}</div></div>`).join("")}</div>`:""}

<div class="sec"><h3>🤖 تحليل الذكاء الاصطناعي</h3>
  <div class="scorebox"><div class="num">${a.ai_score_total?Number(a.ai_score_total).toFixed(1):"—"}</div><div style="font-size:10px;color:#78716c">الدرجة الكلية من 10 — ${CL[a.ai_classification]?.ar||"—"}</div></div>
  <div class="bars">
    ${[["اللياقة",a.score_physical],["المسؤولية",a.score_responsibility],["الفني",a.ai_score_technical],["السلوكي",a.ai_score_behavioral]]
      .map(([l,v])=>`<div class="bar"><div class="lbl"><span>${l}</span><span>${v?Number(v).toFixed(1):"—"}/10</span></div><div class="track"><div class="fill" style="width:${v?(v/10)*100:0}%"></div></div></div>`).join("")}
  </div>
  ${ev?.strengths?.length?`<div class="note" style="border-color:#16a34a"><b>✅ نقاط القوة:</b><ul>${ev.strengths.map(x=>`<li>${x}</li>`).join("")}</ul></div>`:""}
  ${ev?.weaknesses?.length?`<div class="note" style="border-color:#dc2626"><b>⚠️ نقاط الضعف:</b><ul>${ev.weaknesses.map(x=>`<li>${x}</li>`).join("")}</ul></div>`:""}
  ${ev?.recommendation?`<div class="note acc"><b>📋 التوصية:</b> ${ev.recommendation}</div>`:""}
  ${ev?.ariful_comparison?`<div class="note"><b>⭐ مقارنة بأريفول:</b> ${ev.ariful_comparison}</div>`:""}
</div>

${a.admin_notes?`<div class="sec"><h3>📝 ملاحظات إبراهيم</h3><div class="note">${a.admin_notes}</div></div>`:""}

<div class="footer">مؤسسة دلو ورغوة التجارية — تقرير مُصدر بتاريخ ${new Date().toLocaleDateString("ar-SA")}</div>

<script>window.onload=()=>{window.print();}</script>
</body></html>`;
    const w=window.open("","_blank");
    w.document.write(html);
    w.document.close();
  };
  const ev=a.ai_evaluation_json;const st=ST[a.status]||ST.pending;const geo=a.bangladesh_district?calcGeoScore(a.bangladesh_district):null;
  const save=async()=>{setSaving(true);await onSaveNotes(a.id,notes);setSaving(false);};
  const saveEdit=async()=>{setESaving(true);const{error}=await supabase.from("applicants").update(ed).eq("id",a.id);if(error)alert("خطأ: "+error.message);else{setEditMode(false);Object.assign(a,ed);}setESaving(false);};
  const mapUrl=a.bangladesh_city?`https://maps.google.com/maps?q=${encodeURIComponent((a.bangladesh_city||"")+" "+(a.bangladesh_district||"")+" Bangladesh")}`:"";
  return(<div style={s.root}>
    <div style={{background:"linear-gradient(135deg,#E8712B,#CC5200)",padding:"14px 20px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:100}}><button onClick={onBack} style={s.bSm}>← رجوع</button><div style={{flex:1,textAlign:"right"}}><div style={{color:"#fff",fontSize:15,fontWeight:900}}>{a.full_name}</div><div style={{color:"rgba(255,255,255,0.75)",fontSize:11}}>طلب #{a.application_number}</div></div><button onClick={printCandidate} style={{...s.bSm,background:"rgba(255,255,255,0.25)"}}>🖨️ طباعة</button><div style={{padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700,color:st.color,background:"rgba(255,255,255,0.9)"}}>{st.ar}</div></div>
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

        {/* عرض التقرير */}
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
          <button onClick={exportMD} style={{...s.bFull,background:"linear-gradient(135deg,#475569,#334155)",marginTop:10}}>📄 تصدير MD</button>
        </div>);})()}

        {!a.ai_score_total&&!aiReport&&<p style={{color:"#94a3b8",fontSize:12,textAlign:"center",padding:"8px 0"}}>لا يوجد تحليل بعد لهذا المتقدم</p>}
      </div>

      {/* إدارة المقابلة */}
      <div style={s.sec}><div style={{color:"#1e293b",fontSize:13,fontWeight:800,marginBottom:12}}>📅 إدارة المقابلة</div><div style={{display:"flex",flexDirection:"column",gap:10}}><button onClick={()=>setShowInvite(true)} style={{...s.bFull,background:"linear-gradient(135deg,#16a34a,#15803d)"}}>📱 إرسال دعوة مقابلة</button><button onClick={()=>setShowIQ(!showIQ)} style={{...s.bFull,background:"linear-gradient(135deg,#2563eb,#1d4ed8)"}}>🎯 إرسال أسئلة المقابلة</button>{iLink&&<div style={{background:"#eff6ff",border:"1px solid #93c5fd",borderRadius:12,padding:"10px 14px"}}><div style={{color:"#1d4ed8",fontSize:11,fontWeight:700,marginBottom:4}}>رابط المقابلة:</div><div style={{color:"#1e40af",fontSize:10,wordBreak:"break-all",marginBottom:8}}>{iLink}</div><button onClick={()=>{const msg=`🇸🇦 يرجى الإجابة على هذه الأسئلة:\n${iLink}\n\n🇬🇧 Please answer these questions:\n${iLink}\n\n🇧🇩 দয়া করে এই প্রশ্নগুলোর উত্তর দিন:\n${iLink}`;window.open(`https://wa.me/${a.whatsapp?.replace(/[^0-9]/g,"")}?text=${encodeURIComponent(msg)}`);}} style={{...s.bFull,background:"linear-gradient(135deg,#16a34a,#15803d)"}}>📱 إرسال على واتساب</button></div>}</div>{showIQ&&<IQPanel applicant={a} onGenerated={l=>{setILink(l);setShowIQ(false);}}/>}</div>

      {/* تغيير الحالة */}
      <div style={s.sec}><div style={{color:"#1e293b",fontSize:13,fontWeight:800,marginBottom:10}}>📌 تغيير الحالة</div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{Object.entries(ST).map(([k,v])=><button key={k} onClick={()=>onStatus(a.id,k)} style={{padding:"8px 14px",border:`2px solid ${v.color}`,borderRadius:12,fontSize:11,fontWeight:700,cursor:"pointer",background:a.status===k?v.color:"#fff",color:a.status===k?"#fff":v.color}}>{v.ar}</button>)}</div>
        {(()=>{const stats=getLearningStats();return stats.total_decisions>0?<div style={{marginTop:10,background:"#f8fafc",borderRadius:10,padding:"8px 12px"}}><div style={{color:"#64748b",fontSize:10}}>📊 قرارات مسجّلة للتعلم: <strong>{stats.total_decisions}</strong> {stats.ready_for_calibration?"— جاهز للمعايرة! 🎉":`(يحتاج ${30-stats.total_decisions} إضافية للمعايرة)`}</div></div>:null;})()}
      </div>

      {/* سجل النشاط */}
      {a.status_history?.length>0&&<div style={s.sec}><div style={{color:"#1e293b",fontSize:13,fontWeight:800,marginBottom:10}}>🕘 سجل النشاط</div>{[...a.status_history].reverse().map((h,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<a.status_history.length-1?"1px solid #f1f5f9":"none"}}><span style={{color:ST[h.status]?.color||"#475569",fontSize:12,fontWeight:700}}>{ST[h.status]?.ar||h.status}</span><span style={{color:"#94a3b8",fontSize:11}}>{new Date(h.at).toLocaleString("ar-SA")}</span></div>)}</div>}

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
function EmpCard({e,onClick}){const RQ=["date_of_birth","time_in_saudi","residence_riyadh","previous_job","car_wash_experience","worked_with_app"];const missCount=RQ.filter(k=>!e[k]||String(e[k]).trim()==="").length;return(<div style={s.card} onClick={onClick}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{background:"#fff7ed",color:"#E8712B",fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:20,border:"1px solid #fed7aa"}}>{e.employee_id||"—"}</div><div style={{color:"#1e293b",fontSize:14,fontWeight:800}}>{e.full_name||"—"}</div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:missCount>0?8:0}}>{[[e.nationality,"🌍"],[e.mobile,"📱"],[e.source,"📥"],[e.time_in_saudi,"⏱️"]].map(([v,ic],i)=>v?<div key={i} style={{color:"#64748b",fontSize:11}}>{ic} {v}</div>:null)}</div>{missCount>0&&<div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"3px 10px",display:"inline-block"}}><span style={{color:"#92400e",fontSize:10,fontWeight:700}}>⚠️ ملف ناقص — {missCount} حقول</span></div>}</div>);}
function EmpDetail({e,onBack,onDelete,onUpdate}){const[del,setDel]=useState(false);const[editMode,setEditMode]=useState(false);const[eSaving,setESaving]=useState(false);
  const EDITABLE=["full_name","id_number","mobile","date_of_birth","nationality","employee_id","home_country","region","city","time_in_saudi","residence_riyadh","source","referrer_name","referrer_relation","has_relative_in_team","relative_name","previous_job","car_wash_experience","worked_with_app"];
  const[ed,setEd]=useState(Object.fromEntries(EDITABLE.map(k=>[k,e[k]||""])));
  const REQUIRED=[["date_of_birth","تاريخ الميلاد","জন্ম তারিখ"],["time_in_saudi","المدة في السعودية","সৌদিতে সময়"],["residence_riyadh","السكن الحالي في الرياض","রিয়াদে বাসস্থান"],["previous_job","العمل السابق","পূর্ববর্তী কাজ"],["car_wash_experience","خبرة الغسيل","গাড়ি ধোয়ার অভিজ্ঞতা"],["worked_with_app","عمل مع تطبيقات سابقاً","আগে অ্যাপে কাজ"]];
  const missing=REQUIRED.filter(([k])=>!e[k]||String(e[k]).trim()==="");
  const sendCompletionRequest=()=>{
    const lines=missing.map(([k,ar,bn])=>`• ${bn} / ${ar}`).join("\n");
    const link=`${SITE_URL}/?employee=${e.id}`;
    const msg=`السلام عليكم ${e.full_name}،\nيرجى إكمال ملفك عبر الرابط التالي (سيظهر ما أدخلته سابقاً، فقط أكمل الحقول الناقصة):\n\n${link}\n\nالحقول الناقصة:\n${lines}\n\nআসসালামু আলাইকুম ${e.full_name},\nঅনুগ্রহ করে এই লিংকে গিয়ে আপনার প্রোফাইল সম্পূর্ণ করুন (আগের তথ্য দেখাবে, শুধু বাকি ঘরগুলো পূরণ করুন):\n\n${link}\n\nবাকি তথ্য:\n${lines}`;
    window.open(`https://wa.me/${e.mobile?.replace(/[^0-9]/g,"")}?text=${encodeURIComponent(msg)}`);
  };
  const saveEdit=async()=>{setESaving(true);const{error}=await supabase.from("employees").update(ed).eq("id",e.id);if(error)alert("خطأ: "+error.message);else{setEditMode(false);onUpdate?.({...e,...ed});}setESaving(false);};
  const FIELDS=[["القسم الأول",null],["الاسم",e.full_name],["رقم الهوية",e.id_number],["الجوال",e.mobile],["الميلاد",e.date_of_birth],["الجنسية",e.nationality],["ID سويتر",e.employee_id],["القسم الثاني",null],["الدولة الأصلية",e.home_country],["المنطقة",e.region],["المدينة",e.city],["المدة في السعودية",e.time_in_saudi],["السكن الرياض",e.residence_riyadh],["القسم الثالث",null],["المصدر",e.source],["المحيل",e.referrer_name],["الصلة",e.referrer_relation],["أقارب في الفريق",e.has_relative_in_team],["اسم القريب",e.relative_name],["القسم الرابع",null],["العمل السابق",e.previous_job],["خبرة الغسيل",e.car_wash_experience],["عمل مع تطبيقات",e.worked_with_app]];
  const LABELS={full_name:"الاسم",id_number:"رقم الهوية",mobile:"الجوال",date_of_birth:"الميلاد",nationality:"الجنسية",employee_id:"ID سويتر",home_country:"الدولة الأصلية",region:"المنطقة",city:"المدينة",time_in_saudi:"المدة في السعودية",residence_riyadh:"السكن الرياض",source:"المصدر",referrer_name:"المحيل",referrer_relation:"الصلة",has_relative_in_team:"أقارب في الفريق",relative_name:"اسم القريب",previous_job:"العمل السابق",car_wash_experience:"خبرة الغسيل",worked_with_app:"عمل مع تطبيقات"};
return(<div style={s.root}><div style={{background:"linear-gradient(135deg,#1e293b,#334155)",padding:"14px 20px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:100}}><button onClick={onBack} style={s.bSm}>← رجوع</button><div style={{flex:1,textAlign:"right"}}><div style={{color:"#fff",fontSize:15,fontWeight:900}}>{e.full_name}</div><div style={{color:"rgba(255,255,255,0.6)",fontSize:11}}>ID: {e.employee_id||"—"}</div></div></div><div style={{padding:"12px 16px 80px",display:"flex",flexDirection:"column",gap:12,maxWidth:560,margin:"0 auto"}}>
  {missing.length>0&&<div style={{background:"#fffbeb",border:"1.5px solid #fcd34d",borderRadius:14,padding:14}}>
    <div style={{color:"#92400e",fontSize:13,fontWeight:800,marginBottom:8}}>⚠️ ملف غير مكتمل — {missing.length} حقول ناقصة</div>
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>{missing.map(([k,ar])=><span key={k} style={{background:"#fff",border:"1px solid #fde68a",borderRadius:8,padding:"3px 8px",fontSize:10,color:"#92400e"}}>{ar}</span>)}</div>
    <button onClick={sendCompletionRequest} style={{...s.bFull,background:"linear-gradient(135deg,#16a34a,#15803d)"}}>📱 إرسال طلب إكمال الملف عبر واتساب</button>
  </div>}
  <div style={s.sec}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <button onClick={()=>{setEd(Object.fromEntries(EDITABLE.map(k=>[k,e[k]||""])));setEditMode(!editMode);}} style={{padding:"5px 12px",background:editMode?"#f1f5f9":"linear-gradient(135deg,#E8712B,#f5a35f)",border:"none",borderRadius:8,color:editMode?"#475569":"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>{editMode?"❌ إلغاء":"✏️ تعديل"}</button>
      <div style={{color:"#1e293b",fontSize:13,fontWeight:800}}>البيانات</div>
    </div>
    {editMode?(<div style={{display:"flex",flexDirection:"column",gap:10}}>
      {EDITABLE.map(k=><div key={k}><div style={{color:"#64748b",fontSize:11,marginBottom:3,textAlign:"right"}}>{LABELS[k]}</div><input value={ed[k]} onChange={ev2=>setEd(p=>({...p,[k]:ev2.target.value}))} style={s.inp}/></div>)}
      <button onClick={saveEdit} disabled={eSaving} style={{...s.bFull,background:"linear-gradient(135deg,#2E7D32,#1b5e20)"}}>{eSaving?"جاري الحفظ...":"💾 حفظ التعديلات"}</button>
    </div>):(FIELDS.map(([l,v],i)=>l.includes("القسم")?<div key={i} style={{color:"#E8712B",fontSize:12,fontWeight:900,marginTop:i>0?10:0,marginBottom:4,borderBottom:"1px solid #f1f5f9",paddingBottom:3}}>{l}</div>:v?<div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:5}}><div style={{color:"#94a3b8",fontSize:11,textAlign:"right"}}>{l}</div><div style={{color:"#1e293b",fontSize:12,fontWeight:600,textAlign:"right"}}>{v}</div></div>:null))}
  </div>
  <div style={s.sec}><div style={{color:"#1e293b",fontSize:13,fontWeight:800,marginBottom:10}}>⚠️ منطقة الخطر</div>{!del?<button onClick={()=>setDel(true)} style={{...s.bFull,background:"#fff",border:"2px solid #dc2626",color:"#dc2626"}}>🗑️ حذف</button>:<div style={{background:"#fff5f5",border:"1.5px solid #dc2626",borderRadius:12,padding:14}}><div style={{color:"#dc2626",fontWeight:700,textAlign:"right",marginBottom:10}}>⚠️ هل أنت متأكد؟</div><div style={{display:"flex",gap:8}}><button onClick={()=>onDelete(e.id)} style={{...s.bFull,background:"#dc2626"}}>نعم</button><button onClick={()=>setDel(false)} style={{...s.bFull,background:"#f1f5f9",color:"#475569"}}>إلغاء</button></div></div>}</div></div></div>);}
function EB({c,t,txt,list,accent}){return(<div style={{background:accent?"#fdf4ff":"#f8fafc",borderRadius:10,padding:"8px 12px",marginBottom:6,...(accent?{borderRight:`3px solid ${c}`}:{})}}><div style={{color:c,fontWeight:700,fontSize:11,marginBottom:3}}>{t}</div>{txt&&<div style={{color:"#475569",fontSize:12,lineHeight:1.6}}>{txt}</div>}{list?.map((x,i)=><div key={i} style={{color:"#475569",fontSize:12}}>• {x}</div>)}</div>);}
function FCard({l,url,type}){return(<div style={{background:"#f8fafc",borderRadius:12,padding:10,textAlign:"center",minWidth:80}}><div style={{color:"#64748b",fontSize:10,marginBottom:6,fontWeight:600}}>{l}</div>{type==="image"?<img src={url} alt={l} style={{width:70,height:70,objectFit:"cover",borderRadius:8,cursor:"pointer"}} onClick={()=>window.open(url,"_blank")}/>:<a href={url} target="_blank" rel="noreferrer" style={{display:"block",padding:"6px",background:"#2563eb",borderRadius:8,color:"#fff",fontSize:10,fontWeight:700,textDecoration:"none"}}>▶ مشاهدة</a>}</div>);}
const s={root:{minHeight:"100dvh",background:"#f8fafc",fontFamily:"'Segoe UI',Tahoma,sans-serif",direction:"rtl"},hdr:{background:"linear-gradient(135deg,#E8712B,#CC5200)",padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100},hT:{color:"#fff",fontSize:18,fontWeight:900},hS:{color:"rgba(255,255,255,0.75)",fontSize:11},bSm:{padding:"8px 14px",background:"rgba(255,255,255,0.2)",border:"none",borderRadius:10,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"},statsR:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,padding:"12px 16px"},stCard:{background:"#fff",borderRadius:12,padding:"12px 10px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},tb:{padding:"0 16px 12px",display:"flex",gap:8},sInp:{flex:1,padding:"10px 14px",border:"1.5px solid #e2e8f0",borderRadius:12,fontSize:12,outline:"none",direction:"rtl"},fSel:{padding:"10px 12px",border:"1.5px solid #e2e8f0",borderRadius:12,fontSize:11,outline:"none",background:"#fff"},lst:{padding:"0 16px 80px",display:"flex",flexDirection:"column",gap:10},emp:{textAlign:"center",color:"#94a3b8",padding:"40px 0",fontSize:13},card:{background:"#fff",borderRadius:16,padding:"14px 16px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",cursor:"pointer",border:"1.5px solid #f1f5f9"},sec:{background:"#fff",borderRadius:16,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},inp:{width:"100%",padding:"10px 12px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:13,outline:"none",direction:"rtl",fontFamily:"inherit"},bFull:{width:"100%",padding:12,border:"none",borderRadius:12,color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer"}};
