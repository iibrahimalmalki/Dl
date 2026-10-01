// ═══ مزوّد الثيم — فاتح / داكن / تلقائي (حسب الجهاز) ═══
// يُحفظ الاختيار في localStorage تحت "dw.theme" ويُطبَّق على <html data-theme="light|dark">.
// الاستخدام: const{mode,resolved,setMode,cycle}=useTheme();
import{createContext,useContext,useEffect,useMemo,useState,useCallback}from"react";

const KEY="dw.theme";
const LEGACY="dw.sidebar.theme"; // المفتاح القديم (الشريط الجانبي فقط) — يُرحَّل مرة واحدة
export const MODES=["light","dark","auto"];
export const MODE_AR={light:"الوضع الفاتح",dark:"الوضع الداكن",auto:"تلقائي حسب الجهاز"};

const mq=()=>typeof window!=="undefined"&&window.matchMedia?window.matchMedia("(prefers-color-scheme: dark)"):null;
const systemDark=()=>{const m=mq();return!!(m&&m.matches);};
const readStored=()=>{try{const v=localStorage.getItem(KEY);if(MODES.includes(v))return v;const l=localStorage.getItem(LEGACY);if(l==="dark"||l==="light"){localStorage.setItem(KEY,l);return l;}}catch(_){}return"light";};
const resolve=m=>m==="auto"?(systemDark()?"dark":"light"):m;

// يُطبَّق قبل أول رسم لتفادي وميض الوضع الخاطئ | apply before first paint
export function applyTheme(resolved){
  if(typeof document==="undefined")return;
  const el=document.documentElement;
  el.dataset.theme=resolved;
  el.style.colorScheme=resolved;
  let meta=document.querySelector('meta[name="theme-color"]');
  if(!meta){meta=document.createElement("meta");meta.name="theme-color";document.head.appendChild(meta);}
  meta.content=resolved==="dark"?"#0A0E27":"#F5F6FA";
}
try{applyTheme(resolve(readStored()));}catch(_){}

const Ctx=createContext({mode:"light",resolved:"light",setMode:()=>{},cycle:()=>{}});

export function ThemeProvider({children}){
  const[mode,setModeState]=useState(readStored);
  const[sys,setSys]=useState(systemDark);
  useEffect(()=>{const m=mq();if(!m)return;const h=e=>setSys(e.matches);m.addEventListener?m.addEventListener("change",h):m.addListener(h);return()=>{m.removeEventListener?m.removeEventListener("change",h):m.removeListener(h);};},[]);
  const resolved=mode==="auto"?(sys?"dark":"light"):mode;
  useEffect(()=>{applyTheme(resolved);},[resolved]);
  const setMode=useCallback(m=>{if(!MODES.includes(m))return;setModeState(m);try{localStorage.setItem(KEY,m);}catch(_){}},[]);
  const cycle=useCallback(()=>setMode(MODES[(MODES.indexOf(mode)+1)%MODES.length]),[mode,setMode]);
  const value=useMemo(()=>({mode,resolved,setMode,cycle}),[mode,resolved,setMode,cycle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useTheme=()=>useContext(Ctx);
export default ThemeProvider;
