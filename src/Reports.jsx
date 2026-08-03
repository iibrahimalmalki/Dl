import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{payoutForBiker,SSP_CONTRACT}from"./sweaterContract";

const money=n=>Number(n||0).toLocaleString("en-US",{maximumFractionDigits:0})+" ﷼";
const int=n=>Number(n||0).toLocaleString("en-US");
const curMonth=()=>new Date().toISOString().slice(0,7);
const periodAr=p=>{if(!p)return"—";const[y,m]=String(p).split("-");const M=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];return`${M[(+m||1)-1]} ${y}`;};
const fmtD=d=>{if(!d)return"—";const s=String(d).slice(0,10),p=s.split("-");return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:s;};
const daysLeft=end=>{if(!end)return null;const t=new Date();t.setHours(0,0,0,0);return Math.round((new Date(String(end).slice(0,10)+"T00:00:00")-t)/86400000);};
const q=(t,c)=>supabase.from(t).select(c).then(({data})=>data||[]).then(x=>x,()=>[]);
const prevPeriod=p=>{const[y,m]=String(p).split("-").map(Number);const d=new Date(y,(m||1)-2,1);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;};
const monthsBack=(p,n)=>{const[y,m]=String(p).split("-").map(Number);const out=[];for(let i=n-1;i>=0;i--){const d=new Date(y,(m||1)-1-i,1);out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);}return out;};
const shortMonth=p=>{const[y,m]=String(p).split("-");return`${["ينا","فبر","مار","أبر","ماي","يون","يول","أغس","سبت","أكت","نوف","ديس"][(+m||1)-1]} ${String(y).slice(2)}`;};
// إيراد الفترة: يفضّل صافي تسوية سويتر المعتمدة إن وُجد، وإلا التقدير من غسلات العمليات
const settledNet=(setts,p)=>{const r=(setts||[]).find(x=>x.period===p&&x.status==="confirmed"&&x.net_total!=null);return r?Number(r.net_total):null;};
const revForPeriod=(setts,ops,p)=>{const sn=settledNet(setts,p);if(sn!=null)return sn;return (ops||[]).filter(o=>o.period===p).reduce((a,o)=>a+payoutForBiker(Number(o.net_washes||0),p).total,0);};
function downloadCsv(name,header,rows){
  const esc=v=>{const s=String(v??"");return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  const csv="﻿"+[header,...rows].map(r=>r.map(esc).join(",")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download=name+".csv";a.click();
}

const CATALOG=[
  {g:"الإدارة",items:[
    {k:"exec",ar:"التقرير التنفيذي",ic:"dashboard",ready:true,sub:"لقطة شاملة على صفحة واحدة"},
    {k:"compare",ar:"المقارنة الزمنية",ic:"target",ready:true,sub:"الشهر الحالي مقابل السابق"},
  ]},
  {g:"المالية",items:[
    {k:"margin",ar:"الهامش المالي",ic:"cash",ready:true,sub:"إيراد − تكاليف الشهر"},
    {k:"cashflow",ar:"تدفّق النقد",ic:"cash",ready:true,sub:"داخل وخارج النقد شهرياً"},
    {k:"expenses",ar:"المصروفات حسب الفئة",ic:"vendors",ready:true,sub:"توزيع المصروفات والموردين"},
    {k:"payroll",ar:"مسير الرواتب",ic:"payroll",ready:true,sub:"الأساسي والحوافز شهرياً"},
  ]},
  {g:"التشغيل",items:[
    {k:"bikers",ar:"أداء البايكرز",ic:"performance",ready:true,sub:"الغسلات والتقييم شهرياً"},
    {k:"sla",ar:"مؤشرات العقد SLA",ic:"target",ready:true,sub:"الأداء مقابل التزامات العقد"},
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
    <div className="rp-print-hd">
      <img src="/brand-mark.png" alt="دلو ورغوة"/>
      <div><b>دلو ورغوة</b><span>{cur.ar}{["margin","expenses","bikers","sla","payroll","cashflow","compare","exec"].includes(active)?" · "+periodAr(period):""}</span></div>
      <div className="rp-print-meta">مؤسسة دلو ورغوة التجارية · SSP Partner 47</div>
    </div>
    <div className="rp-bar">
      <button className="rp-back" onClick={()=>setActive(null)}><Icon n="back" s={15}/> التقارير</button>
      <b className="rp-title">{cur.ar}</b>
      {["margin","expenses","bikers","sla","payroll","cashflow","compare","exec"].includes(active)&&<div className="rp-per"><Icon n="calendar" s={14}/><input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/><span>{periodAr(period)}</span></div>}
    </div>
    {active==="exec"&&<ExecReport period={period}/>}
    {active==="compare"&&<CompareReport period={period}/>}
    {active==="margin"&&<MarginReport period={period}/>}
    {active==="cashflow"&&<CashflowReport period={period}/>}
    {active==="payroll"&&<PayrollReport period={period}/>}
    {active==="expenses"&&<ExpensesReport period={period}/>}
    {active==="compliance"&&<ComplianceReport/>}
    {active==="bikers"&&<BikerReport period={period}/>}
    {active==="sla"&&<SLAReport period={period}/>}
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
    const[ops,pay,vexp,units,viol,setts]=await Promise.all([
      q("ops_biker_month","period,net_washes"),q("payroll_lines","period,total"),
      q("vendor_expenses","exp_date,amount"),q("housing_units","annual_rent,active"),q("violations","fine_applied"),
      q("sweater_settlements","period,net_total,status"),
    ]);setD({ops,pay,vexp,units,viol,setts});
  })();},[]);
  const s=useMemo(()=>{if(!d)return null;
    const revenue=revForPeriod(d.setts,d.ops,period);const revSettled=settledNet(d.setts,period)!=null;
    const payroll=d.pay.filter(p=>p.period===period).reduce((a,p)=>a+Number(p.total||0),0);
    const vendors=d.vexp.filter(e=>String(e.exp_date||"").slice(0,7)===period).reduce((a,e)=>a+Number(e.amount||0),0);
    const housing=d.units.filter(u=>u.active!==false).reduce((a,u)=>a+Number(u.annual_rent||0),0)/12;
    const fines=d.viol.reduce((a,v)=>a+Number(v.fine_applied||0),0);
    const costs=payroll+vendors+housing+fines;return{revenue,revSettled,payroll,vendors,housing,fines,costs,margin:revenue-costs};
  },[d,period]);
  if(!s)return<div className="dw-skel" style={{height:200}}/>;
  const rows=[{label:"رواتب",val:s.payroll},{label:"موردون",val:s.vendors},{label:"إيجار السكن",val:s.housing},{label:"غرامات",val:s.fines}];
  const max=Math.max(...rows.map(r=>r.val),1);
  const wa=`تقرير الهامش — ${periodAr(period)}\nالإيراد: ${money(s.revenue)}\nالتكاليف: ${money(s.costs)}\nالهامش: ${money(s.margin)}`;
  return(<div className="rp-body">
    <div className="rp-kpis">
      <Kpi l={s.revSettled?"الإيراد (تسوية معتمدة)":"الإيراد التقديري"} n={money(s.revenue)} c="#087443" sub={s.revSettled?"من تسوية سويتر":null}/>
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

// ── مسير الرواتب ──
function PayrollReport({period}){
  const[rows,setRows]=useState(null);
  useEffect(()=>{q("payroll_lines","period,role,name,level,base,net_bonus,total").then(d=>setRows(d));},[]);
  const s=useMemo(()=>{if(!rows)return null;
    const r=rows.filter(x=>x.period===period);
    const list=r.map(x=>({name:x.name||"—",role:x.role==="supervisor"?"مشرف":"بايكر",level:x.level||"—",base:Number(x.base||0),bonus:Number(x.net_bonus||0),total:Number(x.total||0)})).sort((a,b)=>b.total-a.total);
    const base=list.reduce((a,x)=>a+x.base,0);
    const bonus=list.reduce((a,x)=>a+x.bonus,0);
    const total=list.reduce((a,x)=>a+x.total,0);
    return{list,base,bonus,total,count:list.length};
  },[rows,period]);
  if(!s)return<div className="dw-skel" style={{height:200}}/>;
  const max=Math.max(...s.list.map(x=>x.total),1);
  const wa=`مسير الرواتب — ${periodAr(period)}\nالموظفون: ${s.count}\nالأساسي: ${money(s.base)}\nالحوافز: ${money(s.bonus)}\nالإجمالي: ${money(s.total)}`;
  return(<div className="rp-body">
    <div className="rp-kpis">
      <Kpi l="إجمالي المسير" n={money(s.total)} c="#b42318"/>
      <Kpi l="الأساسي" n={money(s.base)}/>
      <Kpi l="الحوافز الصافية" n={money(s.bonus)} c="#087443"/>
      <Kpi l="عدد الموظفين" n={int(s.count)}/>
    </div>
    <div className="rp-panel"><div className="rp-ph">توزيع المسير حسب الموظف</div>
      {s.count===0?<Empty t="لا مسير معتمد لهذا الشهر — يُنشأ من وحدة الرواتب."/>:
      <Bars rows={s.list.map(x=>({label:x.name,val:x.total}))} max={max} fmt={money}/>}
    </div>
    {s.count>0&&<div className="rp-panel"><div className="rp-ph">التفصيل ({s.count})</div>
      <div className="rp-tblwrap"><table className="rp-tbl">
        <thead><tr><th>الموظف</th><th>الدور</th><th>المستوى</th><th>الأساسي</th><th>الحوافز</th><th>الإجمالي</th></tr></thead>
        <tbody>{s.list.map((x,i)=>(<tr key={i}><td>{x.name}</td><td>{x.role}</td><td>{x.level}</td><td>{money(x.base)}</td><td>{money(x.bonus)}</td><td style={{fontWeight:800}}>{money(x.total)}</td></tr>))}</tbody>
      </table></div>
    </div>}
    <ExportBar waText={wa} onCsv={()=>downloadCsv("payroll_"+period,["الموظف","الدور","المستوى","الأساسي","الحوافز","الإجمالي"],s.list.map(x=>[x.name,x.role,x.level,x.base,x.bonus,x.total]))}/>
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

// ── مؤشرات العقد SLA ──
function SLAReport({period}){
  const[d,setD]=useState(null);
  useEffect(()=>{(async()=>{
    const[ops,rounds]=await Promise.all([
      q("ops_biker_month","period,net_washes,cancel_admin,cancel_client,rating,approved_complaints,complaint_pct"),
      q("field_rounds","period,compliance_pct"),
    ]);setD({ops,rounds});
  })();},[]);
  const s=useMemo(()=>{if(!d)return null;
    const o=d.ops.filter(x=>x.period===period);
    const washes=o.reduce((a,x)=>a+Number(x.net_washes||0),0);
    const cAdmin=o.reduce((a,x)=>a+Number(x.cancel_admin||0),0);
    const compl=o.reduce((a,x)=>a+Number(x.approved_complaints||0),0);
    const rated=o.filter(x=>x.rating!=null);
    const fulfil=(washes+cAdmin)>0?washes/(washes+cAdmin)*100:null;
    const avgRating=rated.length?rated.reduce((a,x)=>a+Number(x.rating||0),0)/rated.length:null;
    const complPct=washes>0?compl/washes*100:null;
    const rd=d.rounds.filter(x=>x.period===period&&x.compliance_pct!=null);
    const fieldComp=rd.length?rd.reduce((a,x)=>a+Number(x.compliance_pct||0),0)/rd.length:null;
    return{washes,cAdmin,compl,fulfil,avgRating,complPct,fieldComp,hasData:o.length>0,rounds:rd.length};
  },[d,period]);
  if(!s)return<div className="dw-skel" style={{height:200}}/>;
  const C=SSP_CONTRACT;
  // مؤشر: {الاسم، القيمة، الهدف، اتجاه (≥/≤)، صيغة}
  const pf=(val,target,dir)=>val==null?null:(dir==="ge"?val>=target:val<=target);
  const rows=[
    {k:"fulfil",l:"نسبة تنفيذ الطلبات",val:s.fulfil,target:C.sla.orders_fulfilled_pct,dir:"ge",fmt:v=>v==null?"—":v.toFixed(1)+"%",note:"غسلات ÷ (غسلات + إلغاء إداري)"},
    {k:"rating",l:"متوسط التقييم (شرط الحافز)",val:s.avgRating,target:C.incentive_conditions.min_rating,dir:"ge",fmt:v=>v==null?"—":v.toFixed(2)+" / 5",note:"حافز 1﷼/طلب عند ≥4.75"},
    {k:"compl",l:"نسبة الشكاوى المعتمدة",val:s.complPct,target:C.incentive_conditions.max_complaints_pct,dir:"le",fmt:v=>v==null?"—":v.toFixed(2)+"%",note:"خصم 1﷼/طلب عند تجاوز 1%"},
    {k:"field",l:"الامتثال الميداني",val:s.fieldComp,target:95,dir:"ge",fmt:v=>v==null?"—":Math.round(v)+"%",note:s.rounds?s.rounds+" جولة هذا الشهر":"لا جولات"},
  ];
  const met=rows.filter(r=>pf(r.val,r.target,r.dir)===true).length;
  const measured=rows.filter(r=>r.val!=null).length;
  const stColor=r=>{const p=pf(r.val,r.target,r.dir);return p==null?"#94a3b8":p?"#087443":"#b42318";};
  const stBg=r=>{const p=pf(r.val,r.target,r.dir);return p==null?"#f1f3f5":p?"#e7f7ef":"#feecea";};
  const stTxt=r=>{const p=pf(r.val,r.target,r.dir);return p==null?"لا بيانات":p?"مُحقّق":"دون الهدف";};
  const wa=`مؤشرات العقد SLA — ${periodAr(period)}\nمُحقّق: ${met}/${measured}\n`+rows.map(r=>`${r.l}: ${r.fmt(r.val)} (هدف ${r.dir==="ge"?"≥":"≤"}${r.target})`).join("\n");
  return(<div className="rp-body">
    <div className="rp-kpis">
      <Kpi l="مؤشرات مُحقّقة" n={measured?met+" / "+measured:"—"} c={met===measured&&measured?"#087443":"#c2410c"}/>
      <Kpi l="نسبة التنفيذ" n={s.fulfil!=null?s.fulfil.toFixed(1)+"%":"—"} c={s.fulfil==null?null:s.fulfil>=99?"#087443":"#b42318"} sub={"هدف ≥"+C.sla.orders_fulfilled_pct+"%"}/>
      <Kpi l="متوسط التقييم" n={s.avgRating!=null?s.avgRating.toFixed(2):"—"} c={s.avgRating==null?null:s.avgRating>=4.75?"#087443":"#c2410c"} sub="هدف ≥4.75"/>
      <Kpi l="الشكاوى" n={s.complPct!=null?s.complPct.toFixed(2)+"%":"—"} c={s.complPct==null?null:s.complPct<=1?"#087443":"#b42318"} sub="هدف ≤1%"/>
    </div>
    <div className="rp-panel"><div className="rp-ph">الأداء مقابل التزامات العقد — {periodAr(period)}</div>
      {!s.hasData?<Empty t="لا بيانات عمليات لهذا الشهر — تُدخَل من العمليات/تسوية سويتر."/>:
      <div className="rp-tblwrap"><table className="rp-tbl">
        <thead><tr><th>المؤشر</th><th>القيمة</th><th>الهدف</th><th>الحالة</th></tr></thead>
        <tbody>{rows.map(r=>(<tr key={r.k}><td>{r.l}<br/><small style={{color:"#94a3b8"}}>{r.note}</small></td><td style={{fontWeight:800}}>{r.fmt(r.val)}</td><td>{(r.dir==="ge"?"≥":"≤")+r.target+(r.k==="rating"?"":"%")}</td><td><span className="rp-badge" style={{color:stColor(r),background:stBg(r)}}>{stTxt(r)}</span></td></tr>))}</tbody>
      </table></div>}
    </div>
    <p className="rp-note">مؤشّرا «الالتزام بمواعيد التسليم» و«الوصول للموقع» (هدف ≥{C.sla.on_time_pct}% و≥{C.sla.arrival_pct}%) غير مُلتقَطة آلياً بعد — تُضاف عند ربط بيانات التتبّع من بوّابة سويتر.</p>
    <ExportBar waText={wa} onCsv={()=>downloadCsv("sla_"+period,["المؤشر","القيمة","الهدف","الحالة"],rows.map(r=>[r.l,r.fmt(r.val),(r.dir==="ge"?"≥":"≤")+r.target,stTxt(r)]))}/>
  </div>);
}

// ── قمع التوظيف ──
const stName=x=>x==="accepted"?"مقبول":x==="rejected"?"مرفوض":"معلّق";
const stBand=x=>x==="accepted"?["#087443","#e7f7ef"]:x==="rejected"?["#b42318","#feecea"]:["#c2410c","#fff5e8"];
const clsAr=c=>{const s=String(c||"").toLowerCase();if(/strong|قوي|excellent|ممتاز/.test(s))return"مرشّح قوي";if(/good|جيد|moderate|متوسط/.test(s))return"جيد";if(/weak|ضعيف|poor/.test(s))return"ضعيف";return c||"غير مصنّف";};
function FunnelReport(){
  const[d,setD]=useState(null);
  useEffect(()=>{(async()=>{
    const[visits,apps]=await Promise.all([
      supabase.from("page_visits").select("step,session_id").eq("page","ad_page").then(({data})=>data||[],()=>[]),
      q("applicants","full_name,application_number,status,ai_classification,ai_score_total,location,saudi_city,bangladesh_district,submitted_at"),
    ]);setD({visits,apps});
  })();},[]);
  const s=useMemo(()=>{if(!d)return null;
    const sess={};d.visits.forEach(v=>{const m=String(v.step||"").match(/^([0-9])/);if(!m)return;sess[v.session_id]=Math.max(sess[v.session_id]||0,+m[1]);});
    const sv=Object.values(sess);const reached=lv=>sv.filter(x=>x>=lv).length;const t0=reached(0)||sv.length;
    const steps=[["دخول الإعلان",reached(0)],["المزايا",reached(1)],["الحاسبة",reached(2)],["يوم في الحياة",reached(3)],["الأسئلة",reached(4)],["زر التقديم",reached(5)]];
    const A=d.apps;
    const accepted=A.filter(a=>a.status==="accepted").length;
    const rejected=A.filter(a=>a.status==="rejected").length;
    const pending=A.filter(a=>a.status==="pending"||!a.status).length;
    const submits=reached(5);const conv=submits?Math.round(A.length/submits*100):null;
    const byCls={};A.forEach(a=>{const c=clsAr(a.ai_classification);byCls[c]=(byCls[c]||0)+1;});
    const cls=Object.entries(byCls).map(([label,val])=>({label,val})).sort((a,b)=>b.val-a.val);
    const strong=A.filter(a=>/قوي/.test(clsAr(a.ai_classification))).length;
    const scored=A.filter(a=>a.ai_score_total!=null);
    const avgScore=scored.length?Math.round(scored.reduce((x,a)=>x+Number(a.ai_score_total||0),0)/scored.length):null;
    const recent=[...A].sort((a,b)=>String(b.submitted_at||"").localeCompare(String(a.submitted_at||""))).slice(0,20)
      .map(a=>({name:a.full_name||"—",num:a.application_number||"—",loc:a.saudi_city||a.location||a.bangladesh_district||"—",score:a.ai_score_total,cls:clsAr(a.ai_classification),status:a.status,date:a.submitted_at}));
    return{t0,steps,total:A.length,accepted,rejected,pending,conv,cls,strong,avgScore,recent,submits};
  },[d]);
  if(!s)return<div className="dw-skel" style={{height:200}}/>;
  return(<div className="rp-body">
    <div className="rp-kpis">
      <Kpi l="إجمالي المتقدّمين" n={int(s.total)} c="#1d5bbf"/>
      <Kpi l="مقبول" n={int(s.accepted)} c="#087443"/>
      <Kpi l="قيد المراجعة" n={int(s.pending)} c="#c2410c"/>
      <Kpi l="مرفوض" n={int(s.rejected)} c="#b42318"/>
    </div>
    <div className="rp-kpis">
      <Kpi l="مرشّحون أقوياء (AI)" n={int(s.strong)} c="#7c3aed"/>
      <Kpi l="متوسط درجة AI" n={s.avgScore!=null?s.avgScore:"—"}/>
      <Kpi l="زوّار وصلوا للتقديم" n={int(s.submits)}/>
      <Kpi l="تحوّل الزيارة→تقديم" n={s.conv!=null?s.conv+"%":"—"} sub="من ضغط زر التقديم"/>
    </div>
    <div className="rp-panel"><div className="rp-ph">قمع الزيارات — من الإعلان إلى التقديم</div>
      {s.t0===0?<Empty t="لا زيارات مسجّلة بعد — شارك رابط الإعلان."/>:
      <Bars rows={s.steps.map(([label,val])=>({label:label+" ("+(s.t0?Math.round(val/s.t0*100):0)+"%)",val}))} max={s.t0}/>}
    </div>
    {s.cls.length>0&&<div className="rp-panel"><div className="rp-ph">تصنيف الذكاء الاصطناعي</div>
      <Bars rows={s.cls} max={Math.max(...s.cls.map(c=>c.val),1)}/>
    </div>}
    <div className="rp-panel"><div className="rp-ph">أحدث المتقدّمين ({s.recent.length})</div>
      <div className="rp-tblwrap"><table className="rp-tbl">
        <thead><tr><th>الاسم</th><th>رقم الطلب</th><th>الموقع</th><th>درجة AI</th><th>التصنيف</th><th>الحالة</th></tr></thead>
        <tbody>{s.recent.map((a,i)=>{const[c,bg]=stBand(a.status);return(<tr key={i}><td>{a.name}</td><td>{a.num}</td><td>{a.loc}</td><td style={{fontWeight:800}}>{a.score!=null?a.score:"—"}</td><td>{a.cls}</td><td><span className="rp-badge" style={{color:c,background:bg}}>{stName(a.status)}</span></td></tr>);})}
        {!s.recent.length&&<tr><td colSpan={6} className="rp-empt">لا متقدّمين بعد</td></tr>}</tbody>
      </table></div>
    </div>
    <ExportBar
      waText={`قمع التوظيف\nالمتقدّمون: ${s.total}\nمقبول: ${s.accepted} · معلّق: ${s.pending} · مرفوض: ${s.rejected}\nمرشّحون أقوياء: ${s.strong}`}
      onCsv={()=>downloadCsv("applicants",["الاسم","رقم الطلب","الموقع","درجة AI","التصنيف","الحالة","التاريخ"],s.recent.map(a=>[a.name,a.num,a.loc,a.score,a.cls,stName(a.status),fmtD(a.date)]))}/>
  </div>);
}

// ── تدفّق النقد (6 أشهر) ──
function CashflowReport({period}){
  const[d,setD]=useState(null);
  useEffect(()=>{(async()=>{
    const[ops,pay,vexp,units,setts]=await Promise.all([
      q("ops_biker_month","period,net_washes"),q("payroll_lines","period,total"),
      q("vendor_expenses","exp_date,amount"),q("housing_units","annual_rent,active"),
      q("sweater_settlements","period,net_total,status"),
    ]);setD({ops,pay,vexp,units,setts});
  })();},[]);
  const s=useMemo(()=>{if(!d)return null;
    const months=monthsBack(period,6);
    const housM=d.units.filter(u=>u.active!==false).reduce((a,u)=>a+Number(u.annual_rent||0),0)/12;
    let cum=0;
    const rows=months.map(p=>{
      const inflow=revForPeriod(d.setts,d.ops,p);
      const payroll=d.pay.filter(x=>x.period===p).reduce((a,x)=>a+Number(x.total||0),0);
      const vendors=d.vexp.filter(e=>String(e.exp_date||"").slice(0,7)===p).reduce((a,e)=>a+Number(e.amount||0),0);
      const outflow=payroll+vendors+housM;
      const net=inflow-outflow;cum+=net;
      return{p,inflow,outflow,net,cum};
    });
    const tin=rows.reduce((a,r)=>a+r.inflow,0),tout=rows.reduce((a,r)=>a+r.outflow,0);
    return{rows,tin,tout,tnet:tin-tout,housM};
  },[d,period]);
  if(!s)return<div className="dw-skel" style={{height:200}}/>;
  const maxAbs=Math.max(...s.rows.map(r=>Math.abs(r.net)),1);
  const wa=`تدفّق النقد — 6 أشهر حتى ${periodAr(period)}\nداخل: ${money(s.tin)}\nخارج: ${money(s.tout)}\nصافي: ${money(s.tnet)}`;
  return(<div className="rp-body">
    <div className="rp-kpis">
      <Kpi l="النقد الداخل (6 أشهر)" n={money(s.tin)} c="#087443"/>
      <Kpi l="النقد الخارج" n={money(s.tout)} c="#b42318"/>
      <Kpi l="صافي التدفّق" n={money(s.tnet)} c={s.tnet>=0?"#087443":"#b42318"}/>
      <Kpi l="متوسط شهري" n={money(Math.round(s.tnet/6))}/>
    </div>
    <div className="rp-panel"><div className="rp-ph">صافي التدفّق الشهري</div>
      <div className="rp-bars">{s.rows.map((r,i)=>(<div className="rp-brow" key={i}>
        <span className="rp-bl">{shortMonth(r.p)}</span>
        <div className="rp-bt"><div style={{width:Math.max(2,Math.round(Math.abs(r.net)/maxAbs*100))+"%",background:r.net>=0?"linear-gradient(90deg,#087443,#32d583)":"linear-gradient(90deg,#b42318,#f97066)"}}/></div>
        <span className="rp-bv" style={{color:r.net>=0?"#087443":"#b42318"}}>{money(r.net)}</span>
      </div>))}</div>
    </div>
    <div className="rp-panel"><div className="rp-ph">التفصيل الشهري</div>
      <div className="rp-tblwrap"><table className="rp-tbl">
        <thead><tr><th>الشهر</th><th>داخل</th><th>خارج</th><th>صافي</th><th>تراكمي</th></tr></thead>
        <tbody>{s.rows.map((r,i)=>(<tr key={i}><td>{periodAr(r.p)}</td><td style={{color:"#087443"}}>{money(r.inflow)}</td><td style={{color:"#b42318"}}>{money(r.outflow)}</td><td style={{fontWeight:800,color:r.net>=0?"#087443":"#b42318"}}>{money(r.net)}</td><td style={{fontWeight:700}}>{money(r.cum)}</td></tr>))}</tbody>
      </table></div>
    </div>
    <p className="rp-note">النقد الداخل تقديري من غسلات العمليات وفق ملحق التسعير · الخارج = رواتب + موردون + حصّة إيجار السكن الشهرية ({money(Math.round(s.housM))}). الأشهر بلا بيانات عمليات تظهر داخلاً صفرياً.</p>
    <ExportBar waText={wa} onCsv={()=>downloadCsv("cashflow",["الشهر","داخل","خارج","صافي","تراكمي"],s.rows.map(r=>[periodAr(r.p),r.inflow,r.outflow.toFixed(0),r.net.toFixed(0),r.cum.toFixed(0)]))}/>
  </div>);
}

// ── المقارنة الزمنية (الحالي مقابل السابق) ──
function CompareReport({period}){
  const[d,setD]=useState(null);const prev=prevPeriod(period);
  useEffect(()=>{(async()=>{
    const[ops,pay,vexp,units,rounds,apps,setts]=await Promise.all([
      q("ops_biker_month","period,net_washes,rating,approved_complaints"),q("payroll_lines","period,total"),
      q("vendor_expenses","exp_date,amount"),q("housing_units","annual_rent,active"),
      q("field_rounds","period,compliance_pct"),q("applicants","status,submitted_at"),
      q("sweater_settlements","period,net_total,status"),
    ]);setD({ops,pay,vexp,units,rounds,apps,setts});
  })();},[]);
  const s=useMemo(()=>{if(!d)return null;
    const housM=d.units.filter(u=>u.active!==false).reduce((a,u)=>a+Number(u.annual_rent||0),0)/12;
    const calc=p=>{
      const o=d.ops.filter(x=>x.period===p);
      const washes=o.reduce((a,x)=>a+Number(x.net_washes||0),0);
      const revenue=revForPeriod(d.setts,d.ops,p);
      const payroll=d.pay.filter(x=>x.period===p).reduce((a,x)=>a+Number(x.total||0),0);
      const vendors=d.vexp.filter(e=>String(e.exp_date||"").slice(0,7)===p).reduce((a,e)=>a+Number(e.amount||0),0);
      const costs=payroll+vendors+housM;
      const rated=o.filter(x=>x.rating!=null);const rating=rated.length?rated.reduce((a,x)=>a+Number(x.rating),0)/rated.length:null;
      const rd=d.rounds.filter(x=>x.period===p&&x.compliance_pct!=null);const comp=rd.length?rd.reduce((a,x)=>a+Number(x.compliance_pct),0)/rd.length:null;
      const appsN=d.apps.filter(a=>String(a.submitted_at||"").slice(0,7)===p).length;
      return{washes,revenue,costs,margin:revenue-costs,rating,comp,apps:appsN};
    };
    return{cur:calc(period),prv:calc(prev)};
  },[d,period,prev]);
  if(!s)return<div className="dw-skel" style={{height:200}}/>;
  const M=[
    {k:"revenue",l:"الإيراد التقديري",cur:s.cur.revenue,prv:s.prv.revenue,fmt:money,up:true},
    {k:"costs",l:"التكاليف",cur:s.cur.costs,prv:s.prv.costs,fmt:money,up:false},
    {k:"margin",l:"الهامش",cur:s.cur.margin,prv:s.prv.margin,fmt:money,up:true},
    {k:"washes",l:"الغسلات",cur:s.cur.washes,prv:s.prv.washes,fmt:int,up:true},
    {k:"rating",l:"متوسط التقييم",cur:s.cur.rating,prv:s.prv.rating,fmt:v=>v==null?"—":v.toFixed(2),up:true},
    {k:"comp",l:"الامتثال الميداني",cur:s.cur.comp,prv:s.prv.comp,fmt:v=>v==null?"—":Math.round(v)+"%",up:true},
    {k:"apps",l:"المتقدّمون",cur:s.cur.apps,prv:s.prv.apps,fmt:int,up:true},
  ];
  const delta=(c,p)=>{if(c==null||p==null)return null;if(p===0)return c===0?0:null;return Math.round((c-p)/Math.abs(p)*100);};
  return(<div className="rp-body">
    <div className="rp-cmp-h"><span>{periodAr(prev)}</span><Icon n="fwd" s={14}/><b>{periodAr(period)}</b></div>
    <div className="rp-panel"><div className="rp-ph">المؤشرات — تغيّر الشهر عن سابقه</div>
      <div className="rp-tblwrap"><table className="rp-tbl">
        <thead><tr><th>المؤشر</th><th>{periodAr(prev)}</th><th>{periodAr(period)}</th><th>التغيّر</th></tr></thead>
        <tbody>{M.map(m=>{const dv=delta(m.cur,m.prv);const good=dv==null?null:(m.up?dv>=0:dv<=0);const c=dv==null||dv===0?"#64748b":good?"#087443":"#b42318";
          return(<tr key={m.k}><td>{m.l}</td><td>{m.fmt(m.prv)}</td><td style={{fontWeight:800}}>{m.fmt(m.cur)}</td>
          <td style={{color:c,fontWeight:800}}>{dv==null?"—":(dv>0?"▲ +":dv<0?"▼ ":"")+dv+"%"}</td></tr>);})}</tbody>
      </table></div>
    </div>
    <ExportBar
      waText={`مقارنة ${periodAr(prev)} ← ${periodAr(period)}\n`+M.map(m=>`${m.l}: ${m.fmt(m.prv)} → ${m.fmt(m.cur)}`).join("\n")}
      onCsv={()=>downloadCsv("compare",["المؤشر",periodAr(prev),periodAr(period),"التغيّر%"],M.map(m=>[m.l,m.fmt(m.prv),m.fmt(m.cur),delta(m.cur,m.prv)??"—"]))}/>
  </div>);
}

// ── التقرير التنفيذي (صفحة واحدة) ──
function ExecReport({period}){
  const[d,setD]=useState(null);
  useEffect(()=>{(async()=>{
    const[ops,pay,vexp,units,viol,rounds,apps,emps,setts]=await Promise.all([
      q("ops_biker_month","period,net_washes,rating,approved_complaints,complaint_pct"),q("payroll_lines","period,total"),
      q("vendor_expenses","exp_date,amount"),q("housing_units","annual_rent,active"),q("violations","fine_applied,status"),
      q("field_rounds","period,compliance_pct"),q("applicants","status,submitted_at"),q("employees","id,profession_ok"),
      q("sweater_settlements","period,net_total,status"),
    ]);setD({ops,pay,vexp,units,viol,rounds,apps,emps,setts});
  })();},[]);
  const s=useMemo(()=>{if(!d)return null;
    const o=d.ops.filter(x=>x.period===period);
    const washes=o.reduce((a,x)=>a+Number(x.net_washes||0),0);
    const revenue=revForPeriod(d.setts,d.ops,period);
    const payroll=d.pay.filter(x=>x.period===period).reduce((a,x)=>a+Number(x.total||0),0);
    const vendors=d.vexp.filter(e=>String(e.exp_date||"").slice(0,7)===period).reduce((a,e)=>a+Number(e.amount||0),0);
    const housM=d.units.filter(u=>u.active!==false).reduce((a,u)=>a+Number(u.annual_rent||0),0)/12;
    const costs=payroll+vendors+housM;
    const rated=o.filter(x=>x.rating!=null);const rating=rated.length?rated.reduce((a,x)=>a+Number(x.rating),0)/rated.length:null;
    const rd=d.rounds.filter(x=>x.period===period&&x.compliance_pct!=null);const comp=rd.length?Math.round(rd.reduce((a,x)=>a+Number(x.compliance_pct),0)/rd.length):null;
    const appsN=d.apps.filter(a=>String(a.submitted_at||"").slice(0,7)===period).length;
    const accepted=d.apps.filter(a=>a.status==="accepted"&&String(a.submitted_at||"").slice(0,7)===period).length;
    const mism=d.emps.filter(e=>e.profession_ok===false).length;
    return{washes,revenue,payroll,vendors,housM,costs,margin:revenue-costs,rating,comp,appsN,accepted,bikers:o.length,mism};
  },[d,period]);
  if(!s)return<div className="dw-skel" style={{height:200}}/>;
  const marginPct=s.revenue?Math.round(s.margin/s.revenue*100):null;
  return(<div className="rp-body">
    <div className="rp-sec-t">المالية</div>
    <div className="rp-kpis">
      <Kpi l="الإيراد التقديري" n={money(s.revenue)} c="#087443"/>
      <Kpi l="التكاليف" n={money(s.costs)} c="#b42318"/>
      <Kpi l="الهامش" n={money(s.margin)} c={s.margin>=0?"#087443":"#b42318"}/>
      <Kpi l="نسبة الهامش" n={marginPct!=null?marginPct+"%":"—"}/>
    </div>
    <div className="rp-sec-t">التشغيل</div>
    <div className="rp-kpis">
      <Kpi l="عدد البايكرز" n={int(s.bikers)}/>
      <Kpi l="إجمالي الغسلات" n={int(s.washes)}/>
      <Kpi l="متوسط التقييم" n={s.rating!=null?s.rating.toFixed(2):"—"} c={s.rating==null?null:s.rating>=4.75?"#087443":"#c2410c"}/>
      <Kpi l="الامتثال الميداني" n={s.comp!=null?s.comp+"%":"—"} c={s.comp==null?null:s.comp>=95?"#087443":"#c2410c"}/>
    </div>
    <div className="rp-sec-t">الموارد البشرية والحوكمة</div>
    <div className="rp-kpis">
      <Kpi l="متقدّمون هذا الشهر" n={int(s.appsN)}/>
      <Kpi l="مقبولون" n={int(s.accepted)} c="#087443"/>
      <Kpi l="مهن غير مطابقة" n={int(s.mism)} c={s.mism?"#b54708":"#087443"}/>
      <Kpi l="حصّة إيجار شهرية" n={money(Math.round(s.housM))}/>
    </div>
    <p className="rp-note">تقرير تنفيذي مختصر لفترة {periodAr(period)} — الأرقام المالية تقديرية من العمليات والمصروفات المسجّلة. للتفاصيل راجع التقارير المتخصّصة.</p>
    <ExportBar
      waText={`التقرير التنفيذي — ${periodAr(period)}\nالإيراد: ${money(s.revenue)}\nالتكاليف: ${money(s.costs)}\nالهامش: ${money(s.margin)} (${marginPct??"—"}%)\nالغسلات: ${int(s.washes)} · التقييم: ${s.rating!=null?s.rating.toFixed(2):"—"}\nالامتثال: ${s.comp??"—"}% · متقدّمون: ${s.appsN}`}
      onCsv={()=>downloadCsv("exec_"+period,["البند","القيمة"],[["الإيراد",s.revenue],["التكاليف",s.costs.toFixed(0)],["الهامش",s.margin.toFixed(0)],["نسبة الهامش%",marginPct??"—"],["الغسلات",s.washes],["التقييم",s.rating?.toFixed(2)??"—"],["الامتثال%",s.comp??"—"],["متقدّمون",s.appsN],["مقبولون",s.accepted]])}/>
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
.rp-cmp-h{display:flex;align-items:center;gap:10px;justify-content:center;background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px;margin-bottom:14px;font-size:13px;font-weight:700}
.rp-cmp-h span{color:var(--mut)}.rp-cmp-h b{font-size:14px;color:var(--brand)}
.rp-sec-t{font-size:12.5px;font-weight:800;color:var(--brand);margin:4px 2px 10px;padding-inline-start:8px;border-inline-start:3px solid var(--brand)}
@media(max-width:820px){.rp-kpis{grid-template-columns:1fr 1fr}.rp-brow{grid-template-columns:110px 1fr 70px}}
.rp-print-hd{display:none}
@media print{
  .rp-exp,.rp-back,.rp-per,.rp-scope{display:none !important}
  .rp-print-hd{display:flex;align-items:center;gap:12px;border-bottom:2px solid #E8712B;padding-bottom:10px;margin-bottom:12px}
  .rp-print-hd img{width:40px;height:40px;object-fit:contain;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .rp-print-hd b{font-size:16px;font-weight:800;display:block;color:#0f172a}
  .rp-print-hd span{font-size:12px;color:#64748b;font-weight:600}
  .rp-print-meta{margin-inline-start:auto;font-size:10px;color:#94a3b8;text-align:left}
  .rp-bar{display:none !important}
  .rp{font-size:12px}
  .rp-intro{display:none}
  .rp-kpis{grid-template-columns:repeat(4,1fr) !important;gap:8px}
  .rp-kpi,.rp-panel,.rp-card{box-shadow:none !important;border-color:#d7dde5 !important;break-inside:avoid}
  .rp-panel{break-inside:avoid}
  .rp-bars{break-inside:avoid}
  .rp-brow{grid-template-columns:150px 1fr 80px}
  .rp-bt div{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .rp-tbl{font-size:10.5px}.rp-tbl th,.rp-tbl td{padding:6px 8px}
  .rp-title{font-size:15px}
  .rp-badge,.rp-bt div,.rp-ic{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
`;
