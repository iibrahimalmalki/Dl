import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";

// بنود إنهاء الخدمة — تغطّي كل النطاقات المرتبطة بالموظف
const OFF_ITEMS=[
  {k:"return_bike",   ar:"إعادة الدراجة وفحص حالتها",        ic:"bike"},
  {k:"return_custody",ar:"إعادة العُهد والمعدات (FRM-OPS-001)",ic:"bucket"},
  {k:"return_keys",   ar:"تسليم مفاتيح السلسلة",              ic:"key"},
  {k:"vacate_housing",ar:"إخلاء السكن وتحديث قائمة منزل",     ic:"home"},
  {k:"final_settle",  ar:"التسوية المالية النهائية والمخالصة", ic:"cash"},
  {k:"docs_handover", ar:"تسليم/أرشفة الوثائق (إقامة/رخصة)",   ic:"doc"},
  {k:"deactivate_acc",ar:"تعطيل حساب النظام والصلاحيات",       ic:"lock"},
  {k:"notify_sweater",ar:"إبلاغ سويتر رسمياً بالمغادرة",       ic:"phone"},
];
const REASONS=["استقالة","انتهاء عقد","نقل كفالة","إنهاء من المنشأة","أخرى"];
const fmtD=d=>d?new Date(d+"T00:00:00").toLocaleDateString("en-GB"):"—";
const pct=items=>Math.round(OFF_ITEMS.filter(i=>items&&items[i.k]).length/OFF_ITEMS.length*100);

