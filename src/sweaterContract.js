// عقد الشراكة التشغيلية + ملحق التسعير — سويتر × دلو ورغوة (SSP Partner 47)
// المصدر: عقد شراكة تشغيلية موقّع 20/08/2025 + ملحق التسعير 30/07/2026.

export const SSP_CONTRACT={
  partner_id:47,
  title:"عقد شراكة تشغيلية في خدمات الغسيل",
  hijri:"25/2/1447",
  signed:"2025-08-20",
  start:"2025-08-19",
  end:"2030-08-19",
  term_years:5,
  envelope:"34AA08E2-0F18-4A00-9273-530564545462",
  party1:{name:"شركة سويتر المحدودة",cr:"1010638717",rep:"ابراهيم غويزي ربيعان المطيري",title:"CEO",phone:"0503237351",email:"igaizi@sweater.sa"},
  party2:{name:"مؤسسة دلو ورغوة التجارية",cr:"7051245657",rep:"ابراهيم حسن بن عيضه المالكي",id:"1070856743",phone:"0566884419",email:"abo.malk.03@gmail.com"},
  bikers:4,
  activation_fee_per_biker:5000, activation_fee_total:20000, refundable:false,
  bank:{beneficiary:"شركة اللمسة العصرية التقنية",bank:"البنك الأهلي",account:"26100000261004",iban:"SA5110000026100000261004"},
  per_order:20,                    // ﷼ لكل طلب مكتمل (غير شامل الضريبة)
  incentive:1, incentive_total:21, // +1﷼ حافز → 21﷼
  incentive_conditions:{min_rating:4.75, max_complaints_pct:1}, // تقييم ≥4.75/5 وشكاوى ≤1%
  sla:{orders_fulfilled_pct:99, on_time_pct:99, arrival_pct:95},
  invoice_day:5,                   // كشف الحساب أقصاه اليوم 5 من كل شهر
  payment_days:15,                 // سداد خلال 15 يوم عمل
  price_change_notice_days:90,     // تعديل المقابل المالي بإشعار 90 يوماً
  renewal_notice_days:30,          // تجديد تلقائي ما لم يُخطر قبل 30 يوماً
  early_terminate_window_months:6, // فسخ ودّي خلال 6 أشهر بإشعار 30 يوماً
  cure_days:30,
  confidentiality_years:10,
  ticket_penalty_per_order:1,      // خصم 1﷼/طلب إذا تجاوزت التذاكر 1%
  jurisdiction:"محاكم مدينة الرياض",
};

// ملحق التسعير حسب متوسط عدد الغسلات — سارٍ من 30/07/2026
export const PRICING_APPENDIX={ effective:"2026-07-30", envelope:"BAE65B0B-E7A1-81BC-8111-1B1031064201" };
export const MIN_GUARANTEE_ORDERS=196; // الحد الأدنى المضمون لكل بايكر شهرياً (Golden Guarantee)

// Tier | متوسط غسلات/بايكر/يوم | السعر | السعر شامل الضريبة | الطلبات الشهرية
export const PRICING_TIERS=[
  {tier:"Golden Guarantee",avgPerDay:0,   price:20,    priceVat:23,   monthlyOrders:196},
  {tier:1, avgPerDay:7.5, price:20,    priceVat:23,   monthlyOrders:210},
  {tier:2, avgPerDay:8,   price:19.57, priceVat:22.5, monthlyOrders:224},
  {tier:3, avgPerDay:8.5, price:19.13, priceVat:22,   monthlyOrders:238},
  {tier:4, avgPerDay:9,   price:18.70, priceVat:21.5, monthlyOrders:252},
  {tier:5, avgPerDay:9.5, price:18.26, priceVat:21,   monthlyOrders:266},
  {tier:6, avgPerDay:10,  price:17.83, priceVat:20.5, monthlyOrders:280},
  {tier:7, avgPerDay:10.5,price:17.39, priceVat:20,   monthlyOrders:294},
  {tier:8, avgPerDay:11,  price:16.96, priceVat:19.5, monthlyOrders:308},
  {tier:9, avgPerDay:11.5,price:16.52, priceVat:19,   monthlyOrders:322},
  {tier:10,avgPerDay:12,  price:16.09, priceVat:18.5, monthlyOrders:336},
];

// اختيار الشريحة حسب إجمالي الطلبات المنجزة شهرياً لكل بايكر
export function tierForMonthlyOrders(orders){
  let sel=PRICING_TIERS[0];
  for(const t of PRICING_TIERS){ if(Number(orders||0)>=t.monthlyOrders) sel=t; }
  return sel;
}
// المقابل المالي التقديري لبايكر (مع تطبيق الحد الأدنى المضمون)
export function payoutForBiker(orders){
  const t=tierForMonthlyOrders(orders);
  const billable=Math.max(Number(orders||0),MIN_GUARANTEE_ORDERS);
  return { tier:t.tier, unit:t.price, unitVat:t.priceVat,
    orders:Number(orders||0), billableOrders:billable,
    total:+(billable*t.price).toFixed(2), totalVat:+(billable*t.priceVat).toFixed(2) };
}
