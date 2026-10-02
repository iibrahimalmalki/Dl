// استيراد ملفات سويتر (SSP) للإقفال الشهري — دوال نقية بلا Supabase.
// المدخل: [{kind, filename, rows}] حيث rows من XLSX.utils.sheet_to_json، والمخرج: أرقام شهر واحد فقط.
// القواعد مُتحقَّق منها على ملفات حقيقية؛ أي تعديل هنا يغيّر أرقام الرواتب والتسوية.
import * as XLSX from"xlsx";

export const KINDS=["bookings","tickets","comp","add","deduct","maintenance","ratings_cum","tips_cum","summary_cum"];
export const KIND_AR={bookings:"الحجوزات",tickets:"التذاكر",comp:"تعويضات العملاء",add:"إلغاء العميل (إضافة)",deduct:"إلغاء البايكر (خصم)",maintenance:"إلغاء للصيانة",ratings_cum:"التذاكر والتقييمات (تراكمي)",tips_cum:"الحجوزات والإكراميات (تراكمي)",summary_cum:"ملخص الخصومات والتعويضات (تراكمي)"};

// الأنماط الأطول أولاً: biker_bookings_and_tips و bikers_tickets_and_ratings يحويان كلمات bookings/tickets
const NAME_RULES=[
  ["deductions_and_compensations_summary_report","summary_cum"],
  ["bikers_tickets_and_ratings_report","ratings_cum"],
  ["biker_bookings_and_tips_report","tips_cum"],
  ["bookings_cancelled_due_to_maintenance","maintenance"],
  ["customer_cancelled_bookings","add"],
  ["biker_cancelled_bookings","deduct"],
  ["customer_compensations","comp"],
  ["bookings_report","bookings"],
  ["tickets_report","tickets"],
];

// تطبيع اسم العمود: إزالة BOM، حروف صغيرة، "_" كمسافة
export const normH=h=>String(h??"").replace(/^﻿/,"").replace(/_/g," ").replace(/\s+/g," ").trim().toLowerCase();
const normRow=r=>{const o={};Object.keys(r||{}).forEach(k=>{o[normH(k)]=r[k];});return o;};
const str=v=>v==null?"":(v instanceof Date?toISO(v)||"":String(v).trim());

export function detectKind(filename,headers){
  const f=String(filename||"").toLowerCase().replace(/[\s-]+/g,"_");
  for(const[p,k]of NAME_RULES)if(f.includes(p))return k;
  const raw=(headers||[]).map(h=>String(h??""));const H=new Set(raw.map(normH));
  if(H.has("booking status"))return"bookings";
  if(H.has("ticket description"))return"tickets";
  if(H.has("discount value")||H.has("sub category name"))return"comp";
  if(raw.some(h=>/tip/i.test(h)))return"tips_cum";
  // ملفات الإلغاء الثلاثة بنفس الأعمدة؛ الصيانة وحدها بشرطات سفلية
  if(H.has("booked slot")&&H.has("cancel reason")&&raw.some(h=>/^﻿?booking_id$/i.test(h.trim())))return"maintenance";
  return null;
}

// ملف → صفوف بنفس مكتبة العمليات اليومية. raw:true يُبقي نصوص CSV كما هي (بلا تخمين تواريخ بمنطقة زمنية)
// وفي xlsx تبقى التواريخ أرقاماً تسلسلية يحوّلها toISO.
export function readSheet(buf){
  const wb=XLSX.read(buf,{type:buf instanceof ArrayBuffer||ArrayBuffer.isView(buf)?"array":"string",raw:true});
  const ws=wb.Sheets[wb.SheetNames[0]];
  const headers=((XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:""})[0])||[]).map(h=>String(h));
  return{headers,rows:XLSX.utils.sheet_to_json(ws,{defval:"",raw:true})};
}

const MONTHS=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const pad=n=>String(n).padStart(2,"0");
const ymd=(y,m,d)=>`${y}-${pad(m)}-${pad(d)}`;
// → YYYY-MM-DD بلا إزاحة منطقة زمنية
export function toISO(v){
  if(v==null||v==="")return null;
  if(v instanceof Date){if(isNaN(v))return null;
    // منتصف ليل UTC → مكوّنات UTC، وإلا المكوّنات المحلية (SheetJS ينشئ تواريخ محلية)
    return v.getUTCHours()===0&&v.getUTCMinutes()===0?ymd(v.getUTCFullYear(),v.getUTCMonth()+1,v.getUTCDate()):ymd(v.getFullYear(),v.getMonth()+1,v.getDate());}
  if(typeof v==="number"){if(!isFinite(v)||v<1)return null;const d=new Date(Date.UTC(1899,11,30)+Math.floor(v)*864e5);return ymd(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate());}
  const s=String(v).trim();let m;
  if((m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)))return ymd(m[1],+m[2],+m[3]);
  if((m=s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})/))){const i=MONTHS.indexOf(m[2].slice(0,3).toLowerCase());if(i>=0)return ymd(m[3],i+1,+m[1]);}
  if((m=s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/))){const i=MONTHS.indexOf(m[1].slice(0,3).toLowerCase());if(i>=0)return ymd(m[3],i+1,+m[2]);}
  if((m=s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/)))return ymd(m[3],+m[2],+m[1]);
  if(/^\d+(\.\d+)?$/.test(s))return toISO(Number(s));
  return null;
}

