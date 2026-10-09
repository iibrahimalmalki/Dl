// صفحة «المستخدمون»: الجوال المقروء، وآخر دخول، والدور، والفلترة، وشروط الحذف (src/usersLib.js)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.ul-test-'));
try{
execSync(`npx esbuild src/usersLib.js --bundle --format=esm --platform=node --outfile=${tmp}/t.mjs --log-level=error`,{stdio:'inherit'});
const U=await import(`${tmp}/t.mjs`);

// الجوال
ok('من اسم المستخدم التقني 966… ← 053 223 3373',U.phoneOf({email:'966532233373@dalu.team'})==='053 223 3373');
ok('حقل mobile مقدَّم على البريد',U.phoneOf({mobile:'966549971295',email:'966532233373@dalu.team'})==='054 997 1295');
ok('رقم بنغلاديشي',U.phoneOf({mobile:'8801712345678'})==='+880 1712 345678');
ok('بريد عادي بلا جوال ⇒ فارغ',U.phoneOf({email:'abo.malk.03@gmail.com'})==='');
ok('البريد التقني يُخفى، والعادي يظهر',U.isTechEmail('966532233373@dalu.team')&&U.isTechEmail('dwk2x9@dalu.team')&&!U.isTechEmail('abo.malk.03@gmail.com'));

// الدور
ok('المالك',U.roleLabel({is_owner:true}).startsWith('المالك'));
ok('البايكر برقمه',U.roleLabel({biker_employee_id:'1624'})==='بايكر · رقم 1624');
ok('المنصب من الهيكل التنظيمي',U.roleLabel({position:'field_sup'})==='المشرف الميداني');
ok('إداري بلا منصب',U.roleLabel({position:null}).includes('بلا منصب'));

// الصلاحيات
const ps=U.permSummary([{user_id:'a',can_edit:true},{user_id:'a',can_edit:false},{user_id:'a',can_edit:true},{user_id:'b',can_edit:false}]);
ok('ملخص: a تعديل 2 عرض 1',ps.a.edit===2&&ps.a.view===1&&U.permText(ps.a)==='تعديل 2 · عرض 1 وحدات');
ok('بلا صلاحيات',U.permText(undefined)==='بلا صلاحيات'&&U.permText(ps.b)==='عرض 1 وحدات');

// آخر دخول
const now=Date.parse('2026-10-09T12:00:00Z');
ok('undefined ⇒ غير متاح (null)',U.lastSeen(undefined,now)===null);
ok('null ⇒ لم يدخل بعد',U.lastSeen(null,now).t==='لم يدخل بعد'&&U.lastSeen(null,now).tone==='warn');
ok('قبل 30 دقيقة',U.lastSeen('2026-10-09T11:30:00Z',now).t==='آخر دخول قبل 30 دقيقة');
ok('قبل 5 ساعات',U.lastSeen('2026-10-09T07:00:00Z',now).t==='آخر دخول قبل 5 ساعة');
ok('أمس',U.lastSeen('2026-10-08T09:00:00Z',now).t==='آخر دخول أمس');
ok('أكثر من أسبوع ⇒ تنبيه',U.lastSeen('2026-09-20T09:00:00Z',now).tone==='warn');

// الفلترة
const users=[{id:'o',is_owner:true,active:true,display_name:'إبراهيم'},{id:'s',active:true,display_name:'سلمان',position:'field_sup',email:'966532233373@dalu.team'},
  {id:'b1',active:true,display_name:'Ariful Islam',biker_employee_id:'1624'},{id:'b2',active:false,display_name:'Abed mia',biker_employee_id:'2637651411'}];
const act={o:'2026-10-09T10:00:00Z',s:'2026-10-08T10:00:00Z',b1:null,b2:'2026-10-04T03:00:00Z'};
const ids=a=>a.map(x=>x.id).join(',');
ok('الكل',ids(U.filterUsers(users,'all','',act))==='o,s,b1,b2');
ok('الإدارة تشمل المالك',ids(U.filterUsers(users,'admin','',act))==='o,s');
ok('البايكرز',ids(U.filterUsers(users,'biker','',act))==='b1,b2');
ok('لم يدخل بعد',ids(U.filterUsers(users,'never','',act))==='b1');
ok('«لم يدخل بعد» فارغ حين لا تتوفر البيانات',U.filterUsers(users,'never','',null).length===0);
ok('الموقوفون',ids(U.filterUsers(users,'off','',act))==='b2');
ok('بحث بالاسم بلا حساسية حالة',ids(U.filterUsers(users,'all','ariful',act))==='b1');
ok('بحث بالجوال المحلي',ids(U.filterUsers(users,'all','0532233',act))==='s');
ok('بحث برقم البايكر',ids(U.filterUsers(users,'all','2637',act))==='b2');
ok('بحث بالدور',ids(U.filterUsers(users,'all','المشرف',act))==='s');
const c=U.counts(users,act);
ok('العدّادات',c.all===4&&c.admin===2&&c.biker===2&&c.never===1&&c.off===1);

// الحذف
ok('حساب لم يدخل قط ⇒ يُحذف',U.canHardDelete(users[2],act));
ok('حساب دخل من قبل ⇒ لا يُحذف',!U.canHardDelete(users[1],act));
ok('المالك لا يُحذف',!U.canHardDelete(users[0],null));
ok('بلا بيانات الدخول ⇒ مسموح مع تأكيد الاسم',U.canHardDelete(users[1],null));
ok('تأكيد الاسم: مطابق مع مسافات وحالة أحرف',U.confirmName(users[2],'  ariful   islam '));
ok('تأكيد الاسم: فارغ أو مختلف مرفوض',!U.confirmName(users[2],'')&&!U.confirmName(users[2],'Ariful'));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
