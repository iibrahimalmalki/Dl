// مولّد تقرير الجولة الميدانية v2 (FRM-OPS-002) — ملف تقرير احترافي: غلاف/قرار · ملخص تحليلي · البنود بالصور · الإغلاق.
// Field round report generator v2 — cover + executive page, analytical summary, itemised evidence, closing page.
// الهوية: navy #0f172a · برتقالي #f79009/#b44708 · أخضر #12b76a · أحمر #b42318 (بايكر فقط) · كهرماني #b54708 (نقص إمداد).
import{ITEMS,AXES,bikerItems,mgmtItems,complianceByAxis,compliance,supplyReadiness,effect}from"./fieldChecklist";
import{ITEM_EN,ITEM_BN,AXES_EN,STATUS_BIKER,STATUS_MGMT,EFFECT_BN}from"./fieldReportI18n";
import QRCode from"qrcode/lib/browser.js";
export{ITEM_EN};

const SITE=(typeof location!=="undefined"&&location.origin)||"https://db1-sandy.vercel.app";
// الخط المضمّن (مستضاف مع المنصة في public/) — لا اعتماد على خطوط النظام أو خدمات خارجية | self-hosted embedded fonts
const FONT_BASE=(typeof globalThis!=="undefined"&&globalThis.__DW_FONT_BASE)||SITE;
function fontFaces(){
  const f=(fam,file,w,range)=>`@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:block;src:url(${FONT_BASE}/${file}) format('woff2');${range?`unicode-range:${range};`:""}}`;
  const AR="U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0898-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC";
  const BN="U+0951-0952,U+0964-0965,U+0980-09FE,U+1CD0,U+1CD2,U+1CD5-1CD6,U+1CD8,U+1CE1,U+1CEA,U+1CED,U+1CF2,U+1CF5-1CF7,U+200C-200D,U+20B9,U+25CC,U+A8F1";
  return[400,500,700].map(w=>f("IBM Plex Sans Arabic",`ibm-plex-sans-arabic-arabic-${w}-normal.woff2`,w,AR)+f("IBM Plex Sans Arabic",`ibm-plex-sans-arabic-latin-${w}-normal.woff2`,w,"")).join("")
    +[400,600].map(w=>f("Noto Sans Bengali",`noto-sans-bengali-bengali-${w}-normal.woff2`,w,BN)).join("");
}
const OWNER="إبراهيم المالكي";
const OPS_MANAGER="مدير العمليات";

// ألوان الحالات حسب المسؤولية | status colours by responsibility
// [text, bg] — الأحمر للبايكر فقط، الكهرماني لنقص الإمداد/الإدارة
const COL_BIKER={pass:["#087443","#e7f7ef"],half:["#b42318","#fdecea"],fail:["#b42318","#fdecea"],excused:["#475569","#eef0f3"],na:["#64748b","#f0f3f5"]};
const COL_MGMT={pass:["#087443","#e7f7ef"],half:["#b54708","#fdf3e2"],fail:["#b54708","#fdf3e2"],excused:["#475569","#eef0f3"],na:["#64748b","#f0f3f5"]};
const RES_LBL={pass:STATUS_BIKER.pass,half:STATUS_BIKER.half,fail:STATUS_BIKER.fail,excused:STATUS_BIKER.excused};
const MRES_LBL={pass:STATUS_MGMT.pass,half:STATUS_MGMT.half,fail:STATUS_MGMT.fail,excused:STATUS_MGMT.excused};
const RESP_BI={biker:["البايكر","Biker"],shared:["البايكر + الإدارة","Biker + Management"],mgmt:["الإدارة / الإمداد","Management / Supply"]};

const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const p2=n=>String(n).padStart(2,"0");
const MON_AR=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const DAY_AR=["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];

// ── التاريخ/الوقت ثنائي اللغة والمدة | Bilingual datetime + elapsed duration ──
function fmtBoth(d){
  if(!(d instanceof Date)||isNaN(d))return{ar:"—",en:"—"};
  const hh=d.getHours(),mm=p2(d.getMinutes());
  const h12=((hh+11)%12)+1;const ampmAr=hh<12?"ص":"م",ampmEn=hh<12?"AM":"PM";
  const ar=`${d.getDate()} ${MON_AR[d.getMonth()]} ${d.getFullYear()} · ${h12}:${mm} ${ampmAr}`;
  const en=`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())} · ${p2(h12)}:${mm} ${ampmEn}`;
  return{ar,en};
}
export function elapsedBoth(fromISO,now){
  const a=new Date(fromISO).getTime();if(isNaN(a))return{ar:"—",en:"—"};
  const ms=Math.max(0,(now?.getTime?.()||new Date().getTime())-a);
  const d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4);
  if(d>0)return{ar:`${d} يوم و${h} ساعة`,en:`${d}d ${h}h`};
  if(h>0)return{ar:`${h} ساعة و${m} دقيقة`,en:`${h}h ${m}m`};
  return{ar:`${m} دقيقة`,en:`${m}m`};
}
function fmtDateAr(iso){const d=new Date(iso+"T00:00:00");if(isNaN(d))return iso||"—";return`${DAY_AR[d.getDay()]} ${d.getDate()} ${MON_AR[d.getMonth()]} ${d.getFullYear()}`;}
function fmtTime12(t){if(!t)return"";const[h,m]=t.split(":").map(Number);if(isNaN(h))return t;return`${((h+11)%12)+1}:${p2(m||0)} ${h<12?"ص":"م"}`;}
function shortDate(iso){const d=new Date(iso+"T00:00:00");return isNaN(d)?iso:`${d.getDate()}/${p2(d.getMonth()+1)}`;}

// رقم التقرير | Report ID: FR-YYYYMMDD-<sweater_id>
export function reportId(round){return`FR-${(round.round_date||"").replace(/-/g,"")||"00000000"}-${round.sweater_id||"x"}`;}

