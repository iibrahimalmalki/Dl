import{useState,useEffect}from"react";
import{supabase,SITE_URL}from"./supabase";
import Icon from"./Icon";
import{useToast}from"./ui";
import{phoneOf,isTechEmail,roleLabel,permSummary,permText,lastSeen,FILTERS,filterUsers,counts,canHardDelete,confirmName}from"./usersLib";

const waNum=raw=>{let d=String(raw||"").replace(/[^0-9]/g,"");if(!d)return"";if(d.startsWith("00"))d=d.slice(2);if(d.startsWith("966")||d.startsWith("880"))return d;if(d.startsWith("0"))return(d.length===11?"880":"966")+d.replace(/^0+/,"");if(d.startsWith("5")&&d.length===9)return"966"+d;if(d.startsWith("1")&&d.length===10)return"880"+d;return d;};
const genPass=()=>{const a="abcdefghjkmnpqrstuvwxyz",A="ABCDEFGHJKLMNPQRSTUVWXYZ",n="23456789";const p=s=>s[Math.floor(Math.random()*s.length)];let s=p(A)+p(a)+p(a)+p(n)+p(n)+p(a)+p(n)+p(a);return s;};
const loginURL=()=>`${SITE_URL}#admin`;

// الوحدات القابلة للمنح — TMA غير مدرجة عمداً (مقصورة على المالك ولا تُمنح لأحد)
const MODULES=[
  {g:"الموارد البشرية"},
  {k:"applicants",ar:"التوظيف"},{k:"interviews",ar:"المقابلات"},{k:"onboarding",ar:"التعاقد والإعداد"},{k:"employees",ar:"الموظفون"},{k:"offboarding",ar:"إنهاء الخدمة"},
  {g:"التشغيل"},
  {k:"operations",ar:"العمليات اليومية"},{k:"performance",ar:"الأداء"},{k:"field_rounds",ar:"الجولات الميدانية"},{k:"complaints",ar:"الشكاوى والمخالفات"},
  {g:"المالية"},
  {k:"payroll",ar:"الرواتب"},{k:"settlement",ar:"تسوية سويتر"},{k:"vendors",ar:"الموردون والمصروفات"},
  {g:"الدعم اللوجستي وسلاسل الإمداد"},
  {k:"fleet",ar:"الأسطول والحوادث"},{k:"housing",ar:"السكن والإقامة"},{k:"renewals",ar:"الوثائق والتجديدات"},{k:"supply",ar:"سلاسل الإمداد"},
  {g:"الإدارة والحوكمة"},
  {k:"reports",ar:"التقارير"},
];
const MOD_KEYS=MODULES.filter(m=>m.k);
// منهجية RACI — تحدّد الوصول تلقائياً: A/R عرض+تعديل · C/I عرض فقط · بلا رمز لا وصول
const RACI=[
  {k:"A",ar:"معتمِد / مُساءَل",c:"var(--info)"},
  {k:"R",ar:"مسؤول تنفيذي",c:"var(--ok-ink)"},
  {k:"C",ar:"يُستشار",c:"var(--warn-ink)"},
  {k:"I",ar:"مُطّلع",c:"var(--info-ink)"},
];
const raciEdit=c=>c==="A"||c==="R";

const call=async(payload)=>{
  const{data,error}=await supabase.functions.invoke("admin-users",{body:payload});
  if(data&&data.error)return{error:data.error};
  if(error)return{error:error.message||"خطأ"};
  return{ok:true,data};
};

