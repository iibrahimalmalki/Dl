// الإقفال الشهري — الخطوة 2: المطابقة مع كشف سويتر (Breakdown).
// تُقرأ بيانات الشهر من القاعدة (لا من ملفات الجلسة)، ويُدخل المستخدم أرقام الكشف بجانب المحسوب فتظهر الفروق سطراً سطراً.
// الحفظ يكتب عمود recon فقط في sweater_settlements (ولا يغيّر status ولا المبالغ القائمة)، ويملأ invoice_ref/invoice_amount إن كانا فارغين.
import{useState,useEffect,useMemo,useRef}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import DataTable from"./DataTable";
import{useToast,Badge,EmptyState}from"./ui";
import{reconcileMonth,claimFrom,alertsOf,inquiryEmail,num,r2,SWEATER_FIELDS}from"./monthRecon";
import{MIN_GUARANTEE_ORDERS}from"./sweaterContract";
import{parseBreakdown,fillFromBreakdown}from"./sspBreakdown";

// كشف سويتر المرفوع يُحفظ في bucket خاص (legal-docs) بمسار sweater-breakdowns/{period}/…
const BD_BUCKET="legal-docs",BD_PREFIX="sweater-breakdowns";
const MAR=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const periodAr=p=>{const[y,m]=String(p||"").split("-");return(MAR[+m-1]||m||"")+" "+(y||"");};
const safeName=n=>String(n||"breakdown.pdf").replace(/[^\w.\-]+/g,"_").slice(-120);

