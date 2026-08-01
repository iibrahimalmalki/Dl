import{useState,useEffect}from"react";
import{supabase,SITE_URL}from"./supabase";
import Icon from"./Icon";

const waNum=raw=>{let d=String(raw||"").replace(/[^0-9]/g,"");if(!d)return"";if(d.startsWith("00"))d=d.slice(2);if(d.startsWith("966")||d.startsWith("880"))return d;if(d.startsWith("0"))return(d.length===11?"880":"966")+d.replace(/^0+/,"");if(d.startsWith("5")&&d.length===9)return"966"+d;if(d.startsWith("1")&&d.length===10)return"880"+d;return d;};
const genPass=()=>{const a="abcdefghjkmnpqrstuvwxyz",A="ABCDEFGHJKLMNPQRSTUVWXYZ",n="23456789";const p=s=>s[Math.floor(Math.random()*s.length)];let s=p(A)+p(a)+p(a)+p(n)+p(n)+p(a)+p(n)+p(a);return s;};
const loginURL=()=>`${SITE_URL}#admin`;

// الوحدات القابلة للمنح — TMA غير مدرجة عمداً (مقصورة على المالك ولا تُمنح لأحد)
const MODULES=[
  {k:"applicants",ar:"التوظيف"},{k:"interviews",ar:"المقابلات"},{k:"onboarding",ar:"التعاقد والإعداد"},
  {k:"operations",ar:"العمليات اليومية"},{k:"performance",ar:"الأداء"},{k:"payroll",ar:"الرواتب"},
  {k:"complaints",ar:"الشكاوى والتصعيد"},{k:"field_rounds",ar:"الجولات الميدانية"},{k:"vendors",ar:"الموردون"},
  {k:"referrals",ar:"الإحالات"},{k:"reports",ar:"التقارير"},{k:"employees",ar:"الموظفون"},
];
const call=async(payload)=>{
  const{data,error}=await supabase.functions.invoke("admin-users",{body:payload});
  if(data&&data.error)return{error:data.error};
  if(error)return{error:error.message||"خطأ"};
  return{ok:true,data};
};

