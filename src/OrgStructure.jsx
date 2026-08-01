import{useState}from"react";
import Icon from"./Icon";

// ═══ بيانات الهيكل التنظيمي — مؤسسة دلو ورغوة (SSP-ID47) ═══
const SC={
  ops:  {head:"#087443",tint:"#e7f7ef",bd:"#b7e4cd",bar:"#12b76a",badge:"SECTOR A"},
  strat:{head:"#1d5bbf",tint:"#eef4ff",bd:"#d5e3fb",bar:"#2f6fe0",badge:"SECTOR B"},
  sup:  {head:"#b54708",tint:"#fef3e2",bd:"#f7dcae",bar:"#f79009",badge:"SECTOR C"},
};

const SECTORS=[
  {key:"ops",ar:"قطاع العمليات",head:"مدير العمليات",depts:[
    {id:"ops1",ar:"إدارة التشغيل الميداني",staff:"مشرف ميداني · قادة فرق · بايكرز",ic:"operations",
      main:["إدارة البايكرز يومياً وضمان تحقيق أهداف الغسلات والجودة","توزيع البايكرز على الزونات الجغرافية المحددة من سويتر","الإشراف على فرق العمل بنظام كل 7 بايكرز تحت قائد فريق","إدارة البايكرز التابعين لمشغلي الغير ضمن نفس منظومة الإشراف","التصعيد الفوري للحوادث والمشكلات الميدانية","رفع تقارير الأداء اليومية والأسبوعية"],
      detail:[{h:"المهام التفصيلية اليومية",items:["متابعة انطلاق البايكرز في الوقت المحدد ورصد الغيابات","مراقبة حالات التطبيق (On the Way / Arrived / Done) وضمان التحديث الفوري","التدخل الفوري عند بلوغ انتظار 10 دقائق بدون رد من بايكر","توثيق أي حادثة أو شكوى ميدانية برصد الصور والتفاصيل","إدارة جدول الحضور والانصراف والإجازات","التأكد من نظافة وجاهزية صناديق الغسيل يومياً","الإشراف على بايكرز مشغلي الغير وضمان التزامهم بمعايير سويتر"]},
              {h:"نظام الفرق",items:["كل 7 بايكرز ← قائد فريق (مُعيَّن من أفضل البايكرز)","قائد الفريق يرفع للمشرف الميداني مباشرة","المشرف الميداني يرفع لمدير العمليات","الحد الأقصى للمشرف الميداني الواحد: 3 فرق (21 بايكراً)"]}],
      contacts:[{d:"in",n:"مدير العمليات",t:"يرفع إليه التقارير اليومية وحالات التصعيد — خط التقرير الأساسي"},{d:"in",n:"إدارة الجودة وعلاقة سويتر",t:"يُحيل الشكاوى الموثقة — لا يتواصل مع سويتر مباشرة"},{d:"in",n:"إدارة الموارد البشرية",t:"يُبلّغ بالغيابات والإجازات والمخالفات للتوثيق الرسمي"},{d:"in",n:"إدارة الدعم اللوجستي",t:"يطلب الصيانة والمواد والمعدات عبر نموذج رسمي مع عرض سعر"},{d:"out",n:"البايكرز (دلو ورغوة + مشغلو الغير)",t:"تواصل مباشر يومي — التعليمات الرسمية عبر مجموعة العمل فقط"},{d:"out",n:"منسق التجنيد (حسين)",t:"تنسيق غير رسمي للمشكلات الاجتماعية والترجمة — لا سلطة تشغيلية"}],
      auth:[{t:"توزيع الزونات اليومي",b:[["r","ينفذ"]]},{t:"تسجيل مخالفة ميدانية",b:[["r","ينفذ"],["c","يوصي بالجزاء"]]},{t:"اعتماد الشكوى ضد السلامة",b:[["c","يوصي فقط"]],note:"القرار للرئيس التنفيذي"},{t:"إيقاف بايكر عن العمل مؤقتاً",b:[["c","يوصي"]],note:"الاعتماد لمدير العمليات"},{t:"صرف مواد تشغيلية طارئة",b:[["r","ينفذ"]],note:"حتى 200 ﷼ دون رجوع"},{t:"التواصل مع سويتر تشغيلياً",b:[["i","يُبلَّغ فقط"]],note:"التواصل عبر إدارة الجودة"}]},
    {id:"ops2",ar:"إدارة الاستقطاب والتأهيل",staff:"مسؤول استقطاب · مدرب ميداني",ic:"applicants",
      main:["استقطاب البايكرز لدلو ورغوة ولمشغلي الغير (B2B)","إدارة دورة التأهيل الكاملة: تدريب قيادة ← رخصة ← تشغيلي ← تسليم","تنسيق إصدار رخص القيادة وتحمل تكلفتها مع نظام الاسترداد","إدارة منصة التوظيف الرقمية","بناء قاعدة مرشحين مستمرة عبر شبكة حسين والقنوات الرسمية"],
      detail:[{h:"مراحل التأهيل التفصيلية",items:["المرحلة 1 — الاستقطاب: إعلان ← تصفية ← مقابلة ← قبول مبدئي","المرحلة 2 — الترخيص: دفع 2,000 ﷼ ← تدريب قيادة ← اختبار ← استلام رخصة","المرحلة 3 — التأهيل النظري: سياسات دلو ورغوة + معايير سويتر + SOP","المرحلة 4 — الميداني: مرافقة بايكر متمكن 3 أيام + تقييم + اعتماد","المرحلة 5 — التسليم: عهدة كاملة + عقد + توقيع السياسات + إدراج في النظام"]}],
      contacts:[{d:"in",n:"إدارة الموارد البشرية",t:"تسليم ملف الموظف الجديد وتوثيق العقد والرواتب"},{d:"in",n:"إدارة التشغيل الميداني",t:"تسليم البايكر المؤهل للمشرف الميداني رسمياً"},{d:"in",n:"إدارة الدعم اللوجستي",t:"طلب الدرجة والعهدة قبل 7 أيام من تاريخ التسليم"},{d:"out",n:"حسين (شبكة التجنيد)",t:"القناة الأساسية للوصول للمجتمع البنغالي والمرشحين"},{d:"out",n:"جهات إصدار الرخص",t:"تنسيق مراكز التدريب وإصدار الرخص والمتطلبات المرورية"},{d:"out",n:"مشغلو الغير (B2B)",t:"استلام متطلباتهم من البايكرز وتنفيذ دورة التأهيل لصالحهم"}],
      auth:[{t:"قبول مرشح للتأهيل",b:[["r","ينفذ"],["c","يوصي"]],note:"القرار النهائي لمدير العمليات"},{t:"صرف 2,000 ﷼ تكلفة رخصة",b:[["c","يوصي"]],note:"الاعتماد للرئيس التنفيذي"},{t:"اعتماد جاهزية البايكر للتشغيل",b:[["r","ينفذ التقييم"]],note:"الاعتماد لمدير العمليات"},{t:"إلغاء تأهيل مرشح",b:[["c","يوصي"]],note:"القرار لمدير العمليات"}]},
    {id:"ops3",ar:"إدارة خدمات التمكين B2B",staff:"مستشار تشغيلي · مدرب",ic:"link",
      main:["استقطاب وتأهيل البايكرز لصالح المشغل العميل (رسوم لكل بايكر)","تدريب قيادة الدراجة النارية وإصدار الرخصة","تأهيل تشغيلي كامل على معايير سويتر","تزويد المشغل بالمنظومة الوثائقية الكاملة (SOPs + سياسات)","إشراف مشترك في مرحلة التأسيس (30–60 يوماً)","تأهيل وتدريب مشرف المشغل العميل","استشارة تشغيلية شهرية مستمرة (اشتراك شهري)"],
      detail:[],
      contacts:[{d:"in",n:"إدارة الاستقطاب والتأهيل",t:"تنفيذ دورة التأهيل للبايكرز التابعين للعملاء"},{d:"in",n:"إدارة الشراكات والتوسع",t:"تسليم العقود وآليات التسعير للعملاء الجدد"},{d:"out",n:"مشغلو الغير (SSP عملاء)",t:"الجهة المستفيدة — يتلقون الخدمة ويدفعون رسوم التمكين"}],
      auth:[{t:"قبول عميل B2B جديد",b:[["c","يوصي"]],note:"القرار للرئيس التنفيذي"},{t:"تقديم عرض سعر للعميل",b:[["r","ينفذ"]],note:"بعد اعتماد الأسعار من الرئيس التنفيذي"},{t:"تسليم المنظومة الوثائقية",b:[["r","ينفذ"]],note:"بإذن مسبق من الرئيس التنفيذي لكل حالة"}]},
  ]},
  {key:"strat",ar:"قطاع الاستراتيجية والتطوير",head:"مدير الاستراتيجية",depts:[
    {id:"st1",ar:"إدارة الجودة وعلاقة سويتر",staff:"أخصائي جودة · متابع شكاوى",ic:"star",
      main:["إدارة شكاوى العملاء ومتابعتها حتى الإغلاق","رفع الاعتراضات على Trello خلال نافذة 24 ساعة","التواصل اليومي مع ريم الشبرمي وعبدالله الخراشي","مراقبة مؤشرات SLA وإنذار مبكر عند الاقتراب من الحدود","إعداد تقارير الجودة الشهرية للرئيس التنفيذي","حماية الإيراد من الخصومات عبر الاعتراضات الموثقة"],
      detail:[{h:"آلية إدارة الشكاوى",items:["استلام الشكوى من سويتر ← توثيق فوري ← جمع الأدلة من الميدان","مراجعة الأدلة مع المشرف الميداني ← صياغة الاعتراض ← رفعه في Trello","متابعة رد سويتر خلال 24 ساعة ← تصعيد لمدير الاستراتيجية إذا لزم","توثيق النتيجة (مقبول/مرفوض) وأثرها المالي على الفاتورة","تحليل أنماط الشكاوى شهرياً وتقديم توصيات للتشغيل"]}],
      contacts:[{d:"out",n:"ريم الشبرمي — مدير جودة سويتر",t:"التواصل في شكاوى الجودة والاعتراضات"},{d:"out",n:"عبدالله الخراشي — دعم شركاء سويتر",t:"التواصل في المسائل التشغيلية والتعاقدية"},{d:"out",n:"منصة Trello — سويتر",t:"رفع الاعتراضات وتتبعها رسمياً"},{d:"in",n:"إدارة التشغيل الميداني",t:"استلام الأدلة الميدانية لدعم الاعتراضات"},{d:"in",n:"الرئيس التنفيذي",t:"تصعيد القضايا الكبرى وطلب اعتماد قرارات التسوية"}],
      auth:[{t:"رفع اعتراض على شكوى",b:[["r","ينفذ"]]},{t:"قبول تسوية مالية مع سويتر",b:[["c","يوصي"]],note:"القرار للرئيس التنفيذي"},{t:"إغلاق شكوى دون اعتراض",b:[["c","يوصي"]],note:"القرار للرئيس التنفيذي"},{t:"طلب بيانات أداء من الميدان",b:[["r","ينفذ"]]},{t:"تعديل في سياسة الجودة الداخلية",b:[["c","يوصي"]],note:"الاعتماد للرئيس التنفيذي"}]},
    {id:"st2",ar:"إدارة الشراكات والتوسع",staff:"مسؤول شراكات",ic:"target",
      main:["بناء العلاقات مع مشغلي SSP المحتملين (عملاء B2B)","التفاوض وإعداد عروض خدمات التمكين","التنسيق مع سويتر للحصول على الموافقات الاستراتيجية","رصد السوق وفرص التوسع الجغرافي","إدارة العلاقة مع جهات التمويل (بنك التنمية وغيره)","بناء الملف الاستثماري للمشروع"],
      detail:[],
      contacts:[{d:"out",n:"سويتر (قيادة عليا)",t:"طلب موافقات استراتيجية وعرض نموذج B2B"},{d:"out",n:"بنك التنمية الاجتماعية",t:"ملفات التمويل ومتطلبات القرض"},{d:"out",n:"مشغلو SSP المحتملون",t:"التواصل والتفاوض وتقديم عروض التمكين"},{d:"in",n:"الرئيس التنفيذي",t:"يرفع إليه كل اتفاقية أو عرض قبل التقديم الخارجي"}],
      auth:[]},
    {id:"st3",ar:"إدارة التخطيط والتطوير المؤسسي",staff:"مخطط استراتيجي",ic:"chart",
      main:["بناء وتحديث خطة العمل السنوية والمتوسطة المدى","تطوير وصيانة المنظومة الوثائقية (SOPs + سياسات + أدلة)","بناء وتطوير الهوية المؤسسية والبصرية","إعداد لوحة KPI الشاملة وتحليل البيانات الاستراتيجية","تطوير تقنيات التشغيل (منصة التوظيف + الأتمتة)","متابعة التوافق مع اشتراطات نطاقات والجهات الحكومية"],
      detail:[],contacts:[],auth:[]},
  ]},
  {key:"sup",ar:"قطاع الخدمات المساندة",head:"مدير الخدمات المساندة",depts:[
    {id:"su1",ar:"إدارة الموارد البشرية",staff:"أخصائي HR · منسق توظيف",ic:"employees",
      main:["إدارة الرواتب الشهرية وفق HR-POL-003 والحوافز","توثيق العقود وملفات الموظفين وتحديثها","إدارة الإجازات والغيابات والمخالفات","تنسيق منصة التوظيف ومتابعة الطلبات","الامتثال لاشتراطات نطاقات والتأمينات الاجتماعية","إدارة الإقامات وتصاريح العمل"],
      detail:[],
      contacts:[{d:"out",n:"وزارة الموارد البشرية — مسار",t:"تسجيل الموظفين وإدارة العقود النظامية"},{d:"out",n:"التأمينات الاجتماعية",t:"تسجيل الموظفين السعوديين وتقديم الاشتراكات"},{d:"out",n:"طيب سلطان — محاسب سويتر",t:"مطابقة الفواتير والمستحقات المالية"},{d:"in",n:"كل الإدارات",t:"تستلم منهم توثيق الغيابات والمخالفات والترقيات"}],
      auth:[{t:"صرف الرواتب الشهرية",b:[["r","ينفذ"]],note:"بعد اعتماد الرئيس التنفيذي"},{t:"تعديل راتب موظف",b:[["c","يوصي"]],note:"القرار للرئيس التنفيذي"},{t:"إصدار إنذار رسمي",b:[["r","ينفذ التوثيق"]],note:"القرار لمدير القطاع المعني"},{t:"إنهاء خدمة موظف",b:[["c","يوصي"]],note:"القرار للرئيس التنفيذي حصراً"}]},
    {id:"su2",ar:"إدارة الدعم اللوجستي",staff:"مسؤول لوجستيك · مشرف أسطول",ic:"vendors",
      main:["شراء الدراجات النارية وتسجيلها وتسليمها لسويتر","إدارة صيانة الأسطول ومتابعة الأعطال (عرض سعر قبل أي إصلاح)","إدارة عقود الإيجار والسكن للبايكرز","إدارة العهد (صناديق + معدات + زي + معدات سلامة)","تجهيز كامل للبايكر الجديد قبل يوم التشغيل","المهام اللوجستية المستمرة التي لا تستدعي حضوراً فيزيائياً يتولاها مدير المشروع"],
      detail:[],
      contacts:[{d:"out",n:"سويتر — استلام الدراجات",t:"تنسيق موعد التسجيل والتسليم الرسمي"},{d:"out",n:"موردو الصيانة والقطع",t:"الحصول على عروض أسعار وتنفيذ الإصلاحات المعتمدة"},{d:"in",n:"إدارة التشغيل الميداني",t:"استلام طلبات الصيانة والمواد عبر نموذج رسمي"},{d:"in",n:"إدارة المالية",t:"رفع فواتير الشراء والإيجار للاعتماد والصرف"}],
      auth:[{t:"شراء مواد تشغيلية",b:[["r","ينفذ"]],note:"حتى 500 ﷼ — ما فوق يحتاج اعتماد"},{t:"إصلاح دراجة",b:[["r","يُقدم عرض سعر"]],note:"الاعتماد للرئيس التنفيذي قبل التنفيذ"},{t:"شراء دراجة جديدة",b:[["c","يوصي"]],note:"القرار للرئيس التنفيذي حصراً"},{t:"تجديد عقد إيجار",b:[["c","يوصي"]],note:"الاعتماد للرئيس التنفيذي"}]},
    {id:"su3",ar:"إدارة المالية والإدارة",staff:"محاسب · مسؤول فوترة",ic:"cash",
      main:["مراجعة فواتير سويتر ومطابقتها مع ملف التفصيل المالي (المرجع الأول)","إعداد التقارير المالية الشهرية ونقطة التعادل","متابعة إيرادات خدمات التمكين B2B وفوترتها","إعداد ملفات التمويل وطلبات البنوك","مراقبة التكاليف الثابتة والمتغيرة شهرياً","التنسيق مع طيب سلطان لحسم أي خلافات مالية مع سويتر"],
      detail:[],
      contacts:[{d:"out",n:"طيب سلطان — محاسب سويتر",t:"مرجع الفاتورة الشهرية وحسم الخلافات المالية"},{d:"out",n:"البنوك وجهات التمويل",t:"إعداد الملفات المالية للقروض والتمويل"},{d:"in",n:"كل الإدارات",t:"استلام الفواتير والمصروفات للمراجعة والاعتماد"}],
      auth:[]},
  ]},
];

