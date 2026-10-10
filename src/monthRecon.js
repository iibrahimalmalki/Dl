// الإقفال الشهري — الخطوة 2: مطابقة صافي ومستحق كل بايكر مع كشف سويتر (Breakdown). دوال نقية بلا Supabase.
// المعادلة كما في كشف سويتر: الصافي = أونلاين + إضافات − خصم بايكر − صيانة − غسلات مجانية، ثم + غسلات الضمان؛
// الإجمالي = الصافي × سعر الوحدة؛ المستحق = الإجمالي − المخالفات − التلفيات − التعويضات الأخرى.
// الشريحة المتوقعة من «الإجمالي» (أونلاين + إضافات، قبل الخصومات) والدفع على الصافي — تأكيد سويتر 07/10/2026.
import{payoutForBiker,tiersActive,MIN_GUARANTEE_ORDERS,PRICING_TIERS,SSP_CONTRACT}from"./sweaterContract";

export const r2=x=>Math.round((Number(x)||0)*100)/100;
// قيمة مُدخلة؟ (فارغ/غير رقمي = غير مُدخل)
export const num=v=>{if(v===""||v==null)return null;const n=Number(String(v).replace(/,/g,"").trim());return isFinite(n)?n:null;};
// حقول كشف سويتر لكل بايكر
export const SWEATER_FIELDS=["guarantee","net","unit","violations","damages","otherComp","payable"];
const FREE=/free\s*wash/i;
const PAY_TOL=0.05;
// رقم من نص التعويض («15» أو «15 SAR»)؛ «Free Wash» ليس مبلغاً
const compAmount=c=>{if(c==null||FREE.test(String(c)))return null;const m=String(c).replace(/,/g,"").match(/-?\d+(\.\d+)?/);return m?Number(m[0]):null;};
// رقم الشريحة لسعر وحدة (لعرض «الشريحة 3»)
export const tierOfUnit=u=>{const t=PRICING_TIERS.find(x=>Math.abs(x.price-Number(u))<0.005);return t?t.tier:null;};

