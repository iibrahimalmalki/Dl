// اختبار منطق مساعد العمليات (src/assistantBrief.js) — بيانات حقيقية فقط، بلا أرقام وهمية
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.as-test-'));
try{
execSync(`npx esbuild src/assistantBrief.js --bundle --format=esm --platform=node --outfile=${tmp}/a.mjs --log-level=error`,{stdio:'inherit'});
const A=await import(`${tmp}/a.mjs`);
const today=new Date('2026-10-01T09:00:00');
const ops=[
  {period:'2026-08',sweater_id:'1',biker_name:'A',net_washes:150,rating:4.6},
  {period:'2026-09',sweater_id:'1',biker_name:'A',net_washes:195,rating:4.6,approved_complaints:1},
  {period:'2026-09',sweater_id:'2',biker_name:'B',net_washes:226,rating:4.2,approved_complaints:2},
  {period:'2026-09',sweater_id:'3',biker_name:'C',net_washes:190,rating:3.8},
  {period:'2026-09',sweater_id:'4',biker_name:'D',net_washes:120,rating:4.9},
];
const rounds=[
  {sweater_id:'1',round_date:'2026-09-28',compliance_pct:92,status:'done'},
  {sweater_id:'2',round_date:'2026-09-25',compliance_pct:70,status:'done'},
  {sweater_id:'3',round_date:'2026-08-10',compliance_pct:90,status:'done'},
  {sweater_id:'4',round_date:'2026-09-30',compliance_pct:95,status:'requested'},
];
const nr=A.needsRound(ops,rounds,{today});
ok('needsRound: لم يُزر قط أولاً',nr[0].sid==='4'&&nr[0].why.includes('لم تُجرَ'));
ok('needsRound: التزام < 80% ثم الأقدم',nr[1].sid==='2'&&nr[2].sid==='3'&&nr[2].why.includes('52'));
ok('needsRound: يستبعد من زير حديثاً بالتزام جيد',!nr.some(x=>x.sid==='1'));
const nb=A.nearestBonus(ops);
ok('nearestBonus: الأقرب أولاً ويستبعد تقييم < 4',nb[0].sid==='2'&&nb[0].next.gap===4&&nb[0].next.bonus===50&&nb[1].sid==='1'&&nb[1].next.gap===5&&!nb.some(x=>x.sid==='3'));
const docs=[{id:'a',doc_type:'إقامة',subject:'A',end_date:'2026-10-05'},{id:'b',doc_type:'إقامة',subject:'B',end_date:'2026-09-20'},{id:'c',doc_type:'إقامة',subject:'C',end_date:'2026-12-01'},{id:'d',doc_type:'إقامة',subject:'D',end_date:'2026-10-03',active:false}];
const dd=A.docsDue(docs,{today});
ok('docsDue: المنتهية أولاً، ≤14 يوماً، وتستبعد الموقوفة',dd.map(x=>x.id).join()==='b,a'&&dd[0].status.tone==='bad');
ok('automationShare',(x=>x.pct===62.5&&x.manual===3)(A.automationShare(5,8))&&A.automationShare(0,0)===null);
const br=A.dailyBrief({ops,rounds,docs,screq:[{status:'open'},{status:'completed'}]},{today});
ok('dailyBrief: الغسلات والمقارنة من البيانات',br.some(t=>t.includes('731 غسلة')&&t.includes('أعلى بـ 387%')));
ok('dailyBrief: جولات ووثائق وإنتاج وإمداد',br.some(t=>t.includes('يحتاجون جولة'))&&br.some(t=>t.includes('2 وثيقة'))&&br.some(t=>t.includes('4 غسلة من مكافأة 50'))&&br.some(t=>t.includes('1 طلب إمداد')));
ok('dailyBrief: بلا بيانات لا أرقام',A.dailyBrief({ops:[],rounds:[],docs:[],screq:[]},{today}).join(' ').includes('لا شيء عاجل'));
const ms=A.monthSummary({ops,rounds,docs},{today});
ok('monthSummary',ms.includes('2026-09')&&ms.includes('731')&&ms.includes('HR-POL-003'));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
