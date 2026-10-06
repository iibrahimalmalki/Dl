import React,{useState,useEffect,lazy,Suspense}from"react";
import ReactDOM from"react-dom/client";
import"./theme.css";
import{supabase}from"./supabase";
import{ThemeProvider}from"./theme";
import{ToastProvider,ThemeToggle}from"./ui";
import LandingPage from"./LandingPage";
import RecruitmentAd from"./RecruitmentAd";
// رابط قديم «/?employee=…»: الصفحة العامة لبيانات الموظف أُلغيت — لا تقرأ شيئاً من القاعدة
function OldEmployeeLink(){
  return <div dir="rtl" style={{minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"var(--bg)",fontFamily:"var(--font)"}}>
    <div className="g-card" style={{maxWidth:380,width:"100%",padding:"28px 22px",textAlign:"center",display:"flex",flexDirection:"column",gap:12}}>
      <b style={{fontSize:17,color:"var(--ink)",lineHeight:1.6}}>حدّث بياناتك من بوابة البايكر بعد تسجيل الدخول</b>
      <span lang="bn" style={{fontSize:14,color:"var(--mut)",lineHeight:1.7}}>লগইন করে বাইকার পোর্টাল থেকে আপনার তথ্য আপডেট করুন</span>
      <a className="g-btn primary block" style={{minHeight:50,fontSize:15}} href="/#biker">بوابة البايكر · বাইকার পোর্টাল</a>
    </div></div>;
}

