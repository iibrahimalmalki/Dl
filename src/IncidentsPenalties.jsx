import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";

const money=n=>Number(n||0).toLocaleString("en-US",{maximumFractionDigits:2})+" ﷼";
const fmtD=d=>{if(!d)return"—";const s=String(d).slice(0,10);const p=s.split("-");return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:s;};
const SRC={
  sweater:{ar:"سويتر",ic:"complaints",c:"#b42318",bg:"#feecea"},
  housing:{ar:"السكن",ic:"home",c:"#b54708",bg:"#fef3e2"},
  fleet:{ar:"الأسطول",ic:"bike",c:"#1d5bbf",bg:"#eef4ff"},
};
const isOpen=s=>!["closed","settled","paid","rejected","resolved","مغلقة"].includes(String(s||"").toLowerCase());

export default function IncidentsPenalties({opId}){
  const[loading,setLoading]=useState(true);
  const[rows,setRows]=useState([]);
  const[src,setSrc]=useState("all");

  useEffect(()=>{(async()=>{
    setLoading(true);
    const q=(t,c)=>supabase.from(t).select(c).then(({data})=>data||[]).then(x=>x,()=>[]);
    const[v,h,f]=await Promise.all([
      q("violations","biker_name,code,severity,fine_applied,logged_at,status"),
      q("housing_violations","occupant,category,amount,action,incident_date,status,active"),
      q("fleet_incidents","incident_type,title,biker,vehicle_label,occurred_on,severity,status,active"),
    ]);
    const out=[];
    v.forEach(r=>out.push({source:"sweater",type:r.code||"مخالفة سويتر",subject:r.biker_name||"—",date:r.logged_at,amount:Number(r.fine_applied||0),sev:r.severity,status:r.status,detail:""}));
    h.filter(r=>r.active!==false).forEach(r=>out.push({source:"housing",type:r.category||"مخالفة سكن",subject:r.occupant||"—",date:r.incident_date,amount:Number(r.amount||0),sev:null,status:r.status,detail:r.action||""}));
    f.filter(r=>r.active!==false).forEach(r=>out.push({source:"fleet",type:r.incident_type||"حادثة",subject:r.biker||r.vehicle_label||"—",date:r.occurred_on,amount:0,sev:r.severity,status:r.status,detail:r.title||""}));
    out.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
    setRows(out);setLoading(false);
  })();},[opId]);

  const shown=useMemo(()=>rows.filter(r=>src==="all"||r.source===src),[rows,src]);
  const k=useMemo(()=>({
    total:rows.length, open:rows.filter(r=>isOpen(r.status)).length,
    fines:rows.reduce((a,r)=>a+Number(r.amount||0),0),
    sweater:rows.filter(r=>r.source==="sweater").length,
    housing:rows.filter(r=>r.source==="housing").length,
    fleet:rows.filter(r=>r.source==="fleet").length,
  }),[rows]);

  if(loading)return <div className="dw-skel" style={{height:240}}/>;

  return(<div className="ip">
    <style>{CSS}</style>
    <div className="ip-kpis">
      <div className="ip-kpi"><span>إجمالي البنود</span><b>{k.total}</b></div>
      <div className="ip-kpi"><span>مفتوحة</span><b style={{color:k.open?"#b42318":"#087443"}}>{k.open}</b></div>
      <div className="ip-kpi"><span>إجمالي الغرامات</span><b>{money(k.fines)}</b></div>
      <div className="ip-kpi"><span>سويتر / سكن / أسطول</span><b style={{fontSize:16}}>{k.sweater} · {k.housing} · {k.fleet}</b></div>
    </div>

    <div className="ip-tabs">
      {[["all","الكل",rows.length],["sweater","سويتر",k.sweater],["housing","السكن",k.housing],["fleet","الأسطول",k.fleet]].map(([key,ar,n])=>(
        <button key={key} className={src===key?"on":""} onClick={()=>setSrc(key)}>{ar} <span>{n}</span></button>))}
    </div>

    <div className="ip-panel">
      <div className="ip-tblwrap">
      <table className="ip-tbl">
        <thead><tr><th>المصدر</th><th>النوع</th><th>الطرف</th><th>التاريخ</th><th>المبلغ</th><th>الخطورة</th><th>الحالة</th></tr></thead>
        <tbody>
          {shown.map((r,i)=>{const s=SRC[r.source];const open=isOpen(r.status);return(
            <tr key={i}>
              <td><span className="ip-src" style={{color:s.c,background:s.bg}}><Icon n={s.ic} s={12}/> {s.ar}</span></td>
              <td><b>{r.type}</b>{r.detail?<small className="ip-det">{r.detail}</small>:null}</td>
              <td>{r.subject}</td>
              <td>{fmtD(r.date)}</td>
              <td>{r.amount?money(r.amount):"—"}</td>
              <td>{r.sev?<span className="ip-sev">{r.sev}</span>:"—"}</td>
              <td><span className="ip-st" style={open?{color:"#b42318",background:"#feecea"}:{color:"#087443",background:"#e7f7ef"}}>{open?"مفتوحة":"مغلقة/مُعالجة"}</span></td>
            </tr>);})}
          {!shown.length&&<tr><td colSpan={7} className="ip-empt">لا بنود ضمن هذا المصدر.</td></tr>}
        </tbody>
      </table>
      </div>
    </div>
    <p className="ip-note">عرض موحّد للقراءة يجمع مخالفات سويتر ومخالفات السكن وحوادث الأسطول. الإضافة والتعديل يتمّان من وحدة كل مصدر.</p>
  </div>);
}

