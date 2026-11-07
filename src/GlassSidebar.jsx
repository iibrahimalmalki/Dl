// الشريط الجانبي الزجاجي القابل للطي (RTL) — منصة دلو ورغوة
// React + Framer Motion + lucide-react، CSS عادي (بدون Tailwind) ليتوافق مع بقية المنصة.
// ≥1024px: مثبّت، يُطوى من 320 إلى 80 بكسل (تُحفظ الحالة) · <1024px: درج ينزلق من اليمين مع خلفية مضببة.
// props: items[{k,ar,ic,g?,lock?,soon?}] (نفس NAV)، active|activeId، onGo|onNavigate(k)، user{name,role,status?,avatarUrl?}، badges{k:n}، defaultExpanded، onToggle(isExpanded)، open، onOpenChange، theme ("light"|"dark")، onLogout، onSettings
// extra: عقدة اختيارية تظهر أعلى القائمة في وضع الدرج على الجوال فقط (≤640px) — مثل اختيار المشغّل المخفي من الرأس
import{useCallback,useEffect,useId,useMemo,useRef,useState}from"react";
import{AnimatePresence,motion,useReducedMotion}from"framer-motion";
import{ChevronRight,MessageCircle,ListChecks,SlidersHorizontal,GraduationCap,PackageCheck,CircleUser,Fuel,LayoutDashboard,Megaphone,UserPlus,MessagesSquare,Compass,ClipboardCheck,Users,UserMinus,Sparkles,Activity,Gauge,MapPinned,MessageSquareWarning,ShieldAlert,UsersRound,Wallet,CalendarCheck,BadgeDollarSign,Scale,FileCheck2,CarFront,Receipt,ShieldCheck,Bike,House,FileBadge,Package,PackagePlus,KeyRound,Network,ChartColumn,UserCog,ScrollText,Settings,LogOut,Circle,Lock,Search,X}from"lucide-react";

// أيقونة كل صفحة حسب مفتاحها في NAV | Lucide icon per NAV key
const ICON_BY_KEY={support:MessageCircle,relaunch:ListChecks,biker_tabs:SlidersHorizontal,dashboard:LayoutDashboard,job_ad:Megaphone,recruitment:UserPlus,interviews:MessagesSquare,sourcing:Compass,onboarding:ClipboardCheck,academy:GraduationCap,daily:PackageCheck,
  profile:CircleUser,handover:Bike,fuel:Fuel,perf:Gauge,docs:FileBadge,assets:KeyRound,employees:Users,offboarding:UserMinus,tma:Sparkles,
  operations:Activity,performance:Gauge,field_rounds:MapPinned,complaints:MessageSquareWarning,incidents:ShieldAlert,myteam:UsersRound,
  close:CalendarCheck,payroll:Wallet,pricing:BadgeDollarSign,settlement:Scale,reconciliation:FileCheck2,damage_claims:CarFront,vendors:Receipt,gosi:ShieldCheck,
  fleet:Bike,housing:House,renewals:FileBadge,supply:Package,supply_requests:PackagePlus,custody:KeyRound,
  org:Network,reports:ChartColumn,users:UserCog,audit:ScrollText,settings:Settings,logout:LogOut};
export const EXPANDED=320,COLLAPSED=80;
const SPRING={type:"spring",stiffness:300,damping:30};
const STORE="dw.sidebar.collapsed";

