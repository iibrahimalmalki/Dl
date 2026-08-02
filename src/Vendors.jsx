import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";

const waNum=raw=>{let d=String(raw||"").replace(/[^0-9]/g,"");if(!d)return"";if(d.startsWith("00"))d=d.slice(2);if(d.startsWith("966")||d.startsWith("880"))return d;if(d.startsWith("0"))return(d.length===11?"880":"966")+d.replace(/^0+/,"");if(d.startsWith("5")&&d.length===9)return"966"+d;return d;};
const CATS=["صيانة","قطع غيار","دراجات","سكن","مواد تنظيف","زي","معدات سلامة","أخرى"];
const CAT_ICON={"صيانة":"wrench","قطع غيار":"wrench","دراجات":"bike","سكن":"home","مواد تنظيف":"bucket","زي":"shirt","معدات سلامة":"alert","أخرى":"vendors"};
const money=n=>Number(n||0).toLocaleString("en-US")+" ﷼";
const fmtD=d=>d?new Date(d).toLocaleDateString("en-GB"):"—";
const thisMonth=()=>new Date().toISOString().slice(0,7);

export default function Vendors({opId}){
  const[loading,setLoading]=useState(true);
  const[vendors,setVendors]=useState([]);const[exps,setExps]=useState([]);
  const[sel,setSel]=useState(null);
  const[filter,setFilter]=useState("all");
  const[form,setForm]=useState(null);       // vendor being added/edited
  const[exp,setExp]=useState(null);          // expense being added
  const[msg,setMsg]=useState(null);const[busy,setBusy]=useState(false);

  const load=async()=>{
    setLoading(true);
    let vq=supabase.from("vendors").select("*").order("created_at",{ascending:false});
    if(opId&&opId!=="all")vq=vq.eq("operator_id",opId);
    const{data:v}=await vq;setVendors(v||[]);
    const{data:e}=await supabase.from("vendor_expenses").select("*").order("exp_date",{ascending:false});
    setExps(e||[]);
    setLoading(false);
  };
  useEffect(()=>{load();},[opId]);

  const expFor=id=>exps.filter(e=>e.vendor_id===id);
  const totalFor=id=>expFor(id).reduce((a,e)=>a+Number(e.amount||0),0);
  const kpis=useMemo(()=>{
    const m=thisMonth();
    const monthSpend=exps.filter(e=>String(e.exp_date||"").slice(0,7)===m).reduce((a,e)=>a+Number(e.amount||0),0);
    const totalSpend=exps.reduce((a,e)=>a+Number(e.amount||0),0);
    return{count:vendors.length,active:vendors.filter(v=>v.active).length,monthSpend,totalSpend};
  },[vendors,exps]);
  const shown=vendors.filter(v=>filter==="all"||v.category===filter);

  const saveVendor=async()=>{
    if(!form.name.trim()){setMsg({ok:false,t:"أدخل اسم المورد"});return;}
    setBusy(true);setMsg(null);
    try{
      const row={operator_id:(opId&&opId!=="all")?opId:null,name:form.name.trim(),category:form.category||null,contact_name:form.contact_name||null,phone:form.phone||null,notes:form.notes||null,active:form.active!==false};
      if(form.id){const{error}=await supabase.from("vendors").update(row).eq("id",form.id);if(error)throw error;}
      else{const{error}=await supabase.from("vendors").insert(row);if(error)throw error;}
      setForm(null);setMsg({ok:true,t:"تم الحفظ"});await load();
    }catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setBusy(false);
  };
  const delVendor=async(v)=>{if(!confirm("حذف المورد «"+v.name+"» وكل مصروفاته؟"))return;await supabase.from("vendors").delete().eq("id",v.id);if(sel&&sel.id===v.id)setSel(null);await load();};
  const saveExp=async()=>{
    if(!(Number(exp.amount)>0)){setMsg({ok:false,t:"أدخل مبلغاً صحيحاً"});return;}
    setBusy(true);setMsg(null);
    try{
      const row={operator_id:sel.operator_id||null,vendor_id:sel.id,exp_date:exp.exp_date||null,title:exp.title||null,amount:Number(exp.amount),notes:exp.notes||null};
      const{error}=await supabase.from("vendor_expenses").insert(row);if(error)throw error;
      setExp(null);await load();
    }catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setBusy(false);
  };
  const delExp=async(e)=>{await supabase.from("vendor_expenses").delete().eq("id",e.id);await load();};

  if(loading)return <div className="dw-skel" style={{height:260}}/>;

  // تفاصيل مورد
  if(sel){const list=expFor(sel.id);const tot=totalFor(sel.id);return(
    <div className="vn">
      <style>{CSS}</style>
      <div className="vn-head">
        <button className="vn-back" onClick={()=>{setSel(null);setExp(null);}}><Icon n="back" s={15}/> رجوع</button>
        <div style={{flex:1,minWidth:0}}><div className="vn-h-t">{sel.name}</div><div className="vn-h-s">{sel.category||"—"}{sel.contact_name?` · ${sel.contact_name}`:""}</div></div>
        {sel.phone&&<a className="vn-btn ok" href={`https://wa.me/${waNum(sel.phone)}`} target="_blank" rel="noreferrer"><Icon n="phone" s={14}/> واتساب</a>}
        <button className="vn-btn ghost" onClick={()=>setForm({...sel})}><Icon n="edit" s={14}/> تعديل</button>
      </div>
      {msg&&<div className={"vn-msg "+(msg.ok?"ok":"err")}>{msg.t}</div>}
      {sel.notes&&<div className="vn-note"><Icon n="doc" s={13}/> {sel.notes}</div>}

      <div className="vn-sum"><div><span>إجمالي المصروفات</span><b>{money(tot)}</b></div><div><span>عدد العمليات</span><b>{list.length}</b></div></div>

      <div className="vn-sec-h"><Icon n="cash" s={16}/> سجل المصروفات <span>({list.length})</span><button className="vn-add-sm" onClick={()=>setExp({exp_date:new Date().toISOString().slice(0,10),title:"",amount:"",notes:""})}><Icon n="plus" s={13}/> إضافة</button></div>
      {exp&&<div className="vn-card vn-form">
        <div className="vn-grid2">
          <label className="vn-f"><span>التاريخ</span><input type="date" value={exp.exp_date} onChange={e=>setExp({...exp,exp_date:e.target.value})}/></label>
          <label className="vn-f"><span>المبلغ (﷼)</span><input type="number" value={exp.amount} onChange={e=>setExp({...exp,amount:e.target.value})} placeholder="0"/></label>
        </div>
        <label className="vn-f"><span>البيان</span><input value={exp.title} onChange={e=>setExp({...exp,title:e.target.value})} placeholder="مثال: صيانة دراجة #12 / إيجار سكن"/></label>
        <label className="vn-f"><span>ملاحظات</span><input value={exp.notes} onChange={e=>setExp({...exp,notes:e.target.value})} placeholder="اختياري"/></label>
        <div className="vn-form-act"><button className="vn-btn brand" onClick={saveExp} disabled={busy}><Icon n="save" s={14}/> حفظ</button><button className="vn-btn ghost" onClick={()=>setExp(null)}>إلغاء</button></div>
      </div>}
      {list.length===0?<div className="vn-empty2">لا مصروفات مسجّلة لهذا المورد بعد.</div>:
      <div className="vn-explist">{list.map(e=>(
        <div className="vn-exp" key={e.id}>
          <div className="vn-exp-ic"><Icon n="cash" s={15}/></div>
          <div style={{flex:1,minWidth:0}}><div className="vn-exp-t">{e.title||"مصروف"}</div><div className="vn-exp-s">{fmtD(e.exp_date)}{e.notes?` · ${e.notes}`:""}</div></div>
          <div className="vn-exp-amt">{money(e.amount)}</div>
          <button className="vn-x" onClick={()=>delExp(e)}><Icon n="trash" s={13}/></button>
        </div>))}</div>}

      {form&&<VForm form={form} setForm={setForm} save={saveVendor} busy={busy}/>}
    </div>);}

  // القائمة
  return(<div className="vn">
    <style>{CSS}</style>
    <div className="vn-kpis">
      <K ic="vendors" c="#E8712B" bg="#fff2e8" t="الموردون" v={kpis.count}/>
      <K ic="checkCircle" c="#087443" bg="#e7f7ef" t="نشطون" v={kpis.active}/>
      <K ic="cash" c="#1d5bbf" bg="#eef4ff" t="مصروف هذا الشهر" v={money(kpis.monthSpend)}/>
      <K ic="chart" c="#b54708" bg="#fef3e2" t="إجمالي المصروفات" v={money(kpis.totalSpend)}/>
    </div>

    <div className="vn-bar">
      <div className="vn-filters">
        <button className={filter==="all"?"on":""} onClick={()=>setFilter("all")}>الكل</button>
        {CATS.map(c=><button key={c} className={filter===c?"on":""} onClick={()=>setFilter(c)}>{c}</button>)}
      </div>
      <button className="vn-add" onClick={()=>setForm({name:"",category:"",contact_name:"",phone:"",notes:"",active:true})}><Icon n="plus" s={15}/> مورد جديد</button>
    </div>
    {msg&&<div className={"vn-msg "+(msg.ok?"ok":"err")}>{msg.t}</div>}

    {shown.length===0?<div className="vn-empty"><div className="vn-empty-ic"><Icon n="vendors" s={30}/></div><h3>لا موردين{filter!=="all"?` في «${filter}»`:""}</h3><p>أضف موردي الصيانة والقطع والدراجات والسكن وغيرها، وسجّل مصروفات كل مورد لتتبّع التكاليف.</p></div>:
    <div className="vn-list">{shown.map(v=>{const tot=totalFor(v.id);return(
      <div className="vn-item" key={v.id} onClick={()=>setSel(v)}>
        <div className="vn-av"><Icon n={CAT_ICON[v.category]||"vendors"} s={17}/></div>
        <div style={{flex:1,minWidth:0}}>
          <div className="vn-name">{v.name}{!v.active&&<span className="vn-off">موقوف</span>}</div>
          <div className="vn-sub">{v.category||"—"}{v.contact_name?` · ${v.contact_name}`:""}{v.phone?` · ${v.phone}`:""}</div>
        </div>
        <div className="vn-right"><span className="vn-tot">{money(tot)}</span><Icon n="fwd" s={14}/></div>
      </div>);})}</div>}

    {form&&<VForm form={form} setForm={setForm} save={saveVendor} busy={busy} onDelete={form.id?()=>delVendor(form):null}/>}
  </div>);
}