const DEPT_INDEX=Object.fromEntries(SECTORS.flatMap(s=>s.depts.map(d=>[d.id,{...d,sector:s.key,sectorAr:s.ar}])));

const AB={r:{c:"#087443",bg:"#e7f7ef",bd:"#b7e4cd"},d:{c:"#b54708",bg:"#fef3e2",bd:"#f7dcae"},c:{c:"#1d5bbf",bg:"#eef4ff",bd:"#d5e3fb"},i:{c:"#64748b",bg:"#f4f5f7",bd:"#e6e9ee"}};

const MATRIX=[
  ["توظيف موظف جديد",[["d","يقرر"]],[["c","يوصي"]],[["c","يوصي"]],"—"],
  ["إنهاء خدمة موظف",[["d","يقرر حصراً"]],[["c","يوصي"]],"—","—"],
  ["اعتماد الشكوى على ريال السلامة",[["d","يقرر حصراً"]],"—","—",[["c","يوصي"]]],
  ["قبول عميل B2B جديد",[["d","يقرر"]],[["c","يوصي"]],[["c","يوصي"]],"—"],
  ["رفع اعتراض على Trello",[["i","يُبلَّغ"]],"—",[["r","ينفذ"]],"—"],
  ["قبول تسوية مع سويتر",[["d","يقرر حصراً"]],[["c","يوصي"]],"—","—"],
  ["شراء دراجة جديدة",[["d","يقرر حصراً"]],"—",[["c","يوصي + عرض سعر"]],"—"],
  ["إصلاح دراجة (أي مبلغ)",[["d","يعتمد"]],"—",[["r","يُقدم عرض سعر"]],"—"],
  ["تعديل سياسة داخلية",[["d","يقرر"]],[["c","يوصي"]],"—","—"],
  ["إيقاف بايكر مؤقتاً",[["i","يُبلَّغ"]],[["d","يعتمد"]],"—",[["c","يوصي"]]],
  ["مصروف طارئ حتى 200 ﷼",[["i","يُبلَّغ لاحقاً"]],"—","—",[["r","ينفذ"]]],
];
const MCOLS=["الرئيس التنفيذي","مدير القطاع","مدير الإدارة","المشرف الميداني"];

