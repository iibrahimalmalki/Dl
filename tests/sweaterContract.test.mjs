// نموذج العقد: الشريحة من الإجمالي (Total) والدفع على الصافي (Net)، والحد الأدنى غير مؤكَّد (src/sweaterContract.js)
// المرجع: تأكيد سويتر 07/10/2026 + فاتورة سبتمبر DW-2026-09-001 = 10,131.66
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.sc-test-'));
try{
execSync(`npx esbuild src/sweaterContract.js --bundle --format=esm --platform=node --outfile=${tmp}/c.mjs --log-level=error`,{stdio:'inherit'});
execSync(`npx esbuild src/monthRecon.js --bundle --format=esm --platform=node --outfile=${tmp}/m.mjs --log-level=error`,{stdio:'inherit'});
const C=await import(`${tmp}/c.mjs`);const M=await import(`${tmp}/m.mjs`);
const P='2026-09';

// الشريحة من الإجمالي
const rk=C.payoutForBiker(214,P,231);
ok('Rakib سبتمبر: إجمالي 231 ⇒ الشريحة 2، صافي 214 × 19.57 = 4,187.98',rk.tier===2&&rk.unit===19.57&&rk.total===4187.98&&rk.billableOrders===214);
const ar=C.payoutForBiker(224,P,227);
ok('Ariful سبتمبر: إجمالي 227 ⇒ الشريحة 2، صافي 224 × 19.57 = 4,383.68',ar.tier===2&&ar.total===4383.68);
const md=C.payoutForBiker(78,P,78);
ok('Midul سبتمبر: 78 × 20 = 1,560 (بلا حد أدنى)',md.unit===20&&md.total===1560&&md.billableOrders===78);
ok('فاتورة سبتمبر = 10,131.66',Math.round((rk.total+ar.total+md.total)*100)/100===10131.66);
ok('الصافي وحده (214) كان سيعطي الشريحة 1 — الإجمالي يغيّرها',C.payoutForBiker(214,P).tier!==2&&C.payoutForBiker(214,P).unit===20);
ok('بلا إجمالي ⇒ الإجمالي = الصافي',C.payoutForBiker(230,P).totalWashes===230&&C.payoutForBiker(230,P).tier===2);
ok('حدود الشرائح على الإجمالي: 223 ⇒ 20، 224 ⇒ 19.57، 238 ⇒ 19.13',C.payoutForBiker(200,P,223).unit===20&&C.payoutForBiker(200,P,224).unit===19.57&&C.payoutForBiker(200,P,238).unit===19.13);

// الحد الأدنى غير مؤكَّد
ok('الحد الأدنى غير مؤكَّد (ثابت false)',C.MIN_GUARANTEE_CONFIRMED===false);
ok('Midul 78: لا يُضاف للمستحق، ويُعرض الفارق 118 للعلم (2,360)',md.minGap===118&&md.minGapAmount===2360&&md.minConfirmed===false&&md.total===1560);
ok('فوق 196 ⇒ لا فارق',C.payoutForBiker(200,P,200).minGap===0);
ok('قبل أغسطس 2026: 20 ثابت ولا فارق حد أدنى',(()=>{const j=C.payoutForBiker(150,'2026-07',300);return j.unit===20&&j.total===3000&&j.minGap===0&&j.flat;})());

// سطر التسوية يمرّر الإجمالي
const line=C.settlementLine({orders:214,total:231,rating:4.6,complaintsPct:0,ticketsPct:0,period:P});
ok('settlementLine: الإجمالي 231 ⇒ 19.57 والأساس 4,187.98 بلا حافز (تقييم 4.6)',line.unit===19.57&&line.base===4187.98&&line.incentive===0&&line.totalWashes===231);
const l2=C.settlementLine({orders:78,total:78,rating:4.8,complaintsPct:0,ticketsPct:0,period:P});
ok('settlementLine: الحافز على الصافي (78) لا على 196',l2.incentive===78&&l2.minGap===118);

// المطابقة الشهرية بأرقام عمليات سبتمبر
const adj=(k,s,n)=>Array.from({length:n},()=>({kind:k,sweater_id:s}));
const fw=(s,n)=>Array.from({length:n},()=>({sweater_id:s,compensation:'Free Wash'}));
const res=M.reconcileMonth({period:P,violations:[],tickets:[...fw('1624',2),...fw('1700',6)],
  bikers:[{sweater_id:'1624',biker_name:'Ariful Islam',net_washes:223},{sweater_id:'1648',biker_name:'Midul Hassan',net_washes:77},{sweater_id:'1700',biker_name:'Mohamad Rakib',net_washes:221}],
  adjustments:[...adj('add','1624',4),...adj('maintenance','1624',1),...adj('add','1648',1),...adj('add','1700',10),...adj('deduct','1700',7),...adj('maintenance','1700',4)],
  sweater:{'1624':{net:224,unit:19.57,payable:4383.68},'1648':{net:78,unit:20,payable:1560},'1700':{net:214,unit:19.57,payable:4187.98}}});
const R=id=>res.rows.find(r=>r.sweater_id===id);
ok('سبتمبر: الإجمالي 227 / 78 / 231 = 536',R('1624').totalWashes===227&&R('1648').totalWashes===78&&R('1700').totalWashes===231&&res.totals.totalWashes===536);
ok('سبتمبر: بعد الغسلات المجانية (2 + 6) الصافي 224 / 78 / 214 = 516 كسويتر',R('1624').netCalc===224&&R('1648').netCalc===78&&R('1700').netCalc===214&&res.totals.netCalc===516);
ok('سبتمبر: سعر Rakib المتوقع 19.57 (من الإجمالي 231) = سعر سويتر ⇒ لا تنبيه سعر',R('1700').unitExp===19.57&&R('1700').dUnit===0&&!M.alertsOf(res,P).some(a=>a.kind==='unit'));
ok('سبتمبر: مطابق تماماً (dNet=0، المستحق 10,131.66)',res.status==='matched'&&res.totals.dNet===0&&res.totals.exVat===10131.66);
const noFw=M.reconcileMonth({period:P,violations:[],tickets:[],bikers:res.rows.map(r=>({sweater_id:r.sweater_id,biker_name:r.biker_name,net_washes:r.online})),
  adjustments:[...adj('add','1624',4),...adj('maintenance','1624',1),...adj('add','1648',1),...adj('add','1700',10),...adj('deduct','1700',7),...adj('maintenance','1700',4)],sweater:{}});
ok('بدون الغسلات المجانية الصافي 524 ⇒ فرق الـ 8 غسلات = تعويضات Free Wash',noFw.totals.netCalc===524);
const mins=M.alertsOf(res,P).filter(a=>a.kind==='min_guarantee');
ok('تنبيه الحد الأدنى لـ Midul سؤال «غير مؤكَّد»',mins.length===1&&mins[0].sweater_id==='1648'&&mins[0].unconfirmed===true&&/غير مؤكَّد/.test(mins[0].ar));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
