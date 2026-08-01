import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{POSITIONS,POS_BY_KEY,SUPERVISOR_POSITIONS,TEAM_MAX_MEMBERS,SUP_MAX_TEAMS,permsRows,grantedModules}from"./orgRoles";

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

export default function OrgStructure({owner,opId}){
  const[tab,setTab]=useState("chart");
  const[open,setOpen]=useState({});     // dept id -> bool (detail cards)
  const[ctab,setCtab]=useState({});     // dept id -> inner tab key
  const[users,setUsers]=useState([]);const[emps,setEmps]=useState([]);const[teams,setTeams]=useState([]);
  const jump=id=>{setTab("detail");setOpen(p=>({...p,[id]:true}));setCtab(p=>({...p,[id]:p[id]||"main"}));setTimeout(()=>{const el=document.getElementById("or-"+id);el&&el.scrollIntoView({behavior:"smooth",block:"start"});},60);};

  const reload=async()=>{
    if(!owner)return;
    const{data:us}=await supabase.from("app_users").select("id,display_name,email,is_owner,active,position,biker_employee_id").order("display_name");
    setUsers(us||[]);
    const{data:e}=await supabase.from("employees").select("id,full_name,employee_id,team_id").order("full_name");
    setEmps(e||[]);
    const{data:tm}=await supabase.from("teams").select("*").order("created_at");
    setTeams(tm||[]);
  };
  useEffect(()=>{reload();/*eslint-disable-next-line*/},[owner]);

  const holders=useMemo(()=>{const m={};users.forEach(u=>{if(u.position){(m[u.position]=m[u.position]||[]).push(u);}});return m;},[users]);

  return(<div className="or">
    <style>{CSS}</style>
    <div className="or-tabs">
      <button className={tab==="chart"?"on":""} onClick={()=>setTab("chart")}><Icon n="chart" s={15}/> الهيكل</button>
      <button className={tab==="detail"?"on":""} onClick={()=>setTab("detail")}><Icon n="doc" s={15}/> الإدارات والمهام</button>
      <button className={tab==="matrix"?"on":""} onClick={()=>setTab("matrix")}><Icon n="key" s={15}/> الصلاحيات والتصعيد</button>
      {owner&&<button className={tab==="appoint"?"on":""} onClick={()=>setTab("appoint")}><Icon n="id" s={15}/> التعيينات</button>}
      {owner&&<button className={tab==="teams"?"on":""} onClick={()=>setTab("teams")}><Icon n="bike" s={15}/> الفرق</button>}
    </div>

    {tab==="chart"&&<Chart onJump={jump} holders={holders}/>}
    {tab==="detail"&&<Detail open={open} setOpen={setOpen} ctab={ctab} setCtab={setCtab}/>}
    {tab==="matrix"&&<Matrix/>}
    {tab==="appoint"&&owner&&<AppointView users={users} opId={opId} reload={reload}/>}
    {tab==="teams"&&owner&&<TeamsView users={users} emps={emps} teams={teams} opId={opId} reload={reload}/>}
  </div>);
}

