// محرّك تحليل تقارير سويتر (SSP) — SKL-RPT-001
// يحوّل صفوف التقارير (CSV/XLSX) إلى بيانات منظّمة تغذّي العمليات والرواتب.
// مطابقة أعمدة مرنة لتحمّل اختلاف التسميات بين تصديرات سويتر.

const norm=s=>String(s??"").trim().toLowerCase().replace(/[\s_\-]+/g,"");
// يجد قيمة العمود بمطابقة أي من المرشّحات (تحوي/تساوي) على مفاتيح الصف
export function pick(row,cands){
  const keys=Object.keys(row||{});
  for(const c of cands){const cn=norm(c);
    // مطابقة تامة أولاً
    const exact=keys.find(k=>norm(k)===cn);if(exact)return row[exact];
  }
  for(const c of cands){const cn=norm(c);
    const part=keys.find(k=>norm(k).includes(cn));if(part!=null&&row[part]!=null&&row[part]!=="")return row[part];
  }
  return undefined;
}
export const canonStatus=v=>{const n=norm(v);
  if(n.includes("collectpayment")||n==="collected"||n==="completed"||n.includes("collect"))return"collect_payment";
  if(n.includes("cancelclient")||n.includes("clientcancel")||(n.includes("cancel")&&n.includes("client")))return"cancel_client";
  if(n.includes("canceladmin")||n.includes("admincancel")||(n.includes("cancel")&&n.includes("admin")))return"cancel_admin";
  if(n.includes("cancel"))return"cancel_other";
  return n||"unknown";
};

// تحليل تقرير الحجوزات → تجميع لكل بايكر
// rows: مصفوفة كائنات (من XLSX.utils.sheet_to_json)
export function parseBookings(rows){
  const by={};const statusTotals={};let counted=0;
  (rows||[]).forEach(r=>{
    const name=String(pick(r,["Biker Name","Biker","اسم البايكر","biker"])??"").trim();
    const sid=String(pick(r,["Biker ID","Biker Code","Sweater ID","biker id","رقم البايكر"])??"").trim();
    const status=canonStatus(pick(r,["Booking Status","Status","الحالة","حالة الحجز"]));
    const date=pick(r,["Booking Date","Date","Created At","Completed At","التاريخ","تاريخ"]);
    const ref=String(pick(r,["Booking ID","Booking Number","Booking Ref","Order ID","ID","رقم الحجز"])??"").trim();
    if(!name&&!sid)return;
    const key=sid||name;
    if(!by[key])by[key]={biker_name:name,sweater_id:sid,collect_payment:0,cancel_client:0,cancel_admin:0,other:0,net_washes:0,dates:{}};
    const b=by[key];
    statusTotals[status]=(statusTotals[status]||0)+1;
    if(status==="collect_payment"){b.collect_payment++;b.net_washes++;counted++;}
    else if(status==="cancel_client"){b.cancel_client++;b.net_washes++;counted++;}
    else if(status==="cancel_admin"){b.cancel_admin++;}
    else b.other++;
    // تفصيل يومي للغسلات الصافية
    if((status==="collect_payment"||status==="cancel_client")&&date){const d=fmtDate(date);if(d)b.dates[d]=(b.dates[d]||0)+1;}
    if(name&&!b.biker_name)b.biker_name=name;if(sid&&!b.sweater_id)b.sweater_id=sid;
  });
  return{bikers:Object.values(by),statusTotals,totalRows:(rows||[]).length,netCounted:counted};
}

// تحليل تقرير الجودة (QC) → تقييم لكل بايكر
export function parseQC(rows){
  const by={};
  (rows||[]).forEach(r=>{
    const name=String(pick(r,["Biker Name","Biker","اسم البايكر","biker"])??"").trim();
    const sid=String(pick(r,["Biker ID","Biker Code","Sweater ID","رقم البايكر"])??"").trim();
    const rating=toNum(pick(r,["Rating","Avg Rating","Average Rating","Score","التقييم","متوسط التقييم"]));
    if(!name&&!sid)return;const key=sid||name;
    by[key]={biker_name:name,sweater_id:sid,rating:rating};
  });
  return by; // {key:{rating,...}}
}

// تحليل تقرير التذاكر (الشكاوى)
export function parseTickets(rows){
  return(rows||[]).map((r,i)=>({
    idx:i,
    booking_ref:String(pick(r,["Booking ID","Booking Number","Booking Ref","Order ID","رقم الحجز"])??"").trim(),
    biker_name:String(pick(r,["Biker Name","Biker","اسم البايكر"])??"").trim(),
    sweater_id:String(pick(r,["Biker ID","Biker Code","Sweater ID","رقم البايكر"])??"").trim(),
    ticket_date:fmtDate(pick(r,["Date","Ticket Date","Created At","التاريخ"]))||"",
    description:String(pick(r,["Description","Complaint","Reason","Details","Comment","وصف","الشكوى","الوصف"])??"").trim(),
    has_image:hasImage(pick(r,["Image","Photo","Attachment","Has Image","صورة","مرفق"])),
  })).filter(t=>t.booking_ref||t.description||t.biker_name);
}

// دمج الحجوزات + الجودة + الشكاوى المعتمدة → صف شهري جاهز للرواتب لكل بايكر
export function buildBikerMonth(bookings,qc,ticketDecisions){
  return bookings.bikers.map(b=>{
    const key=b.sweater_id||b.biker_name;
    const q=qc[key]||qc[b.biker_name]||qc[b.sweater_id]||{};
    const approved=(ticketDecisions||[]).filter(t=>(t.sweater_id&&t.sweater_id===b.sweater_id)||(t.biker_name&&t.biker_name===b.biker_name)).filter(t=>t.decision==="approved").length;
    const cpct=b.net_washes?Math.round(approved/b.net_washes*10000)/100:0;
    return{biker_name:b.biker_name,sweater_id:b.sweater_id,net_washes:b.net_washes,
      collect_payment:b.collect_payment,cancel_client:b.cancel_client,cancel_admin:b.cancel_admin,
      rating:q.rating??null,approved_complaints:approved,complaint_pct:cpct,dates:b.dates};
  });
}

function toNum(v){if(v==null||v==="")return null;const n=Number(String(v).replace(/[^\d.\-]/g,""));return isNaN(n)?null:n;}
function hasImage(v){if(v==null)return false;const n=norm(v);if(!n)return false;return!["no","0","false","none","na","-"].includes(n);}
function fmtDate(v){
  if(v==null||v==="")return"";
  if(v instanceof Date&&!isNaN(v))return v.toISOString().slice(0,10);
  const s=String(v).trim();
  const m=s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if(m)return`${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
  const m2=s.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if(m2)return`${m2[3]}-${String(m2[2]).padStart(2,"0")}-${String(m2[1]).padStart(2,"0")}`;
  return"";
}
