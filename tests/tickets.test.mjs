// صفحة الشكاوى: البحث برقم الشكوى/الطلب، تقاطع الفلاتر، والتحقق من الصور والروابط (src/ticketsLib.js)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.tk-test-'));
try{
execSync(`npx esbuild src/ticketsLib.js --bundle --format=esm --platform=node --outfile=${tmp}/t.mjs --log-level=error`,{stdio:'inherit'});
const T=await import(`${tmp}/t.mjs`);
const T135={id:'a',ticket_no:135,sweater_ticket_no:'101463',booking_ref:'5330679',period:'2026-07',biker_name:'Ariful Islam',sweater_id:'1624',status:'pending_review',decision:'pending'};
const T134={id:'b',ticket_no:134,sweater_ticket_no:'101496',booking_ref:'5332480',period:'2026-07',biker_name:'Mohamad Rakib',sweater_id:'1700',status:'reviewed',decision:'pending'};
const T9={id:'c',ticket_no:9,sweater_ticket_no:'99120',booking_ref:'5101000',period:'2026-03',biker_name:'Ariful Islam',sweater_id:'1624',status:'decided',decision:'approved'};
const T10={id:'d',ticket_no:10,sweater_ticket_no:null,booking_ref:'5101001',period:'2026-03',biker_name:'Midul Hassan',sweater_id:'1648',status:'decided',decision:'rejected'};
const all=[T135,T134,T9,T10];
// البحث
ok('«١٠١٤٦٣» و«#101463» و« 101463 » ⇒ الشكوى 101463',['١٠١٤٦٣','#101463',' 101463 ','# 101 463'].every(q=>T.matchTicket(T135,q)&&!T.matchTicket(T134,q)));
ok('مطابقة من البداية: «1014» ⇒ 101463 و101496',T.matchTicket(T135,'1014')&&T.matchTicket(T134,'1014')&&!T.matchTicket(T9,'1014'));
ok('«5330679» ⇒ رقم الحجز',T.matchTicket(T135,'5330679')&&!T.matchTicket(T134,'5330679'));
ok('«135» ⇒ رقمنا الداخلي (مطابقة تامة)',T.matchTicket(T135,'135')&&!T.matchTicket(T134,'135'));
ok('حرف واحد أو فارغ ⇒ لا بحث',T.normSearch('1')===null&&T.normSearch(' # ')===null&&T.searchOrFilter('٥')===null&&!T.matchTicket(T135,'1'));
ok('شرط القاعدة يشمل الأعمدة الثلاثة',T.searchOrFilter('#١٣٥')==='sweater_ticket_no.ilike.135*,booking_ref.ilike.135*,ticket_no.eq.135');
ok('لا يُمرَّر محرف خطر إلى شرط القاعدة',(()=>{const f=T.searchOrFilter('12),status.eq.x')||'';return f.split(',').length===2&&!/[()]/.test(f)&&!/status\.eq/.test(f);})());
// الفلاتر
ok('البايكرز بالعدد ثم الاسم: Ariful (2) ثم Midul ثم Mohamad',JSON.stringify(T.bikerOptions(all).map(b=>[b.key,b.n]))==='[["1624",2],["1648",1],["1700",1]]');
ok('بايكر + تبويب يتقاطعان',T.applyFilters(all,{biker:'1624',tab:'approved'}).map(t=>t.id).join()==='c'&&T.applyFilters(all,{biker:'1624',tab:'pending_review'}).map(t=>t.id).join()==='a'&&T.applyFilters(all,{biker:'1700',tab:'approved'}).length===0);
ok('الشهر ∩ البايكر ∩ التبويب',T.applyFilters(all.filter(t=>t.period==='2026-07'),{biker:'1624',tab:'all'}).map(t=>t.id).join()==='a');
{const c=T.tabCounts(all,'1624'),c0=T.tabCounts(all,'');ok('العدّادات تتبع فلتر البايكر',c.all===2&&c.pending_review===1&&c.approved===1&&c.reviewed===0&&c0.all===4&&c0.reviewed===1&&c0.rejected===1);}
// الصور
const bytes=s=>Uint8Array.from(Buffer.from(s,'latin1'));
const html=bytes('<!doctype html><html><head><title>Sweater</title>');
const jpg=Uint8Array.from([0xFF,0xD8,0xFF,0xE0,0,0x10,0x4A,0x46,0x49,0x46,0,1,1]);
const png=Uint8Array.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0,0,0,0x0D]);
const webp=bytes('RIFF\x24\x00\x00\x00WEBPVP8 ');
const heic=bytes('\x00\x00\x00\x18ftypheic\x00\x00\x00\x00');
ok('HTML باسم .jpg ⇒ مرفوض (حتى لو قيل image/jpeg)',!T.isImageResponse('text/html',html)&&!T.isImageResponse('image/jpeg',html)&&T.imageKind(html)===null);
ok('JPEG و PNG و WebP و HEIC ⇒ مقبولة',T.isImageResponse('image/jpeg',jpg)&&T.isImageResponse('image/png',png)&&T.isImageResponse('image/webp',webp)&&T.isImageResponse('image/heic',heic));
ok('صورة حقيقية بنوع text/html ⇒ مرفوضة',!T.isImageResponse('text/html; charset=utf-8',jpg));
// الروابط
const pg=T.checkTicketUrl('https://ssp-portal.sweater.sa/tickets/101496',T135);
ok('رابط صفحة …/tickets/101496 ⇒ يُرفض قبل الاستدعاء برسالة واضحة',!pg.ok&&pg.code==='PAGE_URL'&&/رابط صفحة لا رابط صورة/.test(pg.msg));
ok('رقم مخالف لرقم الشكوى ⇒ تنبيه',(()=>{const r=T.checkTicketUrl('https://d1x.cloudfront.net/tickets/101496/photo.jpg',T135);return r.ok&&r.mismatch&&/101496/.test(r.warn)&&/101463/.test(r.warn);})());
ok('رقم مطابق ⇒ بلا تنبيه، ورابط بلا رقم ⇒ بلا تنبيه',!T.checkTicketUrl('https://d1x.cloudfront.net/tickets/101463/a.jpg',T135).mismatch&&!T.checkTicketUrl('https://d1x.cloudfront.net/img/abc.jpg',T135).mismatch);
ok('رابط غير http ⇒ مرفوض',!T.checkTicketUrl('ftp://x/y.jpg',T135).ok&&!T.checkTicketUrl('',T135).ok);
ok('isPageUrl يكتشف رابط الصفحة المحفوظ',T.isPageUrl('https://ssp-portal.sweater.sa/tickets/101496')&&!T.isPageUrl('https://d1x.cloudfront.net/a.jpg'));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
