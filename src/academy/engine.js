// محرك أكاديمية دلو ورغوة — دوال نقية منقولة من academy_app.js (بلا DOM وبلا Supabase).
// توليد الأسئلة وقواعد النجاح وتقييم المشرف كما هي حرفياً؛ الحالة (أفضل نتيجة، الاعتماد، الأخطاء) تُمرَّر من الخارج.
import{$,CFG,TOWELS,TOWEL_WHY,TOWEL_NOTES,SPRAYS,SPRAY_WHY,TOOLS,INTERIOR,EXTERIOR,APP_FLOW,JOB_FLOW,DAY_TF,QUALITY}from"./content";

// مصدر عشوائية قابل للاستبدال (للاختبارات)
let rnd=Math.random;
export const setRandom=f=>{rnd=f||Math.random;};
export const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
export const pick=(a,n)=>shuffle(a).slice(0,n);
export{CFG};

/* ===== بناء الأسئلة ===== */
export const allSteps=W=>W.phases.flatMap(p=>p.steps.map(s=>({...s,phase:p})));
export const TF_T=$("صح أو خطأ","সঠিক না ভুল");
export function buildTowels(){
  const m={type:"match",topic:"towels",title:$("صِل كل منشفة بمكان استخدامها","প্রতিটি তোয়ালেকে তার জায়গার সাথে মেলাও"),left:TOWELS.map(r=>({k:r.id,img:r.img,label:r.name})),right:TOWELS.map(r=>({k:r.id,label:r.use})),why:TOWEL_WHY};
  const q=[];
  TOWELS.forEach(r=>q.push({type:"mcq",topic:"towels",img:r.img,title:$("هذه المنشفة تُستخدم لـ؟","এই তোয়ালে কীসের জন্য?"),opts:TOWELS.map(n=>({k:n.id,label:n.use})),ans:r.id,why:$(`${r.name.ar}: ${r.use.ar}`,`${r.name.bn}: ${r.use.bn}`)}));
  TOWELS.forEach(r=>q.push({type:"mcq",topic:"towels",grid:true,title:$(`أي منشفة تستخدم لـ: ${r.use.ar}؟`,`${r.use.bn} — কোন তোয়ালে?`),opts:TOWELS.map(n=>({k:n.id,img:n.img,label:n.name})),ans:r.id,why:$(`${r.use.ar} ← ${r.name.ar}`,`${r.use.bn} → ${r.name.bn}`)}));
  q.push({type:"tf",topic:"towels",s:$("أستخدم المنشفة الخضراء على الزجاج إذا خلصت الصفراء","হলুদ শেষ হলে কাচে সবুজ তোয়ালে ব্যবহার করব"),a:false,why:$("المنشفة الخضراء فيها ملمع الطبلون ويترك بقعاً على الزجاج. خذ منشفة صفراء احتياطية دائماً.","সবুজ তোয়ালেতে ড্যাশবোর্ড পলিশ থাকে, কাচে দাগ পড়ে। সবসময় বাড়তি হলুদ তোয়ালে রাখো।")});
  q.push({type:"tf",topic:"towels",s:$("أعرف منشفة الكفرات من لونها الوردي فقط","টায়ারের তোয়ালে শুধু গোলাপি রং দেখে চিনব"),a:false,why:TOWEL_NOTES[0]});
  q.push({type:"tf",topic:"towels",s:$("كل منشفة ناقصة من الطقم تُخصم بـ3 ريالات","প্যাকেজ থেকে প্রতিটি তোয়ালে হারালে ৩ রিয়াল কাটা হয়"),a:true,why:TOWEL_NOTES[2]});
  q.push({type:"tf",topic:"towels",s:$("أنشّف الجسم وأمسح «اللمسة الأخيرة» بنفس المنشفة الزرقاء","একই নীল তোয়ালে দিয়ে বডি শুকাব ও «লাস্ট টাচ» মুছব"),a:false,why:TOWEL_NOTES[1]});
  return[m,...pick(q,6)];
}
export function buildProducts(){
  const m={type:"match",topic:"products",title:$("صِل كل بخاخ باستخدامه","প্রতিটি স্প্রেকে তার কাজের সাথে মেলাও"),left:SPRAYS.map(r=>({k:r.id,img:r.img,label:r.name})),right:SPRAYS.map(r=>({k:r.id,label:r.use})),why:SPRAY_WHY};
  const q=[];
  SPRAYS.filter(r=>r.towel).forEach(r=>{const n=TOWELS.find(a=>a.id===r.towel);q.push({type:"mcq",topic:"products",grid:true,title:$(`مع ${r.name.ar} أستخدم أي منشفة؟`,`${r.name.bn} এর সাথে কোন তোয়ালে?`),opts:TOWELS.map(t=>({k:t.id,img:t.img,label:t.name})),ans:r.towel,why:$(`${r.name.ar} ← ${n.name.ar}`,`${r.name.bn} → ${n.name.bn}`)});});
  SPRAYS.forEach(r=>q.push({type:"mcq",topic:"products",title:$(`أي بخاخ تستخدم لـ: ${r.use.ar}؟`,`${r.use.bn} — কোন স্প্রে?`),opts:shuffle(SPRAYS).map(n=>({k:n.id,label:n.name})),ans:r.id,why:$(`${r.use.ar} ← ${r.name.ar}`,`${r.use.bn} → ${r.name.bn}`)}));
  q.push({type:"tf",topic:"products",s:$("أضع ملمع الكفرات بالإسفنجة لا بالمنشفة","টায়ার পলিশ স্পঞ্জ দিয়ে লাগাব, তোয়ালে দিয়ে নয়"),a:true,why:$("ملمع الكفرات يوضع بإسفنجة الكفرات على كل كفر، ولا يوضع على الجنط.","টায়ার পলিশ টায়ার স্পঞ্জ দিয়ে প্রতিটি টায়ারে লাগান, রিমে নয়।")});
  q.push({type:"tf",topic:"products",s:$("أرش المنظف مباشرة على السطح ثم أمسحه","ক্লিনার সরাসরি গাড়ির গায়ে স্প্রে করে মুছব"),a:false,why:SPRAY_WHY});
  return[m,...pick(q,6)];
}
export function buildTools(){
  const q=[];
  pick(TOOLS,5).forEach(t=>{const o=pick(TOOLS.filter(n=>n.id!==t.id),2);q.push({type:"mcq",topic:"tools",img:t.id,title:$("ما اسم هذه الأداة؟","এই যন্ত্রের নাম কী?"),opts:shuffle([t,...o]).map(n=>({k:n.id,label:n.name})),ans:t.id,why:$(`${t.name.ar} — ${t.use.ar}`,`${t.name.bn} — ${t.use.bn}`)});});
  pick(TOOLS,3).forEach(t=>{const o=pick(TOOLS.filter(n=>n.id!==t.id),3);q.push({type:"mcq",topic:"tools",grid:true,title:$(`أي أداة تستخدم لـ: ${t.use.ar}؟`,`${t.use.bn} — কোন যন্ত্র?`),opts:shuffle([t,...o]).map(n=>({k:n.id,img:n.id,label:n.name})),ans:t.id,why:$(`${t.use.ar} ← ${t.name.ar}`,`${t.use.bn} → ${t.name.bn}`)});});
  return q;
}
export function buildWash(W){
  const topic=W.id,q=[],steps=allSteps(W);
  // ترتيب المراحل ثم ترتيب خطوات مرحلة
  if(W.phases.length<=4)q.push({type:"order",topic,title:$("رتّب مراحل الغسيل","ধোয়ার পর্যায়গুলো সাজাও"),items:W.phases.map(p=>p.name),why:$(W.phases.map(p=>p.name.ar).join(" ← "),W.phases.map(p=>p.name.bn).join(" → "))});
  else q.push({type:"order",topic,title:$("رتّب مراحل الغسيل من الأول للأخير","ধোয়ার পর্যায়গুলো প্রথম থেকে শেষ সাজাও"),items:W.phases.map(p=>p.name),why:$(W.phases.map(p=>p.name.ar).join(" ← "),W.phases.map(p=>p.name.bn).join(" → "))});
  const big=pick(W.phases.filter(p=>p.steps.length>=3),1)[0];
  if(big)q.push({type:"order",topic,title:$(`رتّب خطوات مرحلة «${big.name.ar}»`,`«${big.name.bn}» পর্যায়ের ধাপগুলো সাজাও`),items:big.steps.map(s=>s.t),why:$("الترتيب الصحيح يمنع رجوع الأوساخ على الأجزاء النظيفة.","সঠিক ক্রমে কাজ করলে পরিষ্কার অংশে আবার ময়লা পড়ে না।")});
  const rest=[];
  // قبل / بعد
  pick([...Array(steps.length-1).keys()],3).forEach(i=>{
    const before=rnd()<0.5,ref=before?i+1:i,ans=before?i:i+1;
    const wrong=pick([...Array(steps.length).keys()].filter(x=>x!==ref&&x!==ans),2);
    rest.push({type:"mcq",topic,title:before?$(`ما الخطوة التي تأتي مباشرة قبل: «${steps[ref].t.ar}»؟`,`«${steps[ref].t.bn}» এর ঠিক আগে কোন ধাপ?`):$(`ما الخطوة التي تأتي مباشرة بعد: «${steps[ref].t.ar}»؟`,`«${steps[ref].t.bn}» এর ঠিক পরে কোন ধাপ?`),opts:shuffle([ans,...wrong]).map(x=>({k:String(x),label:steps[x].t})),ans:String(ans),why:$((before?"قبلها: ":"بعدها: ")+steps[ans].t.ar,(before?"আগে: ":"পরে: ")+steps[ans].t.bn)});
  });
  // علامة الإتقان
  pick(steps,3).forEach(s=>{const o=pick(steps.filter(x=>x!==s),2);rest.push({type:"mcq",topic,title:$(`كيف أعرف أني أتقنت: «${s.t.ar}»؟`,`«${s.t.bn}» — কীভাবে বুঝব ঠিকমতো হয়েছে?`),opts:shuffle([s,...o]).map(x=>({k:x.ok.ar,label:x.ok})),ans:s.ok.ar,why:$(`${s.t.ar} ← ${s.ok.ar}`,`${s.t.bn} → ${s.ok.bn}`)});});
  // القواعد: صح وخطأ
  W.rules.forEach(r=>{rest.push({type:"tf",topic,s:r.wrong,a:false,why:r.r});});
  pick(W.rules,2).forEach(r=>rest.push({type:"tf",topic,s:r.r,a:true,why:r.r}));
  return[...q,...pick(rest,7)];
}
export function buildDay(){
  const q=[{type:"order",topic:"day",title:$("رتّب ضغطات التطبيق في كل حجز","প্রতি বুকিং-এ অ্যাপের ধাপগুলো সাজাও"),items:APP_FLOW,why:$(APP_FLOW.map(x=>x.ar).join(" ← "),APP_FLOW.map(x=>x.bn).join(" → "))},
    {type:"order",topic:"day",title:$("رتّب ما تفعله منذ وصولك للعميل","গ্রাহকের কাছে পৌঁছানোর পর থেকে কাজগুলো সাজাও"),items:JOB_FLOW,why:$("الوصول ← خلع الواقيات ← رسالة ← تصوير ← بدء الغسيل ← إنهاء الخدمة ← التقييم","পৌঁছানো → গার্ড খোলা → মেসেজ → ছবি → স্টার্ট ওয়াশ → এন্ড সার্ভিস → রেটিং")}];
  const rest=DAY_TF.map(e=>({type:"tf",topic:"day",s:e.s,a:e.a,why:e.why}));
  rest.push({type:"mcq",topic:"day",title:$("متى أخرج من السكن لحجز الساعة 9:00؟","সকাল ৯:০০ টার বুকিং-এর জন্য কখন রুম থেকে বের হব?"),opts:[{k:"a",label:$("8:25","৮:২৫")},{k:"b",label:$("8:50","৮:৫০")},{k:"c",label:$("9:00","৯:০০")}],ans:"a",why:$("اخرج 8:25 واضغط «في الطريق» في التطبيق.","৮:২৫ এ বের হন এবং অ্যাপে «অন দ্য ওয়ে» করুন।")});
  return[...q,...pick(rest,6)];
}
export const buildQuality=()=>pick(QUALITY,6).map(e=>({type:"tf",topic:"quality",s:e.s,a:e.a,why:e.why}));

