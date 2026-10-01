import{useState,useEffect,useMemo,useRef,useCallback}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{useToast,Modal,Badge,EmptyState}from"./ui";
import{bikerScore,rankBikers,trend,teamSummary,monthDelta,nextHints,bikerBrief,LEVEL_AR}from"./scorecard";
import{dailySVG,sparkSVG}from"./perfCharts";
import{periodAr,downloadCardPdf}from"./perfExport";
import{waPhone}from"./renewalsLib";
import{honorData,honorHTML,shareHonor,downloadHonor,honorPNG,honorFileName}from"./honorCard";
import{downloadBlob}from"./exportKit";
import DataTable from"./DataTable";
import ChartTip from"./ChartTip";
import{ensureFonts}from"./exportKit";

// لوحة إنتاجية البايكر — بطاقة الأداء الشهرية (HR-POL-003 عبر scorecard.js/payrollEngine.js)
const nowPeriod=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;};
const shift=(p,k)=>{const[y,m]=p.split("-").map(Number);const d=new Date(y,m-1+k,1);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;};
const monthEnd=p=>{const[y,m]=p.split("-").map(Number);return`${p}-${String(new Date(y,m,0).getDate()).padStart(2,"0")}`;};
const n2=v=>Number(v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const n0=v=>Number(v||0).toLocaleString("en-US");
const sidOf=v=>String(v==null?"":v).trim();
export const rTone=v=>v>=0.75?"ok":v>=0.25?"warn":"bad";
const TR={up:"▲",down:"▼",flat:"■"};


async function safe(q){try{const r=await q;return r.error?{data:null,error:r.error}:r;}catch(e){return{data:null,error:e};}}

export default function Performance({opId,onNav}){
  const toast=useToast();
  const[period,setPeriod]=useState(null);
  const[loading,setLoading]=useState(true);
  const[D,setD]=useState(null);
  const[openSid,setOpenSid]=useState(null);
  const[busy,setBusy]=useState("");
  const[honor,setHonor]=useState(null);   // {sid,variant}
  const pendingOpen=useRef(null);
  const opF=useCallback(q=>(opId&&opId!=="all")?q.eq("operator_id",opId):q,[opId]);

  // الشهر الافتراضي: الحالي، وإلا آخر شهر له بيانات
  useEffect(()=>{(async()=>{
    const cur=nowPeriod();
    const{data}=await safe(opF(supabase.from("ops_biker_month").select("period").eq("period",cur)).limit(1));
    if(data&&data.length){setPeriod(cur);return;}
    const{data:last}=await safe(opF(supabase.from("ops_biker_month").select("period")).order("period",{ascending:false}).limit(1));
    setPeriod(last&&last[0]?last[0].period:cur);
  })();},[opF]);

  useEffect(()=>{if(!period)return;(async()=>{
    setLoading(true);
    const months=Array.from({length:6},(_,i)=>shift(period,i-5));   // 6 أشهر حتى المختار
    const prevP=shift(period,-1);
    let emps=await safe(supabase.from("employees").select("id,full_name,employee_id,team_id,staff_role,mobile,applicant_id").not("employee_id","is",null));
    if(emps.error)emps=await safe(supabase.from("employees").select("id,full_name,employee_id,team_id,mobile").not("employee_id","is",null));
    const[teams,ops,rounds,viol,tickets,runs]=await Promise.all([
      safe(supabase.from("teams").select("id,name")),
      safe(opF(supabase.from("ops_biker_month").select("*").in("period",months))),
      safe(opF(supabase.from("field_rounds").select("id,sweater_id,round_date,compliance_pct,effect,status")).gte("round_date",months[0]+"-01").lte("round_date",monthEnd(period)).order("round_date",{ascending:false})),
      safe(opF(supabase.from("violations").select("id,sweater_id,period,status,fine_applied,code")).eq("period",period).eq("status","confirmed")),
      safe(opF(supabase.from("ops_tickets").select("sweater_id,ticket_date,decision")).gte("ticket_date",period+"-01").lte("ticket_date",monthEnd(period))),
      safe(opF(supabase.from("payroll_runs").select("id").eq("period",period)).limit(1)),
    ]);
    // تسوية سويتر للشهر من العرض settlement_lines_v (period + sweater_id للبايكرز الظاهرين)
    const sids=[...new Set((ops.data||[]).filter(o=>o.period===period&&o.sweater_id!=null).map(o=>sidOf(o.sweater_id)))];
    const settle=sids.length?await safe(supabase.from("settlement_lines_v").select("period,sweater_id,employee_id,biker_name,orders,rating,tier,unit_price,base_amount,incentive,deduction,net,settlement_status").eq("period",period).in("sweater_id",sids)):{data:[]};
    let lines=[];if(runs.data&&runs.data[0]){const r=await safe(supabase.from("payroll_lines").select("*").eq("run_id",runs.data[0].id));lines=r.data||[];}
    const photos={};const appIds=(emps.data||[]).map(e=>e.applicant_id).filter(Boolean);
    if(appIds.length){const a=await safe(supabase.from("applicants").select("id,personal_photo_url").in("id",appIds));(a.data||[]).forEach(x=>{if(x.personal_photo_url)photos[x.id]=x.personal_photo_url;});}
    setD({period,prevP,months,emps:emps.data||[],teams:teams.data||[],ops:ops.data||[],rounds:rounds.data||[],viol:viol.data||[],tickets:tickets.data||[],lines,settle:settle.data||[],photos,
      missing:[["ops_tickets",tickets.error],["settlement_lines_v",settle.error],["applicants",null]].filter(x=>x[1]).map(x=>x[0])});
    setLoading(false);
  })();},[period,opF]);

  // تجميع البطاقات
  const M=useMemo(()=>{
    if(!D)return null;
    const empBySid={};D.emps.forEach(e=>{empBySid[sidOf(e.employee_id)]=e;});
    const teamName={};D.teams.forEach(t=>{teamName[t.id]=t.name;});
    const lineBySid={};D.lines.filter(l=>!l.role||l.role==="biker").forEach(l=>{const c=l.computed||{};const k=sidOf(l.biker_id||c.biker_id);if(k)lineBySid[k]=l;});
    const setBySid={};D.settle.forEach(x=>{const k=sidOf(x.sweater_id);if(k)setBySid[k]=x;});
    const by=(arr,k)=>{const m={};arr.forEach(x=>{const s=sidOf(x[k]);if(!s)return;(m[s]=m[s]||[]).push(x);});return m;};
    const rBy=by(D.rounds,"sweater_id"),vBy=by(D.viol,"sweater_id"),tBy=by(D.tickets,"sweater_id");
    const opsBy={};D.ops.forEach(o=>{const s=sidOf(o.sweater_id);if(!s)return;(opsBy[s]=opsBy[s]||{})[o.period]=o;});
    const mk=(o,p)=>{const s=sidOf(o.sweater_id);const l=lineBySid[s];const c=l&&(l.computed||l);
      return bikerScore(o,{rounds:(rBy[s]||[]).filter(r=>String(r.round_date)<=monthEnd(p)),violations:p===D.period?vBy[s]:[],settlement:p===D.period?setBySid[s]:null,level:(c&&c.level)||(l&&l.level)});};
    const cur=[],prev=[];
    Object.entries(opsBy).forEach(([s,byP])=>{
      const e=empBySid[s];if(e&&e.staff_role&&e.staff_role!=="biker")return;
      if(byP[D.prevP])prev.push(mk(byP[D.prevP],D.prevP));
      if(!byP[D.period])return;
      const sc=mk(byP[D.period],D.period);
      const ser=D.months.map(p=>byP[p]?bikerScore(byP[p]):null);
      const tk=tBy[s]||[];
      cur.push({...sc,name:(e&&e.full_name)||sc.name,cmp:sc.compliance?sc.compliance.pct:-1,
        emp:e||null,team:e&&e.team_id?teamName[e.team_id]||"":"",photo:e&&e.applicant_id?D.photos[e.applicant_id]||null:null,
        line:lineBySid[s]||null,violList:vBy[s]||[],tickets:{approved:tk.filter(t=>t.decision==="approved").length,pending:tk.filter(t=>t.decision==="pending").length,rejected:tk.filter(t=>t.decision==="rejected").length},
        prev:byP[D.prevP]?bikerScore(byP[D.prevP]):null,
        series:{labels:D.months,washes:ser.map(x=>x&&x.washes),rating:ser.map(x=>x&&x.rating||null),cpct:ser.map(x=>x&&x.complaintPct)},
        tr:trend(ser.map(x=>x&&x.washes))});
    });
    // الأول على فريقه (أو على الجميع إن لم يكن له فريق) — لعبارة بطاقة التكريم
    const topBy={};cur.forEach(x=>{const k=x.team||"_all";if(!topBy[k]||x.washes>topBy[k].washes)topBy[k]=x;});
    cur.forEach(x=>{x.isTop=topBy[x.team||"_all"]===x&&x.washes>0;});
    const ranked=rankBikers(cur,"washes");
    return{list:ranked,team:teamSummary(cur),teamPrev:prev.length?teamSummary(prev):null};
  },[D]);


  // فتح البطاقة من لوحة القيادة/البحث: dw:open {view:'performance',id:sweater_id}
  useEffect(()=>{
    const want=d=>d&&(d.view==="performance"||d.table==="ops_biker_month");
    const h=e=>{const d=e.detail||{};if(want(d))pendingOpen.current=sidOf(d.id);};
    window.addEventListener("dw:open",h);
    const last=window.__dwLast;if(last&&want(last)&&Date.now()-last.t<8000){window.__dwLast=null;pendingOpen.current=sidOf(last.id);}
    return()=>window.removeEventListener("dw:open",h);
  },[]);
  useEffect(()=>{if(M&&pendingOpen.current){const s=pendingOpen.current;pendingOpen.current=null;if(M.list.some(x=>x.sid===s))setOpenSid(s);}});

  if(!period||loading)return <div className="g-skel" style={{height:300}}/>;
  const T=M.team,TP=M.teamPrev;
  const kd=(c,p,{fmt=n0,inv=false,unit=""}={})=>{if(p==null)return null;const d=monthDelta(c,p);if(d.diff==null)return null;const good=inv?d.dir==="down":d.dir==="up";
    return<div className={"g-kpi-d "+(d.dir==="flat"?"":good?"up":"down")}>{TR[d.dir]} {fmt(Math.abs(d.diff))}{unit} عن {periodAr(D.prevP)}</div>;};
  const open=M.list.find(x=>x.sid===openSid)||null;

  const teamOpts=[...new Set(M.list.map(x=>x.team).filter(Boolean))].sort();
  const dtCols=[
    {k:"rank",label:"#",num:true,hideSm:true,render:s=><span className={"pf-rank r"+s.rank}>{s.rank}</span>},
    {k:"name",label:"البايكر",search:true,value:s=>s.name+" "+s.sid,render:s=><div className="pf-who"><Av s={s}/><div><b>{s.name}</b><small>#{s.sid}{s.team?" · "+s.team:""}</small></div><span className={"pf-tr "+s.tr.dir} title={`الاتجاه ${s.tr.pct}%`}>{TR[s.tr.dir]}</span></div>},
    {k:"washes",label:"الغسلات",num:true,render:s=><b>{n0(s.washes)}</b>},
    {k:"dailyAvg",label:"متوسط يومي",num:true,hideSm:true,render:s=>s.workDays?<span className="pf-nw" dir="rtl">{s.dailyAvg}<small> /يوم · {s.workDays} ي</small></span>:"—"},
    {k:"rating",label:"التقييم",num:true,render:s=>s.rating?s.rating.toFixed(2):"—"},
    {k:"complaintPct",label:"الشكاوى",num:true,render:s=><span className="pf-nw" dir="rtl">{s.complaintPct}%<small> · {s.complaints}</small></span>},
    {k:"cmp",label:"الالتزام",num:true,render:s=>s.compliance?<Badge tone={s.compliance.pct>=80?"ok":s.compliance.pct>=60?"warn":"bad"}>{s.compliance.pct}%</Badge>:"—"},
    {k:"qR",label:"ريال الجودة",num:true,hideSm:true,render:s=><Badge tone={rTone(s.qR)}>{s.qR.toFixed(2)}</Badge>},
    {k:"sR",label:"ريال السلامة",num:true,hideSm:true,render:s=><Badge tone={rTone(s.sR)}>{s.sR.toFixed(2)}</Badge>},
    {k:"ratePerWash",label:"أجر الغسلة",num:true,render:s=><b>{n2(s.ratePerWash)}</b>},
    {k:"bonusBase",label:"العمولة المتوقعة",num:true,hideSm:true,render:s=>n2(s.bonusBase)},
    {k:"production",label:"مكافأة الإنتاج",num:true,render:s=>s.production?<Badge tone="brand">+{s.production}</Badge>:<span className="pf-mut">{s.nextProduction?`تبقّى ${s.nextProduction.gap}`:"—"}</span>},
    {k:"fines",label:"المخالفات (ر)",num:true,render:s=>s.fines?<span style={{color:"var(--bad-ink)",fontWeight:700}}>{n2(s.fines)}</span>:"—"},
  ];
  const sendWa=s=>{const m=s.emp&&s.emp.mobile;if(!m){toast.warn("لا يوجد جوال مسجّل لهذا البايكر");return;}window.open("https://wa.me/"+waPhone(m)+"?text="+encodeURIComponent(bikerBrief(s,"both")),"_blank");};
  const copy=async s=>{try{await navigator.clipboard.writeText(bikerBrief(s,"both"));toast.ok("نُسخ الملخص");}catch(_){toast.bad("تعذّر النسخ");}};
  const pdf=async s=>{setBusy("pdf");try{await downloadCardPdf(s,{name:s.name,sid:s.sid,team:s.team,photo:s.photo,line:s.line,violations:s.violList,series:s.series});toast.ok("تم تنزيل بطاقة "+s.name);}catch(e){toast.bad("تعذّر إنشاء PDF",String(e.message||e));}setBusy("");};
  const hd=(s,variant)=>honorData(s,{name:s.name,nameAr:s.emp&&(s.emp.full_name_ar||s.emp.name_ar),photo:s.photo,prev:s.prev,isTop:s.isTop,variant});
  const hShare=async(s,v)=>{setBusy("honor");try{const r=await shareHonor(hd(s,v));toast.ok(r==="shared"?"تمت المشاركة":r==="cancelled"?"أُلغيت المشاركة":"تم تنزيل الصورة");}catch(e){toast.bad("تعذّر إنشاء البطاقة",String(e.message||e));}setBusy("");};
  const hDown=async(s,v)=>{setBusy("honor");try{await downloadHonor(hd(s,v));toast.ok("تم تنزيل بطاقة "+s.name);}catch(e){toast.bad("تعذّر إنشاء البطاقة",String(e.message||e));}setBusy("");};
  // بطاقات الشهر لكل البايكرز — ملف zip واحد (JSZip يُحمَّل عند الحاجة)
  const allCards=async()=>{if(!M||!M.list.length)return;setBusy("all");
    try{const{default:JSZip}=await import("jszip");const zip=new JSZip();
      for(let i=0;i<M.list.length;i++){const s=M.list[i];setBusy(`all:${i+1}/${M.list.length}`);const d=hd(s,"honor");zip.file(honorFileName(d),await honorPNG(d));}
      setBusy("all:zip");const blob=await zip.generateAsync({type:"blob",compression:"STORE"});
      downloadBlob(blob,`honor-cards-${period}.zip`);toast.ok(`تم تنزيل ${M.list.length} بطاقة في ملف واحد`);}
    catch(e){toast.bad("توقّف التوليد",String(e.message||e));}setBusy("");};
  const goRounds=s=>{onNav&&onNav("field_rounds");setTimeout(()=>window.dispatchEvent(new CustomEvent("dw:open",{detail:{view:"field_rounds",table:"field_rounds",id:s.rounds[0]&&s.rounds[0].id,sweater_id:s.sid}})),300);};

  return(<div className="pf">
    <style>{CSS}</style>
    <div className="pf-bar">
      <label className="pf-month"><Icon n="calendar" s={16}/><input type="month" value={period} onChange={e=>e.target.value&&setPeriod(e.target.value)}/></label>
      <span className="pf-plabel">{periodAr(period)}{opId&&opId!=="all"?" · مشغّل محدّد":""}</span>
      <div style={{flex:1}}/>
      {M.list.length>0&&<button className="g-btn" onClick={allCards} disabled={!!busy} title="بطاقة تكريم PNG لكل بايكر في ملف zip واحد"><Icon n="star" s={15}/> {busy==="all:zip"?"جارٍ الضغط…":busy.startsWith("all")?`جارٍ التوليد ${busy.slice(4)}`:"بطاقات الشهر"}</button>}
    </div>

    {M.list.length===0?<div className="g-card"><EmptyState variant="stack" title={`لا بيانات أداء في ${periodAr(period)}`} text="الأداء يُبنى من تقرير سويتر الشهري (الغسلات والتقييم والشكاوى). ارفع التقرير في العمليات اليومية.">
      <button className="g-btn primary" onClick={()=>onNav&&onNav("operations")}><Icon n="operations" s={15}/> فتح العمليات اليومية</button></EmptyState></div>:<>

    <div className="g-grid c4 pf-kpis">
      <div className="g-card g-kpi"><div className="g-kpi-l">غسلات الفريق<Icon n="operations" s={16}/></div><div className="g-kpi-n">{n0(T.washes)}</div>{kd(T.washes,TP&&TP.washes)}</div>
      <div className="g-card g-kpi"><div className="g-kpi-l">متوسط التقييم (مرجّح)<Icon n="star" s={16}/></div><div className="g-kpi-n">{T.rating?T.rating.toFixed(2):"—"}</div>{kd(T.rating,TP&&TP.rating,{fmt:v=>v.toFixed(2)})}</div>
      <div className="g-card g-kpi"><div className="g-kpi-l">نسبة الشكاوى<Icon n="complaints" s={16}/></div><div className="g-kpi-n">{T.complaintPct}%</div>{kd(T.complaintPct,TP&&TP.complaintPct,{fmt:v=>v.toFixed(2),inv:true,unit:"%"})}</div>
      <div className="g-card g-kpi"><div className="g-kpi-l">متوسط الالتزام<Icon n="rounds" s={16}/></div><div className="g-kpi-n">{T.compliance!=null?T.compliance+"%":"—"}</div>{kd(T.compliance,TP&&TP.compliance,{unit:"%"})}</div>
      <div className="g-card g-kpi"><div className="g-kpi-l">العمولة المتوقعة<Icon n="cash" s={16}/></div><div className="g-kpi-n">{n0(Math.round(T.bonusBase))}<small> ر</small></div>{kd(T.bonusBase,TP&&TP.bonusBase,{fmt:v=>n0(Math.round(v))})}</div>
    </div>

    <div className="g-card pf-tw"><DataTable caption={`ترتيب البايكرز — ${periodAr(period)}`} rows={M.list} rowKey={r=>r.sid} columns={dtCols} initialSort={{k:"washes",dir:-1}}
      pageSize={20} compact searchPlaceholder="بحث بالاسم أو الرقم…" onRowClick={r=>setOpenSid(r.sid)}
      filters={teamOpts.length>1?[{k:"team",label:"الفريق",options:teamOpts}]:[]}/></div>
    <div className="pf-legend"><Badge tone="ok" dot>≥ 0.75 ر</Badge><Badge tone="warn" dot>0.25–0.50 ر</Badge><Badge tone="bad" dot>0 ر</Badge><span>أجر الغسلة = 2 + ريال الجودة + ريال السلامة (HR-POL-003) · الأرقام متوقعة حتى اعتماد المسير.</span></div>
    </>}

    <Modal open={!!open} onClose={()=>setOpenSid(null)} size="lg" title={open?open.name:""} sub={open?`#${open.sid}${open.team?" · "+open.team:""} · ${periodAr(period)}`:""}
      foot={open&&<>
        <button className="g-btn" onClick={()=>copy(open)}><Icon n="doc" s={15}/> نسخ الملخص</button>
        <button className="g-btn" onClick={()=>setHonor({sid:open.sid,variant:"honor"})}><Icon n="star" s={15}/> بطاقة تكريم</button>
        <button className="g-btn" onClick={()=>pdf(open)} disabled={busy==="pdf"}><Icon n="download" s={15}/> {busy==="pdf"?"جارٍ الإنشاء…":"تنزيل PDF"}</button>
        <button className="g-btn primary" onClick={()=>sendWa(open)}><Icon n="send" s={15}/> رسالة للبايكر</button></>}>
      {open&&<Card s={open} onRounds={()=>goRounds(open)}/>}
    </Modal>

    {(()=>{const hs=honor&&M.list.find(x=>x.sid===honor.sid);return(
    <Modal open={!!hs} onClose={()=>setHonor(null)} size="lg" title="بطاقة التكريم" sub={hs?`${hs.name} · ${periodAr(period)} · 1280×720`:""}
      foot={hs&&<>
        <button className="g-btn" onClick={()=>hDown(hs,honor.variant)} disabled={busy==="honor"}><Icon n="download" s={15}/> تنزيل PNG</button>
        <button className="g-btn primary" onClick={()=>hShare(hs,honor.variant)} disabled={busy==="honor"}><Icon n="send" s={15}/> {busy==="honor"?"جارٍ التوليد…":"مشاركة"}</button></>}>
      {hs&&<><div className="g-tabs" style={{marginBottom:12,display:"inline-flex"}}>{[["honor","تكريم"],["motivate","تحفيز"]].map(([k,ar])=><button key={k} className={"g-tab"+(honor.variant===k?" on":"")} onClick={()=>setHonor({...honor,variant:k})}>{ar}</button>)}</div>
        <HonorPreview html={honorHTML(hd(hs,honor.variant))}/></>}
    </Modal>);})()}
  </div>);
}

// معاينة القالب 1280×720 مصغّراً بعرض الحاوية
function HonorPreview({html}){
  const ref=useRef(null);const[k,setK]=useState(0.5);
  useEffect(()=>{ensureFonts();const el=ref.current;if(!el)return;const f=()=>setK(el.clientWidth/1280);f();const ro=new ResizeObserver(f);ro.observe(el);return()=>ro.disconnect();},[]);
  return<div ref={ref} className="pf-hp" style={{height:720*k}}><div style={{transform:`scale(${k})`}} dangerouslySetInnerHTML={{__html:html}}/></div>;
}

function Av({s,big}){return s.photo?<img className={"pf-av"+(big?" big":"")} src={s.photo} alt="" loading="lazy"/>:<span className={"pf-av"+(big?" big":"")}>{(s.name||"?").trim().charAt(0)}</span>;}

function Card({s,onRounds}){
  const lc=s.line&&(s.line.computed||s.line);
  const approved=lc&&lc.bonus_base!=null?Number(lc.bonus_base)+Number(lc.production||0):null;
  const expect=s.bonusBase+s.production;
  const hints=nextHints(s,"ar");
  const ml=(s.series.labels||[]).map(periodAr);
  const Gauge=({t,v,sub,hint,tone})=><div className="pf-g"><span>{t}</span><b className={tone?"t-"+tone:""}>{v}</b>{sub&&<small>{sub}</small>}{hint&&<em>{hint}</em>}</div>;
  return(<div className="pf-card">
    <div className="pf-ch"><Av s={s} big/><div><div className="pf-cn">{s.name}</div><div className="pf-cm">#{s.sid}{s.team?" · "+s.team:""}</div>
      <div className="pf-tags"><Badge tone="brand">{LEVEL_AR[s.level]} · {s.level}</Badge>{s.production?<Badge tone="ok" dot>مكافأة إنتاج +{s.production}</Badge>:null}<Badge>أجر الغسلة {n2(s.ratePerWash)} ر</Badge></div></div></div>
    <div className="pf-gs">
      <Gauge t="الغسلات" v={n0(s.washes)} sub={s.prev?`السابق ${n0(s.prev.washes)}`:""} hint={s.nextProduction?`+${s.nextProduction.gap} غسلة لمكافأة ${s.nextProduction.bonus} ريال`:"أعلى مكافأة إنتاج"}/>
      <Gauge t="التقييم" v={s.rating?s.rating.toFixed(2):"—"} tone={rTone(s.qR)} sub={`ريال الجودة ${s.qR.toFixed(2)}`} hint={s.nextQuality?`تقييم ${s.nextQuality.needRating.toFixed(2)} يرفع ريال الجودة إلى ${s.nextQuality.riyal.toFixed(2)}`:"أعلى درجة جودة"}/>
      <Gauge t="الشكاوى" v={s.complaintPct+"%"} tone={rTone(s.sR)} sub={`${s.complaints} معتمدة · ريال السلامة ${s.sR.toFixed(2)}`} hint={s.nextSafety?`≤ ${s.nextSafety.maxPct}%${s.nextSafety.maxComplaints!=null?` (≤ ${s.nextSafety.maxComplaints} شكوى)`:""} ترفعه إلى ${s.nextSafety.riyal.toFixed(2)}`:"أعلى درجة سلامة"}/>
      <Gauge t="الالتزام" v={s.compliance?s.compliance.pct+"%":"—"} tone={s.compliance?(s.compliance.pct>=80?"ok":s.compliance.pct>=60?"warn":"bad"):""} sub={s.compliance?(s.compliance.effect||"")+(s.compliance.date?" · "+s.compliance.date:""):"لا جولة"} hint={s.compliance&&s.compliance.pct<80?"80% فأعلى لتجنّب سقف التقييم":""}/>
    </div>

    <div className="pf-sec"><div className="pf-sh"><b>الغسلات اليومية</b><span>{s.workDays} يوم عمل · متوسط {s.dailyAvg}/يوم{s.bestDay?` · أفضل يوم ${s.bestDay.date.slice(8)} (${s.bestDay.n})`:""}{s.zeroDays.length?` · ${s.zeroDays.length} يوم صفر`:""}</span></div>
      {s.days.length?<ChartTip label="الغسلات اليومية — الأسهم لاستعراض الأيام"><div className="pf-chart" dangerouslySetInnerHTML={{__html:dailySVG(s.days,s.period,{avg:s.dailyAvg||null})}}/></ChartTip>:<p className="pf-mut">لا تفصيل يومي في تقرير هذا الشهر.</p>}</div>

    <div className="pf-2">
      <div className="pf-sec"><div className="pf-sh"><b>اتجاه 6 أشهر</b><span className={"pf-tr "+s.tr.dir}>{TR[s.tr.dir]} {s.tr.pct}%</span></div>
        <ChartTip label="اتجاه 6 أشهر"><div className="pf-sparks">
          <div><span>الغسلات</span><i dangerouslySetInnerHTML={{__html:sparkSVG(s.series.washes,{color:"var(--p)",labels:ml,fmt:v=>v+" غسلة"})}}/></div>
          <div><span>التقييم</span><i dangerouslySetInnerHTML={{__html:sparkSVG(s.series.rating,{color:"var(--ok)",labels:ml,fmt:v=>Number(v).toFixed(2)})}}/></div>
          <div><span>الشكاوى %</span><i dangerouslySetInnerHTML={{__html:sparkSVG(s.series.cpct,{color:"var(--bad)",labels:ml,fmt:v=>v+"%"})}}/></div>
        </div></ChartTip></div>
      <div className="pf-sec"><div className="pf-sh"><b>تفصيل العمولة</b><span>متوقعة</span></div>
        <table className="pf-calc"><tbody>
          <tr><td>ثابت 2 ر × {s.washes}</td><td>{n2(s.fixed)}</td></tr>
          <tr><td>جودة {s.qR.toFixed(2)} × {s.washes}</td><td>{n2(s.quality)}</td></tr>
          <tr><td>سلامة {s.sR.toFixed(2)} × {s.washes}</td><td>{n2(s.safety)}</td></tr>
          <tr><td>مكافأة الإنتاج</td><td>{n2(s.production)}</td></tr>
          <tr className="t"><td>الإجمالي المتوقع</td><td>{n2(expect)}</td></tr>
          {approved!=null&&<tr><td>المسير المعتمد</td><td>{n2(approved)} {Math.abs(approved-expect)>0.01&&<Badge tone="warn">فرق {n2(approved-expect)}</Badge>}</td></tr>}
          {s.revenue!=null&&<tr><td>إيراد سويتر المُكتسب</td><td>{n2(s.revenue)}</td></tr>}
        </tbody></table></div>
    </div>

    <div className="pf-2">
      <div className="pf-sec"><div className="pf-sh"><b>الجولات الميدانية</b><button className="g-btn sm" onClick={onRounds}><Icon n="rounds" s={13}/> الجولات</button></div>
        {s.rounds.length?s.rounds.map((r,i)=><div className="pf-li" key={i}><span>{r.round_date}</span><span>{r.effect||""}</span><Badge tone={r.compliance_pct>=80?"ok":r.compliance_pct>=60?"warn":"bad"}>{r.compliance_pct!=null?r.compliance_pct+"%":"—"}</Badge></div>):<p className="pf-mut">لا جولات خلال 6 أشهر.</p>}</div>
      <div className="pf-sec"><div className="pf-sh"><b>المخالفات المؤكدة</b><span>{s.fines?n2(s.fines)+" ر":""}</span></div>
        {s.violList.length?s.violList.map((v,i)=><div className="pf-li" key={i}><span>{v.code||"مخالفة"}</span><b style={{color:"var(--bad-ink)"}}>{n2(v.fine_applied)} ر</b></div>):<p className="pf-mut">لا مخالفات مؤكدة هذا الشهر.</p>}
        {(s.tickets.pending||s.tickets.approved)?<p className="pf-mut" style={{marginTop:8}}>تذاكر الشهر: {s.tickets.approved} معتمدة · {s.tickets.pending} معلّقة · {s.tickets.rejected} مرفوضة</p>:null}</div>
    </div>
    {hints.length>0&&<div className="pf-next"><Icon n="target" s={15}/><div>{hints.map((h,i)=><div key={i}>{h}</div>)}</div></div>}
  </div>);
}

const CSS=`
.pf-bar{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.pf-month{display:flex;align-items:center;gap:7px;background:var(--glass-2);border:1px solid var(--line-2);border-radius:11px;padding:6px 11px;color:var(--mut)}
.pf-month input{border:none;outline:none;font-family:inherit;font-size:13px;font-weight:700;color:var(--ink);background:none;color-scheme:inherit}
.pf-plabel{font-size:13px;font-weight:800;color:var(--ink-2)}
.pf-kpis{grid-template-columns:repeat(5,1fr)!important;margin-bottom:14px}
.pf-kpis .g-kpi-n small{font-size:12px;color:var(--mut);font-weight:600}
.pf-tw{overflow:hidden;padding:0}
.pf-tbl th.pf-th{cursor:pointer;user-select:none}.pf-tbl th.on{color:var(--p)}
.pf-row{cursor:pointer}.pf-row:focus-visible{outline:none;box-shadow:inset 0 0 0 2px rgba(var(--p-rgb),.5)}
.pf-rank{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:8px;background:var(--soft);font-weight:800;font-size:12px;color:var(--mut)}
.pf-rank.r1{background:linear-gradient(135deg,var(--a),var(--p));color:#fff}.pf-rank.r2,.pf-rank.r3{background:var(--p-100);color:var(--p-ink)}
.pf-who{display:flex;align-items:center;gap:9px;min-width:170px}.pf-who b{display:block;font-size:13px;white-space:nowrap}.pf-who small{font-size:11px;color:var(--mut)}
.pf-av{width:32px;height:32px;border-radius:50%;object-fit:cover;flex:none;display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--a),var(--p));color:#fff;font-weight:800;font-size:13px}
.pf-av.big{width:64px;height:64px;font-size:24px;border:3px solid var(--glass-3);box-shadow:var(--shadow)}
.pf-tr{font-size:11px;font-weight:800;margin-inline-start:auto}.pf-tr.up{color:var(--ok-ink)}.pf-tr.down{color:var(--bad-ink)}.pf-tr.flat{color:var(--mut-2)}
.pf-mut{color:var(--mut);font-size:12px;margin:0}
.pf-nw{white-space:nowrap}.pf-nw small{color:var(--mut);font-size:11px}
.pf-legend{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px;font-size:11.5px;color:var(--mut)}
.pf-ch{display:flex;gap:14px;align-items:center;margin-bottom:14px}.pf-cn{font-size:18px;font-weight:800}.pf-cm{font-size:12px;color:var(--mut)}
.pf-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.pf-gs{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}
.pf-g{background:var(--soft);border:1px solid var(--line);border-radius:14px;padding:11px 12px;display:flex;flex-direction:column;gap:2px}
.pf-g span{font-size:11.5px;color:var(--mut);font-weight:700}.pf-g b{font-size:24px;font-weight:800;letter-spacing:-.4px;font-variant-numeric:tabular-nums}
.pf-g b.t-ok{color:var(--ok-ink)}.pf-g b.t-warn{color:var(--warn-ink)}.pf-g b.t-bad{color:var(--bad-ink)}
.pf-g small{font-size:11px;color:var(--mut)}.pf-g em{font-style:normal;font-size:11.5px;font-weight:700;color:var(--p-ink);margin-top:4px;line-height:1.5}
.pf-sec{border:1px solid var(--line);border-radius:14px;padding:11px 13px;margin-bottom:12px;background:var(--glass-2)}
.pf-sh{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.pf-sh b{font-size:13px}.pf-sh span{font-size:11.5px;color:var(--mut)}
.pf-chart{overflow:hidden}
.pf-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pf-2 .pf-sec{margin-bottom:12px}
.pf-sparks{display:flex;gap:10px;flex-wrap:wrap}.pf-sparks div{flex:1;min-width:110px}.pf-sparks span{display:block;font-size:11px;color:var(--mut);font-weight:700}
.pf-calc{width:100%;font-size:12.5px;border-collapse:collapse}.pf-calc td{padding:5px 2px;border-bottom:1px solid var(--line)}.pf-calc td:last-child{text-align:left;direction:ltr;font-weight:700;font-variant-numeric:tabular-nums}
.pf-calc tr.t td{color:var(--p-ink);font-size:14px;border-bottom:none}
.pf-li{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5px;padding:5px 0;border-bottom:1px solid var(--line)}.pf-li:last-child{border-bottom:none}
.pf-hp{width:100%;overflow:hidden;border-radius:14px;box-shadow:var(--shadow);position:relative}.pf-hp>div{width:1280px;height:720px;transform-origin:top right;position:absolute;top:0;right:0}
.pf-next{display:flex;gap:10px;align-items:flex-start;background:var(--p-50);border:1px solid rgba(var(--p-rgb),.3);color:var(--p-ink);border-radius:14px;padding:11px 13px;font-size:12.5px;font-weight:700;line-height:1.8}
@media(max-width:1100px){.pf-kpis{grid-template-columns:repeat(3,1fr)!important}}
@media(max-width:720px){.pf-kpis{grid-template-columns:1fr 1fr!important}.pf-gs{grid-template-columns:1fr 1fr}.pf-2{grid-template-columns:1fr}}
`;