function Chart({onJump,holders}){
  const hn=k=>{const a=holders&&holders[k];return a&&a.length?a[0].display_name+(a.length>1?` +${a.length-1}`:""):null;};
  return(<div className="or-chart">
    <div className="or-ceo"><div className="or-ceo-badge">OWNER · CEO</div><div className="or-ceo-t">المالك / الرئيس التنفيذي</div><div className="or-ceo-s">إبراهيم المالكي · القرار النهائي في كل شيء</div></div>
    <div className="or-conn"/>
    <div className="or-asst"><div className="or-asst-b">EXECUTIVE ASSISTANT</div><div className="or-asst-t">مساعد المدير التنفيذي</div><div className="or-asst-s">متابعة القطاعات الثلاثة</div><span className="or-asst-tag">قيد التأهيل — تحت إشراف الرئيس التنفيذي</span></div>
    <div className="or-conn"/>
    <div className="or-sectors">
      {SECTORS.map(s=>{const c=SC[s.key];const sh=hn("sec_"+s.key);return(
        <div className="or-sec" key={s.key}>
          <div className="or-sec-h" style={{background:c.tint,borderColor:c.bd}}>
            <div className="or-sec-badge" style={{color:c.head}}>{c.badge}</div>
            <div className="or-sec-t" style={{color:c.head}}>{s.ar}</div>
            <div className="or-sec-head">{s.head}</div>
            {sh?<div className="or-holder" style={{color:c.head}}><Icon n="check" s={11}/> {sh}</div>:<div className="or-holder vac">شاغر</div>}
          </div>
          <div className="or-sec-bar" style={{background:c.bar}}/>
          <div className="or-depts">
            {s.depts.map(d=>{const dh=hn(d.id);return(
              <div className="or-dept" key={d.id} style={{borderInlineStartColor:c.bar}} onClick={()=>onJump(d.id)}>
                <span className="or-dept-ic" style={{background:c.tint,color:c.head}}><Icon n={d.ic} s={15}/></span>
                <div style={{flex:1,minWidth:0}}><div className="or-dept-t">{d.ar}</div><div className="or-dept-s">{dh?<span className="or-dh"><Icon n="check" s={10}/> {dh}</span>:d.staff}</div></div>
                <span className="or-dept-go"><Icon n="fwd" s={13}/></span>
              </div>);})}
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

const SEC_AR={ops:"قطاع العمليات",strat:"قطاع الاستراتيجية والتطوير",sup:"قطاع الخدمات المساندة"};

// ═══ التعيينات: ربط المستخدمين بالمناصب + منح الصلاحيات وفق الهيكل ═══
function AppointView({users,opId,reload}){
  const[sel,setSel]=useState({});   // posKey -> userId (اختيار مؤقت)
  const[busy,setBusy]=useState(false);const[msg,setMsg]=useState(null);
  const cand=users.filter(u=>!u.is_owner&&u.active);

  const syncPerms=async(userId,posKey)=>{
    await supabase.from("user_permissions").delete().eq("user_id",userId);
    const rows=permsRows(posKey).map(r=>({...r,user_id:userId}));
    if(rows.length)await supabase.from("user_permissions").insert(rows);
  };
  const assign=async(posKey)=>{
    const uid=sel[posKey];if(!uid){setMsg({ok:false,t:"اختر مستخدماً"});return;}
    setBusy(true);setMsg(null);
    try{
      const p=POS_BY_KEY[posKey];
      const parentHolder=p.parent?users.find(u=>u.position===p.parent):null;
      const{error}=await supabase.from("app_users").update({position:posKey,reports_to:parentHolder?parentHolder.id:null}).eq("id",uid);
      if(error)throw error;
      await syncPerms(uid,posKey);
      setMsg({ok:true,t:"تم التعيين ومنح صلاحيات المنصب"});setSel(s=>({...s,[posKey]:""}));await reload();
    }catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setBusy(false);
  };
  const unassign=async(u)=>{
    if(!confirm("إلغاء تعيين «"+u.display_name+"» وسحب صلاحيات المنصب؟"))return;
    setBusy(true);setMsg(null);
    try{
      await supabase.from("app_users").update({position:null,reports_to:null}).eq("id",u.id);
      await supabase.from("user_permissions").delete().eq("user_id",u.id);
      setMsg({ok:true,t:"أُلغي التعيين وسُحبت الصلاحيات"});await reload();
    }catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setBusy(false);
  };
  const resync=async(u)=>{setBusy(true);setMsg(null);try{await syncPerms(u.id,u.position);setMsg({ok:true,t:"أُعيدت مزامنة الصلاحيات مع الهيكل"});await reload();}catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}setBusy(false);};

  const bySec={};POSITIONS.forEach(p=>{(bySec[p.sector]=bySec[p.sector]||[]).push(p);});

  return(<div className="or-ap">
    <div className="or-apnote"><Icon n="lock" s={13}/> التعيين يمنح المستخدم صلاحيات منصبه آلياً وفق الهيكل. «المواهب» و«المستخدمون» تبقيان مقصورتين عليك ولا تُمنحان لأي منصب.</div>
    {cand.length===0&&<div className="or-apwarn"><Icon n="alert" s={13}/> لا مستخدمين قابلين للتعيين بعد — أنشئ حسابات الموظفين من وحدة «المستخدمون» أولاً، ثم عيّنهم هنا.</div>}
    {msg&&<div className={"or-apmsg "+(msg.ok?"ok":"err")}>{msg.t}</div>}

    {["ops","strat","sup"].map(sk=>{const c=SC[sk];return(
      <div key={sk}>
        <div className="or-slabel" style={{color:c.head}}>▸ {SEC_AR[sk]}<i style={{background:c.bd}}/></div>
        {bySec[sk].map(p=>{const hs=users.filter(u=>u.position===p.k);const gm=grantedModules(p.k);return(
          <div className="or-poscard" key={p.k}>
            <div className="or-pos-h">
              <div><b>{p.ar}</b><span className="or-pos-lvl" style={{background:c.tint,color:c.head}}>{p.level}</span></div>
            </div>
            <div className="or-holders">
              {hs.length===0?<span className="or-vac">— لا مُعيَّن —</span>:hs.map(u=>(
                <span className="or-hchip" key={u.id}><Icon n="id" s={11}/> {u.display_name}<button onClick={()=>unassign(u)} title="إلغاء التعيين"><Icon n="x" s={11}/></button><button className="or-resync" onClick={()=>resync(u)} title="إعادة مزامنة الصلاحيات"><Icon n="refresh" s={11}/></button></span>))}
            </div>
            <div className="or-assign">
              <select value={sel[p.k]||""} onChange={e=>setSel(s=>({...s,[p.k]:e.target.value}))}>
                <option value="">تعيين مستخدم…</option>
                {cand.map(u=><option key={u.id} value={u.id}>{u.display_name}{u.position?` (${POS_BY_KEY[u.position]?.ar||u.position})`:""}</option>)}
              </select>
              <button onClick={()=>assign(p.k)} disabled={busy||!sel[p.k]}><Icon n="check" s={13}/> تعيين</button>
            </div>
            <div className="or-gm"><span className="or-gm-l">الصلاحيات:</span>{gm.map(g=><span key={g.module} className={"or-gmb"+(g.edit?" e":"")}>{g.label}{g.edit&&<i>✎</i>}</span>)}</div>
          </div>);})}
      </div>);})}
  </div>);
}

// ═══ الفرق: توزيع البايكرز تحت المشرفين (7/فريق · 3 فرق/مشرف) ═══
function TeamsView({users,emps,teams,reload}){
  const[name,setName]=useState("");const[supId,setSupId]=useState("");const[leaderId,setLeaderId]=useState("");
  const[addSel,setAddSel]=useState({});const[busy,setBusy]=useState(false);const[msg,setMsg]=useState(null);
  const sups=users.filter(u=>u.active&&SUPERVISOR_POSITIONS.includes(u.position));
  const unassigned=emps.filter(e=>!e.team_id);
  const teamCountBySup=id=>teams.filter(t=>t.supervisor_user_id===id).length;

  const create=async()=>{
    if(!name.trim()){setMsg({ok:false,t:"أدخل اسم الفريق"});return;}
    if(supId&&teamCountBySup(supId)>=SUP_MAX_TEAMS){setMsg({ok:false,t:`المشرف يقود ${SUP_MAX_TEAMS} فرق كحدّ أقصى`});return;}
    setBusy(true);setMsg(null);
    try{
      const{error}=await supabase.from("teams").insert({name:name.trim(),supervisor_user_id:supId||null,leader_employee_id:leaderId||null});
      if(error)throw error;
      setName("");setSupId("");setLeaderId("");setMsg({ok:true,t:"تم إنشاء الفريق"});await reload();
    }catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setBusy(false);
  };
  const addMember=async(team)=>{
    const eid=addSel[team.id];if(!eid)return;
    const count=emps.filter(e=>e.team_id===team.id).length;
    if(count>=TEAM_MAX_MEMBERS){setMsg({ok:false,t:`الفريق مكتمل (${TEAM_MAX_MEMBERS} بايكرز)`});return;}
    setBusy(true);setMsg(null);
    try{await supabase.from("employees").update({team_id:team.id}).eq("id",eid);setAddSel(s=>({...s,[team.id]:""}));await reload();}
    catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setBusy(false);
  };
  const removeMember=async(e)=>{setBusy(true);try{await supabase.from("employees").update({team_id:null}).eq("id",e.id);await reload();}catch(x){setMsg({ok:false,t:"خطأ: "+(x.message||x)});}setBusy(false);};
  const delTeam=async(t)=>{if(!confirm("حذف فريق «"+t.name+"»؟ سيُفصل أعضاؤه."))return;setBusy(true);try{await supabase.from("employees").update({team_id:null}).eq("team_id",t.id);await supabase.from("teams").delete().eq("id",t.id);await reload();}catch(x){setMsg({ok:false,t:"خطأ: "+(x.message||x)});}setBusy(false);};
  const empName=id=>emps.find(e=>e.id===id)?.full_name||"—";

  return(<div className="or-tm">
    <div className="or-tmnote"><Icon n="bike" s={13}/> نظام الفرق: كل فريق ≤ {TEAM_MAX_MEMBERS} بايكرز بقيادة قائد فريق، والمشرف الميداني يقود ≤ {SUP_MAX_TEAMS} فرق. المشرفون يُسحبون من التعيينات (مدير العمليات · مدير التشغيل · المشرف الميداني).</div>
    {sups.length===0&&<div className="or-apwarn"><Icon n="alert" s={13}/> لا مشرفون مُعيَّنون بعد — عيّن مشرفاً ميدانياً من تبويب «التعيينات» ليظهر هنا.</div>}
    {msg&&<div className={"or-apmsg "+(msg.ok?"ok":"err")}>{msg.t}</div>}

    <div className="or-tmnew">
      <div className="or-tmnew-h"><Icon n="plus" s={14}/> فريق جديد</div>
      <div className="or-tmnew-g">
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="اسم الفريق (مثل: فريق شمال الرياض)"/>
        <select value={supId} onChange={e=>setSupId(e.target.value)}><option value="">المشرف…</option>{sups.map(u=><option key={u.id} value={u.id} disabled={teamCountBySup(u.id)>=SUP_MAX_TEAMS}>{u.display_name}{teamCountBySup(u.id)>=SUP_MAX_TEAMS?" (مكتمل)":` (${teamCountBySup(u.id)}/${SUP_MAX_TEAMS})`}</option>)}</select>
        <select value={leaderId} onChange={e=>setLeaderId(e.target.value)}><option value="">قائد الفريق…</option>{emps.map(e=><option key={e.id} value={e.id}>{e.full_name}</option>)}</select>
        <button onClick={create} disabled={busy}><Icon n="check" s={13}/> إنشاء</button>
      </div>
    </div>

    <div className="or-tmstat"><span><b>{teams.length}</b> فرق</span><span><b>{emps.length-unassigned.length}</b> مُوزَّع</span><span><b>{unassigned.length}</b> بلا فريق</span></div>

    {teams.length===0?<div className="or-empty"><Icon n="bike" s={26}/><p>لا فرق بعد — أنشئ أول فريق أعلاه ووزّع البايكرز تحته.</p></div>:
    <div className="or-tmlist">{teams.map(t=>{const mem=emps.filter(e=>e.team_id===t.id);const full=mem.length>=TEAM_MAX_MEMBERS;const sup=users.find(u=>u.id===t.supervisor_user_id);return(
      <div className="or-tmcard" key={t.id}>
        <div className="or-tmc-h">
          <div><b>{t.name}</b><div className="or-tmc-meta"><span><Icon n="eye" s={11}/> مشرف: {sup?sup.display_name:"—"}</span><span><Icon n="star" s={11}/> قائد: {empName(t.leader_employee_id)}</span></div></div>
          <div className="or-tmc-r"><span className={"or-tmc-cnt"+(full?" full":"")}>{mem.length}/{TEAM_MAX_MEMBERS}</span><button className="or-tmc-del" onClick={()=>delTeam(t)}><Icon n="trash" s={13}/></button></div>
        </div>
        <div className="or-tmc-mem">{mem.length===0?<span className="or-vac">لا أعضاء بعد</span>:mem.map(e=><span className="or-memchip" key={e.id}>{e.full_name}{t.leader_employee_id===e.id&&<i className="or-lead">قائد</i>}<button onClick={()=>removeMember(e)}><Icon n="x" s={10}/></button></span>)}</div>
        <div className="or-tmc-add">
          <select value={addSel[t.id]||""} onChange={e=>setAddSel(s=>({...s,[t.id]:e.target.value}))} disabled={full}><option value="">{full?"الفريق مكتمل":"إضافة بايكر…"}</option>{unassigned.map(e=><option key={e.id} value={e.id}>{e.full_name}</option>)}</select>
          <button onClick={()=>addMember(t)} disabled={busy||full||!addSel[t.id]}><Icon n="plus" s={13}/> إضافة</button>
        </div>
      </div>);})}</div>}
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
.or-holder{font-size:10px;font-weight:800;margin-top:5px;display:inline-flex;align-items:center;gap:4px}
.or-holder.vac{color:#cbd5e1}
.or-dh{display:inline-flex;align-items:center;gap:3px;color:#087443;font-weight:800}
/* appointments */
.or-apnote{display:flex;align-items:flex-start;gap:7px;background:#f6f2ff;border:1px solid #e3d9fb;color:#6d4bcb;font-size:11.5px;font-weight:700;border-radius:11px;padding:9px 12px;margin-bottom:12px;line-height:1.6}
.or-apwarn{display:flex;align-items:flex-start;gap:7px;background:#fffbeb;border:1px solid #fde9c8;color:#92600e;font-size:11.5px;font-weight:700;border-radius:11px;padding:9px 12px;margin-bottom:12px;line-height:1.6}
.or-apmsg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:12px}
.or-apmsg.ok{background:#e7f7ef;color:#087443}.or-apmsg.err{background:#feecea;color:#b42318}
.or-poscard{background:#fff;border:1px solid #eceef1;border-radius:13px;padding:13px 15px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.or-pos-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}
.or-pos-h b{font-size:13px;font-weight:800}
.or-pos-lvl{font-size:10px;font-weight:800;padding:2px 9px;border-radius:20px;margin-inline-start:8px}
.or-holders{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px}
.or-vac{font-size:11.5px;color:#94a3b8;font-weight:600}
.or-hchip{display:inline-flex;align-items:center;gap:5px;background:#e7f7ef;color:#087443;border:1px solid #b7e4cd;border-radius:20px;padding:3px 6px 3px 10px;font-size:11.5px;font-weight:800}
.or-hchip button{border:none;background:#fff;color:#b42318;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer}
.or-hchip button.or-resync{color:#1d5bbf}
.or-assign{display:flex;gap:8px;margin-bottom:10px}
.or-assign select{flex:1;border:1px solid #e6e9ee;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:12.5px;font-weight:600;outline:none;background:#fff}
.or-assign button{display:inline-flex;align-items:center;gap:5px;background:linear-gradient(135deg,#E8712B,#f5a35f);border:none;border-radius:10px;padding:0 15px;color:#fff;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.or-assign button:disabled{opacity:.5}
.or-gm{display:flex;flex-wrap:wrap;align-items:center;gap:5px;border-top:1px solid #f4f5f7;padding-top:9px}
.or-gm-l{font-size:10.5px;color:#94a3b8;font-weight:700;margin-inline-end:2px}
.or-gmb{font-size:10.5px;font-weight:700;color:#475569;background:#f4f5f7;border-radius:6px;padding:2px 8px;display:inline-flex;align-items:center;gap:3px}
.or-gmb.e{background:#fff2e8;color:#b54708}.or-gmb i{font-style:normal;font-size:9px}
/* teams */
.or-tmnote{display:flex;align-items:flex-start;gap:7px;background:#eef4ff;border:1px solid #d5e3fb;color:#1d5bbf;font-size:11.5px;font-weight:700;border-radius:11px;padding:9px 12px;margin-bottom:12px;line-height:1.7}
.or-tmnew{background:#fff;border:1px solid #eceef1;border-radius:13px;padding:14px;margin-bottom:12px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.or-tmnew-h{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;margin-bottom:11px}
.or-tmnew-g{display:grid;grid-template-columns:1.4fr 1fr 1fr auto;gap:8px}
.or-tmnew-g input,.or-tmnew-g select{border:1px solid #e6e9ee;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:12.5px;font-weight:600;outline:none;background:#fff;min-width:0}
.or-tmnew-g button{display:inline-flex;align-items:center;gap:5px;background:linear-gradient(135deg,#12b76a,#087443);border:none;border-radius:10px;padding:0 16px;color:#fff;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.or-tmnew-g button:disabled{opacity:.5}
.or-tmstat{display:flex;gap:18px;padding:0 4px;margin-bottom:12px;font-size:12px;color:#64748b}
.or-tmstat b{color:#0f172a;font-size:14px}
.or-tmlist{display:grid;grid-template-columns:repeat(2,1fr);gap:11px}
.or-tmcard{background:#fff;border:1px solid #eceef1;border-radius:13px;padding:13px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.or-tmc-h{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}
.or-tmc-h b{font-size:13.5px;font-weight:800}
.or-tmc-meta{display:flex;flex-direction:column;gap:2px;margin-top:4px}
.or-tmc-meta span{font-size:10.5px;color:#64748b;display:inline-flex;align-items:center;gap:4px}
.or-tmc-r{display:flex;align-items:center;gap:7px;flex:none}
.or-tmc-cnt{font-size:12px;font-weight:800;color:#64748b;background:#f4f5f7;padding:3px 9px;border-radius:20px}
.or-tmc-cnt.full{background:#e7f7ef;color:#087443}
.or-tmc-del{border:none;background:#feecea;color:#b42318;width:28px;height:24px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.or-tmc-mem{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;min-height:22px}
.or-memchip{display:inline-flex;align-items:center;gap:5px;background:#fafbfc;border:1px solid #eceef1;border-radius:20px;padding:3px 6px 3px 10px;font-size:11px;font-weight:700;color:#334155}
.or-memchip .or-lead{font-style:normal;font-size:9px;background:#fff2e8;color:#b54708;padding:1px 6px;border-radius:20px;font-weight:800}
.or-memchip button{border:none;background:#feecea;color:#b42318;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer}
.or-tmc-add{display:flex;gap:7px;border-top:1px solid #f4f5f7;padding-top:9px}
.or-tmc-add select{flex:1;border:1px solid #e6e9ee;border-radius:9px;padding:7px 10px;font-family:inherit;font-size:11.5px;font-weight:600;outline:none;background:#fff}
.or-tmc-add button{display:inline-flex;align-items:center;gap:4px;background:#f4f5f7;border:none;border-radius:9px;padding:0 12px;font-family:inherit;font-size:11.5px;font-weight:700;color:#475569;cursor:pointer}
.or-tmc-add button:disabled{opacity:.5}
.or-empty{background:#fff;border:1px dashed #e6e9ee;border-radius:14px;padding:34px 20px;text-align:center;color:#94a3b8}
.or-empty p{font-size:12.5px;margin:10px 0 0}
@media(max-width:820px){
  .or-sectors{grid-template-columns:1fr}
  .or-tmnew-g{grid-template-columns:1fr 1fr}
  .or-tmlist{grid-template-columns:1fr}
}
`;
