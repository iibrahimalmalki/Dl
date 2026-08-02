import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";

const DOC_TYPES=["تأمين مركبة","استمارة سير","رخصة قيادة","إقامة","رخصة بلدية","عقد إيجار","اشتراك/رخصة تشغيل","أخرى"];
const TYPE_ICON={"تأمين مركبة":"bike","استمارة سير":"id","رخصة قيادة":"id","إقامة":"id","رخصة بلدية":"building","عقد إيجار":"home","اشتراك/رخصة تشغيل":"doc","أخرى":"doc"};

// عتبات الحالة (مطابقة لملف المتابعة)
function band(days){
  if(days==null)return{k:"none",ar:"—",c:"#94a3b8",bg:"#f4f5f7"};
  if(days<0)return{k:"exp",ar:"منتهية",c:"#b42318",bg:"#feecea"};
  if(days<=30)return{k:"urg",ar:"عاجلة",c:"#c2410c",bg:"#ffedd5"};
  if(days<=60)return{k:"warn",ar:"تنبيه",c:"#b54708",bg:"#fef3e2"};
  if(days<=90)return{k:"watch",ar:"مراقبة",c:"#1d5bbf",bg:"#eef4ff"};
  return{k:"ok",ar:"سارية",c:"#087443",bg:"#e7f7ef"};
}
const daysLeft=end=>{if(!end)return null;const t=new Date();t.setHours(0,0,0,0);const e=new Date(end+"T00:00:00");return Math.round((e-t)/86400000);};
const fmtD=d=>d?new Date(d+"T00:00:00").toLocaleDateString("en-GB"):"—";

