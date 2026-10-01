// منطق مساعد العمليات — دوال نقية فوق بيانات لوحة القيادة (بلا LLM، بلا أرقام وهمية)
import{bikerScore}from"./scorecard";
import{daysLeft,docStatus,dayText}from"./renewalsLib";

// شخصية المساعد — غيّر الاسم والدور من هنا فقط
export const ASSISTANT={name:"رغوة",role:"مساعدة العمليات",tagline:"أتابع الجولات والوثائق والأداء وأقترح الخطوة التالية"};

const num=v=>Number(v)||0;
const sid=v=>String(v==null?"":v).trim();
export const lastPeriod=ops=>(ops||[]).map(o=>o.period).filter(Boolean).sort().pop()||null;

// من يحتاج جولة: لا جولة منذ ≥ staleDays، أو آخر التزام < 80%، أو لم يُزر قط — مرتّبين بالأولوية
export function needsRound(ops,rounds,{today=new Date(),staleDays=30,limit=5}={}){
  const lp=lastPeriod(ops);if(!lp)return[];
  const active=(ops||[]).filter(o=>o.period===lp&&o.sweater_id!=null);
  const t=new Date(today);t.setHours(0,0,0,0);
  const last={};(rounds||[]).filter(r=>r.status!=="requested"&&r.sweater_id!=null&&r.round_date).forEach(r=>{const k=sid(r.sweater_id);if(!last[k]||r.round_date>last[k].round_date)last[k]=r;});
  return active.map(o=>{
    const r=last[sid(o.sweater_id)];
    const age=r?Math.round((t-new Date(String(r.round_date).slice(0,10)+"T00:00:00"))/86400000):null;
    const pct=r&&r.compliance_pct!=null?num(r.compliance_pct):null;
    const why=!r?"لم تُجرَ له جولة بعد":pct!=null&&pct<80?`آخر التزام ${pct}%`:age>=staleDays?`آخر جولة قبل ${age} يوماً`:null;
    const score=!r?1000:(pct!=null&&pct<80?500+(80-pct)*5:0)+(age||0);
    return{sid:sid(o.sweater_id),name:o.biker_name||"",age,pct,why,score};
  }).filter(x=>x.why).sort((a,b)=>b.score-a.score).slice(0,limit);
}

// الأقرب لمكافأة الإنتاج في آخر شهر (تقييم ≥ 4 شرط المحرّك)
export function nearestBonus(ops,{limit=5}={}){
  const lp=lastPeriod(ops);if(!lp)return[];
  return(ops||[]).filter(o=>o.period===lp&&o.sweater_id!=null).map(o=>{const s=bikerScore(o);return{sid:sid(o.sweater_id),name:o.biker_name||"",washes:s.washes,rating:s.rating,next:s.nextProduction};})
    .filter(x=>x.next&&x.rating>=4).sort((a,b)=>a.next.gap-b.next.gap).slice(0,limit);
}

// الوثائق السارية التي تنتهي خلال maxDays (والمنتهية) — الأقرب أولاً
export function docsDue(docs,{maxDays=14,limit=6,today=new Date()}={}){
  return(docs||[]).filter(x=>x.active!==false&&x.end_date).map(x=>({...x,_d:daysLeft(x.end_date,today)}))
    .filter(x=>x._d!=null&&x._d<=maxDays).sort((a,b)=>a._d-b._d).slice(0,limit)
    .map(x=>({...x,status:docStatus(x._d),text:dayText(x._d)}));
}

// نسبة الأتمتة من audit_log: تغييرات بلا مستخدم (من القاعدة/الجدولة) ÷ كل التغييرات
export function automationShare(auto,total){
  const a=num(auto),t=num(total);if(!t)return null;
  return{auto:a,manual:Math.max(0,t-a),total:t,pct:Math.round(a/t*1000)/10};
}