const ESC=[
  {t:"حادثة ميدانية / شكوى عاجلة",n:[["البايكر","يبلغ فوراً"],["قائد الفريق","10 دق ← اتصال"],["المشرف الميداني","15 دق"],["مدير العمليات","30 دق"],["الرئيس التنفيذي","إصابة/ضرر كبير"]]},
  {t:"شكوى سويتر / اعتراض",n:[["سويتر","ترفع شكوى"],["إدارة الجودة","توثيق + أدلة"],["الميدان","يُرسل الأدلة"],["إدارة الجودة","يرفع Trello"],["الرئيس التنفيذي","قرار التسوية"]]},
  {t:"طلب مالي / مصروف",n:[["الإدارة الطالبة","عرض سعر"],["المالية","مراجعة"],["الرئيس التنفيذي","اعتماد"],["المالية","صرف + توثيق"]]},
];

const EXT=[
  ["ريم الشبرمي (جودة سويتر)","إدارة الجودة","شكاوى + اعتراضات + جودة","لا تسوية مالية بدون الرئيس التنفيذي"],
  ["عبدالله الخراشي (شركاء سويتر)","إدارة الجودة + الشراكات","تشغيلي + استراتيجي","الاتفاقيات تمر بالرئيس التنفيذي"],
  ["طيب سلطان (محاسب سويتر)","المالية + HR","فواتير + رواتب + مطابقة","أي خلاف يُصعَّد للرئيس التنفيذي"],
  ["مشغلو الغير (عملاء B2B)","الشراكات + التمكين","عروض + تنفيذ الخدمة","العقود تُوقَّع من الرئيس التنفيذي فقط"],
  ["البنوك وجهات التمويل","المالية + الشراكات","ملفات تمويل","التمثيل الرسمي للرئيس التنفيذي فقط"],
  ["جهات حكومية (العمل، المرور)","HR + اللوجستيك","تسجيل + إجراءات نظامية","المفوض الرسمي الرئيس التنفيذي"],
];