// وقت التقاط الصورة من اسم الملف (…/<n>-<idx>-<epochMs>-<rand>.jpg) | photo capture time parsed from the storage path
function photoTime(url){
  const m=String(url||"").match(/\/(\d+)-(\d+)-(\d{13})-\d+\.(?:jpe?g|png|webp)/i);
  if(!m)return"";const d=new Date(Number(m[3]));if(isNaN(d))return"";
  return`${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

// ── ضغط الصور: 1200px · JPEG q0.8 · Data-URL — مناسب للطباعة والتكبير ──
function shrinkImg(url,maxW,q){
  return new Promise(res=>{
    try{
      const img=new Image();img.crossOrigin="anonymous";
      img.onload=()=>{try{
        const scale=Math.min(1,maxW/Math.max(img.naturalWidth||maxW,img.naturalHeight||maxW));
        const w=Math.max(1,Math.round((img.naturalWidth||maxW)*scale));
        const h=Math.max(1,Math.round((img.naturalHeight||maxW)*scale));
        const c=document.createElement("canvas");c.width=w;c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        res(c.toDataURL("image/jpeg",q));
      }catch(_){res(url);}};
      img.onerror=()=>res(url);
      img.src=url;
    }catch(_){res(url);}
  });
}
async function buildImgMap(photos,extraUrls=[],maxW=1200,q=0.8){
  const urls=[...new Set([...Object.values(photos||{}).flat(),...extraUrls].filter(Boolean))];
  const map={};
  await Promise.all(urls.map(async u=>{map[u]=await shrinkImg(u,maxW,q);}));
  return map;
}

// ── عناصر رسومية SVG | SVG widgets ──
function gaugeSVG(pct,color,size=150){
  // نصف دائرة من 180° إلى 0° | semicircle gauge
  const r=size/2-12,cx=size/2,cy=size/2+4;
  const arc=(a0,a1)=>{const p=a=>[cx+r*Math.cos(Math.PI*(1-a)),cy-r*Math.sin(Math.PI*(1-a))];const[x0,y0]=p(a0),[x1,y1]=p(a1);return`M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1-a0>0.5?1:0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;};
  const v=pct==null?0:Math.max(0.005,Math.min(1,pct/100));
  return`<svg width="${size}" height="${size/2+14}" viewBox="0 0 ${size} ${size/2+14}" aria-hidden="true">
    <path d="${arc(0,1)}" fill="none" stroke="#e6e9ed" stroke-width="14" stroke-linecap="round"/>
    <path d="${arc(0,v)}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"/>
  </svg>`;
}
function sparkSVG(points,w=230,h=60){
  // points: [{label,pct}] بالترتيب الزمني | chronological
  const pts=points.filter(p=>p.pct!=null);
  if(pts.length<2)return"";
  const padX=18,padY=14;const n=pts.length;
  const x=i=>padX+(w-2*padX)*(n===1?0.5:i/(n-1));
  const y=v=>padY+(h-2*padY)*(1-Math.max(0,Math.min(100,v))/100);
  const line=pts.map((p,i)=>`${x(i).toFixed(1)},${y(p.pct).toFixed(1)}`).join(" ");
  const dots=pts.map((p,i)=>{const last=i===n-1;return`<circle cx="${x(i).toFixed(1)}" cy="${y(p.pct).toFixed(1)}" r="${last?4.5:3.5}" fill="${last?"#b44708":"#f79009"}"/>
    <text x="${x(i).toFixed(1)}" y="${(y(p.pct)-8).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="#0f172a">${p.pct}%</text>
    <text x="${x(i).toFixed(1)}" y="${h+9}" text-anchor="middle" font-size="11.5" fill="#64748b">${esc(p.label)}</text>`;}).join("");
  return`<svg width="${w}" height="${h+12}" viewBox="0 0 ${w} ${h+12}" aria-hidden="true"><polyline points="${line}" fill="none" stroke="#f79009" stroke-width="2.5" stroke-linejoin="round"/>${dots}</svg>`;
}
function meter(pct,color){const w=pct==null?0:Math.max(pct,2);return`<div class="meter"><i style="width:${w}%;background:${color}"></i></div>`;}
const axisColor=p=>p==null?"#94a3b8":p>=80?"#12b76a":p>=60?"#f79009":"#b42318";
const initials=name=>String(name||"").trim().split(/\s+/).slice(0,2).map(s=>s[0]||"").join("").toUpperCase()||"—";

// ── الملخص البنغالي للبايكر | Bengali summary for the biker ──
function bengaliSummary(round,eff,weak,deadline){
  const pct=round.compliance_pct;
  const L=[];
  L.push(`${esc(round.biker_name||"")}, আপনার ফিল্ড রাউন্ডের ফলাফল: <b>${pct!=null?pct+"%":"—"}</b>। ${EFFECT_BN[eff.key]||""}`);
  if(weak.length){
    L.push(`যে বিষয়গুলো ঠিক করতে হবে (${esc(deadline)} এর মধ্যে):`);
    weak.forEach(i=>L.push(`• ${ITEM_BN[i.n]||ITEM_EN[i.n]||"#"+i.n}`));
  }else L.push("আপনার সব আইটেম ঠিক আছে — ধন্যবাদ, এভাবেই চালিয়ে যান।");
  return L;
}

