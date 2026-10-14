// ربط الجولة بالعهد (src/custodyRound.js): جرد العهدة، والاستخراج من جولة، والتجديد بتسليم الإمداد
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
// الملف يستورد custodyCatalog بلا امتداد (أسلوب Vite) ⇒ يُحزَم أولاً كاختبار custodyLifecycle
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.cr-test-'));
let M;
try{
  fs.writeFileSync(`${tmp}/entry.js`,`export * from '${path.resolve('src/custodyRound.js')}';export {ITEMS} from '${path.resolve('src/fieldChecklist.js')}';`);
  execSync(`npx esbuild ${tmp}/entry.js --bundle --format=esm --platform=node --outfile=${tmp}/t.mjs --log-level=error`,{stdio:'inherit'});
  M=await import(`${tmp}/t.mjs`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
const{ITEMS,CONDS,isDurable,checkable,editable,imeiMatch,lineError,checkError,checkArgs,allOkPatch,linesFromRound,checkSummary,extractPlan,extractRows,renewKeys,renewTargets}=M;
const E='e-midul',X='e-other',IMEI='490154203237518';
const A=(id,name,item_type,status='active',extra={})=>({id,employee_id:E,name,item_type,status,...extra});
const bike=A('b','الدراجة النارية','motorcycle'),phone=A('p','الجوال','device','active',{serial_no:IMEI}),box=A('x','صندوق الخدمة','tool'),helm=A('h','الخوذة','safety'),
  chest=A('c','الصدرية (واقي الصدر)','safety'),towel=A('t','مناشف ميكروفايبر (4 ألوان)','towel','due'),soap=A('s','صابون/شامبو','cleaning');
const all=[towel,soap,bike,phone,box,helm,chest,A('o','الخوذة','safety','replaced'),A('m','حذاء السلامة','safety','missing'),{...soap,id:'z',employee_id:X}];

ok('الحالات الثلاث بالعربي',CONDS.map(c=>c.v+':'+c.ar).join()==='ok:سليمة,damaged:تالفة,lost:مفقودة');
ok('المعمّرة: الدراجة والجوال والصندوق والخوذة فقط',[bike,phone,box,helm].every(isDurable)&&![chest,towel,soap].some(isDurable));
const C=checkable(all,E);
ok('القابلة للجرد: النشطة والمستحقة لنفس البايكر (لا المُستبدلة ولا الناقصة ولا بايكر آخر)، والمعمّرة أولاً',C.length===7&&C.slice(0,4).every(isDurable)&&!C.some(a=>['o','m','z'].includes(a.id)));
ok('IMEI بـ17 خانة (IMEI/SV) ⇒ تُقارن أول 15 خانة فقط',imeiMatch(IMEI+'01',IMEI)===true&&imeiMatch('35693803564380901',IMEI)===false);
ok('IMEI: فارغ ⇒ null، مطابق بمسافات وأرقام بنغالية ⇒ true، مختلف ⇒ false',imeiMatch('',IMEI)===null&&imeiMatch('4901 5420 3237 518',IMEI)===true&&imeiMatch('৪৯০১৫৪২০৩২৩৭৫১৮',IMEI)===true&&imeiMatch('356938035643809',IMEI)===false);

ok('بلا حالة ⇒ «اختر حالة»',/اختر حالة «الصدرية/.test(lineError({},chest)));
ok('تالفة/مفقودة بلا ملاحظة ⇒ خطأ',/ملاحظة/.test(lineError({condition:'damaged'},soap))&&/ملاحظة/.test(lineError({condition:'lost',note:' '},bike)));
ok('المعمّرة بلا صورة ⇒ خطأ، والمفقودة بلا صورة مقبولة',/صورة «الدراجة/.test(lineError({condition:'ok'},bike))&&lineError({condition:'lost',note:'سُرقت'},bike)===null);
ok('الجوال بلا IMEI ⇒ خطأ، ومعه صورة ورقم ⇒ مقبول ولو غير مطابق (القرار للمالك)',/IMEI/.test(lineError({condition:'ok',photo:'p'},phone))&&lineError({condition:'ok',photo:'p',imei:'356938035643809'},phone)===null);
ok('غير المعمّرة «سليمة» بلا صورة مقبولة',lineError({condition:'ok'},chest)===null);
const lines={b:{condition:'ok',photo:'b.jpg'},p:{condition:'lost',note:'ضاع',photo:'old',imei:IMEI},x:{condition:'damaged',note:'القفل',photo:'x.jpg'},h:{condition:'ok',photo:'h.jpg'}};
ok('كل القطع يجب أن تُجرد ⇒ أول قطعة ناقصة',/«الصدرية/.test(checkError(lines,C))||/«صابون/.test(checkError(lines,C))||/«مناشف/.test(checkError(lines,C)));
const P=allOkPatch(lines,C);
ok('«الكل سليم» لغير المعمّرة غير المجرودة فقط',Object.keys(P).sort().join()==='c,s,t'&&Object.values(P).every(l=>l.condition==='ok'));
const full={...lines,...P};
ok('بعد «الكل سليم» لا أخطاء',checkError(full,C)===null);
const args=checkArgs(full,C);
ok('الوسائط: سطر لكل قطعة، والمفقودة بلا صورة ولا IMEI، والملاحظة مقصوصة',args.length===7&&args.find(a=>a.asset_id==='p').photo===null&&args.find(a=>a.asset_id==='p').imei===null&&args.find(a=>a.asset_id==='x').note==='القفل'&&args.find(a=>a.asset_id==='b').photo==='b.jpg');
const saved=[{asset_id:'b',condition:'ok',photo:'b.jpg'},{asset_id:'p',condition:'ok',photo:'p.jpg',imei_ok:false,imei_last4:'3809'},{asset_id:'x',condition:'damaged',note:'القفل'},{asset_id:'s',condition:'lost',note:'لا يوجد'}];
ok('تعديل جولة: الأسطر المحفوظة تعود للنموذج والـIMEI يُعاد إدخاله',linesFromRound(saved).x.note==='القفل'&&linesFromRound(saved).p.imei===''&&linesFromRound(null)&&Object.keys(linesFromRound(null)).length===0);
ok('تعديل الجولة: الجوال بلا رقم جديد مقبول بنتيجة المطابقة المحفوظة (imeiPrev)',linesFromRound(saved).p.imeiPrev===false&&lineError({...linesFromRound(saved).p,photo:'p.jpg'},phone)===null&&linesFromRound(saved).b.imeiPrev===null);
ok('تعديل الجولة: تُجرد فقط القطع التي جُردت فيها، والجولة بلا جرد ⇒ لا شيء',editable(C,saved).map(a=>a.id).sort().join()==='b,p,s,x'&&editable(C,[]).length===0&&editable(C,null).length===0);
const S=checkSummary(saved);
ok('ملخص البطاقة: 2 سليمة، 1 تالفة، 1 مفقودة، 1 IMEI غير مطابق',S.ok===2&&S.damaged===1&&S.lost===1&&S.imeiBad===1);

// ── الاستخراج من جولة: جولة رقيب 2026-08-05 الحقيقية ──
const rakib={id:'r1',sweater_id:'1700',biker_name:'Mohamad Rakib',round_date:'2026-08-05',
  results:{1:'pass',2:'half',3:'half',4:'fail',5:'pass',6:'pass',7:'excused',8:'excused',9:'half',10:'half',11:'pass',12:'fail',13:'pass',14:'pass'},
  item_parts:{7:['القميص/الجاكيت','البنطال'],9:['الكاب','اللبس الرسمي'],10:['الخوذة'],12:['ملمّع الدَّشبورد','ملمّع الإطارات','اللمسة الأخيرة (Last Touch)','منظّف الزجاج','صابون/شامبو','مزيل البقع']}};
const R=extractPlan(rakib);
ok('رقيب 08/05: الخوذة والزي ومواد التنظيف الست ⇒ ناقصة',R.missing.join()==='uniform,helmet,dash,tyrepol,stain,lasttouch,glass,soap');
ok('رقيب 08/05: الدراجة والصندوق (فُحصا) والصدرية وواقي اليدين وحذاء السلامة ⇒ متوفّرة',R.available.join()==='moto,chest,handsleg,shoes,servicebox');
ok('غير المسجّل في الجولة لا يُضاف (المكنسة، المسدس، الموتور، الكشاف، الخزان، الفرش، الإسفنج، المناشف)، والجوال خارج الاستخراج',R.unknown.join()==='vacuum,watergun,watermotor,headlight,watertank,brushes,sponge,towels'&&![...R.available,...R.missing,...R.unknown].includes('phone'));
const midul={id:'r2',sweater_id:'1648',round_date:'2026-10-03',results:{1:'pass',2:'pass',7:'pass',9:'pass',10:'pass',12:'pass',15:'fail'},item_parts:{}};
ok('بنود «متوفّر» كلها ⇒ لا ناقص، والصندوق رغم «ناقص» حالته موجود',extractPlan(midul).missing.length===0&&extractPlan(midul).available.includes('servicebox'));
ok('بند ناقص بلا أجزاء محدّدة ⇒ كل أصنافه ناقصة',extractPlan({results:{10:'fail'},item_parts:{}}).missing.join()==='helmet,chest,handsleg,shoes');
ok('الزي: «متوفّر» في 7 و«اللبس الرسمي» ناقص في 9 ⇒ ناقص (الناقص يغلب)',extractPlan({results:{7:'pass',9:'half'},item_parts:{9:['اللبس الرسمي']}}).missing.join()==='uniform');
ok('الكاب وحده ناقص في 9 ⇒ الزي متوفّر (الكاب ليس صنف عهدة)',extractPlan({results:{7:'pass',9:'half'},item_parts:{9:['الكاب']}}).available.includes('uniform'));
const X1=extractRows(rakib,[A('q','الخوذة','safety','missing',{employee_id:'e-rakib'}),A('w','الدراجة النارية','motorcycle','active')],{operator_id:'op',employee_id:'e-rakib'});
ok('الصفوف: المسجّل لا يتكرّر (الخوذة الناقصة، الدراجة النشطة)',X1.rows.length===11&&X1.skipped.join()==='moto,helmet'&&!X1.rows.some(r=>r.name==='الخوذة'||r.name==='الدراجة النارية'));
const g=X1.rows.find(r=>r.name==='الزي الرسمي'),c=X1.rows.find(r=>r.name==='الصدرية (واقي الصدر)');
ok('الناقص: status=missing بلا نهاية (لا عدّاد) والبداية = تاريخ الجولة للتوثيق',g.status==='missing'&&g.end_date===null&&g.start_date==='2026-08-05'&&g.round_id==='r1'&&g.employee_id==='e-rakib');
ok('المتوفّر: نشط بنهاية = الجولة + العمر',c.status==='active'&&c.end_date==='2028-08-05'&&c.source==='round'&&c.operator_id==='op');

// ── تسليم الإمداد ⇒ التجديد ──
const items=[{n:10,parts:['الخوذة']},{n:12,parts:['صابون/شامبو','مزيل البقع']},{n:9,parts:['الكاب']},{n:4,parts:[]},{n:15,parts:['إعادة دهان']}];
ok('مفاتيح التجديد: الخوذة والصابون ومزيل البقع فقط (الكاب والملصق والدهان لا)',renewKeys(items).join()==='helmet,stain,soap');
ok('«استبدال الصندوق» يجدّد الصندوق، وبند بلا أجزاء يجدّد كل أصنافه',renewKeys([{n:15,parts:['استبدال الصندوق']},{n:7,parts:[]}]).join()==='uniform,servicebox');
ok('سطر «طلب سويتر» من صفحة العهد (n=null + اسم الكتالوج)',renewKeys([{n:null,ar:'مناشف ميكروفايبر (4 ألوان)'}]).join()==='towels');
const T=renewTargets([...items,{n:null,ar:'الجوال'},{n:null,ar:'الدراجة النارية'}],[...all,A('g','الخوذة','safety','missing')],E);
ok('القطع المجدَّدة: نفس البايكر والصنف (نشطة/مستحقة/ناقصة)، لا المُستبدلة ولا بايكر آخر ولا الجوال/الدراجة',T.map(a=>a.id).sort().join()==='g,h,s');

// حارس: كل جزء في بنود التوفّر (7، 9، 10، 12) بلائحة الجولة له مقابل في الخريطة — أو ليس صنف عهدة صراحةً
const NOT_CUSTODY=['الكاب','الحذاء الأسود'];
const unknownParts=ITEMS.filter(i=>[7,9,10,12].includes(i.n)).flatMap(i=>(i.parts||[]).map(p=>({n:i.n,p:p.ar})))
  .filter(({n,p})=>!NOT_CUSTODY.includes(p)&&extractPlan({results:{[n]:'half'},item_parts:{[n]:[p]}}).missing.length!==1);
ok('كل أجزاء بنود التوفّر في لائحة الجولة معروفة للخريطة'+(unknownParts.length?' — '+unknownParts.map(x=>x.n+':'+x.p).join('، '):''),unknownParts.length===0);
ok('«استبدال الصندوق» نصّه في لائحة الجولة كما في الخريطة',ITEMS.find(i=>i.n===15).parts.some(p=>p.ar==='استبدال الصندوق'));
