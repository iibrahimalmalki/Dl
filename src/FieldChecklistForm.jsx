import Icon from"./Icon";
import{AXES,ITEMS,RESP_AR}from"./fieldChecklist";

const RES=[["pass","✓","مطابق","g"],["half","≈","جزئي","a"],["fail","✕","غير مطابق","r"],["excused","∅","معفى (إمداد)","m"]];
// بنود الإدارة/الإمداد = التي تتطلب توفير بديل — نفس الحالات الأربع بمسمّيات الإمداد
const MRES=[["pass","✓","متوفّر","g"],["half","≈","بديل جزئي","a"],["fail","✕","ناقص","r"],["excused","∅","معفى (إمداد)","m"]];

// نص إرشادي لخانة الملاحظة حسب حالة البند
function notePH(it,r){
  if(r==="excused")return it.resp==="mgmt"?"توثيق الإعفاء: المادة/المعدة غير المُستلمة والبديل المُوفَّر":"توثيق الإعفاء: ما الذي لم يُستلم من الإدارة؟";
  if(r==="fail")return it.resp==="mgmt"?"الناقص + البديل/الإجراء لتوفيره":"سبب عدم المطابقة والإجراء التصحيحي";
  if(r==="half")return it.resp==="mgmt"?"ما البديل الجزئي المُوفَّر؟":"ما الناقص؟ والملاحظة";
  return it.resp==="mgmt"?"ملاحظة الإدارة / البديل (اختياري)":"ملاحظة (اختياري)";
}

// نموذج قائمة التحقق المشترك (جولة المشرف + الجولة الذاتية)
// props: items, res, onRes(n,v), notes, onNote(n,t), photos, onUpload(n,idx,file), uploading, onView(url), allowExtra, compact
export default function FieldChecklistForm({items=ITEMS,res={},onRes,notes={},onNote,photos={},onUpload,uploading,onView,allowExtra=true,compact}){
  const axes=[...new Set(items.map(i=>i.axis))];
  return(<div className="fcf">
    <div className="fcf-legend">
      <span className="fcf-lg"><b className="fcf-o g on">✓</b> مطابق</span>
      <span className="fcf-lg"><b className="fcf-o a on">≈</b> جزئي</span>
      <span className="fcf-lg"><b className="fcf-o r on">✕</b> غير مطابق</span>
      <span className="fcf-lg"><b className="fcf-o m on">∅</b> معفى (إمداد)</span>
      <span className="fcf-lg cam"><Icon n="camera" s={13}/> صورة توثيق</span>
    </div>
    {axes.map(ax=>(
      <div className="fcf-axis" key={ax}>
        <div className="fcf-axis-h"><Icon n={AXES[ax].ic} s={15}/> {AXES[ax].ar}</div>
        {items.filter(i=>i.axis===ax).map(it=>{const mgmt=it.resp==="mgmt";const opts=mgmt?MRES:RES;const r=res[it.n];const ph=it.photos||[];const arr=photos[it.n]||[];const slots=Math.max(ph.length,arr.length);const got=arr.filter(Boolean).length;return(
          <div className={"fcf-item"+(mgmt?" mg":"")} key={it.n}>
            <div className="fcf-row">
              <div className="fcf-txt"><span className="fcf-n">{it.n}</span><div><div className="fcf-ar">{it.ar}</div><div className="fcf-resp">{RESP_AR[it.resp]}{mgmt&&" ⚠"}{ph.length>0&&<span className={"fcf-cam"+(got>=ph.length?" ok":"")}> · <Icon n="camera" s={10}/> {got}/{ph.length}</span>}</div></div></div>
              <div className="fcf-opts">{opts.map(([v,sym,lbl,tone])=><button key={v} className={"fcf-o "+tone+(res[it.n]===v?" on":"")} title={lbl} onClick={()=>onRes(it.n,res[it.n]===v?undefined:v)}>{sym}</button>)}</div>
            </div>
            {(ph.length>0||arr.length>0)&&<div className="fcf-photos">
              {Array.from({length:slots}).map((_,idx)=>{const url=arr[idx];const up=uploading===`${it.n}-${idx}`;const lbl=ph[idx]||"إضافية";return(
                <label className={"fcf-ph"+(url?" has":"")} key={idx}>
                  <input type="file" accept="image/*" capture="environment" hidden onChange={e=>onUpload(it.n,idx,e.target.files[0])}/>
                  {up?<span className="fcf-up">…</span>:url?<img src={url} alt={lbl} onClick={e=>{e.preventDefault();onView&&onView(url);}}/>:<><Icon n="camera" s={15}/><span>{lbl}</span></>}
                </label>);})}
              {allowExtra&&<label className="fcf-ph add"><input type="file" accept="image/*" capture="environment" hidden onChange={e=>onUpload(it.n,slots,e.target.files[0])}/><Icon n="plus" s={16}/><span>إضافية</span></label>}
            </div>}
            <div className={"fcf-note"+(r==="excused"||r==="fail"?" hot":"")}>
              <Icon n={r==="excused"||r==="fail"?"alert":"edit"} s={13}/>
              <input value={notes[it.n]||""} onChange={e=>onNote(it.n,e.target.value)} placeholder={notePH(it,r)}/>
            </div>
          </div>);})}
      </div>
    ))}
  </div>);
}

