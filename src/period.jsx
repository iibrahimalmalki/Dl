// الفترة المشتركة بين الصفحات (اليوم · الأسبوع · الشهر · الشهر الماضي · آخر 3 أشهر · السنة · مخصّص)
// تُحفظ في localStorage وتُبثّ بحدث window «dw:period» فتتزامن كل الصفحات المفتوحة.
// «مخصّص» يحفظ نطاق أشهره {from,to} (YYYY-MM) تحت dw.period.custom ويُبثّ بحدث «dw:period-custom».
// const[period,setPeriod,custom,setCustom]=usePeriod();
// <PeriodSelector value={period} onChange={setPeriod} custom={custom} onCustom={setCustom}/>
import{useState,useEffect,useCallback,useRef}from"react";

export const PERIODS=[{k:"day",ar:"اليوم"},{k:"week",ar:"الأسبوع"},{k:"month",ar:"الشهر"},{k:"prev",ar:"الشهر الماضي"},{k:"quarter",ar:"آخر 3 أشهر"},{k:"year",ar:"السنة"},{k:"custom",ar:"مخصّص"}];
// الفترات الشهرية تُحسب من بيانات الأشهر (ops_biker_month)؛ اليوم/الأسبوع من البيانات اليومية
export const isMonthly=k=>k!=="day"&&k!=="week";
const KEY="dw.period",CKEY="dw.period.custom";
const valid=k=>PERIODS.some(p=>p.k===k);
const read=()=>{try{const v=localStorage.getItem(KEY);return valid(v)?v:"month";}catch(_){return"month";}};
const YM=/^\d{4}-\d{2}$/;
const validC=c=>!!(c&&YM.test(c.from)&&YM.test(c.to));
export const readCustom=()=>{try{const c=JSON.parse(localStorage.getItem(CKEY)||"null");return validC(c)?c:null;}catch(_){return null;}};

export function usePeriod(){
  const[p,setP]=useState(read);const[c,setC]=useState(readCustom);
  useEffect(()=>{
    const h=e=>{const v=e.detail;if(valid(v))setP(v);};
    const hc=e=>{if(validC(e.detail))setC(e.detail);};
    const st=e=>{if(e.key===KEY&&valid(e.newValue))setP(e.newValue);if(e.key===CKEY){const v=readCustom();if(v)setC(v);}};
    window.addEventListener("dw:period",h);window.addEventListener("dw:period-custom",hc);window.addEventListener("storage",st);
    return()=>{window.removeEventListener("dw:period",h);window.removeEventListener("dw:period-custom",hc);window.removeEventListener("storage",st);};
  },[]);
  const set=useCallback(v=>{if(!valid(v))return;setP(v);try{localStorage.setItem(KEY,v);}catch(_){}window.dispatchEvent(new CustomEvent("dw:period",{detail:v}));},[]);
  const setCustom=useCallback(v=>{if(!validC(v))return;setC(v);try{localStorage.setItem(CKEY,JSON.stringify(v));}catch(_){}window.dispatchEvent(new CustomEvent("dw:period-custom",{detail:v}));},[]);
  return[p,set,c,setCustom];
}

