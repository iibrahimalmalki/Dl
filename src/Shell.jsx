import{useState,useEffect,lazy,Suspense}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import DashboardHome from"./DashboardHome";
import Notifications from"./Notifications";
import GlassSidebar from"./GlassSidebar";
import{Search}from"lucide-react";
import{useTheme}from"./theme";
import{ThemeToggle,Orbs}from"./ui";
import GlobalSearch from"./GlobalSearch";
const AdminDashboard=lazy(()=>import("./AdminDashboard"));
const UserManagement=lazy(()=>import("./UserManagement"));
const Payroll=lazy(()=>import("./Payroll"));
const Operations=lazy(()=>import("./Operations"));
const Complaints=lazy(()=>import("./Complaints"));
const Performance=lazy(()=>import("./Performance"));
const FieldRounds=lazy(()=>import("./FieldRounds"));
const Onboarding=lazy(()=>import("./Onboarding"));
const Interviews=lazy(()=>import("./Interviews"));
const TMA=lazy(()=>import("./TMA"));
const Sourcing=lazy(()=>import("./Sourcing"));
const OrgStructure=lazy(()=>import("./OrgStructure"));
const MyTeam=lazy(()=>import("./MyTeam"));
const Vendors=lazy(()=>import("./Vendors"));
const Supply=lazy(()=>import("./Supply"));
const SupplyRequests=lazy(()=>import("./SupplyRequests"));
const Custody=lazy(()=>import("./Custody"));
const Renewals=lazy(()=>import("./Renewals"));
const Fleet=lazy(()=>import("./Fleet"));
const SweaterPricing=lazy(()=>import("./SweaterPricing"));
const Settlement=lazy(()=>import("./Settlement"));
const SweaterReconciliation=lazy(()=>import("./SweaterReconciliation"));
const DamageClaims=lazy(()=>import("./DamageClaims"));
const Housing=lazy(()=>import("./Housing"));
const Offboarding=lazy(()=>import("./Offboarding"));
const IncidentsPenalties=lazy(()=>import("./IncidentsPenalties"));
const AuditLog=lazy(()=>import("./AuditLog"));
const Reports=lazy(()=>import("./Reports"));
const GosiTracker=lazy(()=>import("./GosiTracker"));
const JobAdManager=lazy(()=>import("./JobAdManager"));
const BikerPortal=lazy(()=>import("./BikerPortal"));
const SUPERVISOR_POS=["sec_ops","ops1","field_sup"];
// الصفحات المنقولة إلى نظام التصميم الزجاجي (تتبع الوضع الداكن). غير المنقولة تُعرض كجزيرة فاتحة حتى نقلها.
// migrated pages follow the theme; others render inside a light island until migrated (Phase 1/2)
const GLASS_READY=new Set(["dashboard"]);

