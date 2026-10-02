// اختبار قراءة كشف سويتر (src/sspBreakdown.js) — أسطر كشف أغسطس 2026 الفعلي كـ fixture
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.bd-test-'));
try{
execSync(`npx esbuild src/sspBreakdown.js --bundle --format=esm --platform=node --outfile=${tmp}/b.mjs --log-level=error`,{stdio:'inherit'});
execSync(`npx esbuild src/monthRecon.js --bundle --format=esm --platform=node --outfile=${tmp}/m.mjs --log-level=error`,{stdio:'inherit'});
const{parseBreakdown,fillFromBreakdown,periodOfFile}=await import(`${tmp}/b.mjs`);
const{reconcileMonth}=await import(`${tmp}/m.mjs`);

const HEAD=['SSP Bucket — foam · Partner ID 47','Report #: RPT-BUCKET-20260908','Period: Aug 2026',
  'Online Washes 546 (100%)','Washes to Add + 16','Guarantee Shortfall Washes to Add +3','Compensations (Free Wash) −7',
  'Washes to Deduct −4','Maintenance Washes −6','Net Washes Count (Total Biker Washes − Total Deducted Washes) 548',
  'Total Violations 7 / 390.00 SAR','Total Damages 0 / 0.00 SAR','Other Compensations (amount) 15.00 SAR','Total Amount Deductions 405.00 SAR',
  '# Biker ID Tier Unit Days Online Offline Net Avg Viol. Deduct. Payable'];
const TAIL=['Totals — 3 bikers 79 546 0 548 6.94 7 405.00 10,358.38','Gross 10,763.38 − Deductions 405.00','Includes VAT 1,614.62 SAR'];
// نسخة 1: الاسم على سطر واحد
const one=[...HEAD,'Mohamad Rakib (1700)','1 1700 3 19.13 29 226 0 226 7.79 - 15.00 4,308.38',
  '2 Ariful Islam (1624) 1624 1 20.00 28 186 0 188 6.71 4 210.00 3,550.00','Midul Hassan (1648)','3 1648 1 20.00 22 134 0 134 6.09 3 180.00 2,500.00',...TAIL];
// نسخة 2: الاسم مقسوم على سطرين (فوق/تحت الصف)
const two=[...HEAD,'Mohamad','1 1700 3 19.13 29 226 0 226 7.79 - 15.00 4,308.38','Rakib (1700)',
  '2 Ariful Islam (1624) 1624 1 20.00 28 186 0 188 6.71 4 210.00 3,550.00','Midul Hassan','3 1648 1 20.00 22 134 0 134 6.09 3 180.00 2,500.00','(1648)',...TAIL];

for(const [label,lines] of [['اسم على سطر',one],['اسم على سطرين',two]]){
  const b=parseBreakdown(lines);const B=id=>b.bikers.find(x=>x.sweater_id===id);
  ok(`${label}: الفترة ورقم التقرير`,b.period==='2026-08'&&b.reportNo==='RPT-BUCKET-20260908');
  const K=B('1700'),A=B('1624'),M=B('1648');
  ok(`${label}: 1700 ⇒ شريحة 3، 19.13، صافي 226، خصم 15، مستحق 4,308.38`,K&&K.tier===3&&K.unit===19.13&&K.net===226&&K.violCount===0&&K.deduct===15&&K.payable===4308.38&&K.days===29&&K.online===226);
  ok(`${label}: 1624 ⇒ 1، 20.00، 188، مخالفات 4، 210، 3,550`,A&&A.tier===1&&A.unit===20&&A.net===188&&A.violCount===4&&A.deduct===210&&A.payable===3550);
  ok(`${label}: 1648 ⇒ 1، 20.00، 134، 3، 180، 2,500`,M&&M.tier===1&&M.unit===20&&M.net===134&&M.violCount===3&&M.deduct===180&&M.payable===2500);
  ok(`${label}: الأسماء`,K.name==='Mohamad Rakib'&&A.name==='Ariful Islam'&&M.name==='Midul Hassan');
  const t=b.totals;
  ok(`${label}: الإجماليات`,t.online===546&&t.add===16&&t.guarantee===3&&t.freeWash===7&&t.deduct===4&&t.maintenance===6&&t.net===548&&t.violations===390&&t.damages===0&&t.otherComp===15&&t.deductions===405&&t.gross===10763.38&&t.exVat===10358.38&&t.vat===1614.62&&t.incVat===11973);
  ok(`${label}: بلا تحذيرات`,b.warnings.length===0);
}

// ── التعبئة + المطابقة ببيانات أغسطس ⇒ matched ──
const b=parseBreakdown(one);
const calc={'1624':188,'1648':131,'1700':226};
const f=fillFromBreakdown(b,calc);
ok('التعبئة: ضمان Midul = 3 والبقية 0',f.sweater['1648'].guarantee==='3'&&f.sweater['1624'].guarantee==='0'&&f.sweater['1700'].guarantee==='0');
ok('التعبئة: مخالفات Ariful 210 و Midul 180، وتعويضات Rakib 15',f.sweater['1624'].violations==='210'&&f.sweater['1648'].violations==='180'&&f.sweater['1700'].otherComp==='15'&&f.sweater['1700'].violations==='0');
ok('التعبئة: الصافي والسعر والمستحق من الصف + الحقول المعلَّمة',f.sweater['1700'].net==='226'&&f.sweater['1700'].unit==='19.13'&&f.sweater['1700'].payable==='4308.38'&&f.filled['1648'].includes('guarantee')&&f.filled['1700'].includes('payable'));
ok('التعبئة: الفاتورة = رقم التقرير ومبلغ قبل الضريبة، بلا تحذيرات',f.invoice.ref==='RPT-BUCKET-20260908'&&f.invoice.amount===10358.38&&f.warnings.length===0);
const bikers=[{sweater_id:'1624',biker_name:'Ariful Islam',net_washes:186},{sweater_id:'1648',biker_name:'Midul Hassan',net_washes:134},{sweater_id:'1700',biker_name:'Mohamad Rakib',net_washes:226}];
const A2=(k,s,n)=>Array.from({length:n},()=>({kind:k,sweater_id:s}));
const adjustments=[...A2('add','1624',7),...A2('maintenance','1624',2),...A2('add','1648',1),...A2('deduct','1648',2),...A2('add','1700',8),...A2('deduct','1700',2),...A2('maintenance','1700',4)];
const F2=(s,n)=>Array.from({length:n},()=>({sweater_id:s,compensation:'Free Wash'}));
const tickets=[...F2('1624',3),...F2('1648',2),...F2('1700',2),{sweater_id:'1700',compensation:'15'}];
const rm=reconcileMonth({bikers,adjustments,tickets,violations:[],sweater:f.sweater,period:'2026-08'});
ok('التعبئة + reconcileMonth ⇒ matched (548 · 10,358.38 · 11,973.00)',rm.status==='matched'&&rm.totals.netBill===548&&rm.totals.exVat===10358.38&&rm.totals.incVat===11973);

// ── حالات ──
ok('ناقص U+2212 وشرطة عادية سواء',parseBreakdown(one.map(l=>l.replace(/−/g,'-'))).totals.freeWash===7&&parseBreakdown(one).totals.deduct===4);
const noMaint=parseBreakdown(one.filter(l=>!/^Maintenance/.test(l)));
ok('سطر ناقص ⇒ null + تحذير',noMaint.totals.maintenance===null&&noMaint.warnings.some(w=>w.code==='missing'&&/Maintenance/.test(w.ar)));
const badSum=parseBreakdown(one.map(l=>l.startsWith('3 1648')?'3 1648 1 20.00 22 134 0 135 6.09 3 180.00 2,520.00':l));
ok('مجموع لا يطابق ⇒ تحذير (الصافي والمستحق)',badSum.warnings.some(w=>w.code==='sum_net')&&badSum.warnings.some(w=>w.code==='sum_pay'));
ok('شهر مكتوب «August 2026»',parseBreakdown(one.map(l=>l.startsWith('Period')?'Period: August 2026':l)).period==='2026-08');
ok('شامل الضريبة يُقرأ من «TOTAL PAYABLE — INCLUDING VAT» إن وُجد',parseBreakdown([...one,'TOTAL PAYABLE — INCLUDING VAT 11,973.10 SAR']).totals.incVat===11973.1);
ok('ضمان لا يطابق المجموع ⇒ يُترك فارغاً مع تنبيه',(()=>{const x=fillFromBreakdown(b,{'1624':188,'1648':130,'1700':226});return x.sweater['1648'].guarantee===undefined&&x.warnings.some(w=>w.code==='guarantee');})());
ok('توزيع خصومات لا يطابق ⇒ «راجع توزيع الخصومات»',(()=>{const bb=parseBreakdown(one.map(l=>l.startsWith('Other Compensations')?'Other Compensations (amount) 20.00 SAR':l));return fillFromBreakdown(bb,calc).warnings.some(w=>w.code==='split');})());
ok('بلا صفوف بايكرز ⇒ تحذير لا خطأ',(()=>{const x=parseBreakdown(HEAD);return x.bikers.length===0&&x.warnings.some(w=>w.code==='no_bikers');})());
ok('شهر الملف من اسمه',periodOfFile('SSP_Bucket__foam__ID47__August_2026_Breakdown.pdf')==='2026-08');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
