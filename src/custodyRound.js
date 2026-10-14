// ربط الجولة الميدانية بسجل العهد (docs/sql/round_custody_check.sql). دوال نقية بلا DOM ولا Supabase:
//   1) «جرد العهدة» في نموذج الجولة: القطع القابلة للجرد، وأخطاء السطر (مرآة لقواعد round_custody_check)، ووسائط الاستدعاء.
//   2) «استخراج من جولة»: ما سُجّل متوفّراً ⇒ نشط · ما سُجّل ناقصاً ⇒ «ناقص» بلا عدّاد · ما لم يُسجَّل ⇒ لا يُضاف.
//   3) تسليم طلب إمداد مرتبط بجولة ⇒ القطع المطابقة لنفس البايكر والصنف التي تتجدّد دورتها.
// القاعدة هي المرجع: مطابقة IMEI ورفض الأسطر تتم فيها، وهنا للعرض والتنبيه قبل الإرسال فقط.
// من custodyLifecycle (لا custodyCatalog مباشرة) ومع استعمال isLive منه: يبقى الكتالوج داخل حزمة custodyLifecycle كما في main،
// فلا تنشأ حزمة كتالوج مستقلة تُضاف إلى قائمة تحميل بوابة البايكر في الحزمة الرئيسية
import{CATALOG,catalogByKey,catalogOfAsset,isLive,addMonths}from"./custodyLifecycle";

export const CONDS=[
  {v:"ok",ar:"سليمة",tone:"g"},
  {v:"damaged",ar:"تالفة",tone:"a"},
  {v:"lost",ar:"مفقودة",tone:"r"},
];
export const condAr=v=>(CONDS.find(c=>c.v===v)||{}).ar||"—";

// الأصول المعمّرة (صورة إلزامية في الجرد): الدراجة، الجوال، صندوق الخدمة، الخوذة — نفس شرط القاعدة
const DURABLE_KEYS=["moto","phone","servicebox","helmet"];
export const isDurable=a=>!!a&&(a.item_type==="motorcycle"||a.item_type==="device"||DURABLE_KEYS.includes((catalogOfAsset(a)||{}).key));
export const isPhone=a=>!!a&&a.item_type==="device";

// قطع البايكر التي تُجرد: النشطة والمستحقة فقط (لا المُستبدلة/المُرجعة ولا «الناقصة» — ليست بيده)، المعمّرة أولاً
export const checkable=(assets=[],employeeId)=>(assets||[])
  .filter(a=>a&&a.employee_id===employeeId&&(a.status==="active"||a.status==="due"))
  .sort((x,y)=>(isDurable(y)-isDurable(x))||String(x.name||"").localeCompare(String(y.name||""),"ar"));

const imeiOf=s=>String(s==null?"":s).replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[০-৯]/g,d=>"০১২৩৪৫৬৭৮৯".indexOf(d)).replace(/\D/g,"");
// مطابقة IMEI المُدخل مع serial_no للعرض الحي ⇒ true/false، أو null قبل الإدخال
export const imeiMatch=(entered,serial)=>{const e=imeiOf(entered);return e?e===imeiOf(serial):null;};

// أول خطأ لسطر جرد ⇒ نص عربي أو null (line: {condition, note, photo, imei})
export function lineError(line={},asset={}){
  const nm=asset.name||"القطعة";
  if(!["ok","damaged","lost"].includes(line.condition))return`اختر حالة «${nm}».`;
  if(line.condition!=="ok"&&!String(line.note||"").trim())return`اكتب ملاحظة لـ«${nm}» (تالفة/مفقودة).`;
  if(line.condition==="lost")return null;
  if(isDurable(asset)&&!line.photo)return`صورة «${nm}» إلزامية.`;
  // تعديل الجولة: نتيجة المطابقة المحفوظة على سطرها تكفي إن لم يُدخل رقم جديد (القاعدة تعيد استعمالها)
  if(isPhone(asset)&&!imeiOf(line.imei)&&line.imeiPrev==null)return"أدخل IMEI الجوال (اطلب *#06#).";
  return null;
}
// كل قطع البايكر يجب أن تُجرد ⇒ أول خطأ أو null
export function checkError(lines={},assets=[]){
  for(const a of assets){const e=lineError(lines[a.id]||{},a);if(e)return e;}
  return null;
}
// وسائط round_custody_check: سطر لكل قطعة؛ الصورة والـIMEI فقط حيث تلزم
export const checkArgs=(lines={},assets=[])=>assets.map(a=>{const l=lines[a.id]||{};const lost=l.condition==="lost";return{
  asset_id:a.id,condition:l.condition,note:String(l.note||"").trim(),photo:lost?null:(l.photo||null),imei:isPhone(a)&&!lost?imeiOf(l.imei):null};});