export const FCF_CSS=`
.fcf-legend{display:flex;flex-wrap:wrap;gap:10px;align-items:center;background:#fafbfc;border:1px solid #f1f3f5;border-radius:11px;padding:9px 12px;margin-bottom:6px}
.fcf-lg{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:#475569;font-weight:600}
.fcf-o{width:30px;height:30px;border-radius:9px;border:1px solid #e6e9ee;background:#fff;font-size:14px;font-weight:800;cursor:pointer;color:#94a3b8;display:flex;align-items:center;justify-content:center}
.fcf-lg .fcf-o{width:22px;height:22px;font-size:12px;cursor:default}
.fcf-lg.cam{color:#175cd3;margin-inline-start:auto}
.fcf-axis{margin-bottom:6px}
.fcf-axis-h{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:800;color:#0f172a;margin:12px 0 6px;padding-bottom:5px;border-bottom:1px solid #f1f3f5}
.fcf-item{display:flex;flex-direction:column;gap:9px;padding:10px 0;border-bottom:1px solid #f6f7f9}
.fcf-row{display:flex;align-items:center;gap:10px}
.fcf-item.mg{opacity:.9}
.fcf-txt{flex:1;min-width:0;display:flex;gap:9px}
.fcf-n{width:22px;height:22px;border-radius:7px;background:#f4f5f7;color:#64748b;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex:none}
.fcf-ar{font-size:12.5px;font-weight:600;color:#0f172a;line-height:1.4}
.fcf-resp{font-size:10px;color:#94a3b8;margin-top:2px}
.fcf-cam{color:#94a3b8;font-weight:700}.fcf-cam.ok{color:#087443}
.fcf-opts{display:flex;gap:4px;flex:none}
.fcf-o.g.on{background:#e7f7ef;border-color:#b7e4cd;color:#087443}
.fcf-o.a.on{background:#fef3e2;border-color:#fbdba7;color:#b54708}
.fcf-o.r.on{background:#feecea;border-color:#f7bfba;color:#b42318}
.fcf-o.m.on{background:#eef0f3;border-color:#d7dde5;color:#475569}
.fcf-photos{display:flex;flex-wrap:wrap;gap:7px;padding-inline-start:31px}
.fcf-ph{width:64px;height:64px;border-radius:10px;border:1.5px dashed #d7dde5;background:#fafbfc;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;color:#94a3b8;overflow:hidden;flex:none}
.fcf-ph:hover{border-color:#E8712B;color:#E8712B}
.fcf-ph span{font-size:8.5px;font-weight:700;text-align:center;line-height:1.15;padding:0 3px}
.fcf-ph.has{border-style:solid;border-color:#b7e4cd}
.fcf-ph.add{border-color:#cbd5e1;background:#fff}
.fcf-ph img{width:100%;height:100%;object-fit:cover}
.fcf-up{font-size:18px;color:#E8712B;font-weight:800}
.fcf-note{display:flex;align-items:center;gap:7px;margin-top:2px;padding-inline-start:31px}
.fcf-note input{flex:1;border:1px solid #e6e9ee;border-radius:9px;padding:8px 10px;font-family:inherit;font-size:12px;outline:none;background:#fafbfc;color:#0f172a}
.fcf-note input:focus{border-color:#E8712B;box-shadow:0 0 0 3px rgba(232,113,43,.1);background:#fff}
.fcf-note>svg{color:#cbd5e1;flex:none}
.fcf-note.hot input{background:#fffdf7;border-color:#f0d9b5}
.fcf-note.hot input:focus{border-color:#b54708;box-shadow:0 0 0 3px rgba(181,71,8,.1)}
.fcf-note.hot>svg{color:#b54708}
`;
