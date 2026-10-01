// اختبار نطاقات الفترة المشتركة (src/period.jsx → periodRange)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.pd-test-'));
try{
execSync(`npx esbuild src/period.jsx --bundle --format=esm --platform=node --external:react --outfile=${tmp}/p.mjs --log-level=error`,{stdio:'inherit'});
const{periodRange,PERIODS}=await import(`${tmp}/p.mjs`);
ok('4 فترات',PERIODS.map(p=>p.k).join()==='day,week,month,quarter');
const d=periodRange('day','2026-09-30');ok('اليوم',d.from==='2026-09-30'&&d.to==='2026-09-30'&&d.prev.from==='2026-09-29');
const w=periodRange('week','2026-09-30');ok('الأسبوع 7 أيام والسابق مثله',w.from==='2026-09-24'&&w.prev.from==='2026-09-17'&&w.prev.to==='2026-09-23');
const m=periodRange('month','2026-09-30');ok('الشهر والسابق',m.from==='2026-09-01'&&m.to==='2026-09-30'&&m.months.join()==='2026-09'&&m.prev.months.join()==='2026-08');
const q=periodRange('quarter','2026-02-10');ok('الربع يعبر السنة',q.months.join()==='2025-12,2026-01,2026-02'&&q.prev.months.join()==='2025-09,2025-10,2025-11'&&q.to==='2026-02-28');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
