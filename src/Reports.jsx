import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{payoutForBiker}from"./sweaterContract";

const money=n=>Number(n||0).toLocaleString("en-US",{maximumFractionDigits:0})+" ﷼";
const int=n=>Number(n||0).toLocaleString("en-US");
const curMonth=()=>new Date().toISOString().slice(0,7);
const periodAr=p=>{if(!p)return"—";const[y,m]=String(p).split("-");const M=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];return`${M[(+m||1)-1]} ${y}`;};
const fmtD=d=>{if(!d)return"—";const s=String(d).slice(0,10),p=s.split("-");return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:s;};
const daysLeft=end=>{if(!end)return null;const t=new Date();t.setHours(0,0,0,0);return Math.round((new Date(String(end).slice(0,10)+"T00:00:00")-t)/86400000);};
const q=(t,c)=>supabase.from(t).select(c).then(({data})=>data||[]).then(x=>x,()=>[]);
function downloadCsv(name,header,rows){
  const esc=v=>{const s=String(v??"");return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  const csv="﻿"+[header,...rows].map(r=>r.map(esc).join(",")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download=name+".csv";a.click();
}

const CATALOG=[
  {g:"المالية",items:[
    {k:"margin",ar:"الهامش المالي",ic:"cash",ready:true,sub:"إيراد − تكاليف الشهر"},
    {k:"expenses",ar:"المصروفات حسب الفئة",ic:"vendors",ready:true,sub:"توزيع المصروفات والموردين"},
    {k:"payroll",ar:"مسير الرواتب",ic:"payroll",ready:false,sub:"قريباً"},
  ]},
  {g:"التشغيل",items:[
    {k:"bikers",ar:"أداء البايكرز",ic:"performance",ready:true,sub:"الغسلات والتقييم شهرياً"},
    {k:"sla",ar:"مؤشرات العقد SLA",ic:"target",ready:false,sub:"قريباً"},
  ]},
  {g:"الموارد البشرية والحوكمة",items:[
    {k:"compliance",ar:"تقرير الامتثال",ic:"id",ready:true,sub:"إقامات ووثائق ومهن"},
    {k:"funnel",ar:"قمع التوظيف",ic:"applicants",ready:true,sub:"من الإعلان للتقديم"},
  ]},
];

export default function Reports({opId}){
  const[active,setActive]=useState(null);
  const[period,setPeriod]=useState(curMonth());
  const cur=active&&CATALOG.flatMap(c=>c.items).find(i=>i.k===active);

  if(!active)return(<div className="rp">
    <style>{CSS}</style>
    <div className="rp-intro"><b>مركز التقارير</b><span>اختر تقريراً — كل تقرير بفلاتر وتصدير. التقارير المعلّمة «قريباً» تُفعَّل عند توفّر بياناتها.</span></div>
    {CATALOG.map(c=>(<div key={c.g} className="rp-sec">
      <div className="rp-sec-h">{c.g}</div>
      <div className="rp-grid">
        {c.items.map(it=>(
          <button key={it.k} className={"rp-card"+(it.ready?"":" soon")} disabled={!it.ready} onClick={()=>it.ready&&setActive(it.k)}>
            <span className="rp-ic"><Icon n={it.ic} s={20}/></span>
            <div><b>{it.ar}</b><small>{it.sub}</small></div>
            {it.ready?<Icon n="fwd" s={14}/>:<span className="rp-soon">قريباً</span>}
          </button>))}
      </div>
    </div>))}
  </div>);

  return(<div className="rp">
    <style>{CSS}</style>
    <div className="rp-bar">
      <button className="rp-back" onClick={()=>setActive(null)}><Icon n="back" s={15}/> التقارير</button>
      <b className="rp-title">{cur.ar}</b>
      {["margin","expenses","bikers"].includes(active)&&<div className="rp-per"><Icon n="calendar" s={14}/><input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/><span>{periodAr(period)}</span></div>}
    </div>
    {active==="margin"&&<MarginReport period={period}/>}
    {active==="expenses"&&<ExpensesReport period={period}/>}
    {active==="compliance"&&<ComplianceReport/>}
    {active==="bikers"&&<BikerReport period={period}/>}
    {active==="funnel"&&<FunnelReport/>}
  </div>);
}

function ExportBar({onCsv,waText}){
  return(<div className="rp-exp">
    <button onClick={onCsv}><Icon n="download" s={14}/> Excel/CSV</button>
    <button onClick={()=>window.print()}><Icon n="print" s={14}/> طباعة</button>
    {waText&&<button onClick={()=>window.open("https://wa.me/?text="+encodeURIComponent(waText),"_blank")}><Icon n="phone" s={14}/> مشاركة</button>}
  </div>);
}
function Kpi({l,n,c,sub}){return(<div className="rp-kpi"><span>{l}</span><b style={c?{color:c}:null}>{n}</b>{sub?<small>{sub}</small>:null}</div>);}
function Empty({t}){return(<div className="rp-empty"><Icon n="inbox" s={28}/><p>{t}</p></div>);}
function Bars({rows,max,fmt}){return(<div className="rp-bars">{rows.map((r,i)=>(<div className="rp-brow" key={i}><span className="rp-bl">{r.label}</span><div className="rp-bt"><div style={{width:Math.max(2,Math.round(r.val/(max||1)*100))+"%"}}/></div><span className="rp-bv">{fmt?fmt(r.val):int(r.val)}</span></div>))}</div>);}

// ── الهامش المالي ──
function MarginReport({period}){
  const[d,setD]=useState(null);
  useEffect(()=>{(async()=>{
    const[ops,pay,vexp,units,viol]=await Promise.all([
      q("ops_biker_month","period,net_washes"),q("payroll_lines","period,total"),
      q("vendor_expenses","exp_date,amount"),q("housing_units","annual_rent,active"),q("violations","fine_applied"),
    ]);setD({ops,pay,vexp,units,viol});
  })();},[]);
  const s=useMemo(()=>{if(!d)return null;
    const revenue=d.ops.filter(o=>o.period===period).reduce((a,o)=>a+payoutForBiker(Number(o.net_washes||0)).total,0);
    const payroll=d.pay.filter(p=>p.period===period).reduce((a,p)=>a+Number(p.total||0),0);
    const vendors=d.vexp.filter(e=>String(e.exp_date||"").slice(0,7)===period).reduce((a,e)=>a+Number(e.amount||0),0);
    const housing=d.units.filter(u=>u.active!==false).reduce((a,u)=>a+Number(u.annual_rent||0),0)/12;
    const fines=d.viol.reduce((a,v)=>a+Number(v.fine_applied||0),0);
    const costs=payroll+vendors+housing+fines;return{revenue,payroll,vendors,housing,fines,costs,margin:revenue-costs};
  },[d,period]);
  if(!s)return<div className="dw-skel" style={{height:200}}/>;
  const rows=[{label:"رواتب",val:s.payroll},{label:"موردون",val:s.vendors},{label:"إيجار السكن",val:s.housing},{label:"غرامات",val:s.fines}];
  const max=Math.max(...rows.map(r=>r.val),1);
  const wa=`تقرير الهامش — ${periodAr(period)}\nالإيراد: ${money(s.revenue)}\nالتكاليف: ${money(s.costs)}\nالهامش: ${money(s.margin)}`;
  return(<div className="rp-body">
    <div className="rp-kpis">
      <Kpi l="الإيراد التقديري" n={money(s.revenue)} c="#087443"/>
      <Kpi l="إجمالي التكاليف" n={money(s.costs)} c="#b42318"/>
      <Kpi l="الهامش" n={money(s.margin)} c={s.margin>=0?"#087443":"#b42318"}/>
      <Kpi l="نسبة الهامش" n={s.revenue?Math.round(s.margin/s.revenue*100)+"%":"—"}/>
    </div>
    <div className="rp-panel"><div className="rp-ph">توزيع التكاليف</div>
      {s.costs===0?<Empty t="لا تكاليف مسجّلة لهذا الشهر."/>:<Bars rows={rows} max={max} fmt={money}/>}
    </div>
    {s.revenue===0&&<p className="rp-note">الإيراد صفر لأن بيانات العمليات لهذا الشهر غير مُدخلة بعد — يظهر تلقائياً عند تشغيل تسوية سويتر.</p>}
    <ExportBar waText={wa} onCsv={()=>downloadCsv("margin_"+period,["البند","القيمة"],[["الإيراد",s.revenue],["رواتب",s.payroll],["موردون",s.vendors],["إيجار",s.housing.toFixed(0)],["غرامات",s.fines],["التكاليف",s.costs],["الهامش",s.margin]])}/>
  </div>);
}

// ── المصروفات حسب الفئة ──
function ExpensesReport({period}){
  const[d,setD]=useState(null);const[scope,setScope]=useState("all");
  useEffect(()=>{(async()=>{
    const[ve,vn]=await Promise.all([q("vendor_expenses","exp_date,amount,title,vendor_id"),q("vendors","id,name,category")]);
    setD({ve,vn});
  })();},[]);
  const s=useMemo(()=>{if(!d)return null;const vmap=Object.fromEntries(d.vn.map(v=>[v.id,v]));
    const rows=d.ve.filter(e=>scope==="all"||String(e.exp_date||"").slice(0,7)===period);
    const byCat={};rows.forEach(e=>{const c=(vmap[e.vendor_id]?.category)||"أخرى";byCat[c]=(byCat[c]||0)+Number(e.amount||0);});
    const cats=Object.entries(byCat).map(([label,val])=>({label,val})).sort((a,b)=>b.val-a.val);
    const total=cats.reduce((a,c)=>a+c.val,0);
    const list=rows.map(e=>({date:e.exp_date,vendor:vmap[e.vendor_id]?.name||"—",cat:vmap[e.vendor_id]?.category||"أخرى",title:e.title,amount:Number(e.amount||0)})).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    return{cats,total,list};
  },[d,scope,period]);
  if(!s)return<div className="dw-skel" style={{height:200}}/>;
  return(<div className="rp-body">
    <div className="rp-scope">
      <button className={scope==="all"?"on":""} onClick={()=>setScope("all")}>الكل</button>
      <button className={scope==="month"?"on":""} onClick={()=>setScope("month")}>{periodAr(period)}</button>
      <div style={{flex:1}}/><b>الإجمالي: {money(s.total)}</b>
    </div>
    <div className="rp-panel"><div className="rp-ph">حسب الفئة</div>
      {s.cats.length===0?<Empty t="لا مصروفات في النطاق المحدّد."/>:<Bars rows={s.cats} max={Math.max(...s.cats.map(c=>c.val),1)} fmt={money}/>}
    </div>
    <div className="rp-panel"><div className="rp-ph">تفصيل ({s.list.length})</div>
      <div className="rp-tblwrap"><table className="rp-tbl">
        <thead><tr><th>التاريخ</th><th>المورّد</th><th>الفئة</th><th>البيان</th><th>المبلغ</th></tr></thead>
        <tbody>{s.list.map((r,i)=>(<tr key={i}><td>{fmtD(r.date)}</td><td>{r.vendor}</td><td>{r.cat}</td><td>{r.title}</td><td>{money(r.amount)}</td></tr>))}
        {!s.list.length&&<tr><td colSpan={5} className="rp-empt">لا بيانات</td></tr>}</tbody>
      </table></div>
    </div>
    <ExportBar onCsv={()=>downloadCsv("expenses",["التاريخ","المورّد","الفئة","البيان","المبلغ"],s.list.map(r=>[fmtD(r.date),r.vendor,r.cat,r.title,r.amount]))}/>
  </div>);
}

// ── الامتثال ──
function ComplianceReport(){
  const[d,setD]=useState(null);
  useEffect(()=>{(async()=>{
    const[docs,emps]=await Promise.all([
      q("renewal_docs","doc_type,subject,end_date,active,subject_kind"),
      q("employees","full_name,employee_id,profession,profession_ok"),
    ]);setD({docs,emps});
  })();},[]);
  const s=useMemo(()=>{if(!d)return null;
    const docs=d.docs.filter(x=>x.active!==false&&x.subject_kind==="شخص"&&x.end_date).map(x=>({...x,days:daysLeft(x.end_date)})).sort((a,b)=>a.days-b.days);
    const mism=d.emps.filter(e=>e.profession_ok===false);
    return{docs,mism,exp:docs.filter(x=>x.days<0).length,d30:docs.filter(x=>x.days>=0&&x.days<=30).length,d90:docs.filter(x=>x.days>=0&&x.days<=90).length};
  },[d]);
  if(!s)return<div className="dw-skel" style={{height:200}}/>;
  const band=dd=>dd<0?["منتهية","#b42318","#feecea"]:dd<=30?["عاجلة","#c2410c","#ffedd5"]:dd<=90?["مراقبة","#1d5bbf","#eef4ff"]:["سارية","#087443","#e7f7ef"];
  return(<div className="rp-body">
    <div className="rp-kpis">
      <Kpi l="منتهية" n={s.exp} c="#b42318"/><Kpi l="عاجلة ≤30" n={s.d30} c="#c2410c"/>
      <Kpi l="خلال 90 يوماً" n={s.d90} c="#1d5bbf"/><Kpi l="مهن غير مطابقة" n={s.mism.length} c={s.mism.length?"#b54708":"#087443"}/>
    </div>
    <div className="rp-panel"><div className="rp-ph">وثائق الأفراد ({s.docs.length})</div>
      <div className="rp-tblwrap"><table className="rp-tbl">
        <thead><tr><th>النوع</th><th>الموظف</th><th>الانتهاء</th><th>المتبقّي</th><th>الحالة</th></tr></thead>
        <tbody>{s.docs.map((x,i)=>{const[t,c,bg]=band(x.days);return(<tr key={i}><td>{x.doc_type}</td><td>{x.subject}</td><td>{fmtD(x.end_date)}</td><td>{x.days<0?Math.abs(x.days)+" متأخرة":x.days+" يوم"}</td><td><span className="rp-badge" style={{color:c,background:bg}}>{t}</span></td></tr>);})}
        {!s.docs.length&&<tr><td colSpan={5} className="rp-empt">لا وثائق</td></tr>}</tbody>
      </table></div>
    </div>
    {s.mism.length>0&&<div className="rp-panel"><div className="rp-ph">مهن غير مطابقة للنشاط</div>
      <div className="rp-tblwrap"><table className="rp-tbl"><thead><tr><th>الموظف</th><th>المهنة المسجّلة</th></tr></thead>
      <tbody>{s.mism.map((e,i)=>(<tr key={i}><td>{e.full_name}{e.employee_id?" ("+e.employee_id+")":""}</td><td style={{color:"#b54708",fontWeight:700}}>{e.profession||"—"}</td></tr>))}</tbody></table></div>
    </div>}
    <ExportBar onCsv={()=>downloadCsv("compliance",["النوع","الموظف","الانتهاء","المتبقّي"],s.docs.map(x=>[x.doc_type,x.subject,fmtD(x.end_date),x.days]))}/>
  </div>);
}

// ── أداء البايكرز ──
function BikerReport({period}){
  const[rows,setRows]=useState(null);
  useEffect(()=>{q("ops_biker_month","period,biker_name,net_washes,rating,complaint_pct").then(d=>setRows(d));},[]);
  const s=useMemo(()=>{if(!rows)return null;const r=rows.filter(o=>o.period===period).sort((a,b)=>Number(b.net_washes||0)-Number(a.net_washes||0));return r;},[rows,period]);
  if(!s)return<div className="dw-skel" style={{height:200}}/>;
  const total=s.reduce((a,o)=>a+Number(o.net_washes||0),0);
  const max=Math.max(...s.map(o=>Number(o.net_washes||0)),1);
  return(<div className="rp-body">
    <div className="rp-kpis"><Kpi l="عدد البايكرز" n={s.length}/><Kpi l="إجمالي الغسلات" n={int(total)}/><Kpi l="متوسط/بايكر" n={s.length?int(Math.round(total/s.length)):0}/></div>
    <div className="rp-panel"><div className="rp-ph">الترتيب — {periodAr(period)}</div>
      {s.length===0?<Empty t="لا بيانات عمليات لهذا الشهر — تُدخَل من تسوية سويتر/العمليات."/>:
      <Bars rows={s.map(o=>({label:(o.biker_name||"—")+(o.rating?" · ⭐"+Number(o.rating).toFixed(1):""),val:Number(o.net_washes||0)}))} max={max}/>}
    </div>
    <ExportBar onCsv={()=>downloadCsv("bikers_"+period,["البايكر","الغسلات","التقييم","شكاوى%"],s.map(o=>[o.biker_name,o.net_washes,o.rating,o.complaint_pct]))}/>
  </div>);
}

// ── قمع التوظيف ──
function FunnelReport(){
  const[d,setD]=useState(null);
  useEffect(()=>{supabase.from("page_visits").select("step,session_id").eq("page","ad_page").then(({data})=>setD(data||[]),()=>setD([]));},[]);
  const s=useMemo(()=>{if(!d)return null;const sess={};d.forEach(v=>{const m=String(v.step||"").match(/^([0-9])/);if(!m)return;sess[v.session_id]=Math.max(sess[v.session_id]||0,+m[1]);});
    const sv=Object.values(sess);const reached=lv=>sv.filter(x=>x>=lv).length;const t0=reached(0)||sv.length;
    return{t0,steps:[["دخول الإعلان",reached(0)],["المزايا",reached(1)],["الحاسبة",reached(2)],["يوم في الحياة",reached(3)],["الأسئلة",reached(4)],["زر التقديم",reached(5)]]};
  },[d]);
  if(!s)return<div className="dw-skel" style={{height:200}}/>;
  return(<div className="rp-body">
    <div className="rp-panel"><div className="rp-ph">قمع التوظيف — كل الزيارات</div>
      {s.t0===0?<Empty t="لا زيارات مسجّلة بعد — شارك رابط الإعلان."/>:
      <Bars rows={s.steps.map(([label,val])=>({label:label+" ("+(s.t0?Math.round(val/s.t0*100):0)+"%)",val}))} max={s.t0}/>}
    </div>
    <ExportBar onCsv={()=>downloadCsv("funnel",["المرحلة","العدد","النسبة%"],s.steps.map(([l,v])=>[l,v,s.t0?Math.round(v/s.t0*100):0]))}/>
  </div>);
}

const CSS=`
.rp{--brand:#E8712B;--ink:#0f172a;--mut:#64748b;--line:#eceef1}
.rp *{box-sizing:border-box}
.rp-intro{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:14px}
.rp-intro b{font-size:15px;font-weight:800;display:block}.rp-intro span{font-size:12px;color:var(--mut)}
.rp-sec{margin-bottom:16px}
.rp-sec-h{font-size:12.5px;font-weight:800;color:var(--mut);margin:0 2px 9px}
.rp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:11px}
.rp-card{display:flex;align-items:center;gap:11px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;cursor:pointer;font-family:inherit;text-align:right;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.rp-card:hover:not(.soon){border-color:#f5c9a8;transform:translateY(-1px);transition:.15s}
.rp-card.soon{opacity:.6;cursor:default}
.rp-ic{width:40px;height:40px;border-radius:11px;background:#fff2e8;color:var(--brand);display:flex;align-items:center;justify-content:center;flex:none}
.rp-card b{font-size:13.5px;font-weight:800;display:block}.rp-card small{font-size:11px;color:var(--mut)}
.rp-card>div{flex:1;min-width:0}
.rp-soon{font-size:10px;font-weight:800;background:#f1f3f5;color:#94a3b8;padding:2px 8px;border-radius:20px}
.rp-bar{display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.rp-back{display:inline-flex;align-items:center;gap:5px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px 12px;font-family:inherit;font-size:12.5px;font-weight:700;color:#334155;cursor:pointer}
.rp-title{font-size:16px;font-weight:800;flex:1}
.rp-per{display:flex;align-items:center;gap:7px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:7px 11px;font-weight:700;font-size:12.5px}
.rp-per input{border:none;font-family:inherit;font-weight:700;outline:none}.rp-per span{color:var(--mut)}
.rp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:14px}
.rp-kpi{background:#fff;border:1px solid var(--line);border-radius:14px;padding:13px 15px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.rp-kpi span{font-size:11.5px;color:var(--mut);font-weight:700;display:block}
.rp-kpi b{font-size:20px;font-weight:800;margin-top:5px;display:block;letter-spacing:-.5px}
.rp-kpi small{font-size:10.5px;color:var(--mut)}
.rp-panel{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 1px 2px rgba(16,24,40,.05);margin-bottom:14px;overflow:hidden}
.rp-ph{font-size:13.5px;font-weight:800;padding:13px 16px;border-bottom:1px solid var(--line)}
.rp-bars{display:flex;flex-direction:column;gap:9px;padding:15px 16px}
.rp-brow{display:grid;grid-template-columns:150px 1fr 90px;align-items:center;gap:10px;font-size:12px}
.rp-bl{color:#334155;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rp-bt{height:22px;background:#f1f3f5;border-radius:7px;overflow:hidden}
.rp-bt div{height:100%;border-radius:7px;background:linear-gradient(90deg,var(--brand),#f5a35f)}
.rp-bv{font-weight:800;text-align:left;color:#0f172a}
.rp-tblwrap{overflow-x:auto}
.rp-tbl{width:100%;border-collapse:collapse;min-width:520px}
.rp-tbl th{font-size:11px;color:var(--mut);font-weight:700;text-align:right;padding:10px 14px;border-bottom:2px solid var(--line);background:#fafbfc;white-space:nowrap}
.rp-tbl td{padding:10px 14px;border-bottom:1px solid #f1f3f5;font-size:12.5px}
.rp-tbl tr:last-child td{border-bottom:none}
.rp-badge{font-size:10.5px;font-weight:800;padding:2px 9px;border-radius:20px}
.rp-empt{text-align:center;color:#94a3b8;padding:20px}
.rp-empty{text-align:center;color:#cbd5e1;padding:32px}.rp-empty p{color:#94a3b8;font-size:13px;margin-top:8px}
.rp-scope{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.rp-scope button{background:#fff;border:1px solid var(--line);border-radius:20px;padding:6px 14px;font-family:inherit;font-size:12px;font-weight:700;color:var(--mut);cursor:pointer}
.rp-scope button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.rp-scope b{font-size:13px}
.rp-exp{display:flex;gap:8px;flex-wrap:wrap}
.rp-exp button{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:9px 14px;font-family:inherit;font-size:12.5px;font-weight:700;color:#334155;cursor:pointer}
.rp-note{font-size:11.5px;color:#94a3b8;margin:0 2px 14px;line-height:1.7}
@media(max-width:820px){.rp-kpis{grid-template-columns:1fr 1fr}.rp-brow{grid-template-columns:110px 1fr 70px}}
@media print{.rp-bar,.rp-exp,.rp-back{display:none}}
`;