// ≤640px: نفس عتبة BottomNav — تُستخدم فيه الأسماء القصيرة (sh) لتطابق الشريط السفلي
function useNarrow(){
  const q="(max-width:640px)";const get=()=>typeof window!=="undefined"&&!!window.matchMedia&&window.matchMedia(q).matches;
  const[v,setV]=useState(get);
  useEffect(()=>{if(!window.matchMedia)return;const m=window.matchMedia(q);const h=()=>setV(m.matches);m.addEventListener?m.addEventListener("change",h):m.addListener(h);return()=>{m.removeEventListener?m.removeEventListener("change",h):m.removeListener(h);};},[]);
  return v;
}
// شاشات اللمس (hover:none): لا تأثير hover — يمنع بقاء العنصر مظلّلاً بعد اللمس
function useCanHover(){
  const q="(hover:hover)";const get=()=>typeof window==="undefined"||!window.matchMedia||window.matchMedia(q).matches;
  const[v,setV]=useState(get);
  useEffect(()=>{if(!window.matchMedia)return;const m=window.matchMedia(q);const h=()=>setV(m.matches);m.addEventListener?m.addEventListener("change",h):m.addListener(h);return()=>{m.removeEventListener?m.removeEventListener("change",h):m.removeListener(h);};},[]);
  return v;
}
function useBreakpoint(){
  const get=()=>typeof window==="undefined"?"desktop":window.innerWidth>=1024?"desktop":window.innerWidth>=768?"tablet":"mobile";
  const[bp,setBp]=useState(get);
  useEffect(()=>{const on=()=>setBp(get());window.addEventListener("resize",on);return()=>window.removeEventListener("resize",on);},[]);
  return bp;
}
const readStored=()=>{try{const v=localStorage.getItem(STORE);return v==null?null:v==="1";}catch(_){return null;}};
const writeStored=v=>{try{localStorage.setItem(STORE,v?"1":"0");}catch(_){}};
const initials=n=>String(n||"").trim().split(/\s+/).slice(0,2).map(s=>s.replace(/^ال(?=\S{2})/,"")[0]||"").join("")||"—"; // «المالكي» ⇒ م

