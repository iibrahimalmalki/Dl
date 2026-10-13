// «الجوال» في العهدة: فحص IMEI (مطابق للقاعدة)، والخط، والماركة، وأخطاء الإقرار، وبيانات الحفظ والعرض (src/custodyPhone.js)
// مع PGTEST_PORT: يقارن imeiOk/imeiDigits بدالتَي القاعدة _imei_ok/_imei_digits من docs/sql/custody_phone.sql على عيّنة واسعة.
import {execSync,execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.cph-test-'));
try{
fs.writeFileSync(`${tmp}/entry.js`,`export * from '${path.resolve('src/custodyPhone.js')}';export {declarationError} from '${path.resolve('src/custodyDeclare.js')}';export {replacementRow,baselineLines} from '${path.resolve('src/custodyLifecycle.js')}';export {catalogForItem} from '${path.resolve('src/custodyCatalog.js')}';`);
execSync(`npx esbuild ${tmp}/entry.js --bundle --format=esm --platform=node --outfile=${tmp}/t.mjs --log-level=error`,{stdio:'inherit'});
const P=await import(`${tmp}/t.mjs`);

const GOOD='490154203237518',BAD='490154203237519';
// ── IMEI ──
ok('IMEI صحيح يجتاز Luhn، وتغيير آخر رقم يُفشله',P.imeiOk(GOOD)&&!P.imeiOk(BAD));
ok('الأرقام العربية والبنغالية والمسافات والشرطات تُوحَّد',P.imeiDigits('٤٩٠١٥٤ ٢٠٣-٢٣٧٥١٨')===GOOD&&P.imeiOk('৪৯০১৫৪২০৩২৩৭৫১৮')&&P.imeiOk('49-0154 2032 37518'));
ok('14 أو 16 رقماً أو حروف ⇒ غير صحيح',!P.imeiOk('49015420323751')&&!P.imeiOk('4901542032375180')&&!P.imeiOk('49015420323751a')&&!P.imeiOk('')&&!P.imeiOk(null));
const s0=P.imeiStatus(''),s1=P.imeiStatus('4901'),s2=P.imeiStatus(GOOD),s3=P.imeiStatus(BAD),s4=P.imeiStatus('49015420323751x'),s5=P.imeiStatus('4901542032375180');
ok('الحالة أثناء الكتابة: فارغ ثم «4 من 15» ثم صحيح',s0.state==='empty'&&s1.state==='typing'&&s1.ar==='4 من 15 رقماً'&&s1.bn==='15 এর মধ্যে 4'&&s2.state==='ok');
ok('15 رقماً بمجموع خاطئ ⇒ «الرقم غير صحيح» مع تلميح *#06# بلغتين',s3.state==='bad'&&/غير صحيح/.test(s3.ar)&&/\*#06#/.test(s3.ar)&&/সঠিক নয়/.test(s3.bn)&&/\*#06#/.test(s3.bn));
ok('حرف أو 16 رقماً ⇒ خطأ فوري',s4.state==='bad'&&/أرقام فقط/.test(s4.ar)&&s5.state==='bad'&&/الآن 16/.test(s5.ar));
ok('خطأ الإرسال: فارغ ⇒ إلزامي، ناقص ⇒ 15 رقماً، صحيح ⇒ لا خطأ',/إلزامي/.test(P.imeiError('').ar)&&/الآن 4/.test(P.imeiError('4901').ar)&&P.imeiError(GOOD)===null);
ok('الرسائل بأرقام إنجليزية فقط',[s1,s3,s5,P.imeiError('4901')].every(x=>!/[٠-٩০-৯]/.test(x.ar+x.bn)));

// ── الخط والماركة ──
ok('الخط اختياري: فارغ مقبول، +966 5x مقبول، 6 أرقام مرفوضة',P.simError('')===null&&P.simError('+966 55 123 4567')===null&&P.simDigits('+966 55 123 4567')==='966551234567'&&!!P.simError('123456'));
ok('الماركة 2–60 حرفاً',!!P.brandError('')&&!!P.brandError('A')&&P.brandError('Samsung A15')===null&&!!P.brandError('x'.repeat(61)));

// ── أخطاء الإقرار بالترتيب ──
const ph=(o={})=>({...P.blankPhone(),imei:GOOD,brand_model:'Samsung A15',imeiPhoto:{},...o});
ok('جوال كامل ⇒ لا خطأ',P.phoneError(ph())===null);
ok('الترتيب: IMEI ثم صورة شاشته ثم الماركة ثم الخط',P.phoneError(ph({imei:BAD,imeiPhoto:null})).field==='imei'&&P.phoneError(ph({imeiPhoto:null,brand_model:''})).field==='imei_photo'
  &&P.phoneError(ph({brand_model:'',sim:'1'})).field==='brand'&&P.phoneError(ph({sim:'123'})).field==='sim');
const it={key:'phone',ar:'الجوال',bn:'মোবাইল ফোন'};
const de1=P.declarationError([it],{phone:{photo:null,condition:'good',phone:ph()}});
const de2=P.declarationError([it],{phone:{photo:{},condition:'good',phone:ph({imei:'123'})}});
const de3=P.declarationError([{key:'helmet',ar:'الخوذة'}],{helmet:{photo:{},condition:'good'}});
ok('إقرار العهدة: صورة الجهاز أولاً، ثم IMEI بخطأ بلغتين، والأصناف الأخرى بلا فحص جوال',de1.field==='photo'&&de2.field==='imei'&&de2.key==='phone'&&!!de2.bn&&de3===null);

// ── الحفظ ──
const item=P.phoneItem({brand_model:' Samsung A15 ',imei:'٤٩٠١٥٤ ٢٠٣ ٢٣٧ ٥١٨',sim:'+966 55 123 4567',acc:{charger:true,case:true}},'u/imei.jpg');
ok('صنف الإقرار: IMEI والخط لاتينيان، والملحقات منطقية، ورابط صورة الشاشة',item.imei===GOOD&&item.sim==='966551234567'&&item.brand_model==='Samsung A15'
  &&item.acc.charger===true&&item.acc.holder===false&&item.acc.case===true&&item.imei_photo==='u/imei.jpg');
ok('specs للقطعة: نفس القائمة البيضاء (بلا IMEI ولا صورة)',JSON.stringify(P.phoneSpecs({brand_model:'Samsung A15',sim:'',acc:{holder:true},imei:GOOD}))==='{"brand_model":"Samsung A15","acc":{"charger":false,"holder":true,"case":false}}');
const old={id:'a1',operator_id:'o',employee_id:'e',biker_name:'Midul',sweater_id:'1648',item_type:'device',category:'أجهزة',name:'الجوال',name_en:'Mobile Phone',life_months:24,lead_days:45,serial_no:GOOD};
const nw=P.replacementRow(old,'2026-10-14',{serial_no:'356938035643809',specs:{brand_model:'Redmi 13'}});
ok('بديل الجوال: IMEI الجديد ومواصفاته، 24 شهراً تبدأ اليوم',nw.serial_no==='356938035643809'&&nw.specs.brand_model==='Redmi 13'&&nw.start_date==='2026-10-14'&&nw.end_date==='2028-10-14'&&nw.status==='active'&&nw.item_type==='device');
ok('بديل غير الجوال بلا تغيير (لا serial_no)',!('serial_no' in P.replacementRow({...old,item_type:'tool',name:'المكنسة'},'2026-10-14')));

// ── الكتالوج والاعتماد ──
const c=P.catalogForItem('phone');
ok('الكتالوج: الجوال device · أجهزة · 24 شهراً · مهلة 45 يوماً',c&&c.type==='device'&&c.category==='أجهزة'&&c.life===24&&c.lead===45);
const {lines}=P.baselineLines([{key:'phone',condition:'good',phone:item}],[],'2026-10-14');
ok('سطر اعتماد الجوال item_type = device (تنسخ الدالة IMEI منه)',lines.length===1&&lines[0].item_type==='device'&&lines[0].item_keys[0]==='phone');

// ── العرض ورسائل القاعدة ──
ok('العرض: آخر 4 أرقام فقط',P.maskImei(GOOD)==='…7518'&&P.maskImei('')==='');
ok('الملحقات بلغتين',P.accLabels({charger:true,case:true}).join()==='شاحن,كفر'&&P.accLabels({holder:true},'bn').join()==='হোল্ডার'&&P.accLabels(null).length===0);
ok('رسائل القاعدة مترجمة: مكرر، غير مطابق، غير صحيح، والقيد',/مسجّل لجهاز نشط آخر/.test(P.imeiServerError('IMEI_DUPLICATE: هذا'))&&/لا يطابق/.test(P.imeiServerError('IMEI_MISMATCH: x'))
  &&/غير صحيح/.test(P.imeiServerError('violates check constraint "custody_assets_device_imei_ck"'))&&/مسجّل/.test(P.imeiServerError('duplicate key value violates unique constraint "custody_assets_active_device_serial"'))&&P.imeiServerError('other')===null);

// ── مطابقة القاعدة (Postgres محلي) ──
const port=process.env.PGTEST_PORT;
if(!port)console.log('- مطابقة القاعدة: skipped (PGTEST_PORT غير محدد)');
else{
  const db='cph_test_'+process.pid;
  const ps=(sql,d=db)=>execFileSync('psql',['-U','postgres','-h','/var/run/postgresql','-p',port,'-d',d,'-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8'}).trim();
  ps(`create database ${db}`,'postgres');
  try{
    const sql=fs.readFileSync('docs/sql/custody_phone.sql','utf8');
    const fn=n=>{const i=sql.indexOf(`create or replace function public.${n}(`);return sql.slice(i,sql.indexOf('$$;',sql.indexOf('$$',i)+2)+3);};
    ps(fn('_imei_digits')+'\n'+fn('_imei_ok'));
    // عيّنة: 15 رقماً عشوائياً (≈10% صحيحة) + كل تبديل لآخر رقم في رقمين صحيحين + حالات الحدود والأرقام غير اللاتينية
    let seed=7;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
    const sample=[...Array(400)].map(()=>[...Array(15)].map(()=>Math.floor(rnd()*10)).join(''));
    for(const b of ['49015420323751','35693803564380'])for(let d=0;d<10;d++)sample.push(b+d);
    sample.push('','4901','4901542032375180','49015420323751a','٤٩٠١٥٤٢٠٣٢٣٧٥١٨','৪৯০১৫৪২০৩২৩৭৫১৮','490154 203-237518');
    const lit=sample.map(x=>`('${x}')`).join(',');
    const rows=ps(`select coalesce(public._imei_ok(public._imei_digits(v)),false)::text||'|'||coalesce(public._imei_digits(v),'') from (values ${lit}) t(v)`).split('\n');
    const mism=sample.filter((x,i)=>{const[okDb,dg]=rows[i].split('|');return (okDb==='true')!==P.imeiOk(x)||dg!==P.imeiDigits(x);});
    ok(`الواجهة تطابق القاعدة في ${sample.length} رقماً (الصحيح ${sample.filter(P.imeiOk).length})`,rows.length===sample.length&&mism.length===0);
    if(mism.length)console.log('  اختلاف:',mism.slice(0,5));
  }finally{ps(`drop database ${db}`,'postgres');}
}
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
