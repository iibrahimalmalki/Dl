// أدوات الوثائق والتجديدات — دوال نقية (بلا React/Supabase) لتُختبر في tests/renewals.test.mjs

// اسم الوثيقة بالبنغالي للرسائل وبوابة البايكر؛ غير المذكور يبقى بالعربي
export const DOC_BN={"إقامة":"ইকামা","رخصة عمل":"ওয়ার্ক পারমিট","جواز سفر":"পাসপোর্ট","رخصة قيادة":"ড্রাইভিং লাইসেন্স","تأمين صحي":"স্বাস্থ্য বীমা"};
export const docBn=t=>DOC_BN[t]||t;

// الأيام المتبقية حتى تاريخ الانتهاء (YYYY-MM-DD) مقارنةً بمنتصف ليل اليوم المحلي
export const daysLeft=(end,today=new Date())=>{
  if(!end)return null;
  const t=new Date(today);t.setHours(0,0,0,0);
  const e=new Date(String(end).slice(0,10)+"T00:00:00");
  return Math.round((e-t)/86400000);
};

// تصنيف الأيام: منتهية / ≤7 / ≤14 / ≤30 / سارية — tone يطابق g-badge (bad|warn|info|ok)
export function docStatus(days){
  if(days==null)return{k:"none",tone:"",ar:"بلا تاريخ"};
  if(days<0)return{k:"expired",tone:"bad",ar:"منتهية"};
  if(days<=7)return{k:"d7",tone:"bad",ar:"عاجلة"};
  if(days<=14)return{k:"d14",tone:"warn",ar:"قريبة"};
  if(days<=30)return{k:"d30",tone:"info",ar:"تنبيه مبكر"};
  return{k:"valid",tone:"ok",ar:"سارية"};
}
export const dayText=d=>d==null?"—":d<0?`منتهية منذ ${-d} يوم`:d===0?"تنتهي اليوم":`خلال ${d} يوم`;
export const dayTextBn=d=>d==null?"—":d<0?`মেয়াদ শেষ ${-d} দিন আগে`:d===0?"আজ শেষ":`${d} দিন বাকি`;

// تبويبات شريط الحالة: كل مفتاح ← شرط على الأيام (null = بلا تاريخ نهاية)
export const STATUS_TABS=[
  {k:"all",ar:"الكل",f:()=>true},
  {k:"urgent",ar:"عاجلة",f:d=>d!=null&&d<=7},
  {k:"d14",ar:"خلال 14",f:d=>d!=null&&d>=0&&d<=14},
  {k:"d30",ar:"خلال 30",f:d=>d!=null&&d>=0&&d<=30},
  {k:"valid",ar:"سارية",f:d=>d!=null&&d>30},
  {k:"expired",ar:"منتهية",f:d=>d!=null&&d<0},
];

// رقم جوال سعودي/دولي → صيغة wa.me (أرقام فقط بمفتاح الدولة)
export function waPhone(m){
  let s=String(m||"").replace(/\D/g,"");
  if(!s)return"";
  if(s.startsWith("00"))s=s.slice(2);
  if(s.length===10&&s.startsWith("05"))s="966"+s.slice(1);
  else if(s.length===9&&s.startsWith("5"))s="966"+s;
  return s;
}

// رسالة البايكر ثنائية اللغة (عربي + বাংলা)
export function bikerMessage({name,docType,end,days}){
  const n=name||"";const d=String(end||"").slice(0,10);
  const ar=days!=null&&days<0?`(منتهية منذ ${-days} يوم)`:`(خلال ${days} يوم)`;
  const bn=days!=null&&days<0?`(মেয়াদ শেষ ${-days} দিন আগে)`:`(${days} দিন বাকি)`;
  return `السلام عليكم ${n}، وثيقة ${docType} تنتهي بتاريخ ${d} ${ar}. يرجى تجهيز المطلوب والتواصل مع الإدارة.\n`+
    `আসসালামু আলাইকুম ${n}, আপনার ${docBn(docType)} ${d} তারিখে শেষ হবে ${bn}। দয়া করে প্রয়োজনীয় কাগজ প্রস্তুত করে অফিসে যোগাযোগ করুন।\n`+
    `— دلو ورغوة`;
}

// ── iCalendar (RFC 5545) ──
const icsEsc=s=>String(s==null?"":s).replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n");
const ymd=d=>String(d).slice(0,10).replace(/-/g,"");
const nextDay=d=>{const x=new Date(String(d).slice(0,10)+"T00:00:00Z");x.setUTCDate(x.getUTCDate()+1);return x.toISOString().slice(0,10).replace(/-/g,"");};
// طيّ الأسطر عند 75 بايت دون قطع حرف UTF-8
function fold(line){
  const enc=new TextEncoder();if(enc.encode(line).length<=75)return line;
  const out=[];let cur="",len=0,lim=75;
  for(const ch of line){const b=enc.encode(ch).length;if(len+b>lim){out.push(cur);cur=" "+ch;len=1+b;lim=75;}else{cur+=ch;len+=b;}}
  out.push(cur);return out.join("\r\n");
}
// docs: [{id,doc_type,subject,end_date,provider,ref_no,active}] — يضمّ السارية التي تنتهي خلال horizon يوماً
export function buildICS(docs,{today=new Date(),horizon=120}={}){
  const stamp=new Date(today).toISOString().replace(/[-:]/g,"").replace(/\.\d+Z$/,"Z");
  const L=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Dalu Warghwah//Renewals//AR","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:تجديد الوثائق — دلو ورغوة"];
  const alarm=(n,title)=>["BEGIN:VALARM","ACTION:DISPLAY",`TRIGGER:-P${n}D`,`DESCRIPTION:${icsEsc(`بعد ${n} يوماً: ${title}`)}`,"END:VALARM"];
  for(const d of docs||[]){
    if(d.active===false||!d.end_date)continue;
    const left=daysLeft(d.end_date,today);
    if(left==null||left<0||left>horizon)continue;
    const title=`انتهاء ${d.doc_type} — ${d.subject||""}`;
    const desc=[d.provider&&`الجهة: ${d.provider}`,d.ref_no&&`الرقم: ${d.ref_no}`].filter(Boolean).join("\n");
    L.push("BEGIN:VEVENT",`UID:${d.id}@dalu-renewals`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${ymd(d.end_date)}`,`DTEND;VALUE=DATE:${nextDay(d.end_date)}`,
      `SUMMARY:${icsEsc(title)}`,...(desc?[`DESCRIPTION:${icsEsc(desc)}`]:[]),"TRANSP:TRANSPARENT",...alarm(14,title),...alarm(7,title),"END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n")+"\r\n";
}
