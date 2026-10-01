import{useState,useEffect}from"react";import{supabase}from"./supabase";import{ThemeToggle,Orbs}from"./ui";
const INIT={full_name:"",id_number:"",mobile:"",date_of_birth:"",nationality:"",employee_id:"",home_country:"",region:"",city:"",time_in_saudi:"",residence_riyadh:"",source:"",referrer_name:"",referrer_relation:"",has_relative_in_team:"",relative_name:"",previous_job:"",car_wash_experience:"",worked_with_app:""};
export default function EmployeePage({onBack,employeeId}){
  const[form,setForm]=useState(INIT);const[saving,setSaving]=useState(false);const[done,setDone]=useState(false);const[errors,setErrors]=useState({});const[loading,setLoading]=useState(!!employeeId);const[recordId,setRecordId]=useState(null);
  useEffect(()=>{
    if(!employeeId)return;
    supabase.from("employees").select("*").eq("id",employeeId).single().then(({data})=>{
      if(data){setForm(p=>({...p,...Object.fromEntries(Object.keys(INIT).map(k=>[k,data[k]||""]))}));setRecordId(data.id);}
      setLoading(false);
    });
  },[employeeId]);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const validate=()=>{const e={};if(!form.full_name.trim())e.full_name=1;if(!form.mobile.trim())e.mobile=1;if(!form.nationality)e.nationality=1;setErrors(e);return!Object.keys(e).length;};
  const save=async()=>{if(!validate())return;setSaving(true);
    const{error}=recordId?await supabase.from("employees").update(form).eq("id",recordId):await supabase.from("employees").insert(form);
    if(error){alert("খুলি: "+error.message);setSaving(false);return;}setDone(true);setSaving(false);};
  if(loading)return <div style={{minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)"}}><div className="g-spin" style={{width:40,height:40}}/></div>;
  if(done)return(<div style={g.page}><Orbs/><div className="g-corner"><ThemeToggle/></div><div className="g-card" style={{...g.card,margin:"80px auto",textAlign:"center",padding:48}}><div style={g.tick}>✓</div><div style={{fontSize:18,fontWeight:900,color:"var(--ink)",margin:"16px 0 8px"}}>সফলভাবে সংরক্ষিত হয়েছে</div><div style={{color:"var(--mut)",fontSize:12}}>تم الحفظ بنجاح</div></div></div>);
  const F=({ar,bn,req,children})=>(<div><div style={{marginBottom:5}}><div style={{color:"var(--ink)",fontSize:13,fontWeight:700,textAlign:"right"}}>{bn}{req&&<span style={{color:"var(--bad-ink)"}}> *</span>}</div><div style={{color:"var(--mut)",fontSize:11,textAlign:"left"}}>{ar}</div></div>{children}</div>);
  // tone: p|info|warn|ok — رقم القسم بخلفية الدلالة ونصّها (تباين AA في الوضعين)
  const Sec=({n,ar,bn,tone,children})=>(<div className="g-card" style={{padding:16}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,borderBottom:`2px solid color-mix(in srgb,var(--${tone==="p"?"p":tone}) 18%,transparent)`,paddingBottom:10}}><div style={{width:28,height:28,borderRadius:"50%",background:tone==="p"?"var(--p-100)":`var(--${tone}-bg)`,color:tone==="p"?"var(--p-700)":`var(--${tone}-ink)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12.5,fontWeight:900,flexShrink:0}}>{n}</div><div><div style={{color:"var(--ink)",fontSize:13,fontWeight:900}}>{bn}</div><div style={{color:"var(--mut)",fontSize:11,textAlign:"left"}}>{ar}</div></div></div><div style={{display:"flex",flexDirection:"column",gap:12}}>{children}</div></div>);
  const inp=(k,err)=>({...g.inp,...(errors[k]?{borderColor:"var(--bad)",background:"var(--bad-bg)"}:{})});
  const refId=employeeId||recordId||form.employee_id;
  const refLink=refId?`${window.location.origin}/?apply=1&ref=${refId}`:`${window.location.origin}/?apply=1`;
  const refMsg=encodeURIComponent(`🪣 রিয়াদে গাড়ি ধোয়ার ভালো চাকরি আছে — বেতন + কমিশন, ফ্রি বাসা।\nতুমি উপযুক্ত হলে এখনই আবেদন করো 👇\n${refLink}\n\n(শর্ত: মোটরসাইকেল চালাতে পারা · উচ্চতা ১৬৭+ · বয়স ২৫–৩৮)`);
  return(<div style={g.page}><Orbs/>
    <div style={{position:"relative",zIndex:1,background:"linear-gradient(135deg,#128C7E,#075E54)",margin:"12px 16px 0",borderRadius:14,padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
      <div><div style={{color:"#fff",fontSize:12.5,fontWeight:800}}>👥 বন্ধুকে রেফার করো · أحِل صديقاً مؤهّلاً</div><div style={{color:"rgba(255,255,255,0.85)",fontSize:10.5}}>সে চাকরি পেলে তুমি বোনাস পাবে · مكافأة عند تعيينه</div></div>
      <a href={`https://wa.me/?text=${refMsg}`} target="_blank" rel="noreferrer" style={{flexShrink:0,padding:"12px 14px",minHeight:44,boxSizing:"border-box",background:"#fff",borderRadius:10,color:"#075E54",fontSize:12,fontWeight:800,textDecoration:"none"}}>📤 শেয়ার</a>
    </div>
    {recordId&&<div style={{position:"relative",zIndex:1,background:"var(--ok-bg)",border:"1px solid color-mix(in srgb,var(--ok) 35%,transparent)",margin:"12px 16px 0",borderRadius:12,padding:"10px 14px"}}><div style={{color:"var(--ok-ink)",fontSize:12,fontWeight:700}}>✅ আপনার তথ্য লোড হয়েছে — শুধু খালি ঘরগুলো পূরণ করুন</div></div>}
    <div style={g.hdr}><button onClick={onBack} style={g.back}>← ফিরে</button><div style={{width:32,height:32,borderRadius:10,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🪣</div><div><div style={{color:"#fff",fontSize:16,fontWeight:900}}>কর্মী প্রোফাইল</div><div style={{color:"#fff",fontSize:11.5,fontWeight:600}}>ملف الموظف</div></div><div style={{marginInlineStart:"auto"}}><ThemeToggle/></div></div>
    <div style={{position:"relative",zIndex:1,background:"var(--p-50)",border:"1px solid rgba(var(--p-rgb),.35)",margin:"12px 16px 0",borderRadius:12,padding:"12px 14px"}}><div style={{color:"var(--ink)",fontSize:13,fontWeight:700,marginBottom:3}}>📋 অনুগ্রহ করে আপনার সমস্ত তথ্য সঠিকভাবে পূরণ করুন</div><div style={{color:"var(--mut)",fontSize:11.5}}>أخي الموظف — يرجى تعبئة بياناتك كاملة</div></div>
    <div style={{position:"relative",zIndex:1,padding:"12px 16px 32px",display:"flex",flexDirection:"column",gap:12,maxWidth:560,margin:"0 auto"}}>
      <Sec n="1" ar="البيانات الأساسية" bn="মৌলিক তথ্য" tone="p">
        <F ar="الاسم الكامل" bn="পূর্ণ নাম" req><input className="g-input" value={form.full_name} onChange={e=>set("full_name",e.target.value)} style={inp("full_name")}/></F>
        <F ar="رقم الهوية/الإقامة" bn="পরিচয় নম্বর"><input className="g-input" value={form.id_number} onChange={e=>set("id_number",e.target.value)} style={g.inp}/></F>
        <F ar="رقم الجوال" bn="মোবাইল" req><input className="g-input" value={form.mobile} onChange={e=>set("mobile",e.target.value)} style={{...inp("mobile"),direction:"ltr",textAlign:"left"}}/></F>
        <F ar="تاريخ الميلاد" bn="জন্ম তারিখ"><input className="g-input" type="date" value={form.date_of_birth} onChange={e=>set("date_of_birth",e.target.value)} style={{...g.inp,direction:"ltr"}}/></F>
        <F ar="الجنسية" bn="জাতীয়তা" req><select className="g-select" value={form.nationality} onChange={e=>set("nationality",e.target.value)} style={inp("nationality")}><option value="">নির্বাচন করুন</option>{["بنغلادشي","هندي","باكستاني","نيبالي","إندونيسي","أخرى"].map(n=><option key={n} value={n}>{n}</option>)}</select></F>
        <F ar="ID سويتر" bn="সুইটার আইডি"><input className="g-input" value={form.employee_id} onChange={e=>set("employee_id",e.target.value)} style={g.inp}/></F>
      </Sec>
      <Sec n="2" ar="البيانات الجغرافية" bn="ভৌগোলিক তথ্য" tone="info">
        <F ar="الدولة الأصلية" bn="স্বদেশ"><select className="g-select" value={form.home_country} onChange={e=>set("home_country",e.target.value)} style={g.inp}><option value="">নির্বাচন করুন</option>{["بنغلادش","الهند","باكستان","نيبال","إندونيسيا","أخرى"].map(c=><option key={c} value={c}>{c}</option>)}</select></F>
        <F ar="المنطقة/المحافظة" bn="জেলা"><input className="g-input" value={form.region} onChange={e=>set("region",e.target.value)} style={g.inp}/></F>
        <F ar="المدينة/القرية" bn="শহর/গ্রাম"><input className="g-input" value={form.city} onChange={e=>set("city",e.target.value)} style={g.inp}/></F>
        <F ar="المدة في السعودية" bn="সৌদিতে সময়"><select className="g-select" value={form.time_in_saudi} onChange={e=>set("time_in_saudi",e.target.value)} style={g.inp}><option value="">নির্বাচন করুন</option>{["أقل من سنة","1-2 سنة","2-3 سنوات","3-5 سنوات","أكثر من 5 سنوات"].map(t=><option key={t} value={t}>{t}</option>)}</select></F>
        <F ar="السكن الحالي في الرياض" bn="রিয়াদে বাসস্থান"><input className="g-input" value={form.residence_riyadh} onChange={e=>set("residence_riyadh",e.target.value)} style={g.inp}/></F>
      </Sec>
      <Sec n="3" ar="قناة التوظيف" bn="নিয়োগের মাধ্যম" tone="warn">
        <F ar="المصدر" bn="উৎস"><select className="g-select" value={form.source} onChange={e=>set("source",e.target.value)} style={g.inp}><option value="">নির্বাচন করুন</option>{["حسين","ناهيد","مباشر","منصة","أخرى"].map(s=><option key={s} value={s}>{s}</option>)}</select></F>
        <F ar="اسم المُحيل" bn="রেফারার"><input className="g-input" value={form.referrer_name} onChange={e=>set("referrer_name",e.target.value)} style={g.inp}/></F>
        <F ar="صلة المُحيل" bn="সম্পর্ক"><select className="g-select" value={form.referrer_relation} onChange={e=>set("referrer_relation",e.target.value)} style={g.inp}><option value="">নির্বাচন করুন</option>{["صديق","قريب","زميل عمل سابق","أخرى"].map(r=><option key={r} value={r}>{r}</option>)}</select></F>
        <F ar="أقارب في الفريق؟" bn="দলে আত্মীয়?"><select className="g-select" value={form.has_relative_in_team} onChange={e=>set("has_relative_in_team",e.target.value)} style={g.inp}><option value="">নির্বাচন করুন</option><option value="نعم">নেই / نعم</option><option value="لا">না / لا</option></select></F>
        {form.has_relative_in_team==="نعم"&&<F ar="اسم القريب" bn="আত্মীয়ের নাম"><input className="g-input" value={form.relative_name} onChange={e=>set("relative_name",e.target.value)} style={g.inp}/></F>}
      </Sec>
      <Sec n="4" ar="الخلفية المهنية" bn="পেশাদার পটভূমি" tone="ok">
        <F ar="العمل السابق" bn="পূর্ববর্তী কাজ"><input className="g-input" value={form.previous_job} onChange={e=>set("previous_job",e.target.value)} style={g.inp}/></F>
        <F ar="خبرة الغسيل" bn="গাড়ি ধোয়ার অভিজ্ঞতা"><select className="g-select" value={form.car_wash_experience} onChange={e=>set("car_wash_experience",e.target.value)} style={g.inp}><option value="">নির্বাচন করুন</option>{["لا خبرة","أقل من سنة","1-2 سنة","2-3 سنوات","أكثر من 3 سنوات"].map(x=><option key={x} value={x}>{x}</option>)}</select></F>
        <F ar="عمل مع تطبيقات سابقاً؟" bn="আগে অ্যাপে কাজ?"><select className="g-select" value={form.worked_with_app} onChange={e=>set("worked_with_app",e.target.value)} style={g.inp}><option value="">নির্বাচন করুন</option><option value="نعم">হ্যাঁ / نعم</option><option value="لا">না / لا</option></select></F>
      </Sec>
      <button onClick={save} disabled={saving} style={{width:"100%",padding:15,background:"linear-gradient(135deg,var(--a),var(--p))",border:"none",borderRadius:14,color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",marginBottom:32,minHeight:50,opacity:saving?0.6:1}}>{saving?"সংরক্ষণ হচ্ছে...":"💾 সংরক্ষণ করুন"}</button>
    </div>
  </div>);
}
const g={page:{minHeight:"100dvh",background:"var(--bg)",color:"var(--ink)",fontFamily:"system-ui,-apple-system,'Segoe UI','Noto Sans Bengali',Tahoma,sans-serif",direction:"rtl",position:"relative"},card:{borderRadius:24,padding:"40px 28px",width:"100%",maxWidth:360,margin:"0 auto",zIndex:1},hdr:{background:"linear-gradient(135deg,var(--a),var(--p))",padding:"16px 20px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:100},back:{padding:"8px 14px",minHeight:44,background:"rgba(255,255,255,0.2)",border:"none",borderRadius:10,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0},tick:{width:72,height:72,background:"linear-gradient(135deg,var(--ok),color-mix(in srgb,var(--ok) 72%,black))",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:32,fontWeight:900,margin:"0 auto"},inp:{width:"100%",padding:"11px 14px",minHeight:46,border:"1px solid var(--line-2)",borderRadius:12,fontSize:15,color:"var(--ink)",outline:"none",background:"var(--glass-2)",boxSizing:"border-box",direction:"rtl",fontFamily:"inherit"}};
