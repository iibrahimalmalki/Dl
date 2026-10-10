// إقرار العهدة: الصورة الإلزامية، والملاحظة الإلزامية مع الحالة السيئة/التالفة، وبيانات طلب الاستبدال (src/custodyDeclare.js)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.cd-test-'));
try{
execSync(`npx esbuild src/custodyDeclare.js --bundle --format=esm --platform=node --outfile=${tmp}/t.mjs --log-level=error`,{stdio:'inherit'});
const D=await import(`${tmp}/t.mjs`);
const V={key:'vacuum',ar:'المكنسة الكهربائية',bn:'ভ্যাকুয়াম ক্লিনার'},G={key:'glass_cleaner',ar:'منظّف الزجاج',bn:'গ্লাস ক্লিনার'};
const photo={name:'a.jpg'};

// الصورة الإلزامية
let e=D.declarationError([V],{vacuum:{condition:'good'}});
ok('صنف بلا صورة ⇒ خطأ صورة على الصنف نفسه بالعربي والبنغالي',e&&e.field==='photo'&&e.key==='vacuum'&&/المكنسة/.test(e.ar)&&/ছবি/.test(e.bn));
ok('صنف بصورة وحالة جيدة بلا ملاحظة ⇒ مقبول',D.declarationError([V],{vacuum:{photo,condition:'good'}})===null);
ok('متوسطة بلا ملاحظة ⇒ مقبول (الملاحظة اختيارية)',D.declarationError([V],{vacuum:{photo,condition:'fair'}})===null);
e=D.declarationError([V,G],{vacuum:{photo,condition:'good'},glass_cleaner:{condition:'good'}});
ok('يوجّه إلى أول صنف ناقص الصورة (الثاني)',e.key==='glass_cleaner'&&e.field==='photo');

// الملاحظة الإلزامية مع السيئة/التالفة
for(const c of ['poor','damaged']){
  e=D.declarationError([V],{vacuum:{photo,condition:c,note:'  '}});
  ok(`${c} بملاحظة فارغة/مسافات ⇒ خطأ ملاحظة بالعربي والبنغالي`,e&&e.field==='note'&&e.key==='vacuum'&&/وش التالف/.test(e.ar)&&/নষ্ট/.test(e.bn));
  ok(`${c} بملاحظة ⇒ مقبول`,D.declarationError([V],{vacuum:{photo,condition:c,note:'رأس البخاخ مكسور'}})===null);
}
ok('الصورة تُفحص قبل الملاحظة',D.declarationError([V],{vacuum:{condition:'damaged'}}).field==='photo');
ok('isBad: سيئة وتالفة فقط',D.isBad('poor')&&D.isBad('damaged')&&!D.isBad('fair')&&!D.isBad('good')&&!D.isBad(undefined));
ok('بلا أصناف ⇒ لا خطأ (فحص «حدّد عنصراً» منفصل)',D.declarationError([],{})===null);

// صنف الإقرار المحفوظ
const it=D.declarationItem(V,{qty:'2',condition:'damaged',note:'  السلك مقطوع '},'https://x/p.jpg');
ok('items[].note مقصوصة + الكمية رقم + الصورة',it.note==='السلك مقطوع'&&it.qty===2&&it.photo==='https://x/p.jpg'&&it.condition==='damaged'&&it.name_ar==='المكنسة الكهربائية');
ok('ملاحظة فارغة ⇒ null',D.declarationItem(V,{condition:'good',note:' '},'u').note===null&&D.declarationItem(V,{qty:'',condition:'good'},'u').qty===1);

// طلب الاستبدال (المرجع يضيفه المشغّل في القاعدة)
const items=[{key:'vacuum',name_ar:'المكنسة',condition:'damaged',replace_ref:'DW-1648-20261010-A1234',replace_request_id:'r1'},
  {key:'glass',name_ar:'منظّف الزجاج',condition:'poor'},{key:'towel',name_ar:'مناشف',condition:'good'}];
const rp=D.replacementsOf(items);
ok('الأصناف السيئة/التالفة فقط تحتاج استبدالاً (2 من 3)',rp.length===2&&rp.map(x=>x.key).join()==='vacuum,glass');
ok('الرابط بالطلب: المرجع والمعرّف، والناقص null (المشغّل غير مطبّق)',rp[0].ref==='DW-1648-20261010-A1234'&&rp[0].requestId==='r1'&&rp[1].ref===null);
ok('items غير مصفوفة ⇒ لا شيء',D.replacementsOf(null).length===0);

// صفحة المالك: تجميع حسب البايكر، الأحدث أولاً
const g=D.groupByBiker([{biker_employee_id:'1648',biker_name:'Midul',created_at:'2026-10-01'},{biker_employee_id:'1700',biker_name:'Rakib',created_at:'2026-10-05'},{biker_employee_id:'1648',biker_name:'Midul',created_at:'2026-10-09'}]);
ok('تجميع: ميدول أولاً (أحدث إقرار 09/10) وإقراراه الأحدث فالأقدم',g.length===2&&g[0].biker_employee_id==='1648'&&g[0].rows.length===2&&g[0].rows[0].created_at==='2026-10-09');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
