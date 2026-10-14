// «تسليم عهدة» في سلاسل الإمداد ← custody_assets (src/custodyHandover.js)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
// الملف يستورد بلا امتداد (أسلوب Vite) ⇒ يُحزَم أولاً كاختبار custodyLifecycle
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.ch-test-'));
let M;
try{
  fs.writeFileSync(`${tmp}/entry.js`,`export * from '${path.resolve('src/custodyHandover.js')}';export {CATALOG} from '${path.resolve('src/custodyCatalog.js')}';`);
  execSync(`npx esbuild ${tmp}/entry.js --bundle --format=esm --platform=node --outfile=${tmp}/t.mjs --log-level=error`,{stdio:'inherit'});
  M=await import(`${tmp}/t.mjs`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
const{KIT_KEYS,SINGLE_KEYS,handoverError,handoverPlan,CATALOG}=M;
const ABED={id:'e-abed',full_name:'Abed mia',employee_id:'2637651411'},MIDUL={id:'e-midul',full_name:'Midul Hassan',employee_id:'1648'};

ok('القائمة القياسية 20 صنفاً: كل الكتالوج عدا الجوال وخزان الماء',KIT_KEYS.length===20&&CATALOG.length===22&&!KIT_KEYS.includes('phone')&&!KIT_KEYS.includes('watertank'));
ok('التسليم المفرد: كل الكتالوج عدا الجوال (الخزان متاح مفرداً)',SINGLE_KEYS.length===21&&SINGLE_KEYS.includes('watertank')&&!SINGLE_KEYS.includes('phone'));
const T='2026-10-14';
ok('بلا بايكر/بلا أصناف/بلا تاريخ/تاريخ مستقبلي/الجوال ⇒ أخطاء',/البايكر/.test(handoverError({keys:['moto'],date:T},T))&&/صنفاً/.test(handoverError({employee:ABED,keys:[],date:T},T))
  &&/إلزامي/.test(handoverError({employee:ABED,keys:['moto'],date:''},T))&&/المستقبل/.test(handoverError({employee:ABED,keys:['moto'],date:'2026-10-15'},T))&&/IMEI/.test(handoverError({employee:ABED,keys:['phone'],date:T},T)));
ok('تاريخ سابق (عابد بدأ 2026-07-12) مقبول',handoverError({employee:ABED,keys:KIT_KEYS,date:'2026-07-12'},T)===null);

const P=handoverPlan(KIT_KEYS,[],{employee:ABED,operator_id:'op',date:'2026-07-12'});
ok('بايكر بلا عهدة ⇒ 20 صفاً جديداً، لا تفعيل ولا تخطّي',P.inserts.length===20&&P.activate.length===0&&P.skipped.length===0);
const moto=P.inserts.find(r=>r.name==='الدراجة النارية'),dash=P.inserts.find(r=>r.name==='ملمّع الدَّشبورد');
ok('الصف: البداية = تاريخ التسليم، النهاية = + عمر الكتالوج، نشط، المصدر «handover»، والهوية من الموظف',moto.start_date==='2026-07-12'&&moto.end_date==='2029-07-12'&&dash.end_date==='2026-08-12'
  &&moto.status==='active'&&moto.source==='handover'&&moto.employee_id==='e-abed'&&moto.sweater_id==='2637651411'&&moto.biker_name==='Abed mia'&&moto.operator_id==='op'&&moto.life_months===36&&moto.lead_days===90);
const ex=[{id:'h',employee_id:'e-midul',name:'الخوذة',status:'missing',notes:'من جولة'},{id:'m',employee_id:'e-midul',name:'الدراجة النارية',status:'active'},
  {id:'u',employee_id:'e-midul',name:'الزي الرسمي',status:'due'},{id:'o',employee_id:'e-midul',name:'المكنسة',status:'replaced'},{id:'x',employee_id:'e-abed',name:'حذاء السلامة',status:'active'}];
const Q=handoverPlan(['moto','uniform','helmet','vacuum','shoes'],ex,{employee:MIDUL,date:T});
ok('المسجّل نشطاً/مستحقاً لا يتكرّر، والمُستبدل لا يمنع، وقطعة بايكر آخر لا تؤثّر',Q.skipped.join()==='moto,uniform'&&Q.inserts.map(r=>r.name).join()==='المكنسة,حذاء السلامة');
ok('«ناقصة» للصنف نفسه ⇒ تُفعَّل (لا صف ثانٍ) ويبدأ عدّادها من تاريخ التسليم',Q.activate.length===1&&Q.activate[0].id==='h'&&Q.activate[0].patch.status==='active'&&Q.activate[0].patch.start_date===T&&Q.activate[0].patch.end_date==='2028-10-14'&&/من جولة · سُلّمت 2026-10-14/.test(Q.activate[0].patch.notes));
ok('صنف مكرّر في الطلب يُحسب مرة، ومفتاح غير معروف يُتجاهل',handoverPlan(['moto','moto','xyz'],[],{employee:ABED,date:T}).inserts.length===1);
