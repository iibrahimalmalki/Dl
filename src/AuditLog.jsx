import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";

const TBL={renewal_docs:"الوثائق",fleet_vehicles:"المركبات",fleet_incidents:"حوادث الأسطول",housing_units:"وحدات السكن",housing_payments:"دفعات السكن",housing_violations:"مخالفات السكن",offboarding:"إنهاء الخدمة",sweater_settlements:"تسوية سويتر",vendor_expenses:"مصروفات الموردين",vendors:"الموردون",employees:"الموظفون"};
const ACT={INSERT:{ar:"إضافة",c:"var(--ok-ink)",bg:"var(--ok-bg)"},UPDATE:{ar:"تعديل",c:"var(--warn-ink)",bg:"var(--warn-bg)"},DELETE:{ar:"حذف",c:"var(--bad-ink)",bg:"var(--bad-bg)"}};
const fmtT=t=>{if(!t)return"—";const d=new Date(t);return d.toLocaleDateString("en-GB")+" "+d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});};
const label=(d)=>{if(!d)return"—";return d.subject||d.plate||d.full_name||d.biker_name||d.name||d.title||d.category||d.doc_type||(d.seq?("دفعة "+d.seq):null)||(d.id?String(d.id).slice(0,8):"—");};

export default function AuditLog(){
  const[loading,setLoading]=useState(true);
  const[rows,setRows]=useState([]);
  const[tbl,setTbl]=useState("all");const[act,setAct]=useState("all");

  useEffect(()=>{(async()=>{
    setLoading(true);
    const{data}=await supabase.from("audit_log").select("*").order("changed_at",{ascending:false}).limit(300);
    setRows(data||[]);setLoading(false);
  })();},[]);

  const shown=useMemo(()=>rows.filter(r=>(tbl==="all"||r.table_name===tbl)&&(act==="all"||r.action===act)),[rows,tbl,act]);
  const tables=useMemo(()=>[...new Set(rows.map(r=>r.table_name))],[rows]);

  if(loading)return <div className="g-skel" style={{height:240}}/>;

  return(<div className="au">
    <style>{CSS}</style>
    <div className="au-bar">
      <div className="au-fl">
        <select value={tbl} onChange={e=>setTbl(e.target.value)}><option value="all">كل الوحدات</option>{tables.map(t=><option key={t} value={t}>{TBL[t]||t}</option>)}</select>
        <select value={act} onChange={e=>setAct(e.target.value)}><option value="all">كل العمليات</option><option value="INSERT">إضافة</option><option value="UPDATE">تعديل</option><option value="DELETE">حذف</option></select>
      </div>
      <span className="au-count">{shown.length} سجلّ</span>
    </div>

    <div className="au-panel">
      <div className="au-tblwrap">
      <table className="au-tbl">
        <thead><tr><th>الوقت</th><th>العملية</th><th>الوحدة</th><th>السجلّ</th><th>المستخدم</th></tr></thead>
        <tbody>
          {shown.map(r=>{const a=ACT[r.action]||{ar:r.action,c:"var(--mut)",bg:"var(--soft)"};return(
            <tr key={r.id}>
              <td className="au-t">{fmtT(r.changed_at)}</td>
              <td><span className="au-act" style={{color:a.c,background:a.bg}}>{a.ar}</span></td>
              <td>{TBL[r.table_name]||r.table_name}</td>
              <td><b>{label(r.new_data||r.old_data)}</b></td>
              <td className="au-u">{r.actor_email||"—"}</td>
            </tr>);})}
          {!shown.length&&<tr><td colSpan={5} className="au-empt">لا سجلّات مطابقة.</td></tr>}
        </tbody>
      </table>
      </div>
    </div>
    <p className="au-note">سجلّ تدقيق للقراءة — يوثّق كل إضافة/تعديل/حذف على الوثائق والأسطول والسكن والتسوية والمصروفات والموظفين. مقصور على المالك.</p>
  </div>);
}

const CSS=`
.au{}
.au *{box-sizing:border-box}
.au-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.au-fl{display:flex;gap:8px}
.au-fl select{border:1px solid var(--line);border-radius:10px;padding:9px 12px;font-family:inherit;font-size:13px;font-weight:700;color:var(--ink);background:var(--glass-3);outline:none}
.au-count{font-size:12px;color:var(--mut);font-weight:700}
.au-panel{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);overflow:hidden}
.au-tblwrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
.au-tbl{width:100%;border-collapse:collapse;min-width:640px}
.au-tbl th{font-size:11px;color:var(--mut);font-weight:700;text-align:right;padding:11px 14px;border-bottom:2px solid var(--line);background:var(--soft);white-space:nowrap}
.au-tbl td{padding:10px 14px;border-bottom:1px solid var(--line);font-size:12.5px;white-space:nowrap}
.au-tbl tr:last-child td{border-bottom:none}
.au-t{color:var(--mut);font-size:11.5px}
.au-u{color:var(--mut);font-size:11.5px}
.au-act{font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px}
.au-empt{text-align:center;color:var(--mut-2);padding:24px}
.au-note{font-size:11.5px;color:var(--mut-2);margin:12px 2px 0;line-height:1.7}
`;
