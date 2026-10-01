// ═══ البحث الشامل ⌘K — صفحات + موظفون + شكاوى + مركبات + طلبات إمداد + جولات + وثائق ═══
// الاستخدام في Shell: <GlobalSearch open={q} onClose={()=>setQ(false)} items={nav} onGo={go}/>
// عند اختيار سجل: يُنتقل إلى صفحته ويُبثّ حدث window "dw:open" {view,table,id,label} لتستخدمه الصفحات لاحقاً.
import{useState,useEffect,useRef,useMemo,useCallback}from"react";
import{supabase}from"./supabase";
import{Search,Users,MessageSquareWarning,Bike,PackagePlus,MapPinned,FileBadge,CornerDownLeft,Clock,LayoutGrid}from"lucide-react";

const KEY="dw.search.recent";
const readRecent=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"[]");}catch(_){return[];}};
const pushRecent=r=>{try{const l=readRecent().filter(x=>!(x.table===r.table&&x.id===r.id)).slice(0,6);localStorage.setItem(KEY,JSON.stringify([r,...l]));}catch(_){}};
const esc=s=>s.replace(/[%_,.()]/g," ").trim();

// مصادر البحث: جدول → حقول ilike → تحويل الصف إلى نتيجة
const SOURCES=[
  {table:"employees",view:"employees",ar:"الموظفون",Icon:Users,fields:["full_name","employee_id","mobile"],sel:"id,full_name,employee_id,mobile,staff_role",
    map:r=>({label:r.full_name,sub:[r.employee_id&&("رقم "+r.employee_id),r.mobile].filter(Boolean).join(" · ")})},
  {table:"ops_tickets",view:"complaints",ar:"الشكاوى",Icon:MessageSquareWarning,fields:["booking_ref","biker_name","sweater_ticket_no","description"],sel:"id,booking_ref,biker_name,ticket_date,decision,sub_category",
    map:r=>({label:(r.booking_ref?"حجز "+r.booking_ref+" · ":"")+(r.biker_name||""),sub:[r.sub_category,r.ticket_date,r.decision==="pending"?"معلّقة":r.decision==="approved"?"مقبولة":r.decision==="rejected"?"مرفوضة":r.decision].filter(Boolean).join(" · ")})},
  {table:"fleet_vehicles",view:"fleet",ar:"الأسطول",Icon:Bike,fields:["plate","plate_en","current_biker","held_by_name"],sel:"id,plate,plate_en,current_biker,status",
    map:r=>({label:r.plate||r.plate_en,sub:[r.current_biker,r.status].filter(Boolean).join(" · ")})},
  {table:"supply_requests",view:"supply_requests",ar:"طلبات الإمداد",Icon:PackagePlus,fields:["ref","biker_name","sweater_id"],sel:"id,ref,biker_name,status,created_at",
    map:r=>({label:r.ref+" · "+(r.biker_name||""),sub:[r.status==="completed"?"مكتمل":r.status==="escalated"?"مُصعَّد":"مفتوح",r.created_at&&r.created_at.slice(0,10)].filter(Boolean).join(" · ")})},
  {table:"field_rounds",view:"field_rounds",ar:"الجولات الميدانية",Icon:MapPinned,fields:["biker_name","sweater_id","location"],sel:"id,biker_name,sweater_id,round_date,compliance_pct",
    map:r=>({label:r.biker_name+(r.sweater_id?" · "+r.sweater_id:""),sub:[r.round_date,r.compliance_pct!=null&&("التزام "+r.compliance_pct+"%")].filter(Boolean).join(" · ")})},
  {table:"renewal_docs",view:"renewals",ar:"الوثائق",Icon:FileBadge,fields:["title","ref_no","subject"],sel:"id,title,subject,end_date,doc_type",
    map:r=>({label:r.title||r.doc_type,sub:[r.subject,r.end_date&&("ينتهي "+r.end_date)].filter(Boolean).join(" · ")})},
];