export default function Offboarding({opId}){
  const[loading,setLoading]=useState(true);
  const[rows,setRows]=useState([]);const[emps,setEmps]=useState([]);
  const[form,setForm]=useState(null);const[msg,setMsg]=useState(null);const[busy,setBusy]=useState(false);
  const note=(ok,t)=>setMsg({ok,t});

  const load=async()=>{
    setLoading(true);
    let q=supabase.from("offboarding").select("*").order("created_at",{ascending:false});
    if(opId&&opId!=="all")q=q.or("operator_id.eq."+opId+",operator_id.is.null");
    const{data}=await q;setRows(data||[]);setLoading(false);
  };
  useEffect(()=>{load();/*eslint-disable-next-line*/},[opId]);
  useEffect(()=>{supabase.from("employees").select("id,full_name,employee_id,staff_role").order("full_name").then(({data})=>setEmps(data||[]));},[]);

  const activeIds=useMemo(()=>new Set(rows.filter(r=>r.status!=="completed").map(r=>r.employee_id)),[rows]);
  const k=useMemo(()=>({open:rows.filter(r=>r.status!=="completed").length,done:rows.filter(r=>r.status==="completed").length}),[rows]);

  const start=()=>setForm({employee_id:"",reason:"استقالة",last_day:new Date().toISOString().slice(0,10),items:{},notes:""});
  const save=async(row,close)=>{
    setBusy(true);
    const p=pct(row.items);
    const payload={operator_id:(opId&&opId!=="all")?opId:null,employee_id:row.employee_id||null,biker_name:row.biker_name||null,sweater_id:row.sweater_id||null,
      reason:row.reason||null,last_day:row.last_day||null,items:row.items||{},progress:p,status:p===100?"completed":"in_progress",
      completed_at:p===100?new Date().toISOString():null,notes:row.notes||null};
    try{
      if(row.id)await supabase.from("offboarding").update(payload).eq("id",row.id);
      else await supabase.from("offboarding").insert(payload);
      if(close)setForm(null);note(true,p===100?"اكتمل إنهاء الخدمة":"تم الحفظ");await load();
    }catch(e){note(false,"خطأ: "+(e.message||e));}
    setBusy(false);
  };
  const createCase=async()=>{
    if(!form.employee_id){note(false,"اختر الموظف");return;}
    const e=emps.find(x=>x.id===form.employee_id);
    await save({...form,biker_name:e?e.full_name+(e.employee_id?" ("+e.employee_id+")":""):null,sweater_id:e?.employee_id||null},true);
  };
  const toggle=async(r,key)=>{const items={...(r.items||{}),[key]:!(r.items&&r.items[key])};await save({...r,items},false);};
  const del=async(r)=>{if(!confirm("حذف سجل إنهاء الخدمة؟"))return;await supabase.from("offboarding").delete().eq("id",r.id);await load();};

  if(loading)return <div className="dw-skel" style={{height:240}}/>;

  return(<div className="ob">
    <style>{CSS}</style>
    {msg&&msg.t&&<div className={"ob-toast"+(msg.ok?" ok":" err")} onClick={()=>setMsg(null)}>{msg.t}</div>}

    <div className="ob-kpis">
      <div className="ob-kpi"><span>حالات جارية</span><b style={{color:"#b54708"}}>{k.open}</b></div>
      <div className="ob-kpi"><span>مكتملة</span><b style={{color:"#087443"}}>{k.done}</b></div>
      <div className="ob-kpi"><span>بنود المخالصة</span><b>{OFF_ITEMS.length}</b></div>
      <button className="ob-start" onClick={start}><Icon n="plus" s={16}/> بدء إنهاء خدمة</button>
    </div>

    {rows.length===0?<div className="ob-empty"><Icon n="logout" s={30}/><p>لا حالات إنهاء خدمة. ابدأ عند مغادرة موظف لضمان استرجاع العُهد وإخلاء السكن والتسوية.</p></div>:
    <div className="ob-list">
      {rows.map(r=>{const p=pct(r.items);const done=r.status==="completed";return(
        <div key={r.id} className={"ob-card"+(done?" done":"")}>
          <div className="ob-ch">
            <div className="ob-who"><span className="ob-av"><Icon n="employees" s={16}/></span><div><b>{r.biker_name||"—"}</b><small>{r.reason||"—"} · آخر يوم {fmtD(r.last_day)}</small></div></div>
            <span className="ob-badge" style={done?{color:"#087443",background:"#e7f7ef"}:{color:"#b54708",background:"#fef3e2"}}>{done?"مكتمل":p+"%"}</span>
          </div>
          <div className="ob-track"><div style={{width:p+"%",background:done?"#12b76a":"#E8712B"}}/></div>
          <div className="ob-items">
            {OFF_ITEMS.map(it=>{const on=r.items&&r.items[it.k];return(
              <button key={it.k} className={"ob-item"+(on?" on":"")} onClick={()=>toggle(r,it.k)}>
                <span className="ob-chk"><Icon n={on?"check":it.ic} s={13}/></span>{it.ar}
              </button>);})}
          </div>
          <div className="ob-foot">
            <input className="ob-note" placeholder="ملاحظات…" defaultValue={r.notes||""} onBlur={e=>{if(e.target.value!==(r.notes||""))save({...r,notes:e.target.value},false);}}/>
            <button className="ob-del" onClick={()=>del(r)}><Icon n="trash" s={14}/></button>
          </div>
        </div>);})}
    </div>}

    {form&&<div className="ob-scrim" onClick={()=>setForm(null)}><div className="ob-modal" onClick={e=>e.stopPropagation()}>
      <div className="ob-mh"><b>بدء إنهاء خدمة</b><button onClick={()=>setForm(null)}><Icon n="x" s={18}/></button></div>
      <div className="ob-mb">
        <label className="ob-f"><span>الموظف *</span><select value={form.employee_id} onChange={e=>setForm({...form,employee_id:e.target.value})}><option value="">— اختر —</option>{emps.filter(x=>!activeIds.has(x.id)).map(x=><option key={x.id} value={x.id}>{x.full_name}{x.employee_id?" ("+x.employee_id+")":""}</option>)}</select></label>
        <div className="ob-2">
          <label className="ob-f"><span>السبب</span><select value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}>{REASONS.map(r=><option key={r}>{r}</option>)}</select></label>
          <label className="ob-f"><span>آخر يوم عمل</span><input type="date" value={form.last_day} onChange={e=>setForm({...form,last_day:e.target.value})}/></label>
        </div>
      </div>
      <div className="ob-mf"><button className="g" onClick={()=>setForm(null)}>إلغاء</button><button className="p" disabled={busy} onClick={createCase}>بدء</button></div>
    </div></div>}
  </div>);
}

