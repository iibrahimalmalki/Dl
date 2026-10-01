// ═══ مكوّنات الواجهة المشتركة (Glass UI) — أغلفة خفيفة فوق فئات g-* في theme.css ═══
// import{Card,Btn,Badge,Modal,Tabs,Empty,Skeleton,KPI,Title,ToastProvider,useToast}from"./ui";
import{createContext,useContext,useState,useCallback,useEffect,useRef}from"react";
import{X,Inbox,Sun,Moon,Monitor}from"lucide-react";
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