const NOTES=[
  "مساعد المدير التنفيذي يعمل أفقياً عبر القطاعات الثلاثة بدون سلطة قطاع محددة",
  "كل قطاع له مدير يرفع مباشرة للرئيس التنفيذي",
  "إدارة التشغيل الميداني تعمل بنظام الفرق: كل 7 بايكرز ← قائد فريق ← مشرف ميداني",
  "خدمات التمكين B2B جزء من قطاع العمليات — مشغلو الغير يخضعون لنفس منظومة الإشراف",
  "التنسيق غير الرسمي (كحسين) = تنسيق بلا سلطة مباشرة",
];

function Badge({k,txt}){const a=AB[k]||AB.i;return <span className="or-badge" style={{color:a.c,background:a.bg,borderColor:a.bd}}>{txt}</span>;}

export default function OrgStructure(){
  const[tab,setTab]=useState("chart");
  const[open,setOpen]=useState({});     // dept id -> bool (detail cards)
  const[ctab,setCtab]=useState({});     // dept id -> inner tab key
  const jump=id=>{setTab("detail");setOpen(p=>({...p,[id]:true}));setCtab(p=>({...p,[id]:p[id]||"main"}));setTimeout(()=>{const el=document.getElementById("or-"+id);el&&el.scrollIntoView({behavior:"smooth",block:"start"});},60);};

  return(<div className="or">
    <style>{CSS}</style>
    <div className="or-tabs">
      <button className={tab==="chart"?"on":""} onClick={()=>setTab("chart")}><Icon n="chart" s={15}/> الهيكل</button>
      <button className={tab==="detail"?"on":""} onClick={()=>setTab("detail")}><Icon n="doc" s={15}/> الإدارات والمهام</button>
      <button className={tab==="matrix"?"on":""} onClick={()=>setTab("matrix")}><Icon n="key" s={15}/> الصلاحيات والتصعيد</button>
    </div>

    {tab==="chart"&&<Chart onJump={jump}/>}
    {tab==="detail"&&<Detail open={open} setOpen={setOpen} ctab={ctab} setCtab={setCtab}/>}
    {tab==="matrix"&&<Matrix/>}
  </div>);
}