export default function GlassSidebar({items,active:activeProp,activeId,onGo:onGoProp,onNavigate,defaultExpanded=true,onToggle,user,badges={},open:openProp,onOpenChange,theme="light",onLogout,onSettings,onSearch,extra,noSettings,platform={name:"دلو ورغوة",subtitle:"المنصّة التشغيلية · شريك 47"}}){
  const bp=useBreakpoint();const narrow=useNarrow();const canHover=useCanHover();const reduce=useReducedMotion();
  const active=activeId??activeProp;const onGo=onNavigate||onGoProp||(()=>{});
  const[collapsed,setCollapsed]=useState(()=>readStored()??!defaultExpanded);
  const toggle=()=>setCollapsed(c=>{const n=!c;onToggle&&onToggle(!n);return n;});
  const[openState,setOpenState]=useState(false);
  const open=openProp??openState;
  const setOpen=useCallback(v=>{onOpenChange&&onOpenChange(v);if(openProp==null)setOpenState(v);},[onOpenChange,openProp]);
  const isDocked=bp==="desktop";
  const showLabels=!isDocked||!collapsed;
  const width=isDocked?(collapsed?COLLAPSED:EXPANDED):EXPANDED;
  const[query,setQuery]=useState("");
  const searchRef=useRef(null);const navRef=useRef(null);const uid=useId();
  useEffect(()=>{writeStored(collapsed);},[collapsed]);
  const go=k=>{onGo(k);if(!isDocked)setOpen(false);};

  useEffect(()=>{
    const onKey=e=>{
      if(e.key==="Escape"&&open){setOpen(false);return;}
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();if(onSearch){onSearch();return;}if(isDocked&&collapsed)setCollapsed(false);setTimeout(()=>searchRef.current&&searchRef.current.focus(),50);}
    };
    window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);
  },[open,isDocked,collapsed,setOpen,onSearch]);
  const onNavKey=e=>{
    const list=Array.from((navRef.current&&navRef.current.querySelectorAll("button[data-nav]:not([disabled])"))||[]);
    const i=list.indexOf(document.activeElement);if(!list.length)return;
    if(e.key==="ArrowDown"){e.preventDefault();list[(i+1)%list.length].focus();}
    else if(e.key==="ArrowUp"){e.preventDefault();list[(i-1+list.length)%list.length].focus();}
    else if(e.key==="Home"){e.preventDefault();list[0].focus();}
    else if(e.key==="End"){e.preventDefault();list[list.length-1].focus();}
  };
  useEffect(()=>{if(!isDocked&&open){const p=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=p;};}},[open,isDocked]);

  // تجميع حسب العناوين (g) + فلترة البحث | group by heading rows, filter by query
  const groups=useMemo(()=>{
    const q=query.trim().toLowerCase();const out=[];let cur={g:"",items:[]};
    items.forEach(n=>{
      if(n.g){if(cur.items.length)out.push(cur);cur={g:n.g,items:[]};return;}
      if(!q||n.ar.toLowerCase().includes(q)||n.k.includes(q))cur.items.push(n);
    });
    if(cur.items.length)out.push(cur);
    return out;
  },[items,query]);

  const Item=({n,bottom})=>{
    const Ic=ICON_BY_KEY[n.k]||Circle;const isActive=n.k===active;const badge=badges[n.k];const tipId=`${uid}-${n.k}`;
    // soon = معطّل (قريباً). lock = «مقصور على المالك» علامةٌ فقط والزر يعمل — الإخفاء عن غيره في فلترة Shell
    const locked=!!n.soon,ownerOnly=!!n.lock;
    return(<div className="gs-wrap">
      <motion.button type="button" data-nav aria-current={isActive?"page":undefined} aria-disabled={locked||undefined} disabled={locked}
        aria-label={!showLabels?n.ar:undefined} aria-describedby={!showLabels?tipId:undefined}
        onClick={()=>{if(locked)return;if(bottom&&n.k==="logout"){onLogout&&onLogout();return;}if(bottom&&n.k==="settings"){onSettings&&onSettings();return;}go(n.k);}}
        whileHover={locked||reduce||!canHover?undefined:{x:-4}} whileTap={locked?undefined:{scale:0.97}} transition={{type:"spring",stiffness:500,damping:30}}
        className={"gs-item"+(isActive?" on":"")+(showLabels?"":" icon-only")+(locked?" locked":"")+(bottom&&n.k==="logout"?" danger":"")}>
        {isActive&&<motion.span layoutId={`${uid}-active`} transition={reduce?{duration:0}:SPRING} aria-hidden className="gs-act"><span className="gs-ind"/></motion.span>}
        <span className="gs-ic"><Ic size={20} strokeWidth={1.9}/>{badge?<span className="gs-dot" role="status" aria-label={`${badge} إشعار جديد`}>{badge>99?"99+":badge}</span>:null}</span>
        <AnimatePresence initial={false}>{showLabels&&<motion.span key="l" initial={{opacity:0,x:8}} animate={{opacity:1,x:0}} exit={{opacity:0,x:8}} transition={{duration:reduce?0:0.18}} className="gs-lbl">{narrow&&n.sh?n.sh:n.ar}{n.bn?<small className="gs-bn" lang="bn">{n.bn}</small>:null}</motion.span>}</AnimatePresence>
        {showLabels&&(locked||ownerOnly)&&<span className="gs-lock" title={ownerOnly?"للمالك فقط":"قريباً"}><Lock size={13} aria-hidden/></span>}
      </motion.button>
      {!showLabels&&<span role="tooltip" id={tipId} className="gs-tip">{n.ar}{locked?" · قريباً":ownerOnly?" · للمالك فقط":""}</span>}
    </div>);
  };

  const panel=(
    <motion.aside dir="rtl" aria-label="الشريط الجانبي" data-theme={theme} initial={false} animate={{width}} transition={reduce?{duration:0}:SPRING} className="gs-panel">
      <div className="gs-glass">
        <div className={"gs-head"+(showLabels?"":" c")}>
          <span className="gs-logo"><img src="/brand-mark.png" alt=""/></span>
          {showLabels&&<div className="gs-brand"><b>{platform.name}</b><span className="gs-sub">{String(platform.subtitle||"").split(" · ").map((t,i)=><i key={i}>{i?<em> · </em>:null}{t}</i>)}</span></div>}
          {isDocked
            ?<button type="button" onClick={toggle} aria-expanded={!collapsed} aria-label={collapsed?"توسيع القائمة":"طيّ القائمة"} className={"gs-tgl"+(showLabels?"":" float")}><motion.span animate={{rotate:collapsed?180:0}} transition={reduce?{duration:0}:SPRING} style={{display:"grid"}}><ChevronRight size={18} aria-hidden/></motion.span></button>
            :<button type="button" onClick={()=>setOpen(false)} aria-label="إغلاق القائمة" className="gs-tgl"><X size={18}/></button>}
        </div>
        {extra&&!isDocked&&<div className="gs-extra">{extra}</div>}
        {onSearch&&!isDocked&&<button type="button" className="gs-gsrch" onClick={()=>{setOpen(false);onSearch();}} aria-label="بحث شامل"><Search size={16} aria-hidden/><span>بحث شامل…</span></button>}
        <div className={"gs-srch"+(showLabels?"":" c")+(onSearch?" has-g":"")}>
          {showLabels
            ?<label className="gs-sbox"><Search size={16} aria-hidden/><input ref={searchRef} id={`${uid}-search`} value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث في القائمة…" aria-label="بحث في القائمة"/><kbd dir="ltr" onClick={onSearch} style={onSearch?{cursor:"pointer"}:undefined}>⌘K</kbd></label>
            :<button type="button" aria-label="بحث" className="gs-sbtn" onClick={()=>{if(onSearch){onSearch();return;}setCollapsed(false);setTimeout(()=>searchRef.current&&searchRef.current.focus(),60);}}><Search size={18}/></button>}
        </div>
        <nav ref={navRef} aria-label="القائمة الرئيسية" onKeyDown={onNavKey} className="gs-nav">
          {groups.length===0&&<div className="gs-empty">لا نتائج لـ «{query}»</div>}
          {groups.map((g,gi)=>(<div key={g.g||gi} className="gs-grp">
            {g.g&&!(g.items.length===1&&((narrow&&g.items[0].sh)||g.items[0].ar)===g.g)&&(showLabels?<div className="gs-cat">{g.g}</div>:<div aria-hidden className="gs-sep"/>)}
            {g.items.map(n=><Item key={n.k} n={n}/>)}
          </div>))}
        </nav>
        <div className="gs-foot">
          {!noSettings&&<Item n={{k:"settings",ar:"الإعدادات"}} bottom/>}
          <Item n={{k:"logout",ar:"تسجيل الخروج"}} bottom/>
          <div className={"gs-prof"+(showLabels?"":" c")} title={showLabels?undefined:(user&&user.name)||undefined}>
            <span className="gs-ring"><span className="gs-av">{user&&user.avatarUrl?<img src={user.avatarUrl} alt=""/>:initials(user&&user.name)}</span><span className="gs-on" aria-hidden/></span>
            <AnimatePresence initial={false}>{showLabels&&<motion.div key="who" initial={{opacity:0,x:8}} animate={{opacity:1,x:0}} exit={{opacity:0,x:8}} transition={{duration:reduce?0:0.18}} className="gs-who"><b>{(user&&user.name)||"—"}</b><span>{(user&&(user.status||user.role))||""}</span></motion.div>}</AnimatePresence>
          </div>
        </div>
      </div>
    </motion.aside>);

  if(isDocked)return<>{<style>{CSS}</style>}{panel}</>;
  return(<><style>{CSS}</style><AnimatePresence>{open&&<>
    <motion.div key="bd" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.2}} onClick={()=>setOpen(false)} aria-hidden className={"gs-bd"+(bp==="mobile"?" blur":"")}/>
    <motion.div key="dr" role="dialog" aria-modal="true" aria-label="القائمة" initial={{x:EXPANDED}} animate={{x:0}} exit={{x:EXPANDED}} transition={reduce?{duration:0}:SPRING}
      drag={bp==="mobile"?"x":false} dragConstraints={{left:0,right:EXPANDED}} dragElastic={0.05} onDragEnd={(_,info)=>{if(info.offset.x>80)setOpen(false);}} className="gs-drawer">{panel}</motion.div>
  </>}</AnimatePresence></>);
}

