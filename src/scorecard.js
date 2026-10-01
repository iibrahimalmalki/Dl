// بطاقة أداء البايكر الشهرية — دوال نقية فوق محرّك العمولة HR-POL-003 (payrollEngine.js).
// لا عتبات هنا: كل ريال/مكافأة يُحسب بدوال المحرّك؛ «الهدف التالي» يُستخرج بفحص المحرّك نفسه.
import{bikerQualityRiyal,bikerSafetyRiyal,productionBonus,complaintPct,LEVELS}from"./payrollEngine";

const r2=n=>Math.round((Number(n)||0)*100)/100;
const num=v=>Number(v)||0;

export const LEVEL_AR={M1:"المستوى الأول",M2:"المستوى الثاني",M3:"المستوى الثالث",M4:"المستوى الرابع",M5:"المستوى الخامس"};
export const LEVEL_BN={M1:"লেভেল ১",M2:"লেভেল ২",M3:"লেভেল ৩",M4:"লেভেল ৪",M5:"লেভেল ৫"};
export const levelOf=l=>LEVELS[l]?l:"M1";

// daily: {YYYY-MM-DD: washes} (كائن أو نص JSON)
export function parseDaily(daily){
  let d=daily;
  if(typeof d==="string"){try{d=JSON.parse(d);}catch(_){d=null;}}
  if(!d||typeof d!=="object")return[];
  return Object.entries(d).map(([date,n])=>({date,n:num(n)})).sort((a,b)=>a.date<b.date?-1:1);
}

// عتبات المكافأة/الجودة تُكتشف من المحرّك (أول قيمة تتغيّر عندها النتيجة)
const PROD_STEPS=(()=>{const out=[];let prev=productionBonus(0,5);for(let w=1;w<=400;w++){const b=productionBonus(w,5);if(b!==prev){out.push({target:w,bonus:b});prev=b;}}return out;})();
const QUAL_STEPS=(()=>{const out=[];let prev=bikerQualityRiyal(0);for(let i=0;i<=500;i++){const r=i/100;const q=bikerQualityRiyal(r);if(q!==prev){out.push({rating:r,riyal:q});prev=q;}}return out;})();
// درجات السلامة: لكل ريال أعلى نسبة شكاوى (بدقة 0.01) تحافظ عليه
const SAFE_STEPS=(()=>{const m={};for(let i=0;i<=1000;i++){const p=i/100;const s=bikerSafetyRiyal(p);m[s]=p;}return Object.entries(m).map(([riyal,maxPct])=>({riyal:+riyal,maxPct})).sort((a,b)=>a.riyal-b.riyal);})();

export function nextProductionOf(washes){
  const w=num(washes);const s=PROD_STEPS.find(x=>x.target>w);
  return s?{target:s.target,gap:s.target-w,bonus:s.bonus}:null;
}
export function nextQualityOf(rating){
  const r=num(rating);const s=QUAL_STEPS.find(x=>x.rating>r+1e-9);
  return s?{needRating:s.rating,riyal:s.riyal}:null;
}
export function nextSafetyOf(pct,washes){
  const cur=bikerSafetyRiyal(pct);const s=SAFE_STEPS.find(x=>x.riyal>cur);
  if(!s)return null;
  const w=num(washes);
  return{maxPct:s.maxPct,riyal:s.riyal,maxComplaints:w?Math.floor(s.maxPct*w/100+1e-9):null};
}