function Chart({onJump}){
  return(<div className="or-chart">
    <div className="or-ceo"><div className="or-ceo-badge">OWNER · CEO</div><div className="or-ceo-t">المالك / الرئيس التنفيذي</div><div className="or-ceo-s">إبراهيم المالكي · القرار النهائي في كل شيء</div></div>
    <div className="or-conn"/>
    <div className="or-asst"><div className="or-asst-b">EXECUTIVE ASSISTANT</div><div className="or-asst-t">مساعد المدير التنفيذي</div><div className="or-asst-s">متابعة القطاعات الثلاثة</div><span className="or-asst-tag">قيد التأهيل — تحت إشراف الرئيس التنفيذي</span></div>
    <div className="or-conn"/>
    <div className="or-sectors">
      {SECTORS.map(s=>{const c=SC[s.key];return(
        <div className="or-sec" key={s.key}>
          <div className="or-sec-h" style={{background:c.tint,borderColor:c.bd}}>
            <div className="or-sec-badge" style={{color:c.head}}>{c.badge}</div>
            <div className="or-sec-t" style={{color:c.head}}>{s.ar}</div>
            <div className="or-sec-head">{s.head}</div>
          </div>
          <div className="or-sec-bar" style={{background:c.bar}}/>
          <div className="or-depts">
            {s.depts.map(d=>(
              <div className="or-dept" key={d.id} style={{borderInlineStartColor:c.bar}} onClick={()=>onJump(d.id)}>
                <span className="or-dept-ic" style={{background:c.tint,color:c.head}}><Icon n={d.ic} s={15}/></span>
                <div style={{flex:1,minWidth:0}}><div className="or-dept-t">{d.ar}</div><div className="or-dept-s">{d.staff}</div></div>
                <span className="or-dept-go"><Icon n="fwd" s={13}/></span>
              </div>))}
          </div>
        </div>);})}
    </div>
    <div className="or-notes">
      <div className="or-notes-h"><Icon n="pin" s={14}/> ملاحظات على الهيكل</div>
      {NOTES.map((n,i)=><div className="or-note" key={i}><span>◂</span>{n}</div>)}
    </div>
  </div>);
}

