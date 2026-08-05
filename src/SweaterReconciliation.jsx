import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";

const money=n=>Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})+" ﷼";
const int=n=>Number(n||0).toLocaleString("en-US");
const RATE=20; // ﷼ لكل طلب مُنفَّذ — السعر الثابت قبل أغسطس 2026 (يتحوّل للشرائح لاحقاً)
const MN=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const periodAr=p=>{if(!p)return"—";const[y,m]=String(p).split("-");return`${MN[(+m||1)-1]} ${y}`;};

const STATUS={
  draft:{ar:"مسودّة",bg:"#eef1f4",c:"#64748b"},
  sent:{ar:"مُرسَلة لسويتر",bg:"#eef4ff",c:"#1d5bbf"},
  acknowledged:{ar:"مُستلمة/قيد النظر",bg:"#fef3e2",c:"#b54708"},
  resolved:{ar:"مُسوّاة (حُصِّلت)",bg:"#e7f7ef",c:"#087443"},
  rejected:{ar:"مرفوضة",bg:"#feecea",c:"#b42318"},
};
const STATUS_ORDER=["draft","sent","acknowledged","resolved","rejected"];

// نظام مطابقة تقارير سويتر بالعقد وبناء المطالبة عن الطلبات غير المُحتسَبة
export default function SweaterReconciliation({owner}){
  const[daily,setDaily]=useState([]);
  const[adj,setAdj]=useState([]);
  const[setts,setSetts]=useState([]);
  const[fin,setFin]=useState([]);
  const[claims,setClaims]=useState([]);
  const[sel,setSel]=useState(null);
  const[loading,setLoading]=useState(true);
  const[busy,setBusy]=useState(false);
  const[msg,setMsg]=useState(null);
  const note=(ok,t)=>setMsg({ok,t});

  const load=async()=>{
    setLoading(true);
    const q=(t,c)=>supabase.from(t).select(c).then(({data})=>data||[],()=>[]);
    const[d,a,s,f,c]=await Promise.all([
      q("ops_daily","period,washes"),
      q("sweater_adjustments","period,kind,booking_ref,booking_date,biker_name,sweater_id,cancel_reason,booked_slot"),
      q("sweater_settlements","period,invoice_amount,invoice_ref,status"),
      q("finance_monthly","period,direction,category,amount"),
      q("sweater_claims","period,claim_orders,claim_amount,status,recovered_amount,sent_at,resolved_at,notes"),
    ]);
    setDaily(d);setAdj(a);setSetts(s);setFin(f);setClaims(c);setLoading(false);
  };
  useEffect(()=>{load();},[]);

  const rows=useMemo(()=>{
    const periods=[...new Set([...daily.map(x=>x.period),...adj.map(x=>x.period),...setts.map(x=>x.period)].filter(Boolean))].sort();
    return periods.map(p=>{
      const executed=daily.filter(x=>x.period===p).reduce((a,x)=>a+Number(x.washes||0),0);
      const items=adj.filter(x=>x.period===p);
      const adds=items.filter(x=>x.kind==="add");
      const deducts=items.filter(x=>x.kind==="deduct").length;
      const maint=items.filter(x=>x.kind==="maintenance").length;
      const st=setts.find(x=>x.period===p);
      const invoice=st?Number(st.invoice_amount||0):null;
      const received=fin.filter(x=>x.period===p&&x.direction==="in"&&x.category==="إيراد سويتر").reduce((a,x)=>a+Number(x.amount||0),0);
      const claimOrders=adds.length;
      const claimAmount=+(claimOrders*RATE).toFixed(2);
      const cl=claims.find(x=>x.period===p);
      const status=cl?cl.status:"draft";
      const recovered=cl?Number(cl.recovered_amount||0):0;
      return{p,executed,adds,claimOrders,claimAmount,deducts,maint,invoice,invoiceRef:st?st.invoice_ref:null,received,status,recovered,notes:cl?cl.notes:"",cl};
    });
  },[daily,adj,setts,fin,claims]);

  const tot=useMemo(()=>rows.reduce((a,r)=>({
    orders:a.orders+r.claimOrders,amount:a.amount+r.claimAmount,recovered:a.recovered+r.recovered,executed:a.executed+r.executed,
    open:a.open+((r.status==="resolved"||r.status==="rejected")?0:r.claimAmount),
  }),{orders:0,amount:0,recovered:0,executed:0,open:0}),[rows]);

  const selRow=rows.find(r=>r.p===sel);

  const saveClaim=async(period,patch)=>{
    if(!owner){note(false,"تعديل المطالبة مقصور على المالك");return;}
    setBusy(true);
    const base=rows.find(r=>r.p===period);
    const row={period,claim_orders:base?base.claimOrders:0,claim_amount:base?base.claimAmount:0,
      status:patch.status??base.status,recovered_amount:patch.recovered_amount??base.recovered,notes:patch.notes??base.notes,
      updated_at:new Date().toISOString()};
    if(row.status==="sent"&&!(base&&base.cl&&base.cl.sent_at))row.sent_at=new Date().toISOString();
    if(row.status==="resolved")row.resolved_at=new Date().toISOString();
    const{error}=await supabase.from("sweater_claims").upsert(row,{onConflict:"period"});
    if(error)note(false,"خطأ: "+error.message);else{note(true,"تم حفظ المطالبة — "+periodAr(period));await load();}
    setBusy(false);
  };

  const printClaim=(r)=>{
    const lines=r.adds.map((x,i)=>`<tr><td>${i+1}</td><td>${x.booking_ref||"—"}</td><td>${x.booking_date||"—"}</td><td>${x.biker_name||"—"}</td><td>${x.booked_slot||"—"}</td></tr>`).join("");
    const w=window.open("","_blank");if(!w)return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>مطالبة سويتر — ${periodAr(r.p)}</title>
    <style>body{font-family:Tahoma,Arial;padding:30px;color:#0f172a}h1{font-size:20px}h2{font-size:15px;color:#E8712B}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}th,td{border:1px solid #ccc;padding:7px;text-align:center}th{background:#f4f6f8}.tot{margin-top:16px;font-size:16px;font-weight:bold}.mut{color:#64748b;font-size:12px;line-height:1.8}</style></head><body>
    <h1>مطالبة مالية — دلو ورغوة (شريك سويتر 47)</h1>
    <h2>فترة: ${periodAr(r.p)}</h2>
    <p class="mut">الموضوع: طلبات مُنفَّذة (collect_payment) لم تُحتسَب ضمن فاتورة سويتر للفترة، ونطالب باحتسابها وفق العقد بسعر ${RATE}﷼ للطلب المكتمل.</p>
    <table><thead><tr><th>#</th><th>رقم الحجز</th><th>التاريخ</th><th>البايكر</th><th>الموعد</th></tr></thead><tbody>${lines||'<tr><td colspan=5>لا بنود</td></tr>'}</tbody></table>
    <p class="tot">إجمالي الطلبات المُطالَب بها: ${r.claimOrders} طلب × ${RATE}﷼ = ${money(r.claimAmount)}</p>
    <p class="mut">مرجع الفاتورة: ${r.invoiceRef||"—"} · قيمة الفاتورة المُصدَرة: ${r.invoice!=null?money(r.invoice):"—"}<br>وثيقة استرشادية مبنية على تقرير الحجوزات الرسمي من بوابة سويتر.</p>
    </body></html>`);
    w.document.close();setTimeout(()=>w.print(),300);
  };

  if(loading)return(<div className="dw-skel" style={{height:200}}/>);

  return(<div className="rc">
    <style>{CSS}</style>
    {msg&&msg.t&&<div className={"rc-toast"+(msg.ok?" ok":" err")} onClick={()=>setMsg(null)}>{msg.t}</div>}

    <div className="rc-kpis">
      <Kpi l="إجمالي المطالبة" n={money(tot.amount)} sub={`${int(tot.orders)} طلب غير مُحتسَب`} c="#E8712B" big/>
      <Kpi l="المُحصّل" n={money(tot.recovered)} sub="مبالغ استُردّت" c="#087443"/>
      <Kpi l="المتبقّي القائم" n={money(Math.max(0,tot.open-tot.recovered))} sub="مطالبات مفتوحة" c="#b54708"/>
      <Kpi l="طلباتنا المُنفَّذة" n={int(tot.executed)} sub="collect_payment (مرجع)" c="#1d5bbf"/>
    </div>

    <div className="rc-panel">
      <div className="rc-ph"><b>المطابقة الشهرية مع سويتر</b><span className="rc-hint">طلبات نُفّذت ولم تُحتسَب = بنود المطالبة · السعر {RATE}﷼/طلب</span></div>
      <div className="rc-tblwrap">
      <table className="rc-tbl">
        <thead><tr><th>الفترة</th><th>منفّذة</th><th>إضافات (مطالبة)</th><th>خصومات</th><th>صيانة</th><th>الفاتورة</th><th>قيمة المطالبة</th><th>الحالة</th><th></th></tr></thead>
        <tbody>
          {rows.map(r=>{const s=STATUS[r.status]||STATUS.draft;return(
            <tr key={r.p} className={sel===r.p?"on":""} onClick={()=>setSel(sel===r.p?null:r.p)}>
              <td className="rc-per">{periodAr(r.p)}</td>
              <td>{int(r.executed)}</td>
              <td>{r.claimOrders?<b className="rc-add">{r.claimOrders}</b>:"—"}</td>
              <td className={r.deducts?"rc-ded":""}>{r.deducts||"—"}</td>
              <td>{r.maint||"—"}</td>
              <td>{r.invoice!=null?money(r.invoice):"—"}</td>
              <td><b>{r.claimAmount?money(r.claimAmount):"—"}</b></td>
              <td><span className="rc-badge" style={{background:s.bg,color:s.c}}>{s.ar}</span></td>
              <td><Icon n="fwd" s={12} style={{transform:sel===r.p?"rotate(90deg)":"",opacity:.5}}/></td>
            </tr>);})}
          {!rows.length&&<tr><td colSpan={9} className="rc-empt">لا بيانات مطابقة — ارفع تقارير سويتر الشهرية.</td></tr>}
        </tbody>
        {rows.length>0&&<tfoot><tr><td>الإجمالي</td><td>{int(tot.executed)}</td><td><b className="rc-add">{tot.orders}</b></td><td colSpan={3}></td><td><b>{money(tot.amount)}</b></td><td colSpan={2}></td></tr></tfoot>}
      </table>
      </div>
    </div>

    {selRow&&<div className="rc-detail">
      <div className="rc-dh">
        <div><b>تفاصيل مطالبة {periodAr(selRow.p)}</b><span>{selRow.claimOrders} طلب غير مُحتسَب · {money(selRow.claimAmount)}</span></div>
        <div className="rc-dacts">
          <button className="rc-b ghost" onClick={()=>printClaim(selRow)}><Icon n="download" s={14}/> تصدير/طباعة المطالبة</button>
        </div>
      </div>

      <div className="rc-recon">
        <RC l="طلباتنا المُنفَّذة" v={int(selRow.executed)} sub="collect_payment"/>
        <RC l="قيمة مُتوقَّعة (عقد)" v={money(selRow.executed*RATE)} sub={`× ${RATE}﷼`}/>
        <RC l="فاتورة سويتر" v={selRow.invoice!=null?money(selRow.invoice):"—"} sub={selRow.invoiceRef||"—"}/>
        <RC l="غير مُحتسَب (مطالبة)" v={money(selRow.claimAmount)} sub={`${selRow.claimOrders} طلب`} hi/>
      </div>

      {selRow.adds.length>0?<div className="rc-items">
        <div className="rc-items-h">بنود المطالبة — طلبات مُنفَّذة غير مُحتسَبة</div>
        <div className="rc-tblwrap">
        <table className="rc-tbl sm">
          <thead><tr><th>#</th><th>رقم الحجز</th><th>التاريخ</th><th>البايكر</th><th>الموعد</th><th>القيمة</th></tr></thead>
          <tbody>{selRow.adds.map((x,i)=>(
            <tr key={i}><td>{i+1}</td><td>{x.booking_ref||"—"}</td><td>{x.booking_date||"—"}</td><td>{x.biker_name||"—"}</td><td>{x.booked_slot||"—"}</td><td>{money(RATE)}</td></tr>))}</tbody>
        </table>
        </div>
      </div>:<div className="rc-noitems">لا طلبات غير مُحتسَبة في هذه الفترة — المطابقة سليمة ✓</div>}

      <div className="rc-manage">
        <div className="rc-manage-h"><Icon n="compare" s={15}/> إدارة المطالبة {owner?"":"(عرض فقط — التعديل للمالك)"}</div>
        <div className="rc-mgrid">
          <label><span>حالة المطالبة</span>
            <select value={selRow.status} disabled={!owner||busy} onChange={e=>saveClaim(selRow.p,{status:e.target.value})}>
              {STATUS_ORDER.map(k=><option key={k} value={k}>{STATUS[k].ar}</option>)}
            </select>
          </label>
          <label><span>المبلغ المُحصّل (﷼)</span>
            <input type="number" defaultValue={selRow.recovered||""} disabled={!owner||busy} onBlur={e=>{const v=e.target.value===""?0:Number(e.target.value);if(v!==selRow.recovered)saveClaim(selRow.p,{recovered_amount:v});}}/>
          </label>
          <div className="rc-remain"><span>المتبقّي من هذه المطالبة</span><b>{money(Math.max(0,selRow.claimAmount-selRow.recovered))}</b></div>
        </div>
        <textarea className="rc-notes" placeholder="ملاحظات المطالبة (ردّ سويتر، مراسلات…)" defaultValue={selRow.notes||""} disabled={!owner||busy}
          onBlur={e=>{if((e.target.value||"")!==(selRow.notes||""))saveClaim(selRow.p,{notes:e.target.value});}}/>
      </div>
    </div>}

    <p className="rc-disc">تُبنى المطالبة على مقارنة تقرير الحجوزات الرسمي (collect_payment) بفاتورة سويتر للفترة نفسها. الطلبات المُنفَّذة غير المُحتسَبة تُدرَج كبنود مطالبة بسعر العقد ({RATE}﷼/طلب المكتمل قبل أغسطس 2026). الأرقام استرشادية للمطالبة الرسمية.</p>
  </div>);
}

function Kpi({l,n,sub,c,big}){return(<div className={"rc-kpi"+(big?" big":"")}><span className="rc-kl">{l}</span><b style={{color:c}}>{n}</b>{sub&&<em>{sub}</em>}</div>);}
function RC({l,v,sub,hi}){return(<div className={"rc-rc"+(hi?" hi":"")}><span>{l}</span><b>{v}</b>{sub&&<em>{sub}</em>}</div>);}

const CSS=`
.rc{--brand:#E8712B;--ink:#0f172a;--mut:#64748b;--line:#eceef1}
.rc *{box-sizing:border-box}
.rc-toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:80;padding:11px 18px;border-radius:12px;font-weight:700;font-size:13px;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer}
.rc-toast.ok{background:#087443}.rc-toast.err{background:#b42318}
.rc-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
.rc-kpi{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 15px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.rc-kpi.big{background:linear-gradient(135deg,#fff7f2,#fff)}
.rc-kl{font-size:11.5px;color:var(--mut);font-weight:700;display:block}
.rc-kpi b{font-size:20px;font-weight:800;margin-top:6px;display:block;letter-spacing:-.5px}
.rc-kpi.big b{font-size:23px}
.rc-kpi em{font-size:11px;color:#94a3b8;font-style:normal;font-weight:600;display:block;margin-top:3px}
.rc-panel{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 1px 2px rgba(16,24,40,.05);overflow:hidden;margin-bottom:14px}
.rc-ph{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 18px;border-bottom:1px solid var(--line)}
.rc-ph b{font-size:14px;font-weight:800}.rc-hint{font-size:11px;color:var(--mut)}
.rc-tblwrap{overflow-x:auto}
.rc-tbl{width:100%;border-collapse:collapse;min-width:720px}
.rc-tbl.sm{min-width:560px}
.rc-tbl th{font-size:10.5px;color:var(--mut);font-weight:700;padding:9px 8px;border-bottom:2px solid var(--line);background:#fafbfc;white-space:nowrap;text-align:center}
.rc-tbl td{padding:9px 8px;border-bottom:1px solid #f1f3f5;font-size:12.5px;text-align:center;white-space:nowrap}
.rc-tbl tbody tr{cursor:pointer}
.rc-tbl tbody tr:hover{background:#fafbfc}
.rc-tbl tbody tr.on{background:#fff7f1}
.rc-per{text-align:right;font-weight:700}
.rc-add{color:#087443;font-weight:800}
.rc-ded{color:#b54708}
.rc-badge{font-size:10.5px;font-weight:800;padding:3px 10px;border-radius:20px;white-space:nowrap}
.rc-tbl tfoot td{background:#fafbfc;font-size:12.5px;border-top:2px solid var(--line);border-bottom:none;font-weight:700}
.rc-empt,.rc-noitems{color:#94a3b8;padding:22px;text-align:center;font-size:12.5px}
.rc-detail{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 18px;box-shadow:0 1px 2px rgba(16,24,40,.05);margin-bottom:14px}
.rc-dh{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.rc-dh b{font-size:15px;font-weight:800}.rc-dh span{font-size:12px;color:var(--mut);margin-inline-start:10px}
.rc-b{display:inline-flex;align-items:center;gap:6px;padding:9px 13px;border-radius:11px;border:1px solid var(--line);background:#fff;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;color:var(--ink)}
.rc-b.ghost:hover{border-color:var(--brand);color:var(--brand)}
.rc-recon{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
.rc-rc{background:#f8fafc;border:1px solid var(--line);border-radius:12px;padding:11px 13px}
.rc-rc.hi{background:#fff7f1;border-color:#f7d7bf}
.rc-rc span{font-size:11px;color:var(--mut);font-weight:700;display:block}
.rc-rc b{font-size:16px;font-weight:800;display:block;margin-top:4px}
.rc-rc.hi b{color:var(--brand)}
.rc-rc em{font-size:10.5px;color:#94a3b8;font-style:normal;font-weight:600}
.rc-items{border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-bottom:14px}
.rc-items-h{padding:10px 14px;background:#fafbfc;border-bottom:1px solid var(--line);font-size:12.5px;font-weight:800}
.rc-manage{background:#fbfcfd;border:1px solid var(--line);border-radius:12px;padding:14px}
.rc-manage-h{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;margin-bottom:12px}
.rc-mgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;align-items:end}
.rc-mgrid label{display:flex;flex-direction:column;gap:5px}
.rc-mgrid span{font-size:11.5px;color:var(--mut);font-weight:700}
.rc-mgrid select,.rc-mgrid input{border:1px solid #dfe3e8;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:13px;font-weight:700;outline:none;background:#fff}
.rc-mgrid select:disabled,.rc-mgrid input:disabled{background:#f4f6f8;color:#64748b}
.rc-remain{background:#eef4ff;border-radius:10px;padding:8px 12px}
.rc-remain span{font-size:11px;color:var(--mut);font-weight:700;display:block}
.rc-remain b{font-size:16px;font-weight:800;color:#1d5bbf}
.rc-notes{width:100%;border:1px solid #dfe3e8;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:12.5px;margin-top:12px;resize:vertical;min-height:44px}
.rc-notes:disabled{background:#f4f6f8}
.rc-disc{font-size:11px;color:#94a3b8;line-height:1.7;margin:12px 2px 0}
@media(max-width:820px){.rc-kpis{grid-template-columns:1fr 1fr}.rc-recon{grid-template-columns:1fr 1fr}.rc-mgrid{grid-template-columns:1fr}}
`;
