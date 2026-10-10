// دورة حياة العهدة: خريطة أصناف البوابة ← الكتالوج، وحالة التسجيل الأول، وأسطر الاعتماد، وحالة القطعة، والتحقق، والسجل، والاستبدال (src/custodyLifecycle.js)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.cl-test-'));
try{
fs.writeFileSync(`${tmp}/entry.js`,`export * from '${path.resolve('src/custodyLifecycle.js')}';export {ASSET_TO_CATALOG,catalogOfAsset,catalogForItem} from '${path.resolve('src/custodyCatalog.js')}';`);
execSync(`npx esbuild ${tmp}/entry.js --bundle --format=esm --platform=node --outfile=${tmp}/t.mjs --log-level=error`,{stdio:'inherit'});
const L=await import(`${tmp}/t.mjs`);

// ── الخريطة ──
const portal=fs.readFileSync('src/BikerPortal.jsx','utf8');
const block=portal.slice(portal.indexOf('const ASSET_ITEMS'),portal.indexOf('];',portal.indexOf('const ASSET_ITEMS')));
const keys=[...block.matchAll(/key:\s*"([a-z_]+)"/g)].map(m=>m[1]);
ok('أصناف البوابة 23 صنفاً',keys.length===23);
ok('كل صنف في البوابة له مفتاح كتالوج',keys.every(k=>L.ASSET_TO_CATALOG[k]));
ok('كل هدف في الخريطة موجود في الكتالوج',Object.values(L.ASSET_TO_CATALOG).every(k=>L.CATALOG.some(c=>c.key===k)));
ok('لا مفاتيح زائدة في الخريطة',Object.keys(L.ASSET_TO_CATALOG).every(k=>keys.includes(k)));
ok('الخريطة كما حدّدها المالك (عيّنة)',L.ASSET_TO_CATALOG.safety_chest==='chest'&&L.ASSET_TO_CATALOG.safety_limbs==='handsleg'&&L.ASSET_TO_CATALOG.ac_brush==='brushes'&&L.ASSET_TO_CATALOG.sponge_tyre==='sponge'&&L.ASSET_TO_CATALOG.dashboard_polish==='dash'&&L.ASSET_TO_CATALOG.soap_bottle==='soap');
const wt=L.catalogForItem('water_tank');
ok('خزان الماء في الكتالوج: 24 شهراً، مهلة 45، استبدال',wt&&wt.key==='watertank'&&wt.life===24&&wt.lead===45&&wt.mode==='replace');
ok('قطعة جولة تُعرف بالاسم العربي أو الإنجليزي',L.catalogOfAsset({name:'المكنسة'}).key==='vacuum'&&L.catalogOfAsset({name:'x',name_en:'helmet'}).key==='helmet'&&L.catalogOfAsset({name:'؟'})===null);

// ── حالة التسجيل الأول ──
ok('بلا صفوف ⇒ none',L.baselineState([]).state==='none');
ok('صف عابد القائم (declared بلا kind) ⇒ pending',L.baselineState([{id:'a',status:'declared',created_at:'2026-10-03'}]).state==='pending');
ok('مرفوض فقط ⇒ rejected',L.baselineState([{status:'rejected',created_at:'1'}]).state==='rejected');
ok('مرفوض ثم معلّق ⇒ pending',L.baselineState([{status:'rejected',created_at:'1'},{status:'declared',created_at:'2'}]).state==='pending');
ok('معتمد + تحديثات ⇒ approved (التحديثات لا تُحسب)',L.baselineState([{status:'approved',created_at:'1'},{kind:'update',status:'declared',created_at:'2'}]).state==='approved');

// ── أسطر الاعتماد ──
const VAC={id:'v1',name:'المكنسة',name_en:'Vacuum Cleaner',start_date:'2026-08-07',life_months:18,end_date:'2028-02-07',status:'active'};
const OLD={id:'v0',name:'المكنسة',start_date:'2025-01-01',life_months:18,status:'replaced'};
const items=[{key:'vacuum',condition:'damaged'},{key:'floor_brush',condition:'good'},{key:'tyre_brush',condition:'poor'},{key:'water_tank',condition:'good'}];
const {lines,unmapped}=L.baselineLines(items,[OLD,VAC],'2026-10-09');
const by=k=>lines.find(l=>l.catalog_key===k);
ok('ثلاث قطع: المكنسة والفرش (صنفان) وخزان الماء',lines.length===3&&by('brushes').item_keys.join()==='floor_brush,tyre_brush'&&unmapped.length===0);
ok('المكنسة تُربط بالقطعة النشطة (لا المُستبدلة) وتحتفظ بتاريخها',by('vacuum').asset_id==='v1'&&by('vacuum').start_date==='2026-08-07'&&by('vacuum').end_date==='2028-02-07');
ok('قطعة جديدة تبدأ من التاريخ المختار والنهاية من العمر',by('watertank').asset_id===null&&by('watertank').start_date==='2026-10-09'&&by('watertank').end_date==='2028-10-09');
ok('حالة القطعة المجمّعة = الأسوأ',by('brushes').condition==='poor'&&by('vacuum').condition==='damaged');
ok('صنف غير معروف ⇒ unmapped',L.baselineLines([{key:'towels_x',condition:'good'}],[],'2026-10-09').unmapped[0]==='towels_x');

// ── المتبقي من العمر ──
ok('المتبقي بالأيام',L.remainingDays(VAC,'2028-02-01')===6&&L.remainingDays(VAC,'2028-02-10')===-3);
ok('بلا end_date ⇒ يُحسب من العمر',L.remainingDays({start_date:'2026-01-01',life_months:1},'2026-01-31')===1);

// ── حالة القطعة ──
const base={id:'b',status:'approved',created_at:'2026-10-09T10:00',reviewed_at:'2026-10-09T12:00',items:[{key:'floor_brush',condition:'good',asset_id:'br'},{key:'tyre_brush',condition:'poor',asset_id:'br'}]};
const BR={id:'br',name:'الفرش (إطارات/مكيّف/أرضية/صغيرة)',status:'due'};
let s=L.pieceState(BR,[base]);
ok('الحالة من التسجيل الأول = أسوأ الأصناف المربوطة، ويمكن التحديث',s.condition==='poor'&&s.canUpdate&&!s.pending);
const pend={id:'u1',kind:'update',asset_id:'br',status:'declared',created_at:'2026-10-10',items:[{condition:'damaged'}]};
s=L.pieceState(BR,[base,pend]);
ok('تحديث معلّق ⇒ لا تحديث ثانٍ',!!s.pending&&!s.canUpdate&&s.condition==='poor');
const rej={...pend,status:'rejected',reject_reason:'الصورة غير واضحة',reviewed_at:'2026-10-10T09:00'};
s=L.pieceState(BR,[base,rej]);
ok('بعد الرفض: السبب ظاهر ويمكن التحديث من جديد',s.lastRejection==='الصورة غير واضحة'&&s.canUpdate);
const appr={id:'u2',kind:'update',asset_id:'br',status:'approved',created_at:'2026-10-11',reviewed_at:'2026-10-11T09:00',items:[{condition:'fair'}]};
s=L.pieceState(BR,[base,rej,appr]);
ok('اعتماد لاحق يُخفي الرفض الأقدم ويحدّث الحالة',s.lastRejection===null&&s.condition==='fair');
ok('قطعة مستبدلة ⇒ لا تحديث',!L.pieceState({id:'x',status:'replaced'},[]).canUpdate);
ok('الدراجة ليست ضمن «عهدتي»',L.myPieces([{item_type:'motorcycle',status:'active'},{item_type:'tool',status:'due'},{item_type:'tool',status:'replaced'}]).length===1);

// ── التحقق ──
const photo={name:'a.jpg'};
let e=L.updateError({});ok('بلا حالة ⇒ خطأ حالة',e.field==='condition'&&/অবস্থা/.test(e.bn));
e=L.updateError({condition:'good'});ok('بلا صورة ⇒ خطأ صورة (عربي وبنغالي)',e.field==='photo'&&/الصورة/.test(e.ar)&&/ছবি/.test(e.bn));
ok('جيدة بصورة بلا ملاحظة ⇒ مقبول',L.updateError({condition:'good',photo})===null);
for(const c of ['poor','damaged'])ok(`${c} بلا ملاحظة ⇒ خطأ ملاحظة`,L.updateError({condition:c,photo,note:' '}).field==='note');
ok('تالفة بملاحظة ⇒ مقبول',L.updateError({condition:'damaged',photo,note:'مكسور'})===null);

// ── السجل الزمني ──
const tl=L.timeline({...BR,source:'declaration',start_date:'2026-10-09',created_at:'2026-10-09T12:00',status:'replaced',notes:'استُبدلت 2026-10-20'},[base,rej,appr]);
ok('السجل بالترتيب: تسجيل أول، إنشاء القطعة عند اعتماده، اعتماد، تحديث، رفض، تحديث، اعتماد، استبدال',
  tl.map(x=>x.type).join()==='declared,created,approved,declared,rejected,declared,approved,replaced');
ok('سبب الرفض يظهر في السجل',tl.some(x=>x.type==='rejected'&&/الصورة غير واضحة/.test(x.ar)));
ok('الاستبدال بتاريخه من الملاحظة',tl[tl.length-1].type==='replaced'&&tl[tl.length-1].at==='2026-10-20');

// ── الاستبدال ──
const r=L.replacementRow({...VAC,employee_id:'e1',operator_id:'o1',biker_name:'Midul',sweater_id:'1648',item_type:'tool',category:'أدوات'},'2026-10-20');
ok('البديل: نفس الصنف والبايكر، يبدأ اليوم بعمر كامل من الكتالوج',r.employee_id==='e1'&&r.name==='المكنسة'&&r.start_date==='2026-10-20'&&r.life_months===18&&r.lead_days===45&&r.end_date==='2028-04-20'&&r.status==='active'&&r.source==='replacement'&&/v1/.test(r.notes));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
