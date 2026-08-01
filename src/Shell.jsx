import{useState,useEffect,lazy,Suspense}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import DashboardHome from"./DashboardHome";
const AdminDashboard=lazy(()=>import("./AdminDashboard"));
const UserManagement=lazy(()=>import("./UserManagement"));
const Payroll=lazy(()=>import("./Payroll"));
const Operations=lazy(()=>import("./Operations"));

const NAV=[
  {g:"الرئيسية"},
  {k:"dashboard",ar:"لوحة القيادة",ic:"dashboard"},
  {g:"التوظيف"},
  {k:"recruitment",ar:"المتقدّمون",ic:"applicants"},
  {k:"interviews",ar:"المقابلات",ic:"interview",soon:1},
  {k:"onboarding",ar:"التعاقد والإعداد",ic:"onboarding",soon:1},
  {g:"التشغيل"},
  {k:"operations",ar:"العمليات اليومية",ic:"operations"},
  {k:"performance",ar:"الأداء",ic:"performance",soon:1},
  {k:"payroll",ar:"الرواتب",ic:"payroll"},
  {k:"complaints",ar:"الشكاوى",ic:"complaints",soon:1},
  {k:"field_rounds",ar:"الجولات الميدانية",ic:"rounds",soon:1},
  {g:"الإدارة"},
  {k:"employees",ar:"الموظفون",ic:"employees",soon:1},
  {k:"vendors",ar:"الموردون",ic:"vendors",soon:1},
  {k:"reports",ar:"التقارير",ic:"reports",soon:1},
  {k:"users",ar:"المستخدمون",ic:"users"},
  {k:"tma",ar:"المواهب TMA",ic:"tma",lock:1},
];
const TITLES={dashboard:["لوحة القيادة","نظرة عامة على الأداء"],recruitment:["التوظيف","إدارة المتقدّمين والقبول"],users:["المستخدمون","الحسابات والصلاحيات"]};

