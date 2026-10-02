// لوحة مساعد العمليات — شخصية «رغوة» (ASSISTANT في assistantBrief.js): ملخّص يومي بصياغة بشرية،
// خلاصة أحداث بطوابع زمنية، مهام سريعة تفتح الصفحة المعنية عبر dw:open، ونسبة الأتمتة من audit_log.
// جانبية على الشاشات الواسعة، وورقة سفلية (sheet) على الجوال/اللوحي.
import{useState,useEffect,useMemo,useRef,useCallback,useId}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{useToast}from"./ui";
import{periodRange,PERIODS}from"./period";
import{ASSISTANT,dailyBrief,needsRound,nearestBonus,docsDue,automationShare,monthSummary}from"./assistantBrief";

const timeAgo=t=>{if(!t)return"";const s=Math.max(0,(Date.now()-new Date(t).getTime())/1000);
  if(s<60)return"الآن";if(s<3600)return`منذ ${Math.floor(s/60)} د`;if(s<86400)return`منذ ${Math.floor(s/3600)} س`;const d=Math.floor(s/86400);return d<30?`منذ ${d} يوم`:new Date(t).toLocaleDateString("en-GB");};
const open=(nav,view,detail)=>{nav&&nav(view);if(detail)setTimeout(()=>window.dispatchEvent(new CustomEvent("dw:open",{detail:{view,...detail}})),300);};

// صورة رمزية مجرّدة: فقاعات رغوة بتدرّج الهوية
export function AssistantAvatar({size=44}){
  const gid="asg"+useId().replace(/[^a-zA-Z0-9]/g,"");
  return(<svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="as-av">
    <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={{stopColor:"var(--a)"}}/><stop offset="1" style={{stopColor:"var(--p)"}}/></linearGradient></defs>
    <circle cx="24" cy="24" r="24" fill={`url(#${gid})`}/>
    <circle cx="18" cy="21" r="8" style={{fill:"#fff"}} opacity=".92"/><circle cx="29" cy="18" r="6" style={{fill:"#fff"}} opacity=".8"/>
    <circle cx="30" cy="30" r="5" style={{fill:"#fff"}} opacity=".7"/><circle cx="20" cy="32" r="3" style={{fill:"#fff"}} opacity=".6"/>
    <circle cx="15.5" cy="18.5" r="2" style={{fill:"var(--p)"}} opacity=".35"/>
  </svg>);
}