export const MODS=[
  {id:"towels",icon:"towelblue",name:$("المناشف","তোয়ালে"),desc:$("أي منشفة لأي جزء، ولماذا","কোন তোয়ালে কোথায়, কেন"),build:buildTowels,mins:4},
  {id:"products",icon:"glasscleaner",name:$("البخاخات والمواد","স্প্রে ও কেমিক্যাল"),desc:$("كل بخاخ واستخدامه ومنشفته","প্রতিটি স্প্রে, কাজ ও তোয়ালে"),build:buildProducts,mins:4},
  {id:"tools",icon:"watergun",name:$("العدة والأدوات","যন্ত্রপাতি"),desc:$("اسم كل أداة واستخدامها","প্রতিটি যন্ত্রের নাম ও কাজ"),build:buildTools,mins:3},
  {id:"interior",icon:"vacuum",name:$("الغسيل الداخلي","গাড়ির ভেতরের পরিষ্কার"),desc:$("15 خطوة في 3 مراحل · بالفيديو","১৫ ধাপ, ৩ পর্যায় · ভিডিওসহ"),build:()=>buildWash(INTERIOR),mins:9,video:true},
  {id:"exterior",icon:"bodysponge",name:$("الغسيل الخارجي","গাড়ির বাইরের ধোয়া"),desc:$("13 خطوة في 7 مقاطع · بالفيديو","১৩ ধাপ, ৭ অংশ · ভিডিওসহ"),build:()=>buildWash(EXTERIOR),mins:18,video:true},
  {id:"day",icon:"helmet",name:$("يومي من الصباح إلى النوم","আমার দিন: সকাল থেকে ঘুম"),desc:$("قواعد سويتر اليومية وضغطات التطبيق","সোয়েটারের দৈনিক নিয়ম ও অ্যাপের ধাপ"),build:buildDay,mins:5},
  {id:"quality",icon:"headlight",name:$("قواعد الجودة والتعامل","মান ও আচরণের নিয়ম"),desc:$("دروس من شكاوى حقيقية","আসল অভিযোগ থেকে শিক্ষা"),build:buildQuality,mins:3},
];
export const modName=id=>id==="final"?$("الاختبار الشامل","পূর্ণ পরীক্ষা"):id==="daily"?$("أسئلة اليوم","আজকের প্রশ্ন"):(MODS.find(m=>m.id===id)||{name:$(id,id)}).name;
export const WASH={interior:INTERIOR,exterior:EXTERIOR};

