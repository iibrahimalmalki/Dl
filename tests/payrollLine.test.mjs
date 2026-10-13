// عرض سطر المسير المعتمد في البوابة (src/payrollLine.js)
import {lineView,latestLines,maskRef,money} from '../src/payrollLine.js';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const midJul={period:'2026-07',net_bonus:565.4,inputs:{net_washes:190,tips:42.9},computed:{net_washes:190,rate_per_wash:2.75,tips:42.9,production:0,deductions:0},
  payment_status:'paid',paid_at:'2026-10-13',paid_amount:565.4,payment_ref:'9113102600103372',base_paid:null};
const v=lineView(midJul);
ok('ميدول يوليو: 565.40 مدفوعة 2026-10-13',v.bonus===565.4&&v.status==='paid'&&v.paidAt==='2026-10-13'&&v.statusAr==='مدفوعة'&&v.statusBn==='পরিশোধিত');
ok('التفصيل: 190 غسلة × 2.75 + إكراميات 42.90',v.washes===190&&v.rate===2.75&&v.tips===42.9&&v.production===0);
ok('المرجع: آخر 4 أرقام فقط',v.ref==='…3372'&&maskRef('')===''&&maskRef('12')==='12');
ok('الأرقام إنجليزية بمنزلتين',money(565.4)==='565.40'&&money(1563.15)==='1,563.15');
const ab=lineView({period:'2026-07',net_bonus:0,inputs:{net_washes:''},computed:null,payment_status:'paid',paid_amount:0,base_paid:true});
ok('عابد: لا مكافأة والأساس مدفوع',ab.bonus===0&&ab.washes===0&&ab.basePaid===true&&ab.rate===null);
const def=lineView({period:'2026-07',net_bonus:623.38,payment_status:'deferred',paid_at:'2026-10-13'});
ok('المؤجَّل بلا تاريخ دفع',def.status==='deferred'&&def.paidAt===null&&def.statusAr==='مؤجَّلة');
ok('حالة غير معروفة ⇒ بانتظار الدفع',lineView({period:'2026-08',net_bonus:1,payment_status:null}).status==='pending');
const L=latestLines([{period:'2026-06',net_bonus:800.13},midJul,{period:'2026-05',net_bonus:1},{period:'2026-04',net_bonus:2}],3);
ok('الأحدث أولاً وثلاثة أشهر كحد',L.map(x=>x.period).join()==='2026-07,2026-06,2026-05');
ok('بلا أسطر ⇒ قائمة فارغة',latestLines(null).length===0&&lineView(null)===null);