const CSS=`
.gs-panel{--p:#E8712B;--p-rgb:232,113,43;--s:#FB7185;--a:#F59E0B;position:relative;z-index:20;flex:none;height:100dvh;position:sticky;top:0;overflow:hidden;font-family:'Segoe UI',Tahoma,system-ui,sans-serif;
  --gs-bg:#F5F6FA;--gs-glass:rgba(255,255,255,.62);--gs-line:rgba(15,23,42,.10);--gs-txt:#0F172A;--gs-mut:#64748B;--gs-hover:rgba(15,23,42,.05);--gs-tipbg:rgba(255,255,255,.97);--gs-shadow:-12px 0 40px -24px rgba(15,23,42,.35);color:var(--gs-txt);background:rgba(255,255,255,.35);box-shadow:var(--gs-shadow)}
.gs-panel[data-theme=dark]{--gs-bg:#0A0E27;--gs-glass:rgba(255,255,255,.08);--gs-line:rgba(255,255,255,.14);--gs-txt:#F8FAFC;--gs-mut:#94A3B8;--gs-hover:rgba(255,255,255,.06);--gs-tipbg:rgba(12,17,45,.94);--gs-shadow:-12px 0 40px -20px rgba(0,0,0,.7);background:rgba(10,14,39,.92)}
.gs-panel::after{content:"";position:absolute;top:0;bottom:0;left:0;width:1px;background:linear-gradient(180deg,rgba(245,158,11,.9),rgba(232,113,43,.35) 45%,rgba(251,113,133,.85));box-shadow:0 0 14px rgba(232,113,43,.55);pointer-events:none}
.gs-glass{display:flex;flex-direction:column;height:100%;background:linear-gradient(rgba(59,130,246,.2),rgba(59,130,246,.2)),var(--gs-glass);border-inline-start:1px solid rgba(255,255,255,.2);backdrop-filter:blur(20px) saturate(140%);-webkit-backdrop-filter:blur(20px) saturate(140%)}
.gs-panel *{box-sizing:border-box}
.gs-panel button{font-family:inherit;-webkit-tap-highlight-color:transparent}
.gs-gsrch{display:none}
.gs-sub i,.gs-sub em{font-style:normal}
@media(max-width:640px){
  /* الدرج فوق الشريط السفلي (z 60): بلا بطاقة مستخدم (موجودة في الشريط العلوي) ويحترم safe-area */
  .gs-drawer .gs-prof{display:none}
  /* السطر الفرعي يظهر كاملاً: التفاف على سطرين بدل القصّ */
  .gs-drawer .gs-brand b,.gs-drawer .gs-brand span{white-space:normal;overflow:visible;text-overflow:clip}
  .gs-drawer .gs-sub{line-height:1.45;margin-top:2px}
  .gs-drawer .gs-sub i{display:block}.gs-drawer .gs-sub em{display:none}
  .gs-drawer .gs-head{align-items:flex-start}
  .gs-drawer .gs-head{padding-bottom:10px}
  .gs-drawer .gs-foot{padding-bottom:calc(8px + env(safe-area-inset-bottom))}
  .gs-gsrch{display:flex;align-items:center;gap:8px;margin:0 12px 10px;padding:10px 12px;border:1px solid var(--gs-line);border-radius:12px;background:rgba(255,255,255,.05);color:var(--gs-mut);font:inherit;font-size:13px;text-align:start;cursor:pointer;min-height:44px}
  .gs-gsrch:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(var(--p-rgb),.35)}
  .gs-srch.has-g{display:none}
}
.gs-extra{padding:0 12px 10px}@media(min-width:641px){.gs-extra{display:none}}
.gs-head{display:flex;align-items:center;gap:10px;padding:16px 12px 12px;position:relative}
.gs-head.c{justify-content:center}
.gs-logo{width:40px;height:40px;border-radius:12px;background:#fff;display:grid;place-items:center;flex:none;box-shadow:0 6px 16px rgba(var(--p-rgb),.3)}
.gs-logo img{width:28px;height:28px;object-fit:contain}
.gs-brand{min-width:0;flex:1}.gs-brand b{display:block;font-size:15px;font-weight:800;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gs-brand span{display:block;font-size:11px;color:var(--gs-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gs-tgl{width:32px;height:32px;border-radius:9px;border:none;background:none;color:var(--gs-mut);display:grid;place-items:center;cursor:pointer;flex:none;transition:all .3s}
@media(hover:hover){.gs-tgl:hover{color:var(--gs-txt);background:var(--gs-hover)}}
.gs-tgl.float{position:absolute;top:64px;left:50%;transform:translateX(-50%)}
/* الملف الشخصي مثبّت أسفل القائمة، يفصله خط علوي */
.gs-prof{margin:8px -8px -8px;display:flex;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid rgba(255,255,255,.2);transition:all .3s}
@media(hover:hover){.gs-prof:hover{background:var(--gs-hover)}}
.gs-prof.c{justify-content:center;padding:12px 0}
.gs-ring{position:relative;width:40px;height:40px;border-radius:50%;padding:2px;background:conic-gradient(from 180deg,var(--a),var(--p),var(--s),var(--a));box-shadow:0 0 18px rgba(var(--p-rgb),.45);flex:none;display:grid;place-items:center}
.gs-av{width:100%;height:100%;border-radius:50%;background:var(--gs-bg);display:grid;place-items:center;font-size:13px;font-weight:800;overflow:hidden;color:var(--gs-txt)}
.gs-av img{width:100%;height:100%;object-fit:cover}
.gs-on{position:absolute;bottom:0;left:0;width:11px;height:11px;border-radius:50%;background:#22C55E;box-shadow:0 0 0 2px var(--gs-bg)}
.gs-who{min-width:0;flex:1}.gs-who b{display:block;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gs-who span{display:block;font-size:11px;color:var(--gs-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gs-srch{margin:0 12px 8px}.gs-srch.c{display:flex;justify-content:center;margin-top:34px}
.gs-sbox{display:flex;align-items:center;gap:8px;border:1px solid var(--gs-line);border-radius:12px;padding:8px 12px;color:var(--gs-mut);background:rgba(255,255,255,.05)}
.gs-sbox:focus-within{border-color:var(--p);color:var(--gs-txt)}
.gs-sbox input{flex:1;min-width:0;border:none;background:none;outline:none;font:inherit;font-size:13px;color:var(--gs-txt)}
.gs-sbox input::placeholder{color:var(--gs-mut)}
.gs-sbox kbd{font-size:10px;border:1px solid var(--gs-line);border-radius:4px;padding:0 4px;color:var(--gs-mut);font-family:inherit}
.gs-sbtn{width:36px;height:36px;border-radius:12px;border:none;background:none;color:var(--gs-mut);display:grid;place-items:center;cursor:pointer}
@media(hover:hover){.gs-sbtn:hover{color:var(--gs-txt);background:var(--gs-hover)}}
.gs-nav{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:0 8px 8px;scrollbar-width:thin;scrollbar-color:rgba(127,127,127,.3) transparent}
.gs-nav::-webkit-scrollbar{width:6px}.gs-nav::-webkit-scrollbar-thumb{background:rgba(127,127,127,.3);border-radius:6px}
.gs-empty{padding:24px 12px;text-align:center;font-size:12px;color:var(--gs-mut)}
.gs-cat{margin:12px 0 4px;padding:0 12px;font-size:10.5px;font-weight:800;letter-spacing:.08em;color:var(--gs-mut)}
.gs-sep{margin:10px 12px;height:1px;background:var(--gs-line)}
.gs-wrap{position:relative}
.gs-item{position:relative;display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;margin:1px 0;border:none;border-radius:12px;background:none;color:var(--gs-mut);font-size:13.5px;font-weight:600;cursor:pointer;text-align:right;outline:none;transition:all .3s}
.gs-item>:not(.gs-act){position:relative;z-index:1}
.gs-item.icon-only{justify-content:center;padding:10px 0}
@media(hover:hover){.gs-item:hover:not([disabled]){color:var(--gs-txt);background:var(--gs-hover)}}
.gs-item.on{color:var(--gs-txt)}
/* مؤشّر العنصر النشط: ينتقل بين العناصر بحركة (layoutId) */
.gs-act{position:absolute;inset:0;border-radius:12px;background:rgba(var(--p-rgb),.15);z-index:0}
.gs-item.locked{opacity:.45;cursor:not-allowed}
@media(hover:hover){.gs-item.danger:hover{color:#B42318;background:rgba(240,68,56,.10)}}
@media(hover:hover){.gs-panel[data-theme=dark] .gs-item.danger:hover{color:#FCA5A5}}
.gs-item:focus-visible{box-shadow:0 0 0 2px var(--gs-bg),0 0 0 4px var(--p)}
.gs-ind{position:absolute;right:0;top:8px;bottom:8px;width:3px;border-radius:3px;background:linear-gradient(180deg,var(--a),var(--p) 45%,var(--s));box-shadow:0 0 12px rgba(var(--p-rgb),.8)}
.gs-ic{position:relative;flex:none;display:grid;place-items:center;transition:all .3s}
.gs-item.on .gs-ic{color:var(--p);filter:drop-shadow(0 0 6px rgba(var(--p-rgb),.9))}
@media(hover:hover){.gs-item:hover:not([disabled]) .gs-ic{color:var(--p);filter:drop-shadow(0 0 6px rgba(var(--p-rgb),.85));transform:scale(1.1)}}
.gs-dot{position:absolute;top:-6px;left:-6px;min-width:16px;height:16px;padding:0 4px;border-radius:99px;background:#EF4444;color:#fff;font-size:10px;font-weight:800;display:grid;place-items:center;line-height:1;font-variant-numeric:tabular-nums}
.gs-lbl{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gs-bn{display:block;font-size:10.5px;font-weight:600;opacity:.75;line-height:1.3;font-family:system-ui,-apple-system,"Noto Sans Bengali","Segoe UI",sans-serif}
.gs-lock{flex:none;opacity:.7;display:inline-flex;align-items:center}
.gs-badge{flex:none;border-radius:99px;background:rgba(var(--p-rgb),.18);color:var(--p);font-size:10.5px;font-weight:800;padding:1px 7px;font-variant-numeric:tabular-nums}
.gs-tip{position:absolute;top:50%;right:calc(100% + 10px);transform:translateY(-50%);z-index:50;white-space:nowrap;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;background:var(--gs-tipbg);color:var(--gs-txt);border:1px solid var(--gs-line);box-shadow:0 8px 24px -8px rgba(0,0,0,.4);opacity:0;pointer-events:none;transition:opacity .15s}
.gs-wrap:hover .gs-tip,.gs-wrap:focus-within .gs-tip{opacity:1}
.gs-foot{border-top:1px solid var(--gs-line);padding:8px}
.gs-bd{position:fixed;inset:0;z-index:80;background:rgba(4,8,24,.45)}
.gs-bd.blur{backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.gs-drawer{position:fixed;top:0;bottom:0;right:0;width:240px;z-index:90}
.gs-drawer .gs-panel{height:100%;position:relative}
@media(prefers-reduced-motion:reduce){.gs-tip{transition:none}}
@media print{.gs-panel,.gs-bd,.gs-drawer{display:none!important}}
`;