export function splitBiker(s){
  const t=String(s??"").trim();const m=t.match(/^(.*?)\s*\(\s*([^()]+?)\s*\)\s*$/);
  return m?{name:m[1].trim(),sid:m[2]}:{name:t,sid:null};
}

// تاريخ التصدير من اسم الملف: ..._2026-09-26T20_44_57...
export const exportDateOf=fn=>{const m=String(fn||"").match(/(\d{4}-\d{2}-\d{2})T\d{2}[_:]\d{2}/);return m?m[1]:null;};

// عزل النص اللاتيني/التواريخ داخل الجمل العربية (FSI…PDI) حتى لا ينقلب ترتيبها
const iso=t=>`\u2068${t}\u2069`;
const numOrNull=v=>{if(v==null)return null;const s=String(v).trim();if(!s||/^n\/?a$/i.test(s))return null;const n=Number(s);return isFinite(n)?n:null;};
const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length*100)/100:null;
const status=v=>String(v??"").trim().toLowerCase().replace(/[\s-]+/g,"_");
const CLOSED=new Set(["collect_payment","cancel_client","cancel_admin"]);
const OPEN=new Set(["initiated","to_be_allocated"]);
const lastDayOf=p=>{const[y,m]=p.split("-").map(Number);return ymd(y,m,new Date(Date.UTC(y,m,0)).getUTCDate());};

const REQ={
  bookings:["booking id","booking date","booking status","biker name","rating (biker behavior)","rating (wash quality)"],
  add:["booking id","booking date","biker name"],deduct:["booking id","booking date","biker name"],maintenance:["booking id","booking date","biker name"],
  tickets:["booking id","booking date","biker name","ticket description"],
  comp:["booking id","booking date","discount value"],
};

