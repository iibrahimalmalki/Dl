// لائحة الالتزام الميداني — HR-POL-003-A v1.1 (نموذج FRM-OPS-002)
// 15 بنداً · 4 محاور. بنود الإدارة (⚠️) لا تدخل في درجة البايكر وتُحسب في «جاهزية الإمداد».
// v1.1: فُصل بند الصندوق إلى نظافة (بايكر، #2) وحالة/دهان (إدارة، #15) حتى لا يُحاسب البايكر على نقص إمداد أو صيانة.

export const AXES={
  motorcycle:{ar:"الدراجة النارية",ic:"bike"},
  provider:{ar:"مقدم الخدمة",ic:"employees"},
  materials:{ar:"المواد",ic:"vendors"},
  washing:{ar:"الغسيل",ic:"operations"},
};
// resp: biker | shared (البايكر+الإدارة، يُحتسب على البايكر) | mgmt (الإدارة ⚠️ — مستثنى من درجة البايكر)
// photos: زوايا التصوير المطلوبة للتوثيق (فارغة = لا تتطلب صورة)
// ترتيب المصفوفة هو ترتيب العرض (البند 15 يظهر بعد البند 2 لأنه مشتق منه).
export const ITEMS=[
  {n:1,axis:"motorcycle",resp:"biker",ar:"الدراجة النارية نظيفة بدون غبار أو أوساخ ظاهرة",photos:["أمام","خلف","يمين","يسار"]},
  {n:2,axis:"motorcycle",resp:"biker",ar:"الصندوق نظيف من الخارج ومناسب للعمل",photos:["الصندوق - خارج","الصندوق - جانب"]},
  {n:15,axis:"motorcycle",resp:"mgmt",ar:"حالة الصندوق سليمة: الدهان والهيكل بلا تلف يستدعي إعادة الدهان أو الاستبدال",photos:[],parts:[{ar:"إعادة دهان",en:"Repaint"},{ar:"استبدال الصندوق",en:"Box replacement"},{ar:"إصلاح القفل/المفصلات",en:"Lock/hinge repair"}]},
  {n:3,axis:"motorcycle",resp:"biker",ar:"الصندوق مرتب ونظيف من الداخل",photos:["الصندوق - داخل"]},
  {n:4,axis:"motorcycle",resp:"mgmt",ar:"ملصق سويتر على الصندوق جديد ونظيف وفي مكانه",photos:["الملصق - جهة يمين","الملصق - جهة يسار"]},
  {n:5,axis:"motorcycle",resp:"shared",ar:"إنارة الدراجة الأمامية والخلفية تعمل بشكل ممتاز",photos:["إنارة أمامية","إنارة خلفية"]},
  {n:6,axis:"motorcycle",resp:"biker",ar:"الدراجة سليمة بدون خدوش جسيمة أو تشققات",photos:["أمام","خلف","يمين","يسار"]},
  {n:7,axis:"provider",resp:"mgmt",ar:"الزي الرسمي المعتمد من سويتر متوفر وكامل",photos:["الزي كامل"],parts:[{ar:"القميص/الجاكيت",en:"Shirt/Jacket"},{ar:"البنطال",en:"Trousers"}]},
  {n:8,axis:"provider",resp:"biker",ar:"الزي الرسمي نظيف وخالٍ من التشققات والأوساخ",photos:["الزي - أمام","الزي - خلف"]},
  {n:9,axis:"provider",resp:"mgmt",ar:"الكاب + اللبس الرسمي + الحذاء الأسود متوفرة",photos:["الكاب والحذاء"],parts:[{ar:"الكاب",en:"Cap"},{ar:"اللبس الرسمي",en:"Official attire"},{ar:"الحذاء الأسود",en:"Black shoes"}]},
  {n:10,axis:"provider",resp:"mgmt",ar:"معدات الحماية كاملة: صدرية + حامي أرجل + ذراع + خوذة",photos:["معدات الحماية"],parts:[{ar:"الصدرية (واقي الصدر)",en:"Safety Chest"},{ar:"واقي اليدين والأرجل",en:"Safety for Hands & Legs"},{ar:"الخوذة",en:"Helmet"},{ar:"حذاء السلامة",en:"Safety Shoes"}]},
  {n:11,axis:"materials",resp:"biker",ar:"يعرف وظيفة كل منشفة حسب لونها (5 ألوان)",photos:["المناشف الخمس"]},
  {n:12,axis:"materials",resp:"mgmt",ar:"مواد التنظيف عليها ملصق سويتر — لا فراغ ولا تلف",photos:["مواد التنظيف"],parts:[{ar:"ملمّع الدَّشبورد",en:"Dashboard Polish"},{ar:"ملمّع الإطارات",en:"Tyre Polish"},{ar:"مزيل البقع",en:"Stain Remover"},{ar:"اللمسة الأخيرة (Last Touch)",en:"Last Touch"},{ar:"منظّف الزجاج",en:"Glass Cleaner"},{ar:"صابون/شامبو",en:"Soap/Shampoo"}]},
  {n:13,axis:"washing",resp:"biker",ar:"يطبّق تسلسل الغسيل الصحيح: ماء ← صابون ← إسفنجة ← منشفة",photos:["أثناء الغسيل"]},
  {n:14,axis:"washing",resp:"biker",ar:"يضع مخلفات السيارة في الكيس — لا رمي قمامة حول المركبة",photos:["كيس المخلفات"]},
];
export const bikerItems=ITEMS.filter(i=>i.resp!=="mgmt");   // 9 بنود قابلة للتقييم
export const mgmtItems=ITEMS.filter(i=>i.resp==="mgmt");     // 6 بنود إدارة/إمداد