const NAV=[
  {g:"الرئيسية"},
  {k:"dashboard",ar:"لوحة القيادة",ic:"dashboard"},
  {g:"الموارد البشرية"},
  {k:"job_ad",ar:"إعلان التوظيف",ic:"send"},
  {k:"recruitment",ar:"المتقدّمون",ic:"applicants"},
  {k:"interviews",ar:"المقابلات",ic:"interview"},
  {k:"sourcing",ar:"معايير الاستقطاب",ic:"globe"},
  {k:"onboarding",ar:"التعاقد والإعداد",ic:"onboarding"},
  {k:"employees",ar:"الموظفون",ic:"employees"},
  {k:"offboarding",ar:"إنهاء الخدمة",ic:"logout"},
  {k:"tma",ar:"المواهب TMA",ic:"tma",lock:1},
  {g:"التشغيل"},
  {k:"operations",ar:"العمليات اليومية",ic:"operations"},
  {k:"performance",ar:"الأداء",ic:"performance"},
  {k:"field_rounds",ar:"الجولات الميدانية",ic:"rounds"},
  {k:"complaints",ar:"الشكاوى والمخالفات",ic:"complaints"},
  {k:"incidents",ar:"الحوادث والجزاءات",ic:"alert"},
  {k:"myteam",ar:"فريقي",ic:"bike",sup:1},
  {g:"المالية"},
  {k:"payroll",ar:"الرواتب",ic:"payroll"},
  {k:"pricing",ar:"المقابل والتسعير",ic:"cash"},
  {k:"settlement",ar:"تسوية سويتر",ic:"compare"},
  {k:"reconciliation",ar:"مطابقة/مطالبة سويتر",ic:"reports"},
  {k:"damage_claims",ar:"دعاوى ضرر العملاء",ic:"alert"},
  {k:"vendors",ar:"الموردون والمصروفات",ic:"vendors"},
  {k:"gosi",ar:"تأمينات GOSI",ic:"cash"},
  {g:"الدعم اللوجستي وسلاسل الإمداد"},
  {k:"fleet",ar:"الأسطول والحوادث",ic:"bike"},
  {k:"housing",ar:"السكن والإقامة",ic:"home"},
  {k:"renewals",ar:"الوثائق والتجديدات",ic:"doc"},
  {k:"supply",ar:"سلاسل الإمداد",ic:"bucket"},
  {k:"supply_requests",ar:"طلبات الإمداد والتصعيد",ic:"send"},
  {k:"custody",ar:"العُهد والإهلاك",ic:"key"},
  {g:"الإدارة والحوكمة"},
  {k:"org",ar:"الهيكل التنظيمي",ic:"building"},
  {k:"reports",ar:"التقارير",ic:"reports"},
  {k:"users",ar:"المستخدمون",ic:"users"},
  {k:"audit",ar:"سجل التدقيق",ic:"eye",lock:1},
];
const TITLES={dashboard:["لوحة القيادة","نظرة عامة على الأداء"],job_ad:["إعلان التوظيف","تحرير الإعلان العام · فتح/إغلاق التوظيف · مشاركة الرابط"],recruitment:["المتقدّمون","إدارة الطلبات والقبول"],employees:["الموظفون","فريق العمل وملفاتهم"],reports:["مركز التقارير","المالية والتشغيل والامتثال والتوظيف — بفلاتر وتصدير"],interviews:["المقابلات","جلسات الأسئلة والتقييم"],sourcing:["معايير الاستقطاب","نموذج المناطق البنغلاديشي v2.0"],org:["الهيكل التنظيمي","القطاعات والإدارات والصلاحيات والتصعيد"],vendors:["الموردون","الصيانة والقطع والدراجات والسكن ومصروفاتها"],supply:["سلاسل الإمداد","المخزون والطلبات والاستلام والعُهد والجرد"],supply_requests:["طلبات الإمداد والتصعيد","نواقص الجولات — رقم مرجعي · عدّاد مهلة 24 ساعة · تصعيد واتساب/إيميل · اكتمال"],custody:["العُهد والإهلاك","عُهد البايكرز — تواريخ بداية/نهاية · احتساب الإهلاك · تخطيط شراء الدراجات وإعادة طلب المستهلكات"],fleet:["الأسطول والحوادث","سجل المركبات والتتبّع والكاميرات والمفاتيح وحوادث السرقة والأعطال"],offboarding:["إنهاء الخدمة","مخالصة المغادرة — عُهد ودراجة وسكن وتسوية ووثائق وحساب"],incidents:["الحوادث والجزاءات","عرض موحّد — مخالفات سويتر ومخالفات السكن وحوادث الأسطول"],audit:["سجل التدقيق","من غيّر ماذا ومتى — مقصور على المالك"],housing:["السكن والإقامة","الوحدات والساكنون وجدول الدفعات ومخالفات السكن"],renewals:["الوثائق والتجديدات","متابعة صلاحية التأمين والاستمارات والرخص والإقامات"],onboarding:["التعاقد والإعداد","تجهيز البايكر الجديد — 30 بنداً"],operations:["العمليات اليومية","تقارير سويتر والغسلات"],performance:["الأداء","بطاقات أداء الفريق الشهرية"],payroll:["الرواتب","كشوف ومكافآت الفريق"],pricing:["المقابل والتسعير","نموذج غسلات سويتر — الشرائح وحاسبة المقابل الشهري"],settlement:["تسوية سويتر","احتساب المستحق الشهري لكل بايكر ومطابقته بالفاتورة"],reconciliation:["مطابقة/مطالبة سويتر","مطابقة تقارير سويتر بالعقد ومتابعة المطالبة عن الطلبات غير المُحتسَبة"],damage_claims:["دعاوى ضرر العملاء","تسجيل حالات ضرر مركبات العملاء وتحميلها على البايكر بعد التحقيق — خصم ≤50% من الراتب"],complaints:["الشكاوى والمخالفات","كتالوج سويتر ونوافذ الاعتراض"],field_rounds:["الجولات الميدانية","لائحة الالتزام — 15 بنداً"],myteam:["فريقي","البايكرز تحت إشرافك"],users:["المستخدمون","الحسابات والصلاحيات"],tma:["المواهب TMA","نموذج المواهب — 22 محركاً · مقصور على المالك"],gosi:["تأمينات GOSI","الرصيد المستحق وخطة التقسيط والسجل الشهري وتنبيه الاستحقاق"]};

