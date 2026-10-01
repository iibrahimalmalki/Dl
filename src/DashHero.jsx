// بطل لوحة القيادة: الغسلات الصافية (عدّاد متحرك) + مؤشر الالتزام الميداني + المؤشرات الأساسية للفترة المشتركة
// بيانات حقيقية فقط: ops_daily لليوم/الأسبوع، ops_biker_month للشهر/الربع، field_rounds للالتزام.
import{useMemo}from"react";
import Icon from"./Icon";
import{AnimatedNumber,Gauge}from"./ui";
import{periodRange,PeriodSelector}from"./period";
import{bikerScore}from"./scorecard";
import{complaintPct}from"./payrollEngine";

const MA=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const dAr=s=>{const[y,m,d]=s.split("-").map(Number);return`${d} ${MA[m-1]}`;};
const rangeAr=r=>r.k==="day"?`${dAr(r.from)} ${r.from.slice(0,4)}`:r.k==="month"?`${MA[+r.to.slice(5,7)-1]} ${r.to.slice(0,4)}`:`${dAr(r.from)} — ${dAr(r.to)} ${r.to.slice(0,4)}`;
const pctDelta=(c,p)=>c==null||p==null||!p?null:Math.round((c-p)/Math.abs(p)*1000)/10;

// يحسب مؤشرات نطاق واحد
function measure(d,r){
  const monthly=r.k==="month"||r.k==="quarter";
  const inDays=x=>x>=r.from&&x<=r.to;
  const ops=d.ops.filter(o=>o.sweater_id!=null&&r.months.includes(o.period));
  let washes,rating=null,cPct=null,commission=null;
  if(monthly){
    washes=ops.reduce((a,o)=>a+(Number(o.net_washes)||0),0);
    const rated=ops.filter(o=>Number(o.rating)>0&&Number(o.net_washes)>0);const rw=rated.reduce((a,o)=>a+Number(o.net_washes),0);
    rating=rw?rated.reduce((a,o)=>a+Number(o.rating)*Number(o.net_washes),0)/rw:null;
    cPct=washes?complaintPct(ops.reduce((a,o)=>a+(Number(o.approved_complaints)||0),0),washes):null;
    commission=ops.length?ops.reduce((a,o)=>{const s=bikerScore(o);return a+s.bonusBase+s.production;},0):null;
  }else{
    const days=(d.daily||[]).filter(x=>x.day&&inDays(String(x.day).slice(0,10)));
    washes=days.length?days.reduce((a,x)=>a+(Number(x.washes)||0),0):null;
    const q=days.filter(x=>Number(x.avg_quality)>0&&Number(x.avg_quality)<=5&&Number(x.washes)>0);const qw=q.reduce((a,x)=>a+Number(x.washes),0);
    rating=qw?q.reduce((a,x)=>a+Number(x.avg_quality)*Number(x.washes),0)/qw:null;
  }
  const rounds=(d.rounds||[]).filter(x=>x.compliance_pct!=null&&x.status!=="requested"&&(x.round_date?inDays(String(x.round_date).slice(0,10)):(monthly&&r.months.includes(x.period))));
  const compliance=rounds.length?Math.round(rounds.reduce((a,x)=>a+Number(x.compliance_pct),0)/rounds.length*10)/10:null;
  return{washes,rating,cPct,commission,compliance,nRounds:rounds.length,monthly};
}

