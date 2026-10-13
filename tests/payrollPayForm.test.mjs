// نموذج «تسجيل الدفع» في صفحة المسير (src/payrollPayForm.js): القيم الابتدائية، والتحقق المطابق لـrecord_payroll_payment، والوسائط، والملخص
import {PAY_ST,capOf,payFormInit,payFormError,payArgs,payTotals,periodStart,statusPatch} from '../src/payrollPayForm.js';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const TODAY='2026-10-14';
const supJun={id:'e42e',period:'2026-06',role:'supervisor',name:'سلمان المالكي',net_bonus:533.52,payment_status:'deferred',pay_note:'مؤجَّل مع عمولات المشرف (P5)',bank_fee:0};
const midJul={id:'700d',period:'2026-07',role:'biker',name:'Midul Hassan',biker_id:'1648',net_bonus:565.4,payment_status:'paid',paid_at:'2026-10-13',paid_amount:565.4,payment_ref:'9113102600103372',bank_fee:0.58,pay_note:null,base_paid:null};
const abed={id:'5093',period:'2026-07',role:'biker',net_bonus:0,payment_status:'paid',paid_amount:0,base_paid:true,pay_note:'بدون غسلات'};
const opt={period:'2026-06',today:TODAY};

ok('الحالات الثلاث بالعربي',PAY_ST.map(x=>x.v).join()==='paid,deferred,pending');
ok('السقف = المكافأة الموجبة بمنزلتين، والسالبة ⇒ 0',capOf({net_bonus:533.524})===533.52&&capOf({net_bonus:-40})===0&&periodStart('2026-07')==='2026-07-01');
const i1=payFormInit(supJun,TODAY),i2=payFormInit(midJul,TODAY),i3=payFormInit(abed,TODAY);
ok('غير المدفوع: المبلغ = المكافأة، التاريخ = اليوم، الرسوم 0، والملاحظة المسجّلة',i1.status==='deferred'&&i1.amount==='533.52'&&i1.paid_at===TODAY&&i1.fee==='0'&&i1.note.includes('P5'));
ok('المدفوع: قيمه المسجّلة (التاريخ والمبلغ والمرجع والرسوم)',i2.paid_at==='2026-10-13'&&i2.amount==='565.4'&&i2.ref==='9113102600103372'&&i2.fee==='0.58'&&i2.base==='');
ok('الأساس المدفوع ⇒ «yes»، ومدفوع بلا تاريخ مسجّل (عابد) ⇒ التاريخ فارغ لا «اليوم»',i3.base==='yes'&&i3.paid_at==='');

const f=(o={})=>({...payFormInit(supJun,TODAY),status:'paid',paid_at:'2026-10-05',note:'',...o});
ok('مدفوع كامل صحيح ⇒ لا خطأ',payFormError(f(),supJun,opt)===null);
ok('تاريخ فارغ/مستقبلي/قبل الشهر ⇒ خطأ في حقل التاريخ',payFormError(f({paid_at:''}),supJun,opt).field==='paid_at'&&payFormError(f({paid_at:'2026-10-15'}),supJun,opt).field==='paid_at'&&payFormError(f({paid_at:'2026-05-31'}),supJun,opt).field==='paid_at');
ok('أكثر من المكافأة ⇒ خطأ المبلغ',payFormError(f({amount:'533.53'}),supJun,opt).field==='amount');
ok('صفر والمكافأة موجبة ⇒ خطأ المبلغ',/مؤجَّلة/.test(payFormError(f({amount:'0'}),supJun,opt).ar));
ok('صفر والمكافأة صفر (عابد) ⇒ مقبول بتاريخ يُدخله المالك، وبلا تاريخ ⇒ «إلزامي» لا «اليوم»',payFormError({...payFormInit(abed,TODAY),paid_at:'2026-08-01'},abed,{period:'2026-07',today:TODAY})===null&&payFormError(payFormInit(abed,TODAY),abed,{period:'2026-07',today:TODAY}).field==='paid_at');
ok('دفع جزئي بلا ملاحظة ⇒ خطأ الملاحظة، ومعها مقبول',payFormError(f({amount:'500'}),supJun,opt).field==='note'&&payFormError(f({amount:'500',note:'دفعة أولى'}),supJun,opt)===null);
ok('أرقام عربية والفاصلة «٫» وفواصل الآلاف تُقبل، والنص ⇒ «ليس رقماً»',payFormError(f({amount:'٥٣٣٫٥٢'}),supJun,opt)===null&&payArgs(f({amount:'1,234.50'}),supJun).p_amount===1234.5&&/ليس رقماً/.test(payFormError(f({amount:'abc'}),supJun,opt).ar));
ok('رسوم 60 ⇒ خطأ الرسوم',payFormError(f({fee:'60'}),supJun,opt).field==='fee');
ok('مؤجَّل بلا سبب ⇒ خطأ',payFormError({status:'deferred',note:' '},supJun,opt).field==='note');
ok('تراجع إلى «بانتظار»: بلا سبب ⇒ خطأ، وبأي سبب ⇒ مقبول (كالقاعدة)',payFormError({status:'pending',note:' '},supJun,opt).field==='note'&&payFormError({status:'pending',note:supJun.pay_note},supJun,opt)===null);
ok('تاريخ أساس بلا «مدفوع» ⇒ خطأ',payFormError(f({base:'no',base_at:'2026-07-01'}),supJun,opt).field==='base_at');
ok('مسح تاريخ أساس مسجّل مع «مدفوع» ⇒ يُرشد إلى «غير مدفوع» أولاً (الدالة تُبقيه)',/غير مدفوع/.test(payFormError(f({base:'yes',base_at:''}),{...supJun,base_paid:true,base_paid_at:'2026-07-12'},opt).ar));

