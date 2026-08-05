// سياسات وإجراءات سلاسل الإمداد — دلو ورغوة
// مستندة إلى الهيكل التنظيمي (الدعم اللوجستي) ونماذج الإعداد (FRM-OPS-001).

export const ITEM_CATS=["معدات غسيل","مواد تنظيف","زي","معدات سلامة","قطع غيار","دراجات","كاميرات","أخرى"];
export const CAT_ICON={"معدات غسيل":"bucket","مواد تنظيف":"bucket","زي":"shirt","معدات سلامة":"alert","قطع غيار":"wrench","دراجات":"bike","كاميرات":"camera","أخرى":"vendors"};

export const REQ_TYPES=["شراء","صيانة","صرف"]; // صرف = صرف من المخزون بلا شراء
export const REQ_STATUS={
  submitted:{ar:"بانتظار الاعتماد",c:"#b54708",bg:"#fef3e2"},
  approved:{ar:"معتمد",c:"#1d5bbf",bg:"#eef4ff"},
  rejected:{ar:"مرفوض",c:"#b42318",bg:"#feecea"},
  received:{ar:"مُستلم",c:"#087443",bg:"#e7f7ef"},
  closed:{ar:"مغلق",c:"#64748b",bg:"#f4f5f7"},
};

// حدّ الصلاحية: حتى 500 ﷼ ينفّذها اللوجستي؛ ما فوقها أو الدراجات أو الصيانة تُرفع للرئيس (اعتماد)
export const APPROVAL_THRESHOLD=500;
export function needsCeo(type,amount,category){
  if(type==="صرف")return false;               // صرف من المخزون — لا اعتماد مالي
  if(category==="دراجات")return true;          // شراء دراجة: قرار الرئيس حصراً
  if(type==="صيانة")return true;               // إصلاح: عرض سعر ثم اعتماد الرئيس
  return Number(amount||0)>APPROVAL_THRESHOLD;  // شراء فوق السقف
}

// قائمة تجهيز البايكر القياسية (عهدة FRM-OPS-001) — من مرحلة تسليم المعدات
export const STANDARD_KIT=[
  {name:"دراجة معتمدة",category:"دراجات",qty:1,custody:true},
  {name:"صندوق غسيل",category:"معدات غسيل",qty:1,custody:true},
  {name:"مضخة ماء",category:"معدات غسيل",qty:1,custody:true},
  {name:"مسدس ماء",category:"معدات غسيل",qty:1,custody:true},
  {name:"خراطيم",category:"معدات غسيل",qty:2,custody:true},
  {name:"صابون",category:"مواد تنظيف",qty:2,custody:false},
  {name:"منظف",category:"مواد تنظيف",qty:1,custody:false},
  {name:"مناشف (5 ألوان)",category:"مواد تنظيف",qty:5,custody:false},
  {name:"قميص سويتر",category:"زي",qty:2,custody:true},
  {name:"حذاء آمن",category:"زي",qty:1,custody:true},
  {name:"خوذة معتمدة",category:"معدات سلامة",qty:1,custody:true},
  {name:"كاميرا الدراجة",category:"كاميرات",qty:1,custody:true},
];

export const money=n=>Number(n||0).toLocaleString("en-US",{maximumFractionDigits:0})+" ﷼";
