// فحص بوابة البايكر على عرض 360 في متصفح حقيقي (Playwright + Chromium): لا تمرير أفقي، ولا عنصر يتجاوز العرض، ولا أخطاء console.
// يعمل فقط مع PORTAL360=1 (npm run check:360)؛ بدونه يُتخطّى بلا فشل. يبني المشروع ثم يشغّل vite preview،
// ويحاكي Supabase كاملاً (auth + rest) بصفوف وهمية، فلا يلمس الإنتاج ولا يحتاج شبكة.
// العهدة تُفحص بحالاتها الثلاث: تسجيل أول (لا تصريحات)، بانتظار الاعتماد، و«عهدتي الحالية» بعد الاعتماد.
import {spawn, execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
if(!process.env.PORTAL360){console.log('- skipped (PORTAL360 غير محدد — npm run check:360)');process.exit(0);}
let chromium;try{({chromium}=await import('playwright'));}catch{console.log('- skipped (playwright غير مثبت)');process.exit(0);}

const W=360,H=740,PORT=4179,BASE=`http://127.0.0.1:${PORT}`;
const OUT=process.env.PORTAL360_OUT||path.join(process.cwd(),'.portal360');fs.mkdirSync(OUT,{recursive:true});
const UID='00000000-0000-0000-0000-000000001648',EMP='10000000-0000-0000-0000-000000001648',OP='b0000000-0000-0000-0000-000000000001';
const VAC='20000000-0000-0000-0000-000000000001',HELM='20000000-0000-0000-0000-000000000002';
const user={id:UID,aud:'authenticated',role:'authenticated',email:'biker1648@dalu.sa',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-10-01T00:00:00Z'};
const session={access_token:'eyJhbGciOiJIUzI1NiJ9.e30.x',refresh_token:'r',token_type:'bearer',expires_in:3600*24*365,expires_at:Math.floor(Date.now()/1000)+3600*24*365,user};
const tabRules=['handover','fuel','perf','docs','assets','daily','academy'].map(k=>({tab_key:k,visible:true,in_bottom_nav:['handover','daily','assets'].includes(k),updated_at:null}));
const asset=(id,name,en,start,end,life,status='active')=>({id,employee_id:EMP,biker_name:'Midul Hassan',sweater_id:'1648',item_type:'tool',category:'أدوات',name,name_en:en,start_date:start,end_date:end,life_months:life,lead_days:45,status,reorder_request_id:null,source:'round',created_at:start+'T00:00:00Z'});
const decl=(kind,status,extra={})=>({id:'30000000-0000-0000-0000-00000000000'+(kind==='update'?'2':'1'),kind,asset_id:null,items:[{key:'vacuum',name_ar:'المكنسة الكهربائية',condition:'good',qty:1,photo:'p'},{key:'helmet',name_ar:'الخوذة',condition:'poor',note:'شرخ في الجانب الأيسر — نص طويل لفحص الالتفاف على الشاشة الضيقة',qty:1,photo:'p'}],notes:null,status,reject_reason:null,reviewed_at:null,request_id:null,created_at:'2026-10-09T10:00:00Z',...extra});
// السيناريوهات: تصريحات العهدة وقطعها
const SCEN={
  baseline:{label:'العهدة — نموذج التسجيل الأول',biker_assets:[],custody_assets:[]},
  pending:{label:'العهدة — بانتظار الاعتماد',biker_assets:[decl('baseline','declared')],custody_assets:[]},
  // الجوال في التسجيل الأول: حقول IMEI (فحص فوري بلغتين) وصورة الشاشة والماركة والخط والملحقات
  phone:{label:'العهدة — الجوال في التسجيل الأول',biker_assets:[],custody_assets:[]},
  // الجوال المعتمد في «عهدتي الحالية»: آخر 4 أرقام من IMEI فقط
  phonepiece:{label:'العهدة — الجوال في «عهدتي الحالية»',biker_assets:[decl('baseline','approved',{reviewed_at:'2026-10-09T12:00:00Z'})],
    custody_assets:[{...asset('20000000-0000-0000-0000-000000000009','الجوال','Mobile Phone','2026-10-14','2028-10-14',24),item_type:'device',category:'أجهزة',serial_no:'490154203237518',specs:{brand_model:'Samsung A15',acc:{charger:true,holder:true,case:false}}}]},
  rejected:{label:'العهدة — مرفوض (السبب ظاهر)',biker_assets:[decl('baseline','rejected',{reject_reason:'أعد التسجيل مع صورة لكل قطعة'})],custody_assets:[]},
  // الوقود والزيت: طلب «مطلوب» وآخر «حُوِّل» وتعبئة، وطلب زيت «أُرسل لسويتر» ⇒ نموذج تأكيد التنفيذ ظاهر
  fuel:{label:'الوقود والزيت — طلبات وتعبئة وتأكيد الزيت',tabs:[['fuel','الوقود']],biker_assets:[],custody_assets:[],
    fuel_requests:[{id:'50000000-0000-0000-0000-000000000001',plate:'5531 BG',amount:50,odometer:14230,status:'requested',requested_at:'2026-10-12T08:00:00Z',transferred_at:null},
      {id:'50000000-0000-0000-0000-000000000002',plate:'5531 BG',amount:50,odometer:13410,status:'transferred',requested_at:'2026-10-05T08:00:00Z',transferred_at:'2026-10-05T10:00:00Z'}],
    fuel_logs:[{id:'60000000-0000-0000-0000-000000000001',plate:'5531 BG',odometer:13420,amount:25,fill_at:'2026-10-05T12:00:00Z',request_id:'50000000-0000-0000-0000-000000000002'}],
    maintenance_requests:[{id:'70000000-0000-0000-0000-000000000001',plate:'5531 BG',status:'sent',odometer:14100,requested_at:'2026-10-10T08:00:00Z',sent_at:'2026-10-10T09:00:00Z',done_at:null,approved_at:null}]},
  // الحساب التجريبي (is_test): سطر «حساب تجريبي» في الرأس وشارة على الدراجة، بلغتين وبلا تجاوز
  // «أدائي» بعد ترحيل يوليو: بطاقة «مسيري المعتمد» (565.40 مدفوعة بتاريخ ومرجع مختصر) + يونيو، بجانب أداء الشهر
  pay:{label:'أدائي — المسير المعتمد',tabs:[['perf','أدائي']],biker_assets:[],custody_assets:[],
    ops_biker_month:[{period:'2026-09',sweater_id:'1648',biker_name:'Midul Hassan',net_washes:83,rating:4.65,approved_complaints:0,complaint_pct:0,daily:{}}],
    payroll_lines:[{period:'2026-07',biker_id:'1648 ',net_bonus:565.4,inputs:{net_washes:190,tips:42.9},computed:{net_washes:190,rate_per_wash:2.75,tips:42.9,production:0},payment_status:'paid',paid_at:'2026-10-13',paid_amount:565.4,payment_ref:'9113102600103372',base_paid:null},
      {period:'2026-07',biker_id:'1700',net_bonus:817.75,inputs:{},computed:{},payment_status:'paid',paid_at:'2026-10-13',paid_amount:817.75,payment_ref:null,base_paid:null},
      {period:'2026-06',biker_id:'1648',net_bonus:800.13,inputs:{},computed:{net_washes:203,rate_per_wash:3.75,tips:0,production:25},payment_status:'paid',paid_at:'2026-10-04',paid_amount:800.13,payment_ref:null,base_paid:true}]},
  test:{label:'الحساب التجريبي — الشارة',tabs:[['profile','ملفي']],biker_assets:[],custody_assets:[],test:true},
  mine:{label:'العهدة — «عهدتي الحالية» وتحديث الحالة',biker_assets:[decl('baseline','approved',{reviewed_at:'2026-10-09T12:00:00Z'}),{...decl('update','declared'),asset_id:HELM,items:[{key:'helmet',condition:'poor',photo:'p',note:'شرخ'}]}],
    custody_assets:[asset(VAC,'المكنسة','Vacuum Cleaner','2026-08-07','2028-02-07',18),asset(HELM,'الخوذة','Helmet','2026-08-07','2028-08-07',24,'due'),asset('20000000-0000-0000-0000-000000000003','الفرش (إطارات/مكيّف/أرضية/صغيرة)','Brushes set','2026-04-01','2026-10-01',6)]},
};

// محاكاة Supabase: auth + rest. كل جدول غير معروف ⇒ []
function restReply(url,headers,scen){
  const table=url.pathname.split('/rest/v1/')[1]||'';
  const single=/vnd\.pgrst\.object/.test(headers['accept']||'');
  const rows={
    biker_tab_rules:tabRules,
    app_users:[{id:UID,biker_employee_id:'1648',display_name:'Midul Hassan',operator_id:OP,position:null,is_owner:false,active:true,is_test:!!scen.test}],
    employees:[{id:EMP,full_name:'Midul Hassan',employee_id:'1648'}],
    operators:[{id:OP,name:'دلو ورغوة'}],
    fleet_vehicles:[{id:'40000000-0000-0000-0000-000000000001',plate:'5531 BG',make:'Honda',biker_employee_id:EMP,held_by:null,held_until:null,held_reason:null,needs_receipt_update:false,is_test:!!scen.test}],
    biker_assets:scen.biker_assets,custody_assets:scen.custody_assets,
    ops_biker_month:scen.ops_biker_month||[],payroll_lines:scen.payroll_lines||[],
    fuel_requests:scen.fuel_requests||[],fuel_logs:scen.fuel_logs||[],maintenance_requests:scen.maintenance_requests||[],
  }[table]||[];
  const body=single?(rows[0]||null):rows;
  if(single&&!rows[0])return{status:406,body:JSON.stringify({code:'PGRST116',message:'0 rows'})};
  return{status:200,body:JSON.stringify(body),headers:{'content-range':`0-${Math.max(rows.length-1,0)}/${rows.length}`}};
}
async function mock(page,scen){
  await page.route('**/auth/v1/**',r=>{const u=r.request().url();
    if(/\/user/.test(u))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)});
    if(/\/token/.test(u))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(session)});
    return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.route('**/rest/v1/**',r=>{const q=restReply(new URL(r.request().url()),r.request().headers(),scen);
    return r.fulfill({status:q.status,contentType:'application/json',headers:q.headers||{},body:q.body});});
  await page.route(/\/(storage|functions)\/v1\//,r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
}

