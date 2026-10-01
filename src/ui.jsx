// ═══ مكوّنات الواجهة المشتركة (Glass UI) — أغلفة خفيفة فوق فئات g-* في theme.css ═══
// import{Card,Btn,Badge,Modal,Tabs,Empty,Skeleton,KPI,Title,ToastProvider,useToast,AnimatedNumber,Gauge}from"./ui";
import{createContext,useContext,useState,useCallback,useEffect,useRef}from"react";
import{X,Inbox,Sun,Moon,Monitor}from"lucide-react";
import{animate,useReducedMotion}from"framer-motion";
import{useTheme,MODE_AR}from"./theme";

const cx=(...a)=>a.filter(Boolean).join(" ");

export function Card({className,pad,solid,hover,children,...p}){return<div className={cx("g-card",pad&&"pad",solid&&"solid",hover&&"hover",className)} {...p}>{children}</div>;}
export function CardHead({title,sub,children}){return<div className="g-head"><div><b>{title}</b>{sub&&<small>{sub}</small>}</div>{children}</div>;}
export function Btn({variant,size,icon,className,children,...p}){return<button type="button" className={cx("g-btn",variant,size,icon&&"icon",className)} {...p}>{children}</button>;}
export function Badge({tone,dot,className,children,...p}){return<span className={cx("g-badge",tone,className)} {...p}>{dot&&<i/>}{children}</span>;}
export function Title({icon,title,sub,children}){return<div className="g-title">{icon&&<span className="g-ti">{icon}</span>}<div><h2>{title}</h2>{sub&&<p>{sub}</p>}</div><span className="g-sp"/>{children}</div>;}
export function KPI({label,value,delta,tone,icon,onClick}){return<div className={cx("g-card g-kpi",onClick&&"hover")} onClick={onClick} role={onClick?"button":undefined} tabIndex={onClick?0:undefined}><div className="g-kpi-l"><span>{label}</span>{icon&&<span className="g-ki">{icon}</span>}</div><div className="g-kpi-n">{value}</div>{delta!=null&&<div className={cx("g-kpi-d",tone)}>{delta}</div>}</div>;}
export function Tabs({items,value,onChange}){return<div className="g-tabs" role="tablist">{items.map(t=><button key={t.k} type="button" role="tab" aria-selected={value===t.k} className={cx("g-tab",value===t.k&&"on")} onClick={()=>onChange(t.k)}>{t.icon}{t.ar||t.label}{t.n!=null&&<span className="g-count" style={{background:"var(--soft)",color:"inherit"}}>{t.n}</span>}</button>)}</div>;}
export function Empty({icon,title,text,children}){return<div className="g-empty"><span className="g-ti">{icon||<Inbox size={24}/>}</span><b>{title||"لا توجد بيانات"}</b>{text&&<p>{text}</p>}{children}</div>;}
export function Skeleton({rows=3,box}){return box?<div className="g-skel box"/>:<div style={{display:"flex",flexDirection:"column",gap:10}}>{Array.from({length:rows}).map((_,i)=><div key={i} className={cx("g-skel t",i%3===1&&"w",i%3===2&&"s")}/>)}</div>;}
export function Spinner(){return<div className="g-spin" role="status" aria-label="جارٍ التحميل"/>;}
export function Track({pct,tone}){return<div className={cx("g-track",tone)}><i style={{width:Math.max(0,Math.min(100,pct||0))+"%"}}/></div>;}

// ── نافذة ── يغلقها Esc والنقر خارجها
export function Modal({open,onClose,title,sub,size,children,foot}){
  useEffect(()=>{if(!open)return;const h=e=>{if(e.key==="Escape")onClose&&onClose();};window.addEventListener("keydown",h);const prev=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{window.removeEventListener("keydown",h);document.body.style.overflow=prev;};},[open,onClose]);
  if(!open)return null;
  return(<div className="g-scrim" onMouseDown={e=>{if(e.target===e.currentTarget&&onClose)onClose();}}>
    <div className={cx("g-modal",size)} role="dialog" aria-modal="true" aria-label={typeof title==="string"?title:undefined}>
      {(title||onClose)&&<div className="g-head"><div><b>{title}</b>{sub&&<small>{sub}</small>}</div>{onClose&&<Btn variant="ghost" icon onClick={onClose} aria-label="إغلاق"><X size={18}/></Btn>}</div>}
      <div className="g-body">{children}</div>
      {foot&&<div className="g-foot">{foot}</div>}
    </div>
  </div>);
}

