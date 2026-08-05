// نموذج المواهب TMA — الكتالوج المرجعي + محرّك التقييم
// 6 فئات · 22 محركاً · 44 موهبة (موهبتان متقابلتان لكل محرك).
// المصدر: mytalents.me/ar/المواهب — استخراج 31 يوليو 2026.
// مقصور على المالك: لا يُربط بالرواتب أو الشكاوى، ولا يُمنح كصلاحية.

// كل محرك: a = الطرف المرتفع (درجة عالية)، b = الطرف المنخفض (درجة منخفضة).
// مقياس التقييم لكل محرك 1..9 (Stanine): 5 متوازن، ≥6 يميل إلى a، ≤4 يميل إلى b.

export const CATS=[
  {k:"emo", ar:"التوازن العاطفي",  ic:"star",        drives:["stress","esteem"]},
  {k:"soc", ar:"المواهب الاجتماعية", ic:"users",     drives:["respect","help","openness","empathy","socialize","support","status"]},
  {k:"infl",ar:"المواهب المؤثرة",   ic:"target",      drives:["dominance","confront"]},
  {k:"motv",ar:"المحفّزات",         ic:"chart",       drives:["energy","ambition","persist","variety","goal"]},
  {k:"lead",ar:"المواهب القيادية",  ic:"performance", drives:["responsibility","conformity"]},
  {k:"org", ar:"المواهب التنظيمية", ic:"ruler",       drives:["order","pragma","independent","decisive"]},
];

export const DRIVES=[
  {k:"stress",cat:"emo",ar:"إدارة التوتر والضغط النفسي",
    a:{n:"متوازن",d:"مستقر جدًا، غير مبالٍ أحيانًا، يتوقّع المشاكل."},
    b:{n:"مشارِك",d:"يحتاج الطمأنينة والهدوء، ملتزم."}},
  {k:"esteem",cat:"emo",ar:"تقدير الذات",
    a:{n:"واثق",d:"واثق، واثق بإفراط أحيانًا، متفائل؛ مستقر ذهنيًا، يتحمّل الانفعالات، مرن، نادرًا ما يعيقه الخوف من الفشل."},
    b:{n:"متأمّل",d:"يتجنّب الأخطاء؛ يفتقر لثقة قوية بالنفس، حساس للانتقاد، يميل للقلق حول الأخطاء المحتملة، قد يبدو مترددًا."}},

  {k:"respect",cat:"soc",ar:"الاحترام",
    a:{n:"محترِم",d:"يحترم الآخرين، إحساس بالتسلسل الهرمي."},
    b:{n:"المساواة",d:"يكافح من أجل المساواة، يواجه رؤساءه."}},
  {k:"help",cat:"soc",ar:"الاستعداد للمساعدة",
    a:{n:"خدماتي",d:"لطيف، مجامِل، خيّر، يحب التيسير."},
    b:{n:"متّزن",d:"يلتزم بالمسألة، يتوقّع من الناس تحمّل مسؤوليتهم."}},
  {k:"openness",cat:"soc",ar:"الانفتاح",
    a:{n:"يقاوم",d:"معبّر، بارز، متفائل، ذو حضور ملحوظ."},
    b:{n:"يدع",d:"غير بارز، يفضّل البقاء في الخلف."}},
  {k:"empathy",cat:"soc",ar:"التعاطف الاجتماعي",
    a:{n:"عاطفي",d:"عاطفي فطري، دبلوماسي جدًا."},
    b:{n:"واقعي",d:"صريح وعملي، يستجيب للسلوك الظاهر."}},
  {k:"socialize",cat:"soc",ar:"المخالطة الاجتماعية والتواصل",
    a:{n:"اندماجي",d:"اجتماعي جدًا، ودود، متوجّه نحو الفريق."},
    b:{n:"فردي",d:"فردي، يحب العزلة، عملي في التواصل."}},
  {k:"support",cat:"soc",ar:"الحاجة للدعم",
    a:{n:"شكور",d:"يشكر من يساعده، يحتاج للفهم."},
    b:{n:"مقتدِر",d:"مستقل، يبدو قاسيًا، يحتاج قليلًا للدعم."}},
  {k:"status",cat:"soc",ar:"الحاجة للمكانة",
    a:{n:"أنيق",d:"أنيق، حساس للإطراء والمكانة."},
    b:{n:"متواضع",d:"متواضع، يولي قيمة ضئيلة للمكانة."}},

  {k:"dominance",cat:"infl",ar:"الهيمنة",
    a:{n:"قيادي",d:"قيادي، مهيمن، مقنِع."},
    b:{n:"متعاون",d:"يؤثّر على الآخرين بطريقة حاذقة."}},
  {k:"confront",cat:"infl",ar:"المواجهة",
    a:{n:"حازم",d:"صدامي، جازم، يصون الحدود."},
    b:{n:"متسامح",d:"متسامح، أقل توكيدًا، لا ينزعج."}},

  {k:"energy",cat:"motv",ar:"الطاقة والعمل",
    a:{n:"مغامر",d:"قليل الصبر، ممتلئ بروح المبادرة."},
    b:{n:"صبور",d:"راحة البال، هادئ، يبقى محايدًا."}},
  {k:"ambition",cat:"motv",ar:"الطموح والتحديات",
    a:{n:"منجِز",d:"طموح جدًا، تنافسي، يتمتّع بدافع قوي."},
    b:{n:"قنوع",d:"راضٍ، وسطي، لديه منظور."}},
  {k:"persist",cat:"motv",ar:"المثابرة",
    a:{n:"مثابر",d:"عنيد، يحب متابعة العمل."},
    b:{n:"مرن",d:"يتحرّر بسهولة، يميل لتغيير الأولويات."}},
  {k:"variety",cat:"motv",ar:"التنوّع",
    a:{n:"متنوّع",d:"الحاجة لنشر الاهتمام، الفضول."},
    b:{n:"يركّز",d:"لديه تركيز شديد، حاجة ضئيلة للتنوّع."}},
  {k:"goal",cat:"motv",ar:"التوجّه نحو الهدف",
    a:{n:"هادف",d:"موجّه نحو الأهداف والنتائج."},
    b:{n:"إجرائي",d:"موجّه نحو الإجراءات والعمليات."}},

  {k:"responsibility",cat:"lead",ar:"المسؤولية والقيادة",
    a:{n:"قيادي",d:"يحب أن يتحمّل المسؤولية، يبادر."},
    b:{n:"مذعن",d:"مطيع بالعادة، ليّن، يقبل القرارات."}},
  {k:"conformity",cat:"lead",ar:"المطابقة",
    a:{n:"مطيع",d:"يتقيّد بالقواعد وأطر العمل."},
    b:{n:"سبّاق",d:"مستقل عن القواعد وغير رسمي."}},

  {k:"order",cat:"org",ar:"الترتيب والبنية",
    a:{n:"دقيق",d:"منظّم جيدًا، دقيق، مرتّب، منهجي."},
    b:{n:"مبدع",d:"يركّز على الصورة الأكبر، إبداعي."}},
  {k:"pragma",cat:"org",ar:"البراغماتية",
    a:{n:"عملي",d:"عملي جدًا، يركّز على النفع، فعّال."},
    b:{n:"تجريدي",d:"نظري، حساس للرموز والطقوس."}},
  {k:"independent",cat:"org",ar:"التفكير والعمل المستقل",
    a:{n:"مستقل",d:"تفكير حر، مستقل ذاتيًا."},
    b:{n:"جماعي",d:"موجّه نحو الفريق، مرتبط بالكلية."}},
  {k:"decisive",cat:"org",ar:"الحسم",
    a:{n:"حكيم",d:"يقرّر بسرعة ويتقيّد بالقرارات."},
    b:{n:"متّزن",d:"يتشاور ويفكّر، أحيانًا غير حاسم."}},
];

