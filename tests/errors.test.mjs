// اختبار رسائل الخطأ لبوابة البايكر (src/errors.js): كل حالة من العشر تُعرَف من نص/رمز الخطأ الحقيقي، ولا نص تقني للبايكر
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.err-test-'));
const cerr=console.error;console.error=()=>{};
try{
execSync(`npx esbuild src/errors.js --bundle --format=esm --platform=node --outfile=${tmp}/e.mjs --log-level=error`,{stdio:'inherit'});
const E=await import(`${tmp}/e.mjs`);
// أشكال الأخطاء كما ترجعها supabase-js / المتصفح فعلاً
const cases=[
  [1,'net',new TypeError('Failed to fetch'),{}],
  [1,'net',{message:'NetworkError when attempting to fetch resource.'},{}],
  [1,'net',new TypeError('Load failed'),{}],                                   // Safari
  [2,'login',{name:'AuthApiError',message:'Invalid login credentials',status:400,code:'invalid_credentials'},{}],
  [3,'session',{message:'JWT expired',code:'PGRST301'},{}],
  [3,'session',{name:'AuthSessionMissingError',message:'Auth session missing!',status:400},{}],
  [3,'session',{message:'unauthorized',status:401},{}],
  [4,'rls',{code:'42501',message:'new row violates row-level security policy for table "bike_handovers"'},{}],
  [4,'rls',{statusCode:'403',error:'Unauthorized',message:'new row violates row-level security policy'},{photo:3}], // تخزين
  [5,'upload',{name:'StorageUnknownError',message:'Failed to fetch'},{photo:3}],
  [5,'upload',{statusCode:'500',error:'Internal',message:'Internal Server Error'},{photo:7}],
  [6,'image',{statusCode:'413',error:'Payload too large',message:'The object exceeded the maximum allowed size'},{photo:2}],
  [6,'image',{statusCode:'415',error:'invalid_mime_type',message:'mime type application/pdf is not supported'},{photo:1}],
  [7,'time',{code:'P0001',message:'received_at out of range'},{}],
  [7,'time',{message:'x'},{kind:'time'}],
  [8,'dup',{code:'23505',message:'duplicate key value violates unique constraint "x_key"'},{}],
  [9,'nobike',null,{kind:'nobike'}],
  [10,'unknown',{message:'Internal Server Error',status:500},{}],
  [10,'unknown',new Error('Cannot read properties of undefined (reading \'id\')'),{}],
];
for(const[n,k,err,ctx] of cases){const h=E.humanError(err,ctx);ok(`الحالة ${n} (${k}) ← ${String((err&&err.message)||k).slice(0,44)}`,h.key===k);}
const all=cases.map(([,,e,c])=>E.humanError(e,c));
ok('العربية والبنغالية بلا أي نص تقني (لا حروف لاتينية ولا رسالة الخادم)',all.every(h=>!/[A-Za-z]/.test(h.ar+h.bn)));
ok('كل رسالة لها رمز قصير وإجراء',all.every(h=>/^E-[A-Z]+$/.test(h.code)&&h.action));
ok('العشر حالات لكلٍّ رمز مختلف',new Set(['net','login','session','rls','upload','image','time','dup','nobike','unknown'].map(k=>all.find(h=>h.key===k).code)).size===10);
ok('رقم الصورة يظهر في رسالة الرفع',/الصورة رقم 3/.test(E.humanError({message:'Failed to fetch'},{photo:3}).ar)&&/ছবি 3/.test(E.humanError({message:'Failed to fetch'},{photo:3}).bn));
ok('normalizeId: أرقام عربية وبنغالية ومسافات',E.normalizeId(' ١٦٢٤ ')==='1624'&&E.normalizeId('১৬২৪')==='1624'&&E.normalizeId('ab ed ')==='abed'&&E.normalizeId('۱۶۲۴')==='1624');
ok('رابط واتساب الإدارة يحمل الرمز',/wa\.me\/966566884419/.test(E.adminWaLink('E-RLS'))&&decodeURIComponent(E.adminWaLink('E-RLS')).includes('E-RLS'));
}finally{fs.rmSync(tmp,{recursive:true,force:true});console.error=cerr;}
