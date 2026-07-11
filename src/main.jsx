import React,{useState,useEffect,lazy,Suspense}from"react";
import ReactDOM from"react-dom/client";
import LandingPage from"./LandingPage";
import EmployeePage from"./EmployeePage";
import RecruitmentAd from"./RecruitmentAd";
const ApplicantForm=lazy(()=>import("./ApplicantForm"));
const AdminDashboard=lazy(()=>import("./AdminDashboard"));
const InterviewPage=lazy(()=>import("./InterviewPage"));
const Spin=()=><div style={{minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:40,height:40,border:"3px solid #fed7aa",borderTopColor:"#E8712B",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/></div>;
function Login({onLogin}){const[p,setP]=useState("");const[e,setE]=useState("");const go=()=>{if(p==="Dalu@2026"){localStorage.setItem("dalu_admin","dalu-admin-ibrahim-2026");onLogin();}else setE("كلمة المرور غير صحيحة");};return(<div style={{minHeight:"100dvh",background:"linear-gradient(160deg,#fff7ed,#fff)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',Tahoma,sans-serif"}}><div style={{background:"#fff",borderRadius:24,padding:"40px 32px",width:"100%",maxWidth:360,boxShadow:"0 8px 40px rgba(232,113,43,0.15)",textAlign:"center"}}><div style={{fontSize:52,marginBottom:12}}>🪣</div><div style={{color:"#1e293b",fontSize:20,fontWeight:900,marginBottom:4}}>لوحة التحكم</div><div style={{color:"#64748b",fontSize:12,marginBottom:20}}>دلو ورغوة</div><input type="password" value={p} onChange={e=>setP(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="كلمة المرور" style={{width:"100%",padding:"13px 16px",border:"2px solid #e2e8f0",borderRadius:14,fontSize:15,outline:"none",textAlign:"center",boxSizing:"border-box",marginBottom:8}}/>{e&&<div style={{color:"#dc2626",fontSize:12,marginBottom:8}}>{e}</div>}<button onClick={go} style={{width:"100%",padding:13,background:"linear-gradient(135deg,#E8712B,#CC5200)",border:"none",borderRadius:14,color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer"}}>دخول →</button></div></div>);}
function App(){
  const[page,setPage]=useState("landing");
  const[loggedIn,setLoggedIn]=useState(localStorage.getItem("dalu_admin")==="dalu-admin-ibrahim-2026");
  const urlParams=new URLSearchParams(window.location.search);
  const sessionId=urlParams.get("interview");
  const directApply=urlParams.get("apply");
  useEffect(()=>{
    if(sessionId){setPage("interview");return;}
    if(directApply){setPage("ad");return;}
    if(window.location.hash==="#admin")setPage("admin");
    const h=()=>{if(window.location.hash==="#admin")setPage("admin");};
    window.addEventListener("hashchange",h);
    return()=>window.removeEventListener("hashchange",h);
  },[]);
  return(<Suspense fallback={<Spin/>}>{page==="landing"&&<LandingPage onRecruit={()=>setPage("ad")} onEmployee={()=>setPage("employee")}/>}{page==="ad"&&<RecruitmentAd onApply={()=>setPage("recruit")} onBack={()=>setPage("landing")}/>}{page==="recruit"&&<ApplicantForm onBack={()=>setPage("ad")}/>}{page==="employee"&&<EmployeePage onBack={()=>setPage("landing")}/>}{page==="interview"&&sessionId&&<InterviewPage sessionId={sessionId}/>}{page==="admin"&&(!loggedIn?<Login onLogin={()=>setLoggedIn(true)}/>:<AdminDashboard onLogout={()=>{localStorage.removeItem("dalu_admin");setLoggedIn(false);setPage("landing");window.location.hash="";}}/>)}</Suspense>);
}
ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><App/></React.StrictMode>);
