import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";

const nowPeriod=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;};
const periodLabel=p=>{const[y,m]=p.split("-");return`${["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"][+m-1]||m} ${y}`;};

// للعرض فقط: الحفظ هنا كان يحذف ops_biker_month وops_tickets ويعيد إدراجهما فيمسح القرارات والتوصيات والصور.
// مسار الرفع الوحيد = الإقفال الشهري (MonthClose)، وقرارات الشكاوى من «شكاوى سويتر».
export default function Operations({opId,onNav}){
  const[period,setPeriod]=useState(nowPeriod());
  const[loading,setLoading]=useState(true);
  const[emps,setEmps]=useState([]);
  const[tickets,setTickets]=useState([]);       // شكاوى بقرارات
  const[savedBM,setSavedBM]=useState([]);       // ops_biker_month محفوظ

  useEffect(()=>{(async()=>{
    setLoading(true);
    const{data:e}=await supabase.from("employees").select("id,full_name,employee_id,operator_id").not("employee_id","is",null);
    setEmps(e||[]);
    let bmQ=supabase.from("ops_biker_month").select("*").eq("period",period);
    let tkQ=supabase.from("ops_tickets").select("*").eq("period",period);
    if(opId&&opId!=="all"){bmQ=bmQ.eq("operator_id",opId);tkQ=tkQ.eq("operator_id",opId);}
    const[{data:bm},{data:tk}]=await Promise.all([bmQ,tkQ.order("created_at")]);
    setSavedBM(bm||[]);
    setTickets((tk||[]).map((t,i)=>({idx:i,booking_ref:t.booking_ref,biker_name:t.biker_name,sweater_id:t.sweater_id,ticket_date:t.ticket_date,description:t.description,has_image:t.has_image,decision:t.decision||"pending"})));
    setLoading(false);
  })();},[period,opId]);

  const empBySid=useMemo(()=>{const m={};emps.forEach(e=>{if(e.employee_id)m[String(e.employee_id).trim()]=e;});return m;},[emps]);

  // نموذج العرض الموحّد لكل بايكر
  const rows=useMemo(()=>{
    const approvedFor=(sid,name)=>tickets.filter(t=>t.decision==="approved"&&((sid&&t.sweater_id===sid)||(name&&t.biker_name===name))).length;
    const base=savedBM.map(b=>({sweater_id:b.sweater_id,biker_name:b.biker_name,net_washes:b.net_washes,collect_payment:b.collect_payment,cancel_client:b.cancel_client,cancel_admin:b.cancel_admin,daily:b.daily||{},rating:b.rating??null}));
    return base.map(b=>{const ap=approvedFor(b.sweater_id,b.biker_name);const emp=empBySid[String(b.sweater_id).trim()];
      return{...b,employee_id:emp?.id||null,matched:!!emp,approved_complaints:ap,complaint_pct:b.net_washes?Math.round(ap/b.net_washes*10000)/100:0};});
  },[savedBM,tickets,empBySid]);

  const totals=useMemo(()=>({washes:rows.reduce((a,b)=>a+(b.net_washes||0),0),bikers:rows.length,
    complaints:tickets.length,approved:tickets.filter(t=>t.decision==="approved").length,pending:tickets.filter(t=>t.decision==="pending").length}),[rows,tickets]);

  if(loading)return <div className="g-skel" style={{height:280}}/>;
  const hasData=rows.length>0||tickets.length>0;

  return(<div className="op">
    <style>{CSS}</style>
    <div className="op-bar">
      <div className="op-month"><Icon n="calendar" s={16}/><input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></div>
      <span className="op-ro"><Icon n="eye" s={13}/> للعرض فقط</span>
    </div>

    {/* الرفع والقرارات خارج هذه الصفحة */}
    <div className="g-card pad op-moved" role="note">
      <Icon n="calendar" s={18}/>
      <div><b>هذه الصفحة للعرض فقط — رفع ملفات سويتر من صفحة الإقفال الشهري</b><small>تقرأ الملفات التسعة كما تُصدَّر، وتأخذ الشهر المختار فقط، ولا تحذف قرارات مراجعة التذاكر. قرارات الشكاوى من «شكاوى سويتر».</small></div>
      {onNav&&<button className="g-btn primary sm" onClick={()=>onNav("close")}>افتح الإقفال الشهري</button>}
    </div>
    <div className="op-hint"><Icon n="alert" s={13}/> الغسلات الصافية = المكتملة + إلغاء العميل (تُستثنى إلغاءات الإدارة والأعطال). اعتماد الشكاوى صلاحيتك وحدك.</div>

    {/* ملخص */}
    <div className="op-kpis">
      <K ic="applicants" c="var(--p)" bg="var(--p-100)" t="بايكرز" v={totals.bikers}/>
      <K ic="operations" c="var(--info-ink)" bg="var(--info-bg)" t="إجمالي الغسلات الصافية" v={totals.washes}/>
      <K ic="complaints" c="var(--warn-ink)" bg="var(--warn-bg)" t="شكاوى" v={totals.complaints}/>
      <K ic="check" c="var(--ok-ink)" bg="var(--ok-bg)" t="معتمدة" v={totals.approved}/>
    </div>

    {/* جدول البايكرز */}
    {rows.length>0&&<div className="op-sec">
      <div className="op-sh"><Icon n="applicants" s={16}/> الغسلات لكل بايكر <span>({rows.length})</span></div>
      <div style={{overflowX:"auto"}}><table className="op-tbl">
        <thead><tr><th>البايكر</th><th>صافية</th><th>مكتملة</th><th>إلغاء عميل</th><th>إلغاء إدارة</th><th>التقييم</th><th>شكاوى معتمدة</th><th>الربط</th></tr></thead>
        <tbody>{rows.map((b,i)=><tr key={i}>
          <td><div className="op-bk">{b.biker_name||"—"}<small>#{b.sweater_id||"—"}</small></div></td>
          <td><b>{b.net_washes}</b></td><td>{b.collect_payment}</td><td>{b.cancel_client}</td><td className="op-mut">{b.cancel_admin}</td>
          <td>{b.rating!=null?<span className="op-rt">{Number(b.rating).toFixed(2)}</span>:"—"}</td>
          <td>{b.approved_complaints>0?<span className="op-cp">{b.approved_complaints} ({b.complaint_pct}%)</span>:<span className="op-mut">0</span>}</td>
          <td>{b.matched?<span className="op-ok"><Icon n="check" s={13}/> مرتبط</span>:<span className="op-no"><Icon n="alert" s={13}/> غير مرتبط</span>}</td>
        </tr>)}</tbody>
      </table></div>
    </div>}

    {/* اعتماد الشكاوى */}
    {tickets.length>0&&<div className="op-sec">
      <div className="op-sh"><Icon n="complaints" s={16}/> قرارات الشكاوى <span>({totals.approved} معتمدة · {totals.pending} معلّقة)</span></div>
      {tickets.map((t,i)=><div className="op-tk" key={i}>
        <div className="op-tk-main">
          <div className="op-tk-h">{(t.sweater_ticket_no||t.ticket_no!=null)&&<span className="op-no">شكوى #{t.sweater_ticket_no||String(t.ticket_no).padStart(4,"0")}</span>}{t.sweater_decision&&<span className={"op-sw"+(t.sweater_decision==="report"?"":" hot")}>سويتر: {t.sweater_decision==="report"?"بلاغ":t.sweater_decision}</span>}<b>{t.biker_name||"—"}</b>{t.sweater_id&&<small>#{t.sweater_id}</small>}{t.booking_ref&&<span className="op-ref">حجز {t.booking_ref}</span>}{t.has_image&&<span className="op-img"><Icon n="eye" s={11}/> صورة</span>}{t.ticket_date&&<span className="op-date">{t.ticket_date}</span>}</div>
          <div className="op-desc">{t.description||"—"}</div>
        </div>
        <div className="op-dec">
          {t.decision==="approved"?<span className="op-d ap on"><Icon n="check" s={13}/> معتمدة</span>:t.decision==="rejected"?<span className="op-d rj on"><Icon n="x" s={13}/> مرفوضة</span>:<span className="op-d">معلّقة</span>}
        </div>
      </div>)}
    </div>}

    {!hasData&&<div className="op-empty"><div className="op-empty-ic"><Icon n="operations" s={30}/></div><h3>لا بيانات لشهر {periodLabel(period)}</h3><p>ارفع تقارير سويتر للشهر من صفحة الإقفال الشهري، فتظهر هنا الغسلات والتقييم والشكاوى، وتتغذّى منها الرواتب.</p></div>}
  </div>);
}

function K({ic,c,bg,t,v}){return(<div className="op-kpi"><span className="op-ki" style={{background:bg,color:c}}><Icon n={ic} s={17}/></span><div><div className="op-kv">{v}</div><div className="op-kl">{t}</div></div></div>);}

const CSS=`
.op-moved{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;color:var(--p-ink)}
.op-moved>div{flex:1 1 220px;display:flex;flex-direction:column;gap:2px;color:var(--ink)}.op-moved small{color:var(--mut);font-size:12px}
.op{--b:var(--p)}
.op-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.op-month{display:flex;align-items:center;gap:7px;background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:11px;padding:7px 11px;color:var(--mut)}
.op-month input{border:none;outline:none;font-family:inherit;font-size:13px;font-weight:700;color:var(--ink);background:none}
.op-ro{display:inline-flex;align-items:center;gap:5px;margin-inline-start:auto;padding:6px 11px;border-radius:20px;background:var(--soft);color:var(--mut);font-size:12px;font-weight:800}
.op-hint{display:flex;align-items:center;gap:7px;background:var(--warn-bg);border:1px solid color-mix(in srgb,var(--warn) 35%,transparent);color:var(--warn-ink);font-size:11.5px;font-weight:600;border-radius:11px;padding:9px 12px;margin:12px 0}
.op-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.op-kpi{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:15px;padding:13px;display:flex;align-items:center;gap:11px;box-shadow:var(--shadow)}
.op-ki{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.op-kv{font-size:20px;font-weight:800;letter-spacing:-.5px}.op-kl{font-size:11.5px;color:var(--mut);font-weight:600}
.op-sec{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:16px;padding:14px;margin-bottom:14px;box-shadow:var(--shadow)}
.op-sh{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;margin-bottom:12px}
.op-sh span{color:var(--mut-2);font-weight:600;font-size:12px}
.op-tbl{width:100%;border-collapse:collapse;font-size:12.5px;white-space:nowrap}
.op-tbl th{font-size:10.5px;color:var(--mut-2);font-weight:700;text-align:center;padding:8px 10px;border-bottom:1px solid var(--line);background:var(--soft)}
.op-tbl th:first-child{text-align:right}
.op-tbl td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:center}
.op-tbl tr:last-child td{border-bottom:none}
.op-bk{text-align:right;font-weight:700}.op-bk small{color:var(--mut-2);font-weight:600;margin-inline-start:5px}
.op-tbl td b{color:var(--p);font-size:14px}
.op-mut{color:var(--mut-2)}
.op-rt{background:var(--ok-bg);color:var(--ok-ink);border-radius:7px;padding:2px 8px;font-weight:800}
.op-cp{background:var(--bad-bg);color:var(--bad-ink);border-radius:7px;padding:2px 8px;font-weight:700}
.op-ok{display:inline-flex;align-items:center;gap:4px;color:var(--ok-ink);font-weight:700}
.op-no{display:inline-flex;align-items:center;gap:4px;color:var(--warn-ink);font-weight:700}
.op-tk{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line)}
.op-tk:last-child{border-bottom:none}
.op-tk-main{flex:1;min-width:0}
.op-tk-h{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:3px}
.op-tk-h b{font-size:13px}.op-tk-h small{color:var(--mut-2)}
.op-ref{background:var(--soft);border-radius:6px;padding:1px 7px;font-size:10px;color:var(--mut);font-weight:700}
.op-no{background:var(--soft);border:1px solid var(--line);border-radius:6px;padding:1px 7px;font-size:10px;color:var(--ink);font-weight:800;letter-spacing:.3px}
.op-sw{background:var(--soft);border:1px solid var(--line);border-radius:6px;padding:1px 7px;font-size:10px;color:var(--ink-2);font-weight:800}
.op-sw.hot{color:var(--warn-ink);background:var(--p-50);border-color:rgba(var(--p-rgb),.35)}
.op-img{display:inline-flex;align-items:center;gap:3px;background:var(--info-bg);color:var(--info-ink);border-radius:6px;padding:1px 7px;font-size:10px;font-weight:700}
.op-date{font-size:10.5px;color:var(--mut-2)}
.op-desc{font-size:12px;color:var(--ink-2);line-height:1.5}
.op-dec{display:flex;gap:6px;flex:none}
.op-d{display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:9px;border:1px solid var(--line);background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;color:var(--mut)}
.op-dec .op-d{cursor:default}
.op-d.ap.on{background:var(--ok-bg);border-color:color-mix(in srgb,var(--ok) 35%,transparent);color:var(--ok-ink)}
.op-d.rj.on{background:var(--bad-bg);border-color:color-mix(in srgb,var(--bad) 35%,transparent);color:var(--bad-ink)}
.op-empty{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px dashed var(--line);border-radius:16px;padding:40px 24px;text-align:center}
.op-empty-ic{width:64px;height:64px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--p-100),var(--p-100));color:var(--b)}
.op-empty h3{font-size:16px;margin:0 0 8px}.op-empty p{color:var(--mut);font-size:12.5px;max-width:440px;margin:0 auto;line-height:1.7}
@media(max-width:720px){.op-kpis{grid-template-columns:1fr 1fr}}
`;
