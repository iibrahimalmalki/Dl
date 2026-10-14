// تاريخ استلام العهدة = أول طلب في سويتر على Postgres محلي (docs/sql/custody_first_order_dates.sql)
// يعمل فقط مع PGTEST_PORT؛ بدونه يُتخطّى بلا فشل.
import {execFileSync,execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const port=process.env.PGTEST_PORT;
if(!port){console.log('- skipped (PGTEST_PORT غير محدد — لا Postgres محلي)');process.exit(0);}
const db='cfo_test_'+process.pid;
const ps=(sql,d=db)=>execFileSync('psql',['-U','postgres','-h','/var/run/postgresql','-p',port,'-d',d,'-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const err=sql=>{try{ps(sql);return null;}catch(e){return String(e.stderr||e.message);}};
const F=fs.readFileSync(new URL('../docs/sql/custody_first_order_dates.sql',import.meta.url),'utf8');
const cut=(a,b)=>F.slice(F.indexOf(a),b?F.indexOf(b):undefined);
const P0=cut('-- ═══ 0)','-- ═══ 1)'),B1=cut('-- ═══ 1)','-- ═══ 2)'),B2=cut('-- ═══ 2)','-- ═══ التحقق'),V=cut('-- ═══ التحقق','-- ═══ التراجع');
const PH="'____-__-__'";
const fill=(s,...ds)=>ds.reduce((x,d)=>x.replace(PH,`'${d}'`),s);
const b2=(code,d)=>fill(B2.replace("v_code text := '1648'",`v_code text := '${code}'`),d);
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.cfo-test-'));
ps(`create database ${db}`,'postgres');
try{
fs.writeFileSync(`${tmp}/entry.js`,`export * from '${path.resolve('src/custodyLifecycle.js')}';`);
let L=null;try{execSync(`npx esbuild ${tmp}/entry.js --bundle --format=esm --platform=node --outfile=${tmp}/t.mjs --log-level=error`,{stdio:'pipe'});L=await import(`${tmp}/t.mjs`);}catch{}
const addMonths=(iso,m)=>{const d=new Date(iso+"T00:00:00Z");d.setUTCMonth(d.getUTCMonth()+Math.round(Number(m)||0));return d.toISOString().slice(0,10);};

ok('الملف بلا drop ولا delete خارج التعليقات (أداة MCP)',!/\bdrop\b|\bdelete\b/i.test(F.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n')));
ok('الرأس: «لم يُطبَّق»',/الحالة: \*\*لم يُطبَّق\*\*/.test(F));

ps(`create table public.employees (id uuid primary key default gen_random_uuid(), operator_id uuid, full_name text, employee_id text, name_en text);
create table public.custody_assets (id uuid primary key default gen_random_uuid(), operator_id uuid, employee_id uuid, biker_name text, sweater_id text,
  item_type text, category text, name text, name_en text, start_date date not null, life_months numeric not null, end_date date, lead_days int, cost numeric,
  status text not null, source text, round_id uuid, reorder_request_id uuid, notes text, created_at timestamptz default now());
insert into employees (operator_id,full_name,employee_id,name_en) values
 ('b57f396c-2d39-4fa4-a568-143585f3db14','Ariful Islam','1624','Ariful'),('b57f396c-2d39-4fa4-a568-143585f3db14','Midul Hassan','1648','Midul'),
 ('b57f396c-2d39-4fa4-a568-143585f3db14','Mohamad Rakib','1700','Rakib');`);

// الكتالوج في الملف = القائمة القياسية في الواجهة (20 صنفاً بالاسم والعمر والمهلة)
const sqlCat=[...B1.matchAll(/\('([^']+)','([^']+)','([a-z]+)','([^']+)',(\d+),(\d+),(true|false)\)/g)].map(m=>({name:m[1],en:m[2],type:m[3],category:m[4],life:+m[5],lead:+m[6],damaged:m[7]==='true'}));
if(L){const kit=L.CATALOG.filter(c=>c.key!=='phone'&&c.key!=='watertank');// القائمة القياسية (KIT_KEYS في #89)
  ok('البند 1: الأصناف الـ20 مطابقة للكتالوج (الاسم/الإنجليزي/النوع/الفئة/العمر/المهلة)',sqlCat.length===20&&kit.length===20&&kit.every(c=>sqlCat.some(s=>s.name===c.name&&s.en===c.en&&s.type===c.type&&s.category===c.category&&s.life===c.life&&s.lead===c.lead)));
  const lifeOf=n=>(kit.find(c=>c.name===n)||{}).life,leadOf=n=>(kit.find(c=>c.name===n)||{}).lead;
  const b2cat=[...B2.matchAll(/\('([^']+)',(\d+),(\d+)\)/g)].map(m=>[m[1],+m[2],+m[3]]);
  ok('البند 2: جدول العمر/المهلة مطابق للكتالوج',b2cat.length===20&&b2cat.every(([n,l,d])=>lifeOf(n)===l&&leadOf(n)===d));
  const p0cat=[...P0.matchAll(/\('([a-z]+)','([^']+)',(\d+),(\d+),(true|false)\)/g)].map(m=>[m[2],+m[3],+m[4]]);
  ok('المعاينة: جدول العمر/المهلة مطابق للكتالوج',p0cat.length===20&&p0cat.every(([n,l,d])=>lifeOf(n)===l&&leadOf(n)===d));
}else ok('تجميع custodyLifecycle (esbuild)',false);
ok('الأصناف التالفة الثمانية: الصدرية والحذاء ومواد التنظيف الست',sqlCat.filter(c=>c.damaged).map(c=>c.name).sort().join('|')===
  ['الصدرية (واقي الصدر)','حذاء السلامة','ملمّع الدَّشبورد','ملمّع الإطارات','مزيل البقع','اللمسة الأخيرة','منظّف الزجاج','صابون/شامبو'].sort().join('|'));

// بيانات ميدول ورقيب كما في الإنتاج: 20 قطعة active بتاريخ أول جولة
const seed=(code,d)=>ps(`insert into custody_assets (operator_id,employee_id,biker_name,sweater_id,item_type,category,name,name_en,start_date,life_months,end_date,lead_days,status,source)
  select e.operator_id,e.id,e.full_name,e.employee_id,c.type,c.category,c.name,c.en,'${d}',c.life,'${d}'::date+(c.life*30),c.lead,'active','round'
    from employees e, (values ${sqlCat.map(c=>`('${c.name}','${c.en}','${c.type}','${c.category}',${c.life},${c.lead})`).join(',')}) c(name,en,type,category,life,lead)
   where e.employee_id='${code}'`);
seed('1648','2026-08-07');seed('1700','2026-08-05');

ok('قبل تطبيق #86 ⇒ البندان يرفضان',(err(fill(B1,'2025-12-15'))||'').includes('#86')&&(err(b2('1648','2026-02-10'))||'').includes('#86'));
ps(`create view public.my_custody_assets as select * from custody_assets`);
ok('التاريخ غير المعبّأ يفشل (لا يعمل بند قبل تعبئته)',!!err(B1)&&!!err(B2)&&!!err(P0));

// ── البند 1: عريف ──
ok('عريف: تاريخ في المستقبل ⇒ رفض',(err(fill(B1,'2099-01-01'))||'').includes('تاريخ غير مقبول'));
ps(fill(B1,'2025-12-31'));
const A=JSON.parse(ps(`select json_agg(a) from (select name,status,source,start_date::text s,end_date::text e,life_months::int life,lead_days lead,notes,sweater_id,biker_name from custody_assets a join employees e on e.id=a.employee_id where e.employee_id='1624') a`));
ok('عريف: 20 صفاً، 12 active و8 due، المصدر handover، رقم البايكر والاسم',A.length===20&&A.filter(r=>r.status==='active').length===12&&A.filter(r=>r.status==='due').length===8&&A.every(r=>r.source==='handover'&&r.sweater_id==='1624'&&r.biker_name==='Ariful Islam'));
ok('عريف: الثمانية due بالملاحظة الحرفية',A.filter(r=>r.status==='due').every(r=>r.notes==='تالفة — جولة 2026-10-01 — تحتاج استبدال (قرار المالك)'&&sqlCat.find(c=>c.name===r.name).damaged));
ok('عريف: البداية = تاريخ أول طلب، والنهاية = addMonths في الواجهة (31 ديسمبر + شهر = 31 يناير، +2 = 3 مارس)',A.every(r=>r.s==='2025-12-31'&&r.e===addMonths('2025-12-31',r.life))&&A.find(r=>r.name==='إسفنجات (بودي/إطارات)').e==='2026-03-03');
ps(fill(B1,'2025-12-31'));
ok('عريف: إعادة التشغيل لا تكرّر (20 صفاً)',ps(`select count(*) from custody_assets a join employees e on e.id=a.employee_id where e.employee_id='1624'`)==='20');
ok('عريف: تاريخ مختلف بعد التطبيق ⇒ رفض بلا إضافة',(err(fill(B1,'2025-11-01'))||'').includes('المتوقع 0')&&ps(`select count(*) from custody_assets a join employees e on e.id=a.employee_id where e.employee_id='1624'`)==='20');

// ── البنود 2 و3: ميدول ورقيب ──
ok('ميدول: تاريخ بعد أول جولة ⇒ رفض',(err(b2('1648','2026-09-01'))||'').includes('يجب أن يسبق'));
ps(`update custody_assets set status='replaced' where id=(select a.id from custody_assets a join employees e on e.id=a.employee_id where e.employee_id='1700' limit 1)`);
ok('رقيب: 19 قطعة حيّة ⇒ تراجع بلا تعديل',(err(b2('1700','2026-03-10'))||'').includes('المتوقع 20/20/0')&&ps(`select count(*) from custody_assets a join employees e on e.id=a.employee_id where e.employee_id='1700' and start_date<>'2026-08-05'`)==='0');
ps(`update custody_assets set status='active' where status='replaced'`);
const before=ps(`select count(*) from custody_assets a join employees e on e.id=a.employee_id where e.employee_id<>'1648'`);
ps(b2('1648','2026-01-31'));ps(b2('1700','2026-03-10'));
const M=JSON.parse(ps(`select json_agg(a) from (select e.employee_id code,name,status,start_date::text s,end_date::text e,life_months::int life,notes from custody_assets a join employees e on e.id=a.employee_id where e.employee_id in ('1648','1700')) a`));
const mid=M.filter(r=>r.code==='1648'),rak=M.filter(r=>r.code==='1700');
ok('ميدول: 20 قطعة بالبداية الجديدة والنهاية = addMonths (31 يناير + شهر = 3 مارس)',mid.length===20&&mid.every(r=>r.s==='2026-01-31'&&r.e===addMonths('2026-01-31',r.life))&&mid.find(r=>r.name==='صابون/شامبو').e==='2026-03-03');
ok('رقيب: 20 قطعة من 2026-03-10',rak.length===20&&rak.every(r=>r.s==='2026-03-10'&&r.e===addMonths('2026-03-10',r.life)));
ok('ملاحظة التصحيح تذكر التاريخ السابق، والحالة لم تتغيّر',mid.every(r=>/صُحّح التاريخ [0-9-]+ إلى أول طلب في سويتر \(كان 2026-08-07 — أول جولة\)/.test(r.notes)&&r.status==='active')&&rak.every(r=>r.notes.includes('كان 2026-08-05')));
ok('لا يمسّ عهدة عريف',ps(`select count(*) from custody_assets a join employees e on e.id=a.employee_id where e.employee_id='1624' and start_date='2025-12-31'`)==='20'&&before===ps(`select count(*) from custody_assets a join employees e on e.id=a.employee_id where e.employee_id<>'1648'`));
const snap=ps(`select string_agg(id::text||start_date||end_date||notes,',' order by id) from custody_assets`);
ps(b2('1648','2026-01-31'));
ok('إعادة التشغيل لا تغيّر شيئاً',snap===ps(`select string_agg(id::text||start_date||end_date||notes,',' order by id) from custody_assets`));
ok('تاريخ مختلف بعد التطبيق ⇒ رفض',(err(b2('1648','2026-01-15'))||'').includes('تراجع'));

// ── المعاينة والتحقق ──
const today=ps(`select (now() at time zone 'Asia/Riyadh')::date`);
const R=JSON.parse(ps(`select json_agg(x) from (${fill(P0,'2025-12-31','2026-01-31','2026-03-10').replace(/;\s*$/,'')}) x`));
const st=r=>r.new_end<today?'منتهي':(Date.parse(r.new_end)-Date.parse(today))/864e5<=r.lead_days?'قارب الانتهاء':'سليم';
ok('المعاينة: 60 سطراً (20 لكلٍّ من الثلاثة) والحالة من التاريخ والمهلة',R.length===60&&['Ariful','Midul','Rakib'].every(b=>R.filter(r=>r.biker===b).length===20)&&R.every(r=>r.state===st(r)&&r.new_end===addMonths(r.new_start,r.life_months)));
ok('المعاينة: عريف يظهر بحالته المخطّطة (8 due)',R.filter(r=>r.biker==='Ariful'&&r.status==='due').length===8);
const VR=JSON.parse(ps(`select json_agg(x) from (${V.replace(/--.*$/gm,'').trim().replace(/;\s*$/,'')}) x`));
ok('التحقق: لا فرق في النهاية لأي صف، وعريف 12+8',VR.every(r=>r.end_mismatch===0)&&VR.some(r=>r.name_en==='Ariful'&&r.status==='due'&&r.n===8));
}finally{ps(`drop database if exists ${db} with (force)`,'postgres');fs.rmSync(tmp,{recursive:true,force:true});}
