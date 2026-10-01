// بطاقة التكريم الشهرية للمشاركة (16:9 — 1280×720) — قالب HTML يُحوَّل إلى PNG عبر html2canvas
// الهوية: تدرّج #FFF7ED → #FFE6D6، برتقالي var(--p)/var(--p-700)، كونفيتي SVG، شعار brand-logo.png، خطوط IBM Plex Sans Arabic + Noto Sans Bengali
import{FONT_STACK}from"./fonts";
import{honorPhrase,monthDelta,LEVEL_AR,LEVEL_BN}from"./scorecard";
import{renderHTML,canvasBlob,shareOrDownload,downloadBlob}from"./exportKit";

const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const MA=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const ME=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const isLatin=s=>/[A-Za-z]/.test(String(s||""))&&!/[؀-ۿ]/.test(String(s||""));
const initials=s=>String(s||"?").trim().split(/\s+/).slice(0,2).map(w=>w.charAt(0)).join("").toUpperCase();

// كونفيتي حتمي (بذرة ثابتة لكل بايكر) — بلا صور خارجية
function confetti(seed){
  let x=0;for(const ch of String(seed))x=(x*31+ch.charCodeAt(0))>>>0;
  const rnd=()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296;};
  const cols=["#E8712B","#F59E0B","#FB7185","#FDBA74","#12B76A","#FFD27A"];
  let s="";
  for(let i=0;i<46;i++){
    const cx=rnd()*1280,cy=rnd()*720;if(cx>330&&cx<950&&cy>120&&cy<600)continue; // نترك الوسط نظيفاً
    const c=cols[i%cols.length],r=(rnd()*360).toFixed(0),o=(0.35+rnd()*0.5).toFixed(2);
    s+=i%3===0?`<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${(3+rnd()*5).toFixed(1)}" fill="${c}" opacity="${o}"/>`
      :`<rect x="${cx.toFixed(0)}" y="${cy.toFixed(0)}" width="${(6+rnd()*10).toFixed(0)}" height="${(3+rnd()*4).toFixed(0)}" rx="1.5" fill="${c}" opacity="${o}" transform="rotate(${r} ${cx.toFixed(0)} ${cy.toFixed(0)})"/>`;
  }
  return`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" style="position:absolute;inset:0">${s}</svg>`;
}

// s: bikerScore · o: {name,nameAr,nameLatin,photo,prev (bikerScore|null),isTop,variant:'honor'|'motivate'}
export function honorData(s,o={}){
  const prevW=o.prev?o.prev.washes:null;
  let phrase=honorPhrase(s,{prevWashes:prevW,isTop:!!o.isTop});
  if(o.variant==="motivate"&&phrase.k!=="motivate")phrase=honorPhrase({...s,production:0},{prevWashes:null,isTop:false});
  const nameLatin=o.nameLatin||(isLatin(o.name)?o.name:"");
  const nameAr=o.nameAr||(!isLatin(o.name)?o.name:"");
  return{sid:s.sid,period:s.period,washes:s.washes,rating:s.rating,production:o.variant==="motivate"?0:s.production,level:s.level,
    prevWashes:prevW,prevRating:o.prev?o.prev.rating:null,delta:monthDelta(s.washes,prevW),ratingDelta:monthDelta(s.rating,o.prev?o.prev.rating:null),
    nameAr,nameLatin,photo:o.photo||null,phrase,variant:o.variant||"honor"};
}

