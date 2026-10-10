// صفحة «العُهد» — تصريحات العهدة من بوابة البايكر: طابور الاعتماد (تسجيل أول/تحديث حالة) ثم السجل.
// الاعتماد والرفض عبر custody_review (docs/sql/custody_lifecycle.sql): ربط/إنشاء القطع وطلب الاستبدال في معاملة واحدة.
import{useState,useEffect}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{signedUrls}from"./storageUrl";
import{groupByBiker,isBad}from"./custodyDeclare";
import{isPending,kindOf,baselineLines}from"./custodyLifecycle";
import{useToast}from"./ui";

const COND={good:["جيدة","ok"],fair:["متوسطة","info"],poor:["سيئة","warn"],damaged:["تالفة","bad"]};
const fmtDT=iso=>{const d=new Date(iso);if(isNaN(d))return"—";const p=n=>String(n).padStart(2,"0");return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;};

const riyadhDate=iso=>new Date(iso).toLocaleDateString("en-CA",{timeZone:"Asia/Riyadh"});
const ST={declared:["بانتظار الاعتماد","warn"],submitted:["بانتظار الاعتماد","warn"],approved:["معتمد","ok"],rejected:["مرفوض","bad"]};

export default function CustodyDeclarations({opId,onGo,onChanged}){
  const[rows,setRows]=useState(null);const[assets,setAssets]=useState([]);const[urls,setUrls]=useState({});const[open,setOpen]=useState(true);const[zoom,setZoom]=useState(null);const[rev,setRev]=useState(0);
  useEffect(()=>{(async()=>{
    let q=supabase.from("biker_assets").select("id,biker_employee_id,biker_name,items,notes,status,kind,asset_id,reject_reason,reviewed_at,request_id,created_at").order("created_at",{ascending:false}).limit(120);
    if(opId&&opId!=="all")q=q.or("operator_id.eq."+opId+",operator_id.is.null");
    const[{data},ca]=await Promise.all([q,supabase.from("custody_assets").select("id,sweater_id,name,name_en,start_date,end_date,life_months,status")]);
    const list=data||[];setRows(list);setAssets(ca.data||[]);
    // الصور في field-evidence: رابط موقّع إن أمكن، وإلا الرابط المحفوظ كما هو
    const all=list.flatMap(r=>(Array.isArray(r.items)?r.items:[]).map(x=>x&&x.photo).filter(Boolean));
    if(all.length)setUrls(await signedUrls(all).catch(()=>({})));
  })();},[opId,rev]);
  const goReq=ref=>{if(typeof window!=="undefined")window.__lastSupplyRef=ref;if(onGo)onGo("supply_requests");};
  if(rows===null)return null;
  const groups=groupByBiker(rows);
  const pending=rows.filter(r=>isPending(r.status)).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
  const done=()=>{setRev(v=>v+1);if(onChanged)onChanged();};

  return(<div className="cd">
    <style>{CSS}</style>
    <button className="cd-h" onClick={()=>setOpen(!open)} aria-expanded={open}>
      <Icon n="key" s={15}/><b>إقرارات العهدة من بوابة البايكر</b>
      <span className="cd-c">{groups.length} بايكر · {rows.length} تصريح</span>
      {pending.length>0&&<span className="cd-b warn">{pending.length} بانتظار الاعتماد</span>}
      <span aria-hidden="true">{open?"▴":"▾"}</span>
    </button>
    {open&&pending.length>0&&<div className="cd-q">{pending.map(r=><Review key={r.id} r={r} assets={assets.filter(a=>String(a.sweater_id||"").trim()===String(r.biker_employee_id||"").trim())} urls={urls} onZoom={setZoom} onDone={done}/>)}</div>}
    {open&&(groups.length===0?<div className="cd-empty">لا إقرارات بعد — يسجّلها البايكر من تبويب «العهدة» في بوابته.</div>:
      groups.map(g=><div className="cd-g" key={g.biker_employee_id||g.biker_name}>
        <div className="cd-gn">{g.biker_name||"—"} <span>#{g.biker_employee_id||"—"}</span></div>
        {g.rows.map((r,ri)=>{const its=Array.isArray(r.items)?r.items:[];return(
          <div className={"cd-r"+(ri>0?" old":"")} key={r.id}>
            <div className="cd-rm">{kindOf(r)==="update"?"تحديث حالة":"تسجيل أول"} · {fmtDT(r.created_at)} · {its.length} صنف <span className={"cd-b "+(ST[r.status]||["","info"])[1]}>{(ST[r.status]||[r.status])[0]}</span>{r.reject_reason?` · السبب: ${r.reject_reason}`:""}{r.notes?` · ${r.notes}`:""}</div>
            <div className="cd-its">{its.map((x,i)=>{const c=COND[x.condition]||[x.condition||"—","info"];const src=x.photo?(urls[x.photo]||x.photo):null;const bad=isBad(x.condition);return(
              <div className={"cd-it"+(bad?" bad":"")} key={i}>
                {src?<button className="cd-ph" onClick={()=>setZoom(src)} aria-label={"صورة "+(x.name_ar||"")}><img src={src} alt="" loading="lazy"/></button>:<div className="cd-ph none">بلا صورة</div>}
                <div className="cd-tx">
                  <div className="cd-nm">{x.name_ar||x.key}{Number(x.qty)>1?` ×${x.qty}`:""}</div>
                  <div className="cd-st"><span className={"cd-b "+c[1]}>{c[0]}</span>
                    {bad&&<span className="cd-b bad">يحتاج استبدال</span>}</div>
                  {x.note&&<div className="cd-nt">{x.note}</div>}
                  {bad&&(x.replace_ref?<button className="cd-ln" onClick={()=>goReq(x.replace_ref)}><Icon n="link" s={12}/> طلب {x.replace_ref}</button>
                    :r.request_id&&r.status==="approved"?<button className="cd-ln" onClick={()=>goReq(null)}><Icon n="link" s={12}/> رُفع طلب استبدال عند الاعتماد</button>
                    :<div className="cd-nt mut">{isPending(r.status)?"يُرفع طلب الاستبدال عند الاعتماد":"لا طلب استبدال مرتبط"}</div>)}
                </div>
              </div>);})}</div>
          </div>);})}
      </div>))}
    {zoom&&<div className="cd-zoom" onClick={()=>setZoom(null)}><img src={zoom} alt=""/></div>}
  </div>);
}

