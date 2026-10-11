import{ThemeToggle,Orbs}from"./ui";

// الاستبيان العام مغلق بقرار المالك 2026-10-11 (close_anon_2.sql: الزائر بلا وصول إلى tma_invites، ولم يُستخدم قط).
// الصفحة تعرض «الرابط غير متاح» بلا أي استدعاء للقاعدة. النسخة الكاملة في تاريخ git قبل PR #58؛
// إعادة التفعيل تحتاج دالتين محدودتين (قراءة الدعوة برمزها + إرسال الأجوبة) لا علماً في الواجهة.
export default function TMAQuestionnaire(){
  const wrap={minHeight:"100dvh",background:"var(--bg)",color:"var(--ink)",fontFamily:"system-ui,-apple-system,'Segoe UI','Noto Sans Bengali',Tahoma,sans-serif"};
  return <div className="g-iso" style={{...wrap,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",padding:24}}><Orbs/><div className="g-corner"><ThemeToggle/></div><div><div style={{fontSize:48}}>🔒</div><p style={{fontWeight:800,fontSize:18,margin:"8px 0 4px"}}>الرابط غير متاح</p><p style={{color:"var(--mut)",fontWeight:700,margin:0}}>লিংকটি বর্তমানে উপলব্ধ নয়</p><p style={{color:"var(--mut)",fontSize:13,marginTop:12}}>تواصل مع الإدارة إن كنت تتوقع هذا الاستبيان. · প্রয়োজনে ম্যানেজমেন্টের সাথে যোগাযোগ করুন।</p></div></div>;
}
