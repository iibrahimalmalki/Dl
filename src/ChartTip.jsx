// تلميح مخططات صالح للّمس: يلفّ أي مخطط (SVG أو HTML) ويقرأ النص من أقرب عنصر يحمل data-tip تحت المؤشر/الإصبع.
// اللمس: نقرة تُظهر التلميح وتبقيه، والسحب أفقياً ينتقل بين الأعمدة، ونقرة خارج المخطط تُخفيه.
// الفأرة: يتبع المؤشر. لوحة المفاتيح: الأسهم تتنقّل بين العناصر ذات data-tip (والقارئ يقرأ النص عبر aria-live).
import{useState,useRef,useEffect,useCallback}from"react";

export default function ChartTip({children,className,label}){
  const ref=useRef(null);const[tip,setTip]=useState(null);const idx=useRef(-1);const active=useRef(null);
  const mark=el=>{if(active.current&&active.current!==el)active.current.removeAttribute("data-active");if(el)el.setAttribute("data-active","");active.current=el;};
  const hide=useCallback(()=>{mark(null);setTip(null);idx.current=-1;},[]);
  const showFor=(el,x,y)=>{const box=ref.current.getBoundingClientRect();
    if(x==null){const r=el.getBoundingClientRect();x=r.left+r.width/2;y=r.top;}
    mark(el);setTip({x:Math.max(8,Math.min(box.width-8,x-box.left)),y:Math.max(0,y-box.top),text:el.getAttribute("data-tip")});};
  const pick=e=>{const el=e.target&&e.target.closest?e.target.closest("[data-tip]"):null;
    if(!el||!ref.current.contains(el)){if(e.pointerType==="mouse")hide();return;}
    showFor(el,e.clientX,e.clientY);};
  useEffect(()=>{const out=e=>{if(ref.current&&!ref.current.contains(e.target))hide();};document.addEventListener("pointerdown",out);return()=>document.removeEventListener("pointerdown",out);},[hide]);
  // أثناء السحب باللمس نحدّد العنصر تحت الإصبع (pointer capture يثبّت target على العنصر الأول)
  const move=e=>{if(e.pointerType==="touch"){const el=document.elementFromPoint(e.clientX,e.clientY);if(el)pick({...e,target:el,pointerType:"touch",clientX:e.clientX,clientY:e.clientY});}else pick(e);};
  const key=e=>{const els=[...ref.current.querySelectorAll("[data-tip]")];if(!els.length)return;
    const dir=e.key==="ArrowLeft"?-1:e.key==="ArrowRight"?1:0;if(!dir){if(e.key==="Escape")hide();return;}
    e.preventDefault();idx.current=(idx.current+dir+els.length)%els.length;showFor(els[idx.current]);};
  return(<div ref={ref} className={"g-ctip"+(className?" "+className:"")} onPointerMove={move} onPointerDown={pick} onPointerLeave={e=>{if(e.pointerType==="mouse")hide();}}
    tabIndex={0} role="group" aria-label={label||"مخطط — استخدم الأسهم لاستعراض القيم"} onKeyDown={key} onBlur={hide}>
    {children}
    {tip&&<div className="g-ctip-b" style={{insetInlineStart:"auto",left:tip.x,top:tip.y}} role="status" aria-live="polite">{tip.text}</div>}
  </div>);
}
