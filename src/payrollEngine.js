// محرّك الرواتب — HR-POL-003 v1.2 (موحّد)
// دوال نقية قابلة للاختبار. متحقّق منها مقابل مسير مايو 2026 بالريال.

// سلم الرواتب الأساسية حسب المستوى
export const LEVELS={
  M1:{ar:"بايكر مبتدئ",salary:1000},
  M2:{ar:"بايكر ممارس",salary:1200},
  M3:{ar:"بايكر ممارس أول",salary:1400},
  M4:{ar:"بايكر ممارس متقدم",salary:1600},
  M5:{ar:"بايكر ممارس خبير",salary:1800},
};
export const SUPERVISOR_BASE=1500;
// المزايا العينية الشهرية (غير نقدية — جزء من الحزمة)
export const IN_KIND={housing:450,work_card:800,mobile:97,fuel:280,gosi:20,medical:50};
export const IN_KIND_TOTAL=Object.values(IN_KIND).reduce((a,b)=>a+b,0); // 1697

// ريال الجودة للبايكر حسب متوسط التقييم (0–1)
export function bikerQualityRiyal(rating){
  const r=Number(rating)||0;
  if(r<4.00)return 0;
  if(r<4.25)return 0.25;
  if(r<4.50)return 0.50;
  if(r<4.75)return 0.75;
  return 1.00;
}
// ريال السلامة للبايكر حسب نسبة الشكاوى المعتمدة (%) (0–1)
export function bikerSafetyRiyal(complaintPct){
  const c=Number(complaintPct)||0;
  if(c>3)return 0;
  if(c>=2)return 0.25;      // 2–3%
  if(c>=1.5)return 0.50;    // 1.5–1.99%
  if(c>=1)return 0.75;      // 1–1.49%
  return 1.00;              // <1%
}
// ريال جودة الفريق للمشرف (0–0.70)
export function teamQualityRiyal(rating){
  const r=Number(rating)||0;
  if(r<4.00)return 0;
  if(r<4.25)return 0.18;
  if(r<4.50)return 0.35;
  if(r<4.75)return 0.53;
  return 0.70;
}
// ريال سلامة الفريق للمشرف (0–0.65)
export function teamSafetyRiyal(complaintPct){
  const c=Number(complaintPct)||0;
  if(c>3)return 0;
  if(c>=2)return 0.16;
  if(c>=1.5)return 0.33;
  if(c>=1)return 0.49;
  return 0.65;
}
// مكافأة الإنتاج الشهري (v1.2) — تشترط تقييم ≥ 4.00
export function productionBonus(netWashes,rating){
  const w=Number(netWashes)||0;const r=Number(rating)||0;
  if(r<4.00)return 0;              // شرط غير قابل للتفاوض
  if(w>=260)return 100;
  if(w>=230)return 50;
  if(w>=200)return 25;
  return 0;
}

const round2=n=>Math.round((Number(n)||0)*100)/100;

// حساب كشف بايكر كامل
// input: {name,biker_id,level,net_washes,rating,complaint_pct,tips,quality_deduction,
//         deduct_damage,deduct_absence,deduct_materials,deduct_training}
export function computeBiker(inp){
  const level=LEVELS[inp.level]?inp.level:"M1";
  const base=LEVELS[level].salary;
  const washes=Number(inp.net_washes)||0;
  const qR=bikerQualityRiyal(inp.rating);
  const sR=bikerSafetyRiyal(inp.complaint_pct);
  const ratePerWash=round2(2+qR+sR);           // الحد الأدنى 2 — السقف 4
  const fixed=round2(washes*2);
  const quality=round2(washes*qR);
  const safety=round2(washes*sR);
  const bonusBase=round2(fixed+quality+safety); // = washes*ratePerWash
  const tips=round2(inp.tips);
  const production=productionBonus(washes,inp.rating);
  // الاستقطاعات الفعلية
  const dParts={
    quality_deduction:round2(inp.quality_deduction),
    damage:round2(inp.deduct_damage),
    absence:round2(inp.deduct_absence),
    materials:round2(inp.deduct_materials),
    training:round2(inp.deduct_training),
  };
  let deductions=round2(Object.values(dParts).reduce((a,b)=>a+b,0));
  // قاعدة السقف: لا تتجاوز الاستقطاعات 50% من الراتب الأساسي (ما عدا السرقة/الإتلاف المتعمد — تُدار يدوياً)
  const cap=round2(base*0.5);
  const capped=deductions>cap;
  if(capped)deductions=cap;
  const netBonus=round2(bonusBase+tips+production-deductions);
  const total=round2(base+netBonus);           // إجمالي الحزمة النقدية
  return{
    role:"biker",name:inp.name,biker_id:inp.biker_id,level,base,
    net_washes:washes,rating:Number(inp.rating)||0,complaint_pct:Number(inp.complaint_pct)||0,
    quality_riyal:qR,safety_riyal:sR,rate_per_wash:ratePerWash,
    fixed,quality,safety,bonus_base:bonusBase,tips,production,
    deduction_parts:dParts,deductions,deduction_capped:capped,deduction_cap:cap,
    net_bonus:netBonus,total,in_kind:IN_KIND_TOTAL,
  };
}

// حساب كشف المشرف
// input: {name,team_orders,team_rating,team_complaint_pct,deductions}
export function computeSupervisor(inp){
  const base=SUPERVISOR_BASE;
  const orders=Number(inp.team_orders)||0;
  const qR=teamQualityRiyal(inp.team_rating);
  const sR=teamSafetyRiyal(inp.team_complaint_pct);
  const ratePerOrder=round2(0.40+qR+sR);       // السقف 1.75
  const ordersRiyal=round2(orders*0.40);
  const quality=round2(orders*qR);
  const safety=round2(orders*sR);
  const variable=round2(ordersRiyal+quality+safety);
  const deductions=round2(inp.deductions);
  const netBonus=round2(variable-deductions);
  const total=round2(base+netBonus);
  return{
    role:"supervisor",name:inp.name,base,
    team_orders:orders,team_rating:Number(inp.team_rating)||0,team_complaint_pct:Number(inp.team_complaint_pct)||0,
    quality_riyal:qR,safety_riyal:sR,rate_per_order:ratePerOrder,
    orders_riyal:ordersRiyal,quality,safety,variable,
    deductions,net_bonus:netBonus,total,
  };
}

// نسبة الشكاوى من عدد الشكاوى المعتمدة والغسلات
export function complaintPct(approved,washes){
  const w=Number(washes)||0;if(!w)return 0;
  return round2((Number(approved)||0)/w*100);
}

// ملخص المسير الشهري
export function summarize(lines){
  const base=round2(lines.reduce((a,l)=>a+(l.base||0),0));
  const netBonus=round2(lines.reduce((a,l)=>a+(l.net_bonus||0),0));
  const total=round2(lines.reduce((a,l)=>a+(l.total||0),0));
  const tips=round2(lines.reduce((a,l)=>a+(l.tips||0),0));
  const production=round2(lines.reduce((a,l)=>a+(l.production||0),0));
  const deductions=round2(lines.reduce((a,l)=>a+(l.deductions||0),0));
  return{count:lines.length,base,net_bonus:netBonus,total,tips,production,deductions};
}