// bm: صف ops_biker_month · extras: {rounds,violations,settlement,level}
export function bikerScore(bm,extras={}){
  bm=bm||{};
  const washes=num(bm.net_washes);
  const days=parseDaily(bm.daily);
  const worked=days.filter(d=>d.n>0);
  const workDays=worked.length;
  const dailyAvg=workDays?Math.round(washes/workDays*10)/10:0;
  const bestDay=worked.reduce((m,d)=>!m||d.n>m.n?{date:d.date,n:d.n}:m,null);
  const rating=num(bm.rating);
  const complaints=num(bm.approved_complaints);
  const cPct=bm.complaint_pct!=null&&bm.complaint_pct!==""?r2(bm.complaint_pct):complaintPct(complaints,washes);
  const qR=bikerQualityRiyal(rating),sR=bikerSafetyRiyal(cPct);
  const ratePerWash=r2(2+qR+sR);
  const rounds=(extras.rounds||[]).filter(r=>r&&r.status!=="requested").slice().sort((a,b)=>String(b.round_date||"").localeCompare(String(a.round_date||"")));
  const last=rounds[0];
  const fines=r2((extras.violations||[]).filter(v=>!v.status||v.status==="confirmed").reduce((a,v)=>a+num(v.fine_applied),0));
  const st=extras.settlement;
  const revenue=st&&st.orders!=null&&st.unit_price!=null?r2(num(st.orders)*num(st.unit_price)):(st&&st.net!=null?r2(st.net):null);
  return{
    sid:String(bm.sweater_id||"").trim(),name:bm.biker_name||"",period:bm.period||"",level:levelOf(extras.level),
    washes,days,workDays,dailyAvg,bestDay,zeroDays:days.filter(d=>d.n===0).map(d=>d.date),
    rating,complaints,complaintPct:cPct,qR,sR,ratePerWash,
    fixed:r2(washes*2),quality:r2(washes*qR),safety:r2(washes*sR),bonusBase:r2(washes*ratePerWash),
    production:productionBonus(washes,rating),
    nextProduction:nextProductionOf(washes),nextQuality:nextQualityOf(rating),nextSafety:nextSafetyOf(cPct,washes),
    compliance:last&&last.compliance_pct!=null?{pct:num(last.compliance_pct),effect:last.effect||null,date:last.round_date||null}:null,
    rounds:rounds.slice(0,3),fines,revenue,
  };
}

// ترتيب تنازلي بالمفتاح، وكسر التعادل بالتقييم (أعلى) ثم الشكاوى (أقل)
export function rankBikers(list,key="washes"){
  return(list||[]).slice().sort((a,b)=>(num(b[key])-num(a[key]))||(num(b.rating)-num(a.rating))||(num(a.complaintPct)-num(b.complaintPct))||(num(a.complaints)-num(b.complaints)))
    .map((s,i)=>({...s,rank:i+1}));
}

// series: قيم مرتّبة زمنياً (الأقدم ← الأحدث) — الاتجاه على آخر 3 أشهر
export function trend(series){
  const v=(series||[]).map(x=>x==null?null:num(x)).filter(x=>x!=null).slice(-3);
  if(v.length<2)return{dir:"flat",pct:0};
  const a=v[0],b=v[v.length-1];
  const pct=a?r2((b-a)/Math.abs(a)*100):(b>0?100:0);
  return{dir:pct>2?"up":pct<-2?"down":"flat",pct};
}

// فرق الشهر عن السابق
export function monthDelta(cur,prev){
  if(prev==null)return{diff:null,dir:"flat"};
  const d=r2(num(cur)-num(prev));
  return{diff:d,dir:d>0?"up":d<0?"down":"flat"};
}

export function teamSummary(scores){
  const s=scores||[];
  const washes=s.reduce((a,x)=>a+x.washes,0);
  const rated=s.filter(x=>x.rating>0&&x.washes>0);
  const rw=rated.reduce((a,x)=>a+x.washes,0);
  const comp=s.filter(x=>x.compliance);
  const complaints=s.reduce((a,x)=>a+x.complaints,0);
  return{
    bikers:s.length,washes,
    rating:rw?r2(rated.reduce((a,x)=>a+x.rating*x.washes,0)/rw):0,
    complaints,complaintPct:complaintPct(complaints,washes),
    compliance:comp.length?Math.round(comp.reduce((a,x)=>a+x.compliance.pct,0)/comp.length):null,
    bonusBase:r2(s.reduce((a,x)=>a+x.bonusBase,0)),production:s.reduce((a,x)=>a+x.production,0),
    fines:r2(s.reduce((a,x)=>a+x.fines,0)),
  };
}