// ── بناء التقرير | Build the printable report ──
// extras: {history:[{round_date,compliance_pct,results}], bikerPhoto, supplyRequest, team, locationName, approver}
export function buildReportHTML(round,analysis,opName,imgMap,extras={}){
  const results=round.results||{};const notes=round.item_notes||{};const photos=round.photos||{};const iparts=round.item_parts||{};
  const IMG=u=>(imgMap&&imgMap[u])||u;
  const an=analysis||{};
  const comp=compliance(results);
  const pct=round.compliance_pct!=null?Number(round.compliance_pct):comp.pct;
  const eff=effect(pct);const byAxis=complianceByAxis(results);const sup=supplyReadiness(results);
  const supCol=axisColor(sup.pct);
  const rid=reportId(round);
  const now=new Date();const issued=fmtBoth(now);
  const weak=bikerItems.filter(i=>results[i.n]==="fail"||results[i.n]==="half");
  const deadline=(an.priorities&&an.priorities[0]&&an.priorities[0].deadline)||"";
  const hist=(extras.history||[]).filter(h=>h.round_date&&h.compliance_pct!=null);
  const series=[...hist.filter(h=>h.round_date!==round.round_date).sort((a,b)=>a.round_date<b.round_date?-1:1).slice(-2).map(h=>({label:shortDate(h.round_date),pct:Number(h.compliance_pct)})),{label:shortDate(round.round_date),pct:pct}];
  const prevRound=hist.filter(h=>h.round_date&&h.round_date<round.round_date).sort((a,b)=>a.round_date<b.round_date?1:-1)[0]||null;
  const prevActions=an.prevActions&&an.prevActions.length?an.prevActions:(prevRound?Object.entries(prevRound.results||{}).filter(([,v])=>v==="fail"||v==="half").map(([k])=>{const n=Number(k);const it=ITEMS.find(i=>i.n===n);const nowV=results[n];return{n,ar:it?it.ar:"#"+n,resp:it?it.resp:"biker",prev:prevRound.results[k],now:nowV||null,status:nowV==="pass"?"closed":nowV==null?"unknown":(nowV==="fail"||nowV==="half")?"recurring":"open"};}):[]);
  const recurringSet=new Set(prevActions.filter(a=>a.status==="recurring").map(a=>a.n));
  const inspector=round.inspector||"";
  const approver=extras.approver||(inspector.includes("إبراهيم")?OPS_MANAGER:`${OWNER} — المالك`);
  const locName=extras.locationName||(round.location&&!/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(round.location)?round.location:"");
  const coords=(round.gps_lat&&round.gps_lng)?`${round.gps_lat}, ${round.gps_lng}`:(/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(round.location||"")?round.location:"");
  const bikerPhoto=extras.bikerPhoto?IMG(extras.bikerPhoto):"";
  const qr=extras.qrSvg||"";
  const sr=extras.supplyRequest||null;

  // ── الغلاف / صفحة القرار | Cover + executive ──
  const prioLines=(an.priorities||[]).slice(0,3).map(p=>`<tr><td class="pn">#${p.n}</td><td>${esc(p.ar)}</td><td class="pd">${esc(p.deadline||deadline)}</td></tr>`).join("");
  const cover=`
  <section class="cover">
    <div class="band">
      <div class="brand"><span class="logo"><img src="${SITE}/brand-mark.png" alt=""/></span><div><b>مؤسسة دلو ورغوة التجارية</b><span>شريك امتياز سويتر · رقم الشريك 47 · الرياض</span></div></div>
      <div class="ttl"><b>تقرير الجولة الميدانية</b><span>Field Round Report · FRM-OPS-002 · HR-POL-003-A</span></div>
      <div class="sw"><b>سويتر</b><span>Sweater · Partner 47</span></div>
    </div>
    <div class="cv">
      <div class="cv-biker">
        <div class="avatar">${bikerPhoto?`<img src="${esc(bikerPhoto)}" alt=""/>`:`<span>${esc(initials(round.biker_name))}</span>`}</div>
        <div class="who"><div class="nm">${esc(round.biker_name||"—")}</div><div class="sid">رقم سويتر #${esc(round.sweater_id||"—")}${extras.team?` · ${esc(extras.team)}`:""}</div></div>
        <table class="meta">
          <tr><td>تاريخ الجولة</td><td>${esc(fmtDateAr(round.round_date))}${round.round_time?` · <span style="white-space:nowrap">${esc(fmtTime12(round.round_time))}</span>`:""}</td></tr>
          <tr><td>منفّذ الجولة</td><td>${esc(inspector||"—")}</td></tr>
          <tr><td>المشغّل</td><td>${esc(opName||"دلو ورغوة")}</td></tr>
          <tr><td>الموقع</td><td>${esc(locName||"موقع الخدمة")}${coords?` <small dir="ltr">${esc(coords)}</small>`:""}</td></tr>
        </table>
      </div>
      <div class="cv-scores">
        <div class="g-main">
          ${gaugeSVG(pct,eff.color,170)}
          <div class="g-val" style="color:${eff.color}">${pct!=null?pct+"%":"—"}</div>
          <div class="g-lbl">التزام البايكر</div>
          <div class="g-sub">${comp.denom?`${comp.points} من ${comp.denom} بنود مقيَّمة`:"لا بنود مقيَّمة"}${comp.notAssessed.length?` · ${comp.notAssessed.length} غير مقيَّم`:""}</div>
        </div>
        <div class="g-side">
          <div class="g-side-v" style="color:${supCol}">${sup.pct!=null?sup.pct+"%":"—"}</div>
          <div class="g-side-l">جاهزية الإمداد</div>
          <div class="g-side-s">${sup.denom?`${sup.points} من ${sup.denom} بنود إدارة`:"—"}</div>
          ${meter(sup.pct,supCol)}
        </div>
      </div>
      <div class="verdict" style="background:${eff.bg};color:${eff.color};border-color:${eff.color}"><b>الحكم:</b> ${esc(eff.ar)}<span class="fin">${esc(eff.fin)}</span></div>
      <div class="cv-grid">
        <div class="cv-box"><div class="bx-h">الاتجاه · آخر ${series.length} جولات</div>${series.length>=2?sparkSVG(series):`<div class="muted">لا توجد جولة سابقة للمقارنة.</div>`}${an.trend?.text?`<div class="tr-txt">${esc(an.trend.text)}</div>`:""}</div>
        <div class="cv-box"><div class="bx-h">الأولويات التصحيحية</div>${prioLines?`<table class="prio">${prioLines}</table>`:`<div class="muted ok">لا مخالفات على البايكر في هذه الجولة.</div>`}</div>
      </div>
      <div class="cv-foot">
        <div><b>رقم التقرير</b> ${rid}</div>
        <div><b>الإصدار</b> ${esc(issued.ar)}</div>
        <div class="qr">${qr}</div>
      </div>
    </div>
  </section>`;

  // ── الملخص التحليلي | Analytical summary ──
  const axesRows=Object.keys(AXES).map(ax=>{const a=byAxis[ax];const c=axisColor(a.pct);const items=bikerItems.filter(i=>i.axis===ax);const mg=mgmtItems.filter(i=>i.axis===ax).length;
    return`<tr><td><b>${esc(AXES[ax].ar)}</b><span class="en">${AXES_EN[ax]}</span></td><td class="c">${items.length}${mg?` <small>+${mg} إدارة</small>`:""}</td><td class="c">${a.denom?`${a.points}/${a.denom}`:"—"}</td><td class="c" style="color:${c};font-weight:800">${a.pct!=null?a.pct+"%":"—"}</td><td class="mt">${meter(a.pct,c)}</td></tr>`;}).join("");
  const actionRows=weak.map(i=>{const rec=(an.recommendation&&an.rootCause&&an.rootCause.includes("#"+i.n))?an.recommendation:(notes[i.n]||"تصحيح البند وتوثيقه بصورة قبل الموعد.");
    return`<tr><td class="pn">#${i.n}</td><td>${esc(i.ar)}${recurringSet.has(i.n)?` <span class="tag r">متكرر</span>`:""}</td><td>${esc(rec)}</td><td>${esc(OPS_MANAGER)}</td><td class="pd">${esc(deadline||"—")}</td><td>صورة + جولة متابعة</td></tr>`;}).join("");
  const mgmtRows=mgmtItems.filter(i=>results[i.n]==="fail"||results[i.n]==="half").map(i=>{const parts=(iparts[i.n]||[]).filter(Boolean);
    return`<tr><td class="pn">#${i.n}</td><td>${esc(i.ar)}${recurringSet.has(i.n)?` <span class="tag a">متكرر</span>`:""}${parts.length?`<span class="en">${esc(parts.join("، "))}</span>`:""}</td><td>${esc(notes[i.n]||"توفير/استبدال عبر طلب دعم سويتر")}</td><td>الإدارة / سويتر</td><td class="pd">${sr?.created_at?esc(fmtBoth(new Date(sr.created_at)).ar.split(" · ")[0]):"عند إنشاء الطلب"}</td><td>استلام موثق</td></tr>`;}).join("");
  const PA_LBL={closed:["أُغلق","#087443","#e7f7ef"],open:["ما زال مفتوحاً","#b54708","#fdf3e2"],recurring:["متكرر","#b42318","#fdecea"],unknown:["لم يُقيَّم","#64748b","#f0f3f5"]};
  const paRows=prevActions.map(a=>{const l=PA_LBL[a.status]||PA_LBL.unknown;return`<tr><td class="pn">#${a.n}</td><td>${esc(a.ar)}</td><td class="c"><span class="badge" style="color:${l[1]};background:${l[2]}">${l[0]}</span></td></tr>`;}).join("");
  const summary=`
  <section class="pg">
    <h2><span class="n">1</span>الملخص التحليلي</h2>
    <table class="tbl axes"><thead><tr><th>المحور</th><th class="c">بنود البايكر</th><th class="c">النقاط</th><th class="c">النسبة</th><th></th></tr></thead><tbody>${axesRows}</tbody></table>
    <div class="two">
      <div class="box"><div class="bx-h">السبب الجذري</div><p>${esc(an.rootCause||(weak.length?"تعدد أسباب المخالفات — انظر البنود.":"لا مخالفات على البايكر في هذه الجولة."))}</p>${an.recommendation?`<div class="bx-h" style="margin-top:6px">التوصية</div><p>${esc(an.recommendation)}</p>`:""}</div>
      <div class="box"><div class="bx-h">الأثر وفق HR-POL-003</div><p>${esc(eff.fin)}</p>${an.recurring?.length?`<p class="warn">⚠ تكرار من الجولة السابقة في: ${an.recurring.map(r=>"#"+r.n).join("، ")} — يستدعي مراجعة تدريبية.</p>`:""}</div>
    </div>
    <h3>خطة التصحيح</h3>
    ${(actionRows||mgmtRows)?`<table class="tbl plan"><thead><tr><th>البند</th><th>المخالفة</th><th>الإجراء</th><th>المسؤول</th><th>الموعد</th><th>التحقق</th></tr></thead><tbody>${actionRows}${mgmtRows}</tbody></table>`:`<div class="muted ok">لا إجراءات تصحيحية مطلوبة.</div>`}
    <h3>إجراءات الجولة السابقة${prevRound?` <small>(${esc(shortDate(prevRound.round_date))}/${esc(String(prevRound.round_date).slice(0,4))} · ${prevRound.compliance_pct}%)</small>`:""}</h3>
    ${paRows?`<table class="tbl prev"><thead><tr><th>البند</th><th>الملاحظة السابقة</th><th class="c">الحالة الآن</th></tr></thead><tbody>${paRows}</tbody></table>`:`<div class="muted">${prevRound?"لم تكن هناك مخالفات في الجولة السابقة.":"لا توجد جولة سابقة."}</div>`}
  </section>`;

  // ── البنود بالتفصيل | Itemised evidence ──
  const axisBlocks=Object.keys(AXES).map(ax=>{
    const a=byAxis[ax];const acol=axisColor(a.pct);
    const cards=ITEMS.filter(i=>i.axis===ax).map(it=>{
      const mgmt=it.resp==="mgmt";const r=results[it.n];const key=r==null?"na":r;
      const lbl=(mgmt?STATUS_MGMT:STATUS_BIKER)[key]||STATUS_BIKER.na;const col=(mgmt?COL_MGMT:COL_BIKER)[key]||COL_BIKER.na;
      const imgs=(photos[it.n]||[]).filter(Boolean);
      const angles=it.photos||[];
      const noteLbl=key==="na"?"سبب عدم التقييم":r==="excused"?"ملاحظة الإعفاء":(r==="fail"||r==="half")?"السبب / الإجراء":"ملاحظة";
      const noteTxt=notes[it.n]||(key==="na"?"لم يُشاهد أثناء الجولة.":"");
      const noteCls=(r==="fail"||r==="half")?(mgmt?"amb":"red"):r==="excused"?"grey":"";
      const psel=(iparts[it.n]||[]).filter(Boolean);
      const pbadge=psel.length?`<div class="parts">الجزء المتأثر: <b>${esc(psel.join("، "))}</b></div>`:"";
      const rec=recurringSet.has(it.n)?`<span class="tag ${mgmt?"a":"r"}">متكرر</span>`:"";
      const gal=imgs.length?`<div class="gal">${imgs.map((u,idx)=>{const t=photoTime(u);return`<figure><img src="${esc(IMG(u))}" alt=""/><figcaption>${esc(angles[idx]||"صورة إضافية")}${t?` · ${t}`:""}</figcaption></figure>`;}).join("")}</div>`:"";
      return`<div class="item${imgs.length>3?" big":""}">
        <div class="it-h"><span class="it-n">${it.n}</span><div class="it-t"><div class="ar">${esc(it.ar)} ${rec}</div><div class="en">${esc(ITEM_EN[it.n]||"")}</div><div class="resp">${RESP_BI[it.resp][0]}</div></div><span class="badge" style="color:${col[0]};background:${col[1]}">${esc(lbl[0])}</span></div>
        ${pbadge}${noteTxt?`<div class="note ${noteCls}"><b>${noteLbl}:</b> ${esc(noteTxt)}</div>`:""}
        ${gal}
      </div>`;}).join("");
    return`<div class="axis"><div class="ax-h" style="border-color:${acol}"><b>${esc(AXES[ax].ar)}</b><span class="en">${AXES_EN[ax]}</span><span class="ax-p" style="color:${acol}">${a.pct!=null?a.pct+"%":"—"}</span></div>${cards}</div>`;
  }).join("");
  const items=`<section class="pg flow"><h2><span class="n">2</span>البنود بالتفصيل والأدلة المصورة</h2><p class="lead">الصور كما التُقطت أثناء الجولة، بلا قصّ، مع زاوية التصوير ووقت الالتقاط. الأحمر يخص البايكر، والكهرماني يخص الإمداد/الإدارة.</p>${axisBlocks}</section>`;

  // ── الإغلاق | Closing ──
  const srItems=sr&&sr.items&&sr.items.length?sr.items:null;
  const srRows=srItems?srItems.map((g,i)=>{const parts=(g.parts&&g.parts.length)?g.parts:[g.parts_ar||g.category||g.ar];return parts.map(pa=>`<tr><td class="pn">${i+1}</td><td>${esc(pa)}<span class="en">${esc(g.category_en||g.en||"")}</span></td><td class="c">1</td><td class="c">${esc(g.status_ar||"ناقص")}</td></tr>`).join("");}).join(""):
    mgmtItems.filter(i=>results[i.n]==="fail"||results[i.n]==="half").map((i,idx)=>{const parts=(iparts[i.n]||[]).filter(Boolean);const list=parts.length?parts:[i.ar];return list.map(pa=>`<tr><td class="pn">${idx+1}</td><td>${esc(pa)}<span class="en">${esc(ITEM_EN[i.n]||"")}</span></td><td class="c">1</td><td class="c">${esc(MRES_LBL[results[i.n]]?.[0]||"ناقص")}</td></tr>`).join("");}).join("");
  const srMeta=sr?`<table class="meta2"><tr><td>رقم الطلب</td><td dir="ltr">${esc(sr.ref||"—")}</td><td>تاريخ الإرسال</td><td>${sr.created_at?esc(fmtBoth(new Date(sr.created_at)).ar):"—"}</td><td>الحالة</td><td>${esc({open:"مفتوح",escalated:"مُصعَّد",completed:"مكتمل"}[sr.status]||sr.status||"مفتوح")}</td></tr></table>`:`<div class="muted">لم يُنشأ طلب إمداد لهذه الجولة بعد — يُنشأ من زر «طلب إمداد» في المنصة ويُرفق رقمه هنا.</div>`;
  const bn=bengaliSummary(round,eff,weak,deadline);
  const closing=`
  <section class="pg flow">
    <h2><span class="n">3</span>طلب دعم سويتر (الإمداد)</h2>
    <p class="lead">النواقص التالية مسؤولية الإمداد على سويتر/الإدارة، وتُحوَّل إلى طلب رسمي مع إعفاء البايكر من أي أثر مالي وفق POL-QUA-001 (9.4).</p>
    ${srRows?`<table class="tbl sr"><thead><tr><th>#</th><th>الصنف</th><th class="c">الكمية</th><th class="c">الحالة</th></tr></thead><tbody>${srRows}</tbody></table>`:`<div class="muted ok">لا نواقص إمداد في هذه الجولة.</div>`}
    ${srRows?srMeta:""}
    <h2 style="margin-top:14pt"><span class="n">4</span>ملخص للبايكر · বাইকারের জন্য সারসংক্ষেপ</h2>
    <div class="bn" lang="bn" dir="ltr">${bn.map(l=>`<div>${l}</div>`).join("")}</div>
    <h2 style="margin-top:14pt"><span class="n">5</span>التوقيعات</h2>
    <div class="sign">
      <div><div class="line"></div><b>منفّذ الجولة</b><span>${esc(inspector||"—")}</span><small>التاريخ: &nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/${now.getFullYear()}</small></div>
      <div><div class="line"></div><b>البايكر · বাইকার</b><span>${esc(round.biker_name||"—")}</span><small>التاريخ: &nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/${now.getFullYear()}</small></div>
      <div><div class="line"></div><b>الاعتماد</b><span>${esc(approver)}</span><small>التاريخ: &nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/${now.getFullYear()}</small></div>
    </div>
    <div class="limits">حدود التقرير: نتائج هذه الجولة عيّنة لحظية لحالة البايكر ومعداته وقت الفحص، ولا تُعمَّم على غير وقتها. تُعتمد الصور المرفقة دليلاً أساسياً، ويُراجع أي اعتراض خلال 48 ساعة من الإصدار.</div>
  </section>`;

  const footer=`<div class="pf"><span>${rid}</span><span>${esc(round.biker_name||"")} · #${esc(round.sweater_id||"")}</span><span>منصة دلو ورغوة · ${now.getFullYear()}-${p2(now.getMonth()+1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}</span></div>`;

  return`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${rid} · تقرير الجولة الميدانية — ${esc(round.biker_name||"")}</title>
<style>
${fontFaces()}
:root{--navy:#0f172a;--navy-2:#172134;--orange:#f79009;--orange-deep:#b44708;--orange-soft:#fff7ed;--green:#12b76a;--green-soft:#e7f7ef;--red:#b42318;--red-soft:#fdecea;--amber:#b54708;--amber-soft:#fdf3e2;--blue:#2563eb;--blue-soft:#dae6fb;--ink:#0f172a;--muted:#64748b;--line:#e6e9ed;--surface:#f0f3f5;--surface-2:#f8fafc;--paper:#fff}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--paper);color:var(--ink);font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,sans-serif;font-size:11pt;line-height:1.7}
[lang=bn]{font-family:'Noto Sans Bengali','IBM Plex Sans Arabic',sans-serif}
.doc{width:210mm;margin:0 auto}
.pf{display:none}
h2{font-size:13pt;font-weight:700;margin:0 0 6pt;padding-right:9pt;border-right:4pt solid var(--orange);display:flex;align-items:center;gap:7pt;break-after:avoid}
h2 .n{background:var(--navy);color:#fff;font-size:9.5pt;width:18pt;height:18pt;border-radius:50%;display:inline-flex;align-items:center;justify-content:center}
h3{font-size:12pt;font-weight:700;margin:11pt 0 5pt;break-after:avoid}
h3 small{font-size:9pt;color:var(--muted);font-weight:500}
p{margin:0 0 5pt}
.lead{font-size:10pt;color:var(--muted);margin-bottom:8pt}
.en{display:block;font-size:9pt;color:var(--muted);font-weight:400;direction:ltr;text-align:right}
.muted{font-size:10pt;color:var(--muted)}.muted.ok{color:#087443}
small{font-size:8.5pt;color:var(--muted)}
.badge{display:inline-block;padding:2pt 9pt;border-radius:20pt;font-size:9.5pt;font-weight:700;white-space:nowrap}
.tag{display:inline-block;padding:0 6pt;border-radius:20pt;font-size:8.5pt;font-weight:700;vertical-align:middle}
.tag.r{color:var(--red);background:var(--red-soft)}.tag.a{color:var(--amber);background:var(--amber-soft)}
.meter{height:6pt;background:var(--surface);border-radius:4pt;overflow:hidden;margin-top:3pt}.meter i{display:block;height:100%;border-radius:4pt}
/* ── الغلاف ── */
.cover{position:relative;break-after:page;min-height:280mm}
.band{background:linear-gradient(135deg,var(--navy),var(--navy-2));color:#fff;height:34mm;padding:0 13mm;display:flex;align-items:center;justify-content:space-between;gap:6mm}
.brand{display:flex;align-items:center;gap:4mm;flex:1}
.brand .logo{width:14mm;height:14mm;border-radius:3.5mm;background:#fff;display:flex;align-items:center;justify-content:center;flex:none}
.brand .logo img{width:10mm;height:10mm;object-fit:contain}
.brand b{display:block;font-size:12.5pt;font-weight:700;line-height:1.3;white-space:nowrap}.brand span{font-size:8.5pt;color:#cbd5e1;white-space:nowrap}
.ttl{text-align:center;flex:none}.ttl b{display:block;font-size:15pt;font-weight:700;white-space:nowrap}.ttl span{font-size:8.5pt;color:#cbd5e1;direction:ltr;display:block;white-space:nowrap}
.sw{flex:none;text-align:center;border:1px solid rgba(255,255,255,.35);border-radius:3mm;padding:2mm 4mm;min-width:26mm}
.sw b{display:block;font-size:12pt;letter-spacing:.5pt}.sw span{font-size:8.5pt;color:#cbd5e1;direction:ltr;display:block}
.cv{padding:9mm 13mm 8mm}
.cv-biker{display:grid;grid-template-columns:34mm 1fr 1.2fr;gap:6mm;align-items:center;margin-bottom:7mm}
.avatar{width:34mm;height:34mm;border-radius:50%;background:var(--surface);border:1.2mm solid var(--orange);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:20pt;font-weight:700;color:var(--orange-deep)}
.avatar img{width:100%;height:100%;object-fit:cover}
.who .nm{font-size:18pt;font-weight:700;line-height:1.3}.who .sid{font-size:10.5pt;color:var(--muted)}
.meta{border-collapse:collapse;width:100%}.meta td{padding:1.5pt 4pt;font-size:10pt;vertical-align:top}.meta td:first-child{color:var(--muted);white-space:nowrap;width:26mm}.meta td small{direction:ltr;unicode-bidi:embed;color:var(--muted)}
.cv-scores{display:grid;grid-template-columns:1.3fr 1fr;gap:6mm;align-items:stretch;margin-bottom:5mm}
.g-main{text-align:center;background:var(--surface-2);border:1px solid var(--line);border-radius:4mm;padding:4mm 4mm 3mm;position:relative}
.g-val{font-size:30pt;font-weight:700;line-height:1;margin-top:-13mm}
.g-lbl{font-size:11pt;font-weight:700;margin-top:2pt}.g-sub{font-size:9.5pt;color:var(--muted)}
.g-side{background:var(--surface-2);border:1px solid var(--line);border-radius:4mm;padding:5mm 5mm;display:flex;flex-direction:column;justify-content:center}
.g-side-v{font-size:22pt;font-weight:700;line-height:1.1}.g-side-l{font-size:11pt;font-weight:700}.g-side-s{font-size:9.5pt;color:var(--muted);margin-bottom:2pt}
.verdict{border:1px solid;border-right-width:5pt;border-radius:3mm;padding:3mm 4mm;font-size:12pt;font-weight:700;margin-bottom:5mm}
.verdict .fin{display:block;font-size:9.5pt;font-weight:400;margin-top:1pt;color:var(--ink)}
.cv-grid{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-bottom:6mm}
.cv-box,.box{border:1px solid var(--line);border-radius:3mm;padding:3mm 4mm;background:#fff}
.bx-h{font-size:10pt;font-weight:700;color:var(--muted);margin-bottom:2pt}
.tr-txt{font-size:9.5pt;margin-top:2pt}
.prio{border-collapse:collapse;width:100%}.prio td{padding:2pt 3pt;font-size:10pt;border-bottom:1px dashed var(--line);vertical-align:top}.prio tr:last-child td{border-bottom:none}
.pn{color:var(--blue);font-weight:700;white-space:nowrap;width:9mm}.pd{white-space:nowrap;color:var(--muted);direction:ltr;text-align:right}
.cv-foot{display:flex;align-items:center;gap:8mm;border-top:1px solid var(--line);padding-top:4mm;font-size:9.5pt;color:var(--muted)}
.cv-foot b{color:var(--ink);margin-left:3pt}.cv-foot .qr{margin-right:auto;width:20mm;height:20mm}.cv-foot .qr svg{width:20mm;height:20mm;display:block}
/* ── الصفحات ── */
.pg{padding:0 13mm;break-before:page}.pg.flow{break-before:auto;margin-top:10pt}
.tbl{width:100%;border-collapse:collapse;margin:0 0 8pt;break-inside:auto}
.tbl thead{display:table-header-group}.tbl tr{break-inside:avoid}.tbl.axes,.tbl.prev,.tbl.sr{break-inside:avoid}
h3+.tbl,h3+.muted{break-before:avoid}
.tbl th{background:var(--navy);color:#fff;font-size:9.5pt;font-weight:700;padding:4pt 6pt;text-align:right}
.tbl td{padding:4pt 6pt;font-size:10pt;border-bottom:1px solid var(--line);vertical-align:top}
.tbl tr:nth-child(even) td{background:var(--surface-2)}
.tbl .c{text-align:center}.tbl .mt{width:34mm}
.two{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-bottom:4pt}
.box p{font-size:10pt;margin:0}.box .warn{color:var(--red);font-weight:700;margin-top:4pt}
.meta2{border-collapse:collapse;width:100%;margin-top:2pt;font-size:9.5pt}.meta2 td{padding:2pt 5pt;border-bottom:1px solid var(--line)}.meta2 td:nth-child(odd){color:var(--muted);white-space:nowrap}
/* ── البنود ── */
.axis{margin-bottom:8pt}
.ax-h{display:flex;align-items:center;gap:6pt;border-right:5pt solid;padding:3pt 8pt;background:var(--surface-2);border-radius:2mm;margin:8pt 0 4pt;break-after:avoid}
.ax-h b{font-size:13pt}.ax-h .en{display:inline;font-size:9pt}.ax-h .ax-p{margin-right:auto;font-size:13pt;font-weight:700}
.item{border:1px solid var(--line);border-radius:3mm;padding:4mm 4mm 3mm;margin-bottom:4pt;break-inside:avoid;page-break-inside:avoid}
.item.big{break-inside:auto;page-break-inside:auto}.item.big .it-h,.item.big .note{break-after:avoid}
.it-h{display:flex;align-items:flex-start;gap:6pt}
.it-n{flex:none;width:18pt;height:18pt;border-radius:6pt;background:var(--blue-soft);color:var(--blue);font-size:9.5pt;font-weight:700;display:inline-flex;align-items:center;justify-content:center;margin-top:2pt}
.it-t{flex:1;min-width:0}.it-t .ar{font-size:12pt;font-weight:700;line-height:1.45}.it-t .resp{font-size:8.5pt;color:var(--muted)}
.it-h .badge{flex:none;margin-top:2pt}
.parts{font-size:9.5pt;color:var(--amber);margin-top:3pt}
.note{margin-top:4pt;font-size:10pt;padding:3pt 8pt;border-radius:2mm;background:var(--surface-2);border-right:3pt solid var(--line)}
.note.red{background:var(--red-soft);border-color:var(--red)}.note.amb{background:var(--amber-soft);border-color:var(--amber)}.note.grey{background:var(--surface);border-color:#94a3b8}
.gal{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin-top:4pt}
.gal figure{margin:0;break-inside:avoid}
.gal img{width:100%;height:36mm;object-fit:contain;background:var(--surface);border:1px solid var(--line);border-radius:2mm;display:block}
.gal figcaption{font-size:8.5pt;color:var(--muted);text-align:center;margin-top:1pt}
/* ── الإغلاق ── */
.bn{border:1px solid var(--line);border-radius:3mm;padding:3mm 4mm;font-size:11pt;line-height:1.8;background:var(--surface-2)}
.bn div{margin-bottom:2pt}
.sign{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8mm;margin-top:12mm}
.sign .line{border-top:1.2pt solid var(--ink);margin-bottom:4pt}
.sign b{display:block;font-size:10pt}.sign span{display:block;font-size:10pt}.sign small{display:block;margin-top:2pt}
.limits{margin-top:8mm;font-size:8.5pt;color:var(--muted);border-top:1px solid var(--line);padding-top:3mm}
/* ── الشاشة ── */
@media screen{
  body{background:#e9edf2;padding:12px 0 70px}
  .doc{background:#fff;box-shadow:0 4px 30px rgba(0,0,0,.12)}
  .pg{padding-top:8mm;padding-bottom:8mm;border-top:1px dashed var(--line)}
  .cover{min-height:auto}
  .bar{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid var(--line);padding:10px;display:flex;gap:10px;justify-content:center;z-index:9}
  .pbtn{padding:10px 22px;border:none;border-radius:11px;background:linear-gradient(135deg,#E8712B,#CC5200);color:#fff;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer}
  @media(max-width:820px){.doc{width:100%}.cv-biker{grid-template-columns:1fr}.cv-scores,.cv-grid,.two,.sign{grid-template-columns:1fr}.gal{grid-template-columns:1fr 1fr}.band{height:auto;padding:5mm 6mm;flex-wrap:wrap}.pg,.cv{padding-left:6mm;padding-right:6mm}}
}
/* ── الطباعة: بلا رأس/ذيل المتصفح · ذيل خاص على كل صفحة ── */
@media print{
  @page{size:A4;margin:0}
  html,body{width:210mm}
  .bar{display:none}
  .doc{width:210mm}
  .cover{height:297mm;padding-bottom:12mm}
  .pg{padding-top:12mm;padding-bottom:16mm}
  .pf{display:flex;position:fixed;bottom:0;left:0;right:0;height:11mm;padding:0 13mm;align-items:center;justify-content:space-between;font-size:8.5pt;color:var(--muted);background:#fff;border-top:1px solid var(--line)}
  .pf span:first-child{direction:ltr;font-weight:700;color:var(--ink)}.pf span:last-child{direction:ltr;unicode-bidi:embed}
  .item,.box,.cv-box,.g-main,.g-side,figure{break-inside:avoid}
  .band{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
</style></head><body>
<div class="doc">
${cover}
${summary}
${items}
${closing}
</div>
${footer}
<div class="bar"><button class="pbtn" onclick="window.print()">طباعة / حفظ PDF</button></div>
</body></html>`;
}

