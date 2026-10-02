// كشف سويتر الشهري (SSP Bucket … Breakdown.pdf) → أرقام المطابقة. دوال نقية بلا PDF ولا Supabase.
// lines: أسطر نصية (عناصر الصفحة ذات الإحداثي y نفسه، مرتبة حسب x، مفصولة بمسافة) — تُستخرج في المتصفح بـ pdf.js.
// أي حقل لا يُعثر عليه ⇒ null مع تحذير، لا خطأ.

const MONTHS=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
// علامة الناقص قد تكون U+2212 أو شرطة؛ الأرقام بفواصل آلاف
const clean=s=>String(s??"").replace(/−/g,"-").replace(/ /g," ").replace(/\s+/g," ").trim();
const n=s=>{if(s==null||s==="-"||s==="")return null;const v=Number(String(s).replace(/,/g,""));return isFinite(v)?v:null;};
const r2=x=>Math.round((Number(x)||0)*100)/100;
const NUM="(\\d[\\d,]*(?:\\.\\d+)?)";

// صف بايكر بالتسلسل الرقمي: #، [اسم اختياري]، رقم سويتر، الشريحة، السعر، الأيام، أونلاين، أوفلاين، الصافي، المتوسط، عدد المخالفات|-، الخصم|-، المستحق
const ROW=new RegExp("^(\\d{1,3}) (?:.*? )?(\\d{3,7}) (\\d{1,2}|[A-Za-z][\\w-]*) (\\d+\\.\\d{1,3}) (\\d{1,2}) "+NUM+" "+NUM+" "+NUM+" (\\d+(?:\\.\\d+)?) (\\d+|-) ("+NUM.slice(1,-1)+"|-) "+NUM+"$");