/* ===== الطريق المتسلسل: لا تُفتح محطة قبل إتمام ما قبلها ===== */
export const PATH=[...MODS.map(m=>({t:"mod",id:m.id,name:m.name,icon:m.icon,sub:$(`${m.mins} د`,`${m.mins} মিনিট`)})),
  {t:"final",id:"final",name:$("الاختبار الشامل","পূর্ণ পরীক্ষা"),icon:"extrabox",sub:$("أسئلة من كل الوحدات","সব ইউনিট থেকে প্রশ্ন")},
  {t:"prac",id:"interior",name:$("التطبيق العملي: الغسيل الداخلي","হাতে-কলমে: ভেতরের পরিষ্কার"),icon:"vacuum",sub:$("على سيارة حقيقية مع المشرف","সুপারভাইজারের সাথে আসল গাড়িতে")},
  {t:"prac",id:"exterior",name:$("التطبيق العملي: الغسيل الخارجي","হাতে-কলমে: বাইরের ধোয়া"),icon:"bodysponge",sub:$("على سيارة حقيقية مع المشرف","সুপারভাইজারের সাথে আসল গাড়িতে")}];
// state: {best:{[modId]:pct}, finalPass:bool, pracPass:{interior:bool, exterior:bool}}
export const stationDone=(s,st)=>s.t==="mod"?(st.best[s.id]??0)>=CFG.passMark:s.t==="final"?!!st.finalPass:!!(st.pracPass&&st.pracPass[s.id]);
export const curIdx=st=>{const i=PATH.findIndex(s=>!stationDone(s,st));return i<0?PATH.length:i;};
export const doneCount=st=>PATH.filter(s=>stationDone(s,st)).length;
export const stationState=(i,st)=>{const c=curIdx(st);return i<c?"done":i===c?"now":"lock";};
export const idxOf=(t,id)=>PATH.findIndex(s=>s.t===t&&s.id===id);
export const modsDone=st=>MODS.filter(m=>(st.best[m.id]??0)>=CFG.passMark).length;
export const certified=st=>curIdx(st)>=PATH.length;
// 0 وحدات، 1 اختبار، 2 عملي، 3 معتمد
export function stage(st){if(modsDone(st)<MODS.length)return 0;if(!st.finalPass)return 1;if(!(st.pracPass&&st.pracPass.interior&&st.pracPass.exterior))return 2;return 3;}

