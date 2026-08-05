import {computeBiker,computeSupervisor,summarize,complaintPct} from '../src/payrollEngine.js';
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