export function parseBreakdown(input){
  const lines=(input||[]).map(clean).filter(Boolean);
  const warnings=[];const W=(code,ar)=>warnings.push({code,ar});
  const find=re=>{for(const l of lines){const m=l.match(re);if(m)return m;}return null;};

  // الفترة ورقم التقرير
  let period=null;const pm=find(/Period:?\s*([A-Za-z]+)\.?\s+(\d{4})/i);
  if(pm){const i=MONTHS.indexOf(pm[1].slice(0,3).toLowerCase());if(i>=0)period=`${pm[2]}-${String(i+1).padStart(2,"0")}`;}
  if(!period)W("missing","لم يُعثر على فترة الكشف (Period)");
  const rn=find(/Report\s*#:?\s*([A-Z0-9][\w-]*)/i);const reportNo=rn?rn[1]:null;
  if(!reportNo)W("missing","لم يُعثر على رقم التقرير (Report #)");

  // الإجماليات — كل بند بتسميته؛ الغائب null مع تحذير
  const T={};
  const take=(key,ar,re,g=1)=>{const m=find(re);T[key]=m?n(m[g]):null;if(T[key]==null)W("missing",`لم يُعثر على «${ar}» في الكشف`);};
  take("online","Online Washes",new RegExp("^Online Washes "+NUM,"i"));
  take("add","Washes to Add",new RegExp("^(?!.*Guarantee).*Washes to Add \\+ ?"+NUM,"i"));
  take("guarantee","Guarantee Shortfall",new RegExp("Guarantee Shortfall.*?\\+ ?"+NUM,"i"));
  take("freeWash","Compensations (Free Wash)",new RegExp("Compensations \\(Free Wash\\) ?- ?"+NUM,"i"));
  take("deduct","Washes to Deduct",new RegExp("Washes to Deduct ?- ?"+NUM,"i"));
  take("maintenance","Maintenance Washes",new RegExp("Maintenance Washes ?- ?"+NUM,"i"));
  take("net","Net Washes Count",new RegExp("^Net Washes Count.* "+NUM+"$","i"));
  const vm=find(new RegExp("Total Violations (\\d+) ?/ ?"+NUM,"i"));T.violCount=vm?n(vm[1]):null;T.violations=vm?n(vm[2]):null;
  if(T.violations==null)W("missing","لم يُعثر على «Total Violations» في الكشف");
  const dm=find(new RegExp("Total Damages (\\d+) ?/ ?"+NUM,"i"));T.damages=dm?n(dm[2]):null;
  if(T.damages==null)W("missing","لم يُعثر على «Total Damages» في الكشف");
  take("otherComp","Other Compensations",new RegExp("Other Compensations.*? "+NUM+" ?SAR","i"));
  take("deductions","Total Amount Deductions",new RegExp("Total Amount Deductions "+NUM,"i"));
  take("gross","Gross",new RegExp("^Gross "+NUM,"i"));
  take("vat","Includes VAT",new RegExp("Includes VAT "+NUM,"i"));

  // سطر الإجماليات: Totals — N bikers أيام أونلاين أوفلاين صافي متوسط مخالفات خصم مستحق
  const tm=find(new RegExp("^Totals\\b.*? "+NUM+" "+NUM+" "+NUM+" "+NUM+" (\\d+(?:\\.\\d+)?) (\\d+|-) ("+NUM.slice(1,-1)+"|-) "+NUM+"$","i"));
  T.exVat=tm?n(tm[8]):null;
  if(T.exVat==null&&T.gross!=null&&T.deductions!=null){T.exVat=r2(T.gross-T.deductions);W("derived","لم يُعثر على سطر الإجماليات — المستحق قبل الضريبة محسوب من الإجمالي − الخصومات");}
  if(T.exVat==null)W("missing","لم يُعثر على المستحق قبل الضريبة");
  // شامل الضريبة يُقرأ من «TOTAL PAYABLE — INCLUDING VAT»؛ إن تعذّر ⇒ gross + vat − deductions
  const im=find(new RegExp("TOTAL PAYABLE.*INCLUDING VAT.*? "+NUM+"(?: ?SAR)?$","i"));
  T.incVat=im?n(im[1]):(T.gross!=null&&T.vat!=null&&T.deductions!=null?r2(T.gross+T.vat-T.deductions):null);
  if(T.incVat==null)W("missing","لم يُعثر على المستحق شامل الضريبة");

  // أسماء «Name (id)» أينما وردت — والاسم قد يأتي على سطرين (الاسم ثم «(id)» أو جزء منه في السطر السابق)
  const names={};
  lines.forEach((l,i)=>{const re=/([A-Za-z][A-Za-z .'-]*?)?\s*\((\d{3,7})\)/g;let m;while((m=re.exec(l))){
    let nm=(m[1]||"").trim();
    // اسم ناقص (فارغ أو كلمة واحدة) ⇒ أقرب سطر نصّي خالص خلال سطرين قبله
    if(!nm||!/\s/.test(nm)){for(const j of [i-1,i-2]){const prev=lines[j]||"";if(/^[A-Za-z][A-Za-z .'-]*$/.test(prev)){nm=(prev+" "+nm).trim();break;}}}
    if(nm&&!names[m[2]])names[m[2]]=nm.replace(/\s+/g," ");}});

  const bikers=[];
  lines.forEach(l=>{const m=l.match(ROW);if(!m)return;
    bikers.push({sweater_id:m[2],name:names[m[2]]||null,tier:/^\d+$/.test(m[3])?Number(m[3]):m[3],unit:n(m[4]),days:n(m[5]),
      online:n(m[6]),offline:n(m[7]),net:n(m[8]),violCount:m[10]==="-"?0:n(m[10]),deduct:m[11]==="-"?0:n(m[11]),payable:n(m[12])});});
  if(!bikers.length)W("no_bikers","لم يُعثر على صفوف البايكرز في الكشف");

  // تحقّق داخلي
  if(bikers.length&&T.net!=null){const s=bikers.reduce((a,b)=>a+(b.net||0),0);if(s!==T.net)W("sum_net",`مجموع صافي البايكرز ${s} ≠ صافي الكشف ${T.net}`);}
  if(bikers.length&&T.exVat!=null){const s=r2(bikers.reduce((a,b)=>a+(b.payable||0),0));if(Math.abs(s-T.exVat)>0.05)W("sum_pay",`مجموع المستحق ${s} ≠ المستحق قبل الضريبة ${T.exVat}`);}
  if(T.gross!=null&&T.deductions!=null&&T.exVat!=null&&Math.abs(r2(T.gross-T.deductions)-T.exVat)>0.05)W("gross",`الإجمالي − الخصومات (${r2(T.gross-T.deductions)}) ≠ المستحق قبل الضريبة ${T.exVat}`);

  const totals={online:T.online,add:T.add,guarantee:T.guarantee,freeWash:T.freeWash,deduct:T.deduct,maintenance:T.maintenance,net:T.net,
    violations:T.violations,damages:T.damages,otherComp:T.otherComp,deductions:T.deductions,gross:T.gross,exVat:T.exVat,incVat:T.incVat,vat:T.vat};
  return{period,reportNo,bikers,totals,warnings};
}

// تعبئة حقول المطابقة من الكشف. calc:{[sweater_id]:netCalc} (الصافي المحسوب في المنصة قبل الضمان)
// ⇒ {sweater:{[sid]:{net,unit,payable,guarantee?,violations,otherComp,damages?}}, filled:{[sid]:[حقول]}, warnings, invoice:{ref,amount}}
export function fillFromBreakdown(br,calc={}){
  const sweater={},filled={},warnings=[];const W=(code,ar)=>warnings.push({code,ar});
  const set=(sid,k,v)=>{if(v==null)return;(sweater[sid]=sweater[sid]||{})[k]=String(v);(filled[sid]=filled[sid]||[]).push(k);};
  const T=br.totals||{};
  br.bikers.forEach(b=>{const sid=b.sweater_id;
    if(b.name)(sweater[sid]=sweater[sid]||{}).biker_name=b.name;
    set(sid,"net",b.net);set(sid,"unit",b.unit);set(sid,"payable",b.payable);
    // عمود Deduct. مجموع واحد: مع مخالفات ⇒ «المخالفات»، وإلا ⇒ «تعويضات أخرى»
    const d=b.deduct||0;
    if(b.violCount>0){set(sid,"violations",d);set(sid,"otherComp",0);}else{set(sid,"otherComp",d);set(sid,"violations",0);}
    if(T.damages===0)set(sid,"damages",0);
  });
  // غسلات الضمان = صافي الكشف − الصافي المحسوب (إن كان موجباً)، بشرط أن يساوي مجموعها «Guarantee Shortfall»
  const g={};br.bikers.forEach(b=>{const c=calc[b.sweater_id];if(c!=null&&b.net!=null&&b.net-c>0)g[b.sweater_id]=b.net-c;});
  const gs=Object.values(g).reduce((a,x)=>a+x,0);
  if(T.guarantee!=null&&gs===T.guarantee){br.bikers.forEach(b=>{if(calc[b.sweater_id]!=null)set(b.sweater_id,"guarantee",g[b.sweater_id]||0);});}
  else if(gs>0||T.guarantee)W("guarantee",`تعذّر توزيع غسلات الضمان (${T.guarantee??"؟"} في الكشف، والفروق ${gs}) — أدخلها يدوياً`);
  const sum=k=>r2(Object.values(sweater).reduce((a,s)=>a+(Number(s[k])||0),0));
  if(T.violations!=null&&sum("violations")!==r2(T.violations))W("split",`راجع توزيع الخصومات: المخالفات ${sum("violations")} مقابل ${T.violations} في الكشف`);
  if(T.otherComp!=null&&sum("otherComp")!==r2(T.otherComp))W("split",`راجع توزيع الخصومات: التعويضات الأخرى ${sum("otherComp")} مقابل ${T.otherComp} في الكشف`);
  if(T.damages)W("split",`الكشف فيه تلفيات ${T.damages} ﷼ غير موزّعة على البايكرز — أدخلها يدوياً`);
  return{sweater,filled,warnings,invoice:{ref:br.reportNo||null,amount:T.exVat??null}};
}

export const periodOfFile=name=>{const m=String(name||"").match(/_(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*_(\d{4})/i);if(!m)return null;return`${m[2]}-${String(MONTHS.indexOf(m[1].slice(0,3).toLowerCase())+1).padStart(2,"0")}`;};
