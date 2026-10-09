// حالة مراجعة تسجيل الدراجة: بانتظار المراجعة / تمت المراجعة / يحتاج تصحيح (src/handoverStatus.js)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.hs-test-'));
try{
execSync(`npx esbuild src/handoverStatus.js --bundle --format=esm --platform=node --outfile=${tmp}/t.mjs --log-level=error`,{stdio:'inherit'});
const S=await import(`${tmp}/t.mjs`);
const now='2026-10-09T18:00:00.000Z';

// الحالة
ok('سجل جديد (submitted) ⇒ بانتظار المراجعة',S.handoverState({status:'submitted'})==='pending');
ok('استلام افتتاحي (baseline) بلا مراجعة ⇒ بانتظار المراجعة',S.handoverState({status:'baseline'})==='pending');
ok('reviewed_at قديم بلا status ⇒ تمت المراجعة',S.handoverState({status:'submitted',reviewed_at:now})==='reviewed');
ok('status=reviewed ⇒ تمت المراجعة',S.handoverState({status:'reviewed'})==='reviewed');
ok('needs_fix تغلب حتى مع reviewed_at',S.handoverState({status:'needs_fix',reviewed_at:now})==='needs_fix');
ok('null ⇒ بانتظار المراجعة',S.handoverState(null)==='pending');
ok('ثلاث حالات بنصوص عربية وبنغالية',S.STATE_KEYS.join()==='pending,reviewed,needs_fix'&&S.STATE_KEYS.every(k=>S.STATES[k].ar&&/[ঀ-৿]/.test(S.STATES[k].bn)));

// السبب
ok('سبب فارغ ⇒ مرفوض',!!S.validateFixReason(''));
ok('سبب 4 أحرف ⇒ مرفوض',!!S.validateFixReason('غير '));
ok('مسافات فقط ⇒ مرفوض',!!S.validateFixReason('        '));
ok('سبب صالح',S.validateFixReason('صورة الضرر 3 غير واضحة')===null);
ok('أكثر من 500 ⇒ مرفوض',!!S.validateFixReason('x'.repeat(501)));

// الإرجاع
const row={id:'r1',status:'submitted',reviewed_at:'2026-10-08T00:00:00Z',checklist:{engine:true,received:{box:true}}};
const fp=S.fixPatch(row,'  صورة الضرر 3 غير واضحة ','u-salman','سلمان',now);
ok('fixPatch: status=needs_fix وتُلغى المراجعة',fp.status==='needs_fix'&&fp.reviewed_at===null&&fp.reviewed_by===null);
ok('fixPatch: يحفظ بقية checklist كما هي',fp.checklist.engine===true&&fp.checklist.received.box===true);
ok('fixPatch: السبب مقصوص ومعه الوقت ومن أرجعه',JSON.stringify(fp.checklist.fix)===JSON.stringify({reason:'صورة الضرر 3 غير واضحة',at:now,by:'u-salman',by_name:'سلمان'}));
const fixed={...row,...fp};
ok('بعد الإرجاع ⇒ يحتاج تصحيح وfixInfo يعيد السبب',S.handoverState(fixed)==='needs_fix'&&S.fixInfo(fixed).reason==='صورة الضرر 3 غير واضحة');
ok('fixInfo لسجل بلا إرجاع ⇒ null',S.fixInfo(row)===null&&S.fixInfo(null)===null);

// الاعتماد
const ap=S.approvePatch('u-owner',now);
ok('approvePatch: status=reviewed مع الوقت ومن راجع',ap.status==='reviewed'&&ap.reviewed_at===now&&ap.reviewed_by==='u-owner');
ok('اعتماد بعد الإرجاع ⇒ تمت المراجعة',S.handoverState({...fixed,...ap})==='reviewed');

// إعادة التسجيل
const redo={id:'r2',created_at:'2026-10-09T19:00:00Z',checklist:{redo_of:'r1'}};
const rows=[{...fixed,created_at:'2026-10-09T10:00:00Z'},redo,{id:'r0',created_at:'2026-10-01T10:00:00Z',status:'submitted'}];
ok('redoOf',S.redoOf(redo)==='r1'&&S.redoOf(row)===null);
ok('redoneBy: السجل المُرجَع أُعيد بـ r2',S.redoneBy(rows[0],rows).id==='r2'&&S.redoneBy(rows[2],rows)===null);
ok('latestRow: الأحدث مهما كان الترتيب',S.latestRow(rows).id==='r2'&&S.latestRow([])===null);

// فلتر سجل الإدارة
const all=[{status:'needs_fix'},{status:'submitted'},{status:'reviewed'},{status:'submitted',reviewed_at:now},{status:'baseline'}];
ok('filterByState("") ⇒ الكل',S.filterByState(all,'').length===5);
ok('فلتر «يحتاج تصحيح»',S.filterByState(all,'needs_fix').length===1);
const c=S.countByState(all);
ok('العدّادات',c.pending===2&&c.reviewed===2&&c.needs_fix===1);

// نص الإشعار
const n=S.fixNoticeText(' صورة الضرر 3 غير واضحة ');
ok('نص الإشعار بالعربي والبنغالي مع السبب',n.body.startsWith('تسجيل استلام الدراجة يحتاج تصحيح: صورة الضرر 3 غير واضحة')&&n.body.includes('বাইক গ্রহণ রেকর্ড সংশোধন দরকার: صورة الضرر 3'));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
