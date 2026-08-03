import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{settlementLine,MIN_GUARANTEE_ORDERS,SSP_CONTRACT,tiersActive}from"./sweaterContract";

const money=n=>Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})+" ﷼";
const int=n=>Number(n||0).toLocaleString("en-US");
const curMonth=()=>new Date().toISOString().slice(0,7);
const periodAr=p=>{if(!p)return"—";const[y,m]=String(p).split("-");const M=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];return`${M[(+m||1)-1]} ${y}`;};

export default function Settlement({opId}){
  const[period,setPeriod]=useState(curMonth());
  const[head,setHead]=useState({invoice_amount:"",invoice_ref:"",notes:"",status:"draft"});
  const[lines,setLines]=useState([]);
  const[emps,setEmps]=useState([]);
  const[loading,setLoading]=useState(false);const[busy,setBusy]=useState(false);const[msg,setMsg]=useState(null);
  const note=(ok,t)=>setMsg({ok,t});
  const opv=(opId&&opId!=="all")?opId:null;

  useEffect(()=>{supabase.from("employees").select("id,full_name,employee_id,staff_role").order("full_name").then(({data})=>setEmps((data||[]).filter(e=>e.staff_role!=="manager")));},[]);
  const loadPeriod=async(p)=>{
    setLoading(true);
    const{data:h}=await supabase.from("sweater_settlements").select("*").eq("period",p).limit(1);
    if(h&&h[0]){
      const{data:ls}=await supabase.from("sweater_settlement_lines").select("*").eq("settlement_id",h[0].id);
      setHead({id:h[0].id,invoice_amount:h[0].invoice_amount??"",invoice_ref:h[0].invoice_ref||"",notes:h[0].notes||"",status:h[0].status||"draft"});
      setLines((ls||[]).map(l=>({employee_id:l.employee_id,biker_name:l.biker_name,orders:l.orders??0,rating:l.rating??"",complaints_pct:l.complaints_pct??"",tickets_pct:l.tickets_pct??""})));
    }else{setHead({invoice_amount:"",invoice_ref:"",notes:"",status:"draft"});setLines([]);}
    setLoading(false);
  };
  useEffect(()=>{loadPeriod(period);/*eslint-disable-next-line*/},[period]);

  const genFromOps=async()=>{
    const{data}=await supabase.from("ops_biker_month").select("employee_id,biker_name,net_washes,rating,complaint_pct").eq("period",period);
    if(!data||!data.length){note(false,"لا بيانات عمليات لهذه الفترة — أضِف البايكرز يدوياً");return;}
    setLines(data.map(o=>({employee_id:o.employee_id,biker_name:o.biker_name,orders:Number(o.net_washes||0),rating:o.rating??"",complaints_pct:o.complaint_pct??"",tickets_pct:""})));
    note(true,`تم توليد ${data.length} سطراً من العمليات`);
  };
  const addLine=()=>setLines([...lines,{employee_id:"",biker_name:"",orders:MIN_GUARANTEE_ORDERS,rating:"",complaints_pct:"",tickets_pct:""}]);
  const setLine=(i,k,v)=>setLines(lines.map((l,j)=>j===i?{...l,[k]:v}:l));
  const setLineEmp=(i,id)=>{const e=emps.find(x=>x.id===id);setLines(lines.map((l,j)=>j===i?{...l,employee_id:id,biker_name:e?e.full_name+(e.employee_id?" ("+e.employee_id+")":""):l.biker_name}:l));};
  const rmLine=i=>setLines(lines.filter((_,j)=>j!==i));

  const calc=useMemo(()=>lines.map(l=>({l,c:settlementLine({orders:l.orders,rating:l.rating,complaintsPct:l.complaints_pct,ticketsPct:l.tickets_pct,period})})),[lines,period]);
  const tot=useMemo(()=>calc.reduce((a,{c})=>({base:a.base+c.base,incentive:a.incentive+c.incentive,deduction:a.deduction+c.deduction,net:a.net+c.net}),{base:0,incentive:0,deduction:0,net:0}),[calc]);
  const invoice=Number(head.invoice_amount||0);
  const variance=+(tot.net-invoice).toFixed(2);

  const save=async(confirm)=>{
    setBusy(true);note(false,"");
    try{
      const hrow={operator_id:opv,period,status:confirm?"confirmed":"draft",invoice_amount:head.invoice_amount===""?null:Number(head.invoice_amount),invoice_ref:head.invoice_ref||null,
        gross_total:+tot.base.toFixed(2),incentive_total:+tot.incentive.toFixed(2),deduction_total:+tot.deduction.toFixed(2),net_total:+tot.net.toFixed(2),notes:head.notes||null,confirmed_at:confirm?new Date().toISOString():null};
      let id=head.id;
      if(id)await supabase.from("sweater_settlements").update(hrow).eq("id",id);
      else{const{data,error}=await supabase.from("sweater_settlements").insert(hrow).select("id").single();if(error)throw error;id=data.id;}
      await supabase.from("sweater_settlement_lines").delete().eq("settlement_id",id);
      const rows=calc.map(({l,c})=>({settlement_id:id,employee_id:l.employee_id||null,biker_name:l.biker_name||null,orders:Number(l.orders||0),
        rating:l.rating===""?null:Number(l.rating),complaints_pct:l.complaints_pct===""?null:Number(l.complaints_pct),tickets_pct:l.tickets_pct===""?null:Number(l.tickets_pct),
        tier:String(c.tier),unit_price:c.unit,base_amount:c.base,incentive:c.incentive,deduction:c.deduction,net:c.net}));
      if(rows.length)await supabase.from("sweater_settlement_lines").insert(rows);
      setHead(h=>({...h,id,status:confirm?"confirmed":"draft"}));
      note(true,confirm?"تم اعتماد التسوية":"تم حفظ المسودّة");
    }catch(e){note(false,"خطأ: "+(e.message||e));}
    setBusy(false);
  };

  return(<div className="se">
    <style>{CSS}</style>
    {msg&&msg.t&&<div className={"se-toast"+(msg.ok?" ok":" err")} onClick={()=>setMsg(null)}>{msg.t}</div>}

    <div className="se-bar">
      <div className="se-per"><Icon n="calendar" s={15}/><input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/><span>{periodAr(period)}</span>
        {head.status==="confirmed"&&<span className="se-conf"><Icon n="check" s={12}/> معتمدة</span>}</div>
      <div className="se-acts">
        <button className="se-b ghost" onClick={genFromOps}><Icon n="refresh" s={14}/> توليد من العمليات</button>
        <button className="se-b ghost" onClick={addLine}><Icon n="plus" s={14}/> إضافة بايكر</button>
      </div>
    </div>

    <div className="se-kpis">
      <Kpi l="الأساس (الملحق)" n={money(tot.base)} c="#1d5bbf"/>
      <Kpi l="الحوافز" n={money(tot.incentive)} c="#087443"/>
      <Kpi l="الخصومات" n={money(tot.deduction)} c="#b42318"/>
      <Kpi l="الصافي المستحق" n={money(tot.net)} c="#E8712B" big/>
    </div>

    {loading?<div className="dw-skel" style={{height:160}}/>:
    <div className="se-panel">
      <div className="se-ph"><b>سطور التسوية — {periodAr(period)}</b><span className="se-hint">{lines.length} بايكر · {tiersActive(period)?`نظام الشرائح · حدّ أدنى ${int(MIN_GUARANTEE_ORDERS)} طلب`:"سعر ثابت 20﷼/طلب (قبل أغسطس 2026)"}</span></div>
      <div className="se-tblwrap">
      <table className="se-tbl">
        <thead><tr><th>البايكر</th><th>الطلبات</th><th>الشريحة</th><th>السعر</th><th>الأساس</th><th>تقييم</th><th>شكاوى%</th><th>تذاكر%</th><th>حافز</th><th>خصم</th><th>الصافي</th><th></th></tr></thead>
        <tbody>
          {calc.map(({l,c},i)=>(<tr key={i}>
            <td className="se-emp"><select value={l.employee_id||""} onChange={e=>setLineEmp(i,e.target.value)}><option value="">— اختر —</option>{emps.map(x=><option key={x.id} value={x.id}>{x.full_name}{x.employee_id?" ("+x.employee_id+")":""}</option>)}</select></td>
            <td><input className="se-num" type="number" value={l.orders} onChange={e=>setLine(i,"orders",e.target.value)}/></td>
            <td><span className="se-tier">{typeof c.tier==="number"?"T"+c.tier:"G"}</span>{c.billableOrders>Number(l.orders||0)&&<em className="se-min" title="طُبِّق الحد الأدنى المضمون">⤴</em>}</td>
            <td>{money(c.unit)}</td>
            <td>{money(c.base)}</td>
            <td><input className="se-num sm" type="number" step="0.01" value={l.rating} onChange={e=>setLine(i,"rating",e.target.value)}/></td>
            <td><input className="se-num sm" type="number" step="0.1" value={l.complaints_pct} onChange={e=>setLine(i,"complaints_pct",e.target.value)}/></td>
            <td><input className="se-num sm" type="number" step="0.1" value={l.tickets_pct} onChange={e=>setLine(i,"tickets_pct",e.target.value)}/></td>
            <td className={c.incentive?"se-pos":""}>{c.incentive?money(c.incentive):"—"}</td>
            <td className={c.deduction?"se-neg":""}>{c.deduction?money(c.deduction):"—"}</td>
            <td><b>{money(c.net)}</b></td>
            <td><button className="se-x" onClick={()=>rmLine(i)}><Icon n="trash" s={13}/></button></td>
          </tr>))}
          {!lines.length&&<tr><td colSpan={12} className="se-empt">لا سطور — «توليد من العمليات» أو «إضافة بايكر».</td></tr>}
        </tbody>
        {lines.length>0&&<tfoot><tr><td>الإجمالي</td><td>{int(calc.reduce((a,{l})=>a+Number(l.orders||0),0))}</td><td colSpan={2}></td><td><b>{money(tot.base)}</b></td><td colSpan={3}></td><td className="se-pos"><b>{money(tot.incentive)}</b></td><td className="se-neg"><b>{money(tot.deduction)}</b></td><td><b>{money(tot.net)}</b></td><td></td></tr></tfoot>}
      </table>
      </div>
    </div>}

    <div className="se-recon">
      <div className="se-rec-h"><Icon n="compare" s={16}/> المطابقة مع فاتورة سويتر</div>
      <div className="se-rec-g">
        <label><span>قيمة الفاتورة (﷼)</span><input type="number" value={head.invoice_amount} onChange={e=>setHead({...head,invoice_amount:e.target.value})}/></label>
        <label><span>مرجع الفاتورة</span><input value={head.invoice_ref} onChange={e=>setHead({...head,invoice_ref:e.target.value})}/></label>
        <div className="se-var" style={{background:variance===0?"#e7f7ef":Math.abs(variance)<=1?"#eef4ff":"#feecea"}}>
          <span>الفرق (الصافي − الفاتورة)</span>
          <b style={{color:variance===0?"#087443":Math.abs(variance)<=1?"#1d5bbf":"#b42318"}}>{invoice?money(variance):"—"}</b>
        </div>
      </div>
      <textarea className="se-notes" placeholder="ملاحظات التسوية…" value={head.notes} onChange={e=>setHead({...head,notes:e.target.value})}/>
      <div className="se-save">
        <button className="se-b brand" disabled={busy} onClick={()=>save(false)}><Icon n="save" s={14}/> حفظ مسودّة</button>
        <button className="se-b green" disabled={busy||!lines.length} onClick={()=>save(true)}><Icon n="check" s={14}/> اعتماد التسوية</button>
      </div>
      <p className="se-disc">الاحتساب وفق ملحق التسعير (الشرائح) + حافز البند التاسع (+{money(SSP_CONTRACT.incentive)}/طلب عند تقييم ≥{SSP_CONTRACT.incentive_conditions.min_rating} وشكاوى ≤{SSP_CONTRACT.incentive_conditions.max_complaints_pct}%) − خصم تذاكر عند تجاوز {SSP_CONTRACT.incentive_conditions.max_complaints_pct}%. رقم استرشادي يُطابق بالفاتورة الرسمية.</p>
    </div>
  </div>);
}