// bikers:[{sweater_id,biker_name,net_washes}] · adjustments:[{kind,sweater_id}] · tickets:[{sweater_id,compensation}]
// violations:[{sweater_id,amount}] (المؤكدة في المنصة؛ ربط employee_id ← sweater_id يتم قبل الاستدعاء)
// sweater:{[sweater_id]:{guarantee,net,unit,violations,damages,otherComp,payable,biker_name?}} · period:"YYYY-MM"
export function reconcileMonth({bikers=[],adjustments=[],tickets=[],violations=[],sweater={},period}){
  const sid=x=>x==null?"":String(x).trim();
  const ids=[];const seen=new Set();
  const push=id=>{if(id&&!seen.has(id)){seen.add(id);ids.push(id);}};
  bikers.forEach(b=>push(sid(b.sweater_id)));Object.keys(sweater||{}).forEach(k=>push(sid(k)));
  const tiers=tiersActive(period);

  const rows=ids.map(id=>{
    const b=bikers.find(x=>sid(x.sweater_id)===id);const s=(sweater||{})[id]||{};
    const cnt=k=>adjustments.filter(a=>a.kind===k&&sid(a.sweater_id)===id).length;
    const tk=tickets.filter(t=>sid(t.sweater_id)===id);
    const online=b?Number(b.net_washes)||0:0;
    const add=cnt("add"),deduct=cnt("deduct"),maintenance=cnt("maintenance");
    const freeWash=tk.filter(t=>FREE.test(String(t.compensation??""))).length;
    const otherCompCalc=r2(tk.reduce((a,t)=>a+(compAmount(t.compensation)||0),0));
    const violPlat=r2(violations.filter(v=>sid(v.sweater_id)===id).reduce((a,v)=>a+(Number(v.amount)||0),0));
    const totalWashes=online+add;
    const netCalc=totalWashes-deduct-maintenance-freeWash;

    const sv={};SWEATER_FIELDS.forEach(f=>{sv[f]=num(s[f]);});
    const guarantee=sv.guarantee??0;
    const netBill=netCalc+guarantee;
    const pe=payoutForBiker(netBill,period,totalWashes);
    const unitExp=pe.unit,tierExp=pe.tier;
    const unit=sv.unit??unitExp;
    const gross=r2(netBill*unit);
    const viol=sv.violations??violPlat,dam=sv.damages??0,oc=sv.otherComp??otherCompCalc;
    const deductions=r2(viol+dam+oc);
    const payableCalc=r2(gross-deductions);
    const unitVat=r2(unit*1.15),grossVat=r2(netBill*unitVat);

    const dNet=sv.net!=null?sv.net-netBill:null;
    const dUnit=sv.unit!=null?r2(sv.unit-unitExp):null;
    const dPay=sv.payable!=null?r2(sv.payable-payableCalc):null;
    const dViol=sv.violations!=null?r2(sv.violations-violPlat):null;
    const dComp=sv.otherComp!=null?r2(sv.otherComp-otherCompCalc):null;
    // أثر فرق السعر على المستحق (موجب = علينا): «فرق 99.44 ﷼»
    const unitImpact=dUnit?r2(netBill*-dUnit):0;
    // الحد الأدنى المضمون (ملحق التسعير، من أغسطس 2026) — غير مؤكَّد، للعرض والسؤال فقط ولا يدخل المستحق
    const belowMin=tiers&&netBill<MIN_GUARANTEE_ORDERS;
    const minGap=belowMin?MIN_GUARANTEE_ORDERS-netBill:0;
    const minGapAmount=belowMin?r2(minGap*unitExp):0;

    return{sweater_id:id,biker_name:(b&&b.biker_name)||s.biker_name||id,inPlatform:!!b,inSweater:sv.net!=null||sv.payable!=null,
      online,add,deduct,maintenance,freeWash,otherCompCalc,violPlat,totalWashes,netCalc,
      guarantee,netBill,unitExp,tierExp,tierSweater:sv.unit!=null?tierOfUnit(sv.unit):null,unit,gross,unitVat,grossVat,
      violations:viol,damages:dam,otherComp:oc,deductions,payableCalc,
      sweaterNet:sv.net,sweaterPayable:sv.payable,
      entered:sv.net!=null&&sv.payable!=null,
      dNet,dUnit,dPay,dViol,dComp,unitImpact,belowMin,minGap,minGapAmount};
  });

  const sum=k=>r2(rows.reduce((a,r)=>a+(Number(r[k])||0),0));
  const totals={};
  ["online","add","deduct","maintenance","freeWash","totalWashes","netCalc","guarantee","netBill","gross","grossVat","violations","damages","otherComp","deductions","payableCalc","otherCompCalc","violPlat","unitImpact"].forEach(k=>{totals[k]=sum(k);});
  totals.sweaterNet=rows.some(r=>r.sweaterNet!=null)?sum("sweaterNet"):null;
  totals.sweaterPayable=rows.some(r=>r.sweaterPayable!=null)?sum("sweaterPayable"):null;
  totals.dNet=rows.some(r=>r.dNet!=null)?sum("dNet"):null;
  totals.dPay=rows.some(r=>r.dPay!=null)?sum("dPay"):null;
  // غير شامل = Σ المستحق · شامل = Σ round2(الصافي × round2(السعر × 1.15)) − Σ الخصومات (الضريبة على الإجمالي قبل الخصومات، كما في كشف سويتر)
  totals.exVat=sum("payableCalc");
  totals.incVat=r2(totals.grossVat-totals.deductions);

  const allEntered=rows.length>0&&rows.every(r=>r.entered);
  const status=!allEntered?"pending":rows.every(r=>r.dNet===0&&Math.abs(r.dPay)<=PAY_TOL)?"matched":"diff";
  return{rows,totals,status};
}

// ── ريال الجودة (البند التاسع): +1﷼/طلب عند متوسط تقييم ≥ 4.75 وشكاوى مثبتة ≤ 1% — صرفه تقديري لسويتر ──
// ratings:[{sweater_id,rating,complaint_pct}] · النص «متوسط تقييم البايكرية العام» يحتمل تفسيرين:
// لكل بايكر (qualifies) أو متوسط الفريق (teamQualifies) — لذلك المخرج سؤال لا مطالبة.
export function incentiveOf(res,ratings=[],period){
  const C=SSP_CONTRACT.incentive_conditions,per=SSP_CONTRACT.incentive;
  const active=tiersActive(period);
  const bikers=(res&&res.rows||[]).filter(r=>r.inPlatform).map(r=>{
    const g=(ratings||[]).find(x=>String(x.sweater_id||"").trim()===r.sweater_id)||{};
    const rating=num(g.rating),complaintPct=num(g.complaint_pct);
    const known=rating!=null&&complaintPct!=null;
    const qualifies=active&&known&&rating>=C.min_rating&&complaintPct<=C.max_complaints_pct;
    return{sweater_id:r.sweater_id,biker_name:r.biker_name,rating,complaintPct,known,qualifies,orders:r.netBill,amount:qualifies?r2(r.netBill*per):0};});
  const rs=bikers.map(b=>b.rating).filter(x=>x!=null);
  const teamAvg=rs.length?r2(rs.reduce((a,b)=>a+b,0)/rs.length):null;
  const teamQualifies=active&&teamAvg!=null&&teamAvg>=C.min_rating&&bikers.every(b=>b.complaintPct==null||b.complaintPct<=C.max_complaints_pct);
  return{active,bikers,teamAvg,teamQualifies,amount:r2(bikers.reduce((a,b)=>a+b.amount,0))};
}

