import{createClient}from"@supabase/supabase-js";
export const supabase=createClient("https://cnmggdrlkgsyrjxmvydv.supabase.co","eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNubWdnZHJsa2dzeXJqeG12eWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMjc3NDYsImV4cCI6MjA5MTYwMzc0Nn0.gUvtS3AgNhF69D8CimZxGHTbCoGDw5u2fDStgKcTI8Q");
export const SITE_URL="https://db1-sandy.vercel.app";
export const ADMIN_PASS="Dalu@2026";

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