// يفتح التقرير في نافذة جديدة بعد ضغط الصور وتحميل الخط (PDF نظيف بلا رأس/ذيل المتصفح)
// Opens the report in a new window after compressing images and loading the embedded font.
export async function openReport(round,analysis,opName,extras={}){
  const w=window.open("","_blank");
  if(!w)return false;
  try{
    w.document.write(`<!doctype html><meta charset="utf-8"><div style="font-family:Tahoma;padding:40px;text-align:center;color:#475569">جارٍ تجهيز التقرير وضغط الصور…<br>Preparing report &amp; compressing images…</div>`);
  }catch(_){}
  let imgMap={};
  try{imgMap=await buildImgMap(round.photos,extras.bikerPhoto?[extras.bikerPhoto]:[]);}catch(_){imgMap={};}
  let qrSvg="";
  try{qrSvg=await QRCode.toString(`${SITE}/?fr=${encodeURIComponent(round.id||"")}`,{type:"svg",margin:0,color:{dark:"#0f172a",light:"#ffffff"}});}catch(_){qrSvg="";}
  const html=buildReportHTML(round,analysis,opName,imgMap,{...extras,qrSvg});
  try{w.document.open();w.document.write(html);w.document.close();}catch(_){return false;}
  // تحميل الخطوط المضمّنة قبل السماح بالطباعة | make sure embedded fonts are ready before printing
  try{const btn=w.document.querySelector(".pbtn");if(btn){btn.disabled=true;btn.textContent="جارٍ تحميل الخطوط…";w.document.fonts.ready.then(()=>{btn.disabled=false;btn.textContent="طباعة / حفظ PDF";});}}catch(_){}
  return true;
}

