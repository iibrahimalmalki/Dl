// «طلب سويتر» من صفحة العُهد في متصفح حقيقي (Playwright + Chromium) حتى إكماله في «طلبات الإمداد».
// يعمل فقط مع CUSTODY_UI=1 (npm run check:custody)؛ بدونه يُتخطّى بلا فشل. يبني المشروع ثم يشغّل vite preview،
// ويحاكي Supabase (auth + rest) — والمحاكاة تتحقق من أعمدة select لكل جدول كما يفعل PostgREST
// (عمود غير موجود ⇒ 400 «column t.c does not exist»، و select=* على custody_assets ⇒ مرفوض لأن decision_note/decided_by بلا صلاحية).
import {spawn, execFileSync} from 'node:child_process';
import fs from 'node:fs';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
if(!process.env.CUSTODY_UI){console.log('- skipped (CUSTODY_UI غير محدد — npm run check:custody)');process.exit(0);}
let chromium;try{({chromium}=await import('playwright'));}catch{console.log('- skipped (playwright غير مثبت)');process.exit(0);}

const PORT=4183,BASE=`http://127.0.0.1:${PORT}`,UID='00000000-0000-0000-0000-00000000000a',OP='b0000000-0000-0000-0000-000000000001';
const user={id:UID,aud:'authenticated',role:'authenticated',email:'owner@dalu.sa',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const session={access_token:'eyJhbGciOiJIUzI1NiJ9.e30.x',refresh_token:'r',token_type:'bearer',expires_in:9e6,expires_at:Math.floor(Date.now()/1000)+9e6,user};

// الأعمدة المسموح بقراءتها (الإنتاج 2026-10-14): supply_requests كاملة، و custody_assets بمنحة الأعمدة (round_custody_check.sql §5)
const SCHEMA={
  supply_requests:['id','seq','ref','operator_id','round_id','biker_name','sweater_id','requesting_dept','items','status','sla_hours','created_at','escalated_at','completed_at','completion_note','notes','created_by'],
  custody_assets:['id','operator_id','employee_id','biker_name','sweater_id','item_type','category','name','name_en','start_date','life_months','end_date','lead_days','cost','status','source','round_id','reorder_request_id','notes','created_at','created_by','serial_no','specs','last_check_at','last_check_condition','last_check_round_id','last_check_note','last_check_photo','last_check_imei_ok','decision_status','decided_at'],
};
const EA='e-ariful',EM='e-midul';
const A=(id,name,item_type,status,end,x={})=>({id,operator_id:OP,employee_id:EA,biker_name:'Ariful Islam',sweater_id:'1624',item_type,category:'-',name,name_en:'',start_date:'2026-01-01',end_date:end,life_months:1,lead_days:7,status,source:'handover',reorder_request_id:null,notes:null,created_at:'2026-10-14T00:00:00Z',...x});
const db={
  app_users:[{id:UID,is_owner:true,active:true,display_name:'المالك',email:'owner@dalu.sa',operator_id:OP}],operators:[{id:OP,name:'دلو ورغوة',active:true}],
  employees:[{id:EA,full_name:'Ariful Islam',employee_id:'1624',operator_id:OP},{id:EM,full_name:'Midul Hassan',employee_id:'1648',operator_id:OP}],
  custody_assets:[
    A('a-soap','صابون/شامبو','cleaning','due','2026-02-01'),A('a-chest','الصدرية (واقي الصدر)','safety','due','2028-01-01',{life_months:24,lead_days:60}),
    A('a-towel','مناشف ميكروفايبر (4 ألوان)','towel','active','2026-03-01',{life_months:2}),A('a-helm','الخوذة','safety','missing',null,{life_months:24}),
    A('a-bike','الدراجة النارية','motorcycle','due','2026-09-01',{life_months:36,lead_days:90}),A('a-phone','الجوال','device','active','2026-09-01',{serial_no:'490154203237518'}),
    A('a-stain','مزيل البقع','cleaning','due','2026-02-01',{reorder_request_id:'q-open'}),A('a-uni','الزي الرسمي','uniform','active','2027-01-01',{life_months:12,lead_days:45}),
    A('m-soap','صابون/شامبو','cleaning','due','2026-03-01',{employee_id:EM,biker_name:'Midul Hassan',sweater_id:'1648'})],
  supply_requests:[{id:'q-open',seq:1,ref:'DW-1624-OLD',operator_id:OP,round_id:null,biker_name:'Ariful Islam',sweater_id:'1624',requesting_dept:'x',items:[{n:null,ar:'مزيل البقع'}],status:'open',sla_hours:24,created_at:new Date().toISOString()}],
  biker_assets:[],field_rounds:[],
};
const calls=[],rejected=[],dialogs=[],errs=[];let seq=10;
// فلاتر PostgREST المستعملة: eq / in / is
const match=(row,params)=>{for(const[k,v]of params){if(['select','order','limit','offset','or','on_conflict','columns'].includes(k))continue;
  const[op,...rest]=v.split('.');const val=rest.join('.');
  if(op==='eq'&&String(row[k])!==val)return false;
  if(op==='in'&&!val.replace(/^\(|\)$/g,'').split(',').map(s=>s.replace(/^"|"$/g,'')).includes(String(row[k])))return false;
  if(op==='is'&&!(val==='null'?row[k]==null:String(row[k])===val))return false;}return true;};
const badSelect=(t,sel)=>{if(!SCHEMA[t]||sel==null)return null;
  if(sel==='*')return t==='custody_assets'?'permission denied for table custody_assets':null;
  const miss=sel.split(',').map(s=>s.trim()).filter(Boolean).find(c=>!SCHEMA[t].includes(c));return miss?`column ${t}.${miss} does not exist`:null;};

let server;
try{
  execFileSync('npx',['vite','build','--logLevel','error'],{stdio:'inherit'});
  server=spawn('npx',['vite','preview','--port',String(PORT),'--strictPort','--host','127.0.0.1'],{stdio:'ignore'});
  for(let i=0;i<60;i++){try{await fetch(BASE);break;}catch{await new Promise(r=>setTimeout(r,250));}}
  const exe=['/opt/pw-browsers/chromium'].find(f=>{try{return fs.statSync(f).isFile();}catch{return false;}});
  let browser;try{browser=await chromium.launch();}catch(e){if(!exe)throw e;browser=await chromium.launch({executablePath:exe});}
  const ctx=await browser.newContext({viewport:{width:1100,height:1000},locale:'ar'});
  await ctx.addInitScript(([k,s])=>localStorage.setItem(k,JSON.stringify(s)),['sb-cnmggdrlkgsyrjxmvydv-auth-token',session]);
  const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push(String(e.message)));
  p.on('dialog',d=>{dialogs.push({type:d.type(),msg:d.message()});d.type()==='prompt'?d.accept('تم التوفير'):d.accept();});
  await p.route('**/auth/v1/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(/token/.test(r.request().url())?session:user)}));
  await p.route(/\/(storage|functions)\/v1\//,r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await p.route('**/rest/v1/**',r=>{const q=r.request(),u=new URL(q.url()),m=q.method();
    const t=u.pathname.split('/rest/v1/')[1],params=[...u.searchParams.entries()],sel=u.searchParams.get('select');
    const single=/vnd\.pgrst\.object/.test(q.headers()['accept']||'');
    const json=(b,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'content-range':`0-${Array.isArray(b)?b.length:1}/*`},body:JSON.stringify(b)});
    if(t.startsWith('rpc/')){const body=JSON.parse(q.postData()||'{}');calls.push({rpc:t.slice(4),body});
      return json(t==='rpc/supply_request_complete'?{renewed:(body.p_assets||[]).length,start:'2026-10-14'}:null);}
    const bad=badSelect(t,sel);if(bad){rejected.push(`${m} ${t}: ${bad}`);return json({code:'42703',message:bad},400);}
    const rows=db[t]||[];
    if(m==='POST'){const body=JSON.parse(q.postData()||'null');const list=(Array.isArray(body)?body:[body]).map(x=>({id:'q-new-'+(++seq),seq,status:'open',sla_hours:24,created_at:new Date().toISOString(),...x}));
      calls.push({POST:t,body:list,select:sel});(db[t]=db[t]||[]).push(...list);return json(single?list[0]:list,201);}
    if(m==='PATCH'){const body=JSON.parse(q.postData()||'{}');const hit=rows.filter(x=>match(x,params));hit.forEach(x=>Object.assign(x,body));
      calls.push({PATCH:t,body,ids:hit.map(x=>x.id),select:sel});return json(single?hit[0]:hit);}
    const d=rows.filter(x=>match(x,params));return json(single?(d[0]||null):d);});

  await p.goto(BASE+'/#admin',{waitUntil:'networkidle'});await p.waitForTimeout(1200);
  const go=async t=>{await p.locator('.gs-item',{hasText:t}).first().click({timeout:8000});await p.waitForTimeout(1200);};
  await go('العُهد والإهلاك');

  // ── 1) عدة قطع لعريف ⇒ طلب سويتر واحد ──
  await p.locator('select[aria-label="البايكر"]').selectOption({label:'Ariful Islam · #1624'});await p.waitForTimeout(300);
  ok('فلتر البايكر يعرض قطع عريف فقط (8)',await p.locator('.cu-card').count()===8);
  ok('القطعة المربوطة بطلب مفتوح تحمل رقمه ولا تُحدَّد',(await p.locator('.cu-card',{hasText:'مزيل البقع'}).innerText()).includes('DW-1624-OLD')&&await p.locator('.cu-card',{hasText:'مزيل البقع'}).locator('.cu-pick').count()===0);
  const all=p.getByRole('button',{name:/حدّد كل ما يحتاج طلباً/});
  ok('«حدّد كل ما يحتاج طلباً» = 4 (لا الدراجة ولا الجوال ولا المربوطة ولا السليمة)',(await all.innerText()).includes('(4)'));
  await all.click();await p.waitForTimeout(200);
  ok('شريط التحديد: 4 قطع لـ Ariful Islam',/4 قطع محدّدة لـ\s*Ariful Islam/.test(await p.locator('.cu-selbar').innerText()));
  await p.getByRole('button',{name:/طلب سويتر واحد للمحدّد/}).click();await p.waitForTimeout(1200);
  const post=calls.filter(c=>c.POST==='supply_requests');
  ok('طلب واحد أُنشئ (إدراج واحد) بأربعة أسطر',post.length===1&&post[0].body.length===1&&post[0].body[0].items.length===4);
  ok('الإرجاع بعد الإدراج من أعمدة supply_requests (id,ref,status) — لا خطأ «column … does not exist»',post[0]&&post[0].select==='id,ref,status'&&!rejected.length);
  const newId=post[0]&&post[0].body[0].id,newRef=post[0]&&post[0].body[0].ref;
  const pt=calls.filter(c=>c.PATCH==='custody_assets');
  ok('القطع الثلاث «مستحقة» ومربوطة بالطلب في تحديث واحد',pt[0]&&pt[0].body.status==='due'&&pt[0].body.reorder_request_id===newId&&pt[0].ids.sort().join()==='a-chest,a-soap,a-towel');
  ok('الناقصة تُربط فقط وتبقى «ناقصة» بلا عدّاد',pt[1]&&pt[1].body.reorder_request_id===newId&&!('status' in pt[1].body)&&pt[1].ids.join()==='a-helm'&&db.custody_assets.find(x=>x.id==='a-helm').status==='missing');
  ok('لا تجديد للتواريخ عند الطلب',pt.every(c=>!('start_date' in c.body)&&!('end_date' in c.body)));
  const body=await p.locator('body').innerText();
  ok('رسالة النجاح برقم الطلب، ولا رسالة خطأ',body.includes(`أُنشئ طلب سويتر ${newRef} (4 قطع)`)&&!body.includes('خطأ في إنشاء الطلب'));
  ok('تأكيد قبل الإنشاء يسرد القطع الأربع',dialogs.some(d=>d.type==='confirm'&&/يضمّ 4 قطع/.test(d.msg)&&['صابون/شامبو','الصدرية','مناشف','الخوذة'].every(n=>d.msg.includes(n))));
  ok('بعد الإنشاء: القطع الأربع تحمل رقم الطلب ولم تعد قابلة للتحديد',await p.locator('.cu-badge.req',{hasText:newRef}).count()===4&&await p.locator('.cu-pick').count()===0&&await p.locator('.cu-selbar').count()===0);

  // ── 2) زر البطاقة لقطعة واحدة (ميدول) ──
  await p.locator('select[aria-label="البايكر"]').selectOption({label:'Midul Hassan · #1648'});await p.waitForTimeout(300);
  const nd=dialogs.length;
  await p.locator('.cu-card',{hasText:'صابون/شامبو'}).getByRole('button',{name:/طلب سويتر \(إعادة\)/}).click();await p.waitForTimeout(1000);
  const post2=calls.filter(c=>c.POST==='supply_requests');
  ok('زر البطاقة: طلب بسطر واحد لميدول وربط القطعة، بلا خطأ',post2.length===2&&post2[1].body[0].items.length===1&&post2[1].body[0].sweater_id==='1648'&&calls.filter(c=>c.PATCH==='custody_assets').pop().ids.join()==='m-soap'&&!rejected.length);
  ok('قطعة واحدة لا تطلب تأكيداً إضافياً',dialogs.length===nd);

  // ── 3) الإكمال في «طلبات الإمداد» يعرض القطع المرتبطة كلها ويجدّدها ──
  await go('طلبات الإمداد');
  const card=p.locator('.sq-card,[class*="sq-"]',{hasText:newRef}).filter({has:p.getByRole('button',{name:/اكتمال/})}).first();
  ok('سطور الطلب بلا «#null»',!(await p.locator('body').innerText()).includes('#null'));
  await card.getByRole('button',{name:/اكتمال/}).click();await p.waitForTimeout(1200);
  const cf=dialogs.filter(d=>d.type==='confirm').pop();
  ok('تأكيد الإكمال يسرد القطع الأربع المرتبطة (والناقصة بوسمها)',!!cf&&['صابون/شامبو','الصدرية (واقي الصدر)','مناشف ميكروفايبر (4 ألوان)','الخوذة (كانت ناقصة)'].every(n=>cf.msg.includes(n))&&cf.msg.includes(newRef));
  const rpc=calls.find(c=>c.rpc==='supply_request_complete');
  ok('supply_request_complete بالقطع الأربع للطلب نفسه',!!rpc&&rpc.body.p_request===newId&&[...rpc.body.p_assets].sort().join()==='a-chest,a-helm,a-soap,a-towel');

  // صفحة العهد على عرض 360 بلا تمرير أفقي
  await go('العُهد والإهلاك');await p.setViewportSize({width:360,height:800});await p.waitForTimeout(500);
  ok('صفحة العهد على عرض 360 بلا تمرير أفقي',!(await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)));
  ok('لا أخطاء JS ولا طلبات رفضتها المحاكاة',!errs.length&&!rejected.length);
  if(errs.length||rejected.length)console.log(errs,rejected);
  await browser.close();
}finally{server&&server.kill();}
