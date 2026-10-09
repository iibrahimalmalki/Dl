// بطاقات الأضرار وفحص وضوح الصورة (src/handover.js + src/photoQuality.js)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.hd-test-'));
try{
execSync(`npx esbuild src/handover.js --bundle --format=esm --platform=node --outfile=${tmp}/h.mjs --log-level=error`,{stdio:'inherit'});
execSync(`npx esbuild src/photoQuality.js --bundle --format=esm --platform=node --outfile=${tmp}/q.mjs --log-level=error`,{stdio:'inherit'});
const H=await import(`${tmp}/h.mjs`), Q=await import(`${tmp}/q.mjs`);

/* ── فحص الوضوح ── */
const W=200,Hh=150;
const img=fn=>{const g=new Float32Array(W*Hh);for(let y=0;y<Hh;y++)for(let x=0;x<W;x++)g[y*W+x]=fn(x,y);return g;};
const st=g=>Q.analyzeGray(g,W,Hh);
// صورة حادة: مربعات 8×8 بتباين متوسط وسطوع طبيعي
const sharp=img((x,y)=>((x>>3)+(y>>3))%2?170:80);
// ضبابية: تدرّج ناعم بلا حواف
const blur=img((x,y)=>100+x*0.3+y*0.2);
// مظلمة: قيم منخفضة حتى مع تفاصيل
const dark=img((x,y)=>((x>>3)+(y>>3))%2?20:5);
// محروقة: شبه بيضاء
const bright=img((x,y)=>((x>>3)+(y>>3))%2?255:250);
const big={width:1600,height:1200};
ok('حادة ⇒ مقبولة',Q.judgePhoto({...big,stats:st(sharp)})===null);
ok('ضبابية ⇒ blur',(Q.judgePhoto({...big,stats:st(blur)})||{}).code==='blur');
ok('رسالة الضبابية بالعربي والبنغالي',(()=>{const r=Q.judgePhoto({...big,stats:st(blur)});return r.ar.includes('غير واضحة')&&r.ar.includes('ثبّت يدك')&&/[ঀ-৿]/.test(r.bn);})());
ok('مظلمة ⇒ dark',(Q.judgePhoto({...big,stats:st(dark)})||{}).code==='dark');
ok('محروقة ⇒ bright',(Q.judgePhoto({...big,stats:st(bright)})||{}).code==='bright');
ok('الدقة: الضلع الأقصر 799 ⇒ small',(Q.judgePhoto({width:1200,height:799,stats:st(sharp)})||{}).code==='small');
ok('الدقة: 800 بالضبط ⇒ مقبولة',Q.judgePhoto({width:1200,height:800,stats:st(sharp)})===null);
ok('الدقة تُفحص قبل الإضاءة والحدة',(Q.judgePhoto({width:640,height:480,stats:st(blur)})||{}).code==='small');
ok('حدة الصورة الحادة أعلى بكثير من الضبابية',st(sharp).sharp>100*Math.max(1,st(blur).sharp));
ok('rgbaToGray: أبيض=255 وأسود=0',(()=>{const g=Q.rgbaToGray(new Uint8ClampedArray([255,255,255,255,0,0,0,255]));return Math.round(g[0])===255&&g[1]===0;})());

/* ── بطاقات الأضرار ── */
const full={close:'c.jpg',wide:'w.jpg',part:'tank',type:'scratch',note:'خدش طويل'};
ok('بطاقة كاملة ⇒ صالحة',H.damageItemError(full,0)===null);
const miss=(k,v)=>H.damageItemError({...full,[k]:v},2);
ok('بلا صورة قريبة ⇒ مرفوضة',miss('close',null).field==='dmg_2_close');
ok('بلا صورة بعيدة ⇒ مرفوضة',miss('wide',null).field==='dmg_2_wide');
ok('بلا مكان ⇒ مرفوضة',miss('part','').field==='dmg_2_part');
ok('مكان غير معروف ⇒ مرفوضة',miss('part','roof').field==='dmg_2_part');
ok('بلا نوع ⇒ مرفوضة',miss('type','').field==='dmg_2_type');
ok('وصف 4 أحرف ⇒ مرفوضة',miss('note','خدشه').field==='dmg_2_note');
ok('وصف مسافات فقط ⇒ مرفوضة',miss('note','       ').field==='dmg_2_note');
ok('وصف 5 أحرف بالبنغالي ⇒ مقبولة',miss('note','আঁচড়টা')===null);
ok('رقم الضرر في الرسالة',miss('close',null).ar.startsWith('الضرر 3')&&miss('close',null).bn.startsWith('ক্ষতি 3'));
ok('damagesError: أول بطاقة ناقصة',H.damagesError([full,{...full,type:''}]).field==='dmg_1_type');
ok('damagesError: لا أضرار ⇒ صالح',H.damagesError([])===null&&H.damagesError(undefined)===null);
ok('damagesError: أكثر من 8 ⇒ مرفوض',H.damagesError(Array(9).fill(full)).field==='dmg_add');
ok('الخيارات: 10 أماكن و7 أنواع، كلها بالعربي والبنغالي',H.DAMAGE_PARTS.length===10&&H.DAMAGE_TYPES.length===7&&[...H.DAMAGE_PARTS,...H.DAMAGE_TYPES].every(o=>o.ar&&/[ঀ-৿]/.test(o.bn)));
ok('ترجمة المكان والنوع',H.damagePart('tank').ar==='الخزان'&&H.damageType('dent').ar==='صدمة/انبعاج');
ok('قيمة غير معروفة تُعرض كما هي',H.damagePart('xyz').ar==='xyz');

/* ── خطوة «الأضرار والملاحظات» في النموذج ── */
const ni=H.HANDOVER_STEPS.findIndex(s=>s.k==='notes');
ok('الخطوة بلا أضرار ⇒ تمر',H.stepError(ni,{damages:[]})===null);
ok('الخطوة ببطاقة ناقصة ⇒ خطأ بجانب الحقل',H.stepError(ni,{damages:[{...full,wide:null}]}).field==='dmg_0_wide');

/* ── التخزين ── */
const items=[{close:'u1',wide:'u2',part:'front',type:'dent',note:'x'},{close:'u3',wide:'u4',part:'seat',type:'crack',note:'y'}];
ok('damage_photos مسطّحة: قريبة ثم بعيدة لكل ضرر',JSON.stringify(H.damagePhotosFlat(items))===JSON.stringify(['u1','u2','u3','u4']));
const rec=H.damageItemsRecord([{...full,id:'a',note:'  خدش طويل  '}],f=>'url:'+f);
ok('damage_items: الحقول الخمسة فقط والوصف مقصوص',JSON.stringify(rec)===JSON.stringify([{close:'url:c.jpg',wide:'url:w.jpg',part:'tank',type:'scratch',note:'خدش طويل'}]));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