// ── تنبيهات تعاقدية (ليست مطالبة مؤكدة): أسئلة عن تفسير ملحق التسعير ──
const fm=v=>Number(v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const tierAr=t=>t==null?"—":typeof t==="number"?`الشريحة ${t}`:t==="Golden Guarantee"?"دون الشريحة 1 (20﷼)":String(t);
const tierEn=t=>t==null?"—":typeof t==="number"?`Tier ${t}`:String(t);
// unit: السعر المطبّق أقل من المتوقع من العقد · min_guarantee: الصافي أقل من الحد الأدنى المضمون (من 2026-08)
// opts.ratings ⇒ أسئلة ريال الجودة لمن تأهّل
export function alertsOf(res,period,opts={}){
  const out=[];
  (res&&res.rows||[]).forEach(r=>{
    const who=`${r.biker_name} (${r.sweater_id})`;
    if(r.dUnit!=null){const amount=r2((r.unitExp-r.unit)*r.netBill);
      if(amount>0)out.push({id:`unit:${r.sweater_id}`,sweater_id:r.sweater_id,biker_name:r.biker_name,kind:"unit",amount,orders:0,
        unit:r.unit,unitExp:r.unitExp,netBill:r.netBill,totalWashes:r.totalWashes,
        ar:`البايكر ${who}: سعر الوحدة المطبّق ${fm(r.unit)} ﷼ (${tierAr(r.tierSweater)})، والمتوقع وفق ملحق التسعير ${fm(r.unitExp)} ﷼ (${tierAr(r.tierExp)}) لإجمالي ${r.totalWashes} غسلة (صافي ${r.netBill}) — الفرق ${fm(amount)} ﷼.`,
        en:`${who}: applied unit price SAR ${fm(r.unit)} (${tierEn(r.tierSweater)}); expected per the pricing appendix SAR ${fm(r.unitExp)} (${tierEn(r.tierExp)}) for ${r.totalWashes} total washes (${r.netBill} net) — difference SAR ${fm(amount)}.`});}
    if(tiersActive(period)&&r.inPlatform&&r.netBill<MIN_GUARANTEE_ORDERS){const orders=MIN_GUARANTEE_ORDERS-r.netBill,amount=r2(orders*r.unit);
      out.push({id:`min:${r.sweater_id}`,sweater_id:r.sweater_id,biker_name:r.biker_name,kind:"min_guarantee",amount,orders,
        unit:r.unit,netBill:r.netBill,unconfirmed:true,
        ar:`البايكر ${who}: الصافي المطبّق ${r.netBill} غسلة، أقل من الحد الأدنى ${MIN_GUARANTEE_ORDERS} (مشروط وفق «ثانياً» من الملحق: هل كان نقص الطلبات من سويتر أم من الحضور؟) — الفارق ${orders} غسلة × ${fm(r.unit)} ﷼ = ${fm(amount)} ﷼.`,
        en:`${who}: applied net ${r.netBill} washes, below the guaranteed minimum of ${MIN_GUARANTEE_ORDERS} — shortfall ${orders} washes × SAR ${fm(r.unit)} = SAR ${fm(amount)}.`});}
  });
  if(opts.ratings){const inc=incentiveOf(res,opts.ratings,period);
    inc.bikers.filter(b=>b.qualifies).forEach(b=>{const who=`${b.biker_name} (${b.sweater_id})`;
      out.push({id:`inc:${b.sweater_id}`,sweater_id:b.sweater_id,biker_name:b.biker_name,kind:"incentive",amount:b.amount,orders:0,question:true,
        ar:`البايكر ${who}: تقييمه ${b.rating} وشكاواه ${b.complaintPct}% ⇒ مؤهَّل لريال الجودة (البند التاسع) على صافي ${b.orders} غسلة = ${fm(b.amount)} ﷼. هل يُطبَّق الشرط لكل بايكر أم على متوسط الفريق (${inc.teamAvg??"—"})؟`,
        en:`${who}: rating ${b.rating}, complaints ${b.complaintPct}% ⇒ meets the quality incentive (clause 9) on ${b.orders} net washes = SAR ${fm(b.amount)}. Is the condition applied per biker or on the team average (${inc.teamAvg??"—"})?`});});}
  return out;
}

const MAR=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const MEN=["January","February","March","April","May","June","July","August","September","October","November","December"];
const pAr=p=>{const[y,m]=String(p||"").split("-");return`${MAR[+m-1]||m} ${y}`;};
const pEn=p=>{const[y,m]=String(p||"").split("-");return`${MEN[+m-1]||m} ${y}`;};
// رسالة استفسار (لا مطالبة) — نص عادي، عربي ثم إنجليزي، بالبنود المختارة فقط
export function inquiryEmail({period,reportNo,alerts=[],operatorName}){
  const ref=reportNo?` (${reportNo})`:"";
  const total=r2(alerts.reduce((a,x)=>a+(x.amount||0),0));
  const hasUnit=alerts.some(a=>a.kind==="unit"),hasMin=alerts.some(a=>a.kind==="min_guarantee"),hasInc=alerts.some(a=>a.kind==="incentive");
  const sign=operatorName||"دلو ورغوة";
  const askAr=[hasUnit&&"آلية احتساب الشريحة وسعر الوحدة",hasMin&&`شرط الحد الأدنى المضمون (${MIN_GUARANTEE_ORDERS} غسلة شهرياً لكل بايكر) وكيفية تطبيقه`,hasInc&&"آلية احتساب ريال الجودة (البند التاسع)"].filter(Boolean).join("، و");
  const askEn=[hasUnit&&"how the pricing tier and unit price are determined",hasMin&&`how the guaranteed minimum (${MIN_GUARANTEE_ORDERS} washes per biker per month) is applied`,hasInc&&"how the quality incentive (clause 9) is assessed"].filter(Boolean).join(", and ");
  const subject=`استفسار عن كشف ${pAr(period)} — الشريك 47${ref}`;
  const body=[
    "السلام عليكم ورحمة الله وبركاته،","فريق سويتر المحترم،","",
    `راجعنا كشف ${pAr(period)}${ref} وأعداد الغسلات مطابقة لسجلاتنا، ونودّ الاستفسار عن البنود التالية:`,"",
    ...alerts.map((a,i)=>`${i+1}) ${a.ar}`),"",
    `إجمالي المبلغ محل الاستفسار: ${fm(total)} ﷼ (غير شامل الضريبة).`,
    `نرجو توضيح ${askAr} وفق ملحق التسعير الموقّع بتاريخ 30/07/2026.`,"",
    "شاكرين تعاونكم،",sign,"شريك سويتر رقم 47","",
    "———","",
    "Dear Sweater team,","",
    `We have reviewed the ${pEn(period)} statement${ref} and the wash counts match our records. We would appreciate clarification on the following items:`,"",
    ...alerts.map((a,i)=>`${i+1}) ${a.en}`),"",
    `Total amount in question: SAR ${fm(total)} (excl. VAT).`,
    `Could you please clarify ${askEn}, according to the pricing appendix signed on 30/07/2026?`,"",
    "Thank you,",sign,"Sweater Partner #47",
  ].join("\n");
  return{subject,body,total};
}

// مبلغ المطالبة = مجموع الفروق السالبة علينا (كشف سويتر أقل من المحسوب) + مبالغ التنبيهات المختارة (picked)
// بنود question (ريال الجودة — صرفه تقديري) لا تدخل مبلغ المطالبة
export function claimFrom({rows=[]},picked=[]){
  picked=(picked||[]).filter(x=>!x.question);
  const neg=rows.filter(r=>r.dPay!=null&&r.dPay<-PAY_TOL);
  const base=r2(neg.reduce((a,r)=>a-r.dPay,0)),baseOrders=rows.reduce((a,r)=>a+(r.dNet!=null&&r.dNet<0?-r.dNet:0),0);
  const pa=r2((picked||[]).reduce((a,x)=>a+(x.amount||0),0)),po=(picked||[]).reduce((a,x)=>a+(x.orders||0),0);
  return{amount:r2(base+pa),orders:baseOrders+po,bikers:[...new Set([...neg.map(r=>r.sweater_id),...(picked||[]).map(x=>x.sweater_id)])],diffAmount:base,alertAmount:pa,items:(picked||[]).map(x=>x.id)};
}