// النتائج: pass(1) | half(0.5) | fail(0) | excused (يخرج من المقام — مسؤولية الإمداد 9.4) | null = غير مُقيَّم
const PTS={pass:1,half:0.5,fail:0};
export function compliance(results){
  let pts=0,den=0,failed=[],notAssessed=[];
  bikerItems.forEach(i=>{
    const r=results[i.n];
    if(r==null){notAssessed.push(i.n);return;}   // غير مُقيَّم → خارج المقام
    if(r==="excused")return;                      // معفى (إمداد) → خارج المقام
    den++;pts+=PTS[r]??0;
    if(r==="fail"||r==="half")failed.push(i.n);
  });
  const pct=den?Math.round(pts/den*1000)/10:null;
  // بنود الإدارة الفاشلة → action items
  const actions=mgmtItems.filter(i=>results[i.n]==="fail").map(i=>i.n);
  return{pct,points:pts,denom:den,failed,actions,notAssessed};
}
// جاهزية الإمداد (بنود الإدارة/الإمداد فقط): متوفّر=1 · بديل جزئي=0.5 · ناقص=0 · معفى/غير مُقيَّم خارج المقام
export function supplyReadiness(results){
  let pts=0,den=0,missing=[];
  mgmtItems.forEach(i=>{
    const r=results[i.n];
    if(r==null||r==="excused")return;
    den++;pts+=PTS[r]??0;
    if(r==="fail"||r==="half")missing.push(i.n);
  });
  return{pct:den?Math.round(pts/den*1000)/10:null,points:pts,denom:den,missing};
}
// التزام كل محور (لبنود البايكر فقط) + الإجمالي
export function complianceByAxis(results){
  const out={};
  Object.keys(AXES).forEach(ax=>{
    let pts=0,den=0;
    bikerItems.filter(i=>i.axis===ax).forEach(i=>{const r=results[i.n];if(r==="excused"||r==null)return;den++;pts+=PTS[r]??0;});
    out[ax]={pct:den?Math.round(pts/den*1000)/10:null,points:pts,denom:den};
  });
  return out;
}
// الحكم وأثره المالي وفق HR-POL-003 (ريال الجودة/السلامة)
export function effect(pct){
  if(pct==null)return{key:"none",ar:"غير مكتمل",color:"#94a3b8",bg:"#f4f5f7",fin:"لا يُحتسب أثر مالي: الجولة غير مكتملة."};
  if(pct>=80)return{key:"ok",ar:"مطابق — توثيق إيجابي",color:"#087443",bg:"#e7f7ef",fin:"بلا أثر مالي هذه الجولة. تُوثَّق نتيجة إيجابية في ملف البايكر."};
  if(pct>=60)return{key:"warn",ar:"تنبيه رسمي + خطة تحسين 7 أيام",color:"#b54708",bg:"#fef3e2",fin:"بلا خصم هذه الجولة. تكرار النتيجة (أقل من 80٪) في الجولة التالية يُخفّض ريال الجودة في HR-POL-003 إلى 0.5 عن الشهر."};
  return{key:"deduct",ar:"إشعار + مراجعة تدريبية + خصم من محور الجودة",color:"#b42318",bg:"#feecea",fin:"يُخفَّض ريال الجودة في HR-POL-003 إلى 0 عن شهر الجولة، مع مراجعة تدريبية موثقة قبل الجولة التالية."};
}
export const RESP_AR={biker:"البايكر",shared:"البايكر + الإدارة",mgmt:"الإدارة"};