export default function Renewals({opId}){
  const[loading,setLoading]=useState(true);
  const[docs,setDocs]=useState([]);
  const[filter,setFilter]=useState("all");
  const[form,setForm]=useState(null);const[msg,setMsg]=useState(null);const[busy,setBusy]=useState(false);
  const note=(ok,t)=>setMsg({ok,t});

  const load=async()=>{
    setLoading(true);
    let q=supabase.from("renewal_docs").select("*").eq("active",true);
    if(opId&&opId!=="all")q=q.eq("operator_id",opId);
    const{data}=await q;
    const rows=(data||[]).map(r=>({...r,_d:daysLeft(r.end_date)}));
    rows.sort((a,b)=>(a._d==null?1e9:a._d)-(b._d==null?1e9:b._d));
    setDocs(rows);setLoading(false);
  };
  useEffect(()=>{load();/*eslint-disable-next-line*/},[opId]);

  const kpis=useMemo(()=>{
    const withEnd=docs.filter(d=>d._d!=null);
    const nearest=withEnd.filter(d=>d._d>=0).reduce((m,d)=>m==null||d._d<m._d?d:m,null);
    const min=withEnd.length?Math.min(...withEnd.map(d=>d._d)):null;
    return{total:docs.length,nearest,min,urgent:withEnd.filter(d=>d._d>=0&&d._d<=30).length,expired:withEnd.filter(d=>d._d<0).length,valid:withEnd.filter(d=>d._d>90).length};
  },[docs]);
  const shown=docs.filter(d=>filter==="all"||d.doc_type===filter);

  const save=async()=>{
    if(!form.subject.trim()){note(false,"أدخل موضوع الوثيقة (اللوحة/الاسم)");return;}
    setBusy(true);note(false,"");
    const row={operator_id:(opId&&opId!=="all")?opId:null,doc_type:form.doc_type,title:form.title||null,subject:form.subject.trim(),subject_kind:form.subject_kind||null,provider:form.provider||null,ref_no:form.ref_no||null,start_date:form.start_date||null,end_date:form.end_date||null,notes:form.notes||null,active:form.active!==false};
    try{
      if(form.id)await supabase.from("renewal_docs").update(row).eq("id",form.id);
      else await supabase.from("renewal_docs").insert(row);
      setForm(null);note(true,"تم الحفظ");await load();
    }catch(e){note(false,"خطأ: "+(e.message||e));}
    setBusy(false);
  };
  const del=async(d)=>{if(!confirm("حذف وثيقة «"+d.subject+"»؟"))return;await supabase.from("renewal_docs").delete().eq("id",d.id);await load();};
  const renew=(d)=>setForm({...d});   // فتح للتعديل (تحديث تاريخ النهاية)

  if(loading)return <div className="dw-skel" style={{height:260}}/>;

  return(<div className="rn">
    <style>{CSS}</style>
    {msg&&msg.t&&<div className={"rn-msg "+(msg.ok?"ok":"err")}>{msg.t}</div>}

    <div className="rn-kpis">
      <K ic="doc" c="#E8712B" bg="#fff2e8" t="وثائق مُتابَعة" v={kpis.total}/>
      <K ic="alert" c="#c2410c" bg="#ffedd5" t="عاجلة (≤30 يوم)" v={kpis.urgent}/>
      <K ic="xCircle" c="#b42318" bg="#feecea" t="منتهية" v={kpis.expired}/>
      <K ic="clock" c="#1d5bbf" bg="#eef4ff" t="أقل أيام متبقية" v={kpis.min==null?"—":kpis.min}/>
      <K ic="checkCircle" c="#087443" bg="#e7f7ef" t="سارية (>90)" v={kpis.valid}/>
      <K ic="calendar" c="#6d4bcb" bg="#f6f2ff" t="أقرب انتهاء" v={kpis.nearest?fmtD(kpis.nearest.end_date):"—"} small/>
    </div>

    <div className="rn-bar">
      <div className="rn-filters"><button className={filter==="all"?"on":""} onClick={()=>setFilter("all")}>الكل</button>{DOC_TYPES.map(t=><button key={t} className={filter===t?"on":""} onClick={()=>setFilter(t)}>{t}</button>)}</div>
      <button className="rn-add" onClick={()=>setForm({doc_type:"تأمين مركبة",title:"",subject:"",subject_kind:"مركبة",provider:"",ref_no:"",start_date:"",end_date:"",notes:"",active:true})}><Icon n="plus" s={15}/> وثيقة جديدة</button>
    </div>

    {shown.length===0?<div className="rn-empty"><div className="rn-empty-ic"><Icon n="doc" s={30}/></div><h3>لا وثائق{filter!=="all"?` من نوع «${filter}»`:""}</h3><p>أضف وثائق التأمين والاستمارات والرخص والإقامات لمتابعة صلاحيتها والتنبيه قبل انتهائها.</p></div>:
    <div className="rn-list">{shown.map(d=>{const b=band(d._d);return(
      <div className="rn-item" key={d.id} style={{borderInlineStartColor:b.c}}>
        <div className="rn-ic" style={{background:b.bg,color:b.c}}><Icon n={TYPE_ICON[d.doc_type]||"doc"} s={16}/></div>
        <div style={{flex:1,minWidth:0}}>
          <div className="rn-name">{d.subject}<span className="rn-type">{d.doc_type}</span></div>
          <div className="rn-sub">{d.provider?`${d.provider} · `:""}{d.ref_no?`رقم ${d.ref_no} · `:""}تنتهي {fmtD(d.end_date)}</div>
        </div>
        <div className="rn-daysbox">
          <span className="rn-days" style={{color:b.c}}>{d._d==null?"—":d._d<0?`${Math.abs(d._d)}-`:d._d}</span>
          <small>{d._d==null?"":"يوم"}</small>
        </div>
        <span className="rn-band" style={{background:b.bg,color:b.c}}>{b.ar}</span>
        <div className="rn-act"><button onClick={()=>renew(d)} title="تجديد/تعديل"><Icon n="refresh" s={13}/></button><button className="del" onClick={()=>del(d)} title="حذف"><Icon n="trash" s={13}/></button></div>
      </div>);})}</div>}

    <div className="rn-legend">
      {[["منتهية","#b42318","#feecea"],["عاجلة 0–30","#c2410c","#ffedd5"],["تنبيه 31–60","#b54708","#fef3e2"],["مراقبة 61–90","#1d5bbf","#eef4ff"],["سارية >90","#087443","#e7f7ef"]].map(([t,c,bg])=><span key={t} className="rn-lg" style={{background:bg,color:c}}>{t}</span>)}
    </div>

    {form&&<div className="rn-modal" onClick={e=>{if(e.target.className==="rn-modal")setForm(null);}}>
      <div className="rn-sheet">
        <div className="rn-sheet-h"><b>{form.id?"تعديل/تجديد وثيقة":"وثيقة جديدة"}</b><button onClick={()=>setForm(null)}><Icon n="x" s={16}/></button></div>
        <div className="rn-g2"><F l="نوع الوثيقة"><select value={form.doc_type} onChange={e=>setForm({...form,doc_type:e.target.value})}>{DOC_TYPES.map(t=><option key={t}>{t}</option>)}</select></F><F l="نوع الموضوع"><select value={form.subject_kind} onChange={e=>setForm({...form,subject_kind:e.target.value})}><option value="مركبة">مركبة</option><option value="شخص">شخص</option><option value="مؤسسة">مؤسسة</option></select></F></div>
        <F l="الموضوع (اللوحة / الاسم)"><input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="مثال: 5532 ق ب / سلمان المالكي"/></F>
        <F l="العنوان"><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="تأمين المسؤولية تجاه الغير"/></F>
        <div className="rn-g2"><F l="الجهة المُصدِرة"><input value={form.provider} onChange={e=>setForm({...form,provider:e.target.value})} placeholder="التعاونية للتأمين"/></F><F l="رقم الوثيقة"><input value={form.ref_no} onChange={e=>setForm({...form,ref_no:e.target.value})}/></F></div>
        <div className="rn-g2"><F l="تاريخ البداية"><input type="date" value={form.start_date||""} onChange={e=>setForm({...form,start_date:e.target.value})}/></F><F l="تاريخ النهاية"><input type="date" value={form.end_date||""} onChange={e=>setForm({...form,end_date:e.target.value})}/></F></div>
        {form.end_date&&<div className="rn-preview" style={{background:band(daysLeft(form.end_date)).bg,color:band(daysLeft(form.end_date)).c}}><Icon n="clock" s={13}/> {band(daysLeft(form.end_date)).ar} — {daysLeft(form.end_date)} يوم متبقٍّ</div>}
        <F l="ملاحظات"><textarea rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="VIN، تسلسلي، تفاصيل…"/></F>
        <div className="rn-mact"><button className="rn-b brand" onClick={save} disabled={busy}><Icon n="save" s={14}/> حفظ</button>{form.id&&<button className="rn-b danger" onClick={()=>del(form)}><Icon n="trash" s={14}/> حذف</button>}<div style={{flex:1}}/><button className="rn-b ghost" onClick={()=>setForm(null)}>إلغاء</button></div>
      </div>
    </div>}
  </div>);
}

