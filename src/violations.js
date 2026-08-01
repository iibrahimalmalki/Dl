// كتالوج المخالفات الميدانية المعتمد من سويتر — POL-QUA-001 v1.0
// 22 مخالفة · 4 مستويات · نوافذ اعتراض. المرجع الرسمي للاستقطاعات.
// win: ساعات نافذة الاعتراض لدى سويتر (تبدأ من وقت التسجيل) — null = لا يوجد اعتراض.

export const SEVERITY={
  critical:{ar:"حرجة",en:"Critical",color:"#b42318",bg:"#feecea",bd:"#f7bfba",range:"500–1,000+"},
  high:{ar:"عالية",en:"High",color:"#b54708",bg:"#fef3e2",bd:"#fbdba7",range:"100–200"},
  medium:{ar:"متوسطة",en:"Medium",color:"#854d0e",bg:"#fefce8",bd:"#fde68a",range:"50–100"},
  low:{ar:"منخفضة",en:"Low",color:"#175cd3",bg:"#eff6ff",bd:"#bcd7fb",range:"5–30"},
};

// win بالساعات: 24، 72 (3 أيام)، أو null (لا اعتراض)
export const VIOLATIONS=[
  // ── حرجة ──
  {code:1,ar:"غسيل خارج التطبيق",sev:"critical",fine:1000,unit:"",repeat:"إيقاف دائم",win:72,note:"مخالفة فورية لا تخضع للتدرّج"},
  {code:2,ar:"التدخين أثناء الغسيل",sev:"critical",fine:500,unit:"",repeat:"إيقاف دائم",win:72,note:"مخالفة فورية لا تخضع للتدرّج"},
  {code:3,ar:"عدم الاستجابة لطلب المراقب لإظهار الأدوات والمواد",sev:"critical",fine:500,unit:"",repeat:"يتضاعف إلى 1,000",win:24,note:"مصنّفة رسمياً كمخالفة جسيمة"},
  {code:4,ar:"استخدام حساب مقدّم خدمة آخر",sev:"critical",fine:500,unit:"",repeat:"1,000 ثم فصل",win:null,note:"مصنّفة رسمياً كمخالفة جسيمة"},
  // ── عالية ──
  {code:5,ar:"كسر صندوق الأدوات",sev:"high",fine:200,unit:"",repeat:"—",win:24},
  {code:6,ar:"عدم الالتزام بإجراءات الغسيل المعتمدة",sev:"high",fine:100,unit:"/بند",repeat:"200 (تكرار ثانٍ شهرياً)",win:24,note:"يشمل عدم استخدام الصابون/الإسفنجة/ماء كافٍ"},
  {code:7,ar:"عدم لبس ملابس الحماية أثناء قيادة الدراجة",sev:"high",fine:100,unit:"",repeat:"200 (تكرار ثانٍ)",win:24},
  {code:8,ar:"عدم الالتزام بالزي الرسمي أو الاكتفاء بجزء منه",sev:"high",fine:100,unit:"",repeat:"حتى 200 + إيقاف يوم",win:24},
  {code:9,ar:"توثيق سيارة مختلفة عن سيارة العميل بلا اتفاق",sev:"high",fine:100,unit:"",repeat:"200 (تكرار ثالث)",win:24,note:"+ تحميل دعوى الضرر كاملة حتى لو لم تثبت"},
  // ── متوسطة ──
  {code:10,ar:"ارتداء إكسسوارات باليد أو تطويل الأظافر أثناء الغسيل",sev:"medium",fine:50,unit:"",repeat:"100 (تكرار ثانٍ)",win:24},
  {code:11,ar:"مخالفة النظافة الشخصية",sev:"medium",fine:50,unit:"",repeat:"حتى 100 (تكرار ثانٍ)",win:24},
  {code:12,ar:"خدوش أو تلف ملصقات الدراجة",sev:"medium",fine:50,unit:"",repeat:"حتى 100 (تكرار ثانٍ)",win:24},
  {code:13,ar:"عدم توثيق السيارة بالصور أو التوثيق الخاطئ",sev:"medium",fine:50,unit:"",repeat:"100 (تكرار ثالث)",win:24,note:"عند دعوى ضرر: الفاتورة كاملة على المزود"},
  {code:14,ar:"توقف البايكر 3 أيام متتالية بلا بديل",sev:"medium",fine:50,unit:"/يوم",repeat:"—",win:null,note:"لا يحق الاعتراض؛ يُصدَّر كل 3 أيام"},
  {code:15,ar:"رمي المخلفات",sev:"medium",fine:50,unit:"",repeat:"100 (تكرار ثانٍ نفس الشهر)",win:24},
  {code:16,ar:"إلغاء الموعد بسبب التأخر (DC)",sev:"medium",fine:50,unit:"/موعد",repeat:"—",win:24,note:"أول موعد باليوم أو أول موعد بعد الاستراحة"},
  // ── منخفضة ──
  {code:17,ar:"فقدان أو تعطل الأدوات أو المواد",sev:"low",fine:30,unit:"",repeat:"—",win:24},
  {code:18,ar:"شكوى جودة غسيل متكررة",sev:"low",fine:20,unit:"/موعد",repeat:"من الشكوى الثالثة أسبوعياً",win:24},
  {code:19,ar:"تدني جودة الغسيل (إهمال زوايا أو أجزاء)",sev:"low",fine:10,unit:"",repeat:"—",win:24,note:"10–20 ريال حسب تقرير المراقب الميداني"},
  {code:20,ar:"نظافة الأدوات/المواد أو حاجتها للاستبدال",sev:"low",fine:15,unit:"",repeat:"—",win:24,note:"ليست مسؤولية مركز الدعم أساساً"},
  {code:21,ar:"نقص الخدمات الإضافية المطلوبة",sev:"low",fine:10,unit:"/موعد",repeat:"—",win:24},
  {code:22,ar:"عدم تحديث حالة الطلب (On The Way → Arrived)",sev:"low",fine:5,unit:"/طلب",repeat:"—",win:24,note:"عند تجاوز 35 دقيقة للموعد"},
];

export const byCode=code=>VIOLATIONS.find(v=>v.code===Number(code));

// نافذة اعتراض سويتر تبدأ من وقت التسجيل. تُرجع {deadline, openMs, open, none}
export function objectionState(loggedAtISO,win,nowMs){
  if(win==null)return{none:true,open:false,deadline:null};
  const start=new Date(loggedAtISO).getTime();
  if(isNaN(start))return{none:false,open:false,deadline:null};
  const deadline=start+win*3600*1000;
  const now=nowMs??Date.now();
  return{none:false,open:now<deadline,deadline:new Date(deadline).toISOString(),remainingMs:deadline-now};
}
// نافذة اعتراض البايكر الداخلية للمالك = 48 ساعة من التسجيل (ملحق د)
export function internalDeadline(loggedAtISO){
  const start=new Date(loggedAtISO).getTime();if(isNaN(start))return null;
  return new Date(start+48*3600*1000).toISOString();
}
// التكرار الجسيم: نفس المخالفة لنفس البايكر أكثر من مرتين خلال 7 أيام
export function seriousRepeat(rows,sweaterId,code,refISO){
  const ref=new Date(refISO).getTime();const wk=7*24*3600*1000;
  const n=rows.filter(r=>r.sweater_id===sweaterId&&Number(r.code)===Number(code)&&Math.abs(new Date(r.logged_at).getTime()-ref)<=wk).length;
  return n>2;
}
