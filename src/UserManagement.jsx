import{useState,useEffect}from"react";
import{supabase}from"./supabase";

// الوحدات القابلة للمنح — TMA غير مدرجة عمداً (مقصورة على المالك ولا تُمنح لأحد)
const MODULES=[
  {k:"applicants",ar:"التوظيف"},
  {k:"interviews",ar:"المقابلات"},
  {k:"onboarding",ar:"التعاقد والإعداد"},
  {k:"operations",ar:"العمليات اليومية"},
  {k:"performance",ar:"الأداء"},
  {k:"payroll",ar:"الرواتب"},
  {k:"complaints",ar:"الشكاوى والتصعيد"},
  {k:"field_rounds",ar:"الجولات الميدانية"},
  {k:"vendors",ar:"الموردون"},
  {k:"referrals",ar:"الإحالات"},
  {k:"reports",ar:"التقارير"},
  {k:"employees",ar:"الموظفون"},
];

export default function UserManagement({onClose}){
  const[users,setUsers]=useState([]);
  const[sel,setSel]=useState(null);
  const[perms,setPerms]=useState({});
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);
  const[msg,setMsg]=useState("");

  const loadUsers=async()=>{
    setLoading(true);
    const{data}=await supabase.from("app_users").select("id,email,display_name,is_owner,active,biker_employee_id").order("created_at");
    setUsers(data||[]);setLoading(false);
  };
  useEffect(()=>{loadUsers();},[]);

  const openUser=async(u)=>{
    setSel(u);setMsg("");
    const{data}=await supabase.from("user_permissions").select("module,can_view,can_edit").eq("user_id",u.id);
    const m={};(data||[]).forEach(r=>{m[r.module]={view:r.can_view,edit:r.can_edit};});
    setPerms(m);
  };
  const setP=(mod,key,val)=>setPerms(p=>{const c={...(p[mod]||{view:false,edit:false})};c[key]=val;if(key==="edit"&&val)c.view=true;if(key==="view"&&!val)c.edit=false;return{...p,[mod]:c};});
  const grantAll=()=>{const m={};MODULES.forEach(x=>m[x.k]={view:true,edit:true});setPerms(m);};
  const revokeAll=()=>setPerms({});

  const save=async()=>{
    if(!sel)return;setSaving(true);setMsg("");
    // احذف القديم ثم أدخل المفعّل فقط
    await supabase.from("user_permissions").delete().eq("user_id",sel.id);
    const rows=MODULES.filter(x=>perms[x.k]&&(perms[x.k].view||perms[x.k].edit))
      .map(x=>({user_id:sel.id,module:x.k,can_view:!!perms[x.k].view,can_edit:!!perms[x.k].edit}));
    if(rows.length){const{error}=await supabase.from("user_permissions").insert(rows);if(error){setMsg("خطأ في الحفظ: "+error.message);setSaving(false);return;}}
    setSaving(false);setMsg("✅ حُفظت الصلاحيات");
  };
  const toggleActive=async(u)=>{
    await supabase.from("app_users").update({active:!u.active}).eq("id",u.id);
    loadUsers();if(sel&&sel.id===u.id)setSel({...u,active:!u.active});
  };

  const ov={position:"fixed",inset:0,background:"rgba(2,6,12,.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:14,fontFamily:"'Segoe UI',Tahoma,sans-serif"};
  const card={background:"#0f151c",border:"1px solid #232d39",borderRadius:18,width:"100%",maxWidth:760,maxHeight:"90vh",overflow:"auto",color:"#e8eef5"};
  const hd={display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px",borderBottom:"1px solid #232d39",position:"sticky",top:0,background:"#0f151c"};
  return(<div style={ov} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={card}>
      <div style={hd}>
        <div><div style={{fontSize:16,fontWeight:800}}>👥 المستخدمون والصلاحيات</div><div style={{fontSize:11,color:"#8a97a6"}}>المالك يمنح لكل مستخدم ما يراه — أو كل شيء</div></div>
        <button onClick={onClose} style={{background:"#1c2530",border:"none",color:"#e8eef5",borderRadius:10,padding:"8px 12px",cursor:"pointer",fontWeight:700}}>إغلاق ✕</button>
      </div>
      <div style={{padding:16}}>
        {loading?<div style={{color:"#8a97a6"}}>جاري التحميل…</div>:
        !sel?(<>
          <div style={{fontSize:12,color:"#8a97a6",marginBottom:8}}>اختر مستخدماً لتعديل صلاحياته:</div>
          {users.map(u=>(<div key={u.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,background:"#141a22",border:"1px solid #232d39",borderRadius:12,padding:"10px 14px",marginBottom:8}}>
            <div><div style={{fontWeight:700}}>{u.display_name||u.email} {u.is_owner&&<span style={{fontSize:10,background:"#3fb950",color:"#03130a",padding:"1px 7px",borderRadius:6,fontWeight:800}}>مالك</span>}</div><div style={{fontSize:11,color:"#8a97a6",direction:"ltr",textAlign:"right"}}>{u.email}</div></div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {!u.is_owner&&<button onClick={()=>toggleActive(u)} style={{fontSize:11,fontWeight:700,border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",background:u.active?"rgba(63,185,80,.16)":"rgba(248,81,73,.16)",color:u.active?"#3fb950":"#f85149"}}>{u.active?"مُفعّل":"موقوف"}</button>}
              {u.is_owner?<span style={{fontSize:11,color:"#8a97a6"}}>صلاحية كاملة</span>:<button onClick={()=>openUser(u)} style={{fontSize:12,fontWeight:800,border:"none",borderRadius:8,padding:"7px 12px",cursor:"pointer",background:"linear-gradient(135deg,#E8712B,#d4631f)",color:"#fff"}}>الصلاحيات ←</button>}
            </div>
          </div>))}
          <div style={{marginTop:12,background:"#141a22",border:"1px dashed #232d39",borderRadius:12,padding:"12px 14px",fontSize:11.5,color:"#8a97a6"}}>➕ لإضافة مستخدم جديد (مشرف/قائد/بايكر): زوّدني ببريده ودوره وأنشئ حسابه (دخول فقط) ثم تمنحه الصلاحيات من هنا. <b style={{color:"#e3b341"}}>🔒 بيانات TMA غير مدرجة — مقصورة عليك وحدك.</b></div>
        </>):(<>
          <button onClick={()=>{setSel(null);setMsg("");}} style={{background:"none",border:"none",color:"#58a6ff",cursor:"pointer",fontSize:12,marginBottom:8}}>← رجوع للقائمة</button>
          <div style={{fontWeight:800,marginBottom:2}}>{sel.display_name||sel.email}</div>
          <div style={{fontSize:11,color:"#8a97a6",direction:"ltr",textAlign:"right",marginBottom:12}}>{sel.email}</div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <button onClick={grantAll} style={{flex:1,padding:"9px",border:"none",borderRadius:10,fontWeight:800,fontSize:12,cursor:"pointer",background:"rgba(63,185,80,.16)",color:"#3fb950"}}>✅ منح كل شيء</button>
            <button onClick={revokeAll} style={{flex:1,padding:"9px",border:"none",borderRadius:10,fontWeight:800,fontSize:12,cursor:"pointer",background:"rgba(248,81,73,.16)",color:"#f85149"}}>سحب الكل</button>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{color:"#8a97a6",fontSize:11}}><th style={{textAlign:"right",padding:"6px 4px"}}>الوحدة</th><th style={{width:70}}>عرض</th><th style={{width:70}}>تعديل</th></tr></thead>
            <tbody>{MODULES.map(m=>{const p=perms[m.k]||{view:false,edit:false};return(<tr key={m.k} style={{borderTop:"1px solid #232d39"}}><td style={{padding:"9px 4px",fontWeight:600}}>{m.ar}</td>
              <td style={{textAlign:"center"}}><input type="checkbox" checked={!!p.view} onChange={e=>setP(m.k,"view",e.target.checked)} style={{width:18,height:18,accentColor:"#58a6ff"}}/></td>
              <td style={{textAlign:"center"}}><input type="checkbox" checked={!!p.edit} onChange={e=>setP(m.k,"edit",e.target.checked)} style={{width:18,height:18,accentColor:"#3fb950"}}/></td></tr>);})}</tbody>
          </table>
          {msg&&<div style={{fontSize:12,marginTop:10,color:msg.startsWith("✅")?"#3fb950":"#f85149"}}>{msg}</div>}
          <button onClick={save} disabled={saving} style={{marginTop:14,width:"100%",padding:12,border:"none",borderRadius:12,fontWeight:800,fontSize:13,cursor:"pointer",background:"linear-gradient(135deg,#E8712B,#d4631f)",color:"#fff",opacity:saving?.6:1}}>{saving?"جاري الحفظ…":"حفظ الصلاحيات"}</button>
        </>)}
      </div>
    </div>
  </div>);
}