export default function UserManagement(){
  const[users,setUsers]=useState([]);const[myId,setMyId]=useState(null);
  const[sel,setSel]=useState(null);const[perms,setPerms]=useState({});
  const[loading,setLoading]=useState(true);const[saving,setSaving]=useState(false);const[msg,setMsg]=useState("");const[msgOk,setMsgOk]=useState(false);
  const note=(t,ok=false)=>{setMsg(t);setMsgOk(ok);};
  const[showAdd,setShowAdd]=useState(false);
  const[q,setQ]=useState({name:"",phone:"",emp:"",email:""});   // نموذج الإضافة السريع
  const[emps,setEmps]=useState([]);
  const[cred,setCred]=useState(null);                            // {name,email,password,phone}
  const[pwFor,setPwFor]=useState(null);const[pwVal,setPwVal]=useState("");

  const loadUsers=async()=>{setLoading(true);const{data}=await supabase.from("app_users").select("id,email,display_name,is_owner,active,biker_employee_id").order("created_at");setUsers(data||[]);setLoading(false);};
  useEffect(()=>{loadUsers();supabase.auth.getUser().then(({data})=>setMyId(data.user&&data.user.id));
    supabase.from("employees").select("id,full_name,mobile,employee_id").order("full_name").then(({data})=>setEmps(data||[]));},[]);

  const openUser=async(u)=>{setSel(u);note("");const{data}=await supabase.from("user_permissions").select("module,can_view,can_edit").eq("user_id",u.id);const m={};(data||[]).forEach(r=>{m[r.module]={view:r.can_view,edit:r.can_edit};});setPerms(m);};
  const setP=(mod,key,val)=>setPerms(p=>{const c={...(p[mod]||{view:false,edit:false})};c[key]=val;if(key==="edit"&&val)c.view=true;if(key==="view"&&!val)c.edit=false;return{...p,[mod]:c};});
  const grantAll=()=>{const m={};MODULES.forEach(x=>m[x.k]={view:true,edit:true});setPerms(m);};
  const revokeAll=()=>setPerms({});
  const savePerms=async()=>{if(!sel)return;setSaving(true);note("");await supabase.from("user_permissions").delete().eq("user_id",sel.id);const rows=MODULES.filter(x=>perms[x.k]&&(perms[x.k].view||perms[x.k].edit)).map(x=>({user_id:sel.id,module:x.k,can_view:!!perms[x.k].view,can_edit:!!perms[x.k].edit}));if(rows.length){const{error}=await supabase.from("user_permissions").insert(rows);if(error){note("خطأ: "+error.message);setSaving(false);return;}}setSaving(false);note("تم حفظ الصلاحيات",true);};

  const pickEmp=id=>{const e=emps.find(x=>x.id===id);setQ(p=>({...p,emp:id,name:e?e.full_name:p.name,phone:e?(e.mobile||p.phone):p.phone}));};
  const quickCreate=async()=>{
    const name=q.name.trim();if(!name){note("اكتب اسم الموظف");return;}
    const digits=waNum(q.phone);
    const email=(q.email.trim()||(digits?digits:"dw"+Date.now().toString(36))+"@dalu.team").toLowerCase();
    const password=genPass();
    setSaving(true);note("");setCred(null);
    const r=await call({action:"create",email,display_name:name,password,biker_employee_id:q.emp||""});
    setSaving(false);
    if(r.error){note("خطأ: "+r.error);return;}
    setCred({name,email,password,phone:q.phone});
    setQ({name:"",phone:"",emp:"",email:""});
    note("تم إنشاء الحساب — أرسل البيانات للموظف",true);loadUsers();
  };
  const waSendCred=(c)=>{
    const msg=`مرحباً ${c.name} 👋\nتم إنشاء حسابك في نظام دلو ورغوة.\n\n🔗 رابط الدخول:\n${loginURL()}\n\n👤 اسم المستخدم:\n${c.email}\n\n🔑 كلمة المرور المؤقتة:\n${c.password}\n\nيُرجى الدخول وتغيير كلمة المرور.\n\n———\nআপনার দালু ওয়ারাগওয়া অ্যাকাউন্ট তৈরি হয়েছে।\nলগইন: ${loginURL()}\nইউজারনেম: ${c.email}\nঅস্থায়ী পাসওয়ার্ড: ${c.password}`;
    window.open(`https://wa.me/${waNum(c.phone)}?text=${encodeURIComponent(msg)}`);
  };
  const copyCred=async(c)=>{try{await navigator.clipboard.writeText(`${c.name}\n${loginURL()}\n${c.email}\n${c.password}`);note("تم نسخ البيانات",true);}catch{note(`${c.email} / ${c.password}`,true);}};
  const doDelete=async(u)=>{if(!confirm(`حذف ${u.display_name||u.email} نهائياً؟`))return;note("");const r=await call({action:"delete",user_id:u.id});if(r.error){note("خطأ: "+r.error);return;}if(sel&&sel.id===u.id)setSel(null);note("تم الحذف",true);loadUsers();};
  const toggleActive=async(u)=>{const r=await call({action:"update",user_id:u.id,active:!u.active});if(r.error){note("خطأ: "+r.error);return;}loadUsers();if(sel&&sel.id===u.id)setSel({...u,active:!u.active});};
  const savePw=async(u)=>{if(pwVal.length<6){note("كلمة المرور 6 أحرف على الأقل");return;}note("");const r=await call({action:"set_password",user_id:u.id,password:pwVal});if(r.error){note("خطأ: "+r.error);return;}setPwFor(null);setPwVal("");note("تم تغيير كلمة المرور",true);};

  return(<div className="um">
    <style>{CSS}</style>
    {msg&&<div className={"um-msg "+(msgOk?"ok":"err")}>{msg}</div>}

    {loading?<div className="dw-skel" style={{height:200}}/>:
    sel?(<>
      {/* رأس صفحة الصلاحيات */}
      <div className="um-head">
        <button className="um-back" onClick={()=>{setSel(null);note("");}}><Icon n="back" s={15}/> رجوع</button>
        <div style={{flex:1,minWidth:0}}><div className="um-h-t">{sel.display_name||sel.email}</div><div className="um-h-s" dir="ltr">{sel.email}</div></div>
      </div>
      <div className="um-perm-bar">
        <button className="um-btn ok" onClick={grantAll}><Icon n="check" s={15}/> منح كل شيء</button>
        <button className="um-btn danger" onClick={revokeAll}><Icon n="x" s={15}/> سحب الكل</button>
        <div style={{flex:1}}/>
        <button className="um-btn" onClick={savePerms} disabled={saving}><Icon n="save" s={15}/> {saving?"جارٍ الحفظ…":"حفظ الصلاحيات"}</button>
      </div>
      <div className="um-card">
        <table className="um-tbl">
          <thead><tr><th>الوحدة</th><th>عرض</th><th>تعديل</th></tr></thead>
          <tbody>{MODULES.map(m=>{const p=perms[m.k]||{view:false,edit:false};return(<tr key={m.k}>
            <td className="um-mod">{m.ar}</td>
            <td><input type="checkbox" className="um-ck v" checked={!!p.view} onChange={e=>setP(m.k,"view",e.target.checked)}/></td>
            <td><input type="checkbox" className="um-ck e" checked={!!p.edit} onChange={e=>setP(m.k,"edit",e.target.checked)}/></td>
          </tr>);})}</tbody>
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
        {emps.length>0&&<select className="um-in" style={{marginBottom:9}} value={q.emp} onChange={e=>pickEmp(e.target.value)}>
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
          <button className="um-btn ghost" style={{flex:1}} onClick={()=>{setShowAdd(false);setQ({name:"",phone:"",emp:"",email:""});}}>إلغاء</button>
        </div>
      </div>}

      <div className="um-list">{users.map(u=>(<div className="um-u" key={u.id}>
        <div className="um-u-top">
          <div className="um-av">{(u.display_name||u.email||"?").trim().charAt(0).toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}>
            <div className="um-u-name">{u.display_name||u.email}
              {u.is_owner&&<span className="um-tag owner">مالك</span>}
              {u.biker_employee_id&&<span className="um-tag">بايكر {u.biker_employee_id}</span>}
              {!u.is_owner&&<span className={"um-tag "+(u.active?"on":"off")}>{u.active?"مُفعّل":"موقوف"}</span>}
            </div>
            <div className="um-u-mail" dir="ltr">{u.email}</div>
          </div>
        </div>
        <div className="um-u-actions">
          <button className="um-sb" onClick={()=>{setPwFor(pwFor===u.id?null:u.id);setPwVal("");}}><Icon n="key" s={13}/> كلمة المرور</button>
          {!u.is_owner&&<button className="um-sb" onClick={()=>toggleActive(u)}><Icon n={u.active?"x":"check"} s={13}/> {u.active?"إيقاف":"تفعيل"}</button>}
          {!u.is_owner&&<button className="um-sb brand" onClick={()=>openUser(u)}><Icon n="users" s={13}/> الصلاحيات</button>}
          {!u.is_owner&&<button className="um-sb danger" onClick={()=>doDelete(u)}><Icon n="trash" s={13}/> حذف</button>}
        </div>
        {pwFor===u.id&&<div className="um-pw">
          <input className="um-in ltr" type="text" placeholder="كلمة مرور جديدة (6+)" value={pwVal} onChange={e=>setPwVal(e.target.value)}/>
          <button className="um-btn ok" onClick={()=>savePw(u)}><Icon n="save" s={14}/> حفظ</button>
        </div>}
      </div>))}</div>
    </>)}
  </div>);
}

