// اختبار أدوات الوثائق: تصنيف الأيام ومولّد .ics — يُبنى بالـ esbuild كباقي الاختبارات
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.rn-test-'));
try{
execSync(`npx esbuild src/renewalsLib.js --bundle --format=esm --platform=node --outfile=${tmp}/r.mjs --log-level=error`,{stdio:'inherit'});
const L=await import(`${tmp}/r.mjs`);

// تصنيف الأيام
const k=d=>L.docStatus(d).k, t=d=>L.docStatus(d).tone;
ok('null → none',k(null)==='none');
ok('-1 → منتهية (bad)',k(-1)==='expired'&&t(-1)==='bad');
ok('0 و7 → ≤7 (bad)',k(0)==='d7'&&k(7)==='d7'&&t(7)==='bad');
ok('8 و14 → ≤14 (warn)',k(8)==='d14'&&k(14)==='d14'&&t(14)==='warn');
ok('15 و30 → ≤30 (info)',k(15)==='d30'&&k(30)==='d30'&&t(30)==='info');
ok('31 → سارية (ok)',k(31)==='valid'&&t(31)==='ok');
ok('نص الأيام',L.dayText(5)==='خلال 5 يوم'&&L.dayText(-3)==='منتهية منذ 3 يوم');
const today=new Date('2026-10-01T10:00:00');
ok('daysLeft من منتصف الليل',L.daysLeft('2026-10-08',today)===7&&L.daysLeft('2026-09-30',today)===-1);
const tab=k=>L.STATUS_TABS.find(x=>x.k===k).f;
ok('تبويب عاجلة يضمّ المنتهية و≤7',tab('urgent')(-5)&&tab('urgent')(7)&&!tab('urgent')(8));
ok('تبويب سارية >30 فقط',tab('valid')(31)&&!tab('valid')(30));
ok('البنغالي والاحتياطي',L.docBn('رخصة عمل')==='ওয়ার্ক পারমিট'&&L.docBn('عقد إيجار')==='عقد إيجار');
ok('تطبيع الجوال',L.waPhone('0551234567')==='966551234567'&&L.waPhone('+966 55 123 4567')==='966551234567');

// مولّد .ics
const docs=[
  {id:'a',doc_type:'إقامة',subject:'Rahim Uddin',end_date:'2026-10-20',active:true},
  {id:'b',doc_type:'رخصة عمل',subject:'Karim, Ali; X',end_date:'2026-12-01',active:true},
  {id:'c',doc_type:'جواز سفر',subject:'خارج المدى',end_date:'2027-06-01',active:true},
  {id:'d',doc_type:'إقامة',subject:'منتهية',end_date:'2026-09-01',active:true},
  {id:'e',doc_type:'إقامة',subject:'موقوفة',end_date:'2026-10-10',active:false},
];
const ics=L.buildICS(docs,{today});
const events=ics.split('BEGIN:VEVENT').slice(1);
ok('BEGIN:VCALENDAR/END:VCALENDAR',ics.startsWith('BEGIN:VCALENDAR')&&ics.trim().endsWith('END:VCALENDAR'));
ok('حدثان فقط (سارية خلال 120 يوماً)',events.length===2);
ok('VALARM مرتين لكل حدث',events.every(e=>(e.match(/BEGIN:VALARM/g)||[]).length===2));
ok('منبّه قبل 14 و7 أيام',events.every(e=>e.includes('TRIGGER:-P14D')&&e.includes('TRIGGER:-P7D')));
ok('حدث يوم كامل',ics.includes('DTSTART;VALUE=DATE:20261020')&&ics.includes('DTEND;VALUE=DATE:20261021'));
ok('العنوان «انتهاء النوع — الموضوع»',ics.replace(/\r\n /g,'').includes('SUMMARY:انتهاء إقامة — Rahim Uddin'));
ok('هروب الفواصل',ics.replace(/\r\n /g,'').includes('Karim\\, Ali\\; X'));
ok('أسطر CRLF ≤75 بايت',ics.split('\r\n').every(l=>new TextEncoder().encode(l).length<=75));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
