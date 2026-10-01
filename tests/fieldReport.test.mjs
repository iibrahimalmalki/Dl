// اختبار مولّد التقرير v2 — يُبنى بالـ esbuild لتفادي مسارات vite بلا امتداد
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.fr-test-'));
execSync(`npx esbuild src/fieldReport.js --bundle --format=esm --platform=node --outfile=${tmp}/r.mjs --log-level=error`,{stdio:'inherit'});
execSync(`npx esbuild src/fieldAnalysis.js --bundle --format=esm --platform=node --outfile=${tmp}/a.mjs --log-level=error`,{stdio:'inherit'});
const {buildReportHTML,reportId}=await import(`${tmp}/r.mjs`);
const {analyzeRound}=await import(`${tmp}/a.mjs`);
const round={id:'x',sweater_id:'1648',biker_name:'Midul Hassan',round_date:'2026-09-30',round_time:'20:07',inspector:'إبراهيم المالكي',compliance_pct:85.7,
  results:{1:'fail',2:'excused',15:'fail',3:'pass',4:'fail',5:'pass',6:'pass',7:'pass',8:'pass',9:'pass',10:'pass',11:'pass',12:'fail',13:'pass'},
  item_notes:{15:'يحتاج إعادة دهان الصندوق',14:'لم تُشاهد غسلة'},item_parts:{12:['منظّف الزجاج']},photos:{1:['https://x/1-0-1790788114994-1.jpg']}};
const hist=[{round_date:'2026-08-07',compliance_pct:83.3,results:{1:'pass',2:'half',4:'half',5:'half'}}];
const an=analyzeRound(round,hist);
const html=buildReportHTML(round,an,'دلو ورغوة',{},{history:[{round_date:'2026-09-30',compliance_pct:85.7,results:round.results},...hist],team:'شرق الرياض',qrSvg:'<svg></svg>'});
ok('report id',reportId(round)==='FR-20260930-1648');
ok('cover has both scores',html.includes('التزام البايكر')&&html.includes('جاهزية الإمداد')&&html.includes('85.7%')&&html.includes('50%'));
ok('embedded font faces',(html.match(/@font-face/g)||[]).length===8&&!html.includes('fonts.googleapis'));
ok('no browser header/footer + custom footer',html.includes('@page{size:A4;margin:0}')&&html.includes('class="pf"'));
ok('no elapsed counter / escalation emails',!html.includes('المدة منذ الجولة')&&!html.includes('jibalalsahil.com'));
ok('not-assessed item 14 shown with reason',html.includes('غير مقيَّم')&&html.includes('لم تُشاهد غسلة'));
ok('amber for supply, red for biker',html.includes('#b54708;background:#fdf3e2')&&html.includes('#b42318;background:#fdecea'));
ok('bengali summary + signatures',html.includes('lang="bn"')&&html.includes('বাইকার')&&html.includes('التوقيعات'));
ok('inspector≠approver',html.includes('مدير العمليات'));
ok('prev actions + trend',html.includes('إجراءات الجولة السابقة')&&html.includes('83.3%'));
ok('root cause + recommendation',html.includes('السبب الجذري')&&an.rootCause.includes('#1'));
ok('photo caption with time',/أمام · \d{2}:\d{2}/.test(html));
// v3: أقسام الجمهور بالترتيب + السرد الذكي
const order=['class="cover"','class="pg exec"','class="pg sup"','class="pg ev"','class="pg emp"'].map(k=>html.indexOf(k));
ok('audience sections in order',order.every((v,i)=>v>0&&(i===0||v>order[i-1])));
ok('executive summary headline + reading',html.includes('الملخص التنفيذي')&&html.includes('Midul Hassan حقق 85.7%')&&html.includes('ماذا وجدنا')&&html.includes('ماذا بعد'));
ok('leadership decisions for supply gap',html.includes('قرارات مطلوبة من القيادة')&&html.includes('اعتماد توفير'));
ok('supervisor checklist',html.includes('المتابعة الإشرافية')&&html.includes('معيار الإغلاق')&&html.includes('☐ أُغلق'));
ok('evidence: gaps before compliant',html.indexOf('تحتاج تصحيحاً')<html.indexOf('evh g'));
ok('employee page bilingual',html.includes('صفحة الموظف')&&html.includes('ভালো করেছেন')&&html.includes('ليست عليك'));
ok('PDF capture never zoomed',html.includes('onclone')&&html.includes('if(busy)return'));
fs.rmSync(tmp,{recursive:true,force:true});
