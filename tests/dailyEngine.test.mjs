// اختبار منطق الاستلام اليومي (src/daily/engine.js)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.dr-test-'));
try{
execSync(`npx esbuild src/daily/engine.js --bundle --format=esm --platform=node --outfile=${tmp}/e.mjs --log-level=error`,{stdio:'inherit'});
const E=await import(`${tmp}/e.mjs`);
const sum=o=>Object.values(o).reduce((a,v)=>a+v,0);

// ── splitEven ──
const s1=E.splitEven(10,['a','b','r'],'r');
ok('splitEven(10, 3 بايكرز) ⇒ 4/3/3 والزائد للمستلم',s1.r===4&&s1.a===3&&s1.b===3&&sum(s1)===10);
const s2=E.splitEven(2,['a','b','c','r'],'r');
ok('splitEven(2, 4) ⇒ المجموع 2 ولا قيم سالبة',sum(s2)===2&&Object.values(s2).every(v=>v>=0)&&Object.keys(s2).length===4);
const s3=E.splitEven(0,['a','b','r'],'r');
ok('splitEven(0) ⇒ أصفار',Object.values(s3).every(v=>v===0)&&Object.keys(s3).length===3);
ok('المستلم يُضاف إن لم يكن في القائمة',E.splitEven(5,['a','b'],'r').r===3&&sum(E.splitEven(5,['a','b'],'r'))===5);
const team=[{id:'a'},{id:'b',in_daily_split:false},{id:'c',in_daily_split:true}];
const L1=E.splitList(team,'a',true);
ok('قائمة التوزيع تستبعد غير المشمولين',L1.ids.join()==='a,c'&&L1.receiver==='a');
const L2=E.splitList([{id:'a'},{id:'c'}],'t',false), q2=E.splitEven(7,L2.ids,L2.receiver);
ok('المستلم المتدرب المرافق خارج القسمة ونصيبه صفر والمجموع محفوظ',!L2.ids.includes('t')&&L2.receiver===null&&!('t' in q2)&&sum(q2)===7);
ok('المستلم المشمول غير الموجود في القائمة يُضاف',E.splitList([{id:'c'}],'a',true).ids.join()==='a,c');
ok('شرط الاعتماد: المجموع يساوي الكمية',E.splitErrors({mat:10},{mat:s1}).length===0&&E.splitErrors({mat:10},{mat:{...s1,a:2}}).join()==='mat'&&E.splitErrors({mat:3},{mat:{a:4,b:-1}}).join()==='mat');

// ── normPhone ──
const P=['+966 5 1234 5678','966512345678','512345678','0512345678','00966512345678','٠٥١٢٣٤٥٦٧٨'];
ok('normPhone: كل الصيغ ⇒ 0512345678',P.every(p=>E.normPhone(p)==='0512345678'));
ok('normPhone: رقم ناقص أو غير جوال ⇒ مرفوض',E.normPhone('05123')===null&&E.normPhone('0112345678')===null&&E.normPhone('')===null&&E.normPhone('05123456789')===null);

// ── isLate (الرياض UTC+3) ──
const at=hm=>`2026-10-03T${hm}:00+03:00`;
ok('isLate: 23:30 و03:00 و07:59 ⇒ متأخر',['23:30','03:00','07:59'].every(t=>E.isLate(at(t))));
ok('isLate: 08:00 و14:00 و22:59 ⇒ لا',['08:00','14:00','22:59'].every(t=>!E.isLate(at(t))));

// ── الرصيد ──
const sh=[
  {employee_id:'a',item_key:'mat',qty:3,status:'pending',received_by:'r'},
  {employee_id:'b',item_key:'mat',qty:3,status:'short',qty_actual:1,received_by:'r'},
  {employee_id:'r',item_key:'mat',qty:4,status:'confirmed',received_by:'r'},
  {employee_id:'c',item_key:'tissue',qty:2,status:'confirmed',received_by:'r'},
];
const B=E.balances(sh,[{employee_id:'c',item_key:'tissue',delta:-2}]);
ok('النصيب pending يُحسب على المستلم لا على صاحبه',!(B.a&&B.a.mat));
ok('short يُحسب بـ qty_actual والفرق على المستلم',B.b.mat===1&&B.r.mat===4+3+2);
ok('التسويات تُطرح',(B.c.tissue||0)===0);
ok('تسليم لم يُوزَّع بعد ⇒ كامله على المستلم',E.balances([],[],[{received_by:'r',lines:[{item_key:'mat',qty:6}]}]).r.mat===6);

// ── التحقق من النموذج ──
const now=Date.parse('2026-10-03T05:00:00Z');
const good={received_at:'2026-10-03T04:30:00Z',courier_id:'c1',qty:{mat:4},photos:['x']};
ok('نموذج صالح ⇒ بلا أخطاء',E.validateReceive(good,now).length===0);
ok('يُرفض بلا صورة',E.validateReceive({...good,photos:[]},now).length===1);
ok('يُرفض بلا مندوب',E.validateReceive({...good,courier_id:null},now).length===1);
ok('مندوب جديد بجوال صالح يكفي',E.validateReceive({...good,courier_id:null,newCourier:{name:'سعيد',phone:'0551234567'}},now).length===0);
ok('مندوب جديد بجوال ناقص ⇒ مرفوض',E.validateReceive({...good,courier_id:null,newCourier:{name:'سعيد',phone:'0551'}},now).length===1);
ok('يُرفض بكل الكميات صفراً',E.validateReceive({...good,qty:{mat:0,tissue:0}},now).length===1);
ok('يُرفض وقت في المستقبل أو أقدم من 12 ساعة',E.validateReceive({...good,received_at:'2026-10-03T06:00:00Z'},now).length===1&&E.validateReceive({...good,received_at:'2026-10-02T16:00:00Z'},now).length===1);

// ── الملخص الشهري ──
const m=E.monthSummary([{received_at:at('23:30'),towels_returned:5,lines:[{item_key:'mat',qty:4}]},{received_at:at('00:30'),towels_returned:3,lines:[{item_key:'mat',qty:2},{item_key:'tissue',qty:6}]},{received_at:at('10:00'),lines:[]}]);
ok('الملخص: العدد والمتأخر والمجموع لكل صنف',m.count===3&&m.late===2&&m.items.mat===6&&m.items.tissue===6&&m.towelsReturned===8);
ok('متوسط الوقت لا يفسده منتصف الليل (23:30 و00:30 ⇒ 00:00)',E.monthSummary([{received_at:at('23:30')},{received_at:at('00:30')}]).avgTime==='00:00');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