const greet=h=>h<12?"صباح الخير":h<17?"مساء الخير":"مساء النور";
// الملخّص اليومي بصياغة بشرية — كل جملة من بيانات فعلية، وتُحذف إن لم تتوفر بياناتها
export function dailyBrief({ops,rounds,docs,screq},{today=new Date(),name=""}={}){
  const out=[];const lp=lastPeriod(ops);
  out.push(`${greet(today.getHours())}${name?" "+name:""} 👋`);
  if(lp){
    const cur=(ops||[]).filter(o=>o.period===lp);const w=cur.reduce((a,o)=>a+num(o.net_washes),0);
    const prevP=(ops||[]).map(o=>o.period).filter(p=>p<lp).sort().pop();
    const pw=prevP?(ops||[]).filter(o=>o.period===prevP).reduce((a,o)=>a+num(o.net_washes),0):null;
    const d=pw?Math.round((w-pw)/pw*100):null;
    out.push(`الفريق أنجز ${w.toLocaleString("en-US")} غسلة في آخر شهر مسجّل${d!=null?` — ${d>=0?"أعلى":"أقل"} بـ ${Math.abs(d)}% من الشهر الذي قبله`:""}.`);
  }
  const nr=needsRound(ops,rounds,{today,limit:50});
  if(nr.length)out.push(`${nr.length} بايكر ${nr.length>2&&nr.length<11?"يحتاجون":"يحتاج"} جولة ميدانية، أوّلهم ${nr[0].name||"#"+nr[0].sid} (${nr[0].why}).`);
  const dd=docsDue(docs,{today,limit:50});const exp=dd.filter(x=>x._d<0).length;
  if(dd.length)out.push(`${dd.length} وثيقة تنتهي خلال 14 يوماً${exp?`، منها ${exp} منتهية`:""} — الأقرب: ${dd[0].doc_type} لـ ${dd[0].subject} (${dd[0].text}).`);
  const nb=nearestBonus(ops,{limit:1});
  if(nb.length)out.push(`${nb[0].name||"#"+nb[0].sid} على بُعد ${nb[0].next.gap} غسلة من مكافأة ${nb[0].next.bonus} ريال.`);
  const open=(screq||[]).filter(r=>r.status&&!["completed","closed","done"].includes(String(r.status))).length;
  if(open)out.push(`${open} طلب إمداد مفتوح ينتظر الإغلاق.`);
  if(out.length===1)out.push("لا شيء عاجل الآن — كل المؤشرات المسجّلة ضمن النطاق.");
  return out;
}

// ملخص الشهر النصي (للنسخ/واتساب)
export function monthSummary({ops,rounds,docs},{today=new Date()}={}){
  const lp=lastPeriod(ops);if(!lp)return"لا بيانات عمليات بعد.";
  const cur=(ops||[]).filter(o=>o.period===lp&&o.sweater_id!=null).map(o=>bikerScore(o));
  const w=cur.reduce((a,s)=>a+s.washes,0);const rated=cur.filter(s=>s.rating>0&&s.washes>0);const rw=rated.reduce((a,s)=>a+s.washes,0);
  const rating=rw?rated.reduce((a,s)=>a+s.rating*s.washes,0)/rw:0;const compl=cur.reduce((a,s)=>a+s.complaints,0);
  const comm=cur.reduce((a,s)=>a+s.bonusBase+s.production,0);const prod=cur.filter(s=>s.production>0).length;
  const rr=(rounds||[]).filter(r=>r.compliance_pct!=null&&String(r.period||String(r.round_date||"").slice(0,7))===lp);
  const comp=rr.length?Math.round(rr.reduce((a,r)=>a+num(r.compliance_pct),0)/rr.length):null;
  const top=cur.slice().sort((a,b)=>b.washes-a.washes)[0];
  const dd=docsDue(docs,{today,limit:99});
  return[`📊 ملخص ${lp} — دلو ورغوة`,
    `• الغسلات الصافية: ${w.toLocaleString("en-US")} (${cur.length} بايكر)`,
    `• متوسط التقييم: ${rating?rating.toFixed(2):"—"} · الشكاوى المعتمدة: ${compl} (${w?(compl/w*100).toFixed(2):"0"}%)`,
    `• الالتزام الميداني: ${comp!=null?comp+"%":"—"} (${rr.length} جولة)`,
    `• العمولة المتوقعة (HR-POL-003): ${Math.round(comm).toLocaleString("en-US")} ﷼ · ${prod} مستحق لمكافأة الإنتاج`,
    top?`• الأعلى إنتاجية: ${top.name||"#"+top.sid} (${top.washes})`:null,
    dd.length?`• وثائق تنتهي خلال 14 يوماً: ${dd.length}`:null,
  ].filter(Boolean).join("\n");
}