// ── تصنيف بنود الإمداد (نوع/فئة) لسلاسل الإمداد | Supply categorization by type/category ──
export const SUPPLY_CAT={
  4:{type:"مواد تشغيل/براندينج",cat:"ملصقات سويتر",en:"Branding / Stickers"},
  7:{type:"زي رسمي",cat:"الزي المعتمد",en:"Official uniform"},
  9:{type:"زي رسمي",cat:"إكسسوارات الزي (كاب/حذاء)",en:"Uniform accessories (cap/shoes)"},
  10:{type:"معدات سلامة",cat:"معدات الحماية",en:"Safety / protective gear"},
  12:{type:"مواد تنظيف",cat:"مواد ومستهلكات",en:"Cleaning materials"},
};
const CAT_FALLBACK={type:"إمداد عام",cat:"غير مصنّف",en:"General supply"};
export function catOf(n){return SUPPLY_CAT[n]||CAT_FALLBACK;}

// يبني قائمة النواقص المصنّفة من نتائج الجولة (بنود الإدارة: ناقص/بديل جزئي/معفى)
// يحدّد الجزء المتأثر بدقّة للبنود المركّبة (مثل الخوذة ضمن معدات الحماية)
export function shortageItems(round){
  const results=round.results||{},notes=round.item_notes||{},iparts=round.item_parts||{};
  return ITEMS.filter(i=>i.resp==="mgmt"&&["fail","half","excused"].includes(results[i.n])).map(i=>{
    const c=catOf(i.n),st=MRES_LBL[results[i.n]]||["—","—"];
    const sel=(iparts[i.n]||[]).filter(Boolean);
    const partsEn=sel.map(pa=>{const p=(i.parts||[]).find(x=>x.ar===pa);return p?p.en:pa;});
    return{n:i.n,ar:i.ar,en:ITEM_EN[i.n]||"",type:c.type,category:c.cat,category_en:c.en,
      status:results[i.n],status_ar:st[0],status_en:st[1],note:notes[i.n]||"",
      parts:sel,parts_ar:sel.join("، "),parts_en:partsEn.join(", ")};
  });
}