export default function Shell({onLogout,me}){
  const[view,setView]=useState("dashboard");
  const[open,setOpen]=useState(false);
  const[ops,setOps]=useState([]);const[op,setOp]=useState("all");
  const[menu,setMenu]=useState(false);
  const[tmaTarget,setTmaTarget]=useState(null);
  // الثيم العام (فاتح/داكن/تلقائي) من مزوّد الثيم — الشريط ولوحة القيادة يتبعانه
  const{resolved:sbTheme}=useTheme();
  const[search,setSearch]=useState(false);
  useEffect(()=>{const prev=document.title;document.title="دلو ورغوة · المنصة التشغيلية";return()=>{document.title=prev;};},[]);
  // شارات حيّة على القائمة: طلبات الإمداد المفتوحة | live badges (open supply requests)
  const[badges,setBadges]=useState({});
  useEffect(()=>{(async()=>{try{const{count}=await supabase.from("supply_requests").select("id",{count:"exact",head:true}).neq("status","completed");if(count)setBadges(b=>({...b,supply_requests:count}));}catch(_){}})();},[]);
  useEffect(()=>{supabase.from("operators").select("id,name,active").order("created_at").then(({data})=>setOps(data||[]));},[]);
  const nm=(me&&me.display_name)||"إبراهيم المالكي";
  const owner=!!(me&&me.is_owner);
  const isSup=SUPERVISOR_POS.includes(me&&me.position);
  const nav=NAV.filter(n=>{if(n.k==="users"||n.k==="tma"||n.k==="audit"||n.k==="gosi")return owner;if(n.k==="myteam")return isSup;return true;});
  const go=k=>{setView(k);setOpen(false);};
  const [t,sub]=TITLES[view]||[NAV.find(n=>n.k===view)?.ar||"",""];

  if(me&&me.position==="biker")return(<Suspense fallback={<Sk/>}><BikerPortal/></Suspense>);

  return(<div className="sh">
    <style>{CSS}</style>
    <Orbs/>
    <GlassSidebar items={nav} active={view} onGo={go} badges={badges} open={open} onOpenChange={setOpen} theme={sbTheme}
      user={{name:nm,role:owner?"المالك · صلاحية كاملة":isSup?"مشرف ميداني":"مستخدم"}} onLogout={onLogout} onSettings={owner?()=>go("users"):undefined} onSearch={()=>setSearch(true)}/>
    <GlobalSearch open={search} onClose={()=>setSearch(false)} items={nav} onGo={go}/>

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
        <button className="sh-ib sh-hm" onClick={()=>setSearch(true)} title="بحث شامل (⌘K)" aria-label="بحث شامل"><Search size={17}/></button>
        <ThemeToggle className="sh-tt"/>
        <Notifications me={me} onNav={go}/>
        <div style={{position:"relative"}}>
          <button className="sh-ib" onClick={()=>setMenu(!menu)}><div className="sh-av2">{nm.trim().charAt(0)}</div></button>
          {menu&&<div className="sh-menu">{owner&&<div className="sh-mi" onClick={()=>{setMenu(false);go("users");}}><Icon n="users" s={16}/> المستخدمون</div>}<div className="sh-mi" onClick={onLogout}><Icon n="logout" s={16}/> تسجيل الخروج</div></div>}
        </div>
      </header>
      <div className={"sh-content"+(GLASS_READY.has(view)?" g-ready":"")}>
        {view==="dashboard"&&<DashboardHome onNav={go} theme={sbTheme}/>}
        {view==="job_ad"&&<Suspense fallback={<Sk/>}><JobAdManager/></Suspense>}
        {view==="recruitment"&&<Suspense fallback={<Sk/>}><AdminDashboard embedded section="applicants" onLogout={onLogout}/></Suspense>}
        {view==="employees"&&<Suspense fallback={<Sk/>}><AdminDashboard embedded section="employees" onLogout={onLogout}/></Suspense>}
        {view==="reports"&&<Suspense fallback={<Sk/>}><Reports opId={op}/></Suspense>}
        {view==="users"&&owner&&<Suspense fallback={<Sk/>}><UserManagement/></Suspense>}
        {view==="payroll"&&<Suspense fallback={<Sk/>}><Payroll opId={op}/></Suspense>}
        {view==="pricing"&&<Suspense fallback={<Sk/>}><SweaterPricing/></Suspense>}
        {view==="settlement"&&<Suspense fallback={<Sk/>}><Settlement opId={op} me={me} owner={owner}/></Suspense>}
        {view==="reconciliation"&&<Suspense fallback={<Sk/>}><SweaterReconciliation owner={owner}/></Suspense>}
        {view==="damage_claims"&&<Suspense fallback={<Sk/>}><DamageClaims owner={owner} opId={op}/></Suspense>}
        {view==="operations"&&<Suspense fallback={<Sk/>}><Operations opId={op}/></Suspense>}
        {view==="complaints"&&<Suspense fallback={<Sk/>}><Complaints opId={op} me={me} owner={owner}/></Suspense>}
        {view==="performance"&&<Suspense fallback={<Sk/>}><Performance opId={op}/></Suspense>}
        {view==="field_rounds"&&<Suspense fallback={<Sk/>}><FieldRounds opId={op} onGo={go}/></Suspense>}
        {view==="supply_requests"&&<Suspense fallback={<Sk/>}><SupplyRequests owner={owner} opId={op}/></Suspense>}
        {view==="custody"&&<Suspense fallback={<Sk/>}><Custody owner={owner} opId={op}/></Suspense>}
        {view==="myteam"&&<Suspense fallback={<Sk/>}><MyTeam/></Suspense>}
        {view==="onboarding"&&<Suspense fallback={<Sk/>}><Onboarding opId={op}/></Suspense>}
        {view==="interviews"&&<Suspense fallback={<Sk/>}><Interviews owner={owner} onOpenTMA={owner?(t=>{setTmaTarget(t);go("tma");}):undefined}/></Suspense>}
        {view==="sourcing"&&<Suspense fallback={<Sk/>}><Sourcing/></Suspense>}
        {view==="org"&&<Suspense fallback={<Sk/>}><OrgStructure owner={owner} opId={op}/></Suspense>}
        {view==="tma"&&owner&&<Suspense fallback={<Sk/>}><TMA opId={op} target={tmaTarget} onTargetDone={()=>setTmaTarget(null)}/></Suspense>}
        {view==="vendors"&&<Suspense fallback={<Sk/>}><Vendors opId={op}/></Suspense>}
        {view==="supply"&&<Suspense fallback={<Sk/>}><Supply owner={owner} opId={op}/></Suspense>}
        {view==="fleet"&&<Suspense fallback={<Sk/>}><Fleet opId={op} owner={owner}/></Suspense>}
        {view==="housing"&&<Suspense fallback={<Sk/>}><Housing opId={op}/></Suspense>}
        {view==="offboarding"&&<Suspense fallback={<Sk/>}><Offboarding opId={op}/></Suspense>}
        {view==="incidents"&&<Suspense fallback={<Sk/>}><IncidentsPenalties opId={op}/></Suspense>}
        {view==="audit"&&owner&&<Suspense fallback={<Sk/>}><AuditLog/></Suspense>}
        {view==="renewals"&&<Suspense fallback={<Sk/>}><Renewals opId={op}/></Suspense>}
        {view==="gosi"&&owner&&<Suspense fallback={<Sk/>}><GosiTracker/></Suspense>}
      </div>
    </div>
  </div>);
}
function Sk(){return<div className="g-skel box" style={{height:200}}/>;}
function Soon({ic,name}){return(<div className="sh-soonbox"><div className="sh-soonic"><Icon n={ic} s={30}/></div><h2>{name}</h2><p>هذه الوحدة قيد البناء ضمن خارطة الطريق — ستظهر هنا بنفس المستوى الاحترافي فور اكتمالها.</p></div>);}