function Detail({open,setOpen,ctab,setCtab}){
  return(<div className="or-detail">
    {SECTORS.map(s=>{const c=SC[s.key];return(
      <div key={s.key}>
        <div className="or-slabel" style={{color:c.head}}>▸ {s.ar}<i style={{background:c.bd}}/></div>
        {s.depts.map(d=>{const isOpen=!!open[d.id];const active=ctab[d.id]||"main";const tabs=[["main","المهام الرئيسية",true],["detail","المهام التفصيلية",d.detail.length>0],["contact","نقاط الاتصال",d.contacts.length>0],["auth","الصلاحيات",d.auth.length>0]].filter(t=>t[2]);return(
          <div className={"or-card"+(isOpen?" open":"")} id={"or-"+d.id} key={d.id}>
            <div className="or-card-h" onClick={()=>setOpen(p=>({...p,[d.id]:!p[d.id]}))}>
              <span className="or-card-ic" style={{background:c.tint,color:c.head}}><Icon n={d.ic} s={16}/></span>
              <div style={{flex:1,minWidth:0}}><div className="or-card-t">{d.ar}</div><div className="or-card-s">{s.ar} · {d.staff}</div></div>
              <span className="or-card-chev"><Icon n="fwd" s={14}/></span>
            </div>
            {isOpen&&<div className="or-card-b">
              <div className="or-itabs">{tabs.map(t=><button key={t[0]} className={active===t[0]?"on":""} onClick={()=>setCtab(p=>({...p,[d.id]:t[0]}))}>{t[1]}</button>)}</div>

              {active==="main"&&<ul className="or-list">{d.main.map((m,i)=><li key={i}><span className="or-di">◆</span>{m}</li>)}</ul>}

              {active==="detail"&&<div>{d.detail.map((g,gi)=><div className="or-sub" key={gi}><h5>{g.h}</h5><ul className="or-list">{g.items.map((m,i)=><li key={i}><span className="or-di">◆</span>{m}</li>)}</ul></div>)}</div>}

              {active==="contact"&&<div className="or-contacts">{d.contacts.map((ct,i)=>(
                <div className="or-contact" key={i}><span className={"or-dir "+(ct.d==="in"?"in":"out")}>{ct.d==="in"?"داخلي":"خارجي"}</span><div className="or-contact-t"><strong>{ct.n}</strong>{ct.t}</div></div>))}</div>}

              {active==="auth"&&<div>
                <div className="or-raci"><span><i style={{background:AB.r.c}}/>ينفذ</span><span><i style={{background:AB.d.c}}/>يقرر</span><span><i style={{background:AB.c.c}}/>يوصي</span><span><i style={{background:AB.i.c}}/>يُبلَّغ</span></div>
                <ul className="or-list">{d.auth.map((a,i)=><li key={i}><span className="or-di">◆</span><span className="or-auth-t">{a.t}:</span> {a.b.map((bb,bi)=><Badge key={bi} k={bb[0]} txt={bb[1]}/>)}{a.note&&<em className="or-note-i"> — {a.note}</em>}</li>)}</ul>
              </div>}
            </div>}
          </div>);})}
      </div>);})}
  </div>);
}

