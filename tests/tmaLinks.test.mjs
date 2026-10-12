// روابط استبيان TMA العام مغلقة (close_anon_2.sql) ⇒ أزرار إنشائها وإرسالها مخفية في TMA.jsx وInterviews.jsx
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tma=fs.readFileSync('src/tma.js','utf8'),page=fs.readFileSync('src/TMA.jsx','utf8'),iv=fs.readFileSync('src/Interviews.jsx','utf8');
ok('العلم TMA_LINKS_ENABLED = false',/export const TMA_LINKS_ENABLED=false;/.test(tma));
ok('TMA: زر «إنشاء رابط الاستبيان» خلف العلم',/TMA_LINKS_ENABLED\?<button[^\n]*createInvite\(\)/.test(page));
ok('TMA: نسخ/واتساب للروابط السابقة خلف العلم',/!cp&&TMA_LINKS_ENABLED&&<><button onClick=\{\(\)=>copyInv/.test(page));
ok('TMA: عنوان الصندوق ووصفه خلف العلم، و«تقييم المرشّحين يدوياً» عند الإغلاق',/TMA_LINKS_ENABLED\?<><div className="tm-inv-h">[^\n]*إرسال استبيان لمرشّح جديد/.test(page)&&/تقييم المرشّحين يدوياً/.test(page));
ok('TMA: الاستيراد والحذف باقيان',/importInv\(r\)/.test(page)&&/delInv\(r\)/.test(page));
ok('المقابلات: زر «إرسال استبيان المواهب» خلف العلم',/TMA_LINKS_ENABLED&&sel\.applicants\?\.whatsapp&&<button[^\n]*sendQ\(sel\)/.test(iv));
ok('المقابلات: التقييم اليدوي باقٍ',/تقييم يدوي للمرشّح/.test(iv));