const f2=v=>v==null?"—":Number(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const fi=v=>v==null?"—":Number(v).toLocaleString("en-US");
const sg=(v,fmt=f2)=>(v>0?"+":v<0?"−":"")+fmt(Math.abs(v));
const tierAr=t=>t==null?"—":typeof t==="number"?`الشريحة ${t}`:t==="Golden Guarantee"?"دون الشريحة 1 (20﷼)":String(t);
export const DECISIONS={matched:"مطابق",accepted:"مقبول بملاحظة",claim:"مطالبة",inquiry:"استفسار لسويتر"};
const STATUS={pending:["warn","بانتظار أرقام الكشف"],matched:["ok","مطابق"],diff:["bad","فيه فروق"]};
const COLS_MISSING=e=>e&&(e.code==="42703"||e.code==="PGRST204"||/recon/.test(String(e.message||""))&&/column/i.test(String(e.message||"")));
const opOr=op=>`operator_id.eq.${op},operator_id.is.null`;

// حقل إدخال رقمي + شارة فرق: ✓ أخضر عند التطابق، أحمر بقيمة الفرق عند الاختلاف
function NumIn({label,value,onChange,placeholder,diff,tol=0,fmt=f2,disabled,auto}){
  const on=value!==""&&value!=null;
  return(<span className="mr-in">
    <input className="g-input" type="text" inputMode="decimal" dir="ltr" value={value??""} placeholder={placeholder} aria-label={label} disabled={disabled}
      onChange={e=>onChange(e.target.value.replace(/[^\d.,\-]/g,""))}/>
    {auto&&on&&<span className="mr-auto" title="عُبّئ من كشف سويتر — قابل للتعديل">من الكشف</span>}
    {on&&diff!=null&&(Math.abs(diff)<=tol?<Badge tone="ok" aria-label="مطابق">✓</Badge>:<Badge tone="bad">{sg(diff,fmt)}</Badge>)}
  </span>);
}

export default function MonthRecon({period,opId,opName,me,owner,reloadKey,onStatus}){
  const toast=useToast();
  const[perm,setPerm]=useState(owner?{view:true,edit:true}:null);
  const[data,setData]=useState(null);const[loading,setLoading]=useState(true);
  const[sw,setSw]=useState({});const[decision,setDecision]=useState("");const[note,setNote]=useState("");
  const[invRef,setInvRef]=useState("");const[invAmt,setInvAmt]=useState("");
  const[colMissing,setColMissing]=useState(false);const[saving,setSaving]=useState(false);
  // كشف سويتر (PDF): المقروء، الحقول المعبّأة آلياً، التنبيهات، الملف بانتظار الرفع عند الحفظ، والملف المحفوظ
  const[bd,setBd]=useState(null);const[filled,setFilled]=useState({});const[bdWarn,setBdWarn]=useState([]);
  // 2ج: التنبيهات التعاقدية المختارة (null = كلها) والاستفسار لسويتر
  const[pickSel,setPickSel]=useState(null);
  const[inqTo,setInqTo]=useState("");const[inqSubject,setInqSubject]=useState("");const[inqBody,setInqBody]=useState("");
  const[inqEdited,setInqEdited]=useState(false);const[inqSent,setInqSent]=useState(false);
  const[replyMode,setReplyMode]=useState(false);const[replyNote,setReplyNote]=useState("");
  const bodyRef=useRef(null);const decRef=useRef(null);
  const[pdfFile,setPdfFile]=useState(null);const[pdfBusy,setPdfBusy]=useState(false);const[fileRec,setFileRec]=useState(null);

  // الصلاحية: المالك، أو settlement/payroll (عرض = can_view أو can_edit، حفظ = can_edit)
  useEffect(()=>{if(owner){setPerm({view:true,edit:true});return;}if(!me||!me.id){setPerm({view:false,edit:false});return;}
    (async()=>{const{data:p}=await supabase.from("user_permissions").select("module,can_view,can_edit").eq("user_id",me.id).in("module",["settlement","payroll"]);
      const l=p||[];setPerm({view:l.some(x=>x.can_view||x.can_edit),edit:l.some(x=>x.can_edit)});})();},[owner,me]);

  const load=async()=>{
    setLoading(true);
    const q=(t,c)=>supabase.from(t).select(c).eq("period",period);
    let stl=await q("sweater_settlements","id,operator_id,status,invoice_ref,invoice_amount,net_total,recon");
    let missing=false;
    if(stl.error&&COLS_MISSING(stl.error)){missing=true;stl=await q("sweater_settlements","id,operator_id,status,invoice_ref,invoice_amount,net_total");}
    const[bm,adj,tk,vio,cl]=await Promise.all([
      q("ops_biker_month","sweater_id,biker_name,net_washes,employee_id,rating,complaint_pct").eq("operator_id",opId),
      q("sweater_adjustments","kind,sweater_id").or(opOr(opId)),
      q("ops_tickets","sweater_id,compensation").or(opOr(opId)),
      q("violations","sweater_id,employee_id,fine_applied").eq("status","confirmed").or(opOr(opId)),
      supabase.from("sweater_claims").select("period,status,claim_amount,notes").eq("period",period).maybeSingle(),
    ]);
    const err=[["ops_biker_month",bm],["sweater_adjustments",adj],["ops_tickets",tk],["violations",vio],["sweater_settlements",stl]].find(([,r])=>r.error);
    if(err)toast.bad(`تعذّرت قراءة ${err[0]}`,err[1].error.message,0);
    const rows=(stl.data||[]);
    // التسوية القائمة للشهر: للمشغّل نفسه، وإلا القديمة بلا مشغّل (كل التسويات الحالية operator_id = null)
    const settlement=rows.find(r=>r.operator_id===opId)||rows.find(r=>r.operator_id==null)||null;
    const bikers=bm.data||[];
    const empToSid={};bikers.forEach(b=>{if(b.employee_id)empToSid[b.employee_id]=b.sweater_id;});
    const violations=(vio.data||[]).map(v=>({sweater_id:v.sweater_id||empToSid[v.employee_id]||null,amount:Number(v.fine_applied)||0}));
    setColMissing(missing);
    setData({bikers,adjustments:adj.data||[],tickets:tk.data||[],violations,settlement,claim:cl.data||null});
    const rc=settlement&&settlement.recon;
    setFileRec(rc&&rc.file?rc.file:null);setBd(null);setFilled({});setBdWarn([]);setPdfFile(null);
    const iq=rc&&rc.inquiry;
    let lastTo=iq&&iq.to||"";
    if(!lastTo&&!missing){const{data:prev}=await supabase.from("sweater_settlements").select("period,inq_to:recon->inquiry->>to").not("recon","is",null).order("period",{ascending:false}).limit(24);
      const hit=(prev||[]).find(x=>x.inq_to);if(hit)lastTo=hit.inq_to;}
    setInqTo(lastTo);setInqSubject(iq?iq.subject||"":"");setInqBody(iq?iq.body||"":"");setInqEdited(!!(iq&&iq.body&&iq.subject));setInqSent(!!(iq&&iq.status==="sent"));
    setPickSel(iq&&Array.isArray(iq.items)?iq.items:null);setReplyMode(false);setReplyNote("");
    setSw(rc&&rc.sweater?rc.sweater:{});setDecision(rc?rc.decision||"":"");setNote(rc?rc.note||"":"");
    setInvRef(settlement&&settlement.invoice_ref?settlement.invoice_ref:"");setInvAmt(settlement&&settlement.invoice_amount!=null?String(settlement.invoice_amount):"");
    setLoading(false);
  };
  useEffect(()=>{if(perm&&perm.view)load();/*eslint-disable-next-line*/},[period,opId,reloadKey,perm&&perm.view]);

  const res=useMemo(()=>data?reconcileMonth({bikers:data.bikers,adjustments:data.adjustments,tickets:data.tickets,violations:data.violations,sweater:sw,period}):null,[data,sw,period]);
  const alerts=useMemo(()=>res?alertsOf(res,period,{ratings:data&&data.bikers}):[],[res,period,data]);
  const picked=useMemo(()=>pickSel==null?alerts:alerts.filter(a=>pickSel.includes(a.id)),[alerts,pickSel]);
  // المطالبة = فروق الأرقام السالبة علينا + التنبيهات المختارة
  const claim=useMemo(()=>res?claimFrom(res,picked):null,[res,picked]);
  const saved=data&&data.settlement&&data.settlement.recon;
  const savedInq=saved&&saved.inquiry||null;
  const inquiryOpen=!!(savedInq&&!savedInq.outcome);
  const reportNo=(bd&&bd.reportNo)||(saved&&saved.source&&saved.source.report_no)||null;
  useEffect(()=>{onStatus&&onStatus(saved?{saved:true,decision:saved.decision,inquiryOpen}:{saved:false,status:res&&res.status});},[saved,inquiryOpen,res&&res.status]);// eslint-disable-line
  // معاينة الرسالة تُولَّد من البنود المختارة ما لم يعدّلها المستخدم
  useEffect(()=>{if(decision!=="inquiry"||inqEdited||!res)return;const e=inquiryEmail({period,reportNo,alerts:picked,operatorName:opName});setInqSubject(e.subject);setInqBody(e.body);},[decision,inqEdited,picked,period,reportNo,opName]);// eslint-disable-line
  // المعاينة تتمدد بطول المحتوى
  useEffect(()=>{const t=bodyRef.current;if(t){t.style.height="auto";t.style.height=(t.scrollHeight+2)+"px";}},[inqBody,decision]);

  if(!perm)return null;
  if(!perm.view)return(<section className="g-card pad"><EmptyState compact variant="ring" title="المطابقة" text="عرض المطابقة متاح للمالك ولمن له صلاحية التسوية أو الرواتب."/></section>);
  if(loading||!res)return(<section className="g-card pad"><div className="g-skel" style={{height:180}}/></section>);

  const setF=(id,f,v)=>{setSw(p=>({...p,[id]:{...(p[id]||{}),[f]:v}}));setFilled(p=>p[id]&&p[id].includes(f)?{...p,[id]:p[id].filter(x=>x!==f)}:p);};

  // رفع كشف سويتر (PDF) ⇒ قراءة النص ⇒ تعبئة الحقول (بلا حفظ تلقائي؛ الملف يُرفع عند الحفظ)
  const onPdf=async file=>{
    if(!file)return;setPdfBusy(true);
    try{
      const{pdfLines}=await import("./pdfText");
      const{lines,chars}=await pdfLines(file);
      if(chars<20){toast.bad("الملف صورة ممسوحة ولا يمكن قراءته — أدخل الأرقام يدوياً",file.name,0);return;}
      const br=parseBreakdown(lines);
      if(!br.period){toast.bad("تعذّر معرفة شهر الكشف","لم يُعثر على سطر Period — أدخل الأرقام يدوياً",0);return;}
      if(br.period!==period){toast.bad(`هذا كشف ${periodAr(br.period)} وأنت على ${periodAr(period)}`,"لم تُعبَّأ الحقول",0);return;}
      if(!br.bikers.length){toast.bad("لم يُعثر على صفوف البايكرز في الكشف","أدخل الأرقام يدوياً",0);setBdWarn(br.warnings);return;}
      const calc={};res.rows.forEach(r=>{if(r.inPlatform)calc[r.sweater_id]=r.netCalc;});
      const f=fillFromBreakdown(br,calc);
      setSw(p=>{const o={...p};Object.entries(f.sweater).forEach(([sid,v])=>{o[sid]={...(o[sid]||{}),...v};});return o;});
      setFilled(f.filled);setBd(br);setBdWarn([...br.warnings,...f.warnings]);setPdfFile(file);
      if(!lockRef&&!invRef.trim()&&f.invoice.ref)setInvRef(f.invoice.ref);
      if(!lockAmt&&!invAmt&&f.invoice.amount!=null)setInvAmt(String(f.invoice.amount));
      const nw=br.warnings.length+f.warnings.length;
      (nw?toast.warn:toast.ok)(`عُبّئت حقول ${br.bikers.length} بايكر من الكشف — راجعها قبل الحفظ`,nw?`${nw} تنبيه — انظر أسفل الجدول`:br.reportNo||undefined,6000);
    }catch(e){toast.bad("تعذّرت قراءة ملف PDF",String(e.message||e),0);}
    finally{setPdfBusy(false);}
  };
  const viewPdf=async()=>{if(!fileRec)return;const{data:u,error}=await supabase.storage.from(BD_BUCKET).createSignedUrl(fileRec.path,600);
    if(error||!u){toast.bad("تعذّر فتح الكشف",error?error.message:"",0);return;}window.open(u.signedUrl,"_blank","noopener");};
  const T=res.totals;const st=res.status;
  const stl=data.settlement;const lockRef=!!(stl&&stl.invoice_ref);const lockAmt=!!(stl&&stl.invoice_amount!=null);
  const inv=num(invAmt);const invDiff=inv!=null?r2(inv-T.exVat):null;
  // شامل الضريبة من جهة الكشف: صافي سويتر × سعره شاملاً − خصوماته (للصفوف المُدخلة)
  const swIncVat=res.rows.some(r=>r.sweaterNet!=null)?r2(res.rows.reduce((a,r)=>a+(r.sweaterNet!=null?r2(r.sweaterNet*r.unitVat)-r.deductions:0),0)):null;
  const canClaim=claim.amount>0||claim.orders>0;
  const pickedTotal=r2(picked.reduce((a,x)=>a+x.amount,0));
  const ready=perm.edit&&!colMissing&&decision&&(decision!=="matched"||st==="matched")&&(decision!=="accepted"||note.trim())&&(decision!=="claim"||canClaim)
    &&(decision!=="inquiry"||(picked.length>0&&inqBody.trim()&&inqSubject.trim()));
  const togglePick=id=>setPickSel(p=>{const cur=p==null?alerts.map(a=>a.id):p;return cur.includes(id)?cur.filter(x=>x!==id):[...cur,id];});
  // نسخ آمن (clipboard ثم بديل execCommand)
  const copyText=async t=>{try{await navigator.clipboard.writeText(t);return true;}catch(_){try{const ta=document.createElement("textarea");ta.value=t;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();const ok=document.execCommand("copy");ta.remove();return ok;}catch(__){return false;}}};
  const copyMsg=async()=>{const ok=await copyText(`${inqSubject}\n\n${inqBody}`);if(ok){setInqSent(true);toast.ok("نُسخت الرسالة","الصقها في بريدك وأرسلها لسويتر");}else toast.bad("تعذّر النسخ","انسخ النص من المعاينة يدوياً");};
  const openMail=async()=>{
    const to=encodeURIComponent(inqTo.trim()),sub=encodeURIComponent(inqSubject),body=encodeURIComponent(inqBody);
    let url=`mailto:${to}?subject=${sub}&body=${body}`;
    if(url.length>1800){url=`mailto:${to}?subject=${sub}`;const ok=await copyText(inqBody);toast.warn("الرسالة أطول من رابط البريد",ok?"فُتح البريد بالموضوع فقط ونُسخ النص — الصقه في جسم الرسالة":"فُتح البريد بالموضوع فقط — انسخ النص من المعاينة",9000);}
    setInqSent(true);const l=document.createElement("a");l.href=url;l.rel="noopener";document.body.appendChild(l);l.click();l.remove();};

  const save=async(o={})=>{
    const dec=o.decision||decision,nt=o.note!=null?o.note:note;
    if(saving||!(o.decision?perm.edit&&!colMissing&&(dec!=="accepted"||String(nt).trim()):ready))return;setSaving(true);
    const fail=(table,e)=>{if(COLS_MISSING(e)){setColMissing(true);toast.bad("عمود المطابقة غير مُضاف بعد — شغّل أمر SQL المرفق","docs/sql/month_close_2.sql",0);}else toast.bad(`تعذّر الحفظ في ${table}`,e.message||String(e),0);setSaving(false);};
    try{
      const now=new Date().toISOString();
      // 1) المطالبة — upsert على period (المفتاح الأساسي) بحالة draft، ولا تُمسّ مطالبة تجاوزت المسودة
      if(dec==="claim"){
        if(data.claim&&data.claim.status&&data.claim.status!=="draft"){toast.bad("مطالبة هذا الشهر ليست مسودة",`حالتها «${data.claim.status}» — عدّلها من صفحة المطالبة`,0);setSaving(false);return;}
        const{error}=await supabase.from("sweater_claims").upsert({period,claim_amount:claim.amount,claim_orders:claim.orders,status:"draft",notes:[nt,...picked.map(a=>a.ar)].filter(Boolean).join("\n")||null,updated_by:me&&me.id||null,updated_at:now},{onConflict:"period"});
        if(error)return fail("sweater_claims",error);
      }
      // 2) ملف الكشف — يُرفع عند الحفظ فقط؛ إن رُفض (سياسة التخزين) تُحفظ المطابقة بدونه مع تنبيه واضح
      let file=fileRec;
      if(pdfFile){
        const path=`${BD_PREFIX}/${period}/${Date.now()}-${safeName(pdfFile.name)}`;
        const{error:ue}=await supabase.storage.from(BD_BUCKET).upload(path,pdfFile,{contentType:"application/pdf",upsert:false});
        if(ue)toast.warn("لم يُحفظ ملف الكشف — حُفظت المطابقة بدونه",`${ue.message||ue} · يلزم سياسة التخزين في docs/sql/month_close_2b.sql`,0);
        else file={path,name:pdfFile.name,size:pdfFile.size,uploaded_at:now,bucket:BD_BUCKET};
      }
      // 3) التسوية — لا قيد فريد على (operator_id, period): نحدّث الصف القائم بالمعرّف، وإلا ننشئ مسودة
      // الاستفسار: جديد عند قرار inquiry؛ وإلا يبقى السابق، ويُغلق بالرد «مقبول» أو بالتحويل إلى مطالبة
      let inquiry=savedInq;
      if(dec==="inquiry")inquiry={to:inqTo.trim()||null,subject:inqSubject,body:inqBody,items:picked.map(a=>a.id),amount:pickedTotal,
        status:inqSent?"sent":"draft",sent_at:inqSent?((savedInq&&savedInq.sent_at)||now):null,reply_note:null,resolved_at:null,outcome:null};
      else if(savedInq&&!savedInq.outcome&&(o.outcome||dec==="claim"))
        inquiry={...savedInq,outcome:o.outcome||"claim",reply_note:o.outcome==="accepted"?String(nt).trim():savedInq.reply_note||null,resolved_at:now};
      const recon={v:1,saved_at:now,saved_by:{id:me&&me.id||null,name:me&&me.display_name||null},decision:dec,note:String(nt).trim()||null,
        rows:res.rows,totals:T,status:st,sweater:sw,claim:dec==="claim"?claim:null,alerts,inquiry:inquiry||null,file:file||null,
        source:bd?{report_no:bd.reportNo,period:bd.period,totals:bd.totals,warnings:bdWarn,parsed_at:now}:((saved&&saved.source)||null)};
      if(stl){
        const patch={recon};
        if(!stl.invoice_ref&&invRef.trim())patch.invoice_ref=invRef.trim();
        if(stl.invoice_amount==null&&inv!=null)patch.invoice_amount=inv;
        const{data:u,error}=await supabase.from("sweater_settlements").update(patch).eq("id",stl.id).select("id");
        if(error)return fail("sweater_settlements",error);
        if(!u||!u.length)return fail("sweater_settlements",{message:"لم يُحدَّث أي صف — تحقّق من صلاحية التعديل (settlement/payroll)"});
      }else{
        const{error}=await supabase.from("sweater_settlements").insert({operator_id:opId,period,status:"draft",gross_total:T.gross,deduction_total:T.deductions,net_total:T.exVat,
          invoice_ref:invRef.trim()||null,invoice_amount:inv,recon}).select("id");
        if(error)return fail("sweater_settlements",error);
      }
      toast.ok(`حُفظت المطابقة — ${DECISIONS[dec]}`,dec==="claim"?`مطالبة مسودة بمبلغ ${f2(claim.amount)} ﷼`:dec==="inquiry"?`استفسار ${inqSent?"مُرسل":"مسودة"} · ${f2(pickedTotal)} ﷼ محل السؤال`:`الحالة: ${STATUS[st][1]}`,6000);
      await load();
    }catch(e){toast.bad("خطأ أثناء حفظ المطابقة",String(e.message||e),0);}
    setSaving(false);
  };

  const inCol=(k,label,diffKey,o={})=>({k,label,sortable:false,render:r=><NumIn label={`${label} — ${r.biker_name}`} value={(sw[r.sweater_id]||{})[k]} onChange={v=>setF(r.sweater_id,k,v)} auto={(filled[r.sweater_id]||[]).includes(k)}
    placeholder={o.ph?o.ph(r):""} diff={diffKey?r[diffKey]:null} tol={o.tol??0.05} fmt={o.fmt||f2} disabled={!perm.edit}/>});
  const notes=[];
  res.rows.forEach(r=>{
    if(!r.inPlatform)notes.push({tone:"bad",t:`${r.biker_name}: موجود في كشف سويتر فقط — لا بيانات له في المنصة لهذا الشهر`});
    else if(r.entered&&r.sweaterNet===0&&r.netBill>0)notes.push({tone:"bad",t:`${r.biker_name}: صافيه في الكشف صفر مقابل ${fi(r.netBill)} محسوبة`});
  });

  return(<section className="g-card pad mr" aria-labelledby="mc-s2">
    <h3 id="mc-s2" className="mc-h"><span className="mc-sn">2</span> المطابقة مع كشف سويتر
      <Badge tone={STATUS[st][0]}>{STATUS[st][1]}</Badge>
      {saved&&<Badge tone="ok">محفوظة: {DECISIONS[saved.decision]||saved.decision}</Badge>}</h3>
    {colMissing&&<div className="mr-bar bad" role="alert"><Icon n="alert" s={15}/> عمود المطابقة غير مُضاف بعد — شغّل أمر SQL المرفق (<span dir="ltr">docs/sql/month_close_2.sql</span>).</div>}
    {stl&&<p className="mr-note"><Icon n="lock" s={13}/> تسوية الشهر قائمة بحالة «{stl.status}» — المطابقة تُحفظ في سجلّها فقط ولا تغيّر حالتها ولا مبالغها.</p>}
    <div className="mr-pdf">
      {perm.edit&&<label className={"g-btn"+(pdfBusy?"":" primary")} aria-disabled={pdfBusy}>
        <input type="file" accept="application/pdf,.pdf" className="g-sr" disabled={pdfBusy} onChange={e=>{onPdf(e.target.files[0]);e.target.value="";}}/>
        <Icon n="doc" s={15}/> {pdfBusy?"جارٍ قراءة الكشف…":"رفع كشف سويتر (PDF)"}</label>}
      {fileRec&&<button type="button" className="g-btn" onClick={viewPdf}><Icon n="eye" s={15}/> عرض الكشف</button>}
      <small className="g-mut">{pdfFile?<>«<span dir="ltr">{pdfFile.name}</span>» — يُرفق عند الحفظ. </>:fileRec?<>مرفق: <span dir="ltr">{fileRec.name}</span>. </>:null}يعبّئ الحقول تلقائياً — راجعها قبل الحفظ.</small>
    </div>
    <p className="g-mut mr-hint">أو أدخل أرقام كشف سويتر (Breakdown) يدوياً لكل بايكر. الحقل الفارغ = غير مُدخل، وتظهر القيمة المحسوبة فيه رمادية للاسترشاد.</p>

    <DataTable caption="مطابقة البايكرز مع كشف سويتر" rows={res.rows} rowKey={r=>r.sweater_id} searchable={false} pageSize={50}
      columns={[
        {k:"name",label:"البايكر",sortable:false,render:r=><span className="mc-bk"><b>{r.biker_name}</b><small dir="ltr">#{r.sweater_id}</small>{!r.inPlatform&&<Badge tone="bad">الكشف فقط</Badge>}</span>},
        {k:"online",label:"أونلاين",num:true,render:r=>fi(r.online)},
        {k:"add",label:"+إضافة",num:true,render:r=>fi(r.add)},
        {k:"deduct",label:"−خصم",num:true,render:r=>fi(r.deduct)},
        {k:"maintenance",label:"−صيانة",num:true,render:r=>fi(r.maintenance)},
        {k:"freeWash",label:"−غسلة مجانية",num:true,render:r=>fi(r.freeWash)},
        {k:"netCalc",label:"الصافي المحسوب",num:true,render:r=><b>{fi(r.netCalc)}</b>},
        inCol("guarantee","غسلات الضمان",null,{ph:()=>"0"}),
        inCol("net","الصافي",  "dNet",{ph:r=>String(r.netBill),tol:0,fmt:fi}),
        inCol("unit","سعر الوحدة","dUnit",{ph:r=>f2(r.unitExp),tol:0.005}),
        inCol("violations","المخالفات","dViol",{ph:r=>f2(r.violPlat)}),
        inCol("damages","التلفيات",null,{ph:()=>"0.00"}),
        inCol("otherComp","تعويضات أخرى","dComp",{ph:r=>f2(r.otherCompCalc)}),
        inCol("payable","المستحق","dPay",{ph:r=>f2(r.payableCalc)}),
        {k:"payableCalc",label:"المستحق المحسوب",num:true,render:r=>f2(r.payableCalc)},
      ]}/>

    {bdWarn.length>0&&<ul className="mr-alerts" aria-label="تنبيهات قراءة الكشف">{bdWarn.map((w,i)=><li key={i} className="warn"><Icon n="doc" s={13}/><span>الكشف: {w.ar}</span></li>)}</ul>}

    {bd&&<div className="mr-bdt">
      <div className="mr-th"><span/><b>كشف سويتر</b><b>المنصة</b><b>الفرق</b></div>
      {[["أونلاين",bd.totals.online,T.online],["+إضافة",bd.totals.add,T.add],["+ضمان",bd.totals.guarantee,T.guarantee],["−غسلة مجانية",bd.totals.freeWash,T.freeWash],
        ["−خصم بايكر",bd.totals.deduct,T.deduct],["−صيانة",bd.totals.maintenance,T.maintenance],["الصافي",bd.totals.net,T.netBill]].map(([l,a,b])=>
        <div key={l} className="mr-tr"><span>{l}</span><b dir="ltr">{fi(a)}</b><b dir="ltr">{fi(b)}</b>
          <span dir="ltr">{a==null?"—":a===b?<Badge tone="ok">✓</Badge>:<Badge tone="bad">{sg(a-b,fi)}</Badge>}</span></div>)}
      <small className="g-mut">إجماليات الكشف <span dir="ltr">{bd.reportNo||""}</span> مقابل ما حسبته المنصة؛ «+ضمان» في المنصة = مجموع غسلات الضمان المُدخلة.</small>
    </div>}

    {notes.length>0&&<ul className="mr-alerts" aria-label="تنبيهات المطابقة">{notes.map((a,i)=><li key={i} className={a.tone}><Icon n="alert" s={13}/><span>{a.t}</span></li>)}</ul>}

    {alerts.length>0&&<fieldset className="mr-ca">
      <legend><Icon n="alert" s={14}/> تنبيهات تعاقدية — أسئلة عن تفسير ملحق التسعير، ليست مطالبة مؤكدة</legend>
      {alerts.map(a=><label key={a.id} className={"mr-ci"+(a.kind==="unit"?" warn":" info")}>
        <input type="checkbox" checked={picked.some(x=>x.id===a.id)} onChange={()=>togglePick(a.id)} disabled={!perm.edit}/>
        <span className="mr-ct">{a.ar}</span><b dir="ltr">{f2(a.amount)} ﷼</b></label>)}
      <div className="mr-cs"><span>المختار: {picked.length} من {alerts.length}</span><b dir="ltr">{f2(pickedTotal)} ﷼</b></div>
    </fieldset>}

    <div className="mr-tot">
      <div className="mr-th"><span/><b>المحسوب</b><b>كشف سويتر</b><b>الفرق</b></div>
      {[["الصافي (غسلات)",T.netBill,T.sweaterNet,fi],["غير شامل الضريبة",T.exVat,T.sweaterPayable,f2],["شامل الضريبة",T.incVat,swIncVat,f2]].map(([l,a,b,fm])=>
        <div key={l} className="mr-tr"><span>{l}</span><b dir="ltr">{fm(a)}</b><b dir="ltr">{b==null?"—":fm(b)}</b>
          <span dir="ltr">{b==null?"—":Math.abs(b-a)<=0.05?<Badge tone="ok">✓</Badge>:<Badge tone="bad">{sg(r2(b-a),fm)}</Badge>}</span></div>)}
      <div className="mr-inv">
        <label><span>رقم الفاتورة</span><input className="g-input" dir="ltr" value={invRef} onChange={e=>setInvRef(e.target.value)} disabled={lockRef||!perm.edit} placeholder="DW-2026-08-001"/></label>
        <label><span>مبلغ الفاتورة</span><input className="g-input" dir="ltr" inputMode="decimal" value={invAmt} onChange={e=>setInvAmt(e.target.value.replace(/[^\d.,]/g,""))} disabled={lockAmt||!perm.edit} placeholder={f2(T.exVat)}/></label>
        <div><span>الفرق عن المحسوب</span><b dir="ltr">{invDiff==null?"—":Math.abs(invDiff)<=0.05?<Badge tone="ok">✓ {f2(invDiff)}</Badge>:<Badge tone="bad">{sg(invDiff)}</Badge>}</b></div>
      </div>
      {(lockRef||lockAmt)&&<small className="g-mut">رقم الفاتورة ومبلغها من التسوية القائمة — لا يُعدَّلان من هنا.</small>}
    </div>

    {savedInq&&<div className={"mr-inq "+(inquiryOpen?"open":"done")} role="status">
      <div><Icon n={inquiryOpen?"clock":"check"} s={15}/> {inquiryOpen
        ?<>استفسار مفتوح منذ <span dir="ltr">{new Date(savedInq.sent_at||saved.saved_at).toLocaleDateString("en-GB")}</span> · المبلغ محل السؤال <b dir="ltr">{f2(savedInq.amount)} ﷼</b> · {savedInq.status==="sent"?"أُرسل":"مسودة لم تُرسل"}</>
        :<>الاستفسار أُغلق {savedInq.outcome==="accepted"?"بقبول الرد":"بالتحويل إلى مطالبة"}{savedInq.resolved_at?<> في <span dir="ltr">{new Date(savedInq.resolved_at).toLocaleDateString("en-GB")}</span></>:null}{savedInq.reply_note?` — ${savedInq.reply_note}`:""}</>}</div>
      {inquiryOpen&&perm.edit&&!replyMode&&<div className="mr-inq-a">
        <button type="button" className="g-btn ok sm" onClick={()=>{setReplyMode(true);setReplyNote("");}}><Icon n="check" s={13}/> سجّل الرد: مقبول</button>
        <button type="button" className="g-btn danger sm" onClick={()=>{setDecision("claim");setPickSel(savedInq.items||null);setTimeout(()=>decRef.current&&decRef.current.scrollIntoView({block:"center",behavior:"smooth"}),50);}}><Icon n="send" s={13}/> حوّل إلى مطالبة</button>
      </div>}
      {inquiryOpen&&replyMode&&<div className="mr-reply">
        <label className="mr-nl"><span>ملخّص رد سويتر (إلزامي)</span><textarea className="g-textarea" rows={2} value={replyNote} onChange={e=>setReplyNote(e.target.value)} placeholder="مثال: أوضحت سويتر أن الشريحة تُحسب على متوسط الأيام…"/></label>
        <div className="mc-act"><button type="button" className="g-btn ok" disabled={!replyNote.trim()||saving} onClick={()=>save({decision:"accepted",note:replyNote,outcome:"accepted"})}><Icon n="save" s={14}/> حفظ الرد — مقبول بملاحظة</button>
          <button type="button" className="g-btn ghost" onClick={()=>setReplyMode(false)}>إلغاء</button></div>
      </div>}
    </div>}

    <div className="mr-dec" role="radiogroup" aria-label="قرار المطابقة" ref={decRef}>
      <button type="button" role="radio" aria-checked={decision==="matched"} className={"g-btn"+(decision==="matched"?" ok":"")} disabled={!perm.edit||st!=="matched"} onClick={()=>setDecision("matched")}><Icon n="check" s={14}/> مطابق</button>
      <button type="button" role="radio" aria-checked={decision==="accepted"} className={"g-btn"+(decision==="accepted"?" primary":"")} disabled={!perm.edit} onClick={()=>setDecision("accepted")}><Icon n="edit" s={14}/> مقبول بملاحظة</button>
      <button type="button" role="radio" aria-checked={decision==="claim"} className={"g-btn"+(decision==="claim"?" danger":"")} disabled={!perm.edit||!canClaim} onClick={()=>setDecision("claim")}><Icon n="send" s={14}/> مطالبة{canClaim?` · ${f2(claim.amount)} ﷼`:""}</button>
      <button type="button" role="radio" aria-checked={decision==="inquiry"} className={"g-btn"+(decision==="inquiry"?" warn-on":"")} disabled={!perm.edit||!alerts.length} onClick={()=>setDecision("inquiry")}><Icon n="bell" s={14}/> استفسار لسويتر</button>
    </div>
    {st!=="matched"&&<small className="g-mut">«مطابق» يُفعَّل عندما تتطابق كل الصوافي والمستحقات.</small>}
    {decision==="claim"&&<p className="mr-note">المطالبة = الفروق السالبة علينا ({f2(claim.diffAmount)} ﷼) + التنبيهات المختارة ({f2(claim.alertAmount)} ﷼): <b>{f2(claim.amount)} ﷼</b>{claim.orders?` · ${fi(claim.orders)} غسلة`:""} — تُحفظ مسودة في المطالبات{!owner?" (الكتابة فيها للمالك فقط)":""}.</p>}
    {decision==="inquiry"&&<div className="mr-mail">
      <p className="mr-note">المنصة لا ترسل البريد بنفسها: انسخ الرسالة أو افتحها في بريدك، ثم احفظ المطابقة بقرار الاستفسار.</p>
      <label className="mr-nl"><span>بريد سويتر</span><input className="g-input" type="email" dir="ltr" value={inqTo} onChange={e=>setInqTo(e.target.value)} placeholder="partners@…" disabled={!perm.edit}/></label>
      <label className="mr-nl"><span>الموضوع</span><input className="g-input" value={inqSubject} onChange={e=>{setInqSubject(e.target.value);setInqEdited(true);}} disabled={!perm.edit}/></label>
      <label className="mr-nl"><span>نص الرسالة {inqEdited&&<button type="button" className="g-btn ghost sm" onClick={()=>setInqEdited(false)}>إعادة التوليد من البنود المختارة</button>}</span>
        <textarea ref={bodyRef} className="g-textarea mr-body" value={inqBody} onChange={e=>{setInqBody(e.target.value);setInqEdited(true);}} disabled={!perm.edit}/></label>
      <div className="mc-act">
        <button type="button" className="g-btn" onClick={copyMsg} disabled={!inqBody.trim()}><Icon n="doc" s={14}/> نسخ الرسالة</button>
        <button type="button" className="g-btn" onClick={openMail} disabled={!inqBody.trim()}><Icon n="send" s={14}/> فتح في البريد</button>
        <label className="mr-sent"><input type="checkbox" checked={inqSent} onChange={e=>setInqSent(e.target.checked)} disabled={!perm.edit}/> أُرسلت</label>
      </div>
      {!picked.length&&<small className="mc-bad">اختر بنداً واحداً على الأقل من التنبيهات التعاقدية.</small>}
    </div>}
    <label className="mr-nl"><span>ملاحظة{decision==="accepted"?" (إلزامية)":""}</span>
      <textarea className="g-textarea" value={note} onChange={e=>setNote(e.target.value)} disabled={!perm.edit} placeholder="سبب القبول أو تفاصيل المطالبة…" rows={2}/></label>
    <div className="mc-act">
      {perm.edit?<button className="g-btn primary" onClick={()=>save()} disabled={!ready||saving}><Icon n="save" s={15}/> {saving?"جارٍ الحفظ…":"حفظ المطابقة"}</button>
        :<small className="g-mut">عرض فقط — الحفظ لمن له تعديل التسوية أو الرواتب.</small>}
      {saved&&<small className="g-mut">آخر حفظ: <span dir="ltr">{new Date(saved.saved_at).toLocaleString("en-GB",{dateStyle:"short",timeStyle:"short"})}</span>{saved.saved_by&&saved.saved_by.name?` · ${saved.saved_by.name}`:""}</small>}
    </div>
    <style>{CSS}</style>
  </section>);
}

const CSS=`
.mr .mc-h .g-badge{font-size:11px}
.mr-hint{font-size:12.5px;margin:0 0 10px}
.mr-pdf{display:flex;align-items:center;gap:8px 10px;flex-wrap:wrap;margin:0 0 10px}
.mr-pdf .g-btn{min-height:44px;cursor:pointer}.mr-pdf label.g-btn:focus-within{box-shadow:var(--glow)}
.mr-pdf small{flex:1 1 200px;min-width:0;font-size:12px;line-height:1.6;overflow-wrap:anywhere}
.mr-pdf small span[dir=ltr]{word-break:break-all}
.mr-auto{font-size:10px;font-weight:700;padding:2px 6px;border-radius:8px;background:var(--info-bg);color:var(--info-ink);white-space:nowrap}
.mr-bdt{margin:12px 0 0;padding:12px 14px;border-radius:16px;border:1px solid var(--line);background:var(--glass-2);display:flex;flex-direction:column;gap:6px}
.mr-note{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12.5px;color:var(--mut);margin:0 0 8px}
.mr-bar{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;font-size:13px;font-weight:700;margin-bottom:10px}
.mr-bar.bad{background:var(--bad-bg);color:var(--bad-ink)}
.mr-in{display:inline-flex;align-items:center;gap:6px;justify-content:flex-end}
.mr-in .g-input{width:96px;min-height:36px;padding:6px 8px;font-size:13px;text-align:left;font-variant-numeric:tabular-nums}
.mr-in .g-badge{white-space:nowrap;direction:ltr}
.mr-alerts{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}
.mr-alerts li{display:flex;align-items:flex-start;gap:8px;padding:8px 11px;border-radius:12px;font-size:12.5px;line-height:1.6}
.mr-alerts li svg{flex:none;margin-top:3px}
.mr-alerts li.warn{background:var(--warn-bg);color:var(--warn-ink)}.mr-alerts li.bad{background:var(--bad-bg);color:var(--bad-ink)}.mr-alerts li.info{background:var(--info-bg);color:var(--info-ink)}
.mr-tot{margin:14px 0;padding:14px;border-radius:16px;border:1px solid var(--line);background:var(--glass-3);display:flex;flex-direction:column;gap:8px}
.mr-th,.mr-tr{display:grid;grid-template-columns:minmax(0,1.3fr) repeat(3,minmax(0,1fr));gap:8px;align-items:center;font-size:13px}
.mr-th b{font-size:11.5px;color:var(--mut)}
.mr-tr b{font-variant-numeric:tabular-nums;text-align:end}.mr-tr>span:last-child{text-align:end}
.mr-th b{text-align:end}
.mr-inv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:6px;padding-top:10px;border-top:1px dashed var(--line)}
.mr-inv label,.mr-inv>div{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:var(--mut);min-width:0}
.mr-inv .g-input{min-height:40px;padding:8px 10px}
.mr-inv b{min-height:40px;display:flex;align-items:center}
.mr-dec{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}
.mr-dec .g-btn.warn-on{background:var(--warn-bg);color:var(--warn-ink);border-color:transparent}
.mr-ca{margin:12px 0 0;padding:10px 12px 12px;border:1px solid var(--line);border-radius:16px;background:var(--glass-2);display:flex;flex-direction:column;gap:6px;min-width:0}
.mr-ca legend{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:var(--ink);padding:0 4px}
.mr-ci{display:flex;align-items:flex-start;gap:10px;padding:9px 11px;border-radius:12px;font-size:12.5px;line-height:1.65;cursor:pointer}
.mr-ci.warn{background:var(--warn-bg);color:var(--warn-ink)}.mr-ci.info{background:var(--info-bg);color:var(--info-ink)}
.mr-ci input{width:20px;height:20px;flex:none;margin-top:2px;accent-color:var(--p)}
.mr-ct{flex:1;min-width:0;overflow-wrap:anywhere}.mr-ci b{white-space:nowrap;font-variant-numeric:tabular-nums}
.mr-cs{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;font-weight:700;padding:4px 6px 0}
.mr-inq{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-radius:14px;font-size:13px;line-height:1.6;margin:12px 0 6px}
.mr-inq>div:first-child{display:flex;align-items:flex-start;gap:7px;flex-wrap:wrap}
.mr-inq.open{background:var(--warn-bg);color:var(--warn-ink)}.mr-inq.done{background:var(--ok-bg);color:var(--ok-ink)}
.mr-inq-a{display:flex;gap:8px;flex-wrap:wrap}.mr-inq-a .g-btn{min-height:40px}
.mr-reply{display:flex;flex-direction:column;gap:6px;color:var(--ink)}
.mr-mail{display:flex;flex-direction:column;gap:6px;margin-top:8px;padding:12px;border-radius:16px;border:1px dashed var(--line-2)}
.mr-mail .mr-nl>span{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mr-body{min-height:160px;resize:vertical;overflow:hidden;line-height:1.7;font-size:13px;white-space:pre-wrap;unicode-bidi:plaintext;text-align:start}
.mr-sent{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:var(--mut);cursor:pointer}
.mr-sent input{width:18px;height:18px;accent-color:var(--p)}
.mr-dec .g-btn{min-height:44px}
.mr-nl{display:flex;flex-direction:column;gap:5px;font-size:12.5px;font-weight:700;color:var(--mut);margin-top:8px}
@media(max-width:640px){
  /* الجوال: اسم السطر في سطر مستقل فوق القيم الثلاث حتى لا تتلاصق الأرقام */
  .mr-th,.mr-tr{grid-template-columns:repeat(3,minmax(0,1fr));font-size:12.5px;gap:4px 8px}
  .mr-in{flex-wrap:wrap}.mr-pdf .g-btn{flex:1 1 100%;justify-content:center}
  .mr-th>span:first-child{display:none}
  .mr-tr>span:first-child{grid-column:1/-1;font-weight:700;color:var(--mut);font-size:12px}
  .mr-tr{padding-bottom:6px;border-bottom:1px dashed var(--line)}
  .mr-inv{grid-template-columns:1fr}
  .mr-in .g-input{width:110px}
  .mr-dec .g-btn{flex:1 1 100%}
}
`;
