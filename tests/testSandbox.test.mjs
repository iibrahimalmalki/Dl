// «بيئة الاختبار الدائمة» — المنطق النقي (src/testSandbox.js): الاستبعاد من المجاميع، والتأخير، والتعليم
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.ts-test-'));
try{
execSync(`npx esbuild src/testSandbox.js src/fleetRequests.js --bundle --format=esm --platform=node --outdir=${tmp} --out-extension:.js=.mjs --log-level=error`,{stdio:'inherit'});
const T=await import(`${tmp}/testSandbox.mjs`),F=await import(`${tmp}/fleetRequests.mjs`);

const V=[{id:'t',plate:'TEST-0000',is_test:true,status:'active',has_gps:false},{id:'a',plate:'A',status:'active',has_gps:true},{id:'b',plate:'B',status:'stolen',has_gps:true}];
ok('realOnly: الدراجة التجريبية خارج العدّ (2 لا 3)، ونسبة GPS على الحقيقية 100%',T.realOnly(V).length===2&&T.realOnly(V).filter(v=>v.has_gps).length/T.realOnly(V).length===1);
ok('realOnly يتحمّل null وصفوفاً بلا is_test',T.realOnly(null).length===0&&T.realOnly([{id:1}]).length===1);
ok('testLast: التجريبي آخراً، والترتيب الأصلي محفوظ',T.testLast(V).map(v=>v.id).join()==='a,b,t');
const ids=T.testIds(V);
ok('testIds: معرّفات التجريبي فقط',ids.size===1&&ids.has('t'));

// التنبيهات لكل دراجة: التجريبية تظهر بعلامة test وآخر القائمة حتى لو كانت الأكثر تحذيرات، والعدّاد بلا التجريبية
const al=[{vehicle_id:'t',plate:'TEST-0000',severity:'warn',kind:'oil_due',at:'2026-10-11'},{vehicle_id:'t',plate:'TEST-0000',severity:'warn',kind:'odometer_jump',at:'2026-10-11'},
  {vehicle_id:'a',plate:'A',severity:'info',kind:'close_fills',at:'2026-10-10'}];
const G=T.markTest(F.alertsByVehicle(al),ids);
ok('التنبيهات: الدراجة التجريبية تظهر (بعلامة test) وآخر القائمة رغم أنها الأكثر تحذيرات',G.length===2&&G[0].plate==='A'&&!G[0].test&&G[1].test===true);
ok('عدّاد التحذيرات بلا التجريبية: 0 لا 2',T.realBy(al,ids).filter(a=>a.severity==='warn').length===0);

// تكلفة الكيلو: صف التجريبية يظهر بعلامة test وآخراً، ولا يدخل أي مجموع
const reqs=[{vehicle_id:'t',plate:'TEST-0000',amount:50,odometer:100,requested_at:'2026-10-01T08:00:00Z',transferred_at:'2026-10-01T09:00:00Z'},
  {vehicle_id:'t',plate:'TEST-0000',amount:50,odometer:300,requested_at:'2026-10-05T08:00:00Z',transferred_at:'2026-10-05T09:00:00Z'},
  {vehicle_id:'a',plate:'A',amount:50,odometer:1000,requested_at:'2026-10-02T08:00:00Z',transferred_at:'2026-10-02T09:00:00Z'},
  {vehicle_id:'a',plate:'A',amount:50,odometer:1500,requested_at:'2026-10-06T08:00:00Z',transferred_at:'2026-10-06T09:00:00Z'}];
const C=T.markTest(F.monthlyCostPerKm('2026-10',reqs,[]),ids);
ok('تكلفة الكيلو: صف التجريبية آخراً وبعلامة test',C.length===2&&C[0].plate==='A'&&C[1].test===true);
ok('مجموع التحويلات الحقيقية 100﷼ لا 200﷼',T.realBy(C,ids).reduce((s,r)=>s+r.amount,0)===100);

// طلبات الوقود: العدّاد يستبعد التجريبي، والقائمة تعرضه
const R=F.splitRequests([{id:1,vehicle_id:'t',status:'requested',requested_at:'2026-10-01'},{id:2,vehicle_id:'a',status:'requested',requested_at:'2026-10-02'}]);
ok('طلبات بانتظار التحويل: القائمة 2، والعدّاد 1',R.pending.length===2&&T.realBy(R.pending,ids).length===1);
ok('markTest لا يغيّر الصفوف الأصلية',!('test' in reqs[0]));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