export default function GlobalSearch({open,onClose,items=[],onGo}){
  const[q,setQ]=useState("");const[rows,setRows]=useState([]);const[busy,setBusy]=useState(false);const[idx,setIdx]=useState(0);
  const inp=useRef(null);const listRef=useRef(null);const seq=useRef(0);
  const recent=useMemo(()=>open?readRecent():[],[open]);

  useEffect(()=>{if(open){setQ("");setRows([]);setIdx(0);setTimeout(()=>inp.current&&inp.current.focus(),30);}},[open]);

  // البحث في الجداول بعد توقّف الكتابة 220ms وبحد أدنى حرفين
  useEffect(()=>{
    const s=esc(q);if(!open||s.length<2){setRows([]);setBusy(false);return;}
    const my=++seq.current;setBusy(true);
    const h=setTimeout(async()=>{
      const out=await Promise.all(SOURCES.map(async src=>{
        try{const or=src.fields.map(f=>`${f}.ilike.%${s}%`).join(",");
          const{data}=await supabase.from(src.table).select(src.sel).or(or).limit(5);
          return(data||[]).map(r=>({...src.map(r),table:src.table,view:src.view,ar:src.ar,Icon:src.Icon,id:r.id}));
        }catch(_){return[];}
      }));
      if(my!==seq.current)return;
      setRows(out.flat());setBusy(false);setIdx(0);
    },220);
    return()=>clearTimeout(h);
  },[q,open]);

  const pages=useMemo(()=>{const s=q.trim();const l=s?items.filter(i=>(i.ar||"").includes(s)||(i.k||"").includes(s.toLowerCase())):items.slice(0,6);return l.slice(0,6).map(i=>({label:i.ar,sub:i.cat||"صفحة",view:i.k,table:null,Icon:LayoutGrid,ar:"الصفحات"}));},[q,items]);
  const all=useMemo(()=>{const l=[...pages,...rows];if(!q.trim()&&recent.length)return[...recent.map(r=>({...r,Icon:(SOURCES.find(s=>s.table===r.table)||{}).Icon||Clock,ar:"الأخيرة"})),...l];return l;},[pages,rows,q,recent]);

  const pick=useCallback(r=>{if(!r)return;if(r.table)pushRecent({label:r.label,sub:r.sub,table:r.table,id:r.id,view:r.view});onGo&&onGo(r.view);try{window.dispatchEvent(new CustomEvent("dw:open",{detail:{view:r.view,table:r.table,id:r.id,label:r.label}}));}catch(_){}onClose&&onClose();},[onGo,onClose]);

  useEffect(()=>{if(!open)return;const h=e=>{if(e.key==="Escape"){e.preventDefault();onClose&&onClose();}
    else if(e.key==="ArrowDown"){e.preventDefault();setIdx(i=>Math.min(all.length-1,i+1));}
    else if(e.key==="ArrowUp"){e.preventDefault();setIdx(i=>Math.max(0,i-1));}
    else if(e.key==="Enter"){e.preventDefault();pick(all[idx]);}};
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);},[open,all,idx,pick,onClose]);
  useEffect(()=>{const el=listRef.current&&listRef.current.querySelector(`[data-i="${idx}"]`);el&&el.scrollIntoView({block:"nearest"});},[idx]);

  if(!open)return null;
  let lastGroup=null;
  return(<div className="g-scrim gsr-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)onClose&&onClose();}}>
    <style>{CSS}</style>
    <div className="g-modal gsr" role="dialog" aria-modal="true" aria-label="البحث الشامل">
      <div className="gsr-in"><Search size={18}/><input ref={inp} value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث عن موظف، حجز، لوحة مركبة، طلب إمداد، صفحة…" aria-label="بحث"/>{busy?<span className="g-spin" style={{width:18,height:18,borderWidth:2,margin:0}}/>:<kbd className="g-kbd" dir="ltr">Esc</kbd>}</div>
      <div className="gsr-list" ref={listRef} role="listbox">
        {all.length===0&&<div className="g-empty" style={{padding:"28px 16px"}}><b style={{fontSize:13.5}}>{q.trim().length<2?"اكتب حرفين على الأقل":"لا نتائج"}</b><p>{q.trim().length<2?"الأسهم للتنقل و Enter للفتح":"جرّب الاسم أو رقم الحجز أو اللوحة"}</p></div>}
        {all.map((r,i)=>{const head=r.ar!==lastGroup;lastGroup=r.ar;const Ic=r.Icon||Clock;return(<div key={(r.table||"p")+(r.id||r.view)+i}>
          {head&&<div className="gsr-g">{r.ar}</div>}
          <div data-i={i} role="option" aria-selected={i===idx} className={"gsr-it"+(i===idx?" on":"")} onMouseEnter={()=>setIdx(i)} onClick={()=>pick(r)}>
            <span className="gsr-ic"><Ic size={16}/></span>
            <span className="gsr-tx"><b>{r.label}</b>{r.sub&&<small>{r.sub}</small>}</span>
            {i===idx&&<CornerDownLeft size={14} className="gsr-ent"/>}
          </div></div>);})}
      </div>
      <div className="gsr-ft"><span><kbd className="g-kbd">↑↓</kbd> تنقّل</span><span><kbd className="g-kbd">Enter</kbd> فتح</span><span><kbd className="g-kbd" dir="ltr">⌘K</kbd> فتح البحث من أي مكان</span></div>
    </div>
  </div>);
}

const CSS=`
.gsr-scrim{align-items:flex-start;padding-top:min(12vh,110px)}
.gsr{max-width:640px;max-height:min(70dvh,560px)}
.gsr-in{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line);color:var(--mut)}
.gsr-in input{flex:1;min-width:0;border:none;background:transparent;font-family:inherit;font-size:15px;color:var(--ink);outline:none}
.gsr-list{overflow:auto;padding:6px;flex:1}
.gsr-g{font-size:10.5px;font-weight:800;color:var(--mut-2);letter-spacing:.3px;padding:10px 12px 4px}
.gsr-it{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:11px;cursor:pointer;color:var(--ink)}
.gsr-it.on{background:var(--hover);box-shadow:inset 0 0 0 1px rgba(var(--p-rgb),.25)}
.gsr-ic{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:var(--soft);color:var(--mut);flex:none}
.gsr-it.on .gsr-ic{background:var(--p-100);color:var(--p)}
.gsr-tx{flex:1;min-width:0;display:flex;flex-direction:column}
.gsr-tx b{font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gsr-tx small{font-size:11.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gsr-ent{color:var(--mut-2);flex:none}
.gsr-ft{display:flex;gap:16px;padding:9px 16px;border-top:1px solid var(--line);font-size:11px;color:var(--mut)}
.gsr-ft span{display:inline-flex;align-items:center;gap:6px}
@media(max-width:600px){.gsr-scrim{padding-top:0;align-items:flex-start}.gsr{border-radius:0 0 var(--r-lg) var(--r-lg);max-height:88dvh}.gsr-ft span:last-child{display:none}}
`;
