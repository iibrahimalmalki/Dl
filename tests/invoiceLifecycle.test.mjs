// دورة حياة فاتورة سويتر: الخطوات وتواريخها، والمستحق مع البقشيش، وموعد التحويل، والتأخر، والخطوة التالية (src/invoiceLifecycle.js)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.il-test-'));
try{
execSync(`npx esbuild src/invoiceLifecycle.js --bundle --format=esm --platform=node --outfile=${tmp}/t.mjs --log-level=error`,{stdio:'inherit'});
const L=await import(`${tmp}/t.mjs`);
const T='2026-10-12';
const sep={period:'2026-09',status:'accepted',paid:false,net_total:'10131.66',tip_amount:293,confirmed_at:'2026-10-11T20:58:00Z',submitted_at:null,accepted_at:'2026-10-11T20:58:00Z',due_date:null};
const aug={period:'2026-08',status:'confirmed',paid:true,net_total:'10358.38',tip_amount:0,paid_amount:'10558.38',confirmed_at:'2026-09-21',paid_at:'2026-09-28'};

ok('المستحق = الصافي + البقشيش',L.expectedTotal(sep)===10424.66&&L.expectedTotal({net_total:'100'})===100);
ok('البقشيش الفعلي من الدفعة (أغسطس 200)',L.tipFromPayment(aug)===200&&L.tipFromPayment({net_total:5})===null);
ok('موعد التحويل: القبول + 14 يوماً إن لم يُحدَّد، وإلا المحدد',L.dueDateOf(sep)==='2026-10-25'&&L.dueDateOf({...sep,due_date:'2026-10-20'})==='2026-10-20'&&L.dueDateOf({status:'submitted'})===null);
ok('addDays يعبر الشهر',L.addDays('2026-10-25',10)==='2026-11-04');

let l=L.lifecycle(sep,T);
ok('سبتمبر: المرحلة مقبولة، 3 خطوات منجزة، والرابعة لا',l.stage==='accepted'&&l.steps.map(s=>s.done).join()==='true,true,true,false'&&l.steps[2].date==='2026-10-11'&&l.steps[3].date===null);
ok('سبتمبر: غير متأخرة في 12/10 والخطوة التالية انتظار التحويل حتى 25/10',l.overdueDays===0&&l.next.key==='paid'&&/25/.test(l.next.ar));
l=L.lifecycle(sep,'2026-10-30');
ok('بعد الموعد بـ5 أيام ⇒ متأخرة 5 والنص يطالب بالمتابعة',l.overdueDays===5&&/متأخرة 5/.test(l.next.ar));
l=L.lifecycle(aug,T);
ok('أغسطس المدفوعة: كل الخطوات منجزة، لا تأخر، لا خطوة تالية',l.stage==='paid'&&l.steps.every(s=>s.done)&&l.overdueDays===0&&l.next===null);
l=L.lifecycle({status:'submitted',submitted_at:'2026-10-01',net_total:'9000'},T);
ok('مُرسلة منذ 11 يوماً بلا قبول ⇒ انتظار 11 والتنبيه بالمتابعة',l.stage==='submitted'&&l.waitingDays===11&&l.next.key==='accepted'&&/11 يوماً/.test(l.next.ar));
l=L.lifecycle({status:'submitted',submitted_at:'2026-10-10',net_total:'9000'},T);
ok('مُرسلة منذ يومين ⇒ انتظار عادي',l.waitingDays===2&&!/تابع/.test(l.next.ar));
l=L.lifecycle({status:'confirmed',confirmed_at:'2026-10-05',net_total:'9000'},T);
ok('معتمدة داخلياً ⇒ الخطوة التالية الرفع على البوابة',l.stage==='confirmed'&&l.steps[0].done&&!l.steps[1].done&&l.next.key==='submitted');
l=L.lifecycle({status:'draft'},T);
ok('مسودة ⇒ لا خطوة منجزة والتالية الاعتماد',l.steps.every(s=>!s.done)&&l.next.key==='confirmed'&&l.due===null);
ok('مقبولة ومدفوعة (paid=true) ⇒ مدفوعة لا متأخرة حتى بعد الموعد',L.lifecycle({...sep,paid:true,paid_at:'2026-10-20'},'2026-11-30').overdueDays===0);
ok('الثابت DUE_DAYS = 14',L.DUE_DAYS===14);
ok('riyadhDate: الطابع الزمني يُحوَّل لتاريخ الرياض، والتاريخ الصِرف يبقى',L.riyadhDate('2026-10-11T22:30:00Z')==='2026-10-12'&&L.riyadhDate('2026-10-11T20:58:00+00:00')==='2026-10-11'&&L.riyadhDate('2026-10-05')==='2026-10-05'&&L.riyadhDate(null)===null);
ok('قبول بعد منتصف الليل بتوقيت الرياض ⇒ الموعد من يوم الرياض لا UTC',L.dueDateOf({accepted_at:'2026-10-11T22:30:00Z'})==='2026-10-26');
ok('todayRiyadh بصيغة YYYY-MM-DD',/^\d{4}-\d{2}-\d{2}$/.test(L.todayRiyadh()));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
