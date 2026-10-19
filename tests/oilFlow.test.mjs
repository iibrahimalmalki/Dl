// مسار تغيير الزيت — المنطق النقي (src/oilFlow.js): الطلب المفتوح، التوزيع للإدارة، «نفس الدقيقة»، العدّاد، الزيت المبكر، نموذج الإضافة، رموز الأخطاء
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.oil-test-'));
try{
fs.writeFileSync(`${tmp}/entry.js`,`export * from '${path.resolve('src/oilFlow.js')}';export {bikerRpcError,adminRpcError,OIL_STATUS} from '${path.resolve('src/fleetRequests.js')}';`);
execSync(`npx esbuild ${tmp}/entry.js --bundle --format=esm --platform=node --outfile=${tmp}/t.mjs --log-level=error`,{stdio:'inherit'});
const O=await import(`${tmp}/t.mjs`);

const rows=[{id:1,status:'approved',requested_at:'2026-10-01',done_at:'2026-10-01T10:00'},{id:2,status:'cancelled',requested_at:'2026-10-09',cancelled_at:'2026-10-09T12:00'},
  {id:3,status:'sent',requested_at:'2026-10-05'},{id:4,status:'requested',requested_at:'2026-10-07'},{id:5,status:'done',requested_at:'2026-10-03',done_at:'2026-10-04'}];
const b=O.bikerOil(rows);
ok('bikerOil: المفتوح الأحدث (requested أو sent)، وما ينتظر المراجعة، والسجل بلا الملغى',b.open.id===4&&b.review.id===5&&b.list.length===4&&!b.list.some(r=>r.status==='cancelled'));
ok('bikerOil: بلا مفتوح ⇒ null، والملغى وحده ⇒ سجل فارغ',O.bikerOil([{status:'approved',requested_at:'2026-10-01'}]).open===null&&O.bikerOil([{status:'cancelled'}]).list.length===0&&O.bikerOil(null).open===null);
const a=O.splitOilAdmin(rows);
ok('splitOilAdmin: قيد المتابعة (sent القديم معها، الأقدم أولاً)، المراجعة، المعتمدة، الملغاة',a.follow.map(r=>r.id).join()==='3,4'&&a.review[0].id===5&&a.approved[0].id===1&&a.cancelled[0].id===2);

const req={requested_at:'2026-10-17T10:15:20Z',odometer:9100};
ok('«نفس الدقيقة» للقاعدة وحدها (لا فحص بساعة الجوال): لا خطأ وقت في النموذج',O.oilExecFormError({shot:1,odometer:'9100',odoPhoto:1},req)===null&&O.sameMinute===undefined);
ok('تحديث التنفيذ: لقطة سويتر أولاً، ثم العدّاد، ثم أقل من عدّاد الطلب، ثم صورة العدّاد',O.oilExecFormError({odometer:'9200',odoPhoto:1},req).field==='execShot'
  &&O.oilExecFormError({shot:1,odoPhoto:1},req).field==='odometer'&&(()=>{const e=O.oilExecFormError({shot:1,odometer:'٩٠٩٩',odoPhoto:1},req);return e.field==='odometer'&&e.ar.includes('9100')&&e.bn.includes('9100');})()
  &&O.oilExecFormError({shot:1,odometer:'9100'},req).field==='odoPhoto'&&O.oilExecFormError({shot:1,odometer:'9100',odoPhoto:1},req)===null);
ok('الطلب: لقطة طلب سويتر إلزامية أولاً، ثم العدّاد، ثم صورته — بلغتين',(()=>{const e=O.oilRequestFormError({odometer:'1',odoPhoto:1});return e.field==='shot'&&/سويتر/.test(e.ar)&&/সুইটার/.test(e.bn);})()
  &&O.oilRequestFormError({shot:1,odoPhoto:1}).field==='odometer'&&O.oilRequestFormError({shot:1,odometer:'1'}).field==='odoPhoto'&&O.oilRequestFormError({shot:1,odometer:'1',odoPhoto:1})===null);

ok('sinceLast: 704 كم أقل من 2000 ⇒ مبكر، و2104 ⇒ لا، و−500 ⇒ «أقل» لا «مبكر»، وبلا سابق ⇒ null',O.sinceLast({since_km:704,since_days:4,interval_km:2000}).early&&!O.sinceLast({since_km:'2104',since_days:30,interval_km:'2000'}).early
  &&(s=>s.below&&!s.early)(O.sinceLast({since_km:-500,since_days:2,interval_km:2000}))&&O.sinceLast({since_km:null})===null);
ok('sinceAr: «704 كم و4 يوم منذ آخر تغيير معتمد»، وبلا سابق «لا تغيير معتمد سابق»',O.sinceAr({since_km:704,since_days:4,interval_km:2000})==='704 كم و4 يوم منذ آخر تغيير معتمد'&&O.sinceAr({})==='لا تغيير معتمد سابق');

const now=Date.parse('2026-10-17T12:00:00Z');
ok('نموذج الإضافة: الدراجة، العدّاد، صورة العدّاد، لا مستقبل، لا أقدم من 400 يوم',O.addOilFormError({odometer:'1',odoPhoto:1},now)==='اختر الدراجة.'
  &&O.addOilFormError({vehicle:'v',odoPhoto:1},now)==='أدخل قراءة العدّاد.'&&O.addOilFormError({vehicle:'v',odometer:'1'},now)==='أرفق صورة العدّاد.'
  &&O.addOilFormError({vehicle:'v',odometer:'1',odoPhoto:1,at:new Date(now+3*60e3),done:true},now)==='تاريخ التنفيذ في المستقبل.'&&O.addOilFormError({vehicle:'v',odometer:'1',odoPhoto:1,at:new Date(now+60e3)},now)===null
  &&O.addOilFormError({vehicle:'v',odometer:'1',odoPhoto:1,at:new Date(now-401*864e5)},now)==='التاريخ أقدم من 400 يوم.'
  &&O.addOilFormError({vehicle:'v',odometer:'1',odoPhoto:1,at:new Date(now-30*864e5)},now)===null&&O.addOilFormError({vehicle:'v',odometer:'1',odoPhoto:1},now)===null);

ok('أخطاء البايكر الجديدة بلغتين (SHOT_REQUIRED، SAME_MINUTE، ODOMETER_BELOW_REQUEST، TECH_NAME_TOO_LONG، USE_NEW_OIL_REQUEST)',
  ['SHOT_REQUIRED','SAME_MINUTE','ODOMETER_BELOW_REQUEST','TECH_NAME_TOO_LONG','USE_NEW_OIL_REQUEST'].every(c=>{const e=O.bikerRpcError({message:c});return e&&e.ar&&e.bn&&e.code==='E-'+c;}));
ok('أخطاء الإدارة الجديدة بنص عربي (ALREADY_CANCELLED، NO_BIKER، REASON_REQUIRED، NOT_DONE)',['ALREADY_CANCELLED','NO_BIKER','REASON_REQUIRED','NOT_DONE','INACTIVE_VEHICLE','PROOF_NEEDS_DONE'].every(c=>!O.adminRpcError({message:c}).startsWith('خطأ:')));
ok('حالة «ملغى» بلغتين',O.OIL_STATUS.cancelled.ar==='ملغى'&&O.OIL_STATUS.cancelled.bn==='বাতিল');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