// «ما يلزم للهدف التالي» — جمل قصيرة
export function nextHints(s,lang="ar"){
  const bn=lang==="bn",out=[];
  if(s.nextProduction)out.push(bn?`আরও ${s.nextProduction.gap} টি ওয়াশ → ${s.nextProduction.bonus} রিয়াল বোনাস`:`+${s.nextProduction.gap} غسلة لمكافأة ${s.nextProduction.bonus} ريال`);
  if(s.nextQuality)out.push(bn?`রেটিং ${s.nextQuality.needRating.toFixed(2)} → কোয়ালিটি ${s.nextQuality.riyal.toFixed(2)} রিয়াল`:`تقييم ${s.nextQuality.needRating.toFixed(2)} يرفع ريال الجودة إلى ${s.nextQuality.riyal.toFixed(2)}`);
  if(s.nextSafety)out.push(bn?`অভিযোগ ≤ ${s.nextSafety.maxPct}% → সেফটি ${s.nextSafety.riyal.toFixed(2)} রিয়াল`:`شكاوى ≤ ${s.nextSafety.maxPct}% ترفع ريال السلامة إلى ${s.nextSafety.riyal.toFixed(2)}`);
  return out;
}

// نص قصير للبايكر — lang: ar | bn | both
export function bikerBrief(s,lang="both"){
  const ar=[`أداؤك لشهر ${s.period}: ${s.washes} غسلة · تقييم ${s.rating.toFixed(2)} · شكاوى ${s.complaintPct}%`,
    `ريال الجودة ${s.qR.toFixed(2)} + ريال السلامة ${s.sR.toFixed(2)} ← أجر الغسلة ${s.ratePerWash.toFixed(2)} ريال (العمولة ${s.bonusBase} ريال${s.production?` + مكافأة إنتاج ${s.production}`:""})`,
    ...nextHints(s,"ar").map(h=>"• "+h)].join("\n");
  const bn=[`${s.period} মাসে আপনার কাজ: ${s.washes} টি ওয়াশ · রেটিং ${s.rating.toFixed(2)} · অভিযোগ ${s.complaintPct}%`,
    `কোয়ালিটি ${s.qR.toFixed(2)} + সেফটি ${s.sR.toFixed(2)} → প্রতি ওয়াশ ${s.ratePerWash.toFixed(2)} রিয়াল (কমিশন ${s.bonusBase} রিয়াল${s.production?` + উৎপাদন বোনাস ${s.production}`:""})`,
    ...nextHints(s,"bn").map(h=>"• "+h)].join("\n");
  return lang==="ar"?ar:lang==="bn"?bn:ar+"\n\n"+bn+"\n— دلو ورغوة";
}

// عبارة الإنجاز لبطاقة التكريم: إنتاج ← شهران متتاليان ≥200 ← الأول على الفريق ← تحفيز
export function honorPhrase(s,{prevWashes=null,isTop=false}={}){
  if(s.production>0)return{k:"production",ar:"مكافأة الإنتاج",bn:"উৎপাদন বোনাস",badge:s.production};
  const first=PROD_STEPS[0]?PROD_STEPS[0].target:200;
  if(prevWashes!=null&&num(prevWashes)>=first&&s.washes>=first)return{k:"streak",ar:"شهران متتاليان · الثبات يُكافأ",bn:"ধারাবাহিকতা পুরস্কৃত"};
  if(isTop)return{k:"top",ar:"الأول على الفريق هذا الشهر",bn:"এই মাসে দলের সেরা"};
  const n=s.nextProduction;
  return n?{k:"motivate",ar:`باقي ${n.gap} غسلة لمكافأة ${n.bonus} ريال`,bn:`বোনাসের জন্য আরও ${n.gap} টি ওয়াশ`,gap:n.gap,bonus:n.bonus}
    :{k:"motivate",ar:"واصل التميّز",bn:"এভাবেই চালিয়ে যান"};
}
