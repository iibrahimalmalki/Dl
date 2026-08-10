import{useState,useEffect,useMemo}from"react";
import * as XLSX from"xlsx";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{parseBookings,parseQC,parseTickets}from"./sweaterParser";

const nowPeriod=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;};
const periodLabel=p=>{const[y,m]=p.split("-");return`${["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"][+m-1]||m} ${y}`;};
const readRows=file=>new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>{try{const wb=XLSX.read(e.target.result,{type:"array",cellDates:true});const ws=wb.Sheets[wb.SheetNames[0]];res(XLSX.utils.sheet_to_json(ws,{defval:""}));}catch(err){rej(err);}};r.onerror=rej;r.readAsArrayBuffer(file);});

export default function Operations({opId}){
  const[period,setPeriod]=useState(nowPeriod());
  const[loading,setLoading]=useState(true);
  const[emps,setEmps]=useState([]);
  const[bookings,setBookings]=useState(null);   // نتيجة parseBookings (رفع جديد)
  const[qc,setQc]=useState(null);               // خريطة التقييم (رفع جديد)
  const[tickets,setTickets]=useState([]);       // شكاوى بقرارات
  const[savedBM,setSavedBM]=useState([]);       // ops_biker_month محفوظ
  const[files,setFiles]=useState({});           // {kind:{name,rows}}
  const[busy,setBusy]=useState("");const[msg,setMsg]=useState(null);const[saving,setSaving]=useState(false);

  useEffect(()=>{(async()=>{
    setLoading(true);setMsg(null);setBookings(null);setQc(null);setFiles({});
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

  const onFile=async(kind,file)=>{
    if(!file)return;setBusy(kind);setMsg(null);
    try{
      const rows=await readRows(file);
      if(kind==="bookings"){const pb=parseBookings(rows);setBookings(pb);}
      else if(kind==="qc"){setQc(parseQC(rows));}
      else if(kind==="tickets"){const tk=parseTickets(rows);setTickets(tk.map(t=>({...t,decision:"pending"})));}
      setFiles(f=>({...f,[kind]:{name:file.name,rows:rows.length}}));
      setMsg({ok:true,t:`تم تحليل ${file.name} — ${rows.length} صف`});
    }catch(err){setMsg({ok:false,t:"تعذّر قراءة الملف: "+(err.message||err)});}
    setBusy("");
  };

  const setDecision=(i,d)=>setTickets(p=>p.map((t,j)=>j===i?{...t,decision:d}:t));

  // نموذج العرض الموحّد لكل بايكر
  const rows=useMemo(()=>{
    const approvedFor=(sid,name)=>tickets.filter(t=>t.decision==="approved"&&((sid&&t.sweater_id===sid)||(name&&t.biker_name===name))).length;
    let base;
    if(bookings){base=bookings.bikers.map(b=>({sweater_id:b.sweater_id,biker_name:b.biker_name,net_washes:b.net_washes,collect_payment:b.collect_payment,cancel_client:b.cancel_client,cancel_admin:b.cancel_admin,daily:b.dates,rating:(qc&&(qc[b.sweater_id]||qc[b.biker_name])||{}).rating??null}));}
    else{base=savedBM.map(b=>({sweater_id:b.sweater_id,biker_name:b.biker_name,net_washes:b.net_washes,collect_payment:b.collect_payment,cancel_client:b.cancel_client,cancel_admin:b.cancel_admin,daily:b.daily||{},rating:b.rating??null}));}
    return base.map(b=>{const ap=approvedFor(b.sweater_id,b.biker_name);const emp=empBySid[String(b.sweater_id).trim()];
      return{...b,employee_id:emp?.id||null,matched:!!emp,approved_complaints:ap,complaint_pct:b.net_washes?Math.round(ap/b.net_washes*10000)/100:0};});
  },[bookings,qc,savedBM,tickets,empBySid]);

  const totals=useMemo(()=>({washes:rows.reduce((a,b)=>a+(b.net_washes||0),0),bikers:rows.length,
    complaints:tickets.length,approved:tickets.filter(t=>t.decision==="approved").length,pending:tickets.filter(t=>t.decision==="pending").length}),[rows,tickets]);

  const save=async()=>{
    setSaving(true);setMsg(null);
    try{
      const opv=(opId&&opId!=="all")?opId:null;
      // biker month
      let d1=supabase.from("ops_biker_month").delete().eq("period",period);if(opv)d1=d1.eq("operator_id",opv);else d1=d1.is("operator_id",null);await d1;
      if(rows.length){const ins=rows.map(b=>({operator_id:opv,period,employee_id:b.employee_id,sweater_id:b.sweater_id,biker_name:b.biker_name,net_washes:b.net_washes,collect_payment:b.collect_payment,cancel_client:b.cancel_client,cancel_admin:b.cancel_admin,rating:b.rating,approved_complaints:b.approved_complaints,complaint_pct:b.complaint_pct,daily:b.daily||{},updated_at:new Date().toISOString()}));const{error}=await supabase.from("ops_biker_month").insert(ins);if(error)throw error;}
      // tickets
      let d2=supabase.from("ops_tickets").delete().eq("period",period);if(opv)d2=d2.eq("operator_id",opv);else d2=d2.is("operator_id",null);await d2;
      if(tickets.length){const ins=tickets.map(t=>({operator_id:opv,period,sweater_ticket_no:t.sweater_ticket_no||null,sweater_decision:t.sweater_decision||null,booking_ref:t.booking_ref||"",sweater_id:t.sweater_id||"",biker_name:t.biker_name||"",ticket_date:t.ticket_date||"",description:t.description||"",has_image:!!t.has_image,decision:t.decision||"pending"}));const{error}=await supabase.from("ops_tickets").insert(ins);if(error)throw error;}
      // audit
      const ups=Object.entries(files).map(([kind,f])=>({operator_id:opv,period,kind,filename:f.name,rows:f.rows,uploaded_at:new Date().toISOString()}));
      if(ups.length)await supabase.from("report_uploads").insert(ups);
      setSavedBM(rows.map(b=>({...b})));setBookings(null);setQc(null);
      setMsg({ok:true,t:"تم الحفظ — الرواتب ستقرأ هذه البيانات تلقائياً لشهر "+periodLabel(period)});
    }catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setSaving(false);
  };

  if(loading)return <div className="dw-skel" style={{height:280}}/>;
  const hasData=rows.length>0||tickets.length>0;

  return(<div className="op">
    <style>{CSS}</style>
    <div className="op-bar">
      <div className="op-month"><Icon n="calendar" s={16}/><input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></div>
      <div style={{flex:1}}/>
      <button className="op-btn" onClick={save} disabled={saving||!hasData}><Icon n="save" s={15}/> {saving?"جارٍ الحفظ…":"حفظ وتغذية الرواتب"}</button>
    </div>
    {msg&&<div className={"op-msg "+(msg.ok?"ok":"err")}>{msg.t}</div>}

    {/* رفع التقارير */}
    <div className="op-up">
      <Drop kind="bookings" ic="operations" t="تقرير الحجوزات" d="bookings_report" f={files.bookings} busy={busy} onFile={onFile}/>
      <Drop kind="qc" ic="star" t="تقرير الجودة" d="biker_qc_report" f={files.qc} busy={busy} onFile={onFile}/>
      <Drop kind="tickets" ic="complaints" t="تقرير الشكاوى" d="tickets_report" f={files.tickets} busy={busy} onFile={onFile}/>
    </div>
    <div className="op-hint"><Icon n="alert" s={13}/> الغسلات الصافية = المكتملة + إلغاء العميل (تُستثنى إلغاءات الإدارة والأعطال). اعتماد الشكاوى صلاحيتك وحدك.</div>

    {/* ملخص */}
    <div className="op-kpis">
      <K ic="applicants" c="#E8712B" bg="#fff2e8" t="بايكرز" v={totals.bikers}/>
      <K ic="operations" c="#175cd3" bg="#eff6ff" t="إجمالي الغسلات الصافية" v={totals.washes}/>
      <K ic="complaints" c="#b54708" bg="#fef3e2" t="شكاوى" v={totals.complaints}/>
      <K ic="check" c="#087443" bg="#e7f7ef" t="معتمدة" v={totals.approved}/>
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
      <div className="op-sh"><Icon n="complaints" s={16}/> اعتماد الشكاوى <span>({totals.approved} معتمدة · {totals.pending} معلّقة)</span></div>
      {tickets.map((t,i)=><div className="op-tk" key={i}>
        <div className="op-tk-main">
          <div className="op-tk-h">{(t.sweater_ticket_no||t.ticket_no!=null)&&<span className="op-no">شكوى #{t.sweater_ticket_no||String(t.ticket_no).padStart(4,"0")}</span>}{t.sweater_decision&&<span className={"op-sw"+(t.sweater_decision==="report"?"":" hot")}>سويتر: {t.sweater_decision==="report"?"بلاغ":t.sweater_decision}</span>}<b>{t.biker_name||"—"}</b>{t.sweater_id&&<small>#{t.sweater_id}</small>}{t.booking_ref&&<span className="op-ref">حجز {t.booking_ref}</span>}{t.has_image&&<span className="op-img"><Icon n="eye" s={11}/> صورة</span>}{t.ticket_date&&<span className="op-date">{t.ticket_date}</span>}</div>
          <div className="op-desc">{t.description||"—"}</div>
        </div>
        <div className="op-dec">
          <button className={"op-d ap"+(t.decision==="approved"?" on":"")} onClick={()=>setDecision(i,"approved")}><Icon n="check" s={13}/> اعتماد</button>
          <button className={"op-d rj"+(t.decision==="rejected"?" on":"")} onClick={()=>setDecision(i,"rejected")}><Icon n="x" s={13}/> رفض</button>
        </div>
      </div>)}
    </div>}

    {!hasData&&<div className="op-empty"><div className="op-empty-ic"><Icon n="operations" s={30}/></div><h3>ارفع تقارير سويتر لشهر {periodLabel(period)}</h3><p>ارفع تقرير الحجوزات والجودة والشكاوى، وسيحسب النظام الغسلات الصافية والتقييم والشكاوى تلقائياً — ثم تعتمد الشكاوى، فتتغذّى الرواتب مباشرةً.</p></div>}
  </div>);
}

function Drop({kind,ic,t,d,f,busy,onFile}){
  return(<label className={"op-drop"+(f?" done":"")}>
    <input type="file" accept=".csv,.xlsx,.xls" style={{display:"none"}} onChange={e=>onFile(kind,e.target.files[0])}/>
    <span className="op-drop-ic"><Icon n={f?"check":ic} s={20}/></span>
    <div className="op-drop-t">{t}</div>
    <div className="op-drop-d">{busy===kind?"جارٍ التحليل…":f?`${f.name} · ${f.rows} صف`:d}</div>
  </label>);
}
function K({ic,c,bg,t,v}){return(<div className="op-kpi"><span className="op-ki" style={{background:bg,color:c}}><Icon n={ic} s={17}/></span><div><div className="op-kv">{v}</div><div className="op-kl">{t}</div></div></div>);}

const CSS=`
.op{--b:#E8712B}
.op-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.op-month{display:flex;align-items:center;gap:7px;background:#fff;border:1px solid #e6e9ee;border-radius:11px;padding:7px 11px;color:#64748b}
.op-month input{border:none;outline:none;font-family:inherit;font-size:13px;font-weight:700;color:#0f172a;background:none}
.op-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 15px;border-radius:11px;border:none;background:linear-gradient(135deg,#12b76a,#087443);color:#fff;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.op-btn:disabled{opacity:.5}
.op-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:12px}
.op-msg.ok{background:#e7f7ef;color:#087443}.op-msg.err{background:#feecea;color:#b42318}
.op-up{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.op-drop{background:#fff;border:1.5px dashed #d7dde5;border-radius:15px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;text-align:center;transition:.15s}
.op-drop:hover{border-color:var(--b);background:#fffdfb}
.op-drop.done{border-style:solid;border-color:#b7e4cd;background:#f6fdf9}
.op-drop-ic{width:42px;height:42px;border-radius:12px;background:#f4f5f7;color:#64748b;display:flex;align-items:center;justify-content:center}
.op-drop.done .op-drop-ic{background:#e7f7ef;color:#087443}
.op-drop-t{font-size:13px;font-weight:800;color:#0f172a}
.op-drop-d{font-size:10.5px;color:#94a3b8;font-weight:600;word-break:break-all}
.op-hint{display:flex;align-items:center;gap:7px;background:#fffbeb;border:1px solid #fde9c8;color:#92600e;font-size:11.5px;font-weight:600;border-radius:11px;padding:9px 12px;margin:12px 0}
.op-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.op-kpi{background:#fff;border:1px solid #eceef1;border-radius:15px;padding:13px;display:flex;align-items:center;gap:11px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.op-ki{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.op-kv{font-size:20px;font-weight:800;letter-spacing:-.5px}.op-kl{font-size:11.5px;color:#64748b;font-weight:600}
.op-sec{background:#fff;border:1px solid #eceef1;border-radius:16px;padding:14px;margin-bottom:14px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.op-sh{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;margin-bottom:12px}
.op-sh span{color:#94a3b8;font-weight:600;font-size:12px}
.op-tbl{width:100%;border-collapse:collapse;font-size:12.5px;white-space:nowrap}
.op-tbl th{font-size:10.5px;color:#94a3b8;font-weight:700;text-align:center;padding:8px 10px;border-bottom:1px solid #eceef1;background:#fafbfc}
.op-tbl th:first-child{text-align:right}
.op-tbl td{padding:9px 10px;border-bottom:1px solid #f1f3f5;text-align:center}
.op-tbl tr:last-child td{border-bottom:none}
.op-bk{text-align:right;font-weight:700}.op-bk small{color:#94a3b8;font-weight:600;margin-inline-start:5px}
.op-tbl td b{color:#E8712B;font-size:14px}
.op-mut{color:#cbd5e1}
.op-rt{background:#e7f7ef;color:#087443;border-radius:7px;padding:2px 8px;font-weight:800}
.op-cp{background:#feecea;color:#b42318;border-radius:7px;padding:2px 8px;font-weight:700}
.op-ok{display:inline-flex;align-items:center;gap:4px;color:#087443;font-weight:700}
.op-no{display:inline-flex;align-items:center;gap:4px;color:#b54708;font-weight:700}
.op-tk{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #f1f3f5}
.op-tk:last-child{border-bottom:none}
.op-tk-main{flex:1;min-width:0}
.op-tk-h{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:3px}
.op-tk-h b{font-size:13px}.op-tk-h small{color:#94a3b8}
.op-ref{background:#f4f5f7;border-radius:6px;padding:1px 7px;font-size:10px;color:#64748b;font-weight:700}
.op-no{background:#eef2f7;border:1px solid #dde3ec;border-radius:6px;padding:1px 7px;font-size:10px;color:#0f172a;font-weight:800;letter-spacing:.3px}
.op-sw{background:#f2f4f7;border:1px solid #e4e7ec;border-radius:6px;padding:1px 7px;font-size:10px;color:#475467;font-weight:800}
.op-sw.hot{color:#b54708;background:#fff4e8;border-color:#fddcb9}
.op-img{display:inline-flex;align-items:center;gap:3px;background:#eff6ff;color:#175cd3;border-radius:6px;padding:1px 7px;font-size:10px;font-weight:700}
.op-date{font-size:10.5px;color:#94a3b8}
.op-desc{font-size:12px;color:#475569;line-height:1.5}
.op-dec{display:flex;gap:6px;flex:none}
.op-d{display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:9px;border:1px solid #e6e9ee;background:#fff;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;color:#64748b}
.op-d.ap.on{background:#e7f7ef;border-color:#b7e4cd;color:#087443}
.op-d.rj.on{background:#feecea;border-color:#f7bfba;color:#b42318}
.op-empty{background:#fff;border:1px dashed #e6e9ee;border-radius:16px;padding:40px 24px;text-align:center}
.op-empty-ic{width:64px;height:64px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#fff2e8,#ffe2cc);color:var(--b)}
.op-empty h3{font-size:16px;margin:0 0 8px}.op-empty p{color:#64748b;font-size:12.5px;max-width:440px;margin:0 auto;line-height:1.7}
@media(max-width:720px){.op-up{grid-template-columns:1fr}.op-kpis{grid-template-columns:1fr 1fr}}
`;
