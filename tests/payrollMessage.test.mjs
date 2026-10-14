// رسالة الواتساب لسطر المسير (src/payrollMessage.js) — مطابقة حرفية للنموذج المعتمد من المالك (2026-10-14)
import {payrollMessage,lineFacts,complaintCounts,monthName,last4,pct2,displayName} from '../src/payrollMessage.js';
import {computeBiker} from '../src/payrollEngine.js';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
// ميدول يوليو كما في الإنتاج بعد الترحيل
const mid={role:'biker',name:'Midul Hassan',biker_id:'1648',period:'2026-07',net_bonus:565.4,inputs:{complaint_approved:4,tips:42.9},
  computed:{net_washes:190,rating:4.48,complaint_pct:2.1052631578947367,quality_riyal:0.5,safety_riyal:0.25,rate_per_wash:2.75,bonus_base:522.5,tips:42.9,production:0,deductions:0},
  payment_status:'paid',paid_at:'2026-10-13',paid_amount:565.4,payment_ref:'9113102600103372'};
const cc=complaintCounts([...Array(4)].map(()=>({decision:'approved'})).concat([...Array(5)].map(()=>({decision:'rejected'}))));
ok('عدّ الشكاوى: 9 مرفوعة · 4 محسوبة · 5 مرفوضة',cc.raised===9&&cc.counted===4&&cc.rejected===5);
const notes={ar:'شكراً على جهدك هذا الشهر.',en:'Thank you for your effort this month.',bn:'এই মাসে আপনার পরিশ্রমের জন্য ধন্যবাদ।'};
const EXPECTED=`🟠 *دلو ورغوة × سويتر | يوليو 2026*
Bucket & Foam × Sweater | July 2026
ডালু ওয়ারগওয়া × সুইটার | জুলাই 2026

السلام عليكم أخ *ميدول* 👋
Assalamu Alaikum, Brother *Midul*
আস-সালামু আলাইকুম, ভাই *মিদুল*

━━━━━━━━━━━━━━━━━━━━
✅ *تم صرف مكافأة يوليو*
✅ *July Bonus Has Been Paid*
✅ *জুলাই মাসের বোনাস পরিশোধ হয়েছে*
━━━━━━━━━━━━━━━━━━━━

📊 *تفاصيل الأداء | Performance Details*

🔹 الغسلات الصافية | Net Washes
        *190 washes*

⭐ التقييم | Rating
        *4.48 / 5*

━━━━━━━━━━━━━━━━━━━━
🚨 *تفاصيل الشكاوى | Complaint Details*

   • مرفوعة | Filed:  *9*
   • محسوبة عليك | Accepted:  *4*
   • مرفوضة لصالحك | Rejected:  *5* 🎯

   ➡️ نسبة الشكاوى | Complaint rate: *2.11%*
━━━━━━━━━━━━━━━━━━━━

💰 *تفاصيل المكافأة | Bonus Breakdown*

   Base rate:         2.00
   Quality riyal:    +0.50
   Safety riyal:     +0.25
   ─────────────────────
   Rate / wash:      2.75 SAR
   190 × 2.75     =  522.50
   Tips:            + 42.90
   ─────────────────────
💵 *Net Bonus: 565.40 SAR*
💳 تم التحويل | Transferred: *565.40 SAR* · 2026-10-13 · Ref …3372
━━━━━━━━━━━━━━━━━━━━

🏆 *كلمة من الإدارة:*
شكراً على جهدك هذا الشهر.

*Management:* Thank you for your effort this month. 💪

*ম্যানেজমেন্ট:* এই মাসে আপনার পরিশ্রমের জন্য ধন্যবাদ। 💪
━━━━━━━━━━━━━━━━━━━━
🏢 مؤسسة دلو ورغوة | Dalu Warghwah Est.
📅 يوليو 2026 | July 2026`;
const MID_N={ar:'ميدول',bn:'মিদুল',en:'Midul'},RAK_N={ar:'رقيب',bn:'রাকিব',en:'Rakib'};
const got=payrollMessage(mid,{notes,complaints:cc,names:MID_N});
ok('ميدول يوليو يطابق النموذج المعتمد حرفياً (190، 4.48، 9/4/5، 2.11%، 2.75، 522.50، 42.90، 565.40، …3372)',got===EXPECTED);
if(got!==EXPECTED){const a=got.split('\n'),b=EXPECTED.split('\n');for(let i=0;i<Math.max(a.length,b.length);i++)if(a[i]!==b[i]){console.log('  سطر',i+1,'\n  الناتج:  ',JSON.stringify(a[i]),'\n  المتوقع: ',JSON.stringify(b[i]));break;}}
ok('أرقام إنجليزية في كل الأسطر حتى البنغالي (2026 لا ২০২৬)، وحتى لو كُتبت الكلمة بأرقام عربية/بنغالية',!/[٠-٩০-৯]/.test(got)&&!/[٠-٩০-৯]/.test(payrollMessage(mid,{notes:{ar:'مكافأة ٢٥',bn:'৫০ রিয়াল'}}))&&payrollMessage(mid,{notes:{ar:'مكافأة ٢٥'}}).includes('مكافأة 25'));
ok('أسماء العرض من ملف الموظف: العربي والبنغالي والإنجليزي منه',displayName(mid,'ar',MID_N)==='ميدول'&&displayName(mid,'bn',MID_N)==='মিদুল'&&displayName({name:'Mohamad Rakib'},'en',RAK_N)==='Rakib');
ok('الإنجليزي الفارغ ⇒ الاسم الأول المسجّل (رقيب ⇒ Mohamad)',displayName({name:'Mohamad Rakib'},'en',{ar:'رقيب',en:' '})==='Mohamad'&&displayName({name:'Mohamad Rakib'},'en',{})==='Mohamad');
ok('خانة فارغة ⇒ الاسم الأول المسجّل (لا أسماء مكتوبة في الكود)',displayName(mid,'ar',{})==='Midul'&&displayName(mid,'bn',{ar:'ميدول',bn:' '})==='Midul'&&displayName({name:'Abed mia'},'ar')==='Abed'&&payrollMessage(mid,{}).includes('أخ *Midul*'));
ok('Production لا يظهر عند الصفر، والإكراميات تظهر دائماً (حتى 0.00)',!got.includes('Production')&&payrollMessage({...mid,computed:{...mid.computed,tips:0},inputs:{}},{}).includes('   Tips:            + 0.00'));
const rak={...mid,name:'Mohamad Rakib',biker_id:'1700',net_bonus:817.75,computed:{...mid.computed,net_washes:201,rating:4.5,complaint_pct:0.4975124378109453,quality_riyal:0.75,safety_riyal:1,rate_per_wash:3.75,bonus_base:753.75,tips:39,production:25},payment_ref:'9113102600103684',paid_amount:817.75};
const rk=payrollMessage(rak,{names:RAK_N});
ok('رقيب: أخ *رقيب* / Rakib (name_en — الاسم المسجّل Mohamad Rakib لا يُعدَّل) / রাকিব، 201 × 3.75 = 753.75، Production + 25.00 🏆 قبل Tips + 39.00، Net 817.75، …3684',rk.includes('أخ *رقيب*')&&rk.includes('Brother *Rakib*')&&rk.includes('ভাই *রাকিব*')&&rk.includes('   201 × 3.75     =  753.75\n   Production:      + 25.00 🏆\n   Tips:            + 39.00')&&rk.includes('*Net Bonus: 817.75 SAR*')&&rk.includes('Ref …3684'));
ok('بلا كلمة إدارة: لا قسم ولا فاصل مكرر، والتذييل مباشرة بعد الفاصل',!rk.includes('كلمة من الإدارة')&&rk.includes('Ref …3684\n━━━━━━━━━━━━━━━━━━━━\n🏢 مؤسسة دلو ورغوة'));
ok('كلمة بلغة واحدة: سطرها فقط',(()=>{const t=payrollMessage(mid,{notes:{en:'Great work'}});return t.includes('*Management:* Great work 💪')&&!t.includes('🏆 *كلمة من الإدارة:*')&&!t.includes('ম্যানেজমেন্ট:');})());
ok('بلا بيانات تذاكر: المحسوبة من المسير، والمرفوعة/المرفوضة «—»',payrollMessage(mid,{}).includes('Filed:  *—*')&&payrollMessage(mid,{}).includes('Accepted:  *4*'));
ok('بلا مرجع ولا تاريخ: سطر التحويل بالمبلغ فقط',payrollMessage({...mid,payment_ref:null,paid_at:null},{}).includes('💳 تم التحويل | Transferred: *565.40 SAR*\n'));
ok('النسبة: تقريب عادي، ولا عبور لحدّ الشريحة (1.996 ⇒ 1.99، 2.996 ⇒ 3.00، 3.004 ⇒ 3.01، 0.995 ⇒ 0.99)',pct2(2.1052631578947367)==='2.11'&&pct2(1.996)==='1.99'&&pct2(2.996)==='3.00'&&pct2(3.004)==='3.01'&&pct2(0.995)==='0.99'&&pct2(1.4999)==='1.49'&&pct2(0)==='0.00');
ok('لا مقارنة بأحد ولا اسم بايكر آخر',!/أفضل من|أعلى من|مقارنة|better than|Ariful|Rakib|عريف|رقيب/i.test(got));
const sup={role:'supervisor',name:'سلمان المالكي',period:'2026-07',net_bonus:623.38,computed:{team_orders:439,team_rating:4.510000000000001,team_complaint_pct:1.1389521640091116,rate_per_order:1.42,deductions:0},payment_status:'deferred'};
const sm=payrollMessage(sup,{notes:{ar:'شكراً',en:'x'}});
ok('المشرف: عربي فقط، 439، 4.51، 1.14%، 1.42، 623.38 مؤجَّلة، والكلمة العربية فقط',sm.includes('طلبات الفريق: 439')&&sm.includes('4.51')&&sm.includes('1.14%')&&sm.includes('1.42')&&sm.includes('623.38 ريال')&&sm.includes('مؤجَّلة')&&sm.includes('شكراً')&&!/Management|Brother/.test(sm));
ok('أسماء الأشهر وآخر 4 أرقام',monthName('2026-06','bn')==='জুন 2026'&&monthName('2026-12','en')==='December 2026'&&last4('9113 1026 0010 3372')==='…3372'&&last4('')==='');
ok('lineFacts: السعر الأساسي = السعر − الجودة − السلامة',lineFacts(mid).baseRate===2&&lineFacts(rak).baseRate===2);
// الاستقطاعات: سطر بعد Production عند > 0 فقط، ومجموع البنود = الصافي (حساب المحرك نفسه)
const eng=computeBiker({level:'M1',net_washes:201,rating:4.5,complaint_pct:0.4975,tips:39,quality_deduction:20,deduct_damage:15.5});
const ded={...rak,net_bonus:eng.net_bonus,computed:eng,paid_amount:eng.net_bonus};
const dm=payrollMessage(ded,{});
ok('استقطاعات 35.50: «Deductions: − 35.50» بعد Production وقبل Tips',dm.includes('   Production:      + 25.00 🏆\n   Deductions:      − 35.50\n   Tips:            + 39.00'));
const num=(t,re)=>{const m=t.match(re);return m?Number(m[1]):0;};
const sum=num(dm,/=  ([\d.]+)/)+num(dm,/Production:\s+\+ ([\d.]+)/)+num(dm,/Tips:\s+\+ ([\d.]+)/)-num(dm,/Deductions:\s+− ([\d.]+)/);
ok('مجموع البنود في الرسالة = Net Bonus (753.75 + 25 + 39 − 35.50 = 782.25)',Math.abs(sum-num(dm,/Net Bonus: ([\d.]+)/))<0.005&&dm.includes('*Net Bonus: 782.25 SAR*'));
ok('بلا استقطاعات: لا سطر Deductions، والمجموع = الصافي لميدول (522.50 + 42.90 = 565.40)',!got.includes('Deductions')&&Math.abs(num(got,/=  ([\d.]+)/)+num(got,/Tips:\s+\+ ([\d.]+)/)-565.4)<0.005);
ok('سقف الاستقطاعات (500): المعروض هو المطبَّق فعلاً',(()=>{const e=computeBiker({level:'M1',net_washes:100,rating:4.5,complaint_pct:0,tips:0,deduct_damage:900});const t=payrollMessage({...mid,net_bonus:e.net_bonus,computed:e},{});return t.includes('Deductions:      − 500.00')&&t.includes(`*Net Bonus: ${e.net_bonus.toFixed(2)} SAR*`);})());
