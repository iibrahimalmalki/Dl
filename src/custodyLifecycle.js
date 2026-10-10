// دورة حياة العهدة: تسجيل أول (baseline) مرة واحدة ← اعتماد/رفض ← «عهدتي الحالية» ← تحديث حالة لقطعة ← اعتماد/رفض ← استبدال.
// دوال نقية بلا DOM ولا Supabase. القاعدة: docs/sql/custody_lifecycle.sql (الأعمدة kind/asset_id/reviewed_*/reject_reason/request_id،
// والدالة custody_review التي تنفّذ الاعتماد في معاملة واحدة).
import{CATALOG,ASSET_TO_CATALOG,catalogByKey,catalogOfAsset}from"./custodyCatalog";
import{isBad}from"./custodyDeclare";

// حالة الإقرار: «declared» (القيمة القائمة منذ البداية) = بانتظار الاعتماد
export const PENDING="declared",APPROVED="approved",REJECTED="rejected";
export const isPending=s=>s===PENDING||s==="submitted"||s==="pending";
export const kindOf=r=>(r&&r.kind)||"baseline";

const CLOSED=["replaced","returned"];
export const isLive=a=>!!a&&!CLOSED.includes(a.status);
// قطع «عهدتي الحالية»: النشطة/المستحقة، والدراجة لها تبويبها الخاص (الاستلام)
export const myPieces=(assets=[])=>assets.filter(a=>isLive(a)&&a.item_type!=="motorcycle");

// حالة التسجيل الأول للبايكر من صفوفه في biker_assets ⇒ none | pending | approved | rejected (مع الصف)
export function baselineState(rows=[]){
  const b=[...rows].filter(r=>kindOf(r)==="baseline").sort((x,y)=>String(y.created_at).localeCompare(String(x.created_at)));
  const cur=b.find(r=>r.status!==REJECTED)||b[0]||null;
  if(!cur)return{state:"none",row:null};
  if(isPending(cur.status))return{state:"pending",row:cur};
  if(cur.status===APPROVED)return{state:"approved",row:cur};
  return{state:"rejected",row:cur};
}

const RANK={good:0,fair:1,poor:2,damaged:3};
export const worst=conds=>conds.filter(Boolean).reduce((a,c)=>(RANK[c]??0)>(RANK[a]??-1)?c:a,null);

const addMonths=(iso,m)=>{const d=new Date(iso+"T00:00:00Z");d.setUTCMonth(d.getUTCMonth()+Math.round(Number(m)||0));return d.toISOString().slice(0,10);};
// أسطر اعتماد التسجيل الأول: قطعة لكل مفتاح كتالوج. قطعة نشطة لنفس البايكر ونفس الصنف (من الجولات) ⇒ تُربط ولا يتغيّر تاريخها.
// items: أصناف الإقرار · assets: قطع custody_assets لنفس البايكر (عبر employees) · start: تاريخ بداية القطع الجديدة
// ⇒ {lines, unmapped}: unmapped = أصناف بلا مفتاح كتالوج (يرفض الخادم الاعتماد إن وُجدت)
export function baselineLines(items=[],assets=[],start){
  const groups=new Map(),unmapped=[];
  (Array.isArray(items)?items:[]).forEach(it=>{const ck=ASSET_TO_CATALOG[it&&it.key];
    if(!ck||!catalogByKey(ck)){unmapped.push(it&&it.key);return;}
    if(!groups.has(ck))groups.set(ck,[]);groups.get(ck).push(it);});
  const lines=[...groups.entries()].map(([ck,its])=>{
    const c=catalogByKey(ck);
    const ex=assets.find(a=>isLive(a)&&catalogOfAsset(a)&&catalogOfAsset(a).key===ck)||null;
    return{catalog_key:ck,item_keys:its.map(i=>i.key),asset_id:ex?ex.id:null,
      name:c.name,name_en:c.en,item_type:c.type,category:c.category,life_months:c.life,lead_days:c.lead,
      condition:worst(its.map(i=>i.condition)),
      // للعرض فقط: القطعة المرتبطة تحتفظ بتاريخها، والجديدة تبدأ من start
      start_date:ex?ex.start_date:start||null,end_date:ex?(ex.end_date||addMonths(ex.start_date,ex.life_months)):(start?addMonths(start,c.life):null)};
  });
  return{lines,unmapped};
}

// المتبقي من عمر القطعة بالأيام (سالب = انتهى)
export function remainingDays(a,today){
  if(!a||!a.start_date)return null;
  const end=a.end_date||addMonths(a.start_date,a.life_months||12);
  return Math.round((new Date(end+"T00:00:00Z")-new Date(String(today).slice(0,10)+"T00:00:00Z"))/864e5);
}