// «الكل سليم» للقطع غير المعمّرة التي لم تُجرد بعد — المعمّرة تحتاج صورة فتُجرد واحدة واحدة
export const allOkPatch=(lines={},assets=[])=>{const o={};assets.forEach(a=>{if(!isDurable(a)&&!(lines[a.id]&&lines[a.id].condition))o[a.id]={...(lines[a.id]||{}),condition:"ok"};});return o;};
// أسطر جولة محفوظة (field_rounds.custody_check) ⇒ حالة النموذج للتعديل. الـIMEI لا يُحفظ كاملاً: imeiPrev = نتيجة المطابقة المحفوظة
export const linesFromRound=(saved=[])=>{const o={};(Array.isArray(saved)?saved:[]).forEach(l=>{if(l&&l.asset_id)o[l.asset_id]={condition:l.condition,note:l.note||"",photo:l.photo||null,imei:"",imeiPrev:l.imei_ok==null?null:!!l.imei_ok};});return o;};
// تعديل جولة: تُجرد فقط القطع التي جُردت فيها (لا تُسجَّل حالة اليوم بتاريخ جولة قديمة)، والجولة بلا جرد لا تُجرد عند تعديلها
export const editable=(assets=[],saved=[])=>{const ids=new Set((Array.isArray(saved)?saved:[]).map(l=>l&&l.asset_id));return assets.filter(a=>ids.has(a.id));};
// ملخص الجرد لبطاقة الجولة ⇒ {ok, damaged, lost, imeiBad}
export const checkSummary=(saved=[])=>{const s={ok:0,damaged:0,lost:0,imeiBad:0};(Array.isArray(saved)?saved:[]).forEach(l=>{if(s[l.condition]!=null)s[l.condition]++;if(l.imei_ok===false)s.imeiBad++;});return s;};

// ── بنود الجولة ⇒ مفاتيح الكتالوج ──
// بند إدارة (توفّر) ⇒ أجزاؤه بمفاتيح الكتالوج؛ الجزء بلا مقابل في الكتالوج (الكاب، الحذاء الأسود) = null
const PARTS={
  7:{"القميص/الجاكيت":"uniform","البنطال":"uniform"},
  9:{"الكاب":null,"اللبس الرسمي":"uniform","الحذاء الأسود":null},
  10:{"الصدرية (واقي الصدر)":"chest","واقي اليدين والأرجل":"handsleg","الخوذة":"helmet","حذاء السلامة":"shoes"},
  12:{"ملمّع الدَّشبورد":"dash","ملمّع الإطارات":"tyrepol","مزيل البقع":"stain","اللمسة الأخيرة (Last Touch)":"lasttouch","منظّف الزجاج":"glass","صابون/شامبو":"soap"},
};
const keysOf=(n,parts)=>{const m=PARTS[n]||{};const ps=parts&&parts.length?parts:Object.keys(m);return[...new Set(ps.map(p=>m[p]).filter(Boolean))];};
// الدراجة والصندوق: فُحصا فعلياً في بنود الجولة (نظافة/حالة) ⇒ موجودان
const PRESENT={moto:[1,6],servicebox:[2,3,15]};

