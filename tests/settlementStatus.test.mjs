// حالات تسوية سويتر: مُرسلة/مدفوعة، القفل، وصافي الشهر الرسمي (src/settlementStatus.js)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.ss-test-'));
try{
execSync(`npx esbuild src/settlementStatus.js --bundle --format=esm --platform=node --outfile=${tmp}/t.mjs --log-level=error`,{stdio:'inherit'});
const S=await import(`${tmp}/t.mjs`);
const aug={period:'2026-08',status:'confirmed',paid:true,net_total:'10358.38'};
const sep={period:'2026-09',status:'submitted',paid:false,net_total:'10131.66'};

ok('مُرسلة ⇒ submitted «مُرسلة»',S.stageOf(sep)==='submitted'&&S.stageLabel(sep)==='مُرسلة');
ok('confirmed + paid=true ⇒ «مدفوعة»',S.stageOf(aug)==='paid'&&S.stageLabel(aug)==='مدفوعة');
ok('status=paid ⇒ «مدفوعة»',S.stageOf({status:'paid'})==='paid');
ok('تقديرية ومسودة ومعتمدة',S.stageLabel({status:'estimated'})==='تقديرية'&&S.stageLabel({status:'draft'})==='مسودة'&&S.stageLabel({status:'confirmed'})==='معتمدة');
ok('حالة غير معروفة تُعرض كما هي',S.stageLabel({status:'disputed'})==='disputed');
ok('null ⇒ مسودة',S.stageOf(null)==='draft'&&S.stageLabel(null)==='مسودة');

ok('مُرسلة مقفلة',S.isLocked(sep));
ok('مدفوعة (paid=true) مقفلة',S.isLocked(aug));
ok('معتمدة غير مدفوعة غير مقفلة',!S.isLocked({status:'confirmed',paid:false}));
ok('مسودة/تقديرية غير مقفلة',!S.isLocked({status:'draft'})&&!S.isLocked({status:'estimated'})&&!S.isLocked(null));

const rows=[aug,sep,{period:'2026-10',status:'estimated',net_total:'9000'},{period:'2026-07',status:'draft',net_total:'5'}];
ok('صافي سبتمبر المُرسلة = 10131.66',S.settledNet(rows,'2026-09')===10131.66);
ok('صافي أغسطس = 10358.38',S.settledNet(rows,'2026-08')===10358.38);
ok('تقديرية ومسودة ⇒ null (احتساب من العمليات)',S.settledNet(rows,'2026-10')===null&&S.settledNet(rows,'2026-07')===null);
ok('net_total فارغ ⇒ null',S.settledNet([{period:'2026-09',status:'submitted',net_total:null}],'2026-09')===null);
ok('فترة غير موجودة ⇒ null',S.settledNet(rows,'2026-11')===null&&S.settledNet(null,'2026-09')===null);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
