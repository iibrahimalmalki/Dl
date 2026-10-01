import{useState}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";

// سجل حركات مشترك — يقرأ audit_log لأي جدول/سجل ويعرض خطاً زمنياً بالفروقات.
// الاستخدام: <ActivityLog table="field_rounds" rowId={r.id} labels={FL} valueMap={DV} entityName="الجولة"/>
const fmtDT=iso=>{try{return new Date(iso).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});}catch{return iso;}};

export default function ActivityLog({table,rowId,labels={},valueMap={},entityName="السجل"}){
  const[open,setOpen]=useState(false);
  const[loading,setLoading]=useState(false);
  const[rows,setRows]=useState(null);
  const dv=v=>v===true?"نعم":v===false?"لا":(v==null||v==="")?"—":(valueMap[v]||(typeof v==="object"?JSON.stringify(v).slice(0,40):String(v)));
  const diff=(o,n)=>{const ch=[];Object.keys(labels).forEach(k=>{const a=o?o[k]:undefined,b=n?n[k]:undefined;if(JSON.stringify(a??null)!==JSON.stringify(b??null))ch.push({k,a,b});});return ch;};
  const toggle=async()=>{
    if(open){setOpen(false);return;}
    setOpen(true);
    if(rows)return;
    setLoading(true);
    const{data}=await supabase.from("audit_log").select("action,actor_email,changed_at,old_data,new_data").eq("table_name",table).eq("row_id",rowId).order("changed_at",{ascending:false});
    setRows(data||[]);setLoading(false);
  };
  return(<div className="alg">
    <style>{CSS}</style>
    <button className={"alg-btn"+(open?" on":"")} onClick={toggle}><Icon n="clock" s={12}/> سجل الحركات{rows&&rows.length?` (${rows.length})`:""}</button>
    {open&&<div className="alg-list">
      {loading?<div className="alg-l">جارٍ التحميل…</div>:
       (!rows||!rows.length?<div className="alg-l">لا حركات مسجّلة بعد</div>:
        rows.map((h,i)=>{const ch=h.action==="UPDATE"?diff(h.old_data,h.new_data):[];return(
          <div className="alg-i" key={i}>
            <div className="alg-i-top"><b>{h.action==="INSERT"?"أُنشئ "+entityName:h.action==="DELETE"?"حُذف "+entityName:"تحديث"}</b><span>{fmtDT(h.changed_at)}{h.actor_email?" · "+h.actor_email:""}</span></div>
            {h.action==="UPDATE"&&(ch.length?<div className="alg-ch">{ch.map((c,j)=><div key={j}><span className="alg-f">{labels[c.k]||c.k}:</span> من <s>{dv(c.a)}</s> إلى <b>{dv(c.b)}</b></div>)}</div>:<div className="alg-ch dim">تحديث بيانات فنية</div>)}
          </div>);})
       )}
    </div>}
  </div>);
}

const CSS=`
.alg{display:contents}
.alg-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border-radius:9px;border:1px solid var(--line-2);background:var(--glass-2);color:var(--ink-2);font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer}
.alg-btn.on{background:var(--soft);border-color:var(--line-2);color:var(--info-ink)}
.alg-list{margin-top:9px;border:1px solid var(--line);border-radius:11px;background:var(--soft);padding:8px 10px;flex-basis:100%}
.alg-l{font-size:11.5px;color:var(--mut-2);font-weight:600;padding:6px 2px}
.alg-i{padding:8px 0;border-bottom:1px solid var(--line)}
.alg-i:last-child{border-bottom:none}
.alg-i-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.alg-i-top b{font-size:12px;color:var(--ink);font-weight:800}
.alg-i-top span{font-size:10.5px;color:var(--mut-2);font-weight:600}
.alg-ch{margin-top:5px;display:flex;flex-direction:column;gap:3px}
.alg-ch div{font-size:11px;color:var(--ink-2);font-weight:600;line-height:1.6}
.alg-ch.dim{color:var(--mut-2)}
.alg-f{font-weight:800;color:var(--ink)}
.alg-ch s{color:var(--bad-ink)}
.alg-ch b{color:var(--ok-ink)}
`;
