// إطلاق المنصة: مركز الدعم ومتتبع الحصر (src/launch/lib.js)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.ln-test-'));
try{
execSync(`npx esbuild src/launch/lib.js --bundle --format=esm --platform=node --outfile=${tmp}/l.mjs --log-level=error`,{stdio:'inherit'});
const L=await import(`${tmp}/l.mjs`);

// ── نموذج البايكر ──
ok('الأنواع الأربعة بالترتيب',L.KINDS.map(k=>k.k).join()==='problem,idea,question,request');
ok('طلب صالح بلا لقطات',L.validateTicket({kind:'idea',body:'تحسين شاشة الوقود'}).length===0);
ok('بلا نوع وبلا وصف ⇒ خطآن بالعربي والبنغالي',(e=>e.length===2&&e.every(x=>x.ar&&x.bn))(L.validateTicket({kind:'',body:'  '})));
ok('نوع غير معروف مرفوض',L.validateTicket({kind:'complaint',body:'نص كافٍ'}).some(e=>e.f==='kind'));
ok('وصف أقصر من 3 أحرف بعد القص مرفوض',L.validateTicket({kind:'question',body:' ab '}).some(e=>e.f==='body'));
ok('أكثر من 2000 حرف مرفوض',L.validateTicket({kind:'question',body:'x'.repeat(2001)}).some(e=>e.f==='body'));
ok('أكثر من 3 لقطات مرفوض، و3 مقبولة',L.validateTicket({kind:'problem',body:'زر لا يعمل',photos:[1,2,3,4]}).some(e=>e.f==='photos')&&L.validateTicket({kind:'problem',body:'زر لا يعمل',photos:[1,2,3]}).length===0);

// ── رد السفير ──
ok('«تم التنفيذ» و«لن يُنفَّذ» بلا رد مرفوضان',L.validateReply({status:'done',reply:' '}).length===1&&L.validateReply({status:'wont_do'}).length===1);
ok('«قيد الفحص» بلا رد مقبول، والإغلاق برد مقبول',L.validateReply({status:'in_review'}).length===0&&L.validateReply({status:'wont_do',reply:'خارج نطاق المنصة'}).length===0);
ok('حالة غير معروفة مرفوضة',L.validateReply({status:'closed',reply:'x'}).length===1);

// ── ملخص الصندوق ──
const now=Date.parse('2026-10-10T12:00:00Z'),h=n=>new Date(now-n*3600e3).toISOString();
const S=L.inboxSummary([{status:'new',created_at:h(30)},{status:'in_review',created_at:h(30),replied_at:h(2)},{status:'new',created_at:h(5)},{status:'done',created_at:h(50)},{status:'wont_do',created_at:h(50)}],now);
ok('المفتوح 3، والمتأخر بلا رد بعد 24 ساعة 1 (المردود عليه لا يُعدّ)',S.open===3&&S.overdue===1);
ok('العدّ لكل حالة',S.by.new===2&&S.by.in_review===1&&S.by.done===1&&S.by.wont_do===1);

// ── متتبع الحصر ──
ok('الخطوات الست بالترتيب وسفيرها («بياناتي» للمالك)',L.STEPS.map(s=>s.k).join()==='profile,docs,bike,assets,daily,academy'&&L.STEPS.filter(s=>s.by==='عمر').map(s=>s.k).join()==='docs,academy'&&L.STEPS[0].by==='المالك'&&L.STEPS.filter(s=>s.by==='سلمان').map(s=>s.k).join()==='bike,assets,daily');
const M=L.stepMap([{employee_id:'a',step:'profile',status:'approved'},{employee_id:'a',step:'docs',status:'needs_fix',note:'صورة الرخصة غير واضحة'},{employee_id:'b',step:'profile',status:'approved'},{employee_id:'b',step:'hack',status:'approved'}]);
ok('خطوة غير معروفة تُتجاهل، والغائب «لم يبدأ»',!('hack' in M.b)&&L.statusAt(M,'b','docs')==='none'&&L.statusAt(M,'zz','profile')==='none');
const pa=L.bikerProgress(M,'a');
ok('التقدّم: معتمد 1 من 6، والحالية أول خطوة غير معتمدة (وثائقي)',pa.approved===1&&pa.total===6&&pa.current==='docs'&&!pa.complete);
const all=L.stepMap(L.STEPS.map(s=>({employee_id:'c',step:s.k,status:'approved'})));
ok('كل الخطوات معتمدة ⇒ مكتمل',L.bikerProgress(all,'c').complete&&L.bikerProgress(all,'c').current===null);
const cov=L.stepCoverage(M,['a','b']);
ok('التغطية: «بياناتي» مكتملة عند الاثنين و«وثائقي» لا',cov[0].complete&&cov[0].approved===2&&!cov[1].complete&&cov[1].approved===0);
ok('بلا بايكرز لا تُعدّ أي خطوة مكتملة',L.stepCoverage(M,[]).every(c=>!c.complete));
ok('«يحتاج تصحيح» بلا ملاحظة مرفوض وبها مقبول',L.validateStep({status:'needs_fix',note:' '}).length===1&&L.validateStep({status:'needs_fix',note:'أعد تصوير العداد'}).length===0);
ok('«معتمد» بلا ملاحظة مقبول، وحالة «none» مرفوضة',L.validateStep({status:'approved'}).length===0&&L.validateStep({status:'none'}).length===1);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
