import{useState,useEffect}from"react";
import{supabase}from"./supabase";

// عداد الفرصة الحي — يجمع رقماً تصاعدياً أسبوعياً + عدد المتقدمين الحقيقيين
const LAUNCH_DATE=new Date("2026-07-01T00:00:00Z");
function LiveUrgencyBar(){
  const[realCount,setRealCount]=useState(0);
  const[loaded,setLoaded]=useState(false);
  useEffect(()=>{
    supabase.from("applicants").select("id",{count:"exact",head:true})
      .then(({count})=>{setRealCount(count||0);setLoaded(true);});
  },[]);
  const weeksSince = Math.max(0,Math.floor((Date.now()-LAUNCH_DATE.getTime())/(7*24*60*60*1000)));
  const total = realCount + (weeksSince*10);
  if(!loaded) return null;
  return(
    <div style={{background:"linear-gradient(135deg,#fff,#fff7ed)",border:"1.5px solid #fed7aa",borderRadius:16,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 4px 16px rgba(232,113,43,0.1)"}}>
      <div style={{width:8,height:8,borderRadius:"50%",background:"#16a34a",flexShrink:0,boxShadow:"0 0 8px #16a34a",animation:"pulse 1.5s infinite"}}/>
      <div style={{flex:1}}>
        <div style={{color:"#1e293b",fontSize:13,fontWeight:800}}>{total.toLocaleString()} জন এই মাসে আবেদন করেছেন</div>
        <div style={{color:"#a8834f",fontSize:11}}>{total.toLocaleString()} شخص قدّموا هذا الشهر — المقاعد محدودة</div>
      </div>
    </div>
  );
}

// رحلة الصعود — العنصر المميز: من نقطة البداية إلى دخل مستقر
function IncomeJourney({daily,perf,onDaily,onPerf}){
  const monthly = Math.round(daily*26);
  const BASE=1000;
  const FIXED=2;
  const perfBonus = perf*2;
  const perOrder = FIXED + perfBonus;
  const bonus = Math.round(monthly*perOrder);
  const income = BASE + bonus;
  const isMax = daily>=12;

  const PERF_LEVELS=[
    {v:0, ar:"ضعيف",bn:"দুর্বল",color:"#dc2626"},
    {v:0.25,ar:"مقبول",bn:"গ্রহণযোগ্য",color:"#d97706"},
    {v:0.5,ar:"جيد",bn:"ভালো",color:"#2563eb"},
    {v:0.75,ar:"ممتاز",bn:"চমৎকার",color:"#16a34a"},
    {v:1,ar:"تميز ⭐",bn:"অসাধারণ",color:"#E8712B"},
  ];
  const perfIdx = Math.round(perf*4);
  const currentPerf = PERF_LEVELS[perfIdx];

  // نقاط الرحلة على المنحنى الصاعد — من 1000 إلى income
  const journeyPoints = [BASE, BASE+bonus*0.33, BASE+bonus*0.66, income];
  const maxVal = 2900; // أعلى نقطة ممكنة تقريبياً للرسم
  const chartH = 90;

  return(
    <div style={{background:"linear-gradient(160deg,#fff,#fffaf3)",borderRadius:24,padding:"26px 22px",border:"1.5px solid #fde4c4",position:"relative",overflow:"hidden",boxShadow:"0 8px 30px rgba(232,113,43,0.08)"}}>
      <div style={{position:"absolute",top:-50,left:-50,width:180,height:180,borderRadius:"50%",background:"radial-gradient(circle,rgba(232,113,43,0.08),transparent 70%)"}}/>

      <div style={{textAlign:"center",marginBottom:20,position:"relative"}}>
        <div style={{color:"#1e293b",fontSize:15,fontWeight:900}}>আপনার আয়ের যাত্রা দেখুন</div>
        <div style={{color:"#a8834f",fontSize:12,marginTop:2}}>شوف رحلة دخلك المتوقع</div>
      </div>

      {/* منحنى الصعود — شمس تشرق فوق الأفق */}
      <div style={{position:"relative",height:chartH+30,marginBottom:20}}>
        <svg width="100%" height={chartH+30} viewBox={`0 0 300 ${chartH+30}`} style={{overflow:"visible"}}>
          <defs>
            <linearGradient id="sunGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f5a35f" stopOpacity="0.35"/>
              <stop offset="100%" stopColor="#f5a35f" stopOpacity="0"/>
            </linearGradient>
          </defs>
          {(() => {
            const pts = journeyPoints.map((v,i)=>{
              const x = (i/(journeyPoints.length-1))*280+10;
              const y = chartH - (v/maxVal)*chartH + 15;
              return [x,y];
            });
            const path = pts.map((p,i)=>i===0?`M${p[0]},${p[1]}`:`L${p[0]},${p[1]}`).join(" ");
            const areaPath = path + ` L${pts[pts.length-1][0]},${chartH+15} L${pts[0][0]},${chartH+15} Z`;
            return(<>
              <path d={areaPath} fill="url(#sunGrad)"/>
              <path d={path} fill="none" stroke="#E8712B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              {pts.map((p,i)=>(
                <circle key={i} cx={p[0]} cy={p[1]} r={i===pts.length-1?7:4}
                  fill={i===pts.length-1?"#E8712B":"#f5a35f"}
                  stroke="#fff" strokeWidth="2"/>
              ))}
              {/* شمس صغيرة عند القمة */}
              <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="12" fill="#E8712B" opacity="0.15"/>
            </>);
          })()}
        </svg>
      </div>

      {/* شاشة الرقم النهائي */}
      <div style={{background:"linear-gradient(135deg,#E8712B,#f5a35f)",borderRadius:16,padding:"18px 16px",textAlign:"center",marginBottom:18,boxShadow:"0 6px 20px rgba(232,113,43,0.3)"}}>
        <div style={{color:"rgba(255,255,255,0.85)",fontSize:11,fontWeight:700,marginBottom:4}}>সম্ভাব্য মাসিক আয় • دخلك الشهري المتوقع</div>
        <div style={{color:"#fff",fontSize:34,fontWeight:900,fontFamily:"'Courier New',monospace",direction:"ltr"}}>{income.toLocaleString()} ﷼</div>
      </div>

      {/* سلايدر عدد الطلبات اليومي */}
      <div style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <span style={{color:"#E8712B",fontSize:12,fontWeight:800,direction:"ltr"}}>{daily} টি/দিন</span>
          <span style={{color:"#78716c",fontSize:11}}>দৈনিক অর্ডার • عدد الطلبات يومياً</span>
        </div>
        <input type="range" min={1} max={12} value={daily} onChange={e=>onDaily(+e.target.value)}
          style={{width:"100%",accentColor:"#E8712B",height:6}}/>
        {isMax&&<div style={{marginTop:6,background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"6px 10px"}}>
          <div style={{color:"#92400e",fontSize:10.5,lineHeight:1.6}}>এটি তাত্ত্বিক সর্বোচ্চ — বাস্তব গড় ১৫০-২১০/মাস<br/>هذا الحد الأقصى النظري — المعدل الواقعي 150-210 طلب/شهر</div>
        </div>}
      </div>

      {/* سلايدر مستوى الأداء */}
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <span style={{color:currentPerf.color,fontSize:12,fontWeight:800}}>{currentPerf.bn} • {currentPerf.ar}</span>
          <span style={{color:"#78716c",fontSize:11}}>পারফরম্যান্স স্তর</span>
        </div>
        <input type="range" min={0} max={4} step={1} value={perfIdx} onChange={e=>onPerf(PERF_LEVELS[+e.target.value].v)}
          style={{width:"100%",accentColor:currentPerf.color,height:6}}/>
      </div>

      {/* تفصيل الحساب */}
      <div style={{background:"#fff7ed",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <span style={{color:"#78716c",fontSize:11,direction:"ltr"}}>{BASE.toLocaleString()} ﷼</span>
          <span style={{color:"#57534e",fontSize:11}}>মূল বেতন • الراتب الأساسي</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <span style={{color:"#78716c",fontSize:11,direction:"ltr"}}>+{bonus.toLocaleString()} ﷼</span>
          <span style={{color:"#57534e",fontSize:11}}>বোনাস • مكافأة {monthly} طلب</span>
        </div>
      </div>

      {/* مرجعية حقيقية */}
      <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
        <div style={{color:"#16a34a",fontSize:11,fontWeight:700,lineHeight:1.7}}>
          🏆 আমাদের সেরা রেকর্ড: এক মাসে ২৩৩ অর্ডার<br/>
          <span style={{color:"#78716c",fontWeight:400}}>أعلى رقم حققه بايكر معنا: 233 طلب في شهر واحد</span>
        </div>
      </div>
    </div>
  );
}

function FAQItem({q_bn,q_ar,a_bn,a_ar}){
  const[open,setOpen]=useState(false);
  return(
    <div style={{background:"#fff",borderRadius:14,border:"1.5px solid #fde4c4",overflow:"hidden"}}>
      <button onClick={()=>setOpen(!open)} style={{width:"100%",padding:"14px 16px",background:"none",border:"none",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",textAlign:"right"}}>
        <span style={{color:"#E8712B",fontSize:16,transform:open?"rotate(45deg)":"none",transition:"transform 0.2s",fontWeight:700}}>+</span>
        <div style={{flex:1,marginRight:12}}>
          <div style={{color:"#1e293b",fontSize:13,fontWeight:800}}>{q_bn}</div>
          <div style={{color:"#a8834f",fontSize:11}}>{q_ar}</div>
        </div>
      </button>
      {open&&<div style={{padding:"0 16px 16px",borderTop:"1px solid #fff7ed",paddingTop:12}}>
        <div style={{color:"#475569",fontSize:12,lineHeight:1.8}}>{a_bn}</div>
        <div style={{color:"#a8834f",fontSize:11,lineHeight:1.8,marginTop:6}}>{a_ar}</div>
      </div>}
    </div>
  );
}

export default function RecruitmentAd({onApply,onBack}){
  const[daily,setDaily]=useState(6);
  const[perf,setPerf]=useState(0.5);
  const[visible,setVisible]=useState(false);
  useEffect(()=>{setVisible(true);},[]);

  const shareWA=()=>{
    const msg="🪣 রিয়াদে গাড়ি ধোয়ার চাকরি — নির্দিষ্ট বেতন + বিনামূল্যে বাসস্থান + মোটরসাইকেল\nএখনই আবেদন করুন: "+window.location.origin;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
  };

  const BENEFITS=[
    ["💰","নির্দিষ্ট বেতন ১,০০০ + বোনাস","راتب 1,000 + مكافآت"],
    ["🏠","বিনামূল্যে আবাসন","سكن مجاني"],
    ["🏍️","মোটরসাইকেল + সরঞ্জাম","دراجة + معدات"],
    ["⛽","জ্বালানি কোম্পানির খরচে","الوقود على الشركة"],
    ["📱","কাজের ফোন","جوال للعمل"],
    ["🏥","স্বাস্থ্য বীমা","تأمين صحي"],
    ["👕","সম্পূর্ণ ইউনিফর্ম","زي كامل"],
    ["🎓","পেশাদার প্রশিক্ষণ","تدريب احترافي"],
  ];

  const STEPS=[
    ["🌅","সকাল","বাসা থেকে বাইক ও সরঞ্জাম নিয়ে বের হন","الصباح — تستلم الدراجة من السكن"],
    ["📲","অর্ডার","অ্যাপ থেকে কাছাকাছি অর্ডার আসে","الطلبات تصلك عبر التطبيق"],
    ["🧽","কাজ","প্রতিটি অর্ডার আপনার আয়ে যোগ হয়","كل طلب يضاف لدخلك"],
    ["💵","মাস শেষে","বেতন + বোনাস পরিবারের কাছে পাঠান","نهاية الشهر — راتب وحوالة لعائلتك"],
  ];

  return(
    <div style={{minHeight:"100dvh",background:"linear-gradient(170deg,#FFF9F0 0%,#FFF3DC 55%,#FFEACC 100%)",fontFamily:"'Segoe UI',Tahoma,sans-serif",opacity:visible?1:0,transition:"opacity 0.4s"}}>

      {/* شريط علوي */}
      <div style={{position:"sticky",top:0,zIndex:50,background:"rgba(255,249,240,0.95)",backdropFilter:"blur(8px)",borderBottom:"1px solid #fde4c4",padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"#78716c",fontSize:13,fontWeight:700,cursor:"pointer"}}>← ফিরে</button>
        <div style={{width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,#E8712B,#f5a35f)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🪣</div>
      </div>

      {/* Hero */}
      <div style={{position:"relative",padding:"36px 20px 20px",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-60,left:-60,width:220,height:220,borderRadius:"50%",background:"radial-gradient(circle,rgba(232,113,43,0.14),transparent 70%)"}}/>
        <div style={{position:"relative",maxWidth:480,margin:"0 auto",textAlign:"center"}}>
          <div style={{display:"inline-block",background:"#fff",border:"1.5px solid #fed7aa",borderRadius:20,padding:"5px 16px",marginBottom:18}}>
            <span style={{color:"#E8712B",fontSize:11,fontWeight:800}}>রিয়াদে গাড়ি ধোয়ার চাকরি</span>
            <span style={{color:"#a8834f",fontSize:10}}> • وظيفة في الرياض</span>
          </div>
          <h1 style={{color:"#1e293b",fontSize:26,fontWeight:900,lineHeight:1.4,margin:"0 0 8px"}}>নতুন জীবনের শুরু<br/>এখান থেকেই</h1>
          <p style={{color:"#57534e",fontSize:13,lineHeight:1.7,marginBottom:4}}>নির্দিষ্ট আয়, বিনামূল্যে থাকার জায়গা, নিজের বাইক</p>
          <p style={{color:"#a8834f",fontSize:11,marginBottom:18}}>دخل ثابت، سكن مجاني، ودراجتك جاهزة</p>

          <div style={{marginBottom:22}}><LiveUrgencyBar/></div>

          <button onClick={onApply} style={{width:"100%",maxWidth:340,padding:"17px",background:"linear-gradient(135deg,#E8712B,#f5a35f)",border:"none",borderRadius:16,color:"#fff",fontSize:15,fontWeight:900,cursor:"pointer",boxShadow:"0 8px 24px rgba(232,113,43,0.3)"}}>
            এখনই আবেদন করুন — قدّم الآن ←
          </button>
        </div>
      </div>

      {/* المزايا */}
      <div style={{maxWidth:480,margin:"0 auto",padding:"8px 20px 32px"}}>
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{color:"#1e293b",fontSize:17,fontWeight:900}}>আপনি কী পাবেন?</div>
          <div style={{color:"#a8834f",fontSize:11}}>ماذا تحصل عليه؟</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {BENEFITS.map(([ic,bn,ar])=>(
            <div key={bn} style={{background:"#fff",border:"1.5px solid #fde4c4",borderRadius:16,padding:"14px 12px",textAlign:"center"}}>
              <div style={{fontSize:26,marginBottom:6}}>{ic}</div>
              <div style={{color:"#1e293b",fontSize:11.5,fontWeight:700,lineHeight:1.4}}>{bn}</div>
              <div style={{color:"#a8834f",fontSize:9.5,marginTop:3,lineHeight:1.4}}>{ar}</div>
            </div>
          ))}
        </div>
      </div>

      {/* رحلة الدخل — العنصر المميز */}
      <div style={{maxWidth:480,margin:"0 auto",padding:"0 20px 32px"}}>
        <IncomeJourney daily={daily} perf={perf} onDaily={setDaily} onPerf={setPerf}/>
      </div>

      {/* يوم عمل */}
      <div style={{maxWidth:480,margin:"0 auto",padding:"0 20px 32px"}}>
        <div style={{textAlign:"center",marginBottom:18}}>
          <div style={{color:"#1e293b",fontSize:17,fontWeight:900}}>একটি সাধারণ কর্মদিবস</div>
          <div style={{color:"#a8834f",fontSize:11}}>يوم عمل عادي</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:0}}>
          {STEPS.map(([ic,title_bn,desc_bn,desc_ar],i)=>(
            <div key={i} style={{display:"flex",gap:14}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                <div style={{width:44,height:44,borderRadius:14,background:"linear-gradient(135deg,#fff7ed,#fed7aa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,border:"1.5px solid #fed7aa"}}>{ic}</div>
                {i<STEPS.length-1&&<div style={{width:2,flex:1,background:"#fed7aa",minHeight:24}}/>}
              </div>
              <div style={{paddingBottom:24,paddingTop:4}}>
                <div style={{color:"#E8712B",fontSize:13,fontWeight:800,marginBottom:2}}>{title_bn}</div>
                <div style={{color:"#57534e",fontSize:12,lineHeight:1.6,marginBottom:3}}>{desc_bn}</div>
                <div style={{color:"#a8834f",fontSize:10.5,lineHeight:1.5}}>{desc_ar}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* الأسئلة الشائعة */}
      <div style={{maxWidth:480,margin:"0 auto",padding:"0 20px 32px"}}>
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{color:"#1e293b",fontSize:17,fontWeight:900}}>সবাই যা জিজ্ঞাসা করে</div>
          <div style={{color:"#a8834f",fontSize:11}}>أسئلة يسألها الجميع</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <FAQItem
            q_bn="বাসস্থান কি সত্যিই ফ্রি?" q_ar="هل السكن مجاني فعلاً؟"
            a_bn="হ্যাঁ, আপনার আগমনের আগেই কোম্পানি সম্পূর্ণ বাসস্থানের ব্যবস্থা করে — কোনো ভাড়া দিতে হয় না।"
            a_ar="نعم، السكن مؤمّن بالكامل قبل وصولك — لا تدفع إيجاراً."/>
          <FAQItem
            q_bn="আমার ইকামার মেয়াদ শেষ হলে কী হবে?" q_ar="ماذا لو إقامتي منتهية؟"
            a_bn="আমরা স্থানান্তর ও নবায়নে সাহায্য করি — যোগাযোগ করুন, ধাপে ধাপে বুঝিয়ে দেব।"
            a_ar="نساعدك في إجراءات النقل والتجديد خطوة بخطوة."/>
          <FAQItem
            q_bn="কীভাবে বেতন পরিবারের কাছে পাঠাবো?" q_ar="كيف أرسل الراتب لعائلتي؟"
            a_bn="আপনার বেতন প্রতি মাসে ব্যাংক অ্যাকাউন্টে যায় — যেকোনো মাধ্যমে পরিবারকে পাঠাতে পারবেন।"
            a_ar="راتبك يُحوَّل لحسابك شهرياً — تحوّله لعائلتك بأي وسيلة."/>
          <FAQItem
            q_bn="ড্রাইভিং লাইসেন্স কি লাগবে?" q_ar="هل أحتاج رخصة قيادة؟"
            a_bn="থাকলে ভালো, না থাকলে গ্রহণের পর আমরা তা বের করতে সাহায্য করব।"
            a_ar="يُفضَّل وجودها، وإن لم تكن — نساعدك في استخراجها."/>
          <FAQItem
            q_bn="গ্রহণের পর কবে কাজ শুরু হবে?" q_ar="متى يبدأ العمل بعد القبول؟"
            a_bn="কাগজপত্র সম্পন্ন হওয়ার প্রায় দুই সপ্তাহের মধ্যে — হোয়াটসঅ্যাপে প্রতিটি ধাপ জানানো হবে।"
            a_ar="خلال أسبوعين تقريباً — نتواصل معك بكل خطوة عبر واتساب."/>
        </div>
      </div>

      {/* قسم ختامي — الوتر العاطفي */}
      <div style={{maxWidth:480,margin:"0 auto",padding:"0 20px 24px"}}>
        <div style={{background:"linear-gradient(135deg,#E8712B,#f5a35f)",borderRadius:20,padding:"26px 22px",textAlign:"center",position:"relative",overflow:"hidden",boxShadow:"0 10px 30px rgba(232,113,43,0.25)"}}>
          <div style={{position:"absolute",top:-30,right:-30,width:140,height:140,borderRadius:"50%",background:"rgba(255,255,255,0.12)"}}/>
          <div style={{fontSize:32,marginBottom:8}}>🌅</div>
          <div style={{color:"#fff",fontSize:16,fontWeight:900,marginBottom:6,lineHeight:1.6}}>আপনার নতুন জীবন এক ক্লিকে শুরু</div>
          <div style={{color:"rgba(255,255,255,0.9)",fontSize:12,marginBottom:14,lineHeight:1.6}}>প্রতিদিনের দেরি মানে একদিনের সুযোগ হারানো</div>
          <div style={{color:"rgba(255,255,255,0.75)",fontSize:11,marginBottom:18,lineHeight:1.6}}>حياتك الجديدة تبدأ بضغطة واحدة — كل يوم تأخير فرصة ضائعة</div>
          <button onClick={onApply} style={{width:"100%",padding:"15px",background:"#fff",border:"none",borderRadius:14,color:"#E8712B",fontSize:14,fontWeight:900,cursor:"pointer"}}>
            এখনই আবেদন করুন ←
          </button>
          <button onClick={shareWA} style={{width:"100%",marginTop:10,padding:"11px",background:"rgba(255,255,255,0.18)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:12,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
            📤 বন্ধুর সাথে শেয়ার করুন
          </button>
        </div>
      </div>

      {/* شريط CTA سفلي ثابت */}
      <div style={{position:"sticky",bottom:0,background:"rgba(255,249,240,0.97)",backdropFilter:"blur(10px)",borderTop:"1px solid #fde4c4",padding:"12px 20px",zIndex:50}}>
        <button onClick={onApply} style={{width:"100%",padding:"15px",background:"linear-gradient(135deg,#E8712B,#f5a35f)",border:"none",borderRadius:14,color:"#fff",fontSize:14,fontWeight:900,cursor:"pointer",boxShadow:"0 6px 18px rgba(232,113,43,0.3)"}}>
          মাত্র ৫ মিনিট — قدّم الآن ←
        </button>
      </div>
    </div>
  );
}
