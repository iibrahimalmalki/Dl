// تقرير شكاوى البايكر الشهري (src/complaintsReport.js) — بيانات ميدول 1648 لشهر 2026-07 كما في الإنتاج
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.cr-test-'));
try{
execSync(`npx esbuild src/complaintsReport.js --bundle --format=esm --platform=node --outfile=${tmp}/t.mjs --log-level=error`,{stdio:'inherit'});
const R=await import(`${tmp}/t.mjs`);

const C=(cat,c,t,m)=>({cat,correct:c,tip:t,motivate:m});
const COV=C('تغطية كل المناطق · Full Coverage','لا تُنهِ قبل تغطية كل المناطق: العجلات، الزوايا، الأبواب الداخلية، والأطراف. Cover all areas.','امشِ حول السيارة دورة كاملة وتفقّدها بنظرة أخيرة قبل الإنهاء. Do a final walk-around.','x');
const WQ=C('إتقان التنظيف · Wash Quality','افرك الأسطح جيداً واتبع تسلسل الغسيل: ماء ثم صابون ثم إسفنجة ثم منشفة. Scrub well: water, soap, sponge, towel.','امنح البقع الصعبة وقتاً كافياً ولا تستعجل الإنهاء. Give tough spots time.','x');
const IMP=C('تطوير الأداء · Improvement','راجع تفاصيل هذه الملاحظة وطبّق أعلى معيار جودة في كل طلب. Review this note.','اطلب من المشرف أي توضيح لتفادي تكرارها. Ask the supervisor.','x');
const ATT=C('الحضور · Attendance','الحضور في الموعد أساس الخدمة. Arrive on time.','جهّز نفسك ودراجتك قبل موعد أول طلب بوقتٍ كافٍ. Prepare.','x');
const T=(no,dec,pics,coach,extra={})=>({ticket_no:no,decision:dec,status:'decided',stored_pics:pics,coach,booking_ref:String(5250000+no),ticket_date:'2026-07-'+String(no%28+1).padStart(2,'0'),
  description:'وصف الشكوى '+no+' ٤٥',biker_name:'Midul Hassan',sweater_id:'1648 ',qc_notes:'ملاحظة-داخلية-'+no,qc_recommendation:'accept',decided_by:'00000000-0000-0000-0000-0000000000aa',...extra});
const p=n=>Array.from({length:n},(_,i)=>`2026-07/x${i}.jpg`);
const tickets=[T(136,'approved',p(3),WQ),T(118,'approved',p(1),COV,{desc_bn:'অভিযোগ ১১৮',reason_ar:'ترك النفايات عند الباب',reason_bn:'দরজার সামনে ময়লা ফেলে গেছেন'}),T(122,'rejected',p(4),COV),T(124,'rejected',[],ATT),
  T(125,'rejected',p(3),IMP),T(126,'rejected',p(1),WQ),T(127,'rejected',p(4),IMP),T(129,'approved',p(3),COV),T(133,'approved',p(1),IMP)];
const ops={period:'2026-07',sweater_id:'1648',biker_name:'Midul Hassan',net_washes:187,collect_payment:187,cancel_client:3,cancel_admin:5,rating:4.48,complaint_pct:2.14};
const D=R.reportData({tickets,ops,period:'2026-07',sid:'1648'},u=>'https://x/'+u);

ok('9 شكاوى: 4 محسوبة (118، 129، 133، 136) و5 مرفوضة (122، 124، 125، 126، 127)',D.total===9&&D.approved===4&&D.rejected===5
  &&D.approvedCards.map(c=>c.no).join()==='118,129,133,136'&&D.rejectedCards.map(c=>c.no).join()==='122,124,125,126,127');
ok('الصافي = المدفوعة + إلغاء العميل = 190، والنسبة 4 ÷ 190 = 2.11%',D.base===190&&D.pct===2.11);
ok('20 صورة',D.picCount===20);
const S=D.scenarios;
ok('الوضع الفعلي: ريال السلامة 0.25 (2–3%) + الجودة 0.50 (4.48) ⇒ 2.75 × 187 = 514.25',S[0].actual&&S[0].sR===0.25&&S[0].qR===0.5&&S[0].rate===2.75&&S[0].bonus===514.25);
ok('سطور الشرائح الأعلى: 3 ⇒ 3.00 (+46.75)، 2 ⇒ 3.25 (+93.50)، 1 ⇒ 3.50 (+140.25)، بلا سطر مكرر للصفر',S.length===4&&S.map(s=>s.count+':'+s.rate+':'+s.diff).join()==='4:2.75:0,3:3:46.75,2:3.25:93.5,1:3.5:140.25');
ok('هدف الشهر القادم: شكوى واحدة أو أقل (أقل من 1% من 190) ⇒ +140.25',D.target.max===1&&!D.target.done&&D.target.gain===140.25);
ok('بلا شكاوى ⇒ الهدف «حافظ»',R.nextTarget({approved:0,base:190,washes:187,rating:4.48}).done===true);
ok('أقل من 100 غسلة ⇒ الهدف صفر شكاوى',R.nextTarget({approved:2,base:80,washes:80,rating:4.6}).max===0);

const c118=D.approvedCards[0],c124=D.rejectedCards[1];
ok('السبب والترجمة من reason_ar/reason_bn/desc_bn إن عبّأها المشرف',c118.reasonAr==='ترك النفايات عند الباب'&&c118.reasonBn==='দরজার সামনে ময়লা ফেলে গেছেন'&&c118.descBn==='অভিযোগ ১১৮');
ok('بلا سبب ⇒ نص ثابت حسب القرار بلغتين (لا qc_notes)',c124.reasonAr===R.DEFAULT_REASON.rejected.ar&&c124.reasonBn===R.DEFAULT_REASON.rejected.bn);
ok('«المطلوب منك»: المحسوبة ⇒ correct بالعربي فقط + بنغالي من الترجمة؛ المرفوضة ⇒ tip',c118.coach.ar.startsWith('لا تُنهِ')&&!/[A-Za-z]/.test(c118.coach.ar)&&c118.coach.bn===R.COACH_BN['تغطية كل المناطق'].correct
  &&c124.coach.ar.startsWith('جهّز')&&c124.coach.bn===R.COACH_BN['الحضور'].tip);
ok('ترجمة بنغالية لكل فئات coach الإحدى عشرة بثلاثة نصوص',Object.keys(R.COACH_BN).length===11&&Object.values(R.COACH_BN).every(x=>x.cat&&x.correct&&x.tip&&x.motivate));
ok('فئة غير معروفة ⇒ «تطوير الأداء»',R.coachLines({cat:'شيء · X',correct:'a'},'approved').catBn===R.COACH_BN['تطوير الأداء'].cat);
ok('الشكاوى بلا ترجمة بنغالية للوصف معروفة للمشرف قبل الطباعة',D.missingBn.length===8&&!D.missingBn.includes(118));
ok('الصور روابط كاملة من bucket',c118.pics[0]==='https://x/2026-07/x0.jpg');

const H=R.buildReportHTML(D,{site:'https://s',fontBase:'https://s'});
ok('لا يظهر للبايكر: qc_notes ولا qc_recommendation ولا decided_by',!/ملاحظة-داخلية|accept|0000000000aa|qc_|decided/.test(H));
ok('أرقام إنجليزية فقط (لا أرقام عربية/بنغالية في الصفحة)',!/[٠-٩۰-۹০-৯]/.test(H));
ok('القسم الأحمر قبل الأخضر، والبطاقات لا تنقسم بين صفحتين',H.indexOf('الشكاوى المحسوبة عليك (4)')<H.indexOf('الشكاوى المرفوضة لصالحك (5)')&&/\.card\{[^}]*break-inside:avoid/.test(H)&&/@page\{size:A4/.test(H));
ok('20 صورة في الصفحة، object-fit: contain وارتفاع 60mm',(H.match(/<img src="https:\/\/x\//g)||[]).length===20&&/object-fit:contain/.test(H)&&/height:60mm/.test(H));
ok('الترويسة بالعربي والبنغالي والاسم والرقم والشعار',H.includes('تقرير شكاوى العملاء — يوليو 2026')&&H.includes('গ্রাহক অভিযোগ রিপোর্ট — জুলাই 2026')&&H.includes('Midul Hassan')&&H.includes('>1648<')&&H.includes('brand-mark.png'));
ok('بطاقات الأرقام والنسبة 2.11%',H.includes('>9<')&&H.includes('>2.11%<'));
ok('كل نص بنغالي dir=ltr',(H.match(/class="bn"(?! dir="ltr")/g)||[]).length===0);
ok('Noto Sans Bengali مضمّن',/Noto Sans Bengali/.test(H));
const D0=R.reportData({tickets:[],ops:null,period:'2026-08',sid:'1700',name:'X'});
ok('بلا شكاوى ولا أرقام تشغيل ⇒ صفحة صالحة برسائل بديلة',D0.total===0&&!D0.hasOps&&R.buildReportHTML(D0).includes('لا شكاوى محسوبة عليك'));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
