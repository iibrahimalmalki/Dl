import {computeBiker,computeSupervisor,summarize,complaintPct,complaintRatio,bikerSafetyRiyal,productionBonus} from '../src/payrollEngine.js';
const exp=(label,got,want)=>{const ok=Math.abs(got-want)<0.005;console.log((ok?'✓':'✗ FAIL')+` ${label}: got ${got} want ${want}`);if(!ok)process.exitCode=1;};

// Ariful 1624 — M1, 133 washes, 4.58, 0% complaints, 0 tips
const a=computeBiker({name:'Ariful',biker_id:'1624',level:'M1',net_washes:133,rating:4.58,complaint_pct:0,tips:0});
exp('Ariful rate/wash',a.rate_per_wash,3.75); exp('Ariful net_bonus',a.net_bonus,498.75); exp('Ariful total',a.total,1498.75);

// Midul 1648 — M1, 216, 4.60, 0%, tips 43.88, production 25
const m=computeBiker({name:'Midul',biker_id:'1648',level:'M1',net_washes:216,rating:4.60,complaint_pct:0,tips:43.88});
exp('Midul production',m.production,25); exp('Midul net_bonus',m.net_bonus,878.88); exp('Midul total',m.total,1878.88);

// Rakib 1700 — M1, 191, 4.51, complaint 1.047%, tips 19.5
const rp=complaintPct(2,191); // 1.05%
const r=computeBiker({name:'Rakib',biker_id:'1700',level:'M1',net_washes:191,rating:4.51,complaint_pct:rp,tips:19.5});
exp('Rakib complaint%',rp,1.05); exp('Rakib safety riyal',r.safety_riyal,0.75); exp('Rakib rate/wash',r.rate_per_wash,3.50); exp('Rakib net_bonus',r.net_bonus,688); exp('Rakib total',r.total,1688);

// Supervisor سلمان — 540 orders, 4.563, 0.37%
const s=computeSupervisor({name:'سلمان',team_orders:540,team_rating:4.563,team_complaint_pct:0.37,deductions:0});
exp('Sup rate/order',s.rate_per_order,1.58); exp('Sup variable',s.variable,853.20); exp('Sup total',s.total,2353.20);

// Team summary
const sum=summarize([a,m,r,s]);
exp('Team net_bonus total',sum.net_bonus,2918.83); exp('Team grand total',sum.total,7418.83);
console.log('\nDeduction cap test: base 1000, damage 700 →', computeBiker({level:'M1',net_washes:100,rating:4.0,complaint_pct:0,deduct_damage:700}).deductions, '(cap 500) capped=',computeBiker({level:'M1',net_washes:100,rating:4.0,complaint_pct:0,deduct_damage:700}).deduction_capped);
console.log('Rating<4 blocks production:',computeBiker({level:'M1',net_washes:260,rating:3.9,complaint_pct:0}).production,'(want 0)');

// ── بلا تقريب قبل الشريحة (قرار 2026-10-13) — النسبة الكاملة تحدد الريال، والتقريب للعرض فقط
exp('2/201 = 0.995% ⇒ سلامة 1.00',bikerSafetyRiyal(complaintRatio(2,201)),1.00);
exp('4/267 = 1.498% ⇒ سلامة 0.75',bikerSafetyRiyal(complaintRatio(4,267)),0.75);
exp('7/233 = 3.004% ⇒ سلامة 0',bikerSafetyRiyal(complaintRatio(7,233)),0);
exp('العرض يبقى مقرّباً: 2/201 ⇒ 1.00%',complaintPct(2,201),1.00);
exp('تقييم 3.995 ⇒ بلا إنتاج (260 غسلة)',productionBonus(260,3.995),0);
exp('تقييم 3.995 ⇒ ريال جودة 0',computeBiker({level:'M1',net_washes:100,rating:3.995,complaint_pct:0}).quality_riyal,0);

// ── يوليو 2026 بالصافي الجديد (المكتملة + إلغاء العميل) = المبالغ المدفوعة
const j1=computeBiker({level:'M1',net_washes:46+2,rating:4.55,complaint_pct:complaintRatio(0,48),tips:0});
exp('يوليو عارف 48 × 3.75 = 180.00',j1.net_bonus,180);
const j2=computeBiker({level:'M1',net_washes:187+3,rating:4.48,complaint_pct:complaintRatio(4,190),tips:42.9});
exp('يوليو ميدول 190 × 2.75 + 42.90 = 565.40',j2.net_bonus,565.40);
const j3=computeBiker({level:'M1',net_washes:196+5,rating:4.50,complaint_pct:complaintRatio(1,201),tips:39});
exp('يوليو راكب 201 × 3.75 + 39 + إنتاج 25 = 817.75',j3.net_bonus,817.75);exp('يوليو راكب إنتاج 25 (201 ≥ 200)',j3.production,25);
const js=computeSupervisor({team_orders:439,team_rating:(4.55+4.48+4.50)/3,team_complaint_pct:complaintRatio(5,439),deductions:0});
exp('يوليو المشرف 439 × 1.42 = 623.38',js.net_bonus,623.38);

// ── المشرف: سقف 1.75 وسقف الاستقطاعات 750 والصافي ≥ 0
const top=computeSupervisor({team_orders:100,team_rating:5,team_complaint_pct:0,deductions:0});
exp('المشرف: المعدل الأعلى = 1.75 (السقف)',top.rate_per_order,1.75);
const sd=computeSupervisor({team_orders:100,team_rating:5,team_complaint_pct:0,deductions:2000});
exp('المشرف: الاستقطاعات مسقوفة 750',sd.deductions,750);exp('المشرف: الصافي لا يقل عن 0',sd.net_bonus,0);exp('المشرف: الإجمالي = الأساس',sd.total,1500);

// ── البايكر: الاستقطاعات فوق المكافأة تُخصم من الأساس (ضمن 500) مع base_deducted
const bd=computeBiker({level:'M1',net_washes:50,rating:3,complaint_pct:5,deduct_damage:400});
exp('البايكر: صافي سالب (50 × 2 − 400)',bd.net_bonus,-300);exp('البايكر: المخصوم من الأساس 300',bd.base_deducted,300);exp('البايكر: الإجمالي 700',bd.total,700);
const qd=computeBiker({level:'M1',net_washes:100,rating:4.5,complaint_pct:0,quality_deduction:30,deduct_damage:10});
exp('خصم الجودة يدخل الاستقطاعات',qd.deductions,40);exp('بلا خصم من الأساس حين تكفي المكافأة',qd.base_deducted,0);
