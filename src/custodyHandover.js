// «تسليم عهدة» في صفحة سلاسل الإمداد ← custody_assets (المرجع الوحيد للعهد — docs/design/custody_unify_plan.md). دوال نقية بلا DOM ولا Supabase.
// القائمة القياسية (قرار المالك 2026-10-14) = الأصناف الـ20 المسلّمة فعلاً لميدول ورقيب: كل الكتالوج عدا «الجوال» (يُسجَّل من صفحة العهد مع IMEI)
// و«خزان الماء» (غير مسلَّم حالياً). البداية = تاريخ التسليم الفعلي (يحدّد الإهلاك).
// من custodyLifecycle (لا custodyCatalog مباشرة) ومع استعمال isLive منه: يبقى الكتالوج داخل حزمة custodyLifecycle ولا تكبر الرئيسية
import{CATALOG,catalogByKey,catalogOfAsset,isLive,addMonths}from"./custodyLifecycle";

export const KIT_KEYS=CATALOG.map(c=>c.key).filter(k=>k!=="phone"&&k!=="watertank");
// الأصناف المتاحة للتسليم المفرد: كل الكتالوج عدا الجوال (يحتاج IMEI ⇒ صفحة العهد)
export const SINGLE_KEYS=CATALOG.map(c=>c.key).filter(k=>k!=="phone");

// خطأ النموذج ⇒ نص عربي أو null · f: {employee, keys, date} · today: YYYY-MM-DD
export function handoverError(f={},today=""){
  if(!f.employee||!f.employee.id)return"اختر البايكر.";
  if(!f.keys||!f.keys.length)return"اختر صنفاً واحداً على الأقل.";
  if(f.keys.some(k=>!catalogByKey(k)||k==="phone"))return"الجوال يُسجَّل من صفحة «العُهد والإهلاك» مع IMEI.";
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(f.date||"")))return"تاريخ التسليم إلزامي.";
  if(today&&f.date>today)return"تاريخ التسليم لا يكون في المستقبل.";
  return null;
}

// خطة التسليم ⇒ {inserts, activate, skipped}
//   inserts: صفوف custody_assets جديدة (نشطة من تاريخ التسليم بعمر الكتالوج)
//   activate: قطع «ناقصة» للصنف نفسه تُفعَّل بدل إنشاء صف ثانٍ ⇒ [{id, patch}]
//   skipped: أصناف مسجّلة للبايكر (نشطة/مستحقة) لا تتكرّر
// ctx: {employee:{id, full_name, employee_id}, operator_id, date}
export function handoverPlan(keys=[],existing=[],ctx={}){
  const emp=ctx.employee||{},date=ctx.date;
  const mine=(existing||[]).filter(a=>a&&a.employee_id===emp.id&&isLive(a));
  const byKey=k=>mine.filter(a=>(catalogOfAsset(a)||{}).key===k);
  const inserts=[],activate=[],skipped=[];
  [...new Set(keys)].forEach(k=>{const c=catalogByKey(k);if(!c)return;
    const have=byKey(k);
    if(have.some(a=>a.status!=="missing")){skipped.push(k);return;}
    const end=addMonths(date,c.life),note=`تسليم عهدة ${date}`;
    const miss=have.find(a=>a.status==="missing");
    if(miss){activate.push({id:miss.id,patch:{status:"active",start_date:date,end_date:end,life_months:c.life,lead_days:c.lead,notes:(miss.notes?miss.notes+" · ":"")+`سُلّمت ${date}`}});return;}
    inserts.push({operator_id:ctx.operator_id??null,employee_id:emp.id,biker_name:emp.full_name||"",sweater_id:emp.employee_id||null,
      item_type:c.type,category:c.category,name:c.name,name_en:c.en,start_date:date,life_months:c.life,end_date:end,lead_days:c.lead,
      status:"active",source:"handover",notes:note});
  });
  return{inserts,activate,skipped};
}
