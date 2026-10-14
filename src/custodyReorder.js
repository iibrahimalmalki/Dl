// «طلب سويتر» من صفحة العُهد: طلب إمداد واحد يجمع قطعاً محدّدة لبايكر واحد، وكل قطعة تُربط به (reorder_request_id).
// لا تجديد عند الطلب (قرار المالك 2026-10-14): القطعة «مستحقة» حتى التسليم، ودورتها تتجدّد عند الإكمال (supply_request_complete).
// دوال نقية بلا DOM ولا Supabase.

// أعمدة supply_requests المُرجعة بعد الإدراج — لا أعمدة custody_assets (خطأ «supply_requests.category does not exist»)
export const SR_RET="id,ref,status";
export const LIVE=["active","due","missing"];
const CLOSED_REQ=["completed","cancelled"];
const CONSUMABLE=["cleaning","sponge","towel","consumable"];

// الطلب المربوط مفتوح؟ (reqs: {id: status}) — طلب غير معروف الحالة يُعدّ مفتوحاً احتياطاً من التكرار
export const openLink=(a,reqs={})=>!!(a&&a.reorder_request_id)&&!CLOSED_REQ.includes(reqs[a.reorder_request_id]);

// قابلة للطلب: قائمة، وليست جوالاً (IMEI ⇒ «استُبدلت») ولا دراجة (خطة شراء)، وغير مربوطة بطلب مفتوح
export const reorderable=(a,reqs={})=>!!a&&LIVE.includes(a.status)&&a.item_type!=="device"&&a.item_type!=="motorcycle"&&!openLink(a,reqs);

const pad=n=>String(n).padStart(2,"0");
export const reorderRef=(sid,d=new Date(),rnd=Math.random())=>`DW-${sid||"x"}-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-C${Math.floor(1000+rnd*9000)}`;

// سطر الطلب لكل قطعة (نفس بنية items في طلبات الإمداد؛ n فارغ ⇒ المطابقة بالاسم)
export function reorderItem(a){
  const consumable=CONSUMABLE.includes(a.item_type);
  return{n:null,ar:a.name,en:a.name_en||"",type:a.item_type,category:a.category||"",category_en:"",
    status:consumable?"reorder":"replace",
    status_ar:consumable?"إعادة طلب (استهلاك دورة العُهدة)":"استبدال قطعة عُهدة",
    status_en:consumable?"Reorder (consumable cycle)":"Replacement (custody item)",
    note:a.status==="missing"?"ناقصة — لم تُسلَّم بعد":`عُهدة بدأت ${a.start_date}`,parts_ar:"",parts_en:""};
}

// الخطة ⇒ {error} أو {ref, row, link, keepMissing}
//   row: صف supply_requests · link: قطع تصبح «مستحقة» مربوطة بالطلب · keepMissing: «ناقصة» تُربط فقط (تبقى بلا عدّاد حتى التسليم)
export function reorderPlan(assets=[],{opId=null,reqs={},date=new Date(),rnd=Math.random()}={}){
  const list=(assets||[]).filter(Boolean);
  if(!list.length)return{error:"حدّد قطعة واحدة على الأقل."};
  const emp=list[0].employee_id||null,sid=list[0].sweater_id||null;
  if(list.some(a=>(a.employee_id||null)!==emp||(a.sweater_id||null)!==sid))return{error:"الطلب الواحد لبايكر واحد — حدّد قطع البايكر نفسه."};
  if(new Set(list.map(a=>a.id)).size!==list.length)return{error:"قطعة مكرّرة في التحديد."};
  const bad=list.find(a=>!reorderable(a,reqs));
  if(bad)return{error:openLink(bad,reqs)?`«${bad.name}» مطلوبة بطلب مفتوح — أكمله أو ألغِه أولاً.`:`«${bad.name}» لا تُطلب من هنا (الجوال/الدراجة أو قطعة مغلقة).`};
  const ref=reorderRef(sid,date,rnd);
  const row={operator_id:list[0].operator_id||((opId&&opId!=="all")?opId:null),ref,round_id:null,
    biker_name:list[0].biker_name||null,sweater_id:sid,requesting_dept:"التشغيل — دلو ورغوة",items:list.map(reorderItem)};
  return{ref,row,link:list.filter(a=>a.status!=="missing").map(a=>a.id),keepMissing:list.filter(a=>a.status==="missing").map(a=>a.id)};
}
