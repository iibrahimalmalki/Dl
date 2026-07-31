import{useState,useEffect}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";

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

export default function UserManagement({onClose}){
  const[users,setUsers]=useState([]);const[myId,setMyId]=useState(null);
  const[sel,setSel]=useState(null);const[perms,setPerms]=useState({});
  const[loading,setLoading]=useState(true);const[saving,setSaving]=useState(false);const[msg,setMsg]=useState("");const[msgOk,setMsgOk]=useState(false);
  const note=(t,ok=false)=>{setMsg(t);setMsgOk(ok);};
  const[showAdd,setShowAdd]=useState(false);const[add,setAdd]=useState({email:"",display_name:"",password:"",biker_employee_id:""});
  const[pwFor,setPwFor]=useState(null);const[pwVal,setPwVal]=useState("");

  const loadUsers=async()=>{setLoading(true);const{data}=await supabase.from("app_users").select("id,email,display_name,is_owner,active,biker_employee_id").order("created_at");setUsers(data||[]);setLoading(false);};
  useEffect(()=>{loadUsers();supabase.auth.getUser().then(({data})=>setMyId(data.user&&data.user.id));},[]);

  const openUser=async(u)=>{setSel(u);note("");const{data}=await supabase.from("user_permissions").select("module,can_view,can_edit").eq("user_id",u.id);const m={};(data||[]).forEach(r=>{m[r.module]={view:r.can_view,edit:r.can_edit};});setPerms(m);};
  const setP=(mod,key,val)=>setPerms(p=>{const c={...(p[mod]||{view:false,edit:false})};c[key]=val;if(key==="edit"&&val)c.view=true;if(key==="view"&&!val)c.edit=false;return{...p,[mod]:c};});
  const grantAll=()=>{const m={};MODULES.forEach(x=>m[x.k]={view:true,edit:true});setPerms(m);};
  const revokeAll=()=>setPerms({});
  const savePerms=async()=>{if(!sel)return;setSaving(true);note("");await supabase.from("user_permissions").delete().eq("user_id",sel.id);const rows=MODULES.filter(x=>perms[x.k]&&(perms[x.k].view||perms[x.k].edit)).map(x=>({user_id:sel.id,module:x.k,can_view:!!perms[x.k].view,can_edit:!!perms[x.k].edit}));if(rows.length){const{error}=await supabase.from("user_permissions").insert(rows);if(error){note("خطأ: "+error.message);setSaving(false);return;}}setSaving(false);note("تم حفظ الصلاحيات",true);};

  const createUser=async()=>{
    if(!add.email.trim()||add.password.length<6){note("أدخل بريداً وكلمة مرور 6 أحرف على الأقل");return;}
    setSaving(true);note("");const r=await call({action:"create",...add});setSaving(false);
    if(r.error){note("خطأ: "+r.error);return;}
    setShowAdd(false);setAdd({email:"",display_name:"",password:"",biker_employee_id:""});note("تم إنشاء المستخدم",true);loadUsers();
  };
  const doDelete=async(u)=>{if(!confirm(`حذف ${u.display_name||u.email} نهائياً؟`))return;note("");const r=await call({action:"delete",user_id:u.id});if(r.error){note("خطأ: "+r.error);return;}if(sel&&sel.id===u.id)setSel(null);note("تم الحذف",true);loadUsers();};
  const toggleActive=async(u)=>{const r=await call({action:"update",user_id:u.id,active:!u.active});if(r.error){note("خطأ: "+r.error);return;}loadUsers();if(sel&&sel.id===u.id)setSel({...u,active:!u.active});};
  const savePw=async(u)=>{if(pwVal.length<6){note("كلمة المرور 6 أحرف على الأقل");return;}note("");const r=await call({action:"set_password",user_id:u.id,password:pwVal});if(r.error){note("خطأ: "+r.error);return;}setPwFor(null);setPwVal("");note("تم تغيير كلمة المرور",true);};

  const ov={position:"fixed",inset:0,background:"rgba(2,6,12,.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:14,fontFamily:"'Segoe UI',Tahoma,sans-serif"};
  const card={background:"#0f151c",border:"1px solid #232d39",borderRadius:18,width:"100%",maxWidth:780,maxHeight:"92vh",overflow:"auto",color:"#e8eef5"};
  const hd={display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px",borderBottom:"1px solid #232d39",position:"sticky",top:0,background:"#0f151c",zIndex:2};
  const inp={width:"100%",padding:"10px 12px",border:"1px solid #232d39",borderRadius:10,fontSize:13,background:"#141a22",color:"#e8eef5",boxSizing:"border-box",marginBottom:8};
  const btn=(bg,c)=>({border:"none",borderRadius:8,padding:"6px 11px",cursor:"pointer",fontWeight:700,fontSize:11.5,background:bg,color:c});

  return(<div style={ov} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={card}>
      <div style={hd}>
        <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#E8712B,#f5a35f)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",flex:"none"}}><Icon n="users" s={18}/></span><div><div style={{fontSize:16,fontWeight:800}}>المستخدمون والصلاحيات</div><div style={{fontSize:11,color:"#8a97a6"}}>المالك يضيف/يحذف/يمنح ويغيّر كلمات المرور</div></div></div>
        <button onClick={onClose} style={{background:"#1c2530",border:"none",color:"#e8eef5",borderRadius:10,padding:"8px 10px",cursor:"pointer",fontWeight:700,display:"inline-flex",alignItems:"center"}}><Icon n="x" s={16}/></button>
      </div>
      <div style={{padding:16}}>
        {msg&&<div style={{fontSize:12,marginBottom:10,color:msgOk?"#3fb950":"#f85149"}}>{msg}</div>}
        {loading?<div style={{color:"#8a97a6"}}>جاري التحميل…</div>:
        sel?(<>
          <button onClick={()=>{setSel(null);note("");}} style={{background:"none",border:"none",color:"#58a6ff",cursor:"pointer",fontSize:12,marginBottom:8,display:"inline-flex",alignItems:"center",gap:5}}><Icon n="back" s={14}/> رجوع للقائمة</button>
          <div style={{fontWeight:800}}>{sel.display_name||sel.email}</div>
          <div style={{fontSize:11,color:"#8a97a6",direction:"ltr",textAlign:"right",marginBottom:12}}>{sel.email}</div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <button onClick={grantAll} style={{flex:1,padding:"9px",border:"none",borderRadius:10,fontWeight:800,fontSize:12,cursor:"pointer",background:"rgba(63,185,80,.16)",color:"#3fb950",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon n="check" s={15}/> منح كل شيء</button>
            <button onClick={revokeAll} style={{flex:1,padding:"9px",border:"none",borderRadius:10,fontWeight:800,fontSize:12,cursor:"pointer",background:"rgba(248,81,73,.16)",color:"#f85149"}}>سحب الكل</button>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{color:"#8a97a6",fontSize:11}}><th style={{textAlign:"right",padding:"6px 4px"}}>الوحدة</th><th style={{width:70}}>عرض</th><th style={{width:70}}>تعديل</th></tr></thead>
            <tbody>{MODULES.map(m=>{const p=perms[m.k]||{view:false,edit:false};return(<tr key={m.k} style={{borderTop:"1px solid #232d39"}}><td style={{padding:"9px 4px",fontWeight:600}}>{m.ar}</td><td style={{textAlign:"center"}}><input type="checkbox" checked={!!p.view} onChange={e=>setP(m.k,"view",e.target.checked)} style={{width:18,height:18,accentColor:"#58a6ff"}}/></td><td style={{textAlign:"center"}}><input type="checkbox" checked={!!p.edit} onChange={e=>setP(m.k,"edit",e.target.checked)} style={{width:18,height:18,accentColor:"#3fb950"}}/></td></tr>);})}</tbody>
          </table>
          <button onClick={savePerms} disabled={saving} style={{marginTop:14,width:"100%",padding:12,border:"none",borderRadius:12,fontWeight:800,fontSize:13,cursor:"pointer",background:"linear-gradient(135deg,#E8712B,#d4631f)",color:"#fff",opacity:saving?.6:1}}>{saving?"جاري الحفظ…":"حفظ الصلاحيات"}</button>
        </>):(<>
          {!showAdd?<button onClick={()=>{setShowAdd(true);note("");}} style={{width:"100%",padding:"11px",border:"1px dashed #3fb950",background:"rgba(63,185,80,.08)",color:"#3fb950",borderRadius:12,fontWeight:800,fontSize:13,cursor:"pointer",marginBottom:12,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7}}><Icon n="plus" s={16}/> إضافة مستخدم جديد</button>:
          <div style={{background:"#141a22",border:"1px solid #232d39",borderRadius:12,padding:14,marginBottom:12}}>
            <div style={{fontWeight:800,marginBottom:10}}>مستخدم جديد (دخول فقط — امنحه الصلاحيات بعد الإنشاء)</div>
            <input style={{...inp,direction:"ltr",textAlign:"left"}} placeholder="البريد الإلكتروني" value={add.email} onChange={e=>setAdd({...add,email:e.target.value})}/>
            <input style={inp} placeholder="الاسم الظاهر (مثل: سلمان المالكي)" value={add.display_name} onChange={e=>setAdd({...add,display_name:e.target.value})}/>
            <input style={{...inp,direction:"ltr",textAlign:"left"}} type="text" placeholder="كلمة مرور مؤقتة (6+ أحرف)" value={add.password} onChange={e=>setAdd({...add,password:e.target.value})}/>
            <input style={inp} placeholder="رقم البايكر في سويتر (اختياري — للبايكرز)" value={add.biker_employee_id} onChange={e=>setAdd({...add,biker_employee_id:e.target.value})}/>
            <div style={{display:"flex",gap:8}}><button onClick={createUser} disabled={saving} style={{flex:2,padding:10,border:"none",borderRadius:10,fontWeight:800,background:"linear-gradient(135deg,#3fb950,#238636)",color:"#fff",cursor:"pointer"}}>{saving?"...":"إنشاء الحساب"}</button><button onClick={()=>setShowAdd(false)} style={{flex:1,padding:10,border:"none",borderRadius:10,fontWeight:700,background:"#1c2530",color:"#e8eef5",cursor:"pointer"}}>إلغاء</button></div>
          </div>}
          {users.map(u=>(<div key={u.id} style={{background:"#141a22",border:"1px solid #232d39",borderRadius:12,padding:"10px 14px",marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <div><div style={{fontWeight:700}}>{u.display_name||u.email} {u.is_owner&&<span style={{fontSize:10,background:"#3fb950",color:"#03130a",padding:"1px 7px",borderRadius:6,fontWeight:800}}>مالك</span>}{u.biker_employee_id&&<span style={{fontSize:10,background:"#1c2530",color:"#8a97a6",padding:"1px 7px",borderRadius:6,marginInlineStart:4}}>بايكر {u.biker_employee_id}</span>}</div><div style={{fontSize:11,color:"#8a97a6",direction:"ltr",textAlign:"right"}}>{u.email}</div></div>
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                <button onClick={()=>{setPwFor(pwFor===u.id?null:u.id);setPwVal("");}} style={{...btn("#1c2530","#e8eef5"),display:"inline-flex",alignItems:"center",gap:5}}><Icon n="key" s={13}/> كلمة المرور</button>
                {!u.is_owner&&<button onClick={()=>toggleActive(u)} style={btn(u.active?"rgba(63,185,80,.16)":"rgba(248,81,73,.16)",u.active?"#3fb950":"#f85149")}>{u.active?"مُفعّل":"موقوف"}</button>}
                {!u.is_owner&&<button onClick={()=>openUser(u)} style={{...btn("linear-gradient(135deg,#E8712B,#d4631f)","#fff"),display:"inline-flex",alignItems:"center",gap:5}}>الصلاحيات <Icon n="back" s={13}/></button>}
                {!u.is_owner&&<button onClick={()=>doDelete(u)} style={btn("rgba(248,81,73,.16)","#f85149")}>حذف</button>}
              </div>
            </div>
            {pwFor===u.id&&<div style={{display:"flex",gap:8,marginTop:10}}><input style={{...inp,marginBottom:0,direction:"ltr",textAlign:"left"}} type="text" placeholder="كلمة مرور جديدة (6+)" value={pwVal} onChange={e=>setPwVal(e.target.value)}/><button onClick={()=>savePw(u)} style={{...btn("linear-gradient(135deg,#3fb950,#238636)","#fff"),padding:"8px 14px"}}>حفظ</button></div>}
          </div>))}
          <div style={{marginTop:8,background:"#141a22",border:"1px dashed #232d39",borderRadius:12,padding:"10px 14px",fontSize:11.5,color:"#8a97a6"}}><b style={{color:"#e3b341",display:"inline-flex",alignItems:"center",gap:6}}><Icon n="lock" s={13}/> بيانات TMA غير مدرجة في الصلاحيات — مقصورة عليك وحدك حتى مع «كل شيء».</b></div>
        </>)}
      </div>
    </div>
  </div>);
}
