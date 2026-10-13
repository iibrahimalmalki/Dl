// اختبار استيراد ملفات سويتر للإقفال الشهري (src/sspImport.js) — بيانات اصطناعية صغيرة
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.ssp-test-'));
try{
execSync(`npx esbuild src/sspImport.js --bundle --format=esm --platform=node --external:xlsx --outfile=${tmp}/s.mjs --log-level=error`,{stdio:'inherit'});
const{detectKind,toISO,splitBiker,buildMonth,readSheet,exportDateOf,parseTips}=await import(`${tmp}/s.mjs`);

// 1) detectKind للأسماء التسعة
const names={
  '_ssp__bookings_report_2026-09-26T20_44_57.csv':'bookings',
  '_ssp__tickets_report_2026-09-26T20_44_57.xlsx':'tickets',
  '_ssp__customer_compensations_2026-09-26.csv':'comp',
  '_ssp__customer_cancelled_bookings_2026-09-26.csv':'add',
  '_ssp__biker_cancelled_bookings_2026-09-26.csv':'deduct',
  '_ssp__bookings_cancelled_due_to_maintenance_2026-09-26.csv':'maintenance',
  '_ssp__bikers_tickets_and_ratings_report_2026-09-26.csv':'ratings_cum',
  '_ssp__biker_bookings_and_tips_report_2026-09-26.csv':'tips',
  '_ssp__deductions_and_compensations_summary_report_2026-09-26.csv':'summary_cum',
};
ok('detectKind: الأسماء التسعة',Object.entries(names).every(([f,k])=>detectKind(f,[])===k));
ok('detectKind: tips/ratings لا تختلط بـ bookings/tickets',detectKind('_ssp__biker_bookings_and_tips_report.csv',['Booking Status'])==='tips'&&detectKind('_ssp__bikers_tickets_and_ratings_report.csv',['Ticket Description'])==='ratings_cum');
ok('detectKind: بالأعمدة ثم null',detectKind('x.csv',['﻿Booking ID','Booking Status'])==='bookings'&&detectKind('y.xlsx',['Booking ID','Ticket Description'])==='tickets'
  &&detectKind('z.csv',['Booking_ID','Booking_Date','Booked_Slot','Cancel_Reason','Biker_Name'])==='maintenance'&&detectKind('w.csv',['Foo'])===null);

// 2) toISO للصيغ الأربع
ok('toISO: نص سويتر + Date + ISO + رقم إكسل',toISO('26 September, 2026')==='2026-09-26'&&toISO(new Date(Date.UTC(2026,7,1)))==='2026-08-01'
  &&toISO(new Date(2026,7,31))==='2026-08-31'&&toISO('2026-08-05T10:00:00')==='2026-08-05'&&toISO(46235)==='2026-08-01'&&toISO('')===null&&toISO('N/A')===null);

// 3) splitBiker
ok('splitBiker',JSON.stringify(splitBiker('Mohamad Rakib (1700)'))==='{"name":"Mohamad Rakib","sid":"1700"}'&&splitBiker('Ali Khan').sid===null&&splitBiker('Ali Khan').name==='Ali Khan');
ok('exportDateOf',exportDateOf('_ssp__bookings_report_2026-09-26T20_44_57.csv')==='2026-09-26');

// بيانات اصطناعية: ملف حجوزات متعدد الأشهر (CSV كما يصدّره سويتر)
const B='Booking ID,Booking Date,Booking Time,Booking Status,Cancel Reason,Rating (Biker Behavior),Rating (Wash Quality),Biker Name';
const csv=[B,
  '1,"31 July, 2026",10:00,collect_payment,,5,5,A One (11)',
  '2,"1 August, 2026",10:00,collect_payment,,5,4,A One (11)',
  '3,"1 August, 2026",11:00,collect_payment,,N/A,N/A,A One (11)',
  '4,"2 August, 2026",11:00,cancel_client,,,,A One (11)',
  '5,"2 August, 2026",12:00,cancel_admin,,,,A One (11)',
  '6,"3 August, 2026",12:00,collect_payment,,4,3,B Two (22)',
  '7,"3 August, 2026",13:00,cancel_client,,,,B Two (22)',
  '8,"1 September, 2026",13:00,collect_payment,,5,5,B Two (22)',
  '9,"31 August, 2026",13:00,collect_payment,,,,No Sid',
].join('\n');
const{rows:bRows,headers:bH}=readSheet(new TextEncoder().encode('﻿'+csv));
ok('readSheet: CSV يبقى نصاً (تاريخ سويتر بلا إزاحة)',bRows.length===9&&String(bRows[0]['Booking Date']).includes('July')&&detectKind('a.csv',bH)==='bookings');
const comp=[{'Booking ID':'2','Booking Date':'1 August, 2026','Start Booking Time':'10:00','Sub Category Name':'Bad wash','Biker Name':'A One (11)','Discount Value':'Free Wash'},
  {'Booking ID':'6','Booking Date':'3 August, 2026','Start Booking Time':'12:00','Sub Category Name':'Late','Biker Name':'B Two (22)','Discount Value':'15'}];
const tk=[{'Booking ID':'2','Biker Name':'A One (11)','Booking Date':'1 August, 2026','Booking Time':'10:00','Ticket Description':'Dirty rims'},
  {'Booking ID':'8','Biker Name':'B Two (22)','Booking Date':'1 September, 2026','Booking Time':'10:00','Ticket Description':'Sept'}];
const maint=[{'﻿Booking_ID':'50','Booking_Date':'5 August, 2026','Booked_Slot':'10:00','Cancel_Reason':'Bike','Biker_Name':'A One (11)'},
  {'﻿Booking_ID':'51','Booking_Date':'5 July, 2026','Booked_Slot':'10:00','Cancel_Reason':'Bike','Biker_Name':'A One (11)'}];
const adj=(id,d)=>({'Booking ID':id,'Booking Date':d,'Booked Slot':'09:00','Cancel Reason':'x','Biker Name':'B Two (22)'});
const files=[
  {kind:'bookings',filename:'_ssp__bookings_report_2026-09-26T20_44_57.csv',rows:bRows},
  {kind:'comp',filename:'c.csv',rows:comp},{kind:'tickets',filename:'t.xlsx',rows:tk},{kind:'maintenance',filename:'m.csv',rows:maint},
  {kind:'add',filename:'a.csv',rows:[adj('60','4 August, 2026'),adj('61','4 August, 2026'),adj('62','1 September, 2026')]},
  {kind:'deduct',filename:'d.csv',rows:[adj('70','6 August, 2026')]},
  {kind:'tips',filename:'tips.csv',rows:[{'Company ID':'11','Biker Name':'A One','Total Bookings':'2','Total Tips':'5','Net Tips (After Bank Fees)':'4.6'},{'Company ID':'22','Total Bookings':'9','Net Tips (After Bank Fees)':'0'},{'Company ID':'99','Net Tips (After Bank Fees)':'3'}]},
];
const m=buildMonth(files,'2026-08');
const a=m.bikers.find(b=>b.sweater_id==='11'),b2=m.bikers.find(b=>b.sweater_id==='22');
ok('فلترة الشهر من ملف متعدد الأشهر',a.collect_payment===2&&b2.collect_payment===1&&m.coverage.min==='2026-08-01'&&m.coverage.max==='2026-08-31');
ok('الصافي = المكتملة + إلغاء العميل (بلا إلغاء الإدارة)',a.net_washes===3&&a.collect_payment===2&&a.cancel_client===1&&a.cancel_admin===1&&b2.net_washes===2&&b2.cancel_client===1);
ok('التقييم المجمّع للعمودين مع تجاهل N/A',a.rating===4.5&&b2.rating===3.5&&m.bikers.find(x=>x.biker_name==='No Sid').rating===null);
ok('daily ومجموعه = المكتملة وعدد الأيام',JSON.stringify(a.daily)==='{"2026-08-01":2}'&&a.days===1&&m.bikers.every(x=>Object.values(x.daily).reduce((s,v)=>s+v,0)===x.collect_payment));
const d1=m.daily.find(x=>x.day==='2026-08-01'),d2=m.daily.find(x=>x.day==='2026-08-02');
ok('ops daily: المغلقة فقط ومتوسطا الجودة والسلوك',d1.total_bookings===2&&d1.washes===2&&d1.avg_quality===4&&d1.avg_behavior===5&&d2.total_bookings===2&&d2.washes===0&&d2.avg_quality===null);
ok('ملف الصيانة بأعمدة الشرطة السفلية',m.adjustments.filter(x=>x.kind==='maintenance').length===1&&m.adjustments.find(x=>x.kind==='maintenance').booking_ref==='50'&&m.adjustments.find(x=>x.kind==='maintenance').sweater_id==='11');
const t2=m.tickets.find(t=>t.booking_ref==='2'),t6=m.tickets.find(t=>t.booking_ref==='6');
ok('دمج comp في التذكرة + تعويض بلا تذكرة يصبح تذكرة',m.tickets.length===2&&t2.description==='Dirty rims'&&t2.sub_category==='Bad wash'&&t2.compensation==='Free Wash'&&t6.description==='Late'&&t6.compensation==='15');
ok('summary و expectedNet',m.summary.online===4&&m.summary.add===2&&m.summary.deduct===1&&m.summary.maintenance===1&&m.summary.freeWash===1&&m.summary.otherComp===15&&m.summary.expectedNet===4+2-1-1-1);
ok('الإكراميات حسب Company ID + تحذير رقم خارج الحجوزات وعدد لا يطابق',a.tips===4.6&&b2.tips===0&&m.bikers.find(x=>x.biker_name==='No Sid').tips===0
  &&m.warnings.some(w=>w.code==='tips_unmatched'&&w.ar.includes('99'))&&m.warnings.some(w=>w.code==='tips_count'&&w.ar.includes('22'))&&!m.warnings.some(w=>w.code==='tips_count'&&w.ar.includes('11')));
ok('بلا ملف إكراميات: tips = null (غير معروف لا صفر)',buildMonth([files[0]],'2026-08').bikers.every(b=>b.tips===null));
ok('no_sid + اكتمال الشهر',m.warnings.some(w=>w.code==='no_sid')&&m.coverage.complete===true&&!m.warnings.some(w=>w.code==='incomplete'));

// تحذير incomplete عند وجود initiated + to_be_allocated
const sep=buildMonth([{kind:'bookings',filename:'_ssp__bookings_report_2026-09-26T20_44_57.csv',rows:[
  {'Booking ID':'1','Booking Date':'25 September, 2026','Booking Status':'collect_payment','Rating (Biker Behavior)':'5','Rating (Wash Quality)':'5','Biker Name':'A (1)'},
  {'Booking ID':'2','Booking Date':'27 September, 2026','Booking Status':'initiated','Rating (Biker Behavior)':'','Rating (Wash Quality)':'','Biker Name':''},
  {'Booking ID':'3','Booking Date':'28 September, 2026','Booking Status':'to_be_allocated','Rating (Biker Behavior)':'','Rating (Wash Quality)':'','Biker Name':''}]}],'2026-09');
ok('incomplete عند initiated/to_be_allocated',!sep.coverage.complete&&sep.coverage.open===2&&sep.coverage.openBy.initiated===1&&sep.coverage.lastWashDay==='2026-09-25'&&sep.warnings.some(w=>w.code==='incomplete')&&sep.summary.online===1);
ok('missing_cols + no_bookings + empty_month + unknown_file',
  buildMonth([{kind:'bookings',filename:'b.csv',rows:[{'Booking ID':'1','Booking Date':'1 August, 2026','Biker Name':'A (1)'}]}],'2026-08').warnings.some(w=>w.code==='missing_cols'&&w.ar.includes('booking status'))
  &&buildMonth([{kind:null,filename:'q.csv',rows:[]}],'2026-08').warnings.map(w=>w.code).join()==='unknown_file,no_bookings'
  &&buildMonth([files[0]],'2026-03').warnings.some(w=>w.code==='empty_month'));

// التقييم: المكتملة فقط وبلا تقريب، والفارغ يبقى null مع تحذير
const RB=[
  {'Booking ID':'1','Booking Date':'2 August, 2026','Booking Status':'collect_payment','Rating (Biker Behavior)':'4','Rating (Wash Quality)':'3.99','Biker Name':'R (5)'},
  {'Booking ID':'2','Booking Date':'2 August, 2026','Booking Status':'cancel_client','Rating (Biker Behavior)':'5','Rating (Wash Quality)':'5','Biker Name':'R (5)'},
  {'Booking ID':'3','Booking Date':'2 August, 2026','Booking Status':'cancel_admin','Rating (Biker Behavior)':'5','Rating (Wash Quality)':'5','Biker Name':'R (5)'},
  {'Booking ID':'4','Booking Date':'3 August, 2026','Booking Status':'collect_payment','Rating (Biker Behavior)':'','Rating (Wash Quality)':'','Biker Name':'E (6)'}];
const rm=buildMonth([{kind:'bookings',filename:'b.csv',rows:RB}],'2026-08');
const R5=rm.bikers.find(b=>b.sweater_id==='5'),E6=rm.bikers.find(b=>b.sweater_id==='6');
ok('التقييم من المكتملة فقط (الملغاة خارج المتوسط)',Math.abs(R5.rating-3.995)<1e-9&&R5.net_washes===2);
ok('التقييم 3.995 لا يُقرَّب إلى 4.00',R5.rating<4);
ok('التقييم الفارغ null مع تحذير no_rating',E6.rating===null&&rm.warnings.some(w=>w.code==='no_rating'&&w.ar.includes('6'))&&!rm.warnings.some(w=>w.code==='no_rating'&&w.ar.includes('#5')));
ok('detectKind: عمود Multiple لا يُصنَّف إكراميات، وعمود Net Tips يُصنَّف',detectKind('x.csv',['Multiple','Foo'])===null&&detectKind('x.csv',['Company ID','Net Tips (After Bank Fees)'])==='tips');
// ملف يوليو الحقيقي (biker_bookings_and_tips_report) — العناوين كما هي
const TH=['Biker ID (Metabase)','Company ID','Biker Name','Total Bookings (Online) [Full Wash]','Total Bookings (Online) [Exterior Wash]','Total Bookings (Online) [Deep Cleaning]','Total Bookings (Online)','Total Bookings (Offline)','Total Bookings','Total Working Days','Total Tips','Net Tips (After Bank Fees)'];
const TR=[['1065','1700','Mohamad Rakib (1700)','196','0','0','196','0','196','29','40','39'],['1019','1648','Midul Hassan (1648)','187','0','0','187','0','187','26','44','42.9'],['1000','1624','Ariful Islam (1624)','46','0','0','46','0','46','8','0','0']]
  .map(r=>Object.fromEntries(TH.map((h,i)=>[h,r[i]])));
const jt=parseTips(TR);
ok('ملف يوليو: يُصنَّف tips من عناوينه',detectKind('x.csv',TH)==='tips');
ok('ملف يوليو: عدد الحجوزات من «Total Bookings» (196/187/46) لا من [Full Wash]',jt['1700'].bookings===196&&jt['1648'].bookings===187&&jt['1624'].bookings===46);
ok('ملف يوليو: «Total Tips» قبل الرسوم لا تُستخدم (44 ⇒ 42.9)',jt['1648'].tips===42.9);
const tpx=parseTips([{'Company ID':'7','Total Bookings (Online) [Full Wash]':'3','Total Bookings (Online) [Exterior Wash]':'2','Total Bookings':'5','Net Tips (After Bank Fees)':'1'}]);
ok('غسيل خارجي: العدد 5 (الإجمالي) لا 3',tpx['7'].bookings===5);
ok('parseTips — يوليو: راكب 39.00، ميدول 42.90، عارف 0 (المجموع 81.90)',jt['1700'].tips===39&&jt['1648'].tips===42.9&&jt['1624'].tips===0&&Math.round((jt['1700'].tips+jt['1648'].tips+jt['1624'].tips)*100)===8190);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
