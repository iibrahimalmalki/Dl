// رسالة الواتساب لسطر المسير (src/payrollMessage.js): عربي/English/বাংলা، أرقام إنجليزية، المبلغ وآخر 4 أرقام من المرجع، المشرف عربي، لا مقارنة
import {payrollMessage,lineFacts,complaintCounts,monthName,last4} from '../src/payrollMessage.js';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
// ميدول يوليو كما في الإنتاج بعد الترحيل
const mid={role:'biker',name:'Midul Hassan',biker_id:'1648',period:'2026-07',net_bonus:565.4,inputs:{complaint_approved:4,tips:42.9},
  computed:{net_washes:190,rating:4.48,complaint_pct:2.1052631578947367,quality_riyal:0.5,safety_riyal:0.25,rate_per_wash:2.75,bonus_base:522.5,tips:42.9,production:0,deductions:0},
  payment_status:'paid',paid_at:'2026-10-13',paid_amount:565.4,payment_ref:'9113102600103372'};
const cc=complaintCounts([{decision:'approved'},{decision:'approved'},{decision:'approved'},{decision:'approved'},{decision:'rejected'},{decision:'rejected'},{decision:'rejected'},{decision:'rejected'},{decision:'rejected'}]);
ok('عدّ الشكاوى: 9 مرفوعة · 4 محسوبة · 5 مرفوضة',cc.raised===9&&cc.counted===4&&cc.rejected===5);
const ar=payrollMessage(mid,{lang:'ar',complaints:cc});
ok('عربي: الغسلات 190، التقييم 4.48، الشكاوى 9/4/5 والنسبة 2.11%',ar.includes('الغسلات الصافية: 190')&&ar.includes('التقييم: 4.48')&&ar.includes('9 مرفوعة · 4 محسوبة · 5 مرفوضة · النسبة 2.11%'));
ok('عربي: تفصيل السعر 2.00 + جودة 0.50 + سلامة 0.25 = 2.75 و190 × 2.75 = 522.50',ar.includes('2.00 + جودة 0.50 + سلامة 0.25 = 2.75')&&ar.includes('190 × 2.75 = 522.50'));
ok('عربي: الإكراميات 42.90 والصافي 565.40، ولا سطر إنتاج أو استقطاع بصفر',ar.includes('الإكراميات: 42.90')&&ar.includes('الصافي: 565.40 ريال')&&!ar.includes('الإنتاج')&&!ar.includes('الاستقطاعات'));
ok('عربي: تم التحويل 565.40 بتاريخ 2026-10-13 والمرجع آخر 4 أرقام فقط',ar.includes('تم التحويل: 565.40 ريال بتاريخ 2026-10-13 — المرجع …3372')&&!ar.includes('9113102600103372'));
const en=payrollMessage(mid,{lang:'en',complaints:cc}),bn=payrollMessage(mid,{lang:'bn',complaints:cc});
ok('English: July 2026، 190 washes، Transferred 565.40 SAR — ref …3372',en.includes('Payroll July 2026')&&en.includes('Net washes: 190')&&en.includes('Transferred: 565.40 SAR on 2026-10-13 — ref …3372'));
ok('বাংলা: জুলাই 2026، নিট ওয়াশ 190، পাঠানো হয়েছে 565.40 রিয়াল …3372',bn.includes('জুলাই 2026')&&bn.includes('নিট ওয়াশ: 190')&&bn.includes('পাঠানো হয়েছে: 565.40 রিয়াল')&&bn.includes('…3372'));
const all=payrollMessage(mid,{complaints:cc,note:'شكراً على جهدك'});
ok('الافتراضي: الثلاث بالترتيب عربي ثم English ثم বাংলা بفاصل، والكلمة في كل منها',all.indexOf('السلام عليكم')<all.indexOf('Hello')&&all.indexOf('Hello')<all.indexOf('আসসালামু')&&(all.match(/— — —/g)||[]).length===2&&(all.match(/شكراً على جهدك/g)||[]).length===3);
ok('أرقام إنجليزية فقط (لا ٠-٩ ولا ০-৯) حتى لو كُتبت الكلمة بأرقام عربية',!/[٠-٩০-৯]/.test(payrollMessage(mid,{complaints:cc,note:'مكافأة ٢٥ ريال'}))&&payrollMessage(mid,{lang:'ar',note:'مكافأة ٢٥'}).includes('مكافأة 25'));
ok('لا مقارنة بأحد ولا اسم بايكر آخر',!/أفضل من|أعلى من|مقارنة|better than|Arif|Rakib/i.test(all));
ok('بلا بيانات تذاكر: المحسوبة من المسير والنسبة فقط',payrollMessage(mid,{lang:'ar'}).includes('📋 الشكاوى: 4 محسوبة · النسبة 2.11%'));
const rak={...mid,name:'Mohamad Rakib',net_bonus:817.75,computed:{...mid.computed,net_washes:201,rating:4.5,complaint_pct:0.4975,quality_riyal:0.75,safety_riyal:1,rate_per_wash:3.75,bonus_base:753.75,tips:39,production:25},payment_ref:'9113102600103684',paid_amount:817.75};
const rk=payrollMessage(rak,{lang:'ar'});
ok('راكب: 2.00 + 0.75 + 1.00 = 3.75، الإنتاج 25.00، الإكراميات 39.00، الصافي 817.75',rk.includes('2.00 + جودة 0.75 + سلامة 1.00 = 3.75')&&rk.includes('الإنتاج: 25.00')&&rk.includes('الإكراميات: 39.00')&&rk.includes('الصافي: 817.75'));
const unpaid=payrollMessage({...mid,payment_status:'pending',paid_amount:null},{lang:'ar'});
ok('غير مدفوع: لا سطر تحويل',!unpaid.includes('تم التحويل'));
const sup={role:'supervisor',name:'سلمان المالكي',period:'2026-07',net_bonus:623.38,computed:{team_orders:439,team_rating:4.510000000000001,team_complaint_pct:1.1389521640091116,rate_per_order:1.42,deductions:0},payment_status:'deferred'};
const sm=payrollMessage(sup,{lang:'en'});
ok('المشرف: عربي دائماً، 439 طلباً، 4.51، 1.14%، 1.42، العمولة 623.38 مؤجَّلة',sm.includes('طلبات الفريق: 439')&&sm.includes('4.51')&&sm.includes('1.14%')&&sm.includes('1.42')&&sm.includes('623.38 ريال')&&sm.includes('مؤجَّلة')&&!sm.includes('Hello'));
ok('أسماء الأشهر وآخر 4 أرقام',monthName('2026-06','bn')==='জুন 2026'&&monthName('2026-12','en')==='December 2026'&&last4('9113 1026 0010 3372')==='…3372'&&last4('')==='');
ok('lineFacts: السعر الأساسي = السعر − الجودة − السلامة',lineFacts(mid).baseRate===2&&lineFacts(rak).baseRate===2);
