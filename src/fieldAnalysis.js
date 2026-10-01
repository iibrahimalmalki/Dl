// تحليل ذكي للجولة الميدانية — يقرأ الجولة الحالية وتاريخ البايكر وينتج تحليلاً منظّماً.
// محلّل قواعدي على مستوى المنصّة (deterministic) — لا يعتمد على خدمة خارجية.
import{ITEMS,AXES,bikerItems,mgmtItems,complianceByAxis,effect,supplyReadiness}from"./fieldChecklist";

const item=n=>ITEMS.find(i=>i.n===Number(n));
const addDays=(iso,d)=>{const t=new Date(iso).getTime();if(isNaN(t))return"";return new Date(t+d*864e5).toISOString().slice(0,10);};

// round: {results,item_notes,compliance_pct,round_date,biker_name,sweater_id,action_items}
// history: جولات سابقة لنفس البايكر [{results,compliance_pct,round_date}] الأحدث أولاً
export function analyzeRound(round,history=[]){
  const results=round.results||{};
  const pct=round.compliance_pct;
  const eff=effect(pct);
  const byAxis=complianceByAxis(results);

  // نقاط القوة والضعف (بنود البايكر)
  const passed=bikerItems.filter(i=>results[i.n]==="pass");
  const weak=bikerItems.filter(i=>results[i.n]==="fail"||results[i.n]==="half");
  const excused=bikerItems.filter(i=>results[i.n]==="excused");

  // الاتجاه مقابل آخر جولة سابقة
  const prev=history.find(h=>h.round_date&&h.round_date!==round.round_date&&h.compliance_pct!=null);
  let trend={dir:"flat",delta:0,text:"لا توجد جولة سابقة للمقارنة."};
  if(prev&&pct!=null){
    const d=Math.round((pct-Number(prev.compliance_pct))*10)/10;
    trend={dir:d>1?"up":d<-1?"down":"flat",delta:d,
      text:d>1?`تحسّن الأداء بمقدار ${d}% مقارنةً بجولة ${prev.round_date} (${prev.compliance_pct}%).`
        :d<-1?`تراجع الأداء بمقدار ${Math.abs(d)}% مقارنةً بجولة ${prev.round_date} (${prev.compliance_pct}%) — يتطلب متابعة.`
        :`الأداء مستقر مقارنةً بجولة ${prev.round_date}.`};
  }

  // المشكلات المتكررة: بند فاشل حالياً وفي آخر جولة سابقة
  const prevFail=new Set(prev?Object.entries(prev.results||{}).filter(([,v])=>v==="fail").map(([k])=>Number(k)):[]);
  const recurring=weak.filter(i=>prevFail.has(i.n));

  // ملاحظات المحاور
  const axes=Object.keys(AXES).map(ax=>{
    const a=byAxis[ax];const fails=bikerItems.filter(i=>i.axis===ax&&(results[i.n]==="fail"||results[i.n]==="half"));
    return{ax,ar:AXES[ax].ar,pct:a.pct,denom:a.denom,
      text:a.pct==null?"لم يُقيَّم":a.pct>=80?"ممتاز":fails.length?`يحتاج معالجة: ${fails.map(f=>"#"+f.n).join("، ")}`:"جيد"};
  });
  const weakestAxis=axes.filter(a=>a.pct!=null).sort((x,y)=>x.pct-y.pct)[0];

  // الأولويات التصحيحية (بنود البايكر الفاشلة) + مهلة 7 أيام
  const deadline=addDays(round.round_date||new Date().toISOString().slice(0,10),7);
  const priorities=weak.map(i=>({n:i.n,ar:i.ar,level:results[i.n]==="fail"?"غير مطابق":"جزئي",deadline}));

  // تغطية التوثيق
  const needPhotos=bikerItems.filter(i=>(i.photos||[]).length>0);
  const photoNote=`التوثيق المصوّر مطلوب في ${needPhotos.length} بنداً من بنود البايكر — يُرفق مع التقرير كدليل معتمد.`;

  // طلب مركز دعم سويتر: بنود الإدارة الفاشلة + بنود البايكر المعفاة (إمداد لم يُستلم)
  const notes=round.item_notes||{};
  const mgmtFail=mgmtItems.filter(i=>results[i.n]==="fail");
  const supplyGaps=[
    ...mgmtFail.map(i=>({n:i.n,ar:i.ar,reason:"غير متوفّر/ناقص أثناء الجولة"})),
    ...excused.map(i=>({n:i.n,ar:i.ar,reason:notes[i.n]?("إعفاء إمداد: "+notes[i.n]):"إعفاء إمداد — لم يُستلم من الإدارة"})),
  ];
  const supportRequest=buildSupportRequest(round,supplyGaps);


  // ── السبب الجذري والتوصية (قاعدي): تجميع البنود الضعيفة حسب الموضوع ──
  const THEMES=[
    {key:"clean",items:[1,2,3,8],ar:"غياب روتين نظافة الدراجة والصندوق والزي",rec:"مسح الدراجة والصندوق 10 دقائق نهاية كل وردية + غسلة أسبوعية يوم الجمعة، ويتحقق المشرف بصورتين (أمام/الصندوق)."},
    {key:"safety",items:[5,6],ar:"إهمال فحص السلامة اليومي (الإنارة وسلامة الهيكل)",rec:"فحص إنارة وهيكل يومي قبل الانطلاق مع إبلاغ الصيانة فوراً عند أي عطل."},
    {key:"towels",items:[11],ar:"ضعف معرفة نظام المناشف",rec:"إعادة شرح ألوان المناشف من دليل أدوات البايكر + اختبار قصير بإشراف مدير العمليات."},
    {key:"wash",items:[13,14],ar:"عدم الالتزام بتسلسل الغسيل أو التخلص من المخلفات",rec:"مرافقة المشرف في غسلتين مع التركيز على التسلسل والكيس."},
  ];
  const weakSet=new Set(weak.map(i=>i.n));
  const themeHits=THEMES.map(t=>({...t,hit:t.items.filter(n=>weakSet.has(n))})).filter(t=>t.hit.length).sort((a,b)=>b.hit.length-a.hit.length);
  const rootCause=themeHits.length?`${themeHits[0].ar} (البنود ${themeHits[0].hit.map(n=>"#"+n).join("، ")}).`:(weak.length?"":"لا توجد مخالفات على البايكر في هذه الجولة.");
  const recommendation=themeHits.length?themeHits[0].rec:"";
  const supply=supplyReadiness(results);

  // إجراءات الجولة السابقة: ماذا حدث لكل بند كان فاشلاً/جزئياً في آخر جولة؟
  const prevActions=prev?Object.entries(prev.results||{}).filter(([,v])=>v==="fail"||v==="half").map(([k])=>{
    const n=Number(k);const it=item(n);const now=results[n];
    const status=now==="pass"?"closed":now==null?"unknown":(now==="fail"||now==="half")?"recurring":"open";
    return{n,ar:it?it.ar:"#"+n,resp:it?it.resp:"biker",prev:prev.results[k],now:now||null,status};
  }):[];

  // الملخص العام
  const summary=`سجّل البايكر ${round.biker_name||""} التزاماً بنسبة ${pct!=null?pct+"%":"—"} (${eff.ar}).`
    +(passed.length?` نقاط القوة تشمل ${passed.length} بنداً مطابقاً.`:"")
    +(weak.length?` يوجد ${weak.length} بند يحتاج تحسيناً${weakestAxis?`، وأضعف المحاور هو «${weakestAxis.ar}» (${weakestAxis.pct}%).`:"."}`:" جميع بنود البايكر مطابقة.")
    +(recurring.length?` ⚠ تكرار في: ${recurring.map(i=>"#"+i.n).join("، ")} — يستدعي مراجعة تدريبية.`:"")
    +(supplyGaps.length?` كما يوجد ${supplyGaps.length} نقص إمداد على مسؤولية سويتر/الإدارة تم تحويلها لطلب دعم.`:"");

  return{generated_at:new Date().toISOString(),compliance:pct,effect:eff,summary,trend,axes,weakestAxis,
    strengths:passed.map(i=>({n:i.n,ar:i.ar})),weaknesses:weak.map(i=>({n:i.n,ar:i.ar,level:results[i.n]})),
    recurring:recurring.map(i=>({n:i.n,ar:i.ar})),priorities,photoNote,supplyGaps,supportRequest,
    rootCause,recommendation,supply:{pct:supply.pct,denom:supply.denom,points:supply.points,missing:supply.missing},prevActions};
}

export function buildSupportRequest(round,supplyGaps){
  if(!supplyGaps||!supplyGaps.length)return{items:[],text:""};
  const lines=supplyGaps.map((g,i)=>`${i+1}) بند #${g.n}: ${g.ar} — ${g.reason}`).join("\n");
  const text=`طلب إلى مركز دعم سويتر (SSP) — إمداد ومعدات\n`
    +`المشغّل: دلو ورغوة · Partner ID 47\n`
    +`البايكر: ${round.biker_name||"—"} (#${round.sweater_id||"—"})\n`
    +`تاريخ الجولة: ${round.round_date||"—"}\n\n`
    +`النواقص المرصودة (مسؤولية الإمداد على سويتر/الإدارة):\n${lines}\n\n`
    +`المطلوب: تسليم/استبدال العناصر أعلاه وتحديد موعد، مع إعفاء البايكر من أي أثر مالي على هذه البنود وفق POL-QUA-001 (9.4).`;
  return{items:supplyGaps,text};
}
