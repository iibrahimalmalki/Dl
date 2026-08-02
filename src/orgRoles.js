// خريطة المناصب ← الصلاحيات (وفق الهيكل التنظيمي)
// تُطبَّق آلياً عند تعيين شخص في منصب. المالك له كل شيء دائماً.
// قاعدة أمان صارمة: لا يُمنح أبداً منصبٌ صلاحية «المواهب TMA» ولا «المستخدمون» — مقصورتان على المالك.

export const OWNER_ONLY=["tma","users"];

export const MODULE_LABELS={
  dashboard:"لوحة القيادة",recruitment:"المتقدّمون",interviews:"المقابلات",sourcing:"معايير الاستقطاب",
  onboarding:"التعاقد والإعداد",operations:"العمليات اليومية",performance:"الأداء",payroll:"الرواتب",
  complaints:"الشكاوى",field_rounds:"الجولات الميدانية",org:"الهيكل التنظيمي",employees:"الموظفون",
  vendors:"الموردون",reports:"التقارير",renewals:"الوثائق",
};

// v = عرض فقط · ve = عرض + تعديل
export const POSITIONS=[
  {k:"sec_ops",  ar:"مدير العمليات",            sector:"ops",  level:"مدير قطاع", parent:null,
    perms:{dashboard:"v",operations:"ve",performance:"ve",field_rounds:"ve",complaints:"ve",onboarding:"ve",recruitment:"v",interviews:"v",sourcing:"v",employees:"v",reports:"v",org:"v"}},
  {k:"sec_strat",ar:"مدير الاستراتيجية والتطوير",sector:"strat",level:"مدير قطاع", parent:null,
    perms:{dashboard:"v",complaints:"ve",performance:"v",operations:"v",reports:"ve",sourcing:"v",org:"v"}},
  {k:"sec_sup",  ar:"مدير الخدمات المساندة",     sector:"sup",  level:"مدير قطاع", parent:null,
    perms:{dashboard:"v",employees:"ve",payroll:"ve",onboarding:"v",vendors:"ve",reports:"v",org:"v"}},

  {k:"ops1",ar:"مدير التشغيل الميداني",   sector:"ops",level:"مدير إدارة",parent:"sec_ops",
    perms:{dashboard:"v",operations:"ve",performance:"ve",field_rounds:"ve",complaints:"v",employees:"v"}},
  {k:"field_sup",ar:"المشرف الميداني",    sector:"ops",level:"إشراف",   parent:"ops1",
    perms:{dashboard:"v",operations:"ve",performance:"ve",field_rounds:"ve",complaints:"v"}},
  {k:"team_leader",ar:"قائد فريق",        sector:"ops",level:"قيادة فريق",parent:"field_sup",
    perms:{dashboard:"v",operations:"v",field_rounds:"v"}},
  {k:"ops2",ar:"مدير الاستقطاب والتأهيل", sector:"ops",level:"مدير إدارة",parent:"sec_ops",
    perms:{dashboard:"v",recruitment:"ve",interviews:"ve",onboarding:"ve",sourcing:"v"}},
  {k:"ops3",ar:"مدير خدمات التمكين B2B",  sector:"ops",level:"مدير إدارة",parent:"sec_ops",
    perms:{dashboard:"v",operations:"v",onboarding:"v",reports:"v"}},

  {k:"st1",ar:"مدير الجودة وعلاقة سويتر",  sector:"strat",level:"مدير إدارة",parent:"sec_strat",
    perms:{dashboard:"v",complaints:"ve",performance:"ve",operations:"v",field_rounds:"v",reports:"v"}},
  {k:"st2",ar:"مدير الشراكات والتوسع",     sector:"strat",level:"مدير إدارة",parent:"sec_strat",
    perms:{dashboard:"v",reports:"v",sourcing:"v"}},
  {k:"st3",ar:"مدير التخطيط والتطوير",     sector:"strat",level:"مدير إدارة",parent:"sec_strat",
    perms:{dashboard:"v",reports:"ve",org:"v"}},

  {k:"su1",ar:"مدير الموارد البشرية",      sector:"sup",level:"مدير إدارة",parent:"sec_sup",
    perms:{dashboard:"v",employees:"ve",payroll:"ve",onboarding:"v",recruitment:"v",reports:"v"}},
  {k:"su2",ar:"مدير الدعم اللوجستي",       sector:"sup",level:"مدير إدارة",parent:"sec_sup",
    perms:{dashboard:"v",vendors:"ve",operations:"v",employees:"v"}},
  {k:"su3",ar:"مدير المالية والإدارة",     sector:"sup",level:"مدير إدارة",parent:"sec_sup",
    perms:{dashboard:"v",payroll:"v",reports:"ve",operations:"v"}},
];

export const POS_BY_KEY=Object.fromEntries(POSITIONS.map(p=>[p.k,p]));

// المناصب التي يمكن أن تكون «مشرفاً على فرق»
export const SUPERVISOR_POSITIONS=["sec_ops","ops1","field_sup"];

// حدود توزيع الفرق
export const TEAM_MAX_MEMBERS=7;   // كل 7 بايكرز → فريق
export const SUP_MAX_TEAMS=3;      // المشرف الواحد ≤ 3 فرق (21 بايكراً)

// صفوف user_permissions لمنصب معيّن (مع استبعاد المقصور على المالك احترازياً)
export function permsRows(posKey){
  const p=POS_BY_KEY[posKey]; if(!p) return [];
  return Object.entries(p.perms)
    .filter(([m])=>!OWNER_ONLY.includes(m))
    .map(([m,lvl])=>({module:m,can_view:true,can_edit:lvl==="ve",raci:lvl==="ve"?"R":"I"}));
}

// قائمة الوحدات الممنوحة (للعرض)
export function grantedModules(posKey){
  const p=POS_BY_KEY[posKey]; if(!p) return [];
  return Object.entries(p.perms).filter(([m])=>!OWNER_ONLY.includes(m))
    .map(([m,lvl])=>({module:m,label:MODULE_LABELS[m]||m,edit:lvl==="ve"}));
}