// قياس التجاوز الأفقي: عرض الوثيقة، وكل عنصر مرئي يخرج عن حافة الشاشة
const overflow=()=>{const w=window.innerWidth;const doc=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth);
  const bad=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height)return false;const cs=getComputedStyle(e);
    if(cs.visibility==='hidden'||cs.position==='fixed'&&/gs-panel|gs-wrap/.test(e.className))return false;
    // عناصر الدرج المغلق (خارج الشاشة عمداً) وما يُقصّ داخل حاوية overflow:hidden لا يُحتسب
    let p=e.parentElement;while(p&&p!==document.body){const pc=getComputedStyle(p);if(/hidden|clip/.test(pc.overflowX)||/hidden|clip/.test(pc.overflow))return false;if(/gs-panel|gs-wrap|gs-scrim/.test(p.className))return false;p=p.parentElement;}
    if(/gs-panel|gs-wrap|gs-scrim/.test(e.className))return false;
    return r.right>w+1||r.left<-1;}).slice(0,6).map(e=>`${e.tagName.toLowerCase()}.${String(e.className||'').split(' ').filter(Boolean).slice(0,2).join('.')}@${Math.round(e.getBoundingClientRect().right)}`);
  return{doc,w,bad};};

let server;const log=(...a)=>console.log('  ',...a);
try{
  execFileSync('npx',['vite','build','--logLevel','error'],{stdio:'inherit'});
  server=spawn('npx',['vite','preview','--port',String(PORT),'--strictPort','--host','127.0.0.1'],{stdio:'ignore'});
  for(let i=0;i<60;i++){try{await fetch(BASE);break;}catch{await new Promise(r=>setTimeout(r,250));}}
  // Chromium: الافتراضي، وإلا ملف تنفيذي صريح (PORTAL360_CHROME أو /opt/pw-browsers/chromium)
  const exe=process.env.PORTAL360_CHROME||['/opt/pw-browsers/chromium','/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f=>{try{return fs.statSync(f).isFile();}catch{return false;}});
  let browser;try{browser=await chromium.launch();}catch(e){if(!exe)throw e;browser=await chromium.launch({executablePath:exe});}
  const errors=[];
  for(const[key,scen]of Object.entries(SCEN)){
    const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'ar'});
    await ctx.addInitScript(([k,s])=>{localStorage.setItem(k,JSON.stringify(s));},['sb-cnmggdrlkgsyrjxmvydv-auth-token',session]);
    const page=await ctx.newPage();
    page.on('console',m=>{if(m.type()==='error')errors.push(`[${key}] ${m.text().slice(0,160)}`);});
    page.on('pageerror',e=>errors.push(`[${key}] pageerror: ${String(e.message||e).slice(0,160)}`));
    await mock(page,scen);
    await page.goto(BASE+'/#biker',{waitUntil:'networkidle'});
    await page.waitForSelector('.bp-content',{timeout:15000});
    // التبويبات: «ملفي» ثم كل تبويب مفتوح عبر الدرج (العهدة فقط في السيناريوهات غير الأول)
    const tabs=scen.tabs||(key==='baseline'?[['profile','ملفي'],['handover','الدراجة'],['fuel','الوقود'],['perf','أدائي'],['docs','وثائقي'],['assets','العهدة'],['daily','الاستلام'],['academy','الأكاديمية'],['support','الدعم والأفكار']]:[['assets','العهدة']]);
    for(const[k,ar]of tabs){
      if(k!=='profile'){
        // على الجوال الدرج يُفتح من «المزيد» في الشريط السفلي (البرغر للأجهزة اللوحية فقط)
        const bar=page.locator('.g-bnav-i',{hasText:ar});
        if(await bar.count())await bar.first().click();else{await page.getByRole('button',{name:/المزيد/}).click();await page.locator('.gs-item',{hasText:ar}).first().click();}
        await page.waitForTimeout(600);}
      await page.waitForLoadState('networkidle');await page.waitForTimeout(300);
      const o=await page.evaluate(overflow);
      await page.screenshot({path:path.join(OUT,`${key}-${k}.png`),fullPage:true});
      ok(`${key==='baseline'?'':scen.label+' · '}${ar} @360: لا تمرير أفقي (${o.doc}px) ولا عنصر خارج الشاشة${o.bad.length?' — '+o.bad.join(', '):''}`,o.doc<=o.w&&o.bad.length===0);
    }
    if(key==='phone'){
      await page.locator('label[for="as_phone"]').click();await page.waitForTimeout(200);
      ok('الجوال أول الأصناف، وحقوله ظاهرة بعد تحديده (IMEI وتلميح *#06# بلغتين، صورة الشاشة، الماركة، الخط، 3 ملحقات)',
        await page.locator('.bp-aitem').first().getAttribute('id')==='asi_phone'&&await page.locator('#asp_imei').count()===1&&await page.getByText('*#06#',{exact:false}).count()>=1
        &&await page.locator('.bp-hint .bn').count()===1&&await page.locator('#asp_imei_photo').count()===1&&await page.locator('#asp_brand').count()===1&&await page.locator('#asp_sim').count()===1&&await page.locator('.bp-accs input').count()===3);
      await page.fill('#asp_imei','490154203237519');await page.waitForTimeout(150);
      const bad=await page.locator('.bp-imei-st').innerText();
      await page.fill('#asp_imei','٤٩٠١٥٤ ٢٠٣ ٢٣٧ ٥١٨');await page.waitForTimeout(150);
      const good=await page.locator('.bp-imei-st').innerText();
      ok('فحص IMEI فوري: رقم خاطئ ⇒ «الرقم غير صحيح» بلغتين، وأرقام عربية صحيحة ⇒ «رقم صحيح ✓»',/غير صحيح/.test(bad)&&/সঠিক নয়/.test(bad)&&/رقم صحيح/.test(good)&&/সঠিক নম্বর/.test(good));
      await page.fill('#asp_imei','4901');await page.locator('#as_pledge').check();await page.getByRole('button',{name:'حفظ إقرار العهدة'}).click();await page.waitForTimeout(300);
      const t=await page.locator('#asi_phone').innerText();
      ok('الإرسال بلا صورة جهاز ⇒ يتوقف عند الجوال بخطأ بلغتين ولا يُرسل',/صوّر الصنف «الجوال»/.test(t)&&/ছবি তুলুন/.test(t));
      const o=await page.evaluate(overflow);await page.screenshot({path:path.join(OUT,'phone-form.png'),fullPage:true});
      ok('نموذج الجوال مفتوح @360 بلا تجاوز',o.doc<=o.w&&o.bad.length===0);
    }
    if(key==='phonepiece'){
      const t=await page.locator('.bp-piece').innerText();
      ok('«عهدتي الحالية»: الجوال بآخر 4 أرقام من IMEI فقط، والماركة، والملحقات بلغتين',/IMEI …7518/.test(t)&&!t.includes('490154203237518')&&/Samsung A15/.test(t)&&/شاحن، حامل/.test(t)&&/চার্জার, হোল্ডার/.test(t));
    }
    if(key==='mine'){
      ok('«عهدتي الحالية»: 3 قطع، والخوذة «بانتظار الاستبدال» وتحديثها معلّق، والمكنسة لها زر «تحديث الحالة»',
        await page.locator('.bp-piece').count()===3&&await page.getByText('بانتظار الاستبدال').count()===1&&await page.getByText('تحديث بانتظار الاعتماد').count()===1&&await page.getByRole('button',{name:'تحديث الحالة'}).count()===2);
      await page.getByRole('button',{name:'تحديث الحالة'}).first().click();await page.waitForTimeout(300);
      const o=await page.evaluate(overflow);await page.screenshot({path:path.join(OUT,'mine-assets-update.png'),fullPage:true});
      ok('نموذج «تحديث الحالة» مفتوح @360 بلا تجاوز',o.doc<=o.w&&o.bad.length===0&&await page.getByRole('button',{name:'إرسال للاعتماد'}).count()===1);
    }
    if(key==='baseline'){
      // الوقود بلا بيانات: «اطلب وقوداً» بمبلغ 50 مملوء، و«سجّل تعبئة»، ونموذج «اطلب تغيير الزيت»، ولا خيار «زيت» في التعبئة
      await page.locator('.g-bnav-i',{hasText:'الوقود'}).count()?await page.locator('.g-bnav-i',{hasText:'الوقود'}).first().click():(await page.getByRole('button',{name:/المزيد/}).click(),await page.locator('.gs-item',{hasText:'الوقود'}).first().click());
      await page.waitForTimeout(500);
      ok('الوقود: «اطلب وقوداً» (50 مملوءة) و«سجّل تعبئة» و«اطلب تغيير الزيت»، بلا اختيار «زيت» في التعبئة',
        await page.getByText('اطلب وقوداً').count()===1&&await page.locator('#fr_amt').inputValue()==='50'&&await page.getByText('سجّل تعبئة').count()===1
        &&await page.getByRole('button',{name:'اطلب تغيير الزيت'}).count()===1&&await page.getByRole('radio',{name:/زيت/}).count()===0);
    }
    if(key==='fuel'){
      ok('الوقود: الحالات ظاهرة بلغتين («مطلوب» و«حُوِّل»)، ونموذج تأكيد الزيت (الإثبات + اسم مسؤول سويتر)',
        await page.getByText('مطلوب ·',{exact:false}).count()>=1&&await page.getByText('حُوِّل ·',{exact:false}).count()>=1&&await page.locator('#oc_tech').count()===1&&await page.getByRole('button',{name:'أكّد تغيير الزيت'}).count()===1);
      const txt=await page.locator('.bp-content').innerText();
      ok('لا أرقام تحليلية للدرّاج (لا كم/لتر، لا استهلاك، لا مخصّص شهري)',!/كم\s*\/|كم لكل|استهلاك|متوسط|مخصّص|تجاوز|280/.test(txt));
    }
    if(key==='test')ok('الحساب التجريبي: «🧪 حساب تجريبي» في الرأس وعلى الدراجة، بالعربي والبنغالي',
      await page.getByText('🧪 حساب تجريبي',{exact:false}).count()===1&&await page.locator('.bp-pcell .k',{hasText:'🧪 تجريبي'}).count()===1&&await page.locator('.bn',{hasText:'পরীক্ষামূলক অ্যাকাউন্ট'}).count()===1&&await page.locator('.bn',{hasText:/^পরীক্ষামূলক$/}).count()===1);
    if(key==='pay'){const t=await page.locator('.bp-content').innerText();
      ok('«مسيري المعتمد»: يوليو 565.40 «مدفوعة» بتاريخ 2026-10-13 ومرجع مختصر …3372 (بلغتين)، ويونيو 800.13 والأساس مدفوع، ولا سطر بايكر آخر',
        t.includes('مسيري المعتمد')&&t.includes('565.40')&&t.includes('2026-10-13')&&t.includes('…3372')&&!t.includes('9113102600103372')&&!t.includes('817.75')
        &&t.includes('800.13')&&t.includes('الراتب الأساسي مدفوع')&&await page.locator('.bp-pay .g-badge .bn',{hasText:'পরিশোধিত'}).count()===2);}
    if(key==='baseline')ok('الحساب الحقيقي: لا شارة «تجريبي»',await page.getByText('🧪',{exact:false}).count()===0);
    if(key==='pending')ok('بطاقة الانتظار تعرض صنفَي التسجيل',await page.getByText('بانتظار الاعتماد').count()>=1&&await page.locator('.bp-item').count()===2);
    if(key==='rejected')ok('سبب الرفض ظاهر بالعربي والبنغالي',await page.getByText('أعد التسجيل مع صورة لكل قطعة').count()===1&&await page.locator('.bp-asrej .bn').count()>=1);
    await ctx.close();
  }
  // أخطاء console: نتجاهل ما ينتج عن المحاكاة نفسها (صور وهمية، 406 للصفوف المفقودة)
  const real=errors.filter(e=>!/brand-mark|favicon|406|Failed to load resource/.test(e));
  ok('لا أخطاء console أو JS في أي شاشة'+(real.length?' — '+real.slice(0,3).join(' | '):''),real.length===0);
  await browser.close();
  log('الصور في',OUT);
}finally{if(server)server.kill();}
