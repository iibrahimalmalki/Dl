// اختبار مطابقة الإقفال الشهري مع كشف سويتر (src/monthRecon.js) — قبول أغسطس 2026 بأرقام الكشف الفعلي
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.mr-test-'));
try{
execSync(`npx esbuild src/monthRecon.js --bundle --format=esm --platform=node --outfile=${tmp}/m.mjs --log-level=error`,{stdio:'inherit'});
const{reconcileMonth,claimFrom,tierOfUnit}=await import(`${tmp}/m.mjs`);

// ── بيانات أغسطس 2026 ──
const bikers=[{sweater_id:'1624',biker_name:'Ariful Islam',net_washes:186},{sweater_id:'1648',biker_name:'Midul Hassan',net_washes:134},{sweater_id:'1700',biker_name:'Mohamad Rakib',net_washes:226}];
const adj=(kind,sid,n)=>Array.from({length:n},()=>({kind,sweater_id:sid}));
const adjustments=[...adj('add','1624',7),...adj('maintenance','1624',2),
  ...adj('add','1648',1),...adj('deduct','1648',2),
  ...adj('add','1700',8),...adj('deduct','1700',2),...adj('maintenance','1700',4)];
const fw=(sid,n)=>Array.from({length:n},()=>({sweater_id:sid,compensation:'Free Wash'}));
const tickets=[...fw('1624',3),...fw('1648',2),...fw('1700',2),{sweater_id:'1700',compensation:'15'},{sweater_id:'1700',compensation:null}];
const violations=[{sweater_id:'1624',amount:210},{sweater_id:'1648',amount:180}];
const sweater={
  '1624':{guarantee:'',net:188,unit:20,violations:210,damages:0,otherComp:0,payable:3550},
  '1648':{guarantee:3,net:134,unit:20,violations:180,damages:0,otherComp:0,payable:2500},
  '1700':{guarantee:0,net:226,unit:19.13,violations:0,damages:0,otherComp:15,payable:4308.38},
};
const base={bikers,adjustments,tickets,violations,period:'2026-08'};
const m=reconcileMonth({...base,sweater});
const R=id=>m.rows.find(r=>r.sweater_id===id);
const A=R('1624'),M=R('1648'),K=R('1700');

ok('المحسوب لكل بايكر (188 / 131 / 226)',A.netCalc===188&&M.netCalc===131&&K.netCalc===226);
ok('مكوّنات Ariful: 186 +7 −0 −2 −3',A.online===186&&A.add===7&&A.deduct===0&&A.maintenance===2&&A.freeWash===3);
ok('مكوّنات Midul: 134 +1 −2 −0 −2',M.online===134&&M.add===1&&M.deduct===2&&M.maintenance===0&&M.freeWash===2);
ok('مكوّنات Rakib: 226 +8 −2 −4 −2',K.online===226&&K.add===8&&K.deduct===2&&K.maintenance===4&&K.freeWash===2);
ok('الضمان يُضاف: الصافي 188 / 134 / 226',A.netBill===188&&M.netBill===134&&K.netBill===226);
ok('الإجمالي 3,760 / 2,680 / 4,323.38',A.gross===3760&&M.gross===2680&&K.gross===4323.38);
ok('المستحق 3,550 / 2,500 / 4,308.38',A.payableCalc===3550&&M.payableCalc===2500&&K.payableCalc===4308.38);
ok('الإجماليات: 546 · 16 · 4 · 6 · 7 · 545 · 3 · 548',m.totals.online===546&&m.totals.add===16&&m.totals.deduct===4&&m.totals.maintenance===6&&m.totals.freeWash===7&&m.totals.netCalc===545&&m.totals.guarantee===3&&m.totals.netBill===548);
ok('الإجمالي 10,763.38 · الخصومات 405 · غير شامل 10,358.38',m.totals.gross===10763.38&&m.totals.deductions===405&&m.totals.exVat===10358.38);
ok('شامل الضريبة 11,973.00 (188×23 + 134×23 + 226×22 − 405)',m.totals.incVat===11973);
ok('كل dNet=0 و dPay=0 ⇒ matched',m.rows.every(r=>r.dNet===0&&r.dPay===0)&&m.status==='matched');
ok('dUnit لـ Rakib = −0.44 (19.13 الشريحة 3 مقابل 19.57 الشريحة 2) وأثره 99.44',K.dUnit===-0.44&&K.unitExp===19.57&&K.tierExp===2&&K.tierSweater===3&&K.unitImpact===99.44&&tierOfUnit(19.13)===3);
ok('تعويض Rakib المحسوب من التذاكر = 15 (Free Wash ليس مبلغاً)',K.otherCompCalc===15&&K.dComp===0);
ok('تنبيه الحد الأدنى 196 من أغسطس: Ariful فارق 8 = 160 ﷼، Rakib بلا تنبيه',A.belowMin&&A.minGap===8&&A.minGapAmount===160&&M.belowMin&&M.minGap===62&&!K.belowMin);

// ── حالات إضافية ──
ok('بلا إدخال ⇒ pending (ومستحق محسوب من مخالفات المنصة)',(()=>{const p=reconcileMonth({...base,sweater:{}});return p.status==='pending'&&p.rows.every(r=>r.dNet===null&&r.dPay===null)&&p.rows.find(r=>r.sweater_id==='1624').payableCalc===3760-210;})());
ok('إدخال ناقص لبايكر واحد ⇒ pending',reconcileMonth({...base,sweater:{...sweater,'1700':{net:226}}}).status==='pending');
const d1=reconcileMonth({...base,sweater:{...sweater,'1624':{...sweater['1624'],net:187,payable:3530}}});
const d1A=d1.rows.find(r=>r.sweater_id==='1624');
ok('فرق غسلة واحدة ⇒ diff و dNet=−1 و dPay=−20',d1.status==='diff'&&d1A.dNet===-1&&d1A.dPay===-20);
ok('المطالبة = مجموع الفروق السالبة علينا (20 ﷼ · غسلة واحدة)',(()=>{const c=claimFrom(d1);return c.amount===20&&c.orders===1&&c.bikers.join()==='1624';})());
const extra=reconcileMonth({...base,sweater:{...sweater,'9999':{biker_name:'New Guy',net:10,unit:20,payable:200}}});
const X=extra.rows.find(r=>r.sweater_id==='9999');
ok('بايكر في كشف سويتر فقط: سطر بفرق كامل ولا يُسقط',X&&!X.inPlatform&&X.inSweater&&X.netBill===0&&X.dNet===10&&X.dPay===200&&X.biker_name==='New Guy'&&extra.status==='diff');
const missing=reconcileMonth({...base,sweater:{...sweater,'1700':{net:0,payable:0}}});
ok('بايكر في المنصة وصفر في الكشف: فرق كامل',missing.rows.find(r=>r.sweater_id==='1700').dNet===-226&&missing.status==='diff');
ok('guarantee فارغ = 0',A.guarantee===0&&reconcileMonth({...base,sweater:{'1624':{guarantee:null}}}).rows.find(r=>r.sweater_id==='1624').guarantee===0);
const jul=reconcileMonth({...base,period:'2026-07',sweater:{}});
ok('قبل 2026-08: سعر 20 ثابت بلا تنبيه حد أدنى',jul.rows.every(r=>r.unitExp===20&&r.unit===20&&!r.belowMin)&&jul.rows.find(r=>r.sweater_id==='1700').gross===4520);
const vd=reconcileMonth({...base,sweater:{...sweater,'1624':{...sweater['1624'],violations:300,payable:3460}}});
ok('مخالفات سويتر ≠ مخالفات المنصة ⇒ dViol',vd.rows.find(r=>r.sweater_id==='1624').dViol===90&&vd.rows.find(r=>r.sweater_id==='1648').dViol===0&&vd.status==='matched');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
