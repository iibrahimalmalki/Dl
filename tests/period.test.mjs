// اختبار نطاقات الفترة المشتركة (src/period.jsx → periodRange)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.pd-test-'));
try{
execSync(`npx esbuild src/period.jsx --bundle --format=esm --platform=node --external:react --outfile=${tmp}/p.mjs --log-level=error`,{stdio:'inherit'});
const{periodRange,PERIODS,isMonthly}=await import(`${tmp}/p.mjs`);
ok('7 فترات بالترتيب',PERIODS.map(p=>p.k).join()==='day,week,month,prev,quarter,year,custom'&&PERIODS.find(p=>p.k==='quarter').ar==='آخر 3 أشهر');
ok('isMonthly',!isMonthly('day')&&!isMonthly('week')&&['month','prev','quarter','year','custom'].every(isMonthly));
const d=periodRange('day','2026-09-30');ok('اليوم',d.from==='2026-09-30'&&d.to==='2026-09-30'&&d.prev.from==='2026-09-29');
const w=periodRange('week','2026-09-30');ok('الأسبوع 7 أيام والسابق مثله',w.from==='2026-09-24'&&w.prev.from==='2026-09-17'&&w.prev.to==='2026-09-23');
const m=periodRange('month','2026-09-30');ok('الشهر والسابق',m.from==='2026-09-01'&&m.to==='2026-09-30'&&m.months.join()==='2026-09'&&m.prev.months.join()==='2026-08');
const q=periodRange('quarter','2026-02-10');ok('الربع يعبر السنة',q.months.join()==='2025-12,2026-01,2026-02'&&q.prev.months.join()==='2025-09,2025-10,2025-11'&&q.to==='2026-02-28');
const pv=periodRange('prev','2026-07-31');ok('الشهر الماضي = السابق لشهر المرساة',pv.months.join()==='2026-06'&&pv.from==='2026-06-01'&&pv.to==='2026-06-30'&&pv.prev.months.join()==='2026-05');
const pj=periodRange('prev','2026-01-15');ok('الشهر الماضي يعبر السنة',pj.months.join()==='2025-12'&&pj.prev.months.join()==='2025-11');
const y=periodRange('year','2026-07-31');ok('السنة من يناير حتى شهر المرساة، ومقارنتها بالمدة نفسها من السنة السابقة',y.from==='2026-01-01'&&y.to==='2026-07-31'&&y.months.length===7&&y.prev.from==='2025-01-01'&&y.prev.to==='2025-07-31'&&y.prev.months.length===7);
const c=periodRange('custom','2026-07-31',{from:'2026-03',to:'2026-05'});ok('مخصّص + نافذة سابقة بنفس الطول',c.months.join()==='2026-03,2026-04,2026-05'&&c.to==='2026-05-31'&&c.prev.months.join()==='2025-12,2026-01,2026-02');
const cr=periodRange('custom','2026-07-31',{from:'2026-05',to:'2026-03'});ok('مخصّص: من/إلى معكوسان يُرتّبان',cr.months.join()==='2026-03,2026-04,2026-05');
const cn=periodRange('custom','2026-07-31');ok('مخصّص بلا نطاق محفوظ ← شهر المرساة',cn.months.join()==='2026-07');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