const a=payArgs(f({ref:' 911 ',fee:'0.58',note:' عمولات '}),supJun);
ok('الوسائط: مدفوع بكل القيم صريحة والمرجع والملاحظة مقصوصان',a.p_line==='e42e'&&a.p_status==='paid'&&a.p_paid_at==='2026-10-05'&&a.p_amount===533.52&&a.p_ref==='911'&&a.p_fee===0.58&&a.p_note==='عمولات'&&a.p_base_paid===null&&a.p_base_paid_at===null);
const b=payArgs({status:'deferred',note:'P5',amount:'500',paid_at:'2026-10-05',ref:'x',fee:'1',base:'yes',base_at:'2026-07-01'},supJun);
ok('مؤجَّل: لا تاريخ ولا مبلغ ولا مرجع ولا رسوم (الدالة ترفضها)، والأساس بتاريخه',b.p_paid_at===null&&b.p_amount===null&&b.p_ref===null&&b.p_fee===null&&b.p_base_paid===true&&b.p_base_paid_at==='2026-07-01');
ok('الأساس «غير مدفوع» ⇒ false بلا تاريخ، والفارغ ⇒ null (بلا تغيير)',payArgs({status:'pending',base:'no',base_at:'x'},supJun).p_base_paid===false&&payArgs({status:'pending',base:'no',base_at:'x'},supJun).p_base_paid_at===null&&payArgs({status:'pending',base:''},supJun).p_base_paid===null);
ok('مرجع فارغ يُرسل "" (يمسح) لا null',payArgs(f({ref:''}),supJun).p_ref==='');

const T=payTotals([supJun,midJul,abed,{net_bonus:735,payment_status:'pending'},{net_bonus:400,payment_status:'paid',paid_amount:350}]);
ok('الملخص: المستحق والمدفوع والمؤجَّل والمعلّق والرسوم والأعداد، والمتبقي من الدفع الجزئي ظاهر',T.due===2233.92&&T.paid===915.4&&T.deferred===533.52&&T.pending===735&&T.short===50&&T.n.short===1&&T.fees===0.58&&T.n.paid===3&&T.n.deferred===1&&T.n.pending===1
  &&Math.abs(T.paid+T.short+T.deferred+T.pending-T.due)<0.001);
const sp=statusPatch(payFormInit(supJun,TODAY),supJun,'paid');
ok('تغيير الحالة: سبب التأجيل القديم لا ينتقل إلى «مدفوعة»، ويعود عند الرجوع',sp.status==='paid'&&sp.note===''&&statusPatch({...payFormInit(supJun,TODAY),...sp},supJun,'deferred').note===supJun.pay_note);
ok('ملاحظة عدّلها المالك تبقى عند تغيير الحالة',statusPatch({status:'deferred',note:'عمولات P5 — دفعة أكتوبر'},supJun,'paid').note==='عمولات P5 — دفعة أكتوبر');

// ── «تسجيل دفع للكل»: حوالة يونيو الواحدة لثلاثة بايكرز ──
import('../src/payrollPayForm.js').then(({bulkTotal,bulkError,bulkArgs})=>{
  const jun=[{id:'a',period:'2026-06',role:'biker',name:'Ariful',net_bonus:360.75,payment_status:'paid',bank_fee:0},{id:'m',period:'2026-06',role:'biker',name:'Midul',net_bonus:800.13,payment_status:'paid'},
    {id:'r',period:'2026-06',role:'biker',name:'Rakib',net_bonus:502,payment_status:'paid'},{id:'s',period:'2026-06',role:'supervisor',net_bonus:533.52,payment_status:'deferred'}];
  const b={ids:['a','m','r'],paid_at:'2026-10-04',ref:'9113102600100001',fee:'0.58',note:''};
  ok('المجموع 1,662.88 لثلاثة أسطر',bulkTotal(jun,b.ids)===1662.88);
  ok('بلا أسطر/بلا تاريخ/تاريخ مستقبلي/رسوم 60 ⇒ أخطاء',bulkError({...b,ids:[]},jun,{today:TODAY}).field==='ids'&&bulkError({...b,paid_at:''},jun,{today:TODAY}).field==='paid_at'&&bulkError({...b,paid_at:'2026-10-20'},jun,{today:TODAY}).field==='paid_at'&&bulkError({...b,fee:'60'},jun,{today:TODAY}).field==='fee'&&bulkError(b,jun,{today:TODAY})===null);
  const A=bulkArgs(b,jun);
  ok('الوسائط: 3 أسطر «مدفوعة» بمكافأة كل سطر كاملة والتاريخ والمرجع نفسيهما',A.length===3&&A.every(a=>a.p_status==='paid'&&a.p_paid_at==='2026-10-04'&&a.p_ref==='9113102600100001')&&A.map(a=>a.p_amount).join()==='360.75,800.13,502');
  ok('الرسوم مرة واحدة على أول سطر، والبقية null (بلا تغيير)، والملاحظة الفارغة null (تبقى ملاحظة الترحيل)',A[0].p_fee===0.58&&A[1].p_fee===null&&A[2].p_fee===null&&A.every(a=>a.p_note===null&&a.p_base_paid===null));
  ok('المرجع الفارغ ⇒ null (لا يمسح مرجعاً مسجّلاً)',bulkArgs({...b,ref:' '},jun)[0].p_ref===null);
});
