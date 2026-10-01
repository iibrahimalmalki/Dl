// مخططات بطاقة الأداء كنصوص SVG (تُستخدم في الصفحة وفي PDF/الصور) — بلا مكتبات
// pal: ألوان قابلة للتمرير (متغيّرات CSS في الواجهة، وقيم صريحة في التصدير)
export const PAL_UI={bar:"var(--a)",best:"var(--p)",zero:"var(--bad)",empty:"var(--track)",grid:"var(--line)",txt:"var(--mut)",avg:"var(--info)"};
export const PAL_PRINT={bar:"#F5A35F",best:"#E8712B",zero:"#F04438",empty:"#EEF0F4",grid:"#E5E7EB",txt:"#64748B",avg:"#2563EB"};

const daysInMonth=p=>{const[y,m]=String(p).split("-").map(Number);return y&&m?new Date(y,m,0).getDate():31;};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

// أعمدة الغسلات اليومية لكل أيام الشهر: أفضل يوم مميّز، أيام الصفر بعلامة حمراء، الأيام بلا بيانات خافتة
export function dailySVG(days,period,{pal=PAL_UI,width=640,height=150,avg=null}={}){
  const n=daysInMonth(period);const map={};(days||[]).forEach(d=>{map[Number(String(d.date).slice(8,10))]=d.n;});
  const max=Math.max(1,...Object.values(map));const best=Object.entries(map).reduce((m,[k,v])=>v>(m?m[1]:0)?[k,v]:m,null);
  const padL=24,padB=18,padT=12,W=width-padL-4,H=height-padB-padT,bw=W/n;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" style="display:block;font-family:inherit" role="img" aria-label="الغسلات اليومية">`;
  [0,0.5,1].forEach(f=>{const y=padT+H-H*f;s+=`<line x1="${padL}" x2="${width-4}" y1="${y}" y2="${y}" style="stroke:${pal.grid}" stroke-width="1"/><text x="${padL-4}" y="${y+3}" font-size="9" text-anchor="end" style="fill:${pal.txt}">${Math.round(max*f)}</text>`;});
  for(let d=1;d<=n;d++){
    const v=map[d];const x=padL+(d-1)*bw+bw*0.15,w=bw*0.7;
    if(v==null){s+=`<rect x="${x}" y="${padT+H-3}" width="${w}" height="3" rx="1" style="fill:${pal.empty}"/>`;}
    else if(v===0){s+=`<rect x="${x}" y="${padT+H-4}" width="${w}" height="4" rx="1" style="fill:${pal.zero}"><title>${d}: 0</title></rect>`;}
    else{const h=Math.max(2,H*v/max);const isB=best&&+best[0]===d;s+=`<rect x="${x}" y="${padT+H-h}" width="${w}" height="${h}" rx="${Math.min(3,w/2)}" style="fill:${isB?pal.best:pal.bar}"><title>${d}: ${v}</title></rect>`;
      if(isB)s+=`<text x="${x+w/2}" y="${padT+H-h-3}" font-size="9" font-weight="700" text-anchor="middle" style="fill:${pal.best}">${v}</text>`;}
    if(d===1||d%5===0)s+=`<text x="${x+w/2}" y="${height-5}" font-size="9" text-anchor="middle" style="fill:${pal.txt}">${d}</text>`;
  }
  if(avg){const y=padT+H-H*avg/max;s+=`<line x1="${padL}" x2="${width-4}" y1="${y}" y2="${y}" style="stroke:${pal.avg}" stroke-width="1" stroke-dasharray="4 3"/><text x="${padL+4}" y="${y-3}" font-size="9" text-anchor="start" style="fill:${pal.avg}">${esc("متوسط "+avg)}</text>`;}
  return s+"</svg>";
}

// خط اتجاه صغير — values مرتّبة زمنياً (null = لا بيانات)
export function sparkSVG(values,{color="var(--p)",width=120,height=34,fill=true}={}){
  const v=(values||[]).map(x=>x==null?null:Number(x));const pts=v.map((y,i)=>y==null?null:[i,y]).filter(Boolean);
  if(pts.length<2)return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"></svg>`;
  const ys=pts.map(p=>p[1]);const mn=Math.min(...ys),mx=Math.max(...ys),rg=(mx-mn)||1;const n=Math.max(1,v.length-1);
  const xy=pts.map(([i,y])=>[2+(width-4)*i/n,(height-4)-((y-mn)/rg)*(height-8)+2]);
  const line=xy.map(p=>p.map(c=>c.toFixed(1)).join(",")).join(" ");
  const last=xy[xy.length-1];
  const area=fill?`<polygon points="${xy[0][0].toFixed(1)},${height} ${line} ${last[0].toFixed(1)},${height}" style="fill:${color}" opacity=".12"/>`:"";
  return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${area}<polyline points="${line}" style="fill:none;stroke:${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.6" style="fill:${color}"/></svg>`;
}