const CSS=`
.sh{--panel:var(--glass-3);--line2:var(--line-2);--brand:var(--p);--side:#0e1622;--side2:#141f2e;--sidink:#c7d0dc;--sidmut:#7c8aa0;display:flex;min-height:100dvh;background:var(--bg);font-family:var(--font);color:var(--ink);font-size:14px;position:relative}
.sh *{box-sizing:border-box}
.sh-scrim{display:none}
.sh-brand{display:flex;align-items:center;gap:11px;padding:20px 20px 14px}
.sh-logo{width:42px;height:42px;border-radius:11px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(232,113,43,.35);flex:none}
.sh-logo img{width:30px;height:30px;object-fit:contain}
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
.sh-main{display:flex;flex-direction:column;min-width:0;flex:1;position:relative;z-index:1}
.sh-top{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border-bottom:1px solid var(--line);padding:12px 20px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:30}
.sh-burger{display:none;background:none;border:none;font-size:20px;cursor:pointer;color:var(--ink)}
.sh-ttl h1{font-size:16px;font-weight:800;margin:0}.sh-sub{font-size:12px;color:var(--mut)}
.sh-ops{margin-inline-start:auto;display:flex;align-items:center;gap:7px;background:var(--glass-2);border:1px solid var(--line2);border-radius:11px;padding:6px 10px}
.sh-ops-ic{display:flex;align-items:center;color:var(--mut)}
.sh-ops select{border:none;background:none;outline:none;font-family:inherit;font-size:13px;font-weight:700;color:var(--ink);cursor:pointer}
.sh-ib{width:38px;height:38px;border-radius:11px;border:1px solid var(--line2);background:var(--glass-2);color:var(--ink);display:flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer;position:relative}
.sh-ib:hover,.sh-tt:hover{border-color:rgba(var(--p-rgb),.4)}
.sh-dot{position:absolute;top:8px;inset-inline-end:9px;width:7px;height:7px;border-radius:50%;background:var(--bad);border:1.5px solid var(--glass-3)}
.sh-av2{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#E8712B,#f5a35f);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:12px}
.sh-menu{position:absolute;top:46px;inset-inline-start:0;background:var(--glass-3);border:1px solid var(--line2);border-radius:12px;box-shadow:var(--shadow-lg);overflow:hidden;min-width:170px;z-index:40}
.sh-mi{padding:11px 14px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:9px;color:var(--ink)}.sh-mi:hover{background:var(--hover)}
.sh-content{padding:20px;max-width:1200px;width:100%;margin:0 auto}
.sh-embed{margin:-20px;}
/* جزيرة فاتحة للصفحات غير المنقولة بعد — تُحذف هذه القاعدة عند اكتمال النقل */
.sh-content:not(.g-ready){--bg:#f4f5f7;--bg-2:#eceef1;--panel:#fff;--ink:#0f172a;--ink-2:#1e293b;--mut:#64748b;--mut-2:#94a3b8;--line:#eceef1;--line-2:#e6e9ee;--line2:#e6e9ee;--track:#eef0f3;--soft:#f4f5f7;--hover:#fafbfc;--glass:#fff;--glass-2:#fff;--glass-3:#fff;--p-100:#FFE6D6;--p-50:#FFF4EC;--ok-bg:#e7f7ef;--ok-ink:#087443;--warn-bg:#fff3e2;--warn-ink:#b54708;--bad-bg:#feecea;--bad-ink:#b42318;--info-bg:#eef4ff;--info-ink:#1d5bbf;--shadow:0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.05);color:var(--ink);color-scheme:light}
:root[data-theme=dark] .sh-content:not(.g-ready){background:var(--bg);border-radius:var(--r-lg);box-shadow:0 0 0 1px rgba(255,255,255,.08);margin:12px auto;padding:20px;max-width:calc(1200px - 24px)}
.sh-soonbox{background:var(--glass);backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:var(--r);padding:48px 24px;text-align:center;box-shadow:var(--shadow)}
.sh-soonic{width:64px;height:64px;border-radius:18px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;background:var(--p-100);color:var(--brand)}
.sh-soonbox h2{font-size:18px;margin:0 0 8px}.sh-soonbox p{color:var(--mut);font-size:13px;max-width:420px;margin:0 auto;line-height:1.7}
/* ── design system used by DashboardHome ── */
.dw-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.dw-kpi{background:var(--glass);backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:var(--r);padding:16px 18px;box-shadow:var(--shadow)}
.dw-clk{cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s}
.dw-clk:hover{border-color:rgba(var(--p-rgb),.4);box-shadow:var(--shadow-lg);transform:translateY(-1px)}
.dw-tbl tbody tr{transition:background .12s}.dw-tbl tbody tr:hover{background:var(--hover)}
.dw-ki{display:flex;align-items:center;justify-content:center}
.dw-kh{display:flex;align-items:center;justify-content:space-between}
.dw-kl{font-size:12.5px;color:var(--mut);font-weight:600}
.dw-ki{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px}
.dw-kn{font-size:27px;font-weight:800;margin-top:8px;letter-spacing:-.5px}
.dw-kd{font-size:11.5px;font-weight:700;margin-top:2px}
.dw-row{display:grid;gap:14px;margin-top:14px}
.dw-2{grid-template-columns:1.35fr 1fr}.dw-2b{grid-template-columns:1fr 1.35fr}
.dw-panel{background:var(--glass);backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow)}
.dw-ph{display:flex;align-items:center;justify-content:space-between;padding:15px 18px;border-bottom:1px solid var(--line)}
.dw-ph b{font-size:14.5px;font-weight:800}.dw-a{font-size:12px;color:var(--brand);font-weight:700;cursor:pointer}
.dw-pb{padding:16px 18px}
.dw-fun{display:flex;flex-direction:column;gap:9px}
.dw-frow{display:grid;grid-template-columns:92px 1fr 42px;align-items:center;gap:10px;font-size:12.5px}
.dw-fl{color:var(--mut);font-weight:600}
.dw-fbar{height:26px;background:var(--track);border-radius:8px;overflow:hidden}
.dw-ffill{height:100%;border-radius:8px;background:linear-gradient(90deg,var(--brand),#f5a35f);display:flex;align-items:center;padding:0 9px;color:#fff;font-size:11.5px;font-weight:800}
.dw-fv{font-weight:800;text-align:center;color:var(--mut)}
.dw-tbl{width:100%;border-collapse:collapse}
.dw-tbl th{font-size:11px;color:var(--mut);font-weight:700;text-align:right;padding:10px 14px;border-bottom:1px solid var(--line);background:var(--glass-2)}
.dw-tbl td{padding:11px 14px;border-bottom:1px solid var(--line);font-size:13px}
.dw-tbl tr:last-child td{border-bottom:none}
.dw-cand{display:flex;align-items:center;gap:11px}
.dw-cav{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:13px;flex:none}
.dw-cand small{color:var(--mut);font-size:11.5px}
.dw-score{display:inline-flex;align-items:center;justify-content:center;min-width:44px;padding:3px 8px;border-radius:8px;font-weight:800;font-size:12.5px}
.dw-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11.5px;font-weight:700}
.p-acc{background:var(--ok-bg);color:var(--ok-ink)}.p-pend{background:var(--warn-bg);color:var(--warn-ink)}.p-rej{background:var(--bad-bg);color:var(--bad-ink)}
.dw-dot{width:6px;height:6px;border-radius:50%;background:currentColor}
.dw-team{display:flex;flex-direction:column;gap:14px}
.dw-tm{display:grid;grid-template-columns:130px 1fr 46px;align-items:center;gap:10px}
.dw-tn{font-size:12.5px;font-weight:700}.dw-tn small{color:var(--mut);font-weight:500;display:block;font-size:10.5px}
.dw-tbar{height:9px;border-radius:6px;background:var(--track);overflow:hidden}
.dw-tv{font-weight:800;font-size:13px;text-align:left}
.dw-goal{font-size:11px;color:var(--mut);margin-top:3px}
.dw-track{height:8px;background:var(--track);border-radius:6px;margin-top:12px;overflow:hidden}
.dw-track div{height:100%;background:linear-gradient(90deg,#12b76a,#32d583);border-radius:6px}
.dw-skel{background:var(--track);animation:shim 1.4s infinite;border-radius:16px}
@keyframes shim{0%{background-position:100% 0}100%{background-position:-100% 0}}
@media(max-width:1023px){
  .sh-burger{display:block}
}
@media(max-width:640px){
  .sh-ops{display:none}
}
@media(max-width:900px){
  .dw-kpis{grid-template-columns:1fr 1fr}
  .dw-2,.dw-2b{grid-template-columns:1fr}
  .sh-content{padding:14px}.sh-embed{margin:-14px}
  .sh-sub{display:none}.sh-ttl h1{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:38vw}
  .sh-top{padding:10px 12px;gap:8px}
  .dw-hm{display:none}
}
/* ═══ الطباعة: إخفاء الهيكل وإظهار المحتوى فقط بعرض كامل ═══ */
@media print{
  .sh{display:block !important;background:#fff !important}
  .g-orbs{display:none !important}
  .sh-side,.sh-scrim,.sh-top,.sh-burger{display:none !important}
  .sh-main{display:block !important}
  .sh-content{padding:0 !important;max-width:none !important;margin:0 !important}
  .sh-embed{margin:0 !important}
}
@page{margin:12mm}
`;
