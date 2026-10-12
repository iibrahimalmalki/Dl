// طلبات الوقود والزيت و«تنبيهات الأسطول» — المنطق النقي (src/fleetRequests.js)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.fr-test-'));
try{
execSync(`npx esbuild src/fleetRequests.js --bundle --format=esm --platform=node --outfile=${tmp}/t.mjs --log-level=error`,{stdio:'inherit'});
const F=await import(`${tmp}/t.mjs`);

ok('المبلغ الافتراضي 50﷼',F.DEFAULT_FUEL_AMOUNT===50);
ok('numInput: ينقّي أثناء الكتابة (أرقام عربية/بنغالية، فاصلة ⇒ نقطة، حذف الحروف)',F.numInput('١٤٢a٣٠')==='14230'&&F.numInput('৫০')==='50'&&F.numInput('8٫5')==='8.5'&&F.numInput(null)==='');
ok('parseNum: أرقام عربية وبنغالية وفاصلة عربية، والنص غير الرقمي ⇒ null',F.parseNum('١٤٢٣٠')===14230&&F.parseNum('১২')===12&&F.parseNum('8٫5')===8.5&&F.parseNum(' 50 ')===50&&F.parseNum('12a')===null&&F.parseNum('')===null&&F.parseNum(null)===null);

// النماذج: الرفض لنقص حقل إلزامي فقط، بلا حدود ولا مقارنات
ok('طلب الوقود: العدّاد ثم المبلغ ثم الصورة',F.fuelRequestError({odometer:'',amount:50,odoPhoto:1}).field==='odometer'&&F.fuelRequestError({odometer:'5',amount:'0',odoPhoto:1}).field==='amount'
  &&F.fuelRequestError({odometer:'5',amount:50,odoPhoto:null}).field==='odoPhoto'&&F.fuelRequestError({odometer:'5',amount:50,odoPhoto:1})===null);
ok('لا منع: عدّاد 0 أو أقل من السابق يُقبل في النموذج (لا مقارنة في البوابة)',F.fuelRequestError({odometer:'0',amount:50,odoPhoto:1})===null);
ok('كل رسالة نقص بالعربي والبنغالي',['odometer','amount','odoPhoto'].every(f=>{const e=F.fuelRequestError({odometer:f==='odometer'?'':'1',amount:f==='amount'?'':'5',odoPhoto:f==='odoPhoto'?null:1});return e&&e.ar&&e.bn;}));
ok('التعبئة: الفاتورة إلزامية، واللترات اختيارية لكن رقم إن وُجدت',F.fillError({odometer:'5',amount:'20',liters:'',odoPhoto:1,receipt:null}).field==='receipt'
  &&F.fillError({odometer:'5',amount:'20',liters:'x',odoPhoto:1,receipt:1}).field==='liters'&&F.fillError({odometer:'5',amount:'20',liters:'',odoPhoto:1,receipt:1})===null);
ok('طلب الزيت: عدّاد + صورة',F.oilRequestError({odometer:'',odoPhoto:1}).field==='odometer'&&F.oilRequestError({odometer:'9',odoPhoto:1})===null);
ok('تأكيد الزيت: صورة العدّاد ثم الفاتورة/الملصق ثم اسم مسؤول سويتر',F.oilConfirmError({odometer:'9',odoPhoto:1,proof:null,tech:'x'}).field==='proof'
  &&F.oilConfirmError({odometer:'9',odoPhoto:1,proof:1,tech:'  '}).field==='tech'&&F.oilConfirmError({odometer:'9',odoPhoto:1,proof:1,tech:'Rashed'})===null);

// رسائل أخطاء الدوال
const be=F.bikerRpcError({message:'NO_BIKE'});
ok('خطأ NO_BIKE ⇒ رسالة عربية + بنغالية + تواصل مع الإدارة',be&&be.code==='E-NO_BIKE'&&be.bn&&be.action==='whatsapp');
ok('خطأ غير معروف أو خطأ شبكة ⇒ null (يُترك لـ humanError)',F.bikerRpcError({message:'Failed to fetch'})===null&&F.bikerRpcError(null)===null);
ok('أخطاء الإدارة بالعربي، وغير المعروف يعرض نصه',F.adminRpcError({message:'P0001: REF_REQUIRED'})==='أدخل مرجع التحويل.'&&/boom/.test(F.adminRpcError({message:'boom'})));

// الحالات
ok('حالات الوقود والزيت بلغتين',['requested','transferred','closed'].every(s=>F.FUEL_STATUS[s].ar&&F.FUEL_STATUS[s].bn)&&['requested','sent','done','approved'].every(s=>F.OIL_STATUS[s].ar&&F.OIL_STATUS[s].bn));
ok('حالة غير معروفة لا تكسر العرض',F.statusOf(F.FUEL_STATUS,'x').ar==='x');

// الإدارة: «المطلوبة» غير المحوَّلة أولاً والأقدم أولاً
const R=[{id:'a',status:'transferred',transferred_at:'2026-10-02'},{id:'b',status:'requested',requested_at:'2026-10-05'},{id:'c',status:'requested',requested_at:'2026-10-01'},{id:'d',status:'closed',requested_at:'2026-09-01'}];
const S=F.splitRequests(R);
ok('splitRequests: المطلوبة الأقدم أولاً، ثم المحوَّلة، ثم المغلقة',S.pending.map(x=>x.id).join()==='c,b'&&S.transferred.map(x=>x.id).join()==='a'&&S.closed.map(x=>x.id).join()==='d');
const O=F.splitOil([{id:1,status:'requested',requested_at:'2026-10-03'},{id:2,status:'done',requested_at:'2026-10-01'},{id:3,status:'sent',requested_at:'2026-10-02'},{id:4,status:'approved',approved_at:'2026-09-01'}]);
ok('splitOil يوزّع الحالات الأربع',O.requested.length===1&&O.sent[0].id===3&&O.done[0].id===2&&O.approved[0].id===4);
ok('openOil: أحدث طلب مطلوب/مُرسل، والمعتمد أو المنفّذ لا يُعد مفتوحاً',F.openOil([{id:1,status:'approved',requested_at:'2026-10-09'},{id:2,status:'sent',requested_at:'2026-10-05'},{id:3,status:'requested',requested_at:'2026-10-06'}]).id===3&&F.openOil([{status:'done'}])===null);
const now=Date.parse('2026-10-12T12:00:00Z');
ok('since: ساعات ثم أيام',F.since('2026-10-12T11:30:00Z',now)==='أقل من ساعة'&&F.since('2026-10-12T02:00:00Z',now)==='10 ساعة'&&F.since('2026-10-08T12:00:00Z',now)==='4 يوم');

// التنبيهات لكل دراجة
const G=F.alertsByVehicle([{vehicle_id:'v2',plate:'B',severity:'info',kind:'close_fills',at:'2026-10-10'},{vehicle_id:'v1',plate:'A',severity:'warn',kind:'oil_due',at:'2026-10-11'},
  {vehicle_id:'v2',plate:'B',severity:'warn',kind:'no_receipts',at:'2026-10-09'},{vehicle_id:'v2',plate:'B',severity:'warn',kind:'odometer_jump',at:'2026-10-11'}]);
ok('alertsByVehicle: تجميع لكل دراجة، الأكثر تحذيرات أولاً، والتحذير قبل المعلومة داخل الدراجة',G.length===2&&G[0].plate==='B'&&G[0].items.map(i=>i.kind).join()==='odometer_jump,no_receipts,close_fills'&&G[1].items.length===1);
ok('أسماء كل أنواع التنبيه الثمانية',['high_consumption','close_fills','no_receipts','fill_without_request','odometer_backwards','odometer_jump','oil_due','oil_overdue'].every(k=>F.alertAr(k)!==k));
ok('لا يوجد في التنبيهات المجمّعة أي حقل درّاج',!JSON.stringify(G).includes('biker'));

// الحدود
ok('الحدود التسعة بأسماء ووحدات',F.SETTINGS.length===9&&F.SETTINGS.every(s=>s.ar&&s.unit));
ok('settingError: موجبة، والنسبة < 100',F.settingError('fill_gap_km','0')&&F.settingError('fuel_low_pct','100')&&F.settingError('fuel_low_pct','25')===null&&F.settingError('oil_interval_km','٢٠٠٠')===null);

// تكلفة الكيلو الشهرية
const reqs=[{vehicle_id:'v1',plate:'A',amount:50,odometer:1000,requested_at:'2026-10-01T08:00:00Z',transferred_at:'2026-10-01T09:00:00Z'},
  {vehicle_id:'v1',plate:'A',amount:50,odometer:1800,requested_at:'2026-10-09T08:00:00Z',transferred_at:'2026-10-09T09:00:00Z'},
  {vehicle_id:'v1',plate:'A',amount:50,odometer:900,requested_at:'2026-09-20T08:00:00Z',transferred_at:'2026-09-20T09:00:00Z'},
  {vehicle_id:'v2',plate:'B',amount:50,odometer:500,requested_at:'2026-10-03T08:00:00Z',transferred_at:null}];
const fills=[{vehicle_id:'v1',plate:'A',odometer:2000,fill_at:'2026-10-10T08:00:00Z'},{vehicle_id:'v1',plate:'A',odometer:5,fill_at:'2026-10-02T08:00:00Z',legacy:true}];
const C=F.monthlyCostPerKm('2026-10',reqs,fills);
ok('تكلفة الكيلو: تحويلات أكتوبر 100﷼ ÷ (2000 − 1000) كم = 0.1، وسبتمبر والـlegacy خارجها',C.find(r=>r.plate==='A').amount===100&&C.find(r=>r.plate==='A').km===1000&&C.find(r=>r.plate==='A').perKm===0.1);
ok('دراجة بلا تحويل ولا مسافة في الشهر لا تظهر',!C.find(r=>r.plate==='B'));
const C2=F.monthlyCostPerKm('2026-10',[{vehicle_id:'v3',plate:'C',amount:50,odometer:100,requested_at:'2026-10-01',transferred_at:null},{vehicle_id:'v3',plate:'C',amount:50,odometer:400,requested_at:'2026-10-05',transferred_at:null}],[]);
ok('مسافة بلا تحويل ⇒ تظهر بلا تكلفة للكيلو (لا قسمة على صفر)',C2[0].km===300&&C2[0].perKm===null);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
