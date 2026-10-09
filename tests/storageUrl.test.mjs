// تحليل روابط التخزين المحفوظة إلى حاوية ومسار (src/storageUrl.js)
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.su-test-'));
try{
// نسخة بلا عميل Supabase الحقيقي (التحليل نقي)
fs.writeFileSync(`${tmp}/supabase.mjs`,'export const supabase={};');
fs.writeFileSync(`${tmp}/t.mjs`,fs.readFileSync('src/storageUrl.js','utf8').replace('"./supabase"','"./supabase.mjs"'));
const S=await import(`${tmp}/t.mjs`);
const B='https://cnmggdrlkgsyrjxmvydv.supabase.co/storage/v1/object';
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
ok('رابط عام لصورة متقدم',eq(S.parseStorageUrl(`${B}/public/applicant-photos/0b1c-uuid/photo.jpg`),{bucket:'applicant-photos',path:'0b1c-uuid/photo.jpg'}));
ok('رابط عام للرخص (مسار متعدد الأجزاء)',eq(S.parseStorageUrl(`${B}/public/applicant-licenses/u1/iq.jpg`),{bucket:'applicant-licenses',path:'u1/iq.jpg'}));
ok('رابط موقّع سابق مع token',eq(S.parseStorageUrl(`${B}/sign/applicant-videos/u1/video.mp4?token=abc`),{bucket:'applicant-videos',path:'u1/video.mp4'}));
ok('مسار مُرمَّز يُفك',eq(S.parseStorageUrl(`${B}/public/sweater-tickets/2026-07/a%20b.jpg`),{bucket:'sweater-tickets',path:'2026-07/a b.jpg'}));
ok('رابط خارجي ⇒ null',S.parseStorageUrl('https://example.com/x.jpg')===null);
ok('فارغ ⇒ null',S.parseStorageUrl('')===null&&S.parseStorageUrl(null)===null);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
