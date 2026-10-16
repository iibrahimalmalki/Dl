// «رصيد وقود متجدد» — المنطق النقي (src/fuelWallet.js): الرصيد، الدفعة القادمة، المستعجلة، تحقق التعبئة، الأخطاء، المصروفات
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.fw-test-'));
try{
fs.writeFileSync(`${tmp}/entry.js`,`export * from '${path.resolve('src/fuelWallet.js')}';`);
execSync(`npx esbuild ${tmp}/entry.js --bundle --format=esm --platform=node --outfile=${tmp}/t.mjs --log-level=error`,{stdio:'inherit'});
const W=await import(`${tmp}/t.mjs`);

ok('sar: 15 ⇒ "15"، 7.5 ⇒ "7.5"، 2.326 ⇒ "2.33"، فارغ ⇒ "—"',W.sar(15)==='15'&&W.sar('7.50')==='7.5'&&W.sar(2.326)==='2.33'&&W.sar('x')==='—');
const w=W.walletOf([{balance:'15',threshold:'10',topup_amount:'50',tolerance:'10'}]);
ok('walletOf: صف my_fuel_balance ⇒ أرقام',w.balance===15&&w.threshold===10&&w.topup===50&&w.tolerance===10);
ok('walletOf: بلا صف ⇒ null، وقيم ناقصة ⇒ الافتراضي',W.walletOf([])===null&&W.walletOf({balance:null}).threshold===10&&W.walletOf({balance:null}).balance===0);

const req=(id,status,x={})=>({id,status,amount:50,requested_at:'2026-10-1'+id+'T08:00:00Z',...x});
const open=req(3,'requested',{source:'auto'}),tr=req(2,'transferred',{amount_actual:50,transferred_at:'2026-10-12T10:00:00Z'}),rj=req(4,'rejected',{reject_reason:'تُدمج',rejected_at:'2026-10-14T09:00:00Z'});
ok('الدفعة القادمة: طلب مفتوح ⇒ «طلب 50 ﷼ أُرسل للإدارة» بلغتين',(n=>n.kind==='sent'&&n.ar==='طلب 50 ﷼ أُرسل للإدارة'&&/ম্যানেজমেন্টে/.test(n.bn))(W.nextTopup([tr,open])));
ok('بلا مفتوح: آخر قرار — حُوِّلت بالمبلغ الفعلي',(n=>n.kind==='transferred'&&n.ar==='حُوِّلت 50 ﷼')(W.nextTopup([tr,req(1,'cancelled')])));
ok('بلا مفتوح وآخر قرار رفض ⇒ «رُفض طلب الدفعة — السبب»',(n=>n.kind==='rejected'&&n.ar==='رُفض طلب الدفعة — تُدمج')(W.nextTopup([tr,rj])));
ok('لا طلبات ⇒ لا حالة، والملغى لا يُعرض حالةً',W.nextTopup([])===null&&W.nextTopup([req(1,'cancelled')])===null);

ok('المستعجلة: رصيد < العتبة وبلا مفتوح ⇒ نعم',W.canUrgent({balance:5,threshold:10},[tr,rj])===true);
ok('المستعجلة: برصيد = العتبة ⇒ لا، وبطلب مفتوح ⇒ لا، وبلا رصيد محمّل ⇒ لا',!W.canUrgent({balance:10,threshold:10},[])&&!W.canUrgent({balance:2,threshold:10},[open])&&!W.canUrgent(null,[]));

const full={odometer:'14240',amount:'20',liters:'9',odoPhoto:{},receipt:{}};
ok('تحقق التعبئة: كامل ⇒ null',W.walletFillError(full,w)===null);
ok('اللترات إلزامية: فارغة أو صفر ⇒ liters بلغتين',(e=>e.field==='liters'&&/লিটার/.test(e.bn))(W.walletFillError({...full,liters:''},w))&&W.walletFillError({...full,liters:'0'},w).field==='liters');
ok('المبلغ > الرصيد + التسامح ⇒ amount مع الرصيد (15 + 10 = 25: 25 يُقبل و 25.5 يرفض)',W.walletFillError({...full,amount:'25'},w)===null&&/15/.test(W.walletFillError({...full,amount:'25.5'},w).ar));
ok('أرقام عربية مقبولة (١٢٫٥ ﷼ و ٥ لترات)',W.walletFillError({...full,amount:'١٢٫٥',liters:'٥'},w)===null);
ok('بلا رصيد محمّل: لا سقف من الواجهة (القاعدة تفرضه)',W.walletFillError({...full,amount:'500'},null)===null);
ok('الترتيب: العدّاد ثم المبلغ ثم اللترات ثم الصور',W.walletFillError({...full,odometer:''},w).field==='odometer'&&W.walletFillError({...full,receipt:null},w).field==='receipt');

ok('أخطاء البوابة: OVER_BALANCE و DUPLICATE_FILL و ODOMETER_NOT_INCREASING و USE_WALLET بلغتين',
  ['OVER_BALANCE','DUPLICATE_FILL','ODOMETER_NOT_INCREASING','USE_WALLET','OPEN_REQUEST','BALANCE_OK'].every(c=>{const e=W.walletRpcError({message:c});return e&&e.code==='E-'+c&&e.ar&&e.bn;}));
ok('خطأ غير معروف ⇒ null (يتولاه humanError)',W.walletRpcError({message:'network down'})===null);
ok('أخطاء الإدارة: DUPLICATE_TXN و ALREADY_REVIEWED بالعربي، وغيرها null',/مستعمل/.test(W.walletAdminError({message:'DUPLICATE_TXN'}))&&/رُوجعت/.test(W.walletAdminError({message:'ALREADY_REVIEWED'}))&&W.walletAdminError({message:'x'})===null);

ok('حالة التعبئة بلغتين، وغير المعروفة ⇒ بانتظار المراجعة',W.fillStatus('rejected').bn==='প্রত্যাখ্যাত'&&W.fillStatus('approved').ar==='معتمدة'&&W.fillStatus(undefined).ar==='بانتظار المراجعة');
ok('سعر اللتر: 25/11 = 2.27، وبلا لترات ⇒ null',W.pricePerLiter({amount:25,liters:11})===2.27&&W.pricePerLiter({amount:25,liters:null})===null);
const fills=[{id:'b',status:'submitted',fill_at:'2026-10-13'},{id:'a',status:'submitted',fill_at:'2026-10-12'},{id:'c',status:'approved',fill_at:'2026-10-11'},{id:'d',status:'submitted',legacy:true,fill_at:'2026-09-01'}];
ok('تعبئات بانتظار الاعتماد: submitted فقط بلا legacy، الأقدم أولاً',W.pendingFills(fills).map(f=>f.id).join()==='a,b');
ok('دفعات بانتظار التحويل: requested فقط، الأقدم أولاً',W.pendingTopups([open,tr,req(1,'requested')]).map(r=>r.id).join()==='1,3');
ok('نموذج التحويل: رقم العملية إلزامي، ومبلغ ورسوم صالحة',W.transferFormError({txn:' ',amount:'50',fee:'0.58'})&&W.transferFormError({txn:'T',amount:'0',fee:'0.58'})&&W.transferFormError({txn:'T',amount:'50',fee:''})&&W.transferFormError({txn:'T',amount:'50',fee:'0.58'})===null&&W.transferFormError({txn:'T',amount:'50',fee:'0'})===null);

const ex=[{period:'2026-10',category:'وقود',amount:'25',n:1},{period:'2026-10',category:'رسوم بنكية',amount:'2.32',n:4},{period:'2026-09',category:'وقود',amount:'40',n:2}];
ok('المصروفات: الشهر فقط',JSON.stringify(W.fuelExpenseCats(ex,'month','2026-10'))===JSON.stringify([{label:'وقود',val:25},{label:'رسوم بنكية',val:2.32}]));
ok('المصروفات: الكل يجمع الأشهر',W.fuelExpenseCats(ex,'all','2026-10').find(c=>c.label==='وقود').val===65);
ok('المصروفات: لا صفوف ⇒ []',W.fuelExpenseCats([],'all')+''==='');

// الصفحات: لا «اطلب وقوداً» ولا request_fuel، والتحويل بالأسماء
const fo=fs.readFileSync('src/FuelOil.jsx','utf8'),fq=fs.readFileSync('src/FleetRequests.jsx','utf8');
ok('البوابة: حُذف نموذج «اطلب وقوداً» ولا استدعاء request_fuel',!/اطلب وقوداً/.test(fo)&&!/rpc\("request_fuel"/.test(fo)&&/rpc\("request_urgent_topup"/.test(fo)&&/rpc\("my_fuel_balance"\)/.test(fo));
ok('الإدارة: التحويل بالأسماء p_bank_txn (لا p_ref)، والرفض ومراجعة التعبئة والأرصدة',/p_bank_txn:/.test(fq)&&!/p_ref:/.test(fq)&&/"reject_fuel_request"/.test(fq)&&/"review_fuel_fill"/.test(fq)&&/rpc\("fuel_balances"\)/.test(fq));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
