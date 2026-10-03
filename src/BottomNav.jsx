// شريط التنقّل السفلي للجوال (≤640px): أهم أربع صفحات + «المزيد» يفتح القائمة الجانبية
import Icon from"./Icon";

export const BOTTOM_ITEMS=[
  {k:"dashboard",ar:"الرئيسية",ic:"dashboard"},
  {k:"operations",ar:"العمليات",ic:"operations"},
  {k:"field_rounds",ar:"الجولات",ic:"rounds"},
  {k:"performance",ar:"الأداء",ic:"performance"},
];

// navItems: عناصر NAV من الهيكل — يُؤخذ منها الاسم القصير (sh) فيبقى اسم الصفحة واحداً في الشريط السفلي والقائمة الجانبية
// items: قائمة بديلة للعناصر (بوابة البايكر) — كل عنصر {k,ar,ic,bn?}
export default function BottomNav({active,allowed,onGo,onMore,badges={},navItems,items:own}){
  const label=x=>{const n=(navItems||[]).find(i=>i.k===x.k);return n?(n.sh||n.ar):x.ar;};
  const items=(own||BOTTOM_ITEMS).filter(x=>!allowed||allowed.includes(x.k)).map(x=>({...x,ar:label(x)}));
  const inBar=items.some(x=>x.k===active);
  return(<nav className="g-bnav" aria-label="التنقّل السريع">
    {items.map(x=><button key={x.k} type="button" className={"g-bnav-i"+(active===x.k?" on":"")} aria-current={active===x.k?"page":undefined} onClick={()=>onGo(x.k)}>
      <span className="g-bnav-ic"><Icon n={x.ic} s={20}/>{badges[x.k]?<i className="g-bnav-b">{badges[x.k]>9?"9+":badges[x.k]}</i>:null}</span><span>{x.ar}</span>{x.bn?<span className="g-bnav-bn" lang="bn">{x.bn}</span>:null}</button>)}
    <button type="button" className={"g-bnav-i"+(!inBar?" on":"")} onClick={onMore} aria-label="المزيد — كل الصفحات"><span className="g-bnav-ic"><Icon n="menu" s={20}/></span><span>المزيد</span>{own?<span className="g-bnav-bn" lang="bn">আরও</span>:null}</button>
  </nav>);
}