const CSS=`
.ip{--ink:#0f172a;--mut:#64748b;--line:#eceef1}
.ip *{box-sizing:border-box}
.ip-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
.ip-kpi{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 15px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.ip-kpi span{font-size:11.5px;color:var(--mut);font-weight:700;display:block}
.ip-kpi b{font-size:22px;font-weight:800;margin-top:6px;display:block;letter-spacing:-.5px}
.ip-tabs{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.ip-tabs button{display:flex;align-items:center;gap:7px;padding:8px 14px;border-radius:11px;border:1px solid var(--line);background:#fff;font-family:inherit;font-size:13px;font-weight:700;color:var(--mut);cursor:pointer}
.ip-tabs button.on{background:#0f172a;color:#fff;border-color:#0f172a}
.ip-tabs button span{background:rgba(120,130,150,.16);padding:1px 8px;border-radius:20px;font-size:11px}
.ip-tabs button.on span{background:rgba(255,255,255,.2)}
.ip-panel{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 1px 2px rgba(16,24,40,.05);overflow:hidden}
.ip-tblwrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
.ip-tbl{width:100%;border-collapse:collapse;min-width:640px}
.ip-tbl th{font-size:11px;color:var(--mut);font-weight:700;text-align:right;padding:11px 14px;border-bottom:2px solid var(--line);background:#fafbfc;white-space:nowrap}
.ip-tbl td{padding:11px 14px;border-bottom:1px solid #f1f3f5;font-size:12.5px;vertical-align:top}
.ip-tbl tr:last-child td{border-bottom:none}
.ip-src{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;padding:3px 9px;border-radius:20px;white-space:nowrap}
.ip-det{display:block;color:var(--mut);font-size:11px;font-weight:500;margin-top:2px}
.ip-sev{font-size:11px;font-weight:700;color:#b54708;background:#fef3e2;padding:2px 8px;border-radius:7px}
.ip-st{font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;white-space:nowrap}
.ip-empt{text-align:center;color:#94a3b8;padding:24px}
.ip-note{font-size:11.5px;color:#94a3b8;margin:12px 2px 0;line-height:1.7}
@media(max-width:820px){.ip-kpis{grid-template-columns:1fr 1fr}}
`;