/* ===== الاختبار ===== */
// النقاط: اختيار/صح-خطأ = 1؛ التوصيل والترتيب = 2 (بلا خطأ 2، حتى خطأين 1، أكثر 0)
export const maxPoints=q=>(q.type==="match"||q.type==="order")?2:1;
export const pointsFor=(type,err)=>(type==="match"||type==="order")?(err===0?2:err<=2?1:0):(err===0?1:0);
export function buildFinal(){
  return MODS.flatMap(m=>{const all=m.build();const n=m.id==="towels"?4:WASH[m.id]?4:2;
    return[...all.filter(q=>q.type==="order").slice(0,WASH[m.id]?1:0),...pick(all.filter(q=>q.type==="mcq"||q.type==="tf"),n)];});
}
// أسئلة اليوم الخمسة: الأكثر خطأً أولاً (miss: {[why.ar]: {n}})
export function buildDaily(miss={}){
  const pool=MODS.flatMap(m=>m.build()).filter(q=>q.type==="mcq"||q.type==="tf");
  const w=q=>((miss[q.why.ar]&&miss[q.why.ar].n)||0)*3+rnd();
  return shuffle([...pool].sort((a,b)=>w(b)-w(a)).slice(0,5));
}
export const buildQuiz=(modId,miss)=>modId==="final"?buildFinal():modId==="daily"?buildDaily(miss):MODS.find(m=>m.id===modId).build();
// النتيجة: النجاح 85%؛ الشامل يشترط 100% في أسئلة المناشف (CFG.critical)
// qs: الأسئلة · pts: النقاط المحصّلة · log: [{topic, why}] للأخطاء
export function quizResult(modId,qs,pts,log=[]){
  const max=qs.reduce((a,q)=>a+maxPoints(q),0);
  const pct=max?Math.round(pts/max*100):0,by={};
  qs.forEach(q=>{by[q.topic]=by[q.topic]||{n:0,bad:0};by[q.topic].n++;});
  log.forEach(l=>{if(by[l.topic])by[l.topic].bad++;});
  const tp={};Object.keys(by).forEach(t=>{tp[t]=Math.round((by[t].n-by[t].bad)/by[t].n*100);});
  const pass=pct>=CFG.passMark&&(modId!=="final"||CFG.critical.every(c=>!by[c]||tp[c]===100));
  return{modId,pct,pts,max,pass,by,tp,log};
}