// تصريحات قطعة: التحديثات (asset_id) + أصناف التسجيل الأول المربوطة بها (items[].asset_id)
export function declsOfAsset(assetId,rows=[]){
  return rows.filter(r=>r.asset_id===assetId||(Array.isArray(r.items)&&r.items.some(x=>x&&x.asset_id===assetId)))
    .sort((x,y)=>String(x.created_at).localeCompare(String(y.created_at)));
}
const itemOf=(r,assetId)=>{const its=Array.isArray(r.items)?r.items:[];
  if(kindOf(r)==="update")return its[0]||{};
  const mine=its.filter(x=>x&&x.asset_id===assetId);return mine.length?{...mine[0],condition:worst(mine.map(x=>x.condition))}:{};};

// حالة القطعة في «عهدتي»: آخر حالة معتمدة، وتحديث معلّق؟ وآخر رفض
export function pieceState(asset,rows=[]){
  const ds=declsOfAsset(asset.id,rows);
  const approved=ds.filter(r=>r.status===APPROVED);
  const last=approved[approved.length-1];
  const pending=ds.find(r=>kindOf(r)==="update"&&isPending(r.status))||null;
  const rej=[...ds].reverse().find(r=>kindOf(r)==="update"&&r.status===REJECTED);
  const lastRej=rej&&(!last||String(rej.reviewed_at||rej.created_at)>String(last.reviewed_at||last.created_at))?rej:null;
  return{condition:last?itemOf(last,asset.id).condition||null:null,pending,lastRejection:lastRej?lastRej.reject_reason||"":null,
    canUpdate:!pending&&isLive(asset)};
}

// خطأ نموذج «تحديث الحالة» ⇒ {field, ar, bn} أو null
export function updateError(f={}){
  if(!f.condition)return{field:"condition",ar:"اختر الحالة.",bn:"অবস্থা নির্বাচন করুন।"};
  if(!f.photo)return{field:"photo",ar:"الصورة إلزامية — صوّر القطعة.",bn:"ছবি বাধ্যতামূলক — সরঞ্জামের ছবি তুলুন।"};
  if(isBad(f.condition)&&!String(f.note||"").trim())return{field:"note",ar:"اكتب وش التالف بالضبط — إلزامي للحالة السيئة أو التالفة.",bn:"ঠিক কী নষ্ট লিখুন — খারাপ বা ক্ষতিগ্রস্ত অবস্থায় বাধ্যতামূলক।"};
  return null;
}

// السجل الزمني لقطعة (صفحة العُهد): إنشاء، تسجيل/تحديث، اعتماد/رفض، استبدال
const SRC={round:"من جولة ميدانية",declaration:"من إقرار العهدة",replacement:"بديل لقطعة مُستبدلة",manual:"يدوياً"};
export function timeline(asset,rows=[]){
  const ev=[];
  ev.push({at:asset.created_at||asset.start_date,type:"created",ar:`أُنشئت ${SRC[asset.source]||asset.source||""} · بداية العمر ${asset.start_date}`});
  declsOfAsset(asset.id,rows).forEach(r=>{
    const it=itemOf(r,asset.id),k=kindOf(r)==="update"?"تحديث حالة":"تسجيل أول";
    ev.push({at:r.created_at,type:"declared",ar:`${k}: ${it.condition||"—"}${it.note?" — "+it.note:""}`,photo:it.photo||null,decl:r.id});
    if(r.status===APPROVED)ev.push({at:r.reviewed_at||r.created_at,type:"approved",ar:`اعتُمد${r.request_id?" · طلب استبدال":""}`});
    if(r.status===REJECTED)ev.push({at:r.reviewed_at||r.created_at,type:"rejected",ar:`رُفض: ${r.reject_reason||"—"}`});
  });
  if(asset.status==="replaced"){const m=/استُبدلت (\d{4}-\d{2}-\d{2})/.exec(asset.notes||"");ev.push({at:m?m[1]:null,type:"replaced",ar:"استُبدلت — بدأت قطعة جديدة بعمر جديد"});}
  return ev.sort((a,b)=>String(a.at||"9999").localeCompare(String(b.at||"9999")));
}

// قطعة بديلة عند الاستبدال الفعلي: نفس الصنف، تبدأ اليوم بعمر كامل
export function replacementRow(old,today){
  const c=catalogOfAsset(old);const life=c?c.life:(old.life_months||12),lead=c?c.lead:(old.lead_days||30);
  return{operator_id:old.operator_id||null,employee_id:old.employee_id||null,biker_name:old.biker_name,sweater_id:old.sweater_id,
    item_type:old.item_type,category:old.category,name:old.name,name_en:old.name_en||null,
    start_date:today,life_months:life,lead_days:lead,end_date:addMonths(today,life),status:"active",source:"replacement",notes:`بديل عن ${old.id}`};
}
export{CATALOG};
