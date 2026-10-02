// الإقفال الشهري — الخطوة 2: مطابقة صافي ومستحق كل بايكر مع كشف سويتر (Breakdown). دوال نقية بلا Supabase.
// المعادلة كما في كشف سويتر: الصافي = أونلاين + إضافات − خصم بايكر − صيانة − غسلات مجانية، ثم + غسلات الضمان؛
// الإجمالي = الصافي × سعر الوحدة؛ المستحق = الإجمالي − المخالفات − التلفيات − التعويضات الأخرى.
import{payoutForBiker,tiersActive,MIN_GUARANTEE_ORDERS,PRICING_TIERS}from"./sweaterContract";

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
    const netCalc=online+add-deduct-maintenance-freeWash;

    const sv={};SWEATER_FIELDS.forEach(f=>{sv[f]=num(s[f]);});
    const guarantee=sv.guarantee??0;
    const netBill=netCalc+guarantee;
    const pe=payoutForBiker(netBill,period);
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
    // الحد الأدنى المضمون (ملحق التسعير، من أغسطس 2026) — للعرض فقط
    const belowMin=tiers&&netBill<MIN_GUARANTEE_ORDERS;
    const minGap=belowMin?MIN_GUARANTEE_ORDERS-netBill:0;
    const minGapAmount=belowMin?r2(minGap*unitExp):0;

    return{sweater_id:id,biker_name:(b&&b.biker_name)||s.biker_name||id,inPlatform:!!b,inSweater:sv.net!=null||sv.payable!=null,
      online,add,deduct,maintenance,freeWash,otherCompCalc,violPlat,netCalc,
      guarantee,netBill,unitExp,tierExp,tierSweater:sv.unit!=null?tierOfUnit(sv.unit):null,unit,gross,unitVat,grossVat,
      violations:viol,damages:dam,otherComp:oc,deductions,payableCalc,
      sweaterNet:sv.net,sweaterPayable:sv.payable,
      entered:sv.net!=null&&sv.payable!=null,
      dNet,dUnit,dPay,dViol,dComp,unitImpact,belowMin,minGap,minGapAmount};
  });

  const sum=k=>r2(rows.reduce((a,r)=>a+(Number(r[k])||0),0));
  const totals={};
  ["online","add","deduct","maintenance","freeWash","netCalc","guarantee","netBill","gross","grossVat","violations","damages","otherComp","deductions","payableCalc","otherCompCalc","violPlat","unitImpact"].forEach(k=>{totals[k]=sum(k);});
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

// مبلغ المطالبة = مجموع الفروق السالبة علينا (كشف سويتر أقل من المحسوب)
export function claimFrom({rows=[]}){
  const neg=rows.filter(r=>r.dPay!=null&&r.dPay<-PAY_TOL);
  return{amount:r2(neg.reduce((a,r)=>a-r.dPay,0)),orders:rows.reduce((a,r)=>a+(r.dNet!=null&&r.dNet<0?-r.dNet:0),0),bikers:neg.map(r=>r.sweater_id)};
}
