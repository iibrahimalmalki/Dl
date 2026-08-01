import React,{useState,useEffect,lazy,Suspense}from"react";
import ReactDOM from"react-dom/client";
import{supabase}from"./supabase";
import LandingPage from"./LandingPage";
import EmployeePage from"./EmployeePage";
import RecruitmentAd from"./RecruitmentAd";
const ApplicantForm=lazy(()=>import("./ApplicantForm"));
const InterviewPage=lazy(()=>import("./InterviewPage"));
const Shell=lazy(()=>import("./Shell"));
const BikerPortal=lazy(()=>import("./BikerPortal"));
const Spin=()=><div style={{minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:40,height:40,border:"3px solid #fed7aa",borderTopColor:"#E8712B",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/></div>;

// ═══ تسجيل الدخول عبر Supabase Auth (بريد + كلمة مرور) — استبدل كلمة المرور المكتوبة ═══
function Login(){
  const[email,setEmail]=useState("");const[pw,setPw]=useState("");const[err,setErr]=useState("");const[busy,setBusy]=useState(false);
  const go=async()=>{
    setErr("");setBusy(true);
    const{error}=await supabase.auth.signInWithPassword({email:email.trim(),password:pw});
    setBusy(false);
    if(error)setErr("بيانات الدخول غير صحيحة");
  };
  const inp={width:"100%",padding:"13px 16px",border:"2px solid #e2e8f0",borderRadius:14,fontSize:15,outline:"none",boxSizing:"border-box",marginBottom:10,direction:"ltr",textAlign:"left"};
  return(<div style={{minHeight:"100dvh",background:"linear-gradient(160deg,#fff7ed,#fff)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',Tahoma,sans-serif"}}><div style={{background:"#fff",borderRadius:24,padding:"40px 32px",width:"100%",maxWidth:360,boxShadow:"0 8px 40px rgba(232,113,43,0.15)",textAlign:"center"}}><div style={{fontSize:52,marginBottom:12}}>🪣</div><div style={{color:"#1e293b",fontSize:20,fontWeight:900,marginBottom:4}}>لوحة التحكم</div><div style={{color:"#64748b",fontSize:12,marginBottom:20}}>دلو ورغوة</div><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="البريد الإلكتروني" style={inp}/><input type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="كلمة المرور" style={inp}/>{err&&<div style={{color:"#dc2626",fontSize:12,marginBottom:8}}>{err}</div>}<button onClick={go} disabled={busy} style={{width:"100%",padding:13,background:"linear-gradient(135deg,#E8712B,#CC5200)",border:"none",borderRadius:14,color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",opacity:busy?.6:1}}>{busy?"جاري الدخول...":"دخول →"}</button></div></div>);
}

function App(){
  const[page,setPage]=useState("landing");
  const[session,setSession]=useState(null);
  const[authReady,setAuthReady]=useState(false);
  const[me,setMe]=useState(null);       // صف app_users للمستخدم الحالي (is_owner…)
  const urlParams=new URLSearchParams(window.location.search);
  const sessionId=urlParams.get("interview");
  const directApply=urlParams.get("apply");
  const employeeEditId=urlParams.get("employee");
  useEffect(()=>{
    if(sessionId){setPage("interview");return;}
    if(directApply){setPage("ad");return;}
    if(employeeEditId){setPage("employee");return;}
    if(window.location.hash==="#admin")setPage("admin");
    const h=()=>{if(window.location.hash==="#admin")setPage("admin");};
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
    supabase.from("app_users").select("is_owner,display_name,active,biker_employee_id").eq("id",session.user.id).maybeSingle()
      .then(({data})=>setMe(data||{is_owner:false,active:true}));
  },[session]);
  const logout=async()=>{await supabase.auth.signOut();setPage("landing");window.location.hash="";};

  const adminView=()=>{
    if(!authReady)return <Spin/>;
    if(!session)return <Login/>;
    if(!me)return <Spin/>;
    // البايكر (له رقم سويتر وليس مالكاً) → بوابته الخاصة؛ غير ذلك → لوحة الإدارة
    if(!me.is_owner&&me.biker_employee_id)return <BikerPortal me={me} onLogout={logout}/>;
    return <Shell onLogout={logout} me={me}/>;
  };

  return(<Suspense fallback={<Spin/>}>
    {page==="landing"&&<LandingPage onRecruit={()=>setPage("ad")} onEmployee={()=>setPage("employee")}/>}
    {page==="ad"&&<RecruitmentAd onApply={()=>setPage("recruit")} onBack={()=>setPage("landing")}/>}
    {page==="recruit"&&<ApplicantForm onBack={()=>setPage("ad")}/>}
    {page==="employee"&&<EmployeePage onBack={()=>setPage("landing")} employeeId={employeeEditId}/>}
    {page==="interview"&&sessionId&&<InterviewPage sessionId={sessionId}/>}
    {page==="admin"&&adminView()}
  </Suspense>);
}
ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><App/></React.StrictMode>);