function Matrix(){
  return(<div className="or-matrix">
    <div className="or-msec">
      <h3>مصفوفة الصلاحيات — القرارات الرئيسية</h3>
      <div className="or-tblwrap"><table className="or-tbl">
        <thead><tr><th>القرار</th>{MCOLS.map(c=><th key={c}>{c}</th>)}</tr></thead>
        <tbody>{MATRIX.map((r,i)=>(<tr key={i}><td className="or-dec">{r[0]}</td>{r.slice(1).map((cell,ci)=><td key={ci}>{cell==="—"?<span className="or-dash">—</span>:<span className="or-cellwrap">{cell.map((b,bi)=><Badge key={bi} k={b[0]} txt={b[1]}/>)}</span>}</td>)}</tr>))}</tbody>
      </table></div>
    </div>

    <div className="or-msec">
      <h3>مسارات التصعيد</h3>
      {ESC.map((e,i)=>(<div key={i}><div className="or-esc-lbl">{e.t}</div>
        <div className="or-esc">{e.n.map((n,ni)=>(<div className="or-esc-row" key={ni}><div className="or-esc-node"><strong>{n[0]}</strong><span>{n[1]}</span></div>{ni<e.n.length-1&&<span className="or-esc-arrow"><Icon n="back" s={14}/></span>}</div>))}</div></div>))}
    </div>

    <div className="or-msec">
      <h3>قاعدة التواصل الخارجي</h3>
      <div className="or-tblwrap"><table className="or-tbl">
        <thead><tr><th>الجهة الخارجية</th><th>من يتواصل معها</th><th>الموضوعات المسموح بها</th><th>القيد</th></tr></thead>
        <tbody>{EXT.map((r,i)=>(<tr key={i}><td className="or-dec">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td className="or-constraint">{r[3]}</td></tr>))}</tbody>
      </table></div>
    </div>
  </div>);
}