// مرجع الطلب | Request reference: DW-<sid>-<YYYYMMDD>-<HHMM>
export function makeRef(round,d){
  const p=n=>String(n).padStart(2,"0");
  const sid=round.sweater_id||"x";
  const dt=round.round_date?round.round_date.replace(/-/g,""):"00000000";
  const hm=d?`${p(d.getHours())}${p(d.getMinutes())}`:"0000";
  return`DW-${sid}-${dt}-${hm}`;
}

// رسالة الطلب المبدئي لمركز الدعم (ثنائية) | Initial supply-request WhatsApp message
export function buildSupplyRequestMsg(req){
  const created=req.created_at?new Date(req.created_at):new Date();
  const ct=fmtBoth(created);
  const items=req.items||[];
  const L=[];
  L.push("🫧 دلو ورغوة × سويتر — طلب إمداد | Supply Request");
  L.push(`🔖 ${req.ref||"—"}`);
  L.push(`👤 ${req.biker_name||"—"} (#${req.sweater_id||"—"})`);
  L.push(`🕒 ${ct.ar}`);
  L.push(`🏷️ ${req.requesting_dept||"التشغيل — دلو ورغوة"} · Partner 47`);
  L.push("");
  L.push("المطلوب توفيره | Requested:");
  items.forEach((it,i)=>{
    const mat=it.parts_ar||it.category||it.ar;
    const matEn=it.parts_en||it.category_en||it.en;
    L.push(`${i+1}) ${mat}${matEn?` · ${matEn}`:""} — ${it.status_ar}`);
  });
  if(!items.length)L.push("• لا نواقص | none");
  L.push("");
  L.push("📎 مرفق: تقرير الجولة (PDF) وصور التوثيق.");
  return L.join("\n");
}

