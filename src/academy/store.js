// طبقة بيانات الأكاديمية (Supabase). تتحمّل غياب الجداول قبل تطبيق docs/sql/academy.sql:
// القراءة تُرجع ready:false، والكتابة تُرجع {missing:true} بدل الفشل — فتعمل الواجهة وتنبّه أن النتائج لا تُحفظ بعد.
import{supabase,SUPA_URL,SUPA_ANON,ensureFreshToken}from"../supabase";

export const BUCKET="training";
const MISSING=e=>!!e&&(e.code==="42P01"||e.code==="PGRST205"||e.code==="PGRST204"||/training_(attempts|practicals|videos)/.test(String(e.message||""))&&/(does not exist|Could not find|schema cache)/i.test(String(e.message||"")));
const ok=r=>({data:r.data||[],error:r.error&&!MISSING(r.error)?r.error:null,missing:MISSING(r.error)});

// موظف البايكر الحالي: app_users.biker_employee_id = رقم سويتر = employees.employee_id (نفس ربط بوابة البايكر و my_biker_id())
export async function myEmployee(bikerNo){
  if(!bikerNo)return null;
  const{data}=await supabase.from("employees").select("id,full_name,employee_id").eq("employee_id",String(bikerNo).trim()).maybeSingle();
  return data||null;
}

export async function loadMine(empId){
  const[a,p]=await Promise.all([
    supabase.from("training_attempts").select("id,module,pct,pass,mistakes,created_at").eq("employee_id",empId).order("created_at",{ascending:false}).limit(400),
    supabase.from("training_practicals").select("id,kind,mode,pct,pass,minutes,secs,evaluator_name,marks,rules,note,created_at").eq("employee_id",empId).order("created_at",{ascending:false}).limit(200),
  ]);
  const A=ok(a),P=ok(p);
  return{attempts:A.data,practicals:P.data,ready:!A.missing&&!P.missing,error:A.error||P.error};
}

export async function saveAttempt(empId,{module,pct,pass,mistakes}){
  const r=await supabase.from("training_attempts").insert({employee_id:empId,module,pct,pass,mistakes:mistakes||[]}).select("id,module,pct,pass,mistakes,created_at").single();
  if(r.error)return MISSING(r.error)?{missing:true}:{error:r.error};
  return{row:r.data};
}

export async function savePractical(row){
  const r=await supabase.from("training_practicals").insert(row).select("*").single();
  if(r.error)return MISSING(r.error)?{missing:true}:{error:r.error};
  return{row:r.data};
}

// لوحة المتابعة: كل البايكرز + محاولاتهم وتقييماتهم
export async function loadAll(){
  const[e,a,p]=await Promise.all([
    supabase.from("employees").select("id,full_name,employee_id,staff_role").not("employee_id","is",null).order("full_name"),
    supabase.from("training_attempts").select("id,employee_id,module,pct,pass,mistakes,created_at").order("created_at",{ascending:false}).limit(5000),
    supabase.from("training_practicals").select("id,employee_id,kind,mode,pct,pass,minutes,secs,evaluator_name,marks,rules,note,created_at").order("created_at",{ascending:false}).limit(2000),
  ]);
  const A=ok(a),P=ok(p);
  return{employees:e.data||[],attempts:A.data,practicals:P.data,ready:!A.missing&&!P.missing,error:e.error||A.error||P.error};
}

/* ===== الفيديو ===== */
export async function listVideos(){
  const r=await supabase.from("training_videos").select("key,storage_path,size_bytes,uploaded_at");
  if(r.error)return{map:{},missing:MISSING(r.error),error:MISSING(r.error)?null:r.error};
  const map={};(r.data||[]).forEach(v=>{map[v.key]=v;});return{map};
}
const urlCache={};
export async function videoUrl(path){
  const c=urlCache[path];if(c&&c.exp>Date.now()+60000)return c.url;
  const{data,error}=await supabase.storage.from(BUCKET).createSignedUrl(path,3600);
  if(error||!data)return null;
  urlCache[path]={url:data.signedUrl,exp:Date.now()+3600*1000};return data.signedUrl;
}
// رفع ملف أصلي بشريط تقدّم (XHR مباشرة إلى Storage بتوكن الجلسة)، ثم تسجيله في training_videos
export async function uploadVideo(key,file,onProgress){
  const fresh=await ensureFreshToken();
  const{data}=await supabase.auth.getSession();const s=data&&data.session;
  if(!fresh.ok||!s)throw new Error("انتهت الجلسة — سجّل الدخول من جديد");
  const ext=(String(file.name).match(/\.(mp4|mov|webm|m4v)$/i)||[".mp4"])[0].toLowerCase();
  const path=`videos/${key}${ext}`;
  await new Promise((res,rej)=>{
    const x=new XMLHttpRequest();
    x.open("POST",`${SUPA_URL}/storage/v1/object/${BUCKET}/${path}`);
    x.setRequestHeader("Authorization",`Bearer ${s.access_token}`);x.setRequestHeader("apikey",SUPA_ANON);
    x.setRequestHeader("x-upsert","true");x.setRequestHeader("Content-Type",file.type||"video/mp4");x.setRequestHeader("cache-control","3600");
    x.upload.onprogress=e=>{if(e.lengthComputable&&onProgress)onProgress(Math.round(e.loaded/e.total*100));};
    x.onload=()=>{if(x.status>=200&&x.status<300)res();else{let m="HTTP "+x.status;try{const j=JSON.parse(x.responseText);m=j.message||j.error||m;}catch(_){}rej(new Error(m));}};
    x.onerror=()=>rej(new Error("انقطع الاتصال أثناء الرفع"));
    x.send(file);
  });
  delete urlCache[path];
  const r=await supabase.from("training_videos").upsert({key,storage_path:path,size_bytes:file.size,uploaded_by:s.user.id,uploaded_at:new Date().toISOString()},{onConflict:"key"});
  if(r.error)throw r.error;
  return path;
}