const CSS=`
.or{--b:#E8712B}
.or-tabs{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.or-tabs button{display:inline-flex;align-items:center;gap:7px;background:#fff;border:1px solid #e6e9ee;border-radius:11px;padding:9px 15px;font-family:inherit;font-size:13px;font-weight:700;color:#64748b;cursor:pointer}
.or-tabs button.on{background:linear-gradient(135deg,#E8712B,#f5a35f);border-color:transparent;color:#fff}
/* chart */
.or-chart{display:flex;flex-direction:column;align-items:center}
.or-ceo{width:280px;max-width:100%;background:linear-gradient(135deg,#E8712B,#f5a35f);border-radius:14px;padding:16px 20px;text-align:center;color:#fff;box-shadow:0 8px 22px rgba(232,113,43,.28)}
.or-ceo-badge{font-size:9px;font-weight:800;letter-spacing:1.5px;opacity:.85;margin-bottom:6px}
.or-ceo-t{font-size:15px;font-weight:800}.or-ceo-s{font-size:11px;opacity:.9;margin-top:3px}
.or-conn{width:2px;height:22px;background:#e6c3a6}
.or-asst{width:230px;max-width:100%;background:#fff;border:1.5px dashed #cbd5e1;border-radius:12px;padding:12px 16px;text-align:center}
.or-asst-b{font-size:9px;font-weight:800;letter-spacing:1px;color:#94a3b8;margin-bottom:4px}
.or-asst-t{font-size:12.5px;font-weight:800;color:#334155}.or-asst-s{font-size:10.5px;color:#94a3b8;margin-top:1px}
.or-asst-tag{display:inline-block;font-size:9.5px;background:#f4f5f7;color:#94a3b8;border:1px solid #e6e9ee;border-radius:5px;padding:2px 7px;margin-top:6px}
.or-sectors{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;width:100%;margin-top:4px;align-items:start}
.or-sec{background:#fff;border:1px solid #eceef1;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.or-sec-h{padding:12px 14px;text-align:center;border-bottom:1px solid}
.or-sec-badge{font-size:9px;font-weight:800;letter-spacing:1.5px;margin-bottom:4px}
.or-sec-t{font-size:13px;font-weight:800}.or-sec-head{font-size:10.5px;color:#94a3b8;margin-top:2px}
.or-sec-bar{height:3px}
.or-depts{padding:10px;display:flex;flex-direction:column;gap:8px}
.or-dept{display:flex;align-items:center;gap:10px;background:#fafbfc;border:1px solid #f1f3f5;border-inline-start:3px solid;border-radius:10px;padding:9px 11px;cursor:pointer;transition:background .12s}
.or-dept:hover{background:#f4f5f7}
.or-dept-ic{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:none}
.or-dept-t{font-size:11.5px;font-weight:800;color:#0f172a;line-height:1.35}.or-dept-s{font-size:10px;color:#94a3b8;margin-top:1px}
.or-dept-go{color:#cbd5e1;flex:none}
.or-notes{width:100%;background:#fff;border:1px solid #eceef1;border-radius:14px;padding:14px 16px;margin-top:16px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.or-notes-h{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--b);font-weight:800;letter-spacing:.4px;margin-bottom:10px}
.or-note{display:flex;gap:8px;font-size:11.5px;color:#64748b;line-height:1.7;margin-bottom:5px}.or-note span{color:var(--b)}
/* detail */
.or-slabel{display:flex;align-items:center;gap:10px;font-size:11px;font-weight:800;letter-spacing:1px;margin:20px 0 11px}
.or-slabel i{flex:1;height:1px;display:block}
.or-card{background:#fff;border:1px solid #eceef1;border-radius:13px;margin-bottom:10px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.or-card-h{display:flex;align-items:center;gap:11px;padding:13px 15px;cursor:pointer}
.or-card-h:hover{background:#fafbfc}
.or-card-ic{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none}
.or-card-t{font-size:13px;font-weight:800;color:#0f172a}.or-card-s{font-size:10.5px;color:#94a3b8;margin-top:1px}
.or-card-chev{color:#94a3b8;transition:transform .2s;transform:rotate(-90deg)}
.or-card.open .or-card-chev{transform:rotate(90deg)}
.or-card-b{padding:0 15px 15px}
.or-itabs{display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid #f1f3f5;padding:2px 0 11px;margin-bottom:12px}
.or-itabs button{background:#f4f5f7;border:none;border-radius:8px;padding:6px 12px;font-family:inherit;font-size:11px;font-weight:700;color:#64748b;cursor:pointer}
.or-itabs button.on{background:#0e1622;color:#fff}
.or-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}
.or-list li{display:flex;gap:8px;font-size:12px;color:#475569;line-height:1.65}
.or-di{color:var(--b);flex:none;font-size:8px;margin-top:5px}
.or-auth-t{font-weight:700;color:#0f172a}
.or-badge{display:inline-block;padding:2px 9px;border-radius:20px;font-size:10.5px;font-weight:800;border:1px solid;margin:0 2px}
.or-note-i{color:#94a3b8;font-style:normal;font-size:11px}
.or-sub{margin-bottom:14px}.or-sub h5{font-size:10.5px;font-weight:800;letter-spacing:.5px;color:#94a3b8;margin:0 0 8px}
.or-contacts{display:flex;flex-direction:column;gap:8px}
.or-contact{display:flex;gap:10px;align-items:flex-start;background:#fafbfc;border:1px solid #f1f3f5;border-radius:10px;padding:9px 12px}
.or-dir{font-size:9.5px;font-weight:800;padding:3px 8px;border-radius:5px;flex:none;margin-top:1px}
.or-dir.in{background:#eef4ff;color:#1d5bbf}.or-dir.out{background:#e7f7ef;color:#087443}
.or-contact-t{font-size:11.5px;color:#64748b;line-height:1.5}.or-contact-t strong{display:block;color:#0f172a;margin-bottom:1px;font-size:12px}
.or-raci{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:11px}
.or-raci span{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:#64748b;font-weight:600}
.or-raci i{width:9px;height:9px;border-radius:3px}
/* matrix */
.or-msec{margin-bottom:24px}
.or-msec h3{font-size:12.5px;font-weight:800;color:var(--b);letter-spacing:.5px;margin:0 0 12px}
.or-tblwrap{overflow-x:auto;background:#fff;border:1px solid #eceef1;border-radius:14px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.or-tbl{width:100%;border-collapse:collapse;min-width:600px}
.or-tbl th{font-size:10.5px;color:#64748b;font-weight:700;text-align:right;padding:10px 12px;border-bottom:1px solid #eceef1;background:#fafbfc;white-space:nowrap}
.or-tbl td{padding:10px 12px;border-bottom:1px solid #f4f5f7;font-size:11.5px;color:#64748b;vertical-align:top;line-height:1.6}
.or-tbl tr:last-child td{border-bottom:none}
.or-dec{color:#0f172a!important;font-weight:700}
.or-dash{color:#cbd5e1}
.or-cellwrap{display:flex;flex-wrap:wrap;gap:3px}
.or-constraint{color:#b54708!important;font-weight:600}
.or-esc-lbl{font-size:11px;color:#94a3b8;font-weight:700;margin:12px 0 8px}
.or-esc{display:flex;flex-wrap:wrap;align-items:center;gap:6px;background:#fff;border:1px solid #eceef1;border-radius:12px;padding:12px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.or-esc-row{display:flex;align-items:center;gap:6px}
.or-esc-node{background:#fafbfc;border:1px solid #eceef1;border-radius:9px;padding:7px 11px;text-align:center;min-width:76px}
.or-esc-node strong{display:block;color:#0f172a;font-size:11.5px;font-weight:800}
.or-esc-node span{font-size:9.5px;color:#94a3b8}
.or-esc-arrow{color:#cbd5e1;display:flex}
@media(max-width:820px){
  .or-sectors{grid-template-columns:1fr}
}
`;