export const DRIVE_BY_KEY=Object.fromEntries(DRIVES.map(d=>[d.k,d]));
export const CAT_BY_KEY=Object.fromEntries(CATS.map(c=>[c.k,c]));
export const TOTAL_DRIVES=DRIVES.length;   // 22
export const TOTAL_TALENTS=DRIVES.length*2; // 44

// تفسير درجة محرك واحد (1..9)
export function interpret(score){
  const s=Number(score);
  if(!s) return{side:null,label:"غير مقيّم",lean:0};
  if(s>=8) return{side:"a",label:"مرتفع جدًا",lean:2};
  if(s>=6) return{side:"a",label:"مرتفع",lean:1};
  if(s<=2) return{side:"b",label:"منخفض جدًا",lean:2};
  if(s<=4) return{side:"b",label:"منخفض",lean:1};
  return{side:null,label:"متوازن",lean:0};
}

// الموهبة الظاهرة لمحرك بحسب الدرجة
export function talentOf(driveKey,score){
  const d=DRIVE_BY_KEY[driveKey]; if(!d) return null;
  const it=interpret(score);
  if(it.side==="a") return{...d.a,side:"a",strength:it.lean,drive:d};
  if(it.side==="b") return{...d.b,side:"b",strength:it.lean,drive:d};
  return null;
}

// اكتمال التقييم
export function completeness(scores){
  const done=DRIVES.filter(d=>Number(scores&&scores[d.k])>0).length;
  return{done,total:TOTAL_DRIVES,pct:Math.round(done/TOTAL_DRIVES*100)};
}

// أبرز المواهب (الأبعد عن المنتصف) لملخص سريع
export function topTalents(scores,n=6){
  const arr=DRIVES.map(d=>{
    const s=Number(scores&&scores[d.k])||0;
    const dist=s?Math.abs(s-5):-1;
    return{drive:d,score:s,dist,talent:talentOf(d.k,s)};
  }).filter(x=>x.talent).sort((a,b)=>b.dist-a.dist);
  return arr.slice(0,n);
}

// ملخص لكل فئة: متوسط الميل
export function categorySummary(scores){
  return CATS.map(c=>{
    const ds=c.drives.map(k=>Number(scores&&scores[k])||0).filter(Boolean);
    const avg=ds.length?ds.reduce((a,b)=>a+b,0)/ds.length:0;
    return{cat:c,rated:ds.length,total:c.drives.length,avg:Math.round(avg*10)/10};
  });
}
