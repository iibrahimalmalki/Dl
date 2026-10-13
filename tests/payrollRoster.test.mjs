// قائمة المسير: البايكر النشط وغير المربوط واسم المشرف وتحذير الإكراميات (src/payrollRoster.js)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.roster-test-'));
try{
execSync(`npx esbuild src/payrollRoster.js --bundle --format=esm --platform=node --outfile=${tmp}/r.mjs --log-level=error`,{stdio:'inherit'});
const{payrollRoster,isActiveBiker,tipsCheck}=await import(`${tmp}/r.mjs`);
const E=(id,sidv,o={})=>({id,full_name:'N'+id,employee_id:sidv,staff_role:'biker',start_date:'2026-01-01',is_test:false,...o});
const emps=[E('a','1624'),E('m','1648'),E('r','1700'),E('ab','2637651411',{start_date:'2026-08-10'}),E('ns','1800',{start_date:null}),
  E('old','1631',{staff_role:null}),E('t','TEST01',{is_test:true}),{id:'s',full_name:'سلمان المالكي',employee_id:null,staff_role:'supervisor'},
  {id:'o',full_name:'عمر',employee_id:null,staff_role:'manager'}];
const offs=[{employee_id:null,sweater_id:'1631',last_day:'2026-05-10'}];
const ops=[{sweater_id:'1624'},{sweater_id:'1648 '},{sweater_id:'9999',biker_name:'Ghost'}];
const R=payrollRoster({emps,offboarding:offs,ops,period:'2026-07'});
const ids=R.bikers.map(b=>b.id).sort().join();
ok('يوليو: الثلاثة + بلا تاريخ مباشرة؛ عابد (مباشرة أغسطس) خارج المسير',ids==='a,m,ns,r');
ok('أغسطس: عابد يدخل (مباشرته 10 أغسطس ≤ نهاية الشهر)',payrollRoster({emps,offboarding:offs,period:'2026-08'}).bikers.some(b=>b.id==='ab'));
ok('المغادر قبل بداية الشهر خارج المسير (1631 غادر 10 مايو)',!payrollRoster({emps,offboarding:offs,period:'2026-06'}).bikers.some(b=>b.id==='old'));
ok('المغادر خلال الشهر يبقى في مسير ذلك الشهر (مايو)',payrollRoster({emps,offboarding:offs,period:'2026-05'}).bikers.some(b=>b.id==='old'));
ok('التجريبي والمدير والمشرف خارج قائمة البايكرز',!R.bikers.some(b=>['t','s','o'].includes(b.id)));
ok('من له سطر محفوظ يبقى ظاهراً ولو خرج من التعريف',payrollRoster({emps,offboarding:offs,period:'2026-07',savedIds:['ab']}).bikers.some(b=>b.id==='ab'));
ok('غير المربوط = رقم في العمليات بلا موظف (لا يُستبعد بصمت)',R.unlinked.length===1&&R.unlinked[0].sweater_id==='9999'&&R.unlinked[0].biker_name==='Ghost');
ok('اسم المشرف من جدول الموظفين',R.supervisor&&R.supervisor.full_name==='سلمان المالكي');
ok('isActiveBiker: دور آخر غير biker مرفوض',!isActiveBiker(E('x','1',{staff_role:'manager'}),'2026-07')&&!isActiveBiker(E('x','',{}),'2026-07'));
ok('إعادة التعيين: مباشرة بعد آخر يوم تعيده للمسير',payrollRoster({emps:[E('re','1631',{start_date:'2026-08-01'})],offboarding:offs,period:'2026-08'}).bikers.length===1
  &&payrollRoster({emps:[E('re','1631',{start_date:'2026-08-01'})],offboarding:offs,period:'2026-07'}).bikers.length===0);
ok('رقم التجريبي في العمليات لا يُعدّ «غير مربوط»',payrollRoster({emps,ops:[{sweater_id:'TEST01'}],period:'2026-07'}).unlinked.length===0);
ok('الإكراميات: يوليو 81.90 مقابل 82.00 ⇒ بلا تحذير',tipsCheck(81.9,82)===null);
const tw=tipsCheck(80.5,82);
ok('الإكراميات: فرق 1.50 ⇒ تحذير',tw&&tw.diff===1.5&&tw.total===80.5&&tw.invoice===82);
ok('الإكراميات: بلا فاتورة ⇒ لا تحذير',tipsCheck(50,null)===null);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