export default function Shell({onLogout,me}){
  const[view,setView]=useState("dashboard");
  const[open,setOpen]=useState(false);
  const[ops,setOps]=useState([]);const[op,setOp]=useState("all");
  const[menu,setMenu]=useState(false);
  useEffect(()=>{supabase.from("operators").select("id,name,active").order("created_at").then(({data})=>setOps(data||[]));},[]);
  const nm=(me&&me.display_name)||"إبراهيم المالكي";
  const owner=!!(me&&me.is_owner);
  const nav=NAV.filter(n=>owner||(n.k!=="users"&&n.k!=="tma"));
  const go=k=>{setView(k);setOpen(false);};
  const [t,sub]=TITLES[view]||[NAV.find(n=>n.k===view)?.ar||"",""];

  return(<div className="sh">
    <style>{CSS}</style>
    {open&&<div className="sh-scrim" onClick={()=>setOpen(false)}/>}
    <aside className={"sh-side"+(open?" open":"")}>
      <div className="sh-brand"><div className="sh-logo"><Icon n="bucket" s={22}/></div><div><b>دلو ورغوة</b><span>منصّة إدارة العمليات</span></div></div>
      <nav className="sh-nav">
        {nav.map((n,i)=>n.g?<div className="sh-navlbl" key={i}>{n.g}</div>:
          <div key={n.k} className={"sh-item"+(view===n.k?" on":"")} onClick={()=>n.lock?null:go(n.k)}>
            <span className="sh-ic"><Icon n={n.ic} s={18}/></span>{n.ar}
            {n.lock&&<span className="sh-lock"><Icon n="lock" s={13}/></span>}{n.soon&&<span className="sh-soon">قريباً</span>}
          </div>)}
      </nav>
      <div className="sh-foot"><div className="sh-prof"><div className="sh-av">{nm.trim().charAt(0)}</div><div style={{flex:1,minWidth:0}}><b>{nm}</b><span>{owner?"المالك · صلاحية كاملة":"مستخدم"}</span></div></div></div>
    </aside>

    <div className="sh-main">
      <header className="sh-top">
        <button className="sh-burger" onClick={()=>setOpen(true)}><Icon n="menu" s={22}/></button>
        <div className="sh-ttl"><h1>{t}</h1><div className="sh-sub">{sub}</div></div>
        <div className="sh-ops">
          <span className="sh-ops-ic"><Icon n="building" s={16}/></span>
          <select value={op} onChange={e=>setOp(e.target.value)}>
            <option value="all">كل المشغّلين</option>
            {ops.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <button className="sh-ib sh-hm"><Icon n="bell" s={18}/><span className="sh-dot"/></button>
        <div style={{position:"relative"}}>
          <button className="sh-ib" onClick={()=>setMenu(!menu)}><div className="sh-av2">{nm.trim().charAt(0)}</div></button>
          {menu&&<div className="sh-menu">{owner&&<div className="sh-mi" onClick={()=>{setMenu(false);go("users");}}><Icon n="users" s={16}/> المستخدمون</div>}<div className="sh-mi" onClick={onLogout}><Icon n="logout" s={16}/> تسجيل الخروج</div></div>}
        </div>
      </header>
      <div className="sh-content">
        {view==="dashboard"&&<DashboardHome onNav={go}/>}
        {view==="recruitment"&&<Suspense fallback={<Sk/>}><div className="sh-embed"><AdminDashboard embedded onLogout={onLogout}/></div></Suspense>}
        {view==="users"&&owner&&<Suspense fallback={<Sk/>}><UserManagement onClose={()=>go("dashboard")}/></Suspense>}
        {view==="payroll"&&<Suspense fallback={<Sk/>}><Payroll opId={op}/></Suspense>}
        {view==="operations"&&<Suspense fallback={<Sk/>}><Operations opId={op}/></Suspense>}
        {["interviews","onboarding","performance","complaints","field_rounds","employees","vendors","reports"].includes(view)&&<Soon ic={NAV.find(n=>n.k===view)?.ic} name={NAV.find(n=>n.k===view)?.ar}/>}
      </div>
    </div>
  </div>);
}
function Sk(){return<div className="dw-skel" style={{height:200}}/>;}
function Soon({ic,name}){return(<div className="sh-soonbox"><div className="sh-soonic"><Icon n={ic} s={30}/></div><h2>{name}</h2><p>هذه الوحدة قيد البناء ضمن خارطة الطريق — ستظهر هنا بنفس المستوى الاحترافي فور اكتمالها.</p></div>);}

const CSS=`
.sh{--bg:#f4f5f7;--panel:#fff;--ink:#0f172a;--mut:#64748b;--line:#eceef1;--line2:#e6e9ee;--brand:#E8712B;--side:#0e1622;--side2:#141f2e;--sidink:#c7d0dc;--sidmut:#7c8aa0;--shadow:0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.05);--r:16px;display:grid;grid-template-columns:246px 1fr;min-height:100dvh;background:var(--bg);font-family:'Segoe UI',Tahoma,system-ui,sans-serif;color:var(--ink);font-size:14px}
.sh *{box-sizing:border-box}
.sh-scrim{display:none}
.sh-side{background:var(--side);color:var(--sidink);display:flex;flex-direction:column;position:sticky;top:0;height:100dvh}
.sh-brand{display:flex;align-items:center;gap:11px;padding:20px 20px 14px}
.sh-logo{width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,var(--brand),#f5a35f);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 6px 16px rgba(232,113,43,.35)}
.sh-brand b{font-size:15px;font-weight:800;color:#fff;display:block}.sh-brand span{font-size:11px;color:var(--sidmut)}
.sh-nav{padding:6px 12px;flex:1;overflow:auto}
.sh-navlbl{font-size:10.5px;color:var(--sidmut);font-weight:700;letter-spacing:.4px;padding:13px 10px 5px}
.sh-item{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:11px;color:var(--sidink);font-size:13.5px;font-weight:600;cursor:pointer;margin-bottom:2px;position:relative}
.sh-ic{width:20px;display:flex;align-items:center;justify-content:center;opacity:.9}
.sh-item.on .sh-ic{opacity:1;color:var(--brand)}
.sh-item:hover{background:var(--side2)}
.sh-item.on{background:linear-gradient(90deg,rgba(232,113,43,.16),transparent);color:#fff}
.sh-item.on::before{content:"";position:absolute;inset-inline-start:0;top:8px;bottom:8px;width:3px;border-radius:3px;background:var(--brand)}
.sh-lock,.sh-soon{margin-inline-start:auto;font-size:10px;opacity:.6;display:flex;align-items:center}
.sh-soon{background:var(--side2);padding:1px 7px;border-radius:20px;font-weight:700}
.sh-foot{padding:12px;border-top:1px solid rgba(255,255,255,.06)}
.sh-prof{display:flex;align-items:center;gap:10px;padding:8px;border-radius:11px}
.sh-av{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#334155,#475569);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;flex:none}
.sh-prof b{font-size:12.5px;color:#fff;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sh-prof span{font-size:10.5px;color:var(--sidmut)}
.sh-main{display:flex;flex-direction:column;min-width:0}
.sh-top{background:rgba(255,255,255,.88);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:12px 20px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:30}
.sh-burger{display:none;background:none;border:none;font-size:20px;cursor:pointer;color:var(--ink)}
.sh-ttl h1{font-size:16px;font-weight:800;margin:0}.sh-sub{font-size:12px;color:var(--mut)}
.sh-ops{margin-inline-start:auto;display:flex;align-items:center;gap:7px;background:var(--bg);border:1px solid var(--line2);border-radius:11px;padding:6px 10px}
.sh-ops-ic{display:flex;align-items:center;color:var(--mut)}
.sh-ops select{border:none;background:none;outline:none;font-family:inherit;font-size:13px;font-weight:700;color:var(--ink);cursor:pointer}
.sh-ib{width:38px;height:38px;border-radius:11px;border:1px solid var(--line2);background:var(--panel);display:flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer;position:relative}
.sh-dot{position:absolute;top:8px;inset-inline-end:9px;width:7px;height:7px;border-radius:50%;background:#f04438;border:1.5px solid #fff}
.sh-av2{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#E8712B,#f5a35f);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:12px}
.sh-menu{position:absolute;top:46px;inset-inline-start:0;background:#fff;border:1px solid var(--line2);border-radius:12px;box-shadow:0 8px 24px rgba(16,24,40,.12);overflow:hidden;min-width:170px;z-index:40}
.sh-mi{padding:11px 14px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:9px;color:var(--ink)}.sh-mi:hover{background:var(--bg)}
.sh-content{padding:20px;max-width:1200px;width:100%;margin:0 auto}
.sh-embed{margin:-20px;}
.sh-soonbox{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:48px 24px;text-align:center;box-shadow:var(--shadow)}
.sh-soonic{width:64px;height:64px;border-radius:18px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#fff2e8,#ffe2cc);color:var(--brand)}
.sh-soonbox h2{font-size:18px;margin:0 0 8px}.sh-soonbox p{color:var(--mut);font-size:13px;max-width:420px;margin:0 auto;line-height:1.7}
/* ── design system used by DashboardHome ── */
.dw-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.dw-kpi{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:16px 18px;box-shadow:var(--shadow)}
.dw-clk{cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s}
.dw-clk:hover{border-color:#f5c9a8;box-shadow:0 6px 18px rgba(232,113,43,.14);transform:translateY(-1px)}
.dw-tbl tbody tr{transition:background .12s}.dw-tbl tbody tr:hover{background:#fbfaf8}
.dw-ki{display:flex;align-items:center;justify-content:center}
.dw-kh{display:flex;align-items:center;justify-content:space-between}
.dw-kl{font-size:12.5px;color:var(--mut);font-weight:600}
.dw-ki{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px}
.dw-kn{font-size:27px;font-weight:800;margin-top:8px;letter-spacing:-.5px}
.dw-kd{font-size:11.5px;font-weight:700;margin-top:2px}
.dw-row{display:grid;gap:14px;margin-top:14px}
.dw-2{grid-template-columns:1.35fr 1fr}.dw-2b{grid-template-columns:1fr 1.35fr}
.dw-panel{background:#fff;border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow)}
.dw-ph{display:flex;align-items:center;justify-content:space-between;padding:15px 18px;border-bottom:1px solid var(--line)}
.dw-ph b{font-size:14.5px;font-weight:800}.dw-a{font-size:12px;color:var(--brand);font-weight:700;cursor:pointer}
.dw-pb{padding:16px 18px}
.dw-fun{display:flex;flex-direction:column;gap:9px}
.dw-frow{display:grid;grid-template-columns:92px 1fr 42px;align-items:center;gap:10px;font-size:12.5px}
.dw-fl{color:var(--mut);font-weight:600}
.dw-fbar{height:26px;background:var(--bg);border-radius:8px;overflow:hidden}
.dw-ffill{height:100%;border-radius:8px;background:linear-gradient(90deg,var(--brand),#f5a35f);display:flex;align-items:center;padding:0 9px;color:#fff;font-size:11.5px;font-weight:800}
.dw-fv{font-weight:800;text-align:center;color:var(--mut)}
.dw-tbl{width:100%;border-collapse:collapse}
.dw-tbl th{font-size:11px;color:var(--mut);font-weight:700;text-align:right;padding:10px 14px;border-bottom:1px solid var(--line);background:#fafbfc}
.dw-tbl td{padding:11px 14px;border-bottom:1px solid var(--line);font-size:13px}
.dw-tbl tr:last-child td{border-bottom:none}
.dw-cand{display:flex;align-items:center;gap:11px}
.dw-cav{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:13px;flex:none}
.dw-cand small{color:var(--mut);font-size:11.5px}
.dw-score{display:inline-flex;align-items:center;justify-content:center;min-width:44px;padding:3px 8px;border-radius:8px;font-weight:800;font-size:12.5px}
.dw-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11.5px;font-weight:700}
.p-acc{background:#e7f7ef;color:#087443}.p-pend{background:#fef3e2;color:#b54708}.p-rej{background:#feecea;color:#b42318}
.dw-dot{width:6px;height:6px;border-radius:50%;background:currentColor}
.dw-team{display:flex;flex-direction:column;gap:14px}
.dw-tm{display:grid;grid-template-columns:130px 1fr 46px;align-items:center;gap:10px}
.dw-tn{font-size:12.5px;font-weight:700}.dw-tn small{color:var(--mut);font-weight:500;display:block;font-size:10.5px}
.dw-tbar{height:9px;border-radius:6px;background:var(--bg);overflow:hidden}
.dw-tv{font-weight:800;font-size:13px;text-align:left}
.dw-goal{font-size:11px;color:var(--mut);margin-top:3px}
.dw-track{height:8px;background:var(--bg);border-radius:6px;margin-top:12px;overflow:hidden}
.dw-track div{height:100%;background:linear-gradient(90deg,#12b76a,#32d583);border-radius:6px}
.dw-skel{background:linear-gradient(90deg,#eef0f3 25%,#f6f7f9 37%,#eef0f3 63%);background-size:400% 100%;animation:shim 1.4s infinite;border-radius:16px}
@keyframes shim{0%{background-position:100% 0}100%{background-position:-100% 0}}
@media(max-width:900px){
  .sh{grid-template-columns:1fr}
  .sh-side{position:fixed;inset-inline-start:0;top:0;width:250px;z-index:60;transform:translateX(100%);transition:.25s;box-shadow:-8px 0 30px rgba(0,0,0,.3)}
  .sh-side.open{transform:translateX(0)}
  .sh-scrim{display:block;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:55}
  .sh-burger{display:block}
  .dw-kpis{grid-template-columns:1fr 1fr}
  .dw-2,.dw-2b{grid-template-columns:1fr}
  .sh-content{padding:14px}.sh-embed{margin:-14px}
  .sh-hm,.dw-hm{display:none}
}
`;