function K({ic,c,bg,t,v,small}){return(<div className="rn-kpi"><span className="rn-ki" style={{background:bg,color:c}}><Icon n={ic} s={16}/></span><div style={{minWidth:0}}><div className={"rn-kv"+(small?" sm":"")}>{v}</div><div className="rn-kl">{t}</div></div></div>);}
function F({l,children}){return(<label className="rn-f"><span>{l}</span>{children}</label>);}

const CSS=`
.rn{--b:#E8712B}
.rn-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:12px}
.rn-msg.ok{background:#e7f7ef;color:#087443}.rn-msg.err{background:#feecea;color:#b42318}
.rn-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:11px;margin-bottom:14px}
.rn-kpi{background:#fff;border:1px solid #eceef1;border-radius:14px;padding:12px;display:flex;align-items:center;gap:10px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.rn-ki{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none}
.rn-kv{font-size:19px;font-weight:800;letter-spacing:-.5px}.rn-kv.sm{font-size:13px}.rn-kl{font-size:10.5px;color:#64748b;font-weight:600;line-height:1.3}
.rn-bar{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.rn-filters{display:flex;gap:6px;flex-wrap:wrap;flex:1}
.rn-filters button{background:#fff;border:1px solid #e6e9ee;border-radius:20px;padding:5px 12px;font-family:inherit;font-size:11.5px;font-weight:700;color:#64748b;cursor:pointer}
.rn-filters button.on{background:#0e1622;border-color:#0e1622;color:#fff}
.rn-add{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#E8712B,#f5a35f);border:none;border-radius:11px;padding:9px 15px;color:#fff;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;flex:none}
.rn-list{display:flex;flex-direction:column;gap:9px}
.rn-item{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #eceef1;border-inline-start:4px solid;border-radius:14px;padding:11px 14px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.rn-ic{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.rn-name{font-size:13.5px;font-weight:800;color:#0f172a;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.rn-type{font-size:10px;font-weight:800;background:#f4f5f7;color:#64748b;padding:1px 8px;border-radius:20px}
.rn-sub{font-size:11px;color:#94a3b8;margin-top:2px}
.rn-daysbox{text-align:center;flex:none;min-width:44px}
.rn-days{font-size:18px;font-weight:800;letter-spacing:-.5px}.rn-daysbox small{display:block;font-size:9px;color:#94a3b8}
.rn-band{font-size:11px;font-weight:800;padding:3px 11px;border-radius:20px;flex:none}
.rn-act{display:flex;gap:6px;flex:none}
.rn-act button{border:1px solid #e6e9ee;background:#fff;width:30px;height:30px;border-radius:9px;cursor:pointer;color:#64748b;display:flex;align-items:center;justify-content:center}
.rn-act button.del{color:#b42318;background:#feecea;border-color:#f7bfba}
.rn-legend{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.rn-lg{font-size:10.5px;font-weight:800;padding:3px 11px;border-radius:20px}
.rn-empty{background:#fff;border:1px dashed #e6e9ee;border-radius:16px;padding:38px 24px;text-align:center}
.rn-empty-ic{width:60px;height:60px;border-radius:16px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#fff2e8,#ffe2cc);color:var(--b)}
.rn-empty h3{font-size:15px;margin:0 0 7px}.rn-empty p{color:#64748b;font-size:12px;max-width:420px;margin:0 auto;line-height:1.7}
.rn-modal{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:flex-end;justify-content:center;z-index:100}
.rn-sheet{background:#fff;border-radius:20px 20px 0 0;padding:18px;width:100%;max-width:560px;max-height:92vh;overflow:auto}
@media(min-width:560px){.rn-modal{align-items:center}.rn-sheet{border-radius:18px}}
.rn-sheet-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.rn-sheet-h b{font-size:15px;font-weight:800}
.rn-sheet-h button{border:none;background:#f4f5f7;width:30px;height:30px;border-radius:9px;cursor:pointer;color:#64748b;display:flex;align-items:center;justify-content:center}
.rn-f{display:flex;flex-direction:column;gap:5px;margin-bottom:10px}
.rn-f span{font-size:11px;color:#64748b;font-weight:600}
.rn-f input,.rn-f select,.rn-f textarea{border:1px solid #e6e9ee;border-radius:10px;padding:10px 12px;font-family:inherit;font-size:13px;outline:none;background:#fff;color:#0f172a}
.rn-f input:focus,.rn-f select:focus,.rn-f textarea:focus{border-color:var(--b);box-shadow:0 0 0 3px rgba(232,113,43,.1)}
.rn-g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.rn-preview{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800;border-radius:10px;padding:9px 11px;margin-bottom:10px}
.rn-mact{display:flex;gap:8px;align-items:center;margin-top:4px}
.rn-b{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:11px;border:none;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;background:#0f172a;color:#fff}
.rn-b.brand{background:linear-gradient(135deg,#E8712B,#f5a35f)}
.rn-b.ghost{background:#fff;border:1px solid #e6e9ee;color:#334155}
.rn-b.danger{background:#feecea;color:#b42318}
@media(max-width:1000px){.rn-kpis{grid-template-columns:repeat(3,1fr)}}
@media(max-width:640px){.rn-kpis{grid-template-columns:repeat(2,1fr)}.rn-g2{grid-template-columns:1fr}}
`;