/* ===== تقييم المشرف ===== */
// marks: {s0..sN: 2 متقن | 1 يحتاج تحسين | 0 لم يُنفَّذ} · rules: {r0..r3: 1 التزم | 0 خالف}
// النتيجة = مجموع الخطوات ÷ (عدد الخطوات × 2)؛ النجاح ≥ 85% وبلا «لم يُنفَّذ» وبلا «خالف»
export function evalResult(W,marks={},rules={}){
  const steps=allSteps(W);
  const missing=steps.some((_,i)=>marks["s"+i]==null)||W.rules.some((_,i)=>rules["r"+i]==null);
  const sum=steps.reduce((a,_,i)=>a+(marks["s"+i]||0),0),pct=Math.round(sum/(steps.length*2)*100);
  const skipped=steps.filter((_,i)=>marks["s"+i]===0),weak=steps.filter((_,i)=>marks["s"+i]===1),broken=W.rules.filter((_,i)=>rules["r"+i]===0);
  const pass=!missing&&pct>=CFG.passMark&&!skipped.length&&!broken.length;
  return{pct,pass,missing,skipped:skipped.map(s=>s.t.ar),weak:weak.map(s=>s.t.ar),broken:broken.map(r=>r.r.ar)};
}

/* ===== الحالة من سجلات القاعدة ===== */
// attempts: [{module, pct, pass, mistakes:[{topic, why}], created_at}] · practicals: [{kind, mode, pass, created_at}]
export function stateFrom(attempts=[],practicals=[]){
  const best={};
  attempts.forEach(a=>{if(MODS.some(m=>m.id===a.module))best[a.module]=Math.max(best[a.module]??0,a.pct);});
  const finalPass=attempts.some(a=>a.module==="final"&&a.pass);
  const pracPass={interior:practicals.some(p=>p.kind==="interior"&&p.mode==="sup"&&p.pass),exterior:practicals.some(p=>p.kind==="exterior"&&p.mode==="sup"&&p.pass)};
  return{best,finalPass,pracPass};
}
// خريطة الأخطاء: كل خطأ يزيد العدّاد، والإجابة الصحيحة لاحقاً على النقطة نفسها تُنقصه (كما في الأكاديمية الأصلية).
// mistakes في المحاولة بترتيب الأسئلة: الخطأ {topic, why} والصحيح {right:true, k: why.ar}
export function missFrom(attempts=[]){
  const miss={};
  [...attempts].sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))).forEach(a=>{
    (a.mistakes||[]).forEach(m=>{
      if(m&&m.right){const k=m.k;if(miss[k]){miss[k].n=Math.max(0,miss[k].n-1);if(!miss[k].n)delete miss[k];}return;}
      const k=m&&m.why&&m.why.ar;if(!k)return;const e=miss[k]||{n:0,why:m.why,topic:m.topic};e.n++;e.at=a.created_at;miss[k]=e;});
  });
  return miss;
}
// الأخطاء فقط (بلا علامات الصحيح) — للعرض
export const wrongsOf=a=>(a&&a.mistakes||[]).filter(m=>m&&!m.right&&m.why);
export const topMiss=(miss,n)=>Object.values(miss).filter(m=>m.n>0).sort((a,b)=>b.n-a.n||String(b.at||"").localeCompare(String(a.at||""))).slice(0,n);
// سلسلة الأيام: أيام متتالية فيها «أسئلة اليوم» تنتهي اليوم أو أمس
export function dailyStreak(dates=[],today=new Date().toISOString().slice(0,10)){
  const set=new Set(dates.map(d=>String(d).slice(0,10)));
  const day=(s,n)=>{const d=new Date(s+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  let cur=set.has(today)?today:set.has(day(today,-1))?day(today,-1):null,n=0;
  while(cur&&set.has(cur)){n++;cur=day(cur,-1);}
  return{streak:n,doneToday:set.has(today)};
}

/* ===== مقاطع الفيديو: كل مرحلة من الملف الأصلي بتوقيتها (ثوانٍ) ===== */
export const CLIPS={
  in1:{file:"interior",from:0,to:199},in2:{file:"interior",from:199,to:274},in3:{file:"interior",from:274,to:405},
  ex1:{file:"exterior1",from:0,to:179},ex2:{file:"exterior1",from:179,to:299},ex3:{file:"exterior1",from:299,to:418},
  ex4:{file:"exterior2",from:0,to:179},ex5:{file:"exterior2",from:179,to:294},ex6:{file:"exterior2",from:294,to:464},ex7:{file:"exterior2",from:464,to:584},
};
export const VIDEO_FILES=[{key:"interior",name:$("الغسيل الداخلي","ভেতরের পরিষ্কার")},{key:"exterior1",name:$("الغسيل الخارجي 1","বাইরের ধোয়া ১")},{key:"exterior2",name:$("الغسيل الخارجي 2","বাইরের ধোয়া ২")}];
export const fmtTime=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