function Kpi({l,n,c,big}){return(<div className={"se-kpi"+(big?" big":"")}><span className="se-kl">{l}</span><b style={{color:c}}>{n}</b></div>);}

const CSS=`
.se{--brand:#E8712B;--ink:#0f172a;--mut:#64748b;--line:#eceef1}
.se *{box-sizing:border-box}
.se-toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:80;padding:11px 18px;border-radius:12px;font-weight:700;font-size:13px;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer}
.se-toast.ok{background:#087443}.se-toast.err{background:#b42318}
.se-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.se-per{display:flex;align-items:center;gap:9px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px 12px;font-weight:700;color:var(--ink)}
.se-per input{border:none;font-family:inherit;font-size:13px;font-weight:700;outline:none}
.se-per span{color:var(--mut);font-size:12.5px}
.se-conf{display:flex;align-items:center;gap:4px;background:#e7f7ef;color:#087443;font-size:11px;font-weight:800;padding:2px 9px;border-radius:20px}
.se-acts{display:flex;gap:8px;flex-wrap:wrap}
.se-b{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:11px;border:1px solid var(--line);background:#fff;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;color:var(--ink)}
.se-b.brand{background:var(--brand);color:#fff;border-color:var(--brand)}
.se-b.green{background:#087443;color:#fff;border-color:#087443}
.se-b:disabled{opacity:.55}
.se-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
.se-kpi{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 15px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.se-kpi.big{background:linear-gradient(135deg,#fff7f2,#fff)}
.se-kl{font-size:11.5px;color:var(--mut);font-weight:700;display:block}
.se-kpi b{font-size:20px;font-weight:800;margin-top:6px;display:block;letter-spacing:-.5px}
.se-kpi.big b{font-size:23px}
.se-panel{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 1px 2px rgba(16,24,40,.05);overflow:hidden;margin-bottom:14px}
.se-ph{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 18px;border-bottom:1px solid var(--line)}
.se-ph b{font-size:14px;font-weight:800}.se-hint{font-size:11px;color:var(--mut)}
.se-tblwrap{overflow-x:auto}
.se-tbl{width:100%;border-collapse:collapse;min-width:820px}
.se-tbl th{font-size:10.5px;color:var(--mut);font-weight:700;padding:9px 8px;border-bottom:2px solid var(--line);background:#fafbfc;white-space:nowrap;text-align:center}
.se-tbl td{padding:7px 8px;border-bottom:1px solid #f1f3f5;font-size:12px;text-align:center;white-space:nowrap}
.se-tbl td:first-child{text-align:right}
.se-emp select{border:1px solid #dfe3e8;border-radius:8px;padding:6px 8px;font-family:inherit;font-size:12px;min-width:150px}
.se-num{width:66px;border:1px solid #dfe3e8;border-radius:8px;padding:6px;font-family:inherit;font-size:12px;text-align:center}
.se-num.sm{width:52px}
.se-tier{background:#eef4ff;color:#1d5bbf;font-weight:800;font-size:11px;padding:2px 7px;border-radius:7px}
.se-min{font-style:normal;color:#087443;margin-inline-start:4px;font-weight:800}
.se-pos{color:#087443;font-weight:700}.se-neg{color:#b42318;font-weight:700}
.se-x{border:none;background:#feecea;color:#b42318;width:26px;height:26px;border-radius:7px;cursor:pointer}
.se-tbl tfoot td{background:#fafbfc;font-size:12px;border-top:2px solid var(--line);border-bottom:none}
.se-empt{color:#94a3b8;padding:22px}
.se-recon{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 18px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.se-rec-h{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;margin-bottom:12px}
.se-rec-g{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:12px;align-items:end}
.se-rec-g label{display:flex;flex-direction:column;gap:5px}
.se-rec-g span{font-size:11.5px;color:var(--mut);font-weight:700}
.se-rec-g input{border:1px solid #dfe3e8;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:14px;font-weight:700;outline:none}
.se-var{display:flex;flex-direction:column;gap:3px;border-radius:11px;padding:8px 12px}
.se-var span{font-size:11px;color:var(--mut);font-weight:700}.se-var b{font-size:17px;font-weight:800}
.se-notes{width:100%;border:1px solid #dfe3e8;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:12.5px;margin-top:12px;resize:vertical;min-height:44px}
.se-save{display:flex;gap:10px;margin-top:12px}
.se-disc{font-size:11px;color:#94a3b8;line-height:1.7;margin:10px 0 0}
@media(max-width:820px){.se-kpis{grid-template-columns:1fr 1fr}.se-rec-g{grid-template-columns:1fr}}
`;
