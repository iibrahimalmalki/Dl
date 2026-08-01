// لائحة الالتزام الميداني — HR-POL-003-A v1.0 (نموذج FRM-OPS-002)
// 14 بنداً · 4 محاور. بنود الإدارة (⚠️) لا تدخل في درجة البايكر.

export const AXES={
  motorcycle:{ar:"الدراجة النارية",ic:"bike"},
  provider:{ar:"مقدم الخدمة",ic:"employees"},
  materials:{ar:"المواد",ic:"vendors"},
  washing:{ar:"الغسيل",ic:"operations"},
};
// resp: biker | shared (البايكر+الإدارة، يُحتسب على البايكر) | mgmt (الإدارة ⚠️ — مستثنى)
// photos: زوايا التصوير المطلوبة للتوثيق (فارغة = لا تتطلب صورة)
export const ITEMS=[
  {n:1,axis:"motorcycle",resp:"biker",ar:"الدراجة النارية نظيفة بدون غبار أو أوساخ ظاهرة",photos:["أمام","خلف","يمين","يسار"]},
  {n:2,axis:"motorcycle",resp:"biker",ar:"الصندوق نظيف ومناسب للعمل وخالٍ من الخدوش الجديدة",photos:["الصندوق - خارج","الصندوق - جانب"]},
  {n:3,axis:"motorcycle",resp:"biker",ar:"الصندوق مرتب ونظيف من الداخل",photos:["الصندوق - داخل"]},
  {n:4,axis:"motorcycle",resp:"mgmt",ar:"ملصق سويتر على الصندوق جديد ونظيف وفي مكانه",photos:["الملصق"]},
  {n:5,axis:"motorcycle",resp:"shared",ar:"إنارة الدراجة الأمامية والخلفية تعمل بشكل ممتاز",photos:["إنارة أمامية","إنارة خلفية"]},
  {n:6,axis:"motorcycle",resp:"biker",ar:"الدراجة سليمة بدون خدوش جسيمة أو تشققات",photos:["أمام","خلف","يمين","يسار"]},
  {n:7,axis:"provider",resp:"mgmt",ar:"الزي الرسمي المعتمد من سويتر متوفر وكامل",photos:["الزي كامل"]},
  {n:8,axis:"provider",resp:"biker",ar:"الزي الرسمي نظيف وخالٍ من التشققات والأوساخ",photos:["الزي - أمام","الزي - خلف"]},
  {n:9,axis:"provider",resp:"mgmt",ar:"الكاب + اللبس الرسمي + الحذاء الأسود متوفرة",photos:["الكاب والحذاء"]},
  {n:10,axis:"provider",resp:"mgmt",ar:"معدات الحماية كاملة: صدرية + حامي أرجل + ذراع + خوذة",photos:["معدات الحماية"]},
  {n:11,axis:"materials",resp:"biker",ar:"يعرف وظيفة كل منشفة حسب لونها (5 ألوان)",photos:["المناشف الخمس"]},
  {n:12,axis:"materials",resp:"mgmt",ar:"مواد التنظيف عليها ملصق سويتر — لا فراغ ولا تلف",photos:["مواد التنظيف"]},
  {n:13,axis:"washing",resp:"biker",ar:"يطبّق تسلسل الغسيل الصحيح: ماء ← صابون ← إسفنجة ← منشفة",photos:["أثناء الغسيل"]},
  {n:14,axis:"washing",resp:"biker",ar:"يضع مخلفات السيارة في الكيس — لا رمي قمامة حول المركبة",photos:["كيس المخلفات"]},
];
export const bikerItems=ITEMS.filter(i=>i.resp!=="mgmt");   // 9 بنود قابلة للتقييم
export const mgmtItems=ITEMS.filter(i=>i.resp==="mgmt");     // 5 بنود إدارة

// النتائج: pass(1) | half(0.5) | fail(0) | excused (يخرج من المقام — مسؤولية الإمداد 9.4)
const PTS={pass:1,half:0.5,fail:0};
export function compliance(results){
  let pts=0,den=0,failed=[];
  bikerItems.forEach(i=>{
    const r=results[i.n];
    if(r==="excused"||r==null)return;        // معفى (إمداد) أو غير مُقيَّم → خارج المقام
    den++;pts+=PTS[r]??0;
    if(r==="fail"||r==="half")failed.push(i.n);
  });
  const pct=den?Math.round(pts/den*1000)/10:null;
  // بنود الإدارة الفاشلة → action items
  const actions=mgmtItems.filter(i=>results[i.n]==="fail").map(i=>i.n);
  return{pct,points:pts,denom:den,failed,actions};
}
export function effect(pct){
  if(pct==null)return{key:"none",ar:"غير مكتمل",color:"#94a3b8",bg:"#f4f5f7"};
  if(pct>=80)return{key:"ok",ar:"لا أثر — توثيق إيجابي",color:"#087443",bg:"#e7f7ef"};
  if(pct>=60)return{key:"warn",ar:"تنبيه رسمي + خطة تحسين 7 أيام",color:"#b54708",bg:"#fef3e2"};
  return{key:"deduct",ar:"إشعار + مراجعة تدريبية + خصم من محور الجودة",color:"#b42318",bg:"#feecea"};
}
export const RESP_AR={biker:"البايكر",shared:"البايكر + الإدارة",mgmt:"الإدارة"};