export function buildMonth(files,period){
  const warnings=[];const W=(code,ar)=>warnings.push({code,ar});
  const refs={ratings_cum:null,tips_cum:null,summary_cum:null};
  const by={};const usable={};const given=new Set();const noSid=new Set();let exportDate=null;
  (files||[]).forEach(f=>{
    if(!f.kind){W("unknown_file",`ملف غير معروف: ${iso(f.filename)}`);return;}
    given.add(f.kind);
    if(f.kind in refs){refs[f.kind]=(refs[f.kind]||[]).concat(f.rows||[]);return;}
    const rows=(f.rows||[]).map(normRow);
    const have=new Set(Object.keys(rows[0]||{}));
    const miss=(REQ[f.kind]||[]).filter(c=>!have.has(c));
    if(rows.length&&miss.length){miss.forEach(c=>W("missing_cols",`عمود ناقص «${iso(c)}» في ${iso(f.filename)}`));return;}
    if(f.kind==="bookings"){const e=exportDateOf(f.filename);if(e&&(!exportDate||e>exportDate))exportDate=e;}
    (usable[f.kind]=usable[f.kind]||[]).push(...rows);
  });
  const inMonth=r=>{const d=toISO(r["booking date"]);return d&&d.slice(0,7)===period?d:null;};
  const biker=v=>{const b=splitBiker(v);if(b.name&&!b.sid)noSid.add(b.name);return b;};

  // الحجوزات — بلا تكرار لنفس رقم الحجز
  const seen=new Map();(usable.bookings||[]).forEach(r=>{const d=inMonth(r);if(!d)return;const id=str(r["booking id"]);seen.set(id||Symbol(),{r,d});});
  const days={};let open=0;const openBy={};let minD=null,maxD=null,lastWash=null;
  seen.forEach(({r,d})=>{
    const st=status(r["booking status"]);
    if(!minD||d<minD)minD=d;if(!maxD||d>maxD)maxD=d;
    if(OPEN.has(st)){open++;openBy[st]=(openBy[st]||0)+1;return;}
    const q=numOrNull(r["rating (wash quality)"]),bh=numOrNull(r["rating (biker behavior)"]);
    const nm=str(r["biker name"]);
    if(nm){const b=biker(nm);const key=b.sid||b.name;
      const o=by[key]||(by[key]={sweater_id:b.sid,biker_name:b.name,net_washes:0,collect_payment:0,cancel_client:0,cancel_admin:0,_r:[],daily:{}});
      if(q!=null)o._r.push(q);if(bh!=null)o._r.push(bh);
      if(st==="collect_payment"){o.collect_payment++;o.daily[d]=(o.daily[d]||0)+1;}
      else if(st==="cancel_client")o.cancel_client++;else if(st==="cancel_admin")o.cancel_admin++;}
    if(!CLOSED.has(st))return;
    const x=days[d]||(days[d]={day:d,period,total_bookings:0,washes:0,cancel_client:0,cancel_admin:0,_q:[],_b:[]});
    x.total_bookings++;if(st==="collect_payment"){x.washes++;if(!lastWash||d>lastWash)lastWash=d;}else x[st]++;
    if(q!=null)x._q.push(q);if(bh!=null)x._b.push(bh);
  });
  const bikers=Object.values(by).map(({_r,...o})=>({...o,net_washes:o.collect_payment,rating:avg(_r),days:Object.keys(o.daily).length}))
    .sort((a,b)=>b.net_washes-a.net_washes);
  const daily=Object.values(days).sort((a,b)=>a.day<b.day?-1:1).map(({_q,_b,...x})=>({...x,avg_quality:avg(_q),avg_behavior:avg(_b)}));

  // الإضافات والخصومات والصيانة
  const adjustments=[];const adjSeen=new Set();
  ["add","deduct","maintenance"].forEach(kind=>(usable[kind]||[]).forEach(r=>{const d=inMonth(r);if(!d)return;
    const ref=str(r["booking id"]);const k=kind+"|"+ref;if(ref&&adjSeen.has(k))return;adjSeen.add(k);
    const b=biker(r["biker name"]);
    adjustments.push({period,kind,booking_ref:ref,booking_date:d,booked_slot:str(r["booked slot"])||null,cancel_reason:str(r["cancel reason"])||null,biker_name:b.name,sweater_id:b.sid});}));

  // التذاكر + دمج التعويضات بنفس رقم الحجز
  const tickets=[];const tkSeen=new Set();
  (usable.tickets||[]).forEach(r=>{const d=inMonth(r);if(!d)return;const ref=str(r["booking id"]),desc=str(r["ticket description"]);
    const k=ref+"|"+desc;if(tkSeen.has(k))return;tkSeen.add(k);const b=biker(r["biker name"]);
    tickets.push({period,booking_ref:ref,sweater_id:b.sid,biker_name:b.name,ticket_date:d,description:desc,sub_category:null,compensation:null});});
  let freeWash=0,otherComp=0;const compSeen=new Set();
  (usable.comp||[]).forEach(r=>{const d=inMonth(r);if(!d)return;const ref=str(r["booking id"]);if(ref&&compSeen.has(ref))return;compSeen.add(ref);
    const val=str(r["discount value"]),sub=str(r["sub category name"])||null;
    if(/free\s*wash/i.test(val))freeWash++;else{const n=numOrNull(val);if(n!=null)otherComp+=n;}
    const t=tickets.find(x=>x.booking_ref===ref);
    if(t){t.sub_category=sub;t.compensation=val||null;}
    else{const b=biker(r["biker name"]);tickets.push({period,booking_ref:ref,sweater_id:b.sid,biker_name:b.name,ticket_date:d,description:sub||"",sub_category:sub,compensation:val||null});}});

  const cnt=k=>adjustments.filter(a=>a.kind===k).length;
  const online=bikers.reduce((s,b)=>s+b.net_washes,0);
  const summary={online,add:cnt("add"),deduct:cnt("deduct"),maintenance:cnt("maintenance"),freeWash,otherComp:Math.round(otherComp*100)/100};
  summary.expectedNet=summary.online+summary.add-summary.deduct-summary.maintenance-summary.freeWash;

  const monthEnd=lastDayOf(period);const asOf=exportDate||new Date().toISOString().slice(0,10);
  const complete=!(open>0||(maxD!=null&&maxD<monthEnd&&asOf<=monthEnd));
  const coverage={min:minD,max:maxD,lastWashDay:lastWash,open,openBy,exportDate,complete};

  if(!given.has("bookings"))W("no_bookings","لا يوجد ملف الحجوزات (bookings_report) — وهو إلزامي");
  else if(usable.bookings&&!seen.size)W("empty_month","ملف الحجوزات لا يحوي صفوفاً لهذا الشهر");
  if(seen.size&&!complete)W("incomplete",`الشهر غير مكتمل — ${open} حجزاً مفتوحاً${open?` (${Object.entries(openBy).map(([k,v])=>iso(`${k}: ${v}`)).join("، ")})`:""}، آخر يوم فيه غسلة ${lastWash?iso(lastWash):"—"}`);
  if(noSid.size)W("no_sid",`بايكر بلا رقم سويتر بين قوسين: ${[...noSid].join("، ")}`);

  return{bikers,daily,adjustments,tickets,summary,coverage,refs,warnings};
}