function Panel({d,period,onNav,me,onClose}){
  const toast=useToast();
  const[feed,setFeed]=useState(null);const[auto,setAuto]=useState(undefined);const[act,setAct]=useState(null);
  const loadedAt=useRef(Date.now());
  const today=useMemo(()=>new Date(),[]);
  useEffect(()=>{let live=true;(async()=>{
    const[n,r]=await Promise.all([
      supabase.from("notifications").select("id,title,category,module,entity_id,severity,audience,created_at").order("created_at",{ascending:false}).limit(12).then(x=>x.data||[],()=>[]),
      supabase.from("field_rounds").select("id,biker_name,sweater_id,round_date,compliance_pct,status,created_at").neq("status","requested").order("created_at",{ascending:false}).limit(5).then(x=>x.data||[],()=>[]),
    ]);
    const items=[
      ...n.filter(x=>x.audience!=="user").slice(0,8).map(x=>({k:"n"+x.id,t:x.created_at,ic:x.severity==="crit"?"alert":"bell",tone:x.severity==="crit"?"bad":x.severity==="warn"?"warn":"info",text:x.title,go:()=>open(onNav,x.module||"dashboard",x.module==="renewals"&&x.entity_id?{table:"renewal_docs",id:x.entity_id}:null)})),
      ...r.map(x=>({k:"r"+x.id,t:x.created_at||x.round_date,ic:"rounds",tone:x.compliance_pct>=80?"ok":x.compliance_pct>=60?"warn":"bad",text:`جولة ميدانية — ${x.biker_name||"#"+x.sweater_id}: ${x.compliance_pct!=null?x.compliance_pct+"%":"—"}`,go:()=>open(onNav,"field_rounds")})),
    ].sort((a,b)=>String(b.t).localeCompare(String(a.t))).slice(0,8);
    // نسبة الأتمتة للفترة المشتركة (تقويمياً حتى اليوم) — audit_log مقصور على المالك؛ إن رُفضت القراءة تُخفى
    const pr=periodRange(period,null);
    const base=()=>supabase.from("audit_log").select("id",{count:"exact",head:true}).gte("changed_at",pr.from+"T00:00:00").lte("changed_at",pr.to+"T23:59:59");
    const[tot,au]=await Promise.all([base(),base().is("actor_email",null)]);
    if(!live)return;
    setFeed(items);
    setAuto(tot.error||au.error?null:automationShare(au.count,tot.count));
  })();return()=>{live=false;};},[period,onNav]);

  const brief=useMemo(()=>d?dailyBrief({ops:d.ops,rounds:d.rounds,docs:d.docs,screq:d.screq},{today,name:me}):[],[d,today,me]);
  const run=useCallback(k=>{
    if(!d)return;
    if(k==="rounds")setAct({k,title:"من يحتاج جولة اليوم",items:needsRound(d.ops,d.rounds,{today}).map(x=>({key:x.sid,main:x.name||"#"+x.sid,sub:x.why,cta:"بدء جولة",go:()=>open(onNav,"field_rounds",{table:"field_rounds",action:"new",sweater_id:x.sid})}))});
    else if(k==="docs")setAct({k,title:"وثائق قريبة من الانتهاء",items:docsDue(d.docs,{today}).map(x=>({key:x.subject+x.doc_type+x.end_date,main:`${x.doc_type} — ${x.subject}`,sub:x.text,tone:x.status.tone,cta:"فتح",go:()=>open(onNav,"renewals",x.id?{table:"renewal_docs",id:x.id}:null)}))});
    else if(k==="bonus")setAct({k,title:"الأقرب لمكافأة الإنتاج",items:nearestBonus(d.ops).map(x=>({key:x.sid,main:x.name||"#"+x.sid,sub:`${x.washes} غسلة · تبقّى ${x.next.gap} لمكافأة ${x.next.bonus} ﷼`,cta:"البطاقة",go:()=>open(onNav,"performance",{table:"ops_biker_month",id:x.sid})}))});
    else if(k==="summary"){const txt=monthSummary({ops:d.ops,rounds:d.rounds,docs:d.docs},{today});setAct({k,title:"ملخص الشهر",text:txt});}
  },[d,today,onNav]);
  const copy=async t=>{try{await navigator.clipboard.writeText(t);toast.ok("نُسخ الملخص");}catch(_){toast.bad("تعذّر النسخ");}};
  const perAr=(PERIODS.find(p=>p.k===period)||{}).ar;

  return(<div className="as-in">
    <div className="as-h">
      <AssistantAvatar/>
      <div className="as-hn"><b>{ASSISTANT.name}</b><span>{ASSISTANT.role}</span>
        <small><i className="as-dot" aria-hidden/> متاحة · تحديث {timeAgo(loadedAt.current)}</small></div>
      {onClose&&<button className="g-btn ghost icon" onClick={onClose} aria-label="إغلاق المساعد"><Icon n="x" s={18}/></button>}
    </div>

    <section className="as-sec" aria-label="ملخّص اليوم">
      <div className="as-brief">{brief.map((t,i)=><p key={i} className={i===0?"hi":""}>{t}</p>)}</div>
    </section>

    <section className="as-sec" aria-label="مهام سريعة">
      <div className="as-st">مهام سريعة</div>
      <div className="as-qa">
        {[["rounds","rounds","من يحتاج جولة اليوم"],["docs","doc","رسائل الوثائق القريبة"],["bonus","star","الأقرب لمكافأة الإنتاج"],["summary","reports","ملخص الشهر"]].map(([k,ic,t])=>
          <button key={k} type="button" className={"as-qb"+(act&&act.k===k?" on":"")} onClick={()=>run(k)} aria-pressed={!!(act&&act.k===k)}><Icon n={ic} s={15}/><span>{t}</span></button>)}
      </div>
      {act&&<div className="as-res" role="region" aria-live="polite" aria-label={act.title}>
        <div className="as-res-h"><b>{act.title}</b><button className="g-btn ghost sm" onClick={()=>setAct(null)}>إخفاء</button></div>
        {act.text!=null?<><pre className="as-pre">{act.text}</pre><div className="as-res-a"><button className="g-btn sm" onClick={()=>copy(act.text)}><Icon n="doc" s={13}/> نسخ</button></div></>
        :act.items.length===0?<p className="as-empty">لا شيء هنا الآن 👌</p>
        :act.items.map(x=><div key={x.key} className="as-ri"><div><b>{x.main}</b><span className={x.tone?"t-"+x.tone:""}>{x.sub}</span></div><button className="g-btn sm" onClick={()=>{x.go();onClose&&onClose();}}>{x.cta}</button></div>)}
      </div>}
    </section>

    {auto!==null&&<section className="as-sec" aria-label="نسبة الأتمتة">
      <div className="as-st">نسبة الأتمتة · {perAr}</div>
      {auto===undefined?<div className="g-skel row"/>:!auto?<p className="as-empty">لا تغييرات مسجّلة في الفترة.</p>:
      <div className="as-auto" title="تغييرات بلا مستخدم (تلقائية من القاعدة والجدولة) ÷ كل التغييرات المسجّلة في سجل التدقيق">
        <div className="as-auto-n"><b>{auto.pct}%</b><span>تلقائي {auto.auto.toLocaleString("en-US")} · يدوي {auto.manual.toLocaleString("en-US")}</span></div>
        <div className="g-track" aria-hidden><i style={{width:auto.pct+"%"}}/></div>
        <small>من سجل التدقيق: التغييرات التي نفّذتها القاعدة والجدولة دون مستخدم.</small>
      </div>}
    </section>}

    <section className="as-sec" aria-label="آخر الأحداث">
      <div className="as-st">آخر الأحداث</div>
      {feed===null?<><div className="g-skel row"/><div className="g-skel row" style={{marginTop:8}}/></>:feed.length===0?<p className="as-empty">لا أحداث بعد.</p>:
      <ul className="as-feed">{feed.map(x=><li key={x.k}><button type="button" onClick={()=>{x.go();onClose&&onClose();}}>
        <span className={"as-fi t-"+x.tone}><Icon n={x.ic} s={13}/></span><span className="as-ft">{x.text}</span><time dateTime={x.t}>{timeAgo(x.t)}</time></button></li>)}</ul>}
    </section>
  </div>);
}

