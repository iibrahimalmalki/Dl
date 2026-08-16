import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{settlementLine,MIN_GUARANTEE_ORDERS,SSP_CONTRACT,tiersActive}from"./sweaterContract";

const money=n=>Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})+" ﷼";
const int=n=>Number(n||0).toLocaleString("en-US");
const curMonth=()=>new Date().toISOString().slice(0,7);
const periodAr=p=>{if(!p)return"—";const[y,m]=String(p).split("-");const M=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];return`${M[(+m||1)-1]} ${y}`;};
const fmtDate=d=>{if(!d)return"—";try{return new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric"});}catch{return d;}};

// بيانات المؤسسة الرسمية (من عقد الشراكة)
const ORG={name:"مؤسسة دلو ورغوة التجارية",en:"Dalu & Raghwa Trading Est.",cr:"7051245657",rep:"إبراهيم حسن بن عيضه المالكي",phone:"0566884419",email:"abo.malk.03@gmail.com",bank:"مصرف الراجحي",acct:"48700010006086307342",iban:"SA2980000487608016307342",addr:"مبنى 2729، شارع عتيك بن قيس، حي طيبة، الرياض 14522",shortAddr:"RMTB2729",partner:"شريك سويتر · Partner ID 47"};
// المشتري — الكيان القانوني لسويتر للفوترة (سند القبض الرسمي)
const BUYER={name:"شركة اللمسة العصرية التقنية",en:"Modern Technical Touch Co — Sweater",cr:"1010638717",vat:"310585080800003",addr:"2727 شارع أنس بن مالك، حي الصحافة، الرياض 13321"};

// تفقيط عربي للمبالغ (0 – 999,999,999)
function tafqit(num){
  num=Math.floor(Math.abs(Number(num)||0));
  if(num===0)return"صفر";
  const ones=["","واحد","اثنان","ثلاثة","أربعة","خمسة","ستة","سبعة","ثمانية","تسعة","عشرة","أحد عشر","اثنا عشر","ثلاثة عشر","أربعة عشر","خمسة عشر","ستة عشر","سبعة عشر","ثمانية عشر","تسعة عشر"];
  const tens=["","","عشرون","ثلاثون","أربعون","خمسون","ستون","سبعون","ثمانون","تسعون"];
  const hund=["","مئة","مئتان","ثلاثمئة","أربعمئة","خمسمئة","ستمئة","سبعمئة","ثمانمئة","تسعمئة"];
  const below1000=n=>{const out=[];const h=Math.floor(n/100),r=n%100;if(h)out.push(hund[h]);if(r){if(r<20)out.push(ones[r]);else{const o=r%10,t=Math.floor(r/10);out.push(o?ones[o]+" و"+tens[t]:tens[t]);}}return out.join(" و");};
  const parts=[];const mil=Math.floor(num/1000000),th=Math.floor((num%1000000)/1000),rest=num%1000;
  if(mil)parts.push(mil===1?"مليون":mil===2?"مليونان":(mil<11?below1000(mil)+" ملايين":below1000(mil)+" مليوناً"));
  if(th)parts.push(th===1?"ألف":th===2?"ألفان":(th<11?below1000(th)+" آلاف":below1000(th)+" ألفاً"));
  if(rest)parts.push(below1000(rest));
  return parts.join(" و");
}
function amountWords(v){
  const n=Number(v||0);const r=Math.floor(n);const h=Math.round((n-r)*100);
  let s="فقط "+tafqit(r)+" ريالاً سعودياً";
  if(h)s+=" و"+tafqit(h)+" هللة";
  return s+" لا غير";
}
function voucherHTML(h,period){
  const org=location&&location.origin?location.origin:"";
  const amt=Number(h.paid_amount||0);
  const no=h.receipt_voucher_no||("DW-RV-"+period+"-01");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>سند استلام ${no}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Tajawal',Tahoma,sans-serif;background:#eef1f5;color:#0f172a;padding:16px;line-height:1.65}
.sheet{max-width:820px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(16,24,40,.12)}
.top{background:linear-gradient(135deg,#E8712B,#c85a1c);color:#fff;padding:22px 30px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
.bz{display:flex;align-items:center;gap:14px}
.bz .lg{width:52px;height:52px;border-radius:13px;background:#fff;display:flex;align-items:center;justify-content:center;flex:none;box-shadow:0 6px 16px rgba(0,0,0,.15)}
.bz .lg img{width:36px;height:36px;object-fit:contain}
.bz h1{font-size:21px;font-weight:800;letter-spacing:-.4px}.bz span{font-size:11.5px;opacity:.92;font-weight:500}
.doc{text-align:left;direction:ltr}.doc .t{font-size:19px;font-weight:800}.doc .t small{font-size:12px;font-weight:600;display:block;opacity:.9}
.doc .n{font-size:12.5px;background:rgba(255,255,255,.22);padding:4px 12px;border-radius:20px;margin-top:7px;display:inline-block;font-weight:700}
.body{padding:24px 30px}
.amount{background:#f4f0ff;border:1.5px solid #cdbdf6;border-radius:14px;padding:16px 20px;text-align:center;margin-bottom:20px}
.amount .lbl{font-size:12px;color:#6941c6;font-weight:700}.amount .val{font-size:32px;font-weight:800;color:#5b21b6;letter-spacing:-1px;margin-top:2px}
.amount .words{font-size:13px;color:#475467;margin-top:6px;font-weight:600}
table{width:100%;border-collapse:collapse}td{padding:10px 13px;border-bottom:1px solid #eef0f3;font-size:13px;vertical-align:top}
td.k{color:#64748b;font-weight:700;width:42%;background:#fafbfc}td.v{font-weight:700;color:#0f172a}
.mono{font-family:'Courier New',monospace;font-size:12px;letter-spacing:.3px;direction:ltr;display:inline-block}
.note{margin-top:14px;background:#fbfaf7;border:1px dashed #e6ddca;border-radius:10px;padding:10px 13px;font-size:12px;color:#7c6f57;font-weight:600}
.stamp{margin-top:16px;text-align:center}.stamp span{display:inline-block;border:2.5px solid #087443;color:#087443;font-weight:800;font-size:14px;padding:7px 18px;border-radius:10px;transform:rotate(-4deg);opacity:.85}
.sign{display:flex;justify-content:space-between;gap:24px;margin-top:30px;flex-wrap:wrap}.sign div{flex:1;min-width:200px}
.sign .line{border-top:1.5px dashed #cbd5e1;margin-top:40px;padding-top:7px;font-size:12px;color:#64748b;font-weight:700;text-align:center}
.foot{background:#0f172a;color:#cbd5e1;padding:12px 30px;font-size:11px;text-align:center;line-height:1.7}
.bar{max-width:820px;margin:14px auto 0;text-align:center}.pbtn{background:#E8712B;color:#fff;border:none;padding:12px 26px;border-radius:12px;font-family:inherit;font-size:14px;font-weight:800;cursor:pointer}
@media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0}.bar{display:none}}
</style></head><body>
<div class="sheet">
 <div class="top">
  <div class="bz"><div class="lg"><img src="${org}/brand-mark.png" alt="شعار"/></div><div><h1>${ORG.name}</h1><span>${ORG.en} · ${ORG.partner}</span></div></div>
  <div class="doc"><div class="t">سند استلام<small>Receipt Voucher</small></div><div class="n">رقم: ${no}</div></div>
 </div>
 <div class="body">
  <div class="amount"><div class="lbl">المبلغ المستلَم</div><div class="val">${amt.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} ﷼</div><div class="words">${amountWords(amt)}</div></div>
  <table>
   <tr><td class="k">استُلم من</td><td class="v">شركة سويتر — Sweater (SSP)</td></tr>
   <tr><td class="k">وذلك سداداً عن</td><td class="v">مستحقات فاتورة خدمات الغسيل — ${periodAr(period)}${h.invoice_ref?` (مرجع الفاتورة: ${h.invoice_ref})`:""}</td></tr>
   <tr><td class="k">طريقة السداد</td><td class="v">${h.payment_method||"تحويل بنكي"}</td></tr>
   <tr><td class="k">تاريخ السداد</td><td class="v">${fmtDate(h.paid_at)}</td></tr>
   ${h.payment_ref?`<tr><td class="k">المرجع البنكي</td><td class="v"><span class="mono">${h.payment_ref}</span></td></tr>`:""}
   <tr><td class="k">المستفيد</td><td class="v">${ORG.name} · ${ORG.bank}</td></tr>
   <tr><td class="k">الآيبان (IBAN)</td><td class="v"><span class="mono">${ORG.iban}</span></td></tr>
   <tr><td class="k">الرقم الوطني الموحّد / س.ت</td><td class="v"><span class="mono">${ORG.cr}</span></td></tr>
  </table>
  <div class="stamp"><span>✔ استُلمت الحوالة بالكامل</span></div>
  <div class="sign"><div><div class="line">المُستلِم — ${ORG.rep}</div></div><div><div class="line">التوقيع والختم</div></div></div>
 </div>
 <div class="foot">${ORG.name} · س.ت ${ORG.cr} · ${ORG.phone} · ${ORG.email}<br>سند إلكتروني صادر من منصة دلو ورغوة التشغيلية — يُثبت استلام المبلغ أعلاه بالكامل</div>
</div>
<div class="bar"><button class="pbtn" onclick="window.print()">طباعة / حفظ PDF · Print</button></div>
</body></html>`;
}

function invoiceHTML(h,period,netOrders,netTotal){
  const org=location&&location.origin?location.origin:"";
  const no=h.invoice_ref||("DW-"+period+"-001");
  let today="";try{today=new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric"});}catch{today="";}
  const closeDay=(()=>{const[y,m]=String(period).split("-");const d=new Date(Number(y),Number(m),0);return String(d.getDate()).padStart(2,"0")+"/"+m+"/"+y;})();
  const fmt=n=>Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>فاتورة ${no}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Tajawal',Tahoma,sans-serif;background:#eef1f5;color:#0f172a;padding:16px;line-height:1.6}
.sheet{max-width:840px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(16,24,40,.12)}
.top{background:linear-gradient(135deg,#E8712B,#c85a1c);color:#fff;padding:22px 30px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
.bz{display:flex;align-items:center;gap:14px}.bz .lg{width:54px;height:54px;border-radius:13px;background:#fff;display:flex;align-items:center;justify-content:center;flex:none;box-shadow:0 6px 16px rgba(0,0,0,.15)}.bz .lg img{width:36px;height:36px;object-fit:contain}
.bz h1{font-size:21px;font-weight:800}.bz span{font-size:11.5px;opacity:.92;font-weight:500}
.doc{text-align:left;direction:ltr}.doc .t{font-size:22px;font-weight:800}.doc .t small{font-size:12px;font-weight:600;display:block;opacity:.9}.doc .n{font-size:12.5px;background:rgba(255,255,255,.22);padding:4px 12px;border-radius:20px;margin-top:7px;display:inline-block;font-weight:700}
.meta{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #eef0f3}.party{padding:18px 30px}.party:first-child{border-inline-end:1px solid #eef0f3}
.party h3{font-size:11px;color:#E8712B;font-weight:800;margin-bottom:8px}.party .nm{font-size:14.5px;font-weight:800;margin-bottom:3px}.party p{font-size:12px;color:#475467;font-weight:600;margin:1px 0}
.fill{background:#fff7ed;color:#9a3412;border:1px dashed #fdba74;border-radius:5px;padding:0 5px;font-size:11px;font-weight:700}
.datebar{display:flex;gap:22px;flex-wrap:wrap;padding:12px 30px;background:#fafbfc;border-bottom:1px solid #eef0f3;font-size:12.5px}.datebar b{font-weight:800}.datebar span{color:#64748b;font-weight:600}
table.items{width:100%;border-collapse:collapse}table.items th{background:#0f172a;color:#fff;font-size:11.5px;font-weight:700;padding:11px 14px;text-align:right}table.items th.c,table.items td.c{text-align:center}
table.items td{padding:12px 14px;border-bottom:1px solid #eef0f3;font-size:13px;font-weight:600}
.totals{display:flex;padding:16px 30px}.totals .box{width:320px;max-width:100%}.totals .row{display:flex;justify-content:space-between;padding:7px 0;font-size:13px;color:#475467;font-weight:700}
.totals .grand{border-top:2px solid #0f172a;margin-top:6px;padding-top:10px;font-size:18px;color:#0f172a;font-weight:800}
.words{padding:0 30px 8px;font-size:12.5px;color:#5b21b6;font-weight:700}
.note{margin:8px 30px 16px;background:#fbfaf7;border:1px dashed #e6ddca;border-radius:10px;padding:10px 13px;font-size:11.5px;color:#7c6f57;font-weight:600;line-height:1.7}
.pay{padding:0 30px 18px}.pay h3{font-size:11px;color:#E8712B;font-weight:800;margin-bottom:6px}.pay p{font-size:12px;color:#475467;font-weight:600}.mono{font-family:'Courier New',monospace;direction:ltr;display:inline-block}
.foot{background:#0f172a;color:#cbd5e1;padding:12px 30px;font-size:11px;text-align:center;line-height:1.7}
.bar{max-width:840px;margin:14px auto 0;text-align:center}.pbtn{background:#E8712B;color:#fff;border:none;padding:12px 26px;border-radius:12px;font-family:inherit;font-size:14px;font-weight:800;cursor:pointer}
@media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0}.bar{display:none}}</style></head><body>
<div class="sheet">
 <div class="top"><div class="bz"><div class="lg"><img src="${org}/brand-mark.png" alt="شعار"/></div><div><h1>${ORG.name}</h1><span>${ORG.en} · ${ORG.partner}</span></div></div>
  <div class="doc"><div class="t">فاتورة<small>Invoice</small></div><div class="n">رقم: ${no}</div></div></div>
 <div class="meta">
  <div class="party"><h3>البائع / المورّد — SELLER</h3><div class="nm">${ORG.name}</div><p>الرقم الوطني الموحّد / س.ت: <span class="mono">${ORG.cr}</span></p><p>الممثل: ${ORG.rep}</p><p>جوال: <span class="mono">${ORG.phone}</span> · ${ORG.email}</p><p>العنوان الوطني: ${ORG.addr}</p></div>
  <div class="party"><h3>المشتري — BUYER</h3><div class="nm">${BUYER.name} <span style="font-weight:600;font-size:11px;color:#64748b">(سويتر)</span></div><p>السجل التجاري: <span class="mono">${BUYER.cr}</span></p><p>الرقم الضريبي (VAT): <span class="mono">${BUYER.vat}</span></p><p>العنوان: ${BUYER.addr}</p><p>معرّف المورّد: Partner ID 47 · SSP Bucket & Foam</p></div>
 </div>
 <div class="datebar"><div><span>تاريخ الفاتورة:</span> <b>${today}</b></div><div><span>فترة الخدمة:</span> <b>${periodAr(period)} (إغلاق ${closeDay})</b></div><div><span>رقم الفاتورة:</span> <b>${no}</b></div></div>
 <table class="items"><thead><tr><th>الوصف — Description</th><th class="c">الكمية</th><th class="c">السعر (﷼)</th><th class="c">الإجمالي (﷼)</th></tr></thead>
  <tbody><tr><td>خدمات غسيل المركبات — ${periodAr(period)} · حجوزات صافية (بعد التعويضية)</td><td class="c">${netOrders}</td><td class="c">20.00</td><td class="c">${fmt(netTotal)}</td></tr></tbody></table>
 <div class="totals"><div class="box"><div class="row"><span>الإجمالي قبل الضريبة</span><span>${fmt(netTotal)} ﷼</span></div><div class="row"><span>ضريبة القيمة المضافة</span><span>غير مطبّقة</span></div><div class="row grand"><span>الإجمالي المستحق</span><span>${fmt(netTotal)} ﷼</span></div></div></div>
 <div class="words">${amountWords(netTotal)}</div>
 <div class="note">• الإكرامية غير مُدرجة في هذه الفاتورة وتُدفع بشكل منفصل مع سداد الفاتورة، وفق تعميم سويتر.<br>• الاحتساب وفق ملحق تسعير عقد الشراكة (20﷼ / حجز) — ${periodAr(period)}.</div>
 <div class="pay"><h3>بيانات السداد — PAYMENT</h3><p>المستفيد: ${ORG.name} · ${ORG.bank}</p><p>الآيبان (IBAN): <span class="mono">${ORG.iban}</span> · الحساب: <span class="mono">${ORG.acct}</span></p></div>
 <div class="foot">${ORG.name} · س.ت ${ORG.cr} · ${ORG.phone} · ${ORG.email}<br>تُرفع هذه الفاتورة عبر بوابة موردي سويتر — invoices.sweater.sa</div>
</div>
<div class="bar"><button class="pbtn" onclick="window.print()">طباعة / حفظ PDF · Print</button></div>
</body></html>`;
}

export default function Settlement({opId,me,owner}){
  const[period,setPeriod]=useState(curMonth());
  const[head,setHead]=useState({invoice_amount:"",invoice_ref:"",notes:"",status:"draft",paid:false,paid_amount:"",paid_at:"",payment_ref:"",payment_method:"",payment_receipt_url:"",receipt_voucher_no:""});
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
      setHead({id:h[0].id,invoice_amount:h[0].invoice_amount??"",invoice_ref:h[0].invoice_ref||"",notes:h[0].notes||"",status:h[0].status||"draft",
        paid:!!h[0].paid,paid_amount:h[0].paid_amount??"",paid_at:h[0].paid_at?String(h[0].paid_at).slice(0,10):"",payment_ref:h[0].payment_ref||"",payment_method:h[0].payment_method||"",payment_receipt_url:h[0].payment_receipt_url||"",receipt_voucher_no:h[0].receipt_voucher_no||""});
      setLines((ls||[]).map(l=>({employee_id:l.employee_id,biker_name:l.biker_name,orders:l.orders??0,rating:l.rating??"",complaints_pct:l.complaints_pct??"",tickets_pct:l.tickets_pct??""})));
    }else{setHead({invoice_amount:"",invoice_ref:"",notes:"",status:"draft",paid:false,paid_amount:"",paid_at:"",payment_ref:"",payment_method:"",payment_receipt_url:"",receipt_voucher_no:""});setLines([]);}
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

  const savePayment=async(markPaid)=>{
    if(!head.id){note(false,"احفظ التسوية أولاً قبل تسجيل السداد");return;}
    setBusy(true);note(false,"");
    try{
      const vno=head.receipt_voucher_no||("DW-RV-"+period+"-01");
      const patch={paid:markPaid,
        paid_amount:head.paid_amount===""?null:Number(head.paid_amount),
        paid_at:head.paid_at||null,payment_ref:head.payment_ref||null,payment_method:head.payment_method||null,
        payment_receipt_url:head.payment_receipt_url||null,receipt_voucher_no:vno,
        paid_recorded_by:me&&me.email?me.email:null,paid_recorded_at:markPaid?new Date().toISOString():null};
      const{error}=await supabase.from("sweater_settlements").update(patch).eq("id",head.id);
      if(error)throw error;
      setHead(h=>({...h,...patch,paid:markPaid,receipt_voucher_no:vno}));
      note(true,markPaid?"تم تسجيل السداد ✓":"تم حفظ بيانات الدفعة");
    }catch(e){note(false,"خطأ: "+(e.message||e));}
    setBusy(false);
  };
  const openVoucher=()=>{
    if(!Number(head.paid_amount)){note(false,"أدخل مبلغ الدفعة أولاً");return;}
    const w=window.open("","_blank");
    const html=voucherHTML({...head,receipt_voucher_no:head.receipt_voucher_no||("DW-RV-"+period+"-01")},period);
    if(!w){note(false,"مانع النوافذ المنبثقة يمنع فتح السند — اسمح به ثم أعد المحاولة");return;}
    try{w.document.open();w.document.write(html);w.document.close();}catch(_){}
  };
  const openInvoice=()=>{
    const netOrders=calc.reduce((a,{l})=>a+Number(l.orders||0),0);
    const netTotal=tot.net||Number(head.invoice_amount||0);
    if(!netTotal){note(false,"لا توجد مبالغ لإصدار الفاتورة — ولّد السطور أو أدخل قيمة الفاتورة");return;}
    const w=window.open("","_blank");
    if(!w){note(false,"مانع النوافذ المنبثقة يمنع فتح الفاتورة — اسمح به ثم أعد المحاولة");return;}
    const html=invoiceHTML(head,period,netOrders,netTotal);
    try{w.document.open();w.document.write(html);w.document.close();}catch(_){}
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
        <button className="se-b purple" disabled={!(tot.net||Number(head.invoice_amount))} onClick={openInvoice}><Icon n="print" s={14}/> إصدار فاتورة</button>
      </div>
      <p className="se-disc">الاحتساب وفق ملحق التسعير (الشرائح) + حافز البند التاسع (+{money(SSP_CONTRACT.incentive)}/طلب عند تقييم ≥{SSP_CONTRACT.incentive_conditions.min_rating} وشكاوى ≤{SSP_CONTRACT.incentive_conditions.max_complaints_pct}%) − خصم تذاكر عند تجاوز {SSP_CONTRACT.incentive_conditions.max_complaints_pct}%. رقم استرشادي يُطابق بالفاتورة الرسمية.</p>
    </div>

    <div className="se-pay">
      <div className="se-pay-h">
        <div className="se-pay-t"><Icon n="cash" s={17}/> صندوق الدفعة وسند الاستلام</div>
        {head.paid?<span className="se-paid"><Icon n="check" s={12}/> مُسدَّدة</span>:<span className="se-unpaid">بانتظار السداد</span>}
      </div>
      <div className="se-pay-g">
        <label><span>المبلغ المستلَم (﷼)</span><input type="number" step="0.01" value={head.paid_amount} onChange={e=>setHead({...head,paid_amount:e.target.value})} placeholder="0.00"/></label>
        <label><span>تاريخ السداد</span><input type="date" value={head.paid_at} onChange={e=>setHead({...head,paid_at:e.target.value})}/></label>
        <label><span>طريقة السداد</span><input value={head.payment_method} onChange={e=>setHead({...head,payment_method:e.target.value})} placeholder="تحويل بنكي — الراجحي"/></label>
        <label><span>المرجع البنكي</span><input value={head.payment_ref} onChange={e=>setHead({...head,payment_ref:e.target.value})} placeholder="Payment Reference"/></label>
        <label className="se-pay-wide"><span>رابط الإيصال البنكي (اختياري)</span><input value={head.payment_receipt_url} onChange={e=>setHead({...head,payment_receipt_url:e.target.value})} placeholder="https://…"/></label>
        <label><span>رقم السند</span><input value={head.receipt_voucher_no} onChange={e=>setHead({...head,receipt_voucher_no:e.target.value})} placeholder={"DW-RV-"+period+"-01"}/></label>
      </div>
      {Number(head.paid_amount)>0&&<div className="se-pay-var" style={{background:Math.abs(Number(head.paid_amount)-tot.net)<=1?"#e7f7ef":"#fff7ed"}}>
        <span>الفرق (المستلَم − الصافي المحتسب)</span>
        <b style={{color:Math.abs(Number(head.paid_amount)-tot.net)<=1?"#087443":"#c2410c"}}>{money(Number(head.paid_amount)-tot.net)}</b>
        <em>الفرق البسيط عادةً بقشيش تمريري يُصرف للبايكرز</em>
      </div>}
      <div className="se-pay-acts">
        <button className="se-b brand" disabled={busy||!owner} onClick={()=>savePayment(head.paid)}><Icon n="save" s={14}/> حفظ بيانات الدفعة</button>
        <button className="se-b green" disabled={busy||!owner||!Number(head.paid_amount)} onClick={()=>savePayment(true)}><Icon n="check" s={14}/> تسجيل السداد</button>
        <button className="se-b purple" disabled={!Number(head.paid_amount)} onClick={openVoucher}><Icon n="print" s={14}/> إصدار سند الاستلام</button>
        {head.payment_receipt_url&&<a className="se-b ghost" href={head.payment_receipt_url} target="_blank" rel="noreferrer"><Icon n="link" s={14}/> الإيصال البنكي</a>}
      </div>
      {!owner&&<p className="se-disc">تسجيل السداد وإصدار السند مقصور على المالك.</p>}
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
.se-b.purple{background:#6941c6;color:#fff;border-color:#6941c6}
.se-b.ghost{background:#fff;color:#475467;text-decoration:none}
.se-pay{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 18px;box-shadow:0 1px 2px rgba(16,24,40,.05);margin-top:14px}
.se-pay-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
.se-pay-t{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800}
.se-paid{display:inline-flex;align-items:center;gap:4px;background:#e7f7ef;color:#087443;font-size:11px;font-weight:800;padding:3px 11px;border-radius:20px}
.se-unpaid{background:#fff4ed;color:#c2410c;font-size:11px;font-weight:800;padding:3px 11px;border-radius:20px}
.se-pay-g{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.se-pay-g label{display:flex;flex-direction:column;gap:5px}
.se-pay-g .se-pay-wide{grid-column:1/-1}
.se-pay-g span{font-size:11.5px;color:var(--mut);font-weight:700}
.se-pay-g input{border:1px solid #dfe3e8;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:13.5px;font-weight:700;outline:none}
.se-pay-g input:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(232,113,43,.1)}
.se-pay-var{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-radius:11px;padding:9px 13px;margin-top:12px}
.se-pay-var span{font-size:11.5px;color:var(--mut);font-weight:700}
.se-pay-var b{font-size:16px;font-weight:800}
.se-pay-var em{font-size:10.5px;color:#94a3b8;font-style:normal;font-weight:600;margin-inline-start:auto}
.se-pay-acts{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}
@media(max-width:820px){.se-kpis{grid-template-columns:1fr 1fr}.se-rec-g{grid-template-columns:1fr}.se-pay-g{grid-template-columns:1fr}}
`;
