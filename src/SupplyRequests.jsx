import{useState,useEffect,useMemo,useRef}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{buildSupplyRequestMsg,buildEscalationMsg,buildConsolidatedMsg,classifyOpenRequests,elapsedBoth}from"./fieldReport";

const ESC_TO="support@jibalalsahil.com,operations@jibalalsahil.com,syed.ali@jibalalsahil.com,ssp@sweater.sa";
const ESC_CC="abd.khrashy@sweater.sa,reem@sweater.sa,m.qurashi@sweater.sa";
const SUPPORT_WA="https://chat.whatsapp.com/K5ePnROKEcFD03UesTbeJV";
const STAT={
  open:["مفتوح","Open","#b54708","#fef3e2"],
  escalated:["مُصعّد","Escalated","#b42318","#feecea"],
  completed:["مكتمل","Completed","#087443","#e7f7ef"],
  cancelled:["مُلغى","Cancelled","#64748b","#eef0f3"],
};
const fmtDT=iso=>{const d=new Date(iso);if(isNaN(d))return"—";const p=n=>String(n).padStart(2,"0");return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;};

export default function SupplyRequests({opId,owner}){
  const[rows,setRows]=useState([]);const[loading,setLoading]=useState(true);
  const[filter,setFilter]=useState("all");const[msg,setMsg]=useState(null);
  const[now,setNow]=useState(()=>Date.now());
  const[share,setShare]=useState(null);const[copied,setCopied]=useState(false);
  const focusRef=useRef(typeof window!=="undefined"?window.__lastSupplyRef:null);

  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(t);},[]);
  useEffect(()=>{(async()=>{
    setLoading(true);
    let q=supabase.from("supply_requests").select("*").order("created_at",{ascending:false});
    if(opId&&opId!=="all")q=q.eq("operator_id",opId);
    const{data}=await q;setRows(data||[]);setLoading(false);
    if(typeof window!=="undefined")window.__lastSupplyRef=null;
  })();},[opId]);

  const shown=useMemo(()=>filter==="all"?rows:rows.filter(r=>r.status===filter),[rows,filter]);
  const kpis=useMemo(()=>({
    open:rows.filter(r=>r.status==="open").length,
    esc:rows.filter(r=>r.status==="escalated").length,
    done:rows.filter(r=>r.status==="completed").length,
    overdue:rows.filter(r=>r.status==="open"&&(now-new Date(r.created_at).getTime())>=(r.sla_hours||24)*3600e3).length,
  }),[rows,now]);

  const isOverdue=r=>r.status==="open"&&(now-new Date(r.created_at).getTime())>=(r.sla_hours||24)*3600e3;
  const remainMs=r=>((r.sla_hours||24)*3600e3)-(now-new Date(r.created_at).getTime());

  const openShare=(ref,text,kind)=>{setCopied(false);setShare({ref,text,kind});};
  const doCopy=async()=>{
    const text=share?.text||"";let ok=false;
    try{await navigator.clipboard.writeText(text);ok=true;}catch(_){
      try{const ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.top="0";ta.style.opacity="0";document.body.appendChild(ta);ta.focus();ta.select();ok=document.execCommand("copy");document.body.removeChild(ta);}catch(e){}
    }
    setCopied(ok);
  };
  const sendRequest=(r)=>{openShare(r.ref,buildSupplyRequestMsg(r),"send");};
  const escalate=async(r)=>{
    let row=r;
    if(r.status!=="escalated"){
      const{data}=await supabase.from("supply_requests").update({status:"escalated",escalated_at:new Date().toISOString()}).eq("id",r.id).select().single();
      if(data){setRows(p=>p.map(x=>x.id===r.id?data:x));row=data;}
    }
    openShare(row.ref,buildEscalationMsg(row),"esc");
  };
  const escalateEmail=(r)=>{
    const subject=`تصعيد طلب إمداد ${r.ref} — Supply Request Escalation`;
    const body=buildEscalationMsg(r);
    const url=`mailto:${ESC_TO}?cc=${ESC_CC}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if(r.status!=="escalated")supabase.from("supply_requests").update({status:"escalated",escalated_at:new Date().toISOString()}).eq("id",r.id).select().single().then(({data})=>{if(data)setRows(p=>p.map(x=>x.id===r.id?data:x));});
    try{window.location.href=url;}catch(_){}
  };
  const complete=async(r)=>{
    const note=prompt("ملاحظة الاكتمال (اختياري) — ما الذي تم توفيره؟","تم التوفير")||null;
    const{data}=await supabase.from("supply_requests").update({status:"completed",completed_at:new Date().toISOString(),completion_note:note}).eq("id",r.id).select().single();
    if(data)setRows(p=>p.map(x=>x.id===r.id?data:x));
    setMsg({ok:true,t:`تم إغلاق الطلب ${r.ref} كمكتمل`});
  };
  const del=async(r)=>{if(!confirm("حذف هذا الطلب؟"))return;const{error}=await supabase.from("supply_requests").delete().eq("id",r.id);if(!error)setRows(p=>p.filter(x=>x.id!==r.id));};

  const openReqs=rows.filter(r=>r.status!=="completed"&&r.status!=="cancelled");
  const bulkGroups=openReqs.length?classifyOpenRequests(openReqs):[];
  const bulkMats=bulkGroups.reduce((a,g)=>a+g.materials.length,0);
  const sendBulk=()=>openShare('مجمّع',buildConsolidatedMsg(openReqs,new Date()),'bulk');

  if(loading)return<div className="dw-skel" style={{height:280}}/>;

  return(<div className="sq">
    <style>{CSS}</style>
    {msg&&<div className={"sq-msg "+(msg.ok?"ok":"err")}>{msg.t}</div>}
    <div className="sq-kpis">
      <K ic="inbox" c="#b54708" bg="#fef3e2" t="مفتوحة" v={kpis.open}/>
      <K ic="alert" c="#b42318" bg="#feecea" t="متجاوزة المهلة" v={kpis.overdue}/>
      <K ic="send" c="#175cd3" bg="#eff6ff" t="مُصعّدة" v={kpis.esc}/>
      <K ic="check" c="#087443" bg="#e7f7ef" t="مكتملة" v={kpis.done}/>
    </div>
    <div className="sq-hint"><Icon n="alert" s={13}/> تُنشأ الطلبات آلياً عند إرسال نواقص جولة ميدانية. القناة الأساسية واتساب مركز الدعم؛ بعد {`< 24 ساعة`} بلا حل يظهر «تصعيد» (واتساب/إيميل) يشير لرقم الطلب وتاريخه. اضغط «اكتمال» عند التوفير.</div>

    {openReqs.length>0&&<div className="sq-bulk">
      <div className="sq-bulk-l">
        <div className="sq-bulk-t"><Icon n="bucket" s={15}/> طلب إمداد مجمّع</div>
        <div className="sq-bulk-s">يفرز ويصنّف نواقص {openReqs.length} طلب مفتوح في <b>{bulkMats}</b> مادة عبر {bulkGroups.length} فئة، ويجمعها في رسالة واحدة تُرسل حسب الحاجة.</div>
      </div>
      <button className="sq-b wa sq-bulk-b" onClick={sendBulk}><Icon n="send" s={14}/> بناء الطلب المجمّع</button>
    </div>}

    <div className="sq-tabs">
      {[["all","الكل"],["open","مفتوحة"],["escalated","مُصعّدة"],["completed","مكتملة"]].map(([k,l])=>(
        <button key={k} className={"sq-tab"+(filter===k?" on":"")} onClick={()=>setFilter(k)}>{l}</button>))}
    </div>

    {shown.length===0?<div className="sq-empty"><div className="sq-empty-ic"><Icon n="bucket" s={30}/></div><h3>لا طلبات إمداد</h3><p>عند إرسال نواقص من الجولات الميدانية سيظهر هنا سجل الطلبات مع عدّاد المهلة والتصعيد.</p></div>:
    shown.map(r=>{const st=STAT[r.status]||STAT.open;const over=isOverdue(r);const rem=remainMs(r);
      const el=elapsedBoth(r.created_at,r.completed_at?new Date(r.completed_at):new Date());
      const hi=focusRef.current&&r.ref===focusRef.current;
      return(
      <div className={"sq-card"+(over?" over":"")+(hi?" hi":"")} key={r.id} style={{borderInlineStartColor:st[2]}}>
        <div className="sq-top">
          <div>
            <div className="sq-ref">{r.ref}<span className="sq-st" style={{background:st[3],color:st[2]}}>{st[0]} · {st[1]}</span></div>
            <div className="sq-sub">{r.biker_name||"—"} · #{r.sweater_id||"—"} · {r.requesting_dept||"التشغيل"}</div>
          </div>
        </div>
        <div className="sq-times">
          <span>🕒 رفع الطلب · Submitted: <b>{fmtDT(r.created_at)}</b></span>
          {r.status==="completed"?<span className="ok">✅ اكتمل خلال · Closed in: <b>{el.ar}</b></span>:
           <span className={over?"bad":""}>{over?"⏱️ تجاوز المهلة منذ · Overdue by: ":"⏳ متبقٍّ للمهلة · SLA left: "}<b>{over?el.ar:fmtRemain(rem)}</b></span>}
          {r.escalated_at&&<span className="bad">🔴 صُعّد · Escalated: <b>{fmtDT(r.escalated_at)}</b></span>}
        </div>
        <div className="sq-items">
          {(r.items||[]).map((it,i)=>(
            <div className="sq-item" key={i}>
              <span className="sq-in">#{it.n}</span>
              <div className="sq-itxt"><div className="sq-iar">{it.ar}{it.parts_ar?<span className="sq-part"> 🔧 {it.parts_ar}</span>:null}</div><div className="sq-icat">{it.type} · {it.category} — <b>{it.status_ar}</b>{it.note?` · ${it.note}`:""}</div></div>
            </div>))}
        </div>
        {r.completion_note&&<div className="sq-cnote">✅ {r.completion_note}</div>}
        <div className="sq-actions">
          <button className="sq-b wa" onClick={()=>sendRequest(r)}><Icon n="send" s={13}/> رسالة الطلب</button>
          {r.status!=="completed"&&(over||r.status==="escalated")&&<>
            <button className="sq-b esc" onClick={()=>escalate(r)}><Icon n="alert" s={13}/> تصعيد واتساب</button>
            <button className="sq-b escm" onClick={()=>escalateEmail(r)}><Icon n="send" s={13}/> تصعيد إيميل</button>
          </>}
          {r.status!=="completed"&&<button className="sq-b done" onClick={()=>complete(r)}><Icon n="check" s={13}/> اكتمال</button>}
          <div style={{flex:1}}/>
          {owner&&<button className="sq-b del" onClick={()=>del(r)}><Icon n="trash" s={12}/></button>}
        </div>
      </div>);})}

    {share&&<div className="sq-ov" onClick={()=>setShare(null)}>
      <div className="sq-modal" onClick={e=>e.stopPropagation()}>
        <div className="sq-mh"><b>{share.kind==="esc"?"رسالة تصعيد":share.kind==="bulk"?"طلب إمداد مجمّع":"رسالة الطلب"} · {share.ref}</b><button className="sq-x" onClick={()=>setShare(null)}><Icon n="x" s={15}/></button></div>
        <div className="sq-mnote"><Icon n="alert" s={13}/> واتساب لا يسمح بتعبئة النص تلقائياً داخل المجموعة. الخطوات: <b>١) انسخ الرسالة</b> ← <b>٢) افتح المجموعة</b> ← <b>٣) الصقها وأرسل</b>.</div>
        <textarea className="sq-ta" readOnly value={share.text} onFocus={e=>e.target.select()} dir="rtl"/>
        <div className="sq-mact">
          <button className={"sq-b wa"+(copied?" ok2":"")} onClick={doCopy}><Icon n={copied?"check":"doc"} s={14}/> {copied?"تم النسخ ✓":"نسخ الرسالة"}</button>
          <button className="sq-b open" onClick={()=>{try{window.open(SUPPORT_WA,"_blank");}catch(_){}}}><Icon n="send" s={14}/> فتح المجموعة</button>
        </div>
      </div>
    </div>}
  </div>);
}
function fmtRemain(ms){if(ms<=0)return"انتهت";const h=Math.floor(ms/3600e3),m=Math.floor(ms%3600e3/6e4);return h>0?`${h} ساعة و${m} دقيقة`:`${m} دقيقة`;}
function K({ic,c,bg,t,v}){return(<div className="sq-kpi"><span className="sq-ki" style={{background:bg,color:c}}><Icon n={ic} s={17}/></span><div><div className="sq-kv">{v}</div><div className="sq-kl">{t}</div></div></div>);}

const CSS=`
.sq{--b:#E8712B}
.sq-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:12px}
.sq-msg.ok{background:#e7f7ef;color:#087443}.sq-msg.err{background:#feecea;color:#b42318}
.sq-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px}
.sq-kpi{background:#fff;border:1px solid #eceef1;border-radius:15px;padding:13px;display:flex;align-items:center;gap:11px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.sq-ki{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.sq-kv{font-size:19px;font-weight:800;letter-spacing:-.5px}.sq-kl{font-size:11px;color:#64748b;font-weight:600}
.sq-hint{display:flex;align-items:flex-start;gap:7px;background:#fffbeb;border:1px solid #fde9c8;color:#92600e;font-size:11.5px;font-weight:600;border-radius:11px;padding:10px 12px;margin-bottom:12px;line-height:1.6}
.sq-bulk{display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap;background:linear-gradient(135deg,#0f2a43,#1a3f5f);border-radius:13px;padding:12px 15px;margin-bottom:12px;box-shadow:0 1px 2px rgba(16,24,40,.08)}
.sq-bulk-t{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:#fff}
.sq-bulk-s{font-size:11.5px;color:#cbd8e6;font-weight:600;line-height:1.6;margin-top:4px;max-width:520px}
.sq-bulk-s b{color:#fff}
.sq-bulk-b{flex:none;background:#fff;border-color:#fff;color:#0f2a43}
.sq-tabs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}
.sq-tab{padding:7px 14px;border-radius:20px;border:1px solid #e6e9ee;background:#fff;color:#475569;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer}
.sq-tab.on{background:#0f172a;color:#fff;border-color:#0f172a}
.sq-card{background:#fff;border:1px solid #eceef1;border-inline-start:3px solid #ccc;border-radius:14px;padding:13px 15px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.sq-card.over{background:#fffdf9}
.sq-card.hi{box-shadow:0 0 0 3px rgba(232,113,43,.25)}
.sq-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.sq-ref{font-size:14px;font-weight:800;color:#0f172a;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sq-st{font-size:10px;font-weight:800;padding:2px 9px;border-radius:20px}
.sq-sub{font-size:11.5px;color:#64748b;margin-top:3px}
.sq-times{display:flex;flex-wrap:wrap;gap:10px;margin-top:9px;font-size:11px;color:#64748b}
.sq-times b{color:#0f172a}
.sq-times .bad b,.sq-times .bad{color:#b42318}
.sq-times .ok b{color:#087443}
.sq-items{margin-top:10px;display:flex;flex-direction:column;gap:6px}
.sq-item{display:flex;gap:8px;align-items:flex-start;background:#fafbfc;border:1px solid #f1f3f5;border-radius:9px;padding:7px 9px}
.sq-in{font-size:11px;font-weight:800;color:#94a3b8;flex:none}
.sq-iar{font-size:12px;font-weight:700;color:#0f172a}
.sq-part{font-size:11px;color:#b54708;font-weight:800}
.sq-icat{font-size:10.5px;color:#64748b;margin-top:1px}
.sq-cnote{margin-top:9px;font-size:11.5px;color:#087443;background:#e7f7ef;border-radius:8px;padding:7px 10px;font-weight:700}
.sq-actions{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-top:11px}
.sq-b{display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:9px;border:1px solid #e6e9ee;background:#fff;color:#334155;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer}
.sq-b.wa{border-color:#b7e4cd;background:#effaf3;color:#087443}
.sq-b.esc{border-color:#f7bfba;background:#fff5f4;color:#b42318}
.sq-b.escm{border-color:#fbdba7;background:#fffaf0;color:#b54708}
.sq-b.done{border-color:#b7e4cd;background:#087443;color:#fff}
.sq-b.del{border-color:#f0d5d2;color:#b42318}
.sq-empty{background:#fff;border:1px dashed #e6e9ee;border-radius:16px;padding:40px 24px;text-align:center}
.sq-empty-ic{width:64px;height:64px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#fff2e8,#ffe2cc);color:var(--b)}
.sq-empty h3{font-size:16px;margin:0 0 8px}.sq-empty p{color:#64748b;font-size:12.5px;max-width:440px;margin:0 auto;line-height:1.7}
.sq-b.open{border-color:#b7e4cd;background:#effaf3;color:#087443}
.sq-b.wa.ok2{background:#087443;color:#fff;border-color:#087443}
.sq-ov{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px}
.sq-modal{background:#fff;border-radius:18px;width:min(520px,100%);max-height:88vh;overflow:auto;box-shadow:0 20px 60px rgba(16,24,40,.35);padding:16px}
.sq-mh{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px;color:#0f172a;margin-bottom:10px}
.sq-x{width:28px;height:28px;border-radius:8px;border:1px solid #e6e9ee;background:#fff;color:#475569;cursor:pointer;display:flex;align-items:center;justify-content:center}
.sq-mnote{display:flex;align-items:flex-start;gap:7px;background:#fffbeb;border:1px solid #fde9c8;color:#92600e;font-size:11.5px;font-weight:600;border-radius:11px;padding:10px 12px;margin-bottom:11px;line-height:1.7}
.sq-ta{width:100%;min-height:230px;border:1px solid #e6e9ee;border-radius:12px;padding:11px;font-family:inherit;font-size:12px;line-height:1.7;color:#0f172a;background:#fafbfc;resize:vertical;white-space:pre-wrap}
.sq-mact{display:flex;gap:9px;margin-top:12px}
.sq-mact .sq-b{flex:1;justify-content:center;padding:11px;font-size:13px}
@media(max-width:720px){.sq-kpis{grid-template-columns:1fr 1fr}}
`;