// الزر العائم لا يغطي عنصراً تفاعلياً أبداً: بعد كل تمرير/تغيير حجم نفحص ما تحت مساحته الكاملة؛
// إن وُجد عنصر تفاعلي ينطوي إلى لسان رفيع داخل هامش الصفحة (الذي لا يحوي عناصر)، ويعود عند خلوّ المكان.
const INTERACTIVE='a[href],button,select,input,textarea,label,summary,[role=button],[role=link],[role=tab],[role=radio],[tabindex]:not([tabindex="-1"])';
function useFabAvoid(ref){
  const[tuck,setTuck]=useState(false);const home=useRef(null);const tuckRef=useRef(false);
  useEffect(()=>{
    let raf=0;
    const check=()=>{raf=0;const el=ref.current;if(!el||!el.getClientRects().length)return; // offsetParent دائماً null للعناصر fixed
      if(!tuckRef.current||!home.current)home.current=el.getBoundingClientRect();
      const r=home.current;const pts=[];for(let i=0;i<5;i++)for(let j=0;j<5;j++)pts.push([r.left-4+(r.width+8)*i/4,r.top-4+(r.height+8)*j/4]); // هامش 4px حول الزر
      const hit=pts.some(([x,y])=>{const top=document.elementsFromPoint(x,y).find(n=>!el.contains(n)&&!n.closest(".g-bnav"));return!!(top&&top.closest(INTERACTIVE));});
      if(hit!==tuckRef.current){tuckRef.current=hit;setTuck(hit);}
    };
    const q=()=>{if(!raf)raf=requestAnimationFrame(check);};
    const rs=()=>{home.current=null;tuckRef.current=false;setTuck(false);setTimeout(q,60);};
    window.addEventListener("scroll",q,{passive:true,capture:true});window.addEventListener("resize",rs);
    const t=setTimeout(q,400);const mo=new MutationObserver(q);mo.observe(document.body,{childList:true,subtree:true});
    return()=>{window.removeEventListener("scroll",q,{capture:true});window.removeEventListener("resize",rs);clearTimeout(t);mo.disconnect();if(raf)cancelAnimationFrame(raf);};
  },[ref]);
  return tuck;
}

// الحاوية: جانبية ثابتة على الشاشات ≥1280، وزر عائم + ورقة سفلية دونها
export default function Assistant({d,period,onNav,me}){
  const[sheet,setSheet]=useState(false);const closeRef=useRef(null);const tuck=useFabAvoid(closeRef);
  useEffect(()=>{if(!sheet)return;const h=e=>{if(e.key==="Escape")setSheet(false);};window.addEventListener("keydown",h);const prev=document.body.style.overflow;document.body.style.overflow="hidden";
    setTimeout(()=>{const el=document.querySelector(".as-sheet button");el&&el.focus();},50);
    return()=>{window.removeEventListener("keydown",h);document.body.style.overflow=prev;};},[sheet]);
  return(<>
    <aside className="as-side g-card" aria-label={`المساعد ${ASSISTANT.name}`}><Panel d={d} period={period} onNav={onNav} me={me}/></aside>
    <button type="button" className={"as-fab"+(tuck?" tuck":"")} onClick={()=>setSheet(true)} aria-label={`فتح المساعد ${ASSISTANT.name}`} ref={closeRef}><AssistantAvatar size={30}/><span>{ASSISTANT.name}</span></button>
    {sheet&&<div className="as-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)setSheet(false);}}>
      <div className="as-sheet g-card" role="dialog" aria-modal="true" aria-label={`المساعد ${ASSISTANT.name}`}><Panel d={d} period={period} onNav={onNav} me={me} onClose={()=>setSheet(false)}/></div>
    </div>}
  </>);
}
