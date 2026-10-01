// اختبار بطاقة الأداء: scorecard.js فوق محرّك HR-POL-003 — يُبنى بالـ esbuild كباقي الاختبارات
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.sc-test-'));
try{
execSync(`npx esbuild src/scorecard.js --bundle --format=esm --platform=node --outfile=${tmp}/s.mjs --log-level=error`,{stdio:'inherit'});
const L=await import(`${tmp}/s.mjs`);
const S=(w,r,c,extra={})=>L.bikerScore({net_washes:w,rating:r,complaint_pct:c,...extra});

// أجر الغسلة عند حدود التقييم (4.00/4.25/4.50/4.75) مع شكاوى <1%
ok('تقييم 3.99 ← جودة 0 · أجر 3.00',S(100,3.99,0.5).qR===0&&S(100,3.99,0.5).ratePerWash===3);
ok('تقييم 4.00 ← جودة 0.25 · أجر 3.25',S(100,4.00,0.5).qR===0.25&&S(100,4.00,0.5).ratePerWash===3.25);
ok('تقييم 4.25 ← جودة 0.50 · أجر 3.50',S(100,4.25,0.5).ratePerWash===3.5);
ok('تقييم 4.50 ← جودة 0.75 · أجر 3.75',S(100,4.50,0.5).ratePerWash===3.75);
ok('تقييم 4.75 ← جودة 1.00 · أجر 4.00 (السقف)',S(100,4.75,0.5).ratePerWash===4);
// حدود الشكاوى (1% / 1.5% / 2% / 3%) مع تقييم 4.75
ok('شكاوى 1% ← سلامة 0.75',S(100,4.75,1).sR===0.75&&S(100,4.75,1).ratePerWash===3.75);
ok('شكاوى 1.5% ← سلامة 0.50',S(100,4.75,1.5).sR===0.5);
ok('شكاوى 2% ← سلامة 0.25',S(100,4.75,2).sR===0.25);
ok('شكاوى 3% ← سلامة 0.25 و3.01% ← 0',S(100,4.75,3).sR===0.25&&S(100,4.75,3.01).sR===0);
ok('الحد الأدنى للأجر 2 ريال',S(100,3,9).ratePerWash===2);
ok('العمولة = الغسلات × الأجر',S(212,4.6,0.9).bonusBase===212*3.75);

// الهدف التالي للإنتاج
const np=w=>L.nextProductionOf(w);
ok('180 ← هدف 200 (فرق 20، 25 ر)',np(180).target===200&&np(180).gap===20&&np(180).bonus===25);
ok('205 ← هدف 230 (فرق 25، 50 ر)',np(205).target===230&&np(205).gap===25&&np(205).bonus===50);
ok('235 ← هدف 260 (فرق 25، 100 ر)',np(235).target===260&&np(235).gap===25&&np(235).bonus===100);
ok('265 ← لا هدف بعد',np(265)===null);
ok('مكافأة الإنتاج تشترط تقييم ≥ 4',S(240,3.9,0.5).production===0&&S(240,4,0.5).production===50);
ok('الجودة التالية: 4.30 ← 4.50 (0.75)',L.nextQualityOf(4.3).needRating===4.5&&L.nextQualityOf(4.3).riyal===0.75);
ok('السلامة التالية: 1.6% ← ≤1.49% (≤2 من 200)',(n=>n.maxPct===1.49&&n.maxComplaints===2)(L.nextSafetyOf(1.6,200)));

// أيام العمل والمتوسط وأفضل يوم من daily
const d=S(60,4.5,0.5,{daily:JSON.stringify({'2026-09-01':20,'2026-09-02':0,'2026-09-03':25,'2026-09-04':15})});
ok('workDays تتجاهل أيام الصفر',d.workDays===3&&d.zeroDays.length===1);
ok('dailyAvg = الغسلات ÷ أيام العمل',d.dailyAvg===20);
ok('bestDay',d.bestDay.date==='2026-09-03'&&d.bestDay.n===25);

// الترتيب مع التعادل
const r=L.rankBikers([{sid:'a',washes:200,rating:4.5,complaintPct:1},{sid:'b',washes:200,rating:4.8,complaintPct:2},{sid:'c',washes:200,rating:4.8,complaintPct:0.5},{sid:'d',washes:250,rating:4.0,complaintPct:3}],'washes');
ok('rankBikers: الأعلى غسلات أولاً',r[0].sid==='d'&&r[0].rank===1);
ok('rankBikers: التعادل ← التقييم ثم الشكاوى الأقل',r[1].sid==='c'&&r[2].sid==='b'&&r[3].sid==='a');

// الاتجاه
ok('trend صاعد',L.trend([150,170,190]).dir==='up'&&L.trend([150,170,190]).pct>0);
ok('trend هابط (آخر 3 فقط)',L.trend([100,250,220,180]).dir==='down');
ok('trend ثابت',L.trend([200,201,201]).dir==='flat');

// ملخص الفريق
const t=L.teamSummary([S(100,4.0,1,{approved_complaints:1}),S(300,5.0,1,{approved_complaints:3})]);
ok('teamSummary: تقييم مرجّح بالغسلات',t.rating===4.75&&t.washes===400&&t.complaintPct===1);

// نص البايكر
const b=S(205,4.6,0.9,{period:'2026-09'});
const bn=L.bikerBrief(b,'bn');
ok('bikerBrief بالبنغالي يحوي الغسلات',bn.includes('205')&&/[ঀ-৿]/.test(bn));
ok('bikerBrief بالبنغالي يحوي الهدف التالي',bn.includes('আরও 25 টি ওয়াশ')&&bn.includes('50 রিয়াল'));
ok('bikerBrief عربي + بنغالي',L.bikerBrief(b).includes('أجر الغسلة 3.75')&&L.bikerBrief(b).includes('— دلو ورغوة'));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
