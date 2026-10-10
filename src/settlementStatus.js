// حالات تسوية سويتر الشهرية (sweater_settlements.status) — منطق نقي بلا DOM ولا Supabase.
// estimated تقديرية ← draft مسودة ← confirmed معتمدة ← submitted مُرسلة (رُفعت الفاتورة) ← paid مدفوعة.
// العمود paid=true يعني «مدفوعة» أيّاً كانت الحالة النصية (أغسطس 2026: confirmed + paid).
export const SETTLEMENT_STATUS={
  estimated:{ar:"تقديرية",tone:"muted"},
  draft:{ar:"مسودة",tone:"muted"},
  confirmed:{ar:"معتمدة",tone:"ok"},
  submitted:{ar:"مُرسلة",tone:"info"},
  paid:{ar:"مدفوعة",tone:"paid"},
};
// حالات صافيها رقم رسمي (فاتورة) يُقدَّم على الاحتساب من العمليات
export const REVENUE_STATUSES=["confirmed","submitted","paid"];

// الحالة الظاهرة للصف
export function stageOf(row){
  if(!row)return"draft";
  if(row.paid===true||row.status==="paid")return"paid";
  return SETTLEMENT_STATUS[row.status]?row.status:"draft";
}
export const stageLabel=row=>{const s=row&&row.status;const k=stageOf(row);return SETTLEMENT_STATUS[k]&&(k!=="draft"||!s||s==="draft")?SETTLEMENT_STATUS[k].ar:String(s);};

// مُرسلة أو مدفوعة ⇒ المبالغ والسطور مقفلة في صفحة التسوية (الحفظ يعيد احتساب net_total من السطور ويستبدلها)
export const isLocked=row=>!!row&&(row.paid===true||row.status==="submitted"||row.status==="paid");

// صافي الشهر الرسمي إن وُجد (null ⇒ يُحتسب من العمليات)
export function settledNet(rows,period){
  const r=(rows||[]).find(x=>x&&x.period===period&&REVENUE_STATUSES.includes(x.status)&&x.net_total!=null&&x.net_total!=="");
  return r?Number(r.net_total):null;
}
