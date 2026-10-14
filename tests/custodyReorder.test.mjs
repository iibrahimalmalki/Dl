// «طلب سويتر» من صفحة العُهد: طلب واحد لعدة قطع لبايكر واحد، وأعمدة الإرجاع من supply_requests (src/custodyReorder.js)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.cr-test-'));
try{
fs.writeFileSync(`${tmp}/entry.js`,`export * from '${path.resolve('src/custodyReorder.js')}';`);
execSync(`npx esbuild ${tmp}/entry.js --bundle --format=esm --platform=node --outfile=${tmp}/t.mjs --log-level=error`,{stdio:'inherit'});
const R=await import(`${tmp}/t.mjs`);

// أعمدة supply_requests في الإنتاج (2026-10-14) — الإرجاع بعد الإدراج منها فقط
const SR_COLS=['id','seq','ref','operator_id','round_id','biker_name','sweater_id','requesting_dept','items','status','sla_hours','created_at','escalated_at','completed_at','completion_note','notes','created_by'];
ok('أعمدة الإرجاع بعد إنشاء الطلب من supply_requests فقط (لا category ولا أعمدة العهد)',R.SR_RET.split(',').every(c=>SR_COLS.includes(c))&&R.SR_RET.includes('id')&&R.SR_RET.includes('ref'));
const page=fs.readFileSync('src/Custody.jsx','utf8');
const ins=page.match(/from\("supply_requests"\)\.insert\([^)]*\)\.select\(([^)]*)\)/g)||[];
ok('صفحة العهد: كل إدراج في supply_requests يُرجع SR_RET لا CA_COLS',ins.length>0&&ins.every(x=>/\.select\(SR_RET\)$/.test(x)));

const EA='e-ariful',EM='e-midul';
const A=(id,name,item_type,status='active',x={})=>({id,employee_id:EA,sweater_id:'1624',biker_name:'Ariful Islam',operator_id:'op1',name,name_en:name+'-en',item_type,category:'cat',status,start_date:'2026-01-01',round_id:'r-old',reorder_request_id:null,...x});
const soap=A('a1','صابون/شامبو','cleaning','due'),chest=A('a2','الصدرية (واقي الصدر)','safety','due'),towel=A('a3','مناشف ميكروفايبر (4 ألوان)','towel'),
  helm=A('a4','الخوذة','safety','missing'),bike=A('a5','الدراجة النارية','motorcycle','due'),phone=A('a6','الجوال','device'),
  linked=A('a7','مزيل البقع','cleaning','due',{reorder_request_id:'q-open'}),renewed=A('a8','ملمّع الإطارات','cleaning','active',{reorder_request_id:'q-done'}),
  gone=A('a9','الزي الرسمي','uniform','replaced'),mid=A('m1','صابون/شامبو','cleaning','due',{employee_id:EM,sweater_id:'1648',biker_name:'Midul Hassan'});
const reqs={'q-open':'open','q-done':'completed'};

ok('قابلة للطلب: المستحقة والنشطة والناقصة',[soap,chest,towel,helm].every(a=>R.reorderable(a,reqs)));
ok('غير قابلة: الدراجة والجوال والمُستبدلة',[bike,phone,gone].every(a=>!R.reorderable(a,reqs)));
ok('مربوطة بطلب مفتوح ⇒ لا تُطلب مرة ثانية · مربوطة بطلب مكتمل ⇒ تُطلب',!R.reorderable(linked,reqs)&&R.openLink(linked,reqs)&&R.reorderable(renewed,reqs)&&!R.openLink(renewed,reqs));
ok('طلب مربوط غير معروف الحالة يُعدّ مفتوحاً (احتياط من التكرار)',!R.reorderable(A('x','x','cleaning','due',{reorder_request_id:'q-unknown'}),reqs));

const d=new Date(2026,9,14);
const P=R.reorderPlan([soap,chest,towel,helm],{opId:'all',reqs,date:d,rnd:0.5});
ok('طلب واحد يجمع 4 قطع: سطر لكل قطعة باسمها',!P.error&&P.row.items.length===4&&P.row.items.map(i=>i.ar).join('|')===[soap,chest,towel,helm].map(a=>a.name).join('|'));
ok('رقم الطلب برقم البايكر والتاريخ',P.ref==='DW-1624-20261014-C5500'&&P.row.ref===P.ref);
ok('صف الطلب: البايكر والمشغّل وجهة الطلب، وبلا round_id',P.row.sweater_id==='1624'&&P.row.biker_name==='Ariful Islam'&&P.row.operator_id==='op1'&&P.row.round_id===null&&P.row.requesting_dept==='التشغيل — دلو ورغوة');
ok('أعمدة صف الإدراج كلها في supply_requests',Object.keys(P.row).every(c=>SR_COLS.includes(c)));
ok('المستهلك «إعادة طلب» والمعمّر «استبدال»، والناقصة بملاحظتها',P.row.items[0].status==='reorder'&&P.row.items[1].status==='replace'&&P.row.items[2].status==='reorder'&&/ناقصة/.test(P.row.items[3].note)&&P.row.items.every(i=>i.n===null));
ok('الربط: 3 تصبح «مستحقة» والناقصة تُربط فقط (تبقى بلا عدّاد)',P.link.join()==='a1,a2,a3'&&P.keepMissing.join()==='a4');
ok('المشغّل من الفلتر حين تخلو القطعة منه',R.reorderPlan([{...soap,operator_id:null}],{opId:'op9',date:d,rnd:0}).row.operator_id==='op9'&&R.reorderPlan([{...soap,operator_id:null}],{opId:'all',date:d,rnd:0}).row.operator_id===null);
ok('قطعة واحدة (زر البطاقة) ⇒ طلب بسطر واحد',R.reorderPlan([soap],{reqs,date:d,rnd:0}).row.items.length===1);
ok('بايكران في التحديد ⇒ رفض',/بايكر واحد/.test(R.reorderPlan([soap,mid],{reqs}).error||''));
ok('تحديد فارغ أو مكرّر ⇒ رفض',!!R.reorderPlan([],{}).error&&/مكرّرة/.test(R.reorderPlan([soap,soap],{reqs}).error||''));
ok('قطعة مربوطة بطلب مفتوح ضمن التحديد ⇒ رفض باسمها',/مزيل البقع.*مفتوح/.test(R.reorderPlan([soap,linked],{reqs}).error||''));
ok('الدراجة/الجوال ضمن التحديد ⇒ رفض',!!R.reorderPlan([soap,bike],{reqs}).error&&!!R.reorderPlan([phone],{reqs}).error);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
