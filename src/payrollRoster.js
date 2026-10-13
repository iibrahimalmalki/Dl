// من يدخل مسير الشهر — دوال نقية بلا Supabase (قرار المالك 2026-10-13).
// البايكر النشط: دوره biker (أو بلا دور قديم)، غير تجريبي، مباشرته ≤ نهاية الشهر (الفارغة = مباشر مع تنبيه)،
// ولم يغادر قبل بداية الشهر (offboarding.last_day). من له سطر محفوظ في مسير الشهر يبقى ظاهراً دائماً.
import{isManagerial}from"./testSandbox";

const monthBounds=p=>{const[y,m]=String(p).split("-").map(Number);const last=new Date(Date.UTC(y,m,0)).getUTCDate();
  return{start:`${p}-01`,end:`${p}-${String(last).padStart(2,"0")}`};};
const sid=v=>String(v??"").trim();

export function isActiveBiker(e,period,lastDay){
  if(!e||e.is_test||!sid(e.employee_id))return false;
  if((e.staff_role||"biker")!=="biker")return false;
  const{start,end}=monthBounds(period);
  if(e.start_date&&String(e.start_date).slice(0,10)>end)return false;
  // غادر قبل الشهر ولم يُعَد تعيينه بعد المغادرة (مباشرة لاحقة لآخر يوم = إعادة تعيين)
  const ld=lastDay&&String(lastDay).slice(0,10),sd=e.start_date&&String(e.start_date).slice(0,10);
  if(ld&&ld<start&&!(sd&&sd>ld))return false;
  return true;
}

// emps: employees · offboarding: [{employee_id,sweater_id,last_day}] · ops: ops_biker_month للشهر · savedIds: موظفون لهم سطر محفوظ
export function payrollRoster({emps=[],offboarding=[],ops=[],period,savedIds=[]}){
  const saved=new Set(savedIds);
  const lastBy={};offboarding.forEach(o=>{const d=o.last_day;if(!d)return;
    [o.employee_id,sid(o.sweater_id)&&"s:"+sid(o.sweater_id)].filter(Boolean).forEach(k=>{if(!lastBy[k]||d>lastBy[k])lastBy[k]=d;});});
  const lastOf=e=>{const a=lastBy[e.id],b=lastBy["s:"+sid(e.employee_id)];return a&&b?(a>b?a:b):a||b||null;};
  const bikers=emps.filter(e=>saved.has(e.id)||isActiveBiker(e,period,lastOf(e)));
  // كل رقم سويتر لموظف حقيقي (حتى غير النشط) يُعدّ مربوطاً؛ غير المربوط = لا موظف بهذا الرقم
  const known=new Set(emps.map(e=>sid(e.employee_id)).filter(Boolean));   // التجريبي معروف أيضاً (خارج المسير لا «غير مربوط»)
  const unlinked=ops.filter(o=>sid(o.sweater_id)&&!known.has(sid(o.sweater_id))).map(o=>({sweater_id:sid(o.sweater_id),biker_name:o.biker_name||""}));
  const supervisor=emps.find(e=>e.staff_role==="supervisor"&&!e.is_test)||null;
  return{bikers,unlinked,supervisor};
}

// تحذير الإكراميات: المجموع ≠ إكراميات الفاتورة بأكثر من ريال
export function tipsCheck(total,invoice,tol=1){
  if(invoice==null)return null;
  const t=Math.round((Number(total)||0)*100)/100,i=Math.round(Number(invoice)*100)/100,d=Math.round(Math.abs(t-i)*100)/100;
  return d>tol?{total:t,invoice:i,diff:d}:null;
}
