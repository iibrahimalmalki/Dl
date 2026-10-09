// تحقّق بالمفتاح العام (anon) من إغلاق ملفات المتقدمين — لا يحذف شيئاً.
// الاستخدام: node scripts/check-applicant-storage.mjs            ⇒ السرد والتنزيل يجب أن يفشلا
//            node scripts/check-applicant-storage.mjs --upload   ⇒ أيضاً يرفع ملفاً نصياً صغيراً إلى applicant-photos/_check/
//                                                                  (يبقى في الحاوية؛ لا صلاحية حذف للزائر)
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../src/supabase.js', import.meta.url), 'utf8');
const URL_ = /SUPA_URL="([^"]+)"/.exec(src)[1], KEY = /SUPA_ANON="([^"]+)"/.exec(src)[1];
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const BUCKETS = ['applicant-licenses', 'applicant-photos', 'applicant-videos'];
let bad = 0;
const say = (ok, t) => { console.log((ok ? '✓ ' : '✗ ') + t); if (!ok) bad++; };

for (const b of BUCKETS) {
  const r = await fetch(`${URL_}/storage/v1/object/list/${b}`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: '', limit: 100 }) });
  const j = await r.json().catch(() => null);
  const n = Array.isArray(j) ? j.length : 0;
  say(n === 0, `${b}: السرد بالمفتاح العام ⇒ ${n} عنصر (HTTP ${r.status})`);
}
// تنزيل ملف معروف عبر الرابط العام: يُؤخذ أول مسار من applicants.personal_photo_url إن كان مقروءاً، وإلا من وسيط سطر الأوامر
const known = process.argv.find(a => a.startsWith('--file='))?.slice(7);
if (known) {
  const r = await fetch(`${URL_}/storage/v1/object/public/${known}`);
  say(r.status >= 400, `تنزيل ${known} عبر الرابط العام ⇒ HTTP ${r.status}`);
} else console.log('ℹ لفحص التنزيل مرّر --file=<bucket>/<path> لملف موجود (من applicants.personal_photo_url).');
if (process.argv.includes('--upload')) {
  const path = `_check/${Date.now()}.txt`;
  const r = await fetch(`${URL_}/storage/v1/object/applicant-photos/${path}`, { method: 'POST', headers: { ...H, 'Content-Type': 'text/plain', 'x-upsert': 'false' }, body: 'check' });
  say(r.ok, `رفع بالمفتاح العام إلى applicant-photos/${path} ⇒ HTTP ${r.status}`);
}
process.exit(bad ? 1 : 0);