// «استخراج من جولة» ⇒ {available, missing, unknown}: مفاتيح كتالوج (بلا الجوال — يحتاج IMEI)
// متوفّر = البند «متوفّر» أو أجزاؤه غير المحدّدة كناقصة · ناقص = الجزء المحدّد في بند ناقص/جزئي/معفى، أو البند كله إن لم تُحدَّد أجزاء
// غير مُسجَّل = لا يُضاف (يُذكر للمالك ليضيفه يدوياً). «ناقص» يغلب «متوفّر» لنفس الصنف (الزي من البندين 7 و9).
export function extractPlan(round={}){
  const res=round.results||{},parts=round.item_parts||{};
  const avail=new Set(),miss=new Set();
  Object.keys(PARTS).forEach(k=>{const n=+k,r=res[n];if(r==null)return;
    const all=keysOf(n);
    if(r==="pass"){all.forEach(x=>avail.add(x));return;}
    const sel=(parts[n]||[]).filter(Boolean);
    const gone=sel.length?keysOf(n,sel):all;
    gone.forEach(x=>miss.add(x));
    all.filter(x=>!gone.includes(x)).forEach(x=>avail.add(x));
  });
  Object.entries(PRESENT).forEach(([key,ns])=>{if(ns.some(n=>res[n]!=null))avail.add(key);});
  const order=CATALOG.map(c=>c.key).filter(k=>k!=="phone");
  const missing=order.filter(k=>miss.has(k)),available=order.filter(k=>avail.has(k)&&!miss.has(k));
  return{available,missing,unknown:order.filter(k=>!avail.has(k)&&!miss.has(k))};
}

// صفوف custody_assets للاستخراج: المسجّل للبايكر (أي قطعة غير مُستبدلة/مُرجعة، ومنها «الناقصة») لا يُكرَّر
// ctx: {operator_id, employee_id, biker_name} ⇒ {rows, skipped, unknown}
export function extractRows(round={},existing=[],ctx={}){
  const plan=extractPlan(round);
  const have=new Set((existing||[]).filter(isLive).map(a=>(catalogOfAsset(a)||{}).key).filter(Boolean));
  const mk=(key,missing)=>{const c=catalogByKey(key);return{operator_id:ctx.operator_id??null,employee_id:ctx.employee_id??null,biker_name:ctx.biker_name||round.biker_name||"",sweater_id:round.sweater_id,
    item_type:c.type,category:c.category,name:c.name,name_en:c.en,start_date:round.round_date,life_months:c.life,lead_days:c.lead,
    end_date:missing?null:addMonths(round.round_date,c.life),status:missing?"missing":"active",source:"round",round_id:round.id};};
  const rows=[...plan.available.filter(k=>!have.has(k)).map(k=>mk(k,false)),...plan.missing.filter(k=>!have.has(k)).map(k=>mk(k,true))];
  return{rows,skipped:[...plan.available,...plan.missing].filter(k=>have.has(k)),unknown:plan.unknown};
}

// ── تسليم طلب الإمداد ⇒ مفاتيح الكتالوج التي يجدّدها ──
// أسطر الطلب من الجولة (shortageItems: n + parts) أو من «طلب سويتر» في صفحة العهد (n=null + اسم الكتالوج في ar).
// الصندوق (15): «استبدال الصندوق» فقط يجدّده؛ الدهان والإصلاح لا. الملصق (4) لا يقابله صنف عهدة.
export function renewKeys(items=[]){
  const out=new Set();
  (Array.isArray(items)?items:[]).forEach(it=>{if(!it)return;
    if(it.n==null){const c=CATALOG.find(x=>x.name===String(it.ar||"").trim());if(c)out.add(c.key);return;}
    if(+it.n===15){if((it.parts||[]).includes("استبدال الصندوق"))out.add("servicebox");return;}
    keysOf(+it.n,(it.parts||[]).filter(Boolean)).forEach(k=>out.add(k));
  });
  return CATALOG.map(c=>c.key).filter(k=>out.has(k));
}
// القطع المطابقة لنفس البايكر: نشطة/مستحقة/ناقصة من نفس الصنف — الجوال والدراجة لا يُجدَّدان بالإمداد
export function renewTargets(items=[],assets=[],employeeId){
  const keys=renewKeys(items);
  return(assets||[]).filter(a=>a&&a.employee_id===employeeId&&["active","due","missing"].includes(a.status)&&a.item_type!=="device"&&a.item_type!=="motorcycle"
    &&keys.includes((catalogOfAsset(a)||{}).key));
}
