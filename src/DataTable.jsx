// جدول بيانات قابل لإعادة الاستخدام: فرز + بحث/فلترة + ترقيم صفحات، RTL، وبطاقات على الجوال.
// <DataTable caption="ترتيب البايكرز" rows={list} rowKey={r=>r.id} columns={[
//   {k:"name",label:"الاسم",value:r=>r.name,render:r=><b>{r.name}</b>,search:true},
//   {k:"washes",label:"الغسلات",num:true},
// ]} initialSort={{k:"washes",dir:-1}} pageSize={15} onRowClick={r=>…} filters={[{k:"team",label:"الفريق",options:[…]}]}/>
import{useState,useMemo,useEffect,useRef}from"react";
import Icon from"./Icon";
import{EmptyState}from"./ui";

const val=(c,r)=>c.value?c.value(r):r[c.k];
const cmp=(a,b)=>{const an=typeof a==="number"||(a!==""&&a!=null&&!isNaN(a)),bn=typeof b==="number"||(b!==""&&b!=null&&!isNaN(b));
  if(a==null||a==="")return 1;if(b==null||b==="")return -1;
  return an&&bn?Number(a)-Number(b):String(a).localeCompare(String(b),"ar");};

export default function DataTable({columns,rows,rowKey,caption,initialSort,pageSize=15,onRowClick,filters=[],searchable=true,searchPlaceholder="بحث…",empty,compact,toolbar}){
  const[sort,setSort]=useState(initialSort||null);
  const[q,setQ]=useState("");const[f,setF]=useState({});const[page,setPage]=useState(0);
  const topRef=useRef(null);
  const searchCols=columns.filter(c=>c.search);
  const data=useMemo(()=>{
    let out=rows||[];
    const t=q.trim().toLowerCase();
    if(t&&searchCols.length)out=out.filter(r=>searchCols.some(c=>String(val(c,r)??"").toLowerCase().includes(t)));
    filters.forEach(fl=>{const v=f[fl.k];if(v!==undefined&&v!=="")out=out.filter(r=>String(fl.value?fl.value(r):r[fl.k])===String(v));});
    if(sort){const c=columns.find(x=>x.k===sort.k);if(c){out=out.slice().sort((a,b)=>{const va=val(c,a),vb=val(c,b);if(va==null||va==="")return 1;if(vb==null||vb==="")return -1;return sort.dir*cmp(va,vb);});}}
    return out;
  },[rows,q,f,sort,columns,filters,searchCols]);
  const pages=Math.max(1,Math.ceil(data.length/pageSize));
  useEffect(()=>{if(page>pages-1)setPage(0);},[pages,page]);
  const view=data.slice(page*pageSize,(page+1)*pageSize);
  const toggle=c=>{if(c.sortable===false)return;setSort(s=>s&&s.k===c.k?{k:c.k,dir:-s.dir}:{k:c.k,dir:c.num?-1:1});setPage(0);};
  const go=p=>{setPage(p);topRef.current&&topRef.current.scrollIntoView({block:"nearest",behavior:"smooth"});};
  const ariaSort=c=>sort&&sort.k===c.k?(sort.dir>0?"ascending":"descending"):(c.sortable===false?undefined:"none");
  const cell=(c,r)=>c.render?c.render(r):(val(c,r)??"—");

  return(<div className={"g-dt"+(compact?" compact":"")} ref={topRef}>
    {(searchable&&searchCols.length>0)||filters.length||toolbar?<div className="g-dt-bar">
      {searchable&&searchCols.length>0&&<label className="g-dt-q"><Icon n="search" s={15}/><input className="g-input" type="search" value={q} onChange={e=>{setQ(e.target.value);setPage(0);}} placeholder={searchPlaceholder} aria-label={searchPlaceholder}/></label>}
      {filters.map(fl=><select key={fl.k} className="g-select g-dt-f" value={f[fl.k]??""} onChange={e=>{setF(x=>({...x,[fl.k]:e.target.value}));setPage(0);}} aria-label={fl.label}>
        <option value="">{fl.label}: الكل</option>{fl.options.map(o=>typeof o==="object"?<option key={o.v} value={o.v}>{o.l}</option>:<option key={o} value={o}>{o}</option>)}</select>)}
      {toolbar}
      <span className="g-dt-n" aria-live="polite">{data.length} نتيجة</span>
    </div>:null}
    {data.length===0?(empty||<EmptyState compact variant="ring" title="لا نتائج" text={q?"جرّب كلمة بحث أخرى أو أزل الفلاتر.":undefined}/>):<>
    <div className="g-dt-wrap">
      <table className="g-tbl g-dt-t">
        {caption&&<caption className="g-sr">{caption}</caption>}
        <thead><tr>{columns.map(c=><th key={c.k} scope="col" aria-sort={ariaSort(c)} className={(c.num?"num ":"")+(c.sortable===false?"":"g-dt-s")+(sort&&sort.k===c.k?" on":"")}>
          {c.sortable===false?c.label:<button type="button" onClick={()=>toggle(c)}>{c.label}<span className="g-dt-ar" aria-hidden>{sort&&sort.k===c.k?(sort.dir<0?"▾":"▴"):"↕"}</span></button>}</th>)}</tr></thead>
        <tbody>{view.map((r,i)=><tr key={rowKey?rowKey(r):i} className={onRowClick?"g-dt-click":""} onClick={onRowClick?()=>onRowClick(r):undefined}
          tabIndex={onRowClick?0:undefined} onKeyDown={onRowClick?e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onRowClick(r);}}:undefined}>
          {columns.map(c=><td key={c.k} className={c.num?"num":""} data-l={c.label}>{cell(c,r)}</td>)}</tr>)}</tbody>
      </table>
    </div>
    {pages>1&&<nav className="g-dt-pg" aria-label="ترقيم الصفحات">
      <button className="g-btn sm" onClick={()=>go(page-1)} disabled={page===0} aria-label="الصفحة السابقة"><Icon n="fwd" s={14}/></button>
      <span>صفحة {page+1} من {pages}</span>
      <button className="g-btn sm" onClick={()=>go(page+1)} disabled={page>=pages-1} aria-label="الصفحة التالية"><Icon n="back" s={14}/></button>
    </nav>}</>}
  </div>);
}
