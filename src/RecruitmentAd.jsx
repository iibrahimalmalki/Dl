import{useState,useEffect,useRef}from"react";

// عداد الغسلات — العنصر المميز للصفحة (يحاكي عداد الدراجة النارية)
function WashOdometer({washes,onChange}){
  const RATE=20*0.85; // 20 ريال قبل الضريبة، صافي تقريبي بعد حصة الشركة التشغيلية يُعرض كتقدير
  const BASE=1000;
  const income = Math.round(BASE + washes*6.5); // تقدير: أساسي + حافز تقريبي لكل غسلة إضافية عن التعادل
  const taka = Math.round(income*22.6); // تقريبي وقت الكتابة، يُعرض كـ"تقريبي"
  const breakeven=181, safe=210;
  const zone = washes<breakeven ? "low" : washes<safe ? "mid" : "high";
  const zoneColor = {low:"#dc2626",mid:"#d97706",high:"#16a34a"}[zone];
  const zoneLabel = {low:"تحت نقطة التعادل",mid:"دخل جيد",high:"دخل ممتاز — مثل أفضل بايكر"}[zone];
  return(
    <div style={{background:"#1a1410",borderRadius:24,padding:"28px 22px",border:"1px solid #3a2e22",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-40,right:-40,width:160,height:160,borderRadius:"50%",background:"radial-gradient(circle,rgba(232,113,43,0.15),transparent 70%)"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div style={{color:"#c9a86a",fontSize:11,fontWeight:700,letterSpacing:1}}>ODOMETER</div>
        <div style={{color:"#fff",fontSize:13,fontWeight:800,textAlign:"right"}}>حاسبة دخلك الشهري<div style={{color:"#8a7a5c",fontSize:10,textAlign:"left",fontWeight:400}}>মাসিক আয় ক্যালকুলেটর</div></div>
      </div>

      {/* شاشة العداد الرقمية */}
      <div style={{background:"#0d0906",borderRadius:14,padding:"20px 16px",marginBottom:20,border:"1px solid #2a2018",boxShadow:"inset 0 2px 12px rgba(0,0,0,0.5)"}}>
        <div style={{display:"flex",justifyContent:"center",gap:2,marginBottom:8}}>
          {String(washes).padStart(3,"0").split("").map((d,i)=>(
            <div key={i} style={{width:38,height:52,background:"linear-gradient(180deg,#1a1410,#0d0906)",border:"1px solid #3a2e22",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontFamily:"'Courier New',monospace",fontSize:32,fontWeight:900,color:"#E8712B",textShadow:"0 0 12px rgba(232,113,43,0.6)"}}>{d}</span>
            </div>
          ))}
          <div style={{display:"flex",alignItems:"center",paddingRight:6}}><span style={{color:"#8a7a5c",fontSize:11,fontWeight:700}}>غسلة/شهر</span></div>
        </div>
        <div style={{textAlign:"center",color:"#8a7a5c",fontSize:10,marginTop:4}}>washes/month • ধোয়া/মাস</div>
      </div>

      {/* السلايدر */}
      <input type="range" min={80} max={230} value={washes} onChange={e=>onChange(+e.target.value)}
        style={{width:"100%",accentColor:"#E8712B",marginBottom:6,height:6}}/>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}>
        <span style={{color:"#8a7a5c",fontSize:10}}>80</span>
        <span style={{color:zoneColor,fontSize:11,fontWeight:800}}>{zoneLabel}</span>
        <span style={{color:"#8a7a5c",fontSize:10}}>230</span>
      </div>

      {/* النتيجة */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div style={{background:"rgba(232,113,43,0.12)",border:"1px solid rgba(232,113,43,0.3)",borderRadius:12,padding:"14px 12px",textAlign:"center"}}>
          <div style={{color:"#f5a35f",fontSize:10,fontWeight:700,marginBottom:4}}>﷼ دخلك التقديري</div>
          <div style={{color:"#fff",fontSize:24,fontWeight:900}}>{income.toLocaleString()}</div>
          <div style={{color:"#8a7a5c",fontSize:9}}>ريال سعودي / شهر</div>
        </div>
        <div style={{background:"rgba(46,125,50,0.12)",border:"1px solid rgba(46,125,50,0.3)",borderRadius:12,padding:"14px 12px",textAlign:"center"}}>
          <div style={{color:"#6fcf7a",fontSize:10,fontWeight:700,marginBottom:4}}>৳ تقريباً بالتاكا</div>
          <div style={{color:"#fff",fontSize:24,fontWeight:900}}>{taka.toLocaleString()}</div>
          <div style={{color:"#8a7a5c",fontSize:9}}>টাকা / মাস (আনুমানিক)</div>
        </div>
      </div>
      <div style={{marginTop:12,color:"#6b5d47",fontSize:9,textAlign:"center",lineHeight:1.6}}>* تقدير تقريبي يعتمد على الأداء الفعلي وأسعار الصرف — ليس رقماً نهائياً<br/>* এটি একটি আনুমানিক হিসাব, চূড়ান্ত সংখ্যা নয়</div>
    </div>
  );
}

function FAQItem({q_ar,q_bn,a_ar,a_bn}){
  const[open,setOpen]=useState(false);
  return(
    <div style={{background:"#fff",borderRadius:14,border:"1.5px solid #f1e4d8",overflow:"hidden"}}>
      <button onClick={()=>setOpen(!open)} style={{width:"100%",padding:"14px 16px",background:"none",border:"none",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",textAlign:"right"}}>
        <span style={{color:"#E8712B",fontSize:16,transform:open?"rotate(45deg)":"none",transition:"transform 0.2s",fontWeight:700}}>+</span>
        <div style={{flex:1,marginRight:12}}>
          <div style={{color:"#1e293b",fontSize:13,fontWeight:800}}>{q_ar}</div>
          <div style={{color:"#94a3b8",fontSize:11,textAlign:"left"}}>{q_bn}</div>
        </div>
      </button>
      {open&&<div style={{padding:"0 16px 16px",borderTop:"1px solid #f8f0e8",paddingTop:12}}>
        <div style={{color:"#475569",fontSize:12,lineHeight:1.8,textAlign:"right"}}>{a_ar}</div>
        <div style={{color:"#94a3b8",fontSize:11,lineHeight:1.8,textAlign:"left",marginTop:6}}>{a_bn}</div>
      </div>}
    </div>
  );
}

export default function RecruitmentAd({onApply,onBack}){
  const[washes,setWashes]=useState(150);
  const[visible,setVisible]=useState(false);
  useEffect(()=>{setVisible(true);},[]);

  const BENEFITS=[
    ["💰","راتب أساسي 1,000 ريال + مكافآت حتى 800+","বেতন ১,০০০ + বোনাস ৮০০+"],
    ["🏠","سكن مجاني توفره الشركة","বিনামূল্যে আবাসন"],
    ["🏍️","دراجة نارية + معدات العمل كاملة","মোটরসাইকেল + সরঞ্জাম"],
    ["⛽","الوقود على حساب الشركة — لا خصومات","জ্বালানি কোম্পানির খরচে"],
    ["📱","جوال مخصص للعمل","কাজের ফোন"],
    ["🏥","تأمين صحي معتمد","স্বাস্থ্য বীমা"],
    ["👕","زي رسمي كامل من الشركة","সম্পূর্ণ ইউনিফর্ম"],
    ["🎓","تدريب احترافي قبل البدء","পেশাদার প্রশিক্ষণ"],
  ];

  const STEPS=[
    ["🌅","الصباح","تستلم الدراجة والمعدات من السكن — يوم عمل منظم بلا فوضى","সকালে বাসা থেকে বাইক ও সরঞ্জাম নিয়ে বের হন"],
    ["📲","الطلبات","التطبيق يرسل لك طلبات غسيل قريبة منك — لا تبحث عن عمل بنفسك","অ্যাপ থেকে কাছাকাছি অর্ডার আসে"],
    ["🧽","التنفيذ","تغسل السيارة بالمعدات المزودة — كل طلب نقاط في رصيدك","গাড়ি ধোয়া — প্রতিটি অর্ডার আপনার আয়ে যোগ হয়"],
    ["💵","نهاية الشهر","راتبك يوصل ثابت + حافز الأداء — تحويل مباشر لعائلتك","মাস শেষে বেতন + বোনাস — পরিবারের কাছে সরাসরি পাঠান"],
  ];

  return(
    <div style={{minHeight:"100dvh",background:"#fffaf3",fontFamily:"'Segoe UI',Tahoma,sans-serif",opacity:visible?1:0,transition:"opacity 0.4s"}}>

      {/* شريط علوي */}
      <div style={{position:"sticky",top:0,zIndex:50,background:"rgba(255,250,243,0.95)",backdropFilter:"blur(8px)",borderBottom:"1px solid #f1e4d8",padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"#64748b",fontSize:13,fontWeight:700,cursor:"pointer"}}>← رجوع</button>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>🪣</span><span style={{color:"#1e293b",fontWeight:900,fontSize:14}}>دلو ورغوة</span></div>
      </div>

      {/* Hero */}
      <div style={{position:"relative",padding:"36px 20px 28px",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-60,left:-60,width:220,height:220,borderRadius:"50%",background:"radial-gradient(circle,rgba(232,113,43,0.12),transparent 70%)"}}/>
        <div style={{position:"relative",maxWidth:480,margin:"0 auto",textAlign:"center"}}>
          <div style={{display:"inline-block",background:"#fff",border:"1.5px solid #fed7aa",borderRadius:20,padding:"5px 16px",marginBottom:18}}>
            <span style={{color:"#E8712B",fontSize:11,fontWeight:800}}>وظيفة غسيل سيارات — الرياض</span>
            <span style={{color:"#c98a5a",fontSize:10}}> • রিয়াদে গাড়ি ধোয়ার চাকরি</span>
          </div>
          <h1 style={{color:"#1e293b",fontSize:30,fontWeight:900,lineHeight:1.3,margin:"0 0 6px"}}>دخل ثابت، سكن مجاني،<br/>ودراجتك جاهزة</h1>
          <p style={{color:"#78716c",fontSize:13,lineHeight:1.6,marginBottom:4}}>انضم لفريق يعمل الآن في الرياض — بدون تعقيد وبدون وسيط</p>
          <p style={{color:"#a89a88",fontSize:12,textAlign:"center",marginBottom:26}}>রিয়াদে এখনই কর্মরত টিমে যোগ দিন — কোনো মধ্যস্থতাকারী ছাড়াই</p>

          <button onClick={onApply} style={{width:"100%",maxWidth:340,padding:"17px",background:"linear-gradient(135deg,#E8712B,#CC5200)",border:"none",borderRadius:16,color:"#fff",fontSize:16,fontWeight:900,cursor:"pointer",boxShadow:"0 8px 24px rgba(232,113,43,0.35)"}}>
            قدّم الآن — খুবই সহজ ←
          </button>
        </div>
      </div>

      {/* المزايا */}
      <div style={{maxWidth:480,margin:"0 auto",padding:"8px 20px 32px"}}>
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{color:"#1e293b",fontSize:17,fontWeight:900}}>ماذا تحصل عليه؟</div>
          <div style={{color:"#a89a88",fontSize:11}}>আপনি কী পাবেন?</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {BENEFITS.map(([ic,ar,bn])=>(
            <div key={ar} style={{background:"#fff",border:"1.5px solid #f1e4d8",borderRadius:16,padding:"14px 12px",textAlign:"center"}}>
              <div style={{fontSize:26,marginBottom:6}}>{ic}</div>
              <div style={{color:"#1e293b",fontSize:11.5,fontWeight:700,lineHeight:1.4}}>{ar}</div>
              <div style={{color:"#a89a88",fontSize:9.5,marginTop:3,lineHeight:1.4}}>{bn}</div>
            </div>
          ))}
        </div>
      </div>

      {/* عداد الدخل — العنصر المميز */}
      <div style={{maxWidth:480,margin:"0 auto",padding:"0 20px 32px"}}>
        <WashOdometer washes={washes} onChange={setWashes}/>
      </div>

      {/* يوم في حياة بايكر */}
      <div style={{maxWidth:480,margin:"0 auto",padding:"0 20px 32px"}}>
        <div style={{textAlign:"center",marginBottom:18}}>
          <div style={{color:"#1e293b",fontSize:17,fontWeight:900}}>يوم عمل عادي</div>
          <div style={{color:"#a89a88",fontSize:11}}>একটি সাধারণ কর্মদিবস</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:0}}>
          {STEPS.map(([ic,title_ar,desc_ar,desc_bn],i)=>(
            <div key={i} style={{display:"flex",gap:14}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                <div style={{width:44,height:44,borderRadius:14,background:"linear-gradient(135deg,#fff7ed,#fed7aa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,border:"1.5px solid #fed7aa"}}>{ic}</div>
                {i<STEPS.length-1&&<div style={{width:2,flex:1,background:"#fed7aa",minHeight:24}}/>}
              </div>
              <div style={{paddingBottom:24,paddingTop:4}}>
                <div style={{color:"#E8712B",fontSize:13,fontWeight:800,marginBottom:2}}>{title_ar}</div>
                <div style={{color:"#57534e",fontSize:12,lineHeight:1.6,marginBottom:3}}>{desc_ar}</div>
                <div style={{color:"#a89a88",fontSize:10.5,textAlign:"left",lineHeight:1.5}}>{desc_bn}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* الأسئلة الشائعة */}
      <div style={{maxWidth:480,margin:"0 auto",padding:"0 20px 32px"}}>
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{color:"#1e293b",fontSize:17,fontWeight:900}}>أسئلة يسألها الجميع</div>
          <div style={{color:"#a89a88",fontSize:11}}>সবাই যা জিজ্ঞাসা করে</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <FAQItem
            q_ar="هل السكن مجاني فعلاً؟" q_bn="বাসস্থান কি সত্যিই ফ্রি?"
            a_ar="نعم، السكن مؤمّن بالكامل من الشركة قبل وصولك — لا تدفع إيجاراً."
            a_bn="হ্যাঁ, আপনার আগমনের আগেই কোম্পানি সম্পূর্ণ বাসস্থানের ব্যবস্থা করে — কোনো ভাড়া দিতে হয় না।"/>
          <FAQItem
            q_ar="ماذا لو إقامتي منتهية؟" q_bn="আমার ইকামার মেয়াদ শেষ হলে কী হবে?"
            a_ar="نساعدك في إجراءات النقل والتجديد — تواصل معنا وسنوضح لك المسار خطوة بخطوة."
            a_bn="আমরা স্থানান্তর ও নবায়নে সাহায্য করি — যোগাযোগ করুন, ধাপে ধাপে বুঝিয়ে দেব।"/>
          <FAQItem
            q_ar="كيف أرسل الراتب لعائلتي؟" q_bn="কীভাবে বেতন পরিবারের কাছে পাঠাবো?"
            a_ar="راتبك يُحوَّل لحسابك البنكي شهرياً — تحوّله لعائلتك بأي وسيلة تفضلها."
            a_bn="আপনার বেতন প্রতি মাসে ব্যাংক অ্যাকাউন্টে যায় — যেকোনো মাধ্যমে পরিবারকে পাঠাতে পারবেন।"/>
          <FAQItem
            q_ar="هل أحتاج رخصة قيادة؟" q_bn="ড্রাইভিং লাইসেন্স কি লাগবে?"
            a_ar="يُفضَّل وجودها، وإن لم تكن لديك — نساعدك في استخراجها بعد القبول."
            a_bn="থাকলে ভালো, না থাকলে গ্রহণের পর আমরা তা বের করতে সাহায্য করব।"/>
          <FAQItem
            q_ar="متى يبدأ العمل بعد القبول؟" q_bn="গ্রহণের পর কবে কাজ শুরু হবে?"
            a_ar="عادة خلال أسبوعين من إتمام الأوراق — نتواصل معك بكل خطوة عبر واتساب."
            a_bn="কাগজপত্র সম্পন্ন হওয়ার প্রায় দুই সপ্তাহের মধ্যে — হোয়াটসঅ্যাপে প্রতিটি ধাপ জানানো হবে।"/>
        </div>
      </div>

      {/* شريط CTA سفلي ثابت */}
      <div style={{position:"sticky",bottom:0,background:"rgba(255,250,243,0.97)",backdropFilter:"blur(10px)",borderTop:"1px solid #f1e4d8",padding:"12px 20px",zIndex:50}}>
        <button onClick={onApply} style={{width:"100%",padding:"15px",background:"linear-gradient(135deg,#E8712B,#CC5200)",border:"none",borderRadius:14,color:"#fff",fontSize:14,fontWeight:900,cursor:"pointer",boxShadow:"0 6px 18px rgba(232,113,43,0.3)"}}>
          قدّم الآن — মাত্র ৫ মিনিট লাগবে ←
        </button>
      </div>
    </div>
  );
}