function VForm({form,setForm,save,busy,onDelete}){
  return(<div className="vn-modal" onClick={e=>{if(e.target.className==="vn-modal")setForm(null);}}>
    <div className="vn-sheet">
      <div className="vn-sheet-h"><b>{form.id?"تعديل مورد":"مورد جديد"}</b><button onClick={()=>setForm(null)}><Icon n="x" s={16}/></button></div>
      <label className="vn-f"><span>اسم المورد</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="مثال: ورشة النور للصيانة"/></label>
      <label className="vn-f"><span>الفئة</span><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option value="">— اختر —</option>{CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
      <div className="vn-grid2">
        <label className="vn-f"><span>الشخص المسؤول</span><input value={form.contact_name} onChange={e=>setForm({...form,contact_name:e.target.value})} placeholder="اسم جهة الاتصال"/></label>
        <label className="vn-f"><span>الهاتف</span><input className="ltr" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="05xxxxxxxx"/></label>
      </div>
      <label className="vn-f"><span>ملاحظات</span><textarea rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="شروط، أسعار، تخصص…"/></label>
      <label className="vn-chk"><input type="checkbox" checked={form.active!==false} onChange={e=>setForm({...form,active:e.target.checked})}/> مورد نشط</label>
      <div className="vn-form-act">
        <button className="vn-btn brand" onClick={save} disabled={busy}><Icon n="save" s={14}/> حفظ</button>
        {onDelete&&<button className="vn-btn danger" onClick={onDelete}><Icon n="trash" s={14}/> حذف</button>}
        <div style={{flex:1}}/>
        <button className="vn-btn ghost" onClick={()=>setForm(null)}>إلغاء</button>
      </div>
    </div>
  </div>);
}
function K({ic,c,bg,t,v}){return(<div className="vn-kpi"><span className="vn-ki" style={{background:bg,color:c}}><Icon n={ic} s={17}/></span><div style={{minWidth:0}}><div className="vn-kv">{v}</div><div className="vn-kl">{t}</div></div></div>);}

const CSS=`
.vn{--b:#E8712B}
.vn-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
.vn-kpi{background:#fff;border:1px solid #eceef1;border-radius:15px;padding:13px;display:flex;align-items:center;gap:11px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.vn-ki{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.vn-kv{font-size:17px;font-weight:800;letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vn-kl{font-size:11px;color:#64748b;font-weight:600}
.vn-bar{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.vn-filters{display:flex;gap:6px;flex-wrap:wrap;flex:1}
.vn-filters button{background:#fff;border:1px solid #e6e9ee;border-radius:20px;padding:6px 13px;font-family:inherit;font-size:12px;font-weight:700;color:#64748b;cursor:pointer}
.vn-filters button.on{background:#0e1622;border-color:#0e1622;color:#fff}
.vn-add{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#E8712B,#f5a35f);border:none;border-radius:11px;padding:9px 15px;color:#fff;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;flex:none}
.vn-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:12px}
.vn-msg.ok{background:#e7f7ef;color:#087443}.vn-msg.err{background:#feecea;color:#b42318}
.vn-list{display:flex;flex-direction:column;gap:10px}
.vn-item{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #eceef1;border-radius:14px;padding:12px 14px;box-shadow:0 1px 2px rgba(16,24,40,.05);cursor:pointer}
.vn-item:hover{border-color:#f5c9a8}
.vn-av{width:42px;height:42px;border-radius:12px;background:#fff2e8;color:#E8712B;display:flex;align-items:center;justify-content:center;flex:none}
.vn-name{font-size:14px;font-weight:800;color:#0f172a}
.vn-off{font-size:9.5px;font-weight:800;background:#feecea;color:#b42318;padding:1px 8px;border-radius:20px;margin-inline-start:6px}
.vn-sub{font-size:11.5px;color:#94a3b8;margin-top:2px}
.vn-right{display:flex;align-items:center;gap:9px;flex:none;color:#cbd5e1}
.vn-tot{font-size:13px;font-weight:800;color:#0f172a}
.vn-empty,.vn-empty2{background:#fff;border:1px dashed #e6e9ee;border-radius:16px;padding:40px 24px;text-align:center}
.vn-empty2{padding:22px;color:#94a3b8;font-size:12.5px}
.vn-empty-ic{width:64px;height:64px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#fff2e8,#ffe2cc);color:var(--b)}
.vn-empty h3{font-size:16px;margin:0 0 8px}.vn-empty p{color:#64748b;font-size:12.5px;max-width:440px;margin:0 auto;line-height:1.7}
/* detail */
.vn-head{display:flex;align-items:center;gap:10px;padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid #eceef1;flex-wrap:wrap}
.vn-back{display:inline-flex;align-items:center;gap:5px;background:#fff;border:1px solid #e6e9ee;border-radius:10px;padding:7px 12px;font-family:inherit;font-size:12.5px;font-weight:700;color:#334155;cursor:pointer;flex:none}
.vn-h-t{font-size:16px;font-weight:800;color:#0f172a}.vn-h-s{font-size:12px;color:#64748b}
.vn-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 13px;border-radius:11px;border:none;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;text-decoration:none}
.vn-btn.ok{background:linear-gradient(135deg,#12b76a,#087443);color:#fff}
.vn-btn.brand{background:linear-gradient(135deg,#E8712B,#f5a35f);color:#fff}
.vn-btn.ghost{background:#fff;border:1px solid #e6e9ee;color:#334155}
.vn-btn.danger{background:#feecea;color:#b42318}
.vn-btn:disabled{opacity:.6}
.vn-note{display:flex;align-items:flex-start;gap:7px;background:#fafbfc;border:1px solid #eceef1;border-radius:11px;padding:10px 12px;font-size:12px;color:#475569;margin-bottom:12px;line-height:1.6}
.vn-sum{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
.vn-sum>div{background:#fff;border:1px solid #eceef1;border-radius:14px;padding:13px 15px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.vn-sum span{font-size:11.5px;color:#64748b;font-weight:600;display:block}.vn-sum b{font-size:18px;font-weight:800;margin-top:3px;display:block}
.vn-sec-h{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;margin-bottom:11px}
.vn-sec-h span{color:#94a3b8;font-weight:600;font-size:12px}
.vn-add-sm{margin-inline-start:auto;display:inline-flex;align-items:center;gap:5px;background:#fff2e8;color:#b54708;border:none;border-radius:9px;padding:6px 11px;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer}
.vn-explist{display:flex;flex-direction:column;gap:9px}
.vn-exp{display:flex;align-items:center;gap:11px;background:#fff;border:1px solid #eceef1;border-radius:12px;padding:11px 13px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.vn-exp-ic{width:34px;height:34px;border-radius:10px;background:#eef4ff;color:#1d5bbf;display:flex;align-items:center;justify-content:center;flex:none}
.vn-exp-t{font-size:12.5px;font-weight:800;color:#0f172a}.vn-exp-s{font-size:11px;color:#94a3b8;margin-top:1px}
.vn-exp-amt{font-size:13.5px;font-weight:800;color:#0f172a;flex:none}
.vn-x{border:none;background:#feecea;color:#b42318;width:28px;height:28px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex:none}
.vn-card{background:#fff;border:1px solid #eceef1;border-radius:14px;padding:14px;margin-bottom:12px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.vn-f{display:flex;flex-direction:column;gap:5px;margin-bottom:10px}
.vn-f span{font-size:11px;color:#64748b;font-weight:600}
.vn-f input,.vn-f select,.vn-f textarea{border:1px solid #e6e9ee;border-radius:10px;padding:10px 12px;font-family:inherit;font-size:13px;outline:none;background:#fff;color:#0f172a;resize:vertical}
.vn-f input:focus,.vn-f select:focus,.vn-f textarea:focus{border-color:var(--b);box-shadow:0 0 0 3px rgba(232,113,43,.1)}
.vn-f input.ltr{direction:ltr;text-align:left}
.vn-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.vn-form-act{display:flex;gap:8px;align-items:center;margin-top:4px}
.vn-chk{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;color:#334155;margin-bottom:12px;cursor:pointer}
.vn-chk input{width:17px;height:17px;accent-color:#087443}
.vn-modal{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:flex-end;justify-content:center;z-index:100;padding:0}
.vn-sheet{background:#fff;border-radius:20px 20px 0 0;padding:18px;width:100%;max-width:560px;max-height:90vh;overflow:auto}
.vn-sheet-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.vn-sheet-h b{font-size:15px;font-weight:800}
.vn-sheet-h button{border:none;background:#f4f5f7;width:30px;height:30px;border-radius:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#64748b}
@media(min-width:560px){.vn-modal{align-items:center}.vn-sheet{border-radius:18px}}
@media(max-width:720px){.vn-kpis{grid-template-columns:1fr 1fr}.vn-grid2{grid-template-columns:1fr}}
`;