export default function UserManagement(){
  const[users,setUsers]=useState([]);const[myId,setMyId]=useState(null);
  const[sel,setSel]=useState(null);const[perms,setPerms]=useState({});
  const[loading,setLoading]=useState(true);const[saving,setSaving]=useState(false);const[msg,setMsg]=useState("");const[msgOk,setMsgOk]=useState(false);const toast=useToast();
  // رسائل النجاح → Toast؛ الأخطاء تبقى في الصفحة
  const note=(t,ok=false)=>{if(ok&&t){toast.ok(t,undefined,t.length>60?7000:undefined);setMsg("");return;}setMsg(t);setMsgOk(ok);};
  const[showAdd,setShowAdd]=useState(false);
  const[q,setQ]=useState({name:"",phone:"",emp:"",email:"",kind:"manager"});   // نموذج الإضافة السريع
  const[emps,setEmps]=useState([]);
  const[cred,setCred]=useState(null);                            // {name,email,password,phone}
  const[credLang,setCredLang]=useState("both");                  // ar | bn | both
  const[pwFor,setPwFor]=useState(null);const[pwVal,setPwVal]=useState("");
  const[mob,setMob]=useState("");   // جوال الحساب الإداري لرسائل الوثائق (app_users.mobile)
  const[act,setAct]=useState(null);       // {user_id: last_sign_in_at|null} — null حتى تُطبَّق admin_users_activity
  const[psum,setPsum]=useState({});        // ملخص الصلاحيات لكل مستخدم
  const[filt,setFilt]=useState("all");const[srch,setSrch]=useState("");
  const[menuFor,setMenuFor]=useState(null);  // قائمة «⋯» المفتوحة
  const[ask,setAsk]=useState(null);          // تأكيد الإيقاف/الحذف: {type:"off"|"del", u, typed}
  useEffect(()=>{if(!menuFor)return;const close=e=>{if(!e.target.closest(".um-more"))setMenuFor(null);};const esc=e=>{if(e.key==="Escape")setMenuFor(null);};
    document.addEventListener("click",close);document.addEventListener("keydown",esc);return()=>{document.removeEventListener("click",close);document.removeEventListener("keydown",esc);};},[menuFor]);

  const loadUsers=async()=>{setLoading(true);
    const[u,p,a]=await Promise.all([supabase.from("app_users").select("id,email,display_name,is_owner,active,biker_employee_id,mobile,position").order("created_at"),
      supabase.from("user_permissions").select("user_id,can_edit"),supabase.rpc("admin_users_activity")]);
    setUsers(u.data||[]);setPsum(permSummary(p.data||[]));
    setAct(a.error?null:Object.fromEntries((a.data||[]).map(r=>[r.user_id,r.last_sign_in_at||null])));
    setLoading(false);};
  useEffect(()=>{loadUsers();supabase.auth.getUser().then(({data})=>setMyId(data.user&&data.user.id));
    supabase.from("employees").select("id,full_name,mobile,employee_id").order("full_name").then(({data})=>setEmps(data||[]));},[]);

  const openUser=async(u)=>{setSel(u);setMob(u.mobile||"");note("");const{data}=await supabase.from("user_permissions").select("module,can_view,can_edit,raci").eq("user_id",u.id);const m={};(data||[]).forEach(r=>{m[r.module]=r.raci||(r.can_edit?"R":(r.can_view?"I":null));});setPerms(m);};
  const setRaci=(mod,code)=>setPerms(p=>({...p,[mod]:p[mod]===code?null:code}));
  const grantAll=()=>{const m={};MOD_KEYS.forEach(x=>m[x.k]="R");setPerms(m);};
  const revokeAll=()=>setPerms({});
  // الحفظ دفعة واحدة عبر set_user_permissions (لا يُحذف شيء إن فشل)؛ قبل تطبيقها على الخادم ⇒ الطريقة القديمة
  const savePerms=async()=>{if(!sel)return;setSaving(true);note("");
    const picked=MOD_KEYS.filter(x=>perms[x.k]);
    const{error:rErr}=await supabase.rpc("set_user_permissions",{p_user:sel.id,p_rows:picked.map(x=>({module:x.k,raci:perms[x.k]}))});
    if(rErr&&!(rErr.code==="PGRST202"||rErr.code==="42883")){note("خطأ: "+rErr.message);setSaving(false);return;}
    if(rErr){await supabase.from("user_permissions").delete().eq("user_id",sel.id);const rows=picked.map(x=>({user_id:sel.id,module:x.k,raci:perms[x.k],can_view:true,can_edit:raciEdit(perms[x.k])}));if(rows.length){const{error}=await supabase.from("user_permissions").insert(rows);if(error){note("خطأ: "+error.message);setSaving(false);return;}}}
    setPsum(m=>({...m,[sel.id]:{edit:picked.filter(x=>raciEdit(perms[x.k])).length,view:picked.filter(x=>!raciEdit(perms[x.k])).length}}));
    setSaving(false);note("تم حفظ مصفوفة RACI",true);};

  // حفظ الجوال بصيغة 9665xxxxxxxx (05… ← 9665…)
  const saveMobile=async()=>{if(!sel)return;const raw=mob.trim();const m=raw?waNum(raw):null;
    if(m&&!/^9665\d{8}$/.test(m)){note("رقم سعودي غير صالح — المطلوب 05xxxxxxxx أو 9665xxxxxxxx");return;}
    setSaving(true);note("");const{error}=await supabase.from("app_users").update({mobile:m}).eq("id",sel.id);setSaving(false);
    if(error){note("خطأ: "+error.message);return;}
    setMob(m||"");setSel(x=>({...x,mobile:m}));setUsers(us=>us.map(u=>u.id===sel.id?{...u,mobile:m}:u));note(m?"تم حفظ الجوال "+m:"تم حذف الجوال",true);};
  const reloadEmps=()=>supabase.from("employees").select("id,full_name,mobile,employee_id").order("full_name").then(({data})=>setEmps(data||[]));
  const pickEmp=id=>{const e=emps.find(x=>x.id===id);setQ(p=>({...p,emp:id,kind:id?"biker":p.kind,name:e?e.full_name:p.name,phone:e?(e.mobile||p.phone):p.phone}));};
  const quickCreate=async()=>{
    const name=q.name.trim();if(!name){note("اكتب اسم الموظف");return;}
    const digits=waNum(q.phone);
    const email=(q.email.trim()||((digits?digits:"dw"+Date.now().toString(36))+"@dalu.team")).toLowerCase();
    const password=genPass();
    setSaving(true);note("");setCred(null);
    try{
      let bikerId="";
      if(q.kind==="biker"){
        if(q.emp)bikerId=q.emp;
        else{const{data:ne,error:eErr}=await supabase.from("employees").insert({full_name:name,mobile:q.phone||null,staff_role:"biker"}).select("id").single();if(eErr)throw eErr;bikerId=ne.id;}
      }
      const r=await call({action:"create",email,display_name:name,password,biker_employee_id:bikerId});
      if(r.error)throw new Error(r.error);
      const{data:nu}=await supabase.from("app_users").select("id").eq("email",email).maybeSingle();
      if(q.kind==="manager"){await supabase.from("employees").insert({full_name:name,mobile:q.phone||null,user_id:nu?.id||null,staff_role:"manager"});}
      else if(nu?.id&&bikerId){await supabase.from("employees").update({user_id:nu.id}).eq("id",bikerId);}
      setCred({name,email,password,phone:q.phone});
      setQ({name:"",phone:"",emp:"",email:"",kind:"manager"});
      note("تم إنشاء الحساب وإضافته لقائمة الموظفين",true);loadUsers();reloadEmps();
    }catch(e){note("خطأ: "+(e.message||e));}
    setSaving(false);
  };
  const credMsg=(c,lang)=>{
    const ar=`مرحباً ${c.name} 👋\nتم إنشاء حسابك في نظام دلو ورغوة.\n\n🔗 رابط الدخول:\n${loginURL()}\n\n👤 اسم المستخدم:\n${c.email}\n\n🔑 كلمة المرور المؤقتة:\n${c.password}\n\nيُرجى الدخول وتغيير كلمة المرور.`;
    const bn=`স্বাগতম ${c.name} 👋\nআপনার দালু ওয়ারাগওয়া অ্যাকাউন্ট তৈরি হয়েছে।\n\n🔗 লগইন লিংক:\n${loginURL()}\n\n👤 ইউজারনেম:\n${c.email}\n\n🔑 অস্থায়ী পাসওয়ার্ড:\n${c.password}\n\nঅনুগ্রহ করে লগইন করে পাসওয়ার্ড পরিবর্তন করুন।`;
    return lang==="ar"?ar:lang==="bn"?bn:ar+"\n\n———\n\n"+bn;
  };
  const waSendCred=(c)=>{window.open(`https://wa.me/${waNum(c.phone)}?text=${encodeURIComponent(credMsg(c,credLang))}`);};
  const copyCred=async(c)=>{try{await navigator.clipboard.writeText(credMsg(c,credLang));note("تم نسخ الرسالة",true);}catch{note(`${c.email} / ${c.password}`,true);}};
  const doDelete=async(u)=>{if(!canHardDelete(u,act)){note("هذا الحساب استُخدم من قبل — أوقفه بدل حذفه ليبقى سجلّه.");return;}note("");const r=await call({action:"delete",user_id:u.id});if(r.error){note("خطأ: "+r.error);return;}if(sel&&sel.id===u.id)setSel(null);note("تم الحذف",true);loadUsers();};
  const toggleActive=async(u)=>{const r=await call({action:"update",user_id:u.id,active:!u.active});if(r.error){note("خطأ: "+r.error);return;}note(u.active?"تم إيقاف الحساب":"تم تفعيل الحساب",true);loadUsers();if(sel&&sel.id===u.id)setSel({...u,active:!u.active});};
  const savePw=async(u)=>{if(pwVal.length<6){note("كلمة المرور 6 أحرف على الأقل");return;}note("");const r=await call({action:"set_password",user_id:u.id,password:pwVal});if(r.error){note("خطأ: "+r.error);return;}setPwFor(null);setPwVal("");note("تم تغيير كلمة المرور",true);};

  return(<div className="um">
    <style>{CSS}</style>
    {msg&&<div className={"um-msg "+(msgOk?"ok":"err")}>{msg}</div>}

    {loading?<div className="g-skel" style={{height:200}}/>:
    sel?(<>
      {/* رأس صفحة الصلاحيات */}
      <div className="um-head">
        <button className="um-back" onClick={()=>{setSel(null);note("");}}><Icon n="back" s={15}/> رجوع</button>
        <div style={{flex:1,minWidth:0}}><div className="um-h-t">{sel.display_name||sel.email}</div><div className="um-h-s" dir="ltr">{sel.email}</div></div>
      </div>
      {!sel.biker_employee_id&&<div className="um-mob">
        <label><span>الجوال (لرسائل الوثائق)</span>
          <input className="g-input" dir="ltr" inputMode="tel" value={mob} onChange={e=>setMob(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveMobile()} placeholder="05xxxxxxxx"/></label>
        <button className="um-btn" onClick={saveMobile} disabled={saving||(mob||"")===(sel.mobile||"")}><Icon n="save" s={15}/> حفظ الجوال</button>
        <small>تصل إليه رسائل البايكرز عن الوثائق حسب منصبه (الموارد البشرية · الدعم اللوجستي · الخدمات المساندة).</small>
      </div>}
      <div className="um-perm-bar">
        <button className="um-btn ok" onClick={grantAll}><Icon n="check" s={15}/> منح كل شيء</button>
        <button className="um-btn danger" onClick={revokeAll}><Icon n="x" s={15}/> سحب الكل</button>
        <div style={{flex:1}}/>
        <button className="um-btn" onClick={savePerms} disabled={saving}><Icon n="save" s={15}/> {saving?"جارٍ الحفظ…":"حفظ الصلاحيات"}</button>
      </div>
      <div className="um-raci-legend">
        {RACI.map(r=><span key={r.k}><i style={{background:r.c}}>{r.k}</i> {r.ar}</span>)}
        <b>· A/R تعديل · C/I عرض فقط · بلا رمز لا وصول</b>
      </div>
      <div className="um-card">
        <table className="um-tbl">
          <thead><tr><th>الوحدة</th><th>المسؤولية (RACI)</th></tr></thead>
          <tbody>{MODULES.map(m=>m.g?(<tr key={m.g} className="um-grp"><td colSpan={2}>{m.g}</td></tr>):(<tr key={m.k}>
            <td className="um-mod">{m.ar}</td>
            <td><div className="um-raci">{RACI.map(r=>(
              <button key={r.k} className={"um-rc"+((perms[m.k]||null)===r.k?" on":"")} style={(perms[m.k]||null)===r.k?{background:r.c,borderColor:r.c,color:"#fff"}:{}} onClick={()=>setRaci(m.k,r.k)} title={r.ar}>{r.k}</button>))}
            </div></td>
          </tr>))}</tbody>
        </table>
      </div>
      <div className="um-note"><Icon n="lock" s={13}/> بيانات المواهب (TMA) غير مدرجة في الصلاحيات — مقصورة عليك وحدك حتى مع «منح كل شيء».</div>
    </>):(<>
      {/* بطاقة بيانات الدخول بعد الإنشاء */}
      {cred&&<div className="um-cred">
        <div className="um-cred-h"><Icon n="checkCircle" s={16}/> تم إنشاء حساب «{cred.name}»</div>
        <div className="um-cred-row"><span>اسم المستخدم</span><b dir="ltr">{cred.email}</b></div>
        <div className="um-cred-row"><span>كلمة المرور المؤقتة</span><b dir="ltr">{cred.password}</b></div>
        <div className="um-cred-row"><span>رابط الدخول</span><b dir="ltr">{loginURL()}</b></div>
        <div className="um-cred-lang">
          <span>لغة الرسالة:</span>
          {[["ar","عربي"],["bn","বাংলা"],["both","الاثنان"]].map(([k,l])=>(
            <button key={k} className={credLang===k?"on":""} onClick={()=>setCredLang(k)}>{l}</button>))}
        </div>
        <div className="um-cred-act">
          {cred.phone&&<button className="um-btn ok" onClick={()=>waSendCred(cred)}><Icon n="phone" s={14}/> إرسال واتساب</button>}
          <button className="um-btn ghost" onClick={()=>copyCred(cred)}><Icon n="doc" s={14}/> نسخ البيانات</button>
          <div style={{flex:1}}/>
          <button className="um-btn" onClick={()=>setCred(null)}>تم</button>
        </div>
        <div className="um-cred-note"><Icon n="lock" s={12}/> البيانات تظهر مرة واحدة — أرسلها الآن. الصلاحيات تُمنح لاحقاً عبر «الهيكل التنظيمي ← التعيينات».</div>
      </div>}

      {/* إضافة سريعة */}
      {!showAdd?<button className="um-add" onClick={()=>{setShowAdd(true);note("");setCred(null);}}><Icon n="plus" s={17}/> إضافة موظف وإنشاء حساب دخول</button>:
      <div className="um-card um-form">
        <div className="um-form-t">إضافة موظف — أكتب اسمه ورقمه، والنظام ينشئ اسم مستخدم وكلمة مرور مؤقتة</div>
        <div className="um-kind">
          <button className={q.kind!=="biker"?"on":""} onClick={()=>setQ({...q,kind:"manager",emp:""})}><Icon n="users" s={13}/> إداري — لوحة الإدارة</button>
          <button className={q.kind==="biker"?"on":""} onClick={()=>setQ({...q,kind:"biker"})}><Icon n="bike" s={13}/> بايكر — بوابة البايكر</button>
        </div>
        {q.kind==="biker"&&emps.length>0&&<select className="um-in" style={{marginBottom:9}} value={q.emp} onChange={e=>pickEmp(e.target.value)}>
          <option value="">— ربط بموظف مسجّل (اختياري) —</option>
          {emps.map(e=><option key={e.id} value={e.id}>{e.full_name}{e.employee_id?` · #${e.employee_id}`:""}</option>)}
        </select>}
        <div className="um-grid2">
          <input className="um-in" placeholder="اسم الموظف" value={q.name} onChange={e=>setQ({...q,name:e.target.value})}/>
          <input className="um-in ltr" placeholder="رقم الواتساب (لإرسال البيانات)" value={q.phone} onChange={e=>setQ({...q,phone:e.target.value})}/>
        </div>
        <input className="um-in ltr" style={{marginTop:9}} placeholder="بريد مخصّص (اختياري — يُولّد تلقائياً)" value={q.email} onChange={e=>setQ({...q,email:e.target.value})}/>
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button className="um-btn ok" style={{flex:2}} onClick={quickCreate} disabled={saving}>{saving?"…":"إنشاء الحساب وإظهار البيانات"}</button>
          <button className="um-btn ghost" style={{flex:1}} onClick={()=>{setShowAdd(false);setQ({name:"",phone:"",emp:"",email:"",kind:"manager"});}}>إلغاء</button>
        </div>
      </div>}

      {/* فلاتر وبحث */}
      {(()=>{const c=counts(users,act);return <div className="um-filt">
        <div className="um-chips" role="tablist" aria-label="تصفية المستخدمين">{FILTERS.filter(x=>x.k!=="never"||act).map(x=>
          <button key={x.k} role="tab" aria-selected={filt===x.k} className={filt===x.k?"on":""} onClick={()=>setFilt(x.k)}>{x.ar} <b>{c[x.k]}</b></button>)}</div>
        <input className="um-in" value={srch} onChange={e=>setSrch(e.target.value)} placeholder="بحث بالاسم أو الجوال أو رقم البايكر"/>
      </div>;})()}
      {!act&&<div className="um-hint"><Icon n="lock" s={12}/> «آخر دخول» يظهر بعد تطبيق docs/sql/users_admin.sql.</div>}

      <div className="um-list">{(()=>{const list=filterUsers(users,filt,srch,act);return list.length?list.map(u=>{
        const ls=lastSeen(act?act[u.id]:undefined),ph=phoneOf(u),sm=psum[u.id];
        return(<div className="um-u" key={u.id}>
        <div className="um-u-top">
          <div className="um-av">{(u.display_name||u.email||"?").trim().charAt(0).toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}>
            <div className="um-u-name">{u.display_name||u.email}
              {u.is_owner&&<span className="um-tag owner">مالك</span>}
              {!u.is_owner&&!u.active&&<span className="um-tag off">موقوف</span>}
            </div>
            <div className="um-u-role">{roleLabel(u)}</div>
            <div className="um-u-meta">
              {ph&&<span dir="ltr">{ph}</span>}
              {!isTechEmail(u.email)&&<span dir="ltr">{u.email}</span>}
              {ls&&<span className={"um-ls "+ls.tone}>{ls.t}</span>}
              {!u.is_owner&&!u.biker_employee_id&&<span>{permText(sm)}</span>}
            </div>
          </div>
          <div className="um-more">
            <button className="um-dots" aria-label={"إجراءات "+(u.display_name||"")} aria-expanded={menuFor===u.id} onClick={()=>setMenuFor(menuFor===u.id?null:u.id)}>⋯</button>
            {menuFor===u.id&&<div className="um-menu" role="menu">
              <button role="menuitem" onClick={()=>{setMenuFor(null);setPwFor(u.id);setPwVal("");}}><Icon n="key" s={14}/> تعيين كلمة مرور</button>
              {!u.is_owner&&<button role="menuitem" onClick={()=>{setMenuFor(null);u.active?setAsk({type:"off",u}):toggleActive(u);}}><Icon n={u.active?"x":"check"} s={14}/> {u.active?"إيقاف الحساب":"تفعيل الحساب"}</button>}
              {!u.is_owner&&<button role="menuitem" className="danger" onClick={()=>{setMenuFor(null);setAsk({type:"del",u,typed:""});}}><Icon n="trash" s={14}/> حذف نهائي</button>}
            </div>}
          </div>
        </div>
        {!u.is_owner&&<div className="um-u-actions"><button className="um-sb brand" onClick={()=>openUser(u)}><Icon n="users" s={13}/> الصلاحيات</button></div>}
        {pwFor===u.id&&<div className="um-pw">
          <input className="um-in ltr" type="text" autoComplete="off" placeholder="كلمة مرور جديدة (6+)" value={pwVal} onChange={e=>setPwVal(e.target.value)}/>
          <button className="um-btn ok" onClick={()=>savePw(u)}><Icon n="save" s={14}/> حفظ</button>
          <button className="um-btn ghost" onClick={()=>{setPwFor(null);setPwVal("");}}>إلغاء</button>
        </div>}
        {ask&&ask.u.id===u.id&&(ask.type==="off"?<div className="um-ask">
          <b>إيقاف حساب {u.display_name||u.email}؟</b>
          <span>لن يستطيع الدخول، وتبقى بياناته وسجلّه. يمكن التفعيل لاحقاً.</span>
          <div className="um-ask-act"><button className="um-btn ghost" onClick={()=>setAsk(null)}>إلغاء</button><button className="um-btn danger" onClick={()=>{setAsk(null);toggleActive(u);}}>إيقاف</button></div>
        </div>:canHardDelete(u,act)?<div className="um-ask">
          <b>حذف نهائي — لا يمكن التراجع</b>
          <span>للتأكيد اكتب الاسم كما هو: <b>{u.display_name||u.email}</b></span>
          <input className="um-in" value={ask.typed} onChange={e=>setAsk({...ask,typed:e.target.value})} aria-label="اكتب الاسم للتأكيد"/>
          <div className="um-ask-act"><button className="um-btn ghost" onClick={()=>setAsk(null)}>إلغاء</button><button className="um-btn danger" disabled={!confirmName(u,ask.typed)} onClick={()=>{setAsk(null);doDelete(u);}}>حذف نهائي</button></div>
        </div>:<div className="um-ask">
          <b>لا يُحذف حساب استُخدم من قبل</b>
          <span>دخل هذا الحساب إلى النظام، وحذفه يُضيّع سجلّه. أوقفه بدلاً من ذلك.</span>
          <div className="um-ask-act"><button className="um-btn ghost" onClick={()=>setAsk(null)}>إلغاء</button>{u.active&&<button className="um-btn danger" onClick={()=>setAsk({type:"off",u})}>إيقاف الحساب</button>}</div>
        </div>)}
      </div>);}):<div className="um-empty">لا مستخدمين مطابقين</div>;})()}</div>
    </>)}
  </div>);
}

const CSS=`
.um-mob{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;background:var(--glass);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:12px}
.um-mob label{display:flex;flex-direction:column;gap:5px;flex:1;min-width:200px}.um-mob label span{font-size:11.5px;font-weight:700;color:var(--mut)}
.um-mob input{text-align:left}.um-mob small{flex-basis:100%;font-size:11px;color:var(--mut)}
.um{--b:var(--p)}
.um-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:12px}
.um-msg.ok{background:var(--ok-bg);color:var(--ok-ink)}.um-msg.err{background:var(--bad-bg);color:var(--bad-ink)}
.um-head{display:flex;align-items:center;gap:12px;padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid var(--line)}
.um-back{display:inline-flex;align-items:center;gap:5px;background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:10px;padding:7px 12px;font-family:inherit;font-size:12.5px;font-weight:700;color:var(--ink-2);cursor:pointer;flex:none}
.um-h-t{font-size:16px;font-weight:800;color:var(--ink)}.um-h-s{font-size:12px;color:var(--mut)}
.um-perm-bar{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.um-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 14px;border-radius:11px;border:none;background:var(--ink);color:var(--bg);font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.um-btn.ok{background:linear-gradient(135deg,var(--ok),color-mix(in srgb,var(--ok) 72%,black))}
.um-btn.danger{background:var(--glass-2);border:1px solid color-mix(in srgb,var(--bad) 35%,transparent);color:var(--bad-ink)}
.um-btn.ghost{background:var(--glass-2);border:1px solid var(--line-2);color:var(--ink-2)}
.um-btn:disabled{opacity:.55}
.um-card{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);overflow:hidden}
.um-tbl{width:100%;border-collapse:collapse}
.um-tbl th{font-size:11px;color:var(--mut-2);font-weight:700;padding:11px 14px;background:var(--soft);border-bottom:1px solid var(--line);text-align:center}
.um-tbl th:first-child{text-align:right}
.um-tbl td{padding:11px 14px;border-bottom:1px solid var(--line);text-align:center}
.um-tbl tr:last-child td{border-bottom:none}
.um-mod{text-align:right!important;font-weight:700;font-size:13px;color:var(--ink)}
.um-grp td{background:var(--ink);color:var(--bg);font-weight:800;font-size:12px;padding:8px 14px!important;text-align:right}
.um-raci{display:inline-flex;gap:6px}
.um-rc{width:34px;height:34px;border-radius:9px;border:1.5px solid var(--line);background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);font-family:inherit;font-size:13px;font-weight:800;color:var(--mut-2);cursor:pointer;transition:.12s}
.um-rc:hover{border-color:var(--line)}
.um-rc.on{box-shadow:var(--shadow)}
.um-raci-legend{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:12px;padding:10px 13px;margin-bottom:12px;font-size:12px;font-weight:700;color:var(--ink-2)}
.um-raci-legend span{display:inline-flex;align-items:center;gap:6px}
.um-raci-legend i{width:20px;height:20px;border-radius:6px;color:#fff;font-style:normal;font-weight:800;font-size:11px;display:inline-flex;align-items:center;justify-content:center}
.um-raci-legend b{color:var(--mut);font-weight:600;font-size:11px}
.um-ck{width:19px;height:19px;cursor:pointer}
.um-ck.v{accent-color:var(--info-ink)}.um-ck.e{accent-color:var(--ok-ink)}
.um-note{display:flex;align-items:center;gap:7px;background:var(--warn-bg);border:1px solid color-mix(in srgb,var(--warn) 35%,transparent);color:var(--warn-ink);font-size:11.5px;font-weight:600;border-radius:11px;padding:10px 12px;margin-top:12px}
.um-add{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:13px;border:1.5px dashed color-mix(in srgb,var(--ok) 35%,transparent);background:var(--ok-bg);color:var(--ok-ink);border-radius:14px;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;margin-bottom:14px}
.um-add:hover{background:var(--ok-bg)}
.um-form{padding:16px;margin-bottom:14px}
.um-form-t{font-weight:800;font-size:13px;margin-bottom:12px;color:var(--ink)}
.um-kind{display:flex;gap:8px;margin-bottom:10px}
.um-kind button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px;border:1.5px solid var(--line-2);background:var(--glass-2);border-radius:10px;font-family:inherit;font-size:12px;font-weight:700;color:var(--mut);cursor:pointer}
.um-kind button.on{border-color:var(--p);background:var(--p-50);color:var(--warn-ink)}
.um-grid2{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.um-in{width:100%;padding:10px 12px;border:1px solid var(--line-2);border-radius:10px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;background:var(--glass-3);color:var(--ink)}
.um-in:focus{border-color:var(--b);box-shadow:0 0 0 3px rgba(232,113,43,.1)}
.um-in.ltr{direction:ltr;text-align:left}
.um-list{display:flex;flex-direction:column;gap:10px}
.um-u{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:16px;padding:13px 15px;box-shadow:var(--shadow)}
.um-u-top{display:flex;align-items:center;gap:11px}
.um-av{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,var(--p),var(--a));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex:none}
.um-u-name{font-size:14px;font-weight:800;color:var(--ink);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.um-u-mail{font-size:11.5px;color:var(--mut-2);margin-top:1px}
.um-tag{font-size:10px;font-weight:800;padding:1px 8px;border-radius:20px;background:var(--soft);color:var(--mut)}
.um-tag.owner{background:var(--ok-bg);color:var(--ok-ink)}
.um-tag.on{background:var(--ok-bg);color:var(--ok-ink)}.um-tag.off{background:var(--bad-bg);color:var(--bad-ink)}
.um-u-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:11px;padding-top:11px;border-top:1px solid var(--line)}
.um-sb{display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:9px;border:1px solid var(--line);background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);font-family:inherit;font-size:11.5px;font-weight:700;color:var(--ink-2);cursor:pointer}
.um-sb:hover{background:var(--hover)}
.um-sb.brand{border-color:rgba(var(--p-rgb),.35);color:var(--warn-ink);background:var(--p-50)}
.um-sb.danger{border-color:color-mix(in srgb,var(--bad) 35%,transparent);color:var(--bad-ink);background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur)}
.um-pw{display:flex;gap:8px;margin-top:10px}
.um-pw .um-in{flex:1}
.um-cred{background:var(--ok-bg);border:1px solid color-mix(in srgb,var(--ok) 35%,transparent);border-radius:16px;padding:15px;margin-bottom:14px}
.um-cred-h{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;color:var(--ok-ink);margin-bottom:12px}
.um-cred-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid color-mix(in srgb,var(--ok) 35%,transparent)}
.um-cred-row span{font-size:11.5px;color:var(--mut);font-weight:600;flex:none}
.um-cred-row b{font-size:13px;font-weight:800;color:var(--ink);word-break:break-all;text-align:left}
.um-cred-lang{display:flex;align-items:center;gap:6px;margin-top:11px;flex-wrap:wrap}
.um-cred-lang span{font-size:11px;color:var(--mut);font-weight:700;margin-inline-end:2px}
.um-cred-lang button{border:1px solid color-mix(in srgb,var(--ok) 35%,transparent);background:var(--glass-2);color:var(--mut);border-radius:8px;padding:5px 12px;font-family:inherit;font-size:11.5px;font-weight:700;cursor:pointer}
.um-cred-lang button.on{background:var(--ok);border-color:var(--ok-ink);color:#fff}
.um-cred-act{display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap}
.um-cred-note{display:flex;align-items:flex-start;gap:6px;font-size:11px;color:var(--warn-ink);background:var(--warn-bg);border:1px solid color-mix(in srgb,var(--warn) 35%,transparent);border-radius:9px;padding:8px 10px;margin-top:11px;line-height:1.6}
.um-filt{display:flex;flex-direction:column;gap:9px;margin:14px 0 10px}
.um-chips{display:flex;gap:6px;flex-wrap:wrap}
.um-chips button{border:1px solid var(--line-2);background:var(--glass-2);color:var(--ink-2);border-radius:20px;padding:6px 12px;min-height:36px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer}
.um-chips button b{font-weight:800;color:var(--mut);margin-inline-start:3px}
.um-chips button.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}.um-chips button.on b{color:inherit}
.um-hint{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--mut);margin-bottom:10px}
.um-empty{text-align:center;padding:24px 10px;color:var(--mut);font-size:13px;font-weight:700}
.um-u-role{font-size:12px;font-weight:700;color:var(--ink-2);margin-top:2px}
.um-u-meta{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:4px;font-size:11.5px;color:var(--mut-2)}
.um-ls{font-weight:700}.um-ls.ok{color:var(--ok-ink)}.um-ls.warn{color:var(--warn-ink)}
.um-more{position:relative;flex:none;align-self:flex-start}
.um-dots{width:40px;height:40px;border-radius:11px;border:1px solid var(--line);background:var(--glass-2);color:var(--ink-2);font-size:20px;font-weight:900;line-height:1;cursor:pointer}
.um-menu{position:absolute;top:44px;inset-inline-end:0;z-index:5;min-width:180px;background:var(--bg);border:1px solid var(--line-2);border-radius:12px;box-shadow:var(--shadow);padding:5px;display:flex;flex-direction:column}
.um-menu button{display:flex;align-items:center;gap:8px;border:none;background:none;text-align:start;padding:10px 11px;min-height:40px;border-radius:9px;font-family:inherit;font-size:12.5px;font-weight:700;color:var(--ink-2);cursor:pointer}
.um-menu button:hover{background:var(--hover)}.um-menu button.danger{color:var(--bad-ink)}
.um-ask{display:flex;flex-direction:column;gap:8px;margin-top:11px;padding:11px 12px;border-radius:12px;background:var(--bad-bg);font-size:12.5px;color:var(--ink-2);line-height:1.7}
.um-ask>b{color:var(--bad-ink);font-size:13px}
.um-ask-act{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.um-btn.danger:disabled{opacity:.5}
@media(max-width:640px){.um-grid2{grid-template-columns:1fr}}
`;
