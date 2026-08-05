// مولّد تقرير الجولة الميدانية القابل للطباعة/الحفظ (PDF) — بالشعار ومنسّق.
import{ITEMS,AXES,RESP_AR,complianceByAxis,effect,bikerItems}from"./fieldChecklist";

const RES_LBL={pass:["مطابق","#087443","#e7f7ef"],half:["جزئي","#b54708","#fef3e2"],fail:["غير مطابق","#b42318","#feecea"],excused:["معفى (إمداد)","#475569","#eef0f3"]};
const MRES_LBL={pass:["متوفّر","#087443","#e7f7ef"],half:["بديل جزئي","#b54708","#fef3e2"],fail:["ناقص","#b42318","#feecea"],excused:["معفى (إمداد)","#475569","#eef0f3"]};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const LOGO=`<img src="${(typeof location!=="undefined"?location.origin:"")}/brand-mark.png" alt="دلو ورغوة" style="width:34px;height:34px;object-fit:contain"/>`;

function meter(pct,color){const w=pct==null?0:Math.max(pct,2);return`<div class="meter"><div class="mfill" style="width:${w}%;background:${color}"></div></div>`;}

export function buildReportHTML(round,analysis,opName){
  const results=round.results||{};const notes=round.item_notes||{};const photos=round.photos||{};
  const pct=round.compliance_pct;const eff=effect(pct);const byAxis=complianceByAxis(results);
  const axisBlocks=Object.keys(AXES).map(ax=>{
    const a=byAxis[ax];const acol=a.pct==null?"#94a3b8":a.pct>=80?"#12b76a":a.pct>=60?"#f79009":"#f04438";
    const rows=ITEMS.filter(i=>i.axis===ax).map(it=>{
      const mgmt=it.resp==="mgmt";const r=results[it.n];const lbl=(mgmt?MRES_LBL:RES_LBL)[r]||["—","#94a3b8","#f4f5f7"];
      const imgs=(photos[it.n]||[]).filter(Boolean);
      const nprefix=r==="excused"?"ملاحظة الإعفاء: ":r==="fail"?"سبب/إجراء: ":"ملاحظة: ";
      const note=notes[it.n]?`<div class="inote">${nprefix}${esc(notes[it.n])}</div>`:"";
      return`<tr>
        <td class="c-n">${it.n}</td>
        <td class="c-ar">${esc(it.ar)}<div class="c-resp">${RESP_AR[it.resp]}${mgmt?" ⚠":""}</div>${note}
          ${imgs.length?`<div class="c-imgs">${imgs.map(u=>`<img src="${esc(u)}"/>`).join("")}</div>`:""}</td>
        <td class="c-res"><span class="badge" style="color:${lbl[1]};background:${lbl[2]}">${lbl[0]}</span></td>
      </tr>`;}).join("");
    return`<div class="axis"><div class="axis-h"><b>${AXES[ax].ar}</b><span class="axis-pct" style="color:${acol}">${a.pct!=null?a.pct+"%":"—"}</span></div>${meter(a.pct,acol)}
      <table class="tbl">${rows}</table></div>`;
  }).join("");

  const an=analysis||{};
  const anBlock=an.summary?`
    <div class="sec ai">
      <div class="sec-h">🧠 التحليل الذكي</div>
      <p class="ai-sum">${esc(an.summary)}</p>
      <div class="ai-grid">
        <div><b>الاتجاه</b><span>${esc(an.trend?.text||"—")}</span></div>
        ${an.weakestAxis?`<div><b>أضعف محور</b><span>${esc(an.weakestAxis.ar)} (${an.weakestAxis.pct}%)</span></div>`:""}
      </div>
      ${an.priorities?.length?`<div class="ai-list"><b>الأولويات التصحيحية (مهلة ${esc(an.priorities[0].deadline)}):</b><ul>${an.priorities.map(p=>`<li>#${p.n} ${esc(p.ar)} — <i>${esc(p.level)}</i></li>`).join("")}</ul></div>`:""}
      ${an.recurring?.length?`<div class="ai-warn">⚠ مخالفات متكررة عبر الجولات: ${an.recurring.map(r=>"#"+r.n).join("، ")} — يوصى بمراجعة تدريبية فورية.</div>`:""}
      <div class="ai-note">${esc(an.photoNote||"")}</div>
    </div>`:"";

  const sr=an.supportRequest;
  const srBlock=(sr&&sr.items&&sr.items.length)?`
    <div class="sec support">
      <div class="sec-h">📮 طلب مركز دعم سويتر (SSP) — تحويل النواقص</div>
      <p class="sr-intro">تُحوَّل النواقص التالية (مسؤولية الإمداد على سويتر/الإدارة) إلى طلب رسمي لمركز الدعم، مع إعفاء البايكر من أي أثر مالي عليها وفق POL-QUA-001 (9.4):</p>
      <table class="tbl">${sr.items.map((g,i)=>`<tr><td class="c-n">${g.n}</td><td class="c-ar">${esc(g.ar)}<div class="c-resp">${esc(g.reason)}</div></td></tr>`).join("")}</table>
      <div class="sr-status">✔ الحالة: مُحوّل إلى طلب دعم — بانتظار تسليم/استبدال سويتر وتحديد موعد.</div>
    </div>`:`<div class="sec"><div class="sec-h">📮 طلب مركز دعم سويتر</div><p class="sr-intro">لا نواقص إمداد في هذه الجولة — لا حاجة لطلب دعم.</p></div>`;

  return`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير جولة — ${esc(round.biker_name||"")} — ${esc(round.round_date||"")}</title>
<style>
*{box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,sans-serif;color:#0f172a;margin:0;background:#f1f5f9;font-size:13px;line-height:1.6}
.page{max-width:820px;margin:18px auto;background:#fff;box-shadow:0 2px 20px rgba(0,0,0,.08)}
.hd{background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;padding:20px 26px;display:flex;align-items:center;gap:14px}
.logo{width:48px;height:48px;border-radius:13px;background:#fff;border:1px solid #f0e2d6;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(232,113,43,.25)}
.hd b{font-size:17px;display:block}.hd .sub{font-size:11.5px;color:#94a3b8}
.hd .rt{margin-inline-start:auto;text-align:left}.hd .rt .t{font-size:14px;font-weight:800}.hd .rt .r{font-size:10.5px;color:#94a3b8}
.body{padding:22px 26px}
.info{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px}
.info div{background:#fafbfc;border:1px solid #eceef1;border-radius:10px;padding:9px 12px}
.info span{font-size:10px;color:#94a3b8;display:block}.info b{font-size:13px}
.overall{display:flex;align-items:center;gap:16px;flex-wrap:wrap;background:#fafbfc;border:1px solid #eceef1;border-radius:14px;padding:16px;margin-bottom:18px}
.ov-pct{font-size:34px;font-weight:800;letter-spacing:-1px}
.ov-l{font-size:11px;color:#94a3b8}
.eff{padding:7px 14px;border-radius:20px;font-size:12px;font-weight:800}
.meter{height:9px;background:#eef0f3;border-radius:6px;overflow:hidden;margin-top:6px}
.mfill{height:100%;border-radius:6px}
.ov-meter{flex:1;min-width:180px}
.axis{margin-bottom:14px;border:1px solid #eceef1;border-radius:12px;overflow:hidden}
.axis-h{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f8fafc;border-bottom:1px solid #eceef1}
.axis-h b{font-size:13.5px}.axis-pct{font-size:14px;font-weight:800}
.axis .meter{margin:0;border-radius:0;height:5px}
.tbl{width:100%;border-collapse:collapse}
.tbl td{padding:9px 12px;border-bottom:1px solid #f1f3f5;vertical-align:top}
.tbl tr:last-child td{border-bottom:none}
.c-n{width:26px;color:#94a3b8;font-weight:800;font-size:12px}
.c-ar{font-size:12.5px;font-weight:600}
.c-resp{font-size:10px;color:#94a3b8;font-weight:500;margin-top:2px}
.inote{margin-top:5px;font-size:11px;color:#475569;background:#eef0f3;border-radius:7px;padding:5px 8px}
.c-imgs{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.c-imgs img{width:56px;height:56px;object-fit:cover;border-radius:7px;border:1px solid #eceef1}
.c-res{width:92px;text-align:center}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800}
.sec{margin-top:18px;border:1px solid #eceef1;border-radius:12px;padding:14px 16px}
.sec.ai{background:#f6f9ff;border-color:#dbe6fb}
.sec.support{background:#fffdf7;border-color:#fbe9c8}
.sec-h{font-size:13.5px;font-weight:800;margin-bottom:10px}
.ai-sum{font-size:12.5px;margin:0 0 10px}
.ai-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.ai-grid div{background:#fff;border:1px solid #e6eefb;border-radius:9px;padding:8px 10px}
.ai-grid b{font-size:11px;color:#175cd3;display:block}.ai-grid span{font-size:12px}
.ai-list{background:#fff;border:1px solid #e6eefb;border-radius:9px;padding:10px 12px;font-size:12px}
.ai-list ul{margin:6px 0 0;padding-inline-start:18px}.ai-list li{margin-bottom:3px}
.ai-warn{margin-top:8px;color:#b42318;font-size:11.5px;font-weight:700}
.ai-note{margin-top:8px;font-size:11px;color:#64748b}
.sr-intro{font-size:12px;color:#475569;margin:0 0 10px}
.sr-status{margin-top:10px;font-size:12px;font-weight:800;color:#087443;background:#e7f7ef;border-radius:9px;padding:8px 12px}
.sign{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:22px}
.sign div{text-align:center;font-size:11px;color:#64748b}
.sign .line{border-top:1.5px solid #cbd5e1;margin-bottom:6px;padding-top:8px}
.ft{text-align:center;color:#94a3b8;font-size:10.5px;padding:14px;border-top:1px solid #eceef1}
.bar{position:sticky;bottom:0;background:#fff;border-top:1px solid #eceef1;padding:12px;display:flex;gap:10px;justify-content:center}
.pbtn{padding:10px 22px;border:none;border-radius:11px;background:linear-gradient(135deg,#E8712B,#CC5200);color:#fff;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer}
@media print{.bar{display:none}body{background:#fff}.page{box-shadow:none;margin:0;max-width:100%}}
</style></head><body>
<div class="page">
  <div class="hd"><div class="logo">${LOGO}</div><div><b>مؤسسة دلو ورغوة التجارية</b><span class="sub">امتياز سويتر · Delo & Raghwa × Sweater</span></div>
    <div class="rt"><div class="t">تقرير الجولة الميدانية</div><div class="r">FRM-OPS-002 · HR-POL-003-A</div></div></div>
  <div class="body">
    <div class="info">
      <div><span>البايكر</span><b>${esc(round.biker_name||"—")}</b></div>
      <div><span>رقم سويتر</span><b>#${esc(round.sweater_id||"—")}</b></div>
      <div><span>تاريخ الجولة</span><b>${esc(round.round_date||"—")}</b></div>
      <div><span>المكان</span><b>${esc(round.location||"—")}</b></div>
      <div><span>منفّذ الجولة</span><b>${esc(round.inspector||"—")}</b></div>
      <div><span>المشغّل</span><b>${esc(opName||"دلو ورغوة")}</b></div>
    </div>
    <div class="overall">
      <div><div class="ov-pct" style="color:${eff.color}">${pct!=null?pct+"%":"—"}</div><div class="ov-l">الالتزام الإجمالي (بنود البايكر)</div></div>
      <div class="ov-meter">${meter(pct,eff.color)}</div>
      <span class="eff" style="color:${eff.color};background:${eff.bg}">${eff.ar}</span>
    </div>
    ${axisBlocks}
    ${anBlock}
    ${srBlock}
    ${round.notes?`<div class="sec"><div class="sec-h">📝 ملاحظات وإجراءات تصحيحية</div><p style="margin:0;font-size:12.5px">${esc(round.notes)}</p></div>`:""}
    <div class="sign">
      <div><div class="line">منفّذ الجولة</div>${esc(round.inspector||"")}</div>
      <div><div class="line">البايكر</div>${esc(round.biker_name||"")}</div>
      <div><div class="line">إبراهيم المالكي — المالك</div>الاعتماد</div>
    </div>
  </div>
  <div class="ft">تم إصدار هذا التقرير آلياً من منصّة دلو ورغوة · ${esc(new Date().toLocaleString("en-GB"))}</div>
  <div class="bar"><button class="pbtn" onclick="window.print()">طباعة / حفظ PDF</button></div>
</div>
</body></html>`;
}

export function openReport(round,analysis,opName){
  const html=buildReportHTML(round,analysis,opName);
  const w=window.open("","_blank");
  if(!w){return false;}
  w.document.open();w.document.write(html);w.document.close();
  return true;
}