export function honorHTML(d){
  const site=(typeof location!=="undefined"&&location.origin)||"";
  const[y,m]=String(d.period).split("-");const mi=(+m||1)-1;
  const maxB=Math.max(d.washes,d.prevWashes||0,1);
  const bar=(v,lbl,cur)=>`<div class="bc"><b>${v==null?"—":v}</b><div class="bt"><i style="height:${v==null?4:Math.max(6,Math.round(150*v/maxB))}px;background:${cur?"linear-gradient(180deg,#F59E0B,var(--p))":"#F3C9A6"}"></i></div><span>${lbl}</span></div>`;
  const dl=d.delta.diff==null?"":`<span class="dl ${d.delta.dir}">${d.delta.dir==="up"?"▲":d.delta.dir==="down"?"▼":"■"} ${Math.abs(d.delta.diff)} <small>عن الشهر السابق</small></span>`;
  const rd=d.ratingDelta.diff==null?"":d.ratingDelta.dir==="up"?"▲":d.ratingDelta.dir==="down"?"▼":"■";
  const motiv=d.phrase.k==="motivate";
  const name=d.nameAr||d.nameLatin;
  return`<div class="hc" dir="rtl"><style>
.hc{width:1280px;height:720px;position:relative;overflow:hidden;font-family:${FONT_STACK};color:#1E293B;background:linear-gradient(135deg,#FFF7ED 0%,#FFE6D6 100%)}
.hc *{box-sizing:border-box}
.hc .glow{position:absolute;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle,rgba(232,113,43,.20),transparent 65%);top:-200px;left:330px}
.hc .ph{position:absolute;right:70px;top:110px;width:250px;height:250px;border-radius:50%;padding:9px;background:linear-gradient(135deg,#F59E0B,var(--p,#E8712B),var(--p-700,#CC5200));box-shadow:0 18px 40px -14px rgba(204,82,0,.55)}
.hc .ph div{width:100%;height:100%;border-radius:50%;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;font-size:92px;font-weight:700;color:var(--p,#E8712B)}
.hc .ph img{width:100%;height:100%;object-fit:cover}
.hc .medal{position:absolute;right:70px;top:330px;width:96px;height:96px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#FFE7A8,#F5B33A 55%,#C77A0A);border:4px solid #fff;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#5B3500;box-shadow:0 10px 22px -8px rgba(160,90,0,.6)}
.hc .medal b{font-size:30px;line-height:1;font-weight:700;direction:ltr}.hc .medal span{font-size:12px;font-weight:700}
.hc .nm{position:absolute;right:40px;top:440px;width:330px;text-align:center}
.hc .nm h2{margin:0;font-size:38px;font-weight:700;line-height:1.25;color:#1E293B}
.hc .nm p{margin:4px 0 0;font-size:22px;font-weight:500;color:#64748B;direction:ltr;letter-spacing:.5px}
.hc .nm .lv{display:inline-block;margin-top:10px;padding:5px 16px;border-radius:30px;background:#fff;border:2px solid #F3C9A6;font-size:17px;font-weight:700;color:var(--p-700,#CC5200)}
.hc .mid{position:absolute;right:420px;top:44px;width:470px;text-align:center}
.hc .kick{font-size:22px;font-weight:700;color:var(--p-700,#CC5200);height:62px;display:flex;align-items:center;justify-content:center}
.hc .big{font-size:190px;line-height:.95;font-weight:700;color:var(--p,#E8712B);direction:ltr;margin-top:6px;text-shadow:0 10px 30px rgba(232,113,43,.25)}
.hc .lbl{font-size:30px;font-weight:700;color:#1E293B;margin-top:4px}.hc .lbl span{font-family:'Noto Sans Bengali',${FONT_STACK};font-weight:600;color:#64748B;font-size:24px}
.hc .dl{display:inline-block;margin-top:12px;padding:6px 18px;border-radius:30px;font-size:22px;font-weight:700;direction:ltr;background:#fff}
.hc .dl small{font-size:15px;color:#64748B;font-weight:500;direction:rtl}
.hc .dl.up{color:#087443}.hc .dl.down{color:#B42318}.hc .dl.flat{color:#64748B}
.hc .sar{display:inline-block;transform:rotate(-4deg);padding:6px 22px;margin-bottom:4px;border-radius:18px;background:linear-gradient(135deg,#FFE7A8,#F5B33A 60%,#D48A12);color:#4A2A00;font-size:40px;font-weight:700;direction:ltr;box-shadow:0 14px 28px -10px rgba(180,110,0,.6);border:3px solid #fff}
.hc .sar small{display:block;font-size:14px;text-align:center;font-weight:700;direction:rtl;margin-top:-2px}
.hc .side{position:absolute;left:60px;top:70px;width:280px;display:flex;flex-direction:column;gap:18px}
.hc .cal{background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 14px 30px -16px rgba(30,41,59,.35);text-align:center}
.hc .cal .t{background:linear-gradient(135deg,var(--p,#E8712B),var(--p-700,#CC5200));color:#fff;font-size:18px;font-weight:700;padding:8px;letter-spacing:3px;direction:ltr}
.hc .cal b{display:block;font-size:42px;font-weight:700;padding:8px 0 0;color:#1E293B}.hc .cal span{display:block;font-size:20px;color:#64748B;padding-bottom:10px}
.hc .rate{display:flex;align-items:center;gap:14px;background:#fff;border-radius:22px;padding:12px 16px;box-shadow:0 14px 30px -16px rgba(30,41,59,.35)}
.hc .rate .st{width:74px;height:74px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#FFE9A8,#F5B33A);display:flex;align-items:center;justify-content:center;font-size:38px;color:#fff;flex:none}
.hc .rate b{font-size:44px;font-weight:700;direction:ltr;display:block;line-height:1}.hc .rate span{font-size:16px;color:#64748B;font-weight:600}
.hc .rate em{font-style:normal;font-size:20px;margin-inline-start:6px}.hc .rate em.up{color:#087443}.hc .rate em.down{color:#B42318}.hc .rate em.flat{color:#94A3B8}
.hc .bars{display:flex;gap:26px;justify-content:center;align-items:flex-end;background:#fff;border-radius:22px;padding:14px 10px 10px;box-shadow:0 14px 30px -16px rgba(30,41,59,.35)}
.hc .bc{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:15px;color:#64748B;font-weight:600}.hc .bc b{font-size:22px;color:#1E293B;direction:ltr}
.hc .bt{height:150px;display:flex;align-items:flex-end}.hc .bt i{display:block;width:54px;border-radius:12px 12px 6px 6px}
.hc .ph2{position:absolute;right:420px;top:470px;width:470px;text-align:center;padding:16px 22px;border-radius:24px;background:${motiv?"#fff":"linear-gradient(135deg,var(--p,#E8712B),var(--p-700,#CC5200))"};color:${motiv?"var(--p-700,#CC5200)":"#fff"};border:${motiv?"3px dashed #F3C9A6":"3px solid #fff"};box-shadow:0 18px 36px -18px rgba(204,82,0,.6)}
.hc .ph2 b{display:block;font-size:30px;font-weight:700;line-height:1.35}.hc .ph2 span{display:block;font-family:'Noto Sans Bengali',${FONT_STACK};font-size:22px;font-weight:600;margin-top:4px;opacity:.95}
.hc .nx{position:absolute;right:400px;top:648px;width:470px;text-align:center;font-size:20px;font-weight:700;color:#1E293B}.hc .nx span{font-family:'Noto Sans Bengali',${FONT_STACK};color:var(--p-700,#CC5200);font-weight:600}
.hc .lg{position:absolute;left:60px;bottom:26px;display:flex;flex-direction:column;align-items:flex-start;gap:6px}.hc .lg img{height:54px;background:#fff;border-radius:12px;padding:4px 10px;box-shadow:0 8px 20px -12px rgba(30,41,59,.4)}
.hc .lg span{font-size:11px;font-weight:700;letter-spacing:1.5px;color:#64748B;direction:ltr}
.hc .id{position:absolute;right:40px;bottom:30px;font-size:15px;color:#94A3B8;font-weight:600;direction:ltr}
</style>
<div class="glow"></div>${confetti(d.sid+d.period)}
<div class="ph"><div>${d.photo?`<img src="${esc(d.photo)}" crossorigin="anonymous" alt=""/>`:esc(initials(name))}</div></div>
<div class="medal"><b>${esc(d.level)}</b><span>${esc((LEVEL_AR[d.level]||"").replace("المستوى ",""))}</span></div>
<div class="nm"><h2>${esc(name)}</h2>${d.nameAr&&d.nameLatin?`<p>${esc(d.nameLatin)}</p>`:""}<div class="lv">${esc(LEVEL_AR[d.level]||d.level)} · <span style="font-family:'Noto Sans Bengali',${FONT_STACK}">${esc(LEVEL_BN[d.level]||"")}</span></div></div>
<div class="mid">${d.production?`<div class="kick"><div class="sar">+${d.production} SAR<small>مكافأة الإنتاج</small></div></div>`:`<div class="kick">${motiv?"خطوة تفصلك عن المكافأة":"تكريم الشهر · بطل الغسيل"}</div>`}<div class="big">${d.washes}</div><div class="lbl">غسلة هذا الشهر · <span>এই মাসে ওয়াশ</span></div>${dl}</div>
<div class="side">
  <div class="cal"><div class="t">${ME[mi]} ${esc(y)}</div><b>${MA[mi]}</b><span>${esc(y)}</span></div>
  <div class="rate"><div class="st">★</div><div><b>${d.rating?d.rating.toFixed(2):"—"}<em class="${d.ratingDelta.dir}">${rd}</em></b><span>تقييم العملاء · রেটিং</span></div></div>
  <div class="bars">${bar(d.prevWashes,"الشهر السابق",false)}${bar(d.washes,"هذا الشهر",true)}</div>
</div>
<div class="ph2"><b>${esc(d.phrase.ar)}</b><span>${esc(d.phrase.bn)}</span></div>
<div class="nx">قد تكون أنت التالي · <span>আপনি পরবর্তী হতে পারেন</span></div>
<div class="lg"><img src="${site}/brand-logo.png" alt=""/><span>DALU WARGHWA · SWEATER FRANCHISE</span></div>
<div class="id">#${esc(d.sid)}</div>
</div>`;
}

export async function honorPNG(d){
  const canvas=await renderHTML(honorHTML(d),{width:1280,height:720,scale:2,background:"#FFF7ED"});
  return canvasBlob(canvas,"image/png");
}
export const honorFileName=d=>`honor-${d.sid}-${d.period}${d.variant==="motivate"?"-motivation":""}.png`;
export async function shareHonor(d){const b=await honorPNG(d);return shareOrDownload(b,honorFileName(d),"بطاقة تكريم — دلو ورغوة");}
export async function downloadHonor(d){const b=await honorPNG(d);downloadBlob(b,honorFileName(d));}
