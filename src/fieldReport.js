// مولّد تقرير الجولة الميدانية (PDF) — ثنائي اللغة (عربي/إنجليزي) · صور مضغوطة · سياسة تصعيد.
// Field round report generator — bilingual · compressed images · escalation policy.
import{ITEMS,AXES,complianceByAxis,effect}from"./fieldChecklist";

// حالات البايكر | Biker statuses  [ar, en, textColor, bg]
const RES_LBL={
  pass:["مطابق","Compliant","#087443","#e7f7ef"],
  half:["جزئي","Partial","#b54708","#fef3e2"],
  fail:["غير مطابق","Non-compliant","#b42318","#feecea"],
  excused:["معفى (إمداد)","Exempt (Supply)","#475569","#eef0f3"],
};
// حالات الإمداد/الإدارة | Supply/management statuses
const MRES_LBL={
  pass:["متوفّر","Available","#087443","#e7f7ef"],
  half:["بديل جزئي","Partial substitute","#b54708","#fef3e2"],
  fail:["ناقص","Missing","#b42318","#feecea"],
  excused:["معفى (إمداد)","Exempt (Supply)","#475569","#eef0f3"],
};
const RESP_BI={biker:["البايكر","Biker"],shared:["البايكر + الإدارة","Biker + Management"],mgmt:["الإدارة","Management"]};
const AXES_EN={motorcycle:"Motorcycle",provider:"Service Provider",materials:"Materials",washing:"Washing"};

// ترجمة إنجليزية معتمدة لبنود لائحة الالتزام (14 بنداً) | English translation of the 14 checklist items
export const ITEM_EN={
  1:"Motorcycle is clean, free of visible dust or dirt",
  2:"Delivery box is clean, fit for use and free of new scratches",
  3:"Box is tidy and clean inside",
  4:"Sweater sticker on the box is new, clean and correctly placed",
  5:"Front and rear lights work perfectly",
  6:"Motorcycle is intact, no major scratches or cracks",
  7:"Approved Sweater uniform is available and complete",
  8:"Uniform is clean, free of tears and dirt",
  9:"Cap + official attire + black shoes are available",
  10:"Full protective gear: vest + leg guard + arm guard + helmet",
  11:"Knows each towel's function by its color (5 colors)",
  12:"Cleaning materials bear the Sweater label — not empty or damaged",
  13:"Applies the correct wash sequence: water → soap → sponge → towel",
  14:"Puts vehicle waste in the bag — no littering around the car",
};

const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const LOGO=`<img src="${(typeof location!=="undefined"?location.origin:"")}/brand-mark.png" alt="دلو ورغوة" style="width:34px;height:34px;object-fit:contain"/>`;

