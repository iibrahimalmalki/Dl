import{createClient}from"@supabase/supabase-js";
export const supabase=createClient("https://cnmggdrlkgsyrjxmvydv.supabase.co","eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNubWdnZHJsa2dzeXJqeG12eWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMjc3NDYsImV4cCI6MjA5MTYwMzc0Nn0.gUvtS3AgNhF69D8CimZxGHTbCoGDw5u2fDStgKcTI8Q");
export const SITE_URL="https://db1-sandy.vercel.app";

// يضمن توكن دخول صالح قبل عمليات التخزين (الرفع).
// على الجوال، فتح الكاميرا يُخلّي الصفحة في الخلفية فيتوقّف تجديد التوكن التلقائي،
// فيعود التوكن منتهياً ويُعامَل الرفع كزائر مجهول → يرفضه أمان الصفوف.
// نتحقّق يدوياً ونجدّد إن لزم قبل الرفع.
export async function ensureFreshToken(){
  try{
    const{data}=await supabase.auth.getSession();
    const s=data&&data.session;
    if(!s)return{ok:false,reason:"no-session"};
    const expMs=(s.expires_at||0)*1000;
    // جدّد إذا انتهى أو يقارب الانتهاء خلال 120 ثانية
    if(!expMs||expMs-Date.now()<120000){
      const{data:r,error}=await supabase.auth.refreshSession();
      if(error||!r?.session)return{ok:false,reason:"refresh-failed"};
    }
    return{ok:true};
  }catch(e){return{ok:false,reason:String(e&&e.message||e)};}
}

// يصغّر أبعاد الصورة ويعيد ترميزها JPEG (يعالج HEIC والملفات الكبيرة من كاميرا الجوال).
// يفشل بأمان: يُعيد الملف الأصلي إن تعذّر المعالجة.
export async function compressImage(file,maxDim=1600,quality=0.82){
  try{
    if(!file||!file.type||!file.type.startsWith("image/"))return file;
    const dataUrl=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(file);});
    const img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=dataUrl;});
    let{width:w,height:h}=img;
    if(!w||!h)return file;
    if(Math.max(w,h)>maxDim){const sc=maxDim/Math.max(w,h);w=Math.round(w*sc);h=Math.round(h*sc);}
    const cv=document.createElement("canvas");cv.width=w;cv.height=h;
    cv.getContext("2d").drawImage(img,0,0,w,h);
    const blob=await new Promise(res=>cv.toBlob(res,"image/jpeg",quality));
    if(!blob)return file;
    // إن كان الأصل أصغر من الناتج (نادر) أبقِ الأصل
    if(file.size&&blob.size>file.size&&file.type==="image/jpeg")return file;
    return new File([blob],(String(file.name||"photo").replace(/\.[^.]+$/,""))+".jpg",{type:"image/jpeg"});
  }catch(e){return file;}
}

// معرّف جلسة ثابت لكل زائر — يُستخدم لبناء قمع التحويل (بدون هوية شخصية)
export function getVisitorSession(){
  try{
    let id=sessionStorage.getItem("dalu_visitor_session");
    if(!id){id=crypto.randomUUID();sessionStorage.setItem("dalu_visitor_session",id);}
    return id;
  }catch(e){return "anon";}
}

// تسجيل خطوة/قسم وصله الزائر (فشل صامت — لا يؤثر على تجربة المستخدم)
export function logStep(page,step){
  try{
    supabase.from("page_visits").insert({page,step,session_id:getVisitorSession()}).then(()=>{});
  }catch(e){}
}