// بطاقة اعتماد/رفض تصريح معلّق
function Review({r,assets,urls,onZoom,onDone}){
  const toast=useToast();
  const its=Array.isArray(r.items)?r.items:[];const isUpd=kindOf(r)==="update";
  const[start,setStart]=useState(riyadhDate(r.created_at));const[reason,setReason]=useState("");const[rej,setRej]=useState(false);const[busy,setBusy]=useState(false);const[err,setErr]=useState(null);
  const{lines,unmapped}=isUpd?{lines:[],unmapped:[]}:baselineLines(its,assets,start);
  const piece=isUpd?assets.find(a=>a.id===r.asset_id):null;
  const run=async(approve)=>{
    setErr(null);
    if(!approve&&!reason.trim()){setErr("اكتب سبب الرفض — يظهر للبايكر.");return;}
    setBusy(true);
    const{data,error}=await supabase.rpc("custody_review",{p_id:r.id,p_approve:approve,p_reason:approve?null:reason.trim(),p_start:isUpd?null:start,p_lines:lines});
    setBusy(false);
    if(error){setErr(error.message);return;}
    if(approve)toast.ok(data&&data.ref?`اعتُمد ✓ — رُفع طلب استبدال ${data.ref}`:"اعتُمد ✓",undefined,data&&data.ref?7000:undefined);else toast.ok("رُفض وأُبلغ البايكر بالسبب");
    if(data&&data.ref&&typeof window!=="undefined")window.__lastSupplyRef=data.ref;
    onDone();
  };
  return(<div className="cd-rv">
    <div className="cd-gn">{r.biker_name||"—"} <span>#{r.biker_employee_id||"—"} · {isUpd?"تحديث حالة":"تسجيل أول"} · {fmtDT(r.created_at)}</span></div>
    {isUpd&&<div className="cd-nt">القطعة: <b>{piece?piece.name:"—"}</b>{piece?` · بدأت ${piece.start_date}`:""}</div>}
    <div className="cd-its">{its.map((x,i)=>{const c=COND[x.condition]||[x.condition||"—","info"];const src=x.photo?(urls[x.photo]||x.photo):null;return(
      <div className={"cd-it"+(isBad(x.condition)?" bad":"")} key={i}>
        {src?<button className="cd-ph" onClick={()=>onZoom(src)} aria-label={"صورة "+(x.name_ar||"")}><img src={src} alt="" loading="lazy"/></button>:<div className="cd-ph none">بلا صورة</div>}
        <div className="cd-tx"><div className="cd-nm">{x.name_ar||x.key}{Number(x.qty)>1?` ×${x.qty}`:""}</div>
          <div className="cd-st"><span className={"cd-b "+c[1]}>{c[0]}</span>{isBad(x.condition)&&<span className="cd-b bad">يُطلب استبداله عند الاعتماد</span>}</div>
          {x.note&&<div className="cd-nt">{x.note}</div>}</div>
      </div>);})}</div>
    {!isUpd&&<div className="cd-lines">
      <label className="cd-dt">تاريخ بداية القطع الجديدة <input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
      <div className="cd-nt mut">القطع الموجودة من الجولات تُربط ولا يتغيّر تاريخها.</div>
      <ul>{lines.map(l=><li key={l.catalog_key}><b>{l.name}</b> — {l.asset_id?<span className="cd-b info">ربط بقطعة قائمة · {l.start_date}</span>:<span className="cd-b ok">قطعة جديدة · {l.start_date} ← {l.end_date}</span>}</li>)}</ul>
      {unmapped.length>0&&<div className="cd-err">أصناف بلا مقابل في الكتالوج: {unmapped.join("، ")} — لا يمكن الاعتماد.</div>}
    </div>}
    {rej&&<textarea className="cd-rs" rows={2} value={reason} onChange={e=>setReason(e.target.value)} placeholder="سبب الرفض (يظهر للبايكر)…"/>}
    {err&&<div className="cd-err">{err}</div>}
    <div className="cd-act">
      {!rej&&<button className="cd-bt ok" disabled={busy||unmapped.length>0} onClick={()=>run(true)}><Icon n="check" s={13}/> اعتماد</button>}
      {!rej?<button className="cd-bt bad" disabled={busy} onClick={()=>setRej(true)}>رفض…</button>
        :<><button className="cd-bt bad" disabled={busy} onClick={()=>run(false)}>تأكيد الرفض</button><button className="cd-bt" disabled={busy} onClick={()=>{setRej(false);setReason("");setErr(null);}}>إلغاء</button></>}
    </div>
  </div>);
}

