import{useState}from"react";import{supabase}from"./supabase";
const INIT={full_name:"",id_number:"",mobile:"",date_of_birth:"",nationality:"",employee_id:"",home_country:"",region:"",city:"",time_in_saudi:"",residence_riyadh:"",source:"",referrer_name:"",referrer_relation:"",has_relative_in_team:"",relative_name:"",previous_job:"",car_wash_experience:"",worked_with_app:""};
export default function EmployeePage({onBack}){
  const[form,setForm]=useState(INIT);const[saving,setSaving]=useState(false);const[done,setDone]=useState(false);const[errors,setErrors]=useState({});
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const validate=()=>{const e={};if(!form.full_name.trim())e.full_name=1;if(!form.mobile.trim())e.mobile=1;if(!form.nationality)e.nationality=1;setErrors(e);return!Object.keys(e).length;};
  const save=async()=>{if(!validate())return;setSaving(true);const{error}=await supabase.from("employees").insert(form);if(error){alert("خطأ: "+error.message);setSaving(false);return;}setDone(true);setSaving(false);};
  if(done)return(<div style={g.page}><div style={{...g.card,margin:"80px auto",textAlign:"center",padding:48}}><div style={g.tick}>✓</div><div style={{fontSize:18,fontWeight:900,color:"#1e293b",margin:"16px 0 8px"}}>সফলভাবে সংরক্ষিত হয়েছে</div><div style={{color:"#a8834f",fontSize:12}}>تم الحفظ بنجاح</div></div></div>);
  const F=({ar,bn,req,children})=>(<div><div style={{marginBottom:5}}><div style={{color:"#1e293b",fontSize:13,fontWeight:700,textAlign:"right"}}>{bn}{req&&<span style={{color:"#E8712B"}}> *</span>}</div><div style={{color:"#a8834f",fontSize:10,textAlign:"left"}}>{ar}</div></div>{children}</div>);
  const Sec=({n,ar,bn,color,children})=>(<div style={{background:"#fff",borderRadius:16,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,borderBottom:`2px solid ${color}20`,paddingBottom:10}}><div style={{width:26,height:26,borderRadius:"50%",background:color,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,flexShrink:0}}>{n}</div><div><div style={{color:"#1e293b",fontSize:13,fontWeight:900}}>{bn}</div><div style={{color:"#a8834f",fontSize:10,textAlign:"left"}}>{ar}</div></div></div><div style={{display:"flex",flexDirection:"column",gap:12}}>{children}</div></div>);
  const inp=(k,err)=>({...g.inp,...(errors[k]?{borderColor:"#dc2626",background:"#fff5f5"}:{})});
  return(<div style={g.page}>
    <div style={g.hdr}><button onClick={onBack} style={g.back}>← ফিরে</button><div style={{width:32,height:32,borderRadius:10,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🪣</div><div><div style={{color:"#fff",fontSize:16,fontWeight:900}}>কর্মী প্রোফাইল</div><div style={{color:"rgba(255,255,255,0.8)",fontSize:11}}>ملف الموظف</div></div></div>
    <div style={{background:"#fff7ed",border:"1px solid #fed7aa",margin:"12px 16px 0",borderRadius:12,padding:"12px 14px"}}><div style={{color:"#92400e",fontSize:13,fontWeight:700,marginBottom:3}}>📋 অনুগ্রহ করে আপনার সমস্ত তথ্য সঠিকভাবে পূরণ করুন</div><div style={{color:"#a8834f",fontSize:11}}>أخي الموظف — يرجى تعبئة بياناتك كاملة</div></div>
    <div style={{padding:"12px 16px 32px",display:"flex",flexDirection:"column",gap:12,maxWidth:560,margin:"0 auto"}}>
      <Sec n="1" ar="البيانات الأساسية" bn="মৌলিক তথ্য" color="#E8712B">
        <F ar="الاسم الكامل" bn="পূর্ণ নাম" req><input value={form.full_name} onChange={e=>set("full_name",e.target.value)} style={inp("full_name")}/></F>
        <F ar="رقم الهوية/الإقامة" bn="পরিচয় নম্বর"><input value={form.id_number} onChange={e=>set("id_number",e.target.value)} style={g.inp}/></F>
        <F ar="رقم الجوال" bn="মোবাইল" req><input value={form.mobile} onChange={e=>set("mobile",e.target.value)} style={{...inp("mobile"),direction:"ltr",textAlign:"left"}}/></F>
        <F ar="تاريخ الميلاد" bn="জন্ম তারিখ"><input type="date" value={form.date_of_birth} onChange={e=>set("date_of_birth",e.target.value)} style={{...g.inp,direction:"ltr"}}/></F>
        <F ar="الجنسية" bn="জাতীয়তা" req><select value={form.nationality} onChange={e=>set("nationality",e.target.value)} style={inp("nationality")}><option value="">নির্বাচন করুন</option>{["بنغلادشي","هندي","باكستاني","نيبالي","إندونيسي","أخرى"].map(n=><option key={n} value={n}>{n}</option>)}</select></F>
        <F ar="ID سويتر" bn="সুইটার আইডি"><input value={form.employee_id} onChange={e=>set("employee_id",e.target.value)} style={g.inp}/></F>
      </Sec>
      <Sec n="2" ar="البيانات الجغرافية" bn="ভৌগোলিক তথ্য" color="#2563eb">
        <F ar="الدولة الأصلية" bn="স্বদেশ"><select value={form.home_country} onChange={e=>set("home_country",e.target.value)} style={g.inp}><option value="">নির্বাচন করুন</option>{["بنغلادش","الهند","باكستان","نيبال","إندونيسيا","أخرى"].map(c=><option key={c} value={c}>{c}</option>)}</select></F>
        <F ar="المنطقة/المحافظة" bn="জেলা"><input value={form.region} onChange={e=>set("region",e.target.value)} style={g.inp}/></F>
        <F ar="المدينة/القرية" bn="শহর/গ্রাম"><input value={form.city} onChange={e=>set("city",e.target.value)} style={g.inp}/></F>
        <F ar="المدة في السعودية" bn="সৌদিতে সময়"><select value={form.time_in_saudi} onChange={e=>set("time_in_saudi",e.target.value)} style={g.inp}><option value="">নির্বাচন করুন</option>{["أقل من سنة","1-2 سنة","2-3 سنوات","3-5 سنوات","أكثر من 5 سنوات"].map(t=><option key={t} value={t}>{t}</option>)}</select></F>
        <F ar="السكن الحالي في الرياض" bn="রিয়াদে বাসস্থান"><input value={form.residence_riyadh} onChange={e=>set("residence_riyadh",e.target.value)} style={g.inp}/></F>
      </Sec>
      <Sec n="3" ar="قناة التوظيف" bn="নিয়োগের মাধ্যম" color="#7c3aed">
        <F ar="المصدر" bn="উৎস"><select value={form.source} onChange={e=>set("source",e.target.value)} style={g.inp}><option value="">নির্বাচন করুন</option>{["حسين","ناهيد","مباشر","منصة","أخرى"].map(s=><option key={s} value={s}>{s}</option>)}</select></F>
        <F ar="اسم المُحيل" bn="রেফারার"><input value={form.referrer_name} onChange={e=>set("referrer_name",e.target.value)} style={g.inp}/></F>
        <F ar="صلة المُحيل" bn="সম্পর্ক"><select value={form.referrer_relation} onChange={e=>set("referrer_relation",e.target.value)} style={g.inp}><option value="">নির্বাচন করুন</option>{["صديق","قريب","زميل عمل سابق","أخرى"].map(r=><option key={r} value={r}>{r}</option>)}</select></F>
        <F ar="أقارب في الفريق؟" bn="দলে আত্মীয়?"><select value={form.has_relative_in_team} onChange={e=>set("has_relative_in_team",e.target.value)} style={g.inp}><option value="">নির্বাচন করুন</option><option value="نعم">নেই / نعم</option><option value="لا">না / لا</option></select></F>
        {form.has_relative_in_team==="نعم"&&<F ar="اسم القريب" bn="আত্মীয়ের নাম"><input value={form.relative_name} onChange={e=>set("relative_name",e.target.value)} style={g.inp}/></F>}
      </Sec>
      <Sec n="4" ar="الخلفية المهنية" bn="পেশাদার পটভূমি" color="#16a34a">
        <F ar="العمل السابق" bn="পূর্ববর্তী কাজ"><input value={form.previous_job} onChange={e=>set("previous_job",e.target.value)} style={g.inp}/></F>
        <F ar="خبرة الغسيل" bn="গাড়ি ধোয়ার অভিজ্ঞতা"><select value={form.car_wash_experience} onChange={e=>set("car_wash_experience",e.target.value)} style={g.inp}><option value="">নির্বাচন করুন</option>{["لا خبرة","أقل من سنة","1-2 سنة","2-3 سنوات","أكثر من 3 سنوات"].map(x=><option key={x} value={x}>{x}</option>)}</select></F>
        <F ar="عمل مع تطبيقات سابقاً؟" bn="আগে অ্যাপে কাজ?"><select value={form.worked_with_app} onChange={e=>set("worked_with_app",e.target.value)} style={g.inp}><option value="">নির্বাচন করুন</option><option value="نعم">হ্যাঁ / نعم</option><option value="لا">না / لا</option></select></F>
      </Sec>
      <button onClick={save} disabled={saving} style={{width:"100%",padding:15,background:"linear-gradient(135deg,#E8712B,#f5a35f)",border:"none",borderRadius:14,color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",marginBottom:32,opacity:saving?0.6:1}}>{saving?"সংরক্ষণ হচ্ছে...":"💾 সংরক্ষণ করুন"}</button>
    </div>
  </div>);
}
const g={page:{minHeight:"100dvh",background:"linear-gradient(170deg,#FFF9F0,#FFF3DC)",fontFamily:"'Segoe UI',Tahoma,sans-serif",direction:"rtl"},card:{background:"#fff",borderRadius:24,padding:"40px 28px",width:"100%",maxWidth:360,margin:"0 auto",boxShadow:"0 8px 40px rgba(0,0,0,0.1)"},hdr:{background:"linear-gradient(135deg,#E8712B,#f5a35f)",padding:"16px 20px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:100},back:{padding:"8px 14px",background:"rgba(255,255,255,0.2)",border:"none",borderRadius:10,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0},tick:{width:72,height:72,background:"linear-gradient(135deg,#2E7D32,#1b5e20)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:32,fontWeight:900,margin:"0 auto"},inp:{width:"100%",padding:"11px 14px",border:"1.5px solid #e2e8f0",borderRadius:12,fontSize:14,color:"#1e293b",outline:"none",background:"#fafaf9",boxSizing:"border-box",direction:"rtl",fontFamily:"inherit"}};