// ── Toast ── const toast=useToast(); toast.ok("تم الحفظ"); toast.bad("فشل","التفاصيل…")
const ToastCtx=createContext(null);
export function ToastProvider({children}){
  const[list,setList]=useState([]);const idRef=useRef(0);
  const remove=useCallback(id=>setList(l=>l.map(t=>t.id===id?{...t,out:true}:t)),[]);
  useEffect(()=>{if(!list.some(t=>t.out))return;const h=setTimeout(()=>setList(l=>l.filter(t=>!t.out)),220);return()=>clearTimeout(h);},[list]);
  const push=useCallback((tone,title,text,ms)=>{const id=++idRef.current;setList(l=>[...l.slice(-3),{id,tone,title,text}]);if(ms!==0)setTimeout(()=>remove(id),ms||(tone==="bad"?6000:3600));return id;},[remove]);
  const api=useRef({push,ok:(t,x,ms)=>push("ok",t,x,ms),bad:(t,x,ms)=>push("bad",t,x,ms),warn:(t,x,ms)=>push("warn",t,x,ms),info:(t,x,ms)=>push("info",t,x,ms),remove}).current;
  return(<ToastCtx.Provider value={api}>{children}
    <div className="g-toasts" aria-live="polite">{list.map(t=><div key={t.id} className={cx("g-toast",t.tone,t.out&&"out")}><div><b>{t.title}</b>{t.text&&<span>{t.text}</span>}</div><button className="x" onClick={()=>remove(t.id)} aria-label="إغلاق">×</button></div>)}</div>
  </ToastCtx.Provider>);
}
const noop={push:()=>{},ok:()=>{},bad:()=>{},warn:()=>{},info:()=>{},remove:()=>{}};
export const useToast=()=>useContext(ToastCtx)||noop;

// ── زر تبديل الثيم (فاتح ← داكن ← تلقائي) ──
export function ThemeToggle({className,size=17}){
  const{mode,cycle}=useTheme();
  const Ic=mode==="dark"?Moon:mode==="auto"?Monitor:Sun;
  return<button type="button" className={cx("g-btn icon",className)} onClick={cycle} title={MODE_AR[mode]} aria-label={"الثيم: "+MODE_AR[mode]}><Ic size={size}/></button>;
}
// ── خلفية الكرات الملوّنة — مرة واحدة في الهيكل ──
export function Orbs(){return<div className="g-orbs" aria-hidden><span className="g-orb a"/><span className="g-orb b"/><span className="g-orb c"/></div>;}

// ── عدّاد رقمي متحرك — يعدّ من القيمة السابقة إلى الجديدة (يحترم «تقليل الحركة») ──
// <AnimatedNumber value={1075} format={v=>v.toLocaleString("en-US")} duration={0.9}/>
export function AnimatedNumber({value,format,duration=0.9,decimals=0,className,style}){
  const reduce=useReducedMotion();const ref=useRef(null);const prev=useRef(0);
  const n=Number(value)||0;
  const fmt=useCallback(v=>format?format(v):Number(v).toLocaleString("en-US",{minimumFractionDigits:decimals,maximumFractionDigits:decimals}),[format,decimals]);
  useEffect(()=>{
    const el=ref.current;if(!el)return;
    const from=prev.current;prev.current=n;
    if(reduce||from===n){el.textContent=fmt(n);return;}
    const c=animate(from,n,{duration,ease:[.2,.8,.2,1],onUpdate:v=>{el.textContent=fmt(decimals?v:Math.round(v));}});
    return()=>c.stop();
  },[n,reduce,duration,fmt,decimals]);
  return<span ref={ref} className={cx("g-num",className)} style={style} aria-label={fmt(n)}>{fmt(reduce?n:0)}</span>;
}