// ── تجميع وتصنيف نواقص كل الطلبات المفتوحة في طلب واحد ──
// يفرز المواد حسب النوع/الفئة، ويدمج المتطابقة مع ذكر البايكرز المحتاجين لكل مادة.
export function classifyOpenRequests(reqs){
  const map=new Map();
  (reqs||[]).forEach(r=>{
    const biker={name:r.biker_name||"—",id:r.sweater_id||"—"};
    (r.items||[]).forEach(it=>{
      const cat=it.category||"غير مصنّف", catEn=it.category_en||"", type=it.type||"إمداد";
      const partsEn=(it.parts_en?String(it.parts_en).split(", "):[]);
      const parts=(it.parts&&it.parts.length)
        ? it.parts.map((p,i)=>({ar:p,en:partsEn[i]||""}))
        : [{ar:it.category||it.ar||"—",en:it.category_en||it.en||""}];
      parts.forEach(p=>{
        const key=type+"|"+cat+"|"+p.ar;
        if(!map.has(key))map.set(key,{type,cat,cat_en:catEn,ar:p.ar,en:p.en,bikers:[]});
        const g=map.get(key);
        if(!g.bikers.some(b=>b.id===biker.id&&b.name===biker.name))g.bikers.push(biker);
      });
    });
  });
  const groups=new Map();
  for(const m of map.values()){
    const gk=m.type+"|"+m.cat;
    if(!groups.has(gk))groups.set(gk,{type:m.type,cat:m.cat,cat_en:m.cat_en,materials:[]});
    groups.get(gk).materials.push({ar:m.ar,en:m.en,bikers:m.bikers});
  }
  return [...groups.values()];
}