export default function DashHero({d,period,onPeriod,onNav}){
  const m=useMemo(()=>{
    if(!d)return null;
    const lastDay=(d.daily||[]).map(x=>String(x.day||"").slice(0,10)).filter(Boolean).sort().pop();
    const lastP=d.ops.map(o=>o.period).filter(Boolean).sort().pop();
    const monthly=period==="month"||period==="quarter";
    // المرساة: آخر يوم بيانات (يومي) أو آخر يوم من آخر شهر بيانات (شهري)
    const anchor=monthly?(lastP?(()=>{const[y,mo]=lastP.split("-").map(Number);return`${lastP}-${String(new Date(y,mo,0).getDate()).padStart(2,"0")}`;})():lastDay):(lastDay||(lastP&&lastP+"-28"));
    if(!anchor)return{empty:true};
    const r=periodRange(period,anchor);
    const cur=measure(d,r),prev=measure(d,{...r.prev,k:r.k});
    return{r,cur,prev,lastDay,lastP};
  },[d,period]);
  if(!m)return null;
  const head=(<div className="dh-hero-top">
    <div><div className="dh-hero-k"><Icon n="operations" s={14}/> الغسلات الصافية · الفريق</div>
      {m.r&&<div className="dh-hero-r">{rangeAr(m.r)}{m.r.k==="day"||m.r.k==="week"?<span> · آخر بيانات يومية متاحة</span>:null}</div>}</div>
    <PeriodSelector value={period} onChange={onPeriod}/>
  </div>);
  if(m.empty)return<section className="g-card dh-hero" aria-label="ملخص الفترة">{head}<p className="dh-hero-na">لا بيانات عمليات بعد — ارفع تقرير سويتر في العمليات اليومية.</p></section>;
  const{cur,prev}=m;
  const dW=pctDelta(cur.washes,prev.washes);
  const Delta=({v,inv,unit="%",abs})=>v==null?<span className="dh-hd n">— لا مقارنة</span>:<span className={"dh-hd "+(v===0?"n":((v>0)!==!!inv)?"up":"down")}>{v>0?"▲":v<0?"▼":"■"} {Math.abs(v)}{unit}{abs?"":" عن الفترة السابقة"}</span>;
  const mini=[
    {t:"متوسط التقييم",ic:"star",v:cur.rating,f:x=>x.toFixed(2),dl:cur.rating!=null&&prev.rating!=null?Math.round((cur.rating-prev.rating)*100)/100:null,unit:"",tone:cur.rating==null?"":cur.rating>=4.5?"ok":cur.rating>=4?"warn":"bad",go:"performance",note:!cur.monthly?"من جودة التقرير اليومي":null},
    {t:"نسبة الشكاوى",ic:"complaints",v:cur.cPct,f:x=>x.toFixed(2)+"%",dl:cur.cPct!=null&&prev.cPct!=null?Math.round((cur.cPct-prev.cPct)*100)/100:null,unit:"",inv:true,tone:cur.cPct==null?"":cur.cPct<1?"ok":cur.cPct<=2?"warn":"bad",go:"complaints",note:!cur.monthly?"تُحسب شهرياً":null},
    {t:"العمولة المتوقعة",ic:"cash",v:cur.commission,f:x=>Math.round(x).toLocaleString("en-US")+" ﷼",dl:pctDelta(cur.commission,prev.commission),unit:"%",go:"performance",note:!cur.monthly?"تُحسب شهرياً":"HR-POL-003"},
  ];
  return(<section className="g-card dh-hero" aria-label="ملخص الفترة">
    {head}
    <div className="dh-hero-body">
      <div className="dh-hero-main">
        <div className="dh-hero-n">{cur.washes==null?"—":<AnimatedNumber value={cur.washes}/>}</div>
        <Delta v={dW}/>
      </div>
      <button type="button" className="dh-hero-g" onClick={()=>onNav&&onNav("field_rounds")} aria-label="الالتزام الميداني — فتح الجولات">
        <Gauge value={cur.compliance} label="الالتزام الميداني" size={132} sub={cur.nRounds?`${cur.nRounds} جولة في الفترة`:"لا جولات في الفترة"}/>
      </button>
      <div className="dh-hero-mini">
        {mini.map(x=><button type="button" key={x.t} className="dh-hm-i" onClick={()=>onNav&&onNav(x.go)}>
          <span className="dh-hm-l"><Icon n={x.ic} s={13}/> {x.t}</span>
          <b className={x.tone?"t-"+x.tone:""}>{x.v==null?"—":<AnimatedNumber value={x.v} format={x.f} decimals={2}/>}</b>
          {x.v!=null&&x.dl!=null?<Delta v={x.dl} inv={x.inv} unit={x.unit} abs/>:<small>{x.note||"—"}</small>}
        </button>)}
      </div>
    </div>
  </section>);
}