// ── نطاق التواريخ للفترة، مثبّتاً على آخر يوم تتوفر فيه بيانات (anchor: YYYY-MM-DD) ──
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const addDays=(s,n)=>{const d=new Date(s+"T00:00:00");d.setDate(d.getDate()+n);return iso(d);};
const addMonths=(ym,n)=>{const[y,m]=ym.split("-").map(Number);const d=new Date(y,m-1+n,1);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;};
// يعيد {from,to,months:[YYYY-MM…],prev:{from,to,months}}
// الأسبوع 7 أيام تنتهي بالمرساة · آخر 3 أشهر تنتهي بشهر المرساة · الشهر الماضي = الشهر السابق لشهر المرساة
// السنة = من يناير حتى شهر المرساة، ومقارنتها بالمدة نفسها من السنة السابقة
// مخصّص = أشهر custom {from,to} (أو المحفوظة)، ومقارنتها بالمدة نفسها قبلها مباشرة
export function periodRange(k,anchor,custom){
  const a=anchor||iso(new Date());const ym=a.slice(0,7);
  const monthsBetween=(f,t)=>{const out=[];let c=f.slice(0,7);while(c<=t.slice(0,7)){out.push(c);c=addMonths(c,1);}return out;};
  const lastDay=ym2=>{const[y,m]=ym2.split("-").map(Number);return`${ym2}-${String(new Date(y,m,0).getDate()).padStart(2,"0")}`;};
  let from,to,pf,pt;
  if(k==="day"){from=to=a;pf=pt=addDays(a,-1);}
  else if(k==="week"){to=a;from=addDays(a,-6);pt=addDays(a,-7);pf=addDays(a,-13);}
  else if(k==="quarter"){from=addMonths(ym,-2)+"-01";to=lastDay(ym);pf=addMonths(ym,-5)+"-01";pt=lastDay(addMonths(ym,-3));}
  else if(k==="prev"){const pm=addMonths(ym,-1);from=pm+"-01";to=lastDay(pm);pf=addMonths(ym,-2)+"-01";pt=lastDay(addMonths(ym,-2));}
  else if(k==="year"){const y=+ym.slice(0,4);from=`${y}-01-01`;to=lastDay(ym);pf=`${y-1}-01-01`;pt=lastDay(`${y-1}${ym.slice(4)}`);}
  else if(k==="custom"){const c=validC(custom)?custom:(readCustom()||{from:ym,to:ym});const lo=c.from<=c.to?c.from:c.to,hi=c.from<=c.to?c.to:c.from;
    const n=monthsBetween(lo,hi).length;from=lo+"-01";to=lastDay(hi);pf=addMonths(lo,-n)+"-01";pt=lastDay(addMonths(lo,-1));}
  else{from=ym+"-01";to=lastDay(ym);pf=addMonths(ym,-1)+"-01";pt=lastDay(addMonths(ym,-1));}
  return{k,from,to,months:monthsBetween(from,to),prev:{from:pf,to:pt,months:monthsBetween(pf,pt)}};
}

// ── مُحدِّد الفترة: radiogroup بأسهم لوحة المفاتيح، يتمرّر أفقياً إن لم يتّسع، و«مخصّص» يفتح حقلي من/إلى ──
export function PeriodSelector({value,onChange,custom,onCustom,customDefault,className}){
  const refs=useRef({});const first=useRef(true);
  const key=(e,i)=>{const dir=e.key==="ArrowLeft"?1:e.key==="ArrowRight"?-1:0;if(!dir)return;e.preventDefault();const n=PERIODS[(i+dir+PERIODS.length)%PERIODS.length];onChange(n.k);refs.current[n.k]&&refs.current[n.k].focus();};
  // إبقاء الخيار النشط ظاهراً داخل الشريط عند تغييره (لا عند أول عرض حتى لا تقفز الصفحة)
  useEffect(()=>{if(first.current){first.current=false;return;}const b=refs.current[value];b&&b.scrollIntoView&&b.scrollIntoView({block:"nearest",inline:"nearest",behavior:"smooth"});},[value]);
  const thisYM=new Date().toISOString().slice(0,7);
  // أول اختيار لـ«مخصّص» يبدأ من customDefault (آخر شهر فيه بيانات) لا من الشهر الحالي الذي قد يكون فارغاً
  const c=custom||customDefault||{from:thisYM,to:thisYM};
  const setC=(k,v)=>{if(!onCustom||!YM.test(v))return;onCustom({...c,[k]:v});};
  return(<div className={"g-pwrap"+(className?" "+className:"")}>
    <div className="g-seg scroll" role="radiogroup" aria-label="الفترة">
      {PERIODS.map((p,i)=><button key={p.k} ref={el=>{refs.current[p.k]=el;}} type="button" role="radio" aria-checked={value===p.k} tabIndex={value===p.k?0:-1}
        className={"g-seg-b"+(value===p.k?" on":"")} onClick={()=>{if(p.k==="custom"&&onCustom&&!custom)onCustom(c);onChange(p.k);}} onKeyDown={e=>key(e,i)}>{p.ar}</button>)}
    </div>
    {value==="custom"&&onCustom&&<div className="g-pcust" role="group" aria-label="نطاق مخصّص">
      <label><span>من</span><input className="g-input" type="month" value={c.from} max={thisYM} onChange={e=>setC("from",e.target.value)}/></label>
      <label><span>إلى</span><input className="g-input" type="month" value={c.to} max={thisYM} onChange={e=>setC("to",e.target.value)}/></label>
    </div>}
  </div>);
}