const CSS=`
.ob{--brand:#E8712B;--ink:#0f172a;--mut:#64748b;--line:#eceef1}
.ob *{box-sizing:border-box}
.ob-toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:80;padding:11px 18px;border-radius:12px;font-weight:700;font-size:13px;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer}
.ob-toast.ok{background:#087443}.ob-toast.err{background:#b42318}
.ob-kpis{display:grid;grid-template-columns:repeat(3,1fr) auto;gap:12px;align-items:center;margin-bottom:16px}
.ob-kpi{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 15px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.ob-kpi span{font-size:11.5px;color:var(--mut);font-weight:700;display:block}
.ob-kpi b{font-size:22px;font-weight:800;margin-top:4px;display:block}
.ob-start{display:flex;align-items:center;gap:7px;background:var(--brand);color:#fff;border:none;padding:12px 18px;border-radius:12px;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap}
.ob-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}
.ob-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:15px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.ob-card.done{background:#fbfefc;border-color:#cdeddc}
.ob-ch{display:flex;align-items:center;justify-content:space-between;gap:10px}
.ob-who{display:flex;align-items:center;gap:10px}
.ob-av{width:36px;height:36px;border-radius:10px;background:#fff2e8;color:var(--brand);display:flex;align-items:center;justify-content:center}
.ob-who b{font-size:14px;font-weight:800;display:block}.ob-who small{font-size:11px;color:var(--mut)}
.ob-badge{font-size:12px;font-weight:800;padding:3px 11px;border-radius:20px}
.ob-track{height:8px;background:#eef1f4;border-radius:6px;overflow:hidden;margin:11px 0 12px}
.ob-track div{height:100%;border-radius:6px;transition:width .2s}
.ob-items{display:flex;flex-direction:column;gap:7px}
.ob-item{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:10px;border:1px solid var(--line);background:#fff;font-family:inherit;font-size:12.5px;font-weight:600;color:#334155;cursor:pointer;text-align:right}
.ob-item.on{background:#e7f7ef;border-color:#bbe8cf;color:#087443;font-weight:700}
.ob-chk{width:22px;height:22px;border-radius:7px;background:#f1f3f5;display:flex;align-items:center;justify-content:center;flex:none}
.ob-item.on .ob-chk{background:#12b76a;color:#fff}
.ob-foot{display:flex;gap:8px;margin-top:12px}
.ob-note{flex:1;border:1px solid var(--line);border-radius:9px;padding:8px 10px;font-family:inherit;font-size:12px;outline:none}
.ob-del{border:1px solid #f7bfba;background:#feecea;color:#b42318;width:36px;border-radius:9px;cursor:pointer}
.ob-empty{text-align:center;padding:44px;color:#cbd5e1}.ob-empty p{color:#94a3b8;font-size:13px;margin-top:8px;max-width:420px;margin-inline:auto;line-height:1.7}
.ob-scrim{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:70;display:flex;align-items:center;justify-content:center;padding:16px}
.ob-modal{background:#fff;border-radius:16px;width:100%;max-width:460px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
.ob-mh{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--line)}
.ob-mh b{font-size:15px;font-weight:800}.ob-mh button{background:none;border:none;cursor:pointer;color:var(--mut);display:flex}
.ob-mb{padding:16px 18px;display:flex;flex-direction:column;gap:11px}
.ob-2{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.ob-f{display:flex;flex-direction:column;gap:5px}
.ob-f span{font-size:12px;font-weight:700}
.ob-f input,.ob-f select{border:1px solid #dfe3e8;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:13px;outline:none;background:#fff}
.ob-mf{display:flex;gap:10px;justify-content:flex-end;padding:14px 18px;border-top:1px solid var(--line)}
.ob-mf button{padding:9px 20px;border-radius:10px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;border:1px solid var(--line)}
.ob-mf button.g{background:#fff;color:var(--mut)}.ob-mf button.p{background:var(--brand);color:#fff;border-color:var(--brand)}.ob-mf button.p:disabled{opacity:.6}
@media(max-width:640px){.ob-kpis{grid-template-columns:1fr 1fr}.ob-start{grid-column:1/-1;justify-content:center}}
`;