const CSS=`
.um{--b:#E8712B}
.um-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:12px}
.um-msg.ok{background:#e7f7ef;color:#087443}.um-msg.err{background:#feecea;color:#b42318}
.um-head{display:flex;align-items:center;gap:12px;padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid #eceef1}
.um-back{display:inline-flex;align-items:center;gap:5px;background:#fff;border:1px solid #e6e9ee;border-radius:10px;padding:7px 12px;font-family:inherit;font-size:12.5px;font-weight:700;color:#334155;cursor:pointer;flex:none}
.um-h-t{font-size:16px;font-weight:800;color:#0f172a}.um-h-s{font-size:12px;color:#64748b}
.um-perm-bar{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.um-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 14px;border-radius:11px;border:none;background:#0f172a;color:#fff;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.um-btn.ok{background:linear-gradient(135deg,#12b76a,#087443)}
.um-btn.danger{background:#fff;border:1px solid #f7bfba;color:#b42318}
.um-btn.ghost{background:#fff;border:1px solid #e6e9ee;color:#334155}
.um-btn:disabled{opacity:.55}
.um-card{background:#fff;border:1px solid #eceef1;border-radius:16px;box-shadow:0 1px 2px rgba(16,24,40,.05);overflow:hidden}
.um-tbl{width:100%;border-collapse:collapse}
.um-tbl th{font-size:11px;color:#94a3b8;font-weight:700;padding:11px 14px;background:#fafbfc;border-bottom:1px solid #eceef1;text-align:center}
.um-tbl th:first-child{text-align:right}
.um-tbl td{padding:11px 14px;border-bottom:1px solid #f1f3f5;text-align:center}
.um-tbl tr:last-child td{border-bottom:none}
.um-mod{text-align:right!important;font-weight:700;font-size:13px;color:#0f172a}
.um-ck{width:19px;height:19px;cursor:pointer}
.um-ck.v{accent-color:#175cd3}.um-ck.e{accent-color:#087443}
.um-note{display:flex;align-items:center;gap:7px;background:#fffbeb;border:1px solid #fde9c8;color:#92600e;font-size:11.5px;font-weight:600;border-radius:11px;padding:10px 12px;margin-top:12px}
.um-add{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:13px;border:1.5px dashed #b7e4cd;background:#f6fdf9;color:#087443;border-radius:14px;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;margin-bottom:14px}
.um-add:hover{background:#eefaf3}
.um-form{padding:16px;margin-bottom:14px}
.um-form-t{font-weight:800;font-size:13px;margin-bottom:12px;color:#0f172a}
.um-grid2{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.um-in{width:100%;padding:10px 12px;border:1px solid #e6e9ee;border-radius:10px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;background:#fff;color:#0f172a}
.um-in:focus{border-color:var(--b);box-shadow:0 0 0 3px rgba(232,113,43,.1)}
.um-in.ltr{direction:ltr;text-align:left}
.um-list{display:flex;flex-direction:column;gap:10px}
.um-u{background:#fff;border:1px solid #eceef1;border-radius:16px;padding:13px 15px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.um-u-top{display:flex;align-items:center;gap:11px}
.um-av{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#E8712B,#f5a35f);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex:none}
.um-u-name{font-size:14px;font-weight:800;color:#0f172a;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.um-u-mail{font-size:11.5px;color:#94a3b8;margin-top:1px}
.um-tag{font-size:10px;font-weight:800;padding:1px 8px;border-radius:20px;background:#f1f5f9;color:#64748b}
.um-tag.owner{background:#e7f7ef;color:#087443}
.um-tag.on{background:#e7f7ef;color:#087443}.um-tag.off{background:#feecea;color:#b42318}
.um-u-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:11px;padding-top:11px;border-top:1px solid #f1f3f5}
.um-sb{display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:9px;border:1px solid #e6e9ee;background:#fff;font-family:inherit;font-size:11.5px;font-weight:700;color:#475569;cursor:pointer}
.um-sb:hover{background:#f8fafc}
.um-sb.brand{border-color:#ffd9bd;color:#b54708;background:#fff7f0}
.um-sb.danger{border-color:#f7bfba;color:#b42318;background:#fff}
.um-pw{display:flex;gap:8px;margin-top:10px}
.um-pw .um-in{flex:1}
.um-cred{background:#f6fdf9;border:1px solid #b7e4cd;border-radius:16px;padding:15px;margin-bottom:14px}
.um-cred-h{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;color:#087443;margin-bottom:12px}
.um-cred-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #d9f0e3}
.um-cred-row span{font-size:11.5px;color:#64748b;font-weight:600;flex:none}
.um-cred-row b{font-size:13px;font-weight:800;color:#0f172a;word-break:break-all;text-align:left}
.um-cred-act{display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap}
.um-cred-note{display:flex;align-items:flex-start;gap:6px;font-size:11px;color:#92600e;background:#fffbeb;border:1px solid #fde9c8;border-radius:9px;padding:8px 10px;margin-top:11px;line-height:1.6}
@media(max-width:640px){.um-grid2{grid-template-columns:1fr}}
`;