// رسالة الطلب المجمّع — مصنّفة حسب الفئة، مادة واحدة لكل سطر مع البايكرز المحتاجين
export function buildConsolidatedMsg(reqs,d){
  const groups=classifyOpenRequests(reqs);
  const nb=new Set((reqs||[]).map(r=>(r.sweater_id||"")+"|"+(r.biker_name||""))).size;
  const p=n=>String(n).padStart(2,"0");
  const ref=d?`DW-BULK-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`:"DW-BULK";
  const L=[];
  L.push("🫧 دلو ورغوة × سويتر — طلب إمداد مجمّع | Consolidated Supply Request");
  L.push(`🔖 ${ref}`);
  L.push(`🏷️ التشغيل — دلو ورغوة · Partner 47`);
  L.push(`📊 يشمل ${(reqs||[]).length} طلب مفتوح · ${nb} بايكر`);
  L.push("");
  L.push("المطلوب توفيره — مصنّفاً حسب الفئة | Requested (classified):");
  let idx=0;
  groups.forEach(g=>{
    L.push(`▪️ ${g.cat}${g.cat_en?` · ${g.cat_en}`:""}`);
    g.materials.forEach(m=>{
      idx++;
      const who=m.bikers.map(b=>`${b.name} (#${b.id})`).join("، ");
      L.push(`   ${idx}) ${m.ar}${m.en?` · ${m.en}`:""} — ${m.bikers.length} بايكر: ${who}`);
    });
  });
  if(!idx)L.push("• لا نواقص مفتوحة | none");
  L.push("");
  L.push("📎 مرفق: تقارير الجولات وصور التوثيق.");
  return L.join("\n");
}

// رسالة التصعيد بعد تجاوز المهلة (ثنائية) | Escalation message referencing the original request
export function buildEscalationMsg(req){
  const created=req.created_at?new Date(req.created_at):new Date();
  const ct=fmtBoth(created);const el=elapsedBoth(req.created_at,new Date());
  const items=req.items||[];
  const L=[];
  L.push("🔴 تصعيد طلب إمداد | Supply Request — ESCALATION");
  L.push("");
  L.push(`بالإشارة إلى طلبنا رقم ${req.ref||"—"} المُرسَل بتاريخ ${ct.ar}،`);
  L.push(`With reference to our request ${req.ref||"—"} submitted on ${ct.en},`);
  L.push(`لم يُستكمَل خلال المهلة (${req.sla_hours||24} ساعة — مضى ${el.ar}). نعيد رفع الطلب للمتابعة والتوفير العاجل.`);
  L.push(`It has not been fulfilled within the SLA (${req.sla_hours||24}h — ${el.en} elapsed). We re-submit it for urgent follow-up.`);
  L.push("");
  L.push(`👤 البايكر | Biker: ${req.biker_name||"—"} (#${req.sweater_id||"—"}) · Partner 47`);
  L.push("النواقص المطلوب توفيرها | Shortages requested:");
  items.forEach((it,i)=>L.push(`${i+1}) #${it.n} ${it.ar}${it.parts_ar?` — ${it.parts_ar}`:""} | ${it.en} — ${it.type}/${it.category} (${it.status_ar})`));
  if(!items.length)L.push("• —");
  L.push("");
  L.push("موجّه إلى | To (مركز الدعم / Jibal Al-Sahil):");
  L.push("   support@jibalalsahil.com, operations@jibalalsahil.com, syed.ali@jibalalsahil.com, ssp@sweater.sa");
  L.push("نسخة/تصعيد إلى سويتر | CC/Escalate to Sweater:");
  L.push("   abd.khrashy@sweater.sa, reem@sweater.sa, m.qurashi@sweater.sa");
  L.push("");
  L.push("📎 مرفق: الطلب الأصلي وتقرير الجولة والإثباتات | Attached: original request, round report & evidence.");
  return L.join("\n");
}

// ── مولّد رسالة الواتساب ثنائي اللغة | Bilingual WhatsApp message builder ──
export function buildWhatsApp(round,opName){
  const results=round.results||{};const notes=round.item_notes||{};
  const now=new Date();const issued=fmtBoth(now);
  const roundISO=round.round_date?`${round.round_date}T${(round.round_time||"00:00")}:00`:null;
  const since=roundISO?elapsedBoth(roundISO,now):null;
  const byN=n=>ITEMS.find(i=>i.n===Number(n));
  // النواقص التي تتطلب توفير بديل (بنود الإدارة/الإمداد: ناقص/بديل جزئي/معفى) | supply items needing a substitute
  const shortages=ITEMS.filter(i=>i.resp==="mgmt"&&["fail","half","excused"].includes(results[i.n]));
  const L=[];
  L.push("🫧 دلو ورغوة × سويتر | Delo & Raghwa × Sweater");
  L.push("📋 تقرير جولة ميدانية | Field Round Report");
  L.push("");
  L.push(`👤 البايكر | Biker: ${round.biker_name||"—"} (#${round.sweater_id||"—"})`);
  L.push(`📅 التاريخ | Date: ${round.round_date||"—"}${round.round_time?" "+round.round_time:""}`);
  L.push(`📊 الالتزام | Compliance: ${round.compliance_pct!=null?round.compliance_pct+"%":"—"}`);
  L.push("");
  if(shortages.length){
    L.push("⚠️ نواقص إمداد تتطلب توفير بديل | Supply shortages needing a substitute:");
    shortages.forEach(i=>{
      const st=MRES_LBL[results[i.n]]||["—","—"];
      L.push(`• #${i.n} ${i.ar} | ${ITEM_EN[i.n]||""} — ${st[0]} / ${st[1]}`);
      if(notes[i.n])L.push(`   ↳ ${notes[i.n]}`);
    });
  }else{
    L.push("✅ لا نواقص إمداد في هذه الجولة | No supply shortages in this round.");
  }
  L.push("");
  L.push(`🕒 وقت الطلب | Request time: ${issued.ar} — ${issued.en}`);
  if(since)L.push(`⏱️ المدة منذ الجولة | Elapsed: ${since.ar} / ${since.en}`);
  L.push("");
  L.push("— آلية التصعيد | Escalation —");
  L.push("1) القناة الأساسية: واتساب مركز الدعم | Primary: support-center WhatsApp group.");
  L.push("2) بعد 24 ساعة بلا حل/رد → البريد | After 24h unresolved → email:");
  L.push("   support@jibalalsahil.com, operations@jibalalsahil.com, syed.ali@jibalalsahil.com, ssp@sweater.sa");
  L.push("3) التصعيد إلى سويتر | Escalate to Sweater:");
  L.push("   abd.khrashy@sweater.sa, reem@sweater.sa, m.qurashi@sweater.sa");
  L.push("");
  L.push("📎 يرجى إرفاق ما يثبت الحالة (مراسلات، صور، تواريخ الطلب والدفع والاستجابة).");
  L.push("📎 Please attach evidence (correspondence, photos, request/payment/response dates).");
  L.push("");
  L.push("⚠ لا يُنظر في الطلبات خارج القنوات الرسمية (واتساب/إيميل) | Requests outside official channels (WhatsApp/email) are not considered.");
  return L.join("\n");
}