const CSS=`
.cd-q{display:flex;flex-direction:column;gap:10px;margin-top:10px}
.cd-rv{background:var(--glass);border:1.5px solid color-mix(in srgb,var(--warn) 50%,transparent);border-radius:13px;padding:11px 13px;min-width:0}
.cd-lines{margin-top:9px;font-size:12px;color:var(--ink-2)}.cd-lines ul{margin:6px 0 0;padding-inline-start:18px;display:flex;flex-direction:column;gap:4px}
.cd-dt{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-weight:800;font-size:12px}.cd-dt input{font-family:inherit;padding:5px 8px;border-radius:8px;border:1px solid var(--line-2);background:var(--glass-2);color:var(--ink)}
.cd-rs{width:100%;box-sizing:border-box;margin-top:9px;font-family:inherit;font-size:12.5px;padding:8px 10px;border-radius:10px;border:1px solid var(--line-2);background:var(--glass-2);color:var(--ink)}
.cd-err{margin-top:7px;color:var(--bad-ink);background:var(--bad-bg);border-radius:9px;padding:6px 10px;font-size:12px;font-weight:700;overflow-wrap:anywhere}
.cd-act{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
.cd-bt{padding:7px 13px;border-radius:10px;border:1px solid var(--line-2);background:var(--glass-2);color:var(--ink);font-family:inherit;font-size:12px;font-weight:800;cursor:pointer}
.cd-bt.ok{background:var(--ok-bg);color:var(--ok-ink)}.cd-bt.bad{background:var(--bad-bg);color:var(--bad-ink)}.cd-bt:disabled{opacity:.5;cursor:default}
.cd{margin-bottom:14px}
.cd-h{width:100%;display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:13px;padding:11px 14px;color:var(--ink);font-family:inherit;font-size:13px;cursor:pointer;text-align:start;box-shadow:var(--shadow)}
.cd-h b{flex:1;min-width:0}
.cd-c{font-size:11px;color:var(--mut);font-weight:700}
.cd-b{font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;white-space:nowrap}
.cd-b.ok{background:var(--ok-bg);color:var(--ok-ink)}.cd-b.info{background:var(--info-bg);color:var(--info-ink)}
.cd-b.warn{background:var(--warn-bg);color:var(--warn-ink)}.cd-b.bad{background:var(--bad-bg);color:var(--bad-ink)}
.cd-empty{padding:16px;color:var(--mut);font-size:12.5px;text-align:center}
.cd-g{margin-top:10px;background:var(--glass);border:1px solid var(--line);border-radius:13px;padding:11px 13px}
.cd-gn{font-weight:800;font-size:13.5px;color:var(--ink);margin-bottom:6px}.cd-gn span{color:var(--mut);font-weight:700;font-size:11.5px}
.cd-r{padding-top:6px}.cd-r.old{opacity:.8;border-top:1px dashed var(--line);margin-top:8px}
.cd-rm{font-size:11px;color:var(--mut);margin-bottom:7px}
.cd-its{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.cd-it{display:flex;gap:9px;align-items:flex-start;background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:8px;min-width:0}
.cd-it.bad{border-color:color-mix(in srgb,var(--bad) 45%,transparent);background:var(--bad-bg)}
.cd-ph{flex:none;width:58px;height:58px;border-radius:8px;overflow:hidden;border:1px solid var(--line);padding:0;background:var(--glass);cursor:zoom-in}
.cd-ph img{width:100%;height:100%;object-fit:cover;display:block}
.cd-ph.none{display:flex;align-items:center;justify-content:center;font-size:9.5px;color:var(--mut);cursor:default;text-align:center}
.cd-tx{min-width:0;flex:1}
.cd-nm{font-weight:800;font-size:12.5px;color:var(--ink);overflow-wrap:anywhere}
.cd-st{display:flex;gap:5px;flex-wrap:wrap;margin:4px 0}
.cd-nt{font-size:11.5px;color:var(--ink-2);line-height:1.6;overflow-wrap:anywhere}.cd-nt.mut{color:var(--mut)}
.cd-ln{display:inline-flex;align-items:center;gap:4px;margin-top:4px;padding:3px 8px;border-radius:8px;border:1px solid var(--line-2);background:var(--glass-2);color:var(--b);font-family:inherit;font-size:11px;font-weight:800;cursor:pointer;max-width:100%;overflow-wrap:anywhere}
.cd-zoom{position:fixed;inset:0;background:rgba(15,23,42,.75);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;cursor:zoom-out}
.cd-zoom img{max-width:100%;max-height:100%;border-radius:12px}
`;
