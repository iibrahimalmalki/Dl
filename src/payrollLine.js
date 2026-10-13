// عرض سطر المسير المعتمد للبايكر (بوابة «أدائي») — منطق نقي بلا DOM ولا Supabase.
// السطر من payroll_lines (RLS: أسطر البايكر من مسير غير مسودة فقط). المبالغ بأرقام إنجليزية دائماً.
const n2=v=>Math.round((Number(v)||0)*100)/100;
export const money=v=>n2(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});

export const PAY_STATUS={
  paid:{ar:"مدفوعة",bn:"পরিশোধিত",tone:"ok"},
  deferred:{ar:"مؤجَّلة",bn:"স্থগিত",tone:"warn"},
  pending:{ar:"بانتظار الدفع",bn:"পরিশোধের অপেক্ষায়",tone:"info"},
};

// آخر 4 أرقام فقط من مرجع الحوالة
export const maskRef=r=>{const s=String(r||"").replace(/\s+/g,"");return s?(s.length>4?"…"+s.slice(-4):s):"";};

export function lineView(l){
  if(!l)return null;
  const c=l.computed||{},i=l.inputs||{};
  const st=PAY_STATUS[l.payment_status]?l.payment_status:"pending";
  return{
    period:l.period,
    bonus:n2(l.net_bonus),
    washes:Number(c.net_washes??i.net_washes)||0,
    rate:c.rate_per_wash!=null?n2(c.rate_per_wash):null,
    tips:n2(c.tips??i.tips),
    production:n2(c.production),
    deductions:n2(c.deductions),
    status:st,statusAr:PAY_STATUS[st].ar,statusBn:PAY_STATUS[st].bn,tone:PAY_STATUS[st].tone,
    paidAt:st==="paid"&&l.paid_at?String(l.paid_at).slice(0,10):null,
    paidAmount:l.paid_amount!=null?n2(l.paid_amount):null,
    ref:maskRef(l.payment_ref),
    basePaid:l.base_paid===true,
  };
}

// أحدث الأسطر أولاً، سطر واحد لكل شهر
export function latestLines(lines,max=3){
  const seen=new Set();
  return(lines||[]).filter(l=>l&&l.period).slice().sort((a,b)=>String(b.period).localeCompare(String(a.period)))
    .filter(l=>!seen.has(l.period)&&seen.add(l.period)).slice(0,max).map(lineView);
}