const ApplicantForm=lazy(()=>import("./ApplicantForm"));
const InterviewPage=lazy(()=>import("./InterviewPage"));
const TMAQuestionnaire=lazy(()=>import("./TMAQuestionnaire"));
const Shell=lazy(()=>import("./Shell"));
const BikerPortal=lazy(()=>import("./BikerPortal"));
const Spin=()=><div style={{minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)"}}><div className="g-spin" style={{width:40,height:40}}/></div>;

// ═══ تسجيل الدخول عبر Supabase Auth (بريد + كلمة مرور) — استبدل كلمة المرور المكتوبة ═══
function Login(){
  const[email,setEmail]=useState("");const[pw,setPw]=useState("");const[err,setErr]=useState("");const[busy,setBusy]=useState(false);
  const go=async()=>{
    setErr("");setBusy(true);
    const{error}=await supabase.auth.signInWithPassword({email:email.trim(),password:pw});
    setBusy(false);
    if(error)setErr("بيانات الدخول غير صحيحة");
  };
  const inp={padding:"13px 16px",fontSize:15,marginBottom:10,direction:"ltr",textAlign:"left"};
  return(<div style={{minHeight:"100dvh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--font)",position:"relative",padding:16}}>
    <div className="g-orbs" aria-hidden><span className="g-orb a"/><span className="g-orb b"/><span className="g-orb c"/></div>
    <div style={{position:"absolute",top:14,insetInlineStart:14,zIndex:2}}><ThemeToggle/></div>
    <div className="g-card pad" style={{borderRadius:24,padding:"40px 32px",width:"100%",maxWidth:360,textAlign:"center",position:"relative",zIndex:1}}><img src="/brand-logo.png" alt="دلو ورغوة" style={{width:180,maxWidth:"70%",height:"auto",margin:"0 auto 14px",display:"block"}}/><div style={{color:"var(--ink)",fontSize:18,fontWeight:900,marginBottom:4}}>لوحة التحكم</div><div style={{color:"var(--mut)",fontSize:12,marginBottom:18}}>المنصة التشغيلية · دلو ورغوة</div><input className="g-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="البريد الإلكتروني" style={inp}/><input className="g-input" type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="كلمة المرور" style={inp}/>{err&&<div style={{color:"var(--bad-ink)",fontSize:12,marginBottom:8}}>{err}</div>}<button className="g-btn primary block" onClick={go} disabled={busy} style={{padding:13,fontSize:14,fontWeight:800}}>{busy?"جاري الدخول...":"دخول →"}</button></div></div>);
}

function App(){
  const[page,setPage]=useState("landing");
  const[session,setSession]=useState(null);
  const[authReady,setAuthReady]=useState(false);
  const[me,setMe]=useState(null);       // صف app_users للمستخدم الحالي (is_owner…)
  const urlParams=new URLSearchParams(window.location.search);
  const sessionId=urlParams.get("interview");
  const tmaToken=urlParams.get("tma");
  const directApply=urlParams.get("apply");
  const employeeEditId=urlParams.get("employee");
  useEffect(()=>{
    if(tmaToken){setPage("tma");return;}
    if(sessionId){setPage("interview");return;}
    if(directApply){setPage("ad");return;}
    if(employeeEditId){setPage("employee");return;}
    const adm=()=>/^#(admin|ui-kit)$/.test(window.location.hash);
    if(adm())setPage("admin");
    if(window.location.hash==="#biker")setPage("biker");
    const h=()=>{if(adm())setPage("admin");else if(window.location.hash==="#biker")setPage("biker");else if(!window.location.hash)setPage("landing");};
    window.addEventListener("hashchange",h);
    return()=>window.removeEventListener("hashchange",h);
  },[]);
  // متابعة جلسة المصادقة
  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{setSession(data.session||null);setAuthReady(true);});
    const{data:sub}=supabase.auth.onAuthStateChange((_e,s)=>{setSession(s||null);});
    return()=>sub.subscription.unsubscribe();
  },[]);
  // تحميل هوية المستخدم (مالك/صلاحيات) عند وجود جلسة
  useEffect(()=>{
    if(!session){setMe(null);return;}
    supabase.from("app_users").select("id,is_owner,display_name,active,biker_employee_id,position").eq("id",session.user.id).maybeSingle()
      .then(({data})=>setMe(data||{id:session.user.id,is_owner:false,active:true}));
  },[session]);
  const logout=async()=>{await supabase.auth.signOut();setPage("landing");window.location.hash="";};

  const adminView=()=>{
    if(!authReady)return <Spin/>;
    if(!session)return <Login/>;
    if(!me)return <Spin/>;
    // البايكر (مرتبط بسجل موظف وبلا منصب إداري) → بوابته الخاصة؛ الإداريون والمشرفون → لوحة الإدارة
    if(!me.is_owner&&me.biker_employee_id&&(!me.position||me.position==="team_leader"))return <BikerPortal me={me} onLogout={logout}/>;
    return <Shell onLogout={logout} me={me}/>;
  };

  return(<Suspense fallback={<Spin/>}>
    {page==="landing"&&<LandingPage onBiker={()=>{window.location.hash="#biker";setPage("biker");}} onLogin={()=>{window.location.hash="#admin";setPage("admin");}}/>}
    {page==="biker"&&<BikerPortal/>}
    {page==="ad"&&<RecruitmentAd onApply={()=>setPage("recruit")} onBack={()=>setPage("landing")}/>}
    {page==="recruit"&&<ApplicantForm onBack={()=>setPage("ad")}/>}
    {page==="employee"&&<OldEmployeeLink/>}
    {page==="interview"&&sessionId&&<InterviewPage sessionId={sessionId}/>}
    {page==="tma"&&tmaToken&&<TMAQuestionnaire token={tmaToken}/>}
    {page==="admin"&&adminView()}
  </Suspense>);
}
ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><ThemeProvider><ToastProvider><App/></ToastProvider></ThemeProvider></React.StrictMode>);
// ═══ PWA: تسجيل عامل الخدمة في الإنتاج فقط (تثبيت المنصة على الجوال + كاش الأصول) ═══
if(import.meta.env.PROD&&"serviceWorker"in navigator){window.addEventListener("load",()=>{navigator.serviceWorker.register("/sw.js").catch(()=>{});});}
