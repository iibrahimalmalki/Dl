// اختبار محرك أكاديمية دلو ورغوة (src/academy/engine.js) — توليد الأسئلة وقواعد النجاح وتقييم المشرف والطريق
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.ac-test-'));
try{
execSync(`npx esbuild src/academy/engine.js --bundle --format=esm --platform=node --outfile=${tmp}/e.mjs --log-level=error`,{stdio:'inherit'});
const E=await import(`${tmp}/e.mjs`);
const C=await (async()=>{execSync(`npx esbuild src/academy/content.js --bundle --format=esm --platform=node --outfile=${tmp}/c.mjs --log-level=error`,{stdio:'inherit'});return import(`${tmp}/c.mjs`);})();
const {MODS,WASH,PATH}=E;

// ── 1) كل مولّد أسئلة × 30 تشغيلاً ──
const gens=[['المناشف',E.buildTowels],['البخاخات',E.buildProducts],['الأدوات',E.buildTools],['الداخلي',()=>E.buildWash(C.INTERIOR)],['الخارجي',()=>E.buildWash(C.EXTERIOR)],['يومي',E.buildDay],['الجودة',E.buildQuality],['الشامل',E.buildFinal],['أسئلة اليوم',()=>E.buildDaily({})]];
for(const [name,g] of gens){
  let bad=[];
  for(let run=0;run<30;run++){
    const qs=g();
    if(!qs.length)bad.push('فارغ');
    qs.forEach((q,i)=>{
      if(!q.why||!q.why.ar||!q.why.bn)bad.push(`${i}: بلا why`);
      if(q.type==='mcq'){const ks=q.opts.map(o=>o.k);if(!ks.includes(q.ans))bad.push(`${i}: الإجابة خارج الخيارات`);if(new Set(ks).size!==ks.length)bad.push(`${i}: خيارات مكررة`);
        const labels=q.opts.map(o=>o.label.ar);if(new Set(labels).size!==labels.length)bad.push(`${i}: نصوص خيارات مكررة`);}
      else if(q.type==='tf'){if(typeof q.a!=='boolean')bad.push(`${i}: tf بلا إجابة`);}
      else if(q.type==='match'){const l=q.left.map(o=>o.k).sort().join(),r=q.right.map(o=>o.k).sort().join();if(l!==r||new Set(q.left.map(o=>o.k)).size!==q.left.length)bad.push(`${i}: توصيل غير متطابق`);}
      else if(q.type==='order'){if(!q.items||q.items.length<2)bad.push(`${i}: ترتيب ناقص`);}
      else bad.push(`${i}: نوع غير معروف ${q.type}`);
    });
  }
  ok(`${name}: 30 تشغيلاً — الإجابة ضمن الخيارات، بلا تكرار، ولكل سؤال why`,bad.length===0||console.log('   ',bad.slice(0,3)));
}

// ── 2) هيكل الغسيل ──
const steps=W=>E.allSteps(W).length;
ok('الداخلي: 15 خطوة في 3 مراحل و4 قواعد',steps(C.INTERIOR)===15&&C.INTERIOR.phases.length===3&&C.INTERIOR.rules.length===4);
ok('الخارجي: 13 خطوة في 7 مراحل و4 قواعد',steps(C.EXTERIOR)===13&&C.EXTERIOR.phases.length===7&&C.EXTERIOR.rules.length===4);
ok('لكل مرحلة مقطع بتوقيت صحيح من ملف أصلي',[...C.INTERIOR.phases,...C.EXTERIOR.phases].every(p=>E.CLIPS[p.clip]&&E.CLIPS[p.clip].to>E.CLIPS[p.clip].from&&['interior','exterior1','exterior2'].includes(E.CLIPS[p.clip].file)));
ok('الطريق 10 محطات بالترتيب',PATH.map(s=>s.t+':'+s.id).join()==='mod:towels,mod:products,mod:tools,mod:interior,mod:exterior,mod:day,mod:quality,final:final,prac:interior,prac:exterior');

// ── 3) النقاط والنجاح ──
ok('النقاط: اختيار/صح-خطأ 1؛ توصيل/ترتيب 2 بلا خطأ، 1 حتى خطأين، 0 أكثر',E.pointsFor('mcq',0)===1&&E.pointsFor('tf',1)===0&&E.pointsFor('match',0)===2&&E.pointsFor('order',2)===1&&E.pointsFor('order',3)===0);
const mcqs=(n,topic='tools')=>Array.from({length:n},()=>({type:'mcq',topic}));
ok('85% حدّ النجاح: 17/20 ناجح، 16/20 راسب',E.quizResult('tools',mcqs(20),17).pass&&E.quizResult('tools',mcqs(20),17).pct===85&&!E.quizResult('tools',mcqs(20),16).pass);
const fq=[...mcqs(4,'towels'),...mcqs(6,'tools')];
const f1=E.quizResult('final',fq,9,[{topic:'towels',why:{ar:'x'}}]);
ok('الشامل يرسب عند خطأ واحد في المناشف ولو المجموع 90%',f1.pct===90&&!f1.pass&&f1.tp.towels===75);
const f2=E.quizResult('final',fq,9,[{topic:'tools',why:{ar:'x'}}]);
ok('الشامل ينجح بـ90% إذا كانت المناشف 100%',f2.pass&&f2.tp.towels===100);
ok('التوصيل يُحسب نقطتين في المقام',E.quizResult('towels',[{type:'match',topic:'towels'},...mcqs(3,'towels')],5).max===5);

// ── 4) تقييم المشرف ──
const marks=(n,map={})=>Object.fromEntries(Array.from({length:n},(_,i)=>['s'+i,map[i]??2]));
const rules=(v=1)=>({r0:v,r1:1,r2:1,r3:1});
const IN=C.INTERIOR;
ok('كل الخطوات «متقن» ⇒ 100% ناجح',(()=>{const r=E.evalResult(IN,marks(15),rules());return r.pct===100&&r.pass;})());
ok('خطوة واحدة «لم يُنفَّذ» ⇒ راسب ولو ≥ 85%',(()=>{const r=E.evalResult(IN,marks(15,{3:0}),rules());return r.pct===93&&!r.pass&&r.skipped.length===1;})());
ok('قاعدة «خالف» ⇒ راسب',(()=>{const r=E.evalResult(IN,marks(15),rules(0));return r.pct===100&&!r.pass&&r.broken.length===1;})());
ok('15 خطوة منها 4 «يحتاج تحسين» ⇒ 87% ناجح',(()=>{const r=E.evalResult(IN,marks(15,{0:1,1:1,2:1,3:1}),rules());return r.pct===87&&r.pass&&r.weak.length===4;})());
ok('15 خطوة منها 5 «يحتاج تحسين» ⇒ 83% راسب',(()=>{const r=E.evalResult(IN,marks(15,{0:1,1:1,2:1,3:1,4:1}),rules());return r.pct===83&&!r.pass;})());
ok('تقييم ناقص (خطوة بلا علامة) ⇒ لا يُعدّ ناجحاً',(()=>{const m=marks(15);delete m.s7;return !E.evalResult(IN,m,rules()).pass&&E.evalResult(IN,m,rules()).missing;})());

// ── 5) الطريق ──
const st0={best:{},finalPass:false,pracPass:{}};
ok('بلا شيء: المحطة الحالية الأولى والباقي مقفل',E.curIdx(st0)===0&&E.stationState(0,st0)==='now'&&E.stationState(1,st0)==='lock'&&E.stationState(9,st0)==='lock');
const st1={best:{towels:90,products:85,tools:70},finalPass:false,pracPass:{}};
ok('المحطة الحالية = أول غير منجزة (الأدوات 70%)، وما بعدها مقفل',E.curIdx(st1)===2&&E.stationState(1,st1)==='done'&&E.stationState(3,st1)==='lock');
const stGap={best:{towels:90,tools:100},finalPass:false,pracPass:{}};
ok('اجتياز لاحق لا يفتح ما قبله: الحالية تبقى أول غير منجزة',E.curIdx(stGap)===1);
const allMods=Object.fromEntries(MODS.map(m=>[m.id,100]));
ok('بعد الوحدات والشامل: الحالية العملي الداخلي',E.curIdx({best:allMods,finalPass:true,pracPass:{}})===8&&E.stage({best:allMods,finalPass:true,pracPass:{}})===2);
ok('كل المحطات ⇒ معتمد',E.certified({best:allMods,finalPass:true,pracPass:{interior:true,exterior:true}})&&E.stage({best:allMods,finalPass:true,pracPass:{interior:true,exterior:true}})===3);

// ── 6) الحالة من سجلات القاعدة ──
const s=E.stateFrom([{module:'towels',pct:70,pass:false},{module:'towels',pct:92,pass:true},{module:'final',pct:80,pass:false},{module:'daily',pct:100,pass:true}],
  [{kind:'interior',mode:'self',pass:null},{kind:'interior',mode:'sup',pass:true},{kind:'exterior',mode:'sup',pass:false}]);
ok('أفضل نتيجة لكل وحدة، الشامل والعملي من سجلات القاعدة (التدريب الذاتي لا يعتمد)',s.best.towels===92&&s.best.daily===undefined&&!s.finalPass&&s.pracPass.interior&&!s.pracPass.exterior);
const w={ar:'خطأ أ',bn:'x'};
const miss=E.missFrom([{created_at:'2026-10-01',mistakes:[{topic:'towels',why:w}]},{created_at:'2026-10-02',mistakes:[{topic:'towels',why:w}]},{created_at:'2026-10-03',mistakes:[{right:true,k:'خطأ أ'}]}]);
ok('الأخطاء: تزيد بالخطأ وتنقص بالإجابة الصحيحة لاحقاً',miss['خطأ أ'].n===1&&E.topMiss(miss,5).length===1);
ok('أسئلة اليوم: 5 أسئلة والأكثر خطأً أولاً',(()=>{E.setRandom(()=>0.5);const m={};const q0=E.buildTowels().find(q=>q.type!=='match');m[q0.why.ar]={n:9};const d=E.buildDaily(m);E.setRandom();return d.length===5&&d.some(q=>q.why.ar===q0.why.ar);})());
ok('سلسلة الأيام المتتالية',E.dailyStreak(['2026-10-01','2026-10-02','2026-10-03'],'2026-10-03').streak===3&&E.dailyStreak(['2026-10-01','2026-10-02'],'2026-10-03').streak===2&&E.dailyStreak(['2026-09-28'],'2026-10-03').streak===0&&E.dailyStreak(['2026-10-03'],'2026-10-03').doneToday);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
