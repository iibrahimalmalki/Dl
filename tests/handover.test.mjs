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
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
