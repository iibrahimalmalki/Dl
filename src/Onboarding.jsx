import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{PHASES,TOTAL_ITEMS,keyOf,progress,phaseProgress}from"./onboardingChecklist";

export default function Onboarding({opId}){
  const[loading,setLoading]=useState(true);
  const[emps,setEmps]=useState([]);
  const[list,setList]=useState([]);
  const[sel,setSel]=useState(null);       // employee being onboarded
  const[recId,setRecId]=useState(null);
  const[items,setItems]=useState({});
  const[notes,setNotes]=useState("");
  const[msg,setMsg]=useState(null);const[saving,setSaving]=useState(false);

  useEffect(()=>{(async()=>{
    setLoading(true);
    const{data:e}=await supabase.from("employees").select("id,full_name,employee_id,created_at").order("created_at",{ascending:false});
    setEmps(e||[]);
    let q=supabase.from("onboarding").select("*").order("updated_at",{ascending:false});
    if(opId&&opId!=="all")q=q.eq("operator_id",opId);
    const{data}=await q;setList(data||[]);
    setLoading(false);
  })();},[opId]);

  const open=async(emp)=>{
    setSel(emp);setMsg(null);
    const ex=list.find(o=>o.employee_id===emp.id);
    if(ex){setRecId(ex.id);setItems(ex.items||{});setNotes(ex.notes||"");}
    else{setRecId(null);setItems({});setNotes("");}
  };
  const toggle=(pi,ii)=>{const k=keyOf(pi,ii);setItems(p=>({...p,[k]:!p[k]}));};
  const prog=useMemo(()=>progress(items),[items]);

  const save=async()=>{
    if(!sel)return;setSaving(true);setMsg(null);
    try{
      const done=prog.pct>=100;
      const row={operator_id:(opId&&opId!=="all")?opId:null,employee_id:sel.id,sweater_id:sel.employee_id,biker_name:sel.full_name,items,progress:prog.pct,completed_at:done?new Date().toISOString():null,notes:notes||null,updated_at:new Date().toISOString()};
      let saved;
      if(recId){const{data,error}=await supabase.from("onboarding").update(row).eq("id",recId).select().single();if(error)throw error;saved=data;}
      else{const{data,error}=await supabase.from("onboarding").insert(row).select().single();if(error)throw error;saved=data;setRecId(data.id);}
      setList(p=>{const o=p.filter(x=>x.id!==saved.id);return[saved,...o];});
      setMsg({ok:true,t:done?"اكتمل التجهيز — البايكر جاهز للعمل المستقل":"تم حفظ التقدّم"});
    }catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setSaving(false);
  };

  if(loading)return <div className="dw-skel" style={{height:280}}/>;

  return(<div className="ob">
    <style>{CSS}</style>

    {/* اختيار البايكر */}
    <div className="ob-pick">
      <Icon n="employees" s={16}/>
      <select value={sel?.id||""} onChange={e=>{const emp=emps.find(x=>x.id===e.target.value);if(emp)open(emp);else setSel(null);}}>
        <option value="">اختر بايكر لتجهيزه…</option>
        {emps.map(e=><option key={e.id} value={e.id}>{e.full_name} · #{e.employee_id||"—"}</option>)}
      </select>
    </div>
    {msg&&<div className={"ob-msg "+(msg.ok?"ok":"err")}>{msg.t}</div>}

    {sel?<>
      {/* رأس التقدّم */}
      <div className="ob-hero">
        <div className="ob-hero-l"><div className="ob-av">{(sel.full_name||"?").trim().charAt(0)}</div><div><div className="ob-name">{sel.full_name}<small>#{sel.employee_id||"—"}</small></div><div className="ob-sub">{prog.done} من {TOTAL_ITEMS} بند مكتمل</div></div></div>
        <div className="ob-pct" style={{color:prog.pct>=100?"#087443":"#E8712B"}}>{prog.pct}%</div>
      </div>
      <div className="ob-track"><div style={{width:prog.pct+"%",background:prog.pct>=100?"#12b76a":"#E8712B"}}/></div>
      {prog.pct>=100&&<div className="ob-ready"><Icon n="check" s={15}/> مكتمل — البايكر جاهز للعمل المستقل بعد اعتماد المشرف والمالك</div>}

      {/* المراحل */}
      {PHASES.map((ph,pi)=>{const pp=phaseProgress(items,pi);return(
        <div className="ob-phase" key={ph.k}>
          <div className="ob-ph-h"><span className="ob-ph-ic"><Icon n={ph.ic} s={15}/></span><b>المرحلة {pi+1}: {ph.ar}</b><span className={"ob-ph-pct"+(pp.pct>=100?" done":"")}>{pp.done}/{pp.total}</span></div>
          {ph.items.map((it,ii)=>{const on=!!items[keyOf(pi,ii)];return(
            <label className={"ob-item"+(on?" on":"")} key={ii}>
              <span className="ob-ck">{on&&<Icon n="check" s={14}/>}</span>
              <input type="checkbox" checked={on} onChange={()=>toggle(pi,ii)} hidden/>
              <div className="ob-it-txt"><div className="ob-it-ar">{it}</div><div className="ob-it-resp">{ph.resp[ii]}</div></div>
            </label>);})}
        </div>);})}

      <label className="ob-notes"><span>ملاحظات</span><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="اختياري"/></label>
      <button className="ob-save" onClick={save} disabled={saving}><Icon n="save" s={15}/> {saving?"جارٍ الحفظ…":"حفظ التجهيز"}</button>
    </>:<>
      {/* قائمة التجهيزات */}
      <div className="ob-sec-h"><Icon n="onboarding" s={16}/> ملفات التجهيز <span>({list.length})</span></div>
      {list.length===0?<div className="ob-empty"><div className="ob-empty-ic"><Icon n="onboarding" s={30}/></div><h3>لا ملفات تجهيز بعد</h3><p>اختر بايكراً من الأعلى لبدء قائمة تجهيزه (CHK-HR-001) — 5 مراحل و30 بنداً حتى الجاهزية للعمل المستقل.</p></div>:
      <div className="ob-list">{list.map(o=>{const emp=emps.find(e=>e.id===o.employee_id)||{full_name:o.biker_name,employee_id:o.sweater_id};const done=o.progress>=100;return(
        <div className="ob-card" key={o.id} onClick={()=>open(emp)}>
          <div className="ob-c-av">{(o.biker_name||"?").trim().charAt(0)}</div>
          <div style={{flex:1,minWidth:0}}>
            <div className="ob-c-name">{o.biker_name||"—"}<small>#{o.sweater_id||"—"}</small></div>
            <div className="ob-c-track"><div style={{width:(o.progress||0)+"%",background:done?"#12b76a":"#E8712B"}}/></div>
          </div>
          {done?<span className="ob-c-badge done"><Icon n="check" s={12}/> جاهز</span>:<span className="ob-c-badge">{o.progress||0}%</span>}
        </div>);})}</div>}
    </>}
  </div>);
}

const CSS=`
.ob{--b:#E8712B}
.ob-pick{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #e6e9ee;border-radius:12px;padding:9px 13px;margin-bottom:12px;color:#64748b}
.ob-pick select{flex:1;border:none;outline:none;font-family:inherit;font-size:13.5px;font-weight:700;color:#0f172a;background:none}
.ob-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:12px}
.ob-msg.ok{background:#e7f7ef;color:#087443}.ob-msg.err{background:#feecea;color:#b42318}
.ob-hero{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
.ob-hero-l{display:flex;align-items:center;gap:12px;min-width:0}
.ob-av{width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#E8712B,#f5a35f);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;flex:none}
.ob-name{font-size:15px;font-weight:800;color:#0f172a}.ob-name small{color:#94a3b8;font-weight:600;margin-inline-start:6px;font-size:12px}
.ob-sub{font-size:12px;color:#64748b}
.ob-pct{font-size:26px;font-weight:800;letter-spacing:-.5px}
.ob-track{height:9px;background:#eef0f3;border-radius:6px;overflow:hidden;margin-bottom:12px}
.ob-track div{height:100%;border-radius:6px;transition:width .3s}
.ob-ready{display:flex;align-items:center;gap:7px;background:#e7f7ef;border:1px solid #b7e4cd;color:#087443;font-size:12.5px;font-weight:800;border-radius:11px;padding:10px 12px;margin-bottom:14px}
.ob-phase{background:#fff;border:1px solid #eceef1;border-radius:16px;padding:6px 14px 10px;margin-bottom:11px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.ob-ph-h{display:flex;align-items:center;gap:9px;padding:11px 0 9px;border-bottom:1px solid #f1f3f5}
.ob-ph-ic{width:28px;height:28px;border-radius:9px;background:#fff2e8;color:#E8712B;display:flex;align-items:center;justify-content:center;flex:none}
.ob-ph-h b{font-size:13px;font-weight:800;flex:1}
.ob-ph-pct{font-size:11.5px;font-weight:800;color:#94a3b8;background:#f4f5f7;padding:2px 10px;border-radius:20px}
.ob-ph-pct.done{background:#e7f7ef;color:#087443}
.ob-item{display:flex;align-items:flex-start;gap:11px;padding:10px 2px;border-bottom:1px solid #f6f7f9;cursor:pointer}
.ob-item:last-child{border-bottom:none}
.ob-ck{width:22px;height:22px;border-radius:7px;border:1.5px solid #d7dde5;background:#fff;display:flex;align-items:center;justify-content:center;color:#fff;flex:none;margin-top:1px}
.ob-item.on .ob-ck{background:#12b76a;border-color:#12b76a}
.ob-it-txt{flex:1;min-width:0}
.ob-it-ar{font-size:12.5px;font-weight:600;color:#0f172a;line-height:1.5}
.ob-item.on .ob-it-ar{color:#64748b;text-decoration:line-through;text-decoration-color:#cbd5e1}
.ob-it-resp{font-size:10px;color:#94a3b8;margin-top:2px}
.ob-notes{display:flex;flex-direction:column;gap:5px;margin:4px 0 12px}
.ob-notes span{font-size:11px;color:#64748b;font-weight:600}
.ob-notes textarea{border:1px solid #e6e9ee;border-radius:11px;padding:10px 12px;font-family:inherit;font-size:13px;outline:none;resize:vertical}
.ob-notes textarea:focus{border-color:var(--b);box-shadow:0 0 0 3px rgba(232,113,43,.1)}
.ob-save{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:13px;border:none;border-radius:13px;background:linear-gradient(135deg,#12b76a,#087443);color:#fff;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer}
.ob-save:disabled{opacity:.6}
.ob-sec-h{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;margin-bottom:12px}
.ob-sec-h span{color:#94a3b8;font-weight:600;font-size:12px}
.ob-list{display:flex;flex-direction:column;gap:10px}
.ob-card{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #eceef1;border-radius:14px;padding:12px 14px;box-shadow:0 1px 2px rgba(16,24,40,.05);cursor:pointer}
.ob-card:hover{border-color:#f5c9a8}
.ob-c-av{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#E8712B,#f5a35f);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex:none}
.ob-c-name{font-size:13.5px;font-weight:800;color:#0f172a;margin-bottom:6px}.ob-c-name small{color:#94a3b8;font-weight:600;margin-inline-start:6px;font-size:11.5px}
.ob-c-track{height:7px;background:#eef0f3;border-radius:5px;overflow:hidden}.ob-c-track div{height:100%;border-radius:5px}
.ob-c-badge{font-size:11.5px;font-weight:800;color:#64748b;background:#f4f5f7;padding:4px 11px;border-radius:20px;flex:none}
.ob-c-badge.done{display:inline-flex;align-items:center;gap:4px;background:#e7f7ef;color:#087443}
.ob-empty{background:#fff;border:1px dashed #e6e9ee;border-radius:16px;padding:40px 24px;text-align:center}
.ob-empty-ic{width:64px;height:64px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#fff2e8,#ffe2cc);color:var(--b)}
.ob-empty h3{font-size:16px;margin:0 0 8px}.ob-empty p{color:#64748b;font-size:12.5px;max-width:440px;margin:0 auto;line-height:1.7}
`;