// ── مؤشر دائري (Gauge) — 0..max، لونه حسب العتبات ──
// <Gauge value={86} label="الالتزام" sub="آخر 30 يوماً" size={150}/>
export function Gauge({value,max=100,size=140,stroke=12,label,sub,unit="%",tone,thresholds=[80,60]}){
  const reduce=useReducedMotion();
  const has=value!=null&&!isNaN(value);const v=has?Math.max(0,Math.min(max,Number(value))):0;
  const pct=v/max;const r=(size-stroke)/2;const C=2*Math.PI*r;
  const t=tone||(!has?"mut":v>=thresholds[0]?"ok":v>=thresholds[1]?"warn":"bad");
  const col=t==="mut"?"var(--mut-2)":t==="p"?"var(--p)":`var(--${t})`;
  return(<div className="g-gauge" style={{width:size}} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={has?v:undefined} aria-label={label}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size/2} cy={size/2} r={r} style={{fill:"none",stroke:"var(--track)"}} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} style={{fill:"none",stroke:col,transition:reduce?"none":"stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)"}} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C*(1-pct)} transform={`rotate(-90 ${size/2} ${size/2})`}/>
    </svg>
    <div className="g-gauge-c"><b style={{color:t==="mut"?"var(--mut)":`var(--${t==="p"?"p-ink":t+"-ink"})`}}>{has?<AnimatedNumber value={v} decimals={v%1?1:0}/>:"—"}{has&&unit?<small>{unit}</small>:null}</b>{label&&<span>{label}</span>}</div>
    {sub&&<div className="g-gauge-s">{sub}</div>}
  </div>);
}

// ── حالة فارغة بشكل تجريدي ثلاثي الأبعاد (SVG خفيف، زخرفي) ──
// <EmptyState title="لا بيانات" text="…" variant="orb|stack|ring">{أزرار}</EmptyState>
export function EmptyState({title,text,children,variant="orb",compact}){
  const gid="es"+useIdSafe();
  const shape=variant==="ring"?(<>
      <ellipse cx="60" cy="96" rx="34" ry="7" style={{fill:"var(--ink)"}} opacity=".08"/>
      <circle cx="60" cy="56" r="30" fill="none" stroke={`url(#${gid}a)`} strokeWidth="14"/>
      <circle cx="49" cy="44" r="6" style={{fill:"#fff"}} opacity=".55"/></>)
    :variant==="stack"?(<>
      <ellipse cx="60" cy="98" rx="38" ry="7" style={{fill:"var(--ink)"}} opacity=".08"/>
      <rect x="30" y="58" width="60" height="26" rx="10" fill={`url(#${gid}b)`} transform="rotate(-8 60 71)"/>
      <rect x="34" y="34" width="52" height="26" rx="10" fill={`url(#${gid}a)`} transform="rotate(6 60 47)"/>
      <circle cx="74" cy="26" r="9" style={{fill:"var(--s)"}} opacity=".85"/></>)
    :(<>
      <ellipse cx="60" cy="98" rx="32" ry="7" style={{fill:"var(--ink)"}} opacity=".08"/>
      <circle cx="60" cy="54" r="34" fill={`url(#${gid}a)`}/>
      <ellipse cx="60" cy="54" rx="46" ry="12" fill="none" stroke={`url(#${gid}b)`} strokeWidth="5" transform="rotate(-18 60 54)" opacity=".85"/>
      <circle cx="48" cy="40" r="9" style={{fill:"#fff"}} opacity=".5"/></>);
  return(<div className={cx("g-es",compact&&"compact")}>
    <svg width="120" height="110" viewBox="0 0 120 110" aria-hidden className="g-es-art">
      <defs>
        <radialGradient id={gid+"a"} cx=".35" cy=".3" r=".8"><stop offset="0" style={{stopColor:"var(--a)"}}/><stop offset=".6" style={{stopColor:"var(--p)"}}/><stop offset="1" style={{stopColor:"var(--p-700)"}}/></radialGradient>
        <linearGradient id={gid+"b"} x1="0" x2="1"><stop offset="0" style={{stopColor:"var(--s)"}}/><stop offset="1" style={{stopColor:"var(--a)"}}/></linearGradient>
      </defs>{shape}
    </svg>
    {title&&<b>{title}</b>}{text&&<p>{text}</p>}{children&&<div className="g-es-a">{children}</div>}
  </div>);
}
let __es=0;function useIdSafe(){const r=useRef(null);if(r.current==null)r.current=(++__es).toString(36);return r.current;}