// ── التاريخ/الوقت ثنائي اللغة والمدة | Bilingual datetime + elapsed duration ──
const MON_AR=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
function fmtBoth(d){
  if(!(d instanceof Date)||isNaN(d))return{ar:"—",en:"—"};
  const p=n=>String(n).padStart(2,"0");
  const hh=d.getHours(),mm=p(d.getMinutes());
  const h12=((hh+11)%12)+1;const ampmAr=hh<12?"ص":"م",ampmEn=hh<12?"AM":"PM";
  const ar=`${d.getDate()} ${MON_AR[d.getMonth()]} ${d.getFullYear()} · ${h12}:${mm} ${ampmAr}`;
  const en=`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} · ${p(h12)}:${mm} ${ampmEn}`;
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

// ── ضغط الصور: يقلّص كل صورة إلى أبعاد مناسبة ويحوّلها Data-URL لتصغير حجم الـ PDF ──
// Image compression: downscale each photo → JPEG data-URL so the exported PDF stays small (WhatsApp/email friendly)
function shrinkImg(url,maxW,q){
  return new Promise(res=>{
    try{
      const img=new Image();img.crossOrigin="anonymous";
      img.onload=()=>{try{
        const scale=Math.min(1,maxW/(img.naturalWidth||maxW));
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
async function buildImgMap(photos,maxW=760,q=0.68){
  const urls=[...new Set(Object.values(photos||{}).flat().filter(Boolean))];
  const map={};
  await Promise.all(urls.map(async u=>{map[u]=await shrinkImg(u,maxW,q);}));
  return map;
}

function meter(pct,color){const w=pct==null?0:Math.max(pct,2);return`<div class="meter"><div class="mfill" style="width:${w}%;background:${color}"></div></div>`;}

// ── سياسة التواصل والتصعيد المعتمدة (ثنائية اللغة) | Approved communication & escalation policy ──
function policyBlock(){
  return`
  <div class="sec policy">
    <div class="sec-h">📞 آلية التواصل والتصعيد المعتمدة · Approved Communication & Escalation</div>
    <ol class="pol">
      <li><b>القناة الأساسية / Primary:</b> يتم التواصل المبدئي من مشرف مزوّد الخدمة عبر قروب واتساب مركز الدعم فقط.
        <span class="en">Initial contact is made by the service-provider supervisor via the dedicated support-center WhatsApp group only.</span></li>
      <li><b>التصعيد بعد 24 ساعة / After 24h:</b> عند عدم حلّ الطلب أو عدم ورود ردّ خلال 24 ساعة، يُصعَّد عبر البريد إلى:
        <span class="mails">support@jibalalsahil.com · operations@jibalalsahil.com · syed.ali@jibalalsahil.com · ssp@sweater.sa</span>
        <span class="en">If unresolved or no reply within 24 hours, escalate by email to the addresses above.</span></li>
      <li><b>التصعيد إلى سويتر / Escalate to Sweater:</b> عند عدم الحل من مركز الدعم، تُصعَّد الحالة إلى سويتر عبر:
        <span class="mails">abd.khrashy@sweater.sa · reem@sweater.sa · m.qurashi@sweater.sa</span>
        <span class="en">If the support center does not resolve it, escalate to Sweater via the addresses above, per the approved procedure.</span></li>
    </ol>
    <div class="pol-note">⚠ تنويه: مركز الدعم غير مسؤول عن أي طلبات أو شكاوى تُرفع خارج القنوات الرسمية (الواتساب والإيميل)، ولن يُنظر في أي مراسلات مباشرة أو غير موثّقة. يُرجى إرفاق ما يثبت الحالة (مراسلات، صور، تواريخ الطلب والدفع والاستجابة) لضمان سرعة المعالجة.
      <span class="en">Note: the support center is not responsible for any requests or complaints raised outside the official channels (WhatsApp & email); undocumented or direct messages will not be considered. Please attach supporting evidence (correspondence, photos, request/payment/response dates) to speed up processing.</span></div>
  </div>`;
}

export function buildReportHTML(round,analysis,opName,imgMap){
  const results=round.results||{};const notes=round.item_notes||{};const photos=round.photos||{};const iparts=round.item_parts||{};
  const pct=round.compliance_pct;const eff=effect(pct);const byAxis=complianceByAxis(results);
  const IMG=u=>(imgMap&&imgMap[u])||u;
  const now=new Date();const issued=fmtBoth(now);
  const roundISO=round.round_date?`${round.round_date}T${(round.round_time||"00:00")}:00`:null;
  const since=roundISO?elapsedBoth(roundISO,now):null;

  const axisBlocks=Object.keys(AXES).map(ax=>{
    const a=byAxis[ax];const acol=a.pct==null?"#94a3b8":a.pct>=80?"#12b76a":a.pct>=60?"#f79009":"#f04438";
    const rows=ITEMS.filter(i=>i.axis===ax).map(it=>{
      const mgmt=it.resp==="mgmt";const r=results[it.n];const lbl=(mgmt?MRES_LBL:RES_LBL)[r]||["—","—","#94a3b8","#f4f5f7"];
      const imgs=(photos[it.n]||[]).filter(Boolean);
      const npx=r==="excused"?["ملاحظة الإعفاء","Exemption note"]:r==="fail"?["سبب/إجراء","Reason/Action"]:["ملاحظة","Note"];
      const note=notes[it.n]?`<div class="inote"><b>${npx[0]} · ${npx[1]}:</b> ${esc(notes[it.n])}</div>`:"";
      const psel=(iparts[it.n]||[]).filter(Boolean);
      const pEn=psel.map(pa=>{const p=(it.parts||[]).find(x=>x.ar===pa);return p?p.en:pa;});
      const pbadge=psel.length?`<div class="ipart">🔧 الجزء المتأثر · Affected part: <b>${esc(psel.join("، "))}</b> · ${esc(pEn.join(", "))}</div>`:"";
      return`<tr>
        <td class="c-n">${it.n}</td>
        <td class="c-ar"><div class="c-t">${esc(it.ar)}</div><div class="c-en">${esc(ITEM_EN[it.n]||"")}</div>
          <div class="c-resp">${RESP_BI[it.resp][0]} · ${RESP_BI[it.resp][1]}${mgmt?" ⚠":""}</div>${pbadge}${note}
          ${imgs.length?`<div class="c-imgs">${imgs.map(u=>`<img src="${esc(IMG(u))}"/>`).join("")}</div>`:""}</td>
        <td class="c-res"><span class="badge" style="color:${lbl[2]};background:${lbl[3]}">${lbl[0]}</span><span class="badge-en">${lbl[1]}</span></td>
      </tr>`;}).join("");
    return`<div class="axis"><div class="axis-h"><b>${AXES[ax].ar} <span class="axis-en">· ${AXES_EN[ax]}</span></b><span class="axis-pct" style="color:${acol}">${a.pct!=null?a.pct+"%":"—"}</span></div>${meter(a.pct,acol)}
      <table class="tbl">${rows}</table></div>`;
  }).join("");

  const an=analysis||{};
  const anBlock=an.summary?`
    <div class="sec ai">
      <div class="sec-h">🧠 التحليل الذكي · AI Analysis</div>
      <p class="ai-sum">${esc(an.summary)}</p>
      <div class="ai-grid">
        <div><b>الاتجاه · Trend</b><span>${esc(an.trend?.text||"—")}</span></div>
        ${an.weakestAxis?`<div><b>أضعف محور · Weakest axis</b><span>${esc(an.weakestAxis.ar)} (${an.weakestAxis.pct}%)</span></div>`:""}
      </div>
      ${an.priorities?.length?`<div class="ai-list"><b>الأولويات التصحيحية · Corrective priorities (${esc(an.priorities[0].deadline)}):</b><ul>${an.priorities.map(p=>`<li>#${p.n} ${esc(p.ar)} — <i>${esc(p.level)}</i></li>`).join("")}</ul></div>`:""}
      ${an.recurring?.length?`<div class="ai-warn">⚠ مخالفات متكررة · Recurring issues: ${an.recurring.map(r=>"#"+r.n).join("، ")}</div>`:""}
    </div>`:"";

  const sr=an.supportRequest;
  const srBlock=(sr&&sr.items&&sr.items.length)?`
    <div class="sec support">
      <div class="sec-h">📮 طلب مركز دعم سويتر (SSP) · Sweater Support Request — تحويل النواقص · supply shortages</div>
      <p class="sr-intro">تُحوَّل النواقص التالية (مسؤولية الإمداد على سويتر/الإدارة) إلى طلب رسمي، مع إعفاء البايكر من أي أثر مالي وفق POL-QUA-001 (9.4).<br><span class="en">The following shortages (supply responsibility of Sweater/Management) are converted into an official request; the biker is exempt from any financial impact per POL-QUA-001 (9.4).</span></p>
      <table class="tbl">${sr.items.map(g=>`<tr><td class="c-n">${g.n}</td><td class="c-ar"><div class="c-t">${esc(g.ar)}</div><div class="c-en">${esc(ITEM_EN[g.n]||"")}</div><div class="c-resp">${esc(g.reason)}</div></td></tr>`).join("")}</table>
      <div class="sr-status">✔ الحالة · Status: مُحوّل إلى طلب دعم — بانتظار تسليم/استبدال سويتر · Converted to a support request — awaiting Sweater delivery/replacement.</div>
    </div>`:"";

  return`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تقرير جولة · Field Report — ${esc(round.biker_name||"")} — ${esc(round.round_date||"")}</title>
<style>
*{box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,sans-serif;color:#0f172a;margin:0;background:#f1f5f9;font-size:13px;line-height:1.55}
.page{max-width:820px;margin:16px auto;background:#fff;box-shadow:0 2px 20px rgba(0,0,0,.08)}
.hd{background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;padding:18px 24px;display:flex;align-items:center;gap:13px}
.logo{width:46px;height:46px;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(232,113,43,.25)}
.hd b{font-size:16px;display:block}.hd .sub{font-size:11px;color:#94a3b8}
.hd .rt{margin-inline-start:auto;text-align:left}.hd .rt .t{font-size:13px;font-weight:800}.hd .rt .t2{font-size:11px;color:#cbd5e1;font-weight:700}.hd .rt .r{font-size:10px;color:#94a3b8}
.body{padding:20px 24px}
.info{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin-bottom:14px}
.info div{background:#fafbfc;border:1px solid #eceef1;border-radius:10px;padding:8px 11px}
.info span{font-size:9.5px;color:#94a3b8;display:block}.info b{font-size:12.5px}
.overall{display:flex;align-items:center;gap:16px;flex-wrap:wrap;background:#fafbfc;border:1px solid #eceef1;border-radius:14px;padding:15px;margin-bottom:16px}
.ov-pct{font-size:32px;font-weight:800;letter-spacing:-1px;line-height:1}
.ov-l{font-size:10.5px;color:#94a3b8;margin-top:3px}
.eff{padding:7px 14px;border-radius:20px;font-size:12px;font-weight:800}
.meter{height:8px;background:#eef0f3;border-radius:6px;overflow:hidden;margin-top:6px}
.mfill{height:100%;border-radius:6px}
.ov-meter{flex:1;min-width:170px}
.stamp{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.stamp div{flex:1;min-width:150px;background:#f6f9ff;border:1px solid #dbe6fb;border-radius:10px;padding:8px 11px}
.stamp span{font-size:9.5px;color:#175cd3;font-weight:700;display:block}
.stamp .v1{font-size:12px;font-weight:700}.stamp .v2{font-size:10.5px;color:#64748b}
.axis{margin-bottom:13px;border:1px solid #eceef1;border-radius:12px;overflow:hidden;page-break-inside:avoid}
.axis-h{display:flex;align-items:center;justify-content:space-between;padding:9px 13px;background:#f8fafc;border-bottom:1px solid #eceef1}
.axis-h b{font-size:13px}.axis-en{font-size:11px;color:#94a3b8;font-weight:700}.axis-pct{font-size:14px;font-weight:800}
.axis .meter{margin:0;border-radius:0;height:4px}
.tbl{width:100%;border-collapse:collapse}
.tbl td{padding:9px 12px;border-bottom:1px solid #f1f3f5;vertical-align:top}
.tbl tr:last-child td{border-bottom:none}
.c-n{width:24px;color:#94a3b8;font-weight:800;font-size:12px}
.c-t{font-size:12.5px;font-weight:700}
.c-en{font-size:10.5px;color:#94a3b8;font-weight:500;margin-top:1px;direction:ltr;text-align:right}
.c-resp{font-size:9.5px;color:#94a3b8;font-weight:500;margin-top:3px}
.inote{margin-top:6px;font-size:11px;color:#475569;background:#eef0f3;border-radius:7px;padding:6px 9px}
.inote b{color:#334155}
.ipart{margin-top:5px;font-size:11px;color:#b54708;background:#fff7ed;border:1px solid #f6dcb8;border-radius:7px;padding:5px 9px;font-weight:600}
.ipart b{color:#92600e}
.c-imgs{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}
.c-imgs img{width:96px;height:96px;object-fit:cover;border-radius:8px;border:1px solid #e6e9ee;background:#f4f5f7}
.c-res{width:96px;text-align:center}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800}
.badge-en{display:block;font-size:9px;color:#94a3b8;font-weight:700;margin-top:3px}
.sec{margin-top:16px;border:1px solid #eceef1;border-radius:12px;padding:13px 15px;page-break-inside:avoid}
.sec.ai{background:#f6f9ff;border-color:#dbe6fb}
.sec.support{background:#fffdf7;border-color:#fbe9c8}
.sec.policy{background:#f7fbf9;border-color:#cfe9dc}
.sec-h{font-size:13px;font-weight:800;margin-bottom:9px}
.ai-sum{font-size:12px;margin:0 0 10px}
.ai-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.ai-grid div{background:#fff;border:1px solid #e6eefb;border-radius:9px;padding:8px 10px}
.ai-grid b{font-size:10.5px;color:#175cd3;display:block}.ai-grid span{font-size:11.5px}
.ai-list{background:#fff;border:1px solid #e6eefb;border-radius:9px;padding:9px 11px;font-size:11.5px}
.ai-list ul{margin:6px 0 0;padding-inline-start:18px}.ai-list li{margin-bottom:3px}
.ai-warn{margin-top:8px;color:#b42318;font-size:11px;font-weight:700}
.sr-intro{font-size:11.5px;color:#475569;margin:0 0 10px}
.sr-status{margin-top:10px;font-size:11.5px;font-weight:800;color:#087443;background:#e7f7ef;border-radius:9px;padding:8px 11px}
.en{color:#64748b;display:block;margin-top:2px;font-size:10.5px}
.pol{margin:0;padding-inline-start:20px;font-size:11.5px}
.pol li{margin-bottom:9px}
.pol b{color:#0f172a}
.mails{display:block;direction:ltr;text-align:right;font-size:10.5px;color:#0b6b53;font-weight:700;background:#e7f7ef;border-radius:7px;padding:5px 8px;margin:4px 0}
.pol-note{margin-top:8px;font-size:10.5px;color:#8a5a12;background:#fff8ec;border:1px solid #f6e2bf;border-radius:9px;padding:9px 11px}
.sign{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:20px}
.sign div{text-align:center;font-size:10.5px;color:#64748b}
.sign .line{border-top:1.5px solid #cbd5e1;margin-bottom:6px;padding-top:8px}
.ft{text-align:center;color:#94a3b8;font-size:10px;padding:13px;border-top:1px solid #eceef1}
.bar{position:sticky;bottom:0;background:#fff;border-top:1px solid #eceef1;padding:11px;display:flex;gap:10px;justify-content:center}
.pbtn{padding:10px 22px;border:none;border-radius:11px;background:linear-gradient(135deg,#E8712B,#CC5200);color:#fff;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer}
@media print{.bar{display:none}body{background:#fff}.page{box-shadow:none;margin:0;max-width:100%}}
</style></head><body>
<div class="page">
  <div class="hd"><div class="logo">${LOGO}</div><div><b>مؤسسة دلو ورغوة التجارية</b><span class="sub">امتياز سويتر · Delo &amp; Raghwa × Sweater</span></div>
    <div class="rt"><div class="t">تقرير الجولة الميدانية</div><div class="t2">Field Round Report</div><div class="r">FRM-OPS-002 · HR-POL-003-A</div></div></div>
  <div class="body">
    <div class="info">
      <div><span>البايكر · Biker</span><b>${esc(round.biker_name||"—")}</b></div>
      <div><span>رقم سويتر · Sweater ID</span><b>#${esc(round.sweater_id||"—")}</b></div>
      <div><span>تاريخ الجولة · Round date</span><b>${esc(round.round_date||"—")}${round.round_time?" · "+esc(round.round_time):""}</b></div>
      <div><span>المكان · Location</span><b>${esc(round.location||"—")}</b></div>
      <div><span>منفّذ الجولة · Inspector</span><b>${esc(round.inspector||"—")}</b></div>
      <div><span>المشغّل · Operator</span><b>${esc(opName||"دلو ورغوة")}</b></div>
    </div>
    <div class="overall">
      <div><div class="ov-pct" style="color:${eff.color}">${pct!=null?pct+"%":"—"}</div><div class="ov-l">الالتزام الإجمالي (بنود البايكر) · Overall compliance (biker items)</div></div>
      <div class="ov-meter">${meter(pct,eff.color)}</div>
      <span class="eff" style="color:${eff.color};background:${eff.bg}">${eff.ar}</span>
    </div>
    <div class="stamp">
      <div><span>🕒 وقت الإصدار · Issued at</span><div class="v1">${issued.ar}</div><div class="v2">${issued.en}</div></div>
      ${since?`<div><span>⏱️ المدة منذ الجولة · Elapsed since round</span><div class="v1">${since.ar}</div><div class="v2">${since.en}</div></div>`:""}
    </div>
    ${axisBlocks}
    ${anBlock}
    ${srBlock}
    ${round.notes?`<div class="sec"><div class="sec-h">📝 ملاحظات وإجراءات · Notes &amp; Actions</div><p style="margin:0;font-size:12px">${esc(round.notes)}</p></div>`:""}
    ${policyBlock()}
    <div class="sign">
      <div><div class="line">منفّذ الجولة · Inspector</div>${esc(round.inspector||"")}</div>
      <div><div class="line">البايكر · Biker</div>${esc(round.biker_name||"")}</div>
      <div><div class="line">إبراهيم المالكي — المالك · Owner</div>الاعتماد · Approval</div>
    </div>
  </div>
  <div class="ft">تم إصدار هذا التقرير آلياً من منصّة دلو ورغوة · Auto-generated by the Delo &amp; Raghwa platform · ${esc(issued.en)}</div>
  <div class="bar"><button class="pbtn" onclick="window.print()">طباعة / حفظ PDF · Print / Save PDF</button></div>
</div>
</body></html>`;
}

// يفتح التقرير في نافذة جديدة بعد ضغط الصور (حجم PDF صغير مناسب للواتساب/الإيميل)
// Opens the report in a new window after compressing images (small PDF for WhatsApp/email)
export async function openReport(round,analysis,opName){
  const w=window.open("","_blank");
  if(!w)return false;
  try{
    w.document.write(`<!doctype html><meta charset="utf-8"><div style="font-family:Tahoma;padding:40px;text-align:center;color:#475569">جارٍ تجهيز التقرير وضغط الصور…<br>Preparing report &amp; compressing images…</div>`);
  }catch(_){}
  let imgMap={};
  try{imgMap=await buildImgMap(round.photos);}catch(_){imgMap={};}
  const html=buildReportHTML(round,analysis,opName,imgMap);
  try{w.document.open();w.document.write(html);w.document.close();}catch(_){return false;}
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
  L.push("🫧 دلو ورغوة × سويتر | Delo & Raghwa × Sweater");
  L.push("📋 طلب إمداد — نواقص جولة ميدانية | Supply Request — Field Round Shortages");
  L.push("");
  L.push(`🔖 مرجع الطلب | Ref: ${req.ref||"—"}`);
  L.push(`👤 البايكر | Biker: ${req.biker_name||"—"} (#${req.sweater_id||"—"})`);
  L.push(`🗓️ وقت الجولة | Round: ${req.round_date||"—"}${req.round_time?" "+req.round_time:""}`);
  L.push(`🕒 وقت رفع الطلب | Submitted: ${ct.ar} — ${ct.en}`);
  L.push(`🏷️ الإدارة الطالبة | Requesting dept: ${req.requesting_dept||"التشغيل — دلو ورغوة"} · Partner 47`);
  L.push("");
  L.push("أثناء الجولة الميدانية وُجدت النواقص التالية والمطلوب توفيرها:");
  L.push("During the field round, the following shortages were found and are requested:");
  items.forEach((it,i)=>{
    L.push(`${i+1}) #${it.n} ${it.ar} | ${it.en}`);
    if(it.parts_ar)L.push(`   • الجزء المطلوب | Part needed: ${it.parts_ar} / ${it.parts_en}`);
    L.push(`   • النوع/الفئة | Type/Category: ${it.type} — ${it.category}${it.category_en?` (${it.category_en})`:""}`);
    L.push(`   • الحالة | Status: ${it.status_ar} / ${it.status_en}${it.note?` — ${it.note}`:""}`);
  });
  if(!items.length)L.push("• لا نواقص | none");
  L.push("");
  L.push("— آلية التصعيد | Escalation —");
  L.push("1) القناة الأساسية: هذا القروب (مركز الدعم) | Primary: this support group.");
  L.push("2) بعد 24 ساعة بلا حل/رد → البريد | After 24h → email:");
  L.push("   support@jibalalsahil.com, operations@jibalalsahil.com, syed.ali@jibalalsahil.com, ssp@sweater.sa");
  L.push("3) التصعيد إلى سويتر | Escalate to Sweater:");
  L.push("   abd.khrashy@sweater.sa, reem@sweater.sa, m.qurashi@sweater.sa");
  L.push("");
  L.push("📎 مرفق: تقرير الجولة (PDF) وصور التوثيق | Attached: round report (PDF) & evidence photos.");
  L.push("⚠ لا يُنظر في الطلبات خارج القنوات الرسمية (واتساب/إيميل) | Requests outside official channels are not considered.");
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
