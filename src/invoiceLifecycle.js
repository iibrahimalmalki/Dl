// دورة حياة فاتورة سويتر الشهرية — منطق نقي بلا DOM ولا Supabase.
// معتمدة داخلياً (confirmed_at) ← مُرسلة لبوابة الموردين (submitted_at) ← قبِلتها سويتر (accepted_at + البقشيش) ← مدفوعة (paid_at).
// الأعمدة الجديدة في docs/sql/invoice_lifecycle.sql: submitted_at, accepted_at, tip_amount, due_date.
import{stageOf}from"./settlementStatus";

export const STEPS=[
  {key:"confirmed",ar:"معتمدة داخلياً",at:"confirmed_at"},
  {key:"submitted",ar:"مُرسلة للبوابة",at:"submitted_at"},
  {key:"accepted",ar:"قبِلتها سويتر",at:"accepted_at"},
  {key:"paid",ar:"مدفوعة",at:"paid_at"},
];
const ORDER=STEPS.map(s=>s.key);
// موعد التحويل المتوقع بعد القبول — تقدير من سابقتي يوليو وأغسطس (1 و7 أيام)؛ يؤكده المالك أو يعدّله لكل شهر
export const DUE_DAYS=14;

const num=v=>v==null||v===""?0:Number(v);
// تاريخ محلي (الرياض) لطابع زمني؛ التاريخ الصِرف يبقى كما هو — يطابق حساب الخادم at time zone 'Asia/Riyadh'
export const riyadhDate=v=>{if(!v)return null;const s=String(v);if(!/[TZ+ ]/.test(s.slice(10)))return s.slice(0,10);const d=new Date(s);return isNaN(d)?s.slice(0,10):d.toLocaleDateString("en-CA",{timeZone:"Asia/Riyadh"});};
export const todayRiyadh=()=>new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Riyadh"});
const r2=n=>Math.round(n*100)/100;
export const addDays=(iso,d)=>{const x=new Date(String(iso).slice(0,10)+"T00:00:00Z");x.setUTCDate(x.getUTCDate()+d);return x.toISOString().slice(0,10);};
const dayDiff=(a,b)=>Math.round((new Date(String(a).slice(0,10)+"T00:00:00Z")-new Date(String(b).slice(0,10)+"T00:00:00Z"))/864e5);

// المستحق = صافي الفاتورة + البقشيش الذي تضيفه سويتر عند القبول
export const expectedTotal=r=>r2(num(r&&r.net_total)+num(r&&r.tip_amount));
// البقشيش الفعلي من الدفعة (للأشهر المدفوعة قبل وجود العمود)
export const tipFromPayment=r=>r&&r.paid_amount!=null&&r.paid_amount!==""?r2(num(r.paid_amount)-num(r.net_total)):null;
// موعد التحويل: المحدد يدوياً، وإلا القبول + DUE_DAYS
export const dueDateOf=r=>r&&r.due_date?String(r.due_date).slice(0,10):r&&r.accepted_at?addDays(riyadhDate(r.accepted_at),DUE_DAYS):null;

// ملخص الدورة لصف تسوية: المرحلة، والخطوات مع تواريخها، والمستحق، والتأخر، والخطوة التالية
export function lifecycle(r,today){
  const stage=stageOf(r);
  const idx=ORDER.indexOf(stage);           // -1 للمسودة/التقديرية
  const steps=STEPS.map((s,i)=>({...s,done:i<=idx,date:r&&r[s.at]?riyadhDate(r[s.at]):null}));
  const due=dueDateOf(r);
  const overdueDays=stage!=="paid"&&due&&today&&dayDiff(today,due)>0?dayDiff(today,due):0;
  const waitingDays=stage==="submitted"&&r.submitted_at&&today?Math.max(0,dayDiff(today,riyadhDate(r.submitted_at))):0;
  const next=stage==="paid"?null
    :stage==="accepted"?{key:"paid",ar:overdueDays?`الدفعة متأخرة ${overdueDays} يوماً عن ${due} — تابع سويتر`:`بانتظار التحويل حتى ${due||"—"}`}
    :stage==="submitted"?{key:"accepted",ar:waitingDays>=7?`الفاتورة على البوابة منذ ${waitingDays} يوماً بلا قبول — تابع`:"بانتظار قبول سويتر على البوابة"}
    :stage==="confirmed"?{key:"submitted",ar:"ارفع الفاتورة على بوابة الموردين"}
    :{key:"confirmed",ar:"اعتمد التسوية أولاً"};
  return{stage,steps,expected:expectedTotal(r),due,overdueDays,waitingDays,next};
}
