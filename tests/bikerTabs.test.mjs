// صلاحيات بوابة البايكر: التبويبات الظاهرة والشريط السفلي (src/bikerTabs.js)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.bt-test-'));
try{
execSync(`npx esbuild src/bikerTabs.js --bundle --format=esm --platform=node --outfile=${tmp}/t.mjs --log-level=error`,{stdio:'inherit'});
const T=await import(`${tmp}/t.mjs`);
const keys=a=>a.map(x=>x.k).join(',');

// الافتراضي = البوابة الحالية تماماً
const d=T.resolveTabs([]);
ok('بلا صفوف: التبويبات الثمانية ظاهرة بالترتيب',keys(d.nav)==='profile,handover,fuel,perf,docs,assets,daily,academy');
ok('بلا صفوف: الشريط السفلي كما كان (الرئيسية، الدراجة، الاستلام، الأكاديمية)',keys(d.bottom)==='profile,handover,daily,academy'&&d.bottom[0].ar==='الرئيسية');
ok('null أو undefined = الافتراضي',keys(T.resolveTabs(null).nav)===keys(d.nav)&&keys(T.resolveTabs(undefined).bottom)===keys(d.bottom));

// الإخفاء
const h=T.resolveTabs([{tab_key:'fuel',visible:false,in_bottom_nav:false},{tab_key:'daily',visible:false,in_bottom_nav:true}]);
ok('الوقود والاستلام مخفيان من القائمة',!h.nav.some(x=>x.k==='fuel'||x.k==='daily')&&h.nav.length===6);
ok('المخفي لا يظهر في الشريط السفلي حتى لو in_bottom_nav=true',keys(h.bottom)==='profile,handover,academy');
ok('isOpen: المخفي مغلق، والباقي مفتوح',!h.isOpen('fuel')&&!h.isOpen('daily')&&h.isOpen('assets')&&h.isOpen('profile'));
ok('«ملفي» لا يُخفى حتى لو جاء صف له',T.resolveTabs([{tab_key:'profile',visible:false}]).isOpen('profile')&&T.resolveTabs([{tab_key:'profile',visible:false}]).nav[0].k==='profile');
ok('مفتاح غير معروف يُتجاهل',keys(T.resolveTabs([{tab_key:'hack',visible:true,in_bottom_nav:true}]).bottom)===keys(d.bottom));
ok('isOpen لمفتاح غير معروف = مغلق',!d.isOpen('hack'));

// اختيار الشريط السفلي
const b=T.resolveTabs([{tab_key:'handover',visible:true,in_bottom_nav:false},{tab_key:'daily',visible:true,in_bottom_nav:false},{tab_key:'academy',visible:true,in_bottom_nav:false},{tab_key:'fuel',visible:true,in_bottom_nav:true},{tab_key:'docs',visible:true,in_bottom_nav:true}]);
ok('المالك يختار الوقود ووثائقي للشريط',keys(b.bottom)==='profile,fuel,docs');
const many=T.RULE_KEYS.map(k=>({tab_key:k,visible:true,in_bottom_nav:true}));
ok('أكثر من 3 ⇒ أول 3 بترتيب البوابة',keys(T.resolveTabs(many).bottom)==='profile,handover,fuel,perf');
const none=T.RULE_KEYS.map(k=>({tab_key:k,visible:true,in_bottom_nav:false}));
ok('لا شيء مختار ⇒ «الرئيسية» وحدها',keys(T.resolveTabs(none).bottom)==='profile');
ok('صف ناقص يأخذ قيمته الافتراضية',keys(T.resolveTabs([{tab_key:'fuel',visible:true,in_bottom_nav:true}]).bottom)==='profile,handover,fuel,daily');

// الحفظ
const m=T.ruleMap([]);m.fuel={visible:false,bottom:true};
const rows=T.toRows(m,'u1');
ok('toRows: صف لكل تبويب قابل للتحكم (7) بلا «ملفي»',rows.length===7&&!rows.some(r=>r.tab_key==='profile'));
ok('toRows: المخفي لا يُحفظ في الشريط السفلي',rows.find(r=>r.tab_key==='fuel').in_bottom_nav===false&&rows.find(r=>r.tab_key==='fuel').visible===false);
ok('toRows ثم resolveTabs = نفس الإعداد',keys(T.resolveTabs(rows).bottom)==='profile,handover,daily,academy'&&!T.resolveTabs(rows).isOpen('fuel'));
ok('bottomCount',T.bottomCount(T.ruleMap([]))===3&&T.bottomCount(m)===3);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
