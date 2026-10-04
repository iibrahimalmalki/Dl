// اختبار التحقق من نموذج تسليم/استلام الدراجة (src/handover.js)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.ho-test-'));
try{
execSync(`npx esbuild src/handover.js --bundle --format=esm --platform=node --outfile=${tmp}/h.mjs --log-level=error`,{stdio:'inherit'});
const H=await import(`${tmp}/h.mjs`);
const bike={front:1,back:1,right:1,left:1,odometer:1}, box={box_front:1,box_back:1,box_right:1,box_left:1,box_inside:1};
const yes={box:true,bike_key:true,box_key:true,bike_keys:1,box_keys:2,reasons:{}};
const good={odometer:'14230',photos:{...bike,...box},received:yes,pledge:true};
const V=f=>H.validateHandover(f);
ok('نموذج كامل ⇒ مقبول',V(good)===null);
ok('يُرفض بلا إجابة على أي من الثلاثة',['box','bike_key','box_key'].every(k=>/نعم أو لا/.test(V({...good,received:{...yes,[k]:null}})||'')));
ok('box = نعم بلا الصور الخمس ⇒ مرفوض',/صور الصندوق الخمس/.test(V({...good,photos:{...bike,box_front:1,box_back:1,box_right:1,box_left:1}})||''));
ok('box = لا مع سبب ⇒ مقبول بلا صور صندوق',V({...good,photos:bike,received:{...yes,box:false,reasons:{box:'لم يُسلَّم لي'}}})===null);
ok('«لا» بلا سبب ⇒ مرفوض',/سبب/.test(V({...good,received:{...yes,bike_key:false,reasons:{bike_key:'  '}}})||''));
ok('عدد المفاتيح خارج 0–3 ⇒ مرفوض',/من 0 إلى 3/.test(V({...good,received:{...yes,bike_keys:4}})||'')&&/من 0 إلى 3/.test(V({...good,received:{...yes,box_keys:-1}})||''));
ok('«نعم» مع عدد 0 ⇒ مرفوض',/لا يكون 0/.test(V({...good,received:{...yes,bike_keys:0}})||''));
ok('«لا» للمفتاح لا يشترط العدد',V({...good,received:{...yes,box_key:false,box_keys:0,reasons:{box_key:'مفقود'}}})===null);
ok('الشروط الحالية: العدّاد',/العدّاد/.test(V({...good,odometer:''})||''));
ok('الشروط الحالية: صور الدراجة الأربع',/الاتجاهات الأربعة/.test(V({...good,photos:{...box,front:1,back:1,right:1,odometer:1}})||''));
ok('الشروط الحالية: صورة العدّاد',/صورة العدّاد/.test(V({...good,photos:{...box,front:1,back:1,right:1,left:1}})||''));
ok('الشروط الحالية: التعهّد',/التعهّد/.test(V({...good,pledge:false})||''));
const ids=['engine','box','plate'],allc={engine:true,box:true,plate:true};
ok('items_ok صحيح عند كل شيء سليم ومستلَم',H.itemsOk(allc,yes,ids)===true);
ok('items_ok يصير false عند أي بند غير مستلَم',['box','bike_key','box_key'].every(k=>H.itemsOk(allc,{...yes,[k]:false},ids)===false));
ok('items_ok يصير false عند بند تحقق غير سليم',H.itemsOk({...allc,engine:false},yes,ids)===false);
const rec=H.receivedRecord({...yes,box_key:false,reasons:{box_key:' مفقود '}});
ok('السجل المحفوظ: العدد للمستلَم فقط والسبب لـ«لا» فقط',rec.box===true&&rec.bike_keys===1&&rec.box_keys===undefined&&rec.reasons.box_key==='مفقود'&&Object.keys(rec.reasons).length===1);
const old=H.handoverSummary({checklist:{engine:true,box:true}},ids), nw=H.handoverSummary({checklist:{engine:true,received:rec}},ids);
ok('سجل قديم بلا received ⇒ بلا تحذير ولا أخطاء',old.rec===null&&!old.warn);
ok('سجل فيه بند غير مستلَم ⇒ تحذير',nw.warn&&nw.missing.join()==='box_key');

// ── رسالة سويتر والتقرير ──
const REAL={created_at:'2026-10-04T03:09:09Z',direction:'receive',plate:'ح ب 8539',biker_name:'Abed mia',biker_employee_id:'2637651411',odometer:'24',
  checklist:{box:false,oil:false,horn:true,chain:true,plate:false,tires:true,brakes:true,engine:false,lights:true,mirrors:false,received:{box:false,box_key:false,reasons:{box:'ليست أصلية.',box_key:'لا يوجد مفتاح أو قفل'},bike_key:true,bike_keys:2}},condition_notes:'لا يمكن فتح خزان الزيت بالمفتاح.'};
const VEH={plate_en:'B J 8539',make:'بجاج (Bajaj)',model_year:2024,vin:'MD2A21BXXRWD46160'};
const msg=H.handoverSweaterMessage(REAL,VEH),[mAr,mEn]=msg.split('\n\n🏍️');
ok('رسالة سويتر بملاحظات: القسمان العربي والإنجليزي',msg.startsWith('🏍️ تقرير استلام دراجة')&&/Motorcycle handover report/.test(msg)&&/رقم الهيكل: MD2A21BXXRWD46160/.test(msg)&&/VIN: MD2A21BXXRWD46160/.test(msg));
ok('كل ملاحظة مرقّمة مع سببها في اللغتين + طلب المعالجة',/^7\. مفتاح الصندوق: لم يُستلم — لا يوجد مفتاح أو قفل$/m.test(mAr)&&/^7\. Box key: not received — لا يوجد مفتاح أو قفل$/m.test(mEn)&&/نرجو معالجة الملاحظات/.test(mAr)&&/Please resolve the above/.test(mEn));
ok('الوقت بتوقيت الرياض (03:09Z ⇒ 06:09 ص / AM)',/التاريخ: 04\/10\/2026 — الوقت: 06:09 ص/.test(msg)&&/Date: 04\/10\/2026 — Time: 06:09 AM/.test(msg));
const ex=H.handoverSweaterMessage(REAL,VEH,{exclude:['ck:plate']});
ok('الاستبعاد يحذف البند من اللغتين ويعيد الترقيم',!/اللوحة والاستمارة/.test(ex)&&!/Plate & registration/.test(ex)&&/^6\. مفتاح الصندوق/m.test(ex));
const clean={created_at:'2026-10-04T10:00:00Z',direction:'receive',plate:'ح ب 1',biker_name:'X',biker_employee_id:'1',odometer:5,checklist:{...Object.fromEntries(H.CHECKLIST.map(c=>[c.id,true])),received:{box:true,bike_key:true,bike_keys:1,box_key:true,box_keys:1,reasons:{}}}};
const cm=H.handoverSweaterMessage(clean,{});
ok('بلا ملاحظات ⇒ «بلا ملاحظات» وبلا طلب معالجة',/تم الاستلام بلا ملاحظات ✓/.test(cm)&&/Received with no issues ✓/.test(cm)&&!/نرجو|Please resolve/.test(cm));
ok('ملخص الملاحظات: بنود التحقق + المستلَمات «لا» (سجل عابد = 7)',H.handoverIssues(REAL).length===7);
const noteRow={...clean,checklist:{...clean.checklist,received:{box:true,box_note:'ليس أصلياً',bike_key:true,bike_keys:1,box_key:true,box_keys:1,reasons:{}}}};
ok('«نعم مع ملاحظة» تُعدّ ملاحظة وتظهر في الرسالة',H.handoverIssues(noteRow).length===1&&/صندوق الغسيل: مستلَم مع ملاحظة — ليس أصلياً/.test(H.handoverSweaterMessage(noteRow,{}))&&/Wash box ✓ ⚠/.test(H.handoverSweaterMessage(noteRow,{})));
const legacy={created_at:'2026-09-26T20:30:00Z',direction:'receive',plate:'ح ب 8539',odometer:1200,checklist:{engine:true,box:true,plate:true}};
ok('سجل قديم (بلا received وبمفتاح plate) ⇒ تقرير ورسالة بلا أخطاء',H.handoverIssues(legacy).length===0&&/تم الاستلام بلا ملاحظات/.test(H.handoverSweaterMessage(legacy,null))&&H.checklistOf(legacy.checklist).some(c=>c.id==='plate'));
const noteBox={...yes,box:'note',reasons:{box:'ليس أصلياً'}};
ok('«نعم مع ملاحظة» بلا سبب ⇒ مرفوض',/الملاحظة/.test(V({...good,received:{...yes,box:'note',reasons:{}}})||''));
ok('«نعم مع ملاحظة» بلا الصور الخمس ⇒ مرفوض',/صور الصندوق الخمس/.test(V({...good,photos:bike,received:noteBox})||''));
ok('«نعم مع ملاحظة» مكتمل ⇒ مقبول و items_ok = false',V({...good,received:noteBox})===null&&H.itemsOk(allc,noteBox,ids)===false&&H.receivedRecord(noteBox).box===true&&H.receivedRecord(noteBox).box_note==='ليس أصلياً');
ok('السجل القديم يُعرض كما حُفظ (بلا «اللوحة مركّبة» و«الاستمارة»)، والجديد بالبندين',!H.checklistOf(legacy.checklist).some(c=>c.id==='plate_on'||c.id==='papers')&&H.checklistOf({}).some(c=>c.id==='papers')&&!H.checklistOf({}).some(c=>c.id==='plate'));
ok('تنبيه 3 بنود غير سليمة فأكثر',H.badChecksConfirm(2)===null&&/حدّدت 3 بنود/.test(H.badChecksConfirm(3)));
// النموذج بالخطوات
{const allOk=Object.fromEntries(H.CHECKLIST.map(c=>[c.id,true]));
const F={odometer:'٢٤',photos:{...bike,...box},checks:allOk,received:yes,pledge:true};
ok('سبع خطوات، وصور الصندوق تُتخطّى عند «لا»',H.HANDOVER_STEPS.length===7&&H.stepSkipped(4,{received:{...yes,box:false}})&&!H.stepSkipped(4,{received:yes})&&!H.stepSkipped(4,{received:{...yes,box:'note'}}));
ok('التالي من المستلَمات يقفز إلى الملاحظات عند «لا» للصندوق',H.stepMove(3,1,{received:{...yes,box:false}})===5&&H.stepMove(5,-1,{received:{...yes,box:false}})===3&&H.stepMove(3,1,{received:yes})===4);
ok('العدّاد بأرقام عربية مقبول',H.stepError(0,F)===null&&H.odoNum('٢٤ كم')==='24'&&H.odoNum('১৬২')==='162');
ok('بند تحقق بلا إجابة ⇒ خطأ بجانب البند نفسه',(()=>{const e=H.stepError(2,{...F,checks:{...allOk,oil:undefined}});return e&&e.field==='ck_oil'&&e.ar&&e.bn;})());
ok('لا اختيار مبدئي: قائمة فارغة ⇒ خطأ على أول بند',H.stepError(2,{...F,checks:{}}).field==='ck_engine');
ok('صورة ناقصة ⇒ الحقل ph_left',H.stepError(1,{...F,photos:{...F.photos,left:null}}).field==='ph_left');
ok('مفتاح بنعم بلا عدد ⇒ خطأ',H.stepError(3,{...F,received:{...yes,bike_keys:null}}).field==='rc_bike_key');
ok('التعهّد في خطوة المراجعة',H.stepError(6,{...F,pledge:false}).field==='pledge');
ok('firstStepError يعيد أول خطوة ناقصة ويتخطّى الصندوق عند «لا»',H.firstStepError(F)===null&&H.firstStepError({...F,photos:bike,received:{...yes,box:false,reasons:{box:'x'}}})===null&&H.firstStepError({...F,photos:{...bike,odometer:null}}).i===0);
ok('رسائل الخطوات بلا نص تقني وبلغتين',[0,1,2,3,4,6].every(i=>{const e=H.stepError(i,{odometer:'',photos:{},checks:{},received:{box:true},pledge:false});return !e||(e.ar&&e.bn&&!/[A-Za-z]/.test(e.ar+e.bn));}));}
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
