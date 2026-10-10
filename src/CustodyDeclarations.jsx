// صفحة «العُهد» — إقرارات العهدة من بوابة البايكر: صورة كل صنف وحالته وملاحظته، وشارة «يحتاج استبدال» مع رابط لطلب الإمداد.
import{useState,useEffect}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{signedUrls}from"./storageUrl";
import{groupByBiker,isBad}from"./custodyDeclare";

const COND={good:["جيدة","ok"],fair:["متوسطة","info"],poor:["سيئة","warn"],damaged:["تالفة","bad"]};
const fmtDT=iso=>{const d=new Date(iso);if(isNaN(d))return"—";const p=n=>String(n).padStart(2,"0");return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;};

export default function CustodyDeclarations({opId,onGo}){
  const[rows,setRows]=useState(null);const[urls,setUrls]=useState({});const[open,setOpen]=useState(true);const[zoom,setZoom]=useState(null);
  useEffect(()=>{(async()=>{
    let q=supabase.from("biker_assets").select("id,biker_employee_id,biker_name,items,notes,status,created_at").order("created_at",{ascending:false}).limit(60);
    if(opId&&opId!=="all")q=q.or("operator_id.eq."+opId+",operator_id.is.null");
    const{data}=await q;const list=data||[];setRows(list);
    // الصور في field-evidence: رابط موقّع إن أمكن، وإلا الرابط المحفوظ كما هو
    const all=list.flatMap(r=>(Array.isArray(r.items)?r.items:[]).map(x=>x&&x.photo).filter(Boolean));
    if(all.length)setUrls(await signedUrls(all).catch(()=>({})));
  })();},[opId]);
  const goReq=ref=>{if(typeof window!=="undefined")window.__lastSupplyRef=ref;if(onGo)onGo("supply_requests");};
  if(rows===null)return null;
  const groups=groupByBiker(rows);
  const needs=rows.reduce((a,r)=>a+(Array.isArray(r.items)?r.items:[]).filter(x=>x&&isBad(x.condition)).length,0);

  return(<div className="cd">
    <style>{CSS}</style>
    <button className="cd-h" onClick={()=>setOpen(!open)} aria-expanded={open}>
      <Icon n="key" s={15}/><b>إقرارات العهدة من بوابة البايكر</b>
      <span className="cd-c">{groups.length} بايكر · {rows.length} إقرار</span>
      {needs>0&&<span className="cd-b bad">{needs} صنف يحتاج استبدالاً</span>}
      <span aria-hidden="true">{open?"▴":"▾"}</span>
    </button>
    {open&&(groups.length===0?<div className="cd-empty">لا إقرارات بعد — يسجّلها البايكر من تبويب «العهدة» في بوابته.</div>:
      groups.map(g=><div className="cd-g" key={g.biker_employee_id||g.biker_name}>
        <div className="cd-gn">{g.biker_name||"—"} <span>#{g.biker_employee_id||"—"}</span></div>
        {g.rows.map((r,ri)=>{const its=Array.isArray(r.items)?r.items:[];return(
          <div className={"cd-r"+(ri>0?" old":"")} key={r.id}>
            <div className="cd-rm">{ri===0?"آخر إقرار":"إقرار سابق"} · {fmtDT(r.created_at)} · {its.length} صنف{r.notes?` · ${r.notes}`:""}</div>
            <div className="cd-its">{its.map((x,i)=>{const c=COND[x.condition]||[x.condition||"—","info"];const src=x.photo?(urls[x.photo]||x.photo):null;const bad=isBad(x.condition);return(
              <div className={"cd-it"+(bad?" bad":"")} key={i}>
                {src?<button className="cd-ph" onClick={()=>setZoom(src)} aria-label={"صورة "+(x.name_ar||"")}><img src={src} alt="" loading="lazy"/></button>:<div className="cd-ph none">بلا صورة</div>}
                <div className="cd-tx">
                  <div className="cd-nm">{x.name_ar||x.key}{Number(x.qty)>1?` ×${x.qty}`:""}</div>
                  <div className="cd-st"><span className={"cd-b "+c[1]}>{c[0]}</span>
                    {bad&&<span className="cd-b bad">يحتاج استبدال</span>}</div>
                  {x.note&&<div className="cd-nt">{x.note}</div>}
                  {bad&&(x.replace_ref?<button className="cd-ln" onClick={()=>goReq(x.replace_ref)}><Icon n="link" s={12}/> طلب {x.replace_ref}</button>
                    :<div className="cd-nt mut">لا طلب استبدال مرتبط بعد</div>)}
                </div>
              </div>);})}</div>
          </div>);})}
      </div>))}
    {zoom&&<div className="cd-zoom" onClick={()=>setZoom(null)}><img src={zoom} alt=""/></div>}
  </div>);
}

const CSS=`
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
