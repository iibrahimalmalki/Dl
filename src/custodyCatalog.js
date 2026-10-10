// كتالوج عُهد البايكر + خريطة أصناف تبويب «العهدة» في بوابة البايكر (ASSET_ITEMS) إلى مفاتيح الكتالوج.
// مستقل عن Custody.jsx حتى تستعمله البوابة دون تحميل صفحة العُهد.
// كتالوج عُهد سويتر (Biker Tools) — العمر الافتراضي بالأشهر ومهلة التخطيط بالأيام
// mode: buy (دراجة → تخطيط شراء) · replace (أصل معمّر → استبدال) · reorder (مستهلك → طلب سويتر)
export const CATALOG=[
  {key:"moto",name:"الدراجة النارية",en:"Motorcycle",type:"motorcycle",category:"مركبة",life:36,lead:90,mode:"buy"},
  {key:"uniform",name:"الزي الرسمي",en:"Official Uniform",type:"uniform",category:"زي",life:12,lead:45,mode:"replace"},
  {key:"helmet",name:"الخوذة",en:"Helmet",type:"safety",category:"معدات حماية",life:24,lead:60,mode:"replace"},
  {key:"chest",name:"الصدرية (واقي الصدر)",en:"Safety Chest",type:"safety",category:"معدات حماية",life:24,lead:60,mode:"replace"},
  {key:"handsleg",name:"واقي اليدين والأرجل",en:"Safety Hands & Legs",type:"safety",category:"معدات حماية",life:24,lead:60,mode:"replace"},
  {key:"shoes",name:"حذاء السلامة",en:"Safety Shoes",type:"safety",category:"معدات حماية",life:12,lead:45,mode:"replace"},
  {key:"vacuum",name:"المكنسة",en:"Vacuum Cleaner",type:"tool",category:"أدوات",life:18,lead:45,mode:"replace"},
  {key:"watergun",name:"مسدس الماء",en:"Water Gun",type:"tool",category:"أدوات",life:12,lead:30,mode:"replace"},
  {key:"watermotor",name:"موتور الماء",en:"Water Motor",type:"tool",category:"أدوات",life:18,lead:45,mode:"replace"},
  {key:"headlight",name:"كشّاف الرأس",en:"Headlight",type:"tool",category:"أدوات",life:12,lead:30,mode:"replace"},
  // water_tank: قيمة مبدئية يؤكدها المالك (24 شهراً، مهلة 45 يوماً)
  {key:"watertank",name:"خزان الماء",en:"Water Tank",type:"tool",category:"أدوات",life:24,lead:45,mode:"replace"},
  {key:"servicebox",name:"صندوق الخدمة",en:"Service Box",type:"tool",category:"أدوات",life:24,lead:45,mode:"replace"},
  {key:"brushes",name:"الفرش (إطارات/مكيّف/أرضية/صغيرة)",en:"Brushes set",type:"tool",category:"أدوات",life:6,lead:14,mode:"replace"},
  {key:"dash",name:"ملمّع الدَّشبورد",en:"Dashboard Polish",type:"cleaning",category:"مواد تنظيف",life:1,lead:7,mode:"reorder"},
  {key:"tyrepol",name:"ملمّع الإطارات",en:"Tyre Polish",type:"cleaning",category:"مواد تنظيف",life:1,lead:7,mode:"reorder"},
  {key:"stain",name:"مزيل البقع",en:"Stain Remover",type:"cleaning",category:"مواد تنظيف",life:1,lead:7,mode:"reorder"},
  {key:"lasttouch",name:"اللمسة الأخيرة",en:"Last Touch",type:"cleaning",category:"مواد تنظيف",life:1,lead:7,mode:"reorder"},
  {key:"glass",name:"منظّف الزجاج",en:"Glass Cleaner",type:"cleaning",category:"مواد تنظيف",life:1,lead:7,mode:"reorder"},
  {key:"soap",name:"صابون/شامبو",en:"Soap/Shampoo",type:"cleaning",category:"مواد تنظيف",life:1,lead:7,mode:"reorder"},
  {key:"sponge",name:"إسفنجات (بودي/إطارات)",en:"Sponges",type:"sponge",category:"مستهلكات",life:2,lead:7,mode:"reorder"},
  {key:"towels",name:"مناشف ميكروفايبر (4 ألوان)",en:"Microfiber towels",type:"towel",category:"مستهلكات",life:2,lead:7,mode:"reorder"},
];

// مفتاح صنف البوابة (ASSET_ITEMS في BikerPortal.jsx) ← مفتاح الكتالوج. عدة أصناف قد تعود لقطعة كتالوج واحدة (الفرش، الإسفنج).
export const ASSET_TO_CATALOG={
  uniform:"uniform",helmet:"helmet",safety_chest:"chest",safety_limbs:"handsleg",shoes:"shoes",headlight:"headlight",
  water_tank:"watertank",water_motor:"watermotor",water_gun:"watergun",
  floor_brush:"brushes",tyre_brush:"brushes",small_brush:"brushes",ac_brush:"brushes",
  sponge_body:"sponge",sponge_tyre:"sponge",vacuum:"vacuum",
  dashboard_polish:"dash",tyre_polish:"tyrepol",stain_remover:"stain",last_touch:"lasttouch",glass_cleaner:"glass",
  service_box:"servicebox",soap_bottle:"soap",
};
export const catalogByKey=k=>CATALOG.find(c=>c.key===k)||null;
export const catalogForItem=itemKey=>catalogByKey(ASSET_TO_CATALOG[itemKey]);
// قطعة custody_assets ← مفتاح الكتالوج (السجلات لا تحفظ المفتاح؛ الاسم العربي أو الإنجليزي من الكتالوج نفسه)
export const catalogOfAsset=a=>{if(!a)return null;const n=String(a.name||"").trim(),e=String(a.name_en||"").trim().toLowerCase();
  return CATALOG.find(c=>c.name===n)||CATALOG.find(c=>e&&c.en.toLowerCase()===e)||null;};
