// الفترة المشتركة بين الصفحات (اليوم · الأسبوع · الشهر · الربع)
// تُحفظ في localStorage وتُبثّ بحدث window «dw:period» فتتزامن كل الصفحات المفتوحة.
// const[period,setPeriod]=usePeriod();  <PeriodSelector value={period} onChange={setPeriod}/>
import{useState,useEffect,useCallback,useRef}from"react";

export const PERIODS=[{k:"day",ar:"اليوم"},{k:"week",ar:"الأسبوع"},{k:"month",ar:"الشهر"},{k:"quarter",ar:"الربع"}];
const KEY="dw.period";
const valid=k=>PERIODS.some(p=>p.k===k);
const read=()=>{try{const v=localStorage.getItem(KEY);return valid(v)?v:"month";}catch(_){return"month";}};

export function usePeriod(){
  const[p,setP]=useState(read);
  useEffect(()=>{
    const h=e=>{const v=e.detail;if(valid(v))setP(v);};
    const st=e=>{if(e.key===KEY&&valid(e.newValue))setP(e.newValue);};
    window.addEventListener("dw:period",h);window.addEventListener("storage",st);
    return()=>{window.removeEventListener("dw:period",h);window.removeEventListener("storage",st);};
  },[]);
  const set=useCallback(v=>{if(!valid(v))return;setP(v);try{localStorage.setItem(KEY,v);}catch(_){}window.dispatchEvent(new CustomEvent("dw:period",{detail:v}));},[]);
  return[p,set];
}

// ── نطاق التواريخ للفترة، مثبّتاً على آخر يوم تتوفر فيه بيانات (anchor: YYYY-MM-DD) ──
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const addDays=(s,n)=>{const d=new Date(s+"T00:00:00");d.setDate(d.getDate()+n);return iso(d);};
const addMonths=(ym,n)=>{const[y,m]=ym.split("-").map(Number);const d=new Date(y,m-1+n,1);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;};
// يعيد {from,to,months:[YYYY-MM…],prev:{from,to,months}} — الأسبوع 7 أيام تنتهي بالمرساة، الربع آخر 3 أشهر
export function periodRange(k,anchor){
  const a=anchor||iso(new Date());const ym=a.slice(0,7);
  const monthsBetween=(f,t)=>{const out=[];let c=f.slice(0,7);while(c<=t.slice(0,7)){out.push(c);c=addMonths(c,1);}return out;};
  const lastDay=ym2=>{const[y,m]=ym2.split("-").map(Number);return`${ym2}-${String(new Date(y,m,0).getDate()).padStart(2,"0")}`;};
  let from,to,pf,pt;
  if(k==="day"){from=to=a;pf=pt=addDays(a,-1);}
  else if(k==="week"){to=a;from=addDays(a,-6);pt=addDays(a,-7);pf=addDays(a,-13);}
  else if(k==="quarter"){from=addMonths(ym,-2)+"-01";to=lastDay(ym);pf=addMonths(ym,-5)+"-01";pt=lastDay(addMonths(ym,-3));}
  else{from=ym+"-01";to=lastDay(ym);pf=addMonths(ym,-1)+"-01";pt=lastDay(addMonths(ym,-1));}
  return{k,from,to,months:monthsBetween(from,to),prev:{from:pf,to:pt,months:monthsBetween(pf,pt)}};
}

// ── مُحدِّد الفترة: radiogroup بأسهم لوحة المفاتيح ──
export function PeriodSelector({value,onChange,className}){
  const refs=useRef({});
  const key=(e,i)=>{const dir=e.key==="ArrowLeft"?1:e.key==="ArrowRight"?-1:0;if(!dir)return;e.preventDefault();const n=PERIODS[(i+dir+PERIODS.length)%PERIODS.length];onChange(n.k);refs.current[n.k]&&refs.current[n.k].focus();};
  return(<div className={"g-seg"+(className?" "+className:"")} role="radiogroup" aria-label="الفترة">
    {PERIODS.map((p,i)=><button key={p.k} ref={el=>{refs.current[p.k]=el;}} type="button" role="radio" aria-checked={value===p.k} tabIndex={value===p.k?0:-1}
      className={"g-seg-b"+(value===p.k?" on":"")} onClick={()=>onChange(p.k)} onKeyDown={e=>key(e,i)}>{p.ar}</button>)}
  </div>);
}
