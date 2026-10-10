// المقارنة مع سويتر: ريال الجودة كسؤال (src/monthRecon.js incentiveOf/alertsOf/claimFrom) — بيانات أغسطس وسبتمبر 2026
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.cq-test-'));
try{
execSync(`npx esbuild src/monthRecon.js --bundle --format=esm --platform=node --outfile=${tmp}/m.mjs --log-level=error`,{stdio:'inherit'});
const M=await import(`${tmp}/m.mjs`);
const adj=(k,s,n)=>Array.from({length:n},()=>({kind:k,sweater_id:s}));
const fw=(s,n)=>Array.from({length:n},()=>({sweater_id:s,compensation:'Free Wash'}));

// سبتمبر
const sepB=[{sweater_id:'1624',biker_name:'Ariful Islam',net_washes:223,rating:4.77,complaint_pct:0},{sweater_id:'1648',biker_name:'Midul Hassan',net_washes:77,rating:4.65,complaint_pct:0},{sweater_id:'1700',biker_name:'Mohamad Rakib',net_washes:221,rating:4.61,complaint_pct:0}];
const sep=M.reconcileMonth({period:'2026-09',bikers:sepB,violations:[],tickets:[...fw('1624',2),...fw('1700',6)],
  adjustments:[...adj('add','1624',4),...adj('maintenance','1624',1),...adj('add','1648',1),...adj('add','1700',10),...adj('deduct','1700',7),...adj('maintenance','1700',4)],
  sweater:{'1624':{net:224,unit:19.57,payable:4383.68},'1648':{net:78,unit:20,payable:1560},'1700':{net:214,unit:19.57,payable:4187.98}}});
const si=M.incentiveOf(sep,sepB,'2026-09');
ok('سبتمبر: Ariful مؤهَّل (4.77، 0%) = 224 ﷼، والبقية لا',si.bikers.find(b=>b.sweater_id==='1624').qualifies&&si.bikers.find(b=>b.sweater_id==='1624').amount===224&&si.amount===224&&!si.bikers.find(b=>b.sweater_id==='1700').qualifies);
ok('سبتمبر: متوسط الفريق 4.68 ⇒ غير مؤهَّل بتفسير الفريق',si.teamAvg===4.68&&!si.teamQualifies);
const sa=M.alertsOf(sep,'2026-09',{ratings:sepB});
const inc=sa.filter(a=>a.kind==='incentive');
ok('سبتمبر: سؤال حافز واحد يذكر التفسيرين',inc.length===1&&inc[0].question&&/متوسط الفريق \(4.68\)/.test(inc[0].ar)&&/per biker/.test(inc[0].en));
ok('سبتمبر: لا تنبيه سعر (مطابق)',!sa.some(a=>a.kind==='unit'));
ok('سؤال الحافز لا يدخل مبلغ المطالبة',M.claimFrom(sep,inc).amount===0&&M.claimFrom(sep,sa).alertAmount===sa.filter(a=>!a.question).reduce((x,a)=>x+a.amount,0));
ok('بلا ratings ⇒ لا أسئلة حافز (السلوك السابق)',!M.alertsOf(sep,'2026-09').some(a=>a.kind==='incentive'));
ok('الاستفسار يذكر ريال الجودة',/ريال الجودة/.test(M.inquiryEmail({period:'2026-09',alerts:inc}).body));

// أغسطس: لا أحد مؤهَّل
const augB=[{sweater_id:'1624',biker_name:'Ariful Islam',net_washes:186,rating:4.69,complaint_pct:0},{sweater_id:'1648',biker_name:'Midul Hassan',net_washes:134,rating:4.54,complaint_pct:0},{sweater_id:'1700',biker_name:'Mohamad Rakib',net_washes:226,rating:4.69,complaint_pct:0}];
const aug=M.reconcileMonth({period:'2026-08',bikers:augB,violations:[],tickets:[],adjustments:[],sweater:{}});
const ai=M.incentiveOf(aug,augB,'2026-08');
ok('أغسطس: لا أحد مؤهَّل (4.69 / 4.54 / 4.69)، متوسط 4.64',ai.amount===0&&ai.bikers.every(b=>!b.qualifies)&&ai.teamAvg===4.64);
ok('تقييم غير معروف ⇒ غير مؤهَّل',!M.incentiveOf(aug,[],'2026-08').bikers.some(b=>b.qualifies||b.known));
ok('قبل أغسطس 2026 ⇒ الحافز غير مفعّل',!M.incentiveOf(aug,augB.map(b=>({...b,rating:5})),'2026-07').bikers.some(b=>b.qualifies));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
